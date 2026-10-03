import {beforeAll,afterAll,it,expect,vi} from "vitest";
import {PrismaClient} from "@prisma/client";
import {mkdtempSync,readFileSync,readdirSync,lstatSync,existsSync,realpathSync,writeFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {DatabaseSync,backup} from "node:sqlite";
import {tmpdir} from "node:os";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {authorize,type Identity} from "../lib/intelligent-reports/access";
import {execute,executeSource,readReport,pageReport,reportCsv,options} from "../lib/intelligent-reports/service";
import type {Query} from "../lib/intelligent-reports/contract";
import {NextRequest} from "next/server";
import {resetAcademicCalendarExportRateLimitForTests} from "../lib/academic-calendar-export-rate-limit";
// HTTP identity and Prisma singleton adapters are doubled. PostgreSQL additionally
// supplies an in-memory feature CONFIG fixture: the actual runtime deliberately
// admits only SQLite QA overrides. This proves readers/IAM, not PG activation.
const transport=vi.hoisted(()=>({db:null as any,context:null as any}));
vi.mock("../lib/auth",()=>({getCurrentAuthContext:async()=>transport.context}));
vi.mock("../lib/prisma",()=>({get prisma(){return transport.db;}}));
vi.mock("../lib/release-feature-flag-runtime",async(importOriginal)=>{
  const actual=await importOriginal<typeof import("../lib/release-feature-flag-runtime")>();
  const {releaseFeatureFlags}=await import("../lib/release-feature-flags");
  return {...actual,operationalReleaseFeatureAvailability:(feature:Parameters<typeof actual.operationalReleaseFeatureAvailability>[0])=>{
    if(process.env.DATABASE_PROVIDER!=="postgresql")return actual.operationalReleaseFeatureAvailability(feature);
    // Restricted to the two P1 test dependencies. No persisted flag is changed.
    const enabled=new Set((process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED??"").split(","));
    const config=releaseFeatureFlags().map(flag=>["intelligent-reports-1a","bulk-exports"].includes(flag.key)&&enabled.has(flag.key)?{...flag,defaultState:true,rolloutPercentage:100}:flag);
    return actual.operationalReleaseFeatureAvailability(feature,{config});
  }};
});
import {handle} from "../lib/intelligent-reports/api";
import {POST as sourceRoute} from "../app/api/intelligent-reports/source/route";
import {POST as exportRoute} from "../app/api/intelligent-reports/export/route";
const dispatch=(action:Parameters<typeof handle>[1],request:NextRequest)=>action==="export"?exportRoute(request):action==="source"?sourceRoute(request):handle(request,action);
import {previewFamilyCollection,confirmFamilyCollection,reverseFamilyCollection} from "../lib/family-collections";
import {assertSyntheticPostgresQa} from "../scripts/postgres/synthetic-qa";

// Same assertions/readers/routes on both providers; unique migrated fixture only.
// No authority doubles, copied database, server, runtime admission or login claim.
const root=mkdtempSync(path.join(tmpdir(),"nalanda-intelligent-reports-1a-"));
const postgres=process.env.DATABASE_PROVIDER==="postgresql",schema=`ir1_${randomUUID().replaceAll("-","")}`;
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
  expect(["sqlite","postgresql"]).toContain(process.env.DATABASE_PROVIDER??"sqlite");
  let url="file:"+path.join(root,"synthetic.db").replaceAll("\\","/");
  if(postgres){
    // Existing hosted database-only job, never infer authority from a local URL.
    expect(process.env.CI).toBe("true");assertSyntheticPostgresQa();
    const target=new URL(process.env.DATABASE_URL!);target.searchParams.set("schema",schema);url=target.toString();
    execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy","--schema","prisma/postgresql/schema.prisma"],{env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},stdio:"pipe",timeout:60000});
  }else{
    expect(lstatSync(root).isSymbolicLink()).toBe(false);expect(realpathSync(root)).toBe(root);
    expect(existsSync(path.join(root,"synthetic.db"))).toBe(false);
    const sql=new DatabaseSync(":memory:");
    try {for(const folder of readdirSync("prisma/migrations",{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort())sql.exec(readFileSync(path.join("prisma/migrations",folder,"migration.sql"),"utf8"));expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);await backup(sql,path.join(root,"synthetic.db"));}finally{sql.close();}
    const file=lstatSync(path.join(root,"synthetic.db"));expect(file.isSymbolicLink()).toBe(false);expect(file.nlink).toBe(1);
  }
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
afterAll(async()=>{await db?.$disconnect();vi.unstubAllEnvs();/* Unique synthetic fixture retained; hosted schema dies with the job's disposable service. No shared cleanup. */});

it("classifies exact issued Decimal sources, preserves zero/incomplete and historical enrolment",async()=>{
  const report=await execute(db,actor,q);expect(report.summary).toMatchObject({population:800,meets:3,doesNotMeet:2,unresolved:795});
  expect(report.rows.find(r=>r.admission==="SYN-0")?.metric).toBe(0);expect(report.rows.find(r=>r.admission==="SYN-6")?.classification).toBe("MEETS");
  expect((await db.studentResultSnapshot.findUniqueOrThrow({where:{id:"result-s1"}})).percentage.toString()).toBe("59.999999");
  expect((await execute(db,actor,{...q,comparator:"LT",threshold:59.999999})).rows.find(r=>r.admission==="SYN-1")?.classification).toBe("DOES_NOT_MEET");
  expect((await execute(db,actor,{...q,comparator:"LTE",threshold:59.999999})).rows.find(r=>r.admission==="SYN-1")?.classification).toBe("MEETS");
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
  const realRuntime=await vi.importActual<typeof import("../lib/release-feature-flag-runtime")>("../lib/release-feature-flag-runtime");
  expect(realRuntime.operationalReleaseFeatureAvailability({key:"intelligent-reports-1a",environment:"PRODUCTION",expectedVersion:1,activationRole:"SUPER_ADMIN"},{environment:{NODE_ENV:"production"}}).enabled).toBe(false);
  if(postgres)expect(realRuntime.operationalReleaseFeatureAvailability({key:"intelligent-reports-1a",environment:"PRODUCTION",expectedVersion:1,activationRole:"SUPER_ADMIN"}).enabled).toBe(false);
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","");await expect(authorize(db,actor)).rejects.toMatchObject({code:"MODULE_OFF"});
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","intelligent-reports-1a");await expect(authorize(db,actor,"ACADEMIC",true)).rejects.toMatchObject({code:"EXPORT_OFF"});
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","intelligent-reports-1a,bulk-exports");await authorize(db,actor,"ACADEMIC",true);
  const off=await db.rolePermission.create({data:{role:"SUPER_ADMIN",permission:"USE_INTELLIGENT_REPORTS",enabled:false}});await expect(options(db,actor,"ACADEMIC",year)).rejects.toMatchObject({code:"ROLE_OFF"});await db.rolePermission.delete({where:{id:off.id}});
  const deny=await grant(actor,"USE_INTELLIGENT_REPORTS","DENY");await expect(authorize(db,actor)).rejects.toMatchObject({code:"ACCESS_DENIED"});await db.userPermissionOverride.delete({where:{id:deny.id}});
  const domainDeny=await grant(actor,"USE_IR_ACADEMIC","DENY");await expect(authorize(db,actor,"ACADEMIC")).rejects.toMatchObject({code:"ACCESS_DENIED"});await authorize(db,actor,"FEES");await db.userPermissionOverride.delete({where:{id:domainDeny.id}});
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
      if(role==="ACCOUNTANT"){await grant(who,"USE_IR_ATTENDANCE");await grant(who,"VIEW_STUDENT_ATTENDANCE_REPORTS");await expect(authorize(db,who,"ATTENDANCE")).rejects.toMatchObject({code:"ACCESS_DENIED"});await grant(who,"EXPORT_INTELLIGENT_REPORTS");await grant(who,"EXPORT_EXAM_REPORTS");await expect(authorize(db,who,"ACADEMIC",true)).rejects.toMatchObject({code:"ACCESS_DENIED"});}
    }else await expect(authorize(db,who,"FEES")).rejects.toMatchObject({code:"ACCESS_DENIED"});
  }
  // Existing provider schemas differ on insertion; the reporting boundary must
  // still deny an unsupported role even if the database accepts its assignment.
  if(postgres){const custom=await identity("CUSTOM");await grant(custom,"USE_INTELLIGENT_REPORTS");await expect(authorize(db,custom)).rejects.toMatchObject({code:"ACCESS_DENIED"});}
  else await expect(identity("CUSTOM")).rejects.toThrow("UserRoleAssignment_role_check");
});
it("measures 800-student complete scope, pagination parity and business read-only behavior",async()=>{
  const business=async()=>JSON.stringify(await Promise.all([db.student.findMany({orderBy:{id:"asc"}}),db.payment.findMany({orderBy:{id:"asc"}}),db.studentAttendanceRecord.findMany({orderBy:{id:"asc"}}),db.studentResultSnapshot.findMany({orderBy:{id:"asc"}})]));
  const before=await business();
  for(const query of [q,attendance,fees]){
    const startQueries=queries,start=performance.now(),r=await execute(db,actor,query);const count=queries-startQueries;
    console.info(JSON.stringify({evidence:"INTELLIGENT_REPORTS_1A_SYNTHETIC_PROVIDER",provider:postgres?"postgresql":"sqlite",family:query.family,population:r.summary.population,elapsedMs:Math.round(performance.now()-start),queryCount:count}));
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
  const call=(action:Parameters<typeof handle>[1],body?:unknown,origin="http://127.0.0.1:4179")=>dispatch(action,new NextRequest(`http://127.0.0.1:4179/api/intelligent-reports/${action}`,{method:body===undefined?"GET":"POST",headers:{origin,"content-type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})}));
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
  const audit=await db.userAudit.findMany();expect(audit.map(v=>v.action).sort()).toEqual(["INTELLIGENT_REPORT_EXPORTED","INTELLIGENT_REPORT_READ"]);expect(JSON.stringify(audit)).not.toContain("students below");expect(JSON.stringify(audit)).not.toContain("SYN-0");
  const saved=transport.context;transport.context=null;expect((await call("access")).status).toBe(401);const deniedExport=await call("export",{query:q,expectedRevision:report.sourceRevision});expect(deniedExport.status).toBe(401);expect(deniedExport.headers.get("cache-control")).toContain("private, no-store");transport.context=saved;
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
it("does not borrow another class calendar even when its date and version overlap",async()=>{
  await db.academicCalendarVersion.create({data:{id:"calendar9",publicKey:"calendar9-key",academicYear:year,versionNumber:2,status:"DRAFT",effectiveScope:"CLASS_SECTION",className:"9",section:"B",scopeKey:"CLASS_SECTION:9:B",title:"SYNTHETIC other scope",createdByUserId:actor.userId}});
  await db.operationalCalendarDay.create({data:{publicKey:"day9-key",calendarVersionId:"calendar9",dayDate:date("2026-06-01"),dayType:"NON_WORKING_DAY",scopeType:"CLASS_SECTION",className:"9",section:"B",scopeKey:"CLASS_SECTION:9:B",title:"SYNTHETIC other scope",contentHash:"synthetic9"}});
  await db.academicCalendarVersion.update({where:{id:"calendar9"},data:{status:"READY_FOR_REVIEW",submittedAt:now}});
  await db.academicCalendarVersion.update({where:{id:"calendar9"},data:{status:"PUBLISHED",approvedAt:now,publishedAt:now,publicationReason:"SYNTHETIC",currentPublicationKey:"SYNTHETIC-OTHER-SCOPE"}});
  const report=await execute(db,actor,attendance);expect(report.rows.find(r=>r.admission==="SYN-0")).toMatchObject({numerator:2,denominator:3});
});
it("all three in-process route families preserve business data and reconcile private exports",async()=>{
  const business=async()=>JSON.stringify(await Promise.all([
    db.student.findMany({orderBy:{id:"asc"}}),db.academicYearEnrollment.findMany({orderBy:{id:"asc"}}),
    db.studentAttendanceSession.findMany({orderBy:{id:"asc"}}),db.studentAttendanceRecord.findMany({orderBy:{id:"asc"}}),
    db.studentResultSnapshot.findMany({orderBy:{id:"asc"}}),db.studentReportCardVersion.findMany({orderBy:{id:"asc"}}),
    db.payment.findMany({orderBy:{id:"asc"}}),db.feeStructure.findMany({orderBy:{id:"asc"}}),
    db.familyCollection.findMany({orderBy:{id:"asc"}}),db.familyStudentAllocation.findMany({orderBy:{id:"asc"}})
  ]));
  const before=await business(),audits=await db.userAudit.count();
  const call=(action:"run"|"export",body:unknown)=>dispatch(action,new NextRequest(`http://127.0.0.1:4179/api/intelligent-reports/${action}`,{method:"POST",headers:{origin:"http://127.0.0.1:4179","content-type":"application/json"},body:JSON.stringify(body)}));
  resetAcademicCalendarExportRateLimitForTests();
  for(const query of [q,attendance,fees]){
    const run=await call("run",{query}),page=await run.json();expect(run.status).toBe(200);expect(page.summary.population).toBe(800);expect(page.rows).toHaveLength(25);
    const exported=await call("export",{query,expectedRevision:page.sourceRevision});expect(exported.status).toBe(200);expect(exported.headers.get("cache-control")).toContain("no-store");expect(exported.headers.get("content-disposition")).toContain("attachment");
    const csv=await exported.text();expect(csv.split("\r\n")).toHaveLength(807);expect(csv).toContain(page.sourceRevision);expect(csv).not.toContain("PRIVATE-");
    if(query.family==="FEES")expect(csv).toContain('"Outstanding paise","797500000"');
  }
  expect(await business()).toBe(before);expect(await db.userAudit.count()).toBe(audits+6);
  const records=await db.userAudit.findMany();for(const record of records){expect(["INTELLIGENT_REPORT_READ","INTELLIGENT_REPORT_EXPORTED"]).toContain(record.action);expect(JSON.stringify(record)).not.toContain("SYN-");expect(JSON.stringify(record)).not.toContain("PRIVATE-");}
  const prior=await execute(db,actor,fees);await db.feeStructure.update({where:{id:"fee7"},data:{termAmount:10001}});
  const rejected=await call("export",{query:fees,expectedRevision:prior.sourceRevision});expect(rejected.status).toBe(409);expect((await rejected.json()).code).toBe("SOURCE_CHANGED");expect(await db.userAudit.count()).toBe(audits+6);
  await db.feeStructure.update({where:{id:"fee7"},data:{termAmount:10000}});
});

// 1B: retained historic records, migrated synthetic database, real readers and route.
const pastYear="2023-24";
const past:Query={...attendance,academicYear:pastYear,targets:[{id:"evidence-past7"}],from:"2024-02-01",to:"2024-02-20",comparator:"GTE",threshold:90};
async function publishEvidenceCalendar(id:string,scope:string,className:string|null,section:string|null,days:Array<{date:string;type:string}>,version=1,reconcile=false){
  await db.academicCalendarVersion.create({data:{id,publicKey:id,academicYear:pastYear,versionNumber:version,status:"DRAFT",effectiveScope:scope,className,section,scopeKey:`${scope}:${className??""}:${section??""}`,title:"SYNTHETIC EVIDENCE",createdByUserId:actor.userId,attendanceReconciliationRequired:reconcile}});
  await db.operationalCalendarDay.createMany({data:days.map(d=>({publicKey:`${id}-${d.date}`,calendarVersionId:id,dayDate:date(d.date),dayType:d.type,scopeType:scope,className,section,scopeKey:`${scope}:${className??""}:${section??""}`,title:"SYNTHETIC",contentHash:`synthetic-${d.date}`,reason:"PRIVATE-CALENDAR-NARRATIVE"}))});
  await db.academicCalendarVersion.update({where:{id},data:{status:"READY_FOR_REVIEW",submittedAt:now}});
  await db.academicCalendarVersion.update({where:{id},data:{status:"PUBLISHED",approvedAt:now,publishedAt:now,currentPublicationKey:`published-${id}`,publicationReason:"SYNTHETIC"}});
}
const detailFor=async(query:Query,n=0)=>{const report=await execute(db,actor,query);const row=report.rows.find(r=>r.admission===`SYN-${n}`)!;return executeSource(db,actor,query,row.key,report.sourceRevision);};
it("1B fixture: 50 historical enrollments and a complete leap academic year calendar",async()=>{
  await db.timetableClassSection.create({data:{id:"evidence-past7",academicYear:pastYear,className:"7",section:"A",displayName:"SYNTHETIC retained 7A",groupName:"SYNTHETIC"}});
  await db.academicYearEnrollment.createMany({data:Array.from({length:50},(_,n)=>({id:`evidence-enrollment-${n}`,studentId:`s${n}`,academicYear:pastYear,className:"7",section:"A",status:"ACTIVE",enrollmentDate:n===3?null:date(n===4?"2024-02-02":"2023-04-01"),exitDate:n===4?date("2024-02-20"):null,notes:"PRIVATE-ENROLLMENT-NARRATIVE"}))});
  const days=[];for(let at=date("2023-04-01").getTime();at<=date("2024-03-31").getTime();at+=86400000){const d=new Date(at).toISOString().slice(0,10);days.push({date:d,type:d>="2024-02-01"&&d<="2024-03-04"?"WORKING_DAY":"NON_WORKING_DAY"});}
  await publishEvidenceCalendar("evidence-calendar","SCHOOL_WIDE",null,null,days);
  for(let n=1;n<=20;n++){
    const d=`2024-02-${String(n).padStart(2,"0")}`;
    await db.studentAttendanceSession.create({data:{id:`evidence-session-${n}`,attendanceDate:date(d),academicYear:pastYear,className:"7",section:"A",status:"LOCKED",operationalCalendarVersionKey:"evidence-calendar",operationalCalendarDayKey:`evidence-calendar-${d}`,notes:"PRIVATE-SESSION-NARRATIVE"}});
    await db.studentAttendanceRecord.createMany({data:Array.from({length:50},(_,i)=>({sessionId:`evidence-session-${n}`,studentId:`s${i}`,admissionNo:`SYN-${i}`,status:i===2?"ABSENT":i===5&&n===10?"HALF_DAY":n<=18?"PRESENT":"ABSENT",remarks:"PRIVATE-LEAVE-NARRATIVE"})).filter(r=>!(r.studentId==="s1"&&n===18))});
  }
  await db.studentLifecycleEvent.create({data:{studentId:"s6",academicYear:pastYear,eventType:"TRANSFERRED",fromClass:"6",toClass:"7",fromSection:"B",toSection:"A",effectiveDate:date("2024-02-10"),evidenceNotes:"PRIVATE-TRANSFER-NARRATIVE"}});
});
it("1B real source: exactly 90%, missing date unresolved, true zero, admission and exclusive exit",async()=>{
  const complete=await detailFor(past),missing=await detailFor(past,1),zero=await detailFor(past,2),interval=await detailFor(past,4);
  expect(complete.row).toMatchObject({metric:90,numerator:18,denominator:20,classification:"MEETS"});
  expect(complete.attendance).toMatchObject({state:"COMPLETE",percentage:90,numerator:18,denominator:20,recorded:20,totalDates:20,coverage:{COUNTED_PRESENT:18,COUNTED_ABSENT:2}});
  expect(missing.row).toMatchObject({metric:null,numerator:17,denominator:20,classification:"UNRESOLVED"});
  expect(missing.attendance?.dates.filter(d=>d.reasons.includes("MISSING_RECORD")).map(d=>d.date)).toEqual(["2024-02-18"]);
  expect(zero.row).toMatchObject({metric:0,classification:"DOES_NOT_MEET"});expect(zero.attendance?.coverage.COUNTED_ABSENT).toBe(20);
  expect(interval.attendance).toMatchObject({numerator:17,denominator:18,coverage:{OUTSIDE_ENROLLMENT:2}});
  expect(interval.attendance?.dates[0].reasons).toContain("BEFORE_ENROLLMENT");expect(interval.attendance?.dates[1].denominator).toBe(1);expect(interval.attendance?.dates[19].reasons).toContain("ON_OR_AFTER_EXIT");
  for(const d of [complete,missing,zero,interval]){expect(d.row).not.toHaveProperty("href");expect(JSON.stringify(d)).not.toContain("PRIVATE-");expect(Object.values(d.attendance!.coverage).reduce((a,b)=>a+b,0)).toBe(20);expect(d.attendance!.dates.reduce((a,b)=>a+b.numerator,0)).toBe(d.row.numerator);expect(d.attendance!.dates.reduce((a,b)=>a+b.denominator,0)).toBe(d.row.denominator);}
  if(process.env.IR_EVIDENCE_CAPTURE_DIR){const output=realpathSync(process.env.IR_EVIDENCE_CAPTURE_DIR);expect(output).toContain("intelligent-reports-attendance-evidence-1b");writeFileSync(path.join(output,"service-fixtures.json"),JSON.stringify({label:"SYNTHETIC actual migrated SQLite service capture; transport is not login acceptance",complete,missing,zero,interval,empty:await detailFor({...past,from:"2023-12-31",to:"2024-01-01"}),report:pageReport(await execute(db,actor,past)),current:pageReport(await execute(db,actor,attendance)),currentDetail:await detailFor(attendance)},null,2));}
});
it("1B current and past years never borrow current Student scope or current school year",async()=>{
  const historic=await detailFor(past,6);expect(historic.row.className).toBe("7");expect(historic.attendance?.intervalReasons).toContain("TRANSFER_HISTORY");expect(historic.attendance?.transferDates).toEqual(["2024-02-10"]);
  const old=await execute(db,actor,past);await db.schoolSettings.update({where:{id:"school"},data:{academicYear:"2027-28"}});
  const retained=await executeSource(db,actor,past,old.rows[0].key,old.sourceRevision);expect(retained.attendance?.academicYear).toBe(pastYear);expect(retained.row).not.toHaveProperty("href");
  await db.schoolSettings.update({where:{id:"school"},data:{academicYear:year}});
  const current=await execute(db,actor,attendance);await expect(executeSource(db,actor,past,current.rows[0].key,old.sourceRevision)).rejects.toMatchObject({code:"SOURCE_UNAVAILABLE"});
  await expect(executeSource(db,actor,{...past,from:"2024-02-02"},old.rows[0].key,old.sourceRevision)).rejects.toMatchObject({code:"SOURCE_CHANGED"});
  await expect(executeSource(db,actor,{...past,threshold:91},old.rows[0].key,old.sourceRevision)).rejects.toMatchObject({code:"SOURCE_CHANGED"});
  await expect(executeSource(db,actor,{...past,targets:[{id:"scope7"}]},old.rows[0].key,old.sourceRevision)).rejects.toMatchObject({code:"SCOPE_UNAVAILABLE"});
});
it("1B unknown admission and partial statuses stay unresolved; observed counts are not official",async()=>{
  expect((await detailFor(past,3)).attendance).toMatchObject({state:"INCOMPLETE",percentage:null,intervalReasons:["UNKNOWN_ADMISSION"]});
  const partial=await detailFor(past,5);expect(partial.attendance?.percentage).toBeNull();expect(partial.attendance?.dates[9]).toMatchObject({status:"HALF_DAY",numerator:0,denominator:1,bucket:"UNSUPPORTED_STATUS",reasons:["UNSUPPORTED_STATUS"]});
  const empty=await detailFor({...past,from:"2023-12-31",to:"2024-01-01"});expect(empty.attendance).toMatchObject({state:"NO_ELIGIBLE_DAYS",percentage:null,numerator:0,denominator:0,totalDates:2,coverage:{EXCLUDED_CALENDAR:2}});expect(empty.row.classification).toBe("UNRESOLVED");
  const leap=await detailFor({...past,from:"2024-02-28",to:"2024-03-01"});expect(leap.attendance?.dates.map(d=>d.date)).toEqual(["2024-02-28","2024-02-29","2024-03-01"]);expect(leap.attendance?.coverage.MISSING_SESSION).toBe(3);
});
it("1B scoped calendars, special/vacation/closure/partial days and unlocked session",async()=>{
  await publishEvidenceCalendar("evidence-class","CLASS","7",null,[{date:"2024-03-01",type:"VACATION_DAY"},{date:"2024-03-02",type:"EMERGENCY_CLOSURE"},{date:"2024-03-03",type:"HALF_DAY"}]);
  await publishEvidenceCalendar("evidence-section","CLASS_SECTION","7","A",[{date:"2024-03-01",type:"SPECIAL_WORKING_DAY"}]);
  await db.studentAttendanceSession.create({data:{id:"evidence-draft",attendanceDate:date("2024-03-01"),academicYear:pastYear,className:"7",section:"A",status:"DRAFT"}});
  const d=await detailFor({...past,from:"2024-03-01",to:"2024-03-03"});expect(d.attendance?.dates.map(d=>d.calendar.scope)).toEqual(["CLASS_SECTION","CLASS","CLASS"]);expect(d.attendance?.dates.map(d=>d.bucket)).toEqual(["SESSION_NOT_LOCKED","EXCLUDED_CALENDAR","UNSUPPORTED_DAY"]);expect(d.row.metric).toBeNull();
  const classDay=await detailFor({...past,from:"2024-03-02",to:"2024-03-02"});expect(classDay.attendance?.dates[0].reasons).toContain("EMERGENCY_CLOSURE");
  // Provider uniqueness is the actual protection against a duplicate scope/version.
  await expect(db.academicCalendarVersion.create({data:{publicKey:"duplicate-evidence",academicYear:pastYear,versionNumber:1,scopeKey:"CLASS_SECTION:7:A",effectiveScope:"CLASS_SECTION",className:"7",section:"A",title:"SYNTHETIC",createdByUserId:actor.userId}})).rejects.toMatchObject({code:"P2002"});
});
it("1B revision detects record edits without session timestamp changes, absence and deletion",async()=>{
  const r=await execute(db,actor,past),key=r.rows.find(r=>r.admission==="SYN-0")!.key;
  const session=await db.studentAttendanceSession.findUniqueOrThrow({where:{id:"evidence-session-1"}});
  await db.studentAttendanceRecord.update({where:{sessionId_studentId:{sessionId:session.id,studentId:"s0"}},data:{status:"ABSENT"}});
  expect((await db.studentAttendanceSession.findUniqueOrThrow({where:{id:session.id}})).updatedAt).toEqual(session.updatedAt);
  await expect(executeSource(db,actor,past,key,r.sourceRevision)).rejects.toMatchObject({code:"SOURCE_CHANGED"});
  await db.studentAttendanceRecord.update({where:{sessionId_studentId:{sessionId:session.id,studentId:"s0"}},data:{status:"PRESENT"}});
  await db.student.update({where:{id:"s0"},data:{deletedAt:now}});await expect(executeSource(db,actor,past,key,r.sourceRevision)).rejects.toMatchObject({code:"SOURCE_CHANGED"});await db.student.update({where:{id:"s0"},data:{deletedAt:null}});
  await expect(executeSource(db,actor,past,"f".repeat(24),r.sourceRevision)).rejects.toMatchObject({code:"SOURCE_UNAVAILABLE"});
});
it("1B overlapping reconciliation and basis mismatch are diagnostic flags, not extra days",async()=>{
  const original=await db.studentAttendanceSession.findUniqueOrThrow({where:{id:"evidence-session-1"}});
  await db.academicCalendarVersion.update({where:{id:"evidence-calendar"},data:{attendanceReconciliationRequired:true}});
  await db.studentAttendanceSession.update({where:{id:original.id},data:{operationalCalendarDayKey:"different-retained-basis"}});
  const d=await detailFor(past);expect(d.attendance).toMatchObject({state:"INCOMPLETE",percentage:null,numerator:18,denominator:20,totalDates:20});expect(d.attendance?.dates[0].reasons).toEqual(["PENDING_RECONCILIATION","CALENDAR_BASIS_MISMATCH"]);expect(Object.values(d.attendance!.coverage).reduce((a,b)=>a+b,0)).toBe(20);
  await db.studentAttendanceSession.update({where:{id:original.id},data:{operationalCalendarDayKey:original.operationalCalendarDayKey}});await db.academicCalendarVersion.update({where:{id:"evidence-calendar"},data:{attendanceReconciliationRequired:false}});
});
it("1B deterministic source sets do not change revision when provider order changes",async()=>{
  const report=await execute(db,actor,past);
  const reverse=(model:any)=>new Proxy(model,{get(target,key){if(key==="findMany")return async(...args:any[])=>{const rows=await target.findMany(...args);return rows.reverse().map((row:any)=>row.records?{...row,records:[...row.records].reverse()}:row);};return target[key];}});
  const ordered=new Proxy(db,{get(target,key){if(["operationalCalendarDay","studentAttendanceSession","studentLifecycleEvent"].includes(String(key)))return reverse((target as any)[key]);return (target as any)[key];}});
  const shuffled=await readReport(ordered,actor,past);expect(shuffled.sourceRevision).toBe(report.sourceRevision);expect(shuffled.rows).toEqual(report.rows);
});
it("1B measures 50/800 cohorts, short/maximum 366-day reads and 2000-row bound",async()=>{
  for(const size of [50,800]){
    if(size===800)await db.academicYearEnrollment.createMany({data:Array.from({length:750},(_,i)=>({studentId:`s${i+50}`,academicYear:pastYear,className:"7",section:"A",status:"ACTIVE",enrollmentDate:date("2023-04-01")}))});
    for(const query of [past,{...past,from:"2023-04-01",to:"2024-03-31"}]){
      const start=performance.now(),before=queries,report=await execute(db,actor,query),reportMs=performance.now()-start,reportQueries=queries-before;
      const detailStart=performance.now(),detailQueries=queries,detail=await executeSource(db,actor,query,report.rows[0].key,report.sourceRevision);
      console.info(JSON.stringify({evidence:"ATTENDANCE_EVIDENCE_1B",provider:postgres?"postgresql":"sqlite",population:size,dates:detail.attendance!.totalDates,reportMs:Math.round(reportMs),reportQueries,detailMs:Math.round(performance.now()-detailStart),detailQueries:queries-detailQueries}));
      expect(report.summary.population).toBe(size);expect(reportQueries).toBeLessThan(100);expect(queries-detailQueries).toBeLessThan(100);expect(report).not.toHaveProperty("attendance");expect(detail.attendance!.dates.length).toBe(query.from==="2023-04-01"?366:20);
    }
  }
  await db.student.createMany({data:Array.from({length:1201},(_,i)=>({id:`limit-${i}`,admissionNo:`SYN-LIMIT-${i}`,studentName:"SYNTHETIC LIMIT",fatherName:"PRIVATE",phone1:"PRIVATE",academicYear:pastYear,className:"7",section:"A"}))});
  await db.academicYearEnrollment.createMany({data:Array.from({length:1200},(_,i)=>({studentId:`limit-${i}`,academicYear:pastYear,className:"7",section:"A",enrollmentDate:date("2023-04-01")}))});
  expect((await execute(db,actor,past)).summary.population).toBe(2000);
  await db.academicYearEnrollment.create({data:{studentId:"limit-1200",academicYear:pastYear,className:"7",section:"A",enrollmentDate:date("2023-04-01")}});
  await expect(execute(db,actor,past)).rejects.toMatchObject({code:"RANGE_TOO_LARGE"});
  await db.academicYearEnrollment.deleteMany({where:{studentId:{startsWith:"limit-"}}});
});
it("1B SOURCE ROUTE: real authority denials, malformed input, privacy headers and no business writes",async()=>{
  const report=await execute(db,actor,past),key=report.rows.find(r=>r.admission==="SYN-0")!.key,body={query:past,key,expectedRevision:report.sourceRevision};
  const call=async(payload:unknown=body,raw?:string,origin="http://127.0.0.1:4179")=>{resetAcademicCalendarExportRateLimitForTests();return sourceRoute(new NextRequest("http://127.0.0.1:4179/api/intelligent-reports/source",{method:"POST",headers:{origin,"content-type":"application/json"},body:raw??JSON.stringify(payload)}));};
  const business=async()=>JSON.stringify(await Promise.all([db.student.findMany({orderBy:{id:"asc"}}),db.academicYearEnrollment.findMany({orderBy:{id:"asc"}}),db.studentAttendanceSession.findMany({orderBy:{id:"asc"}}),db.studentAttendanceRecord.findMany({orderBy:{id:"asc"}}),db.academicCalendarVersion.findMany({orderBy:{id:"asc"}}),db.operationalCalendarDay.findMany({orderBy:{id:"asc"}}),db.studentLifecycleEvent.findMany({orderBy:{id:"asc"}})]));
  const before=await business(),audits=await db.userAudit.count();
  const ok=await call();expect(ok.status).toBe(200);expect(ok.headers.get("cache-control")).toContain("private, no-store");expect(ok.headers.get("x-robots-tag")).toContain("noindex");const projection=await ok.json();expect(projection.attendance.percentage).toBe(90);expect(JSON.stringify(projection)).not.toContain("PRIVATE-");
  const other=report.rows.find(r=>r.admission==="SYN-1")!;const otherDetail=await (await call({...body,key:other.key})).json();expect(otherDetail.row.admission).toBe("SYN-1");expect(otherDetail.attendance.percentage).toBeNull();
  expect((await call(body,"{")).status).toBe(400);expect((await call(body,"x".repeat(16001))).status).toBe(413);
  for(const bad of [{...body,studentId:"s1"},{...body,academicYear:year},{...body,ownerId:actor.userId},{...body,query:{...past,className:"9"}},{...body,featureOverride:true}])expect((await call(bad)).status).toBe(400);
  expect((await call({...body,key:"forged"})).status).toBe(404);expect((await call({...body,expectedRevision:"0".repeat(64)})).status).toBe(409);expect((await call(body,undefined,"https://hostile.invalid")).status).toBe(403);
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","");expect((await call()).status).toBe(403);vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","intelligent-reports-1a,bulk-exports");
  const off=await db.rolePermission.create({data:{role:"SUPER_ADMIN",permission:"USE_IR_ATTENDANCE",enabled:false}});expect((await call()).status).toBe(403);await db.rolePermission.delete({where:{id:off.id}});
  for(const permission of ["USE_INTELLIGENT_REPORTS","VIEW_STUDENT_ATTENDANCE_REPORTS"]){const deny=await grant(actor,permission,"DENY");const response=await call();expect(response.status).toBe(403);expect(JSON.stringify(await response.json())).not.toContain("SYN-");await db.userPermissionOverride.delete({where:{id:deny.id}});}
  for(const patch of [{revokedAt:now},{expiresAt:date("2020-01-01")},{authorizationVersion:0},{credentialVersion:0}]){const saved=await db.authSession.findUniqueOrThrow({where:{id:actor.sessionId}});await db.authSession.update({where:{id:actor.sessionId},data:patch});expect((await call()).status).toBe(403);await db.authSession.update({where:{id:actor.sessionId},data:{revokedAt:saved.revokedAt,expiresAt:saved.expiresAt,authorizationVersion:saved.authorizationVersion,credentialVersion:saved.credentialVersion}});}
  const reserve=await db.user.create({data:{username:"synthetic-evidence-reserve-admin",name:"SYNTHETIC reserve admin",passwordHash:"SYNTHETIC-NOT-A-CREDENTIAL",role:"SUPER_ADMIN"}});
  await db.userRoleAssignment.create({data:{userId:reserve.id,role:"SUPER_ADMIN",reason:"SYNTHETIC preserve last-admin invariant",validFrom:date("2020-01-01")}});
  await db.user.update({where:{id:actor.userId},data:{isActive:false}});expect((await call()).status).toBe(403);await db.user.update({where:{id:actor.userId},data:{isActive:true}});
  const alternate=await db.userRoleAssignment.create({data:{userId:actor.userId,role:"TEACHER",reason:"SYNTHETIC role switch",validFrom:date("2020-01-01")}});await db.authSession.update({where:{id:actor.sessionId},data:{activeRoleAssignmentId:alternate.id}});expect((await call()).status).toBe(403);await db.authSession.update({where:{id:actor.sessionId},data:{activeRoleAssignmentId:actor.roleAssignmentId}});
  // Eligible leadership is not an automatic attendance grant; verify actual policy.
  const director=await db.user.findUniqueOrThrow({where:{username:"synthetic-DIRECTOR"}}),assignment=await db.userRoleAssignment.findFirstOrThrow({where:{userId:director.id,role:"DIRECTOR"}});
  const session=await db.authSession.create({data:{userId:director.id,activeRoleAssignmentId:assignment.id,tokenHash:"synthetic-evidence-director-session",credentialVersion:director.credentialVersion,authorizationVersion:director.authorizationVersion,expiresAt:new Date(Date.now()+3600000),deviceSummary:"SYNTHETIC",browserSummary:"SYNTHETIC",networkEvidenceMasked:"SYNTHETIC"}}),saved=transport.context;
  transport.context={user:{id:director.id,name:"SYNTHETIC",role:"DIRECTOR",roleAssignmentId:session.activeRoleAssignmentId,mustChangePassword:false},sessionId:session.id};
  const who={userId:director.id,sessionId:session.id,roleAssignmentId:session.activeRoleAssignmentId};await grant(who,"USE_IR_ATTENDANCE");
  const denied=await grant(who,"VIEW_STUDENT_ATTENDANCE_REPORTS","DENY");expect((await call()).status).toBe(403);await db.userPermissionOverride.delete({where:{id:denied.id}});await grant(who,"VIEW_STUDENT_ATTENDANCE_REPORTS");const iam=await import("../lib/iam/effective-access");const snapshot=await iam.loadAuthorizationSnapshot(db,who);
  // Existing global object-scope policy also denies leadership USE_IR_ATTENDANCE.
  // A fixture grant cannot create the missing role resolver; retain the denial.
  expect(await iam.evaluatePermissionFromSnapshot(db,snapshot,"USE_IR_ATTENDANCE",true)).toMatchObject({allowed:false,source:"SYSTEM_RESTRICTION"});expect((await call()).status).toBe(403);transport.context=saved;
  expect((await call()).status).toBe(200);expect(await business()).toBe(before);expect(await db.userAudit.count()).toBe(audits);
});
it("1B report and selected detail read the same real transaction; source models never read outside it",async()=>{
  const report=await execute(db,actor,past);let transactions=0,inside=0;const sourceModels=new Set(["timetableClassSection","academicYearEnrollment","schoolSettings","operationalCalendarDay","studentAttendanceSession","studentLifecycleEvent"]);
  const instrumented=new Proxy(db,{get(target,key){if(key==="$transaction")return async(callback:any,options:any)=>{transactions++;expect(options).toEqual({isolationLevel:"Serializable",maxWait:2000,timeout:15000});return target.$transaction(async tx=>{inside++;try{return await callback(tx);}finally{inside--;}},options);};if(sourceModels.has(String(key))){expect(inside).toBe(1);}return (target as any)[key];}});
  const detail=await executeSource(instrumented,actor,past,report.rows[0].key,report.sourceRevision);expect(transactions).toBe(1);expect(detail.attendance?.dates).toHaveLength(20);
});
it("1B global missing/ambiguous calendar refusal stays a failed full report",async()=>{
  const report=await execute(db,actor,past);
  // Clearly labelled adversarial reader boundary: production DB uniqueness remains unchanged.
  for(const mode of ["missing","ambiguous"]){const adversarial=new Proxy(db,{get(target,key){if(key==="operationalCalendarDay")return {findMany:async(args:any)=>{const days=await target.operationalCalendarDay.findMany(args);return mode==="missing"?days.filter(d=>d.dayDate.toISOString().slice(0,10)!=="2024-02-01"):[...days,days[0]];}};return (target as any)[key];}});await expect(readReport(adversarial,actor,past)).rejects.toMatchObject({code:"CALENDAR_UNAVAILABLE"});}
  expect(report.rows).toHaveLength(800);
});
