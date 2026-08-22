import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { requireRenderedPdfPagesMonochrome, requireRenderedPdfWhiteBackground } from "../lib/report-card-monochrome-validation";
import { syntheticReport } from "../lib/report-card-synthetic-specimens";
import { renderReportPdf } from "../lib/report-pdf";

const outputRoot = path.resolve(process.cwd(), ".codex", "kg-reports-v1-5-1a", "pdf");
const pages = Array.from({ length: 10 }, (_, index) => index + 1);

function sha256(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function validate(bytes: Buffer) {
  const document = await PDFDocument.load(bytes);
  if (document.getPageCount() !== 10) throw new Error(`KG15PDF_PAGE_COUNT_${document.getPageCount()}`);
  for (const page of document.getPages()) {
    const { width, height } = page.getSize();
    if (Math.abs(width - 595.28) > 0.75 || Math.abs(height - 841.89) > 0.75) throw new Error("KG15PDF_NOT_A4_PORTRAIT");
    if (!page.node.Contents()) throw new Error("KG15PDF_BLANK_PAGE");
  }
}

async function main() {
  const lkg = syntheticReport("KG_DEVELOPMENTAL_BOOKLET", "DEVELOPMENTAL_BOOKLET", "KG15-LKG", 0);
  const ukg = syntheticReport("KG_DEVELOPMENTAL_BOOKLET", "DEVELOPMENTAL_BOOKLET", "KG15-UKG", 1);
  lkg.status = "ISSUED";
  lkg.student.className = "LKG";
  lkg.student.section = "SYN-A";
  lkg.title = "LKG Evaluations I-V Developmental Report";
  ukg.status = "ISSUED";
  ukg.student.className = "UKG";
  ukg.student.section = "SYN-B";
  ukg.title = "UKG Evaluations I-V Developmental Report";
  const requests = [
    { name: "LKG-COLOUR.pdf", report: lkg, mode: "COLOUR" as const },
    { name: "LKG-MONOCHROME.pdf", report: lkg, mode: "MONOCHROME" as const },
    { name: "UKG-COLOUR.pdf", report: ukg, mode: "COLOUR" as const },
    { name: "UKG-MONOCHROME.pdf", report: ukg, mode: "MONOCHROME" as const }
  ];
  const rendered = await Promise.all(requests.map(async (request) => ({ ...request, bytes: await renderReportPdf(request.report, request.mode) })));
  for (const item of rendered) await validate(item.bytes);
  const mono = rendered.filter((item) => item.mode === "MONOCHROME");
  const monoInspection = await Promise.all(mono.map((item) => requireRenderedPdfPagesMonochrome(item.bytes, pages, 2)));
  const whiteBackground = await Promise.all(rendered.map((item) => requireRenderedPdfWhiteBackground(item.bytes, pages)));
  await mkdir(outputRoot, { recursive: true });
  await Promise.all(rendered.map((item) => writeFile(path.join(outputRoot, item.name), item.bytes)));
  const manifest = {
    result: "KG_REPORTS_V1_5_PDF_QA_PASSED",
    syntheticOnly: true,
    physicalPrintingAuthorised: false,
    schoolNameTypography: "Georgia Bold",
    pageCountPerPdf: 10,
    files: rendered.map((item) => ({ name: item.name, mode: item.mode, className: item.report.student.className, bytes: item.bytes.length, sha256: sha256(item.bytes) })),
    monochrome: monoInspection.map((inspection, index) => ({ file: mono[index].name, pages: inspection.length, chromaticPixels: inspection.reduce((sum, page) => sum + page.chromaticPixels, 0), maximumChannelDifference: Math.max(...inspection.map((page) => page.maximumChannelDifference)) })),
    whiteBackgroundChecks: whiteBackground.map((inspection, index) => ({ file: rendered[index].name, pages: inspection.length }))
  };
  await writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ ...manifest, outputRoot }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
