import type { PrismaClient, Prisma } from "@prisma/client";
import { databaseTableExists } from "@/lib/database-capabilities";
import { effectiveReceiptState, type ReceiptIntegrityPayment, loadReceiptStateMap, effectiveActiveSelectedReceiptPayments } from "@/lib/receipt-integrity";
import { PRIOR_YEAR_CONTRACT, PRIOR_YEAR_STATES, priorYearAmount, approvalSeparation, reconcilePriorYear, sumPriorYearAmounts } from "@/lib/prior-year-concession-policy";

export const PRIOR_YEAR_BACKUP_VERSION = 47;
export const PRIOR_YEAR_BACKUP_CONTRACT = `${PRIOR_YEAR_CONTRACT}:v47:liability-case-income-event-payment-item-snapshot`;
export const PRIOR_YEAR_BACKUP_KEYS = ["priorYearLiabilities", "priorYearPaymentAttributions", "priorYearConcessionCases", "priorYearIncomeSupports", "priorYearConcessionEvents", "studentItemReceiptSnapshots"] as const;
export type PriorYearBackupKey = typeof PRIOR_YEAR_BACKUP_KEYS[number];
export type PriorYearBackup = Record<PriorYearBackupKey, Record<string, unknown>[]>;
type Result = Record<PriorYearBackupKey, { created: number; updated: number; skipped: number; errors: string[] }>;
const models: Record<PriorYearBackupKey, string> = { priorYearLiabilities: "priorYearLiability", priorYearPaymentAttributions: "priorYearPaymentAttribution", priorYearConcessionCases: "priorYearConcessionCase", priorYearIncomeSupports: "priorYearIncomeSupport", priorYearConcessionEvents: "priorYearConcessionEvent", studentItemReceiptSnapshots: "studentItemReceiptSnapshot" };
const fields: Record<PriorYearBackupKey, string> = {
  priorYearLiabilities: "id studentId operatingYear sourceYear sourceEnrollmentId openingAmount existingCredits sourceReferencesJson provenance preparerId verifierId verifiedAt status version createdAt",
  priorYearPaymentAttributions: "id liabilityId paymentId sourceYear recordedById reviewedById provenance createdAt",
  priorYearConcessionCases: "id liabilityId status kind requestedAmount approvedAmount reason scopeJson preparerId reviewerId approverId applicantReference validFrom validTo balanceHash balanceVersion appliedBalanceHash appliedVersion version createdAt updatedAt",
  priorYearIncomeSupports: "id caseId status bandId exactAmountEnvelope expiresAt recordedById updatedAt",
  priorYearConcessionEvents: "id liabilityId caseId eventType referenceId actorId previousState newState amount reason balanceHash balanceVersion requestKey requestHash reversesEventId createdAt",
  studentItemReceiptSnapshots: "id receiptId studentId academicYear admissionNo studentName className section linesJson createdAt"
};
const dates = new Set(["verifiedAt", "createdAt", "updatedAt", "validFrom", "validTo", "expiresAt"]);
const amounts = new Set(["openingAmount", "existingCredits", "requestedAmount", "approvedAmount", "amount"]);
const integers = new Set(["version", "balanceVersion", "appliedVersion"]);
const serial = (value: unknown) => JSON.parse(JSON.stringify(value));

export function emptyPriorYearBackup(): PriorYearBackup {
  return Object.fromEntries(PRIOR_YEAR_BACKUP_KEYS.map((key) => [key, []])) as unknown as PriorYearBackup;
}

export function validatePriorYearBackup(root: Record<string, unknown>): PriorYearBackup {
  const output = emptyPriorYearBackup();
  for (const key of PRIOR_YEAR_BACKUP_KEYS) {
    const rows = root[key] ?? [];
    if (!Array.isArray(rows) || rows.length > 100000) throw new Error("PRIOR_YEAR_BACKUP_ROWS_INVALID");
    const ids = new Set<string>();
    for (const raw of rows) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("PRIOR_YEAR_BACKUP_ROW_INVALID");
      const row = serial(raw) as Record<string, unknown>;
      const allowed = new Set(fields[key].split(" "));
      if (Object.keys(row).length !== allowed.size || Object.keys(row).some((field) => !allowed.has(field)) || typeof row.id !== "string" || !row.id || ids.has(row.id)) throw new Error("PRIOR_YEAR_BACKUP_IDENTITY_INVALID");
      ids.add(row.id);
      for (const [field, value] of Object.entries(row)) {
        if (value === null) continue;
        if (dates.has(field)) { if (typeof value !== "string" || !Number.isFinite(new Date(value).getTime())) throw new Error("PRIOR_YEAR_BACKUP_DATE_INVALID"); }
        else if (amounts.has(field)) priorYearAmount(value, true);
        else if (integers.has(field)) { if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error("PRIOR_YEAR_BACKUP_VERSION_INVALID"); }
        else if (typeof value !== "string" || value.length > 64000) throw new Error("PRIOR_YEAR_BACKUP_FIELD_INVALID");
      }
      if (key === "priorYearLiabilities" && row.status === "VERIFIED" && (!row.verifierId || !row.verifiedAt || row.verifierId === row.preparerId)) throw new Error("PRIOR_YEAR_BACKUP_VERIFICATION_INVALID");
      if (key === "priorYearConcessionCases" && !PRIOR_YEAR_STATES.includes(row.status as typeof PRIOR_YEAR_STATES[number])) throw new Error("PRIOR_YEAR_BACKUP_STATE_INVALID");
      if (key === "priorYearIncomeSupports" && row.exactAmountEnvelope) {
        const envelope = JSON.parse(String(row.exactAmountEnvelope));
        if (envelope.version !== 1 || !envelope.ciphertext || !envelope.authTag || !envelope.nonce || !envelope.keyVersion || Object.keys(envelope).some((field) => !["version", "ciphertext", "authTag", "nonce", "keyVersion"].includes(field))) throw new Error("PRIOR_YEAR_BACKUP_PRIVATE_ENVELOPE_INVALID");
      }
      output[key].push(row);
    }
  }
  const liabilityIds = new Set(output.priorYearLiabilities.map((row) => row.id)), caseIds = new Set(output.priorYearConcessionCases.map((row) => row.id)), eventIds = new Set(output.priorYearConcessionEvents.map((row) => row.id));
  for (const key of PRIOR_YEAR_BACKUP_KEYS) for (const row of output[key]) {
    if (row.liabilityId && !liabilityIds.has(row.liabilityId)) throw new Error("PRIOR_YEAR_BACKUP_LIABILITY_REFERENCE_INVALID");
    if (row.caseId && !caseIds.has(row.caseId)) throw new Error("PRIOR_YEAR_BACKUP_CASE_REFERENCE_INVALID");
    if (row.reversesEventId && !eventIds.has(row.reversesEventId)) throw new Error("PRIOR_YEAR_BACKUP_REVERSAL_REFERENCE_INVALID");
  }
  const liabilities = new Map(output.priorYearLiabilities.map((row) => [row.id, row]));
  const cases = new Map(output.priorYearConcessionCases.map((row) => [row.id, row]));
  const events = new Map(output.priorYearConcessionEvents.map((row) => [row.id, row]));
  const reversed = new Set<unknown>(), paymentReferences = new Set<unknown>();
  for (const row of output.priorYearPaymentAttributions) {
    if (paymentReferences.has(row.paymentId) || row.recordedById === row.reviewedById || !row.provenance || (row.liabilityId && liabilities.get(row.liabilityId)?.sourceYear !== row.sourceYear)) throw new Error("PRIOR_YEAR_BACKUP_PAYMENT_SCOPE_INVALID");
    paymentReferences.add(row.paymentId);
  }
  for (const row of output.priorYearConcessionCases) {
    if (!["SCHOOL_WAIVER", "SCHOLARSHIP", "SPONSORSHIP_PROMISE"].includes(String(row.kind)) || !row.preparerId || !row.reason || !row.applicantReference || !row.scopeJson || priorYearAmount(row.requestedAmount).lte(0)) throw new Error("PRIOR_YEAR_BACKUP_CASE_INVALID");
    if (new Date(String(row.validFrom)) > new Date(String(row.validTo))) throw new Error("PRIOR_YEAR_BACKUP_CASE_DATES_INVALID");
    if (["APPROVED", "APPLIED", "EXPIRED", "REVERSED"].includes(String(row.status))) {
      approvalSeparation(String(row.preparerId), row.reviewerId as string | null, String(row.approverId ?? ""));
      if (!row.approverId || !row.balanceHash || row.balanceVersion == null || priorYearAmount(row.approvedAmount).gt(String(row.requestedAmount))) throw new Error("PRIOR_YEAR_BACKUP_APPROVAL_INVALID");
    }
    const applied = output.priorYearConcessionEvents.filter((event) => event.caseId === row.id && event.eventType === "RELIEF_APPLIED");
    const compensation = output.priorYearConcessionEvents.filter((event) => event.caseId === row.id && event.eventType === "RELIEF_REVERSED");
    if (applied.length > 1 || compensation.length > 1 || (["APPLIED", "REVERSED"].includes(String(row.status)) !== (applied.length === 1)) || ((row.status === "REVERSED") !== (compensation.length === 1))) throw new Error("PRIOR_YEAR_BACKUP_APPLIED_STATE_INVALID");
  }
  for (const row of output.priorYearConcessionEvents) {
    const current = row.caseId ? cases.get(row.caseId) : null;
    if (current && current.liabilityId !== row.liabilityId) throw new Error("PRIOR_YEAR_BACKUP_EVENT_SCOPE_INVALID");
    if (["RELIEF_APPLIED", "RELIEF_REVERSED"].includes(String(row.eventType))) {
      if (!current || current.kind === "SPONSORSHIP_PROMISE" || !priorYearAmount(row.amount).eq(String(current.approvedAmount)) || row.actorId === current.approverId && row.eventType === "RELIEF_APPLIED") throw new Error("PRIOR_YEAR_BACKUP_RELIEF_INVALID");
    }
    if (row.reversesEventId) {
      const original = events.get(row.reversesEventId);
      if (reversed.has(row.reversesEventId) || row.eventType !== "RELIEF_REVERSED" || original?.eventType !== "RELIEF_APPLIED" || original.caseId !== row.caseId || original.liabilityId !== row.liabilityId || !priorYearAmount(row.amount).eq(String(original.amount))) throw new Error("PRIOR_YEAR_BACKUP_REVERSAL_INVALID");
      reversed.add(row.reversesEventId);
    } else if (row.eventType === "RELIEF_REVERSED") throw new Error("PRIOR_YEAR_BACKUP_REVERSAL_INVALID");
  }
  if (Array.isArray(root.payments)) {
    const payments = new Map((root.payments as Record<string, unknown>[]).map((row) => [row.id, row]));
    for (const link of output.priorYearPaymentAttributions) {
      const payment = payments.get(link.paymentId);
      if (!payment || payment.feeType !== "Old Due" || (link.liabilityId && payment.studentId !== liabilities.get(link.liabilityId)?.studentId)) throw new Error("PRIOR_YEAR_BACKUP_PAYMENT_IDENTITY_INVALID");
      const siblings = [...payments.values()].filter((row) => row.receiptNo === payment.receiptNo);
      if (effectiveReceiptState(siblings as unknown as ReceiptIntegrityPayment[]).status === "INCONSISTENT") throw new Error("PRIOR_YEAR_BACKUP_RECEIPT_INTEGRITY_INVALID");
    }
    for (const liability of output.priorYearLiabilities) {
      const paid = output.priorYearPaymentAttributions.filter((row) => row.liabilityId === liability.id).map((row) => payments.get(row.paymentId)!).filter((row) => !row.isCancelled && !row.deletedAt).map((row) => priorYearAmount(row.amountPaid).toString());
      const relief = output.priorYearConcessionEvents.filter((row) => row.liabilityId === liability.id);
      reconcilePriorYear({ opening: liability.openingAmount, existingCredits: liability.existingCredits, payments: sumPriorYearAmounts(paid).toString(), appliedRelief: sumPriorYearAmounts(relief.filter((row) => row.eventType === "RELIEF_APPLIED").map((row) => String(row.amount))).toString(), reversals: sumPriorYearAmounts(relief.filter((row) => row.eventType === "RELIEF_REVERSED").map((row) => String(row.amount))).toString() });
    }
  }
  if (Array.isArray(root.miscIncomeReceipts)) {
    const receipts = new Map((root.miscIncomeReceipts as Record<string, unknown>[]).map((row) => [row.id, row]));
    for (const snapshot of output.studentItemReceiptSnapshots) {
      const receipt = receipts.get(snapshot.receiptId);
      if (!receipt || receipt.studentId !== snapshot.studentId || receipt.academicYear !== snapshot.academicYear) throw new Error("STUDENT_ITEM_BACKUP_SNAPSHOT_IDENTITY_INVALID");
      const lines = JSON.parse(String(snapshot.linesJson));
      if (!Array.isArray(lines) || !lines.length || lines.length > 30 || lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000)) throw new Error("STUDENT_ITEM_BACKUP_SNAPSHOT_LINES_INVALID");
      if (!sumPriorYearAmounts(lines.map((line) => priorYearAmount(line.amount, true).toString())).eq(String(receipt.netAmount))) throw new Error("STUDENT_ITEM_BACKUP_SNAPSHOT_TOTAL_INVALID");
    }
  }
  return output;
}

export async function loadPriorYearBackup(client: PrismaClient): Promise<PriorYearBackup> {
  if (!(client as any).priorYearLiability?.findMany) return emptyPriorYearBackup();
  if (!await databaseTableExists(client, "PriorYearLiability")) return emptyPriorYearBackup();
  const data = emptyPriorYearBackup();
  for (const key of PRIOR_YEAR_BACKUP_KEYS) data[key] = serial(await (client as any)[models[key]].findMany({ orderBy: { id: "asc" } }));
  // Expired optional support must not gain a new retention period through backup.
  for (const row of data.priorYearIncomeSupports) if (row.expiresAt && new Date(String(row.expiresAt)) <= new Date()) { row.status = "NOT_PROVIDED"; row.bandId = null; row.exactAmountEnvelope = null; }
  return validatePriorYearBackup(data);
}

export async function restorePriorYearBackup(client: PrismaClient | Prisma.TransactionClient, backup: PriorYearBackup, result: Result, maps: { students: Map<string, string>; payments: Map<string, string> }) {
  const data = validatePriorYearBackup(backup);
  if (!PRIOR_YEAR_BACKUP_KEYS.some((key) => data[key].length)) return;
  const restore = async (tx: Prisma.TransactionClient) => {
    for (const key of PRIOR_YEAR_BACKUP_KEYS) for (const raw of data[key]) {
      const row = { ...raw };
      if (row.studentId) {
        const studentId = maps.students.get(String(row.studentId));
        if (!studentId) throw new Error("PRIOR_YEAR_RESTORE_STUDENT_UNRESOLVED");
        row.studentId = studentId;
      }
      if (key === "priorYearLiabilities") {
        const enrollment = await tx.academicYearEnrollment.findUnique({ where: { studentId_academicYear: { studentId: String(row.studentId), academicYear: String(row.sourceYear) } } });
        if (!enrollment) throw new Error("PRIOR_YEAR_RESTORE_ENROLLMENT_UNRESOLVED");
        row.sourceEnrollmentId = enrollment.id;
      }
      if (row.paymentId) {
        const paymentId = maps.payments.get(String(row.paymentId));
        if (!paymentId) throw new Error("PRIOR_YEAR_RESTORE_PAYMENT_UNRESOLVED");
        row.paymentId = paymentId;
      }
      if (row.referenceId && /PAYMENT/.test(String(row.eventType))) row.referenceId = maps.payments.get(String(row.referenceId)) ?? row.referenceId;
      for (const date of dates) if (typeof row[date] === "string") row[date] = new Date(row[date]);
      const model = (tx as any)[models[key]], existing = await model.findUnique({ where: { id: row.id } });
      if (existing) {
        const compare = (value: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(serial(value)).sort(([a], [b]) => a.localeCompare(b))));
        if (compare(existing) !== compare(row)) throw new Error("PRIOR_YEAR_RESTORE_IMMUTABLE_CONFLICT");
        result[key].skipped++;
      } else { await model.create({ data: row }); result[key].created++; }
    }
    // Merge restores may deduplicate payments. Validate the destination, never just the source JSON.
    for (const source of data.priorYearLiabilities) {
      const liability = await tx.priorYearLiability.findUniqueOrThrow({ where: { id: String(source.id) }, include: { paymentLinks: { include: { payment: true } }, events: true } });
      const payments = liability.paymentLinks.map((link) => link.payment);
      if (payments.some((payment) => payment.studentId !== liability.studentId || payment.feeType !== "Old Due")) throw new Error("PRIOR_YEAR_RESTORE_PAYMENT_IDENTITY_CONFLICT");
      const receipts = await loadReceiptStateMap(tx, payments.map((payment) => payment.receiptNo));
      if ([...receipts.values()].some((receipt) => !["ACTIVE", "CANCELLED"].includes(receipt.status))) throw new Error("PRIOR_YEAR_RESTORE_RECEIPT_INTEGRITY_CONFLICT");
      const active = await effectiveActiveSelectedReceiptPayments(tx, payments);
      reconcilePriorYear({ opening: liability.openingAmount.toString(), existingCredits: liability.existingCredits.toString(), payments: sumPriorYearAmounts(active.map((payment) => String(payment.amountPaid))).toString(), appliedRelief: sumPriorYearAmounts(liability.events.filter((event) => event.eventType === "RELIEF_APPLIED").map((event) => event.amount)).toString(), reversals: sumPriorYearAmounts(liability.events.filter((event) => event.eventType === "RELIEF_REVERSED").map((event) => event.amount)).toString() });
    }
    for (const source of data.studentItemReceiptSnapshots) {
      const receipt = await tx.miscIncomeReceipt.findUniqueOrThrow({ where: { id: String(source.receiptId) }, include: { lines: true } });
      if (receipt.studentId !== maps.students.get(String(source.studentId)) || receipt.academicYear !== source.academicYear) throw new Error("STUDENT_ITEM_RESTORE_IDENTITY_CONFLICT");
      const lines = JSON.parse(String(source.linesJson));
      if (!sumPriorYearAmounts(lines.map((line: { amount: string }) => line.amount)).eq(receipt.netAmount)) throw new Error("STUDENT_ITEM_RESTORE_AMOUNT_CONFLICT");
      const snapshotLines = lines.map((line: { itemId: string; rateId: string; quantity: number; unitAmount: string; amount: string }) => JSON.stringify([line.itemId, line.rateId, line.quantity, priorYearAmount(line.unitAmount, true).toFixed(2), priorYearAmount(line.amount, true).toFixed(2)])).sort();
      const actualLines = receipt.lines.map((line) => JSON.stringify([line.itemId, line.rateId, line.quantity, line.unitAmount.toFixed(2), line.lineTotal.toFixed(2)])).sort();
      if (JSON.stringify(snapshotLines) !== JSON.stringify(actualLines)) throw new Error("STUDENT_ITEM_RESTORE_LINE_CONFLICT");
    }
  };
  if ("$transaction" in client) await client.$transaction(restore, { timeout: 30000 });
  else await restore(client);
}
