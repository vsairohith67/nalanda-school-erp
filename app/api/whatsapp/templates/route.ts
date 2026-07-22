import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWhatsAppTemplateMapping } from "@/lib/whatsapp-template-mappings";

export async function GET() {
  const auth = await requireApiPermission("VIEW_WHATSAPP_CENTRE");
  if (auth.response) return auth.response;
  return NextResponse.json({ mappings: await prisma.whatsAppTemplateMapping.findMany({ include: { integrationProfile: true }, orderBy: { createdAt: "desc" } }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_WHATSAPP_TEMPLATE_MAPPINGS");
  if (auth.response) return auth.response;
  try { return NextResponse.json({ mapping: await createWhatsAppTemplateMapping(prisma, await request.json(), auth.user.id) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create mapping.") }, { status: 400 }); }
}
