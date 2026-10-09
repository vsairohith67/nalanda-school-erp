import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID, randomBytes, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync, readdirSync, lstatSync, existsSync } from "node:fs";
import { DatabaseSync, backup } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { NextRequest } from "next/server";
import { defaultPermissionMatrix } from "../lib/role-permissions";
import { createBackupDocument, serializeBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { createPersistedSession } from "../lib/auth-sessions";
import { beginTotpEnrollment, confirmTotpEnrollment } from "../lib/real-user-access/mfa-service";
import { generateTotpForSyntheticQa } from "../lib/real-user-access/totp";
import { boundAuthEnvironment } from "../lib/real-user-access/login-mfa";
import { createNativeAuthRequest, authorizeNativeRequest, exchangeNativeAuthorization, refreshNativeSession, pkceChallenge, nativeBrowserProofMessage, nativeExchangeProofMessage, nativeRefreshProofMessage } from "../lib/native-app/auth";
import { publicJwkHash, sha256Hex } from "../lib/offline-sync/device-trust";

// ISOLATED_SERVICE_OR_ROUTE: generated protocol inputs, real crypto, sessions,
// request signatures, permission, credential validators and response audit. No server,
// admitted image, observed OS callback or Windows execution is claimed.
const harness = vi.hoisted(() => ({ passkeyValid: true, db: null as any, cookie: undefined as string | undefined, enabled: true }));
vi.mock("../lib/prisma", () => ({ prisma: new Proxy({}, { get: (_t, key) => { const v = harness.db[key]; return typeof v === "function" ? v.bind(harness.db) : v; } }) }));
vi.mock("../lib/native-app/feature-flag", () => ({ NATIVE_APP_ID: "com.nalandaps.erp", NATIVE_REDIRECT_URI: "nalandaps-erp://auth/callback", nativeAppEnabled: () => harness.enabled, nativeDataScopeEnabled: () => harness.enabled, operationalNativeAppEnabled: () => harness.enabled }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: harness.cookie }) }) }));
const root = mkdtempSync(path.join(tmpdir(), "nalanda-reference-observation-")), identity = lstatSync(root), schema = `rfo_${randomUUID().replaceAll("-", "")}`, postgres = process.env.DATABASE_PROVIDER === "postgresql";
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
  // Establish already-effective fixture authority explicitly, rather than race
  // the database-generated validFrom against the application's sign-in clock.
  // Only these two direct precondition writes share a transaction. Preserve
  // generated IDs/defaults and the derived activeKey; actual session, MFA and
  // native services below still execute independently after committed setup.
  const validFrom = new Date(Date.now() - 60_000);
  const { u, assignment } = await db.$transaction(async tx => {
    const u = await tx.user.create({ data: { username: `synthetic-${randomUUID()}`, name: "SYNTHETIC service actor", role, passwordHash: "UNUSABLE_SYNTHETIC_NO_LOGIN", isActive: true, lifecycleStatus: "ACTIVE", mustChangePassword: false } });
    const assignment = await tx.userRoleAssignment.create({ data: { userId: u.id, role, validFrom, reason: "SYNTHETIC service preparation", activeKey: `${u.id}:${role}` } });
    return { u, assignment };
  });
  const persisted = await db.userRoleAssignment.findUniqueOrThrow({ where: { id: assignment.id }, include: { user: true } });
  expect(persisted).toMatchObject({ userId: u.id, role, status: "ACTIVE", validFrom, validUntil: null, reason: "SYNTHETIC service preparation", activeKey: `${u.id}:${role}`, version: 1, contextVersion: 1, assignedByUserId: null, endedByUserId: null, endedAt: null,
    user: { id: u.id, username: u.username, name: "SYNTHETIC service actor", role, passwordHash: "UNUSABLE_SYNTHETIC_NO_LOGIN", isActive: true, lifecycleStatus: "ACTIVE", mustChangePassword: false } });
  expect(assignment.validFrom.getTime() <= Date.now()).toBe(true);
  const web = await createPersistedSession(db, u, new Headers());
  const enrollment = await beginTotpEnrollment(db, { userId: u.id, displayName: "SYNTHETIC factor", accountLabel: "synthetic@example.invalid" });
  const factor = await db.mfaAuthenticator.findUniqueOrThrow({ where: { publicKey: enrollment.factorHandle } });
  const enrolled = await confirmTotpEnrollment(db, { userId: u.id, factorHandle: enrollment.factorHandle, token: generateTotpForSyntheticQa({ userId: u.id, authenticatorId: factor.id, secretEnvelope: factor.secretEnvelope! }), environment: boundAuthEnvironment() });
  return { u, assignment, web, factor, recoveryCodes: enrolled.recoveryCodes };
}
type Actor = Awaited<ReturnType<typeof user>>;
async function native(actor: Actor, existing?: { keys: ReturnType<typeof generateKeyPairSync>; deviceId: string }, beforeExchange?:()=>Promise<void>, exchangeFn:typeof exchangeNativeAuthorization=exchangeNativeAuthorization) {
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
  if(beforeExchange)await beforeExchange();
  const tokens = await exchangeFn({ requestId: r.requestId, code, verifier, nonce, publicDeviceId: deviceId, proof: signature(nativeExchangeProofMessage({ requestId: r.requestId, code, verifier, nonce, publicDeviceId: deviceId })) });
  return { keys, deviceId, tokens, signature, requestId:r.requestId };
}

import { GET as referenceRoute } from "../app/api/native/v1/reference-pack/route";
import { requestProofMessage } from "../lib/offline-sync/device-trust";
import { readReferenceResponse, REFERENCE_RESPONSE_EVENT } from "../lib/native-app/reference-response";
import { validateReferenceResponse } from "../apps/nalanda-cross-platform/src/reference-refresh";
async function request(n:Awaited<ReturnType<typeof native>>,edit:Record<string,string>={}) {
 const timestamp=String(Date.now()),nonce=opaque(),bodyHash=sha256Hex("");
 const proof=n.signature(requestProofMessage({method:"GET",path:"/api/native/v1/reference-pack",timestamp,nonce,bodyHash,publicDeviceId:n.deviceId,keyVersion:n.tokens.deviceKeyVersion,schemaVersion:1}));
 const response=await referenceRoute(new Request("https://synthetic.invalid/api/native/v1/reference-pack",{headers:{authorization:`Bearer ${n.tokens.accessToken}`,"x-native-session":n.tokens.sessionId,"x-offline-device-id":n.deviceId,"x-offline-timestamp":timestamp,"x-offline-nonce":nonce,"x-offline-body-sha256":bodyHash,"x-offline-key-version":String(n.tokens.deviceKeyVersion),"x-offline-sync-schema":"1","x-offline-signature":proof,...edit}}));
 return {response,nonce};
}
describe("ISOLATED_SERVICE: real native signed reference endpoint and exact observation",()=>{
 it("identifies the actual empty response and keeps it separate from later population",async()=>{
  const actor=await user(),n=await native(actor),{response,nonce}=await request(n);
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  const body=await response.text(),pack=JSON.parse(body),device=await db.offlineSyncDevice.findUniqueOrThrow({where:{publicDeviceId:n.deviceId}});
  const identity={userId:actor.u.id,sessionId:n.tokens.sessionId,deviceId:device.id,publicDeviceId:n.deviceId};
  const accepted=await validateReferenceResponse(body,{...identity,profile:"SYNTHETIC_SERVICE"},sha256Hex(nonce));
  expect(accepted.observation.studentCount).toBe(0);
  expect(await readReferenceResponse(db,pack.observation.responseId,identity)).toEqual(pack.observation);
  const student=await db.student.create({data:{admissionNo:`SYNTHETIC-${randomUUID()}`,studentName:"SYNTHETIC private canary",fatherName:"SYNTHETIC guardian",phone1:"",className:"I",section:"A",academicYear:"2026-27"}});
  try {
   expect((await readReferenceResponse(db,pack.observation.responseId,identity))?.studentCount).toBe(0);
   const next=await request(n),fresh=await validateReferenceResponse(await next.response.text(),{...identity,profile:"SYNTHETIC_SERVICE"},sha256Hex(next.nonce));
   expect(fresh.pack.students.map(s=>s.admissionNo)).toEqual([student.admissionNo]);expect(fresh.observation.studentCount).toBe(1);
   expect(fresh.observation.responseId).not.toBe(pack.observation.responseId);
  } finally {await db.student.delete({where:{id:student.id}});}
  const audit=await db.authSecurityEvent.findFirstOrThrow({where:{eventType:REFERENCE_RESPONSE_EVENT,subjectId:pack.observation.responseId}});
  expect(audit.detailsJson).not.toContain(n.tokens.accessToken);expect(audit.detailsJson).not.toContain(nonce);expect(audit.detailsJson).not.toContain(pack.snapshotVersion);expect(audit.detailsJson).not.toContain("SYNTHETIC private canary");
  expect(await readReferenceResponse(db,randomUUID(),identity)).toBeNull();
  await expect(readReferenceResponse(db,pack.observation.responseId,{...identity,sessionId:randomUUID()})).rejects.toThrow("BINDING");
  expect(await readReferenceResponse(db,pack.observation.responseId,{...identity,userId:randomUUID()})).toBeNull();
 });
 it("refuses foreign device, tampered signature, expired/revoked session without a response event",async()=>{
  const actor=await user(),n=await native(actor);
  const count=()=>db.authSecurityEvent.count({where:{eventType:REFERENCE_RESPONSE_EVENT,userId:actor.u.id}});
  const edits:Record<string,string>[]=[{"x-offline-device-id":randomUUID()},{"x-offline-signature":"x".repeat(86)},{"x-native-session":randomUUID()}];
  for(const edit of edits)expect((await request(n,edit)).response.status).not.toBe(200);
  await db.nativeSession.update({where:{publicSessionId:n.tokens.sessionId},data:{accessExpiresAt:new Date(0)}});expect((await request(n)).response.status).toBe(401);
  await db.nativeSession.update({where:{publicSessionId:n.tokens.sessionId},data:{revokedAt:new Date()}});expect((await request(n)).response.status).toBe(401);expect(await count()).toBe(0);
 });
 it("rotation preserves session identity but produces a distinct response and signed request",async()=>{
  const actor=await user(),n=await native(actor),first=await (await request(n)).response.json();
  const timestamp=String(Date.now()),proofNonce=opaque();
  const next=await refreshNativeSession({sessionId:n.tokens.sessionId,refreshToken:n.tokens.refreshToken,publicDeviceId:n.deviceId,timestamp,proofNonce,proof:n.signature(nativeRefreshProofMessage({sessionId:n.tokens.sessionId,timestamp,proofNonce,refreshTokenHash:sha256Hex(n.tokens.refreshToken),publicDeviceId:n.deviceId,tokenVersion:n.tokens.tokenVersion}))});
  const second=await (await request({...n,tokens:next})).response.json();
  expect(second.observation.sessionId).toBe(first.observation.sessionId);expect(second.observation.responseId).not.toBe(first.observation.responseId);expect(second.observation.requestHash).not.toBe(first.observation.requestHash);
 });
 it("audit storage failure cannot produce a successful response or manufactured readback",async()=>{
  const actor=await user(),n=await native(actor),spy=vi.spyOn(db.authSecurityEvent,"create").mockRejectedValueOnce(Error("SYNTHETIC audit storage failure"));
  try {expect((await request(n)).response.status).not.toBe(200);} finally {spy.mockRestore();}
  expect(await db.authSecurityEvent.count({where:{eventType:REFERENCE_RESPONSE_EVENT,userId:actor.u.id}})).toBe(0);
 });
});
