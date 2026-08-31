import {
  OcrScanningError,
  sha256,
  type OcrContextType,
  type OcrReviewState,
  type OcrScriptHint,
  type OcrTextBlock,
  type OcrValidationState
} from "@/lib/ocr-scanning/contracts";

type FieldKind = "TEXT" | "DATE" | "PHONE" | "EMAIL" | "CLASS" | "IDENTIFIER";
export type OcrProfileField = {
  key: string;
  aliases: readonly string[];
  kind: FieldKind;
  critical: boolean;
  maximumLength: number;
};

export const OCR_DOCUMENT_PROFILES: Record<OcrContextType, readonly OcrProfileField[]> = {
  ADMISSION: [
    field("fullName", ["student name", "applicant name", "name of child"], "TEXT", true, 120),
    field("dateOfBirth", ["date of birth", "dob"], "DATE", true, 20),
    field("desiredClass", ["class applied", "admission class", "class"], "CLASS", true, 30),
    field("applicationNumber", ["application number", "form number"], "IDENTIFIER", true, 60),
    field("guardianName", ["parent name", "guardian name", "father name", "mother name"], "TEXT", true, 120),
    field("guardianPhone", ["parent phone", "guardian phone", "mobile", "phone"], "PHONE", true, 30),
    field("previousSchool", ["previous school", "last school"], "TEXT", false, 160)
  ],
  STUDENT: [
    field("studentName", ["student name", "name of student"], "TEXT", true, 120),
    field("dateOfBirth", ["date of birth", "dob"], "DATE", true, 20),
    field("className", ["class", "grade"], "CLASS", true, 30),
    field("admissionNo", ["admission number", "admission no"], "IDENTIFIER", true, 60),
    field("fatherName", ["father name", "guardian name"], "TEXT", true, 120),
    field("motherName", ["mother name"], "TEXT", false, 120),
    field("phone1", ["mobile", "phone", "primary phone"], "PHONE", true, 30),
    field("address", ["address"], "TEXT", false, 500)
  ],
  GUARDIAN: [
    field("displayName", ["guardian name", "parent name", "name"], "TEXT", true, 120),
    field("primaryMobile", ["mobile", "phone", "primary mobile"], "PHONE", true, 30),
    field("alternateMobile", ["alternate mobile", "alternate phone"], "PHONE", false, 30),
    field("email", ["email"], "EMAIL", false, 160),
    field("relationship", ["relationship", "relation"], "TEXT", false, 40)
  ],
  STAFF: [
    field("fullName", ["staff name", "employee name", "name"], "TEXT", true, 120),
    field("staffCode", ["employee id", "employee identifier", "staff code"], "IDENTIFIER", true, 60),
    field("mobile", ["mobile", "phone"], "PHONE", true, 30),
    field("email", ["email"], "EMAIL", false, 160),
    field("address", ["address"], "TEXT", false, 500),
    field("designation", ["designation", "post"], "TEXT", false, 120)
  ]
};

export function ocrProfileField(contextType: OcrContextType, fieldKey: string) {
  return OCR_DOCUMENT_PROFILES[contextType].find((candidate) => candidate.key === fieldKey) ?? null;
}

function field(key: string, aliases: readonly string[], kind: FieldKind, critical: boolean, maximumLength: number): OcrProfileField {
  return { key, aliases, kind, critical, maximumLength };
}

function normalized(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function labelValue(block: OcrTextBlock, profile: OcrProfileField) {
  const text = normalized(block.text);
  for (const alias of profile.aliases) {
    const pattern = new RegExp(`^${escapeRegExp(alias)}\\s*(?:[:\\-–—]|is)\\s*(.+)$`, "iu");
    const match = text.match(pattern);
    if (match?.[1]) return normalized(match[1]);
  }
  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validateOcrCandidate(value: string, kind: FieldKind): OcrValidationState {
  const text = normalized(value);
  if (!text) return "MISSING";
  if (kind === "DATE") {
    const match = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
    if (!match) return "AMBIGUOUS";
    const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && year >= 1900 && year <= new Date().getUTCFullYear()
      ? "VALID_FORMAT" : "INVALID_FORMAT";
  }
  if (kind === "PHONE") {
    const digits = text.replace(/[^0-9]/g, "");
    return digits.length >= 10 && digits.length <= 15 ? "VALID_FORMAT" : "INVALID_FORMAT";
  }
  if (kind === "EMAIL") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? "VALID_FORMAT" : "INVALID_FORMAT";
  if (kind === "CLASS") return /^(?:pre[- ]?primary|nursery|lkg|ukg|[1-9]|1[0-2]|i{1,3}|iv|v|vi{0,3}|ix|x|xi|xii)(?:\s*[-/]?\s*[a-z])?$/i.test(text) ? "VALID_FORMAT" : "AMBIGUOUS";
  if (kind === "IDENTIFIER") return /^[\p{L}\p{N}][\p{L}\p{N}._\/-]{1,59}$/u.test(text) ? "VALID_FORMAT" : "INVALID_FORMAT";
  return text.length >= 2 ? "VALID_FORMAT" : "AMBIGUOUS";
}

function reviewState(input: { validation: OcrValidationState; score: number | null; region: unknown; handwritingDeclared: boolean; critical: boolean }): OcrReviewState {
  if (input.handwritingDeclared || input.validation === "INVALID_FORMAT" || input.validation === "MISSING" || !input.region) return "RED";
  if (input.validation === "AMBIGUOUS" || input.score === null || input.score < 0.93 || input.critical) return "AMBER";
  return "GREEN";
}

export function mapOcrCandidates(input: { contextType: OcrContextType; blocks: readonly OcrTextBlock[]; handwritingDeclared: boolean }) {
  const profile = OCR_DOCUMENT_PROFILES[input.contextType];
  const mapped = [] as Array<{
    fieldKey: string;
    candidateText: string;
    candidateSha256: string;
    pageNumber: number;
    sourceRegionJson: string | null;
    recognitionScore: number | null;
    scriptHint: OcrScriptHint;
    validationState: OcrValidationState;
    reviewState: OcrReviewState;
    critical: boolean;
    retryPreprocessing: boolean;
  }>;
  for (const definition of profile) {
    const matches = input.blocks.flatMap((block) => {
      const value = labelValue(block, definition);
      return value ? [{ block, value }] : [];
    });
    if (!matches.length) {
      mapped.push({
        fieldKey: definition.key,
        candidateText: "",
        candidateSha256: sha256(""),
        pageNumber: 1,
        sourceRegionJson: null,
        recognitionScore: null,
        scriptHint: "UNKNOWN",
        validationState: "MISSING",
        reviewState: "RED",
        critical: definition.critical,
        retryPreprocessing: false
      });
      continue;
    }
    matches.sort((left, right) => (right.block.recognitionScore ?? -1) - (left.block.recognitionScore ?? -1));
    const selected = matches[0];
    if (selected.value.length > definition.maximumLength) throw new OcrScanningError("OCR_MAPPED_FIELD_TOO_LARGE", 413);
    const validation = validateOcrCandidate(selected.value, definition.kind);
    mapped.push({
      fieldKey: definition.key,
      candidateText: selected.value,
      candidateSha256: sha256(selected.value),
      pageNumber: selected.block.pageNumber,
      sourceRegionJson: selected.block.polygon ? JSON.stringify({ pageNumber: selected.block.pageNumber, polygon: selected.block.polygon }) : null,
      recognitionScore: selected.block.recognitionScore,
      scriptHint: selected.block.scriptHint,
      validationState: validation,
      reviewState: reviewState({ validation, score: selected.block.recognitionScore, region: selected.block.polygon, handwritingDeclared: input.handwritingDeclared, critical: definition.critical }),
      critical: definition.critical,
      retryPreprocessing: selected.block.retryPreprocessing
    });
  }
  return mapped;
}
