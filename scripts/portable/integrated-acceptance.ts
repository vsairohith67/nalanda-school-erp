import {lookup} from "node:dns/promises";
import {randomBytes} from "node:crypto";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {admitArtifact} from "./admit-artifact";
import {assertRunningImage,hashBytes} from "./artifact-handoff";
import {assertHttpTarget} from "./http-target";

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
export function inspectTarget(artifact:ReturnType<typeof admitArtifact>,containerId:string){
 const docker=(args:string[])=>execFileSync("docker",["--context","default",...args],{encoding:"utf8",timeout:45_000,maxBuffer:4*1024*1024});
 const pinnedInfrastructure=(name:string)=>{
  const reference=readFileSync("deploy/portable/compose.yml","utf8").match(new RegExp(`^    image: (${name}:[^\\s]+@sha256:[a-f0-9]{64})$`,"m"))?.[1];assert(reference);
  const image=JSON.parse(docker(["image","inspect",reference]))[0];assert(image.RepoDigests.some((d:string)=>d.endsWith(reference.slice(reference.indexOf("@")))));return {reference,imageConfigDigest:image.Id};
 };
 const infrastructure={proxy:pinnedInfrastructure("caddy"),postgres:pinnedInfrastructure("postgres")};
 const bind=()=>{
  for(const file of ["deploy/portable/Caddyfile","deploy/portable/caddy-entrypoint.sh"]){assert.equal(hashBytes(readFileSync(file)),hashBytes(execFileSync("git",["show",`${artifact.source}:${file}`])));}
  const current=docker(["ps","-q","--no-trunc"]).trim().split(/\s+/).filter(Boolean);assert(current.length>0);
  const target=assertHttpTarget(JSON.parse(docker(["inspect",...current])),containerId,process.env.GITHUB_RUN_ID!,process.cwd(),infrastructure);
  for(const container of target.replicas){assertRunningImage(artifact,container);assert(container.Config.Env.includes("NODE_ENV=production"));assert(!container.Config.Env.some((e:string)=>e.startsWith("RELEASE_FEATURE_FLAGS_QA_ENABLED=")&&e!=="RELEASE_FEATURE_FLAGS_QA_ENABLED="));}
  return target;
 };
 const target=bind();
 return {target,bind,docker};
}
export function prepareProductionOff(fixturePath:string,containerId:string){
 const artifact=admitArtifact(path.resolve("artifact-evidence"));
 assert(/^[a-f0-9]{64}$/.test(containerId));assert(path.isAbsolute(fixturePath)&&fixturePath.startsWith(path.resolve("tmp/portable-staging")+path.sep));
 const {target}=inspectTarget(artifact,containerId);
 const password=process.env.INTEGRATED_SYNTHETIC_PASSWORD;assert(password&&password.length>=48);
 const raw=execFileSync("docker",["--context","default","exec","-i","-e","PORTABLE_ACCEPTANCE_FIXTURE=production-OFF",target.replicas[0].Id,"/nodejs/bin/node","dist/portable/acceptance-fixture.mjs"],{input:JSON.stringify({password,source:artifact.source}),encoding:"utf8",timeout:60_000,maxBuffer:8192,stdio:["pipe","pipe","pipe"]});
 const fixture=validateHttpFixture({...JSON.parse(raw),containerId},artifact.source);
 writeFileSync(fixturePath,JSON.stringify(fixture),{flag:"wx",mode:0o600});
}
export async function integratedProductionOff(fixturePath:string){
 const artifact=admitArtifact(path.resolve("artifact-evidence")); // No connection/process launch before admission.
 const f=validateHttpFixture(JSON.parse(readFileSync(fixturePath,"utf8")),artifact.source);
 const addresses=await lookup(new URL(f.origin).hostname,{all:true});assert(addresses.length>0&&addresses.every(a=>a.address==="127.0.0.1"||a.address==="::1"));
 const ca=process.env.NODE_EXTRA_CA_CERTS;assert(ca&&path.resolve(ca).startsWith(path.resolve("tmp/portable-staging")+path.sep)&&readFileSync(ca,"utf8").includes("BEGIN CERTIFICATE"));assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED,"0");
 const {target,bind,docker}=inspectTarget(artifact,f.containerId);
 const probe=Buffer.from(JSON.stringify({username:f.username,studentId:f.studentId,templateId:f.templateId,requestId:f.requestId,assessmentId:f.assessmentId})).toString("base64url");
 let databaseIdentity:string|undefined;
 const snapshot=()=>{
  const results=target.replicas.map(c=>JSON.parse(docker(["exec","-e","PORTABLE_ACCEPTANCE_READBACK=true",c.Id,"/nodejs/bin/node","dist/portable/acceptance-readback.mjs",probe]).trim()));
  for(const result of results){assert.equal(result.contract,"NALANDA_HTTP_READBACK_V1");assert(/^[a-f0-9]{64}$/.test(result.businessSha256));assert.equal(result.databaseIdentitySha256,results[0].databaseIdentitySha256);assert.equal(result.businessSha256,results[0].businessSha256);}
  if(databaseIdentity)assert.equal(results[0].databaseIdentitySha256,databaseIdentity,"HTTP_DATABASE_CHANGED");else databaseIdentity=results[0].databaseIdentitySha256;
  return results[0];
 };
 const password=process.env.INTEGRATED_SYNTHETIC_PASSWORD;assert(password&&password.length>=48);
 const completed:string[]=[];
 const initial=snapshot();
  const login=await fetch(new URL("/api/auth/login",f.origin),{method:"POST",headers:{"content-type":"application/json",origin:f.origin},body:JSON.stringify({identifier:f.username,password}),signal:AbortSignal.timeout(30_000),redirect:"manual"});assert.equal(login.status,200);const cookie=login.headers.getSetCookie().map(v=>v.split(";")[0]).join("; ");assert(cookie);
  const importBase={rows:[{academicYear:"2026-27",admissionNo:"SYNTHETIC-1C-IMPORT",studentName:"SYNTHETIC Import",className:"I",section:"A"}],mode:"skip",mappingVersion:"student-fields-v1"};
  const beforePreview=snapshot();
  const previewResponse=await fetch(new URL("/api/import/students",f.origin),{method:"POST",headers:{"content-type":"application/json",origin:f.origin,cookie},body:JSON.stringify({...importBase,action:"preview"}),signal:AbortSignal.timeout(30_000)});assert.equal(previewResponse.status,200);const preview=await previewResponse.json();assert(preview.receipt);assert.equal(snapshot().businessSha256,beforePreview.businessSha256);
  const cases=[
   {id:"graduation-draft",url:"/api/certificates",body:{studentId:f.studentId,academicYear:"2026-27",certificateType:"GRADUATION",requestId:f.requestId,templateId:f.templateId,purpose:"SYNTHETIC SCHOOL RECOGNITION ONLY"}},
   {id:"graduation-preview",url:"/api/certificates/source-preview",body:{studentId:f.studentId,academicYear:"2026-27",certificateType:"GRADUATION",purpose:"SYNTHETIC"}},
   {id:"prior-year-mutation",url:"/api/prior-year-concessions",body:{action:"PREPARE_LIABILITY",studentId:f.studentId,operatingYear:"2026-27",sourceYear:"2025-26",reason:"SYNTHETIC"}},
   {id:"student-import-confirm",url:"/api/import/students",body:{...importBase,action:"import",confirmed:true,receipt:preview.receipt}}
  ];
  for(const scenario of cases){const before=snapshot();const r=await fetch(new URL(scenario.url,f.origin),{method:"POST",headers:{"content-type":"application/json",origin:f.origin,cookie},body:JSON.stringify(scenario.body),signal:AbortSignal.timeout(30_000),redirect:"manual"});assert([400,403,404].includes(r.status));const body=await r.json();assert(typeof body.error==="string");assert.match(body.error,/unavailable|disabled|not enabled/i);assert.equal(snapshot().businessSha256,before.businessSha256);completed.push(scenario.id);}
  const final=snapshot();assert.equal(final.businessSha256,initial.businessSha256);const end=bind();assert.deepEqual(end.replicas.map(c=>c.Id),target.replicas.map(c=>c.Id));
  writeFileSync("integrated-off-result.json",JSON.stringify({source:artifact.source,imageConfigDigest:artifact.imageConfigDigest,classification:"AUTHENTICATED_PRODUCTION_HTTP",completed,businessMutation:"NONE",readback:"SAME_ADMITTED_REPLICAS_READ_ONLY_TRANSACTION",project:target.project,beforeMetadata:initial.metadata,afterMetadata:final.metadata,metadata:"Authentication/security audit and import-batch metadata counts are recorded separately from unchanged business rows."}),{flag:"wx"});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv[2]==="--discover")console.log(JSON.stringify({scenarios:INTEGRATED_SCENARIOS,browserMatrix:BROWSER_MATRIX,implemented:["productionOff","productionOffFixture","sameContainerReadback","separate-signed-PostgreSQL-test-build","real-MFA-HTTP-bulk-certificate-item-concession-actions","browser-login-student-import-download-matrix"],pending:["QA-ON-host-orchestration-and-guaranteed-teardown","remaining-business-authority-privacy-scenarios","remaining-browser-modal-marks-receipt-scenarios","native-owned-platform-orchestration-and-lifecycle"]}));
 else if(process.argv[2]==="--run-off"&&path.isAbsolute(process.argv[3]??"")){process.env.INTEGRATED_SYNTHETIC_PASSWORD=randomBytes(48).toString("base64url");prepareProductionOff(process.argv[3],process.argv[4]??"");void integratedProductionOff(process.argv[3]);}
 else if(process.argv[2]==="--off"&&path.isAbsolute(process.argv[3]??""))void integratedProductionOff(process.argv[3]);
 else if(process.argv[2]==="--run-on"&&/^[a-f0-9]{64}$/.test(process.argv[3]??""))void import("./integrated-on").then(m=>m.integratedOn(process.argv[3])).catch(()=>{console.error("INTEGRATED_ON_FAILED_OR_INCOMPLETE");process.exitCode=1;});
 else throw Error("INTEGRATED_ACCEPTANCE_PROFILE_NOT_IMPLEMENTED");
}
