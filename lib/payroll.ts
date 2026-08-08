import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { requireCriticalReauthentication, type IamActor } from "@/lib/iam/security";
import { getSchoolSettings } from "@/lib/school-settings";
import {
  PAYROLL_CALCULATION_RULES,
  PAYROLL_COMPONENT_CLASSIFICATIONS,
  PAYROLL_COMPONENT_MODES,
  PAYROLL_PRORATION_RULES,
  PAYROLL_ROUNDING_RULES,
  PayrollCalculationError,
  calculateEmployeePayroll,
  payrollDate,
  payrollMoney,
  validateComponent,
  type ApprovedManualAdjustment,
  type PayrollComponentInput
} from "@/lib/payroll-calculation";

export const PAYROLL_RUN_STATUSES = ["DRAFT", "INPUTS_INCOMPLETE", "CALCULATED", "UNDER_REVIEW", "APPROVED", "LOCKED", "PAYSLIPS_ISSUED", "REVERSED", "ARCHIVED"] as const;
export const PAYROLL_ADVANCE_STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED", "RECOVERY_COMPLETE"] as const;
export const PAYROLL_PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" };
const MAX_COMPONENTS = 40;
const MAX_ADJUSTMENTS = 100;
const MAX_RECOVERY_ROWS = 48;

type PayrollDb = PrismaClient | Prisma.TransactionClient;
export type PayrollActor = IamActor;

export class PayrollError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "PAYROLL_INVALID") { super(message); }
}

export async function loadPayrollWorkspace(client: PrismaClient, options: { ownUserId?: string | null; aggregateOnly?: boolean } = {}) {
  if (options.aggregateOnly) return payrollReports(client, { aggregateOnly: true });
  const ownStaff = options.ownUserId ? await linkedPayrollStaff(client, options.ownUserId) : null;
  if (options.ownUserId && !ownStaff) return { mode: "OWN", linked: false, message: "No active Staff profile is linked to this account.", structures: [], revisions: [], results: [], payslips: [], advances: [], attendance: [], leave: [] };
  if (ownStaff) return loadEmployeeSelfService(client, ownStaff.id);
  const [policies, structures, staff, assignments, revisions, periods, runs, advances] = await Promise.all([
    client.payrollPolicyVersion.findMany({ orderBy: [{ policyCode: "asc" }, { versionNumber: "desc" }] }),
    client.salaryStructureVersion.findMany({ include: { components: { orderBy: { displayOrder: "asc" } } }, orderBy: [{ structureCode: "asc" }, { versionNumber: "desc" }] }),
    client.staffMember.findMany({ where: { status: { in: ["ACTIVE", "INACTIVE"] } }, select: { iamPublicKey: true, staffCode: true, fullName: true, displayName: true, designation: true, department: true, status: true, dateOfJoining: true, userId: true }, orderBy: { fullName: "asc" }, take: 500 }),
    client.staffCompensationAssignment.findMany({ include: { staffMember: { select: { iamPublicKey: true, staffCode: true, fullName: true, designation: true, department: true } }, structureVersion: { select: { publicKey: true, structureCode: true, versionNumber: true, name: true, estimatedGrossPaise: true } } }, orderBy: [{ effectiveFrom: "desc" }], take: 500 }),
    client.salaryRevision.findMany({ include: { staffMember: { select: { iamPublicKey: true, staffCode: true, fullName: true, designation: true } }, newAssignment: { include: { structureVersion: { select: { publicKey: true, structureCode: true, versionNumber: true, name: true } } } } }, orderBy: { effectiveDate: "desc" }, take: 500 }),
    client.payrollPeriod.findMany({ orderBy: { startDate: "desc" }, take: 60 }),
    client.payrollRun.findMany({ include: { period: true, employeeResults: { include: { staffMember: { select: { iamPublicKey: true, fullName: true, designation: true, department: true } }, componentResults: { orderBy: { displayOrder: "asc" } }, payslips: true } }, sourceRun: { select: { publicKey: true, runNumber: true, status: true } } }, orderBy: { createdAt: "desc" }, take: 60 }),
    client.salaryAdvance.findMany({ include: { staffMember: { select: { iamPublicKey: true, staffCode: true, fullName: true, designation: true } }, recoverySchedule: { include: { payrollPeriod: { select: { publicKey: true, periodCode: true, payrollMonth: true } } }, orderBy: { sequenceNumber: "asc" } } }, orderBy: { createdAt: "desc" }, take: 500 })
  ]);
  return {
    mode: "ADMIN",
    financeBoundary: financePostingBoundary(),
    policies: policies.map(publicPolicy),
    structures: structures.map(publicStructure),
    staff: staff.map((row) => ({ key: row.iamPublicKey, code: row.staffCode, name: row.displayName || row.fullName, designation: row.designation, department: row.department, status: row.status, joiningDate: dateText(row.dateOfJoining), linkedAccount: Boolean(row.userId) })),
    assignments: assignments.map(publicAssignment),
    revisions: revisions.map(publicRevision),
    periods: periods.map(publicPeriod),
    runs: runs.map(publicRun),
    advances: advances.map(publicAdvance)
  };
}

export async function createSalaryStructureVersion(client: PrismaClient, raw: Record<string, unknown>, actor: PayrollActor) {
  await requireCriticalReauthentication(client, actor, String(raw.reauthPassword ?? ""));
  const policyCode = identifier(raw.policyCode, "Policy code");
  const structureCode = identifier(raw.structureCode, "Structure code");
  const name = text(raw.name, "Structure name", 2, 100);
  const effectiveFrom = inputDate(raw.effectiveFrom, "Effective from");
  const approvalReference = text(raw.approvalReference, "Approval reference", 3, 200);
  const halfDayRule = oneOf(raw.halfDayRule, ["NOT_CONFIGURED", "HALF_DAY_AS_0_5"], "Half-day rule");
  const componentsRaw = array(raw.components, "Salary components", MAX_COMPONENTS);
  if (!componentsRaw.length) throw new PayrollError("At least one governed salary component is required.");
  const components = componentsRaw.map((value, index) => {
    const source = record(value, `Salary component ${index + 1}`);
    try {
      return validateComponent({
        componentCode: String(source.componentCode ?? ""), name: String(source.name ?? ""),
        classification: String(source.classification ?? "") as PayrollComponentInput["classification"],
        calculationMode: String(source.calculationMode ?? "") as PayrollComponentInput["calculationMode"],
        calculationRule: normalizeCalculationRule(source.calculationRule),
        defaultAmountPaise: moneyInput(source.defaultAmount, true),
        percentageBasisPoints: source.percentageBasisPoints != null && source.percentageBasisPoints !== ""
          ? integer(source.percentageBasisPoints, "Percentage basis points", 0, 100_000)
          : source.percentage != null && source.percentage !== "" ? Math.round(Number(source.percentage) * 100) : null,
        percentageBaseCode: source.percentageBaseCode ? String(source.percentageBaseCode) : null,
        prorationRule: normalizeProrationRule(source.prorationRule),
        roundingRule: String(source.roundingRule ?? "NEAREST_PAISE") as PayrollComponentInput["roundingRule"],
        statutoryTreatment: String(source.statutoryTreatment ?? "NOT_STATUTORY") as PayrollComponentInput["statutoryTreatment"],
        payslipVisible: source.payslipVisible !== false,
        displayOrder: index + 1,
        versionNumber: 1
      });
    } catch (error) { throw mapCalculationError(error); }
  });
  const estimatedGrossPaise = components.filter((row) => row.classification === "EARNING" && row.calculationMode === "FIXED").reduce((sum, row) => sum + Number(row.defaultAmountPaise ?? 0), 0);
  return client.$transaction(async (tx) => {
    const [latestPolicy, latestStructure] = await Promise.all([
      tx.payrollPolicyVersion.findFirst({ where: { policyCode }, orderBy: { versionNumber: "desc" } }),
      tx.salaryStructureVersion.findFirst({ where: { structureCode }, orderBy: { versionNumber: "desc" } })
    ]);
    const now = new Date();
    const policy = await tx.payrollPolicyVersion.create({ data: { policyCode, versionNumber: (latestPolicy?.versionNumber ?? 0) + 1, name: `${name} payroll policy`, status: "ACTIVE", effectiveFrom, prorationBasis: "CALENDAR_DAYS", unpaidLeaveRule: "APPROVED_UNPAID_LEAVE_ONLY", halfDayRule, defaultRoundingRule: "NEAREST_PAISE", requiredAttendanceRule: "EXPLICIT_REQUIRED_DATES", approvalReference, approvedByUserId: actor.user.id, approvedAt: now, lockedAt: now } });
    const structure = await tx.salaryStructureVersion.create({ data: { structureCode, versionNumber: (latestStructure?.versionNumber ?? 0) + 1, name, description: optionalText(raw.description, 500), status: "ACTIVE", policyVersionId: policy.id, effectiveFrom, approvalReference, approvedByUserId: actor.user.id, approvedAt: now, lockedAt: now, estimatedGrossPaise, components: { create: components.map((component) => ({ componentCode: component.componentCode, name: component.name, classification: component.classification, calculationMode: component.calculationMode, calculationRule: component.calculationRule, defaultAmountPaise: component.defaultAmountPaise, percentageBasisPoints: component.percentageBasisPoints, percentageBaseCode: component.percentageBaseCode, prorationRule: component.prorationRule, roundingRule: component.roundingRule, statutoryTreatment: component.statutoryTreatment, payslipVisible: component.payslipVisible, accountingBehavior: "PREVIEW_ONLY", exportBehavior: "ALLOWLISTED_SUMMARY", displayOrder: component.displayOrder, effectiveFrom, versionNumber: 1 })) } }, include: { components: { orderBy: { displayOrder: "asc" } } } });
    await payrollEvent(tx, actor, { entityType: "SALARY_STRUCTURE", entityPublicKey: structure.publicKey, eventType: "STRUCTURE_VERSION_APPROVED", newStatus: "ACTIVE", entityVersion: structure.version, reason: approvalReference, safeSnapshot: { structureCode, versionNumber: structure.versionNumber, componentCodes: components.map((row) => row.componentCode), financePosting: "PREVIEW_ONLY" } });
    return publicStructure(structure);
  }, transactionOptions);
}

export async function assignCompensation(client: PrismaClient, raw: Record<string, unknown>, actor: PayrollActor) {
  await requireCriticalReauthentication(client, actor, String(raw.reauthPassword ?? ""));
  const staffKey = uuid(raw.staffKey, "Staff reference"), structureKey = uuid(raw.structureKey, "Salary structure reference");
  const effectiveFrom = inputDate(raw.effectiveFrom, "Effective start date"), payrollEligibleFrom = inputDate(raw.payrollEligibleFrom ?? raw.effectiveFrom, "Payroll eligibility start");
  const reason = text(raw.reason, "Assignment reason", 3, 500);
  return client.$transaction(async (tx) => {
    const [staff, structure] = await Promise.all([tx.staffMember.findUnique({ where: { iamPublicKey: staffKey } }), tx.salaryStructureVersion.findUnique({ where: { publicKey: structureKey } })]);
    if (!staff || !["ACTIVE", "INACTIVE"].includes(staff.status)) throw new PayrollError("The Staff record is unavailable for payroll.", 404);
    if (!structure || structure.status !== "ACTIVE" || structure.effectiveFrom > effectiveFrom || (structure.effectiveTo && structure.effectiveTo < effectiveFrom)) throw new PayrollError("Choose an active salary structure version effective on the assignment date.");
    const overlap = await tx.staffCompensationAssignment.count({ where: { staffMemberId: staff.id, status: { in: ["ACTIVE", "FUTURE"] }, effectiveFrom: { lte: effectiveFrom }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }] } });
    if (overlap) throw new PayrollError("An overlapping compensation assignment already exists.", 409, "COMPENSATION_OVERLAP");
    const assignment = await tx.staffCompensationAssignment.create({ data: { staffMemberId: staff.id, structureVersionId: structure.id, effectiveFrom, payrollEligibleFrom, status: effectiveFrom > new Date() ? "FUTURE" : "ACTIVE", reason, approvedByUserId: actor.user.id, approvedAt: new Date() }, include: { staffMember: true, structureVersion: true } });
    await payrollEvent(tx, actor, { entityType: "COMPENSATION_ASSIGNMENT", entityPublicKey: assignment.publicKey, eventType: "COMPENSATION_ASSIGNED", newStatus: assignment.status, entityVersion: assignment.version, reason, safeSnapshot: { staffReference: staff.iamPublicKey, structureReference: structure.publicKey, effectiveFrom: dateText(effectiveFrom) } });
    return publicAssignment(assignment);
  }, transactionOptions);
}

export async function reviseCompensation(client: PrismaClient, raw: Record<string, unknown>, actor: PayrollActor) {
  await requireCriticalReauthentication(client, actor, String(raw.reauthPassword ?? ""));
  const assignmentKey = uuid(raw.assignmentKey, "Current assignment reference"), structureKey = uuid(raw.structureKey, "New structure reference");
  const effectiveDate = inputDate(raw.effectiveDate, "Revision effective date");
  if (effectiveDate.getUTCDate() !== 1) throw new PayrollError("Salary revisions must start on the first day of a payroll month so prior periods remain deterministic.");
  const reason = text(raw.reason, "Revision reason", 3, 500);
  return client.$transaction(async (tx) => {
    const [previous, structure] = await Promise.all([tx.staffCompensationAssignment.findUnique({ where: { publicKey: assignmentKey }, include: { structureVersion: true, staffMember: true } }), tx.salaryStructureVersion.findUnique({ where: { publicKey: structureKey } })]);
    if (!previous || !["ACTIVE", "FUTURE"].includes(previous.status)) throw new PayrollError("The current compensation assignment is unavailable.", 404);
    if (!structure || structure.status !== "ACTIVE" || structure.effectiveFrom > effectiveDate) throw new PayrollError("The new salary structure is not effective for this revision.");
    const priorDay = new Date(effectiveDate.getTime() - 86_400_000);
    const changed = await tx.staffCompensationAssignment.updateMany({ where: { id: previous.id, version: expectedVersion(raw.expectedVersion), status: previous.status }, data: { effectiveTo: priorDay, payrollEligibleTo: priorDay, status: "ENDED", endReason: `Superseded by approved revision: ${reason}`, version: { increment: 1 } } });
    if (changed.count !== 1) throw new PayrollError("The compensation assignment changed; refresh and try again.", 409, "EXPECTED_VERSION_CONFLICT");
    const next = await tx.staffCompensationAssignment.create({ data: { staffMemberId: previous.staffMemberId, structureVersionId: structure.id, effectiveFrom: effectiveDate, payrollEligibleFrom: effectiveDate, status: effectiveDate > new Date() ? "FUTURE" : "ACTIVE", reason, approvedByUserId: actor.user.id, approvedAt: new Date() } });
    const revision = await tx.salaryRevision.create({ data: { staffMemberId: previous.staffMemberId, previousAssignmentId: previous.id, newAssignmentId: next.id, effectiveDate, status: effectiveDate > new Date() ? "SCHEDULED" : "APPLIED", oldGrossPaise: previous.structureVersion.estimatedGrossPaise, newGrossPaise: structure.estimatedGrossPaise, reason, approverUserId: actor.user.id, approvedAt: new Date() }, include: { staffMember: true, newAssignment: { include: { structureVersion: true } } } });
    await payrollEvent(tx, actor, { entityType: "SALARY_REVISION", entityPublicKey: revision.publicKey, eventType: "SALARY_REVISION_APPROVED", newStatus: revision.status, entityVersion: revision.version, reason, safeSnapshot: { staffReference: previous.staffMember.iamPublicKey, effectiveDate: dateText(effectiveDate), oldGrossPaise: revision.oldGrossPaise, newGrossPaise: revision.newGrossPaise } });
    return publicRevision(revision);
  }, transactionOptions);
}

export async function endPayrollEligibility(client: PrismaClient, raw: Record<string, unknown>, actor: PayrollActor) {
  await requireCriticalReauthentication(client, actor, String(raw.reauthPassword ?? ""));
  const assignmentKey = uuid(raw.assignmentKey, "Assignment reference"), endDate = inputDate(raw.endDate, "Eligibility end date"), reason = text(raw.reason, "Eligibility end reason", 3, 500);
  return client.$transaction(async (tx) => {
    const assignment = await tx.staffCompensationAssignment.findUnique({ where: { publicKey: assignmentKey } });
    if (!assignment) throw new PayrollError("Compensation assignment not found.", 404);
    if (endDate < assignment.payrollEligibleFrom) throw new PayrollError("Eligibility end cannot precede its start.");
    const changed = await tx.staffCompensationAssignment.updateMany({ where: { id: assignment.id, version: expectedVersion(raw.expectedVersion), status: { in: ["ACTIVE", "FUTURE"] } }, data: { payrollEligibleTo: endDate, effectiveTo: endDate, status: "ENDED", endReason: reason, version: { increment: 1 } } });
    if (changed.count !== 1) throw new PayrollError("The assignment changed; refresh and try again.", 409, "EXPECTED_VERSION_CONFLICT");
    await payrollEvent(tx, actor, { entityType: "COMPENSATION_ASSIGNMENT", entityPublicKey: assignment.publicKey, eventType: "PAYROLL_ELIGIBILITY_ENDED", previousStatus: assignment.status, newStatus: "ENDED", entityVersion: assignment.version + 1, reason, safeSnapshot: { eligibilityEnd: dateText(endDate) } });
    return { key: assignment.publicKey, status: "ENDED", version: assignment.version + 1, eligibilityEnd: dateText(endDate) };
  }, transactionOptions);
}

export async function createPayrollPeriod(client: PrismaClient, raw: Record<string, unknown>, actor: PayrollActor) {
  const payrollMonth = String(raw.payrollMonth ?? "").trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payrollMonth)) throw new PayrollError("Payroll month must use YYYY-MM.");
  const startDate = inputDate(raw.startDate ?? `${payrollMonth}-01`, "Period start"), endDate = inputDate(raw.endDate, "Period end");
  if (endDate < startDate || daysBetween(startDate, endDate) > 35) throw new PayrollError("Payroll periods must be a bounded range of at most 36 days.");
  const requiredAttendanceDates = array(raw.requiredAttendanceDates, "Required attendance dates", 36).map((value) => dateText(inputDate(value, "Required attendance date"))!);
  if (!requiredAttendanceDates.length || new Set(requiredAttendanceDates).size !== requiredAttendanceDates.length || requiredAttendanceDates.some((date) => date < dateText(startDate)! || date > dateText(endDate)!)) throw new PayrollError("Provide unique required attendance dates within the payroll period.");
  const inputApprovalReference = text(raw.inputApprovalReference, "Input approval reference", 3, 200);
  const periodCode = identifier(raw.periodCode ?? `PAY-${payrollMonth}`, "Period code");
  const existing = await client.payrollPeriod.findUnique({ where: { periodCode } });
  if (existing) return publicPeriod(existing);
  const period = await client.payrollPeriod.create({ data: { periodCode, payrollMonth, startDate, endDate, status: "INPUTS_LOCKED", requiredAttendanceDatesJson: JSON.stringify(requiredAttendanceDates), inputApprovalReference, inputsLockedByUserId: actor.user.id, inputsLockedAt: new Date() } });
  await payrollEvent(client, actor, { entityType: "PAYROLL_PERIOD", entityPublicKey: period.publicKey, eventType: "PAYROLL_INPUT_REQUIREMENTS_LOCKED", newStatus: period.status, entityVersion: period.version, reason: inputApprovalReference, safeSnapshot: { payrollMonth, requiredAttendanceDates } });
  return publicPeriod(period);
}

export async function preparePayrollRun(client: PrismaClient, raw: Record<string, unknown>, actor: PayrollActor) {
  const periodKey = uuid(raw.periodKey, "Payroll period reference"), requestKey = uuid(raw.requestKey ?? randomUUID(), "Request key");
  const existing = await client.payrollRun.findUnique({ where: { requestKey }, include: { period: true, employeeResults: { include: { staffMember: true, componentResults: true, payslips: true } } } });
  if (existing) return publicRun(existing);
  const manualAdjustments = parseManualAdjustments(raw.manualAdjustments);
  return client.$transaction(async (tx) => {
    const period = await tx.payrollPeriod.findUnique({ where: { publicKey: periodKey } });
    if (!period || period.status !== "INPUTS_LOCKED" || !period.inputsLockedAt) throw new PayrollError("Payroll period inputs must be explicitly locked before a run is prepared.", 409, "INPUTS_NOT_LOCKED");
    const policy = await tx.payrollPolicyVersion.findFirst({ where: { status: "ACTIVE", effectiveFrom: { lte: period.endDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }] }, orderBy: [{ effectiveFrom: "desc" }, { versionNumber: "desc" }] });
    if (!policy) throw new PayrollError("No approved payroll policy version covers this period.", 409, "POLICY_MISSING");
    const sequenceNumber = (await tx.payrollRun.aggregate({ where: { periodId: period.id }, _max: { sequenceNumber: true } }))._max.sequenceNumber ?? 0;
    const run = await tx.payrollRun.create({ data: { runNumber: `${period.periodCode}-R${String(sequenceNumber + 1).padStart(2, "0")}`, requestKey, periodId: period.id, policyVersionId: policy.id, sequenceNumber: sequenceNumber + 1, status: "DRAFT", activeKey: `period:${period.id}`, manualAdjustmentsJson: JSON.stringify(manualAdjustments), preparedByUserId: actor.user.id, financePostingStatus: "DISABLED", financePostingPreviewJson: JSON.stringify(financePostingBoundary()) }, include: { period: true, employeeResults: true } });
    await payrollEvent(tx, actor, { payrollRunId: run.id, entityType: "PAYROLL_RUN", entityPublicKey: run.publicKey, eventType: "PAYROLL_RUN_PREPARED", newStatus: "DRAFT", entityVersion: run.version, requestKey, safeSnapshot: { runNumber: run.runNumber, periodCode: period.periodCode, policyReference: policy.publicKey, financePosting: "DISABLED" } });
    return publicRun(run);
  }, transactionOptions).catch(mapUniqueRunError);
}

export async function calculatePayrollRun(client: PrismaClient, runKey: string, raw: Record<string, unknown>, actor: PayrollActor) {
  const publicKey = uuid(runKey, "Payroll run reference"), expected = expectedVersion(raw.expectedVersion);
  return client.$transaction(async (tx) => {
    const run = await tx.payrollRun.findUnique({ where: { publicKey }, include: { period: true, policyVersion: true } });
    if (!run) throw new PayrollError("Payroll run not found.", 404);
    if (!["DRAFT", "INPUTS_INCOMPLETE", "CALCULATED"].includes(run.status)) throw new PayrollError("Only an unlocked draft payroll run can be calculated.", 409);
    if (run.version !== expected) throw new PayrollError("The payroll run changed; refresh and try again.", 409, "EXPECTED_VERSION_CONFLICT");
    const requiredDates = jsonArray(run.period.requiredAttendanceDatesJson).map(String);
    const attendance = await tx.staffAttendanceSession.findMany({ where: { attendanceDate: { gte: run.period.startDate, lte: run.period.endDate } }, include: { records: true }, orderBy: { attendanceDate: "asc" } });
    const byDate = new Map(attendance.map((row) => [dateText(row.attendanceDate), row]));
    const globalExceptions = requiredDates.filter((date) => !byDate.has(date) || byDate.get(date)!.status !== "LOCKED").map((date) => ({ code: "ATTENDANCE_MISSING_OR_UNLOCKED", date, message: `Required Staff attendance for ${date} is missing or not locked.` }));
    if (globalExceptions.length) {
      const changed = await tx.payrollRun.updateMany({ where: { id: run.id, version: expected, status: run.status }, data: { status: "INPUTS_INCOMPLETE", exceptionsJson: JSON.stringify(globalExceptions), exceptionCount: globalExceptions.length, version: { increment: 1 } } });
      if (changed.count !== 1) throw new PayrollError("The payroll run changed during calculation.", 409, "EXPECTED_VERSION_CONFLICT");
      await payrollEvent(tx, actor, { payrollRunId: run.id, entityType: "PAYROLL_RUN", entityPublicKey: run.publicKey, eventType: "PAYROLL_CALCULATION_BLOCKED", previousStatus: run.status, newStatus: "INPUTS_INCOMPLETE", entityVersion: expected + 1, reason: "Required attendance/leave inputs were unavailable or unlocked.", safeSnapshot: { exceptionCodes: globalExceptions.map((row) => row.code), count: globalExceptions.length } });
      return { ...publicRun({ ...run, status: "INPUTS_INCOMPLETE", version: expected + 1, exceptionsJson: JSON.stringify(globalExceptions), exceptionCount: globalExceptions.length, employeeResults: [] }), exceptions: globalExceptions };
    }
    await tx.payrollComponentResult.deleteMany({ where: { employeePayrollResult: { payrollRunId: run.id } } });
    await tx.employeePayrollResult.deleteMany({ where: { payrollRunId: run.id } });
    const assignments = await tx.staffCompensationAssignment.findMany({ where: { status: { in: ["ACTIVE", "FUTURE", "ENDED"] }, effectiveFrom: { lte: run.period.endDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: run.period.startDate } }], payrollEligibleFrom: { lte: run.period.endDate }, AND: [{ OR: [{ payrollEligibleTo: null }, { payrollEligibleTo: { gte: run.period.startDate } }] }] }, include: { staffMember: true, structureVersion: { include: { policyVersion: true, components: { orderBy: { displayOrder: "asc" } } } } }, orderBy: [{ staffMemberId: "asc" }, { effectiveFrom: "desc" }] });
    const duplicates = duplicateKeys(assignments.map((row) => row.staffMemberId));
    const exceptions: Array<Record<string, unknown>> = duplicates.map((staffMemberId) => ({ code: "OVERLAPPING_COMPENSATION", staffReference: assignments.find((row) => row.staffMemberId === staffMemberId)?.staffMember.iamPublicKey, message: "More than one compensation assignment overlaps this period." }));
    const adjustments = jsonArray(run.manualAdjustmentsJson) as Array<Record<string, unknown>>;
    const results: Array<{ grossPaise: number; deductionPaise: number; reimbursementPaise: number; netPaise: number; formula: unknown; staffReference: string | null }> = [];
    for (const assignment of assignments.filter((row) => !duplicates.includes(row.staffMemberId))) {
      const applicableDates = requiredDates.filter((date) => date >= dateText(maxDate(run.period.startDate, assignment.payrollEligibleFrom, assignment.staffMember.dateOfJoining ?? assignment.payrollEligibleFrom))! && date <= dateText(minDate(run.period.endDate, assignment.payrollEligibleTo ?? run.period.endDate))!);
      const staffRecords = applicableDates.map((date) => byDate.get(date)!.records.find((record) => record.staffMemberId === assignment.staffMemberId));
      if (staffRecords.some((row) => !row)) { exceptions.push({ code: "STAFF_ATTENDANCE_ROW_MISSING", staffReference: assignment.staffMember.iamPublicKey, message: "A required locked attendance session does not contain this payroll-eligible Staff member." }); continue; }
      const unpaidLeaves = await tx.staffLeaveRequest.findMany({ where: { staffMemberId: assignment.staffMemberId, status: "APPROVED", leaveType: "UNPAID", startDate: { lte: run.period.endDate }, endDate: { gte: run.period.startDate } }, select: { id: true, startDate: true, endDate: true, totalDays: true, approvedAt: true, updatedAt: true } });
      const unpaidLeaveUnits = Math.round(unpaidLeaves.reduce((sum, row) => sum + row.totalDays * 2, 0));
      const halfDayUnits = staffRecords.filter((row) => row?.status === "HALF_DAY").length;
      const recoveryRows = await tx.advanceRecoverySchedule.findMany({ where: { payrollPeriodId: run.periodId, status: "SCHEDULED", salaryAdvance: { staffMemberId: assignment.staffMemberId, status: "APPROVED" } }, include: { salaryAdvance: true }, orderBy: [{ salaryAdvanceId: "asc" }, { sequenceNumber: "asc" }] });
      const advanceRecoveryPaise = recoveryRows.reduce((sum, row) => sum + row.scheduledAmountPaise, 0);
      if (recoveryRows.some((row) => row.scheduledAmountPaise > row.salaryAdvance.remainingBalancePaise)) { exceptions.push({ code: "ADVANCE_OVER_RECOVERY", staffReference: assignment.staffMember.iamPublicKey, message: "An advance recovery exceeds the remaining approved balance." }); continue; }
      const manualAdjustments = adjustments.filter((row) => row.staffKey === assignment.staffMember.iamPublicKey).map((row) => ({ componentCode: String(row.componentCode), amountPaise: Number(row.amountPaise), reason: String(row.reason), approvalReference: String(row.approvalReference) } satisfies ApprovedManualAdjustment));
      let calculated;
      try {
        calculated = calculateEmployeePayroll({ periodStart: run.period.startDate, periodEnd: run.period.endDate, eligibleFrom: maxDate(assignment.payrollEligibleFrom, assignment.effectiveFrom, assignment.staffMember.dateOfJoining ?? assignment.payrollEligibleFrom), eligibleTo: minDate(run.period.endDate, assignment.payrollEligibleTo ?? run.period.endDate, assignment.effectiveTo ?? run.period.endDate), unpaidLeaveUnits, attendanceHalfDayUnits: halfDayUnits, halfDayRule: assignment.structureVersion.policyVersion.halfDayRule as "NOT_CONFIGURED" | "HALF_DAY_AS_0_5", components: assignment.structureVersion.components.map((row) => ({ ...row, classification: row.classification as PayrollComponentInput["classification"], calculationMode: row.calculationMode as PayrollComponentInput["calculationMode"], calculationRule: row.calculationRule as PayrollComponentInput["calculationRule"], prorationRule: row.prorationRule as PayrollComponentInput["prorationRule"], roundingRule: row.roundingRule as PayrollComponentInput["roundingRule"], statutoryTreatment: row.statutoryTreatment as PayrollComponentInput["statutoryTreatment"] })), manualAdjustments, advanceRecoveryPaise, structureReference: `${assignment.structureVersion.publicKey}/v${assignment.structureVersion.versionNumber}`, policyReference: `${assignment.structureVersion.policyVersion.publicKey}/v${assignment.structureVersion.policyVersion.versionNumber}` });
      } catch (error) { const mapped = mapCalculationError(error); exceptions.push({ code: mapped.code, staffReference: assignment.staffMember.iamPublicKey, message: mapped.message }); continue; }
      const revision = await tx.salaryRevision.findFirst({ where: { newAssignmentId: assignment.id, effectiveDate: { lte: run.period.endDate } }, orderBy: { effectiveDate: "desc" } });
      const result = await tx.employeePayrollResult.create({ data: { payrollRunId: run.id, staffMemberId: assignment.staffMemberId, compensationAssignmentId: assignment.id, salaryRevisionId: revision?.id, status: "READY", eligibleDays: calculated.eligibleDays, periodDays: calculated.periodDays, unpaidLeaveUnits: calculated.unpaidLeaveUnits, halfDayUnits: calculated.halfDayUnits, attendanceSummaryJson: JSON.stringify(attendanceSummary(staffRecords.filter(Boolean) as Array<{ status: string }>)), sourceVersionsJson: JSON.stringify({ payrollPeriod: { key: run.period.publicKey, sourceVersion: run.period.sourceVersion, inputApprovalReference: run.period.inputApprovalReference }, policy: { key: assignment.structureVersion.policyVersion.publicKey, version: assignment.structureVersion.policyVersion.versionNumber }, runPolicy: { key: run.policyVersion.publicKey, version: run.policyVersion.versionNumber }, structure: { key: assignment.structureVersion.publicKey, version: assignment.structureVersion.versionNumber }, assignment: { key: assignment.publicKey, version: assignment.version }, attendanceSessions: applicableDates.map((date) => ({ date, status: byDate.get(date)?.status, lockedAt: byDate.get(date)?.lockedAt })), approvedUnpaidLeave: unpaidLeaves.map((row) => ({ reference: hashReference(row.id), updatedAt: row.updatedAt })), advanceScheduleKeys: recoveryRows.map((row) => row.publicKey) }), formulaSnapshotJson: JSON.stringify(calculated.formulaPreview), grossPaise: calculated.grossPaise, deductionPaise: calculated.deductionPaise, reimbursementPaise: calculated.reimbursementPaise, netPaise: calculated.netPaise, componentResults: { create: calculated.components.map((component) => ({ componentDefinitionId: component.componentDefinitionId, componentCode: component.componentCode, componentName: component.componentName, classification: component.classification, amountPaise: component.amountPaise, baseAmountPaise: component.baseAmountPaise, percentageBasisPoints: component.percentageBasisPoints, roundingRule: component.roundingRule, formulaText: component.formulaText, sourceVersionReference: component.sourceVersionReference, payslipVisible: component.payslipVisible, displayOrder: component.displayOrder })) } } });
      results.push({ grossPaise: result.grossPaise, deductionPaise: result.deductionPaise, reimbursementPaise: result.reimbursementPaise, netPaise: result.netPaise, formula: calculated.formulaPreview, staffReference: assignment.staffMember.iamPublicKey });
    }
    const status = exceptions.length ? "INPUTS_INCOMPLETE" : "CALCULATED";
    const totals = results.reduce((sum, row) => ({ gross: sum.gross + row.grossPaise, deductions: sum.deductions + row.deductionPaise, reimbursements: sum.reimbursements + row.reimbursementPaise, net: sum.net + row.netPaise }), { gross: 0, deductions: 0, reimbursements: 0, net: 0 });
    const changed = await tx.payrollRun.updateMany({ where: { id: run.id, version: expected, status: run.status }, data: { status, exceptionsJson: JSON.stringify(exceptions), formulaPreviewJson: JSON.stringify(results.map((row) => ({ staffReference: row.staffReference, formula: row.formula }))), inputSnapshotJson: JSON.stringify({ requiredAttendanceDates: requiredDates, attendanceSessionVersions: requiredDates.map((date) => ({ date, updatedAt: byDate.get(date)?.updatedAt, lockedAt: byDate.get(date)?.lockedAt })), calculatedAt: new Date() }), totalGrossPaise: totals.gross, totalDeductionPaise: totals.deductions, totalReimbursementPaise: totals.reimbursements, totalNetPaise: totals.net, employeeCount: results.length, exceptionCount: exceptions.length, version: { increment: 1 } } });
    if (changed.count !== 1) throw new PayrollError("The payroll run changed during calculation.", 409, "EXPECTED_VERSION_CONFLICT");
    await payrollEvent(tx, actor, { payrollRunId: run.id, entityType: "PAYROLL_RUN", entityPublicKey: run.publicKey, eventType: status === "CALCULATED" ? "PAYROLL_CALCULATED" : "PAYROLL_CALCULATION_BLOCKED", previousStatus: run.status, newStatus: status, entityVersion: expected + 1, reason: status === "CALCULATED" ? "Deterministic calculation completed from locked inputs." : "One or more governed input exceptions require resolution.", safeSnapshot: { totals, employeeCount: results.length, exceptionCodes: [...new Set(exceptions.map((row) => row.code))], sourcePolicy: run.policyVersion.publicKey } });
    const loaded = await tx.payrollRun.findUnique({ where: { id: run.id }, include: { period: true, employeeResults: { include: { staffMember: true, componentResults: true, payslips: true } } } });
    return publicRun(loaded!);
  }, { maxWait: 10_000, timeout: 60_000 });
}

export async function payrollRunWorkflow(client: PrismaClient, runKey: string, raw: Record<string, unknown>, actor: PayrollActor) {
  const action = oneOf(raw.action, ["SUBMIT", "APPROVE", "LOCK", "ISSUE_PAYSLIPS", "REVERSE", "CREATE_CORRECTION"], "Payroll workflow action");
  if (["APPROVE", "LOCK", "REVERSE"].includes(action)) await requireCriticalReauthentication(client, actor, String(raw.reauthPassword ?? ""));
  const publicKey = uuid(runKey, "Payroll run reference"), expected = expectedVersion(raw.expectedVersion), reason = optionalText(raw.reason, 500);
  return client.$transaction(async (tx) => {
    const run = await tx.payrollRun.findUnique({ where: { publicKey }, include: { period: true, policyVersion: true, employeeResults: { include: { staffMember: true, componentResults: { orderBy: { displayOrder: "asc" } }, payslips: true } } } });
    if (!run) throw new PayrollError("Payroll run not found.", 404);
    if (action === "APPROVE" && ["APPROVED", "LOCKED", "PAYSLIPS_ISSUED"].includes(run.status)) return publicRun(run);
    if (action === "LOCK" && ["LOCKED", "PAYSLIPS_ISSUED"].includes(run.status)) return publicRun(run);
    if (action === "ISSUE_PAYSLIPS" && run.status === "PAYSLIPS_ISSUED") return publicRun(run);
    if (run.version !== expected) throw new PayrollError("The payroll run changed; refresh and try again.", 409, "EXPECTED_VERSION_CONFLICT");
    if (action === "SUBMIT") {
      if (run.status !== "CALCULATED" || run.exceptionCount) throw new PayrollError("Resolve every payroll exception before review submission.", 409);
      return transitionRun(tx, run, actor, "UNDER_REVIEW", { submittedByUserId: actor.user.id, submittedAt: new Date() }, "PAYROLL_SUBMITTED", reason || "Submitted for payroll approval.");
    }
    if (action === "APPROVE") {
      if (run.status !== "UNDER_REVIEW") throw new PayrollError("Only a reviewed payroll run can be approved.", 409);
      return transitionRun(tx, run, actor, "APPROVED", { approvedByUserId: actor.user.id, approvedAt: new Date() }, "PAYROLL_APPROVED", text(reason, "Approval reason", 3, 500));
    }
    if (action === "LOCK") {
      if (run.status !== "APPROVED") throw new PayrollError("Only an approved payroll run can be locked.", 409);
      for (const result of run.employeeResults) {
        const sources = jsonObject(result.sourceVersionsJson);
        const keys = Array.isArray(sources.advanceScheduleKeys) ? sources.advanceScheduleKeys.map(String) : [];
        for (const key of keys) {
          const schedule = await tx.advanceRecoverySchedule.findUnique({ where: { publicKey: key }, include: { salaryAdvance: true } });
          if (!schedule || schedule.status !== "SCHEDULED" || schedule.payrollPeriodId !== run.periodId || schedule.salaryAdvance.staffMemberId !== result.staffMemberId) throw new PayrollError("An advance recovery schedule changed after calculation.", 409, "ADVANCE_SCHEDULE_STALE");
          if (schedule.scheduledAmountPaise > schedule.salaryAdvance.remainingBalancePaise) throw new PayrollError("Advance recovery exceeds the remaining balance.", 409, "ADVANCE_OVER_RECOVERY");
          const updated = await tx.advanceRecoverySchedule.updateMany({ where: { id: schedule.id, version: schedule.version, status: "SCHEDULED", employeePayrollResultId: null }, data: { status: "RECOVERED", recoveredAmountPaise: schedule.scheduledAmountPaise, employeePayrollResultId: result.id, recoveredAt: new Date(), version: { increment: 1 } } });
          if (updated.count !== 1) throw new PayrollError("Concurrent advance recovery was refused.", 409, "ADVANCE_CONFLICT");
          const remaining = schedule.salaryAdvance.remainingBalancePaise - schedule.scheduledAmountPaise;
          const advanced = await tx.salaryAdvance.updateMany({ where: { id: schedule.salaryAdvanceId, version: schedule.salaryAdvance.version, remainingBalancePaise: { gte: schedule.scheduledAmountPaise }, status: "APPROVED" }, data: { remainingBalancePaise: remaining, status: remaining === 0 ? "RECOVERY_COMPLETE" : "APPROVED", version: { increment: 1 } } });
          if (advanced.count !== 1) throw new PayrollError("Concurrent advance balance change was refused.", 409, "ADVANCE_CONFLICT");
        }
      }
      return transitionRun(tx, run, actor, "LOCKED", { lockedByUserId: actor.user.id, lockedAt: new Date(), activeKey: null }, "PAYROLL_LOCKED", text(reason, "Lock reason", 3, 500));
    }
    if (action === "ISSUE_PAYSLIPS") {
      if (run.status !== "LOCKED") throw new PayrollError("Lock payroll before issuing payslips.", 409);
      const school = await getSchoolSettings(tx as PrismaClient);
      for (const result of run.employeeResults) {
        if (result.payslips.length) continue;
        const snapshot = payslipSnapshot(school, run, result);
        const snapshotJson = JSON.stringify(snapshot);
        await tx.payslipVersion.create({ data: { employeePayrollResultId: result.id, staffMemberId: result.staffMemberId, versionNumber: 1, reference: `${run.runNumber}-${safeReference(result.staffMember.staffCode || result.staffMember.iamPublicKey || result.publicKey)}`, status: "ISSUED", snapshotJson, snapshotSha256: sha256(snapshotJson), issueDate: new Date(), issuedByUserId: actor.user.id } });
      }
      return transitionRun(tx, run, actor, "PAYSLIPS_ISSUED", { payslipsIssuedByUserId: actor.user.id, payslipsIssuedAt: new Date(), activeKey: null }, "PAYSLIPS_ISSUED", reason || "Private versioned payslips issued exactly once.");
    }
    if (action === "REVERSE") {
      if (!["LOCKED", "PAYSLIPS_ISSUED"].includes(run.status)) throw new PayrollError("Only a locked or issued payroll run can be reversed through a compensating version.", 409);
      const reversalReason = text(reason, "Reversal reason", 3, 500);
      const requestKey = uuid(raw.requestKey ?? randomUUID(), "Reversal request key");
      const existing = await tx.payrollRun.findUnique({ where: { requestKey }, include: { period: true, employeeResults: true } });
      if (existing) return publicRun(existing);
      for (const result of run.employeeResults) {
        const schedules = await tx.advanceRecoverySchedule.findMany({ where: { employeePayrollResultId: result.id, status: "RECOVERED" }, include: { salaryAdvance: true } });
        for (const schedule of schedules) {
          const changed = await tx.advanceRecoverySchedule.updateMany({ where: { id: schedule.id, version: schedule.version, status: "RECOVERED" }, data: { status: "REVERSED", reversedAt: new Date(), version: { increment: 1 } } });
          if (changed.count !== 1) throw new PayrollError("Concurrent advance recovery reversal was refused.", 409);
          await tx.salaryAdvance.update({ where: { id: schedule.salaryAdvanceId }, data: { status: "APPROVED", remainingBalancePaise: { increment: schedule.recoveredAmountPaise }, version: { increment: 1 } } });
        }
      }
      const nextSequence = (await tx.payrollRun.aggregate({ where: { periodId: run.periodId }, _max: { sequenceNumber: true } }))._max.sequenceNumber ?? run.sequenceNumber;
      const reversal = await tx.payrollRun.create({ data: { runNumber: `${run.period.periodCode}-REV${String(nextSequence + 1).padStart(2, "0")}`, requestKey, periodId: run.periodId, policyVersionId: run.policyVersionId, runType: "REVERSAL", sequenceNumber: nextSequence + 1, status: "REVERSED", sourceRunId: run.id, inputSnapshotJson: JSON.stringify({ sourceRun: run.publicKey, sourceStatus: run.status }), exceptionsJson: "[]", formulaPreviewJson: JSON.stringify({ reversalOf: run.publicKey, originalTotals: { grossPaise: run.totalGrossPaise, deductionPaise: run.totalDeductionPaise, reimbursementPaise: run.totalReimbursementPaise, netPaise: run.totalNetPaise } }), financePostingStatus: "DISABLED", financePostingPreviewJson: JSON.stringify(financePostingBoundary()), totalGrossPaise: run.totalGrossPaise, totalDeductionPaise: run.totalDeductionPaise, totalReimbursementPaise: run.totalReimbursementPaise, totalNetPaise: run.totalNetPaise, employeeCount: run.employeeCount, preparedByUserId: actor.user.id, approvedByUserId: actor.user.id, lockedByUserId: actor.user.id, approvedAt: new Date(), lockedAt: new Date(), reason: reversalReason } });
      await payrollEvent(tx, actor, { payrollRunId: reversal.id, entityType: "PAYROLL_RUN", entityPublicKey: reversal.publicKey, eventType: "PAYROLL_REVERSAL_VERSION_CREATED", newStatus: "REVERSED", entityVersion: reversal.version, reason: reversalReason, requestKey, safeSnapshot: { sourceRun: run.publicKey, financePosting: "DISABLED", advanceRecoveriesReversed: true } });
      return publicRun({ ...reversal, period: run.period, employeeResults: [] });
    }
    const correctionReason = text(reason, "Correction reason", 3, 500);
    if (!["LOCKED", "PAYSLIPS_ISSUED"].includes(run.status)) throw new PayrollError("Corrections start from a locked or issued source run.", 409);
    const requestKey = uuid(raw.requestKey ?? randomUUID(), "Correction request key");
    const existing = await tx.payrollRun.findUnique({ where: { requestKey }, include: { period: true, employeeResults: true } });
    if (existing) return publicRun(existing);
    const nextSequence = (await tx.payrollRun.aggregate({ where: { periodId: run.periodId }, _max: { sequenceNumber: true } }))._max.sequenceNumber ?? run.sequenceNumber;
    const correction = await tx.payrollRun.create({ data: { runNumber: `${run.period.periodCode}-COR${String(nextSequence + 1).padStart(2, "0")}`, requestKey, periodId: run.periodId, policyVersionId: run.policyVersionId, runType: "CORRECTION", sequenceNumber: nextSequence + 1, status: "DRAFT", activeKey: `period:${run.periodId}`, sourceRunId: run.id, manualAdjustmentsJson: run.manualAdjustmentsJson, inputSnapshotJson: JSON.stringify({ sourceRun: run.publicKey }), financePostingStatus: "DISABLED", financePostingPreviewJson: JSON.stringify(financePostingBoundary()), preparedByUserId: actor.user.id, reason: correctionReason } });
    await payrollEvent(tx, actor, { payrollRunId: correction.id, entityType: "PAYROLL_RUN", entityPublicKey: correction.publicKey, eventType: "PAYROLL_CORRECTION_DRAFT_CREATED", newStatus: "DRAFT", entityVersion: correction.version, reason: correctionReason, requestKey, safeSnapshot: { sourceRun: run.publicKey } });
    return publicRun({ ...correction, period: run.period, employeeResults: [] });
  }, { maxWait: 10_000, timeout: 60_000 }).catch(mapUniqueRunError);
}

export async function createSalaryAdvance(client: PrismaClient, raw: Record<string, unknown>, actor: PayrollActor, ownUserId?: string | null) {
  let staff;
  if (ownUserId) staff = await linkedPayrollStaff(client, ownUserId);
  else staff = await client.staffMember.findUnique({ where: { iamPublicKey: uuid(raw.staffKey, "Staff reference") } });
  if (!staff || staff.status !== "ACTIVE") throw new PayrollError("An active linked Staff profile is required.", 404);
  const requestedAmountPaise = moneyInput(raw.requestedAmount), requestedReason = text(raw.requestedReason, "Advance reason", 3, 500);
  const count = await client.salaryAdvance.count();
  const advance = await client.salaryAdvance.create({ data: { advanceNumber: `ADV-${String(count + 1).padStart(6, "0")}`, staffMemberId: staff.id, requestSource: ownUserId ? "STAFF_REQUEST" : "AUTHORISED_ENTRY", requestedAmountPaise, requestedReason, status: "REQUESTED" }, include: { staffMember: true, recoverySchedule: true } });
  await payrollEvent(client, actor, { entityType: "SALARY_ADVANCE", entityPublicKey: advance.publicKey, eventType: "ADVANCE_REQUESTED", newStatus: "REQUESTED", entityVersion: advance.version, reason: requestedReason, safeSnapshot: { staffReference: staff.iamPublicKey, requestedAmountPaise, requestSource: advance.requestSource, disbursementCreated: false } });
  return publicAdvance(advance);
}

export async function salaryAdvanceWorkflow(client: PrismaClient, advanceKey: string, raw: Record<string, unknown>, actor: PayrollActor) {
  const action = oneOf(raw.action, ["APPROVE", "REJECT", "CANCEL", "REVISE_SCHEDULE"], "Advance workflow action");
  if (["APPROVE", "CANCEL", "REVISE_SCHEDULE"].includes(action)) await requireCriticalReauthentication(client, actor, String(raw.reauthPassword ?? ""));
  const publicKey = uuid(advanceKey, "Advance reference"), expected = expectedVersion(raw.expectedVersion), reason = text(raw.reason, "Advance workflow reason", 3, 500);
  return client.$transaction(async (tx) => {
    const advance = await tx.salaryAdvance.findUnique({ where: { publicKey }, include: { recoverySchedule: true, staffMember: true } });
    if (!advance) throw new PayrollError("Salary advance not found.", 404);
    if (action === "APPROVE" && advance.status === "APPROVED") return publicAdvance(advance);
    if (advance.version !== expected) throw new PayrollError("The advance changed; refresh and try again.", 409, "EXPECTED_VERSION_CONFLICT");
    if (action === "APPROVE") {
      if (advance.status !== "REQUESTED") throw new PayrollError("Only a requested advance can be approved.", 409);
      const approvedAmountPaise = moneyInput(raw.approvedAmount);
      if (approvedAmountPaise > advance.requestedAmountPaise) throw new PayrollError("Approved advance cannot exceed the requested amount.");
      const schedule = parseRecoverySchedule(raw.schedule, approvedAmountPaise);
      const periods = await tx.payrollPeriod.findMany({ where: { publicKey: { in: schedule.map((row) => row.periodKey) } } });
      if (periods.length !== schedule.length) throw new PayrollError("Every recovery schedule row must reference a governed payroll period.");
      const periodByKey = new Map(periods.map((row) => [row.publicKey, row]));
      const updated = await tx.salaryAdvance.update({ where: { id: advance.id }, data: { status: "APPROVED", approvedAmountPaise, remainingBalancePaise: approvedAmountPaise, approvalReason: reason, approvedByUserId: actor.user.id, approvedAt: new Date(), version: { increment: 1 }, recoverySchedule: { create: schedule.map((row, index) => ({ sequenceNumber: index + 1, payrollPeriodId: periodByKey.get(row.periodKey)!.id, scheduledAmountPaise: row.amountPaise, status: "SCHEDULED", revisionReason: reason })) } }, include: { staffMember: true, recoverySchedule: { include: { payrollPeriod: true }, orderBy: { sequenceNumber: "asc" } } } });
      await payrollEvent(tx, actor, { entityType: "SALARY_ADVANCE", entityPublicKey: advance.publicKey, eventType: "ADVANCE_APPROVED_WITH_RECOVERY", previousStatus: "REQUESTED", newStatus: "APPROVED", entityVersion: expected + 1, reason, safeSnapshot: { approvedAmountPaise, recoveryRows: schedule.length, disbursementCreated: false } });
      return publicAdvance(updated);
    }
    if (action === "REJECT") {
      if (advance.status !== "REQUESTED") throw new PayrollError("Only a requested advance can be rejected.", 409);
      const updated = await tx.salaryAdvance.update({ where: { id: advance.id }, data: { status: "REJECTED", rejectedByUserId: actor.user.id, rejectedAt: new Date(), rejectionReason: reason, version: { increment: 1 } }, include: { staffMember: true, recoverySchedule: true } });
      await payrollEvent(tx, actor, { entityType: "SALARY_ADVANCE", entityPublicKey: advance.publicKey, eventType: "ADVANCE_REJECTED", previousStatus: "REQUESTED", newStatus: "REJECTED", entityVersion: expected + 1, reason });
      return publicAdvance(updated);
    }
    if (action === "CANCEL") {
      if (!["REQUESTED", "APPROVED"].includes(advance.status) || advance.recoverySchedule.some((row) => row.status === "RECOVERED")) throw new PayrollError("An advance with recovered payroll deductions cannot be cancelled.", 409);
      await tx.advanceRecoverySchedule.updateMany({ where: { salaryAdvanceId: advance.id, status: "SCHEDULED" }, data: { status: "CANCELLED", revisionReason: reason, version: { increment: 1 } } });
      const updated = await tx.salaryAdvance.update({ where: { id: advance.id }, data: { status: "CANCELLED", cancelledByUserId: actor.user.id, cancelledAt: new Date(), cancellationReason: reason, version: { increment: 1 } }, include: { staffMember: true, recoverySchedule: true } });
      await payrollEvent(tx, actor, { entityType: "SALARY_ADVANCE", entityPublicKey: advance.publicKey, eventType: "ADVANCE_CANCELLED", previousStatus: advance.status, newStatus: "CANCELLED", entityVersion: expected + 1, reason });
      return publicAdvance(updated);
    }
    if (advance.status !== "APPROVED" || advance.recoverySchedule.some((row) => row.status === "RECOVERED")) throw new PayrollError("Only an unrecovered approved schedule can be revised.", 409);
    const schedule = parseRecoverySchedule(raw.schedule, advance.remainingBalancePaise);
    const periods = await tx.payrollPeriod.findMany({ where: { publicKey: { in: schedule.map((row) => row.periodKey) } } });
    if (periods.length !== schedule.length) throw new PayrollError("Every recovery row must reference a governed payroll period.");
    const periodByKey = new Map(periods.map((row) => [row.publicKey, row]));
    const offset = Math.max(0, ...advance.recoverySchedule.map((row) => row.sequenceNumber));
    await tx.advanceRecoverySchedule.updateMany({ where: { salaryAdvanceId: advance.id, status: "SCHEDULED" }, data: { status: "CANCELLED", revisionReason: reason, version: { increment: 1 } } });
    await tx.advanceRecoverySchedule.createMany({ data: schedule.map((row, index) => ({ salaryAdvanceId: advance.id, sequenceNumber: offset + index + 1, payrollPeriodId: periodByKey.get(row.periodKey)!.id, scheduledAmountPaise: row.amountPaise, status: "SCHEDULED", revisionReason: reason })) });
    const updated = await tx.salaryAdvance.update({ where: { id: advance.id }, data: { version: { increment: 1 } }, include: { staffMember: true, recoverySchedule: { include: { payrollPeriod: true }, orderBy: { sequenceNumber: "asc" } } } });
    await payrollEvent(tx, actor, { entityType: "SALARY_ADVANCE", entityPublicKey: advance.publicKey, eventType: "ADVANCE_RECOVERY_SCHEDULE_REVISED", previousStatus: "APPROVED", newStatus: "APPROVED", entityVersion: expected + 1, reason, safeSnapshot: { newRows: schedule.length, priorRowsCancelled: true } });
    return publicAdvance(updated);
  }, transactionOptions);
}

export async function payrollReports(client: PrismaClient, options: { aggregateOnly?: boolean } = {}) {
  const [runs, componentRows, advances, payslipCount, revisions] = await Promise.all([
    client.payrollRun.findMany({ where: { status: { in: ["APPROVED", "LOCKED", "PAYSLIPS_ISSUED", "REVERSED", "ARCHIVED"] } }, include: { period: true }, orderBy: { createdAt: "desc" }, take: 120 }),
    client.payrollComponentResult.findMany({ where: { employeePayrollResult: { payrollRun: { status: { in: ["APPROVED", "LOCKED", "PAYSLIPS_ISSUED", "ARCHIVED"] } } } }, include: { employeePayrollResult: { include: { staffMember: { select: { department: true } }, payrollRun: { select: { publicKey: true, runNumber: true, status: true } } } } }, take: 10_000 }),
    client.salaryAdvance.findMany({ select: { status: true, approvedAmountPaise: true, remainingBalancePaise: true }, take: 5_000 }),
    client.payslipVersion.count({ where: { status: "ISSUED" } }),
    client.salaryRevision.findMany({ include: { staffMember: { select: { iamPublicKey: true, fullName: true, designation: true, department: true } } }, orderBy: { effectiveDate: "desc" }, take: 500 })
  ]);
  const byComponent = aggregate(componentRows, (row) => `${row.componentCode}|${row.componentName}|${row.classification}`, (row) => row.amountPaise);
  const byDepartment = aggregate(componentRows, (row) => row.employeePayrollResult.staffMember.department || "Unassigned", (row) => row.classification === "EARNING" ? row.amountPaise : row.classification === "DEDUCTION" ? -row.amountPaise : row.amountPaise);
  const departmentCounts = new Map<string, Set<string>>();
  for (const row of componentRows) { const key = row.employeePayrollResult.staffMember.department || "Unassigned"; const set = departmentCounts.get(key) ?? new Set(); set.add(row.employeePayrollResultId); departmentCounts.set(key, set); }
  const report = {
    generatedAt: new Date().toISOString(),
    suppressionMinimum: 3,
    runs: runs.map((run) => ({ key: run.publicKey, number: run.runNumber, month: run.period.payrollMonth, status: label(run.status), employeeCount: run.employeeCount, exceptionCount: run.exceptionCount, gross: payrollMoney(run.totalGrossPaise), deductions: payrollMoney(run.totalDeductionPaise), reimbursements: payrollMoney(run.totalReimbursementPaise), net: payrollMoney(run.totalNetPaise), financePosting: run.financePostingStatus })),
    componentTotals: [...byComponent.entries()].map(([key, amount]) => { const [code, name, classification] = key.split("|"); return { code, name, classification: label(classification), amount: payrollMoney(amount) }; }),
    departmentAggregates: [...byDepartment.entries()].map(([department, amount]) => ({ department: formulaSafe(department), employeeCount: departmentCounts.get(department)?.size ?? 0, netAmount: (departmentCounts.get(department)?.size ?? 0) >= 3 ? payrollMoney(amount) : "Suppressed" })),
    advanceTotals: { approved: advances.filter((row) => ["APPROVED", "RECOVERY_COMPLETE"].includes(row.status)).length, approvedAmount: payrollMoney(advances.reduce((sum, row) => sum + (row.approvedAmountPaise ?? 0), 0)), remainingBalance: payrollMoney(advances.reduce((sum, row) => sum + row.remainingBalancePaise, 0)) },
    issuedPayslipCount: payslipCount,
    revisionHistory: options.aggregateOnly ? [] : revisions.map(publicRevision),
    staffRanking: null,
    financeBoundary: financePostingBoundary()
  };
  if (options.aggregateOnly) return { ...report, runs: report.runs.map(({ key: _key, number: _number, ...row }) => row), componentTotals: report.componentTotals, revisionHistory: [] };
  return report;
}

export function payrollReportCsv(report: Awaited<ReturnType<typeof payrollReports>>) {
  const rows: string[][] = [["Report", "Label", "Classification", "Count", "Amount", "Status"]];
  for (const row of report.runs) rows.push(["Payroll Run", "number" in row ? String(row.number) : String(row.month), "", String(row.employeeCount), row.net, row.status]);
  for (const row of report.componentTotals) rows.push(["Component Total", `${row.code} - ${row.name}`, row.classification, "", row.amount, "Approved/locked runs only"]);
  for (const row of report.departmentAggregates) rows.push(["Department Aggregate", row.department, "", String(row.employeeCount), row.netAmount, row.netAmount === "Suppressed" ? "Minimum group not met" : "Released"]);
  rows.push(["Payslips", "Issued count", "", String(report.issuedPayslipCount), "", "Issued"]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function loadEmployeeSelfService(client: PrismaClient, staffMemberId: string) {
  const staff = await client.staffMember.findUnique({ where: { id: staffMemberId }, select: { iamPublicKey: true, staffCode: true, fullName: true, displayName: true, designation: true, department: true, status: true } });
  if (!staff) throw new PayrollError("Linked Staff profile not found.", 404);
  const [assignments, revisions, results, payslips, advances, attendance, leave] = await Promise.all([
    client.staffCompensationAssignment.findMany({ where: { staffMemberId }, include: { structureVersion: { include: { components: { where: { payslipVisible: true }, orderBy: { displayOrder: "asc" } }, policyVersion: true } } }, orderBy: { effectiveFrom: "desc" } }),
    client.salaryRevision.findMany({ where: { staffMemberId }, include: { newAssignment: { include: { structureVersion: true } }, staffMember: true }, orderBy: { effectiveDate: "desc" } }),
    client.employeePayrollResult.findMany({ where: { staffMemberId, payrollRun: { status: { in: ["LOCKED", "PAYSLIPS_ISSUED", "ARCHIVED"] } } }, include: { payrollRun: { include: { period: true } }, componentResults: { orderBy: { displayOrder: "asc" } }, payslips: true }, orderBy: { createdAt: "desc" }, take: 120 }),
    client.payslipVersion.findMany({ where: { staffMemberId, status: "ISSUED" }, include: { employeePayrollResult: { include: { payrollRun: { include: { period: true } } } } }, orderBy: { issueDate: "desc" }, take: 120 }),
    client.salaryAdvance.findMany({ where: { staffMemberId }, include: { staffMember: true, recoverySchedule: { include: { payrollPeriod: true }, orderBy: { sequenceNumber: "asc" } } }, orderBy: { createdAt: "desc" }, take: 120 }),
    client.staffAttendanceRecord.findMany({ where: { staffMemberId, session: { status: "LOCKED" } }, include: { session: { select: { attendanceDate: true, status: true, lockedAt: true } } }, orderBy: { session: { attendanceDate: "desc" } }, take: 180 }),
    client.staffLeaveRequest.findMany({ where: { staffMemberId, status: "APPROVED" }, select: { id: true, leaveType: true, startDate: true, endDate: true, totalDays: true, status: true, approvedAt: true }, orderBy: { startDate: "desc" }, take: 120 })
  ]);
  return {
    mode: "OWN", linked: true,
    staff: { key: staff.iamPublicKey, code: staff.staffCode, name: staff.displayName || staff.fullName, designation: staff.designation, department: staff.department, status: staff.status },
    currentSalaryStructure: assignments.find((row) => row.status === "ACTIVE" || row.status === "FUTURE") ? publicOwnAssignment(assignments.find((row) => row.status === "ACTIVE" || row.status === "FUTURE")!) : null,
    salaryHistory: assignments.map(publicOwnAssignment),
    revisions: revisions.map(publicRevision),
    payrollResults: results.map((row) => ({ key: row.publicKey, month: row.payrollRun.period.payrollMonth, status: label(row.payrollRun.status), attendance: jsonObject(row.attendanceSummaryJson), gross: payrollMoney(row.grossPaise), deductions: payrollMoney(row.deductionPaise), reimbursements: payrollMoney(row.reimbursementPaise), net: payrollMoney(row.netPaise), formula: jsonObject(row.formulaSnapshotJson), components: row.componentResults.filter((item) => item.payslipVisible).map(publicComponentResult), adjustments: row.componentResults.filter((item) => item.componentCode.includes("ADJUST") || item.componentCode.includes("ARREAR")).map(publicComponentResult) })),
    payslips: payslips.map((row) => ({ reference: row.reference, version: row.versionNumber, payrollMonth: row.employeePayrollResult.payrollRun.period.payrollMonth, issueDate: dateText(row.issueDate), downloadUrl: `/api/my-payroll/payslips/${encodeURIComponent(row.reference)}/download` })),
    advances: advances.map(publicAdvance),
    payrollInputs: { attendance: attendance.map((row) => ({ date: dateText(row.session.attendanceDate), status: label(row.status), source: label(row.source), locked: row.session.status === "LOCKED" })), leave: leave.map((row) => ({ reference: hashReference(row.id), type: label(row.leaveType), start: dateText(row.startDate), end: dateText(row.endDate), units: Math.round(row.totalDays * 2), status: label(row.status), approvedAt: dateText(row.approvedAt) })) },
    explanation: "Amounts are calculated only from approved effective-dated salary versions, explicitly locked attendance inputs, approved unpaid leave, approved adjustments and recovery schedules. No payment, bank transfer or cash movement is created."
  };
}

export async function findPayslipForDownload(client: PrismaClient, reference: string, options: { ownUserId?: string | null }) {
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(reference)) throw new PayrollError("Payslip reference is invalid.", 404);
  const payslip = await client.payslipVersion.findUnique({ where: { reference }, include: { staffMember: { select: { userId: true } } } });
  if (!payslip || payslip.status !== "ISSUED") throw new PayrollError("Issued payslip not found.", 404);
  if (options.ownUserId && payslip.staffMember.userId !== options.ownUserId) throw new PayrollError("Issued payslip not found.", 404);
  return { reference: payslip.reference, version: payslip.versionNumber, snapshot: jsonObject(payslip.snapshotJson), hash: payslip.snapshotSha256 };
}

export function financePostingBoundary() {
  return { postingAllowed: false, status: "DISABLED", reason: "Existing finance invariants do not prove exact payroll-run ownership, one posting per approved run, idempotent reversal and locked-period protection together.", createsPayment: false, createsReceipt: false, createsExpense: false, createsCashMovement: false, createsBankTransfer: false } as const;
}

async function transitionRun(tx: Prisma.TransactionClient, run: any, actor: PayrollActor, nextStatus: string, data: Record<string, unknown>, eventType: string, reason: string) {
  const changed = await tx.payrollRun.updateMany({ where: { id: run.id, version: run.version, status: run.status }, data: { ...data, status: nextStatus, version: { increment: 1 } } });
  if (changed.count !== 1) throw new PayrollError("Concurrent payroll workflow change was refused.", 409, "EXPECTED_VERSION_CONFLICT");
  await payrollEvent(tx, actor, { payrollRunId: run.id, entityType: "PAYROLL_RUN", entityPublicKey: run.publicKey, eventType, previousStatus: run.status, newStatus: nextStatus, entityVersion: run.version + 1, reason, safeSnapshot: { totals: { grossPaise: run.totalGrossPaise, deductionPaise: run.totalDeductionPaise, reimbursementPaise: run.totalReimbursementPaise, netPaise: run.totalNetPaise }, financePosting: "DISABLED" } });
  const updated = await tx.payrollRun.findUnique({ where: { id: run.id }, include: { period: true, employeeResults: { include: { staffMember: true, componentResults: true, payslips: true } } } });
  return publicRun(updated!);
}

async function payrollEvent(client: PayrollDb, actor: PayrollActor, input: { payrollRunId?: string; entityType: string; entityPublicKey: string; eventType: string; previousStatus?: string; newStatus?: string; entityVersion?: number; reason?: string; safeSnapshot?: unknown; requestKey?: string }) {
  return client.payrollEvent.create({ data: { payrollRunId: input.payrollRunId, entityType: input.entityType, entityPublicKey: input.entityPublicKey, eventType: input.eventType, previousStatus: input.previousStatus, newStatus: input.newStatus, entityVersion: input.entityVersion, actorUserId: actor.user.id, actorRole: actor.user.role, reason: input.reason, safeSnapshotJson: input.safeSnapshot ? JSON.stringify(input.safeSnapshot) : null, requestKey: input.requestKey } });
}

async function linkedPayrollStaff(client: PrismaClient, userId: string) { return client.staffMember.findFirst({ where: { userId, status: { in: ["ACTIVE", "INACTIVE"] } } }); }

function payslipSnapshot(school: Awaited<ReturnType<typeof getSchoolSettings>>, run: any, result: any) {
  return { schema: "NALANDA_PAYSLIP_V1", school: { name: school.schoolName, address: school.addressLine1, city: school.city, phone: school.showSchoolPhone ? school.phone : null }, staff: { name: result.staffMember.displayName || result.staffMember.fullName, designation: result.staffMember.designation, department: result.staffMember.department }, payrollMonth: run.period.payrollMonth, earnings: result.componentResults.filter((row: any) => row.classification === "EARNING" && row.payslipVisible).map(snapshotComponent), deductions: result.componentResults.filter((row: any) => row.classification === "DEDUCTION" && row.payslipVisible).map(snapshotComponent), reimbursements: result.componentResults.filter((row: any) => row.classification === "REIMBURSEMENT" && row.payslipVisible).map(snapshotComponent), totals: { grossPaise: result.grossPaise, deductionPaise: result.deductionPaise, reimbursementPaise: result.reimbursementPaise, netPaise: result.netPaise }, attendance: jsonObject(result.attendanceSummaryJson), formula: jsonObject(result.formulaSnapshotJson), sourceVersions: jsonObject(result.sourceVersionsJson), issue: { version: 1, issueDate: dateText(new Date()), runReference: run.runNumber } };
}
function snapshotComponent(row: any) { return { code: row.componentCode, name: row.componentName, amountPaise: row.amountPaise, formula: row.formulaText, sourceVersion: row.sourceVersionReference }; }

function publicPolicy(row: any) { return { key: row.publicKey, code: row.policyCode, version: row.versionNumber, name: row.name, status: label(row.status), effectiveFrom: dateText(row.effectiveFrom), effectiveTo: dateText(row.effectiveTo), prorationBasis: label(row.prorationBasis), unpaidLeaveRule: label(row.unpaidLeaveRule), halfDayRule: label(row.halfDayRule), roundingRule: label(row.defaultRoundingRule), requiredAttendanceRule: label(row.requiredAttendanceRule), approvalReference: row.approvalReference }; }
function publicStructure(row: any) { return { key: row.publicKey, code: row.structureCode, version: row.versionNumber, rowVersion: row.version, name: row.name, description: row.description, status: label(row.status), effectiveFrom: dateText(row.effectiveFrom), effectiveTo: dateText(row.effectiveTo), estimatedGross: payrollMoney(row.estimatedGrossPaise), approvalReference: row.approvalReference, components: (row.components ?? []).map((item: any) => ({ key: item.publicKey, code: item.componentCode, name: item.name, classification: label(item.classification), mode: label(item.calculationMode), rule: label(item.calculationRule), fixedAmount: item.defaultAmountPaise == null ? null : payrollMoney(item.defaultAmountPaise), percentage: item.percentageBasisPoints == null ? null : `${item.percentageBasisPoints / 100}%`, percentageBaseCode: item.percentageBaseCode, proration: label(item.prorationRule), rounding: label(item.roundingRule), statutoryTreatment: label(item.statutoryTreatment), payslipVisible: item.payslipVisible, accounting: label(item.accountingBehavior), export: label(item.exportBehavior), version: item.versionNumber })) }; }
function publicAssignment(row: any) { return { key: row.publicKey, version: row.version, staff: row.staffMember ? { key: row.staffMember.iamPublicKey, code: row.staffMember.staffCode, name: row.staffMember.displayName || row.staffMember.fullName, designation: row.staffMember.designation, department: row.staffMember.department } : undefined, structure: row.structureVersion ? { key: row.structureVersion.publicKey, code: row.structureVersion.structureCode, version: row.structureVersion.versionNumber, name: row.structureVersion.name, estimatedGross: payrollMoney(row.structureVersion.estimatedGrossPaise) } : undefined, effectiveFrom: dateText(row.effectiveFrom), effectiveTo: dateText(row.effectiveTo), eligibleFrom: dateText(row.payrollEligibleFrom), eligibleTo: dateText(row.payrollEligibleTo), status: label(row.status), reason: row.reason, endReason: row.endReason }; }
function publicOwnAssignment(row: any) { return { key: row.publicKey, version: row.version, structure: { key: row.structureVersion.publicKey, code: row.structureVersion.structureCode, version: row.structureVersion.versionNumber, name: row.structureVersion.name, policy: { key: row.structureVersion.policyVersion.publicKey, version: row.structureVersion.policyVersion.versionNumber } }, effectiveFrom: dateText(row.effectiveFrom), effectiveTo: dateText(row.effectiveTo), eligibleFrom: dateText(row.payrollEligibleFrom), eligibleTo: dateText(row.payrollEligibleTo), status: label(row.status), estimatedGross: payrollMoney(row.structureVersion.estimatedGrossPaise), components: row.structureVersion.components.map((item: any) => ({ code: item.componentCode, name: item.name, classification: label(item.classification), mode: label(item.calculationMode), configuredAmount: item.defaultAmountPaise == null ? null : payrollMoney(item.defaultAmountPaise), percentage: item.percentageBasisPoints == null ? null : `${item.percentageBasisPoints / 100}%`, effectiveFrom: dateText(item.effectiveFrom), payslipVisible: item.payslipVisible })) }; }
function publicRevision(row: any) { return { key: row.publicKey, version: row.version, staff: row.staffMember ? { key: row.staffMember.iamPublicKey, name: row.staffMember.displayName || row.staffMember.fullName, designation: row.staffMember.designation, department: row.staffMember.department } : undefined, effectiveDate: dateText(row.effectiveDate), status: label(row.status), oldGross: payrollMoney(row.oldGrossPaise), newGross: payrollMoney(row.newGrossPaise), reason: row.reason, newStructure: row.newAssignment?.structureVersion ? `${row.newAssignment.structureVersion.name} v${row.newAssignment.structureVersion.versionNumber}` : undefined, approvedAt: dateText(row.approvedAt) }; }
function publicPeriod(row: any) { return { key: row.publicKey, code: row.periodCode, month: row.payrollMonth, startDate: dateText(row.startDate), endDate: dateText(row.endDate), status: label(row.status), sourceVersion: row.sourceVersion, rowVersion: row.version, requiredAttendanceDates: jsonArray(row.requiredAttendanceDatesJson), inputApprovalReference: row.inputApprovalReference, inputsLockedAt: dateText(row.inputsLockedAt) }; }
function publicRun(row: any) { return { key: row.publicKey, number: row.runNumber, type: label(row.runType), status: label(row.status), rawStatus: row.status, version: row.version, period: row.period ? { key: row.period.publicKey, code: row.period.periodCode, month: row.period.payrollMonth } : undefined, sourceRun: row.sourceRun ? { key: row.sourceRun.publicKey, number: row.sourceRun.runNumber, status: label(row.sourceRun.status) } : undefined, employees: (row.employeeResults ?? []).map((result: any) => ({ key: result.publicKey, staff: { key: result.staffMember?.iamPublicKey, name: result.staffMember?.displayName || result.staffMember?.fullName, designation: result.staffMember?.designation, department: result.staffMember?.department }, status: label(result.status), attendance: jsonObject(result.attendanceSummaryJson), formula: jsonObject(result.formulaSnapshotJson), gross: payrollMoney(result.grossPaise), deductions: payrollMoney(result.deductionPaise), reimbursements: payrollMoney(result.reimbursementPaise), net: payrollMoney(result.netPaise), components: (result.componentResults ?? []).map(publicComponentResult), payslips: (result.payslips ?? []).map((slip: any) => ({ reference: slip.reference, version: slip.versionNumber, issueDate: dateText(slip.issueDate), downloadUrl: `/api/payroll/payslips/${encodeURIComponent(slip.reference)}/download` })) })), exceptions: jsonArray(row.exceptionsJson), totals: { gross: payrollMoney(row.totalGrossPaise), deductions: payrollMoney(row.totalDeductionPaise), reimbursements: payrollMoney(row.totalReimbursementPaise), net: payrollMoney(row.totalNetPaise) }, employeeCount: row.employeeCount, exceptionCount: row.exceptionCount, financePosting: { status: label(row.financePostingStatus), preview: jsonObject(row.financePostingPreviewJson) }, reason: row.reason, createdAt: dateText(row.createdAt) }; }
function publicAdvance(row: any) { return { key: row.publicKey, number: row.advanceNumber, version: row.version, staff: row.staffMember ? { key: row.staffMember.iamPublicKey, code: row.staffMember.staffCode, name: row.staffMember.displayName || row.staffMember.fullName, designation: row.staffMember.designation } : undefined, source: label(row.requestSource), requestedAmount: payrollMoney(row.requestedAmountPaise), requestedReason: row.requestedReason, status: label(row.status), rawStatus: row.status, approvedAmount: row.approvedAmountPaise == null ? null : payrollMoney(row.approvedAmountPaise), remainingBalance: payrollMoney(row.remainingBalancePaise), approvalReason: row.approvalReason, rejectionReason: row.rejectionReason, cancellationReason: row.cancellationReason, schedule: (row.recoverySchedule ?? []).map((item: any) => ({ key: item.publicKey, sequence: item.sequenceNumber, period: item.payrollPeriod ? { key: item.payrollPeriod.publicKey, code: item.payrollPeriod.periodCode, month: item.payrollPeriod.payrollMonth } : null, scheduledAmount: payrollMoney(item.scheduledAmountPaise), recoveredAmount: payrollMoney(item.recoveredAmountPaise), status: label(item.status), reason: item.revisionReason })) }; }
function publicComponentResult(row: any) { return { code: row.componentCode, name: row.componentName, classification: label(row.classification), amount: payrollMoney(row.amountPaise), formula: row.formulaText, sourceVersion: row.sourceVersionReference }; }

function parseManualAdjustments(value: unknown) { return array(value ?? [], "Manual adjustments", MAX_ADJUSTMENTS).map((item, index) => { const row = record(item, `Manual adjustment ${index + 1}`); return { staffKey: uuid(row.staffKey, "Adjustment Staff reference"), componentCode: identifier(row.componentCode, "Adjustment component code"), amountPaise: moneyInput(row.amount), reason: text(row.reason, "Adjustment reason", 3, 500), approvalReference: text(row.approvalReference, "Adjustment approval reference", 2, 200) }; }); }
function parseRecoverySchedule(value: unknown, totalPaise: number) { const rows = array(value, "Recovery schedule", MAX_RECOVERY_ROWS).map((item, index) => { const row = record(item, `Recovery row ${index + 1}`); return { periodKey: uuid(row.periodKey, "Recovery payroll period"), amountPaise: moneyInput(row.amount) }; }); if (!rows.length || rows.reduce((sum, row) => sum + row.amountPaise, 0) !== totalPaise) throw new PayrollError("Recovery schedule must exactly equal the approved remaining amount."); if (new Set(rows.map((row) => row.periodKey)).size !== rows.length) throw new PayrollError("A payroll period may appear only once in an advance recovery schedule."); return rows; }
function attendanceSummary(rows: Array<{ status: string }>) { const totals: Record<string, number> = {}; for (const row of rows) totals[row.status] = (totals[row.status] ?? 0) + 1; return { lockedInputRows: rows.length, statuses: totals }; }
function aggregate<T>(rows: T[], key: (row: T) => string, amount: (row: T) => number) { const map = new Map<string, number>(); for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + amount(row)); return map; }
function duplicateKeys(values: string[]) { const seen = new Set<string>(), duplicates = new Set<string>(); for (const value of values) { if (seen.has(value)) duplicates.add(value); seen.add(value); } return [...duplicates]; }
function mapUniqueRunError(error: unknown): never { if (error instanceof PayrollError) throw error; const message = error instanceof Error ? error.message : ""; if (message.includes("Unique constraint") && (message.includes("activeKey") || message.includes("period"))) throw new PayrollError("Another active payroll run already owns this period.", 409, "CONCURRENT_RUN_BLOCKED"); throw error; }
function mapCalculationError(error: unknown) { return error instanceof PayrollCalculationError ? new PayrollError(error.message, 400, error.code) : error instanceof PayrollError ? error : new PayrollError("Payroll calculation input is invalid."); }
function record(value: unknown, labelText: string) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new PayrollError(`${labelText} must be an object.`); return value as Record<string, unknown>; }
function array(value: unknown, labelText: string, maximum: number) { if (!Array.isArray(value) || value.length > maximum) throw new PayrollError(`${labelText} must contain at most ${maximum} rows.`); return value; }
function text(value: unknown, labelText: string, min: number, max: number) { const result = String(value ?? "").trim(); if (result.length < min || result.length > max) throw new PayrollError(`${labelText} must contain ${min}-${max} characters.`); return result; }
function optionalText(value: unknown, max: number) { const result = String(value ?? "").trim(); if (result.length > max) throw new PayrollError(`Text must contain at most ${max} characters.`); return result || null; }
function identifier(value: unknown, labelText: string) { const result = String(value ?? "").trim().toUpperCase(); if (!/^[A-Z][A-Z0-9_-]{1,39}$/.test(result)) throw new PayrollError(`${labelText} must contain 2-40 uppercase letters, numbers, hyphens or underscores.`); return result; }
function uuid(value: unknown, labelText: string) { const result = String(value ?? "").trim(); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new PayrollError(`${labelText} is invalid.`); return result; }
function inputDate(value: unknown, labelText: string) { const source = String(value ?? "").trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) throw new PayrollError(`${labelText} must use YYYY-MM-DD.`); try { return payrollDate(source, labelText); } catch (error) { throw mapCalculationError(error); } }
function expectedVersion(value: unknown) { return integer(value, "Expected version", 1, 1_000_000_000); }
function integer(value: unknown, labelText: string, min: number, max: number) { const result = Number(value); if (!Number.isInteger(result) || result < min || result > max) throw new PayrollError(`${labelText} is invalid.`); return result; }
function moneyInput(value: unknown): number;
function moneyInput(value: unknown, allowEmpty: true): number | null;
function moneyInput(value: unknown, allowEmpty = false) { if (allowEmpty && (value == null || value === "")) return null; const rupees = Number(value); if (!Number.isFinite(rupees) || rupees < 0 || rupees > 10_000_000) throw new PayrollError("Amount must be between INR 0 and INR 1,00,00,000."); return Math.round(rupees * 100); }
function oneOf<T extends string>(value: unknown, allowed: readonly T[], labelText: string): T { const result = String(value ?? "").trim().toUpperCase() as T; if (!allowed.includes(result)) throw new PayrollError(`${labelText} is invalid.`); return result; }
function normalizeCalculationRule(value: unknown): PayrollComponentInput["calculationRule"] { const raw=String(value??"STANDARD").trim().toUpperCase();return (["FIXED_AMOUNT","PERCENT_OF_COMPONENT","MANUAL_ADJUSTMENT"].includes(raw)?"STANDARD":raw) as PayrollComponentInput["calculationRule"]; }
function normalizeProrationRule(value: unknown): PayrollComponentInput["prorationRule"] { const raw=String(value??"FULL_PERIOD").trim().toUpperCase();return (raw==="NONE"?"FULL_PERIOD":raw==="ELIGIBLE_DAYS"?"PRORATE_ELIGIBILITY":raw) as PayrollComponentInput["prorationRule"]; }
function jsonArray(value: unknown) { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function jsonObject(value: unknown) { try { const parsed = typeof value === "string" ? JSON.parse(value) : value; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } }
function dateText(value: Date | string | null | undefined) { if (!value) return null; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10); }
function daysBetween(start: Date, end: Date) { return Math.floor((end.getTime() - start.getTime()) / 86_400_000); }
function maxDate(...dates: Date[]) { return dates.reduce((max, value) => value > max ? value : max); }
function minDate(...dates: Date[]) { return dates.reduce((min, value) => value < min ? value : min); }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function hashReference(value: string) { return sha256(`payroll-reference:${value}`).slice(0, 16); }
function safeReference(value: string) { return String(value).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48) || randomUUID(); }
function label(value: string) { return String(value ?? "").toLowerCase().split("_").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" "); }
function formulaSafe(value: string) { return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value; }
function csvCell(value: unknown) { return `"${formulaSafe(String(value ?? "")).replaceAll('"', '""')}"`; }
const transactionOptions = { maxWait: 10_000, timeout: 30_000 } as const;
