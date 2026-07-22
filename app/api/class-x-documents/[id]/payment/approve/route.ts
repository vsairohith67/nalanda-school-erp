import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { approveClassXCharge } from "@/lib/class-x-package-payments";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("APPROVE_CLASS_X_PACKAGE_CHARGES"); if (auth.response) return auth.response;
  try { const body = await request.json(); return NextResponse.json({ charge: await approveClassXCharge(prisma, (await params).id, auth.user.id, body.expectedUpdatedAt) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to approve package charge") }, { status: 400 }); }
}
