import type { Role } from "@/lib/permissions";

export const NOTIFICATION_INTERNAL_PATHS = {
  PARENT: [
    "/parent/homework",
    "/parent/results",
    "/parent/certificates",
    "/parent/class-x-documents",
    "/parent/id-cards",
    "/parent/library",
    "/parent/notifications"
    ,"/parent/student-departures"
  ],
  TEACHER: [
    "/teacher/homework",
    "/teacher/marks",
    "/teacher/report-cards",
    "/teacher/analytics",
    "/teacher/id-card",
    "/teacher/library",
    "/teacher/notifications"
  ],
  STAFF: [
    "/library",
    "/certificates",
    "/report-cards",
    "/homework",
    "/notifications",
    "/receipt-audit"
    ,"/student-departures"
  ]
} as const;

const ALL_PATHS = new Set<string>(Object.values(NOTIFICATION_INTERNAL_PATHS).flat());

export function validateNotificationActionPath(value: unknown) {
  const path = optionalText(value);
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("?") || path.includes("#") || path.includes("\\") || path.includes("..")) {
    throw new Error("Action path must be an allowlisted internal ERP path without query parameters.");
  }
  if (!ALL_PATHS.has(path)) throw new Error("Action path is not approved for in-app notifications.");
  return path;
}

export function notificationPathAllowedForRole(path: string | null, role: Role | string) {
  if (!path) return true;
  if (role === "PARENT") return (NOTIFICATION_INTERNAL_PATHS.PARENT as readonly string[]).includes(path);
  if (role === "TEACHER") return (NOTIFICATION_INTERNAL_PATHS.TEACHER as readonly string[]).includes(path);
  return (NOTIFICATION_INTERNAL_PATHS.STAFF as readonly string[]).includes(path);
}

function optionalText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}
