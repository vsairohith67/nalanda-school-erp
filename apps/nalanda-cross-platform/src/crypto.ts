import type { CachedEnvelope } from "./native";

function base64(value: Uint8Array) {
  let binary = "";
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function sha256Hex(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function encryptRecord(input: { recordId: string; recordType: string; value: unknown; key: Uint8Array }): Promise<CachedEnvelope> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const aad = `nalanda-native-cache-v1\n${input.recordType}\n${input.recordId}`;
  const cryptoKey = await crypto.subtle.importKey("raw", new Uint8Array(input.key).buffer, "AES-GCM", false, ["encrypt"]);
  const plaintext = new TextEncoder().encode(JSON.stringify(input.value));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: new TextEncoder().encode(aad), tagLength: 128 }, cryptoKey, plaintext);
  return { recordId: input.recordId, recordType: input.recordType, nonce: base64(nonce), ciphertext: base64(new Uint8Array(ciphertext)), aadHash: await sha256Hex(aad), updatedAt: new Date().toISOString() };
}

export async function decryptRecord<T>(input: { envelope: CachedEnvelope; key: Uint8Array }): Promise<T> {
  const aad = `nalanda-native-cache-v1\n${input.envelope.recordType}\n${input.envelope.recordId}`;
  if (await sha256Hex(aad) !== input.envelope.aadHash) throw new Error("Encrypted record metadata is invalid.");
  const cryptoKey = await crypto.subtle.importKey("raw", new Uint8Array(input.key).buffer, "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(input.envelope.nonce), additionalData: new TextEncoder().encode(aad), tagLength: 128 }, cryptoKey, fromBase64(input.envelope.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
