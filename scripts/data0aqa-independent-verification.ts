import { createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import { WORKSPACE_ROOT } from "./migration-isolation";
import {
  assertIsolatedDatabasePath,
  runPnpm,
  runPrisma
} from "./migration-check-utils";

const ROOT = path.join(WORKSPACE_ROOT, "tmp", "devops1b", "DATA0AQA");
const OPERATIONAL = path.join(WORKSPACE_ROOT, "prisma", "dev.db");
const REFERENCE = assertIsolatedDatabasePath(path.join(ROOT, "reference-seed.db"));
const COPY = assertIsolatedDatabasePath(path.join(ROOT, "operational-copy.db"));
const RESTORE = assertIsolatedDatabasePath(path.join(ROOT, "restore-copy.db"));
const BACKUP = path.join(ROOT, "clean-backup-v37.json");
const STATE = path.join(ROOT, "state.json");
const EXPECTED_OPERATIONAL_HASH =
  "1556B98FCAF0F2475C0C0F1BAEEFCE4E638680B9D4C7DC9BFFB8B6F0D09B4392";

const CLEANED_TABLES = new Set([
  "AcademicYearEnrollment",
  "Payment",
  "PaymentAudit",
  "ReceiptNote",
  "Student",
  "StudentLifecycleEvent"
]);

type State = {
  operationalHash: string;
  operationalSize: number;
  operationalLastWriteUtc: string;
  preparedCopyHash: string;
  retainedDigestBefore: string;
  cleanDigest?: string;
};

function quote(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function placeholders(values: unknown[]) {
  return values.map(() => "?").join(",");
}

function hashBytes(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function fileHash(filePath: string) {
  return hashBytes(readFileSync(filePath));
}

function databaseIdentity(filePath: string) {
  const stat = statSync(filePath);
  return {
    sha256: fileHash(filePath),
    size: stat.size,
    lastWriteUtc: stat.mtime.toISOString()
  };
}

function one(db: DatabaseSync, sql: string, ...values: any[]) {
  const row = db.prepare(sql).get(...values) as { value?: number | bigint } | undefined;
  return Number(row?.value ?? 0);
}

function tableNames(db: DatabaseSync) {
  return (db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all() as Array<{ name: string }>).map((row) => row.name);
}

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString("base64");
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalize(item)])
    );
  }
  return value;
}

function digestRows(rows: unknown[]) {
  return hashBytes(
    JSON.stringify(rows.map(normalize).map((row) => JSON.stringify(row)).sort())
  );
}

function withoutRestoreTimestamp(row: unknown) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return row;
  return Object.fromEntries(
    Object.entries(row as Record<string, unknown>).filter(([key]) => key !== "updatedAt")
  );
}

function retainedTableDigests(db: DatabaseSync) {
  return Object.fromEntries(tableNames(db)
    .filter((table) => !CLEANED_TABLES.has(table))
    .map((table) => ({
      table,
      digest: digestRows(
        db.prepare(`SELECT * FROM ${quote(table)}`).all().map(withoutRestoreTimestamp)
      )
    }))
    .map(({ table, digest }) => [table, digest]));
}

function retainedDigest(db: DatabaseSync) {
  return hashBytes(JSON.stringify(retainedTableDigests(db)));
}

function tableCounts(db: DatabaseSync) {
  return Object.fromEntries(
    tableNames(db).map((table) => [
      table,
      one(db, `SELECT COUNT(*) AS value FROM ${quote(table)}`)
    ])
  );
}

function businessBaseline(db: DatabaseSync) {
  return {
    students: one(db, "SELECT COUNT(*) AS value FROM Student WHERE deletedAt IS NULL"),
    activeEnrollments: one(
      db,
      "SELECT COUNT(*) AS value FROM AcademicYearEnrollment WHERE status='ACTIVE'"
    ),
    payments: one(db, "SELECT COUNT(*) AS value FROM Payment WHERE deletedAt IS NULL"),
    collected: one(
      db,
      "SELECT COALESCE(SUM(amountPaid),0) AS value FROM Payment WHERE deletedAt IS NULL AND isCancelled=0"
    ),
    guardians: one(db, "SELECT COUNT(*) AS value FROM Guardian"),
    staff: one(db, "SELECT COUNT(*) AS value FROM StaffMember")
  };
}

function canonicalStudent(row: Record<string, unknown>) {
  const excluded = new Set(["id", "createdAt", "updatedAt"]);
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !excluded.has(key))
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

function canonicalPayment(row: Record<string, unknown>) {
  const excluded = new Set(["id", "studentId", "createdAt", "updatedAt"]);
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !excluded.has(key))
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

function hashSet(rows: Record<string, unknown>[], mapper: (row: Record<string, unknown>) => unknown) {
  return rows.map((row) => hashBytes(JSON.stringify(normalize(mapper(row))))).sort();
}

function requestedGroupCounts(db: DatabaseSync) {
  const groupTables: Record<string, string[]> = {
    students: ["Student"],
    enrollments: ["AcademicYearEnrollment"],
    guardiansAndLinks: ["Guardian", "StudentGuardian"],
    feeStructures: ["FeeStructure"],
    storedFeeAllocations: [],
    payments: ["Payment"],
    receiptNotes: ["ReceiptNote"],
    paymentAudits: ["PaymentAudit"],
    lifecycleEvents: ["StudentLifecycleEvent"],
    attendance: [
      "StudentAttendanceSession",
      "StudentAttendanceRecord",
      "StaffAttendanceSession",
      "StaffAttendanceRecord"
    ],
    homework: ["HomeworkAssignment", "HomeworkAssignmentEvent"],
    examsAndMarks: ["ExamCycle", "ExamAssessment", "StudentMark", "StudentMarkEvent"],
    reportCards: [
      "ReportCardBatch",
      "StudentReportCard",
      "StudentReportCardVersion",
      "StudentReportCardEvent"
    ],
    certificates: [
      "StudentCertificateRequest",
      "StudentCertificate",
      "StudentCertificateVersion",
      "StudentCertificateEvent"
    ],
    idCards: [
      "IdentityCardBatch",
      "IdentityCard",
      "IdentityCardVersion",
      "IdentityCardEvent"
    ],
    library: tableNames(db).filter((name) => name.startsWith("Library")),
    notifications: tableNames(db).filter((name) => name.startsWith("Notification")),
    cashBook: ["CashBookDay", "CashBookMovement"],
    ocrProfiles: ["FeeRegisterOcrProfile"],
    ocrBusinessLinks: tableNames(db).filter(
      (name) => name.startsWith("FeeRegisterOcr") && name !== "FeeRegisterOcrProfile"
    ),
    importBatches: ["ImportBatch"],
    users: ["User"]
  };
  const existing = new Set(tableNames(db));
  return Object.fromEntries(
    Object.entries(groupTables).map(([group, tables]) => [
      group,
      {
        rows: tables
          .filter((table) => existing.has(table))
          .reduce((sum, table) => sum + one(db, `SELECT COUNT(*) AS value FROM ${quote(table)}`), 0),
        tables: tables.filter((table) => existing.has(table)).length
      }
    ])
  );
}

function dependencyManifest(
  db: DatabaseSync,
  studentIds: string[],
  admissions: string[],
  paymentIds: string[],
  receiptNumbers: string[]
) {
  const counts: Record<string, number> = {};
  for (const table of tableNames(db)) {
    const columns = db.prepare(`PRAGMA table_info(${quote(table)})`).all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    const clauses: string[] = [];
    const args: unknown[] = [];
    if (names.has("studentId") && studentIds.length) {
      clauses.push(`${quote("studentId")} IN (${placeholders(studentIds)})`);
      args.push(...studentIds);
    }
    if (names.has("admissionNo") && admissions.length) {
      clauses.push(`${quote("admissionNo")} IN (${placeholders(admissions)})`);
      args.push(...admissions);
    }
    if (names.has("paymentId") && paymentIds.length) {
      clauses.push(`${quote("paymentId")} IN (${placeholders(paymentIds)})`);
      args.push(...paymentIds);
    }
    if (names.has("receiptNo") && receiptNumbers.length) {
      clauses.push(`${quote("receiptNo")} IN (${placeholders(receiptNumbers)})`);
      args.push(...receiptNumbers);
    }
    if (!clauses.length) continue;
    const count = one(
      db,
      `SELECT COUNT(*) AS value FROM ${quote(table)} WHERE ${clauses.join(" OR ")}`,
      ...args
    );
    if (count) counts[table] = count;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function migrationEvidence(db: DatabaseSync) {
  if (!tableNames(db).includes("_prisma_migrations")) {
    return { metadataTablePresent: false, applied: 0, latest: null };
  }
  const applied = one(
    db,
    'SELECT COUNT(*) AS value FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
  );
  const latest = db.prepare(
    'SELECT migration_name AS name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at DESC LIMIT 1'
  ).get() as { name?: string } | undefined;
  return { metadataTablePresent: true, applied, latest: latest?.name ?? null };
}

function assertOperationalUnchanged(state: State) {
  const identity = databaseIdentity(OPERATIONAL);
  if (
    identity.sha256 !== state.operationalHash ||
    identity.size !== state.operationalSize ||
    identity.lastWriteUtc !== state.operationalLastWriteUtc
  ) {
    throw new Error("DATA0AQA_OPERATIONAL_DATABASE_CHANGED");
  }
}

function readState() {
  if (!existsSync(STATE)) throw new Error("DATA0AQA_STATE_MISSING");
  return JSON.parse(readFileSync(STATE, "utf8")) as State;
}

function createReference() {
  if (existsSync(REFERENCE)) throw new Error("DATA0AQA_REFERENCE_ALREADY_EXISTS");
  mkdirSync(ROOT, { recursive: true });
  const descriptor = openSync(REFERENCE, "wx");
  closeSync(descriptor);
  try {
    runPrisma(["migrate", "deploy"], REFERENCE);
    const password = () => `DATA0AQA-${randomBytes(18).toString("hex")}!`;
    runPnpm(["db:seed"], REFERENCE, {
      NODE_ENV: "development",
      NALANDA_DEMO_SEED_OPT_IN: "true",
      ALLOW_DEMO_USERS: "true",
      DEMO_USER_DATABASE_ROOT: ROOT,
      ALLOW_DEMO_BUSINESS_DATA: "true",
      DEMO_BUSINESS_DATA_ROOT: ROOT,
      SEED_DIRECTOR_PASSWORD: password(),
      SEED_ADMIN_PASSWORD: password(),
      SEED_ACCOUNTANT_PASSWORD: password(),
      SEED_VIEWER_PASSWORD: password()
    });
    const db = new DatabaseSync(REFERENCE, { readOnly: true });
    try {
      const students = one(db, "SELECT COUNT(*) AS value FROM Student");
      const payments = one(db, "SELECT COUNT(*) AS value FROM Payment");
      const amount = one(db, "SELECT COALESCE(SUM(amountPaid),0) AS value FROM Payment");
      if (students !== 8 || payments !== 11 || amount !== 92100) {
        throw new Error("DATA0AQA_REFERENCE_SEED_COUNTS_MISMATCH");
      }
      console.log(JSON.stringify({
        status: "DATA0AQA_REFERENCE_SEED_CREATED",
        students,
        payments,
        amount,
        migration: migrationEvidence(db),
        foreignKeyViolations: db.prepare("PRAGMA foreign_key_check").all().length
      }, null, 2));
    } finally {
      db.close();
    }
  } catch (error) {
    rmSync(REFERENCE, { force: true });
    throw error;
  }
}

function independentAudit() {
  if (!existsSync(REFERENCE)) throw new Error("DATA0AQA_REFERENCE_SEED_DATABASE_MISSING");
  const operational = new DatabaseSync(OPERATIONAL, { readOnly: true });
  const reference = new DatabaseSync(REFERENCE, { readOnly: true });
  try {
    operational.exec("PRAGMA query_only=ON");
    reference.exec("PRAGMA query_only=ON");
    const opStudents = operational.prepare("SELECT * FROM Student ORDER BY admissionNo").all() as Record<string, unknown>[];
    const refStudents = reference.prepare("SELECT * FROM Student ORDER BY admissionNo").all() as Record<string, unknown>[];
    const opPayments = operational.prepare("SELECT * FROM Payment ORDER BY id").all() as Record<string, unknown>[];
    const refPayments = reference.prepare("SELECT * FROM Payment ORDER BY id").all() as Record<string, unknown>[];
    const referencePaymentHashes = new Set(hashSet(refPayments, canonicalPayment));
    const operationalPaymentHashes = hashSet(opPayments, canonicalPayment);
    const seedPaymentMatches = operationalPaymentHashes.filter((hash) => referencePaymentHashes.has(hash)).length;
    const extraPayments = opPayments.filter(
      (row) => !referencePaymentHashes.has(hashBytes(JSON.stringify(normalize(canonicalPayment(row)))))
    );
    const extraIds = extraPayments.map((row) => String(row.id));
    const extraReceipts = [...new Set(extraPayments.map((row) => String(row.receiptNo)))];
    const extraAudits = extraIds.length
      ? operational.prepare(
          `SELECT action, reason FROM PaymentAudit WHERE paymentId IN (${placeholders(extraIds)}) ORDER BY paymentId`
        ).all(...extraIds) as Array<{ action: string; reason: string | null }>
      : [];
    const extraGroups = extraReceipts.map((receiptNo) => {
      const rows = extraPayments.filter((row) => String(row.receiptNo) === receiptNo);
      const creationTimes = rows.map((row) => Number(row.createdAt));
      const creationWindowMs = Math.max(...creationTimes) - Math.min(...creationTimes);
      return {
        receiptHash: hashBytes(receiptNo),
        rows: rows.length,
        amount: rows.reduce((sum, row) => sum + Number(row.amountPaid), 0),
        explicitQaMarkerRows: rows.filter((row) => /qa|test|demo/i.test(String(row.remarks ?? ""))).length,
        qaPrefix: /^QA/i.test(receiptNo),
        numericOnly: /^\d+$/.test(receiptNo),
        creationWindowMs
      };
    });
    const admissions = opStudents.map((row) => String(row.admissionNo));
    const studentIds = opStudents.map((row) => String(row.id));
    const paymentIds = opPayments.map((row) => String(row.id));
    const referenceNotes = reference.prepare("SELECT receiptNo FROM ReceiptNote").all() as Array<{ receiptNo: string }>;
    const receiptNumbers = [
      ...new Set([...opPayments.map((row) => String(row.receiptNo)), ...referenceNotes.map((row) => row.receiptNo)])
    ];
    const manifest = dependencyManifest(
      operational,
      studentIds,
      admissions,
      paymentIds,
      receiptNumbers
    );
    const expectedManifest = {
      AcademicYearEnrollment: 8,
      Payment: 19,
      PaymentAudit: 19,
      ReceiptNote: 1,
      Student: 8,
      StudentLifecycleEvent: 8
    };
    const seedStudentsExact =
      refStudents.length === 8 &&
      opStudents.length === 8 &&
      JSON.stringify(hashSet(refStudents, canonicalStudent)) ===
        JSON.stringify(hashSet(opStudents, canonicalStudent));
    const qaPaymentsExact =
      extraPayments.length === 8 &&
      extraPayments.reduce((sum, row) => sum + Number(row.amountPaid), 0) === 7000 &&
      extraGroups.length === 2 &&
      extraGroups.every((group) =>
        group.rows === 4 &&
        group.creationWindowMs <= 5000 &&
        (group.qaPrefix || (group.numericOnly && group.explicitQaMarkerRows === 4))
      ) &&
      extraAudits.length === 8 &&
      extraAudits.every(
        (row) => row.action === "CREATED" && row.reason === "Split receipt component created"
      );
    if (
      !seedStudentsExact ||
      seedPaymentMatches !== 11 ||
      refPayments.reduce((sum, row) => sum + Number(row.amountPaid), 0) !== 92100 ||
      !qaPaymentsExact ||
      JSON.stringify(manifest) !== JSON.stringify(expectedManifest)
    ) {
      console.error(JSON.stringify({
        seedStudentsExact,
        operationalStudents: opStudents.length,
        referenceStudents: refStudents.length,
        seedPaymentMatches,
        operationalPayments: opPayments.length,
        referencePayments: refPayments.length,
        referencePaymentAmount: refPayments.reduce((sum, row) => sum + Number(row.amountPaid), 0),
        qaPaymentsExact,
        extraPayments: extraPayments.length,
        extraPaymentAmount: extraPayments.reduce((sum, row) => sum + Number(row.amountPaid), 0),
        extraGroups,
        extraAudits: extraAudits.length,
        manifest,
        manifestMatches: JSON.stringify(manifest) === JSON.stringify(expectedManifest)
      }, null, 2));
      throw new Error("DATA0AQA_PROVENANCE_MISMATCH");
    }
    const identityBefore = databaseIdentity(OPERATIONAL);
    if (identityBefore.sha256 !== EXPECTED_OPERATIONAL_HASH) {
      throw new Error("DATA0AQA_OPERATIONAL_HASH_UNEXPECTED");
    }
    const result = {
      status: "DATA0AQA_INDEPENDENT_PROVENANCE_VERIFIED",
      operationalIdentity: identityBefore,
      sourceComparison: {
        referenceSeedStudents: refStudents.length,
        exactFullFieldStudentHashMatches: opStudents.length,
        studentHashSetsIdentical: seedStudentsExact,
        referenceSeedPayments: refPayments.length,
        exactFullFieldPaymentHashMatches: seedPaymentMatches,
        referenceSeedPaymentAmount: refPayments.reduce((sum, row) => sum + Number(row.amountPaid), 0),
        qaPaymentRows: extraPayments.length,
        qaPaymentAmount: extraPayments.reduce((sum, row) => sum + Number(row.amountPaid), 0),
        qaGroups: extraGroups,
        qaCreationAuditsExact: extraAudits.length
      },
      businessBaseline: businessBaseline(operational),
      requestedGroups: requestedGroupCounts(operational),
      dependencyManifest: manifest,
      integrity: {
        foreignKeyViolations: operational.prepare("PRAGMA foreign_key_check").all().length,
        retainedDigest: retainedDigest(operational)
      },
      migration: migrationEvidence(operational),
      receiptSequence: {
        paymentReceiptCounterTablePresent: false,
        paymentReceiptCounterColumnPresent: false,
        recommendation: "PRESERVE_RECEIPT_SEQUENCE"
      }
    };
    const identityAfter = databaseIdentity(OPERATIONAL);
    if (JSON.stringify(identityAfter) !== JSON.stringify(identityBefore)) {
      throw new Error("DATA0AQA_OPERATIONAL_CHANGED_DURING_AUDIT");
    }
    console.log(JSON.stringify(result, null, 2));
  } finally {
    operational.close();
    reference.close();
  }
}

function prepareCopy() {
  if (!existsSync(REFERENCE)) throw new Error("DATA0AQA_REFERENCE_SEED_DATABASE_MISSING");
  if (existsSync(COPY) || existsSync(STATE)) throw new Error("DATA0AQA_COPY_ALREADY_EXISTS");
  const identity = databaseIdentity(OPERATIONAL);
  if (identity.sha256 !== EXPECTED_OPERATIONAL_HASH) throw new Error("DATA0AQA_OPERATIONAL_HASH_UNEXPECTED");
  copyFileSync(OPERATIONAL, COPY);
  const copyIdentity = databaseIdentity(COPY);
  if (copyIdentity.sha256 !== identity.sha256 || copyIdentity.size !== identity.size) {
    throw new Error("DATA0AQA_COPY_NOT_BYTE_IDENTICAL");
  }
  const db = new DatabaseSync(COPY, { readOnly: true });
  let digest: string;
  try {
    db.exec("PRAGMA query_only=ON");
    digest = retainedDigest(db);
  } finally {
    db.close();
  }
  const state: State = {
    operationalHash: identity.sha256,
    operationalSize: identity.size,
    operationalLastWriteUtc: identity.lastWriteUtc,
    preparedCopyHash: copyIdentity.sha256,
    retainedDigestBefore: digest
  };
  writeFileSync(STATE, JSON.stringify(state, null, 2), { flag: "wx" });
  console.log(JSON.stringify({
    status: "DATA0AQA_BYTE_IDENTICAL_COPY_PREPARED",
    operationalIdentity: identity,
    copyIdentity,
    retainedDigestBefore: digest
  }, null, 2));
}

function cleanCopy() {
  const state = readState();
  assertOperationalUnchanged(state);
  const db = new DatabaseSync(COPY);
  try {
    db.exec("PRAGMA foreign_keys=ON");
    const beforeBusiness = businessBaseline(db);
    if (Object.values(beforeBusiness).every((value) => value === 0)) {
      const cleanDigest = retainedDigest(db);
      if (cleanDigest !== state.cleanDigest) throw new Error("DATA0AQA_IDEMPOTENT_DIGEST_CHANGED");
      console.log(JSON.stringify({
        status: "DATA0AQA_CLEANUP_ALREADY_EMPTY",
        baseline: beforeBusiness,
        retainedDigest: cleanDigest,
        foreignKeyViolations: db.prepare("PRAGMA foreign_key_check").all().length
      }, null, 2));
      return;
    }
    const students = db.prepare("SELECT id, admissionNo FROM Student ORDER BY id").all() as Array<{
      id: string;
      admissionNo: string;
    }>;
    const payments = db.prepare("SELECT id, receiptNo FROM Payment ORDER BY id").all() as Array<{
      id: string;
      receiptNo: string;
    }>;
    const reference = new DatabaseSync(REFERENCE, { readOnly: true });
    const referenceNotes = reference.prepare("SELECT receiptNo FROM ReceiptNote").all() as Array<{ receiptNo: string }>;
    reference.close();
    const paymentIds = payments.map((row) => row.id);
    const receiptNumbers = [...new Set([...payments.map((row) => row.receiptNo), ...referenceNotes.map((row) => row.receiptNo)])];
    const studentIds = students.map((row) => row.id);
    const admissions = students.map((row) => row.admissionNo);
    const manifest = dependencyManifest(db, studentIds, admissions, paymentIds, receiptNumbers);
    const expectedManifest = {
      AcademicYearEnrollment: 8,
      Payment: 19,
      PaymentAudit: 19,
      ReceiptNote: 1,
      Student: 8,
      StudentLifecycleEvent: 8
    };
    if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) {
      throw new Error("DATA0AQA_DEPENDENCY_MANIFEST_MISMATCH");
    }
    const beforeCounts = tableCounts(db);
    db.exec("BEGIN IMMEDIATE");
    try {
      const deleted = {
        PaymentAudit: db.prepare(
          `DELETE FROM PaymentAudit WHERE paymentId IN (${placeholders(paymentIds)})`
        ).run(...paymentIds).changes,
        ReceiptNote: db.prepare(
          `DELETE FROM ReceiptNote WHERE receiptNo IN (${placeholders(receiptNumbers)})`
        ).run(...receiptNumbers).changes,
        Payment: db.prepare(
          `DELETE FROM Payment WHERE id IN (${placeholders(paymentIds)})`
        ).run(...paymentIds).changes,
        StudentLifecycleEvent: db.prepare(
          `DELETE FROM StudentLifecycleEvent WHERE studentId IN (${placeholders(studentIds)})`
        ).run(...studentIds).changes,
        AcademicYearEnrollment: db.prepare(
          `DELETE FROM AcademicYearEnrollment WHERE studentId IN (${placeholders(studentIds)})`
        ).run(...studentIds).changes,
        Student: db.prepare(
          `DELETE FROM Student WHERE id IN (${placeholders(studentIds)})`
        ).run(...studentIds).changes
      };
      const afterCounts = tableCounts(db);
      const changedTables = Object.keys(beforeCounts)
        .filter((table) => beforeCounts[table] !== afterCounts[table])
        .sort();
      if (
        changedTables.length !== CLEANED_TABLES.size ||
        changedTables.some((table) => !CLEANED_TABLES.has(table))
      ) {
        throw new Error("DATA0AQA_UNAPPROVED_TABLE_CHANGED");
      }
      const baseline = businessBaseline(db);
      const foreignKeyViolations = db.prepare("PRAGMA foreign_key_check").all().length;
      const digest = retainedDigest(db);
      if (
        Object.values(baseline).some((value) => value !== 0) ||
        foreignKeyViolations !== 0 ||
        digest !== state.retainedDigestBefore
      ) {
        throw new Error("DATA0AQA_POST_CLEAN_ASSERTION_FAILED");
      }
      db.exec("COMMIT");
      const nextState = { ...state, cleanDigest: digest };
      writeFileSync(STATE, JSON.stringify(nextState, null, 2));
      assertOperationalUnchanged(nextState);
      console.log(JSON.stringify({
        status: "DATA0AQA_COPIED_DATABASE_CLEANED",
        manifest,
        deleted,
        changedTables,
        baseline,
        foreignKeyViolations,
        retainedDigestBefore: state.retainedDigestBefore,
        retainedDigestAfter: digest
      }, null, 2));
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }
}

function prismaFor(filePath: string) {
  return new PrismaClient({ datasourceUrl: `file:${filePath.replaceAll("\\", "/")}` });
}

function assertRestoreResult(result: Record<string, unknown>) {
  const failures = Object.entries(result).flatMap(([entity, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const errors = (value as { errors?: unknown[] }).errors;
    return errors?.length ? [`${entity}:${errors.length}`] : [];
  });
  if (failures.length) throw new Error(`DATA0AQA_RESTORE_ERRORS:${failures.join(",")}`);
}

async function backupRestore() {
  const state = readState();
  assertOperationalUnchanged(state);
  if (!state.cleanDigest) throw new Error("DATA0AQA_COPY_NOT_CLEANED");
  if (existsSync(RESTORE) || existsSync(BACKUP)) throw new Error("DATA0AQA_RESTORE_STATE_EXISTS");
  const clean = new DatabaseSync(COPY, { readOnly: true });
  let cleanTableDigests: Record<string, string>;
  try {
    if (
      Object.values(businessBaseline(clean)).some((value) => value !== 0) ||
      retainedDigest(clean) !== state.cleanDigest
    ) {
      throw new Error("DATA0AQA_CLEAN_COPY_INVALID");
    }
    cleanTableDigests = retainedTableDigests(clean);
  } finally {
    clean.close();
  }
  const source = prismaFor(COPY);
  const generated = await generateFullBackup(source, {
    generatedBy: "DATA-0A-QA independent copied-database verification",
    generatedAt: new Date()
  });
  await source.$disconnect();
  const serialized = serializeBackup(generated);
  writeFileSync(BACKUP, serialized, { flag: "wx" });
  const validated = parseAndValidateBackup(JSON.parse(serialized));
  if (validated.metadata.backupVersion !== 40) throw new Error("DATA0AQA_BACKUP_VERSION_CHANGED");
  copyFileSync(COPY, RESTORE);
  const target = prismaFor(RESTORE);
  const actor = await target.user.findFirst({
    where: { isActive: true, role: { in: ["SUPER_ADMIN", "DIRECTOR"] } },
    select: { id: true, name: true }
  });
  if (!actor) throw new Error("DATA0AQA_RESTORE_ACTOR_MISSING");
  const first = await restoreValidatedBackup(target, validated, actor);
  assertRestoreResult(first as unknown as Record<string, unknown>);
  const firstDb = new DatabaseSync(RESTORE, { readOnly: true });
  const firstDigest = retainedDigest(firstDb);
  const firstTableDigests = retainedTableDigests(firstDb);
  const firstBaseline = businessBaseline(firstDb);
  const firstFk = firstDb.prepare("PRAGMA foreign_key_check").all().length;
  firstDb.close();
  const second = await restoreValidatedBackup(target, validated, actor);
  assertRestoreResult(second as unknown as Record<string, unknown>);
  await target.$disconnect();
  const secondDb = new DatabaseSync(RESTORE, { readOnly: true });
  const secondDigest = retainedDigest(secondDb);
  const secondTableDigests = retainedTableDigests(secondDb);
  const secondBaseline = businessBaseline(secondDb);
  const secondFk = secondDb.prepare("PRAGMA foreign_key_check").all().length;
  secondDb.close();
  if (
    firstDigest !== state.cleanDigest ||
    secondDigest !== state.cleanDigest ||
    JSON.stringify(firstBaseline) !== JSON.stringify(secondBaseline) ||
    Object.values(secondBaseline).some((value) => value !== 0) ||
    firstFk !== 0 ||
    secondFk !== 0
  ) {
    console.error(JSON.stringify({
      cleanToFirstChangedTables: Object.keys(cleanTableDigests).filter(
        (table) => cleanTableDigests[table] !== firstTableDigests[table]
      ),
      firstToSecondChangedTables: Object.keys(firstTableDigests).filter(
        (table) => firstTableDigests[table] !== secondTableDigests[table]
      ),
      cleanDigest: state.cleanDigest,
      firstDigest,
      secondDigest,
      firstBaseline,
      secondBaseline,
      firstFk,
      secondFk
    }, null, 2));
    throw new Error("DATA0AQA_RESTORE_DIGEST_MISMATCH");
  }
  assertOperationalUnchanged(state);
  console.log(JSON.stringify({
    status: "DATA0AQA_BACKUP_RESTORED_TWICE",
    backupVersion: validated.metadata.backupVersion,
    backupSha256: fileHash(BACKUP),
    cleanDigest: state.cleanDigest,
    firstDigest,
    secondDigest,
    firstBaseline,
    secondBaseline,
    firstForeignKeyViolations: firstFk,
    secondForeignKeyViolations: secondFk
  }, null, 2));
}

function inspectCopy() {
  const state = readState();
  assertOperationalUnchanged(state);
  const db = new DatabaseSync(COPY, { readOnly: true });
  try {
    db.exec("PRAGMA query_only=ON");
    console.log(JSON.stringify({
      status: "DATA0AQA_COPY_INSPECTED",
      baseline: businessBaseline(db),
      retainedDigest: retainedDigest(db),
      expectedCleanDigest: state.cleanDigest ?? null,
      foreignKeyViolations: db.prepare("PRAGMA foreign_key_check").all().length
    }, null, 2));
  } finally {
    db.close();
  }
}

function destroy() {
  const state = readState();
  assertOperationalUnchanged(state);
  const db = new DatabaseSync(COPY, { readOnly: true });
  try {
    if (Object.values(businessBaseline(db)).some((value) => value !== 0)) {
      throw new Error("DATA0AQA_REFUSED_TO_REMOVE_NONCLEAN_COPY");
    }
  } finally {
    db.close();
  }
  rmSync(ROOT, { recursive: true, force: true });
  console.log(JSON.stringify({
    status: "DATA0AQA_ROOT_REMOVED",
    root: ROOT,
    operationalHashUnchanged: state.operationalHash
  }, null, 2));
}

async function main() {
  const command = process.argv[2];
  if (command === "create-reference") return createReference();
  if (command === "audit") return independentAudit();
  if (command === "prepare-copy") return prepareCopy();
  if (command === "clean-copy") return cleanCopy();
  if (command === "backup-restore") return backupRestore();
  if (command === "inspect-copy") return inspectCopy();
  if (command === "destroy") return destroy();
  throw new Error(
    "Use create-reference, audit, prepare-copy, clean-copy, backup-restore, inspect-copy, or destroy."
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "DATA0AQA_FAILED");
  process.exitCode = 1;
});
