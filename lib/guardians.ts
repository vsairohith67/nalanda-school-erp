import type { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { validateNewPassword } from "@/lib/user-management";
import { GUARDIAN_RELATIONSHIPS, type GuardianRelationship, type GuardianStatus } from "@/lib/guardian-constants";
import { maskAlias, normalizeAliasValue } from "@/lib/auth-identifiers";
export type GuardianImportRow = Record<string, unknown>;

export type GuardianImportStudent = {
  id: string;
  admissionNo: string;
  studentName: string;
  className: string;
  section: string | null;
};

export type GuardianImportExistingGuardian = {
  id: string;
  displayName: string;
  primaryMobile: string;
  email: string | null;
};

export type NormalizedGuardianImport = {
  admissionNo: string;
  studentName: string | null;
  guardianName: string;
  mobile: string;
  alternateMobile: string | null;
  email: string | null;
  relationship: GuardianRelationship;
  isPrimaryContact: boolean;
  canViewFees: boolean;
  canReceiveReminders: boolean;
};

export type GuardianImportPreviewRow = {
  rowNumber: number;
  normalized: NormalizedGuardianImport;
  matchedStudent: GuardianImportStudent | null;
  matchedGuardian: GuardianImportExistingGuardian | null;
  guardianMatchKey: string;
  duplicateUploadKey: boolean;
  existingLink: boolean;
  errors: string[];
  warnings: string[];
  originalValues: GuardianImportRow;
};

export type GuardianImportPreview = {
  rows: GuardianImportPreviewRow[];
  fileWarnings: string[];
  counts: {
    total: number;
    valid: number;
    errors: number;
    warnings: number;
    matchedGuardians: number;
    newGuardians: number;
    existingLinks: number;
  };
};

export type GuardianImportResult = {
  guardiansCreated: number;
  guardiansReused: number;
  linksCreated: number;
  linksUpdated: number;
  linksSkipped: number;
  errors: GuardianImportErrorRow[];
  warnings: string[];
};

export type GuardianImportErrorRow = {
  rowNumber: number;
  admissionNo: string;
  guardianName: string;
  mobile: string;
  reason: string;
  originalValuesJson: string;
};

type GuardianClient = Pick<PrismaClient | Prisma.TransactionClient, "guardian" | "student" | "studentGuardian" | "user" | "authLoginAlias">;

export function guardianSearchWhere(query: string | null | undefined): Prisma.GuardianWhereInput {
  const q = cleanText(query);
  if (!q) return {};
  return {
    OR: [
      { displayName: { contains: q } },
      { primaryMobile: { contains: q } },
      { alternateMobile: { contains: q } },
      { email: { contains: q } },
      { students: { some: { student: { admissionNo: { contains: q } } } } },
      { students: { some: { student: { studentName: { contains: q } } } } }
    ]
  };
}

const FIELD_ALIASES: Record<string, keyof NormalizedGuardianImport> = {
  admissionno: "admissionNo",
  admno: "admissionNo",
  admissionnumber: "admissionNo",
  studentname: "studentName",
  nameofthestudent: "studentName",
  guardianname: "guardianName",
  parentname: "guardianName",
  name: "guardianName",
  fathername: "guardianName",
  mothername: "guardianName",
  mobile: "mobile",
  mobilenumber: "mobile",
  phoneno: "mobile",
  phone: "mobile",
  primarymobile: "mobile",
  alternatemobile: "alternateMobile",
  alternatephone: "alternateMobile",
  phone2: "alternateMobile",
  email: "email",
  emailid: "email",
  relationship: "relationship",
  relation: "relationship",
  relationshiptostudent: "relationship",
  isprimarycontact: "isPrimaryContact",
  primarycontact: "isPrimaryContact",
  primary: "isPrimaryContact",
  canviewfees: "canViewFees",
  viewfees: "canViewFees",
  canreceivereminders: "canReceiveReminders",
  receivereminders: "canReceiveReminders",
  reminders: "canReceiveReminders"
};

export function normalizeGuardianImportRows(
  rawRows: GuardianImportRow[],
  students: GuardianImportStudent[],
  existingGuardians: GuardianImportExistingGuardian[] = [],
  existingLinks: Array<{ guardianId: string; studentId: string }> = []
): GuardianImportPreview {
  const studentsByAdmission = new Map(students.map((student) => [student.admissionNo.toLowerCase(), student]));
  const guardiansByMobile = new Map(existingGuardians.map((guardian) => [guardianMatchMobile(guardian.primaryMobile), guardian]));
  const guardiansByEmail = new Map(
    existingGuardians
      .filter((guardian) => guardian.email)
      .map((guardian) => [guardian.email!.toLowerCase(), guardian])
  );
  const existingLinkKeys = new Set(existingLinks.map((link) => `${link.guardianId}:${link.studentId}`));
  const seenGuardianKeys = new Set<string>();
  const unknownHeaders = new Set<string>();

  const rows = rawRows.map((raw, index) => {
    const mapped: Partial<NormalizedGuardianImport> = {};
    for (const [header, value] of Object.entries(raw)) {
      const field = FIELD_ALIASES[normalizeHeader(header)];
      if (!field) {
        if (header.trim()) unknownHeaders.add(header.trim());
        continue;
      }
      (mapped as Record<string, unknown>)[field] = value;
    }

    const admissionNo = cleanText(mapped.admissionNo);
    const mobile = normalizeMobileForStorage(mapped.mobile);
    const email = normalizeEmail(mapped.email);
    const rawRelationship = cleanText(mapped.relationship);
    const relationship = normalizeRelationship(mapped.relationship);
    const normalized: NormalizedGuardianImport = {
      admissionNo,
      studentName: cleanText(mapped.studentName) || null,
      guardianName: normalizePersonName(mapped.guardianName),
      mobile,
      alternateMobile: normalizeMobileForStorage(mapped.alternateMobile) || null,
      email,
      relationship,
      isPrimaryContact: parseBoolean(mapped.isPrimaryContact, false),
      canViewFees: parseBoolean(mapped.canViewFees, true),
      canReceiveReminders: parseBoolean(mapped.canReceiveReminders, true)
    };

    const errors: string[] = [];
    const warnings: string[] = [];
    const matchedStudent = admissionNo ? studentsByAdmission.get(admissionNo.toLowerCase()) ?? null : null;
    const matchedGuardian = mobile
      ? guardiansByMobile.get(guardianMatchMobile(mobile)) ?? (email ? guardiansByEmail.get(email.toLowerCase()) ?? null : null)
      : email ? guardiansByEmail.get(email.toLowerCase()) ?? null : null;
    const guardianMatchKey = guardianKey(normalized);
    const duplicateUploadKey = seenGuardianKeys.has(guardianMatchKey);
    seenGuardianKeys.add(guardianMatchKey);

    if (!admissionNo) errors.push("Missing admissionNo (student admission number is required).");
    if (admissionNo && !matchedStudent) errors.push(`Admission number ${admissionNo} was not found in Student Master.`);
    if (!normalized.guardianName) errors.push("Missing guardianName");
    if (!mobile) errors.push("Missing mobile");
    if (email && !email.includes("@")) warnings.push("Email does not look complete; it will still be stored for review.");
    if (matchedStudent && normalized.studentName && normalizeNameForMatch(normalized.studentName) !== normalizeNameForMatch(matchedStudent.studentName)) {
      warnings.push(`Student name does not match admission ${matchedStudent.admissionNo}; matched database student ${matchedStudent.studentName}.`);
    }
    if (duplicateUploadKey) warnings.push("Same guardian mobile/email appears earlier in this upload; this row will link another student to the same guardian.");
    if (rawRelationship && relationship === "Other" && rawRelationship.toLowerCase() !== "other") {
      warnings.push("Unsupported relationship was changed to Other.");
    }

    const existingLink = Boolean(matchedGuardian && matchedStudent && existingLinkKeys.has(`${matchedGuardian.id}:${matchedStudent.id}`));
    if (existingLink) warnings.push("Guardian is already linked to this student; settings may be updated on confirm.");

    return {
      rowNumber: index + 2,
      normalized,
      matchedStudent,
      matchedGuardian,
      guardianMatchKey,
      duplicateUploadKey,
      existingLink,
      errors,
      warnings,
      originalValues: raw
    };
  });

  const fileWarnings = unknownHeaders.size
    ? [`Unknown optional columns ignored: ${[...unknownHeaders].join(", ")}`]
    : [];
  return {
    rows,
    fileWarnings,
    counts: {
      total: rows.length,
      valid: rows.filter((row) => !row.errors.length).length,
      errors: rows.filter((row) => row.errors.length).length,
      warnings: rows.reduce((sum, row) => sum + row.warnings.length, 0) + fileWarnings.length,
      matchedGuardians: rows.filter((row) => row.matchedGuardian).length,
      newGuardians: new Set(
        rows
          .filter((row) => !row.matchedGuardian && !row.errors.length)
          .map((row) => row.guardianMatchKey)
      ).size,
      existingLinks: rows.filter((row) => row.existingLink).length
    }
  };
}

export async function buildGuardianImportPreview(client: GuardianClient, rawRows: GuardianImportRow[]) {
  const [students, guardians, links] = await Promise.all([
    client.student.findMany({
      where: { deletedAt: null },
      select: { id: true, admissionNo: true, studentName: true, className: true, section: true }
    }),
    client.guardian.findMany({
      select: { id: true, displayName: true, primaryMobile: true, email: true }
    }),
    client.studentGuardian.findMany({ select: { guardianId: true, studentId: true } })
  ]);
  return normalizeGuardianImportRows(rawRows, students, guardians, links);
}

export async function importGuardianLinks(client: GuardianClient, preview: GuardianImportPreview): Promise<GuardianImportResult> {
  const result: GuardianImportResult = {
    guardiansCreated: 0,
    guardiansReused: 0,
    linksCreated: 0,
    linksUpdated: 0,
    linksSkipped: 0,
    errors: [],
    warnings: [...preview.fileWarnings]
  };
  const guardianIdsByKey = new Map<string, string>();

  for (const row of preview.rows) {
    if (row.errors.length || !row.matchedStudent) {
      result.errors.push(errorRow(row, row.errors.join("; ") || "Unable to match row"));
      continue;
    }
    try {
      let guardianId = row.matchedGuardian?.id ?? guardianIdsByKey.get(row.guardianMatchKey);
      if (!guardianId) {
        const guardian = await client.guardian.create({
          data: {
            displayName: row.normalized.guardianName,
            primaryMobile: row.normalized.mobile,
            alternateMobile: row.normalized.alternateMobile,
            email: row.normalized.email,
            relationship: row.normalized.relationship,
            status: "Active"
          }
        });
        guardianId = guardian.id;
        guardianIdsByKey.set(row.guardianMatchKey, guardian.id);
        result.guardiansCreated += 1;
      } else {
        result.guardiansReused += 1;
      }

      if (row.normalized.isPrimaryContact) {
        await client.studentGuardian.updateMany({
          where: { studentId: row.matchedStudent.id, guardianId: { not: guardianId } },
          data: { isPrimaryContact: false }
        });
      }

      const existing = await client.studentGuardian.findUnique({
        where: { guardianId_studentId: { guardianId, studentId: row.matchedStudent.id } }
      });
      const linkData = {
        relationshipToStudent: row.normalized.relationship,
        isPrimaryContact: row.normalized.isPrimaryContact,
        canViewFees: row.normalized.canViewFees,
        canReceiveReminders: row.normalized.canReceiveReminders
      };
      if (existing) {
        if (
          existing.relationshipToStudent === linkData.relationshipToStudent &&
          existing.isPrimaryContact === linkData.isPrimaryContact &&
          existing.canViewFees === linkData.canViewFees &&
          existing.canReceiveReminders === linkData.canReceiveReminders
        ) {
          result.linksSkipped += 1;
        } else {
          await client.studentGuardian.update({
            where: { guardianId_studentId: { guardianId, studentId: row.matchedStudent.id } },
            data: linkData
          });
          result.linksUpdated += 1;
        }
      } else {
        await client.studentGuardian.create({
          data: {
            guardianId,
            studentId: row.matchedStudent.id,
            ...linkData
          }
        });
        result.linksCreated += 1;
      }
      result.warnings.push(...row.warnings.map((warning) => `CSV Row ${row.rowNumber}: ${warning}`));
    } catch (error) {
      result.errors.push(errorRow(row, error instanceof Error ? error.message : "Unable to import guardian link"));
    }
  }

  return result;
}

export async function createParentUserFromGuardian(
  client: GuardianClient,
  guardianId: string,
  input: { username: string; email?: string | null; password: string }
) {
  const guardian = await client.guardian.findUnique({
    where: { id: guardianId },
    include: { users: true }
  });
  if (!guardian) throw new Error("Guardian not found");
  if (guardian.users.some((user) => user.role === "PARENT")) {
    throw new Error("This guardian already has a linked parent login");
  }
  const username = normalizeAliasValue("USERNAME", cleanText(input.username));
  validateNewPassword(input.password);
  const created = await client.user.create({
    data: {
      name: guardian.displayName,
      username,
      email: normalizeEmail(input.email ?? guardian.email),
      passwordHash: await hashPassword(input.password),
      role: "PARENT",
      isActive: true,
      guardianId
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      guardianId: true
    }
  });
  await client.authLoginAlias.create({
    data: {
      id: `auth2b_username_${created.id}`,
      userId: created.id,
      type: "USERNAME",
      normalizedValue: username,
      displayMasked: maskAlias("USERNAME", username),
      status: "VERIFIED",
      isSchoolGoverned: true,
      verifiedAt: new Date()
    }
  });
  return created;
}

export async function linkExistingParentUser(
  client: GuardianClient,
  guardianId: string,
  username: string
) {
  const guardian = await client.guardian.findUnique({ where: { id: guardianId }, include: { users: true } });
  if (!guardian) throw new Error("Guardian not found");
  if (guardian.users.some((user) => user.role === "PARENT")) {
    throw new Error("This guardian already has a linked parent login");
  }
  const user = await client.user.findUnique({ where: { username: cleanText(username).toLowerCase() } });
  if (!user) throw new Error("Parent user not found");
  if (user.role !== "PARENT") throw new Error("Only PARENT users can be linked to guardians");
  return client.user.update({
    where: { id: user.id },
    data: { guardianId },
    select: { id: true, name: true, username: true, email: true, role: true, isActive: true, guardianId: true }
  });
}

export function validateGuardianPayload(input: Record<string, unknown>) {
  const displayName = normalizePersonName(input.displayName);
  const primaryMobile = normalizeMobileForStorage(input.primaryMobile);
  const relationship = normalizeRelationship(input.relationship);
  const status = normalizeStatus(input.status);
  if (!displayName) throw new Error("Guardian name is required");
  if (!primaryMobile) throw new Error("Primary mobile is required");
  return {
    displayName,
    primaryMobile,
    alternateMobile: normalizeMobileForStorage(input.alternateMobile) || null,
    email: normalizeEmail(input.email),
    relationship,
    status,
    notes: cleanText(input.notes) || null
  };
}

export function guardianImportTemplateCsv() {
  return [
    [
      "admissionNo",
      "studentName",
      "guardianName",
      "mobile",
      "alternateMobile",
      "email",
      "relationship",
      "isPrimaryContact",
      "canViewFees",
      "canReceiveReminders"
    ].join(","),
    [
      "NPS26001",
      "Aarav Reddy",
      "Suresh Reddy",
      "9000000001",
      "9000000101",
      "parent@example.com",
      "Father",
      "yes",
      "yes",
      "yes"
    ].map(csvCell).join(",")
  ].join("\r\n");
}

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function normalizeMobileForStorage(value: unknown) {
  const text = cleanText(value).replace(/[\s().-]/g, "");
  if (!text) return "";
  if (/^\+?\d+$/.test(text)) {
    let digits = text.replace(/^\+/, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    return digits;
  }
  return text;
}

function guardianMatchMobile(value: unknown) {
  return normalizeMobileForStorage(value).toLowerCase();
}

function guardianKey(row: NormalizedGuardianImport) {
  return row.mobile ? `mobile:${guardianMatchMobile(row.mobile)}` : `email:${row.email?.toLowerCase() ?? ""}`;
}

function normalizeEmail(value: unknown) {
  const text = cleanText(value).toLowerCase();
  return text || null;
}

function normalizeRelationship(value: unknown): GuardianRelationship {
  const text = cleanText(value).toLowerCase();
  if (!text) return "Parent";
  const found = GUARDIAN_RELATIONSHIPS.find((item) => item.toLowerCase() === text);
  return found ?? "Other";
}

function normalizeStatus(value: unknown): GuardianStatus {
  const text = cleanText(value).toLowerCase();
  return text === "inactive" ? "Inactive" : "Active";
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const text = cleanText(value).toLowerCase();
  if (["true", "yes", "y", "1", "primary"].includes(text)) return true;
  if (["false", "no", "n", "0"].includes(text)) return false;
  return fallback;
}

function normalizePersonName(value: unknown) {
  const text = cleanText(value).replace(/\s+/g, " ");
  if (!text || text !== text.toUpperCase()) return text;
  return text.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function normalizeNameForMatch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function errorRow(row: GuardianImportPreviewRow, reason: string): GuardianImportErrorRow {
  return {
    rowNumber: row.rowNumber,
    admissionNo: row.normalized.admissionNo,
    guardianName: row.normalized.guardianName,
    mobile: row.normalized.mobile,
    reason,
    originalValuesJson: JSON.stringify(row.originalValues)
  };
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}
