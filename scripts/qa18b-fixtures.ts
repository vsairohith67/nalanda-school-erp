import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { defaultTemplateDefinition } from "../lib/certificate-templates";
import { snapshotHash } from "../lib/certificate-snapshots";

const MARKER = "QA18B";
const ID_PREFIX = "qa18b-";
const YEAR = "2026-27";
const PASSWORD = "Qa18bDocs@2026";

async function packageIds() {
  return (await prisma.classXDocumentPackage.findMany({
    where: {
      OR: [
        { packageNumber: { startsWith: `${MARKER}-` } },
        { purpose: { contains: MARKER } },
        { student: { admissionNo: { startsWith: `${MARKER}-` } } }
      ]
    },
    select: { id: true }
  })).map((row) => row.id);
}

async function certificateIds() {
  return (await prisma.studentCertificate.findMany({
    where: {
      OR: [
        { certificateNumber: { startsWith: `${MARKER}/` } },
        { studentId: { startsWith: ID_PREFIX } }
      ]
    },
    select: { id: true }
  })).map((row) => row.id);
}

async function cleanup() {
  const packages = await packageIds();
  const charges = await prisma.classXPackageCharge.findMany({
    where: { packageId: { in: packages } },
    select: { id: true, linkedMiscIncomeReceiptId: true }
  });
  const receipts = charges.flatMap((row) => row.linkedMiscIncomeReceiptId ? [row.linkedMiscIncomeReceiptId] : []);
  await prisma.classXPackageEvent.deleteMany({ where: { packageId: { in: packages } } });
  await prisma.classXPackageHandover.deleteMany({ where: { packageId: { in: packages } } });
  await prisma.classXPackageDocumentItem.deleteMany({ where: { packageId: { in: packages } } });
  await prisma.classXPackageCharge.deleteMany({ where: { packageId: { in: packages } } });
  await prisma.classXDocumentPackage.deleteMany({ where: { id: { in: packages } } });
  await prisma.classXPackageTemplate.deleteMany({ where: { templateCode: { startsWith: MARKER } } });
  await prisma.classXPackageChargeRule.deleteMany({ where: { ruleCode: { startsWith: MARKER } } });
  await prisma.miscIncomeReceiptLine.deleteMany({ where: { receiptId: { in: receipts } } });
  await prisma.miscIncomeReceipt.deleteMany({
    where: {
      OR: [
        { id: { in: receipts } },
        { payerName: { startsWith: MARKER } },
        { remarks: { contains: MARKER } }
      ]
    }
  });

  const certificates = await certificateIds();
  await prisma.studentCertificateEvent.deleteMany({ where: { certificateId: { in: certificates } } });
  await prisma.studentCertificateVersion.deleteMany({ where: { certificateId: { in: certificates } } });
  await prisma.studentCertificate.deleteMany({ where: { id: { in: certificates } } });
  await prisma.certificateTemplate.deleteMany({ where: { templateCode: { startsWith: MARKER } } });
  await prisma.academicYearEnrollment.deleteMany({ where: { studentId: { startsWith: ID_PREFIX } } });
  await prisma.studentGuardian.deleteMany({
    where: {
      OR: [
        { studentId: { startsWith: ID_PREFIX } },
        { guardian: { displayName: { startsWith: MARKER } } }
      ]
    }
  });
  await prisma.user.deleteMany({ where: { username: { startsWith: ID_PREFIX } } });
  await prisma.guardian.deleteMany({ where: { displayName: { startsWith: MARKER } } });
  await prisma.student.deleteMany({ where: { admissionNo: { startsWith: `${MARKER}-` } } });
}

async function createIssuedCertificate(input: {
  id: string;
  studentId: string;
  certificateType: "TRANSFER" | "STUDY" | "CONDUCT";
  number: string;
  status?: string;
}) {
  const templateId = `${ID_PREFIX}certificate-template-${input.certificateType.toLowerCase()}`;
  const snapshot = {
    schemaVersion: 1,
    certificateType: input.certificateType,
    academicYear: YEAR,
    purpose: `${MARKER} Class X package link fixture`,
    certificateNumber: input.number,
    issueStatus: input.status ?? "ISSUED",
    template: {
      code: `${MARKER}-${input.certificateType}-T`,
      versionNumber: 1,
      definition: defaultTemplateDefinition(input.certificateType)
    },
    digitalSignature: false
  };
  const certificate = await prisma.studentCertificate.create({
    data: {
      id: input.id,
      studentId: input.studentId,
      academicYear: YEAR,
      certificateType: input.certificateType,
      templateId,
      certificateNumber: input.number,
      status: input.status ?? "ISSUED",
      currentVersionNumber: 1,
      draftDataJson: JSON.stringify(snapshot),
      issuePurpose: `${MARKER} Class X package link fixture`,
      issuedAt: new Date()
    }
  });
  await prisma.studentCertificateVersion.create({
    data: {
      id: `${input.id}-v1`,
      certificateId: certificate.id,
      versionNumber: 1,
      versionType: "ORIGINAL",
      certificateNumber: input.number,
      snapshotJson: JSON.stringify(snapshot),
      issuedAt: new Date(),
      snapshotHash: snapshotHash(snapshot)
    }
  });
  return certificate;
}

async function setup() {
  await cleanup();
  const incomeItem = await prisma.miscIncomeItem.findUnique({ where: { itemCode: "CLASS-X-CERT" } });
  if (!incomeItem || incomeItem.status !== "ACTIVE" || incomeItem.studentLinkPolicy !== "REQUIRED") {
    throw new Error("QA18B requires the existing active CLASS-X-CERT Miscellaneous Income item with required Student linkage.");
  }
  const passwordHash = await hashPassword(PASSWORD);
  const linkedGuardian = await prisma.guardian.create({
    data: { id: `${ID_PREFIX}guardian-linked`, displayName: `${MARKER} Linked Guardian`, primaryMobile: "9000001818", relationship: "Parent" }
  });
  const unrelatedGuardian = await prisma.guardian.create({
    data: { id: `${ID_PREFIX}guardian-unrelated`, displayName: `${MARKER} Unrelated Guardian`, primaryMobile: "9000001819", relationship: "Parent" }
  });
  const roles = ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "ACCOUNTANT", "VIEWER", "TEACHER"] as const;
  for (const role of roles) {
    await prisma.user.create({
      data: {
        id: `${ID_PREFIX}user-${role.toLowerCase().replaceAll("_", "-")}`,
        name: `${MARKER} ${role}`,
        username: `${ID_PREFIX}${role.toLowerCase().replaceAll("_", "-")}`,
        passwordHash,
        role
      }
    });
  }
  await prisma.user.createMany({
    data: [
      { id: `${ID_PREFIX}user-parent`, name: `${MARKER} Linked Parent`, username: `${ID_PREFIX}parent`, passwordHash, role: "PARENT", guardianId: linkedGuardian.id },
      { id: `${ID_PREFIX}user-parent-unrelated`, name: `${MARKER} Unrelated Parent`, username: `${ID_PREFIX}parent-unrelated`, passwordHash, role: "PARENT", guardianId: unrelatedGuardian.id }
    ]
  });

  const linkedStudent = await prisma.student.create({
    data: {
      id: `${ID_PREFIX}student-linked`,
      admissionNo: `${MARKER}-ADM-001`,
      studentName: `${MARKER} Linked Class X Student`,
      fatherName: `${MARKER} Father`,
      motherName: `${MARKER} Mother`,
      className: "Class X",
      section: "A",
      phone1: "9000001801",
      dateOfBirth: new Date("2010-05-10"),
      status: "Active"
    }
  });
  const unrelatedStudent = await prisma.student.create({
    data: {
      id: `${ID_PREFIX}student-unrelated`,
      admissionNo: `${MARKER}-ADM-002`,
      studentName: `${MARKER} Unrelated Class X Student`,
      fatherName: `${MARKER} Other Father`,
      className: "Class X",
      section: "B",
      phone1: "9000001802",
      dateOfBirth: new Date("2010-04-11"),
      status: "Active"
    }
  });
  await prisma.studentGuardian.createMany({
    data: [
      { id: `${ID_PREFIX}link-linked`, guardianId: linkedGuardian.id, studentId: linkedStudent.id, relationshipToStudent: "Parent", isPrimaryContact: true },
      { id: `${ID_PREFIX}link-unrelated`, guardianId: unrelatedGuardian.id, studentId: unrelatedStudent.id, relationshipToStudent: "Parent", isPrimaryContact: true }
    ]
  });
  await prisma.academicYearEnrollment.createMany({
    data: [
      { id: `${ID_PREFIX}enrollment-linked`, studentId: linkedStudent.id, academicYear: YEAR, className: "Class X", section: "A", status: "ACTIVE", enrollmentDate: new Date("2026-06-01") },
      { id: `${ID_PREFIX}enrollment-unrelated`, studentId: unrelatedStudent.id, academicYear: YEAR, className: "Class X", section: "B", status: "ACTIVE", enrollmentDate: new Date("2026-06-01") }
    ]
  });

  for (const type of ["TRANSFER", "STUDY", "CONDUCT"] as const) {
    await prisma.certificateTemplate.create({
      data: {
        id: `${ID_PREFIX}certificate-template-${type.toLowerCase()}`,
        templateCode: `${MARKER}-${type}-T`,
        certificateType: type,
        name: `${MARKER} ${type} Certificate Template`,
        academicYear: YEAR,
        status: "ACTIVE",
        versionNumber: 1,
        templateDefinitionJson: JSON.stringify(defaultTemplateDefinition(type))
      }
    });
  }
  await createIssuedCertificate({ id: `${ID_PREFIX}cert-transfer`, studentId: linkedStudent.id, certificateType: "TRANSFER", number: `${MARKER}/TC/0001` });
  await createIssuedCertificate({ id: `${ID_PREFIX}cert-study`, studentId: linkedStudent.id, certificateType: "STUDY", number: `${MARKER}/STU/0001` });
  await createIssuedCertificate({ id: `${ID_PREFIX}cert-conduct`, studentId: linkedStudent.id, certificateType: "CONDUCT", number: `${MARKER}/CON/0001` });
  await createIssuedCertificate({ id: `${ID_PREFIX}cert-wrong-student`, studentId: unrelatedStudent.id, certificateType: "TRANSFER", number: `${MARKER}/TC/OTHER` });
  await createIssuedCertificate({ id: `${ID_PREFIX}cert-cancelled`, studentId: linkedStudent.id, certificateType: "TRANSFER", number: `${MARKER}/TC/CANCELLED`, status: "CANCELLED" });

  console.log(JSON.stringify({
    status: `${MARKER} fixtures created`,
    password: PASSWORD,
    users: [`${ID_PREFIX}super-admin`, `${ID_PREFIX}director`, `${ID_PREFIX}principal`, `${ID_PREFIX}admin`, `${ID_PREFIX}accountant`, `${ID_PREFIX}viewer`, `${ID_PREFIX}teacher`, `${ID_PREFIX}parent`, `${ID_PREFIX}parent-unrelated`],
    linkedStudent: linkedStudent.admissionNo,
    unrelatedStudent: unrelatedStudent.admissionNo
  }, null, 2));
}

async function inspect() {
  const packages = await packageIds();
  const certificates = await certificateIds();
  const counts = {
    classXPackageTemplates: await prisma.classXPackageTemplate.count({ where: { templateCode: { startsWith: MARKER } } }),
    classXPackageChargeRules: await prisma.classXPackageChargeRule.count({ where: { ruleCode: { startsWith: MARKER } } }),
    classXDocumentPackages: packages.length,
    classXPackageDocumentItems: await prisma.classXPackageDocumentItem.count({ where: { packageId: { in: packages } } }),
    classXPackageCharges: await prisma.classXPackageCharge.count({ where: { packageId: { in: packages } } }),
    classXPackageHandovers: await prisma.classXPackageHandover.count({ where: { packageId: { in: packages } } }),
    classXPackageEvents: await prisma.classXPackageEvent.count({ where: { packageId: { in: packages } } }),
    miscIncomeReceipts: await prisma.miscIncomeReceipt.count({ where: { OR: [{ payerName: { startsWith: MARKER } }, { remarks: { contains: MARKER } }] } }),
    certificateTemplates: await prisma.certificateTemplate.count({ where: { templateCode: { startsWith: MARKER } } }),
    certificates: certificates.length,
    certificateVersions: await prisma.studentCertificateVersion.count({ where: { certificateId: { in: certificates } } }),
    students: await prisma.student.count({ where: { admissionNo: { startsWith: `${MARKER}-` } } }),
    enrollments: await prisma.academicYearEnrollment.count({ where: { studentId: { startsWith: ID_PREFIX } } }),
    guardians: await prisma.guardian.count({ where: { displayName: { startsWith: MARKER } } }),
    users: await prisma.user.count({ where: { username: { startsWith: ID_PREFIX } } })
  };
  console.log(JSON.stringify({ marker: MARKER, counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0) }, null, 2));
  return counts;
}

async function finance() {
  const [misc, fee, movements] = await Promise.all([
    prisma.miscIncomeReceipt.aggregate({ where: { status: "ACTIVE", NOT: { OR: [{ payerName: { startsWith: MARKER } }, { remarks: { contains: MARKER } }] } }, _count: true, _sum: { netAmount: true } }),
    prisma.payment.aggregate({ where: { isCancelled: false, student: { admissionNo: { not: { startsWith: `${MARKER}-` } } } }, _count: true, _sum: { amountPaid: true } }),
    prisma.cashBookMovement.aggregate({ where: { notes: { not: { contains: MARKER } } }, _count: true, _sum: { amount: true } })
  ]);
  console.log(JSON.stringify({
    realFinance: {
      activeMiscReceiptCount: misc._count,
      activeMiscReceiptTotal: misc._sum.netAmount?.toFixed(2) ?? "0.00",
      activeFeePaymentCount: fee._count,
      activeFeePaymentTotal: fee._sum.amountPaid?.toFixed(2) ?? "0.00",
      cashMovementCount: movements._count,
      cashMovementTotal: movements._sum.amount?.toFixed(2) ?? "0.00"
    }
  }, null, 2));
}

async function invariants() {
  const studentIds = (await prisma.student.findMany({ where: { admissionNo: { startsWith: `${MARKER}-` } }, select: { id: true } })).map((row) => row.id);
  console.log(JSON.stringify({
    lifecycleEvents: await prisma.studentLifecycleEvent.count({ where: { studentId: { in: studentIds } } }),
    progressionDecisions: await prisma.studentProgressionDecision.count({ where: { studentId: { in: studentIds } } }),
    marks: await prisma.studentMark.count({ where: { studentId: { in: studentIds } } }),
    reportCards: await prisma.studentReportCard.count({ where: { studentId: { in: studentIds } } }),
    feePayments: await prisma.payment.count({ where: { studentId: { in: studentIds } } })
  }, null, 2));
}

async function main() {
  const action = process.argv[2];
  if (action === "setup") await setup();
  else if (action === "cleanup") { await cleanup(); await inspect(); }
  else if (action === "inspect") await inspect();
  else if (action === "finance") await finance();
  else if (action === "invariants") await invariants();
  else throw new Error("Use: pnpm exec tsx scripts/qa18b-fixtures.ts setup|cleanup|inspect|finance|invariants");
}

main().finally(() => prisma.$disconnect());
