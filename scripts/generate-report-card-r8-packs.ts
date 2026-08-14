import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../lib/prisma";
import {
  NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES,
  R8_DETAIL_PAGES,
  R8_FINAL_REVIEW_PAGES,
  R8_PHYSICAL_SPECIMENS,
  R8_SIGNATURE_GEOMETRY,
  renderR8DetailChecks,
  renderR8FinalDigitalReview,
  renderR8PhysicalAcceptancePack,
  resolveReportSchoolIdentity
} from "../lib/report-card-refined-source-lock";
import {
  requireRenderedPdfPagesMonochrome,
  requireRenderedPdfWhiteBackground
} from "../lib/report-card-monochrome-validation";
import { getSchoolSettings } from "../lib/school-settings";

const outputRoot = path.resolve(process.cwd(), ".codex", "report-print-accept-1a", "r8");
const physicalRoot = path.join(outputRoot, "final-print-pack");
const reviewPath = path.join(outputRoot, "FINAL-DIGITAL-REVIEW-R8.pdf");
const detailPath = path.join(outputRoot, "R8-DETAIL-CHECKS.pdf");
const colourPath = path.join(physicalRoot, "PHYSICAL-ACCEPTANCE-CLASSES-I-X-COLOUR.pdf");
const monochromePath = path.join(physicalRoot, "PHYSICAL-ACCEPTANCE-CLASSES-I-X-MONOCHROME.pdf");
const instructionsPath = path.join(physicalRoot, "PRINT-INSTRUCTIONS-R8.txt");
const specimenManifestPath = path.join(physicalRoot, "PHYSICAL-SPECIMEN-MANIFEST-R8.json");
const digitalManifestPath = path.join(outputRoot, "R8-DIGITAL-REVIEW-MANIFEST.json");
const operationalDbPath = path.resolve(process.cwd(), "prisma", "dev.db");

async function main() {
  const operationalBefore = sha256(await readFile(operationalDbPath));
  const settings = await getSchoolSettings(prisma);
  const identity = resolveReportSchoolIdentity(settings, [{
    schoolIdentity: { affiliationWording: "(Affiliated to CISCE, New Delhi, Estd. 1972)" }
  }]);
  const [review, reviewRepeat, detail, detailRepeat, colour, colourRepeat, monochrome, monochromeRepeat] = await Promise.all([
    renderR8FinalDigitalReview(identity), renderR8FinalDigitalReview(identity),
    renderR8DetailChecks(identity), renderR8DetailChecks(identity),
    renderR8PhysicalAcceptancePack("COLOUR", identity), renderR8PhysicalAcceptancePack("COLOUR", identity),
    renderR8PhysicalAcceptancePack("MONOCHROME", identity), renderR8PhysicalAcceptancePack("MONOCHROME", identity)
  ]);
  if (!review.equals(reviewRepeat) || !detail.equals(detailRepeat) || !colour.equals(colourRepeat) || !monochrome.equals(monochromeRepeat)) {
    throw new Error("R8 review and paused physical-pack generation is not deterministic.");
  }
  await Promise.all([
    validatePdf(review, R8_FINAL_REVIEW_PAGES.length),
    validatePdf(detail, R8_DETAIL_PAGES.length),
    validatePdf(colour, R8_PHYSICAL_SPECIMENS.length),
    validatePdf(monochrome, R8_PHYSICAL_SPECIMENS.length)
  ]);
  const [reviewWhite, detailWhite, colourWhite, monochromeWhite, reviewMono, physicalMono] = await Promise.all([
    requireRenderedPdfWhiteBackground(review, pageNumbers(R8_FINAL_REVIEW_PAGES.length)),
    requireRenderedPdfWhiteBackground(detail, pageNumbers(R8_DETAIL_PAGES.length)),
    requireRenderedPdfWhiteBackground(colour, pageNumbers(R8_PHYSICAL_SPECIMENS.length)),
    requireRenderedPdfWhiteBackground(monochrome, pageNumbers(R8_PHYSICAL_SPECIMENS.length)),
    requireRenderedPdfPagesMonochrome(review, [2, 4, 6, 8], 2),
    requireRenderedPdfPagesMonochrome(monochrome, pageNumbers(R8_PHYSICAL_SPECIMENS.length), 2)
  ]);
  const operationalAfter = sha256(await readFile(operationalDbPath));
  if (operationalAfter !== operationalBefore) throw new Error("Operational database changed during R8 synthetic pack generation.");
  await mkdir(physicalRoot, { recursive: true });
  const specimenManifest = {
    status: "PAUSED_PENDING_R8_FINAL_DIGITAL_APPROVAL",
    kgIncluded: false,
    studentData: "SYNTHETIC_ONLY",
    footer: "SYNTHETIC SAMPLE - NOT FOR ISSUE",
    colour: R8_PHYSICAL_SPECIMENS.map((specimen, index) => physicalEntry(specimen, index + 1, "COLOUR")),
    monochrome: R8_PHYSICAL_SPECIMENS.map((specimen, index) => physicalEntry(specimen, index + 1, "MONOCHROME")),
    recommendedMonochromePhotocopy: "R8-MONO-03"
  };
  await Promise.all([
    writeFile(reviewPath, review),
    writeFile(detailPath, detail),
    writeFile(colourPath, colour),
    writeFile(monochromePath, monochrome),
    writeFile(instructionsPath, printInstructions()),
    writeFile(specimenManifestPath, JSON.stringify(specimenManifest, null, 2) + "\n"),
    writeFile(digitalManifestPath, JSON.stringify({
      status: "REPORT_TEMPLATE_R8_FINAL_DIGITAL_APPROVAL_PENDING",
      prompt: "REPORT-PRINT-ACCEPT-1A-R8",
      productionFamilies: NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES,
      v1Scope: ["CLASSES_I_II", "CLASSES_III_V", "CLASSES_VI_VIII", "CLASSES_IX_X"],
      kgStatus: "IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5",
      physicalPrintingAuthorised: false,
      realReportPublished: false,
      sourcePagesIncluded: false,
      studentData: "SYNTHETIC_ONLY",
      signatureClearanceMm: Number((R8_SIGNATURE_GEOMETRY.clearSigningHeightPt / 72 * 25.4).toFixed(2)),
      operationalDatabase: { sha256Before: operationalBefore, sha256After: operationalAfter, byteIdentical: true },
      packs: [
        packEntry(reviewPath, review, R8_FINAL_REVIEW_PAGES.length, reviewWhite, reviewMono),
        packEntry(detailPath, detail, R8_DETAIL_PAGES.length, detailWhite),
        packEntry(colourPath, colour, R8_PHYSICAL_SPECIMENS.length, colourWhite),
        packEntry(monochromePath, monochrome, R8_PHYSICAL_SPECIMENS.length, monochromeWhite, physicalMono)
      ]
    }, null, 2) + "\n")
  ]);
  process.stdout.write(JSON.stringify({
    result: "REPORT_TEMPLATE_R8_PACKS_GENERATED_FOR_DIGITAL_APPROVAL",
    outputRoot,
    reviewPath,
    detailPath,
    colourPath,
    monochromePath,
    instructionsPath,
    specimenManifestPath,
    pages: { review: R8_FINAL_REVIEW_PAGES.length, detail: R8_DETAIL_PAGES.length, colour: R8_PHYSICAL_SPECIMENS.length, monochrome: R8_PHYSICAL_SPECIMENS.length },
    physicalPrintingAuthorised: false,
    kgIncluded: false,
    operationalDatabaseByteIdentical: true,
    hashes: { review: sha256(review), detail: sha256(detail), colour: sha256(colour), monochrome: sha256(monochrome) }
  }, null, 2));
}

function packEntry(file: string, bytes: Buffer, pages: number, whiteBackgroundChecks: unknown, monochromeChecks?: unknown) {
  return { file: path.basename(file), pages, sha256: sha256(bytes), whiteBackgroundChecks, ...(monochromeChecks ? { monochromeChecks } : {}) };
}

function physicalEntry(specimen: (typeof R8_PHYSICAL_SPECIMENS)[number], page: number, mode: "COLOUR" | "MONOCHROME") {
  return {
    specimenId: `R8-${mode === "COLOUR" ? "CLR" : "MONO"}-${String(page).padStart(2, "0")}`,
    classFamily: specimen.classFamily,
    examinationLayout: specimen.examinationLayout,
    colourMode: mode,
    sourcePageNumber: page,
    reasonDistinct: specimen.distinctReason
  };
}

function printInstructions() {
  return [
    "REPORT-PRINT-ACCEPT-1A-R8 - PAUSED PHYSICAL ACCEPTANCE INSTRUCTIONS",
    "",
    "DO NOT PRINT until the R8 final digital review is approved in this thread.",
    "Synthetic Classes I-X specimens only. No KG/LKG/UKG pages are included.",
    "",
    "After digital approval: print on A4 at Actual Size / 100%; record any printer-enforced scaling.",
    "Use normal office-printer quality. Print the colour pack in native colour and the monochrome pack in native B/W or grayscale.",
    "Photocopy the manifest-recommended monochrome page once and retain only privacy-safe synthetic evidence.",
    "Check marks legibility, complete labels, chart values, 15 mm signing space, margins, page order and blank-page absence.",
    "Every page must read SYNTHETIC SAMPLE - NOT FOR ISSUE. Do not print or upload any real Student report."
  ].join("\r\n") + "\r\n";
}

async function validatePdf(bytes: Buffer, expectedPages: number) {
  const document = await PDFDocument.load(bytes);
  if (document.getPageCount() !== expectedPages) throw new Error(`R8 PDF page count is unstable (${document.getPageCount()} != ${expectedPages}).`);
  for (const page of document.getPages()) {
    if (Math.abs(page.getWidth() - 595.28) > 0.1 || Math.abs(page.getHeight() - 841.89) > 0.1) throw new Error("R8 PDF page is not exact A4.");
    if (!page.node.Contents()) throw new Error("R8 PDF contains a blank page.");
  }
}

function pageNumbers(count: number) {
  return Array.from({ length: count }, (_, index) => index + 1);
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
