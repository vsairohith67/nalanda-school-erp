import { Prisma, type PrismaClient } from "@prisma/client";
import { csvCell, localDate, moneyDecimal } from "@/lib/expenses";
import { effectiveActiveSelectedReceiptPayments } from "@/lib/receipt-integrity";

export const CASH_BOOK_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "LOCKED", "REJECTED", "CANCELLED"] as const;
export const CASH_MOVEMENT_TYPES = ["MANUAL_INFLOW", "MANUAL_OUTFLOW", "BANK_DEPOSIT", "DIRECTOR_HANDOVER", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"] as const;
const INFLOWS = new Set(["MANUAL_INFLOW", "ADJUSTMENT_IN"]); const MANUAL_OUTFLOWS = new Set(["MANUAL_OUTFLOW", "ADJUSTMENT_OUT"]);

function requiredText(value: unknown, label: string, max = 1000) { const result = String(value ?? "").trim(); if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`); return result; }
function optionalText(value: unknown, label: string, max = 1000) { const result = String(value ?? "").trim(); if (result.length > max) throw new Error(`${label} must be at most ${max} characters`); return result || null; }
function dayRange(value: Date) { return { gte: value, lt: new Date(value.getTime() + 86_400_000) }; }
function sumDecimals(values: Array<Prisma.Decimal | number>) { return values.reduce<Prisma.Decimal>((sum, value) => sum.add(String(value)), new Prisma.Decimal(0)); }

export type CashSources = ReturnType<typeof emptySources>;
function emptySources() { const zero = new Prisma.Decimal(0); return { feeCash: zero, miscIncomeCash: zero, bookSalesCash: zero, cashExpense: zero, manualInflow: zero, manualOutflow: zero, bankDeposit: zero, directorHandover: zero, expectedClosing: zero, counts: { feePayments: 0, miscReceipts: 0, bookSaleReceipts: 0, expensePayments: 0, movements: 0 } }; }

export async function calculateCashSources(client: PrismaClient | Prisma.TransactionClient, cashDate: Date, openingBalance: Prisma.Decimal, dayId?: string) {
  const range = dayRange(cashDate);
  const [fees, misc, books, expensePayments, movements] = await Promise.all([
    client.payment.findMany({ where: { date: range, deletedAt: null }, select: { id: true, receiptNo: true, amountPaid: true, paymentMode: true, familyInstrumentId: true, isCancelled: true, deletedAt: true, updatedAt: true } }),
    client.miscIncomeReceipt.findMany({ where: { receiptDate: range, status: "ACTIVE", paymentMethod: "CASH" }, select: { netAmount: true } }),
    (client as any).bookSaleReceipt?.findMany ? (client as any).bookSaleReceipt.findMany({ where: { receiptDate: range, status: "ACTIVE", paymentMethod: "CASH" }, select: { netAmount: true } }) : Promise.resolve([]),
    client.expensePayment.findMany({ where: { paymentDate: range, expenseRecord: { approvalStatus: "APPROVED" } }, select: { amount: true, paymentMethod: true } }),
    dayId ? client.cashBookMovement.findMany({ where: { cashBookDayId: dayId, status: "ACTIVE" }, select: { amount: true, movementType: true } }) : Promise.resolve([])
  ]);
  const activeFees = await effectiveActiveSelectedReceiptPayments(client, fees);
  const feeCash = sumDecimals(activeFees.filter((row) => row.paymentMode.toUpperCase() === "CASH").map((row) => row.amountPaid));
  const miscIncomeCash = sumDecimals(misc.map((row) => row.netAmount));
  const bookSalesCash = sumDecimals((books as Array<{ netAmount: Prisma.Decimal }>).map((row) => row.netAmount));
  const cashExpense = sumDecimals(expensePayments.filter((row) => row.paymentMethod.toUpperCase() === "CASH").map((row) => row.amount));
  const movementSum = (types: Set<string>) => sumDecimals(movements.filter((row) => types.has(row.movementType)).map((row) => row.amount));
  const manualInflow = movementSum(INFLOWS), manualOutflow = movementSum(MANUAL_OUTFLOWS), bankDeposit = movementSum(new Set(["BANK_DEPOSIT"])), directorHandover = movementSum(new Set(["DIRECTOR_HANDOVER"]));
  const expectedClosing = openingBalance.add(feeCash).add(miscIncomeCash).add(bookSalesCash).add(manualInflow).sub(cashExpense).sub(manualOutflow).sub(bankDeposit).sub(directorHandover);
  const activeCash = activeFees.filter((row) => row.paymentMode.toUpperCase() === "CASH");
  const feePaymentSources = new Set(activeCash.map((row: any) => row.familyInstrumentId ? `family:${row.familyInstrumentId}` : `legacy:${row.id}`));
  return { feeCash, miscIncomeCash, bookSalesCash, cashExpense, manualInflow, manualOutflow, bankDeposit, directorHandover, expectedClosing, counts: { feePayments: feePaymentSources.size, miscReceipts: misc.length, bookSaleReceipts: (books as unknown[]).length, expensePayments: expensePayments.filter((row) => row.paymentMethod.toUpperCase() === "CASH").length, movements: movements.length } };
}

export function cashSourceSnapshot(sources: Awaited<ReturnType<typeof calculateCashSources>>) { return JSON.stringify({ feeCash: sources.feeCash.toFixed(2), miscIncomeCash: sources.miscIncomeCash.toFixed(2), bookSalesCash: sources.bookSalesCash.toFixed(2), cashExpense: sources.cashExpense.toFixed(2), manualInflow: sources.manualInflow.toFixed(2), manualOutflow: sources.manualOutflow.toFixed(2), bankDeposit: sources.bankDeposit.toFixed(2), directorHandover: sources.directorHandover.toFixed(2), expectedClosing: sources.expectedClosing.toFixed(2), counts: sources.counts }); }
export function hasSourceDrift(snapshot: string | null, sources: Awaited<ReturnType<typeof calculateCashSources>>) { if (!snapshot) return false; try { return snapshot !== cashSourceSnapshot(sources); } catch { return true; } }
export function effectiveCashSources(row: any, live: Awaited<ReturnType<typeof calculateCashSources>>) { if (row.status === "DRAFT" || row.status === "REJECTED") return live; return { feeCash: row.feeCashSnapshot, miscIncomeCash: row.miscIncomeCashSnapshot, bookSalesCash: row.bookSalesCashSnapshot, cashExpense: row.cashExpenseSnapshot, manualInflow: row.manualInflowSnapshot, manualOutflow: row.manualOutflowSnapshot, bankDeposit: row.bankDepositSnapshot, directorHandover: row.directorHandoverSnapshot, expectedClosing: row.calculatedClosingBalance, counts: live.counts }; }

export async function suggestedOpeningBalance(client: PrismaClient | Prisma.TransactionClient, cashDate: Date) {
  const previous = await client.cashBookDay.findFirst({ where: { cashDate: { lt: cashDate }, status: "LOCKED", countedClosingBalance: { not: null } }, select: { countedClosingBalance: true, cashDate: true }, orderBy: { cashDate: "desc" } });
  return previous ? { amount: previous.countedClosingBalance!, fromDate: previous.cashDate } : null;
}

export async function assertOpeningBalanceProvenance(client: PrismaClient | Prisma.TransactionClient, cashDate: Date, openingBalance: Prisma.Decimal, notes: string | null) {
  const previous = await suggestedOpeningBalance(client, cashDate);
  if (!previous && !notes) throw new Error("A note is required when no previous locked cash day provides the opening balance");
  if (previous && !openingBalance.equals(previous.amount) && !notes) throw new Error("Explain why the opening balance differs from the previous locked day");
  return previous;
}

export async function createCashBookDay(client: PrismaClient, input: unknown, actorId: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Cash-book details are required"); const row = input as Record<string, unknown>;
  const cashDate = localDate(row.cashDate, "Cash date"), openingBalance = moneyDecimal(row.openingBalance, "Opening balance"), academicYear = requiredText(row.academicYear, "Academic year", 20), notes = optionalText(row.notes, "Notes");
  return client.$transaction(async (tx) => { const existing = await tx.cashBookDay.findUnique({ where: { cashDate } }); if (existing) throw new Error("A cash book already exists for this date"); await assertOpeningBalanceProvenance(tx, cashDate, openingBalance, notes); const sources = await calculateCashSources(tx, cashDate, openingBalance); return tx.cashBookDay.create({ data: { cashDate, academicYear, openingBalance, calculatedClosingBalance: sources.expectedClosing, notes, createdByUserId: actorId } }); });
}

export async function updateCashBookDraft(client: PrismaClient, id: string, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Cash-book details are required"); const row = input as Record<string, unknown>;
  const openingBalance = moneyDecimal(row.openingBalance, "Opening balance"), countedClosingBalance = row.countedClosingBalance === "" || row.countedClosingBalance == null ? null : moneyDecimal(row.countedClosingBalance, "Counted closing balance"), notes = optionalText(row.notes, "Notes");
  return client.$transaction(async (tx) => { const current = await tx.cashBookDay.findUnique({ where: { id } }); if (!current || current.status !== "DRAFT") throw new Error("Only a draft cash day can be edited"); await assertOpeningBalanceProvenance(tx, current.cashDate, openingBalance, notes); const sources = await calculateCashSources(tx, current.cashDate, openingBalance, id); const varianceAmount = countedClosingBalance == null ? null : countedClosingBalance.sub(sources.expectedClosing); const changed = await tx.cashBookDay.updateMany({ where: { id, status: "DRAFT", updatedAt: current.updatedAt }, data: { openingBalance, countedClosingBalance, varianceAmount, calculatedClosingBalance: sources.expectedClosing, notes } }); if (changed.count !== 1) throw new Error("Cash day changed while it was being saved. Refresh and review it."); return tx.cashBookDay.findUniqueOrThrow({ where: { id }, include: cashBookInclude }); });
}

export function validateMovementInput(input: unknown, cashDate?: Date) { if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Movement details are required"); const row = input as Record<string, unknown>; const movementType = String(row.movementType ?? "").toUpperCase(); if (!CASH_MOVEMENT_TYPES.includes(movementType as any)) throw new Error("Movement type is not supported"); const movementDate = localDate(row.movementDate, "Movement date"); if (cashDate && movementDate.getTime() !== cashDate.getTime()) throw new Error("Movement date must match the cash-book date"); return { movementType, amount: moneyDecimal(row.amount, "Movement amount", false), movementDate, referenceNumber: optionalText(row.referenceNumber, "Reference number", 120), bankName: optionalText(row.bankName, "Bank name", 120), recipientName: optionalText(row.recipientName, "Recipient name", 120), reason: requiredText(row.reason, "Movement reason"), notes: optionalText(row.notes, "Movement notes") }; }

export async function addCashMovement(client: PrismaClient, dayId: string, input: unknown, actorId: string) { return client.$transaction(async (tx) => { const day = await tx.cashBookDay.findUnique({ where: { id: dayId } }); if (!day || day.status !== "DRAFT") throw new Error("Movements can only be added to a draft cash day"); const data = validateMovementInput(input, day.cashDate); await tx.cashBookMovement.create({ data: { ...data, cashBookDayId: dayId, recordedByUserId: actorId } }); const sources = await calculateCashSources(tx, day.cashDate, day.openingBalance, dayId); await tx.cashBookDay.update({ where: { id: dayId }, data: { calculatedClosingBalance: sources.expectedClosing, varianceAmount: day.countedClosingBalance == null ? null : day.countedClosingBalance.sub(sources.expectedClosing) } }); return tx.cashBookDay.findUniqueOrThrow({ where: { id: dayId }, include: cashBookInclude }); }); }

export async function cancelCashMovement(client: PrismaClient, dayId: string, movementId: string, reason: unknown, actorId: string) { const cancellationReason = requiredText(reason, "Cancellation reason"); return client.$transaction(async (tx) => { const day = await tx.cashBookDay.findUnique({ where: { id: dayId } }); if (!day || day.status !== "DRAFT") throw new Error("Movements can only be cancelled on a draft cash day"); const changed = await tx.cashBookMovement.updateMany({ where: { id: movementId, cashBookDayId: dayId, status: "ACTIVE" }, data: { status: "CANCELLED", cancellationReason, cancelledByUserId: actorId, cancelledAt: new Date() } }); if (changed.count !== 1) throw new Error("Movement was not active or changed while cancellation was processed"); const sources = await calculateCashSources(tx, day.cashDate, day.openingBalance, dayId); await tx.cashBookDay.update({ where: { id: dayId }, data: { calculatedClosingBalance: sources.expectedClosing, varianceAmount: day.countedClosingBalance == null ? null : day.countedClosingBalance.sub(sources.expectedClosing) } }); return tx.cashBookDay.findUniqueOrThrow({ where: { id: dayId }, include: cashBookInclude }); }); }

type CashAction = "submit" | "approve" | "reject" | "lock" | "cancel" | "reopen";
export async function transitionCashBookDay(client: PrismaClient, id: string, action: CashAction, actorId: string, reason?: unknown) {
  return client.$transaction(async (tx) => { const current = await tx.cashBookDay.findUnique({ where: { id } }); if (!current) throw new Error("Cash day not found"); const now = new Date(); let from: string, to: string, data: Record<string, unknown> = {};
    if (action === "submit") { from = "DRAFT"; to = "SUBMITTED"; if (current.countedClosingBalance == null) throw new Error("Counted closing cash is required before submission"); const sources = await calculateCashSources(tx, current.cashDate, current.openingBalance, id); const variance = current.countedClosingBalance.sub(sources.expectedClosing); if (!variance.isZero() && !current.notes?.trim()) throw new Error("A variance explanation is required before submission"); data = { feeCashSnapshot: sources.feeCash, miscIncomeCashSnapshot: sources.miscIncomeCash, bookSalesCashSnapshot: sources.bookSalesCash, cashExpenseSnapshot: sources.cashExpense, manualInflowSnapshot: sources.manualInflow, manualOutflowSnapshot: sources.manualOutflow, bankDepositSnapshot: sources.bankDeposit, directorHandoverSnapshot: sources.directorHandover, calculatedClosingBalance: sources.expectedClosing, varianceAmount: variance, sourceSummarySnapshot: cashSourceSnapshot(sources), submittedByUserId: actorId, submittedAt: now, rejectionReason: null };
    } else if (action === "approve") { from = "SUBMITTED"; to = "APPROVED"; data = { approvedByUserId: actorId, approvedAt: now };
    } else if (action === "reject") { from = "SUBMITTED"; to = "REJECTED"; data = { rejectionReason: requiredText(reason, "Rejection reason") };
    } else if (action === "lock") { from = "APPROVED"; to = "LOCKED"; data = { lockedByUserId: actorId, lockedAt: now };
    } else if (action === "reopen") { from = "REJECTED"; to = "DRAFT"; data = { rejectionReason: current.rejectionReason };
    } else { if (current.status === "LOCKED" || current.status === "CANCELLED") throw new Error("Locked or cancelled cash days cannot be cancelled"); from = current.status; to = "CANCELLED"; data = { cancellationReason: requiredText(reason, "Cancellation reason"), cancelledByUserId: actorId, cancelledAt: now }; }
    if (current.status !== from) throw new Error(`Cannot ${action} a cash day in ${current.status} status`); const changed = await tx.cashBookDay.updateMany({ where: { id, status: from, updatedAt: current.updatedAt }, data: { ...data, status: to } }); if (changed.count !== 1) throw new Error("Cash day changed while this action was processed. Refresh and review it."); return tx.cashBookDay.findUniqueOrThrow({ where: { id }, include: cashBookInclude });
  });
}

export const cashBookInclude = { movements: { include: { recordedBy: { select: { name: true } }, cancelledBy: { select: { name: true } } }, orderBy: { createdAt: "asc" as const } }, createdBy: { select: { name: true } }, submittedBy: { select: { name: true } }, approvedBy: { select: { name: true } }, lockedBy: { select: { name: true } }, cancelledBy: { select: { name: true } } };

export async function cashBookView(client: PrismaClient, row: any, sensitive = true) { const live = await calculateCashSources(client, row.cashDate, row.openingBalance, row.id); const snapshotted = row.status !== "DRAFT" && row.status !== "REJECTED"; const source = effectiveCashSources(row, live); const result: Record<string, unknown> = { id: row.id, cashDate: row.cashDate.toISOString().slice(0, 10), academicYear: row.academicYear, status: row.status, openingBalance: row.openingBalance.toString(), feeCash: source.feeCash.toString(), miscIncomeCash: source.miscIncomeCash.toString(), bookSalesCash: source.bookSalesCash.toString(), cashExpense: source.cashExpense.toString(), manualInflow: source.manualInflow.toString(), manualOutflow: source.manualOutflow.toString(), bankDeposit: source.bankDeposit.toString(), directorHandover: source.directorHandover.toString(), calculatedClosingBalance: source.expectedClosing.toString(), countedClosingBalance: row.countedClosingBalance?.toString() ?? null, varianceAmount: row.varianceAmount?.toString() ?? null, sourceDrift: snapshotted && hasSourceDrift(row.sourceSummarySnapshot, live), submittedAt: row.submittedAt, approvedAt: row.approvedAt, lockedAt: row.lockedAt, movements: row.movements.map((movement: any) => ({ id: movement.id, movementType: movement.movementType, amount: movement.amount.toString(), movementDate: movement.movementDate.toISOString().slice(0, 10), reason: movement.reason, status: movement.status, cancelledAt: movement.cancelledAt })) }; if (sensitive) Object.assign(result, { notes: row.notes, rejectionReason: row.rejectionReason, cancellationReason: row.cancellationReason, createdBy: row.createdBy?.name ?? null, submittedBy: row.submittedBy?.name ?? null, approvedBy: row.approvedBy?.name ?? null, lockedBy: row.lockedBy?.name ?? null, cancelledBy: row.cancelledBy?.name ?? null, movements: row.movements.map((movement: any) => ({ id: movement.id, movementType: movement.movementType, amount: movement.amount.toString(), movementDate: movement.movementDate.toISOString().slice(0, 10), referenceNumber: movement.referenceNumber, bankName: movement.bankName, recipientName: movement.recipientName, reason: movement.reason, notes: movement.notes, status: movement.status, cancellationReason: movement.cancellationReason, recordedBy: movement.recordedBy?.name ?? null, cancelledBy: movement.cancelledBy?.name ?? null, cancelledAt: movement.cancelledAt })) }); return result; }

export function missingCashBookDateKeys(rows: Array<{ cashDate: Date }>, throughDate: string) {
  const existing = new Set(rows.map((row) => row.cashDate.toISOString().slice(0, 10)));
  if (!rows.length) return [throughDate];
  const first = rows.reduce((earliest, row) => row.cashDate < earliest ? row.cashDate : earliest, rows[0].cashDate);
  const through = new Date(`${throughDate}T00:00:00.000Z`);
  if (first > through) return [throughDate];
  const missing: string[] = [];
  for (const cursor = new Date(first); cursor <= through; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    if (!existing.has(key)) missing.push(key);
  }
  return missing;
}

export function cashBookCsv(rows: any[]) {
  const headers = ["Date", "Status", "Opening", "Fee Cash", "Miscellaneous Cash", "Book-sale Cash", "Manual Inflow", "Cash Expenses", "Manual Outflow", "Deposited to School Current Account", "Handed to Director Sir", "Expected Closing", "Counted Closing", "Variance", "Source Drift"];
  return [headers, ...rows.map((row) => {
    const source = row.reportSources ?? { feeCash: row.feeCashSnapshot, miscIncomeCash: row.miscIncomeCashSnapshot, bookSalesCash: row.bookSalesCashSnapshot, manualInflow: row.manualInflowSnapshot, cashExpense: row.cashExpenseSnapshot, manualOutflow: row.manualOutflowSnapshot, bankDeposit: row.bankDepositSnapshot, directorHandover: row.directorHandoverSnapshot, expectedClosing: row.calculatedClosingBalance };
    const bookSalesCash = source.bookSalesCash ?? new Prisma.Decimal(0);
    return [row.cashDate.toISOString().slice(0, 10), row.status, row.openingBalance.toFixed(2), source.feeCash.toFixed(2), source.miscIncomeCash.toFixed(2), bookSalesCash.toFixed(2), source.manualInflow.toFixed(2), source.cashExpense.toFixed(2), source.manualOutflow.toFixed(2), source.bankDeposit.toFixed(2), source.directorHandover.toFixed(2), source.expectedClosing.toFixed(2), row.countedClosingBalance?.toFixed(2) ?? "", row.varianceAmount?.toFixed(2) ?? "", row.sourceDrift ? "Yes" : "No"];
  })].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
