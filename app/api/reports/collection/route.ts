import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { sumCountablePayments } from "@/lib/payment-controls";
import { classSectionLabel, displayCollectionTermLabel, groupTotalByLabel } from "@/lib/collection-report";
import { effectiveActiveSelectedReceiptPayments } from "@/lib/receipt-integrity";
import { collectionPaymentResponse, privateFinanceJson } from "@/lib/finance-privacy";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_DAILY_COLLECTION");
  if (auth.response) return auth.response;
  const sp = request.nextUrl.searchParams;
  const date = sp.get("date");
  const month = sp.get("month");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return privateFinanceJson({ error: "A valid report date is required" }, { status: 400 });
  }
  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return privateFinanceJson({ error: "A valid report month is required" }, { status: 400 });
  }
  const collectionDate = date ? dayRange(date) : month ? monthRange(month) : undefined;
  const where = {
    deletedAt: null,
    ...(collectionDate ? { date: collectionDate } : {})
  };
  const [receiptRows, familyCollections] = await Promise.all([
    prisma.payment.findMany({ where, orderBy: [{ date: "asc" }, { receiptNo: "asc" }], take: 10_000 }),
    prisma.familyCollection.findMany({
      where: { ...(collectionDate ? { collectionDate } : {}), status: "ISSUED" },
      select: {
        publicReference: true,
        collectionDate: true,
        totalPaise: true,
        instruments: { select: { ordinal: true, mode: true, amountPaise: true, referenceMasked: true }, orderBy: { ordinal: "asc" } },
        allocations: { select: { admissionNoSnapshot: true, studentNameSnapshot: true, classNameSnapshot: true, sectionSnapshot: true, academicYear: true, installment: true, feeHead: true, amountPaise: true }, orderBy: { orderIndex: "asc" } }
      },
      orderBy: { publicReference: "asc" },
      take: 500
    })
  ]);
  const payments = await effectiveActiveSelectedReceiptPayments(prisma, receiptRows);
  const byAccount = groupTotal(payments, "receivedAccount");
  const byMode = groupTotal(payments, "paymentMode");
  const byClass = groupTotalByLabel(payments, (payment) => classSectionLabel(payment.className, payment.section));
  const byStudent = groupTotal(payments, "studentName");
  const byTerm = groupTotalByLabel(payments, (payment) => displayCollectionTermLabel(payment.termHint));
  const aggregateOnly = auth.user.role === "VIEWER";
  return privateFinanceJson({
    aggregateOnly,
    totalCash: byMode.Cash ?? 0,
    totalDirectorGPay: byAccount["Director Sir GPay"] ?? 0,
    totalNpsUpi: byAccount["NPS Current Account UPI"] ?? 0,
    totalBank: byAccount["NPS Bank Account"] ?? 0,
    totalCheque: byMode.Cheque ?? 0,
    totalOther: byMode.Other ?? 0,
    grandTotal: sumCountablePayments(payments),
    receipts: aggregateOnly ? [] : Array.from(new Set(payments.map((p) => p.receiptNo))).sort(),
    byAccount,
    byMode,
    byClass,
    byStudent: aggregateOnly ? {} : byStudent,
    byTerm,
    payments: aggregateOnly ? [] : payments.map((payment) => collectionPaymentResponse(payment)),
    familyCollections: aggregateOnly ? [] : familyCollections.map((collection) => ({
      reference: collection.publicReference,
      date: collection.collectionDate,
      totalPaise: collection.totalPaise,
      instruments: collection.instruments,
      allocations: collection.allocations.map((row) => ({ admissionNo: row.admissionNoSnapshot, studentName: row.studentNameSnapshot, className: row.classNameSnapshot, section: row.sectionSnapshot, academicYear: row.academicYear, installment: row.installment, feeHead: row.feeHead, amountPaise: row.amountPaise }))
    }))
  });
}

function dayRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

function monthRange(monthText: string) {
  const start = new Date(`${monthText}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { gte: start, lt: end };
}

function groupTotal<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const name = String(row[key] ?? "Blank");
    acc[name] = (acc[name] ?? 0) + Number(row.amountPaid ?? 0);
    return acc;
  }, {});
}
