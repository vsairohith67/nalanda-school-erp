import type { PrismaClient } from "@prisma/client";
import type { AuthDeliveryAdapter } from "@/lib/auth-delivery";
import { resolveLoginIdentifier, type RecoveryChannelType } from "@/lib/auth-identifiers";
import { authHashSecret, authSecretMatches, createPasswordResetToken, logAuthSecurityEvent } from "@/lib/auth-security";
import { hashPassword, validateNewPassword, verifyPassword } from "@/lib/password";

export const GENERIC_RECOVERY_RESPONSE = "If an eligible account uses that recovery channel, reset instructions will be sent.";
const RESET_EXPIRY_MS = 15 * 60 * 1000;

export async function requestPasswordReset(client: PrismaClient, input: {
  identifier: string;
  channelType: RecoveryChannelType;
}, adapter: AuthDeliveryAdapter, now = new Date()) {
  const rawToken = createPasswordResetToken();
  const resolved = await resolveLoginIdentifier(client, input.identifier);
  if (resolved.kind !== "resolved" || !resolved.user.isActive || !adapter.available) return;
  const destination = await client.authLoginAlias.findFirst({
    where: { userId: resolved.user.id, type: input.channelType, status: "VERIFIED" },
    orderBy: { verifiedAt: "desc" }
  });
  if (!destination) return;
  const recent = await client.authPasswordResetToken.count({
    where: { userId: resolved.user.id, purpose: "PASSWORD_RESET", createdAt: { gte: new Date(now.getTime() - RESET_EXPIRY_MS) } }
  });
  if (recent >= 3) return;
  const token = await client.$transaction(async (tx) => {
    await tx.authPasswordResetToken.updateMany({
      where: { userId: resolved.user.id, purpose: "PASSWORD_RESET", usedAt: null, invalidatedAt: null },
      data: { invalidatedAt: now, invalidationReason: "NEWER_RESET_REQUESTED" }
    });
    const created = await tx.authPasswordResetToken.create({
      data: {
        userId: resolved.user.id,
        aliasId: destination.id,
        channelType: input.channelType,
        tokenHash: authHashSecret(rawToken, "password-reset"),
        credentialVersion: resolved.user.credentialVersion,
        expiresAt: new Date(now.getTime() + RESET_EXPIRY_MS)
      }
    });
    await logAuthSecurityEvent(tx, {
      eventType: "PASSWORD_RESET_REQUESTED",
      userId: resolved.user.id,
      subjectType: "PASSWORD_RESET",
      subjectId: created.id,
      details: { channelType: input.channelType }
    });
    return created;
  });
  try {
    await adapter.deliver({
      kind: "PASSWORD_RESET",
      channelType: input.channelType,
      destination: destination.normalizedValue,
      destinationMasked: destination.displayMasked,
      resetPath: `/reset-password#token=${rawToken}`
    });
  } catch {
    await client.authPasswordResetToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { invalidatedAt: new Date(), invalidationReason: "DELIVERY_FAILED" }
    });
  }
}

export async function consumePasswordReset(client: PrismaClient, input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.token)) throw new Error("The reset link is invalid or expired");
  const tokenHash = authHashSecret(input.token, "password-reset");
  const existing = await client.authPasswordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
  const valid = Boolean(
    existing && authSecretMatches(input.token, "password-reset", existing.tokenHash) &&
    !existing.usedAt && !existing.invalidatedAt && existing.expiresAt > now &&
    existing.attempts < existing.maxAttempts && existing.user.isActive &&
    existing.credentialVersion === existing.user.credentialVersion
  );
  if (!valid) {
    if (existing && !existing.usedAt && !existing.invalidatedAt) {
      const attempts = existing.attempts + 1;
      await client.authPasswordResetToken.update({
        where: { id: existing.id },
        data: { attempts, invalidatedAt: attempts >= existing.maxAttempts || existing.expiresAt <= now ? now : null,
          invalidationReason: attempts >= existing.maxAttempts ? "ATTEMPT_LIMIT" : existing.expiresAt <= now ? "EXPIRED" : null }
      });
    }
    throw new Error("The reset link is invalid or expired");
  }
  if (input.newPassword !== input.confirmPassword) throw new Error("Password confirmation does not match");
  validateNewPassword(input.newPassword);
  if (await verifyPassword(input.newPassword, existing!.user.passwordHash)) throw new Error("New password must be different from the current password");
  const passwordHash = await hashPassword(input.newPassword);
  await client.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id: existing!.userId, credentialVersion: existing!.credentialVersion, isActive: true },
      data: { passwordHash, credentialVersion: { increment: 1 } }
    });
    if (changed.count !== 1) throw new Error("The reset link is invalid or expired");
    await tx.authPasswordResetToken.update({ where: { id: existing!.id }, data: { usedAt: now } });
    await tx.authPasswordResetToken.updateMany({
      where: { userId: existing!.userId, id: { not: existing!.id }, usedAt: null, invalidatedAt: null },
      data: { invalidatedAt: now, invalidationReason: "PASSWORD_RESET_COMPLETED" }
    });
    await tx.authVerificationChallenge.updateMany({
      where: { userId: existing!.userId, usedAt: null, invalidatedAt: null },
      data: { invalidatedAt: now }
    });
    await tx.authSession.updateMany({
      where: { userId: existing!.userId, revokedAt: null },
      data: { revokedAt: now, revocationReason: "PASSWORD_RESET" }
    });
    await logAuthSecurityEvent(tx, {
      eventType: "PASSWORD_RESET_COMPLETED",
      userId: existing!.userId,
      actorUserId: existing!.userId,
      subjectType: "PASSWORD_RESET",
      subjectId: existing!.id,
      details: { sessionsRevoked: true }
    });
  });
}
