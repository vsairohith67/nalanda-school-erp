import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BIOMETRIC_SCHEMA_VERSION } from "@/lib/biometric-attendance/feature-flag";
import { sha256Hex } from "@/lib/biometric-attendance/contracts";

const PROOF_WINDOW_MS = 5 * 60 * 1000;
const NONCE_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_BATCHES_PER_MINUTE = 60;

export class BiometricTrustError extends Error {
  constructor(public code: string, public status = 403) { super(code); }
}

function canonicalTarget(request: Request) { const url = new URL(request.url); return `${url.pathname}${url.search}`; }
function fromBase64Url(value: string) { if (!/^[A-Za-z0-9_-]{32,512}$/.test(value)) throw new BiometricTrustError("BIOMETRIC_SIGNATURE_INVALID", 401); return Uint8Array.from(Buffer.from(value, "base64url")); }

export function biometricRequestMessage(input: { method: string; path: string; timestamp: string; nonce: string; bodyHash: string; publicBridgeId: string; keyVersion: number; schemaVersion: number }) {
  return ["nalanda-biometric-request-v1", input.method.toUpperCase(), input.path, input.timestamp, input.nonce, input.bodyHash, input.publicBridgeId, String(input.keyVersion), String(input.schemaVersion)].join("\n");
}

export async function verifyBridgeSignature(serializedJwk: string, algorithm: string, message: string, signature: string) {
  try {
    const jwk = JSON.parse(serializedJwk) as JsonWebKey;
    if (algorithm === "ED25519") {
      if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x || jwk.d) return false;
      const key = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: jwk.x, ext: true, key_ops: ["verify"] }, "Ed25519", false, ["verify"]);
      return crypto.subtle.verify("Ed25519", key, fromBase64Url(signature), new TextEncoder().encode(message));
    }
    if (algorithm === "ECDSA_P256_SHA256") {
      if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y || jwk.d) return false;
      const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true, key_ops: ["verify"] }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
      return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, fromBase64Url(signature), new TextEncoder().encode(message));
    }
    return false;
  } catch { return false; }
}

export async function verifyBiometricRequest(request: Request, rawBody: string) {
  const header = (name: string) => String(request.headers.get(name) ?? "").trim();
  const publicBridgeId = header("x-nalanda-biometric-bridge-id");
  const timestamp = header("x-nalanda-biometric-timestamp");
  const nonce = header("x-nalanda-biometric-nonce");
  const bodyHash = header("x-nalanda-biometric-body-sha256").toLowerCase();
  const signature = header("x-nalanda-biometric-signature");
  const keyVersion = Number(header("x-nalanda-biometric-key-version"));
  const schemaVersion = Number(header("x-nalanda-biometric-schema"));
  if (!/^[0-9a-f-]{36}$/i.test(publicBridgeId) || !/^[A-Za-z0-9_-]{16,160}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(bodyHash) || !signature) throw new BiometricTrustError("BIOMETRIC_BRIDGE_PROOF_REQUIRED", 401);
  if (schemaVersion !== BIOMETRIC_SCHEMA_VERSION) throw new BiometricTrustError("BIOMETRIC_SCHEMA_UNSUPPORTED", 409);
  if (!Number.isInteger(keyVersion) || keyVersion < 1) throw new BiometricTrustError("BIOMETRIC_KEY_VERSION_INVALID", 401);
  const timestampMs = Number(timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > PROOF_WINDOW_MS) throw new BiometricTrustError("BIOMETRIC_BRIDGE_PROOF_EXPIRED", 401);
  if (sha256Hex(rawBody) !== bodyHash) throw new BiometricTrustError("BIOMETRIC_BODY_HASH_MISMATCH", 400);
  const bridge = await prisma.biometricBridge.findUnique({ where: { publicBridgeId } });
  if (!bridge) throw new BiometricTrustError("BIOMETRIC_BRIDGE_NOT_REGISTERED");
  if (bridge.status !== "ACTIVE") throw new BiometricTrustError(bridge.status === "REVOKED" ? "BIOMETRIC_BRIDGE_REVOKED" : "BIOMETRIC_BRIDGE_NOT_ACTIVE");
  if (bridge.keyVersion !== keyVersion) throw new BiometricTrustError("BIOMETRIC_BRIDGE_KEY_STALE");
  const recent = await prisma.biometricIngestBatch.count({ where: { bridgeId: bridge.id, receivedAt: { gte: new Date(Date.now() - 60_000) } } });
  if (recent >= MAX_BATCHES_PER_MINUTE) throw new BiometricTrustError("BIOMETRIC_RATE_LIMITED", 429);
  const message = biometricRequestMessage({ method: request.method, path: canonicalTarget(request), timestamp, nonce, bodyHash, publicBridgeId, keyVersion, schemaVersion });
  if (!(await verifyBridgeSignature(bridge.publicSigningKey, bridge.keyAlgorithm, message, signature))) throw new BiometricTrustError("BIOMETRIC_BRIDGE_PROOF_INVALID", 401);
  return { bridge, nonceHash: sha256Hex(nonce), keyVersion, nonceExpiresAt: new Date(Date.now() + NONCE_RETENTION_MS) };
}

export async function recordBiometricNonce(tx: Prisma.TransactionClient, input: { bridgeId: string; nonceHash: string; expiresAt: Date }) {
  await tx.biometricReplayNonce.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - NONCE_RETENTION_MS) } } });
  try { await tx.biometricReplayNonce.create({ data: input }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new BiometricTrustError("BIOMETRIC_NONCE_REPLAYED", 409); throw error; }
}

export function biometricTrustResponse(error: unknown) {
  const known = error instanceof BiometricTrustError ? error : null;
  const code = known?.code ?? (error instanceof Error && /^BIOMETRIC_[A-Z0-9_:.-]+$/.test(error.message) ? error.message : "BIOMETRIC_INGEST_FAILED");
  return Response.json({ error: "Biometric attendance request was rejected.", code }, { status: known?.status ?? 400, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
