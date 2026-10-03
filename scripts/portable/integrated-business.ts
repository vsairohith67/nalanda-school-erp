import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {PDFDocument} from "pdf-lib";
import type {PrismaClient} from "@prisma/client";
import {hashPassword} from "../../lib/password";
import {defaultTemplateDefinition,GRADUATION_DISCLAIMER} from "../../lib/certificate-templates";
import {priorYearBalance} from "../../lib/prior-year-concessions";
import {allocateFees} from "../../lib/fee-allocation";
import {effectiveActiveSelectedReceiptPayments} from "../../lib/receipt-integrity";
import {assertSyntheticServingTarget,privateHttp,syntheticOrigin,realLogin,realStepUp,provisionSyntheticMfa} from "./acceptance-http";
import {assertVerification,assertDenial,assertEventDelta,assertSingleEffect,checkedRead} from "./http-assertions";
import {decodeCertificateQr} from "./certificate-qr";

const hash=(b:Uint8Array|string)=>createHash("sha256").update(b).digest("hex");
type Actor={userId:string;cookie:string};
/** Every business outcome below is created through a real HTTP route. The
 * supplied client is constructed inside the same admitted serving container. */
export async function integratedBusiness(db:PrismaClient,password:string){
 assertSyntheticServingTarget();const checks:string[]=[];
 const actors:Actor[]=[];
 for(let i=0;i<4;i++){
  const username=`synthetic-business-${i}-${randomUUID()}`;
  const u=await db.user.create({data:{username,name:`SYNTHETIC independent actor ${i}`,role:"SUPER_ADMIN",passwordHash:await hashPassword(password),isActive:true,lifecycleStatus:"ACTIVE",mustChangePassword:false}});
  await db.userRoleAssignment.create({data:{userId:u.id,role:"SUPER_ADMIN",reason:"SYNTHETIC isolated acceptance",activeKey:`${u.id}:SUPER_ADMIN`}});
  await db.authLoginAlias.create({data:{userId:u.id,type:"USERNAME",normalizedValue:username,displayMasked:username,status:"VERIFIED",verifiedAt:new Date()}});
  await provisionSyntheticMfa(db,u.id);actors.push(await realLogin(db,username,password));
 }
 const [prep,review,approve,apply]=actors;
 const parentActor=async(linkedStudentId?:string)=>{
  const guardian=await db.guardian.create({data:{displayName:"SYNTHETIC private guardian",primaryMobile:"SYNTHETIC-NO-CONTACT",...(linkedStudentId?{students:{create:{studentId:linkedStudentId}}}:{})}});
  const username=`synthetic-parent-${randomUUID()}`;
  const user=await db.user.create({data:{username,name:"SYNTHETIC Parent",guardianId:guardian.id,role:"PARENT",passwordHash:await hashPassword(password),isActive:true,lifecycleStatus:"ACTIVE",mustChangePassword:false}});
  await db.userRoleAssignment.create({data:{userId:user.id,role:"PARENT",reason:"SYNTHETIC isolated own-child acceptance",activeKey:`${user.id}:PARENT`}});
  await db.authLoginAlias.create({data:{userId:user.id,type:"USERNAME",normalizedValue:username,displayMasked:username,status:"VERIFIED",verifiedAt:new Date()}});
  await provisionSyntheticMfa(db,user.id);return realLogin(db,username,password);
 };
 const call=(actor:Actor,url:string,body?:unknown)=>privateHttp(syntheticOrigin+url,{method:body===undefined?"GET":"POST",headers:{cookie:actor.cookie,"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const read=<T>(fn:()=>Promise<T>)=>checkedRead(assertSyntheticServingTarget,fn);
 const certificateEvents=()=>read(async()=>{
  const requests=await db.studentCertificateRequest.findMany({where:{studentId:student.id},select:{id:true}});
  const certificates=await db.studentCertificate.findMany({where:{studentId:student.id},select:{id:true}});
  return db.studentCertificateEvent.findMany({where:{OR:[{requestId:{in:requests.map(r=>r.id)}},{certificateId:{in:certificates.map(r=>r.id)}}]},orderBy:{id:"asc"}});
 });
 const json=async(actor:Actor,url:string,body?:unknown):Promise<any>=>{
  const track=url.startsWith("/api/certificates"),before=track?await certificateEvents():[];
  const r=await call(actor,url,body);assert([200,201].includes(r.status),"BUSINESS_HTTP_REFUSED");const result=await r.json();
  if(track){
   const action=(body as {action?:string})?.action,expected:Record<string,unknown>[]=[];
   const actorFields={recordedByUserId:actor.userId};
   if(url==="/api/certificates/requests"&&!before.some(e=>e.requestId===result.request.id))expected.push({...actorFields,requestId:result.request.id,eventType:"REQUEST_CREATED",previousStatus:null,newStatus:"SUBMITTED"});
   else if(/^\/api\/certificates\/requests\/[^/]+\/workflow$/.test(url))expected.push({...actorFields,requestId:url.split("/")[4],eventType:action==="review"?"REQUEST_REVIEWED":"REQUEST_APPROVED",previousStatus:action==="review"?"SUBMITTED":"UNDER_REVIEW",newStatus:action==="review"?"UNDER_REVIEW":"APPROVED"});
   else if(url==="/api/certificates")expected.push({...actorFields,certificateId:result.certificate.id,requestId:result.certificate.requestId,eventType:"CERTIFICATE_CREATED",previousStatus:null,newStatus:"DRAFT"});
   else if(/^\/api\/certificates\/[^/]+\/workflow$/.test(url)){
    const id=url.split("/")[3],rules:Record<string,string[]>={submit:["CERTIFICATE_SUBMITTED","DRAFT","READY_FOR_REVIEW"],approve:["CERTIFICATE_APPROVED","READY_FOR_REVIEW","APPROVED"],issue:["CERTIFICATE_ISSUED","APPROVED","ISSUED"],cancel:["CERTIFICATE_CANCELLED","ISSUED","CANCELLED"]};
    const rule=rules[action??""];
    if(rule&&!(action==="issue"&&before.some(e=>e.certificateId===id&&e.eventType==="CERTIFICATE_ISSUED")))expected.push({...actorFields,certificateId:id,eventType:rule[0],previousStatus:rule[1],newStatus:rule[2]});
    // Reissue creates a linked DRAFT but this contract has no reissue event.
   }
   assertEventDelta(before,await certificateEvents(),expected);
  }
  return result;
 };
 const denied=async(actor:Actor,url:string,body?:unknown)=>{const r=await call(actor,url,body);assert([400,401,403,404,409].includes(r.status),"EXPECTED_BUSINESS_REFUSAL");};
 const student=await db.student.create({data:{admissionNo:`SYNTHETIC-BUSINESS-${randomUUID()}`,studentName:"SYNTHETIC School Recognition Student",fatherName:"SYNTHETIC Guardian",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className:"X",section:"A",discountPercent:12}});
 const enrollment=await db.academicYearEnrollment.create({data:{studentId:student.id,academicYear:"2026-27",className:"X",section:"A",status:"PASSED_OUT"}});
 const old=await db.academicYearEnrollment.create({data:{studentId:student.id,academicYear:"2025-26",className:"IX",section:"A",status:"ACTIVE"}});
 const initialStudent=await db.student.findUniqueOrThrow({where:{id:student.id}});
 const unrelatedChild=await db.student.create({data:{admissionNo:`SYNTHETIC-OTHER-CHILD-${randomUUID()}`,studentName:"SYNTHETIC different family",fatherName:"SYNTHETIC other guardian",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className:"VI"}});
 const ownParent=await parentActor(student.id),otherParent=await parentActor(unrelatedChild.id);
 assert.notEqual((await db.user.findUniqueOrThrow({where:{id:ownParent.userId}})).guardianId,(await db.user.findUniqueOrThrow({where:{id:otherParent.userId}})).guardianId);
 // Existing nonzero current-year obligations/payment are preconditions, never
 // the relief outcome under test. The canonical allocator validates their use.
 const fee=await db.feeStructure.findUnique({where:{academicYear_className:{academicYear:"2026-27",className:"X"}}})??await db.feeStructure.create({data:{academicYear:"2026-27",className:"X",termAmount:500,term1Month:"April",term2Month:"July",term3Month:"October",term4Month:"January"}});
 assert(fee.termAmount>0);
 await db.payment.create({data:{date:new Date("2026-09-01Z"),receiptNo:`SYNTHETIC-EXISTING-${randomUUID()}`,admissionNo:student.admissionNo,studentId:student.id,studentName:student.studentName,className:"X",amountPaid:50,paymentMode:"Cash",receivedAccount:"Cash",feeType:"Current Year Fee"}});
 const currentFeeState=async()=>{const row=await db.student.findUniqueOrThrow({where:{id:student.id}}),payments=await db.payment.findMany({where:{studentId:student.id}});const state=allocateFees(row,fee,await effectiveActiveSelectedReceiptPayments(db,payments));return {annual:state.annualFeeAfterDiscount.toFixed(2),paid:state.totalCurrentYearPaid.toFixed(2),remaining:state.totalPending.toFixed(2)};};
 const startingFeeState=await currentFeeState();assert.equal(startingFeeState.paid,"50.00");
 // Reviewed source evidence is a fixture precondition; issue/charge/relief is not.
 await db.studentProgressionDecision.create({data:{studentId:student.id,sourceEnrollmentId:enrollment.id,academicYear:"2026-27",decisionType:"PASSED_OUT",fromClass:"X",toStatus:"Passed Out",status:"FINALIZED",evidenceNotes:"SYNTHETIC school completion, no Board qualification",finalizedByUserId:review.userId,finalizedAt:new Date(),effectiveDate:new Date()}});
 const template=await db.certificateTemplate.create({data:{templateCode:`SYNTHETIC-${randomUUID()}`,certificateType:"GRADUATION",name:"SYNTHETIC recognition",status:"ACTIVE",academicYear:"2026-27",templateDefinitionJson:JSON.stringify(defaultTemplateDefinition("GRADUATION")),createdByUserId:prep.userId,activatedByUserId:review.userId}});
 await db.certificateNumberSeries.create({data:{seriesCode:`SYNTHETIC-${randomUUID()}`,certificateType:"GRADUATION",academicYear:"2026-27",prefix:"SYNTHETIC-GRAD-",nextNumber:1}});
 const item=await db.miscIncomeItem.create({data:{itemCode:"GRADUATION",name:"SYNTHETIC graduation rate",category:"CERTIFICATE",studentLinkPolicy:"REQUIRED"}});
 await db.miscIncomeRate.create({data:{itemId:item.id,academicYear:"2026-27",amount:"125",notes:"SYNTHETIC rate only"}});
 const preview=await json(prep,"/api/certificates/source-preview",{studentId:student.id,academicYear:"2026-27",certificateType:"GRADUATION",purpose:"SYNTHETIC school recognition only"});assert(preview.preview);
 const input={studentId:student.id,academicYear:"2026-27",certificateType:"GRADUATION",purpose:"SYNTHETIC school recognition only",idempotencyKey:randomUUID()};
 const request=(await json(prep,"/api/certificates/requests",input)).request;
 assert.equal((await json(prep,"/api/certificates/requests",input)).request.id,request.id);
 const requestPath=`/api/certificates/requests/${request.id}`;
 await json(prep,requestPath+"/workflow",{action:"review"});await denied(prep,requestPath+"/workflow",{action:"approve"});await json(review,requestPath+"/workflow",{action:"approve"});
 const charge=(await json(prep,requestPath+"/charge",{action:"prepare"})).charge;
 const preparedCharge=await read(()=>db.certificateRequestCharge.findUniqueOrThrow({where:{requestId:request.id}}));assert.equal(preparedCharge.preparedBy,prep.userId);assert.equal(preparedCharge.status,"PENDING_APPROVAL");assert.equal(preparedCharge.receiptId,null);assert.equal(preparedCharge.approvedBy,null);
 await denied(prep,requestPath+"/charge",{action:"approve",expectedUpdatedAt:charge.updatedAt});
 await json(approve,requestPath+"/charge",{action:"approve",expectedUpdatedAt:charge.updatedAt});
 const approvedCharge=await read(()=>db.certificateRequestCharge.findUniqueOrThrow({where:{requestId:request.id}}));assert.equal(approvedCharge.approvedBy,approve.userId);assert.equal(approvedCharge.status,"APPROVED");assert.equal(approvedCharge.snapshotJson,preparedCharge.snapshotJson);assert.equal(approvedCharge.receiptId,null);
 assert.equal(await db.miscIncomeReceipt.count({where:{studentId:student.id}}),0);
 const payment={action:"collect",receiptDate:new Date().toISOString().slice(0,10),paymentMethod:"CASH"};
 const paid=(await json(approve,requestPath+"/charge",payment)).charge;
 const collected=await read(()=>db.miscIncomeReceipt.findUniqueOrThrow({where:{id:paid.receiptId},include:{lines:true}}));
 assert.equal(collected.createdByUserId,approve.userId);
 const paidCharge=await read(()=>db.certificateRequestCharge.findUniqueOrThrow({where:{requestId:request.id}}));
 assert.equal(paidCharge.preparedBy,prep.userId);assert.equal(paidCharge.approvedBy,approve.userId);assert.equal(paidCharge.studentId,student.id);
 assert.equal(paidCharge.status,"PAID");assert.equal(collected.studentId,student.id);assert.equal(collected.academicYear,"2026-27");assert.equal(collected.lines.length,1);
 const chargeSnapshot=JSON.parse(paidCharge.snapshotJson);assert.equal(collected.lines[0].itemId,chargeSnapshot.itemId);assert.equal(collected.netAmount.toString(),chargeSnapshot.amount);assert.equal(collected.lines[0].quantity,1);
 assert.equal((await json(approve,requestPath+"/charge",payment)).charge.receiptId,paid.receiptId);
 assert.deepEqual(await read(()=>db.miscIncomeReceipt.findUniqueOrThrow({where:{id:paid.receiptId},include:{lines:true}})),collected);
 assert.deepEqual(await read(()=>db.certificateRequestCharge.findUniqueOrThrow({where:{requestId:request.id}})),paidCharge);
 assertSingleEffect(await read(()=>db.miscIncomeReceipt.findMany({where:{studentId:student.id}})),{id:paid.receiptId,createdByUserId:approve.userId,studentId:student.id});
 assert.equal((await db.certificateRequestCharge.findUniqueOrThrow({where:{requestId:request.id}})).receiptId,paid.receiptId);
 const certificate=(await json(prep,"/api/certificates",{...input,requestId:request.id,templateId:template.id})).certificate;
 const cp=`/api/certificates/${certificate.id}`;
 const draftResponse=await call(prep,cp+"/pdf",{});assert.equal(draftResponse.status,200);const draft=await PDFDocument.load(await draftResponse.arrayBuffer());assert.equal(draft.getTitle(),"DRAFT - NOT OFFICIAL");assert(draft.getPageCount()>0);
 await json(prep,cp+"/workflow",{action:"submit"});await denied(prep,cp+"/workflow",{action:"approve"});await json(review,cp+"/workflow",{action:"approve"});
 const receipts=await db.miscIncomeReceipt.count({where:{studentId:student.id}});const beforeIssueEvents=await certificateEvents();
 const concurrent=await Promise.all([call(approve,cp+"/workflow",{action:"issue"}),call(approve,cp+"/workflow",{action:"issue"})]);assert(concurrent.some(r=>r.status===200));assert(concurrent.every(r=>[200,409].includes(r.status)),"ISSUE_CONCURRENCY_UNEXPECTED_FAILURE");
 await json(approve,cp+"/workflow",{action:"issue"});
 assert.equal(await db.studentCertificateVersion.count({where:{certificateId:certificate.id}}),1);
 const artifact=await db.certificateIssueArtifact.findFirstOrThrow({where:{certificateId:certificate.id}});
 const version=await db.studentCertificateVersion.findUniqueOrThrow({where:{id:artifact.versionId}});
 assertSingleEffect(await read(()=>db.studentCertificateVersion.findMany({where:{certificateId:certificate.id}})),{id:artifact.versionId,certificateId:certificate.id,versionNumber:1});
 assertEventDelta(beforeIssueEvents,await certificateEvents(),[{recordedByUserId:approve.userId,certificateId:certificate.id,requestId:request.id,versionId:version.id,eventType:"CERTIFICATE_ISSUED",previousStatus:"APPROVED",newStatus:"ISSUED"}]);
 assert.equal(hash(version.snapshotJson),artifact.snapshotHash);assert(version.snapshotJson.includes(GRADUATION_DISCLAIMER));
 assert.equal(JSON.parse(artifact.renderProvenanceJson).fontFamily,"Georgia Bold");
 const download=await call(prep,cp+"/pdf");assert.equal(download.status,200);const bytes=Buffer.from(await download.arrayBuffer());assert.equal(hash(bytes),artifact.pdfHash);assert((await PDFDocument.load(bytes)).getPageCount()>0);
 const qrToken=await decodeCertificateQr(bytes,assertSyntheticServingTarget);assert(hash(qrToken)===artifact.tokenHash,"QR_ARTIFACT_TOKEN_MISMATCH");
 const sentinels=[student.studentName,student.fatherName,student.phone1,password,prep.cookie,qrToken,"SYNTHETIC private guardian","SYNTHETIC reviewed opening, no cash received","/run/secrets/","pdfBase64","snapshotJson","exactAmountEnvelope"];
 const certificateState=()=>read(async()=>{
  const certificates=await db.studentCertificate.findMany({where:{studentId:student.id},orderBy:{id:"asc"}}),ids=certificates.map(c=>c.id);
  return {certificates,versions:await db.studentCertificateVersion.findMany({where:{certificateId:{in:ids}},orderBy:{id:"asc"}}),artifacts:await db.certificateIssueArtifact.findMany({where:{certificateId:{in:ids}},orderBy:{id:"asc"}}),charges:await db.certificateRequestCharge.findMany({where:{studentId:student.id}}),receipts:await db.miscIncomeReceipt.findMany({where:{studentId:student.id},orderBy:{id:"asc"},include:{lines:{orderBy:{id:"asc"}}}}),payments:await db.payment.findMany({where:{studentId:student.id},orderBy:{id:"asc"}}),events:await certificateEvents()};
 });
 const verify=async(status:string,token=qrToken)=>{
  const before=await certificateState();
  await assertVerification(await call(prep,"/api/certificates/verify",{token}),status==="ISSUED"?{status,authentic:true,certificateType:"GRADUATION",academicYear:"2026-27",issuerKind:"SCHOOL_INSTITUTIONAL"}:{status,authentic:false},sentinels);
  assert.deepEqual(await certificateState(),before);
 };
 await verify("ISSUED");await verify("UNAVAILABLE",randomUUID().replaceAll("-","").padEnd(43,"a"));await verify("UNAVAILABLE",(qrToken[0]==="A"?"B":"A")+qrToken.slice(1));await verify("UNAVAILABLE","malformed-private-reference");
 const verificationDeniedState=await certificateState();
 await assertDenial(await privateHttp(syntheticOrigin+"/api/certificates/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:qrToken})}),401,{error:"Authentication required"},sentinels);
 await assertDenial(await call(ownParent,"/api/certificates/verify",{token:qrToken}),403,{error:"You do not have permission for this action"},sentinels);
 assert.deepEqual(await certificateState(),verificationDeniedState);
 const reprintState=await certificateState();
 const again=await call(prep,cp+"/pdf");assert.equal(again.status,200);assert.equal(hash(Buffer.from(await again.arrayBuffer())),artifact.pdfHash);assert.equal(await db.miscIncomeReceipt.count({where:{studentId:student.id}}),receipts);
 assert.deepEqual(await certificateState(),reprintState);
 const parentPath=`/api/parent/certificates/${certificate.id}/pdf`,ownDownload=await call(ownParent,parentPath);
 assert.equal(ownDownload.status,200);assert.equal(hash(Buffer.from(await ownDownload.arrayBuffer())),artifact.pdfHash);
 // Out-of-band fixture transition, not proof of a relationship governance API.
 const guardianId=(await db.user.findUniqueOrThrow({where:{id:ownParent.userId}})).guardianId!;
 const link=await db.studentGuardian.findUniqueOrThrow({where:{guardianId_studentId:{guardianId,studentId:student.id}}});
 const beforeUnlink=await certificateState();await db.studentGuardian.delete({where:{id:link.id}});
 await assertDenial(await call(ownParent,parentPath),403,{error:"This Student is not linked to the Parent account."},sentinels);
 assert.deepEqual(await certificateState(),beforeUnlink);
 await db.studentGuardian.create({data:link});const restored=await call(ownParent,parentPath);assert.equal(restored.status,200);assert.equal(hash(Buffer.from(await restored.arrayBuffer())),artifact.pdfHash);
 checks.push("H2-parent-link-revoked-stale-session-download-restored");
 await denied(otherParent,parentPath);await denied(ownParent,cp+"/workflow",{action:"issue"});
 const unauthenticated=await privateHttp(syntheticOrigin+parentPath,{method:"GET"});assert.equal(unauthenticated.status,401);
 assert.equal(await db.miscIncomeReceipt.count({where:{studentId:student.id}}),receipts);assert.equal(await db.studentCertificateVersion.count({where:{certificateId:certificate.id}}),1);
 checks.push("certificate-parent-own-child-exact-bytes-cross-child-and-anonymous-denial");
 const revision=(await json(prep,cp+"/workflow",{action:"reissue",reason:"SYNTHETIC replacement with governed review"})).result;
 assert.equal(revision.supersedesCertificateId,certificate.id);assert.equal(revision.status,"DRAFT");
 await json(prep,`/api/certificates/${revision.id}/workflow`,{action:"submit"});await json(review,`/api/certificates/${revision.id}/workflow`,{action:"approve"});await json(approve,`/api/certificates/${revision.id}/workflow`,{action:"issue"});
 await verify("SUPERSEDED");
 await json(approve,cp+"/workflow",{action:"cancel",reason:"SYNTHETIC governed void after replacement"});
 await verify("VOID");checks.push("H1-pdf-qr-reference-authenticated-status-exact-response-privacy");
 assert.equal((await db.studentCertificate.findUniqueOrThrow({where:{id:certificate.id}})).status,"CANCELLED");
 assert.equal((await db.certificateIssueArtifact.findUniqueOrThrow({where:{id:artifact.id}})).pdfHash,artifact.pdfHash);
 assert.equal((await db.studentCertificateVersion.findUniqueOrThrow({where:{id:version.id}})).snapshotJson,version.snapshotJson);
 assert.equal((await db.certificateTemplate.findUniqueOrThrow({where:{id:template.id}})).templateDefinitionJson,template.templateDefinitionJson);
 checks.push("H3-certificate-per-operation-actor-target-transition-idempotent-effects");
 checks.push("certificate-http-preview-charge-idempotency-issue-concurrency-reprint-reissue-void-immutable-readback");

 const itemStudent=await db.student.create({data:{admissionNo:`SYNTHETIC-ITEM-${randomUUID()}`,studentName:"SYNTHETIC Item Student",fatherName:"SYNTHETIC Guardian",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className:"VI",academicYearEnrollments:{create:{academicYear:"2026-27",className:"VI",status:"ACTIVE"}}}});
 const belt=await db.miscIncomeItem.create({data:{itemCode:"BELT",name:"SYNTHETIC Belt",category:"UNIFORM_ACCESSORY",studentLinkPolicy:"REQUIRED"}});
 const rateBody={itemId:belt.id,academicYear:"2026-27",amount:"10.25",effectiveFrom:"2026-04-01",effectiveTo:"2027-03-31",notes:"SYNTHETIC approved dated rate"};
 const rate=(await json(approve,"/api/misc-income/rates",rateBody)).rate;
 const receiptInput={receiptDate:"2026-09-01",academicYear:"2026-27",studentId:itemStudent.id,paymentMethod:"CASH",lines:[{itemId:belt.id,quantity:3}]};
 for(const quantity of [0,-1,1.5,100000000]){const count=await db.miscIncomeReceipt.count();await denied(prep,"/api/misc-income",{...receiptInput,lines:[{itemId:belt.id,quantity}]});assert.equal(await db.miscIncomeReceipt.count(),count);}
 await denied(prep,"/api/misc-income",{...receiptInput,studentId:null});await denied(prep,"/api/misc-income",{...receiptInput,studentId:"SYNTHETIC-NONEXISTENT"});
 const firstReceipt=(await json(prep,"/api/misc-income",receiptInput)).receipt;
 const frozen=await db.studentItemReceiptSnapshot.findUniqueOrThrow({where:{receiptId:firstReceipt.id}});
 assert.equal(frozen.studentId,itemStudent.id);assert.equal(frozen.admissionNo,itemStudent.admissionNo);assert.equal(firstReceipt.netAmount,"30.75");
 const line=JSON.parse(frozen.linesJson)[0];assert.equal(line.quantity,3);assert.equal(line.unitAmount,"10.25");assert.equal(line.rateId,rate.id);
 const changedRate=await privateHttp(syntheticOrigin+"/api/misc-income/rates",{method:"PATCH",headers:{cookie:approve.cookie,"content-type":"application/json"},body:JSON.stringify({...rateBody,id:rate.id,amount:"12.50"})});assert.equal(changedRate.status,200);
 const secondReceipt=(await json(prep,"/api/misc-income",receiptInput)).receipt;assert.equal(secondReceipt.netAmount,"37.5");
 assert.equal((await db.studentItemReceiptSnapshot.findUniqueOrThrow({where:{receiptId:firstReceipt.id}})).linesJson,frozen.linesJson);
 assert.equal((await db.miscIncomeReceipt.findUniqueOrThrow({where:{id:firstReceipt.id}})).netAmount.toFixed(2),"30.75");
 assert.equal((await db.miscIncomeReceipt.findUniqueOrThrow({where:{id:secondReceipt.id}})).netAmount.toFixed(2),"37.50");
 checks.push("student-item-http-exact-link-bounded-quantity-rate-change-frozen-receipt");

 const endpoint="/api/prior-year-concessions";
 const terminal=new Set(["VERIFY","APPROVE","APPLY","REVERSE","REVIEW_REVERSAL"]);
 const concessionEvents=()=>read(()=>db.priorYearConcessionEvent.findMany({where:{liability:{studentId:student.id}},orderBy:{id:"asc"}}));
 const action=async(actor:Actor,name:string,extra:Record<string,unknown>={})=>{
  const body={action:name,requestKey:randomUUID(),reason:"SYNTHETIC governed financial acceptance",...extra,...(terminal.has(name)?{stepUpToken:await realStepUp(db,actor,`PRIOR_YEAR_${name}`)}:{})};
  const before=await concessionEvents(),prior=typeof extra.caseId==="string"?await read(()=>db.priorYearConcessionCase.findUniqueOrThrow({where:{id:extra.caseId as string}})):null;
  const result=await json(actor,endpoint,body);
  const rules:Record<string,[string,string|null,string|null]>={PREPARE_LIABILITY:["ATTRIBUTION_PROPOSED",null,"SOURCE_YEAR_UNVERIFIED"],VERIFY:["ATTRIBUTION_VERIFIED",null,"VERIFIED"],PREPARE:["CASE_PREPARED",null,"DRAFT"],INCOME:["INCOME_SUPPORT_UPDATED",null,"DRAFT"],SUBMIT:["CASE_SUBMITTED","DRAFT","SUBMITTED"],REVIEW:["CASE_UNDER_REVIEW","SUBMITTED","UNDER_REVIEW"],APPROVE:["CASE_APPROVED","UNDER_REVIEW","APPROVED"],REVIEW_REVERSAL:["REVERSAL_REVIEWED",null,null],REVERSE:["RELIEF_REVERSED","APPLIED","REVERSED"]};
  const rule=rules[name];assert(rule,"UNMAPPED_CONCESSION_AUDIT_ACTION");
  if(rule[1])assert.equal(prior?.status,rule[1]);
  const event=await read(()=>db.priorYearConcessionEvent.findUniqueOrThrow({where:{requestKey:body.requestKey}}));
  const liabilityId=prior?.liabilityId??extra.liabilityId??result.liabilityId,caseId=prior?.id??(name==="PREPARE"?result.caseId:null);
  assertEventDelta(before,await concessionEvents(),[{id:result.eventId,actorId:actor.userId,liabilityId,caseId,requestKey:body.requestKey,eventType:rule[0],previousState:rule[1],newState:rule[2]}]);
  assert(/^[a-f0-9]{64}$/.test(event.requestHash));
  if(["PREPARE","APPROVE","REVIEW_REVERSAL","REVERSE"].includes(name))assert.equal(event.amount.toFixed(2),"100.00");
  if(prior&&name!=="REVIEW_REVERSAL"){const after=await read(()=>db.priorYearConcessionCase.findUniqueOrThrow({where:{id:prior.id}}));assert.equal(after.version,prior.version+1);assert.equal(after.status,rule[2]);}
  return result;
 };
 const liabilityInput={studentId:student.id,operatingYear:"2026-27",sourceYear:"2025-26",sourceEnrollmentId:old.id,identityVerified:true,openingAmount:"1000",existingCredits:"50",sourceReferences:["SYNTHETIC-REVIEWED-PRIOR-TERM"],provenance:"SYNTHETIC reviewed opening, no cash received"};
 for(const sourceYear of ["UNKNOWN","2026-27","2027-28","2024-25"]){const count=await db.priorYearLiability.count();await denied(prep,endpoint,{...liabilityInput,sourceYear,action:"PREPARE_LIABILITY",requestKey:randomUUID(),reason:"SYNTHETIC rejected source year"});assert.equal(await db.priorYearLiability.count(),count);}
 const proposed=await action(prep,"PREPARE_LIABILITY",liabilityInput);
 await action(review,"VERIFY",{liabilityId:proposed.liabilityId,expectedVersion:1,identityVerified:true,balanceVerified:true,paymentIds:[]});
 const today=new Date().toISOString().slice(0,10),tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const makeCase=async(kind:string)=>action(prep,"PREPARE",{liabilityId:proposed.liabilityId,kind,requestedAmount:"100",validFrom:today,validTo:tomorrow,applicantReference:"SYNTHETIC governed case"});
 const versionOf=async(id:string)=>(await db.priorYearConcessionCase.findUniqueOrThrow({where:{id}})).version;
 const caseResult=await makeCase("SCHOOL_WAIVER"),caseId=caseResult.caseId;assert(caseId);
 await action(prep,"INCOME",{caseId,expectedVersion:await versionOf(caseId),income:{status:"PROVIDED",exactAnnualAmount:"0.00",period:"ANNUAL",currency:"INR"}});
 const incomePath=`${endpoint}/${caseId}/income`;
 const incomeRead=async(actor:Actor,exact:boolean)=>{const before=await concessionEvents(),result=await json(actor,incomePath+(exact?"?exact=true":""));assertEventDelta(before,await concessionEvents(),[{actorId:actor.userId,caseId,liabilityId:proposed.liabilityId,eventType:exact?"EXACT_INCOME_VIEWED":"INCOME_VIEWED",previousState:null,newState:null}]);return result;};
 assert.equal((await incomeRead(review,false)).exactAnnualAmount,null);assert.equal((await incomeRead(approve,true)).exactAnnualAmount,"0.00");
 const deniedIncome=async(actor:Actor,exact:boolean)=>{const before=await concessionEvents();await assertDenial(await call(actor,incomePath+(exact?"?exact=true":"")),403,{error:"Restricted support unavailable"},sentinels);assertEventDelta(before,await concessionEvents(),[]);};
 await deniedIncome(ownParent,true);await deniedIncome(otherParent,false);
 const restrictedName=`synthetic-income-reviewer-${randomUUID()}`,restrictedUser=await db.user.create({data:{username:restrictedName,name:"SYNTHETIC general income reviewer",role:"ACCOUNTANT",passwordHash:await hashPassword(password),isActive:true,lifecycleStatus:"ACTIVE",mustChangePassword:false}});
 await db.userRoleAssignment.create({data:{userId:restrictedUser.id,role:"ACCOUNTANT",reason:"SYNTHETIC bounded income access",activeKey:`${restrictedUser.id}:ACCOUNTANT`}});
 await db.authLoginAlias.create({data:{userId:restrictedUser.id,type:"USERNAME",normalizedValue:restrictedName,displayMasked:restrictedName,status:"VERIFIED",verifiedAt:new Date()}});
 for(const [permission,effect] of [["VIEW_PRIOR_YEAR_INCOME","ALLOW"],["VIEW_EXACT_PRIOR_YEAR_INCOME","DENY"]])await db.userPermissionOverride.create({data:{userId:restrictedUser.id,permission,effect,reason:"SYNTHETIC exact income boundary",createdByUserId:approve.userId,activeKey:`${restrictedUser.id}:${permission}`}});
 await provisionSyntheticMfa(db,restrictedUser.id);const restricted=await realLogin(db,restrictedName,password);
 assert.equal((await incomeRead(restricted,false)).exactAnnualAmount,null);await deniedIncome(restricted,true);
 const list=await json(prep,endpoint+"?id="+caseId);assert(!JSON.stringify(list).includes("exactAmountEnvelope"));assert(!JSON.stringify(list).includes("exactAnnualAmount"));
 await action(prep,"SUBMIT",{caseId,expectedVersion:await versionOf(caseId)});await action(review,"REVIEW",{caseId,expectedVersion:await versionOf(caseId)});
 let balance=await priorYearBalance(db,proposed.liabilityId);
 const approval={caseId,expectedVersion:await versionOf(caseId),balanceHash:balance.hash,balanceVersion:balance.liability.version,approvedAmount:"100"};
 for(const state of ["expired","revoked"]){
  const token=await realStepUp(db,approve,"PRIOR_YEAR_APPROVE"),id=token.split(".")[0],before=await db.priorYearConcessionCase.findUniqueOrThrow({where:{id:caseId}});
  const beforeDeniedEvents=await concessionEvents();
  await db.stepUpGrant.update({where:{id},data:state==="expired"?{expiresAt:new Date(Date.now()-1)}:{revokedAt:new Date()}});
  const requestKey=randomUUID();await assertDenial(await call(approve,endpoint,{...approval,action:"APPROVE",requestKey,reason:"SYNTHETIC stale authority refusal",stepUpToken:token}),409,{error:"PRIOR_YEAR_STEP_UP_REQUIRED"},sentinels);
  assert.deepEqual(await db.priorYearConcessionCase.findUniqueOrThrow({where:{id:caseId}}),before);assert.equal(await db.priorYearConcessionEvent.count({where:{requestKey}}),0);
  assertEventDelta(beforeDeniedEvents,await concessionEvents(),[]);
 }
 await denied(prep,endpoint,{...approval,action:"APPROVE",reason:"SYNTHETIC self approval refused",requestKey:randomUUID(),stepUpToken:await realStepUp(db,prep,"PRIOR_YEAR_APPROVE")});
 await action(approve,"APPROVE",approval);
 const financialSnapshot=async()=>({payments:hash(JSON.stringify(await db.payment.findMany({orderBy:{id:"asc"}}))),receipts:hash(JSON.stringify(await db.miscIncomeReceipt.findMany({orderBy:{id:"asc"}}))),cash:hash(JSON.stringify(await db.cashBookMovement.findMany({orderBy:{id:"asc"}}))),fees:hash(JSON.stringify(await db.feeStructure.findMany({orderBy:{id:"asc"}}))),student:JSON.stringify(await db.student.findUniqueOrThrow({where:{id:student.id}}))});
 const financialBefore=await financialSnapshot();
 const applyBody={action:"APPLY",requestKey:randomUUID(),reason:"SYNTHETIC single relief under retry",caseId,expectedVersion:await versionOf(caseId),stepUpToken:await realStepUp(db,apply,"PRIOR_YEAR_APPLY")};
 const beforeApply=await concessionEvents();
 const results=await Promise.all([call(apply,endpoint,applyBody),call(apply,endpoint,applyBody)]);assert(results.some(r=>r.status===200));assert(results.every(r=>[200,409].includes(r.status)),"RELIEF_CONCURRENCY_UNEXPECTED_FAILURE");await json(apply,endpoint,applyBody);
 assertEventDelta(beforeApply,await concessionEvents(),[{actorId:apply.userId,caseId,liabilityId:proposed.liabilityId,eventType:"RELIEF_APPLIED",requestKey:applyBody.requestKey,previousState:"APPROVED",newState:"APPLIED"}]);
 assert.equal(await versionOf(caseId),applyBody.expectedVersion+1);
 assert.equal(await db.priorYearConcessionEvent.count({where:{caseId,eventType:"RELIEF_APPLIED"}}),1);
 balance=await priorYearBalance(db,proposed.liabilityId);assert.equal(balance.totals.remaining.toFixed(2),"850.00");
 await action(review,"REVIEW_REVERSAL",{caseId,expectedVersion:await versionOf(caseId),balanceHash:balance.hash,balanceVersion:balance.liability.version});
 await action(approve,"REVERSE",{caseId,expectedVersion:await versionOf(caseId)});
 const events=await db.priorYearConcessionEvent.findMany({where:{caseId,eventType:{in:["RELIEF_APPLIED","RELIEF_REVERSED"]}}});assert.equal(events.length,2);assert.equal(events.find(e=>e.eventType==="RELIEF_REVERSED")!.reversesEventId,events.find(e=>e.eventType==="RELIEF_APPLIED")!.id);
 assert.equal((await priorYearBalance(db,proposed.liabilityId)).totals.remaining.toFixed(2),"950.00");
 assert.deepEqual(await financialSnapshot(),financialBefore);
 assert.deepEqual(await currentFeeState(),startingFeeState);
 assert.equal((await db.student.findUniqueOrThrow({where:{id:student.id}})).discountPercent,initialStudent.discountPercent);
 checks.push("prior-year-http-source-scope-stepup-separation-apply-concurrency-retry-compensating-reversal-no-cash");
 const promise=await makeCase("SPONSORSHIP_PROMISE"),promiseId=promise.caseId;assert(promiseId);
 await action(prep,"SUBMIT",{caseId:promiseId,expectedVersion:await versionOf(promiseId)});await action(review,"REVIEW",{caseId:promiseId,expectedVersion:await versionOf(promiseId)});
 balance=await priorYearBalance(db,proposed.liabilityId);
 await action(approve,"APPROVE",{caseId:promiseId,expectedVersion:await versionOf(promiseId),balanceHash:balance.hash,balanceVersion:balance.liability.version,approvedAmount:"100"});
 const promiseBefore=await read(()=>db.priorYearConcessionCase.findUniqueOrThrow({where:{id:promiseId}})),promiseEvents=await concessionEvents();
 await assertDenial(await call(apply,endpoint,{action:"APPLY",caseId:promiseId,expectedVersion:await versionOf(promiseId),requestKey:randomUUID(),reason:"SYNTHETIC promise is not received money",stepUpToken:await realStepUp(db,apply,"PRIOR_YEAR_APPLY")}),409,{error:"SPONSORSHIP_PROMISE_IS_NOT_MONEY_OR_WAIVER"},sentinels);
 assertEventDelta(promiseEvents,await concessionEvents(),[]);assert.deepEqual(await read(()=>db.priorYearConcessionCase.findUniqueOrThrow({where:{id:promiseId}})),promiseBefore);
 assert.equal((await db.priorYearConcessionCase.findUniqueOrThrow({where:{id:promiseId}})).status,"APPROVED");assert.equal(await db.priorYearConcessionEvent.count({where:{caseId:promiseId,eventType:"RELIEF_APPLIED"}}),0);
 assert.deepEqual(await financialSnapshot(),financialBefore);assert.equal((await priorYearBalance(db,proposed.liabilityId)).totals.remaining.toFixed(2),"950.00");
 assert.deepEqual(await currentFeeState(),startingFeeState);
 checks.push("restricted-exact-income-audit-expired-revoked-stepup-promises-no-fee-cash-payment-mutation");
 checks.push("H3-concession-per-operation-audit-denied-income-idempotent-relief-sponsorship-refusal");
 assertSyntheticServingTarget();return checks;
}
