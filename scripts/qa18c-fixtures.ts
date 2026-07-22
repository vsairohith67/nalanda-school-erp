import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

const MARKER = "QA18C";
const PREFIX = "qa18c-";
const YEAR = "2026-27";
const PASSWORD = "Qa18cCards@2026";

async function cleanup() {
  const cardIds = (await prisma.identityCard.findMany({ where: { OR: [{ cardNumber: { startsWith: MARKER } }, { studentId: { startsWith: PREFIX } }, { staffMemberId: { startsWith: PREFIX } }] }, select: { id: true } })).map((row) => row.id);
  const batchIds = (await prisma.identityCardBatch.findMany({ where: { OR: [{ batchNumber: { startsWith: MARKER } }, { notes: { contains: MARKER } }] }, select: { id: true } })).map((row) => row.id);
  await prisma.identityCardEvent.deleteMany({ where: { OR: [{ identityCardId: { in: cardIds } }, { batchId: { in: batchIds } }] } });
  await prisma.identityCardVersion.deleteMany({ where: { identityCardId: { in: cardIds } } });
  await prisma.identityCard.updateMany({ where: { id: { in: cardIds } }, data: { replacesCardId: null } });
  await prisma.identityCard.deleteMany({ where: { id: { in: cardIds } } });
  await prisma.identityCardBatch.deleteMany({ where: { id: { in: batchIds } } });
  await prisma.identityCardTemplate.deleteMany({ where: { templateCode: { startsWith: MARKER } } });
  await prisma.identityCardNumberSeries.deleteMany({ where: { seriesCode: { startsWith: MARKER } } });
  await prisma.academicYearEnrollment.deleteMany({ where: { studentId: { startsWith: PREFIX } } });
  await prisma.studentGuardian.deleteMany({ where: { OR: [{ studentId: { startsWith: PREFIX } }, { guardianId: { startsWith: PREFIX } }] } });
  await prisma.staffMember.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.guardian.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.student.deleteMany({ where: { admissionNo: { startsWith: `${MARKER}-` } } });
}

async function setup() {
  await cleanup();
  const passwordHash = await hashPassword(PASSWORD);
  const roles = ["DIRECTOR", "PRINCIPAL", "ADMIN", "ACCOUNTANT", "VIEWER"] as const;
  for (const role of roles) await prisma.user.create({ data: { id: `${PREFIX}user-${role.toLowerCase()}`, name: `${MARKER} ${role}`, username: `${PREFIX}${role.toLowerCase()}`, passwordHash, role } });
  const teacher = await prisma.user.create({ data: { id: `${PREFIX}user-teacher`, name: `${MARKER} Teacher`, username: `${PREFIX}teacher`, passwordHash, role: "TEACHER" } });
  const peerTeacher = await prisma.user.create({ data: { id: `${PREFIX}user-teacher-peer`, name: `${MARKER} Peer Teacher`, username: `${PREFIX}teacher-peer`, passwordHash, role: "TEACHER" } });
  await prisma.user.create({ data: { id: `${PREFIX}user-teacher-unlinked`, name: `${MARKER} Unlinked Teacher`, username: `${PREFIX}teacher-unlinked`, passwordHash, role: "TEACHER" } });
  const linkedGuardian = await prisma.guardian.create({ data: { id: `${PREFIX}guardian-linked`, displayName: `${MARKER} Linked Guardian`, relationship: "Parent", primaryMobile: "9000001811" } });
  const unrelatedGuardian = await prisma.guardian.create({ data: { id: `${PREFIX}guardian-unrelated`, displayName: `${MARKER} Unrelated Guardian`, relationship: "Parent", primaryMobile: "9000001812" } });
  await prisma.user.createMany({ data: [
    { id: `${PREFIX}user-parent`, name: `${MARKER} Linked Parent`, username: `${PREFIX}parent`, passwordHash, role: "PARENT", guardianId: linkedGuardian.id },
    { id: `${PREFIX}user-parent-unrelated`, name: `${MARKER} Unrelated Parent`, username: `${PREFIX}parent-unrelated`, passwordHash, role: "PARENT", guardianId: unrelatedGuardian.id }
  ] });
  const linkedStudent = await prisma.student.create({ data: { id: `${PREFIX}student-linked`, admissionNo: `${MARKER}-STU-001`, studentName: `${MARKER} Linked Student`, fatherName: `${MARKER} Guardian`, className: "10", section: "A", phone1: "9000001821", status: "Active" } });
  const unrelatedStudent = await prisma.student.create({ data: { id: `${PREFIX}student-unrelated`, admissionNo: `${MARKER}-STU-002`, studentName: `${MARKER} Unrelated Student`, fatherName: `${MARKER} Guardian`, className: "10", section: "B", phone1: "9000001822", status: "Active" } });
  const linkedSibling = await prisma.student.create({ data: { id: `${PREFIX}student-sibling`, admissionNo: `${MARKER}-STU-003`, studentName: `${MARKER} Linked Sibling`, fatherName: `${MARKER} Guardian`, className: "10", section: "A", phone1: "9000001823", status: "Active" } });
  const inactiveStudent = await prisma.student.create({ data: { id: `${PREFIX}student-inactive`, admissionNo: `${MARKER}-STU-004`, studentName: `${MARKER} Inactive Enrollment`, fatherName: `${MARKER} Guardian`, className: "10", section: "B", phone1: "9000001824", status: "Active" } });
  await prisma.studentGuardian.createMany({ data: [
    { id: `${PREFIX}link-linked`, studentId: linkedStudent.id, guardianId: linkedGuardian.id, relationshipToStudent: "Parent", isPrimaryContact: true },
    { id: `${PREFIX}link-sibling`, studentId: linkedSibling.id, guardianId: linkedGuardian.id, relationshipToStudent: "Parent", isPrimaryContact: true },
    { id: `${PREFIX}link-unrelated`, studentId: unrelatedStudent.id, guardianId: unrelatedGuardian.id, relationshipToStudent: "Parent", isPrimaryContact: true }
  ] });
  await prisma.academicYearEnrollment.createMany({ data: [
    { id: `${PREFIX}enrollment-linked`, studentId: linkedStudent.id, academicYear: YEAR, className: "10", section: "A", status: "ACTIVE", enrollmentDate: new Date("2026-06-01") },
    { id: `${PREFIX}enrollment-unrelated`, studentId: unrelatedStudent.id, academicYear: YEAR, className: "10", section: "B", status: "ACTIVE", enrollmentDate: new Date("2026-06-01") },
    { id: `${PREFIX}enrollment-sibling`, studentId: linkedSibling.id, academicYear: YEAR, className: "10", section: "A", status: "ACTIVE", enrollmentDate: new Date("2026-06-01") },
    { id: `${PREFIX}enrollment-inactive`, studentId: inactiveStudent.id, academicYear: YEAR, className: "10", section: "B", status: "INACTIVE", enrollmentDate: new Date("2026-06-01") }
  ] });
  await prisma.staffMember.createMany({ data: [
    { id: `${PREFIX}staff-linked`, staffCode: `${MARKER}-STAFF-001`, fullName: `${MARKER} Linked Teacher`, designation: "Teacher", department: "Academics", primarySubject: "Mathematics", status: "ACTIVE", userId: teacher.id },
    { id: `${PREFIX}staff-unrelated`, staffCode: `${MARKER}-STAFF-002`, fullName: `${MARKER} Unrelated Teacher`, designation: "Teacher", department: "Academics", primarySubject: "Science", status: "ACTIVE", userId: peerTeacher.id },
    { id: `${PREFIX}staff-inactive`, staffCode: `${MARKER}-STAFF-003`, fullName: `${MARKER} Inactive Staff`, designation: "Teacher", department: "Academics", primarySubject: "English", status: "INACTIVE" }
  ] });
  console.log(JSON.stringify({ usernames: roles.map((role) => `${PREFIX}${role.toLowerCase()}`).concat([`${PREFIX}teacher`, `${PREFIX}teacher-peer`, `${PREFIX}teacher-unlinked`, `${PREFIX}parent`, `${PREFIX}parent-unrelated`]), password: PASSWORD, academicYear: YEAR }, null, 2));
}

async function inspect() {
  const cardIds = (await prisma.identityCard.findMany({ where: { OR: [{ cardNumber: { startsWith: MARKER } }, { studentId: { startsWith: PREFIX } }, { staffMemberId: { startsWith: PREFIX } }] }, select: { id: true } })).map((row) => row.id);
  const batchIds = (await prisma.identityCardBatch.findMany({ where: { OR: [{ batchNumber: { startsWith: MARKER } }, { notes: { contains: MARKER } }] }, select: { id: true } })).map((row) => row.id);
  const series = await prisma.identityCardNumberSeries.findMany({ where: { seriesCode: { startsWith: MARKER } }, select: { seriesCode: true, nextNumber: true }, orderBy: { seriesCode: "asc" } });
  const cards = await prisma.identityCard.findMany({ where: { id: { in: cardIds } }, select: { cardNumber: true, cardType: true, status: true, currentVersionNumber: true, studentId: true, staffMemberId: true, replacesCardId: true }, orderBy: { createdAt: "asc" } });
  console.log(JSON.stringify({
    identityCardNumberSeries: await prisma.identityCardNumberSeries.count({ where: { seriesCode: { startsWith: MARKER } } }),
    identityCardTemplates: await prisma.identityCardTemplate.count({ where: { templateCode: { startsWith: MARKER } } }),
    identityCardBatches: batchIds.length,
    identityCards: cardIds.length,
    identityCardVersions: await prisma.identityCardVersion.count({ where: { identityCardId: { in: cardIds } } }),
    identityCardEvents: await prisma.identityCardEvent.count({ where: { OR: [{ identityCardId: { in: cardIds } }, { batchId: { in: batchIds } }] } }),
    students: await prisma.student.count({ where: { admissionNo: { startsWith: `${MARKER}-` } } }),
    staffMembers: await prisma.staffMember.count({ where: { id: { startsWith: PREFIX } } }),
    guardians: await prisma.guardian.count({ where: { id: { startsWith: PREFIX } } }),
    guardianStudentLinks: await prisma.studentGuardian.count({ where: { OR: [{ studentId: { startsWith: PREFIX } }, { guardianId: { startsWith: PREFIX } }] } }),
    enrollments: await prisma.academicYearEnrollment.count({ where: { studentId: { startsWith: PREFIX } } }),
    lifecycleEvents: await prisma.studentLifecycleEvent.count({ where: { studentId: { startsWith: PREFIX } } }),
    timetableTeachers: await prisma.timetableTeacher.count({ where: { OR: [{ id: { startsWith: PREFIX } }, { name: { startsWith: MARKER } }, { shortName: { startsWith: MARKER } }] } }),
    timetableClassSections: await prisma.timetableClassSection.count({ where: { OR: [{ id: { startsWith: PREFIX } }, { displayName: { startsWith: MARKER } }, { groupName: { startsWith: MARKER } }] } }),
    timetableDrafts: await prisma.timetableDraft.count({ where: { OR: [{ id: { startsWith: PREFIX } }, { name: { startsWith: MARKER } }, { notes: { contains: MARKER } }] } }),
    studentAttendanceRecords: await prisma.studentAttendanceRecord.count({ where: { studentId: { startsWith: PREFIX } } }),
    staffAttendanceRecords: await prisma.staffAttendanceRecord.count({ where: { staffMemberId: { startsWith: PREFIX } } }),
    users: await prisma.user.count({ where: { username: { startsWith: PREFIX } } }),
    seriesNext: Object.fromEntries(series.map((row) => [row.seriesCode, row.nextNumber])),
    cardStates: cards
  }, null, 2));
}

async function main() {
  const action = process.argv[2];
  if (action === "setup") await setup();
  else if (action === "cleanup") { await cleanup(); await inspect(); }
  else if (action === "inspect") await inspect();
  else throw new Error("Use: pnpm.cmd exec tsx scripts/qa18c-fixtures.ts setup|cleanup|inspect");
}

main().finally(() => prisma.$disconnect());
