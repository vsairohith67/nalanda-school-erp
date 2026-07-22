import type { PrismaClient } from "@prisma/client";
import { publicStockRecord } from "@/lib/library-stock-verification";

export async function loadLibraryStockReports(client: PrismaClient, filters: { academicYear?: string; status?: string } = {}, masked = false) {
  const sessions = await client.libraryStockVerificationSession.findMany({
    where: { ...(filters.academicYear ? { academicYear: filters.academicYear } : {}), ...(filters.status ? { status: filters.status } : {}) },
    include: {
      records: { orderBy: { expectedAccessionNumberSnapshot: "asc" } },
      scanEvents: { orderBy: { scannedAt: "desc" }, take: 100, select: { normalizedInput: true, scanMethod: true, resultType: true, scannedAt: true, notes: true } }
    }, orderBy: [{ verificationDate: "desc" }, { sessionNumber: "desc" }]
  });
  const totals = sessions.reduce((sum, row) => ({ sessions: sum.sessions + 1, expected: sum.expected + row.expectedCopyCount, verified: sum.verified + row.verifiedCopyCount, missing: sum.missing + row.missingCount, unresolved: sum.unresolved + row.unresolvedCount, corrections: sum.corrections + row.records.filter((r) => r.resolutionStatus === "APPLIED").length }), { sessions: 0, expected: 0, verified: 0, missing: 0, unresolved: 0, corrections: 0 });
  return { totals, sessions: sessions.map((row) => ({
    id: masked ? undefined : row.id,
    sessionNumber: row.sessionNumber, title: row.title, academicYear: row.academicYear, verificationDate: row.verificationDate,
    scopeType: row.scopeType, scopeLabel: row.shelfCodeFilter ?? row.categoryFilter ?? row.subjectFilter ?? (row.titleIdFilter ? "Selected title" : "All non-withdrawn copies"), status: row.status,
    expectedCopyCount: row.expectedCopyCount, verifiedCopyCount: row.verifiedCopyCount, presentCount: row.presentCount, issuedOffsiteCount: row.issuedOffsiteCount,
    knownRepairCount: row.knownRepairCount, missingCount: row.missingCount, misShelvedCount: row.misShelvedCount, damagedCount: row.damagedCount,
    unexpectedCount: row.unexpectedCount, unresolvedCount: row.unresolvedCount,
    records: row.records.map((record) => publicStockRecord(record, masked)),
    scanEvents: row.scanEvents.map((event) => ({ normalizedInput: event.normalizedInput, scanMethod: event.scanMethod, resultType: event.resultType, scannedAt: event.scannedAt, notes: masked ? null : event.notes }))
  })) };
}

export function stockObservationLabel(record: { observationStatus: string; expectedStatus?: string | null }) {
  if (record.observationStatus === "MISSING" && record.expectedStatus === "AVAILABLE") return "NEWLY_MISSING_PROPOSAL";
  if (record.observationStatus === "NEEDS_REVIEW" && record.expectedStatus === "MISSING") return "EXISTING_MISSING";
  return record.observationStatus;
}

function formulaSafe(value: unknown) {
  const raw = value instanceof Date ? value.toISOString() : String(value ?? "");
  const protectedValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function libraryStockCsv(report: Awaited<ReturnType<typeof loadLibraryStockReports>>) {
  const header = ["Session Number", "Academic Year", "Verification Date", "Session Status", "Scope", "Accession Number", "Barcode", "Title", "Expected Shelf", "Expected Status", "Expected Condition", "Loan Status", "Borrower Type", "Due Date", "Observation", "Observed Shelf", "Observed Condition", "Resolution", "Correction Applied"];
  const rows = report.sessions.flatMap((session) => session.records.map((record) => [session.sessionNumber, session.academicYear, session.verificationDate, session.status, session.scopeType, record.accessionNumber, record.barcodeValue, record.title, record.expectedShelfCode, record.expectedStatus, record.expectedCondition, record.expectedLoanStatus, record.borrowerType, record.dueDate, record.observationStatus, record.observedShelfCode, record.observedCondition, record.resolutionStatus, record.correctionApplied ? "YES" : "NO"]));
  return [header, ...rows].map((row) => row.map(formulaSafe).join(",")).join("\r\n") + "\r\n";
}

export function stockReportFilename(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `library-stock-verification-${part("year")}-${part("month")}-${part("day")}.csv`;
}
