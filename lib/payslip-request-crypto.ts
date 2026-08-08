import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

export type AuthenticatedEnvelope = {
  keyVersion: string;
  nonce: string;
  ciphertext: string;
  authTag: string;
};

export class PayslipSecretError extends Error {
  constructor(message = "Payslip document secret management is unavailable") {
    super(message);
  }
}

export function generateDocumentPassword() {
  return randomBytes(24).toString("base64url");
}

export function generateOwnerPassword() {
  return randomBytes(32).toString("base64url");
}

export function generateVerificationReference() {
  return `PSV-${randomBytes(18).toString("base64url")}`;
}

export function encryptPayslipSecret(plaintext: Buffer | string, binding: string, purpose: "OPENING_PASSWORD" | "SOURCE_PDF"): AuthenticatedEnvelope {
  const ring = keyring();
  const key = derivedKey(ring.keys.get(ring.active)!, purpose);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad(binding, purpose));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    keyVersion: ring.active,
    nonce: nonce.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url")
  };
}

export function decryptPayslipSecret(envelope: AuthenticatedEnvelope, binding: string, purpose: "OPENING_PASSWORD" | "SOURCE_PDF") {
  const ring = keyring();
  const master = ring.keys.get(envelope.keyVersion);
  if (!master) throw new PayslipSecretError("The required payslip encryption key version is unavailable");
  try {
    const decipher = createDecipheriv("aes-256-gcm", derivedKey(master, purpose), decode(envelope.nonce, 12, "nonce"));
    decipher.setAAD(aad(binding, purpose));
    decipher.setAuthTag(decode(envelope.authTag, 16, "authentication tag"));
    return Buffer.concat([decipher.update(decode(envelope.ciphertext, null, "ciphertext")), decipher.final()]);
  } catch {
    throw new PayslipSecretError("The payslip encrypted envelope failed authentication");
  }
}

export function signPayslipDownload(documentKey: string, sessionId: string, now = Date.now()) {
  const expiresAt = now + 2 * 60 * 1000;
  const signature = downloadSignature(documentKey, sessionId, expiresAt);
  return { authorization: `${expiresAt}.${signature}`, expiresAt: new Date(expiresAt).toISOString() };
}

export function verifyPayslipDownload(authorization: string, documentKey: string, sessionId: string, now = Date.now()) {
  const match = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(authorization);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt < now || expiresAt > now + 2 * 60 * 1000 + 5_000) return false;
  const expected = downloadSignature(documentKey, sessionId, expiresAt);
  return timingSafeEqual(Buffer.from(match[2]), Buffer.from(expected));
}

function downloadSignature(documentKey: string, sessionId: string, expiresAt: number) {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) throw new PayslipSecretError("Session-bound payslip delivery is unavailable");
  return createHmac("sha256", secret).update(`PAYSLIPREQ1|DOWNLOAD|${documentKey}|${sessionId}|${expiresAt}`).digest("base64url");
}

function keyring() {
  const raw = process.env.PAYSLIP_REQUEST_KEYRING_JSON?.trim();
  if (!raw) throw new PayslipSecretError();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new PayslipSecretError(); }
  if (!parsed || typeof parsed !== "object") throw new PayslipSecretError();
  const record = parsed as { active?: unknown; keys?: unknown };
  if (typeof record.active !== "string" || !/^[A-Za-z0-9_.-]{1,32}$/.test(record.active) || !record.keys || typeof record.keys !== "object") {
    throw new PayslipSecretError();
  }
  const keys = new Map<string, Buffer>();
  for (const [version, value] of Object.entries(record.keys as Record<string, unknown>)) {
    if (!/^[A-Za-z0-9_.-]{1,32}$/.test(version) || typeof value !== "string") throw new PayslipSecretError();
    const decoded = Buffer.from(value, "base64");
    if (decoded.length !== 32 || decoded.toString("base64") !== value) throw new PayslipSecretError();
    keys.set(version, decoded);
  }
  if (!keys.has(record.active)) throw new PayslipSecretError();
  return { active: record.active, keys };
}

function derivedKey(master: Buffer, purpose: string) {
  return Buffer.from(hkdfSync("sha256", master, Buffer.from("NALANDA-HR-PAYSLIP-REQ-1"), Buffer.from(purpose), 32));
}

function aad(binding: string, purpose: string) {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(binding)) throw new PayslipSecretError("The payslip secret binding is invalid");
  return Buffer.from(`HR-PAYSLIP-REQ-1|${purpose}|${binding}`, "utf8");
}

function decode(value: string, expectedBytes: number | null, label: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new PayslipSecretError(`The payslip ${label} is invalid`);
  const decoded = Buffer.from(value, "base64url");
  if (expectedBytes !== null && decoded.length !== expectedBytes) throw new PayslipSecretError(`The payslip ${label} is invalid`);
  return decoded;
}
