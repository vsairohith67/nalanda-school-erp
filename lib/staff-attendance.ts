import type { Prisma, PrismaClient } from "@prisma/client";
import { attendanceDay, localDateText } from "@/lib/student-attendance";

export { attendanceDay, localDateText };
export const STAFF_ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE", "EXCUSED"] as const;
export type StaffAttendanceStatus = (typeof STAFF_ATTENDANCE_STATUSES)[number];
export type StaffAttendanceRecordInput = { staffMemberId?: unknown; status?: unknown; checkInTime?: unknown; checkOutTime?: unknown; lateMinutes?: unknown; remarks?: unknown };

function optionalTime(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new Error(`${label} must use HH:MM time`);
  return text;
}

export function validateStaffAttendanceRecords(rows: unknown) {
  if (!Array.isArray(rows)) throw new Error("Staff attendance records are required");
  const seen = new Set<string>();
  return rows.map((raw, index) => {
    const row = (raw ?? {}) as StaffAttendanceRecordInput;
    const staffMemberId = String(row.staffMemberId ?? "").trim(); const status = String(row.status ?? "").trim().toUpperCase();
    if (!staffMemberId) throw new Error(`Attendance row ${index + 1} has no staff member`);
    if (seen.has(staffMemberId)) throw new Error("A staff member appears more than once in this attendance session"); seen.add(staffMemberId);
    if (!(STAFF_ATTENDANCE_STATUSES as readonly string[]).includes(status)) throw new Error(`Choose a valid staff attendance status for row ${index + 1}`);
    const lateText = String(row.lateMinutes ?? "").trim(); const lateMinutes = lateText ? Number(lateText) : null;
    if (lateMinutes !== null && (!Number.isInteger(lateMinutes) || lateMinutes < 0 || lateMinutes > 1440)) throw new Error("Late minutes must be a whole number from 0 to 1440");
    return { staffMemberId, status: status as StaffAttendanceStatus, checkInTime: optionalTime(row.checkInTime, "Check-in"), checkOutTime: optionalTime(row.checkOutTime, "Check-out"), lateMinutes, remarks: String(row.remarks ?? "").trim() || null, source: "MANUAL" as const };
  });
}

export function staffAttendanceTotals(rows: Array<{ status: string }>) {
  const totals = Object.fromEntries(STAFF_ATTENDANCE_STATUSES.map((status) => [status, 0])) as Record<StaffAttendanceStatus, number>;
  for (const row of rows) if ((STAFF_ATTENDANCE_STATUSES as readonly string[]).includes(row.status)) totals[row.status as StaffAttendanceStatus] += 1;
  return { ...totals, total: rows.length };
}

function safeCsv(value: unknown) { const raw = String(value ?? ""); const safe = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; }
export function staffAttendanceReportCsv(rows: Array<{ attendanceDate: Date; staffCode: string | null; fullName: string; designation: string; status: string; checkInTime: string | null; checkOutTime: string | null; lateMinutes: number | null; remarks: string | null; source: string }>) {
  const header = ["Date", "Staff Code", "Staff Name", "Designation", "Attendance", "Check In", "Check Out", "Late Minutes", "Remarks", "Source"];
  return [header.map(safeCsv).join(","), ...rows.map((row) => [row.attendanceDate.toISOString().slice(0, 10), row.staffCode, row.fullName, row.designation, row.status, row.checkInTime, row.checkOutTime, row.lateMinutes, row.remarks, row.source].map(safeCsv).join(","))].join("\n");
}

type ActiveStaffClient = Pick<PrismaClient, "staffMember"> | Pick<Prisma.TransactionClient, "staffMember">;
export function activeStaffMembers(client: ActiveStaffClient) {
  return client.staffMember.findMany({ where: { status: "ACTIVE" }, select: { id: true, staffCode: true, fullName: true, displayName: true, designation: true, department: true, staffType: true }, orderBy: [{ fullName: "asc" }] });
}

export async function staffAttendanceReportData(client: Pick<PrismaClient, "staffAttendanceSession">, filters: { from: Date; to: Date }) {
  const sessions = await client.staffAttendanceSession.findMany({ where: { attendanceDate: { gte: filters.from, lte: filters.to }, status: { in: ["SUBMITTED", "LOCKED"] } }, include: { records: { include: { staffMember: { select: { fullName: true, designation: true } } } } }, orderBy: { attendanceDate: "desc" } });
  const rows = sessions.flatMap((session) => session.records.map((record) => ({ attendanceDate: session.attendanceDate, sessionStatus: session.status, staffCode: record.staffCode, staffMemberId: record.staffMemberId, fullName: record.staffMember.fullName, designation: record.staffMember.designation, status: record.status, checkInTime: record.checkInTime, checkOutTime: record.checkOutTime, lateMinutes: record.lateMinutes, remarks: record.remarks, source: record.source })));
  const byStaff = new Map<string, { staffCode: string | null; fullName: string; designation: string; present: number; absent: number; late: number; halfDay: number; onLeave: number; excused: number; total: number }>();
  for (const row of rows) { const item = byStaff.get(row.staffMemberId) ?? { staffCode: row.staffCode, fullName: row.fullName, designation: row.designation, present: 0, absent: 0, late: 0, halfDay: 0, onLeave: 0, excused: 0, total: 0 }; item.total++; if (row.status === "PRESENT") item.present++; else if (row.status === "ABSENT") item.absent++; else if (row.status === "LATE") item.late++; else if (row.status === "HALF_DAY") item.halfDay++; else if (row.status === "ON_LEAVE") item.onLeave++; else if (row.status === "EXCUSED") item.excused++; byStaff.set(row.staffMemberId, item); }
  return { sessions, rows, totals: staffAttendanceTotals(rows), byStaff: [...byStaff.values()].sort((a, b) => a.fullName.localeCompare(b.fullName)) };
}

export function friendlyStaffAttendanceError(error: unknown) { const message = error instanceof Error ? error.message : "Unable to update staff attendance"; if (message.includes("Unique constraint")) return "Staff attendance already exists for this date."; if (message.includes("Foreign key constraint")) return "A selected staff member or user is no longer available."; return message; }
