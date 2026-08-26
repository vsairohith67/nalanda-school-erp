import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { generateFullBackup, serializeBackup } from "../../lib/backup";
import { resolveDatabaseProvider } from "../../lib/database-provider";
import { hashPassword } from "../../lib/password";
import { parseAndValidateBackup } from "../../lib/restore";
import { restoreValidatedBackup } from "../../lib/restore-database";
import { assertPrivateTransferCreateTarget, assertPrivateTransferReadTarget, assertSyntheticPostgresQa, assertSyntheticSqliteTransfer } from "./synthetic-qa";

const mode = process.argv[2];
const transferPath = path.resolve(process.env.POSTGRES_TRANSFER_FILE ?? "");
const workspace = path.resolve(".");
const relative = path.relative(path.join(workspace, "tmp"), transferPath);
if (!transferPath || relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
  throw new Error("POSTGRES_TRANSFER_FILE_MUST_BE_UNDER_TMP");
}

function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object" && "toJSON" in value && typeof (value as any).toJSON === "function") return (value as any).toJSON();
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  return value;
}

function checksum(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").toUpperCase();
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) throw new Error("POSTGRES_TRANSFER_MONEY_INVALID");
  return parsed;
}

function arrayRows(backup: Record<string, unknown>) {
  return Object.entries(backup).filter(([, value]) => Array.isArray(value)) as Array<[string, Record<string, unknown>[]]>;
}

function backupManifest(backup: Record<string, unknown>) {
  const arrays = arrayRows(backup);
  const students = (backup.students ?? []) as Record<string, unknown>[];
  const payments = (backup.payments ?? []) as Record<string, unknown>[];
  const admissionByStudentId = new Map(students.map((row) => [String(row.id), row.admissionNo]));
  const expenses = (backup.expenseRecords ?? []) as Record<string, unknown>[];
  const miscIncome = (backup.miscIncomeReceipts ?? []) as Record<string, unknown>[];
  const familyAllocations = (backup.familyStudentAllocations ?? []) as Record<string, unknown>[];
  return {
    backupVersion: (backup.metadata as any)?.backupVersion,
    arrays: Object.fromEntries(arrays.map(([key, rows]) => [key, { count: rows.length, checksum: checksum(rows) }])),
    totals: {
      payments: payments.reduce((sum, row) => sum + number(row.amountPaid), 0),
      expenses: expenses.reduce((sum, row) => sum + number(row.totalAmount ?? row.amount), 0),
      miscellaneousIncome: miscIncome.reduce((sum, row) => sum + number(row.totalAmount ?? row.amount), 0),
      familyAllocationPaise: familyAllocations.reduce((sum, row) => sum + number(row.amountPaise), 0)
    },
    core: {
      students: checksum(students.map((row) => ({ admissionNo: row.admissionNo, studentName: row.studentName })).sort((a, b) => String(a.admissionNo).localeCompare(String(b.admissionNo)))),
      payments: checksum(payments.map((row) => ({ receiptNo: row.receiptNo, amountPaid: number(row.amountPaid), paymentMode: row.paymentMode, admissionNo: admissionByStudentId.get(String(row.studentId)) ?? null })).sort((a, b) => `${a.receiptNo}:${a.paymentMode}`.localeCompare(`${b.receiptNo}:${b.paymentMode}`)))
    }
  };
}

function assertNoRestoreErrors(result: Record<string, unknown>) {
  const failures = Object.entries(result).flatMap(([key, value]) => {
    const errors = value && typeof value === "object" && !Array.isArray(value) ? (value as { errors?: unknown[] }).errors : undefined;
    return errors?.length ? [`${key}:${errors.length}`] : [];
  });
  if (failures.length) throw new Error(`POSTGRES_TRANSFER_RESTORE_ERRORS:${failures.join(",")}`);
}

function writePrivateNewFile(target: string, value: string) {
  assertPrivateTransferCreateTarget(target, workspace);
  writeFileSync(target, value, { encoding: "utf8", flag: "wx", mode: 0o600 });
}

async function exportBackup() {
  assertSyntheticSqliteTransfer(process.env, workspace);
  if (resolveDatabaseProvider() !== "sqlite") throw new Error("POSTGRES_TRANSFER_EXPORT_REQUIRES_SQLITE_CLIENT");
  assertPrivateTransferCreateTarget(transferPath, workspace);
  assertPrivateTransferCreateTarget(`${transferPath}.manifest.json`, workspace);
  const prisma = new PrismaClient();
  try {
    const backup = await generateFullBackup(prisma, { generatedAt: new Date("2026-08-26T00:00:00.000Z"), generatedBy: "POSTGRES-READINESS-1A synthetic transfer" });
    const serialized = serializeBackup(backup);
    if (/passwordHash|postgresql:\/\/|DATABASE_URL|DIRECT_URL/.test(serialized)) throw new Error("POSTGRES_TRANSFER_SECRET_PATTERN_DETECTED");
    writePrivateNewFile(transferPath, serialized);
    const manifest = backupManifest(parseAndValidateBackup(JSON.parse(serialized)) as unknown as Record<string, unknown>);
    writePrivateNewFile(`${transferPath}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({ result: "POSTGRES_TRANSFER_EXPORTED", backupVersion: manifest.backupVersion, arrays: Object.keys(manifest.arrays).length, students: (manifest.arrays as any).students?.count ?? 0, payments: (manifest.arrays as any).payments?.count ?? 0, paymentTotal: manifest.totals.payments }));
  } finally {
    await prisma.$disconnect();
  }
}

async function restoreBackup() {
  assertSyntheticPostgresQa();
  if (resolveDatabaseProvider() !== "postgresql") throw new Error("POSTGRES_TRANSFER_RESTORE_REQUIRES_POSTGRESQL_CLIENT");
  assertPrivateTransferReadTarget(transferPath, workspace);
  assertPrivateTransferReadTarget(`${transferPath}.manifest.json`, workspace);
  assertPrivateTransferCreateTarget(`${transferPath}.restore.json`, workspace);
  const backup = parseAndValidateBackup(JSON.parse(readFileSync(transferPath, "utf8")));
  const expected = JSON.parse(readFileSync(`${transferPath}.manifest.json`, "utf8"));
  const prisma = new PrismaClient();
  const actor = { id: "postgres-readiness-restore-actor", name: "PostgreSQL Readiness Restore Actor" };
  try {
    const disabledPasswordHash = await hashPassword(randomBytes(48).toString("base64url"));
    await prisma.user.upsert({
      where: { id: actor.id },
      create: { id: actor.id, name: actor.name, username: "postgres-readiness-restore-actor", email: "postgres-readiness-restore@invalid.local", role: "DIRECTOR", isActive: false, mustChangePassword: true, passwordHash: disabledPasswordHash },
      update: { isActive: false, mustChangePassword: true, passwordHash: disabledPasswordHash }
    });
    const first = await restoreValidatedBackup(prisma, backup, actor);
    assertNoRestoreErrors(first as unknown as Record<string, unknown>);
    const firstState = await restoredState(prisma);
    const second = await restoreValidatedBackup(prisma, backup, actor);
    assertNoRestoreErrors(second as unknown as Record<string, unknown>);
    const secondState = await restoredState(prisma);
    if (JSON.stringify(firstState) !== JSON.stringify(secondState)) throw new Error("POSTGRES_TRANSFER_SECOND_RESTORE_CHANGED_STATE");
    if (firstState.students.checksum !== expected.core.students || firstState.payments.checksum !== expected.core.payments) {
      throw new Error(`POSTGRES_TRANSFER_CORE_CHECKSUM_MISMATCH:students=${firstState.students.checksum === expected.core.students}:payments=${firstState.payments.checksum === expected.core.payments}`);
    }
    if (firstState.payments.total !== expected.totals.payments) throw new Error("POSTGRES_TRANSFER_FINANCIAL_TOTAL_MISMATCH");
    const evidence = { result: "POSTGRES_TRANSFER_RESTORED_TWICE", backupVersion: expected.backupVersion, firstState, secondRestoreNoChange: true, loginUsersImported: firstState.users - 1, errors: 0 };
    writePrivateNewFile(`${transferPath}.restore.json`, `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(JSON.stringify(evidence));
  } finally {
    await prisma.$disconnect();
  }
}

async function restoredState(prisma: PrismaClient) {
  const [students, payments, users] = await Promise.all([
    prisma.student.findMany({ select: { admissionNo: true, studentName: true }, orderBy: { admissionNo: "asc" } }),
    prisma.payment.findMany({ select: { receiptNo: true, amountPaid: true, paymentMode: true, student: { select: { admissionNo: true } } } }),
    prisma.user.count()
  ]);
  return {
    users,
    students: { count: students.length, checksum: checksum(students) },
    payments: {
      count: payments.length,
      checksum: checksum(payments.map((row) => ({ receiptNo: row.receiptNo, amountPaid: number(row.amountPaid), paymentMode: row.paymentMode, admissionNo: row.student?.admissionNo ?? null })).sort((a, b) => `${a.receiptNo}:${a.paymentMode}`.localeCompare(`${b.receiptNo}:${b.paymentMode}`))),
      total: payments.reduce((sum, row) => sum + number(row.amountPaid), 0)
    }
  };
}

async function main() {
  if (mode === "export") await exportBackup();
  else if (mode === "restore") await restoreBackup();
  else throw new Error("POSTGRES_TRANSFER_MODE_INVALID");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
