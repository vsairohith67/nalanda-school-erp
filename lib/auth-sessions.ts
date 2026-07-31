import type { Prisma, PrismaClient } from "@prisma/client";
import { loginRequestSource } from "@/lib/auth-rate-limit";
import {
  createSessionCookieValue,
  hashSessionSecret,
  SESSION_MAX_AGE_SECONDS,
  sessionHashMatches,
  verifySessionToken
} from "@/lib/session-token";

const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000;

type AuthSessionRow = Prisma.AuthSessionGetPayload<{ include: { user: true } }>;
type SessionClient = Pick<PrismaClient, "authSession">;

export async function createPersistedSession(
  client: SessionClient,
  user: { id: string; credentialVersion: number },
  headers: Pick<Headers, "get">,
  now = new Date()
) {
  const token = await createSessionCookieValue();
  const summary = clientSummary(headers);
  await client.authSession.create({
    data: {
      id: token.sessionId,
      userId: user.id,
      tokenHash: await hashSessionSecret(token.secret),
      credentialVersion: user.credentialVersion,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000),
      deviceSummary: summary.device,
      browserSummary: summary.browser,
      networkEvidenceMasked: maskNetworkEvidence(loginRequestSource(headers))
    }
  });
  return token;
}

export async function resolvePersistedSession(client: SessionClient, cookieValue?: string | null, now = new Date()) {
  const reference = await verifySessionToken(cookieValue);
  if (!reference) return null;
  const row = await client.authSession.findUnique({ where: { id: reference.sessionId }, include: { user: true } });
  if (!row) return null;
  const actualHash = await hashSessionSecret(reference.secret);
  if (!sessionHashMatches(actualHash, row.tokenHash)) return null;
  if (
    row.revokedAt || row.expiresAt <= now || !row.user.isActive ||
    row.credentialVersion !== row.user.credentialVersion
  ) return null;
  if (now.getTime() - row.lastSeenAt.getTime() >= LAST_SEEN_WRITE_INTERVAL_MS) {
    await client.authSession.updateMany({
      where: {
        id: row.id,
        revokedAt: null,
        lastSeenAt: { lte: new Date(now.getTime() - LAST_SEEN_WRITE_INTERVAL_MS) }
      },
      data: { lastSeenAt: now }
    });
    row.lastSeenAt = now;
  }
  return row;
}

export async function revokeSessions(client: SessionClient, input: {
  userId: string;
  sessionId?: string;
  excludeSessionId?: string;
  reason: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return client.authSession.updateMany({
    where: {
      userId: input.userId,
      revokedAt: null,
      expiresAt: { gt: now },
      ...(input.sessionId ? { id: input.sessionId } : {}),
      ...(input.excludeSessionId ? { id: { not: input.excludeSessionId } } : {})
    },
    data: { revokedAt: now, revocationReason: input.reason }
  });
}

export function sessionPublicState(row: {
  revokedAt: Date | null;
  expiresAt: Date;
}, now = new Date()) {
  if (row.revokedAt) return "REVOKED";
  if (row.expiresAt <= now) return "EXPIRED";
  return "CURRENT";
}

function clientSummary(headers: Pick<Headers, "get">) {
  const userAgent = headers.get("user-agent")?.slice(0, 512) ?? "";
  const browser = /Edg\//.test(userAgent) ? "Edge" : /Firefox\//.test(userAgent) ? "Firefox" :
    /Chrome\//.test(userAgent) ? "Chrome" : /Safari\//.test(userAgent) ? "Safari" : "Other browser";
  const device = /iPad|Tablet/i.test(userAgent) ? "Tablet" : /Mobile|Android|iPhone/i.test(userAgent) ? "Mobile" :
    userAgent ? "Desktop" : "Unknown device";
  return { browser, device };
}

export function maskNetworkEvidence(source: string) {
  if (source === "direct") return "Direct connection";
  const ipv4 = source.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (ipv4 && ipv4.slice(1).every((part) => Number(part) <= 255)) return `${ipv4[1]}.${ipv4[2]}.${ipv4[3]}.*`;
  if (source.includes(":")) return `${source.split(":").slice(0, 3).join(":")}::/48`;
  return "Network unavailable";
}
