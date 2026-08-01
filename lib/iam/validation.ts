import { normalizePermission, isRole, type CanonicalPermission, type Role } from "@/lib/permissions";
import { permissionCanAppearInProfile } from "@/lib/iam/permission-governance";

export function boundedText(value: unknown, label: string, minimum = 1, maximum = 500) {
  const text = String(value ?? "").trim();
  if (text.length < minimum || text.length > maximum) throw new Error(`${label} must be ${minimum}-${maximum} characters`);
  return text;
}

export function optionalBoundedText(value: unknown, label: string, maximum = 200) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > maximum) throw new Error(`${label} must be at most ${maximum} characters`);
  return text;
}

export function reasonText(value: unknown) {
  return boundedText(value, "Reason", 8, 500);
}

export function expectedVersion(value: unknown) {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("Expected version is invalid");
  return version;
}

export function optionalFutureDate(value: unknown, label: string, now = new Date()) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime()) || date <= now) throw new Error(`${label} must be in the future`);
  return date;
}

export function rolesInput(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) throw new Error("One to eight base roles are required");
  const roles = value.map((item) => String(item));
  if (roles.some((role) => !isRole(role))) throw new Error("An unsupported base role was requested");
  if (new Set(roles).size !== roles.length) throw new Error("Duplicate base roles are not allowed");
  return roles as Role[];
}

export function profileEntriesInput(value: unknown) {
  if (!Array.isArray(value) || value.length > 200) throw new Error("Profile entries must contain at most 200 permissions");
  const entries = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Profile entry is invalid");
    const source = item as Record<string, unknown>;
    const permission = normalizePermission(String(source.permission ?? ""));
    const effect = String(source.effect ?? "");
    if (!permission || !["ALLOW", "DENY"].includes(effect)) throw new Error("Profile permission or effect is invalid");
    if (!permissionCanAppearInProfile(permission)) throw new Error(`${permission} cannot be granted or denied by a profile`);
    return { permission, effect: effect as "ALLOW" | "DENY" };
  });
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.permission)) throw new Error("Duplicate or conflicting profile permissions are not allowed");
    seen.add(entry.permission);
  }
  return entries;
}

export function overridesInput(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) throw new Error("Individual overrides must contain at most 100 permissions");
  const entries = value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Individual override is invalid");
    const source = item as Record<string, unknown>;
    const permission = normalizePermission(String(source.permission ?? ""));
    const effect = String(source.effect ?? "");
    if (!permission || !["ALLOW", "DENY"].includes(effect)) throw new Error("Override permission or effect is invalid");
    return { permission, effect: effect as "ALLOW" | "DENY" };
  });
  if (new Set(entries.map((entry) => entry.permission)).size !== entries.length) throw new Error("Duplicate individual overrides are not allowed");
  return entries;
}

export function normalizedProfileName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
}

export function normalizeUsername(value: unknown) {
  const username = boundedText(value, "Username", 3, 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(username)) throw new Error("Username contains unsupported characters");
  return username;
}

export function asCanonicalPermission(value: unknown): CanonicalPermission {
  const permission = normalizePermission(String(value ?? ""));
  if (!permission) throw new Error("Permission is invalid");
  return permission;
}
