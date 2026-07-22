import { Prisma, type PrismaClient } from "@prisma/client";
import { moneyDecimal } from "@/lib/expenses";
export { validateClassXTemplateSnapshot } from "@/lib/class-x-template-definition";

export const CLASS_X_PACKAGE_TYPE = "CLASS_X_COMPLETION_PACKAGE" as const;
export const CLASS_X_ISSUER_TYPES = ["SCHOOL", "BOARD", "EXTERNAL_AUTHORITY"] as const;
export const CLASS_X_ITEM_TYPES = [
  "TRANSFER_CERTIFICATE",
  "STUDY_CERTIFICATE",
  "CONDUCT_CERTIFICATE",
  "BONAFIDE_CERTIFICATE",
  "BOARD_MARKS_MEMO",
  "BOARD_PASS_CERTIFICATE",
  "BOARD_MIGRATION_CERTIFICATE",
  "BOARD_PROVISIONAL_CERTIFICATE",
  "OTHER_BOARD_DOCUMENT"
] as const;
export const CLASS_X_TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE"] as const;

export type ClassXDocumentDefinition = {
  itemKey: string;
  itemType: (typeof CLASS_X_ITEM_TYPES)[number];
  issuerType: (typeof CLASS_X_ISSUER_TYPES)[number];
  displayName: string;
  required: boolean;
  displayOrder: number;
  parentVisible: boolean;
  serialNumberRequired: boolean;
  handoverRequired: boolean;
};

export type ClassXTemplateDefinition = {
  documents: ClassXDocumentDefinition[];
  allowPartialApprovalWhileAwaitingBoard: boolean;
  parentReceiptVisible: boolean;
};

function record(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number, required = true) {
  const result = String(value ?? "").trim();
  if ((required && !result) || result.length > max) throw new Error(`${label} ${required ? "is required and " : ""}must be at most ${max} characters`);
  if (/<\/?[a-z]|javascript:|data:text\/html|on[a-z]+\s*=/i.test(result)) throw new Error(`${label} contains unsafe executable or HTML content`);
  return result || null;
}

function strictKeys(row: Record<string, unknown>, allowed: readonly string[], label: string) {
  const unknown = Object.keys(row).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new Error(`${label} contains unsupported field ${unknown[0]}`);
}

function oneOf<T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  const result = String(value ?? "").trim().toUpperCase();
  if (!values.includes(result)) throw new Error(`${label} is not supported`);
  return result as T[number];
}

export function normalizeClassXCode(value: unknown, label: string, max = 40, min = 3) {
  const normalized = text(value, label, max)!.toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!new RegExp(`^[A-Z0-9][A-Z0-9-]{${min - 1},${max - 1}}$`).test(normalized)) {
    throw new Error(`${label} must use ${min}-${max} letters, numbers, or hyphens`);
  }
  return normalized;
}

export function validateClassXTemplateDefinition(input: unknown): ClassXTemplateDefinition {
  const root = record(typeof input === "string" ? (() => { try { return JSON.parse(input); } catch { throw new Error("Document definition must be valid JSON"); } })() : input, "Document definition");
  strictKeys(root, ["documents", "allowPartialApprovalWhileAwaitingBoard", "parentReceiptVisible"], "Document definition");
  if (!Array.isArray(root.documents) || !root.documents.length || root.documents.length > 30) throw new Error("Document definition must contain 1-30 document items");
  const keys = new Set<string>();
  const orders = new Set<number>();
  const documents = root.documents.map((raw, index) => {
    const row = record(raw, `Document item ${index + 1}`);
    strictKeys(row, ["itemKey", "itemType", "issuerType", "displayName", "required", "displayOrder", "parentVisible", "serialNumberRequired", "handoverRequired"], `Document item ${index + 1}`);
    const itemKey = normalizeClassXCode(row.itemKey, `Document item ${index + 1} key`, 40, 2);
    const itemType = oneOf(row.itemType, CLASS_X_ITEM_TYPES, `Document item ${index + 1} type`);
    const issuerType = oneOf(row.issuerType, CLASS_X_ISSUER_TYPES, `Document item ${index + 1} issuer`);
    const displayName = text(row.displayName, `Document item ${index + 1} display name`, 120)!;
    const displayOrder = Number(row.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 1 || displayOrder > 1000) throw new Error(`Document item ${index + 1} display order must be a positive whole number`);
    if (keys.has(itemKey) || orders.has(displayOrder)) throw new Error("Document item keys and display orders must be unique");
    keys.add(itemKey); orders.add(displayOrder);
    if (issuerType === "SCHOOL" && !["TRANSFER_CERTIFICATE", "STUDY_CERTIFICATE", "CONDUCT_CERTIFICATE", "BONAFIDE_CERTIFICATE"].includes(itemType)) throw new Error(`${displayName} uses a Board/external type with SCHOOL issuer`);
    if (issuerType !== "SCHOOL" && ["TRANSFER_CERTIFICATE", "STUDY_CERTIFICATE", "CONDUCT_CERTIFICATE", "BONAFIDE_CERTIFICATE"].includes(itemType)) throw new Error(`${displayName} must use SCHOOL issuer`);
    if (itemType === "OTHER_BOARD_DOCUMENT" && /^other( board)? document$/i.test(displayName)) throw new Error("OTHER_BOARD_DOCUMENT requires a controlled specific document name");
    return {
      itemKey, itemType, issuerType, displayName,
      required: row.required !== false,
      displayOrder,
      parentVisible: row.parentVisible !== false,
      serialNumberRequired: row.serialNumberRequired === true,
      handoverRequired: row.handoverRequired !== false
    };
  }).sort((a, b) => a.displayOrder - b.displayOrder);
  return {
    documents,
    allowPartialApprovalWhileAwaitingBoard: root.allowPartialApprovalWhileAwaitingBoard === true,
    parentReceiptVisible: root.parentReceiptVisible === true
  };
}

export function validateClassXTemplateInput(input: unknown) {
  const row = record(input, "Template details");
  return {
    templateCode: normalizeClassXCode(row.templateCode, "Template code"),
    packageType: CLASS_X_PACKAGE_TYPE,
    name: text(row.name, "Template name", 120)!,
    academicYear: text(row.academicYear, "Academic year", 20, false),
    schoolBoard: text(row.schoolBoard, "School Board", 120, false),
    status: oneOf(row.status ?? "DRAFT", CLASS_X_TEMPLATE_STATUSES, "Template status"),
    documentDefinitionJson: JSON.stringify(validateClassXTemplateDefinition(row.documentDefinition ?? row.documentDefinitionJson)),
    paymentRequired: row.paymentRequired === true,
    defaultChargeRuleId: text(row.defaultChargeRuleId, "Default charge rule", 80, false),
    instructions: text(row.instructions, "Instructions", 2000, false)
  };
}

export function validateClassXChargeRuleInput(input: unknown) {
  const row = record(input, "Charge rule details");
  const effectiveFrom = row.effectiveFrom ? new Date(`${String(row.effectiveFrom)}T00:00:00.000Z`) : null;
  const effectiveTo = row.effectiveTo ? new Date(`${String(row.effectiveTo)}T00:00:00.000Z`) : null;
  if (effectiveFrom && Number.isNaN(effectiveFrom.getTime()) || effectiveTo && Number.isNaN(effectiveTo.getTime())) throw new Error("Charge rule dates are invalid");
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error("Effective to cannot be before effective from");
  const amount = moneyDecimal(row.amount ?? 0, "Charge amount");
  if (amount.lt(0)) throw new Error("Charge amount cannot be negative");
  return {
    ruleCode: normalizeClassXCode(row.ruleCode, "Rule code"),
    academicYear: text(row.academicYear, "Academic year", 20, false),
    packageType: CLASS_X_PACKAGE_TYPE,
    name: text(row.name, "Rule name", 120)!,
    amount,
    miscellaneousIncomeItemCode: normalizeClassXCode(row.miscellaneousIncomeItemCode ?? "CLASS-X-CERT", "Miscellaneous Income item code", 30),
    paymentRequired: row.paymentRequired !== false,
    waiverAllowed: row.waiverAllowed === true,
    status: oneOf(row.status ?? "ACTIVE", ["ACTIVE", "INACTIVE"] as const, "Rule status"),
    effectiveFrom, effectiveTo,
    notes: text(row.notes, "Rule notes", 1000, false)
  };
}

export async function assertClassXIncomeItem(client: Pick<PrismaClient | Prisma.TransactionClient, "miscIncomeItem">, itemCode: string) {
  const item = await client.miscIncomeItem.findUnique({ where: { itemCode } });
  if (!item || item.status !== "ACTIVE") throw new Error(`Miscellaneous Income item ${itemCode} must already exist and be active`);
  if (item.studentLinkPolicy !== "REQUIRED") throw new Error(`Miscellaneous Income item ${itemCode} must require a Student link`);
  return item;
}
