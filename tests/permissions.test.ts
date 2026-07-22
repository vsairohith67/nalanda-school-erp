import { describe, expect, it } from "vitest";
import { can, PERMISSION_GROUPS, PERMISSIONS, RECOMMENDED_ROLE_PERMISSIONS, normalizePermission } from "../lib/permissions";
import {
  defaultPermissionMatrix,
  getEffectivePermissions,
  hasRolePermission,
  permissionSetCan,
  resetRolePermissionsToDefaults,
  saveRolePermissionMatrix,
  validateRolePermissionPayload
} from "../lib/role-permissions";

describe("role permissions", () => {
  it("keeps Super Admin all-access even when rows are missing", () => {
    for (const permission of PERMISSIONS) {
      expect(can("SUPER_ADMIN", permission)).toBe(true);
    }
    expect(RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN.size).toBe(PERMISSIONS.length);
  });

  it("keeps Director/Admin/Accountant expected access through aliases", () => {
    expect(can("DIRECTOR", "EDIT_PAYMENT")).toBe(true);
    expect(can("DIRECTOR", "RESTORE_PAYMENT")).toBe(true);
    expect(can("DIRECTOR", "MANAGE_FEES")).toBe(true);
    expect(can("DIRECTOR", "PRINT_RECEIPT")).toBe(true);
    expect(can("DIRECTOR", "EXPORT_FULL_BACKUP")).toBe(true);
    expect(can("DIRECTOR", "RESTORE_FULL_BACKUP")).toBe(true);
    expect(can("DIRECTOR", "MANAGE_ROLE_PERMISSIONS")).toBe(false);
    expect(can("DIRECTOR", "IMPORT_GUARDIANS")).toBe(true);
    expect(can("ADMIN", "RUN_BACKUP")).toBe(true);
    expect(can("ADMIN", "MANAGE_GUARDIANS")).toBe(true);
    expect(can("ADMIN", "IMPORT_GUARDIANS")).toBe(true);
    expect(can("ADMIN", "RUN_RESTORE")).toBe(false);
    expect(can("ADMIN", "MANAGE_ROLE_PERMISSIONS")).toBe(false);
    expect(can("ACCOUNTANT", "ADD_PAYMENT")).toBe(true);
    expect(can("ACCOUNTANT", "CANCEL_PAYMENT")).toBe(true);
    expect(can("ACCOUNTANT", "MANAGE_FEES")).toBe(false);
    expect(can("ACCOUNTANT", "VIEW_GUARDIANS")).toBe(false);
    expect(can("ACCOUNTANT", "VIEW_NOTICES")).toBe(false);
    expect(can("ACCOUNTANT", "MANAGE_ROLE_PERMISSIONS")).toBe(false);
  });

  it("sets Principal, Teacher, Parent, and Viewer/Auditor defaults", () => {
    expect(can("PRINCIPAL", "VIEW_TIMETABLE")).toBe(true);
    expect(can("PRINCIPAL", "VIEW_GUARDIANS")).toBe(true);
    expect(can("PRINCIPAL", "VIEW_NOTICES")).toBe(true);
    expect(can("PRINCIPAL", "MANAGE_NOTICES")).toBe(true);
    expect(can("PRINCIPAL", "PUBLISH_NOTICES")).toBe(true);
    expect(can("PRINCIPAL", "IMPORT_GUARDIANS")).toBe(false);
    expect(can("PRINCIPAL", "MANAGE_TIMETABLE_BUILDER")).toBe(true);
    expect(can("PRINCIPAL", "CREATE_PAYMENTS")).toBe(false);
    expect(can("PRINCIPAL", "RUN_RESTORE")).toBe(false);
    expect(can("TEACHER", "VIEW_DASHBOARD")).toBe(false);
    expect(can("TEACHER", "VIEW_TEACHER_PLACEHOLDER")).toBe(true);
    expect(can("TEACHER", "VIEW_STUDENTS")).toBe(false);
    expect(can("PARENT", "VIEW_DASHBOARD")).toBe(false);
    expect(can("PARENT", "VIEW_PARENT_PLACEHOLDER")).toBe(true);
    expect(can("PARENT", "VIEW_GUARDIANS")).toBe(false);
    expect(can("PARENT", "VIEW_NOTICES")).toBe(false);
    expect(can("PARENT", "MANAGE_NOTICES")).toBe(false);
    expect(can("TEACHER", "VIEW_NOTICES")).toBe(false);
    expect(can("VIEWER", "VIEW_PENDING")).toBe(true);
    expect(can("VIEWER", "VIEW_REPORTS")).toBe(true);
    expect(can("VIEWER", "ADD_PAYMENT")).toBe(false);
    expect(can("VIEWER", "EDIT_STUDENTS")).toBe(false);
    expect(can("VIEWER", "VIEW_NOTICES")).toBe(true);
    expect(can("VIEWER", "MANAGE_NOTICES")).toBe(false);
  });

  it("keeps cloud backup authority separate from general dashboard and backup permissions", () => {
    for (const permission of [
      "VIEW_CLOUD_BACKUP",
      "MANAGE_CLOUD_BACKUP_PROFILES",
      "MANAGE_CLOUD_BACKUP_SCHEDULES",
      "RUN_CLOUD_BACKUP",
      "VERIFY_CLOUD_BACKUP",
      "RUN_CLOUD_BACKUP_RESTORE_REHEARSAL",
      "MANAGE_CLOUD_BACKUP_RETENTION",
      "PURGE_CLOUD_BACKUPS",
      "ACTIVATE_LIVE_CLOUD_BACKUP",
      "CHANGE_CLOUD_BACKUP_KEY_VERSION",
      "VIEW_CLOUD_BACKUP_REPORTS",
      "EXPORT_CLOUD_BACKUP_REPORTS"
    ] as const) {
      expect(can("SUPER_ADMIN", permission)).toBe(true);
      expect(can("DIRECTOR", permission)).toBe(true);
    }
    expect(can("PRINCIPAL", "VIEW_CLOUD_BACKUP")).toBe(true);
    expect(can("PRINCIPAL", "VERIFY_CLOUD_BACKUP")).toBe(true);
    expect(can("PRINCIPAL", "RUN_CLOUD_BACKUP_RESTORE_REHEARSAL")).toBe(true);
    expect(can("PRINCIPAL", "PURGE_CLOUD_BACKUPS")).toBe(false);
    expect(can("PRINCIPAL", "ACTIVATE_LIVE_CLOUD_BACKUP")).toBe(false);
    expect(can("ADMIN", "RUN_CLOUD_BACKUP")).toBe(true);
    expect(can("ADMIN", "CHANGE_CLOUD_BACKUP_KEY_VERSION")).toBe(false);
    expect(can("VIEWER", "VIEW_CLOUD_BACKUP_REPORTS")).toBe(true);
    expect(can("VIEWER", "VIEW_CLOUD_BACKUP")).toBe(true);
    expect(can("VIEWER", "VERIFY_CLOUD_BACKUP")).toBe(false);
    expect(can("VIEWER", "MANAGE_CLOUD_BACKUP_PROFILES")).toBe(false);
    expect(can("VIEWER", "RUN_CLOUD_BACKUP_RESTORE_REHEARSAL")).toBe(false);
    expect(can("VIEWER", "EXPORT_CLOUD_BACKUP_REPORTS")).toBe(false);
    for (const role of ["ACCOUNTANT", "TEACHER", "PARENT"] as const) {
      expect(can(role, "VIEW_CLOUD_BACKUP")).toBe(false);
      expect(can(role, "VIEW_CLOUD_BACKUP_REPORTS")).toBe(false);
    }
  });

  it("keeps barcode and scanner operations with the operational roles only", () => {
    for (const permission of ["VIEW_LIBRARY_BARCODES", "MANAGE_LIBRARY_BARCODES", "PRINT_LIBRARY_BARCODE_LABELS", "USE_LIBRARY_SCANNER"] as const) {
      expect(can("SUPER_ADMIN", permission)).toBe(true);
      expect(can("DIRECTOR", permission)).toBe(true);
      expect(can("ADMIN", permission)).toBe(true);
    }
    expect(can("PRINCIPAL", "VIEW_LIBRARY_BARCODES")).toBe(true);
    for (const role of ["PRINCIPAL", "VIEWER", "ACCOUNTANT", "TEACHER", "PARENT"] as const) {
      expect(can(role, "USE_LIBRARY_SCANNER")).toBe(false);
      expect(can(role, "MANAGE_LIBRARY_BARCODES")).toBe(false);
      expect(can(role, "PRINT_LIBRARY_BARCODE_LABELS")).toBe(false);
    }
  });

  it("shows guardian permissions in the recommended role matrix", () => {
    const permissionLabels = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.permission));
    for (const permission of ["VIEW_GUARDIANS", "MANAGE_GUARDIANS", "IMPORT_GUARDIANS", "VIEW_PARENT_PLACEHOLDER"]) {
      expect(PERMISSIONS).toContain(permission);
      expect(permissionLabels).toContain(permission);
    }
    const matrix = defaultPermissionMatrix();
    expect(matrix.SUPER_ADMIN.VIEW_GUARDIANS).toBe(true);
    expect(matrix.DIRECTOR.MANAGE_GUARDIANS).toBe(true);
    expect(matrix.ADMIN.IMPORT_GUARDIANS).toBe(true);
    expect(matrix.PRINCIPAL.VIEW_GUARDIANS).toBe(true);
    expect(matrix.PRINCIPAL.MANAGE_GUARDIANS).toBe(false);
    expect(matrix.ACCOUNTANT.VIEW_GUARDIANS).toBe(false);
    expect(matrix.PARENT.VIEW_PARENT_PLACEHOLDER).toBe(true);
    expect(matrix.PARENT.VIEW_GUARDIANS).toBe(false);
    expect(matrix.VIEWER.MANAGE_GUARDIANS).toBe(false);
  });

  it("includes staff permissions in save/reset defaults", () => {
    const matrix = defaultPermissionMatrix();
    expect(matrix.DIRECTOR.IMPORT_STAFF).toBe(true);
    expect(matrix.ADMIN.MANAGE_STAFF).toBe(true);
    expect(matrix.PRINCIPAL.VIEW_STAFF).toBe(true);
    expect(matrix.PRINCIPAL.MANAGE_STAFF).toBe(true);
    expect(matrix.PRINCIPAL.IMPORT_STAFF).toBe(false);
    expect(matrix.ACCOUNTANT.VIEW_STAFF).toBe(false);
    expect(matrix.TEACHER.VIEW_TEACHER_PLACEHOLDER).toBe(true);
    expect(matrix.PARENT.VIEW_STAFF).toBe(false);
    expect(matrix.VIEWER.VIEW_STAFF).toBe(true);
  });

  it("includes notice permissions in the matrix and recommended reset defaults", () => {
    const permissionLabels = PERMISSION_GROUPS.flatMap((group) => group.permissions.map((item) => item.permission));
    for (const permission of ["VIEW_NOTICES", "MANAGE_NOTICES", "PUBLISH_NOTICES"]) {
      expect(PERMISSIONS).toContain(permission);
      expect(permissionLabels).toContain(permission);
    }
    const matrix = defaultPermissionMatrix();
    for (const role of ["SUPER_ADMIN", "DIRECTOR", "ADMIN", "PRINCIPAL"] as const) {
      expect(matrix[role].VIEW_NOTICES).toBe(true);
      expect(matrix[role].MANAGE_NOTICES).toBe(true);
      expect(matrix[role].PUBLISH_NOTICES).toBe(true);
    }
    expect(matrix.ACCOUNTANT.VIEW_NOTICES).toBe(false);
    expect(matrix.TEACHER.VIEW_NOTICES).toBe(false);
    expect(matrix.PARENT.VIEW_NOTICES).toBe(false);
    expect(matrix.VIEWER.VIEW_NOTICES).toBe(true);
    expect(matrix.VIEWER.MANAGE_NOTICES).toBe(false);
  });

  it("uses safe student attendance defaults for each role", () => {
    const matrix = defaultPermissionMatrix();
    for (const role of ["SUPER_ADMIN", "DIRECTOR", "ADMIN", "PRINCIPAL"] as const) {
      expect(matrix[role].VIEW_STUDENT_ATTENDANCE).toBe(true);
      expect(matrix[role].MANAGE_STUDENT_ATTENDANCE).toBe(true);
      expect(matrix[role].SUBMIT_STUDENT_ATTENDANCE).toBe(true);
      expect(matrix[role].LOCK_STUDENT_ATTENDANCE).toBe(true);
      expect(matrix[role].VIEW_STUDENT_ATTENDANCE_REPORTS).toBe(true);
    }
    expect(matrix.TEACHER.VIEW_STUDENT_ATTENDANCE).toBe(true);
    expect(matrix.TEACHER.MANAGE_STUDENT_ATTENDANCE).toBe(true);
    expect(matrix.TEACHER.SUBMIT_STUDENT_ATTENDANCE).toBe(true);
    expect(matrix.TEACHER.LOCK_STUDENT_ATTENDANCE).toBe(false);
    expect(matrix.ACCOUNTANT.VIEW_STUDENT_ATTENDANCE).toBe(false);
    expect(matrix.PARENT.VIEW_STUDENT_ATTENDANCE).toBe(false);
    expect(matrix.PARENT.VIEW_STUDENT_ATTENDANCE_REPORTS).toBe(false);
    expect(matrix.VIEWER.VIEW_STUDENT_ATTENDANCE_REPORTS).toBe(true);
    expect(matrix.VIEWER.MANAGE_STUDENT_ATTENDANCE).toBe(false);
    expect(matrix.DIRECTOR.LOCK_STAFF_ATTENDANCE).toBe(true);
    expect(matrix.PRINCIPAL.MANAGE_STAFF_ATTENDANCE).toBe(true);
    expect(matrix.ADMIN.SUBMIT_STAFF_ATTENDANCE).toBe(true);
    expect(matrix.TEACHER.VIEW_STAFF_ATTENDANCE).toBe(false);
    expect(matrix.PARENT.VIEW_STAFF_ATTENDANCE_REPORTS).toBe(false);
    expect(matrix.ACCOUNTANT.VIEW_STAFF_ATTENDANCE).toBe(false);
    expect(matrix.VIEWER.VIEW_STAFF_ATTENDANCE_REPORTS).toBe(true);
    expect(matrix.VIEWER.MANAGE_STAFF_ATTENDANCE).toBe(false);
  });

  it("keeps lifecycle management with leadership and lifecycle reports read-only for Viewer", () => {
    const matrix = defaultPermissionMatrix();
    for (const role of ["SUPER_ADMIN", "DIRECTOR", "ADMIN", "PRINCIPAL"] as const) {
      expect(matrix[role].VIEW_STUDENT_LIFECYCLE).toBe(true);
      expect(matrix[role].MANAGE_STUDENT_LIFECYCLE).toBe(true);
      expect(matrix[role].VIEW_ACADEMIC_YEAR_ENROLLMENTS).toBe(true);
      expect(matrix[role].MANAGE_ACADEMIC_YEAR_ENROLLMENTS).toBe(true);
    }
    expect(matrix.VIEWER.VIEW_STUDENT_LIFECYCLE).toBe(true);
    expect(matrix.VIEWER.VIEW_ACADEMIC_YEAR_ENROLLMENTS).toBe(true);
    expect(matrix.VIEWER.MANAGE_STUDENT_LIFECYCLE).toBe(false);
    expect(matrix.ACCOUNTANT.VIEW_STUDENT_LIFECYCLE).toBe(false);
    expect(matrix.TEACHER.VIEW_STUDENT_LIFECYCLE).toBe(false);
    expect(matrix.PARENT.VIEW_STUDENT_LIFECYCLE).toBe(false);
  });

  it("uses view/export separation for the UDISE planning checklist", () => {
    const matrix = defaultPermissionMatrix();
    for (const role of ["SUPER_ADMIN", "DIRECTOR", "ADMIN", "PRINCIPAL"] as const) {
      expect(matrix[role].VIEW_UDISE_CHECKLIST).toBe(true);
      expect(matrix[role].EXPORT_UDISE_CHECKLIST).toBe(true);
    }
    expect(matrix.VIEWER.VIEW_UDISE_CHECKLIST).toBe(true);
    expect(matrix.VIEWER.EXPORT_UDISE_CHECKLIST).toBe(false);
    for (const role of ["ACCOUNTANT", "TEACHER", "PARENT"] as const) {
      expect(matrix[role].VIEW_UDISE_CHECKLIST).toBe(false);
      expect(matrix[role].EXPORT_UDISE_CHECKLIST).toBe(false);
    }
  });

  it("normalizes legacy permissions to canonical matrix names", () => {
    expect(normalizePermission("ADD_PAYMENT")).toBe("CREATE_PAYMENTS");
    expect(normalizePermission("VIEW_PILOT_ACCEPTANCE")).toBe("RUN_PILOT_ACCEPTANCE");
    expect(normalizePermission("NOT_A_PERMISSION")).toBeNull();
  });

  it("validates role permission updates and locks Super Admin permissions", () => {
    const matrix = defaultPermissionMatrix();
    matrix.ACCOUNTANT.RUN_BACKUP = true;
    expect(validateRolePermissionPayload(matrix).ACCOUNTANT.RUN_BACKUP).toBe(true);
    expect(() => validateRolePermissionPayload({
      SUPER_ADMIN: { RUN_BACKUP: false }
    })).toThrow("SUPER_ADMIN permissions are locked");
    expect(() => validateRolePermissionPayload({
      ACCOUNTANT: { NOT_REAL: true }
    })).toThrow("Unsupported permission");
  });

  it("uses database overrides when present and safe defaults when rows are missing", async () => {
    const fakeClient = {
      rolePermission: {
        findUnique: async ({ where }: { where: { role_permission: { role: string; permission: string } } }) =>
          where.role_permission.role === "ACCOUNTANT" && where.role_permission.permission === "RUN_BACKUP"
            ? { role: "ACCOUNTANT", permission: "RUN_BACKUP", enabled: true }
            : null,
        findMany: async () => [
          { role: "ACCOUNTANT", permission: "RUN_BACKUP", enabled: true },
          { role: "ACCOUNTANT", permission: "CREATE_PAYMENTS", enabled: false }
        ]
      }
    };
    expect(await hasRolePermission(fakeClient as never, "ACCOUNTANT", "RUN_BACKUP")).toBe(true);
    expect(await hasRolePermission(fakeClient as never, "ACCOUNTANT", "CREATE_PAYMENTS")).toBe(true);
    const permissions = await getEffectivePermissions(fakeClient as never, "ACCOUNTANT");
    expect(permissionSetCan(permissions, "RUN_BACKUP")).toBe(true);
    expect(permissionSetCan(permissions, "CREATE_PAYMENTS")).toBe(false);
  });

  it("saves and resets the matrix while keeping Super Admin locked on", async () => {
    const rows = new Map<string, { role: string; permission: string; enabled: boolean }>();
    const fakeClient = {
      rolePermission: {
        upsert: async ({ where, update, create }: {
          where: { role_permission: { role: string; permission: string } };
          update: { enabled?: boolean };
          create: { role: string; permission: string; enabled: boolean };
        }) => {
          const key = `${where.role_permission.role}:${where.role_permission.permission}`;
          const existing = rows.get(key);
          rows.set(key, existing ? { ...existing, ...update } : create);
        },
        findMany: async () => [...rows.values()]
      }
    };
    const matrix = defaultPermissionMatrix();
    matrix.ACCOUNTANT.RUN_BACKUP = true;
    matrix.SUPER_ADMIN.RUN_BACKUP = false;

    await saveRolePermissionMatrix(fakeClient as never, matrix);
    expect(rows.get("ACCOUNTANT:RUN_BACKUP")?.enabled).toBe(true);
    expect(rows.get("SUPER_ADMIN:RUN_BACKUP")?.enabled).toBe(true);

    await resetRolePermissionsToDefaults(fakeClient as never);
    expect(rows.get("ACCOUNTANT:RUN_BACKUP")?.enabled).toBe(false);
    expect(rows.get("SUPER_ADMIN:RUN_BACKUP")?.enabled).toBe(true);
    expect(rows.get("ADMIN:IMPORT_GUARDIANS")?.enabled).toBe(true);
    expect(rows.get("PARENT:VIEW_PARENT_PLACEHOLDER")?.enabled).toBe(true);
    expect(rows.get("PARENT:VIEW_GUARDIANS")?.enabled).toBe(false);
    expect(rows.get("PRINCIPAL:PUBLISH_NOTICES")?.enabled).toBe(true);
    expect(rows.get("ACCOUNTANT:VIEW_NOTICES")?.enabled).toBe(false);
    expect(rows.get("PARENT:MANAGE_NOTICES")?.enabled).toBe(false);
    expect(rows.get("ADMIN:IMPORT_STAFF")?.enabled).toBe(true);
    expect(rows.get("TEACHER:VIEW_TEACHER_PLACEHOLDER")?.enabled).toBe(true);
  });
});
