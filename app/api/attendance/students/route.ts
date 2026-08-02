import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { getSchoolSettings } from "@/lib/school-settings";
import {
  activeStudentsForScope,
  attendanceCorrectionReason,
  attendanceScope,
  expectedAttendanceVersion,
  friendlyAttendanceError,
  validateAttendanceRecords
} from "@/lib/student-attendance";
import {
  attendanceDateBelongsToAcademicYear,
  AttendanceScopeError,
  attendanceScopeOptionsForDate,
  requireAttendanceTarget,
  resolveTeacherAttendanceScope
} from "@/lib/teacher-attendance-scope";
import { logUserAction } from "@/lib/user-audit";
import { captureAttendanceCalendarBasis } from "@/lib/academic-calendar";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
const ACTIONS = new Set(["create", "save", "clear", "submit", "correct", "lock"]);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STUDENT_ATTENDANCE");
  if (auth.response) return auth.response;
  try {
    const settings = await getSchoolSettings(prisma);
    const academicYear = request.nextUrl.searchParams.get("academicYear") || settings.academicYear;
    const attendanceDate = attendanceScope({
      attendanceDate: request.nextUrl.searchParams.get("attendanceDate"),
      className: request.nextUrl.searchParams.get("className") || "__SCOPE_OPTIONS__",
      section: request.nextUrl.searchParams.get("section"),
      academicYear
    }).attendanceDate;
    if (request.nextUrl.searchParams.get("mode") === "scopes") {
      if (auth.user.role === "TEACHER") {
        if (
          academicYear !== settings.academicYear ||
          !attendanceDateBelongsToAcademicYear(attendanceDate, academicYear)
        ) throw new AttendanceScopeError();
        const resolved = await resolveTeacherAttendanceScope(prisma, auth.user, {
          academicYear: settings.academicYear,
          date: attendanceDate
        });
        return json({
          classSections: attendanceScopeOptionsForDate(resolved, attendanceDate),
          emptyReason: resolved.reason
        });
      }
      const rows = await prisma.student.findMany({
        where: { academicYear, status: "Active", deletedAt: null },
        select: { className: true, section: true },
        distinct: ["className", "section"],
        orderBy: [{ className: "asc" }, { section: "asc" }]
      });
      return json({
        classSections: rows
          .filter((row) => row.className)
          .map((row) => ({ className: row.className, section: row.section ?? "", source: "LEADERSHIP_PERMISSION" }))
      });
    }

    const target = attendanceScope(Object.fromEntries(request.nextUrl.searchParams));
    const resolved = await resolveTeacherAttendanceScope(prisma, auth.user, {
      academicYear: auth.user.role === "TEACHER" ? settings.academicYear : target.academicYear,
      date: target.attendanceDate
    });
    const authorization = requireAttendanceTarget(resolved, target);
    const [students, session] = await Promise.all([
      activeStudentsForScope(prisma, target),
      prisma.studentAttendanceSession.findUnique({
        where: { attendanceDate_className_section_academicYear: target },
        include: { records: true }
      })
    ]);
    return json({ students, session, authorizationSource: authorization.source });
  } catch (error) {
    const result = attendanceApiError(error, "Unable to load attendance");
    return json({ error: result.message }, result.status);
  }
}

export async function POST(request: NextRequest) {
  const viewAuth = await requireApiPermission("VIEW_STUDENT_ATTENDANCE");
  if (viewAuth.response) return viewAuth.response;
  try {
    const body = await request.json();
    const action = String(body.action ?? "").trim().toLowerCase();
    if (!ACTIONS.has(action)) throw new Error("Unknown attendance action");
    const permission = action === "submit"
      ? "SUBMIT_STUDENT_ATTENDANCE"
      : action === "lock"
        ? "LOCK_STUDENT_ATTENDANCE"
        : "MANAGE_STUDENT_ATTENDANCE";
    const auth = await requireApiPermission(permission);
    if (auth.response) return auth.response;
    if (action === "submit") {
      const manageAuth = await requireApiPermission("MANAGE_STUDENT_ATTENDANCE");
      if (manageAuth.response) return manageAuth.response;
    }

    const settings = await getSchoolSettings(prisma);
    const target = attendanceScope(body);
    const resolved = await resolveTeacherAttendanceScope(prisma, auth.user, {
      academicYear: auth.user.role === "TEACHER" ? settings.academicYear : target.academicYear,
      date: target.attendanceDate
    });
    const authorization = requireAttendanceTarget(resolved, target);
    const correctionReason = action === "correct" ? attendanceCorrectionReason(body.correctionReason) : null;
    const correlationId = crypto.randomUUID();

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.studentAttendanceSession.findUnique({
        where: { attendanceDate_className_section_academicYear: target },
        include: { records: true }
      });
      if (action === "create") {
        if (existing) return existing;
        const created = await tx.studentAttendanceSession.create({
          data: { ...target, status: "DRAFT", takenByUserId: auth.user.id },
          include: { records: true }
        });
        await attendanceAudit(tx, {
          action,
          actor: auth.user,
          target,
          authorization,
          correlationId,
          sessionId: created.id,
          beforeStatus: null,
          afterStatus: created.status,
          recordCount: 0
        });
        return created;
      }
      if (!existing) throw new AttendanceConflictError("Create the attendance draft before updating it.");
      const expected = expectedAttendanceVersion(body.expectedUpdatedAt);
      if (existing.updatedAt.getTime() !== expected.getTime()) {
        throw new AttendanceConflictError("Attendance changed since it was opened. Reload and try again.");
      }
      if (action === "lock" && existing.status !== "SUBMITTED") {
        throw new Error("Only submitted attendance can be locked");
      }
      if (["save", "clear", "submit"].includes(action) && existing.status !== "DRAFT") {
        throw new Error(`${existing.status === "LOCKED" ? "Locked" : "Submitted"} attendance cannot be edited as a draft`);
      }
      if (action === "correct" && existing.status !== "SUBMITTED") {
        throw new Error("Only submitted, unlocked attendance can be corrected");
      }

      const records = ["save", "submit", "correct"].includes(action)
        ? validateAttendanceRecords(body.records)
        : [];
      const students = records.length || action === "submit" || action === "correct"
        ? await activeStudentsForScope(tx, target)
        : [];
      const allowed = new Map(students.map((student) => [student.id, student]));
      if (records.some((row) => !allowed.has(row.studentId))) {
        throw new AttendanceScopeError();
      }
      if (action === "submit" || action === "correct") {
        if (!students.length) throw new Error("This class has no active students to submit");
        if (records.length !== students.length) {
          throw new Error(action === "correct"
            ? "Include every active student when correcting submitted attendance"
            : "Mark every active student before submitting attendance");
        }
      }
      const prior = new Map(existing.records.map((record) => [
        record.studentId,
        `${record.status}|${record.remarks ?? ""}`
      ]));
      const changedCount = records.filter((record) =>
        prior.get(record.studentId) !== `${record.status}|${record.remarks ?? ""}`
      ).length + existing.records.filter((record) => !records.some((item) => item.studentId === record.studentId)).length;
      if (action === "correct" && changedCount === 0) {
        throw new Error("Change at least one attendance mark or remark before applying a correction");
      }

      const now = new Date();
      const nextStatus = action === "submit"
        ? "SUBMITTED"
        : action === "lock"
          ? "LOCKED"
          : existing.status;
      const calendarBasis = action === "submit" || (action === "lock" && !existing.calendarBasisSnapshotJson)
        ? await captureAttendanceCalendarBasis(tx, {
            academicYear: target.academicYear,
            attendanceDate: target.attendanceDate,
            className: target.className,
            section: target.section
          })
        : null;
      const changed = await tx.studentAttendanceSession.updateMany({
        where: { id: existing.id, status: existing.status, updatedAt: expected },
        data: {
          status: nextStatus,
          updatedAt: now,
          ...(action === "submit" ? { submittedAt: now, submittedByUserId: auth.user.id } : {}),
          ...(action === "lock" ? { lockedAt: now, lockedByUserId: auth.user.id } : {}),
          ...(calendarBasis ?? {})
        }
      });
      if (changed.count !== 1) {
        throw new AttendanceConflictError("Attendance changed since it was opened. Reload and try again.");
      }

      if (action === "clear") {
        await tx.studentAttendanceRecord.deleteMany({ where: { sessionId: existing.id } });
      }
      if (["save", "submit", "correct"].includes(action)) {
        if (records.length) {
          await tx.studentAttendanceRecord.deleteMany({
            where: { sessionId: existing.id, studentId: { notIn: records.map((record) => record.studentId) } }
          });
        } else {
          await tx.studentAttendanceRecord.deleteMany({ where: { sessionId: existing.id } });
        }
        for (const record of records) {
          const student = allowed.get(record.studentId)!;
          await tx.studentAttendanceRecord.upsert({
            where: { sessionId_studentId: { sessionId: existing.id, studentId: record.studentId } },
            update: { status: record.status, remarks: record.remarks, admissionNo: student.admissionNo },
            create: {
              sessionId: existing.id,
              studentId: record.studentId,
              admissionNo: student.admissionNo,
              status: record.status,
              remarks: record.remarks
            }
          });
        }
      }
      await attendanceAudit(tx, {
        action,
        actor: auth.user,
        target,
        authorization,
        correlationId,
        sessionId: existing.id,
        beforeStatus: existing.status,
        afterStatus: nextStatus,
        recordCount: action === "clear" ? 0 : records.length || existing.records.length,
        changedCount,
        correctionReason
      });
      return tx.studentAttendanceSession.findUniqueOrThrow({
        where: { id: existing.id },
        include: { records: true }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return json({ session: result });
  } catch (error) {
    const result = attendanceApiError(error, "Unable to update attendance");
    return json({ error: result.message }, result.status);
  }
}

class AttendanceConflictError extends Error {
  readonly status = 409;
}

function attendanceApiError(error: unknown, fallback: string) {
  if (error instanceof AttendanceScopeError) return { message: error.message, status: error.status };
  if (error instanceof AttendanceConflictError) return { message: error.message, status: error.status };
  return {
    message: safeClientError(new Error(friendlyAttendanceError(error)), fallback),
    status: 400
  };
}

async function attendanceAudit(
  client: Parameters<typeof logUserAction>[0],
  input: {
    action: string;
    actor: { id: string; name: string; role: string };
    target: { attendanceDate: Date; academicYear: string; className: string; section: string };
    authorization: { source: string; evidenceId: string | null };
    correlationId: string;
    sessionId: string;
    beforeStatus: string | null;
    afterStatus: string;
    recordCount: number;
    changedCount?: number;
    correctionReason?: string | null;
  }
) {
  await logUserAction(client, {
    action: `STUDENT_ATTENDANCE_${input.action.toUpperCase()}`,
    actor: input.actor,
    details: {
      actorRole: input.actor.role,
      academicYear: input.target.academicYear,
      attendanceDate: input.target.attendanceDate.toISOString().slice(0, 10),
      className: input.target.className,
      section: input.target.section,
      authorizationSource: input.authorization.source,
      authorizationEvidenceId: input.authorization.evidenceId,
      sessionId: input.sessionId,
      beforeStatus: input.beforeStatus,
      afterStatus: input.afterStatus,
      recordCount: input.recordCount,
      changedCount: input.changedCount ?? 0,
      correctionReason: input.correctionReason ?? null,
      correlationId: input.correlationId
    }
  });
}
