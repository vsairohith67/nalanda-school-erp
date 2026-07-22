import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { CLASS_NAMES, normalizeClassName } from "@/lib/constants";
import { localDate } from "@/lib/expenses";
import { schoolDateKey } from "@/lib/format";

export const HOMEWORK_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED", "CANCELLED"] as const;
export const HOMEWORK_PRIORITIES = ["NORMAL", "IMPORTANT"] as const;
export const HOMEWORK_EVENT_TYPES = ["CREATED", "UPDATED_DRAFT", "PUBLISHED", "CORRECTED", "ARCHIVED", "CANCELLED"] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUSES)[number];
export type HomeworkPriority = (typeof HOMEWORK_PRIORITIES)[number];

export type HomeworkInput = {
  academicYear: string;
  title: string;
  instructions: string;
  className: string;
  section: string | null;
  subjectName: string;
  assignedDate: Date;
  dueDate: Date | null;
  priority: HomeworkPriority;
  resourceLink: string | null;
  teacherNotes: string | null;
  publicNotes: string | null;
};

type HomeworkTransactionClient = Pick<Prisma.TransactionClient, "homeworkAssignment" | "homeworkAssignmentEvent">;

export function normalizeAssignmentNumber(value: unknown) {
  const result = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9-]{3,39}$/.test(result)) throw new Error("Assignment number must use 4-40 letters, numbers, or hyphens.");
  return result;
}

export function newHomeworkAssignmentNumber(now = new Date()) {
  const key = schoolDateKey(now).replaceAll("-", "");
  return `HW-${key}-${randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
}

export function validateHomeworkInput(input: unknown): HomeworkInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Homework details are required.");
  const row = input as Record<string, unknown>;
  const academicYear = safeText(row.academicYear, "Academic year", 20);
  if (!/^\d{4}-\d{2}$/.test(academicYear)) throw new Error("Academic year must use YYYY-YY.");
  const className = normalizeClassName(safeText(row.className, "Class", 30));
  if (!CLASS_NAMES.includes(className as never)) throw new Error("Choose a valid class.");
  const section = optionalSafeText(row.section, "Section", 20)?.toUpperCase() ?? null;
  const assignedDate = localDate(row.assignedDate, "Assigned date");
  const dueDate = row.dueDate ? localDate(row.dueDate, "Due date") : null;
  if (dueDate && dueDate < assignedDate) throw new Error("Due date cannot be before assigned date.");
  const priority = String(row.priority ?? "NORMAL").toUpperCase() as HomeworkPriority;
  if (!HOMEWORK_PRIORITIES.includes(priority)) throw new Error("Choose a valid homework priority.");
  return {
    academicYear,
    title: safeText(row.title, "Title", 180),
    instructions: safeText(row.instructions, "Instructions", 10_000),
    className,
    section,
    subjectName: safeText(row.subjectName, "Subject", 120),
    assignedDate,
    dueDate,
    priority,
    resourceLink: safeResourceLink(row.resourceLink),
    teacherNotes: optionalSafeText(row.teacherNotes, "Teacher notes", 4_000),
    publicNotes: optionalSafeText(row.publicNotes, "Public notes", 4_000)
  };
}

export function safeResourceLink(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > 2_048) throw new Error("Resource link is too long.");
  let url: URL;
  try { url = new URL(text); } catch { throw new Error("Resource link must be a valid HTTP or HTTPS URL."); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("Resource link must be a safe HTTP or HTTPS URL without embedded credentials.");
  }
  return url.toString();
}

export async function createHomeworkAssignment(
  prisma: PrismaClient,
  input: HomeworkInput & { timetableSubjectId?: string | null; assignmentNumber?: string },
  actorUserId: string,
  publish = false,
  now = new Date()
) {
  const assignmentNumber = input.assignmentNumber ? normalizeAssignmentNumber(input.assignmentNumber) : newHomeworkAssignmentNumber(now);
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.homeworkAssignment.create({
      data: {
        assignmentNumber,
        academicYear: input.academicYear,
        title: input.title,
        instructions: input.instructions,
        className: input.className,
        section: input.section,
        subjectName: input.subjectName,
        timetableSubjectId: input.timetableSubjectId ?? null,
        assignedDate: input.assignedDate,
        dueDate: input.dueDate,
        status: publish ? "PUBLISHED" : "DRAFT",
        priority: input.priority,
        resourceLink: input.resourceLink,
        teacherNotes: input.teacherNotes,
        publicNotes: input.publicNotes,
        createdByUserId: actorUserId,
        publishedByUserId: publish ? actorUserId : null,
        publishedAt: publish ? now : null
      }
    });
    await appendHomeworkEvent(tx, assignment.id, "CREATED", actorUserId, now);
    if (publish) await appendHomeworkEvent(tx, assignment.id, "PUBLISHED", actorUserId, now);
    return assignment;
  });
}

export async function updateHomeworkDraft(
  prisma: PrismaClient,
  assignmentNumber: string,
  input: HomeworkInput & { timetableSubjectId?: string | null },
  expectedUpdatedAt: Date,
  actorUserId: string,
  now = new Date()
) {
  return prisma.$transaction(async (tx) => {
    const assignment = await requireAssignment(tx, assignmentNumber);
    if (assignment.status !== "DRAFT") throw new Error("Only draft homework can be edited. Published history must use an audited correction.");
    const changed = await tx.homeworkAssignment.updateMany({
      where: { id: assignment.id, status: "DRAFT", updatedAt: expectedUpdatedAt },
      data: { ...input, timetableSubjectId: input.timetableSubjectId ?? null }
    });
    if (changed.count !== 1) throw new Error("This homework changed in another session. Reload it before saving.");
    await appendHomeworkEvent(tx, assignment.id, "UPDATED_DRAFT", actorUserId, now);
    return tx.homeworkAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  });
}

export async function publishHomework(
  prisma: PrismaClient,
  assignmentNumber: string,
  expectedUpdatedAt: Date,
  actorUserId: string,
  now = new Date()
) {
  return prisma.$transaction(async (tx) => {
    const assignment = await requireAssignment(tx, assignmentNumber);
    if (assignment.status === "PUBLISHED") return assignment;
    if (assignment.status !== "DRAFT") throw new Error("Only draft homework can be published.");
    const changed = await tx.homeworkAssignment.updateMany({ where: { id: assignment.id, status: "DRAFT", updatedAt: expectedUpdatedAt }, data: { status: "PUBLISHED", publishedAt: now, publishedByUserId: actorUserId } });
    if (changed.count !== 1) throw new Error("This homework changed in another session. Reload it before publishing.");
    await appendHomeworkEvent(tx, assignment.id, "PUBLISHED", actorUserId, now);
    return tx.homeworkAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  });
}

export async function correctPublishedHomework(
  prisma: PrismaClient,
  assignmentNumber: string,
  input: HomeworkInput,
  reasonValue: unknown,
  expectedUpdatedAt: Date,
  actorUserId: string,
  now = new Date()
) {
  const reason = safeText(reasonValue, "Correction reason", 1_000);
  return prisma.$transaction(async (tx) => {
    const assignment = await requireAssignment(tx, assignmentNumber);
    if (assignment.status !== "PUBLISHED") throw new Error("Only published homework can use an audited correction.");
    if (assignment.academicYear !== input.academicYear || assignment.className !== input.className || (assignment.section ?? null) !== input.section || assignment.subjectName.toLowerCase() !== input.subjectName.toLowerCase()) {
      throw new Error("A published homework audience cannot be moved. Create a new assignment for another class, section, subject, or year.");
    }
    const previousPublicSnapshot = {
      title: assignment.title,
      instructions: assignment.instructions,
      dueDate: assignment.dueDate,
      notes: JSON.stringify({ assignedDate: assignment.assignedDate.toISOString().slice(0, 10), priority: assignment.priority, publicNotes: assignment.publicNotes, resourceLink: assignment.resourceLink })
    };
    const changed = await tx.homeworkAssignment.updateMany({
      where: { id: assignment.id, status: "PUBLISHED", updatedAt: expectedUpdatedAt },
      data: { title: input.title, instructions: input.instructions, assignedDate: input.assignedDate, dueDate: input.dueDate, priority: input.priority, resourceLink: input.resourceLink, publicNotes: input.publicNotes, teacherNotes: input.teacherNotes, correctionReason: reason }
    });
    if (changed.count !== 1) throw new Error("This homework changed in another session. Reload it before correcting.");
    await appendHomeworkEvent(tx, assignment.id, "CORRECTED", actorUserId, now, {
      titleSnapshot: previousPublicSnapshot.title,
      instructionsSnapshot: previousPublicSnapshot.instructions,
      dueDateSnapshot: previousPublicSnapshot.dueDate,
      reason,
      notes: previousPublicSnapshot.notes
    });
    return tx.homeworkAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  });
}

export async function archiveHomework(prisma: PrismaClient, assignmentNumber: string, expectedUpdatedAt: Date, actorUserId: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const assignment = await requireAssignment(tx, assignmentNumber);
    if (assignment.status === "ARCHIVED") return assignment;
    if (!["PUBLISHED", "CANCELLED"].includes(assignment.status)) throw new Error("Only published or cancelled homework can be archived.");
    const changed = await tx.homeworkAssignment.updateMany({ where: { id: assignment.id, status: assignment.status, updatedAt: expectedUpdatedAt }, data: { status: "ARCHIVED", archivedAt: now, archivedByUserId: actorUserId } });
    if (changed.count !== 1) throw new Error("This homework changed in another session. Reload it before archiving.");
    await appendHomeworkEvent(tx, assignment.id, "ARCHIVED", actorUserId, now);
    return tx.homeworkAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  });
}

export async function cancelHomework(prisma: PrismaClient, assignmentNumber: string, reasonValue: unknown, expectedUpdatedAt: Date, actorUserId: string, now = new Date()) {
  const reason = safeText(reasonValue, "Cancellation reason", 1_000);
  return prisma.$transaction(async (tx) => {
    const assignment = await requireAssignment(tx, assignmentNumber);
    if (assignment.status === "CANCELLED") return assignment;
    if (!["DRAFT", "PUBLISHED"].includes(assignment.status)) throw new Error("This homework cannot be cancelled from its current status.");
    const changed = await tx.homeworkAssignment.updateMany({ where: { id: assignment.id, status: assignment.status, updatedAt: expectedUpdatedAt }, data: { status: "CANCELLED", cancellationReason: reason, cancelledAt: now, cancelledByUserId: actorUserId } });
    if (changed.count !== 1) throw new Error("This homework changed in another session. Reload it before cancelling.");
    await appendHomeworkEvent(tx, assignment.id, "CANCELLED", actorUserId, now, { reason });
    return tx.homeworkAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
  });
}

export function serializeHomework(row: any, options: { includeInternal?: boolean; includeEvents?: boolean; masked?: boolean } = {}) {
  const result: Record<string, unknown> = {
    assignmentNumber: options.masked ? "Masked" : row.assignmentNumber,
    academicYear: row.academicYear,
    title: row.title,
    instructions: row.instructions,
    className: row.className,
    section: row.section,
    subjectName: row.subjectName,
    assignedDate: dateKey(row.assignedDate),
    dueDate: row.dueDate ? dateKey(row.dueDate) : null,
    status: row.status,
    priority: row.priority,
    resourceLink: row.resourceLink,
    publicNotes: row.publicNotes,
    publishedAt: row.publishedAt?.toISOString?.() ?? row.publishedAt ?? null,
    archivedAt: row.archivedAt?.toISOString?.() ?? row.archivedAt ?? null,
    cancelledAt: row.cancelledAt?.toISOString?.() ?? row.cancelledAt ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt
  };
  if (options.includeInternal) {
    result.teacherNotes = row.teacherNotes;
    result.correctionReason = row.correctionReason;
    result.cancellationReason = row.cancellationReason;
    result.creatorLabel = options.masked ? "Staff" : row.createdBy?.name ?? "Staff";
  }
  if (options.includeEvents) result.events = (row.events ?? []).map((event: any) => ({ eventType: event.eventType, eventDate: event.eventDate, titleSnapshot: event.titleSnapshot, instructionsSnapshot: event.instructionsSnapshot, dueDateSnapshot: event.dueDateSnapshot ? dateKey(event.dueDateSnapshot) : null, reason: event.reason, notes: event.notes, actorLabel: options.masked ? "Staff" : event.recordedBy?.name ?? "Staff" }));
  return result;
}

export function parseExpectedUpdatedAt(value: unknown) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) throw new Error("Reload the homework before performing this action.");
  return date;
}

function dateKey(value: Date | string) { return new Date(value).toISOString().slice(0, 10); }

async function requireAssignment(tx: HomeworkTransactionClient, assignmentNumber: string) {
  const normalized = normalizeAssignmentNumber(assignmentNumber);
  const assignment = await tx.homeworkAssignment.findUnique({ where: { assignmentNumber: normalized } });
  if (!assignment) throw new Error("Homework assignment was not found.");
  return assignment;
}

async function appendHomeworkEvent(tx: HomeworkTransactionClient, assignmentId: string, eventType: string, actorUserId: string, eventDate: Date, extra: Record<string, unknown> = {}) {
  return tx.homeworkAssignmentEvent.create({ data: { assignmentId, eventType, eventDate, recordedByUserId: actorUserId, ...extra } as never });
}

function safeText(value: unknown, label: string, max: number) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  return validatePlainText(text, label, max);
}

function optionalSafeText(value: unknown, label: string, max: number) {
  const text = String(value ?? "").trim();
  return text ? validatePlainText(text, label, max) : null;
}

function validatePlainText(text: string, label: string, max: number) {
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  if (/[<>]/.test(text) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) throw new Error(`${label} must be plain text without HTML or control characters.`);
  return text;
}
