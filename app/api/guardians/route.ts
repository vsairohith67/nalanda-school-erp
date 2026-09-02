import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { guardianSearchWhere } from "@/lib/guardians";
import { createGuardianRecord } from "@/lib/authoritative-record-services";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_GUARDIANS");
  if (auth.response) return auth.response;
  const q = request.nextUrl.searchParams.get("q");
  const guardians = await prisma.guardian.findMany({
    where: guardianSearchWhere(q),
    include: {
      _count: { select: { students: true } },
      users: { select: { id: true, username: true, role: true, isActive: true } }
    },
    orderBy: [{ displayName: "asc" }, { primaryMobile: "asc" }]
  });
  return NextResponse.json({ guardians });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_GUARDIANS");
  if (auth.response) return auth.response;
  try {
    const guardian = await createGuardianRecord(prisma, await request.json());
    return NextResponse.json({ guardian }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to create guardian") },
      { status: 400 }
    );
  }
}
