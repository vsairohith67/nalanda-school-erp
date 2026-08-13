import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../lib/prisma";
import {
  NALANDA_LEGACY_REFINED_TEMPLATE_FAMILIES,
  R5_DETAIL_PAGES,
  R5_VISUAL_PAGES,
  renderR5DetailChecks,
  renderR5EdgePack,
  renderR5VisualPack,
  resolveReportSchoolIdentity
} from "../lib/report-card-refined-source-lock";
import {
  requireRenderedPdfPagesMonochrome,
  requireRenderedPdfWhiteBackground
} from "../lib/report-card-monochrome-validation";
import { getSchoolSettings } from "../lib/school-settings";

const outputRoot = path.resolve(process.cwd(), ".codex", "report-print-accept-1a", "r5");

async function main() {
  const settings = await getSchoolSettings(prisma);
  const identity = resolveReportSchoolIdentity(settings, [{
    schoolIdentity: {
      affiliationWording: "(Affiliated to CISCE, New Delhi, Estd. 1972)"
    }
  }]);

  const [visual, visualRepeat, detail, detailRepeat, edge, edgeRepeat] = await Promise.all([
    renderR5VisualPack(identity),
    renderR5VisualPack(identity),
    renderR5DetailChecks(identity),
    renderR5DetailChecks(identity),
    renderR5EdgePack(identity),
    renderR5EdgePack(identity)
  ]);
  if (!visual.equals(visualRepeat) || !detail.equals(detailRepeat) || !edge.equals(edgeRepeat)) {
    throw new Error("R5 review-pack generation is not deterministic.");
  }
  await validatePdf(visual, 10);
  await validatePdf(detail, 7);
  await validatePdf(edge, 6);
  const [visualWhite, detailWhite, edgeWhite, visualMono, detailMono, edgeMono] = await Promise.all([
    requireRenderedPdfWhiteBackground(visual, Array.from({ length: 10 }, (_, index) => index + 1)),
    requireRenderedPdfWhiteBackground(detail, Array.from({ length: 7 }, (_, index) => index + 1)),
    requireRenderedPdfWhiteBackground(edge, Array.from({ length: 6 }, (_, index) => index + 1)),
    requireRenderedPdfPagesMonochrome(visual, [7, 8, 9, 10], 2),
    requireRenderedPdfPagesMonochrome(detail, [2, 5, 6], 2),
    requireRenderedPdfPagesMonochrome(edge, [5, 6], 2)
  ]);

  await mkdir(outputRoot, { recursive: true });
  const visualPath = path.join(outputRoot, "VISUAL-DIRECTION-PACK-R5.pdf");
  const detailPath = path.join(outputRoot, "R5-DETAIL-CHECKS.pdf");
  const edgePath = path.join(outputRoot, "EDGE-CASE-RENDERING-PACK-R5.pdf");
  const manifestPath = path.join(outputRoot, "R5-DIGITAL-REVIEW-MANIFEST.json");
  await Promise.all([
    writeFile(visualPath, visual),
    writeFile(detailPath, detail),
    writeFile(edgePath, edge),
    writeFile(manifestPath, JSON.stringify({
      status: "REPORT_TEMPLATE_R5_DIGITAL_REVIEW_PENDING",
      amendment: "REPORT-PRINT-ACCEPT-1A-R5-A1",
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
      supersededEvidenceStatus: "SUPERSEDED_BY_R5_A1",
      packs: [
        { file: path.basename(visualPath), pages: 10, sha256: sha256(visual), specimens: R5_VISUAL_PAGES, whiteBackgroundChecks: visualWhite, monochromeChecks: visualMono },
        { file: path.basename(detailPath), pages: 7, sha256: sha256(detail), details: R5_DETAIL_PAGES, whiteBackgroundChecks: detailWhite, monochromeChecks: detailMono },
        { file: path.basename(edgePath), pages: 6, sha256: sha256(edge), whiteBackgroundChecks: edgeWhite, monochromeChecks: edgeMono }
      ]
    }, null, 2) + "\n")
  ]);

  process.stdout.write(JSON.stringify({
    result: "REPORT_TEMPLATE_R5_PACKS_GENERATED",
    outputRoot,
    visualPath,
    detailPath,
    edgePath,
    visualPages: 10,
    detailPages: 7,
    edgePages: 6,
    physicalPrintingAuthorised: false,
    fullPhysicalPackRegenerated: false,
    visualSha256: sha256(visual),
    detailSha256: sha256(detail),
    edgeSha256: sha256(edge)
  }, null, 2));
}

async function validatePdf(bytes: Buffer, expectedPages: number) {
  const document = await PDFDocument.load(bytes);
  if (document.getPageCount() !== expectedPages) throw new Error("R5 PDF page count is unstable.");
  for (const page of document.getPages()) {
    if (Math.abs(page.getWidth() - 595.28) > 0.1 || Math.abs(page.getHeight() - 841.89) > 0.1) {
      throw new Error("R5 PDF page is not exact A4.");
    }
    if (!page.node.Contents()) throw new Error("R5 PDF contains a blank page.");
  }
}

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

main()
  .catch((error) => {
    process.stderr.write((error instanceof Error ? error.stack || error.message : String(error)) + "\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
