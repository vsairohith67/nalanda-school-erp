import type { PrismaClient } from "@prisma/client";
import { parseDraft, reportCardValidationGaps } from "@/lib/report-cards";

export async function buildReportCardReport(client: PrismaClient, filters: { academicYear?: string; className?: string; section?: string; status?: string } = {}) {
  const cards = await client.studentReportCard.findMany({ where: { ...(filters.academicYear ? { academicYear: filters.academicYear } : {}), ...(filters.className ? { className: filters.className } : {}), ...(filters.section ? { section: filters.section } : {}), ...(filters.status ? { status: filters.status } : {}) }, include: { student: { select: { studentName: true, admissionNo: true } }, batch: { select: { batchNumber: true, title: true, status: true } } }, orderBy: [{ academicYear: "desc" }, { className: "asc" }, { section: "asc" }, { student: { studentName: "asc" } }] });
  const rows = cards.map((card) => { const draft = parseDraft(card); const gaps = reportCardValidationGaps(card, draft); return { batchNumber: card.batch.batchNumber, batchTitle: card.batch.title, academicYear: card.academicYear, className: card.className, section: card.section ?? "", admissionNumber: card.student.admissionNo, studentName: card.student.studentName, reportType: card.reportType, cardStatus: card.status, batchStatus: card.batch.status, version: card.currentVersionNumber, supersededVersions: Math.max(0, card.currentVersionNumber - 1), finalGrade: card.finalGrade ?? draft?.calculation?.grade?.code ?? draft?.final?.grade ?? "", result: draft?.calculation?.result ?? "", validationGapCount: gaps.length, attendanceGap: draft?.attendanceSource?.status === "INCOMPLETE_SOURCE" || (Array.isArray(draft?.attendance) && draft.attendance.some((item: any) => !item.workingDays)) ? "YES" : "NO", growthGap: card.reportType === "KG_RUBRIC" && ["I","III","V"].some((period) => draft?.growth?.[period]?.heightCm == null || draft?.growth?.[period]?.weightKg == null) ? "YES" : "NO", kgEvaluationCompletion: card.reportType === "KG_RUBRIC" ? String(5 - new Set(gaps.filter((gap) => /^Evaluation [IVX]+:/.test(gap)).map((gap) => gap.split(":")[0])).size) : "" }; });
  const count = (status: string) => rows.filter((row) => row.cardStatus === status).length;
  const gradeDistribution = rows.reduce((map, row) => { if (row.finalGrade) map[row.finalGrade] = (map[row.finalGrade] ?? 0) + 1; return map; }, {} as Record<string, number>);
  const resultDistribution = rows.reduce((map, row) => { if (row.result) map[row.result] = (map[row.result] ?? 0) + 1; return map; }, {} as Record<string, number>);
  return { summary: { total: rows.length, pendingEntry: rows.filter((row) => row.cardStatus === "DRAFT").length, pendingSubmission: rows.filter((row) => row.cardStatus === "READY_FOR_REVIEW" && row.batchStatus === "OPEN_FOR_ENTRY").length, pendingApproval: rows.filter((row) => row.cardStatus === "READY_FOR_REVIEW" && row.batchStatus === "SUBMITTED").length, pendingIssue: rows.filter((row) => row.cardStatus === "APPROVED").length, approvedNotIssued: count("APPROVED"), issued: count("ISSUED"), cancelled: count("CANCELLED"), corrected: rows.filter((row) => row.version > 1).length, supersededVersions: rows.reduce((sum, row) => sum + row.supersededVersions, 0), missingMarksBlockingIssue: rows.filter((row) => row.reportType === "MARK_BASED" && row.validationGapCount > 0).length, kgIncomplete: rows.filter((row) => row.reportType === "KG_RUBRIC" && row.validationGapCount > 0).length, attendanceSnapshotGaps: rows.filter((row) => row.attendanceGap === "YES").length, growthSnapshotGaps: rows.filter((row) => row.growthGap === "YES").length, gradeDistribution, resultDistribution }, rows };
}

export function maskReportCardReportForViewer<T extends Awaited<ReturnType<typeof buildReportCardReport>>>(report: T): T {
  return {
    ...report,
    rows: report.rows.map((row) => ({
      ...row,
      studentName: maskName(row.studentName),
      admissionNumber: maskIdentifier(row.admissionNumber)
    }))
  } as T;
}

export function reportCardRowsCsv(rows: Array<Record<string, unknown>>) {
  const headers = ["Batch Number", "Batch Title", "Academic Year", "Class", "Section", "Admission Number", "Student Name", "Report Type", "Card Status", "Batch Status", "Version", "Superseded Versions", "Final Grade", "Result", "Validation Gap Count", "Attendance Gap", "Growth Gap", "KG Evaluations Complete"];
  const keys = ["batchNumber", "batchTitle", "academicYear", "className", "section", "admissionNumber", "studentName", "reportType", "cardStatus", "batchStatus", "version", "supersededVersions", "finalGrade", "result", "validationGapCount", "attendanceGap", "growthGap", "kgEvaluationCompletion"];
  return [headers, ...rows.map((row) => keys.map((key) => formulaSafe(row[key])))].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
function formulaSafe(value: unknown) { const text = String(value ?? ""); return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; }
function csvCell(value: unknown) { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function maskName(value: string) { return value.trim().split(/\s+/).map((part) => part ? `${part[0]}***` : "").join(" "); }
function maskIdentifier(value: string) { const text = String(value ?? ""); return text.length <= 4 ? "****" : `${"*".repeat(Math.min(8, text.length - 4))}${text.slice(-4)}`; }
