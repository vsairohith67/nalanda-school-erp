import { describe, expect, it, vi } from "vitest";
const fixtures=vi.hoisted(()=>({authority:{mode:"DELEGATED"},students:[{studentId:"synthetic-child"}]}));
vi.mock("@/lib/exam-marks-scope",()=>({requireExactExamMarkAssignment:vi.fn(async()=>({_marksAuthority:fixtures.authority,schemeVersion:{frozenAt:new Date(),status:"ACTIVE"}}))}));
vi.mock("@/lib/exam-marks",()=>({loadTeacherMarksWorkspace:vi.fn(async()=>({selectedWorkspace:{students:fixtures.students,components:[{assignment:{id:"synthetic-assignment"}}]}})),ExamMarksError:class extends Error{}}));
import { governedImportContext } from "@/lib/governed-marks-import";
describe("governed roster download family boundary",()=>{
 it("denies a delegated own-child roster before CSV/XLSX rendering and records the authoritative refusal",async()=>{
  fixtures.authority.mode="DELEGATED";
  const event=vi.fn(async()=>({}));
  const client={user:{findUnique:async()=>({guardianId:"synthetic-guardian"})},studentGuardian:{findFirst:vi.fn(async()=>({studentId:"synthetic-child"}))},authSecurityEvent:{create:event}};
  await expect(governedImportContext(client as any,{id:"synthetic-delegate",role:"OFFICE_STAFF"} as any,"synthetic-assignment")).rejects.toMatchObject({status:403,code:"ACADEMIC_INTEGRITY_FAMILY_CONFLICT"});
  expect(client.studentGuardian.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{guardianId:"synthetic-guardian",studentId:{in:["synthetic-child"]}}}));
  expect(event).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({eventType:"MARKS_DELEGATION_FAMILY_CONFLICT_DENIED",subjectId:"synthetic-child"})}));
 });
 it("preserves permanent authority and permits a delegate without a linked roster child",async()=>{
  const event=vi.fn();const client={user:{findUnique:async()=>({guardianId:"synthetic-guardian"})},studentGuardian:{findFirst:async()=>null},authSecurityEvent:{create:event}};
  fixtures.authority.mode="DELEGATED";expect((await governedImportContext(client as any,{id:"synthetic-delegate"} as any,"synthetic-assignment")).selected.students).toHaveLength(1);
  fixtures.authority.mode="PERMANENT";expect((await governedImportContext({} as any,{id:"synthetic-principal"} as any,"synthetic-assignment")).selected.students).toHaveLength(1);expect(event).not.toHaveBeenCalled();
 });
});
