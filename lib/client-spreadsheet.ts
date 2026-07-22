import * as XLSX from "xlsx";

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2_000;
export const MAX_IMPORT_COLUMNS = 256;

export async function readSpreadsheetRows<Row extends Record<string, unknown>>(file: File) {
  if (file.name.length > 180) throw new Error("The selected file name is too long");
  if (file.size <= 0) throw new Error("The selected file is empty");
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new Error("The selected file exceeds the 5 MB import limit");

  const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (!extension || ![".csv", ".xls", ".xlsx"].includes(extension)) {
    throw new Error("Only CSV, XLS, and XLSX import files are accepted");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  validateSpreadsheetSignature(extension, bytes);
  const workbook = XLSX.read(bytes, {
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    dense: true,
    raw: true,
    WTF: false
  });
  if (workbook.SheetNames.length !== 1) {
    throw new Error("The import workbook must contain exactly one worksheet");
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("The import worksheet is missing");
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
  if (range && range.e.c - range.s.c + 1 > MAX_IMPORT_COLUMNS) {
    throw new Error(`The import worksheet exceeds ${MAX_IMPORT_COLUMNS} columns`);
  }
  if (range && range.e.r - range.s.r > MAX_IMPORT_ROWS) {
    throw new Error(`The import worksheet exceeds ${MAX_IMPORT_ROWS} data rows`);
  }
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: true });
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`The import worksheet exceeds ${MAX_IMPORT_ROWS} data rows`);
  return rows;
}

function validateSpreadsheetSignature(extension: string, bytes: Uint8Array) {
  if (extension === ".xlsx") {
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
      throw new Error("The XLSX file content does not match its extension");
    }
    return;
  }
  if (extension === ".xls") {
    const ole = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (!ole.every((value, index) => bytes[index] === value)) {
      throw new Error("The XLS file content does not match its extension");
    }
    return;
  }
  if (bytes.subarray(0, Math.min(bytes.length, 4096)).includes(0)) {
    throw new Error("The CSV file contains binary data");
  }
}
