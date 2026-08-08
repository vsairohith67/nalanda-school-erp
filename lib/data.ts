import { prisma } from "@/lib/prisma";
import { ACADEMIC_YEAR } from "@/lib/constants";
import { allocateFees } from "@/lib/fee-allocation";
import { sumPendingAmounts } from "@/lib/payment-controls";
import { analyzeReceiptPayments } from "@/lib/receipt-audit";
import { schoolDateKey } from "@/lib/format";
import { effectiveActiveReceiptPayments } from "@/lib/receipt-integrity";

export async function getFeeStructures(academicYear = ACADEMIC_YEAR) {
  return prisma.feeStructure.findMany({
    where: { academicYear, active: true },
    orderBy: { className: "asc" }
  });
}

export async function getPendingDues(params: {
  academicYear?: string;
  className?: string;
  section?: string;
  status?: string;
  only?: "pending" | "paid";
  receivedAccount?: string;
  paymentMode?: string;
  term?: string;
} = {}) {
  const academicYear = params.academicYear || ACADEMIC_YEAR;
  const [students, fees, payments] = await Promise.all([
    prisma.student.findMany({
      where: {
        academicYear,
        deletedAt: null,
        ...(params.className ? { className: params.className } : {}),
        ...(params.section ? { section: params.section } : {}),
        ...(params.status ? { status: params.status } : {})
      },
      orderBy: [{ className: "asc" }, { section: "asc" }, { studentName: "asc" }]
    }),
    getFeeStructures(academicYear),
    prisma.payment.findMany({
      where: {
        deletedAt: null,
      }
    })
  ]);
  const activePayments = effectiveActiveReceiptPayments(payments)
    .filter((payment) => !params.receivedAccount || payment.receivedAccount === params.receivedAccount)
    .filter((payment) => !params.paymentMode || payment.paymentMode === params.paymentMode);
  const feeMap = new Map(fees.map((fee) => [fee.className, fee]));
  return students
    .map((student) => {
      const fee = feeMap.get(student.className);
      if (!fee) return null;
      const studentPayments = activePayments.filter((payment) => payment.admissionNo === student.admissionNo);
      const allocation = allocateFees(student, fee, studentPayments);
      const row = {
        academicYear: student.academicYear,
        admissionNo: student.admissionNo,
        studentName: student.studentName,
        fatherName: student.fatherName,
        className: student.className,
        section: student.section,
        phone1: student.phone1,
        phone2: student.phone2,
        whatsappNumber: student.whatsappNumber,
        status: student.status,
        annualFee: allocation.annualFee,
        discountPercent: allocation.effectiveDiscountPercent,
        annualFeeAfterDiscount: allocation.annualFeeAfterDiscount,
        totalCurrentYearPaid: allocation.totalCurrentYearPaid,
        term1Paid: allocation.terms[0].paid,
        term1Due: allocation.terms[0].due,
        term2Paid: allocation.terms[1].paid,
        term2Due: allocation.terms[1].due,
        term3Paid: allocation.terms[2].paid,
        term3Due: allocation.terms[2].due,
        term4Paid: allocation.terms[3].paid,
        term4Due: allocation.terms[3].due,
        totalPending: allocation.totalPending,
        dueStatus: allocation.dueStatus,
        remarks: student.remarks
      };
      return row;
    })
    .filter(Boolean)
    .filter((row) => {
      if (!row) return false;
      if (params.only === "pending" && row.totalPending <= 0) return false;
      if (params.only === "paid" && row.totalPending > 0) return false;
      if (params.term && params.term !== "all") {
        const key = `${params.term}Due` as keyof typeof row;
        if (Number(row[key]) <= 0) return false;
      }
      return true;
    });
}

export function dashboardCollectionMetrics<T extends { date: Date; amountPaid: number; paymentMode: string; receiptNo?: string }>(payments: T[], now = new Date()) {
  const today = schoolDateKey(now);
  const month = today.slice(0, 7);
  const todayPayments = payments.filter((payment) => schoolDateKey(payment.date) === today);
  const monthPayments = payments.filter((payment) => schoolDateKey(payment.date).slice(0, 7) === month);
  const byPaymentMode = totalBy(payments, "paymentMode");
  return {
    today,
    month,
    todayCollection: todayPayments.reduce((sum, payment) => sum + payment.amountPaid, 0),
    todayPaymentCount: new Set(todayPayments.map((payment, index) => payment.receiptNo || `row-${index}`)).size,
    monthCollection: monthPayments.reduce((sum, payment) => sum + payment.amountPaid, 0),
    paymentModeSplit: [...byPaymentMode.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)
  };
}

export async function getDashboard(academicYear = ACADEMIC_YEAR, now = new Date()) {
  const [students, fees, payments, pendingRows, receiptNotes] = await Promise.all([
    prisma.student.findMany({ where: { academicYear, deletedAt: null, status: "Active" } }),
    getFeeStructures(academicYear),
    prisma.payment.findMany({
      where: { deletedAt: null },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    }),
    getPendingDues({ academicYear, status: "Active" }),
    prisma.receiptNote.findMany()
  ]);
  const activePayments = effectiveActiveReceiptPayments(payments);
  const feeMap = new Map(fees.map((fee) => [fee.className, fee]));
  const expected = pendingRows.reduce(
    (sum, row) => sum + (row?.annualFee ?? 0),
    0
  );
  const expectedAfterDiscount = pendingRows.reduce(
    (sum, row) => sum + (row?.annualFeeAfterDiscount ?? 0),
    0
  );
  const currentYearCollected = activePayments
    .filter((payment) => payment.feeType === "Current Year Fee")
    .reduce((sum, payment) => sum + payment.amountPaid, 0);
  const oldDuesCollected = activePayments
    .filter((payment) => payment.feeType === "Old Due")
    .reduce((sum, payment) => sum + payment.amountPaid, 0);
  const collectionMetrics = dashboardCollectionMetrics(activePayments, now);
  const byAccount = totalBy(activePayments, "receivedAccount");
  const classWise = Array.from(
    pendingRows.reduce((map, row) => {
      if (!row) return map;
      const existing = map.get(row.className) ?? { className: row.className, expected: 0, collected: 0, pending: 0 };
      existing.expected += row.annualFeeAfterDiscount;
      existing.collected += row.totalCurrentYearPaid;
      existing.pending += row.totalPending;
      map.set(row.className, existing);
      return map;
    }, new Map<string, { className: string; expected: number; collected: number; pending: number }>())
  ).map(([, value]) => value);

  const recentPayments = activePayments.slice(0, 10);
  const paymentsByReceipt = payments.reduce((map, payment) => {
    map.set(payment.receiptNo, [...(map.get(payment.receiptNo) ?? []), payment]);
    return map;
  }, new Map<string, typeof payments>());
  const noteByReceipt = new Map(receiptNotes.map((note) => [note.receiptNo, note]));
  const receiptWarnings = Array.from(paymentsByReceipt.entries())
    .map(([receiptNo, receiptPayments]) => ({
      receiptNo,
      audit: analyzeReceiptPayments(receiptPayments, noteByReceipt.get(receiptNo))
    }))
    .filter(({ audit }) => ["Duplicate", "Needs Review", "Cancelled"].includes(audit.status))
    .map(({ receiptNo, audit }) => ({ receiptNo, issue: audit.issues || audit.status }))
    .slice(0, 8);

  return {
    activeStudents: students.length,
    totalExpectedAnnualFee: expected,
    totalExpectedAfterDiscount: expectedAfterDiscount,
    totalCollectedCurrentYear: currentYearCollected,
    totalPendingCurrentYear: sumPendingAmounts(pendingRows),
    totalOldDuesCollected: oldDuesCollected,
    todayCollection: collectionMetrics.todayCollection,
    todayPaymentCount: collectionMetrics.todayPaymentCount,
    monthCollection: collectionMetrics.monthCollection,
    pendingStudentCount: pendingRows.filter((row) => row && row.totalPending > 0).length,
    paymentModeSplit: collectionMetrics.paymentModeSplit,
    cashTotal: byAccount.get("Cash") ?? 0,
    directorGPayTotal: byAccount.get("Director Sir GPay") ?? 0,
    npsUpiTotal: byAccount.get("NPS Current Account UPI") ?? 0,
    bankTotal: byAccount.get("NPS Bank Account") ?? 0,
    defaulters: pendingRows.filter((row) => row?.dueStatus === "Defaulter").length,
    classWise,
    topPending: pendingRows
      .filter((row) => row && row.totalPending > 0)
      .sort((a, b) => (b?.totalPending ?? 0) - (a?.totalPending ?? 0))
      .slice(0, 10),
    recentPayments,
    receiptWarnings,
    feeMapSize: feeMap.size
  };
}

function totalBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((map, row) => {
    const name = String(row[key]);
    map.set(name, (map.get(name) ?? 0) + Number(row.amountPaid ?? 0));
    return map;
  }, new Map<string, number>());
}
