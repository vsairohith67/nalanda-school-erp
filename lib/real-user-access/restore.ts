import type { RealUserAccessBackup } from "@/lib/real-user-access/backup";

type ResultBucket = { created: number; updated: number; skipped: number; errors: string[] };
type RestoreMaps = {
  users: Map<string, string>;
  students: Map<string, string>;
  guardians: Map<string, string>;
  staff: Map<string, string>;
};

export async function restoreRealUserAccessBackup(
  client: any,
  backup: RealUserAccessBackup,
  maps: RestoreMaps,
  result: { authSecurity: ResultBucket; warnings: string[] }
) {
  const restoredAt = new Date();
  const requests = new Map<string, string>();
  const factors = new Map<string, string>();
  const modules = new Map<string, string>();

  for (const [index, row] of backup.accessRequests.entries()) await restoreRow(result, "Access request", index, async () => {
    const existing = await findExisting(client.userAccessRequest, row);
    if (existing) { requests.set(required(row.id), existing.id); return false; }
    const requestedByUserId = mappedRequired(row.requestedByUserId, maps.users);
    const created = await client.userAccessRequest.create({ data: {
      id: required(row.id), publicKey: required(row.publicKey),
      candidateUserId: mapped(row.candidateUserId, maps.users), personType: required(row.personType),
      staffMemberId: mapped(row.staffMemberId, maps.staff), guardianId: mapped(row.guardianId, maps.guardians), studentId: mapped(row.studentId, maps.students),
      requestedName: required(row.requestedName), requestedUsername: required(row.requestedUsername), requestedEmail: optionalText(row.requestedEmail),
      requestedRolesJson: required(row.requestedRolesJson), requestedScopesJson: required(row.requestedScopesJson), reason: required(row.reason), status: required(row.status),
      identityLinkReviewed: Boolean(row.identityLinkReviewed), roleApproved: Boolean(row.roleApproved), scopeApproved: Boolean(row.scopeApproved), eligibilityConfirmed: Boolean(row.eligibilityConfirmed), mfaRequired: Boolean(row.mfaRequired),
      trainingRequirementsJson: required(row.trainingRequirementsJson), policyRequirementsJson: required(row.policyRequirementsJson), conflictWarningsJson: required(row.conflictWarningsJson),
      requestedByUserId, reviewedByUserId: mapped(row.reviewedByUserId, maps.users), approvedByUserId: mapped(row.approvedByUserId, maps.users), rejectedByUserId: mapped(row.rejectedByUserId, maps.users),
      requestedValidUntil: date(row.requestedValidUntil), reviewDueAt: date(row.reviewDueAt), decidedAt: date(row.decidedAt), version: integer(row.version, 1),
      createdAt: date(row.createdAt) ?? restoredAt, updatedAt: date(row.updatedAt) ?? restoredAt
    } });
    requests.set(required(row.id), created.id); return true;
  });

  for (const [index, row] of backup.trainingModules.entries()) await restoreRow(result, "Training module", index, async () => {
    const existing = await findExisting(client.trainingModuleVersion, row);
    if (existing) { modules.set(required(row.id), existing.id); return false; }
    const created = await client.trainingModuleVersion.create({ data: {
      id: required(row.id), publicKey: required(row.publicKey), moduleKey: required(row.moduleKey), versionNumber: integer(row.versionNumber, 1), title: required(row.title), audienceRolesJson: required(row.audienceRolesJson), status: required(row.status), requiredForActivation: Boolean(row.requiredForActivation), expiresAfterDays: nullableInteger(row.expiresAfterDays), createdAt: date(row.createdAt) ?? restoredAt
    } });
    modules.set(required(row.id), created.id); return true;
  });

  for (const [index, row] of backup.mfaAuthenticators.entries()) await restoreRow(result, "MFA authenticator", index, async () => {
    const existing = await findExisting(client.mfaAuthenticator, row);
    if (existing) { factors.set(required(row.id), existing.id); return false; }
    const publicKeyBytes = typeof row.credentialPublicKeyBase64 === "string" ? Buffer.from(row.credentialPublicKeyBase64, "base64") : null;
    const created = await client.mfaAuthenticator.create({ data: {
      id: required(row.id), publicKey: required(row.publicKey), userId: mappedRequired(row.userId, maps.users), type: required(row.type), status: required(row.status), displayName: required(row.displayName),
      secretEnvelope: optionalText(row.secretEnvelope), keyVersion: optionalText(row.keyVersion), totpAlgorithm: optionalText(row.totpAlgorithm), totpDigits: nullableInteger(row.totpDigits), totpPeriod: nullableInteger(row.totpPeriod), totpLastUsedStep: nullableInteger(row.totpLastUsedStep),
      credentialId: optionalText(row.credentialId), credentialPublicKey: publicKeyBytes, credentialCounter: optionalText(row.credentialCounter), credentialDeviceType: optionalText(row.credentialDeviceType), credentialBackedUp: optionalBoolean(row.credentialBackedUp), transportsJson: optionalText(row.transportsJson), rpId: optionalText(row.rpId),
      verifiedAt: date(row.verifiedAt), lastUsedAt: date(row.lastUsedAt), revokedAt: date(row.revokedAt), revokedByUserId: mapped(row.revokedByUserId, maps.users), revocationReason: optionalText(row.revocationReason), version: integer(row.version, 1), createdAt: date(row.createdAt) ?? restoredAt, updatedAt: date(row.updatedAt) ?? restoredAt
    } });
    factors.set(required(row.id), created.id); return true;
  });

  for (const [index, row] of backup.mfaRecoveryCodes.entries()) await restoreRow(result, "MFA recovery code", index, async () => {
    if (await client.mfaRecoveryCode.findUnique({ where: { id: required(row.id) } })) return false;
    await client.mfaRecoveryCode.create({ data: {
      id: required(row.id), userId: mappedRequired(row.userId, maps.users), authenticatorId: mapped(row.authenticatorId, factors), codeHash: required(row.recoveryCodeHash), status: required(row.status), usedAt: date(row.usedAt), revokedAt: date(row.revokedAt), createdAt: date(row.createdAt) ?? restoredAt
    } }); return true;
  });

  for (const [index, row] of backup.invitations.entries()) await restoreRow(result, "Invitation", index, async () => {
    if (await client.userInvitation.findUnique({ where: { id: required(row.id) } })) return false;
    const wasActive = !row.usedAt && !row.revokedAt && ["CREATED", "SENT"].includes(required(row.status));
    await client.userInvitation.create({ data: {
      id: required(row.id), publicKey: required(row.publicKey), accessRequestId: mappedRequired(row.accessRequestId, requests), userId: mappedRequired(row.userId, maps.users), tokenHash: required(row.secretHash), purpose: required(row.purpose), environment: required(row.environment), roleSnapshotHash: required(row.roleSnapshotHash), credentialVersion: integer(row.credentialVersion, 1),
      status: wasActive ? "REVOKED" : required(row.status), attempts: integer(row.attempts, 0), maxAttempts: integer(row.maxAttempts, 8), expiresAt: date(row.expiresAt) ?? restoredAt, usedAt: date(row.usedAt), revokedAt: wasActive ? restoredAt : date(row.revokedAt), revocationReason: wasActive ? "RESTORED_WITHOUT_SECRET" : optionalText(row.revocationReason), deliveryKind: required(row.deliveryKind), deliveredAt: date(row.deliveredAt), issuedByUserId: mappedRequired(row.issuedByUserId, maps.users), createdAt: date(row.createdAt) ?? restoredAt
    } }); return true;
  });

  for (const [index, row] of backup.trainingAcknowledgements.entries()) await restoreRow(result, "Training acknowledgement", index, async () => {
    if (await client.userTrainingAcknowledgement.findUnique({ where: { id: required(row.id) } })) return false;
    await client.userTrainingAcknowledgement.create({ data: {
      id: required(row.id), userId: mappedRequired(row.userId, maps.users), moduleVersionId: mappedRequired(row.moduleVersionId, modules), accessRequestId: mapped(row.accessRequestId, requests), status: required(row.status), assignedAt: date(row.assignedAt) ?? restoredAt, completedAt: date(row.completedAt), expiresAt: date(row.expiresAt), acknowledgement: optionalText(row.acknowledgement), waivedAt: date(row.waivedAt), waiverReason: optionalText(row.waiverReason), waiverApprovedByUserId: mapped(row.waiverApprovedByUserId, maps.users), createdAt: date(row.createdAt) ?? restoredAt, updatedAt: date(row.updatedAt) ?? restoredAt
    } }); return true;
  });

  for (const [index, row] of backup.policyAcknowledgements.entries()) await restoreRow(result, "Policy acknowledgement", index, async () => {
    if (await client.userPolicyAcknowledgement.findUnique({ where: { id: required(row.id) } })) return false;
    await client.userPolicyAcknowledgement.create({ data: {
      id: required(row.id), userId: mappedRequired(row.userId, maps.users), accessRequestId: mapped(row.accessRequestId, requests), policyKey: required(row.policyKey), versionNumber: integer(row.versionNumber, 1), acknowledgement: required(row.acknowledgement), acceptedAt: date(row.acceptedAt) ?? restoredAt
    } }); return true;
  });

  for (const [index, row] of backup.accessCertifications.entries()) await restoreRow(result, "Access certification", index, async () => {
    if (await client.accessCertification.findUnique({ where: { id: required(row.id) } })) return false;
    await client.accessCertification.create({ data: {
      id: required(row.id), publicKey: required(row.publicKey), userId: mappedRequired(row.userId, maps.users), accessRequestId: mapped(row.accessRequestId, requests), status: required(row.status), dueAt: date(row.dueAt) ?? restoredAt, startedAt: date(row.startedAt), decidedAt: date(row.decidedAt), reviewerUserId: mapped(row.reviewerUserId, maps.users), decision: optionalText(row.decision), reason: optionalText(row.reason), scopeSnapshotJson: required(row.scopeSnapshotJson), nextReviewAt: date(row.nextReviewAt), createdAt: date(row.createdAt) ?? restoredAt, updatedAt: date(row.updatedAt) ?? restoredAt
    } }); return true;
  });

  for (const [index, row] of backup.mfaRecoveryRequests.entries()) await restoreRow(result, "MFA recovery request", index, async () => {
    if (await client.mfaRecoveryRequest.findUnique({ where: { id: required(row.id) } })) return false;
    await client.mfaRecoveryRequest.create({ data: {
      id: required(row.id), publicKey: required(row.publicKey), userId: mappedRequired(row.userId, maps.users), factorType: required(row.factorType), status: required(row.status), reason: required(row.reason), evidenceJson: required(row.evidenceJson), requestedByUserId: mappedRequired(row.requestedByUserId, maps.users), reviewedByUserId: mapped(row.reviewedByUserId, maps.users), approvedByUserId: mapped(row.approvedByUserId, maps.users), decidedAt: date(row.decidedAt), createdAt: date(row.createdAt) ?? restoredAt, updatedAt: date(row.updatedAt) ?? restoredAt
    } }); return true;
  });

  result.warnings.push("Transient activation, MFA-challenge, and step-up records were not restored. Unused invitations were restored revoked because their one-time plaintext secret is intentionally absent.");
}

async function restoreRow(result: { authSecurity: ResultBucket }, label: string, index: number, operation: () => Promise<boolean>) {
  try { if (await operation()) result.authSecurity.created += 1; else result.authSecurity.skipped += 1; }
  catch (error) { result.authSecurity.errors.push(`${label} row ${index + 1}: ${error instanceof Error ? error.message : "restore failed"}`); }
}
async function findExisting(delegate: any, row: Record<string, unknown>) {
  const byId = await delegate.findUnique({ where: { id: required(row.id) } });
  return byId ?? (typeof row.publicKey === "string" ? delegate.findUnique({ where: { publicKey: row.publicKey } }) : null);
}
function required(value: unknown) { if (typeof value !== "string" || !value) throw new Error("required backup text is missing"); return value; }
function optionalText(value: unknown) { return typeof value === "string" ? value : null; }
function integer(value: unknown, fallback: number) { return Number.isInteger(value) ? Number(value) : fallback; }
function nullableInteger(value: unknown) { return value == null ? null : integer(value, 0); }
function optionalBoolean(value: unknown) { return typeof value === "boolean" ? value : null; }
function date(value: unknown) { if (value == null) return null; const parsed = value instanceof Date ? value : new Date(String(value)); if (Number.isNaN(parsed.getTime())) throw new Error("backup date is invalid"); return parsed; }
function mapped(value: unknown, map: Map<string, string>) { return typeof value === "string" ? map.get(value) ?? null : null; }
function mappedRequired(value: unknown, map: Map<string, string>) { const mappedValue = mapped(value, map); if (!mappedValue) throw new Error("required mapped record is missing"); return mappedValue; }
