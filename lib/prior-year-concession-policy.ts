import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { localDate, moneyDecimal } from "@/lib/expenses";
import configuration from "@/config/prior-year-concession-policy.json";

export const PRIOR_YEAR_CONTRACT = "NALANDA_PRIOR_YEAR_CONCESSIONS_1A";
export const PRIOR_YEAR_MAX_AMOUNT = new Prisma.Decimal(10).pow(10).sub("0.01").toFixed(2);
export const PRIOR_YEAR_STATES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED", "REJECTED", "APPROVED", "APPLIED", "EXPIRED", "REVERSED"] as const;
export type PriorYearState = typeof PRIOR_YEAR_STATES[number];
export type PriorYearPolicy = {
  contract: string; version: number;
  academicYears: Array<{ id: string; sequence: number; startsOn: string; endsOn: string }>;
  incomeBands: Array<{ id: string; label: string }>;
  incomeRetentionDays: number | null;
  scholarshipsEnabled: boolean;
};

export function priorYearText(value: unknown, label: string, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${label} is required (maximum ${max} characters)`);
  return value.trim();
}

export function validatePriorYearPolicy(raw: PriorYearPolicy = configuration): PriorYearPolicy {
  if (raw.contract !== PRIOR_YEAR_CONTRACT || !Number.isSafeInteger(raw.version) || raw.version < 1) throw new Error("PRIOR_YEAR_POLICY_UNVERIFIED");
  const identities = new Set<string>(), sequences = new Set<number>();
  for (const year of raw.academicYears) {
    priorYearText(year.id, "Academic year", 40);
    if (identities.has(year.id) || sequences.has(year.sequence) || !Number.isSafeInteger(year.sequence)) throw new Error("ACADEMIC_CHRONOLOGY_INVALID");
    identities.add(year.id); sequences.add(year.sequence);
    if (localDate(year.startsOn) > localDate(year.endsOn)) throw new Error("ACADEMIC_CHRONOLOGY_INVALID");
  }
  const ordered = [...raw.academicYears].sort((a, b) => a.sequence - b.sequence);
  for (let i = 1; i < ordered.length; i++) {
    if (localDate(ordered[i - 1].endsOn) >= localDate(ordered[i].startsOn)) throw new Error("ACADEMIC_CHRONOLOGY_INVALID");
  }
  if (new Set(raw.incomeBands.map((band) => band.id)).size !== raw.incomeBands.length) throw new Error("INCOME_BANDS_INVALID");
  if (raw.incomeRetentionDays !== null && (!Number.isSafeInteger(raw.incomeRetentionDays) || raw.incomeRetentionDays < 1 || raw.incomeRetentionDays > 3650)) throw new Error("INCOME_RETENTION_POLICY_REQUIRED");
  return raw;
}

export function eligiblePreviousYear(operatingYear: string, sourceYear: string, raw?: PriorYearPolicy) {
  const policy = validatePriorYearPolicy(raw);
  const operating = policy.academicYears.find((year) => year.id === operatingYear);
  const source = policy.academicYears.find((year) => year.id === sourceYear);
  if (!operating || !source) throw new Error("ACADEMIC_YEAR_CONFIGURATION_REQUIRED");
  if (source.sequence !== operating.sequence - 1 || localDate(source.endsOn) >= localDate(operating.startsOn)) throw new Error("ONLY_CONFIGURED_PREVIOUS_YEAR_IS_ELIGIBLE");
  return { operating, source, policyVersion: policy.version };
}

export function priorYearAmount(value: unknown, allowZero = false) {
  const amount = moneyDecimal(value, "Previous-year amount", allowZero);
  if (!amount.isFinite() || amount.gt(PRIOR_YEAR_MAX_AMOUNT)) throw new Error("PREVIOUS_YEAR_AMOUNT_OVERFLOW");
  return amount;
}

export function reconcilePriorYear(input: { opening: unknown; payments: unknown; existingCredits: unknown; appliedRelief: unknown; reversals: unknown }) {
  const opening = priorYearAmount(input.opening, true);
  const payments = priorYearAmount(input.payments, true);
  const existingCredits = priorYearAmount(input.existingCredits, true);
  const appliedRelief = priorYearAmount(input.appliedRelief, true);
  const reversals = priorYearAmount(input.reversals, true);
  if (reversals.gt(appliedRelief)) throw new Error("REVERSALS_EXCEED_APPLIED_RELIEF");
  const remaining = opening.sub(payments).sub(existingCredits).sub(appliedRelief).add(reversals);
  if (remaining.lt(0)) throw new Error("PREVIOUS_YEAR_RECONCILIATION_REQUIRED");
  return { opening, payments, existingCredits, appliedRelief, reversals, remaining };
}

export function assertPriorYearTransition(from: string, to: PriorYearState) {
  const allowed: Record<PriorYearState, readonly PriorYearState[]> = {
    DRAFT: ["SUBMITTED"], SUBMITTED: ["UNDER_REVIEW"], UNDER_REVIEW: ["RETURNED", "REJECTED", "APPROVED"],
    RETURNED: ["SUBMITTED"], REJECTED: [], APPROVED: ["APPLIED", "EXPIRED", "RETURNED"],
    APPLIED: ["REVERSED"], EXPIRED: [], REVERSED: []
  };
  if (!allowed[from as PriorYearState]?.includes(to)) throw new Error("CONCESSION_TRANSITION_NOT_ALLOWED");
}

export function approvalSeparation(preparer: string, reviewer: string | null, approver: string) {
  if (!reviewer || preparer === approver || reviewer === approver || preparer === reviewer) throw new Error("INDEPENDENT_REVIEW_AND_NO_SELF_APPROVAL_REQUIRED");
}

export function sourceProposalStatus(row: { studentId?: unknown; sourceYear?: unknown; identityVerified?: unknown; termAmounts?: unknown }) {
  if (typeof row.studentId !== "string" || !row.studentId.trim() || row.identityVerified !== true) return "IDENTITY_UNRESOLVED";
  if (typeof row.sourceYear !== "string" || !row.sourceYear.trim()) return "SOURCE_YEAR_UNVERIFIED";
  if (!Array.isArray(row.termAmounts) || row.termAmounts.length !== 4 || row.termAmounts.some((value) => value === null || value === undefined || value === "")) return "AMOUNT_UNKNOWN";
  for (const amount of row.termAmounts) priorYearAmount(amount, true);
  return "REVIEW_PROPOSAL_ONLY";
}

export function normalizeIncomeSupport(raw: unknown, policy: PriorYearPolicy = configuration) {
  const row = (raw ?? { status: "NOT_PROVIDED" }) as Record<string, unknown>;
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("INCOME_SUPPORT_INVALID");
  const status = String(row.status);
  if (!["UNKNOWN", "NOT_PROVIDED", "DECLINED", "PROVIDED"].includes(status)) throw new Error("INCOME_STATUS_REQUIRED");
  if (status !== "PROVIDED") {
    if (row.bandId != null || row.exactAnnualAmount != null) throw new Error("MISSING_INCOME_MUST_NOT_BECOME_ZERO");
    return { status, bandId: null, exactAnnualAmount: null };
  }
  validatePriorYearPolicy(policy);
  const bandId = row.bandId == null ? null : priorYearText(row.bandId, "Income band", 80);
  if (bandId && !policy.incomeBands.some((band) => band.id === bandId)) throw new Error("INCOME_BAND_UNCONFIGURED");
  const exactAnnualAmount = row.exactAnnualAmount == null ? null : priorYearAmount(row.exactAnnualAmount, true).toFixed(2);
  if (!bandId && exactAnnualAmount === null) throw new Error("INCOME_SUPPORT_VALUE_REQUIRED");
  if (row.period !== "ANNUAL" || row.currency !== "INR") throw new Error("INCOME_PERIOD_AND_CURRENCY_REQUIRED");
  if (!policy.incomeRetentionDays) throw new Error("INCOME_RETENTION_POLICY_REQUIRED");
  return { status, bandId, exactAnnualAmount };
}

export function concessionBalanceHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function sumPriorYearAmounts(values: Array<string | Prisma.Decimal>) {
  return values.reduce<Prisma.Decimal>((sum, value) => sum.add(value), new Prisma.Decimal(0));
}
