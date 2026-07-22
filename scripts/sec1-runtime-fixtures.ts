import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

const MARKER = process.env.SEC1_QA_MARKER ?? "QASEC1";
if (!/^QASEC1(?:QA)?$/.test(MARKER)) {
  throw new Error("SEC-1 fixture marker must be QASEC1 or QASEC1QA.");
}
const PREFIX = `${MARKER.toLowerCase()}-`;
const ACADEMIC_YEAR = "2026-27";
const CLASS_NAME = `${MARKER}-CLASS`;
const PASSWORD = process.env.SEC1_QA_PASSWORD ?? "Qasec1Runtime@2026";
const EMAIL_DOMAIN = `${MARKER.toLowerCase()}.invalid`;

function requireIsolation() {
  if (process.env.QA20C_ISOLATED_DATABASE !== "true") {
    throw new Error("QASEC1_COPIED_DATABASE_REQUIRED");
  }
}

async function cleanup() {
  requireIsolation();
  await prisma.timetableAssignment.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.staffMember.updateMany({
    where: { id: { startsWith: PREFIX } },
    data: { timetableTeacherId: null }
  });
  await prisma.staffMember.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableTeacher.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableSubject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableClassSection.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.academicYearEnrollment.deleteMany({ where: { studentId: { startsWith: PREFIX } } });
  await prisma.studentGuardian.deleteMany({
    where: {
      OR: [
        { studentId: { startsWith: PREFIX } },
        { guardianId: { startsWith: PREFIX } }
      ]
    }
  });
  await prisma.user.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.guardian.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.student.deleteMany({ where: { admissionNo: { startsWith: `${MARKER}-` } } });
}

async function setup() {
  requireIsolation();
  await cleanup();
  const passwordHash = await hashPassword(PASSWORD);
  const roles = [
    "SUPER_ADMIN",
    "DIRECTOR",
    "PRINCIPAL",
    "ADMIN",
    "ACCOUNTANT",
    "VIEWER"
  ] as const;
  await prisma.user.createMany({
    data: roles.map((role) => ({
      id: `${PREFIX}user-${role.toLowerCase().replaceAll("_", "-")}`,
      name: `${MARKER} ${role.replaceAll("_", " ")}`,
      username: `${PREFIX}${role.toLowerCase().replaceAll("_", "-")}`,
      email: `${role.toLowerCase().replaceAll("_", "-")}@${EMAIL_DOMAIN}`,
      passwordHash,
      role
    }))
  });

  const teacher = await prisma.user.create({
    data: {
      id: `${PREFIX}user-teacher`,
      name: `${MARKER} Teacher`,
      username: `${PREFIX}teacher`,
      email: `teacher@${EMAIL_DOMAIN}`,
      passwordHash,
      role: "TEACHER"
    }
  });
  const peerTeacher = await prisma.user.create({
    data: {
      id: `${PREFIX}user-teacher-peer`,
      name: `${MARKER} Peer Teacher`,
      username: `${PREFIX}teacher-peer`,
      email: `teacher-peer@${EMAIL_DOMAIN}`,
      passwordHash,
      role: "TEACHER"
    }
  });
  await prisma.user.create({
    data: {
      id: `${PREFIX}user-disabled`,
      name: `${MARKER} Disabled User`,
      username: `${PREFIX}disabled`,
      email: `disabled@${EMAIL_DOMAIN}`,
      passwordHash,
      role: "VIEWER",
      isActive: false
    }
  });

  const linkedGuardian = await prisma.guardian.create({
    data: {
      id: `${PREFIX}guardian-linked`,
      displayName: `${MARKER} Linked Guardian`,
      primaryMobile: "0000000000",
      email: `parent@${EMAIL_DOMAIN}`,
      relationship: "Parent"
    }
  });
  const unrelatedGuardian = await prisma.guardian.create({
    data: {
      id: `${PREFIX}guardian-unrelated`,
      displayName: `${MARKER} Unrelated Guardian`,
      primaryMobile: "0000000001",
      email: `parent-unrelated@${EMAIL_DOMAIN}`,
      relationship: "Parent"
    }
  });
  await prisma.user.createMany({
    data: [
      {
        id: `${PREFIX}user-parent`,
        name: `${MARKER} Parent`,
        username: `${PREFIX}parent`,
        email: `parent-user@${EMAIL_DOMAIN}`,
        passwordHash,
        role: "PARENT",
        guardianId: linkedGuardian.id
      },
      {
        id: `${PREFIX}user-parent-unrelated`,
        name: `${MARKER} Unrelated Parent`,
        username: `${PREFIX}parent-unrelated`,
        email: `parent-unrelated-user@${EMAIL_DOMAIN}`,
        passwordHash,
        role: "PARENT",
        guardianId: unrelatedGuardian.id
      }
    ]
  });

  const linkedStudent = await prisma.student.create({
    data: {
      id: `${PREFIX}student-linked`,
      admissionNo: `${MARKER}-STUDENT-001`,
      studentName: `${MARKER} Linked Child`,
      fatherName: `${MARKER} Guardian`,
      className: CLASS_NAME,
      section: "A",
      phone1: "0000000000",
      status: "Active"
    }
  });
  const unrelatedStudent = await prisma.student.create({
    data: {
      id: `${PREFIX}student-unrelated`,
      admissionNo: `${MARKER}-STUDENT-002`,
      studentName: `${MARKER} Unrelated Child`,
      fatherName: `${MARKER} Other Guardian`,
      className: CLASS_NAME,
      section: "B",
      phone1: "0000000001",
      status: "Active"
    }
  });
  await prisma.studentGuardian.createMany({
    data: [
      {
        id: `${PREFIX}student-guardian-linked`,
        guardianId: linkedGuardian.id,
        studentId: linkedStudent.id,
        relationshipToStudent: "Parent",
        isPrimaryContact: true
      },
      {
        id: `${PREFIX}student-guardian-unrelated`,
        guardianId: unrelatedGuardian.id,
        studentId: unrelatedStudent.id,
        relationshipToStudent: "Parent",
        isPrimaryContact: true
      }
    ]
  });
  await prisma.academicYearEnrollment.createMany({
    data: [
      {
        id: `${PREFIX}enrollment-linked`,
        studentId: linkedStudent.id,
        academicYear: ACADEMIC_YEAR,
        className: CLASS_NAME,
        section: "A",
        enrollmentDate: new Date("2026-06-01T00:00:00.000Z"),
        status: "ACTIVE"
      },
      {
        id: `${PREFIX}enrollment-unrelated`,
        studentId: unrelatedStudent.id,
        academicYear: ACADEMIC_YEAR,
        className: CLASS_NAME,
        section: "B",
        enrollmentDate: new Date("2026-06-01T00:00:00.000Z"),
        status: "ACTIVE"
      }
    ]
  });

  const classSection = await prisma.timetableClassSection.create({
    data: {
      id: `${PREFIX}class-a`,
      academicYear: ACADEMIC_YEAR,
      className: CLASS_NAME,
      section: "A",
      displayName: `${MARKER} Class A`,
      groupName: `${MARKER} GROUP`
    }
  });
  const subject = await prisma.timetableSubject.create({
    data: {
      id: `${PREFIX}subject`,
      name: `${MARKER} Safe Subject`,
      shortName: `${MARKER}-SUBJECT`,
      department: "QA"
    }
  });
  const timetableTeacher = await prisma.timetableTeacher.create({
    data: {
      id: `${PREFIX}timetable-teacher`,
      name: `${MARKER} Teacher`,
      shortName: `${MARKER}-T1`,
      maxPeriodsPerWeek: 30
    }
  });
  const peerTimetableTeacher = await prisma.timetableTeacher.create({
    data: {
      id: `${PREFIX}timetable-teacher-peer`,
      name: `${MARKER} Peer Teacher`,
      shortName: `${MARKER}-T2`,
      maxPeriodsPerWeek: 30
    }
  });
  await prisma.staffMember.createMany({
    data: [
      {
        id: `${PREFIX}staff-teacher`,
        staffCode: `${MARKER}-STAFF-001`,
        fullName: `${MARKER} Teacher`,
        designation: "Teacher",
        department: "QA",
        status: "ACTIVE",
        userId: teacher.id,
        timetableTeacherId: timetableTeacher.id
      },
      {
        id: `${PREFIX}staff-teacher-peer`,
        staffCode: `${MARKER}-STAFF-002`,
        fullName: `${MARKER} Peer Teacher`,
        designation: "Teacher",
        department: "QA",
        status: "ACTIVE",
        userId: peerTeacher.id,
        timetableTeacherId: peerTimetableTeacher.id
      },
      {
        id: `${PREFIX}staff-accountant`,
        staffCode: `${MARKER}-STAFF-003`,
        fullName: `${MARKER} Accountant`,
        designation: "Accountant",
        department: "QA",
        status: "ACTIVE",
        userId: `${PREFIX}user-accountant`
      }
    ]
  });
  await prisma.timetableAssignment.create({
    data: {
      id: `${PREFIX}assignment`,
      academicYear: ACADEMIC_YEAR,
      classSectionId: classSection.id,
      subjectId: subject.id,
      teacherId: timetableTeacher.id,
      periodsPerWeek: 5
    }
  });

  console.log(JSON.stringify({
    marker: MARKER,
    password: PASSWORD,
    users: await prisma.user.count({ where: { username: { startsWith: PREFIX } } }),
    linkedStudentId: linkedStudent.id,
    unrelatedStudentId: unrelatedStudent.id,
    linkedGuardianId: linkedGuardian.id,
    unrelatedGuardianId: unrelatedGuardian.id,
    teacherStaffId: `${PREFIX}staff-teacher`,
    peerTeacherStaffId: `${PREFIX}staff-teacher-peer`
  }, null, 2));
}

async function inspect() {
  requireIsolation();
  console.log(JSON.stringify({
    users: await prisma.user.count({ where: { username: { startsWith: PREFIX } } }),
    students: await prisma.student.count({ where: { admissionNo: { startsWith: `${MARKER}-` } } }),
    guardians: await prisma.guardian.count({ where: { id: { startsWith: PREFIX } } }),
    links: await prisma.studentGuardian.count({
      where: {
        OR: [
          { studentId: { startsWith: PREFIX } },
          { guardianId: { startsWith: PREFIX } }
        ]
      }
    }),
    enrollments: await prisma.academicYearEnrollment.count({ where: { studentId: { startsWith: PREFIX } } }),
    staffMembers: await prisma.staffMember.count({ where: { id: { startsWith: PREFIX } } }),
    timetableTeachers: await prisma.timetableTeacher.count({ where: { id: { startsWith: PREFIX } } }),
    timetableAssignments: await prisma.timetableAssignment.count({ where: { id: { startsWith: PREFIX } } }),
    payments: await prisma.payment.count({ where: { admissionNo: { startsWith: `${MARKER}-` } } }),
    campaigns: await prisma.notificationCampaign.count({ where: { campaignNumber: { startsWith: MARKER } } }),
    websitePages: await prisma.publicWebsitePage.count({ where: { pageCode: { startsWith: MARKER } } }),
    websitePosts: await prisma.publicWebsitePost.count({ where: { postNumber: { startsWith: MARKER } } })
  }, null, 2));
}

async function main() {
  const action = String(process.argv[2] ?? "inspect").toLowerCase();
  if (action === "setup") await setup();
  else if (action === "cleanup") {
    await cleanup();
    await inspect();
  } else if (action === "inspect") await inspect();
  else throw new Error("Use setup, inspect, or cleanup.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "SEC-1 fixture operation failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
