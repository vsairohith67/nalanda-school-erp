import { prisma } from "../lib/prisma";

const marker = "QA18A";

async function main() {
  const requests = await prisma.studentCertificateRequest.findMany({
    where: {
      OR: [
        { requestNumber: { startsWith: marker } },
        { purpose: { contains: marker } },
        { studentId: { startsWith: "qa18a-" } }
      ]
    },
    select: { id: true }
  });
  const certificates = await prisma.studentCertificate.findMany({
    where: {
      OR: [
        { certificateNumber: { startsWith: marker } },
        { draftDataJson: { contains: marker } }
      ]
    },
    select: { id: true }
  });
  const requestIds = requests.map(row => row.id);
  const certificateIds = certificates.map(row => row.id);
  const counts = {
    certificateNumberSeries: await prisma.certificateNumberSeries.count({ where: { seriesCode: { startsWith: marker } } }),
    certificateTemplates: await prisma.certificateTemplate.count({ where: { templateCode: { startsWith: marker } } }),
    certificateRequests: requests.length,
    studentCertificates: certificates.length,
    certificateVersions: await prisma.studentCertificateVersion.count({ where: { certificateId: { in: certificateIds } } }),
    certificateEvents: await prisma.studentCertificateEvent.count({
      where: {
        OR: [
          { requestId: { in: requestIds } },
          { certificateId: { in: certificateIds } },
          { reason: { contains: marker } },
          { notes: { contains: marker } }
        ]
      }
    }),
    students: await prisma.student.count({ where: { admissionNo: { startsWith: marker } } }),
    guardians: await prisma.guardian.count({ where: { displayName: { startsWith: marker } } }),
    users: await prisma.user.count({ where: { username: { startsWith: "qa18a-" } } }),
    enrollments: await prisma.academicYearEnrollment.count({ where: { studentId: { startsWith: "qa18a-" } } }),
    progressionDecisions: await prisma.studentProgressionDecision.count({ where: { studentId: { startsWith: "qa18a-" } } }),
    attendanceRecords: await prisma.studentAttendanceRecord.count({ where: { studentId: { startsWith: "qa18a-" } } })
  };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  console.log(JSON.stringify({ marker, counts, total }, null, 2));
  if (total !== 0) throw new Error(`Independent QA18A cleanup audit found ${total} remaining rows.`);
}

main().finally(() => prisma.$disconnect());
