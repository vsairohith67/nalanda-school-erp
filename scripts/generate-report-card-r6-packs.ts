import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../lib/prisma";
import {
  NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES,
  R6_DETAIL_MONOCHROME_SWATCHES,
  R6_DETAIL_PAGES,
  R6_VISUAL_PAGES,
  renderR6DetailChecks,
  renderR6VisualPack,
  resolveReportSchoolIdentity
} from "../lib/report-card-refined-source-lock";
import {
  inspectRenderedPatternSwatchRobustness,
  requireRenderedPdfPagesMonochrome,
  requireRenderedPdfWhiteBackground
} from "../lib/report-card-monochrome-validation";
import { getSchoolSettings } from "../lib/school-settings";

const outputRoot = path.resolve(process.cwd(), ".codex", "report-print-accept-1a", "r6");
const visualPath = path.join(outputRoot, "VISUAL-DIRECTION-PACK-R6.pdf");
const detailPath = path.join(outputRoot, "R6-DETAIL-CHECKS.pdf");
const manifestPath = path.join(outputRoot, "R6-DIGITAL-REVIEW-MANIFEST.json");

async function main() {
  const settings = await getSchoolSettings(prisma);
  const identity = resolveReportSchoolIdentity(settings, [{
    schoolIdentity: { affiliationWording: "(Affiliated to CISCE, New Delhi, Estd. 1972)" }
  }]);
  await preservePreAmendmentEvidence();
  const [visual, visualRepeat, detail, detailRepeat] = await Promise.all([
    renderR6VisualPack(identity),
    renderR6VisualPack(identity),
    renderR6DetailChecks(identity),
    renderR6DetailChecks(identity)
  ]);
  if (!visual.equals(visualRepeat) || !detail.equals(detailRepeat)) {
    throw new Error("R6 review-pack generation is not deterministic.");
  }
  await validatePdf(visual, 8);
  await validatePdf(detail, 12);
  const [visualWhite, detailWhite, visualMono, detailMono, photocopy] = await Promise.all([
    requireRenderedPdfWhiteBackground(visual, Array.from({ length: 8 }, (_, index) => index + 1)),
    requireRenderedPdfWhiteBackground(detail, Array.from({ length: 12 }, (_, index) => index + 1)),
    requireRenderedPdfPagesMonochrome(visual, [5, 6, 7, 8], 2),
    requireRenderedPdfPagesMonochrome(detail, [2, 5, 6], 2),
    inspectRenderedPatternSwatchRobustness(detail, R6_DETAIL_MONOCHROME_SWATCHES.page, R6_DETAIL_MONOCHROME_SWATCHES.boxes, 0.72)
  ]);
  const studentRatio = photocopy.darkPixelRatios.find((item) => item.series === "Student Marks")?.ratio ?? 0;
  const patternedRatios = photocopy.darkPixelRatios.filter((item) => item.series !== "Student Marks").map((item) => item.ratio);
  if (studentRatio < 0.75) throw new Error("R6 Student Marks swatch is not a uniform medium-grey fill after photocopy thresholding.");
  if (patternedRatios.some((ratio) => ratio <= 0.03 || ratio >= 0.48)) {
    throw new Error("R6 slash or diamond pattern does not preserve sufficient white space after photocopy simulation.");
  }

  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(visualPath, visual),
    writeFile(detailPath, detail),
    writeFile(manifestPath, JSON.stringify({
      status: "REPORT_TEMPLATE_R6_DIGITAL_REVIEW_PENDING",
      prompt: "REPORT-PRINT-ACCEPT-1A-R6",
      authoritativeAmendment: "REPORT-PRINT-ACCEPT-1A-R6-A1",
      authoritativeMonochromeSeries: [
        "Student Marks — solid neutral 55% grey",
        "Class Average — white with single-direction diagonal slashes",
        "High Score — white with diamond/cross lattice"
      ],
      productionFamilies: NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES,
      v1Scope: ["CLASSES_I_II", "CLASSES_III_V", "CLASSES_VI_VIII", "CLASSES_IX_X"],
      kgStatus: "IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5",
      physicalPrintingAuthorised: false,
      fullPhysicalPackRegenerated: false,
      sourcePagesIncluded: false,
      studentData: "SYNTHETIC_ONLY",
      schoolIdentity: {
        schoolName: identity.schoolName,
        locality: identity.addressLine1,
        city: identity.city,
        statusLineConfigured: true,
        statusLineSource: "SYNTHETIC_APPROVED_TEMPLATE_FIXTURE"
      },
      packs: [
        { file: path.basename(visualPath), pages: 8, sha256: sha256(visual), specimens: R6_VISUAL_PAGES, whiteBackgroundChecks: visualWhite, monochromeChecks: visualMono },
        { file: path.basename(detailPath), pages: 12, sha256: sha256(detail), details: R6_DETAIL_PAGES, whiteBackgroundChecks: detailWhite, monochromeChecks: detailMono, photocopyPatternCheck: photocopy }
      ]
    }, null, 2) + "\n")
  ]);
  process.stdout.write(JSON.stringify({
    result: "REPORT_TEMPLATE_R6_PACKS_GENERATED",
    outputRoot,
    visualPath,
    detailPath,
    visualPages: 8,
    detailPages: 12,
    physicalPrintingAuthorised: false,
    fullPhysicalPackRegenerated: false,
    visualSha256: sha256(visual),
    detailSha256: sha256(detail),
    photocopyMaximumPairSimilarity: photocopy.maximumPairSimilarity,
    photocopyDarkPixelRatios: photocopy.darkPixelRatios
  }, null, 2));
}

async function preservePreAmendmentEvidence() {
  if (!(await exists(manifestPath))) return;
  const manifest = await readFile(manifestPath, "utf8");
  if (manifest.includes('"authoritativeAmendment": "REPORT-PRINT-ACCEPT-1A-R6-A1"')) return;
  const supersededRoot = path.join(outputRoot, "superseded-pre-a1");
  await mkdir(supersededRoot, { recursive: true });
  for (const file of [visualPath, detailPath, manifestPath]) {
    if (await exists(file)) await copyFile(file, path.join(supersededRoot, path.basename(file)));
  }
  await writeFile(path.join(supersededRoot, "SUPERSEDED_BY_R6_A1.md"), "# SUPERSEDED_BY_R6_A1\n\nPreserved ignored technical QA evidence. Do not review, print, upload, publish or use for physical acceptance.\n");
}

async function exists(file: string) {
  return access(file).then(() => true).catch(() => false);
}

async function validatePdf(bytes: Buffer, expectedPages: number) {
  const document = await PDFDocument.load(bytes);
  if (document.getPageCount() !== expectedPages) throw new Error("R6 PDF page count is unstable.");
  for (const page of document.getPages()) {
    if (Math.abs(page.getWidth() - 595.28) > 0.1 || Math.abs(page.getHeight() - 841.89) > 0.1) throw new Error("R6 PDF page is not exact A4.");
    if (!page.node.Contents()) throw new Error("R6 PDF contains a blank page.");
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
