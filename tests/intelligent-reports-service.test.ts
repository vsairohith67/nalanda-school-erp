import {beforeAll,afterAll,it,expect,vi} from "vitest";
import {PrismaClient} from "@prisma/client";
import {mkdtempSync,readFileSync,readdirSync} from "node:fs";
import {DatabaseSync,backup} from "node:sqlite";
import {tmpdir} from "node:os";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {authorize,type Identity} from "../lib/intelligent-reports/access";
import {execute,readReport,pageReport,reportCsv,options} from "../lib/intelligent-reports/service";
import type {Query} from "../lib/intelligent-reports/contract";
import {NextRequest} from "next/server";
import {resetAcademicCalendarExportRateLimitForTests} from "../lib/academic-calendar-export-rate-limit";
// Only the HTTP identity adapter and Prisma singleton are doubled. The session,
// grants, feature policy, source reads, transaction and audit remain real.
const transport=vi.hoisted(()=>({db:null as any,context:null as any}));
vi.mock("../lib/auth",()=>({getCurrentAuthContext:async()=>transport.context}));
vi.mock("../lib/prisma",()=>({get prisma(){return transport.db;}}));
import {handle} from "../lib/intelligent-reports/api";
import {previewFamilyCollection,confirmFamilyCollection,reverseFamilyCollection} from "../lib/family-collections";

// Actual migrated, newly generated SQLite and actual IAM/source/feature services.
// No authority doubles, copied database, server, runtime admission or login claim.
const root=mkdtempSync(path.join(tmpdir(),"nalanda-intelligent-reports-1a-"));
let db:PrismaClient,actor:Identity,queries=0;
const year="2026-27",now=new Date("2026-09-27T00:00:00Z"),date=(s:string)=>new Date(s+"T00:00:00Z");
const q:Query={family:"ACADEMIC",schoolId:"school",academicYear:year,targets:[{id:"scope7",examId:"exam7"}],sourceState:"ISSUED",comparator:"LT",threshold:60,sort:"NAME",direction:"ASC",page:1,pageSize:25};
const fees:Query={...q,family:"FEES",targets:[{id:"scope7"}],sourceState:"CURRENT",comparator:"GT",threshold:0,term:2};
const attendance:Query={...q,family:"ATTENDANCE",targets:[{id:"scope7"}],sourceState:"LOCKED",threshold:80,from:"2026-06-01",to:"2026-06-03"};
async function identity(role:string) {
  const user=await db.user.create({data:{name:`SYNTHETIC ${role}`,username:`synthetic-${role}`,passwordHash:"SYNTHETIC-NOT-A-CREDENTIAL",role}});
  const assignment=await db.userRoleAssignment.create({data:{userId:user.id,role,reason:"SYNTHETIC",validFrom:date("2026-01-01")}});
  const session=await db.authSession.create({data:{userId:user.id,activeRoleAssignmentId:assignment.id,tokenHash:`synthetic-${role}`,credentialVersion:1,authorizationVersion:1,expiresAt:new Date(Date.now()+3600000),deviceSummary:"SYNTHETIC",browserSummary:"SYNTHETIC",networkEvidenceMasked:"SYNTHETIC"}});
  return {userId:user.id,roleAssignmentId:assignment.id,sessionId:session.id};
}
async function grant(who:Identity,permission:string,effect="ALLOW") {return db.userPermissionOverride.create({data:{userId:who.userId,permission,effect,reason:"SYNTHETIC test grant",createdByUserId:actor.userId,validFrom:date("2026-01-01")}});}
async function publication(index:number,percentage:string,state="PRESENT") {
  const id=`s${index}`;
  await db.studentResultSnapshot.create({data:{id:`result-${id}`,calculationRunId:`run-${id}`,inputFingerprint:`fixture-${id}`,runNumber:1,runStatus:"LOCKED",examinationId:"exam7",classScopeId:"exam-scope7",studentId:id,schemeVersionId:"scheme7",snapshotVersion:1,totalObtained:percentage,totalMaximum:100,percentage,formulaVersion:"RC05",roundingPolicyVersion:"RC05_V1_DECIMAL6_HALF_UP2",warningsJson:"[]",sourceSheetVersionsJson:"[]",sourceSchemeVersionsJson:"[]",snapshotJson:"{}",calculatedByUserId:actor.userId,calculatedAt:now,lockedAt:now}});
  await db.studentReportCard.create({data:{id:`card-${id}`,reportCardNumber:`SYNTHETIC-${id}`,batchId:"batch7",studentId:id,academicYear:year,className:"7",section:"A",reportType:"MARK_BASED",status:"ISSUED",currentVersionNumber:1,draftDataJson:"{}"}});
  const published={schemaVersion:3,status:"ISSUED",publicationReference:`SYNTHETIC-${id}`,academicYear:year,student:{name:`SYNTHETIC Student ${index}`,admissionNumber:`SYN-${index}`,className:"7",section:"A"},examination:{code:"EXAM7"},content:{percentage,totalObtained:percentage,totalMaximum:"100",papers:[{components:[{state}]}]},governance:{resultSnapshotVersion:1,formulaVersion:"RC05",roundingPolicyVersion:"RC05_V1_DECIMAL6_HALF_UP2",internal:{resultSnapshotId:`result-${id}`}}};
  await db.studentReportCardVersion.create({data:{reportCardId:`card-${id}`,versionNumber:1,versionType:"ORIGINAL",snapshotJson:JSON.stringify(published),issuedAt:now}});
}
beforeAll(async()=>{
  expect(process.env.DATABASE_PROVIDER??"sqlite").toBe("sqlite");
  const sql=new DatabaseSync(":memory:");
  try {for(const folder of readdirSync("prisma/migrations",{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort())sql.exec(readFileSync(path.join("prisma/migrations",folder,"migration.sql"),"utf8"));expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);await backup(sql,path.join(root,"synthetic.db"));}finally{sql.close();}
  const url="file:"+path.join(root,"synthetic.db").replaceAll("\\","/");
  vi.stubEnv("NODE_ENV","test");vi.stubEnv("DATABASE_URL",url);vi.stubEnv("APP_ORIGIN","http://127.0.0.1:4179");vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_MODE","SYNTHETIC_COPY_ONLY");vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","intelligent-reports-1a,bulk-exports");
  db=new PrismaClient({datasourceUrl:url,log:[{emit:"event",level:"query"}]});(db as any).$on("query",()=>queries++);actor=await identity("SUPER_ADMIN");
  transport.db=db;transport.context={user:{id:actor.userId,name:"SYNTHETIC",role:"SUPER_ADMIN",roleAssignmentId:actor.roleAssignmentId,mustChangePassword:false},sessionId:actor.sessionId};
  await db.schoolSettings.create({data:{id:"school",schoolName:"SYNTHETIC NALANDA",academicYear:year,addressLine1:"SYNTHETIC",city:"SYNTHETIC",phone:"SYNTHETIC"}});
  await db.timetableClassSection.createMany({data:[{id:"scope7",academicYear:year,className:"7",section:"A",displayName:"7A",groupName:"SYNTHETIC"},{id:"scope9",academicYear:year,className:"9",section:"B",displayName:"9B",groupName:"SYNTHETIC"}]});
  await db.student.createMany({data:Array.from({length:800},(_,i)=>({id:`s${i}`,admissionNo:`SYN-${i}`,studentName:`SYNTHETIC Student ${i}`,fatherName:"PRIVATE-FATHER-CANARY",phone1:"PRIVATE-PHONE-CANARY",academicYear:year,className:i===6?"9":"7",section:"A"}))});
  await db.academicYearEnrollment.createMany({data:Array.from({length:800},(_,i)=>({id:`enrol-${i}`,studentId:`s${i}`,academicYear:year,className:"7",section:"A",status:"ACTIVE",enrollmentDate:date(i===1?"2026-06-02":"2026-04-01"),exitDate:i===2?date("2026-06-03"):null}))});
  await db.studentLifecycleEvent.create({data:{studentId:"s1",academicYear:year,eventType:"ENROLLED",toClass:"7",toSection:"A",effectiveDate:date("2026-06-02")}});
  await db.examination.create({data:{id:"exam7",academicYear:year,examCode:"EXAM7",name:"Synthetic Term 1",examType:"TERM",startDate:date("2026-06-01"),endDate:date("2026-06-03"),createdByUserId:actor.userId}});
  await db.examinationClassScope.create({data:{id:"exam-scope7",examinationId:"exam7",academicYear:year,className:"7",section:"A",timetableClassSectionId:"scope7",createdByUserId:actor.userId}});
  await db.examinationSchemeVersion.create({data:{id:"scheme7",examinationId:"exam7",classScopeId:"exam-scope7",academicYear:year,className:"7",section:"A",versionNumber:1,calculationMode:"WEIGHTED",createdByUserId:actor.userId}});
  await db.reportCardTemplate.create({data:{id:"template7",templateCode:"SYNTHETIC",name:"SYNTHETIC",reportType:"MARK_BASED",templateDefinitionJson:"{}"}});
  await db.reportCardBatch.create({data:{id:"batch7",batchNumber:"SYNTHETIC",academicYear:year,reportType:"MARK_BASED",templateId:"template7",className:"7",section:"A",title:"SYNTHETIC",status:"ISSUED",templateSnapshotJson:"{}"}});
  for(const [i,p,s] of [[0,"0","PRESENT"],[1,"59.999999","PRESENT"],[2,"60","PRESENT"],[3,"100","PRESENT"],[4,"0","NOT_ENTERED"],[6,"55","ABSENT"]] as const)await publication(i,p,s);
  await db.academicCalendarVersion.create({data:{id:"calendar",publicKey:"calendar-key",academicYear:year,versionNumber:1,status:"DRAFT",scopeKey:"SCHOOL_WIDE",title:"SYNTHETIC",createdByUserId:actor.userId}});
  for(let n=1;n<=3;n++){
    const d=date(`2026-06-0${n}`);
    await db.operationalCalendarDay.create({data:{id:`day${n}`,publicKey:`day-key${n}`,calendarVersionId:"calendar",dayDate:d,dayType:"WORKING_DAY",scopeKey:"SCHOOL_WIDE",title:"SYNTHETIC",contentHash:`synthetic${n}`}});
    await db.studentAttendanceSession.create({data:{id:`session${n}`,attendanceDate:d,academicYear:year,className:"7",section:"A",status:"LOCKED",operationalCalendarVersionKey:"calendar-key",operationalCalendarDayKey:`day-key${n}`}});
    await db.studentAttendanceRecord.createMany({data:Array.from({length:800},(_,i)=>({sessionId:`session${n}`,studentId:`s${i}`,admissionNo:`SYN-${i}`,status:i===4?"HALF_DAY":i===0&&n===1?"ABSENT":"PRESENT"})).filter(v=>!(v.studentId==="s3"&&n===2))});
  }
  await db.academicCalendarVersion.update({where:{id:"calendar"},data:{status:"READY_FOR_REVIEW",submittedAt:now}});
  await db.academicCalendarVersion.update({where:{id:"calendar"},data:{status:"PUBLISHED",approvedAt:now,publishedAt:now,publicationReason:"SYNTHETIC",currentPublicationKey:"SYNTHETIC-CURRENT"}});
  await db.feeStructure.create({data:{id:"fee7",academicYear:year,className:"7",termAmount:10000,term1Month:"June",term2Month:"September",term3Month:"December",term4Month:"March"}});
  await db.payment.createMany({data:[{studentId:"s0",admissionNo:"SYN-0",amountPaid:25000},{studentId:"s1",admissionNo:"SYN-1",amountPaid:15000}].map((v,i)=>({...v,id:`payment${i}`,receiptNo:`SYN-FAMILY-${i}`,date:date("2026-06-01"),studentName:"SYNTHETIC",className:"7",paymentMode:"CASH",receivedAccount:"SYNTHETIC",feeType:"Current Year Fee"}))});
  await db.payment.create({data:{id:"old",studentId:"s0",admissionNo:"SYN-0",amountPaid:9000,receiptNo:"SYN-OLD",date:date("2026-06-01"),studentName:"SYNTHETIC",className:"7",paymentMode:"CASH",receivedAccount:"SYNTHETIC",feeType:"Old Due"}});
},60000);
afterAll(async()=>{await db?.$disconnect();vi.unstubAllEnvs();/* Task-owned synthetic fixture retained for evidence; no historical artifact cleanup. */});

it("classifies exact issued Decimal sources, preserves zero/incomplete and historical enrolment",async()=>{
  const report=await execute(db,actor,q);expect(report.summary).toMatchObject({population:800,meets:3,doesNotMeet:2,unresolved:795});
  expect(report.rows.find(r=>r.admission==="SYN-0")?.metric).toBe(0);expect(report.rows.find(r=>r.admission==="SYN-6")?.classification).toBe("MEETS");
  const json=JSON.stringify(report);expect(json).not.toContain("PRIVATE-PHONE");expect(json).not.toContain("PRIVATE-FATHER");
  expect(pageReport(report).rows).toHaveLength(25);expect(pageReport(report).rows[0]).not.toHaveProperty("href");
  expect(report.rows.find(r=>r.admission==="SYN-0")?.href).toBe("/report-cards/card-s0");
});
it("handles real ENROLLED event, exit, missing records and partial statuses honestly",async()=>{
  const r=await execute(db,actor,attendance),row=(n:number)=>r.rows.find(r=>r.admission===`SYN-${n}`)!;
  expect(row(0)).toMatchObject({numerator:2,denominator:3,classification:"MEETS"});expect(row(1)).toMatchObject({numerator:2,denominator:2,classification:"DOES_NOT_MEET"});expect(row(2).denominator).toBe(2);expect(row(3).metric).toBeNull();expect(row(4).metric).toBeNull();
  await expect(execute(db,actor,{...attendance,to:"2026-06-04"})).rejects.toMatchObject({code:"CALENDAR_UNAVAILABLE"});
});
it("reconciles current exact term and Old Due without adding a family master",async()=>{
  const report=await readReport(db,actor,fees,false,now),row=(n:number)=>report.rows.find(r=>r.admission===`SYN-${n}`)!;
  expect(row(0)).toMatchObject({metric:0,numerator:1000000,denominator:1000000,state:"SETTLED"});expect(row(1)).toMatchObject({metric:500000,numerator:500000,denominator:1000000,state:"OVERDUE"});
  expect(row(0).explanation).toContain("900000 paise excluded");expect(row(6).classification).toBe("UNRESOLVED");
  expect(report.summary.outstandingPaise).toBe(797_500_000);expect(reportCsv(report).split("\r\n")).toHaveLength(807);
  expect(report.summary.outstandingPaise).toBe(report.rows.reduce((n,r)=>n+(r.metric??0),0));
});
it("refuses forged scope, changed revision and historical fee reconstruction",async()=>{
  await expect(execute(db,actor,{...q,targets:[{id:"scope9",examId:"exam7"}]})).rejects.toMatchObject({code:"SCOPE_UNAVAILABLE"});
  const first=await execute(db,actor,fees);await db.feeStructure.update({where:{id:"fee7"},data:{termAmount:10001}});
  await expect(execute(db,actor,fees,{expectedRevision:first.sourceRevision})).rejects.toMatchObject({code:"SOURCE_CHANGED"});await db.feeStructure.update({where:{id:"fee7"},data:{termAmount:10000}});
  await expect(readReport(db,actor,{...fees,academicYear:"2025-26",targets:[{id:"scope7"}]})).rejects.toMatchObject({code:"SCOPE_UNAVAILABLE"});
});
it("enforces production OFF, role OFF, user deny, export OFF and stale sessions",async()=>{
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","");await expect(authorize(db,actor)).rejects.toMatchObject({code:"MODULE_OFF"});
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","intelligent-reports-1a");await expect(authorize(db,actor,"ACADEMIC",true)).rejects.toMatchObject({code:"EXPORT_OFF"});
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","intelligent-reports-1a,bulk-exports");await authorize(db,actor,"ACADEMIC",true);
  const off=await db.rolePermission.create({data:{role:"SUPER_ADMIN",permission:"USE_INTELLIGENT_REPORTS",enabled:false}});await expect(options(db,actor,"ACADEMIC",year)).rejects.toMatchObject({code:"ROLE_OFF"});await db.rolePermission.delete({where:{id:off.id}});
  const deny=await grant(actor,"USE_INTELLIGENT_REPORTS","DENY");await expect(authorize(db,actor)).rejects.toMatchObject({code:"ACCESS_DENIED"});await db.userPermissionOverride.delete({where:{id:deny.id}});
  await db.authSession.update({where:{id:actor.sessionId},data:{authorizationVersion:0}});await expect(authorize(db,actor)).rejects.toMatchObject({code:"ACCESS_DENIED"});await db.authSession.update({where:{id:actor.sessionId},data:{authorizationVersion:1}});
});
it("eligible leadership needs module grants; Accountant academics require explicit underlying grant",async()=>{
  for(const role of ["DIRECTOR","PRINCIPAL","ACCOUNTANT","ADMIN","TEACHER","PARENT","STUDENT","VIEWER","COMPUTER_OPERATOR","GATE_STAFF"]){
    const who=await identity(role);await expect(authorize(db,who)).rejects.toMatchObject({code:"ACCESS_DENIED"});
    await grant(who,"USE_INTELLIGENT_REPORTS");await grant(who,"USE_IR_ACADEMIC");await grant(who,"USE_IR_FEES");await grant(who,"VIEW_PENDING_DUES");
    if(["DIRECTOR","PRINCIPAL","ACCOUNTANT"].includes(role)){
      await authorize(db,who,"FEES");
      if(role==="ACCOUNTANT")await expect(authorize(db,who,"ACADEMIC")).rejects.toMatchObject({code:"ACCESS_DENIED"});
      await grant(who,"VIEW_EXAM_REPORTS");await authorize(db,who,"ACADEMIC");
      if(role==="ACCOUNTANT"){await grant(who,"USE_IR_ATTENDANCE");await grant(who,"VIEW_STUDENT_ATTENDANCE_REPORTS");await expect(authorize(db,who,"ATTENDANCE")).rejects.toMatchObject({code:"ACCESS_DENIED"});}
    }else await expect(authorize(db,who,"FEES")).rejects.toMatchObject({code:"ACCESS_DENIED"});
  }
  await expect(identity("CUSTOM")).rejects.toThrow("UserRoleAssignment_role_check");
});
it("measures 800-student complete scope, pagination parity and business read-only behavior",async()=>{
  const business=async()=>JSON.stringify(await Promise.all([db.student.findMany({orderBy:{id:"asc"}}),db.payment.findMany({orderBy:{id:"asc"}}),db.studentAttendanceRecord.findMany({orderBy:{id:"asc"}}),db.studentResultSnapshot.findMany({orderBy:{id:"asc"}})]));
  const before=await business();
  for(const query of [q,attendance,fees]){
    const startQueries=queries,start=performance.now(),r=await execute(db,actor,query);const count=queries-startQueries;
    console.info(JSON.stringify({evidence:"INTELLIGENT_REPORTS_1A_SYNTHETIC_SQLITE",family:query.family,population:r.summary.population,elapsedMs:Math.round(performance.now()-start),queryCount:count}));
    expect(r.summary.population).toBe(800);expect(count).toBeLessThan(100);
    const p2=await execute(db,actor,{...query,page:2},{expectedRevision:r.sourceRevision});expect(p2.summary).toEqual(r.summary);expect(pageReport(p2).rows.map(r=>r.key)).toEqual(r.rows.slice(25,50).map(r=>r.key));
  }
  expect(await business()).toBe(before);expect(await db.userAudit.count()).toBe(0);
});
it("checks inactive/revoked/expired identities and assignments through actual IAM",async()=>{
  const u=await db.user.findUniqueOrThrow({where:{username:"synthetic-DIRECTOR"}}),session=await db.authSession.findFirstOrThrow({where:{userId:u.id}});
  const subject={userId:u.id,sessionId:session.id,roleAssignmentId:session.activeRoleAssignmentId};
  for(const patch of [{isActive:false},{lifecycleStatus:"SUSPENDED"}]){await db.user.update({where:{id:subject.userId},data:patch});await expect(authorize(db,subject)).rejects.toMatchObject({code:"ACCESS_DENIED"});await db.user.update({where:{id:subject.userId},data:{isActive:true,lifecycleStatus:"ACTIVE"}});}
  for(const patch of [{revokedAt:now},{expiresAt:date("2026-01-01")}]){await db.authSession.update({where:{id:subject.sessionId},data:patch});await expect(authorize(db,subject)).rejects.toMatchObject({code:"ACCESS_DENIED"});await db.authSession.update({where:{id:subject.sessionId},data:{revokedAt:null,expiresAt:new Date(Date.now()+3600000)}});}
  await db.userRoleAssignment.update({where:{id:subject.roleAssignmentId!},data:{validUntil:new Date(Date.now()-1000)}});await expect(authorize(db,subject)).rejects.toMatchObject({code:"ACCESS_DENIED"});await db.userRoleAssignment.update({where:{id:subject.roleAssignmentId!},data:{validUntil:null}});
  await expect(authorize(db,{...subject,sessionId:"forged"})).rejects.toMatchObject({code:"ACCESS_DENIED"});
});
it("rejects historical fee balance after valid historical metadata resolution",async()=>{
  await db.timetableClassSection.create({data:{id:"past7",academicYear:"2025-26",className:"7",section:"A",displayName:"SYNTHETIC past",groupName:"SYNTHETIC"}});
  await expect(execute(db,actor,{...fees,academicYear:"2025-26",targets:[{id:"past7"}]})).rejects.toMatchObject({code:"HISTORICAL_BALANCE_UNSUPPORTED"});
});
it("ROUTE_IN_PROCESS: independent reauthorization, metadata, interpretation, details, export and minimal audit",async()=>{
  const call=(action:Parameters<typeof handle>[1],body?:unknown,origin="http://127.0.0.1:4179")=>handle(new NextRequest(`http://127.0.0.1:4179/api/intelligent-reports/${action}`,{method:body===undefined?"GET":"POST",headers:{origin,"content-type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})}),action);
  resetAcademicCalendarExportRateLimitForTests();
  const access=await call("access");expect(access.status).toBe(200);expect((await access.json()).families).toHaveLength(3);
  expect((await call("options",{family:"ACADEMIC",academicYear:year})).status).toBe(200);
  const interpreted=await call("interpret",{question:"students below 60% in 7A",context:q});expect(interpreted.status).toBe(200);expect((await interpreted.json()).query).toEqual(q);
  const run=await call("run",{query:q}),report=await run.json();expect(run.status).toBe(200);expect(run.headers.get("cache-control")).toContain("no-store");
  expect((await call("source",{query:q,expectedRevision:report.sourceRevision,key:report.rows[0].key})).status).toBe(200);
  const exported=await call("export",{query:q,expectedRevision:report.sourceRevision});expect(exported.status).toBe(200);expect((await exported.text()).split("\r\n")).toHaveLength(807);
  resetAcademicCalendarExportRateLimitForTests();
  expect((await call("export",{query:q,expectedRevision:report.sourceRevision,rows:[{phone1:"forged"}]})).status).toBe(400);
  expect((await call("run",{query:{...q,page:2}})).status).toBe(409);
  expect((await call("run",{query:q},"https://hostile.invalid")).status).toBe(403);
  const deny=await grant(actor,"USE_INTELLIGENT_REPORTS","DENY");
  for(const action of ["access","options","interpret","run","source","export"] as const)expect((await call(action,action==="access"?undefined:{query:q,expectedRevision:report.sourceRevision})).status).toBe(403);
  await db.userPermissionOverride.delete({where:{id:deny.id}});
  const audit=await db.userAudit.findMany();expect(audit.map(v=>v.action)).toEqual(["INTELLIGENT_REPORT_READ","INTELLIGENT_REPORT_EXPORTED"]);expect(JSON.stringify(audit)).not.toContain("students below");expect(JSON.stringify(audit)).not.toContain("SYN-0");
  const saved=transport.context;transport.context=null;expect((await call("access")).status).toBe(401);transport.context=saved;
});
it("preserves a real 40000 family master, 25000/15000 shares, exact later-term allocation and reversal",async()=>{
  vi.stubEnv("AUTH_SECRET","SYNTHETIC-IR-TEST-SECRET-NEVER-DEPLOY-000000");
  const data={payerType:"COUNTER",counterpartyDisplay:"SYNTHETIC FAMILY",counterpartyReference:"SYNTHETIC-IR",auditReason:"SYNTHETIC independent report fixture",collectionDate:"2026-06-01",students:[10,11].map(i=>({admissionNo:`SYN-${i}`,academicYear:year})),instruments:[{clientKey:"cash",mode:"CASH",amountPaise:4000000,receivedAccount:"Cash"}],allocationMode:"MANUAL",allocations:[[10,1,1000000],[10,2,1000000],[10,3,500000],[11,1,1000000],[11,4,500000]].map(([student,term,amountPaise],i)=>({clientKey:`a${i}`,admissionNo:`SYN-${student}`,academicYear:year,installment:`Term ${term}`,feeHead:"TUITION",amountPaise})),shares:[1000000,1000000,500000,1000000,500000].map((amountPaise,i)=>({allocationKey:`a${i}`,instrumentKey:"cash",amountPaise}))};
  const leadership={id:actor.userId,name:"SYNTHETIC",role:"SUPER_ADMIN"},preview=await previewFamilyCollection(db,data),posted=await confirmFamilyCollection(db,{...data,planHash:preview.planHash,requestKey:"SYNTHETIC-IR-FAMILY"},leadership);
  expect(await db.familyCollection.count()).toBe(1);expect(posted.totalPaise).toBe(4000000);
  const r=await execute(db,actor,fees),row=(n:number)=>r.rows.find(r=>r.admission===`SYN-${n}`)!;
  expect(row(10).metric).toBe(0);expect(row(11).metric).toBe(1000000); // Term 4 money cannot pay Term 2.
  expect(r.summary.outstandingPaise).toBe(796500000);
  const components=await db.payment.findMany({where:{familyCollectionId:{not:null}}});expect(components.reduce((n,p)=>n+Math.round(p.amountPaid*100),0)).toBe(4000000);
  const before=JSON.stringify(await db.familyCollection.findMany());await execute(db,actor,fees);expect(JSON.stringify(await db.familyCollection.findMany())).toBe(before);
  await reverseFamilyCollection(db,posted.publicReference,{expectedVersion:posted.version,reason:"SYNTHETIC reversal fixture"},leadership);
  const reversed=await execute(db,actor,fees);expect(reversed.summary.outstandingPaise).toBe(797500000);expect(reversed.rows.find(r=>r.admission==="SYN-10")?.metric).toBe(1000000);
});
it("excludes valid previous-year family allocations and refuses conflicting odd-paise rounding",async()=>{
  const issue=async(admissionNo:string,academicYear:string,amountPaise:number,requestKey:string)=>{
    const data={payerType:"COUNTER",counterpartyDisplay:"SYNTHETIC",counterpartyReference:requestKey,auditReason:"SYNTHETIC source-contract regression",collectionDate:academicYear==="2025-26"?"2025-06-01":"2026-06-01",students:[{admissionNo,academicYear}],instruments:[{clientKey:"cash",mode:"CASH",amountPaise,receivedAccount:"Cash"}],allocationMode:"MANUAL",allocations:[{clientKey:"a",admissionNo,academicYear,installment:"Term 1",feeHead:"TUITION",amountPaise}],shares:[{allocationKey:"a",instrumentKey:"cash",amountPaise}]};
    const preview=await previewFamilyCollection(db,data);return confirmFamilyCollection(db,{...data,planHash:preview.planHash,requestKey},{id:actor.userId,name:"SYNTHETIC",role:"SUPER_ADMIN"});
  };
  await db.academicYearEnrollment.create({data:{studentId:"s12",academicYear:"2025-26",className:"7",section:"A",status:"ACTIVE",enrollmentDate:date("2025-04-01")}});
  await db.feeStructure.create({data:{academicYear:"2025-26",className:"7",termAmount:10000,term1Month:"June",term2Month:"September",term3Month:"December",term4Month:"March"}});
  await issue("SYN-12","2025-26",1000000,"SYNTHETIC-IR-PAST");
  const current=await execute(db,actor,fees);expect(current.rows.find(r=>r.admission==="SYN-12")).toMatchObject({metric:1000000,classification:"MEETS"});
  await db.timetableClassSection.create({data:{id:"odd",academicYear:year,className:"8",section:"A",displayName:"SYNTHETIC Odd",groupName:"SYNTHETIC"}});
  await db.student.create({data:{id:"odd",admissionNo:"SYN-ODD",studentName:"SYNTHETIC Odd",fatherName:"PRIVATE",phone1:"PRIVATE",academicYear:year,className:"8",section:"A",discountPercent:50}});
  await db.academicYearEnrollment.create({data:{studentId:"odd",academicYear:year,className:"8",section:"A",status:"ACTIVE",enrollmentDate:date("2026-04-01")}});
  await db.feeStructure.create({data:{academicYear:year,className:"8",termAmount:2.01,term1Month:"June",term2Month:"September",term3Month:"December",term4Month:"March"}});
  await issue("SYN-ODD",year,100,"SYNTHETIC-IR-ODD");
  const odd=await execute(db,actor,{...fees,term:1,targets:[{id:"odd"}]});expect(odd.rows[0]).toMatchObject({metric:null,state:"UNRECONCILED",classification:"UNRESOLVED"});expect(odd.rows[0].explanation).toContain("rounding");
});
