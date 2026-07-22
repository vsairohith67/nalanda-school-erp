import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { defaultTemplateDefinition } from "../lib/certificate-templates";
import { snapshotHash } from "../lib/certificate-snapshots";
import { restoreCertificateData } from "../lib/restore-database";

const P="QA18A",YEAR="2026-27",PASSWORD="Qa18aCert@2026";
async function cleanup(){
 const certs=await prisma.studentCertificate.findMany({where:{OR:[{certificateNumber:{startsWith:P}},{draftDataJson:{contains:P}}]},select:{id:true}}),certIds=certs.map(x=>x.id);
 const reqs=await prisma.studentCertificateRequest.findMany({where:{OR:[{requestNumber:{startsWith:P}},{purpose:{contains:P}},{studentId:{startsWith:"qa18a-"}}]},select:{id:true}}),reqIds=reqs.map(x=>x.id);
 await prisma.studentCertificateEvent.deleteMany({where:{OR:[{certificateId:{in:certIds}},{requestId:{in:reqIds}},{reason:{contains:P}}]}});
 await prisma.studentCertificateVersion.deleteMany({where:{certificateId:{in:certIds}}});
 await prisma.studentCertificate.deleteMany({where:{id:{in:certIds}}});
 await prisma.studentCertificateRequest.deleteMany({where:{id:{in:reqIds}}});
 await prisma.certificateTemplate.deleteMany({where:{templateCode:{startsWith:P}}});
 await prisma.certificateNumberSeries.deleteMany({where:{seriesCode:{startsWith:P}}});
 await prisma.studentProgressionDecision.deleteMany({where:{student:{admissionNo:{startsWith:P}}}});
 await prisma.studentAttendanceSession.deleteMany({where:{notes:{startsWith:P}}});
 await prisma.academicYearEnrollment.deleteMany({where:{student:{admissionNo:{startsWith:P}}}});
 await prisma.user.deleteMany({where:{username:{startsWith:"qa18a-"}}});
 await prisma.studentGuardian.deleteMany({where:{guardian:{displayName:{startsWith:P}}}});
 await prisma.guardian.deleteMany({where:{displayName:{startsWith:P}}});
 await prisma.student.deleteMany({where:{admissionNo:{startsWith:P}}});
}
async function setup(){
 await cleanup();const passwordHash=await hashPassword(PASSWORD);
 const guardian=await prisma.guardian.create({data:{id:"qa18a-guardian",displayName:"QA18A Parent Guardian",primaryMobile:"9000001818",relationship:"Parent"}});
 const users=await Promise.all(["DIRECTOR","PRINCIPAL","ADMIN","VIEWER","ACCOUNTANT","TEACHER","PARENT"].map(role=>prisma.user.create({data:{id:`qa18a-user-${role.toLowerCase()}`,name:`QA18A ${role}`,username:`qa18a-${role.toLowerCase()}`,passwordHash,role,guardianId:role==="PARENT"?guardian.id:null}})));
 const principal=users.find(u=>u.role==="PRINCIPAL")!;
 const students=await Promise.all([
  prisma.student.create({data:{id:"qa18a-student-linked",admissionNo:"QA18A-ADM-001",studentName:"QA18A Linked Student",fatherName:"QA18A Father",motherName:"QA18A Mother",className:"Class 7",section:"A",phone1:"9000000001",dateOfBirth:new Date("2014-05-10"),status:"Active"}}),
  prisma.student.create({data:{id:"qa18a-student-unrelated",admissionNo:"QA18A-ADM-002",studentName:"QA18A Unrelated Student",fatherName:"QA18A Other Father",className:"Class 8",section:"B",phone1:"9000000002",dateOfBirth:new Date("2013-04-11"),status:"Active"}})
 ]);
 await prisma.studentGuardian.create({data:{id:"qa18a-link",guardianId:guardian.id,studentId:students[0].id,relationshipToStudent:"Parent",isPrimaryContact:true}});
 await prisma.academicYearEnrollment.createMany({data:[
  {id:"qa18a-enrol-2025",studentId:students[0].id,academicYear:"2025-26",className:"Class 6",section:"A",status:"COMPLETED",enrollmentDate:new Date("2025-06-01"),exitDate:new Date("2026-04-01")},
  {id:"qa18a-enrol-2026",studentId:students[0].id,academicYear:YEAR,className:"Class 7",section:"A",status:"ACTIVE",enrollmentDate:new Date("2026-06-01")},
  {id:"qa18a-enrol-other",studentId:students[1].id,academicYear:YEAR,className:"Class 8",section:"B",status:"ACTIVE",enrollmentDate:new Date("2026-06-01")}
 ]});
 await prisma.studentProgressionDecision.create({data:{id:"qa18a-progression",studentId:students[0].id,sourceEnrollmentId:"qa18a-enrol-2026",academicYear:YEAR,decisionType:"PROMOTE",status:"FINALIZED",fromClass:"Class 7",toAcademicYear:"2027-28",toClass:"Class 8",effectiveDate:new Date("2027-04-01"),finalizedAt:new Date("2027-04-01")}});
 const session=await prisma.studentAttendanceSession.create({data:{id:"qa18a-attendance",attendanceDate:new Date("2026-07-15"),className:"Class 7",section:"A",academicYear:YEAR,status:"LOCKED",notes:`${P} source coverage`}});
 await prisma.studentAttendanceRecord.create({data:{id:"qa18a-attendance-record",sessionId:session.id,studentId:students[0].id,admissionNo:students[0].admissionNo,status:"PRESENT"}});
 for(const [i,type]of(["BONAFIDE","STUDY","CONDUCT","TRANSFER"] as const).entries()){
  await prisma.certificateNumberSeries.create({data:{id:`qa18a-series-${type.toLowerCase()}`,seriesCode:`${P}-${type}`,certificateType:type,academicYear:YEAR,prefix:`${P}/${type.slice(0,3)}/`,nextNumber:type==="BONAFIDE"?2:1,paddingLength:4,status:"ACTIVE",isDefault:true,createdByUserId:principal.id}});
  await prisma.certificateTemplate.create({data:{id:`qa18a-template-${type.toLowerCase()}`,templateCode:`${P}-${type}-T`,certificateType:type,name:`${P} ${type} Template`,academicYear:YEAR,status:"ACTIVE",versionNumber:1,templateDefinitionJson:JSON.stringify(defaultTemplateDefinition(type)),printSettingsJson:JSON.stringify({paper:"A4",monochrome:true}),createdByUserId:principal.id,activatedByUserId:principal.id}});
 }
 const request=await prisma.studentCertificateRequest.create({data:{id:"qa18a-request-parent",requestNumber:"QA18A-REQ-PARENT",studentId:students[0].id,academicYear:YEAR,certificateType:"BONAFIDE",requestSource:"PARENT_PORTAL",purpose:"QA18A scholarship application",requestedCopies:1,urgency:"NORMAL",status:"SUBMITTED",applicantGuardianId:guardian.id,createdByUserId:users.find(u=>u.role==="PARENT")!.id,submittedAt:new Date()}});
 await prisma.studentCertificateEvent.create({data:{id:"qa18a-event-request",requestId:request.id,eventType:"REQUEST_CREATED",newStatus:"SUBMITTED"}});
 const issuedSnapshot={schemaVersion:1,certificateType:"BONAFIDE",academicYear:YEAR,purpose:"QA18A issued print proof",student:{name:students[0].studentName,admissionNumber:students[0].admissionNo,fatherName:students[0].fatherName,motherName:students[0].motherName,dateOfBirth:students[0].dateOfBirth,lifecycleStatus:students[0].status},currentEnrollment:{className:"Class 7",section:"A",status:"ACTIVE"},enrollmentHistory:[],attendance:{recordedDays:1,counts:{PRESENT:1}},progression:{qualifiedForPromotion:true,nextClass:"Class 8"},warnings:[],certificateNumber:"QA18A/BON/0001",issueDate:new Date(),issueStatus:"ISSUED",versionLabel:"ORIGINAL",template:{code:"QA18A-BONAFIDE-T",versionNumber:1,definition:defaultTemplateDefinition("BONAFIDE")},digitalSignature:false};
 const cert=await prisma.studentCertificate.create({data:{id:"qa18a-cert-issued",studentId:students[0].id,academicYear:YEAR,certificateType:"BONAFIDE",templateId:"qa18a-template-bonafide",certificateNumber:"QA18A/BON/0001",status:"ISSUED",currentVersionNumber:1,draftDataJson:JSON.stringify(issuedSnapshot),issuePurpose:"QA18A issued print proof",issuedByUserId:principal.id,issuedAt:new Date()}});
 const version=await prisma.studentCertificateVersion.create({data:{id:"qa18a-version-1",certificateId:cert.id,versionNumber:1,versionType:"ORIGINAL",certificateNumber:cert.certificateNumber!,snapshotJson:JSON.stringify(issuedSnapshot),issuedAt:new Date(),issuedByUserId:principal.id,snapshotHash:snapshotHash(issuedSnapshot)}});
 await prisma.studentCertificateEvent.create({data:{id:"qa18a-event-issued",certificateId:cert.id,versionId:version.id,eventType:"CERTIFICATE_ISSUED",previousStatus:"APPROVED",newStatus:"ISSUED"}});
 const tcSnapshot={...issuedSnapshot,certificateType:"TRANSFER",purpose:`${P} active enrollment issue QA`,certificateNumber:undefined,template:{code:"QA18A-TRANSFER-T",versionNumber:1,definition:defaultTemplateDefinition("TRANSFER")},warnings:["ACTIVE ENROLLMENT: leadership issue confirmation and reason are required."]};
 await prisma.studentCertificate.create({data:{id:"qa18a-cert-transfer",studentId:students[0].id,academicYear:YEAR,certificateType:"TRANSFER",templateId:"qa18a-template-transfer",status:"APPROVED",draftDataJson:JSON.stringify(tcSnapshot),issuePurpose:`${P} active enrollment issue QA`,approvedByUserId:principal.id,approvedAt:new Date()}});
 console.log(JSON.stringify({status:"QA18A fixtures created",password:PASSWORD,usernames:users.map(u=>u.username),linkedStudent:students[0].admissionNo,unrelatedStudent:students[1].admissionNo},null,2));
}
async function inspect(){
 const certIds=(await prisma.studentCertificate.findMany({where:{OR:[{certificateNumber:{startsWith:P}},{draftDataJson:{contains:P}}]},select:{id:true}})).map(x=>x.id);
 const requestIds=(await prisma.studentCertificateRequest.findMany({where:{OR:[{requestNumber:{startsWith:P}},{purpose:{contains:P}},{studentId:{startsWith:"qa18a-"}}]},select:{id:true}})).map(x=>x.id);
 const counts={series:await prisma.certificateNumberSeries.count({where:{seriesCode:{startsWith:P}}}),templates:await prisma.certificateTemplate.count({where:{templateCode:{startsWith:P}}}),requests:requestIds.length,certificates:certIds.length,versions:await prisma.studentCertificateVersion.count({where:{certificateId:{in:certIds}}}),events:await prisma.studentCertificateEvent.count({where:{OR:[{requestId:{in:requestIds}},{certificateId:{in:certIds}},{reason:{contains:P}}]}}),students:await prisma.student.count({where:{admissionNo:{startsWith:P}}}),guardians:await prisma.guardian.count({where:{displayName:{startsWith:P}}}),users:await prisma.user.count({where:{username:{startsWith:"qa18a-"}}})};console.log(JSON.stringify(counts,null,2));
}
async function invariants(){
 const students=await prisma.student.findMany({where:{admissionNo:{startsWith:P}},select:{id:true,admissionNo:true,status:true,className:true,section:true},orderBy:{admissionNo:"asc"}}),studentIds=students.map(x=>x.id);
 const counts={students,enrollments:await prisma.academicYearEnrollment.count({where:{studentId:{in:studentIds}}}),lifecycleEvents:await prisma.studentLifecycleEvent.count({where:{studentId:{in:studentIds}}}),progression:await prisma.studentProgressionDecision.count({where:{studentId:{in:studentIds}}}),attendanceRecords:await prisma.studentAttendanceRecord.count({where:{studentId:{in:studentIds}}}),marks:await prisma.studentMark.count({where:{studentId:{in:studentIds}}}),reportCards:await prisma.studentReportCard.count({where:{studentId:{in:studentIds}}}),payments:await prisma.payment.count({where:{studentId:{in:studentIds}}})};console.log(JSON.stringify(counts,null,2));
}
function emptyRestoreEntity(){return{created:0,updated:0,skipped:0,errors:[] as string[]};}
async function restoreCheck(){
 const series=await prisma.certificateNumberSeries.findMany({where:{seriesCode:{startsWith:P}}});
 const templates=await prisma.certificateTemplate.findMany({where:{templateCode:{startsWith:P}}});
 const requests=await prisma.studentCertificateRequest.findMany({where:{OR:[{requestNumber:{startsWith:P}},{purpose:{contains:P}},{studentId:{startsWith:"qa18a-"}}]}});
 const requestIds=requests.map(row=>row.id);
 const certificates=await prisma.studentCertificate.findMany({where:{OR:[{certificateNumber:{startsWith:P}},{draftDataJson:{contains:P}}]}});
 const certificateIds=certificates.map(row=>row.id);
 const versions=await prisma.studentCertificateVersion.findMany({where:{certificateId:{in:certificateIds}},orderBy:[{certificateId:"asc"},{versionNumber:"asc"}]});
 const events=await prisma.studentCertificateEvent.findMany({where:{OR:[{requestId:{in:requestIds}},{certificateId:{in:certificateIds}},{reason:{contains:P}}]},orderBy:{id:"asc"}});
 const backup={certificateNumberSeries:series,certificateTemplates:templates,studentCertificateRequests:requests,studentCertificates:certificates,studentCertificateVersions:versions,studentCertificateEvents:events};
 const baseline={counts:[series.length,templates.length,requests.length,certificates.length,versions.length,events.length],numbers:certificates.map(row=>row.certificateNumber).filter(Boolean).sort(),hashes:versions.map(row=>row.snapshotHash).filter(Boolean).sort(),requestStatuses:requests.map(row=>`${row.requestNumber}:${row.status}`).sort(),certificateStatuses:certificates.map(row=>`${row.id}:${row.status}`).sort()};
 await prisma.studentCertificateEvent.deleteMany({where:{id:{in:events.map(row=>row.id)}}});
 await prisma.studentCertificateVersion.deleteMany({where:{id:{in:versions.map(row=>row.id)}}});
 await prisma.studentCertificate.deleteMany({where:{id:{in:certificateIds}}});
 await prisma.studentCertificateRequest.deleteMany({where:{id:{in:requestIds}}});
 await prisma.certificateTemplate.deleteMany({where:{id:{in:templates.map(row=>row.id)}}});
 await prisma.certificateNumberSeries.deleteMany({where:{id:{in:series.map(row=>row.id)}}});
 const studentMap=new Map((await prisma.student.findMany({where:{id:{in:["qa18a-student-linked","qa18a-student-unrelated"]}},select:{id:true}})).map(row=>[row.id,row.id]));
 const makeResult=()=>({certificateNumberSeries:emptyRestoreEntity(),certificateTemplates:emptyRestoreEntity(),studentCertificateRequests:emptyRestoreEntity(),studentCertificates:emptyRestoreEntity(),studentCertificateVersions:emptyRestoreEntity(),studentCertificateEvents:emptyRestoreEntity(),warnings:[] as string[]});
 const first=makeResult();await restoreCertificateData(prisma as any,backup as any,studentMap,first as any);
 const second=makeResult();await restoreCertificateData(prisma as any,backup as any,studentMap,second as any);
 const afterRequests=await prisma.studentCertificateRequest.findMany({where:{id:{in:requestIds}},select:{requestNumber:true,status:true}});
 const afterCertificates=await prisma.studentCertificate.findMany({where:{id:{in:certificateIds}},select:{id:true,certificateNumber:true,status:true}});
 const afterVersions=await prisma.studentCertificateVersion.findMany({where:{id:{in:versions.map(row=>row.id)}},select:{snapshotHash:true}});
 const afterEvents=await prisma.studentCertificateEvent.count({where:{id:{in:events.map(row=>row.id)}}});
 const restored={counts:[await prisma.certificateNumberSeries.count({where:{id:{in:series.map(row=>row.id)}}}),await prisma.certificateTemplate.count({where:{id:{in:templates.map(row=>row.id)}}}),afterRequests.length,afterCertificates.length,afterVersions.length,afterEvents],numbers:afterCertificates.map(row=>row.certificateNumber).filter(Boolean).sort(),hashes:afterVersions.map(row=>row.snapshotHash).filter(Boolean).sort(),requestStatuses:afterRequests.map(row=>`${row.requestNumber}:${row.status}`).sort(),certificateStatuses:afterCertificates.map(row=>`${row.id}:${row.status}`).sort()};
 const preserved=JSON.stringify(baseline)===JSON.stringify(restored);
 const secondCreated=Object.values(second).filter((value:any)=>value&&typeof value==="object"&&"created"in value).reduce((sum:number,value:any)=>sum+value.created,0);
 const errors=[...Object.values(first),...Object.values(second)].filter((value:any)=>value&&typeof value==="object"&&Array.isArray(value.errors)).flatMap((value:any)=>value.errors);
 console.log(JSON.stringify({preserved,baseline,restored,first,second,secondCreated,errors},null,2));
 if(!preserved||secondCreated!==0||errors.length)throw new Error("QA18A certificate restore/idempotence verification failed.");
}
async function main(){const action=process.argv[2];if(action==="setup")await setup();else if(action==="cleanup"){await cleanup();await inspect();}else if(action==="inspect")await inspect();else if(action==="invariants")await invariants();else if(action==="restore-check")await restoreCheck();else throw new Error("Use: pnpm exec tsx scripts/qa18a-fixtures.ts setup|cleanup|inspect|invariants|restore-check");}
main().finally(()=>prisma.$disconnect());
