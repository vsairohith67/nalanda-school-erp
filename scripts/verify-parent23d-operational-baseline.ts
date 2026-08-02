import { PrismaClient } from "@prisma/client";

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

const prisma = new PrismaClient();

async function main() {
  const [students, activeEnrollments, payments, paymentAmount, guardians, staff, users] = await Promise.all([
    prisma.student.count(),
    prisma.academicYearEnrollment.count({ where: { status: "ACTIVE" } }),
    prisma.payment.count({ where: { deletedAt: null, isCancelled: false } }),
    prisma.payment.aggregate({ where: { deletedAt: null, isCancelled: false }, _sum: { amountPaid: true } }),
    prisma.guardian.count(),
    prisma.staffMember.count(),
    prisma.user.findMany({ select: { role: true, isActive: true, lifecycleStatus: true }, orderBy: { role: "asc" } })
  ]);
  invariant(students === 0, "PARENT23D_OPERATIONAL_STUDENTS_NOT_ZERO");
  invariant(activeEnrollments === 0, "PARENT23D_OPERATIONAL_ACTIVE_ENROLLMENTS_NOT_ZERO");
  invariant(payments === 0 && Number(paymentAmount._sum.amountPaid ?? 0) === 0, "PARENT23D_OPERATIONAL_PAYMENTS_NOT_ZERO");
  invariant(guardians === 0 && staff === 0, "PARENT23D_OPERATIONAL_GUARDIAN_OR_STAFF_NOT_ZERO");
  const activeSuperAdmins = users.filter((user) => user.role === "SUPER_ADMIN" && user.isActive && user.lifecycleStatus === "ACTIVE");
  invariant(activeSuperAdmins.length === 1, "PARENT23D_OPERATIONAL_SUPER_ADMIN_BASELINE_CHANGED");
  for (const role of ["ADMIN", "ACCOUNTANT", "VIEWER"]) {
    const rows = users.filter((user) => user.role === role);
    invariant(rows.length === 1 && rows.every((user) => !user.isActive && user.lifecycleStatus !== "ACTIVE"), `PARENT23D_OPERATIONAL_${role}_BASELINE_CHANGED`);
  }
  console.log(JSON.stringify({ result: "PARENT23D_OPERATIONAL_BASELINE_EXACT", students, activeEnrollments, payments, paymentAmount: Number(paymentAmount._sum.amountPaid ?? 0), guardians, staff, activeSuperAdmins: activeSuperAdmins.length, protectedInactiveRoles: ["ADMIN", "ACCOUNTANT", "VIEWER"] }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "PARENT23D_OPERATIONAL_BASELINE_FAILED");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
