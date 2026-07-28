import { createHash } from "node:crypto";
import {
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
import { decryptCloudBackup } from "../lib/cloud-backup-container";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  WORKSPACE_ROOT,
  assertIsolatedDatabasePath,
  businessBaseline,
  cleanupIsolatedDatabase,
  createEmptyIsolatedDatabase,
  databaseUrl
} from "./migration-check-utils";

const COPY_PATH = assertIsolatedDatabasePath(path.join(QA_ROOT, "operational-copy", "DATA0A-rehearsal.db"));
const STATE_PATH = path.join(QA_ROOT, "operational-copy", "DATA0A-state.json");
const CLEAN_BACKUP_ROOT = path.join(WORKSPACE_ROOT, ".data0a", "backups");
const SAMPLE_ADMISSIONS = Array.from({ length: 8 }, (_, index) => `NPS2600${index + 1}`);
const EXPECTED_HASH = "1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392";
const CONFIRMATION = "VERIFIED_SAMPLE_DATA_SAFE_FOR_CONTROLLED_DELETION";
const APPROVAL = "USER_APPROVED_DATA0A_OPERATIONAL_CLEANUP";
const EXPECTED_CHANGED_TABLES = new Set([
  "AcademicYearEnrollment",
  "Payment",
  "PaymentAudit",
  "ReceiptNote",
  "Student",
  "StudentLifecycleEvent"
]);
const RETAINED_CONFIGURATION_TABLES = [
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
  "TimetablePeriodTemplate",
  "User",
  "UserAudit"
] as const;

type State = {
  databasePath: string;
  operationalHash: string;
  operationalSize: number;
  operationalLastWriteUtc: string;
  preparedHash: string;
  retainedConfiguration: Record<string, number>;
  cleanBackupPath?: string;
  restoreTargetPath?: string;
};

function quote(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(",");
}

function fileHash(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex").toUpperCase();
}

function one(db: DatabaseSync, sql: string, ...values: any[]) {
  return Number((db.prepare(sql).get(...values) as { value?: number } | undefined)?.value ?? 0);
}

function tableNames(db: DatabaseSync) {
  return (db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all() as Array<{ name: string }>).map((row) => row.name);
}

function tableCounts(db: DatabaseSync) {
  return Object.fromEntries(tableNames(db).map((table) => [
    table,
    one(db, `SELECT COUNT(*) AS value FROM ${quote(table)}`)
  ]));
}

function retainedConfiguration(db: DatabaseSync) {
  const names = new Set(tableNames(db));
  return Object.fromEntries(RETAINED_CONFIGURATION_TABLES
    .filter((table) => names.has(table))
    .map((table) => [table, one(db, `SELECT COUNT(*) AS value FROM ${quote(table)}`)]));
}

function eligibility(db: DatabaseSync) {
  const admissionList = placeholders(SAMPLE_ADMISSIONS);
  const payments = db.prepare(
    `SELECT id, receiptNo, admissionNo, amountPaid, paymentMode, remarks, enteredBy, createdAt
       FROM Payment ORDER BY id`
  ).all() as Array<Record<string, unknown>>;
  const samplePayments = payments.filter((row) => SAMPLE_ADMISSIONS.includes(String(row.admissionNo)));
  const seedRows = samplePayments.filter((row) =>
    row.enteredBy === "Seed"
    && row.id === `${row.receiptNo}-${row.admissionNo}-${row.paymentMode}`
  );
  const qaRows = samplePayments.filter((row) =>
    row.enteredBy !== "Seed"
    && /qa|test|demo|sample/i.test(`${row.receiptNo ?? ""} ${row.remarks ?? ""}`)
  );
  const paymentIds = samplePayments.map((row) => String(row.id));
  const receiptNos = [...new Set([...samplePayments.map((row) => String(row.receiptNo)), "12511"])];
  const expectedDependencyCounts = {
    AcademicYearEnrollment: one(
      db,
      `SELECT COUNT(*) AS value FROM AcademicYearEnrollment WHERE studentId IN (
         SELECT id FROM Student WHERE admissionNo IN (${admissionList})
       )`,
      ...SAMPLE_ADMISSIONS
    ),
    Payment: samplePayments.length,
    PaymentAudit: paymentIds.length
      ? one(db, `SELECT COUNT(*) AS value FROM PaymentAudit WHERE paymentId IN (${placeholders(paymentIds)})`, ...paymentIds)
      : 0,
    ReceiptNote: one(db, `SELECT COUNT(*) AS value FROM ReceiptNote WHERE receiptNo IN (${placeholders(receiptNos)})`, ...receiptNos),
    Student: one(db, `SELECT COUNT(*) AS value FROM Student WHERE admissionNo IN (${admissionList})`, ...SAMPLE_ADMISSIONS),
    StudentLifecycleEvent: one(
      db,
      `SELECT COUNT(*) AS value FROM StudentLifecycleEvent WHERE studentId IN (
         SELECT id FROM Student WHERE admissionNo IN (${admissionList})
       )`,
      ...SAMPLE_ADMISSIONS
    )
  };
  const studentRows = db.prepare(
    `SELECT admissionNo, phone1, phone2, whatsappNumber, remarks FROM Student
     WHERE admissionNo IN (${admissionList})`
  ).all(...SAMPLE_ADMISSIONS) as Array<Record<string, unknown>>;
  const otherDependencies: Record<string, number> = {};
  for (const table of tableNames(db)) {
    if (EXPECTED_CHANGED_TABLES.has(table)) continue;
    const columns = db.prepare(`PRAGMA table_info(${quote(table)})`).all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (names.has("studentId")) {
      clauses.push(`studentId IN (SELECT id FROM Student WHERE admissionNo IN (${admissionList}))`);
      args.push(...SAMPLE_ADMISSIONS);
    }
    if (names.has("admissionNo")) {
      clauses.push(`admissionNo IN (${admissionList})`);
      args.push(...SAMPLE_ADMISSIONS);
    }
    if (names.has("paymentId") && paymentIds.length) {
      clauses.push(`paymentId IN (${placeholders(paymentIds)})`);
      args.push(...paymentIds);
    }
    if (names.has("receiptNo") && receiptNos.length) {
      clauses.push(`receiptNo IN (${placeholders(receiptNos)})`);
      args.push(...receiptNos);
    }
    if (!clauses.length) continue;
    const count = one(db, `SELECT COUNT(*) AS value FROM ${quote(table)} WHERE ${clauses.join(" OR ")}`, ...args);
    if (count) otherDependencies[table] = count;
  }
  return {
    business: {
      students: one(db, "SELECT COUNT(*) AS value FROM Student WHERE deletedAt IS NULL"),
      activeEnrollments: one(db, "SELECT COUNT(*) AS value FROM AcademicYearEnrollment WHERE status='ACTIVE'"),
      payments: one(db, "SELECT COUNT(*) AS value FROM Payment WHERE deletedAt IS NULL"),
      collected: one(db, "SELECT COALESCE(SUM(amountPaid),0) AS value FROM Payment WHERE deletedAt IS NULL AND isCancelled=0"),
      guardians: one(db, "SELECT COUNT(*) AS value FROM Guardian"),
      staff: one(db, "SELECT COUNT(*) AS value FROM StaffMember")
    },
    studentRows: studentRows.length,
    placeholderStudentContacts: studentRows.filter((row) =>
      /^9000000\d{3}$/.test(String(row.phone1 ?? ""))
      && (!row.phone2 || /^9000000\d{3}$/.test(String(row.phone2)))
      && (!row.whatsappNumber || /^9000000\d{3}$/.test(String(row.whatsappNumber)))
    ).length,
    studentSampleMarkers: studentRows.filter((row) =>
      /sample|split payment|full annual fee|multiple small payments/i.test(String(row.remarks ?? ""))
    ).length,
    seedPaymentRows: seedRows.length,
    seedPaymentAmount: seedRows.reduce((sum, row) => sum + Number(row.amountPaid), 0),
    qaPaymentRows: qaRows.length,
    qaPaymentAmount: qaRows.reduce((sum, row) => sum + Number(row.amountPaid), 0),
    expectedDependencyCounts,
    otherDependencies,
    receiptNos,
    paymentIds
  };
}

function assertEligibleForCleanup(evidence: ReturnType<typeof eligibility>) {
  const business = evidence.business;
  if (
    business.students !== 8
    || business.activeEnrollments !== 8
    || business.payments !== 19
    || business.collected !== 99100
    || business.guardians !== 0
    || business.staff !== 0
    || evidence.studentRows !== 8
    || evidence.placeholderStudentContacts !== 8
    || evidence.studentSampleMarkers < 7
    || evidence.seedPaymentRows !== 11
    || evidence.seedPaymentAmount !== 92100
    || evidence.qaPaymentRows !== 8
    || evidence.qaPaymentAmount !== 7000
    || Object.keys(evidence.otherDependencies).length !== 0
  ) {
    throw new Error("DATA0A_SAMPLE_ELIGIBILITY_MISMATCH");
  }
  const expected = evidence.expectedDependencyCounts;
  if (
    expected.AcademicYearEnrollment !== 8
    || expected.Payment !== 19
    || expected.PaymentAudit !== 19
    || expected.ReceiptNote !== 1
    || expected.Student !== 8
    || expected.StudentLifecycleEvent !== 8
  ) {
    throw new Error("DATA0A_DEPENDENCY_COUNTS_CHANGED");
  }
}

function emptyBusiness(db: DatabaseSync) {
  return {
    students: one(db, "SELECT COUNT(*) AS value FROM Student WHERE deletedAt IS NULL"),
    activeEnrollments: one(db, "SELECT COUNT(*) AS value FROM AcademicYearEnrollment WHERE status='ACTIVE'"),
    payments: one(db, "SELECT COUNT(*) AS value FROM Payment WHERE deletedAt IS NULL"),
    collected: one(db, "SELECT COALESCE(SUM(amountPaid),0) AS value FROM Payment WHERE deletedAt IS NULL AND isCancelled=0"),
    guardians: one(db, "SELECT COUNT(*) AS value FROM Guardian"),
    staff: one(db, "SELECT COUNT(*) AS value FROM StaffMember")
  };
}

function assertCleanBaseline(db: DatabaseSync) {
  const baseline = emptyBusiness(db);
  if (Object.values(baseline).some((count) => count !== 0)) {
    throw new Error("DATA0A_CLEAN_BASELINE_NOT_EMPTY");
  }
  const residue = {
    enrollments: one(db, "SELECT COUNT(*) AS value FROM AcademicYearEnrollment"),
    audits: one(db, "SELECT COUNT(*) AS value FROM PaymentAudit"),
    receiptNotes: one(db, "SELECT COUNT(*) AS value FROM ReceiptNote"),
    lifecycleEvents: one(db, "SELECT COUNT(*) AS value FROM StudentLifecycleEvent")
  };
  if (Object.values(residue).some((count) => count !== 0)) throw new Error("DATA0A_DEPENDENCY_RESIDUE");
  const foreignKeyViolations = db.prepare("PRAGMA foreign_key_check").all().length;
  if (foreignKeyViolations) throw new Error("DATA0A_FOREIGN_KEY_VIOLATIONS");
  return { baseline, residue, foreignKeyViolations };
}

function assertRetainedConfiguration(db: DatabaseSync, expected: Record<string, number>) {
  const actual = retainedConfiguration(db);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("DATA0A_RETAINED_CONFIGURATION_CHANGED");
  }
  return actual;
}

function cleanupDatabase(databasePath: string, expectedConfiguration: Record<string, number>) {
  const db = new DatabaseSync(databasePath);
  try {
    db.exec("PRAGMA foreign_keys=ON");
    const beforeCounts = tableCounts(db);
    const beforeBusiness = emptyBusiness(db);
    if (Object.values(beforeBusiness).every((count) => count === 0)) {
      const clean = assertCleanBaseline(db);
      const configuration = assertRetainedConfiguration(db, expectedConfiguration);
      return { status: "DATA0A_CLEANUP_ALREADY_EMPTY", deleted: {}, ...clean, retainedConfiguration: configuration };
    }
    const evidence = eligibility(db);
    assertEligibleForCleanup(evidence);
    db.exec("BEGIN IMMEDIATE");
    try {
      const paymentIds = evidence.paymentIds;
      const receiptNos = evidence.receiptNos;
      const deleted = {
        paymentAudits: db.prepare(`DELETE FROM PaymentAudit WHERE paymentId IN (${placeholders(paymentIds)})`).run(...paymentIds).changes,
        receiptNotes: db.prepare(`DELETE FROM ReceiptNote WHERE receiptNo IN (${placeholders(receiptNos)})`).run(...receiptNos).changes,
        payments: db.prepare(`DELETE FROM Payment WHERE id IN (${placeholders(paymentIds)})`).run(...paymentIds).changes,
        lifecycleEvents: db.prepare(
          `DELETE FROM StudentLifecycleEvent WHERE studentId IN (
             SELECT id FROM Student WHERE admissionNo IN (${placeholders(SAMPLE_ADMISSIONS)})
           )`
        ).run(...SAMPLE_ADMISSIONS).changes,
        enrollments: db.prepare(
          `DELETE FROM AcademicYearEnrollment WHERE studentId IN (
             SELECT id FROM Student WHERE admissionNo IN (${placeholders(SAMPLE_ADMISSIONS)})
           )`
        ).run(...SAMPLE_ADMISSIONS).changes,
        students: db.prepare(
          `DELETE FROM Student WHERE admissionNo IN (${placeholders(SAMPLE_ADMISSIONS)})`
        ).run(...SAMPLE_ADMISSIONS).changes
      };
      const clean = assertCleanBaseline(db);
      const configuration = assertRetainedConfiguration(db, expectedConfiguration);
      const afterCounts = tableCounts(db);
      const changedTables = Object.keys(beforeCounts).filter((table) => beforeCounts[table] !== afterCounts[table]);
      if (changedTables.some((table) => !EXPECTED_CHANGED_TABLES.has(table))) {
        throw new Error(`DATA0A_UNEXPECTED_TABLE_CHANGED:${changedTables.join(",")}`);
      }
      db.exec("COMMIT");
      return {
        status: "DATA0A_COPIED_DATABASE_CLEANED",
        deleted,
        changedTables,
        ...clean,
        retainedConfiguration: configuration
      };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

function readState(): State {
  if (!existsSync(STATE_PATH)) throw new Error("DATA0A_STATE_NOT_FOUND");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as State;
  state.databasePath = assertIsolatedDatabasePath(state.databasePath);
  if (path.resolve(state.databasePath).toLowerCase() !== path.resolve(COPY_PATH).toLowerCase()) {
    throw new Error("DATA0A_STATE_DATABASE_MISMATCH");
  }
  return state;
}

function assertOperationalIdentity(state: Pick<State, "operationalHash" | "operationalSize" | "operationalLastWriteUtc">) {
  const stat = statSync(OPERATIONAL_DATABASE);
  if (
    fileHash(OPERATIONAL_DATABASE) !== state.operationalHash
    || stat.size !== state.operationalSize
    || stat.mtime.toISOString() !== state.operationalLastWriteUtc
  ) {
    throw new Error("DATA0A_OPERATIONAL_DATABASE_CHANGED");
  }
}

function prepare() {
  if (existsSync(COPY_PATH) || existsSync(STATE_PATH)) throw new Error("DATA0A_PREPARE_REFUSED_EXISTING_STATE");
  const operationalStat = statSync(OPERATIONAL_DATABASE);
  const operationalHash = fileHash(OPERATIONAL_DATABASE);
  if (operationalHash !== EXPECTED_HASH) throw new Error("DATA0A_OPERATIONAL_HASH_UNEXPECTED");
  mkdirSync(path.dirname(COPY_PATH), { recursive: true });
  copyFileSync(OPERATIONAL_DATABASE, COPY_PATH);
  const preparedHash = fileHash(COPY_PATH);
  if (preparedHash !== operationalHash || statSync(COPY_PATH).size !== operationalStat.size) {
    throw new Error("DATA0A_COPY_NOT_BYTE_IDENTICAL");
  }
  const db = new DatabaseSync(COPY_PATH, { readOnly: true });
  let configuration: Record<string, number>;
  try {
    db.exec("PRAGMA query_only=ON");
    assertEligibleForCleanup(eligibility(db));
    configuration = retainedConfiguration(db);
  } finally {
    db.close();
  }
  const state: State = {
    databasePath: COPY_PATH,
    operationalHash,
    operationalSize: operationalStat.size,
    operationalLastWriteUtc: operationalStat.mtime.toISOString(),
    preparedHash,
    retainedConfiguration: configuration
  };
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), { encoding: "utf8", flag: "wx" });
  console.log(JSON.stringify({
    status: "DATA0A_BYTE_IDENTICAL_COPY_PREPARED",
    databasePath: COPY_PATH,
    sourceHash: operationalHash,
    copyHash: preparedHash,
    size: operationalStat.size,
    retainedConfiguration: configuration
  }, null, 2));
}

function cleanupCopy() {
  const state = readState();
  assertOperationalIdentity(state);
  if (fileHash(COPY_PATH) !== state.preparedHash) {
    const db = new DatabaseSync(COPY_PATH, { readOnly: true });
    try {
      if (!Object.values(emptyBusiness(db)).every((count) => count === 0)) {
        throw new Error("DATA0A_COPY_CHANGED_BEFORE_CLEANUP");
      }
    } finally {
      db.close();
    }
  }
  const result = cleanupDatabase(COPY_PATH, state.retainedConfiguration);
  assertOperationalIdentity(state);
  console.log(JSON.stringify({ ...result, operationalHashUnchanged: state.operationalHash }, null, 2));
}

function inspect() {
  const state = readState();
  assertOperationalIdentity(state);
  const db = new DatabaseSync(COPY_PATH, { readOnly: true });
  try {
    db.exec("PRAGMA query_only=ON");
    const baseline = emptyBusiness(db);
    const clean = Object.values(baseline).every((count) => count === 0) ? assertCleanBaseline(db) : null;
    console.log(JSON.stringify({
      status: clean ? "DATA0A_COPY_CLEAN" : "DATA0A_COPY_NOT_CLEAN",
      baseline,
      clean,
      retainedConfiguration: assertRetainedConfiguration(db, state.retainedConfiguration),
      operationalHashUnchanged: state.operationalHash
    }, null, 2));
  } finally {
    db.close();
  }
}

function prismaFor(databasePath: string) {
  return new PrismaClient({ datasourceUrl: databaseUrl(databasePath) });
}

function assertRestoreHasNoErrors(result: Record<string, unknown>) {
  const errors = Object.entries(result).flatMap(([entity, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const rows = (value as { errors?: unknown[] }).errors;
    return rows?.length ? [`${entity}:${rows.length}`] : [];
  });
  if (errors.length) throw new Error(`DATA0A_RESTORE_ERRORS:${errors.join(",")}`);
}

async function backupRestore() {
  const state = readState();
  assertOperationalIdentity(state);
  const sourceDb = new DatabaseSync(COPY_PATH, { readOnly: true });
  try {
    assertCleanBaseline(sourceDb);
    assertRetainedConfiguration(sourceDb, state.retainedConfiguration);
  } finally {
    sourceDb.close();
  }
  const targetPath = createEmptyIsolatedDatabase("restore", "data0a-clean-restore");
  copyFileSync(COPY_PATH, targetPath);
  mkdirSync(CLEAN_BACKUP_ROOT, { recursive: true });
  const generatedAt = new Date();
  const backupPath = path.join(
    CLEAN_BACKUP_ROOT,
    `DATA0A-clean-copy-v37-${generatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}.json`
  );
  const source = prismaFor(COPY_PATH);
  const generated = await generateFullBackup(source, {
    generatedAt,
    generatedBy: "DATA-0A copied-database cleanup rehearsal"
  });
  await source.$disconnect();
  const serialized = serializeBackup(generated);
  writeFileSync(backupPath, serialized, { encoding: "utf8", flag: "wx" });
  const validated = parseAndValidateBackup(JSON.parse(serialized));
  const target = prismaFor(targetPath);
  const actor = await target.user.findFirst({
    where: { role: { in: ["DIRECTOR", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true, name: true }
  });
  if (!actor) throw new Error("DATA0A_RESTORE_ACTOR_MISSING");
  const first = await restoreValidatedBackup(target, validated, actor);
  assertRestoreHasNoErrors(first as unknown as Record<string, unknown>);
  const firstBusiness = businessBaseline(targetPath);
  const firstDb = new DatabaseSync(targetPath, { readOnly: true });
  let firstCounts: Record<string, number>;
  try {
    firstCounts = retainedConfiguration(firstDb);
  } finally {
    firstDb.close();
  }
  const second = await restoreValidatedBackup(target, validated, actor);
  assertRestoreHasNoErrors(second as unknown as Record<string, unknown>);
  const secondBusiness = businessBaseline(targetPath);
  const secondDb = new DatabaseSync(targetPath, { readOnly: true });
  let secondCounts: Record<string, number>;
  let foreignKeyViolations: number;
  try {
    secondCounts = retainedConfiguration(secondDb);
    foreignKeyViolations = secondDb.prepare("PRAGMA foreign_key_check").all().length;
  } finally {
    secondDb.close();
  }
  await target.$disconnect();
  if (
    validated.metadata.backupVersion !== 37
    || Object.values(firstBusiness).some((count) => count !== 0)
    || JSON.stringify(firstBusiness) !== JSON.stringify(secondBusiness)
    || JSON.stringify(firstCounts) !== JSON.stringify(state.retainedConfiguration)
    || JSON.stringify(firstCounts) !== JSON.stringify(secondCounts)
    || foreignKeyViolations !== 0
  ) {
    throw new Error("DATA0A_BACKUP_RESTORE_NOT_IDEMPOTENT");
  }
  const updated: State = { ...state, cleanBackupPath: backupPath, restoreTargetPath: targetPath };
  writeFileSync(STATE_PATH, JSON.stringify(updated, null, 2), "utf8");
  assertOperationalIdentity(state);
  console.log(JSON.stringify({
    status: "DATA0A_CLEAN_BACKUP_RESTORED_TWICE",
    backupPath,
    backupVersion: validated.metadata.backupVersion,
    backupSha256: fileHash(backupPath),
    firstBusiness,
    secondBusiness,
    retainedConfiguration: secondCounts,
    foreignKeyViolations,
    operationalHashUnchanged: state.operationalHash
  }, null, 2));
}

function validateEncryptedRollback(artifactPath: string, keyPath: string) {
  const key = Buffer.from(readFileSync(keyPath, "utf8").trim(), "base64");
  return decryptCloudBackup(readFileSync(artifactPath), { key }).then(({ plaintext }) => {
    if (createHash("sha256").update(plaintext).digest("hex").toUpperCase() !== EXPECTED_HASH) {
      throw new Error("DATA0A_ROLLBACK_DATABASE_HASH_MISMATCH");
    }
    return 37;
  });
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function applyOperational() {
  const expectedHash = option("--expected-sha256");
  const confirmation = option("--confirm");
  const approval = option("--approval");
  const artifact = option("--backup-artifact");
  const key = option("--backup-key");
  if (
    confirmation !== CONFIRMATION
    || approval !== APPROVAL
    || expectedHash !== EXPECTED_HASH
    || !artifact
    || !key
  ) {
    throw new Error("DATA0A_OPERATIONAL_APPROVAL_GATE_NOT_SATISFIED");
  }
  if (fileHash(OPERATIONAL_DATABASE) !== expectedHash) throw new Error("DATA0A_OPERATIONAL_HASH_CHANGED");
  await validateEncryptedRollback(path.resolve(artifact), path.resolve(key));
  const db = new DatabaseSync(OPERATIONAL_DATABASE, { readOnly: true });
  let configuration: Record<string, number>;
  try {
    assertEligibleForCleanup(eligibility(db));
    configuration = retainedConfiguration(db);
  } finally {
    db.close();
  }
  const result = cleanupDatabase(OPERATIONAL_DATABASE, configuration);
  console.log(JSON.stringify({ ...result, status: "DATA0A_OPERATIONAL_CLEANUP_APPLIED_WITH_APPROVAL" }, null, 2));
}

function destroy() {
  const state = readState();
  assertOperationalIdentity(state);
  const db = new DatabaseSync(COPY_PATH, { readOnly: true });
  try {
    assertCleanBaseline(db);
  } finally {
    db.close();
  }
  cleanupIsolatedDatabase(COPY_PATH);
  if (state.restoreTargetPath && existsSync(state.restoreTargetPath)) cleanupIsolatedDatabase(state.restoreTargetPath);
  rmSync(STATE_PATH, { force: true });
  console.log(JSON.stringify({
    status: "DATA0A_ISOLATED_DATABASES_REMOVED",
    cleanBackupPreserved: state.cleanBackupPath ?? null,
    operationalHashUnchanged: state.operationalHash
  }, null, 2));
}

async function main() {
  const command = process.argv[2];
  if (command === "prepare") return prepare();
  if (command === "cleanup-copy") return cleanupCopy();
  if (command === "inspect") return inspect();
  if (command === "backup-restore") return backupRestore();
  if (command === "apply-operational") return applyOperational();
  if (command === "destroy") return destroy();
  throw new Error("Use prepare, cleanup-copy, inspect, backup-restore, apply-operational, or destroy.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "DATA0A_CLEANUP_WORKFLOW_FAILED");
  process.exitCode = 1;
});
