import type { PrismaClient } from "@prisma/client";
import { beginTotpEnrollment, confirmTotpEnrollment } from "@/lib/real-user-access/mfa-service";
import { beginPasskeyEnrollment, completePasskeyEnrollment } from "@/lib/real-user-access/passkey-service";
import { validateActivationSession } from "@/lib/real-user-access/invitations";
import { resolveWebAuthnPolicy } from "@/lib/real-user-access/webauthn";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { isSyntheticReleaseFeatureQaMode } from "@/lib/release-feature-flag-runtime";

export async function beginActivationTotp(client: PrismaClient, input: { activationToken: string; environment: string; displayName: string }, env: NodeJS.ProcessEnv = process.env) {
  const validated = await validateActivationSession(client, input.activationToken, input.environment, new Date(), env);
  if (!validated.valid || !validated.session?.passwordEstablishedAt) throw new Error("ACTIVATION_CREDENTIAL_REQUIRED");
  return beginTotpEnrollment(client, { userId: validated.session.userId, displayName: input.displayName, accountLabel: validated.session.user.username }, env);
}

export async function confirmActivationTotp(client: PrismaClient, input: { activationToken: string; environment: string; factorHandle: string; token: string }, env: NodeJS.ProcessEnv = process.env) {
  const validated = await validateActivationSession(client, input.activationToken, input.environment, new Date(), env);
  if (!validated.valid || !validated.session?.passwordEstablishedAt) throw new Error("ACTIVATION_CREDENTIAL_REQUIRED");
  const result = await confirmTotpEnrollment(client, { userId: validated.session.userId, factorHandle: input.factorHandle, token: input.token, environment: input.environment }, env);
  const changed = await client.userAccessRequest.updateMany({ where: { id: validated.session.accessRequestId, candidateUserId: validated.session.userId, status: { in: ["ACTIVATION_PENDING", "MFA_ENROLMENT_PENDING", "TRAINING_PENDING"] } }, data: { status: "TRAINING_PENDING", version: { increment: 1 } } });
  if (changed.count !== 1) throw new Error("ACTIVATION_REQUEST_CHANGED");
  return result;
}

export async function beginActivationPasskey(client: PrismaClient, input: { activationToken: string; environment: string; displayName: string }, env: NodeJS.ProcessEnv = process.env) {
  const validated = await validateActivationSession(client, input.activationToken, input.environment, new Date(), env);
  if (!validated.valid || !validated.session?.passwordEstablishedAt) throw new Error("ACTIVATION_CREDENTIAL_REQUIRED");
  return beginPasskeyEnrollment(client, { userId: validated.session.userId, username: validated.session.user.username, displayName: validated.session.user.name, environment: input.environment, policy: resolveWebAuthnPolicy(env, isSyntheticReleaseFeatureQaMode(env)) }, env);
}

export async function confirmActivationPasskey(client: PrismaClient, input: { activationToken: string; environment: string; displayName: string; challengeHandle: string; response: RegistrationResponseJSON }, env: NodeJS.ProcessEnv = process.env) {
  const validated = await validateActivationSession(client, input.activationToken, input.environment, new Date(), env);
  if (!validated.valid || !validated.session?.passwordEstablishedAt) throw new Error("ACTIVATION_CREDENTIAL_REQUIRED");
  const result = await completePasskeyEnrollment(client, { userId: validated.session.userId, challengeHandle: input.challengeHandle, response: input.response, environment: input.environment, displayName: input.displayName, policy: resolveWebAuthnPolicy(env, isSyntheticReleaseFeatureQaMode(env)) }, env);
  const changed = await client.userAccessRequest.updateMany({ where: { id: validated.session.accessRequestId, candidateUserId: validated.session.userId, status: { in: ["ACTIVATION_PENDING", "MFA_ENROLMENT_PENDING", "TRAINING_PENDING"] } }, data: { status: "TRAINING_PENDING", version: { increment: 1 } } });
  if (changed.count !== 1) throw new Error("ACTIVATION_REQUEST_CHANGED");
  return result;
}
