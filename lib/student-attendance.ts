import type { Prisma, PrismaClient } from "@prisma/client";

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED"] as const;
export const ATTENDANCE_SESSION_STATUSES = ["DRAFT", "SUBMITTED", "LOCKED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AttendanceRecordInput = { studentId?: unknown; status?: unknown; remarks?: unknown };

export function localDateText(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function optionalAttendanceFilter(value: unknown) {
  const text = String(value ?? "").trim().toUpperCase();
  return text || undefined;
}

export function attendanceDay(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error("Choose a valid attendance date");
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error("Choose a valid attendance date");
  return date;
}

export function attendanceScope(input: { attendanceDate?: unknown; className?: unknown; section?: unknown; academicYear?: unknown }) {
  const className = String(input.className ?? "").trim().toUpperCase();
  const academicYear = String(input.academicYear ?? "").trim();
  if (!className) throw new Error("Choose a class");
  if (!academicYear) throw new Error("Academic year is required");
  return { attendanceDate: attendanceDay(input.attendanceDate), className, section: String(input.section ?? "").trim().toUpperCase(), academicYear };
}

export function validateAttendanceRecords(rows: unknown): Array<{ studentId: string; status: AttendanceStatus; remarks: string | null }> {
  if (!Array.isArray(rows)) throw new Error("Attendance records are required");
  const seen = new Set<string>();
  return rows.map((raw, index) => {
    const row = (raw ?? {}) as AttendanceRecordInput;
    const studentId = String(row.studentId ?? "").trim();
    const status = String(row.status ?? "").trim().toUpperCase();
    if (!studentId) throw new Error(`Attendance row ${index + 1} has no student`);
    if (seen.has(studentId)) throw new Error("A student appears more than once in this attendance session");
    seen.add(studentId);
    if (!(ATTENDANCE_STATUSES as readonly string[]).includes(status)) throw new Error(`Choose a valid attendance status for row ${index + 1}`);
    return { studentId, status: status as AttendanceStatus, remarks: String(row.remarks ?? "").trim() || null };
  });
}

export function attendanceTotals(rows: Array<{ status: string }>) {
  const totals = Object.fromEntries(ATTENDANCE_STATUSES.map((status) => [status, 0])) as Record<AttendanceStatus, number>;
  for (const row of rows) if ((ATTENDANCE_STATUSES as readonly string[]).includes(row.status)) totals[row.status as AttendanceStatus] += 1;
  return { ...totals, total: rows.length };
}

function safeCsvValue(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function attendanceReportCsv(rows: Array<{ attendanceDate: Date; className: string; section: string; admissionNo: string; rollNo: string | null; studentName: string; status: string; remarks: string | null }>) {
  const header = ["Date", "Class", "Section", "Admission No", "Roll No", "Student", "Attendance", "Remarks"];
  const body = rows.map((row) => [row.attendanceDate.toISOString().slice(0, 10), row.className, row.section, row.admissionNo, row.rollNo, row.studentName, row.status, row.remarks].map(safeCsvValue).join(","));
  return [header.map(safeCsvValue).join(","), ...body].join("\n");
}

export function friendlyAttendanceError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to update attendance";
  if (message.includes("Unique constraint")) return "Attendance already exists for this date, class, section, and academic year.";
  if (message.includes("Foreign key constraint")) return "A selected student or user is no longer available.";
  return message;
}

type AttendanceClient = Pick<PrismaClient, "studentAttendanceSession" | "student"> | Pick<Prisma.TransactionClient, "studentAttendanceSession" | "student">;

export async function activeStudentsForScope(client: AttendanceClient, scope: { academicYear: string; className: string; section: string }) {
  return client.student.findMany({
    where: { academicYear: scope.academicYear, className: scope.className, section: scope.section || null, status: "Active", deletedAt: null },
    select: { id: true, admissionNo: true, studentName: true, rollNo: true, className: true, section: true },
    orderBy: [{ rollNo: "asc" }, { studentName: "asc" }]
  });
}

export async function attendanceReportData(client: Pick<PrismaClient, "studentAttendanceSession">, filters: { from: Date; to: Date; academicYear: string; className?: string; section?: string }) {
  const sessions = await client.studentAttendanceSession.findMany({
    where: {
      attendanceDate: { gte: filters.from, lte: filters.to }, academicYear: filters.academicYear,
      status: { in: ["SUBMITTED", "LOCKED"] },
      ...(filters.className ? { className: filters.className } : {}),
      ...(filters.section !== undefined ? { section: filters.section } : {})
    },
    include: { records: { include: { student: { select: { studentName: true, rollNo: true } } } } },
    orderBy: [{ attendanceDate: "desc" }, { className: "asc" }, { section: "asc" }]
  });
  const rows = sessions.flatMap((session) => session.records.map((record) => ({
    attendanceDate: session.attendanceDate, className: session.className, section: session.section,
    sessionStatus: session.status, admissionNo: record.admissionNo, studentName: record.student.studentName,
    rollNo: record.student.rollNo, status: record.status, remarks: record.remarks
  })));
  const byStudent = new Map<string, { admissionNo: string; studentName: string; className: string; section: string; present: number; absent: number; late: number; halfDay: number; excused: number; total: number }>();
  for (const row of rows) {
    const item = byStudent.get(row.admissionNo) ?? { admissionNo: row.admissionNo, studentName: row.studentName, className: row.className, section: row.section, present: 0, absent: 0, late: 0, halfDay: 0, excused: 0, total: 0 };
    item.total += 1;
    if (row.status === "PRESENT") item.present += 1;
    else if (row.status === "ABSENT") item.absent += 1;
    else if (row.status === "LATE") item.late += 1;
    else if (row.status === "HALF_DAY") item.halfDay += 1;
    else if (row.status === "EXCUSED") item.excused += 1;
    byStudent.set(row.admissionNo, item);
  }
  return { sessions, rows, totals: attendanceTotals(rows), byStudent: [...byStudent.values()].sort((a, b) => a.studentName.localeCompare(b.studentName)) };
}
