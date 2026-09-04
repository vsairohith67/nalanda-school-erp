export const COMMUNICATION_CHANNELS = ["IN_APP", "EMAIL", "SMS", "WHATSAPP", "NATIVE_PUSH"] as const;
export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];

export const COMMUNICATION_PURPOSES = [
  "SECURITY_CRITICAL",
  "SAFETY_CRITICAL",
  "TRANSACTIONAL",
  "ACADEMIC_OPERATIONAL",
  "ADMINISTRATIVE",
  "INFORMATIONAL_OPTIONAL",
  "MARKETING_PROHIBITED_OR_SEPARATELY_GOVERNED"
] as const;
export type CommunicationPurpose = (typeof COMMUNICATION_PURPOSES)[number];

export const COMMUNICATION_PRIORITIES = ["SECURITY", "SAFETY", "TRANSACTIONAL", "NORMAL", "OPTIONAL"] as const;
export type CommunicationPriority = (typeof COMMUNICATION_PRIORITIES)[number];

export const CONTACT_POINT_STATES = [
  "UNVERIFIED", "VERIFICATION_PENDING", "VERIFIED", "INVALID", "BOUNCED",
  "COMPLAINT", "OPTED_OUT", "CHANGED", "REVOKED", "EXPIRED"
] as const;

export const CONSENT_STATES = [
  "NOT_REQUIRED_BY_APPROVED_POLICY", "NOT_CAPTURED", "PENDING", "GRANTED", "REVOKED",
  "EXPIRED", "CONTACT_CHANGED_RECONFIRMATION_REQUIRED", "DISPUTED"
] as const;

export const OUTBOX_STATES = [
  "DRAFT", "PENDING_APPROVAL", "QUEUED", "SCHEDULED", "CLAIMED", "SENDING",
  "ACCEPTED_BY_PROVIDER", "SENT", "DELIVERED", "FAILED_RETRYABLE", "FAILED_PERMANENT",
  "SUPPRESSED", "CANCELLED", "EXPIRED", "DEAD_LETTER"
] as const;
export type CommunicationOutboxState = (typeof OUTBOX_STATES)[number];

export const DELIVERY_STATE_PRECEDENCE: Record<CommunicationOutboxState, number> = {
  DRAFT: 0,
  PENDING_APPROVAL: 1,
  QUEUED: 2,
  SCHEDULED: 2,
  CLAIMED: 3,
  SENDING: 4,
  FAILED_RETRYABLE: 4,
  ACCEPTED_BY_PROVIDER: 5,
  SENT: 6,
  DELIVERED: 7,
  FAILED_PERMANENT: 8,
  SUPPRESSED: 9,
  CANCELLED: 9,
  EXPIRED: 9,
  DEAD_LETTER: 9
};

export const TERMINAL_OUTBOX_STATES = new Set<CommunicationOutboxState>([
  "DELIVERED", "FAILED_PERMANENT", "SUPPRESSED", "CANCELLED", "EXPIRED", "DEAD_LETTER"
]);

const LEGAL_TRANSITIONS: Record<CommunicationOutboxState, readonly CommunicationOutboxState[]> = {
  DRAFT: ["PENDING_APPROVAL", "QUEUED", "CANCELLED"],
  PENDING_APPROVAL: ["QUEUED", "CANCELLED", "EXPIRED"],
  QUEUED: ["SCHEDULED", "CLAIMED", "SUPPRESSED", "CANCELLED", "EXPIRED"],
  SCHEDULED: ["CLAIMED", "SUPPRESSED", "CANCELLED", "EXPIRED"],
  CLAIMED: ["SENDING", "QUEUED", "FAILED_RETRYABLE", "FAILED_PERMANENT", "SUPPRESSED", "EXPIRED"],
  SENDING: ["ACCEPTED_BY_PROVIDER", "SENT", "DELIVERED", "FAILED_RETRYABLE", "FAILED_PERMANENT", "DEAD_LETTER"],
  ACCEPTED_BY_PROVIDER: ["SENT", "DELIVERED", "FAILED_PERMANENT"],
  SENT: ["DELIVERED", "FAILED_PERMANENT"],
  DELIVERED: [],
  FAILED_RETRYABLE: ["QUEUED", "CLAIMED", "DEAD_LETTER", "EXPIRED", "CANCELLED"],
  FAILED_PERMANENT: [],
  SUPPRESSED: [],
  CANCELLED: [],
  EXPIRED: [],
  DEAD_LETTER: ["QUEUED"]
};

export function isCommunicationChannel(value: unknown): value is CommunicationChannel {
  return typeof value === "string" && (COMMUNICATION_CHANNELS as readonly string[]).includes(value);
}

export function isCommunicationPurpose(value: unknown): value is CommunicationPurpose {
  return typeof value === "string" && (COMMUNICATION_PURPOSES as readonly string[]).includes(value);
}

export function isLegalOutboxTransition(from: CommunicationOutboxState, to: CommunicationOutboxState) {
  return from === to || LEGAL_TRANSITIONS[from].includes(to);
}

export function canApplyProviderState(current: CommunicationOutboxState, incoming: CommunicationOutboxState) {
  if (["SUPPRESSED", "CANCELLED", "EXPIRED", "DEAD_LETTER"].includes(current)) return false;
  if (!["ACCEPTED_BY_PROVIDER", "SENT", "DELIVERED", "FAILED_PERMANENT"].includes(incoming)) return false;
  if (current === "DELIVERED") return false;
  if (incoming === "FAILED_PERMANENT") return !["DELIVERED"].includes(current);
  return DELIVERY_STATE_PRECEDENCE[incoming] >= DELIVERY_STATE_PRECEDENCE[current];
}

export type CommunicationIntentInput = {
  eventType: string;
  purpose: CommunicationPurpose;
  module: string;
  sourceRecordType: string;
  sourceRecordId: string;
  sourceEventId: string;
  recipientPolicy: string;
  recipientScope: Record<string, unknown>;
  eligibleChannels: CommunicationChannel[];
  templateKey: string;
  templateVersion: number;
  localePreference?: string | null;
  priority: CommunicationPriority;
  notBefore?: Date | null;
  expiresAt?: Date | null;
  deduplicationKey: string;
  idempotencyKey: string;
  initiatingActorId: string;
  authorizingContext: Record<string, unknown>;
};

export type ResolvedCommunicationRecipient = {
  userId: string | null;
  subjectType: "USER" | "GUARDIAN" | "STAFF" | "SYNTHETIC";
  subjectReferenceId: string;
  role: string;
  locale: string;
};
