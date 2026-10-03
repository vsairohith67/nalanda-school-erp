import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { isRole } from "@/lib/permissions";
import { createPersistedSession } from "@/lib/auth-sessions";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { accessTemplate } from "@/lib/real-user-access/catalogue";
import { boundTokenMatches, generateBoundToken, hashBoundToken } from "@/lib/real-user-access/crypto";
import { consumeRecoveryCode, verifyActiveTotp } from "@/lib/real-user-access/mfa-service";
import { createPasskeyAuthenticationOptions, hashWebAuthnChallenge, resolveWebAuthnPolicy, verifyPasskeyAuthentication } from "@/lib/real-user-access/webauthn";
import { isSyntheticReleaseFeatureQaMode } from "@/lib/release-feature-flag-runtime";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";

const LOGIN_MFA_TTL_MS = 5 * 60_000;

export function boundAuthEnvironment(env: NodeJS.ProcessEnv = process.env) {
  const value = String(env.AUTH_BOUND_ENVIRONMENT ?? (env.NODE_ENV === "production" ? "PRODUCTION" : "DEVELOPMENT")).trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_-]{2,31}$/.test(value)) throw new Error("AUTH_BOUND_ENVIRONMENT_INVALID");
  return value;
}

export async function userRequiresMfa(client: PrismaClient, userId: string, now = new Date()) {
  const [roles, factors] = await Promise.all([
    client.userRoleAssignment.findMany({ where: { userId, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] }, select: { role: true } }),
    client.mfaAuthenticator.count({ where: { userId, status: "ACTIVE", verifiedAt: { not: null }, revokedAt: null } })
  ]);
  return { required: factors > 0 || roles.some((entry) => accessTemplate(entry.role)?.mfa === "MANDATORY"), enrolled: factors > 0 };
}

export async function createLoginMfaChallenge(client: PrismaClient, input: { userId: string; environment: string; now?: Date }, env: NodeJS.ProcessEnv = process.env) {
  const now = input.now ?? new Date(), state = await userRequiresMfa(client, input.userId, now);
  if (!state.required) return { required: false } as const;
  if (!state.enrolled) return { required: true, enrolled: false } as const;
  const passkeys = await client.mfaAuthenticator.findMany({ where: { userId: input.userId, type: "WEBAUTHN", status: "ACTIVE", verifiedAt: { not: null }, revokedAt: null, credentialId: { not: null } }, select: { credentialId: true, transportsJson: true } });
  const id = randomUUID(), secret = generateBoundToken(32);
  const webauthnOptions = passkeys.length ? await createPasskeyAuthenticationOptions(passkeys.map((factor) => ({ credentialId: factor.credentialId!, transports: parseTransports(factor.transportsJson) })), resolveWebAuthnPolicy(env, isSyntheticReleaseFeatureQaMode(env))) : null;
  const tokenHash = hashBoundToken({ token: secret, purpose: "login-mfa-challenge", environment: input.environment, subject: `${id}:${input.userId}` }, env);
  await client.mfaChallenge.create({ data: { id, tokenHash, challengeHash: webauthnOptions ? hashWebAuthnChallenge(webauthnOptions.challenge, id, input.environment, env) : null, userId: input.userId, type: "LOGIN", action: "LOGIN", environment: input.environment, expiresAt: new Date(now.getTime() + LOGIN_MFA_TTL_MS) } });
  return { required: true, enrolled: true, challengeToken: `${id}.${secret}`, expiresAt: new Date(now.getTime() + LOGIN_MFA_TTL_MS), webauthnOptions } as const;
}

type LoginMfaInput = { challengeToken: string; environment: string; factor: "TOTP" | "RECOVERY_CODE" | "WEBAUTHN"; response: string | AuthenticationResponseJSON; now?: Date; timestamp?: number };
export async function completeLoginMfaChallenge(client: PrismaClient, input: LoginMfaInput, env: NodeJS.ProcessEnv = process.env) {
  return client.$transaction(tx => verifyLoginMfa(tx, input, env));
}
/** Verification and issuance share a transaction, never a client-supplied proof. */
export async function completeLoginMfaSignIn(client: PrismaClient, input: LoginMfaInput, headers: Pick<Headers, "get">, env: NodeJS.ProcessEnv = process.env) {
  return client.$transaction(tx => verifyLoginMfa(tx, input, env, headers));
}
async function verifyLoginMfa(client: Prisma.TransactionClient, input: LoginMfaInput, env: NodeJS.ProcessEnv, headers?: Pick<Headers, "get">) {
  const parsed = parse(input.challengeToken), now = input.now ?? new Date();
  if (!parsed) return { verified: false, reason: "REFUSED" as const };
  const challenge = await client.mfaChallenge.findUnique({ where: { id: parsed.id }, include: { user: true } });
  if (!challenge || challenge.type !== "LOGIN" || challenge.action !== "LOGIN" || challenge.environment !== input.environment || challenge.usedAt || challenge.revokedAt || challenge.expiresAt <= now || challenge.attempts >= challenge.maxAttempts || !challenge.user.isActive || challenge.user.lifecycleStatus !== "ACTIVE" || !boundTokenMatches({ token: parsed.secret, purpose: "login-mfa-challenge", environment: input.environment, subject: `${challenge.id}:${challenge.userId}`, expectedHash: challenge.tokenHash }, env)) return { verified: false, reason: "REFUSED" as const };
  let factorVerified = false;
  let passkeyUpdate: { id: string; previousCounter: string; nextCounter: string } | null = null;
  if (input.factor === "WEBAUTHN" && challenge.challengeHash && typeof input.response === "object") {
    const credentialId = input.response.id;
    const authenticator = await client.mfaAuthenticator.findFirst({ where: { userId: challenge.userId, credentialId, type: "WEBAUTHN", status: "ACTIVE", verifiedAt: { not: null }, revokedAt: null } });
    if (authenticator?.credentialPublicKey && authenticator.credentialCounter != null && authenticator.rpId) {
      try {
        const verified = await verifyPasskeyAuthentication({ response: input.response, challengeId: challenge.id, challengeHash: challenge.challengeHash, environment: input.environment, credentialId, publicKey: new Uint8Array(authenticator.credentialPublicKey), counter: safeCounter(authenticator.credentialCounter), transports: parseTransports(authenticator.transportsJson) }, resolveWebAuthnPolicy(env, isSyntheticReleaseFeatureQaMode(env)), env);
        if (verified.verified) {
          factorVerified = true;
          passkeyUpdate = { id: authenticator.id, previousCounter: authenticator.credentialCounter, nextCounter: String(verified.authenticationInfo.newCounter) };
        }
      } catch { factorVerified = false; }
    }
  } else if (typeof input.response === "string") {
    const factor = input.factor === "TOTP"
      ? await verifyActiveTotp(client, { userId: challenge.userId, token: input.response, timestamp: input.timestamp }, env)
      : input.factor === "RECOVERY_CODE"
        ? await consumeRecoveryCode(client, { userId: challenge.userId, code: input.response, environment: input.environment }, env)
        : { verified: false };
    factorVerified = factor.verified;
  }
  if (!factorVerified) {
    const attempts = challenge.attempts + 1;
    await client.mfaChallenge.updateMany({ where: { id: challenge.id, usedAt: null, revokedAt: null }, data: { attempts: { increment: 1 }, ...(attempts >= challenge.maxAttempts ? { revokedAt: now } : {}) } });
    await logAuthSecurityEvent(client, { eventType: attempts >= challenge.maxAttempts ? "MFA_RATE_LIMITED" : "MFA_FAILED", userId: challenge.userId, actorUserId: challenge.userId, subjectType: "MFA_CHALLENGE", subjectId: challenge.id, details: { factorType: input.factor, attempts } });
    return { verified: false, reason: "REFUSED" as const };
  }
  if (passkeyUpdate) {
    const updated = await client.mfaAuthenticator.updateMany({ where: { id: passkeyUpdate.id, credentialCounter: passkeyUpdate.previousCounter, status: "ACTIVE", revokedAt: null }, data: { credentialCounter: passkeyUpdate.nextCounter, lastUsedAt: now, version: { increment: 1 } } });
    if (updated.count !== 1) throw new Error("MFA_LOGIN_REPLAYED");
  }
  const used = await client.mfaChallenge.updateMany({ where: { id: challenge.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
  // A losing challenge CAS must roll back factor consumption too.
  if (used.count !== 1) throw new Error("MFA_LOGIN_REPLAYED");
  const user = await client.user.findUniqueOrThrow({ where: { id: challenge.userId } });
  if ((headers && !isRole(user.role)) || !user.isActive || user.lifecycleStatus !== "ACTIVE" || user.credentialVersion !== challenge.user.credentialVersion || user.authorizationVersion !== challenge.user.authorizationVersion) throw new Error("MFA_LOGIN_ACCOUNT_CHANGED");
  const session = headers ? await createPersistedSession(client, user, headers, now) : null;
  await logAuthSecurityEvent(client, { eventType: "MFA_LOGIN_SUCCEEDED", userId: user.id, actorUserId: user.id, subjectType: "MFA_CHALLENGE", subjectId: challenge.id, details: { factorType: input.factor, environment: input.environment, verifiedAt: now.toISOString(), webSessionId: session?.sessionId ?? null } });
  if (session) {
    const issued = await client.authSession.findUniqueOrThrow({ where: { id: session.sessionId }, select: { activeRoleAssignmentId: true } });
    await client.mfaChallenge.update({ where: { id: challenge.id }, data: { sessionId: session.sessionId, roleAssignmentId: issued.activeRoleAssignmentId } });
    await logAuthSecurityEvent(client, { eventType: "MFA_LOGIN_SESSION_ISSUED", userId: user.id, actorUserId: user.id, subjectType: "AUTH_SESSION", subjectId: session.sessionId, details: { version: 1, challengeId: challenge.id, factorType: input.factor, environment: input.environment, verifiedAt: now.toISOString(), roleAssignmentId: issued.activeRoleAssignmentId, credentialVersion: user.credentialVersion, authorizationVersion: user.authorizationVersion } });
  }
  return { verified: true, user, session } as const;
}

function parse(token: string) { const match = /^([0-9a-f]{8}-[0-9a-f-]{27})\.([A-Za-z0-9_-]{22,128})$/i.exec(token); return match ? { id: match[1], secret: match[2] } : null; }
function parseTransports(value: string | null): AuthenticatorTransportFuture[] | undefined { if (!value) return undefined; try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((entry): entry is AuthenticatorTransportFuture => typeof entry === "string" && ["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"].includes(entry)) : undefined; } catch { return undefined; } }
function safeCounter(value: string) { const counter = Number(value); if (!Number.isSafeInteger(counter) || counter < 0) throw new Error("PASSKEY_COUNTER_INVALID"); return counter; }
