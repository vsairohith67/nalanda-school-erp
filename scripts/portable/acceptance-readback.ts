import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {PrismaClient, Prisma} from "@prisma/client";
import {servedSyntheticDatabase} from "./acceptance-target-database";
import {assertReadonlyCertificateSession} from '../laptop-lab/consumer-session';

// Built into the scanned application image. Never load a host Prisma client or
// accept a separate connection string as evidence of the HTTP server's state.
async function main(){
 assert.equal(process.env.PORTABLE_ACCEPTANCE_READBACK,"true");
 const connection=servedSyntheticDatabase();
 const encoded=process.argv[2]??"";assert(encoded.length>0&&encoded.length<4096);
 const f=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8"));
 assert(/^synthetic-/.test(f.username));
 const certificateProbe=f.contract==='NPS_CERTIFICATE_PROBE_V1';
 const fixtureBinding=f.contract==='NPS_CERTIFICATE_FIXTURE_BINDING_V1';
 for(const key of certificateProbe?["studentId","userId"]:fixtureBinding?["studentId"]:["studentId","templateId","requestId","assessmentId"])assert(typeof f[key]==="string"&&f[key].length>0&&f[key].length<100);
 if(fixtureBinding){
  assert.equal(Object.keys(f).sort().join(),'consumerRunId,containerId,contract,source,studentId,username');
  assert(/^[a-f0-9]{40}$/.test(f.source)&&/^[a-f0-9]{32}$/.test(f.consumerRunId)&&/^[a-f0-9]{64}$/.test(f.containerId));
  assert.equal(process.env.NALANDA_DEPLOYMENT_ID,'portable-synthetic-'+f.source,'CERTIFICATE_SERVED_SOURCE_MISMATCH');
 }
 if(certificateProbe){
  assert.equal(Object.keys(f).sort().join(),'academicYear,consumerRunId,containerId,contract,databaseIdentitySha256,sessionId,sessionSecretSha256,source,studentId,userId,username');
  assert(/^[a-f0-9]{40}$/.test(f.source)&&/^[a-f0-9]{32}$/.test(f.consumerRunId)&&/^[a-f0-9]{64}$/.test(f.containerId)&&f.academicYear==='2026-27');
  assert.equal(process.env.NALANDA_DEPLOYMENT_ID,'portable-synthetic-'+f.source,'CERTIFICATE_SERVED_SOURCE_MISMATCH');
  assert.equal(createHash('sha256').update(connection.toString()).digest('hex'),f.databaseIdentitySha256,'CERTIFICATE_SERVED_DATABASE_MISMATCH');
 }
 const db=new PrismaClient();
 try{
  const result=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
   const user=await tx.user.findUniqueOrThrow({where:{username:f.username}});
   assert.equal(user.role,"SUPER_ADMIN");assert(user.isActive&&!user.mustChangePassword&&user.lifecycleStatus==="ACTIVE");
   assert((await tx.student.findUniqueOrThrow({where:{id:f.studentId}})).studentName.startsWith("SYNTHETIC"));
   if(fixtureBinding)return {contract:'NPS_CERTIFICATE_FIXTURE_IDENTITY_V1',source:f.source,consumerRunId:f.consumerRunId,containerId:f.containerId,studentId:f.studentId,username:f.username,userId:user.id,academicYear:'2026-27',databaseIdentitySha256:createHash('sha256').update(connection.toString()).digest('hex')};
   if(certificateProbe){
    assert.equal(user.id,f.userId,'CERTIFICATE_SERVED_ACTOR_MISMATCH');
    const session=await tx.authSession.findUnique({where:{id:f.sessionId},include:{user:true}});
    const assignment=session?.activeRoleAssignmentId?await tx.userRoleAssignment.findUnique({where:{id:session.activeRoleAssignmentId}}):null;
    assertReadonlyCertificateSession(session,assignment,{sessionId:f.sessionId,sessionSecretSha256:f.sessionSecretSha256,userId:user.id});
    // GET is global with take250, not a student-filtered endpoint. Require a
    // bounded fixture-only request set and project exactly its served order.
    const rows=await tx.studentCertificateRequest.findMany({orderBy:{createdAt:'desc'},take:251,
     select:{id:true,studentId:true,academicYear:true,certificateType:true,purpose:true,requestedCopies:true,urgency:true,status:true,requestSource:true,createdByUserId:true,requestNumber:true}});
    assert(rows.length<=250&&rows.length===await tx.studentCertificateRequest.count(),'CERTIFICATE_SERVED_ROW_BOUND');
    assert(rows.every(r=>r.studentId===f.studentId&&r.createdByUserId===user.id&&r.requestSource==='INTERNAL'&&r.academicYear===f.academicYear),'CERTIFICATE_SERVED_FOREIGN_ROW');
    const projected=await Promise.all(rows.map(async row=>{
     const createdEvents=await tx.studentCertificateEvent.count({where:{requestId:row.id,eventType:'REQUEST_CREATED'}});
     assert.equal(createdEvents,await tx.studentCertificateEvent.count({where:{requestId:row.id,eventType:'REQUEST_CREATED',newStatus:'SUBMITTED',recordedByUserId:user.id}}),'CERTIFICATE_SERVED_EVENT_MISMATCH');
     return {...row,createdEvents};
    }));
    return {contract:'NPS_CERTIFICATE_READBACK_V1',source:f.source,consumerRunId:f.consumerRunId,containerId:f.containerId,databaseIdentitySha256:createHash('sha256').update(connection.toString()).digest('hex'),userId:user.id,studentId:f.studentId,sessionId:f.sessionId,sessionState:'CURRENT_BOUND',rows:projected};
   }
   assert.equal((await tx.certificateTemplate.findUniqueOrThrow({where:{id:f.templateId}})).certificateType,"GRADUATION");
   const request=await tx.studentCertificateRequest.findUniqueOrThrow({where:{id:f.requestId}});assert.equal(request.studentId,f.studentId);
   await tx.examAssessment.findUniqueOrThrow({where:{id:f.assessmentId}});
   const delegates=[tx.student,tx.payment,tx.studentCertificateRequest,tx.studentCertificate,tx.studentCertificateVersion,tx.studentCertificateEvent,tx.certificateTemplate,tx.certificateNumberSeries,tx.certificateIssueArtifact,tx.certificateRequestCharge,tx.certificateBulkBatch,tx.miscIncomeItem,tx.miscIncomeRate,tx.miscIncomeReceipt,tx.miscIncomeReceiptLine,tx.studentItemReceiptSnapshot,tx.priorYearLiability,tx.priorYearPaymentAttribution,tx.priorYearConcessionCase,tx.priorYearIncomeSupport,tx.priorYearConcessionEvent,tx.studentMark,tx.examMarkEntry];
   const hash=createHash("sha256");
   // Stable sorted JSON transport preserves Decimal/date values and includes
   // requests, sequences, audit events and adjustments as well as issued rows.
   for(const delegate of delegates){const rows=await (delegate as any).findMany({orderBy:{id:"asc"}});hash.update(JSON.stringify(rows));hash.update("\n");}
   return {contract:"NALANDA_HTTP_READBACK_V1",businessSha256:hash.digest("hex"),databaseIdentitySha256:createHash("sha256").update(connection.toString()).digest("hex"),metadata:{authSecurityEvents:await tx.authSecurityEvent.count(),importBatches:await tx.importBatch.count()}};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30_000});
  console.log(JSON.stringify(result));
 }finally{await db.$disconnect();}
}
main().catch(()=>{console.error("SYNTHETIC_READBACK_FAILED");process.exitCode=1;});
