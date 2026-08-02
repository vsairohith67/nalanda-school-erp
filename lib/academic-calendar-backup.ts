import type { PrismaClient } from "@prisma/client";

export type AcademicCalendarBackup = {
  academicCalendarVersions: Record<string, unknown>[];
  operationalCalendarDays: Record<string, unknown>[];
  schoolCalendarEvents: Record<string, unknown>[];
  schoolCalendarEventVersions: Record<string, unknown>[];
  academicCalendarAuditEvents: Record<string, unknown>[];
};

const KEYS = {
  academicCalendarVersions: new Set(["id", "publicKey", "academicYear", "versionNumber", "status", "version", "effectiveScope", "className", "section", "scopeKey", "title", "currentPublicationKey", "idempotencyKey", "replacesVersionId", "publicationReason", "replacementReason", "withdrawalReason", "archiveReason", "attendanceReconciliationRequired", "createdByUserId", "submittedAt", "approvedAt", "publishedAt", "replacedAt", "withdrawnAt", "archivedAt", "createdAt", "updatedAt"]),
  operationalCalendarDays: new Set(["id", "publicKey", "calendarVersionId", "dayDate", "dayType", "sourceType", "scopeType", "className", "section", "scopeKey", "title", "halfDaySession", "publicInstructions", "reason", "contentHash", "createdAt", "updatedAt"]),
  schoolCalendarEvents: new Set(["id", "publicKey", "eventNumber", "academicYear", "status", "version", "currentVersionNumber", "currentPublishedVersionId", "createdByUserId", "createdAt", "updatedAt"]),
  schoolCalendarEventVersions: new Set(["id", "publicKey", "eventId", "versionNumber", "status", "version", "eventType", "title", "description", "startsAt", "endsAt", "allDay", "venue", "parentInstructions", "internalNotes", "audienceType", "roleScope", "classSectionId", "className", "section", "audienceKey", "examinationTimetableVersionId", "isImportant", "contentHash", "currentPublicationKey", "idempotencyKey", "replacesVersionId", "publicationReason", "replacementReason", "withdrawalReason", "archiveReason", "createdByUserId", "submittedAt", "approvedAt", "publishedAt", "replacedAt", "withdrawnAt", "archivedAt", "createdAt", "updatedAt"]),
  academicCalendarAuditEvents: new Set(["id", "entityType", "calendarVersionId", "schoolEventId", "eventVersionId", "eventType", "previousStatus", "newStatus", "reason", "actorUserId", "actorLabel", "snapshotJson", "eventDate", "createdAt"])
};

export async function loadAcademicCalendarBackup(client: Pick<PrismaClient, "academicCalendarVersion" | "operationalCalendarDay" | "schoolCalendarEvent" | "schoolCalendarEventVersion" | "academicCalendarAuditEvent">): Promise<AcademicCalendarBackup> {
  const [academicCalendarVersions, operationalCalendarDays, schoolCalendarEvents, schoolCalendarEventVersions, academicCalendarAuditEvents] = await Promise.all([
    client.academicCalendarVersion.findMany({ orderBy: [{ academicYear: "asc" }, { scopeKey: "asc" }, { versionNumber: "asc" }] }),
    client.operationalCalendarDay.findMany({ orderBy: [{ calendarVersionId: "asc" }, { dayDate: "asc" }] }),
    client.schoolCalendarEvent.findMany({ orderBy: { createdAt: "asc" } }),
    client.schoolCalendarEventVersion.findMany({ orderBy: [{ eventId: "asc" }, { versionNumber: "asc" }] }),
    client.academicCalendarAuditEvent.findMany({ orderBy: { eventDate: "asc" } })
  ]);
  return {
    academicCalendarVersions: stripActors(academicCalendarVersions),
    operationalCalendarDays: operationalCalendarDays as unknown as Record<string, unknown>[],
    schoolCalendarEvents: stripActors(schoolCalendarEvents),
    schoolCalendarEventVersions: stripActors(schoolCalendarEventVersions),
    academicCalendarAuditEvents: stripActors(academicCalendarAuditEvents)
  };
}

export function validateAcademicCalendarBackupRows(root: Record<string, unknown>): AcademicCalendarBackup {
  const backup = {
    academicCalendarVersions: rows(root.academicCalendarVersions, "academicCalendarVersions", KEYS.academicCalendarVersions, ["id", "publicKey", "academicYear", "versionNumber", "status", "scopeKey", "title"]),
    operationalCalendarDays: rows(root.operationalCalendarDays, "operationalCalendarDays", KEYS.operationalCalendarDays, ["id", "publicKey", "calendarVersionId", "dayDate", "dayType", "scopeKey", "title", "contentHash"]),
    schoolCalendarEvents: rows(root.schoolCalendarEvents, "schoolCalendarEvents", KEYS.schoolCalendarEvents, ["id", "publicKey", "eventNumber", "academicYear", "status"]),
    schoolCalendarEventVersions: rows(root.schoolCalendarEventVersions, "schoolCalendarEventVersions", KEYS.schoolCalendarEventVersions, ["id", "publicKey", "eventId", "versionNumber", "status", "eventType", "title", "startsAt", "endsAt", "audienceType", "contentHash"]),
    academicCalendarAuditEvents: rows(root.academicCalendarAuditEvents, "academicCalendarAuditEvents", KEYS.academicCalendarAuditEvents, ["id", "entityType", "eventType", "actorLabel", "snapshotJson", "eventDate"])
  };
  validateSemantics(backup);
  return backup;
}

export function academicCalendarBackupCount(backup: AcademicCalendarBackup) { return Object.values(backup).reduce((sum, rows) => sum + rows.length, 0); }

function stripActors<T extends object>(values: T[]) { return values.map((value) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== "createdByUserId" && key !== "actorUserId"))); }
function rows(value: unknown, name: string, allowed: Set<string>, required: string[]) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100_000) throw new Error(`${name} must be a bounded array.`);
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${name}[${index}] must be an object.`);
    const row = item as Record<string, unknown>;
    for (const key of Object.keys(row)) if (!allowed.has(key)) throw new Error(`${name}[${index}].${key} is not supported.`);
    for (const key of required) if (row[key] === undefined || row[key] === null || row[key] === "") throw new Error(`${name}[${index}].${key} is required.`);
    return row;
  });
}

const STATUSES = ["DRAFT", "READY_FOR_REVIEW", "PUBLISHED", "REPLACED", "WITHDRAWN", "ARCHIVED"];
const SCOPES = ["SCHOOL_WIDE", "CLASS", "CLASS_SECTION"];
const DAY_TYPES = ["WORKING_DAY", "NON_WORKING_DAY", "HALF_DAY", "VACATION_DAY", "SPECIAL_WORKING_DAY", "EMERGENCY_CLOSURE"];
const DAY_SOURCES = ["MANUAL", "HOLIDAY", "VACATION", "SPECIAL_WORKING", "HALF_DAY", "EMERGENCY_CLOSURE"];
const EVENT_TYPES = ["SCHOOL_FUNCTION", "PARENT_MEETING", "ACTIVITY", "COMPETITION", "ACADEMIC_DEADLINE", "STAFF_MEETING", "EXAMINATION_REFERENCE", "CLASS_EVENT", "OTHER"];
const AUDIENCES = ["SCHOOL_WIDE", "STAFF_ONLY", "PARENTS_ALL", "ROLE_SPECIFIC", "CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT", "LEADERSHIP_ONLY"];

function validateSemantics(backup: AcademicCalendarBackup) {
  const calendarIds = unique(backup.academicCalendarVersions, "academicCalendarVersions", "id");
  unique(backup.academicCalendarVersions, "academicCalendarVersions", "publicKey");
  const calendars = new Map(backup.academicCalendarVersions.map((row) => [text(row.id), row]));
  const calendarNumbers = new Set<string>();
  for (const [index, row] of backup.academicCalendarVersions.entries()) {
    year(row.academicYear, `academicCalendarVersions[${index}].academicYear`);
    const versionNumber = positive(row.versionNumber, `academicCalendarVersions[${index}].versionNumber`);
    positive(row.version ?? 1, `academicCalendarVersions[${index}].version`);
    const status = oneOf(row.status, STATUSES, `academicCalendarVersions[${index}].status`);
    const scope = oneOf(row.effectiveScope ?? "SCHOOL_WIDE", SCOPES, `academicCalendarVersions[${index}].effectiveScope`);
    validateScope(scope, row.className, row.section, row.scopeKey, `academicCalendarVersions[${index}]`);
    bounded(row.title, 160, `academicCalendarVersions[${index}].title`);
    const numberKey = `${row.academicYear}|${row.scopeKey}|${versionNumber}`;
    if (calendarNumbers.has(numberKey)) throw new Error(`academicCalendarVersions[${index}] duplicates an academic-year scope version`);
    calendarNumbers.add(numberKey);
    validateLifecycle(row, status, `academicCalendarVersions[${index}]`);
    if (row.replacesVersionId) {
      const prior = calendars.get(text(row.replacesVersionId));
      if (!prior || prior.academicYear !== row.academicYear || prior.scopeKey !== row.scopeKey || Number(prior.versionNumber) >= versionNumber) throw new Error(`academicCalendarVersions[${index}] has an invalid replacement link`);
    }
  }

  unique(backup.operationalCalendarDays, "operationalCalendarDays", "id");
  unique(backup.operationalCalendarDays, "operationalCalendarDays", "publicKey");
  const dayKeys = new Set<string>();
  for (const [index, row] of backup.operationalCalendarDays.entries()) {
    if (!calendarIds.has(text(row.calendarVersionId))) throw new Error(`operationalCalendarDays[${index}] has an invalid calendar-version link`);
    validDate(row.dayDate, `operationalCalendarDays[${index}].dayDate`);
    oneOf(row.dayType, DAY_TYPES, `operationalCalendarDays[${index}].dayType`);
    oneOf(row.sourceType ?? "MANUAL", DAY_SOURCES, `operationalCalendarDays[${index}].sourceType`);
    const scope = oneOf(row.scopeType ?? "SCHOOL_WIDE", SCOPES, `operationalCalendarDays[${index}].scopeType`);
    validateScope(scope, row.className, row.section, row.scopeKey, `operationalCalendarDays[${index}]`);
    bounded(row.title, 160, `operationalCalendarDays[${index}].title`);
    bounded(row.contentHash, 256, `operationalCalendarDays[${index}].contentHash`);
    if (row.dayType === "HALF_DAY") bounded(row.halfDaySession, 80, `operationalCalendarDays[${index}].halfDaySession`);
    if (row.dayType === "EMERGENCY_CLOSURE") bounded(row.reason, 1_000, `operationalCalendarDays[${index}].reason`);
    const key = `${row.calendarVersionId}|${new Date(String(row.dayDate)).toISOString()}|${row.scopeKey}`;
    if (dayKeys.has(key)) throw new Error(`operationalCalendarDays[${index}] overlaps another classification`);
    dayKeys.add(key);
  }

  const eventIds = unique(backup.schoolCalendarEvents, "schoolCalendarEvents", "id");
  unique(backup.schoolCalendarEvents, "schoolCalendarEvents", "publicKey");
  unique(backup.schoolCalendarEvents, "schoolCalendarEvents", "eventNumber");
  const eventVersions = new Map(backup.schoolCalendarEventVersions.map((row) => [text(row.id), row]));
  unique(backup.schoolCalendarEventVersions, "schoolCalendarEventVersions", "id");
  unique(backup.schoolCalendarEventVersions, "schoolCalendarEventVersions", "publicKey");
  const eventVersionNumbers = new Set<string>();
  for (const [index, row] of backup.schoolCalendarEventVersions.entries()) {
    if (!eventIds.has(text(row.eventId))) throw new Error(`schoolCalendarEventVersions[${index}] has an invalid event link`);
    const versionNumber = positive(row.versionNumber, `schoolCalendarEventVersions[${index}].versionNumber`);
    positive(row.version ?? 1, `schoolCalendarEventVersions[${index}].version`);
    const numberKey = `${row.eventId}|${versionNumber}`;
    if (eventVersionNumbers.has(numberKey)) throw new Error(`schoolCalendarEventVersions[${index}] duplicates an event version number`);
    eventVersionNumbers.add(numberKey);
    const status = oneOf(row.status, STATUSES, `schoolCalendarEventVersions[${index}].status`);
    oneOf(row.eventType, EVENT_TYPES, `schoolCalendarEventVersions[${index}].eventType`);
    const audience = oneOf(row.audienceType, AUDIENCES, `schoolCalendarEventVersions[${index}].audienceType`);
    bounded(row.title, 160, `schoolCalendarEventVersions[${index}].title`);
    const startsAt = validDate(row.startsAt, `schoolCalendarEventVersions[${index}].startsAt`);
    const endsAt = validDate(row.endsAt, `schoolCalendarEventVersions[${index}].endsAt`);
    if (endsAt < startsAt || endsAt - startsAt > 370 * 86_400_000) throw new Error(`schoolCalendarEventVersions[${index}] has an invalid date range`);
    if (audience === "ROLE_SPECIFIC") bounded(row.roleScope, 40, `schoolCalendarEventVersions[${index}].roleScope`);
    if (["CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT"].includes(audience)) bounded(row.className, 80, `schoolCalendarEventVersions[${index}].className`);
    if (["CLASS_SECTION", "LINKED_CHILD_COHORT"].includes(audience)) bounded(row.section, 40, `schoolCalendarEventVersions[${index}].section`);
    validateLifecycle(row, status, `schoolCalendarEventVersions[${index}]`);
    if (row.replacesVersionId) {
      const prior = eventVersions.get(text(row.replacesVersionId));
      if (!prior || prior.eventId !== row.eventId || Number(prior.versionNumber) >= versionNumber) throw new Error(`schoolCalendarEventVersions[${index}] has an invalid replacement link`);
    }
  }

  for (const [index, row] of backup.schoolCalendarEvents.entries()) {
    year(row.academicYear, `schoolCalendarEvents[${index}].academicYear`);
    oneOf(row.status, STATUSES, `schoolCalendarEvents[${index}].status`);
    positive(row.version ?? 1, `schoolCalendarEvents[${index}].version`);
    const owned = backup.schoolCalendarEventVersions.filter((version) => version.eventId === row.id);
    const maximum = owned.length ? Math.max(...owned.map((version) => Number(version.versionNumber))) : 0;
    if (positive(row.currentVersionNumber, `schoolCalendarEvents[${index}].currentVersionNumber`) !== maximum) throw new Error(`schoolCalendarEvents[${index}] has an inconsistent current version number`);
    if (row.currentPublishedVersionId) {
      const current = eventVersions.get(text(row.currentPublishedVersionId));
      if (!current || current.eventId !== row.id || current.status !== "PUBLISHED" || !current.currentPublicationKey) throw new Error(`schoolCalendarEvents[${index}] has an invalid current publication pointer`);
    } else if (row.status === "PUBLISHED") throw new Error(`schoolCalendarEvents[${index}] is published without a current publication pointer`);
  }

  unique(backup.academicCalendarAuditEvents, "academicCalendarAuditEvents", "id");
  for (const [index, row] of backup.academicCalendarAuditEvents.entries()) {
    const entity = oneOf(row.entityType, ["OPERATIONAL_CALENDAR", "INFORMATIONAL_EVENT"], `academicCalendarAuditEvents[${index}].entityType`);
    if (entity === "OPERATIONAL_CALENDAR") {
      if (!row.calendarVersionId || !calendarIds.has(text(row.calendarVersionId)) || row.schoolEventId || row.eventVersionId) throw new Error(`academicCalendarAuditEvents[${index}] has an invalid operational target`);
    } else {
      const version = row.eventVersionId ? eventVersions.get(text(row.eventVersionId)) : null;
      if (!row.schoolEventId || !eventIds.has(text(row.schoolEventId)) || !version || version.eventId !== row.schoolEventId || row.calendarVersionId) throw new Error(`academicCalendarAuditEvents[${index}] has an invalid informational-event target`);
    }
    validDate(row.eventDate, `academicCalendarAuditEvents[${index}].eventDate`);
    const snapshot = json(row.snapshotJson, `academicCalendarAuditEvents[${index}].snapshotJson`);
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error(`academicCalendarAuditEvents[${index}].snapshotJson must contain an object`);
  }
}

function validateLifecycle(row: Record<string, unknown>, status: string, label: string) {
  if (status !== "DRAFT" && !row.submittedAt) throw new Error(`${label} requires submission evidence`);
  if (["PUBLISHED", "REPLACED", "WITHDRAWN", "ARCHIVED"].includes(status)) {
    if (!row.approvedAt || !row.publishedAt || !row.publicationReason) throw new Error(`${label} requires approval and publication evidence`);
  }
  if (status === "PUBLISHED" && !row.currentPublicationKey) throw new Error(`${label} requires a current publication key`);
  if (status !== "PUBLISHED" && row.currentPublicationKey) throw new Error(`${label} cannot retain a current publication key`);
  if (status === "REPLACED" && !row.replacedAt) throw new Error(`${label} requires replacement evidence`);
  if (status === "WITHDRAWN" && (!row.withdrawnAt || !row.withdrawalReason)) throw new Error(`${label} requires withdrawal evidence`);
  if (status === "ARCHIVED") {
    if (!row.archivedAt || !row.archiveReason) throw new Error(`${label} requires archive evidence`);
    if (!row.replacedAt && (!row.withdrawnAt || !row.withdrawalReason)) throw new Error(`${label} requires a restorable replaced or withdrawn lifecycle`);
  }
  for (const field of ["submittedAt", "approvedAt", "publishedAt", "replacedAt", "withdrawnAt", "archivedAt"]) if (row[field]) validDate(row[field], `${label}.${field}`);
}

function validateScope(scope: string, className: unknown, section: unknown, scopeKey: unknown, label: string) {
  if (scope === "SCHOOL_WIDE") { if (className || section || scopeKey !== "SCHOOL_WIDE::") throw new Error(`${label} has an invalid school-wide scope`); return; }
  const classText = bounded(className, 80, `${label}.className`);
  if (scope === "CLASS") { if (section || scopeKey !== `CLASS:${classText}:`) throw new Error(`${label} has an invalid class scope`); return; }
  const sectionText = bounded(section, 40, `${label}.section`);
  if (scopeKey !== `CLASS_SECTION:${classText}:${sectionText}`) throw new Error(`${label} has an invalid class-section scope`);
}

function unique(rows: Record<string, unknown>[], label: string, key: string) { const values = new Set<string>(); for (const [index, row] of rows.entries()) { const value = bounded(row[key], 160, `${label}[${index}].${key}`); if (values.has(value)) throw new Error(`${label}[${index}].${key} is duplicated`); values.add(value); } return values; }
function text(value: unknown) { return String(value ?? "").trim(); }
function bounded(value: unknown, maximum: number, label: string) { const valueText = text(value); if (!valueText || valueText.length > maximum) throw new Error(`${label} must contain at most ${maximum} characters`); return valueText; }
function positive(value: unknown, label: string) { const number = Number(value); if (!Number.isInteger(number) || number < 1 || number > 1_000_000) throw new Error(`${label} must be a positive bounded integer`); return number; }
function oneOf(value: unknown, values: string[], label: string) { const valueText = text(value); if (!values.includes(valueText)) throw new Error(`${label} is unsupported`); return valueText; }
function year(value: unknown, label: string) { if (!/^20\d{2}-\d{2}$/.test(text(value))) throw new Error(`${label} must use YYYY-YY`); }
function validDate(value: unknown, label: string) { const number = new Date(String(value ?? "")).valueOf(); if (!Number.isFinite(number)) throw new Error(`${label} must be a valid date`); return number; }
function json(value: unknown, label: string) { if (typeof value !== "string" || value.length > 2_000_000) throw new Error(`${label} must be bounded JSON text`); try { return JSON.parse(value); } catch { throw new Error(`${label} must be valid JSON`); } }
