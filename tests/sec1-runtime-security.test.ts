import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  checkLoginRateLimit,
  loginRequestSource,
  recordLoginFailure,
  resetLoginRateLimitForTests
} from "../lib/auth-rate-limit";
import { parsePositiveIntegerPathParameter } from "../lib/path-parameters";
import {
  applicationOrigin,
  contentSecurityPolicy,
  requestBodyLimitBytes,
  requestBodyTooLarge,
  unsafeRequestOriginAllowed
} from "../lib/request-security";

describe("SEC-1 runtime security hardening", () => {
  const previousSecret = process.env.AUTH_SECRET;
  const previousSecure = process.env.SESSION_COOKIE_SECURE;
  const previousTrustProxy = process.env.TRUST_PROXY_HEADERS;
  const previousTrustedProxyMode = process.env.NALANDA_TRUSTED_PROXY_MODE;

  it("provides a safe custom 404 with an explicit recovery action", () => {
    const source = readFileSync("app/not-found.tsx", "utf8");
    expect(source).toContain("Page not found");
    expect(source).toContain("No data was changed");
    expect(source).toContain('href="/"');
    expect(source).not.toMatch(/error\.(message|stack)/);
  });

  beforeEach(() => {
    resetLoginRateLimitForTests();
    process.env.AUTH_SECRET = "qasec1-test-secret-that-is-longer-than-thirty-two-characters";
    process.env.SESSION_COOKIE_SECURE = "false";
    delete process.env.TRUST_PROXY_HEADERS;
    delete process.env.NALANDA_TRUSTED_PROXY_MODE;
  });

  afterEach(() => {
    process.env.AUTH_SECRET = previousSecret;
    process.env.SESSION_COOKIE_SECURE = previousSecure;
    if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY_HEADERS;
    else process.env.TRUST_PROXY_HEADERS = previousTrustProxy;
    if (previousTrustedProxyMode === undefined) delete process.env.NALANDA_TRUSTED_PROXY_MODE;
    else process.env.NALANDA_TRUSTED_PROXY_MODE = previousTrustedProxyMode;
  });

  it("bounds repeated account and source login failures without permanent lockout", async () => {
    const input = { identifier: "qasec1-user", source: "127.0.0.1" };
    for (let index = 0; index < 9; index += 1) {
      expect((await recordLoginFailure(input, index)).blocked).toBe(false);
    }
    expect((await recordLoginFailure(input, 9)).blocked).toBe(true);
    expect((await checkLoginRateLimit(input, 10)).allowed).toBe(false);
    expect((await checkLoginRateLimit(input, 61_010)).allowed).toBe(true);
  });

  it("still bounds direct-source login spraying without trusting forwarded headers", async () => {
    const input = { identifier: "qasec1-victim", source: "direct" };
    for (let index = 0; index < 10; index += 1) await recordLoginFailure(input, index);
    expect((await checkLoginRateLimit(input, 20)).allowed).toBe(false);
    expect((await checkLoginRateLimit({ identifier: "qasec1-unrelated", source: "direct" }, 20)).allowed).toBe(true);
  });

  it("rotates opaque session secrets and stores only a comparable hash", async () => {
    const {
      createSessionCookieValue,
      hashSessionSecret,
      sessionHashMatches,
      verifySessionToken
    } = await import("../lib/session-token");
    const first = await createSessionCookieValue();
    const second = await createSessionCookieValue();
    expect(second.cookieValue).not.toBe(first.cookieValue);
    expect((await verifySessionToken(first.cookieValue))?.sessionId).toBe(first.sessionId);
    const stored = await hashSessionSecret(first.secret);
    expect(stored).not.toContain(first.secret);
    expect(sessionHashMatches(await hashSessionSecret(first.secret), stored)).toBe(true);
    expect(sessionHashMatches(await hashSessionSecret(second.secret), stored)).toBe(false);
    expect(readFileSync("lib/auth.ts", "utf8")).toContain("resolvePersistedSession(prisma");
  });

  it("uses a Host-prefixed Secure cookie by default in production", async () => {
    const { sessionCookieSecure } = await import("../lib/session-token");
    expect(sessionCookieSecure({ NODE_ENV: "production" })).toBe(true);
    expect(sessionCookieSecure({ NODE_ENV: "production", SESSION_COOKIE_SECURE: "false" })).toBe(false);
    expect(sessionCookieSecure({ NODE_ENV: "development" })).toBe(false);
  });

  it("deletes the session cookie with the same production Secure policy", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    try {
      Object.assign(process.env, { NODE_ENV: "production" });
      delete process.env.SESSION_COOKIE_SECURE;
      const logout = readFileSync("app/api/auth/logout/route.ts", "utf8");
      expect(logout).toContain('response.cookies.set(sessionCookieName(), ""');
      expect(logout).toContain("secure: sessionCookieSecure()");
      expect(logout).toContain("httpOnly: true");
      expect(logout).toContain('sameSite: "strict"');
    } finally {
      if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
      else Object.assign(process.env, { NODE_ENV: previousNodeEnv });
    }
  });

  it("forces the authenticated root layout to render per request", () => {
    const source = readFileSync("app/layout.tsx", "utf8");
    expect(source).toContain('export const dynamic = "force-dynamic"');
  });

  it("mounts a shared keyboard guard for authenticated modal dialogs", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");
    const guard = readFileSync("components/modal-accessibility-guard.tsx", "utf8");
    expect(layout).toContain("<ModalAccessibilityGuard />");
    expect(guard).toContain('event.key === "Escape"');
    expect(guard).toContain('event.key !== "Tab"');
    expect(guard).toContain("lastFocusOutsideDialog?.focus()");
  });

  it("blocks cross-site unsafe requests while retaining signed-provider webhook entry points", () => {
    const request = (pathname: string, method: string, headers: Record<string, string>) => ({
      method,
      headers: new Headers(headers),
      nextUrl: new URL(`http://localhost:3011${pathname}`)
    });
    expect(unsafeRequestOriginAllowed(request("/api/auth/logout", "POST", {
      origin: "https://attacker.qasec1.invalid",
      host: "127.0.0.1:3011"
    }) as never)).toBe(false);
    expect(unsafeRequestOriginAllowed(request("/api/auth/logout", "POST", {
      origin: "http://localhost:3011",
      host: "127.0.0.1:3011"
    }) as never)).toBe(true);
    expect(unsafeRequestOriginAllowed(request("/api/sms-email/webhook/QASEC1", "POST", {}) as never)).toBe(true);
  });

  it("returns a bounded body decision before parsing oversized requests", async () => {
    const request = (pathname: string, length: number) => ({
      method: "POST",
      headers: new Headers({ "content-length": String(length) }),
      nextUrl: new URL(`http://localhost:3011${pathname}`),
      body: null,
      clone() {
        return this;
      }
    });
    expect(await requestBodyTooLarge(request("/api/students", requestBodyLimitBytes("/api/students")) as never)).toBe(false);
    expect(await requestBodyTooLarge(request("/api/students", requestBodyLimitBytes("/api/students") + 1) as never)).toBe(true);
    expect(await requestBodyTooLarge(request(
      "/api/fee-register-ocr/batches/qasec1-batch/pages",
      requestBodyLimitBytes("/api/students") + 1
    ) as never)).toBe(false);
  });

  it("bounds lengthless streamed bodies and leaves small bodies accepted", async () => {
    const request = (size: number) => {
      const base = new Request("http://localhost:3011/api/students", {
        method: "POST",
        body: new Uint8Array(size),
        duplex: "half"
      } as RequestInit);
      return Object.assign(base, { nextUrl: new URL(base.url) });
    };
    expect(await requestBodyTooLarge(request(1024) as never)).toBe(false);
    expect(await requestBodyTooLarge(request(requestBodyLimitBytes("/api/students") + 1) as never)).toBe(true);
  });

  it("ignores forwarded origins unless proxy-header trust is explicit", () => {
    const request = {
      method: "POST",
      headers: new Headers({
        origin: "https://proxy.qasec1.invalid",
        "x-forwarded-host": "proxy.qasec1.invalid",
        "x-forwarded-proto": "https"
      }),
      nextUrl: new URL("http://localhost:3011/api/auth/logout")
    };
    expect(unsafeRequestOriginAllowed(request as never)).toBe(false);
    process.env.TRUST_PROXY_HEADERS = "true";
    expect(unsafeRequestOriginAllowed(request as never)).toBe(false);
    process.env.NALANDA_TRUSTED_PROXY_MODE = "single-hop-sanitized";
    expect(unsafeRequestOriginAllowed(request as never)).toBe(true);
  });

  it("builds protected redirects from the validated application origin", () => {
    const request = { nextUrl: new URL("http://127.0.0.1:3101/settings") };
    expect(applicationOrigin(request as never, "https://staging.nalandaps.com/path")).toBe("https://staging.nalandaps.com");
    expect(applicationOrigin(request as never, "not-a-url")).toBe("http://127.0.0.1:3101");
  });

  it("accepts a forwarded client address only in the sanitized single-hop mode", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.10, 198.51.100.2", "x-real-ip": "192.0.2.20" });
    expect(loginRequestSource(headers, { TRUST_PROXY_HEADERS: "true" })).toBe("direct");
    expect(loginRequestSource(headers, {
      TRUST_PROXY_HEADERS: "true",
      NALANDA_TRUSTED_PROXY_MODE: "single-hop-sanitized"
    })).toBe("203.0.113.10");
  });

  it("uses a nonce-based CSP without script unsafe-inline or remote wildcards", () => {
    const csp = contentSecurityPolicy("qasec1nonce", false);
    expect(csp).toContain("script-src 'self' 'nonce-qasec1nonce' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("*");
  });

  it("rejects malformed and unbounded numeric path parameters before data access", () => {
    expect(parsePositiveIntegerPathParameter("1")).toBe(1);
    expect(parsePositiveIntegerPathParameter("999999999")).toBe(999999999);
    for (const value of ["", "0", "-1", "1.5", "NaN", "Infinity", "9999999999", "1%0d%0a"]) {
      expect(parsePositiveIntegerPathParameter(value)).toBeNull();
    }
  });
});
