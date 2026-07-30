import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  assertIsolatedDatabasePath,
  cleanupIsolatedDatabase,
  databaseUrl,
  ensureQaRoot
} from "./migration-isolation";

const LABEL = "UX1AQA";
const PREFIX = "ux1aqa-";
const DATABASE_PATH = path.join(QA_ROOT, "operational-copy", `${LABEL}-browser.db`);
const STATE_PATH = path.join(QA_ROOT, "operational-copy", `${LABEL}-state.json`);

const USERS = [
  { id: `${PREFIX}super-admin`, name: "UX QA School Owner", username: `${PREFIX}super-admin`, role: "SUPER_ADMIN" },
  { id: `${PREFIX}director`, name: "UX QA Director", username: `${PREFIX}director`, role: "DIRECTOR" },
  { id: `${PREFIX}principal`, name: "UX QA Principal", username: `${PREFIX}principal`, role: "PRINCIPAL" },
  { id: `${PREFIX}admin`, name: "UX QA Administrator", username: `${PREFIX}admin`, role: "ADMIN" },
  { id: `${PREFIX}accountant`, name: "UX QA Accountant", username: `${PREFIX}accountant`, role: "ACCOUNTANT" },
  { id: `${PREFIX}viewer`, name: "UX QA Viewer", username: `${PREFIX}viewer`, role: "VIEWER" },
  { id: `${PREFIX}teacher`, name: "UX QA Teacher", username: `${PREFIX}teacher`, role: "TEACHER" },
  { id: `${PREFIX}parent`, name: "UX QA Parent", username: `${PREFIX}parent`, role: "PARENT" }
] as const;

type QaState = {
  databasePath: string;
  databaseUrl: string;
  operationalHash: string;
  baselineLogicalDigest: string;
  browserAccessValue: string;
};

async function main() {
  const action = String(process.argv[2] ?? "").toLowerCase();
  if (action === "prepare") return prepare();
  if (action === "inspect") return inspect();
  if (action === "operational-check") return operationalCheck();
  if (action === "cleanup") return cleanup();
  if (action === "destroy") return destroy();
  throw new Error("Use prepare, inspect, operational-check, cleanup, or destroy");
}

function client(databasePath: string) {
  return new PrismaClient({ datasources: { db: { url: databaseUrl(databasePath) } } });
}

async function prepare() {
  ensureQaRoot();
  const databasePath = assertIsolatedDatabasePath(DATABASE_PATH);
  if (existsSync(databasePath)) cleanupIsolatedDatabase(databasePath);
  if (existsSync(STATE_PATH)) rmSync(STATE_PATH, { force: true });
  const operationalHash = fileHash(OPERATIONAL_DATABASE);
  copyFileSync(OPERATIONAL_DATABASE, databasePath);
  const prisma = client(databasePath);
  try {
    const baselineLogicalDigest = await logicalDatabaseDigest(prisma);
    const browserAccessValue = `UX1A-${randomBytes(24).toString("base64url")}!Aa9`;
    const passwordHash = await hashPassword(browserAccessValue);
    await prisma.user.createMany({
      data: USERS.map((user) => ({ ...user, passwordHash, isActive: true }))
    });
    writeFileSync(STATE_PATH, JSON.stringify({
      databasePath,
      databaseUrl: databaseUrl(databasePath),
      operationalHash,
      baselineLogicalDigest,
      browserAccessValue
    } satisfies QaState, null, 2));
    assertOperationalHash(operationalHash);
    console.log(JSON.stringify({
      status: "UX1AQA_COPY_PREPARED",
      databasePath,
      databaseUrl: databaseUrl(databasePath),
      roles: USERS.map(({ role, username }) => ({ role, username })),
      credentials: "Stored only in the ignored UX1A runtime state file; not printed",
      operationalDatabaseUnchanged: true
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function inspect() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const users = await prisma.user.findMany({
      where: { id: { startsWith: PREFIX } },
      select: { name: true, username: true, role: true, isActive: true },
      orderBy: { role: "asc" }
    });
    if (users.length !== USERS.length || users.some((user) => !user.isActive)) {
      throw new Error(`UX1AQA_FIXTURE_INSPECTION_FAILED_${JSON.stringify(users)}`);
    }
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "UX1AQA_FIXTURES_READY",
      users,
      operationalDatabaseUnchanged: true
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function operationalCheck() {
  const state = readState();
  assertOperationalHash(state.operationalHash);
  const prisma = new PrismaClient({ datasources: { db: { url: `file:${OPERATIONAL_DATABASE.replaceAll("\\", "/")}` } } });
  try {
    const [students, enrollments, payments, guardians, staff, paymentTotal, accounts, migrations] = await Promise.all([
      prisma.student.count(),
      prisma.academicYearEnrollment.count(),
      prisma.payment.count(),
      prisma.guardian.count(),
      prisma.staffMember.count(),
      prisma.payment.aggregate({ _sum: { amountPaid: true } }),
      prisma.user.groupBy({ by: ["role", "isActive"], _count: { _all: true }, orderBy: [{ role: "asc" }, { isActive: "desc" }] }),
      prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: string | null; rolled_back_at: string | null }>>(
        "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at"
      )
    ]);
    const exact = {
      students,
      enrollments,
      payments,
      paymentAmountInr: paymentTotal._sum.amountPaid ?? 0,
      guardians,
      staff,
      accounts: accounts.map((row) => ({ role: row.role, isActive: row.isActive, count: row._count._all }))
    };
    const expected = {
      students: 0,
      enrollments: 0,
      payments: 0,
      paymentAmountInr: 0,
      guardians: 0,
      staff: 0,
      accounts: [
        { role: "ACCOUNTANT", isActive: false, count: 1 },
        { role: "ADMIN", isActive: false, count: 1 },
        { role: "SUPER_ADMIN", isActive: true, count: 1 },
        { role: "VIEWER", isActive: false, count: 1 }
      ]
    };
    if (JSON.stringify(exact) !== JSON.stringify(expected)) {
      throw new Error(`UX1AQA_OPERATIONAL_BASELINE_MISMATCH_${JSON.stringify(exact)}`);
    }
    if (
      migrations.length !== 1 ||
      migrations[0]?.migration_name !== "20260722_clean_install_baseline" ||
      !migrations[0]?.finished_at ||
      migrations[0]?.rolled_back_at
    ) {
      throw new Error("UX1AQA_OPERATIONAL_MIGRATION_STATE_MISMATCH");
    }
    console.log(JSON.stringify({
      status: "UX1AQA_OPERATIONAL_BASELINE_UNCHANGED",
      ...exact,
      migration: migrations[0].migration_name,
      operationalHash: state.operationalHash
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanup() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    await prisma.userAudit.deleteMany({
      where: {
        OR: [
          { actorUserId: { startsWith: PREFIX } },
          { targetUserId: { startsWith: PREFIX } }
        ]
      }
    });
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
    const remaining = await prisma.user.count({ where: { id: { startsWith: PREFIX } } });
    if (remaining !== 0) throw new Error(`UX1AQA_TARGETED_CLEANUP_FAILED_${remaining}`);
    if (await logicalDatabaseDigest(prisma) !== state.baselineLogicalDigest) {
      throw new Error("UX1AQA_NON_QA_LOGICAL_STATE_CHANGED");
    }
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "UX1AQA_COPY_CLEANED",
      cleanupIdempotent: true,
      nonQaLogicalStateRestored: true,
      operationalDatabaseUnchanged: true
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function destroy() {
  const state = readState();
  assertOperationalHash(state.operationalHash);
  cleanupIsolatedDatabase(state.databasePath);
  rmSync(STATE_PATH, { force: true });
  console.log(JSON.stringify({
    status: "UX1AQA_COPY_DESTROYED",
    databaseRemoved: !existsSync(state.databasePath),
    stateRemoved: !existsSync(STATE_PATH),
    operationalDatabaseUnchanged: true
  }, null, 2));
}

async function logicalDatabaseDigest(prisma: PrismaClient) {
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const hash = createHash("sha256");
  for (const { name } of tables) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("UX1AQA_UNSAFE_TABLE_NAME");
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "${name}" ORDER BY rowid`
    );
    hash.update(name);
    hash.update(JSON.stringify(rows, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (Buffer.isBuffer(value)) return value.toString("base64");
      return value;
    }));
  }
  return hash.digest("hex");
}

function readState(): QaState {
  if (!existsSync(STATE_PATH)) throw new Error("UX1AQA_STATE_NOT_FOUND_RUN_PREPARE");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as QaState;
  if (path.resolve(state.databasePath) !== path.resolve(DATABASE_PATH)) {
    throw new Error("UX1AQA_STATE_DATABASE_MISMATCH");
  }
  assertIsolatedDatabasePath(state.databasePath);
  return state;
}

function fileHash(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assertOperationalHash(expected: string) {
  const actual = fileHash(OPERATIONAL_DATABASE);
  if (actual !== expected) throw new Error(`UX1AQA_OPERATIONAL_DATABASE_CHANGED_${expected}_${actual}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
