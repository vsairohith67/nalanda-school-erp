import { describe, expect, it } from "vitest";
import { classSectionLabel, displayCollectionTermLabel, groupTotalByLabel } from "../lib/collection-report";

describe("daily collection report labels", () => {
  it("includes section in class-wise collection labels when available", () => {
    expect(classSectionLabel("I", "B")).toBe("I-B");
    expect(groupTotalByLabel([
      { className: "I", section: "B", amountPaid: 1000 },
      { className: "I", section: "B", amountPaid: 500 }
    ], (row) => classSectionLabel(row.className, row.section))).toEqual({ "I-B": 1500 });
  });

  it("replaces raw Auto term text with beginner-friendly labels", () => {
    expect(displayCollectionTermLabel("Auto")).toBe("Auto allocation");
    expect(displayCollectionTermLabel("Multiple")).toBe("Multiple / Auto allocation");
    expect(displayCollectionTermLabel("Term 1")).toBe("Term 1");
  });
});
