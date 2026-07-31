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

type RenderableReport = PublishedReportSnapshot | SafePublishedReportSnapshot;

const POINTS_PER_MM = 72 / 25.4;
const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const FONT_REGULAR_CANDIDATES = ["arial.ttf", "segoeui.ttf", "calibri.ttf"];
const FONT_BOLD_CANDIDATES = ["arialbd.ttf", "segoeuib.ttf", "calibrib.ttf"];

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

type PdfFonts = { regular: PDFFont; bold: PDFFont; embedded: boolean };

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
    this.drawPageHeader();
  }

  private drawPageHeader() {
    const headerHeight = 42;
    if (this.logo) {
      const ratio = this.logo.width / this.logo.height;
      const height = 28;
      this.page.drawImage(this.logo, {
        x: this.margin,
        y: this.y - height,
        width: height * ratio,
        height
      });
    }
    this.page.drawText(this.report.school.name, {
      x: this.margin + (this.logo ? 42 : 0),
      y: this.y - 13,
      size: 12,
      font: this.fonts.bold,
      color: this.palette.ink
    });
    this.page.drawText(this.report.publicationReference, {
      x: this.pageSize[0] - this.margin -
        this.fonts.regular.widthOfTextAtSize(this.report.publicationReference, 7.5),
      y: this.y - 12,
      size: 7.5,
      font: this.fonts.regular,
      color: this.palette.muted
    });
    this.page.drawLine({
      start: { x: this.margin, y: this.y - 34 },
      end: { x: this.pageSize[0] - this.margin, y: this.y - 34 },
      thickness: 0.8,
      color: this.palette.border
    });
    this.y -= headerHeight;
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
    widths?: number[]
  ) {
    const normalizedWidths = normalizeWidths(widths, headers.length, this.contentWidth);
    const headerSize = Math.max(this.minimumFontSize, 8.5);
    const bodySize = this.minimumFontSize;
    const drawHeader = () => {
      const headerLines = headers.map((header, index) =>
        wrapText(printable(header), this.fonts.bold, headerSize, normalizedWidths[index] - 8)
      );
      const height = Math.max(...headerLines.map((lines) => lines.length)) *
        headerSize * 1.2 + 10;
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
      const height = Math.max(24, maximumLines * bodySize * 1.2 + 9);
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
  layout.heading(report.title, 1);
  layout.paragraph(
    `${report.examination.code} | ${report.examination.name} | ${report.reportingPeriod}`,
    { bold: true }
  );
  layout.keyValues(profileRows(report));
  layout.heading("Academic result", 2);
  const componentRows = report.content.papers.flatMap((paper) =>
    paper.components.map((component, index) => [
      index === 0 ? paper.subjectName : "",
      index === 0 ? paper.paperName : "",
      component.name,
      humanState(component.state),
      component.state === "PRESENT" ? component.obtained ?? "0.00" : humanState(component.state),
      component.maximum,
      component.contribution ?? "-"
    ])
  );
  layout.table(
    ["Subject", "Paper", "Component", "State", "Obtained", "Maximum", "Contribution"],
    componentRows,
    [0.18, 0.14, 0.18, 0.12, 0.12, 0.12, 0.14]
  );
  layout.performanceBar(report.content.percentage);
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
  if (report.templateFamily === "RETAINED_MULTI_EXAM_I_X") {
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

function renderKgBooklet(layout: PdfLayout, report: RenderableReport) {
  layout.heading("Developmental progress booklet", 1);
  layout.paragraph(`${report.examination.name} | ${report.academicYear}`, { bold: true });
  layout.keyValues(profileRows(report));
  layout.paragraph(
    "This issued booklet records configured developmental observations. It does not infer weights or ranking rules."
  );
  for (const section of report.content.developmentalSections) {
    layout.heading(section.title, 2);
    layout.table(
      ["Development area", "Rating", "Remarks"],
      section.items.map((item) => [item.area, item.rating, item.remarks ?? "-"]),
      [0.45, 0.2, 0.35]
    );
  }
  if (report.content.papers.length) {
    layout.heading("Academic observations", 2);
    layout.table(
      ["Area", "Component", "State", "Observation / mark", "Maximum"],
      report.content.papers.flatMap((paper) =>
        paper.components.map((component) => [
          paper.subjectName,
          component.name,
          humanState(component.state),
          component.state === "PRESENT" ? component.obtained ?? "0.00" : humanState(component.state),
          component.maximum
        ])
      ),
      [0.24, 0.25, 0.16, 0.2, 0.15]
    );
  }
  renderAttendance(layout, report);
  renderRemarksAndLegends(layout, report);
  layout.keepTogether(100);
  layout.heading("Required signatures", 2);
  layout.signatures(report.signatures);
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
      ["Code", "Meaning"],
      report.content.legends.map((row) => [row.code, row.label]),
      [0.2, 0.8]
    );
  }
}

function profileRows(report: RenderableReport): Array<[string, string]> {
  return [
    ["Student", report.student.name],
    ["Admission number", report.student.admissionNumber],
    ["Class / section", `${report.student.className}${report.student.section ? ` - ${report.student.section}` : ""}`],
    ["Roll number", report.student.rollNumber ?? "-"],
    ["Academic year", report.academicYear],
    ["Date of birth", report.student.dateOfBirth ?? "-"]
  ];
}

async function embeddedFonts(document: PDFDocument): Promise<PdfFonts> {
  const fontRoot = path.join(process.env.WINDIR || "C:\\Windows", "Fonts");
  const regularPath = FONT_REGULAR_CANDIDATES.map((name) => path.join(fontRoot, name))
    .find((candidate) => existsSync(candidate));
  const boldPath = FONT_BOLD_CANDIDATES.map((name) => path.join(fontRoot, name))
    .find((candidate) => existsSync(candidate));
  if (regularPath && boldPath) {
    document.registerFontkit(fontkit);
    return {
      regular: await document.embedFont(readFileSync(regularPath), { subset: true }),
      bold: await document.embedFont(readFileSync(boldPath), { subset: true }),
      embedded: true
    };
  }
  return {
    regular: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
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
      accent: rgb(0.72, 0.72, 0.72)
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
    accent: rgb(0.35, 0.72, 0.84)
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
