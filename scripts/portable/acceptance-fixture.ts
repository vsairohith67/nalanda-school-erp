import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {servedSyntheticDatabase} from "./acceptance-target-database";
import {hashPassword} from "../../lib/password";
import {defaultTemplateDefinition} from "../../lib/certificate-templates";

// Explicitly invoked by admitted hosted QA, never by application startup.
async function main(){
 assert.equal(process.env.NALANDA_SYNTHETIC_STAGING,"true");
 assert.equal(process.env.PORTABLE_ACCEPTANCE_FIXTURE,"production-OFF");
 assert.equal(process.env.NODE_ENV,"production");
 assert(!process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED);
 servedSyntheticDatabase();
 let input="";for await(const chunk of process.stdin){input+=chunk.toString();assert(input.length<=2048);}
 const {password,source}=JSON.parse(input);assert(typeof password==="string"&&password.length>=48&&password.length<=128);assert(/^[a-f0-9]{40}$/.test(source));
 assert.equal(process.env.NALANDA_DEPLOYMENT_ID,`portable-synthetic-${source}`);
 const passwordHash=await hashPassword(password),suffix=randomUUID();
 const db=new PrismaClient();
 try{
  const fixture=await db.$transaction(async tx=>{
   const school=await tx.schoolSettings.findUnique({where:{id:"school"}});
   assert(school&&/synthetic/i.test(school.schoolName),"SYNTHETIC_SCHOOL_MARKER_REQUIRED");
   const user=await tx.user.create({data:{username:`synthetic-1c-${suffix}`,name:"SYNTHETIC HTTP acceptance administrator",role:"SUPER_ADMIN",passwordHash,isActive:true,lifecycleStatus:"ACTIVE",mustChangePassword:false}});
   await tx.userRoleAssignment.create({data:{userId:user.id,role:"SUPER_ADMIN",reason:"SYNTHETIC hosted OFF-state acceptance",activeKey:`${user.id}:SUPER_ADMIN`}});
   await tx.authLoginAlias.create({data:{userId:user.id,type:"USERNAME",normalizedValue:user.username!,displayMasked:user.username!,status:"VERIFIED",verifiedAt:new Date()}});
   const student=await tx.student.create({data:{admissionNo:`SYNTHETIC-1C-${suffix}`,studentName:"SYNTHETIC HTTP Student",fatherName:"SYNTHETIC Guardian",phone1:"SYNTHETIC-NO-CONTACT",academicYear:"2026-27",className:"X",section:"A"}});
   const enrollment=await tx.academicYearEnrollment.create({data:{studentId:student.id,academicYear:"2026-27",className:"X",section:"A",status:"PASSED_OUT"}});
   await tx.studentProgressionDecision.create({data:{studentId:student.id,sourceEnrollmentId:enrollment.id,academicYear:"2026-27",decisionType:"PASSED_OUT",fromClass:"X",toStatus:"Passed Out",status:"FINALIZED",evidenceNotes:"SYNTHETIC school recognition only; no Board certification",finalizedByUserId:user.id,finalizedAt:new Date(),effectiveDate:new Date()}});
   await tx.timetableClassSection.upsert({where:{academicYear_className_section:{academicYear:"2026-27",className:"I",section:"A"}},update:{isActive:true},create:{academicYear:"2026-27",className:"I",section:"A",displayName:"SYNTHETIC I A",groupName:"Synthetic",isActive:true}});
   const template=await tx.certificateTemplate.create({data:{templateCode:`SYNTHETIC-1C-${suffix}`,certificateType:"GRADUATION",name:"SYNTHETIC School Recognition",status:"ACTIVE",academicYear:"2026-27",templateDefinitionJson:JSON.stringify(defaultTemplateDefinition("GRADUATION")),createdByUserId:user.id}});
   const request=await tx.studentCertificateRequest.create({data:{requestNumber:`SYNTHETIC-1C-${suffix}`,studentId:student.id,academicYear:"2026-27",certificateType:"GRADUATION",purpose:"SYNTHETIC school recognition",status:"DRAFT",createdByUserId:user.id}});
   const exam=await tx.examCycle.create({data:{examCode:`SYNTHETIC-1C-${suffix}`,academicYear:"2026-27",name:"SYNTHETIC exam",examType:"TERM",startDate:new Date("2026-09-01"),endDate:new Date("2026-09-30"),status:"OPEN_FOR_ENTRY"}});
   const assessment=await tx.examAssessment.create({data:{examCycleId:exam.id,academicYear:"2026-27",className:"I",section:"A",subjectName:"SYNTHETIC Math",componentName:"Theory",assessmentType:"WRITTEN",maxMarks:10,entryStatus:"OPEN"}});
   return {contract:"NALANDA_INTEGRATED_HTTP_FIXTURE_V1",phase:"production-OFF",source,origin:"https://portable-staging.localhost:8443",username:user.username,studentId:student.id,templateId:template.id,requestId:request.id,assessmentId:assessment.id};
  },{timeout:30_000});
  console.log(JSON.stringify(fixture));
 }finally{await db.$disconnect();}
}
main().catch(()=>{console.error("SYNTHETIC_FIXTURE_FAILED");process.exitCode=1;});
