import type { PrismaClient } from "@prisma/client";

type BackupRow = Record<string, unknown>;

export const REAL_USER_ACCESS_BACKUP_KEYS = [
  "accessRequests", "invitations", "mfaAuthenticators", "mfaRecoveryCodes",
  "trainingModules", "trainingAcknowledgements", "policyAcknowledgements",
  "accessCertifications", "mfaRecoveryRequests"
] as const;

export type RealUserAccessBackupKey = (typeof REAL_USER_ACCESS_BACKUP_KEYS)[number];
export type RealUserAccessBackup = Record<RealUserAccessBackupKey, BackupRow[]>;

const ALLOWED: Record<RealUserAccessBackupKey, Set<string>> = {
  accessRequests: keys("id publicKey candidateUserId personType staffMemberId guardianId studentId requestedName requestedUsername requestedEmail requestedRolesJson requestedScopesJson reason status identityLinkReviewed roleApproved scopeApproved eligibilityConfirmed mfaRequired trainingRequirementsJson policyRequirementsJson conflictWarningsJson requestedByUserId reviewedByUserId approvedByUserId rejectedByUserId requestedValidUntil reviewDueAt decidedAt version createdAt updatedAt"),
  invitations: keys("id publicKey accessRequestId userId secretHash purpose environment roleSnapshotHash credentialVersion status attempts maxAttempts expiresAt usedAt revokedAt revocationReason deliveryKind deliveredAt issuedByUserId createdAt"),
  mfaAuthenticators: keys("id publicKey userId type status displayName secretEnvelope keyVersion totpAlgorithm totpDigits totpPeriod totpLastUsedStep credentialId credentialPublicKeyBase64 credentialCounter credentialDeviceType credentialBackedUp transportsJson rpId verifiedAt lastUsedAt revokedAt revokedByUserId revocationReason version createdAt updatedAt"),
  mfaRecoveryCodes: keys("id userId authenticatorId recoveryCodeHash status usedAt revokedAt createdAt"),
  trainingModules: keys("id publicKey moduleKey versionNumber title audienceRolesJson status requiredForActivation expiresAfterDays createdAt"),
  trainingAcknowledgements: keys("id userId moduleVersionId accessRequestId status assignedAt completedAt expiresAt acknowledgement waivedAt waiverReason waiverApprovedByUserId createdAt updatedAt"),
  policyAcknowledgements: keys("id userId accessRequestId policyKey versionNumber acknowledgement acceptedAt"),
  accessCertifications: keys("id publicKey userId accessRequestId status dueAt startedAt decidedAt reviewerUserId decision reason scopeSnapshotJson nextReviewAt createdAt updatedAt"),
  mfaRecoveryRequests: keys("id publicKey userId factorType status reason evidenceJson requestedByUserId reviewedByUserId approvedByUserId decidedAt createdAt updatedAt")
};

export function emptyRealUserAccessBackup(): RealUserAccessBackup {
  return Object.fromEntries(REAL_USER_ACCESS_BACKUP_KEYS.map((key) => [key, []])) as unknown as RealUserAccessBackup;
}

export function sanitizeRealUserAccessBackup(input?: Partial<Record<RealUserAccessBackupKey, readonly object[]>>): RealUserAccessBackup {
  const output = emptyRealUserAccessBackup();
  for (const key of REAL_USER_ACCESS_BACKUP_KEYS) {
    output[key] = (input?.[key] ?? []).map((row) => Object.fromEntries(Object.entries(row).filter(([field]) => ALLOWED[key].has(field))));
  }
  return output;
}

export function validateRealUserAccessBackup(
  root: Record<string, unknown>,
  references: { userIds: Set<string>; studentIds: Set<string>; guardianIds: Set<string>; staffMemberIds: Set<string> }
): RealUserAccessBackup {
  const output = emptyRealUserAccessBackup();
  for (const key of REAL_USER_ACCESS_BACKUP_KEYS) output[key] = boundedRows(root[key], `authSecurity.${key}`, ALLOWED[key]);

  const requestIds = uniqueIds(output.accessRequests, "accessRequests");
  for (const [index, row] of output.accessRequests.entries()) {
    const label = `authSecurity.accessRequests[${index}]`;
    requiredReference(row.requestedByUserId, references.userIds, `${label}.requestedByUserId`);
    optionalReference(row.candidateUserId, references.userIds, `${label}.candidateUserId`);
    optionalReference(row.reviewedByUserId, references.userIds, `${label}.reviewedByUserId`);
    optionalReference(row.approvedByUserId, references.userIds, `${label}.approvedByUserId`);
    optionalReference(row.rejectedByUserId, references.userIds, `${label}.rejectedByUserId`);
    optionalReference(row.studentId, references.studentIds, `${label}.studentId`);
    optionalReference(row.guardianId, references.guardianIds, `${label}.guardianId`);
    optionalReference(row.staffMemberId, references.staffMemberIds, `${label}.staffMemberId`);
  }

  uniqueIds(output.invitations, "invitations");
  for (const [index, row] of output.invitations.entries()) {
    const label = `authSecurity.invitations[${index}]`;
    requiredReference(row.accessRequestId, requestIds, `${label}.accessRequestId`);
    requiredReference(row.userId, references.userIds, `${label}.userId`);
    requiredReference(row.issuedByUserId, references.userIds, `${label}.issuedByUserId`);
  }

  const factorIds = uniqueIds(output.mfaAuthenticators, "mfaAuthenticators");
  for (const [index, row] of output.mfaAuthenticators.entries()) {
    requiredReference(row.userId, references.userIds, `authSecurity.mfaAuthenticators[${index}].userId`);
    optionalReference(row.revokedByUserId, references.userIds, `authSecurity.mfaAuthenticators[${index}].revokedByUserId`);
    if (row.type === "WEBAUTHN" && typeof row.credentialPublicKeyBase64 !== "string") throw new Error(`authSecurity.mfaAuthenticators[${index}] is missing its public credential`);
    if (row.type === "TOTP" && typeof row.secretEnvelope !== "string") throw new Error(`authSecurity.mfaAuthenticators[${index}] is missing its encrypted envelope`);
  }

  uniqueIds(output.mfaRecoveryCodes, "mfaRecoveryCodes");
  for (const [index, row] of output.mfaRecoveryCodes.entries()) {
    requiredReference(row.userId, references.userIds, `authSecurity.mfaRecoveryCodes[${index}].userId`);
    optionalReference(row.authenticatorId, factorIds, `authSecurity.mfaRecoveryCodes[${index}].authenticatorId`);
  }

  const moduleIds = uniqueIds(output.trainingModules, "trainingModules");
  uniqueIds(output.trainingAcknowledgements, "trainingAcknowledgements");
  for (const [index, row] of output.trainingAcknowledgements.entries()) {
    requiredReference(row.userId, references.userIds, `authSecurity.trainingAcknowledgements[${index}].userId`);
    requiredReference(row.moduleVersionId, moduleIds, `authSecurity.trainingAcknowledgements[${index}].moduleVersionId`);
    optionalReference(row.accessRequestId, requestIds, `authSecurity.trainingAcknowledgements[${index}].accessRequestId`);
    optionalReference(row.waiverApprovedByUserId, references.userIds, `authSecurity.trainingAcknowledgements[${index}].waiverApprovedByUserId`);
  }

  for (const key of ["policyAcknowledgements", "accessCertifications"] as const) {
    uniqueIds(output[key], key);
    for (const [index, row] of output[key].entries()) {
      requiredReference(row.userId, references.userIds, `authSecurity.${key}[${index}].userId`);
      optionalReference(row.accessRequestId, requestIds, `authSecurity.${key}[${index}].accessRequestId`);
      if (key === "accessCertifications") optionalReference(row.reviewerUserId, references.userIds, `authSecurity.${key}[${index}].reviewerUserId`);
    }
  }

  uniqueIds(output.mfaRecoveryRequests, "mfaRecoveryRequests");
  for (const [index, row] of output.mfaRecoveryRequests.entries()) {
    const label = `authSecurity.mfaRecoveryRequests[${index}]`;
    requiredReference(row.userId, references.userIds, `${label}.userId`);
    requiredReference(row.requestedByUserId, references.userIds, `${label}.requestedByUserId`);
    optionalReference(row.reviewedByUserId, references.userIds, `${label}.reviewedByUserId`);
    optionalReference(row.approvedByUserId, references.userIds, `${label}.approvedByUserId`);
  }
  return output;
}

export async function loadRealUserAccessBackup(client: PrismaClient): Promise<RealUserAccessBackup> {
  const [accessRequests, invitations, factors, recoveryCodes, trainingModules, trainingAcknowledgements, policyAcknowledgements, accessCertifications, recoveryRequests] = await Promise.all([
    client.userAccessRequest.findMany({ orderBy: { createdAt: "asc" } }),
    client.userInvitation.findMany({ orderBy: { createdAt: "asc" } }),
    client.mfaAuthenticator.findMany({ orderBy: { createdAt: "asc" } }),
    client.mfaRecoveryCode.findMany({ orderBy: { createdAt: "asc" } }),
    client.trainingModuleVersion.findMany({ orderBy: [{ moduleKey: "asc" }, { versionNumber: "asc" }] }),
    client.userTrainingAcknowledgement.findMany({ orderBy: { createdAt: "asc" } }),
    client.userPolicyAcknowledgement.findMany({ orderBy: { acceptedAt: "asc" } }),
    client.accessCertification.findMany({ orderBy: { createdAt: "asc" } }),
    client.mfaRecoveryRequest.findMany({ orderBy: { createdAt: "asc" } })
  ]);
  return sanitizeRealUserAccessBackup({
    accessRequests,
    invitations: invitations.map(({ tokenHash, ...row }) => ({ ...row, secretHash: tokenHash })),
    mfaAuthenticators: factors.map(({ credentialPublicKey, ...row }) => ({ ...row, credentialPublicKeyBase64: credentialPublicKey ? Buffer.from(credentialPublicKey).toString("base64") : null })),
    mfaRecoveryCodes: recoveryCodes.map(({ codeHash, ...row }) => ({ ...row, recoveryCodeHash: codeHash })),
    trainingModules,
    trainingAcknowledgements,
    policyAcknowledgements,
    accessCertifications,
    mfaRecoveryRequests: recoveryRequests
  });
}

export function realUserAccessRecordCount(value: RealUserAccessBackup) {
  return REAL_USER_ACCESS_BACKUP_KEYS.reduce((total, key) => total + value[key].length, 0);
}

function keys(value: string) { return new Set(value.split(" ")); }
function boundedRows(input: unknown, label: string, allowed: Set<string>): BackupRow[] {
  if (input === undefined) return [];
  if (!Array.isArray(input) || input.length > 100_000) throw new Error(`${label} must be a bounded array`);
  return input.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}[${index}] must be an object`);
    const row = value as BackupRow;
    for (const field of Object.keys(row)) if (!allowed.has(field)) throw new Error(`${label}[${index}].${field} is not supported`);
    return row;
  });
}
function uniqueIds(rows: BackupRow[], label: string) {
  const ids = new Set<string>();
  rows.forEach((row, index) => {
    if (typeof row.id !== "string" || !row.id || ids.has(row.id)) throw new Error(`authSecurity.${label}[${index}].id is invalid or duplicated`);
    ids.add(row.id);
  });
  return ids;
}
function requiredReference(value: unknown, set: Set<string>, label: string) {
  if (typeof value !== "string" || !set.has(value)) throw new Error(`${label} does not match a backup record`);
}
function optionalReference(value: unknown, set: Set<string>, label: string) {
  if (value != null) requiredReference(value, set, label);
}
