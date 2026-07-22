import { PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import { OwnWhatsAppConsentForm } from "@/components/whatsapp-forms";
import { OwnSmsEmailConsentForm } from "@/components/sms-email-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previewSmsPhone } from "@/lib/sms-email-phone";
import { normalizeSmsEmailAddress } from "@/lib/sms-email-address";
import { canonicalContact } from "@/lib/sms-email-consents";

export default async function ParentCommunicationPreferencesPage() {
  const user = await requirePermission("MANAGE_OWN_WHATSAPP_CONSENT");
  await requirePermission("MANAGE_OWN_SMS_EMAIL_CONSENT");
  if (user.role !== "PARENT") redirect("/unauthorized");
  if (!user.guardianId) return <div className="page sms-email-own-consent"><PageHeader title="Communication Preferences" description="A linked Parent Guardian profile is required." /></div>;
  const [guardian, consent, external] = await Promise.all([
    prisma.guardian.findUnique({ where: { id: user.guardianId }, select: { primaryMobile: true, email: true } }),
    prisma.whatsAppConsent.findFirst({ where: { guardianId: user.guardianId }, orderBy: { createdAt: "desc" } }),
    prisma.smsEmailConsent.findMany({ where: { guardianId: user.guardianId }, orderBy: { createdAt: "desc" } })
  ]);
  let phoneMask: string | null = null, emailMask: string | null = null;
  try { phoneMask = previewSmsPhone(guardian?.primaryMobile).masked; } catch {}
  try { emailMask = normalizeSmsEmailAddress(guardian?.email).masked; } catch {}
  const latest = (channel: string) => external.find((row) => row.channel === channel) ?? null;
  const changed = (channel: "SMS" | "EMAIL", source: string | null | undefined) => {
    const row = latest(channel);
    if (!row || row.status !== "OPTED_IN") return false;
    try { return canonicalContact(channel, source, { defaultCountryCode: "+91", allowDefaultCountryCode: true }).contactHash !== row.contactHash; }
    catch { return true; }
  };
  return <div className="page sms-email-own-consent"><PageHeader title="Communication Preferences" description="Manage only your own Guardian consent. Each one-way channel is independent." />
    <nav className="card card-pad page-actions sms-email-channel-tabs" role="tablist" aria-label="Communication channels"><a className="button secondary" role="tab" href="#whatsapp">WhatsApp</a><a className="button secondary" role="tab" href="#sms">SMS</a><a className="button secondary" role="tab" href="#email">Email</a></nav>
    <div id="whatsapp"><OwnWhatsAppConsentForm subjectType="GUARDIAN" existing={consent ? { id: consent.id, status: consent.status, phoneLast4: consent.phoneLast4, countryCode: consent.countryCode } : null} /></div>
    <OwnSmsEmailConsentForm channel="SMS" subjectType="GUARDIAN" maskedContact={phoneMask} existing={latest("SMS")} contactChanged={changed("SMS", guardian?.primaryMobile)} />
    <OwnSmsEmailConsentForm channel="EMAIL" subjectType="GUARDIAN" maskedContact={emailMask} existing={latest("EMAIL")} contactChanged={changed("EMAIL", guardian?.email)} />
  </div>;
}
