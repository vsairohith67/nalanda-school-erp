import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { academicComparisonCompatibility, academicReportCsv, buildAcademicReportSummary, parseAcademicReportInput } from "@/lib/academic-reporting";
import type { AcademicReportInput, AcademicReportSource } from "@/lib/academic-reporting-types";
import { renderAcademicReportPdf } from "@/lib/academic-report-pdf";

const root = process.cwd();
const source = (file: string) => readFileSync(path.join(root,file),"utf8");

function report(overrides: Partial<AcademicReportSource> = {}): AcademicReportSource {
  const exam = overrides.examinationCode ?? "REV-1";
  return {
    reportCardVersionId:`version-${exam}`,reportCardVersion:1,resultSnapshotId:`snapshot-${exam}`,resultSnapshotVersion:1,sourceRecordId:`snapshot-${exam}:version-${exam}`,sourceHash:"a".repeat(64),publicReference:`PUB-${exam}`,academicYear:"2026-27",examinationCode:exam,examinationName:exam==="REV-1"?"Revision I":"Preboard I",examinationType:exam==="REV-1"?"REVISION":"PREBOARD",examinationStart:exam==="REV-1"?"2026-08-01T00:00:00.000Z":"2026-10-01T00:00:00.000Z",examinationEnd:exam==="REV-1"?"2026-08-05T00:00:00.000Z":"2026-10-05T00:00:00.000Z",className:"X",section:"A",studentId:"student-1",studentReference:"LEARNER-1",studentName:"REPORT23G Student",admissionNumber:"REPORT23G-001",totalObtained:80,totalMaximum:100,percentage:80,gradeCode:"A",passResult:"PASS",
    papers:[{code:"ENG-P1",subjectName:"English",paperName:"Paper I",calculationMode:"RAW_SUM",obtained:80,maximum:100,percentage:80,excluded:false,components:[{code:"WRITTEN",name:"Written",state:"PRESENT",obtained:80,maximum:100,contributionWeight:null,contribution:80},{code:"ORAL",name:"Oral",state:"ABSENT",obtained:null,maximum:20,contributionWeight:null,contribution:null},{code:"PROJECT",name:"Project",state:"EXEMPT",obtained:null,maximum:20,contributionWeight:null,contribution:null},{code:"NA",name:"N/A",state:"NOT_APPLICABLE",obtained:null,maximum:0,contributionWeight:null,contribution:null},{code:"PENDING",name:"Pending",state:"NOT_ENTERED",obtained:null,maximum:10,contributionWeight:null,contribution:null}]}],
    groups:[{groupName:"Languages",obtained:"80",maximum:"100",percentage:"80"}],combinedResults:[{label:"Configured combined result",obtained:80,maximum:100,percentage:80,configuredWeight:50}],formulaVersion:"EXAM_CALCULATION_V2",roundingPolicyVersion:"ROUND_HALF_UP_2",schemeVersionReferences:["scheme-v1"],calculationRunReference:`CALC-${exam}`,sourceLockedAt:"2026-08-06T00:00:00.000Z",publishedAt:"2026-08-07T00:00:00.000Z",templateVersion:1,templateBindingVersion:1,attendanceBasisKey:"ATT-v1",attendance:{totalLockedDays:20,recordedDays:20,presentEquivalentDays:18},...overrides
  };
}

function input(family: AcademicReportInput["family"], overrides: Partial<AcademicReportInput> = {}): AcademicReportInput { return {family,academicYear:"2026-27",examinationCodes:family.includes("COMPARATIVE")||family==="COMPARATIVE_DELTA"?["REV-1","PB-1"]:["REV-1"],className:"X",section:"A",subjectCode:null,studentReference:null,childHandle:null,expectedContextVersion:null,normalizationRule:"STRICT_MATCH",includeAverageHighest:false,approvalReference:null,supersedesRunReference:null,...overrides}; }

describe("Prompt 23G governed academic reporting",()=>{
  it("compares exact schemes and refuses formula drift",()=>{
    const first=report(),second=report({examinationCode:"PB-1",examinationName:"Preboard I",examinationStart:"2026-10-01T00:00:00.000Z",percentage:84,totalObtained:84});
    expect(academicComparisonCompatibility(first,second,"STRICT_MATCH")).toMatchObject({compatible:true,appliedRule:"STRICT_MATCH"});
    expect(academicComparisonCompatibility(first,{...second,formulaVersion:"OTHER"},"PERCENTAGE_NORMALIZED")).toMatchObject({compatible:false});
  });

  it("requires explicit published-percentage normalisation for different maxima",()=>{
    const first=report(),paper={...first.papers[0],obtained:40,maximum:50,components:first.papers[0].components.map((row,index)=>index?row:{...row,obtained:40,maximum:50})};
    const second=report({examinationCode:"PB-1",examinationStart:"2026-10-01T00:00:00.000Z",totalObtained:40,totalMaximum:50,percentage:80,papers:[paper]});
    expect(academicComparisonCompatibility(first,second,"STRICT_MATCH")).toMatchObject({compatible:false});
    expect(academicComparisonCompatibility(first,second,"PERCENTAGE_NORMALIZED")).toMatchObject({compatible:true,appliedRule:"PERCENTAGE_NORMALIZED"});
  });

  it("keeps absent, exempt, N/A, not-entered and present zero distinct",()=>{
    const zero=report();zero.papers[0].components[0].obtained=0;
    const summary=buildAcademicReportSummary([zero],input("OUTCOME_DISTRIBUTION"),{audience:"LEADERSHIP",generatedAt:new Date("2026-08-03T10:00:00Z")});
    const states=Object.fromEntries(summary.sections[0].rows.filter((row)=>row.Distribution==="Entry state").map((row)=>[row.Outcome,row.Count]));
    expect(states).toMatchObject({ABSENT:1,EXEMPT:1,"N/A":1,NOT_ENTERED:1,ZERO:1});
  });

  it("uses locked grouped and combined values without inventing a weighting",()=>{
    const summary=buildAcademicReportSummary([report()],input("SUBJECT_GROUP_SUMMARY"),{audience:"LEADERSHIP"});
    expect(summary.sections[0].rows).toEqual(expect.arrayContaining([expect.objectContaining({Group:"Languages",Percentage:80}),expect.objectContaining({Group:"Configured combined result","Configured weight":50})]));
  });

  it("calculates only historical published percentage-point deltas",()=>{
    const sources=[report(),report({examinationCode:"PB-1",examinationName:"Preboard I",examinationStart:"2026-10-01T00:00:00.000Z",percentage:75,totalObtained:75})];
    const summary=buildAcademicReportSummary(sources,input("BOARD_CLASS_COMPARATIVE"),{audience:"LEADERSHIP"});
    expect(summary.sections[0].rows[0]).toMatchObject({"Change (percentage points)":-5,Direction:"DECLINE"});
    expect(summary.boardClassDisclaimer).toMatch(/not an official board submission/i);
    expect(JSON.stringify(summary)).not.toMatch(/predicted board marks/i);
  });

  it("suppresses low-count Viewer aggregates and removes identity columns",()=>{
    const summary=buildAcademicReportSummary([report()],input("CLASS_SECTION_SUMMARY"),{audience:"VIEWER",minimumGroupSize:5});
    expect(summary.suppressed).toBe(true); expect(JSON.stringify(summary.sections)).not.toContain("REPORT23G Student"); expect(JSON.stringify(summary.sections)).toContain("SUPPRESSED");
  });

  it("requires explicit approval for average/highest",()=>{
    expect(()=>parseAcademicReportInput({family:"CLASS_AVERAGE_HIGHEST",academicYear:"2026-27",examinationCodes:["REV-1"],className:"X",includeAverageHighest:false})).toThrow(/approved reference/i);
    expect(parseAcademicReportInput({family:"CLASS_AVERAGE_HIGHEST",academicYear:"2026-27",examinationCodes:["REV-1"],className:"X",includeAverageHighest:true,approvalReference:"REPORT23G-APPROVED"}).approvalReference).toBe("REPORT23G-APPROVED");
  });

  it("produces formula-safe CSV and carries generation/source evidence",()=>{
    const dangerous=report({studentName:"=cmd|' /C calc'!A0"});
    const summary=buildAcademicReportSummary([dangerous],input("STUDENT_LONGITUDINAL"),{audience:"LEADERSHIP",generatedAt:new Date("2026-08-03T10:00:00Z")});
    const csv=academicReportCsv(summary);expect(csv).toContain("'=cmd");expect(csv).toContain("2026-08-03T10:00:00.000Z");expect(csv).toContain("immutable issued report-card versions");
  });

  it("renders authenticated colour and monochrome PDFs from the immutable summary",async()=>{
    const summary=buildAcademicReportSummary([report()],input("LEADERSHIP_SUMMARY"),{audience:"LEADERSHIP",generatedAt:new Date("2026-08-03T10:00:00Z")});
    const [colour,monochrome]=await Promise.all([renderAcademicReportPdf(summary,"COLOUR"),renderAcademicReportPdf(summary,"MONOCHROME")]);
    expect(colour.subarray(0,4).toString()).toBe("%PDF");expect(monochrome.subarray(0,4).toString()).toBe("%PDF");expect(colour.length).toBeGreaterThan(1_000);expect(monochrome.length).toBeGreaterThan(1_000);
  });

  it("keeps Teacher/learner scope server-side and exports only through state-changing POST",()=>{
    const loader=source("lib/academic-reporting-sources.ts"),runRoute=source("app/api/academic-reports/runs/route.ts"),exportRoute=source("app/api/academic-reports/runs/[runKey]/export/route.ts");
    expect(loader).toContain("listExactTeacherMarkAssignments");expect(loader).toContain("resolveClassworkLearnerContext");expect(loader).toContain("pruneSubjectScope");expect(runRoute).toContain("export async function POST");expect(exportRoute).toContain("export async function POST");expect(exportRoute).not.toContain("export async function GET");
  });

  it("has private/no-store, origin middleware, deterministic files, immutable models and no external AI",()=>{
    expect(source("middleware.ts")).toContain("unsafeRequestOriginAllowed");expect(source("lib/academic-reporting-api.ts")).toContain("private, no-store");expect(source("lib/academic-reporting.ts")).toContain("deterministicAcademicReportFilename");
    const schema=source("prisma/schema.prisma");for(const model of ["AcademicReportDefinition","AcademicReportRun","AcademicReportSourceReference","AcademicReportAuditEvent"])expect(schema).toContain(`model ${model}`);
    const migration=source("prisma/migrations/20260803143000_academic_reporting/migration.sql");expect(migration).toContain("AcademicReportRun_no_update");expect(migration).toContain("AcademicReportAudit_no_delete");
    expect(source("lib/academic-reporting-sources.ts")).not.toMatch(/fetch\(|openai|anthropic|gemini|provider/i);
  });
});
