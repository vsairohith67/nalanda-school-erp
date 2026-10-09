import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,randomUUID,sign} from "node:crypto";
import type {PrismaClient} from "@prisma/client";
import {privateHttp,realLogin,realStepUp,syntheticOrigin} from "./acceptance-http";
import {publicJwkHash} from "../../lib/offline-sync/device-trust";
import {nativeBrowserProofMessage,nativeExchangeProofMessage,pkceChallenge} from "../../lib/native-app/auth";

export type WindowsControl={userId:string;deviceId:string;publicDeviceId:string;requestId:string;sessionId:string;webSessionId:string};
/** Labelled SERVICE_FIXTURE_PREPARATION, never an OS callback. Every outcome is
 * created by the normal authenticated protocol/governance routes. Ephemeral
 * proof keys, browser cookies and returned tokens never leave this invocation. */
export async function prepareWindowsControl(db:PrismaClient,subject:{id:string;username:string},governor:{id:string;username:string},password:string,governancePassword:string,label:string):Promise<WindowsControl>{
 assert(label.startsWith("SYNTHETIC Windows control ")&&label.length<=120);
 assert.equal(await db.offlineSyncDevice.count({where:{userId:subject.id,label}}),0,"WINDOWS_CONTROL_ALREADY_EXISTS");
 const keys=generateKeyPairSync("ed25519"),publicSigningKey=keys.publicKey.export({format:"jwk"}),publicDeviceId=randomUUID(),publicKeyHash=publicJwkHash(publicSigningKey);
 const opaque=()=>randomBytes(32).toString("base64url"),proof=(m:string)=>sign(null,Buffer.from(m),keys.privateKey).toString("base64url");
 const post=(route:string,body:unknown,cookie?:string)=>privateHttp(syntheticOrigin+route,{method:"POST",headers:{"content-type":"application/json",...(cookie?{cookie}:{})},body:JSON.stringify(body)});
 const login=await realLogin(db,subject.username,password);assert.equal(login.userId,subject.id);
 const authorize=async()=>{
  const state=opaque(),nonce=opaque(),verifier=opaque();
  const response=await post("/api/native-auth/request",{appId:"com.nalandaps.erp",appVersion:"0.1.0",redirectUri:"nalandaps-erp://auth/callback",platform:"WINDOWS",deviceLabel:label,publicDeviceId,publicSigningKey,state,nonce,pkceChallenge:pkceChallenge(verifier)});assert.equal(response.status,201);
  const r=await response.json();assert(typeof r.requestId==="string"&&typeof r.challenge==="string");
  const form=new URLSearchParams({request:r.requestId,state,challenge:r.challenge,proof:proof(nativeBrowserProofMessage({publicRequestId:r.requestId,challenge:r.challenge,state,publicDeviceId,publicKeyHash}))});
  const approved=await privateHttp(syntheticOrigin+"/api/native-auth/authorize",{method:"POST",headers:{cookie:login.cookie,"content-type":"application/x-www-form-urlencoded"},body:form.toString()});assert.equal(approved.status,303);
  return {requestId:r.requestId as string,state,nonce,verifier,location:approved.headers.get("location")};
 };
 const pending=await authorize();assert.equal(pending.location,"/native/authorize/result?status=device-approval-required");
 const device=await db.offlineSyncDevice.findUniqueOrThrow({where:{publicDeviceId},select:{id:true,userId:true,status:true,publicKeyHash:true}});assert(device.userId===subject.id&&device.status==="PENDING_APPROVAL"&&device.publicKeyHash===publicKeyHash);
 const gov=await realLogin(db,governor.username,governancePassword);assert.equal(gov.userId,governor.id);
 const approval=await privateHttp(syntheticOrigin+`/api/offline-sync/devices/${device.id}`,{method:"PATCH",headers:{cookie:gov.cookie,"content-type":"application/json"},body:JSON.stringify({action:"APPROVE"})});assert.equal(approval.status,200);
 const r=await authorize();assert(r.location);const callback=new URL(r.location);
 assert(callback.protocol==="nalandaps-erp:"&&callback.host==="auth"&&callback.pathname==="/callback"&&callback.searchParams.get("request")===r.requestId&&callback.searchParams.get("state")===r.state);
 const code=callback.searchParams.get("code")!;
 const exchanged=await post("/api/native-auth/exchange",{requestId:r.requestId,code,verifier:r.verifier,nonce:r.nonce,publicDeviceId,proof:proof(nativeExchangeProofMessage({requestId:r.requestId,code,verifier:r.verifier,nonce:r.nonce,publicDeviceId}))});assert.equal(exchanged.status,200);
 const tokens=await exchanged.json();assert(typeof tokens.sessionId==="string");
 const request=await db.nativeAuthRequest.findUniqueOrThrow({where:{publicRequestId:r.requestId},select:{webSessionId:true,status:true,userId:true}});assert(request.webSessionId&&request.status==="CONSUMED"&&request.userId===subject.id);
 const result={userId:subject.id,deviceId:device.id,publicDeviceId,requestId:r.requestId,sessionId:tokens.sessionId,webSessionId:request.webSessionId};
 await assertWindowsControl(db,result,label);return result;
}
/** Exact records, current eligibility and the real exchange audit; never a
 * global count or a successful control response seeded by the fixture. */
export async function assertWindowsControl(db:PrismaClient,c:WindowsControl,label:string){
 const session=await db.nativeSession.findUniqueOrThrow({where:{publicSessionId:c.sessionId},select:{id:true,userId:true,deviceId:true,revokedAt:true,tokenVersion:true,accessExpiresAt:true,refreshExpiresAt:true,absoluteExpiresAt:true,roleAssignmentId:true,credentialVersion:true,authorizationVersion:true}});
 const device=await db.offlineSyncDevice.findUniqueOrThrow({where:{id:c.deviceId},select:{publicDeviceId:true,userId:true,label:true,status:true,approvedByUserId:true}});
 const user=await db.user.findUniqueOrThrow({where:{id:c.userId},select:{isActive:true,lifecycleStatus:true,credentialVersion:true,authorizationVersion:true}});
 assert(session.userId===c.userId&&session.deviceId===c.deviceId&&!session.revokedAt&&session.tokenVersion===1&&session.refreshExpiresAt>new Date()&&session.absoluteExpiresAt>new Date());
 assert(user.isActive&&user.lifecycleStatus==="ACTIVE"&&user.credentialVersion===session.credentialVersion&&user.authorizationVersion===session.authorizationVersion);
 assert(device.userId===c.userId&&device.publicDeviceId===c.publicDeviceId&&device.label===label&&device.status==="ACTIVE"&&device.approvedByUserId);
 const {getUserEffectivePermissions}=await import("../../lib/iam/effective-access");assert((await getUserEffectivePermissions(db,{userId:c.userId,roleAssignmentId:session.roleAssignmentId})).has("USE_OFFLINE_SYNC"));
 const web=await db.authSession.findUniqueOrThrow({where:{id:c.webSessionId},select:{userId:true,revokedAt:true,expiresAt:true,activeRoleAssignmentId:true}});assert(web.userId===c.userId&&!web.revokedAt&&web.expiresAt>new Date()&&web.activeRoleAssignmentId===session.roleAssignmentId);
 const request=await db.nativeAuthRequest.findUniqueOrThrow({where:{publicRequestId:c.requestId},select:{userId:true,webSessionId:true,publicDeviceId:true,status:true}});assert(request.userId===c.userId&&request.webSessionId===c.webSessionId&&request.publicDeviceId===c.publicDeviceId&&request.status==="CONSUMED");
 const events=await db.authSecurityEvent.findMany({where:{userId:c.userId,eventType:"NATIVE_SESSION_CREATED",subjectType:"NATIVE_SESSION",subjectId:c.sessionId},select:{detailsJson:true},take:2});assert(events.length===1&&JSON.parse(events[0].detailsJson??"{}").requestId===c.requestId);
}
export async function closeWindowsControl(db:PrismaClient,c:WindowsControl,label:string,governor:{id:string;username:string},password:string){
 await assertWindowsControl(db,c,label);
 const {nativeSessionRevocationAction,NATIVE_ADMIN_REVOCATION_EVENT}=await import("../../lib/native-app/session-governance");
 const login=await realLogin(db,governor.username,password);assert.equal(login.userId,governor.id);
 const stepUpToken=await realStepUp(db,login,nativeSessionRevocationAction(c.sessionId));
 const response=await privateHttp(syntheticOrigin+`/api/native-auth/sessions/${c.sessionId}/revoke`,{method:"POST",headers:{cookie:login.cookie,"content-type":"application/json"},body:JSON.stringify({stepUpToken,reason:"SYNTHETIC Windows control teardown"})});assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:"REVOKED"});
 const row=await db.nativeSession.findUniqueOrThrow({where:{publicSessionId:c.sessionId},select:{userId:true,deviceId:true,revokedAt:true,revocationReason:true}});assert(row.userId===c.userId&&row.deviceId===c.deviceId&&row.revokedAt&&row.revocationReason==="SYNTHETIC Windows control teardown");
 const events=await db.authSecurityEvent.findMany({where:{subjectId:c.sessionId,eventType:NATIVE_ADMIN_REVOCATION_EVENT},select:{actorUserId:true},take:2});assert(events.length===1&&events[0].actorUserId===governor.id);
}
