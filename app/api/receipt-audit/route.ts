import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import {
  analyzeReceiptPayments,
  parseReceiptAuditRange,
  ReceiptAuditRangeError
} from "@/lib/receipt-audit";
import { safeClientError } from "@/lib/client-errors";
import { privateFinanceJson } from "@/lib/finance-privacy";
import {
  cancelWholeReceipt,
  effectiveReceiptState,
  ReceiptIntegrityError
} from "@/lib/receipt-integrity";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_RECEIPT_AUDIT");
  if (auth.response) return auth.response;
  let range;
  try {
    range = parseReceiptAuditRange(
      request.nextUrl.searchParams.get("startReceiptNo"),
      request.nextUrl.searchParams.get("endReceiptNo")
    );
  } catch (error) {
    const message = error instanceof ReceiptAuditRangeError
      ? error.message
      : "Valid positive receipt range is required";
    return privateFinanceJson({ error: message }, { status: 400 });
  }
  const { start, end, receiptNumbers } = range;
  const [payments, notes] = await Promise.all([
    prisma.payment.findMany({
      where: { deletedAt: null, receiptNo: { in: receiptNumbers } },
      select: {
        receiptNo: true,
        date: true,
        admissionNo: true,
        amountPaid: true,
        paymentMode: true,
        transactionRefNo: true,
        isCancelled: true,
        deletedAt: true,
        updatedAt: true
      }
    }),
    prisma.receiptNote.findMany({
      where: { receiptNo: { in: receiptNumbers } },
      select: { receiptNo: true, status: true, remarks: true }
    })
  ]);
  const grouped = new Map<string, typeof payments>();
  for (const payment of payments) {
    grouped.set(payment.receiptNo, [...(grouped.get(payment.receiptNo) ?? []), payment]);
  }
  const noteMap = new Map(notes.map((note) => [note.receiptNo, note]));
  const rows = [];
  for (let receipt = start; receipt <= end; receipt += 1) {
    const receiptNo = String(receipt);
    const receiptPayments = grouped.get(receiptNo) ?? [];
    const note = noteMap.get(receiptNo);
    rows.push({
      receiptNo,
      ...analyzeReceiptPayments(receiptPayments, note),
      version: receiptPayments.length
        ? effectiveReceiptState(
            receiptPayments.map((payment, index) => ({ ...payment, id: `audit-${index}` })),
            note
          ).version
        : null
    });
  }
  return privateFinanceJson(rows);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CANCEL_FINAL_RECEIPT");
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  const receiptNo = String(body.receiptNo ?? "").trim();
  if (!receiptNo) return privateFinanceJson({ error: "Receipt number is required" }, { status: 400 });
  try {
    const result = await cancelWholeReceipt(prisma, {
      authorization: "CANCEL_FINAL_RECEIPT",
      receiptNo,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
      actor: auth.user
    });
    return privateFinanceJson(result);
  } catch (error) {
    const status = error instanceof ReceiptIntegrityError ? error.status : 409;
    return privateFinanceJson({ error: safeClientError(error, "Unable to cancel receipt") }, { status });
  }
}
