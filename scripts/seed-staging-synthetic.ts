import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import {
  formatDeploymentEnvironmentResult,
  validateDeploymentEnvironment
} from "../lib/deployment-environment";

const USER_ID = "stg-devops1c-director";
const STUDENT_ID = "stg-devops1c-student";

async function main() {
  const validation = validateDeploymentEnvironment(process.env);
  if (!validation.ok) throw new Error(formatDeploymentEnvironmentResult(validation));
  if (process.env.STAGING_SYNTHETIC_SEED_OPT_IN !== "true") {
    throw new Error("STAGING_SYNTHETIC_SEED_OPT_IN_REQUIRED");
  }
  const password = process.env.STAGING_SYNTHETIC_DIRECTOR_PASSWORD?.trim() ?? "";
  if (password.length < 16 || /placeholder|example|local-only|devops|nalanda.*2026/i.test(password)) {
    throw new Error("STAGING_SYNTHETIC_PASSWORD_INVALID");
  }

  await ensureDefaultRolePermissions(prisma);
  await prisma.$transaction(async (tx) => {
    await tx.schoolSettings.upsert({
      where: { id: "school" },
      update: { schoolName: "STG Synthetic School", academicYear: "2026-27", phone: "0000000000", addressLine1: "Synthetic staging only", city: "Test City" },
      create: { id: "school", schoolName: "STG Synthetic School", academicYear: "2026-27", phone: "0000000000", addressLine1: "Synthetic staging only", city: "Test City" }
    });
    await tx.user.upsert({
      where: { username: "stg-director" },
      update: { name: "STG Synthetic Director", passwordHash: await hashPassword(password), role: "DIRECTOR", isActive: true },
      create: { id: USER_ID, name: "STG Synthetic Director", username: "stg-director", email: "director@staging.example.invalid", passwordHash: await hashPassword(password), role: "DIRECTOR", isActive: true }
    });
    await tx.student.upsert({
      where: { admissionNo: "STG-2026-001" },
      update: { studentName: "STG Synthetic Student 001", fatherName: "STG Synthetic Guardian", phone1: "0000000000", className: "STG-CLASS-1", section: "S", status: "Active", deletedAt: null },
      create: { id: STUDENT_ID, admissionNo: "STG-2026-001", studentName: "STG Synthetic Student 001", fatherName: "STG Synthetic Guardian", phone1: "0000000000", className: "STG-CLASS-1", section: "S", academicYear: "2026-27", status: "Active" }
    });
    await tx.academicYearEnrollment.upsert({
      where: { studentId_academicYear: { studentId: STUDENT_ID, academicYear: "2026-27" } },
      update: { className: "STG-CLASS-1", section: "S", status: "ACTIVE" },
      create: { id: "stg-devops1c-enrollment", studentId: STUDENT_ID, academicYear: "2026-27", className: "STG-CLASS-1", section: "S", status: "ACTIVE", enrollmentDate: new Date("2026-06-01T00:00:00.000Z") }
    });
  });
  const [users, students, enrollments, payments] = await Promise.all([
    prisma.user.count(),
    prisma.student.count({ where: { deletedAt: null } }),
    prisma.academicYearEnrollment.count({ where: { status: "ACTIVE" } }),
    prisma.payment.count({ where: { deletedAt: null } })
  ]);
  console.log(`Synthetic staging seed passed: users=${users} students=${students} activeEnrollments=${enrollments} payments=${payments}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "STAGING_SYNTHETIC_SEED_FAILED");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
