import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { marksScopeWhere, requireMarksTarget, resolveMarksScope } from "@/lib/marks-scope";
import { resolveMarksWriteAuthority, assertNoDelegatedFamilyConflict } from "@/lib/academic-integrity";
import { eligibleStudents } from "@/lib/marks";
import { parseMarksCsv, MARKS_IMPORT_COLUMNS } from "@/lib/marks-import";
import { csvCell } from "@/lib/expenses";
export async function legacyImportChoices(client: PrismaClient, actor: AuthUser) {
  const scope = await resolveMarksScope(client, actor, undefined, "WRITE");
  return client.examAssessment.findMany({ where: marksScopeWhere(scope), select: { id: true, academicYear: true, className: true, section: true, subjectName: true, componentName: true, maxMarks: true, entryStatus: true, updatedAt: true, examCycle: { select: { examCode: true, status: true } } }, orderBy: [{ academicYear: "desc" }, { id: "asc" }], take: 1000 });
}
export async function legacyImportContext(client: PrismaClient, actor: AuthUser, id: string, year: string) {
  const assessment = await client.examAssessment.findUnique({ where: { id }, include: { examCycle: true, marks: { orderBy: { studentId: "asc" } } } });
  if (!assessment || assessment.academicYear !== year) throw new Error("Select an authorised assessment and academic year.");
  requireMarksTarget(await resolveMarksScope(client, actor, year, "WRITE"), assessment);
  const authority = await resolveMarksWriteAuthority(client, actor, { kind: "LEGACY_ASSESSMENT", assessmentId: id, examId: assessment.examCycleId, academicYear: year, className: assessment.className, section: assessment.section, subjectId: assessment.timetableSubjectId, subjectName: assessment.subjectName, componentName: assessment.componentName }, "ENTER_MARKS");
  const students = await eligibleStudents(client, assessment);
  await assertNoDelegatedFamilyConflict(client, actor, students.map(s => s.studentId), authority, `legacy-import:${id}`);
  return { assessment, students };
}
export function assertLegacyCsvContext(csv: unknown, context: Awaited<ReturnType<typeof legacyImportContext>>) {
  const a = context.assessment;
  if (a.entryStatus !== "OPEN" || a.examCycle.status !== "OPEN_FOR_ENTRY") throw new Error("Assessment is locked or unavailable for draft import.");
  for (const row of parseMarksCsv(csv)) {
    if (row.examCode !== a.examCycle.examCode || row.className !== a.className || row.section !== a.section || row.subjectName !== a.subjectName || row.componentName !== a.componentName) throw new Error("CSV does not match the selected legacy assessment context.");
  }
}
export function legacyContextTemplate(context: Awaited<ReturnType<typeof legacyImportContext>>) {
  const a = context.assessment;
  return [MARKS_IMPORT_COLUMNS.join(","), ...context.students.map(s => [a.examCycle.examCode, a.className, a.section, a.subjectName, a.componentName, s.student.admissionNo, "", "PRESENT", ""].map(csvCell).join(","))].join("\r\n") + "\r\n";
}
