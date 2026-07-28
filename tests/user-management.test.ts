import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertDirectorDeactivationAllowed,
  assertSuperAdminSafetyAllowed,
  assignableRolesFor,
  canAssignRole,
  canManageUser,
  roleDisplayLabel
} from "../lib/user-management";

describe("user management rules", () => {
  it("enforces Super Admin, Director, and Admin management scope", () => {
    expect(canManageUser("SUPER_ADMIN", "DIRECTOR")).toBe(true);
    expect(canManageUser("DIRECTOR", "SUPER_ADMIN")).toBe(false);
    expect(canManageUser("DIRECTOR", "PRINCIPAL")).toBe(true);
    expect(canManageUser("ADMIN", "ACCOUNTANT")).toBe(true);
    expect(canManageUser("ADMIN", "TEACHER")).toBe(true);
    expect(canManageUser("ADMIN", "PARENT")).toBe(true);
    expect(canManageUser("ADMIN", "VIEWER")).toBe(true);
    expect(canManageUser("ADMIN", "DIRECTOR")).toBe(false);
    expect(canManageUser("ACCOUNTANT", "VIEWER")).toBe(false);
    expect(canAssignRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
    expect(canAssignRole("ADMIN", "DIRECTOR")).toBe(false);
    expect(canAssignRole("DIRECTOR", "SUPER_ADMIN")).toBe(false);
    expect(assignableRolesFor("SUPER_ADMIN")).toContain("SUPER_ADMIN");
    expect(assignableRolesFor("SUPER_ADMIN")).toContain("PARENT");
    expect(assignableRolesFor("SUPER_ADMIN")).toContain("TEACHER");
    expect(assignableRolesFor("DIRECTOR")).not.toContain("SUPER_ADMIN");
  });

  it("does not allow the last active Director to be deactivated", () => {
    expect(() => assertDirectorDeactivationAllowed({
      targetRole: "DIRECTOR",
      targetIsActive: true,
      nextIsActive: false,
      nextRole: "DIRECTOR",
      activeDirectorCount: 1
    })).toThrow("last active Director");

    expect(() => assertDirectorDeactivationAllowed({
      targetRole: "DIRECTOR",
      targetIsActive: true,
      nextIsActive: false,
      nextRole: "DIRECTOR",
      activeDirectorCount: 2
    })).not.toThrow();

    expect(() => assertDirectorDeactivationAllowed({
      targetRole: "DIRECTOR",
      targetIsActive: true,
      nextIsActive: true,
      nextRole: "ADMIN",
      activeDirectorCount: 1
    })).toThrow("changed to another role");
  });

  it("does not allow the last active Super Admin or own Super Admin account to be removed", () => {
    expect(() => assertSuperAdminSafetyAllowed({
      actorUserId: "other",
      targetUserId: "super-1",
      targetRole: "SUPER_ADMIN",
      targetIsActive: true,
      nextIsActive: false,
      nextRole: "SUPER_ADMIN",
      activeSuperAdminCount: 1
    })).toThrow("last active Super Admin");

    expect(() => assertSuperAdminSafetyAllowed({
      actorUserId: "super-1",
      targetUserId: "super-1",
      targetRole: "SUPER_ADMIN",
      targetIsActive: true,
      nextIsActive: true,
      nextRole: "DIRECTOR",
      activeSuperAdminCount: 2
    })).toThrow("own Super Admin");

    expect(() => assertSuperAdminSafetyAllowed({
      actorUserId: "super-2",
      targetUserId: "super-1",
      targetRole: "SUPER_ADMIN",
      targetIsActive: true,
      nextIsActive: true,
      nextRole: "DIRECTOR",
      activeSuperAdminCount: 2
    })).not.toThrow();

    expect(() => assertSuperAdminSafetyAllowed({
      actorUserId: "super-1",
      targetUserId: "super-1",
      targetRole: "SUPER_ADMIN",
      targetIsActive: true,
      nextIsActive: false,
      nextRole: "SUPER_ADMIN",
      activeSuperAdminCount: 2
    })).toThrow("own Super Admin");
  });

  it("uses clearer display labels", () => {
    expect(roleDisplayLabel("VIEWER")).toBe("Viewer / Auditor");
    expect(roleDisplayLabel("SUPER_ADMIN")).toBe("Super Admin");
    expect(roleDisplayLabel("ACCOUNTANT")).toBe("Accountant");
  });

  it("rechecks privileged-user counts inside the serializable update transaction", () => {
    const source = readFileSync("app/api/users/[id]/route.ts", "utf8");
    const transactionStart = source.indexOf("prisma.$transaction");
    const countStart = source.indexOf("tx.user.count");
    const updateStart = source.indexOf("tx.user.updateMany");
    expect(transactionStart).toBeGreaterThan(-1);
    expect(countStart).toBeGreaterThan(transactionStart);
    expect(updateStart).toBeGreaterThan(countStart);
    expect(source).toContain("Prisma.TransactionIsolationLevel.Serializable");
    expect(source).not.toContain("prisma.user.count");
  });

  it("requires an expected user version and an audited deactivation reason", () => {
    const route = readFileSync("app/api/users/[id]/route.ts", "utf8");
    const form = readFileSync("components/user-management.tsx", "utf8");
    expect(route).toContain("requiredExpectedUpdatedAt(body.expectedUpdatedAt)");
    expect(route).toContain("updatedAt: existing.updatedAt");
    expect(route).toContain("requiredDeactivationReason(body.reason)");
    expect(route).toContain("reason: deactivationReason");
    expect(route).toContain("tx.user.updateMany");
    expect(form).toContain("expectedUpdatedAt: new Date(user.updatedAt).toISOString()");
    expect(form).toContain("Deactivation reason");
    expect(form).not.toContain("window.prompt");
    expect(form).not.toContain("window.confirm");
  });
});
