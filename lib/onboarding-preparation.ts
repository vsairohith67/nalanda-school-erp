import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { inspectXlsxContainer } from "@/lib/onboarding-workbooks";

export const ONBOARDING_PREPARATION_VERSION = "REAL-DATA-ONBOARDING-PREPARATION-1A-1.0.0";
export const ONBOARDING_PREPARATION_LIMITS = Object.freeze({
  maxFileBytes: 10 * 1024 * 1024,
  maxFiles: 32,
  maxSheets: 16,
  maxRowsPerSheet: 10_000,
  maxColumns: 128,
  maxCellLength: 8_000,
  maxTotalCharacters: 16 * 1024 * 1024,
  maxFormulaCells: 0,
  maxProcessingMilliseconds: 30_000,
  maxReportBytes: 10 * 1024 * 1024
});

export const VALIDATION_STATES = [
  "VALID", "MISSING_REQUIRED", "INVALID_FORMAT", "AMBIGUOUS", "UNSUPPORTED",
  "CONFLICTING_SOURCE", "DUPLICATE_CANDIDATE", "UNMAPPED_VALUE",
  "SENSITIVE_REQUIRES_APPROVAL", "NOT_APPLICABLE", "READY_FOR_HUMAN_REVIEW"
] as const;

export type ValidationState = typeof VALIDATION_STATES[number];
export type ValidationIssue = {
  state: ValidationState;
  fileId: string;
  row: number;
  fieldId?: string;
  code: string;
  severity: "ERROR" | "WARNING" | "REVIEW";
};

export type PackageFile = {
  fileId: string;
  relativePath: string;
  sha256: string;
  sizeBytes: number;
  format: "CSV" | "XLSX";
  domain: string;
  declaredEncoding?: string;
};

export type PackageManifest = {
  schemaVersion: "1.0";
  packageId: string;
  sourceId: string;
  sourceOwner: string;
  exportingPerson: string;
  exportTimestamp: string;
  receivedTimestamp: string;
  originalFilename: string;
  fileSize: number;
  sha256: string;
  format: string;
  declaredEncoding: string;
  declaredAcademicYears: string[];
  recordDomains: string[];
  confidentiality: string;
  transferMethod: string;
  malwareScanResult: string;
  validationResult: string;
  approvalState: string;
  retentionDeadline: string | null;
  supersededPackageReference: string | null;
  sourceClassification: string;
  files: PackageFile[];
};

export type MappingEntry = {
  id: string;
  domain: string;
  sourceField: string;
  sourceAliases: string[];
  sourceType: string;
  sourceFormat: string;
  proposedTargetService: string;
  proposedTargetField: string;
  transformation: string;
  validation: string;
  requirement: "REQUIRED" | "OPTIONAL" | "CONDITIONAL";
  authority: string;
  conflictPolicy: string;
  privacyClassification: string;
  minimisationDecision: string;
  migrationWave: string;
  approvalOwner: string;
  unsupportedReason: string | null;
};

export type MappingCatalogue = { schemaVersion: "1.0"; entries: MappingEntry[] };
export type ParsedTable = { fileId: string; domain: string; headers: string[]; rows: string[][]; warnings: ValidationIssue[] };

export type DryRunResult = {
  version: string;
  packageId: string;
  packageDigest: string;
  sourceDigestAfter: string;
  validationState: ValidationState;
  rowsReceived: number;
  rowsAcceptedForReview: number;
  issues: ValidationIssue[];
  duplicates: Array<{ domain: string; row: number; candidateRow: number; signals: string[] }>;
  transformations: Array<{ fileId: string; row: number; fieldId: string; sourceValue: string; proposedNormalizedValue: string }>;
  mappedFields: number;
  unmappedFields: number;
  sensitiveFields: string[];
  financialReconciliation: Array<{ fileId: string; sourceTotalPaise: string; acceptedTotalPaise: string; differencePaise: string; state: string }>;
  proposed: { creates: number; updates: number; links: number };
  noWriteProof: { authoritativeWriteCount: 0; databaseAccess: false; networkAccess: false; sourceMutation: false };
};

const SOURCE_CLASSIFICATIONS = new Set(["AUTHORITATIVE_PRIMARY", "AUTHORITATIVE_BY_PERIOD", "SUPPORTING_EVIDENCE", "DERIVED", "HISTORICAL_REFERENCE", "UNVERIFIED", "CONFLICTING", "INCOMPLETE", "DO_NOT_IMPORT"]);
const APPROVAL_STATES = new Set(["SOURCE_RECEIVED", "SOURCE_VERIFIED", "MAPPING_PREPARED", "DRY_RUN_COMPLETE", "DATA_OWNER_REVIEW", "PRIVACY_REVIEW", "FINANCE_RECONCILED", "TECHNICAL_APPROVAL", "OWNER_APPROVAL", "READY_FOR_PRIVATE_STAGING_IMPORT", "REJECTED", "SUPERSEDED"]);
const SENSITIVE_HEADERS = new Set(["aadhaar", "aadhaar_number", "pen", "apaar", "cwsn", "disability", "medical_details", "blood_group", "social_category", "minority_status", "bank_account", "salary", "payroll", "biometric_identifier", "biometric_template", "signature"]);
const IDENTIFIER_HEADERS = new Set(["source_student_id", "admission_number", "source_guardian_id", "source_staff_id", "staff_code", "employee_code", "source_payment_id", "receipt_reference"]);
const BLOCKED_EXTENSIONS = new Set([".xlsm", ".xls", ".xltm", ".xla", ".exe", ".dll", ".zip", ".rar", ".7z", ".tar", ".gz"]);

function hash(bytes: Uint8Array | string) { return createHash("sha256").update(bytes).digest("hex"); }
function canonicalHeader(value: string) { return value.normalize("NFKC").trim().toLocaleLowerCase("en-IN").replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, ""); }
function iso(value: unknown) { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function plainObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function safeId(value: unknown) { return typeof value === "string" && /^[A-Z0-9][A-Z0-9._:-]{2,99}$/i.test(value); }
function safeRelativePath(value: string) {
  if (!value || value.length > 180 || path.isAbsolute(value) || value.includes("..") || /[\u0000-\u001f]/.test(value)) return false;
  return value === path.basename(value) && !BLOCKED_EXTENSIONS.has(path.extname(value).toLowerCase());
}

export function validateManifest(value: unknown): { manifest?: PackageManifest; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const add = (fieldId: string, code: string, state: ValidationState = "INVALID_FORMAT") => issues.push({ state, fileId: "MANIFEST", row: 0, fieldId, code, severity: "ERROR" });
  if (!plainObject(value)) return { issues: [{ state: "INVALID_FORMAT", fileId: "MANIFEST", row: 0, code: "MANIFEST_NOT_OBJECT", severity: "ERROR" }] };
  const requiredStrings = ["packageId", "sourceId", "sourceOwner", "exportingPerson", "exportTimestamp", "receivedTimestamp", "originalFilename", "sha256", "format", "declaredEncoding", "confidentiality", "transferMethod", "malwareScanResult", "validationResult", "approvalState", "sourceClassification"];
  if (value.schemaVersion !== "1.0") add("schemaVersion", "MANIFEST_SCHEMA_UNSUPPORTED", "UNSUPPORTED");
  for (const field of requiredStrings) if (typeof value[field] !== "string" || !String(value[field]).trim()) add(field, "MANIFEST_REQUIRED_FIELD_MISSING", "MISSING_REQUIRED");
  if (!safeId(value.packageId)) add("packageId", "PACKAGE_ID_INVALID");
  if (!safeId(value.sourceId)) add("sourceId", "SOURCE_ID_INVALID");
  if (!iso(value.exportTimestamp)) add("exportTimestamp", "EXPORT_TIMESTAMP_INVALID");
  if (!iso(value.receivedTimestamp)) add("receivedTimestamp", "RECEIVED_TIMESTAMP_INVALID");
  if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(value.sha256)) add("sha256", "PACKAGE_SHA256_INVALID");
  if (typeof value.fileSize !== "number" || !Number.isSafeInteger(value.fileSize) || value.fileSize < 0) add("fileSize", "PACKAGE_FILE_SIZE_INVALID");
  if (!Array.isArray(value.declaredAcademicYears) || value.declaredAcademicYears.some((item) => typeof item !== "string")) add("declaredAcademicYears", "ACADEMIC_YEARS_INVALID");
  if (!Array.isArray(value.recordDomains) || !value.recordDomains.length || value.recordDomains.some((item) => typeof item !== "string")) add("recordDomains", "RECORD_DOMAINS_INVALID");
  if (!SOURCE_CLASSIFICATIONS.has(String(value.sourceClassification))) add("sourceClassification", "SOURCE_CLASSIFICATION_INVALID");
  if (!APPROVAL_STATES.has(String(value.approvalState))) add("approvalState", "APPROVAL_STATE_INVALID");
  if (value.retentionDeadline !== null && !iso(value.retentionDeadline)) add("retentionDeadline", "RETENTION_DEADLINE_INVALID");
  if (value.supersededPackageReference !== null && !safeId(value.supersededPackageReference)) add("supersededPackageReference", "SUPERSEDED_PACKAGE_INVALID");
  if (!Array.isArray(value.files) || !value.files.length || value.files.length > ONBOARDING_PREPARATION_LIMITS.maxFiles) add("files", "PACKAGE_FILES_INVALID");
  const fileIds = new Set<string>(); const paths = new Set<string>();
  for (const [index, candidate] of (Array.isArray(value.files) ? value.files : []).entries()) {
    if (!plainObject(candidate)) { add(`files.${index}`, "PACKAGE_FILE_INVALID"); continue; }
    const fileId = String(candidate.fileId ?? ""), relativePath = String(candidate.relativePath ?? ""), format = String(candidate.format ?? "");
    if (!safeId(fileId) || fileIds.has(fileId)) add(`files.${index}.fileId`, "PACKAGE_FILE_ID_INVALID_OR_DUPLICATE");
    if (!safeRelativePath(relativePath) || paths.has(relativePath.toLocaleLowerCase())) add(`files.${index}.relativePath`, "PACKAGE_PATH_INVALID_OR_DUPLICATE");
    if (!/^[a-f0-9]{64}$/i.test(String(candidate.sha256 ?? ""))) add(`files.${index}.sha256`, "PACKAGE_FILE_SHA256_INVALID");
    if (!Number.isSafeInteger(candidate.sizeBytes) || Number(candidate.sizeBytes) < 0 || Number(candidate.sizeBytes) > ONBOARDING_PREPARATION_LIMITS.maxFileBytes) add(`files.${index}.sizeBytes`, "PACKAGE_FILE_SIZE_INVALID");
    if (!new Set(["CSV", "XLSX"]).has(format)) add(`files.${index}.format`, "PACKAGE_FILE_FORMAT_UNSUPPORTED", "UNSUPPORTED");
    if (typeof candidate.domain !== "string" || !candidate.domain) add(`files.${index}.domain`, "PACKAGE_FILE_DOMAIN_REQUIRED", "MISSING_REQUIRED");
    if (format && path.extname(relativePath).toLowerCase() !== `.${format.toLowerCase()}`) add(`files.${index}.format`, "PACKAGE_EXTENSION_FORMAT_MISMATCH");
    fileIds.add(fileId); paths.add(relativePath.toLocaleLowerCase());
  }
  return issues.length ? { issues } : { manifest: value as unknown as PackageManifest, issues };
}

export function validateMappingCatalogue(value: unknown): { catalogue?: MappingCatalogue; issues: string[] } {
  const issues: string[] = [];
  if (!plainObject(value) || value.schemaVersion !== "1.0" || !Array.isArray(value.entries)) return { issues: ["MAPPING_CATALOGUE_INVALID"] };
  const ids = new Set<string>();
  const required = ["id", "domain", "sourceField", "sourceAliases", "sourceType", "sourceFormat", "proposedTargetService", "proposedTargetField", "transformation", "validation", "requirement", "authority", "conflictPolicy", "privacyClassification", "minimisationDecision", "migrationWave", "approvalOwner", "unsupportedReason"];
  for (const [index, entry] of value.entries.entries()) {
    if (!plainObject(entry)) { issues.push(`ENTRY_${index}_INVALID`); continue; }
    for (const field of required) if (!(field in entry)) issues.push(`ENTRY_${index}_${field}_MISSING`);
    if (!safeId(entry.id) || ids.has(String(entry.id))) issues.push(`ENTRY_${index}_ID_INVALID_OR_DUPLICATE`);
    if (!Array.isArray(entry.sourceAliases) || entry.sourceAliases.some((item) => typeof item !== "string")) issues.push(`ENTRY_${index}_ALIASES_INVALID`);
    if (!["REQUIRED", "OPTIONAL", "CONDITIONAL"].includes(String(entry.requirement))) issues.push(`ENTRY_${index}_REQUIREMENT_INVALID`);
    if (String(entry.proposedTargetField).toLowerCase().includes("database.") || String(entry.proposedTargetService).toLowerCase().includes("prisma")) issues.push(`ENTRY_${index}_DIRECT_DATABASE_MAPPING_REFUSED`);
    ids.add(String(entry.id));
  }
  return issues.length ? { issues } : { catalogue: value as unknown as MappingCatalogue, issues };
}

function decodeCsv(bytes: Uint8Array, declaredEncoding: string): { text?: string; issue?: string; encoding?: string } {
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const declared = declaredEncoding.trim().toLowerCase().replace("_", "-");
  if (bom) return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(3)), encoding: "UTF-8-BOM" };
  try { return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), encoding: "UTF-8" }; } catch { /* continue */ }
  const allowedDeclared = new Set(["windows-1252", "cp1252", "windows-1258", "cp1258"]);
  if (!allowedDeclared.has(declared)) return { issue: "ENCODING_LOW_CONFIDENCE" };
  try { return { text: new TextDecoder(declared.replace("cp", "windows-"), { fatal: true }).decode(bytes), encoding: declared.toUpperCase() }; } catch { return { issue: "DECLARED_ENCODING_INVALID" }; }
}

function parseDelimited(text: string, deadline: number): { rows?: string[][]; delimiter?: string; issue?: string } {
  const candidates = [",", "\t", ";"].map((delimiter) => ({ delimiter, parsed: parseWithDelimiter(text, delimiter, deadline, 10) }));
  const viable = candidates.filter((candidate) => candidate.parsed.rows && candidate.parsed.rows.length > 0 && candidate.parsed.rows[0].length > 1 && candidate.parsed.rows.slice(0, 9).every((row) => row.length === candidate.parsed.rows![0].length));
  if (!viable.length) {
    const boundedFailure = candidates.map((candidate) => candidate.parsed.issue).find((issue) => issue?.includes("LIMIT"));
    return { issue: boundedFailure ?? (candidates.some((candidate) => candidate.parsed.issue === "CSV_UNCLOSED_QUOTE") ? "CSV_UNCLOSED_QUOTE" : "DELIMITER_INCONSISTENT") };
  }
  const maximumColumns = Math.max(...viable.map((candidate) => candidate.parsed.rows![0].length)); const strongest = viable.filter((candidate) => candidate.parsed.rows![0].length === maximumColumns);
  if (strongest.length !== 1) return { issue: "DELIMITER_AMBIGUOUS" };
  const parsed = parseWithDelimiter(text, strongest[0].delimiter, deadline);
  return parsed.rows ? { rows: parsed.rows, delimiter: strongest[0].delimiter } : { issue: parsed.issue };
}

function parseWithDelimiter(text: string, delimiter: string, deadline: number, stopAfterRows?: number): { rows?: string[][]; issue?: string } {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    if ((index & 4095) === 0 && Date.now() > deadline) return { issue: "PROCESSING_TIME_LIMIT_EXCEEDED" };
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
      if (cell.length > ONBOARDING_PREPARATION_LIMITS.maxCellLength) return { issue: "CELL_LENGTH_LIMIT_EXCEEDED" };
      continue;
    }
    if (char === '"' && cell.length === 0) { quoted = true; continue; }
    if (char === delimiter) { if (row.length >= ONBOARDING_PREPARATION_LIMITS.maxColumns) return { issue: "COLUMN_LIMIT_EXCEEDED" }; row.push(cell); cell = ""; continue; }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length)) {
        rows.push(row);
        if (stopAfterRows && rows.length >= stopAfterRows) return { rows };
        if (rows.length > ONBOARDING_PREPARATION_LIMITS.maxRowsPerSheet + 1) return { issue: "ROW_LIMIT_EXCEEDED" };
      }
      row = []; cell = ""; continue;
    }
    cell += char;
    if (cell.length > ONBOARDING_PREPARATION_LIMITS.maxCellLength) return { issue: "CELL_LENGTH_LIMIT_EXCEEDED" };
  }
  if (quoted) return { issue: "CSV_UNCLOSED_QUOTE" };
  row.push(cell); if (row.some((value) => value.length)) { rows.push(row); if (rows.length > ONBOARDING_PREPARATION_LIMITS.maxRowsPerSheet + 1) return { issue: "ROW_LIMIT_EXCEEDED" }; }
  return { rows };
}

function tableChecks(file: PackageFile, headers: string[], rows: string[][]): ValidationIssue[] {
  const issues: ValidationIssue[] = []; const normalized = headers.map(canonicalHeader);
  const add = (state: ValidationState, row: number, code: string, fieldId?: string, severity: ValidationIssue["severity"] = "ERROR") => issues.push({ state, fileId: file.fileId, row, fieldId, code, severity });
  if (!headers.length) add("MISSING_REQUIRED", 1, "HEADER_ROW_MISSING");
  normalized.forEach((header, index) => { if (!header) add("MISSING_REQUIRED", 1, "BLANK_HEADER", `column_${index + 1}`); else if (normalized.indexOf(header) !== index) add("INVALID_FORMAT", 1, "DUPLICATE_HEADER", header); });
  if (headers.length > ONBOARDING_PREPARATION_LIMITS.maxColumns) add("UNSUPPORTED", 1, "COLUMN_LIMIT_EXCEEDED");
  if (rows.length > ONBOARDING_PREPARATION_LIMITS.maxRowsPerSheet) add("UNSUPPORTED", 0, "ROW_LIMIT_EXCEEDED");
  let total = headers.join("").length;
  for (const [rowIndex, row] of rows.entries()) {
    if (row.length > ONBOARDING_PREPARATION_LIMITS.maxColumns) add("UNSUPPORTED", rowIndex + 2, "COLUMN_LIMIT_EXCEEDED");
    for (const [columnIndex, value] of row.entries()) {
      total += value.length; const fieldId = normalized[columnIndex] ?? `column_${columnIndex + 1}`;
      if (value.length > ONBOARDING_PREPARATION_LIMITS.maxCellLength) add("UNSUPPORTED", rowIndex + 2, "CELL_LENGTH_LIMIT_EXCEEDED", fieldId);
      if (/^[\s\u0000-\u001f]*[=+\-@]/.test(value)) add("UNSUPPORTED", rowIndex + 2, "CSV_FORMULA_REFUSED", fieldId);
      if (IDENTIFIER_HEADERS.has(fieldId) && /^\d+(?:\.\d+)?e[+-]?\d+$/i.test(value.trim())) add("AMBIGUOUS", rowIndex + 2, "SCIENTIFIC_NOTATION_IDENTIFIER", fieldId, "REVIEW");
      if (/\u0000|[\u0001-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) add("INVALID_FORMAT", rowIndex + 2, "CONTROL_CHARACTER_REFUSED", fieldId);
    }
  }
  if (total > ONBOARDING_PREPARATION_LIMITS.maxTotalCharacters) add("UNSUPPORTED", 0, "TOTAL_CHARACTER_LIMIT_EXCEEDED");
  return issues;
}

async function parsePackageFile(root: string, file: PackageFile, declaredEncoding: string, deadline: number): Promise<{ table?: ParsedTable; issues: ValidationIssue[] }> {
  const absolute = path.resolve(root, file.relativePath); const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!absolute.startsWith(rootPrefix)) return { issues: [{ state: "UNSUPPORTED", fileId: file.fileId, row: 0, code: "PATH_CONTAINMENT_REFUSED", severity: "ERROR" }] };
  const metadata = await lstat(absolute);
  if (!metadata.isFile() || metadata.isSymbolicLink()) return { issues: [{ state: "UNSUPPORTED", fileId: file.fileId, row: 0, code: "NON_REGULAR_FILE_REFUSED", severity: "ERROR" }] };
  if (metadata.size !== file.sizeBytes || metadata.size > ONBOARDING_PREPARATION_LIMITS.maxFileBytes) return { issues: [{ state: "CONFLICTING_SOURCE", fileId: file.fileId, row: 0, code: "FILE_SIZE_MISMATCH", severity: "ERROR" }] };
  const bytes = await readFile(absolute);
  if (hash(bytes) !== file.sha256.toLowerCase()) return { issues: [{ state: "CONFLICTING_SOURCE", fileId: file.fileId, row: 0, code: "CHECKSUM_MISMATCH", severity: "ERROR" }] };
  let headers: string[] = [], rows: string[][] = [], warnings: ValidationIssue[] = [];
  if (file.format === "CSV") {
    const decoded = decodeCsv(bytes, file.declaredEncoding ?? declaredEncoding);
    if (!decoded.text) return { issues: [{ state: "AMBIGUOUS", fileId: file.fileId, row: 0, code: decoded.issue ?? "ENCODING_REFUSED", severity: "ERROR" }] };
    const parsed = parseDelimited(decoded.text, deadline);
    if (!parsed.rows) return { issues: [{ state: parsed.issue?.includes("LIMIT") ? "UNSUPPORTED" : "INVALID_FORMAT", fileId: file.fileId, row: 0, code: parsed.issue ?? "CSV_PARSE_FAILED", severity: "ERROR" }] };
    headers = parsed.rows[0] ?? []; rows = parsed.rows.slice(1);
  } else {
    try { inspectXlsxContainer(bytes); } catch (error) { return { issues: [{ state: "UNSUPPORTED", fileId: file.fileId, row: 0, code: error instanceof Error ? error.message : "XLSX_REFUSED", severity: "ERROR" }] }; }
    const workbook = XLSX.read(bytes, { type: "buffer", raw: true, cellDates: false, cellFormula: true, cellHTML: false, cellNF: false, cellStyles: false, WTF: false });
    if (workbook.SheetNames.length > ONBOARDING_PREPARATION_LIMITS.maxSheets) return { issues: [{ state: "UNSUPPORTED", fileId: file.fileId, row: 0, code: "SHEET_LIMIT_EXCEEDED", severity: "ERROR" }] };
    const hidden = (workbook.Workbook?.Sheets ?? []).find((item) => item.Hidden);
    if (hidden) return { issues: [{ state: "UNSUPPORTED", fileId: file.fileId, row: 0, code: "HIDDEN_SHEET_REFUSED", severity: "ERROR" }] };
    if (workbook.SheetNames.length !== 1) return { issues: [{ state: "AMBIGUOUS", fileId: file.fileId, row: 0, code: "MULTI_SHEET_DOMAIN_FILE_REQUIRES_MAPPING", severity: "ERROR" }] };
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if ((sheet["!merges"] ?? []).length) return { issues: [{ state: "UNSUPPORTED", fileId: file.fileId, row: 0, code: "MERGED_CELLS_REFUSED", severity: "ERROR" }] };
    for (const [address, cell] of Object.entries(sheet)) if (!address.startsWith("!") && (cell as XLSX.CellObject).f) warnings.push({ state: "UNSUPPORTED", fileId: file.fileId, row: XLSX.utils.decode_cell(address).r + 1, fieldId: address, code: "FORMULA_CELL_REFUSED", severity: "ERROR" });
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true, blankrows: false }).map((row) => row.map((value) => String(value ?? "")));
    headers = matrix[0] ?? []; rows = matrix.slice(1);
  }
  const issues = [...warnings, ...tableChecks(file, headers, rows)];
  return { table: { fileId: file.fileId, domain: file.domain, headers, rows, warnings }, issues };
}

export async function packageDigest(rootInput: string, manifest: PackageManifest) {
  const root = await realpath(rootInput); const components: string[] = [];
  for (const file of [...manifest.files].sort((a, b) => a.fileId.localeCompare(b.fileId) || a.relativePath.localeCompare(b.relativePath))) {
    const absolute = path.resolve(root, file.relativePath); const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    if (!absolute.startsWith(rootPrefix)) throw new Error("PATH_CONTAINMENT_REFUSED");
    const metadata = await lstat(absolute);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("NON_REGULAR_FILE_REFUSED");
    const bytes = await readFile(absolute);
    components.push(JSON.stringify([file.fileId, file.relativePath, file.format, file.domain, file.declaredEncoding ?? null, bytes.length, hash(bytes)]));
  }
  return hash(components.join("\n"));
}

export async function validatePackage(rootInput: string): Promise<{ manifest?: PackageManifest; tables: ParsedTable[]; issues: ValidationIssue[]; digest?: string }> {
  const started = Date.now(); const unresolvedRoot = path.resolve(rootInput); const unresolvedStat = await lstat(unresolvedRoot);
  if (!unresolvedStat.isDirectory() || unresolvedStat.isSymbolicLink()) throw new Error("PACKAGE_ROOT_REFUSED");
  const root = await realpath(unresolvedRoot); const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("PACKAGE_ROOT_REFUSED");
  const manifestPath = path.join(root, "manifest.json"); let manifestStat;
  try { manifestStat = await lstat(manifestPath); }
  catch { return { tables: [], issues: [{ state: "MISSING_REQUIRED", fileId: "MANIFEST", row: 0, code: "MANIFEST_FILE_MISSING", severity: "ERROR" }] }; }
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 1024 * 1024) throw new Error("MANIFEST_FILE_REFUSED");
  let raw: unknown;
  try { raw = JSON.parse(await readFile(manifestPath, "utf8")); } catch { return { tables: [], issues: [{ state: "INVALID_FORMAT", fileId: "MANIFEST", row: 0, code: "MANIFEST_JSON_INVALID", severity: "ERROR" }] }; }
  const checked = validateManifest(raw); if (!checked.manifest) return { tables: [], issues: checked.issues };
  const manifest = checked.manifest; const tables: ParsedTable[] = []; const issues = [...checked.issues];
  const expectedEntries = new Set(["manifest.json", ...manifest.files.map((file) => file.relativePath)]);
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!expectedEntries.has(entry.name) || !entry.isFile() || entry.isSymbolicLink()) issues.push({ state: "UNSUPPORTED", fileId: "MANIFEST", row: 0, fieldId: entry.name, code: "UNDECLARED_OR_NON_REGULAR_PACKAGE_ENTRY", severity: "ERROR" });
  }
  for (const file of manifest.files) {
    if (Date.now() - started > ONBOARDING_PREPARATION_LIMITS.maxProcessingMilliseconds) { issues.push({ state: "UNSUPPORTED", fileId: file.fileId, row: 0, code: "PROCESSING_TIME_LIMIT_EXCEEDED", severity: "ERROR" }); break; }
    try { const parsed = await parsePackageFile(root, file, manifest.declaredEncoding, started + ONBOARDING_PREPARATION_LIMITS.maxProcessingMilliseconds); if (parsed.table) tables.push(parsed.table); issues.push(...parsed.issues); }
    catch (error) { issues.push({ state: "INVALID_FORMAT", fileId: file.fileId, row: 0, code: error instanceof Error && error.message.includes("ENOENT") ? "PACKAGE_FILE_MISSING" : "PACKAGE_FILE_READ_FAILED", severity: "ERROR" }); }
  }
  let digest: string;
  try { digest = await packageDigest(root, manifest); }
  catch { issues.push({ state: "CONFLICTING_SOURCE", fileId: "MANIFEST", row: 0, code: "PACKAGE_DIGEST_UNAVAILABLE", severity: "ERROR" }); return { manifest, tables, issues }; }
  if (manifest.sha256.toLowerCase() !== digest) issues.push({ state: "CONFLICTING_SOURCE", fileId: "MANIFEST", row: 0, fieldId: "sha256", code: "PACKAGE_DIGEST_MISMATCH", severity: "ERROR" });
  const actualTotal = manifest.files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (manifest.fileSize !== actualTotal) issues.push({ state: "CONFLICTING_SOURCE", fileId: "MANIFEST", row: 0, fieldId: "fileSize", code: "PACKAGE_TOTAL_SIZE_MISMATCH", severity: "ERROR" });
  return { manifest, tables, issues, digest };
}

function mappingIndex(catalogue: MappingCatalogue) {
  const byDomain = new Map<string, Map<string, MappingEntry>>();
  for (const entry of catalogue.entries) {
    const domain = entry.domain.toUpperCase(); if (!byDomain.has(domain)) byDomain.set(domain, new Map());
    for (const alias of [entry.sourceField, ...entry.sourceAliases]) byDomain.get(domain)!.set(canonicalHeader(alias), entry);
  }
  return byDomain;
}

function proposed(value: string, entry: MappingEntry) {
  const trimmed = value.normalize("NFC").trim();
  if (/CONTROLLED_CODE|UPPERCASE/.test(entry.transformation)) return trimmed.toUpperCase();
  return trimmed;
}

function validDeclaredDate(value: string) {
  const input = value.trim(); let year: number, month: number, day: number;
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input), indianMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
  if (isoMatch) { year = Number(isoMatch[1]); month = Number(isoMatch[2]); day = Number(isoMatch[3]); }
  else if (indianMatch) { year = Number(indianMatch[3]); month = Number(indianMatch[2]); day = Number(indianMatch[1]); }
  else return false;
  const date = new Date(Date.UTC(year, month - 1, day)); return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function paise(value: string): bigint | null { const normalized = value.trim().replaceAll(",", ""); if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return null; const [whole, fraction = ""] = normalized.split("."); return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2)) * (whole.startsWith("-") ? -1n : 1n); }

export async function dryRunPackage(root: string, catalogue: MappingCatalogue): Promise<DryRunResult> {
  const checkedCatalogue = validateMappingCatalogue(catalogue); if (!checkedCatalogue.catalogue) throw new Error(`MAPPING_INVALID:${checkedCatalogue.issues.join(",")}`);
  const validation = await validatePackage(root); if (!validation.manifest || !validation.digest) throw new Error("PACKAGE_MANIFEST_INVALID");
  const index = mappingIndex(catalogue); const issues = [...validation.issues]; const transformations: DryRunResult["transformations"] = []; const duplicates: DryRunResult["duplicates"] = [];
  const sensitive = new Set<string>(); let mappedFields = 0, unmappedFields = 0, rowsReceived = 0, accepted = 0;
  const finances: DryRunResult["financialReconciliation"] = [];
  const identity = new Map<string, { row: number; domain: string }>(); const contacts = new Map<string, { row: number; domain: string }>();
  const values = (domain: string, field: string) => new Set(validation.tables.filter((table) => table.domain.toUpperCase() === domain).flatMap((table) => { const column = table.headers.map(canonicalHeader).indexOf(field); return column < 0 ? [] : table.rows.map((row) => row[column]?.normalize("NFC").trim()).filter(Boolean); }));
  const studentIds = values("STUDENTS", "source_student_id"), guardianIds = values("GUARDIANS", "source_guardian_id"), staffIds = values("STAFF", "source_staff_id"), subjectCodes = values("SCHOOL_ACADEMIC_STRUCTURE", "subject_code");
  const classSections = new Set(validation.tables.filter((table) => table.domain.toUpperCase() === "SCHOOL_ACADEMIC_STRUCTURE").flatMap((table) => { const headers = table.headers.map(canonicalHeader), classColumn = headers.indexOf("class"), sectionColumn = headers.indexOf("section"); return classColumn < 0 || sectionColumn < 0 ? [] : table.rows.map((row) => `${row[classColumn]?.trim().toUpperCase()}::${row[sectionColumn]?.trim().toUpperCase()}`); }));
  for (const table of validation.tables) {
    const domain = table.domain.toUpperCase(); const domainMappings = index.get(domain) ?? new Map(); const normalizedHeaders = table.headers.map(canonicalHeader);
    normalizedHeaders.forEach((header) => { if (domainMappings.has(header)) mappedFields += 1; else { unmappedFields += 1; issues.push({ state: "UNMAPPED_VALUE", fileId: table.fileId, row: 1, fieldId: header, code: "UNMAPPED_HEADER", severity: "REVIEW" }); } if (SENSITIVE_HEADERS.has(header)) sensitive.add(header); });
    let financialTotal = 0n, acceptedFinancialTotal = 0n;
    for (const [rowIndex, row] of table.rows.entries()) {
      rowsReceived += 1; let blocked = false, rowFinancialTotal = 0n; const rowNumber = rowIndex + 2; const rowValues = new Map<string, string>();
      for (const [columnIndex, raw] of row.entries()) {
        const fieldId = normalizedHeaders[columnIndex] ?? `column_${columnIndex + 1}`; const entry = domainMappings.get(fieldId); rowValues.set(fieldId, raw.normalize("NFC").trim());
        if (SENSITIVE_HEADERS.has(fieldId)) { sensitive.add(fieldId); issues.push({ state: "SENSITIVE_REQUIRES_APPROVAL", fileId: table.fileId, row: rowNumber, fieldId, code: "SENSITIVE_FIELD_GATE", severity: "REVIEW" }); }
        if (!entry) continue;
        if (entry.requirement === "REQUIRED" && !raw.trim()) { issues.push({ state: "MISSING_REQUIRED", fileId: table.fileId, row: rowNumber, fieldId, code: "REQUIRED_VALUE_MISSING", severity: "ERROR" }); blocked = true; }
        if (entry.sourceType === "DATE" && raw.trim() && !validDeclaredDate(raw)) { issues.push({ state: "INVALID_FORMAT", fileId: table.fileId, row: rowNumber, fieldId, code: "DECLARED_DATE_INVALID", severity: "ERROR" }); blocked = true; }
        const normalized = proposed(raw, entry); if (normalized !== raw) transformations.push({ fileId: table.fileId, row: rowNumber, fieldId, sourceValue: raw, proposedNormalizedValue: normalized });
        if (IDENTIFIER_HEADERS.has(fieldId) && normalized) {
          const key = `${domain}:${fieldId}:${normalized.toLocaleLowerCase()}`; const prior = identity.get(key);
          if (prior) { duplicates.push({ domain, row: rowNumber, candidateRow: prior.row, signals: [fieldId] }); issues.push({ state: "DUPLICATE_CANDIDATE", fileId: table.fileId, row: rowNumber, fieldId, code: "EXACT_IDENTIFIER_DUPLICATE", severity: "REVIEW" }); } else identity.set(key, { row: rowNumber, domain });
        }
        if (["phone", "mobile", "email", "work_email"].includes(fieldId) && normalized) { const key = `${domain}:${fieldId}:${normalized.toLocaleLowerCase()}`, prior = contacts.get(key); if (prior) { duplicates.push({ domain, row: rowNumber, candidateRow: prior.row, signals: [fieldId, "SUPPORTING_ONLY"] }); issues.push({ state: "DUPLICATE_CANDIDATE", fileId: table.fileId, row: rowNumber, fieldId, code: "SUPPORTING_CONTACT_DUPLICATE", severity: "REVIEW" }); } else contacts.set(key, { row: rowNumber, domain }); }
        if (domain === "FINANCE" && /amount|opening_due|payment_total/.test(fieldId) && raw.trim()) { const amount = paise(raw); if (amount === null) { issues.push({ state: "INVALID_FORMAT", fileId: table.fileId, row: rowNumber, fieldId, code: "FINANCIAL_AMOUNT_INVALID", severity: "ERROR" }); blocked = true; } else { financialTotal += amount; rowFinancialTotal += amount; } }
      }
      const requireReference = (fieldId: string, allowed: Set<string>, code: string) => { const reference = rowValues.get(fieldId); if (reference && !allowed.has(reference)) { issues.push({ state: "UNMAPPED_VALUE", fileId: table.fileId, row: rowNumber, fieldId, code, severity: "ERROR" }); blocked = true; } };
      if (domain === "STUDENTS") { requireReference("source_guardian_id", guardianIds, "GUARDIAN_REFERENCE_UNRESOLVED"); const className = rowValues.get("class"), section = rowValues.get("section"); if (className && section && !classSections.has(`${className.toUpperCase()}::${section.toUpperCase()}`)) { issues.push({ state: "UNMAPPED_VALUE", fileId: table.fileId, row: rowNumber, fieldId: "class", code: "CLASS_SECTION_REFERENCE_UNRESOLVED", severity: "ERROR" }); blocked = true; } }
      if (["ENROLMENT_LIFECYCLE", "FINANCE", "ACADEMIC_HISTORY"].includes(domain)) requireReference("source_student_id", studentIds, "STUDENT_REFERENCE_UNRESOLVED");
      if (domain === "ENROLMENT_LIFECYCLE") { const className = rowValues.get("class"), section = rowValues.get("section"); if (className && section && !classSections.has(`${className.toUpperCase()}::${section.toUpperCase()}`)) { issues.push({ state: "UNMAPPED_VALUE", fileId: table.fileId, row: rowNumber, fieldId: "class", code: "CLASS_SECTION_REFERENCE_UNRESOLVED", severity: "ERROR" }); blocked = true; } }
      if (domain === "ACADEMIC_HISTORY") requireReference("subject_code", subjectCodes, "SUBJECT_REFERENCE_UNRESOLVED");
      if (domain === "DOCUMENTS_MEDIA") { const reference = rowValues.get("record_link_reference"); if (reference && !studentIds.has(reference) && !guardianIds.has(reference) && !staffIds.has(reference)) { issues.push({ state: "UNMAPPED_VALUE", fileId: table.fileId, row: rowNumber, fieldId: "record_link_reference", code: "DOCUMENT_RECORD_REFERENCE_UNRESOLVED", severity: "ERROR" }); blocked = true; } }
      if (domain === "FINANCE" && rowValues.get("reconciliation_state") === "UNEXPLAINED_DIFFERENCE") { issues.push({ state: "CONFLICTING_SOURCE", fileId: table.fileId, row: rowNumber, fieldId: "reconciliation_state", code: "UNEXPLAINED_FINANCIAL_DIFFERENCE", severity: "ERROR" }); blocked = true; }
      if (!blocked) { accepted += 1; acceptedFinancialTotal += rowFinancialTotal; }
    }
    if (domain === "FINANCE") finances.push({ fileId: table.fileId, sourceTotalPaise: financialTotal.toString(), acceptedTotalPaise: acceptedFinancialTotal.toString(), differencePaise: (financialTotal - acceptedFinancialTotal).toString(), state: financialTotal === acceptedFinancialTotal ? "MATCH" : "UNEXPLAINED_DIFFERENCE" });
  }
  const sourceDigestAfter = await packageDigest(root, validation.manifest);
  if (validation.digest !== sourceDigestAfter) throw new Error("SOURCE_MUTATION_DETECTED");
  const hasErrors = issues.some((issue) => issue.severity === "ERROR"); const hasReview = issues.some((issue) => issue.severity === "REVIEW");
  return {
    version: ONBOARDING_PREPARATION_VERSION, packageId: validation.manifest.packageId, packageDigest: validation.digest, sourceDigestAfter,
    validationState: hasErrors ? "INVALID_FORMAT" : hasReview ? "READY_FOR_HUMAN_REVIEW" : "VALID",
    rowsReceived, rowsAcceptedForReview: accepted, issues, duplicates, transformations, mappedFields, unmappedFields, sensitiveFields: [...sensitive].sort(),
    financialReconciliation: finances, proposed: { creates: accepted, updates: 0, links: 0 },
    noWriteProof: { authoritativeWriteCount: 0, databaseAccess: false, networkAccess: false, sourceMutation: false }
  };
}

export function formulaSafe(value: unknown) { const text = String(value ?? ""); return /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text; }
function csvCell(value: unknown) { const safe = formulaSafe(value).replaceAll('"', '""'); return `"${safe}"`; }
function csv(rows: unknown[][]) { return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`; }
async function boundedWrite(file: string, content: string) { if (Buffer.byteLength(content) > ONBOARDING_PREPARATION_LIMITS.maxReportBytes) throw new Error("REPORT_SIZE_LIMIT_EXCEEDED"); await writeFile(file, content, { encoding: "utf8", flag: "wx", mode: 0o600 }); }

export async function writeDryRunReports(outputInput: string, result: DryRunResult) {
  const output = path.resolve(outputInput); await mkdir(path.dirname(output), { recursive: true, mode: 0o700 }); await mkdir(output, { recursive: false, mode: 0o700 });
  const validation = { version: result.version, packageId: result.packageId, packageDigest: result.packageDigest, state: result.validationState, rowsReceived: result.rowsReceived, rowsAcceptedForReview: result.rowsAcceptedForReview, counts: { errors: result.issues.filter((item) => item.severity === "ERROR").length, warnings: result.issues.filter((item) => item.severity === "WARNING").length, review: result.issues.filter((item) => item.severity === "REVIEW").length }, noWriteProof: result.noWriteProof, sourceDigestAfter: result.sourceDigestAfter };
  await boundedWrite(path.join(output, "PACKAGE_VALIDATION.json"), `${JSON.stringify(validation, null, 2)}\n`);
  await boundedWrite(path.join(output, "FIELD_MAPPING_REPORT.csv"), csv([["File ID", "Row", "Field ID", "Source Value", "Proposed Normalized Value"], ...result.transformations.map((item) => [item.fileId, item.row, item.fieldId, item.sourceValue, item.proposedNormalizedValue])]));
  await boundedWrite(path.join(output, "ROW_ERROR_REPORT.csv"), csv([["File ID", "Row", "Field ID", "State", "Code", "Severity"], ...result.issues.map((item) => [item.fileId, item.row, item.fieldId ?? "", item.state, item.code, item.severity])]));
  await boundedWrite(path.join(output, "DUPLICATE_CANDIDATES.csv"), csv([["Domain", "Row", "Candidate Row", "Signals", "Decision"], ...result.duplicates.map((item) => [item.domain, item.row, item.candidateRow, item.signals.join("|"), "NEEDS_MORE_EVIDENCE"])]));
  await boundedWrite(path.join(output, "REFERENCE_ERRORS.csv"), csv([["File ID", "Row", "Field ID", "Code"], ...result.issues.filter((item) => /REFERENCE|ORPHAN/.test(item.code)).map((item) => [item.fileId, item.row, item.fieldId ?? "", item.code])]));
  await boundedWrite(path.join(output, "FINANCIAL_RECONCILIATION.csv"), csv([["File ID", "Source Total Paise", "Accepted Total Paise", "Difference Paise", "State"], ...result.financialReconciliation.map((item) => [item.fileId, item.sourceTotalPaise, item.acceptedTotalPaise, item.differencePaise, item.state])]));
  await boundedWrite(path.join(output, "IMPORT_WAVE_SUMMARY.json"), `${JSON.stringify({ packageId: result.packageId, proposed: result.proposed, actualImports: 0, approvalState: "DRY_RUN_COMPLETE", readyForPrivateStagingImport: false }, null, 2)}\n`);
  await boundedWrite(path.join(output, "APPROVAL_CHECKLIST.md"), "# Dry-run approval checklist\n\n- [ ] Data owner reviewed errors and transformations.\n- [ ] Privacy reviewer decided every sensitive field.\n- [ ] Duplicate candidates have evidence-backed decisions.\n- [ ] Finance differences are MATCH or explained and approved.\n- [ ] Technical operator verified package and mapping hashes.\n- [ ] Final owner approval is recorded before any private-staging import.\n\nThis report records zero authoritative writes and does not authorise import.\n");
  return output;
}

export async function loadMappingCatalogue(file: string) { const parsed = JSON.parse(await readFile(file, "utf8")); const checked = validateMappingCatalogue(parsed); if (!checked.catalogue) throw new Error(`MAPPING_INVALID:${checked.issues.join(",")}`); return checked.catalogue; }

export function syntheticCsv(headers: string[], rows: Array<Array<string | number>>) { return csv([headers, ...rows]); }
export async function createSyntheticPackage(outputInput: string, options: { students?: number; guardians?: number; staff?: number; adversarial?: boolean } = {}) {
  const output = path.resolve(outputInput); await mkdir(path.dirname(output), { recursive: true, mode: 0o700 }); await mkdir(output, { recursive: false, mode: 0o700 }); const studentCount = Math.max(3, Math.min(options.students ?? 120, 1_000)); const guardianCount = Math.max(studentCount, Math.min(options.guardians ?? 160, 1_500)); const staffCount = Math.max(3, Math.min(options.staff ?? 30, 300));
  const files: Array<{ fileId: string; name: string; domain: string; content: string }> = [];
  const studentRows: Array<Array<string | number>> = Array.from({ length: studentCount }, (_, index) => { const number = index + 1; return [`SYN-STU-${String(number).padStart(4, "0")}`, `SYN-ADM-${String(number).padStart(4, "0")}`, `STUDENT-MIGRATION-${String(number).padStart(4, "0")}`, "2015-01-15", number % 2 ? "F" : "M", "2026-27", "I", "A", "ACTIVE", `SYN-GUA-${String((number % guardianCount) + 1).padStart(4, "0")}`]; });
  if (options.adversarial) { studentRows.forEach((row) => row.push("")); studentRows.push(["SYN-STU-0001", "1.234E+10", "=FORMULA-REFUSED", "NOT-A-DATE", "", "2026-27", "UNKNOWN", "A", "ACTIVE", "SYN-GUA-MISSING", "SYNTHETIC-AADHAAR-PROHIBITED"]); }
  const studentHeaders = ["source_student_id", "admission_number", "student_name", "date_of_birth", "gender", "academic_year", "class", "section", "student_status", "source_guardian_id", ...(options.adversarial ? ["aadhaar"] : [])];
  const studentsCsv = syntheticCsv(studentHeaders, studentRows);
  files.push({ fileId: "STUDENTS", name: "students.csv", domain: "STUDENTS", content: options.adversarial ? studentsCsv.replace("\"'=FORMULA-REFUSED\"", "\"=FORMULA-REFUSED\"") : studentsCsv });
  const guardianRows: Array<Array<string | number>> = Array.from({ length: guardianCount }, (_, index) => { const number = index + 1; return [`SYN-GUA-${String(number).padStart(4, "0")}`, `GUARDIAN-MIGRATION-${String(number).padStart(4, "0")}`, number % 2 ? "MOTHER" : "FATHER", `SYN-PHONE-G-${String(number).padStart(4, "0")}`, `guardian-${number}@example.invalid`, number <= studentCount ? "YES" : "NO"]; });
  if (options.adversarial) guardianRows.push(["SYN-GUA-EXTRA", "GUARDIAN-MIGRATION-EXTRA", "OTHER", guardianRows[0][3], "guardian-extra@example.invalid", "NO"]);
  files.push({ fileId: "GUARDIANS", name: "guardians.csv", domain: "GUARDIANS", content: syntheticCsv(["source_guardian_id", "guardian_name", "relationship", "phone", "email", "primary_contact"], guardianRows) });
  const staffRows: Array<Array<string | number>> = Array.from({ length: staffCount }, (_, index) => { const number = index + 1; return [`SYN-STF-${String(number).padStart(4, "0")}`, `SYN-EMP-${String(number).padStart(4, "0")}`, `STAFF-MIGRATION-${String(number).padStart(4, "0")}`, "TEACHER", "ACTIVE", "2024-06-01", `SYN-PHONE-S-${String(number).padStart(4, "0")}`, `staff-${number}@example.invalid`]; });
  if (options.adversarial) staffRows.push(["SYN-STF-LONG", "1.234E+10", "X".repeat(ONBOARDING_PREPARATION_LIMITS.maxCellLength + 1), "TEACHER", "ACTIVE", "2024-06-01", "SYN-PHONE-S-LONG", "staff-long@example.invalid"]);
  files.push({ fileId: "STAFF", name: "staff.csv", domain: "STAFF", content: syntheticCsv(["source_staff_id", "staff_code", "staff_name", "designation", "employment_status", "joining_date", "phone", "work_email"], staffRows) });
  files.push({ fileId: "ACADEMIC", name: "academic-structure.csv", domain: "SCHOOL_ACADEMIC_STRUCTURE", content: syntheticCsv(["academic_year", "class", "section", "subject_code", "subject_name"], [["2026-27", "I", "A", "SYN-MATH-1", "SYNTHETIC MATHEMATICS"]]) });
  files.push({ fileId: "ENROLMENTS", name: "enrolments.csv", domain: "ENROLMENT_LIFECYCLE", content: syntheticCsv(["source_student_id", "academic_year", "class", "section", "effective_date", "lifecycle_state"], studentRows.slice(0, studentCount).map((row) => [row[0], "2026-27", "I", "A", "2026-06-01", "ADMITTED"])) });
  files.push({ fileId: "FINANCE", name: "finance.csv", domain: "FINANCE", content: syntheticCsv(["source_student_id", "opening_due_amount", "source_payment_id", "payment_amount", "receipt_reference", "reconciliation_state"], [["SYN-STU-0001", "1250.50", "SYN-PAY-0001", "250.50", "SYN-RCP-0001", "MATCH"], ...(options.adversarial ? [["SYN-STU-MISSING", "100.00", "SYN-PAY-ORPHAN", "99.99", "SYN-RCP-ORPHAN", "UNEXPLAINED_DIFFERENCE"]] : [])]) });
  files.push({ fileId: "ATTENDANCE", name: "attendance.csv", domain: "ACADEMIC_HISTORY", content: syntheticCsv(["source_student_id", "attendance_date", "attendance_status", "history_classification"], [["SYN-STU-0001", "2026-07-01", "PRESENT", "STRUCTURED_BUT_INCOMPLETE"]]) });
  files.push({ fileId: "MARKS", name: "marks.csv", domain: "ACADEMIC_HISTORY", content: syntheticCsv(["source_student_id", "exam_reference", "subject_code", "marks_value", "history_classification"], [["SYN-STU-0001", "SYN-EXAM-01", "SYN-MATH-1", "82", "STRUCTURED_BUT_INCOMPLETE"]]) });
  files.push({ fileId: "DOCUMENTS", name: "documents-manifest.csv", domain: "DOCUMENTS_MEDIA", content: syntheticCsv(["document_reference", "record_link_reference", "mime_type", "sha256", "consent_state", "retention_decision"], [["SYN-DOC-0001", "SYN-STU-0001", "application/pdf", "0".repeat(64), "REQUIRES_APPROVAL", "UNDECIDED"]]) });
  const packageFiles: PackageFile[] = [];
  for (const item of files) { const bytes = Buffer.from(item.content, "utf8"); await writeFile(path.join(output, item.name), bytes, { flag: "wx", mode: 0o600 }); packageFiles.push({ fileId: item.fileId, relativePath: item.name, sha256: hash(bytes), sizeBytes: bytes.length, format: "CSV", domain: item.domain, declaredEncoding: "UTF-8" }); }
  const components = [...packageFiles].sort((a, b) => a.fileId.localeCompare(b.fileId) || a.relativePath.localeCompare(b.relativePath)).map((file) => JSON.stringify([file.fileId, file.relativePath, file.format, file.domain, file.declaredEncoding ?? null, file.sizeBytes, file.sha256]));
  const manifest: PackageManifest = { schemaVersion: "1.0", packageId: options.adversarial ? "SYNTHETIC-PACKAGE-ADVERSARIAL-1" : "SYNTHETIC-PACKAGE-VALID-1", sourceId: "SYNTHETIC-GENERATOR-1", sourceOwner: "SYNTHETIC-DATA-OWNER", exportingPerson: "SYNTHETIC-GENERATOR", exportTimestamp: "2026-09-01T00:00:00.000Z", receivedTimestamp: "2026-09-01T00:00:00.000Z", originalFilename: "SYNTHETIC-DIRECTORY-PACKAGE", fileSize: packageFiles.reduce((sum, file) => sum + file.sizeBytes, 0), sha256: hash(components.join("\n")), format: "MULTI_FILE", declaredEncoding: "UTF-8", declaredAcademicYears: ["2026-27"], recordDomains: [...new Set(packageFiles.map((file) => file.domain))], confidentiality: "SYNTHETIC_ONLY", transferMethod: "LOCAL_GENERATOR", malwareScanResult: "NOT_APPLICABLE_SYNTHETIC", validationResult: "NOT_RUN", approvalState: "SOURCE_RECEIVED", retentionDeadline: null, supersededPackageReference: null, sourceClassification: "UNVERIFIED", files: packageFiles };
  await writeFile(path.join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return { output, manifest, counts: { students: studentRows.length, guardians: guardianCount, staff: staffCount, files: packageFiles.length } };
}
