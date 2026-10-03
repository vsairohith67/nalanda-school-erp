import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import type {PrismaClient} from "@prisma/client";
import {PERMISSIONS,RECOMMENDED_ROLE_PERMISSIONS,type Role} from "../../lib/permissions";
import {getUserEffectivePermissions} from "../../lib/iam/effective-access";
import {hashPassword} from "../../lib/password";
import {normalizeAliasValue} from "../../lib/auth-identifiers";
import {defaultTemplateDefinition} from "../../lib/certificate-templates";
import {syntheticFeatureCapability} from "../../lib/portable-runtime/synthetic-capability";
import {assertSyntheticServingTarget,provisionSyntheticMfa,nextTotp} from "./acceptance-http";
import {checkedRead} from "./http-assertions";

const sha=(v:string|Buffer)=>createHash("sha256").update(v).digest("hex");
const actorRules={
 preparer:{role:"PRINCIPAL",permissions:["VIEW_CERTIFICATES","MANAGE_CERTIFICATE_REQUESTS","CREATE_CERTIFICATES","REVIEW_CERTIFICATES","APPROVE_CERTIFICATES","CORRECT_ISSUED_CERTIFICATES"]},
 reviewer:{role:"PRINCIPAL",permissions:["VIEW_CERTIFICATES","APPROVE_CERTIFICATES","ISSUE_CERTIFICATES","CANCEL_ISSUED_CERTIFICATES"]},
 financePreparer:{role:"ADMIN",permissions:["VIEW_CERTIFICATES","MANAGE_MISC_INCOME","MANAGE_MISC_INCOME_ITEMS"]},
 financeApprover:{role:"ADMIN",permissions:["VIEW_CERTIFICATES","MANAGE_MISC_INCOME","MANAGE_MISC_INCOME_ITEMS"]},
 parent:{role:"PARENT",permissions:["VIEW_OWN_CHILD_CERTIFICATES","REQUEST_OWN_CHILD_CERTIFICATES"]},
 otherParent:{role:"PARENT",permissions:["VIEW_OWN_CHILD_CERTIFICATES","REQUEST_OWN_CHILD_CERTIFICATES"]},
 low:{role:"TEACHER",permissions:["VIEW_TEACHER_PLACEHOLDER"]}
} as const;
export type CertificateActor=keyof typeof actorRules;
export function certificateActorUsername(scope:string,name:CertificateActor){return normalizeAliasValue("USERNAME",`synthetic-cb-${sha(scope).slice(0,24)}-${name.toLowerCase()}`);}
export function certificateProbeScope(input:any,cap:{source:string;runId:string;attempt:string}){
 assert.equal(input.source,cap.source);assert.equal(input.runId,cap.runId);assert.equal(input.attempt,cap.attempt);
 assert(/^[a-f0-9-]{36}$/.test(input.iteration),"CERTIFICATE_BROWSER_ITERATION_REFUSED");
 return `synthetic-certificate-browser-${sha(`${cap.source}:${cap.runId}:${cap.attempt}:${input.iteration}`).slice(0,24)}`;
}
/** Out-of-band fixture PRECONDITIONS and scoped reads, never outcome writes.
 * Only called by the existing private container pipe after artifact admission. */
export async function certificateBrowserProbe(db:PrismaClient,input:any){
 assertSyntheticServingTarget();const cap=syntheticFeatureCapability();assert(cap);const scope=certificateProbeScope(input,cap);
 const username=(name:CertificateActor)=>certificateActorUsername(scope,name);
 const ownedStudent=()=>db.student.findUniqueOrThrow({where:{admissionNo:scope}});
 const actor=async(name:CertificateActor)=>{assert(Object.hasOwn(actorRules,name));const u=await db.user.findUniqueOrThrow({where:{username:username(name)}});assert.equal(u.name,`SYNTHETIC certificate ${name}`);assert.equal(u.role,actorRules[name].role);return u;};
 if(input.operation==="prepare"){
  assert(typeof input.password==="string"&&input.password.length>=48&&input.password.length<=128);
  assert.equal(await db.student.count({where:{admissionNo:scope}}),0,"CERTIFICATE_BROWSER_FIXTURE_REUSE_REFUSED");
  const users:Record<string,any>={};
  for(const [key,rule] of Object.entries(actorRules)){
   const guardian=rule.role==="PARENT"?await db.guardian.create({data:{displayName:`SYNTHETIC ${key}`,primaryMobile:"SYNTHETIC-NO-CONTACT"}}):null;
   const u=await db.user.create({data:{username:username(key as CertificateActor),name:`SYNTHETIC certificate ${key}`,role:rule.role,passwordHash:await hashPassword(input.password),guardianId:guardian?.id,isActive:true,lifecycleStatus:"ACTIVE",mustChangePassword:false}});
   const assignment=await db.userRoleAssignment.create({data:{userId:u.id,role:rule.role,activeKey:`${u.id}:${rule.role}`,reason:"SYNTHETIC certificate Browser precondition"}});
   const allow=new Set<string>([...rule.permissions,"VIEW_OWN_NOTIFICATIONS"]);
   for(const p of rule.permissions)assert(RECOMMENDED_ROLE_PERMISSIONS[rule.role as Role].has(p as any),"UNSUPPORTED_CERTIFICATE_ACTOR_GRANT");
   await db.userPermissionOverride.createMany({data:PERMISSIONS.filter(p=>!allow.has(p)).map(permission=>({userId:u.id,permission,effect:"DENY",reason:"SYNTHETIC least privilege fixture",createdByUserId:u.id,activeKey:`${u.id}:${permission}`}))});
   const effective=await getUserEffectivePermissions(db,{userId:u.id,roleAssignmentId:assignment.id});for(const p of rule.permissions)assert(effective.has(p as any),"CERTIFICATE_ACTOR_PERMISSION_MISSING");for(const p of effective)assert(allow.has(p),"CERTIFICATE_ACTOR_EXCESS_PERMISSION");
   await db.authLoginAlias.create({data:{userId:u.id,type:"USERNAME",normalizedValue:u.username,displayMasked:u.username,status:"VERIFIED",verifiedAt:new Date()}});
   await provisionSyntheticMfa(db,u.id);users[key]={id:u.id,username:u.username,guardianId:u.guardianId};
  }
  const student=await db.student.create({data:{admissionNo:scope,studentName:`SYNTHETIC CERTIFICATE CANARY ${input.iteration.slice(0,8)}`,fatherName:"SYNTHETIC PRIVATE FAMILY",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className:"X",section:"A"}});
  const other=await db.student.create({data:{admissionNo:scope+"-other",studentName:"SYNTHETIC other child",fatherName:"SYNTHETIC guardian",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className:"IX"}});
  const enrollment=await db.academicYearEnrollment.create({data:{studentId:student.id,academicYear:"2026-27",className:"X",section:"A",status:"PASSED_OUT"}});
  await db.studentProgressionDecision.create({data:{studentId:student.id,sourceEnrollmentId:enrollment.id,academicYear:"2026-27",decisionType:"PASSED_OUT",fromClass:"X",toStatus:"Passed Out",status:"FINALIZED",evidenceNotes:"SYNTHETIC reviewed school completion; no Board qualification",finalizedByUserId:users.reviewer.id,finalizedAt:new Date(),effectiveDate:new Date()}});
  for(const [key,id] of [["parent",student.id],["otherParent",other.id]])await db.studentGuardian.create({data:{guardianId:users[key].guardianId,studentId:id}});
  const template=await db.certificateTemplate.create({data:{templateCode:scope,certificateType:"GRADUATION",name:scope,status:"ACTIVE",academicYear:"2026-27",templateDefinitionJson:JSON.stringify(defaultTemplateDefinition("GRADUATION")),createdByUserId:users.preparer.id,activatedByUserId:users.reviewer.id}});
  // Serial iterations share immutable numbering/rate prerequisites created by
  // the earlier HTTP fixture. Refuse drift; never reset its counter or rate.
  const series=await db.certificateNumberSeries.findMany({where:{certificateType:"GRADUATION",academicYear:"2026-27",status:"ACTIVE",isDefault:true}});assert.equal(series.length,1,"CERTIFICATE_NUMBERING_PRECONDITION");
  const item=await db.miscIncomeItem.findUniqueOrThrow({where:{itemCode:"GRADUATION"},include:{rates:{where:{academicYear:"2026-27",status:"ACTIVE"}}}});assert.equal(item.rates.length,1);assert.equal(item.rates[0].amount.toString(),"125");assert.equal(item.category,"CERTIFICATE");assert.equal(item.studentLinkPolicy,"REQUIRED");
  return {scope,studentId:student.id,otherStudentId:other.id,studentName:student.studentName,academicYear:"2026-27",templateId:template.id,actors:users};
 }
 if(input.operation==="totp")return {token:await nextTotp(db,(await actor(input.actor)).id)};
 if(input.operation==="login-evidence"){
  const u=await actor(input.actor),sessions=await db.authSession.findMany({where:{userId:u.id,revokedAt:null,expiresAt:{gt:new Date()}}});assert.equal(sessions.length,1);
  const assignment=await db.userRoleAssignment.findUniqueOrThrow({where:{id:sessions[0].activeRoleAssignmentId!}});assert.equal(assignment.userId,u.id);assert.equal(assignment.role,u.role);assert.equal(assignment.status,"ACTIVE");
  const challenges=await db.mfaChallenge.findMany({where:{userId:u.id,type:"LOGIN",usedAt:{not:null}}});assert.equal(challenges.length,1);
  assert.equal(sessions[0].authorizationVersion,u.authorizationVersion);return {userId:u.id,role:u.role,activeSessionCount:1,consumedMfaChallengeCount:1};
 }
 if(input.operation==="unlink-parent"||input.operation==="relink-parent"){
  const u=await actor("parent"),s=await ownedStudent();assert(u.guardianId);
  // Explicit test-preparation transition. This is not governance UI evidence.
  if(input.operation==="unlink-parent"){const r=await db.studentGuardian.deleteMany({where:{studentId:s.id,guardianId:u.guardianId}});assert.equal(r.count,1);}
  else{assert.equal(await db.studentGuardian.count({where:{studentId:s.id,guardianId:u.guardianId}}),0);await db.studentGuardian.create({data:{studentId:s.id,guardianId:u.guardianId}});}
  return {preparationOnly:true};
 }
 assert.equal(input.operation,"snapshot");
 return checkedRead(assertSyntheticServingTarget,async()=>{
  const s=await ownedStudent(),requests=await db.studentCertificateRequest.findMany({where:{studentId:s.id},orderBy:{id:"asc"}}),certificates=await db.studentCertificate.findMany({where:{studentId:s.id},orderBy:{id:"asc"}}),ids=certificates.map(c=>c.id);
  const artifacts=await db.certificateIssueArtifact.findMany({where:{certificateId:{in:ids}},orderBy:{id:"asc"}});
  return {scope,studentId:s.id,academicYear:s.academicYear,requests,certificates,charges:await db.certificateRequestCharge.findMany({where:{studentId:s.id},orderBy:{id:"asc"}}),receipts:await db.miscIncomeReceipt.findMany({where:{studentId:s.id},include:{lines:{orderBy:{id:"asc"}}},orderBy:{id:"asc"}}),versions:await db.studentCertificateVersion.findMany({where:{certificateId:{in:ids}},orderBy:{id:"asc"}}),artifacts:artifacts.map(({pdfBase64,renderProvenanceJson,...a})=>({...a,...JSON.parse(renderProvenanceJson),storedPdfHash:sha(Buffer.from(pdfBase64,"base64"))})),events:await db.studentCertificateEvent.findMany({where:{OR:[{certificateId:{in:ids}},{requestId:{in:requests.map(r=>r.id)}}]},orderBy:{id:"asc"}}),payments:await db.payment.findMany({where:{studentId:s.id},orderBy:{id:"asc"}})};
 });
}
