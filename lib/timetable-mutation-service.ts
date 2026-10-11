import type { Prisma, PrismaClient } from "@prisma/client";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { withDatabaseRetry } from "@/lib/database-retry";
import { assertNoRegularTimetableConflict } from "@/lib/substitutes";

export type TimetableActor = { userId: string; sessionId: string; roleAssignmentId: string };
export type TimetableMutationScope =
  | { kind: "draft"; id: string }
  | { kind: "teacher" | "class" | "subject" | "period-template" | "staff"; id: string };
type TimetablePermission = "MANAGE_TIMETABLE_BUILDER" | "MANAGE_TIMETABLE_MASTER" | "MANAGE_STAFF";

export class TimetableMutationError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

async function authorize(tx: Prisma.TransactionClient, actor: TimetableActor, permission: TimetablePermission) {
  if (!actor.sessionId || !actor.roleAssignmentId || !(await evaluateEffectivePermission(tx, { ...actor, permission })).allowed)
    throw new TimetableMutationError("You do not have permission for this timetable mutation", 403);
  const [user, session] = await Promise.all([
    tx.user.findUnique({ where: { id: actor.userId }, select: { credentialVersion: true, mustChangePassword: true } }),
    tx.authSession.findUnique({ where: { id: actor.sessionId }, select: { credentialVersion: true } })
  ]);
  if (!user || user.mustChangePassword || session?.credentialVersion !== user.credentialVersion)
    throw new TimetableMutationError("The session is no longer current", 403);
}

async function affectedStaff(tx: Prisma.TransactionClient, scope: TimetableMutationScope): Promise<string[]> {
  if (scope.kind === "staff") return [scope.id];
  let teacherIds: string[];
  if (scope.kind === "teacher") teacherIds = [scope.id];
  else {
    let where: Prisma.TimetableEntryWhereInput;
    if (scope.kind === "draft") where = { draftId: scope.id };
    else if (scope.kind === "class") where = { classSectionId: scope.id };
    else if (scope.kind === "subject") where = { subjectId: scope.id };
    else {
      const template = await tx.timetablePeriodTemplate.findUnique({ where: { id: scope.id } });
      if (!template) return [];
      where = { academicYear: template.academicYear, dayOfWeek: template.dayOfWeek,
        ...(template.periodNumber === null ? {} : { periodNumber: template.periodNumber }),
        ...(template.dayOfWeek === "FRIDAY" ? {} : { classSection: { groupName: template.groupName } }) };
    }
    const entries = await tx.timetableEntry.findMany({ where, select: { teacherId: true } });
    teacherIds = entries.flatMap(entry => entry.teacherId ? [entry.teacherId] : []);
  }
  if (!teacherIds.length) return [];
  const members = await tx.staffMember.findMany({ where: { timetableTeacherId: { in: [...new Set(teacherIds)] } }, select: { id: true } });
  return members.map(member => member.id);
}

// Ignore name/phone/notes edits and construction of inactive drafts. Only the
// persisted fields that can change effective regular availability trigger the
// reverse check; unrelated historical academic years are not re-admitted.
async function scheduleScope(tx: Prisma.TransactionClient, scope: TimetableMutationScope) {
  let value: unknown;
  let years: string[] | null = null;
  if (scope.kind === "staff") value = await tx.staffMember.findUnique({ where: { id: scope.id }, select: { status: true, timetableTeacherId: true } });
  else if (scope.kind === "teacher") value = await tx.timetableTeacher.findUnique({ where: { id: scope.id }, select: { isActive: true } });
  else if (scope.kind === "subject") value = await tx.timetableSubject.findUnique({ where: { id: scope.id }, select: { isActive: true } });
  else if (scope.kind === "class") {
    const row = await tx.timetableClassSection.findUnique({ where: { id: scope.id }, select: { academicYear: true, groupName: true, isActive: true } });
    value = row; years = row ? [row.academicYear] : [];
  } else if (scope.kind === "period-template") {
    const row = await tx.timetablePeriodTemplate.findUnique({ where: { id: scope.id }, select: { academicYear: true, groupName: true, dayOfWeek: true, periodNumber: true, startTime: true, endTime: true, isTeachingPeriod: true } });
    value = row; years = row ? [row.academicYear] : [];
  } else {
    const row = await tx.timetableDraft.findUnique({ where: { id: scope.id }, select: { academicYear: true, status: true,
      entries: { orderBy: { id: "asc" }, select: { academicYear: true, classSectionId: true, dayOfWeek: true, periodNumber: true, teacherId: true, subjectId: true, entryType: true } } } });
    value = row?.status === "ACTIVE" ? row : null;
    years = row ? [row.academicYear, ...row.entries.map(entry => entry.academicYear)] : [];
  }
  return { fingerprint: JSON.stringify(value), years };
}

/** Normal timetable/master/link writers and substitute writers read each
 * other's actual rows before committing. PostgreSQL Serializable predicate
 * conflicts and SQLite transaction locking arbitrate independent clients;
 * the existing retry helper re-runs authorization and the entire operation.
 * This does not replace the separately governed restore/import contract. */
export async function withTimetableMutation<T>(client: PrismaClient, actor: TimetableActor, permission: TimetablePermission,
  scope: TimetableMutationScope, mutate: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return withDatabaseRetry(() => client.$transaction(async tx => {
    await authorize(tx, actor, permission);
    const before = await affectedStaff(tx, scope);
    const previousSchedule = await scheduleScope(tx, scope);
    const result = await mutate(tx);
    const currentSchedule = await scheduleScope(tx, scope);
    if (previousSchedule.fingerprint === currentSchedule.fingerprint) return result;
    const staffIds = [...new Set([...before, ...await affectedStaff(tx, scope)])];
    const years = previousSchedule.years === null || currentSchedule.years === null ? null : [...new Set([...previousSchedule.years, ...currentSchedule.years])];
    if (staffIds.length) {
      const duties = await tx.substituteAssignment.findMany({ where: {
        substituteStaffMemberId: { in: staffIds }, status: { not: "CANCELLED" },
        ...(years ? { OR: [{ academicYear: { in: years } }, { academicYear: null }] } : {})
      }, select: { substituteStaffMemberId: true, assignmentDate: true, academicYear: true,
        periodLabel: true, periodStartTime: true, periodEndTime: true } });
      for (const duty of duties) await assertNoRegularTimetableConflict(tx, duty, duty.substituteStaffMemberId!);
    }
    return result;
  }, { isolationLevel: "Serializable" }));
}
