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

export function isReceiptCancellationAuthority(role: string) {
  return role === "SUPER_ADMIN" || role === "DIRECTOR";
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
    receiptNo: string;
    reason: unknown;
    actor: { id: string; name: string };
    expectedVersion?: unknown;
  }
) {
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
      for (const row of activeRows) {
        await tx.paymentAudit.create({
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
      }
      await synchronizeReceiptNote(tx, input.receiptNo, "Cancelled", reason);
      const updated = rows.map((row) => ({
        ...row,
        isCancelled: true,
        cancelledAt: now,
        cancellationReason: reason,
        updatedAt: now
      }));
      return receiptMutationResult(updated, receiptVersion(updated), false, changed.count);
    });
  } catch (error) {
    const rows = await loadReceiptRows(client, input.receiptNo);
    if (rows.length && effectiveReceiptState(rows).status === "CANCELLED") {
      return receiptMutationResult(rows, receiptVersion(rows), true, 0);
    }
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
    cancelledAt: row.cancelledAt instanceof Date ? row.cancelledAt.toISOString() : row.cancelledAt ?? null
  };
}

function requiredReason(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (text.length < 3 || text.length > 500) {
    throw new ReceiptIntegrityError(`${label} is required and must be 3 to 500 characters`, 400);
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
