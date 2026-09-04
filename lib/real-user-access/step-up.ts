import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { boundTokenMatches, generateBoundToken, hashBoundToken } from "@/lib/real-user-access/crypto";
import { verifyActiveTotp } from "@/lib/real-user-access/mfa-service";
import { createPasskeyAuthenticationOptions, hashWebAuthnChallenge, resolveWebAuthnPolicy, verifyPasskeyAuthentication } from "@/lib/real-user-access/webauthn";
import { isSyntheticReleaseFeatureQaMode } from "@/lib/release-feature-flag-runtime";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";

const CHALLENGE_TTL_MS = 5 * 60_000;
const GRANT_TTL_MS = 3 * 60_000;

export async function createStepUpChallenge(client: PrismaClient, input: { userId: string; sessionId: string; action: string; environment: string; now?: Date }, env: NodeJS.ProcessEnv = process.env) {
  const now = input.now ?? new Date();
  const action = boundedAction(input.action);
  const session = await client.authSession.findFirst({ where: { id: input.sessionId, userId: input.userId, revokedAt: null, expiresAt: { gt: now } } });
  if (!session) throw new Error("STEP_UP_SESSION_UNAVAILABLE");
  const factors = await client.mfaAuthenticator.findMany({ where: { userId: input.userId, status: "ACTIVE", verifiedAt: { not: null }, revokedAt: null }, select: { type: true, credentialId: true, transportsJson: true } });
  if (!factors.length) throw new Error("STEP_UP_MFA_REQUIRED");
  const id = randomUUID(), secret = generateBoundToken(32);
  const passkeys = factors.filter((factor) => factor.type === "WEBAUTHN" && factor.credentialId);
  const webauthnOptions = passkeys.length ? await createPasskeyAuthenticationOptions(passkeys.map((factor) => ({ credentialId: factor.credentialId!, transports: parseTransports(factor.transportsJson) })), resolveWebAuthnPolicy(env, isSyntheticReleaseFeatureQaMode(env))) : null;
  if (!webauthnOptions && !factors.some((factor) => factor.type === "TOTP")) throw new Error("STEP_UP_PRIMARY_FACTOR_REQUIRED");
  const tokenHash = hashBoundToken({ token: secret, purpose: "mfa-challenge", environment: input.environment, subject: challengeSubject(id, input.userId, input.sessionId, action) }, env);
  await client.mfaChallenge.create({ data: { id, tokenHash, challengeHash: webauthnOptions ? hashWebAuthnChallenge(webauthnOptions.challenge, id, input.environment, env) : null, userId: input.userId, sessionId: input.sessionId, type: webauthnOptions ? "WEBAUTHN" : "TOTP", action, environment: input.environment, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) } });
  return { challengeToken: `${id}.${secret}`, factorType: webauthnOptions ? "WEBAUTHN" as const : "TOTP" as const, webauthnOptions, expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) };
}

export async function completeStepUpChallenge(client: PrismaClient, input: { challengeToken: string; userId: string; sessionId: string; action: string; environment: string; factor: "TOTP" | "WEBAUTHN"; response: string | AuthenticationResponseJSON; now?: Date; timestamp?: number }, env: NodeJS.ProcessEnv = process.env) {
  const parsed = parseToken(input.challengeToken), now = input.now ?? new Date(), action = boundedAction(input.action);
  if (!parsed) throw new Error("STEP_UP_CHALLENGE_REFUSED");
  const challenge = await client.mfaChallenge.findUnique({ where: { id: parsed.id } });
  if (!challenge || challenge.userId !== input.userId || challenge.sessionId !== input.sessionId || challenge.action !== action || challenge.environment !== input.environment || challenge.type !== input.factor || challenge.usedAt || challenge.revokedAt || challenge.expiresAt <= now || !boundTokenMatches({ token: parsed.secret, purpose: "mfa-challenge", environment: input.environment, subject: challengeSubject(challenge.id, input.userId, input.sessionId, action), expectedHash: challenge.tokenHash }, env)) throw new Error("STEP_UP_CHALLENGE_REFUSED");
  if (challenge.attempts >= challenge.maxAttempts) throw new Error("STEP_UP_ATTEMPT_LIMIT");
  let verified = false;
  let passkeyUpdate: { id: string; previousCounter: string; nextCounter: string } | null = null;
  if (input.factor === "TOTP" && typeof input.response === "string") {
    verified = (await verifyActiveTotp(client, { userId: input.userId, token: input.response, timestamp: input.timestamp }, env)).verified;
  } else if (input.factor === "WEBAUTHN" && typeof input.response === "object" && challenge.challengeHash) {
    const authenticator = await client.mfaAuthenticator.findFirst({ where: { userId: input.userId, credentialId: input.response.id, type: "WEBAUTHN", status: "ACTIVE", verifiedAt: { not: null }, revokedAt: null } });
    if (authenticator?.credentialPublicKey && authenticator.credentialCounter != null && authenticator.rpId) {
      try {
        const result = await verifyPasskeyAuthentication({ response: input.response, challengeId: challenge.id, challengeHash: challenge.challengeHash, environment: input.environment, credentialId: input.response.id, publicKey: new Uint8Array(authenticator.credentialPublicKey), counter: safeCounter(authenticator.credentialCounter), transports: parseTransports(authenticator.transportsJson) }, resolveWebAuthnPolicy(env, isSyntheticReleaseFeatureQaMode(env)), env);
        if (result.verified) { verified = true; passkeyUpdate = { id: authenticator.id, previousCounter: authenticator.credentialCounter, nextCounter: String(result.authenticationInfo.newCounter) }; }
      } catch { verified = false; }
    }
  }
  if (!verified) {
    const attempts = challenge.attempts + 1;
    await client.mfaChallenge.updateMany({ where: { id: challenge.id, usedAt: null, revokedAt: null }, data: { attempts: { increment: 1 }, ...(attempts >= challenge.maxAttempts ? { revokedAt: now } : {}) } });
    await logAuthSecurityEvent(client, { eventType: attempts >= challenge.maxAttempts ? "MFA_RATE_LIMITED" : "MFA_FAILED", userId: input.userId, actorUserId: input.userId, subjectType: "MFA_CHALLENGE", subjectId: challenge.id, details: { action, attempts, factorType: input.factor } });
    throw new Error("STEP_UP_FACTOR_REFUSED");
  }
  const grantId = randomUUID(), grantSecret = generateBoundToken(32);
  const grantHash = hashBoundToken({ token: grantSecret, purpose: "step-up-grant", environment: input.environment, subject: grantSubject(grantId, input.userId, input.sessionId, action) }, env);
  await client.$transaction(async (tx) => {
    if (passkeyUpdate) {
      const updated = await tx.mfaAuthenticator.updateMany({ where: { id: passkeyUpdate.id, credentialCounter: passkeyUpdate.previousCounter, status: "ACTIVE", revokedAt: null }, data: { credentialCounter: passkeyUpdate.nextCounter, lastUsedAt: now, version: { increment: 1 } } });
      if (updated.count !== 1) throw new Error("STEP_UP_FACTOR_REPLAYED");
    }
    const consumed = await tx.mfaChallenge.updateMany({ where: { id: challenge.id, usedAt: null, revokedAt: null }, data: { usedAt: now } });
    if (consumed.count !== 1) throw new Error("STEP_UP_CHALLENGE_REPLAYED");
    await tx.stepUpGrant.create({ data: { id: grantId, tokenHash: grantHash, userId: input.userId, sessionId: input.sessionId, action, expiresAt: new Date(now.getTime() + GRANT_TTL_MS) } });
    await logAuthSecurityEvent(tx, { eventType: "STEP_UP_SUCCEEDED", userId: input.userId, actorUserId: input.userId, subjectType: "AUTH_SESSION", subjectId: input.sessionId, details: { action, factorType: input.factor } });
  });
  return { stepUpToken: `${grantId}.${grantSecret}`, expiresAt: new Date(now.getTime() + GRANT_TTL_MS) };
}

export async function consumeStepUpGrant(client: PrismaClient, input: { stepUpToken: string; userId: string; sessionId: string; action: string; environment: string; now?: Date }, env: NodeJS.ProcessEnv = process.env) {
  const parsed = parseToken(input.stepUpToken), now = input.now ?? new Date(), action = boundedAction(input.action);
  if (!parsed) return false;
  const grant = await client.stepUpGrant.findUnique({ where: { id: parsed.id } });
  if (!grant || grant.userId !== input.userId || grant.sessionId !== input.sessionId || grant.action !== action || grant.usedAt || grant.revokedAt || grant.expiresAt <= now || !boundTokenMatches({ token: parsed.secret, purpose: "step-up-grant", environment: input.environment, subject: grantSubject(grant.id, input.userId, input.sessionId, action), expectedHash: grant.tokenHash }, env)) return false;
  return (await client.stepUpGrant.updateMany({ where: { id: grant.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })).count === 1;
}

function boundedAction(action: string) { const value = action.trim().toUpperCase(); if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(value)) throw new Error("STEP_UP_ACTION_INVALID"); return value; }
function parseToken(token: string) { const match = /^([0-9a-f]{8}-[0-9a-f-]{27})\.([A-Za-z0-9_-]{22,128})$/i.exec(token); return match ? { id: match[1], secret: match[2] } : null; }
function challengeSubject(id: string, userId: string, sessionId: string, action: string) { return `${id}:${userId}:${sessionId}:${action}`; }
function grantSubject(id: string, userId: string, sessionId: string, action: string) { return `${id}:${userId}:${sessionId}:${action}`; }
function parseTransports(value: string | null): AuthenticatorTransportFuture[] | undefined { if (!value) return undefined; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((entry): entry is AuthenticatorTransportFuture => typeof entry === "string" && ["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"].includes(entry)) : undefined; } catch { return undefined; } }
function safeCounter(value: string) { const counter = Number(value); if (!Number.isSafeInteger(counter) || counter < 0) throw new Error("PASSKEY_COUNTER_INVALID"); return counter; }
