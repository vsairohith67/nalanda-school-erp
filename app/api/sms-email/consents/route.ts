import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { optOutSmsEmailConsent, recordSmsEmailConsent } from "@/lib/sms-email-consents";

export async function GET() {
  const auth = await requireApiPermission("MANAGE_SMS_EMAIL_CONSENTS"); if (auth.response) return auth.response;
  return NextResponse.json({ consents: await prisma.smsEmailConsent.findMany({ take: 200, orderBy: { createdAt: "desc" } }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_SMS_EMAIL_CONSENTS"); if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const consent = body.action === "opt-out" ? await optOutSmsEmailConsent(prisma, String(body.consentId), auth.user, body.reason) : await recordSmsEmailConsent(prisma, body, auth.user);
    return NextResponse.json({ consent }, { status: body.action === "opt-out" ? 200 : 201 });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Consent request failed.") }, { status: 400 }); }
}

