import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFEmbeddedPage, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import {
  renderVisualDirectionPack,
  renderVisualDirectionPage,
  VISUAL_DIRECTION_PAGE_KINDS,
  type ReportVisualDirection,
  type VisualDirectionPageKind
} from "../lib/report-card-visual-direction";

const outputRoot = path.resolve(process.cwd(), ".codex", "report-print-accept-1a", "source-fidelity");
const sourceRoot = path.join(outputRoot, "private-source");

const sourcePageByKind: Record<VisualDirectionPageKind, { file: string; pageIndex: number }> = {
  KG_COVER: { file: "source-KG.pdf", pageIndex: 0 },
  KG_PROFILE: { file: "source-KG.pdf", pageIndex: 1 },
  KG_INTELLECTUAL: { file: "source-KG.pdf", pageIndex: 3 },
  CLASS_II_SESSION: { file: "source-II.pdf", pageIndex: 0 },
  CLASS_V_SESSION: { file: "source-V.pdf", pageIndex: 0 },
  CLASS_VI_GROUPED: { file: "source-VI.pdf", pageIndex: 0 },
  CLASS_IX_COMBINED: { file: "source-IX-COMBINED.pdf", pageIndex: 0 },
  CLASS_X_CT_REVISION: { file: "source-X.pdf", pageIndex: 0 }
};

async function main() {
  await mkdir(outputRoot, { recursive: true });
  const visualPack = await renderVisualDirectionPack(false);
  const edgePack = await renderVisualDirectionPack(true);
  const comparison = await renderComparisonPack();

  await Promise.all([
    writeFile(path.join(outputRoot, "VISUAL-DIRECTION-PACK.pdf"), visualPack),
    writeFile(path.join(outputRoot, "SYNTHETIC-VISUAL-APPROVAL-PACK.pdf"), visualPack),
    writeFile(path.join(outputRoot, "EDGE-CASE-RENDERING-PACK.pdf"), edgePack),
    writeFile(path.join(outputRoot, "LOCAL-ONLY-SOURCE-VS-SYNTHETIC-COMPARISON.pdf"), comparison),
    writeFile(
      path.join(outputRoot, "pack-manifest.json"),
      `${JSON.stringify({
        status: "SOURCE_FIDELITY_VISUAL_DIRECTION_IN_PROGRESS",
        targetStyle: "NALANDA_LEGACY_REFINED",
        generatedAt: new Date().toISOString(),
        syntheticOnlyPacks: [
          { file: "VISUAL-DIRECTION-PACK.pdf", pages: 16, sourcePagesIncluded: false },
          { file: "SYNTHETIC-VISUAL-APPROVAL-PACK.pdf", pages: 16, sourcePagesIncluded: false },
          { file: "EDGE-CASE-RENDERING-PACK.pdf", pages: 8, sourcePagesIncluded: false }
        ],
        localOnlyComparison: {
          file: "LOCAL-ONLY-SOURCE-VS-SYNTHETIC-COMPARISON.pdf",
          pages: 16,
          sourcePagesIncluded: true,
          committedOrSynced: false
        },
        sourceAudit: { uniqueSourcePages: 70, studentDataUsedInSyntheticPacks: false },
        physicalPrintingAuthorised: false,
        oldPacks: "SUPERSEDED_FOR_VISUAL_APPROVAL"
      }, null, 2)}\n`
    ),
    writeFile(
      path.join(outputRoot, "REVIEW-INSTRUCTIONS.txt"),
      [
        "LOCAL VISUAL-DIRECTION REVIEW - SYNTHETIC DATA ONLY",
        "",
        "VISUAL-DIRECTION-PACK.pdf contains LEGACY_EXACT and LEGACY_REFINED pairs.",
        "EDGE-CASE-RENDERING-PACK.pdf is stress-test evidence and is not the design-approval pack.",
        "LOCAL-ONLY-SOURCE-VS-SYNTHETIC-COMPARISON.pdf contains restricted source pages.",
        "Do not upload, sync, share, print, or commit the local-only comparison.",
        "Physical printing remains paused pending normal-language visual approval."
      ].join("\r\n")
    )
  ]);

  process.stdout.write(JSON.stringify({
    outputRoot,
    visualDirectionPages: 16,
    edgeCasePages: 8,
    comparisonPages: 16,
    physicalPrintingAuthorised: false
  }, null, 2));
}

async function renderComparisonPack() {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const directions: ReportVisualDirection[] = ["LEGACY_EXACT", "LEGACY_REFINED"];

  for (const kind of VISUAL_DIRECTION_PAGE_KINDS) {
    const source = sourcePageByKind[kind];
    const sourceBytes = await readFile(path.join(sourceRoot, source.file));
    for (const direction of directions) {
      const syntheticBytes = await renderVisualDirectionPage(kind, direction, false);
      const [sourcePage] = await document.embedPdf(sourceBytes, [source.pageIndex]);
      const [syntheticPage] = await document.embedPdf(syntheticBytes, [0]);
      const page = document.addPage([841.89, 595.28]);
      drawComparisonPage(page, regular, bold, kind, direction, sourcePage, syntheticPage);
    }
  }

  document.setTitle("LOCAL-ONLY-SOURCE-VS-SYNTHETIC-COMPARISON");
  document.setSubject("Restricted local comparison - never commit, upload, sync, or print");
  document.setProducer("Nalanda ERP local restricted source-fidelity comparison");
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

function drawComparisonPage(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  kind: VisualDirectionPageKind,
  direction: ReportVisualDirection,
  source: PDFEmbeddedPage,
  synthetic: PDFEmbeddedPage
) {
  const width = page.getWidth();
  const height = page.getHeight();
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.93, 0.93, 0.91) });
  page.drawRectangle({ x: 0, y: height - 30, width, height: 30, color: rgb(0.38, 0.04, 0.1) });
  page.drawText("RESTRICTED LOCAL-ONLY SOURCE COMPARISON - DO NOT COMMIT, UPLOAD, SYNC OR PRINT", {
    x: 98,
    y: height - 19,
    size: 9,
    font: bold,
    color: rgb(1, 1, 1)
  });
  page.drawText(`${kind} - ${direction}`, { x: 28, y: height - 48, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("Restricted historical source", { x: 70, y: 27, size: 7.5, font: regular, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("Synthetic recalibrated direction", { x: 530, y: 27, size: 7.5, font: regular, color: rgb(0.2, 0.2, 0.2) });
  const box = { top: 54, bottom: 38, side: 22, gap: 16 };
  const boxWidth = (width - box.side * 2 - box.gap) / 2;
  const boxHeight = height - box.top - box.bottom;
  drawContainedPage(page, source, box.side, box.bottom, boxWidth, boxHeight);
  drawContainedPage(page, synthetic, box.side + boxWidth + box.gap, box.bottom, boxWidth, boxHeight);
  page.drawLine({ start: { x: width / 2, y: box.bottom }, end: { x: width / 2, y: box.bottom + boxHeight }, thickness: 0.7, color: rgb(0.55, 0.55, 0.55) });
}

function drawContainedPage(page: PDFPage, embedded: PDFEmbeddedPage, x: number, y: number, width: number, height: number) {
  const scale = Math.min(width / embedded.width, height / embedded.height);
  const drawWidth = embedded.width * scale;
  const drawHeight = embedded.height * scale;
  page.drawPage(embedded, {
    x: x + (width - drawWidth) / 2,
    y: y + (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
