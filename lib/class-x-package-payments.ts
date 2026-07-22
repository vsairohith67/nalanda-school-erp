import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { moneyDecimal } from "@/lib/expenses";
import { schoolDateKey } from "@/lib/format";
import { MISC_PAYMENT_METHODS, MISC_RECEIVED_ACCOUNTS, newMiscReceiptNumber } from "@/lib/misc-income";
import { assertClassXIncomeItem, CLASS_X_PACKAGE_TYPE } from "@/lib/class-x-package-templates";

function requiredText(value: unknown, label: string, max = 1000) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required`);
  if (text.length > max) throw new Error(`${label} must be at most ${max} characters`);
  return text;
}

function chargeCode(date = new Date(), qaPrefix = false) {
  return `${qaPrefix ? "QA18B-" : ""}CXP-CHG-${schoolDateKey(date).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function refreshPaymentReadiness(tx: Prisma.TransactionClient, packageId: string) {
  const unresolvedRequiredItems = await tx.classXPackageDocumentItem.count({
    where: {
      packageId,
      required: true,
      status: { notIn: ["READY_FOR_HANDOVER", "HANDED_OVER", "NOT_APPLICABLE"] }
    }
  });
  if (unresolvedRequiredItems === 0) {
    await tx.classXDocumentPackage.updateMany({
      where: { id: packageId, status: "PAYMENT_PENDING" },
      data: { status: "READY_FOR_APPROVAL" }
    });
  }
}

export async function resolveClassXChargeRule(client: PrismaClient | Prisma.TransactionClient, academicYear: string, at = new Date(), requestedRuleId?: string | null) {
  const rules = await client.classXPackageChargeRule.findMany({
    where: {
      packageType: CLASS_X_PACKAGE_TYPE, status: "ACTIVE",
      OR: [{ academicYear }, { academicYear: null }],
      AND: [{ OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: at } }] }, { OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }] }],
      ...(requestedRuleId ? { id: requestedRuleId } : {})
    },
    orderBy: [{ academicYear: "desc" }, { createdAt: "desc" }]
  });
  if (!rules.length) return null;
  const exact = rules.filter((rule) => rule.academicYear === academicYear);
  const applicable = exact.length ? exact : rules.filter((rule) => !rule.academicYear);
  if (applicable.length !== 1) throw new Error("Multiple active Class X package charge rules apply. Inactivate the ambiguity before continuing");
  return applicable[0];
}

export async function previewClassXCharge(client: PrismaClient | Prisma.TransactionClient, academicYear: string, requestedRuleId?: string | null) {
  const rule = await resolveClassXChargeRule(client, academicYear, new Date(), requestedRuleId);
  if (!rule) return { paymentRequired: false, rule: null, amount: "0.00", itemCode: null, financialWriteCreated: false };
  await assertClassXIncomeItem(client, rule.miscellaneousIncomeItemCode);
  return { paymentRequired: rule.paymentRequired, rule, amount: rule.amount.toFixed(2), itemCode: rule.miscellaneousIncomeItemCode, financialWriteCreated: false };
}

export function newChargeData(rule: Awaited<ReturnType<typeof resolveClassXChargeRule>>, paymentRequired: boolean, qaPrefix = false) {
  if (!paymentRequired || !rule || !rule.paymentRequired) return {
    chargeCode: chargeCode(new Date(), qaPrefix), chargeRuleId: rule?.id ?? null, miscellaneousIncomeItemCode: rule?.miscellaneousIncomeItemCode ?? null,
    originalAmount: new Prisma.Decimal(0), waivedAmount: new Prisma.Decimal(0), payableAmount: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(0),
    waiverAllowedSnapshot: Boolean(rule?.waiverAllowed), status: "NOT_REQUIRED"
  };
  return {
    chargeCode: chargeCode(new Date(), qaPrefix), chargeRuleId: rule.id, miscellaneousIncomeItemCode: rule.miscellaneousIncomeItemCode,
    originalAmount: rule.amount, waivedAmount: new Prisma.Decimal(0), payableAmount: rule.amount, paidAmount: new Prisma.Decimal(0),
    waiverAllowedSnapshot: rule.waiverAllowed, status: "PENDING"
  };
}

export async function approveClassXCharge(client: PrismaClient, packageId: string, actorId: string, expectedUpdatedAt?: string) {
  return client.$transaction(async (tx) => {
    const row = await tx.classXPackageCharge.findUnique({ where: { packageId } });
    if (!row) throw new Error("Package charge was not found");
    if (row.status === "APPROVED_FOR_COLLECTION") return row;
    if (row.status !== "PENDING") throw new Error("Only a pending package charge can be approved");
    const changed = await tx.classXPackageCharge.updateMany({
      where: { id: row.id, status: "PENDING", updatedAt: expectedUpdatedAt ? new Date(expectedUpdatedAt) : row.updatedAt },
      data: { status: "APPROVED_FOR_COLLECTION", approvedByUserId: actorId, approvedAt: new Date() }
    });
    if (changed.count !== 1) throw new Error("Package charge changed during approval; refresh and try again");
    await tx.classXPackageEvent.create({ data: { packageId, chargeId: row.id, eventType: "CHARGE_APPROVED", previousStatus: "PENDING", newStatus: "APPROVED_FOR_COLLECTION", recordedByUserId: actorId } });
    return tx.classXPackageCharge.findUniqueOrThrow({ where: { id: row.id } });
  });
}

export async function waiveClassXCharge(client: PrismaClient, packageId: string, reasonInput: unknown, actorId: string) {
  const reason = requiredText(reasonInput, "Waiver reason", 1000);
  return client.$transaction(async (tx) => {
    const row = await tx.classXPackageCharge.findUnique({ where: { packageId } });
    if (!row || !["PENDING", "APPROVED_FOR_COLLECTION"].includes(row.status)) throw new Error("Only an unpaid pending package charge can be waived");
    if (!row.waiverAllowedSnapshot) throw new Error("The snapshotted charge rule does not permit a waiver");
    if (row.paidAmount.gt(0) || row.linkedMiscIncomeReceiptId) throw new Error("A paid package charge cannot be waived");
    const changed = await tx.classXPackageCharge.updateMany({
      where: { id: row.id, status: row.status, payableAmount: row.payableAmount, linkedMiscIncomeReceiptId: null },
      data: { status: "WAIVED", waivedAmount: row.originalAmount, payableAmount: new Prisma.Decimal(0), waiverReason: reason, waivedByUserId: actorId, waivedAt: new Date() }
    });
    if (changed.count !== 1) throw new Error("Package charge changed during waiver; refresh and try again");
    await tx.classXPackageEvent.create({ data: { packageId, chargeId: row.id, eventType: "CHARGE_WAIVED", previousStatus: row.status, newStatus: "WAIVED", reason, recordedByUserId: actorId } });
    await refreshPaymentReadiness(tx, packageId);
    return tx.classXPackageCharge.findUniqueOrThrow({ where: { id: row.id } });
  });
}

function collectionReferences(input: Record<string, unknown>) {
  const paymentMethod = String(input.paymentMethod ?? "").toUpperCase();
  if (!MISC_PAYMENT_METHODS.includes(paymentMethod as never)) throw new Error("Payment method is not supported");
  if (paymentMethod === "CASH") return { paymentMethod, receivedAccount: "CASH_COUNTER", transactionReference: null, chequeNumber: null, chequeDate: null };
  const receivedAccount = String(input.receivedAccount ?? "").toUpperCase();
  if (!MISC_RECEIVED_ACCOUNTS.includes(receivedAccount as never)) throw new Error("Received account is required for non-cash collection");
  if (paymentMethod === "CHEQUE") {
    const chequeNumber = requiredText(input.chequeNumber, "Cheque number", 40);
    const chequeDate = new Date(`${requiredText(input.chequeDate, "Cheque date", 10)}T00:00:00.000Z`);
    if (Number.isNaN(chequeDate.getTime())) throw new Error("Cheque date is invalid");
    return { paymentMethod, receivedAccount, transactionReference: null, chequeNumber, chequeDate };
  }
  return { paymentMethod, receivedAccount, transactionReference: requiredText(input.transactionReference, "Transaction reference", 120), chequeNumber: null, chequeDate: null };
}

export async function collectClassXCharge(client: PrismaClient, packageId: string, input: Record<string, unknown>, actorId: string) {
  const refs = collectionReferences(input);
  const receiptDate = new Date(`${String(input.receiptDate ?? schoolDateKey())}T00:00:00.000Z`);
  if (Number.isNaN(receiptDate.getTime())) throw new Error("Receipt date is invalid");
  return client.$transaction(async (tx) => {
    const charge = await tx.classXPackageCharge.findUnique({ where: { packageId }, include: { package: { include: { student: { select: { id: true, studentName: true, deletedAt: true } } } } } });
    if (!charge || charge.status !== "APPROVED_FOR_COLLECTION" || charge.linkedMiscIncomeReceiptId || charge.payableAmount.lte(0)) throw new Error("Only an approved positive unpaid package charge can be collected");
    if (charge.package.status === "CANCELLED" || charge.package.student.deletedAt) throw new Error("Collection is blocked because the package or Student is no longer active");
    const supplied = moneyDecimal(input.amount, "Collection amount");
    if (!supplied.eq(charge.payableAmount)) throw new Error(`Only the full payable amount ${charge.payableAmount.toFixed(2)} is accepted in this phase`);
    const itemCode = requiredText(charge.miscellaneousIncomeItemCode, "Miscellaneous Income item code", 30);
    const item = await assertClassXIncomeItem(tx, itemCode);
    const receipt = await tx.miscIncomeReceipt.create({ data: {
      receiptNumber: newMiscReceiptNumber(receiptDate), receiptDate, academicYear: charge.package.academicYear,
      studentId: charge.package.studentId, payerName: charge.package.student.studentName, ...refs,
      grossAmount: charge.payableAmount, discountAmount: new Prisma.Decimal(0), netAmount: charge.payableAmount, status: "ACTIVE",
      remarks: `Class X Document Package service charge; not a school-fee or Board receipt. Package ${charge.package.packageNumber}.`,
      createdByUserId: actorId,
      lines: { create: { itemId: item.id, itemNameSnapshot: item.name, rateId: null, quantity: 1, unitAmount: charge.payableAmount, discountAmount: new Prisma.Decimal(0), lineTotal: charge.payableAmount, notes: `Package ${charge.package.packageNumber}; charge ${charge.chargeCode}.` } }
    } });
    const changed = await tx.classXPackageCharge.updateMany({
      where: { id: charge.id, status: "APPROVED_FOR_COLLECTION", payableAmount: charge.payableAmount, linkedMiscIncomeReceiptId: null },
      data: { status: "PAID", paidAmount: charge.payableAmount, linkedMiscIncomeReceiptId: receipt.id, collectedByUserId: actorId, paidAt: new Date() }
    });
    if (changed.count !== 1) throw new Error("Package charge changed during collection; no duplicate receipt was recorded");
    await tx.classXPackageEvent.create({ data: { packageId, chargeId: charge.id, eventType: "PAYMENT_COLLECTED", previousStatus: "APPROVED_FOR_COLLECTION", newStatus: "PAID", reason: receipt.receiptNumber, notes: "Miscellaneous Income source recorded exactly once; no fee Payment was created.", recordedByUserId: actorId } });
    await refreshPaymentReadiness(tx, packageId);
    return { charge: await tx.classXPackageCharge.findUniqueOrThrow({ where: { id: charge.id } }), receipt };
  });
}

export function publicClassXCharge(row: any, receiptVisible = false) {
  return {
    chargeCode: row.chargeCode, status: row.status,
    originalAmount: row.originalAmount.toFixed(2), waivedAmount: row.waivedAmount.toFixed(2),
    payableAmount: row.payableAmount.toFixed(2), paidAmount: row.paidAmount.toFixed(2),
    receiptNumber: receiptVisible ? row.linkedMiscIncomeReceipt?.receiptNumber ?? null : null,
    receiptLabel: receiptVisible && row.linkedMiscIncomeReceipt ? "Document Package Service Charge Receipt (not a Board or school-fee receipt)" : null
  };
}
