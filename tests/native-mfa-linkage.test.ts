import { beforeAll, beforeEach, afterEach, afterAll, describe, it, expect, vi } from "vitest";
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
import { configuredTrace } from "./helpers/service-trace";
import { MfaJourneyObservation, mfaPhase, observeMfaClient } from "./helpers/native-mfa-trace";

// ISOLATED_SERVICE_OR_ROUTE: generated protocol inputs, real crypto, sessions,
// MFA, step-up, permission, credential validators and transactions. No server,
// admitted image, observed OS callback or Windows execution is claimed.
const harness = vi.hoisted(() => ({ passkeyValid: true, db: null as any, cookie: undefined as string | undefined, enabled: true }));
vi.mock("../lib/prisma", () => ({ prisma: new Proxy({}, { get: (_t, key) => { const v = harness.db[key]; return typeof v === "function" ? v.bind(harness.db) : v; } }) }));
vi.mock("../lib/native-app/feature-flag", () => ({ NATIVE_APP_ID: "com.nalandaps.erp", NATIVE_REDIRECT_URI: "nalandaps-erp://auth/callback", nativeAppEnabled: () => harness.enabled, nativeDataScopeEnabled: () => harness.enabled, operationalNativeAppEnabled: () => harness.enabled }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: harness.cookie }) }) }));
const trace = configuredTrace("mfa"), observation = new MfaJourneyObservation(trace);
// Refuse invalid trace custody before allocating a disposable database root.
const root = mkdtempSync(path.join(tmpdir(), "nalanda-mfa-linkage-")), identity = lstatSync(root), schema = `mfl_${randomUUID().replaceAll("-", "")}`, postgres = process.env.DATABASE_PROVIDER === "postgresql";
let db: PrismaClient;
let caseSpan = 0;
const opaque = () => randomBytes(32).toString("base64url");
beforeAll(async () => {
  const setup = trace.begin("setup"), migration = trace.begin("migration");
  try {
  let url = "file:" + path.join(root, "synthetic.db").replaceAll("\\", "/");
  if (postgres) {
    expect(process.env.CI).toBe("true"); expect(process.env.POSTGRES_READINESS_SYNTHETIC_QA).toBe("1");
    const target = new URL(process.env.DATABASE_URL!); target.searchParams.set("schema", schema); url = target.toString();
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "pipe" });
  } else {
    const sql = new DatabaseSync(":memory:");
    try { for (const migration of readdirSync("prisma/migrations", { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()) sql.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8")); expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]); await backup(sql, path.join(root, "synthetic.db")); } finally { sql.close(); }
  }
  trace.end(migration);
  db = observeMfaClient(new PrismaClient({ datasourceUrl: url })); harness.db = db;
  vi.stubEnv("DATABASE_URL", url); vi.stubEnv("AUTH_SECRET", opaque() + opaque()); vi.stubEnv("APP_ORIGIN", "https://synthetic.invalid");
  vi.stubEnv("AUTH_BOUND_ENVIRONMENT", "SYNTHETIC_SERVICE");
  vi.stubEnv("AUTH_MFA_KEYRING_JSON", JSON.stringify({ active: "QA", keys: { QA: randomBytes(32).toString("base64") } }));
  await trace.phase("seed", () => db.rolePermission.createMany({ data: Object.entries(defaultPermissionMatrix()).flatMap(([role, entries]) => Object.entries(entries).map(([permission, enabled]) => ({ role, permission, enabled }))) }));
  trace.end(setup);
  } catch (error) { trace.end(migration, true); trace.end(setup, true); trace.result("fail"); throw error; }
}, 60_000);
afterAll(async () => {
  try {
    // A Vitest timeout rejects its wrapper, not necessarily the real service
    // promise. Never drop/disconnect its fixture while that promise is pending.
    if (!await observation.drain()) throw Error("MFA_TEST_IN_FLIGHT_CLEANUP_HELD");
    await trace.phase("cleanup", async () => {
      if (db) { if (postgres) await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); await db.$disconnect(); }
      const current = lstatSync(root); expect(current.isSymbolicLink()).toBe(false); expect(current.ino).toBe(identity.ino); expect(current.dev).toBe(identity.dev); expect(path.dirname(path.resolve(root))).toBe(path.resolve(tmpdir())); rmSync(root, { recursive: true }); expect(existsSync(root)).toBe(false);
    });
  } catch (error) { trace.result("fail"); throw error; }
  finally { trace.close(); if (!observation.pendingCount) vi.unstubAllEnvs(); }
});
async function user(role = "SUPER_ADMIN") {
  const u = await db.user.create({ data: { username: `synthetic-${randomUUID()}`, name: "SYNTHETIC service actor", role, passwordHash: "UNUSABLE_SYNTHETIC_NO_LOGIN", isActive: true, lifecycleStatus: "ACTIVE", mustChangePassword: false } });
  // Establish already-effective fixture authority explicitly, rather than race
  // the database-generated validFrom against the application's sign-in clock.
  const assignment = await db.userRoleAssignment.create({ data: { userId: u.id, role, validFrom: new Date(Date.now() - 60_000), reason: "SYNTHETIC service preparation", activeKey: `${u.id}:${role}` } });
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
  const r = await mfaPhase("native_request", () => createNativeAuthRequest({ appId: "com.nalandaps.erp", appVersion: "0.1.0", redirectUri: "nalandaps-erp://auth/callback", platform: "WINDOWS", deviceLabel: "SYNTHETIC session service", publicDeviceId: deviceId, publicSigningKey, state, nonce, pkceChallenge: pkceChallenge(verifier) }));
  const proof = signature(nativeBrowserProofMessage({ publicRequestId: r.requestId, challenge: r.challenge, state, publicDeviceId: deviceId, publicKeyHash: publicJwkHash(publicSigningKey) }));
  const authorize = () => mfaPhase("native_authorize", () => authorizeNativeRequest({ requestId: r.requestId, state, challenge: r.challenge, proof, user: { ...actor.u, roleAssignmentId: actor.assignment.id } as any, webSessionId: actor.web.sessionId }));
  let result = await authorize();
  if (!("redirectUrl" in result)) {
    // Approved-device PRECONDITION only. Authorization/exchange, session and
    // revocation/audit outcomes below must be created by their real services.
    await mfaPhase("device_fixture", () => db.offlineSyncDevice.update({ where: { publicDeviceId: deviceId }, data: { status: "ACTIVE", approvedAt: new Date(), approvedByUserId: actor.u.id } })); result = await authorize();
  }
  if (!("redirectUrl" in result)) throw Error("SYNTHETIC_AUTHORIZATION_FAILED");
  const code = new URL(result.redirectUrl!).searchParams.get("code")!;
  if(beforeExchange)await beforeExchange();
  const tokens = await mfaPhase("native_exchange", () => exchangeFn({ requestId: r.requestId, code, verifier, nonce, publicDeviceId: deviceId, proof: signature(nativeExchangeProofMessage({ requestId: r.requestId, code, verifier, nonce, publicDeviceId: deviceId })) }));
  return { keys, deviceId, tokens, signature, requestId:r.requestId };
}
import { createLoginMfaChallenge, completeLoginMfaSignIn } from "../lib/real-user-access/login-mfa";
import { readNativeMfaEvidence } from "../lib/real-user-access/native-mfa-evidence";
import { POST as mfaRoute } from "../app/api/auth/login/mfa/route";
vi.mock("../lib/release-feature-flag-runtime", async importOriginal => ({...await importOriginal<any>(), isOperationalReleaseFeatureEnabled:()=>true}));
// Only the physical WebAuthn signature verifier is doubled. Enrollment is a
// labelled credential precondition; the login service, counter CAS, challenge,
// issuance and audit are real. This is NOT physical-passkey acceptance.
vi.mock("../lib/real-user-access/webauthn", async importOriginal => ({...await importOriginal<any>(), verifyPasskeyAuthentication:async(input:any)=>({verified:harness.passkeyValid,authenticationInfo:{newCounter:input.counter+1}})}));
async function login(actor:Actor, factor:"TOTP"|"RECOVERY_CODE"="TOTP", recoveryIndex=0) {
 const challenge=await mfaPhase("mfa_challenge",()=>createLoginMfaChallenge(db,{userId:actor.u.id,environment:boundAuthEnvironment()}));
 if(!("challengeToken" in challenge)||!challenge.challengeToken)throw Error("SYNTHETIC_CHALLENGE_REQUIRED");
 const f=await mfaPhase("mfa_factor_lookup",()=>db.mfaAuthenticator.findUniqueOrThrow({where:{id:actor.factor.id}}));
 const timestamp=Math.max(Date.now(),(f.totpLastUsedStep!+1)*30_000);
 const input={challengeToken:challenge.challengeToken,environment:boundAuthEnvironment(),factor,response:factor==="TOTP"?generateTotpForSyntheticQa({userId:actor.u.id,authenticatorId:f.id,secretEnvelope:f.secretEnvelope!,timestamp}):actor.recoveryCodes[recoveryIndex],timestamp};
 const result=await mfaPhase("mfa_verify",()=>completeLoginMfaSignIn(db,input,new Headers()));
 if(!result.verified||!("session" in result)||!result.session)throw Error("SYNTHETIC_LOGIN_FAILED");
 return {actor:{...actor,web:result.session},input,challengeId:challenge.challengeToken.split(".")[0]};
}
const evidence=(actor:Actor,n:Awaited<ReturnType<typeof native>>, extra:Record<string,any>={})=>mfaPhase("lineage_read",()=>readNativeMfaEvidence(db,{userId:actor.u.id,requestId:n.requestId,nativeSessionId:n.tokens.sessionId,environment:boundAuthEnvironment(),...extra}));
let actor:Actor;
let projectionSetup:{login:Awaited<ReturnType<typeof login>>;native:Awaited<ReturnType<typeof native>>}|undefined;
beforeEach(async context=>{
 caseSpan=trace.begin("test_case");
 trace.emit("TEST_CONTRACT","test_case",caseSpan,0,null,{case:trace.label(context.task.id),purpose:context.task.name==="rotation preserves explicit lineage and fresh login never revives revoked history"?"MFA_ROTATION_HISTORY_JOURNEY":"MFA_LINEAGE_CONTROLS"});
 actor=await trace.phase("actor_setup",()=>user("ACCOUNTANT"));harness.passkeyValid=true;projectionSetup=undefined;
 if(context.task.name==="projection excludes credentials and readback never manufactures events"){
  // Real service-created precondition, never inserted proof. Hosted Windows
  // job108498097645's whole-test timeout included this real-service setup.
  // Keep this under the existing 60s setup bound; the read/assertion retains 15s.
  const authenticated=await login(actor);projectionSetup={login:authenticated,native:await native(authenticated.actor)};
 }
},60_000);
afterEach(context=>{trace.end(caseSpan,context.task.result?.state==="fail");trace.result(context.task.result?.state);});
describe.sequential("MFA issuance and exact native lineage (isolated services)",()=>{
 it.each(["TOTP","RECOVERY_CODE"] as const)("records the actual %s factor, exact challenge and session",async factor=>{
  const l=await login(actor,factor),n=await native(l.actor),e=await evidence(l.actor,n);
  expect(e).toEqual({status:"VERIFIED",factor,challengeId:l.challengeId,verifiedAt:(await db.authSession.findUniqueOrThrow({where:{id:l.actor.web.sessionId}})).createdAt.toISOString(),webSessionId:l.actor.web.sessionId,userId:actor.u.id,requestId:n.requestId,nativeSessionId:n.tokens.sessionId});
  expect(await completeLoginMfaSignIn(db,l.input,new Headers())).toMatchObject({verified:false});
  expect(await db.authSecurityEvent.count({where:{eventType:"MFA_LOGIN_SESSION_ISSUED",subjectId:l.actor.web.sessionId}})).toBe(1);
 });
 it("normal MFA route ignores forged proof fields and issues only the actual factor linkage",async()=>{
  const challenge=await createLoginMfaChallenge(db,{userId:actor.u.id,environment:boundAuthEnvironment()});
  const response=await mfaRoute(new NextRequest("https://synthetic.invalid/api/auth/login/mfa",{method:"POST",body:JSON.stringify({challengeToken:challenge.challengeToken,factor:"RECOVERY_CODE",response:actor.recoveryCodes[0],mfaUsed:true,challengeId:"forged",verifiedAt:"forged"})}));
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
  const row=await db.mfaChallenge.findUniqueOrThrow({where:{id:challenge.challengeToken!.split(".")[0]}});
  expect(Boolean(row.sessionId)).toBe(true);
  const event=await db.authSecurityEvent.findFirstOrThrow({where:{eventType:"MFA_LOGIN_SESSION_ISSUED",subjectId:row.sessionId}});
  const proof=JSON.parse(event.detailsJson!);expect(proof.challengeId).toBe(row.id);expect(proof.factorType).toBe("RECOVERY_CODE");
  const publicBody=JSON.stringify(await response.json());expect(/challenge|factor|session|recovery|token|hash/i.test(publicBody)).toBe(false);
 });
 it.each(["failed","expired","revoked","environment","inactive"])("does not issue evidence for %s login",async kind=>{
  const c=await createLoginMfaChallenge(db,{userId:actor.u.id,environment:boundAuthEnvironment()}),id=c.challengeToken!.split(".")[0];
  if(kind==="expired")await db.mfaChallenge.update({where:{id},data:{expiresAt:new Date(0)}});
  if(kind==="revoked")await db.mfaChallenge.update({where:{id},data:{revokedAt:new Date()}});
  if(kind==="inactive")await db.user.update({where:{id:actor.u.id},data:{isActive:false}});
  const result=await completeLoginMfaSignIn(db,{challengeToken:c.challengeToken!,environment:kind==="environment"?"FOREIGN":boundAuthEnvironment(),factor:"RECOVERY_CODE",response:kind==="failed"?"invalid":actor.recoveryCodes[0]},new Headers());
  expect(result.verified).toBe(false);expect(await db.authSession.count({where:{userId:actor.u.id}})).toBe(1);expect(await db.authSecurityEvent.count({where:{userId:actor.u.id,eventType:"MFA_LOGIN_SESSION_ISSUED"}})).toBe(0);
 });
 it("concurrent distinct logins keep distinct challenge/web relationships",async()=>{
  const results=await Promise.all([login(actor,"RECOVERY_CODE",0),login(actor,"RECOVERY_CODE",1)]);
  expect(new Set(results.map(r=>r.actor.web.sessionId)).size).toBe(2);
  for(const l of results){const n=await native(l.actor);expect(await evidence(l.actor,n)).toMatchObject({status:"VERIFIED",challengeId:l.challengeId,webSessionId:l.actor.web.sessionId});}
 });
 it("same-challenge concurrent submission produces at most one session and one proof",async()=>{
  const c=await createLoginMfaChallenge(db,{userId:actor.u.id,environment:boundAuthEnvironment()});
  const input={challengeToken:c.challengeToken!,environment:boundAuthEnvironment(),factor:"RECOVERY_CODE" as const,response:actor.recoveryCodes[0]};
  const results=await Promise.allSettled([completeLoginMfaSignIn(db,input,new Headers()),completeLoginMfaSignIn(db,input,new Headers())]);
  expect(results.filter(r=>r.status==="fulfilled"&&r.value.verified).length).toBe(1);
  expect(await db.authSession.count({where:{userId:actor.u.id}})).toBe(2);
  expect(await db.authSecurityEvent.count({where:{userId:actor.u.id,eventType:"MFA_LOGIN_SESSION_ISSUED"}})).toBe(1);
 });
 it("allows two distinct native requests from one web login without substituting a later login",async()=>{
  const l=await login(actor),a=await native(l.actor),b=await native(l.actor);await login(actor,"RECOVERY_CODE");
  for(const n of [a,b])expect(await evidence(l.actor,n)).toMatchObject({status:"VERIFIED",challengeId:l.challengeId,webSessionId:l.actor.web.sessionId});
  expect(await evidence(l.actor,a,{nativeSessionId:b.tokens.sessionId})).toEqual({status:"CONFLICT"});
 });
 it("retains historical proof after challenge submission expiry, pruning and native revocation",async()=>{
  const l=await login(actor),n=await native(l.actor);
  await db.mfaChallenge.update({where:{id:l.challengeId},data:{expiresAt:new Date(0)}});expect((await evidence(l.actor,n)).status).toBe("VERIFIED");
  // Explicit retention/negative fixture, not a generated authentication outcome.
  await db.mfaChallenge.delete({where:{id:l.challengeId}});expect((await evidence(l.actor,n)).status).toBe("VERIFIED");
  await db.nativeSession.update({where:{publicSessionId:n.tokens.sessionId},data:{revokedAt:new Date(),revocationReason:"SYNTHETIC lineage retention fixture"}});
  expect((await evidence(l.actor,n)).status).toBe("VERIFIED");
 });
 it("does not infer proof for a historical password session or a pending request",async()=>{
  const n=await native(actor);expect(await evidence(actor,n)).toEqual({status:"NOT_RECORDED"});
  const keys=generateKeyPairSync("ed25519");const r=await createNativeAuthRequest({appId:"com.nalandaps.erp",appVersion:"0.1.0",redirectUri:"nalandaps-erp://auth/callback",platform:"WINDOWS",deviceLabel:"SYNTHETIC pending",publicDeviceId:randomUUID(),publicSigningKey:keys.publicKey.export({format:"jwk"}),state:opaque(),nonce:opaque(),pkceChallenge:pkceChallenge(opaque())});
  expect(await readNativeMfaEvidence(db,{userId:actor.u.id,requestId:r.requestId,nativeSessionId:null,environment:boundAuthEnvironment()})).toEqual({status:"NOT_YET_ISSUED"});
 });
 it.each(["user","environment","request","web","factor","malformed","duplicate","missing"])("fails closed for altered or missing %s lineage",async kind=>{
  const l=await login(actor),n=await native(l.actor);
  if(kind==="user"||kind==="environment"||kind==="request"){expect((await evidence(l.actor,n,{[kind==="user"?"userId":kind==="request"?"requestId":"environment"]:kind==="request"?randomUUID():"foreign"})).status).toBe("CONFLICT");return;}
  const row=await db.authSecurityEvent.findFirstOrThrow({where:{eventType:"MFA_LOGIN_SESSION_ISSUED",subjectId:l.actor.web.sessionId}});
  if(kind==="web")await db.nativeAuthRequest.update({where:{publicRequestId:n.requestId},data:{webSessionId:actor.web.sessionId}});
  if(kind==="factor")await db.authSecurityEvent.update({where:{id:row.id},data:{detailsJson:JSON.stringify({...JSON.parse(row.detailsJson!),factorType:"WEBAUTHN"})}});
  if(kind==="malformed")await db.authSecurityEvent.update({where:{id:row.id},data:{detailsJson:"{}"}});
  if(kind==="duplicate"){const {id,...data}=row;await db.authSecurityEvent.create({data});}
  if(kind==="missing")await db.authSecurityEvent.delete({where:{id:row.id}});
  expect((await evidence(l.actor,n)).status).toBe(kind==="missing"?"NOT_RECORDED":"CONFLICT");
 });
 it.each(["authSession","authSecurityEvent","mfaChallenge"])("rolls back issuance, challenge and factor when %s storage fails",async boundary=>{
  const c=await createLoginMfaChallenge(db,{userId:actor.u.id,environment:boundAuthEnvironment()});
  const broken=new Proxy(db,{get(target,key){if(key==="$transaction")return (fn:any)=>target.$transaction(tx=>fn(new Proxy(tx,{get(t,k){if(k===boundary)return new Proxy((t as any)[k],{get(delegate,method){if(boundary==="mfaChallenge"&&method==="updateMany")return async()=>({count:0});if(method==="create")return async(args:any)=>{if(boundary==="authSession"||args.data.eventType==="MFA_LOGIN_SESSION_ISSUED")throw Error("SYNTHETIC_WRITE_FAILURE");return delegate.create(args);};return delegate[method];}});return (t as any)[k];}})));const value=(target as any)[key];return typeof value==="function"?value.bind(target):value;}});
  await expect(completeLoginMfaSignIn(broken,{challengeToken:c.challengeToken!,environment:boundAuthEnvironment(),factor:"RECOVERY_CODE",response:actor.recoveryCodes[0]},new Headers())).rejects.toThrow(boundary==="mfaChallenge"?"MFA_LOGIN_REPLAYED":"SYNTHETIC_WRITE_FAILURE");
  expect((await db.mfaChallenge.findUniqueOrThrow({where:{id:c.challengeToken!.split(".")[0]}})).usedAt).toBeNull();expect(await db.authSession.count({where:{userId:actor.u.id}})).toBe(1);expect(await db.authSecurityEvent.count({where:{userId:actor.u.id,eventType:{in:["MFA_LOGIN_SUCCEEDED","MFA_LOGIN_SESSION_ISSUED"]}}})).toBe(0);
  expect((await completeLoginMfaSignIn(db,{challengeToken:c.challengeToken!,environment:boundAuthEnvironment(),factor:"RECOVERY_CODE",response:actor.recoveryCodes[0]},new Headers())).verified).toBe(true);
 });
 it("records WEBAUTHN distinctly with contract-verifier evidence and preserves replay protection",async()=>{
  vi.stubEnv("AUTH_WEBAUTHN_RP_ID","synthetic.invalid");vi.stubEnv("AUTH_WEBAUTHN_ORIGIN","https://synthetic.invalid");
  const credentialId=opaque();await db.mfaAuthenticator.create({data:{userId:actor.u.id,type:"WEBAUTHN",status:"ACTIVE",displayName:"SYNTHETIC verifier contract",credentialId,credentialPublicKey:randomBytes(32),credentialCounter:"0",rpId:"synthetic.invalid",verifiedAt:new Date()}});
  const c=await createLoginMfaChallenge(db,{userId:actor.u.id,environment:boundAuthEnvironment()});const input={challengeToken:c.challengeToken!,environment:boundAuthEnvironment(),factor:"WEBAUTHN" as const,response:{id:credentialId} as any};
  harness.passkeyValid=false;expect((await completeLoginMfaSignIn(db,input,new Headers())).verified).toBe(false);harness.passkeyValid=true;
  const success=await completeLoginMfaSignIn(db,input,new Headers());if(!success.verified||!success.session)throw Error("SYNTHETIC_PASSKEY_FAILED");const a={...actor,web:success.session},n=await native(a);expect(await evidence(a,n)).toMatchObject({status:"VERIFIED",factor:"WEBAUTHN"});expect((await completeLoginMfaSignIn(db,input,new Headers())).verified).toBe(false);
 });
 it.each(["web-revoked","web-expired","role-revoked","credential-changed"])("refuses %s at the real native exchange without erasing origin",async kind=>{
  const l=await login(actor);
  await expect(native(l.actor,undefined,async()=>{
   if(kind==="web-revoked")await db.authSession.update({where:{id:l.actor.web.sessionId},data:{revokedAt:new Date()}});
   if(kind==="web-expired")await db.authSession.update({where:{id:l.actor.web.sessionId},data:{expiresAt:new Date(0)}});
   if(kind==="role-revoked")await db.userRoleAssignment.update({where:{id:actor.assignment.id},data:{status:"REVOKED"}});
   if(kind==="credential-changed")await db.user.update({where:{id:actor.u.id},data:{credentialVersion:{increment:1}}});
  })).rejects.toThrow();
  expect(await db.nativeSession.count({where:{userId:actor.u.id}})).toBe(0);expect(await db.authSecurityEvent.count({where:{subjectId:l.actor.web.sessionId,eventType:"MFA_LOGIN_SESSION_ISSUED"}})).toBe(1);
 });
 it("rotation preserves explicit lineage and fresh login never revives revoked history",async()=>{
  const subject=actor; // Retain this case's fixture if its timed-out promise continues.
  await observation.run(caseSpan,async()=>{
  const l=await mfaPhase("mfa_totp",()=>login(subject),1),n=await mfaPhase("native_initial",()=>native(l.actor),1),before=await evidence(l.actor,n);
  const timestamp=String(Date.now()),proofNonce=opaque();
  await mfaPhase("native_refresh",()=>refreshNativeSession({sessionId:n.tokens.sessionId,refreshToken:n.tokens.refreshToken,publicDeviceId:n.deviceId,timestamp,proofNonce,proof:n.signature(nativeRefreshProofMessage({sessionId:n.tokens.sessionId,timestamp,proofNonce,refreshTokenHash:sha256Hex(n.tokens.refreshToken),publicDeviceId:n.deviceId,tokenVersion:1}))}),1);
  expect(await evidence(l.actor,n)).toEqual(before);
  await mfaPhase("revocation_fixture",()=>db.nativeSession.update({where:{publicSessionId:n.tokens.sessionId},data:{revokedAt:new Date(),revocationReason:"SYNTHETIC existing revocation fixture"}}),1);
  const fresh=await mfaPhase("mfa_recovery",()=>login(subject,"RECOVERY_CODE"),2),next=await mfaPhase("native_replacement",()=>native(fresh.actor),2);expect(next.tokens.sessionId===n.tokens.sessionId).toBe(false);expect((await mfaPhase("lineage_read",()=>db.nativeSession.findUniqueOrThrow({where:{publicSessionId:n.tokens.sessionId}}))).revokedAt!==null).toBe(true);expect(await evidence(l.actor,n)).toEqual(before);expect(await evidence(fresh.actor,next)).toMatchObject({challengeId:fresh.challengeId,webSessionId:fresh.actor.web.sessionId});
  });
 });
 it.each(["MFA_LOGIN_SUCCEEDED","NATIVE_SESSION_CREATED"])("missing retained %s is unknown, never invented proof",async eventType=>{
  const l=await login(actor),n=await native(l.actor);await db.authSecurityEvent.deleteMany({where:{userId:actor.u.id,eventType}});expect(await evidence(l.actor,n)).toEqual({status:"NOT_RECORDED"});
 });
 it("projection excludes credentials and readback never manufactures events",async()=>{
  expect(projectionSetup).toBeDefined();
  const {login:l,native:n}=projectionSetup!,count=await db.authSecurityEvent.count({where:{userId:actor.u.id}}),e=await evidence(l.actor,n);
  expect(Object.keys(e).sort()).toEqual(["status","factor","challengeId","verifiedAt","webSessionId","userId","requestId","nativeSessionId"].sort());
  const serialized=JSON.stringify(e);expect(serialized.length<1024).toBe(true);for(const secret of [n.tokens.accessToken,n.tokens.refreshToken,l.actor.web.cookieValue,l.input.response,actor.factor.secretEnvelope!])expect(serialized.includes(secret)).toBe(false);
  expect(await db.authSecurityEvent.count({where:{userId:actor.u.id}})).toBe(count);
 });

 it("rejects a borrowed challenge even after transient rows are pruned",async()=>{
  const a=await login(actor,"RECOVERY_CODE",0),b=await login(actor,"RECOVERY_CODE",1),n=await native(a.actor);
  await db.mfaChallenge.deleteMany({where:{id:{in:[a.challengeId,b.challengeId]}}});
  const issued=await db.authSecurityEvent.findFirstOrThrow({where:{eventType:"MFA_LOGIN_SESSION_ISSUED",subjectId:a.actor.web.sessionId}});
  await db.authSecurityEvent.update({where:{id:issued.id},data:{detailsJson:JSON.stringify({...JSON.parse(issued.detailsJson!),challengeId:b.challengeId})}});
  expect((await evidence(a.actor,n)).status).toBe("CONFLICT");
 });
 it("rejects unsupported user role before issuance or factor consumption commits",async()=>{
  const c=await createLoginMfaChallenge(db,{userId:actor.u.id,environment:boundAuthEnvironment()});await db.user.update({where:{id:actor.u.id},data:{role:"UNSUPPORTED"}});
  await expect(completeLoginMfaSignIn(db,{challengeToken:c.challengeToken!,environment:boundAuthEnvironment(),factor:"RECOVERY_CODE",response:actor.recoveryCodes[0]},new Headers())).rejects.toThrow("MFA_LOGIN_ACCOUNT_CHANGED");expect(await db.authSession.count({where:{userId:actor.u.id}})).toBe(1);expect((await db.mfaChallenge.findUniqueOrThrow({where:{id:c.challengeToken!.split(".")[0]}})).usedAt).toBeNull();
 });

 it("simultaneous exchange of the same code commits one native session and one origin event",async()=>{
  const l=await login(actor);const n=await native(l.actor,undefined,undefined,async input=>{
   const attempts=await Promise.allSettled([exchangeNativeAuthorization(input),exchangeNativeAuthorization(input)]);
   const successes=attempts.filter((r):r is PromiseFulfilledResult<Awaited<ReturnType<typeof exchangeNativeAuthorization>>>=>r.status==="fulfilled");expect(successes.length).toBe(1);return successes[0].value;
  });
  expect(await db.nativeSession.count({where:{userId:actor.u.id}})).toBe(1);expect(await db.authSecurityEvent.count({where:{userId:actor.u.id,eventType:"NATIVE_SESSION_CREATED",subjectId:n.tokens.sessionId}})).toBe(1);expect((await evidence(l.actor,n)).status).toBe("VERIFIED");
 });

 it("retains non-secret issuance metadata in v48 backups without manufacturing missing session proof",async()=>{
  const l=await login(actor),n=await native(l.actor),session=await db.authSession.findUniqueOrThrow({where:{id:l.actor.web.sessionId}});
  const events=await db.authSecurityEvent.findMany({where:{userId:actor.u.id,eventType:{in:["MFA_LOGIN_SUCCEEDED","MFA_LOGIN_SESSION_ISSUED","NATIVE_SESSION_CREATED"]}}});
  const bytes=serializeBackup(createBackupDocument({generatedAt:new Date(),generatedBy:"SYNTHETIC MFA compatibility",students:[],feeStructures:[],payments:[],paymentAudits:[],users:[{id:actor.u.id,name:"SYNTHETIC actor",username:actor.u.username,role:actor.u.role,isActive:true}],authSecurity:{sessions:[session],events}}));
  const parsed=parseAndValidateBackup(bytes);expect(parsed.metadata.backupVersion).toBe(48);expect(parsed.authSecurity.events.length).toBe(3);
  for(const privateValue of [session.tokenHash,l.actor.web.cookieValue,n.tokens.accessToken,n.tokens.refreshToken,actor.factor.secretEnvelope!])expect(bytes.includes(privateValue)).toBe(false);
  await db.authSession.delete({where:{id:l.actor.web.sessionId}});expect(await evidence(l.actor,n)).toEqual({status:"NOT_RECORDED"});expect(await db.authSession.findUnique({where:{id:l.actor.web.sessionId}})).toBeNull();
 });

});
