import {
  PERMISSIONS,
  normalizePermission,
  type CanonicalPermission,
  type Role
} from "@/lib/permissions";

export type PermissionDelegability =
  | "ORDINARY_DELEGABLE"
  | "LEADERSHIP_RESTRICTED"
  | "SUPER_ADMIN_ONLY_NON_DELEGABLE"
  | "OBJECT_SCOPED";

export const SUPER_ADMIN_ONLY_PERMISSIONS = new Set<CanonicalPermission>([
  "GRANT_SUPER_ADMIN",
  "MANAGE_ROLE_PERMISSIONS",
  "FIRST_RUN_SETUP",
  "RUN_RESTORE",
  "ACTIVATE_LIVE_CLOUD_BACKUP",
  "CHANGE_CLOUD_BACKUP_KEY_VERSION",
  "PURGE_CLOUD_BACKUPS"
]);

export const CRITICAL_SUPER_ADMIN_PERMISSIONS = new Set<CanonicalPermission>([
  ...SUPER_ADMIN_ONLY_PERMISSIONS,
  "VIEW_IAM_ACCESS",
  "MANAGE_IAM_USERS",
  "MANAGE_PERMISSION_PROFILES",
  "ASSIGN_PERMISSION_PROFILES",
  "MANAGE_USER_PERMISSION_OVERRIDES",
  "VIEW_IAM_AUDIT",
  "DELEGATE_IAM_ACCESS"
]);

export const LEADERSHIP_RESTRICTED_PERMISSIONS = new Set<CanonicalPermission>([
  "MANAGE_IAM_USERS",
  "MANAGE_PERMISSION_PROFILES",
  "ASSIGN_PERMISSION_PROFILES",
  "MANAGE_USER_PERMISSION_OVERRIDES",
  "DELEGATE_IAM_ACCESS",
  "RESET_USER_PASSWORDS",
  "APPROVE_STUDENT_PROGRESSION",
  "FINALIZE_STUDENT_PROGRESSION",
  "APPROVE_EXPENSES",
  "LOCK_BUDGETS",
  "APPROVE_CASH_BOOK",
  "LOCK_CASH_BOOK",
  "APPROVE_MARKS",
  "LOCK_EXAMS",
  "INTERVENE_EXAM_SCHEMES",
  "INTERVENE_EXAM_MARKS"
]);

export const OBJECT_SCOPED_PERMISSIONS = new Set<CanonicalPermission>([
  ...PERMISSIONS.filter((permission) => permission.includes("_OWN_") || permission.startsWith("VIEW_OWN_")),
  "REQUEST_OWN_CHILD_CERTIFICATES",
  "VIEW_OWN_CHILD_CERTIFICATES",
  "REQUEST_OWN_CHILD_CLASS_X_PACKAGE",
  "VIEW_OWN_CHILD_CLASS_X_PACKAGE",
  "ENTER_ASSIGNED_EXAM_MARKS",
  "SUBMIT_ASSIGNED_EXAM_MARKS",
  "REQUEST_EXAM_MARK_CORRECTION",
  "MANAGE_STUDENT_ATTENDANCE",
  "SUBMIT_STUDENT_ATTENDANCE",
  "VIEW_STUDENT_ATTENDANCE_REPORTS",
  "MANAGE_HOMEWORK",
  "PUBLISH_HOMEWORK",
  "VIEW_PAYMENTS",
  "EDIT_PAYMENTS",
  "CANCEL_PAYMENTS",
  "RESTORE_PAYMENTS",
  "VIEW_LEDGER"
]);

const VIEWER_IMMUTABLE_DENIALS = new Set<CanonicalPermission>([
  "VIEW_LIBRARY_STOCK_VERIFICATION",
  "VIEW_LEDGER",
  "PRINT_LEDGER",
  ...PERMISSIONS.filter((permission) => permission.startsWith("EXPORT_"))
]);

const COMPUTER_OPERATOR_IMMUTABLE_DENIALS = new Set<CanonicalPermission>([
  "MANAGE_ROLE_PERMISSIONS",
  "GRANT_SUPER_ADMIN",
  "DELEGATE_IAM_ACCESS",
  "MANAGE_PERMISSION_PROFILES",
  "ASSIGN_PERMISSION_PROFILES",
  "MANAGE_USER_PERMISSION_OVERRIDES",
  "RUN_RESTORE",
  "MANAGE_SCHOOL_SETTINGS",
  ...PERMISSIONS.filter((permission) => /PAYMENT|EXPENSE|BUDGET|CASH_BOOK|BOOKS_FINANCE|MISC_INCOME/.test(permission))
]);

export function permissionDelegability(permission: CanonicalPermission): PermissionDelegability {
  if (SUPER_ADMIN_ONLY_PERMISSIONS.has(permission)) return "SUPER_ADMIN_ONLY_NON_DELEGABLE";
  if (OBJECT_SCOPED_PERMISSIONS.has(permission)) return "OBJECT_SCOPED";
  if (LEADERSHIP_RESTRICTED_PERMISSIONS.has(permission)) return "LEADERSHIP_RESTRICTED";
  return "ORDINARY_DELEGABLE";
}

export function immutablePermissionDenial(role: Role, rawPermission: string) {
  const permission = normalizePermission(rawPermission);
  if (!permission) return "Unknown permissions always default to deny.";
  if (role !== "SUPER_ADMIN" && SUPER_ADMIN_ONLY_PERMISSIONS.has(permission)) {
    return "This security invariant is reserved to the Super Admin context and cannot be delegated.";
  }
  if (role === "VIEWER" && VIEWER_IMMUTABLE_DENIALS.has(permission)) {
    return "Viewer access is permanently restricted for this permission.";
  }
  if (role === "COMPUTER_OPERATOR" && COMPUTER_OPERATOR_IMMUTABLE_DENIALS.has(permission)) {
    return "Computer Operator access cannot be expanded into unrestricted administration or finance authority.";
  }
  return null;
}

export function permissionCanAppearInProfile(permission: CanonicalPermission) {
  return !SUPER_ADMIN_ONLY_PERMISSIONS.has(permission);
}

export function permissionCanBeDelegatedByProfile(permission: CanonicalPermission) {
  return permissionCanAppearInProfile(permission);
}
