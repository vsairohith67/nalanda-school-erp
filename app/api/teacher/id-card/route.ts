import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { teacherIdentityCard } from "@/lib/id-card-portals";

export async function GET() {
  const auth = await requireApiPermission("VIEW_OWN_STAFF_ID_CARD"); if (auth.response) return auth.response;
  return NextResponse.json(await teacherIdentityCard(prisma, auth.user));
}
