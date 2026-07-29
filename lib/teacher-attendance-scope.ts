import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { attendanceDay } from "@/lib/student-attendance";

type ScopeClient = Pick<
  PrismaClient | Prisma.TransactionClient,
  "staffMember" | "substituteAssignment"
>;

export type AttendanceAuthorizationSource =
  | "LEADERSHIP_PERMISSION"
  | "TIMETABLE"
  | "SUBSTITUTE";

export type TeacherAttendanceTarget = {
  academicYear: string;
  className: string;
  section: string;
  source: "TIMETABLE" | "SUBSTITUTE";
  evidenceId: string;
  attendanceDate: Date | null;
};

export type TeacherAttendanceScope = {
  broad: boolean;
  staffLabel: string | null;
  targets: TeacherAttendanceTarget[];
  reason: string | null;
};

export type AttendanceTarget = {
  attendanceDate: Date;
  academicYear: string;
  className: string;
  section: string;
};

export class AttendanceScopeError extends Error {
  constructor(message = "Attendance scope is unavailable for this account.", readonly status = 403) {
    super(message);
  }
}

function canonicalClassName(value: unknown) {
  const raw = String(value ?? "");
  const normalized = raw.trim().toUpperCase();
  return normalized && raw === normalized ? normalized : null;
}

function canonicalSection(value: unknown) {
  const raw = String(value ?? "");
  const normalized = raw.trim().toUpperCase();
  return raw === normalized ? normalized : null;
}

function validAcademicYear(value: unknown) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}$/.test(text) ? text : null;
}

export function attendanceDateBelongsToAcademicYear(date: Date, academicYear: string) {
  const normalized = validAcademicYear(academicYear);
  if (!normalized) return false;
  const startYear = Number(normalized.slice(0, 4));
  const expectedEnd = (startYear + 1) % 100;
  if (Number(normalized.slice(5)) !== expectedEnd) return false;
  const start = new Date(`${startYear}-04-01T00:00:00.000Z`);
  const end = new Date(`${startYear + 1}-03-31T00:00:00.000Z`);
  return date >= start && date <= end;
}

function exactPrimaryTarget(
  assignment: {
    id: string;
    academicYear: string;
    classSection: {
      academicYear: string;
      className: string;
      section: string;
      isActive: boolean;
    };
    subject: { isActive: boolean };
  },
  academicYear: string
): TeacherAttendanceTarget | null {
  const className = canonicalClassName(assignment.classSection.className);
  const section = canonicalSection(assignment.classSection.section);
  if (
    assignment.academicYear !== academicYear ||
    assignment.classSection.academicYear !== academicYear ||
    !assignment.classSection.isActive ||
    !assignment.subject.isActive ||
    !className ||
    section === null
  ) return null;
  return {
    academicYear,
    className,
    section,
    source: "TIMETABLE",
    evidenceId: assignment.id,
    attendanceDate: null
  };
}

function exactSubstituteTarget(
  assignment: {
    id: string;
    assignmentDate: Date;
    academicYear: string | null;
    className: string | null;
    section: string | null;
    status: string;
    timetableAssignment: null | {
      academicYear: string;
      classSection: {
        academicYear: string;
        className: string;
        section: string;
        isActive: boolean;
      };
      subject: { isActive: boolean };
    };
  },
  academicYear: string
): TeacherAttendanceTarget | null {
  const className = canonicalClassName(assignment.className);
  const section = assignment.section === null ? null : canonicalSection(assignment.section);
  if (
    assignment.status !== "CONFIRMED" ||
    assignment.academicYear !== academicYear ||
    !className ||
    section === null ||
    !attendanceDateBelongsToAcademicYear(assignment.assignmentDate, academicYear)
  ) return null;
  if (assignment.timetableAssignment) {
    const timetableClass = canonicalClassName(assignment.timetableAssignment.classSection.className);
    const timetableSection = canonicalSection(assignment.timetableAssignment.classSection.section);
    if (
      assignment.timetableAssignment.academicYear !== academicYear ||
      assignment.timetableAssignment.classSection.academicYear !== academicYear ||
      !assignment.timetableAssignment.classSection.isActive ||
      !assignment.timetableAssignment.subject.isActive ||
      timetableClass !== className ||
      timetableSection !== section
    ) return null;
  }
  return {
    academicYear,
    className,
    section,
    source: "SUBSTITUTE",
    evidenceId: assignment.id,
    attendanceDate: assignment.assignmentDate
  };
}

function uniqueTargets(targets: TeacherAttendanceTarget[]) {
  return [...new Map(targets.map((target) => [
    `${target.source}|${target.academicYear}|${target.className}|${target.section}|${target.attendanceDate?.toISOString() ?? ""}`,
    target
  ])).values()];
}

export async function resolveTeacherAttendanceScope(
  client: ScopeClient,
  user: Pick<AuthUser, "id" | "role">,
  input: { academicYear: string; date?: Date; from?: Date; to?: Date }
): Promise<TeacherAttendanceScope> {
  if (user.role !== "TEACHER") {
    return { broad: true, staffLabel: null, targets: [], reason: null };
  }
  const academicYear = validAcademicYear(input.academicYear);
  if (!academicYear) {
    return { broad: false, staffLabel: null, targets: [], reason: "The selected academic year is unavailable." };
  }
  const staff = await client.staffMember.findUnique({
    where: { userId: user.id },
    include: {
      timetableTeacher: {
        include: {
          assignments: {
            where: { academicYear },
            include: { classSection: true, subject: true }
          }
        }
      }
    }
  });
  if (!staff || staff.status !== "ACTIVE") {
    return { broad: false, staffLabel: null, targets: [], reason: "No active StaffMember is linked to this Teacher account." };
  }
  const staffLabel = staff.displayName ?? staff.fullName;
  if (!staff.timetableTeacher || !staff.timetableTeacher.isActive) {
    return { broad: false, staffLabel, targets: [], reason: "No active timetable Teacher is linked to this StaffMember." };
  }

  const primary = staff.timetableTeacher.assignments
    .map((assignment) => exactPrimaryTarget(assignment, academicYear))
    .filter((target): target is TeacherAttendanceTarget => Boolean(target));
  const dateWhere = input.date
    ? { equals: input.date }
    : input.from && input.to
      ? { gte: input.from, lte: input.to }
      : null;
  const substituteRows = dateWhere
    ? await client.substituteAssignment.findMany({
      where: {
        substituteStaffMemberId: staff.id,
        status: "CONFIRMED",
        academicYear,
        assignmentDate: dateWhere
      },
      include: {
        timetableAssignment: {
          include: { classSection: true, subject: true }
        }
      },
      orderBy: [{ assignmentDate: "asc" }, { className: "asc" }, { section: "asc" }]
    })
    : [];
  const substitutes = substituteRows
    .map((assignment) => exactSubstituteTarget(assignment, academicYear))
    .filter((target): target is TeacherAttendanceTarget => Boolean(target));
  const targets = uniqueTargets([...primary, ...substitutes]);
  return {
    broad: false,
    staffLabel,
    targets,
    reason: targets.length ? null : "No exact active timetable or confirmed dated substitute scope is authorised."
  };
}

export function attendanceScopeOptionsForDate(scope: TeacherAttendanceScope, date: Date) {
  const options = scope.targets
    .filter((target) => target.source === "TIMETABLE" || target.attendanceDate?.getTime() === date.getTime())
    .sort((a, b) => a.className.localeCompare(b.className) || a.section.localeCompare(b.section));
  const byCohort = new Map<string, { className: string; section: string; source: "TIMETABLE" | "SUBSTITUTE" }>();
  for (const target of options) {
    const key = `${target.className}|${target.section}`;
    const existing = byCohort.get(key);
    if (!existing || target.source === "TIMETABLE") {
      byCohort.set(key, { className: target.className, section: target.section, source: target.source });
    }
  }
  return [...byCohort.values()];
}

export function requireAttendanceTarget(
  scope: TeacherAttendanceScope,
  target: AttendanceTarget
): { source: AttendanceAuthorizationSource; evidenceId: string | null } {
  if (scope.broad) return { source: "LEADERSHIP_PERMISSION", evidenceId: null };
  if (!attendanceDateBelongsToAcademicYear(target.attendanceDate, target.academicYear)) {
    throw new AttendanceScopeError();
  }
  const match = scope.targets.find((candidate) =>
    candidate.academicYear === target.academicYear &&
    candidate.className === target.className &&
    candidate.section === target.section &&
    (candidate.source === "TIMETABLE" || candidate.attendanceDate?.getTime() === target.attendanceDate.getTime())
  );
  if (!match) throw new AttendanceScopeError();
  return { source: match.source, evidenceId: match.evidenceId };
}

export function attendanceScopeWhere(scope: TeacherAttendanceScope): Prisma.StudentAttendanceSessionWhereInput {
  if (scope.broad) return {};
  if (!scope.targets.length) return { id: "__NO_AUTHORISED_ATTENDANCE_SCOPE__" };
  return {
    OR: scope.targets.map((target) => ({
      academicYear: target.academicYear,
      className: target.className,
      section: target.section,
      ...(target.source === "SUBSTITUTE" && target.attendanceDate
        ? { attendanceDate: target.attendanceDate }
        : {})
    }))
  };
}

export function requireAttendanceReportFilter(
  scope: TeacherAttendanceScope,
  filters: { academicYear: string; className?: string; section?: string }
) {
  if (scope.broad) return;
  if (filters.section !== undefined && !filters.className) {
    throw new AttendanceScopeError();
  }
  if (!filters.className) return;
  const allowed = scope.targets.some((target) =>
    target.academicYear === filters.academicYear &&
    target.className === filters.className &&
    (filters.section === undefined || target.section === filters.section)
  );
  if (!allowed) throw new AttendanceScopeError();
}

export function selectedAttendanceTarget(input: {
  attendanceDate?: unknown;
  academicYear?: unknown;
  className?: unknown;
  section?: unknown;
}): AttendanceTarget {
  const academicYear = String(input.academicYear ?? "").trim();
  const className = String(input.className ?? "").trim().toUpperCase();
  const section = String(input.section ?? "").trim().toUpperCase();
  if (!validAcademicYear(academicYear) || !className) throw new AttendanceScopeError("Choose a valid attendance scope.", 400);
  return {
    attendanceDate: attendanceDay(input.attendanceDate),
    academicYear,
    className,
    section
  };
}
