import assert from "node:assert/strict";
import {createHash,randomInt} from "node:crypto";
import type {PrismaClient} from "@prisma/client";
import {PERMISSIONS,type Role} from "../../lib/permissions";
import {getUserEffectivePermissions} from "../../lib/iam/effective-access";
import {hashPassword} from "../../lib/password";
import {normalizeAliasValue} from "../../lib/auth-identifiers";
import {syntheticFeatureCapability} from "../../lib/portable-runtime/synthetic-capability";
import {validatePriorYearPolicy,eligiblePreviousYear} from "../../lib/prior-year-concession-policy";
import {priorYearBalance} from "../../lib/prior-year-concessions";
import {decryptMfaSecret} from "../../lib/real-user-access/crypto";
import {assertSyntheticServingTarget,provisionSyntheticMfa,nextTotp} from "./acceptance-http";
import {certificateProbeScope} from "./certificate-browser-probe";
import {checkedRead} from "./http-assertions";
import {allocateFees} from "../../lib/fee-allocation";
import {effectiveActiveSelectedReceiptPayments} from "../../lib/receipt-integrity";

const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
const view=["VIEW_PRIOR_YEAR_CONCESSIONS","VIEW_LEDGER"];
export const financeActorRules={
 preparer:{role:"ADMIN",permissions:[...view,"PREPARE_PRIOR_YEAR_CONCESSIONS","APPROVE_PRIOR_YEAR_CONCESSIONS","MANAGE_PRIOR_YEAR_INCOME","VIEW_PRIOR_YEAR_INCOME","VIEW_EXACT_PRIOR_YEAR_INCOME","EXPORT_PRIOR_YEAR_CONCESSIONS","EXPORT_PRIOR_YEAR_INCOME","VIEW_MISC_INCOME","MANAGE_MISC_INCOME","MANAGE_MISC_INCOME_ITEMS","CANCEL_MISC_INCOME"]},
 reviewer:{role:"ACCOUNTANT",permissions:[...view,"VERIFY_PRIOR_YEAR_LIABILITIES","REVIEW_PRIOR_YEAR_CONCESSIONS","REVERSE_PRIOR_YEAR_CONCESSIONS"]},
 approver:{role:"DIRECTOR",permissions:[...view,"APPROVE_PRIOR_YEAR_CONCESSIONS","REVERSE_PRIOR_YEAR_CONCESSIONS"]},
 applier:{role:"ACCOUNTANT",permissions:[...view,"APPLY_PRIOR_YEAR_CONCESSIONS"]},
 general:{role:"ACCOUNTANT",permissions:[...view,"VIEW_PRIOR_YEAR_INCOME","EXPORT_PRIOR_YEAR_CONCESSIONS","VIEW_MISC_INCOME"]},
 parent:{role:"PARENT",permissions:[]},teacher:{role:"TEACHER",permissions:[]},viewer:{role:"VIEWER",permissions:["VIEW_MISC_INCOME"]}
} as const;
export type FinanceActor=keyof typeof financeActorRules;
export function financeProbeScope(input:any,cap:{source:string;runId:string;attempt:string}){return certificateProbeScope(input,cap).replace("synthetic-certificate-browser-","synthetic-fb-");}
export const financeUsername=(scope:string,name:FinanceActor)=>normalizeAliasValue("USERNAME",`synthetic-fb-${sha(scope).slice(0,24)}-${name}`);
/** The existing admitted private stdin probe only. Mutations are PRECONDITIONS
 * or explicitly labelled authority/failure setup, never the tested outcomes. */
export async function financeBrowserProbe(db:PrismaClient,input:any){
 assertSyntheticServingTarget();const cap=syntheticFeatureCapability();assert(cap);const scope=financeProbeScope(input,cap),policy=validatePriorYearPolicy();
 assert(eligiblePreviousYear("2026-27","2025-26",policy)&&policy.incomeBands.some(b=>b.id==="SYNTHETIC_ONLY"),"FINANCE_SYNTHETIC_POLICY_REQUIRED");
 const settings=await db.schoolSettings.findUniqueOrThrow({where:{id:"school"}});assert(settings.academicYear==="2026-27","FINANCE_OPERATING_YEAR");
 const student=()=>db.student.findUniqueOrThrow({where:{admissionNo:scope}});
 const actor=async(name:FinanceActor)=>{assert(Object.hasOwn(financeActorRules,name),"FINANCE_ACTOR_UNKNOWN");const u=await db.user.findUniqueOrThrow({where:{username:financeUsername(scope,name)}});assert(u.name===`SYNTHETIC finance ${name}`&&u.role===financeActorRules[name].role,"FINANCE_FOREIGN_ACTOR");return u;};
 if(input.operation==="prepare"){
  assert(typeof input.password==="string"&&input.password.length>=48&&input.password.length<=128,"FINANCE_PASSWORD_PRECONDITION");assert(Number.isInteger(input.matrixIndex)&&input.matrixIndex>=0&&input.matrixIndex<6,"FINANCE_MATRIX_BINDING");assert(await db.student.count({where:{admissionNo:{startsWith:scope}}})===0,"FINANCE_FIXTURE_REUSE_REFUSED");
  const users:Record<string,any>={};
  for(const [name,rule] of Object.entries(financeActorRules)){
   const guardian=rule.role==="PARENT"?await db.guardian.create({data:{displayName:"SYNTHETIC finance guardian",primaryMobile:"SYNTHETIC-NO-CONTACT"}}):null;
   const u=await db.user.create({data:{username:financeUsername(scope,name as FinanceActor),name:`SYNTHETIC finance ${name}`,role:rule.role as Role,passwordHash:await hashPassword(input.password),guardianId:guardian?.id,isActive:true,lifecycleStatus:"ACTIVE",mustChangePassword:false}});
   const assignment=await db.userRoleAssignment.create({data:{userId:u.id,role:rule.role,activeKey:`${u.id}:${rule.role}`,reason:"SYNTHETIC isolated finance preconditions"}});
   const allow=new Set<string>([...rule.permissions,"VIEW_OWN_NOTIFICATIONS"]);for(const p of allow)assert((PERMISSIONS as readonly string[]).includes(p),"FINANCE_UNKNOWN_PERMISSION");
   await db.userPermissionOverride.createMany({data:PERMISSIONS.map(permission=>({userId:u.id,permission,effect:allow.has(permission)?"ALLOW":"DENY",reason:"SYNTHETIC explicit least privilege finance assignment",createdByUserId:u.id,activeKey:`${u.id}:${permission}`}))});
   const effective=await getUserEffectivePermissions(db,{userId:u.id,roleAssignmentId:assignment.id});assert([...effective].every(p=>allow.has(p)),"FINANCE_EXCESS_PERMISSION");for(const p of allow)assert(effective.has(p as any),`FINANCE_MISSING_PERMISSION_${name}_${p}`);
   await db.authLoginAlias.create({data:{userId:u.id,type:"USERNAME",normalizedValue:u.username,displayMasked:u.username,status:"VERIFIED",verifiedAt:new Date()}});await provisionSyntheticMfa(db,u.id);users[name]={id:u.id,username:u.username,assignmentId:assignment.id};
  }
  const className=`SYNTHETIC-FB-${sha(scope).slice(0,8)}`;
  await db.feeStructure.create({data:{academicYear:"2026-27",className,termAmount:1000,term1Month:"June",term2Month:"September",term3Month:"December",term4Month:"March"}});
  const s=await db.student.create({data:{admissionNo:scope,studentName:`SYNTHETIC FINANCE PRIVATE ${sha(scope).slice(0,8)}`,fatherName:"SYNTHETIC private family",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className,section:"A",discountPercent:10,academicYearEnrollments:{create:[{academicYear:"2025-26",className,section:"A",status:"ACTIVE"},{academicYear:"2026-27",className,section:"A",status:"ACTIVE"}]}}});
  const wrong=await db.student.create({data:{admissionNo:scope+"-wrong",studentName:"SYNTHETIC wrong year",fatherName:"SYNTHETIC",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className,academicYearEnrollments:{create:{academicYear:"2025-26",className}}}});
  const stale=await db.student.create({data:{admissionNo:scope+"-stale",studentName:"SYNTHETIC stale enrollment",fatherName:"SYNTHETIC",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className,academicYearEnrollments:{create:{academicYear:"2026-27",className}}}});
  const enrollment=await db.academicYearEnrollment.findUniqueOrThrow({where:{studentId_academicYear:{studentId:s.id,academicYear:"2025-26"}}});
  const payments=[];for(const [label,amountPaid,feeType] of [["prior",200,"Old Due"],["current",100,"Current Year Fee"]] as const)payments.push(await db.payment.create({data:{receiptNo:scope+"-"+label,studentId:s.id,admissionNo:s.admissionNo,studentName:s.studentName,className,amountPaid,feeType,date:new Date("2026-05-01T00:00:00Z"),paymentMode:"Cash",receivedAccount:"Cash"}}));
  // TIE is a designated code. Iterations are deliberately serial and use
  // disjoint dated rates. Existing foreign configuration is never overwritten.
  let item=await db.miscIncomeItem.findUnique({where:{itemCode:"TIE"}});
  if(!item)item=await db.miscIncomeItem.create({data:{itemCode:"TIE",name:"SYNTHETIC FINANCE BROWSER TIE",category:"UNIFORM_ACCESSORY",studentLinkPolicy:"REQUIRED",description:`SYNTHETIC finance ${cap.source}:${cap.runId}:${cap.attempt}`}});
  assert(item.name==="SYNTHETIC FINANCE BROWSER TIE"&&item.description===`SYNTHETIC finance ${cap.source}:${cap.runId}:${cap.attempt}`&&item.status==="ACTIVE"&&item.studentLinkPolicy==="REQUIRED","FINANCE_FOREIGN_ITEM");
  const date=(offset:number)=>`2026-05-${String(1+input.matrixIndex*4+offset).padStart(2,"0")}`,firstDate=date(0),secondDate=date(1),missingDate=date(2);
  assert(await db.miscIncomeRate.count({where:{itemId:item.id,status:"ACTIVE",OR:[{effectiveFrom:null},{effectiveFrom:{lte:new Date(secondDate)},OR:[{effectiveTo:null},{effectiveTo:{gte:new Date(firstDate)}}]}]}})===0,"FINANCE_FOREIGN_RATE");
  const rate=await db.miscIncomeRate.create({data:{itemId:item.id,academicYear:"2026-27",amount:"10.25",effectiveFrom:new Date(firstDate),effectiveTo:new Date(firstDate),notes:scope}});
  return {scope,studentId:s.id,studentName:s.studentName,sourceEnrollmentId:enrollment.id,academicYear:"2026-27",sourceYear:"2025-26",wrongStudentId:wrong.id,staleStudentId:stale.id,priorPaymentId:payments[0].id,itemId:item.id,firstRateId:rate.id,firstDate,secondDate,missingDate,actors:users,incomeCanary:`${randomInt(100000,999999)}.${randomInt(10,99)}`,longReason:"SYNTHETIC evidence "+"reviewed-source-".repeat(38)};
 }
 if(input.operation==="totp")return {token:await nextTotp(db,(await actor(input.actor)).id)};
 if(input.operation==="login-evidence"){
  const u=await actor(input.actor),sessions=await db.authSession.findMany({where:{userId:u.id,revokedAt:null,expiresAt:{gt:new Date()}}});assert(sessions.length===1,"FINANCE_LOGIN_SESSION");const role=await db.userRoleAssignment.findUniqueOrThrow({where:{id:sessions[0].activeRoleAssignmentId!}});assert(role.status==="ACTIVE"&&role.userId===u.id&&sessions[0].authorizationVersion===u.authorizationVersion,"FINANCE_LOGIN_AUTHORITY");assert(await db.mfaChallenge.count({where:{userId:u.id,type:"LOGIN",usedAt:{not:null}}})===1,"FINANCE_LOGIN_MFA");return {userId:u.id};
 }
 if(input.operation==="stale-enrollment"){
  const s=await db.student.findUniqueOrThrow({where:{admissionNo:scope+"-stale"}});const r=await db.academicYearEnrollment.updateMany({where:{studentId:s.id,academicYear:"2026-27",status:"ACTIVE"},data:{status:"TRANSFERRED"}});assert(r.count===1,"FINANCE_STALE_SETUP_REUSED");return {preparationOnly:true};
 }
 if(input.operation==="revoke-reviewer"){
  const u=await actor("reviewer"),roles=await db.userRoleAssignment.findMany({where:{userId:u.id,status:"ACTIVE"}});assert(roles.length===1&&u.role==="ACCOUNTANT"&&u.isActive,"FINANCE_REVOCATION_PRECONDITION");
  await db.$transaction(async tx=>{await tx.userRoleAssignment.update({where:{id:roles[0].id},data:{status:"REVOKED",activeKey:null,endedAt:new Date(),endedByUserId:(await actor("approver")).id,version:{increment:1}}});await tx.user.update({where:{id:u.id},data:{authorizationVersion:{increment:1}}});});return {preparationOnly:true,removedGrant:true,userRemainsActive:true};
 }
 if(input.operation==="received-payment-precondition"){
  const s=await student();assert(await db.payment.count({where:{receiptNo:scope+"-additional"}})===0,"FINANCE_PAYMENT_SETUP_REUSED");
  const p=await db.payment.create({data:{receiptNo:scope+"-additional",studentId:s.id,admissionNo:s.admissionNo,studentName:s.studentName,className:s.className,amountPaid:25,feeType:"Old Due",date:new Date("2026-05-01T00:00:00Z"),paymentMode:"Cash",receivedAccount:"Cash"}});return {preparationOnly:true,paymentId:p.id};
 }
 assert(input.operation==="snapshot","FINANCE_PROBE_OPERATION");
 return checkedRead(assertSyntheticServingTarget,async()=>{
  const s=await student(),students=await db.student.findMany({where:{admissionNo:{startsWith:scope}},orderBy:{id:"asc"}}),ids=students.map(s=>s.id),users=await db.user.findMany({where:{username:{in:Object.keys(financeActorRules).map(n=>financeUsername(scope,n as FinanceActor))}},select:{id:true}}),actors=users.map(u=>u.id);
  const liabilities=await db.priorYearLiability.findMany({where:{studentId:{in:ids}},orderBy:{id:"asc"}}),lids=liabilities.map(l=>l.id),cases=await db.priorYearConcessionCase.findMany({where:{liabilityId:{in:lids}},orderBy:{id:"asc"}}),cids=cases.map(c=>c.id),balances=[];
  for(const l of liabilities){try{const b=await priorYearBalance(db,l.id);balances.push({liabilityId:l.id,status:"VERIFIED",remaining:b.totals.remaining.toFixed(2),opening:b.totals.opening.toFixed(2),payments:b.totals.payments.toFixed(2),credits:b.totals.existingCredits.toFixed(2),relief:b.totals.appliedRelief.toFixed(2),reversals:b.totals.reversals.toFixed(2),hash:b.hash,version:l.version});}catch(e){const code=e instanceof Error?e.message:"";assert(["SOURCE_YEAR_UNVERIFIED","OLD_DUE_PAYMENT_ATTRIBUTION_REQUIRED"].includes(code),"FINANCE_UNEXPECTED_BALANCE_ERROR");balances.push({liabilityId:l.id,status:code});}}
  const income=await db.priorYearIncomeSupport.findMany({where:{caseId:{in:cids}},orderBy:{id:"asc"}});
  const fee=await db.feeStructure.findUniqueOrThrow({where:{academicYear_className:{academicYear:s.academicYear,className:s.className}}}),payments=await db.payment.findMany({where:{studentId:{in:ids}},orderBy:{id:"asc"}}),allocation=allocateFees(s,fee,await effectiveActiveSelectedReceiptPayments(db,payments.filter(p=>p.studentId===s.id)));
  const currentYear={annual:allocation.annualFeeAfterDiscount.toFixed(2),paid:allocation.totalCurrentYearPaid.toFixed(2),remaining:allocation.totalPending.toFixed(2)};
  return {scope,studentId:s.id,academicYear:s.academicYear,students,enrollments:await db.academicYearEnrollment.findMany({where:{studentId:{in:ids}},orderBy:{id:"asc"}}),fees:[fee],currentYear,payments,receipts:await db.miscIncomeReceipt.findMany({where:{studentId:{in:ids}},include:{studentSnapshot:true,lines:{orderBy:{id:"asc"}}},orderBy:{id:"asc"}}),liabilities,cases,balances,events:await db.priorYearConcessionEvent.findMany({where:{liabilityId:{in:lids}},orderBy:{id:"asc"}}),attributions:await db.priorYearPaymentAttribution.findMany({where:{liabilityId:{in:lids}},orderBy:{id:"asc"}}),income:income.map(({exactAmountEnvelope,...row})=>({...row,encrypted:!!exactAmountEnvelope,exactAnnualAmount:exactAmountEnvelope?decryptMfaSecret(exactAmountEnvelope,`prior-year-income:${row.caseId}`):null})),cashDays:await db.cashBookDay.findMany({where:{createdByUserId:{in:actors}},orderBy:{id:"asc"}}),cash:await db.cashBookMovement.findMany({where:{recordedByUserId:{in:actors}},orderBy:{id:"asc"}}),rates:await db.miscIncomeRate.findMany({where:{notes:scope},orderBy:{id:"asc"}})};
 });
}
