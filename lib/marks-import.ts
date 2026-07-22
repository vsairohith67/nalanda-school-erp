import { Prisma, type PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { csvCell } from "@/lib/expenses";
import { normalizeExamCode } from "@/lib/exams";
import { resolveMarksScope, requireMarksTarget } from "@/lib/marks-scope";
import { validateMarkRow } from "@/lib/marks";

export const MARKS_IMPORT_COLUMNS = ["examCode", "className", "section", "subjectName", "componentName", "admissionNumber", "marksObtained", "entryStatus", "remarks"] as const;
type ParsedRow = Record<(typeof MARKS_IMPORT_COLUMNS)[number], string> & { rowNumber: number };

function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) { if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = false; else cell += char; continue; }
    if (char === '"') quoted = true; else if (char === ',') { row.push(cell); cell = ""; } else if (char === '\n') { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; } else cell += char;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted value.");
  if (cell || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((item) => item.some((value) => value.trim()));
}

export function parseMarksCsv(textValue: unknown): ParsedRow[] {
  const text = String(textValue ?? "").replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("Choose a non-empty marks CSV file.");
  if (text.length > 2_000_000) throw new Error("Marks CSV is too large. Split it into smaller files.");
  const rows = parseCsv(text); const header = rows.shift()?.map((value) => value.trim()) ?? [];
  if (header.join("|") !== MARKS_IMPORT_COLUMNS.join("|")) throw new Error(`CSV columns must be exactly: ${MARKS_IMPORT_COLUMNS.join(", ")}.`);
  return rows.map((values, index) => Object.assign(Object.fromEntries(MARKS_IMPORT_COLUMNS.map((column, columnIndex) => [column, String(values[columnIndex] ?? "").trim()])), { rowNumber: index + 2 }) as unknown as ParsedRow);
}

async function resolveRows(client: PrismaClient | Prisma.TransactionClient, user: AuthUser, parsed: ParsedRow[]) {
  const output: Array<{ rowNumber: number; row: ParsedRow; assessment: any; student: { id: string; admissionNo: string; studentName: string }; entryStatus: string; marksObtained: Prisma.Decimal | null; remarks: string | null }> = [];
  const errors: Array<{ rowNumber: number; message: string }> = [];
  const duplicateKeys = new Set<string>(); const seen = new Set<string>();
  for (const row of parsed) {
    try {
      const examCode = normalizeExamCode(row.examCode); const section = row.section.toUpperCase(); const componentName = row.componentName;
      const exam = await client.examCycle.findUnique({ where: { examCode }, select: { id: true, status: true, academicYear: true } });
      if (!exam) throw new Error("Exact exam code was not found.");
      const assessment = await client.examAssessment.findUnique({ where: { examCycleId_className_section_subjectName_componentName: { examCycleId: exam.id, className: row.className, section, subjectName: row.subjectName, componentName } }, include: { examCycle: true } });
      if (!assessment) throw new Error("Exact class, section, subject, and component assessment was not found.");
      const scope = await resolveMarksScope(client, user, assessment.academicYear); requireMarksTarget(scope, assessment);
      if (assessment.entryStatus !== "OPEN" || assessment.examCycle.status !== "OPEN_FOR_ENTRY") throw new Error("Assessment is not open for import or is locked.");
      const enrollment = await client.academicYearEnrollment.findFirst({ where: { academicYear: assessment.academicYear, className: assessment.className, ...(assessment.section ? { section: assessment.section } : {}), status: "ACTIVE", student: { admissionNo: row.admissionNumber, deletedAt: null, status: "Active" } }, select: { student: { select: { id: true, admissionNo: true, studentName: true } } } });
      if (!enrollment) throw new Error("Exact active Student enrollment was not found for this assessment.");
      const key = `${assessment.id}|${enrollment.student.id}`; if (seen.has(key)) { duplicateKeys.add(key); throw new Error("Duplicate Student row in this CSV."); } seen.add(key);
      const mark = validateMarkRow({ admissionNumber: row.admissionNumber, marksObtained: row.marksObtained, entryStatus: row.entryStatus, remarks: row.remarks }, assessment.maxMarks);
      output.push({ rowNumber: row.rowNumber, row, assessment, student: enrollment.student, entryStatus: mark.entryStatus, marksObtained: mark.marksObtained, remarks: mark.remarks });
    } catch (error) { errors.push({ rowNumber: row.rowNumber, message: error instanceof Error ? error.message : "Invalid row." }); }
  }
  return { output, errors, duplicateCount: duplicateKeys.size };
}

export async function previewMarksImport(prisma: PrismaClient, user: AuthUser, text: unknown) {
  const parsed = parseMarksCsv(text); const resolved = await resolveRows(prisma, user, parsed);
  return { totalRows: parsed.length, validRows: resolved.output.length, errorRows: resolved.errors.length, duplicateRows: resolved.duplicateCount, errors: resolved.errors, rows: resolved.output.map((item) => ({ rowNumber: item.rowNumber, examCode: item.row.examCode, className: item.row.className, section: item.row.section || "Class-wide", subjectName: item.row.subjectName, componentName: item.row.componentName || "Main", admissionNumber: item.student.admissionNo, studentName: item.student.studentName, marksObtained: item.marksObtained?.toString() ?? null, entryStatus: item.entryStatus, remarks: item.remarks })) };
}

export async function applyMarksImport(prisma: PrismaClient, user: AuthUser, text: unknown, actor: { id: string; name: string }, now = new Date()) {
  const parsed = parseMarksCsv(text);
  return prisma.$transaction(async (tx) => {
    const resolved = await resolveRows(tx, user, parsed);
    if (resolved.errors.length) throw new Error(`Import blocked: ${resolved.errors.length} row(s) failed preview validation.`);
    let created = 0; let updated = 0; let unchanged = 0;
    for (const item of resolved.output) {
      const before = await tx.studentMark.findUnique({ where: { assessmentId_studentId: { assessmentId: item.assessment.id, studentId: item.student.id } } });
      const sameMarks = before ? (before.marksObtained === null ? item.marksObtained === null : item.marksObtained !== null && before.marksObtained.equals(item.marksObtained)) : false;
      if (before && before.entryStatus === item.entryStatus && sameMarks && (before.remarks ?? null) === item.remarks) { unchanged += 1; continue; }
      const mark = await tx.studentMark.upsert({ where: { assessmentId_studentId: { assessmentId: item.assessment.id, studentId: item.student.id } }, update: { marksObtained: item.marksObtained, entryStatus: item.entryStatus, remarks: item.remarks, enteredByUserId: actor.id, enteredAt: now }, create: { assessmentId: item.assessment.id, studentId: item.student.id, academicYear: item.assessment.academicYear, marksObtained: item.marksObtained, entryStatus: item.entryStatus, remarks: item.remarks, enteredByUserId: actor.id, enteredAt: now } });
      await tx.studentMarkEvent.create({ data: { assessmentId: item.assessment.id, studentMarkId: mark.id, eventType: before ? (before.entryStatus === item.entryStatus ? "MARK_UPDATED" : "MARK_STATUS_CHANGED") : "MARK_CREATED", previousMarks: before?.marksObtained ?? null, newMarks: item.marksObtained, previousEntryStatus: before?.entryStatus ?? null, newEntryStatus: item.entryStatus, notes: "Preview-confirmed CSV import", actorLabel: actor.name, eventDate: now } });
      if (before) updated += 1; else created += 1;
    }
    return { created, updated, unchanged, total: resolved.output.length };
  });
}

export function marksImportTemplate() { return [MARKS_IMPORT_COLUMNS.map(csvCell).join(","), ["EXAM-CODE", "I", "A", "Mathematics", "Theory", "ADM-001", "0", "PRESENT", "Zero is a valid mark"].map(csvCell).join(",")].join("\r\n") + "\r\n"; }
