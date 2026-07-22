import { describe, expect, it } from "vitest";
import {
  detectDefaultSeedAccountPasswords,
  detectDefaultSeedPasswordWarnings,
  evaluateSystemHealth
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
    const usernames = detectDefaultSeedPasswordWarnings({
      NODE_ENV: "production",
      SEED_DIRECTOR_PASSWORD: "NalandaDirector@2026",
      SEED_ADMIN_PASSWORD: "not-default",
      SEED_ACCOUNTANT_PASSWORD: "not-default",
      SEED_VIEWER_PASSWORD: "not-default"
    });

    expect(usernames).toEqual(["director"]);
  });

  it("detects a stored seed account that still uses its documented password", async () => {
    const users = [
      { username: "admin", passwordHash: await hashPassword("NalandaAdmin@2026") },
      { username: "viewer", passwordHash: await hashPassword("UniqueViewerPassword") }
    ];

    expect(await detectDefaultSeedAccountPasswords(users)).toEqual(["admin"]);
  });
});
