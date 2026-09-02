import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { updateGuardianRecord } from "@/lib/authoritative-record-services";

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_GUARDIANS");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const guardian = await prisma.guardian.findUnique({
    where: { id },
    include: {
      students: {
        include: { student: true },
        orderBy: { createdAt: "asc" }
      },
      users: {
        select: { id: true, name: true, username: true, email: true, role: true, isActive: true, guardianId: true }
      }
    }
  });
  if (!guardian) return NextResponse.json({ error: "Guardian not found" }, { status: 404 });
  return NextResponse.json({ guardian });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_GUARDIANS");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const guardian = await updateGuardianRecord(prisma, id, await request.json());
    return NextResponse.json({ guardian });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to update guardian") },
      { status: 400 }
    );
  }
}
