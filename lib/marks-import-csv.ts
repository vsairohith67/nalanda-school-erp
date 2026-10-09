export const MARKS_IMPORT_COLUMNS = ["examCode", "className", "section", "subjectName", "componentName", "admissionNumber", "marksObtained", "entryStatus", "remarks"] as const;
export type ParsedRow = Record<(typeof MARKS_IMPORT_COLUMNS)[number], string> & { rowNumber: number };

export function parseCsv(text: string) {
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
  if (rows.length > 2000 || rows.some(row => row.length !== MARKS_IMPORT_COLUMNS.length)) throw new Error("Use at most 2000 rows with exactly nine fields each.");
  return rows.map((values, index) => Object.assign(Object.fromEntries(MARKS_IMPORT_COLUMNS.map((column, columnIndex) => [column, String(values[columnIndex] ?? "").trim()])), { rowNumber: index + 2 }) as unknown as ParsedRow);
}


export const GOVERNED_IMPORT_COLUMNS = ["templateVersion", "studentId", "admissionNumber", "sheetVersion", "versionNumber", "rowVersion", "contextReceipt", "marksObtained", "entryState", "remarks"] as const;
export function projectMarksCsv(text: string, governed: boolean) {
  if (text.length > (governed ? 400000 : 2000000)) throw new Error("Marks CSV exceeds the selected model limit.");
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const fields = governed ? GOVERNED_IMPORT_COLUMNS : MARKS_IMPORT_COLUMNS;
  if (rows.shift()?.join("|") !== fields.join("|")) throw new Error("Use the exact selected-model template; unexpected columns are excluded by refusing this file locally.");
  if (!rows.length || rows.length > (governed ? 200 : 2000) || rows.some(row => row.length !== fields.length || row.some(value => value.length > 4000))) throw new Error("Invalid marks row or cell limits.");
  return [fields.join(","), ...rows.map(row => fields.map((_, i) => `"${row[i].replace(/"/g, '\"\"')}"`).join(","))].join("\r\n") + "\r\n";
}
