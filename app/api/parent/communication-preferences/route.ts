import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { optOutWhatsAppConsent, recordWhatsAppConsent } from "@/lib/whatsapp-consents";
import { invalidateChangedSmsEmailConsent, optOutSmsEmailConsent, recordSmsEmailConsent } from "@/lib/sms-email-consents";

export async function GET() {
  const auth = await requireApiPermission("MANAGE_OWN_WHATSAPP_CONSENT");
  if (auth.response) return auth.response;
  const smsEmailAuth = await requireApiPermission("MANAGE_OWN_SMS_EMAIL_CONSENT");
  if (smsEmailAuth.response) return smsEmailAuth.response;
  if (auth.user.role !== "PARENT" || !auth.user.guardianId) return NextResponse.json({ error: "Parent Guardian link required." }, { status: 403 });
  const [guardian, consent, external] = await Promise.all([
    prisma.guardian.findUnique({ where: { id: auth.user.guardianId }, select: { primaryMobile: true, email: true } }),
    prisma.whatsAppConsent.findFirst({ where: { guardianId: auth.user.guardianId }, orderBy: { createdAt: "desc" } }),
    prisma.smsEmailConsent.findMany({ where: { guardianId: auth.user.guardianId }, orderBy: { createdAt: "desc" } })
  ]);
  return NextResponse.json({ phoneConfigured: Boolean(guardian?.primaryMobile), emailConfigured: Boolean(guardian?.email), consent: consent ? ownConsent(consent) : null, external: external.map(ownExternalConsent) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_OWN_WHATSAPP_CONSENT");
  if (auth.response) return auth.response;
  const smsEmailAuth = await requireApiPermission("MANAGE_OWN_SMS_EMAIL_CONSENT");
  if (smsEmailAuth.response) return smsEmailAuth.response;
  if (auth.user.role !== "PARENT") return NextResponse.json({ error: "Parent access required." }, { status: 403 });
  try {
    const body = await request.json();
    if (["SMS", "EMAIL"].includes(String(body.channel).toUpperCase())) {
      const consent = body.action === "invalidate"
        ? await invalidateChangedSmsEmailConsent(prisma, String(body.consentId), auth.user)
        : body.action === "opt-out"
        ? await optOutSmsEmailConsent(prisma, String(body.consentId), auth.user, "Parent portal opt-out")
        : await recordSmsEmailConsent(prisma, { ...body, subjectType: "GUARDIAN", consentSource: "PARENT_PORTAL" }, auth.user);
      return NextResponse.json({ consent: ownExternalConsent(consent) });
    }
    const consent = body.action === "opt-out" ? await optOutWhatsAppConsent(prisma, String(body.consentId), auth.user, "Parent portal opt-out") : await recordWhatsAppConsent(prisma, { ...body, subjectType: "GUARDIAN", consentSource: "PARENT_PORTAL" }, auth.user);
    return NextResponse.json({ consent: ownConsent(consent) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Consent update failed.") }, { status: 400 }); }
}
function ownConsent(row: any) { return { id: row.id, status: row.status, phoneLast4: row.phoneLast4, countryCode: row.countryCode, optedInAt: row.optedInAt, optedOutAt: row.optedOutAt, expiresAt: row.expiresAt, wordingVersion: row.consentWordingVersion }; }
function ownExternalConsent(row: any) { return { id: row.id, channel: row.channel, status: row.status, contactMasked: row.contactMasked, optedInAt: row.optedInAt, optedOutAt: row.optedOutAt, expiresAt: row.expiresAt, wordingVersion: row.consentWordingVersion }; }
