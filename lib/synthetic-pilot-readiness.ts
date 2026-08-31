import { createHash } from "node:crypto";

export const SYNTHETIC_PILOT_ID = "SYNTHETIC-PILOT-READINESS-1A";
export const SYNTHETIC_PILOT_PREFIX = "SYNPILOT1A";

export const SYNTHETIC_PILOT_DATASET_PLAN = Object.freeze({
  students: 800,
  guardians: 1_200,
  staff: 80,
  teachingStaff: 45,
  academicYears: ["2025-26", "2026-27"],
  classes: ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"],
  sections: ["A", "B", "C", "D"],
  operationalDataUsed: false
});

export type CashClosingInput = {
  openingBalancePaise: number;
  cashFeeCollectionsPaise: number;
  cashMiscIncomePaise: number;
  cashExpensesPaise: number;
  actualClosingPaise?: number;
};

function assertPaise(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label}_INVALID_PAISE`);
}

export function reconcileDailyCash(input: CashClosingInput) {
  assertPaise(input.openingBalancePaise, "OPENING_BALANCE");
  assertPaise(input.cashFeeCollectionsPaise, "FEE_COLLECTIONS");
  assertPaise(input.cashMiscIncomePaise, "MISC_INCOME");
  assertPaise(input.cashExpensesPaise, "EXPENSES");
  if (input.actualClosingPaise !== undefined) assertPaise(input.actualClosingPaise, "ACTUAL_CLOSING");
  const expectedClosingPaise =
    input.openingBalancePaise + input.cashFeeCollectionsPaise + input.cashMiscIncomePaise - input.cashExpensesPaise;
  if (expectedClosingPaise < 0) throw new Error("EXPECTED_CLOSING_NEGATIVE");
  return {
    ...input,
    expectedClosingPaise,
    differencePaise: input.actualClosingPaise === undefined ? null : input.actualClosingPaise - expectedClosingPaise,
    reconciled: input.actualClosingPaise === undefined ? null : input.actualClosingPaise === expectedClosingPaise
  };
}

export function syntheticPilotDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function assertSyntheticPilotManifest(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("SYNTHETIC_PILOT_MANIFEST_INVALID");
  const manifest = input as Record<string, unknown>;
  if (manifest.promptId !== SYNTHETIC_PILOT_ID || manifest.synthetic !== true || manifest.operationalDataUsed !== false) {
    throw new Error("SYNTHETIC_PILOT_MANIFEST_BOUNDARY_INVALID");
  }
  const counts = manifest.counts as Record<string, unknown> | undefined;
  if (!counts || counts.students !== 800 || counts.guardians !== 1_200 || counts.staff !== 80) {
    throw new Error("SYNTHETIC_PILOT_MANIFEST_SCALE_INVALID");
  }
  return manifest;
}

export const SYNTHETIC_PILOT_DIMENSIONS = [
  "ROLE_ACCESS_CORRECTNESS",
  "CRITICAL_WORKFLOW_PASS_RATE",
  "FINANCIAL_RECONCILIATION",
  "ACADEMIC_INTEGRITY",
  "PARENT_ISOLATION",
  "OFFLINE_RECOVERY",
  "BACKUP_RECOVERY",
  "BROWSER_USABILITY",
  "NATIVE_FOUNDATION",
  "HIGH_CRITICAL_DEFECTS",
  "OPERATOR_TRAINING",
  "INCIDENT_PREPAREDNESS",
  "EXTERNAL_GATES"
] as const;
