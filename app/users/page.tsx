import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SAFE_USER_SELECT } from "@/lib/user-management";
import { PageHeader } from "@/components/ui";
import { UserManagement } from "@/components/user-management";
import { getEffectivePermissions } from "@/lib/role-permissions";

export default async function UsersPage() {
  const user = await requirePermission("VIEW_USERS");
  const [users, permissions] = await Promise.all([
    prisma.user.findMany({
    select: SAFE_USER_SELECT,
    orderBy: [{ role: "asc" }, { name: "asc" }]
    }),
    getEffectivePermissions(prisma, user.role)
  ]);
  return (
    <div className="page">
      <PageHeader title="User Management" description="Create accounts, control roles and access, and reset temporary passwords. Parent access is read-only; Teacher attendance follows the role permission matrix." />
      <UserManagement users={users} actorRole={user.role} actorPermissions={[...permissions]} />
    </div>
  );
}
