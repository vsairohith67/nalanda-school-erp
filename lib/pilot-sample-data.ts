import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PILOT_SAMPLE_DATE,
  PILOT_SAMPLE_PAYMENT_FILE,
  PILOT_SAMPLE_STUDENT_FILE
} from "@/lib/pilot-sample-constants";

export const SAMPLE_STUDENT_HEADERS = [
  "Academic Year",
  "Admission No",
  "Student Name",
  "Father Name",
  "Class",
  "Section",
  "Phone",
  "WhatsApp",
  "Student Type",
  "Discount %",
  "Remarks"
] as const;

export const SAMPLE_PAYMENT_HEADERS = [
  "Date",
  "Receipt No",
  "Admission No",
  "Student Name",
  "Class",
  "Amount",
  "Payment Mode",
  "Received Account",
  "UTR",
  "Fee Type",
  "Term",
  "Remarks"
] as const;

export function buildPilotSampleStudentsCsv() {
  return toCsv(SAMPLE_STUDENT_HEADERS, [
    ["2026-27", "PILOT-001", "Pilot Normal Student", "Pilot Parent One", "VI", "A", "9000000001", "9000000001", "Normal", "0", "Normal student; full annual payment sample"],
    ["2026-27", "PILOT-002", "Pilot Faculty Child", "Pilot Faculty Parent", "V", "A", "9000000002", "9000000002", "Faculty Child", "50", "Faculty child; part-payment sample"],
    ["2026-27", "PILOT-003", "Pilot Class Nine Student", "Pilot Parent Three", "IX", "A", "9000000003", "9000000003", "Normal", "0", "IX student; April/July/October/January dues"],
    ["2026-27", "PILOT-004", "Pilot Class Ten Student", "Pilot Parent Four", "X", "B", "9000000004", "9000000004", "Normal", "0", "X student; Cash plus UPI split receipt"],
    ["2026-27", "", "Intentionally Invalid Student", "Pilot Invalid Parent", "XI", "A", "9000000005", "", "Normal", "0", "INVALID: missing admission number and unsupported class"]
  ]);
}

export function buildPilotSamplePaymentsCsv() {
  const date = sampleDateForCsv(PILOT_SAMPLE_DATE);
  return toCsv(SAMPLE_PAYMENT_HEADERS, [
    [date, "PILOT-R001", "PILOT-001", "Pilot Normal Student", "VI", "40000", "Cash", "Cash", "", "Current Year Fee", "Multiple", "Cash-only full annual payment"],
    [date, "PILOT-R002", "PILOT-002", "Pilot Faculty Child", "V", "2300", "UPI", "Director Sir GPay", "PILOT-GPAY-001", "Current Year Fee", "Term 1", "UPI-only faculty-child part payment"],
    [date, "PILOT-R003", "PILOT-003", "Pilot Class Nine Student", "IX", "11300", "UPI", "NPS Current Account UPI", "PILOT-NPS-001", "Current Year Fee", "Term 1", "NPS Current Account UPI full-term payment"],
    [date, "PILOT-R004", "PILOT-004", "Pilot Class Ten Student", "X", "20000", "Cash", "Cash", "", "Current Year Fee", "Multiple", "Split receipt cash component of full annual payment"],
    [date, "PILOT-R004", "PILOT-004", "Pilot Class Ten Student", "X", "28000", "UPI", "Director Sir GPay", "PILOT-GPAY-002", "Current Year Fee", "Multiple", "Split receipt UPI component of full annual payment"],
    [date, "", "PILOT-404", "Intentionally Invalid Payment", "VI", "1000", "UPI", "Director Sir GPay", "", "Current Year Fee", "Term 1", "INVALID: missing receipt and unknown admission number"]
  ]);
}

export async function generatePilotSampleData(projectDirectory = process.cwd()) {
  const outputDirectory = path.join(projectDirectory, "pilot-data", "sample-imports");
  const studentFile = path.join(outputDirectory, PILOT_SAMPLE_STUDENT_FILE);
  const paymentFile = path.join(outputDirectory, PILOT_SAMPLE_PAYMENT_FILE);

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(studentFile, buildPilotSampleStudentsCsv(), "utf8"),
    writeFile(paymentFile, buildPilotSamplePaymentsCsv(), "utf8")
  ]);

  return { outputDirectory, studentFile, paymentFile };
}

function sampleDateForCsv(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

function toCsv(headers: readonly string[], rows: Array<Array<string | number>>) {
  return `\uFEFF${[
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(","))
  ].join("\r\n")}\r\n`;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}
