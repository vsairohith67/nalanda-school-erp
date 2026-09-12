import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient, Prisma } from "@prisma/client";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { eligiblePreviousYear, normalizeIncomeSupport, reconcilePriorYear, sourceProposalStatus, type PriorYearPolicy } from "@/lib/prior-year-concession-policy";
import { authorizePriorYear, mutatePriorYear, priorYearBalance, readPriorYearIncome, type ConcessionActor } from "@/lib/prior-year-concessions";
import { createMiscReceipt, serializeMiscReceipt, validateMiscReceiptInput } from "@/lib/misc-income";
import { emptyPriorYearBackup, loadPriorYearBackup, restorePriorYearBackup, validatePriorYearBackup, PRIOR_YEAR_BACKUP_KEYS } from "@/lib/prior-year-concession-backup";
import { createBackupDocument, generateFullBackup } from "@/lib/backup";
import { parseAndValidateBackup } from "@/lib/restore";
import { restoreValidatedBackup } from "@/lib/restore-database";

// Authentication/step-up are isolated at their service boundaries in these database tests.
// Existing IAM and real-user-access suites separately exercise signed sessions and one-time grants.
vi.mock("@/lib/iam/effective-access", () => ({ evaluateEffectivePermission: async (_db: unknown, input: { userId: string }) => ({ allowed: !input.userId.includes("denied"), role: input.userId.includes("teacher") ? "TEACHER" : input.userId.includes("approver") ? "DIRECTOR" : "ACCOUNTANT", source: "USER_ALLOW", roleLabel: "Finance", profileNames: input.userId.includes("marks") ? ["MARKS_ENTRY_OPERATOR"] : [] }) }));
vi.mock("@/lib/real-user-access/step-up", () => ({ consumeStepUpGrant: async (_db: unknown, input: { stepUpToken: string }) => input.stepUpToken === "synthetic-step-up-proof" }));
// PostgreSQL transaction tests isolate the existing SQLite-only QA flag adapter.
// SQLite and direct API suites exercise the real OFF gate; this is not HTTP/runtime acceptance.
vi.mock("@/lib/release-feature-flag-runtime", async (original) => {
  const actual = await original<typeof import("@/lib/release-feature-flag-runtime")>();
  const pgTest = () => process.env.DATABASE_PROVIDER === "postgresql" && process.env.CI === "true" && process.env.POSTGRES_READINESS_SYNTHETIC_QA === "1";
  const enabled = (feature: { key: string }) => (process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED ?? "").split(",").includes(feature.key);
  return { ...actual, isOperationalReleaseFeatureEnabled: (feature: Parameters<typeof actual.isOperationalReleaseFeatureEnabled>[0]) => pgTest() ? enabled(feature) : actual.isOperationalReleaseFeatureEnabled(feature), assertOperationalReleaseFeature: (feature: Parameters<typeof actual.assertOperationalReleaseFeature>[0]) => { if (!pgTest()) return actual.assertOperationalReleaseFeature(feature); if (!enabled(feature)) throw new actual.ReleaseFeatureUnavailableError(); } };
});

const policy: PriorYearPolicy = { contract: "NALANDA_PRIOR_YEAR_CONCESSIONS_1A", version: 1, academicYears: [{ id: "2024-25", sequence: 40, startsOn: "2024-04-01", endsOn: "2025-03-31" }, { id: "2025-26", sequence: 41, startsOn: "2025-04-01", endsOn: "2026-03-31" }, { id: "2026-27", sequence: 42, startsOn: "2026-04-01", endsOn: "2027-03-31" }, { id: "2027-28", sequence: 43, startsOn: "2027-04-01", endsOn: "2028-03-31" }], incomeBands: [{ id: "BAND_1", label: "Synthetic annual band" }], incomeRetentionDays: 30, scholarshipsEnabled: false };
let db: PrismaClient;
const postgres = process.env.DATABASE_PROVIDER === "postgresql";
const originalUrl = process.env.DATABASE_URL;
const suffix = randomUUID();
const actor = (role: string): ConcessionActor => ({ userId: `${role}-${suffix}`, sessionId: `session-${role}`, roleAssignmentId: `assignment-${role}` });
const prep = actor("preparer"), reviewer = actor("reviewer"), approver = actor("approver"), applier = actor("applier");
const request = (action: string, extra: Record<string, unknown> = {}) => ({ action, requestKey: randomUUID(), reason: "Wholly invented finance review evidence", stepUpToken: "synthetic-step-up-proof", ...extra });
const mutate = (who: ConcessionActor, input: unknown) => mutatePriorYear(db, who, input, { policy });
async function makeStudent() {
  const id = randomUUID();
  const student = await db.student.create({ data: { id, admissionNo: `SYNTHETIC-${id}`, studentName: "Invented Duplicate Name", fatherName: "Invented Guardian", className: "VI", phone1: "SYNTHETIC-NO-CONTACT", academicYear: "2026-27", discountPercent: 12, academicYearEnrollments: { create: [{ academicYear: "2025-26", className: "V" }, { academicYear: "2026-27", className: "VI" }, { academicYear: "2024-25", className: "IV" }] } } });
  return { student, enrollment: await db.academicYearEnrollment.findUniqueOrThrow({ where: { studentId_academicYear: { studentId: id, academicYear: "2025-26" } } }) };
}
async function liability(opening = "1000.00", paid = "200.00") {
  const fixture = await makeStudent();
  const payment = paid === "0" ? null : await makePayment(fixture.student.id, paid);
  const proposed = await mutate(prep, request("PREPARE_LIABILITY", { studentId: fixture.student.id, operatingYear: "2026-27", sourceYear: "2025-26", sourceEnrollmentId: fixture.enrollment.id, identityVerified: true, openingAmount: opening, existingCredits: "50.00", sourceReferences: ["INVENTED-TERM-1-REVIEW"], provenance: "Invented opening and approved-credit review" }));
  await mutate(reviewer, request("VERIFY", { liabilityId: proposed.liabilityId, expectedVersion: 1, identityVerified: true, balanceVerified: true, paymentIds: payment ? [payment.id] : [] }));
  return { ...fixture, liabilityId: proposed.liabilityId, payment };
}
async function makePayment(studentId: string, amount: string) {
  const student = await db.student.findUniqueOrThrow({ where: { id: studentId } });
  return db.payment.create({ data: { date: new Date("2026-09-01Z"), receiptNo: `SYNTHETIC-${randomUUID()}`, admissionNo: student.admissionNo, studentId, studentName: student.studentName, className: student.className, amountPaid: Number(amount), paymentMode: "Cash", receivedAccount: "Cash", feeType: "Old Due" } });
}
async function approvedCase(liabilityId: string, amount = "300.00", kind = "SCHOOL_WAIVER") {
  const prepared = await mutate(prep, request("PREPARE", { liabilityId, kind, requestedAmount: amount, applicantReference: "INVENTED-APPLICANT", validFrom: "2020-01-01", validTo: "2090-01-01" }));
  await mutate(prep, request("SUBMIT", { caseId: prepared.caseId, expectedVersion: 1 }));
  await mutate(reviewer, request("REVIEW", { caseId: prepared.caseId, expectedVersion: 2 }));
  const balance = await priorYearBalance(db, liabilityId, policy);
  await mutate(approver, request("APPROVE", { caseId: prepared.caseId, expectedVersion: 3, approvedAmount: amount, balanceHash: balance.hash, balanceVersion: balance.liability.version }));
  return prepared.caseId!;
}


import { createRequire } from "node:module";
import { populateCertificateRecoveryFixture } from "./helpers/recovery-certificate-fixture";
import contracts from "@/config/recovery-source-contracts.json";
const require=createRequire(import.meta.url);
const owned=path.resolve("tmp/recovery-compatibility",suffix);
const gitText=(head:string,file:string)=>execFileSync("git",["show",head+":"+file],{encoding:"utf8",maxBuffer:64*1024*1024});
async function freshDatabase(label:string,version=48){
 const source=contracts.sources[String(version) as keyof typeof contracts.sources],directory=path.join(owned,label);mkdirSync(directory,{recursive:true});
 let url="file:"+path.join(directory,"synthetic.db").replaceAll("\\","/");
 if(postgres){if(process.env.CI!=="true"||process.env.POSTGRES_READINESS_SYNTHETIC_QA!=="1"||!originalUrl)throw Error("EPHEMERAL_CI_POSTGRES_REQUIRED");const connection=new URL(originalUrl);connection.searchParams.set("schema","recovery_"+label+"_"+suffix.replaceAll("-",""));url=connection.toString();}
 if(!postgres)writeFileSync(path.join(directory,"synthetic.db"),"",{flag:"wx"});
 const prefix=postgres?"prisma/postgresql/":"prisma/",schemaPath=path.join(directory,"schema.prisma");
 writeFileSync(schemaPath,version===48?readFileSync(prefix+"schema.prisma","utf8"):gitText(source.sourceHead!,prefix+"schema.prisma"));
 for(const migration of source.migrations.filter(m=>m.path.startsWith(prefix+"migrations/"))){const file=path.join(directory,migration.path.slice(prefix.length));mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,version===48?readFileSync(migration.path,"utf8"):gitText(source.sourceHead!,migration.path));}
 execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy","--schema",schemaPath],{env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},stdio:"pipe"});return url;
}
async function initialise(url:string){
 db=new PrismaClient({datasourceUrl:url});vi.stubEnv("DATABASE_URL",url);
 await db.schoolSettings.create({data:{id:"school",schoolName:"NALANDA PUBLIC SCHOOL",addressLine1:"SYNTHETIC ONLY",city:"SYNTHETIC",phone:"NO-CONTACT",academicYear:"2026-27"}});
 for(const role of ["preparer","reviewer","approver","applier"])await db.user.create({data:{id:actor(role).userId,name:"SYNTHETIC "+role,username:actor(role).userId,passwordHash:"SYNTHETIC-NONLOGIN",role:role==="approver"?"DIRECTOR":"ACCOUNTANT"}});
}
async function concessions(){
 const f=await liability(),reversed=await approvedCase(f.liabilityId);await mutate(applier,request("APPLY",{caseId:reversed,expectedVersion:4}));await mutate(approver,request("REVERSE",{caseId:reversed,expectedVersion:5}));
 const active=await approvedCase(f.liabilityId,"100");await mutate(applier,request("APPLY",{caseId:active,expectedVersion:4}));
 const pending=await mutate(prep,request("PREPARE",{liabilityId:f.liabilityId,kind:"SCHOOL_WAIVER",requestedAmount:"10",applicantReference:"SYNTHETIC",validFrom:"2020-01-01",validTo:"2090-01-01"}));await mutate(prep,request("INCOME",{caseId:pending.caseId,expectedVersion:1,income:{status:"PROVIDED",exactAnnualAmount:"0.00",period:"ANNUAL",currency:"INR"}}));
 const item=await db.miscIncomeItem.create({data:{itemCode:"BELT",name:"SYNTHETIC Belt",category:"UNIFORM_ACCESSORY",studentLinkPolicy:"REQUIRED",rates:{create:[{academicYear:"2026-27",amount:"10.25",effectiveTo:new Date("2026-06-30Z")},{academicYear:"2026-27",amount:"12.50",effectiveFrom:new Date("2026-07-01Z")}]}}});
 for(const date of ["2026-06-01","2026-07-01"])await createMiscReceipt(db,{receiptDate:date,academicYear:"2026-27",studentId:f.student.id,paymentMethod:"CASH",lines:[{itemId:item.id,quantity:3}]},prep.userId);
 return {liabilityId:f.liabilityId,active,reversed};
}
async function originalExporter(version:number){
 const root=path.join(owned,"source-"+version);mkdirSync(root,{recursive:true});const head=contracts.sources[String(version) as "45"].sourceHead;
 const tar=path.join(root,"source.tar");writeFileSync(tar,execFileSync("git",["archive",head,"lib","config","package.json"],{maxBuffer:96*1024*1024}));execFileSync("tar",["-xf",tar,"-C",root]);
 writeFileSync(path.join(root,"fixture.ts"),readFileSync("tests/helpers/recovery-certificate-fixture.ts","utf8").replaceAll('"../../lib/','"@/lib/'));writeFileSync(path.join(root,"entry.ts"),'export * from "./lib/backup";'+(version===46?' export * from "./fixture";':''));
 const testOnlyFlagAdapter=postgres&&version===46;
 if(testOnlyFlagAdapter){const url=new URL(process.env.DATABASE_URL!);if(process.env.CI!=="true"||process.env.NODE_ENV!=="test"||process.env.POSTGRES_READINESS_SYNTHETIC_QA!=="1"||!/^recovery_source46_[a-f0-9]+$/.test(url.searchParams.get("schema")??""))throw Error("TEST_ONLY_FLAG_ADAPTER_SCOPE_DENIED");}
 const bundlePath=path.join(root,"backup.cjs");
 await require("esbuild").build({entryPoints:[path.join(root,"entry.ts")],outfile:bundlePath,bundle:true,platform:"node",format:"cjs",packages:"external",alias:{"@":root},logLevel:"silent",plugins:testOnlyFlagAdapter?[{name:"isolated-service-test-flags",setup(build:any){build.onResolve({filter:/release-feature-flag-runtime(?:\.ts)?$/},()=>({path:"nalanda-recovery-test-flags",external:true}));}}]:[]});
 if(!testOnlyFlagAdapter)return require(bundlePath);
 const flags=await import("@/lib/release-feature-flag-runtime"),fallback=createRequire(bundlePath),module={exports:{}};
 // Per-load facade for the admitted service-test seam; source bytes and global module cache are unchanged.
 const invoke=require("node:vm").compileFunction(readFileSync(bundlePath,"utf8"),["module","exports","require","__dirname","__filename"],{filename:bundlePath});
 invoke(module,module.exports,(id:string)=>id==="nalanda-recovery-test-flags"?flags:fallback(id),root,bundlePath);
 console.log("TEST_ONLY_FLAG_ADAPTER: isolated original v46 PostgreSQL service fixture; no HTTP acceptance");return module.exports;
}
function originalReadClient(version:number){
 if(version===46)return db;
 const schema=gitText(contracts.sources[String(version) as "45"].sourceHead,"prisma/schema.prisma");const body=schema.match(/model StudentCertificate \{([\s\S]*?)\n\}/)![1];
 const select=Object.fromEntries(body.split(/\r?\n/).map(l=>l.trim().split(/\s+/)).filter(parts=>/^(String|Int|Float|Decimal|Boolean|DateTime|Json|Bytes)\??$/.test(parts[1]??"")).map(parts=>[parts[0],true]));
 if("workflowKey" in select||"supersedesCertificateId" in select)throw Error("SOURCE_SCHEMA_UNEXPECTED_COLUMNS");
 return new Proxy(db,{get(target,key){if(key==="studentCertificate")return {findMany:(args:any={})=>target.studentCertificate.findMany({...args,select})};const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}});
}
beforeAll(()=>{vi.stubEnv("NODE_ENV","test");vi.stubEnv("APP_ORIGIN","http://127.0.0.1:3000");vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_MODE","SYNTHETIC_COPY_ONLY");vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","prior-year-concessions-1a,student-linked-items-1a,certificate-graduation-exit-1a,certificate-bulk-issue-1a,certificate-verification-1a");vi.stubEnv("AUTH_SECRET","SYNTHETIC-only-recovery-test-secret-000000");vi.stubEnv("AUTH_MFA_KEYRING_JSON",JSON.stringify({active:"SYNTHETIC",keys:{SYNTHETIC:Buffer.alloc(32,7).toString("base64")}}));});
afterAll(async()=>{await db?.$disconnect();vi.unstubAllEnvs();});
describe("explicit nonempty source-contract restoration",()=>{
 it.each([45,46,47,48])("restores genuine source v%i into v48 without record or artifact loss, twice",async(version)=>{
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED",version===46?"certificate-graduation-exit-1a,certificate-bulk-issue-1a,certificate-verification-1a":"prior-year-concessions-1a,student-linked-items-1a,certificate-graduation-exit-1a,certificate-bulk-issue-1a,certificate-verification-1a");
  const sourceUrl=await freshDatabase("source"+version,version);await initialise(sourceUrl);
  const baseline=await makeStudent();await makePayment(baseline.student.id,"20");
  const original=version!==48?await originalExporter(version):null;
  const certificate=version===46?await original.populateCertificateRecoveryFixture(db):version===48?await populateCertificateRecoveryFixture(db):null;
  const concession=version===47||version===48?await concessions():null;
  const payload=version===48?await generateFullBackup(db,{generatedBy:"SYNTHETIC v48"}):await original.generateFullBackup(originalReadClient(version),{generatedBy:"SYNTHETIC ORIGINAL SOURCE v"+version});
  expect(payload.metadata.backupVersion).toBe(version);expect(payload.students.length).toBeGreaterThan(0);expect(payload.payments.length).toBeGreaterThan(0);
  if(certificate){expect(payload.certificateIssueArtifacts.length).toBeGreaterThan(1);expect(payload.certificateRequestCharges.length).toBeGreaterThan(0);expect(payload.certificateBulkBatches.length).toBeGreaterThan(0);}
  if(concession)for(const key of PRIOR_YEAR_BACKUP_KEYS)expect(payload[key].length,key).toBeGreaterThan(0);
  if(version===48){
   for(const key of ["studentCertificates","certificateIssueArtifacts"]){const invalid=JSON.parse(JSON.stringify(payload));invalid[key][0].unreviewedPrivacyMetadata="SYNTHETIC UNADMITTED FIELD";expect(()=>parseAndValidateBackup(JSON.stringify(invalid))).toThrow("CERTIFICATE_BACKUP_UNKNOWN_FIELD");}
   const missing=JSON.parse(JSON.stringify(payload));const graduation=missing.studentCertificates.find((row:any)=>row.certificateType==="GRADUATION");delete graduation.workflowKey;missing.certificateIssueArtifacts=missing.certificateIssueArtifacts.filter((row:any)=>row.certificateId!==graduation.id);missing.metadata.counts.certificateIssueArtifacts=missing.certificateIssueArtifacts.length;expect(()=>parseAndValidateBackup(JSON.stringify(missing))).toThrow("Required Graduation workflow identity missing");
   const cycle=JSON.parse(JSON.stringify(payload));cycle.studentCertificates[0].supersedesCertificateId=cycle.studentCertificates[0].id;expect(()=>parseAndValidateBackup(JSON.stringify(cycle))).toThrow("CERTIFICATE_SUPERSESSION_CYCLE");
   const absent=JSON.parse(JSON.stringify(payload));absent.studentCertificateVersions[0].supersedesVersionId="synthetic-missing-version";expect(()=>parseAndValidateBackup(JSON.stringify(absent))).toThrow("CERTIFICATE_SUPERSESSION_OWNERSHIP_INVALID");
  }
  const validated=parseAndValidateBackup(JSON.stringify(payload));
  const sourceCounts={students:await db.student.count(),payments:await db.payment.count()};
  for(let pass=0;pass<2;pass++)execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy","--schema",postgres?"prisma/postgresql/schema.prisma":"prisma/schema.prisma"],{env:{...process.env,DATABASE_URL:sourceUrl,DIRECT_URL:sourceUrl},stdio:"pipe"});
  expect(await db.student.count()).toBe(sourceCounts.students);expect(await db.payment.count()).toBe(sourceCounts.payments);
  const migrationRows=await db.$queryRawUnsafe<{migration_name:string;checksum:string}[]>('SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');
  const migrationPrefix=postgres?"prisma/postgresql/migrations/":"prisma/migrations/";
  for(const migration of contracts.sources["48"].migrations.filter(m=>m.path.startsWith(migrationPrefix)))expect(migrationRows.find(row=>row.migration_name===migration.path.split("/").at(-2))?.checksum,migration.path).toBe(migration.sha256);

  const target=new PrismaClient({datasourceUrl:await freshDatabase("target"+version)});
  try{
   for(let round=0;round<2;round++){
    await restoreValidatedBackup(target,validated,{id:prep.userId,name:"SYNTHETIC RESTORE"});
    expect(await target.payment.count()).toBe(await db.payment.count());expect((await target.payment.aggregate({_sum:{amountPaid:true}}))._sum.amountPaid).toEqual((await db.payment.aggregate({_sum:{amountPaid:true}}))._sum.amountPaid);
    if(certificate){for(const row of payload.certificateIssueArtifacts){const restored=await target.certificateIssueArtifact.findUniqueOrThrow({where:{id:row.id}});expect(restored.pdfHash).toBe(row.pdfHash);expect(restored.pdfBase64).toBe(row.pdfBase64);expect(restored.snapshotHash).toBe(row.snapshotHash);}expect((await target.studentCertificate.findUniqueOrThrow({where:{id:certificate.original}})).status).toBe("CANCELLED");expect((await target.studentCertificate.findUniqueOrThrow({where:{id:certificate.replacement}})).supersedesCertificateId).toBe(certificate.original);expect(await target.miscIncomeReceipt.count()).toBe(await db.miscIncomeReceipt.count());}
    if(concession){expect((await priorYearBalance(target,concession.liabilityId,policy)).totals.remaining.toFixed(2)).toBe("650.00");expect(await target.priorYearConcessionEvent.count()).toBe(await db.priorYearConcessionEvent.count());expect(await target.studentItemReceiptSnapshot.count()).toBe(await db.studentItemReceiptSnapshot.count());expect((await target.priorYearIncomeSupport.findMany()).map(r=>r.exactAmountEnvelope)).toEqual((await db.priorYearIncomeSupport.findMany()).map(r=>r.exactAmountEnvelope));}
   }
   if(version===48){
    const failing=new PrismaClient({datasourceUrl:await freshDatabase("collision_and_interruption")});
    try{
     const series=payload.certificateNumberSeries[0];const collision=await failing.certificateNumberSeries.create({data:{id:"synthetic-collision",seriesCode:series.seriesCode,certificateType:series.certificateType,prefix:"SYNTHETIC",nextNumber:1}});
     await expect(restoreValidatedBackup(failing,validated,{id:prep.userId,name:"SYNTHETIC COLLISION"})).rejects.toThrow("CERTIFICATE_RESTORE_IDENTITY_COLLISION");
     expect(await failing.student.count()).toBe(0);expect(await failing.payment.count()).toBe(0);expect(await failing.certificateNumberSeries.count()).toBe(1);
     await failing.certificateNumberSeries.delete({where:{id:collision.id}});
     const interrupted=new Proxy(failing,{get(client,key){if(key==="$transaction")return (callback:any,options:any)=>client.$transaction((tx:any)=>callback(new Proxy(tx,{get(transaction,field){if(field==="certificateIssueArtifact")return new Proxy(transaction[field],{get(delegate,method){if(method==="create")return async()=>{throw Error("SYNTHETIC_INTERRUPTION");};const value=delegate[method];return typeof value==="function"?value.bind(delegate):value;}});return transaction[field];}})),options);const value=Reflect.get(client,key);return typeof value==="function"?value.bind(client):value;}});
     await expect(restoreValidatedBackup(interrupted,validated,{id:prep.userId,name:"SYNTHETIC INTERRUPT"})).rejects.toThrow("BACKUP_RESTORE_ATOMIC_FAILURE");
     expect(await failing.student.count()).toBe(0);expect(await failing.payment.count()).toBe(0);expect(await failing.certificateIssueArtifact.count()).toBe(0);
     await restoreValidatedBackup(failing,validated,{id:prep.userId,name:"SYNTHETIC RETRY"});expect(await failing.certificateIssueArtifact.count()).toBe(payload.certificateIssueArtifacts.length);
    }finally{await failing.$disconnect();}
   }
   const roundtrip=await generateFullBackup(target,{generatedBy:"SYNTHETIC ROUNDTRIP"});expect(roundtrip.metadata.backupVersion).toBe(48);expect(()=>parseAndValidateBackup(JSON.stringify(roundtrip))).not.toThrow();
   for(const change of [(p:any)=>p.metadata.schemaContract="unknown",(p:any)=>p.metadata.schemaFingerprint.sqlite="0".repeat(64),(p:any)=>p.metadata.backupVersion=49]){const invalid=JSON.parse(JSON.stringify(roundtrip));change(invalid);expect(()=>parseAndValidateBackup(JSON.stringify(invalid))).toThrow();}
  }finally{await target.$disconnect();await db.$disconnect();}
 },240000);
});
