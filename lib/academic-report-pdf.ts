import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AcademicReportSummary } from "@/lib/academic-reporting-types";
import { PRODUCT_BRAND } from "@/config/product-brand";

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 42;
const PATTERNS: Record<string,string> = { SOLID: "[####]", DIAGONAL: "[////]", DOT: "[....]", CROSS: "[xxxx]", HORIZONTAL: "[====]" };

export async function renderAcademicReportPdf(summary: AcademicReportSummary, mode: "COLOUR" | "MONOCHROME") {
  const document = await PDFDocument.create();
  document.setTitle(summary.title);
  document.setAuthor("Nalanda governed academic reporting");
  document.setSubject("Governed academic report generated from locked and issued versions");
  document.setCreator(PRODUCT_BRAND.productName);
  document.setProducer("Nalanda governed academic reporting");
  document.setCreationDate(new Date("2000-01-01T00:00:00.000Z"));
  document.setModificationDate(new Date("2000-01-01T00:00:00.000Z"));
  const regular = await document.embedFont(StandardFonts.Helvetica), bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page = document.addPage(PAGE), y = PAGE[1] - MARGIN;
  const colour = mode === "MONOCHROME" ? rgb(0,0,0) : rgb(0.06,0.25,0.42);
  const line = (text: string, options: { bold?: boolean; size?: number; indent?: number } = {}) => {
    const size = options.size ?? 8.5, font = options.bold ? bold : regular, indent = options.indent ?? 0;
    for (const part of wrap(text, options.bold ? 78 : 104)) {
      if (y < MARGIN + 18) { page = document.addPage(PAGE); y = PAGE[1] - MARGIN; }
      page.drawText(part, { x: MARGIN + indent, y, size, font, color: options.bold ? colour : rgb(0,0,0) }); y -= size + 4;
    }
  };
  line(summary.title, { bold: true, size: 16 });
  line(`Generated: ${summary.generatedAt}`);
  line(summary.sourceStatement);
  if (summary.boardClassDisclaimer) line(`Class IX/X boundary: ${summary.boardClassDisclaimer}`, { bold: true });
  for (const warning of summary.warnings) line(`WARNING: ${warning}`, { bold: true });
  line(`Source versions: ${summary.sourceVersions.length}; compatibility checks: ${summary.compatibility.length}; viewer suppression: ${summary.suppressed ? "applied" : "not applicable"}.`);
  for (const section of summary.sections) {
    y -= 7; line(section.title, { bold: true, size: 12 }); line(section.description);
    if (section.chart) { line(`Chart: ${section.chart.label}`, { bold: true }); for (const series of section.chart.series) line(`${PATTERNS[series.pattern]} ${series.label}: ${series.value}`, { indent: 8 }); }
    line(section.columns.join(" | "), { bold: true });
    for (const row of section.rows) line(section.columns.map((column) => safeText(row[column])).join(" | "));
  }
  y -= 8; line("Internal governed evidence only. No external provider transfer. Historical output remains bound to the source versions listed in the report run.", { bold: true });
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

function safeText(value: unknown) { return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 240); }
function wrap(value: string, maximum: number) { const words = safeText(value).split(/\s+/), lines: string[] = []; let line = ""; for (const word of words) { const next = line ? `${line} ${word}` : word; if (next.length > maximum && line) { lines.push(line); line = word; } else line = next; } if (line) lines.push(line); return lines.length ? lines : [""]; }
