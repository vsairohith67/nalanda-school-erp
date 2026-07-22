import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { recordClassXHandover } from "@/lib/class-x-package-handover";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("HANDOVER_CLASS_X_DOCUMENTS"); if (auth.response) return auth.response;
  try { const result = await recordClassXHandover(prisma, (await params).id, await request.json(), auth.user.id); return NextResponse.json({ handover: { id: result.handover.id, handoverNumber: result.handover.handoverNumber }, packageStatus: result.packageStatus }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to record document handover") }, { status: 400 }); }
}
