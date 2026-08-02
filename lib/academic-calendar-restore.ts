import type { AcademicCalendarBackup } from "@/lib/academic-calendar-backup";
import type { EntityRestoreResult } from "@/lib/restore";

type CalendarRestoreResult = {
  academicCalendarVersions: EntityRestoreResult;
  operationalCalendarDays: EntityRestoreResult;
  schoolCalendarEvents: EntityRestoreResult;
  schoolCalendarEventVersions: EntityRestoreResult;
  academicCalendarAuditEvents: EntityRestoreResult;
  warnings: string[];
};

export async function restoreAcademicCalendarData(client: any, backup: AcademicCalendarBackup, restoredBy: { id: string }, result: CalendarRestoreResult) {
  for (const [index, row] of [...backup.academicCalendarVersions].sort((a, b) => number(a.versionNumber) - number(b.versionNumber)).entries()) {
    try {
      const id = text(row.id), publicKey = text(row.publicKey);
      if (await client.academicCalendarVersion.findFirst({ where: { OR: [{ id }, { publicKey }] } })) { result.academicCalendarVersions.skipped++; continue; }
      const finalStatus = text(row.status);
      await client.academicCalendarVersion.create({ data: {
        id, publicKey, academicYear: text(row.academicYear), versionNumber: number(row.versionNumber), status: "DRAFT", version: number(row.version, 1), effectiveScope: text(row.effectiveScope, "SCHOOL_WIDE"), className: nullable(row.className), section: nullable(row.section), scopeKey: text(row.scopeKey), title: text(row.title), currentPublicationKey: null, idempotencyKey: nullable(row.idempotencyKey), replacesVersionId: nullable(row.replacesVersionId), publicationReason: nullable(row.publicationReason), replacementReason: nullable(row.replacementReason), withdrawalReason: nullable(row.withdrawalReason), archiveReason: nullable(row.archiveReason), attendanceReconciliationRequired: Boolean(row.attendanceReconciliationRequired), createdByUserId: restoredBy.id, submittedAt: date(row.submittedAt), approvedAt: date(row.approvedAt), publishedAt: date(row.publishedAt), replacedAt: date(row.replacedAt), withdrawnAt: date(row.withdrawnAt), archivedAt: date(row.archivedAt), createdAt: date(row.createdAt) ?? new Date(), updatedAt: date(row.updatedAt) ?? new Date()
      } });
      const days = backup.operationalCalendarDays.filter((day) => day.calendarVersionId === id);
      for (const day of days) await client.operationalCalendarDay.create({ data: { id: text(day.id), publicKey: text(day.publicKey), calendarVersionId: id, dayDate: requiredDate(day.dayDate), dayType: text(day.dayType), sourceType: text(day.sourceType, "MANUAL"), scopeType: text(day.scopeType, "SCHOOL_WIDE"), className: nullable(day.className), section: nullable(day.section), scopeKey: text(day.scopeKey), title: text(day.title), halfDaySession: nullable(day.halfDaySession), publicInstructions: nullable(day.publicInstructions), reason: nullable(day.reason), contentHash: text(day.contentHash), createdAt: date(day.createdAt) ?? new Date(), updatedAt: date(day.updatedAt) ?? new Date() } });
      result.operationalCalendarDays.created += days.length;
      if (finalStatus !== "DRAFT" || row.currentPublicationKey) await client.academicCalendarVersion.update({ where: { id }, data: { status: finalStatus, currentPublicationKey: nullable(row.currentPublicationKey), updatedAt: date(row.updatedAt) ?? new Date() } });
      result.academicCalendarVersions.created++;
    } catch (error) { result.academicCalendarVersions.errors.push(label("Academic calendar version", index, error)); }
  }
  for (const [index, row] of backup.schoolCalendarEvents.entries()) {
    try {
      const id = text(row.id), publicKey = text(row.publicKey);
      if (await client.schoolCalendarEvent.findFirst({ where: { OR: [{ id }, { publicKey }] } })) { result.schoolCalendarEvents.skipped++; continue; }
      await client.schoolCalendarEvent.create({ data: { id, publicKey, eventNumber: text(row.eventNumber), academicYear: text(row.academicYear), status: "DRAFT", version: number(row.version, 1), currentVersionNumber: number(row.currentVersionNumber, 1), currentPublishedVersionId: null, createdByUserId: restoredBy.id, createdAt: date(row.createdAt) ?? new Date(), updatedAt: date(row.updatedAt) ?? new Date() } });
      result.schoolCalendarEvents.created++;
    } catch (error) { result.schoolCalendarEvents.errors.push(label("School calendar event", index, error)); }
  }
  for (const [index, row] of [...backup.schoolCalendarEventVersions].sort((a, b) => number(a.versionNumber) - number(b.versionNumber)).entries()) {
    try {
      const id = text(row.id), publicKey = text(row.publicKey);
      if (await client.schoolCalendarEventVersion.findFirst({ where: { OR: [{ id }, { publicKey }] } })) { result.schoolCalendarEventVersions.skipped++; continue; }
      await client.schoolCalendarEventVersion.create({ data: { id, publicKey, eventId: text(row.eventId), versionNumber: number(row.versionNumber), status: text(row.status), version: number(row.version, 1), eventType: text(row.eventType), title: text(row.title), description: nullable(row.description), startsAt: requiredDate(row.startsAt), endsAt: requiredDate(row.endsAt), allDay: row.allDay !== false, venue: nullable(row.venue), parentInstructions: nullable(row.parentInstructions), internalNotes: nullable(row.internalNotes), audienceType: text(row.audienceType), roleScope: nullable(row.roleScope), classSectionId: nullable(row.classSectionId), className: nullable(row.className), section: nullable(row.section), audienceKey: text(row.audienceKey), examinationTimetableVersionId: nullable(row.examinationTimetableVersionId), isImportant: Boolean(row.isImportant), contentHash: text(row.contentHash), currentPublicationKey: nullable(row.currentPublicationKey), idempotencyKey: nullable(row.idempotencyKey), replacesVersionId: nullable(row.replacesVersionId), publicationReason: nullable(row.publicationReason), replacementReason: nullable(row.replacementReason), withdrawalReason: nullable(row.withdrawalReason), archiveReason: nullable(row.archiveReason), createdByUserId: restoredBy.id, submittedAt: date(row.submittedAt), approvedAt: date(row.approvedAt), publishedAt: date(row.publishedAt), replacedAt: date(row.replacedAt), withdrawnAt: date(row.withdrawnAt), archivedAt: date(row.archivedAt), createdAt: date(row.createdAt) ?? new Date(), updatedAt: date(row.updatedAt) ?? new Date() } });
      result.schoolCalendarEventVersions.created++;
    } catch (error) { result.schoolCalendarEventVersions.errors.push(label("School calendar event version", index, error)); }
  }
  for (const [index, row] of backup.schoolCalendarEvents.entries()) {
    try { await client.schoolCalendarEvent.update({ where: { id: text(row.id) }, data: { status: text(row.status), currentVersionNumber: number(row.currentVersionNumber, 1), currentPublishedVersionId: nullable(row.currentPublishedVersionId), updatedAt: date(row.updatedAt) ?? new Date() } }); }
    catch (error) { result.schoolCalendarEvents.warnings.push(label("School calendar event publication pointer", index, error)); }
  }
  for (const [index, row] of backup.academicCalendarAuditEvents.entries()) {
    try {
      const id = text(row.id); if (await client.academicCalendarAuditEvent.findUnique({ where: { id } })) { result.academicCalendarAuditEvents.skipped++; continue; }
      await client.academicCalendarAuditEvent.create({ data: { id, entityType: text(row.entityType), calendarVersionId: nullable(row.calendarVersionId), schoolEventId: nullable(row.schoolEventId), eventVersionId: nullable(row.eventVersionId), eventType: text(row.eventType), previousStatus: nullable(row.previousStatus), newStatus: nullable(row.newStatus), reason: nullable(row.reason), actorUserId: restoredBy.id, actorLabel: text(row.actorLabel), snapshotJson: text(row.snapshotJson), eventDate: requiredDate(row.eventDate), createdAt: date(row.createdAt) ?? new Date() } }); result.academicCalendarAuditEvents.created++;
    } catch (error) { result.academicCalendarAuditEvents.errors.push(label("Academic calendar audit", index, error)); }
  }
  result.operationalCalendarDays.skipped += Math.max(0, backup.operationalCalendarDays.length - result.operationalCalendarDays.created);
}

function text(value: unknown, fallback = "") { const result = String(value ?? fallback).trim(); if (!result) throw new Error("A required calendar value is missing."); return result; }
function nullable(value: unknown) { if (value === null || value === undefined || value === "") return null; return String(value); }
function number(value: unknown, fallback = 0) { const result = Number(value ?? fallback); if (!Number.isInteger(result) || result < 0) throw new Error("A calendar version number is invalid."); return result; }
function date(value: unknown) { if (value === null || value === undefined || value === "") return null; const result = new Date(String(value)); if (Number.isNaN(result.valueOf())) throw new Error("A calendar date is invalid."); return result; }
function requiredDate(value: unknown) { const result = date(value); if (!result) throw new Error("A required calendar date is missing."); return result; }
function label(entity: string, index: number, error: unknown) { return `${entity} ${index + 1}: ${error instanceof Error ? error.message : "restore failed"}`; }
