import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {PDFDocument} from "pdf-lib";
import type {PrismaClient} from "@prisma/client";
import {hashPassword} from "../../lib/password";
import {defaultTemplateDefinition,GRADUATION_DISCLAIMER} from "../../lib/certificate-templates";
import {priorYearBalance} from "../../lib/prior-year-concessions";
import {assertSyntheticServingTarget,privateHttp,syntheticOrigin,realLogin,realStepUp,provisionSyntheticMfa} from "./acceptance-http";

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
 const call=(actor:Actor,url:string,body?:unknown)=>privateHttp(syntheticOrigin+url,{method:body===undefined?"GET":"POST",headers:{cookie:actor.cookie,"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const json=async(actor:Actor,url:string,body?:unknown)=>{const r=await call(actor,url,body);assert([200,201].includes(r.status),"BUSINESS_HTTP_REFUSED");return r.json();};
 const denied=async(actor:Actor,url:string,body?:unknown)=>{const r=await call(actor,url,body);assert([400,401,403,404,409].includes(r.status),"EXPECTED_BUSINESS_REFUSAL");};
 const student=await db.student.create({data:{admissionNo:`SYNTHETIC-BUSINESS-${randomUUID()}`,studentName:"SYNTHETIC School Recognition Student",fatherName:"SYNTHETIC Guardian",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className:"X",section:"A",discountPercent:12}});
 const enrollment=await db.academicYearEnrollment.create({data:{studentId:student.id,academicYear:"2026-27",className:"X",section:"A",status:"PASSED_OUT"}});
 const old=await db.academicYearEnrollment.create({data:{studentId:student.id,academicYear:"2025-26",className:"IX",section:"A",status:"ACTIVE"}});
 const initialStudent=await db.student.findUniqueOrThrow({where:{id:student.id}});
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
 await denied(prep,requestPath+"/charge",{action:"approve",expectedUpdatedAt:charge.updatedAt});
 await json(approve,requestPath+"/charge",{action:"approve",expectedUpdatedAt:charge.updatedAt});
 const payment={action:"collect",receiptDate:new Date().toISOString().slice(0,10),paymentMethod:"CASH"};
 const paid=(await json(approve,requestPath+"/charge",payment)).charge;
 assert.equal((await json(approve,requestPath+"/charge",payment)).charge.receiptId,paid.receiptId);
 assert.equal((await db.certificateRequestCharge.findUniqueOrThrow({where:{requestId:request.id}})).receiptId,paid.receiptId);
 const certificate=(await json(prep,"/api/certificates",{...input,requestId:request.id,templateId:template.id})).certificate;
 const cp=`/api/certificates/${certificate.id}`;
 const draftResponse=await call(prep,cp+"/pdf",{});assert.equal(draftResponse.status,200);const draft=await PDFDocument.load(await draftResponse.arrayBuffer());assert.equal(draft.getTitle(),"DRAFT - NOT OFFICIAL");assert(draft.getPageCount()>0);
 await json(prep,cp+"/workflow",{action:"submit"});await denied(prep,cp+"/workflow",{action:"approve"});await json(review,cp+"/workflow",{action:"approve"});
 const receipts=await db.miscIncomeReceipt.count();
 const concurrent=await Promise.all([call(approve,cp+"/workflow",{action:"issue"}),call(approve,cp+"/workflow",{action:"issue"})]);assert(concurrent.some(r=>r.status===200));
 await json(approve,cp+"/workflow",{action:"issue"});
 assert.equal(await db.studentCertificateVersion.count({where:{certificateId:certificate.id}}),1);
 const artifact=await db.certificateIssueArtifact.findFirstOrThrow({where:{certificateId:certificate.id}});
 const version=await db.studentCertificateVersion.findUniqueOrThrow({where:{id:artifact.versionId}});
 assert.equal(hash(version.snapshotJson),artifact.snapshotHash);assert(version.snapshotJson.includes(GRADUATION_DISCLAIMER));
 assert.equal(JSON.parse(artifact.renderProvenanceJson).fontFamily,"Georgia Bold");
 const download=await call(prep,cp+"/pdf");assert.equal(download.status,200);const bytes=Buffer.from(await download.arrayBuffer());assert.equal(hash(bytes),artifact.pdfHash);assert((await PDFDocument.load(bytes)).getPageCount()>0);
 const again=await call(prep,cp+"/pdf");assert.equal(again.status,200);assert.equal(hash(Buffer.from(await again.arrayBuffer())),artifact.pdfHash);assert.equal(await db.miscIncomeReceipt.count(),receipts);
 const revision=(await json(prep,cp+"/workflow",{action:"reissue",reason:"SYNTHETIC replacement with governed review"})).result;
 assert.equal(revision.supersedesCertificateId,certificate.id);assert.equal(revision.status,"DRAFT");
 await json(prep,`/api/certificates/${revision.id}/workflow`,{action:"submit"});await json(review,`/api/certificates/${revision.id}/workflow`,{action:"approve"});await json(approve,`/api/certificates/${revision.id}/workflow`,{action:"issue"});
 await json(approve,cp+"/workflow",{action:"cancel",reason:"SYNTHETIC governed void after replacement"});
 assert.equal((await db.studentCertificate.findUniqueOrThrow({where:{id:certificate.id}})).status,"CANCELLED");
 assert.equal((await db.certificateIssueArtifact.findUniqueOrThrow({where:{id:artifact.id}})).pdfHash,artifact.pdfHash);
 assert.equal((await db.studentCertificateVersion.findUniqueOrThrow({where:{id:version.id}})).snapshotJson,version.snapshotJson);
 assert.equal((await db.certificateTemplate.findUniqueOrThrow({where:{id:template.id}})).templateDefinitionJson,template.templateDefinitionJson);
 assert((await db.studentCertificateEvent.count({where:{certificateId:certificate.id}}))>=4);
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
 const action=async(actor:Actor,name:string,extra:Record<string,unknown>={})=>{
  const body={action:name,requestKey:randomUUID(),reason:"SYNTHETIC governed financial acceptance",...extra,...(terminal.has(name)?{stepUpToken:await realStepUp(db,actor,`PRIOR_YEAR_${name}`)}:{})};
  const result=await json(actor,endpoint,body);
  const event=await db.priorYearConcessionEvent.findUniqueOrThrow({where:{requestKey:body.requestKey}});assert.equal(event.actorId,actor.userId);assert.equal(event.id,result.eventId);return result;
 };
 const liabilityInput={studentId:student.id,operatingYear:"2026-27",sourceYear:"2025-26",sourceEnrollmentId:old.id,identityVerified:true,openingAmount:"1000",existingCredits:"50",sourceReferences:["SYNTHETIC-REVIEWED-PRIOR-TERM"],provenance:"SYNTHETIC reviewed opening, no cash received"};
 for(const sourceYear of ["UNKNOWN","2026-27","2027-28","2024-25"]){const count=await db.priorYearLiability.count();await denied(prep,endpoint,{...liabilityInput,sourceYear,action:"PREPARE_LIABILITY",requestKey:randomUUID(),reason:"SYNTHETIC rejected source year"});assert.equal(await db.priorYearLiability.count(),count);}
 const proposed=await action(prep,"PREPARE_LIABILITY",liabilityInput);
 await action(review,"VERIFY",{liabilityId:proposed.liabilityId,expectedVersion:1,identityVerified:true,balanceVerified:true,paymentIds:[]});
 const today=new Date().toISOString().slice(0,10),tomorrow=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const makeCase=async(kind:string)=>action(prep,"PREPARE",{liabilityId:proposed.liabilityId,kind,requestedAmount:"100",validFrom:today,validTo:tomorrow,applicantReference:"SYNTHETIC governed case"});
 const versionOf=async(id:string)=>(await db.priorYearConcessionCase.findUniqueOrThrow({where:{id}})).version;
 const caseResult=await makeCase("SCHOOL_WAIVER"),caseId=caseResult.caseId;assert(caseId);
 await action(prep,"SUBMIT",{caseId,expectedVersion:await versionOf(caseId)});await action(review,"REVIEW",{caseId,expectedVersion:await versionOf(caseId)});
 let balance=await priorYearBalance(db,proposed.liabilityId);
 const approval={caseId,expectedVersion:await versionOf(caseId),balanceHash:balance.hash,balanceVersion:balance.liability.version,approvedAmount:"100"};
 await denied(prep,endpoint,{...approval,action:"APPROVE",reason:"SYNTHETIC self approval refused",requestKey:randomUUID(),stepUpToken:await realStepUp(db,prep,"PRIOR_YEAR_APPROVE")});
 await action(approve,"APPROVE",approval);
 const financialBefore={payments:await db.payment.count(),receipts:await db.miscIncomeReceipt.count(),student:JSON.stringify(await db.student.findUniqueOrThrow({where:{id:student.id}}))};
 const applyBody={action:"APPLY",requestKey:randomUUID(),reason:"SYNTHETIC single relief under retry",caseId,expectedVersion:await versionOf(caseId),stepUpToken:await realStepUp(db,apply,"PRIOR_YEAR_APPLY")};
 const results=await Promise.all([call(apply,endpoint,applyBody),call(apply,endpoint,applyBody)]);assert(results.some(r=>r.status===200));await json(apply,endpoint,applyBody);
 assert.equal(await db.priorYearConcessionEvent.count({where:{caseId,eventType:"RELIEF_APPLIED"}}),1);
 balance=await priorYearBalance(db,proposed.liabilityId);assert.equal(balance.totals.remaining.toFixed(2),"850.00");
 await action(review,"REVIEW_REVERSAL",{caseId,expectedVersion:await versionOf(caseId),balanceHash:balance.hash,balanceVersion:balance.liability.version});
 await action(approve,"REVERSE",{caseId,expectedVersion:await versionOf(caseId)});
 const events=await db.priorYearConcessionEvent.findMany({where:{caseId,eventType:{in:["RELIEF_APPLIED","RELIEF_REVERSED"]}}});assert.equal(events.length,2);assert.equal(events.find(e=>e.eventType==="RELIEF_REVERSED")!.reversesEventId,events.find(e=>e.eventType==="RELIEF_APPLIED")!.id);
 assert.equal((await priorYearBalance(db,proposed.liabilityId)).totals.remaining.toFixed(2),"950.00");
 assert.deepEqual({payments:await db.payment.count(),receipts:await db.miscIncomeReceipt.count(),student:JSON.stringify(await db.student.findUniqueOrThrow({where:{id:student.id}}))},financialBefore);
 assert.equal((await db.student.findUniqueOrThrow({where:{id:student.id}})).discountPercent,initialStudent.discountPercent);
 checks.push("prior-year-http-source-scope-stepup-separation-apply-concurrency-retry-compensating-reversal-no-cash");
 assertSyntheticServingTarget();return checks;
}
