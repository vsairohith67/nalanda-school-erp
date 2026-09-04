import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { boundTokenMatches, generateBoundToken, hashBoundToken } from "@/lib/real-user-access/crypto";
import { createPasskeyRegistrationOptions, hashWebAuthnChallenge, verifyPasskeyRegistration, type WebAuthnPolicy } from "@/lib/real-user-access/webauthn";
import { generateRecoveryCodes } from "@/lib/real-user-access/recovery-codes";

const PASSKEY_CHALLENGE_TTL_MS = 5 * 60_000;

export async function beginPasskeyEnrollment(client: PrismaClient, input: { userId: string; username: string; displayName: string; environment: string; policy: WebAuthnPolicy; now?: Date }, env: NodeJS.ProcessEnv = process.env) {
  const now = input.now ?? new Date();
  const existing = await client.mfaAuthenticator.findMany({ where: { userId: input.userId, type: "WEBAUTHN", status: "ACTIVE", revokedAt: null, credentialId: { not: null } }, select: { credentialId: true, transportsJson: true } });
  const options = await createPasskeyRegistrationOptions({ userId: input.userId, username: input.username, displayName: input.displayName, existing: existing.map((entry) => ({ credentialId: entry.credentialId!, transports: parseTransports(entry.transportsJson) })) }, input.policy);
  const id = randomUUID(), handleSecret = generateBoundToken(32);
  const tokenHash = hashBoundToken({ token: handleSecret, purpose: "passkey-challenge-handle", environment: input.environment, subject: `${id}:${input.userId}` }, env);
  await client.mfaChallenge.create({ data: { id, tokenHash, challengeHash: hashWebAuthnChallenge(options.challenge, id, input.environment, env), userId: input.userId, type: "WEBAUTHN_REGISTRATION", action: "PASSKEY_ENROLL", environment: input.environment, expiresAt: new Date(now.getTime() + PASSKEY_CHALLENGE_TTL_MS) } });
  return { challengeHandle: `${id}.${handleSecret}`, options };
}

export async function completePasskeyEnrollment(client: PrismaClient, input: { userId: string; challengeHandle: string; response: RegistrationResponseJSON; environment: string; displayName: string; policy: WebAuthnPolicy; now?: Date }, env: NodeJS.ProcessEnv = process.env) {
  const parsed = parse(input.challengeHandle), now = input.now ?? new Date();
  if (!parsed) throw new Error("PASSKEY_CHALLENGE_REFUSED");
  const challenge = await client.mfaChallenge.findUnique({ where: { id: parsed.id } });
  if (!challenge?.challengeHash || challenge.userId !== input.userId || challenge.type !== "WEBAUTHN_REGISTRATION" || challenge.action !== "PASSKEY_ENROLL" || challenge.environment !== input.environment || challenge.usedAt || challenge.revokedAt || challenge.expiresAt <= now || !boundTokenMatches({ token: parsed.secret, purpose: "passkey-challenge-handle", environment: input.environment, subject: `${challenge.id}:${input.userId}`, expectedHash: challenge.tokenHash }, env)) throw new Error("PASSKEY_CHALLENGE_REFUSED");
  const result = await verifyPasskeyRegistration({ response: input.response, challengeId: challenge.id, challengeHash: challenge.challengeHash, environment: input.environment }, input.policy, env);
  if (!result.verified || !result.registrationInfo) throw new Error("PASSKEY_REGISTRATION_REFUSED");
  const credential = result.registrationInfo.credential;
  const recoveryCodes = generateRecoveryCodes(input.userId, input.environment, env);
  const factor = await client.$transaction(async (tx) => {
    const consumed = await tx.mfaChallenge.updateMany({ where: { id: challenge.id, usedAt: null, revokedAt: null }, data: { usedAt: now } });
    if (consumed.count !== 1) throw new Error("PASSKEY_CHALLENGE_REPLAYED");
    const created = await tx.mfaAuthenticator.create({ data: { userId: input.userId, type: "WEBAUTHN", status: "ACTIVE", displayName: boundedName(input.displayName), credentialId: credential.id, credentialPublicKey: Buffer.from(credential.publicKey), credentialCounter: String(credential.counter), credentialDeviceType: result.registrationInfo.credentialDeviceType, credentialBackedUp: result.registrationInfo.credentialBackedUp, transportsJson: JSON.stringify(credential.transports ?? []), rpId: input.policy.rpId, verifiedAt: now } });
    await tx.mfaRecoveryCode.updateMany({ where: { userId: input.userId, status: "ACTIVE", usedAt: null, revokedAt: null }, data: { status: "REVOKED", revokedAt: now } });
    await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((entry) => ({ userId: input.userId, authenticatorId: created.id, codeHash: entry.codeHash })) });
    await logAuthSecurityEvent(tx, { eventType: "PASSKEY_REGISTERED", userId: input.userId, actorUserId: input.userId, subjectType: "MFA_AUTHENTICATOR", subjectId: created.publicKey, details: { factorType: "WEBAUTHN", backedUp: result.registrationInfo.credentialBackedUp } });
    return created;
  });
  return { verified: true, factorHandle: factor.publicKey, recoveryCodes: recoveryCodes.map((entry) => entry.code) };
}

function parse(value: string) { const match = /^([0-9a-f]{8}-[0-9a-f-]{27})\.([A-Za-z0-9_-]{22,128})$/i.exec(value); return match ? { id: match[1], secret: match[2] } : null; }
function parseTransports(value: string | null) { if (!value) return undefined; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : undefined; } catch { return undefined; } }
function boundedName(value: string) { const name = value.trim(); if (name.length < 2 || name.length > 80) throw new Error("PASSKEY_DISPLAY_NAME_INVALID"); return name; }
