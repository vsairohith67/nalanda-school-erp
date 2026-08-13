import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../lib/prisma";
import {
  NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES,
  R7_DETAIL_MONOCHROME_SWATCHES,
  R7_DETAIL_PAGES,
  R7_VISUAL_PAGES,
  renderR7DetailChecks,
  renderR7VisualPack,
  resolveReportSchoolIdentity
} from "../lib/report-card-refined-source-lock";
import {
  inspectRenderedPatternSwatchRobustness,
  requireRenderedPdfPagesMonochrome,
  requireRenderedPdfWhiteBackground
} from "../lib/report-card-monochrome-validation";
import { getSchoolSettings } from "../lib/school-settings";

const outputRoot = path.resolve(process.cwd(), ".codex", "report-print-accept-1a", "r7");
const visualPath = path.join(outputRoot, "VISUAL-DIRECTION-PACK-R7.pdf");
const detailPath = path.join(outputRoot, "R7-DETAIL-CHECKS.pdf");
const manifestPath = path.join(outputRoot, "R7-DIGITAL-REVIEW-MANIFEST.json");
const operationalDbPath = path.resolve(process.cwd(), "prisma", "dev.db");

async function main() {
  const operationalBefore = sha256(await readFile(operationalDbPath));
  const settings = await getSchoolSettings(prisma);
  const identity = resolveReportSchoolIdentity(settings, [{
    schoolIdentity: { affiliationWording: "(Affiliated to CISCE, New Delhi, Estd. 1972)" }
  }]);
  const [visual, visualRepeat, detail, detailRepeat] = await Promise.all([
    renderR7VisualPack(identity),
    renderR7VisualPack(identity),
    renderR7DetailChecks(identity),
    renderR7DetailChecks(identity)
  ]);
  if (!visual.equals(visualRepeat) || !detail.equals(detailRepeat)) throw new Error("R7 review-pack generation is not deterministic.");
  await validatePdf(visual, 8);
  await validatePdf(detail, 14);
  const [visualWhite, detailWhite, visualMono, detailMono, photocopy] = await Promise.all([
    requireRenderedPdfWhiteBackground(visual, Array.from({ length: 8 }, (_, index) => index + 1)),
    requireRenderedPdfWhiteBackground(detail, Array.from({ length: 14 }, (_, index) => index + 1)),
    requireRenderedPdfPagesMonochrome(visual, [5, 6, 7, 8], 2),
    requireRenderedPdfPagesMonochrome(detail, [2, 9, 10, 11, 12], 2),
    inspectRenderedPatternSwatchRobustness(detail, R7_DETAIL_MONOCHROME_SWATCHES.page, R7_DETAIL_MONOCHROME_SWATCHES.boxes, 0.72)
  ]);
  const ratios = new Map(photocopy.darkPixelRatios.map((item) => [item.series, item.ratio]));
  if ((ratios.get("Student Marks") ?? 0) < 0.75) throw new Error("R7 Student Marks is not a uniform medium-grey swatch after photocopy simulation.");
  for (const series of ["Class Average", "High Score"]) {
    const ratio = ratios.get(series) ?? 0;
    if (ratio <= 0.03 || ratio >= 0.48) throw new Error(`R7 ${series} pattern does not preserve adequate white space after photocopy simulation.`);
  }
  const operationalAfter = sha256(await readFile(operationalDbPath));
  if (operationalAfter !== operationalBefore) throw new Error("Operational database changed during R7 synthetic pack generation.");

  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(visualPath, visual),
    writeFile(detailPath, detail),
    writeFile(manifestPath, JSON.stringify({
      status: "REPORT_TEMPLATE_R7_DIGITAL_REVIEW_PENDING",
      prompt: "REPORT-PRINT-ACCEPT-1A-R7",
      productionFamilies: NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES,
      v1Scope: ["CLASSES_I_II", "CLASSES_III_V", "CLASSES_VI_VIII", "CLASSES_IX_X"],
      kgStatus: "IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5",
      physicalPrintingAuthorised: false,
      finalPhysicalPackRegenerated: false,
      realReportPublished: false,
      sourcePagesIncluded: false,
      studentData: "SYNTHETIC_ONLY",
      operationalDatabase: { sha256Before: operationalBefore, sha256After: operationalAfter, byteIdentical: true },
      reviewContract: {
        header: "12 pt bold status / 11 pt bold address",
        summaryCards: "dynamic three/four/five full-width cards",
        attendanceRemarks: "aligned 45/55 balanced row",
        signatureClearanceMm: 12,
        monochromeSeries: [
          "Student Marks — solid neutral 55% grey",
          "Class Average — white with single-direction diagonal slashes",
          "High Score — white with filled black diamond lattice"
        ]
      },
      packs: [
        { file: path.basename(visualPath), pages: 8, sha256: sha256(visual), specimens: R7_VISUAL_PAGES, whiteBackgroundChecks: visualWhite, monochromeChecks: visualMono },
        { file: path.basename(detailPath), pages: 14, sha256: sha256(detail), details: R7_DETAIL_PAGES, whiteBackgroundChecks: detailWhite, monochromeChecks: detailMono, photocopyPatternCheck: photocopy }
      ]
    }, null, 2) + "\n")
  ]);
  process.stdout.write(JSON.stringify({
    result: "REPORT_TEMPLATE_R7_PACKS_GENERATED",
    outputRoot,
    visualPath,
    detailPath,
    visualPages: 8,
    detailPages: 14,
    physicalPrintingAuthorised: false,
    finalPhysicalPackRegenerated: false,
    operationalDatabaseByteIdentical: true,
    operationalDatabaseSha256: operationalAfter,
    visualSha256: sha256(visual),
    detailSha256: sha256(detail),
    photocopyMaximumPairSimilarity: photocopy.maximumPairSimilarity,
    photocopyDarkPixelRatios: photocopy.darkPixelRatios
  }, null, 2));
}

async function validatePdf(bytes: Buffer, expectedPages: number) {
  const document = await PDFDocument.load(bytes);
  if (document.getPageCount() !== expectedPages) throw new Error("R7 PDF page count is unstable.");
  for (const page of document.getPages()) {
    if (Math.abs(page.getWidth() - 595.28) > 0.1 || Math.abs(page.getHeight() - 841.89) > 0.1) throw new Error("R7 PDF page is not exact A4.");
    if (!page.node.Contents()) throw new Error("R7 PDF contains a blank page.");
  }
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

main().catch((error) => {
  process.stderr.write((error instanceof Error ? error.stack || error.message : String(error)) + "\n");
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
