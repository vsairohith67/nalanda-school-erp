import type { Prisma, PrismaClient } from "@prisma/client";
import {
  PERMISSIONS,
  RECOMMENDED_ROLE_PERMISSIONS,
  ROLES,
  can,
  isRole,
  normalizePermission,
  type CanonicalPermission,
  type Permission,
  type Role
} from "@/lib/permissions";

type RolePermissionClient = Pick<PrismaClient | Prisma.TransactionClient, "rolePermission">;

export type RolePermissionMatrix = Record<Role, Record<CanonicalPermission, boolean>>;

export function defaultPermissionMatrix(): RolePermissionMatrix {
  return Object.fromEntries(
    ROLES.map((role) => [
      role,
      Object.fromEntries(
        PERMISSIONS.map((permission) => [
          permission,
          role === "SUPER_ADMIN" || RECOMMENDED_ROLE_PERMISSIONS[role].has(permission)
        ])
      )
    ])
  ) as RolePermissionMatrix;
}

export async function ensureDefaultRolePermissions(client: RolePermissionClient) {
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      await client.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        update: {},
        create: {
          role,
          permission,
          enabled: role === "SUPER_ADMIN" || RECOMMENDED_ROLE_PERMISSIONS[role].has(permission)
        }
      });
    }
  }
}

export async function getRolePermissionMatrix(client: RolePermissionClient): Promise<RolePermissionMatrix> {
  const matrix = defaultPermissionMatrix();
  const rows = await client.rolePermission.findMany();
  for (const row of rows) {
    if (!isRole(row.role)) continue;
    const permission = normalizePermission(row.permission);
    if (!permission) continue;
    matrix[row.role][permission] = row.role === "SUPER_ADMIN" ? true : row.enabled;
  }
  return matrix;
}

export async function getEffectivePermissions(client: RolePermissionClient, role: Role) {
  if (role === "SUPER_ADMIN") return new Set<CanonicalPermission>(PERMISSIONS);
  const permissions = new Set<CanonicalPermission>(RECOMMENDED_ROLE_PERMISSIONS[role]);
  const rows = await client.rolePermission.findMany({ where: { role } });
  for (const row of rows) {
    const permission = normalizePermission(row.permission);
    if (!permission) continue;
    if (row.enabled) permissions.add(permission);
    else permissions.delete(permission);
  }
  return permissions;
}

export async function hasRolePermission(
  client: RolePermissionClient,
  role: Role,
  permission: Permission | string
) {
  if (role === "SUPER_ADMIN") return true;
  const canonical = normalizePermission(permission);
  if (!canonical) return false;
  const row = await client.rolePermission.findUnique({ where: { role_permission: { role, permission: canonical } } });
  return row ? row.enabled : can(role, canonical);
}

export function permissionSetCan(permissions: ReadonlySet<CanonicalPermission>, permission: Permission | string) {
  const canonical = normalizePermission(permission);
  return Boolean(canonical && permissions.has(canonical));
}

export function validateRolePermissionPayload(input: unknown): RolePermissionMatrix {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Permission matrix must be an object");
  }
  const source = input as Record<string, unknown>;
  const matrix = defaultPermissionMatrix();
  for (const [role, values] of Object.entries(source)) {
    if (!isRole(role)) throw new Error(`Unsupported role: ${role}`);
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      throw new Error(`${role} permissions must be an object`);
    }
    for (const [rawPermission, enabled] of Object.entries(values as Record<string, unknown>)) {
      const permission = normalizePermission(rawPermission);
      if (!permission) throw new Error(`Unsupported permission: ${rawPermission}`);
      if (typeof enabled !== "boolean") throw new Error(`${rawPermission} must be true or false`);
      if (role === "SUPER_ADMIN" && enabled === false) {
        throw new Error("SUPER_ADMIN permissions are locked and cannot be disabled");
      }
      matrix[role][permission] = role === "SUPER_ADMIN" ? true : enabled;
    }
  }
  return matrix;
}

export async function saveRolePermissionMatrix(client: RolePermissionClient, matrix: RolePermissionMatrix) {
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      await client.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        update: { enabled: role === "SUPER_ADMIN" ? true : matrix[role][permission] },
        create: { role, permission, enabled: role === "SUPER_ADMIN" ? true : matrix[role][permission] }
      });
    }
  }
}

export async function resetRolePermissionsToDefaults(client: RolePermissionClient) {
  await saveRolePermissionMatrix(client, defaultPermissionMatrix());
  return getRolePermissionMatrix(client);
}
