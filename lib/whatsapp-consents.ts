import type { AuthUser } from "@/lib/auth";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-phone";

export const WHATSAPP_CONSENT_WORDING_VERSION = "NPS-WA-OPS-v1-2026-07-17";
export const WHATSAPP_CONSENT_WORDING = "I agree to receive one-way Nalanda Public School operational updates on WhatsApp. I can opt out at any time.";

const SOURCES = new Set(["PARENT_PORTAL","STAFF_PORTAL","PAPER_FORM","SCHOOL_OFFICE","WHATSAPP_INBOUND_OPT_OUT","IMPORTED_WITH_EVIDENCE"]);

export async function recordWhatsAppConsent(client: any, input: any, actor: AuthUser) {
  const subjectType = String(input?.subjectType ?? "").toUpperCase();
  if (!["GUARDIAN", "STAFF"].includes(subjectType)) throw new Error("Consent subject must be Guardian or Staff.");
  const subject = await authoritativeSubject(client, subjectType, input, actor);
  const profile = await client.whatsAppIntegrationProfile.findFirst({ where: { status: { in: ["ACTIVE","CONFIGURED","DRAFT"] } }, orderBy: { createdAt: "asc" } });
  const phone = normalizeWhatsAppPhone(subject.phone, {
    defaultCountryCode: profile?.defaultCountryCode ?? "+91",
    allowDefaultCountryCode: Boolean(input?.confirmDefaultCountryCode)
  });
  if (phone.usedDefaultCountryCode && !input?.confirmDefaultCountryCode) {
    throw new Error(`Preview and explicitly confirm use of ${profile?.defaultCountryCode ?? "+91"} before opting in.`);
  }
  const consentSource = String(input?.consentSource ?? (actor.role === "PARENT" ? "PARENT_PORTAL" : input?.ownStaffConsent ? "STAFF_PORTAL" : "SCHOOL_OFFICE")).toUpperCase();
  if (!SOURCES.has(consentSource)) throw new Error("Consent source is not supported.");
  if (["PAPER_FORM", "SCHOOL_OFFICE", "IMPORTED_WITH_EVIDENCE"].includes(consentSource) && !String(input?.evidenceReference ?? "").trim()) {
    throw new Error("Paper, office, and imported consent requires an evidence reference.");
  }
  if (!input?.explicitlyAgreed) throw new Error("Consent must be an explicit opt-in. No checkbox may be pre-selected.");
  const duplicate = await client.whatsAppConsent.findFirst({
    where: {
      subjectType, phoneHash: phone.phoneHash, status: "OPTED_IN",
      ...(subjectType === "GUARDIAN" ? { guardianId: subject.id } : { staffMemberId: subject.id })
    }
  });
  if (duplicate) return duplicate;
  return client.$transaction(async (tx: any) => {
    const priorConsents = await tx.whatsAppConsent.findMany({
      where: {
        subjectType, status: "OPTED_IN",
        ...(subjectType === "GUARDIAN" ? { guardianId: subject.id } : { staffMemberId: subject.id })
      }
    });
    for (const prior of priorConsents) {
      await tx.whatsAppConsent.update({
        where: { id: prior.id },
        data: { status: "INVALIDATED", revokedByUserId: actor.id }
      });
      await tx.whatsAppConsentEvent.create({ data: {
        consentId: prior.id, eventType: "CONSENT_INVALIDATED_PHONE_CHANGE",
        previousStatus: "OPTED_IN", newStatus: "INVALIDATED",
        reason: "Authoritative source phone changed", recordedByUserId: actor.id
      } });
    }
    const consent = await tx.whatsAppConsent.create({
      data: {
        subjectType,
        guardianId: subjectType === "GUARDIAN" ? subject.id : null,
        staffMemberId: subjectType === "STAFF" ? subject.id : null,
        phoneHash: phone.phoneHash,
        phoneLast4: phone.phoneLast4,
        countryCode: phone.countryCode,
        status: "OPTED_IN",
        consentSource,
        consentWordingVersion: WHATSAPP_CONSENT_WORDING_VERSION,
        evidenceReference: optional(input?.evidenceReference),
        notes: optional(input?.notes),
        optedInAt: new Date(),
        expiresAt: input?.expiresAt ? new Date(input.expiresAt) : null,
        collectedByUserId: actor.id
      }
    });
    await tx.whatsAppConsentEvent.create({ data: {
      consentId: consent.id, eventType: "CONSENT_OPTED_IN", newStatus: "OPTED_IN",
      consentWordingVersion: WHATSAPP_CONSENT_WORDING_VERSION, recordedByUserId: actor.id
    } });
    return consent;
  });
}

export async function optOutWhatsAppConsent(client: any, consentId: string, actor: Pick<AuthUser, "id" | "role" | "guardianId">, reason = "Consent revoked", options: { ownStaffOnly?: boolean } = {}) {
  const consent = await client.whatsAppConsent.findUnique({ where: { id: consentId } });
  if (!consent) throw new Error("WhatsApp consent was not found.");
  if (actor.role === "PARENT" && consent.guardianId !== actor.guardianId) throw new Error("You can manage only your own Guardian consent.");
  if (options.ownStaffOnly || actor.role === "TEACHER") {
    const staff = await client.staffMember.findFirst({ where: { userId: actor.id, status: "ACTIVE" }, select: { id: true } });
    if (!staff || consent.staffMemberId !== staff.id) throw new Error("You can manage only your own Staff consent.");
  }
  if (consent.status === "OPTED_OUT") return consent;
  return client.$transaction(async (tx: any) => {
    const updated = await tx.whatsAppConsent.update({
      where: { id: consent.id },
      data: { status: "OPTED_OUT", optedOutAt: new Date(), revokedByUserId: actor.id }
    });
    await tx.whatsAppConsentEvent.create({ data: {
      consentId: consent.id, eventType: "CONSENT_OPTED_OUT", previousStatus: consent.status,
      newStatus: "OPTED_OUT", reason: String(reason).slice(0, 500), recordedByUserId: actor.id
    } });
    await tx.whatsAppDelivery.updateMany({
      where: { consentId: consent.id, status: { in: ["QUEUED","RETRY_PENDING","SENDING","SCHEDULED"] } },
      data: { status: "OPTED_OUT", optedOutAt: new Date(), nextAttemptAt: null, retryable: false }
    });
    return updated;
  });
}

export async function invalidateChangedPhoneConsents(client: any, subjectType: "GUARDIAN" | "STAFF", subjectId: string, currentHash: string) {
  const where = {
    subjectType, status: "OPTED_IN", phoneHash: { not: currentHash },
    ...(subjectType === "GUARDIAN" ? { guardianId: subjectId } : { staffMemberId: subjectId })
  };
  const stale = await client.whatsAppConsent.findMany({ where });
  for (const consent of stale) {
    await client.$transaction([
      client.whatsAppConsent.update({ where: { id: consent.id }, data: { status: "INVALIDATED" } }),
      client.whatsAppConsentEvent.create({ data: {
        consentId: consent.id, eventType: "CONSENT_INVALIDATED_PHONE_CHANGE",
        previousStatus: "OPTED_IN", newStatus: "INVALIDATED", reason: "Authoritative source phone changed"
      } })
    ]);
  }
  return stale.length;
}

async function authoritativeSubject(client: any, subjectType: string, input: any, actor: AuthUser) {
  if (subjectType === "GUARDIAN") {
    const guardianId = actor.role === "PARENT" ? actor.guardianId : String(input?.guardianId ?? "");
    if (!guardianId) throw new Error("Parent account is not linked to a Guardian.");
    const guardian = await client.guardian.findUnique({ where: { id: guardianId }, select: { id: true, primaryMobile: true } });
    if (!guardian) throw new Error("Guardian was not found.");
    return { id: guardian.id, phone: guardian.primaryMobile };
  }
  const staff = input?.ownStaffConsent
    ? await client.staffMember.findFirst({ where: { userId: actor.id, status: "ACTIVE" }, select: { id: true, mobile: true } })
    : await client.staffMember.findUnique({ where: { id: String(input?.staffMemberId ?? "") }, select: { id: true, mobile: true } });
  if (!staff) throw new Error("Staff account is not linked to a StaffMember.");
  return { id: staff.id, phone: staff.mobile };
}
function optional(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
