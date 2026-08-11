import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  degrees,
  rgb
} from "pdf-lib";

export type ReportVisualDirection = "LEGACY_EXACT" | "LEGACY_REFINED";

export type VisualDirectionPageKind =
  | "KG_COVER"
  | "KG_PROFILE"
  | "KG_INTELLECTUAL"
  | "CLASS_II_SESSION"
  | "CLASS_V_SESSION"
  | "CLASS_VI_GROUPED"
  | "CLASS_IX_COMBINED"
  | "CLASS_X_CT_REVISION";

export const VISUAL_DIRECTION_PAGE_KINDS: VisualDirectionPageKind[] = [
  "KG_COVER",
  "KG_PROFILE",
  "KG_INTELLECTUAL",
  "CLASS_II_SESSION",
  "CLASS_V_SESSION",
  "CLASS_VI_GROUPED",
  "CLASS_IX_COMBINED",
  "CLASS_X_CT_REVISION"
];

const A4 = { width: 595.28, height: 841.89 } as const;

type Fonts = { regular: PDFFont; bold: PDFFont; school: PDFFont };
type DirectionAssets = { fonts: Fonts; logo: PDFImage | null };
type Palette = ReturnType<typeof palette>;

type AcademicPage = {
  classSection: string;
  examination: string;
  identityMode: "Parent / Guardian" | "Father Name";
  subjects: Array<{ subject: string; values: string[]; emphasis?: boolean }>;
  columns: string[];
  traits: string[];
  total: string;
  percentage: string;
  grade: string;
  gradePoint: string | null;
  rank: string | null;
  workingDays: string;
  daysPresent: string;
  attendancePercentage: string;
  remarks: string;
  combined: boolean;
  chartLabels: string[];
};

export async function renderVisualDirectionPage(
  kind: VisualDirectionPageKind,
  direction: ReportVisualDirection,
  edgeCase = false
) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document);
  const page = document.addPage([A4.width, A4.height]);
  drawVisualDirectionPage(page, assets, kind, direction, edgeCase);
  document.setTitle(`${kind} ${direction} synthetic visual direction`);
  document.setSubject("Synthetic-only report-card visual-direction approval");
  document.setProducer("Nalanda ERP local synthetic visual-direction renderer");
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

export async function renderVisualDirectionPack(edgeCase = false) {
  const document = await PDFDocument.create();
  const assets = await embedAssets(document);
  if (edgeCase) {
    for (const kind of VISUAL_DIRECTION_PAGE_KINDS) {
      const page = document.addPage([A4.width, A4.height]);
      drawVisualDirectionPage(page, assets, kind, "LEGACY_REFINED", true);
    }
  } else {
    for (const kind of VISUAL_DIRECTION_PAGE_KINDS) {
      for (const direction of ["LEGACY_EXACT", "LEGACY_REFINED"] as const) {
        const page = document.addPage([A4.width, A4.height]);
        drawVisualDirectionPage(page, assets, kind, direction, false);
      }
    }
  }
  document.setTitle(edgeCase ? "EDGE-CASE-RENDERING-PACK" : "VISUAL-DIRECTION-PACK");
  document.setSubject("Synthetic-only report-card visual approval");
  document.setProducer("Nalanda ERP local synthetic visual-direction renderer");
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

function drawVisualDirectionPage(
  page: PDFPage,
  assets: DirectionAssets,
  kind: VisualDirectionPageKind,
  direction: ReportVisualDirection,
  edgeCase: boolean
) {
  const colors = palette(direction);
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.paper });
  if (kind === "KG_COVER") drawKgCover(page, assets, direction, colors, edgeCase);
  else if (kind === "KG_PROFILE") drawKgProfile(page, assets, direction, colors, edgeCase);
  else if (kind === "KG_INTELLECTUAL") drawKgIntellectual(page, assets, direction, colors, edgeCase);
  else drawAcademic(page, assets, direction, colors, academicDefinition(kind, edgeCase), edgeCase);
  drawSyntheticFooter(page, assets.fonts, direction, edgeCase);
}

function drawKgCover(
  page: PDFPage,
  assets: DirectionAssets,
  direction: ReportVisualDirection,
  colors: Palette,
  edgeCase: boolean
) {
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.kgGreen });
  page.drawRectangle({ x: 0, y: 682, width: A4.width, height: 53, color: colors.kgPink });
  page.drawRectangle({ x: 0, y: 640, width: 360, height: 28, color: colors.kgCream });
  page.drawRectangle({ x: 235, y: 640, width: 360, height: 28, color: colors.kgPink });
  page.drawRectangle({ x: 0, y: 76, width: A4.width, height: 58, color: colors.kgPink });
  page.drawRectangle({ x: 0, y: 43, width: 365, height: 31, color: colors.kgCream });
  page.drawRectangle({ x: 220, y: 42, width: 375, height: 32, color: colors.kgGreenDark });
  page.drawRectangle({ x: 37, y: 151, width: A4.width - 74, height: 455, color: colors.kgCream, opacity: 0.52 });
  page.drawRectangle({ x: 44, y: 158, width: A4.width - 88, height: 441, borderColor: colors.kgPink, borderWidth: 1.4 });
  if (assets.logo) page.drawImage(assets.logo, { x: 139, y: 449, width: 72, height: 72 });
  centered(page, "NALANDA", assets.fonts.school, 30, 456, colors.kgPinkDark);
  centered(page, "PUBLIC SCHOOL", assets.fonts.school, 22, 427, colors.kgPinkDark);
  centered(page, "PROGRESS REPORT", assets.fonts.bold, 17, 386, colors.kgInk);
  centered(page, direction === "LEGACY_EXACT" ? "Knowledge is Power" : "Knowledge - Character - Progress", assets.fonts.regular, 9.2, 366, colors.kgGreenText);
  page.drawRectangle({ x: 142, y: 235, width: 311, height: 88, color: colors.white, borderColor: colors.kgPink, borderWidth: direction === "LEGACY_EXACT" ? 1 : 1.5 });
  lineField(page, assets.fonts, "Name", edgeCase ? "Synthetic Student With A Long Name" : "Aarav Rahman", 157, 292, 280, colors);
  lineField(page, assets.fonts, "Class / Sec.", edgeCase ? "LKG - SYNTHETIC" : "LKG - A", 157, 262, 150, colors);
  lineField(page, assets.fonts, "Roll No.", edgeCase ? "S-100" : "12", 333, 262, 105, colors);
  const vertical = "P R O G R E S S   R E P O R T";
  page.drawText(vertical, { x: 505, y: 184, size: 8.5, font: assets.fonts.bold, color: colors.kgGreenText, rotate: degrees(90) });
}

function drawKgProfile(
  page: PDFPage,
  assets: DirectionAssets,
  direction: ReportVisualDirection,
  colors: Palette,
  edgeCase: boolean
) {
  drawKgFrame(page, colors, direction);
  centered(page, "STUDENT'S PROFILE", assets.fonts.school, 22, 762, colors.kgPinkDark);
  centered(page, "2099 - 2100", assets.fonts.bold, 10, 741, colors.kgPinkDark);
  page.drawRectangle({ x: 430, y: 633, width: 84, height: 108, borderColor: colors.kgGreenText, borderWidth: 0.8 });
  centeredInBox(page, "AFFIX\nPHOTO\nHERE", assets.fonts.bold, 8.5, { x: 430, y: 633, width: 84, height: 108 }, colors.kgPinkDark);
  const rows = [
    ["Name", edgeCase ? "Aarav-Synthetic Extremely Long Multilingual-Compatible Name" : "Aarav Rahman"],
    ["Date of Birth", "01 January 2094"],
    ["Class / Section", "LKG - A"],
    ["Roll No.", "12"],
    ["Admission No.", "SYN-0012"],
    ["Parent / Guardian", edgeCase ? "Synthetic Guardian With An Exceptionally Long Name" : "Samira Rahman"],
    ["Address", edgeCase ? "42 Synthetic Learning Avenue, Long Locality Name, Hyderabad" : "42 Sample Road, Hyderabad"],
    ["Phone", "+91 00000 00000"],
    ["Emergency", "+91 00000 00001"]
  ];
  let y = 625;
  for (const [label, value] of rows) {
    page.drawText(label, { x: 76, y, size: 10, font: assets.fonts.regular, color: colors.kgGreenText });
    page.drawText(fit(value, assets.fonts.regular, 10, 315), { x: 185, y, size: 10, font: assets.fonts.regular, color: colors.kgInk });
    page.drawLine({ start: { x: 180, y: y - 3 }, end: { x: 510, y: y - 3 }, thickness: 0.55, color: colors.kgGreenText, dashArray: [1, 2] });
    y -= 48;
  }
  page.drawLine({ start: { x: 367, y: 93 }, end: { x: 515, y: 93 }, thickness: 0.6, color: colors.kgGreenText, dashArray: [1, 2] });
  page.drawText("Signature of Parent / Guardian", { x: 353, y: 77, size: 9.2, font: assets.fonts.bold, color: colors.kgPinkDark });
}

function drawKgIntellectual(
  page: PDFPage,
  assets: DirectionAssets,
  direction: ReportVisualDirection,
  colors: Palette,
  edgeCase: boolean
) {
  drawKgFrame(page, colors, direction);
  centered(page, "INTELLECTUAL SKILLS", assets.fonts.school, 19, 772, colors.kgPinkDark);
  const x = 55;
  const top = 100;
  const widths = [214, 55, 55, 55, 55, 55];
  const headers = ["Intellectual Skills", "Evaluation\nI", "Evaluation\nII", "Evaluation\nIII", "Evaluation\nIV", "Evaluation\nV"];
  const rows = [
    ["Language Skills - English", "G", "G", "S", "G", "G"],
    ["Reading", "G", "G", "G", "G", "G"],
    ["Conversation in English", "S", "G", "G", "G", "G"],
    ["Recitation", "G", "G", "G", "G", "G"],
    ["Written Work", "G", "S", "G", "G", "G"],
    ["Dictation", "S", "S", "G", "G", "G"],
    ["Home Assignment", "G", "G", "G", "G", "G"],
    ["Hindi", "G", "G", "G", "G", "G"],
    ["Reading and Recitation", "S", "G", "G", "G", "G"],
    [edgeCase ? "Recognition of Numbers and Number Operations" : "Mathematics", "G", "G", "G", "G", "G"],
    ["Environmental Study", "G", "G", "S", "G", "G"],
    ["Drawing and Colouring", "G", "G", "G", "G", "G"],
    ["Overall Grade", "G", "G", "G", "G", "G"]
  ];
  drawGrid(page, assets.fonts, colors, x, top, widths, headers, rows, { rowHeight: 39, headerHeight: 48, firstColumnLeft: true, fontSize: 8.4, headerColor: colors.kgPink });
  page.drawText("G: Good   S: Satisfactory   N: Needs Improvement", { x: 163, y: 94, size: 8.5, font: assets.fonts.bold, color: colors.kgGreenText });
}

function drawAcademic(
  page: PDFPage,
  assets: DirectionAssets,
  direction: ReportVisualDirection,
  colors: Palette,
  report: AcademicPage,
  edgeCase: boolean
) {
  drawAcademicHeader(page, assets, colors, direction);
  const name = edgeCase ? "Aarav-Synthetic Extremely Long Multilingual-Compatible Student Name" : "Aarav Rahman";
  const guardian = edgeCase ? "Synthetic Parent / Guardian With An Exceptionally Long Name" : "Samira Rahman";
  drawIdentity(page, assets.fonts, colors, report, name, guardian);
  centered(page, report.examination, assets.fonts.bold, 13.5, 647, colors.ink);

  const marksX = 37;
  const marksTop = 202;
  const fullWidth = A4.width - 74;
  const marksWidth = report.combined ? fullWidth : 313;
  const traitWidth = report.combined ? 0 : fullWidth - marksWidth;
  const subjectWidth = report.combined ? 121 : 122;
  const remaining = marksWidth - subjectWidth;
  const marksWidths = [subjectWidth, ...report.columns.map(() => remaining / report.columns.length)];
  const marksHeaders = ["Subject", ...report.columns];
  const marksRows = report.subjects.map((row) => [row.subject, ...row.values]);
  const academicRowHeight = report.combined ? 23 : 18;
  drawGrid(page, assets.fonts, colors, marksX, marksTop, marksWidths, marksHeaders, marksRows, {
    rowHeight: academicRowHeight,
    headerHeight: report.combined ? 44 : 24,
    firstColumnLeft: true,
    fontSize: report.combined ? 6.7 : 8.3,
    emphasizeRows: new Set(report.subjects.map((row, index) => row.emphasis ? index : -1))
  });
  let sideBottomTop = marksTop;
  if (!report.combined) {
    const traitRows = report.traits.map((trait, index) => [trait, index % 7 === 4 ? "S" : "G"]);
    drawGrid(page, assets.fonts, colors, marksX + marksWidth, marksTop, [traitWidth - 58, 58], [report.classSection.startsWith("II") || report.classSection.startsWith("V") ? "Skills" : "Personality Development", "Grade"], traitRows, {
      rowHeight: academicRowHeight,
      headerHeight: 24,
      firstColumnLeft: false,
      fontSize: 7.8
    });
    const traitBottomTop = marksTop + 24 + traitRows.length * academicRowHeight;
    drawSmallLegend(page, assets.fonts, colors, marksX + marksWidth, traitBottomTop, traitWidth);
    sideBottomTop = traitBottomTop + 30;
  }

  const marksBottomTop = marksTop + (report.combined ? 44 : 24) + report.subjects.length * academicRowHeight;
  let yTop = Math.max(report.combined ? 411 : 400, marksBottomTop + 8, sideBottomTop + 8);
  drawSummary(page, assets.fonts, colors, report, yTop);
  yTop += 30;
  if (!report.combined) {
    drawAttendanceBand(page, assets.fonts, colors, report, yTop);
    yTop += 42;
  }
  drawRemarks(page, assets.fonts, colors, report.remarks, yTop);
  yTop += 48;
  const chartHeight = report.combined ? 105 : report.subjects.length > 11 ? 145 : 155;
  drawChart(page, assets.fonts, colors, report.chartLabels, 37, yTop, fullWidth, chartHeight, direction);
  yTop += chartHeight + 10;
  drawGradeLegend(page, assets.fonts, colors, 37, yTop, fullWidth, report.classSection.startsWith("VIII") || report.classSection.startsWith("X"));
  drawSignatures(page, assets.fonts, colors);
}

function drawAcademicHeader(page: PDFPage, assets: DirectionAssets, colors: Palette, direction: ReportVisualDirection) {
  if (assets.logo) page.drawImage(assets.logo, { x: 112, y: 748, width: 64, height: 64 });
  centered(page, "NALANDA PUBLIC SCHOOL", assets.fonts.school, direction === "LEGACY_EXACT" ? 20 : 21, 786, colors.ink, 45);
  centered(page, "(Affiliated to CISCE, New Delhi, Estd. 1972)", assets.fonts.school, 10.5, 762, colors.ink, 70);
  centered(page, direction === "LEGACY_EXACT" ? "Nanalnagar, Mehdipatnam, Hyderabad" : "Nanal Nagar, Mehdipatnam, Hyderabad", assets.fonts.school, 10.5, 741, colors.ink, 70);
}

function drawIdentity(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicPage, name: string, guardian: string) {
  const x = 39;
  const top = 110;
  const widths = [235, 285];
  const rows = [
    ["Student Name", name],
    [report.identityMode, guardian],
    ["Admission Number #", "SYN-2099-0012"],
    ["Class-Section", `${report.classSection}                 Roll No.        12`]
  ];
  drawGrid(page, fonts, colors, x, top, widths, [], rows, { rowHeight: 16, headerHeight: 0, firstColumnLeft: false, fontSize: 7.8, identity: true });
}

function drawSummary(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicPage, top: number) {
  const values = [
    `Total: ${report.total}`,
    `Percentage: ${report.percentage}`,
    `Grade: ${report.grade}`,
    ...(report.gradePoint ? [`Grade Point: ${report.gradePoint}`] : []),
    ...(report.rank ? [`Rank: ${report.rank}`] : [])
  ];
  const width = (A4.width - 74) / values.length;
  drawGrid(page, fonts, colors, 37, top, values.map(() => width), [], [values], { rowHeight: 20, headerHeight: 0, firstColumnLeft: false, fontSize: 8.3, summary: true });
}

function drawAttendanceBand(page: PDFPage, fonts: Fonts, colors: Palette, report: AcademicPage, top: number) {
  drawGrid(page, fonts, colors, 37, top, [173.75, 173.75, 173.5], ["Working Days", "Days Present", "Attendance %"], [[report.workingDays, report.daysPresent, report.attendancePercentage]], { rowHeight: 15, headerHeight: 16, firstColumnLeft: false, fontSize: 7.8 });
}

function drawRemarks(page: PDFPage, fonts: Fonts, colors: Palette, remarks: string, top: number) {
  rectTop(page, 37, top, A4.width - 74, 37, colors.white, colors.border, 0.7);
  page.drawText("General Remarks :-", { x: 42, y: A4.height - top - 14, size: 8.2, font: fonts.bold, color: colors.ink });
  page.drawText(fit(remarks, fonts.regular, 7.7, 392), { x: 128, y: A4.height - top - 14, size: 7.7, font: fonts.regular, color: colors.ink });
}

function drawChart(page: PDFPage, fonts: Fonts, colors: Palette, labels: string[], x: number, top: number, width: number, height: number, direction: ReportVisualDirection) {
  rectTop(page, x, top, width, height, colors.white, colors.border, 0.7);
  const bottom = A4.height - top - height + 22;
  const left = x + 24;
  const chartW = width - 36;
  const chartH = height - 52;
  page.drawText("Student Marks (%)", { x: x + 8, y: A4.height - top - 16, size: 9.5, font: fonts.bold, color: colors.ink });
  const legendX = x + width - 226;
  [[colors.student, "Student Marks"], [colors.average, "Class Average"], [colors.high, "High Score"]].forEach(([color, label], index) => {
    page.drawRectangle({ x: legendX + index * 76, y: A4.height - top - 18, width: 8, height: 8, color: color as ReturnType<typeof rgb> });
    page.drawText(label as string, { x: legendX + 11 + index * 76, y: A4.height - top - 17, size: 6.2, font: fonts.bold, color: colors.ink });
  });
  for (let tick = 0; tick <= 100; tick += 20) {
    const y = bottom + chartH * tick / 100;
    page.drawLine({ start: { x: left, y }, end: { x: left + chartW, y }, thickness: 0.35, color: colors.grid, dashArray: direction === "LEGACY_REFINED" ? [2, 2] : [1, 2] });
    page.drawText(String(tick), { x: left - 18, y: y - 2, size: 5.3, font: fonts.regular, color: colors.ink });
  }
  const slot = chartW / labels.length;
  labels.forEach((label, index) => {
    const values = [64 + (index * 7) % 32, 58 + (index * 5) % 27, 92 + (index % 4) * 2];
    values.forEach((value, series) => {
      const barW = Math.max(5, Math.min(10, slot / 4));
      const bx = left + index * slot + slot / 2 - barW * 1.5 + series * barW;
      const bh = chartH * value / 100;
      page.drawRectangle({ x: bx, y: bottom, width: barW - 0.8, height: bh, color: [colors.student, colors.average, colors.high][series], borderColor: colors.ink, borderWidth: 0.35 });
      page.drawText(String(value), { x: bx, y: bottom + bh + 2, size: 4.6, font: fonts.bold, color: colors.ink });
    });
    page.drawText(fit(label, fonts.regular, 5.2, slot - 2), { x: left + index * slot + 1, y: bottom - 10, size: 5.2, font: fonts.regular, color: colors.ink });
  });
}

function drawGradeLegend(page: PDFPage, fonts: Fonts, colors: Palette, x: number, top: number, width: number, alternate: boolean) {
  const ranges = alternate ? ["90 - 100", "80 - 89", "70 - 79", "60 - 69", "50 - 59", "35 - 49", "0 - 34"] : ["91 - 100", "81 - 90", "71 - 80", "61 - 70", "51 - 60", "41 - 50", "35 - 40", "0 - 34"];
  const grades = alternate ? ["A+", "A", "B", "C", "D", "E", "F"] : ["A1", "A2", "B1", "B2", "C1", "C2", "D", "E"];
  const widths = [126, ...ranges.map(() => (width - 126) / ranges.length)];
  drawGrid(page, fonts, colors, x, top, widths, [], [["School % Ratings", ...ranges], ["Grade", ...grades]], { rowHeight: 15, headerHeight: 0, firstColumnLeft: false, fontSize: 7.2 });
  page.drawText("Grade Legend", { x: x + width / 2 - 28, y: A4.height - top + 3, size: 8.2, font: fonts.regular, color: colors.legendTitle });
}

function drawSignatures(page: PDFPage, fonts: Fonts, colors: Palette) {
  const labels = ["Class Teacher", "Principal", "Parent / Guardian", "Director"];
  labels.forEach((label, index) => {
    const x = 66 + index * 137;
    page.drawLine({ start: { x, y: 53 }, end: { x: x + 92, y: 53 }, thickness: 0.45, color: colors.border });
    page.drawText(label, { x: x + 8, y: 38, size: 8, font: fonts.bold, color: colors.ink });
  });
}

function drawSmallLegend(page: PDFPage, fonts: Fonts, colors: Palette, x: number, top: number, width: number) {
  drawGrid(page, fonts, colors, x, top, [52, (width - 52) / 2, (width - 52) / 2], [], [["Grading", "G : Good", "S : Satisfactory"], ["", "N : Needs Improvement", ""]], { rowHeight: 15, headerHeight: 0, firstColumnLeft: false, fontSize: 6.7 });
}

function drawKgFrame(page: PDFPage, colors: Palette, direction: ReportVisualDirection) {
  page.drawRectangle({ x: 0, y: 0, width: A4.width, height: A4.height, color: colors.kgPinkLight });
  page.drawRectangle({ x: 29, y: 29, width: A4.width - 58, height: A4.height - 58, color: colors.kgGreen, opacity: 0.52 });
  page.drawRectangle({ x: 39, y: 39, width: A4.width - 78, height: A4.height - 78, color: colors.kgCream, borderColor: colors.kgPinkDark, borderWidth: direction === "LEGACY_EXACT" ? 0.9 : 1.2 });
  page.drawRectangle({ x: 47, y: 47, width: A4.width - 94, height: A4.height - 94, borderColor: colors.kgGreenText, borderWidth: 0.55 });
}

function drawGrid(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  x: number,
  top: number,
  widths: number[],
  headers: string[],
  rows: string[][],
  options: {
    rowHeight: number;
    headerHeight: number;
    firstColumnLeft: boolean;
    fontSize: number;
    headerColor?: ReturnType<typeof rgb>;
    emphasizeRows?: Set<number>;
    identity?: boolean;
    summary?: boolean;
  }
) {
  let yTop = top;
  if (headers.length) {
    drawGridRow(page, fonts, colors, x, yTop, widths, headers, options.headerHeight, options.fontSize, true, false, options.headerColor);
    yTop += options.headerHeight;
  }
  rows.forEach((row, rowIndex) => {
    drawGridRow(page, fonts, colors, x, yTop, widths, row, options.rowHeight, options.fontSize, options.summary || Boolean(options.emphasizeRows?.has(rowIndex)), options.firstColumnLeft, undefined, options.identity);
    yTop += options.rowHeight;
  });
}

function drawGridRow(
  page: PDFPage,
  fonts: Fonts,
  colors: Palette,
  x: number,
  top: number,
  widths: number[],
  values: string[],
  height: number,
  fontSize: number,
  bold: boolean,
  firstColumnLeft: boolean,
  headerColor?: ReturnType<typeof rgb>,
  identity = false
) {
  let cursor = x;
  values.forEach((raw, index) => {
    const fill = headerColor ?? (bold ? colors.band : colors.white);
    rectTop(page, cursor, top, widths[index], height, fill, identity ? colors.ink : colors.border, identity ? 0.75 : 0.45);
    const font = bold || (identity && index === 1 && values.length === 2) ? fonts.bold : fonts.regular;
    const text = fit(String(raw), font, fontSize, widths[index] - 6);
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const tx = index === 0 && firstColumnLeft ? cursor + 4 : cursor + Math.max(3, (widths[index] - textWidth) / 2);
    const lines = raw.includes("\n") ? raw.split("\n") : [text];
    lines.slice(0, 2).forEach((line, lineIndex) => {
      const clipped = fit(line, font, fontSize, widths[index] - 6);
      const lineWidth = font.widthOfTextAtSize(clipped, fontSize);
      const lineX = index === 0 && firstColumnLeft ? cursor + 4 : cursor + Math.max(3, (widths[index] - lineWidth) / 2);
      page.drawText(clipped, { x: lines.length > 1 ? lineX : tx, y: A4.height - top - height / 2 - fontSize / 3 - (lineIndex - (lines.length - 1) / 2) * (fontSize + 1), size: fontSize, font, color: headerColor ? colors.white : colors.ink });
    });
    cursor += widths[index];
  });
}

function academicDefinition(kind: Exclude<VisualDirectionPageKind, "KG_COVER" | "KG_PROFILE" | "KG_INTELLECTUAL">, edgeCase: boolean): AcademicPage {
  const primaryTraits = ["Reading Skills", "Writing Skills", "Speaking Skills", "Listening Skills", "Problem Solving Techniques", "Mental Ability", "Concepts", "Tables", "Environmental Sensitivity", "Spoken English"];
  const personality = ["Courteousness", "Confidence", "Dress and Cleanliness", "Regularity and Punctuality", "Self-Control", "General Discipline", "Sharing and Caring", "Participation towards School activities", "Leadership Quality", "Spirit of Service"];
  const primarySubjects = (upper: boolean) => [
    ["English", "18", "72", "90.0"],
    ["Hindi", "17", "69", "86.0"],
    ["Mathematics", edgeCase ? "ABSENT" : "20", edgeCase ? "-" : "76", edgeCase ? "ABSENT" : "96.0"],
    [upper ? "Science" : "Environmental Studies", "19", "71", "90.0"],
    ...(upper ? [["Social", "18", "70", "88.0"]] : []),
    ["Computer Applications", "20", "75", "95.0"],
    [edgeCase ? "Third Language With A Long Subject Name" : "Telugu", edgeCase ? "EXEMPT" : "16", edgeCase ? "-" : "70", edgeCase ? "EXEMPT" : "86.0"],
    ["G.K./V.E.", "", "A1", ""]
  ].map(([subject, ...values]) => ({ subject, values }));
  const groupedSubjects = [
    { subject: "English Paper-1", values: ["19", "60", "79.0"] },
    { subject: "English Paper-2", values: ["20", "48", "68.0"] },
    { subject: "English Average", values: ["19.5", "54.0", "73.5"], emphasis: true },
    { subject: "Hindi", values: ["20", "51", "71.0"] },
    { subject: "History", values: ["19", "77", "96.0"] },
    { subject: "Geography", values: ["20", "68", "88.0"] },
    { subject: "Social Average", values: ["19.5", "72.5", "92.0"], emphasis: true },
    { subject: "Mathematics", values: edgeCase ? ["NOT ENTERED", "-", "NOT ENTERED"] : ["19", "43", "62.0"] },
    { subject: "Physics", values: ["19", "58", "77.0"] },
    { subject: "Chemistry", values: ["20", "69", "89.0"] },
    { subject: "Biology", values: ["18", "70", "88.0"] },
    { subject: "Science Average", values: ["19.0", "65.7", "84.7"], emphasis: true },
    { subject: "Computers", values: ["18", "48", "66.0"] }
  ];
  if (kind === "CLASS_II_SESSION") return baseAcademic("II-A", "SESSION END EXAM", primarySubjects(false), ["Internal Assessment (20)", "Written Examination (80)", "Total (100)"], primaryTraits, false, ["English", "Hindi", "Maths", "EVS", "Computers", "Telugu"]);
  if (kind === "CLASS_V_SESSION") return baseAcademic("V-A", "SESSION END EXAM", primarySubjects(true), ["Internal Assessment (20)", "Written Examination (80)", "Total (100)"], primaryTraits, false, ["English", "Hindi", "Maths", "Science", "Social", "Computers", "Telugu"]);
  if (kind === "CLASS_VI_GROUPED") return baseAcademic("VI-A", "SESSION END EXAM", groupedSubjects, ["Internal Assessment (20)", "Written Examination (80)", "Total (100)"], personality, false, ["English P1", "English P2", "Hindi", "History", "Geography", "Maths", "Physics", "Chemistry", "Biology"]);
  if (kind === "CLASS_X_CT_REVISION") return baseAcademic("X-A", edgeCase ? "REVISION EXAMINATION" : "COMPREHENSIVE TEST 1", groupedSubjects, ["Internal Assessment (10)", "Written Examination (40)", "Total (50)"], personality, false, ["English P1", "English P2", "Hindi", "History", "Geography", "Maths", "Physics", "Chemistry", "Biology"]);
  const combinedColumns = ["CT 1\n(50)", "IA 1\n(10)", "CT 2\n(50)", "IA 2\n(10)", "CT 3\n(50)", "IA 3\n(10)", "CT Total\n(30%)", "Terminal\n(100)", "Terminal\n(20%)", "Annual\n(100)", "Annual\n(50%)", "Total\n(100)", "Grade", "Grade\nPoint"];
  const combinedSubjects = ["English Paper-1", "English Paper-2", "English Average", "Hindi", "Mathematics", "Physics", "Biology", "Chemistry", "Science Average", "Geography", "History", "Social Average", "Computers"].map((subject, index) => ({
    subject: edgeCase && index === 4 ? "Mathematics - Advanced Applications" : subject,
    values: combinedColumns.map((_, col) => col === 12 ? ["B2", "B1", "B1"][index % 3] : col === 13 ? (7 + index % 3 * 0.5).toFixed(1) : String(Math.max(5, Math.min(98, 24 + index * 3 + col * 2)))),
    emphasis: subject.includes("Average")
  }));
  return baseAcademic("IX-A", "COMBINED RESULT", combinedSubjects, combinedColumns, [], true, ["English P1", "English P2", "Hindi", "Maths", "Physics", "Biology", "Chemistry", "Geography", "History", "Computers"]);
}

function baseAcademic(classSection: string, examination: string, subjects: AcademicPage["subjects"], columns: string[], traits: string[], combined: boolean, chartLabels: string[]): AcademicPage {
  return {
    classSection,
    examination,
    identityMode: "Parent / Guardian",
    subjects,
    columns,
    traits,
    total: combined ? "394.1 / 600" : classSection.startsWith("V") ? "612 / 700" : "531.2 / 700",
    percentage: combined ? "65.7" : "75.9",
    grade: combined ? "B2" : "B1",
    gradePoint: combined || classSection.startsWith("V") ? null : "8.1",
    rank: combined ? null : "4",
    workingDays: "231",
    daysPresent: "218",
    attendancePercentage: "94.37%",
    remarks: "Consistent effort and thoughtful participation. Keep progressing.",
    combined,
    chartLabels
  };
}

function drawSyntheticFooter(page: PDFPage, fonts: Fonts, direction: ReportVisualDirection, edgeCase: boolean) {
  const label = `${direction} - ${edgeCase ? "EDGE-CASE QA" : "VISUAL DIRECTION"} - SYNTHETIC DATA ONLY`;
  centered(page, label, fonts.bold, 5.8, 11, rgb(0.42, 0.42, 0.42));
}

function lineField(page: PDFPage, fonts: Fonts, label: string, value: string, x: number, y: number, width: number, colors: Palette) {
  page.drawText(`${label}:`, { x, y, size: 9.3, font: fonts.regular, color: colors.kgInk });
  page.drawText(fit(value, fonts.bold, 9.3, width - 62), { x: x + 60, y, size: 9.3, font: fonts.bold, color: colors.kgInk });
  page.drawLine({ start: { x: x + 56, y: y - 3 }, end: { x: x + width, y: y - 3 }, thickness: 0.5, color: colors.kgInk, dashArray: [1, 2] });
}

function centered(page: PDFPage, text: string, font: PDFFont, size: number, y: number, color: ReturnType<typeof rgb>, xOffset = 0) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (A4.width - width) / 2 + xOffset, y, size, font, color });
}

function centeredInBox(page: PDFPage, text: string, font: PDFFont, size: number, box: { x: number; y: number; width: number; height: number }, color: ReturnType<typeof rgb>) {
  const lines = text.split("\n");
  lines.forEach((line, index) => page.drawText(line, { x: box.x + (box.width - font.widthOfTextAtSize(line, size)) / 2, y: box.y + box.height / 2 + (lines.length / 2 - index - 1) * (size + 2), size, font, color }));
}

function rectTop(page: PDFPage, x: number, top: number, width: number, height: number, color: ReturnType<typeof rgb>, borderColor: ReturnType<typeof rgb>, borderWidth: number) {
  page.drawRectangle({ x, y: A4.height - top - height, width, height, color, borderColor, borderWidth });
}

function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  const printable = String(text).replace(/[^\x20-\x7E]/g, "-");
  if (font.widthOfTextAtSize(printable, size) <= maxWidth) return printable;
  let result = printable;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}...`, size) > maxWidth) result = result.slice(0, -1);
  return `${result}...`;
}

function palette(direction: ReportVisualDirection) {
  const refined = direction === "LEGACY_REFINED";
  return {
    paper: refined ? rgb(0.995, 0.992, 0.975) : rgb(1, 1, 1),
    white: refined ? rgb(1, 0.998, 0.99) : rgb(1, 1, 1),
    ink: refined ? rgb(0.09, 0.12, 0.14) : rgb(0.06, 0.06, 0.06),
    border: refined ? rgb(0.35, 0.42, 0.43) : rgb(0.55, 0.55, 0.55),
    band: refined ? rgb(0.86, 0.9, 0.89) : rgb(0.82, 0.82, 0.82),
    grid: refined ? rgb(0.72, 0.76, 0.76) : rgb(0.74, 0.74, 0.74),
    student: rgb(0.18, 0.68, 0.73),
    average: rgb(0.17, 0.36, 0.58),
    high: rgb(0.68, 0.78, 0.89),
    legendTitle: refined ? rgb(0.04, 0.36, 0.42) : rgb(0.05, 0.31, 0.55),
    kgPinkLight: refined ? rgb(0.98, 0.76, 0.84) : rgb(0.98, 0.70, 0.81),
    kgPink: refined ? rgb(0.82, 0.05, 0.39) : rgb(0.9, 0.02, 0.42),
    kgPinkDark: refined ? rgb(0.66, 0.04, 0.29) : rgb(0.75, 0.02, 0.31),
    kgGreen: refined ? rgb(0.76, 0.87, 0.65) : rgb(0.71, 0.87, 0.57),
    kgGreenDark: refined ? rgb(0.49, 0.69, 0.32) : rgb(0.45, 0.72, 0.25),
    kgGreenText: refined ? rgb(0.16, 0.42, 0.32) : rgb(0.18, 0.5, 0.34),
    kgCream: refined ? rgb(0.95, 0.96, 0.88) : rgb(0.94, 0.96, 0.84),
    kgInk: refined ? rgb(0.13, 0.16, 0.14) : rgb(0.15, 0.15, 0.15)
  };
}

async function embedAssets(document: PDFDocument): Promise<DirectionAssets> {
  document.registerFontkit(fontkit);
  const regular = await embedFont(document, ["arial.ttf", "Arial.ttf"], StandardFonts.Helvetica);
  const bold = await embedFont(document, ["arialbd.ttf", "Arial Bold.ttf"], StandardFonts.HelveticaBold);
  const school = await embedFont(document, ["georgiab.ttf", "Georgia Bold.ttf"], StandardFonts.TimesRomanBold);
  const logoPath = path.resolve(process.cwd(), "public", "nalanda-logo-transparent.png");
  const logo = await readFile(logoPath).then((bytes) => document.embedPng(bytes)).catch(() => null);
  return { fonts: { regular, bold, school }, logo };
}

async function embedFont(document: PDFDocument, candidates: string[], fallback: StandardFonts) {
  for (const candidate of candidates) {
    for (const root of [path.join(process.env.WINDIR ?? "C:\\Windows", "Fonts"), path.resolve(process.cwd(), "public", "fonts")]) {
      try {
        return await document.embedFont(await readFile(path.join(root, candidate)), { subset: true });
      } catch {
        // Continue to approved safe fallback.
      }
    }
  }
  return document.embedFont(fallback);
}
