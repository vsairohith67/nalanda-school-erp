import { Worker } from "node:worker_threads";
import * as nodeModule from "node:module";
import path from "node:path";
import * as XLSX from "xlsx";
import { inspectXlsxContainer } from "@/lib/onboarding-workbooks";
export const CERTIFICATE_MAPPING_VERSION = "certificate-xlsx-v1";
export const CERTIFICATE_HEADERS = ["Request Number", "Admission Number", "Student Name", "Academic Year", "Class"];
export const CERTIFICATE_MAX_ROWS = 100;
export function certificateWorkbookTemplate() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([CERTIFICATE_HEADERS]), "Certificates");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Mapping Version", CERTIFICATE_MAPPING_VERSION]]), "Metadata");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }));
}

// Parsing runs in a disposable bounded worker. The workbook supplies bytes only,
// never code, a path, a module name, or an outbound URL.
export async function parseCertificateWorkbook(bytes: Uint8Array): Promise<string[][]> {
  if (!bytes.length || bytes.length > 1024 * 1024) throw new Error("CERTIFICATE_XLSX_SIZE_LIMIT");
  // Keep Node worker module paths out of webpack module-ID rewriting.
  const localRequire = Reflect.get(nodeModule, "createRequire")(path.join(process.cwd(), "package.json")) as NodeRequire;
  const source = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
try {
 const XLSX = require(workerData.xlsx), { Unzip, UnzipInflate } = require(workerData.fflate);
 let total = 0, count = 0; const names = new Set();
 const archive = new Unzip(file => {
   if (++count > 80 || names.has(file.name) || /\.\.|\\|^\/|\.bin$|external|vba|activeX|embedding|customUI/i.test(file.name)) throw new Error('UNSAFE_XLSX_ENTRY');
   names.add(file.name);
   file.ondata = (err, chunk) => { if (err) throw err; total += chunk.length; if (total > 4 * 1024 * 1024) throw new Error('XLSX_EXPANSION_LIMIT'); };
   file.start();
 });
 archive.register(UnzipInflate); archive.push(new Uint8Array(workerData.bytes), true);
 const wb = XLSX.read(workerData.bytes, { type: 'array', raw: true, cellFormula: true, cellHTML: false });
 if (wb.SheetNames.join('|') !== 'Certificates|Metadata') throw new Error('CERTIFICATE_SHEETS_INVALID');
 if ((wb.Workbook?.Sheets || []).some(s => s.Hidden)) throw new Error('HIDDEN_SHEET_REFUSED');
 let cells = 0;
 for (const sheet of Object.values(wb.Sheets)) {
   const r = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
   if (r.s.r !== 0 || r.s.c !== 0 || r.e.r > 100 || r.e.c > 4 || sheet['!merges']?.length) throw new Error('CERTIFICATE_RANGE_LIMIT');
   for (const [key, c] of Object.entries(sheet)) {
     if (key.startsWith('!')) continue;
     if (++cells > 510 || c.f || c.l || c.c || !['s','n','z'].includes(c.t) || String(c.v || '').length > 250 || /^[\s\x00-\x1f]*[=+\-@]/.test(String(c.v || ''))) throw new Error('UNSAFE_CERTIFICATE_CELL');
     const at = XLSX.utils.decode_cell(key); if (at.r > 100 || at.c > 4) throw new Error('CERTIFICATE_CELL_RANGE_LIMIT');
   }
 }
 const metadata = XLSX.utils.sheet_to_json(wb.Sheets.Metadata, {header:1,defval:''});
 if (JSON.stringify(metadata) !== JSON.stringify([['Mapping Version','certificate-xlsx-v1']])) throw new Error('CERTIFICATE_MAPPING_VERSION_INVALID');
 const rows = XLSX.utils.sheet_to_json(wb.Sheets.Certificates, { header: 1, defval: '', raw: true, blankrows: false });
 if (JSON.stringify(rows.shift()) !== JSON.stringify(workerData.headers)) throw new Error('CERTIFICATE_HEADERS_INVALID');
 if (!rows.length || rows.length > 100) throw new Error('CERTIFICATE_ROW_LIMIT');
 parentPort.postMessage({ rows: rows.map(r => r.map(c => String(c).trim())) });
} catch(e) { parentPort.postMessage({error: String(e.message).slice(0,100)}); }
`;
  const rows = await new Promise<string[][]>((resolve, reject) => {
    const worker = new Worker(source, { eval: true, resourceLimits: { maxOldGenerationSizeMb: 96, maxYoungGenerationSizeMb: 16 }, workerData: { bytes, headers: CERTIFICATE_HEADERS, xlsx: localRequire.resolve("xlsx"), fflate: localRequire.resolve("fflate") } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("CERTIFICATE_XLSX_TIMEOUT")); }, 3000);
    worker.once("message", (result) => { clearTimeout(timer); void worker.terminate(); result.error ? reject(new Error(result.error)) : resolve(result.rows); });
    worker.once("error", (error) => { clearTimeout(timer); reject(error); });
    worker.once("exit", (code) => { clearTimeout(timer); if (code) reject(new Error("CERTIFICATE_XLSX_WORKER_REFUSED")); });
  });
  // Reuse released OPC/content-type/external-relationship admission after the
  // actual inflation and worksheet limits have been proven in the worker.
  inspectXlsxContainer(bytes);
  return rows;
}
