import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { linkSchoolCertificate } from "@/lib/class-x-document-items";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiPermission("MANAGE_CLASS_X_DOCUMENT_CUSTODY"); if (auth.response) return auth.response;
  try { const p = await params, result = await linkSchoolCertificate(prisma, p.id, p.itemId, await request.json(), auth.user.id); return NextResponse.json({ item: result.item, warning: result.warning }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to link certificate") }, { status: 400 }); }
}
