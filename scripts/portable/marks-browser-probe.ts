import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import type {PrismaClient} from "@prisma/client";
import {PERMISSIONS,type Role} from "../../lib/permissions";
import {getUserEffectivePermissions} from "../../lib/iam/effective-access";
import {grantMarksDelegation,revokeMarksDelegation,parseMarksDelegationEnvelope,marksDelegationScopeKey,MARKS_DELEGATION_PERMISSIONS} from "../../lib/academic-integrity";
import {hashPassword} from "../../lib/password";
import {normalizeAliasValue} from "../../lib/auth-identifiers";
import {syntheticFeatureCapability} from "../../lib/portable-runtime/synthetic-capability";
import {assertSyntheticServingTarget,provisionSyntheticMfa,nextTotp} from "./acceptance-http";
import {certificateProbeScope} from "./certificate-browser-probe";
import {prepareMarksHistory} from "./marks-browser-history";
import {checkedRead} from "./http-assertions";

const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
export const marksActorRoles={principal:"PRINCIPAL",reporter:"PRINCIPAL",concurrent:"PRINCIPAL",delegate:"COMPUTER_OPERATOR",revoked:"COMPUTER_OPERATOR",expired:"COMPUTER_OPERATOR",family:"COMPUTER_OPERATOR",teacher:"TEACHER",parent:"PARENT",viewer:"VIEWER",operator:"COMPUTER_OPERATOR"} as const;
export type MarksActor=keyof typeof marksActorRoles;
const delegated=new Set(["delegate","revoked","expired","family"]);
export const marksProbeScope=(input:any,cap:{source:string;runId:string;attempt:string})=>certificateProbeScope(input,cap).replace("synthetic-certificate-browser-","synthetic-mb-");
const username=(scope:string,name:string)=>normalizeAliasValue("USERNAME",`synthetic-mb-${sha(scope).slice(0,20)}-${name}`);
/** PRECONDITIONS / controlled authority transitions / authoritative reads only.
 * No imported mark, approval or report outcome is manufactured here. */
export async function marksBrowserProbe(db:PrismaClient,input:any){
 assertSyntheticServingTarget();const cap=syntheticFeatureCapability();assert(cap);const scope=marksProbeScope(input,cap),code=sha(scope).slice(0,12),className=`MB${code.toUpperCase()}`,year="2026-27";
 const actor=async(name:MarksActor)=>{assert(Object.hasOwn(marksActorRoles,name),"MARKS_ACTOR");const u=await db.user.findUniqueOrThrow({where:{username:username(scope,name)}});assert(u.name===`SYNTHETIC marks ${name}`&&u.role===marksActorRoles[name],"MARKS_ACTOR_OWNERSHIP");return u;};
 if(input.operation==="prepare"){
  assert(typeof input.password==="string"&&input.password.length>=48&&input.password.length<=128,"MARKS_PASSWORD");assert(await db.examCycle.count({where:{examCode:scope.toUpperCase()}})===0,"MARKS_FIXTURE_REUSE_REFUSED");
  const actors:Record<string,any>={};
  for(const [name,role] of Object.entries(marksActorRoles)){
   const guardian=role==="PARENT"||name==="family"?await db.guardian.create({data:{displayName:"SYNTHETIC marks guardian",primaryMobile:"SYNTHETIC-NO-CONTACT"}}):null;
   const u=await db.user.create({data:{username:username(scope,name),iamPublicKey:randomUUID(),name:`SYNTHETIC marks ${name}`,role,passwordHash:await hashPassword(input.password),guardianId:guardian?.id,isActive:true,lifecycleStatus:"ACTIVE",mustChangePassword:false}});
   const assignment=await db.userRoleAssignment.create({data:{userId:u.id,role,activeKey:`${u.id}:${role}`,reason:"SYNTHETIC marks Browser precondition"}});
   const allow=new Set<string>(["VIEW_OWN_NOTIFICATIONS",...(role==="TEACHER"?["VIEW_OWN_EXAM_MARKS"]:[]),...((role==="PRINCIPAL"||delegated.has(name))?MARKS_DELEGATION_PERMISSIONS:[]),...(role==="PRINCIPAL"?["VIEW_EXAM_REPORTS","EXPORT_EXAM_REPORTS","VIEW_REPORT_CARD_REPORTS"]:[])]);
   // Delegates obtain marks permissions exclusively through the real exact-scope
   // profile below. Never add a broad per-user ALLOW to simulate delegation.
   await db.userPermissionOverride.createMany({data:PERMISSIONS.filter(p=>!allow.has(p)).map(permission=>({userId:u.id,permission,effect:"DENY",reason:"SYNTHETIC marks least privilege",createdByUserId:u.id,activeKey:`${u.id}:${permission}`}))});
   await db.authLoginAlias.create({data:{userId:u.id,type:"USERNAME",normalizedValue:u.username,displayMasked:u.username,status:"VERIFIED",verifiedAt:new Date()}});await provisionSyntheticMfa(db,u.id);actors[name]={id:u.id,username:u.username,roleAssignmentId:assignment.id,guardianId:u.guardianId};
  }
  const students=[];
  for(let i=0;i<9;i++){
   const eligible=i<6,sYear=i===6?"2025-26":year,section=i===7?"B":"A";
   const s=await db.student.create({data:{admissionNo:`000${code}${i}`,studentName:`SYNTHETIC MARKS PRIVATE ${code} ${i}`,fatherName:"SYNTHETIC private guardian",phone1:"SYNTHETIC-NO-CONTACT",academicYear:sYear,className,section,status:i===8?"Inactive":"Active",academicYearEnrollments:{create:{academicYear:sYear,className,section,status:i===8?"INACTIVE":"ACTIVE"}}}});students.push({id:s.id,admissionNo:s.admissionNo,studentName:s.studentName,eligible});
  }
  const cls=await db.timetableClassSection.create({data:{academicYear:year,className,section:"A",displayName:scope,groupName:"Synthetic",isActive:true}}),subject=await db.timetableSubject.create({data:{name:scope,shortName:`MB${code}`,department:"Synthetic",isActive:true}});
  const legacy=await db.examCycle.create({data:{examCode:scope.toUpperCase(),academicYear:year,name:`=SYNTHETIC ${code}`,examType:"TERM",startDate:new Date("2026-09-01"),endDate:new Date("2026-09-30"),status:"OPEN_FOR_ENTRY"}});
  const assessments=[];for(const componentName of ["Theory","Other"]){assessments.push(await db.examAssessment.create({data:{examCycleId:legacy.id,academicYear:year,className,section:"A",subjectName:subject.name,timetableSubjectId:subject.id,componentName,assessmentType:"WRITTEN",maxMarks:10,passMarks:4,entryStatus:"OPEN"}}));}
  const tt=await db.timetableTeacher.create({data:{name:`SYNTHETIC ${code}`,shortName:`T${code}`,department:"Synthetic",maxPeriodsPerWeek:30,maxPeriodsPerDay:8,isActive:true}}),staff=await db.staffMember.create({data:{staffCode:scope,fullName:scope,displayName:scope,staffType:"TEACHING",designation:"Teacher",department:"Synthetic",status:"ACTIVE",userId:actors.teacher.id,timetableTeacherId:tt.id}}),timetable=await db.timetableAssignment.create({data:{academicYear:year,classSectionId:cls.id,subjectId:subject.id,teacherId:tt.id,periodsPerWeek:5}});
  const exam=await db.examination.create({data:{examCode:scope.toUpperCase(),academicYear:year,name:`SYNTHETIC governed ${code}`,examType:"TERM",startDate:new Date("2026-09-01"),endDate:new Date("2026-09-30"),status:"ACTIVE",createdByUserId:actors.principal.id,activatedByUserId:actors.principal.id,activatedAt:new Date()}}),classScope=await db.examinationClassScope.create({data:{examinationId:exam.id,academicYear:year,className,section:"A",timetableClassSectionId:cls.id,status:"ACTIVE",createdByUserId:actors.principal.id}}),paper=await db.examSubjectPaper.create({data:{examinationId:exam.id,classScopeId:classScope.id,academicYear:year,className,section:"A",timetableSubjectId:subject.id,subjectNameSnapshot:subject.name,paperCode:"MATH",paperName:"Synthetic Maths",displayOrder:1,status:"ACTIVE",createdByUserId:actors.principal.id}});
  const scheme=await db.examinationSchemeVersion.create({data:{examinationId:exam.id,classScopeId:classScope.id,academicYear:year,className,section:"A",scopeKey:"BASE",versionNumber:1,calculationMode:"RAW_SUM",markDecimalPlaces:2,status:"ACTIVE",createdByUserId:actors.principal.id,activatedByUserId:actors.principal.id,activatedAt:new Date(),frozenAt:new Date(),marksEntryOpenedAt:new Date(),components:{create:["Theory","Other"].map((name,i)=>({componentCode:name.toUpperCase(),name,componentKind:"WRITTEN",displayOrder:i+1,maximumMarks:10,isRequired:true}))}},include:{components:true}});
  const assignments=[];for(const component of scheme.components.sort((a,b)=>a.displayOrder-b.displayOrder))assignments.push(await db.teacherExamAssignment.create({data:{examinationId:exam.id,classScopeId:classScope.id,subjectPaperId:paper.id,componentId:component.id,schemeVersionId:scheme.id,academicYear:year,className,section:"A",staffMemberId:staff.id,timetableTeacherId:tt.id,timetableClassSectionId:cls.id,timetableAssignmentId:timetable.id,assignmentRole:"PRIMARY_SUBMITTER",status:"ACTIVE",assignmentReason:"SYNTHETIC marks Browser precondition",assignedByUserId:actors.principal.id}}));
  const principal=await actor("principal"),validUntil=new Date(Date.now()+86400000).toISOString();
  for(const name of delegated){const u=await actor(name as MarksActor);for(const [kind,targetId] of [["LEGACY_ASSESSMENT",assessments[0].id],["GOVERNED_COMPONENT",assignments[0].id]])await grantMarksDelegation(db,principal as any,{userHandle:u.iamPublicKey,kind,targetId,reason:"SYNTHETIC exact marks Browser scope",validUntil});}
  for(const [name,u] of Object.entries(actors)){const permissions=await getUserEffectivePermissions(db,{userId:u.id,roleAssignmentId:u.roleAssignmentId});for(const p of MARKS_DELEGATION_PERMISSIONS)assert(permissions.has(p)===(marksActorRoles[name as MarksActor]==="PRINCIPAL"||delegated.has(name)||(name==="teacher"&&p==="VIEW_OWN_EXAM_MARKS")),"MARKS_FIXTURE_AUTHORITY");}
  const history=await prepareMarksHistory(db,{scope,className,actorId:principal.id,subjectId:subject.id,students});
  return {history,scope,source:cap.source,runId:cap.runId,attempt:cap.attempt,academicYear:year,examCode:scope.toUpperCase(),examName:legacy.name,className,section:"A",subjectName:subject.name,componentName:"Theory",students:students.filter(s=>s.eligible),excluded:students.filter(s=>!s.eligible),assessmentId:assessments[0].id,otherAssessmentId:assessments[1].id,assignmentId:assignments[0].id,otherAssignmentId:assignments[1].id,schemeId:scheme.id,actors};
 }
 if(input.operation==="totp")return {token:await nextTotp(db,(await actor(input.actor)).id)};
 if(input.operation==="login-evidence"){
  const u=await actor(input.actor),sessions=await db.authSession.findMany({where:{userId:u.id,revokedAt:null,expiresAt:{gt:new Date()}}});assert(sessions.length===1&&sessions[0].authorizationVersion===u.authorizationVersion,"MARKS_REAL_LOGIN");assert(await db.mfaChallenge.count({where:{userId:u.id,type:"LOGIN",usedAt:{not:null}}})===1,"MARKS_REAL_MFA");return {userId:u.id};
 }
 if(input.operation==="revoke"||input.operation==="expire"||input.operation==="link-child"){
  const name=input.operation==="revoke"?"revoked":input.operation==="expire"?"expired":"family",u=await actor(name),grants=await db.userPermissionProfileAssignment.findMany({where:{userId:u.id,status:"ACTIVE"}});assert(grants.length===1,"MARKS_AUTHORITY_PRECONDITION");
  if(input.operation==="revoke")await revokeMarksDelegation(db,await actor("principal") as any,{assignmentHandle:grants[0].publicKey,scopeKey:marksDelegationScopeKey(parseMarksDelegationEnvelope(grants[0].reason)!.grants.find(g=>g.scope.kind==="GOVERNED_COMPONENT")!.scope),reason:"SYNTHETIC controlled authority revocation"});
  if(input.operation==="expire")await db.userPermissionProfileAssignment.update({where:{id:grants[0].id},data:{validFrom:new Date(Date.now()-120000),validUntil:new Date(Date.now()-60000)}});
  if(input.operation==="link-child"){const s=await db.student.findUniqueOrThrow({where:{admissionNo:`000${code}0`}});assert(u.guardianId);await db.studentGuardian.create({data:{guardianId:u.guardianId,studentId:s.id}});}
  return {preparationOnly:true,operation:input.operation};
 }
 if(input.operation==="security-evidence"){const u=await actor(input.actor);return checkedRead(assertSyntheticServingTarget,()=>db.authSecurityEvent.findMany({where:{actorUserId:u.id,eventType:"MARKS_DELEGATION_FAMILY_CONFLICT_DENIED"},orderBy:{id:"asc"}}));}
 if(input.operation==="deny-export"||input.operation==="restore-export"){
  const u=await actor("reporter"),roles=await db.userRoleAssignment.findMany({where:{userId:u.id,status:"ACTIVE"}});assert(roles.length===1,"MARKS_EXPORT_ROLE_PRECONDITION");
  const active=await db.userPermissionOverride.findMany({where:{userId:u.id,permission:"EXPORT_EXAM_REPORTS",status:"ACTIVE"}});
  if(input.operation==="deny-export"){assert(active.length===0,"MARKS_EXPORT_OVERRIDE_REUSE");await db.userPermissionOverride.create({data:{userId:u.id,permission:"EXPORT_EXAM_REPORTS",effect:"DENY",reason:"SYNTHETIC controlled export-permission transition",createdByUserId:(await actor("principal")).id,activeKey:`${u.id}:EXPORT_EXAM_REPORTS`}});}
  else{assert(active.length===1&&active[0].reason==="SYNTHETIC controlled export-permission transition","MARKS_EXPORT_OVERRIDE_OWNERSHIP");await db.userPermissionOverride.update({where:{id:active[0].id},data:{status:"REVOKED",activeKey:null,revokedAt:new Date(),revokedByUserId:(await actor("principal")).id,version:{increment:1}}});}
  assert((await getUserEffectivePermissions(db,{userId:u.id,roleAssignmentId:roles[0].id})).has("EXPORT_EXAM_REPORTS")===(input.operation==="restore-export"),"MARKS_EXPORT_AUTHORITY_TRANSITION");return {preparationOnly:true};
 }
 if(input.operation==="report-evidence")return checkedRead(assertSyntheticServingTarget,async()=>{const actors=await db.user.findMany({where:{username:{in:Object.keys(marksActorRoles).map(n=>username(scope,n))}},select:{id:true}});return db.academicReportRun.findMany({where:{createdByUserId:{in:actors.map(u=>u.id)}},include:{sources:{orderBy:{ordinal:"asc"}},auditEvents:{orderBy:{id:"asc"}}},orderBy:{id:"asc"}});});
 assert(input.operation==="snapshot","MARKS_PROBE_OPERATION");
 return checkedRead(assertSyntheticServingTarget,async()=>{
  const legacy=await db.examCycle.findUniqueOrThrow({where:{examCode:scope.toUpperCase()}}),exam=await db.examination.findUniqueOrThrow({where:{examCode:scope.toUpperCase()}}),assessments=await db.examAssessment.findMany({where:{examCycleId:legacy.id},orderBy:{id:"asc"}}),ids=assessments.map(a=>a.id),sheets=await db.examMarkSheet.findMany({where:{examinationId:exam.id},orderBy:{id:"asc"}});
  const historical=await db.reportCardBatch.findMany({where:{batchNumber:{startsWith:scope+"-"}},include:{reportCards:{include:{versions:{orderBy:{id:"asc"}}},orderBy:{id:"asc"}}},orderBy:{id:"asc"}});
  const history={batches:historical,snapshots:await db.studentResultSnapshot.findMany({where:{calculationRunId:{startsWith:scope+"-"}},orderBy:{id:"asc"}})};
  return {history,scope,source:cap.source,runId:cap.runId,attempt:cap.attempt,assessments,marks:await db.studentMark.findMany({where:{assessmentId:{in:ids}},orderBy:{id:"asc"}}),legacyEvents:await db.studentMarkEvent.findMany({where:{assessmentId:{in:ids}},orderBy:{id:"asc"}}),sheets,entries:await db.examMarkEntry.findMany({where:{sheetId:{in:sheets.map(s=>s.id)}},orderBy:{id:"asc"}}),audits:await db.examinationSchemeAudit.findMany({where:{examinationId:exam.id},orderBy:{id:"asc"}}),results:await db.studentResultSnapshot.findMany({where:{examinationId:exam.id},orderBy:{id:"asc"}})};
 });
}
