import { ensureFeeRegisterOcrFoundation } from "../lib/fee-register-ocr";
import { feeRegisterStorageRoot, purgeRegisterImage } from "../lib/fee-register-ocr-storage";
import { hashPassword } from "../lib/password";
import { prisma } from "../lib/prisma";
import { readdir } from "node:fs/promises";

const MARKER = "QA20B";
const USER_PREFIX = "qa20b-";
const PASSWORD = "Qa20bRegister@2026";
const ADMISSIONS = ["QA20B-001", "QA20B-002", "QA20B-003"];

async function ocrBatchIds() {
  return (await prisma.feeRegisterOcrBatch.findMany({
    where: { registerName: { startsWith: MARKER } },
    select: { id: true }
  })).map((row) => row.id);
}

async function cleanup() {
  const batchIds = await ocrBatchIds();
  const pages = await prisma.feeRegisterOcrPage.findMany({
    where: { batchId: { in: batchIds } },
    select: { id: true, storageKey: true, status: true }
  });
  for (const page of pages) {
    if (page.status !== "PURGED") await purgeRegisterImage(page.storageKey).catch(() => false);
  }
  const pageIds = pages.map((page) => page.id);
  const rowIds = (await prisma.feeRegisterOcrRow.findMany({
    where: { pageId: { in: pageIds } },
    select: { id: true }
  })).map((row) => row.id);
  const runIds = (await prisma.feeRegisterOcrPostingRun.findMany({
    where: { batchId: { in: batchIds } },
    select: { id: true }
  })).map((row) => row.id);

  await prisma.feeRegisterOcrEvent.deleteMany({
    where: { OR: [{ batchId: { in: batchIds } }, { pageId: { in: pageIds } }, { rowId: { in: rowIds } }, { postingRunId: { in: runIds } }] }
  });
  await prisma.feeRegisterOcrRowRevision.deleteMany({ where: { rowId: { in: rowIds } } });
  await prisma.feeRegisterOcrPostingRun.deleteMany({ where: { id: { in: runIds } } });
  await prisma.feeRegisterOcrRow.deleteMany({ where: { id: { in: rowIds } } });
  await prisma.feeRegisterOcrPage.deleteMany({ where: { id: { in: pageIds } } });
  await prisma.feeRegisterOcrBatch.deleteMany({ where: { id: { in: batchIds } } });

  const qaPayments = await prisma.payment.findMany({
    where: {
      OR: [
        { admissionNo: { startsWith: MARKER } },
        { receiptNo: { startsWith: MARKER } },
        { remarks: { contains: MARKER } }
      ]
    },
    select: { id: true }
  });
  const paymentIds = qaPayments.map((row) => row.id);
  await prisma.paymentAudit.deleteMany({ where: { paymentId: { in: paymentIds } } });
  await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
  await prisma.receiptNote.deleteMany({ where: { receiptNo: { startsWith: MARKER } } });

  const studentIds = (await prisma.student.findMany({
    where: { admissionNo: { in: ADMISSIONS } },
    select: { id: true }
  })).map((row) => row.id);
  await prisma.academicYearEnrollment.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.studentLifecycleEvent.deleteMany({ where: { studentId: { in: studentIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: USER_PREFIX } } });
  await prisma.feeRegisterOcrProfile.deleteMany({ where: { profileCode: { startsWith: MARKER } } });

  await ensureFeeRegisterOcrFoundation(prisma);
}

async function setup() {
  await cleanup();
  await prisma.rolePermission.upsert({
    where: { role_permission: { role: "VIEWER", permission: "VIEW_FEE_REGISTER_OCR" } },
    update: { enabled: false },
    create: { role: "VIEWER", permission: "VIEW_FEE_REGISTER_OCR", enabled: false }
  });
  const passwordHash = await hashPassword(PASSWORD);
  for (const role of ["DIRECTOR", "PRINCIPAL", "ADMIN", "VIEWER", "ACCOUNTANT", "TEACHER", "PARENT"]) {
    const slug = role.toLowerCase().replace("_", "-");
    await prisma.user.create({
      data: {
        id: `${USER_PREFIX}user-${slug}`,
        name: `${MARKER} ${role.replace("_", " ")}`,
        username: `${USER_PREFIX}${slug}`,
        passwordHash,
        role,
        isActive: true
      }
    });
  }

  const students = [
    { admissionNo: "QA20B-001", studentName: "QA20B Student One", rollNo: "20B1" },
    { admissionNo: "QA20B-002", studentName: "QA20B Duplicate Name", rollNo: "20B2" },
    { admissionNo: "QA20B-003", studentName: "QA20B Duplicate Name", rollNo: "20B3" }
  ];
  for (const student of students) {
    const created = await prisma.student.create({
      data: {
        ...student,
        academicYear: "2026-27",
        fatherName: `${MARKER} Parent`,
        className: "VI",
        section: "A",
        phone1: "9000000020",
        remarks: `${MARKER} synthetic OCR fixture`
      }
    });
    await prisma.academicYearEnrollment.create({
      data: {
        studentId: created.id,
        academicYear: "2026-27",
        className: "VI",
        section: "A",
        rollNo: student.rollNo,
        status: "ACTIVE",
        notes: `${MARKER} synthetic OCR fixture`
      }
    });
  }

  console.log(JSON.stringify({
    marker: MARKER,
    usernames: ["director", "principal", "admin", "viewer", "accountant", "teacher", "parent"]
      .map((role) => `${USER_PREFIX}${role}`),
    password: PASSWORD,
    admissions: ADMISSIONS,
    postingEnabled: false,
    externalProvidersEnabled: false
  }, null, 2));
}

async function businessTotals() {
  const payments = await prisma.payment.findMany({ where: { deletedAt: null, isCancelled: false }, select: { amountPaid: true } });
  return {
    students: await prisma.student.count(),
    activeEnrollments: await prisma.academicYearEnrollment.count({ where: { status: "ACTIVE" } }),
    payments: await prisma.payment.count(),
    activeCollected: payments.reduce((sum, row) => sum + row.amountPaid, 0)
  };
}

async function inspect() {
  const batchIds = await ocrBatchIds();
  const pageIds = (await prisma.feeRegisterOcrPage.findMany({ where: { batchId: { in: batchIds } }, select: { id: true } })).map((row) => row.id);
  const runIds = (await prisma.feeRegisterOcrPostingRun.findMany({ where: { batchId: { in: batchIds } }, select: { id: true } })).map((row) => row.id);
  const allStorageKeys = new Set((await prisma.feeRegisterOcrPage.findMany({ select: { storageKey: true } })).map((row) => row.storageKey));
  const privateFiles = await readdir(feeRegisterStorageRoot()).catch(() => [] as string[]);
  console.log(JSON.stringify({
    profiles: await prisma.feeRegisterOcrProfile.count({ where: { profileCode: { startsWith: MARKER } } }),
    users: await prisma.user.count({ where: { username: { startsWith: USER_PREFIX } } }),
    students: await prisma.student.count({ where: { admissionNo: { in: ADMISSIONS } } }),
    enrollments: await prisma.academicYearEnrollment.count({ where: { student: { admissionNo: { in: ADMISSIONS } } } }),
    batches: batchIds.length,
    pages: pageIds.length,
    rows: await prisma.feeRegisterOcrRow.count({ where: { pageId: { in: pageIds } } }),
    revisions: await prisma.feeRegisterOcrRowRevision.count({ where: { row: { pageId: { in: pageIds } } } }),
    postingRuns: runIds.length,
    events: await prisma.feeRegisterOcrEvent.count({
      where: { OR: [{ batchId: { in: batchIds } }, { pageId: { in: pageIds } }, { postingRunId: { in: runIds } }] }
    }),
    linkedPayments: await prisma.feeRegisterOcrRow.count({ where: { pageId: { in: pageIds }, postedPaymentId: { not: null } } }),
    payments: await prisma.payment.count({
      where: { OR: [{ admissionNo: { startsWith: MARKER } }, { receiptNo: { startsWith: MARKER } }, { remarks: { contains: MARKER } }] }
    }),
    receipts: await prisma.receiptNote.count({ where: { receiptNo: { startsWith: MARKER } } }),
    privateSourceFiles: privateFiles.length,
    orphanSourceFiles: privateFiles.filter((key) => !allStorageKeys.has(key)).length,
    localOrCloudActive: await prisma.feeRegisterOcrProfile.count({
      where: { providerKind: { in: ["LOCAL_HTTP", "CLOUD_API"] }, status: "ACTIVE" }
    }),
    postingEnabledProfiles: await prisma.feeRegisterOcrProfile.count({ where: { paymentPostingEnabled: true } }),
    businessTotals: await businessTotals()
  }, null, 2));
}

async function main() {
  const action = process.argv[2];
  if (action === "setup") await setup();
  else if (action === "cleanup") {
    await cleanup();
    await inspect();
  } else if (action === "inspect") await inspect();
  else throw new Error("Use setup, cleanup, or inspect.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
