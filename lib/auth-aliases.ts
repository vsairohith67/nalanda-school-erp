import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { AuthDeliveryAdapter } from "@/lib/auth-delivery";
import { maskAlias, normalizeAliasValue, type AuthAliasType } from "@/lib/auth-identifiers";
import { authHashSecret, authSecretMatches, createVerificationCode, logAuthSecurityEvent } from "@/lib/auth-security";

const VERIFY_WINDOW_MS = 10 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 3;

export async function beginAliasVerification(
  client: PrismaClient,
  input: { userId: string; type: AuthAliasType; value: string },
  adapter: AuthDeliveryAdapter,
  now = new Date()
) {
  if (input.type === "USERNAME" || input.type === "ADMISSION_NUMBER") {
    throw new Error("This school-governed identifier cannot be edited here");
  }
  if (!adapter.available) throw new Error("Verification delivery is not configured");
  const normalizedValue = normalizeAliasValue(input.type, input.value);
  const displayMasked = maskAlias(input.type, normalizedValue);
  const challengeId = randomUUID();
  const code = createVerificationCode();
  const result = await client.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, credentialVersion: true, isActive: true } });
    if (!user?.isActive) throw new Error("Authentication required");
    const existing = await tx.authLoginAlias.findUnique({ where: { normalizedValue } });
    if (existing && existing.userId !== input.userId) throw new Error("That login identifier is unavailable");
    if (existing?.status === "VERIFIED") throw new Error("That login identifier is already verified");
    const alias = existing
      ? await tx.authLoginAlias.update({
          where: { id: existing.id },
          data: { type: input.type, displayMasked, status: "PENDING", verifiedAt: null, removedAt: null, version: { increment: 1 } }
        })
      : await tx.authLoginAlias.create({
          data: { userId: input.userId, type: input.type, normalizedValue, displayMasked, status: "PENDING" }
        });
    const recent = await tx.authVerificationChallenge.count({
      where: { aliasId: alias.id, createdAt: { gte: new Date(now.getTime() - VERIFY_WINDOW_MS) } }
    });
    if (recent >= MAX_SENDS_PER_WINDOW) throw new Error("Too many verification requests. Please wait and try again.");
    await tx.authVerificationChallenge.updateMany({
      where: { aliasId: alias.id, purpose: "VERIFY_LOGIN_ALIAS", usedAt: null, invalidatedAt: null },
      data: { invalidatedAt: now }
    });
    await tx.authVerificationChallenge.create({
      data: {
        id: challengeId,
        aliasId: alias.id,
        userId: input.userId,
        purpose: "VERIFY_LOGIN_ALIAS",
        codeHash: authHashSecret(code, `alias:${challengeId}`),
        credentialVersion: user.credentialVersion,
        expiresAt: new Date(now.getTime() + VERIFY_WINDOW_MS)
      }
    });
    await logAuthSecurityEvent(tx, {
      eventType: "LOGIN_ALIAS_VERIFICATION_REQUESTED",
      userId: input.userId,
      actorUserId: input.userId,
      subjectType: "LOGIN_ALIAS",
      subjectId: alias.id,
      details: { aliasType: input.type }
    });
    return { aliasId: alias.id, aliasVersion: alias.version };
  });
  try {
    await adapter.deliver({
      kind: "ALIAS_VERIFICATION",
      aliasType: input.type,
      destination: normalizedValue,
      destinationMasked: displayMasked,
      code
    });
  } catch (error) {
    await client.authVerificationChallenge.updateMany({ where: { id: challengeId, usedAt: null }, data: { invalidatedAt: new Date() } });
    throw error;
  }
  return { ...result, displayMasked, expiresInMinutes: VERIFY_WINDOW_MS / 60_000 };
}

export async function verifyLoginAlias(client: PrismaClient, input: {
  userId: string;
  aliasId: string;
  expectedVersion: number;
  code: string;
}, now = new Date()) {
  const result = await client.$transaction(async (tx) => {
    const alias = await tx.authLoginAlias.findFirst({ where: { id: input.aliasId, userId: input.userId } });
    if (!alias) throw new Error("Login identifier not found");
    if (alias.version !== input.expectedVersion) throw new Error("Login identifier changed; refresh and try again");
    if (alias.status !== "PENDING") throw new Error("This login identifier is not awaiting verification");
    const challenge = await tx.authVerificationChallenge.findFirst({
      where: { aliasId: alias.id, userId: input.userId, purpose: "VERIFY_LOGIN_ALIAS", usedAt: null, invalidatedAt: null },
      orderBy: { createdAt: "desc" }
    });
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { credentialVersion: true } });
    const valid = Boolean(
      challenge && user && challenge.expiresAt > now && challenge.attempts < challenge.maxAttempts &&
      challenge.credentialVersion === user.credentialVersion &&
      authSecretMatches(input.code.trim(), `alias:${challenge.id}`, challenge.codeHash)
    );
    if (!valid) {
      if (challenge) {
        const attempts = challenge.attempts + 1;
        await tx.authVerificationChallenge.updateMany({
          where: { id: challenge.id, attempts: challenge.attempts, usedAt: null, invalidatedAt: null },
          data: { attempts, invalidatedAt: attempts >= challenge.maxAttempts || challenge.expiresAt <= now ? now : null }
        });
      }
      return { ok: false as const };
    }
    const challengeClaimed = await tx.authVerificationChallenge.updateMany({
      where: { id: challenge!.id, usedAt: null, invalidatedAt: null, attempts: challenge!.attempts },
      data: { usedAt: now }
    });
    if (challengeClaimed.count !== 1) return { ok: false as const };
    const aliasChanged = await tx.authLoginAlias.updateMany({
      where: { id: alias.id, userId: input.userId, version: input.expectedVersion, status: "PENDING" },
      data: { status: "VERIFIED", verifiedAt: now, removedAt: null, version: { increment: 1 } }
    });
    if (aliasChanged.count !== 1) throw new Error("Login identifier changed; refresh and try again");
    const updated = await tx.authLoginAlias.findUniqueOrThrow({ where: { id: alias.id } });
    await logAuthSecurityEvent(tx, {
      eventType: "LOGIN_ALIAS_VERIFIED",
      userId: input.userId,
      actorUserId: input.userId,
      subjectType: "LOGIN_ALIAS",
      subjectId: alias.id,
      details: { aliasType: alias.type }
    });
    return { ok: true as const, value: { id: updated.id, version: updated.version, status: updated.status } };
  });
  if (!result.ok) throw new Error("The verification code is invalid or expired");
  return result.value;
}

export async function removeLoginAlias(client: PrismaClient, input: {
  userId: string;
  aliasId: string;
  expectedVersion: number;
}, now = new Date()) {
  return client.$transaction(async (tx) => {
    const alias = await tx.authLoginAlias.findFirst({ where: { id: input.aliasId, userId: input.userId } });
    if (!alias) throw new Error("Login identifier not found");
    if (alias.version !== input.expectedVersion) throw new Error("Login identifier changed; refresh and try again");
    if (alias.isSchoolGoverned || alias.type === "USERNAME" || alias.type === "ADMISSION_NUMBER") {
      throw new Error("This school-governed identifier cannot be removed here");
    }
    if (alias.status !== "VERIFIED") throw new Error("Only a verified login identifier can be removed");
    const usable = await tx.authLoginAlias.count({ where: { userId: input.userId, status: "VERIFIED", id: { not: alias.id } } });
    if (usable < 1) throw new Error("The last usable login identifier cannot be removed");
    const changed = await tx.authLoginAlias.updateMany({
      where: { id: alias.id, userId: input.userId, version: input.expectedVersion, status: "VERIFIED" },
      data: { status: "REMOVED", removedAt: now, version: { increment: 1 } }
    });
    if (changed.count !== 1) throw new Error("Login identifier changed; refresh and try again");
    const updated = await tx.authLoginAlias.findUniqueOrThrow({ where: { id: alias.id } });
    await tx.authVerificationChallenge.updateMany({ where: { aliasId: alias.id, usedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
    await tx.authPasswordResetToken.updateMany({ where: { aliasId: alias.id, usedAt: null, invalidatedAt: null }, data: { invalidatedAt: now, invalidationReason: "ALIAS_REMOVED" } });
    await logAuthSecurityEvent(tx, {
      eventType: "LOGIN_ALIAS_REMOVED",
      userId: input.userId,
      actorUserId: input.userId,
      subjectType: "LOGIN_ALIAS",
      subjectId: alias.id,
      details: { aliasType: alias.type }
    });
    return { id: updated.id, version: updated.version, status: updated.status };
  });
}
