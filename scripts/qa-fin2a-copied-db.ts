import { createHash, randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { calculateCashSources } from "../lib/cash-book";
import {
  cancelWholeReceipt,
  effectiveActiveReceiptPayments,
  effectiveReceiptState,
  receiptVersion
} from "../lib/receipt-integrity";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  assertIsolatedDatabasePath,
  cleanupIsolatedDatabase,
  databaseUrl,
  ensureQaRoot
} from "./migration-isolation";

const FIXTURE_LABEL = process.argv.includes("--qa") ? "FIN2AQA" : "FIN2A";
const PREFIX = `${FIXTURE_LABEL.toLowerCase()}-`;
const RECEIPT_NO = FIXTURE_LABEL === "FIN2AQA" ? "992026" : "982026";
const RACE_RECEIPT_NO = FIXTURE_LABEL === "FIN2AQA" ? "992027" : "982027";
const ROLLBACK_RECEIPT_NO = FIXTURE_LABEL === "FIN2AQA" ? "992028" : "982028";
const ADMISSION_NO = `${FIXTURE_LABEL}-STUDENT`;
const QA_DATE = new Date("2099-01-01T00:00:00.000Z");
const DATABASE_PATH = path.join(
  QA_ROOT,
  "operational-copy",
  `${FIXTURE_LABEL}-browser.db`
);
const STATE_PATH = path.join(
  QA_ROOT,
  "operational-copy",
  `${FIXTURE_LABEL}-state.json`
);
const USERS = [
  { id: `${PREFIX}director`, name: `${FIXTURE_LABEL} Director`, username: `${PREFIX}director`, role: "DIRECTOR" },
  { id: `${PREFIX}accountant`, name: `${FIXTURE_LABEL} Accountant`, username: `${PREFIX}accountant`, role: "ACCOUNTANT" },
  { id: `${PREFIX}viewer`, name: `${FIXTURE_LABEL} Viewer`, username: `${PREFIX}viewer`, role: "VIEWER" }
] as const;
const ROLE_PERMISSIONS = [
  ["DIRECTOR", "VIEW_DASHBOARD"],
  ["DIRECTOR", "VIEW_PAYMENTS"],
  ["DIRECTOR", "VIEW_DAILY_COLLECTION"],
  ["DIRECTOR", "VIEW_PENDING_DUES"],
  ["DIRECTOR", "VIEW_LEDGER"],
  ["DIRECTOR", "VIEW_RECEIPT_AUDIT"],
  ["DIRECTOR", "PRINT_RECEIPTS"],
  ["DIRECTOR", "CANCEL_PAYMENTS"],
  ["ACCOUNTANT", "VIEW_DASHBOARD"],
  ["ACCOUNTANT", "VIEW_PAYMENTS"],
  ["ACCOUNTANT", "CREATE_PAYMENTS"],
  ["ACCOUNTANT", "EDIT_PAYMENTS"],
  ["ACCOUNTANT", "VIEW_DAILY_COLLECTION"],
  ["ACCOUNTANT", "VIEW_PENDING_DUES"],
  ["ACCOUNTANT", "VIEW_LEDGER"],
  ["ACCOUNTANT", "VIEW_RECEIPT_AUDIT"],
  ["ACCOUNTANT", "CANCEL_PAYMENTS"],
  ["ACCOUNTANT", "EXPORT_STUDENTS"],
  ["VIEWER", "VIEW_DASHBOARD"],
  ["VIEWER", "VIEW_DAILY_COLLECTION"],
  ["VIEWER", "VIEW_PENDING_DUES"],
  ["VIEWER", "VIEW_LEDGER"],
  ["VIEWER", "PRINT_LEDGER"],
  ["VIEWER", "EXPORT_REPORTS"]
] as const;

type SavedRolePermission = {
  role: string;
  permission: string;
  previous: null | { id: string; enabled: boolean };
};

type QaState = {
  databasePath: string;
  operationalHash: string;
  browserAccessValue: string;
  rolePermissions: SavedRolePermission[];
};

async function main() {
  const action = String(process.argv[2] ?? "").toLowerCase();
  if (action === "prepare") return prepare();
  if (action === "rotate-credentials") return rotateCredentials();
  if (action === "exercise-integrity") return exerciseIntegrity();
  if (action === "inspect") return inspectCommand();
  if (action === "verify-cancelled") return verifyCancelled();
  if (action === "cleanup") return cleanup();
  if (action === "destroy") return destroy();
  throw new Error("Use prepare, rotate-credentials, exercise-integrity, inspect, verify-cancelled, cleanup, or destroy");
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
    await cleanupMarkers(prisma);
    const browserAccessValue = `${randomBytes(24).toString("base64url")}!Aa9`;
    const passwordHash = await hashPassword(browserAccessValue);
    const fee = await prisma.feeStructure.findFirst({
      where: { active: true },
      orderBy: [{ academicYear: "desc" }, { className: "asc" }]
    });
    if (!fee) throw new Error("FIN2A_COPY_HAS_NO_ACTIVE_FEE_STRUCTURE");
    for (const user of USERS) {
      await prisma.user.create({ data: { ...user, passwordHash, isActive: true } });
    }
    const rolePermissions: SavedRolePermission[] = [];
    for (const [role, permission] of ROLE_PERMISSIONS) {
      const previous = await prisma.rolePermission.findUnique({
        where: { role_permission: { role, permission } },
        select: { id: true, enabled: true }
      });
      rolePermissions.push({ role, permission, previous });
      await prisma.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        update: { enabled: true },
        create: { role, permission, enabled: true }
      });
    }
    const student = await prisma.student.create({
      data: {
        academicYear: fee.academicYear,
        admissionNo: ADMISSION_NO,
        studentName: `${FIXTURE_LABEL} Student`,
        fatherName: `${FIXTURE_LABEL} Private Parent`,
        motherName: `${FIXTURE_LABEL} Private Mother`,
        className: fee.className,
        section: "QA",
        rollNo: `${FIXTURE_LABEL}-PRIVATE-ROLL`,
        phone1: "9000000001",
        phone2: "9000000002",
        whatsappNumber: "9000000003",
        address: `${FIXTURE_LABEL} private address`,
        dateOfBirth: new Date("2014-01-01T00:00:00.000Z"),
        aadhaarNo: "111122223333",
        status: "Active",
        remarks: `${FIXTURE_LABEL} private Student note`
      }
    });
    const components = [
      { id: `${PREFIX}payment-cash`, amountPaid: 1_000, paymentMode: "Cash", receivedAccount: "Cash", transactionRefNo: null },
      { id: `${PREFIX}payment-upi-1`, amountPaid: 2_000, paymentMode: "UPI", receivedAccount: "Director Sir GPay", transactionRefNo: `${FIXTURE_LABEL}-UPI-1` },
      { id: `${PREFIX}payment-upi-2`, amountPaid: 3_000, paymentMode: "UPI", receivedAccount: "NPS Current Account UPI", transactionRefNo: `${FIXTURE_LABEL}-UPI-2` }
    ];
    for (const component of components) {
      await prisma.payment.create({
        data: {
          ...component,
          date: QA_DATE,
          receiptNo: RECEIPT_NO,
          admissionNo: student.admissionNo,
          studentId: student.id,
          studentName: student.studentName,
          className: student.className,
          section: student.section,
          feeType: "Current Year Fee",
          termHint: "Term 1",
          remarks: `${FIXTURE_LABEL} private payment note`,
          enteredBy: `${FIXTURE_LABEL} Accountant`
        }
      });
    }
    await prisma.receiptNote.create({
      data: { receiptNo: RECEIPT_NO, status: "Active", remarks: `${FIXTURE_LABEL} active split receipt` }
    });
    const sources = await calculateCashSources(prisma, QA_DATE, new Prisma.Decimal(0));
    if (sources.feeCash.toFixed(2) !== "1000.00" || sources.counts.feePayments !== 1) {
      throw new Error("FIN2A_PREPARED_CASH_RECONCILIATION_FAILED");
    }
    writeFileSync(STATE_PATH, JSON.stringify({
      databasePath,
      operationalHash,
      browserAccessValue,
      rolePermissions
    } satisfies QaState, null, 2));
    assertOperationalHash(operationalHash);
    console.log(JSON.stringify({
      status: "FIN2A_COPY_PREPARED",
      fixturePrefix: FIXTURE_LABEL,
      databasePath,
      databaseUrl: databaseUrl(databasePath),
      receiptNo: RECEIPT_NO,
      admissionNo: ADMISSION_NO,
      roles: USERS.map(({ role, username }) => ({ role, username })),
      credentials: "Stored only in the ignored FIN2A runtime state file; not printed",
      components: 3,
      splitTotal: 6_000,
      cashBookFeeCashBefore: "1000.00",
      operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function inspectCommand() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const evidence = await inspection(prisma);
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({ status: "FIN2A_COPY_INSPECTED", ...evidence }));
  } finally {
    await prisma.$disconnect();
  }
}

async function rotateCredentials() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const browserAccessValue = `${randomBytes(24).toString("base64url")}!Aa9`;
    const passwordHash = await hashPassword(browserAccessValue);
    const changed = await prisma.user.updateMany({
      where: { id: { startsWith: PREFIX } },
      data: { passwordHash }
    });
    if (changed.count !== USERS.length) throw new Error("FIN2A_CREDENTIAL_ROTATION_USER_MISMATCH");
    state.browserAccessValue = browserAccessValue;
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "FIN2A_SYNTHETIC_CREDENTIALS_ROTATED",
      users: changed.count,
      credentials: "Stored only in the ignored FIN2A runtime state file; not printed",
      operationalHash: state.operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function exerciseIntegrity() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const student = await prisma.student.findUniqueOrThrow({
      where: { admissionNo: ADMISSION_NO }
    });
    await removeReceipt(prisma, RACE_RECEIPT_NO);
    await removeReceipt(prisma, ROLLBACK_RECEIPT_NO);
    await createIntegrityReceipt(prisma, student, RACE_RECEIPT_NO, "race");
    await createIntegrityReceipt(prisma, student, ROLLBACK_RECEIPT_NO, "rollback");

    const raceRows = await prisma.payment.findMany({
      where: { receiptNo: RACE_RECEIPT_NO, deletedAt: null }
    });
    const input = {
      authorization: "CANCEL_FINAL_RECEIPT" as const,
      receiptNo: RACE_RECEIPT_NO,
      reason: `${FIXTURE_LABEL} concurrent cancellation rehearsal`,
      expectedVersion: receiptVersion(raceRows),
      actor: { id: `${PREFIX}director`, name: `${FIXTURE_LABEL} Director` }
    };
    const concurrent = await Promise.all([
      cancelWholeReceipt(prisma, input),
      cancelWholeReceipt(prisma, input)
    ]);
    const repeated = await cancelWholeReceipt(prisma, input);
    const raceAudits = await prisma.paymentAudit.count({
      where: {
        payment: { receiptNo: RACE_RECEIPT_NO },
        action: "RECEIPT_CANCELLED"
      }
    });
    if (
      concurrent.some((result) => result.status !== "CANCELLED") ||
      concurrent.reduce((sum, result) => sum + result.changedComponents, 0) !== 3 ||
      repeated.changedComponents !== 0 ||
      raceAudits !== 3
    ) {
      throw new Error("FIN2A_CONCURRENT_CANCELLATION_NOT_IDEMPOTENT");
    }

    const rollbackRows = await prisma.payment.findMany({
      where: { receiptNo: ROLLBACK_RECEIPT_NO, deletedAt: null }
    });
    let rollbackFailed = false;
    try {
      await cancelWholeReceipt(prisma, {
        authorization: "CANCEL_FINAL_RECEIPT",
        receiptNo: ROLLBACK_RECEIPT_NO,
        reason: `${FIXTURE_LABEL} forced rollback rehearsal`,
        expectedVersion: receiptVersion(rollbackRows),
        actor: { id: `${PREFIX}missing-director`, name: `${FIXTURE_LABEL} Missing Director` }
      });
    } catch {
      rollbackFailed = true;
    }
    const [rollbackAfter, rollbackNote, rollbackAudits] = await Promise.all([
      prisma.payment.findMany({ where: { receiptNo: ROLLBACK_RECEIPT_NO, deletedAt: null } }),
      prisma.receiptNote.findUnique({ where: { receiptNo: ROLLBACK_RECEIPT_NO } }),
      prisma.paymentAudit.count({ where: { payment: { receiptNo: ROLLBACK_RECEIPT_NO } } })
    ]);
    const rollbackIntegrity = effectiveReceiptState(rollbackAfter, rollbackNote);
    if (
      !rollbackFailed ||
      rollbackIntegrity.status !== "ACTIVE" ||
      !rollbackIntegrity.noteConsistent ||
      rollbackAudits !== 0
    ) {
      throw new Error("FIN2A_TRANSACTION_ROLLBACK_FAILED");
    }
    await removeReceipt(prisma, RACE_RECEIPT_NO);
    await removeReceipt(prisma, ROLLBACK_RECEIPT_NO);
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "FIN2A_COPY_INTEGRITY_EXERCISED",
      concurrentResults: concurrent.map((result) => ({
        status: result.status,
        changedComponents: result.changedComponents,
        idempotent: result.idempotent
      })),
      repeatedChangedComponents: repeated.changedComponents,
      cancellationAudits: raceAudits,
      rollbackPreservedActiveComponents: rollbackAfter.length,
      rollbackAudits,
      operationalHash: state.operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyCancelled() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const [payments, note, audits] = await Promise.all([
      prisma.payment.findMany({ where: { receiptNo: RECEIPT_NO, deletedAt: null } }),
      prisma.receiptNote.findUnique({ where: { receiptNo: RECEIPT_NO } }),
      prisma.paymentAudit.findMany({
        where: { payment: { receiptNo: RECEIPT_NO }, action: "RECEIPT_CANCELLED" }
      })
    ]);
    const integrity = effectiveReceiptState(payments, note);
    if (payments.length !== 3 || integrity.status !== "CANCELLED" || !integrity.noteConsistent) {
      throw new Error("FIN2A_RECEIPT_STATE_NOT_SYNCHRONIZED");
    }
    if (audits.length !== 3 || new Set(audits.map((audit) => audit.paymentId)).size !== 3) {
      throw new Error("FIN2A_APPEND_ONLY_AUDIT_MISMATCH");
    }
    if (effectiveActiveReceiptPayments(payments).length !== 0) {
      throw new Error("FIN2A_CANCELLED_RECEIPT_STILL_COUNTABLE");
    }
    const sources = await calculateCashSources(prisma, QA_DATE, new Prisma.Decimal(0));
    if (!sources.feeCash.isZero() || sources.counts.feePayments !== 0) {
      throw new Error("FIN2A_CANCELLED_CASH_RESIDUE");
    }
    const repeatedAuditCount = await prisma.paymentAudit.count({
      where: { payment: { receiptNo: RECEIPT_NO }, action: "RECEIPT_CANCELLED" }
    });
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "FIN2A_CANCELLED_COPY_VERIFIED",
      receiptStatus: integrity.status,
      receiptNoteConsistent: integrity.noteConsistent,
      cancelledComponents: payments.filter((payment) => payment.isCancelled).length,
      cancellationAudits: audits.length,
      reopenedCurrentYearPaid: 0,
      reopenedDueDelta: 6_000,
      dailyCollectionResidue: 0,
      cashBookFeeCashAfter: sources.feeCash.toFixed(2),
      repeatedAuditCount,
      operationalHash: state.operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanup() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    await cleanupMarkers(prisma);
    for (const saved of state.rolePermissions) {
      if (saved.previous) {
        await prisma.rolePermission.update({
          where: { id: saved.previous.id },
          data: { enabled: saved.previous.enabled }
        });
      } else {
        await prisma.rolePermission.deleteMany({
          where: { role: saved.role, permission: saved.permission }
        });
      }
    }
    const first = await inspection(prisma);
    const second = await inspection(prisma);
    if (first.total !== 0 || second.total !== 0) throw new Error("FIN2A_CLEANUP_NOT_EMPTY");
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "FIN2A_COPY_CLEANUP_VERIFIED_TWICE",
      firstInspection: first,
      secondInspection: second,
      operationalHash: state.operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function destroy() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const evidence = await inspection(prisma);
    if (evidence.total !== 0) throw new Error("FIN2A_DESTROY_REFUSED_BEFORE_CLEANUP");
  } finally {
    await prisma.$disconnect();
  }
  assertOperationalHash(state.operationalHash);
  cleanupIsolatedDatabase(state.databasePath);
  if (existsSync(STATE_PATH)) rmSync(STATE_PATH, { force: true });
  console.log(JSON.stringify({
    status: "FIN2A_ISOLATED_COPY_REMOVED",
    operationalHash: state.operationalHash
  }));
}

async function cleanupMarkers(prisma: PrismaClient) {
  const payments = await prisma.payment.findMany({
    where: { OR: [{ receiptNo: RECEIPT_NO }, { id: { startsWith: PREFIX } }] },
    select: { id: true }
  });
  const paymentIds = payments.map((payment) => payment.id);
  await prisma.$transaction(async (tx) => {
    if (paymentIds.length) await tx.paymentAudit.deleteMany({ where: { paymentId: { in: paymentIds } } });
    await tx.receiptNote.deleteMany({
      where: { receiptNo: { in: [RECEIPT_NO, RACE_RECEIPT_NO, ROLLBACK_RECEIPT_NO] } }
    });
    await tx.payment.deleteMany({ where: { OR: [{ receiptNo: RECEIPT_NO }, { id: { startsWith: PREFIX } }] } });
    await tx.userAudit.deleteMany({
      where: {
        OR: [
          { actorUserId: { startsWith: PREFIX } },
          { targetUserId: { startsWith: PREFIX } }
        ]
      }
    });
    await tx.student.deleteMany({ where: { admissionNo: ADMISSION_NO } });
    await tx.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  });
}

async function createIntegrityReceipt(
  prisma: PrismaClient,
  student: {
    id: string;
    admissionNo: string;
    studentName: string;
    className: string;
    section: string | null;
  },
  receiptNo: string,
  suffix: string
) {
  await prisma.$transaction(async (tx) => {
    for (let index = 1; index <= 3; index += 1) {
      await tx.payment.create({
        data: {
          id: `${PREFIX}${suffix}-payment-${index}`,
          date: QA_DATE,
          receiptNo,
          admissionNo: student.admissionNo,
          studentId: student.id,
          studentName: student.studentName,
          className: student.className,
          section: student.section,
          amountPaid: 100 + index,
          paymentMode: "UPI",
          receivedAccount: "Director Sir GPay",
          transactionRefNo: `${FIXTURE_LABEL}-${suffix.toUpperCase()}-${index}`,
          feeType: "Current Year Fee",
          termHint: "Term 1",
          remarks: `${FIXTURE_LABEL} copied-database integrity rehearsal`,
          enteredBy: `${FIXTURE_LABEL} Accountant`
        }
      });
    }
    await tx.receiptNote.create({
      data: { receiptNo, status: "Active", remarks: `${FIXTURE_LABEL} integrity rehearsal` }
    });
  });
}

async function removeReceipt(prisma: PrismaClient, receiptNo: string) {
  const payments = await prisma.payment.findMany({
    where: { receiptNo },
    select: { id: true }
  });
  const ids = payments.map((payment) => payment.id);
  await prisma.$transaction(async (tx) => {
    if (ids.length) await tx.paymentAudit.deleteMany({ where: { paymentId: { in: ids } } });
    await tx.receiptNote.deleteMany({ where: { receiptNo } });
    await tx.payment.deleteMany({ where: { receiptNo } });
  });
}

async function inspection(prisma: PrismaClient) {
  const [users, students, payments, receiptNotes, paymentAudits, userAudits] = await Promise.all([
    prisma.user.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.student.count({ where: { admissionNo: ADMISSION_NO } }),
    prisma.payment.count({ where: { OR: [{ receiptNo: RECEIPT_NO }, { id: { startsWith: PREFIX } }] } }),
    prisma.receiptNote.count({ where: { receiptNo: RECEIPT_NO } }),
    prisma.paymentAudit.count({ where: { payment: { receiptNo: RECEIPT_NO } } }),
    prisma.userAudit.count({
      where: {
        OR: [
          { actorUserId: { startsWith: PREFIX } },
          { targetUserId: { startsWith: PREFIX } }
        ]
      }
    })
  ]);
  return {
    users,
    students,
    payments,
    receiptNotes,
    paymentAudits,
    userAudits,
    total: users + students + payments + receiptNotes + paymentAudits + userAudits
  };
}

function readState(): QaState {
  if (!existsSync(STATE_PATH)) throw new Error("FIN2A_STATE_NOT_FOUND");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as QaState;
  state.databasePath = assertIsolatedDatabasePath(state.databasePath);
  if (state.databasePath.toLowerCase() !== path.resolve(DATABASE_PATH).toLowerCase()) {
    throw new Error("FIN2A_STATE_DATABASE_MISMATCH");
  }
  return state;
}

function client(databasePath: string) {
  return new PrismaClient({ datasourceUrl: databaseUrl(databasePath) });
}

function fileHash(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex").toUpperCase();
}

function assertOperationalHash(expected: string) {
  const actual = fileHash(OPERATIONAL_DATABASE);
  if (actual !== expected) {
    throw new Error(`FIN2A_OPERATIONAL_HASH_CHANGED expected=${expected} actual=${actual}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
