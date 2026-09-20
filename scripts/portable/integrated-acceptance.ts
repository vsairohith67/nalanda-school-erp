import {lookup} from "node:dns/promises";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {PrismaClient} from "@prisma/client";
import {admitArtifact} from "./admit-artifact";
import {assertRunningImage,hashBytes} from "./artifact-handoff";

export const BROWSER_MATRIX=[{width:1366,height:768},{width:390,height:844},{width:320,height:844}].flatMap(viewport=>["light","dark"].map(colorScheme=>({viewport,colorScheme,reducedMotion:"reduce",zoom:2})));
export const INTEGRATED_SCENARIOS=Object.freeze({
 productionOff:["graduation-draft","graduation-preview","prior-year-mutation","student-import-confirm"],
 syntheticOn:["graduation-issue-reprint-reissue-void","charge-retry-idempotency","student-item-dated-rate-quantity","concession-prepare-approve-apply-reverse","restricted-income","controlled-onboarding","legacy-governed-separation","projected-upload-forged-field-rejection","year-filtered-csv-pdf","revoked-expired-linked-child","stale-preview-concurrent-edit","locked-marks"],
 browser:["desktop-mobile-light-dark","320px-error-reflow","keyboard-focus-Escape","zoom-reduced-motion","loading-error-denied","stale-selection","private-data-flash","console-hydration","actual-download-bytes"],
 native:["authenticated-launch","session-revocation","file-picker-download","keyboard-navigation","offline-current-year-fee-expense-misc-income","FLAG_SECURE"]
});
type Fixture={contract:"NALANDA_INTEGRATED_HTTP_FIXTURE_V1";source:string;phase:"production-OFF";origin:string;containerId:string;username:string;studentId:string;templateId:string;requestId:string;assessmentId:string};
export function validateHttpFixture(raw:unknown,source:string):Fixture{
 const f=raw as Fixture;assert.equal(f.contract,"NALANDA_INTEGRATED_HTTP_FIXTURE_V1");assert.equal(f.source,source);assert.equal(f.phase,"production-OFF");
 const origin=new URL(f.origin);assert(["portable-staging.localhost"].includes(origin.hostname));assert.equal(origin.protocol,"https:");assert.equal(origin.port,"8443");assert.equal(origin.pathname,"/");assert(!origin.username&&!origin.password&&!origin.search&&!origin.hash);
 assert(/^[a-f0-9]{12,64}$/.test(f.containerId));assert(/^synthetic-/.test(f.username));for(const key of ["studentId","templateId","requestId","assessmentId"] as const)assert(typeof f[key]==="string"&&f[key].length>0&&f[key].length<100);return f;
}
async function businessSnapshot(db:PrismaClient){
 const rows=await Promise.all([db.student.findMany({orderBy:{id:"asc"}}),db.payment.findMany({orderBy:{id:"asc"}}),db.studentCertificate.findMany({orderBy:{id:"asc"}}),db.studentCertificateVersion.findMany({orderBy:{id:"asc"}}),db.certificateIssueArtifact.findMany({orderBy:{id:"asc"}}),db.certificateRequestCharge.findMany({orderBy:{id:"asc"}}),db.miscIncomeReceipt.findMany({orderBy:{id:"asc"}}),db.priorYearConcessionCase.findMany({orderBy:{id:"asc"}}),db.priorYearConcessionEvent.findMany({orderBy:{id:"asc"}}),db.studentMark.findMany({orderBy:{id:"asc"}}),db.examMarkEntry.findMany({orderBy:{id:"asc"}})]);
 return hashBytes(JSON.stringify(rows));
}
export async function integratedProductionOff(fixturePath:string){
 const artifact=admitArtifact(path.resolve("artifact-evidence")); // No connection/process launch before admission.
 const f=validateHttpFixture(JSON.parse(readFileSync(fixturePath,"utf8")),artifact.source);
 const addresses=await lookup(new URL(f.origin).hostname,{all:true});assert(addresses.length>0&&addresses.every(a=>a.address==="127.0.0.1"||a.address==="::1"));
 const ca=process.env.NODE_EXTRA_CA_CERTS;assert(ca&&path.resolve(ca).startsWith(path.resolve("tmp/portable-staging")+path.sep)&&readFileSync(ca,"utf8").includes("BEGIN CERTIFICATE"));assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED,"0");
 const container=JSON.parse(execFileSync("docker",["--context","default","inspect",f.containerId],{encoding:"utf8",timeout:30_000}))[0];assertRunningImage(artifact,container);
 assert(container.Config.Env.includes("NODE_ENV=production"));assert(!container.Config.Env.some((e:string)=>e.startsWith("RELEASE_FEATURE_FLAGS_QA_ENABLED=")&&e!=="RELEASE_FEATURE_FLAGS_QA_ENABLED="));
 const connection=new URL(process.env.DATABASE_URL??"");assert.equal(connection.protocol,"postgresql:");assert(["127.0.0.1","localhost"].includes(connection.hostname));assert(new RegExp(`^recovery_http_${process.env.GITHUB_RUN_ID}_[a-f0-9]+$`).test(connection.searchParams.get("schema")??""));
 const password=process.env.INTEGRATED_SYNTHETIC_PASSWORD;assert(password&&password.length>=48);
 const db=new PrismaClient();const completed:string[]=[];
 try{
  assert.equal((await db.user.findUniqueOrThrow({where:{username:f.username}})).role,"SUPER_ADMIN");
  assert((await db.student.findUniqueOrThrow({where:{id:f.studentId}})).studentName.startsWith("SYNTHETIC"));
  assert.equal((await db.certificateTemplate.findUniqueOrThrow({where:{id:f.templateId}})).certificateType,"GRADUATION");
  assert(await db.studentCertificateRequest.findUnique({where:{id:f.requestId}}));assert(await db.examAssessment.findUnique({where:{id:f.assessmentId}}));
  const login=await fetch(new URL("/api/auth/login",f.origin),{method:"POST",headers:{"content-type":"application/json",origin:f.origin},body:JSON.stringify({identifier:f.username,password}),signal:AbortSignal.timeout(30_000),redirect:"manual"});assert.equal(login.status,200);const cookie=login.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ");assert(cookie);
  const importBase={rows:[{academicYear:"2026-27",admissionNo:"SYNTHETIC-1C-IMPORT",studentName:"SYNTHETIC Import",className:"I",section:"A"}],mode:"skip",mappingVersion:"student-fields-v1"};
  const beforePreview=await businessSnapshot(db);
  const previewResponse=await fetch(new URL("/api/import/students",f.origin),{method:"POST",headers:{"content-type":"application/json",origin:f.origin,cookie},body:JSON.stringify({...importBase,action:"preview"}),signal:AbortSignal.timeout(30_000)});assert.equal(previewResponse.status,200);const preview=await previewResponse.json();assert(preview.receipt);assert.equal(await businessSnapshot(db),beforePreview);
  const cases=[
   {id:"graduation-draft",url:"/api/certificates",body:{studentId:f.studentId,academicYear:"2026-27",certificateType:"GRADUATION",requestId:f.requestId,templateId:f.templateId,purpose:"SYNTHETIC SCHOOL RECOGNITION ONLY"}},
   {id:"graduation-preview",url:"/api/certificates/source-preview",body:{studentId:f.studentId,academicYear:"2026-27",certificateType:"GRADUATION",purpose:"SYNTHETIC"}},
   {id:"prior-year-mutation",url:"/api/prior-year-concessions",body:{action:"PREPARE_LIABILITY",studentId:f.studentId,operatingYear:"2026-27",sourceYear:"2025-26",reason:"SYNTHETIC"}},
   {id:"student-import-confirm",url:"/api/import/students",body:{...importBase,action:"import",confirmed:true,receipt:preview.receipt}}
  ];
  for(const scenario of cases){const before=await businessSnapshot(db);const r=await fetch(new URL(scenario.url,f.origin),{method:"POST",headers:{"content-type":"application/json",origin:f.origin,cookie},body:JSON.stringify(scenario.body),signal:AbortSignal.timeout(30_000),redirect:"manual"});assert([400,403,404].includes(r.status));const body=await r.json();assert(typeof body.error==="string");assert.match(body.error,/unavailable|disabled|not enabled/i);assert.equal(await businessSnapshot(db),before);completed.push(scenario.id);}
  writeFileSync("integrated-off-result.json",JSON.stringify({source:artifact.source,imageConfigDigest:artifact.imageConfigDigest,classification:"AUTHENTICATED_PRODUCTION_HTTP",completed,businessMutation:"NONE",metadata:"Authentication/security audit writes are expected; business rows are compared independently."}),{flag:"wx"});
 }finally{await db.$disconnect();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv[2]==="--discover")console.log(JSON.stringify({scenarios:INTEGRATED_SCENARIOS,browserMatrix:BROWSER_MATRIX,implemented:["productionOff"],pending:["integrated-QA-ON-image-profile-and-fixture-preparation","browser-driver","native-driver"]}));
 else if(process.argv[2]==="--off"&&path.isAbsolute(process.argv[3]??""))void integratedProductionOff(process.argv[3]);
 else throw Error("INTEGRATED_ACCEPTANCE_PROFILE_NOT_IMPLEMENTED");
}
