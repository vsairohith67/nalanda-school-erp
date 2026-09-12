// Only this script may prepare/exercise the task's admitted hosted synthetic HTTP runtime.
import { randomUUID } from "node:crypto";
import { grantMarksDelegation, revokeMarksDelegation } from "../lib/academic-integrity";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { parseCsv, MARKS_IMPORT_COLUMNS } from "../lib/marks-import-csv";
import { generateOnboardingTemplate } from "../lib/onboarding-workbooks";
import { STUDENT_HEADERS, GUARDIAN_HEADERS, LINK_HEADERS, ENROLLMENT_HEADERS } from "../lib/onboarding-types";
import * as XLSX from "xlsx";
const root = path.join(process.cwd(), "tmp", "release-ci");
const expected = `file:${path.join(root,"synthetic.db").replaceAll("\\","/")}`;
const db = new PrismaClient();
const password = "Synthetic-Bulk-Only-Password!2026";
const origin = "http://127.0.0.1:47832";
const checks: string[] = [];
const refused = (response: Response, expectedStatuses: number[]) => assert(expectedStatuses.includes(response.status), `Expected refusal ${expectedStatuses.join("/")}, received ${response.status}`);
function hostGate() { assert.equal(process.env.GITHUB_ACTIONS,"true"); assert.equal(process.env.RUNNER_ENVIRONMENT,"github-hosted"); assert.equal(process.env.DATABASE_URL,expected); assert.equal(execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),process.env.BULK_EXACT_HEAD); }
async function prepare() {
  assert.equal(await db.student.count(),0);
  const admin = await db.user.update({where:{username:"director"},data:{passwordHash:await hashPassword(password),mustChangePassword:false,lifecycleStatus:"ACTIVE"}});
  assert.equal(admin.role,"SUPER_ADMIN");
  const cls = await db.timetableClassSection.upsert({where:{academicYear_className_section:{academicYear:"2026-27",className:"I",section:"A"}},update:{isActive:true},create:{academicYear:"2026-27",className:"I",section:"A",displayName:"Synthetic I A",groupName:"Synthetic",isActive:true}});
  const students=[];
  for(let i=1;i<=3;i++) {const s=await db.student.create({data:{admissionNo:`0000${i}`,studentName:`INVENTED Bulk Student ${i}`,fatherName:"INVENTED Parent",phone1:`900000000${i}`,academicYear:"2026-27",className:i===3?"II":"I",section:i===3?"B":"A",status:"Active"}});students.push(s);await db.academicYearEnrollment.create({data:{studentId:s.id,academicYear:"2026-27",className:s.className,section:s.section,status:"ACTIVE"}});await db.academicYearEnrollment.create({data:{studentId:s.id,academicYear:"2025-26",className:"I",section:i===3?"B":"A",status:i===2?"INACTIVE":"ACTIVE"}});}
  const subject=await db.timetableSubject.create({data:{name:"Synthetic Bulk Math",shortName:"SBM",department:"Synthetic",isActive:true}});
  const legacy=await db.examCycle.create({data:{examCode:"BULK-SYNTH",academicYear:"2026-27",name:"Synthetic bulk legacy",examType:"TERM",startDate:new Date("2026-09-01"),endDate:new Date("2026-09-30"),status:"OPEN_FOR_ENTRY"}});
  const assessment=await db.examAssessment.create({data:{examCycleId:legacy.id,academicYear:"2026-27",className:"I",section:"A",subjectName:subject.name,timetableSubjectId:subject.id,componentName:"Theory",assessmentType:"WRITTEN",maxMarks:10,entryStatus:"OPEN"}});
  const teacher=await db.user.create({data:{username:"bulk-synthetic-teacher",name:"INVENTED Bulk Teacher",role:"TEACHER",passwordHash:await hashPassword(password),isActive:true,lifecycleStatus:"ACTIVE",mustChangePassword:false}});
  const timetableTeacher=await db.timetableTeacher.create({data:{name:teacher.name,shortName:"BST",department:"Synthetic",maxPeriodsPerWeek:30,maxPeriodsPerDay:8,isActive:true}});
  const staff=await db.staffMember.create({data:{staffCode:"BULK-SYNTH-T",fullName:teacher.name,displayName:teacher.name,staffType:"TEACHING",designation:"Teacher",department:"Synthetic",status:"ACTIVE",userId:teacher.id,timetableTeacherId:timetableTeacher.id}});
  const timetable=await db.timetableAssignment.create({data:{academicYear:"2026-27",classSectionId:cls.id,subjectId:subject.id,teacherId:timetableTeacher.id,periodsPerWeek:5}});
  const examination=await db.examination.create({data:{examCode:"BULK-GOVERNED",academicYear:"2026-27",name:"Synthetic governed",examType:"TERM",startDate:new Date("2026-09-01"),endDate:new Date("2026-09-30"),status:"ACTIVE",createdByUserId:admin.id,activatedByUserId:admin.id,activatedAt:new Date()}});
  const scope=await db.examinationClassScope.create({data:{examinationId:examination.id,academicYear:"2026-27",className:"I",section:"A",timetableClassSectionId:cls.id,status:"ACTIVE",createdByUserId:admin.id}});
  const paper=await db.examSubjectPaper.create({data:{examinationId:examination.id,classScopeId:scope.id,academicYear:"2026-27",className:"I",section:"A",timetableSubjectId:subject.id,subjectNameSnapshot:subject.name,paperCode:"MATH",paperName:"Math",displayOrder:1,status:"ACTIVE",createdByUserId:admin.id}});
  const scheme=await db.examinationSchemeVersion.create({data:{examinationId:examination.id,classScopeId:scope.id,academicYear:"2026-27",className:"I",section:"A",scopeKey:"BASE",versionNumber:1,calculationMode:"RAW_SUM",markDecimalPlaces:2,status:"ACTIVE",createdByUserId:admin.id,activatedByUserId:admin.id,activatedAt:new Date(),frozenAt:new Date(),marksEntryOpenedAt:new Date(),components:{create:[{componentCode:"THEORY",name:"Theory",componentKind:"WRITTEN",displayOrder:1,maximumMarks:10,isRequired:true}]}},include:{components:true}});
  const assignment=await db.teacherExamAssignment.create({data:{examinationId:examination.id,classScopeId:scope.id,subjectPaperId:paper.id,componentId:scheme.components[0].id,schemeVersionId:scheme.id,academicYear:"2026-27",className:"I",section:"A",staffMemberId:staff.id,timetableTeacherId:timetableTeacher.id,timetableClassSectionId:cls.id,timetableAssignmentId:timetable.id,assignmentRole:"PRIMARY_SUBMITTER",status:"ACTIVE",assignmentReason:"Synthetic hosted QA only",assignedByUserId:admin.id}});
  writeFileSync(path.join(root,"bulk-state.json"),JSON.stringify({adminId:admin.id,assessmentId:assessment.id,assignmentId:assignment.id,studentId:students[0].id,subjectName:subject.name}));
  console.log("Synthetic fixture prepared; no real data or source workbook used.");
}
async function exercise(off:boolean) {
  const state=JSON.parse(readFileSync(path.join(root,"bulk-state.json"),"utf8"));
  async function session(username: string) {
    const login = await fetch(origin+"/api/auth/login",{method:"POST",headers:{"content-type":"application/json",origin},body:JSON.stringify({identifier:username,password})});
    assert.equal(login.status,200,"Synthetic actual login");
    const cookie=login.headers.getSetCookie().map(v=>v.split(";")[0]).join("; "); assert(cookie); return cookie;
  }
  const cookie = await session("director");
  const asActor=(cookie:string,url:string,body?:unknown)=>fetch(origin+url,{method:body?"POST":"GET",headers:{cookie,origin,...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  const call=(url:string,body?:unknown)=>asActor(cookie,url,body);
  const json=async(url:string,body?:unknown)=>{const r=await call(url,body);const d=await r.json();assert.equal(r.status,200,`${url}: ${d.error??r.status}`);return d;};
  checks.push("actual_login");
  const rows=[{academicYear:"2026-27",admissionNo:"00009",studentName:"INVENTED Legacy Import",className:"I",section:"A"}];
  const base={rows,mode:"skip",mappingVersion:"student-fields-v1"};
  const preview=await json("/api/import/students",{...base,action:"preview"});assert.equal(await db.student.count(),3);checks.push("student_preview_no_write");
  const rejected=await call("/api/import/students",{...base,action:"preview",rows:[{...rows[0],secret:"FORBIDDEN_SYNTHETIC_SENTINEL_1A"}]});assert.equal(rejected.status,400);assert(!(await rejected.text()).includes("FORBIDDEN_SYNTHETIC_SENTINEL_1A"));checks.push("forged_fields_rejected");
  if(off){assert.equal((await call("/api/import/students",{...base,action:"import",confirmed:true,receipt:preview.receipt})).status,404);assert.equal((await call("/api/export/students")).status,404);assert.equal(await db.student.count(),3);checks.push("production_OFF_http_no_business_write");}
  else {
    const trial=await json("/api/import/students",{...base,action:"dry-run",receipt:preview.receipt});assert(trial.batchId);assert.equal(await db.student.count(),3);checks.push("validation_metadata_only");
    const imported=await json("/api/import/students",{...base,action:"import",confirmed:true,receipt:preview.receipt});assert.equal(imported.result.created,1);assert.equal((await db.student.findUniqueOrThrow({where:{admissionNo:"00009"}})).studentName,"INVENTED Legacy Import");checks.push("student_import_readback");
    const csv=MARKS_IMPORT_COLUMNS.join(",")+`\nBULK-SYNTH,I,A,${state.subjectName},Theory,00001,0,PRESENT,`;
    const legacy={model:"LEGACY_ASSESSMENT",assessmentId:state.assessmentId,academicYear:"2026-27",csv};
    const p=await json("/api/marks/import",{...legacy,action:"preview"});await json("/api/marks/import",{...legacy,action:"confirm",receipt:p.receipt});assert.equal((await db.studentMark.findFirstOrThrow({where:{assessmentId:state.assessmentId}})).marksObtained?.toString(),"0");checks.push("legacy_marks_readback");
    const stale=await call("/api/marks/import",{...legacy,action:"confirm",receipt:p.receipt});refused(stale,[400,409]);checks.push("legacy_stale_preview_rejected");
    const endpoint=`/api/exam-marks/sheets/${state.assignmentId}`;
    const template=await call(endpoint+"?format=csv");assert.equal(template.status,200);const table=parseCsv(await template.text());table[1][7]="0";table[1][8]="PRESENT";
    const governedCsv=table.map(r=>r.map(c=>`"${c.replaceAll('"','""')}"`).join(",")).join("\r\n");
    const governed={model:"GOVERNED_DRAFT",csv:governedCsv};const gp=await json(endpoint,{...governed,action:"preview"});
    const saved=await json(endpoint,{...governed,action:"confirm",receipt:gp.receipt});const retried=await json(endpoint,{...governed,action:"confirm",receipt:gp.receipt});assert.equal(saved.result.sheetVersion,retried.result.sheetVersion);assert.equal((await db.examMarkEntry.findFirstOrThrow({where:{studentId:state.studentId}})).marksObtained?.toString(),"0");assert.equal(await db.studentMark.count(),1);checks.push("governed_draft_readback_and_idempotent_retry");
    const changed=await call(endpoint,{...governed,csv:governedCsv.replace('"0","PRESENT"','"1","PRESENT"'),action:"confirm",receipt:gp.receipt});refused(changed,[400]);checks.push("changed_content_reused_receipt_rejected");
    // Two distinct valid payloads preview the same version: exactly one may commit.
    const currentTable=parseCsv(await (await call(endpoint+"?format=csv")).text());
    const encode=(table:string[][])=>table.map(r=>r.map(c=>`"${c.replaceAll('"','""')}"`).join(",")).join("\r\n");
    const variants=["1","2"].map(mark=>{const t=currentTable.map(r=>[...r]);t[1][7]=mark;t[1][8]="PRESENT";return encode(t);});
    const plans=await Promise.all(variants.map(csv=>json(endpoint,{model:"GOVERNED_DRAFT",csv,action:"preview"})));
    const beforeCompetition=await db.examMarkSheet.findFirstOrThrow({where:{primaryAssignmentId:state.assignmentId}});
    const competed=await Promise.all(variants.map((csv,i)=>call(endpoint,{model:"GOVERNED_DRAFT",csv,action:"confirm",receipt:plans[i].receipt})));
    assert.equal(competed.filter(r=>r.ok).length,1); assert.equal(competed.filter(r=>r.status===409).length,1);
    const winner=competed.findIndex(r=>r.ok);
    assert.equal((await db.examMarkEntry.findFirstOrThrow({where:{studentId:state.studentId}})).marksObtained?.toString(), String(winner+1));
    const afterCompetition=await db.examMarkSheet.findFirstOrThrow({where:{primaryAssignmentId:state.assignmentId}});assert.equal(afterCompetition.optimisticVersion,beforeCompetition.optimisticVersion+1);
    checks.push("governed_simultaneous_edit_and_stale_preview_refused");
    for (const bad of [governedCsv+"\r\n"+governedCsv.split("\r\n")[1], governedCsv.replace('"0","PRESENT"','"11","PRESENT"'), governedCsv.replace('"0","PRESENT"','"","PRESENT"')]) {
      refused(await call(endpoint,{model:"GOVERNED_DRAFT",csv:bad,action:"preview"}),[400,409]);
    }
    const admin=await db.user.findUniqueOrThrow({where:{id:state.adminId}});
    const adminActor={id:admin.id,name:admin.name,role:"SUPER_ADMIN" as const,guardianId:null};
    async function inventedActor(username:string,role:"TEACHER"|"COMPUTER_OPERATOR") {
      const user=await db.user.create({data:{username,name:"INVENTED "+username,role,iamPublicKey:randomUUID(),passwordHash:await hashPassword(password),isActive:true,mustChangePassword:false,lifecycleStatus:"ACTIVE"}});
      await db.userRoleAssignment.create({data:{userId:user.id,role,reason:"Synthetic hosted QA only",assignedByUserId:admin.id,activeKey:`${user.id}:${role}`}});
      await db.authLoginAlias.create({data:{userId:user.id,type:"USERNAME",normalizedValue:username,displayMasked:username,status:"VERIFIED",verifiedAt:new Date()}});
      return user;
    }
    const teacher=await inventedActor("bulk-denied-teacher","TEACHER"); const teacherCookie=await session(teacher.username!);
    refused(await asActor(teacherCookie,endpoint,{model:"GOVERNED_DRAFT",csv:governedCsv,action:"preview"}),[401,403]);
    refused(await asActor(teacherCookie,"/api/marks/import",{...legacy,action:"preview"}),[401,403]);
    refused(await asActor(teacherCookie,"/api/export/students"),[401,403]); checks.push("Teacher_marks_and_export_denied");
    const operator=await inventedActor("bulk-delegated-operator","COMPUTER_OPERATOR");
    const grant=await grantMarksDelegation(db,adminActor,{userHandle:operator.iamPublicKey,kind:"GOVERNED_COMPONENT",targetId:state.assignmentId,reason:"Synthetic exact-scope QA only",validUntil:new Date(Date.now()+3600000).toISOString()});
    const operatorCookie=await session(operator.username!);
    const operatorTemplate=await asActor(operatorCookie,endpoint+"?format=csv");assert.equal(operatorTemplate.status,200);const operatorCsv=await operatorTemplate.text();
    const operatorPreview=await asActor(operatorCookie,endpoint,{model:"GOVERNED_DRAFT",csv:operatorCsv,action:"preview"});assert.equal(operatorPreview.status,200);const operatorPlan=await operatorPreview.json();
    const beforeRevocation=await db.examMarkEntry.findMany({orderBy:{id:"asc"}}); const beforeDeniedSheets=await db.examMarkSheet.findMany({orderBy:{id:"asc"}});
    await revokeMarksDelegation(db,adminActor,{assignmentHandle:grant.assignmentHandle,scopeKey:grant.scopeKey,reason:"Synthetic revocation before confirmation"});
    refused(await asActor(operatorCookie,endpoint,{model:"GOVERNED_DRAFT",csv:operatorCsv,action:"confirm",receipt:operatorPlan.receipt}),[401,403]);
    assert.deepEqual(await db.examMarkEntry.findMany({orderBy:{id:"asc"}}),beforeRevocation);assert.deepEqual(await db.examMarkSheet.findMany({orderBy:{id:"asc"}}),beforeDeniedSheets);assert.equal(await db.userAudit.count({where:{action:"MARKS_ENTRY_DELEGATION_REVOKED",targetUserId:operator.id}}),1);checks.push("delegation_revoked_before_commit_no_marks_change");
    const linked=await inventedActor("bulk-linked-operator","COMPUTER_OPERATOR");
    await grantMarksDelegation(db,adminActor,{userHandle:linked.iamPublicKey,kind:"GOVERNED_COMPONENT",targetId:state.assignmentId,reason:"Synthetic exact-scope conflict QA",validUntil:new Date(Date.now()+3600000).toISOString()});
    const linkedCookie=await session(linked.username!); const linkedCsv=await (await asActor(linkedCookie,endpoint+"?format=csv")).text();
    const linkedPreview=await asActor(linkedCookie,endpoint,{model:"GOVERNED_DRAFT",csv:linkedCsv,action:"preview"});assert.equal(linkedPreview.status,200);const linkedPlan=await linkedPreview.json();
    const guardian=await db.guardian.create({data:{displayName:"INVENTED linked guardian",primaryMobile:"9000000088"}});
    await db.studentGuardian.create({data:{guardianId:guardian.id,studentId:state.studentId}}); await db.user.update({where:{id:linked.id},data:{guardianId:guardian.id}});
    refused(await asActor(linkedCookie,endpoint,{model:"GOVERNED_DRAFT",csv:linkedCsv,action:"confirm",receipt:linkedPlan.receipt}),[401,403]);
    assert.deepEqual(await db.examMarkEntry.findMany({orderBy:{id:"asc"}}),beforeRevocation);assert.deepEqual(await db.examMarkSheet.findMany({orderBy:{id:"asc"}}),beforeDeniedSheets);assert.equal(await db.authSecurityEvent.count({where:{eventType:"MARKS_DELEGATION_FAMILY_CONFLICT_DENIED",userId:linked.id}}),1);checks.push("linked_child_added_after_preview_refused");
    const expiring=await inventedActor("bulk-expiring-operator","COMPUTER_OPERATOR");
    const expires=await grantMarksDelegation(db,adminActor,{userHandle:expiring.iamPublicKey,kind:"GOVERNED_COMPONENT",targetId:state.assignmentId,reason:"Synthetic exact-scope expiry QA",validUntil:new Date(Date.now()+3600000).toISOString()});
    const expiringCookie=await session(expiring.username!); const expiringCsv=await (await asActor(expiringCookie,endpoint+"?format=csv")).text();
    const expiryPreview=await asActor(expiringCookie,endpoint,{model:"GOVERNED_DRAFT",csv:expiringCsv,action:"preview"});assert.equal(expiryPreview.status,200);const expiryPlan=await expiryPreview.json();
    await db.userPermissionProfileAssignment.update({where:{publicKey:expires.assignmentHandle},data:{validUntil:new Date(Date.now()-1000)}});
    refused(await asActor(expiringCookie,endpoint,{model:"GOVERNED_DRAFT",csv:expiringCsv,action:"confirm",receipt:expiryPlan.receipt}),[401,403]);
    assert.deepEqual(await db.examMarkEntry.findMany({orderBy:{id:"asc"}}),beforeRevocation);assert.deepEqual(await db.examMarkSheet.findMany({orderBy:{id:"asc"}}),beforeDeniedSheets);checks.push("delegation_expired_before_commit_no_marks_change");
    const exportR=await call("/api/export/students?academicYear=2025-26&className=I&section=A&status=Inactive");assert.equal(exportR.status,200);const bytes=await exportR.text();const exported=parseCsv(bytes);assert.equal(exported.length,2);assert.equal(exported[1][1],"00002");assert.equal(exported[1][0],"2025-26");assert.equal(exported[1][6],"INACTIVE");assert(exportR.headers.get("cache-control")?.includes("no-store"));checks.push("actual_filtered_csv_bytes_and_historical_scope");
    const empty=await call("/api/export/students?q=NO_SYNTHETIC_MATCH");assert.equal(parseCsv(await empty.text()).length,1);checks.push("header_only_zero_results");
    assert.equal((await call("/api/export/students?unknown=1")).status,400);checks.push("invalid_export_filter_rejected");
    assert.equal((await call("/api/marks/reports/export?academicYear=2026-27&examCode=BULK-SYNTH")).status,200);checks.push("authorised_exam_report_download");
    const workbook=XLSX.read(generateOnboardingTemplate({bundle:"STUDENT_GUARDIAN",academicYears:["2026-27"],classes:[{academicYear:"2026-27",className:"I",section:"A"}]}),{type:"buffer"});
    workbook.Sheets.Students=XLSX.utils.aoa_to_sheet([STUDENT_HEADERS,["ROW-ONBOARD","00010","INVENTED Controlled","INVENTED Guardian","","9000000010","","","2026-27","I","A","","ACTIVE","","NO"]]);
    workbook.Sheets.Guardians=XLSX.utils.aoa_to_sheet([GUARDIAN_HEADERS,["GUARDIAN-ONBOARD","INVENTED Guardian","Father","9000000010","","","MOBILE","NO","NO"]]);
    workbook.Sheets["Student-Guardian Links"]=XLSX.utils.aoa_to_sheet([LINK_HEADERS,["LINK-ONBOARD","ROW-ONBOARD","GUARDIAN-ONBOARD","Father","YES","YES","YES","NO"]]);
    workbook.Sheets.Enrollments=XLSX.utils.aoa_to_sheet([ENROLLMENT_HEADERS,["ENROLL-ONBOARD","ROW-ONBOARD","2026-27","I","A","","","ACTIVE","NO"]]);
    const form=new FormData();form.set("bundle","STUDENT_GUARDIAN");form.set("workbook",new Blob([XLSX.write(workbook,{type:"buffer",bookType:"xlsx"})], {type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"synthetic-controlled.xlsx");
    const uploaded=await fetch(origin+"/api/onboarding/batches",{method:"POST",headers:{cookie,origin},body:form});const up=await uploaded.json();assert.equal(uploaded.status,201,up.error);const batchPath=`/api/onboarding/batches/${up.batch.batchReference}`;
    const duplicateUpload=await fetch(origin+"/api/onboarding/batches",{method:"POST",headers:{cookie,origin},body:form});assert.equal(duplicateUpload.status,200);assert.equal((await duplicateUpload.json()).batch.batchReference,up.batch.batchReference);checks.push("canonical_duplicate_upload_same_batch");
    const validated=await json(batchPath+"/validate",{resolutions:{}});assert.equal(validated.batch.status,"APPROVAL_REQUIRED");
    const approval={reason:"Synthetic exact-head acceptance only",reauthPassword:password,planHash:validated.batch.planHash,workbookHash:validated.batch.workbookHash};await json(batchPath+"/approve",approval);await json(batchPath+"/execute",{...approval,idempotencyKey:"bulk-synthetic-execution-0001"});assert(await db.student.findUnique({where:{admissionNo:"00010"}}));checks.push("controlled_bundle_validate_approve_execute_readback");
    await db.user.update({where:{id:state.adminId},data:{isActive:false}});assert.equal((await call(endpoint,{...governed,action:"confirm",receipt:gp.receipt})).status,401);checks.push("revoked_actor_rejected");
  }
  writeFileSync(path.join(root,off?"bulk-off-result.json":"bulk-on-result.json"),JSON.stringify({head:process.env.BULK_EXACT_HEAD,mode:off?"production-OFF":"synthetic-ON",checks, businessCounts:{students:await db.student.count(),legacyMarks:await db.studentMark.count(),governedEntries:await db.examMarkEntry.count(),importBatches:await db.importBatch.count()}},null,2));
  console.log(JSON.stringify({mode:off?"OFF":"ON",checks}));
}
async function main(){hostGate();try{if(process.argv[2]==="prepare")await prepare();else await exercise(process.argv[2]==="off");}finally{await db.$disconnect();}}
void main();
