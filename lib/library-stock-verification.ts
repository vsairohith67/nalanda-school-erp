import { Prisma, type PrismaClient } from "@prisma/client";
import { localDate } from "@/lib/expenses";
import {
  changeLibraryCopyConditionInTransaction,
  changeLibraryCopyShelfInTransaction,
  normalizeAccessionNumber,
  normalizeLibraryBarcode,
  transitionLibraryCopyInTransaction
} from "@/lib/library-accession";

export const STOCK_SCOPE_TYPES = ["ALL_ACTIVE_COPIES", "SHELF", "TITLE", "CATEGORY", "SUBJECT", "CUSTOM"] as const;
export const STOCK_SESSION_STATUSES = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "REVIEWED", "APPROVED", "LOCKED", "CANCELLED"] as const;
export const STOCK_OBSERVATIONS = ["NOT_CHECKED", "PRESENT", "ISSUED_OFFSITE", "KNOWN_REPAIR", "MISSING", "MIS_SHELVED", "DAMAGED", "UNEXPECTED", "WITHDRAWN_REFERENCE", "NEEDS_REVIEW"] as const;
export const STOCK_RESOLUTIONS = ["NOT_REQUIRED", "PENDING_REVIEW", "APPROVED_NO_CHANGE", "APPROVED_UPDATE_SHELF", "APPROVED_MARK_MISSING", "APPROVED_CONDITION_UPDATE", "APPROVED_SEND_FOR_REPAIR", "REJECTED", "APPLIED"] as const;

function safeText(value: unknown, label: string, max: number, required = false) {
  const result = String(value ?? "").trim().replace(/\s+/g, " ");
  if (required && !result) throw new Error(`${label} is required`);
  if (result.length > max) throw new Error(`${label} must be at most ${max} characters`);
  return result || null;
}

function oneOf<T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!values.includes(normalized)) throw new Error(`${label} is not supported`);
  return normalized as T[number];
}

export function normalizeStockSessionNumber(value: unknown) {
  const raw = safeText(value, "Session number", 60, true)!;
  const normalized = raw.toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9_/-]/g, "").replace(/-+/g, "-").replace(/-?\/-?/g, "/").replace(/^-|-$/g, "");
  if (!normalized) throw new Error("Session number must contain letters or numbers");
  return normalized;
}

export function validateStockSessionInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Stock-verification details are required");
  const row = input as Record<string, unknown>;
  const scopeType = oneOf(row.scopeType ?? "ALL_ACTIVE_COPIES", STOCK_SCOPE_TYPES, "Scope type");
  const data = {
    sessionNumber: normalizeStockSessionNumber(row.sessionNumber),
    title: safeText(row.title, "Title", 180, true)!,
    academicYear: safeText(row.academicYear, "Academic year", 20, true)!,
    verificationDate: localDate(row.verificationDate, "Verification date"),
    scopeType,
    shelfCodeFilter: safeText(row.shelfCodeFilter, "Shelf filter", 80)?.toUpperCase() ?? null,
    titleIdFilter: safeText(row.titleIdFilter, "Title filter", 80),
    categoryFilter: safeText(row.categoryFilter, "Category filter", 120),
    subjectFilter: safeText(row.subjectFilter, "Subject filter", 120),
    notes: safeText(row.notes, "Notes", 2000)
  };
  if (scopeType === "SHELF" && !data.shelfCodeFilter) throw new Error("Shelf scope requires an exact shelf code");
  if (scopeType === "TITLE" && !data.titleIdFilter) throw new Error("Title scope requires an exact Library title");
  if (scopeType === "CATEGORY" && !data.categoryFilter) throw new Error("Category scope requires an exact category");
  if (scopeType === "SUBJECT" && !data.subjectFilter) throw new Error("Subject scope requires an exact subject");
  return data;
}

function scopeWhere(session: any): Prisma.LibraryCopyWhereInput {
  const scoped = session.scopeType === "SHELF" ? { shelfCode: session.shelfCodeFilter }
    : session.scopeType === "TITLE" ? { titleId: session.titleIdFilter }
    : session.scopeType === "CATEGORY" ? { title: { category: session.categoryFilter } }
    : session.scopeType === "SUBJECT" ? { title: { subject: session.subjectFilter } }
    : {};
  return { ...scoped, status: { not: "WITHDRAWN" } };
}

const expectedCopySelect = {
  id: true, accessionNumber: true, barcodeValue: true, status: true, condition: true, shelfCode: true,
  title: { select: { titleCode: true, title: true, status: true, category: true, subject: true } },
  loans: { where: { status: "ISSUED" }, take: 1, select: { status: true, dueDate: true, member: { select: { memberType: true } } } }
} satisfies Prisma.LibraryCopySelect;

function expectedClassification(copy: any) {
  const loan = copy.loans?.[0];
  if (loan) return { observationStatus: "ISSUED_OFFSITE", resolutionStatus: "NOT_REQUIRED" };
  if (copy.status === "UNDER_REPAIR") return { observationStatus: "KNOWN_REPAIR", resolutionStatus: "NOT_REQUIRED" };
  if (copy.status === "MISSING") return { observationStatus: "NEEDS_REVIEW", resolutionStatus: "PENDING_REVIEW" };
  return { observationStatus: "NOT_CHECKED", resolutionStatus: "NOT_REQUIRED" };
}

export async function previewExpectedCopies(client: PrismaClient, input: unknown) {
  const data = validateStockSessionInput(input);
  const copies = await client.libraryCopy.findMany({ where: scopeWhere(data), select: expectedCopySelect, orderBy: { accessionNumber: "asc" } });
  const withdrawnReferences = await client.libraryCopy.count({ where: { ...scopeWhere({ ...data, scopeType: data.scopeType }), status: "WITHDRAWN" } as any });
  return {
    count: copies.length,
    available: copies.filter((copy) => copy.status === "AVAILABLE" && !copy.loans.length).length,
    issuedOffsite: copies.filter((copy) => copy.loans.length > 0).length,
    knownRepair: copies.filter((copy) => copy.status === "UNDER_REPAIR").length,
    previouslyMissing: copies.filter((copy) => copy.status === "MISSING").length,
    withdrawnReferences,
    copies: copies.map((copy) => ({ accessionNumber: copy.accessionNumber, barcodeValue: copy.barcodeValue, title: copy.title.title, shelfCode: copy.shelfCode, status: copy.status, condition: copy.condition, expected: expectedClassification(copy).observationStatus }))
  };
}

export async function createStockSession(client: PrismaClient, input: unknown, actorId: string) {
  const data = validateStockSessionInput(input);
  try {
    return await client.$transaction(async (tx) => {
      if (data.titleIdFilter && !await tx.libraryTitle.findUnique({ where: { id: data.titleIdFilter }, select: { id: true } })) throw new Error("Selected Library title was not found");
      const session = await tx.libraryStockVerificationSession.create({ data: { ...data, createdByUserId: actorId } });
      await tx.libraryStockVerificationEvent.create({ data: { sessionId: session.id, eventType: "CREATED", eventDate: new Date(), recordedByUserId: actorId } });
      return session;
    });
  } catch (error: any) {
    if (error?.code === "P2002") throw new Error("This normalized stock-verification session number already exists");
    throw error;
  }
}

export async function updateStockDraft(client: PrismaClient, id: string, input: unknown) {
  const data = validateStockSessionInput(input);
  const result = await client.libraryStockVerificationSession.updateMany({ where: { id, status: "DRAFT", startedAt: null }, data });
  if (result.count !== 1) throw new Error("Scope and session details cannot change after stock verification starts");
  return client.libraryStockVerificationSession.findUniqueOrThrow({ where: { id } });
}

export function summarizeStockRecords(records: Array<{ observationStatus: string; resolutionStatus: string }>) {
  const count = (status: string) => records.filter((row) => row.observationStatus === status).length;
  const expectedCopyCount = records.filter((row) => row.observationStatus !== "UNEXPECTED").length;
  const verifiedCopyCount = records.filter((row) => !["NOT_CHECKED", "UNEXPECTED"].includes(row.observationStatus)).length;
  const unresolvedCount = records.filter((row) => ["PENDING_REVIEW", "APPROVED_UPDATE_SHELF", "APPROVED_MARK_MISSING", "APPROVED_CONDITION_UPDATE", "APPROVED_SEND_FOR_REPAIR"].includes(row.resolutionStatus)).length;
  return {
    expectedCopyCount,
    verifiedCopyCount, presentCount: count("PRESENT"), issuedOffsiteCount: count("ISSUED_OFFSITE"), knownRepairCount: count("KNOWN_REPAIR"),
    missingCount: count("MISSING"), misShelvedCount: count("MIS_SHELVED"), damagedCount: count("DAMAGED"), unexpectedCount: count("UNEXPECTED"), unresolvedCount
  };
}

async function recalculateSession(tx: Prisma.TransactionClient, sessionId: string) {
  const records = await tx.libraryStockVerificationRecord.findMany({ where: { sessionId }, select: { observationStatus: true, resolutionStatus: true } });
  return tx.libraryStockVerificationSession.update({ where: { id: sessionId }, data: summarizeStockRecords(records) });
}

export async function startStockSession(client: PrismaClient, id: string, actorId: string) {
  return client.$transaction(async (tx) => {
    const session = await tx.libraryStockVerificationSession.findUnique({ where: { id } });
    if (!session) throw new Error("Stock-verification session was not found");
    const claimed = await tx.libraryStockVerificationSession.updateMany({ where: { id, status: "DRAFT", startedAt: null }, data: { status: "IN_PROGRESS", startedAt: new Date(), startedByUserId: actorId } });
    if (claimed.count !== 1) throw new Error("This session has already started or is no longer editable");
    const copies = await tx.libraryCopy.findMany({ where: scopeWhere(session), select: expectedCopySelect, orderBy: { accessionNumber: "asc" } });
    if (!copies.length) throw new Error("The selected scope contains no non-withdrawn physical copies");
    await tx.libraryStockVerificationRecord.createMany({ data: copies.map((copy) => {
      const loan = copy.loans[0]; const classification = expectedClassification(copy);
      return { sessionId: id, copyId: copy.id, expectedAccessionNumberSnapshot: copy.accessionNumber, expectedBarcodeSnapshot: copy.barcodeValue, expectedTitleSnapshot: `${copy.title.titleCode} - ${copy.title.title}`, expectedShelfCodeSnapshot: copy.shelfCode, expectedStatusSnapshot: copy.status, expectedConditionSnapshot: copy.condition, expectedLoanStatusSnapshot: loan?.status ?? null, expectedBorrowerTypeSnapshot: loan?.member.memberType ?? null, expectedDueDateSnapshot: loan?.dueDate ?? null, ...classification };
    }) });
    await tx.libraryStockVerificationEvent.create({ data: { sessionId: id, eventType: "STARTED", eventDate: new Date(), notes: `${copies.length} immutable expected-copy snapshots created`, recordedByUserId: actorId } });
    return recalculateSession(tx, id);
  });
}

function safeCopy(copy: any) {
  return { accessionNumber: copy.accessionNumber, barcodeValue: copy.barcodeValue, title: copy.title.title, titleCode: copy.title.titleCode, shelfCode: copy.shelfCode, status: copy.status, condition: copy.condition, activeLoan: Boolean(copy.loans?.length), unresolvedIncident: Boolean(copy.incidents?.length) };
}

const scanCopyInclude = { title: { select: { titleCode: true, title: true } }, loans: { where: { status: "ISSUED" }, take: 1, select: { id: true } }, incidents: { where: { status: { notIn: ["RESOLVED", "CANCELLED"] } }, take: 1, select: { id: true } } } satisfies Prisma.LibraryCopyInclude;

export async function recordStockScan(client: PrismaClient, sessionId: string, rawValue: unknown, actorId: string, options: { accessionFallback?: boolean; confirmRecheck?: boolean } = {}) {
  const input = safeText(rawValue, "Scan value", 100, true)!;
  const normalizedInput = input.toUpperCase();
  return client.$transaction(async (tx) => {
    const session = await tx.libraryStockVerificationSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== "IN_PROGRESS") throw new Error("Scanning is available only while the session is in progress");
    let copy = null; let scanMethod = "BARCODE";
    try { const barcode = normalizeLibraryBarcode(normalizedInput); if (barcode) copy = await tx.libraryCopy.findUnique({ where: { barcodeValue: barcode }, include: scanCopyInclude }); } catch { /* record invalid/try accession */ }
    if (!copy && options.accessionFallback) { scanMethod = "ACCESSION"; try { copy = await tx.libraryCopy.findUnique({ where: { accessionNumber: normalizeAccessionNumber(normalizedInput) }, include: scanCopyInclude }); } catch { /* unknown below */ } }
    if (!copy) {
      await tx.libraryStockVerificationScanEvent.create({ data: { sessionId, normalizedInput, scanMethod, resultType: "UNKNOWN_VALUE", scannedAt: new Date(), recordedByUserId: actorId } });
      return { resultType: "UNKNOWN_VALUE", message: "No exact Library copy matched. No fuzzy match or copy creation was attempted." };
    }
    if (copy.status === "WITHDRAWN") {
      await tx.libraryStockVerificationScanEvent.create({ data: { sessionId, normalizedInput, scanMethod, resultType: "WITHDRAWN_COPY", scannedAt: new Date(), recordedByUserId: actorId } });
      return { resultType: "WITHDRAWN_COPY", copy: safeCopy(copy), message: "Withdrawn historical copy recorded; it was not reactivated." };
    }
    const record = await tx.libraryStockVerificationRecord.findUnique({ where: { sessionId_copyId: { sessionId, copyId: copy.id } } });
    if (!record) {
      await tx.libraryStockVerificationScanEvent.create({ data: { sessionId, normalizedInput, scanMethod, resultType: "OUT_OF_SCOPE_COPY", scannedAt: new Date(), recordedByUserId: actorId } });
      return { resultType: "OUT_OF_SCOPE_COPY", copy: safeCopy(copy), message: "Valid copy is outside this session scope. It was not added or changed." };
    }
    const recent = await tx.libraryStockVerificationScanEvent.findFirst({ where: { sessionId, recordId: record.id, resultType: "MATCHED_EXPECTED", scannedAt: { gte: new Date(Date.now() - 1500) } }, orderBy: { scannedAt: "desc" } });
    if ((recent || record.observationStatus !== "NOT_CHECKED") && !options.confirmRecheck) {
      await tx.libraryStockVerificationScanEvent.create({ data: { sessionId, recordId: record.id, normalizedInput, scanMethod, resultType: "DUPLICATE_SCAN", scannedAt: new Date(), notes: "Primary verification count unchanged", recordedByUserId: actorId } });
      return { resultType: "DUPLICATE_SCAN", record: publicStockRecord(record), copy: safeCopy(copy), message: "Duplicate scan recorded safely; counts were not increased." };
    }
    const observationStatus = copy.loans.length ? "ISSUED_OFFSITE" : copy.status === "UNDER_REPAIR" ? "KNOWN_REPAIR" : copy.status === "MISSING" ? "NEEDS_REVIEW" : "PRESENT";
    const resolutionStatus = observationStatus === "NEEDS_REVIEW" ? "PENDING_REVIEW" : "NOT_REQUIRED";
    const updated = await tx.libraryStockVerificationRecord.update({ where: { id: record.id }, data: { observationStatus, resolutionStatus, observedAt: new Date(), scanMethod, observedByUserId: actorId } });
    await tx.libraryStockVerificationScanEvent.create({ data: { sessionId, recordId: record.id, normalizedInput, scanMethod, resultType: "MATCHED_EXPECTED", scannedAt: new Date(), notes: options.confirmRecheck ? "Explicit recheck" : null, recordedByUserId: actorId } });
    await recalculateSession(tx, sessionId);
    return { resultType: "MATCHED_EXPECTED", record: publicStockRecord(updated), copy: safeCopy(copy), message: "Observation recorded. No LibraryCopy field was changed." };
  });
}

export async function addUnexpectedObservation(client: PrismaClient, sessionId: string, copyId: string, reasonInput: unknown, actorId: string) {
  const reason = safeText(reasonInput, "Reason", 1000, true)!;
  return client.$transaction(async (tx) => {
    const session = await tx.libraryStockVerificationSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== "IN_PROGRESS") throw new Error("Unexpected copies can be added only while scanning is in progress");
    const copy = await tx.libraryCopy.findUnique({ where: { id: copyId }, include: scanCopyInclude });
    if (!copy || copy.status === "WITHDRAWN") throw new Error("Select a valid non-withdrawn physical copy");
    const existing = await tx.libraryStockVerificationRecord.findUnique({ where: { sessionId_copyId: { sessionId, copyId } } });
    if (existing) return existing;
    const record = await tx.libraryStockVerificationRecord.create({ data: { sessionId, copyId, expectedAccessionNumberSnapshot: copy.accessionNumber, expectedBarcodeSnapshot: copy.barcodeValue, expectedTitleSnapshot: `${copy.title.titleCode} - ${copy.title.title}`, expectedShelfCodeSnapshot: copy.shelfCode, expectedStatusSnapshot: copy.status, expectedConditionSnapshot: copy.condition, observationStatus: "UNEXPECTED", observedAt: new Date(), scanMethod: "MANUAL", observationNotes: reason, discrepancyReason: reason, resolutionStatus: "PENDING_REVIEW", observedByUserId: actorId } });
    await tx.libraryStockVerificationScanEvent.create({ data: { sessionId, recordId: record.id, normalizedInput: copy.barcodeValue ?? copy.accessionNumber, scanMethod: "MANUAL", resultType: "MANUAL_OVERRIDE", scannedAt: new Date(), notes: reason, recordedByUserId: actorId } });
    await recalculateSession(tx, sessionId);
    return record;
  });
}

export async function recordManualObservation(client: PrismaClient, sessionId: string, recordId: string, input: any, actorId: string) {
  const observationStatus = oneOf(input?.observationStatus, STOCK_OBSERVATIONS, "Observation status");
  if (["ISSUED_OFFSITE", "KNOWN_REPAIR", "WITHDRAWN_REFERENCE"].includes(observationStatus)) throw new Error("Known exceptions are derived from the immutable expected snapshot");
  const observedShelfCode = safeText(input?.observedShelfCode, "Observed shelf", 80)?.toUpperCase() ?? null;
  const observedCondition = safeText(input?.observedCondition, "Observed condition", 40)?.toUpperCase() ?? null;
  const notes = safeText(input?.observationNotes, "Observation notes", 1000);
  if (observationStatus === "MIS_SHELVED" && !observedShelfCode) throw new Error("Mis-shelved observation requires the observed shelf");
  if (["DAMAGED", "MISSING", "MIS_SHELVED", "NEEDS_REVIEW"].includes(observationStatus) && !notes) throw new Error("Discrepancy notes are required");
  return client.$transaction(async (tx) => {
    const session = await tx.libraryStockVerificationSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== "IN_PROGRESS") throw new Error("Manual observations are available only while scanning is in progress");
    const current = await tx.libraryStockVerificationRecord.findFirst({ where: { id: recordId, sessionId } });
    if (!current) throw new Error("Expected-copy record was not found");
    if (current.expectedLoanStatusSnapshot === "ISSUED" && observationStatus === "MISSING") throw new Error("An issued copy cannot be proposed as newly missing");
    if (current.expectedStatusSnapshot === "UNDER_REPAIR" && observationStatus === "MISSING") throw new Error("A known under-repair copy cannot be proposed as newly missing");
    const resolutionStatus = ["MISSING", "MIS_SHELVED", "DAMAGED", "UNEXPECTED", "NEEDS_REVIEW"].includes(observationStatus) ? "PENDING_REVIEW" : "NOT_REQUIRED";
    const record = await tx.libraryStockVerificationRecord.update({ where: { id: recordId }, data: { observationStatus, observedAt: new Date(), observedShelfCode, observedCondition, scanMethod: "MANUAL", observationNotes: notes, discrepancyReason: resolutionStatus === "PENDING_REVIEW" ? notes : null, resolutionStatus, observedByUserId: actorId } });
    await tx.libraryStockVerificationScanEvent.create({ data: { sessionId, recordId, normalizedInput: current.expectedAccessionNumberSnapshot, scanMethod: "MANUAL", resultType: "MANUAL_OVERRIDE", scannedAt: new Date(), notes, recordedByUserId: actorId } });
    await recalculateSession(tx, sessionId);
    return record;
  });
}

export async function previewUncheckedMissing(client: PrismaClient, sessionId: string) {
  const records = await client.libraryStockVerificationRecord.findMany({ where: { sessionId, observationStatus: "NOT_CHECKED", expectedStatusSnapshot: "AVAILABLE", expectedLoanStatusSnapshot: null }, orderBy: { expectedAccessionNumberSnapshot: "asc" } });
  return records.map((record) => publicStockRecord(record));
}

export async function proposeUncheckedMissing(client: PrismaClient, sessionId: string, recordIds: string[], reasonInput: unknown, actorId: string) {
  const reason = safeText(reasonInput, "Missing proposal reason", 1000, true)!;
  return client.$transaction(async (tx) => {
    const session = await tx.libraryStockVerificationSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== "IN_PROGRESS") throw new Error("Missing proposals are available only before submission");
    const eligible = await tx.libraryStockVerificationRecord.findMany({ where: { sessionId, id: { in: recordIds }, observationStatus: "NOT_CHECKED", expectedStatusSnapshot: "AVAILABLE", expectedLoanStatusSnapshot: null }, select: { id: true } });
    if (eligible.length !== new Set(recordIds).size) throw new Error("One or more selected copies are issued, under repair, already checked, or outside this session");
    await tx.libraryStockVerificationRecord.updateMany({ where: { id: { in: eligible.map((r) => r.id) } }, data: { observationStatus: "MISSING", discrepancyReason: reason, resolutionStatus: "PENDING_REVIEW", observedAt: new Date(), scanMethod: "MANUAL", observedByUserId: actorId } });
    await recalculateSession(tx, sessionId);
    return { proposed: eligible.length };
  });
}

export async function submitStockSession(client: PrismaClient, sessionId: string, actorId: string) {
  return client.$transaction(async (tx) => {
    const unchecked = await tx.libraryStockVerificationRecord.count({ where: { sessionId, observationStatus: "NOT_CHECKED" } });
    if (unchecked) throw new Error(`Review or explicitly account for ${unchecked} unchecked expected copies before submission`);
    const updated = await tx.libraryStockVerificationSession.updateMany({ where: { id: sessionId, status: "IN_PROGRESS", submittedAt: null }, data: { status: "SUBMITTED", submittedAt: new Date(), submittedByUserId: actorId } });
    if (updated.count !== 1) throw new Error("This session was already submitted or is not in progress");
    await tx.libraryStockVerificationEvent.create({ data: { sessionId, eventType: "SUBMITTED", eventDate: new Date(), recordedByUserId: actorId } });
    return recalculateSession(tx, sessionId);
  });
}

export async function decideStockResolution(client: PrismaClient, sessionId: string, recordId: string, resolutionInput: unknown, notesInput: unknown, actorId: string) {
  const resolutionStatus = oneOf(resolutionInput, STOCK_RESOLUTIONS.filter((v) => ["APPROVED_NO_CHANGE", "APPROVED_UPDATE_SHELF", "APPROVED_MARK_MISSING", "APPROVED_CONDITION_UPDATE", "APPROVED_SEND_FOR_REPAIR", "REJECTED"].includes(v)) as any, "Resolution");
  const resolutionNotes = safeText(notesInput, "Resolution notes", 1000, resolutionStatus !== "APPROVED_NO_CHANGE")!;
  return client.$transaction(async (tx) => {
    const session = await tx.libraryStockVerificationSession.findUnique({ where: { id: sessionId } });
    if (!session || !["SUBMITTED", "REVIEWED"].includes(session.status)) throw new Error("Discrepancy decisions require a submitted or reviewed session");
    const record = await tx.libraryStockVerificationRecord.findFirst({ where: { id: recordId, sessionId } });
    if (!record || record.resolutionStatus !== "PENDING_REVIEW") throw new Error("This discrepancy is not pending review");
    if (resolutionStatus === "APPROVED_UPDATE_SHELF" && !record.observedShelfCode) throw new Error("An observed shelf is required before approving a shelf correction");
    if (resolutionStatus === "APPROVED_MARK_MISSING" && (record.expectedLoanStatusSnapshot === "ISSUED" || record.expectedStatusSnapshot === "UNDER_REPAIR")) throw new Error("Issued and known-repair copies cannot be approved as newly missing");
    const updated = await tx.libraryStockVerificationRecord.update({ where: { id: recordId }, data: { resolutionStatus, resolutionNotes, reviewedByUserId: actorId } });
    await recalculateSession(tx, sessionId);
    return updated;
  });
}

export async function markStockSessionReviewed(client: PrismaClient, sessionId: string, actorId: string) {
  return client.$transaction(async (tx) => {
    const pending = await tx.libraryStockVerificationRecord.count({ where: { sessionId, resolutionStatus: "PENDING_REVIEW" } });
    if (pending) throw new Error(`${pending} discrepancy decisions are still pending`);
    const updated = await tx.libraryStockVerificationSession.updateMany({ where: { id: sessionId, status: "SUBMITTED", reviewedAt: null }, data: { status: "REVIEWED", reviewedAt: new Date(), reviewedByUserId: actorId } });
    if (updated.count !== 1) throw new Error("This session was already reviewed or is not submitted");
    await tx.libraryStockVerificationEvent.create({ data: { sessionId, eventType: "REVIEWED", eventDate: new Date(), recordedByUserId: actorId } });
    return recalculateSession(tx, sessionId);
  });
}

export async function applyStockResolution(client: PrismaClient, sessionId: string, recordId: string, actorId: string) {
  return client.$transaction(async (tx) => {
    const session = await tx.libraryStockVerificationSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== "REVIEWED") throw new Error("Approved corrections can be applied only after discrepancy review");
    const record = await tx.libraryStockVerificationRecord.findFirst({ where: { id: recordId, sessionId } });
    if (!record) throw new Error("Verification record was not found");
    if (record.resolutionStatus === "APPLIED" || record.appliedCopyEventId) return { record, idempotent: true };
    const allowed = ["APPROVED_UPDATE_SHELF", "APPROVED_MARK_MISSING", "APPROVED_CONDITION_UPDATE", "APPROVED_SEND_FOR_REPAIR"];
    if (!allowed.includes(record.resolutionStatus)) throw new Error("This resolution does not require a copy correction");
    if (!record.resolutionNotes) throw new Error("Approved correction notes are required");
    if (record.resolutionStatus === "APPROVED_MARK_MISSING") {
      const openIncident = await tx.libraryIncident.findFirst({ where: { copyId: record.copyId, status: { notIn: ["RESOLVED", "CANCELLED"] } }, select: { incidentNumber: true } });
      if (openIncident) throw new Error(`Resolve or cancel open incident ${openIncident.incidentNumber} before marking this copy missing`);
    }
    const before = await tx.libraryCopyEvent.findFirst({ where: { copyId: record.copyId }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (record.resolutionStatus === "APPROVED_UPDATE_SHELF") await changeLibraryCopyShelfInTransaction(tx as any, record.copyId, record.observedShelfCode, actorId, record.resolutionNotes);
    else if (record.resolutionStatus === "APPROVED_MARK_MISSING") await transitionLibraryCopyInTransaction(tx as any, record.copyId, "missing", actorId, record.resolutionNotes);
    else if (record.resolutionStatus === "APPROVED_CONDITION_UPDATE") await changeLibraryCopyConditionInTransaction(tx as any, record.copyId, record.observedCondition ?? "DAMAGED", actorId, record.resolutionNotes);
    else await transitionLibraryCopyInTransaction(tx as any, record.copyId, "repair", actorId, record.resolutionNotes);
    const event = await tx.libraryCopyEvent.findFirst({ where: { copyId: record.copyId, ...(before ? { id: { not: before.id } } : {}) }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (!event) throw new Error("Append-only copy event was not created");
    const claimed = await tx.libraryStockVerificationRecord.updateMany({ where: { id: recordId, appliedCopyEventId: null, resolutionStatus: record.resolutionStatus }, data: { resolutionStatus: "APPLIED", appliedCopyEventId: event.id, appliedByUserId: actorId } });
    if (claimed.count !== 1) throw new Error("This correction was already applied concurrently");
    await tx.libraryStockVerificationEvent.create({ data: { sessionId, eventType: "RESOLUTION_APPLIED", eventDate: new Date(), notes: `${record.expectedAccessionNumberSnapshot}: ${record.resolutionStatus}`, recordedByUserId: actorId } });
    await recalculateSession(tx, sessionId);
    return { record: await tx.libraryStockVerificationRecord.findUniqueOrThrow({ where: { id: recordId } }), idempotent: false };
  });
}

export async function approveStockSession(client: PrismaClient, sessionId: string, actorId: string) {
  return client.$transaction(async (tx) => {
    await recalculateSession(tx, sessionId);
    const session = await tx.libraryStockVerificationSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== "REVIEWED") throw new Error("Only a reviewed session can be approved");
    if (session.unresolvedCount) throw new Error(`${session.unresolvedCount} approved or pending discrepancies remain unresolved`);
    const updated = await tx.libraryStockVerificationSession.updateMany({ where: { id: sessionId, status: "REVIEWED", approvedAt: null }, data: { status: "APPROVED", approvedAt: new Date(), approvedByUserId: actorId } });
    if (updated.count !== 1) throw new Error("This session was already approved concurrently");
    await tx.libraryStockVerificationEvent.create({ data: { sessionId, eventType: "APPROVED", eventDate: new Date(), recordedByUserId: actorId } });
    return tx.libraryStockVerificationSession.findUniqueOrThrow({ where: { id: sessionId } });
  });
}

export async function lockStockSession(client: PrismaClient, sessionId: string, actorId: string) {
  return client.$transaction(async (tx) => {
    const updated = await tx.libraryStockVerificationSession.updateMany({ where: { id: sessionId, status: "APPROVED", lockedAt: null }, data: { status: "LOCKED", lockedAt: new Date(), lockedByUserId: actorId } });
    if (updated.count !== 1) throw new Error("Only an approved, unlocked session can be locked");
    await tx.libraryStockVerificationEvent.create({ data: { sessionId, eventType: "LOCKED", eventDate: new Date(), recordedByUserId: actorId } });
    return tx.libraryStockVerificationSession.findUniqueOrThrow({ where: { id: sessionId } });
  });
}

export async function cancelStockSession(client: PrismaClient, sessionId: string, reasonInput: unknown, actorId: string) {
  const reason = safeText(reasonInput, "Cancellation reason", 1000, true)!;
  return client.$transaction(async (tx) => {
    const updated = await tx.libraryStockVerificationSession.updateMany({ where: { id: sessionId, status: { in: ["DRAFT", "IN_PROGRESS", "SUBMITTED", "REVIEWED"] }, lockedAt: null }, data: { status: "CANCELLED", cancellationReason: reason, cancelledAt: new Date(), cancelledByUserId: actorId } });
    if (updated.count !== 1) throw new Error("Approved or locked sessions cannot be cancelled through the normal workflow");
    await tx.libraryStockVerificationEvent.create({ data: { sessionId, eventType: "CANCELLED", eventDate: new Date(), notes: reason, recordedByUserId: actorId } });
    return tx.libraryStockVerificationSession.findUniqueOrThrow({ where: { id: sessionId } });
  });
}

export function publicStockRecord(row: any, masked = false) {
  return {
    id: masked ? undefined : row.id, accessionNumber: row.expectedAccessionNumberSnapshot, barcodeValue: row.expectedBarcodeSnapshot,
    title: row.expectedTitleSnapshot, expectedShelfCode: row.expectedShelfCodeSnapshot, expectedStatus: row.expectedStatusSnapshot,
    expectedCondition: row.expectedConditionSnapshot, expectedLoanStatus: row.expectedLoanStatusSnapshot,
    borrowerType: row.expectedBorrowerTypeSnapshot, dueDate: row.expectedDueDateSnapshot,
    observationStatus: row.observationStatus, observedAt: row.observedAt, observedShelfCode: row.observedShelfCode,
    observedCondition: row.observedCondition, scanMethod: row.scanMethod,
    observationNotes: masked ? null : row.observationNotes, discrepancyReason: masked ? null : row.discrepancyReason,
    resolutionStatus: row.resolutionStatus, resolutionNotes: masked ? null : row.resolutionNotes,
    correctionApplied: Boolean(row.appliedCopyEventId)
  };
}

export async function loadStockSession(client: PrismaClient, id: string, masked = false) {
  const session = await client.libraryStockVerificationSession.findUnique({ where: { id }, include: {
    records: { orderBy: { expectedAccessionNumberSnapshot: "asc" } },
    scanEvents: { orderBy: { scannedAt: "desc" }, take: 50, include: { recordedBy: { select: { name: true } } } },
    events: { orderBy: { eventDate: "desc" }, include: { recordedBy: { select: { name: true } } } }
  } });
  if (!session) return null;
  return { ...session, id: masked ? undefined : session.id, titleIdFilter: masked ? undefined : session.titleIdFilter, createdByUserId: undefined, startedByUserId: undefined, submittedByUserId: undefined, reviewedByUserId: undefined, approvedByUserId: undefined, lockedByUserId: undefined, cancelledByUserId: undefined,
    records: session.records.map((row) => publicStockRecord(row, masked)),
    scanEvents: session.scanEvents.map((event) => ({ resultType: event.resultType, scanMethod: event.scanMethod, normalizedInput: event.normalizedInput, scannedAt: event.scannedAt, notes: masked ? null : event.notes, actorLabel: masked ? "Masked operator" : event.recordedBy?.name ?? "System / restored record" })),
    events: session.events.map((event) => ({ eventType: event.eventType, eventDate: event.eventDate, notes: masked ? null : event.notes, actorLabel: masked ? "Masked operator" : event.recordedBy?.name ?? "System / restored record" }))
  };
}
