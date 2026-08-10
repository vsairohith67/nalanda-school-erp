import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
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

type RenderableReport = PublishedReportSnapshot | SafePublishedReportSnapshot;

const POINTS_PER_MM = 72 / 25.4;
const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const FONT_REGULAR_CANDIDATES = ["arial.ttf", "segoeui.ttf", "calibri.ttf"];
const FONT_BOLD_CANDIDATES = ["arialbd.ttf", "segoeuib.ttf", "calibrib.ttf"];
const SCHOOL_BOLD_CANDIDATES = ["georgiab.ttf", "Georgia Bold.ttf"];

export async function renderReportPdf(
  report: RenderableReport,
  mode: ReportColourMode
) {
  const document = await PDFDocument.create();
  document.setTitle(`${report.title} - ${report.publicationReference}`);
  document.setAuthor(report.school.name);
  document.setSubject("Governed issued school report card");
  document.setProducer("Nalanda governed report publication");
  document.setCreator("Nalanda Fee Control");
  document.setCreationDate(new Date("2000-01-01T00:00:00.000Z"));
  document.setModificationDate(new Date("2000-01-01T00:00:00.000Z"));
  const fonts = await embeddedFonts(document);
  const logo = await embeddedLogo(document, report.school.logoPath);
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
    this.pages.push(this.page);
    this.pageNumber += 1;
    this.y = this.pageSize[1] - this.margin;
    if (this.pageNumber === 1) this.y -= 58;
  }

  pageBreak() {
    this.newPage();
  }

  private drawPageHeader(page: PDFPage) {
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
      x: this.pageSize[0] - this.margin -
        this.fonts.regular.widthOfTextAtSize(this.report.publicationReference, 7.5),
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
      page.drawImage(this.logo, {
        x: this.margin,
        y: topY - height,
        width: height * ratio,
        height
      });
    }
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
      this.patternBox(x, this.y - 11, 12, 8, item.color, item.pattern);
      this.page.drawText(item.label, {
        x: x + 17,
        y: this.y - 10,
        size: 7.5,
        font: this.fonts.bold,
        color: this.palette.ink
      });
    });
    for (let tick = 0; tick <= 100; tick += 20) {
      const y = chartBottom + (tick / 100) * chartHeight;
      this.page.drawLine({
        start: { x: this.margin, y },
        end: { x: this.margin + graphWidth, y },
        thickness: tick === 0 ? 0.8 : 0.35,
        color: this.palette.border
      });
      this.page.drawText(String(tick), {
        x: this.margin,
        y: y + 2,
        size: 6.5,
        font: this.fonts.regular,
        color: this.palette.muted
      });
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
        this.patternBox(x, chartBottom, barWidth, barHeight, item.color, item.pattern);
        const label = value.toFixed(value % 1 === 0 ? 0 : 1);
        this.page.drawText(label, {
          x,
          y: chartBottom + barHeight + 2,
          size: 5.8,
          font: this.fonts.bold,
          color: this.palette.ink
        });
      });
      const label = paper.paperName && paper.paperName !== paper.subjectName
        ? `${paper.subjectName} ${paper.paperName}`
        : paper.subjectName;
      const lines = wrapText(printable(label), this.fonts.regular, 5.8, Math.max(22, groupWidth - 3)).slice(0, 3);
      lines.forEach((line, index) => this.page.drawText(line, {
        x: groupX + 2,
        y: chartBottom - 9 - index * 6.3,
        size: 5.8,
        font: this.fonts.regular,
        color: this.palette.ink
      }));
    });
    this.y -= height + labelReserve - 25;
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

  signatures(signatures: RenderableReport["signatures"]) {
    this.ensure(70);
    const width = this.contentWidth / Math.max(1, signatures.length);
    signatures.forEach((signature, index) => {
      const x = this.margin + index * width + 4;
      this.page.drawLine({
        start: { x, y: this.y - 42 },
        end: { x: x + width - 18, y: this.y - 42 },
        thickness: 0.7,
        color: this.palette.ink
      });
      const label = printable(signature.label);
      const clipped = fitText(label, this.fonts.regular, 8, width - 18);
      this.page.drawText(clipped, {
        x,
        y: this.y - 54,
        size: 8,
        font: this.fonts.regular,
        color: this.palette.ink
      });
    });
    this.y -= 64;
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
  layout.keyValues(profileRows(report));
  renderAcademicMarks(layout, report);
  layout.keyValues([
    ["Total", `${report.content.totalObtained} / ${report.content.totalMaximum}`],
    ["Grade", report.content.grade ? `${report.content.grade.code} - ${report.content.grade.label}` : "Not enabled"],
    ["Grade point", report.content.grade?.point ?? "Not enabled"],
    ["Pass / result", report.content.passResult ?? "Not enabled"],
    ["Rank", report.content.rank == null ? "Not enabled" : String(report.content.rank)],
    ["Cohort average", report.content.cohortAverage ?? "Not available"]
  ]);
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
  renderAttendance(layout, report);
  renderRemarksAndLegends(layout, report);
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

async function embeddedLogo(document: PDFDocument, logoPath: string | null) {
  if (!logoPath || !logoPath.startsWith("/") || logoPath.startsWith("//")) return null;
  const publicRoot = path.resolve(process.cwd(), "public");
  const candidate = path.resolve(publicRoot, logoPath.replace(/^\/+/, ""));
  const relative = path.relative(publicRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !existsSync(candidate)) return null;
  const bytes = readFileSync(candidate);
  const extension = path.extname(candidate).toLowerCase();
  try {
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
