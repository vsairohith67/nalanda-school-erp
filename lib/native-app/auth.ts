import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authHashSecret, logAuthSecurityEvent } from "@/lib/auth-security";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { isRole } from "@/lib/permissions";
import type { AuthUser } from "@/lib/auth";
import {
  normalizeNativePublicJwk,
  publicJwkHash,
  sha256Hex,
  verifyDeviceSignature,
  verifyEd25519Signature
} from "@/lib/offline-sync/device-trust";
import { NATIVE_APP_ID, NATIVE_REDIRECT_URI, nativeAppEnabled } from "@/lib/native-app/feature-flag";

const REQUEST_TTL_MS = 5 * 60 * 1000;
const CODE_TTL_MS = 90 * 1000;
const ACCESS_TTL_MS = 10 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PROOF_WINDOW_MS = 5 * 60 * 1000;
export const NATIVE_SCOPES = ["offline:context", "offline:reference", "offline:sync", "offline:own-conflicts"] as const;
export type NativeScope = (typeof NATIVE_SCOPES)[number];

export class NativeAuthError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

function opaque(bytes = 32) { return randomBytes(bytes).toString("base64url"); }
function secretHash(value: string, purpose: string) { return authHashSecret(value, `native-app-v1:${purpose}`); }
function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function bounded(value: unknown, pattern: RegExp, code: string) {
  const text = String(value ?? "").trim();
  if (!pattern.test(text)) throw new NativeAuthError(code);
  return text;
}

function semverParts(value: string) {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new NativeAuthError("APP_VERSION_INVALID");
  return match.slice(1).map(Number);
}

export function appVersionSupported(appVersion: string, minimum = process.env.NALANDA_NATIVE_MINIMUM_APP_VERSION?.trim() || "0.1.0") {
  const current = semverParts(appVersion);
  const required = semverParts(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (current[index] !== required[index]) return current[index] > required[index];
  }
  return true;
}

export function validateNativeAuthRequest(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new NativeAuthError("REQUEST_INVALID");
  const row = value as Record<string, unknown>;
  const appId = bounded(row.appId, /^com\.nalandaps\.erp$/, "APP_ID_INVALID");
  const appVersion = bounded(row.appVersion, /^\d+\.\d+\.\d+$/, "APP_VERSION_INVALID");
  if (!appVersionSupported(appVersion)) throw new NativeAuthError("APP_VERSION_INCOMPATIBLE", 426);
  const redirectUri = bounded(row.redirectUri, /^nalandaps-erp:\/\/auth\/callback$/, "REDIRECT_URI_INVALID");
  const platform = bounded(row.platform, /^(WINDOWS|ANDROID|IOS)$/, "PLATFORM_INVALID");
  const deviceLabel = bounded(row.deviceLabel, /^[\p{L}\p{N} ._()-]{3,80}$/u, "DEVICE_LABEL_INVALID");
  const publicDeviceId = bounded(row.publicDeviceId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "DEVICE_ID_INVALID");
  const state = bounded(row.state, /^[A-Za-z0-9_-]{32,128}$/, "STATE_INVALID");
  const nonce = bounded(row.nonce, /^[A-Za-z0-9_-]{32,128}$/, "NONCE_INVALID");
  const pkceChallenge = bounded(row.pkceChallenge, /^[A-Za-z0-9_-]{43}$/, "PKCE_CHALLENGE_INVALID");
  const publicSigningKey = normalizeNativePublicJwk(row.publicSigningKey);
  return { appId, appVersion, redirectUri, platform, deviceLabel, publicDeviceId, state, nonce, pkceChallenge, publicSigningKey, publicKeyHash: publicJwkHash(publicSigningKey) };
}

export function nativeBrowserProofMessage(input: { publicRequestId: string; challenge: string; state: string; publicDeviceId: string; publicKeyHash: string }) {
  return ["native-auth-browser-v1", input.publicRequestId, input.challenge, input.state, input.publicDeviceId, input.publicKeyHash].join("\n");
}

export async function createNativeAuthRequest(value: unknown, now = new Date()) {
  if (!nativeAppEnabled()) throw new NativeAuthError("NATIVE_APP_UNAVAILABLE", 404);
  const input = validateNativeAuthRequest(value);
  const challenge = opaque();
  const expiresAt = new Date(now.getTime() + REQUEST_TTL_MS);
  await prisma.nativeAuthRequest.updateMany({ where: { expiresAt: { lte: now }, status: { in: ["PENDING_BROWSER_AUTH", "DEVICE_APPROVAL_REQUIRED"] } }, data: { status: "EXPIRED", consumedAt: now } });
  const row = await prisma.nativeAuthRequest.create({
    data: {
      challengeHash: secretHash(challenge, "challenge"),
      stateHash: secretHash(input.state, "state"),
      nonceHash: secretHash(input.nonce, "nonce"),
      pkceChallenge: input.pkceChallenge,
      appId: input.appId,
      appVersion: input.appVersion,
      redirectUri: input.redirectUri,
      platform: input.platform,
      deviceLabel: input.deviceLabel,
      publicDeviceId: input.publicDeviceId,
      publicSigningKey: JSON.stringify(input.publicSigningKey),
      publicKeyHash: input.publicKeyHash,
      expiresAt
    }
  });
  return {
    requestId: row.publicRequestId,
    challenge,
    expiresAt: expiresAt.toISOString(),
    authorizePath: `/native/authorize?request=${encodeURIComponent(row.publicRequestId)}&state=${encodeURIComponent(input.state)}&challenge=${encodeURIComponent(challenge)}`
  };
}

export async function inspectNativeAuthorization(input: { requestId: string; state: string; challenge: string }, now = new Date()) {
  const row = await prisma.nativeAuthRequest.findUnique({ where: { publicRequestId: input.requestId } });
  if (!row || row.expiresAt <= now || row.consumedAt || row.status === "DENIED" || !safeEqual(secretHash(input.state, "state"), row.stateHash) || !safeEqual(secretHash(input.challenge, "challenge"), row.challengeHash)) {
    throw new NativeAuthError("AUTHORIZATION_REQUEST_INVALID_OR_EXPIRED", 410);
  }
  return { requestId: row.publicRequestId, deviceLabel: row.deviceLabel, platform: row.platform, publicDeviceId: row.publicDeviceId, publicKeyHash: row.publicKeyHash, state: input.state, challenge: input.challenge };
}

export async function authorizeNativeRequest(input: { requestId: string; state: string; challenge: string; proof: string; user: AuthUser; webSessionId: string }, now = new Date()) {
  if (!nativeAppEnabled()) throw new NativeAuthError("NATIVE_APP_UNAVAILABLE", 404);
  const inspected = await inspectNativeAuthorization(input, now);
  const row = await prisma.nativeAuthRequest.findUniqueOrThrow({ where: { publicRequestId: input.requestId } });
  if (!isRole(input.user.role) || !["ACCOUNTANT", "SUPER_ADMIN"].includes(input.user.role) || input.user.mustChangePassword) throw new NativeAuthError("NATIVE_ROLE_DENIED", 403);
  const permission = await evaluateEffectivePermission(prisma, { userId: input.user.id, sessionId: input.webSessionId, roleAssignmentId: input.user.roleAssignmentId, permission: "USE_OFFLINE_SYNC" });
  if (!permission.allowed) throw new NativeAuthError("NATIVE_PERMISSION_DENIED", 403);
  const proofMessage = nativeBrowserProofMessage({ publicRequestId: inspected.requestId, challenge: inspected.challenge, state: inspected.state, publicDeviceId: inspected.publicDeviceId, publicKeyHash: row.publicKeyHash });
  if (!(await verifyEd25519Signature(row.publicSigningKey, proofMessage, input.proof))) throw new NativeAuthError("DEVICE_PROOF_INVALID", 401);
  const user = await prisma.user.findUnique({ where: { id: input.user.id }, select: { credentialVersion: true, authorizationVersion: true, isActive: true, lifecycleStatus: true } });
  if (!user?.isActive || user.lifecycleStatus !== "ACTIVE" || user.authorizationVersion !== input.user.authorizationVersion) throw new NativeAuthError("ACCOUNT_STATE_CHANGED", 403);

  return prisma.$transaction(async (tx) => {
    let device = await tx.offlineSyncDevice.findUnique({ where: { publicDeviceId: row.publicDeviceId } });
    if (!device) {
      device = await tx.offlineSyncDevice.create({ data: { publicDeviceId: row.publicDeviceId, userId: input.user.id, label: row.deviceLabel, platform: row.platform, publicSigningKey: row.publicSigningKey, publicKeyHash: row.publicKeyHash, keyAlgorithm: "ED25519", status: "PENDING_APPROVAL" } });
      await tx.nativeAuthRequest.update({ where: { id: row.id }, data: { status: "DEVICE_APPROVAL_REQUIRED", userId: input.user.id, webSessionId: input.webSessionId, roleAssignmentId: input.user.roleAssignmentId, authorizedAt: now } });
      await logAuthSecurityEvent(tx, { eventType: "NATIVE_DEVICE_APPROVAL_REQUESTED", userId: input.user.id, subjectType: "OFFLINE_SYNC_DEVICE", subjectId: device.id, details: { platform: row.platform, keyVersion: device.keyVersion } });
      return { status: "DEVICE_APPROVAL_REQUIRED" as const };
    }
    if (device.userId !== input.user.id || device.publicKeyHash !== row.publicKeyHash || device.keyAlgorithm !== "ED25519") throw new NativeAuthError("DEVICE_IDENTITY_MISMATCH", 403);
    if (device.status !== "ACTIVE") {
      await tx.nativeAuthRequest.update({ where: { id: row.id }, data: { status: "DEVICE_APPROVAL_REQUIRED", userId: input.user.id, webSessionId: input.webSessionId, roleAssignmentId: input.user.roleAssignmentId, authorizedAt: now } });
      return { status: "DEVICE_APPROVAL_REQUIRED" as const };
    }
    const code = opaque();
    await tx.nativeAuthorizationCode.create({ data: { codeHash: secretHash(code, "authorization-code"), requestId: row.id, userId: input.user.id, deviceId: device.id, roleAssignmentId: input.user.roleAssignmentId, credentialVersion: user.credentialVersion, authorizationVersion: user.authorizationVersion, appId: row.appId, redirectUri: row.redirectUri, pkceChallenge: row.pkceChallenge, expiresAt: new Date(now.getTime() + CODE_TTL_MS) } });
    await tx.nativeAuthRequest.update({ where: { id: row.id }, data: { status: "AUTHORIZED", userId: input.user.id, webSessionId: input.webSessionId, roleAssignmentId: input.user.roleAssignmentId, authorizedAt: now } });
    await logAuthSecurityEvent(tx, { eventType: "NATIVE_AUTHORIZATION_CODE_ISSUED", userId: input.user.id, subjectType: "OFFLINE_SYNC_DEVICE", subjectId: device.id, details: { platform: row.platform, keyVersion: device.keyVersion } });
    return { status: "AUTHORIZED" as const, redirectUrl: `${NATIVE_REDIRECT_URI}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(input.state)}&request=${encodeURIComponent(row.publicRequestId)}` };
  });
}

export function pkceChallenge(verifier: string) { return createHash("sha256").update(verifier).digest("base64url"); }

export function nativeExchangeProofMessage(input: { requestId: string; code: string; verifier: string; nonce: string; publicDeviceId: string }) {
  return ["native-auth-exchange-v1", input.requestId, sha256Hex(input.code), sha256Hex(input.verifier), input.nonce, input.publicDeviceId].join("\n");
}

export async function exchangeNativeAuthorization(value: unknown, now = new Date()) {
  if (!nativeAppEnabled()) throw new NativeAuthError("NATIVE_APP_UNAVAILABLE", 404);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new NativeAuthError("EXCHANGE_INVALID");
  const raw = value as Record<string, unknown>;
  const code = bounded(raw.code, /^[A-Za-z0-9_-]{43}$/, "CODE_INVALID");
  const verifier = bounded(raw.verifier, /^[A-Za-z0-9._~-]{43,128}$/, "PKCE_VERIFIER_INVALID");
  const requestId = bounded(raw.requestId, /^[0-9a-f-]{36}$/i, "REQUEST_ID_INVALID");
  const nonce = bounded(raw.nonce, /^[A-Za-z0-9_-]{32,128}$/, "NONCE_INVALID");
  const publicDeviceId = bounded(raw.publicDeviceId, /^[0-9a-f-]{36}$/i, "DEVICE_ID_INVALID");
  const proof = bounded(raw.proof, /^[A-Za-z0-9_-]{80,128}$/, "DEVICE_PROOF_INVALID");
  return prisma.$transaction(async (tx) => {
    const authorization = await tx.nativeAuthorizationCode.findUnique({ where: { codeHash: secretHash(code, "authorization-code") }, include: { request: true, user: true, device: true } });
    if (!authorization || authorization.usedAt || authorization.expiresAt <= now || authorization.request.publicRequestId !== requestId || authorization.device.publicDeviceId !== publicDeviceId || authorization.request.status !== "AUTHORIZED") throw new NativeAuthError("CODE_INVALID_OR_EXPIRED", 401);
    if (!safeEqual(pkceChallenge(verifier), authorization.pkceChallenge) || !safeEqual(secretHash(nonce, "nonce"), authorization.request.nonceHash)) throw new NativeAuthError("PKCE_OR_NONCE_INVALID", 401);
    const message = nativeExchangeProofMessage({ requestId, code, verifier, nonce, publicDeviceId });
    if (!(await verifyDeviceSignature(authorization.device, message, proof))) throw new NativeAuthError("DEVICE_PROOF_INVALID", 401);
    await assertNativeAccountState(tx, authorization, now);
    const accessToken = opaque(); const refreshToken = opaque();
    const session = await tx.nativeSession.create({ data: { userId: authorization.userId, deviceId: authorization.deviceId, roleAssignmentId: authorization.roleAssignmentId, accessTokenHash: secretHash(accessToken, "access"), refreshTokenHash: secretHash(refreshToken, "refresh"), credentialVersion: authorization.credentialVersion, authorizationVersion: authorization.authorizationVersion, scopesJson: JSON.stringify(NATIVE_SCOPES), accessExpiresAt: new Date(now.getTime() + ACCESS_TTL_MS), refreshExpiresAt: new Date(now.getTime() + REFRESH_TTL_MS), absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_TTL_MS) } });
    await tx.nativeAuthorizationCode.update({ where: { id: authorization.id }, data: { usedAt: now } });
    await tx.nativeAuthRequest.update({ where: { id: authorization.requestId }, data: { status: "CONSUMED", consumedAt: now } });
    await logAuthSecurityEvent(tx, { eventType: "NATIVE_SESSION_CREATED", userId: authorization.userId, subjectType: "NATIVE_SESSION", subjectId: session.publicSessionId, details: { rotationVersion: 1, keyVersion: authorization.device.keyVersion } });
    return tokenResponse(session.publicSessionId, accessToken, refreshToken, now, 1, authorization.device.keyVersion);
  });
}

async function assertNativeAccountState(tx: Prisma.TransactionClient, row: { userId: string; roleAssignmentId: string; credentialVersion: number; authorizationVersion: number; user: { isActive: boolean; lifecycleStatus: string; credentialVersion: number; authorizationVersion: number }; device: { status: string } }, now: Date) {
  if (!row.user.isActive || row.user.lifecycleStatus !== "ACTIVE" || row.user.credentialVersion !== row.credentialVersion || row.user.authorizationVersion !== row.authorizationVersion || row.device.status !== "ACTIVE") throw new NativeAuthError("NATIVE_SESSION_REVOKED", 401);
  const assignment = await tx.userRoleAssignment.findFirst({ where: { id: row.roleAssignmentId, userId: row.userId, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } });
  if (!assignment || !isRole(assignment.role) || !["ACCOUNTANT", "SUPER_ADMIN"].includes(assignment.role)) throw new NativeAuthError("NATIVE_ROLE_REVOKED", 403);
  const permission = await evaluateEffectivePermission(tx, { userId: row.userId, roleAssignmentId: row.roleAssignmentId, permission: "USE_OFFLINE_SYNC" });
  if (!permission.allowed) throw new NativeAuthError("NATIVE_PERMISSION_REVOKED", 403);
  return assignment;
}

function tokenResponse(publicSessionId: string, accessToken: string, refreshToken: string, now: Date, tokenVersion: number, deviceKeyVersion: number, refreshExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS)) {
  return { tokenType: "Bearer" as const, sessionId: publicSessionId, tokenVersion, deviceKeyVersion, accessToken, accessExpiresAt: new Date(now.getTime() + ACCESS_TTL_MS).toISOString(), refreshToken, refreshExpiresAt: refreshExpiresAt.toISOString(), scopes: NATIVE_SCOPES };
}

function storedNativeScopes(value: string): NativeScope[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.some((scope) => !NATIVE_SCOPES.includes(scope as NativeScope))) throw new Error();
    return parsed as NativeScope[];
  } catch {
    throw new NativeAuthError("NATIVE_SCOPE_INVALID", 403);
  }
}

export async function resolveNativeSession(request: Request, requiredScope?: NativeScope, now = new Date()) {
  if (!nativeAppEnabled()) throw new NativeAuthError("NATIVE_APP_UNAVAILABLE", 404);
  const sessionId = bounded(request.headers.get("x-native-session"), /^[0-9a-f-]{36}$/i, "NATIVE_SESSION_REQUIRED");
  const match = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43})$/);
  if (!match) throw new NativeAuthError("NATIVE_ACCESS_REQUIRED", 401);
  const row = await prisma.nativeSession.findUnique({ where: { publicSessionId: sessionId }, include: { user: true, device: true } });
  if (!row || row.revokedAt || row.accessExpiresAt <= now || row.absoluteExpiresAt <= now || !safeEqual(secretHash(match[1], "access"), row.accessTokenHash)) throw new NativeAuthError("NATIVE_ACCESS_INVALID_OR_EXPIRED", 401);
  const scopes = storedNativeScopes(row.scopesJson);
  if (requiredScope && !scopes.includes(requiredScope)) throw new NativeAuthError("NATIVE_SCOPE_DENIED", 403);
  const assignment = await prisma.$transaction((tx) => assertNativeAccountState(tx, row, now));
  await prisma.nativeSession.updateMany({ where: { id: row.id, revokedAt: null }, data: { lastSeenAt: now } });
  const user: AuthUser = { id: row.user.id, name: row.user.name, username: row.user.username, email: row.user.email, designation: row.user.designation, role: assignment.role as AuthUser["role"], roleAssignmentId: assignment.id, authorizationVersion: row.user.authorizationVersion, mustChangePassword: row.user.mustChangePassword, guardianId: row.user.guardianId };
  return { session: row, user, device: row.device, scopes };
}

export async function refreshNativeSession(value: unknown, now = new Date()) {
  if (!nativeAppEnabled()) throw new NativeAuthError("NATIVE_APP_UNAVAILABLE", 404);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new NativeAuthError("REFRESH_INVALID");
  const raw = value as Record<string, unknown>;
  const sessionId = bounded(raw.sessionId, /^[0-9a-f-]{36}$/i, "NATIVE_SESSION_REQUIRED");
  const refreshToken = bounded(raw.refreshToken, /^[A-Za-z0-9_-]{43}$/, "REFRESH_TOKEN_INVALID");
  const publicDeviceId = bounded(raw.publicDeviceId, /^[0-9a-f-]{36}$/i, "DEVICE_ID_INVALID");
  const timestamp = bounded(raw.timestamp, /^\d{10,16}$/, "DEVICE_PROOF_INVALID");
  const proofNonce = bounded(raw.proofNonce, /^[A-Za-z0-9_-]{16,160}$/, "DEVICE_PROOF_INVALID");
  const proof = bounded(raw.proof, /^[A-Za-z0-9_-]{80,128}$/, "DEVICE_PROOF_INVALID");
  const timestampMs = Number(timestamp);
  if (!Number.isSafeInteger(timestampMs) || Math.abs(now.getTime() - timestampMs) > PROOF_WINDOW_MS) throw new NativeAuthError("DEVICE_PROOF_EXPIRED", 401);
  const tokenHash = secretHash(refreshToken, "refresh");
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.nativeSession.findUnique({ where: { publicSessionId: sessionId }, include: { user: true, device: true } });
    if (!row || row.revokedAt || row.refreshExpiresAt <= now || row.absoluteExpiresAt <= now || row.device.publicDeviceId !== publicDeviceId) throw new NativeAuthError("NATIVE_REFRESH_INVALID_OR_EXPIRED", 401);
    const message = nativeRefreshProofMessage({ sessionId, timestamp, proofNonce, refreshTokenHash: sha256Hex(refreshToken), publicDeviceId, tokenVersion: row.tokenVersion });
    if (!(await verifyDeviceSignature(row.device, message, proof))) throw new NativeAuthError("DEVICE_PROOF_INVALID", 401);
    try { await tx.offlineSyncNonce.create({ data: { deviceId: row.deviceId, nonceHash: sha256Hex(`native-refresh-v1:${proofNonce}`), expiresAt: new Date(now.getTime() + PROOF_WINDOW_MS * 3) } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new NativeAuthError("DEVICE_PROOF_REPLAYED", 409); throw error; }
    if (!safeEqual(tokenHash, row.refreshTokenHash)) {
      const reused = await tx.nativeRefreshTokenHistory.findUnique({ where: { refreshTokenHash: tokenHash } });
      if (reused?.sessionId === row.id) {
        await tx.nativeRefreshTokenHistory.update({ where: { id: reused.id }, data: { status: "REUSED", reusedAt: now } });
        await tx.nativeSession.update({ where: { id: row.id }, data: { revokedAt: now, revocationReason: "ROTATED_REFRESH_TOKEN_REUSED" } });
        await logAuthSecurityEvent(tx, { eventType: "NATIVE_REFRESH_REUSE_DETECTED", userId: row.userId, subjectType: "NATIVE_SESSION", subjectId: row.publicSessionId, details: { rotationVersion: row.tokenVersion } });
        return { reuseDetected: true as const };
      }
      throw new NativeAuthError("NATIVE_REFRESH_INVALID_OR_EXPIRED", 401);
    }
    await assertNativeAccountState(tx, row, now);
    const accessToken = opaque(); const nextRefreshToken = opaque(); const nextVersion = row.tokenVersion + 1;
    await tx.nativeRefreshTokenHistory.create({ data: { sessionId: row.id, refreshTokenHash: row.refreshTokenHash, tokenVersion: row.tokenVersion } });
    const refreshExpiresAt = new Date(Math.min(now.getTime() + REFRESH_TTL_MS, row.absoluteExpiresAt.getTime()));
    await tx.nativeSession.update({ where: { id: row.id }, data: { accessTokenHash: secretHash(accessToken, "access"), refreshTokenHash: secretHash(nextRefreshToken, "refresh"), tokenVersion: nextVersion, accessExpiresAt: new Date(now.getTime() + ACCESS_TTL_MS), refreshExpiresAt, lastSeenAt: now } });
    return { reuseDetected: false as const, tokens: tokenResponse(row.publicSessionId, accessToken, nextRefreshToken, now, nextVersion, row.device.keyVersion, refreshExpiresAt) };
  });
  if (result.reuseDetected) throw new NativeAuthError("NATIVE_REFRESH_REUSE_DETECTED", 401);
  return result.tokens;
}

export function nativeRefreshProofMessage(input: { sessionId: string; timestamp: string; proofNonce: string; refreshTokenHash: string; publicDeviceId: string; tokenVersion: number }) {
  return ["native-refresh-v1", input.sessionId, input.timestamp, input.proofNonce, input.refreshTokenHash, input.publicDeviceId, String(input.tokenVersion)].join("\n");
}

export async function revokeNativeSession(request: Request, reason = "USER_LOGOUT", now = new Date()) {
  const resolved = await resolveNativeSession(request, undefined, now);
  await prisma.nativeSession.updateMany({ where: { id: resolved.session.id, revokedAt: null }, data: { revokedAt: now, revocationReason: reason } });
  await logAuthSecurityEvent(prisma, { eventType: "NATIVE_SESSION_REVOKED", userId: resolved.user.id, subjectType: "NATIVE_SESSION", subjectId: resolved.session.publicSessionId, details: { reason } });
}

export function nativeAuthResponse(error: unknown) {
  const known = error instanceof NativeAuthError ? error : null;
  return Response.json({ error: known ? "Native authentication request was refused." : "Unable to process native authentication.", code: known?.code ?? "NATIVE_AUTH_FAILED" }, { status: known?.status ?? 400, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function parseBoundedNativeJson(request: Request) {
  const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/json") throw new NativeAuthError("CONTENT_TYPE_REQUIRED", 415);
  const text = await request.text();
  if (!text || text.length > 32 * 1024) throw new NativeAuthError("REQUEST_SIZE_INVALID", 413);
  try { return JSON.parse(text) as unknown; } catch { throw new NativeAuthError("JSON_INVALID"); }
}

export const NATIVE_AUTH_CONSTANTS = { NATIVE_APP_ID, NATIVE_REDIRECT_URI, REQUEST_TTL_MS, CODE_TTL_MS, ACCESS_TTL_MS, REFRESH_TTL_MS, ABSOLUTE_TTL_MS, PROOF_WINDOW_MS } as const;
