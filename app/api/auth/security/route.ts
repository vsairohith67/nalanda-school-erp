import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aliasTypeLabel } from "@/lib/auth-identifiers";
import { sessionPublicState } from "@/lib/auth-sessions";
import { createAuthPublicHandle } from "@/lib/auth-security";

export async function GET() {
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  const [aliases, sessions, factors, nativeSessions, offlineDevices] = await Promise.all([
    prisma.authLoginAlias.findMany({ where: { userId: context.user.id }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] }),
    prisma.authSession.findMany({ where: { userId: context.user.id }, orderBy: { lastSeenAt: "desc" }, take: 30 }),
    prisma.mfaAuthenticator.findMany({ where: { userId: context.user.id }, select: { publicKey: true, type: true, status: true, displayName: true, verifiedAt: true, lastUsedAt: true, revokedAt: true, credentialDeviceType: true, credentialBackedUp: true, _count: { select: { recoveryCodes: { where: { status: "ACTIVE", usedAt: null, revokedAt: null } } } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.nativeSession.findMany({ where: { userId: context.user.id }, select: { publicSessionId: true, revokedAt: true, revocationReason: true, lastSeenAt: true, absoluteExpiresAt: true, device: { select: { label: true, platform: true, publicDeviceId: true } } }, orderBy: { lastSeenAt: "desc" }, take: 30 }),
    prisma.offlineSyncDevice.findMany({ where: { userId: context.user.id }, select: { publicDeviceId: true, label: true, platform: true, status: true, approvedAt: true, lastSeenAt: true, revokedAt: true }, orderBy: { createdAt: "desc" }, take: 30 })
  ]);
  return privateJson({
    aliases: aliases.map((alias) => ({
      handle: createAuthPublicHandle("LOGIN_ALIAS", context.user.id, alias.id, alias.version),
      type: alias.type,
      label: aliasTypeLabel(alias.type),
      maskedValue: alias.displayMasked,
      status: alias.status,
      schoolGoverned: alias.isSchoolGoverned,
      version: alias.version,
      verifiedAt: alias.verifiedAt,
      removedAt: alias.removedAt
    })),
    sessions: sessions.map((session) => ({
      handle: createAuthPublicHandle("SESSION", context.user.id, session.id, session.version),
      current: session.id === context.sessionId,
      state: sessionPublicState(session),
      device: session.deviceSummary,
      browser: session.browserSummary,
      network: session.networkEvidenceMasked,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
      revocationReason: session.revocationReason,
      version: session.version
    })),
    factors: factors.map((factor) => ({ handle: factor.publicKey, type: factor.type, status: factor.status, displayName: factor.displayName, verifiedAt: factor.verifiedAt, lastUsedAt: factor.lastUsedAt, revokedAt: factor.revokedAt, deviceType: factor.credentialDeviceType, backedUp: factor.credentialBackedUp, remainingRecoveryCodes: factor._count.recoveryCodes })),
    nativeSessions: nativeSessions.map((session) => ({ handle: session.publicSessionId, state: session.revokedAt ? "REVOKED" : session.absoluteExpiresAt <= new Date() ? "EXPIRED" : "ACTIVE", device: session.device.label, platform: session.device.platform, deviceHandle: session.device.publicDeviceId, lastSeenAt: session.lastSeenAt, expiresAt: session.absoluteExpiresAt, revocationReason: session.revocationReason })),
    offlineDevices: offlineDevices.map((device) => ({ handle: device.publicDeviceId, label: device.label, platform: device.platform, status: device.status, approvedAt: device.approvedAt, lastSeenAt: device.lastSeenAt, revokedAt: device.revokedAt }))
  }, 200);
}

function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
