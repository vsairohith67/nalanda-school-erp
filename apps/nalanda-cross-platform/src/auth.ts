import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { appProfile, nativeRequest, openSystemAuthorization, type VaultSession } from "./native";

const PENDING_KEY = "native-pending-auth";
const SESSION_META_KEY = "native-session-meta";

type PendingAuthorization = {
  requestId: string;
  state: string;
  nonce: string;
  verifier: string;
  publicDeviceId: string;
  createdAt: string;
};

export type NativeTokens = { tokenType: "Bearer"; sessionId: string; tokenVersion: number; deviceKeyVersion: number; accessToken: string; accessExpiresAt: string; refreshToken: string; refreshExpiresAt: string; scopes: string[] };
export type NativeDataOperation = "CONTEXT" | "REFERENCE_PACK" | "SYNC" | "CONFLICTS" | "LOGOUT";

export const APP_VERSION = "0.1.0";
const NATIVE_PATHS: Record<NativeDataOperation, string> = {
  CONTEXT: "/api/native/v1/context",
  REFERENCE_PACK: "/api/native/v1/reference-pack",
  SYNC: "/api/native/v1/sync",
  CONFLICTS: "/api/native/v1/conflicts",
  LOGOUT: "/api/native-auth/logout"
};

function randomBase64Url(bytes: number) {
  const value = crypto.getRandomValues(new Uint8Array(bytes)); let binary = "";
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function sha256Base64Url(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function sha256Hex(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function browserProofMessage(input: { requestId: string; challenge: string; state: string; publicDeviceId: string; publicKeyHash: string }) {
  return ["native-auth-browser-v1", input.requestId, input.challenge, input.state, input.publicDeviceId, input.publicKeyHash].join("\n");
}

export function exchangeProofMessage(input: { requestId: string; codeHash: string; verifierHash: string; nonce: string; publicDeviceId: string }) {
  return ["native-auth-exchange-v1", input.requestId, input.codeHash, input.verifierHash, input.nonce, input.publicDeviceId].join("\n");
}

export function nativeRequestProofMessage(input: { method: string; path: string; timestamp: string; nonce: string; bodyHash: string; publicDeviceId: string; keyVersion: number }) {
  return ["offline-sync-request-v1", input.method, input.path, input.timestamp, input.nonce, input.bodyHash, input.publicDeviceId, String(input.keyVersion), "1"].join("\n");
}

export function versionAtLeast(current: string, minimum: string) {
  const parts = (value: string) => {
    const match = value.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) throw new Error("Version contract is invalid.");
    return match.slice(1).map(Number);
  };
  const left = parts(current); const right = parts(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

export async function startNativeAuthorization(vault: VaultSession, deviceLabel: string) {
  const profile = await appProfile();
  if (!profile.origin || !profile.remoteConfigured) throw new Error("No governed remote server profile is configured in this build.");
  const verifier = randomBase64Url(64); const state = randomBase64Url(32); const nonce = randomBase64Url(32);
  const publicDeviceId = await vault.deviceId(); const publicSigningKey = await vault.publicSigningJwk();
  const platform = /Android/i.test(navigator.userAgent) ? "ANDROID" : /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "IOS" : "WINDOWS";
  const response = await nativeRequest("AUTH_REQUEST", JSON.stringify({ appId: "com.nalandaps.erp", appVersion: APP_VERSION, redirectUri: "nalandaps-erp://auth/callback", platform, deviceLabel, publicDeviceId, state, nonce, pkceChallenge: await sha256Base64Url(verifier), publicSigningKey }), { "x-offline-device-id": publicDeviceId });
  const payload = JSON.parse(response.body) as { requestId?: string; challenge?: string; authorizePath?: string; code?: string };
  if (response.status !== 201 || !payload.requestId || !payload.challenge || !payload.authorizePath) throw new Error(payload.code ?? "Authorization request was refused.");
  const publicKeyHash = await sha256Hex(JSON.stringify({ crv: publicSigningKey.crv, kty: publicSigningKey.kty, x: publicSigningKey.x }));
  const proof = await vault.sign(browserProofMessage({ requestId: payload.requestId, challenge: payload.challenge, state, publicDeviceId, publicKeyHash }));
  await vault.setSecureJson(PENDING_KEY, { requestId: payload.requestId, state, nonce, verifier, publicDeviceId, createdAt: new Date().toISOString() } satisfies PendingAuthorization);
  const separator = payload.authorizePath.includes("?") ? "&" : "?";
  await openSystemAuthorization(`${profile.origin}${payload.authorizePath}${separator}proof=${encodeURIComponent(proof)}`);
}

export async function exchangeNativeCallback(vault: VaultSession, rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "nalandaps-erp:" || url.hostname !== "auth" || url.pathname !== "/callback") throw new Error("Native callback URL is invalid.");
  const pending = await vault.getSecureJson<PendingAuthorization>(PENDING_KEY);
  if (!pending || Date.now() - new Date(pending.createdAt).getTime() > 10 * 60 * 1000) throw new Error("Authorization request has expired.");
  const code = url.searchParams.get("code") ?? ""; const state = url.searchParams.get("state") ?? ""; const requestId = url.searchParams.get("request") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(code) || state !== pending.state || requestId !== pending.requestId) throw new Error("Authorization callback did not match this app request.");
  const proof = await vault.sign(exchangeProofMessage({ requestId, codeHash: await sha256Hex(code), verifierHash: await sha256Hex(pending.verifier), nonce: pending.nonce, publicDeviceId: pending.publicDeviceId }));
  const response = await nativeRequest("AUTH_EXCHANGE", JSON.stringify({ code, verifier: pending.verifier, requestId, nonce: pending.nonce, publicDeviceId: pending.publicDeviceId, proof }), { "x-offline-device-id": pending.publicDeviceId });
  const payload = JSON.parse(response.body) as NativeTokens & { code?: string };
  if (response.status !== 200 || !payload.accessToken || !payload.refreshToken) throw new Error(payload.code ?? "Authorization exchange was refused.");
  await vault.setRefreshToken(payload.refreshToken);
  await vault.setSecureJson(SESSION_META_KEY, { sessionId: payload.sessionId, tokenVersion: payload.tokenVersion, deviceKeyVersion: payload.deviceKeyVersion, publicDeviceId: pending.publicDeviceId });
  await vault.removeSecureJson(PENDING_KEY);
  return payload;
}

export async function refreshNativeTokens(vault: VaultSession) {
  const refreshToken = await vault.refreshToken();
  const meta = await vault.getSecureJson<{ sessionId: string; tokenVersion: number; deviceKeyVersion: number; publicDeviceId: string }>(SESSION_META_KEY);
  if (!refreshToken || !meta) throw new Error("No refreshable native session is available.");
  const timestamp = String(Date.now()); const proofNonce = randomBase64Url(24);
  const canonicalProof = await vault.sign(["native-refresh-v1", meta.sessionId, timestamp, proofNonce, await sha256Hex(refreshToken), meta.publicDeviceId, String(meta.tokenVersion)].join("\n"));
  const response = await nativeRequest("AUTH_REFRESH", JSON.stringify({ sessionId: meta.sessionId, refreshToken, publicDeviceId: meta.publicDeviceId, timestamp, proofNonce, proof: canonicalProof }), { "x-offline-device-id": meta.publicDeviceId });
  const payload = JSON.parse(response.body) as NativeTokens & { code?: string };
  if (response.status !== 200 || !payload.refreshToken) throw new Error(payload.code ?? "Native session refresh was refused.");
  await vault.setRefreshToken(payload.refreshToken);
  await vault.setSecureJson(SESSION_META_KEY, { sessionId: payload.sessionId, tokenVersion: payload.tokenVersion, deviceKeyVersion: payload.deviceKeyVersion, publicDeviceId: meta.publicDeviceId });
  return payload;
}

export async function nativeSessionRequest(vault: VaultSession, tokens: NativeTokens, operation: NativeDataOperation, bodyValue?: unknown) {
  if (!tokens.scopes.length) throw new Error("Native session has no permitted scope.");
  const path = NATIVE_PATHS[operation];
  const method = ["CONTEXT", "REFERENCE_PACK", "CONFLICTS"].includes(operation) ? "GET" : "POST";
  const body = bodyValue === undefined ? "" : JSON.stringify(bodyValue);
  const bodyHash = await sha256Hex(body);
  const timestamp = String(Date.now()); const nonce = randomBase64Url(24);
  const publicDeviceId = await vault.deviceId();
  const signature = await vault.sign(nativeRequestProofMessage({ method, path, timestamp, nonce, bodyHash, publicDeviceId, keyVersion: tokens.deviceKeyVersion }));
  return nativeRequest(operation, body || null, {
    authorization: `Bearer ${tokens.accessToken}`,
    "x-native-session": tokens.sessionId,
    "x-offline-device-id": publicDeviceId,
    "x-offline-timestamp": timestamp,
    "x-offline-nonce": nonce,
    "x-offline-body-sha256": bodyHash,
    "x-offline-key-version": String(tokens.deviceKeyVersion),
    "x-offline-sync-schema": "1",
    "x-offline-signature": signature
  });
}

export async function listenForNativeAuthorization(vault: VaultSession, onTokens: (tokens: NativeTokens) => void, onError: (message: string) => void) {
  let inFlight: string | null = null;
  const handleUrls = async (urls: string[] | null) => {
    if (!urls) return;
    const target = urls.find((url) => url.startsWith("nalandaps-erp://auth/callback"));
    if (!target || inFlight === target || !(await vault.getSecureJson<PendingAuthorization>(PENDING_KEY))) return;
    inFlight = target;
    try { onTokens(await exchangeNativeCallback(vault, target)); }
    catch (error) { onError(error instanceof Error ? error.message : "Authorization callback failed."); }
    finally { inFlight = null; }
  };
  const unlisten = await onOpenUrl((urls) => {
    void handleUrls(urls);
  });
  await handleUrls(await getCurrent());
  return unlisten;
}
