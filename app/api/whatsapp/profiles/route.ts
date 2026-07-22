import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWhatsAppProfile } from "@/lib/whatsapp-profiles";

export async function GET() {
  const auth = await requireApiPermission("VIEW_WHATSAPP_CENTRE");
  if (auth.response) return auth.response;
  const profiles = await prisma.whatsAppIntegrationProfile.findMany({ orderBy: [{ createdAt: "desc" }] });
  return NextResponse.json({ profiles });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_WHATSAPP_INTEGRATION");
  if (auth.response) return auth.response;
  try { return NextResponse.json({ profile: await createWhatsAppProfile(prisma, await request.json(), auth.user) }, { status: 201 }); }
  catch (error) { return bad(error, "Unable to create WhatsApp profile."); }
}
function bad(error: unknown, fallback: string) { return NextResponse.json({ error: safeClientError(error, fallback) }, { status: 400 }); }
