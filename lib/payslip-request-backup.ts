import type { PrismaClient } from "@prisma/client";

export const PAYSLIP_REQUEST_BACKUP_KEYS = ["staffPayslipMonthAvailability", "staffPayslipRequests", "staffPayslipRequestMonths", "staffPayslipRequestEvents", "staffPayslipDocumentVersions", "staffPayslipDocumentMonths", "staffPayslipAccessEvents"] as const;
export type PayslipRequestBackupKey = (typeof PAYSLIP_REQUEST_BACKUP_KEYS)[number];
export type PayslipRequestBackup = Record<PayslipRequestBackupKey, Record<string, unknown>[]>;

const DELEGATE: Record<PayslipRequestBackupKey, string> = { staffPayslipMonthAvailability: "staffPayslipMonthAvailability", staffPayslipRequests: "staffPayslipRequest", staffPayslipRequestMonths: "staffPayslipRequestMonth", staffPayslipRequestEvents: "staffPayslipRequestEvent", staffPayslipDocumentVersions: "staffPayslipDocumentVersion", staffPayslipDocumentMonths: "staffPayslipDocumentMonth", staffPayslipAccessEvents: "staffPayslipAccessEvent" };
const ALLOWED: Record<PayslipRequestBackupKey, Set<string>> = {
  staffPayslipMonthAvailability: new Set(["id", "publicKey", "staffMemberId", "salaryMonth", "status", "sourceType", "existingPayslipVersionId", "authorizedByUserId", "authorizationReason", "version", "createdAt", "updatedAt"]),
  staffPayslipRequests: new Set(["id", "publicKey", "requestNumber", "submissionKey", "staffMemberId", "purpose", "privateExplanation", "requiredByDate", "status", "correctionOfRequestId", "assignedPreparerUserId", "submittedAt", "preparationStartedAt", "readyToIssueAt", "issuedAt", "rejectedAt", "cancelledAt", "supersededAt", "expiredAt", "retentionReviewDate", "archiveStatus", "legalPolicyHold", "version", "createdAt", "updatedAt"]),
  staffPayslipRequestMonths: new Set(["id", "requestId", "salaryMonth", "availabilitySnapshot", "issueStatus", "activeOverlapKey", "createdAt"]),
  staffPayslipRequestEvents: new Set(["id", "publicKey", "requestId", "eventType", "actorUserId", "actorRole", "previousStatus", "newStatus", "entityVersion", "safeReason", "safeMetadataJson", "requestHash", "occurredAt", "createdAt"]),
  staffPayslipDocumentVersions: new Set(["id", "publicKey", "requestId", "versionNumber", "status", "verificationReference", "sourceStorageKey", "sourceKeyVersion", "sourceNonce", "sourceAuthTag", "sourceSha256", "sourceByteSize", "derivativeStorageKey", "derivativeSha256", "derivativeByteSize", "pageCount", "passwordKeyVersion", "passwordNonce", "passwordCiphertext", "passwordAuthTag", "uploadedByUserId", "approvedByUserId", "issuedByUserId", "issuedAt", "replacementReason", "supersedesVersionId", "createdAt", "updatedAt"]),
  staffPayslipDocumentMonths: new Set(["id", "documentVersionId", "requestMonthId", "salaryMonth", "createdAt"]),
  staffPayslipAccessEvents: new Set(["id", "publicKey", "requestId", "documentVersionId", "staffMemberId", "actorUserId", "sessionId", "eventType", "safeClientJson", "occurredAt", "createdAt"])
};

export async function loadPayslipRequestBackup(client: PrismaClient): Promise<PayslipRequestBackup> {
  const entries = await Promise.all(PAYSLIP_REQUEST_BACKUP_KEYS.map(async (key) => { const delegate = (client as any)[DELEGATE[key]]; return [key, delegate?.findMany ? await delegate.findMany({ orderBy: { createdAt: "asc" } }) : []] as const; }));
  return Object.fromEntries(entries) as PayslipRequestBackup;
}

export function validatePayslipRequestBackupRows(root: Record<string, unknown>): PayslipRequestBackup {
  const result = Object.fromEntries(PAYSLIP_REQUEST_BACKUP_KEYS.map((key) => [key, rows(root[key], key, ALLOWED[key])])) as PayslipRequestBackup;
  const ids = (key: PayslipRequestBackupKey) => new Set(result[key].map((row) => required(row.id, `${key}.id`)));
  const requestIds = ids("staffPayslipRequests"), requestMonthIds = ids("staffPayslipRequestMonths"), documentIds = ids("staffPayslipDocumentVersions");
  unique(result.staffPayslipMonthAvailability, "publicKey"); unique(result.staffPayslipRequests, "publicKey"); unique(result.staffPayslipRequests, "requestNumber"); unique(result.staffPayslipRequests, "submissionKey"); unique(result.staffPayslipRequestEvents, "publicKey"); unique(result.staffPayslipDocumentVersions, "publicKey"); unique(result.staffPayslipDocumentVersions, "verificationReference"); unique(result.staffPayslipDocumentVersions, "sourceStorageKey"); unique(result.staffPayslipDocumentVersions, "derivativeStorageKey"); unique(result.staffPayslipAccessEvents, "publicKey");
  links(result.staffPayslipRequests, "correctionOfRequestId", requestIds, true); links(result.staffPayslipRequestMonths, "requestId", requestIds); links(result.staffPayslipRequestEvents, "requestId", requestIds); links(result.staffPayslipDocumentVersions, "requestId", requestIds); links(result.staffPayslipDocumentVersions, "supersedesVersionId", documentIds, true); links(result.staffPayslipDocumentMonths, "documentVersionId", documentIds); links(result.staffPayslipDocumentMonths, "requestMonthId", requestMonthIds); links(result.staffPayslipAccessEvents, "requestId", requestIds); links(result.staffPayslipAccessEvents, "documentVersionId", documentIds);
  for (const [index, row] of result.staffPayslipDocumentVersions.entries()) {
    for (const field of ["sourceSha256", "derivativeSha256"]) if (!/^[a-f0-9]{64}$/.test(required(row[field], `staffPayslipDocumentVersions[${index}].${field}`))) throw new Error("Payslip document backup contains an invalid SHA-256.");
    if (!/^source\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.enc$/.test(required(row.sourceStorageKey, `staffPayslipDocumentVersions[${index}].sourceStorageKey`)) || !/^delivery\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.pdf$/.test(required(row.derivativeStorageKey, `staffPayslipDocumentVersions[${index}].derivativeStorageKey`))) throw new Error("Payslip document backup contains an invalid private storage key.");
    for (const field of ["sourceNonce", "sourceAuthTag", "passwordNonce", "passwordCiphertext", "passwordAuthTag"]) if (!/^[A-Za-z0-9_-]{8,4096}$/.test(required(row[field], `staffPayslipDocumentVersions[${index}].${field}`))) throw new Error("Payslip document backup contains an invalid encrypted envelope.");
  }
  const keys = PAYSLIP_REQUEST_BACKUP_KEYS.flatMap((key) => result[key].flatMap((row) => Object.keys(row))).map((key) => key.toLowerCase());
  for (const forbidden of ["openingpassword", "ownerpassword", "plaintextpassword", "encryptionkey", "authsessionsecret", "passwordhash"]) if (keys.includes(forbidden)) throw new Error("Payslip request backup contains prohibited plaintext secret material.");
  return result;
}

export async function restorePayslipRequestBackup(client: PrismaClient, backup: PayslipRequestBackup) {
  const result = Object.fromEntries(PAYSLIP_REQUEST_BACKUP_KEYS.map((key) => [key, { created: 0, skipped: 0, errors: [] as string[] }])) as Record<PayslipRequestBackupKey, { created: number; skipped: number; errors: string[] }>;
  for (const key of PAYSLIP_REQUEST_BACKUP_KEYS) { const delegate = (client as any)[DELEGATE[key]]; for (const [index, row] of backup[key].entries()) try { const id = required(row.id, `${key}[${index}].id`); if (await delegate.findUnique({ where: { id }, select: { id: true } })) { result[key].skipped++; continue; } await delegate.create({ data: row }); result[key].created++; } catch (error) { result[key].errors.push(`${key}[${index}]: ${error instanceof Error ? error.message : "restore failed"}`); } }
  return result;
}

function rows(value: unknown, label: string, allowed: Set<string>) { if (value === undefined) return []; if (!Array.isArray(value) || value.length > 100_000) throw new Error(`${label} must be a bounded array.`); return value.map((item, index) => { if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${label}[${index}] must be an object.`); const row = item as Record<string, unknown>; if (!row.id || Object.keys(row).some((key) => !allowed.has(key))) throw new Error(`${label}[${index}] contains unsupported fields.`); return row; }); }
function required(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!result || result.length > 4096) throw new Error(`${label} is required and bounded.`); return result; }
function unique(rows: Record<string, unknown>[], field: string) { const values = new Set<string>(); rows.forEach((row, index) => { const value = required(row[field], `${field}[${index}]`); if (values.has(value)) throw new Error(`${field} is duplicated in payslip request backup.`); values.add(value); }); }
function links(rows: Record<string, unknown>[], field: string, allowed: Set<string>, optional = false) { rows.forEach((row, index) => { if (optional && (row[field] === null || row[field] === undefined || row[field] === "")) return; if (!allowed.has(required(row[field], `${field}[${index}]`))) throw new Error(`Payslip request backup row ${index} has an invalid ${field} relationship.`); }); }
