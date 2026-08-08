import type { Prisma, PrismaClient } from "@prisma/client";

export const STAFF_LEAVE_TYPES = ["CASUAL", "SICK", "EMERGENCY", "PERMISSION", "HALF_DAY", "UNPAID", "OTHER"] as const;
export const STAFF_LEAVE_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export const HALF_DAY_SESSIONS = ["FORENOON", "AFTERNOON"] as const;
export type StaffLeaveType = (typeof STAFF_LEAVE_TYPES)[number];
export type StaffLeaveStatus = (typeof STAFF_LEAVE_STATUSES)[number];

export function localLeaveDateText(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function leaveDate(value: unknown, label = "Leave date") {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${label} is required`);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error(`${label} is invalid`);
  return date;
}

export function validateStaffLeaveInput(raw: unknown, options: { submitting?: boolean } = {}) {
  const source = (raw ?? {}) as Record<string, unknown>;
  const staffMemberId = String(source.staffMemberId ?? "").trim();
  const leaveType = String(source.leaveType ?? "").trim().toUpperCase();
  const startDate = leaveDate(source.startDate, "Start date");
  const endDate = leaveDate(source.endDate, "End date");
  if (!staffMemberId) throw new Error("Choose a staff member");
  if (!(STAFF_LEAVE_TYPES as readonly string[]).includes(leaveType)) throw new Error("Choose a valid leave type");
  if (endDate < startDate) throw new Error("End date cannot be before start date");
  const halfDaySessionText = String(source.halfDaySession ?? "").trim().toUpperCase();
  const halfDaySession = halfDaySessionText || leaveType === "HALF_DAY" ? halfDaySessionText : null;
  if (leaveType === "HALF_DAY" || halfDaySession) {
    if (startDate.getTime() !== endDate.getTime()) throw new Error("Half-day leave must start and end on the same date");
    if (!(HALF_DAY_SESSIONS as readonly string[]).includes(halfDaySessionText)) throw new Error("Choose Fore Noon or After Noon for half-day leave");
  }
  const reason = String(source.reason ?? "").trim();
  if (options.submitting && !reason) throw new Error("Reason is required before submitting leave");
  const substituteRequired = source.substituteRequired === true || source.substituteRequired === "true" || source.substituteRequired === "on";
  const substituteNotes = String(source.substituteNotes ?? "").trim() || null;
  const notes = String(source.notes ?? "").trim() || null;
  const totalDays = leaveType === "HALF_DAY" || halfDaySession ? 0.5 : Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
  return { staffMemberId, leaveType: leaveType as StaffLeaveType, startDate, endDate, halfDaySession: halfDaySessionText || null, totalDays, reason, substituteRequired, substituteNotes, notes };
}

type LeaveClient = Pick<PrismaClient | Prisma.TransactionClient, "staffLeaveRequest">;
export async function overlappingLeaveWarning(client: LeaveClient, input: { staffMemberId: string; startDate: Date; endDate: Date; excludeId?: string }) {
  const count = await client.staffLeaveRequest.count({ where: { staffMemberId: input.staffMemberId, id: input.excludeId ? { not: input.excludeId } : undefined, status: { in: ["PENDING", "APPROVED"] }, startDate: { lte: input.endDate }, endDate: { gte: input.startDate } } });
  return count ? `Warning: ${count} pending or approved leave request${count === 1 ? "" : "s"} overlap this date range.` : null;
}

export async function linkedStaffMember(client: Pick<PrismaClient, "staffMember">, userId: string) {
  return client.staffMember.findUnique({ where: { userId }, select: { id: true, fullName: true, displayName: true, staffCode: true, designation: true, status: true } });
}

export function staffLeaveWhere(filters: { status?: string | null; leaveType?: string | null; staffMemberId?: string | null; from?: string | null; to?: string | null; ownStaffMemberId?: string | null }) {
  const where: Prisma.StaffLeaveRequestWhereInput = {};
  if (filters.ownStaffMemberId) where.staffMemberId = filters.ownStaffMemberId;
  else if (filters.staffMemberId) where.staffMemberId = filters.staffMemberId;
  if (filters.status && (STAFF_LEAVE_STATUSES as readonly string[]).includes(filters.status)) where.status = filters.status;
  if (filters.leaveType && (STAFF_LEAVE_TYPES as readonly string[]).includes(filters.leaveType)) where.leaveType = filters.leaveType;
  if (filters.from) where.endDate = { gte: leaveDate(filters.from, "From date") };
  if (filters.to) where.startDate = { lte: leaveDate(filters.to, "To date") };
  return where;
}

export const staffLeaveInclude = { staffMember: { select: { id: true, staffCode: true, fullName: true, displayName: true, designation: true } }, requestedBy: { select: { id: true, name: true } }, approver: { select: { id: true, name: true } }, cancelledBy: { select: { id: true, name: true } } } as const;

export async function staffLeaveReportData(client: Pick<PrismaClient, "staffLeaveRequest">, filters: { from: Date; to: Date; staffMemberId?: string | null }) {
  const requests = await client.staffLeaveRequest.findMany({ where: { startDate: { lte: filters.to }, endDate: { gte: filters.from }, staffMemberId: filters.staffMemberId || undefined }, include: staffLeaveInclude, orderBy: [{ startDate: "desc" }, { createdAt: "desc" }] });
  const byType = Object.fromEntries(STAFF_LEAVE_TYPES.map((type) => [type, 0])) as Record<StaffLeaveType, number>;
  for (const row of requests) if ((STAFF_LEAVE_TYPES as readonly string[]).includes(row.leaveType)) byType[row.leaveType as StaffLeaveType] += 1;
  return { requests, pending: requests.filter((row) => row.status === "PENDING"), approved: requests.filter((row) => row.status === "APPROVED"), byType };
}

function safeCsv(value: unknown) { const raw = String(value ?? ""); const safe = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; }
export function staffLeaveReportCsv(rows: Array<{ startDate: Date; endDate: Date; leaveType: string; totalDays: number; status: string; reason: string; substituteRequired: boolean; staffMember: { staffCode: string | null; fullName: string; designation: string } }>) {
  const header = ["Start Date", "End Date", "Staff Code", "Staff Name", "Designation", "Leave Type", "Total Days", "Status", "Reason", "Substitute Required"];
  return [header.map(safeCsv).join(","), ...rows.map((row) => [row.startDate.toISOString().slice(0,10), row.endDate.toISOString().slice(0,10), row.staffMember.staffCode, row.staffMember.fullName, row.staffMember.designation, row.leaveType, row.totalDays, row.status, row.reason, row.substituteRequired ? "Yes" : "No"].map(safeCsv).join(","))].join("\n");
}

export function leaveLabel(value: string) { return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
export function friendlyStaffLeaveError(error: unknown) { const message = error instanceof Error ? error.message : "Unable to update staff leave"; if (message.includes("Foreign key constraint")) return "The selected staff member or user is no longer available."; return message; }
