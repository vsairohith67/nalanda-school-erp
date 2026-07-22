import { describe, expect, it } from "vitest";
import { csvEscape, normalizeAcademicYear, toCsv } from "../lib/format";

describe("shared format security boundaries", () => {
  it("neutralizes spreadsheet formulas before applying CSV quoting", () => {
    for (const value of ["=2+2", "+cmd", "-1+2", "@SUM(A1:A2)", "\t=cmd", "\r=cmd"]) {
      expect(csvEscape(value)).toContain(`'${value}`);
    }
    const csv = toCsv([{ name: "=HYPERLINK(\"https://invalid.example\")", note: "+cmd", safe: "Student" }]);
    expect(csv).toContain("\"'=HYPERLINK(\"\"https://invalid.example\"\")\"");
    expect(csv).toContain("'+cmd");
    expect(csv).toContain("Student");
  });

  it("normalizes only consecutive academic-year values", () => {
    expect(normalizeAcademicYear(" 2026-27 ")).toBe("2026-27");
    expect(() => normalizeAcademicYear("2026-99")).toThrow(/consecutive YYYY-YY/i);
    expect(() => normalizeAcademicYear("2026/27")).toThrow(/consecutive YYYY-YY/i);
  });
});
