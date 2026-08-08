export const PAYROLL_COMPONENT_CLASSIFICATIONS = ["EARNING", "DEDUCTION", "REIMBURSEMENT"] as const;
export const PAYROLL_COMPONENT_MODES = ["FIXED", "PERCENTAGE", "MANUAL", "CALCULATED"] as const;
export const PAYROLL_ROUNDING_RULES = ["NEAREST_PAISE", "NEAREST_RUPEE", "FLOOR_RUPEE", "CEIL_RUPEE"] as const;
export const PAYROLL_PRORATION_RULES = ["FULL_PERIOD", "PRORATE_ELIGIBILITY", "PRORATE_ELIGIBILITY_AND_UNPAID_LEAVE"] as const;
export const PAYROLL_CALCULATION_RULES = ["STANDARD", "UNPAID_LEAVE_DEDUCTION", "ATTENDANCE_DEDUCTION", "ADVANCE_RECOVERY"] as const;

export type PayrollComponentClassification = (typeof PAYROLL_COMPONENT_CLASSIFICATIONS)[number];
export type PayrollComponentMode = (typeof PAYROLL_COMPONENT_MODES)[number];
export type PayrollRoundingRule = (typeof PAYROLL_ROUNDING_RULES)[number];
export type PayrollProrationRule = (typeof PAYROLL_PRORATION_RULES)[number];
export type PayrollCalculationRule = (typeof PAYROLL_CALCULATION_RULES)[number];

export type PayrollComponentInput = {
  id?: string;
  componentCode: string;
  name: string;
  classification: PayrollComponentClassification;
  calculationMode: PayrollComponentMode;
  calculationRule?: PayrollCalculationRule;
  defaultAmountPaise?: number | null;
  percentageBasisPoints?: number | null;
  percentageBaseCode?: string | null;
  prorationRule?: PayrollProrationRule;
  roundingRule?: PayrollRoundingRule;
  statutoryTreatment?: "NOT_STATUTORY" | "MANUAL_OR_EXTERNALLY_APPROVED";
  payslipVisible?: boolean;
  displayOrder?: number;
  versionNumber?: number;
};

export type ApprovedManualAdjustment = {
  componentCode: string;
  amountPaise: number;
  reason: string;
  approvalReference: string;
};

export type EmployeeCalculationInput = {
  periodStart: Date;
  periodEnd: Date;
  eligibleFrom: Date;
  eligibleTo?: Date | null;
  unpaidLeaveUnits?: number;
  attendanceHalfDayUnits?: number;
  halfDayRule: "NOT_CONFIGURED" | "HALF_DAY_AS_0_5";
  components: PayrollComponentInput[];
  manualAdjustments?: ApprovedManualAdjustment[];
  advanceRecoveryPaise?: number;
  structureReference: string;
  policyReference: string;
};

export type PayrollCalculatedComponent = {
  componentDefinitionId: string | null;
  componentCode: string;
  componentName: string;
  classification: PayrollComponentClassification;
  amountPaise: number;
  baseAmountPaise: number | null;
  percentageBasisPoints: number | null;
  roundingRule: PayrollRoundingRule;
  formulaText: string;
  sourceVersionReference: string;
  payslipVisible: boolean;
  displayOrder: number;
};

export type EmployeeCalculationResult = {
  periodDays: number;
  periodUnits: number;
  eligibleDays: number;
  eligibleUnits: number;
  unpaidLeaveUnits: number;
  halfDayUnits: number;
  components: PayrollCalculatedComponent[];
  grossPaise: number;
  deductionPaise: number;
  reimbursementPaise: number;
  netPaise: number;
  formulaPreview: {
    eligibility: string;
    unpaidLeave: string;
    halfDay: string;
    total: string;
    structureReference: string;
    policyReference: string;
  };
};

const STATUTORY_LOOKING = /(^|[^A-Z])(EPF|PF|ESI|UAN|TDS|PENSION|PROFESSIONAL[ _-]?TAX|PT)([^A-Z]|$)/i;

export class PayrollCalculationError extends Error {
  constructor(message: string, public readonly code = "PAYROLL_CALCULATION_INVALID") {
    super(message);
  }
}

export function calculateEmployeePayroll(input: EmployeeCalculationInput): EmployeeCalculationResult {
  const periodStart = payrollDate(input.periodStart, "Period start");
  const periodEnd = payrollDate(input.periodEnd, "Period end");
  if (periodEnd < periodStart) throw new PayrollCalculationError("Payroll period end cannot be before its start.");
  const periodDays = daysInclusive(periodStart, periodEnd);
  const effectiveStart = maxDate(periodStart, payrollDate(input.eligibleFrom, "Payroll eligibility start"));
  const effectiveEnd = minDate(periodEnd, input.eligibleTo ? payrollDate(input.eligibleTo, "Payroll eligibility end") : periodEnd);
  const eligibleDays = effectiveEnd < effectiveStart ? 0 : daysInclusive(effectiveStart, effectiveEnd);
  const periodUnits = periodDays * 2;
  const eligibleUnits = eligibleDays * 2;
  const unpaidLeaveUnits = boundedUnits(input.unpaidLeaveUnits ?? 0, eligibleUnits, "Approved unpaid-leave units");
  const attendanceHalfDayUnits = boundedUnits(input.attendanceHalfDayUnits ?? 0, eligibleUnits, "Attendance half-day units");
  if (attendanceHalfDayUnits && input.halfDayRule !== "HALF_DAY_AS_0_5") {
    throw new PayrollCalculationError("Half-day payroll treatment is not configured in the approved policy.", "HALF_DAY_RULE_MISSING");
  }
  const manual = new Map((input.manualAdjustments ?? []).map((row) => {
    const normalizedCode = componentCode(row.componentCode);
    const amountPaise = paise(row.amountPaise, "Manual adjustment amount", true);
    if (!boundedText(row.reason, 3, 500) || !boundedText(row.approvalReference, 2, 200)) {
      throw new PayrollCalculationError("Every manual adjustment requires a bounded reason and approval reference.", "MANUAL_ADJUSTMENT_UNAPPROVED");
    }
    return [normalizedCode, { ...row, componentCode: normalizedCode, amountPaise }] as const;
  }));
  const seen = new Set<string>();
  const amountByCode = new Map<string, number>();
  const calculated: PayrollCalculatedComponent[] = [];
  for (const raw of [...input.components].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))) {
    const component = validateComponent(raw);
    if (seen.has(component.componentCode)) throw new PayrollCalculationError(`Salary component ${component.componentCode} appears more than once.`);
    seen.add(component.componentCode);
    const roundingRule = component.roundingRule ?? "NEAREST_PAISE";
    let amount = 0;
    let baseAmount: number | null = null;
    let formula = "Zero by explicit configuration";
    if (component.calculationMode === "FIXED") {
      amount = component.defaultAmountPaise ?? 0;
      formula = `fixed ${amount} paise`;
    } else if (component.calculationMode === "PERCENTAGE") {
      const baseCode = component.percentageBaseCode!;
      const basisPoints = component.percentageBasisPoints!;
      if (!amountByCode.has(baseCode)) throw new PayrollCalculationError(`Percentage component ${component.componentCode} requires earlier component ${baseCode}.`, "PERCENTAGE_BASE_MISSING");
      baseAmount = amountByCode.get(baseCode)!;
      amount = baseAmount * basisPoints / 10_000;
      formula = `${baseAmount} paise x ${basisPoints} basis points / 10000`;
    } else if (component.calculationMode === "MANUAL") {
      const adjustment = manual.get(component.componentCode);
      amount = adjustment?.amountPaise ?? 0;
      formula = adjustment ? `approved manual amount ${amount} paise; approval ${adjustment.approvalReference}` : "no approved manual amount";
    } else {
      const baseCode = component.percentageBaseCode ?? null;
      baseAmount = baseCode ? amountByCode.get(baseCode) ?? null : null;
      if (component.calculationRule === "ADVANCE_RECOVERY") {
        amount = paise(input.advanceRecoveryPaise ?? 0, "Advance recovery", true);
        formula = `approved recovery schedule ${amount} paise`;
      } else if (component.calculationRule === "UNPAID_LEAVE_DEDUCTION") {
        if (baseAmount == null) throw new PayrollCalculationError(`${component.componentCode} requires an earlier explicit base component.`, "CALCULATION_BASE_MISSING");
        amount = baseAmount * unpaidLeaveUnits / periodUnits;
        formula = `${baseAmount} paise x ${unpaidLeaveUnits} half-day units / ${periodUnits}`;
      } else if (component.calculationRule === "ATTENDANCE_DEDUCTION") {
        if (baseAmount == null) throw new PayrollCalculationError(`${component.componentCode} requires an earlier explicit base component.`, "CALCULATION_BASE_MISSING");
        amount = baseAmount * attendanceHalfDayUnits / periodUnits;
        formula = `${baseAmount} paise x ${attendanceHalfDayUnits} approved half-day units / ${periodUnits}`;
      } else {
        throw new PayrollCalculationError(`Calculated component ${component.componentCode} has no approved executable rule.`, "CALCULATION_RULE_UNAPPROVED");
      }
    }
    if (component.prorationRule === "PRORATE_ELIGIBILITY") {
      baseAmount = Math.round(amount);
      amount = amount * eligibleUnits / periodUnits;
      formula = `${formula}; eligibility ${eligibleUnits}/${periodUnits}`;
    } else if (component.prorationRule === "PRORATE_ELIGIBILITY_AND_UNPAID_LEAVE") {
      const payableUnits = Math.max(0, eligibleUnits - unpaidLeaveUnits);
      baseAmount = Math.round(amount);
      amount = amount * payableUnits / periodUnits;
      formula = `${formula}; eligibility less approved unpaid leave ${payableUnits}/${periodUnits}`;
    }
    const amountPaise = roundPayrollAmount(amount, roundingRule);
    amountByCode.set(component.componentCode, amountPaise);
    calculated.push({
      componentDefinitionId: component.id ?? null,
      componentCode: component.componentCode,
      componentName: component.name,
      classification: component.classification,
      amountPaise,
      baseAmountPaise: baseAmount == null ? null : Math.round(baseAmount),
      percentageBasisPoints: component.percentageBasisPoints ?? null,
      roundingRule,
      formulaText: formula,
      sourceVersionReference: `${input.structureReference}; component-v${component.versionNumber ?? 1}; ${input.policyReference}`,
      payslipVisible: component.payslipVisible !== false,
      displayOrder: component.displayOrder ?? 0
    });
  }
  for (const code of manual.keys()) if (!seen.has(code)) throw new PayrollCalculationError(`Manual adjustment ${code} is not an approved component in the salary structure.`, "MANUAL_COMPONENT_NOT_CONFIGURED");
  const grossPaise = sumClassification(calculated, "EARNING");
  const deductionPaise = sumClassification(calculated, "DEDUCTION");
  const reimbursementPaise = sumClassification(calculated, "REIMBURSEMENT");
  const netPaise = grossPaise + reimbursementPaise - deductionPaise;
  if (netPaise < 0) throw new PayrollCalculationError("Payroll deductions cannot exceed earnings plus reimbursements.", "NEGATIVE_NET_PAY");
  return {
    periodDays,
    periodUnits,
    eligibleDays,
    eligibleUnits,
    unpaidLeaveUnits,
    halfDayUnits: attendanceHalfDayUnits,
    components: calculated,
    grossPaise,
    deductionPaise,
    reimbursementPaise,
    netPaise,
    formulaPreview: {
      eligibility: `${eligibleDays}/${periodDays} calendar days (${eligibleUnits}/${periodUnits} half-day units)`,
      unpaidLeave: `${unpaidLeaveUnits} approved half-day units`,
      halfDay: input.halfDayRule === "HALF_DAY_AS_0_5" ? `${attendanceHalfDayUnits} approved attendance half-day units` : "No executable half-day rule",
      total: `${grossPaise} + ${reimbursementPaise} - ${deductionPaise} = ${netPaise} paise`,
      structureReference: input.structureReference,
      policyReference: input.policyReference
    }
  };
}

export function validateComponent(raw: PayrollComponentInput) {
  const component = {
    ...raw,
    componentCode: componentCode(raw.componentCode),
    name: boundedText(raw.name, 2, 100),
    calculationRule: raw.calculationRule ?? "STANDARD",
    prorationRule: raw.prorationRule ?? "FULL_PERIOD",
    roundingRule: raw.roundingRule ?? "NEAREST_PAISE",
    statutoryTreatment: raw.statutoryTreatment ?? "NOT_STATUTORY"
  };
  if (!component.name) throw new PayrollCalculationError("Salary component name is required.");
  if (!(PAYROLL_COMPONENT_CLASSIFICATIONS as readonly string[]).includes(component.classification)) throw new PayrollCalculationError(`Salary component ${component.componentCode} has an invalid classification.`);
  if (!(PAYROLL_COMPONENT_MODES as readonly string[]).includes(component.calculationMode)) throw new PayrollCalculationError(`Salary component ${component.componentCode} has an invalid calculation mode.`);
  if (!(PAYROLL_CALCULATION_RULES as readonly string[]).includes(component.calculationRule)) throw new PayrollCalculationError(`Salary component ${component.componentCode} has an invalid calculation rule.`);
  if (!(PAYROLL_PRORATION_RULES as readonly string[]).includes(component.prorationRule)) throw new PayrollCalculationError(`Salary component ${component.componentCode} has an invalid proration rule.`);
  if (!(PAYROLL_ROUNDING_RULES as readonly string[]).includes(component.roundingRule)) throw new PayrollCalculationError(`Salary component ${component.componentCode} has an invalid rounding rule.`);
  if (STATUTORY_LOOKING.test(`${component.componentCode} ${component.name}`) && (component.statutoryTreatment !== "MANUAL_OR_EXTERNALLY_APPROVED" || component.calculationMode !== "MANUAL")) {
    throw new PayrollCalculationError(`Statutory-looking component ${component.componentCode} must remain MANUAL_OR_EXTERNALLY_APPROVED and manual.`, "STATUTORY_RULE_BLOCKED");
  }
  if (component.calculationMode === "FIXED") component.defaultAmountPaise = paise(component.defaultAmountPaise, `${component.componentCode} fixed amount`, true);
  if (component.calculationMode === "PERCENTAGE") {
    const points = Number(component.percentageBasisPoints);
    if (!Number.isInteger(points) || points < 0 || points > 100_000) throw new PayrollCalculationError(`${component.componentCode} percentage basis points are invalid.`);
    component.percentageBasisPoints = points;
    component.percentageBaseCode = componentCode(component.percentageBaseCode);
  }
  if (component.calculationMode === "CALCULATED" && component.calculationRule === "STANDARD") throw new PayrollCalculationError(`${component.componentCode} needs an approved calculated rule.`);
  return component;
}

export function roundPayrollAmount(value: number, rule: PayrollRoundingRule) {
  if (!Number.isFinite(value) || value < 0) throw new PayrollCalculationError("Payroll formula produced an invalid amount.");
  if (rule === "NEAREST_RUPEE") return Math.round(value / 100) * 100;
  if (rule === "FLOOR_RUPEE") return Math.floor(value / 100) * 100;
  if (rule === "CEIL_RUPEE") return Math.ceil(value / 100) * 100;
  return Math.round(value);
}

export function payrollDate(value: Date | string, label: string) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new PayrollCalculationError(`${label} is invalid.`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function payrollMoney(paiseValue: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(paiseValue / 100);
}

function daysInclusive(start: Date, end: Date) { return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1; }
function maxDate(a: Date, b: Date) { return a > b ? a : b; }
function minDate(a: Date, b: Date) { return a < b ? a : b; }
function boundedUnits(value: number, maximum: number, label: string) { if (!Number.isInteger(value) || value < 0 || value > maximum) throw new PayrollCalculationError(`${label} are invalid.`); return value; }
function sumClassification(rows: PayrollCalculatedComponent[], classification: PayrollComponentClassification) { return rows.filter((row) => row.classification === classification).reduce((sum, row) => sum + row.amountPaise, 0); }
function componentCode(value: unknown) { const code = String(value ?? "").trim().toUpperCase(); if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) throw new PayrollCalculationError("Salary component code must contain 2-40 uppercase letters, numbers or underscores."); return code; }
function boundedText(value: unknown, min: number, max: number) { const text = String(value ?? "").trim(); return text.length >= min && text.length <= max ? text : ""; }
function paise(value: unknown, label: string, allowZero = false) { const amount = Number(value); if (!Number.isSafeInteger(amount) || amount < (allowZero ? 0 : 1) || amount > 1_000_000_000) throw new PayrollCalculationError(`${label} must be a bounded whole paise amount.`); return amount; }
