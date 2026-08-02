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
  return {
    academicCalendarVersions: rows(root.academicCalendarVersions, "academicCalendarVersions", KEYS.academicCalendarVersions, ["id", "publicKey", "academicYear", "versionNumber", "status", "scopeKey", "title"]),
    operationalCalendarDays: rows(root.operationalCalendarDays, "operationalCalendarDays", KEYS.operationalCalendarDays, ["id", "publicKey", "calendarVersionId", "dayDate", "dayType", "scopeKey", "title", "contentHash"]),
    schoolCalendarEvents: rows(root.schoolCalendarEvents, "schoolCalendarEvents", KEYS.schoolCalendarEvents, ["id", "publicKey", "eventNumber", "academicYear", "status"]),
    schoolCalendarEventVersions: rows(root.schoolCalendarEventVersions, "schoolCalendarEventVersions", KEYS.schoolCalendarEventVersions, ["id", "publicKey", "eventId", "versionNumber", "status", "eventType", "title", "startsAt", "endsAt", "audienceType", "contentHash"]),
    academicCalendarAuditEvents: rows(root.academicCalendarAuditEvents, "academicCalendarAuditEvents", KEYS.academicCalendarAuditEvents, ["id", "entityType", "eventType", "actorLabel", "snapshotJson", "eventDate"])
  };
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
