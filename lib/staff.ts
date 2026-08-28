import type { Prisma, PrismaClient } from "@prisma/client";

export const STAFF_TYPES = ["TEACHING", "NON_TEACHING", "ADMIN", "SUPPORT", "OTHER"] as const;
export const STAFF_STATUSES = ["ACTIVE", "INACTIVE", "LEFT"] as const;
class StaffValidationError extends Error {}
export type StaffType = (typeof STAFF_TYPES)[number];
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export const STAFF_IMPORT_COLUMNS = [
  "staffCode", "fullName", "staffType", "designation", "department", "primarySubject",
  "additionalSubjects", "qualification", "experienceYears", "dateOfJoining", "mobile",
  "alternateMobile", "email", "status", "notes"
] as const;

type StaffClient = Pick<PrismaClient | Prisma.TransactionClient, "staffMember">;
type StaffInput = {
  staffCode: string | null; fullName: string; displayName: string | null; staffType: StaffType;
  designation: string; department: string | null; primarySubject: string | null;
  additionalSubjects: string | null; qualification: string | null; experienceYears: number | null;
  dateOfJoining: Date | null; mobile: string | null; alternateMobile: string | null;
  email: string | null; address: string | null; emergencyContactName: string | null;
  emergencyContactMobile: string | null; status: StaffStatus; notes: string | null;
};

export function validateStaffInput(value: unknown): StaffInput {
  const row = record(value);
  const fullName = required(row.fullName, "Full name");
  const designation = required(row.designation, "Designation");
  const staffType = enumValue(row.staffType ?? "TEACHING", STAFF_TYPES, "Staff type");
  const status = enumValue(row.status ?? "ACTIVE", STAFF_STATUSES, "Status");
  const experienceYears = optionalNumber(row.experienceYears, "Experience years");
  if (experienceYears !== null && (experienceYears < 0 || experienceYears > 80)) {
    throw new StaffValidationError("Experience years must be between 0 and 80");
  }
  return {
    staffCode: upperOptional(row.staffCode), fullName, displayName: optional(row.displayName),
    staffType, designation, department: optional(row.department), primarySubject: optional(row.primarySubject),
    additionalSubjects: optional(row.additionalSubjects), qualification: optional(row.qualification),
    experienceYears, dateOfJoining: optionalDate(row.dateOfJoining, "Date of joining"),
    mobile: phone(row.mobile, "Mobile"), alternateMobile: phone(row.alternateMobile, "Alternate mobile"), email: email(row.email),
    address: optional(row.address), emergencyContactName: optional(row.emergencyContactName),
    emergencyContactMobile: phone(row.emergencyContactMobile, "Emergency contact mobile"), status, notes: optional(row.notes)
  };
}

export function buildStaffSearchWhere(input: {
  query?: string; staffType?: string; status?: string; designation?: string; subject?: string;
}): Prisma.StaffMemberWhereInput {
  const query = optional(input.query);
  return {
    ...(STAFF_TYPES.includes(input.staffType as StaffType) ? { staffType: input.staffType } : {}),
    ...(STAFF_STATUSES.includes(input.status as StaffStatus) ? { status: input.status } : {}),
    ...(optional(input.designation) ? { designation: { contains: optional(input.designation)! } } : {}),
    ...(optional(input.subject) ? { OR: [
      { primarySubject: { contains: optional(input.subject)! } },
      { additionalSubjects: { contains: optional(input.subject)! } }
    ] } : {}),
    ...(query ? { AND: [{ OR: [
      { staffCode: { contains: query } }, { fullName: { contains: query } },
      { displayName: { contains: query } }, { mobile: { contains: query } },
      { alternateMobile: { contains: query } }, { email: { contains: query } },
      { primarySubject: { contains: query } }, { additionalSubjects: { contains: query } },
      { designation: { contains: query } }
    ] }] } : {})
  };
}

export type StaffImportPreviewRow = {
  rowNumber: number; normalized: StaffInput; matchId: string | null; matchBy: string | null;
  action: "create" | "update" | "error"; errors: string[]; warnings: string[];
};

export async function buildStaffImportPreview(client: StaffClient, rawRows: unknown[]) {
  const rows: StaffImportPreviewRow[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < rawRows.length; index += 1) {
    const errors: string[] = [];
    const warnings: string[] = [];
    let normalized: StaffInput;
    try { normalized = validateStaffInput(rawRows[index]); }
    catch (error) {
      errors.push(error instanceof Error ? error.message : "Invalid row");
      normalized = fallbackStaffInput(rawRows[index]);
    }
    const identity = normalized.staffCode ? `code:${normalized.staffCode}`
      : normalized.email ? `email:${normalized.email}` : normalized.mobile ? `mobile:${normalized.mobile}` : null;
    if (identity && seen.has(identity)) errors.push("Duplicate staff identity in uploaded file");
    if (identity) seen.add(identity);
    let match: { id: string } | null = null;
    let matchBy: string | null = null;
    if (!errors.length) {
      if (normalized.staffCode) {
        match = await client.staffMember.findUnique({ where: { staffCode: normalized.staffCode }, select: { id: true } });
        if (match) matchBy = "staffCode";
      }
      if (!match && !normalized.staffCode && normalized.email) {
        const matches = await client.staffMember.findMany({ where: { email: normalized.email }, select: { id: true }, take: 2 });
        if (matches.length > 1) errors.push("Multiple existing staff profiles use this email; add a staff code before importing");
        else if (matches[0]) { match = matches[0]; matchBy = "email"; }
      }
      if (!match && !errors.length && !normalized.staffCode && normalized.mobile) {
        const matches = await client.staffMember.findMany({ where: { mobile: normalized.mobile }, select: { id: true }, take: 2 });
        if (matches.length > 1) errors.push("Multiple existing staff profiles use this mobile; add a staff code before importing");
        else if (matches[0]) { match = matches[0]; matchBy = "mobile"; }
      }
    }
    if (!normalized.staffCode) warnings.push("No staff code; matching uses email, then mobile");
    rows.push({ rowNumber: index + 2, normalized, matchId: match?.id ?? null, matchBy,
      action: errors.length ? "error" : match ? "update" : "create", errors, warnings });
  }
  return {
    rows,
    counts: {
      total: rows.length, created: rows.filter((row) => row.action === "create").length,
      updated: rows.filter((row) => row.action === "update").length,
      skipped: 0, errors: rows.filter((row) => row.errors.length).length,
      warnings: rows.reduce((sum, row) => sum + row.warnings.length, 0)
    }
  };
}

export async function applyStaffImport(client: StaffClient, preview: Awaited<ReturnType<typeof buildStaffImportPreview>>) {
  let created = 0; let updated = 0; let skipped = 0;
  const errors: string[] = [];
  for (const row of preview.rows) {
    if (row.errors.length) { skipped += 1; errors.push(`CSV Row ${row.rowNumber}: ${row.errors.join("; ")}`); continue; }
    try {
      if (row.matchId) { await client.staffMember.update({ where: { id: row.matchId }, data: row.normalized }); updated += 1; }
      else { await client.staffMember.create({ data: row.normalized }); created += 1; }
    } catch (error) { skipped += 1; errors.push(`CSV Row ${row.rowNumber}: ${friendlyStaffError(error)}`); }
  }
  return { created, updated, skipped, errors };
}

export function friendlyStaffError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to save staff member";
  if (error instanceof StaffValidationError) return message;
  if (message.includes("Unique constraint") && message.includes("staffCode")) return "Staff code is already in use";
  if (message.includes("Unique constraint") && message.includes("userId")) return "This Teacher login is already linked to another staff profile";
  if (message.includes("Unique constraint") && message.includes("timetableTeacherId")) return "This timetable teacher is already linked to another staff profile";
  if (message.includes("Unique constraint")) return "A staff code or optional link is already in use";
  return "Unable to save staff member. Review the fields and try again.";
}

function fallbackStaffInput(value: unknown): StaffInput {
  const row = record(value);
  return { staffCode: upperOptional(row.staffCode), fullName: optional(row.fullName) ?? "",
    displayName: null, staffType: "TEACHING", designation: optional(row.designation) ?? "",
    department: optional(row.department), primarySubject: optional(row.primarySubject),
    additionalSubjects: optional(row.additionalSubjects), qualification: optional(row.qualification),
    experienceYears: null, dateOfJoining: null, mobile: safeFallbackPhone(row.mobile), alternateMobile: safeFallbackPhone(row.alternateMobile),
    email: safeFallbackEmail(row.email), address: null, emergencyContactName: null, emergencyContactMobile: null,
    status: "ACTIVE", notes: optional(row.notes) };
}
function record(value: unknown) { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function required(value: unknown, label: string) { const text = String(value ?? "").trim(); if (!text) throw new StaffValidationError(`${label} is required`); return text; }
function optional(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
function upperOptional(value: unknown) { return optional(value)?.toUpperCase() ?? null; }
function phone(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^[+\d\s().-]+$/.test(text)) throw new StaffValidationError(`${label} contains unsupported characters`);
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) throw new StaffValidationError(`${label} must contain 7 to 15 digits`);
  return digits;
}
function safeFallbackPhone(value: unknown) { const digits = String(value ?? "").replace(/\D/g, ""); return digits || null; }
function email(value: unknown) { const text = optional(value)?.toLowerCase() ?? null; if (text && !/^\S+@\S+\.\S+$/.test(text)) throw new StaffValidationError("Email is invalid"); return text; }
function safeFallbackEmail(value: unknown) { return optional(value)?.toLowerCase() ?? null; }
function optionalNumber(value: unknown, label: string) { if (value === undefined || value === null || String(value).trim() === "") return null; const result = Number(value); if (!Number.isFinite(result)) throw new StaffValidationError(`${label} must be a number`); return result; }
function optionalDate(value: unknown, label: string) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (!match) throw new StaffValidationError(`${label} must use YYYY-MM-DD or DD/MM/YYYY`);
  const year = Number(match[1] ?? match[6]); const month = Number(match[2] ?? match[5]); const day = Number(match[3] ?? match[4]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new StaffValidationError(`${label} is invalid`);
  return date;
}
function enumValue<T extends readonly string[]>(value: unknown, values: T, label: string) { const text = String(value ?? "").trim().toUpperCase().replace(/[ -]+/g, "_"); if (!values.includes(text)) throw new StaffValidationError(`${label} is invalid`); return text as T[number]; }
