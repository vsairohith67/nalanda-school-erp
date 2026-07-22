import { Prisma, type PrismaClient } from "@prisma/client";
import { localDate } from "@/lib/expenses";

export const EXAM_TYPES = ["UNIT_TEST", "FORMATIVE", "SUMMATIVE", "TERM", "PRACTICAL", "OTHER"] as const;
export const EXAM_STATUSES = ["DRAFT", "OPEN_FOR_ENTRY", "ENTRY_CLOSED", "APPROVED", "LOCKED", "CANCELLED"] as const;
export const ASSESSMENT_TYPES = ["THEORY", "PRACTICAL", "ORAL", "PROJECT", "INTERNAL", "OTHER"] as const;
export const ASSESSMENT_STATUSES = ["DRAFT", "OPEN", "SUBMITTED", "APPROVED", "LOCKED", "CANCELLED"] as const;

export function normalizeExamCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(code)) throw new Error("Exam code must use 3-40 letters, numbers, or hyphens.");
  return code;
}

export function safeExamText(value: unknown, label: string, max: number, required = true) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  if (/[<>]/.test(text) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) throw new Error(`${label} must be plain text.`);
  return text || null;
}

export function examDecimal(value: unknown, label: string, options: { positive?: boolean; max?: Prisma.Decimal } = {}) {
  const raw = String(value ?? "").trim();
  if (!/^\d{1,6}(\.\d{1,4})?$/.test(raw)) throw new Error(`${label} must be a non-negative number with at most four decimal places.`);
  const decimal = new Prisma.Decimal(raw);
  if (options.positive && decimal.lte(0)) throw new Error(`${label} must be greater than zero.`);
  if (options.max && decimal.gt(options.max)) throw new Error(`${label} cannot exceed ${options.max.toString()}.`);
  return decimal;
}

export function validateExamInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Exam details are required.");
  const row = input as Record<string, unknown>;
  const academicYear = String(row.academicYear ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(academicYear)) throw new Error("Academic year must use YYYY-YY.");
  const examType = String(row.examType ?? "").toUpperCase();
  if (!(EXAM_TYPES as readonly string[]).includes(examType)) throw new Error("Choose a valid exam type.");
  const startDate = localDate(row.startDate, "Start date");
  const endDate = localDate(row.endDate, "End date");
  if (endDate < startDate) throw new Error("End date cannot precede start date.");
  return {
    examCode: normalizeExamCode(row.examCode), academicYear,
    name: safeExamText(row.name, "Exam name", 160)!, examType,
    startDate, endDate,
    description: safeExamText(row.description, "Description", 2_000, false)
  };
}

export function validateAssessmentInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Assessment details are required.");
  const row = input as Record<string, unknown>;
  const academicYear = String(row.academicYear ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(academicYear)) throw new Error("Academic year must use YYYY-YY.");
  const assessmentType = String(row.assessmentType ?? "").toUpperCase();
  if (!(ASSESSMENT_TYPES as readonly string[]).includes(assessmentType)) throw new Error("Choose a valid assessment type.");
  const maxMarks = examDecimal(row.maxMarks, "Maximum marks", { positive: true });
  const passMarks = String(row.passMarks ?? "").trim() ? examDecimal(row.passMarks, "Pass marks", { max: maxMarks }) : null;
  const weightagePercent = String(row.weightagePercent ?? "").trim() ? examDecimal(row.weightagePercent, "Weightage", { max: new Prisma.Decimal(100) }) : null;
  return {
    academicYear,
    className: safeExamText(row.className, "Class", 40)!,
    section: String(row.section ?? "").trim().toUpperCase(),
    subjectName: safeExamText(row.subjectName, "Subject", 120)!,
    timetableSubjectId: String(row.timetableSubjectId ?? "").trim() || null,
    componentName: String(safeExamText(row.componentName, "Component", 80, false) ?? ""),
    assessmentType, maxMarks, passMarks, weightagePercent,
    instructions: safeExamText(row.instructions, "Instructions", 2_000, false)
  };
}

export function parseExpectedVersion(value: unknown, label = "record") {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) throw new Error(`Reload the ${label} before performing this action.`);
  return date;
}

export async function createExam(prisma: PrismaClient, input: unknown, actorUserId: string) {
  const data = validateExamInput(input);
  return prisma.examCycle.create({ data: { ...data, createdByUserId: actorUserId } });
}

export async function updateExamDraft(prisma: PrismaClient, id: string, input: unknown, expectedUpdatedAt: Date) {
  const data = validateExamInput(input);
  const changed = await prisma.examCycle.updateMany({ where: { id, status: "DRAFT", updatedAt: expectedUpdatedAt }, data });
  if (changed.count !== 1) throw new Error("Only the current draft exam can be edited. Reload and try again.");
  return prisma.examCycle.findUniqueOrThrow({ where: { id } });
}

export async function createAssessment(prisma: PrismaClient, examCycleId: string, input: unknown, actorUserId: string) {
  const data = validateAssessmentInput(input);
  return prisma.$transaction(async (tx) => {
    const exam = await tx.examCycle.findUnique({ where: { id: examCycleId } });
    if (!exam || exam.status !== "DRAFT") throw new Error("Assessments can be configured only while the exam is a draft.");
    if (data.academicYear !== exam.academicYear) throw new Error("Assessment academic year must match the exam.");
    if (data.timetableSubjectId) {
      const subject = await tx.timetableSubject.findFirst({ where: { id: data.timetableSubjectId, isActive: true } });
      if (!subject || subject.name.toLowerCase() !== data.subjectName.toLowerCase()) throw new Error("Choose an active matching timetable subject.");
    }
    return tx.examAssessment.create({ data: { ...data, examCycleId, createdByUserId: actorUserId } });
  });
}

export async function updateAssessmentDraft(prisma: PrismaClient, id: string, input: unknown, expectedUpdatedAt: Date) {
  const data = validateAssessmentInput(input);
  return prisma.$transaction(async (tx) => {
    const current = await tx.examAssessment.findUnique({ where: { id }, include: { examCycle: true } });
    if (!current || current.entryStatus !== "DRAFT" || current.examCycle.status !== "DRAFT") throw new Error("Only a draft assessment in a draft exam can be edited.");
    if (data.academicYear !== current.examCycle.academicYear) throw new Error("Assessment academic year must match the exam.");
    const changed = await tx.examAssessment.updateMany({ where: { id, entryStatus: "DRAFT", updatedAt: expectedUpdatedAt }, data });
    if (changed.count !== 1) throw new Error("This assessment changed in another session. Reload it before saving.");
    return tx.examAssessment.findUniqueOrThrow({ where: { id } });
  });
}

export async function transitionExam(
  prisma: PrismaClient, id: string, action: "open" | "close" | "approve" | "lock" | "cancel",
  expectedUpdatedAt: Date, actorUserId: string, reasonValue?: unknown, now = new Date()
) {
  return prisma.$transaction(async (tx) => {
    const exam = await tx.examCycle.findUnique({ where: { id }, include: { assessments: { select: { id: true, entryStatus: true } } } });
    if (!exam) throw new Error("Exam was not found.");
    const idempotent: Record<string, string> = { open: "OPEN_FOR_ENTRY", close: "ENTRY_CLOSED", approve: "APPROVED", lock: "LOCKED", cancel: "CANCELLED" };
    if (exam.status === idempotent[action]) {
      return tx.examCycle.findUniqueOrThrow({ where: { id }, include: { assessments: true } });
    }
    const next: Record<typeof action, { from: string; to: string }> = {
      open: { from: "DRAFT", to: "OPEN_FOR_ENTRY" }, close: { from: "OPEN_FOR_ENTRY", to: "ENTRY_CLOSED" },
      approve: { from: "ENTRY_CLOSED", to: "APPROVED" }, lock: { from: "APPROVED", to: "LOCKED" },
      cancel: { from: exam.status, to: "CANCELLED" }
    };
    if (action === "cancel" && exam.status === "LOCKED") throw new Error("A locked exam is immutable and cannot be cancelled.");
    if (action !== "cancel" && exam.status !== next[action].from) throw new Error(`Exam cannot ${action} from ${exam.status}.`);
    if (action === "open" && exam.assessments.length === 0) throw new Error("Add at least one assessment before opening marks entry.");
    if (action === "close" && exam.assessments.some((row) => !["SUBMITTED", "CANCELLED"].includes(row.entryStatus))) throw new Error("Every active assessment must be submitted before entry can close.");
    if (action === "approve" && exam.assessments.some((row) => !["APPROVED", "CANCELLED"].includes(row.entryStatus))) throw new Error("Every active assessment must be approved before the exam can be approved.");
    if (action === "lock" && exam.assessments.some((row) => !["LOCKED", "CANCELLED"].includes(row.entryStatus))) throw new Error("Every active assessment must be locked before the exam can be locked.");
    const reason = action === "cancel" ? safeExamText(reasonValue, "Cancellation reason", 1_000)! : null;
    const data: Record<string, unknown> = { status: next[action].to };
    if (action === "open") Object.assign(data, { openedAt: now, openedByUserId: actorUserId });
    if (action === "close") Object.assign(data, { closedAt: now, closedByUserId: actorUserId });
    if (action === "approve") Object.assign(data, { approvedAt: now, approvedByUserId: actorUserId });
    if (action === "lock") Object.assign(data, { lockedAt: now, lockedByUserId: actorUserId });
    if (action === "cancel") Object.assign(data, { cancelledAt: now, cancelledByUserId: actorUserId, cancellationReason: reason });
    const changed = await tx.examCycle.updateMany({ where: { id, status: exam.status, updatedAt: expectedUpdatedAt }, data });
    if (changed.count !== 1) throw new Error("This exam changed in another session. Reload it before continuing.");
    if (action === "open") await tx.examAssessment.updateMany({ where: { examCycleId: id, entryStatus: "DRAFT" }, data: { entryStatus: "OPEN" } });
    return tx.examCycle.findUniqueOrThrow({ where: { id }, include: { assessments: true } });
  });
}

export function publicExam(row: any) {
  return {
    id: row.id, examCode: row.examCode, academicYear: row.academicYear, name: row.name, examType: row.examType,
    startDate: new Date(row.startDate).toISOString().slice(0, 10), endDate: new Date(row.endDate).toISOString().slice(0, 10),
    status: row.status, description: row.description, cancellationReason: row.cancellationReason,
    openedAt: row.openedAt, closedAt: row.closedAt, approvedAt: row.approvedAt, lockedAt: row.lockedAt, cancelledAt: row.cancelledAt,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    assessments: row.assessments?.map(publicAssessment)
  };
}

export function publicAssessment(row: any) {
  return {
    id: row.id, examCycleId: row.examCycleId, academicYear: row.academicYear, className: row.className,
    section: row.section || null, subjectName: row.subjectName, componentName: row.componentName || null,
    assessmentType: row.assessmentType, maxMarks: row.maxMarks.toString(), passMarks: row.passMarks?.toString() ?? null,
    weightagePercent: row.weightagePercent?.toString() ?? null, entryStatus: row.entryStatus, instructions: row.instructions,
    submittedAt: row.submittedAt, approvedAt: row.approvedAt, lockedAt: row.lockedAt, createdAt: row.createdAt, updatedAt: row.updatedAt
  };
}
