import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import { hashPassword } from "../lib/password";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import {
  OPERATIONAL_DATABASE,
  WORKSPACE_ROOT,
  businessBaseline,
  cleanupIsolatedDatabase,
  createEmptyIsolatedDatabase,
  databaseUrl,
  runPrisma
} from "./migration-check-utils";

const APPROVED_HASH = "1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392";
const CONFIGURATION_TABLES = [
  "AiAssistantEvaluationCase",
  "AiAssistantProfile",
  "AiAssistantSourcePolicy",
  "ExpenseCategory",
  "ExpenseDepartment",
  "FeeRegisterOcrProfile",
  "FeeStructure",
  "MiscIncomeItem",
  "RolePermission",
  "SchoolSettings",
  "SmsEmailIntegrationProfile",
  "TimetableClassSection",
  "TimetablePeriodTemplate"
] as const;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function fileSha256(filePath: string) {
  return sha256(readFileSync(filePath));
}

function timestamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function quote(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function configurationCounts(databasePath: string) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return Object.fromEntries(CONFIGURATION_TABLES.map((table) => [
      table,
      Number((db.prepare(`SELECT COUNT(*) AS value FROM ${quote(table)}`).get() as { value: number }).value)
    ]));
  } finally {
    db.close();
  }
}

function sensitiveObjectKeys(value: unknown, location = "$"): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => sensitiveObjectKeys(entry, `${location}[${index}]`));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => {
    const current = `${location}.${key}`;
    const own = /^(?:password|passwordHash|secret|credential|apiKey|accessToken|refreshToken)$/i.test(key)
      ? [current]
      : [];
    return [...own, ...sensitiveObjectKeys(entry, current)];
  });
}

function assertRestoreHasNoErrors(result: Record<string, unknown>) {
  const failures = Object.entries(result).flatMap(([key, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const errors = (value as { errors?: unknown[] }).errors;
    return errors?.length ? [`${key}:${errors.length}`] : [];
  });
  if (failures.length) throw new Error(`DATA0B_PRECLEAN_RESTORE_ERRORS:${failures.join(",")}`);
}

async function main() {
  const postClean = process.argv.includes("--post-clean");
  const beforeStat = statSync(OPERATIONAL_DATABASE);
  const beforeHash = fileSha256(OPERATIONAL_DATABASE);
  if (!postClean && beforeHash !== APPROVED_HASH) throw new Error("DATA0B_APPROVED_OPERATIONAL_HASH_CHANGED");

  const generatedAt = new Date();
  const phase = postClean ? "POSTCLEAN" : "PRECLEAN";
  const eventId = `DATA0B-${phase}-${timestamp(generatedAt)}`;
  const root = path.join(WORKSPACE_ROOT, ".data0a", "data0b", postClean ? "post-clean" : "pre-clean", eventId);
  if (existsSync(root)) throw new Error("DATA0B_PRECLEAN_BACKUP_COLLISION");
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const logicalPath = path.join(root, `${eventId}-v37.json`);
  const rollbackPath = path.join(root, `${eventId}-rollback.db`);
  const restorePath = createEmptyIsolatedDatabase("restore", postClean ? "data0b-postclean" : "data0b-preclean");
  const sourceBaseline = businessBaseline(OPERATIONAL_DATABASE);
  const sourceConfiguration = configurationCounts(OPERATIONAL_DATABASE);
  const expectedBaseline = postClean
    ? { students: 0, activeEnrollments: 0, payments: 0, collected: 0 }
    : { students: 8, activeEnrollments: 8, payments: 19, collected: 99100 };
  if (Object.entries(expectedBaseline).some(([key, value]) =>
    sourceBaseline[key as keyof typeof expectedBaseline] !== value
  )) {
    throw new Error(`DATA0B_${phase}_SOURCE_BASELINE_MISMATCH`);
  }

  const source = new PrismaClient({
    datasourceUrl: `file:${OPERATIONAL_DATABASE.replaceAll("\\", "/")}`
  });
  try {
    const backup = await generateFullBackup(source, {
      generatedAt,
      generatedBy: postClean ? "DATA-0B first post-clean backup" : "DATA-0B approved pre-clean backup"
    });
    const serialized = serializeBackup(backup);
    const raw = JSON.parse(serialized) as unknown;
    const validated = parseAndValidateBackup(raw);
    if (validated.metadata.backupVersion !== 45) throw new Error("DATA0B_PRECLEAN_BACKUP_VERSION_CHANGED");
    const sensitiveKeys = sensitiveObjectKeys(raw);
    if (sensitiveKeys.length) throw new Error("DATA0B_PRECLEAN_BACKUP_SENSITIVE_KEYS_PRESENT");
    if (/Nalanda(?:Director|Admin|Accountant|Viewer)@2026/i.test(serialized)) {
      throw new Error("DATA0B_PRECLEAN_BACKUP_DEFAULT_PASSWORD_PRESENT");
    }

    writeFileSync(logicalPath, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
    copyFileSync(OPERATIONAL_DATABASE, rollbackPath);
    chmodSync(rollbackPath, 0o600);
    if (fileSha256(rollbackPath) !== beforeHash || statSync(rollbackPath).size !== beforeStat.size) {
      throw new Error("DATA0B_PRECLEAN_ROLLBACK_NOT_BYTE_IDENTICAL");
    }

    const rollbackDb = new DatabaseSync(rollbackPath, { readOnly: true });
    try {
      const integrity = String((rollbackDb.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check);
      const foreignKeys = rollbackDb.prepare("PRAGMA foreign_key_check").all().length;
      if (integrity !== "ok" || foreignKeys !== 0) throw new Error("DATA0B_PRECLEAN_ROLLBACK_SQLITE_INVALID");
    } finally {
      rollbackDb.close();
    }

    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], restorePath);
    const target = new PrismaClient({ datasourceUrl: databaseUrl(restorePath) });
    try {
      await target.user.create({
        data: {
          id: "data0b-preclean-restore-actor",
          name: "DATA-0B Restore Rehearsal",
          username: "data0b-preclean-restore",
          role: "SUPER_ADMIN",
          isActive: true,
          passwordHash: await hashPassword("DATA0B-disposable-restore-only-2026!")
        }
      });
      const actor = { id: "data0b-preclean-restore-actor", name: "DATA-0B Restore Rehearsal" };
      const first = await restoreValidatedBackup(target, validated, actor);
      assertRestoreHasNoErrors(first as unknown as Record<string, unknown>);
      const firstBaseline = businessBaseline(restorePath);
      const firstConfiguration = configurationCounts(restorePath);
      const second = await restoreValidatedBackup(target, validated, actor);
      assertRestoreHasNoErrors(second as unknown as Record<string, unknown>);
      const secondBaseline = businessBaseline(restorePath);
      const secondConfiguration = configurationCounts(restorePath);
      if (
        JSON.stringify(firstBaseline) !== JSON.stringify(secondBaseline)
        || JSON.stringify(firstConfiguration) !== JSON.stringify(secondConfiguration)
        || JSON.stringify(firstConfiguration) !== JSON.stringify(sourceConfiguration)
        || Object.entries(expectedBaseline).some(([key, value]) =>
          firstBaseline[key as keyof typeof expectedBaseline] !== value
        )
      ) {
        throw new Error(`DATA0B_${phase}_RESTORE_REHEARSAL_MISMATCH:${JSON.stringify({
          expectedBaseline,
          firstBaseline,
          secondBaseline,
          sourceConfiguration,
          firstConfiguration,
          secondConfiguration
        })}`);
      }
    } finally {
      await target.$disconnect();
    }

    const afterStat = statSync(OPERATIONAL_DATABASE);
    const afterHash = fileSha256(OPERATIONAL_DATABASE);
    if (
      afterHash !== beforeHash
      || afterStat.size !== beforeStat.size
      || afterStat.mtimeMs !== beforeStat.mtimeMs
    ) {
      throw new Error("DATA0B_OPERATIONAL_DATABASE_CHANGED_DURING_BACKUP");
    }

    console.log(JSON.stringify({
      status: `DATA0B_${phase}_BACKUP_AND_RESTORE_REHEARSAL_VERIFIED`,
      eventId,
      logicalBackup: {
        path: logicalPath,
        sha256: fileSha256(logicalPath),
        bytes: statSync(logicalPath).size,
        backupVersion: 45,
        sensitiveKeys: 0
      },
      rollbackCopy: {
        path: rollbackPath,
        sha256: fileSha256(rollbackPath),
        bytes: statSync(rollbackPath).size,
        byteIdentical: true,
        sqliteIntegrity: "ok",
        foreignKeyViolations: 0
      },
      restoreRehearsal: {
        repeatedRestores: 2,
        baseline: expectedBaseline,
        configurationRetained: true,
        disposableDatabaseRemoved: true
      },
      operationalDatabase: {
        sha256: afterHash,
        unchanged: true
      }
    }, null, 2));
  } catch (error) {
    if (existsSync(root)) rmSync(root, { recursive: true, force: true });
    throw error;
  } finally {
    await source.$disconnect();
    cleanupIsolatedDatabase(restorePath);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "DATA0B_PRECLEAN_BACKUP_FAILED");
  process.exitCode = 1;
});
