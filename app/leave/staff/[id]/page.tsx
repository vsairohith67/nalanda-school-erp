import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { linkedStaffMember, leaveLabel, staffLeaveInclude } from "@/lib/staff-leave";
import { PageHeader } from "@/components/ui";
import { StaffLeaveForm } from "@/components/staff-leave-form";

export default async function StaffLeaveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_STAFF_LEAVE");
  const { id } = await params;
  const [row, permissions, linked] = await Promise.all([
    prisma.staffLeaveRequest.findUnique({ where: { id }, include: staffLeaveInclude }),
    getEffectivePermissions(prisma, user.role),
    linkedStaffMember(prisma, user.id)
  ]);
  if (!row) redirect("/leave/staff");
  const canManage = permissionSetCan(permissions, "MANAGE_STAFF_LEAVE");
  if (!canManage && linked?.id !== row.staffMemberId) redirect("/unauthorized");
  const canApply = permissionSetCan(permissions, "APPLY_STAFF_LEAVE");
  const canApprove = permissionSetCan(permissions, "APPROVE_STAFF_LEAVE");
  const staff = canManage
    ? await prisma.staffMember.findMany({ where: { status: "ACTIVE" }, select: { id: true, staffCode: true, fullName: true, displayName: true, designation: true }, orderBy: { fullName: "asc" } })
    : [row.staffMember];
  const request = { ...row, startDate: row.startDate.toISOString(), endDate: row.endDate.toISOString(), approvedAt: row.approvedAt?.toISOString() ?? null, rejectedAt: row.rejectedAt?.toISOString() ?? null, cancelledAt: row.cancelledAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  return <div className="page">
    <PageHeader title="Staff Leave Details" description={`${row.staffMember.displayName || row.staffMember.fullName} · ${leaveLabel(row.status)}`} />
    <section className="card card-pad"><dl className="detail-list"><div><dt>Status</dt><dd>{leaveLabel(row.status)}</dd></div><div><dt>Total Days</dt><dd>{row.totalDays}</dd></div><div><dt>Requested By</dt><dd>{row.requestedBy?.name ?? "Unknown"}</dd></div><div><dt>Approver</dt><dd>{row.approver?.name ?? "Not reviewed"}</dd></div>{row.rejectionReason ? <div><dt>Rejection Reason</dt><dd>{row.rejectionReason}</dd></div> : null}{row.cancellationReason ? <div><dt>Cancellation Reason</dt><dd>{row.cancellationReason}</dd></div> : null}</dl></section>
    <StaffLeaveForm staff={staff} request={request} canManage={canManage} canApprove={canApprove} canApply={canApply} />
  </div>;
}
