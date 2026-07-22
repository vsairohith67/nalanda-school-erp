import { describe, expect, it, vi } from "vitest";
import {
  buildFeeStructureEditorRows,
  logFeeStructureSecurityEvent,
  MAX_FEE_STRUCTURE_TERM_AMOUNT,
  validateFeeStructurePayload,
  validateFeeStructureRows
} from "../lib/fee-structures";
import { dueDateForMonth } from "../lib/fee-allocation";
import { readFileSync } from "node:fs";

describe("fee structure editor", () => {
  it("builds all classes with lower-school and IX/X month defaults", () => {
    const rows = buildFeeStructureEditorRows([{
      academicYear: "2026-27",
      className: "I",
      termAmount: 8600,
      term1Month: "",
      term2Month: "",
      term3Month: "",
      term4Month: ""
    }], "2026-27");
    expect(rows).toHaveLength(13);
    expect(rows.find((row) => row.className === "VIII")).toMatchObject({
      term1Month: "June",
      term2Month: "September",
      term3Month: "December",
      term4Month: "February"
    });
    expect(rows.find((row) => row.className === "IX")).toMatchObject({
      term1Month: "April",
      term2Month: "July",
      term3Month: "October",
      term4Month: "January"
    });
    expect(rows.find((row) => row.className === "I")?.term1Month).toBe("June");
  });

  it("prepares all rows for save-all and protects default months", () => {
    const rows = buildFeeStructureEditorRows([], "2026-27")
      .map((row) => ({ ...row, termAmount: 1000, term1Month: "Wrong" }));
    const saved = validateFeeStructureRows(rows);
    expect(saved).toHaveLength(13);
    expect(saved.find((row) => row.className === "I")?.term1Month).toBe("June");
    expect(saved.find((row) => row.className === "X")?.term1Month).toBe("April");
  });

  it("allows explicit advanced month overrides", () => {
    const rows = buildFeeStructureEditorRows([], "2026-27")
      .map((row) => ({ ...row, termAmount: 1000 }));
    rows[0].term1Month = "May";
    expect(validateFeeStructureRows(rows, true)[0].term1Month).toBe("May");
  });

  it("canonically validates class, consecutive academic year, term amount, and advanced months", () => {
    const valid = validateFeeStructurePayload({
      academicYear: " 2026-27 ",
      rows: [{ className: "class 1", termAmount: "1000.25", term1Month: "june", term2Month: "September", term3Month: "December", term4Month: "February" }],
      advancedOverride: true,
      requireAllClasses: false
    });
    expect(valid).toMatchObject({ academicYear: "2026-27", rows: [{ className: "I", termAmount: 1000.25, term1Month: "June" }] });
    expect(() => validateFeeStructurePayload({ academicYear: "2026-99", rows: valid.rows, requireAllClasses: false })).toThrow(/consecutive YYYY-YY/i);
    expect(() => validateFeeStructureRows([{ ...valid.rows[0], className: "Unknown" }], true, false)).toThrow(/Invalid class/i);
    expect(() => validateFeeStructureRows([{ ...valid.rows[0], termAmount: MAX_FEE_STRUCTURE_TERM_AMOUNT + 1 }], true, false)).toThrow(/positive term amount up to/i);
    expect(() => validateFeeStructureRows([{ ...valid.rows[0], termAmount: 1.001 }], true, false)).toThrow(/two decimal/i);
    expect(() => validateFeeStructureRows([{ ...valid.rows[0], term1Month: "NOT_A_MONTH" }], true, false)).toThrow(/Invalid term month/i);
    expect(() => validateFeeStructureRows([{ ...valid.rows[0], term2Month: "June" }], true, false)).toThrow(/distinct/i);
    expect(() => validateFeeStructureRows([{ ...valid.rows[0], term1Month: "September", term2Month: "June" }], true, false)).toThrow(/April-to-March/i);
  });

  it("fails closed instead of mapping an unknown due month to June", () => {
    expect(dueDateForMonth("June", "2026-27").toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(() => dueDateForMonth("NOT_A_MONTH", "2026-27")).toThrow(/Unsupported fee due month/i);
  });

  it("emits actor-attributed structured security logging after fee changes", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    try {
      logFeeStructureSecurityEvent({ actorUserId: "user-1", academicYear: "2026-27", classNames: ["I"], changeMode: "SINGLE", advancedOverride: false });
      const event = JSON.parse(String(info.mock.calls[0][0]));
      expect(event).toMatchObject({ category: "SECURITY_AUDIT", event: "FEE_STRUCTURE_CHANGED", actorUserId: "user-1", academicYear: "2026-27", classNames: ["I"] });
      const route = readFileSync("app/api/fee-structures/route.ts", "utf8");
      expect(route.match(/logFeeStructureSecurityEvent\(/g)).toHaveLength(2);
      expect(route).toContain("actorUserId: auth.user.id");
    } finally {
      info.mockRestore();
    }
  });
});
