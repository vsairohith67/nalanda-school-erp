import type { RestoreRecord } from "@/lib/restore";

const PROFILE_KEYS = ["id", "profileCode", "name", "providerKind", "status", "liveUseEnabled", "paymentPostingEnabled", "maximumFileBytes", "maximumImagePixels", "maximumPagesPerBatch", "maximumRowsPerPage", "requestTimeoutMs", "minimumSuggestionConfidence", "retentionDays", "createdAt", "updatedAt"];
const BATCH_KEYS = ["id", "batchNumber", "profileId", "academicYear", "registerName", "registerPeriodStart", "registerPeriodEnd", "status", "sourcePageCount", "extractedRowCount", "verifiedRowCount", "duplicateRowCount", "rejectedRowCount", "postedRowCount", "postingFailedRowCount", "totalExtractedAmountMinor", "totalVerifiedAmountMinor", "totalPostedAmountMinor", "reviewVersion", "approvedReviewVersion", "reviewNotes", "approvalNotes", "rejectionReason", "cancellationReason", "submittedAt", "approvedAt", "postedAt", "cancelledAt", "createdAt", "updatedAt"];
const PAGE_KEYS = ["id", "batchId", "pageNumber", "originalDisplayName", "storageKey", "sourceSha256", "mimeType", "byteSize", "width", "height", "rotationDegrees", "status", "providerKind", "providerRequestReferenceSafe", "overallConfidence", "failureMessageSafe", "processedAt", "verifiedAt", "purgeAfter", "purgedAt", "createdAt", "updatedAt"];
const ROW_KEYS = ["id", "pageId", "rowNumber", "boundingBoxJson", "rawText", "extractedFieldsJson", "fieldConfidenceJson", "candidateMatchesJson", "matchedStudentId", "matchingMethod", "status", "paymentDate", "amountMinor", "paymentMode", "receivedAccount", "academicTerm", "handwrittenReceiptReference", "registerRemarks", "duplicateClassification", "duplicateEvidenceJson", "duplicateResolutionReason", "verificationChecklistJson", "verificationSnapshotJson", "verifiedAt", "rejectedAt", "rejectionReason", "postedPaymentId", "postingFailureSafe", "postedAt", "createdAt", "updatedAt"];
const REVISION_KEYS = ["id", "rowId", "revisionNumber", "previousSnapshotJson", "newSnapshotJson", "changeReason", "createdAt"];
const RUN_KEYS = ["id", "runNumber", "batchId", "reviewVersion", "selectedRowIdsJson", "selectedRowCount", "attemptedAmountMinor", "postedRowCount", "postedAmountMinor", "failedRowCount", "status", "financialPreviewJson", "postingPolicySnapshotJson", "approvalReason", "failureSummaryJson", "approvedAt", "processedAt", "createdAt", "updatedAt"];
const EVENT_KEYS = ["id", "batchId", "pageId", "rowId", "postingRunId", "eventType", "safeReason", "safeMetadataJson", "createdAt"];

export function validateFeeRegisterOcrBackupRows(root: Record<string, unknown>, links: { studentIds: Set<string>; paymentIds: Set<string> }) {
  const profiles = rows(root, "feeRegisterOcrProfiles", PROFILE_KEYS), profileIds = unique(profiles, "profileCode");
  const batches = rows(root, "feeRegisterOcrBatches", BATCH_KEYS), batchIds = unique(batches, "batchNumber");
  for (const [index, row] of batches.entries()) {
    requiredLink(row.profileId, profileIds.ids, `feeRegisterOcrBatches[${index}].profileId`);
    if (!/^\d{4}-\d{2}$/.test(required(row.academicYear, `feeRegisterOcrBatches[${index}].academicYear`))) throw new Error(`feeRegisterOcrBatches[${index}].academicYear is invalid`);
    positiveInteger(row.reviewVersion, `feeRegisterOcrBatches[${index}].reviewVersion`);
    if (row.approvedReviewVersion != null && Number(row.approvedReviewVersion) > Number(row.reviewVersion)) throw new Error(`feeRegisterOcrBatches[${index}] has a future approval version`);
  }
  const pages = rows(root, "feeRegisterOcrPages", PAGE_KEYS), pageIds = unique(pages);
  const pageNumbers = new Set<string>();
  for (const [index, row] of pages.entries()) {
    requiredLink(row.batchId, batchIds.ids, `feeRegisterOcrPages[${index}].batchId`);
    const pageNumber = positiveInteger(row.pageNumber, `feeRegisterOcrPages[${index}].pageNumber`);
    const numberKey = `${row.batchId}|${pageNumber}`; if (pageNumbers.has(numberKey)) throw new Error(`feeRegisterOcrPages[${index}] duplicates a page number`); pageNumbers.add(numberKey);
    if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(required(row.storageKey, `feeRegisterOcrPages[${index}].storageKey`))) throw new Error(`feeRegisterOcrPages[${index}].storageKey is not opaque`);
    if (!/^[a-f0-9]{64}$/.test(required(row.sourceSha256, `feeRegisterOcrPages[${index}].sourceSha256`))) throw new Error(`feeRegisterOcrPages[${index}].sourceSha256 is invalid`);
    if (!["image/jpeg", "image/png", "image/webp"].includes(required(row.mimeType, `feeRegisterOcrPages[${index}].mimeType`))) throw new Error(`feeRegisterOcrPages[${index}].mimeType is unsupported`);
  }
  const ocrRows = rows(root, "feeRegisterOcrRows", ROW_KEYS), rowIds = unique(ocrRows);
  const rowNumbers = new Set<string>(), paymentLinks = new Set<string>();
  for (const [index, row] of ocrRows.entries()) {
    requiredLink(row.pageId, pageIds.ids, `feeRegisterOcrRows[${index}].pageId`);
    const rowNumber = positiveInteger(row.rowNumber, `feeRegisterOcrRows[${index}].rowNumber`), key = `${row.pageId}|${rowNumber}`;
    if (rowNumbers.has(key)) throw new Error(`feeRegisterOcrRows[${index}] duplicates a row number`); rowNumbers.add(key);
    if (row.matchedStudentId != null) requiredLink(row.matchedStudentId, links.studentIds, `feeRegisterOcrRows[${index}].matchedStudentId`);
    if (row.postedPaymentId != null) {
      const paymentId = required(row.postedPaymentId, `feeRegisterOcrRows[${index}].postedPaymentId`);
      requiredLink(paymentId, links.paymentIds, `feeRegisterOcrRows[${index}].postedPaymentId`);
      if (paymentLinks.has(paymentId)) throw new Error(`feeRegisterOcrRows[${index}] links a Payment already used by another OCR row`);
      paymentLinks.add(paymentId);
    }
    if (row.status === "POSTED" && row.postedPaymentId == null) throw new Error(`feeRegisterOcrRows[${index}] is POSTED without a Payment link`);
  }
  const revisions = rows(root, "feeRegisterOcrRowRevisions", REVISION_KEYS); unique(revisions);
  const revisionNumbers = new Set<string>();
  revisions.forEach((row, index) => {
    requiredLink(row.rowId, rowIds.ids, `feeRegisterOcrRowRevisions[${index}].rowId`);
    const number = positiveInteger(row.revisionNumber, `feeRegisterOcrRowRevisions[${index}].revisionNumber`), key = `${row.rowId}|${number}`;
    if (revisionNumbers.has(key)) throw new Error(`feeRegisterOcrRowRevisions[${index}] duplicates a revision number`); revisionNumbers.add(key);
  });
  const postingRuns = rows(root, "feeRegisterOcrPostingRuns", RUN_KEYS), runIds = unique(postingRuns, "runNumber");
  postingRuns.forEach((row, index) => {
    requiredLink(row.batchId, batchIds.ids, `feeRegisterOcrPostingRuns[${index}].batchId`);
    const selected = jsonArray(row.selectedRowIdsJson, `feeRegisterOcrPostingRuns[${index}].selectedRowIdsJson`);
    if (selected.some((id) => typeof id !== "string" || !rowIds.ids.has(id))) throw new Error(`feeRegisterOcrPostingRuns[${index}] contains an invalid selected row link`);
  });
  const events = rows(root, "feeRegisterOcrEvents", EVENT_KEYS); unique(events);
  events.forEach((row, index) => {
    requiredLink(row.batchId, batchIds.ids, `feeRegisterOcrEvents[${index}].batchId`);
    if (row.pageId != null) requiredLink(row.pageId, pageIds.ids, `feeRegisterOcrEvents[${index}].pageId`);
    if (row.rowId != null) requiredLink(row.rowId, rowIds.ids, `feeRegisterOcrEvents[${index}].rowId`);
    if (row.postingRunId != null) requiredLink(row.postingRunId, runIds.ids, `feeRegisterOcrEvents[${index}].postingRunId`);
  });
  return {
    feeRegisterOcrProfiles: profiles, feeRegisterOcrBatches: batches, feeRegisterOcrPages: pages,
    feeRegisterOcrRows: ocrRows, feeRegisterOcrRowRevisions: revisions,
    feeRegisterOcrPostingRuns: postingRuns, feeRegisterOcrEvents: events
  };
}

function rows(root: Record<string, unknown>, key: string, allowed: string[]) {
  if (root[key] == null) return [] as RestoreRecord[];
  if (!Array.isArray(root[key]) || root[key].length > 100_000) throw new Error(`${key} must be a bounded array`);
  return root[key].map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${key}[${index}] must be an object`);
    const row = value as RestoreRecord, extras = Object.keys(row).filter((field) => !allowed.includes(field));
    if (extras.length) throw new Error(`${key}[${index}] contains unsupported or sensitive fields`);
    required(row.id, `${key}[${index}].id`);
    return row;
  });
}
function unique(values: RestoreRecord[], naturalKey?: string) {
  const ids = new Set<string>(), natural = new Set<string>();
  values.forEach((row, index) => {
    const id = required(row.id, `row[${index}].id`); if (ids.has(id)) throw new Error(`OCR backup duplicates record id ${id}`); ids.add(id);
    if (naturalKey) { const value = required(row[naturalKey], `row[${index}].${naturalKey}`); if (natural.has(value)) throw new Error(`OCR backup duplicates ${naturalKey} ${value}`); natural.add(value); }
  });
  return { ids, natural };
}
function required(value: unknown, label: string) { const text = String(value ?? "").trim(); if (!text || text.length > 1000) throw new Error(`${label} is required`); return text; }
function requiredLink(value: unknown, ids: Set<string>, label: string) { const id = required(value, label); if (!ids.has(id)) throw new Error(`${label} does not match a backup record`); return id; }
function positiveInteger(value: unknown, label: string) { const number = Number(value); if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive integer`); return number; }
function jsonArray(value: unknown, label: string) { try { const parsed = JSON.parse(required(value, label)); if (!Array.isArray(parsed)) throw new Error(); return parsed as unknown[]; } catch { throw new Error(`${label} must be a JSON array`); } }
