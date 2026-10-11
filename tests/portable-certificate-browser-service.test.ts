import {beforeAll,afterAll,it,expect,vi} from "vitest";
import {PrismaClient} from "@prisma/client";
import {randomUUID} from "node:crypto";
import {mkdtempSync,rmSync,readFileSync,readdirSync,lstatSync,existsSync} from "node:fs";
import {DatabaseSync,backup} from "node:sqlite";
import {tmpdir} from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {certificateBrowserProbe} from "../scripts/portable/certificate-browser-probe";
import {defaultPermissionMatrix} from "../lib/role-permissions";
import {createCertificateRequest,transitionCertificateRequest} from "../lib/certificate-requests";
import {assertCertificateStep} from "../scripts/portable/certificate-browser-assertions";
import {prepareCertificateCharge,approveCertificateCharge,collectCertificateCharge} from "../lib/certificate-charges";
import {createStudentCertificateDraft,transitionCertificate,issueCertificate,createCertificateVersion,cancelIssuedCertificate} from "../lib/student-certificates";
import {inspectCertificateDocument} from "../scripts/portable/certificate-browser-document";
import {renderCertificatePdf} from "../lib/certificate-pdf";

// SERVICE evidence on an isolated database. Guard/MFA preparation is stubbed:
// this test cannot admit an artifact, produce a session or claim Browser login.
vi.mock("../scripts/portable/acceptance-http",()=>({assertSyntheticServingTarget:()=>{},provisionSyntheticMfa:async()=>{},nextTotp:async()=>{throw Error("HARNESS_HAS_NO_LOGIN");}}));
vi.mock("../lib/portable-runtime/synthetic-capability",()=>({syntheticFeatureCapability:()=>({source:"a".repeat(40),runId:"123",attempt:"1",features:[{key:"certificate-graduation-exit-1a",version:1,environment:"PRODUCTION",activationRole:"SUPER_ADMIN"}]})}));
const root=mkdtempSync(path.join(tmpdir(),"nalanda-certificate-browser-service-")),schema=`cb_${randomUUID().replaceAll("-","")}`,postgres=process.env.DATABASE_PROVIDER==="postgresql";
const rootIdentity=lstatSync(root);
let db:PrismaClient;
const bound={source:"a".repeat(40),runId:"123",attempt:"1",iteration:randomUUID()},password="HARNESS_FIXTURE_ONLY_"+randomUUID()+randomUUID();
beforeAll(async()=>{
 let url="file:"+path.join(root,"synthetic.db").replaceAll("\\","/");
 if(postgres){expect(process.env.CI).toBe("true");expect(process.env.POSTGRES_READINESS_SYNTHETIC_QA).toBe("1");const target=new URL(process.env.DATABASE_URL!);target.searchParams.set("schema",schema);url=target.toString();}
 if(postgres)execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy","--schema","prisma/postgresql/schema.prisma"],{env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},stdio:"pipe"});
 else{
  // Service fixture, not a second migration-runner acceptance test. Apply every
  // unchanged active migration to a fresh memory database, then snapshot once
  // into this run's new file. This avoids hundreds of durable DDL flushes on
  // hosted Windows; no timeout, migration content or assertion is relaxed.
  const sql=new DatabaseSync(":memory:");try{
   for(const migration of readdirSync("prisma/migrations",{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort())sql.exec(readFileSync(path.join("prisma/migrations",migration,"migration.sql"),"utf8"));
   expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);expect(Object.values(sql.prepare("PRAGMA integrity_check").get()!)).toEqual(["ok"]);
   expect(existsSync(path.join(root,"synthetic.db"))).toBe(false);await backup(sql,path.join(root,"synthetic.db"));
  }finally{sql.close();}
 }
 db=new PrismaClient({datasourceUrl:url});vi.stubEnv("DATABASE_URL",url);vi.stubEnv("NODE_ENV","test");vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_MODE","SYNTHETIC_COPY_ONLY");vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","certificate-graduation-exit-1a");
 await db.rolePermission.createMany({data:Object.entries(defaultPermissionMatrix()).flatMap(([role,entries])=>Object.entries(entries).map(([permission,enabled])=>({role,permission,enabled})))});
 await db.schoolSettings.create({data:{id:"school",schoolName:"NALANDA PUBLIC SCHOOL",academicYear:"2026-27",addressLine1:"SYNTHETIC",city:"SYNTHETIC",phone:"SYNTHETIC-NO-CONTACT"}});
 await db.certificateNumberSeries.create({data:{seriesCode:"SYNTHETIC",certificateType:"GRADUATION",academicYear:"2026-27",prefix:"SYNTHETIC-"}});
 await db.miscIncomeItem.create({data:{itemCode:"GRADUATION",name:"SYNTHETIC",category:"CERTIFICATE",studentLinkPolicy:"REQUIRED",rates:{create:{academicYear:"2026-27",amount:"125"}}}});
},60_000);
afterAll(async()=>{if(db){if(postgres)await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await db.$disconnect();}const current=lstatSync(root);expect(current.isSymbolicLink()).toBe(false);expect(current.ino).toBe(rootIdentity.ino);expect(current.dev).toBe(rootIdentity.dev);expect(path.dirname(path.resolve(root))).toBe(path.resolve(tmpdir()));rmSync(root,{recursive:true});expect(existsSync(root)).toBe(false);vi.unstubAllEnvs();});
it("SERVICE_OR_ROUTE_HANDLER: prepares least-privilege actors, no outcomes, scope/refusal and real request audit",async()=>{
 const call=(operation:string,more:any={})=>certificateBrowserProbe(db,{...bound,operation,...more});
 const fixture:any=await call("prepare",{password});expect(fixture.actors.preparer.id).not.toBe(fixture.actors.reviewer.id);expect(fixture.actors.financePreparer.id).not.toBe(fixture.actors.financeApprover.id);
 const before=JSON.parse(JSON.stringify(await call("snapshot")));expect(before.requests).toEqual([]);expect(before.certificates).toEqual([]);expect(before.receipts).toEqual([]);
 await expect(call("prepare",{password})).rejects.toThrow("FIXTURE_REUSE");
 await expect(certificateBrowserProbe(db,{...bound,source:"b".repeat(40),operation:"snapshot"})).rejects.toThrow();
 const request=await createCertificateRequest(db,{studentId:fixture.studentId,academicYear:"2026-27",certificateType:"GRADUATION",purpose:"SYNTHETIC school recognition",idempotencyKey:randomUUID()},{id:fixture.actors.preparer.id});
 const after=JSON.parse(JSON.stringify(await call("snapshot")));assertCertificateStep(before,after,"request",fixture.actors.preparer.id);
 await transitionCertificateRequest(db,request.id,"review",fixture.actors.preparer.id);const reviewed=JSON.parse(JSON.stringify(await call("snapshot")));assertCertificateStep(after,reviewed,"review",fixture.actors.preparer.id,request.id);
 await expect(transitionCertificateRequest(db,request.id,"approve",fixture.actors.preparer.id)).rejects.toThrow("different authorized reviewer");assertCertificateStep(reviewed,JSON.parse(JSON.stringify(await call("snapshot"))),"unchanged",fixture.actors.preparer.id);
 await transitionCertificateRequest(db,request.id,"approve",fixture.actors.reviewer.id);assertCertificateStep(reviewed,JSON.parse(JSON.stringify(await call("snapshot"))),"requestApprove",fixture.actors.reviewer.id,request.id);
 const scoped=await call("snapshot");await call("unlink-parent");expect(await db.studentGuardian.count({where:{studentId:fixture.studentId,guardianId:fixture.actors.parent.guardianId}})).toBe(0);expect(await call("snapshot")).toEqual(scoped);await call("relink-parent");
 await expect(call("login-evidence",{actor:"preparer"})).rejects.toThrow();
 const state=async()=>JSON.parse(JSON.stringify(await call("snapshot")));
 const action=async(op:any,actor:string,target:string,work:()=>Promise<any>)=>{const before=await state(),result=await work();assertCertificateStep(before,await state(),op,actor,target);return result;};
 const prep=fixture.actors.preparer.id,review=fixture.actors.reviewer.id,fp=fixture.actors.financePreparer.id,fa=fixture.actors.financeApprover.id;
 const charge=await action("prepareCharge",fp,request.id,()=>prepareCertificateCharge(db,request.id,fp));
 await expect(approveCertificateCharge(db,request.id,fp,charge.updatedAt.toISOString())).rejects.toThrow("different authorized finance");
 await action("approveCharge",fa,request.id,()=>approveCertificateCharge(db,request.id,fa,charge.updatedAt.toISOString()));
 const payment={receiptDate:"2026-09-23",paymentMethod:"CASH",receivedAccount:"CASH_COUNTER"};
 await action("collect",fa,request.id,()=>collectCertificateCharge(db,request.id,fa,payment));await action("unchanged",fa,request.id,()=>collectCertificateCharge(db,request.id,fa,payment));
 const cert=await action("draft",prep,request.id,()=>createStudentCertificateDraft(db,{studentId:fixture.studentId,academicYear:"2026-27",certificateType:"GRADUATION",requestId:request.id,templateId:fixture.templateId,issuePlace:"SYNTHETIC",purpose:"SYNTHETIC recognition"},prep));
 const draft=await renderCertificatePdf(JSON.parse(cert.draftDataJson),"DRAFT");await inspectCertificateDocument(draft.pdf,"DRAFT",draft.fontHash,{studentName:fixture.studentName,academicYear:"2026-27"});
 for(const [op,actor] of [["submit",prep],["approve",review]] as const)await action(op,actor,cert.id,()=>transitionCertificate(db,cert.id,op,actor));
 await action("issue",review,cert.id,()=>issueCertificate(db,cert.id,review));await action("unchanged",review,cert.id,()=>issueCertificate(db,cert.id,review));
 const artifact=await db.certificateIssueArtifact.findFirstOrThrow({where:{certificateId:cert.id}}),bytes=Buffer.from(artifact.pdfBase64,"base64");await inspectCertificateDocument(bytes,"ISSUED",JSON.parse(artifact.renderProvenanceJson).fontHash,{studentName:fixture.studentName,academicYear:"2026-27"});
 await expect(inspectCertificateDocument(bytes,"ISSUED",undefined,{studentName:"SYNTHETIC WRONG",academicYear:"2026-27"})).rejects.toThrow("DRAWN_FACT");
 const successor=await action("reissue",prep,cert.id,()=>createCertificateVersion(db,cert.id,"REISSUE",prep,"SYNTHETIC replacement"));
 for(const [op,actor] of [["submit",prep],["approve",review]] as const)await action(op,actor,successor.id,()=>transitionCertificate(db,successor.id,op,actor));
 await action("issue",review,successor.id,()=>issueCertificate(db,successor.id,review));
 await action("void",review,cert.id,()=>cancelIssuedCertificate(db,cert.id,review,"SYNTHETIC retained history"));
},30_000);
