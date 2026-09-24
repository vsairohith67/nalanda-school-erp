import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID, randomBytes, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync, readdirSync, lstatSync, existsSync } from "node:fs";
import { DatabaseSync, backup } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { NextRequest } from "next/server";
import { defaultPermissionMatrix } from "../lib/role-permissions";
import { createPersistedSession, resolvePersistedSession } from "../lib/auth-sessions";
import { beginTotpEnrollment, confirmTotpEnrollment } from "../lib/real-user-access/mfa-service";
import { generateTotpForSyntheticQa } from "../lib/real-user-access/totp";
import { createStepUpChallenge, completeStepUpChallenge } from "../lib/real-user-access/step-up";
import { boundAuthEnvironment } from "../lib/real-user-access/login-mfa";
import { nativeSessionRevocationAction, revokeGovernedNativeSession, parseNativeSessionRevocation, NATIVE_ADMIN_REVOCATION_EVENT } from "../lib/native-app/session-governance";
import { createNativeAuthRequest, authorizeNativeRequest, exchangeNativeAuthorization, refreshNativeSession, resolveNativeSession, pkceChallenge, nativeBrowserProofMessage, nativeExchangeProofMessage, nativeRefreshProofMessage } from "../lib/native-app/auth";
import { publicJwkHash, sha256Hex } from "../lib/offline-sync/device-trust";
import { POST } from "../app/api/native-auth/sessions/[id]/revoke/route";
import { operationPolicy } from "../lib/security-resilience";

// ISOLATED_SERVICE_OR_ROUTE: generated protocol inputs, real crypto, sessions,
// MFA, step-up, permission, credential validators and transactions. No server,
// admitted image, observed OS callback or Windows execution is claimed.
const harness = vi.hoisted(() => ({ db: null as any, cookie: undefined as string | undefined, enabled: true }));
vi.mock("../lib/prisma", () => ({ prisma: new Proxy({}, { get: (_t, key) => { const v = harness.db[key]; return typeof v === "function" ? v.bind(harness.db) : v; } }) }));
vi.mock("../lib/native-app/feature-flag", () => ({ NATIVE_APP_ID: "com.nalandaps.erp", NATIVE_REDIRECT_URI: "nalandaps-erp://auth/callback", nativeAppEnabled: () => harness.enabled }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: harness.cookie }) }) }));
const root = mkdtempSync(path.join(tmpdir(), "nalanda-session-governance-")), identity = lstatSync(root), schema = `nsg_${randomUUID().replaceAll("-", "")}`, postgres = process.env.DATABASE_PROVIDER === "postgresql";
let db: PrismaClient;
const opaque = () => randomBytes(32).toString("base64url");
beforeAll(async () => {
  let url = "file:" + path.join(root, "synthetic.db").replaceAll("\\", "/");
  if (postgres) {
    expect(process.env.CI).toBe("true"); expect(process.env.POSTGRES_READINESS_SYNTHETIC_QA).toBe("1");
    const target = new URL(process.env.DATABASE_URL!); target.searchParams.set("schema", schema); url = target.toString();
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "pipe" });
  } else {
    const sql = new DatabaseSync(":memory:");
    try { for (const migration of readdirSync("prisma/migrations", { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()) sql.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8")); expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]); await backup(sql, path.join(root, "synthetic.db")); } finally { sql.close(); }
  }
  db = new PrismaClient({ datasourceUrl: url }); harness.db = db;
  vi.stubEnv("DATABASE_URL", url); vi.stubEnv("AUTH_SECRET", opaque() + opaque()); vi.stubEnv("APP_ORIGIN", "https://synthetic.invalid");
  vi.stubEnv("AUTH_BOUND_ENVIRONMENT", "SYNTHETIC_SERVICE");
  vi.stubEnv("AUTH_MFA_KEYRING_JSON", JSON.stringify({ active: "QA", keys: { QA: randomBytes(32).toString("base64") } }));
  await db.rolePermission.createMany({ data: Object.entries(defaultPermissionMatrix()).flatMap(([role, entries]) => Object.entries(entries).map(([permission, enabled]) => ({ role, permission, enabled }))) });
}, 60_000);
afterAll(async () => {
  if (db) { if (postgres) await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); await db.$disconnect(); }
  const current = lstatSync(root); expect(current.isSymbolicLink()).toBe(false); expect(current.ino).toBe(identity.ino); expect(current.dev).toBe(identity.dev); expect(path.dirname(path.resolve(root))).toBe(path.resolve(tmpdir())); rmSync(root, { recursive: true }); expect(existsSync(root)).toBe(false); vi.unstubAllEnvs();
});
async function user(role = "SUPER_ADMIN") {
  const u = await db.user.create({ data: { username: `synthetic-${randomUUID()}`, name: "SYNTHETIC service actor", role, passwordHash: "UNUSABLE_SYNTHETIC_NO_LOGIN", isActive: true, lifecycleStatus: "ACTIVE", mustChangePassword: false } });
  const assignment = await db.userRoleAssignment.create({ data: { userId: u.id, role, reason: "SYNTHETIC service preparation", activeKey: `${u.id}:${role}` } });
  const web = await createPersistedSession(db, u, new Headers());
  const enrollment = await beginTotpEnrollment(db, { userId: u.id, displayName: "SYNTHETIC factor", accountLabel: "synthetic@example.invalid" });
  const factor = await db.mfaAuthenticator.findUniqueOrThrow({ where: { publicKey: enrollment.factorHandle } });
  await confirmTotpEnrollment(db, { userId: u.id, factorHandle: enrollment.factorHandle, token: generateTotpForSyntheticQa({ userId: u.id, authenticatorId: factor.id, secretEnvelope: factor.secretEnvelope! }), environment: boundAuthEnvironment() });
  return { u, assignment, web, factor };
}
type Actor = Awaited<ReturnType<typeof user>>;
async function grant(actor: Actor, id: string, action = nativeSessionRevocationAction(id), sessionId = actor.web.sessionId) {
  const input = { userId: actor.u.id, sessionId, action, environment: boundAuthEnvironment() };
  const challenge = await createStepUpChallenge(db, input);
  const factor = await db.mfaAuthenticator.findUniqueOrThrow({ where: { id: actor.factor.id } });
  // Controlled service clock for TOTP only; never host clock or runtime evidence.
  const timestamp = Math.max(Date.now(), (factor.totpLastUsedStep! + 1) * 30_000);
  const response = generateTotpForSyntheticQa({ userId: actor.u.id, authenticatorId: factor.id, secretEnvelope: factor.secretEnvelope!, timestamp });
  return (await completeStepUpChallenge(db, { ...input, challengeToken: challenge.challengeToken, factor: "TOTP", response, timestamp })).stepUpToken;
}
async function native(actor: Actor, existing?: { keys: ReturnType<typeof generateKeyPairSync>; deviceId: string }) {
  const keys = existing?.keys ?? generateKeyPairSync("ed25519"), deviceId = existing?.deviceId ?? randomUUID(), publicSigningKey = keys.publicKey.export({ format: "jwk" });
  const signature = (s: string) => sign(null, Buffer.from(s), keys.privateKey).toString("base64url");
  const state = opaque(), nonce = opaque(), verifier = opaque();
  const r = await createNativeAuthRequest({ appId: "com.nalandaps.erp", appVersion: "0.1.0", redirectUri: "nalandaps-erp://auth/callback", platform: "WINDOWS", deviceLabel: "SYNTHETIC session service", publicDeviceId: deviceId, publicSigningKey, state, nonce, pkceChallenge: pkceChallenge(verifier) });
  const proof = signature(nativeBrowserProofMessage({ publicRequestId: r.requestId, challenge: r.challenge, state, publicDeviceId: deviceId, publicKeyHash: publicJwkHash(publicSigningKey) }));
  const authorize = () => authorizeNativeRequest({ requestId: r.requestId, state, challenge: r.challenge, proof, user: { ...actor.u, roleAssignmentId: actor.assignment.id } as any, webSessionId: actor.web.sessionId });
  let result = await authorize();
  if (!("redirectUrl" in result)) {
    // Approved-device PRECONDITION only. Authorization/exchange, session and
    // revocation/audit outcomes below must be created by their real services.
    await db.offlineSyncDevice.update({ where: { publicDeviceId: deviceId }, data: { status: "ACTIVE", approvedAt: new Date(), approvedByUserId: actor.u.id } }); result = await authorize();
  }
  if (!("redirectUrl" in result)) throw Error("SYNTHETIC_AUTHORIZATION_FAILED");
  const code = new URL(result.redirectUrl!).searchParams.get("code")!;
  const tokens = await exchangeNativeAuthorization({ requestId: r.requestId, code, verifier, nonce, publicDeviceId: deviceId, proof: signature(nativeExchangeProofMessage({ requestId: r.requestId, code, verifier, nonce, publicDeviceId: deviceId })) });
  return { keys, deviceId, tokens, signature };
}
type Native = Awaited<ReturnType<typeof native>>;
const access = (n: Native, tokens = n.tokens) => resolveNativeSession(new Request("https://synthetic.invalid/api/native/v1/context", { headers: { "x-native-session": tokens.sessionId, authorization: `Bearer ${tokens.accessToken}` } })).then(() => true);
async function refresh(n: Native, tokens = n.tokens) {
  const timestamp = String(Date.now()), proofNonce = opaque();
  return refreshNativeSession({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken, publicDeviceId: n.deviceId, timestamp, proofNonce, proof: n.signature(nativeRefreshProofMessage({ sessionId: tokens.sessionId, timestamp, proofNonce, refreshTokenHash: sha256Hex(tokens.refreshToken), publicDeviceId: n.deviceId, tokenVersion: tokens.tokenVersion })) });
}
const events = (id: string) => db.authSecurityEvent.findMany({ where: { eventType: NATIVE_ADMIN_REVOCATION_EVENT, subjectType: "NATIVE_SESSION", subjectId: id } });
async function revoke(actor: Actor, n: Native, stepUpToken?: string) { return revokeGovernedNativeSession(db, actor.web.cookieValue, n.tokens.sessionId, { reason: "SYNTHETIC governed security action", stepUpToken: stepUpToken ?? await grant(actor, n.tokens.sessionId) }); }

it("binds exact opaque targets, input allowlist and inherited rate/CSRF boundary", () => {
  const id = randomUUID(); expect(nativeSessionRevocationAction(id)).toBe(`NATIVE_SESSION_REVOKE_${id.replaceAll("-", "").toUpperCase()}`);
  for (const bad of ["x", "-".repeat(36), "", id + "/other"]) expect(() => nativeSessionRevocationAction(bad)).toThrow();
  for (const body of [{ reason: "valid", stepUpToken: "x", actorId: "admin" }, { reason: "abc", stepUpToken: "x" }, { reason: "x".repeat(161), stepUpToken: "x" }, { reason: "valid\nunsafe", stepUpToken: "x" }]) expect(() => parseNativeSessionRevocation(body)).toThrow();
  expect(operationPolicy(`/api/native-auth/sessions/${id}/revoke`, "POST")?.id).toBe("native.auth");
  const middleware = readFileSync("middleware.ts", "utf8"); expect(middleware.slice(middleware.indexOf("const nativeRouteAuthorizedPaths"), middleware.indexOf("export async function"))).not.toContain("/revoke");
});
it("revokes only the selected real session, preserves controls, first audit/reason, and fresh login cannot revive it", async () => {
  const admin = await user(), owner = await user("ACCOUNTANT"), target = await native(owner), control = await native(owner);
  const deviceBefore = await db.offlineSyncDevice.findUniqueOrThrow({ where: { publicDeviceId: target.deviceId } });
  const userBefore = await db.user.findUniqueOrThrow({ where: { id: owner.u.id } });
  const rotated = await refresh(target); // refresh commits FIRST
  await access(target, rotated);
  expect(await revoke(admin, target)).toEqual({ status: "REVOKED" });
  const first = await db.nativeSession.findUniqueOrThrow({ where: { publicSessionId: target.tokens.sessionId } });
  for (const credential of [target.tokens, rotated]) { await expect(access(target, credential)).rejects.toThrow("NATIVE_ACCESS_INVALID"); await expect(refresh(target, credential).then(() => true)).rejects.toThrow("NATIVE_REFRESH_INVALID"); }
  expect(await revoke(admin, target)).toEqual({ status: "ALREADY_REVOKED" });
  expect(JSON.stringify(await db.nativeSession.findUniqueOrThrow({ where: { id: first.id } })) === JSON.stringify(first)).toBe(true);
  const audit = await events(target.tokens.sessionId); expect(audit).toHaveLength(1); expect(audit[0]).toMatchObject({ actorUserId: admin.u.id, userId: owner.u.id }); expect(JSON.parse(audit[0].detailsJson!)).toMatchObject({ reason: first.revocationReason, outcome: "REVOKED", revokedAt: first.revokedAt!.toISOString(), actingSessionId: admin.web.sessionId });
  await access(control); expect(await resolvePersistedSession(db, owner.web.cookieValue)).not.toBeNull();
  expect(JSON.stringify(await db.offlineSyncDevice.findUniqueOrThrow({ where: { id: deviceBefore.id } })) === JSON.stringify(deviceBefore)).toBe(true); expect(JSON.stringify(await db.user.findUniqueOrThrow({ where: { id: owner.u.id } })) === JSON.stringify(userBefore)).toBe(true);
  const fresh = await native(owner, target); expect(fresh.tokens.sessionId).not.toBe(target.tokens.sessionId); await access(fresh); expect((await db.nativeSession.findUniqueOrThrow({ where: { id: first.id } })).revokedAt).toEqual(first.revokedAt);
  const publicText = JSON.stringify(audit.map(e => JSON.parse(e.detailsJson!))); for (const secret of [target.tokens.accessToken, target.tokens.refreshToken, rotated.accessToken, admin.web.cookieValue]) expect(publicText.includes(secret)).toBe(false);
});
it("reauthorizes absent/inactive/wrong selected role/explicit deny even on retries", async () => {
  const admin = await user(), owner = await user("ACCOUNTANT"), target = await native(owner), token = await grant(admin, target.tokens.sessionId);
  const body = { stepUpToken: token, reason: "SYNTHETIC denial control" };
  await expect(revokeGovernedNativeSession(db, undefined, target.tokens.sessionId, body)).rejects.toThrow("AUTHENTICATION_REQUIRED");
  await db.user.update({ where: { id: admin.u.id }, data: { isActive: false } }); await expect(revoke(admin, target, token)).rejects.toThrow("AUTHENTICATION_REQUIRED"); await db.user.update({ where: { id: admin.u.id }, data: { isActive: true } });
  await db.userRoleAssignment.update({ where: { id: admin.assignment.id }, data: { role: "ACCOUNTANT" } }); await expect(revoke(admin, target, token)).rejects.toThrow("GOVERNANCE_DENIED"); await db.userRoleAssignment.update({ where: { id: admin.assignment.id }, data: { role: "SUPER_ADMIN" } });
  const deny = await db.userPermissionOverride.create({ data: { userId: admin.u.id, permission: "MANAGE_OFFLINE_SYNC_DEVICES", effect: "DENY", reason: "SYNTHETIC explicit deny", createdByUserId: admin.u.id } });
  await expect(revoke(admin, target, token)).rejects.toThrow("GOVERNANCE_DENIED"); expect(await events(target.tokens.sessionId)).toHaveLength(0); await access(target);
  await db.userPermissionOverride.update({ where: { id: deny.id }, data: { status: "REVOKED", revokedAt: new Date() } }); await revoke(admin, target, token);
  await db.userRoleAssignment.update({ where: { id: admin.assignment.id }, data: { status: "REVOKED", endedAt: new Date(), activeKey: null } }); await expect(revoke(admin, target, token)).rejects.toThrow("AUTHENTICATION_REQUIRED"); expect(await events(target.tokens.sessionId)).toHaveLength(1);
});
it("rejects missing/expired/revoked/replayed and wrong action/actor/web-session/target/environment step-up", async () => {
  const admin = await user(), other = await user(), owner = await user("ACCOUNTANT"), target = await native(owner);
  await expect(revoke(admin, target, "missing")).rejects.toThrow("STEP_UP_REQUIRED");
  for (const change of [{ expiresAt: new Date(0) }, { revokedAt: new Date() }, { usedAt: new Date() }]) { const t = await grant(admin, target.tokens.sessionId); await db.stepUpGrant.update({ where: { id: t.split(".")[0] }, data: change }); await expect(revoke(admin, target, t)).rejects.toThrow("STEP_UP_REQUIRED"); }
  for (const t of [await grant(admin, randomUUID()), await grant(admin, target.tokens.sessionId, "OTHER_GOVERNED_ACTION"), await grant(other, target.tokens.sessionId), await grant(admin, target.tokens.sessionId, undefined, (await createPersistedSession(db, admin.u, new Headers())).sessionId)]) await expect(revoke(admin, target, t)).rejects.toThrow("STEP_UP_REQUIRED");
  const t = await grant(admin, target.tokens.sessionId); vi.stubEnv("AUTH_BOUND_ENVIRONMENT", "OTHER_ENVIRONMENT"); await expect(revoke(admin, target, t)).rejects.toThrow("STEP_UP_REQUIRED"); vi.stubEnv("AUTH_BOUND_ENVIRONMENT", "SYNTHETIC_SERVICE");
  expect(await events(target.tokens.sessionId)).toHaveLength(0); await access(target);
});
it("conceals unknown or corrupted relationships without consuming a grant or transitioning", async () => {
  const admin = await user(), owner = await user("ACCOUNTANT"), foreign = await user("ACCOUNTANT"), target = await native(owner);
  const unknown = randomUUID(), token = await grant(admin, unknown);
  await expect(revokeGovernedNativeSession(db, admin.web.cookieValue, unknown, { reason: "SYNTHETIC unknown", stepUpToken: token })).rejects.toThrow("NATIVE_SESSION_NOT_FOUND"); expect((await db.stepUpGrant.findUniqueOrThrow({ where: { id: token.split(".")[0] } })).usedAt).toBeNull();
  const device = await db.offlineSyncDevice.findUniqueOrThrow({ where: { publicDeviceId: target.deviceId } });
  await db.offlineSyncDevice.update({ where: { id: device.id }, data: { userId: foreign.u.id } }); await expect(revoke(admin, target)).rejects.toThrow("NATIVE_SESSION_NOT_FOUND"); await db.offlineSyncDevice.update({ where: { id: device.id }, data: { userId: owner.u.id } });
  await db.nativeSession.update({ where: { publicSessionId: target.tokens.sessionId }, data: { roleAssignmentId: foreign.assignment.id } }); await expect(revoke(admin, target)).rejects.toThrow("NATIVE_SESSION_NOT_FOUND"); expect(await events(target.tokens.sessionId)).toHaveLength(0);
});
it("concurrent revocation has one durable transition; revoke-first refresh cannot issue authority", async () => {
  const admin = await user(), owner = await user("ACCOUNTANT"), target = await native(owner);
  const a = await grant(admin, target.tokens.sessionId), b = await grant(admin, target.tokens.sessionId);
  const results = await Promise.allSettled([revoke(admin, target, a), revoke(admin, target, b)]);
  expect(results.filter(r => r.status === "fulfilled" && r.value.status === "REVOKED")).toHaveLength(1);
  for (const r of results) if (r.status === "rejected") expect(String(r.reason)).toMatch(/P2034|write conflict|database is locked|NATIVE_SESSION_CHANGED|Transaction/);
  expect(await events(target.tokens.sessionId)).toHaveLength(1); await expect(refresh(target).then(() => true)).rejects.toThrow("NATIVE_REFRESH_INVALID"); await expect(access(target)).rejects.toThrow("NATIVE_ACCESS_INVALID");
  const row = await db.nativeSession.findUniqueOrThrow({ where: { publicSessionId: target.tokens.sessionId } }); expect(row.tokenVersion).toBe(1); expect(await db.nativeRefreshTokenHistory.count({ where: { sessionId: row.id } })).toBe(0);
});
it("overlapping refresh/revoke cannot leave usable successor credentials or duplicate audit", async () => {
  const admin = await user(), owner = await user("ACCOUNTANT"), target = await native(owner), token = await grant(admin, target.tokens.sessionId);
  const results = await Promise.allSettled([refresh(target), revoke(admin, target, token)]);
  // Serialization can refuse a participant; only an authorized explicit retry
  // of an uncommitted revoke is allowed. It uses the still-unused grant.
  if (results[1].status === "rejected") await revoke(admin, target, token);
  if (results[0].status === "fulfilled") { await expect(access(target, results[0].value)).rejects.toThrow("NATIVE_ACCESS_INVALID"); await expect(refresh(target, results[0].value).then(() => true)).rejects.toThrow("NATIVE_REFRESH_INVALID"); }
  else expect(String(results[0].reason)).toMatch(/NATIVE_REFRESH_INVALID|P2034|write conflict|database is locked|Transaction/);
  expect(await events(target.tokens.sessionId)).toHaveLength(1); await expect(access(target)).rejects.toThrow("NATIVE_ACCESS_INVALID");
});
it("audit failure rolls back revocation and grant; route responses are private and fail closed", async () => {
  const admin = await user(), owner = await user("ACCOUNTANT"), target = await native(owner), token = await grant(admin, target.tokens.sessionId);
  // Inject at the real transaction's audit boundary; all other delegates/commit
  // remain real. Never seed an expected audit or revocation.
  const failing = new Proxy(db, { get(client, key) { if (key === "$transaction") return (fn: any, options: any) => client.$transaction(tx => fn(new Proxy(tx, { get(t, k) { if (k === "authSecurityEvent") return { create: async () => { throw Error("PRIVATE_AUDIT_STORAGE_FAILURE"); } }; return Reflect.get(t, k); } })), options); const v = Reflect.get(client, key); return typeof v === "function" ? v.bind(client) : v; } });
  await expect(revokeGovernedNativeSession(failing, admin.web.cookieValue, target.tokens.sessionId, { reason: "SYNTHETIC rollback", stepUpToken: token })).rejects.toThrow("PRIVATE_AUDIT_STORAGE_FAILURE");
  expect((await db.stepUpGrant.findUniqueOrThrow({ where: { id: token.split(".")[0] } })).usedAt).toBeNull(); expect(await events(target.tokens.sessionId)).toHaveLength(0); await access(target);
  harness.cookie = admin.web.cookieValue;
  const call = (body: unknown, origin = "https://synthetic.invalid") => POST(new NextRequest(`https://synthetic.invalid/api/native-auth/sessions/${target.tokens.sessionId}/revoke`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: target.tokens.sessionId }) });
  const body = { reason: "SYNTHETIC rollback", stepUpToken: token };
  expect((await call(body, "https://foreign.invalid")).status).toBe(403); expect((await call({ ...body, role: "SUPER_ADMIN" })).status).toBe(400); expect((await call({ ...body, reason: "x".repeat(33_000) })).status).toBe(413);
  harness.db = failing; const failed = await call(body); expect(failed.status).toBe(500); expect(await failed.text()).not.toContain("PRIVATE_AUDIT_STORAGE_FAILURE"); harness.db = db;
  harness.enabled = false; expect((await call(body)).status).toBe(404); harness.enabled = true;
  const result = await call(body); expect(result.status).toBe(200); expect(await result.json()).toEqual({ status: "REVOKED" }); expect(result.headers.get("cache-control")).toBe("private, no-store"); expect(result.headers.get("x-content-type-options")).toBe("nosniff");
});
