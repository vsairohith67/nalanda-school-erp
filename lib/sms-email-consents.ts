import type { AuthUser } from "@/lib/auth";
import { normalizeSmsEmailAddress } from "@/lib/sms-email-address";
import { normalizeSmsPhone } from "@/lib/sms-email-phone";
import { channelOf } from "@/lib/sms-email-profiles";

export const SMS_EMAIL_CONSENT_WORDING_VERSION = "NPS-SMS-EMAIL-OPS-v1-2026-07-18";
const SOURCES = new Set(["PARENT_PORTAL", "STAFF_PORTAL", "PAPER_FORM", "SCHOOL_OFFICE", "IMPORTED_WITH_EVIDENCE"]);

export async function recordSmsEmailConsent(client: any, input: any, actor: AuthUser) {
  const channel = channelOf(input?.channel);
  const subjectType = String(input?.subjectType ?? "").trim().toUpperCase();
  if (!["GUARDIAN", "STAFF"].includes(subjectType)) throw new Error("Consent subject must be Guardian or Staff.");
  if (!input?.explicitlyAgreed) throw new Error("Consent requires an explicit unchecked opt-in.");
  const subject = await authoritativeSubject(client, channel, subjectType, input, actor);
  const profile = await client.smsEmailIntegrationProfile.findFirst({ where: { channel }, orderBy: { createdAt: "asc" } });
  const contact = canonicalContact(channel, subject.contact, {
    defaultCountryCode: profile?.defaultCountryCode,
    allowDefaultCountryCode: Boolean(input?.confirmDefaultCountryCode)
  });
  if (channel === "SMS" && (contact as any).usedDefaultCountryCode && !input?.confirmDefaultCountryCode) throw new Error("Explicitly confirm the previewed country code before SMS opt-in.");
  const consentSource = String(input?.consentSource ?? (actor.role === "PARENT" ? "PARENT_PORTAL" : input?.ownStaffConsent ? "STAFF_PORTAL" : "SCHOOL_OFFICE")).toUpperCase();
  if (!SOURCES.has(consentSource)) throw new Error("Consent source is not supported.");
  if (["PAPER_FORM", "SCHOOL_OFFICE", "IMPORTED_WITH_EVIDENCE"].includes(consentSource) && !String(input?.evidenceReference ?? "").trim()) {
    throw new Error("Office, paper and imported consent require an evidence reference.");
  }
  return client.$transaction(async (tx: any) => {
    const subjectWhere = subjectType === "GUARDIAN" ? { guardianId: subject.id } : { staffMemberId: subject.id };
    const existing = await tx.smsEmailConsent.findFirst({ where: { channel, subjectType, contactHash: contact.contactHash, status: "OPTED_IN", ...subjectWhere } });
    if (existing) return existing;
    const stale = await tx.smsEmailConsent.findMany({ where: { channel, subjectType, status: "OPTED_IN", contactHash: { not: contact.contactHash }, ...subjectWhere } });
    for (const prior of stale) {
      await tx.smsEmailConsent.update({ where: { id: prior.id }, data: { status: "INVALIDATED", revokedByUserId: actor.id } });
      await tx.smsEmailConsentEvent.create({ data: {
        consentId: prior.id,
        eventType: channel === "SMS" ? "INVALIDATED_PHONE_CHANGE" : "INVALIDATED_EMAIL_CHANGE",
        previousStatus: "OPTED_IN", newStatus: "INVALIDATED", reason: "Authoritative contact changed", recordedByUserId: actor.id
      } });
    }
    const consent = await tx.smsEmailConsent.create({ data: {
      channel, subjectType, ...subjectWhere, contactHash: contact.contactHash, contactMasked: contact.masked,
      status: "OPTED_IN", consentSource, consentWordingVersion: SMS_EMAIL_CONSENT_WORDING_VERSION,
      evidenceReference: optional(input?.evidenceReference), optedInAt: new Date(),
      expiresAt: input?.expiresAt ? new Date(input.expiresAt) : null, collectedByUserId: actor.id
    } });
    await tx.smsEmailConsentEvent.create({ data: {
      consentId: consent.id, eventType: "OPTED_IN", newStatus: "OPTED_IN",
      consentWordingVersion: SMS_EMAIL_CONSENT_WORDING_VERSION, recordedByUserId: actor.id
    } });
    return consent;
  });
}

export async function optOutSmsEmailConsent(client: any, id: string, actor: AuthUser, reason = "Consent revoked", ownStaffOnly = false) {
  const consent = await client.smsEmailConsent.findUnique({ where: { id } });
  if (!consent) throw new Error("SMS/Email consent was not found.");
  if (actor.role === "PARENT" && consent.guardianId !== actor.guardianId) throw new Error("You can manage only your own Guardian consent.");
  if (ownStaffOnly || ["TEACHER", "ACCOUNTANT"].includes(actor.role)) {
    const staff = await client.staffMember.findFirst({ where: { userId: actor.id, status: "ACTIVE" }, select: { id: true } });
    if (!staff || consent.staffMemberId !== staff.id) throw new Error("You can manage only your own Staff consent.");
  }
  if (consent.status === "OPTED_OUT") return consent;
  return client.$transaction(async (tx: any) => {
    const row = await tx.smsEmailConsent.update({ where: { id }, data: { status: "OPTED_OUT", optedOutAt: new Date(), revokedByUserId: actor.id } });
    await tx.smsEmailConsentEvent.create({ data: {
      consentId: id, eventType: "OPTED_OUT", previousStatus: consent.status,
      newStatus: "OPTED_OUT", reason: String(reason).slice(0, 500), recordedByUserId: actor.id
    } });
    await tx.smsEmailDelivery.updateMany({
      where: { consentId: id, status: { in: ["QUEUED", "SENDING"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), nextRetryAt: null, retryable: false }
    });
    return row;
  });
}

export async function invalidateChangedSmsEmailConsent(client: any, id: string, actor: AuthUser, ownStaffOnly = false) {
  const consent = await client.smsEmailConsent.findUnique({ where: { id } });
  if (!consent) throw new Error("SMS/Email consent was not found.");
  if (actor.role === "PARENT" && consent.guardianId !== actor.guardianId) throw new Error("You can manage only your own Guardian consent.");
  let source: { primaryMobile?: string | null; mobile?: string | null; email?: string | null } | null;
  if (consent.subjectType === "GUARDIAN") {
    source = await client.guardian.findUnique({ where: { id: consent.guardianId }, select: { primaryMobile: true, email: true } });
  } else {
    const staff = await client.staffMember.findFirst({
      where: ownStaffOnly || ["TEACHER", "ACCOUNTANT"].includes(actor.role)
        ? { id: consent.staffMemberId, userId: actor.id, status: "ACTIVE" }
        : { id: consent.staffMemberId, status: "ACTIVE" },
      select: { mobile: true, email: true }
    });
    source = staff;
  }
  if (!source) throw new Error("Authoritative subject is unavailable.");
  const rawContact = consent.channel === "SMS" ? source.primaryMobile ?? source.mobile : source.email;
  let currentHash: string | null = null;
  try { currentHash = canonicalContact(consent.channel, rawContact, { defaultCountryCode: "+91", allowDefaultCountryCode: true }).contactHash; } catch {}
  if (currentHash === consent.contactHash) throw new Error("The authoritative contact has not changed.");
  if (consent.status === "INVALIDATED") return consent;
  return client.$transaction(async (tx: any) => {
    const row = await tx.smsEmailConsent.update({ where: { id }, data: { status: "INVALIDATED", revokedByUserId: actor.id } });
    await tx.smsEmailConsentEvent.create({ data: {
      consentId: id,
      eventType: consent.channel === "SMS" ? "INVALIDATED_PHONE_CHANGE" : "INVALIDATED_EMAIL_CHANGE",
      previousStatus: consent.status,
      newStatus: "INVALIDATED",
      reason: "Authoritative contact changed",
      recordedByUserId: actor.id
    } });
    await tx.smsEmailDelivery.updateMany({
      where: { consentId: id, status: { in: ["QUEUED", "SENDING"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), nextRetryAt: null, retryable: false }
    });
    return row;
  });
}

export async function clearSmsEmailSuppression(client: any, id: string, actor: AuthUser, reason: unknown) {
  if (!["SUPER_ADMIN", "DIRECTOR", "ADMIN"].includes(actor.role)) throw new Error("Authorised suppression review is required.");
  const reviewReason = String(reason ?? "").trim();
  if (reviewReason.length < 5) throw new Error("A meaningful suppression-clear review reason is required.");
  const row = await client.smsEmailSuppression.findUnique({ where: { id } });
  if (!row) throw new Error("Suppression was not found.");
  if (row.status === "CLEARED") return row;
  return client.smsEmailSuppression.update({
    where: { id }, data: { status: "CLEARED", reviewReason: reviewReason.slice(0, 500), clearedAt: new Date(), clearedByUserId: actor.id }
  });
}

export function canonicalContact(channel: "SMS" | "EMAIL", source: string | null | undefined, phoneOptions: any = {}) {
  return channel === "SMS" ? normalizeSmsPhone(source, phoneOptions) : normalizeSmsEmailAddress(source);
}

async function authoritativeSubject(client: any, channel: "SMS" | "EMAIL", subjectType: string, input: any, actor: AuthUser) {
  if (subjectType === "GUARDIAN") {
    const guardianId = actor.role === "PARENT" ? actor.guardianId : String(input?.guardianId ?? "");
    if (!guardianId) throw new Error("Parent account is not linked to a Guardian.");
    const guardian = await client.guardian.findUnique({ where: { id: guardianId }, select: { id: true, primaryMobile: true, email: true } });
    if (!guardian) throw new Error("Guardian was not found.");
    return { id: guardian.id, contact: channel === "SMS" ? guardian.primaryMobile : guardian.email };
  }
  const staff = input?.ownStaffConsent
    ? await client.staffMember.findFirst({ where: { userId: actor.id, status: "ACTIVE" }, select: { id: true, mobile: true, email: true } })
    : await client.staffMember.findUnique({ where: { id: String(input?.staffMemberId ?? "") }, select: { id: true, mobile: true, email: true } });
  if (!staff) throw new Error("Active linked StaffMember is required.");
  return { id: staff.id, contact: channel === "SMS" ? staff.mobile : staff.email };
}
function optional(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
