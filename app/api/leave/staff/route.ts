import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { friendlyStaffLeaveError, linkedStaffMember, overlappingLeaveWarning, staffLeaveInclude, staffLeaveWhere, validateStaffLeaveInput } from "@/lib/staff-leave";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STAFF_LEAVE");
  if (auth.response) return auth.response;
  try {
    const permissions = await getEffectivePermissions(prisma, auth.user.role);
    const manager = permissionSetCan(permissions, "MANAGE_STAFF_LEAVE");
    const linked = manager ? null : await linkedStaffMember(prisma, auth.user.id);
    const sp = request.nextUrl.searchParams;
    const where = staffLeaveWhere({ status: sp.get("status"), leaveType: sp.get("leaveType"), staffMemberId: sp.get("staffMemberId"), from: sp.get("from"), to: sp.get("to"), ownStaffMemberId: manager ? null : linked?.id ?? "__unlinked__" });
    const requests = await prisma.staffLeaveRequest.findMany({ where, include: staffLeaveInclude, orderBy: [{ createdAt: "desc" }] });
    return NextResponse.json({ requests, scope: manager ? "ALL" : "OWN", linkedStaffMember: linked });
  } catch (error) { return NextResponse.json({ error: friendlyStaffLeaveError(error) }, { status: 400 }); }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STAFF_LEAVE");
  if (auth.response) return auth.response;
  try {
    const [source, permissions, linked] = await Promise.all([request.json(), getEffectivePermissions(prisma, auth.user.role), linkedStaffMember(prisma, auth.user.id)]);
    const canManage = permissionSetCan(permissions, "MANAGE_STAFF_LEAVE");
    const canApply = permissionSetCan(permissions, "APPLY_STAFF_LEAVE");
    if (!canManage && !canApply) return NextResponse.json({ error: "You do not have permission to apply for staff leave" }, { status: 403 });
    const action = source.action === "submit" ? "submit" : "draft";
    if (!canManage) {
      if (!linked) return NextResponse.json({ error: "No staff profile is linked to this login. Ask an administrator to link it before applying for leave." }, { status: 400 });
      source.staffMemberId = linked.id;
    }
    const input = validateStaffLeaveInput(source, { submitting: action === "submit" });
    const staff = await prisma.staffMember.findUnique({ where: { id: input.staffMemberId }, select: { id: true, status: true } });
    if (!staff || staff.status !== "ACTIVE") throw new Error("Choose an active staff member");
    const warning = await overlappingLeaveWarning(prisma, input);
    const leaveRequest = await prisma.staffLeaveRequest.create({ data: { ...input, requestedByUserId: auth.user.id, status: action === "submit" ? "PENDING" : "DRAFT" }, include: staffLeaveInclude });
    return NextResponse.json({ leaveRequest, warning }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: friendlyStaffLeaveError(error) }, { status: 400 }); }
}
