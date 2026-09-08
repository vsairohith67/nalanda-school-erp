import * as XLSX from "xlsx";
import { inspectXlsxContainer } from "@/lib/onboarding-workbooks";

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data;
    if (file.size < 1 || file.size > 5 * 1024 * 1024 || file.name.length > 180) throw new Error("Choose a non-empty file of at most 5 MB with a shorter name.");
    const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (![".csv", ".xlsx"].includes(extension ?? "")) throw new Error("Reviewed mapping accepts CSV or safe XLSX. Save legacy XLS as XLSX locally first.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (extension === ".xlsx") inspectXlsxContainer(bytes);
    else if (bytes.includes(0)) throw new Error("Binary CSV is refused.");
    const wb = XLSX.read(bytes, { raw: true, cellFormula: true, cellHTML: false, cellStyles: false, sheetRows: 2002 });
    if (wb.SheetNames.length !== 1 || wb.Workbook?.Sheets?.some(s => s.Hidden)) throw new Error("Use exactly one visible source worksheet.");
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const range = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"] ?? "A1");
    if (range.e.r > 2000 || range.e.c > 63) throw new Error("Use at most 2000 data rows and 64 columns.");
    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith("!")) continue;
      if (cell.f || cell.l || String(cell.v ?? "").length > 4000) throw new Error("Formulas, links and oversized cells are refused.");
    }
    const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
    const headers = matrix.shift() ?? [];
    if (!headers.length || headers.some(h => !h.trim()) || new Set(headers).size !== headers.length) throw new Error("Each source column needs a unique non-empty heading.");
    const rows = matrix.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
    self.postMessage({ headers, rows });
  } catch { self.postMessage({ error: "Source refused. Use one visible CSV/XLSX sheet, unique headings, plain values, at most 2000 rows, 64 columns and 5 MB; remove formulas, links and active content." }); }
};
