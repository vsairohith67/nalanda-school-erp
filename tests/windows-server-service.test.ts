import {beforeAll,afterAll,it,expect,vi} from "vitest";
import {PrismaClient} from "@prisma/client";
import {randomUUID,randomBytes,generateKeyPairSync,sign} from "node:crypto";
import {mkdtempSync,rmSync,readFileSync,readdirSync,lstatSync,existsSync} from "node:fs";
import {DatabaseSync,backup} from "node:sqlite";
import {tmpdir} from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {defaultPermissionMatrix} from "../lib/role-permissions";
import {windowsServerProbe,validateWindowsProbeTarget,executeWindowsProbe} from "../scripts/portable/windows-server-probe";
import {publicJwkHash} from "../lib/offline-sync/device-trust";
import {createNativeAuthRequest,authorizeNativeRequest,nativeBrowserProofMessage,pkceChallenge,exchangeNativeAuthorization,nativeExchangeProofMessage,refreshNativeSession,nativeRefreshProofMessage,revokeNativeSession} from "../lib/native-app/auth";
import {sha256Hex} from "../lib/offline-sync/device-trust";
import {createPersistedSession} from "../lib/auth-sessions";
import {evaluateEffectivePermission} from "../lib/iam/effective-access";
import {PATCH} from "../app/api/offline-sync/devices/[id]/route";
// ISOLATED_SERVICE: actual native protocol, permission evaluator, approval route,
// audit and database. Admission, HTTP transport, web login and MFA prep are
// harness doubles. Nothing here is an observed Windows request or OS callback.
const harness=vi.hoisted(()=>({db:null as any,governance:null as any,admitted:true}));
vi.mock("../lib/prisma",()=>({prisma:new Proxy({}, {get:(_t,key)=>{const value=harness.db[key];return typeof value==="function"?value.bind(harness.db):value;}})}));
vi.mock("../lib/native-app/feature-flag",()=>({NATIVE_APP_ID:"com.nalandaps.erp",NATIVE_REDIRECT_URI:"nalandaps-erp://auth/callback",nativeAppEnabled:()=>true}));
vi.mock("../lib/offline-sync/feature-flag",()=>({requireOfflineSyncForApi:()=>null,offlineSyncRoleAllowed:(role:string)=>["ACCOUNTANT","SUPER_ADMIN"].includes(role),OFFLINE_SYNC_SCHEMA_VERSION:1}));
vi.mock("../lib/portable-runtime/synthetic-capability",()=>({syntheticFeatureCapability:()=>({source:"a".repeat(40),runId:"123",attempt:"1",databaseSha256:"b".repeat(64)})}));
vi.mock("../scripts/portable/acceptance-http",()=>({syntheticOrigin:"https://portable-staging.localhost:8443",assertSyntheticServingTarget:()=>{if(!harness.admitted)throw Error("HARNESS_TARGET_DENIED");},provisionSyntheticMfa:async()=>{},nextTotp:async()=>{throw Error("HARNESS_MFA_NOT_EXECUTED");},realLogin:async(db:any,username:string)=>{harness.governance=await db.user.findUniqueOrThrow({where:{username}});return {userId:harness.governance.id,cookie:"HARNESS_ONLY"};},privateHttp:async(url:string,init:any)=>PATCH(new Request(url,init),{params:Promise.resolve({id:new URL(url).pathname.split("/").at(-1)!})})}));
vi.mock("../lib/auth",()=>({requireApiPermission:async(permission:string)=>{const u=harness.governance,assignment=await harness.db.userRoleAssignment.findFirst({where:{userId:u.id,status:"ACTIVE"}}),decision=await evaluateEffectivePermission(harness.db,{userId:u.id,roleAssignmentId:assignment?.id,permission});return decision.allowed?{user:u}:{response:Response.json({error:"Denied"},{status:403})};}}));
const root=mkdtempSync(path.join(tmpdir(),"nalanda-windows-server-service-")),identity=lstatSync(root),schema=`wsp_${randomUUID().replaceAll("-","")}`,postgres=process.env.DATABASE_PROVIDER==="postgresql";let db:PrismaClient;
const keys=generateKeyPairSync("ed25519"),publicSigningKey=keys.publicKey.export({format:"jwk"}),bound={source:"a".repeat(40),runId:"123",attempt:"1",iteration:randomUUID(),phase:"synthetic-ON",databaseIdentitySha256:"b".repeat(64),publicDeviceId:randomUUID(),publicKeyHash:publicJwkHash(publicSigningKey)},opaque=()=>randomBytes(32).toString("base64url"),signature=(s:string)=>sign(null,Buffer.from(s),keys.privateKey).toString("base64url");
const probe=(operation:string,extra:Record<string,unknown>={})=>windowsServerProbe(db,{...bound,operation,...extra}) as Promise<any>;
beforeAll(async()=>{
 let url="file:"+path.join(root,"synthetic.db").replaceAll("\\","/");
 if(postgres){expect(process.env.CI).toBe("true");expect(process.env.POSTGRES_READINESS_SYNTHETIC_QA).toBe("1");const target=new URL(process.env.DATABASE_URL!);target.searchParams.set("schema",schema);url=target.toString();execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy","--schema","prisma/postgresql/schema.prisma"],{env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},stdio:"pipe"});}
 else{const sql=new DatabaseSync(":memory:");try{for(const migration of readdirSync("prisma/migrations",{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort())sql.exec(readFileSync(path.join("prisma/migrations",migration,"migration.sql"),"utf8"));expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);await backup(sql,path.join(root,"synthetic.db"));}finally{sql.close();}}
 db=new PrismaClient({datasourceUrl:url});harness.db=db;vi.stubEnv("DATABASE_URL",url);vi.stubEnv("AUTH_SECRET",randomBytes(48).toString("base64url"));
 await db.rolePermission.createMany({data:Object.entries(defaultPermissionMatrix()).flatMap(([role,entries])=>Object.entries(entries).map(([permission,enabled])=>({role,permission,enabled})))});
},60_000);
afterAll(async()=>{if(db){if(postgres)await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await db.$disconnect();}const current=lstatSync(root);expect(current.isSymbolicLink()).toBe(false);expect(current.ino).toBe(identity.ino);expect(current.dev).toBe(identity.dev);expect(path.dirname(path.resolve(root))).toBe(path.resolve(tmpdir()));rmSync(root,{recursive:true});expect(existsSync(root)).toBe(false);vi.unstubAllEnvs();});
it("rejects target drift before any database operation",async()=>{
 const trap=new Proxy({},{get(){throw Error("DB_ACCESSED_BEFORE_TARGET_VALIDATION");}}) as PrismaClient;
 for(const drift of [{source:"d".repeat(40)},{runId:"124"},{attempt:"2"},{databaseIdentitySha256:"e".repeat(64)}])await expect(windowsServerProbe(trap,{...bound,operation:"totp",...drift})).rejects.not.toThrow("DB_ACCESSED");
 harness.admitted=false;expect(()=>validateWindowsProbeTarget({...bound,operation:"totp"})).toThrow("TARGET_DENIED");harness.admitted=true;
});
it("disconnects owned clients on operation failure and does not construct after admission refusal",async()=>{
 const disconnect=vi.fn(async()=>{}),factory=vi.fn(async()=>({user:{findUniqueOrThrow:async()=>{throw Error("OWNED_FIXTURE_MISSING");}},$disconnect:disconnect}) as any);
 await expect(executeWindowsProbe({...bound,operation:"totp"},factory)).rejects.toThrow("OWNED_FIXTURE_MISSING");expect(disconnect).toHaveBeenCalledOnce();
 harness.admitted=false;await expect(executeWindowsProbe({...bound,operation:"totp"},factory)).rejects.toThrow("TARGET_DENIED");expect(factory).toHaveBeenCalledOnce();harness.admitted=true;
});
it("actual pending/approval/exchange/rotation/self-logout/fresh authentication preserve precise private readback",async()=>{
 const password=randomBytes(48).toString("base64url"),f=await probe("prepare",{password,governancePassword:password});
 await expect(probe("prepare",{password,governancePassword:password})).rejects.toThrow();
 const user=await db.user.findUniqueOrThrow({where:{id:f.userId}}),assignment=await db.userRoleAssignment.findFirstOrThrow({where:{userId:user.id}}),web=await createPersistedSession(db,user,new Headers());
 const actor={...user,roleAssignmentId:assignment.id} as any;
 const request=async()=>{const state=opaque(),nonce=opaque(),verifier=opaque();const made=await createNativeAuthRequest({appId:"com.nalandaps.erp",appVersion:"0.1.0",redirectUri:"nalandaps-erp://auth/callback",platform:"WINDOWS",deviceLabel:"SYNTHETIC Windows service",publicDeviceId:bound.publicDeviceId,publicSigningKey,state,nonce,pkceChallenge:pkceChallenge(verifier)});const proof=signature(nativeBrowserProofMessage({publicRequestId:made.requestId,challenge:made.challenge,state,publicDeviceId:bound.publicDeviceId,publicKeyHash:bound.publicKeyHash}));const original=`https://portable-staging.localhost:8443${made.authorizePath}&proof=${proof}`;return {...made,state,nonce,verifier,proof,original};};
 const authorize=(r:Awaited<ReturnType<typeof request>>)=>authorizeNativeRequest({requestId:r.requestId,state:r.state,challenge:r.challenge,proof:r.proof,user:actor,webSessionId:web.sessionId});
 const pending=await request();let snapshot=await probe("read",{original:pending.original});expect(snapshot).toMatchObject({userId:null,sessionId:null,deviceId:null,tokenVersion:null,sessionRevoked:null,activeSessions:0,mfaUsed:null});
 expect(await db.nativeSession.count()).toBe(0);await authorize(pending);snapshot=await probe("read",{original:pending.original});expect(snapshot).toMatchObject({userId:user.id,deviceStatus:"PENDING_APPROVAL",sessionId:null,activeSessions:0});
 for(const drift of [{publicDeviceId:randomUUID()},{publicKeyHash:"d".repeat(64)},{iteration:randomUUID()}])await expect(windowsServerProbe(db,{...bound,...drift,operation:"read",original:pending.original})).rejects.toThrow();
 await expect(probe("read",{original:pending.original.replace("proof=","proof=x")})).rejects.toThrow();
 const deniedGrant=await db.userPermissionOverride.create({data:{userId:f.governanceUserId,permission:"MANAGE_OFFLINE_SYNC_DEVICES",effect:"DENY",reason:"SYNTHETIC negative-authority fixture",createdByUserId:f.governanceUserId,activeKey:`${f.governanceUserId}:MANAGE_OFFLINE_SYNC_DEVICES`}});await expect(probe("approve",{original:pending.original,governancePassword:password})).rejects.toThrow();expect(await db.offlineSyncEvent.count({where:{eventType:"DEVICE_APPROVED"}})).toBe(0);await db.userPermissionOverride.update({where:{id:deniedGrant.id},data:{status:"REVOKED",revokedAt:new Date(),activeKey:null}});
 expect(await probe("approve",{original:pending.original,governancePassword:password})).toMatchObject({evidenceClass:"SERVICE_GOVERNANCE",eventCount:1});await expect(probe("approve",{original:pending.original,governancePassword:password})).rejects.toThrow();
 const exchange=async(r:Awaited<ReturnType<typeof request>>)=>{const result=await authorize(r);if(!("redirectUrl" in result))throw Error("NO_REAL_CALLBACK");const code=new URL(result.redirectUrl!).searchParams.get("code")!;return exchangeNativeAuthorization({requestId:r.requestId,code,verifier:r.verifier,nonce:r.nonce,publicDeviceId:bound.publicDeviceId,proof:signature(nativeExchangeProofMessage({requestId:r.requestId,code,verifier:r.verifier,nonce:r.nonce,publicDeviceId:bound.publicDeviceId}))});};
 const consumed=await request(),tokens=await exchange(consumed);snapshot=await probe("read",{original:consumed.original});expect(snapshot).toMatchObject({sessionId:tokens.sessionId,activeSessions:1,tokenVersion:1,mfaUsed:null,referenceObservation:"AVAILABLE_POPULATION_ONLY_NOT_REFRESH_PROOF"});expect(snapshot.referenceStudents).toEqual([...f.expectedStudents].sort());
 const timestamp=String(Date.now()),proofNonce=opaque(),rotated=await refreshNativeSession({sessionId:tokens.sessionId,refreshToken:tokens.refreshToken,publicDeviceId:bound.publicDeviceId,timestamp,proofNonce,proof:signature(nativeRefreshProofMessage({sessionId:tokens.sessionId,timestamp,proofNonce,refreshTokenHash:sha256Hex(tokens.refreshToken),publicDeviceId:bound.publicDeviceId,tokenVersion:1}))});
 expect(await probe("read",{original:consumed.original})).toMatchObject({tokenVersion:2,rotatedTokenVersions:[1]});
 await expect(probe("revoke-session",{original:consumed.original,sessionId:randomUUID()})).rejects.toThrow("OWNERSHIP");await expect(probe("revoke-session",{original:consumed.original,sessionId:tokens.sessionId})).rejects.toThrow("GOVERNANCE_NOT_IMPLEMENTED");
 expect((await probe("read",{original:consumed.original})).sessionRevoked).toBe(false);
 // Actual native self-logout service evidence, explicitly NOT administrator revocation.
 await revokeNativeSession(new Request("https://synthetic.invalid/api/native-auth/logout",{headers:{"x-native-session":rotated.sessionId,authorization:`Bearer ${rotated.accessToken}`}}));
 const fresh=await request(),newTokens=await exchange(fresh);expect(newTokens.sessionId).not.toBe(tokens.sessionId);expect(await probe("read",{original:consumed.original})).toMatchObject({sessionRevoked:true,activeSessions:0});expect(await probe("read",{original:fresh.original})).toMatchObject({sessionRevoked:false,activeSessions:1});
 const text=JSON.stringify(await probe("read",{original:fresh.original}));for(const privateValue of [password,tokens.accessToken,tokens.refreshToken,rotated.accessToken,newTokens.accessToken,web.cookieValue])expect(text).not.toContain(privateValue);for(const forbidden of ["passwordHash","secretEnvelope","accessTokenHash","refreshTokenHash","publicSigningKey","detailsJson"])expect(text).not.toContain(forbidden);
 // Explicit negative fixture corruption, not an approval/authentication outcome.
 const freshRow=await db.nativeAuthRequest.findUniqueOrThrow({where:{publicRequestId:fresh.requestId}});await db.nativeAuthRequest.update({where:{id:freshRow.id},data:{userId:f.governanceUserId}});await expect(probe("read",{original:fresh.original})).rejects.toThrow("OWNERSHIP");await db.nativeAuthRequest.update({where:{id:freshRow.id},data:{userId:user.id}});
 const excluded=await db.student.findFirstOrThrow({where:{status:"Inactive"}});await db.student.update({where:{id:excluded.id},data:{status:"Active"}});await expect(probe("read",{original:fresh.original})).rejects.toThrow("OWNERSHIP");await db.student.update({where:{id:excluded.id},data:{status:"Inactive"}});
 const duplicate=await request();await exchange(duplicate);await expect(probe("read",{original:fresh.original})).rejects.toThrow("OWNERSHIP");
},15_000);
