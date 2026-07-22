import type { Prisma, PrismaClient } from "@prisma/client";
import { getSchoolSettings } from "@/lib/school-settings";

export const ACADEMIC_ENROLLMENT_STATUSES = [
  "ACTIVE", "PROMOTED", "REPEATED", "TRANSFERRED_OUT", "LEFT",
  "DROPPED_OUT", "PASSED_OUT", "ALUMNI", "INACTIVE"
] as const;

export const STUDENT_LIFECYCLE_EVENT_TYPES = [
  "ENROLLED", "STATUS_UPDATED", "PROMOTED", "REPEATED", "TRANSFERRED_OUT",
  "LEFT", "DROPPED_OUT", "PASSED_OUT", "REJOINED", "CORRECTION"
] as const;

export type AcademicEnrollmentStatus = (typeof ACADEMIC_ENROLLMENT_STATUSES)[number];
export type StudentLifecycleEventType = (typeof STUDENT_LIFECYCLE_EVENT_TYPES)[number];

type LifecycleClient = Pick<
  PrismaClient | Prisma.TransactionClient,
  "student" | "academicYearEnrollment" | "studentLifecycleEvent" | "schoolSettings"
>;

type BackfillClient = LifecycleClient & {
  $transaction?: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
};

export async function getCurrentEnrollment(client: LifecycleClient, studentId: string, academicYear: string) {
  return client.academicYearEnrollment.findUnique({
    where: { studentId_academicYear: { studentId, academicYear } }
  });
}

export async function recordLifecycleEvent(
  client: Pick<LifecycleClient, "studentLifecycleEvent">,
  input: {
    studentId: string;
    academicYear?: string | null;
    eventType: StudentLifecycleEventType;
    fromClass?: string | null;
    fromSection?: string | null;
    toClass?: string | null;
    toSection?: string | null;
    fromStatus?: string | null;
    toStatus?: string | null;
    effectiveDate: Date;
    reason?: string | null;
    evidenceNotes?: string | null;
    parentAcknowledgementNotes?: string | null;
    approvedByUserId?: string | null;
    recordedByUserId?: string | null;
  }
) {
  if (!STUDENT_LIFECYCLE_EVENT_TYPES.includes(input.eventType)) throw new Error("Unsupported lifecycle event type");
  return client.studentLifecycleEvent.create({ data: input });
}

export async function createMissingEnrollmentSafely(
  client: LifecycleClient,
  input: {
    studentId: string;
    academicYear: string;
    className: string;
    section?: string | null;
    rollNo?: string | null;
    enrollmentDate?: Date | null;
    recordedByUserId?: string | null;
    reason?: string | null;
  }
) {
  const existing = await getCurrentEnrollment(client, input.studentId, input.academicYear);
  if (existing) return { enrollment: existing, created: false as const };

  const enrollment = await client.academicYearEnrollment.create({
    data: {
      studentId: input.studentId,
      academicYear: input.academicYear,
      className: input.className,
      section: input.section ?? null,
      rollNo: input.rollNo ?? null,
      status: "ACTIVE",
      enrollmentDate: input.enrollmentDate ?? null,
      notes: "Created by lifecycle foundation backfill."
    }
  });
  await recordLifecycleEvent(client, {
    studentId: input.studentId,
    academicYear: input.academicYear,
    eventType: "ENROLLED",
    toClass: input.className,
    toSection: input.section ?? null,
    toStatus: "ACTIVE",
    effectiveDate: input.enrollmentDate ?? new Date(),
    reason: input.reason ?? "Initial academic-year enrollment backfill",
    recordedByUserId: input.recordedByUserId ?? null
  });
  return { enrollment, created: true as const };
}

export async function backfillCurrentAcademicYearEnrollments(
  client: BackfillClient,
  options: { apply: boolean; academicYear?: string; recordedByUserId?: string | null; now?: Date }
) {
  const academicYear = options.academicYear?.trim() || (await getSchoolSettings(client)).academicYear;
  const students = await client.student.findMany({
    where: { deletedAt: null, status: "Active" },
    select: { id: true, admissionNo: true, className: true, section: true, rollNo: true },
    orderBy: { admissionNo: "asc" }
  });
  const existing = await client.academicYearEnrollment.findMany({
    where: { academicYear, studentId: { in: students.map((student) => student.id) } },
    select: { studentId: true }
  });
  const existingIds = new Set(existing.map((row) => row.studentId));
  const missing = students.filter((student) => !existingIds.has(student.id));
  if (!options.apply) return { academicYear, scanned: students.length, missing: missing.length, created: 0, alreadyPresent: existingIds.size };

  let created = 0;
  for (const student of missing) {
    const input = {
      studentId: student.id,
      academicYear,
      className: student.className,
      section: student.section,
      rollNo: student.rollNo,
      enrollmentDate: options.now ?? new Date(),
      recordedByUserId: options.recordedByUserId,
      reason: "Initial academic-year enrollment backfill"
    };
    const result = client.$transaction
      ? await client.$transaction((tx) => createMissingEnrollmentSafely(tx as LifecycleClient, input))
      : await createMissingEnrollmentSafely(client, input);
    if (result.created) created += 1;
  }
  return { academicYear, scanned: students.length, missing: missing.length, created, alreadyPresent: existingIds.size };
}

export async function lifecycleOverview(
  client: LifecycleClient,
  filters: { academicYear: string; className?: string; section?: string; status?: string }
) {
  const where = {
    academicYear: filters.academicYear,
    ...(filters.className ? { className: filters.className } : {}),
    ...(filters.section ? { section: filters.section } : {}),
    ...(filters.status ? { status: filters.status } : {})
  };
  const [enrollments, allForYear, activeStudents] = await Promise.all([
    client.academicYearEnrollment.findMany({
      where,
      include: { student: { select: { id: true, admissionNo: true, studentName: true, deletedAt: true } } },
      orderBy: [{ className: "asc" }, { section: "asc" }, { student: { studentName: "asc" } }]
    }),
    client.academicYearEnrollment.findMany({ where: { academicYear: filters.academicYear }, select: { studentId: true, status: true } }),
    client.student.findMany({ where: { deletedAt: null, status: "Active" }, select: { id: true } })
  ]);
  const covered = new Set(allForYear.map((row) => row.studentId));
  const counts = Object.fromEntries(ACADEMIC_ENROLLMENT_STATUSES.map((status) => [status, 0])) as Record<AcademicEnrollmentStatus, number>;
  for (const row of allForYear) if (row.status in counts) counts[row.status as AcademicEnrollmentStatus] += 1;
  return {
    enrollments: enrollments.filter((row) => row.student.deletedAt === null),
    counts,
    totalCurrentStudents: activeStudents.length,
    missingEnrollmentCount: activeStudents.filter((student) => !covered.has(student.id)).length
  };
}

type LifecycleApiEnrollment = {
  academicYear: string;
  className: string;
  section: string | null;
  rollNo: string | null;
  status: string;
  enrollmentDate: Date | null;
  exitDate: Date | null;
  exitReason: string | null;
  notes: string | null;
};

type LifecycleApiEvent = {
  academicYear: string | null;
  eventType: string;
  fromClass: string | null;
  fromSection: string | null;
  toClass: string | null;
  toSection: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  effectiveDate: Date;
  reason: string | null;
  evidenceNotes: string | null;
  parentAcknowledgementNotes: string | null;
};

export function lifecycleOverviewApiResponse(data: {
  counts: Record<string, number>;
  totalCurrentStudents: number;
  missingEnrollmentCount: number;
  enrollments: Array<LifecycleApiEnrollment & { student: { admissionNo: string; studentName: string } }>;
}) {
  return {
    counts: data.counts,
    totalCurrentStudents: data.totalCurrentStudents,
    missingEnrollmentCount: data.missingEnrollmentCount,
    enrollments: data.enrollments.map((row) => ({
      academicYear: row.academicYear,
      className: row.className,
      section: row.section,
      rollNo: row.rollNo,
      status: row.status,
      enrollmentDate: row.enrollmentDate,
      exitDate: row.exitDate,
      exitReason: row.exitReason,
      notes: row.notes,
      student: { admissionNo: row.student.admissionNo, studentName: row.student.studentName }
    }))
  };
}

export function studentLifecycleApiResponse(student: {
  admissionNo: string;
  studentName: string;
  academicYearEnrollments: LifecycleApiEnrollment[];
  lifecycleEvents: LifecycleApiEvent[];
}) {
  return {
    admissionNo: student.admissionNo,
    studentName: student.studentName,
    academicYearEnrollments: student.academicYearEnrollments.map((row) => ({
      academicYear: row.academicYear,
      className: row.className,
      section: row.section,
      rollNo: row.rollNo,
      status: row.status,
      enrollmentDate: row.enrollmentDate,
      exitDate: row.exitDate,
      exitReason: row.exitReason,
      notes: row.notes
    })),
    lifecycleEvents: student.lifecycleEvents.map((event) => ({
      academicYear: event.academicYear,
      eventType: event.eventType,
      fromClass: event.fromClass,
      fromSection: event.fromSection,
      toClass: event.toClass,
      toSection: event.toSection,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      effectiveDate: event.effectiveDate,
      reason: event.reason,
      evidenceNotes: event.evidenceNotes,
      parentAcknowledgementNotes: event.parentAcknowledgementNotes
    }))
  };
}
