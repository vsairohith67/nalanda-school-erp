import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loginIdentifierCandidates, maskAlias, normalizeAliasValue } from "@/lib/auth-identifiers";
import { authHashSecret, authSecretMatches, createPasswordResetToken, createVerificationCode } from "@/lib/auth-security";
import { createSessionCookieValue, hashSessionSecret, sessionHashMatches, verifySessionToken } from "@/lib/session-token";

function source(file: string) { return readFileSync(path.resolve(file), "utf8"); }

describe("AUTH-2B verified identifiers and recovery", () => {
  beforeEach(() => { process.env.AUTH_SECRET = "auth2b-unit-test-secret-that-is-more-than-thirty-two-characters"; });

  it("normalizes governed types exactly without fuzzy matching", () => {
    expect(normalizeAliasValue("USERNAME", " Director.Main ")).toBe("director.main");
    expect(normalizeAliasValue("WORK_EMAIL", " Name@Example.COM ")).toBe("name@example.com");
    expect(normalizeAliasValue("MOBILE", "+91 98765-43210")).toBe("+919876543210");
    expect(normalizeAliasValue("ADMISSION_NUMBER", " nps/2026-01 ")).toBe("NPS/2026-01");
    expect(() => normalizeAliasValue("MOBILE", "9876543210")).toThrow("international mobile");
    expect(loginIdentifierCandidates("not an identifier")).toEqual([]);
  });

  it("masks recovery destinations and hashes short codes with a server secret", () => {
    expect(maskAlias("WORK_EMAIL", "name@example.com")).not.toContain("name@example.com");
    expect(maskAlias("MOBILE", "+919876543210")).toBe("+91•••••210");
    const code = createVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
    const hash = authHashSecret(code, "unit-challenge");
    expect(hash).not.toContain(code);
    expect(authSecretMatches(code, "unit-challenge", hash)).toBe(true);
    expect(authSecretMatches("000000", "unit-challenge", hash)).toBe(false);
    expect(createPasswordResetToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("signs opaque session cookies while storing only the secret hash", async () => {
    const created = await createSessionCookieValue();
    expect(created.cookieValue).not.toBe(created.secret);
    expect(await verifySessionToken(created.cookieValue)).toEqual({ sessionId: created.sessionId, secret: created.secret });
    expect(await verifySessionToken(`${created.cookieValue.slice(0, -1)}x`)).toBeNull();
    const stored = await hashSessionSecret(created.secret);
    expect(stored).not.toContain(created.secret);
    expect(sessionHashMatches(await hashSessionSecret(created.secret), stored)).toBe(true);
  });

  it("uses one additive migration with database checks and username-only backfill", () => {
    const schema = source("prisma/schema.prisma");
    const migration = source("prisma/migrations/20260731130549_auth_verified_recovery_session_registry/migration.sql");
    for (const model of ["AuthLoginAlias", "AuthVerificationChallenge", "AuthPasswordResetToken", "AuthSession", "AuthSecurityEvent"]) {
      expect(schema).toContain(`model ${model}`);
    }
    expect(migration).toContain("AuthLoginAlias_type_check");
    expect(migration).toContain("lower(trim(\"username\"))");
    const backfill = migration.slice(migration.indexOf("-- Existing usernames"), migration.indexOf("-- CreateIndex"));
    expect(backfill.slice(backfill.indexOf("SELECT"))).not.toMatch(/(?:email|mobile|phone)/i);
  });

  it("keeps public auth responses generic and reset secrets out of query strings", () => {
    const login = source("app/api/auth/login/route.ts");
    const request = source("app/api/auth/recovery/request/route.ts");
    const recovery = source("lib/auth-recovery.ts");
    expect(login).not.toContain("{ username: identifier }, { email: identifier }");
    expect(login.match(/GENERIC_LOGIN_ERROR/g)?.length).toBeGreaterThan(3);
    expect(request).toContain("GENERIC_RECOVERY_RESPONSE");
    expect(recovery).toContain("/reset-password#token=");
    expect(recovery).not.toContain("/reset-password?token=");
  });

  it("uses no native confirmation dialogs and enforces private no-store recovery pages", () => {
    const panel = source("components/account-security-panel.tsx");
    const middleware = source("middleware.ts");
    const shell = source("components/app-shell.tsx");
    expect(panel).toContain('role="dialog"');
    expect(panel).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
    expect(middleware).toContain('pathname === "/forgot-password" || pathname === "/reset-password"');
    expect(middleware).toContain('"private, no-store"');
    expect(shell).toContain('pathname === "/forgot-password"');
    expect(shell).toContain('pathname === "/reset-password"');
  });
});
