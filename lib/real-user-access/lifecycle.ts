export const ACCESS_REQUEST_STATES = [
  "PREPARED", "AWAITING_APPROVAL", "APPROVED_FOR_INVITATION", "INVITATION_CREATED",
  "INVITATION_SENT", "ACTIVATION_PENDING", "MFA_ENROLMENT_PENDING", "TRAINING_PENDING",
  "ACTIVE", "SUSPENDED", "LOCKED", "DISABLED", "ARCHIVED", "INVITATION_EXPIRED", "INVITATION_REVOKED", "REJECTED"
] as const;

export type AccessRequestState = (typeof ACCESS_REQUEST_STATES)[number];

export const ACCESS_REQUEST_TRANSITIONS: Readonly<Record<AccessRequestState, readonly AccessRequestState[]>> = {
  PREPARED: ["AWAITING_APPROVAL", "ARCHIVED"],
  AWAITING_APPROVAL: ["APPROVED_FOR_INVITATION", "REJECTED", "ARCHIVED"],
  APPROVED_FOR_INVITATION: ["INVITATION_CREATED", "ARCHIVED"],
  INVITATION_CREATED: ["INVITATION_SENT", "ACTIVATION_PENDING", "INVITATION_REVOKED", "INVITATION_EXPIRED"],
  INVITATION_SENT: ["ACTIVATION_PENDING", "INVITATION_REVOKED", "INVITATION_EXPIRED"],
  ACTIVATION_PENDING: ["MFA_ENROLMENT_PENDING", "TRAINING_PENDING", "ACTIVE", "INVITATION_REVOKED", "INVITATION_EXPIRED"],
  MFA_ENROLMENT_PENDING: ["TRAINING_PENDING", "ACTIVE", "INVITATION_REVOKED"],
  TRAINING_PENDING: ["MFA_ENROLMENT_PENDING", "ACTIVE", "INVITATION_REVOKED"],
  ACTIVE: ["SUSPENDED", "LOCKED", "DISABLED"],
  SUSPENDED: ["ACTIVE", "DISABLED", "ARCHIVED"],
  LOCKED: ["ACTIVE", "DISABLED"],
  DISABLED: ["ARCHIVED", "AWAITING_APPROVAL"],
  ARCHIVED: [], INVITATION_EXPIRED: ["APPROVED_FOR_INVITATION", "ARCHIVED"], INVITATION_REVOKED: ["APPROVED_FOR_INVITATION", "ARCHIVED"], REJECTED: ["PREPARED", "ARCHIVED"]
};

export function assertAccessTransition(from: string, to: string) {
  if (!ACCESS_REQUEST_STATES.includes(from as AccessRequestState) || !ACCESS_REQUEST_STATES.includes(to as AccessRequestState) || !ACCESS_REQUEST_TRANSITIONS[from as AccessRequestState].includes(to as AccessRequestState)) {
    throw new Error(`ACCESS_TRANSITION_REFUSED:${from}:${to}`);
  }
}

export type ActivationEvidence = {
  identityLinkReviewed: boolean;
  roleApproved: boolean;
  scopeApproved: boolean;
  invitationAccepted: boolean;
  credentialEstablished: boolean;
  mfaRequired: boolean;
  mfaEnrolled: boolean;
  trainingSatisfied: boolean;
  policySatisfied: boolean;
  eligible: boolean;
  featureEnabled: boolean;
};

export function activationBlockers(evidence: ActivationEvidence) {
  return Object.entries({
    IDENTITY_LINK_NOT_REVIEWED: evidence.identityLinkReviewed,
    ROLE_NOT_APPROVED: evidence.roleApproved,
    SCOPE_NOT_APPROVED: evidence.scopeApproved,
    INVITATION_NOT_ACCEPTED: evidence.invitationAccepted,
    CREDENTIAL_NOT_ESTABLISHED: evidence.credentialEstablished,
    MFA_NOT_ENROLLED: !evidence.mfaRequired || evidence.mfaEnrolled,
    TRAINING_NOT_SATISFIED: evidence.trainingSatisfied,
    POLICY_NOT_ACKNOWLEDGED: evidence.policySatisfied,
    PERSON_NOT_ELIGIBLE: evidence.eligible,
    FEATURE_DISABLED: evidence.featureEnabled
  }).filter(([, satisfied]) => !satisfied).map(([code]) => code);
}
