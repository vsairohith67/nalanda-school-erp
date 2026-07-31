import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export function authHashSecret(value: string, purpose: string, environment: NodeJS.ProcessEnv = process.env) {
  const secret = environment.AUTH_VERIFICATION_SECRET || environment.AUTH_SECRET || environment.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("Authentication verification secret is not configured");
  return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex");
}

export function authSecretMatches(value: string, purpose: string, expectedHash: string) {
  try {
    const actual = Buffer.from(authHashSecret(value, purpose), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function createPasswordResetToken() {
  return randomBytes(32).toString("base64url");
}

type SecurityEventClient = {
  authSecurityEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

export async function logAuthSecurityEvent(client: SecurityEventClient, input: {
  eventType: string;
  userId?: string | null;
  actorUserId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  details?: Record<string, string | number | boolean | null>;
}) {
  const details = input.details ?? null;
  if (details) {
    for (const [key, value] of Object.entries(details)) {
      if (/(password|secret|token|code|cookie|address|mobile|email|identifier|ip)/i.test(key)) {
        throw new Error("AUTH_SECURITY_EVENT_PRIVATE_DETAIL_REFUSED");
      }
      if (typeof value === "string" && value.length > 160) throw new Error("AUTH_SECURITY_EVENT_DETAIL_TOO_LONG");
    }
  }
  await client.authSecurityEvent.create({
    data: {
      eventType: input.eventType,
      userId: input.userId ?? null,
      actorUserId: input.actorUserId ?? null,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      detailsJson: details ? JSON.stringify(details) : null
    }
  });
}
