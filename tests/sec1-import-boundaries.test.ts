import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  readSpreadsheetRows
} from "../lib/client-spreadsheet";

describe("SEC-1 import and dialog boundaries", () => {
  it("accepts a small one-sheet workbook and preserves payload strings as data", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet([{ name: "<script>QASEC1</script>", value: "'; DROP TABLE QASEC1;--" }]),
      "Import"
    );
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const rows = await readSpreadsheetRows<Record<string, unknown>>(
      new File([bytes], "qasec1.xlsx")
    );
    expect(rows).toEqual([{ name: "<script>QASEC1</script>", value: "'; DROP TABLE QASEC1;--" }]);
  });

  it("rejects magic mismatches, oversized files, extra sheets, and excess rows", async () => {
    await expect(readSpreadsheetRows(new File(["not a zip"], "qasec1.xlsx"))).rejects.toThrow("does not match");
    await expect(readSpreadsheetRows(new File([new Uint8Array(MAX_IMPORT_FILE_BYTES + 1)], "qasec1.csv")))
      .rejects.toThrow("5 MB");

    const multiple = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(multiple, XLSX.utils.aoa_to_sheet([["a"], ["1"]]), "One");
    XLSX.utils.book_append_sheet(multiple, XLSX.utils.aoa_to_sheet([["b"], ["2"]]), "Two");
    await expect(readSpreadsheetRows(new File([
      XLSX.write(multiple, { bookType: "xlsx", type: "array" }) as ArrayBuffer
    ], "qasec1.xlsx"))).rejects.toThrow("exactly one");

    const tooMany = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      tooMany,
      XLSX.utils.aoa_to_sheet([["value"], ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ["QASEC1"])]),
      "Import"
    );
    await expect(readSpreadsheetRows(new File([
      XLSX.write(tooMany, { bookType: "xlsx", type: "array" }) as ArrayBuffer
    ], "qasec1.xlsx"))).rejects.toThrow(`${MAX_IMPORT_ROWS} data rows`);
  });

  it("contains no native browser alert, confirm, or prompt calls in production source", () => {
    const files = [
      "components/expense-form.tsx",
      "components/vendor-form.tsx",
      "components/timetable-builder.tsx",
      "components/library-stock-verification-forms.tsx",
      "components/staff-attendance-entry.tsx",
      "components/student-attendance-entry.tsx",
      "components/student-progression-form.tsx"
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\b(?:window\.)?(?:alert|confirm|prompt)\s*\(/);
    }
  });
});
