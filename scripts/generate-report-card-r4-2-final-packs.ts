import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../lib/prisma";
import { createReportZip } from "../lib/report-pdf";
import { requireRenderedPdfPagesMonochrome } from "../lib/report-card-monochrome-validation";
import {
  FINAL_ACADEMIC_PAGE_SPECS,
  FINAL_KG_PAGE_SPECS,
  R4_MINIMUM_FONT_SIZES,
  buildFinalAcademicSnapshot,
  renderFinalSourceLockedPack,
  renderPhysicalAcceptancePack,
  renderR42EdgePack,
  resolveReportSchoolIdentity
} from "../lib/report-card-refined-source-lock";
import { getSchoolSettings } from "../lib/school-settings";

const workspace = path.resolve(process.cwd());
const outputRoot = path.resolve(workspace, ".codex", "report-print-accept-1a", "final-print-pack");
const supersededRoot = path.resolve(workspace, ".codex", "report-print-accept-1a", "print-pack");
const A4 = { width: 595.28, height: 841.89 };
const expectedFullPages = FINAL_KG_PAGE_SPECS.length + FINAL_ACADEMIC_PAGE_SPECS.length;
const physicalAcademic = FINAL_ACADEMIC_PAGE_SPECS.filter((specimen) => specimen.physicalInclude);
const expectedPhysicalPages = FINAL_KG_PAGE_SPECS.length + physicalAcademic.length;

async function main() {
  safeResetOutputRoot();
  const settings = await getSchoolSettings(prisma);
  const activeTemplates = await prisma.reportCardTemplate.findMany({
    where: { status: "ACTIVE" },
    select: { templateDefinitionJson: true }
  });
  const identity = resolveReportSchoolIdentity(
    settings,
    activeTemplates.map((row) => JSON.parse(row.templateDefinitionJson))
  );

  const colour = await requireDeterministic(() => renderFinalSourceLockedPack("COLOUR", identity), "FINAL_COLOUR");
  const monochrome = await requireDeterministic(() => renderFinalSourceLockedPack("MONOCHROME", identity), "FINAL_MONOCHROME");
  const physicalColour = await requireDeterministic(() => renderPhysicalAcceptancePack("COLOUR", identity), "PHYSICAL_COLOUR");
  const physicalMonochrome = await requireDeterministic(() => renderPhysicalAcceptancePack("MONOCHROME", identity), "PHYSICAL_MONOCHROME");
  const edge = await requireDeterministic(() => renderR42EdgePack(identity), "EDGE_R42");

  const documents = {
    "RC-SYN-final-colour.pdf": await validatePdf(colour, expectedFullPages),
    "RC-SYN-final-monochrome.pdf": await validatePdf(monochrome, expectedFullPages),
    "PHYSICAL-ACCEPTANCE-COLOUR.pdf": await validatePdf(physicalColour, expectedPhysicalPages),
    "PHYSICAL-ACCEPTANCE-MONOCHROME.pdf": await validatePdf(physicalMonochrome, expectedPhysicalPages),
    "EDGE-CASE-RENDERING-PACK-R4-2.pdf": await validatePdf(edge, 4)
  };
  const monochromeChecks = {
    final: await requireRenderedPdfPagesMonochrome(monochrome, pageNumbers(expectedFullPages)),
    physical: await requireRenderedPdfPagesMonochrome(physicalMonochrome, pageNumbers(expectedPhysicalPages)),
    edge: await requireRenderedPdfPagesMonochrome(edge, [3, 4])
  };
  requireNoChromaticPixels(monochromeChecks);

  for (const specimen of FINAL_ACADEMIC_PAGE_SPECS) {
    const report = buildFinalAcademicSnapshot(specimen);
    requireSyntheticSnapshot(report.studentName, report.guardianName, report.admissionNumber);
    report.subjects.forEach((subject) => {
      if (/\.\.\.|…/.test(subject.label)) throw new Error(`ELLIPSIS_IN_SUBJECT_${specimen.specimenId}_${subject.key}`);
    });
  }

  const files: Record<string, Buffer> = {
    "RC-SYN-final-colour.pdf": colour,
    "RC-SYN-final-monochrome.pdf": monochrome,
    "PHYSICAL-ACCEPTANCE-COLOUR.pdf": physicalColour,
    "PHYSICAL-ACCEPTANCE-MONOCHROME.pdf": physicalMonochrome,
    "EDGE-CASE-RENDERING-PACK-R4-2.pdf": edge
  };
  Object.entries(files).forEach(([name, bytes]) => writeFileSync(path.join(outputRoot, name), bytes));

  const physicalManifest = buildPhysicalManifest();
  const physicalManifestBytes = Buffer.from(JSON.stringify(physicalManifest, null, 2) + "\n");
  const instructions = Buffer.from(printInstructions(), "utf8");
  writeFileSync(path.join(outputRoot, "PRINT-INSTRUCTIONS-FINAL.txt"), instructions);
  writeFileSync(path.join(outputRoot, "PHYSICAL-ACCEPTANCE-SPECIMEN-MANIFEST.json"), physicalManifestBytes);

  const zipEntries = [
    { name: "RC-SYN-final-colour.pdf", bytes: colour },
    { name: "RC-SYN-final-monochrome.pdf", bytes: monochrome },
    { name: "PHYSICAL-ACCEPTANCE-COLOUR.pdf", bytes: physicalColour },
    { name: "PHYSICAL-ACCEPTANCE-MONOCHROME.pdf", bytes: physicalMonochrome },
    { name: "PRINT-INSTRUCTIONS-FINAL.txt", bytes: instructions },
    { name: "PHYSICAL-ACCEPTANCE-SPECIMEN-MANIFEST.json", bytes: physicalManifestBytes }
  ];
  const zip = createReportZip(zipEntries);
  const zipRepeat = createReportZip(zipEntries);
  if (!zip.equals(zipRepeat)) throw new Error("FINAL_PACK_ZIP_NOT_DETERMINISTIC");
  writeFileSync(path.join(outputRoot, "RC-SYN-final-packs.zip"), zip);

  const qaManifest = {
    status: "PHYSICAL_PRINT_GATE_PENDING",
    generatedAt: "2026-08-11T00:00:00.000Z",
    syntheticOnly: true,
    sourcePagesIncluded: false,
    restrictedSourceArtifactsIncluded: false,
    realStudentReportsPublished: false,
    templateFamilies: ["NALANDA_LEGACY_REFINED_COLOUR", "NALANDA_LEGACY_REFINED_MONOCHROME"],
    chartLabelContractVersion: 1,
    minimumFontSizesPt: R4_MINIMUM_FONT_SIZES,
    expectedFullPages,
    expectedPhysicalPages,
    kgPageOrder: FINAL_KG_PAGE_SPECS.map((page, index) => ({ page: index + 1, specimenId: page.specimenId, title: page.title })),
    academicPages: FINAL_ACADEMIC_PAGE_SPECS.map((page, index) => ({ page: FINAL_KG_PAGE_SPECS.length + index + 1, ...page })),
    documents,
    monochromeChecks,
    zip: { file: "RC-SYN-final-packs.zip", sha256: sha256(zip), byteLength: zip.length, deterministic: true },
    physicalPrintingCompleted: false,
    mergeOrTagPerformed: false,
    deploymentPerformed: false
  };
  writeFileSync(path.join(outputRoot, "FINAL-DIGITAL-QA-MANIFEST.json"), JSON.stringify(qaManifest, null, 2) + "\n");

  mkdirSync(supersededRoot, { recursive: true });
  writeFileSync(path.join(supersededRoot, "SUPERSEDED_BY_R4_2_FINAL_PACKS.txt"), [
    "The earlier RC-SYN merged colour and monochrome packs are preserved as technical QA evidence.",
    "They are superseded for visual and physical acceptance by the ignored R4.2 final-print-pack artifacts.",
    "Do not print the earlier packs for acceptance."
  ].join("\r\n") + "\r\n");

  process.stdout.write(JSON.stringify({
    result: "REPORT_CARD_R4_2_FINAL_PACKS_GENERATED",
    outputRoot,
    fullPagesPerMode: expectedFullPages,
    physicalPagesPerMode: expectedPhysicalPages,
    monochromePagesInspected: expectedFullPages + expectedPhysicalPages + 2,
    chromaticPixels: 0,
    zipDeterministic: true,
    physicalPrintGatePending: true
  }, null, 2));
}

async function requireDeterministic(render: () => Promise<Buffer>, label: string) {
  const first = await render();
  const second = await render();
  if (!first.equals(second)) throw new Error(`${label}_NOT_DETERMINISTIC`);
  return first;
}

async function validatePdf(bytes: Buffer, expectedPages: number) {
  const document = await PDFDocument.load(bytes);
  if (document.getPageCount() !== expectedPages) {
    throw new Error(`PDF_PAGE_COUNT_${document.getPageCount()}_EXPECTED_${expectedPages}`);
  }
  document.getPages().forEach((page, index) => {
    if (Math.abs(page.getWidth() - A4.width) > 0.75 || Math.abs(page.getHeight() - A4.height) > 0.75) {
      throw new Error(`PDF_PAGE_${index + 1}_NOT_A4_${page.getWidth()}x${page.getHeight()}`);
    }
    if (!page.node.Contents()) throw new Error(`PDF_PAGE_${index + 1}_BLANK`);
  });
  return {
    pageCount: document.getPageCount(),
    a4Pages: true,
    blankTrailingPage: false,
    sha256: sha256(bytes),
    byteLength: bytes.length
  };
}

function buildPhysicalManifest() {
  const entries: Array<Record<string, unknown>> = [];
  for (const mode of ["COLOUR", "MONOCHROME"] as const) {
    FINAL_KG_PAGE_SPECS.forEach((specimen, index) => entries.push({
      specimenId: `${specimen.specimenId}-${mode === "COLOUR" ? "C" : "M"}`,
      classFamily: "KG_DEVELOPMENTAL_BOOKLET",
      examinationLayout: "DEVELOPMENTAL_BOOKLET",
      colourMode: mode,
      sourcePageNumber: index + 1,
      physicalPackPageNumber: index + 1,
      reasonDistinct: specimen.distinctReason,
      recommendedForMonochromePhotocopy: mode === "MONOCHROME" && specimen.specimenId === "KG-04-INTELLECTUAL"
    }));
    physicalAcademic.forEach((specimen, physicalIndex) => {
      const sourcePageNumber = FINAL_KG_PAGE_SPECS.length + FINAL_ACADEMIC_PAGE_SPECS.findIndex((candidate) => candidate.specimenId === specimen.specimenId) + 1;
      entries.push({
        specimenId: `${specimen.specimenId}-${mode === "COLOUR" ? "C" : "M"}`,
        classFamily: specimen.classFamily,
        examinationLayout: specimen.examinationLayout,
        colourMode: mode,
        sourcePageNumber,
        physicalPackPageNumber: FINAL_KG_PAGE_SPECS.length + physicalIndex + 1,
        reasonDistinct: specimen.distinctReason,
        recommendedForMonochromePhotocopy: mode === "MONOCHROME" && specimen.specimenId === "IX-X-COMBINED"
      });
    });
  }
  return {
    status: "PHYSICAL_PRINT_GATE_PENDING",
    syntheticOnly: true,
    footer: "SYNTHETIC SAMPLE - NOT FOR ISSUE",
    fullPackPagesPerMode: expectedFullPages,
    physicalPackPagesPerMode: expectedPhysicalPages,
    recommendedMonochromePhotocopy: { specimenId: "IX-X-COMBINED-M", physicalPackPageNumber: expectedPhysicalPages },
    entries
  };
}

function printInstructions() {
  return [
    "REPORT-PRINT-ACCEPT-1A-R4.2 - SYNTHETIC PHYSICAL ACCEPTANCE",
    "",
    "Use only the two PHYSICAL-ACCEPTANCE PDFs in this directory for this gate.",
    "Every page is synthetic and marked SYNTHETIC SAMPLE - NOT FOR ISSUE.",
    "Do not substitute, scan, upload or compare a real Student report.",
    "",
    "Paper size: A4.",
    "Paper type: ordinary office paper.",
    "Scale: Actual Size / 100%. Record any scaling enforced by the printer.",
    "Quality: normal office-printer quality.",
    "Colour pack: native colour mode.",
    "Monochrome pack: native grayscale/B&W mode; do not rely on driver conversion of the colour pack.",
    "Print the full ten-page KG sequence in ordinary page order. Do not use booklet imposition for canonical acceptance.",
    "Photocopy the manifest-recommended Class IX monochrome specimen once.",
    "",
    "For each specimen record printer/model, paper size/type, scale, colour or grayscale mode, clipping, text readability, table alignment, logo sharpness, chart-pattern distinction, signature space, reference readability, page order, blank pages, pass/fail and corrections needed.",
    "Physical acceptance has not occurred until these observations are returned in this Codex task."
  ].join("\r\n") + "\r\n";
}

function safeResetOutputRoot() {
  const expected = path.resolve(workspace, ".codex", "report-print-accept-1a", "final-print-pack");
  if (outputRoot !== expected || !outputRoot.startsWith(path.resolve(workspace, ".codex") + path.sep)) {
    throw new Error("FINAL_PACK_OUTPUT_ROOT_REFUSED");
  }
  if (existsSync(outputRoot)) rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(outputRoot, { recursive: true });
}

function requireNoChromaticPixels(value: Record<string, Array<{ chromaticPixels: number }>>) {
  const chromatic = Object.values(value).flat().reduce((total, page) => total + page.chromaticPixels, 0);
  if (chromatic !== 0) throw new Error(`MONOCHROME_CHROMATIC_PIXELS_${chromatic}`);
}

function requireSyntheticSnapshot(...values: string[]) {
  if (values.some((value) => !/SYN|Aarav|Rahman/i.test(value))) {
    throw new Error("NON_SYNTHETIC_IDENTITY_IN_FINAL_PACK");
  }
}

function pageNumbers(count: number) {
  return Array.from({ length: count }, (_, index) => index + 1);
}

function sha256(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

main()
  .catch((error) => {
    process.stderr.write((error instanceof Error ? error.stack || error.message : String(error)) + "\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
