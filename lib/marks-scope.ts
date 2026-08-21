import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { listActorMarksDelegationScopes, type LegacyMarksDelegationScope, type MarksDelegationScope } from "@/lib/academic-integrity";

type ScopeClient = Pick<PrismaClient | Prisma.TransactionClient, "staffMember">;
export type MarksTeacherTarget = { academicYear: string; examId?: string; assessmentId?: string; className: string; section: string; subjectName: string; timetableSubjectId: string | null; componentName?: string };
export type MarksScope = { broad: boolean; staffLabel: string | null; targets: MarksTeacherTarget[]; reason: string | null };

export async function resolveMarksScope(client: ScopeClient, user: Pick<AuthUser, "id" | "role"> & Partial<Pick<AuthUser, "name">>, academicYear?: string, purpose: "READ" | "WRITE" = "READ"): Promise<MarksScope> {
  if (purpose === "WRITE") {
    if (user.role === "SUPER_ADMIN" || user.role === "PRINCIPAL") return { broad: true, staffLabel: null, targets: [], reason: null };
    if (user.role === "TEACHER") return { broad: false, staffLabel: null, targets: [], reason: "Teacher marks-write authority is denied by Academic Integrity v1.1." };
    const delegated = await listActorMarksDelegationScopes(client as any, { ...user, name: user.name ?? "Delegated marks-entry operator" });
    const targets = (delegated ?? []).filter((scope: MarksDelegationScope): scope is LegacyMarksDelegationScope => scope.kind === "LEGACY_ASSESSMENT").filter((scope: LegacyMarksDelegationScope) => !academicYear || scope.academicYear === academicYear).map((scope: LegacyMarksDelegationScope) => ({
      academicYear: scope.academicYear,
      examId: scope.examId,
      assessmentId: scope.assessmentId,
      className: scope.className,
      section: scope.section,
      subjectName: scope.subjectName,
      timetableSubjectId: scope.subjectId,
      componentName: scope.componentName
    }));
    return { broad: false, staffLabel: user.name ?? null, targets, reason: targets.length ? null : "No active delegated marks-entry scope is available." };
  }
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
  return { OR: scope.targets.map((target) => ({
    ...(target.assessmentId ? { id: target.assessmentId } : {}),
    ...(target.examId ? { examCycleId: target.examId } : {}),
    academicYear: target.academicYear,
    className: target.className,
    section: target.section,
    subjectName: target.subjectName,
    timetableSubjectId: target.timetableSubjectId,
    ...(target.componentName !== undefined ? { componentName: target.componentName } : {})
  })) };
}

export function requireMarksTarget(scope: MarksScope, assessment: { id?: string; examCycleId?: string; academicYear: string; className: string; section: string; subjectName?: string; componentName?: string; timetableSubjectId: string | null }) {
  if (scope.broad) return;
  const match = scope.targets.some((target) =>
    (!target.assessmentId || target.assessmentId === assessment.id) &&
    (!target.examId || target.examId === assessment.examCycleId) &&
    target.academicYear === assessment.academicYear &&
    target.className === assessment.className &&
    target.section === assessment.section &&
    target.timetableSubjectId === assessment.timetableSubjectId &&
    (!assessment.subjectName || target.subjectName === assessment.subjectName) &&
    (target.componentName === undefined || target.componentName === (assessment.componentName ?? ""))
  );
  if (!match) throw new Error(scope.reason ?? "This mark sheet is outside your exact timetable assignment scope.");
}
