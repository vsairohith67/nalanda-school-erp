import { randomBytes, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { isSyntheticReleaseFeatureQaMode, assertOperationalReleaseFeature, REAL_USER_ACCESS_READINESS_FEATURE } from "@/lib/release-feature-flag-runtime";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { maskAlias, normalizeAliasValue } from "@/lib/auth-identifiers";
import { hashPassword, validateNewPassword } from "@/lib/password";
import { assertActorPermission, type IamActor } from "@/lib/iam/security";
import { ROLES, isRole, type Role } from "@/lib/permissions";
import { APPROVAL_MATRIX, accessTemplate, roleCombinationWarnings } from "@/lib/real-user-access/catalogue";
import { activationBlockers } from "@/lib/real-user-access/lifecycle";
import { createOneTimeInvitation, roleSnapshotHash, syntheticInvitationPreview, validateActivationSession } from "@/lib/real-user-access/invitations";
import { consumeStepUpGrant } from "@/lib/real-user-access/step-up";
import { normalizeEmail, normalizeUsername } from "@/lib/real-user-access/validation";

const TRAINING_MODULES = {
  SECURITY_BASICS: "Account security basics",
  SECURITY_ADMIN: "Privileged identity security",
  PRIVACY_AND_ACCESS: "Privacy and least-privilege access",
  FINANCE_PRIVACY: "Finance confidentiality and separation of duties",
  ACADEMIC_INTEGRITY: "Academic integrity and marks governance",
  STUDENT_PRIVACY: "Student privacy",
  CHILD_PRIVACY: "Linked-child privacy",
  STUDENT_ACCEPTABLE_USE: "Student acceptable use",
  STUDENT_SAFETY: "Student safety operations",
  UDISE_DATA_MINIMISATION: "UDISE data minimisation"
} as const;

const TRAINING_MINIMUM_DWELL_MS = 5_000;
const PROFILE_NAMES: Record<string, string> = {
  MARKS_ENTRY_OPERATOR: "marks_entry_operator",
  ATTENDANCE_OPERATOR: "attendance_operator"
};

export type PrepareAccessInput = {
  personType: "STAFF" | "GUARDIAN" | "STUDENT" | "OTHER";
  personHandle?: string | null;
  requestedName?: string | null;
  username: string;
  email?: string | null;
  roles: string[];
  scopes?: string[];
  reason: string;
  validUntil?: string | null;
};

export async function prepareAccessRequest(client: PrismaClient, actor: IamActor, input: PrepareAccessInput, env: NodeJS.ProcessEnv = process.env) {
  assertOperationalReleaseFeature(REAL_USER_ACCESS_READINESS_FEATURE);
  await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  const roles = boundedRoles(input.roles), username = normalizeUsername(input.username), email = input.email ? normalizeEmail(input.email) : null;
  assertPersonRoleCompatibility(input.personType, roles);
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username) || input.username.normalize("NFKC").trim().toLowerCase() !== username) throw new Error("ACCESS_USERNAME_INVALID_OR_CONFUSABLE");
  if (email && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254)) throw new Error("ACCESS_EMAIL_INVALID");
  const duplicate = await client.user.findFirst({ where: { OR: [{ username }, ...(email ? [{ email }] : [])] }, select: { id: true } });
  if (duplicate || await client.authLoginAlias.count({ where: { normalizedValue: { in: [username, ...(email ? [email] : [])] }, removedAt: null } })) throw new Error("ACCESS_IDENTITY_ALIAS_ALREADY_EXISTS");
  const person = await resolvePerson(client, input.personType, input.personHandle ?? null, input.requestedName ?? null, roles);
  const warnings = roleCombinationWarnings(roles);
  const training = [...new Set(roles.flatMap((role) => accessTemplate(role)?.training ?? []))];
  const mfaRequired = roles.some((role) => accessTemplate(role)?.mfa === "MANDATORY");
  const validUntil = parseValidUntil(input.validUntil);
  if (roles.some((role) => accessTemplate(role)?.temporaryByDefault) && !validUntil) throw new Error("TEMPORARY_ACCESS_EXPIRY_REQUIRED");
  const scopes = person.serverScopes.length ? person.serverScopes : boundedStrings(input.scopes ?? [], 24, 160, "ACCESS_SCOPE_INVALID");
  if (requiresExactScope(roles) && !scopes.length) throw new Error("EXACT_ACCESS_SCOPE_REQUIRED");
  const reason = boundedReason(input.reason);
  const request = await client.userAccessRequest.create({ data: {
    personType: input.personType, staffMemberId: person.staffMemberId, guardianId: person.guardianId, studentId: person.studentId,
    requestedName: person.name, requestedUsername: username, requestedEmail: email, requestedRolesJson: JSON.stringify(roles), requestedScopesJson: JSON.stringify(scopes), reason,
    mfaRequired, trainingRequirementsJson: JSON.stringify(training), policyRequirementsJson: JSON.stringify(["SECURITY_AND_PRIVACY_POLICY_V1"]), conflictWarningsJson: JSON.stringify(warnings), requestedByUserId: actor.user.id,
    requestedValidUntil: validUntil, reviewDueAt: new Date(Date.now() + 7 * 86_400_000)
  } });
  await logAuthSecurityEvent(client, { eventType: "ACCESS_REQUEST_PREPARED", actorUserId: actor.user.id, subjectType: "USER_ACCESS_REQUEST", subjectId: request.publicKey, details: { roleCount: roles.length, scopeCount: scopes.length, warningCount: warnings.length } });
  return safeRequest(request);
}

export async function submitAccessRequest(client: PrismaClient, actor: IamActor, requestKey: string) {
  assertOperationalReleaseFeature(REAL_USER_ACCESS_READINESS_FEATURE);
  await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  const changed = await client.userAccessRequest.updateMany({ where: { publicKey: requestKey, status: "PREPARED" }, data: { status: "AWAITING_APPROVAL", version: { increment: 1 } } });
  if (changed.count !== 1) throw new Error("ACCESS_REQUEST_NOT_PREPARED");
  return { success: true };
}

export async function reviewAccessRequest(client: PrismaClient, actor: IamActor, requestKey: string) {
  assertOperationalReleaseFeature(REAL_USER_ACCESS_READINESS_FEATURE);
  await assertActorPermission(client, actor, "VIEW_IAM_ACCESS");
  const request = await requestWithPerson(client, requestKey);
  if (!request || request.status !== "AWAITING_APPROVAL") throw new Error("ACCESS_REQUEST_NOT_REVIEWABLE");
  if (request.requestedByUserId === actor.user.id) throw new Error("ACCESS_REQUEST_SELF_REVIEW_REFUSED");
  await assertEligibleAccessApprover(client, actor, parseStrings(request.requestedRolesJson));
  if (!personStillEligible(request)) throw new Error("ACCESS_PERSON_NOT_ELIGIBLE");
  const changed = await client.userAccessRequest.updateMany({ where: { id: request.id, status: "AWAITING_APPROVAL", reviewedByUserId: null, version: request.version }, data: { reviewedByUserId: actor.user.id, identityLinkReviewed: true, eligibilityConfirmed: true, version: { increment: 1 } } });
  if (changed.count !== 1) throw new Error("ACCESS_REQUEST_CHANGED");
  await logAuthSecurityEvent(client, { eventType: "ACCESS_REQUEST_REVIEWED", actorUserId: actor.user.id, subjectType: "USER_ACCESS_REQUEST", subjectId: request.publicKey, details: { identityLinked: true, eligible: true } });
  return { success: true };
}

export async function approveAccessRequest(client: PrismaClient, actor: IamActor, input: { requestKey: string; stepUpToken: string; environment: string }, env: NodeJS.ProcessEnv = process.env) {
  assertOperationalReleaseFeature(REAL_USER_ACCESS_READINESS_FEATURE);
  await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  const request = await requestWithPerson(client, input.requestKey);
  if (!request || request.status !== "AWAITING_APPROVAL" || !request.reviewedByUserId || !request.identityLinkReviewed || !request.eligibilityConfirmed) throw new Error("ACCESS_REQUEST_NOT_APPROVABLE");
  if ([request.requestedByUserId, request.reviewedByUserId].includes(actor.user.id)) throw new Error("ACCESS_REQUEST_APPROVAL_SEPARATION_REQUIRED");
  await assertEligibleAccessApprover(client, actor, parseStrings(request.requestedRolesJson));
  if (!await consumeStepUpGrant(client, { stepUpToken: input.stepUpToken, userId: actor.user.id, sessionId: actor.sessionId, action: "ACCESS_REQUEST_APPROVE", environment: input.environment }, env)) throw new Error("ACCESS_REQUEST_STEP_UP_REQUIRED");
  if (!personStillEligible(request)) throw new Error("ACCESS_PERSON_NOT_ELIGIBLE");
  const roles = parseStrings(request.requestedRolesJson), baseRoles = roles.filter(isRole);
  if (!baseRoles.length) throw new Error("ACCESS_BASE_ROLE_REQUIRED");
  const planned = roles.filter((role) => accessTemplate(role)?.implementation === "PLANNED_PROFILE");
  if (planned.length) throw new Error(`ACCESS_TEMPLATE_NOT_IMPLEMENTED:${planned.join(",")}`);
  await ensureTrainingCatalogue(client);
  const trainingKeys = parseStrings(request.trainingRequirementsJson);
  const modules = await client.trainingModuleVersion.findMany({ where: { moduleKey: { in: trainingKeys }, versionNumber: 1, status: "ACTIVE" } });
  if (modules.length !== trainingKeys.length) throw new Error("ACCESS_TRAINING_CATALOGUE_INCOMPLETE");
  const profileRoles = roles.filter((role) => !isRole(role));
  const profiles = profileRoles.length ? await client.permissionProfile.findMany({ where: { normalizedName: { in: profileRoles.map((role) => PROFILE_NAMES[role]) }, status: "ACTIVE" } }) : [];
  if (profiles.length !== profileRoles.length) throw new Error("ACCESS_SPECIALISED_PROFILE_UNAVAILABLE");
  const passwordHash = await hashPassword(randomBytes(48).toString("base64url"));
  const now = new Date();
  return client.$transaction(async (tx) => {
    const current = await tx.userAccessRequest.findUniqueOrThrow({ where: { id: request.id } });
    if (current.version !== request.version || current.status !== "AWAITING_APPROVAL") throw new Error("ACCESS_REQUEST_CHANGED");
    const user = await tx.user.create({ data: {
      iamPublicKey: randomUUID(), name: request.requestedName, username: request.requestedUsername, email: request.requestedEmail, passwordHash,
      role: baseRoles[0], isActive: false, lifecycleStatus: "PENDING_ACTIVATION", guardianId: request.guardianId,
      iamRoleAssignments: { create: baseRoles.map((role) => ({ publicKey: randomUUID(), role, status: "PENDING", reason: request.reason, assignedByUserId: actor.user.id, validFrom: now, validUntil: request.requestedValidUntil })) },
      authLoginAliases: { create: { type: "USERNAME", normalizedValue: normalizeAliasValue("USERNAME", request.requestedUsername), displayMasked: maskAlias("USERNAME", request.requestedUsername), status: "PENDING", isSchoolGoverned: true } }
    } });
    if (request.staffMemberId) await tx.staffMember.update({ where: { id: request.staffMemberId }, data: { userId: user.id } });
    if (request.studentId) await tx.student.update({ where: { id: request.studentId }, data: { userId: user.id } });
    for (const profile of profiles) await tx.userPermissionProfileAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, profileId: profile.id, status: "PENDING", reason: request.reason, assignedByUserId: actor.user.id, validUntil: request.requestedValidUntil } });
    for (const module of modules) await tx.userTrainingAcknowledgement.create({ data: { userId: user.id, moduleVersionId: module.id, accessRequestId: request.id } });
    await tx.userAccessRequest.update({ where: { id: request.id }, data: { candidateUserId: user.id, approvedByUserId: actor.user.id, roleApproved: true, scopeApproved: true, decidedAt: now, status: "APPROVED_FOR_INVITATION", version: { increment: 1 } } });
    await logAuthSecurityEvent(tx, { eventType: "ACCESS_REQUEST_APPROVED", userId: user.id, actorUserId: actor.user.id, subjectType: "USER_ACCESS_REQUEST", subjectId: request.publicKey, details: { roleCount: roles.length, mfaRequired: request.mfaRequired } });
    return { requestKey: request.publicKey, userHandle: user.iamPublicKey, status: "APPROVED_FOR_INVITATION" as const };
  });
}

export async function issueSyntheticInvitation(client: PrismaClient, actor: IamActor, input: { requestKey: string; environment: string; activationOrigin: string; stepUpToken: string }, env: NodeJS.ProcessEnv = process.env) {
  assertOperationalReleaseFeature(REAL_USER_ACCESS_READINESS_FEATURE);
  await assertActorPermission(client, actor, "MANAGE_IAM_USERS");
  if (!isSyntheticReleaseFeatureQaMode(env)) throw new Error("LIVE_INVITATION_PROVIDER_NOT_CONFIGURED");
  if (!await consumeStepUpGrant(client, { stepUpToken: input.stepUpToken, userId: actor.user.id, sessionId: actor.sessionId, action: "ACCESS_INVITATION_ISSUE", environment: input.environment }, env)) throw new Error("ACCESS_INVITATION_STEP_UP_REQUIRED");
  const request = await client.userAccessRequest.findUnique({ where: { publicKey: input.requestKey }, include: { candidateUser: { include: { iamRoleAssignments: { where: { status: "PENDING" } } } } } });
  if (!request?.candidateUser || request.status !== "APPROVED_FOR_INVITATION" || !request.roleApproved || !request.scopeApproved || !request.eligibilityConfirmed) throw new Error("ACCESS_REQUEST_NOT_INVITABLE");
  const created = await client.$transaction(async (tx) => {
    await tx.userInvitation.updateMany({ where: { accessRequestId: request.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { status: "REVOKED", revokedAt: new Date(), revocationReason: "SUPERSEDED" } });
    const invitation = await createOneTimeInvitation(tx, { accessRequestId: request.id, userId: request.candidateUser!.id, issuedByUserId: actor.user.id, environment: input.environment, roles: request.candidateUser!.iamRoleAssignments, credentialVersion: request.candidateUser!.credentialVersion }, env);
    await tx.userAccessRequest.update({ where: { id: request.id }, data: { status: "INVITATION_CREATED", version: { increment: 1 } } });
    await logAuthSecurityEvent(tx, { eventType: "INVITATION_CREATED", userId: request.candidateUser!.id, actorUserId: actor.user.id, subjectType: "USER_INVITATION", subjectId: invitation.invitation.publicKey, details: { deliveryKind: "LOCAL_TEST_SINK", expiresHours: 24 } });
    return invitation;
  });
  const roles = parseStrings(request.requestedRolesJson);
  return { invitationHandle: created.invitation.publicKey, expiresAt: created.invitation.expiresAt, preview: syntheticInvitationPreview({ role: roles.join(", "), expiresAt: created.invitation.expiresAt, activationOrigin: input.activationOrigin, oneTimeToken: created.oneTimeToken }) };
}

export async function establishActivationPassword(client: PrismaClient, input: { activationToken: string; environment: string; password: string }, env: NodeJS.ProcessEnv = process.env) {
  assertOperationalReleaseFeature(REAL_USER_ACCESS_READINESS_FEATURE);
  const validated = await validateActivationSession(client, input.activationToken, input.environment, new Date(), env);
  if (!validated.valid || !validated.session) throw new Error("ACTIVATION_SESSION_REFUSED");
  validateActivationPassword(input.password, validated.session.accessRequest.mfaRequired);
  const hash = await hashPassword(input.password), now = new Date();
  await client.$transaction(async (tx) => {
    await tx.user.update({ where: { id: validated.session.userId }, data: { passwordHash: hash, credentialVersion: { increment: 1 }, mustChangePassword: false, temporaryPasswordExpiresAt: null, version: { increment: 1 } } });
    await tx.userActivationSession.update({ where: { id: validated.session.id }, data: { passwordEstablishedAt: now } });
    await tx.authSession.updateMany({ where: { userId: validated.session.userId, revokedAt: null }, data: { revokedAt: now, revocationReason: "ACTIVATION_PASSWORD_ESTABLISHED" } });
    await tx.authPasswordResetToken.updateMany({ where: { userId: validated.session.userId, usedAt: null, invalidatedAt: null }, data: { invalidatedAt: now, invalidationReason: "ACTIVATION_PASSWORD_ESTABLISHED" } });
    await tx.authVerificationChallenge.updateMany({ where: { userId: validated.session.userId, usedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
    await tx.userInvitation.updateMany({ where: { userId: validated.session.userId, usedAt: null, revokedAt: null }, data: { status: "REVOKED", revokedAt: now, revocationReason: "CREDENTIAL_CHANGED" } });
    await logAuthSecurityEvent(tx, { eventType: "ACTIVATION_CREDENTIAL_ESTABLISHED", userId: validated.session.userId, actorUserId: validated.session.userId, subjectType: "USER_ACCESS_REQUEST", subjectId: validated.session.accessRequest.publicKey, details: { credentialType: "PASSWORD" } });
  });
  return { success: true };
}

export async function acknowledgeActivationPolicy(client: PrismaClient, input: { activationToken: string; environment: string; acknowledgement: string }, env: NodeJS.ProcessEnv = process.env) {
  const validated = await validateActivationSession(client, input.activationToken, input.environment, new Date(), env);
  if (!validated.valid || !validated.session || input.acknowledgement !== "I_ACCEPT_THE_SECURITY_AND_PRIVACY_POLICY") throw new Error("POLICY_ACKNOWLEDGEMENT_REFUSED");
  const now = new Date();
  await client.$transaction(async (tx) => {
    await tx.userPolicyAcknowledgement.upsert({ where: { userId_policyKey_versionNumber: { userId: validated.session.userId, policyKey: "SECURITY_AND_PRIVACY_POLICY", versionNumber: 1 } }, create: { userId: validated.session.userId, accessRequestId: validated.session.accessRequestId, policyKey: "SECURITY_AND_PRIVACY_POLICY", versionNumber: 1, acknowledgement: "EXPLICIT_ACCEPTANCE" }, update: {} });
    await tx.userActivationSession.update({ where: { id: validated.session.id }, data: { policySatisfiedAt: now } });
  });
  return { success: true };
}

export async function beginActivationTraining(client: PrismaClient, input: { activationToken: string; environment: string; moduleKey: string; now?: Date }, env: NodeJS.ProcessEnv = process.env) {
  const now = input.now ?? new Date();
  const validated = await validateActivationSession(client, input.activationToken, input.environment, now, env);
  if (!validated.valid || !validated.session) throw new Error("ACTIVATION_SESSION_REFUSED");
  const assignment = await client.userTrainingAcknowledgement.findFirst({
    where: {
      userId: validated.session.userId,
      accessRequestId: validated.session.accessRequestId,
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      moduleVersion: { moduleKey: input.moduleKey, status: "ACTIVE", requiredForActivation: true }
    },
    include: { moduleVersion: true }
  });
  if (!assignment) throw new Error("TRAINING_ASSIGNMENT_UNAVAILABLE");
  let startedAt = assignment.updatedAt;
  if (assignment.status === "ASSIGNED") {
    const changed = await client.userTrainingAcknowledgement.updateMany({
      where: { id: assignment.id, status: "ASSIGNED" },
      data: { status: "IN_PROGRESS", acknowledgement: null, updatedAt: now }
    });
    if (changed.count !== 1) throw new Error("TRAINING_ASSIGNMENT_CHANGED");
    startedAt = now;
  }
  return {
    moduleHandle: assignment.moduleVersion.publicKey,
    moduleKey: assignment.moduleVersion.moduleKey,
    title: assignment.moduleVersion.title,
    versionNumber: assignment.moduleVersion.versionNumber,
    content: trainingContent(assignment.moduleVersion.moduleKey),
    completeAfter: new Date(startedAt.getTime() + TRAINING_MINIMUM_DWELL_MS).toISOString()
  };
}

export async function completeActivationTraining(client: PrismaClient, input: { activationToken: string; environment: string; moduleKey: string; moduleHandle: string; acknowledgement: string; now?: Date }, env: NodeJS.ProcessEnv = process.env) {
  const now = input.now ?? new Date();
  const validated = await validateActivationSession(client, input.activationToken, input.environment, now, env);
  if (!validated.valid || !validated.session || input.acknowledgement !== "I_COMPLETED_THE_TRAINING") throw new Error("TRAINING_ACKNOWLEDGEMENT_REFUSED");
  const assignment = await client.userTrainingAcknowledgement.findFirst({
    where: {
      userId: validated.session.userId,
      accessRequestId: validated.session.accessRequestId,
      status: "IN_PROGRESS",
      moduleVersion: { publicKey: input.moduleHandle, moduleKey: input.moduleKey, status: "ACTIVE", requiredForActivation: true }
    }
  });
  if (!assignment || now.getTime() < assignment.updatedAt.getTime() + TRAINING_MINIMUM_DWELL_MS) throw new Error("TRAINING_SERVER_EVIDENCE_INCOMPLETE");
  const changed = await client.userTrainingAcknowledgement.updateMany({ where: { id: assignment.id, status: "IN_PROGRESS", updatedAt: assignment.updatedAt }, data: { status: "COMPLETED", completedAt: now, acknowledgement: "EXPLICIT_COMPLETION", updatedAt: now } });
  if (changed.count !== 1) throw new Error("TRAINING_ASSIGNMENT_CHANGED");
  const remaining = await client.userTrainingAcknowledgement.count({ where: { userId: validated.session.userId, accessRequestId: validated.session.accessRequestId, status: { notIn: ["COMPLETED", "WAIVED"] } } });
  if (!remaining) await client.userActivationSession.update({ where: { id: validated.session.id }, data: { trainingSatisfiedAt: now } });
  return { success: true, remaining };
}

export async function confirmActivationRoles(client: PrismaClient, input: { activationToken: string; environment: string; roles: string[] }, env: NodeJS.ProcessEnv = process.env) {
  const validated = await validateActivationSession(client, input.activationToken, input.environment, new Date(), env);
  if (!validated.valid || !validated.session) throw new Error("ACTIVATION_SESSION_REFUSED");
  const expected = parseStrings(validated.session.accessRequest.requestedRolesJson).sort(), presented = [...new Set(input.roles)].sort();
  if (JSON.stringify(expected) !== JSON.stringify(presented)) throw new Error("ACTIVATION_ROLE_CONFIRMATION_MISMATCH");
  await client.userActivationSession.update({ where: { id: validated.session.id }, data: { roleConfirmedAt: new Date() } });
  return { success: true };
}

export async function completeAccountActivation(client: PrismaClient, input: { activationToken: string; environment: string }, env: NodeJS.ProcessEnv = process.env) {
  assertOperationalReleaseFeature(REAL_USER_ACCESS_READINESS_FEATURE);
  const now = new Date();
  return client.$transaction(async (tx) => {
    const validated = await validateActivationSession(tx, input.activationToken, input.environment, now, env);
    if (!validated.valid || !validated.session) throw new Error("ACTIVATION_SESSION_REFUSED");
    const session = validated.session;
    const request = await requestWithPerson(tx, session.accessRequest.publicKey);
    if (!request || !personStillEligible(request)) throw new Error("ACCESS_PERSON_NOT_ELIGIBLE");
    if (!["ACTIVATION_PENDING", "MFA_ENROLMENT_PENDING", "TRAINING_PENDING"].includes(request.status) || request.candidateUserId !== session.userId) throw new Error("ACTIVATION_REQUEST_CHANGED");
    const mfaEnrolled = await tx.mfaAuthenticator.count({ where: { userId: session.userId, status: "ACTIVE", verifiedAt: { not: null }, revokedAt: null } }) > 0;
    const trainingRemaining = await tx.userTrainingAcknowledgement.count({ where: { userId: session.userId, accessRequestId: session.accessRequestId, status: { notIn: ["COMPLETED", "WAIVED"] } } });
    const policyCount = await tx.userPolicyAcknowledgement.count({ where: { userId: session.userId, accessRequestId: session.accessRequestId, policyKey: "SECURITY_AND_PRIVACY_POLICY", versionNumber: 1 } });
    const blockers = activationBlockers({ identityLinkReviewed: request.identityLinkReviewed, roleApproved: request.roleApproved, scopeApproved: request.scopeApproved, invitationAccepted: true, credentialEstablished: Boolean(session.passwordEstablishedAt), mfaRequired: request.mfaRequired, mfaEnrolled, trainingSatisfied: trainingRemaining === 0 && Boolean(session.trainingSatisfiedAt), policySatisfied: policyCount === 1 && Boolean(session.policySatisfiedAt), eligible: true, featureEnabled: true });
    if (!session.roleConfirmedAt) blockers.push("ROLE_NOT_CONFIRMED");
    if (blockers.length) throw new Error(`ACTIVATION_BLOCKED:${blockers.join(",")}`);

    const roles = parseStrings(request.requestedRolesJson);
    const expectedBaseRoles = roles.filter(isRole).sort();
    const expectedProfiles = roles.filter((role) => !isRole(role)).map((role) => PROFILE_NAMES[role]).sort();
    const assignments = await tx.userRoleAssignment.findMany({ where: { userId: session.userId }, orderBy: { role: "asc" } });
    const profiles = await tx.userPermissionProfileAssignment.findMany({ where: { userId: session.userId }, include: { profile: { select: { normalizedName: true, status: true } } } });
    const aliases = await tx.authLoginAlias.findMany({ where: { userId: session.userId, type: "USERNAME" } });
    const invitation = await tx.userInvitation.findFirst({ where: { accessRequestId: request.id, userId: session.userId, status: "USED" }, orderBy: { usedAt: "desc" }, select: { roleSnapshotHash: true } });
    if (!sameStrings(assignments.map((entry) => entry.role), expectedBaseRoles) || assignments.some((entry) => entry.status !== "PENDING")) throw new Error("ACTIVATION_ROLE_ASSIGNMENTS_CHANGED");
    if (!sameStrings(profiles.map((entry) => entry.profile.normalizedName), expectedProfiles) || profiles.some((entry) => entry.status !== "PENDING" || entry.profile.status !== "ACTIVE")) throw new Error("ACTIVATION_PROFILE_ASSIGNMENTS_CHANGED");
    if (aliases.length !== 1 || aliases[0].status !== "PENDING" || aliases[0].normalizedValue !== normalizeAliasValue("USERNAME", request.requestedUsername)) throw new Error("ACTIVATION_LOGIN_ALIAS_CHANGED");
    if (!invitation || invitation.roleSnapshotHash !== roleSnapshotHash(assignments)) throw new Error("ACTIVATION_ROLE_SNAPSHOT_CHANGED");

    const consumed = await tx.userActivationSession.updateMany({ where: { id: session.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { primaryFactorSatisfiedAt: now, usedAt: now } });
    if (consumed.count !== 1) throw new Error("ACTIVATION_SESSION_CHANGED");
    const activated = await tx.user.updateMany({ where: { id: session.userId, lifecycleStatus: "PENDING_ACTIVATION", isActive: false }, data: { isActive: true, lifecycleStatus: "ACTIVE", authorizationVersion: { increment: 1 }, version: { increment: 1 } } });
    if (activated.count !== 1) throw new Error("ACTIVATION_ACCOUNT_CHANGED");
    for (const assignment of assignments) {
      const changed = await tx.userRoleAssignment.updateMany({ where: { id: assignment.id, status: "PENDING" }, data: { status: "ACTIVE", activeKey: `${session.userId}:${assignment.role}`, version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error("ACTIVATION_ROLE_ASSIGNMENTS_CHANGED");
    }
    for (const assignment of profiles) {
      const changed = await tx.userPermissionProfileAssignment.updateMany({ where: { id: assignment.id, status: "PENDING" }, data: { status: "ACTIVE", activeKey: `${session.userId}:${assignment.profileId}`, version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error("ACTIVATION_PROFILE_ASSIGNMENTS_CHANGED");
    }
    const aliasChanged = await tx.authLoginAlias.updateMany({ where: { id: aliases[0].id, status: "PENDING" }, data: { status: "VERIFIED", verifiedAt: now, version: { increment: 1 } } });
    if (aliasChanged.count !== 1) throw new Error("ACTIVATION_LOGIN_ALIAS_CHANGED");
    const requestChanged = await tx.userAccessRequest.updateMany({ where: { id: request.id, status: request.status, version: request.version }, data: { status: "ACTIVE", version: { increment: 1 } } });
    if (requestChanged.count !== 1) throw new Error("ACTIVATION_REQUEST_CHANGED");
    await tx.userActivationSession.updateMany({ where: { userId: session.userId, id: { not: session.id }, usedAt: null, revokedAt: null }, data: { revokedAt: now, revocationReason: "ACTIVATION_COMPLETED" } });
    const reviewDays = Math.min(...roles.map((role) => accessTemplate(role)?.reviewEveryDays ?? 90));
    await tx.accessCertification.create({ data: { userId: session.userId, accessRequestId: request.id, dueAt: new Date(now.getTime() + reviewDays * 86_400_000), scopeSnapshotJson: JSON.stringify({ roles, scopes: parseStrings(request.requestedScopesJson), roleSnapshotHash: invitation.roleSnapshotHash }) } });
    await logAuthSecurityEvent(tx, { eventType: "ACCOUNT_ACTIVATED", userId: session.userId, actorUserId: session.userId, subjectType: "USER_ACCESS_REQUEST", subjectId: request.publicKey, details: { roleCount: roles.length, reviewDays } });
    return { success: true, status: "ACTIVE" as const };
  });
}

export async function ensureTrainingCatalogue(client: PrismaClient) {
  for (const [moduleKey, title] of Object.entries(TRAINING_MODULES)) await client.trainingModuleVersion.upsert({ where: { moduleKey_versionNumber: { moduleKey, versionNumber: 1 } }, create: { moduleKey, versionNumber: 1, title, audienceRolesJson: JSON.stringify(ROLES), status: "ACTIVE", requiredForActivation: true, expiresAfterDays: 365 }, update: {} });
}

export function validateActivationPassword(password: string, mfaRequired: boolean) { validateNewPassword(password); if (!mfaRequired && password.length < 15) throw new Error("Password-only accounts require at least 15 characters"); }

function boundedRoles(input: unknown) { if (!Array.isArray(input) || input.length < 1 || input.length > 8) throw new Error("ACCESS_ROLES_INVALID"); const values = [...new Set(input.map(String))]; if (values.some((role) => !accessTemplate(role))) throw new Error("ACCESS_ROLE_UNKNOWN"); if (!values.some(isRole)) throw new Error("ACCESS_BASE_ROLE_REQUIRED"); return values; }
function boundedStrings(values: unknown[], maxCount: number, maxLength: number, error: string) { if (values.length > maxCount || values.some((value) => typeof value !== "string" || !value.trim() || value.length > maxLength || /[\u0000-\u001f\u007f]/.test(value))) throw new Error(error); return [...new Set(values.map((value) => String(value).trim()))]; }
function boundedReason(reason: string) { const value = reason.trim(); if (value.length < 12 || value.length > 500) throw new Error("ACCESS_REASON_INVALID"); return value; }
async function assertEligibleAccessApprover(_client: PrismaClient, actor: IamActor, requestedRoles: string[]) {
  const rule = requestedRoles.includes("SUPER_ADMIN") ? APPROVAL_MATRIX.SUPER_ADMIN
    : requestedRoles.includes("DIRECTOR") ? APPROVAL_MATRIX.DIRECTOR
      : requestedRoles.includes("PRINCIPAL") ? APPROVAL_MATRIX.PRINCIPAL
        : requestedRoles.includes("ACCOUNTANT") ? APPROVAL_MATRIX.ACCOUNTANT
          : APPROVAL_MATRIX.DEFAULT;
  if (!(rule.eligibleApproverRoles as readonly string[]).includes(actor.user.role)) throw new Error("ACCESS_APPROVER_ROLE_INELIGIBLE");
}
function parseValidUntil(value?: string | null) { if (!value) return null; const parsed = new Date(value); if (!Number.isFinite(parsed.getTime()) || parsed <= new Date() || parsed.getTime() > Date.now() + 366 * 86_400_000) throw new Error("ACCESS_EXPIRY_INVALID"); return parsed; }
function parseStrings(json: string) { const parsed: unknown = JSON.parse(json); if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) throw new Error("ACCESS_STORED_LIST_INVALID"); return parsed as string[]; }
function requiresExactScope(roles: string[]) { return roles.some((role) => ["TEACHER", "MARKS_ENTRY_OPERATOR", "ATTENDANCE_OPERATOR", "UDISE_DATA_OPERATOR"].includes(role)); }
function assertPersonRoleCompatibility(personType: PrepareAccessInput["personType"], roles: string[]) {
  const allowed = personType === "STAFF" ? new Set(["LEADERSHIP", "STAFF", "ANY_APPROVED_PERSON"])
    : personType === "GUARDIAN" ? new Set(["GUARDIAN", "ANY_APPROVED_PERSON"])
      : personType === "STUDENT" ? new Set(["STUDENT", "ANY_APPROVED_PERSON"])
        : new Set(["ANY_APPROVED_PERSON"]);
  if (roles.some((role) => { const intended = accessTemplate(role)?.intendedUserType; return !intended || !allowed.has(intended); })) throw new Error("ACCESS_PERSON_ROLE_LINK_INCOMPATIBLE");
}
function sameStrings(actual: string[], expected: string[]) { return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()); }
function trainingContent(moduleKey: string) {
  const focus: Record<string, string> = {
    SECURITY_BASICS: "Protect your credential, use MFA, recognise phishing, report suspicious access, and secure lost devices.",
    SECURITY_ADMIN: "Use privileged access only in the selected administrative role, require step-up, and preserve separation of duties.",
    PRIVACY_AND_ACCESS: "Use least privilege, approved scopes, and server-derived links; never search for or disclose unrelated records.",
    FINANCE_PRIVACY: "Keep finance data confidential and separate preparation, approval, issue, reversal, and export duties.",
    ACADEMIC_INTEGRITY: "Enter marks only for assigned exams, preserve lock and correction controls, and never bypass approval evidence.",
    STUDENT_PRIVACY: "Use Student data only for assigned educational duties and report any unexpected access immediately.",
    CHILD_PRIVACY: "A Guardian account may access only server-linked children and must not share the account.",
    STUDENT_ACCEPTABLE_USE: "Use the account only for approved school work, protect credentials, and report unsafe content or access.",
    STUDENT_SAFETY: "Use gate and safety data only for current operational duties and verify identity before acting.",
    UDISE_DATA_MINIMISATION: "Use only the minimum approved fields and never treat draft or masked data as an official submission."
  };
  return focus[moduleKey] ?? "Review the approved role boundary, protect personal data, and report unexpected access.";
}

async function resolvePerson(client: PrismaClient, type: PrepareAccessInput["personType"], handle: string | null, requestedName: string | null, roles: string[]) {
  if (type === "STAFF") { const row = handle ? await client.staffMember.findUnique({ where: { iamPublicKey: handle } }) : null; if (!row || row.status.toUpperCase() !== "ACTIVE" || row.userId) throw new Error("ACTIVE_UNLINKED_STAFF_REQUIRED"); return { name: row.displayName ?? row.fullName, staffMemberId: row.id, guardianId: null, studentId: null, serverScopes: [] }; }
  if (type === "GUARDIAN") { const row = handle ? await client.guardian.findUnique({ where: { iamPublicKey: handle }, include: { students: { include: { student: true } }, users: true } }) : null; const active = row?.students.filter((link) => !link.student.deletedAt && link.student.status.toUpperCase() === "ACTIVE") ?? []; if (!row || row.status.toUpperCase() !== "ACTIVE" || row.users.length || !active.length) throw new Error("ACTIVE_UNLINKED_GUARDIAN_REQUIRED"); if (!roles.includes("PARENT")) throw new Error("GUARDIAN_PARENT_ROLE_REQUIRED"); return { name: row.displayName, staffMemberId: null, guardianId: row.id, studentId: null, serverScopes: active.map((link) => `CHILD_LINK:${link.id}`) }; }
  if (type === "STUDENT") { const row = handle ? await client.student.findUnique({ where: { iamPublicKey: handle } }) : null; if (!row || row.deletedAt || row.status.toUpperCase() !== "ACTIVE" || row.userId) throw new Error("ACTIVE_UNLINKED_STUDENT_REQUIRED"); if (!roles.includes("STUDENT")) throw new Error("STUDENT_ROLE_REQUIRED"); return { name: row.studentName, staffMemberId: null, guardianId: null, studentId: row.id, serverScopes: [`STUDENT:${row.id}`] }; }
  if (roles.some((role) => role !== "VIEWER")) throw new Error("UNLINKED_PERSON_VIEWER_ONLY"); const name = requestedName?.trim() ?? ""; if (name.length < 2 || name.length > 100) throw new Error("ACCESS_NAME_INVALID"); return { name, staffMemberId: null, guardianId: null, studentId: null, serverScopes: [] };
}

function requestWithPerson(client: PrismaClient | Prisma.TransactionClient, publicKey: string) { return client.userAccessRequest.findUnique({ where: { publicKey }, include: { staffMember: true, guardian: { include: { students: { include: { student: true } }, users: true } }, student: true } }); }
function personStillEligible(request: NonNullable<Awaited<ReturnType<typeof requestWithPerson>>>) { if (request.staffMemberId) return request.staffMember?.status.toUpperCase() === "ACTIVE" && (!request.staffMember.userId || request.staffMember.userId === request.candidateUserId); if (request.guardianId) return request.guardian?.status.toUpperCase() === "ACTIVE" && request.guardian.students.some((link) => !link.student.deletedAt && link.student.status.toUpperCase() === "ACTIVE") && (!request.guardian.users.length || request.guardian.users.some((user) => user.id === request.candidateUserId)); if (request.studentId) return !request.student?.deletedAt && request.student?.status.toUpperCase() === "ACTIVE" && (!request.student.userId || request.student.userId === request.candidateUserId); return true; }
function safeRequest(request: { publicKey: string; status: string; requestedRolesJson: string; requestedScopesJson: string; mfaRequired: boolean; trainingRequirementsJson: string; policyRequirementsJson: string; conflictWarningsJson: string; requestedValidUntil: Date | null; reviewDueAt: Date | null; version: number }) { return { requestKey: request.publicKey, status: request.status, roles: parseStrings(request.requestedRolesJson), scopes: parseStrings(request.requestedScopesJson), mfaRequired: request.mfaRequired, training: parseStrings(request.trainingRequirementsJson), policies: parseStrings(request.policyRequirementsJson), warnings: parseStrings(request.conflictWarningsJson), validUntil: request.requestedValidUntil?.toISOString() ?? null, reviewDueAt: request.reviewDueAt?.toISOString() ?? null, version: request.version }; }
