import { can, type Role } from "@/lib/permissions";
import { money } from "@/lib/format";
import {
  PILOT_SAMPLE_DATE,
  PILOT_SAMPLE_EXPECTED_TOTALS
} from "@/lib/pilot-sample-constants";

export const PILOT_ACCEPTANCE_STORAGE_KEY = "nalanda-pilot-acceptance-v1";
export const PILOT_ACCEPTANCE_NOTE_MAX_LENGTH = 2_000;

export const PILOT_ACCEPTANCE_SECTIONS = [
  {
    id: "ui",
    title: "A. UI checks",
    items: [
      "Sidebar scroll works",
      "Only one nav item highlighted",
      "Dashboard heading is clean",
      "Student filters are dropdowns",
      "Fee editor shows all 13 classes",
      "Payment form supports Cash + UPI split"
    ]
  },
  {
    id: "fee-structure",
    title: "B. Fee structure checks",
    items: [
      "Nursery/LKG/UKG to VIII months are June, September, December, February",
      "IX/X months are April, July, October, January",
      "Yearly amount = term amount x 4",
      "Save All Fee Structures works",
      "Faculty Child discount still works"
    ]
  },
  {
    id: "payments",
    title: "C. Payment checks",
    items: [
      "Cash-only payment saved correctly",
      "UPI-only payment saved correctly",
      "Cash + UPI same receipt saved correctly",
      "Same receipt same student treated as split",
      "Same receipt different student rejected/warned",
      "Receipt print correct",
      "Daily Collection total correct",
      "Ledger correct",
      "Receipt Audit correct"
    ]
  },
  {
    id: "imports",
    title: "D. Import checks",
    items: [
      "Student dry-run works",
      "Student import works",
      "Payment dry-run works",
      "Payment expected totals match source file",
      "Payment import works",
      "Import Verification batch shows useful result"
    ]
  },
  {
    id: "pending-dues",
    title: "E. Pending dues checks",
    items: [
      "Fully paid student shows no current pending due",
      "Part-paid student shows correct balance",
      "Faculty child due is 50%",
      "IX/X due months follow April/July/October/January"
    ]
  },
  {
    id: "timetable",
    title: "F. Timetable checks",
    items: [
      "Manual builder opens",
      "Generator opens",
      "Print/export opens",
      "One class print checked",
      "One teacher print checked"
    ]
  }
] as const;

export type PilotAcceptanceSectionId = (typeof PILOT_ACCEPTANCE_SECTIONS)[number]["id"];

export type PilotAcceptanceState = {
  completed: Record<string, boolean>;
  notes: Partial<Record<PilotAcceptanceSectionId, string>>;
};

export function canViewPilotAcceptance(role: Role) {
  return can(role, "RUN_PILOT_ACCEPTANCE");
}

export function pilotAcceptanceItemId(sectionId: PilotAcceptanceSectionId, itemIndex: number) {
  return `${sectionId}:${itemIndex}`;
}

export function emptyPilotAcceptanceState(): PilotAcceptanceState {
  return {
    completed: Object.fromEntries(
      PILOT_ACCEPTANCE_SECTIONS.flatMap((section) =>
        section.items.map((_, index) => [pilotAcceptanceItemId(section.id, index), false])
      )
    ),
    notes: {}
  };
}

export function parsePilotAcceptanceState(value: string | null): PilotAcceptanceState {
  const empty = emptyPilotAcceptanceState();
  if (!value) return empty;
  try {
    const parsed = JSON.parse(value) as Partial<PilotAcceptanceState>;
    const completed = parsed.completed && typeof parsed.completed === "object"
      ? parsed.completed
      : {};
    const notes = parsed.notes && typeof parsed.notes === "object" ? parsed.notes : {};
    return {
      completed: Object.fromEntries(
        Object.keys(empty.completed).map((key) => [key, completed[key] === true])
      ),
      notes: Object.fromEntries(
        PILOT_ACCEPTANCE_SECTIONS.map((section) => {
          const note = notes[section.id];
          return [
            section.id,
            typeof note === "string" ? note.slice(0, PILOT_ACCEPTANCE_NOTE_MAX_LENGTH) : ""
          ];
        })
      )
    };
  } catch {
    return empty;
  }
}

export type PilotReconciliationPayment = {
  amountPaid: number;
  paymentMode: string;
  receivedAccount: string;
  isCancelled?: boolean | null;
  deletedAt?: Date | string | null;
};

export type PilotReconciliationTotals = {
  cash: number;
  directorGPay: number;
  npsCurrentAccountUpi: number;
  bankOther: number;
  grandTotal: number;
};

export type PilotExpectedTotals = PilotReconciliationTotals;

export type PilotReconciliationRow = {
  key: keyof PilotReconciliationTotals;
  label: string;
  expected: number;
  actual: number;
  difference: number;
};

export type PilotEvidenceImportBatch = {
  id: string;
  type: string;
  fileName: string;
  importedByName: string;
  importedAt: string;
  mode: string;
  status: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  warningCount: number;
};

export type PilotEvidenceSummary = {
  generatedAtText: string;
  userText: string;
  databaseMode: "PILOT" | "NORMAL";
  dateRangeText: string;
  resultLabel: "Matched" | "Mismatch";
  checklistCompleted: number;
  checklistTotal: number;
  rows: PilotReconciliationRow[];
  sectionNotes: Array<{ title: string; note: string }>;
  recentSampleImportBatches: PilotEvidenceImportBatch[];
  safetyNote: string;
};

export function calculatePilotReconciliationTotals(
  payments: PilotReconciliationPayment[]
): PilotReconciliationTotals {
  const totals: PilotReconciliationTotals = {
    cash: 0,
    directorGPay: 0,
    npsCurrentAccountUpi: 0,
    bankOther: 0,
    grandTotal: 0
  };

  for (const payment of payments) {
    const amount = Number(payment.amountPaid);
    if (
      payment.deletedAt ||
      payment.isCancelled ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) continue;

    if (payment.receivedAccount === "Director Sir GPay") {
      totals.directorGPay += amount;
    } else if (payment.receivedAccount === "NPS Current Account UPI") {
      totals.npsCurrentAccountUpi += amount;
    } else if (payment.paymentMode === "Cash" || payment.receivedAccount === "Cash") {
      totals.cash += amount;
    } else {
      totals.bankOther += amount;
    }
    totals.grandTotal += amount;
  }

  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, roundMoney(value)])
  ) as PilotReconciliationTotals;
}

export function comparePilotReconciliationTotals(
  expected: PilotExpectedTotals,
  actual: PilotReconciliationTotals
): PilotReconciliationRow[] {
  const labels: Array<[keyof PilotReconciliationTotals, string]> = [
    ["cash", "Cash"],
    ["directorGPay", "Director Sir GPay"],
    ["npsCurrentAccountUpi", "NPS Current Account UPI"],
    ["bankOther", "Bank / Other"],
    ["grandTotal", "Grand Total"]
  ];
  return labels.map(([key, label]) => ({
    key,
    label,
    expected: roundMoney(Number(expected[key]) || 0),
    actual: roundMoney(Number(actual[key]) || 0),
    difference: roundMoney((Number(actual[key]) || 0) - (Number(expected[key]) || 0))
  }));
}

export function pilotReconciliationMatched(rows: PilotReconciliationRow[]) {
  return rows.every((row) => Math.abs(row.difference) < 0.01);
}

export function isSamplePilotDateRange(from: string, to: string) {
  return from === PILOT_SAMPLE_DATE && to === PILOT_SAMPLE_DATE;
}

export function isSamplePilotExpectedTotals(expected: PilotExpectedTotals) {
  return Object.keys(PILOT_SAMPLE_EXPECTED_TOTALS).every((key) => {
    const totalKey = key as keyof PilotExpectedTotals;
    return roundMoney(Number(expected[totalKey]) || 0) === PILOT_SAMPLE_EXPECTED_TOTALS[totalKey];
  });
}

export function samplePilotDateWarning(input: {
  sampleModeDetected: boolean;
  from: string;
  to: string;
}) {
  if (!input.sampleModeDetected || isSamplePilotDateRange(input.from, input.to)) return "";
  return "For sample evidence, use 20-06-2026 to 20-06-2026.";
}

export function samplePilotReconciliationSuccessMessage(input: {
  from: string;
  to: string;
  expected: PilotExpectedTotals;
  actual: PilotReconciliationTotals;
}) {
  const rows = comparePilotReconciliationTotals(input.expected, input.actual);
  if (
    !isSamplePilotDateRange(input.from, input.to) ||
    !isSamplePilotExpectedTotals(input.expected) ||
    !pilotReconciliationMatched(rows)
  ) {
    return "";
  }

  return [
    "Sample pilot reconciliation matched on 20-06-2026.",
    `Cash ${money(PILOT_SAMPLE_EXPECTED_TOTALS.cash)}`,
    `Director Sir GPay ${money(PILOT_SAMPLE_EXPECTED_TOTALS.directorGPay)}`,
    `NPS Current Account UPI ${money(PILOT_SAMPLE_EXPECTED_TOTALS.npsCurrentAccountUpi)}`,
    `Bank/Other ${money(PILOT_SAMPLE_EXPECTED_TOTALS.bankOther)}`,
    `Grand Total ${money(PILOT_SAMPLE_EXPECTED_TOTALS.grandTotal)}`
  ].join(" ");
}

export function buildPilotEvidenceSummary(input: {
  generatedAt: Date;
  currentUserName?: string | null;
  currentUserRole?: Role | string | null;
  databaseMode: "PILOT" | "NORMAL";
  from: string;
  to: string;
  expected: PilotExpectedTotals;
  actual: PilotReconciliationTotals;
  acceptanceState: PilotAcceptanceState;
  recentSampleImportBatches: PilotEvidenceImportBatch[];
}): PilotEvidenceSummary {
  const rows = comparePilotReconciliationTotals(input.expected, input.actual);
  const completed = Object.values(input.acceptanceState.completed).filter(Boolean).length;
  return {
    generatedAtText: formatEvidenceDateTime(input.generatedAt),
    userText: [input.currentUserName, input.currentUserRole].filter(Boolean).join(" / ") || "Not available",
    databaseMode: input.databaseMode,
    dateRangeText: `${formatIsoDateForEvidence(input.from)} to ${formatIsoDateForEvidence(input.to)}`,
    resultLabel: pilotReconciliationMatched(rows) ? "Matched" : "Mismatch",
    checklistCompleted: completed,
    checklistTotal: Object.keys(emptyPilotAcceptanceState().completed).length,
    rows,
    sectionNotes: PILOT_ACCEPTANCE_SECTIONS.map((section) => ({
      title: section.title,
      note: sanitizePilotEvidenceText(input.acceptanceState.notes[section.id] || "No note recorded.")
    })),
    recentSampleImportBatches: input.recentSampleImportBatches,
    safetyNote: "Checklist notes are browser-local. This evidence summary includes no password or hash values."
  };
}

export function sanitizePilotEvidenceText(value: string) {
  return value
    .replace(/\b(passwordHash|password|hash|secret|token)\b\s*[:=]\s*[^,\n\r;]+/gi, "[redacted sensitive note]")
    .trim();
}

export function formatIsoDateForEvidence(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || "Not selected";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatEvidenceDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}
