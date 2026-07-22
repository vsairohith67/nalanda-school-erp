import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setWhatsAppTemplateMappingStatus } from "@/lib/whatsapp-template-mappings";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_WHATSAPP_TEMPLATE_MAPPINGS");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    return NextResponse.json({ mapping: await setWhatsAppTemplateMappingStatus(prisma, (await params).id, String(body.action), auth.user.id) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update mapping.") }, { status: 400 }); }
}
