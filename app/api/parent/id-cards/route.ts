import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parentIdentityCards } from "@/lib/id-card-portals";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_OWN_STUDENT_ID_CARDS"); if (auth.response) return auth.response;
  return NextResponse.json(await parentIdentityCards(prisma, auth.user, request.nextUrl.searchParams.get("admissionNo")));
}
