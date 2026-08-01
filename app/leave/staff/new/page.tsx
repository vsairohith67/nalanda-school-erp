import { redirect } from "next/navigation";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { linkedStaffMember } from "@/lib/staff-leave";
import { PageHeader } from "@/components/ui";
import { StaffLeaveForm } from "@/components/staff-leave-form";

export default async function NewStaffLeavePage() {
  const user = await requirePermission("VIEW_STAFF_LEAVE");
  const [permissions, linked] = await Promise.all([
    getCurrentUserEffectivePermissions(),
    linkedStaffMember(prisma, user.id)
  ]);
  const canManage = permissionSetCan(permissions, "MANAGE_STAFF_LEAVE");
  const canApply = permissionSetCan(permissions, "APPLY_STAFF_LEAVE");
  if (!canManage && !canApply) redirect("/unauthorized");
  const staff = canManage
    ? await prisma.staffMember.findMany({ where: { status: "ACTIVE" }, select: { id: true, staffCode: true, fullName: true, displayName: true, designation: true }, orderBy: { fullName: "asc" } })
    : linked ? [linked] : [];
  return <div className="page">
    <PageHeader title="New Staff Leave Request" description="Save a draft or submit it for approval. Substitute notes are planning-only; no substitute is assigned automatically." />
    {!canManage && !linked
      ? <div className="notice">No staff profile is linked to this login. Ask an administrator to link it before applying for leave.</div>
      : <StaffLeaveForm staff={staff} fixedStaffId={canManage ? undefined : linked?.id} canManage={canManage} canApprove={false} canApply={canApply} />}
  </div>;
}
