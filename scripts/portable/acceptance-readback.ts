import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {PrismaClient, Prisma} from "@prisma/client";
import {servedSyntheticDatabase} from "./acceptance-target-database";

// Built into the scanned application image. Never load a host Prisma client or
// accept a separate connection string as evidence of the HTTP server's state.
async function main(){
 assert.equal(process.env.PORTABLE_ACCEPTANCE_READBACK,"true");
 const connection=servedSyntheticDatabase();
 const encoded=process.argv[2]??"";assert(encoded.length>0&&encoded.length<4096);
 const f=JSON.parse(Buffer.from(encoded,"base64url").toString("utf8"));
 assert(/^synthetic-/.test(f.username));
 for(const key of ["studentId","templateId","requestId","assessmentId"])assert(typeof f[key]==="string"&&f[key].length>0&&f[key].length<100);
 const db=new PrismaClient();
 try{
  const result=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
   const user=await tx.user.findUniqueOrThrow({where:{username:f.username}});
   assert.equal(user.role,"SUPER_ADMIN");assert(user.isActive&&!user.mustChangePassword&&user.lifecycleStatus==="ACTIVE");
   assert((await tx.student.findUniqueOrThrow({where:{id:f.studentId}})).studentName.startsWith("SYNTHETIC"));
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
