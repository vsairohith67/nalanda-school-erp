import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { friendlyStaffError } from "@/lib/staff";
import { updateStaffRecord } from "@/lib/authoritative-record-services";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_STAFF");
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const staff = await updateStaffRecord(prisma, id, await request.json());
    return NextResponse.json(staff);
  } catch (error) { return NextResponse.json({ error: friendlyStaffError(error) }, { status: 400 }); }
}
