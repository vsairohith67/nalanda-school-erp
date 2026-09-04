import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { generateRecoveryCodes, recoveryCodeMatches } from "@/lib/real-user-access/recovery-codes";
import { createTotpEnrollment, verifyTotp } from "@/lib/real-user-access/totp";

type MfaClient = PrismaClient | Prisma.TransactionClient;

export async function beginTotpEnrollment(client: MfaClient, input: { userId: string; displayName: string; accountLabel: string }, env: NodeJS.ProcessEnv = process.env) {
  if (!input.displayName.trim() || input.displayName.length > 80 || !input.accountLabel.trim() || input.accountLabel.length > 100) throw new Error("MFA_ENROLLMENT_INPUT_INVALID");
  const id = randomUUID();
  const enrollment = createTotpEnrollment({ userId: input.userId, authenticatorId: id, accountLabel: input.accountLabel }, env);
  const factor = await client.mfaAuthenticator.create({ data: { id, userId: input.userId, type: "TOTP", status: "PENDING", displayName: input.displayName.trim(), secretEnvelope: enrollment.secretEnvelope, keyVersion: enrollment.keyVersion, totpAlgorithm: enrollment.algorithm, totpDigits: enrollment.digits, totpPeriod: enrollment.period } });
  await logAuthSecurityEvent(client, { eventType: "MFA_ENROLLMENT_STARTED", userId: input.userId, actorUserId: input.userId, subjectType: "MFA_AUTHENTICATOR", subjectId: factor.publicKey, details: { factorType: "TOTP" } });
  return { factorHandle: factor.publicKey, provisioningUri: enrollment.provisioningUri };
}

export async function confirmTotpEnrollment(client: PrismaClient, input: { userId: string; factorHandle: string; token: string; environment: string; timestamp?: number }, env: NodeJS.ProcessEnv = process.env) {
  const factor = await client.mfaAuthenticator.findFirst({ where: { publicKey: input.factorHandle, userId: input.userId, type: "TOTP", status: "PENDING" } });
  if (!factor?.secretEnvelope) throw new Error("MFA_ENROLLMENT_UNAVAILABLE");
  const result = verifyTotp({ token: input.token, secretEnvelope: factor.secretEnvelope, userId: factor.userId, authenticatorId: factor.id, lastUsedStep: factor.totpLastUsedStep, timestamp: input.timestamp }, env);
  if (!result.verified || result.usedStep == null) throw new Error(`MFA_TOKEN_REFUSED:${result.reason}`);
  const recoveryCodes = generateRecoveryCodes(input.userId, input.environment, env);
  await client.$transaction(async (tx) => {
    const changed = await tx.mfaAuthenticator.updateMany({ where: { id: factor.id, status: "PENDING", totpLastUsedStep: factor.totpLastUsedStep }, data: { status: "ACTIVE", verifiedAt: new Date(), lastUsedAt: new Date(), totpLastUsedStep: result.usedStep, version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("MFA_ENROLLMENT_CHANGED");
    const rotatedAt = new Date();
    await tx.mfaRecoveryCode.updateMany({ where: { userId: input.userId, status: "ACTIVE", usedAt: null, revokedAt: null }, data: { status: "REVOKED", revokedAt: rotatedAt } });
    await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((entry) => ({ userId: input.userId, authenticatorId: factor.id, codeHash: entry.codeHash })) });
    await logAuthSecurityEvent(tx, { eventType: "MFA_ENROLLED", userId: input.userId, actorUserId: input.userId, subjectType: "MFA_AUTHENTICATOR", subjectId: factor.publicKey, details: { factorType: "TOTP", recoveryCount: recoveryCodes.length } });
  });
  return { verified: true, recoveryCodes: recoveryCodes.map((entry) => entry.code) };
}

export async function verifyActiveTotp(client: PrismaClient, input: { userId: string; token: string; timestamp?: number }, env: NodeJS.ProcessEnv = process.env) {
  const factors = await client.mfaAuthenticator.findMany({ where: { userId: input.userId, type: "TOTP", status: "ACTIVE", revokedAt: null }, orderBy: { createdAt: "asc" }, take: 4 });
  for (const factor of factors) {
    if (!factor.secretEnvelope) continue;
    const result = verifyTotp({ token: input.token, secretEnvelope: factor.secretEnvelope, userId: factor.userId, authenticatorId: factor.id, lastUsedStep: factor.totpLastUsedStep, timestamp: input.timestamp }, env);
    if (!result.verified || result.usedStep == null) continue;
    const changed = await client.mfaAuthenticator.updateMany({ where: { id: factor.id, status: "ACTIVE", revokedAt: null, totpLastUsedStep: factor.totpLastUsedStep }, data: { totpLastUsedStep: result.usedStep, lastUsedAt: new Date(), version: { increment: 1 } } });
    if (changed.count === 1) return { verified: true, factorHandle: factor.publicKey } as const;
  }
  return { verified: false } as const;
}

export async function consumeRecoveryCode(client: PrismaClient, input: { userId: string; code: string; environment: string }, env: NodeJS.ProcessEnv = process.env) {
  const codes = await client.mfaRecoveryCode.findMany({ where: { userId: input.userId, status: "ACTIVE", usedAt: null, revokedAt: null }, take: 24 });
  let matchId: string | null = null;
  for (const row of codes) if (recoveryCodeMatches(input.code, row.codeHash, input.userId, input.environment, env)) matchId = row.id;
  if (!matchId) return { verified: false } as const;
  const usedAt = new Date();
  const changed = await client.mfaRecoveryCode.updateMany({ where: { id: matchId, status: "ACTIVE", usedAt: null, revokedAt: null }, data: { status: "USED", usedAt } });
  if (changed.count !== 1) return { verified: false } as const;
  await logAuthSecurityEvent(client, { eventType: "MFA_RECOVERY_CODE_USED", userId: input.userId, actorUserId: input.userId, subjectType: "USER", subjectId: input.userId, details: { factorType: "RECOVERY_CODE" } });
  return { verified: true } as const;
}

export async function revokeMfaAuthenticator(client: PrismaClient, input: { userId: string; factorHandle: string; actorUserId: string; reason: string }) {
  if (input.reason.trim().length < 8 || input.reason.length > 240) throw new Error("MFA_REVOCATION_REASON_REQUIRED");
  await client.$transaction(async (tx) => {
    const now = new Date();
    const factor = await tx.mfaAuthenticator.findFirst({ where: { publicKey: input.factorHandle, userId: input.userId, status: "ACTIVE", revokedAt: null } });
    if (!factor) throw new Error("MFA_AUTHENTICATOR_NOT_FOUND");
    await tx.mfaAuthenticator.update({ where: { id: factor.id }, data: { status: "REVOKED", revokedAt: now, revokedByUserId: input.actorUserId, revocationReason: input.reason.trim(), version: { increment: 1 } } });
    await tx.mfaRecoveryCode.updateMany({ where: { authenticatorId: factor.id, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: now } });
    await tx.mfaChallenge.updateMany({ where: { userId: input.userId, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
    await tx.stepUpGrant.updateMany({ where: { userId: input.userId, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
    await logAuthSecurityEvent(tx, { eventType: "MFA_AUTHENTICATOR_REVOKED", userId: input.userId, actorUserId: input.actorUserId, subjectType: "MFA_AUTHENTICATOR", subjectId: factor.publicKey, details: { factorType: factor.type, reasonCategory: "GOVERNED_REVOCATION" } });
  });
}
