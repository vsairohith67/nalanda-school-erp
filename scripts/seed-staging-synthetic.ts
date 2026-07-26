import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import {
  formatDeploymentEnvironmentResult,
  validateDeploymentEnvironment
} from "../lib/deployment-environment";

const STUDENT_ID = "qa-staging-student";
const GUARDIAN_ID = "qa-staging-guardian";
const TIMETABLE_TEACHER_ID = "qa-staging-timetable-teacher";
const STAFF_ID = "qa-staging-staff";

const accountSpecs = [
  {
    id: "qa-staging-director",
    name: "QA-DIRECTOR",
    username: "qa-director",
    email: "qa-director@staging.example.invalid",
    role: "DIRECTOR",
    passwordVariable: "STAGING_SYNTHETIC_DIRECTOR_PASSWORD"
  },
  {
    id: "qa-staging-principal",
    name: "QA-PRINCIPAL",
    username: "qa-principal",
    email: "qa-principal@staging.example.invalid",
    role: "PRINCIPAL",
    passwordVariable: "STAGING_SYNTHETIC_PRINCIPAL_PASSWORD"
  },
  {
    id: "qa-staging-teacher",
    name: "QA-TEACHER",
    username: "qa-teacher",
    email: "qa-teacher@staging.example.invalid",
    role: "TEACHER",
    passwordVariable: "STAGING_SYNTHETIC_TEACHER_PASSWORD"
  },
  {
    id: "qa-staging-parent",
    name: "QA-PARENT",
    username: "qa-parent",
    email: "qa-parent@staging.example.invalid",
    role: "PARENT",
    passwordVariable: "STAGING_SYNTHETIC_PARENT_PASSWORD"
  }
] as const;

function temporaryPassword(variable: string) {
  const password = process.env[variable]?.trim() ?? "";
  if (password.length < 16 || /placeholder|example|local-only|devops|nalanda.*2026/i.test(password)) {
    throw new Error("STAGING_SYNTHETIC_PASSWORD_INVALID");
  }
  return password;
}

async function main() {
  const validation = validateDeploymentEnvironment(process.env);
  if (!validation.ok) throw new Error(formatDeploymentEnvironmentResult(validation));
  if (process.env.STAGING_SYNTHETIC_SEED_OPT_IN !== "true") {
    throw new Error("STAGING_SYNTHETIC_SEED_OPT_IN_REQUIRED");
  }
  const passwords = accountSpecs.map((account) => temporaryPassword(account.passwordVariable));
  if (new Set(passwords).size !== passwords.length) {
    throw new Error("STAGING_SYNTHETIC_PASSWORD_REUSE_REJECTED");
  }
  const passwordHashes = await Promise.all(passwords.map((password) => hashPassword(password)));

  await ensureDefaultRolePermissions(prisma);
  await prisma.$transaction(async (tx) => {
    await tx.schoolSettings.upsert({
      where: { id: "school" },
      update: { schoolName: "QA Synthetic School", academicYear: "2026-27", phone: "0000000000", addressLine1: "Synthetic staging only", city: "Test City" },
      create: { id: "school", schoolName: "QA Synthetic School", academicYear: "2026-27", phone: "0000000000", addressLine1: "Synthetic staging only", city: "Test City" }
    });
    await tx.guardian.upsert({
      where: { id: GUARDIAN_ID },
      update: { displayName: "QA-PARENT", primaryMobile: "0000000000", email: "qa-parent@staging.example.invalid", relationship: "Parent", status: "Active" },
      create: { id: GUARDIAN_ID, displayName: "QA-PARENT", primaryMobile: "0000000000", email: "qa-parent@staging.example.invalid", relationship: "Parent", status: "Active" }
    });
    for (const [index, account] of accountSpecs.entries()) {
      await tx.user.upsert({
        where: { username: account.username },
        update: {
          name: account.name,
          email: account.email,
          passwordHash: passwordHashes[index],
          role: account.role,
          isActive: true,
          guardianId: account.role === "PARENT" ? GUARDIAN_ID : null
        },
        create: {
          id: account.id,
          name: account.name,
          username: account.username,
          email: account.email,
          passwordHash: passwordHashes[index],
          role: account.role,
          isActive: true,
          guardianId: account.role === "PARENT" ? GUARDIAN_ID : null
        }
      });
    }
    await tx.student.upsert({
      where: { admissionNo: "QA-STUDENT-001" },
      update: { studentName: "QA-STUDENT", fatherName: "QA-PARENT", phone1: "0000000000", className: "QA-CLASS-1", section: "Q", status: "Active", deletedAt: null },
      create: { id: STUDENT_ID, admissionNo: "QA-STUDENT-001", studentName: "QA-STUDENT", fatherName: "QA-PARENT", phone1: "0000000000", className: "QA-CLASS-1", section: "Q", academicYear: "2026-27", status: "Active" }
    });
    await tx.academicYearEnrollment.upsert({
      where: { studentId_academicYear: { studentId: STUDENT_ID, academicYear: "2026-27" } },
      update: { className: "QA-CLASS-1", section: "Q", status: "ACTIVE" },
      create: { id: "qa-staging-enrollment", studentId: STUDENT_ID, academicYear: "2026-27", className: "QA-CLASS-1", section: "Q", status: "ACTIVE", enrollmentDate: new Date("2026-06-01T00:00:00.000Z") }
    });
    await tx.studentGuardian.upsert({
      where: { guardianId_studentId: { guardianId: GUARDIAN_ID, studentId: STUDENT_ID } },
      update: { relationshipToStudent: "Parent", isPrimaryContact: true, canViewFees: true, canReceiveReminders: false },
      create: { id: "qa-staging-student-guardian", guardianId: GUARDIAN_ID, studentId: STUDENT_ID, relationshipToStudent: "Parent", isPrimaryContact: true, canViewFees: true, canReceiveReminders: false }
    });
    await tx.timetableTeacher.upsert({
      where: { id: TIMETABLE_TEACHER_ID },
      update: { name: "QA-TEACHER", shortName: "QA-TEACHER", department: "Synthetic", phone: "0000000000", email: "qa-teacher@staging.example.invalid", isActive: true, maxPeriodsPerWeek: 1, maxPeriodsPerDay: 1 },
      create: { id: TIMETABLE_TEACHER_ID, name: "QA-TEACHER", shortName: "QA-TEACHER", department: "Synthetic", phone: "0000000000", email: "qa-teacher@staging.example.invalid", isActive: true, maxPeriodsPerWeek: 1, maxPeriodsPerDay: 1 }
    });
    await tx.staffMember.upsert({
      where: { id: STAFF_ID },
      update: { staffCode: "QA-TEACHER", fullName: "QA-TEACHER", displayName: "QA-TEACHER", staffType: "TEACHING", designation: "Synthetic Teacher", department: "Synthetic", mobile: "0000000000", email: "qa-teacher@staging.example.invalid", status: "ACTIVE", userId: "qa-staging-teacher", timetableTeacherId: TIMETABLE_TEACHER_ID },
      create: { id: STAFF_ID, staffCode: "QA-TEACHER", fullName: "QA-TEACHER", displayName: "QA-TEACHER", staffType: "TEACHING", designation: "Synthetic Teacher", department: "Synthetic", mobile: "0000000000", email: "qa-teacher@staging.example.invalid", status: "ACTIVE", userId: "qa-staging-teacher", timetableTeacherId: TIMETABLE_TEACHER_ID }
    });
  });
  const [users, students, enrollments, guardians, staff, payments] = await Promise.all([
    prisma.user.count(),
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.academicYearEnrollment.count({ where: { status: "ACTIVE" } }),
    prisma.guardian.count({ where: { status: "Active" } }),
    prisma.staffMember.count({ where: { status: "ACTIVE" } }),
    prisma.payment.count({ where: { deletedAt: null } })
  ]);
  console.log(`Synthetic staging seed passed: users=${users} students=${students} activeEnrollments=${enrollments} guardians=${guardians} staff=${staff} payments=${payments}`);
  console.log("Remove all STAGING_SYNTHETIC_*_PASSWORD variables now; no credential value was printed.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "STAGING_SYNTHETIC_SEED_FAILED");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
