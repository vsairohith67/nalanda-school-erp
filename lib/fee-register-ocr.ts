import { randomUUID } from "node:crypto";
import { normalizeClassName, PAYMENT_MODES, RECEIVED_ACCOUNTS, TERM_HINTS } from "@/lib/constants";
import { normalizePaymentMode, normalizeReceivedAccount, parsePaymentImportAmount, parsePaymentImportDate } from "@/lib/payment-import";
import { runFeeRegisterOcrProvider, type OcrProviderKind, type OcrProviderRow } from "@/lib/fee-register-ocr-provider";
import type { Permission } from "@/lib/permissions";

export const OCR_BATCH_STATUSES = ["DRAFT", "UPLOADED", "PROCESSING", "NEEDS_REVIEW", "READY_FOR_APPROVAL", "APPROVED", "POSTING", "PARTIALLY_POSTED", "POSTED", "REJECTED", "CANCELLED", "ARCHIVED"] as const;
export const OCR_ROW_STATUSES = ["EXTRACTED", "NEEDS_REVIEW", "MATCHED", "VERIFIED", "DUPLICATE", "REJECTED", "POSTED", "POSTING_FAILED"] as const;
export const OCR_DUPLICATE_CLASSES = ["EXACT_DUPLICATE", "LIKELY_DUPLICATE", "POSSIBLE_DUPLICATE", "NO_DUPLICATE", "INSUFFICIENT_DATA"] as const;
export const OCR_CHECKLIST_KEYS = ["sourceRowVisible", "studentMatch", "paymentDate", "amount", "paymentMode", "academicYearTerm", "handwrittenReference", "duplicateResult", "registerRemarks"] as const;
const OCR_TERMINAL_BATCH_STATUSES = new Set(["POSTING", "PARTIALLY_POSTED", "POSTED", "REJECTED", "CANCELLED", "ARCHIVED"]);
const OCR_TERMINAL_ROW_STATUSES = new Set(["DUPLICATE", "REJECTED", "POSTED"]);
const OCR_PRE_APPROVAL_CANCEL_STATUSES = new Set(["DRAFT", "UPLOADED", "PROCESSING", "NEEDS_REVIEW", "READY_FOR_APPROVAL"]);
const OCR_CONTENT_ADDITION_STATUSES = new Set(["DRAFT", "UPLOADED", "PROCESSING", "NEEDS_REVIEW"]);

export async function ensureFeeRegisterOcrFoundation(client: any) {
  const legacyMock = await client.feeRegisterOcrProfile.findUnique({ where: { profileCode: "QA20B-MOCK" } });
  const currentMock = await client.feeRegisterOcrProfile.findUnique({ where: { profileCode: "OCR-MOCK-DETERMINISTIC" } });
  if (legacyMock && !currentMock) {
    await client.feeRegisterOcrProfile.update({
      where: { id: legacyMock.id },
      data: { profileCode: "OCR-MOCK-DETERMINISTIC", name: "Deterministic MOCK OCR" }
    });
  } else if (legacyMock && currentMock) {
    const linked = await client.feeRegisterOcrBatch.count({ where: { profileId: legacyMock.id } });
    if (!linked) await client.feeRegisterOcrProfile.delete({ where: { id: legacyMock.id } });
  }
  await client.feeRegisterOcrProfile.upsert({
    where: { profileCode: "OCR-MOCK-DETERMINISTIC" },
    update: { liveUseEnabled: false, paymentPostingEnabled: false },
    create: {
      profileCode: "OCR-MOCK-DETERMINISTIC", name: "Deterministic MOCK OCR", providerKind: "MOCK",
      status: "ACTIVE", liveUseEnabled: false, paymentPostingEnabled: false
    }
  });
  await client.feeRegisterOcrProfile.upsert({
    where: { profileCode: "MANUAL-TRANSCRIPTION" },
    update: { liveUseEnabled: false, paymentPostingEnabled: false },
    create: {
      profileCode: "MANUAL-TRANSCRIPTION", name: "Manual transcription", providerKind: "MANUAL",
      status: "ACTIVE", liveUseEnabled: false, paymentPostingEnabled: false
    }
  });
  for (const providerKind of ["LOCAL_HTTP", "CLOUD_API"]) {
    await client.feeRegisterOcrProfile.upsert({
      where: { profileCode: `OCR-${providerKind}-DISABLED` },
      update: { status: "DISABLED", liveUseEnabled: false, paymentPostingEnabled: false },
      create: {
        profileCode: `OCR-${providerKind}-DISABLED`, name: `${providerKind} disabled adapter`,
        providerKind, status: "DISABLED", liveUseEnabled: false, paymentPostingEnabled: false
      }
    });
  }
}

export function validateOcrBatchInput(input: Record<string, unknown>) {
  const registerName = requiredText(input.registerName, "Register name", 160);
  const academicYear = requiredText(input.academicYear, "Academic year", 20);
  if (!/^\d{4}-\d{2}$/.test(academicYear)) throw new Error("Academic year must use YYYY-YY format");
  const registerPeriodStart = optionalDate(input.registerPeriodStart, "Register period start");
  const registerPeriodEnd = optionalDate(input.registerPeriodEnd, "Register period end");
  if (registerPeriodStart && registerPeriodEnd && registerPeriodEnd < registerPeriodStart) throw new Error("Register period end must not be before its start");
  return { registerName, academicYear, registerPeriodStart, registerPeriodEnd };
}

export async function createOcrBatch(client: any, input: Record<string, unknown>, actorId: string) {
  const data = validateOcrBatchInput(input);
  const profileId = requiredText(input.profileId, "OCR profile", 100);
  const profile = await client.feeRegisterOcrProfile.findUnique({ where: { id: profileId } });
  if (!profile || profile.status !== "ACTIVE" || !["MOCK", "MANUAL"].includes(profile.providerKind)) throw new Error("Only an active MOCK or MANUAL profile may be used");
  const batchNumber = `OCR-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomUUID().slice(0, 6).toUpperCase()}`;
  return client.$transaction(async (tx: any) => {
    const batch = await tx.feeRegisterOcrBatch.create({ data: { ...data, profileId, batchNumber, createdByUserId: actorId } });
    await addOcrEvent(tx, batch.id, "BATCH_CREATED", actorId, "Private OCR staging batch created", { providerKind: profile.providerKind });
    return batch;
  });
}

export async function extractOcrPage(client: any, pageId: string, actorId: string) {
  return client.$transaction(async (tx: any) => {
    const page = await tx.feeRegisterOcrPage.findUnique({ where: { id: pageId }, include: { batch: { include: { profile: true } }, rows: true } });
    if (!page) throw new Error("OCR page not found");
    assertOcrBatchContentAdditionAllowed(page.batch.status);
    if (page.status === "PURGED" || page.status === "MISSING_SOURCE") throw new Error("OCR source image is unavailable");
    if (page.rows.length) throw new Error("This page already has extracted or manually transcribed rows");
    const profile = page.batch.profile;
    if (profile.status !== "ACTIVE" || !["MOCK", "MANUAL"].includes(profile.providerKind)) throw new Error("The selected OCR provider is not active for Prompt 20B");
    await tx.feeRegisterOcrPage.update({ where: { id: page.id }, data: { status: "PROCESSING", failureMessageSafe: null } });
    await addOcrEvent(tx, page.batchId, "OCR_STARTED", actorId, `${profile.providerKind} extraction started`, { pageId: page.id });
    try {
      const response = runFeeRegisterOcrProvider(profile.providerKind as OcrProviderKind, { sourceSha256: page.sourceSha256, maximumRows: profile.maximumRowsPerPage });
      for (const row of response.rows) {
        const normalized = normalizeProviderRow(row);
        const match = await matchStudentForOcr(tx, page.batch.academicYear, normalized.fields, profile.minimumSuggestionConfidence);
        const created = await tx.feeRegisterOcrRow.create({
          data: {
            pageId: page.id,
            rowNumber: row.rowNumber,
            boundingBoxJson: row.boundingBox ? JSON.stringify(row.boundingBox) : null,
            rawText: row.rawText,
            extractedFieldsJson: JSON.stringify(normalized.fields),
            fieldConfidenceJson: JSON.stringify(row.confidence),
            candidateMatchesJson: JSON.stringify(match.candidates),
            matchedStudentId: match.student?.id ?? null,
            matchingMethod: match.method,
            status: match.student ? "MATCHED" : "NEEDS_REVIEW",
            paymentDate: normalized.paymentDate,
            amountMinor: normalized.amountMinor,
            paymentMode: normalized.paymentMode,
            receivedAccount: normalized.receivedAccount,
            academicTerm: normalized.academicTerm,
            handwrittenReceiptReference: normalized.handwrittenReceiptReference,
            registerRemarks: normalized.registerRemarks
          }
        });
        const duplicate = await detectOcrDuplicate(tx, created.id);
        await tx.feeRegisterOcrRow.update({ where: { id: created.id }, data: { duplicateClassification: duplicate.classification, duplicateEvidenceJson: JSON.stringify(duplicate.evidence), ...(duplicate.classification === "EXACT_DUPLICATE" ? { status: "DUPLICATE" } : {}) } });
      }
      await tx.feeRegisterOcrPage.update({ where: { id: page.id }, data: { status: response.rows.length ? "NEEDS_REVIEW" : "NEEDS_REVIEW", rawOcrText: response.rawText.slice(0, 50_000), overallConfidence: response.confidence, processedAt: new Date() } });
      await refreshOcrBatch(tx, page.batchId);
      await addOcrEvent(tx, page.batchId, "OCR_COMPLETED", actorId, `${profile.providerKind} extraction completed`, { pageId: page.id, rowCount: response.rows.length });
      return tx.feeRegisterOcrPage.findUnique({ where: { id: page.id }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
    } catch (error) {
      await tx.feeRegisterOcrPage.update({ where: { id: page.id }, data: { status: "FAILED", failureMessageSafe: safeOcrError(error) } });
      await refreshOcrBatch(tx, page.batchId);
      await addOcrEvent(tx, page.batchId, "OCR_FAILED", actorId, safeOcrError(error), { pageId: page.id });
      throw error;
    }
  });
}

export async function addManualOcrRow(client: any, pageId: string, input: Record<string, unknown>, actorId: string) {
  return client.$transaction(async (tx: any) => {
    const page = await tx.feeRegisterOcrPage.findUnique({ where: { id: pageId }, include: { batch: { include: { profile: true } }, rows: { select: { rowNumber: true } } } });
    if (!page) throw new Error("OCR page not found");
    assertOcrBatchContentAdditionAllowed(page.batch.status);
    if (["PURGED", "MISSING_SOURCE"].includes(page.status)) throw new Error("The source page must remain available for transcription");
    if (page.rows.length >= page.batch.profile.maximumRowsPerPage) throw new Error("This OCR page reached its configured row limit");
    const rowNumber = Number(input.rowNumber ?? Math.max(0, ...page.rows.map((row: any) => row.rowNumber)) + 1);
    const normalized = normalizeEditableRow(input);
    const match = await matchStudentForOcr(tx, page.batch.academicYear, normalized.fields, page.batch.profile.minimumSuggestionConfidence);
    const row = await tx.feeRegisterOcrRow.create({
      data: {
        pageId, rowNumber, rawText: optionalText(input.rawText, "Raw transcription", 2_000) ?? "Manual transcription",
        extractedFieldsJson: JSON.stringify(normalized.fields),
        fieldConfidenceJson: JSON.stringify(Object.fromEntries(Object.keys(normalized.fields).map((key) => [key, "MISSING"]))),
        candidateMatchesJson: JSON.stringify(match.candidates), matchedStudentId: match.student?.id ?? null,
        matchingMethod: match.method, status: match.student ? "MATCHED" : "NEEDS_REVIEW", ...normalized.data
      }
    });
    await tx.feeRegisterOcrPage.update({ where: { id: pageId }, data: { status: "NEEDS_REVIEW" } });
    await invalidateBatchApproval(tx, page.batchId, actorId);
    await refreshOcrBatch(tx, page.batchId);
    await addOcrEvent(tx, page.batchId, "ROW_CORRECTED", actorId, "Manual transcription row added", { pageId, rowId: row.id });
    return row;
  });
}

export async function updateOcrRow(client: any, rowId: string, input: Record<string, unknown>, actorId: string) {
  return client.$transaction(async (tx: any) => {
    const row = await tx.feeRegisterOcrRow.findUnique({ where: { id: rowId }, include: { page: { include: { batch: { include: { profile: true } } } }, revisions: { select: { revisionNumber: true }, orderBy: { revisionNumber: "desc" }, take: 1 } } });
    if (!row) throw new Error("OCR row not found");
    assertOcrRowMutationAllowed(row);
    const reason = requiredText(input.changeReason, "Correction reason", 500);
    const normalized = normalizeEditableRow(input);
    const before = rowSnapshot(row);
    const match = await matchStudentForOcr(tx, row.page.batch.academicYear, normalized.fields, row.page.batch.profile.minimumSuggestionConfidence);
    const data = {
      ...normalized.data,
      extractedFieldsJson: JSON.stringify(normalized.fields),
      candidateMatchesJson: JSON.stringify(match.candidates),
      matchedStudentId: match.student?.id ?? null,
      matchingMethod: match.method,
      status: match.student ? "MATCHED" : "NEEDS_REVIEW",
      verificationChecklistJson: null, verificationSnapshotJson: null, verifiedByUserId: null, verifiedAt: null,
      duplicateResolutionReason: null
    };
    const after = { ...before, ...data };
    await tx.feeRegisterOcrRowRevision.create({ data: { rowId, revisionNumber: (row.revisions[0]?.revisionNumber ?? 0) + 1, previousSnapshotJson: JSON.stringify(before), newSnapshotJson: JSON.stringify(after), changeReason: reason, changedByUserId: actorId } });
    await tx.feeRegisterOcrRow.update({ where: { id: rowId }, data });
    const duplicate = await detectOcrDuplicate(tx, rowId);
    await tx.feeRegisterOcrRow.update({ where: { id: rowId }, data: { duplicateClassification: duplicate.classification, duplicateEvidenceJson: JSON.stringify(duplicate.evidence), ...(duplicate.classification === "EXACT_DUPLICATE" ? { status: "DUPLICATE" } : {}) } });
    await invalidateBatchApproval(tx, row.page.batchId, actorId);
    await refreshOcrBatch(tx, row.page.batchId);
    await addOcrEvent(tx, row.page.batchId, "ROW_CORRECTED", actorId, reason, { pageId: row.pageId, rowId });
    return tx.feeRegisterOcrRow.findUnique({ where: { id: rowId }, include: { revisions: { orderBy: { revisionNumber: "asc" } } } });
  });
}

export async function confirmOcrStudentMatch(client: any, rowId: string, studentId: string, actorId: string) {
  return client.$transaction(async (tx: any) => {
    const row = await tx.feeRegisterOcrRow.findUnique({ where: { id: rowId }, include: { page: { include: { batch: true } } } });
    if (!row) throw new Error("OCR row not found");
    assertOcrRowMutationAllowed(row);
    const student = await tx.student.findFirst({ where: { id: studentId, deletedAt: null }, include: { academicYearEnrollments: { where: { academicYear: row.page.batch.academicYear } } } });
    if (!student || !student.academicYearEnrollments.some((item: any) => item.status === "ACTIVE")) throw new Error("Student does not have an active enrollment for this OCR academic year");
    await tx.feeRegisterOcrRow.update({ where: { id: rowId }, data: { matchedStudentId: student.id, matchingMethod: "MANUAL_SELECTION", status: "MATCHED", verificationChecklistJson: null, verificationSnapshotJson: null, verifiedByUserId: null, verifiedAt: null } });
    await invalidateBatchApproval(tx, row.page.batchId, actorId);
    await addOcrEvent(tx, row.page.batchId, "ROW_MATCHED", actorId, "Student match confirmed manually", { rowId, pageId: row.pageId, admissionNo: student.admissionNo });
    return tx.feeRegisterOcrRow.findUnique({ where: { id: rowId } });
  });
}

export async function resolveOcrDuplicate(client: any, rowId: string, input: Record<string, unknown>, actorId: string) {
  return client.$transaction(async (tx: any) => {
    const row = await tx.feeRegisterOcrRow.findUnique({ where: { id: rowId }, include: { page: { include: { batch: true } } } });
    if (!row) throw new Error("OCR row not found");
    assertOcrRowMutationAllowed(row);
    const reason = requiredText(input.reason, "Duplicate resolution reason", 500);
    const latest = await detectOcrDuplicate(tx, rowId);
    if (latest.classification === "EXACT_DUPLICATE") throw new Error("An exact duplicate cannot be cleared for posting");
    if (!["LIKELY_DUPLICATE", "POSSIBLE_DUPLICATE"].includes(latest.classification)) throw new Error("This row has no duplicate warning requiring resolution");
    await tx.feeRegisterOcrRow.update({ where: { id: rowId }, data: { duplicateClassification: latest.classification, duplicateEvidenceJson: JSON.stringify(latest.evidence), duplicateResolutionReason: reason, status: row.matchedStudentId ? "MATCHED" : "NEEDS_REVIEW" } });
    await invalidateBatchApproval(tx, row.page.batchId, actorId);
    await addOcrEvent(tx, row.page.batchId, "DUPLICATE_RESOLVED", actorId, reason, { rowId, classification: latest.classification });
    return latest;
  });
}

export async function markOcrRowDuplicate(client: any, rowId: string, reasonInput: unknown, actorId: string) {
  const reason = requiredText(reasonInput, "Duplicate reason", 500);
  return client.$transaction(async (tx: any) => {
    const row = await tx.feeRegisterOcrRow.findUnique({ where: { id: rowId }, include: { page: { include: { batch: true } } } });
    if (!row) throw new Error("OCR row not found");
    assertOcrRowMutationAllowed(row);
    await tx.feeRegisterOcrRow.update({ where: { id: rowId }, data: {
      status: "DUPLICATE", duplicateClassification: "EXACT_DUPLICATE",
      duplicateEvidenceJson: JSON.stringify([{ source: "AUTHORISED_MANUAL_REVIEW", reason }]),
      duplicateResolutionReason: null, verificationChecklistJson: null, verificationSnapshotJson: null,
      verifiedByUserId: null, verifiedAt: null
    } });
    await invalidateBatchApproval(tx, row.page.batchId, actorId);
    await refreshOcrBatch(tx, row.page.batchId);
    await addOcrEvent(tx, row.page.batchId, "DUPLICATE_DETECTED", actorId, reason, { rowId, classification: "EXACT_DUPLICATE" });
    return tx.feeRegisterOcrRow.findUnique({ where: { id: rowId } });
  });
}

export async function verifyOcrRow(client: any, rowId: string, checklistInput: Record<string, unknown>, actorId: string) {
  return client.$transaction(async (tx: any) => {
    const row = await tx.feeRegisterOcrRow.findUnique({ where: { id: rowId }, include: { page: { include: { batch: true } } } });
    if (!row) throw new Error("OCR row not found");
    assertOcrRowMutationAllowed(row);
    if (!row.matchedStudentId || !row.paymentDate || !row.amountMinor || !row.paymentMode || !row.academicTerm) throw new Error("Student, date, positive amount, payment mode, and academic term are required");
    const student = await tx.student.findFirst({ where: { id: row.matchedStudentId, deletedAt: null }, include: { academicYearEnrollments: { where: { academicYear: row.page.batch.academicYear } } } });
    if (!student || !student.academicYearEnrollments.some((item: any) => item.status === "ACTIVE")) throw new Error("Student enrollment must be revalidated before verification");
    const duplicate = await detectOcrDuplicate(tx, rowId);
    if (duplicate.classification === "EXACT_DUPLICATE") throw new Error("Exact duplicate rows cannot be verified");
    if (["LIKELY_DUPLICATE", "POSSIBLE_DUPLICATE"].includes(duplicate.classification) && !row.duplicateResolutionReason) throw new Error("Resolve the duplicate warning with a reason before verification");
    const checklist = Object.fromEntries(OCR_CHECKLIST_KEYS.map((key) => [key, checklistInput[key] === true]));
    if (Object.values(checklist).some((value) => !value)) throw new Error("Every financial verification checklist item must be explicitly confirmed");
    const snapshot = { ...rowSnapshot(row), sourceSha256: row.page.sourceSha256, reviewVersion: row.page.batch.reviewVersion, checklist };
    await tx.feeRegisterOcrRow.update({ where: { id: rowId }, data: { status: "VERIFIED", verificationChecklistJson: JSON.stringify(checklist), verificationSnapshotJson: JSON.stringify(snapshot), verifiedByUserId: actorId, verifiedAt: new Date(), duplicateClassification: duplicate.classification, duplicateEvidenceJson: JSON.stringify(duplicate.evidence) } });
    await refreshOcrBatch(tx, row.page.batchId);
    await addOcrEvent(tx, row.page.batchId, "ROW_VERIFIED", actorId, "Every financial field was confirmed against the source", { rowId, pageId: row.pageId });
    return tx.feeRegisterOcrRow.findUnique({ where: { id: rowId } });
  });
}

export async function rejectOcrRow(client: any, rowId: string, reasonInput: unknown, actorId: string) {
  const reason = requiredText(reasonInput, "Rejection reason", 500);
  return client.$transaction(async (tx: any) => {
    const row = await tx.feeRegisterOcrRow.findUnique({ where: { id: rowId }, include: { page: { include: { batch: true } } } });
    if (!row) throw new Error("OCR row not found");
    assertOcrRowMutationAllowed(row);
    await tx.feeRegisterOcrRow.update({ where: { id: rowId }, data: { status: "REJECTED", rejectionReason: reason, rejectedByUserId: actorId, rejectedAt: new Date(), verificationChecklistJson: null, verificationSnapshotJson: null, verifiedByUserId: null, verifiedAt: null } });
    await invalidateBatchApproval(tx, row.page.batchId, actorId);
    await refreshOcrBatch(tx, row.page.batchId);
    await addOcrEvent(tx, row.page.batchId, "ROW_REJECTED", actorId, reason, { rowId });
  });
}

export async function transitionOcrBatch(client: any, batchId: string, input: Record<string, unknown>, actor: { id: string; role: string }) {
  const action = String(input.action ?? "");
  return client.$transaction(async (tx: any) => {
    const batch = await tx.feeRegisterOcrBatch.findUnique({ where: { id: batchId }, include: { pages: { include: { rows: true } } } });
    if (!batch) throw new Error("OCR batch not found");
    const rows = batch.pages.flatMap((page: any) => page.rows);
    const now = new Date();
    if (action === "submit") {
      if (!["UPLOADED", "NEEDS_REVIEW"].includes(batch.status)) throw new Error("Only an uploaded batch under review can be submitted");
      if (!rows.length || rows.some((row: any) => !["VERIFIED", "REJECTED", "DUPLICATE"].includes(row.status))) throw new Error("Every OCR row must be verified, rejected, or marked as an exact duplicate before submission");
      if (!rows.some((row: any) => row.status === "VERIFIED")) throw new Error("At least one row must be verified before submission");
      await tx.feeRegisterOcrBatch.update({ where: { id: batchId }, data: { status: "READY_FOR_APPROVAL", submittedByUserId: actor.id, submittedAt: now, reviewNotes: optionalText(input.reason, "Review notes", 1000) } });
      await addOcrEvent(tx, batchId, "BATCH_SUBMITTED", actor.id, "Batch submitted for independent approval");
    } else if (action === "approve") {
      if (batch.status !== "READY_FOR_APPROVAL") throw new Error("Only a submitted OCR batch can be approved");
      const verifiedReviewers = new Set(rows.filter((row: any) => row.status === "VERIFIED").map((row: any) => row.verifiedByUserId));
      if (verifiedReviewers.has(actor.id)) {
        const override = input.samePersonOverride === true && ["SUPER_ADMIN", "DIRECTOR"].includes(actor.role);
        if (!override) throw new Error("The batch approver must be distinct from row reviewers");
        requiredText(input.reason, "Director same-person override reason", 1000);
      }
      await tx.feeRegisterOcrBatch.update({ where: { id: batchId }, data: { status: "APPROVED", approvedReviewVersion: batch.reviewVersion, approvedByUserId: actor.id, approvedAt: now, approvalNotes: optionalText(input.reason, "Approval notes", 1000) } });
      await addOcrEvent(tx, batchId, "BATCH_APPROVED", actor.id, "Approval bound to the current review version", { reviewVersion: batch.reviewVersion });
    } else if (action === "cancel") {
      if (!ocrBatchCancelPermission(batch.status)) throw new Error(`An OCR batch in ${batch.status} status cannot be cancelled`);
      const reason = requiredText(input.reason, "Cancellation reason", 1000);
      await tx.feeRegisterOcrBatch.update({ where: { id: batchId }, data: { status: "CANCELLED", cancellationReason: reason, cancelledByUserId: actor.id, cancelledAt: now } });
      await addOcrEvent(tx, batchId, "BATCH_CANCELLED", actor.id, reason);
    } else throw new Error("Unsupported OCR batch action");
    return tx.feeRegisterOcrBatch.findUnique({ where: { id: batchId } });
  });
}

export function ocrBatchCancelPermission(status: string): Permission | null {
  if (OCR_PRE_APPROVAL_CANCEL_STATUSES.has(status)) return "REVIEW_FEE_REGISTER_OCR_ROWS";
  if (status === "APPROVED") return "APPROVE_FEE_REGISTER_OCR_BATCHES";
  return null;
}

export function assertOcrBatchRowMutationAllowed(status: string) {
  if (OCR_TERMINAL_BATCH_STATUSES.has(status)) {
    throw new Error(`OCR rows cannot be changed while the batch is in ${status} status`);
  }
}

export function assertOcrBatchContentAdditionAllowed(status: string) {
  assertOcrBatchRowMutationAllowed(status);
  if (!OCR_CONTENT_ADDITION_STATUSES.has(status)) {
    throw new Error(`OCR source content cannot be added while the batch is in ${status} status`);
  }
}

export function assertOcrRowMutationAllowed(row: { status: string; page: { batch: { status: string } } }) {
  assertOcrBatchRowMutationAllowed(row.page.batch.status);
  if (OCR_TERMINAL_ROW_STATUSES.has(row.status)) {
    throw new Error(`An OCR row in ${row.status} status cannot be changed`);
  }
}

export async function previewOcrPosting(client: any, batchId: string, selectedRowIds: string[], actorId: string) {
  return client.$transaction(async (tx: any) => {
    const batch = await tx.feeRegisterOcrBatch.findUnique({ where: { id: batchId }, include: { profile: true, pages: { include: { rows: true } } } });
    if (!batch || batch.status !== "APPROVED" || batch.approvedReviewVersion !== batch.reviewVersion) throw new Error("An approved current review version is required for posting preview");
    const selected = batch.pages.flatMap((page: any) => page.rows).filter((row: any) => selectedRowIds.includes(row.id));
    if (!selected.length || selected.length !== new Set(selectedRowIds).size || selected.some((row: any) => row.status !== "VERIFIED")) throw new Error("Select only verified OCR rows");
    const selectedStudentIds = [...new Set(selected.map((row: any) => row.matchedStudentId).filter(Boolean))];
    const admissions = new Map((await tx.student.findMany({
      where: { id: { in: selectedStudentIds } },
      select: { id: true, admissionNo: true }
    })).map((student: any) => [student.id, student.admissionNo]));
    const pageNumbers = new Map(batch.pages.flatMap((page: any) => page.rows.map((row: any) => [row.id, page.pageNumber])));
    const rechecks = [];
    for (const row of selected) {
      const duplicate = await detectOcrDuplicate(tx, row.id);
      rechecks.push({
        pageNumber: pageNumbers.get(row.id),
        rowNumber: row.rowNumber,
        classification: duplicate.classification,
        evidence: duplicate.evidence.map(safeDuplicateEvidence)
      });
      if (duplicate.classification === "EXACT_DUPLICATE") throw new Error("Posting preview stopped because an exact duplicate was found");
      if (["LIKELY_DUPLICATE", "POSSIBLE_DUPLICATE"].includes(duplicate.classification) && !row.duplicateResolutionReason) throw new Error("Posting preview stopped because a duplicate warning is unresolved");
    }
    const attemptedAmountMinor = selected.reduce((sum: number, row: any) => sum + row.amountMinor, 0);
    const blockers = [
      ...(!batch.profile.paymentPostingEnabled ? ["Payment posting is disabled on the OCR profile."] : []),
      "Existing Payment creation does not yet prove outstanding-balance and exact fee-allocation enforcement for OCR rows.",
      "Reviewed import-ready CSV is the authorised Prompt 20B handoff."
    ];
    const financialPreview = {
      zeroWrites: true,
      selectedRows: selected.map((row: any) => ({
        pageNumber: pageNumbers.get(row.id),
        rowNumber: row.rowNumber,
        admissionNo: admissions.get(row.matchedStudentId) ?? "UNAVAILABLE",
        paymentDate: row.paymentDate?.toISOString().slice(0, 10),
        amountMinor: row.amountMinor,
        paymentMode: row.paymentMode,
        handwrittenReceiptReference: row.handwrittenReceiptReference
      })),
      duplicateRechecks: rechecks,
      attemptedAmountMinor,
      blockers
    };
    const run = await tx.feeRegisterOcrPostingRun.create({
      data: {
        runNumber: `OCR-POST-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomUUID().slice(0, 6).toUpperCase()}`,
        batchId, reviewVersion: batch.reviewVersion, selectedRowIdsJson: JSON.stringify(selectedRowIds),
        selectedRowCount: selected.length, attemptedAmountMinor, financialPreviewJson: JSON.stringify(financialPreview),
        postingPolicySnapshotJson: JSON.stringify({ paymentPostingEnabled: false, historicalCashBookBasis: "Payment.date", postingMode: "REVIEWED_EXPORT_ONLY", exactPaymentWrites: 0 }),
        createdByUserId: actorId
      }
    });
    await addOcrEvent(tx, batchId, "POSTING_PREVIEWED", actorId, "Financial preview completed with zero Payment writes", { selectedRowCount: selected.length, attemptedAmountMinor });
    return {
      run: {
        runNumber: run.runNumber,
        status: run.status,
        reviewVersion: run.reviewVersion,
        selectedRowCount: run.selectedRowCount,
        attemptedAmountMinor: run.attemptedAmountMinor
      },
      financialPreview
    };
  });
}

export async function processOcrPosting() {
  throw new Error("OCR Payment posting remains disabled: the current Payment helper does not prove outstanding-balance and exact fee-allocation enforcement. Use the reviewed staging CSV.");
}

function safeDuplicateEvidence(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !key.toLowerCase().endsWith("id")));
}

export async function detectOcrDuplicate(client: any, rowId: string): Promise<{ classification: (typeof OCR_DUPLICATE_CLASSES)[number]; evidence: Array<Record<string, unknown>> }> {
  const row = await client.feeRegisterOcrRow.findUnique({ where: { id: rowId }, include: { page: { include: { batch: true } } } });
  if (!row || !row.matchedStudentId || !row.paymentDate || !row.amountMinor) return { classification: "INSUFFICIENT_DATA", evidence: [] };
  if (row.postedPaymentId) return { classification: "EXACT_DUPLICATE", evidence: [{ source: "POSTED_LINK", paymentId: row.postedPaymentId }] };
  const start = new Date(row.paymentDate); start.setUTCDate(start.getUTCDate() - 3);
  const end = new Date(row.paymentDate); end.setUTCDate(end.getUTCDate() + 4);
  const [ocrRows, payments] = await Promise.all([
    client.feeRegisterOcrRow.findMany({
      where: { id: { not: row.id }, matchedStudentId: row.matchedStudentId, amountMinor: row.amountMinor, paymentDate: { gte: start, lt: end }, status: { not: "REJECTED" } },
      select: { id: true, paymentDate: true, handwrittenReceiptReference: true, page: { select: { batchId: true } } }, take: 20
    }),
    client.payment.findMany({
      where: { studentId: row.matchedStudentId, amountPaid: row.amountMinor / 100, date: { gte: start, lt: end }, deletedAt: null, isCancelled: false },
      select: { id: true, date: true, receiptNo: true, paymentMode: true }, take: 20
    })
  ]);
  const evidence: Array<Record<string, unknown>> = [];
  const sameDay = (value: Date) => value.toISOString().slice(0, 10) === row.paymentDate.toISOString().slice(0, 10);
  const exactOcrReference = row.handwrittenReceiptReference && ocrRows.find((candidate: any) => candidate.handwrittenReceiptReference && normalize(candidate.handwrittenReceiptReference) === normalize(row.handwrittenReceiptReference) && sameDay(candidate.paymentDate));
  if (exactOcrReference) return { classification: "EXACT_DUPLICATE", evidence: [{ source: "OCR_ROW", rowId: exactOcrReference.id, reason: "Same Student, date, amount, and handwritten reference" }] };
  for (const candidate of ocrRows) evidence.push({ source: "OCR_ROW", rowId: candidate.id, sameBatch: candidate.page.batchId === row.page.batchId, date: candidate.paymentDate.toISOString().slice(0, 10) });
  for (const payment of payments) evidence.push({ source: "PAYMENT", paymentId: payment.id, erpReceiptNo: payment.receiptNo, date: payment.date.toISOString().slice(0, 10) });
  if (payments.some((payment: any) => sameDay(payment.date)) || ocrRows.some((candidate: any) => sameDay(candidate.paymentDate))) return { classification: "LIKELY_DUPLICATE", evidence };
  if (evidence.length) return { classification: "POSSIBLE_DUPLICATE", evidence };
  return { classification: "NO_DUPLICATE", evidence: [] };
}

export async function refreshOcrBatch(client: any, batchId: string) {
  const pages = await client.feeRegisterOcrPage.findMany({ where: { batchId }, include: { rows: true } });
  const rows = pages.flatMap((page: any) => page.rows);
  const total = (status: string) => rows.filter((row: any) => row.status === status);
  const data = {
    sourcePageCount: pages.length,
    extractedRowCount: rows.length,
    verifiedRowCount: total("VERIFIED").length,
    duplicateRowCount: total("DUPLICATE").length,
    rejectedRowCount: total("REJECTED").length,
    postedRowCount: total("POSTED").length,
    postingFailedRowCount: total("POSTING_FAILED").length,
    totalExtractedAmountMinor: rows.reduce((sum: number, row: any) => sum + (row.amountMinor ?? 0), 0),
    totalVerifiedAmountMinor: total("VERIFIED").reduce((sum: number, row: any) => sum + (row.amountMinor ?? 0), 0),
    totalPostedAmountMinor: total("POSTED").reduce((sum: number, row: any) => sum + (row.amountMinor ?? 0), 0),
    status: rows.length ? "NEEDS_REVIEW" : pages.length ? "UPLOADED" : "DRAFT"
  };
  const current = await client.feeRegisterOcrBatch.findUnique({ where: { id: batchId } });
  if (current && ["READY_FOR_APPROVAL", "APPROVED", "CANCELLED", "POSTING", "PARTIALLY_POSTED", "POSTED", "ARCHIVED"].includes(current.status)) delete (data as any).status;
  return client.feeRegisterOcrBatch.update({ where: { id: batchId }, data });
}

export async function addOcrEvent(client: any, batchId: string, eventType: string, actorUserId: string | null, safeReason?: string | null, safeMetadata?: Record<string, unknown>) {
  return client.feeRegisterOcrEvent.create({ data: { batchId, eventType, actorUserId, safeReason: safeReason?.slice(0, 1000) ?? null, safeMetadataJson: safeMetadata ? JSON.stringify(safeMetadata) : null } });
}

export const ocrBatchInclude = {
  profile: true,
  pages: {
    include: {
      rows: {
        include: { revisions: { orderBy: { revisionNumber: "asc" as const } } },
        orderBy: { rowNumber: "asc" as const }
      }
    },
    orderBy: { pageNumber: "asc" as const }
  },
  postingRuns: { orderBy: { createdAt: "desc" as const } },
  events: { orderBy: { createdAt: "desc" as const }, take: 200 }
};

export async function matchStudentForOcr(client: any, academicYear: string, fields: Record<string, string>, minimumSuggestionConfidence = 80) {
  const admission = normalize(fields.admissionNumber);
  if (admission) {
    const students = await client.student.findMany({ where: { deletedAt: null }, include: { academicYearEnrollments: { where: { academicYear } } } });
    const exact = students.filter((student: any) => normalize(student.admissionNo) === admission && student.academicYearEnrollments.some((enrollment: any) => enrollment.status === "ACTIVE"));
    if (exact.length === 1) return { student: exact[0], method: "ADMISSION_NUMBER_EXACT", candidates: [safeCandidate(exact[0], "Exact admission number", 100, academicYear)] };
  }
  const students = await client.student.findMany({ where: { deletedAt: null }, include: { academicYearEnrollments: { where: { academicYear } } }, take: 500 });
  const active = students.filter((student: any) => student.academicYearEnrollments.some((enrollment: any) => enrollment.status === "ACTIVE"));
  const name = normalize(fields.studentName), className = normalize(normalizeClassName(fields.className ?? "")), section = normalize(fields.section);
  const exactNameClass = active.filter((student: any) => {
    const enrollment = student.academicYearEnrollments.find((item: any) => item.status === "ACTIVE");
    return normalize(student.studentName) === name && normalize(normalizeClassName(enrollment?.className ?? student.className)) === className && normalize(enrollment?.section ?? student.section) === section;
  });
  if (name && className && exactNameClass.length === 1) return { student: exactNameClass[0], method: "NAME_CLASS_EXACT", candidates: [safeCandidate(exactNameClass[0], "Exact name, class, and section", 95, academicYear)] };
  const tokens = new Set(name.split(" ").filter((token) => token.length >= 3));
  if (!tokens.size) return { student: null, method: "NONE", candidates: [] };
  const candidates = active.map((student: any) => {
    const studentTokens = new Set(normalize(student.studentName).split(" "));
    const overlap = [...tokens].filter((token) => studentTokens.has(token)).length;
    const enrollment = student.academicYearEnrollments.find((item: any) => item.status === "ACTIVE");
    let score = tokens.size ? Math.round(overlap / tokens.size * 60) : 0;
    if (className && normalize(normalizeClassName(enrollment?.className ?? student.className)) === className) score += 25;
    if (section && normalize(enrollment?.section ?? student.section) === section) score += 15;
    return { student, score, overlap };
  }).filter((item: any) => item.overlap > 0 && item.score >= minimumSuggestionConfidence).sort((a: any, b: any) => b.score - a.score).slice(0, 5)
    .map((item: any) => safeCandidate(item.student, "Conservative candidate only; manual selection required", item.score, academicYear));
  return { student: null, method: "NONE", candidates };
}

function safeCandidate(student: any, matchReason: string, confidence: number, academicYear: string) {
  const enrollment = student.academicYearEnrollments?.find((item: any) => item.academicYear === academicYear);
  return { id: student.id, admissionNo: student.admissionNo, studentName: student.studentName, className: enrollment?.className ?? student.className, section: enrollment?.section ?? student.section, enrollmentStatus: enrollment?.status ?? "MISSING", matchReason, confidence };
}

function normalizeProviderRow(row: OcrProviderRow) {
  return normalizeEditableRow({
    ...row.fields,
    amountMinor: row.fields.amount ? Math.round((parsePaymentImportAmount(row.fields.amount) ?? 0) * 100) : null
  });
}

function normalizeEditableRow(input: Record<string, unknown>) {
  const paymentDateText = parsePaymentImportDate(input.paymentDate);
  const amount = input.amountMinor != null ? Number(input.amountMinor) / 100 : parsePaymentImportAmount(input.amount);
  const paymentMode = normalizePaymentMode(input.paymentMode).value;
  const receivedAccount = normalizeReceivedAccount(input.receivedAccount, normalizePaymentMode(input.paymentMode).accountHint, paymentMode);
  const academicTerm = String(input.academicTerm ?? "").trim();
  const fields: Record<string, string> = {
    paymentDate: paymentDateText ?? String(input.paymentDate ?? "").trim(),
    admissionNumber: optionalText(input.admissionNumber, "Admission number", 80) ?? "",
    studentName: optionalText(input.studentName, "Student name", 160) ?? "",
    className: optionalText(input.className, "Class", 40) ?? "",
    section: optionalText(input.section, "Section", 20) ?? "",
    amount: amount == null || !Number.isFinite(amount) ? String(input.amount ?? "") : amount.toFixed(2),
    paymentMode: String(input.paymentMode ?? "").trim(),
    academicTerm,
    handwrittenReceiptReference: optionalText(input.handwrittenReceiptReference, "Handwritten reference", 160) ?? "",
    registerRemarks: optionalText(input.registerRemarks, "Register remarks", 500) ?? ""
  };
  return {
    fields,
    paymentDate: paymentDateText ? new Date(`${paymentDateText}T00:00:00.000Z`) : null,
    amountMinor: amount != null && Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null,
    paymentMode: PAYMENT_MODES.includes(paymentMode as any) ? paymentMode : null,
    receivedAccount: RECEIVED_ACCOUNTS.includes(receivedAccount as any) ? receivedAccount : null,
    academicTerm: TERM_HINTS.includes(academicTerm as any) ? academicTerm : null,
    handwrittenReceiptReference: fields.handwrittenReceiptReference || null,
    registerRemarks: fields.registerRemarks || null,
    data: {
      paymentDate: paymentDateText ? new Date(`${paymentDateText}T00:00:00.000Z`) : null,
      amountMinor: amount != null && Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : null,
      paymentMode: PAYMENT_MODES.includes(paymentMode as any) ? paymentMode : null,
      receivedAccount: RECEIVED_ACCOUNTS.includes(receivedAccount as any) ? receivedAccount : null,
      academicTerm: TERM_HINTS.includes(academicTerm as any) ? academicTerm : null,
      handwrittenReceiptReference: fields.handwrittenReceiptReference || null,
      registerRemarks: fields.registerRemarks || null
    }
  };
}

async function invalidateBatchApproval(tx: any, batchId: string, actorId: string) {
  const batch = await tx.feeRegisterOcrBatch.findUnique({ where: { id: batchId } });
  if (!batch) return;
  assertOcrBatchRowMutationAllowed(batch.status);
  const hadApproval = batch.approvedReviewVersion != null || batch.status === "APPROVED";
  await tx.feeRegisterOcrBatch.update({ where: { id: batchId }, data: { reviewVersion: { increment: 1 }, approvedReviewVersion: null, approvedByUserId: null, approvedAt: null, approvalNotes: null, ...(["READY_FOR_APPROVAL", "APPROVED"].includes(batch.status) ? { status: "NEEDS_REVIEW", submittedByUserId: null, submittedAt: null } : {}) } });
  if (hadApproval) await addOcrEvent(tx, batchId, "APPROVAL_INVALIDATED", actorId, "A source field, match, duplicate decision, or row state changed");
}

function rowSnapshot(row: any) {
  return {
    paymentDate: row.paymentDate?.toISOString?.().slice(0, 10) ?? row.paymentDate ?? null,
    amountMinor: row.amountMinor,
    paymentMode: row.paymentMode,
    receivedAccount: row.receivedAccount,
    academicTerm: row.academicTerm,
    handwrittenReceiptReference: row.handwrittenReceiptReference,
    registerRemarks: row.registerRemarks,
    matchedStudentId: row.matchedStudentId,
    matchingMethod: row.matchingMethod,
    duplicateClassification: row.duplicateClassification,
    extractedFieldsJson: row.extractedFieldsJson
  };
}

function requiredText(value: unknown, label: string, maximum: number) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maximum) throw new Error(`${label} is required and must be at most ${maximum} characters`);
  return text;
}
function optionalText(value: unknown, label: string, maximum: number) {
  const text = String(value ?? "").trim();
  if (text.length > maximum) throw new Error(`${label} must be at most ${maximum} characters`);
  return text || null;
}
function optionalDate(value: unknown, label: string) {
  if (value == null || value === "") return null;
  const parsed = parsePaymentImportDate(value);
  if (!parsed) throw new Error(`${label} is invalid`);
  return new Date(`${parsed}T00:00:00.000Z`);
}
function normalize(value: unknown) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function safeOcrError(error: unknown) { return error instanceof Error ? error.message.slice(0, 500) : "OCR extraction failed safely"; }
