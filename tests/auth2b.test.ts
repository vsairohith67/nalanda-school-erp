import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loginIdentifierCandidates, maskAlias, normalizeAliasValue } from "@/lib/auth-identifiers";
import { authHashSecret, authPublicHandleMatches, authSecretMatches, createAuthPublicHandle, createPasswordResetToken, createVerificationCode } from "@/lib/auth-security";
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

  it("uses opaque version-bound browser handles instead of database IDs", () => {
    const handle = createAuthPublicHandle("LOGIN_ALIAS", "user-db-id", "alias-db-id", 3);
    expect(handle).toMatch(/^auth_[a-f0-9]{64}$/);
    expect(handle).not.toContain("alias-db-id");
    expect(authPublicHandleMatches(handle, "LOGIN_ALIAS", "user-db-id", "alias-db-id", 3)).toBe(true);
    expect(authPublicHandleMatches(handle, "LOGIN_ALIAS", "user-db-id", "alias-db-id", 4)).toBe(false);
    expect(authPublicHandleMatches(handle, "LOGIN_ALIAS", "other-user", "alias-db-id", 3)).toBe(false);
  });

  it("keeps account-security database IDs private and resolves only owned opaque handles", () => {
    const listing = source("app/api/auth/security/route.ts");
    const aliases = source("app/api/auth/security/aliases/route.ts");
    const sessions = source("app/api/auth/security/sessions/route.ts");
    expect(listing).toContain('handle: createAuthPublicHandle("LOGIN_ALIAS"');
    expect(listing).toContain('handle: createAuthPublicHandle("SESSION"');
    expect(listing).not.toMatch(/\b(?:aliasId|sessionId|id):\s*(?:alias|session)\.id/);
    expect(aliases).toContain('userId: context.user.id');
    expect(aliases).toMatch(/authPublicHandleMatches\(\s*aliasHandle,\s*"LOGIN_ALIAS"/);
    expect(sessions).toContain('userId: context.user.id');
    expect(sessions).toMatch(/authPublicHandleMatches\(\s*sessionHandle,\s*"SESSION"/);
  });

  it("replaces governed username aliases append-only and revokes sessions with an exact reason", () => {
    const governedUsers = source("lib/iam/users.ts");
    expect(governedUsers).toContain('status: "REMOVED"');
    expect(governedUsers).toContain("removedAt: now");
    expect(governedUsers).toContain("id: randomUUID()");
    expect(governedUsers).toContain('eventType: "LOGIN_ALIAS_REPLACED_BY_ADMIN"');
    expect(governedUsers).toContain('"LOGIN_IDENTIFIER_CHANGED"');
    expect(governedUsers).toContain("credentialVersion: { increment: 1 }");
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
    expect(panel).toContain('event.key === "Escape"');
    expect(panel).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
    expect(middleware).toContain('pathname === "/forgot-password" || pathname === "/reset-password"');
    expect(middleware).toContain('"private, no-store"');
    expect(shell).toContain('pathname === "/forgot-password"');
    expect(shell).toContain('pathname === "/reset-password"');
  });
});
