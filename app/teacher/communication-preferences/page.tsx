import { PageHeader } from "@/components/ui";
import { redirect } from "next/navigation";
import { OwnWhatsAppConsentForm } from "@/components/whatsapp-forms";
import { OwnSmsEmailConsentForm } from "@/components/sms-email-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previewWhatsAppPhone } from "@/lib/whatsapp-phone";
import { previewSmsPhone } from "@/lib/sms-email-phone";
import { normalizeSmsEmailAddress } from "@/lib/sms-email-address";
import { canonicalContact } from "@/lib/sms-email-consents";

export default async function TeacherCommunicationPreferencesPage() {
  const user = await requirePermission("MANAGE_OWN_WHATSAPP_CONSENT");
  await requirePermission("MANAGE_OWN_SMS_EMAIL_CONSENT");
  if (user.role === "PARENT") redirect("/unauthorized");
  const staff = await prisma.staffMember.findFirst({ where: { userId: user.id, status: "ACTIVE" }, select: { id: true, mobile: true, email: true } });
  const [consent, external] = staff ? await Promise.all([
    prisma.whatsAppConsent.findFirst({ where: { staffMemberId: staff.id }, orderBy: { createdAt: "desc" } }),
    prisma.smsEmailConsent.findMany({ where: { staffMemberId: staff.id }, orderBy: { createdAt: "desc" } })
  ]) : [null, []];
  let authoritativeMask: string | null = null;
  if (staff) {
    try {
      const phone = previewWhatsAppPhone(staff.mobile);
      authoritativeMask = `${phone.countryCode} ******${phone.phoneLast4}`;
    } catch {
      authoritativeMask = null;
    }
  }
  let smsMask: string | null = null, emailMask: string | null = null;
  try { smsMask = previewSmsPhone(staff?.mobile).masked; } catch {}
  try { emailMask = normalizeSmsEmailAddress(staff?.email).masked; } catch {}
  const latest = (channel: string) => external.find((row: any) => row.channel === channel) ?? null;
  const changed = (channel: "SMS" | "EMAIL", source: string | null | undefined) => {
    const row = latest(channel);
    if (!row || row.status !== "OPTED_IN") return false;
    try { return canonicalContact(channel, source, { defaultCountryCode: "+91", allowDefaultCountryCode: true }).contactHash !== row.contactHash; }
    catch { return true; }
  };
  return <div className="page sms-email-own-consent"><PageHeader title="Communication Preferences" description="Manage only your own linked Staff channel consent." />{staff ? <>
    <nav className="card card-pad page-actions sms-email-channel-tabs" role="tablist" aria-label="Communication channels"><a className="button secondary" role="tab" href="#whatsapp">WhatsApp</a><a className="button secondary" role="tab" href="#sms">SMS</a><a className="button secondary" role="tab" href="#email">Email</a></nav>
    <div id="whatsapp"><OwnWhatsAppConsentForm subjectType="STAFF" authoritativeMask={authoritativeMask} existing={consent ? { id: consent.id, status: consent.status, phoneLast4: consent.phoneLast4, countryCode: consent.countryCode } : null} /></div>
    <OwnSmsEmailConsentForm channel="SMS" subjectType="STAFF" maskedContact={smsMask} existing={latest("SMS")} contactChanged={changed("SMS", staff.mobile)} />
    <OwnSmsEmailConsentForm channel="EMAIL" subjectType="STAFF" maskedContact={emailMask} existing={latest("EMAIL")} contactChanged={changed("EMAIL", staff.email)} />
  </> : <div className="notice">Your active user account is not linked to an active StaffMember. Ask an authorised administrator to correct the staff link; no consent was changed.</div>}</div>;
}
