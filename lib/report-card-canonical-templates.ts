export const CANONICAL_REPORT_TEMPLATE_FAMILIES = [
  "KG_DEVELOPMENTAL_BOOKLET",
  "LOWER_PRIMARY_I_II",
  "UPPER_PRIMARY_III_V",
  "MIDDLE_VI_VIII_GROUPED",
  "SECONDARY_IX_X"
] as const;

export const LEGACY_REPORT_TEMPLATE_FAMILIES = [
  "PRIMARY_10_40_SKILLS",
  "SECONDARY_10_40_GROUPED",
  "RETAINED_MULTI_EXAM_I_X"
] as const;

export type CanonicalReportTemplateFamily =
  (typeof CANONICAL_REPORT_TEMPLATE_FAMILIES)[number];
export type LegacyReportTemplateFamily =
  (typeof LEGACY_REPORT_TEMPLATE_FAMILIES)[number];

export const CANONICAL_LAYOUT_VARIANTS = {
  KG_DEVELOPMENTAL_BOOKLET: ["DEVELOPMENTAL_BOOKLET"],
  LOWER_PRIMARY_I_II: ["CT", "SESSION", "COMBINED"],
  UPPER_PRIMARY_III_V: ["CT", "SESSION", "COMBINED"],
  MIDDLE_VI_VIII_GROUPED: ["CT", "SESSION", "COMBINED"],
  SECONDARY_IX_X: ["CT", "SESSION", "REVISION", "PREBOARD", "COMBINED"]
} as const satisfies Record<CanonicalReportTemplateFamily, readonly string[]>;

export type CanonicalLayoutVariant =
  (typeof CANONICAL_LAYOUT_VARIANTS)[CanonicalReportTemplateFamily][number];

export const CANONICAL_FAMILY_LABELS: Record<CanonicalReportTemplateFamily, string> = {
  KG_DEVELOPMENTAL_BOOKLET: "KG ten-page developmental booklet",
  LOWER_PRIMARY_I_II: "Classes I-II marks and skills report",
  UPPER_PRIMARY_III_V: "Classes III-V marks and skills report",
  MIDDLE_VI_VIII_GROUPED: "Classes VI-VIII grouped-subject report",
  SECONDARY_IX_X: "Classes IX-X secondary report"
};

export type CanonicalTemplateDefinition = {
  schemaVersion: 2;
  type: "MARK_BASED" | "KG_RUBRIC";
  canonicalFamily: CanonicalReportTemplateFamily;
  layoutVariant: CanonicalLayoutVariant;
  denominatorPolicy: "FROZEN_RESULT_SNAPSHOT";
  sections: string[];
  identity: {
    studentLabel: string;
    admissionLabel: string;
    classSectionLabel: string;
    rollLabel: string;
    parentGuardianMode: "INCLUSIVE_GUARDIAN" | "FATHER_NAME_COMPATIBILITY";
    parentGuardianLabel: string;
  };
  schoolIdentity: {
    affiliationWording: string | null;
    recognitionWording: string | null;
    establishmentYear: string | null;
  };
  chart: {
    enabled: boolean;
    series: ["STUDENT_MARKS", "CLASS_AVERAGE", "HIGH_SCORE"];
    directNumericLabels: true;
  };
  combinedResult: {
    enabled: boolean;
    sourceApprovalReference: string | null;
  };
  signatureLabels: string[];
  printPages?: string[];
  evaluationPeriods?: string[];
  attendanceMonths?: string[];
  growthPeriods?: string[];
  criteria?: Array<Record<string, unknown>>;
  summaryAreas?: string[];
  responseSets?: Record<string, string[]>;
  personalityCodes?: string[];
  personalityTraits?: string[];
  approvalRoles?: string[];
  directorApprovalRequired?: boolean;
};

export function canonicalTemplateDefinition(
  family: CanonicalReportTemplateFamily,
  layoutVariantValue: unknown,
  options: {
    parentGuardianMode?: unknown;
    parentGuardianLabel?: unknown;
    signatureLabels?: unknown;
    affiliationWording?: unknown;
    recognitionWording?: unknown;
    establishmentYear?: unknown;
    chartEnabled?: unknown;
    combinedSourceApprovalReference?: unknown;
    kg?: Record<string, unknown>;
  } = {}
): CanonicalTemplateDefinition {
  const variants = CANONICAL_LAYOUT_VARIANTS[family] as readonly string[];
  const requested = String(layoutVariantValue ?? variants[0]).trim().toUpperCase();
  if (!variants.includes(requested)) {
    throw new Error(`${CANONICAL_FAMILY_LABELS[family]} does not support the selected layout variant.`);
  }
  const type = family === "KG_DEVELOPMENTAL_BOOKLET" ? "KG_RUBRIC" : "MARK_BASED";
  const parentGuardianMode = String(options.parentGuardianMode ?? "INCLUSIVE_GUARDIAN").toUpperCase();
  if (!["INCLUSIVE_GUARDIAN", "FATHER_NAME_COMPATIBILITY"].includes(parentGuardianMode)) {
    throw new Error("Choose inclusive Parent/Guardian or explicit father-name compatibility mode.");
  }
  const signatures = stringList(
    options.signatureLabels,
    family === "KG_DEVELOPMENTAL_BOOKLET"
      ? ["Class Teacher", "Principal", "Parent / Guardian", "Director"]
      : ["Class Teacher", "Principal / HM", "Parent / Guardian"]
  );
  const combined = requested === "COMBINED";
  const definition: CanonicalTemplateDefinition = {
    schemaVersion: 2,
    type,
    canonicalFamily: family,
    layoutVariant: requested as CanonicalLayoutVariant,
    denominatorPolicy: "FROZEN_RESULT_SNAPSHOT",
    sections: sectionsFor(family, requested),
    identity: {
      studentLabel: "Student Name",
      admissionLabel: "Admission Number",
      classSectionLabel: "Class / Section",
      rollLabel: "Roll Number",
      parentGuardianMode: parentGuardianMode as CanonicalTemplateDefinition["identity"]["parentGuardianMode"],
      parentGuardianLabel: cleanText(
        options.parentGuardianLabel,
        parentGuardianMode === "FATHER_NAME_COMPATIBILITY" ? "Father Name" : "Parent / Guardian"
      )
    },
    schoolIdentity: {
      affiliationWording: optionalText(options.affiliationWording),
      recognitionWording: optionalText(options.recognitionWording),
      establishmentYear: optionalYear(options.establishmentYear)
    },
    chart: {
      enabled: options.chartEnabled !== false,
      series: ["STUDENT_MARKS", "CLASS_AVERAGE", "HIGH_SCORE"],
      directNumericLabels: true
    },
    combinedResult: {
      enabled: combined,
      sourceApprovalReference: combined
        ? optionalText(options.combinedSourceApprovalReference)
        : null
    },
    signatureLabels: signatures
  };
  if (family === "KG_DEVELOPMENTAL_BOOKLET" && options.kg) {
    Object.assign(definition, structuredClone(options.kg));
  }
  return definition;
}

export function canonicalFamilyForClassName(value: unknown): CanonicalReportTemplateFamily | null {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/^CLASS\s+/, "");
  if (["LKG", "UKG", "KG", "NURSERY", "PRE-PRIMARY"].includes(normalized)) {
    return "KG_DEVELOPMENTAL_BOOKLET";
  }
  const roman: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10
  };
  const classNumber = roman[normalized] ?? (/^\d{1,2}$/.test(normalized) ? Number(normalized) : null);
  if (classNumber == null) return null;
  if (classNumber <= 2) return "LOWER_PRIMARY_I_II";
  if (classNumber <= 5) return "UPPER_PRIMARY_III_V";
  if (classNumber <= 8) return "MIDDLE_VI_VIII_GROUPED";
  if (classNumber <= 10) return "SECONDARY_IX_X";
  return null;
}

export function canonicalFamilyFromDefinition(value: unknown): CanonicalReportTemplateFamily | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const family = String((value as Record<string, unknown>).canonicalFamily ?? "");
  return (CANONICAL_REPORT_TEMPLATE_FAMILIES as readonly string[]).includes(family)
    ? family as CanonicalReportTemplateFamily
    : null;
}

export function isCombinedVariant(value: unknown) {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
    String((value as Record<string, unknown>).layoutVariant ?? "").toUpperCase() === "COMBINED"
  );
}

function sectionsFor(family: CanonicalReportTemplateFamily, variant: string) {
  if (family === "KG_DEVELOPMENTAL_BOOKLET") {
    return [
      "COVER", "PROFILE", "INSTRUCTIONS", "INTELLECTUAL_SUMMARY", "DEVELOPMENT_ENGLISH",
      "DEVELOPMENT_HINDI_NUMBER", "DEVELOPMENT_NUMBER_ENV_RHYMES_STORY",
      "PERSONALITY_ATTENDANCE_GROWTH", "COMMENTS_SIGNATURES_PROMOTION", "BACK_COVER"
    ];
  }
  const sections = ["SCHOOL_IDENTITY", "STUDENT_IDENTITY", "SUBJECT_RESULTS", "TOTALS"];
  if (variant === "COMBINED") sections.push("COMBINED_RESULTS");
  if (family === "LOWER_PRIMARY_I_II" || family === "UPPER_PRIMARY_III_V") sections.push("SKILLS");
  if (family === "MIDDLE_VI_VIII_GROUPED" || family === "SECONDARY_IX_X") {
    sections.push("GROUPED_SUBJECTS", "PERSONALITY_DEVELOPMENT");
  }
  sections.push("ATTENDANCE", "REMARKS", "PERFORMANCE_CHART", "GRADE_LEGEND", "SIGNATURES");
  return sections;
}

function stringList(value: unknown, fallback: string[]) {
  if (value === undefined || value === null || value === "") return fallback;
  if (!Array.isArray(value) || !value.length || value.length > 6) {
    throw new Error("Configure one to six signature labels.");
  }
  const result = value.map((item) => cleanText(item, ""));
  if (result.some((item) => !item) || new Set(result).size !== result.length) {
    throw new Error("Signature labels must be non-empty and unique.");
  }
  return result;
}

function cleanText(value: unknown, fallback: string) {
  const text = String(value ?? fallback).trim().replace(/\s+/g, " ");
  if (!text || text.length > 160 || /[<>\u0000-\u001F]/.test(text)) {
    throw new Error("Canonical template text is invalid.");
  }
  return text;
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return null;
  return cleanText(text, "");
}

function optionalYear(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d{4}$/.test(text)) throw new Error("Establishment year must use four digits.");
  return text;
}
