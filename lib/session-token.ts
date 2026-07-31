export function sessionCookieSecure(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.SESSION_COOKIE_SECURE === "false") return false;
  return environment.SESSION_COOKIE_SECURE === "true" || environment.NODE_ENV === "production";
}

export function sessionCookieName(environment: NodeJS.ProcessEnv = process.env) {
  return sessionCookieSecure(environment) ? "__Host-nalanda_session" : "nalanda_session";
}

export const SESSION_COOKIE = sessionCookieName();
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export type SessionCookieReference = { sessionId: string; secret: string };

export async function createSessionCookieValue() {
  const sessionId = crypto.randomUUID();
  const secret = base64UrlEncodeBytes(crypto.getRandomValues(new Uint8Array(32)));
  const envelope = `v1.${sessionId}.${secret}`;
  return { sessionId, secret, cookieValue: `${envelope}.${await sign(envelope)}` };
}

// Middleware validates the signed opaque envelope. The database-backed hash,
// expiry, revocation and credential-version checks happen in lib/auth.ts.
export async function verifySessionToken(token?: string | null): Promise<SessionCookieReference | null> {
  if (!token || token.length > 220) return null;
  const [version, sessionId, secret, signature, extra] = token.split(".");
  if (version !== "v1" || extra || !/^[0-9a-f-]{36}$/i.test(sessionId ?? "") || !/^[A-Za-z0-9_-]{43}$/.test(secret ?? "") || !/^[A-Za-z0-9_-]{43}$/.test(signature ?? "")) {
    return null;
  }
  let expected: string;
  try { expected = await sign(`v1.${sessionId}.${secret}`); } catch { return null; }
  if (!sessionHashMatches(signature, expected)) return null;
  return { sessionId, secret };
}

export async function hashSessionSecret(secret: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`nalanda-session-v1:${secret}`));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sessionHashMatches(actualHash: string, expectedHash: string) {
  if (actualHash.length !== expectedHash.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actualHash.length; index += 1) {
    mismatch |= actualHash.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  }
  return mismatch === 0;
}

function base64UrlEncodeBytes(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(value: string) {
  const secret = process.env.AUTH_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET or SESSION_SECRET must be configured with at least 32 characters");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64UrlEncodeBytes(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}
