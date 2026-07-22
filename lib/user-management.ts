import { can, type Role } from "@/lib/permissions";

export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  username: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true
} as const;

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN: "Owner-level account with locked core access and full ERP control.",
  DIRECTOR: "School leadership with broad operational control, except Super Admin safety.",
  PRINCIPAL: "Academic, timetable, student, and report access without full finance/system control by default.",
  ADMIN: "Office administration for students, imports, reports, and delegated user work.",
  ACCOUNTANT: "Fee collection, payments, dues, ledgers, receipts, and finance reports.",
  TEACHER: "Teacher start page with linked staff basics and permission-gated manual student attendance. Timetable, leave, and staff attendance dashboards are not built yet.",
  PARENT: "Read-only parent portal access for linked children, fees, receipts, and notices.",
  VIEWER: "Viewer / Auditor read-only access for limited reports and audit review."
};

export function roleDisplayLabel(role: string) {
  if (role === "VIEWER") return "Viewer / Auditor";
  return role
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function canManageUser(actorRole: Role, targetRole: Role) {
  if (actorRole === "SUPER_ADMIN") return true;
  if (targetRole === "SUPER_ADMIN") return false;
  if (actorRole === "DIRECTOR") return true;
  return actorRole === "ADMIN" && (targetRole === "ACCOUNTANT" || targetRole === "TEACHER" || targetRole === "PARENT" || targetRole === "VIEWER");
}

export function canAssignRole(actorRole: Role, role: Role) {
  if (actorRole === "SUPER_ADMIN") return true;
  if (role === "SUPER_ADMIN") return false;
  if (actorRole === "DIRECTOR") return true;
  return actorRole === "ADMIN" && (role === "ACCOUNTANT" || role === "TEACHER" || role === "PARENT" || role === "VIEWER");
}

export function assertCanManageUser(actorRole: Role, targetRole: Role) {
  if (!canManageUser(actorRole, targetRole)) {
    throw new Error("You do not have permission to manage this user");
  }
}

export function assertCanAssignRole(actorRole: Role, role: Role) {
  if (!canAssignRole(actorRole, role)) {
    throw new Error("You do not have permission to assign this role");
  }
}

export function assertDirectorDeactivationAllowed(input: {
  targetRole: Role;
  targetIsActive: boolean;
  nextIsActive: boolean;
  nextRole?: Role;
  activeDirectorCount: number;
}) {
  if (
    input.targetRole === "DIRECTOR" &&
    input.targetIsActive &&
    (!input.nextIsActive || (input.nextRole !== undefined && input.nextRole !== "DIRECTOR")) &&
    input.activeDirectorCount <= 1
  ) {
    throw new Error("The last active Director cannot be deactivated or changed to another role");
  }
}

export function assertSuperAdminSafetyAllowed(input: {
  actorUserId: string;
  targetUserId: string;
  targetRole: Role;
  targetIsActive: boolean;
  nextIsActive: boolean;
  nextRole?: Role;
  activeSuperAdminCount: number;
}) {
  const removesSuperAdmin = !input.nextIsActive ||
    (input.nextRole !== undefined && input.nextRole !== "SUPER_ADMIN");
  if (input.targetRole !== "SUPER_ADMIN" || !input.targetIsActive || !removesSuperAdmin) return;
  if (input.actorUserId === input.targetUserId) {
    throw new Error("You cannot deactivate or demote your own Super Admin account");
  }
  if (input.activeSuperAdminCount <= 1) {
    throw new Error("The last active Super Admin cannot be deactivated or changed to another role");
  }
}

export function assignableRolesFor(actorRole: Role) {
  if (actorRole === "SUPER_ADMIN") return [
    "SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "ACCOUNTANT", "TEACHER", "PARENT", "VIEWER"
  ] as Role[];
  if (actorRole === "DIRECTOR") return [
    "DIRECTOR", "PRINCIPAL", "ADMIN", "ACCOUNTANT", "TEACHER", "PARENT", "VIEWER"
  ] as Role[];
  if (actorRole === "ADMIN") return ["ACCOUNTANT", "TEACHER", "PARENT", "VIEWER"] as Role[];
  return [] as Role[];
}

export function canUseUserManagement(actorRole: Role) {
  return can(actorRole, "MANAGE_USERS");
}

export function validateNewPassword(password: string, currentPassword?: string) {
  if (!password) throw new Error("New password is required");
  if (password.length < 12) throw new Error("New password must be at least 12 characters");
  if (currentPassword !== undefined && password === currentPassword) {
    throw new Error("New password must be different from the current password");
  }
}
