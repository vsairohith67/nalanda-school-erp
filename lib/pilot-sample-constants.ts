import type { PilotExpectedTotals } from "@/lib/pilot-acceptance";

export const PILOT_SAMPLE_STUDENT_FILE = "sample-students.csv";
export const PILOT_SAMPLE_PAYMENT_FILE = "sample-payments.csv";
export const PILOT_SAMPLE_DATE = "2026-06-20";

export const PILOT_SAMPLE_EXPECTED_TOTALS: PilotExpectedTotals = {
  cash: 60000,
  directorGPay: 30300,
  npsCurrentAccountUpi: 11300,
  bankOther: 0,
  grandTotal: 101600
};

export const PILOT_SAMPLE_IMPORT_FILES = [
  PILOT_SAMPLE_STUDENT_FILE,
  PILOT_SAMPLE_PAYMENT_FILE
] as const;
