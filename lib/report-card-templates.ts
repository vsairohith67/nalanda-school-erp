import { Prisma } from "@prisma/client";
import { KG_ATTENDANCE_MONTHS, KG_CRITERIA, KG_EVALUATIONS, KG_GROWTH_PERIODS, KG_PERSONALITY_CODES, KG_PERSONALITY_TRAITS, KG_RESPONSE_SETS, KG_SUMMARY_AREAS } from "@/lib/kg-report-card";
import { safeReportCardText } from "@/lib/report-card-templates-shared";

export { safeReportCardText } from "@/lib/report-card-templates-shared";
export const REPORT_CARD_TYPES = ["MARK_BASED", "KG_RUBRIC"] as const;
export const REPORT_CARD_TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"] as const;

export const DEFAULT_MARK_TEMPLATE = {
  schemaVersion: 1, type: "MARK_BASED", denominatorPolicy: "PRESENT_AND_ABSENT",
  includeAttendance: true, includeGuardianNames: true, approvalRoles: ["CLASS_TEACHER", "PRINCIPAL"],
  sections: ["STUDENT_PROFILE", "SUBJECT_RESULTS", "TOTALS", "ATTENDANCE", "COMMENTS", "APPROVALS"]
} as const;

export const DEFAULT_KG_TEMPLATE = {
  schemaVersion: 1, type: "KG_RUBRIC", evaluationPeriods: KG_EVALUATIONS,
  summaryAreas: KG_SUMMARY_AREAS,
  responseSets: Object.fromEntries(Object.entries(KG_RESPONSE_SETS).map(([key, values]) => [key, [...values]])),
  criteria: KG_CRITERIA.map(([key, section, label, responseSet]) => ({ key, section, label, responseSet })),
  personalityCodes: KG_PERSONALITY_CODES, personalityTraits: KG_PERSONALITY_TRAITS,
  attendanceMonths: KG_ATTENDANCE_MONTHS, growthPeriods: KG_GROWTH_PERIODS,
  approvalRoles: ["CLASS_TEACHER", "PRINCIPAL"], directorApprovalRequired: false,
  printPages: ["COVER", "PROFILE", "INSTRUCTIONS", "SUMMARY", "RUBRICS_1", "RUBRICS_2", "RUBRICS_3", "PERSONALITY_ATTENDANCE_GROWTH", "COMMENTS_PROMOTION", "BACK_COVER"]
} as const;

export function normalizeReportCardCode(value: unknown, label = "Code") {
  const code = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9-]{2,49}$/.test(code)) throw new Error(`${label} must use 3-50 letters, numbers, or hyphens.`);
  return code;
}

export function validateGradeBands(input: unknown) {
  if (!Array.isArray(input) || !input.length) throw new Error("Add at least one grade band.");
  if (input.length > 30) throw new Error("A grading scheme may contain at most 30 bands.");
  const codes = new Set<string>(); const orders = new Set<number>();
  const bands = input.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Grade band ${index + 1} must be an object.`);
    const row = value as Record<string, unknown>;
    const gradeCode = safeReportCardText(row.gradeCode, `Grade band ${index + 1} code`, 12)!.toUpperCase();
    const label = safeReportCardText(row.label, `Grade band ${index + 1} label`, 80)!;
    const minimumPercentage = percentage(row.minimumPercentage, `Grade band ${gradeCode} minimum`);
    const maximumPercentage = row.maximumPercentage === null || row.maximumPercentage === undefined || row.maximumPercentage === "" ? null : percentage(row.maximumPercentage, `Grade band ${gradeCode} maximum`);
    if (maximumPercentage && maximumPercentage.lt(minimumPercentage)) throw new Error(`Grade band ${gradeCode} maximum cannot be below its minimum.`);
    const displayOrder = Number(row.displayOrder ?? index + 1);
    if (!Number.isInteger(displayOrder) || displayOrder < 1 || displayOrder > 100) throw new Error("Grade-band display order must be from 1 to 100.");
    if (codes.has(gradeCode) || orders.has(displayOrder)) throw new Error("Grade-band codes and display orders must be unique.");
    codes.add(gradeCode); orders.add(displayOrder);
    return { gradeCode, label, minimumPercentage, maximumPercentage, displayOrder, remarks: safeReportCardText(row.remarks, "Grade-band remarks", 500, false) };
  });
  for (let i = 0; i < bands.length; i++) for (let j = i + 1; j < bands.length; j++) {
    const a = bands[i]; const b = bands[j];
    const aMax = a.maximumPercentage ?? new Prisma.Decimal(100); const bMax = b.maximumPercentage ?? new Prisma.Decimal(100);
    if (a.minimumPercentage.lte(bMax) && b.minimumPercentage.lte(aMax)) throw new Error(`Grade bands ${a.gradeCode} and ${b.gradeCode} overlap.`);
  }
  return bands;
}

export function validateTemplateDefinition(reportTypeValue: unknown, input: unknown) {
  const reportType = String(reportTypeValue ?? "").toUpperCase();
  if (!(REPORT_CARD_TYPES as readonly string[]).includes(reportType)) throw new Error("Choose a valid report-card type.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Template definition must be an object.");
  rejectExecutableJson(input);
  const definition = input as Record<string, any>;
  if (Number(definition.schemaVersion) !== 1 || definition.type !== reportType) throw new Error("Template schema version or type is invalid.");
  if (reportType === "MARK_BASED") {
    if (definition.denominatorPolicy !== "PRESENT_AND_ABSENT") throw new Error("Mark templates must use the documented Present-and-Absent denominator policy.");
    const allowedSections = new Set(DEFAULT_MARK_TEMPLATE.sections);
    if (!Array.isArray(definition.sections) || !definition.sections.length || definition.sections.some((value: unknown) => !allowedSections.has(String(value) as any))) throw new Error("Mark template sections are invalid.");
  } else {
    validateKgTemplate(definition);
  }
  return structuredClone(definition);
}

export function parseStoredTemplateDefinition(json: string) { try { const value = JSON.parse(json); return validateTemplateDefinition((value as any).type, value); } catch (error) { if (error instanceof SyntaxError) throw new Error("Stored template JSON is invalid."); throw error; } }

export function validatePrintSettings(input: unknown) {
  if (input === null || input === undefined || input === "") return null;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Print settings must be an object.");
  rejectExecutableJson(input);
  const row = input as Record<string, unknown>;
  const mode = String(row.mode ?? "COLOUR").toUpperCase();
  if (!["COLOUR", "BLACK_AND_WHITE"].includes(mode)) throw new Error("Print mode must be Colour or Black and White.");
  return { mode, booklet: Boolean(row.booklet) };
}

function validateKgTemplate(definition: Record<string, any>) {
  const exact = (actual: unknown, expected: readonly string[], label: string) => {
    if (!Array.isArray(actual) || actual.length !== expected.length || new Set(actual.map(String)).size !== expected.length || expected.some((value) => !actual.includes(value))) throw new Error(`${label} must contain the supported values exactly once.`);
  };
  exact(definition.evaluationPeriods, KG_EVALUATIONS, "KG evaluation periods");
  exact(definition.attendanceMonths, KG_ATTENDANCE_MONTHS, "KG attendance months");
  exact(definition.growthPeriods, KG_GROWTH_PERIODS, "KG growth periods");
  exact(definition.personalityCodes, KG_PERSONALITY_CODES, "KG personality codes");
  exact(definition.personalityTraits, KG_PERSONALITY_TRAITS, "KG personality traits");
  exact(definition.summaryAreas, KG_SUMMARY_AREAS, "KG summary areas");
  if (!definition.responseSets || typeof definition.responseSets !== "object") throw new Error("KG response sets are required.");
  for (const [key, values] of Object.entries(KG_RESPONSE_SETS)) exact(definition.responseSets[key], values, `KG response set ${key}`);
  if (!Array.isArray(definition.criteria) || definition.criteria.length !== KG_CRITERIA.length) throw new Error("KG criteria are incomplete.");
  const keys = new Set<string>();
  for (const criterion of definition.criteria) {
    if (!criterion || typeof criterion !== "object") throw new Error("Each KG criterion must be an object.");
    const key = String(criterion.key ?? "");
    if (keys.has(key) || !KG_CRITERIA.some((item) => item[0] === key && item[3] === criterion.responseSet)) throw new Error("KG criterion keys must be unique and reference a supported response set.");
    safeReportCardText(criterion.section, "KG criterion section", 80); safeReportCardText(criterion.label, "KG criterion label", 120); keys.add(key);
  }
  if (!Array.isArray(definition.printPages) || definition.printPages.length !== 10) throw new Error("KG print templates must define the supported 10-page booklet structure.");
}

function rejectExecutableJson(value: unknown, path = "template") {
  if (typeof value === "string") { safeReportCardText(value, path, 5000, false); return; }
  if (Array.isArray(value)) { if (value.length > 500) throw new Error(`${path} contains too many items.`); value.forEach((item, index) => rejectExecutableJson(item, `${path}[${index}]`)); return; }
  if (value && typeof value === "object") { for (const [key, item] of Object.entries(value)) { if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error(`${path} contains an unsafe key.`); rejectExecutableJson(item, `${path}.${key}`); } }
}
function percentage(value: unknown, label: string) { const raw = String(value ?? "").trim(); if (!/^\d{1,3}(\.\d{1,4})?$/.test(raw)) throw new Error(`${label} must be from 0 to 100.`); const result = new Prisma.Decimal(raw); if (result.lt(0) || result.gt(100)) throw new Error(`${label} must be from 0 to 100.`); return result; }
