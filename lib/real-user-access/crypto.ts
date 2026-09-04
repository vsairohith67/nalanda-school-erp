import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { authHashSecret } from "@/lib/auth-security";

export type MfaSecretEnvelope = {
  version: 1;
  keyVersion: string;
  nonce: string;
  ciphertext: string;
  authTag: string;
};

export function generateBoundToken(bytes = 32) {
  if (!Number.isInteger(bytes) || bytes < 16 || bytes > 64) throw new Error("INVALID_TOKEN_ENTROPY");
  return randomBytes(bytes).toString("base64url");
}

export function hashBoundToken(input: { token: string; purpose: string; environment: string; subject: string }, env: NodeJS.ProcessEnv = process.env) {
  return authHashSecret(`${input.environment}:${input.subject}:${input.token}`, `real-user-access:${input.purpose}`, env);
}

export function boundTokenMatches(input: { token: string; purpose: string; environment: string; subject: string; expectedHash: string }, env: NodeJS.ProcessEnv = process.env) {
  try {
    const actual = Buffer.from(hashBoundToken(input, env), "hex");
    const expected = Buffer.from(input.expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function encryptMfaSecret(plaintext: string, aad: string, env: NodeJS.ProcessEnv = process.env): MfaSecretEnvelope {
  const keyring = mfaKeyring(env);
  const key = keyring.keys[keyring.active];
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { version: 1, keyVersion: keyring.active, nonce: nonce.toString("base64url"), ciphertext: ciphertext.toString("base64url"), authTag: cipher.getAuthTag().toString("base64url") };
}

export function decryptMfaSecret(envelopeValue: MfaSecretEnvelope | string, aad: string, env: NodeJS.ProcessEnv = process.env) {
  const envelope = typeof envelopeValue === "string" ? parseEnvelope(envelopeValue) : envelopeValue;
  const key = mfaKeyring(env).keys[envelope.keyVersion];
  if (!key) throw new Error("MFA_KEY_VERSION_UNAVAILABLE");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "base64url"));
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export function rotateMfaSecret(envelopeValue: MfaSecretEnvelope | string, aad: string, env: NodeJS.ProcessEnv = process.env) {
  const current = typeof envelopeValue === "string" ? parseEnvelope(envelopeValue) : envelopeValue;
  const keyring = mfaKeyring(env);
  if (current.keyVersion === keyring.active) return current;
  return encryptMfaSecret(decryptMfaSecret(current, aad, env), aad, env);
}

export function serializeMfaSecretEnvelope(envelope: MfaSecretEnvelope) { return JSON.stringify(envelope); }

function parseEnvelope(value: string): MfaSecretEnvelope {
  const parsed = JSON.parse(value) as Partial<MfaSecretEnvelope>;
  if (parsed.version !== 1 || typeof parsed.keyVersion !== "string" || typeof parsed.nonce !== "string" || typeof parsed.ciphertext !== "string" || typeof parsed.authTag !== "string") throw new Error("MFA_SECRET_ENVELOPE_INVALID");
  return parsed as MfaSecretEnvelope;
}

function mfaKeyring(env: NodeJS.ProcessEnv) {
  const raw = env.AUTH_MFA_KEYRING_JSON;
  if (!raw) throw new Error("AUTH_MFA_KEYRING_JSON is not configured");
  let parsed: { active?: unknown; keys?: unknown };
  try { parsed = JSON.parse(raw); } catch { throw new Error("AUTH_MFA_KEYRING_JSON is malformed"); }
  if (typeof parsed.active !== "string" || !/^[A-Z0-9_-]{1,32}$/.test(parsed.active) || !parsed.keys || typeof parsed.keys !== "object" || Array.isArray(parsed.keys)) throw new Error("AUTH_MFA_KEYRING_JSON is malformed");
  const keys: Record<string, Buffer> = {};
  for (const [version, encoded] of Object.entries(parsed.keys)) {
    if (!/^[A-Z0-9_-]{1,32}$/.test(version) || typeof encoded !== "string") throw new Error("AUTH_MFA_KEYRING_JSON is malformed");
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32) throw new Error("MFA encryption keys must be exactly 32 bytes");
    keys[version] = key;
  }
  if (!keys[parsed.active]) throw new Error("Active MFA encryption key is unavailable");
  return { active: parsed.active, keys };
}
