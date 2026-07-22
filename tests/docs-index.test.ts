import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("documentation index", () => {
  it("links all real-data pilot documents", async () => {
    const index = await readFile(path.resolve("docs", "INDEX.md"), "utf8");
    expect(index).toContain("REAL_DATA_PILOT_RUNBOOK.md");
    expect(index).toContain("SAMPLE_IMPORT_FORMATS.md");
    expect(index).toContain("PILOT_QA_REPORT_TEMPLATE.md");
    expect(index).toContain("pilot:sample-data");
    expect(index).toContain("Pilot Acceptance");
  });
});
