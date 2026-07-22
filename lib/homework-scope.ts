import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";

type ScopeClient = Pick<PrismaClient | Prisma.TransactionClient, "staffMember">;

export type HomeworkTeacherScope = {
  academicYear: string;
  className: string;
  section: string | null;
  subjectName: string;
  timetableSubjectId: string;
};

export type HomeworkScope = {
  broad: boolean;
  staffLabel: string | null;
  scopes: HomeworkTeacherScope[];
  reason: string | null;
};

export async function resolveHomeworkScope(client: ScopeClient, user: Pick<AuthUser, "id" | "role">, academicYear?: string): Promise<HomeworkScope> {
  if (user.role !== "TEACHER") return { broad: true, staffLabel: null, scopes: [], reason: null };
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
  if (!staff || staff.status !== "ACTIVE") return { broad: false, staffLabel: null, scopes: [], reason: "No active StaffMember is linked to this Teacher account." };
  if (!staff.timetableTeacher || !staff.timetableTeacher.isActive) return { broad: false, staffLabel: staff.displayName ?? staff.fullName, scopes: [], reason: "No active timetable Teacher is linked to this StaffMember." };
  const scopes = staff.timetableTeacher.assignments
    .filter((assignment) => assignment.classSection.isActive && assignment.subject.isActive)
    .map((assignment) => ({ academicYear: assignment.academicYear, className: assignment.classSection.className, section: assignment.classSection.section || null, subjectName: assignment.subject.name, timetableSubjectId: assignment.subjectId }));
  const unique = [...new Map(scopes.map((scope) => [`${scope.academicYear}|${scope.className}|${scope.section ?? ""}|${scope.subjectName.toLowerCase()}`, scope])).values()];
  return { broad: false, staffLabel: staff.displayName ?? staff.fullName, scopes: unique, reason: unique.length ? null : "No authorised class/subject assignments found." };
}

export function homeworkScopeWhere(scope: HomeworkScope): Prisma.HomeworkAssignmentWhereInput {
  if (scope.broad) return {};
  if (!scope.scopes.length) return { assignmentNumber: "__NO_AUTHORISED_HOMEWORK_SCOPE__" };
  return { OR: scope.scopes.map((item) => ({ academicYear: item.academicYear, className: item.className, section: item.section, subjectName: { equals: item.subjectName } })) };
}

export function homeworkVisibleWhere(
  scope: HomeworkScope,
  user: { id: string; role: string }
): Prisma.HomeworkAssignmentWhereInput {
  const scoped = homeworkScopeWhere(scope);
  if (user.role !== "TEACHER") return scoped;
  return {
    AND: [
      scoped,
      {
        OR: [
          { createdByUserId: user.id },
          { publishedAt: { not: null } }
        ]
      }
    ]
  };
}

export function requireHomeworkTarget(scope: HomeworkScope, target: { academicYear: string; className: string; section: string | null; subjectName: string }) {
  if (scope.broad) return null;
  const found = scope.scopes.find((item) => item.academicYear === target.academicYear && item.className === target.className && (item.section ?? null) === (target.section ?? null) && item.subjectName.toLowerCase() === target.subjectName.toLowerCase());
  if (!found) throw new Error(scope.reason ?? "This class, section, and subject are outside your authorised Teacher scope.");
  return found;
}

export function scopeOptions(scope: HomeworkScope) {
  return scope.scopes.map(({ academicYear, className, section, subjectName }) => ({ academicYear, className, section, subjectName }));
}
