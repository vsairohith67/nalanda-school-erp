import * as XLSX from "xlsx";
import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { loadTeacherMarksWorkspace, parseMarkRow, saveAssignedMarkDraft, ExamMarksError } from "@/lib/exam-marks";
import { requireExactExamMarkAssignment } from "@/lib/exam-marks-scope";
import { assertNoDelegatedFamilyConflict } from "@/lib/academic-integrity";
import { parseCsv, GOVERNED_IMPORT_COLUMNS } from "@/lib/marks-import-csv";
export { GOVERNED_IMPORT_COLUMNS } from "@/lib/marks-import-csv";
import { csvCell } from "@/lib/expenses";
import { importDigest, issueImportReceipt, requireImportReceipt } from "@/lib/import-preview-receipt";
export const GOVERNED_IMPORT_VERSION = "governed-draft-v1";
export async function governedImportContext(client: PrismaClient, actor: AuthUser, assignmentId: string) {
  const exact = await requireExactExamMarkAssignment(client, actor, assignmentId, { permission: "ENTER_ASSIGNED_EXAM_MARKS" });
  const workspace = await loadTeacherMarksWorkspace(client, actor, assignmentId);
  const selected = workspace.selectedWorkspace;
  const component = selected?.components.find((c: any) => c.assignment.id === assignmentId);
  if (!selected || !component) throw new ExamMarksError("No eligible governed assignment.");
  if (!exact.schemeVersion.frozenAt || exact.schemeVersion.status !== "ACTIVE") throw new ExamMarksError("A current frozen scheme is required.");
  await assertNoDelegatedFamilyConflict(client, actor, selected.students.map((student: any) => student.studentId), exact._marksAuthority, `governed-import-download:${assignmentId}`);
  return { selected, component, exact };
}
function rowBinding(actor: AuthUser, assignment: unknown, row: Record<string, string>) {
  return { actor: actor.id, role: actor.role, assignment, templateVersion: row.templateVersion, studentId: row.studentId, admissionNumber: row.admissionNumber, sheetVersion: row.sheetVersion, versionNumber: row.versionNumber, rowVersion: row.rowVersion };
}
export function governedImportTemplate(actor: AuthUser, context: Awaited<ReturnType<typeof governedImportContext>>) {
  const { component, selected } = context;
  if (selected.students.length > 200) throw new ExamMarksError("This component exceeds the existing 200-row draft-save limit.");
  return [GOVERNED_IMPORT_COLUMNS.join(","), ...selected.students.map((student: any) => {
    const entry = component.entries.find((e: any) => e.studentId === student.studentId);
    const row: Record<string, string> = { templateVersion: GOVERNED_IMPORT_VERSION, studentId: student.studentId, admissionNumber: student.admissionNo, sheetVersion: String(component.sheet?.version ?? 1), versionNumber: String(component.sheet?.versionNumber ?? 1), rowVersion: String(entry?.rowVersion ?? 1), marksObtained: entry?.marksObtained ?? "", entryState: entry?.entryState ?? "NOT_ENTERED", remarks: entry?.remarks ?? "" };
    row.contextReceipt = issueImportReceipt(rowBinding(actor, component.assignment, row));
    return GOVERNED_IMPORT_COLUMNS.map(k => csvCell(row[k])).join(",");
  })].join("\r\n") + "\r\n";
}
export async function validateGovernedImport(client: PrismaClient, actor: AuthUser, assignmentId: string, csv: unknown, checkCurrentVersions = true) {
  if (typeof csv !== "string" || csv.length > 400_000) throw new ExamMarksError("Use a governed CSV of at most 400 KB.");
  const table = parseCsv(csv.replace(/^\uFEFF/, ""));
  if (table.shift()?.join("|") !== GOVERNED_IMPORT_COLUMNS.join("|")) throw new ExamMarksError("Use the exact governed draft v1 template. Legacy sheets cannot be imported here.");
  if (!table.length || table.length > 200 || table.some(r => r.length !== GOVERNED_IMPORT_COLUMNS.length)) throw new ExamMarksError("Use 1–200 rows and exactly the template columns.");
  const context = await governedImportContext(client, actor, assignmentId);
  const { component, selected } = context;
  if (component.sheet && !["NOT_STARTED", "DRAFT", "VALIDATION_FAILED", "READY_TO_SUBMIT", "REOPENED"].includes(component.sheet.status)) throw new ExamMarksError("Governed sheet is read-only.");
  const seen = new Set<string>();
  let versions: { sheet: number; history: number } | null = null;
  const rows = table.map(values => {
    const row = Object.fromEntries(GOVERNED_IMPORT_COLUMNS.map((k, i) => [k, values[i]]));
    if (row.templateVersion !== GOVERNED_IMPORT_VERSION) throw new ExamMarksError("Unsupported governed template version.");
    requireImportReceipt(row.contextReceipt, rowBinding(actor, component.assignment, row));
    const student = selected.students.find((s: any) => s.studentId === row.studentId && s.admissionNo === row.admissionNumber);
    if (!student || seen.has(row.studentId)) throw new ExamMarksError("Duplicate or ineligible roster reference.");
    seen.add(row.studentId);
    const sheet = Number(row.sheetVersion), history = Number(row.versionNumber);
    if (!Number.isSafeInteger(sheet) || sheet < 1 || !Number.isSafeInteger(history) || history < 1 || (versions && (versions.sheet !== sheet || versions.history !== history))) throw new ExamMarksError("Mixed or invalid sheet versions.");
    versions = { sheet, history };
    const parsed = parseMarkRow({ studentId: row.studentId, entryState: row.entryState, marksObtained: row.marksObtained, remarks: row.remarks, expectedRowVersion: Number(row.rowVersion) }, context.exact.component.maximumMarks, context.exact.schemeVersion.markDecimalPlaces);
    if (checkCurrentVersions && ((component.sheet?.version ?? 1) !== sheet || (component.sheet?.versionNumber ?? 1) !== history || component.entries.find((e: any) => e.studentId === row.studentId)?.rowVersion !== parsed.expectedRowVersion)) throw new ExamMarksError("Template or row is stale. Download the current template.");
    return { studentId: parsed.studentId, entryState: parsed.entryState, marksObtained: parsed.marksObtained?.toString() ?? null, remarks: parsed.remarks, expectedRowVersion: parsed.expectedRowVersion };
  });
  await assertNoDelegatedFamilyConflict(client, actor, rows.map(r => r.studentId), context.exact._marksAuthority, `governed-import:${assignmentId}`);
  const binding = { actor: actor.id, role: actor.role, assignment: component.assignment, csv };
  return { rows, context, binding, versions: versions! as { sheet: number; history: number } };
}
export async function applyGovernedImport(client: PrismaClient, actor: AuthUser, assignmentId: string, csv: unknown, receipt: unknown) {
  const checked = await validateGovernedImport(client, actor, assignmentId, csv, false);
  requireImportReceipt(receipt, checked.binding);
  return saveAssignedMarkDraft(client, assignmentId, {
    requestKey: `csv-v1-${importDigest(checked.binding)}`,
    expectedSheetVersion: checked.versions.sheet, expectedOptimisticVersion: checked.versions.sheet, expectedVersionNumber: checked.versions.history, rows: checked.rows
  }, actor);
}

export function governedImportWorkbook(actor: AuthUser, context: Awaited<ReturnType<typeof governedImportContext>>) {
  const rows = parseCsv(governedImportTemplate(actor, context));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Governed Draft");
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true }));
}
