import { invoke } from "@tauri-apps/api/core";
import { Stronghold, Location, Client } from "@tauri-apps/plugin-stronghold";

export type AppProfile = { name: string; origin: string | null; remoteConfigured: boolean; minimumServerVersion: string; appVersion: string };
export type CachedEnvelope = { recordId: string; recordType: string; nonce: string; ciphertext: string; aadHash: string; updatedAt: string };
type UnlockGuardState = { failedAttempts: number; retryAfterSeconds: number };
type VaultSnapshotState = { path: string; exists: boolean };
export type DiagnosticEvent = "VAULT_LOCKED" | "AUTHORIZATION_FAILED" | "REFERENCE_REFRESHED" | "REFERENCE_REFRESH_FAILED" | "SYNC_ACCEPTED" | "SYNC_CONFLICT" | "SYNC_REJECTED" | "SYNC_RETRY_LATER" | "DEVICE_REVOKED";
export type DiagnosticExport = { schemaVersion: 1; appVersion: string; platform: string; generatedAtEpoch: number; syncStateCounts: Record<string, number>; safeEvents: Array<{ occurredAtEpoch: number; safeErrorCode: string }> };

const CLIENT_NAME = "nalanda-native";
const TOKEN_KEY = "native-refresh-token";
const CONTENT_KEY = "native-content-key";
const SIGNING_SEED = "native-signing-seed";
const SIGNING_KEY = "native-signing-key";
const DEVICE_ID_KEY = "native-device-id";

export function isNativeRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function appProfile(): Promise<AppProfile> {
  if (!isNativeRuntime()) return { name: "BROWSER_PREVIEW", origin: null, remoteConfigured: false, minimumServerVersion: "0.1.0", appVersion: "0.1.0" };
  return invoke<AppProfile>("app_profile");
}

export async function openSystemAuthorization(url: string) {
  if (!/^https:\/\//i.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(url)) throw new Error("Authorization URL is not allowed.");
  if (isNativeRuntime()) return invoke("open_authorization", { url });
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function openOnlineErp() {
  if (!isNativeRuntime()) throw new Error("The online ERP webview is available only in the installed app.");
  await invoke("open_online_erp");
}

export async function storeEnvelope(envelope: CachedEnvelope) {
  if (!isNativeRuntime()) return;
  await invoke("cache_put", { envelope });
}

export async function listEnvelopes(recordType: string) {
  if (!isNativeRuntime()) return [] as CachedEnvelope[];
  return invoke<CachedEnvelope[]>("cache_list", { recordType });
}

export async function deleteEnvelope(recordId: string) {
  if (!isNativeRuntime()) return;
  await invoke("cache_delete", { recordId });
}

export async function resetLocalCache(confirmation: string) {
  if (!isNativeRuntime()) return;
  await invoke("cache_reset", { confirmation });
}

export async function recordDiagnostic(event: DiagnosticEvent) {
  if (!isNativeRuntime()) return;
  await invoke("diagnostic_record", { event });
}

export async function exportDiagnostics(): Promise<DiagnosticExport> {
  if (!isNativeRuntime()) return { schemaVersion: 1, appVersion: "0.1.0", platform: "browser-preview", generatedAtEpoch: Math.floor(Date.now() / 1000), syncStateCounts: {}, safeEvents: [] };
  return invoke<DiagnosticExport>("diagnostic_export");
}

export async function nativeRequest(operation: string, body: string | null, headers: Record<string, string>) {
  return invoke<{ status: number; body: string }>("native_api_request", { operation, body, headers });
}

export class VaultSession {
  private constructor(private readonly stronghold: Stronghold, private readonly client: Client) {}

  static async unlock(pin: string) {
    if (!isNativeRuntime()) return null;
    if (!/^\d{8,12}$/.test(pin)) throw new Error("Use an 8–12 digit app PIN.");
    const guard = await invoke<UnlockGuardState>("unlock_guard_status");
    if (guard.retryAfterSeconds > 0) throw new Error(`APP_UNLOCK_BACKOFF:${guard.retryAfterSeconds}`);
    const snapshot = await invoke<VaultSnapshotState>("vault_snapshot_state");
    const rejected = async () => {
      const next = await invoke<UnlockGuardState>("unlock_guard_record_failure");
      if (next.retryAfterSeconds > 0) throw new Error(`APP_UNLOCK_BACKOFF:${next.retryAfterSeconds}`);
      throw new Error(`APP_UNLOCK_FAILED:${Math.max(0, 5 - next.failedAttempts)}`);
    };
    let stronghold: Stronghold;
    try {
      stronghold = await Stronghold.load(snapshot.path, pin);
    } catch {
      return rejected();
    }
    let client: Client;
    try {
      client = await stronghold.loadClient(CLIENT_NAME);
    } catch {
      if (snapshot.exists) {
        let unloaded = true;
        try { await stronghold.unload(); } catch { unloaded = false; }
        if (!unloaded) {
          await invoke("unlock_guard_record_failure");
          throw new Error("APP_UNLOCK_CLEANUP_FAILED");
        }
        return rejected();
      }
      client = await stronghold.createClient(CLIENT_NAME);
    }
    await invoke("unlock_guard_clear");
    return new VaultSession(stronghold, client);
  }

  async initialize() {
    const store = this.client.getStore();
    if (!(await store.get(CONTENT_KEY))) await store.insert(CONTENT_KEY, Array.from(crypto.getRandomValues(new Uint8Array(32))));
    const seedLocation = Location.generic("identity", SIGNING_SEED);
    const keyLocation = Location.generic("identity", SIGNING_KEY);
    try { await this.client.getVault("identity").getEd25519PublicKey(keyLocation); }
    catch {
      await this.client.getVault("identity").generateSLIP10Seed(seedLocation);
      await this.client.getVault("identity").deriveSLIP10([44, 729, 1], "Seed", seedLocation, keyLocation);
    }
    await this.stronghold.save();
  }

  async contentKey() {
    const value = await this.client.getStore().get(CONTENT_KEY);
    if (!value || value.length !== 32) throw new Error("Encrypted workspace key is unavailable.");
    return new Uint8Array(value);
  }

  async publicSigningJwk() {
    const value = await this.client.getVault("identity").getEd25519PublicKey(Location.generic("identity", SIGNING_KEY));
    return { kty: "OKP", crv: "Ed25519", x: toBase64Url(new Uint8Array(value)), ext: true, key_ops: ["verify"] };
  }

  async sign(message: string) {
    const value = await this.client.getVault("identity").signEd25519(Location.generic("identity", SIGNING_KEY), message);
    return toBase64Url(new Uint8Array(value));
  }

  async setRefreshToken(value: string) {
    await this.client.getStore().insert(TOKEN_KEY, Array.from(new TextEncoder().encode(value)));
    await this.stronghold.save();
  }

  async deviceId() {
    const store = this.client.getStore();
    const existing = await store.get(DEVICE_ID_KEY);
    if (existing) return new TextDecoder().decode(new Uint8Array(existing));
    const value = crypto.randomUUID();
    await store.insert(DEVICE_ID_KEY, Array.from(new TextEncoder().encode(value)));
    await this.stronghold.save();
    return value;
  }

  async setSecureJson(key: string, value: unknown) {
    if (!/^native-[a-z0-9-]{3,48}$/.test(key)) throw new Error("Secure store key is invalid.");
    await this.client.getStore().insert(key, Array.from(new TextEncoder().encode(JSON.stringify(value))));
    await this.stronghold.save();
  }

  async getSecureJson<T>(key: string): Promise<T | null> {
    if (!/^native-[a-z0-9-]{3,48}$/.test(key)) throw new Error("Secure store key is invalid.");
    const value = await this.client.getStore().get(key);
    return value ? JSON.parse(new TextDecoder().decode(new Uint8Array(value))) as T : null;
  }

  async removeSecureJson(key: string) {
    if (!/^native-[a-z0-9-]{3,48}$/.test(key)) throw new Error("Secure store key is invalid.");
    const store = this.client.getStore();
    if (await store.get(key)) await store.remove(key);
    await this.stronghold.save();
  }

  async refreshToken() {
    const value = await this.client.getStore().get(TOKEN_KEY);
    return value ? new TextDecoder().decode(new Uint8Array(value)) : null;
  }

  async lock() {
    let failure: unknown;
    try { await this.stronghold.save(); } catch (error) { failure = error; }
    try { await this.stronghold.unload(); } catch (error) { failure ??= error; }
    if (failure) throw failure;
  }

  async wipe() {
    const store = this.client.getStore();
    for (const key of [TOKEN_KEY, CONTENT_KEY, DEVICE_ID_KEY, "native-pending-auth", "native-session-meta"]) {
      if (await store.get(key)) await store.remove(key);
    }
    const vault = this.client.getVault("identity");
    await vault.remove(Location.generic("identity", SIGNING_KEY));
    await vault.remove(Location.generic("identity", SIGNING_SEED));
    await this.stronghold.save();
    await this.stronghold.unload();
  }
}

function toBase64Url(value: Uint8Array) {
  let binary = "";
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
