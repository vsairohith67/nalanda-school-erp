import type { PrismaClient } from "@prisma/client";
import { schoolDateKey } from "@/lib/format";
import { CONTACT_CATEGORIES, CONTACT_STATUSES, DIARY_CATEGORIES, DIARY_STATUSES, SUPER_ADMIN_WORK_LIMITS, TASK_STATUSES, WORK_MODULES, WORK_PRIORITIES, type ContactView, type DiaryView, type SuperAdminWorkActor, type SuperAdminWorkSnapshot, type SuperAdminWorkSummary, type TaskBucket, type TaskView } from "@/lib/super-admin-work-types";

export type { SuperAdminWorkActor, SuperAdminWorkSnapshot, SuperAdminWorkSummary } from "@/lib/super-admin-work-types";

export class SuperAdminWorkError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "SUPER_ADMIN_WORK_INVALID") {
    super(message);
  }
}

export function assertSuperAdminWorkActor(actor: SuperAdminWorkActor) {
  if (actor.role !== "SUPER_ADMIN") throw new SuperAdminWorkError("This private work programme is available only to the exact Super Admin role.", 403, "SUPER_ADMIN_WORK_DENIED");
}

export async function listSuperAdminWork(client: PrismaClient, actor: SuperAdminWorkActor): Promise<SuperAdminWorkSnapshot> {
  assertSuperAdminWorkActor(actor);
  const [diary, tasks, contacts] = await Promise.all([
    client.superAdminDiaryEntry.findMany({ where: { ownerUserId: actor.id }, orderBy: [{ entryDate: "desc" }, { updatedAt: "desc" }], take: SUPER_ADMIN_WORK_LIMITS.diary }),
    client.superAdminTask.findMany({ where: { ownerUserId: actor.id }, orderBy: [{ dueDate: "asc" }, { dueTime: "asc" }, { createdAt: "desc" }], take: SUPER_ADMIN_WORK_LIMITS.tasks }),
    client.superAdminContact.findMany({ where: { ownerUserId: actor.id }, orderBy: [{ preferred: "desc" }, { name: "asc" }], take: SUPER_ADMIN_WORK_LIMITS.contacts })
  ]);
  const generatedAt = new Date();
  return { generatedAt: generatedAt.toISOString(), todayKey: schoolDateKey(generatedAt), bounded: SUPER_ADMIN_WORK_LIMITS, diary: diary.map(diaryView), tasks: tasks.map(taskView), contacts: contacts.map(contactView) };
}

export async function summarizeSuperAdminWork(client: PrismaClient, actor: SuperAdminWorkActor, now = new Date()): Promise<SuperAdminWorkSummary> {
  assertSuperAdminWorkActor(actor);
  const todayKey = schoolDateKey(now);
  const { start, end } = schoolDayRange(todayKey);
  const reminderHorizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const activeTaskStatuses = ["TO_DO", "IN_PROGRESS", "WAITING"];
  const [todayTasks, overdueTasks, upcomingReminders, diaryFollowUps, contactFollowUps, activeContacts, preferredContacts, recentDiary, reminderItems] = await Promise.all([
    client.superAdminTask.count({ where: { ownerUserId: actor.id, status: { in: activeTaskStatuses }, dueDate: { gte: start, lt: end } } }),
    client.superAdminTask.count({ where: { ownerUserId: actor.id, status: { in: activeTaskStatuses }, dueDate: { lt: start } } }),
    client.superAdminTask.count({ where: { ownerUserId: actor.id, status: { in: activeTaskStatuses }, reminderAt: { gte: now, lte: reminderHorizon } } }),
    client.superAdminDiaryEntry.count({ where: { ownerUserId: actor.id, status: { not: "CLOSED" }, followUpDate: { lt: end } } }),
    client.superAdminContact.count({ where: { ownerUserId: actor.id, status: "ACTIVE", nextFollowUpDate: { lt: end } } }),
    client.superAdminContact.count({ where: { ownerUserId: actor.id, status: "ACTIVE" } }),
    client.superAdminContact.count({ where: { ownerUserId: actor.id, status: "ACTIVE", preferred: true } }),
    client.superAdminDiaryEntry.findMany({ where: { ownerUserId: actor.id }, select: { title: true, entryDate: true, status: true }, orderBy: [{ entryDate: "desc" }, { updatedAt: "desc" }], take: SUPER_ADMIN_WORK_LIMITS.commandItems }),
    client.superAdminTask.findMany({ where: { ownerUserId: actor.id, status: { in: activeTaskStatuses }, reminderAt: { gte: now, lte: reminderHorizon } }, select: { title: true, reminderAt: true }, orderBy: { reminderAt: "asc" }, take: SUPER_ADMIN_WORK_LIMITS.commandItems })
  ]);
  return {
    todayTasks,
    overdueTasks,
    upcomingReminders,
    followUpsDue: diaryFollowUps + contactFollowUps,
    activeContacts,
    preferredContacts,
    recentDiary: recentDiary.map((row) => ({ title: bounded(row.title, "Diary entry", 120), date: schoolDateKey(row.entryDate), status: row.status })),
    reminderItems: reminderItems.flatMap((row) => row.reminderAt ? [{ title: bounded(row.title, "Task reminder", 120), at: row.reminderAt.toISOString() }] : [])
  };
}

export async function createDiaryEntry(client: PrismaClient, actor: SuperAdminWorkActor, input: unknown) {
  assertSuperAdminWorkActor(actor);
  const data = diaryInput(input);
  return client.$transaction(async (tx) => {
    const row = await tx.superAdminDiaryEntry.create({ data: { ownerUserId: actor.id, ...data, closedAt: data.status === "CLOSED" ? new Date() : null } });
    await audit(tx, actor.id, "DIARY", row.publicKey, "DIARY_CREATED", null, row.status, { category: row.category, priority: row.priority, hasFollowUp: Boolean(row.followUpDate) });
    return diaryView(row);
  });
}

export async function updateDiaryEntry(client: PrismaClient, actor: SuperAdminWorkActor, publicKey: unknown, input: unknown) {
  assertSuperAdminWorkActor(actor);
  const key = bounded(publicKey, "Diary reference", 80);
  const data = diaryInput(input);
  return client.$transaction(async (tx) => {
    const current = await tx.superAdminDiaryEntry.findFirst({ where: { publicKey: key, ownerUserId: actor.id } });
    if (!current) throw new SuperAdminWorkError("Diary entry was not found.", 404, "DIARY_NOT_FOUND");
    const row = await tx.superAdminDiaryEntry.update({ where: { id: current.id }, data: { ...data, closedAt: data.status === "CLOSED" ? current.closedAt ?? new Date() : null } });
    const eventType = current.status !== row.status ? row.status === "CLOSED" ? "DIARY_CLOSED" : current.status === "CLOSED" ? "DIARY_REOPENED" : "DIARY_STATUS_CHANGED" : "DIARY_UPDATED";
    await audit(tx, actor.id, "DIARY", row.publicKey, eventType, current.status, row.status, { category: row.category, priority: row.priority, hasFollowUp: Boolean(row.followUpDate) });
    return diaryView(row);
  });
}

export async function createTask(client: PrismaClient, actor: SuperAdminWorkActor, input: unknown) {
  assertSuperAdminWorkActor(actor);
  const data = taskInput(input);
  return client.$transaction(async (tx) => {
    const row = await tx.superAdminTask.create({ data: { ownerUserId: actor.id, ...data, completedAt: data.status === "DONE" ? new Date() : null } });
    await audit(tx, actor.id, "TASK", row.publicKey, "TASK_CREATED", null, row.status, { category: row.category, priority: row.priority, hasReminder: Boolean(row.reminderAt), hasSafeLink: Boolean(row.linkedModule) });
    return taskView(row);
  });
}

export async function updateTask(client: PrismaClient, actor: SuperAdminWorkActor, publicKey: unknown, input: unknown) {
  assertSuperAdminWorkActor(actor);
  const key = bounded(publicKey, "Task reference", 80);
  const data = taskInput(input);
  return client.$transaction(async (tx) => {
    const current = await tx.superAdminTask.findFirst({ where: { publicKey: key, ownerUserId: actor.id } });
    if (!current) throw new SuperAdminWorkError("Task was not found.", 404, "TASK_NOT_FOUND");
    const row = await tx.superAdminTask.update({ where: { id: current.id }, data: { ...data, completedAt: data.status === "DONE" ? current.completedAt ?? new Date() : null } });
    const eventType = taskEventType(current.status, row.status);
    await audit(tx, actor.id, "TASK", row.publicKey, eventType, current.status, row.status, { category: row.category, priority: row.priority, hasReminder: Boolean(row.reminderAt), hasSafeLink: Boolean(row.linkedModule) });
    return taskView(row);
  });
}

export async function createContact(client: PrismaClient, actor: SuperAdminWorkActor, input: unknown) {
  assertSuperAdminWorkActor(actor);
  const data = contactInput(input);
  return client.$transaction(async (tx) => {
    const row = await tx.superAdminContact.create({ data: { ownerUserId: actor.id, ...data } });
    await audit(tx, actor.id, "CONTACT", row.publicKey, "CONTACT_CREATED", null, row.status, { category: row.category, preferred: row.preferred, tagCount: safeTags(row.tagsJson).length });
    return contactView(row);
  });
}

export async function updateContact(client: PrismaClient, actor: SuperAdminWorkActor, publicKey: unknown, input: unknown) {
  assertSuperAdminWorkActor(actor);
  const key = bounded(publicKey, "Contact reference", 80);
  const data = contactInput(input);
  return client.$transaction(async (tx) => {
    const current = await tx.superAdminContact.findFirst({ where: { publicKey: key, ownerUserId: actor.id } });
    if (!current) throw new SuperAdminWorkError("Contact was not found.", 404, "CONTACT_NOT_FOUND");
    const row = await tx.superAdminContact.update({ where: { id: current.id }, data });
    await audit(tx, actor.id, "CONTACT", row.publicKey, "CONTACT_UPDATED", current.status, row.status, { category: row.category, preferred: row.preferred, tagCount: safeTags(row.tagsJson).length });
    return contactView(row);
  });
}

export function taskBucket(task: Pick<TaskView, "status" | "dueDate">, now = new Date()): TaskBucket {
  if (completedStatus(task.status)) return "COMPLETED";
  const today = schoolDateKey(now);
  if (task.dueDate === today) return "TODAY";
  return task.dueDate < today ? "OVERDUE" : "UPCOMING";
}

function diaryInput(input: unknown) {
  const value = record(input);
  return {
    title: bounded(value.title, "Title", 160),
    entryDate: dateOnly(value.entryDate, "Diary date"),
    notesFormat: "PLAIN_STRUCTURED" as const,
    notes: bounded(value.notes, "Notes", 12_000),
    category: oneOf(value.category, DIARY_CATEGORIES, "Diary category"),
    contextModule: optionalOneOf(value.contextModule, WORK_MODULES, "Context module"),
    contextReference: optional(value.contextReference, "Context reference", 160),
    status: oneOf(value.status ?? "OPEN", DIARY_STATUSES, "Diary status"),
    priority: oneOf(value.priority ?? "NORMAL", WORK_PRIORITIES, "Priority"),
    followUpDate: optionalDateOnly(value.followUpDate, "Follow-up date")
  };
}

function taskInput(input: unknown) {
  const value = record(input);
  const dueDate = dateOnly(value.dueDate, "Due date");
  const dueTime = optionalTime(value.dueTime);
  const reminderAt = optionalLocalDateTime(value.reminderAt, "Reminder time");
  const linkedModule = optionalOneOf(value.linkedModule, WORK_MODULES, "Linked module");
  const linkedEntityType = optional(value.linkedEntityType, "Linked entity type", 80);
  const linkedEntityReference = optional(value.linkedEntityReference, "Linked entity reference", 160);
  if (!linkedModule && (linkedEntityType || linkedEntityReference)) throw new SuperAdminWorkError("Choose a linked module before adding an entity reference.");
  if (reminderAt && reminderAt.getTime() >= dueDate.getTime() + 24 * 60 * 60 * 1_000) throw new SuperAdminWorkError("Reminder time must be on or before the end of the due date.");
  return {
    title: bounded(value.title, "Title", 160),
    description: optional(value.description, "Description", 8_000),
    status: oneOf(value.status ?? "TO_DO", TASK_STATUSES, "Task status"),
    priority: oneOf(value.priority ?? "NORMAL", WORK_PRIORITIES, "Priority"),
    dueDate,
    dueTime,
    reminderAt,
    category: oneOf(value.category ?? "PERSONAL_WORK", DIARY_CATEGORIES, "Task category"),
    linkedModule,
    linkedEntityType,
    linkedEntityReference
  };
}

function contactInput(input: unknown) {
  const value = record(input);
  const data = {
    name: bounded(value.name, "Person or company name", 160),
    contactPerson: optional(value.contactPerson, "Contact person", 120),
    category: oneOf(value.category, CONTACT_CATEGORIES, "Contact category"),
    phone: optionalPhone(value.phone, "Phone"),
    alternatePhone: optionalPhone(value.alternatePhone, "Alternate phone"),
    email: optionalEmail(value.email),
    address: optional(value.address, "Address", 800),
    website: optionalWebsite(value.website),
    notes: optional(value.notes, "Notes", 4_000),
    status: oneOf(value.status ?? "ACTIVE", CONTACT_STATUSES, "Contact status"),
    preferred: value.preferred === true,
    tagsJson: JSON.stringify(tags(value.tags)),
    lastContactDate: optionalDateOnly(value.lastContactDate, "Last-contact date"),
    nextFollowUpDate: optionalDateOnly(value.nextFollowUpDate, "Next follow-up date")
  };
  const secretScan = Object.values(data).filter((value) => typeof value === "string").join(" ");
  if (/(?:\bOTP\b|\bCVV\b|banking\s+password|account\s+password|card\s+(?:number|details)|\bPIN\b|login\s+credential|\b(?:aadhaar|aadhar)\b|government\s+id|\bPAN\s+(?:number|card)\b)/i.test(secretScan)) {
    throw new SuperAdminWorkError("Do not store card details, government IDs, passwords, OTPs, PINs or login credentials in the directory.", 400, "CONTACT_SECRET_REFUSED");
  }
  if (!data.phone && !data.email && !data.website && !data.address) throw new SuperAdminWorkError("Add at least one contact method or address.");
  return data;
}

type AuditClient = Pick<PrismaClient, "superAdminWorkAudit">;
async function audit(client: AuditClient, ownerUserId: string, entityType: string, entityPublicKey: string, eventType: string, previousStatus: string | null, newStatus: string | null, safeMetadata: Record<string, unknown>) {
  await client.superAdminWorkAudit.create({ data: { ownerUserId, actorUserId: ownerUserId, entityType, entityPublicKey, eventType, previousStatus, newStatus, safeMetadataJson: JSON.stringify(safeMetadata) } });
}

function diaryView(row: { publicKey: string; title: string; entryDate: Date; notesFormat: string; notes: string; category: string; contextModule: string | null; contextReference: string | null; status: string; priority: string; followUpDate: Date | null; closedAt: Date | null; createdAt: Date; updatedAt: Date }): DiaryView {
  return { publicKey: row.publicKey, title: row.title, entryDate: schoolDateKey(row.entryDate), notesFormat: "PLAIN_STRUCTURED", notes: row.notes, category: row.category, contextModule: row.contextModule, contextReference: row.contextReference, status: row.status, priority: row.priority, followUpDate: row.followUpDate ? schoolDateKey(row.followUpDate) : null, closedAt: iso(row.closedAt), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function taskView(row: { publicKey: string; title: string; description: string | null; status: string; priority: string; dueDate: Date; dueTime: string | null; reminderAt: Date | null; category: string; linkedModule: string | null; linkedEntityType: string | null; linkedEntityReference: string | null; completedAt: Date | null; createdAt: Date; updatedAt: Date }): TaskView {
  return { publicKey: row.publicKey, title: row.title, description: row.description, status: row.status, priority: row.priority, dueDate: schoolDateKey(row.dueDate), dueTime: row.dueTime, reminderAt: iso(row.reminderAt), category: row.category, linkedModule: row.linkedModule, linkedEntityType: row.linkedEntityType, linkedEntityReference: row.linkedEntityReference, completedAt: iso(row.completedAt), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function contactView(row: { publicKey: string; name: string; contactPerson: string | null; category: string; phone: string | null; alternatePhone: string | null; email: string | null; address: string | null; website: string | null; notes: string | null; status: string; preferred: boolean; tagsJson: string; lastContactDate: Date | null; nextFollowUpDate: Date | null; createdAt: Date; updatedAt: Date }): ContactView {
  return { publicKey: row.publicKey, name: row.name, contactPerson: row.contactPerson, category: row.category, phone: row.phone, alternatePhone: row.alternatePhone, email: row.email, address: row.address, website: row.website, notes: row.notes, status: row.status, preferred: row.preferred, tags: safeTags(row.tagsJson), lastContactDate: row.lastContactDate ? schoolDateKey(row.lastContactDate) : null, nextFollowUpDate: row.nextFollowUpDate ? schoolDateKey(row.nextFollowUpDate) : null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SuperAdminWorkError("A valid work-programme record is required.");
  return value as Record<string, unknown>;
}

function bounded(value: unknown, label: string, max: number) {
  const text = String(value ?? "").trim();
  if (!text) throw new SuperAdminWorkError(`${label} is required.`);
  if (text.length > max) throw new SuperAdminWorkError(`${label} must be ${max} characters or fewer.`);
  if (/\u0000/.test(text)) throw new SuperAdminWorkError(`${label} contains unsupported characters.`);
  return text;
}

function optional(value: unknown, label: string, max: number) {
  const text = String(value ?? "").trim();
  return text ? bounded(text, label, max) : null;
}

function oneOf<const T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!values.includes(normalized as T[number])) throw new SuperAdminWorkError(`${label} is invalid.`);
  return normalized as T[number];
}

function optionalOneOf<const T extends readonly string[]>(value: unknown, values: T, label: string): T[number] | null {
  return String(value ?? "").trim() ? oneOf(value, values, label) : null;
}

function dateOnly(value: unknown, label: string) {
  const key = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new SuperAdminWorkError(`${label} must be a valid date.`);
  const date = new Date(`${key}T00:00:00+05:30`);
  if (!Number.isFinite(date.getTime()) || schoolDateKey(date) !== key) throw new SuperAdminWorkError(`${label} must be a valid date.`);
  return date;
}

function optionalDateOnly(value: unknown, label: string) {
  return String(value ?? "").trim() ? dateOnly(value, label) : null;
}

function optionalLocalDateTime(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) ? `${text}:00+05:30` : text;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) throw new SuperAdminWorkError(`${label} must be a valid date and time.`);
  return date;
}

function optionalTime(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new SuperAdminWorkError("Due time must use 24-hour HH:mm format.");
  return text;
}

function optionalPhone(value: unknown, label: string) {
  const text = optional(value, label, 30);
  if (text && !/^[+()\d\s.-]{7,30}$/.test(text)) throw new SuperAdminWorkError(`${label} contains unsupported characters.`);
  return text;
}

function optionalEmail(value: unknown) {
  const text = optional(value, "Email", 254)?.toLowerCase() ?? null;
  if (text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new SuperAdminWorkError("Email is invalid.");
  return text;
}

function optionalWebsite(value: unknown) {
  const text = optional(value, "Website", 300);
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error("protocol");
    return url.toString();
  } catch {
    throw new SuperAdminWorkError("Website must be a valid http or https URL.");
  }
}

function tags(value: unknown) {
  const rows = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(rows.map((entry) => String(entry).trim()).filter(Boolean).map((entry) => bounded(entry, "Tag", 30)))].slice(0, 12);
}

function safeTags(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)).filter((entry) => entry.length <= 30).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function schoolDayRange(key: string) {
  const start = dateOnly(key, "Date");
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1_000) };
}

function completedStatus(status: string) {
  return status === "DONE" || status === "CANCELLED";
}

function taskEventType(previousStatus: string, nextStatus: string) {
  if (previousStatus === nextStatus) return "TASK_UPDATED";
  if (nextStatus === "DONE") return "TASK_COMPLETED";
  if (nextStatus === "CANCELLED") return "TASK_CANCELLED";
  if (previousStatus === "DONE" || previousStatus === "CANCELLED") return "TASK_REOPENED";
  return "TASK_STATUS_CHANGED";
}

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}
