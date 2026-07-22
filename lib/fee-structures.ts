import {
  CLASS_NAMES,
  dueMonthsForClass,
  normalizeClassName
} from "@/lib/constants";
import { normalizeAcademicYear, numberValue } from "@/lib/format";

export const MAX_FEE_STRUCTURE_TERM_AMOUNT = 10_000_000;
const CALENDAR_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
const ACADEMIC_MONTH_ORDER = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"] as const;

export type FeeStructureEditorRow = {
  className: string;
  termAmount: number;
  term1Month: string;
  term2Month: string;
  term3Month: string;
  term4Month: string;
  exists: boolean;
};

export type FeeStructureInput = {
  className?: unknown;
  termAmount?: unknown;
  term1Month?: unknown;
  term2Month?: unknown;
  term3Month?: unknown;
  term4Month?: unknown;
};

export function buildFeeStructureEditorRows(
  existing: Array<FeeStructureInput & { academicYear?: string }>,
  academicYear: string
): FeeStructureEditorRow[] {
  const byClass = new Map(
    existing
      .filter((row) => String(row.academicYear ?? academicYear) === academicYear)
      .map((row) => [normalizeClassName(String(row.className ?? "")), row])
  );

  return CLASS_NAMES.map((className) => {
    const row = byClass.get(className);
    const months = dueMonthsForClass(className);
    return {
      className,
      termAmount: numberValue(row?.termAmount),
      term1Month: String(row?.term1Month ?? "").trim() || months[0],
      term2Month: String(row?.term2Month ?? "").trim() || months[1],
      term3Month: String(row?.term3Month ?? "").trim() || months[2],
      term4Month: String(row?.term4Month ?? "").trim() || months[3],
      exists: Boolean(row)
    };
  });
}

export function validateFeeStructureRows(
  rows: FeeStructureInput[],
  advancedOverride = false,
  requireAllClasses = true
) {
  if (!Array.isArray(rows) || (requireAllClasses && rows.length !== CLASS_NAMES.length) || (!requireAllClasses && rows.length !== 1)) {
    throw new Error(`Fee structures are required for all ${CLASS_NAMES.length} classes`);
  }

  const seen = new Set<string>();
  const normalized = rows.map((row) => {
    const className = normalizeClassName(String(row.className ?? ""));
    if (!(CLASS_NAMES as readonly string[]).includes(className)) {
      throw new Error(`Invalid class: ${className || "blank"}`);
    }
    if (seen.has(className)) throw new Error(`Duplicate class: ${className}`);
    seen.add(className);

    const termAmount = Number(row.termAmount);
    if (!Number.isFinite(termAmount) || termAmount <= 0 || termAmount > MAX_FEE_STRUCTURE_TERM_AMOUNT) {
      throw new Error(`Enter a positive term amount up to ${MAX_FEE_STRUCTURE_TERM_AMOUNT} for ${className}`);
    }
    if (Math.abs(termAmount * 100 - Math.round(termAmount * 100)) > 1e-8) {
      throw new Error(`Term amount for ${className} must use at most two decimal places`);
    }

    const defaults = dueMonthsForClass(className);
    const months = advancedOverride
      ? [
          String(row.term1Month ?? "").trim(),
          String(row.term2Month ?? "").trim(),
          String(row.term3Month ?? "").trim(),
          String(row.term4Month ?? "").trim()
        ]
      : defaults;
    if (months.some((month) => !month)) throw new Error(`All term months are required for ${className}`);
    const normalizedMonths = months.map((month) => {
      const normalized = CALENDAR_MONTHS.find((candidate) => candidate.toLowerCase() === month.toLowerCase());
      if (!normalized) throw new Error(`Invalid term month for ${className}: ${month}`);
      return normalized;
    });
    if (new Set(normalizedMonths).size !== normalizedMonths.length) throw new Error(`Term months must be distinct for ${className}`);
    const order = normalizedMonths.map((month) => ACADEMIC_MONTH_ORDER.indexOf(month));
    if (order.some((value, index) => index > 0 && value <= order[index - 1])) {
      throw new Error(`Term months must follow the April-to-March academic-year order for ${className}`);
    }

    return {
      className,
      termAmount,
      term1Month: normalizedMonths[0],
      term2Month: normalizedMonths[1],
      term3Month: normalizedMonths[2],
      term4Month: normalizedMonths[3]
    };
  });

  return normalized;
}

export function validateFeeStructurePayload(input: {
  academicYear: unknown;
  rows: FeeStructureInput[];
  advancedOverride?: boolean;
  requireAllClasses?: boolean;
}) {
  return {
    academicYear: normalizeAcademicYear(input.academicYear),
    rows: validateFeeStructureRows(input.rows, input.advancedOverride === true, input.requireAllClasses !== false)
  };
}

export function logFeeStructureSecurityEvent(input: {
  actorUserId: string;
  academicYear: string;
  classNames: string[];
  changeMode: "BULK" | "SINGLE";
  advancedOverride: boolean;
}) {
  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    category: "SECURITY_AUDIT",
    event: "FEE_STRUCTURE_CHANGED",
    actorUserId: input.actorUserId,
    academicYear: input.academicYear,
    classNames: input.classNames,
    changedClassCount: input.classNames.length,
    changeMode: input.changeMode,
    advancedOverride: input.advancedOverride
  }));
}
