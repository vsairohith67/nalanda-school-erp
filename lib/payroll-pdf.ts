import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { payrollMoney } from "@/lib/payroll-calculation";

type PayslipComponent = { code?: unknown; name?: unknown; amountPaise?: unknown };
type PayslipSnapshot = {
  schema?: unknown;
  school?: Record<string, unknown>;
  staff?: Record<string, unknown>;
  payrollMonth?: unknown;
  earnings?: PayslipComponent[];
  deductions?: PayslipComponent[];
  reimbursements?: PayslipComponent[];
  totals?: Record<string, unknown>;
  attendance?: Record<string, unknown>;
  issue?: Record<string, unknown>;
};

export async function generatePayslipPdf(snapshotValue: Record<string, unknown>, reference: string, monochrome = false) {
  const snapshot = snapshotValue as PayslipSnapshot;
  if (snapshot.schema !== "NALANDA_PAYSLIP_V1") throw new Error("Unsupported payslip snapshot.");
  const document = await PDFDocument.create();
  document.setTitle(`Payslip ${reference}`);
  document.setSubject("Private issued employee payslip");
  document.setKeywords(["private", "payroll", "payslip"]);
  document.setProducer("Nalanda School ERP");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const accent = monochrome ? rgb(0.15, 0.15, 0.15) : rgb(0.08, 0.3, 0.55);
  const ink = rgb(0.08, 0.08, 0.1);
  const muted = rgb(0.32, 0.32, 0.35);
  let page = document.addPage([595.28, 841.89]);
  let y = 795;
  const safe = (value: unknown, maximum = 160) => String(value ?? "").replace(/[\r\n\t]+/g, " ").replace(/[^\x20-\x7E]/g, "?").trim().slice(0, maximum);
  const school = snapshot.school ?? {};
  const staff = snapshot.staff ?? {};
  const totals = snapshot.totals ?? {};
  const issue = snapshot.issue ?? {};
  const write = (text: string, x: number, size = 9, font: PDFFont = regular, color = ink) => page.drawText(safe(text), { x, y, size, font, color, maxWidth: 515 });
  const newPage = () => { page = document.addPage([595.28, 841.89]); y = 795; page.drawText("Private employee payslip - continued", { x: 40, y, size: 9, font: bold, color: muted }); y -= 28; };
  const money = (amount: unknown) => payrollMoney(integer(amount)).replace("₹", "INR ");
  const row = (label: string, amount: number) => { if (y < 90) newPage(); write(label, 54, 9); const value = money(amount); page.drawText(value, { x: 520 - regular.widthOfTextAtSize(value, 9), y, size: 9, font: regular, color: ink }); y -= 19; };
  const section = (title: string, items: PayslipComponent[]) => { if (!items.length) return; if (y < 135) newPage(); y -= 5; write(title, 40, 11, bold, accent); y -= 21; for (const item of items.slice(0, 80)) row(safe(item.name || item.code, 100), integer(item.amountPaise)); };

  page.drawRectangle({ x: 32, y: 766, width: 531, height: 45, color: accent });
  page.drawText(safe(school.name || "School Payslip", 100), { x: 44, y: 788, size: 16, font: bold, color: rgb(1, 1, 1), maxWidth: 360 });
  page.drawText("PAYSLIP", { x: 470, y: 789, size: 11, font: bold, color: rgb(1, 1, 1) });
  y = 746;
  write(`${safe(school.address, 100)}${school.city ? `, ${safe(school.city, 60)}` : ""}`, 40, 8, regular, muted); y -= 24;
  write(`Employee: ${safe(staff.name, 100)}`, 40, 11, bold); y -= 20;
  write(`Designation: ${safe(staff.designation, 80) || "Not recorded"}`, 40); write(`Department: ${safe(staff.department, 80) || "Not recorded"}`, 300); y -= 19;
  write(`Payroll month: ${safe(snapshot.payrollMonth, 20)}`, 40); write(`Issue date: ${safe(issue.issueDate, 20)}`, 300); y -= 19;
  write(`Payslip reference: ${safe(reference, 120)}`, 40); write(`Version: ${safe(issue.version, 10)}`, 300); y -= 28;
  section("Earnings", Array.isArray(snapshot.earnings) ? snapshot.earnings : []);
  section("Reimbursements", Array.isArray(snapshot.reimbursements) ? snapshot.reimbursements : []);
  section("Deductions", Array.isArray(snapshot.deductions) ? snapshot.deductions : []);
  if (y < 165) newPage();
  y -= 4; page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: accent }); y -= 24;
  row("Gross earnings", integer(totals.grossPaise)); row("Total deductions", integer(totals.deductionPaise)); row("Reimbursements", integer(totals.reimbursementPaise));
  y -= 2; page.drawRectangle({ x: 40, y: y - 8, width: 515, height: 28, borderColor: accent, borderWidth: 1 }); y += 1; write("Net salary", 52, 11, bold, accent); const net = money(totals.netPaise); page.drawText(net, { x: 538 - bold.widthOfTextAtSize(net, 11), y, size: 11, font: bold, color: accent }); y -= 44;
  const attendance = snapshot.attendance ?? {};
  write("Approved payroll input summary", 40, 10, bold); y -= 18;
  write(`Locked attendance rows: ${safe(attendance.lockedInputRows, 12)}. Approved leave and advance recovery, when applicable, are reflected above.`, 40, 8, regular, muted); y -= 28;
  write("This is a salary calculation record, not proof of payment or bank disbursement.", 40, 8, bold, muted);
  for (const pdfPage of document.getPages()) {
    pdfPage.drawText("PRIVATE - authenticated employee document", { x: 40, y: 26, size: 7, font: regular, color: muted });
    pdfPage.drawText(monochrome ? "Printer-safe monochrome" : "Colour", { x: 452, y: 26, size: 7, font: regular, color: muted });
  }
  return new Uint8Array(await document.save({ useObjectStreams: false }));
}

function integer(value: unknown) { const result = Number(value); return Number.isSafeInteger(result) && result >= 0 ? result : 0; }
