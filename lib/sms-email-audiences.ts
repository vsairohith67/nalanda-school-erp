import { SmsEmailAddressError } from "@/lib/sms-email-address";
import { canonicalContact } from "@/lib/sms-email-consents";
import { SmsPhoneError } from "@/lib/sms-email-phone";
import type { SmsEmailChannel } from "@/lib/sms-email-provider";

export const SMS_EMAIL_SKIP_REASONS = [
  "NO_GUARDIAN_CONTEXT", "NO_STAFF_CONTEXT", "NO_PHONE", "INVALID_PHONE", "MISSING_COUNTRY_CODE",
  "AMBIGUOUS_PHONE", "NO_EMAIL", "INVALID_EMAIL", "AMBIGUOUS_EMAIL", "NO_CONSENT", "OPTED_OUT",
  "CONSENT_EXPIRED", "CONTACT_CHANGED_AFTER_CONSENT", "SUPPRESSED_CONTACT", "DUPLICATE_CONTACT",
  "TEMPLATE_NOT_APPROVED", "DLT_NOT_READY", "SENDER_DOMAIN_NOT_READY", "PROFILE_INACTIVE",
  "LIVE_SENDING_DISABLED", "QUIET_HOURS", "RATE_LIMIT", "COST_CAP", "CANCELLED"
] as const;

export async function resolveSmsEmailAudience(
  client: any,
  campaignId: string,
  profileId: string,
  channel: SmsEmailChannel,
  options: { mutateInvalidations?: boolean } = {}
) {
  const [campaign, profile] = await Promise.all([
    client.notificationCampaign.findUnique({
      where: { id: campaignId },
      include: { recipients: { include: { user: { include: { guardian: { include: { students: true } }, staffMember: true } } } } }
    }),
    client.smsEmailIntegrationProfile.findUnique({ where: { id: profileId } })
  ]);
  if (!campaign || campaign.status !== "PUBLISHED" || !campaign.publishedAt) throw new Error("Only a published Prompt 19A campaign can start an external batch.");
  if (!profile || profile.channel !== channel) throw new Error("Integration profile channel does not match the batch.");
  const eligible: any[] = [];
  const skipped: any[] = [];
  for (const recipient of campaign.recipients) {
    const guardian = recipient.user.role === "PARENT" ? recipient.user.guardian : null;
    const staff = recipient.user.role !== "PARENT" ? recipient.user.staffMember : null;
    const subjectType = guardian ? "GUARDIAN" : staff ? "STAFF" : null;
    const subject = guardian ?? staff;
    if (!subjectType || !subject || (subjectType === "STAFF" && (subject as any).status !== "ACTIVE")) {
      skipped.push(skip("UNMAPPED", recipient.userId, recipient.user.role === "PARENT" ? "NO_GUARDIAN_CONTEXT" : "NO_STAFF_CONTEXT"));
      continue;
    }
    const source = channel === "SMS"
      ? subjectType === "GUARDIAN" ? (subject as any).primaryMobile : (subject as any).mobile
      : (subject as any).email;
    let contact: any;
    try {
      contact = canonicalContact(channel, source, { defaultCountryCode: profile.defaultCountryCode, allowDefaultCountryCode: true });
    } catch (error) {
      const reason = error instanceof SmsPhoneError ? error.code
        : error instanceof SmsEmailAddressError ? error.code
        : channel === "SMS" ? "INVALID_PHONE" : "INVALID_EMAIL";
      skipped.push(skip(subjectType, subject.id, reason));
      continue;
    }
    const subjectWhere = subjectType === "GUARDIAN" ? { guardianId: subject.id } : { staffMemberId: subject.id };
    if (options.mutateInvalidations) {
      const stale = await client.smsEmailConsent.findMany({ where: { channel, subjectType, status: "OPTED_IN", contactHash: { not: contact.contactHash }, ...subjectWhere } });
      for (const prior of stale) {
        await client.$transaction([
          client.smsEmailConsent.update({ where: { id: prior.id }, data: { status: "INVALIDATED" } }),
          client.smsEmailConsentEvent.create({ data: {
            consentId: prior.id, eventType: channel === "SMS" ? "INVALIDATED_PHONE_CHANGE" : "INVALIDATED_EMAIL_CHANGE",
            previousStatus: "OPTED_IN", newStatus: "INVALIDATED", reason: "Authoritative contact changed"
          } })
        ]);
      }
    }
    const consent = await client.smsEmailConsent.findFirst({
      where: { channel, subjectType, contactHash: contact.contactHash, status: "OPTED_IN", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], ...subjectWhere },
      orderBy: { optedInAt: "desc" }
    });
    if (!consent) {
      const prior = await client.smsEmailConsent.findFirst({ where: { channel, subjectType, ...subjectWhere }, orderBy: { createdAt: "desc" } });
      const reason = prior?.contactHash && prior.contactHash !== contact.contactHash ? "CONTACT_CHANGED_AFTER_CONSENT"
        : prior?.status === "OPTED_OUT" ? "OPTED_OUT"
        : prior?.status === "EXPIRED" || (prior?.expiresAt && prior.expiresAt <= new Date()) ? "CONSENT_EXPIRED"
        : "NO_CONSENT";
      skipped.push(skip(subjectType, subject.id, reason));
      continue;
    }
    const suppression = await client.smsEmailSuppression.findFirst({ where: { channel, contactHash: contact.contactHash, status: "ACTIVE", ...subjectWhere } });
    if (suppression) {
      skipped.push(skip(subjectType, subject.id, "SUPPRESSED_CONTACT"));
      continue;
    }
    eligible.push({
      notificationRecipientId: recipient.id,
      subjectType,
      subjectId: subject.id,
      guardianId: subjectType === "GUARDIAN" ? subject.id : null,
      staffMemberId: subjectType === "STAFF" ? subject.id : null,
      canonicalContact: contact.canonical,
      contactHash: contact.contactHash,
      contactMasked: contact.masked,
      consentId: consent.id,
      safeContext: safeContext(recipient.recipientContextJson, subjectType, guardian?.students?.length ?? 0)
    });
  }
  const byHash = new Map<string, any[]>();
  for (const row of eligible) byHash.set(row.contactHash, [...(byHash.get(row.contactHash) ?? []), row]);
  const ambiguous = new Set([...byHash].filter(([, rows]) => new Set(rows.map((row) => `${row.subjectType}:${row.subjectId}`)).size > 1).map(([hash]) => hash));
  const seen = new Set<string>();
  const finalEligible = [];
  for (const row of eligible) {
    if (ambiguous.has(row.contactHash)) {
      skipped.push(skip(row.subjectType, row.subjectId, channel === "SMS" ? "AMBIGUOUS_PHONE" : "AMBIGUOUS_EMAIL"));
      continue;
    }
    const key = `${row.subjectType}:${row.subjectId}:${row.contactHash}`;
    if (seen.has(key)) {
      skipped.push(skip(row.subjectType, row.subjectId, "DUPLICATE_CONTACT"));
      continue;
    }
    seen.add(key);
    finalEligible.push(row);
  }
  return { campaign, profile, channel, eligible: finalEligible, skipped };
}

export function safeSmsEmailPreview(result: Awaited<ReturnType<typeof resolveSmsEmailAudience>>) {
  const counts: Record<string, number> = {};
  for (const row of result.skipped) counts[row.reasonCode] = (counts[row.reasonCode] ?? 0) + 1;
  return {
    campaignNumber: result.campaign.campaignNumber,
    channel: result.channel,
    campaignRecipientRows: result.campaign.recipients.length,
    eligibleContacts: result.eligible.length,
    skippedContacts: result.skipped.length,
    deliveriesWritten: 0,
    attemptsWritten: 0,
    contacts: result.eligible.slice(0, 10).map((row) => ({ subjectType: row.subjectType, maskedContact: row.contactMasked, consentStatus: "OPTED_IN" })),
    skipReasons: Object.entries(counts).map(([reasonCode, count]) => ({ reasonCode, count }))
  };
}

function skip(subjectType: string, subjectId: string, reasonCode: string) {
  return { subjectType, subjectId, reasonCode, safeLabel: subjectType === "GUARDIAN" ? "Parent/Guardian" : subjectType === "STAFF" ? "Staff Member" : "Unmapped recipient" };
}
function safeContext(json: string, subjectType: string, fallbackChildren: number) {
  try {
    const value = JSON.parse(json);
    const children = Array.isArray(value?.targetedChildren) ? value.targetedChildren : [];
    return subjectType === "GUARDIAN"
      ? { contextType: "LINKED_CHILDREN", childCount: children.length || fallbackChildren, childLabel: children.length > 1 || fallbackChildren > 1 ? "Multiple linked children" : "Linked child" }
      : { contextType: "STAFF", scope: String(value?.scope ?? "School staff").slice(0, 100) };
  } catch {
    return subjectType === "GUARDIAN" ? { contextType: "LINKED_CHILDREN", childCount: fallbackChildren } : { contextType: "STAFF" };
  }
}

