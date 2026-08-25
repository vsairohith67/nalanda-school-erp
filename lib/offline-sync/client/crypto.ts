"use client";

import { deleteLocal, readLocal, writeLocal, wipeOfflineDatabase, type EncryptedLocalRecord, type StoreName } from "@/lib/offline-sync/client/database";

const PBKDF2_ITERATIONS = 310_000;
const PIN_WARNING_ATTEMPTS = 5;
const PIN_MAX_ATTEMPTS = 10;
type VaultRecord = { id: "vault"; salt: string; wrappedKey: string; wrapIv: string; verifier: string; iterations: number; version: 1; attempts: number; delayedUntil: number; updatedAt: number };
let unlockedKey: CryptoKey | null = null;
let activeScope: { userId: string; publicDeviceId: string } | null = null;

function bytesToBase64(value: ArrayBuffer | Uint8Array) { return btoa(String.fromCharCode(...new Uint8Array(value))); }
function base64ToBytes(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)); }
function random(size: number) { const value = new Uint8Array(size); crypto.getRandomValues(value); return value; }

async function pinMaterial(pin: string, salt: Uint8Array, iterations: number) {
  if (!/^\d{6,12}$/.test(pin)) throw new Error("Offline PIN must contain 6 to 12 digits.");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, base, 512));
  const wrappingKey = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
  const verifier = bytesToBase64(await crypto.subtle.digest("SHA-256", new Uint8Array([...bits.slice(32), ...new TextEncoder().encode("nps-offline-pin-v1")])))
  bits.fill(0);
  return { wrappingKey, verifier };
}

export async function setupOfflineVault(pin: string, scope: { userId: string; publicDeviceId: string }) {
  if (await readLocal<VaultRecord>("vault", "vault")) throw new Error("Offline PIN is already configured on this browser.");
  const salt = random(16); const wrapIv = random(12);
  const material = await pinMaterial(pin, salt, PBKDF2_ITERATIONS);
  const rawCek = random(32);
  const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv: wrapIv, additionalData: new TextEncoder().encode("nps-offline-cek-v1") }, material.wrappingKey, rawCek);
  unlockedKey = await crypto.subtle.importKey("raw", rawCek, "AES-GCM", false, ["encrypt", "decrypt"]);
  rawCek.fill(0); activeScope = scope;
  await writeLocal<VaultRecord>("vault", { id: "vault", salt: bytesToBase64(salt), wrappedKey: bytesToBase64(wrapped), wrapIv: bytesToBase64(wrapIv), verifier: material.verifier, iterations: PBKDF2_ITERATIONS, version: 1, attempts: 0, delayedUntil: 0, updatedAt: Date.now() });
}

export async function unlockOfflineVault(pin: string, scope: { userId: string; publicDeviceId: string }) {
  const vault = await readLocal<VaultRecord>("vault", "vault");
  if (!vault) throw new Error("Offline PIN has not been configured.");
  if (Date.now() < vault.delayedUntil) throw new Error(`Try again after ${new Date(vault.delayedUntil).toLocaleTimeString()}.`);
  const material = await pinMaterial(pin, base64ToBytes(vault.salt), vault.iterations);
  if (material.verifier !== vault.verifier) {
    const attempts = vault.attempts + 1;
    const delay = attempts >= PIN_WARNING_ATTEMPTS ? Math.min(5 * 60_000, 2 ** (attempts - PIN_WARNING_ATTEMPTS) * 2_000) : 0;
    await writeLocal<VaultRecord>("vault", { ...vault, attempts, delayedUntil: Date.now() + delay, updatedAt: Date.now() });
    throw new Error(attempts >= PIN_MAX_ATTEMPTS ? "Too many attempts. Reset this browser's offline data or wait before trying again." : attempts >= PIN_WARNING_ATTEMPTS ? "Incorrect PIN. Further attempts are delayed." : "Incorrect offline PIN.");
  }
  try {
    const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(vault.wrapIv), additionalData: new TextEncoder().encode("nps-offline-cek-v1") }, material.wrappingKey, base64ToBytes(vault.wrappedKey));
    unlockedKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
    new Uint8Array(raw).fill(0); activeScope = scope;
    await writeLocal<VaultRecord>("vault", { ...vault, attempts: 0, delayedUntil: 0, updatedAt: Date.now() });
  } catch { throw new Error("Offline vault could not be unlocked. Reset local offline data if this device's keys changed."); }
}

export function lockOfflineVault() { unlockedKey = null; activeScope = null; }
export function offlineVaultUnlocked() { return Boolean(unlockedKey && activeScope); }
export async function offlineVaultConfigured() { return Boolean(await readLocal<VaultRecord>("vault", "vault")); }

function aad(recordType: string, id: string) {
  if (!activeScope) throw new Error("Unlock the offline vault first.");
  return JSON.stringify({ v: 1, userId: activeScope.userId, publicDeviceId: activeScope.publicDeviceId, recordType, id });
}

export async function encryptLocalRecord(store: Exclude<StoreName, "vault" | "device" | "coordination">, id: string, value: unknown, metadata: { status?: string; operationType?: string; expiresAt?: number } = {}) {
  if (!unlockedKey) throw new Error("Unlock the offline vault first.");
  const iv = random(12); const associated = aad(store, id);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(associated) }, unlockedKey, new TextEncoder().encode(JSON.stringify(value)));
  const record: EncryptedLocalRecord = { id, cipherText: bytesToBase64(cipher), iv: bytesToBase64(iv), aad: associated, encryptionVersion: 1, updatedAt: Date.now(), ...metadata };
  await writeLocal(store, record); return record;
}

export async function decryptLocalRecord<T>(store: Exclude<StoreName, "vault" | "device" | "coordination">, record: EncryptedLocalRecord): Promise<T> {
  if (!unlockedKey) throw new Error("Unlock the offline vault first.");
  if (record.aad !== aad(store, record.id)) throw new Error("OFFLINE_RECORD_SCOPE_MISMATCH");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(record.iv), additionalData: new TextEncoder().encode(record.aad) }, unlockedKey, base64ToBytes(record.cipherText));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export async function purgeEncryptedRecord(store: "drafts" | "outbox" | "references" | "accepted", id: string) { await deleteLocal(store, id); }
export async function resetOfflineVault() { lockOfflineVault(); await wipeOfflineDatabase(); }
export const offlinePinPolicy = { iterations: PBKDF2_ITERATIONS, warningAttempts: PIN_WARNING_ATTEMPTS, maximumAttemptsBeforeResetGuidance: PIN_MAX_ATTEMPTS } as const;
