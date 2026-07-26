import { schoolDateKey } from "@/lib/format";

const STAGING_NOTICE = "Reviewed OCR staging export. This file does not prove that a Payment was posted.";

export async function feeRegisterOcrReportData(client: any) {
  const batches = await client.feeRegisterOcrBatch.findMany({
    include: { profile: true, pages: { include: { rows: true } }, postingRuns: true },
    orderBy: { createdAt: "desc" }
  });
  const pages = batches.flatMap((batch: any) => batch.pages);
  const rows = pages.flatMap((page: any) => page.rows);
  const countBy = (values: any[], key: string) => Object.fromEntries([...new Set(values.map((value) => value[key] ?? "UNKNOWN"))].sort().map((value) => [value, values.filter((item) => (item[key] ?? "UNKNOWN") === value).length]));
  const confidence = rows.flatMap((row: any) => {
    try { return Object.values(JSON.parse(row.fieldConfidenceJson)); } catch { return []; }
  });
  const postedLinks = rows.filter((row: any) => row.status === "POSTED");
  const linkedPostedRows = postedLinks.filter((row: any) => row.postedPaymentId);
  return {
    generatedAt: new Date().toISOString(),
    totals: {
      batches: batches.length, pages: pages.length, rows: rows.length,
      pagesPurged: pages.filter((page: any) => page.status === "PURGED").length,
      pagesMissing: pages.filter((page: any) => page.status === "MISSING_SOURCE").length,
      verifiedRows: rows.filter((row: any) => row.status === "VERIFIED").length,
      rejectedRows: rows.filter((row: any) => row.status === "REJECTED").length,
      unresolvedRows: rows.filter((row: any) => ["EXTRACTED", "NEEDS_REVIEW", "MATCHED"].includes(row.status)).length,
      manualRows: pages
        .filter((page: any) => page.providerKind === "MANUAL")
        .reduce((sum: number, page: any) => sum + page.rows.length, 0),
      verifiedAmountMinor: rows.filter((row: any) => row.status === "VERIFIED").reduce((sum: number, row: any) => sum + (row.amountMinor ?? 0), 0),
      postedAmountMinor: rows.filter((row: any) => row.status === "POSTED").reduce((sum: number, row: any) => sum + (row.amountMinor ?? 0), 0),
      postingFailures: rows.filter((row: any) => row.status === "POSTING_FAILED").length,
      unlinkedPostedRows: postedLinks.filter((row: any) => !row.postedPaymentId).length,
      duplicatePaymentLinks: linkedPostedRows.length - new Set(linkedPostedRows.map((row: any) => row.postedPaymentId)).size
    },
    batchesByStatus: countBy(batches, "status"),
    pagesByStatus: countBy(pages, "status"),
    rowsByStatus: countBy(rows, "status"),
    duplicateClassifications: countBy(rows, "duplicateClassification"),
    matchingMethods: countBy(rows, "matchingMethod"),
    fieldConfidence: Object.fromEntries(["HIGH", "MEDIUM", "LOW", "MISSING"].map((level) => [level, confidence.filter((value: unknown) => value === level).length])),
    providerModes: countBy(batches.map((batch: any) => ({ providerKind: batch.profile.providerKind })), "providerKind"),
    batches: batches.map((batch: any) => ({
      batchNumber: batch.batchNumber, academicYear: batch.academicYear, registerName: batch.registerName,
      status: batch.status, providerKind: batch.profile.providerKind, pages: batch.pages.length,
      rows: batch.pages.reduce((sum: number, page: any) => sum + page.rows.length, 0),
      verifiedAmountMinor: batch.totalVerifiedAmountMinor, postedAmountMinor: batch.totalPostedAmountMinor,
      paymentPostingEnabled: batch.profile.paymentPostingEnabled,
      createdAt: batch.createdAt
    }))
  };
}

export function feeRegisterOcrAggregateCsv(report: Awaited<ReturnType<typeof feeRegisterOcrReportData>>) {
  const headers = ["Batch Number", "Academic Year", "Register", "Status", "Provider", "Pages", "Rows", "Verified Amount", "Posted Amount", "Posting Enabled"];
  return [headers, ...report.batches.map((batch: any) => [
    batch.batchNumber, batch.academicYear, batch.registerName, batch.status, batch.providerKind,
    batch.pages, batch.rows, (batch.verifiedAmountMinor / 100).toFixed(2), (batch.postedAmountMinor / 100).toFixed(2),
    batch.paymentPostingEnabled ? "Yes" : "No"
  ])].map(csvRow).join("\r\n") + "\r\n";
}

export async function reviewedOcrStagingCsv(client: any, batchId: string) {
  const batch = await client.feeRegisterOcrBatch.findUnique({
    where: { id: batchId },
    include: { pages: { include: { rows: true }, orderBy: { pageNumber: "asc" } } }
  });
  if (!batch) throw new Error("OCR batch not found");
  const students = await client.student.findMany({
    where: { id: { in: batch.pages.flatMap((page: any) => page.rows.map((row: any) => row.matchedStudentId).filter(Boolean)) } },
    select: { id: true, admissionNo: true }
  });
  const admissions = new Map(students.map((student: any) => [student.id, student.admissionNo]));
  const headers = ["Notice", "Batch Number", "Page", "Row", "Admission Number", "Payment Date", "Amount", "Payment Mode", "Received Account", "Academic Term", "Handwritten Reference", "Duplicate Status", "Review Status"];
  const rows = batch.pages.flatMap((page: any) => page.rows.map((row: any) => [
    STAGING_NOTICE, batch.batchNumber, page.pageNumber, row.rowNumber, admissions.get(row.matchedStudentId) ?? "",
    row.paymentDate?.toISOString().slice(0, 10) ?? "", row.amountMinor == null ? "" : (row.amountMinor / 100).toFixed(2),
    row.paymentMode ?? "", row.receivedAccount ?? "", row.academicTerm ?? "", row.handwrittenReceiptReference ?? "",
    row.duplicateClassification, row.status
  ]));
  return [headers, ...rows].map(csvRow).join("\r\n") + "\r\n";
}

export function feeRegisterOcrReportFilename(now = new Date()) {
  return `fee-register-ocr-report-${schoolDateKey(now)}.csv`;
}

export function reviewedOcrStagingFilename(batchNumber: string, now = new Date()) {
  return `reviewed-ocr-staging-${safeFilename(batchNumber)}-${schoolDateKey(now)}.csv`;
}

function csvRow(row: unknown[]) { return row.map(csvCell).join(","); }
function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll("\"", "\"\"")}"`;
}
function safeFilename(value: string) { return value.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80); }
