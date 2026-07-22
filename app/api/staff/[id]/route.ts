import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { friendlyStaffError, validateStaffInput } from "@/lib/staff";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_STAFF");
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const staff = await prisma.staffMember.update({ where: { id }, data: validateStaffInput(await request.json()) });
    return NextResponse.json(staff);
  } catch (error) { return NextResponse.json({ error: friendlyStaffError(error) }, { status: 400 }); }
}
