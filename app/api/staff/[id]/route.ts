import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { withTimetableMutation, TimetableMutationError } from "@/lib/timetable-mutation-service";
import { friendlyStaffError, validateStaffInput } from "@/lib/staff";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_STAFF");
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const data = validateStaffInput(await request.json());
    const context = await getCurrentAuthContext();
    if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const staff = await withTimetableMutation(prisma, { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId }, "MANAGE_STAFF", { kind: "staff", id }, tx => tx.staffMember.update({ where: { id }, data }));
    return NextResponse.json(staff);
  } catch (error) { return NextResponse.json({ error: friendlyStaffError(error) }, { status: error instanceof TimetableMutationError ? error.status : 400 }); }
}
