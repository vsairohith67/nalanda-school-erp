import type { Prisma, PrismaClient } from "@prisma/client";

export const AUTH_ALIAS_TYPES = [
  "USERNAME",
  "WORK_EMAIL",
  "PERSONAL_EMAIL",
  "MOBILE",
  "ADMISSION_NUMBER"
] as const;

export type AuthAliasType = typeof AUTH_ALIAS_TYPES[number];
export type RecoveryChannelType = Extract<AuthAliasType, "WORK_EMAIL" | "PERSONAL_EMAIL" | "MOBILE">;

export function isAuthAliasType(value: string): value is AuthAliasType {
  return (AUTH_ALIAS_TYPES as readonly string[]).includes(value);
}

export function isRecoveryChannelType(value: string): value is RecoveryChannelType {
  return value === "WORK_EMAIL" || value === "PERSONAL_EMAIL" || value === "MOBILE";
}

export function normalizeAliasValue(type: AuthAliasType, raw: string) {
  const value = raw.normalize("NFKC").trim();
  if (!value || value.length > 254 || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Enter a valid login identifier");
  }
  if (type === "USERNAME") {
    const normalized = value.toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(normalized)) throw new Error("Enter a valid username");
    return normalized;
  }
  if (type === "WORK_EMAIL" || type === "PERSONAL_EMAIL") {
    const normalized = value.toLowerCase();
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(normalized)) {
      throw new Error("Enter a valid email address");
    }
    return normalized;
  }
  if (type === "MOBILE") {
    const normalized = value.replace(/[ ()-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new Error("Use an international mobile number such as +919876543210");
    }
    return normalized;
  }
  const normalized = value.toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9/-]{1,63}$/.test(normalized)) {
    throw new Error("Enter a valid admission number");
  }
  return normalized;
}

export function loginIdentifierCandidates(raw: string) {
  const candidates = new Set<string>();
  for (const type of AUTH_ALIAS_TYPES) {
    try {
      candidates.add(normalizeAliasValue(type, raw));
    } catch {}
  }
  return [...candidates];
}

export function maskAlias(type: AuthAliasType, normalizedValue: string) {
  if (type === "USERNAME" || type === "ADMISSION_NUMBER") return normalizedValue;
  if (type === "MOBILE") return `${normalizedValue.slice(0, 3)}•••••${normalizedValue.slice(-3)}`;
  const [local, domain] = normalizedValue.split("@");
  const localMask = local.length <= 2 ? `${local.slice(0, 1)}•` : `${local.slice(0, 2)}•••`;
  const [domainName, ...suffix] = domain.split(".");
  return `${localMask}@${domainName.slice(0, 1)}•••${suffix.length ? `.${suffix.join(".")}` : ""}`;
}

export type ResolvedLoginAlias = Prisma.AuthLoginAliasGetPayload<{
  include: { user: true };
}>;

type AliasLookup = Pick<PrismaClient, "authLoginAlias">;

export async function resolveLoginIdentifier(client: AliasLookup, identifier: string) {
  const candidates = loginIdentifierCandidates(identifier);
  if (!candidates.length) return { kind: "missing" as const };
  const rows = await client.authLoginAlias.findMany({
    where: { normalizedValue: { in: candidates }, status: "VERIFIED" },
    include: { user: true },
    take: 3
  });
  const eligible = rows.filter((row) =>
    row.type !== "ADMISSION_NUMBER" || (row.isSchoolGoverned && Boolean(row.admissionStudentId))
  );
  if (eligible.length !== 1) {
    return { kind: eligible.length > 1 ? "ambiguous" as const : "missing" as const };
  }
  return { kind: "resolved" as const, alias: eligible[0], user: eligible[0].user };
}

export function aliasTypeLabel(type: string) {
  return ({
    USERNAME: "Username",
    WORK_EMAIL: "Work email",
    PERSONAL_EMAIL: "Personal email",
    MOBILE: "Mobile",
    ADMISSION_NUMBER: "Admission number"
  } as Record<string, string>)[type] ?? "Login identifier";
}
