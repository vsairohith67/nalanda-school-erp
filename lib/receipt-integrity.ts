import {
  publishReceiptLeadershipNotification,
  receiptLeadershipEventKey,
  type ReceiptLeadershipActor
} from "@/lib/receipt-leadership-notifications";
import { assertReceiptStudentMatchInDatabase } from "@/lib/payment-controls";

export type ReceiptIntegrityStatus = "ACTIVE" | "CANCELLED" | "INCONSISTENT";

export type ReceiptIntegrityPayment = {
  id: string;
  receiptNo: string;
  amountPaid: number;
  isCancelled?: boolean | null;
  deletedAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type ReceiptIntegrityNote = {
  status?: string | null;
  remarks?: string | null;
} | null | undefined;

export type ReceiptComponentIdentity = {
  receiptNo: string;
  admissionNo: string;
  date: Date | string;
  feeType: string;
  termHint: string;
};

export class ReceiptIntegrityError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ReceiptIntegrityError";
  }
}

export class ReceiptLockedDayError extends ReceiptIntegrityError {
  constructor(
    message: string,
    public readonly detail: {
      receiptNo: string;
      amount: number;
      receiptDate: Date;
      dayStatus: string;
      action: "CANCEL" | "CORRECT";
      reason: string;
      expectedVersion: string;
    }
  ) {
    super(message, 409);
    this.name = "ReceiptLockedDayError";
  }
}

export function receiptVersion(rows: ReceiptIntegrityPayment[]) {
  const activeRows = rows.filter((row) => !row.deletedAt);
  const latest = activeRows.reduce((value, row) => {
    const timestamp = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    return Math.max(value, Number.isFinite(timestamp) ? timestamp : 0);
  }, 0);
  const cancelled = activeRows.filter((row) => row.isCancelled).length;
  return `${activeRows.length}:${cancelled}:${latest}`;
}

export function effectiveReceiptState(
  rows: ReceiptIntegrityPayment[],
  note?: ReceiptIntegrityNote
) {
  const paymentRows = rows.filter((row) => !row.deletedAt);
  const activeRows = paymentRows.filter((row) => !row.isCancelled);
  const cancelledRows = paymentRows.filter((row) => row.isCancelled);
  const status: ReceiptIntegrityStatus =
    !paymentRows.length || activeRows.length === paymentRows.length
      ? "ACTIVE"
      : cancelledRows.length === paymentRows.length
        ? "CANCELLED"
        : "INCONSISTENT";
  const normalizedNoteStatus = String(note?.status ?? "").trim().toUpperCase();
  const expectedNoteStatus = status === "ACTIVE" ? "ACTIVE" : status === "CANCELLED" ? "CANCELLED" : "INCONSISTENT";
  return {
    status,
    activeRows,
    cancelledRows,
    rows: paymentRows,
    version: receiptVersion(paymentRows),
    noteStatus: normalizedNoteStatus || null,
    noteConsistent: !normalizedNoteStatus || normalizedNoteStatus === expectedNoteStatus
  };
}

export function effectiveActiveReceiptPayments<T extends ReceiptIntegrityPayment>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    if (row.deletedAt) continue;
    grouped.set(row.receiptNo, [...(grouped.get(row.receiptNo) ?? []), row]);
  }
  return Array.from(grouped.values()).flatMap((receiptRows) =>
    effectiveReceiptState(receiptRows).status === "ACTIVE" ? receiptRows : []
  );
}

export function receiptStateMap<T extends ReceiptIntegrityPayment>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    if (row.deletedAt) continue;
    grouped.set(row.receiptNo, [...(grouped.get(row.receiptNo) ?? []), row]);
  }
  return new Map(
    Array.from(grouped.entries()).map(([receiptNo, receiptRows]) => [
      receiptNo,
      effectiveReceiptState(receiptRows)
    ])
  );
}

export async function loadReceiptStateMap(
  client: any,
  receiptNos: Iterable<string>
) {
  const uniqueReceiptNos = Array.from(
    new Set(Array.from(receiptNos, (receiptNo) => String(receiptNo).trim()).filter(Boolean))
  );
  const rows: ReceiptIntegrityPayment[] = [];
  for (let offset = 0; offset < uniqueReceiptNos.length; offset += 400) {
    const chunk = uniqueReceiptNos.slice(offset, offset + 400);
    const siblings = await client.payment.findMany({
      where: {
        receiptNo: { in: chunk },
        deletedAt: null
      },
      select: {
        id: true,
        receiptNo: true,
        amountPaid: true,
        isCancelled: true,
        deletedAt: true,
        updatedAt: true
      }
    });
    rows.push(...siblings);
  }
  return receiptStateMap(rows);
}

export async function effectiveActiveSelectedReceiptPayments<
  T extends ReceiptIntegrityPayment
>(client: any, selectedRows: T[]) {
  const states = await loadReceiptStateMap(
    client,
    selectedRows.map((row) => row.receiptNo)
  );
  return selectedRows.filter(
    (row) => !row.deletedAt && states.get(row.receiptNo)?.status === "ACTIVE"
  );
}

export async function assertReceiptAcceptsActiveComponent(
  client: any,
  input: ReceiptComponentIdentity,
  excludePaymentId?: string
) {
  const [payments, note] = await Promise.all([
    client.payment.findMany({
      where: {
        receiptNo: input.receiptNo,
        deletedAt: null,
        ...(excludePaymentId ? { id: { not: excludePaymentId } } : {})
      },
      select: {
        id: true,
        receiptNo: true,
        amountPaid: true,
        isCancelled: true,
        deletedAt: true,
        updatedAt: true,
        admissionNo: true,
        date: true,
        feeType: true,
        termHint: true
      }
    }),
    client.receiptNote.findUnique({ where: { receiptNo: input.receiptNo } })
  ]);
  if (payments.some((payment: ReceiptIntegrityPayment) => payment.isCancelled)) {
    throw new ReceiptIntegrityError("A cancelled receipt number cannot receive a new active component", 409);
  }
  if (String(note?.status ?? "").trim().toUpperCase() === "CANCELLED") {
    throw new ReceiptIntegrityError("This receipt is recorded as cancelled and cannot receive a new active component", 409);
  }
  const expectedDate = normalizedReceiptDate(input.date);
  if (payments.some((payment: ReceiptIntegrityPayment & ReceiptComponentIdentity) =>
    payment.admissionNo !== input.admissionNo ||
    normalizedReceiptDate(payment.date) !== expectedDate ||
    payment.feeType !== input.feeType ||
    payment.termHint !== input.termHint
  )) {
    throw new ReceiptIntegrityError(
      "Receipt components must keep the same student, date, fee type, and term",
      409
    );
  }
}

export async function assertReceiptIsNewForCreate(client: any, receiptNo: string) {
  const [existingPayment, existingNote] = await Promise.all([
    client.payment.findFirst({
      where: { receiptNo, deletedAt: null },
      select: { id: true }
    }),
    client.receiptNote.findUnique({
      where: { receiptNo },
      select: { receiptNo: true }
    })
  ]);
  if (existingPayment || existingNote) {
    throw new ReceiptIntegrityError(
      "This receipt already exists. Use the audited receipt-correction workflow.",
      409
    );
  }
}

export async function assertReceiptMutationVersion(
  client: any,
  receiptNo: string,
  expectedVersion: unknown
) {
  const rows = await loadReceiptRows(client, receiptNo);
  if (!rows.length) throw new ReceiptIntegrityError("Receipt not found", 404);
  const state = effectiveReceiptState(rows);
  assertExpectedVersion(expectedVersion, state.version);
  return state;
}

export async function cancelWholeReceipt(
  client: any,
  input: {
    authorization: "CANCEL_FINAL_RECEIPT";
    receiptNo: string;
    reason: unknown;
    actor: ReceiptLeadershipActor;
    expectedVersion?: unknown;
  }
) {
  assertExactWorkflowAuthorization(
    input.authorization,
    "CANCEL_FINAL_RECEIPT"
  );
  const reason = requiredReason(input.reason, "Cancellation reason");
  try {
    return await client.$transaction(async (tx: any) => {
      const rows = await loadReceiptRows(tx, input.receiptNo);
      if (!rows.length) throw new ReceiptIntegrityError("Receipt not found", 404);
      const state = effectiveReceiptState(rows);
      if (state.status === "CANCELLED") {
        return receiptMutationResult(rows, state.version, true, 0);
      }
      assertExpectedVersion(input.expectedVersion, state.version);
      await assertAccountantReceiptDayMutable(
        tx,
        rows,
        input.actor,
        "CANCEL",
        reason,
        state.version
      );
      const activeRows = state.activeRows;
      const now = new Date();
      const changed = await tx.payment.updateMany({
        where: {
          receiptNo: input.receiptNo,
          deletedAt: null,
          isCancelled: false
        },
        data: {
          isCancelled: true,
          cancelledAt: now,
          cancelledByUserId: input.actor.id,
          cancellationReason: reason,
          editedBy: input.actor.name
        }
      });
      if (changed.count !== activeRows.length) {
        throw new ReceiptIntegrityError("Receipt changed while cancellation was processed. Refresh and review it.", 409);
      }
      let primaryAudit: { id: string } | null = null;
      for (const row of activeRows) {
        const audit = await tx.paymentAudit.create({
          data: {
            paymentId: row.id,
            action: "RECEIPT_CANCELLED",
            oldValueJson: JSON.stringify(receiptAuditSnapshot(row)),
            newValueJson: JSON.stringify({
              ...receiptAuditSnapshot(row),
              isCancelled: true,
              cancelledAt: now.toISOString()
            }),
            changedByUserId: input.actor.id,
            changedByName: input.actor.name,
            reason
          }
        });
        primaryAudit ??= audit;
      }
      await synchronizeReceiptNote(tx, input.receiptNo, "Cancelled", reason);
      const updated = rows.map((row) => ({
        ...row,
        isCancelled: true,
        cancelledAt: now,
        cancellationReason: reason,
        updatedAt: now
      }));
      const notification =
        input.actor.role === "ACCOUNTANT" && primaryAudit
          ? await publishReceiptLeadershipNotification(tx, {
              eventKey: primaryAudit.id,
              action: "CANCELLED",
              receiptNo: input.receiptNo,
              amount: updated.reduce((sum, row) => sum + Number(row.amountPaid), 0),
              receiptDate: String((updated[0] as Record<string, unknown>).date),
              actor: input.actor,
              reason,
              versionReference: `${state.version} -> ${receiptVersion(updated)}`
            })
          : null;
      return {
        ...receiptMutationResult(updated, receiptVersion(updated), false, changed.count),
        leadershipNotification: notification
      };
    });
  } catch (error) {
    if (error instanceof ReceiptLockedDayError) {
      await publishLockedDayReview(client, error, input.actor);
      throw error;
    }
    const rows = await loadReceiptRows(client, input.receiptNo);
    if (rows.length && effectiveReceiptState(rows).status === "CANCELLED") {
      return receiptMutationResult(rows, receiptVersion(rows), true, 0);
    }
    throw error;
  }
}

export async function correctFinalReceipt(
  client: any,
  input: {
    authorization: "CORRECT_FINAL_RECEIPT";
    paymentId: string;
    payload: {
      date: Date;
      receiptNo: string;
      admissionNo: string;
      amountPaid: number;
      paymentMode: string;
      receivedAccount: string;
      transactionRefNo: string | null;
      feeType: string;
      termHint: string;
      remarks: string | null;
    };
    reason: unknown;
    expectedVersion: unknown;
    idempotencyKey: unknown;
    actor: ReceiptLeadershipActor;
  }
) {
  assertExactWorkflowAuthorization(
    input.authorization,
    "CORRECT_FINAL_RECEIPT"
  );
  const reason = requiredReason(input.reason, "Correction reason");
  const idempotencyKey = requiredIdempotencyKey(input.idempotencyKey);
  const previous = await findCorrectionByIdempotency(
    client,
    input.paymentId,
    idempotencyKey
  );
  if (previous) return { ...previous, idempotent: true };

  try {
    return await client.$transaction(async (tx: any) => {
      const target = await tx.payment.findUnique({ where: { id: input.paymentId } });
      if (!target || target.deletedAt) {
        throw new ReceiptIntegrityError("Payment not found", 404);
      }
      await assertReceiptStudentMatchInDatabase(tx, {
        receiptNo: target.receiptNo,
        admissionNo: target.admissionNo,
        excludePaymentId: target.id
      });
      const rows = await loadReceiptRows(tx, target.receiptNo);
      const state = effectiveReceiptState(rows);
      if (state.status !== "ACTIVE") {
        throw new ReceiptIntegrityError(
          "Only an active, internally consistent final receipt can be corrected.",
          409
        );
      }
      assertExpectedVersion(input.expectedVersion, state.version);
      if (input.payload.receiptNo !== target.receiptNo) {
        throw new ReceiptIntegrityError(
          "The original receipt number is immutable after final issue.",
          409
        );
      }
      await assertAccountantReceiptDayMutable(
        tx,
        rows,
        input.actor,
        "CORRECT",
        reason,
        state.version
      );
      const financial = correctionChangesFinancialFacts(target, input.payload);
      const correctedStudent =
        input.payload.admissionNo === target.admissionNo
          ? null
          : await loadCorrectionStudent(tx, input.payload.admissionNo);
      if (
        financial &&
        input.actor.role === "ACCOUNTANT" &&
        new Date(target.date).getTime() !== input.payload.date.getTime()
      ) {
        await assertAccountantTargetDayMutable(
          tx,
          rows,
          input.payload.date,
          input.actor,
          reason,
          state.version
        );
      }
      return financial
        ? financialReceiptCorrection(tx, rows, target, {
            ...input,
            reason,
            idempotencyKey,
            correctedStudent
          })
        : nonFinancialReceiptCorrection(tx, rows, target, {
            ...input,
            reason,
            idempotencyKey
          });
    });
  } catch (error) {
    if (error instanceof ReceiptLockedDayError) {
      await publishLockedDayReview(client, error, input.actor);
      throw error;
    }
    const previousAfterFailure = await findCorrectionByIdempotency(
      client,
      input.paymentId,
      idempotencyKey
    );
    if (previousAfterFailure) return { ...previousAfterFailure, idempotent: true };
    throw error;
  }
}

export async function restoreWholeReceipt(
  client: any,
  input: {
    receiptNo: string;
    reason: unknown;
    actor: { id: string; name: string };
    expectedVersion?: unknown;
  }
) {
  const reason = requiredReason(input.reason, "Restore reason");
  try {
    return await client.$transaction(async (tx: any) => {
      const rows = await loadReceiptRows(tx, input.receiptNo);
      if (!rows.length) throw new ReceiptIntegrityError("Receipt not found", 404);
      const state = effectiveReceiptState(rows);
      if (state.status === "ACTIVE") {
        return receiptMutationResult(rows, state.version, true, 0);
      }
      assertExpectedVersion(input.expectedVersion, state.version);
      const cancelledRows = state.cancelledRows;
      const now = new Date();
      const changed = await tx.payment.updateMany({
        where: {
          receiptNo: input.receiptNo,
          deletedAt: null,
          isCancelled: true
        },
        data: {
          isCancelled: false,
          cancelledAt: null,
          cancelledByUserId: null,
          cancellationReason: null,
          editedBy: input.actor.name
        }
      });
      if (changed.count !== cancelledRows.length) {
        throw new ReceiptIntegrityError("Receipt changed while restoration was processed. Refresh and review it.", 409);
      }
      for (const row of cancelledRows) {
        await tx.paymentAudit.create({
          data: {
            paymentId: row.id,
            action: "RECEIPT_RESTORED",
            oldValueJson: JSON.stringify(receiptAuditSnapshot(row)),
            newValueJson: JSON.stringify({
              ...receiptAuditSnapshot(row),
              isCancelled: false,
              cancelledAt: null
            }),
            changedByUserId: input.actor.id,
            changedByName: input.actor.name,
            reason
          }
        });
      }
      await synchronizeReceiptNote(tx, input.receiptNo, "Active", reason);
      const updated = rows.map((row) => ({
        ...row,
        isCancelled: false,
        cancelledAt: null,
        cancellationReason: null,
        updatedAt: now
      }));
      return receiptMutationResult(updated, receiptVersion(updated), false, changed.count);
    });
  } catch (error) {
    const rows = await loadReceiptRows(client, input.receiptNo);
    if (rows.length && effectiveReceiptState(rows).status === "ACTIVE") {
      return receiptMutationResult(rows, receiptVersion(rows), true, 0);
    }
    throw error;
  }
}

async function loadReceiptRows(client: any, receiptNo: string) {
  return client.payment.findMany({
    where: { receiptNo, deletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  }) as Promise<Array<ReceiptIntegrityPayment & Record<string, unknown>>>;
}

async function synchronizeReceiptNote(
  client: any,
  receiptNo: string,
  status: "Active" | "Cancelled",
  remarks: string
) {
  return client.receiptNote.upsert({
    where: { receiptNo },
    update: { status, remarks },
    create: { receiptNo, status, remarks }
  });
}

function receiptMutationResult(
  rows: ReceiptIntegrityPayment[],
  version: string,
  idempotent: boolean,
  changedComponents: number
) {
  return {
    receiptNo: rows[0].receiptNo,
    status: effectiveReceiptState(rows).status,
    version,
    idempotent,
    componentCount: rows.length,
    changedComponents,
    totalAmount: rows.reduce((sum, row) => sum + Number(row.amountPaid), 0)
  };
}

function receiptAuditSnapshot(row: Record<string, unknown>) {
  return {
    receiptNo: row.receiptNo,
    admissionNo: row.admissionNo,
    studentName: row.studentName,
    className: row.className,
    section: row.section ?? null,
    date: row.date instanceof Date ? row.date.toISOString() : row.date,
    amountPaid: row.amountPaid,
    paymentMode: row.paymentMode,
    receivedAccount: row.receivedAccount,
    transactionRefNo: row.transactionRefNo ?? null,
    feeType: row.feeType,
    termHint: row.termHint,
    isCancelled: Boolean(row.isCancelled),
    cancelledAt: row.cancelledAt instanceof Date ? row.cancelledAt.toISOString() : row.cancelledAt ?? null,
    cancellationReason: row.cancellationReason ?? null,
    remarks: row.remarks ?? null,
    correctionType: row.correctionType ?? null,
    originalReceiptNo: row.originalReceiptNo ?? null,
    replacementReceiptNo: row.replacementReceiptNo ?? null
  };
}

function requiredReason(value: unknown, label: string) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (
    text.length < 3 ||
    text.length > 500 ||
    /[\u0000-\u001f\u007f]/.test(text) ||
    /[<>]/.test(text) ||
    /\b(?:javascript|data)\s*:/i.test(text)
  ) {
    throw new ReceiptIntegrityError(
      `${label} is required, must be 3 to 500 characters, and must not contain markup or executable text`,
      400
    );
  }
  return text;
}

function assertExpectedVersion(expected: unknown, actual: string) {
  const value = String(expected ?? "").trim();
  if (!value) {
    throw new ReceiptIntegrityError("Receipt version is required. Refresh and review the current receipt.", 400);
  }
  if (value !== actual) {
    throw new ReceiptIntegrityError("Receipt changed after it was loaded. Refresh and review the current receipt.", 409);
  }
}

function normalizedReceiptDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp)) {
    throw new ReceiptIntegrityError("Receipt date is invalid", 400);
  }
  return timestamp;
}

async function assertAccountantReceiptDayMutable(
  client: any,
  rows: Array<ReceiptIntegrityPayment & Record<string, unknown>>,
  actor: ReceiptLeadershipActor,
  action: "CANCEL" | "CORRECT",
  reason: string,
  expectedVersion: string
) {
  if (actor.role !== "ACCOUNTANT" || !client.cashBookDay?.findFirst || !rows.length) {
    return;
  }
  const receiptDate = new Date(String(rows[0].date));
  const cashDay = await cashBookDayForDate(client, receiptDate);
  if (!cashDay || ["DRAFT", "REJECTED"].includes(cashDay.status)) return;
  throwLockedDay(rows, receiptDate, cashDay.status, action, reason, expectedVersion);
}

async function assertAccountantTargetDayMutable(
  client: any,
  rows: Array<ReceiptIntegrityPayment & Record<string, unknown>>,
  receiptDate: Date,
  actor: ReceiptLeadershipActor,
  reason: string,
  expectedVersion: string
) {
  if (actor.role !== "ACCOUNTANT" || !client.cashBookDay?.findFirst || !rows.length) {
    return;
  }
  const cashDay = await cashBookDayForDate(client, receiptDate);
  if (!cashDay || ["DRAFT", "REJECTED"].includes(cashDay.status)) return;
  throwLockedDay(rows, receiptDate, cashDay.status, "CORRECT", reason, expectedVersion);
}

async function cashBookDayForDate(client: any, receiptDate: Date) {
  const start = new Date(receiptDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  return client.cashBookDay.findFirst({
    where: { cashDate: { gte: start, lt: end } },
    select: { status: true }
  });
}

function throwLockedDay(
  rows: Array<ReceiptIntegrityPayment & Record<string, unknown>>,
  receiptDate: Date,
  dayStatus: string,
  action: "CANCEL" | "CORRECT",
  reason: string,
  expectedVersion: string
): never {
  throw new ReceiptLockedDayError(
    `Receipt ${rows[0].receiptNo} belongs to a ${dayStatus.toLowerCase()} financial day. The receipt was not changed; Director or Super Admin review is required.`,
    {
      receiptNo: rows[0].receiptNo,
      amount: rows.reduce((sum, row) => sum + Number(row.amountPaid), 0),
      receiptDate,
      dayStatus,
      action,
      reason,
      expectedVersion
    }
  );
}

async function publishLockedDayReview(
  client: any,
  error: ReceiptLockedDayError,
  actor: ReceiptLeadershipActor
) {
  if (actor.role !== "ACCOUNTANT") return;
  const publish = (tx: any) =>
    publishReceiptLeadershipNotification(tx, {
      eventKey: receiptLeadershipEventKey([
        error.detail.action,
        error.detail.receiptNo,
        error.detail.expectedVersion,
        error.detail.dayStatus
      ]),
      action: "LOCKED_DAY_REVIEW",
      receiptNo: error.detail.receiptNo,
      amount: error.detail.amount,
      receiptDate: error.detail.receiptDate,
      actor,
      reason: error.detail.reason,
      versionReference: `${error.detail.expectedVersion} (unchanged)`,
      reconciliationWarning: `Cash Book day status is ${error.detail.dayStatus}; no receipt record was changed`
    });
  if (client.$transaction) {
    await client.$transaction((tx: any) => publish(tx));
  } else {
    await publish(client);
  }
}

function correctionChangesFinancialFacts(
  target: Record<string, any>,
  payload: {
    date: Date;
    admissionNo: string;
    amountPaid: number;
    paymentMode: string;
    receivedAccount: string;
    feeType: string;
    termHint: string;
  }
) {
  return (
    new Date(target.date).getTime() !== payload.date.getTime() ||
    target.admissionNo !== payload.admissionNo ||
    Number(target.amountPaid) !== Number(payload.amountPaid) ||
    target.paymentMode !== payload.paymentMode ||
    target.receivedAccount !== payload.receivedAccount ||
    target.feeType !== payload.feeType ||
    target.termHint !== payload.termHint
  );
}

async function nonFinancialReceiptCorrection(
  tx: any,
  rows: Array<ReceiptIntegrityPayment & Record<string, any>>,
  target: Record<string, any>,
  input: any
) {
  const changed = await tx.payment.updateMany({
    where: {
      id: target.id,
      deletedAt: null,
      isCancelled: false,
      updatedAt: target.updatedAt
    },
    data: {
      transactionRefNo: input.payload.transactionRefNo,
      remarks: input.payload.remarks,
      editedBy: input.actor.name
    }
  });
  if (changed.count !== 1) {
    throw new ReceiptIntegrityError(
      "Receipt changed while the correction was processed. Refresh and review it.",
      409
    );
  }
  const now = new Date();
  const updatedTarget = {
    ...target,
    transactionRefNo: input.payload.transactionRefNo,
    remarks: input.payload.remarks,
    editedBy: input.actor.name,
    updatedAt: now
  };
  const resultRows = rows.map((row) =>
    row.id === target.id ? updatedTarget : row
  );
  const result = {
    correctionType: "NON_FINANCIAL_VERSION",
    originalReceiptNo: target.receiptNo,
    replacementReceiptNo: null,
    version: receiptVersion(resultRows as ReceiptIntegrityPayment[]),
    componentCount: rows.length,
    originalTotal: rows.reduce((sum, row) => sum + Number(row.amountPaid), 0),
    replacementTotal: rows.reduce((sum, row) => sum + Number(row.amountPaid), 0),
    idempotent: false
  };
  const audit = await tx.paymentAudit.create({
    data: {
      paymentId: target.id,
      action: "RECEIPT_CORRECTED",
      oldValueJson: JSON.stringify(receiptAuditSnapshot(target)),
      newValueJson: JSON.stringify({
        ...receiptAuditSnapshot(updatedTarget),
        correctionType: result.correctionType,
        originalReceiptNo: target.receiptNo,
        replacementReceiptNo: null,
        fin2bIdempotencyKey: input.idempotencyKey,
        fin2bResult: result
      }),
      changedByUserId: input.actor.id,
      changedByName: input.actor.name,
      reason: input.reason
    }
  });
  await synchronizeReceiptNote(
    tx,
    target.receiptNo,
    "Active",
    `Audited non-financial correction recorded: ${input.reason}`
  );
  const notification =
    input.actor.role === "ACCOUNTANT"
      ? await publishReceiptLeadershipNotification(tx, {
          eventKey: audit.id,
          action: "CORRECTED",
          receiptNo: target.receiptNo,
          amount: result.replacementTotal,
          receiptDate: target.date,
          actor: input.actor,
          reason: input.reason,
          versionReference: `${receiptVersion(rows)} -> ${result.version}`
        })
      : null;
  return { ...result, leadershipNotification: notification };
}

async function financialReceiptCorrection(
  tx: any,
  rows: Array<ReceiptIntegrityPayment & Record<string, any>>,
  target: Record<string, any>,
  input: any
) {
  const replacementReceiptNo = await nextReplacementReceiptNo(
    tx,
    target.receiptNo
  );
  const cancellationReason = `Superseded by ${replacementReceiptNo}: ${input.reason}`;
  const now = new Date();
  const changed = await tx.payment.updateMany({
    where: {
      receiptNo: target.receiptNo,
      deletedAt: null,
      isCancelled: false
    },
    data: {
      isCancelled: true,
      cancelledAt: now,
      cancelledByUserId: input.actor.id,
      cancellationReason,
      editedBy: input.actor.name
    }
  });
  if (changed.count !== rows.length) {
    throw new ReceiptIntegrityError(
      "Receipt changed while financial correction was processed. Refresh and review it.",
      409
    );
  }

  const replacements: Array<Record<string, any>> = [];
  for (const row of rows) {
    const targetRow = row.id === target.id;
    const student = input.correctedStudent;
    const replacement = await tx.payment.create({
      data: {
        date: input.payload.date,
        receiptNo: replacementReceiptNo,
        admissionNo: student?.admissionNo ?? row.admissionNo,
        studentId: student?.id ?? row.studentId,
        studentName: student?.studentName ?? row.studentName,
        className: student?.className ?? row.className,
        section: student?.section ?? row.section,
        amountPaid: targetRow ? input.payload.amountPaid : row.amountPaid,
        paymentMode: targetRow ? input.payload.paymentMode : row.paymentMode,
        receivedAccount: targetRow
          ? input.payload.receivedAccount
          : row.receivedAccount,
        transactionRefNo: targetRow
          ? input.payload.transactionRefNo
          : row.transactionRefNo,
        feeType: input.payload.feeType,
        termHint: input.payload.termHint,
        remarks: targetRow ? input.payload.remarks : row.remarks,
        enteredBy: input.actor.name,
        editedBy: null
      }
    });
    replacements.push(replacement);
  }
  const replacementVersion = receiptVersion(replacements as ReceiptIntegrityPayment[]);
  const result = {
    correctionType: "FINANCIAL_REISSUE",
    originalReceiptNo: target.receiptNo,
    replacementReceiptNo,
    version: replacementVersion,
    componentCount: replacements.length,
    originalTotal: rows.reduce((sum, row) => sum + Number(row.amountPaid), 0),
    replacementTotal: replacements.reduce(
      (sum, row) => sum + Number(row.amountPaid),
      0
    ),
    idempotent: false
  };
  let primaryAudit: { id: string } | null = null;
  for (const row of rows) {
    const cancelled = {
      ...row,
      isCancelled: true,
      cancelledAt: now,
      cancellationReason,
      originalReceiptNo: target.receiptNo,
      replacementReceiptNo,
      correctionType: result.correctionType
    };
    const audit = await tx.paymentAudit.create({
      data: {
        paymentId: row.id,
        action: "RECEIPT_SUPERSEDED",
        oldValueJson: JSON.stringify(receiptAuditSnapshot(row)),
        newValueJson: JSON.stringify({
          ...receiptAuditSnapshot(cancelled),
          fin2bIdempotencyKey: input.idempotencyKey,
          fin2bResult: result
        }),
        changedByUserId: input.actor.id,
        changedByName: input.actor.name,
        reason: input.reason
      }
    });
    primaryAudit ??= audit;
  }
  for (let index = 0; index < replacements.length; index += 1) {
    await tx.paymentAudit.create({
      data: {
        paymentId: replacements[index].id,
        action: "RECEIPT_REISSUED",
        oldValueJson: JSON.stringify({
          ...receiptAuditSnapshot(rows[index]),
          originalReceiptNo: target.receiptNo,
          replacementReceiptNo
        }),
        newValueJson: JSON.stringify({
          ...receiptAuditSnapshot(replacements[index]),
          correctionType: result.correctionType,
          originalReceiptNo: target.receiptNo,
          replacementReceiptNo
        }),
        changedByUserId: input.actor.id,
        changedByName: input.actor.name,
        reason: input.reason
      }
    });
  }
  await synchronizeReceiptNote(
    tx,
    target.receiptNo,
    "Cancelled",
    cancellationReason
  );
  await synchronizeReceiptNote(
    tx,
    replacementReceiptNo,
    "Active",
    `Replacement for ${target.receiptNo}: ${input.reason}`
  );
  const notification =
    input.actor.role === "ACCOUNTANT" && primaryAudit
      ? await publishReceiptLeadershipNotification(tx, {
          eventKey: primaryAudit.id,
          action: "CORRECTED",
          receiptNo: `${target.receiptNo} -> ${replacementReceiptNo}`,
          amount: result.replacementTotal,
          receiptDate: input.payload.date,
          actor: input.actor,
          reason: input.reason,
          versionReference: `${input.expectedVersion} -> ${result.version}`,
          reconciliationWarning:
            result.originalTotal === result.replacementTotal
              ? null
              : "The corrected amount changed dues and collection totals"
        })
      : null;
  return { ...result, leadershipNotification: notification };
}

async function nextReplacementReceiptNo(client: any, originalReceiptNo: string) {
  const base = String(originalReceiptNo).trim();
  if (!base || base.length > 70) {
    throw new ReceiptIntegrityError(
      "Receipt number is too long for governed replacement numbering.",
      400
    );
  }
  for (let revision = 1; revision <= 99; revision += 1) {
    const candidate = `${base}-R${revision}`;
    const [payment, note] = await Promise.all([
      client.payment.findFirst({
        where: { receiptNo: candidate, deletedAt: null },
        select: { id: true }
      }),
      client.receiptNote.findUnique({
        where: { receiptNo: candidate },
        select: { receiptNo: true }
      })
    ]);
    if (!payment && !note) return candidate;
  }
  throw new ReceiptIntegrityError(
    "No safe replacement receipt number is available. Leadership review is required.",
    409
  );
}

async function findCorrectionByIdempotency(
  client: any,
  paymentId: string,
  idempotencyKey: string
) {
  if (!client.paymentAudit?.findMany) return null;
  const audits = await client.paymentAudit.findMany({
    where: {
      paymentId,
      action: { in: ["RECEIPT_CORRECTED", "RECEIPT_SUPERSEDED"] }
    },
    select: { newValueJson: true },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  for (const audit of audits) {
    try {
      const value = JSON.parse(audit.newValueJson ?? "{}");
      if (
        value.fin2bIdempotencyKey === idempotencyKey &&
        value.fin2bResult &&
        typeof value.fin2bResult === "object"
      ) {
        return value.fin2bResult;
      }
    } catch {}
  }
  return null;
}

function requiredIdempotencyKey(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(text)) {
    throw new ReceiptIntegrityError(
      "A valid correction idempotency key is required.",
      400
    );
  }
  return text;
}

async function loadCorrectionStudent(client: any, admissionNo: string) {
  if (!client.student?.findUnique) {
    throw new ReceiptIntegrityError(
      "Student correction requires a validated Student Master record.",
      409
    );
  }
  const student = await client.student.findUnique({
    where: { admissionNo },
    select: {
      id: true,
      admissionNo: true,
      studentName: true,
      className: true,
      section: true,
      academicYear: true,
      status: true,
      deletedAt: true
    }
  });
  if (!student || student.deletedAt) {
    throw new ReceiptIntegrityError(
      "Corrected admission number was not found in Student Master.",
      404
    );
  }
  return student;
}

function assertExactWorkflowAuthorization(
  actual: unknown,
  expected: "CANCEL_FINAL_RECEIPT" | "CORRECT_FINAL_RECEIPT"
) {
  if (actual !== expected) {
    throw new ReceiptIntegrityError(
      `Exact ${expected} authorization is required for this receipt workflow.`,
      403
    );
  }
}
