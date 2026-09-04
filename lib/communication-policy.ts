import { createHash } from "node:crypto";
import {
  COMMUNICATION_CHANNEL_FEATURES,
  COMMUNICATION_DELIVERY_FOUNDATION_FEATURE,
  operationalReleaseFeatureAvailability,
  requireOperationalReleaseFeatureForApi
} from "@/lib/release-feature-flag-runtime";
import type { CommunicationChannel, CommunicationPurpose } from "@/lib/communication-types";

export const COMMUNICATION_DEFAULT_TIMEZONE = "Asia/Kolkata";
export const COMMUNICATION_MAX_RECIPIENTS_PER_INTENT = 200;
export const COMMUNICATION_MAX_ITEMS_PER_WORKER_CLAIM = 100;
export const COMMUNICATION_WEBHOOK_MAX_BYTES = 64 * 1024;

export function communicationFeatureAvailability(channel?: CommunicationChannel) {
  const parent = operationalReleaseFeatureAvailability(COMMUNICATION_DELIVERY_FOUNDATION_FEATURE);
  if (!parent.enabled) return { enabled: false, reason: `PARENT_${parent.reason}`, parent, channel: null } as const;
  if (!channel) return { enabled: true, reason: parent.reason, parent, channel: null } as const;
  const child = operationalReleaseFeatureAvailability(COMMUNICATION_CHANNEL_FEATURES[channel]);
  if (!child.enabled) return { enabled: false, reason: `CHANNEL_${child.reason}`, parent, channel: child } as const;
  return { enabled: true, reason: child.reason, parent, channel: child } as const;
}
export function requireCommunicationFeatureForApi(channel?: CommunicationChannel) {
  const parent = requireOperationalReleaseFeatureForApi(COMMUNICATION_DELIVERY_FOUNDATION_FEATURE);
  if (parent) return parent;
  return channel ? requireOperationalReleaseFeatureForApi(COMMUNICATION_CHANNEL_FEATURES[channel]) : null;
}

export function consentRequired(purpose: CommunicationPurpose) {
  return ["ACADEMIC_OPERATIONAL", "ADMINISTRATIVE", "INFORMATIONAL_OPTIONAL"].includes(purpose);
}

export function optionalPreferenceMaySuppress(purpose: CommunicationPurpose) {
  return purpose === "INFORMATIONAL_OPTIONAL";
}

export function purposeDeliveryPolicy(purpose: CommunicationPurpose) {
  if (purpose === "MARKETING_PROHIBITED_OR_SEPARATELY_GOVERNED") {
    return { allowed: false, consentRequired: true, policy: "PROHIBITED_PENDING_SEPARATE_GOVERNANCE" } as const;
  }
  return {
    allowed: true,
    consentRequired: consentRequired(purpose),
    policy: consentRequired(purpose)
      ? "EXPLICIT_CHANNEL_AND_PURPOSE_CONSENT_REQUIRED"
      : "INTERNAL_POLICY_CLASSIFICATION_PENDING_FORMAL_LEGAL_APPROVAL"
  } as const;
}

export function validateActionPath(value: unknown) {
  if (value == null || value === "") return null;
  const path = String(value).trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\u0000-\u001f]/.test(path)) {
    throw new Error("COMMUNICATION_ACTION_PATH_NOT_ALLOWED");
  }
  const parsed = new URL(path, "https://nalanda.invalid");
  if (parsed.origin !== "https://nalanda.invalid" || /^(?:javascript|data|file):/i.test(path)) throw new Error("COMMUNICATION_ACTION_PATH_NOT_ALLOWED");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function validateEmergencyOverride(input: {
  purpose: CommunicationPurpose;
  reason?: string | null;
  stepUpGrantId?: string | null;
  actorRole: string;
}) {
  if (input.purpose !== "SAFETY_CRITICAL") throw new Error("EMERGENCY_OVERRIDE_SAFETY_ONLY");
  if (!["SUPER_ADMIN", "DIRECTOR"].includes(input.actorRole)) throw new Error("EMERGENCY_OVERRIDE_ROLE_DENIED");
  if (!String(input.reason ?? "").trim() || !String(input.stepUpGrantId ?? "").trim()) throw new Error("EMERGENCY_OVERRIDE_EVIDENCE_REQUIRED");
  return { approved: true, audited: true } as const;
}

export function validateAudienceSize(input: { count: number; approved: boolean; stepUpGrantId?: string | null }) {
  if (!Number.isInteger(input.count) || input.count < 0) throw new Error("COMMUNICATION_AUDIENCE_COUNT_INVALID");
  if (input.count > COMMUNICATION_MAX_RECIPIENTS_PER_INTENT && (!input.approved || !input.stepUpGrantId)) {
    throw new Error("COMMUNICATION_LARGE_AUDIENCE_APPROVAL_REQUIRED");
  }
}

export function isQuietHours(input: { now: Date; start?: string | null; end?: string | null; timeZone?: string | null }) {
  if (!input.start || !input.end) return false;
  const clock = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!clock.test(input.start) || !clock.test(input.end)) throw new Error("COMMUNICATION_QUIET_HOURS_INVALID");
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: input.timeZone || COMMUNICATION_DEFAULT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(input.now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const current = hour * 60 + minute;
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const start = toMinutes(input.start), end = toMinutes(input.end);
  return start === end ? false : start < end ? current >= start && current < end : current >= start || current < end;
}

export function communicationRoleCapabilities(role: string) {
  const own = ["PARENT", "STUDENT", "TEACHER", "ACCOUNTANT", "COMPUTER_OPERATOR", "GATE_STAFF"].includes(role);
  return {
    viewOwn: own || ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN"].includes(role),
    manageOwnPreferences: own || ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN"].includes(role),
    viewOperations: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role),
    manageTemplates: ["SUPER_ADMIN"].includes(role),
    approveLargeAudience: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role),
    emergencyOverride: ["SUPER_ADMIN", "DIRECTOR"].includes(role),
    arbitraryRecipientOrMessage: false,
    activateLiveProvider: false
  } as const;
}

export function safeDestinationDigest(channel: CommunicationChannel, canonicalDestination: string, pepper: string) {
  if (pepper.length < 24) throw new Error("COMMUNICATION_DESTINATION_PEPPER_REQUIRED");
  return createHash("sha256").update(`${channel}\u0000${pepper}\u0000${canonicalDestination}`).digest("hex");
}

export function safeMetricDimensions(input: Record<string, unknown>) {
  const forbidden = /(?:user|recipient|phone|email|destination|message|contact).*id|phone|email|destination|messageId/i;
  for (const key of Object.keys(input)) if (forbidden.test(key)) throw new Error("COMMUNICATION_HIGH_CARDINALITY_METRIC_LABEL_DENIED");
  return input;
}
