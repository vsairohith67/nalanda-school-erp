import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { getPendingDues } from "../lib/data";
import { feeRegisterStorageRoot } from "../lib/fee-register-ocr-storage";
import { prisma } from "../lib/prisma";

async function existingFiles(directory: string) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

async function exists(target: string) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const qaBatches = await prisma.feeRegisterOcrBatch.findMany({
    where: {
      OR: [
        { registerName: { contains: "QA20B" } },
        { reviewNotes: { contains: "QA20B" } },
        { approvalNotes: { contains: "QA20B" } },
        { cancellationReason: { contains: "QA20B" } }
      ]
    },
    select: { id: true }
  });
  const batchIds = qaBatches.map((row) => row.id);
  const pages = await prisma.feeRegisterOcrPage.findMany({
    where: { batchId: { in: batchIds } },
    select: { id: true }
  });
  const pageIds = pages.map((row) => row.id);
  const rows = await prisma.feeRegisterOcrRow.findMany({
    where: { pageId: { in: pageIds } },
    select: { id: true, postedPaymentId: true }
  });
  const rowIds = rows.map((row) => row.id);
  const studentIds = (await prisma.student.findMany({
    where: { admissionNo: { startsWith: "QA20B-" } },
    select: { id: true }
  })).map((row) => row.id);

  const allPageKeys = new Set((await prisma.feeRegisterOcrPage.findMany({
    select: { storageKey: true }
  })).map((row) => row.storageKey));
  const storageFiles = await existingFiles(feeRegisterStorageRoot());
  const pending = await getPendingDues({ academicYear: "2026-27", status: "Active" });
  const payments = await prisma.payment.findMany({
    where: { deletedAt: null, isCancelled: false },
    select: { amountPaid: true, receiptNo: true }
  });
  const [misc, expenses, expensePayments, cashDays, cashMovements] = await Promise.all([
    prisma.miscIncomeReceipt.findMany({ select: { status: true, netAmount: true } }),
    prisma.expenseRecord.findMany({ select: { approvalStatus: true, netAmount: true } }),
    prisma.expensePayment.findMany({ select: { amount: true } }),
    prisma.cashBookDay.findMany({ select: { calculatedClosingBalance: true } }),
    prisma.cashBookMovement.findMany({ select: { status: true, amount: true } })
  ]);

  const result = {
    qaCounts: {
      profiles: await prisma.feeRegisterOcrProfile.count({
        where: { OR: [{ profileCode: { contains: "QA20B" } }, { name: { contains: "QA20B" } }] }
      }),
      users: await prisma.user.count({ where: { username: { startsWith: "qa20b-" } } }),
      students: studentIds.length,
      enrollments: await prisma.academicYearEnrollment.count({ where: { studentId: { in: studentIds } } }),
      batches: batchIds.length,
      pages: pageIds.length,
      rows: rowIds.length,
      revisions: await prisma.feeRegisterOcrRowRevision.count({ where: { rowId: { in: rowIds } } }),
      postingRuns: await prisma.feeRegisterOcrPostingRun.count({ where: { batchId: { in: batchIds } } }),
      events: await prisma.feeRegisterOcrEvent.count({ where: { batchId: { in: batchIds } } }),
      linkedPayments: rows.filter((row) => row.postedPaymentId).length,
      payments: await prisma.payment.count({
        where: {
          OR: [
            { receiptNo: { startsWith: "QA20B-" } },
            { remarks: { contains: "QA20B" } },
            { studentId: { in: studentIds } }
          ]
        }
      }),
      receiptNotes: await prisma.receiptNote.count({
        where: { OR: [{ receiptNo: { startsWith: "QA20B-" } }, { remarks: { contains: "QA20B" } }] }
      })
    },
    providerGuards: {
      localOrCloudActive: await prisma.feeRegisterOcrProfile.count({
        where: { providerKind: { in: ["LOCAL_HTTP", "CLOUD_API"] }, status: "ACTIVE" }
      }),
      postingEnabledProfiles: await prisma.feeRegisterOcrProfile.count({
        where: { paymentPostingEnabled: true }
      })
    },
    storage: {
      root: feeRegisterStorageRoot(),
      files: storageFiles,
      orphans: storageFiles.filter((file) => !allPageKeys.has(file)),
      temporaryWorkspaceExists: await exists(path.join(process.cwd(), "tmp", "qa20b")),
      copiedDatabaseExists: await exists(path.join(process.cwd(), "prisma", "qa20b-restore-copy.db"))
    },
    financial: {
      students: await prisma.student.count({ where: { deletedAt: null } }),
      activeEnrollments: await prisma.academicYearEnrollment.count({ where: { status: "ACTIVE" } }),
      payments: payments.length,
      activeCollected: payments.reduce((sum, row) => sum + row.amountPaid, 0),
      distinctReceipts: new Set(payments.map((row) => row.receiptNo)).size,
      receiptNotes: await prisma.receiptNote.count(),
      totalStudentPending: pending.reduce((sum, row) => sum + (row?.totalPending ?? 0), 0),
      feeStructures: await prisma.feeStructure.count(),
      miscIncome: {
        records: misc.length,
        active: misc.filter((row) => row.status === "ACTIVE").length,
        activeNet: misc.filter((row) => row.status === "ACTIVE").reduce((sum, row) => sum + Number(row.netAmount), 0)
      },
      expenses: {
        records: expenses.length,
        notCancelled: expenses.filter((row) => row.approvalStatus !== "CANCELLED").length,
        net: expenses.filter((row) => row.approvalStatus !== "CANCELLED").reduce((sum, row) => sum + Number(row.netAmount), 0),
        payments: expensePayments.length,
        paid: expensePayments.reduce((sum, row) => sum + Number(row.amount), 0)
      },
      cashBook: {
        days: cashDays.length,
        movements: cashMovements.length,
        activeMovements: cashMovements.filter((row) => row.status === "ACTIVE").length,
        activeMovementAmount: cashMovements.filter((row) => row.status === "ACTIVE").reduce((sum, row) => sum + Number(row.amount), 0),
        closingTotal: cashDays.reduce((sum, row) => sum + Number(row.calculatedClosingBalance), 0)
      }
    }
  };

  console.log(JSON.stringify(result, null, 2));
  if (
    Object.values(result.qaCounts).some((count) => count !== 0) ||
    result.providerGuards.localOrCloudActive !== 0 ||
    result.providerGuards.postingEnabledProfiles !== 0 ||
    result.storage.orphans.length !== 0 ||
    result.storage.temporaryWorkspaceExists ||
    result.storage.copiedDatabaseExists
  ) {
    throw new Error("QA20B independent cleanup inspection failed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
