import { describe, expect, it } from "vitest";
import { isExactActiveRoute, safeInternalPath } from "../lib/navigation";

describe("post-login navigation", () => {
  it("preserves safe internal routes and query strings", () => {
    expect(safeInternalPath("/ledger?q=NPS26001")).toBe("/ledger?q=NPS26001");
  });

  it("rejects protocol-relative and external destinations", () => {
    expect(safeInternalPath("//example.com")).toBe("/dashboard");
    expect(safeInternalPath("https://example.com")).toBe("/dashboard");
  });

  it("highlights only the exact sidebar route", () => {
    expect(isExactActiveRoute("/students", "/students")).toBe(true);
    expect(isExactActiveRoute("/students/new", "/students")).toBe(false);
    expect(isExactActiveRoute("/students/new", "/students/new")).toBe(true);
    expect(isExactActiveRoute("/payments/new", "/payments")).toBe(false);
    expect(isExactActiveRoute("/receipt-audit", "/receipt-audit")).toBe(true);
    expect(isExactActiveRoute("/pilot-acceptance", "/pilot-acceptance")).toBe(true);
    expect(isExactActiveRoute("/pilot-acceptance", "/import-verification")).toBe(false);
    expect(isExactActiveRoute("/timetable/teachers", "/timetable")).toBe(false);
    expect(isExactActiveRoute("/timetable/teachers/", "/timetable/teachers")).toBe(true);
  });
});
