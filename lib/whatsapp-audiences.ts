import { normalizeWhatsAppPhone, WhatsAppPhoneError } from "@/lib/whatsapp-phone";
import { invalidateChangedPhoneConsents } from "@/lib/whatsapp-consents";

export type EligibleWhatsAppContact = {
  subjectType: "GUARDIAN" | "STAFF";
  subjectReferenceId: string;
  safeDisplayLabel: string;
  safeContext: Record<string, unknown>;
  e164: string;
  phoneHash: string;
  phoneLast4: string;
  countryCode: string;
  consentId: string;
  mockOutcome?: string | null;
};

export async function resolveWhatsAppAudience(client: any, campaignId: string, profileId: string, options: { mutateInvalidations?: boolean } = {}) {
  const [campaign, profile] = await Promise.all([
    client.notificationCampaign.findUnique({
      where: { id: campaignId },
      include: {
        recipients: {
          include: {
            user: {
              include: {
                guardian: { include: { students: { select: { studentId: true } } } },
                staffMember: true
              }
            }
          }
        }
      }
    }),
    client.whatsAppIntegrationProfile.findUnique({ where: { id: profileId } })
  ]);
  if (!campaign || campaign.status !== "PUBLISHED" || !campaign.publishedAt) throw new Error("Only a published Prompt 19A campaign can start a WhatsApp batch.");
  if (!profile) throw new Error("WhatsApp integration profile was not found.");
  const eligible: EligibleWhatsAppContact[] = [];
  const skipped: Array<{ subjectType: string; subjectReferenceId: string; reasonCode: string; safeLabel: string }> = [];
  for (const recipient of campaign.recipients) {
    const user = recipient.user;
    const guardian = user.role === "PARENT" ? user.guardian : null;
    const staff = user.role !== "PARENT" ? user.staffMember : null;
    const subjectType = guardian ? "GUARDIAN" : staff ? "STAFF" : null;
    const subject = guardian ?? staff;
    if (!subjectType || !subject) {
      skipped.push({
        subjectType: "UNMAPPED", subjectReferenceId: user.id,
        reasonCode: user.role === "PARENT" ? "NO_GUARDIAN_CONTEXT" : "NO_STAFF_CONTEXT",
        safeLabel: user.role
      });
      continue;
    }
    const phoneSource = subjectType === "GUARDIAN" ? (subject as any).primaryMobile : (subject as any).mobile;
    const label = subjectType === "GUARDIAN" ? "Parent/Guardian" : "Staff Member";
    let phone;
    try {
      phone = normalizeWhatsAppPhone(phoneSource, {
        defaultCountryCode: profile.defaultCountryCode,
        allowDefaultCountryCode: true
      });
    } catch (error) {
      skipped.push({
        subjectType, subjectReferenceId: subject.id,
        reasonCode: error instanceof WhatsAppPhoneError ? reportPhoneReason(error.code) : "INVALID_PHONE", safeLabel: label
      });
      continue;
    }
    if (options.mutateInvalidations) await invalidateChangedPhoneConsents(client, subjectType, subject.id, phone.phoneHash);
    const consent = await client.whatsAppConsent.findFirst({
      where: {
        subjectType, phoneHash: phone.phoneHash, status: "OPTED_IN",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...(subjectType === "GUARDIAN" ? { guardianId: subject.id } : { staffMemberId: subject.id })
      },
      orderBy: { optedInAt: "desc" }
    });
    if (!consent) {
      const prior = await client.whatsAppConsent.findFirst({
        where: { subjectType, ...(subjectType === "GUARDIAN" ? { guardianId: subject.id } : { staffMemberId: subject.id }) },
        orderBy: { createdAt: "desc" }
      });
      skipped.push({
        subjectType, subjectReferenceId: subject.id,
        reasonCode: prior?.phoneHash && prior.phoneHash !== phone.phoneHash ? "PHONE_CHANGED_AFTER_CONSENT" : prior?.status === "OPTED_OUT" ? "OPTED_OUT" : prior?.status === "EXPIRED" || (prior?.expiresAt && prior.expiresAt <= new Date()) ? "CONSENT_EXPIRED" : "NO_CONSENT",
        safeLabel: label
      });
      continue;
    }
    const context = safeRecipientContext(recipient.recipientContextJson, subjectType, guardian?.students?.length ?? 0);
    eligible.push({
      subjectType, subjectReferenceId: subject.id, safeDisplayLabel: label, safeContext: context,
      e164: phone.e164, phoneHash: phone.phoneHash, phoneLast4: phone.phoneLast4,
      countryCode: phone.countryCode, consentId: consent.id
    });
  }
  const hashes = new Map<string, EligibleWhatsAppContact[]>();
  for (const row of eligible) hashes.set(row.phoneHash, [...(hashes.get(row.phoneHash) ?? []), row]);
  const ambiguous = new Set([...hashes.entries()].filter(([, rows]) => new Set(rows.map((row) => `${row.subjectType}:${row.subjectReferenceId}`)).size > 1).map(([hash]) => hash));
  const finalEligible = eligible.filter((row) => {
    if (!ambiguous.has(row.phoneHash)) return true;
    skipped.push({ subjectType: row.subjectType, subjectReferenceId: row.subjectReferenceId, reasonCode: "AMBIGUOUS_PHONE", safeLabel: row.safeDisplayLabel });
    return false;
  });
  const deduped: EligibleWhatsAppContact[] = [], seen = new Set<string>();
  for (const row of finalEligible) {
    const key = `${row.subjectType}:${row.subjectReferenceId}`;
    if (seen.has(key)) {
      skipped.push({ subjectType: row.subjectType, subjectReferenceId: row.subjectReferenceId, reasonCode: "DUPLICATE_CONTACT", safeLabel: row.safeDisplayLabel });
      continue;
    }
    seen.add(key);
    deduped.push(row);
  }
  return { campaign, profile, eligible: deduped, skipped };
}

export function safeWhatsAppAudiencePreview(result: Awaited<ReturnType<typeof resolveWhatsAppAudience>>) {
  const reasons = new Map<string, number>();
  result.skipped.forEach((row) => reasons.set(row.reasonCode, (reasons.get(row.reasonCode) ?? 0) + 1));
  return {
    campaignNumber: result.campaign.campaignNumber,
    campaignRecipientRows: result.campaign.recipients.length,
    eligibleContacts: result.eligible.length,
    skippedContacts: result.skipped.length,
    deliveriesWritten: 0,
    contacts: result.eligible.map((row) => ({
      subjectType: row.subjectType, safeDisplayLabel: row.safeDisplayLabel,
      maskedPhone: `${row.countryCode} ••••••${row.phoneLast4}`, consentStatus: "OPTED_IN"
    })),
    skipReasons: [...reasons].map(([reasonCode, count]) => ({ reasonCode, count }))
  };
}

function safeRecipientContext(json: string, subjectType: string, fallbackChildCount: number) {
  try {
    const parsed = JSON.parse(json);
    const targetedChildren = Array.isArray(parsed?.targetedChildren) ? parsed.targetedChildren : [];
    return subjectType === "GUARDIAN"
      ? { contextType: "LINKED_CHILDREN", childCount: targetedChildren.length || fallbackChildCount, childLabel: targetedChildren.length > 1 || fallbackChildCount > 1 ? "Multiple linked children" : "Linked child" }
      : { contextType: "STAFF", scope: String(parsed?.scope ?? "School staff") };
  } catch {
    return subjectType === "GUARDIAN" ? { contextType: "LINKED_CHILDREN", childCount: fallbackChildCount } : { contextType: "STAFF" };
  }
}
function reportPhoneReason(code: string) {
  if (code === "NO_PHONE") return "NO_PHONE";
  if (code === "MISSING_COUNTRY_CODE") return "MISSING_COUNTRY_CODE";
  if (["EXTENSION", "MALFORMED", "INVALID_E164", "NOT_MOBILE", "INVALID_COUNTRY_CODE"].includes(code)) return "INVALID_PHONE";
  return "INVALID_PHONE";
}
