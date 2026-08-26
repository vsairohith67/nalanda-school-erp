import { createHash, randomBytes } from "node:crypto";
import { Prisma, type OfflineSyncDevice } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import type { AuthUser } from "@/lib/auth";
import { offlineSyncRoleAllowed, OFFLINE_SYNC_SCHEMA_VERSION } from "@/lib/offline-sync/feature-flag";
import { canonicalOfflineRequestTarget } from "@/lib/offline-sync/request-target";

type DbClient = typeof prisma | Prisma.TransactionClient;
export const OFFLINE_DEVICE_STATUSES = ["PENDING_APPROVAL", "ACTIVE", "REVOKED", "RETIRED"] as const;
export const OFFLINE_CHALLENGE_PURPOSES = ["REGISTER", "ROTATE"] as const;
const PROOF_WINDOW_MS = 5 * 60 * 1000;
const NONCE_RETENTION_MS = 15 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export class OfflineTrustError extends Error {
  constructor(public code: string, public status = 403) { super(code); }
}

export function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function fromBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new OfflineTrustError("SIGNATURE_INVALID");
  return Uint8Array.from(Buffer.from(value, "base64url"));
}

export function normalizePublicJwk(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OfflineTrustError("PUBLIC_KEY_INVALID", 400);
  const jwk = value as JsonWebKey;
  if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y || jwk.d || jwk.key_ops?.some((op) => op !== "verify")) {
    throw new OfflineTrustError("PUBLIC_KEY_INVALID", 400);
  }
  return { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true, key_ops: ["verify"] } satisfies JsonWebKey;
}

export function normalizeNativePublicJwk(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OfflineTrustError("PUBLIC_KEY_INVALID", 400);
  const jwk = value as JsonWebKey;
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x || jwk.d || jwk.key_ops?.some((op) => op !== "verify")) {
    throw new OfflineTrustError("PUBLIC_KEY_INVALID", 400);
  }
  return { kty: "OKP", crv: "Ed25519", x: jwk.x, ext: true, key_ops: ["verify"] } satisfies JsonWebKey;
}

export function publicJwkHash(jwk: JsonWebKey) {
  return sha256Hex(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }));
}

async function importVerifyKey(serialized: string) {
  const jwk = normalizePublicJwk(JSON.parse(serialized));
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
}

export async function verifyEcdsaSignature(serializedJwk: string, message: string, signature: string) {
  try {
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      await importVerifyKey(serializedJwk),
      fromBase64Url(signature),
      new TextEncoder().encode(message)
    );
  } catch {
    return false;
  }
}

export async function verifyEd25519Signature(serializedJwk: string, message: string, signature: string) {
  try {
    const jwk = normalizeNativePublicJwk(JSON.parse(serializedJwk));
    const key = await crypto.subtle.importKey("jwk", jwk, "Ed25519", false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, fromBase64Url(signature), new TextEncoder().encode(message));
  } catch {
    return false;
  }
}

export async function verifyDeviceSignature(device: Pick<OfflineSyncDevice, "keyAlgorithm" | "publicSigningKey">, message: string, signature: string) {
  if (device.keyAlgorithm === "ED25519") return verifyEd25519Signature(device.publicSigningKey, message, signature);
  if (device.keyAlgorithm === "ECDSA_P256_SHA256") return verifyEcdsaSignature(device.publicSigningKey, message, signature);
  return false;
}

export async function createDeviceChallenge(input: {
  userId: string;
  purpose: "REGISTER" | "ROTATE";
  publicDeviceId: string;
  keyVersion: number;
  publicKeyJwk: unknown;
}) {
  if (!/^[0-9a-f-]{36}$/i.test(input.publicDeviceId)) throw new OfflineTrustError("DEVICE_ID_INVALID", 400);
  if (!Number.isInteger(input.keyVersion) || input.keyVersion < 1 || input.keyVersion > 1000) throw new OfflineTrustError("KEY_VERSION_INVALID", 400);
  const jwk = normalizePublicJwk(input.publicKeyJwk);
  const publicKeyHash = publicJwkHash(jwk);
  const challenge = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  await prisma.$transaction(async (tx) => {
    await tx.offlineSyncChallenge.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    await tx.offlineSyncChallenge.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        publicDeviceId: input.publicDeviceId,
        deviceKeyVersion: input.keyVersion,
        publicKeyHash,
        challengeHash: sha256Hex(challenge),
        expiresAt
      }
    });
  });
  return { challenge, expiresAt: expiresAt.toISOString(), publicKeyHash };
}

export function challengeMessage(input: { challenge: string; publicDeviceId: string; keyVersion: number; publicKeyHash: string }) {
  return ["offline-sync-challenge-v1", input.challenge, input.publicDeviceId, String(input.keyVersion), input.publicKeyHash].join("\n");
}

export async function consumeChallenge(tx: Prisma.TransactionClient, input: {
  userId: string;
  purpose: "REGISTER" | "ROTATE";
  publicDeviceId: string;
  keyVersion: number;
  publicKeyJwk: unknown;
  challenge: string;
  signature: string;
}) {
  const jwk = normalizePublicJwk(input.publicKeyJwk);
  const publicKeyHash = publicJwkHash(jwk);
  const now = new Date();
  await tx.offlineSyncChallenge.deleteMany({ where: { expiresAt: { lte: now } } });
  const stored = await tx.offlineSyncChallenge.findUnique({ where: { challengeHash: sha256Hex(input.challenge) } });
  if (!stored || stored.usedAt || stored.expiresAt <= now || stored.userId !== input.userId || stored.purpose !== input.purpose || stored.publicDeviceId !== input.publicDeviceId || stored.deviceKeyVersion !== input.keyVersion || stored.publicKeyHash !== publicKeyHash) {
    throw new OfflineTrustError("CHALLENGE_INVALID_OR_EXPIRED");
  }
  const ok = await verifyEcdsaSignature(JSON.stringify(jwk), challengeMessage({ challenge: input.challenge, publicDeviceId: input.publicDeviceId, keyVersion: input.keyVersion, publicKeyHash }), input.signature);
  if (!ok) throw new OfflineTrustError("CHALLENGE_PROOF_INVALID");
  const consumed = await tx.offlineSyncChallenge.updateMany({ where: { id: stored.id, usedAt: null }, data: { usedAt: new Date() } });
  if (consumed.count !== 1) throw new OfflineTrustError("CHALLENGE_REPLAYED");
  return { jwk, publicKeyHash };
}

export function requestProofMessage(input: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  bodyHash: string;
  publicDeviceId: string;
  keyVersion: number;
  schemaVersion: number;
}) {
  return ["offline-sync-request-v1", input.method.toUpperCase(), input.path, input.timestamp, input.nonce, input.bodyHash, input.publicDeviceId, String(input.keyVersion), String(input.schemaVersion)].join("\n");
}

export async function verifyOfflineRequest(input: {
  request: Request;
  rawBody: string;
  user: AuthUser;
  sessionId?: string | null;
  expectedDeviceId?: string;
}) {
  const header = (name: string) => String(input.request.headers.get(name) ?? "").trim();
  const publicDeviceId = header("x-offline-device-id");
  const timestamp = header("x-offline-timestamp");
  const nonce = header("x-offline-nonce");
  const bodyHash = header("x-offline-body-sha256").toLowerCase();
  const signature = header("x-offline-signature");
  const keyVersion = Number(header("x-offline-key-version"));
  const schemaVersion = Number(header("x-offline-sync-schema"));
  if (!publicDeviceId || !timestamp || !/^[A-Za-z0-9_-]{16,160}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(bodyHash) || !signature) throw new OfflineTrustError("DEVICE_PROOF_REQUIRED", 401);
  if (schemaVersion !== OFFLINE_SYNC_SCHEMA_VERSION) throw new OfflineTrustError("UNSUPPORTED_SYNC_SCHEMA", 409);
  if (!Number.isInteger(keyVersion) || keyVersion < 1) throw new OfflineTrustError("KEY_VERSION_INVALID", 401);
  const timestampMs = Number(timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > PROOF_WINDOW_MS) throw new OfflineTrustError("DEVICE_PROOF_EXPIRED", 401);
  const calculatedBodyHash = sha256Hex(input.rawBody);
  if (calculatedBodyHash !== bodyHash) throw new OfflineTrustError("BODY_HASH_MISMATCH", 400);
  if (!offlineSyncRoleAllowed(input.user.role)) throw new OfflineTrustError("OFFLINE_ROLE_NOT_ALLOWED");

  return prisma.$transaction(async (tx) => {
    const device = await tx.offlineSyncDevice.findUnique({ where: { publicDeviceId } });
    if (!device || device.userId !== input.user.id) throw new OfflineTrustError("DEVICE_NOT_REGISTERED");
    if (input.expectedDeviceId && device.id !== input.expectedDeviceId) throw new OfflineTrustError("SESSION_DEVICE_MISMATCH", 401);
    if (device.status !== "ACTIVE") throw new OfflineTrustError(device.status === "REVOKED" ? "DEVICE_REVOKED" : "DEVICE_NOT_ACTIVE");
    if (device.keyVersion !== keyVersion) throw new OfflineTrustError("DEVICE_KEY_VERSION_STALE");
    const permission = await evaluateEffectivePermission(tx, {
      userId: input.user.id,
      sessionId: input.sessionId,
      roleAssignmentId: input.user.roleAssignmentId,
      permission: "USE_OFFLINE_SYNC"
    });
    if (!permission.allowed) throw new OfflineTrustError("OFFLINE_PERMISSION_DENIED");
    const message = requestProofMessage({ method: input.request.method, path: canonicalOfflineRequestTarget(new URL(input.request.url)), timestamp, nonce, bodyHash, publicDeviceId, keyVersion, schemaVersion });
    if (!(await verifyDeviceSignature(device, message, signature))) throw new OfflineTrustError("DEVICE_PROOF_INVALID", 401);
    try {
      await tx.offlineSyncNonce.create({ data: { deviceId: device.id, nonceHash: sha256Hex(nonce), expiresAt: new Date(Date.now() + NONCE_RETENTION_MS) } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new OfflineTrustError("NONCE_REPLAYED", 409);
      throw error;
    }
    await tx.offlineSyncDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    await tx.offlineSyncNonce.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - NONCE_RETENTION_MS) } } });
    return device;
  });
}

export async function recordOfflineEvent(client: DbClient, input: {
  eventType: string;
  actorUserId?: string | null;
  deviceId?: string | null;
  mutationId?: string | null;
  safeMetadata?: Record<string, string | number | boolean | null>;
}) {
  return client.offlineSyncEvent.create({
    data: {
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      deviceId: input.deviceId ?? null,
      mutationId: input.mutationId ?? null,
      safeMetadataJson: input.safeMetadata ? JSON.stringify(input.safeMetadata) : null
    }
  });
}

export function safeDevice(device: OfflineSyncDevice) {
  return {
    id: device.id,
    publicDeviceId: device.publicDeviceId,
    label: device.label,
    platform: device.platform,
    keyVersion: device.keyVersion,
    status: device.status,
    requestedAt: device.requestedAt,
    approvedAt: device.approvedAt,
    lastSeenAt: device.lastSeenAt,
    revokedAt: device.revokedAt,
    revocationReason: device.revocationReason
  };
}

export function offlineTrustResponse(error: unknown) {
  const trust = error instanceof OfflineTrustError ? error : null;
  return Response.json(
    { error: trust ? "Offline device verification failed." : "Unable to process offline device request.", code: trust?.code ?? "OFFLINE_DEVICE_REQUEST_FAILED" },
    { status: trust?.status ?? 400, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
