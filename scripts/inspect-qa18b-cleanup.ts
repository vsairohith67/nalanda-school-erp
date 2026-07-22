import { prisma } from "../lib/prisma";

const marker = "QA18B";

async function main() {
  const packages = await prisma.classXDocumentPackage.findMany({
    where: {
      OR: [
        { packageNumber: { startsWith: `${marker}-` } },
        { purpose: { contains: marker } },
        { student: { admissionNo: { startsWith: `${marker}-` } } }
      ]
    },
    select: { id: true }
  });
  const packageIds = packages.map((row) => row.id);
  const certificates = await prisma.studentCertificate.findMany({
    where: { OR: [{ certificateNumber: { startsWith: `${marker}/` } }, { studentId: { startsWith: "qa18b-" } }] },
    select: { id: true }
  });
  const certificateIds = certificates.map((row) => row.id);
  const counts = {
    classXPackageTemplates: await prisma.classXPackageTemplate.count({ where: { templateCode: { startsWith: marker } } }),
    classXPackageChargeRules: await prisma.classXPackageChargeRule.count({ where: { ruleCode: { startsWith: marker } } }),
    classXDocumentPackages: packages.length,
    classXPackageDocumentItems: await prisma.classXPackageDocumentItem.count({ where: { packageId: { in: packageIds } } }),
    classXPackageCharges: await prisma.classXPackageCharge.count({ where: { packageId: { in: packageIds } } }),
    classXPackageHandovers: await prisma.classXPackageHandover.count({ where: { packageId: { in: packageIds } } }),
    classXPackageEvents: await prisma.classXPackageEvent.count({ where: { packageId: { in: packageIds } } }),
    miscIncomeReceipts: await prisma.miscIncomeReceipt.count({ where: { OR: [{ payerName: { startsWith: marker } }, { remarks: { contains: marker } }] } }),
    certificateTemplates: await prisma.certificateTemplate.count({ where: { templateCode: { startsWith: marker } } }),
    certificates: certificates.length,
    certificateVersions: await prisma.studentCertificateVersion.count({ where: { certificateId: { in: certificateIds } } }),
    students: await prisma.student.count({ where: { admissionNo: { startsWith: `${marker}-` } } }),
    enrollments: await prisma.academicYearEnrollment.count({ where: { studentId: { startsWith: "qa18b-" } } }),
    guardians: await prisma.guardian.count({ where: { displayName: { startsWith: marker } } }),
    users: await prisma.user.count({ where: { username: { startsWith: "qa18b-" } } })
  };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  console.log(JSON.stringify({ marker, counts, total }, null, 2));
  if (total !== 0) throw new Error(`Independent QA18B cleanup audit found ${total} remaining rows.`);
}

main().finally(() => prisma.$disconnect());
