import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return readFileSync(path.resolve(relativePath), "utf8");
}

describe("AUTH-2A architecture and decision boundary", () => {
  it("adds no AuthSession model or migration", () => {
    expect(read("prisma/schema.prisma")).not.toMatch(/\bmodel\s+AuthSession\b/);
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    expect(packageJson.scripts["qa:auth2a"]).toBe("tsx scripts/qa-auth2a-copied-db.ts");
  });

  it("keeps session invalidation tied to current password, role, and status", () => {
    const session = read("lib/session-token.ts");
    const auth = read("lib/auth.ts");
    expect(session).toContain("user.isActive");
    expect(session).toContain("sessionRoleMatches(payload, user.role)");
    expect(session).toContain("sessionCredentialTagMatches(payload, user.passwordHash)");
    expect(auth).toContain("sessionAccountStateMatches(payload");
  });

  it("keeps System Health output role-level and credential-free", () => {
    const panel = read("components/system-health-panel.tsx");
    const health = read("lib/system-health.ts");
    expect(panel).toContain("Seed-origin role");
    expect(panel).toContain("Documented-password matches");
    expect(panel).not.toMatch(/username|email|passwordHash|token|cookie/i);
    expect(health).toContain("seed-account-decision-missing");
    expect(health).toContain("defaultSeedPasswordRoles.length");
    expect(health).not.toContain("defaultSeedUsers.join");
  });

  it("records exact choices and the verified P4C outcome without credential material", () => {
    const decision = read("docs/OPERATIONAL_ACCOUNT_OWNERSHIP_DECISION.md");
    for (const phrase of [
      "SECONDARY_SEED_ACCOUNTS_DISABLED",
      "ASSIGN_OWNER_ROTATE_VERIFY",
      "DISABLE_NOW",
      "Lockout-prevention sequence",
      "Session-invalidation effect",
      "Rollback procedure",
      "AuthSession",
      "DEVOPS-1E",
      "No User\nwas deleted",
      "safe `UserAudit` total"
    ]) {
      expect(decision).toContain(phrase);
    }
    expect(decision).toContain("version-37 JSON backup intentionally excludes password hashes");
    expect(decision).not.toMatch(/passwordHash|@nalanda\.local/i);
  });

  it("updates the required documentation set while retaining the historical P2 boundary", () => {
    for (const file of [
      "docs/INDEX.md",
      "docs/SEC_1_SECURITY_AUDIT_AND_HARDENING_REPORT.md",
      "docs/NOOB_OPERATING_GUIDE.md",
      "docs/DEVELOPER_CONTINUATION_GUIDE.md",
      "docs/BUG_LIMITATION_AND_TECH_DEBT_REGISTER.md",
      "docs/PROMPT_HISTORY.md"
    ]) {
      expect(read(file)).toContain("AUTH-2A");
    }
    expect(read("docs/PROMPT_HISTORY.md")).toContain(
      "No operational account,\npassword, role, status, session, or database row changed."
    );
    expect(read("docs/PROMPT_HISTORY.md")).toContain(
      "AUTH-2A-P4B2/P4C - Operational Recovery and Secondary Account Disable"
    );
  });
});
