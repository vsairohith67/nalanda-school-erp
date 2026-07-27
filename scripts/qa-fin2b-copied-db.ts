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
import { calculateCashSources, hasSourceDrift } from "../lib/cash-book";
import { allocateFees } from "../lib/fee-allocation";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import {
  cancelWholeReceipt,
  correctFinalReceipt,
  effectiveReceiptState,
  receiptVersion,
  ReceiptLockedDayError
} from "../lib/receipt-integrity";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  assertIsolatedDatabasePath,
  cleanupIsolatedDatabase,
  databaseUrl,
  ensureQaRoot
} from "./migration-isolation";

const PREFIX = "fin2b-";
const MARKER = "FIN2B";
const QA_DATE = new Date("2099-02-01T00:00:00.000Z");
const LOCKED_DATE = new Date("2099-02-02T00:00:00.000Z");
const DATABASE_PATH = path.join(QA_ROOT, "operational-copy", "FIN2B-browser.db");
const STATE_PATH = path.join(QA_ROOT, "operational-copy", "FIN2B-state.json");
const ADMISSION_NO = "FIN2B-STUDENT";
const TARGET_ADMISSION_NO = "FIN2B-STUDENT-CORRECTED";
const PASSWORD_LABEL = "Stored only in the ignored FIN2B runtime state file; not printed";
const RECEIPTS = {
  cancel: "972101",
  nonFinancial: "972102",
  financial: "972103",
  locked: "972104",
  missingLeader: "972105"
} as const;
const ROLES = [
  "SUPER_ADMIN",
  "DIRECTOR",
  "PRINCIPAL",
  "ADMIN",
  "ACCOUNTANT",
  "VIEWER",
  "TEACHER",
  "PARENT"
] as const;

type State = {
  databasePath: string;
  operationalHash: string;
  browserAccessValue: string;
};

async function main() {
  const action = String(process.argv[2] ?? "").toLowerCase();
  if (action === "prepare") return prepare();
  if (action === "exercise") return exercise();
  if (action === "inspect") return inspect();
  if (action === "cleanup") return cleanup();
  if (action === "destroy") return destroy();
  throw new Error("Use prepare, exercise, inspect, cleanup, or destroy");
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
    const fee = await prisma.feeStructure.findFirst({
      where: { active: true },
      orderBy: [{ academicYear: "desc" }, { className: "asc" }]
    });
    if (!fee) throw new Error("FIN2B_COPY_HAS_NO_ACTIVE_FEE_STRUCTURE");
    const browserAccessValue = `${randomBytes(24).toString("base64url")}!Aa9`;
    const passwordHash = await hashPassword(browserAccessValue);
    await prisma.user.updateMany({
      where: {
        role: { in: ["DIRECTOR", "SUPER_ADMIN"] },
        id: { not: { startsWith: PREFIX } }
      },
      data: { isActive: false }
    });
    for (const role of ROLES) {
      await prisma.user.create({
        data: {
          id: `${PREFIX}user-${role.toLowerCase().replaceAll("_", "-")}`,
          name: `${MARKER} ${role.replaceAll("_", " ")}`,
          username: `${PREFIX}${role.toLowerCase().replaceAll("_", "-")}`,
          passwordHash,
          role,
          isActive: true
        }
      });
    }
    await ensureDefaultRolePermissions(prisma);
    const student = await prisma.student.create({
      data: {
        id: `${PREFIX}student`,
        academicYear: fee.academicYear,
        admissionNo: ADMISSION_NO,
        studentName: `${MARKER} Synthetic Student`,
        fatherName: `${MARKER} Synthetic Guardian`,
        phone1: "9000000202",
        className: fee.className,
        section: "QA",
        status: "Active",
        remarks: `${MARKER} copied-database-only fixture`
      }
    });
    await prisma.academicYearEnrollment.create({
      data: {
        id: `${PREFIX}enrollment`,
        studentId: student.id,
        academicYear: fee.academicYear,
        className: fee.className,
        section: "QA",
        status: "ACTIVE",
        enrollmentDate: QA_DATE,
        notes: `${MARKER} copied-database-only fixture`
      }
    });
    const correctedStudent = await prisma.student.create({
      data: {
        id: `${PREFIX}student-corrected`,
        academicYear: fee.academicYear,
        admissionNo: TARGET_ADMISSION_NO,
        studentName: `${MARKER} Corrected Synthetic Student`,
        fatherName: `${MARKER} Corrected Synthetic Guardian`,
        phone1: "9000000203",
        className: fee.className,
        section: "QB",
        status: "Active",
        remarks: `${MARKER} copied-database-only correction target`
      }
    });
    await prisma.academicYearEnrollment.create({
      data: {
        id: `${PREFIX}enrollment-corrected`,
        studentId: correctedStudent.id,
        academicYear: fee.academicYear,
        className: fee.className,
        section: "QB",
        status: "ACTIVE",
        enrollmentDate: QA_DATE,
        notes: `${MARKER} copied-database-only correction target`
      }
    });
    for (const receiptNo of Object.values(RECEIPTS)) {
      await createReceipt(
        prisma,
        student,
        receiptNo,
        receiptNo === RECEIPTS.locked ? LOCKED_DATE : QA_DATE
      );
    }
    await prisma.cashBookDay.create({
      data: {
        id: `${PREFIX}cash-day-draft`,
        cashDate: QA_DATE,
        academicYear: fee.academicYear,
        openingBalance: new Prisma.Decimal(0),
        status: "DRAFT",
        createdByUserId: actor("ACCOUNTANT").id
      }
    });
    const lockedSources = await calculateCashSources(
      prisma,
      LOCKED_DATE,
      new Prisma.Decimal(0)
    );
    await prisma.cashBookDay.create({
      data: {
        id: `${PREFIX}cash-day-locked`,
        cashDate: LOCKED_DATE,
        academicYear: fee.academicYear,
        openingBalance: new Prisma.Decimal(0),
        status: "LOCKED",
        feeCashSnapshot: lockedSources.feeCash,
        miscIncomeCashSnapshot: lockedSources.miscIncomeCash,
        bookSalesCashSnapshot: lockedSources.bookSalesCash,
        cashExpenseSnapshot: lockedSources.cashExpense,
        manualInflowSnapshot: lockedSources.manualInflow,
        manualOutflowSnapshot: lockedSources.manualOutflow,
        bankDepositSnapshot: lockedSources.bankDeposit,
        directorHandoverSnapshot: lockedSources.directorHandover,
        calculatedClosingBalance: lockedSources.expectedClosing,
        countedClosingBalance: lockedSources.expectedClosing,
        varianceAmount: new Prisma.Decimal(0),
        sourceSummarySnapshot: JSON.stringify({
          feeCash: lockedSources.feeCash.toFixed(2),
          miscIncomeCash: lockedSources.miscIncomeCash.toFixed(2),
          bookSalesCash: lockedSources.bookSalesCash.toFixed(2),
          cashExpense: lockedSources.cashExpense.toFixed(2),
          manualInflow: lockedSources.manualInflow.toFixed(2),
          manualOutflow: lockedSources.manualOutflow.toFixed(2),
          bankDeposit: lockedSources.bankDeposit.toFixed(2),
          directorHandover: lockedSources.directorHandover.toFixed(2),
          expectedClosing: lockedSources.expectedClosing.toFixed(2),
          counts: lockedSources.counts
        }),
        createdByUserId: actor("ACCOUNTANT").id,
        approvedByUserId: actor("DIRECTOR").id,
        lockedByUserId: actor("DIRECTOR").id,
        approvedAt: new Date(),
        lockedAt: new Date()
      }
    });
    writeFileSync(
      STATE_PATH,
      JSON.stringify({ databasePath, operationalHash, browserAccessValue } satisfies State, null, 2)
    );
    assertOperationalHash(operationalHash);
    console.log(JSON.stringify({
      status: "FIN2B_COPY_PREPARED",
      databasePath,
      databaseUrl: databaseUrl(databasePath),
      roles: ROLES.map((role) => ({ role, username: `${PREFIX}${role.toLowerCase().replaceAll("_", "-")}` })),
      credentials: PASSWORD_LABEL,
      receipts: RECEIPTS,
      splitComponentsPerReceipt: 3,
      splitTotalPerReceipt: 6_000,
      operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function exercise() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const beforeSources = await calculateCashSources(prisma, QA_DATE, new Prisma.Decimal(0));
    const beforeAllocation = await allocationEvidence(prisma, ADMISSION_NO);
    const beforeTargetAllocation = await allocationEvidence(prisma, TARGET_ADMISSION_NO);

    const cancelRows = await receiptRows(prisma, RECEIPTS.cancel);
    const cancelInput = {
      authorization: "CANCEL_FINAL_RECEIPT" as const,
      receiptNo: RECEIPTS.cancel,
      reason: `${MARKER} verified duplicate final receipt`,
      expectedVersion: receiptVersion(cancelRows),
      actor: actor("ACCOUNTANT")
    };
    const cancelled = await cancelWholeReceipt(prisma, cancelInput);
    const cancelRetry = await cancelWholeReceipt(prisma, cancelInput);

    const nonFinancialRows = await receiptRows(prisma, RECEIPTS.nonFinancial);
    const nonFinancial = await correctFinalReceipt(prisma, {
      authorization: "CORRECT_FINAL_RECEIPT",
      paymentId: nonFinancialRows[1].id,
      payload: {
        date: nonFinancialRows[1].date,
        receiptNo: RECEIPTS.nonFinancial,
        admissionNo: ADMISSION_NO,
        amountPaid: nonFinancialRows[1].amountPaid,
        paymentMode: nonFinancialRows[1].paymentMode,
        receivedAccount: nonFinancialRows[1].receivedAccount,
        transactionRefNo: `${MARKER}-CORRECTED-UPI`,
        feeType: nonFinancialRows[1].feeType,
        termHint: nonFinancialRows[1].termHint,
        remarks: `${MARKER} non-financial correction`
      },
      reason: `${MARKER} verified reference correction`,
      expectedVersion: receiptVersion(nonFinancialRows),
      idempotencyKey: "fin2b-non-financial-001",
      actor: actor("ACCOUNTANT")
    });
    const nonFinancialRetry = await correctFinalReceipt(prisma, {
      authorization: "CORRECT_FINAL_RECEIPT",
      paymentId: nonFinancialRows[1].id,
      payload: {
        date: nonFinancialRows[1].date,
        receiptNo: RECEIPTS.nonFinancial,
        admissionNo: ADMISSION_NO,
        amountPaid: nonFinancialRows[1].amountPaid,
        paymentMode: nonFinancialRows[1].paymentMode,
        receivedAccount: nonFinancialRows[1].receivedAccount,
        transactionRefNo: `${MARKER}-CORRECTED-UPI`,
        feeType: nonFinancialRows[1].feeType,
        termHint: nonFinancialRows[1].termHint,
        remarks: `${MARKER} non-financial correction`
      },
      reason: `${MARKER} verified reference correction`,
      expectedVersion: receiptVersion(nonFinancialRows),
      idempotencyKey: "fin2b-non-financial-001",
      actor: actor("ACCOUNTANT")
    });

    const financialRows = await receiptRows(prisma, RECEIPTS.financial);
    const financial = await correctFinalReceipt(prisma, {
      authorization: "CORRECT_FINAL_RECEIPT",
      paymentId: financialRows[0].id,
      payload: {
        date: financialRows[0].date,
        receiptNo: RECEIPTS.financial,
        admissionNo: TARGET_ADMISSION_NO,
        amountPaid: 1_500,
        paymentMode: financialRows[0].paymentMode,
        receivedAccount: financialRows[0].receivedAccount,
        transactionRefNo: financialRows[0].transactionRefNo,
        feeType: financialRows[0].feeType,
        termHint: financialRows[0].termHint,
        remarks: `${MARKER} financial correction`
      },
      reason: `${MARKER} verified amount correction`,
      expectedVersion: receiptVersion(financialRows),
      idempotencyKey: "fin2b-financial-reissue-001",
      actor: actor("ACCOUNTANT")
    });

    const lockedRows = await receiptRows(prisma, RECEIPTS.locked);
    let lockedBlocked = false;
    try {
      await cancelWholeReceipt(prisma, {
        authorization: "CANCEL_FINAL_RECEIPT",
        receiptNo: RECEIPTS.locked,
        reason: `${MARKER} locked-day review request`,
        expectedVersion: receiptVersion(lockedRows),
        actor: actor("ACCOUNTANT")
      });
    } catch (error) {
      lockedBlocked = error instanceof ReceiptLockedDayError;
    }
    if (!lockedBlocked) throw new Error("FIN2B_LOCKED_DAY_ACCOUNTANT_NOT_BLOCKED");
    const lockedAfterAccountant = await receiptRows(prisma, RECEIPTS.locked);
    if (effectiveReceiptState(lockedAfterAccountant).status !== "ACTIVE") {
      throw new Error("FIN2B_LOCKED_DAY_CHANGED_BY_ACCOUNTANT");
    }
    const directorCorrection = await cancelWholeReceipt(prisma, {
      authorization: "CANCEL_FINAL_RECEIPT",
      receiptNo: RECEIPTS.locked,
      reason: `${MARKER} leadership correction after locked-day review`,
      expectedVersion: receiptVersion(lockedAfterAccountant),
      actor: actor("DIRECTOR")
    });

    await prisma.user.updateMany({
      where: { id: { in: [actor("DIRECTOR").id, actor("SUPER_ADMIN").id] } },
      data: { isActive: false }
    });
    const missingRows = await receiptRows(prisma, RECEIPTS.missingLeader);
    const missingLeadership = await cancelWholeReceipt(prisma, {
      authorization: "CANCEL_FINAL_RECEIPT",
      receiptNo: RECEIPTS.missingLeader,
      reason: `${MARKER} missing leadership warning rehearsal`,
      expectedVersion: receiptVersion(missingRows),
      actor: actor("ACCOUNTANT")
    });
    await prisma.user.updateMany({
      where: { id: { in: [actor("DIRECTOR").id, actor("SUPER_ADMIN").id] } },
      data: { isActive: true }
    });

    const afterSources = await calculateCashSources(prisma, QA_DATE, new Prisma.Decimal(0));
    const afterAllocation = await allocationEvidence(prisma, ADMISSION_NO);
    const afterTargetAllocation = await allocationEvidence(prisma, TARGET_ADMISSION_NO);
    const [campaigns, recipients, warnings, cancelAudits, correctionAudits] = await Promise.all([
      prisma.notificationCampaign.findMany({ where: { campaignNumber: { startsWith: "FIN2B-" } } }),
      prisma.notificationRecipient.findMany({ where: { campaign: { campaignNumber: { startsWith: "FIN2B-" } } } }),
      prisma.notificationEvent.findMany({ where: { campaign: { campaignNumber: { startsWith: "FIN2B-" } }, eventType: "FINANCE_RECEIPT_LEADERSHIP_MISSING" } }),
      prisma.paymentAudit.count({ where: { payment: { receiptNo: RECEIPTS.cancel }, action: "RECEIPT_CANCELLED" } }),
      prisma.paymentAudit.count({ where: { action: { in: ["RECEIPT_CORRECTED", "RECEIPT_SUPERSEDED", "RECEIPT_REISSUED"] }, payment: { id: { startsWith: PREFIX } } } })
    ]);
    const replacementRows = financial.replacementReceiptNo
      ? await receiptRows(prisma, financial.replacementReceiptNo)
      : [];
    const originalFinancial = await receiptRows(prisma, RECEIPTS.financial);
    const lockedDay = await prisma.cashBookDay.findUniqueOrThrow({ where: { id: `${PREFIX}cash-day-locked` } });
    const lockedLive = await calculateCashSources(prisma, LOCKED_DATE, lockedDay.openingBalance, lockedDay.id);

    if (
      cancelled.changedComponents !== 3 ||
      cancelRetry.changedComponents !== 0 ||
      cancelAudits !== 3 ||
      nonFinancial.correctionType !== "NON_FINANCIAL_VERSION" ||
      !nonFinancialRetry.idempotent ||
      financial.correctionType !== "FINANCIAL_REISSUE" ||
      effectiveReceiptState(originalFinancial).status !== "CANCELLED" ||
      effectiveReceiptState(replacementRows).status !== "ACTIVE" ||
      replacementRows.some((row) => row.admissionNo !== TARGET_ADMISSION_NO) ||
      directorCorrection.status !== "CANCELLED" ||
      missingLeadership.leadershipNotification?.missingLeadership !== true ||
      warnings.length !== 1
    ) {
      throw new Error("FIN2B_COPIED_DATABASE_RECONCILIATION_FAILED");
    }
    const unsafeNotification = campaigns.some((campaign) =>
      /guardian|aadhaar|date\s*of\s*birth|medical|password|session/i.test(`${campaign.title} ${campaign.body}`)
    );
    if (unsafeNotification) throw new Error("FIN2B_NOTIFICATION_PRIVACY_ALLOWLIST_FAILED");
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "FIN2B_COPY_EXERCISED",
      cancellation: {
        components: cancelled.componentCount,
        changedOnce: cancelled.changedComponents,
        retryChanged: cancelRetry.changedComponents,
        audits: cancelAudits
      },
      nonFinancialCorrection: {
        type: nonFinancial.correctionType,
        retryIdempotent: nonFinancialRetry.idempotent
      },
      financialCorrection: {
        type: financial.correctionType,
        originalReceipt: financial.originalReceiptNo,
        replacementReceipt: financial.replacementReceiptNo,
        originalStatus: effectiveReceiptState(originalFinancial).status,
        replacementStatus: effectiveReceiptState(replacementRows).status,
        originalTotal: financial.originalTotal,
        replacementTotal: financial.replacementTotal
      },
      reconciliation: {
        cashBefore: beforeSources.feeCash.toFixed(2),
        cashAfter: afterSources.feeCash.toFixed(2),
        paidBefore: beforeAllocation.totalCurrentYearPaid,
        paidAfter: afterAllocation.totalCurrentYearPaid,
        dueBefore: beforeAllocation.totalPending,
        dueAfter: afterAllocation.totalPending,
        correctedStudentPaidBefore: beforeTargetAllocation.totalCurrentYearPaid,
        correctedStudentPaidAfter: afterTargetAllocation.totalCurrentYearPaid,
        correctedStudentDueBefore: beforeTargetAllocation.totalPending,
        correctedStudentDueAfter: afterTargetAllocation.totalPending,
        lockedSnapshotPreserved: lockedDay.status === "LOCKED",
        lockedSourceDrift: hasSourceDrift(lockedDay.sourceSummarySnapshot, lockedLive)
      },
      notifications: {
        campaigns: campaigns.length,
        recipientRows: recipients.length,
        missingLeadershipWarnings: warnings.length,
        unsafeContent: unsafeNotification
      },
      correctionAudits,
      operationalHash: state.operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function inspect() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const evidence = await inspection(prisma);
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({ status: "FIN2B_COPY_INSPECTED", ...evidence, operationalHash: state.operationalHash }));
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanup() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    await cleanupMarkers(prisma);
    const first = await inspection(prisma);
    const second = await inspection(prisma);
    if (first.total !== 0 || second.total !== 0) throw new Error("FIN2B_CLEANUP_NOT_EMPTY");
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "FIN2B_COPY_CLEANUP_VERIFIED_TWICE",
      first,
      second,
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
    if (evidence.total !== 0) throw new Error("FIN2B_DESTROY_REFUSED_BEFORE_CLEANUP");
  } finally {
    await prisma.$disconnect();
  }
  assertOperationalHash(state.operationalHash);
  cleanupIsolatedDatabase(state.databasePath);
  if (existsSync(STATE_PATH)) rmSync(STATE_PATH, { force: true });
  console.log(JSON.stringify({ status: "FIN2B_ISOLATED_COPY_REMOVED", operationalHash: state.operationalHash }));
}

async function createReceipt(
  prisma: PrismaClient,
  student: { id: string; admissionNo: string; studentName: string; className: string; section: string | null },
  receiptNo: string,
  date: Date
) {
  const components = [
    { suffix: "cash", amountPaid: 1_000, paymentMode: "Cash", receivedAccount: "Cash", transactionRefNo: null },
    { suffix: "upi-1", amountPaid: 2_000, paymentMode: "UPI", receivedAccount: "Director Sir GPay", transactionRefNo: `${MARKER}-${receiptNo}-UPI-1` },
    { suffix: "upi-2", amountPaid: 3_000, paymentMode: "UPI", receivedAccount: "NPS Current Account UPI", transactionRefNo: `${MARKER}-${receiptNo}-UPI-2` }
  ];
  for (const component of components) {
    await prisma.payment.create({
      data: {
        id: `${PREFIX}payment-${receiptNo}-${component.suffix}`,
        date,
        receiptNo,
        admissionNo: student.admissionNo,
        studentId: student.id,
        studentName: student.studentName,
        className: student.className,
        section: student.section,
        amountPaid: component.amountPaid,
        paymentMode: component.paymentMode,
        receivedAccount: component.receivedAccount,
        transactionRefNo: component.transactionRefNo,
        feeType: "Current Year Fee",
        termHint: "Term 1",
        remarks: `${MARKER} copied-database split receipt`,
        enteredBy: `${MARKER} Accountant`
      }
    });
  }
  await prisma.receiptNote.create({
    data: { id: `${PREFIX}note-${receiptNo}`, receiptNo, status: "Active", remarks: `${MARKER} active split receipt` }
  });
}

async function allocationEvidence(prisma: PrismaClient, admissionNo: string) {
  const student = await prisma.student.findUniqueOrThrow({ where: { admissionNo } });
  const fee = await prisma.feeStructure.findUniqueOrThrow({
    where: { academicYear_className: { academicYear: student.academicYear, className: student.className } }
  });
  const payments = await prisma.payment.findMany({
    where: { admissionNo, deletedAt: null },
    orderBy: { date: "asc" }
  });
  return allocateFees(student, fee, payments);
}

function actor(role: typeof ROLES[number]) {
  return {
    id: `${PREFIX}user-${role.toLowerCase().replaceAll("_", "-")}`,
    name: `${MARKER} ${role.replaceAll("_", " ")}`,
    role
  };
}

function receiptRows(prisma: PrismaClient, receiptNo: string) {
  return prisma.payment.findMany({
    where: { receiptNo, deletedAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });
}

async function cleanupMarkers(prisma: PrismaClient) {
  const campaigns = await prisma.notificationCampaign.findMany({
    where: { campaignNumber: { startsWith: "FIN2B-" } },
    select: { id: true }
  });
  const campaignIds = campaigns.map((row) => row.id);
  const payments = await prisma.payment.findMany({
    where: {
      OR: [
        { id: { startsWith: PREFIX } },
        { receiptNo: { startsWith: "97210" } }
      ]
    },
    select: { id: true }
  });
  const paymentIds = payments.map((row) => row.id);
  await prisma.$transaction(async (tx) => {
    if (campaignIds.length) {
      await tx.notificationEvent.deleteMany({ where: { campaignId: { in: campaignIds } } });
      await tx.notificationRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } });
      await tx.notificationSkippedRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } });
      await tx.notificationCampaign.deleteMany({ where: { id: { in: campaignIds } } });
    }
    if (paymentIds.length) await tx.paymentAudit.deleteMany({ where: { paymentId: { in: paymentIds } } });
    await tx.receiptNote.deleteMany({ where: { OR: [{ id: { startsWith: PREFIX } }, { receiptNo: { startsWith: "97210" } }] } });
    await tx.payment.deleteMany({
      where: {
        OR: [
          { id: { startsWith: PREFIX } },
          { receiptNo: { startsWith: "97210" } }
        ]
      }
    });
    await tx.cashBookMovement.deleteMany({ where: { cashBookDayId: { startsWith: PREFIX } } });
    await tx.cashBookDay.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await tx.studentLifecycleEvent.deleteMany({ where: { studentId: { startsWith: PREFIX } } });
    await tx.academicYearEnrollment.deleteMany({ where: { studentId: { startsWith: PREFIX } } });
    await tx.student.deleteMany({ where: { id: { startsWith: PREFIX } } });
    await tx.userAudit.deleteMany({
      where: {
        OR: [{ actorUserId: { startsWith: PREFIX } }, { targetUserId: { startsWith: PREFIX } }]
      }
    });
    await tx.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  });
}

async function inspection(prisma: PrismaClient) {
  const [
    users,
    students,
    enrollments,
    payments,
    notes,
    audits,
    cashDays,
    campaigns,
    recipients,
    events
  ] = await Promise.all([
    prisma.user.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.student.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.academicYearEnrollment.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.payment.count({
      where: {
        OR: [
          { id: { startsWith: PREFIX } },
          { receiptNo: { startsWith: "97210" } }
        ]
      }
    }),
    prisma.receiptNote.count({ where: { OR: [{ id: { startsWith: PREFIX } }, { receiptNo: { startsWith: "97210" } }] } }),
    prisma.paymentAudit.count({
      where: {
        payment: {
          OR: [
            { id: { startsWith: PREFIX } },
            { receiptNo: { startsWith: "97210" } }
          ]
        }
      }
    }),
    prisma.cashBookDay.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.notificationCampaign.count({ where: { campaignNumber: { startsWith: "FIN2B-" } } }),
    prisma.notificationRecipient.count({ where: { campaign: { campaignNumber: { startsWith: "FIN2B-" } } } }),
    prisma.notificationEvent.count({ where: { campaign: { campaignNumber: { startsWith: "FIN2B-" } } } })
  ]);
  return {
    users,
    students,
    enrollments,
    payments,
    notes,
    audits,
    cashDays,
    campaigns,
    recipients,
    events,
    total: users + students + enrollments + payments + notes + audits + cashDays + campaigns + recipients + events
  };
}

function readState(): State {
  if (!existsSync(STATE_PATH)) throw new Error("FIN2B_STATE_NOT_FOUND");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as State;
  state.databasePath = assertIsolatedDatabasePath(state.databasePath);
  if (state.databasePath.toLowerCase() !== path.resolve(DATABASE_PATH).toLowerCase()) {
    throw new Error("FIN2B_STATE_DATABASE_MISMATCH");
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
    throw new Error(`FIN2B_OPERATIONAL_HASH_CHANGED expected=${expected} actual=${actual}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
