import type { Role } from "@/lib/permissions";

export function sessionCookieSecure(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.SESSION_COOKIE_SECURE === "false") return false;
  return environment.SESSION_COOKIE_SECURE === "true" || environment.NODE_ENV === "production";
}

export function sessionCookieName(environment: NodeJS.ProcessEnv = process.env) {
  return sessionCookieSecure(environment) ? "__Host-nalanda_session" : "nalanda_session";
}

export const SESSION_COOKIE = sessionCookieName();
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type SessionPayload = {
  userId: string;
  name: string;
  role: Role;
  credentialTag: string;
  sid: string;
  iat: number;
  exp: number;
};

export async function createSessionToken(payload: Omit<SessionPayload, "sid" | "iat" | "exp">) {
  const now = Math.floor(Date.now() / 1000);
  const complete: SessionPayload = {
    ...payload,
    sid: crypto.randomUUID(),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS
  };
  const encoded = base64UrlEncode(JSON.stringify(complete));
  const signature = await sign(encoded);
  return `${encoded}.${signature}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  let expected: string;
  try {
    expected = await sign(encoded);
  } catch {
    return null;
  }
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (
      !payload.userId ||
      !payload.role ||
      !payload.credentialTag ||
      !payload.sid ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function createSessionCredentialTag(userId: string, passwordHash: string) {
  return sign(`credential-state:${userId}:${passwordHash}`);
}

export async function sessionCredentialTagMatches(
  payload: Pick<SessionPayload, "userId" | "credentialTag">,
  passwordHash: string
) {
  try {
    return constantTimeEqual(payload.credentialTag, await createSessionCredentialTag(payload.userId, passwordHash));
  } catch {
    return false;
  }
}

export function sessionRoleMatches(
  payload: Pick<SessionPayload, "role">,
  currentRole: Role
) {
  return payload.role === currentRole;
}

async function sign(value: string) {
  const secret = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET or SESSION_SECRET must be configured with at least 32 characters");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(bytes));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function base64UrlEncode(value: string) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}
