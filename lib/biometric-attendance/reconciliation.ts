import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;
const INDIA_OFFSET_MS = 330 * 60_000;
const NON_WORKING_TYPES = new Set(["NON_WORKING_DAY", "VACATION_DAY", "EMERGENCY_CLOSURE"]);
const APPROVABLE_OUTCOMES = new Set(["PRESENT", "LATE", "EARLY_DEPARTURE", "LATE_AND_EARLY", "HALF_DAY", "ON_APPROVED_LEAVE", "NON_WORKING_DAY"]);
const MAX_RECONCILIATION_STAFF = 1_000;
const MAX_RECONCILIATION_PUNCHES = 10_000;

export async function reconcileBiometricAttendanceDate(value: unknown, actorUserId: string) {
  const attendanceDate = normalizedDay(value);
  const { start, end } = indiaDayBounds(attendanceDate);
  return prisma.$transaction(async (tx) => {
    const [mappings, punches, calendarDay, leaves, openGaps] = await Promise.all([
      tx.biometricStaffMapping.findMany({ where: { status: "ACTIVE", effectiveFrom: { lt: end }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }] }, include: { staffMember: true, device: true }, orderBy: { effectiveFrom: "desc" }, take: MAX_RECONCILIATION_STAFF + 1 }),
      tx.biometricRawPunch.findMany({ where: { punchTimestamp: { gte: start, lt: end }, staffMemberId: { not: null } }, include: { device: true }, orderBy: [{ punchTimestamp: "asc" }, { id: "asc" }], take: MAX_RECONCILIATION_PUNCHES + 1 }),
      tx.operationalCalendarDay.findFirst({ where: { dayDate: attendanceDate, scopeKey: "SCHOOL_WIDE", calendarVersion: { status: "PUBLISHED" } }, orderBy: { calendarVersion: { versionNumber: "desc" } } }),
      tx.staffLeaveRequest.findMany({ where: { status: "APPROVED", startDate: { lte: attendanceDate }, endDate: { gte: attendanceDate } }, take: MAX_RECONCILIATION_STAFF + 1 }),
      tx.biometricSequenceGap.findMany({ where: { status: "OPEN", device: { mappings: { some: { status: "ACTIVE" } } } }, select: { deviceId: true }, take: MAX_RECONCILIATION_STAFF + 1 })
    ]);
    if (mappings.length > MAX_RECONCILIATION_STAFF || leaves.length > MAX_RECONCILIATION_STAFF || openGaps.length > MAX_RECONCILIATION_STAFF || punches.length > MAX_RECONCILIATION_PUNCHES) throw new Error("BIOMETRIC_RECONCILIATION_WORK_LIMIT_EXCEEDED");
    const staff = new Map<string, { row: (typeof mappings)[number]["staffMember"]; campus: string; deviceIds: Set<string> }>();
    for (const mapping of mappings) {
      const current = staff.get(mapping.staffMemberId) ?? { row: mapping.staffMember, campus: mapping.device.campus, deviceIds: new Set<string>() };
      current.deviceIds.add(mapping.deviceId); staff.set(mapping.staffMemberId, current);
    }
    for (const punch of punches) if (punch.staffMemberId && !staff.has(punch.staffMemberId)) {
      const row = await tx.staffMember.findUnique({ where: { id: punch.staffMemberId } });
      if (row) staff.set(row.id, { row, campus: punch.device.campus, deviceIds: new Set([punch.deviceId]) });
    }
    const leaveByStaff = new Map(leaves.map((row) => [row.staffMemberId, row]));
    const gapDevices = new Set(openGaps.map((row) => row.deviceId));
    const prepared = [];
    for (const [staffMemberId, target] of staff) {
      if (target.row.status !== "ACTIVE") continue;
      const existing = await tx.biometricReconciliation.findUnique({ where: { staffMemberId_attendanceDate: { staffMemberId, attendanceDate } } });
      if (existing?.status === "APPROVED") { prepared.push(existing); continue; }
      const rows = punches.filter((row) => row.staffMemberId === staffMemberId);
      const policy = await tx.biometricAttendancePolicy.findFirst({ where: { campus: target.campus, status: "ACTIVE", effectiveFrom: { lte: attendanceDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: attendanceDate } }] }, orderBy: { effectiveFrom: "desc" } });
      const decision = decide({ punches: rows, policy, leave: leaveByStaff.get(staffMemberId) ?? null, calendarDay, deviceGap: [...target.deviceIds].some((id) => gapDevices.has(id)) });
      const data = {
        policyId: policy?.id ?? null, status: decision.status, outcome: decision.outcome, firstPunchId: decision.firstPunchId, lastPunchId: decision.lastPunchId, punchCount: rows.length,
        checkInTime: decision.checkInTime, checkOutTime: decision.checkOutTime, lateMinutes: decision.lateMinutes, earlyDepartureMinutes: decision.earlyDepartureMinutes, exceptionCode: decision.exceptionCode,
        leaveRequestId: leaveByStaff.get(staffMemberId)?.id ?? null, calendarDayId: calendarDay?.id ?? null, preparedByUserId: actorUserId, preparedAt: new Date()
      };
      let result;
      if (existing) {
        const changed = await tx.biometricReconciliation.updateMany({ where: { id: existing.id, version: existing.version, status: { not: "APPROVED" } }, data: { ...data, version: { increment: 1 } } });
        if (changed.count !== 1) throw new Error("BIOMETRIC_RECONCILIATION_CONCURRENT_TRANSITION");
        result = (await tx.biometricReconciliation.findUnique({ where: { id: existing.id } }))!;
      } else result = await tx.biometricReconciliation.create({ data: { staffMemberId, attendanceDate, ...data, version: 1 } });
      if (rows.length) await tx.biometricRawPunch.updateMany({ where: { id: { in: rows.map((row) => row.id) }, reconciliationStatus: { in: ["MAPPED_PENDING", "RECONCILED"] } }, data: { reconciliationStatus: "RECONCILED" } });
      await audit(tx, "RECONCILIATION", result.id, "RECONCILIATION_PREPARED", actorUserId, { outcome: result.outcome, punchCount: result.punchCount, exception: Boolean(result.exceptionCode) });
      prepared.push(result);
    }
    return { attendanceDate: dayText(attendanceDate), prepared: prepared.length, ready: prepared.filter((row) => row.status === "READY_FOR_APPROVAL").length, exceptions: prepared.filter((row) => row.status === "EXCEPTION").length };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export async function approveBiometricReconciliation(id: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.biometricReconciliation.findUnique({ where: { id }, include: { staffMember: true } });
    if (!row) throw new Error("BIOMETRIC_RECONCILIATION_NOT_FOUND");
    if (row.status !== "READY_FOR_APPROVAL" || !APPROVABLE_OUTCOMES.has(row.outcome)) throw new Error("BIOMETRIC_RECONCILIATION_REQUIRES_CORRECTION");
    if (!row.preparedByUserId || row.preparedByUserId === actorUserId) throw new Error("BIOMETRIC_RECONCILIATION_DUAL_CONTROL_REQUIRED");
    const approvalTime = new Date();
    const claimed = await tx.biometricReconciliation.updateMany({ where: { id, status: "READY_FOR_APPROVAL", version: row.version }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: approvalTime, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new Error("BIOMETRIC_RECONCILIATION_CONCURRENT_TRANSITION");
    const existingSession = await tx.staffAttendanceSession.findUnique({ where: { attendanceDate: row.attendanceDate } });
    if (existingSession?.status === "LOCKED") throw new Error("BIOMETRIC_ATTENDANCE_SESSION_LOCKED");
    const session = existingSession ?? await tx.staffAttendanceSession.create({ data: { attendanceDate: row.attendanceDate, status: "DRAFT", notes: "Biometric reconciliation prepared; payroll consequence is not enabled." } });
    const prior = await tx.staffAttendanceRecord.findUnique({ where: { sessionId_staffMemberId: { sessionId: session.id, staffMemberId: row.staffMemberId } } });
    if (prior && prior.source !== "BIOMETRIC") throw new Error("BIOMETRIC_MANUAL_ATTENDANCE_CONFLICT");
    const status = attendanceStatus(row.outcome);
    const record = prior
      ? await tx.staffAttendanceRecord.update({ where: { sessionId_staffMemberId: { sessionId: session.id, staffMemberId: row.staffMemberId } }, data: { status, checkInTime: row.checkInTime, checkOutTime: row.checkOutTime, lateMinutes: row.lateMinutes, remarks: `Approved biometric reconciliation ${row.publicKey}`, source: "BIOMETRIC" } })
      : await tx.staffAttendanceRecord.create({ data: { sessionId: session.id, staffMemberId: row.staffMemberId, staffCode: row.staffMember.staffCode, status, checkInTime: row.checkInTime, checkOutTime: row.checkOutTime, lateMinutes: row.lateMinutes, remarks: `Approved biometric reconciliation ${row.publicKey}`, source: "BIOMETRIC" } });
    const approved = await tx.biometricReconciliation.update({ where: { id }, data: { attendanceRecordId: record.id } });
    await audit(tx, "RECONCILIATION", id, "RECONCILIATION_APPROVED", actorUserId, { attendanceRecordId: record.id, payrollImpact: false });
    return approved;
  });
}

export async function requestBiometricCorrection(input: unknown, actorUserId: string, ownOnly = false) {
  const source = object(input), reconciliationId = identifier(source.reconciliationId, "Reconciliation"), reason = requiredText(source.reason, "Correction reason", 1_000);
  const requested = correctionAfter(source.after);
  return prisma.$transaction(async (tx) => {
    const row = await tx.biometricReconciliation.findUnique({ where: { id: reconciliationId }, include: { staffMember: true } });
    if (!row) throw new Error("BIOMETRIC_RECONCILIATION_NOT_FOUND");
    if (ownOnly && row.staffMember.userId !== actorUserId) throw new Error("BIOMETRIC_OWN_SCOPE_DENIED");
    const punches = await tx.biometricRawPunch.findMany({ where: { staffMemberId: row.staffMemberId, punchTimestamp: indiaDayBounds(row.attendanceDate).range }, select: { id: true, publicKey: true, punchTimestamp: true, punchCode: true, verificationMethod: true }, orderBy: { punchTimestamp: "asc" } });
    const before = { outcome: row.outcome, checkInTime: row.checkInTime, checkOutTime: row.checkOutTime, lateMinutes: row.lateMinutes, earlyDepartureMinutes: row.earlyDepartureMinutes, attendanceRecordId: row.attendanceRecordId };
    const correction = await tx.biometricCorrection.create({ data: { reconciliationId, requestedByUserId: actorUserId, preparedByUserId: ownOnly ? null : actorUserId, reason, originalEvidenceJson: JSON.stringify({ rawPunches: punches }), beforeJson: JSON.stringify(before), afterJson: JSON.stringify(requested) } });
    await audit(tx, "CORRECTION", correction.id, "CORRECTION_REQUEST_SUBMITTED", actorUserId, { ownRequest: ownOnly, rawPunchCount: punches.length });
    return correction;
  });
}

export async function decideBiometricCorrection(id: string, action: "APPROVE" | "REJECT", actorUserId: string, reason?: unknown) {
  return prisma.$transaction(async (tx) => {
    const correction = await tx.biometricCorrection.findUnique({ where: { id }, include: { reconciliation: { include: { staffMember: true } } } });
    if (!correction || correction.status !== "SUBMITTED") throw new Error("BIOMETRIC_CORRECTION_NOT_PENDING");
    if (correction.requestedByUserId === actorUserId || correction.preparedByUserId === actorUserId) throw new Error("BIOMETRIC_CORRECTION_DUAL_CONTROL_REQUIRED");
    if (action === "REJECT") {
      const explanation = requiredText(reason, "Rejection reason", 500);
      const changed = await tx.biometricCorrection.updateMany({ where: { id, status: "SUBMITTED", version: correction.version }, data: { status: "REJECTED", approvedByUserId: actorUserId, rejectedAt: new Date(), rejectionReason: explanation, version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error("BIOMETRIC_CORRECTION_CONCURRENT_TRANSITION");
      const rejected = (await tx.biometricCorrection.findUnique({ where: { id } }))!;
      await audit(tx, "CORRECTION", id, "CORRECTION_REJECTED", actorUserId);
      return rejected;
    }
    const approvalTime = new Date();
    const claimed = await tx.biometricCorrection.updateMany({ where: { id, status: "SUBMITTED", version: correction.version }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: approvalTime, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new Error("BIOMETRIC_CORRECTION_CONCURRENT_TRANSITION");
    const after = correctionAfter(JSON.parse(correction.afterJson));
    const row = correction.reconciliation;
    let attendanceRecordId = row.attendanceRecordId;
    if (attendanceRecordId) {
      const record = await tx.staffAttendanceRecord.findUnique({ where: { id: attendanceRecordId } });
      if (!record || record.source !== "BIOMETRIC") throw new Error("BIOMETRIC_CORRECTION_RECORD_CONFLICT");
      await tx.staffAttendanceRecord.update({ where: { id: attendanceRecordId }, data: { status: attendanceStatus(after.outcome), checkInTime: after.checkInTime, checkOutTime: after.checkOutTime, lateMinutes: after.lateMinutes, remarks: `Approved biometric correction ${correction.publicKey}`, source: "BIOMETRIC" } });
    } else {
      const session = await tx.staffAttendanceSession.upsert({ where: { attendanceDate: row.attendanceDate }, update: {}, create: { attendanceDate: row.attendanceDate, status: "DRAFT", notes: "Biometric correction approval; payroll consequence is not enabled." } });
      if (session.status === "LOCKED") throw new Error("BIOMETRIC_ATTENDANCE_SESSION_LOCKED");
      const existing = await tx.staffAttendanceRecord.findUnique({ where: { sessionId_staffMemberId: { sessionId: session.id, staffMemberId: row.staffMemberId } } });
      if (existing && existing.source !== "BIOMETRIC") throw new Error("BIOMETRIC_MANUAL_ATTENDANCE_CONFLICT");
      const record = existing
        ? await tx.staffAttendanceRecord.update({ where: { id: existing.id }, data: { status: attendanceStatus(after.outcome), checkInTime: after.checkInTime, checkOutTime: after.checkOutTime, lateMinutes: after.lateMinutes, remarks: `Approved biometric correction ${correction.publicKey}`, source: "BIOMETRIC" } })
        : await tx.staffAttendanceRecord.create({ data: { sessionId: session.id, staffMemberId: row.staffMemberId, staffCode: row.staffMember.staffCode, status: attendanceStatus(after.outcome), checkInTime: after.checkInTime, checkOutTime: after.checkOutTime, lateMinutes: after.lateMinutes, remarks: `Approved biometric correction ${correction.publicKey}`, source: "BIOMETRIC" } });
      attendanceRecordId = record.id;
    }
    await tx.biometricReconciliation.update({ where: { id: row.id }, data: { status: "APPROVED", outcome: after.outcome, checkInTime: after.checkInTime, checkOutTime: after.checkOutTime, lateMinutes: after.lateMinutes, earlyDepartureMinutes: after.earlyDepartureMinutes, exceptionCode: null, attendanceRecordId, approvedByUserId: actorUserId, approvedAt: new Date(), version: { increment: 1 } } });
    const approved = (await tx.biometricCorrection.findUnique({ where: { id } }))!;
    await audit(tx, "CORRECTION", id, "CORRECTION_APPROVED", actorUserId, { attendanceRecordId: attendanceRecordId!, payrollImpact: false });
    return approved;
  });
}

export async function loadOwnBiometricAttendance(userId: string, fromValue?: unknown, toValue?: unknown) {
  const staff = await prisma.staffMember.findUnique({ where: { userId }, select: { id: true, staffCode: true, fullName: true, designation: true } });
  if (!staff) throw new Error("BIOMETRIC_STAFF_LINK_REQUIRED");
  const today = normalizedDay(new Date()), from = fromValue ? normalizedDay(fromValue) : new Date(today.getTime() - 31 * 86_400_000), to = toValue ? normalizedDay(toValue) : today;
  if (to < from || (to.getTime() - from.getTime()) / 86_400_000 > 366) throw new Error("BIOMETRIC_REPORT_RANGE_INVALID");
  const reconciliations = await prisma.biometricReconciliation.findMany({ where: { staffMemberId: staff.id, attendanceDate: { gte: from, lte: to } }, include: { corrections: { orderBy: { submittedAt: "desc" } } }, orderBy: { attendanceDate: "desc" }, take: 400 });
  return { staff, from: dayText(from), to: dayText(to), reconciliations };
}

export async function biometricReportRows(fromValue: unknown, toValue: unknown) {
  const from = normalizedDay(fromValue), to = normalizedDay(toValue);
  if (to < from || (to.getTime() - from.getTime()) / 86_400_000 > 366) throw new Error("BIOMETRIC_REPORT_RANGE_INVALID");
  return prisma.biometricReconciliation.findMany({ where: { attendanceDate: { gte: from, lte: to } }, include: { staffMember: { select: { staffCode: true, fullName: true, designation: true } } }, orderBy: [{ attendanceDate: "asc" }, { staffMember: { fullName: "asc" } }], take: 10_000 });
}

export function biometricReportCsv(rows: Awaited<ReturnType<typeof biometricReportRows>>) {
  const header = ["Date", "Staff Code", "Staff Name", "Designation", "Outcome", "Check In", "Check Out", "Late Minutes", "Early Departure Minutes", "Punch Count", "Reconciliation Status", "Exception"];
  return [header.map(formulaSafeCsv).join(","), ...rows.map((row) => [dayText(row.attendanceDate), row.staffMember.staffCode, row.staffMember.fullName, row.staffMember.designation, row.outcome, row.checkInTime, row.checkOutTime, row.lateMinutes, row.earlyDepartureMinutes, row.punchCount, row.status, row.exceptionCode].map(formulaSafeCsv).join(","))].join("\n");
}

function decide(input: { punches: Array<{ id: string; punchTimestamp: Date; punchCode: string; clockDriftStatus: string }>; policy: { id: string; shiftStartTime: string; shiftEndTime: string; shiftType: string; graceMinutes: number; lateThresholdMinutes: number; earlyDepartureGraceMinutes: number; earlyDepartureThresholdMinutes: number; fullDayThresholdMinutes: number; halfDayThresholdMinutes: number; halfDayRule: string; missingInBehavior: string; missingOutBehavior: string; multiplePunchStrategy: string; leaveInteraction: string; holidayInteraction: string; overnightShiftEnabled: boolean; splitShiftEnabled: boolean } | null; leave: { id: string; leaveType: string; halfDaySession: string | null } | null; calendarDay: { id: string; dayType: string } | null; deviceGap: boolean }) {
  const firstIn = input.punches.find((row) => row.punchCode === "IN") ?? null;
  const lastOut = [...input.punches].reverse().find((row) => row.punchCode === "OUT") ?? null;
  const base = { firstPunchId: firstIn?.id ?? input.punches[0]?.id ?? null, lastPunchId: lastOut?.id ?? input.punches.at(-1)?.id ?? null, checkInTime: firstIn ? indiaTime(firstIn.punchTimestamp) : null, checkOutTime: lastOut ? indiaTime(lastOut.punchTimestamp) : null, lateMinutes: null as number | null, earlyDepartureMinutes: null as number | null };
  if (input.deviceGap) return { ...base, status: "EXCEPTION", outcome: "EXCEPTION", exceptionCode: "SEQUENCE_GAP_OPEN" };
  if (input.punches.some((row) => row.clockDriftStatus === "UNTRUSTED_TIME")) return { ...base, status: "EXCEPTION", outcome: "DEVICE_TIME_UNTRUSTED", exceptionCode: "DEVICE_TIME_UNTRUSTED" };
  if (input.leave && input.punches.length) return { ...base, status: "EXCEPTION", outcome: "ON_APPROVED_LEAVE", exceptionCode: "PUNCH_ON_APPROVED_LEAVE" };
  if (input.leave) return { ...base, status: "READY_FOR_APPROVAL", outcome: input.leave.leaveType === "HALF_DAY" ? "HALF_DAY" : "ON_APPROVED_LEAVE", exceptionCode: null };
  if (input.calendarDay && NON_WORKING_TYPES.has(input.calendarDay.dayType)) return { ...base, status: input.punches.length ? "EXCEPTION" : "READY_FOR_APPROVAL", outcome: input.punches.length ? "HOLIDAY_PUNCH" : "NON_WORKING_DAY", exceptionCode: input.punches.length ? "PUNCH_ON_NON_WORKING_DAY" : null };
  if (!input.policy) return { ...base, status: "EXCEPTION", outcome: "DEVICE_EXCEPTION", exceptionCode: "ATTENDANCE_POLICY_MISSING" };
  if (input.policy.overnightShiftEnabled || input.policy.splitShiftEnabled || input.policy.shiftType !== "DAY") return { ...base, status: "EXCEPTION", outcome: "EXCEPTION", exceptionCode: "COMPLEX_SHIFT_NOT_CONFIGURED" };
  if (!input.punches.length) return { ...base, status: "EXCEPTION", outcome: "ABSENT_PENDING_REVIEW", exceptionCode: "NO_VALID_PUNCH" };
  if (!firstIn) return { ...base, status: "EXCEPTION", outcome: "MISSING_IN", exceptionCode: "MISSING_IN" };
  if (!lastOut || lastOut.punchTimestamp <= firstIn.punchTimestamp) return { ...base, status: "EXCEPTION", outcome: "MISSING_OUT", exceptionCode: "MISSING_OUT" };
  const workedMinutes = Math.floor((lastOut.punchTimestamp.getTime() - firstIn.punchTimestamp.getTime()) / 60_000);
  const checkIn = minuteOfIndiaDay(firstIn.punchTimestamp), checkOut = minuteOfIndiaDay(lastOut.punchTimestamp), shiftStart = hhmm(input.policy.shiftStartTime), shiftEnd = hhmm(input.policy.shiftEndTime);
  const lateMinutes = Math.max(0, checkIn - shiftStart - input.policy.graceMinutes - input.policy.lateThresholdMinutes), earlyDepartureMinutes = Math.max(0, shiftEnd - checkOut - input.policy.earlyDepartureGraceMinutes - input.policy.earlyDepartureThresholdMinutes);
  if (input.punches.length > 2) return { ...base, status: "EXCEPTION", outcome: "MULTIPLE_PUNCHES", lateMinutes, earlyDepartureMinutes, exceptionCode: "MULTIPLE_PUNCHES_REQUIRE_REVIEW" };
  if (input.calendarDay?.dayType === "HALF_DAY" || workedMinutes < input.policy.fullDayThresholdMinutes || workedMinutes < input.policy.halfDayThresholdMinutes) return { ...base, status: "READY_FOR_APPROVAL", outcome: "HALF_DAY", lateMinutes, earlyDepartureMinutes, exceptionCode: null };
  const outcome = lateMinutes && earlyDepartureMinutes ? "LATE_AND_EARLY" : lateMinutes ? "LATE" : earlyDepartureMinutes ? "EARLY_DEPARTURE" : "PRESENT";
  return { ...base, status: "READY_FOR_APPROVAL", outcome, lateMinutes, earlyDepartureMinutes, exceptionCode: null };
}

function correctionAfter(value: unknown) { const source = object(value); const outcome = String(source.outcome ?? "").trim().toUpperCase(); if (!APPROVABLE_OUTCOMES.has(outcome)) throw new Error("BIOMETRIC_CORRECTION_OUTCOME_INVALID"); const checkInTime = optionalTime(source.checkInTime), checkOutTime = optionalTime(source.checkOutTime); return { outcome, checkInTime, checkOutTime, lateMinutes: optionalMinutes(source.lateMinutes), earlyDepartureMinutes: optionalMinutes(source.earlyDepartureMinutes) }; }
function attendanceStatus(outcome: string) { if (outcome === "LATE" || outcome === "LATE_AND_EARLY") return "LATE"; if (outcome === "HALF_DAY") return "HALF_DAY"; if (outcome === "ON_APPROVED_LEAVE") return "ON_LEAVE"; if (outcome === "NON_WORKING_DAY") return "EXCUSED"; return "PRESENT"; }
function normalizedDay(value: unknown) { const source = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) throw new Error("BIOMETRIC_ATTENDANCE_DATE_INVALID"); const result = new Date(`${source}T00:00:00.000Z`); if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== source) throw new Error("BIOMETRIC_ATTENDANCE_DATE_INVALID"); return result; }
function indiaDayBounds(day: Date) { const start = new Date(day.getTime() - INDIA_OFFSET_MS), end = new Date(start.getTime() + 86_400_000); return { start, end, range: { gte: start, lt: end } }; }
function dayText(value: Date) { return value.toISOString().slice(0, 10); }
function indiaTime(value: Date) { return new Date(value.getTime() + INDIA_OFFSET_MS).toISOString().slice(11, 16); }
function minuteOfIndiaDay(value: Date) { const shifted = new Date(value.getTime() + INDIA_OFFSET_MS); return shifted.getUTCHours() * 60 + shifted.getUTCMinutes(); }
function hhmm(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function object(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("BIOMETRIC_INPUT_INVALID"); return value as Record<string, unknown>; }
function identifier(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9_-]{8,160}$/.test(result)) throw new Error(`${label} is invalid`); return result; }
function requiredText(value: unknown, label: string, max: number) { const result = String(value ?? "").trim(); if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new Error(`${label} is invalid`); return result; }
function optionalTime(value: unknown) { const result = String(value ?? "").trim(); if (!result) return null; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) throw new Error("BIOMETRIC_CORRECTION_TIME_INVALID"); return result; }
function optionalMinutes(value: unknown) { if (value == null || String(value).trim() === "") return null; const result = Number(value); if (!Number.isInteger(result) || result < 0 || result > 1_440) throw new Error("BIOMETRIC_CORRECTION_MINUTES_INVALID"); return result; }
function formulaSafeCsv(value: unknown) { const raw = String(value ?? ""), safe = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; }
async function audit(client: Db, entityType: string, entityId: string, eventType: string, actorUserId: string, safeMetadata?: Record<string, string | number | boolean | null>) { return client.biometricAuditEvent.create({ data: { entityType, entityId, eventType, actorUserId, safeMetadataJson: safeMetadata ? JSON.stringify(safeMetadata) : null } }); }
