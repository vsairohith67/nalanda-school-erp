import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { buildStaffSearchWhere, friendlyStaffError } from "@/lib/staff";
import { createStaffRecord } from "@/lib/authoritative-record-services";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STAFF");
  if (auth.response) return auth.response;
  const search = request.nextUrl.searchParams;
  const staff = await prisma.staffMember.findMany({
    where: buildStaffSearchWhere({ query: search.get("q") ?? "", staffType: search.get("type") ?? "", status: search.get("status") ?? "", designation: search.get("designation") ?? "", subject: search.get("subject") ?? "" }),
    include: { user: { select: { id: true, username: true, role: true, isActive: true } }, timetableTeacher: { select: { id: true, name: true, shortName: true } } },
    orderBy: [{ status: "asc" }, { fullName: "asc" }]
  });
  return NextResponse.json(staff);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_STAFF");
  if (auth.response) return auth.response;
  try {
    const staff = await createStaffRecord(prisma, await request.json());
    return NextResponse.json(staff, { status: 201 });
  } catch (error) { return NextResponse.json({ error: friendlyStaffError(error) }, { status: 400 }); }
}
