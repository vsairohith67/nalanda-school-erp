import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import sharp from "sharp";
import {
  PDFDocument,
  type PDFImage,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb
} from "pdf-lib";
import { zipSync } from "fflate";
import type {
  PublishedReportSnapshot,
  ReportColourMode,
  SafePublishedReportSnapshot
} from "@/lib/report-publication-types";
import { reportTemplateFamilyLabel } from "@/lib/report-publication-types";
import {
  R5_CHART_LABEL_CLEARANCE_PT,
  R5_CHART_NUMERIC_LABEL_FONT_SIZE,
  R6_CHART_LEGEND_GEOMETRY,
  R6_DENSE_CHART_GEOMETRY,
  R6_MONOCHROME_STUDENT_GREY,
  R7_HEADER_TYPOGRAPHY,
  R7_PATTERN_GEOMETRY,
  R8_SIGNATURE_GEOMETRY,
  R8_SUMMARY_GEOMETRY,
  layoutChartNumericLabels,
  resolveR8SummaryWidths
} from "@/lib/report-card-refined-source-lock";

type RenderableReport = PublishedReportSnapshot | SafePublishedReportSnapshot;

function isCanonicalV1AcademicReport(report: RenderableReport) {
  return [
    "LOWER_PRIMARY_I_II",
    "UPPER_PRIMARY_III_V",
    "MIDDLE_VI_VIII_GROUPED",
    "SECONDARY_IX_X"
  ].includes(report.templateFamily);
}

const POINTS_PER_MM = 72 / 25.4;
const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const FONT_REGULAR_CANDIDATES = ["arial.ttf", "segoeui.ttf", "calibri.ttf"];
const FONT_BOLD_CANDIDATES = ["arialbd.ttf", "segoeuib.ttf", "calibrib.ttf"];
const SCHOOL_BOLD_CANDIDATES = ["georgiab.ttf", "Georgia Bold.ttf"];

export async function renderReportPdf(
  report: RenderableReport,
  mode: ReportColourMode
) {
  if (
    isCanonicalV1AcademicReport(report)
    && report.status === "ISSUED"
    && ![report.school.affiliationWording, report.school.recognitionWording, report.school.establishmentYear].some((value) => String(value ?? "").trim())
  ) {
    throw new Error("Report publication blocked: approved report-card status line is not configured in School Settings.");
  }
  const document = await PDFDocument.create();
  document.setTitle(`${report.title} - ${report.publicationReference}`);
  document.setAuthor(report.school.name);
  document.setSubject("Governed issued school report card");
  document.setProducer("Nalanda governed report publication");
  document.setCreator("Nalanda Fee Control");
  document.setCreationDate(new Date("2000-01-01T00:00:00.000Z"));
  document.setModificationDate(new Date("2000-01-01T00:00:00.000Z"));
  const fonts = await embeddedFonts(document);
  const logo = await embeddedLogo(
    document,
    report.school.logoPath,
    mode
  );
  const layout = new PdfLayout(document, report, mode, fonts, logo);
  if (report.templateFamily === "KG_DEVELOPMENTAL_BOOKLET") {
    renderKgBooklet(layout, report);
  } else {
    renderAcademicReport(layout, report);
  }
  layout.finish();
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function mergeReportPdfs(files: Buffer[]) {
  if (!files.length) throw new Error("At least one report PDF is required for a merged document.");
  const merged = await PDFDocument.create();
  merged.setTitle("Merged governed report cards");
  merged.setProducer("Nalanda governed report publication");
  merged.setCreationDate(new Date("2000-01-01T00:00:00.000Z"));
  merged.setModificationDate(new Date("2000-01-01T00:00:00.000Z"));
  for (const bytes of files) {
    const source = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(source, source.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
  }
  return Buffer.from(await merged.save({ useObjectStreams: false }));
}

export function createReportZip(
  files: Array<{ name: string; bytes: Buffer }>
) {
  if (!files.length) throw new Error("At least one report PDF is required for a ZIP package.");
  const entries: Record<string, [Uint8Array, { mtime: Date }]> = {};
  for (const file of [...files].sort((left, right) => left.name.localeCompare(right.name))) {
    entries[sanitizedPdfFileName(file.name)] = [
      new Uint8Array(file.bytes),
      { mtime: new Date("2000-01-01T00:00:00.000Z") }
    ];
  }
  return Buffer.from(zipSync(entries, { level: 6 }));
}

export function deterministicReportPdfName(
  report: RenderableReport,
  mode: ReportColourMode
) {
  const parts = [
    report.school.name,
    report.academicYear,
    report.student.className,
    report.student.section || "All",
    report.student.admissionNumber,
    report.publicationReference,
    mode === "MONOCHROME" ? "black-and-white" : "colour"
  ].map(filePart);
  return `${parts.join("_")}.pdf`.slice(0, 220);
}

export function deterministicBatchPackageName(
  reports: RenderableReport[],
  mode: ReportColourMode,
  format: "MERGED_PDF" | "ZIP"
) {
  const first = reports[0];
  const sections = [...new Set(reports.map((report) => report.student.section || "All"))];
  const parts = [
    first?.school.name ?? "Nalanda",
    first?.academicYear ?? "Academic-Year",
    first?.student.className ?? "Class",
    sections.length === 1 ? sections[0] : "All-Sections",
    mode === "MONOCHROME" ? "black-and-white" : "colour",
    "report-cards"
  ].map(filePart);
  return `${parts.join("_")}.${format === "ZIP" ? "zip" : "pdf"}`.slice(0, 220);
}

type PdfFonts = { regular: PDFFont; bold: PDFFont; schoolBold: PDFFont; embedded: boolean };

class PdfLayout {
  readonly pageSize: [number, number];
  readonly margin: number;
  readonly minimumFontSize: number;
  readonly palette: ReturnType<typeof paletteFor>;
  readonly pages: PDFPage[] = [];
  private page!: PDFPage;
  private y = 0;
  private pageNumber = 0;
  private readonly contentWidth: number;

  constructor(
    private readonly document: PDFDocument,
    private readonly report: RenderableReport,
    mode: ReportColourMode,
    readonly fonts: PdfFonts,
    private readonly logo: PDFImage | null
  ) {
    const portrait = A4_PORTRAIT;
    this.pageSize =
      report.template.printSettings.orientation === "LANDSCAPE"
        ? [portrait[1], portrait[0]]
        : portrait;
    this.margin = report.template.printSettings.marginMm * POINTS_PER_MM;
    this.minimumFontSize = report.template.printSettings.minimumFontSizePt;
    this.palette = paletteFor(mode);
    this.contentWidth = this.pageSize[0] - this.margin * 2;
    this.newPage();
  }

  private newPage() {
    this.page = this.document.addPage(this.pageSize);
    if (this.isR5Academic()) {
      this.page.drawRectangle({ x: 0, y: 0, width: this.pageSize[0], height: this.pageSize[1], color: rgb(1, 1, 1) });
    }
    this.pages.push(this.page);
    this.pageNumber += 1;
    this.y = this.pageSize[1] - this.margin;
    if (this.isR5Academic()) this.y -= 68;
    else if (this.pageNumber === 1) this.y -= 58;
  }

  pageBreak() {
    this.newPage();
  }

  private drawPageHeader(page: PDFPage) {
    if (!this.isR5Academic()) return this.drawLegacyPageHeader(page);
    const topY = this.pageSize[1] - this.margin;
    const schoolName = printable(this.report.school.name).toUpperCase();
    const unitWidth = Math.min(this.contentWidth, 410);
    const unitLeft = (this.pageSize[0] - unitWidth) / 2;
    const logoWidth = this.logo ? 44 : 0;
    const gap = this.logo ? 10 : 0;
    const textLeft = unitLeft + logoWidth + gap;
    const textWidth = unitWidth - logoWidth - gap;
    const schoolSize = 17;
    const schoolWidth = this.fonts.schoolBold.widthOfTextAtSize(schoolName, schoolSize);
    if (schoolWidth > textWidth) throw new Error("Configured school name does not fit the approved academic-report header.");
    page.drawText(schoolName, {
      x: textLeft + (textWidth - schoolWidth) / 2,
      y: topY - 14,
      size: schoolSize,
      font: this.fonts.schoolBold,
      color: this.palette.ink
    });
    const identityLine = [
      this.report.school.affiliationWording,
      this.report.school.recognitionWording,
      this.report.school.establishmentYear ? `Established ${this.report.school.establishmentYear}` : null
    ].filter(Boolean).join("  •  ") || "CONFIGURATION REQUIRED — approved report-card status line is missing";
    const statusSize = identityLine.startsWith("CONFIGURATION REQUIRED") ? 8 : R7_HEADER_TYPOGRAPHY.statusFontSizePt;
    const statusLines = wrapText(identityLine, this.fonts.bold, statusSize, textWidth);
    if (statusLines.length > 2) throw new Error("Configured report-card status line does not fit the approved academic-report header.");
    const statusStartY = statusLines.length === 1 ? topY - 28 : topY - 24;
    statusLines.forEach((line, index) => page.drawText(line, {
      x: textLeft + (textWidth - this.fonts.bold.widthOfTextAtSize(line, statusSize)) / 2,
      y: statusStartY - index * 10.4,
      size: statusSize,
      font: this.fonts.bold,
      color: this.palette.ink
    }));
    const addressLine = [this.report.school.address, this.report.school.city].filter(Boolean).join(", ");
    const addressSize = R7_HEADER_TYPOGRAPHY.addressFontSizePt;
    const addressLines = wrapText(addressLine, this.fonts.bold, addressSize, textWidth);
    if (addressLines.length > 2) throw new Error("Configured school address does not fit the approved academic-report header.");
    const addressStartY = addressLines.length === 1 ? topY - 42 : topY - 38;
    addressLines.forEach((line, index) => page.drawText(line, {
      x: textLeft + (textWidth - this.fonts.bold.widthOfTextAtSize(line, addressSize)) / 2,
      y: addressStartY - index * 10.8,
      size: addressSize,
      font: this.fonts.bold,
      color: this.palette.ink
    }));
    page.drawLine({
      start: { x: this.margin, y: topY - 62 },
      end: { x: this.pageSize[0] - this.margin, y: topY - 62 },
      thickness: 0.8,
      color: this.palette.border
    });
    if (this.logo) {
      const ratio = this.logo.width / this.logo.height;
      const requestedHeight = 42;
      const width = Math.min(logoWidth, requestedHeight * ratio);
      const height = width / ratio;
      page.drawImage(this.logo, {
        x: unitLeft + (logoWidth - width) / 2,
        y: topY - 43 + (requestedHeight - height) / 2,
        width,
        height
      });
    }
  }

  private drawLegacyPageHeader(page: PDFPage) {
    const topY = this.pageSize[1] - this.margin;
    const nameX = this.margin + (this.logo ? 48 : 0);
    const schoolName = printable(this.report.school.name).toUpperCase();
    const schoolSize = 15;
    page.drawText(fitText(schoolName, this.fonts.schoolBold, schoolSize, this.contentWidth - (this.logo ? 170 : 120)), {
      x: nameX,
      y: topY - 15,
      size: schoolSize,
      font: this.fonts.schoolBold,
      color: this.palette.ink
    });
    const identityLine = [
      this.report.school.affiliationWording,
      this.report.school.recognitionWording,
      this.report.school.establishmentYear ? `Established ${this.report.school.establishmentYear}` : null
    ].filter(Boolean).join(" | ");
    if (identityLine) page.drawText(fitText(identityLine, this.fonts.regular, 7.5, this.contentWidth - (this.logo ? 50 : 0)), {
      x: nameX,
      y: topY - 28,
      size: 7.5,
      font: this.fonts.regular,
      color: this.palette.muted
    });
    const addressLine = [this.report.school.address, this.report.school.city].filter(Boolean).join(", ");
    page.drawText(fitText(addressLine, this.fonts.regular, 7.5, this.contentWidth - (this.logo ? 50 : 0)), {
      x: nameX,
      y: topY - 40,
      size: 7.5,
      font: this.fonts.regular,
      color: this.palette.muted
    });
    page.drawText(this.report.publicationReference, {
      x: this.pageSize[0] - this.margin - this.fonts.regular.widthOfTextAtSize(this.report.publicationReference, 7.5),
      y: topY - 13,
      size: 7.5,
      font: this.fonts.regular,
      color: this.palette.muted
    });
    page.drawLine({
      start: { x: this.margin, y: topY - 50 },
      end: { x: this.pageSize[0] - this.margin, y: topY - 50 },
      thickness: 0.8,
      color: this.palette.border
    });
    if (this.logo) {
      const ratio = this.logo.width / this.logo.height;
      const height = 34;
      page.drawImage(this.logo, { x: this.margin, y: topY - height, width: height * ratio, height });
    }
  }

  private isR5Academic() {
    return isCanonicalV1AcademicReport(this.report);
  }

  ensure(height: number, options: { keepHeading?: boolean } = {}) {
    const footerReserve = 32;
    const extra = options.keepHeading ? 22 : 0;
    if (this.y - height - extra < this.margin + footerReserve) this.newPage();
  }

  keepTogether(height: number) {
    this.ensure(height);
  }

  heading(text: string, level: 1 | 2 | 3 = 2) {
    const size = level === 1 ? 18 : level === 2 ? 12.5 : 10.5;
    const spacing = level === 1 ? 10 : 7;
    this.ensure(size + spacing + 8, { keepHeading: true });
    this.y -= spacing;
    this.page.drawText(printable(text), {
      x: this.margin,
      y: this.y - size,
      size,
      font: this.fonts.bold,
      color: this.palette.ink,
      maxWidth: this.contentWidth
    });
    this.y -= size + 5;
  }

  paragraph(
    text: string,
    options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}
  ) {
    const size = Math.max(this.minimumFontSize, options.size ?? 9);
    const font = options.bold ? this.fonts.bold : this.fonts.regular;
    const lines = wrapText(printable(text), font, size, this.contentWidth);
    const lineHeight = size * 1.3;
    this.ensure(lines.length * lineHeight + 4);
    for (const line of lines) {
      this.page.drawText(line, {
        x: this.margin,
        y: this.y - size,
        size,
        font,
        color: options.color ?? this.palette.ink
      });
      this.y -= lineHeight;
    }
    this.y -= 3;
  }

  keyValues(rows: Array<[string, string]>) {
    const columns = this.contentWidth > 650 ? 3 : 2;
    const cellWidth = this.contentWidth / columns;
    const rowHeight = 34;
    for (let index = 0; index < rows.length; index += columns) {
      this.ensure(rowHeight);
      const group = rows.slice(index, index + columns);
      group.forEach(([label, value], column) => {
        const x = this.margin + column * cellWidth;
        this.page.drawText(printable(label), {
          x,
          y: this.y - 9,
          size: 7.5,
          font: this.fonts.bold,
          color: this.palette.muted
        });
        const lines = wrapText(
          printable(value || "-"),
          this.fonts.regular,
          this.minimumFontSize,
          cellWidth - 10
        ).slice(0, 2);
        lines.forEach((line, lineIndex) => {
          this.page.drawText(line, {
            x,
            y: this.y - 20 - lineIndex * (this.minimumFontSize + 1),
            size: this.minimumFontSize,
            font: this.fonts.regular,
            color: this.palette.ink
          });
        });
      });
      this.y -= rowHeight;
    }
    this.y -= 4;
  }

  academicIdentityGrid() {
    if (!this.isR5Academic()) {
      this.keyValues(profileRows(this.report));
      return;
    }
    const guardian = this.report.student.parentGuardians?.[0]?.value ?? "-";
    const classSection = `${this.report.student.className}${this.report.student.section ? ` / ${this.report.student.section}` : ""}`;
    const rows: Array<{ cells: string[]; spans: number[] }> = [
      { cells: ["Student Name", this.report.student.name], spans: [2, 2] },
      { cells: ["Parent / Guardian", guardian], spans: [2, 2] },
      { cells: ["Admission No. #", this.report.student.admissionNumber], spans: [2, 2] },
      { cells: ["Class / Section", classSection, "Roll Number", this.report.student.rollNumber ?? "-"], spans: [1, 1, 1, 1] }
    ];
    const fontSize = Math.max(7, this.minimumFontSize);
    const columnWidth = this.contentWidth / 4;
    const rowHeights = rows.map((row) => {
      const lineCounts = row.cells.map((value, index) => {
        const span = row.spans[index];
        const font = index % 2 === 0 ? this.fonts.bold : this.fonts.regular;
        const lines = wrapText(printable(value), font, fontSize, columnWidth * span - 8);
        if (lines.length > 2) throw new Error("Academic identity value exceeds the approved two-line grid contract.");
        return lines.length;
      });
      return Math.max(18, 6 + Math.max(...lineCounts) * (fontSize + 1));
    });
    const totalHeight = rowHeights.reduce((total, height) => total + height, 0);
    this.ensure(totalHeight + 4);
    const topY = this.y;
    const bottomY = topY - totalHeight;
    this.page.drawRectangle({
      x: this.margin,
      y: bottomY,
      width: this.contentWidth,
      height: totalHeight,
      color: rgb(1, 1, 1),
      borderColor: this.palette.ink,
      borderWidth: 0.75
    });
    let rowTopY = topY;
    rows.forEach((row, rowIndex) => {
      const height = rowHeights[rowIndex];
      let column = 0;
      row.cells.forEach((value, cellIndex) => {
        const span = row.spans[cellIndex];
        const x = this.margin + column * columnWidth;
        const width = span * columnWidth;
        const font = cellIndex % 2 === 0 ? this.fonts.bold : this.fonts.regular;
        const lines = wrapText(printable(value), font, fontSize, width - 8);
        const lineHeight = fontSize + 1;
        const blockHeight = lines.length * lineHeight;
        lines.forEach((line, lineIndex) => this.page.drawText(line, {
          x: x + Math.max(4, (width - font.widthOfTextAtSize(line, fontSize)) / 2),
          y: rowTopY - (height - blockHeight) / 2 - fontSize - lineIndex * lineHeight,
          size: fontSize,
          font,
          color: this.palette.ink
        }));
        column += span;
      });
      rowTopY -= height;
      if (rowIndex < rows.length - 1) this.page.drawLine({
        start: { x: this.margin, y: rowTopY },
        end: { x: this.margin + this.contentWidth, y: rowTopY },
        thickness: 0.75,
        color: this.palette.ink
      });
    });
    const centreX = this.margin + this.contentWidth / 2;
    this.page.drawLine({
      start: { x: centreX, y: bottomY },
      end: { x: centreX, y: topY },
      thickness: 0.75,
      color: this.palette.ink
    });
    const finalRowTop = bottomY + rowHeights.at(-1)!;
    for (const x of [this.margin + columnWidth, this.margin + columnWidth * 3]) this.page.drawLine({
      start: { x, y: bottomY },
      end: { x, y: finalRowTop },
      thickness: 0.75,
      color: this.palette.ink
    });
    this.y = bottomY - 4;
  }

  table(
    headers: string[],
    rows: string[][],
    widths?: number[],
    options: { compact?: boolean } = {}
  ) {
    const normalizedWidths = normalizeWidths(widths, headers.length, this.contentWidth);
    const headerSize = Math.max(this.minimumFontSize, 8.5);
    const bodySize = this.minimumFontSize;
    const drawHeader = () => {
      const headerLines = headers.map((header, index) =>
        wrapText(printable(header), this.fonts.bold, headerSize, normalizedWidths[index] - 8)
      );
      const height = Math.max(...headerLines.map((lines) => lines.length)) *
        headerSize * (options.compact ? 1.05 : 1.2) + (options.compact ? 6 : 10);
      this.ensure(height);
      this.drawTableCells(
        headerLines,
        normalizedWidths,
        height,
        headerSize,
        this.fonts.bold,
        this.palette.headerFill
      );
    };
    drawHeader();
    for (const row of rows) {
      const lines = headers.map((_, index) =>
        wrapText(
          printable(row[index] ?? ""),
          this.fonts.regular,
          bodySize,
          normalizedWidths[index] - 8
        )
      );
      const maximumLines = Math.max(...lines.map((value) => value.length));
      const height = Math.max(
        options.compact ? 18 : 24,
        maximumLines * bodySize * (options.compact ? 1.05 : 1.2) + (options.compact ? 5 : 9)
      );
      if (this.y - height < this.margin + 34) {
        this.newPage();
        drawHeader();
      }
      this.drawTableCells(
        lines,
        normalizedWidths,
        height,
        bodySize,
        this.fonts.regular,
        this.pages.indexOf(this.page) % 2 ? this.palette.rowAlt : this.palette.paper
      );
    }
    this.y -= 7;
  }

  private drawTableCells(
    cells: string[][],
    widths: number[],
    height: number,
    size: number,
    font: PDFFont,
    fill: ReturnType<typeof rgb>
  ) {
    let x = this.margin;
    cells.forEach((lines, index) => {
      const width = widths[index];
      this.page.drawRectangle({
        x,
        y: this.y - height,
        width,
        height,
        color: fill,
        borderColor: this.palette.border,
        borderWidth: 0.5
      });
      lines.forEach((line, lineIndex) => {
        this.page.drawText(line, {
          x: x + 4,
          y: this.y - size - 5 - lineIndex * size * 1.2,
          size,
          font,
          color: this.palette.ink
        });
      });
      x += width;
    });
    this.y -= height;
  }

  performanceBar(percentageValue: string) {
    const percentage = Math.max(0, Math.min(100, Number(percentageValue) || 0));
    const height = 24;
    this.ensure(height + 22);
    const width = this.contentWidth;
    this.page.drawRectangle({
      x: this.margin,
      y: this.y - height,
      width,
      height,
      color: this.palette.paper,
      borderColor: this.palette.border,
      borderWidth: 0.8
    });
    const filled = width * (percentage / 100);
    this.page.drawRectangle({
      x: this.margin,
      y: this.y - height,
      width: filled,
      height,
      color: this.palette.accent
    });
    if (this.palette.monochrome && filled > 2) {
      for (let offset = 3; offset < filled; offset += 8) {
        this.page.drawLine({
          start: { x: this.margin + offset, y: this.y - height },
          end: {
            x: this.margin + Math.min(filled, offset + height),
            y: this.y
          },
          thickness: 0.6,
          color: this.palette.ink
        });
      }
    }
    const label = `Overall percentage: ${percentage.toFixed(2)}%`;
    this.page.drawText(label, {
      x: this.margin + 6,
      y: this.y - 16,
      size: 9,
      font: this.fonts.bold,
      color: this.palette.ink
    });
    this.y -= height + 10;
  }

  performanceChart(papers: RenderableReport["content"]["papers"]) {
    if (!this.isR5Academic()) return this.legacyPerformanceChart(papers);
    const eligible = papers.filter((paper) => !paper.excluded && Number.isFinite(Number(paper.percentage)));
    if (!eligible.length) return;
    const fullWidthPerCategory = this.contentWidth / eligible.length;
    const hasLongLabel = eligible.some((paper) => wrapText(
      printable(paper.paperName && paper.paperName !== paper.subjectName ? `${paper.subjectName} ${paper.paperName}` : paper.subjectName),
      this.fonts.regular,
      R6_DENSE_CHART_GEOMETRY.subjectLabelFontSizePt,
      Math.max(22, fullWidthPerCategory - 3)
    ).length > 2);
    const dense = eligible.length >= R6_DENSE_CHART_GEOMETRY.triggerCategoryCount
      || fullWidthPerCategory < R6_DENSE_CHART_GEOMETRY.minimumProjectedCategoryWidthPt
      || hasLongLabel;
    const twoRows = dense && eligible.length >= R6_DENSE_CHART_GEOMETRY.twoRowCategoryCount;
    const splitAt = twoRows ? Math.ceil(eligible.length / 2) : eligible.length;
    const chartRows = twoRows ? [eligible.slice(0, splitAt), eligible.slice(splitAt)] : [eligible];
    const height = twoRows ? 242 : dense ? 215 : 205;
    this.ensure(height + 24);
    const chartTop = this.y - 31;
    const chartBottom = this.y - height + 34;
    const graphWidth = this.contentWidth;
    const series = [
      { key: "student" as const, label: "Student Marks", color: this.palette.monochrome ? rgb(R6_MONOCHROME_STUDENT_GREY, R6_MONOCHROME_STUDENT_GREY, R6_MONOCHROME_STUDENT_GREY) : this.palette.seriesStudent, pattern: this.palette.monochrome ? "SOLID_GREY" : "SOLID" },
      { key: "average" as const, label: "Class Average", color: this.palette.seriesAverage, pattern: this.palette.monochrome ? "DIAGONAL" : "SOLID" },
      { key: "highest" as const, label: "High Score", color: this.palette.seriesHighest, pattern: this.palette.monochrome ? "DIAMOND_LATTICE" : "SOLID" }
    ];
    const legendGeometry = dense ? R6_CHART_LEGEND_GEOMETRY.dense : R6_CHART_LEGEND_GEOMETRY.normal;
    series.forEach((item, index) => {
      const itemWidth = this.contentWidth / 3;
      const x = this.margin + index * itemWidth;
      this.patternBox(x, this.y - (dense ? 15 : 16), legendGeometry.swatchWidthPt, legendGeometry.swatchHeightPt, item.color, item.pattern);
      this.page.drawText(item.label, {
        x: x + legendGeometry.swatchWidthPt + legendGeometry.gapPt,
        y: this.y - 12,
        size: legendGeometry.labelFontSizePt,
        font: this.fonts.bold,
        color: this.palette.ink
      });
    });
    const rowGap = twoRows ? 8 : 0;
    const rowSlotHeight = (chartTop - chartBottom - rowGap * (chartRows.length - 1)) / chartRows.length;
    chartRows.forEach((rows, chartRowIndex) => {
      const rowTop = chartTop - chartRowIndex * (rowSlotHeight + rowGap);
      const rowBottom = rowTop - rowSlotHeight;
      const labelReserve = twoRows ? 20 : 31;
      const numericHeadroom = 14;
      const plotBottom = rowBottom + labelReserve;
      const plotHeight = rowSlotHeight - labelReserve - numericHeadroom;
      if (plotHeight < 42) throw new Error("Dense report chart cannot preserve a readable 0-100 scale.");
      for (let tick = 0; tick <= 100; tick += 20) {
        const y = plotBottom + (tick / 100) * plotHeight;
        this.page.drawLine({ start: { x: this.margin, y }, end: { x: this.margin + graphWidth, y }, thickness: tick === 0 ? 0.8 : 0.35, color: this.palette.border });
        this.page.drawText(String(tick), { x: this.margin, y: y + 2, size: 6.5, font: this.fonts.regular, color: this.palette.muted });
      }
      const groupWidth = graphWidth / rows.length;
      const barGap = Math.max(1.2, Math.min(1.8, groupWidth / 28));
      const barWidth = Math.min(8.5, (groupWidth - R6_DENSE_CHART_GEOMETRY.minimumGroupGapPt - barGap * 2) / 3);
      if (barWidth < 4.5) throw new Error("Dense report chart category spacing is below the print minimum.");
      const numericInputs: Array<{ text: string; centerX: number; barTopY: number; staggerLevel: number }> = [];
      rows.forEach((paper, rowIndex) => {
        const values = { student: boundedPercentage(paper.percentage), average: boundedPercentage(paper.cohortAverage), highest: boundedPercentage(paper.cohortHighest) };
        const groupX = this.margin + rowIndex * groupWidth;
        const clusterWidth = barWidth * 3 + barGap * 2;
        series.forEach((item, seriesIndex) => {
          const value = values[item.key];
          const barHeight = (value / 100) * plotHeight;
          const x = groupX + (groupWidth - clusterWidth) / 2 + seriesIndex * (barWidth + barGap);
          this.patternBox(x, plotBottom, barWidth, barHeight, item.color, item.pattern);
          numericInputs.push({ text: Number(value.toFixed(1)).toString(), centerX: x + barWidth / 2, barTopY: plotBottom + barHeight, staggerLevel: seriesIndex === 1 ? 1 : 0 });
        });
        const label = printable(paper.paperName && paper.paperName !== paper.subjectName ? `${paper.subjectName} ${paper.paperName}` : paper.subjectName);
        const labelSize = dense ? R6_DENSE_CHART_GEOMETRY.subjectLabelFontSizePt : 6.5;
        const lines = wrapText(label, this.fonts.regular, labelSize, Math.max(22, groupWidth - 3));
        if (lines.length > 3) throw new Error(`Configured chart label cannot fit without word loss: ${label}`);
        lines.forEach((line, index) => this.page.drawText(line, { x: groupX + (groupWidth - this.fonts.regular.widthOfTextAtSize(line, labelSize)) / 2, y: plotBottom - 9 - index * (labelSize + 1), size: labelSize, font: this.fonts.regular, color: this.palette.ink }));
      });
      const placements = layoutChartNumericLabels(numericInputs, { left: this.margin, right: this.margin + graphWidth, bottom: plotBottom + 1, top: rowTop }, R5_CHART_NUMERIC_LABEL_FONT_SIZE, (text) => this.fonts.bold.widthOfTextAtSize(text, R5_CHART_NUMERIC_LABEL_FONT_SIZE));
      placements.forEach((label) => {
        if (label.leaderLine) this.page.drawLine({ start: { x: label.anchorX, y: label.anchorY + 0.8 }, end: { x: label.x + label.width / 2, y: label.y - 0.8 }, thickness: 0.35, color: this.palette.ink });
        this.page.drawRectangle({ x: label.x - 1.1, y: label.y - 0.8, width: label.width + 2.2, height: label.height + 1.6, color: rgb(1, 1, 1), opacity: 0.97 });
        this.page.drawText(label.text, { x: label.x, y: label.y, size: R5_CHART_NUMERIC_LABEL_FONT_SIZE, font: this.fonts.bold, color: this.palette.ink });
      });
    });
    this.y -= height + 6;
  }

  private legacyPerformanceChart(papers: RenderableReport["content"]["papers"]) {
    const rows = papers
      .filter((paper) => !paper.excluded && Number.isFinite(Number(paper.percentage)))
      .slice(0, 12);
    if (!rows.length) return;
    const height = 205;
    this.ensure(height + 24);
    const chartTop = this.y - 30;
    const chartBottom = this.y - height + 34;
    const chartHeight = chartTop - chartBottom;
    const labelReserve = 31;
    const graphWidth = this.contentWidth;
    const groupWidth = graphWidth / rows.length;
    const barWidth = Math.max(3.5, Math.min(9, (groupWidth - 5) / 3));
    const series = [
      { key: "student" as const, label: "Student Marks", color: this.palette.seriesStudent, pattern: "SOLID" },
      { key: "average" as const, label: "Class Average", color: this.palette.seriesAverage, pattern: "DIAGONAL" },
      { key: "highest" as const, label: "High Score", color: this.palette.seriesHighest, pattern: "HORIZONTAL" }
    ];
    series.forEach((item, index) => {
      const x = this.margin + index * 112;
      this.legacyPatternBox(x, this.y - 11, 12, 8, item.color, item.pattern);
      this.page.drawText(item.label, { x: x + 17, y: this.y - 10, size: 7.5, font: this.fonts.bold, color: this.palette.ink });
    });
    for (let tick = 0; tick <= 100; tick += 20) {
      const y = chartBottom + (tick / 100) * chartHeight;
      this.page.drawLine({
        start: { x: this.margin, y },
        end: { x: this.margin + graphWidth, y },
        thickness: tick === 0 ? 0.8 : 0.35,
        color: this.palette.border
      });
      this.page.drawText(String(tick), { x: this.margin, y: y + 2, size: 6.5, font: this.fonts.regular, color: this.palette.muted });
    }
    rows.forEach((paper, rowIndex) => {
      const values = {
        student: boundedPercentage(paper.percentage),
        average: boundedPercentage(paper.cohortAverage),
        highest: boundedPercentage(paper.cohortHighest)
      };
      const groupX = this.margin + rowIndex * groupWidth;
      series.forEach((item, seriesIndex) => {
        const value = values[item.key];
        const barHeight = (value / 100) * chartHeight;
        const x = groupX + 4 + seriesIndex * (barWidth + 1.5);
        this.legacyPatternBox(x, chartBottom, barWidth, barHeight, item.color, item.pattern);
        const label = value.toFixed(value % 1 === 0 ? 0 : 1);
        this.page.drawText(label, { x, y: chartBottom + barHeight + 2, size: 5.8, font: this.fonts.bold, color: this.palette.ink });
      });
      const label = paper.paperName && paper.paperName !== paper.subjectName
        ? `${paper.subjectName} ${paper.paperName}`
        : paper.subjectName;
      wrapText(printable(label), this.fonts.regular, 5.8, Math.max(22, groupWidth - 3)).slice(0, 3)
        .forEach((line, index) => this.page.drawText(line, {
          x: groupX + 2,
          y: chartBottom - 9 - index * 6.3,
          size: 5.8,
          font: this.fonts.regular,
          color: this.palette.ink
        }));
    });
    this.y -= height + labelReserve - 25;
  }

  private legacyPatternBox(
    x: number,
    y: number,
    width: number,
    height: number,
    color: ReturnType<typeof rgb>,
    pattern: string
  ) {
    if (width <= 0 || height <= 0) return;
    this.page.drawRectangle({ x, y, width, height, color, borderColor: this.palette.ink, borderWidth: 0.45 });
    if (pattern === "DIAGONAL") {
      for (let offset = 2; offset < width + height; offset += 4) {
        const startX = x + Math.max(0, offset - height);
        const startY = y + Math.min(height, offset);
        const endX = x + Math.min(width, offset);
        const endY = y + Math.max(0, offset - width);
        this.page.drawLine({ start: { x: startX, y: startY }, end: { x: endX, y: endY }, thickness: 0.35, color: this.palette.ink });
      }
    } else if (pattern === "HORIZONTAL") {
      for (let offset = 3; offset < height; offset += 4) {
        this.page.drawLine({ start: { x, y: y + offset }, end: { x: x + width, y: y + offset }, thickness: 0.35, color: this.palette.ink });
      }
    }
  }

  private patternBox(
    x: number,
    y: number,
    width: number,
    height: number,
    color: ReturnType<typeof rgb>,
    pattern: string
  ) {
    if (width <= 0 || height <= 0) return;
    this.page.drawRectangle({
      x,
      y,
      width,
      height,
      color: pattern === "SOLID" || pattern === "SOLID_GREY" ? color : rgb(1, 1, 1),
      borderColor: this.palette.ink,
      borderWidth: pattern === "SOLID" ? 0.75 : R7_PATTERN_GEOMETRY.borderWidthPt
    });
    if (pattern === "DIAGONAL") {
      for (let intercept = -width; intercept <= height; intercept += R7_PATTERN_GEOMETRY.slashSpacingPt) {
        const startLocal = intercept >= 0
          ? { x: 0, y: intercept }
          : { x: -intercept, y: 0 };
        const endLocal = width + intercept <= height
          ? { x: width, y: width + intercept }
          : { x: height - intercept, y: height };
        if (endLocal.x > startLocal.x + 0.0001) {
          this.page.drawLine({
            start: { x: x + startLocal.x, y: y + startLocal.y },
            end: { x: x + endLocal.x, y: y + endLocal.y },
            thickness: R7_PATTERN_GEOMETRY.slashStrokeWidthPt,
            color: this.palette.ink
          });
        }
      }
    }
    if (pattern === "DIAMOND_LATTICE") {
      for (let centerY = y + R7_PATTERN_GEOMETRY.diamondRadiusYPt + 0.7; centerY <= y + height - R7_PATTERN_GEOMETRY.diamondRadiusYPt - 0.7; centerY += R7_PATTERN_GEOMETRY.diamondVerticalSpacingPt) {
        const rowShift = Math.round((centerY - y) / R7_PATTERN_GEOMETRY.diamondVerticalSpacingPt) % 2 ? R7_PATTERN_GEOMETRY.diamondHorizontalSpacingPt / 2 : 0;
        for (let centerX = x + R7_PATTERN_GEOMETRY.diamondRadiusXPt + 0.7 + rowShift; centerX <= x + width - R7_PATTERN_GEOMETRY.diamondRadiusXPt - 0.7; centerX += R7_PATTERN_GEOMETRY.diamondHorizontalSpacingPt) {
          const diameterX = R7_PATTERN_GEOMETRY.diamondRadiusXPt * 2;
          const diameterY = R7_PATTERN_GEOMETRY.diamondRadiusYPt * 2;
          this.page.drawSvgPath(`M 0 ${R7_PATTERN_GEOMETRY.diamondRadiusYPt} L ${R7_PATTERN_GEOMETRY.diamondRadiusXPt} 0 L ${diameterX} ${R7_PATTERN_GEOMETRY.diamondRadiusYPt} L ${R7_PATTERN_GEOMETRY.diamondRadiusXPt} ${diameterY} Z`, {
            x: centerX - R7_PATTERN_GEOMETRY.diamondRadiusXPt,
            y: centerY - R7_PATTERN_GEOMETRY.diamondRadiusYPt,
            color: this.palette.ink
          });
        }
      }
    }
  }

  resultSummaryCards() {
    const metrics = [
      { label: "Total", value: `${displayParentNumber(this.report.content.totalObtained)} / ${displayParentNumber(this.report.content.totalMaximum)}` },
      { label: "Percentage", value: `${displayParentNumber(this.report.content.percentage)}%` },
      { label: "Grade", value: this.report.content.grade?.code ?? "Not enabled" },
      ...(this.report.content.grade?.point == null ? [] : [{ label: "Grade Point", value: displayParentNumber(this.report.content.grade.point) }]),
      ...(this.report.content.rank == null ? [] : [{ label: "Rank", value: String(this.report.content.rank) }])
    ];
    if (metrics.length < 3 || metrics.length > 5) throw new Error("Canonical result summary requires three, four or five enabled metrics.");
    const summaryMetrics = metrics.map((metric) => ({ ...metric, text: `${metric.label}: ${metric.value}` }));
    const height = R8_SUMMARY_GEOMETRY.heightPt;
    this.ensure(height + 5);
    const widths = resolveR8SummaryWidths(
      summaryMetrics,
      this.contentWidth,
      (text) => this.fonts.bold.widthOfTextAtSize(printable(text), R8_SUMMARY_GEOMETRY.fontSizePt)
    );
    let x = this.margin;
    summaryMetrics.forEach((metric, index) => {
      const width = widths[index];
      this.page.drawRectangle({
        x,
        y: this.y - height,
        width,
        height,
        color: this.palette.monochrome ? rgb(0.96, 0.96, 0.96) : this.palette.headerFill,
        borderColor: this.palette.border,
        borderWidth: 0.7
      });
      drawCenteredText(this.page, printable(metric.text), this.fonts.bold, R8_SUMMARY_GEOMETRY.fontSizePt, x, width, this.y - 14, this.palette.ink);
      x += width;
    });
    this.y -= height + 5;
  }

  attendanceAndGeneralRemarksRow() {
    const height = R8_SUMMARY_GEOMETRY.attendanceRemarksHeightPt;
    this.ensure(height + 6);
    const gap = 6;
    const attendanceWidth = (this.contentWidth - gap) * R8_SUMMARY_GEOMETRY.attendanceWidthRatio;
    const remarksWidth = this.contentWidth - gap - attendanceWidth;
    const attendanceX = this.margin;
    const remarksX = attendanceX + attendanceWidth + gap;
    const headerHeight = 15;
    const headers = ["Working Days", "Days Present", "Attendance %"];
    const workingDays = this.report.content.attendance.totalLockedDays;
    const daysPresent = this.report.content.attendance.presentEquivalentDays;
    const attendancePercentage = workingDays > 0 ? daysPresent / workingDays * 100 : 0;
    const values = [String(workingDays), displayParentNumber(daysPresent), `${displayParentNumber(attendancePercentage)}%`];
    const cellWidth = attendanceWidth / headers.length;
    headers.forEach((header, index) => {
      const cellX = attendanceX + index * cellWidth;
      this.page.drawRectangle({ x: cellX, y: this.y - headerHeight, width: cellWidth, height: headerHeight, color: this.palette.headerFill, borderColor: this.palette.border, borderWidth: 0.7 });
      this.page.drawRectangle({ x: cellX, y: this.y - height, width: cellWidth, height: height - headerHeight, color: rgb(1, 1, 1), borderColor: this.palette.border, borderWidth: 0.7 });
      drawCenteredText(this.page, header, this.fonts.bold, 6.6, cellX, cellWidth, this.y - 11, this.palette.ink);
      drawCenteredText(this.page, values[index], this.fonts.bold, 7.8, cellX, cellWidth, this.y - 28, this.palette.ink);
    });
    this.page.drawRectangle({ x: remarksX, y: this.y - height, width: remarksWidth, height, color: rgb(1, 1, 1), borderColor: this.palette.border, borderWidth: 0.7 });
    this.page.drawText("General Remarks", { x: remarksX + 5, y: this.y - 11, size: 7.2, font: this.fonts.bold, color: this.palette.ink });
    const remarks = printable(this.report.content.remarks.general ?? this.report.content.remarks.classTeacher ?? "No approved remark recorded.");
    const lines = wrapText(remarks, this.fonts.regular, 7, remarksWidth - 10);
    if (lines.length > 2) throw new Error("General Remarks cannot fit the balanced canonical row without truncation.");
    lines.forEach((line, index) => this.page.drawText(line, { x: remarksX + 5, y: this.y - 23 - index * 8, size: 7, font: this.fonts.regular, color: this.palette.ink }));
    this.y -= height + 6;
  }

  signatures(signatures: RenderableReport["signatures"]) {
    const canonical = this.isR5Academic();
    this.ensure(canonical ? 55 : 70);
    const width = this.contentWidth / Math.max(1, signatures.length);
    signatures.forEach((signature, index) => {
      const x = this.margin + index * width + (canonical ? 4.5 : 4);
      const lineY = this.y - (canonical ? R8_SIGNATURE_GEOMETRY.clearSigningHeightPt : 42);
      this.page.drawLine({
        start: { x, y: lineY },
        end: { x: x + width - (canonical ? 4.5 : 18), y: lineY },
        thickness: 0.7,
        color: this.palette.ink
      });
      const label = printable(signature.label);
      const clipped = fitText(label, this.fonts.regular, 8, width - (canonical ? 9 : 18));
      const labelWidth = this.fonts.regular.widthOfTextAtSize(clipped, 8);
      this.page.drawText(clipped, {
        x: canonical ? this.margin + index * width + (width - labelWidth) / 2 : x,
        y: lineY - (canonical ? 13 : 12),
        size: 8,
        font: this.fonts.regular,
        color: this.palette.ink
      });
    });
    this.y -= canonical ? 61 : 64;
  }

  finish() {
    this.pages.forEach((page, index) => {
      if (index === 0) this.drawPageHeader(page);
      const footer = [
        `${this.report.status === "ISSUED" ? "Issued" : "Preview"} version ${this.report.versionNumber}`,
        this.report.publicationReference,
        `Page ${index + 1} of ${this.pages.length}`
      ].join(" | ");
      page.drawLine({
        start: { x: this.margin, y: this.margin + 18 },
        end: { x: this.pageSize[0] - this.margin, y: this.margin + 18 },
        thickness: 0.5,
        color: this.palette.border
      });
      const size = 7;
      page.drawText(fitText(footer, this.fonts.regular, size, this.contentWidth), {
        x: this.margin,
        y: this.margin + 7,
        size,
        font: this.fonts.regular,
        color: this.palette.muted
      });
    });
  }
}

function renderAcademicReport(layout: PdfLayout, report: RenderableReport) {
  const definition = report.template.definition as Record<string, any>;
  const variant = String(definition.layoutVariant ?? report.examination.name).replaceAll("_", " ");
  layout.heading(`${reportTemplateFamilyLabel(report.templateFamily)} - ${variant}`, 1);
  layout.paragraph(
    `${report.examination.code} | ${report.examination.name} | ${report.reportingPeriod}`,
    { bold: true }
  );
  layout.academicIdentityGrid();
  renderAcademicMarks(layout, report);
  if (isCanonicalV1AcademicReport(report)) {
    layout.resultSummaryCards();
    layout.attendanceAndGeneralRemarksRow();
  } else {
    layout.keyValues([
      ["Total", `${report.content.totalObtained} / ${report.content.totalMaximum}`],
      ["Grade", report.content.grade ? `${report.content.grade.code} - ${report.content.grade.label}` : "Not enabled"],
      ["Grade point", report.content.grade?.point ?? "Not enabled"],
      ["Pass / result", report.content.passResult ?? "Not enabled"],
      ["Rank", report.content.rank == null ? "Not enabled" : String(report.content.rank)],
      ["Cohort average", report.content.cohortAverage ?? "Not available"]
    ]);
  }
  if (report.content.groups.length) {
    layout.heading("Configured subject groups", 2);
    layout.table(
      ["Group", "Obtained", "Maximum", "Percentage", "Mode"],
      report.content.groups.map((group) => [
        String(group.groupName ?? group.groupCode ?? "Group"),
        String(group.obtained ?? "-"),
        String(group.maximum ?? "-"),
        String(group.percentage ?? "-"),
        String(group.calculationMode ?? "-")
      ])
    );
  }
  if (definition.combinedResult?.enabled === true || report.templateFamily === "RETAINED_MULTI_EXAM_I_X") {
    layout.heading("Configured combined result", 2);
    layout.table(
      ["Examination / term", "Obtained", "Maximum", "Percentage", "Configured weight"],
      report.content.combinedResults.map((row) => [
        row.label,
        row.obtained,
        row.maximum,
        row.percentage,
        row.configuredWeight ?? "-"
      ]),
      [0.32, 0.17, 0.17, 0.17, 0.17]
    );
  }
  if (definition.chart?.enabled !== false) {
    layout.heading("Student Marks / Class Average / High Score", 2);
    layout.performanceChart(report.content.papers);
  }
  if (report.content.skills.length) {
    layout.heading("Skills and co-scholastic development", 2);
    layout.table(
      ["Area", "Rating", "Remarks"],
      report.content.skills.map((row) => [row.area, row.rating, row.remarks ?? "-"]),
      [0.4, 0.2, 0.4]
    );
  }
  if (report.content.personality.length) {
    layout.heading("Personality development", 2);
    layout.table(
      ["Area", "Rating", "Remarks"],
      report.content.personality.map((row) => [row.area, row.rating, row.remarks ?? "-"]),
      [0.4, 0.2, 0.4]
    );
  }
  if (isCanonicalV1AcademicReport(report)) renderAcademicLegends(layout, report);
  else {
    renderAttendance(layout, report);
    renderRemarksAndLegends(layout, report);
  }
  layout.keepTogether(100);
  layout.heading("Required signatures", 2);
  layout.signatures(report.signatures);
}

function renderAcademicMarks(layout: PdfLayout, report: RenderableReport) {
  layout.heading("Academic result", 2);
  const componentOrder: Array<{ code: string; name: string }> = [];
  for (const paper of report.content.papers) for (const component of paper.components) {
    if (!componentOrder.some((row) => row.code === component.code)) {
      componentOrder.push({ code: component.code, name: component.name });
    }
  }
  if (componentOrder.length <= 4) {
    const headers = ["Subject / Paper", ...componentOrder.map((row) => row.name), "Total", "%"];
    const rows = report.content.papers.map((paper) => [
      paper.paperName && paper.paperName !== paper.subjectName
        ? `${paper.subjectName} - ${paper.paperName}`
        : paper.subjectName,
      ...componentOrder.map((column) => {
        const component = paper.components.find((row) => row.code === column.code);
        return component ? displayComponentValue(component) : "N/A";
      }),
      `${paper.obtained} / ${paper.maximum}`,
      paper.percentage
    ]);
    layout.table(headers, rows, [0.27, ...componentOrder.map(() => 0.14), 0.12, 0.09]);
  } else {
    layout.table(
      ["Subject", "Paper", "Component", "State", "Value / Maximum", "Weighted contribution"],
      report.content.papers.flatMap((paper) => paper.components.map((component, index) => [
        index === 0 ? paper.subjectName : "",
        index === 0 ? paper.paperName : "",
        component.name,
        humanState(component.state),
        displayComponentValue(component),
        component.contribution ?? "N/A"
      ])),
      [0.2, 0.14, 0.2, 0.14, 0.17, 0.15]
    );
  }
}

function displayComponentValue(component: RenderableReport["content"]["papers"][number]["components"][number]) {
  if (component.state === "PRESENT") return `${component.obtained ?? "0"} / ${component.maximum}`;
  const labels: Record<string, string> = {
    ABSENT: "ABSENT",
    NOT_ENTERED: "NOT ENTERED",
    EXEMPT: "EXEMPT",
    NOT_APPLICABLE: "N/A"
  };
  return `${labels[component.state] ?? humanState(component.state)} / ${component.maximum}`;
}

function renderKgBooklet(layout: PdfLayout, report: RenderableReport) {
  const definition = report.template.definition as Record<string, any>;
  const evaluations = Array.isArray(definition.evaluationPeriods)
    ? definition.evaluationPeriods.map(String).slice(0, 5)
    : ["I", "II", "III", "IV", "V"];

  // Page 1 - canonical cover.
  layout.heading("PROGRESS REPORT", 1);
  layout.paragraph("KG ten-page developmental booklet", { bold: true, size: 12 });
  layout.paragraph(`${report.academicYear} | ${report.examination.name}`);
  layout.keyValues([
    ["Student Name", report.student.name],
    ["Class / Section", `${report.student.className}${report.student.section ? ` / ${report.student.section}` : ""}`],
    ["Roll Number", report.student.rollNumber ?? "-"]
  ]);
  layout.paragraph("Synthetic or issued version details appear in the footer. Ordinary A4 page order is canonical; booklet imposition is separate.");

  // Page 2 - profile.
  layout.pageBreak();
  layout.heading("STUDENT PROFILE", 1);
  layout.keyValues(profileRows(report));
  layout.paragraph("Only identity labels explicitly selected in the frozen template are displayed. Internal record IDs and contact details are omitted.");
  layout.heading("Parent / Guardian acknowledgment", 2);
  layout.paragraph("I have reviewed the developmental progress recorded in this booklet.");
  layout.signatures([{ role: "PARENT_GUARDIAN", label: "Parent / Guardian" }]);

  // Page 3 - instructions and configured legend.
  layout.pageBreak();
  layout.heading("GUIDANCE FOR PARENTS / GUARDIANS", 1);
  [
    "This booklet records scholastic and developmental observations across five configured evaluations.",
    "Ratings must be read with the frozen scheme and legend printed in this version; no historical formula is implied.",
    "Attendance, growth and comments are recorded from their approved frozen bases and remain distinct from marks.",
    "Please discuss questions with the authorised Class Teacher or school leadership and sign only in the areas provided."
  ].forEach((text) => layout.paragraph(text));
  if (report.content.legends.length) {
    layout.heading("Configured grade legend", 2);
    layout.table(["Code", "Description"], report.content.legends.map((row) => [row.code, row.label]), [0.2, 0.8]);
  }

  // Page 4 - compact intellectual-skills summary.
  layout.pageBreak();
  layout.heading("INTELLECTUAL SKILLS", 1);
  const summaryAreas = Array.isArray(definition.summaryAreas)
    ? definition.summaryAreas.map(String)
    : report.content.developmentalSections.flatMap((section) => section.items.map((item) => item.area));
  renderKgEvaluationMatrix(layout, "Skill / learning area", summaryAreas, evaluations, report.content.kgSummaryEvaluations ?? []);

  const criteria = Array.isArray(definition.criteria) ? definition.criteria : [];
  const englishCriteria = criteria.filter((row: any) => String(row.section).toLowerCase().startsWith("english"));
  const hindiCriteria = criteria.filter((row: any) => String(row.section).toLowerCase().startsWith("hindi"));
  const numberCriteria = criteria.filter((row: any) => String(row.section).toLowerCase().startsWith("number"));
  const otherCriteria = criteria.filter((row: any) => String(row.section).toLowerCase() === "other");

  // Page 5 - detailed English.
  layout.pageBreak();
  layout.heading("INTELLECTUAL DEVELOPMENT - ENGLISH", 1);
  renderKgEvaluationMatrix(layout, "English development", englishCriteria, evaluations, report.content.kgRubricEvaluations ?? []);

  // Page 6 - Hindi and first Number Work structure.
  layout.pageBreak();
  layout.heading("INTELLECTUAL DEVELOPMENT - HINDI / NUMBER WORK", 1);
  renderKgEvaluationMatrix(layout, "Hindi development", hindiCriteria, evaluations, report.content.kgRubricEvaluations ?? []);
  renderKgEvaluationMatrix(layout, "Number work - oral", numberCriteria.slice(0, 3), evaluations, report.content.kgRubricEvaluations ?? []);

  // Page 7 - remaining Number Work, EVS, Rhymes and Story.
  layout.pageBreak();
  layout.heading("NUMBER WORK / EVS / RHYMES / STORY", 1);
  renderKgEvaluationMatrix(layout, "Number work - written", numberCriteria.slice(3), evaluations, report.content.kgRubricEvaluations ?? []);
  renderKgEvaluationMatrix(layout, "EVS / Rhymes / Story", otherCriteria, evaluations, report.content.kgRubricEvaluations ?? []);

  // Page 8 - personality, monthly attendance and physical growth.
  layout.pageBreak();
  layout.heading("PERSONALITY DEVELOPMENT", 1);
  const personalityAreas = Array.isArray(definition.personalityTraits)
    ? definition.personalityTraits.map(String)
    : report.content.personality.map((row) => row.area);
  renderKgEvaluationMatrix(layout, "Personal and social trait", personalityAreas, evaluations, report.content.kgPersonalityEvaluations ?? []);
  renderKgMonthlyAttendance(layout, report);
  renderKgGrowth(layout, report);

  // Page 9 - evaluation comments, signatures and promotion.
  layout.pageBreak();
  layout.heading("COMMENTS / COMPLIMENTS", 1);
  layout.table(
    ["Evaluation", "Approved comment / compliment"],
    evaluations.map((evaluation) => [
      evaluation,
      report.content.evaluationComments?.find((row) => row.evaluation === evaluation)?.comment ?? "No approved comment recorded."
    ]),
    [0.18, 0.82]
  );
  layout.heading("Promotion", 2);
  layout.paragraph(report.content.promotion?.displayText ?? "Promotion decision is not included in this frozen report version.");
  if (report.content.promotion?.nextClass) layout.paragraph(`Next class: ${report.content.promotion.nextClass}`);
  if (report.content.promotion?.nextSessionStartDate) layout.paragraph(`Next session begins: ${report.content.promotion.nextSessionStartDate}`);
  layout.signatures(report.signatures);

  // Page 10 - canonical back cover.
  layout.pageBreak();
  layout.heading("A LITTLE PROGRESS EVERY DAY ADDS UP TO BIG RESULTS", 1);
  layout.paragraph("This is the final page of the canonical ten-page KG developmental booklet.", { bold: true });
  layout.keyValues([
    ["Report reference", report.publicationReference],
    ["Template", `${report.template.code} v${report.template.version}`],
    ["Publication version", String(report.governance.publicationVersion ?? report.versionNumber)],
    ["Colour mode", layout.palette.monochrome ? "Monochrome / pattern-safe" : "Colour / accessible"],
    ["Page order", "1 through 10 ordinary A4 pages"],
    ["Student data", report.status === "ISSUED" ? "Issued frozen snapshot" : "Preview / synthetic specimen"]
  ]);
}

function renderKgEvaluationMatrix(
  layout: PdfLayout,
  firstHeader: string,
  items: Array<string | Record<string, any>>,
  evaluations: string[],
  sources: NonNullable<RenderableReport["content"]["kgRubricEvaluations"]>
) {
  if (!items.length) return;
  const rows = items.map((item) => {
    const key = typeof item === "string" ? item : String(item.key ?? item.label ?? "");
    const label = typeof item === "string" ? humanState(item) : String(item.label ?? humanState(key));
    return [
      label,
      ...evaluations.map((evaluation) => sourceRating(sources, evaluation, key))
    ];
  });
  layout.table(
    [firstHeader, ...evaluations.map((evaluation) => `Evaluation ${evaluation}`)],
    rows,
    [0.4, ...evaluations.map(() => 0.12)],
    { compact: true }
  );
}

function sourceRating(
  sources: NonNullable<RenderableReport["content"]["kgRubricEvaluations"]>,
  evaluation: string,
  area: string
) {
  return sources.find((row) => row.evaluation === evaluation)?.ratings.find((row) => row.area === area)?.rating
    ?.replaceAll("_", " ") ?? "NOT ENTERED";
}

function renderKgMonthlyAttendance(layout: PdfLayout, report: RenderableReport) {
  const months = report.content.attendance.monthly ?? [];
  if (!months.length) return;
  layout.heading("Monthly attendance", 2);
  const totalWorking = months.reduce((sum, row) => sum + (row.workingDays ?? 0), 0);
  const totalPresent = months.reduce((sum, row) => sum + (row.daysPresent ?? 0), 0);
  layout.table(
    ["Attendance", ...months.map((row) => row.month.slice(0, 3)), "Total"],
    [
      ["Working days", ...months.map((row) => row.workingDays == null ? "-" : String(row.workingDays)), String(totalWorking)],
      ["Days present", ...months.map((row) => row.daysPresent == null ? "-" : String(row.daysPresent)), String(totalPresent)]
    ],
    [0.16, ...months.map(() => 0.065), 0.125],
    { compact: true }
  );
}

function renderKgGrowth(layout: PdfLayout, report: RenderableReport) {
  const growth = report.content.growth ?? [];
  if (!growth.length) return;
  layout.heading("Physical development", 2);
  layout.table(
    ["Measure", ...growth.map((row) => `Evaluation ${row.evaluation}`)],
    [
      ["Height (cm)", ...growth.map((row) => row.heightCm ?? "-")],
      ["Weight (kg)", ...growth.map((row) => row.weightKg ?? "-")]
    ],
    [0.28, ...growth.map(() => 0.72 / growth.length)],
    { compact: true }
  );
}

function renderAttendance(layout: PdfLayout, report: RenderableReport) {
  layout.keepTogether(105);
  layout.heading("Locked attendance period", 2);
  layout.keyValues([
    ["Period", `${report.content.attendance.periodStart} to ${report.content.attendance.periodEnd}`],
    ["Locked working days", String(report.content.attendance.totalLockedDays)],
    ["Recorded days", String(report.content.attendance.recordedDays)],
    ["Present equivalent days", String(report.content.attendance.presentEquivalentDays)]
  ]);
}

function renderRemarksAndLegends(layout: PdfLayout, report: RenderableReport) {
  layout.heading("Remarks", 2);
  layout.paragraph(
    `Class Teacher: ${report.content.remarks.classTeacher ?? "No approved remark recorded."}`
  );
  layout.paragraph(
    `Principal: ${report.content.remarks.principal ?? "No approved remark recorded."}`
  );
  if (report.content.remarks.general) layout.paragraph(report.content.remarks.general);
  if (report.content.legends.length) {
    layout.heading("Legend", 2);
    layout.table(
      ["Code", "Meaning", "Configured range", "Grade point"],
      report.content.legends.map((row) => [
        row.code,
        row.label,
        row.minimumPercentage == null && row.maximumPercentage == null
          ? "Configured scale"
          : `${row.minimumPercentage ?? "-"} to ${row.maximumPercentage ?? "-"}`,
        row.gradePoint ?? "Not enabled"
      ]),
      [0.14, 0.36, 0.3, 0.2]
    );
  }
}

function renderAcademicLegends(layout: PdfLayout, report: RenderableReport) {
  if (!report.content.legends.length) return;
  layout.heading("Legend", 2);
  layout.table(
    ["Code", "Meaning", "Configured range", "Grade point"],
    report.content.legends.map((row) => [
      row.code,
      row.label,
      row.minimumPercentage == null && row.maximumPercentage == null
        ? "Configured scale"
        : `${row.minimumPercentage ?? "-"} to ${row.maximumPercentage ?? "-"}`,
      row.gradePoint ?? "Not enabled"
    ]),
    [0.14, 0.36, 0.3, 0.2],
    { compact: true }
  );
}

function profileRows(report: RenderableReport): Array<[string, string]> {
  const identity = report.template.definition.identity as Record<string, unknown> | undefined;
  return [
    [String(identity?.studentLabel ?? "Student Name"), report.student.name],
    [String(identity?.admissionLabel ?? "Admission Number"), report.student.admissionNumber],
    [String(identity?.classSectionLabel ?? "Class / Section"), `${report.student.className}${report.student.section ? ` - ${report.student.section}` : ""}`],
    [String(identity?.rollLabel ?? "Roll Number"), report.student.rollNumber ?? "-"],
    ["Academic year", report.academicYear],
    ["Date of birth", report.student.dateOfBirth ?? "-"],
    ...(report.student.gender ? [["Gender", report.student.gender] as [string, string]] : []),
    ...(report.student.parentGuardians ?? []).map((row) => [row.label, row.value] as [string, string])
  ];
}

async function embeddedFonts(document: PDFDocument): Promise<PdfFonts> {
  const fontRoot = path.join(process.env.WINDIR || "C:\\Windows", "Fonts");
  const regularPath = FONT_REGULAR_CANDIDATES.map((name) => path.join(fontRoot, name))
    .find((candidate) => existsSync(candidate));
  const boldPath = FONT_BOLD_CANDIDATES.map((name) => path.join(fontRoot, name))
    .find((candidate) => existsSync(candidate));
  const schoolBoldPath = SCHOOL_BOLD_CANDIDATES.map((name) => path.join(fontRoot, name))
    .find((candidate) => existsSync(candidate));
  if (regularPath && boldPath) {
    document.registerFontkit(fontkit);
    const bold = await document.embedFont(readFileSync(boldPath), { subset: true });
    return {
      regular: await document.embedFont(readFileSync(regularPath), { subset: true }),
      bold,
      schoolBold: schoolBoldPath
        ? await document.embedFont(readFileSync(schoolBoldPath), { subset: true })
        : bold,
      embedded: true
    };
  }
  return {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    schoolBold: await document.embedFont(StandardFonts.TimesRomanBold),
    embedded: false
  };
}

async function embeddedLogo(
  document: PDFDocument,
  logoPath: string | null,
  mode: ReportColourMode
) {
  if (!logoPath || !logoPath.startsWith("/") || logoPath.startsWith("//")) return null;
  const publicRoot = path.resolve(process.cwd(), "public");
  const candidate = path.resolve(publicRoot, logoPath.replace(/^\/+/, ""));
  const relative = path.relative(publicRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !existsSync(candidate)) return null;
  const bytes = readFileSync(candidate);
  const extension = path.extname(candidate).toLowerCase();
  try {
    if (mode === "MONOCHROME") {
      return await document.embedPng(await sharp(bytes).grayscale().png().toBuffer());
    }
    if (extension === ".png") return await document.embedPng(bytes);
    if (extension === ".jpg" || extension === ".jpeg") return await document.embedJpg(bytes);
  } catch {
    return null;
  }
  return null;
}

function paletteFor(mode: ReportColourMode) {
  if (mode === "MONOCHROME") {
    return {
      monochrome: true,
      paper: rgb(1, 1, 1),
      ink: rgb(0.05, 0.05, 0.05),
      muted: rgb(0.28, 0.28, 0.28),
      border: rgb(0.18, 0.18, 0.18),
      headerFill: rgb(0.88, 0.88, 0.88),
      rowAlt: rgb(0.96, 0.96, 0.96),
      accent: rgb(0.72, 0.72, 0.72),
      seriesStudent: rgb(0.16, 0.16, 0.16),
      seriesAverage: rgb(0.68, 0.68, 0.68),
      seriesHighest: rgb(0.94, 0.94, 0.94)
    };
  }
  return {
    monochrome: false,
    paper: rgb(1, 1, 1),
    ink: rgb(0.07, 0.12, 0.18),
    muted: rgb(0.31, 0.38, 0.46),
    border: rgb(0.55, 0.68, 0.78),
    headerFill: rgb(0.89, 0.95, 0.98),
    rowAlt: rgb(0.97, 0.99, 1),
    accent: rgb(0.35, 0.72, 0.84),
    seriesStudent: rgb(0.08, 0.36, 0.56),
    seriesAverage: rgb(0.93, 0.55, 0.22),
    seriesHighest: rgb(0.42, 0.72, 0.42)
  };
}

function displayParentNumber(value: string | number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return printable(String(value));
  return Number(number.toFixed(1)).toString();
}

function drawCenteredText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  width: number,
  y: number,
  color: ReturnType<typeof rgb>
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  if (textWidth > width - 6) throw new Error(`Canonical card value does not fit without shrinking or truncation: ${text}`);
  page.drawText(text, { x: x + (width - textWidth) / 2, y, size, font, color });
}

function normalizeWidths(
  widths: number[] | undefined,
  count: number,
  total: number
) {
  if (!widths || widths.length !== count) return Array(count).fill(total / count);
  const sum = widths.reduce((value, current) => value + current, 0);
  if (sum <= 0) return Array(count).fill(total / count);
  return widths.map((width) => (width / sum) * total);
}

function wrapText(text: string, font: PDFFont, size: number, maximumWidth: number) {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const chunks = splitLongWord(word, font, size, maximumWidth);
      for (const chunk of chunks) {
        const candidate = current ? `${current} ${chunk}` : chunk;
        if (font.widthOfTextAtSize(candidate, size) <= maximumWidth) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = chunk;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines.length ? lines : [""];
}

function splitLongWord(word: string, font: PDFFont, size: number, maximumWidth: number) {
  if (font.widthOfTextAtSize(word, size) <= maximumWidth) return [word];
  const chunks: string[] = [];
  let current = "";
  for (const character of word) {
    const candidate = `${current}${character}`;
    if (current && font.widthOfTextAtSize(candidate, size) > maximumWidth) {
      chunks.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function fitText(text: string, font: PDFFont, size: number, maximumWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maximumWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}...`, size) > maximumWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}...`;
}

function printable(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\u2011/g, "-")
    .replace(/\u00A0/g, " ");
}

function boundedPercentage(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function humanState(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function filePart(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "NA";
}

function sanitizedPdfFileName(value: string) {
  const base = path.basename(value).replace(/[^A-Za-z0-9._-]+/g, "-");
  return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
}
