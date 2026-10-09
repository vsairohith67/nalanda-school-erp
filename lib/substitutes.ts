import type { Prisma, PrismaClient } from "@prisma/client";
import { attendanceDateBelongsToAcademicYear } from "@/lib/teacher-attendance-scope";

type SubstituteClient = PrismaClient | Prisma.TransactionClient;

export const SUBSTITUTE_REASONS = ["APPROVED_LEAVE", "STAFF_ABSENT", "EMERGENCY", "MANUAL", "OTHER"] as const;
export const SUBSTITUTE_STATUSES = ["DRAFT", "ASSIGNED", "CONFIRMED", "COMPLETED", "CANCELLED"] as const;
export const SUBSTITUTE_PRIORITIES = ["NORMAL", "URGENT"] as const;

export function localSubstituteDateText(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function substituteDate(value: unknown, label = "Assignment date") {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${label} is required`);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new Error(`${label} is invalid`);
  return date;
}

function optionalTime(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new Error(`${label} must use HH:MM time`);
  return text;
}

export function validateSubstituteInput(raw: unknown) {
  const source = (raw ?? {}) as Record<string, unknown>;
  const absentStaffMemberId = String(source.absentStaffMemberId ?? "").trim();
  const substituteStaffMemberId = String(source.substituteStaffMemberId ?? "").trim() || null;
  const reason = String(source.reason ?? "MANUAL").trim().toUpperCase();
  const priority = String(source.priority ?? "NORMAL").trim().toUpperCase();
  if (!absentStaffMemberId) throw new Error("Choose the absent staff member");
  if (substituteStaffMemberId === absentStaffMemberId) throw new Error("Absent staff and substitute staff must be different people");
  if (!(SUBSTITUTE_REASONS as readonly string[]).includes(reason)) throw new Error("Choose a valid substitute reason");
  if (!(SUBSTITUTE_PRIORITIES as readonly string[]).includes(priority)) throw new Error("Choose a valid priority");
  const periodStartTime = optionalTime(source.periodStartTime, "Period start time");
  const periodEndTime = optionalTime(source.periodEndTime, "Period end time");
  if (periodStartTime && periodEndTime && periodEndTime <= periodStartTime) throw new Error("Period end time must be after the start time");
  const timetableAssignmentId = String(source.timetableAssignmentId ?? "").trim() || null;
  const className = String(source.className ?? "").trim() || null;
  const subject = String(source.subject ?? "").trim() || null;
  const periodLabel = String(source.periodLabel ?? "").trim() || null;
  if (!className) throw new Error("Enter the class for this substitute duty");
  if (!subject) throw new Error("Enter the subject for this substitute duty");
  if (!periodLabel && !(periodStartTime && periodEndTime)) throw new Error("Enter a period label or both period start and end times");
  return {
    assignmentDate: substituteDate(source.assignmentDate),
    academicYear: String(source.academicYear ?? "").trim() || null,
    leaveRequestId: String(source.leaveRequestId ?? "").trim() || null,
    absentStaffMemberId,
    substituteStaffMemberId,
    timetableAssignmentId,
    className,
    section: String(source.section ?? "").trim() || null,
    subject,
    periodLabel,
    periodStartTime,
    periodEndTime,
    reason,
    priority,
    notes: String(source.notes ?? "").trim() || null
  };
}

export function periodsConflict(a: { periodLabel?: string | null; periodStartTime?: string | null; periodEndTime?: string | null }, b: { periodLabel?: string | null; periodStartTime?: string | null; periodEndTime?: string | null }) {
  if (a.periodStartTime && a.periodEndTime && b.periodStartTime && b.periodEndTime) return a.periodStartTime < b.periodEndTime && b.periodStartTime < a.periodEndTime;
  return Boolean(a.periodLabel && b.periodLabel && a.periodLabel.trim().toLowerCase() === b.periodLabel.trim().toLowerCase());
}

export const substituteInclude = {
  absentStaffMember: { select: { id: true, staffCode: true, fullName: true, displayName: true, designation: true, department: true, primarySubject: true } },
  substituteStaffMember: { select: { id: true, staffCode: true, fullName: true, displayName: true, designation: true, department: true, primarySubject: true, userId: true } },
  leaveRequest: { select: { id: true, startDate: true, endDate: true, status: true, substituteRequired: true } },
  timetableAssignment: { include: { classSection: true, subject: true, teacher: true } },
  assignedBy: { select: { name: true } }, confirmedBy: { select: { name: true } }, completedBy: { select: { name: true } }, cancelledBy: { select: { name: true } }
} as const;

export function substituteWhere(filters: { date?: string | null; status?: string | null; absentStaffMemberId?: string | null; substituteStaffMemberId?: string | null; className?: string | null; section?: string | null; ownSubstituteStaffMemberId?: string | null }) {
  const where: Prisma.SubstituteAssignmentWhereInput = {};
  if (filters.ownSubstituteStaffMemberId) where.substituteStaffMemberId = filters.ownSubstituteStaffMemberId;
  if (filters.date) where.assignmentDate = substituteDate(filters.date);
  if (filters.status && (SUBSTITUTE_STATUSES as readonly string[]).includes(filters.status)) where.status = filters.status;
  if (filters.absentStaffMemberId) where.absentStaffMemberId = filters.absentStaffMemberId;
  if (!filters.ownSubstituteStaffMemberId && filters.substituteStaffMemberId) where.substituteStaffMemberId = filters.substituteStaffMemberId;
  if (filters.className) where.className = filters.className;
  if (filters.section) where.section = filters.section;
  return where;
}

export async function validateSubstituteLinks(client: SubstituteClient, input: ReturnType<typeof validateSubstituteInput>, options: { requireSubstitute?: boolean; excludeId?: string } = {}) {
  const [absent, substitute, leave] = await Promise.all([
    client.staffMember.findUnique({ where: { id: input.absentStaffMemberId }, select: { id: true, status: true, timetableTeacherId: true } }),
    input.substituteStaffMemberId ? client.staffMember.findUnique({ where: { id: input.substituteStaffMemberId }, select: { id: true, status: true } }) : null,
    input.leaveRequestId ? client.staffLeaveRequest.findUnique({ where: { id: input.leaveRequestId }, select: { id: true, staffMemberId: true, status: true, startDate: true, endDate: true } }) : null
  ]);
  if (!absent || absent.status !== "ACTIVE") throw new Error("Choose an active absent staff member");
  if (input.timetableAssignmentId) {
    const timetable = await client.timetableAssignment.findUnique({ where: { id: input.timetableAssignmentId }, include: { teacher: true, subject: true, classSection: true } });
    if (!timetable || timetable.academicYear !== input.academicYear || timetable.teacherId !== absent.timetableTeacherId || !timetable.teacher.isActive || !timetable.subject.isActive || !timetable.classSection.isActive || timetable.classSection.academicYear !== input.academicYear || timetable.classSection.className !== input.className || timetable.classSection.section !== (input.section ?? "") || timetable.subject.name !== input.subject) throw new Error("Choose the active timetable assignment for this absent teacher, year, class, section and subject");
  }
  if (input.leaveRequestId && (!leave || leave.status !== "APPROVED" || leave.staffMemberId !== input.absentStaffMemberId || leave.startDate > input.assignmentDate || leave.endDate < input.assignmentDate)) throw new Error("Choose an approved leave request for this absent staff member and date");
  if (options.requireSubstitute && !input.substituteStaffMemberId) throw new Error("Choose a substitute staff member before assigning");
  const duplicateCoverage = await client.substituteAssignment.findMany({ where: { id: options.excludeId ? { not: options.excludeId } : undefined, absentStaffMemberId: input.absentStaffMemberId, assignmentDate: input.assignmentDate, status: { not: "CANCELLED" } }, select: { periodLabel: true, periodStartTime: true, periodEndTime: true } });
  if (duplicateCoverage.some((row) => periodsConflict(input, row))) throw new Error("Coverage already exists for this absent staff member on the same date and period");
  if (!input.substituteStaffMemberId) return;
  if (!substitute || substitute.status !== "ACTIVE") throw new Error("Choose an active substitute staff member");
  const availability = validateSubstituteAvailability(input);
  const [leaveConflict, attendance, assignments] = await Promise.all([
    client.staffLeaveRequest.count({ where: { staffMemberId: input.substituteStaffMemberId, status: "APPROVED", startDate: { lte: input.assignmentDate }, endDate: { gte: input.assignmentDate } } }),
    client.staffAttendanceRecord.findFirst({ where: { staffMemberId: input.substituteStaffMemberId, session: { attendanceDate: input.assignmentDate }, status: { in: ["ABSENT", "ON_LEAVE"] } }, select: { status: true } }),
    client.substituteAssignment.findMany({ where: { id: options.excludeId ? { not: options.excludeId } : undefined, substituteStaffMemberId: input.substituteStaffMemberId, assignmentDate: input.assignmentDate, status: { not: "CANCELLED" } }, select: { periodLabel: true, periodStartTime: true, periodEndTime: true } })
  ]);
  if (leaveConflict) throw new Error("This substitute is on approved leave for the selected date");
  if (attendance) throw new Error(`This substitute is marked ${substituteLabel(attendance.status)} in staff attendance for the selected date`);
  if (assignments.some((row) => periodsConflict(input, row))) throw new Error("This substitute already has another duty at the same date and period");
  await assertNoRegularTimetableConflict(client, availability, input.substituteStaffMemberId);
}

type SubstituteAvailability = { assignmentDate: Date; academicYear?: string | null; periodLabel?: string | null; periodStartTime?: string | null; periodEndTime?: string | null };

/** Use the already-established April-March attendance year and half-open
 * period intervals; a blank or mismatched year is never a free-period proof. */
export function validateSubstituteAvailability(input: SubstituteAvailability) {
  const academicYear = String(input.academicYear ?? "").trim();
  if (!attendanceDateBelongsToAcademicYear(input.assignmentDate, academicYear)) throw new Error("Choose the academic year containing this assignment date");
  const periodStartTime = optionalTime(input.periodStartTime, "Period start time");
  const periodEndTime = optionalTime(input.periodEndTime, "Period end time");
  if (Boolean(periodStartTime) !== Boolean(periodEndTime)) throw new Error("Enter both period start and end times");
  if (periodStartTime && periodEndTime && periodEndTime <= periodStartTime) throw new Error("Period end time must be after the start time");
  const periodLabel = String(input.periodLabel ?? "").trim() || null;
  if (!periodLabel && !(periodStartTime && periodEndTime)) throw new Error("Enter a period label or both period start and end times");
  return { ...input, academicYear, periodLabel, periodStartTime, periodEndTime };
}

/** Shared by substitute assignment and the reverse timetable mutation guard.
 * Both callers execute this reader within the same Serializable transaction as
 * their write, so neither direction relies on a stale advisory preflight. */
export async function assertNoRegularTimetableConflict(client: SubstituteClient, input: SubstituteAvailability, staffMemberId: string) {
  const availability = validateSubstituteAvailability(input);
  const duties = await regularSubstituteDuties(client, availability, [staffMemberId]);
  if (duties.some((duty) => !duty.determined) || (duties.length && !(availability.periodStartTime && availability.periodEndTime))) throw new Error("Regular timetable availability cannot be verified: review the configured teaching period and provide both period times");
  if (duties.some((duty) => periodsConflict(availability, duty))) throw new Error("This substitute has a regular timetable duty at the same date and period");
}

/** Reads only the existing staff-to-timetable link and operational ACTIVE
 * entries. Workload assignments and unreviewed drafts are not booked periods.
 * The occupied entry kinds and Friday template group match timetable print /
 * free-period summaries. Missing or ambiguous timing is unavailable evidence. */
export async function regularSubstituteDuties(client: SubstituteClient, input: ReturnType<typeof validateSubstituteAvailability>, staffIds: string[]) {
  if (!staffIds.length) return [];
  const staff = await client.staffMember.findMany({ where: { id: { in: staffIds }, status: "ACTIVE", timetableTeacherId: { not: null } }, select: { id: true, timetableTeacherId: true } });
  const teacherIds = staff.flatMap((member) => member.timetableTeacherId ? [member.timetableTeacherId] : []);
  if (!teacherIds.length) return [];
  const dayOfWeek = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][input.assignmentDate.getUTCDay()];
  const entries = await client.timetableEntry.findMany({
    where: { academicYear: input.academicYear, dayOfWeek, teacherId: { in: teacherIds }, teacher: { isActive: true }, draft: { status: "ACTIVE", academicYear: input.academicYear }, classSection: { isActive: true, academicYear: input.academicYear }, entryType: { in: ["TEACHING", "FIXED", "ACTIVITY", "SUBSTITUTION"] }, OR: [{ subjectId: null }, { subject: { isActive: true } }] },
    select: { teacherId: true, periodNumber: true, label: true, classSection: { select: { groupName: true } } }
  });
  if (!entries.length) return [];
  const templates = await client.timetablePeriodTemplate.findMany({ where: { academicYear: input.academicYear, dayOfWeek, isTeachingPeriod: true, periodNumber: { in: entries.map((entry) => entry.periodNumber) } }, select: { groupName: true, periodNumber: true, label: true, startTime: true, endTime: true } });
  return entries.map((entry) => {
    const matching = templates.filter((template) => template.periodNumber === entry.periodNumber && template.groupName === (dayOfWeek === "FRIDAY" ? "FRIDAY" : entry.classSection.groupName));
    const template = matching.length === 1 ? matching[0] : null;
    const determined = Boolean(template && /^([01]\d|2[0-3]):[0-5]\d$/.test(template.startTime) && /^([01]\d|2[0-3]):[0-5]\d$/.test(template.endTime) && template.startTime < template.endTime);
    return { staffMemberId: staff.find((member) => member.timetableTeacherId === entry.teacherId)!.id, periodLabel: template?.label ?? entry.label ?? `Period ${entry.periodNumber}`, periodStartTime: determined ? template!.startTime : null, periodEndTime: determined ? template!.endTime : null, determined };
  });
}

export type SuggestionCandidate = { id: string; staffCode: string | null; fullName: string; displayName: string | null; designation: string; department: string | null; primarySubject: string | null; dutyCount: number; reasons: string[] };

export function rankSuggestionCandidates(candidates: SuggestionCandidate[], context: { subject?: string | null; department?: string | null }) {
  return [...candidates].sort((a, b) => {
    const aMatch = Number(Boolean(context.subject && a.primarySubject?.toLowerCase() === context.subject.toLowerCase())) * 2 + Number(Boolean(context.department && a.department?.toLowerCase() === context.department.toLowerCase()));
    const bMatch = Number(Boolean(context.subject && b.primarySubject?.toLowerCase() === context.subject.toLowerCase())) * 2 + Number(Boolean(context.department && b.department?.toLowerCase() === context.department.toLowerCase()));
    return bMatch - aMatch || a.dutyCount - b.dutyCount || a.fullName.localeCompare(b.fullName);
  });
}

export async function suggestSubstituteStaff(client: SubstituteClient, input: { assignmentDate: Date; academicYear?: string | null; absentStaffMemberId: string; subject?: string | null; department?: string | null; periodLabel?: string | null; periodStartTime?: string | null; periodEndTime?: string | null; excludeId?: string }) {
  const availability = validateSubstituteAvailability(input);
  const [staff, leaves, attendance, assignments] = await Promise.all([
    client.staffMember.findMany({ where: { status: "ACTIVE", id: { not: input.absentStaffMemberId } }, select: { id: true, staffCode: true, fullName: true, displayName: true, designation: true, department: true, primarySubject: true }, orderBy: { fullName: "asc" } }),
    client.staffLeaveRequest.findMany({ where: { status: "APPROVED", startDate: { lte: input.assignmentDate }, endDate: { gte: input.assignmentDate } }, select: { staffMemberId: true } }),
    client.staffAttendanceRecord.findMany({ where: { session: { attendanceDate: input.assignmentDate }, status: { in: ["ABSENT", "ON_LEAVE"] } }, select: { staffMemberId: true } }),
    client.substituteAssignment.findMany({ where: { id: input.excludeId ? { not: input.excludeId } : undefined, assignmentDate: input.assignmentDate, status: { not: "CANCELLED" }, substituteStaffMemberId: { not: null } }, select: { substituteStaffMemberId: true, periodLabel: true, periodStartTime: true, periodEndTime: true } })
  ]);
  const regularDuties = await regularSubstituteDuties(client, availability, staff.map((member) => member.id));
  const unavailable = new Set([...leaves.map((row) => row.staffMemberId), ...attendance.map((row) => row.staffMemberId)]);
  const dutyCount = new Map<string, number>();
  for (const row of assignments) if (row.substituteStaffMemberId) dutyCount.set(row.substituteStaffMemberId, (dutyCount.get(row.substituteStaffMemberId) ?? 0) + 1);
  const candidates = staff.filter((member) => !unavailable.has(member.id) && !assignments.some((row) => row.substituteStaffMemberId === member.id && periodsConflict(input, row)) && !regularDuties.some((duty) => duty.staffMemberId === member.id && (!duty.determined || !(availability.periodStartTime && availability.periodEndTime) || periodsConflict(availability, duty)))).map((member) => {
    const count = dutyCount.get(member.id) ?? 0; const reasons: string[] = [];
    if (input.subject && member.primarySubject?.toLowerCase() === input.subject.toLowerCase()) reasons.push(`Same subject: ${member.primarySubject}`);
    else if (input.department && member.department?.toLowerCase() === input.department.toLowerCase()) reasons.push(`Same department: ${member.department}`);
    reasons.push(count ? `${count} other substitute ${count === 1 ? "duty" : "duties"} that day` : "No other substitute duties that day");
    return { ...member, dutyCount: count, reasons };
  });
  return rankSuggestionCandidates(candidates, input).slice(0, 8);
}

export async function substituteReportData(client: PrismaClient, filters: { from: Date; to: Date }) {
  const assignments = await client.substituteAssignment.findMany({ where: { assignmentDate: { gte: filters.from, lte: filters.to } }, include: substituteInclude, orderBy: [{ assignmentDate: "desc" }, { periodStartTime: "asc" }] });
  const active = assignments.filter((row) => row.status !== "CANCELLED");
  const pending = active.filter((row) => !row.substituteStaffMemberId || row.status === "DRAFT");
  const bySubstitute = countByStaff(active.filter((row) => row.substituteStaffMemberId).map((row) => ({ id: row.substituteStaffMemberId!, name: row.substituteStaffMember!.displayName || row.substituteStaffMember!.fullName })));
  const byAbsent = countByStaff(active.map((row) => ({ id: row.absentStaffMemberId, name: row.absentStaffMember.displayName || row.absentStaffMember.fullName })));
  return { assignments, active, pending, bySubstitute, byAbsent };
}

function countByStaff(rows: Array<{ id: string; name: string }>) { const map = new Map<string, { id: string; name: string; count: number }>(); for (const row of rows) { const item = map.get(row.id) ?? { ...row, count: 0 }; item.count++; map.set(row.id, item); } return [...map.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)); }
function safeCsv(value: unknown) { const raw = String(value ?? ""); const safe = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; }
export function substituteReportCsv(rows: Array<{ assignmentDate: Date; className: string | null; section: string | null; subject: string | null; periodLabel: string | null; reason: string; priority: string; status: string; absentStaffMember: { staffCode: string | null; fullName: string }; substituteStaffMember: { staffCode: string | null; fullName: string } | null }>) { const header=["Date","Absent Staff Code","Absent Staff","Substitute Staff Code","Substitute Staff","Class","Section","Subject","Period","Reason","Priority","Status"]; return [header.map(safeCsv).join(","),...rows.map(row=>[row.assignmentDate.toISOString().slice(0,10),row.absentStaffMember.staffCode,row.absentStaffMember.fullName,row.substituteStaffMember?.staffCode,row.substituteStaffMember?.fullName,row.className,row.section,row.subject,row.periodLabel,row.reason,row.priority,row.status].map(safeCsv).join(","))].join("\n"); }
export function substituteLabel(value: string) { return value.toLowerCase().split("_").map((part)=>part.charAt(0).toUpperCase()+part.slice(1)).join(" "); }
export function friendlySubstituteError(error: unknown) { const message=error instanceof Error?error.message:"Unable to update substitute assignment"; if(message.includes("Foreign key constraint"))return "A selected staff, leave, timetable, or user link is no longer available."; return message; }
