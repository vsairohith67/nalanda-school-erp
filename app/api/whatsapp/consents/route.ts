import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordWhatsAppConsent } from "@/lib/whatsapp-consents";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_WHATSAPP_CONSENTS");
  if (auth.response) return auth.response;
  const status = request.nextUrl.searchParams.get("status");
  return NextResponse.json({ consents: await prisma.whatsAppConsent.findMany({
    where: status ? { status } : {}, select: {
      id: true, subjectType: true, phoneLast4: true, countryCode: true, status: true, consentSource: true,
      consentWordingVersion: true, evidenceReference: true, optedInAt: true, optedOutAt: true, expiresAt: true, createdAt: true
    }, orderBy: { createdAt: "desc" }
  }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_WHATSAPP_CONSENTS");
  if (auth.response) return auth.response;
  try { return NextResponse.json({ consent: await recordWhatsAppConsent(prisma, await request.json(), auth.user) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to record consent.") }, { status: 400 }); }
}
