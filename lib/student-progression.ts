import type { Prisma, PrismaClient } from "@prisma/client";

export const PROGRESSION_DECISION_TYPES = ["PROMOTE", "REPEAT", "TRANSFER_OUT", "LEFT", "DROPPED_OUT", "PASSED_OUT", "CORRECTION"] as const;
export const PROGRESSION_STATUSES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "FINALIZED", "CANCELLED"] as const;
export type ProgressionDecisionType = (typeof PROGRESSION_DECISION_TYPES)[number];
export type ProgressionStatus = (typeof PROGRESSION_STATUSES)[number];
const REASON_REQUIRED = new Set<ProgressionDecisionType>(["REPEAT", "TRANSFER_OUT", "LEFT", "DROPPED_OUT", "CORRECTION"]);
const TARGET_ENROLLMENT_TYPES = new Set<ProgressionDecisionType>(["PROMOTE", "REPEAT"]);
const TERMINAL_STATUS: Record<Exclude<ProgressionDecisionType, "CORRECTION">, string> = {
  PROMOTE: "PROMOTED", REPEAT: "REPEATED", TRANSFER_OUT: "TRANSFERRED_OUT", LEFT: "LEFT", DROPPED_OUT: "DROPPED_OUT", PASSED_OUT: "PASSED_OUT"
};

function text(value: unknown) { return String(value ?? "").trim(); }
function optionalText(value: unknown) { return text(value) || null; }
export function progressionDate(value: unknown, label = "Effective date") {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${label} is required`);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error(`${label} is invalid`);
  return date;
}

export function validateProgressionInput(raw: unknown, options: { submitting?: boolean } = {}) {
  const source = (raw ?? {}) as Record<string, unknown>;
  const studentId = text(source.studentId);
  const sourceEnrollmentId = text(source.sourceEnrollmentId);
  const academicYear = text(source.academicYear);
  const decisionType = text(source.decisionType).toUpperCase() as ProgressionDecisionType;
  if (!studentId) throw new Error("Choose a student");
  if (!sourceEnrollmentId) throw new Error("Choose the source enrollment");
  if (!academicYear) throw new Error("Academic year is required");
  if (!PROGRESSION_DECISION_TYPES.includes(decisionType)) throw new Error("Choose a valid decision type");
  const effectiveDate = progressionDate(source.effectiveDate);
  const reason = optionalText(source.reason);
  const evidenceNotes = optionalText(source.evidenceNotes);
  const parentAcknowledgementNotes = optionalText(source.parentAcknowledgementNotes);
  const toAcademicYear = optionalText(source.toAcademicYear);
  const toClass = optionalText(source.toClass);
  const toSection = optionalText(source.toSection);
  if (options.submitting) {
    if (REASON_REQUIRED.has(decisionType) && !reason) throw new Error(`Reason is required for ${decisionLabel(decisionType)}`);
    if (TARGET_ENROLLMENT_TYPES.has(decisionType) && (!toAcademicYear || !toClass)) throw new Error("Target academic year and class are required before submission");
    if (decisionType === "REPEAT" && (!evidenceNotes || !parentAcknowledgementNotes)) throw new Error("Repeat decisions require evidence notes and parent acknowledgement notes");
    if (decisionType === "PASSED_OUT" && !evidenceNotes) throw new Error("Passed-out decisions require notes");
  }
  return {
    studentId, sourceEnrollmentId, academicYear, decisionType, effectiveDate, reason,
    toAcademicYear, toClass, toSection,
    evidenceNotes, marksSummary: optionalText(source.marksSummary), attendanceSummary: optionalText(source.attendanceSummary),
    parentRequestNotes: optionalText(source.parentRequestNotes), parentAcknowledgementNotes,
    feeWarningNotes: optionalText(source.feeWarningNotes), udiseReviewNotes: optionalText(source.udiseReviewNotes),
    destinationSchool: optionalText(source.destinationSchool), followUpNotes: optionalText(source.followUpNotes)
  };
}

export function decisionLabel(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (c) => c.toUpperCase()); }
export function targetStatus(type: ProgressionDecisionType) { return TARGET_ENROLLMENT_TYPES.has(type) ? "ACTIVE" : type === "CORRECTION" ? null : TERMINAL_STATUS[type]; }

export const progressionInclude = {
  student: { select: { admissionNo: true, studentName: true } },
  sourceEnrollment: { select: { academicYear: true, className: true, section: true, rollNo: true, status: true } },
  createdBy: { select: { name: true } }, submittedBy: { select: { name: true } }, approvedBy: { select: { name: true } },
  finalizedBy: { select: { name: true } }, cancelledBy: { select: { name: true } }
} as const;

export function progressionWhere(filters: { academicYear?: string | null; decisionType?: string | null; status?: string | null; className?: string | null; section?: string | null }): Prisma.StudentProgressionDecisionWhereInput {
  const where: Prisma.StudentProgressionDecisionWhereInput = {};
  if (filters.academicYear) where.academicYear = filters.academicYear;
  if (filters.decisionType && PROGRESSION_DECISION_TYPES.includes(filters.decisionType as ProgressionDecisionType)) where.decisionType = filters.decisionType;
  if (filters.status && PROGRESSION_STATUSES.includes(filters.status as ProgressionStatus)) where.status = filters.status;
  if (filters.className) where.fromClass = filters.className;
  if (filters.section) where.fromSection = filters.section;
  return where;
}

type ProgressionClient = Pick<PrismaClient | Prisma.TransactionClient, "studentProgressionDecision" | "academicYearEnrollment" | "studentLifecycleEvent">;
export async function createProgressionDecision(client: ProgressionClient, raw: unknown, userId: string, submit = false) {
  const input = validateProgressionInput(raw, { submitting: submit });
  const enrollment = await client.academicYearEnrollment.findFirst({ where: { id: input.sourceEnrollmentId, studentId: input.studentId } });
  if (!enrollment) throw new Error("The selected source enrollment no longer exists for this student");
  if (enrollment.academicYear !== input.academicYear) throw new Error("The decision academic year must match the source enrollment");
  return client.studentProgressionDecision.create({ data: {
    ...input, fromClass: enrollment.className, fromSection: enrollment.section, fromStatus: enrollment.status,
    toStatus: targetStatus(input.decisionType), status: submit ? "PENDING_APPROVAL" : "DRAFT", createdByUserId: userId,
    submittedByUserId: submit ? userId : null, submittedAt: submit ? new Date() : null
  }, include: progressionInclude });
}

export async function updateProgressionDraft(client: ProgressionClient, id: string, raw: unknown) {
  const current = await client.studentProgressionDecision.findUnique({ where: { id } });
  if (!current) throw new Error("Progression decision not found");
  if (current.status !== "DRAFT") throw new Error("Only draft decisions can be edited");
  const input = validateProgressionInput(raw);
  if (input.studentId !== current.studentId) throw new Error("A draft decision cannot be moved to another student");
  const enrollment = await client.academicYearEnrollment.findFirst({ where: { id: input.sourceEnrollmentId, studentId: input.studentId } });
  if (!enrollment) throw new Error("The selected source enrollment no longer exists for this student");
  if (enrollment.academicYear !== input.academicYear) throw new Error("The decision academic year must match the source enrollment");
  return client.studentProgressionDecision.update({ where: { id }, data: { ...input, fromClass: enrollment.className, fromSection: enrollment.section, fromStatus: enrollment.status, toStatus: targetStatus(input.decisionType) }, include: progressionInclude });
}

export async function transitionProgressionDecision(client: ProgressionClient, id: string, action: "submit" | "approve" | "reject" | "cancel", userId: string, reason?: unknown) {
  const current = await client.studentProgressionDecision.findUnique({ where: { id } });
  if (!current) throw new Error("Progression decision not found");
  const now = new Date();
  if (action === "submit") {
    if (current.status !== "DRAFT") throw new Error("Only a draft decision can be submitted");
    const input = validateProgressionInput(current, { submitting: true });
    const enrollment = await client.academicYearEnrollment.findFirst({ where: { id: input.sourceEnrollmentId, studentId: input.studentId } });
    if (!enrollment || enrollment.className !== current.fromClass || enrollment.section !== current.fromSection || enrollment.status !== current.fromStatus) throw new Error("The source enrollment changed; review the draft before submission");
    return client.studentProgressionDecision.update({ where: { id }, data: { status: "PENDING_APPROVAL", submittedByUserId: userId, submittedAt: now }, include: progressionInclude });
  }
  if (action === "approve") {
    if (current.status !== "PENDING_APPROVAL") throw new Error("Only a pending decision can be approved");
    return client.studentProgressionDecision.update({ where: { id }, data: { status: "APPROVED", approvedByUserId: userId, approvedAt: now, rejectionReason: null }, include: progressionInclude });
  }
  const requiredReason = text(reason);
  if (!requiredReason) throw new Error(action === "reject" ? "Rejection reason is required" : "Cancellation reason is required");
  if (action === "reject") {
    if (current.status !== "PENDING_APPROVAL") throw new Error("Only a pending decision can be rejected");
    return client.studentProgressionDecision.update({ where: { id }, data: { status: "REJECTED", rejectionReason: requiredReason }, include: progressionInclude });
  }
  if (!["DRAFT", "PENDING_APPROVAL"].includes(current.status)) throw new Error("Only draft or pending decisions can be cancelled");
  return client.studentProgressionDecision.update({ where: { id }, data: { status: "CANCELLED", cancellationReason: requiredReason, cancelledByUserId: userId, cancelledAt: now }, include: progressionInclude });
}

export async function finalizeProgressionDecision(prisma: Pick<PrismaClient, "$transaction">, id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.studentProgressionDecision.findUnique({ where: { id } });
    if (!current) throw new Error("Progression decision not found");
    if (current.status !== "APPROVED") throw new Error("Only an approved decision can be finalized");
    if (current.decisionType === "CORRECTION") throw new Error("Correction finalization is intentionally unavailable; preserve it for documented review");
    const claimed = await tx.studentProgressionDecision.updateMany({
      where: { id, status: "APPROVED" },
      data: { status: "FINALIZED", finalizedByUserId: userId, finalizedAt: new Date() }
    });
    if (claimed.count !== 1) throw new Error("This decision is already being finalized or is no longer approved");
    const type = current.decisionType as Exclude<ProgressionDecisionType, "CORRECTION">;
    const source = current.sourceEnrollmentId ? await tx.academicYearEnrollment.findUnique({ where: { id: current.sourceEnrollmentId } }) : null;
    if (!source || source.studentId !== current.studentId) throw new Error("The source enrollment is unavailable; finalization stopped safely");
    if (source.status !== current.fromStatus || source.className !== current.fromClass || source.section !== current.fromSection) throw new Error("The source enrollment changed after approval; review the decision again");
    if (TARGET_ENROLLMENT_TYPES.has(type)) {
      if (!current.toAcademicYear || !current.toClass) throw new Error("Target academic year and class are required");
      const duplicate = await tx.academicYearEnrollment.findUnique({ where: { studentId_academicYear: { studentId: current.studentId, academicYear: current.toAcademicYear } } });
      if (duplicate) throw new Error("A target enrollment already exists for this student and academic year");
    }
    const terminal = TERMINAL_STATUS[type];
    await tx.academicYearEnrollment.update({ where: { id: source.id }, data: { status: terminal, exitDate: current.effectiveDate, exitReason: current.reason } });
    if (TARGET_ENROLLMENT_TYPES.has(type)) await tx.academicYearEnrollment.create({ data: { studentId: current.studentId, academicYear: current.toAcademicYear!, className: current.toClass!, section: current.toSection, status: "ACTIVE", enrollmentDate: current.effectiveDate, notes: `${decisionLabel(type)} from ${current.academicYear}` } });
    await tx.studentLifecycleEvent.create({ data: {
      studentId: current.studentId, academicYear: current.academicYear, eventType: terminal,
      fromClass: current.fromClass, fromSection: current.fromSection, fromStatus: current.fromStatus,
      toClass: current.toClass, toSection: current.toSection, toStatus: TARGET_ENROLLMENT_TYPES.has(type) ? "ACTIVE" : terminal,
      effectiveDate: current.effectiveDate, reason: current.reason, evidenceNotes: current.evidenceNotes,
      parentAcknowledgementNotes: current.parentAcknowledgementNotes, approvedByUserId: current.approvedByUserId, recordedByUserId: userId
    } });
    return tx.studentProgressionDecision.findUniqueOrThrow({ where: { id }, include: progressionInclude });
  });
}

export function friendlyProgressionError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Unable to update the progression decision";
}

export function progressionApiDecision<T extends Record<string, unknown>>(row: T) {
  const { studentId: _studentId, sourceEnrollmentId: _sourceEnrollmentId, createdByUserId: _createdByUserId, submittedByUserId: _submittedByUserId, approvedByUserId: _approvedByUserId, finalizedByUserId: _finalizedByUserId, cancelledByUserId: _cancelledByUserId, ...safe } = row;
  return safe;
}
