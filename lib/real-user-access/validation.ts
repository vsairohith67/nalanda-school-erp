import { accessTemplate, roleCombinationWarnings } from "@/lib/real-user-access/catalogue";
import { isRole } from "@/lib/permissions";

export const ACCOUNT_PREPARATION_LIMITS = {
  accountsPerPackage: 50,
  rolesPerAccount: 8,
  scopesPerAccount: 24,
  stringLength: 512,
  requestBytes: 256 * 1024,
  reportRows: 250
} as const;

export type AccountPreparationCandidate = {
  personReference: string;
  personType: "STAFF" | "GUARDIAN" | "STUDENT" | "OTHER";
  username: string;
  email?: string | null;
  roles: string[];
  scopes: string[];
  training: string[];
  mfaRequired: boolean;
  approverReference?: string | null;
};

export type AccountPreparationFinding = { index: number; code: string; field?: string };

export function validateAccountPreparationPackage(input: unknown, existing: { usernames?: readonly string[]; emails?: readonly string[]; personReferences?: readonly string[] } = {}) {
  const bytes = Buffer.byteLength(JSON.stringify(input), "utf8");
  if (bytes > ACCOUNT_PREPARATION_LIMITS.requestBytes) throw new Error("ACCOUNT_PREPARATION_BODY_TOO_LARGE");
  if (!Array.isArray(input) || input.length < 1 || input.length > ACCOUNT_PREPARATION_LIMITS.accountsPerPackage) throw new Error("ACCOUNT_PREPARATION_BATCH_LIMIT");
  const findings: AccountPreparationFinding[] = [];
  const normalizedUsernames = new Map<string, number>();
  const normalizedEmails = new Map<string, number>();
  const normalizedPeople = new Map<string, number>();
  const existingUsers = new Set((existing.usernames ?? []).map(normalizeUsername));
  const existingEmails = new Set((existing.emails ?? []).map(normalizeEmail));
  const existingPeople = new Set(existing.personReferences ?? []);
  const candidates = input.map((raw, index) => {
    const row = asRecord(raw, index);
    const personReference = bounded(row.personReference, "personReference", index, findings, 80);
    const personType = String(row.personType ?? "");
    if (!(["STAFF", "GUARDIAN", "STUDENT", "OTHER"] as const).includes(personType as AccountPreparationCandidate["personType"])) findings.push({ index, code: "INVALID_PERSON_TYPE", field: "personType" });
    const rawUsername = bounded(row.username, "username", index, findings, 80);
    const username = normalizeUsername(rawUsername);
    if (!username || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) || rawUsername.normalize("NFKC").toLowerCase() !== username) findings.push({ index, code: "INVALID_OR_CONFUSABLE_USERNAME", field: "username" });
    const email = row.email == null || row.email === "" ? null : normalizeEmail(bounded(row.email, "email", index, findings, 254));
    if (email && (!/^[^@\s]+@[^@\s]+$/.test(email) || !isReservedSyntheticEmail(email))) findings.push({ index, code: "NON_SYNTHETIC_OR_MALFORMED_EMAIL", field: "email" });
    const roles = boundedArray(row.roles, "roles", index, findings, ACCOUNT_PREPARATION_LIMITS.rolesPerAccount);
    const scopes = boundedArray(row.scopes, "scopes", index, findings, ACCOUNT_PREPARATION_LIMITS.scopesPerAccount);
    const training = boundedArray(row.training, "training", index, findings, 16);
    const mfaRequired = row.mfaRequired === true;
    const approverReference = row.approverReference == null ? null : bounded(row.approverReference, "approverReference", index, findings, 80);
    roles.forEach((role) => { if (!accessTemplate(role)) findings.push({ index, code: "PROHIBITED_OR_UNKNOWN_ROLE", field: "roles" }); });
    if (!roles.some(isRole)) findings.push({ index, code: "BASE_ROLE_REQUIRED", field: "roles" });
    if (personRoleReviewRequired(personType, roles)) findings.push({ index, code: "REVIEW_REQUIRED:MULTI_PERSON_LINK", field: "roles" });
    for (const warning of roleCombinationWarnings(roles)) findings.push({ index, code: warning, field: "roles" });
    if (roles.some((role) => accessTemplate(role)?.mfa === "MANDATORY") && !mfaRequired) findings.push({ index, code: "MISSING_REQUIRED_MFA", field: "mfaRequired" });
    const requiredTraining = roles.flatMap((role) => accessTemplate(role)?.training ?? []);
    if (requiredTraining.some((key) => !training.includes(key))) findings.push({ index, code: "MISSING_REQUIRED_TRAINING", field: "training" });
    if (!approverReference) findings.push({ index, code: "MISSING_APPROVER", field: "approverReference" });
    duplicate(normalizedUsernames, username, index, findings, "DUPLICATE_USERNAME");
    if (email) duplicate(normalizedEmails, email, index, findings, "DUPLICATE_EMAIL");
    duplicate(normalizedPeople, personReference, index, findings, "DUPLICATE_PERSON_LINK");
    if (existingUsers.has(username)) findings.push({ index, code: "USERNAME_ALREADY_EXISTS", field: "username" });
    if (email && existingEmails.has(email)) findings.push({ index, code: "EMAIL_ALREADY_EXISTS", field: "email" });
    if (existingPeople.has(personReference)) findings.push({ index, code: "PERSON_ALREADY_LINKED", field: "personReference" });
    for (const [field, values] of [["scopes", scopes], ["training", training]] as const) if (values.some(csvFormulaRisk)) findings.push({ index, code: "CSV_FORMULA_INJECTION", field });
    return { personReference, personType: personType as AccountPreparationCandidate["personType"], username, email, roles, scopes, training, mfaRequired, approverReference };
  });
  const blockingFindings = findings.filter((finding) => !finding.code.startsWith("REVIEW_REQUIRED:") && !finding.code.startsWith("SEPARATION_OF_DUTIES:"));
  return { mode: "PREVIEW_ONLY" as const, candidates, findings: findings.slice(0, ACCOUNT_PREPARATION_LIMITS.reportRows), valid: blockingFindings.length === 0, blockingCount: blockingFindings.length, truncated: findings.length > ACCOUNT_PREPARATION_LIMITS.reportRows };
}

export function normalizeUsername(value: string) { return value.normalize("NFKC").trim().toLowerCase(); }
export function normalizeEmail(value: string) { return value.normalize("NFKC").trim().toLowerCase(); }
export function csvFormulaRisk(value: string) { return /^[\s\u0000-\u001f]*[=+\-@]/.test(value); }
export function isReservedSyntheticEmail(value: string) { const domain = value.split("@")[1]?.toLowerCase() ?? ""; return domain === "example.com" || domain.endsWith(".example") || domain.endsWith(".test") || domain.endsWith(".invalid"); }

function asRecord(value: unknown, index: number) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`ACCOUNT_PREPARATION_ROW_INVALID:${index}`); return value as Record<string, unknown>; }
function bounded(value: unknown, field: string, index: number, findings: AccountPreparationFinding[], maximum: number) { const text = typeof value === "string" ? value.trim() : ""; if (!text || text.length > maximum || text.length > ACCOUNT_PREPARATION_LIMITS.stringLength) findings.push({ index, code: "INVALID_BOUNDED_TEXT", field }); return text.slice(0, maximum); }
function boundedArray(value: unknown, field: string, index: number, findings: AccountPreparationFinding[], maximum: number) { if (!Array.isArray(value) || value.length < 1 || value.length > maximum || value.some((entry) => typeof entry !== "string" || !entry.trim() || entry.length > ACCOUNT_PREPARATION_LIMITS.stringLength)) { findings.push({ index, code: "INVALID_BOUNDED_ARRAY", field }); return []; } return [...new Set(value.map((entry) => String(entry).trim()))]; }
function duplicate(seen: Map<string, number>, value: string, index: number, findings: AccountPreparationFinding[], code: string) { if (!value) return; if (seen.has(value)) findings.push({ index, code, field: code.includes("EMAIL") ? "email" : code.includes("PERSON") ? "personReference" : "username" }); else seen.set(value, index); }
function personRoleReviewRequired(personType: string, roles: string[]) {
  const allowed = personType === "STAFF" ? new Set(["LEADERSHIP", "STAFF", "ANY_APPROVED_PERSON"])
    : personType === "GUARDIAN" ? new Set(["GUARDIAN", "ANY_APPROVED_PERSON"])
      : personType === "STUDENT" ? new Set(["STUDENT", "ANY_APPROVED_PERSON"])
        : new Set(["ANY_APPROVED_PERSON"]);
  return roles.some((role) => { const intended = accessTemplate(role)?.intendedUserType; return Boolean(intended && !allowed.has(intended)); });
}
