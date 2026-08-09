import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { securitySecret } from "@/lib/security-secrets";

export const GATE_PASS_TTL_MINUTES = 30;
const TOKEN_VERSION = 1;

export type GatePassMaterial = {
  token: string;
  tokenHash: string;
  manualCode: string;
  manualCodeHash: string;
  manualCodeLastTwo: string;
  expiresAt: Date;
};

export function createGatePassMaterial(now = new Date(), ttlMinutes = GATE_PASS_TTL_MINUTES): GatePassMaterial {
  if (!Number.isInteger(ttlMinutes) || ttlMinutes < 5 || ttlMinutes > 60) throw new Error("Gate-pass expiry must be between 5 and 60 minutes.");
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
  const payload = Buffer.from(JSON.stringify({ v: TOKEN_VERSION, n: randomBytes(24).toString("base64url"), exp: Math.floor(expiresAt.getTime() / 1000) })).toString("base64url");
  const signature = sign(payload);
  const signedValue = `${payload}.${signature}`;
  const manualCode = randomBytes(5).toString("hex").toUpperCase().slice(0, 8);
  return { token: signedValue, tokenHash: hashGatePassValue(signedValue), manualCode, manualCodeHash: hashGatePassValue(manualCode), manualCodeLastTwo: manualCode.slice(-2), expiresAt };
}

export function verifySignedGatePassToken(token: unknown, now = new Date()) {
  const value = bounded(String(token ?? "").trim(), 512, "Gate-pass token");
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) throw new Error("Gate pass is invalid or tampered.");
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Gate pass is invalid or tampered.");
  let decoded: { v?: unknown; n?: unknown; exp?: unknown };
  try { decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { throw new Error("Gate pass is invalid or tampered."); }
  if (decoded.v !== TOKEN_VERSION || !/^[A-Za-z0-9_-]{32}$/.test(String(decoded.n ?? "")) || !Number.isInteger(decoded.exp)) throw new Error("Gate pass is invalid or tampered.");
  const expiresAt = new Date(Number(decoded.exp) * 1000);
  if (expiresAt <= now) throw new Error("Gate pass has expired.");
  return { tokenHash: hashGatePassValue(value), expiresAt };
}

export function manualGatePassCodeHash(value: unknown) {
  const code = bounded(String(value ?? "").trim().toUpperCase(), 16, "Manual gate-pass code");
  if (!/^[A-F0-9]{8}$/.test(code)) throw new Error("Manual gate-pass code is invalid.");
  return hashGatePassValue(code);
}

export function gateApprovalSnapshotHash(input: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function hashGatePassValue(value: string) {
  return createHash("sha256").update(`NALANDA_SAFE_EXIT_V1|${value}`).digest("hex");
}

function sign(payload: string) {
  return createHmac("sha256", securitySecret("SAFE_EXIT_GATE_PASS_SECRET")).update(`NALANDA_SAFE_EXIT_V1|${payload}`).digest("base64url");
}

function bounded(value: string, max: number, label: string) {
  if (!value || value.length > max) throw new Error(`${label} is required and bounded.`);
  return value;
}
