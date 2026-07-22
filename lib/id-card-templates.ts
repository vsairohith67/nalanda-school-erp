import { normalizeCode } from "@/lib/certificate-templates";

export const ID_CARD_TYPES = ["STUDENT", "STAFF"] as const;
export type IdentityCardType = (typeof ID_CARD_TYPES)[number];

export const STUDENT_CARD_FIELDS = [
  "schoolName", "schoolLogo", "schoolAddress", "schoolOfficeContact", "cardNumber",
  "studentName", "admissionNumber", "className", "section", "academicYear",
  "validFrom", "validUntil", "dateOfBirth", "guardianName", "photoPlaceholder",
  "barcode", "returnToSchool", "issuingRole", "versionStatus"
] as const;
export const STAFF_CARD_FIELDS = [
  "schoolName", "schoolLogo", "schoolAddress", "schoolOfficeContact", "cardNumber",
  "staffName", "staffCode", "designation", "department", "primarySubject",
  "validFrom", "validUntil", "photoPlaceholder", "barcode", "returnToSchool",
  "issuingRole", "versionStatus"
] as const;

const PROHIBITED = /<\s*\/?\s*(script|iframe|object|embed|style|form)|javascript:|data:text\/html|on\w+\s*=|\b(aadhaar|caste|religion|disability|medical|salary|bank|epfo|esi|tax|passwordhash)\b|fee\s*(category|status)|blood\s*group|home\s*address|personal\s*(phone|contact)|raw\s*id/i;
const SIDE_KEYS = new Set(["title", "fields", "footer", "accent"]);
const PRINT_KEYS = new Set(["colour", "cutGuides"]);

export type IdentityCardSideDefinition = {
  title: string;
  fields: string[];
  footer?: string;
  accent?: string;
};

export function isIdentityCardType(value: unknown): value is IdentityCardType {
  return ID_CARD_TYPES.includes(String(value).toUpperCase() as IdentityCardType);
}

function safeText(value: unknown, label: string, max: number) {
  const text = String(value ?? "").trim();
  if (!text || text.length > max) throw new Error(`${label} is required and must be at most ${max} characters.`);
  if (PROHIBITED.test(text)) throw new Error(`${label} contains unsafe or prohibited content.`);
  return text;
}

export function validateIdentityCardSideDefinition(cardType: unknown, input: unknown, side: "front" | "back"): IdentityCardSideDefinition {
  if (!isIdentityCardType(cardType)) throw new Error("Card type must be STUDENT or STAFF.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${side} definition must be an object.`);
  const source = input as Record<string, unknown>;
  const unknown = Object.keys(source).find((key) => !SIDE_KEYS.has(key));
  if (unknown) throw new Error(`Unsupported ${side} definition field: ${unknown}`);
  if (PROHIBITED.test(JSON.stringify(source))) throw new Error(`${side} definition contains unsafe or prohibited content.`);
  const allowed = new Set<string>(cardType === "STUDENT" ? STUDENT_CARD_FIELDS : STAFF_CARD_FIELDS);
  const fields = Array.isArray(source.fields) ? source.fields.map(String) : [];
  if (!fields.length || fields.length > 18) throw new Error(`${side} definition must contain 1 to 18 allowlisted fields.`);
  const unsupported = fields.find((field) => !allowed.has(field));
  if (unsupported) throw new Error(`Unsupported ${cardType} ID-card field: ${unsupported}`);
  return {
    title: safeText(source.title, `${side} title`, 100),
    fields: Array.from(new Set(fields)),
    footer: String(source.footer ?? "").trim().slice(0, 300) || undefined,
    accent: /^#[0-9a-f]{6}$/i.test(String(source.accent ?? "")) ? String(source.accent) : undefined
  };
}

export function validateIdentityCardPrintSettings(input: unknown) {
  if (input == null || input === "") return { colour: true, cutGuides: true };
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Print settings must be an object.");
  const source = input as Record<string, unknown>;
  const unknown = Object.keys(source).find((key) => !PRINT_KEYS.has(key));
  if (unknown) throw new Error(`Unsupported print setting: ${unknown}`);
  return { colour: source.colour !== false, cutGuides: source.cutGuides !== false };
}

export function validateIdentityCardTemplateInput(input: any) {
  const cardType = String(input?.cardType ?? "").toUpperCase();
  if (!isIdentityCardType(cardType)) throw new Error("Card type must be STUDENT or STAFF.");
  const front = validateIdentityCardSideDefinition(cardType, input.frontDefinition ?? input.front, "front");
  const back = validateIdentityCardSideDefinition(cardType, input.backDefinition ?? input.back, "back");
  const photoRequired = input.photoRequired === true || input.photoRequired === "true" || input.photoRequired === "on";
  if (photoRequired) throw new Error("Photo-required templates are unavailable because no managed Student/Staff photo source exists.");
  return {
    templateCode: normalizeCode(input?.templateCode, "Template code"),
    cardType,
    name: safeText(input?.name, "Template name", 120),
    academicYear: String(input?.academicYear ?? "").trim() || null,
    status: ["DRAFT", "ACTIVE", "INACTIVE"].includes(String(input?.status)) ? String(input.status) : "DRAFT",
    versionNumber: Math.max(1, Number(input?.versionNumber ?? 1) || 1),
    frontDefinitionJson: JSON.stringify(front),
    backDefinitionJson: JSON.stringify(back),
    printSettingsJson: JSON.stringify(validateIdentityCardPrintSettings(input?.printSettings)),
    photoRequired: false,
    barcodeEnabled: input?.barcodeEnabled !== false && input?.barcodeEnabled !== "false"
  };
}

export function defaultIdentityCardDefinitions(cardType: IdentityCardType) {
  return cardType === "STUDENT"
    ? {
        front: { title: "STUDENT ID CARD", fields: ["schoolName", "schoolLogo", "studentName", "admissionNumber", "className", "section", "academicYear", "photoPlaceholder", "cardNumber", "barcode", "versionStatus"] },
        back: { title: "SCHOOL ID CARD", fields: ["validFrom", "validUntil", "schoolAddress", "schoolOfficeContact", "returnToSchool", "issuingRole"], footer: "This card is an operational school identity card. It is not a government identity document." }
      }
    : {
        front: { title: "STAFF ID CARD", fields: ["schoolName", "schoolLogo", "staffName", "staffCode", "designation", "department", "photoPlaceholder", "cardNumber", "barcode", "versionStatus"] },
        back: { title: "SCHOOL ID CARD", fields: ["validFrom", "validUntil", "primarySubject", "schoolAddress", "schoolOfficeContact", "returnToSchool", "issuingRole"], footer: "This card is an operational school identity card. It is not a government identity document." }
      };
}

export function parseIdentityCardTemplate(row: { cardType: string; frontDefinitionJson: string; backDefinitionJson: string; printSettingsJson: string | null }) {
  return {
    front: validateIdentityCardSideDefinition(row.cardType, JSON.parse(row.frontDefinitionJson), "front"),
    back: validateIdentityCardSideDefinition(row.cardType, JSON.parse(row.backDefinitionJson), "back"),
    print: validateIdentityCardPrintSettings(row.printSettingsJson ? JSON.parse(row.printSettingsJson) : null)
  };
}
