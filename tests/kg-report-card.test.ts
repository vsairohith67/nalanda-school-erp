import { describe, expect, it } from "vitest";
import { createEmptyKgDraft, KG_ATTENDANCE_MONTHS, KG_CRITERIA, KG_EVALUATIONS, KG_GROWTH_PERIODS, KG_PERSONALITY_TRAITS, KG_RESPONSE_SETS, KG_SUMMARY_AREAS, kgValidationGaps, normalizeKgDraft } from "@/lib/kg-report-card";

function completeKg(){const draft:any=createEmptyKgDraft();for(const e of KG_EVALUATIONS){draft.rubrics[e]=Object.fromEntries(KG_CRITERIA.map(([key,,,set])=>[key,KG_RESPONSE_SETS[set][0]]));draft.summaryGrades[e]=Object.fromEntries(KG_SUMMARY_AREAS.map(key=>[key,"A"]));draft.personality[e]=Object.fromEntries(KG_PERSONALITY_TRAITS.map(key=>[key,"G"]));draft.evaluationComments[e]={comment:`Evaluation ${e}`,classTeacherApproval:{name:"Teacher",role:"CLASS_TEACHER",approvedAt:"2026-07-16"},principalApproval:{name:"Principal",role:"PRINCIPAL",approvedAt:"2026-07-16"},directorApproval:null};}draft.attendance=KG_ATTENDANCE_MONTHS.map(month=>({month,workingDays:20,daysPresent:19}));draft.attendanceSource={status:"MANUALLY_REVIEWED_SNAPSHOT",overrideReason:"Reviewed against the class register."};for(const e of KG_GROWTH_PERIODS)draft.growth[e]={heightCm:105,weightKg:17,observationDate:"2026-07-16"};draft.final={grade:"A",comment:"Ready for the next learning stage.",nextClass:"UKG",nextSessionStartDate:"2027-04-01"};return draft;}
describe("dedicated KG report-card data",()=>{
  it("starts incomplete across Evaluation I-V",()=>expect(kgValidationGaps(createEmptyKgDraft()).length).toBeGreaterThan(100));
  it("accepts all supported rubric response sets",()=>expect(()=>normalizeKgDraft(completeKg())).not.toThrow());
  it("requires all five evaluation periods for issue",()=>{const d=completeKg();delete d.rubrics.V;expect(kgValidationGaps(d).some(g=>g.includes("evaluation periods"))).toBe(true);});
  it("rejects unsupported rubric responses",()=>{const d=completeKg();d.rubrics.I.english_oral_talks="FREE_TEXT";expect(()=>normalizeKgDraft(d)).toThrow(/invalid KG rubric/);});
  it("accepts G, S, and N personality codes",()=>{const d=completeKg();d.personality.I.regular_to_school="S";d.personality.II.regular_to_school="N";expect(()=>normalizeKgDraft(d)).not.toThrow();});
  it("rejects an invalid personality code",()=>{const d=completeKg();d.personality.I.regular_to_school="A";expect(()=>normalizeKgDraft(d)).toThrow(/personality/);});
  it("requires June through April exactly once",()=>{const d=completeKg();d.attendance[1].month="JUNE";expect(()=>normalizeKgDraft(d)).toThrow(/months/);});
  it("requires a reason for manually reviewed attendance",()=>{const d=completeKg();d.attendanceSource.overrideReason="";expect(()=>normalizeKgDraft(d)).toThrow(/requires a reason/);});
  it("does not allow attendance present days above working days",()=>{const d=completeKg();d.attendance[0].daysPresent=21;expect(()=>normalizeKgDraft(d)).toThrow(/cannot exceed/);});
  it("validates positive sensible growth values",()=>{const d=completeKg();d.growth.I.heightCm=500;expect(()=>normalizeKgDraft(d)).toThrow(/height/);});
  it("supports typed approval snapshots without images",()=>expect(normalizeKgDraft(completeKg()).evaluationComments.I.classTeacherApproval).toEqual({name:"Teacher",role:"CLASS_TEACHER",approvedAt:"2026-07-16"}));
  it("returns no completeness gaps for a complete card",()=>expect(kgValidationGaps(completeKg())).toEqual([]));
  it("can require Director approval by template",()=>expect(kgValidationGaps(completeKg(),{directorApprovalRequired:true}).filter(g=>g.includes("Director approval"))).toHaveLength(5));
  it("blocks issue while the attendance source remains incomplete",()=>{const d=completeKg();d.attendanceSource={status:"INCOMPLETE_SOURCE",overrideReason:null};expect(kgValidationGaps(d)).toContain("Attendance source is incomplete; review the snapshot and record a reason");});
  it("rejects extra evaluation periods and unsupported growth periods",()=>{const d=completeKg();d.rubrics.VI={};expect(()=>normalizeKgDraft(d)).toThrow(/evaluation periods/);delete d.rubrics.VI;d.growth.II={heightCm:100,weightKg:15};expect(()=>normalizeKgDraft(d)).toThrow(/growth evaluation periods/);});
  it("rejects approval-role impersonation",()=>{const d=completeKg();d.evaluationComments.I.classTeacherApproval.role="PRINCIPAL";expect(()=>normalizeKgDraft(d)).toThrow(/CLASS_TEACHER/);});
});
