import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  renderVisualDirectionPack,
  renderVisualDirectionPage,
  VISUAL_DIRECTION_PAGE_KINDS
} from "../lib/report-card-visual-direction";

describe("report-card visual-direction approval renderer", () => {
  it("renders both directions for exactly eight representative structures on A4", async () => {
    const pack = await PDFDocument.load(await renderVisualDirectionPack(false));
    expect(pack.getPageCount()).toBe(16);
    for (const page of pack.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
    }
  });

  it("keeps the stress pack separate and synthetic-only", async () => {
    const pack = await PDFDocument.load(await renderVisualDirectionPack(true));
    expect(pack.getPageCount()).toBe(8);
    expect(VISUAL_DIRECTION_PAGE_KINDS).toHaveLength(8);
  });

  it("renders every representative kind in both directions", async () => {
    for (const kind of VISUAL_DIRECTION_PAGE_KINDS) {
      for (const direction of ["LEGACY_EXACT", "LEGACY_REFINED"] as const) {
        const document = await PDFDocument.load(await renderVisualDirectionPage(kind, direction));
        expect(document.getPageCount()).toBe(1);
      }
    }
  }, 20_000);

  it("does not expose prohibited parent-facing implementation terminology", async () => {
    const source = await readFile(path.resolve(process.cwd(), "lib", "report-card-visual-direction.ts"), "utf8");
    for (const prohibited of [
      "Configured component A",
      "Configured component B",
      "Configured component C",
      "RAW_SUM",
      "WEIGHTED_NORMALIZED",
      "Locked attendance period"
    ]) expect(source).not.toContain(prohibited);
  });
});
