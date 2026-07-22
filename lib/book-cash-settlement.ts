import { Prisma, type PrismaClient } from "@prisma/client";
import { calculateCashSources } from "@/lib/cash-book";
import { csvCell, localDate, moneyDecimal } from "@/lib/expenses";

function optionalText(value: unknown, label: string, max = 1000) { const result = String(value ?? "").trim(); if (result.length > max) throw new Error(`${label} must be at most ${max} characters`); return result || null; }
function requiredText(value: unknown, label: string, max = 1000) { const result = optionalText(value, label, max); if (!result) throw new Error(`${label} is required`); return result; }
function dateRange(value: Date) { return { gte: value, lt: new Date(value.getTime() + 86_400_000) }; }

export async function expectedBookCashForDate(client: Pick<PrismaClient | Prisma.TransactionClient, "bookSaleReceipt">, settlementDate: Date) {
  const rows = await client.bookSaleReceipt.findMany({ where: { receiptDate: dateRange(settlementDate), status: "ACTIVE", paymentMethod: "CASH" }, select: { netAmount: true } });
  return { amount: rows.reduce((sum, row) => sum.add(row.netAmount), new Prisma.Decimal(0)), receiptCount: rows.length };
}

export function reconcileBookCash(expected: Prisma.Decimal, director: Prisma.Decimal, counter: Prisma.Decimal, retained: Prisma.Decimal) {
  return expected.sub(director).sub(counter).sub(retained);
}

export function validateBookCashSettlementInput(input: unknown, expected: Prisma.Decimal) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Settlement details are required");
  const row = input as Record<string, unknown>;
  const handedToDirectorAmount = moneyDecimal(row.handedToDirectorAmount ?? 0, "Handed to Director amount");
  const handedToCashCounterAmount = moneyDecimal(row.handedToCashCounterAmount ?? 0, "Handed to cash counter amount");
  const retainedByBooksInchargeAmount = moneyDecimal(row.retainedByBooksInchargeAmount ?? 0, "Retained by books in-charge amount");
  const varianceAmount = reconcileBookCash(expected, handedToDirectorAmount, handedToCashCounterAmount, retainedByBooksInchargeAmount);
  const varianceReason = optionalText(row.varianceReason, "Variance reason");
  if (!varianceAmount.isZero() && !varianceReason) throw new Error("A variance reason is required when settlement totals do not match expected book cash");
  return { academicYear: requiredText(row.academicYear, "Academic year", 20), handedToDirectorAmount, handedToCashCounterAmount, retainedByBooksInchargeAmount, varianceAmount, varianceReason, booksInchargeName: optionalText(row.booksInchargeName, "Books in-charge name", 120), receiverName: optionalText(row.receiverName, "Receiver name", 120), notes: optionalText(row.notes, "Notes") };
}

export async function saveBookCashSettlement(client: PrismaClient, dateValue: unknown, input: unknown, actorId: string) {
  const settlementDate = localDate(dateValue, "Settlement date");
  return client.$transaction(async (tx) => {
    const expected = await expectedBookCashForDate(tx, settlementDate);
    const data = validateBookCashSettlementInput(input, expected.amount);
    const current = await tx.bookCashSettlement.findUnique({ where: { settlementDate } });
    if (current && current.status !== "DRAFT") throw new Error("Only a draft settlement can be edited");
    if (current) {
      const changed = await tx.bookCashSettlement.updateMany({ where: { id: current.id, status: "DRAFT", updatedAt: current.updatedAt }, data: { ...data, expectedBookCash: expected.amount } });
      if (changed.count !== 1) throw new Error("Settlement changed while it was being saved. Refresh and review it.");
      return tx.bookCashSettlement.findUniqueOrThrow({ where: { id: current.id }, include: bookSettlementInclude });
    }
    return tx.bookCashSettlement.create({ data: { ...data, settlementDate, expectedBookCash: expected.amount, createdByUserId: actorId }, include: bookSettlementInclude });
  });
}

export async function transitionBookCashSettlement(client: PrismaClient, id: string, action: "submit" | "approve" | "cancel", actorId: string, reason?: unknown) {
  return client.$transaction(async (tx) => {
    const current = await tx.bookCashSettlement.findUnique({ where: { id }, include: { cashBookMovement: { include: { cashBookDay: true } } } });
    if (!current) throw new Error("Book-cash settlement not found");
    const now = new Date();
    if (action === "submit") {
      if (current.status !== "DRAFT") throw new Error(`Cannot submit a settlement in ${current.status} status`);
      const expected = await expectedBookCashForDate(tx, current.settlementDate);
      const variance = reconcileBookCash(expected.amount, current.handedToDirectorAmount, current.handedToCashCounterAmount, current.retainedByBooksInchargeAmount);
      if (!variance.isZero() && !current.varianceReason?.trim()) throw new Error("A variance reason is required before submission");
      const changed = await tx.bookCashSettlement.updateMany({ where: { id, status: "DRAFT", updatedAt: current.updatedAt }, data: { status: "SUBMITTED", expectedBookCash: expected.amount, varianceAmount: variance, submittedByUserId: actorId, submittedAt: now } });
      if (changed.count !== 1) throw new Error("Settlement changed while it was being submitted. Refresh and review it.");
    } else if (action === "approve") {
      if (current.status !== "SUBMITTED") throw new Error(`Cannot approve a settlement in ${current.status} status`);
      if (current.cashBookMovementId) throw new Error("This settlement already has a Director-handover movement");
      const day = await tx.cashBookDay.findUnique({ where: { cashDate: current.settlementDate } });
      if (!day) throw new Error("Create the cash-book day for this date before approving the book-cash settlement");
      if (day.status !== "DRAFT") throw new Error("The linked cash-book day must remain in draft while the book settlement is approved");
      let cashBookMovementId: string | null = null;
      if (current.handedToDirectorAmount.gt(0)) {
        const movement = await tx.cashBookMovement.create({ data: { cashBookDayId: day.id, movementType: "DIRECTOR_HANDOVER", amount: current.handedToDirectorAmount, movementDate: current.settlementDate, recipientName: current.receiverName ?? "Director Sir", reason: "Daily book-sale cash handed to Director Sir", referenceNumber: `BOOK-SETTLEMENT-${current.settlementDate.toISOString().slice(0, 10)}`, recordedByUserId: actorId } });
        cashBookMovementId = movement.id;
      }
      const changed = await tx.bookCashSettlement.updateMany({ where: { id, status: "SUBMITTED", updatedAt: current.updatedAt, cashBookMovementId: null }, data: { status: "APPROVED", cashBookMovementId, approvedByUserId: actorId, approvedAt: now } });
      if (changed.count !== 1) throw new Error("Settlement changed while it was being approved. Refresh and review it.");
      const sources = await calculateCashSources(tx, day.cashDate, day.openingBalance, day.id);
      await tx.cashBookDay.update({ where: { id: day.id }, data: { calculatedClosingBalance: sources.expectedClosing, varianceAmount: day.countedClosingBalance == null ? null : day.countedClosingBalance.sub(sources.expectedClosing) } });
    } else {
      if (current.status === "CANCELLED") throw new Error("Settlement is already cancelled");
      const cancellationReason = requiredText(reason, "Cancellation reason");
      if (current.cashBookMovement?.status === "ACTIVE") {
        if (current.cashBookMovement.cashBookDay.status === "LOCKED") throw new Error("A settlement linked to a locked cash-book day cannot be cancelled; use a later documented adjustment");
        await tx.cashBookMovement.updateMany({ where: { id: current.cashBookMovement.id, status: "ACTIVE" }, data: { status: "CANCELLED", cancelledByUserId: actorId, cancelledAt: now, cancellationReason: `Book settlement cancelled: ${cancellationReason}` } });
      }
      const changed = await tx.bookCashSettlement.updateMany({ where: { id, status: current.status, updatedAt: current.updatedAt }, data: { status: "CANCELLED", cancelledByUserId: actorId, cancelledAt: now, cancellationReason } });
      if (changed.count !== 1) throw new Error("Settlement changed while it was being cancelled. Refresh and review it.");
      if (current.cashBookMovement) {
        const day = current.cashBookMovement.cashBookDay;
        const sources = await calculateCashSources(tx, day.cashDate, day.openingBalance, day.id);
        if (day.status === "DRAFT") await tx.cashBookDay.update({ where: { id: day.id }, data: { calculatedClosingBalance: sources.expectedClosing, varianceAmount: day.countedClosingBalance == null ? null : day.countedClosingBalance.sub(sources.expectedClosing) } });
      }
    }
    return tx.bookCashSettlement.findUniqueOrThrow({ where: { id }, include: bookSettlementInclude });
  });
}

export const bookSettlementInclude = { cashBookMovement: { select: { id: true, movementType: true, amount: true, status: true } }, createdBy: { select: { name: true } }, submittedBy: { select: { name: true } }, approvedBy: { select: { name: true } }, cancelledBy: { select: { name: true } } };

export function serializeBookSettlement(row: any, expectedLive?: Prisma.Decimal, sensitive = true) {
  const result: Record<string, unknown> = { id: row.id, settlementDate: row.settlementDate.toISOString().slice(0, 10), academicYear: row.academicYear, status: row.status, expectedBookCash: row.expectedBookCash.toString(), expectedBookCashLive: expectedLive?.toString() ?? row.expectedBookCash.toString(), sourceDrift: expectedLive ? !expectedLive.equals(row.expectedBookCash) : false, handedToDirectorAmount: row.handedToDirectorAmount.toString(), handedToCashCounterAmount: row.handedToCashCounterAmount.toString(), retainedByBooksInchargeAmount: row.retainedByBooksInchargeAmount.toString(), varianceAmount: row.varianceAmount.toString(), cashBookMovement: row.cashBookMovement ? { movementType: row.cashBookMovement.movementType, amount: row.cashBookMovement.amount.toString(), status: row.cashBookMovement.status } : null, submittedAt: row.submittedAt, approvedAt: row.approvedAt, cancelledAt: row.cancelledAt };
  if (sensitive) Object.assign(result, { varianceReason: row.varianceReason, booksInchargeName: row.booksInchargeName, receiverName: row.receiverName, notes: row.notes, cancellationReason: row.cancellationReason, createdBy: row.createdBy?.name ?? null, submittedBy: row.submittedBy?.name ?? null, approvedBy: row.approvedBy?.name ?? null, cancelledBy: row.cancelledBy?.name ?? null });
  return result;
}

export function bookSettlementCsv(rows: any[]) { const headers = ["Date", "Academic Year", "Status", "Expected Book Cash", "Handed to Director Sir", "Handed to Cash Counter", "Retained by Books In-charge", "Variance", "Source Drift"]; return [headers, ...rows.map((row) => [row.settlementDate.toISOString().slice(0, 10), row.academicYear, row.status, row.expectedBookCash.toFixed(2), row.handedToDirectorAmount.toFixed(2), row.handedToCashCounterAmount.toFixed(2), row.retainedByBooksInchargeAmount.toFixed(2), row.varianceAmount.toFixed(2), row.sourceDrift ? "Yes" : "No"])].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n"; }
