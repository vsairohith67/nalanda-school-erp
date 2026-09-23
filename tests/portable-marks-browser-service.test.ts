import {beforeAll,afterAll,it,expect,vi} from "vitest";
import {PrismaClient} from "@prisma/client";
import {randomUUID} from "node:crypto";
import {mkdtempSync,rmSync,readFileSync,readdirSync,lstatSync,existsSync} from "node:fs";
import {DatabaseSync,backup} from "node:sqlite";
import {tmpdir} from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {defaultPermissionMatrix} from "../lib/role-permissions";
import {assertImportedMarks} from "../scripts/portable/marks-browser";
import {marksBrowserProbe} from "../scripts/portable/marks-browser-probe";
import {assertMarksTemplate,completeMarksTemplate,assertMarksRows,assertMarksUnchanged} from "../scripts/portable/marks-browser-assertions";
import {legacyContextTemplate,legacyImportContext} from "../lib/legacy-marks-import-context";
import {previewMarksImport,applyMarksImport} from "../lib/marks-import";
import {governedImportContext,governedImportTemplate,validateGovernedImport,applyGovernedImport} from "../lib/governed-marks-import";
import {loadAcademicReportSources} from "../lib/academic-reporting-sources";
import {parseAcademicReportInput,buildAcademicReportSummary,persistAcademicReportRun,academicReportCsv} from "../lib/academic-reporting";
import {renderAcademicReportPdf} from "../lib/academic-report-pdf";
import {inspectMarksReportPdf} from "../scripts/portable/marks-browser-document";
import {issueImportReceipt} from "../lib/import-preview-receipt";
// ISOLATED_SERVICE. Only admission/MFA preparation are simulated. No browser,
// server, real-session acceptance or artifact qualification is established.
vi.mock("../scripts/portable/acceptance-http",()=>({assertSyntheticServingTarget:()=>{},provisionSyntheticMfa:async()=>{},nextTotp:async()=>{throw Error("HARNESS_HAS_NO_LOGIN");}}));
vi.mock("../lib/portable-runtime/synthetic-capability",()=>({syntheticFeatureCapability:()=>({source:"a".repeat(40),runId:"123",attempt:"1",features:[]})}));
const root=mkdtempSync(path.join(tmpdir(),"nalanda-marks-browser-service-")),identity=lstatSync(root),schema=`mb_${randomUUID().replaceAll("-","")}`,postgres=process.env.DATABASE_PROVIDER==="postgresql";let db:PrismaClient;
const bound={source:"a".repeat(40),runId:"123",attempt:"1",iteration:randomUUID()};
beforeAll(async()=>{
 let url="file:"+path.join(root,"synthetic.db").replaceAll("\\","/");
 if(postgres){expect(process.env.CI).toBe("true");expect(process.env.POSTGRES_READINESS_SYNTHETIC_QA).toBe("1");const target=new URL(process.env.DATABASE_URL!);target.searchParams.set("schema",schema);url=target.toString();execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy","--schema","prisma/postgresql/schema.prisma"],{env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},stdio:"pipe"});}
 else{const sql=new DatabaseSync(":memory:");try{for(const migration of readdirSync("prisma/migrations",{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort())sql.exec(readFileSync(path.join("prisma/migrations",migration,"migration.sql"),"utf8"));expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);expect(Object.values(sql.prepare("PRAGMA integrity_check").get()!)).toEqual(["ok"]);expect(existsSync(path.join(root,"synthetic.db"))).toBe(false);await backup(sql,path.join(root,"synthetic.db"));}finally{sql.close();}}
 db=new PrismaClient({datasourceUrl:url});vi.stubEnv("DATABASE_URL",url);vi.stubEnv("NODE_ENV","test");vi.stubEnv("AUTH_SECRET","SYNTHETIC-marks-contract-secret-only-000000");vi.stubEnv("AUTH_MFA_KEYRING_JSON",JSON.stringify({active:"SYNTHETIC",keys:{SYNTHETIC:Buffer.alloc(32,7).toString("base64")}}));vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_MODE","SYNTHETIC_COPY_ONLY");vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED","real-data-imports");
 await db.rolePermission.createMany({data:Object.entries(defaultPermissionMatrix()).flatMap(([role,entries])=>Object.entries(entries).map(([permission,enabled])=>({role,permission,enabled})))});
 await db.schoolSettings.create({data:{id:"school",schoolName:"NALANDA PUBLIC SCHOOL",academicYear:"2026-27",addressLine1:"SYNTHETIC",city:"SYNTHETIC",phone:"SYNTHETIC-NO-CONTACT"}});
},60_000);
afterAll(async()=>{if(db){if(postgres)await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);await db.$disconnect();}const current=lstatSync(root);expect(current.isSymbolicLink()).toBe(false);expect(current.ino).toBe(identity.ino);expect(current.dev).toBe(identity.dev);expect(path.dirname(path.resolve(root))).toBe(path.resolve(tmpdir()));rmSync(root,{recursive:true});expect(existsSync(root)).toBe(false);vi.unstubAllEnvs();});
it("ISOLATED_SERVICE: source-bound fresh rosters, actual delegation and real legacy/governed imports",async()=>{
 const probe=(operation:string,extra:any={})=>marksBrowserProbe(db,{...bound,operation,...extra}),f:any=await probe("prepare",{password:"HARNESS_FIXTURE_ONLY_"+randomUUID()+randomUUID()}),read=async()=>JSON.parse(JSON.stringify(await probe("snapshot")));
 expect(f.students).toHaveLength(6);expect(f.excluded).toHaveLength(3);await expect(probe("prepare",{password:"x".repeat(60)})).rejects.toThrow("FIXTURE_REUSE");
 const principal=await db.user.findUniqueOrThrow({where:{id:f.actors.principal.id}}),delegate=await db.user.findUniqueOrThrow({where:{id:f.actors.delegate.id}});
 expect((await read()).history.snapshots).toHaveLength(3);
 const reportInput=parseAcademicReportInput({family:"OUTCOME_DISTRIBUTION",academicYear:f.history.academicYear,examinationCodes:[f.history.examCode],className:f.className,section:"A",normalizationRule:"NONE"}),loaded=await loadAcademicReportSources(db,reportInput,principal as any,"HARNESS_FIXTURE_ONLY");expect(loaded.sources).toHaveLength(1);expect(loaded.sources[0].studentId).toBe(f.students[0].id);expect(loaded.sources[0].percentage).toBe(75);
 const summary=buildAcademicReportSummary(loaded.sources,reportInput,{audience:loaded.audience}),run=await persistAcademicReportRun(db,reportInput,summary,loaded.sources,principal as any,loaded.accessScope);expect(run.sourceCount).toBe(1);expect(academicReportCsv(summary)).toContain("Grade,A,1");for(const mode of ["COLOUR","MONOCHROME"] as const){const bytes=await renderAcademicReportPdf(summary,mode);await inspectMarksReportPdf(bytes,["Grade | A | 1","Pass result | PASS | 1"],mode);await expect(inspectMarksReportPdf(bytes,[],mode==="COLOUR"?"MONOCHROME":"COLOUR")).rejects.toThrow();}
 const context={...f,model:"legacy" as const},template=Buffer.from(legacyContextTemplate(await legacyImportContext(db,principal as any,f.assessmentId,f.academicYear)));assertMarksTemplate(template,context);
 const inputs=[{state:"PRESENT",marks:"7.25",remarks:"SYNTHETIC"},{state:"PRESENT",marks:"0",remarks:""},{state:"ABSENT",marks:"",remarks:""},{state:"EXEMPT",marks:"",remarks:""},{state:"NOT_APPLICABLE",marks:"",remarks:""},{state:"PRESENT",marks:"10",remarks:""}];
 const csv=completeMarksTemplate(template,context,inputs).toString();let before=await read();const preview=await previewMarksImport(db,principal as any,csv);expect(preview.validRows).toBe(6);assertMarksUnchanged(before,await read());
 await applyMarksImport(db,principal as any,csv,principal);let after=await read();assertImportedMarks(before,after,f,"legacy","principal",inputs);expect(after.marks).toHaveLength(6);expect(after.legacyEvents).toHaveLength(6);expect(after.sheets).toEqual([]);
 const g={...f,model:"governed" as const},download=Buffer.from(governedImportTemplate(delegate as any,await governedImportContext(db,delegate as any,f.assignmentId)));assertMarksTemplate(download,g);const draft=completeMarksTemplate(download,g,[...inputs.slice(0,5),{state:"NOT_ENTERED",marks:"",remarks:""}]).toString();
 before=await read();const valid=await validateGovernedImport(db,delegate as any,f.assignmentId,draft);assertMarksUnchanged(before,await read());const receipt=issueImportReceipt(valid.binding);const result=await applyGovernedImport(db,delegate as any,f.assignmentId,draft,receipt);after=await read();assertImportedMarks(before,after,f,"governed","delegate",[...inputs.slice(0,5),{state:"NOT_ENTERED",marks:"",remarks:""}]);expect(result.changed).toBe(5);expect(after.sheets).toHaveLength(1);expect(after.sheets[0].status).toBe("DRAFT");expect(after.sheets[0].optimisticVersion).toBe(2);expect(after.results).toEqual([]);expect(after.marks).toEqual(before.marks);
 assertMarksRows(after.entries.map((e:any)=>({studentId:e.studentId,state:e.entryState,marks:e.marksObtained,version:e.rowVersion})),f.students.map((s:any,i:number)=>({studentId:s.id,state:i===5?"NOT_ENTERED":inputs[i].state,marks:i===5||inputs[i].marks===""?null:inputs[i].marks,version:i===5?1:2})));
 before=after;assertMarksUnchanged(await applyGovernedImport(db,delegate as any,f.assignmentId,draft,receipt),result);assertMarksUnchanged(before,await read());
 await expect(governedImportContext(db,delegate as any,f.otherAssignmentId)).rejects.toThrow();await expect(legacyImportContext(db,delegate as any,f.otherAssessmentId,f.academicYear)).rejects.toThrow();
 for(const [name,operation] of [["revoked","revoke"],["expired","expire"],["family","link-child"]]){const u=await db.user.findUniqueOrThrow({where:{id:f.actors[name].id}});expect(governedImportTemplate(u as any,await governedImportContext(db,u as any,f.assignmentId))).toContain("governed-draft-v1");await probe(operation);await expect(governedImportContext(db,u as any,f.assignmentId)).rejects.toThrow();}
},30_000);
