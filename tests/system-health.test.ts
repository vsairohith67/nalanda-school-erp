import { describe, expect, it } from "vitest";
import {
  detectDefaultSeedAccountPasswords,
  detectDefaultSeedPasswordWarnings,
  evaluateSystemHealth,
  recordedSeedAccountDecisionRoles
} from "../lib/system-health";
import { hashPassword } from "../lib/password";

describe("system health", () => {
  it("reports good health for a configured production environment", () => {
    const health = evaluateSystemHealth({
      environment: {
        NODE_ENV: "production",
        DATABASE_URL: "file:./prod.db",
        AUTH_SECRET: "a-secure-auth-secret-that-is-longer-than-32-characters",
        SEED_DIRECTOR_PASSWORD: "unique-director-password",
        SEED_ADMIN_PASSWORD: "unique-admin-password",
        SEED_ACCOUNTANT_PASSWORD: "unique-accountant-password",
        SEED_VIEWER_PASSWORD: "unique-viewer-password"
      },
      schoolSettingsExists: true,
      activeLeadershipCount: 1,
      backupFeatureAvailable: true,
      sampleDataDetected: false
    });

    expect(health.status).toBe("Good");
    expect(health.issues).toEqual([]);
  });

  it("reports critical missing security and database requirements", () => {
    const health = evaluateSystemHealth({
      environment: { NODE_ENV: "production" },
      schoolSettingsExists: false,
      activeLeadershipCount: 0,
      backupFeatureAvailable: false,
      sampleDataDetected: false
    });

    expect(health.status).toBe("Critical");
    expect(health.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "missing-session-secret",
      "missing-database-url",
      "missing-school-settings",
      "missing-director",
      "backup-unavailable"
    ]));
  });

  it("detects documented default seed passwords without exposing them", () => {
    const roles = detectDefaultSeedPasswordWarnings({
      NODE_ENV: "production",
      SEED_DIRECTOR_PASSWORD: "NalandaDirector@2026",
      SEED_ADMIN_PASSWORD: "not-default",
      SEED_ACCOUNTANT_PASSWORD: "not-default",
      SEED_VIEWER_PASSWORD: "not-default"
    });

    expect(roles).toEqual(["DIRECTOR"]);
  });

  it("detects a stored seed account that still uses its documented password", async () => {
    const users = [
      { username: "admin", passwordHash: await hashPassword("NalandaAdmin@2026") },
      { username: "viewer", passwordHash: await hashPassword("UniqueViewerPassword") }
    ];

    expect(await detectDefaultSeedAccountPasswords(users)).toEqual(["ADMIN"]);
  });

  it("ignores disabled seed accounts when checking stored password provenance", async () => {
    const users = [
      {
        username: "viewer",
        role: "VIEWER",
        isActive: false,
        passwordHash: await hashPassword("NalandaViewer@2026")
      }
    ];
    expect(await detectDefaultSeedAccountPasswords(users)).toEqual([]);
  });

  it("blocks readiness with safe counts for enabled defaults and missing decisions", () => {
    const health = evaluateSystemHealth({
      environment: {
        NODE_ENV: "production",
        DATABASE_URL: "file:./prod.db",
        AUTH_SECRET: "a-secure-auth-secret-that-is-longer-than-32-characters"
      },
      schoolSettingsExists: true,
      activeLeadershipCount: 1,
      backupFeatureAvailable: true,
      sampleDataDetected: false,
      activeSeedRoleCounts: [
        { role: "SUPER_ADMIN", count: 1 },
        { role: "ADMIN", count: 1 },
        { role: "ACCOUNTANT", count: 1 },
        { role: "VIEWER", count: 1 }
      ],
      defaultSeedPasswordRoles: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "VIEWER"],
      seedDecisionRoles: []
    });

    expect(health.status).toBe("Critical");
    expect(health.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      "default-seed-password",
      "seed-account-decision-missing"
    ]));
    expect(health.seedAccounts).toEqual([
      { role: "ACCOUNTANT", activeCount: 1, defaultPasswordMatches: 1, decisionRecorded: false },
      { role: "ADMIN", activeCount: 1, defaultPasswordMatches: 1, decisionRecorded: false },
      { role: "SUPER_ADMIN", activeCount: 1, defaultPasswordMatches: 1, decisionRecorded: false },
      { role: "VIEWER", activeCount: 1, defaultPasswordMatches: 1, decisionRecorded: false }
    ]);
    const rendered = JSON.stringify({ issues: health.issues, seedAccounts: health.seedAccounts });
    expect(rendered).not.toMatch(/username|email|passwordHash|director@|admin@|accountant@|viewer@/i);
  });

  it("accepts only recognized role-level operator decisions", () => {
    expect(recordedSeedAccountDecisionRoles({
      NODE_ENV: "test",
      AUTH_SEED_ACCOUNT_DECISIONS: [
        "SUPER_ADMIN:KEEP_TEMPORARILY",
        "ADMIN:DISABLE_UNTIL_OWNER_ASSIGNED",
        "ACCOUNTANT:DISABLE_UNTIL_OWNER_ASSIGNED",
        "VIEWER:DISABLE_UNTIL_OWNER_ASSIGNED",
        "UNKNOWN:UNSUPPORTED",
        "malformed"
      ].join(",")
    })).toEqual(["ACCOUNTANT", "ADMIN", "SUPER_ADMIN", "VIEWER"]);
  });

  it("clears only the decision gate when all active seed roles have approved choices", () => {
    const health = evaluateSystemHealth({
      environment: {
        NODE_ENV: "production",
        DATABASE_URL: "file:./prod.db",
        AUTH_SECRET: "a-secure-auth-secret-that-is-longer-than-32-characters"
      },
      schoolSettingsExists: true,
      activeLeadershipCount: 1,
      backupFeatureAvailable: true,
      sampleDataDetected: false,
      activeSeedRoleCounts: [
        { role: "SUPER_ADMIN", count: 1 },
        { role: "ADMIN", count: 1 }
      ],
      defaultSeedPasswordRoles: [],
      seedDecisionRoles: ["SUPER_ADMIN", "ADMIN"]
    });
    expect(health.checks.seedAccountDecisions).toBe(true);
    expect(health.issues.map((issue) => issue.code)).not.toContain("seed-account-decision-missing");
  });
});
