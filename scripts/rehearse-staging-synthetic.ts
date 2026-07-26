import path from "node:path";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  cleanupStagingRehearsalDatabase,
  createEmptyStagingRehearsalDatabase,
  OPERATIONAL_DATABASE,
  runPnpm,
  runPrisma
} from "./migration-check-utils";

function randomSecret() {
  return randomBytes(32).toString("hex");
}

async function main() {
  const databasePath = createEmptyStagingRehearsalDatabase("staging-synthetic-rehearsal");
  const dataRoot = path.dirname(path.dirname(databasePath));
  const environment: Record<string, string | undefined> = {
    NODE_ENV: "production",
    NALANDA_ENVIRONMENT: "staging",
    NALANDA_DEPLOYMENT_ID: "staging-synthetic-rehearsal",
    NALANDA_LOCAL_REHEARSAL: "true",
    QA20C_ISOLATED_DATABASE: "true",
    QA20C_ISOLATED_ROOT: dataRoot,
    QA20C_OPERATIONAL_DATABASE_PATH: OPERATIONAL_DATABASE,
    APP_ORIGIN: "https://staging.localhost",
    PUBLIC_WEBSITE_URL: "https://staging.localhost",
    PUBLIC_WEBSITE_INDEXING_ENABLED: "false",
    SESSION_COOKIE_SECURE: "true",
    ENABLE_HSTS: "true",
    ENABLE_HTTPS_UPGRADE: "true",
    TRUST_PROXY_HEADERS: "true",
    NALANDA_TRUSTED_PROXY_MODE: "single-hop-sanitized",
    STAGING_DATA_DIR: dataRoot,
    FEE_REGISTER_OCR_STORAGE_DIR: path.join(dataRoot, "private", "ocr"),
    BACKUP_DIRECTORY: path.join(dataRoot, "backups", "json"),
    CLOUD_BACKUP_LOCAL_FOLDER: path.join(dataRoot, "provider"),
    CLOUD_BACKUP_TEMP_DIR: path.join(dataRoot, "temp"),
    CLOUD_BACKUP_REHEARSAL_DIR: path.join(dataRoot, "rehearsal"),
    NEXT_PUBLIC_PWA_BUILD_VERSION: "staging-synthetic-rehearsal",
    AUTH_SECRET: randomSecret(),
    FIRST_RUN_BOOTSTRAP_TOKEN: randomSecret(),
    WHATSAPP_MOCK_WEBHOOK_SECRET: randomSecret(),
    WHATSAPP_MOCK_VERIFY_TOKEN: randomSecret(),
    WHATSAPP_PHONE_HASH_PEPPER: randomSecret(),
    SMS_EMAIL_MOCK_WEBHOOK_SECRET: randomSecret(),
    SMS_EMAIL_CONTACT_HASH_PEPPER: randomSecret(),
    AI_ASSISTANT_AUDIT_HASH_PEPPER: randomSecret(),
    CLOUD_BACKUP_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
    WHATSAPP_LIVE_SENDING_ENABLED: "false",
    SMS_EMAIL_SMS_LIVE_ENABLED: "false",
    SMS_EMAIL_EMAIL_LIVE_ENABLED: "false",
    SMS_EMAIL_SUPERVISED_LIVE_ACTIVATION_ENABLED: "false",
    DEBUG: "false",
    NEXT_PUBLIC_DEBUG: "false",
    NALANDA_DEBUG: "false",
    STAGING_SYNTHETIC_SEED_OPT_IN: "true",
    STAGING_SYNTHETIC_DIRECTOR_PASSWORD: randomSecret(),
    STAGING_SYNTHETIC_PRINCIPAL_PASSWORD: randomSecret(),
    STAGING_SYNTHETIC_TEACHER_PASSWORD: randomSecret(),
    STAGING_SYNTHETIC_PARENT_PASSWORD: randomSecret(),
    SEED_DIRECTOR_PASSWORD: randomSecret(),
    SEED_ADMIN_PASSWORD: randomSecret(),
    SEED_ACCOUNTANT_PASSWORD: randomSecret(),
    SEED_VIEWER_PASSWORD: randomSecret()
  };

  try {
    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databasePath, environment);
    runPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"], databasePath, environment);
    runPnpm(["deployment:env-check"], databasePath, environment);
    runPnpm(["staging:synthetic-seed"], databasePath, environment);
    runPnpm(["staging:synthetic-seed"], databasePath, environment);
    runPnpm(["staging:synthetic-check"], databasePath, environment);

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const counts = database.prepare(`
        SELECT
          (SELECT COUNT(*) FROM User) AS users,
          (SELECT COUNT(*) FROM Student WHERE deletedAt IS NULL) AS students,
          (SELECT COUNT(*) FROM AcademicYearEnrollment WHERE status = 'ACTIVE') AS enrollments,
          (SELECT COUNT(*) FROM Guardian WHERE status = 'Active') AS guardians,
          (SELECT COUNT(*) FROM StaffMember WHERE status = 'ACTIVE') AS staff,
          (SELECT COUNT(*) FROM Payment WHERE deletedAt IS NULL) AS payments
      `).get() as Record<string, number>;
      console.log(
        `Fresh synthetic rehearsal passed: users=${Number(counts.users)} students=${Number(counts.students)} activeEnrollments=${Number(counts.enrollments)} guardians=${Number(counts.guardians)} staff=${Number(counts.staff)} payments=${Number(counts.payments)}`
      );
      console.log("Migration deploy/status, fail-closed environment validation, idempotent seed and synthetic-only proof passed; secret values were not printed.");
    } finally {
      database.close();
    }
  } finally {
    cleanupStagingRehearsalDatabase(databasePath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "STAGING_SYNTHETIC_REHEARSAL_FAILED");
  process.exitCode = 1;
});
