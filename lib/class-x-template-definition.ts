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

export type ClassXTemplateSnapshot = ClassXTemplateDefinition & {
  templateCode: string;
  name: string;
  versionNumber: number;
  schoolBoard: string | null;
  instructions: string | null;
};

function record(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number) {
  const result = String(value ?? "").trim();
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`);
  if (/<\/?[a-z]|javascript:|data:text\/html|on[a-z]+\s*=/i.test(result)) throw new Error(`${label} contains unsafe executable or HTML content`);
  return result;
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
  const normalized = text(value, label, max).toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
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
    const displayName = text(row.displayName, `Document item ${index + 1} display name`, 120);
    const displayOrder = Number(row.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 1 || displayOrder > 1000) throw new Error(`Document item ${index + 1} display order must be a positive whole number`);
    if (keys.has(itemKey) || orders.has(displayOrder)) throw new Error("Document item keys and display orders must be unique");
    keys.add(itemKey);
    orders.add(displayOrder);
    if (issuerType === "SCHOOL" && !["TRANSFER_CERTIFICATE", "STUDY_CERTIFICATE", "CONDUCT_CERTIFICATE", "BONAFIDE_CERTIFICATE"].includes(itemType)) throw new Error(`${displayName} uses a Board/external type with SCHOOL issuer`);
    if (issuerType !== "SCHOOL" && ["TRANSFER_CERTIFICATE", "STUDY_CERTIFICATE", "CONDUCT_CERTIFICATE", "BONAFIDE_CERTIFICATE"].includes(itemType)) throw new Error(`${displayName} must use SCHOOL issuer`);
    if (itemType === "OTHER_BOARD_DOCUMENT" && /^other( board)? document$/i.test(displayName)) throw new Error("OTHER_BOARD_DOCUMENT requires a controlled specific document name");
    return {
      itemKey,
      itemType,
      issuerType,
      displayName,
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

export function validateClassXTemplateSnapshot(input: unknown): ClassXTemplateSnapshot {
  const root = record(typeof input === "string" ? (() => { try { return JSON.parse(input); } catch { throw new Error("Class X template snapshot must be valid JSON"); } })() : input, "Class X template snapshot");
  strictKeys(root, ["templateCode", "name", "versionNumber", "schoolBoard", "instructions", "documents", "allowPartialApprovalWhileAwaitingBoard", "parentReceiptVisible"], "Class X template snapshot");
  const versionNumber = Number(root.versionNumber);
  if (!Number.isInteger(versionNumber) || versionNumber < 1) throw new Error("Class X template snapshot version must be a positive whole number");
  return {
    templateCode: normalizeClassXCode(root.templateCode, "Class X template snapshot code"),
    name: text(root.name, "Class X template snapshot name", 160),
    versionNumber,
    schoolBoard: root.schoolBoard == null || String(root.schoolBoard).trim() === "" ? null : text(root.schoolBoard, "Class X template snapshot school Board", 160),
    instructions: root.instructions == null || String(root.instructions).trim() === "" ? null : text(root.instructions, "Class X template snapshot instructions", 2000),
    ...validateClassXTemplateDefinition({
      documents: root.documents,
      allowPartialApprovalWhileAwaitingBoard: root.allowPartialApprovalWhileAwaitingBoard,
      parentReceiptVisible: root.parentReceiptVisible
    })
  };
}
