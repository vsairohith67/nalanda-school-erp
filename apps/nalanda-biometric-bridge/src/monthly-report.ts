import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as XLSX from "xlsx";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

export type MonthlySummary = { schemaVersion: 1; month: string; sourceRevision: string; review: { status: "APPROVED" | "UNRESOLVED"; reviewerReference: string; reviewedAt: string; synthetic: boolean }; staff: Array<{ staffReference: string; leaves: number | null; lates: number | null; remarks: string; evidenceReferences: string[] }> };
export type ReportOrder = { schemaVersion: 1; version: string; month: string; approvalReference: string; synthetic: boolean; rows: Array<{ staffReference: string; displayName: string; group: "Teaching" | "Non-Teaching"; include: boolean; position: number }> };

export function validateMonthlyReport(summary: MonthlySummary, manifest: ReportOrder, month: string) {
  const issues: string[] = [];
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || summary.month !== month || manifest.month !== month) issues.push("MONTH_MISMATCH");
  if (summary.schemaVersion !== 1 || manifest.schemaVersion !== 1 || !summary.sourceRevision || !manifest.version || !manifest.approvalReference || summary.review?.status !== "APPROVED" || !summary.review.reviewerReference || Number.isNaN(Date.parse(summary.review.reviewedAt))) issues.push("APPROVAL_OR_PROVENANCE_MISSING");
  if (typeof summary.review?.synthetic !== "boolean" || manifest.synthetic !== summary.review.synthetic) issues.push("SYNTHETIC_AUTHORITY_MISMATCH");
  if (!Array.isArray(summary.staff) || !Array.isArray(manifest.rows) || summary.staff.length > 10000 || manifest.rows.length > 10000) return { status: "REVIEW_REQUIRED", issues: [...issues, "ROWS_INVALID"] } as const;
  const ids = new Set<string>(), positions = new Set<string>();
  for (const row of manifest.rows) {
    if (!row.staffReference || typeof row.displayName !== "string" || row.displayName.length < 1 || row.displayName.length > 200 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(row.displayName) || !["Teaching", "Non-Teaching"].includes(row.group) || typeof row.include !== "boolean" || !Number.isSafeInteger(row.position) || row.position < 1) issues.push("MANIFEST_ROW_INVALID");
    if (ids.has(row.staffReference)) issues.push("DUPLICATE_STAFF_ID"); ids.add(row.staffReference);
    const position = `${row.group}:${row.position}`;
    if (row.include && positions.has(position)) issues.push("DUPLICATE_POSITION"); if (row.include) positions.add(position);
  }
  const sourceIds = new Set<string>();
  for (const row of summary.staff) {
    if (sourceIds.has(row.staffReference)) issues.push("DUPLICATE_SUMMARY_ID"); sourceIds.add(row.staffReference);
    if (!ids.has(row.staffReference)) issues.push("EXTRA_EMPLOYEE");
    if (![row.leaves, row.lates].every(v => typeof v === "number" && Number.isFinite(v) && v >= 0 && Number.isSafeInteger(v * 2))) issues.push("UNRESOLVED_NUMERIC_VALUE");
    if (typeof row.remarks !== "string" || row.remarks.length > 4000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(row.remarks) || !Array.isArray(row.evidenceReferences) || (row.remarks.length > 0 && !row.evidenceReferences.length)) issues.push("REMARK_EVIDENCE_MISSING");
  }
  for (const row of manifest.rows) if (row.include && !sourceIds.has(row.staffReference)) issues.push("MISSING_SUMMARY");
  return { status: issues.length ? "REVIEW_REQUIRED" : "VALID", issues: [...new Set(issues)] };
}
export function monthlyReportRows(summary: MonthlySummary, manifest: ReportOrder, month: string) {
  const review = validateMonthlyReport(summary, manifest, month);
  if (review.status !== "VALID") throw new Error(`REPORT_REVIEW_REQUIRED:${review.issues.join(",")}`);
  const [year, m] = month.split("-").map(Number), title = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, m - 1, 1)));
  const rows: (string | number | null)[][] = [[`Month: ${title}`], []];
  for (const group of ["Teaching", "Non-Teaching"] as const) {
    rows.push([`${group} Staff`], ["S.No", "Name", "Leaves", "Lates", "Remarks"]);
    const included = manifest.rows.filter(r => r.include && r.group === group).sort((a, b) => a.position - b.position);
    included.forEach((r, i) => { const s = summary.staff.find(s => s.staffReference === r.staffReference)!; rows.push([i + 1, r.displayName, s.leaves, s.lates, s.remarks]); });
    rows.push([]);
  }
  return rows;
}
export function renderMonthlyReport(summaryFile: string, manifestFile: string, month: string, output: string, mode: "synthetic" | "final-approved") {
  if ([summaryFile, manifestFile].some(f => !statSync(f).isFile() || statSync(f).size > 8 * 1024 * 1024)) throw new Error("REPORT_INPUT_TOO_LARGE");
  const source = readFileSync(summaryFile), order = readFileSync(manifestFile);
  if (source.length > 8 * 1024 * 1024 || order.length > 8 * 1024 * 1024) throw new Error("REPORT_INPUT_TOO_LARGE");
  const summary = JSON.parse(source.toString()) as MonthlySummary, manifest = JSON.parse(order.toString()) as ReportOrder;
  if (mode === "final-approved" && (summary.review?.synthetic || manifest.synthetic)) throw new Error("REPORT_SYNTHETIC_NOT_REAL_AUTHORITY");
  if (mode === "synthetic" && (!summary.review?.synthetic || !manifest.synthetic)) throw new Error("REPORT_SYNTHETIC_INPUT_REQUIRED");
  if (existsSync(output) || existsSync(`${output}.manifest.json`) || [summaryFile, manifestFile].some(f => path.resolve(f) === path.resolve(output))) throw new Error("REPORT_OUTPUT_EXISTS_OR_SOURCE_COLLISION");
  const rows = monthlyReportRows(summary, manifest, month), sheet = XLSX.utils.aoa_to_sheet(rows);
  // SheetJS values remain typed literal strings. Never set formula properties from source text.
  for (const key of Object.keys(sheet)) if (!key.startsWith("!")) { const c = sheet[key] as XLSX.CellObject; if (c.t === "n") c.z = Number.isInteger(c.v) ? "0" : "0.0"; if (c.f) throw new Error("REPORT_FORMULA_FORBIDDEN"); }
  sheet["!cols"] = [{ wch: 7 }, { wch: 35 }, { wch: 10 }, { wch: 10 }, { wch: 70 }];
  const wrappedLines = (value: unknown, width: number) => String(value ?? "").split(/\r?\n/).reduce((n, line) => n + Math.max(1, Math.ceil(line.length / width)), 0);
  sheet["!rows"] = rows.map(r => ({ hpt: r.length === 1 ? 26 : r.length === 0 ? 12 : Math.max(23, Math.min(409, Math.max(wrappedLines(r[1], 30), wrappedLines(r[4], 65)) * 15 + 8)) }));
  const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
  const raw = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
  const bytes = styleWorkbook(raw, sheet, rows);
  const provenance = { schemaVersion: 1, month, mode, synthetic: summary.review.synthetic, sourceRevision: summary.sourceRevision, review: summary.review, orderVersion: manifest.version, orderApprovalReference: manifest.approvalReference, sourceSha256: hash(source), orderSha256: hash(order), workbookSha256: hash(bytes), editedCopyIsNotLedgerWriteback: true };
  // Reserve private sidecar before publishing workbook. Existing outputs are never overwritten.
  writeFileSync(`${output}.manifest.json`, JSON.stringify(provenance, null, 2), { flag: "wx", mode: 0o600 });
  writeFileSync(output, bytes, { flag: "wx", mode: 0o600 });
  return { output, rows: rows.length, status: mode === "synthetic" ? "SYNTHETIC_REPORT_ONLY" : "FINAL_APPROVED_EXPORT" };
}
function hash(value: Buffer) { return createHash("sha256").update(value).digest("hex"); }
function styleWorkbook(raw: Buffer, sheet: XLSX.WorkSheet, rows: (string | number | null)[][]) {
  // SheetJS Community does not serialize arbitrary cell font/alignment styles.
  // Add fixed OpenXML presentation styles to its generated package; source text is never XML-interpolated.
  const files = unzipSync(raw);
  files["xl/styles.xml"] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="13"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7EEF8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  let xml = strFromU8(files["xl/worksheets/sheet1.xml"]);
  xml = xml.replace(/<c\b([^>]*\br="([A-Z]+)(\d+)"[^>]*)>/g, (_match, attrs: string, col: string, rowText: string) => {
    const row = Number(rowText), cell = sheet[`${col}${row}`] as XLSX.CellObject, sourceRow = rows[row - 1];
    const style = row === 1 ? 4 : sourceRow.length === 1 ? 5 : sourceRow[0] === "S.No" ? 6 : cell.t === "n" ? Number.isInteger(cell.v) ? 2 : 3 : 1;
    return `<c${attrs.replace(/\s+s="\d+"/g, "")} s="${style}">`;
  });
  if (xml.includes("<sheetViews>")) xml = xml.replace(/<sheetViews>.*?<\/sheetViews>/s, '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>');
  else xml = xml.replace(/(<dimension[^>]*\/>)|(<sheetData>)/, match => match.startsWith("<dimension") ? `${match}<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>` : `<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>${match}`);
  files["xl/worksheets/sheet1.xml"] = strToU8(xml);
  return Buffer.from(zipSync(files, { level: 6 }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [summary, order, month, output, mode] = process.argv.slice(2);
    if (!["synthetic", "final-approved"].includes(mode)) throw new Error("REPORT_MODE_REQUIRED");
    console.log(JSON.stringify(renderMonthlyReport(summary, order, month, output, mode as "synthetic" | "final-approved")));
  } catch { console.error("REPORT_REVIEW_REQUIRED_OR_EXPORT_FAILED"); process.exitCode = 1; }
}
