import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { waiveClassXCharge } from "@/lib/class-x-package-payments";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("WAIVE_CLASS_X_PACKAGE_CHARGES"); if (auth.response) return auth.response;
  try { const body = await request.json(); return NextResponse.json({ charge: await waiveClassXCharge(prisma, (await params).id, body.reason, auth.user.id) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to waive package charge") }, { status: 400 }); }
}
