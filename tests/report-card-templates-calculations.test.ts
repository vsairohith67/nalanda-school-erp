import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculateMarkReport, findGradeBand } from "@/lib/report-card-calculations";
import { DEFAULT_KG_TEMPLATE, DEFAULT_MARK_TEMPLATE, normalizeReportCardCode, validateGradeBands, validateTemplateDefinition } from "@/lib/report-card-templates";

const bands=[{gradeCode:"A",label:"Excellent",minimumPercentage:80,maximumPercentage:100},{gradeCode:"B",label:"Good",minimumPercentage:50,maximumPercentage:79.9999},{gradeCode:"C",label:"Needs Improvement",minimumPercentage:0,maximumPercentage:49.9999}];
describe("report-card templates and grading",()=>{
  it("normalizes stable codes",()=>expect(normalizeReportCardCode(" qa17c general ")).toBe("QA17C-GENERAL"));
  it("rejects unsafe codes",()=>expect(()=>normalizeReportCardCode("<bad>")).toThrow());
  it("accepts the built-in mark template",()=>expect(validateTemplateDefinition("MARK_BASED",DEFAULT_MARK_TEMPLATE)).toMatchObject({type:"MARK_BASED"}));
  it("accepts the complete dedicated KG template",()=>expect(validateTemplateDefinition("KG_RUBRIC",DEFAULT_KG_TEMPLATE)).toMatchObject({type:"KG_RUBRIC",printPages:expect.any(Array)}));
  it("rejects executable template text",()=>expect(()=>validateTemplateDefinition("MARK_BASED",{...DEFAULT_MARK_TEMPLATE,notes:"javascript:alert(1)"})).toThrow(/safe plain text/));
  it("rejects duplicate KG criterion keys",()=>expect(()=>validateTemplateDefinition("KG_RUBRIC",{...DEFAULT_KG_TEMPLATE,criteria:[...DEFAULT_KG_TEMPLATE.criteria.slice(0,-1),DEFAULT_KG_TEMPLATE.criteria[0]]})).toThrow(/unique/));
  it("rejects missing KG evaluation periods",()=>expect(()=>validateTemplateDefinition("KG_RUBRIC",{...DEFAULT_KG_TEMPLATE,evaluationPeriods:["I","II"]})).toThrow(/evaluation periods/));
  it("accepts non-overlapping bands",()=>expect(validateGradeBands(bands.map((b,i)=>({...b,displayOrder:i+1})))).toHaveLength(3));
  it("rejects overlapping grade ranges",()=>expect(()=>validateGradeBands([{gradeCode:"A",label:"A",minimumPercentage:70,maximumPercentage:100,displayOrder:1},{gradeCode:"B",label:"B",minimumPercentage:60,maximumPercentage:80,displayOrder:2}])).toThrow(/overlap/));
  it("rejects reversed grade ranges",()=>expect(()=>validateGradeBands([{gradeCode:"A",label:"A",minimumPercentage:90,maximumPercentage:80,displayOrder:1}])).toThrow(/maximum/));
});

describe("mark-based aggregation",()=>{
  it("preserves zero as a valid Present mark",()=>{const r=calculateMarkReport([{subjectName:"Maths",maxMarks:100,passMarks:40,entryStatus:"PRESENT",marksObtained:0}],bands);expect(r.rows[0].marksObtained).toBe(0);expect(r.blockingGaps).toEqual([]);expect(r.result).toBe("FAIL");});
  it("keeps Absent distinct from zero and fails display result",()=>{const r=calculateMarkReport([{subjectName:"English",maxMarks:100,entryStatus:"ABSENT",marksObtained:null}],bands);expect(r.rows[0]).toMatchObject({status:"ABSENT",marksObtained:null,countedInDenominator:true});expect(r.result).toBe("FAIL");});
  it("excludes Exempt and Not Applicable from the denominator",()=>{const r=calculateMarkReport([{subjectName:"Art",maxMarks:100,entryStatus:"EXEMPT"},{subjectName:"Music",maxMarks:100,entryStatus:"NOT_APPLICABLE"},{subjectName:"Maths",maxMarks:50,entryStatus:"PRESENT",marksObtained:40}],bands);expect(r.totalMaximum).toBe(50);expect(r.percentage).toBe(80);});
  it("blocks missing Present marks",()=>expect(calculateMarkReport([{subjectName:"Maths",maxMarks:100,entryStatus:"PRESENT",marksObtained:null}],bands).blockingGaps[0]).toMatch(/requires marks/));
  it("blocks an unknown or missing status",()=>expect(calculateMarkReport([{subjectName:"Maths",maxMarks:100,entryStatus:"MISSING"}],bands).result).toBe("INCOMPLETE"));
  it("calculates decimals deterministically",()=>expect(calculateMarkReport([{subjectName:"Maths",maxMarks:new Prisma.Decimal("37.5"),entryStatus:"PRESENT",marksObtained:new Prisma.Decimal("30.25")}],bands).percentage).toBe(80.67));
  it("applies configured assessment weightage",()=>{const r=calculateMarkReport([{subjectName:"Maths",maxMarks:100,weightagePercent:25,entryStatus:"PRESENT",marksObtained:80}],bands);expect(r.totalObtained).toBe(20);expect(r.totalMaximum).toBe(25);});
  it("uses pass marks independently from the total grade",()=>expect(calculateMarkReport([{subjectName:"Maths",maxMarks:100,passMarks:60,entryStatus:"PRESENT",marksObtained:55}],bands).result).toBe("FAIL"));
  it("selects a boundary grade deterministically",()=>expect(findGradeBand(80,bands)?.gradeCode).toBe("A"));
  it("never emits a rank",()=>expect(calculateMarkReport([{subjectName:"Maths",maxMarks:100,entryStatus:"PRESENT",marksObtained:80}],bands)).not.toHaveProperty("rank"));
});
