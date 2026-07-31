import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aliasTypeLabel } from "@/lib/auth-identifiers";
import { sessionPublicState } from "@/lib/auth-sessions";
import { createAuthPublicHandle } from "@/lib/auth-security";

export async function GET() {
  const context = await getCurrentAuthContext();
  if (!context) return privateJson({ error: "Authentication required" }, 401);
  const [aliases, sessions] = await Promise.all([
    prisma.authLoginAlias.findMany({ where: { userId: context.user.id }, orderBy: [{ type: "asc" }, { createdAt: "asc" }] }),
    prisma.authSession.findMany({ where: { userId: context.user.id }, orderBy: { lastSeenAt: "desc" }, take: 30 })
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
    }))
  }, 200);
}

function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
