import { PageHeader } from "@/components/ui";
import { NamedUserDetail } from "@/components/iam/named-user-detail";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNamedUserDetail, previewNamedUserAccess } from "@/lib/iam/users";
import { listPermissionProfiles } from "@/lib/iam/profiles";
import { PERMISSIONS, ROLES, permissionLabel } from "@/lib/permissions";
import { roleDisplayLabel } from "@/lib/role-presentation";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function NamedUserPage({ params }: { params: Promise<{ handle: string }> }) {
  const actor = await requirePermission("VIEW_IAM_ACCESS");
  const handle = (await params).handle;
  const [detail, decisions, profiles, actorPermissions] = await Promise.all([
    getNamedUserDetail(prisma, handle), previewNamedUserAccess(prisma, handle), listPermissionProfiles(prisma), getCurrentUserEffectivePermissions()
  ]);
  const candidateRoles = ROLES.filter((role) => role !== "SUPER_ADMIN" || permissionSetCan(actorPermissions, "GRANT_SUPER_ADMIN"));
  const roles = actor.role === "SUPER_ADMIN"
    ? candidateRoles
    : (await Promise.all(candidateRoles.map(async (role) => ({ role, permissions: await getEffectivePermissions(prisma, role) }))))
      .filter(({ role, permissions }) => role !== "SUPER_ADMIN" && permissionSetCan(actorPermissions, "DELEGATE_IAM_ACCESS") && [...permissions].every((permission) => actorPermissions.has(permission)))
      .map(({ role }) => role);
  return <div className="page iam-page"><PageHeader title={detail.name} description="Named-user roles, profile assignments, individual overrides, effective access, sessions and append-only history." /><NamedUserDetail detail={detail} decisions={decisions} roles={roles.map((role) => ({ value: role, label: roleDisplayLabel(role) }))} profiles={profiles.filter((profile) => profile.status === "ACTIVE").map((profile) => ({ handle: profile.handle, label: profile.name }))} permissions={PERMISSIONS.map((permission) => ({ value: permission, label: permissionLabel(permission) }))} canManage={permissionSetCan(actorPermissions, "MANAGE_IAM_USERS")} canAssignProfiles={permissionSetCan(actorPermissions, "ASSIGN_PERMISSION_PROFILES")} canManageOverrides={permissionSetCan(actorPermissions, "MANAGE_USER_PERMISSION_OVERRIDES")} /></div>;
}
