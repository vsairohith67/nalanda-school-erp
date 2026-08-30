import { readFileSync } from "node:fs";
import { MARKS_DELEGATION_PERMISSIONS } from "@/lib/academic-integrity";
import { PERMISSIONS, ROLES, type CanonicalPermission, type Role } from "@/lib/permissions";
import { defaultPermissionMatrix } from "@/lib/role-permissions";

type Screen = {
  route: string;
  file: string;
  roles: string[];
  permissionRequirements: string[];
};

const landingByRole: Record<Role, string> = {
  SUPER_ADMIN: "/dashboard",
  DIRECTOR: "/dashboard",
  PRINCIPAL: "/dashboard",
  ADMIN: "/dashboard",
  ACCOUNTANT: "/dashboard",
  COMPUTER_OPERATOR: "/students",
  GATE_STAFF: "/student-departures/gate",
  TEACHER: "/teacher",
  PARENT: "/parent",
  STUDENT: "/student",
  VIEWER: "/dashboard"
};

export const SYNTHETIC_PILOT_CRITICAL_SURFACES = [
  { id: "payments", route: "/payments/new", permission: "CREATE_PAYMENTS", allowedRoles: ["SUPER_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
  { id: "cash-book", route: "/cash-book", permission: "VIEW_CASH_BOOK", allowedRoles: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ACCOUNTANT", "VIEWER"] },
  { id: "student-attendance", route: "/attendance/students", permission: "MANAGE_STUDENT_ATTENDANCE", allowedRoles: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "TEACHER"] },
  { id: "marks-entry", route: "/marks/entry/[assessmentId]", permission: "ENTER_MARKS", allowedRoles: ["SUPER_ADMIN", "PRINCIPAL"] },
  { id: "report-issue", route: "/report-cards/publication", permission: "ISSUE_REPORT_CARDS", allowedRoles: ["SUPER_ADMIN", "PRINCIPAL"] },
  { id: "parent-portal", route: "/parent", permission: "VIEW_PARENT_PLACEHOLDER", allowedRoles: ["SUPER_ADMIN", "PARENT"] },
  { id: "gate-pass", route: "/student-departures/gate", permission: "VERIFY_GATE_PASS", allowedRoles: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "GATE_STAFF"] },
  { id: "iam", route: "/iam", permission: "VIEW_IAM_ACCESS", allowedRoles: ["SUPER_ADMIN", "DIRECTOR"] },
  { id: "offline", route: "/offline/finance", permission: "USE_OFFLINE_SYNC", allowedRoles: ["SUPER_ADMIN", "ACCOUNTANT"] },
  { id: "release", route: "/release-operations", permission: "VIEW_RELEASE_OPERATIONS_SUMMARY", allowedRoles: ["SUPER_ADMIN", "DIRECTOR"] }
] as const satisfies ReadonlyArray<{ id: string; route: string; permission: CanonicalPermission; allowedRoles: readonly Role[] }>;

export function buildSyntheticPilotRoleAccessMatrix() {
  const permissionMatrix = defaultPermissionMatrix();
  const screens = (JSON.parse(readFileSync("config/product-experience-screen-register.json", "utf8")) as { screens: Screen[] }).screens;
  const roles = ROLES.map((role) => {
    const allowedPermissions = PERMISSIONS.filter((permission) => permissionMatrix[role][permission]);
    const allowedRoutes = screens
      .filter((screen) => screen.roles.includes(role))
      .filter((screen) => screen.permissionRequirements.every((permission) => permissionMatrix[role][permission as CanonicalPermission] === true))
      .map((screen) => screen.route);
    return {
      role,
      authorityKind: "BASE_ROLE" as const,
      landingRoute: landingByRole[role],
      allowedPermissions,
      deniedPermissions: PERMISSIONS.filter((permission) => !permissionMatrix[role][permission]),
      uiRoutes: [...new Set(allowedRoutes)].sort(),
      sources: ["lib/permissions.ts", "lib/role-permissions.ts", "config/product-experience-screen-register.json"]
    };
  });
  return {
    schemaVersion: 1,
    promptId: "SYNTHETIC-PILOT-READINESS-1A",
    generatedFromServerPermissions: true,
    roles: [
      ...roles,
      {
        role: "MARKS_ENTRY_OPERATOR",
        authorityKind: "EXACT_SCOPE_PERMISSION_PROFILE" as const,
        landingRoute: "/marks/governed",
        allowedPermissions: [...MARKS_DELEGATION_PERMISSIONS],
        deniedPermissions: PERMISSIONS.filter((permission) => !MARKS_DELEGATION_PERMISSIONS.includes(permission as never)),
        uiRoutes: ["/marks/governed", "/marks/entry/[assessmentId]"],
        sources: ["lib/academic-integrity.ts", "lib/iam/permission-governance.ts"]
      }
    ],
    criticalSurfaces: SYNTHETIC_PILOT_CRITICAL_SURFACES
  };
}
