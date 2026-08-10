const CALCULATION_MODES: Record<string, string> = {
  RAW_SUM: "Raw sum",
  WEIGHTED_NORMALIZED: "Weighted and normalised"
};

const COMPONENT_KINDS: Record<string, string> = {
  INTERNAL: "Internal assessment",
  WRITTEN: "Written examination",
  PRACTICAL: "Practical",
  ORAL: "Oral",
  PROJECT: "Project",
  OTHER_APPROVED: "Other approved component"
};

const TEMPLATE_FAMILIES: Record<string, string> = {
  KG_DEVELOPMENTAL_BOOKLET: "KG ten-page developmental booklet",
  LOWER_PRIMARY_I_II: "Classes I-II marks and skills",
  UPPER_PRIMARY_III_V: "Classes III-V marks and skills",
  MIDDLE_VI_VIII_GROUPED: "Classes VI-VIII grouped subjects",
  SECONDARY_IX_X: "Classes IX-X secondary"
};

const SCALE_FAMILIES: Record<string, string> = {
  KG: "Kindergarten",
  PRIMARY_I_V: "Primary (Classes I-V)",
  SECONDARY_VI_X: "Secondary (Classes VI-X)",
  PERCENTAGE: "Percentage grade scale"
};

const CO_SCHOLASTIC_FAMILIES: Record<string, string> = {
  KG_DEVELOPMENTAL: "Kindergarten developmental",
  PRIMARY_SKILLS: "Primary skills",
  SECONDARY_PERSONALITY: "Secondary personality development",
  RATING: "Rating scale"
};

const EXAM_TYPES: Record<string, string> = {
  FORMATIVE: "Formative assessment",
  SUMMATIVE: "Summative assessment",
  TERM: "Term examination",
  ANNUAL: "Annual examination",
  PREBOARD: "Pre-board examination",
  PRACTICAL: "Practical examination",
  OTHER_APPROVED: "Other approved examination"
};

const ROUNDING_POLICIES: Record<string, string> = {
  RC05_V1_DECIMAL6_HALF_UP2: "Policy v1: six-decimal working precision, half-up to two decimals"
};

function titleCaseEnum(value: string) {
  return value
    .toLocaleLowerCase("en-IN")
    .replaceAll("_", " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("en-IN"));
}

function labelled(map: Record<string, string>, value: string) {
  return map[value] ?? titleCaseEnum(value);
}

export const calculationModeLabel = (value: string) => labelled(CALCULATION_MODES, value);
export const componentKindLabel = (value: string) => labelled(COMPONENT_KINDS, value);
export const templateFamilyLabel = (value: string) => labelled(TEMPLATE_FAMILIES, value);
export const scaleFamilyLabel = (value: string) => labelled(SCALE_FAMILIES, value);
export const coScholasticFamilyLabel = (value: string) => labelled(CO_SCHOLASTIC_FAMILIES, value);
export const examTypeLabel = (value: string) => labelled(EXAM_TYPES, value);
export const roundingPolicyLabel = (value: string) => labelled(ROUNDING_POLICIES, value);
export const configurationStatusLabel = (value: string) => titleCaseEnum(value);
export const assignmentRoleLabel = (value: string) => titleCaseEnum(value);
export const evidenceStatusLabel = (value: string) => titleCaseEnum(value);
