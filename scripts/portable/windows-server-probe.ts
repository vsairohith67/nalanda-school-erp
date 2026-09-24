import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import type {PrismaClient} from "@prisma/client";
import {windowsProbeInput,validateWindowsProbeResult,type WindowsProbeInput} from "./windows-server-contract";
import {assertSyntheticServingTarget,nextTotp,provisionSyntheticMfa,realLogin,privateHttp,syntheticOrigin} from "./acceptance-http";
import {syntheticFeatureCapability} from "../../lib/portable-runtime/synthetic-capability";
import {hashPassword} from "../../lib/password";
import {PERMISSIONS} from "../../lib/permissions";
import {getUserEffectivePermissions} from "../../lib/iam/effective-access";
import {authSecretMatches} from "../../lib/auth-security";

const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
const requireTrue=(value:unknown)=>assert(value,"WINDOWS_PROBE_OWNERSHIP_OR_STATE_REFUSED");
/** Called before client construction AND before every operation. No DB URL is
 * accepted from the parent. Existing serving-process/capability checks own it. */
export function validateWindowsProbeTarget(value:unknown):WindowsProbeInput {
 assertSyntheticServingTarget();
 const parsed=windowsProbeInput.safeParse(value);requireTrue(parsed.success);const input=parsed.data!;
 const cap=syntheticFeatureCapability();requireTrue(cap);
 requireTrue(input.source===cap!.source&&input.runId===cap!.runId&&input.attempt===cap!.attempt&&input.databaseIdentitySha256===cap!.databaseSha256);
 return input;
}
function names(input:WindowsProbeInput){
 const scope=`synthetic-wsp-${digest(`${input.source}:${input.runId}:${input.attempt}:${input.publicDeviceId}`).slice(0,24)}`;
 const marker=`SYNTHETIC Windows ${digest(`${input.iteration}:${input.databaseIdentitySha256}:${input.publicDeviceId}:${input.publicKeyHash}`)}`;
 return {scope,marker};
}
/** Private stdin-only setup/readback. Outcomes are never fixture writes. */
export async function windowsServerProbe(db:PrismaClient,value:unknown){
 const input=validateWindowsProbeTarget(value),{scope,marker}=names(input);
 const actor=async(governance=false)=>{
  const u=await db.user.findUniqueOrThrow({where:{username:scope+(governance?"-governance":"-user")},select:{id:true,username:true,name:true,role:true,isActive:true,lifecycleStatus:true,createdAt:true,authorizationVersion:true,credentialVersion:true}});
  requireTrue(u.name===marker&&(u.role===(governance?"SUPER_ADMIN":"ACCOUNTANT")));return u;
 };
 let result:unknown;
 if(input.operation==="prepare"){
  // Current native reference policy includes ALL active Students. Require an
  // empty eligible population, rather than silently declaring foreign rows out
  // of scope. This driver needs its own fresh admitted synthetic target phase.
  requireTrue(await db.student.count({where:{deletedAt:null,status:"Active"}})===0);
  requireTrue(await db.user.count({where:{OR:[{username:{startsWith:scope}},{name:marker}]}})===0);
  requireTrue(await db.nativeAuthRequest.count({where:{publicDeviceId:input.publicDeviceId}})===0);
  requireTrue(await db.offlineSyncDevice.count({where:{publicDeviceId:input.publicDeviceId}})===0);
  const users=[];
  for(const governance of [false,true]){
   const u=await db.user.create({data:{username:scope+(governance?"-governance":"-user"),name:marker,role:governance?"SUPER_ADMIN":"ACCOUNTANT",passwordHash:await hashPassword(governance?input.governancePassword:input.password),isActive:true,lifecycleStatus:"ACTIVE",mustChangePassword:false}});
   const role=await db.userRoleAssignment.create({data:{userId:u.id,role:u.role,activeKey:`${u.id}:${u.role}`,reason:"SYNTHETIC Windows service preparation"}});
   if(!governance){
    const allowed=new Set(["USE_OFFLINE_SYNC","VIEW_OWN_NOTIFICATIONS"]);
    await db.userPermissionOverride.createMany({data:PERMISSIONS.filter(p=>!allowed.has(p)).map(permission=>({userId:u.id,permission,effect:"DENY",reason:"SYNTHETIC least privilege preparation",createdByUserId:u.id,activeKey:`${u.id}:${permission}`}))});
    const effective=await getUserEffectivePermissions(db,{userId:u.id,roleAssignmentId:role.id});requireTrue(effective.has("USE_OFFLINE_SYNC"));requireTrue([...effective].every(p=>allowed.has(p)));
   }
   await db.authLoginAlias.create({data:{userId:u.id,type:"USERNAME",normalizedValue:u.username,displayMasked:u.username,status:"VERIFIED",verifiedAt:new Date()}});
   await provisionSyntheticMfa(db,u.id);users.push(u);
  }
  for(const suffix of ["one","two","excluded"])await db.student.create({data:{admissionNo:`${scope}-${suffix}`,studentName:`SYNTHETIC Windows ${suffix}`,fatherName:"SYNTHETIC",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className:"VI",status:suffix==="excluded"?"Inactive":"Active"}});
  result={userId:users[0].id,username:users[0].username,governanceUserId:users[1].id,expectedStudents:[scope+"-one",scope+"-two"],databaseIdentitySha256:input.databaseIdentitySha256};
 }else if(input.operation==="totp"){
  const u=await actor();requireTrue(u.isActive&&u.lifecycleStatus==="ACTIVE");
  requireTrue(await db.mfaAuthenticator.count({where:{userId:u.id,type:"TOTP",status:"ACTIVE",verifiedAt:{not:null},revokedAt:null}})===1);
  result={token:await nextTotp(db,u.id)};
 }else{
  const {verifyEd25519Signature,publicJwkHash}=await import("../../lib/offline-sync/device-trust");
  const u=await actor(),url=new URL(input.original);
  requireTrue(url.origin===syntheticOrigin&&url.pathname==="/native/authorize"&&!url.username&&!url.password&&!url.hash);
  requireTrue(JSON.stringify([...url.searchParams.keys()].sort())===JSON.stringify(["challenge","proof","request","state"]));
  const requestId=url.searchParams.get("request")!,state=url.searchParams.get("state")!,challenge=url.searchParams.get("challenge")!,proof=url.searchParams.get("proof")!;
  requireTrue(/^[a-f0-9-]{36}$/.test(requestId)&&/^[\w-]{43}$/.test(state)&&/^[\w-]{43}$/.test(challenge)&&/^[\w-]{86}$/.test(proof));
  const r=await db.nativeAuthRequest.findUniqueOrThrow({where:{publicRequestId:requestId},select:{id:true,publicRequestId:true,publicDeviceId:true,publicKeyHash:true,publicSigningKey:true,platform:true,appId:true,userId:true,webSessionId:true,roleAssignmentId:true,createdAt:true,status:true,expiresAt:true,stateHash:true,challengeHash:true,authorizationCode:{select:{deviceId:true,userId:true,usedAt:true}}}});
  requireTrue(r.publicDeviceId===input.publicDeviceId&&r.publicKeyHash===input.publicKeyHash&&r.platform==="WINDOWS"&&r.appId==="com.nalandaps.erp"&&r.createdAt>=u.createdAt&&(!r.userId||r.userId===u.id));
  requireTrue(publicJwkHash(JSON.parse(r.publicSigningKey))===input.publicKeyHash);
  requireTrue(authSecretMatches(state,"native-app-v1:state",r.stateHash)&&authSecretMatches(challenge,"native-app-v1:challenge",r.challengeHash));
  // Reuse the native protocol message verbatim without importing its singleton
  // Prisma client ahead of admission. This is verification, never code exchange.
  const message=["native-auth-browser-v1",requestId,challenge,state,input.publicDeviceId,input.publicKeyHash].join("\n");
  requireTrue(await verifyEd25519Signature(r.publicSigningKey,message,proof));
  const device=await db.offlineSyncDevice.findUnique({where:{publicDeviceId:input.publicDeviceId},select:{id:true,userId:true,status:true,publicKeyHash:true,keyVersion:true,approvedByUserId:true}});
  if(device)requireTrue(device.userId===u.id&&device.publicKeyHash===input.publicKeyHash);
  if(r.userId){
   requireTrue(r.webSessionId&&r.roleAssignmentId);
   const web=await db.authSession.findUniqueOrThrow({where:{id:r.webSessionId!},select:{userId:true,activeRoleAssignmentId:true}});
   requireTrue(web.userId===u.id&&web.activeRoleAssignmentId===r.roleAssignmentId);
  }else requireTrue(!r.webSessionId&&!r.roleAssignmentId&&!r.authorizationCode);
  if(r.authorizationCode)requireTrue(r.authorizationCode.userId===u.id&&r.authorizationCode.deviceId===device?.id);
  if(input.operation==="approve"){
   requireTrue(r.userId===u.id&&r.status==="DEVICE_APPROVAL_REQUIRED"&&r.expiresAt>new Date()&&device?.status==="PENDING_APPROVAL");
   const gov=await actor(true);requireTrue(gov.isActive&&gov.lifecycleStatus==="ACTIVE");
   const login=await realLogin(db,gov.username,input.governancePassword);
   const response=await privateHttp(syntheticOrigin+`/api/offline-sync/devices/${device!.id}`,{method:"PATCH",headers:{cookie:login.cookie,"content-type":"application/json"},body:JSON.stringify({action:"APPROVE"})});
   requireTrue(response.status===200); // Flag-off/permission/limit errors are failures, not approval proof.
   validateWindowsProbeTarget(input);
   const approved=await db.offlineSyncDevice.findUniqueOrThrow({where:{id:device!.id},select:{status:true,approvedByUserId:true}});
   requireTrue(approved.status==="ACTIVE"&&approved.approvedByUserId===gov.id);
   const events=await db.offlineSyncEvent.findMany({where:{deviceId:device!.id,eventType:"DEVICE_APPROVED"},select:{actorUserId:true},take:2});requireTrue(events.length===1&&events[0].actorUserId===gov.id);
   result={evidenceClass:"SERVICE_GOVERNANCE",deviceId:device!.id,eventCount:1};
  }else{
   // Current schema has no request FK on NativeSession. Only the actual exchange
   // event's explicit request correlation is accepted; time-window guessing is
   // unsafe when the device has authenticated more than once.
   const events=await db.authSecurityEvent.findMany({where:{userId:u.id,eventType:"NATIVE_SESSION_CREATED",subjectType:"NATIVE_SESSION",createdAt:{gte:u.createdAt}},select:{subjectId:true,detailsJson:true},take:101});requireTrue(events.length<=100);
   const correlated=events.filter(e=>{try{return (e.detailsJson?.length??0)<=2048&&JSON.parse(e.detailsJson??"{}").requestId===requestId;}catch{return false;}});requireTrue(correlated.length<=1);
   const session=correlated[0]?.subjectId?await db.nativeSession.findUniqueOrThrow({where:{publicSessionId:correlated[0].subjectId},select:{id:true,publicSessionId:true,userId:true,deviceId:true,roleAssignmentId:true,credentialVersion:true,authorizationVersion:true,revokedAt:true,refreshExpiresAt:true,absoluteExpiresAt:true,tokenVersion:true,refreshHistory:{select:{tokenVersion:true,status:true,reusedAt:true},orderBy:{tokenVersion:"asc"},take:101}}}):null;
   if(session)requireTrue(r.status==="CONSUMED"&&r.authorizationCode?.usedAt&&session.userId===u.id&&session.deviceId===device?.id&&session.roleAssignmentId===r.roleAssignmentId);
   if(r.status==="CONSUMED")requireTrue(session); // Historical uncorrelated sessions fail closed.
   if(input.operation==="revoke-session"){
    requireTrue(session?.publicSessionId===input.sessionId);
    throw Error("WINDOWS_EXACT_SESSION_GOVERNANCE_NOT_IMPLEMENTED");
   }
   const assignments=await db.userRoleAssignment.findMany({where:{userId:u.id,status:"ACTIVE",validFrom:{lte:new Date()},OR:[{validUntil:null},{validUntil:{gt:new Date()}}]},select:{id:true,role:true},take:3});
   const role=assignments.find(a=>a.id===r.roleAssignmentId);
   const permissions=role?await getUserEffectivePermissions(db,{userId:u.id,roleAssignmentId:role.id}):new Set();
   const authorityActive=Boolean(u.isActive&&u.lifecycleStatus==="ACTIVE"&&assignments.length===1&&role?.role==="ACCOUNTANT"&&permissions.has("USE_OFFLINE_SYNC")&&(!session||(session.credentialVersion===u.credentialVersion&&session.authorizationVersion===u.authorizationVersion)));
   if(device&&authorityActive){
    const active=await db.nativeSession.count({where:{deviceId:device.id,userId:u.id,revokedAt:null,credentialVersion:u.credentialVersion,authorizationVersion:u.authorizationVersion,roleAssignmentId:role!.id,refreshExpiresAt:{gt:new Date()},absoluteExpiresAt:{gt:new Date()}}});
    requireTrue(active<=1); // A newer valid session is allowed while reading the old revoked one.
   }
   const students=await db.student.findMany({where:{deletedAt:null,status:"Active"},select:{admissionNo:true,updatedAt:true},take:801});
   const expected=[scope+"-one",scope+"-two"];requireTrue(students.length===2&&students.every(s=>expected.includes(s.admissionNo)));
   const history=session?.refreshHistory??[];requireTrue(history.length<=100&&history.every(h=>h.status==="ROTATED"&&!h.reusedAt));
   if(session){requireTrue(session.tokenVersion>=1&&session.tokenVersion<=101);requireTrue(JSON.stringify(history.map(h=>h.tokenVersion))===JSON.stringify(Array.from({length:session.tokenVersion-1},(_,i)=>i+1)));}
   result={source:input.source,runId:input.runId,attempt:input.attempt,databaseIdentitySha256:input.databaseIdentitySha256,userId:r.userId,deviceId:device?.id??null,publicDeviceId:input.publicDeviceId,requestId,requestStatus:r.status,deviceStatus:device?.status??null,sessionId:session?.publicSessionId??null,sessionRevoked:session?Boolean(session.revokedAt):null,activeSessions:session&&!session.revokedAt&&session.refreshExpiresAt>new Date()&&session.absoluteExpiresAt>new Date()&&device?.status==="ACTIVE"&&authorityActive?1:0,role:role?.role??null,authorityActive,mfaUsed:null,mfaObservation:"NO_SESSION_CHALLENGE_LINK_RECORDED",referenceStudents:students.map(s=>s.admissionNo).sort(),referenceVersion:digest(JSON.stringify(students.map(s=>[s.admissionNo,s.updatedAt.toISOString()]).sort())),referenceObservation:"AVAILABLE_POPULATION_ONLY_NOT_REFRESH_PROOF",tokenVersion:session?.tokenVersion??null,rotatedTokenVersions:history.map(h=>h.tokenVersion)};
  }
 }
 validateWindowsProbeTarget(input);
 return validateWindowsProbeResult(input.operation,result);
}

/** The default factory is the same serving-process singleton; injected factories
 * exist only for contract tests and cannot confer runtime admission. */
export async function executeWindowsProbe(value:unknown,createClient:()=>Promise<PrismaClient>=async()=>(await import("../../lib/prisma")).prisma){
 const input=validateWindowsProbeTarget(value);const db=await createClient();
 try{return await windowsServerProbe(db,input);}finally{await db.$disconnect();}
}
