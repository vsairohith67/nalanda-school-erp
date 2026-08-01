import { PageHeader } from "@/components/ui";
import { UserAdministration } from "@/components/iam/user-administration";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listNamedUsers } from "@/lib/iam/users";
import { listPermissionProfiles } from "@/lib/iam/profiles";
import { ROLES } from "@/lib/permissions";
import { roleDisplayLabel } from "@/lib/role-presentation";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function UsersPage() {
  await requirePermission("VIEW_IAM_ACCESS");
  const [users, profiles, staff, guardians, permissions] = await Promise.all([
    listNamedUsers(prisma, {}),
    listPermissionProfiles(prisma),
    prisma.staffMember.findMany({ where: { userId: null }, select: { iamPublicKey: true, fullName: true, staffCode: true, status: true }, orderBy: { fullName: "asc" }, take: 200 }),
    prisma.guardian.findMany({ where: { users: { none: {} } }, select: { iamPublicKey: true, displayName: true, status: true }, orderBy: { displayName: "asc" }, take: 200 }),
    getCurrentUserEffectivePermissions()
  ]);
  const roles = ROLES.filter((role) => role !== "SUPER_ADMIN" || permissionSetCan(permissions, "GRANT_SUPER_ADMIN"));
  return <div className="page iam-page"><PageHeader title="Named Users" description="Governed account lifecycle, multiple role contexts, permission profiles, individual grants and explicit denials." /><UserAdministration initialUsers={users} roles={roles.map((role) => ({ value: role, label: roleDisplayLabel(role) }))} profiles={profiles.filter((profile) => profile.status === "ACTIVE").map((profile) => ({ handle: profile.handle, label: profile.name }))} staff={staff.filter((row) => row.iamPublicKey).map((row) => ({ handle: row.iamPublicKey!, label: `${row.fullName}${row.staffCode ? ` (${row.staffCode})` : ""}`, status: row.status }))} guardians={guardians.filter((row) => row.iamPublicKey).map((row) => ({ handle: row.iamPublicKey!, label: row.displayName, status: row.status }))} canManage={permissionSetCan(permissions, "MANAGE_IAM_USERS")} /></div>;
}
