import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { moneyDecimal } from "@/lib/expenses";
import { schoolDateKey } from "@/lib/format";
import { deriveOverdue } from "@/lib/library-circulation";
import { overdueSuggestion, resolveLibraryChargeRule } from "@/lib/library-charge-rules";
import { parseLibraryDate, safeMemberLabel } from "@/lib/library-members";
import { MISC_PAYMENT_METHODS, MISC_RECEIVED_ACCOUNTS, newMiscReceiptNumber } from "@/lib/misc-income";

export const LIBRARY_CHARGE_TYPES = ["OVERDUE", "LOST_BOOK", "DAMAGED_BOOK", "REPLACEMENT_DIFFERENCE", "OTHER"] as const;
export const LIBRARY_STUDENT_ITEM = { itemCode: "LIB-STUDENT-CHARGE", name: "Student Library Charge", category: "LIBRARY_CHARGE", studentLinkPolicy: "REQUIRED" } as const;
export const LIBRARY_STAFF_ITEM = { itemCode: "LIB-STAFF-CHARGE", name: "Staff Library Charge", category: "LIBRARY_CHARGE", studentLinkPolicy: "NOT_REQUIRED" } as const;

function requiredText(value: unknown, label: string, max = 2000) { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required`); if (text.length > max) throw new Error(`${label} must be at most ${max} characters`); return text; }
function chargeNumber(date: Date) { return `LCH-${schoolDateKey(date).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`; }

export async function previewLibraryCharge(client: PrismaClient | Prisma.TransactionClient, input: Record<string, unknown>) {
  const loanId = String(input.loanId ?? "").trim() || null; const incidentId = String(input.incidentId ?? "").trim() || null;
  if ((loanId ? 1 : 0) + (incidentId ? 1 : 0) !== 1) throw new Error("Select exactly one overdue loan or approved incident");
  if (loanId) {
    const loan = await client.libraryLoan.findUnique({ where: { id: loanId }, include: { member: { include: { student: { select: { studentName: true, admissionNo: true, className: true } }, staffMember: { select: { fullName: true, staffCode: true, staffType: true } } } }, copy: { include: { title: true } } } });
    if (!loan || loan.status !== "ISSUED" || !loan.activeCopyKey) throw new Error("Only an active issued loan can receive an overdue charge");
    const overdue = deriveOverdue(loan); if (!overdue.overdue) throw new Error("Due-today and future-due loans are not overdue");
    const resolved = await resolveLibraryChargeRule(client as any, loan.memberId); const suggestion = overdueSuggestion(resolved.rule, overdue.overdueDays);
    return { source: "OVERDUE", loan, incident: null, member: loan.member, overdueDays: overdue.overdueDays, rule: resolved.rule, ruleScope: resolved.scopeLabel, warning: resolved.warning, suggestedAmount: suggestion?.amount ?? null, chargeableDays: suggestion?.chargeableDays ?? null, acquisitionCostSuggestion: null };
  }
  const incident = await client.libraryIncident.findUnique({ where: { id: incidentId! }, include: { member: { include: { student: { select: { studentName: true, admissionNo: true, className: true } }, staffMember: { select: { fullName: true, staffCode: true, staffType: true } } } }, loan: true, copy: { include: { title: true } } } });
  if (!incident || incident.status !== "APPROVED") throw new Error("Only an approved open incident can receive a charge");
  const resolved = await resolveLibraryChargeRule(client as any, incident.memberId); let suggestedAmount: Prisma.Decimal | null = null;
  if (resolved.rule) {
    if (incident.incidentType === "LOST") suggestedAmount = resolved.rule.lostChargeBasis === "FIXED_AMOUNT" ? resolved.rule.fixedLostAmount : resolved.rule.lostChargeBasis === "ACQUISITION_COST" ? incident.copy.acquisitionCost : null;
    else suggestedAmount = resolved.rule.damagedChargeBasis === "FIXED_AMOUNT" ? resolved.rule.fixedDamagedAmount : null;
  }
  return { source: incident.incidentType, loan: incident.loan, incident, member: incident.member, overdueDays: null, rule: resolved.rule, ruleScope: resolved.scopeLabel, warning: resolved.warning ?? (!suggestedAmount ? "This rule requires an authorized manual amount and reason." : null), suggestedAmount, chargeableDays: null, acquisitionCostSuggestion: incident.copy.acquisitionCost };
}

export async function createLibraryCharge(client: PrismaClient, input: Record<string, unknown>, actorUserId: string) {
  const assessedDate = parseLibraryDate(input.assessedDate ?? schoolDateKey(), "Assessed date"); const originalAmount = moneyDecimal(input.originalAmount, "Original amount"); if (originalAmount.lte(0)) throw new Error("Original amount must be greater than zero");
  const assessmentReason = requiredText(input.assessmentReason, "Assessment reason", 2000); const requestedStatus = String(input.status ?? "DRAFT").toUpperCase(); if (!['DRAFT','PENDING_APPROVAL'].includes(requestedStatus)) throw new Error("New charges must be draft or pending approval");
  try {
    return await client.$transaction(async (tx) => {
      const preview = await previewLibraryCharge(tx, input); const chargeType = preview.source === "OVERDUE" ? "OVERDUE" : preview.source === "LOST" ? "LOST_BOOK" : "DAMAGED_BOOK";
      const member = preview.member; if ((member.studentId ? 1 : 0) + (member.staffMemberId ? 1 : 0) !== 1) throw new Error("Library member ownership is inconsistent");
      const dueDate = input.dueDate ? parseLibraryDate(input.dueDate, "Charge due date") : null;
      const charge = await tx.libraryCharge.create({ data: { chargeNumber: chargeNumber(assessedDate), chargeType, status: requestedStatus, activeOverdueLoanKey: chargeType === "OVERDUE" ? preview.loan.id : null, memberId: member.id, loanId: preview.loan?.id ?? null, incidentId: preview.incident?.id ?? null, studentId: member.studentId, staffMemberId: member.staffMemberId, assessedDate, dueDate, overdueDaysSnapshot: preview.overdueDays, ruleCodeSnapshot: preview.rule?.ruleCode ?? null, rateSnapshot: chargeType === "OVERDUE" ? preview.rule?.overdueAmountPerDay ?? null : null, originalAmount, waivedAmount: new Prisma.Decimal(0), payableAmount: originalAmount, assessmentReason, createdByUserId: actorUserId } });
      await tx.libraryChargeEvent.create({ data: { chargeId: charge.id, incidentId: charge.incidentId, eventType: requestedStatus === "PENDING_APPROVAL" ? "CHARGE_SUBMITTED" : "CHARGE_DRAFTED", eventDate: new Date(), newStatus: requestedStatus, amountSnapshot: originalAmount, reason: assessmentReason, notes: preview.warning, recordedByUserId: actorUserId } });
      return charge;
    });
  } catch (error: any) { if (error?.code === "P2002") throw new Error("An active overdue charge already exists for this loan or the generated charge number conflicted; refresh and try again"); throw error; }
}

export async function chargeWorkflow(client: PrismaClient, id: string, action: "submit" | "approve" | "reject" | "cancel", reason: unknown, actorUserId: string) {
  return client.$transaction(async (tx) => {
    const row = await tx.libraryCharge.findUnique({ where: { id } }); if (!row) throw new Error("Library charge not found");
    if (["PAID", "WAIVED", "CANCELLED"].includes(row.status)) throw new Error("Paid, waived, or cancelled charges are immutable"); const now = new Date();
    if (action === "submit") {
      if (row.status !== "DRAFT") throw new Error("Only a draft charge can be submitted"); const changed = await tx.libraryCharge.updateMany({ where: { id, status: "DRAFT", payableAmount: row.payableAmount }, data: { status: "PENDING_APPROVAL" } }); if (changed.count !== 1) throw new Error("Charge changed during submission");
      await tx.libraryChargeEvent.create({ data: { chargeId: id, incidentId: row.incidentId, eventType: "CHARGE_SUBMITTED", eventDate: now, previousStatus: "DRAFT", newStatus: "PENDING_APPROVAL", amountSnapshot: row.payableAmount, recordedByUserId: actorUserId } });
    } else if (action === "approve") {
      if (row.status !== "PENDING_APPROVAL") throw new Error("Only a pending charge can be approved"); const changed = await tx.libraryCharge.updateMany({ where: { id, status: "PENDING_APPROVAL", payableAmount: row.payableAmount }, data: { status: "APPROVED", approvedByUserId: actorUserId, approvedAt: now } }); if (changed.count !== 1) throw new Error("Charge changed during approval");
      await tx.libraryChargeEvent.create({ data: { chargeId: id, incidentId: row.incidentId, eventType: "CHARGE_APPROVED", eventDate: now, previousStatus: "PENDING_APPROVAL", newStatus: "APPROVED", amountSnapshot: row.payableAmount, recordedByUserId: actorUserId } });
    } else {
      const cancellationReason = requiredText(reason, action === "reject" ? "Rejection reason" : "Cancellation reason", 1000); const changed = await tx.libraryCharge.updateMany({ where: { id, status: row.status, payableAmount: row.payableAmount }, data: { status: "CANCELLED", activeOverdueLoanKey: null, cancellationReason, cancelledByUserId: actorUserId, cancelledAt: now } }); if (changed.count !== 1) throw new Error("Charge changed during cancellation");
      await tx.libraryChargeEvent.create({ data: { chargeId: id, incidentId: row.incidentId, eventType: action === "reject" ? "CHARGE_REJECTED" : "CHARGE_CANCELLED", eventDate: now, previousStatus: row.status, newStatus: "CANCELLED", amountSnapshot: row.payableAmount, reason: cancellationReason, recordedByUserId: actorUserId } });
    }
    return tx.libraryCharge.findUniqueOrThrow({ where: { id } });
  });
}

export async function waiveLibraryCharge(client: PrismaClient, id: string, amountInput: unknown, reasonInput: unknown, actorUserId: string) {
  const waiverAmount = moneyDecimal(amountInput, "Waiver amount"); const waiverReason = requiredText(reasonInput, "Waiver reason", 1000); if (waiverAmount.lte(0)) throw new Error("Waiver amount must be greater than zero");
  return client.$transaction(async (tx) => {
    const row = await tx.libraryCharge.findUnique({ where: { id } }); if (!row || row.status !== "APPROVED") throw new Error("Only an approved unpaid charge can be waived");
    const newWaived = row.waivedAmount.add(waiverAmount); if (newWaived.gt(row.originalAmount)) throw new Error("Total waiver cannot exceed the original amount"); const payable = row.originalAmount.sub(newWaived); const full = payable.eq(0);
    const changed = await tx.libraryCharge.updateMany({ where: { id, status: "APPROVED", waivedAmount: row.waivedAmount, payableAmount: row.payableAmount, miscIncomeReceiptId: null }, data: { waivedAmount: newWaived, payableAmount: payable, waiverReason, waivedByUserId: actorUserId, waivedAt: new Date(), status: full ? "WAIVED" : "APPROVED", activeOverdueLoanKey: full ? null : row.activeOverdueLoanKey } }); if (changed.count !== 1) throw new Error("Charge changed during waiver; refresh before trying again");
    await tx.libraryChargeEvent.create({ data: { chargeId: id, incidentId: row.incidentId, eventType: full ? "CHARGE_WAIVED" : "CHARGE_PARTIALLY_WAIVED", eventDate: new Date(), previousStatus: "APPROVED", newStatus: full ? "WAIVED" : "APPROVED", amountSnapshot: waiverAmount, reason: waiverReason, notes: `Total waived ${newWaived.toFixed(2)}; payable ${payable.toFixed(2)}`, recordedByUserId: actorUserId } });
    return tx.libraryCharge.findUniqueOrThrow({ where: { id } });
  });
}

function collectionReferences(input: Record<string, unknown>) {
  const paymentMethod = String(input.paymentMethod ?? "").toUpperCase(); if (!MISC_PAYMENT_METHODS.includes(paymentMethod as never)) throw new Error("Unsupported payment method");
  let receivedAccount = String(input.receivedAccount ?? "").toUpperCase() || null; let transactionReference = String(input.transactionReference ?? "").trim() || null; let chequeNumber = String(input.chequeNumber ?? "").trim() || null; let chequeDate = input.chequeDate ? parseLibraryDate(input.chequeDate, "Cheque date") : null;
  if (paymentMethod === "CASH") return { paymentMethod, receivedAccount: "CASH_COUNTER", transactionReference: null, chequeNumber: null, chequeDate: null };
  if (!receivedAccount || !MISC_RECEIVED_ACCOUNTS.includes(receivedAccount as never)) throw new Error("Received account is required for non-cash collection");
  if (paymentMethod === "CHEQUE") { if (!chequeNumber || !chequeDate) throw new Error("Cheque number and cheque date are required"); transactionReference = null; }
  else { if (!transactionReference) throw new Error("Transaction reference is required for non-cash collection"); chequeNumber = null; chequeDate = null; }
  return { paymentMethod, receivedAccount, transactionReference, chequeNumber, chequeDate };
}

export async function collectLibraryCharge(client: PrismaClient, id: string, input: Record<string, unknown>, actorUserId: string) {
  const refs = collectionReferences(input); const receiptDate = parseLibraryDate(input.receiptDate ?? schoolDateKey(), "Receipt date"); const academicYear = requiredText(input.academicYear, "Academic year", 20);
  return client.$transaction(async (tx) => {
    const row = await tx.libraryCharge.findUnique({ where: { id }, include: { member: { include: { student: { select: { studentName: true, academicYear: true } }, staffMember: { select: { fullName: true } } } } } });
    if (!row || row.status !== "APPROVED" || row.payableAmount.lte(0) || row.miscIncomeReceiptId) throw new Error("Only an approved positive unpaid charge can be collected");
    const studentOwned = Boolean(row.studentId && !row.staffMemberId && row.member.studentId === row.studentId && !row.member.staffMemberId && row.member.student);
    const staffOwned = Boolean(row.staffMemberId && !row.studentId && row.member.staffMemberId === row.staffMemberId && !row.member.studentId && row.member.staffMember);
    if (!studentOwned && !staffOwned) throw new Error("Library charge ownership no longer matches its member; collection is blocked");
    const itemDef = row.studentId ? LIBRARY_STUDENT_ITEM : LIBRARY_STAFF_ITEM; const item = await tx.miscIncomeItem.upsert({ where: { itemCode: itemDef.itemCode }, update: {}, create: { ...itemDef, status: "ACTIVE", createdByUserId: actorUserId } });
    if (item.status !== "ACTIVE" || item.studentLinkPolicy !== itemDef.studentLinkPolicy) throw new Error(`${itemDef.name} Miscellaneous Income item must be active with ${itemDef.studentLinkPolicy} Student linkage`);
    const receipt = await tx.miscIncomeReceipt.create({ data: { receiptNumber: newMiscReceiptNumber(receiptDate), receiptDate, academicYear, studentId: row.studentId, payerName: row.member.student?.studentName ?? row.member.staffMember?.fullName ?? null, ...refs, grossAmount: row.payableAmount, discountAmount: new Prisma.Decimal(0), netAmount: row.payableAmount, status: "ACTIVE", remarks: `Library Charge Receipt; not a school-fee receipt. Charge ${row.chargeNumber}.`, createdByUserId: actorUserId, lines: { create: { itemId: item.id, itemNameSnapshot: item.name, rateId: null, quantity: 1, unitAmount: row.payableAmount, discountAmount: new Prisma.Decimal(0), lineTotal: row.payableAmount, notes: `Charge ${row.chargeNumber}; type ${row.chargeType}; original ${row.originalAmount.toFixed(2)}; waived ${row.waivedAmount.toFixed(2)}.` } } } });
    const changed = await tx.libraryCharge.updateMany({ where: { id, status: "APPROVED", payableAmount: row.payableAmount, waivedAmount: row.waivedAmount, miscIncomeReceiptId: null }, data: { status: "PAID", activeOverdueLoanKey: null, miscIncomeReceiptId: receipt.id, collectedByUserId: actorUserId, collectedAt: new Date() } }); if (changed.count !== 1) throw new Error("Charge changed during collection; no duplicate collection was recorded");
    await tx.libraryChargeEvent.create({ data: { chargeId: id, incidentId: row.incidentId, eventType: "CHARGE_COLLECTED", eventDate: new Date(), previousStatus: "APPROVED", newStatus: "PAID", amountSnapshot: row.payableAmount, reason: receipt.receiptNumber, notes: `${refs.paymentMethod} via Miscellaneous Income exactly once`, recordedByUserId: actorUserId } });
    return { charge: await tx.libraryCharge.findUniqueOrThrow({ where: { id } }), receipt };
  });
}

export function publicLibraryCharge(row: any, options: { masked?: boolean; portal?: boolean } = {}) {
  const borrower = options.masked ? `${row.member.memberType === "STUDENT" ? "Student" : "Staff"} ${row.member.memberCode.slice(0, 3)}***` : safeMemberLabel(row.member);
  return { chargeNumber: row.chargeNumber, chargeType: row.chargeType, status: row.status, borrower, assessedDate: row.assessedDate, dueDate: row.dueDate, overdueDaysSnapshot: row.overdueDaysSnapshot, originalAmount: row.originalAmount.toFixed(2), waivedAmount: row.waivedAmount.toFixed(2), payableAmount: row.payableAmount.toFixed(2), assessmentReason: options.portal ? undefined : row.assessmentReason, waiverReason: options.portal ? (row.waivedAmount.gt(0) ? "Authorized waiver recorded" : null) : row.waiverReason, receipt: row.miscIncomeReceipt ? { receiptNumber: row.miscIncomeReceipt.receiptNumber, receiptDate: row.miscIncomeReceipt.receiptDate, status: row.miscIncomeReceipt.status, amount: row.miscIncomeReceipt.netAmount.toFixed(2), label: "Library Charge Receipt", disclaimer: "Not a school-fee receipt." } : null };
}
