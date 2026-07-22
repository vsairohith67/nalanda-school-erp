import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { safeClientError } from "../lib/client-errors";

describe("SEC-1 safe client errors", () => {
  it("retains bounded domain validation while redacting infrastructure details", () => {
    expect(safeClientError(new Error("Cancellation reason is required."), "Unable to cancel"))
      .toBe("Cancellation reason is required.");
    for (const message of [
      "Invalid `prisma.payment.create()` invocation at C:\\repo\\app\\route.ts",
      "SQLite error: no such table: User",
      "Unique constraint failed on the fields: (`token`)",
      "Error at async POST (/home/app/route.ts:42:7)",
      "AUTH_SECRET is missing"
    ]) {
      expect(safeClientError(new Error(message), "Request failed")).toBe("Request failed");
    }
  });

  it("neutralizes log-style control characters and rejects excessive messages", () => {
    expect(safeClientError(new Error("QASEC1 invalid\r\nforged-log"), "Request failed"))
      .toBe("QASEC1 invalid forged-log");
    expect(safeClientError(new Error("x".repeat(301)), "Request failed")).toBe("Request failed");
  });

  it("does not reflect raw exception messages from API route handlers", () => {
    const files = execFileSync("rg", ["--files", "app/api", "-g", "route.ts"], { encoding: "utf8" })
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\b(?:error|e)\s+instanceof\s+Error\s*\?\s*(?:error|e)\.message\s*:/);
    }
  });

  it("keeps high-volume report and export queries explicitly bounded", () => {
    const files = [
      "app/api/homework/reports/route.ts",
      "app/api/homework/reports/export/route.ts",
      "app/api/cash-book/reports/route.ts",
      "app/api/cash-book/reports/export/route.ts",
      "app/api/books/reports/route.ts",
      "app/api/books/reports/export/route.ts",
      "app/api/expenses/reports/route.ts",
      "app/api/expenses/reports/export/route.ts",
      "app/api/misc-income/reports/route.ts",
      "app/api/misc-income/reports/export/route.ts",
      "app/api/reports/collection/route.ts",
      "app/api/export/[type]/route.ts",
      "app/api/certificates/reports/route.ts",
      "app/api/certificates/reports/export/route.ts",
      "app/api/class-x-documents/reports/route.ts",
      "app/api/class-x-documents/reports/export/route.ts"
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).toMatch(/take:\s*(?:10_000|CLASS_X_REPORT_ROW_LIMIT)/);
    }
  });
});
