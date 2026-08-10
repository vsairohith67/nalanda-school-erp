import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import {
  createReportZip,
  deterministicReportPdfName,
  mergeReportPdfs,
  renderReportPdf
} from "../lib/report-pdf";
import { syntheticReportSpecimens } from "../lib/report-card-synthetic-specimens";

const OUTPUT_ROOT = path.join(process.cwd(), ".codex", "report-print-accept-1a", "print-pack");
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

type ManifestEntry = {
  specimenId: string;
  family: string;
  variant: string;
  mode: string;
  fileName: string;
  pageCount: number;
  pageStructure: string[];
  sha256: string;
  byteLength: number;
};

async function main() {
  rmSync(OUTPUT_ROOT, { recursive: true, force: true });
  mkdirSync(OUTPUT_ROOT, { recursive: true });
  const entries: ManifestEntry[] = [];
  const byMode = new Map<string, Buffer[]>();
  const zipEntries: Array<{ name: string; bytes: Buffer }> = [];

  for (const specimen of syntheticReportSpecimens()) {
    const first = await renderReportPdf(specimen.report, specimen.mode);
    const second = await renderReportPdf(specimen.report, specimen.mode);
    if (!first.equals(second)) throw new Error(`NON_DETERMINISTIC_PDF_${specimen.id}`);
    const parsed = await PDFDocument.load(first);
    assertA4Pages(parsed, specimen.id);
    const fileName = `${specimen.id}-${safePart(specimen.family)}-${safePart(specimen.variant)}-${specimen.mode.toLowerCase()}.pdf`;
    writeFileSync(path.join(OUTPUT_ROOT, fileName), first);
    const expectedPages = specimen.family === "KG_DEVELOPMENTAL_BOOKLET" ? 10 : parsed.getPageCount();
    if (parsed.getPageCount() !== expectedPages) {
      throw new Error(`${specimen.id}_PAGE_COUNT_${parsed.getPageCount()}_EXPECTED_${expectedPages}`);
    }
    entries.push({
      specimenId: specimen.id,
      family: specimen.family,
      variant: specimen.variant,
      mode: specimen.mode,
      fileName,
      pageCount: parsed.getPageCount(),
      pageStructure: specimen.structureCoverage,
      sha256: sha256(first),
      byteLength: first.length
    });
    byMode.set(specimen.mode, [...(byMode.get(specimen.mode) ?? []), first]);
    zipEntries.push({ name: deterministicReportPdfName(specimen.report, specimen.mode), bytes: first });
  }

  for (const [mode, files] of byMode.entries()) {
    const merged = await mergeReportPdfs(files);
    const parsed = await PDFDocument.load(merged);
    assertA4Pages(parsed, `MERGED_${mode}`);
    writeFileSync(path.join(OUTPUT_ROOT, `RC-SYN-merged-${mode.toLowerCase()}.pdf`), merged);
  }
  writeFileSync(path.join(OUTPUT_ROOT, "RC-SYN-individual-reports.zip"), createReportZip(zipEntries));
  writeFileSync(path.join(OUTPUT_ROOT, "manifest.json"), `${JSON.stringify({
    generatedAt: "2026-08-11T00:00:00.000Z",
    syntheticOnly: true,
    sourceFilesIncluded: false,
    entries
  }, null, 2)}\n`);
  writeFileSync(path.join(OUTPUT_ROOT, "PRINT-INSTRUCTIONS.txt"), printInstructions());
  console.log(`REPORT_PRINT_ACCEPT1A_PACK_READY entries=${entries.length} output=${OUTPUT_ROOT}`);
}

function assertA4Pages(document: PDFDocument, id: string) {
  for (const [index, page] of document.getPages().entries()) {
    const { width, height } = page.getSize();
    const portrait = near(width, A4_WIDTH) && near(height, A4_HEIGHT);
    const landscape = near(width, A4_HEIGHT) && near(height, A4_WIDTH);
    if (!portrait && !landscape) {
      throw new Error(`${id}_PAGE_${index + 1}_NOT_A4_${width.toFixed(2)}x${height.toFixed(2)}`);
    }
  }
}

function near(left: number, right: number) {
  return Math.abs(left - right) < 0.75;
}

function safePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function printInstructions() {
  return [
    "REPORT-PRINT-ACCEPT-1A SYNTHETIC PHYSICAL PRINT PACK",
    "",
    "All specimens contain synthetic data only. Never substitute or upload a real Student report.",
    "Paper: A4, ordinary office paper.",
    "Scale: Actual Size / 100%. Record any scaling the printer enforces.",
    "Quality: normal office-printer quality.",
    "Colour specimens: print in native colour mode.",
    "Monochrome specimens: print in native grayscale/B&W mode.",
    "Also photocopy one monochrome specimen once.",
    "Print the full KG colour booklet and the full KG monochrome booklet as ordinary A4 pages in order.",
    "Do not use booklet imposition for canonical acceptance.",
    "Record clipping, readability, alignment, logo sharpness, chart-pattern distinction, signature space, reference readability, page order and any blank pages.",
    ""
  ].join("\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
