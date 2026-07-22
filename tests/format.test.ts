import { describe, expect, it } from "vitest";
import { displayDate, money } from "../lib/format";

describe("display formatting", () => {
  it("formats school-facing dates as DD/MM/YYYY", () => {
    expect(displayDate("2026-06-18T00:00:00.000Z")).toBe("18/06/2026");
  });

  it("formats Indian rupee values consistently", () => {
    expect(money(23400)).toContain("23,400");
    expect(money(23400)).toContain("₹");
  });
});
