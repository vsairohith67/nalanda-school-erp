import type { Prisma } from "@prisma/client";
import { NextResponse, type NextResponse as NextResponseType } from "next/server";
import { classSectionLabel } from "@/lib/collection-report";
import { schoolDateKey } from "@/lib/format";
import { sanitizedPaymentAuditJson } from "@/lib/receipt";

export const FINANCE_EXPORT_ROW_LIMIT = 2_000;
export const REMINDER_EXPORT_ROW_LIMIT = 1_000;
export const FINANCE_EXPORT_MAX_DAYS = 366;

export const FINANCE_STUDENT_SELECT = {
  admissionNo: true,
  studentName: true,
  className: true,
  section: true,
  academicYear: true,
  status: true
} satisfies Prisma.StudentSelect;

export const financeStudentCalculationSelect = {
  ...FINANCE_STUDENT_SELECT,
  studentType: true,
  discountPercent: true,
  deletedAt: true
} satisfies Prisma.StudentSelect;

export type FinanceStudentLookup = Prisma.StudentGetPayload<{
  select: typeof FINANCE_STUDENT_SELECT;
}>;

export const FINANCE_PAYMENT_SELECT = {
  id: true,
  date: true,
  receiptNo: true,
  admissionNo: true,
  studentName: true,
  className: true,
  section: true,
  amountPaid: true,
  paymentMode: true,
  receivedAccount: true,
  transactionRefNo: true,
  feeType: true,
  termHint: true,
  isCancelled: true,
  cancelledAt: true,
  cancellationReason: true,
  updatedAt: true
} satisfies Prisma.PaymentSelect;

export type FinancePaymentRow = Prisma.PaymentGetPayload<{
  select: typeof FINANCE_PAYMENT_SELECT;
}>;

export type PendingDuesFinanceSource = {
  academicYear: string;
  status: string;
  admissionNo: string;
  studentName: string;
  className: string;
  section: string | null;
  annualFee: number;
  discountPercent: number;
  annualFeeAfterDiscount: number;
  totalCurrentYearPaid: number;
  term1Paid: number;
  term1Due: number;
  term2Paid: number;
  term2Due: number;
  term3Paid: number;
  term3Due: number;
  term4Paid: number;
  term4Due: number;
  totalPending: number;
  dueStatus: string;
};

export function financeStudentLookup(row: FinanceStudentLookup) {
  return {
    admissionNo: row.admissionNo,
    studentName: row.studentName,
    className: row.className,
    section: row.section,
    academicYear: row.academicYear,
    status: row.status
  };
}

export function paymentManagementResponse(row: FinancePaymentRow) {
  return {
    id: row.id,
    date: row.date,
    receiptNo: row.receiptNo,
    admissionNo: row.admissionNo,
    studentName: row.studentName,
    className: row.className,
    section: row.section,
    amountPaid: row.amountPaid,
    paymentMode: row.paymentMode,
    receivedAccount: row.receivedAccount,
    transactionRefNo: row.transactionRefNo,
    feeType: row.feeType,
    termHint: row.termHint,
    isCancelled: row.isCancelled,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    updatedAt: row.updatedAt
  };
}

export function ledgerPaymentResponse(row: FinancePaymentRow) {
  return {
    date: row.date,
    receiptNo: row.receiptNo,
    admissionNo: row.admissionNo,
    amountPaid: row.amountPaid,
    paymentMode: row.paymentMode,
    receivedAccount: row.receivedAccount,
    transactionRefNo: row.transactionRefNo,
    feeType: row.feeType,
    termHint: row.termHint,
    isCancelled: row.isCancelled,
    cancelledAt: row.cancelledAt
  };
}

export function collectionPaymentResponse(row: FinancePaymentRow) {
  return {
    date: row.date,
    receiptNo: row.receiptNo,
    admissionNo: row.admissionNo,
    studentName: row.studentName,
    className: row.className,
    section: row.section,
    amountPaid: row.amountPaid,
    paymentMode: row.paymentMode,
    receivedAccount: row.receivedAccount,
    transactionRefNo: row.transactionRefNo,
    feeType: row.feeType,
    termHint: row.termHint
  };
}

export function pendingDuesFinanceRow(row: PendingDuesFinanceSource | Record<string, unknown>) {
  return {
    academicYear: stringValue(row.academicYear),
    status: stringValue(row.status),
    admissionNo: stringValue(row.admissionNo),
    studentName: stringValue(row.studentName),
    className: stringValue(row.className),
    section: nullableString(row.section),
    annualFee: numericValue(row.annualFee),
    discountPercent: numericValue(row.discountPercent),
    annualFeeAfterDiscount: numericValue(row.annualFeeAfterDiscount),
    totalCurrentYearPaid: numericValue(row.totalCurrentYearPaid),
    term1Paid: numericValue(row.term1Paid),
    term1Due: numericValue(row.term1Due),
    term2Paid: numericValue(row.term2Paid),
    term2Due: numericValue(row.term2Due),
    term3Paid: numericValue(row.term3Paid),
    term3Due: numericValue(row.term3Due),
    term4Paid: numericValue(row.term4Paid),
    term4Due: numericValue(row.term4Due),
    totalPending: numericValue(row.totalPending),
    dueStatus: stringValue(row.dueStatus)
  };
}

export function financeStudentIdentity(row: Record<string, unknown>) {
  return {
    admissionNo: stringValue(row.admissionNo),
    studentName: stringValue(row.studentName),
    className: stringValue(row.className),
    section: nullableString(row.section),
    academicYear: stringValue(row.academicYear),
    status: stringValue(row.status)
  };
}

export function ledgerStudentForRole(row: Record<string, unknown>, role: string) {
  if (role === "ACCOUNTANT" || role === "VIEWER") return financeStudentIdentity(row);
  return {
    ...financeStudentIdentity(row),
    fatherName: nullableString(row.fatherName),
    motherName: nullableString(row.motherName),
    phone1: nullableString(row.phone1),
    phone2: nullableString(row.phone2),
    whatsappNumber: nullableString(row.whatsappNumber)
  };
}

export function pendingDuesViewerAggregate(rows: PendingDuesFinanceSource[]) {
  const grouped = new Map<string, {
    academicYear: string;
    className: string;
    section: string | null;
    students: number;
    fullyPaid: number;
    totalAfterDiscount: number;
    totalPaid: number;
    totalPending: number;
  }>();
  for (const row of rows) {
    const key = `${row.academicYear}|${row.className}|${row.section ?? ""}`;
    const current = grouped.get(key) ?? {
      academicYear: row.academicYear,
      className: row.className,
      section: row.section,
      students: 0,
      fullyPaid: 0,
      totalAfterDiscount: 0,
      totalPaid: 0,
      totalPending: 0
    };
    current.students += 1;
    if (row.totalPending <= 0) current.fullyPaid += 1;
    current.totalAfterDiscount += row.annualFeeAfterDiscount;
    current.totalPaid += row.totalCurrentYearPaid;
    current.totalPending += row.totalPending;
    grouped.set(key, current);
  }
  return Array.from(grouped.values()).sort((a, b) =>
    `${a.academicYear}|${a.className}|${a.section ?? ""}`.localeCompare(
      `${b.academicYear}|${b.className}|${b.section ?? ""}`
    )
  );
}

export function sanitizePaymentAuditJson(value: string | null) {
  return sanitizedPaymentAuditJson(value);
}

export function privateFinanceJson(
  body: unknown,
  init: ResponseInit = {}
): NextResponseType {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "private, no-store");
  response.headers.set("pragma", "no-cache");
  response.headers.set("x-content-type-options", "nosniff");
  return response;
}

export function aggregatePendingDues(rows: PendingDuesFinanceSource[]) {
  const byClass = Array.from(
    rows.reduce((map, row) => {
      const label = classSectionLabel(row.className, row.section);
      const current = map.get(label) ?? {
        classSection: label,
        studentCount: 0,
        annualFeeAfterDiscount: 0,
        totalPaid: 0,
        totalPending: 0
      };
      current.studentCount += 1;
      current.annualFeeAfterDiscount += row.annualFeeAfterDiscount;
      current.totalPaid += row.totalCurrentYearPaid;
      current.totalPending += row.totalPending;
      map.set(label, current);
      return map;
    }, new Map<string, {
      classSection: string;
      studentCount: number;
      annualFeeAfterDiscount: number;
      totalPaid: number;
      totalPending: number;
    }>())
  )
    .map(([, value]) => value)
    .sort((a, b) => a.classSection.localeCompare(b.classSection));

  return {
    aggregateOnly: true as const,
    summary: {
      studentCount: rows.length,
      annualFeeAfterDiscount: rows.reduce((sum, row) => sum + row.annualFeeAfterDiscount, 0),
      totalPaid: rows.reduce((sum, row) => sum + row.totalCurrentYearPaid, 0),
      totalPending: rows.reduce((sum, row) => sum + row.totalPending, 0)
    },
    byClass
  };
}

export function studentMasterExportRow(row: FinanceStudentLookup & {
  rollNo?: string | null;
  studentType?: string | null;
}) {
  return {
    academicYear: row.academicYear,
    admissionNo: row.admissionNo,
    studentName: row.studentName,
    className: row.className,
    section: row.section,
    rollNo: row.rollNo ?? null,
    status: row.status,
    studentType: row.studentType ?? null
  };
}

export function paymentExportRow(
  row: Pick<FinancePaymentRow,
    "date" | "receiptNo" | "admissionNo" | "studentName" | "className" | "section" |
    "amountPaid" | "paymentMode" | "receivedAccount" | "transactionRefNo" | "feeType" |
    "termHint" | "isCancelled">,
  effectiveReceiptStatus: "ACTIVE" | "CANCELLED" | "INCONSISTENT"
) {
  return {
    date: row.date.toISOString().slice(0, 10),
    receiptNo: row.receiptNo,
    admissionNo: row.admissionNo,
    studentName: row.studentName,
    className: row.className,
    section: row.section,
    amount: row.amountPaid,
    paymentMode: row.paymentMode,
    receivedAccount: row.receivedAccount,
    transactionReference: row.transactionRefNo,
    feeType: row.feeType,
    term: row.termHint,
    componentStatus: row.isCancelled ? "CANCELLED" : "ACTIVE",
    effectiveReceiptStatus
  };
}

export function dailyCollectionExportRow(
  row: Pick<FinancePaymentRow,
    "date" | "receiptNo" | "admissionNo" | "studentName" | "className" | "section" |
    "amountPaid" | "paymentMode" | "receivedAccount" | "transactionRefNo" | "feeType" | "termHint">
) {
  return {
    date: row.date.toISOString().slice(0, 10),
    receiptNo: row.receiptNo,
    admissionNo: row.admissionNo,
    studentName: row.studentName,
    className: row.className,
    section: row.section,
    amount: row.amountPaid,
    paymentMode: row.paymentMode,
    receivedAccount: row.receivedAccount,
    transactionReference: row.transactionRefNo,
    feeType: row.feeType,
    term: row.termHint,
    effectiveReceiptStatus: "ACTIVE"
  };
}

export function pendingDuesExportRow(row: PendingDuesFinanceSource) {
  return {
    academicYear: row.academicYear,
    admissionNo: row.admissionNo,
    studentName: row.studentName,
    className: row.className,
    section: row.section,
    studentStatus: row.status,
    annualFee: row.annualFee,
    discountPercent: row.discountPercent,
    feeAfterDiscount: row.annualFeeAfterDiscount,
    totalPaid: row.totalCurrentYearPaid,
    term1Due: row.term1Due,
    term2Due: row.term2Due,
    term3Due: row.term3Due,
    term4Due: row.term4Due,
    totalPending: row.totalPending,
    dueStatus: row.dueStatus
  };
}

export function parseFinanceDateRange(
  from: string | null,
  to: string | null,
  options: { defaultDays?: number; maxDays?: number; today?: Date } = {}
) {
  const todayText = schoolDateKey(options.today ?? new Date());
  const endText = to || todayText;
  const end = parseDate(endText, "to");
  const defaultDays = options.defaultDays ?? 31;
  const startText = from || dateDaysBefore(end, defaultDays - 1);
  const start = parseDate(startText, "from");
  if (start > end) throw new Error("Export start date must not be after the end date");
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const maxDays = options.maxDays ?? FINANCE_EXPORT_MAX_DAYS;
  if (days > maxDays) throw new Error(`Export date range must be ${maxDays} days or fewer`);
  const endExclusive = new Date(end);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    days,
    where: { gte: start, lt: endExclusive }
  };
}

export function datedFinanceExportFilename(kind: string, from: string, to: string) {
  const safeKind = kind.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return `${safeKind}-${from}-to-${to}.csv`;
}

function parseDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Export ${label} date must use YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Export ${label} date is invalid`);
  }
  return date;
}

function dateDaysBefore(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy.toISOString().slice(0, 10);
}

function stringValue(value: unknown) {
  return String(value ?? "").trim();
}

function nullableString(value: unknown) {
  const result = stringValue(value);
  return result || null;
}

function numericValue(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}
