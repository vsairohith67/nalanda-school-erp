import type { PrismaClient } from "@prisma/client";

export const CLASSWORK_BACKUP_KEYS = ["classworkItems", "classworkItemVersions", "classworkSubmissions", "classworkSubmissionVersions", "classworkAttachments", "classworkFeedback", "classworkAuditEvents"] as const;
export type ClassworkBackupKey = (typeof CLASSWORK_BACKUP_KEYS)[number];
export type ClassworkBackup = Record<ClassworkBackupKey, Record<string, unknown>[]>;

const KEYS: Record<ClassworkBackupKey, Set<string>> = {
  classworkItems: new Set(["id","publicKey","itemNumber","kind","academicYear","className","section","subjectName","timetableSubjectId","status","currentVersionNumber","rowVersion","createdByUserId","closedByUserId","archivedByUserId","publishedAt","closedAt","archivedAt","createdAt","updatedAt"]),
  classworkItemVersions: new Set(["id","publicKey","itemId","versionNumber","versionStatus","title","instructions","dueAt","correctionReason","publishRequestKey","createdByUserId","publishedByUserId","createdAt","publishedAt","replacedAt"]),
  classworkSubmissions: new Set(["id","publicKey","itemId","studentId","status","currentVersionNumber","rowVersion","createdByUserId","createdByRole","lastSubmittedByUserId","lastSubmittedByRole","firstSubmittedAt","lastSubmittedAt","returnedAt","reviewedAt","createdAt","updatedAt"]),
  classworkSubmissionVersions: new Set(["id","publicKey","submissionId","itemVersionId","versionNumber","versionStatus","textBody","submissionRequestKey","createdByUserId","createdByRole","parentGuardianId","submittedAt","lockedAt","createdAt","updatedAt"]),
  classworkAttachments: new Set(["id","publicKey","itemVersionId","submissionVersionId","storageKey","safeDisplayName","mediaType","extension","byteSize","sha256","width","height","recoveryStatus","backupArtifactSha256","backupKeyVersion","backupVerifiedAt","createdByUserId","createdAt"]),
  classworkFeedback: new Set(["id","publicKey","submissionId","submissionVersionId","sequenceNumber","feedbackType","body","createdByUserId","createdByRole","createdAt"]),
  classworkAuditEvents: new Set(["id","itemId","submissionId","eventType","actorUserId","actorRole","snapshotJson","occurredAt","createdAt"])
};

const REQUIRED: Record<ClassworkBackupKey, string[]> = {
  classworkItems: ["id","publicKey","itemNumber","kind","academicYear","className","section","subjectName","timetableSubjectId","status","currentVersionNumber","rowVersion","createdByUserId"],
  classworkItemVersions: ["id","publicKey","itemId","versionNumber","versionStatus","title","instructions","createdByUserId"],
  classworkSubmissions: ["id","publicKey","itemId","studentId","status","currentVersionNumber","rowVersion","createdByUserId","createdByRole"],
  classworkSubmissionVersions: ["id","publicKey","submissionId","itemVersionId","versionNumber","versionStatus","createdByUserId","createdByRole"],
  classworkAttachments: ["id","publicKey","storageKey","safeDisplayName","mediaType","extension","byteSize","sha256","recoveryStatus","createdByUserId"],
  classworkFeedback: ["id","publicKey","submissionId","sequenceNumber","feedbackType","body","createdByUserId","createdByRole"],
  classworkAuditEvents: ["id","eventType","actorUserId","actorRole","snapshotJson","occurredAt"]
};

export async function loadClassworkBackup(client: Pick<PrismaClient, "classworkItem" | "classworkItemVersion" | "classworkSubmission" | "classworkSubmissionVersion" | "classworkAttachment" | "classworkFeedback" | "classworkAuditEvent">): Promise<ClassworkBackup> {
  const [classworkItems, classworkItemVersions, classworkSubmissions, classworkSubmissionVersions, classworkAttachments, classworkFeedback, classworkAuditEvents] = await Promise.all([
    client.classworkItem.findMany({ orderBy: { createdAt: "asc" } }),
    client.classworkItemVersion.findMany({ orderBy: [{ itemId: "asc" }, { versionNumber: "asc" }] }),
    client.classworkSubmission.findMany({ orderBy: { createdAt: "asc" } }),
    client.classworkSubmissionVersion.findMany({ orderBy: [{ submissionId: "asc" }, { versionNumber: "asc" }] }),
    client.classworkAttachment.findMany({ orderBy: { createdAt: "asc" } }),
    client.classworkFeedback.findMany({ orderBy: [{ submissionId: "asc" }, { sequenceNumber: "asc" }] }),
    client.classworkAuditEvent.findMany({ orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }] })
  ]);
  return { classworkItems, classworkItemVersions, classworkSubmissions, classworkSubmissionVersions, classworkAttachments, classworkFeedback, classworkAuditEvents } as unknown as ClassworkBackup;
}

export function validateClassworkBackupRows(root: Record<string, unknown>): ClassworkBackup {
  const backup = Object.fromEntries(CLASSWORK_BACKUP_KEYS.map((key) => [key, rows(root[key], key, KEYS[key], REQUIRED[key])])) as ClassworkBackup;
  validateSemantics(backup);
  return backup;
}

export function classworkBackupCount(backup: ClassworkBackup) { return CLASSWORK_BACKUP_KEYS.reduce((sum, key) => sum + backup[key].length, 0); }

function validateSemantics(backup: ClassworkBackup) {
  const itemIds = unique(backup.classworkItems, "classworkItems", "id"), itemVersions = unique(backup.classworkItemVersions, "classworkItemVersions", "id"), submissions = unique(backup.classworkSubmissions, "classworkSubmissions", "id"), submissionVersions = unique(backup.classworkSubmissionVersions, "classworkSubmissionVersions", "id");
  for (const key of CLASSWORK_BACKUP_KEYS.slice(0, 6)) unique(backup[key], key, "publicKey");
  unique(backup.classworkItems, "classworkItems", "itemNumber"); unique(backup.classworkAttachments, "classworkAttachments", "storageKey");
  const itemVersionNumbers = new Set<string>(), submissionVersionNumbers = new Set<string>(), feedbackNumbers = new Set<string>();
  for (const [index, row] of backup.classworkItems.entries()) {
    oneOf(row.kind, ["CLASSWORK","HOMEWORK","ASSIGNMENT"], `classworkItems[${index}].kind`); oneOf(row.status, ["DRAFT","PUBLISHED","CLOSED","ARCHIVED"], `classworkItems[${index}].status`); positive(row.currentVersionNumber, `classworkItems[${index}].currentVersionNumber`); positive(row.rowVersion, `classworkItems[${index}].rowVersion`); if (!/^\d{4}-\d{2}$/.test(text(row.academicYear))) throw new Error(`classworkItems[${index}].academicYear must use YYYY-YY`); bounded(row.section, 20, `classworkItems[${index}].section`);
  }
  for (const [index, row] of backup.classworkItemVersions.entries()) {
    if (!itemIds.has(text(row.itemId))) throw new Error(`classworkItemVersions[${index}] has an invalid item link`); const number = positive(row.versionNumber, `classworkItemVersions[${index}].versionNumber`); const key = `${row.itemId}|${number}`; if (itemVersionNumbers.has(key)) throw new Error(`classworkItemVersions[${index}] duplicates a version number`); itemVersionNumbers.add(key); const status = oneOf(row.versionStatus, ["DRAFT","PUBLISHED","REPLACED"], `classworkItemVersions[${index}].versionStatus`); bounded(row.title, 180, `classworkItemVersions[${index}].title`); bounded(row.instructions, 20_000, `classworkItemVersions[${index}].instructions`); if (status !== "DRAFT" && (!row.publishedAt || !row.publishRequestKey)) throw new Error(`classworkItemVersions[${index}] lacks immutable publication evidence`); if (status === "REPLACED" && !row.replacedAt) throw new Error(`classworkItemVersions[${index}] lacks replacement evidence`);
  }
  for (const [index, row] of backup.classworkSubmissions.entries()) { if (!itemIds.has(text(row.itemId))) throw new Error(`classworkSubmissions[${index}] has an invalid item link`); oneOf(row.status, ["DRAFT","SUBMITTED","LATE","RETURNED","RESUBMITTED","REVIEWED"], `classworkSubmissions[${index}].status`); positive(row.currentVersionNumber, `classworkSubmissions[${index}].currentVersionNumber`); positive(row.rowVersion, `classworkSubmissions[${index}].rowVersion`); oneOf(row.createdByRole, ["PARENT","STUDENT"], `classworkSubmissions[${index}].createdByRole`); }
  for (const [index, row] of backup.classworkSubmissionVersions.entries()) { if (!submissions.has(text(row.submissionId)) || !itemVersions.has(text(row.itemVersionId))) throw new Error(`classworkSubmissionVersions[${index}] has an invalid preserved link`); const number = positive(row.versionNumber, `classworkSubmissionVersions[${index}].versionNumber`); const key = `${row.submissionId}|${number}`; if (submissionVersionNumbers.has(key)) throw new Error(`classworkSubmissionVersions[${index}] duplicates a version number`); submissionVersionNumbers.add(key); const status = oneOf(row.versionStatus, ["DRAFT","SUBMITTED","LATE","RESUBMITTED"], `classworkSubmissionVersions[${index}].versionStatus`); oneOf(row.createdByRole, ["PARENT","STUDENT"], `classworkSubmissionVersions[${index}].createdByRole`); if (status !== "DRAFT" && (!row.submittedAt || !row.lockedAt || !row.submissionRequestKey)) throw new Error(`classworkSubmissionVersions[${index}] lacks immutable submission evidence`); }
  for (const [index, row] of backup.classworkAttachments.entries()) { const item = row.itemVersionId ? itemVersions.has(text(row.itemVersionId)) : false, submission = row.submissionVersionId ? submissionVersions.has(text(row.submissionVersionId)) : false; if (item === submission) throw new Error(`classworkAttachments[${index}] must belong to exactly one version`); oneOf(row.mediaType, ["application/pdf","image/png","image/jpeg","image/webp"], `classworkAttachments[${index}].mediaType`); if (!/^[a-f0-9]{64}$/.test(text(row.sha256))) throw new Error(`classworkAttachments[${index}].sha256 is invalid`); const recovery = oneOf(row.recoveryStatus, ["PENDING","VERIFIED"], `classworkAttachments[${index}].recoveryStatus`); if (recovery === "VERIFIED" && (!row.backupArtifactSha256 || !row.backupKeyVersion || !row.backupVerifiedAt)) throw new Error(`classworkAttachments[${index}] lacks encrypted recovery evidence`); }
  for (const [index, row] of backup.classworkFeedback.entries()) { if (!submissions.has(text(row.submissionId)) || (row.submissionVersionId && !submissionVersions.has(text(row.submissionVersionId)))) throw new Error(`classworkFeedback[${index}] has an invalid submission link`); const number = positive(row.sequenceNumber, `classworkFeedback[${index}].sequenceNumber`); const key = `${row.submissionId}|${number}`; if (feedbackNumbers.has(key)) throw new Error(`classworkFeedback[${index}] duplicates a sequence number`); feedbackNumbers.add(key); bounded(row.body, 4_000, `classworkFeedback[${index}].body`); }
  for (const [index, row] of backup.classworkAuditEvents.entries()) { if (row.itemId && !itemIds.has(text(row.itemId))) throw new Error(`classworkAuditEvents[${index}] has an invalid item link`); if (row.submissionId && !submissions.has(text(row.submissionId))) throw new Error(`classworkAuditEvents[${index}] has an invalid submission link`); const snapshot = json(row.snapshotJson, `classworkAuditEvents[${index}].snapshotJson`); if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error(`classworkAuditEvents[${index}].snapshotJson must contain an object`); }
}

function rows(value: unknown, name: string, allowed: Set<string>, required: string[]) { if (value === undefined) return []; if (!Array.isArray(value) || value.length > 100_000) throw new Error(`${name} must be a bounded array.`); return value.map((item, index) => { if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${name}[${index}] must be an object.`); const row = item as Record<string, unknown>; for (const key of Object.keys(row)) if (!allowed.has(key)) throw new Error(`${name}[${index}].${key} is unsupported.`); for (const key of required) if (row[key] === undefined || row[key] === null || row[key] === "") throw new Error(`${name}[${index}].${key} is required.`); return row; }); }
function unique(rows: Record<string, unknown>[], label: string, field: string) { const values = new Set<string>(); rows.forEach((row, index) => { const value = bounded(row[field], 200, `${label}[${index}].${field}`); if (values.has(value)) throw new Error(`${label}[${index}].${field} is duplicated`); values.add(value); }); return values; }
function text(value: unknown) { return String(value ?? "").trim(); }
function bounded(value: unknown, maximum: number, label: string) { const result = text(value); if (!result || result.length > maximum) throw new Error(`${label} must contain at most ${maximum} characters`); return result; }
function positive(value: unknown, label: string) { const number = Number(value); if (!Number.isInteger(number) || number < 1 || number > 1_000_000) throw new Error(`${label} must be a positive bounded integer`); return number; }
function oneOf(value: unknown, allowed: string[], label: string) { const result = text(value); if (!allowed.includes(result)) throw new Error(`${label} is unsupported`); return result; }
function json(value: unknown, label: string) { if (typeof value !== "string" || value.length > 2_000_000) throw new Error(`${label} must be bounded JSON text`); try { return JSON.parse(value); } catch { throw new Error(`${label} must be valid JSON`); } }
