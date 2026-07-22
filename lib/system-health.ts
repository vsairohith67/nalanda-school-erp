import type { PrismaClient } from "@prisma/client";
import { demoTemporaryPassword, SEED_USER_DEFINITIONS } from "@/lib/seed-users";
import { verifyPassword } from "@/lib/password";

export type HealthSeverity = "warning" | "critical";
export type HealthStatus = "Good" | "Warning" | "Critical";

export type SystemHealthIssue = {
  code: string;
  severity: HealthSeverity;
  message: string;
  action: string;
};

export type SystemHealth = {
  status: HealthStatus;
  issues: SystemHealthIssue[];
  sampleDataDetected: boolean;
  checks: {
    sessionSecret: boolean;
    databaseUrl: boolean;
    schoolSettings: boolean;
    activeLeadership: boolean;
    backupFeature: boolean;
    recognizedBuildMode: boolean;
    defaultSeedPasswords: boolean;
  };
};

type HealthClient = Pick<PrismaClient, "user" | "schoolSettings" | "student" | "payment">;
const defaultPasswordCache = new Map<string, boolean>();

export const BANNER_HEALTH_CODES = new Set([
  "missing-session-secret",
  "default-seed-password",
  "missing-director"
]);

export function detectDefaultSeedPasswordWarnings(environment: NodeJS.ProcessEnv = process.env) {
  return SEED_USER_DEFINITIONS.filter((definition) => {
    const configured = environment[definition.env];
    return configured === demoTemporaryPassword(definition)
      || (!configured && environment.NODE_ENV !== "production");
  }).map((definition) => definition.username);
}

export async function detectDefaultSeedAccountPasswords(
  users: ReadonlyArray<{ username: string; passwordHash: string }>
) {
  const defaults: string[] = [];
  for (const definition of SEED_USER_DEFINITIONS) {
    const user = users.find((row) => row.username === definition.username);
    if (!user) continue;
    const cacheKey = `${user.username}:${user.passwordHash}`;
    let isDefault = defaultPasswordCache.get(cacheKey);
    if (isDefault === undefined) {
      isDefault = await verifyPassword(demoTemporaryPassword(definition), user.passwordHash);
      defaultPasswordCache.set(cacheKey, isDefault);
    }
    if (isDefault) defaults.push(user.username);
  }
  return defaults;
}

export function evaluateSystemHealth(input: {
  environment?: NodeJS.ProcessEnv;
  schoolSettingsExists: boolean;
  activeLeadershipCount: number;
  backupFeatureAvailable: boolean;
  sampleDataDetected: boolean;
  defaultSeedUsers?: string[];
}): SystemHealth {
  const environment = input.environment ?? process.env;
  const secret = environment.AUTH_SECRET || environment.SESSION_SECRET;
  const recognizedBuildMode = environment.NODE_ENV === "development" || environment.NODE_ENV === "production";
  const defaultSeedUsers = input.defaultSeedUsers ?? detectDefaultSeedPasswordWarnings(environment);
  const issues: SystemHealthIssue[] = [];

  if (!secret) {
    issues.push({
      code: "missing-session-secret",
      severity: "critical",
      message: "Authentication signing secret is not configured.",
      action: "Set AUTH_SECRET or SESSION_SECRET to a unique value of at least 32 characters, then restart the app."
    });
  } else if (secret.length < 32) {
    issues.push({
      code: "short-session-secret",
      severity: "warning",
      message: "The authentication signing secret is shorter than the recommended 32 characters.",
      action: "Replace it with a unique random value of at least 32 characters, then restart the app."
    });
  }
  if (!environment.DATABASE_URL) {
    issues.push({
      code: "missing-database-url",
      severity: "critical",
      message: "Database URL is not configured.",
      action: "Set DATABASE_URL in .env to the local SQLite database path."
    });
  }
  if (!input.schoolSettingsExists) {
    issues.push({
      code: "missing-school-settings",
      severity: "critical",
      message: "School settings have not been saved.",
      action: "Complete first-run setup or save the School Profile in Settings."
    });
  }
  if (input.activeLeadershipCount === 0) {
    issues.push({
      code: "missing-director",
      severity: "critical",
      message: "No active Director or Super Admin account exists.",
      action: "Complete first-run setup or promote an existing trusted user to Super Admin."
    });
  }
  if (!input.backupFeatureAvailable) {
    issues.push({
      code: "backup-unavailable",
      severity: "critical",
      message: "The full backup feature is unavailable.",
      action: "Repair the backup command and API before entering real school data."
    });
  }
  if (!recognizedBuildMode) {
    issues.push({
      code: "unknown-build-mode",
      severity: "warning",
      message: "The app build mode is not recognized.",
      action: "Run the app with NODE_ENV set by the standard pnpm dev or pnpm build/start commands."
    });
  }
  if (defaultSeedUsers.length) {
    issues.push({
      code: "default-seed-password",
      severity: environment.NODE_ENV === "production" ? "critical" : "warning",
      message: `Documented seed passwords may still be in use for: ${defaultSeedUsers.join(", ")}.`,
      action: "Change those account passwords in User Management before entering real data."
    });
  }
  if (input.sampleDataDetected) {
    issues.push({
      code: "sample-data-detected",
      severity: "warning",
      message: "Seeded sample students or payments are present.",
      action: "Use sample data only for testing. Take a backup and verify the database before importing real records."
    });
  }

  return {
    status: issues.some((issue) => issue.severity === "critical")
      ? "Critical"
      : issues.length
        ? "Warning"
        : "Good",
    issues,
    sampleDataDetected: input.sampleDataDetected,
    checks: {
      sessionSecret: Boolean(secret),
      databaseUrl: Boolean(environment.DATABASE_URL),
      schoolSettings: input.schoolSettingsExists,
      activeLeadership: input.activeLeadershipCount > 0,
      backupFeature: input.backupFeatureAvailable,
      recognizedBuildMode,
      defaultSeedPasswords: defaultSeedUsers.length === 0
    }
  };
}

export async function getSystemHealth(
  client: HealthClient,
  environment: NodeJS.ProcessEnv = process.env
) {
  const [schoolSettings, activeLeadershipCount, sampleStudentCount, samplePaymentCount, seedUsers] = await Promise.all([
    client.schoolSettings.findUnique({ where: { id: "school" }, select: { id: true } }),
    client.user.count({
      where: {
        isActive: true,
        OR: [{ role: "DIRECTOR" }, { role: "SUPER_ADMIN" }]
      }
    }),
    client.student.count({
      where: { admissionNo: { in: ["NPS26001", "NPS26002", "NPS26003", "NPS26004", "NPS26005", "NPS26006", "NPS26007", "NPS26008"] } }
    }),
    client.payment.count({ where: { enteredBy: "Seed" } }),
    client.user.findMany({
      where: { username: { in: SEED_USER_DEFINITIONS.map((definition) => definition.username) } },
      select: { username: true, passwordHash: true }
    })
  ]);
  const defaultSeedUsers = await detectDefaultSeedAccountPasswords(seedUsers);

  return evaluateSystemHealth({
    environment,
    schoolSettingsExists: Boolean(schoolSettings),
    activeLeadershipCount,
    backupFeatureAvailable: true,
    sampleDataDetected: sampleStudentCount > 0 || samplePaymentCount > 0,
    defaultSeedUsers
  });
}
