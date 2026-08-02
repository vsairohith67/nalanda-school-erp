import type { Prisma, PrismaClient } from "@prisma/client";
import { ATTENDANCE_STATUSES, attendanceTotals, type AttendanceStatus } from "@/lib/student-attendance";
import { ParentChildContextError, resolveActiveParentChildContext } from "@/lib/iam/contexts";

type ParentAcademicClient = PrismaClient | Prisma.TransactionClient;

export const PARENT_ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  HALF_DAY: "Half day",
  EXCUSED: "Excused"
};

export type ParentAcademicActor = {
  userId: string;
  sessionId: string;
  roleAssignmentId: string;
};

export type ParentChildRequest = {
  academicYear: string;
  childHandle?: string | null;
  expectedContextVersion?: number | null;
};

export class ParentAcademicAccessError extends Error {
  status: number;

  constructor(message = "The requested linked-child record is unavailable", status = 404) {
    super(message);
    this.name = "ParentAcademicAccessError";
    this.status = status;
  }
}

export function parentAttendanceMonth(value: unknown, fallback = currentSchoolMonth()) {
  const month = String(value ?? fallback).trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ParentAcademicAccessError("Choose a valid attendance month", 400);
  }
  const from = new Date(`${month}-01T00:00:00.000Z`);
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return { month, from, to };
}

export async function loadParentAttendance(
  client: ParentAcademicClient,
  actor: ParentAcademicActor,
  request: ParentChildRequest & { month?: unknown }
) {
  const { month, from, to } = parentAttendanceMonth(request.month);
  const context = await resolveContext(client, actor, request);
  const sessions = await client.studentAttendanceSession.findMany({
    where: {
      academicYear: context.child.academicYear,
      className: context.child.className,
      section: context.child.section ?? "",
      status: { in: ["SUBMITTED", "LOCKED"] },
      attendanceDate: { gte: from, lt: to },
      records: { some: { studentId: context.child.id } }
    },
    select: {
      attendanceDate: true,
      status: true,
      updatedAt: true,
      records: {
        where: { studentId: context.child.id },
        select: { status: true, updatedAt: true },
        take: 1
      }
    },
    orderBy: { attendanceDate: "asc" },
    take: 31
  });
  const entries = sessions.flatMap((session) => {
    const record = session.records[0];
    if (!record || !(ATTENDANCE_STATUSES as readonly string[]).includes(record.status)) return [];
    return [{
      date: session.attendanceDate.toISOString().slice(0, 10),
      status: record.status as AttendanceStatus,
      label: PARENT_ATTENDANCE_STATUS_LABELS[record.status as AttendanceStatus],
      officialState: session.status === "LOCKED" ? "Official locked record" : "Official posted record",
      updatedAt: latest(session.updatedAt, record.updatedAt).toISOString()
    }];
  });
  const counts = attendanceTotals(entries);
  const lastOfficialUpdateAt = entries.length
    ? entries.reduce((last, entry) => entry.updatedAt > last ? entry.updatedAt : last, entries[0].updatedAt)
    : null;
  return {
    context: publicContext(context),
    month,
    entries,
    counts,
    officialRecordedDayCount: entries.length,
    workingDayCount: null,
    workingDayPolicyAvailable: false,
    attendancePercentage: null,
    attendancePercentagePolicyAvailable: false,
    lastOfficialUpdateAt,
    policyNotice: "Nalanda has no governed working-day calendar or approved daily-attendance percentage rule. Dates without an official posted record are not labelled absent or non-working, and no percentage is inferred."
  };
}

export async function loadParentExaminationTimetables(
  client: ParentAcademicClient,
  actor: ParentAcademicActor,
  request: ParentChildRequest,
  now = new Date()
) {
  const context = await resolveContext(client, actor, request);
  const versions = await client.examinationTimetableVersion.findMany({
    where: {
      academicYear: context.child.academicYear,
      className: context.child.className,
      section: context.child.section ?? "",
      status: "PUBLISHED",
      currentPublicationKey: { not: null },
      examination: { status: "ACTIVE" },
      classScope: { status: "ACTIVE", timetableClassSection: { isActive: true } }
    },
    select: {
      parentInstructions: true,
      replacesVersionId: true,
      publishedAt: true,
      examination: {
        select: { examCode: true, name: true, examType: true, startDate: true, endDate: true }
      },
      rows: {
        select: {
          subjectNameSnapshot: true,
          paperCodeSnapshot: true,
          paperNameSnapshot: true,
          examDate: true,
          startTime: true,
          endTime: true,
          reportingTime: true,
          venue: true,
          parentInstructions: true,
          displayOrder: true
        },
        orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { displayOrder: "asc" }]
      }
    },
    orderBy: [{ examination: { startDate: "asc" } }, { publishedAt: "desc" }],
    take: 50
  });
  const timetables = versions.map((version) => ({
    examination: {
      code: version.examination.examCode,
      name: version.examination.name,
      type: humanize(version.examination.examType),
      startDate: dateKey(version.examination.startDate),
      endDate: dateKey(version.examination.endDate)
    },
    updated: Boolean(version.replacesVersionId),
    statusLabel: version.replacesVersionId ? "Updated published timetable" : "Published timetable",
    publishedAt: version.publishedAt?.toISOString() ?? null,
    parentInstructions: version.parentInstructions,
    rows: version.rows.map((row) => ({
      date: dateKey(row.examDate),
      subject: row.subjectNameSnapshot,
      paper: row.paperNameSnapshot,
      paperCode: row.paperCodeSnapshot,
      startTime: row.startTime,
      endTime: row.endTime,
      reportingTime: row.reportingTime,
      venue: row.venue,
      instructions: row.parentInstructions
    }))
  }));
  const today = dateKey(now);
  const upcomingRows = timetables.flatMap((timetable) => timetable.rows.map((row) => ({
    ...row,
    examinationName: timetable.examination.name
  }))).filter((row) => row.date >= today);
  return {
    context: publicContext(context),
    timetables,
    upcomingSummary: {
      examinationCount: timetables.filter((timetable) => timetable.examination.endDate >= today).length,
      paperCount: upcomingRows.length,
      nextPaper: upcomingRows[0] ?? null
    }
  };
}

async function resolveContext(client: ParentAcademicClient, actor: ParentAcademicActor, request: ParentChildRequest) {
  try {
    return await resolveActiveParentChildContext(client, {
      userId: actor.userId,
      sessionId: actor.sessionId,
      roleAssignmentId: actor.roleAssignmentId,
      academicYear: request.academicYear,
      childHandle: request.childHandle,
      expectedContextVersion: request.expectedContextVersion
    });
  } catch (error) {
    if (error instanceof ParentChildContextError) throw new ParentAcademicAccessError();
    throw error;
  }
}

function publicContext(context: Awaited<ReturnType<typeof resolveActiveParentChildContext>>) {
  return {
    childHandle: context.handle,
    contextVersion: context.contextVersion,
    child: {
      studentName: context.child.studentName,
      admissionNo: context.child.admissionNo,
      academicYear: context.child.academicYear,
      className: context.child.className,
      section: context.child.section,
      rollNo: context.child.rollNo
    }
  };
}

function currentSchoolMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit"
  }).format(new Date());
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function latest(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
