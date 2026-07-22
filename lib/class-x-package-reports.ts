import { Prisma } from "@prisma/client";
import { csvCell } from "@/lib/expenses";

export const CLASS_X_REPORT_ROW_LIMIT = 500;

export function classXPackageReport(rows: any[]) {
  const count = (predicate: (row: any) => boolean) => rows.filter(predicate).length;
  const charges = rows.map((row) => row.charge).filter(Boolean);
  const sum = (values: any[]) => values.reduce((total, value) => total.add(value), new Prisma.Decimal(0)).toFixed(2);
  const completed = rows.filter((row) => row.completedAt);
  const turnaroundDays = completed.map((row) => Math.max(0, Math.round((row.completedAt.getTime() - row.createdAt.getTime()) / 86_400_000)));
  return {
    total: rows.length,
    byStatus: Object.fromEntries([...new Set(rows.map((row) => row.status))].map((status) => [status, count((row) => row.status === status)])),
    byAcademicYear: Object.fromEntries([...new Set(rows.map((row) => row.academicYear))].map((year) => [year, count((row) => row.academicYear === year)])),
    parentRequests: count((row) => row.requestSource === "PARENT_PORTAL"), internalRequests: count((row) => row.requestSource === "INTERNAL"),
    missingSchoolCertificates: rows.flatMap((row) => row.items).filter((item) => item.issuerType === "SCHOOL" && item.required && !["READY_FOR_HANDOVER", "HANDED_OVER"].includes(item.status)).length,
    boardAwaitingReceipt: rows.flatMap((row) => row.items).filter((item) => item.issuerType !== "SCHOOL" && ["REQUESTED", "AWAITING_BOARD"].includes(item.status)).length,
    boardAwaitingVerification: rows.flatMap((row) => row.items).filter((item) => item.issuerType !== "SCHOOL" && ["RECEIVED", "UNDER_VERIFICATION"].includes(item.status)).length,
    migrationAwaiting: rows.flatMap((row) => row.items).filter((item) => item.itemType === "BOARD_MIGRATION_CERTIFICATE" && ["REQUESTED", "AWAITING_BOARD"].includes(item.status)).length,
    readyForHandoverItems: rows.flatMap((row) => row.items).filter((item) => item.status === "READY_FOR_HANDOVER").length,
    partialHandovers: count((row) => row.status === "PARTIALLY_HANDED_OVER"), completed: count((row) => row.status === "COMPLETED"), cancelled: count((row) => row.status === "CANCELLED"),
    paymentPending: charges.filter((row) => ["PENDING", "APPROVED_FOR_COLLECTION"].includes(row.status)).length,
    paid: charges.filter((row) => row.status === "PAID").length, waived: charges.filter((row) => row.status === "WAIVED").length, notRequired: charges.filter((row) => row.status === "NOT_REQUIRED").length,
    originalChargeTotal: sum(charges.map((row) => row.originalAmount)), paidTotal: sum(charges.map((row) => row.paidAmount)),
    linkedMiscIncomeTotal: sum(charges.filter((row) => row.linkedMiscIncomeReceipt?.status === "ACTIVE").map((row) => row.linkedMiscIncomeReceipt.netAmount)),
    mismatchCount: charges.filter((row) => row.status === "PAID" && (!row.linkedMiscIncomeReceipt || !row.paidAmount.eq(row.linkedMiscIncomeReceipt.netAmount))).length,
    averageTurnaroundDays: turnaroundDays.length ? Number((turnaroundDays.reduce((a, b) => a + b, 0) / turnaroundDays.length).toFixed(1)) : 0,
    lifecycleWarnings: rows.filter((row) => { try { return JSON.parse(row.eligibilitySnapshotJson).student?.lifecycleStatus !== "Active"; } catch { return true; } }).length
  };
}

export function classXPackageCsv(rows: any[]) {
  const header = ["Package Number", "Academic Year", "Student Name", "Admission Number", "Request Source", "Package Status", "Payment Status", "Required Items", "Ready Items", "Handed Over Items", "Created Date", "Completed Date"];
  const data = rows.map((row) => [row.packageNumber, row.academicYear, row.student.studentName, row.student.admissionNo, row.requestSource, row.status, row.charge?.status ?? "NOT_REQUIRED", row.totalRequiredItems, row.readyItems, row.handedOverItems, row.createdAt.toISOString().slice(0, 10), row.completedAt?.toISOString().slice(0, 10) ?? ""]);
  return [header, ...data].map((line) => line.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
