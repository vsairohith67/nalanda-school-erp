import { PageHeader } from "@/components/ui";
import { PermissionProfiles } from "@/components/iam/permission-profiles";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPermissionProfiles } from "@/lib/iam/profiles";
import { PERMISSIONS, permissionLabel } from "@/lib/permissions";
import { permissionDelegability } from "@/lib/iam/permission-governance";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function PermissionProfilesPage() {
  await requirePermission("VIEW_IAM_ACCESS");
  const [profiles, actorPermissions] = await Promise.all([listPermissionProfiles(prisma), getCurrentUserEffectivePermissions()]);
  return <div className="page iam-page"><PageHeader title="Permission Profiles" description="Reusable, versioned allows and explicit denials with shared-profile impact review and no hard deletion." /><PermissionProfiles initialProfiles={profiles} permissions={PERMISSIONS.map((permission) => ({ value: permission, label: permissionLabel(permission), classification: permissionDelegability(permission).replaceAll("_", " ") }))} canManage={permissionSetCan(actorPermissions, "MANAGE_PERMISSION_PROFILES")} /></div>;
}
