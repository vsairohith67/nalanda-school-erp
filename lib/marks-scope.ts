import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";

type ScopeClient = Pick<PrismaClient | Prisma.TransactionClient, "staffMember">;
export type MarksTeacherTarget = { academicYear: string; className: string; section: string; subjectName: string; timetableSubjectId: string };
export type MarksScope = { broad: boolean; staffLabel: string | null; targets: MarksTeacherTarget[]; reason: string | null };

export async function resolveMarksScope(client: ScopeClient, user: Pick<AuthUser, "id" | "role">, academicYear?: string): Promise<MarksScope> {
  if (user.role !== "TEACHER") return { broad: true, staffLabel: null, targets: [], reason: null };
  const staff = await client.staffMember.findUnique({ where: { userId: user.id }, include: { timetableTeacher: { include: { assignments: { where: academicYear ? { academicYear } : undefined, include: { classSection: true, subject: true } } } } } });
  if (!staff || staff.status !== "ACTIVE") return { broad: false, staffLabel: null, targets: [], reason: "No active StaffMember is linked to this Teacher account." };
  if (!staff.timetableTeacher || !staff.timetableTeacher.isActive) return { broad: false, staffLabel: staff.displayName ?? staff.fullName, targets: [], reason: "No active timetable Teacher is linked to this StaffMember." };
  const targets = staff.timetableTeacher.assignments.filter((a) => a.classSection.isActive && a.subject.isActive).map((a) => ({ academicYear: a.academicYear, className: a.classSection.className, section: a.classSection.section, subjectName: a.subject.name, timetableSubjectId: a.subjectId }));
  const unique = [...new Map(targets.map((item) => [`${item.academicYear}|${item.className}|${item.section}|${item.timetableSubjectId}`, item])).values()];
  return { broad: false, staffLabel: staff.displayName ?? staff.fullName, targets: unique, reason: unique.length ? null : "No authorised timetable assignments were found." };
}

export function marksScopeWhere(scope: MarksScope): Prisma.ExamAssessmentWhereInput {
  if (scope.broad) return {};
  if (!scope.targets.length) return { id: "__NO_AUTHORISED_MARKS_SCOPE__" };
  return { OR: scope.targets.map((target) => ({ academicYear: target.academicYear, className: target.className, section: target.section, timetableSubjectId: target.timetableSubjectId })) };
}

export function requireMarksTarget(scope: MarksScope, assessment: { academicYear: string; className: string; section: string; timetableSubjectId: string | null }) {
  if (scope.broad) return;
  const match = assessment.timetableSubjectId && scope.targets.some((target) => target.academicYear === assessment.academicYear && target.className === assessment.className && target.section === assessment.section && target.timetableSubjectId === assessment.timetableSubjectId);
  if (!match) throw new Error(scope.reason ?? "This mark sheet is outside your exact timetable assignment scope.");
}
