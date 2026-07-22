import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultRolePermissions, getRolePermissionMatrix } from "@/lib/role-permissions";
import { PageHeader } from "@/components/ui";
import { RolePermissionMatrixEditor } from "@/components/role-permission-matrix";

export default async function RolesPage() {
  await requirePermission("MANAGE_ROLE_PERMISSIONS");
  await ensureDefaultRolePermissions(prisma);
  const matrix = await getRolePermissionMatrix(prisma);
  return (
    <div className="page">
      <PageHeader
        title="Role Permissions"
        description="Control ERP access by role using a checkbox matrix. Teacher opens a safe placeholder; Parent opens the read-only parent portal."
      />
      <RolePermissionMatrixEditor initialMatrix={matrix} />
    </div>
  );
}
