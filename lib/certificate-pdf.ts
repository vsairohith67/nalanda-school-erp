import { runWithReportPdfCapacity } from "@/lib/report-pdf-jobs";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, degrees } from "pdf-lib";
import QRCode from "qrcode";
import { GRADUATION_DISCLAIMER } from "@/lib/certificate-templates";

export const CERTIFICATE_PDF_MAX_BYTES = 2 * 1024 * 1024;
export const sha256Bytes = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
export const newCertificateToken = () => randomBytes(32).toString("base64url");

function georgiaBold() {
  const filename = process.env.CERTIFICATE_GEORGIA_BOLD_PATH ?? (process.platform === "win32" ? path.join(process.env.WINDIR ?? "C:/Windows", "Fonts/georgiab.ttf") : "");
  if (!filename || !path.isAbsolute(filename)) throw new Error("GEORGIA_BOLD_UNAVAILABLE: configure a locally licensed Georgia Bold font.");
  let bytes: Buffer;
  try { bytes = readFileSync(filename); } catch { throw new Error("GEORGIA_BOLD_UNAVAILABLE"); }
  if (bytes.length > 2 * 1024 * 1024) throw new Error("GEORGIA_FONT_SIZE_REFUSED");
  const font = (fontkit as any).create(bytes);
  if (font.familyName !== "Georgia" || !/bold/i.test(font.subfamilyName)) throw new Error("GEORGIA_BOLD_IDENTITY_MISMATCH");
  const embedding = font["OS/2"]?.fsType;
  if (!embedding || typeof embedding !== "object" || embedding.noEmbedding || embedding.bitmapOnly || (!embedding.editable && !embedding.viewOnly && Object.values(embedding).some(Boolean))) throw new Error("GEORGIA_EMBEDDING_LICENSE_REFUSED");
  return { bytes, font, hash: sha256Bytes(bytes) };
}

export async function renderCertificatePdf(snapshot: any, mode: "DRAFT" | "ISSUED", token?: string) {
  return runWithReportPdfCapacity(async () => {
  if (mode === "ISSUED" && (!snapshot.certificateNumber || snapshot.issueStatus !== "ISSUED" || !/^[A-Za-z0-9_-]{43}$/.test(token ?? ""))) throw new Error("ISSUED_PDF_PROOF_REQUIRED");
  const { bytes, font: sourceFont, hash } = georgiaBold();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(bytes, { subset: false });
  doc.setCreationDate(new Date("2000-01-01T00:00:00Z"));
  doc.setModificationDate(new Date("2000-01-01T00:00:00Z"));
  doc.setTitle(mode === "DRAFT" ? "DRAFT - NOT OFFICIAL" : "School-issued certificate");
  doc.setProducer("Nalanda governed certificate PDF v1");
  const definition = snapshot.template?.definition;
  if (!definition || !snapshot.school?.name || !snapshot.student?.name) throw new Error("CERTIFICATE_PDF_REQUIRED_VALUES_MISSING");
  if (!String(snapshot.school.issuePlace ?? "").trim()) throw new Error("CERTIFICATE_ISSUE_PLACE_REQUIRED");
  const schoolName = String(snapshot.school.name).toUpperCase();
  const pages: ReturnType<typeof doc.addPage>[] = [];
  let page!: ReturnType<typeof doc.addPage>, y = 0;
  function text(value: unknown) {
    const result = String(value ?? "");
    if (result.length > 8000 || /[\u0000-\u0008\u000b-\u001f]/.test(result)) throw new Error("CERTIFICATE_PDF_TEXT_REFUSED");
    for (const char of result.replace(/[\n\r\t]/g, "")) if (!sourceFont.hasGlyphForCodePoint(char.codePointAt(0))) throw new Error("CERTIFICATE_FONT_GLYPH_UNAVAILABLE");
    return result;
  }
  function newPage() {
    if (pages.length >= 4) throw new Error("CERTIFICATE_PDF_PAGE_LIMIT");
    page = doc.addPage([595.28, 841.89]); pages.push(page); y = 780;
    page.drawRectangle({ x: 30, y: 30, width: 535.28, height: 781.89, borderWidth: 1, borderColor: rgb(0, 0, 0) });
    const title = text(schoolName);
    const size = Math.min(19, 495 / Math.max(1, font.widthOfTextAtSize(title, 1)));
    if (size < 10) throw new Error("CERTIFICATE_SCHOOL_NAME_OVERFLOW");
    page.drawText(title, { x: 50, y, size, font }); y -= 38;
  }
  function paragraph(value: unknown, size = 11) {
    const source = text(value);
    for (const raw of source.split(/\r?\n/)) {
      let line = "";
      // Wrap at spaces; split only tokens that cannot fit the printable width.
      for (const word of raw.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= 490) { line = candidate; continue; }
        if (line) { draw(line); line = ""; }
        for (const char of word) { if (font.widthOfTextAtSize(line + char, size) > 490) { draw(line); line = ""; } line += char; }
      }
      draw(line); y -= 7;
    }
    function draw(line: string) {
      if (y < 135) newPage();
      page.drawText(line, { x: 50, y, size, font }); y -= size + 5;
    }
  }
  newPage();
  paragraph(definition.heading, 17);
  paragraph(mode === "DRAFT" ? "DRAFT – NOT OFFICIAL" : `Certificate: ${snapshot.certificateNumber}`);
  paragraph(`Academic year: ${snapshot.academicYear}    Issue date: ${mode === "ISSUED" ? new Date(snapshot.issueDate).toISOString().slice(0, 10) : `${snapshot.documentIssueDate ?? "Not set"} (reviewed draft)`}`);
  paragraph(`Issue place: ${snapshot.school.issuePlace}`);
  const body = String(definition.body).replaceAll("{{studentName}}", snapshot.student.name).replaceAll("{{academicYear}}", snapshot.academicYear).replaceAll("{{conductText}}", definition.customConductText ?? definition.conductStatement ?? "reviewed");
  if (/\{\{/.test(body)) throw new Error("CERTIFICATE_TEMPLATE_PLACEHOLDER_UNRESOLVED");
  paragraph(body);
  paragraph(`Student: ${snapshot.student.name}`);
  paragraph(`Class: ${snapshot.currentEnrollment?.className ?? "Not recorded"}`);
  if (snapshot.certificateType === "GRADUATION") {
    if (!definition.disclaimer?.includes(GRADUATION_DISCLAIMER)) throw new Error("GRADUATION_DISCLAIMER_MISSING");
    paragraph(definition.disclaimer);
    paragraph("School completion is distinct from passing a Board examination. No Board-pass claim is made.");
  }
  if (snapshot.certificateType !== "GRADUATION") {
    const date = (value: any) => value ? new Date(value).toISOString().slice(0, 10) : "Not recorded";
    const e = snapshot.currentEnrollment ?? {};
    const values: Record<string, unknown> = { studentName: snapshot.student.name, admissionNumber: snapshot.student.admissionNumber, dateOfBirth: date(snapshot.student.dateOfBirth), fatherName: snapshot.student.fatherName, motherName: snapshot.student.motherName, className: e.className, section: e.section, academicYear: snapshot.academicYear, admissionDate: date(e.enrollmentDate), leavingDate: date(e.exitDate), lastAttendanceDate: date(snapshot.attendance?.coveredPeriod?.to), attendanceSummary: snapshot.attendance ? `${snapshot.attendance.recordedDays} recorded days; ${JSON.stringify(snapshot.attendance.counts)}` : "Not recorded", reasonForLeaving: e.exitReason, promotionDisplay: snapshot.progression?.qualifiedForPromotion ? `Reviewed promotion to ${snapshot.progression.nextClass}` : snapshot.progression?.display ?? "Not recorded", purpose: snapshot.purpose, recognitionText: definition.recognitionText, mediumOfInstruction: definition.mediumOfInstruction };
    for (const key of definition.enabledFields ?? []) paragraph(`${key.replace(/([A-Z])/g, " $1")}: ${values[key] ?? "Not recorded"}`);
    if (snapshot.certificateType === "STUDY") for (const enrollment of snapshot.enrollmentHistory ?? []) paragraph(`Reviewed period: ${enrollment.academicYear} — ${enrollment.className} ${enrollment.section ?? ""}`);
    for (const warning of snapshot.warnings ?? []) paragraph(warning, 9);
  }
  paragraph(`Template version: ${snapshot.template.versionNumber}`);
  for (const signatory of definition.signatories ?? []) paragraph(`Authorized role: ${signatory.role} — physical signature space`);
  paragraph("Typed roles are not signatures. This document is not digitally signed.", 9);
  if (token) {
    if (y < 245) newPage();
    const qr = await doc.embedPng(await QRCode.toBuffer(`urn:nalanda:certificate:${token}`, { errorCorrectionLevel: "M", margin: 4, width: 320, color: { dark: "#000000", light: "#ffffff" } }));
    page.drawImage(qr, { x: 50, y: y - 100, width: 100, height: 100 }); y -= 120;
    paragraph("Private authenticity reference. External verification is disabled.", 9);
  }
  pages.forEach((p, i) => {
    if (mode === "DRAFT") p.drawText("DRAFT – NOT OFFICIAL", { x: 60, y: 325, size: 30, font, rotate: degrees(24), color: rgb(.65, .65, .65), opacity: .55 });
    p.drawText(`${mode === "DRAFT" ? "DRAFT – NOT OFFICIAL | " : ""}Page ${i + 1} of ${pages.length}`, { x: 50, y: 50, size: 9, font });
  });
  const pdf = Buffer.from(await doc.save({ useObjectStreams: false }));
  if (pdf.length > CERTIFICATE_PDF_MAX_BYTES) throw new Error("CERTIFICATE_PDF_SIZE_LIMIT");
  return { pdf, pdfHash: sha256Bytes(pdf), fontHash: hash, rendererVersion: "certificate-pdf-v1", pages: pages.length };
  });
}
