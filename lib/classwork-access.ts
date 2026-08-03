import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { resolveActiveParentChildContext } from "@/lib/iam/contexts";

type Client = PrismaClient | Prisma.TransactionClient;

export class ClassworkAccessError extends Error {
  constructor(message = "The requested classwork record is unavailable.", public status = 404, public code = "CLASSWORK_UNAVAILABLE") { super(message); }
}

export type ClassworkTarget = {
  academicYear: string;
  className: string;
  section: string;
  subjectName: string;
  timetableSubjectId: string;
};

export type ClassworkTeacherScope = {
  teacherId: string;
  staffMemberId: string;
  staffLabel: string;
  targets: ClassworkTarget[];
};

export async function resolveClassworkTeacherScope(client: Client, user: Pick<AuthUser, "id" | "role">, academicYear?: string): Promise<ClassworkTeacherScope> {
  if (user.role !== "TEACHER") throw new ClassworkAccessError("Switch to the Teacher context before accessing scoped classwork.", 403, "TEACHER_CONTEXT_REQUIRED");
  const staff = await client.staffMember.findUnique({
    where: { userId: user.id },
    include: {
      timetableTeacher: {
        include: {
          assignments: {
            where: academicYear ? { academicYear } : undefined,
            include: { classSection: true, subject: true }
          }
        }
      }
    }
  });
  if (!staff || staff.status !== "ACTIVE" || !staff.timetableTeacher?.isActive) {
    throw new ClassworkAccessError("No active Staff and timetable Teacher scope is linked to this account.", 403, "TEACHER_SCOPE_MISSING");
  }
  const targets = staff.timetableTeacher.assignments
    .filter((row) => row.classSection.isActive && row.subject.isActive && Boolean(row.classSection.section.trim()))
    .map((row) => ({
      academicYear: row.academicYear,
      className: row.classSection.className,
      section: row.classSection.section,
      subjectName: row.subject.name,
      timetableSubjectId: row.subjectId
    }));
  const unique = [...new Map(targets.map((row) => [`${row.academicYear}|${row.className}|${row.section}|${row.timetableSubjectId}`, row])).values()];
  if (!unique.length) throw new ClassworkAccessError("No exact active class, section, and subject assignment is available.", 403, "TEACHER_SCOPE_EMPTY");
  return { teacherId: staff.timetableTeacher.id, staffMemberId: staff.id, staffLabel: staff.displayName ?? staff.fullName, targets: unique };
}

export function requireClassworkTeacherTarget(scope: ClassworkTeacherScope, target: ClassworkTarget) {
  const match = scope.targets.find((row) => row.academicYear === target.academicYear && row.className === target.className && row.section === target.section && row.timetableSubjectId === target.timetableSubjectId && row.subjectName.toLowerCase() === target.subjectName.toLowerCase());
  if (!match) throw new ClassworkAccessError("The requested classwork scope is outside this Teacher's active timetable assignment.", 403, "TEACHER_SCOPE_DENIED");
  return match;
}

export function isClassworkLeadershipRole(role: string) {
  return role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "PRINCIPAL";
}

export function classworkItemScopeWhere(user: Pick<AuthUser, "id" | "role">, teacherScope?: ClassworkTeacherScope): Prisma.ClassworkItemWhereInput {
  if (isClassworkLeadershipRole(user.role)) return {};
  if (user.role !== "TEACHER" || !teacherScope) return { itemNumber: "__NO_CLASSWORK_SCOPE__" };
  return {
    OR: teacherScope.targets.map((row) => ({
      academicYear: row.academicYear,
      className: row.className,
      section: row.section,
      timetableSubjectId: row.timetableSubjectId
    }))
  };
}

export async function requireClassworkItemScope(client: Client, user: Pick<AuthUser, "id" | "role">, item: ClassworkTarget) {
  if (isClassworkLeadershipRole(user.role)) return;
  const scope = await resolveClassworkTeacherScope(client, user, item.academicYear);
  requireClassworkTeacherTarget(scope, item);
}

export type ClassworkLearnerContext = {
  studentId: string;
  studentLabel: string;
  academicYear: string;
  className: string;
  section: string;
  actorUserId: string;
  actorRole: "PARENT" | "STUDENT";
  guardianId: string | null;
  childHandle: string | null;
  contextVersion: number | null;
};

export async function resolveClassworkLearnerContext(client: Client, input: {
  user: AuthUser;
  sessionId: string;
  academicYear: string;
  childHandle?: string | null;
  expectedContextVersion?: number | null;
}): Promise<ClassworkLearnerContext> {
  if (input.user.role === "PARENT") {
    const context = await resolveActiveParentChildContext(client, {
      userId: input.user.id,
      sessionId: input.sessionId,
      roleAssignmentId: input.user.roleAssignmentId,
      academicYear: input.academicYear,
      childHandle: input.childHandle,
      expectedContextVersion: input.expectedContextVersion
    });
    if (!context.child.section?.trim()) throw new ClassworkAccessError("The linked child has no active section for this academic year.", 404);
    return {
      studentId: context.child.id,
      studentLabel: context.child.studentName,
      academicYear: context.child.academicYear,
      className: context.child.className,
      section: context.child.section,
      actorUserId: input.user.id,
      actorRole: "PARENT",
      guardianId: context.guardianId,
      childHandle: context.handle,
      contextVersion: context.contextVersion
    };
  }
  if (input.user.role !== "STUDENT") throw new ClassworkAccessError("Switch to a Parent or Student context.", 403, "LEARNER_CONTEXT_REQUIRED");
  const aliases = await client.authLoginAlias.findMany({
    where: {
      userId: input.user.id,
      type: "ADMISSION_NUMBER",
      status: "VERIFIED",
      isSchoolGoverned: true,
      admissionStudentId: { not: null }
    },
    include: {
      admissionStudent: {
        include: { academicYearEnrollments: { where: { academicYear: input.academicYear, status: "ACTIVE" }, take: 2 } }
      }
    },
    take: 2
  });
  const alias = aliases.length === 1 ? aliases[0] : null;
  const student = alias?.admissionStudent;
  const enrollment = student?.academicYearEnrollments.length === 1 ? student.academicYearEnrollments[0] : null;
  if (!student || student.deletedAt || student.status !== "Active" || !enrollment?.section?.trim()) {
    throw new ClassworkAccessError("The Student context is not bound to one eligible active admission and enrollment.", 403, "STUDENT_SELF_SCOPE_MISSING");
  }
  return {
    studentId: student.id,
    studentLabel: student.studentName,
    academicYear: enrollment.academicYear,
    className: enrollment.className,
    section: enrollment.section,
    actorUserId: input.user.id,
    actorRole: "STUDENT",
    guardianId: null,
    childHandle: null,
    contextVersion: null
  };
}

export function requireLearnerAudience(context: ClassworkLearnerContext, item: Pick<ClassworkTarget, "academicYear" | "className" | "section">) {
  if (context.academicYear !== item.academicYear || context.className !== item.className || context.section !== item.section) {
    throw new ClassworkAccessError("The requested classwork record is unavailable.", 404, "CLASSWORK_AUDIENCE_DENIED");
  }
}
