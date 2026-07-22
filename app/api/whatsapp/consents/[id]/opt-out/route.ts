import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { optOutWhatsAppConsent } from "@/lib/whatsapp-consents";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_WHATSAPP_CONSENTS");
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ consent: await optOutWhatsAppConsent(prisma, (await params).id, auth.user, body.reason) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to opt out.") }, { status: 400 }); }
}
