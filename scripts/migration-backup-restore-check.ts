import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import { hashPassword } from "../lib/password";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import {
  QA_ROOT,
  assertIsolatedDatabasePath,
  businessBaseline,
  cleanupIsolatedDatabase,
  createEmptyIsolatedDatabase,
  databaseUrl,
  runPnpm,
  runPrisma
} from "./migration-check-utils";

const SYNTHETIC_ENV = {
  NODE_ENV: "development" as const,
  SEED_DIRECTOR_PASSWORD: "DEVOPS1B-local-only-Director-2026!",
  SEED_ADMIN_PASSWORD: "DEVOPS1B-local-only-Admin-2026!",
  SEED_ACCOUNTANT_PASSWORD: "DEVOPS1B-local-only-Accountant-2026!",
  SEED_VIEWER_PASSWORD: "DEVOPS1B-local-only-Viewer-2026!"
};

const actor = { id: "devops1b-restore-actor", name: "DEVOPS1B Restore Actor" };
const LEGACY_COUNT_OMISSIONS = new Set([
  "students", "feeStructures", "payments", "paymentAudits", "users", "receiptNotes",
  "importBatches", "onboardingBatches", "onboardingRowOutcomes", "onboardingAuditEvents",
  "goLiveChecklist", "timetableTeacherUnavailability", "timetableFixedPeriods"
]);

function prismaFor(databasePath: string) {
  return new PrismaClient({ datasourceUrl: databaseUrl(databasePath) });
}

async function createActor(prisma: PrismaClient) {
  await prisma.user.create({
    data: {
      id: actor.id,
      name: actor.name,
      username: "devops1b-restore-actor",
      email: "devops1b-restore@invalid.local",
      role: "DIRECTOR",
      isActive: true,
      passwordHash: await hashPassword("DEVOPS1B-local-only-Restore-2026!")
    }
  });
}

function assertRestoreHasNoErrors(result: Record<string, unknown>) {
  const failures: string[] = [];
  for (const [key, value] of Object.entries(result)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const errors = (value as { errors?: unknown[] }).errors;
    if (errors?.length) failures.push(`${key}:${errors.length}`);
  }
  if (failures.length) throw new Error(`RESTORE_ENTITY_ERRORS: ${failures.join(",")}`);
}

export async function runMigrationBackupRestoreCheck() {
  const sourcePath = createEmptyIsolatedDatabase("restore", "backup-source");
  const targetPath = createEmptyIsolatedDatabase("restore", "restore-target");
  const collisionPath = createEmptyIsolatedDatabase("restore", "restore-collision");
  const backupPath = assertIsolatedDatabasePath(path.join(QA_ROOT, "restore", `DEVOPS1B-v44-${process.pid}.backup.json`));
  let success = false;
  try {
    for (const databasePath of [sourcePath, targetPath, collisionPath]) {
      runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databasePath);
    }
    runPnpm(["db:seed"], sourcePath, {
      ...SYNTHETIC_ENV,
      ALLOW_DEMO_USERS: "true",
      DEMO_USER_DATABASE_ROOT: path.dirname(sourcePath),
      ALLOW_DEMO_BUSINESS_DATA: "true",
      DEMO_BUSINESS_DATA_ROOT: path.dirname(sourcePath)
    });
    const source = prismaFor(sourcePath);
    const generated = await generateFullBackup(source, {
      generatedAt: new Date("2026-07-22T00:00:00.000Z"),
      generatedBy: "DEVOPS1B synthetic rehearsal"
    });
    await source.$disconnect();
    const serialized = serializeBackup(generated);
    writeFileSync(backupPath, serialized, "utf8");
    const validated = parseAndValidateBackup(JSON.parse(serialized));
    if (validated.metadata.backupVersion !== 44) throw new Error("BACKUP_VERSION_CHANGED");
    if (/passwordHash|DEVOPS1B-local-only-(?:Director|Admin|Accountant|Viewer|Restore)/.test(serialized)) {
      throw new Error("BACKUP_SECRET_OR_PASSWORD_HASH_DETECTED");
    }
    const arrayEntries = Object.entries(validated).filter(([, value]) => Array.isArray(value));
    const metadataCounts = validated.metadata.counts;
    if (!metadataCounts) throw new Error("BACKUP_METADATA_COUNTS_MISSING");
    for (const [key, value] of arrayEntries) {
      const recorded = metadataCounts[key as keyof typeof metadataCounts];
      if (recorded === undefined && LEGACY_COUNT_OMISSIONS.has(key)) continue;
      if (recorded !== (value as unknown[]).length) throw new Error(`BACKUP_ARRAY_COUNT_MISMATCH: ${key}`);
    }
    for (const key of LEGACY_COUNT_OMISSIONS) {
      if (!arrayEntries.some(([arrayKey]) => arrayKey === key)) throw new Error(`BACKUP_REQUIRED_ARRAY_MISSING: ${key}`);
    }
    const onboardingTotal = validated.onboardingBatches.length + validated.onboardingRowOutcomes.length + validated.onboardingAuditEvents.length;
    if (metadataCounts.onboardingRecords !== onboardingTotal) throw new Error("BACKUP_ONBOARDING_COUNT_MISMATCH");

    const target = prismaFor(targetPath);
    await createActor(target);
    const first = await restoreValidatedBackup(target, validated, actor);
    assertRestoreHasNoErrors(first as unknown as Record<string, unknown>);
    const firstCounts = {
      users: await target.user.count(), students: await target.student.count(), payments: await target.payment.count()
    };
    const firstBusiness = businessBaseline(targetPath);
    const second = await restoreValidatedBackup(target, validated, actor);
    assertRestoreHasNoErrors(second as unknown as Record<string, unknown>);
    const secondCounts = {
      users: await target.user.count(), students: await target.student.count(), payments: await target.payment.count()
    };
    const secondBusiness = businessBaseline(targetPath);
    await target.$disconnect();
    if (JSON.stringify(firstCounts) !== JSON.stringify(secondCounts) || JSON.stringify(firstBusiness) !== JSON.stringify(secondBusiness)) {
      throw new Error("REPEATED_RESTORE_NOT_IDEMPOTENT");
    }
    if (firstCounts.users !== 1) throw new Error("RESTORE_IMPORTED_LOGIN_USERS");

    const collision = prismaFor(collisionPath);
    await createActor(collision);
    const firstStudent = validated.students[0];
    if (!firstStudent) throw new Error("SYNTHETIC_BACKUP_STUDENT_MISSING");
    await collision.student.create({
      data: {
        id: "devops1b-local-student-owner",
        admissionNo: String(firstStudent.admissionNo),
        studentName: "DEVOPS1B Local Owner",
        fatherName: "DEVOPS1B Local Guardian",
        className: "I",
        phone1: "0000000000"
      }
    });
    const collisionResult = await restoreValidatedBackup(collision, validated, actor);
    assertRestoreHasNoErrors(collisionResult as unknown as Record<string, unknown>);
    const preserved = await collision.student.findUnique({ where: { admissionNo: String(firstStudent.admissionNo) } });
    const linkedPayments = await collision.payment.findMany({ where: { admissionNo: String(firstStudent.admissionNo) }, select: { studentId: true } });
    const collisionUsers = await collision.user.count();
    await collision.$disconnect();
    if (preserved?.id !== "devops1b-local-student-owner" || linkedPayments.some((row) => row.studentId !== preserved.id)) {
      throw new Error("RESTORE_OWNERSHIP_COLLISION_MAPPING_FAILED");
    }
    if (collisionUsers !== 1) throw new Error("RESTORE_COLLISION_IMPORTED_LOGIN_USERS");

    success = true;
    console.log(`Backup/restore passed: version=44 arrays=${arrayEntries.length} students=${firstCounts.students} payments=${firstCounts.payments}`);
    console.log("Repeated restore remained count-idempotent; local login ownership and Student collision mapping were preserved.");
    return { version: 44, arrays: arrayEntries.length, firstCounts, firstBusiness };
  } finally {
    if (success) {
      for (const databasePath of [sourcePath, targetPath, collisionPath]) cleanupIsolatedDatabase(databasePath);
      if (existsSync(backupPath)) rmSync(backupPath, { force: true });
    }
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/migration-backup-restore-check.ts")) {
  runMigrationBackupRestoreCheck().catch((error) => {
    console.error(error instanceof Error ? error.message : "Backup/restore migration check failed");
    process.exitCode = 1;
  });
}
