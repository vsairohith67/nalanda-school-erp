import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { friendlyStaffLeaveError, linkedStaffMember, overlappingLeaveWarning, staffLeaveInclude, validateStaffLeaveInput } from "@/lib/staff-leave";

async function access(id: string, user: { id: string; role: string }) {
  const [request, permissions, linked] = await Promise.all([prisma.staffLeaveRequest.findUnique({ where: { id }, include: staffLeaveInclude }), getCurrentUserEffectivePermissions(), linkedStaffMember(prisma, user.id)]);
  if (!request) return { response: NextResponse.json({ error: "Staff leave request not found" }, { status: 404 }) };
  const canManage = permissionSetCan(permissions, "MANAGE_STAFF_LEAVE");
  const own = linked?.id === request.staffMemberId;
  if (!canManage && !own) return { response: NextResponse.json({ error: "You can only view your own leave requests" }, { status: 403 }) };
  return { request, permissions, linked, canManage, own, response: null };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_STAFF_LEAVE"); if (auth.response) return auth.response;
  const { id } = await context.params; const result = await access(id, auth.user); if (result.response) return result.response;
  return NextResponse.json({ leaveRequest: result.request });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_STAFF_LEAVE"); if (auth.response) return auth.response;
  const { id } = await context.params; const source = await request.json().catch(() => ({}));
  const result = await access(id, auth.user); if (result.response) return result.response;
  const existing = result.request!; const permissions = result.permissions!; const action = String(source.action ?? "edit");
  try {
    if (action === "approve" || action === "reject") {
      if (!permissionSetCan(permissions, "APPROVE_STAFF_LEAVE")) return NextResponse.json({ error: "You do not have permission to approve or reject staff leave" }, { status: 403 });
      if (existing.status !== "PENDING") throw new Error("Only pending leave can be approved or rejected");
      if (action === "reject") { const rejectionReason = String(source.rejectionReason ?? "").trim(); if (!rejectionReason) throw new Error("Rejection reason is required"); const leaveRequest = await prisma.staffLeaveRequest.update({ where: { id }, data: { status: "REJECTED", approverUserId: auth.user.id, rejectedAt: new Date(), rejectionReason }, include: staffLeaveInclude }); return NextResponse.json({ leaveRequest }); }
      const leaveRequest = await prisma.staffLeaveRequest.update({ where: { id }, data: { status: "APPROVED", approverUserId: auth.user.id, approvedAt: new Date(), rejectedAt: null, rejectionReason: null }, include: staffLeaveInclude }); return NextResponse.json({ leaveRequest });
    }
    if (action === "cancel") {
      if (!result.canManage && (!result.own || !permissionSetCan(permissions, "APPLY_STAFF_LEAVE"))) return NextResponse.json({ error: "You cannot cancel this leave request" }, { status: 403 });
      if (!["DRAFT", "PENDING"].includes(existing.status)) throw new Error("Only draft or pending leave can be cancelled");
      const cancellationReason = String(source.cancellationReason ?? "").trim(); if (!cancellationReason) throw new Error("Cancellation reason is required");
      const leaveRequest = await prisma.staffLeaveRequest.update({ where: { id }, data: { status: "CANCELLED", cancelledByUserId: auth.user.id, cancelledAt: new Date(), cancellationReason }, include: staffLeaveInclude }); return NextResponse.json({ leaveRequest });
    }
    if (existing.status !== "DRAFT") throw new Error("Only draft leave can be edited or submitted");
    if (!result.canManage && (!result.own || !permissionSetCan(permissions, "APPLY_STAFF_LEAVE"))) return NextResponse.json({ error: "You cannot edit this leave request" }, { status: 403 });
    const submitting = action === "submit"; if (!submitting && action !== "edit") throw new Error("Unknown staff leave action");
    const input = validateStaffLeaveInput({ ...source, staffMemberId: result.canManage ? source.staffMemberId ?? existing.staffMemberId : existing.staffMemberId }, { submitting });
    const staff = await prisma.staffMember.findUnique({ where: { id: input.staffMemberId }, select: { status: true } }); if (!staff || staff.status !== "ACTIVE") throw new Error("Choose an active staff member");
    const warning = await overlappingLeaveWarning(prisma, { ...input, excludeId: id });
    const leaveRequest = await prisma.staffLeaveRequest.update({ where: { id }, data: { ...input, status: submitting ? "PENDING" : "DRAFT" }, include: staffLeaveInclude }); return NextResponse.json({ leaveRequest, warning });
  } catch (error) { return NextResponse.json({ error: friendlyStaffLeaveError(error) }, { status: 400 }); }
}
