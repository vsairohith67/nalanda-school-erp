import { PrismaClient } from "@prisma/client";

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

const prisma = new PrismaClient();

async function main() {
  const [
    students,
    activeEnrollments,
    payments,
    paymentAmount,
    guardians,
    staff,
    users,
    roleAssignments,
    permissionProfiles,
    permissionProfileEntries,
    permissionProfileVersions,
    permissionProfileAssignments,
    permissionOverrides,
    sessions,
    activeChildContexts
  ] = await Promise.all([
    prisma.student.count(),
    prisma.academicYearEnrollment.count({ where: { status: "ACTIVE" } }),
    prisma.payment.count({ where: { deletedAt: null, isCancelled: false } }),
    prisma.payment.aggregate({ where: { deletedAt: null, isCancelled: false }, _sum: { amountPaid: true } }),
    prisma.guardian.count(),
    prisma.staffMember.count(),
    prisma.user.findMany({ select: { id: true, role: true, isActive: true, lifecycleStatus: true }, orderBy: { role: "asc" } }),
    prisma.userRoleAssignment.findMany({ select: { userId: true, role: true, status: true, validUntil: true, endedAt: true, activeKey: true } }),
    prisma.permissionProfile.count(),
    prisma.permissionProfileEntry.count(),
    prisma.permissionProfileVersion.count(),
    prisma.userPermissionProfileAssignment.count(),
    prisma.userPermissionOverride.count(),
    prisma.authSession.count(),
    prisma.authSession.count({ where: { activeChildLinkId: { not: null } } })
  ]);
  invariant(students === 0, "PARENT23D_OPERATIONAL_STUDENTS_NOT_ZERO");
  invariant(activeEnrollments === 0, "PARENT23D_OPERATIONAL_ACTIVE_ENROLLMENTS_NOT_ZERO");
  invariant(payments === 0 && Number(paymentAmount._sum.amountPaid ?? 0) === 0, "PARENT23D_OPERATIONAL_PAYMENTS_NOT_ZERO");
  invariant(guardians === 0 && staff === 0, "PARENT23D_OPERATIONAL_GUARDIAN_OR_STAFF_NOT_ZERO");
  const expectedRoles = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN", "VIEWER"];
  invariant(users.length === expectedRoles.length && users.every((user, index) => user.role === expectedRoles[index]), "PARENT23D_OPERATIONAL_USER_SET_CHANGED");
  const activeSuperAdmins = users.filter((user) => user.role === "SUPER_ADMIN" && user.isActive && user.lifecycleStatus === "ACTIVE");
  invariant(activeSuperAdmins.length === 1, "PARENT23D_OPERATIONAL_SUPER_ADMIN_BASELINE_CHANGED");
  for (const role of ["ADMIN", "ACCOUNTANT", "VIEWER"]) {
    const rows = users.filter((user) => user.role === role);
    invariant(rows.length === 1 && rows.every((user) => !user.isActive && user.lifecycleStatus !== "ACTIVE"), `PARENT23D_OPERATIONAL_${role}_BASELINE_CHANGED`);
  }
  invariant(roleAssignments.length === users.length && users.every((user) => {
    const assignments = roleAssignments.filter((assignment) => assignment.userId === user.id);
    return assignments.length === 1
      && assignments[0].role === user.role
      && assignments[0].status === "ACTIVE"
      && assignments[0].validUntil === null
      && assignments[0].endedAt === null
      && assignments[0].activeKey !== null;
  }), "PARENT23D_OPERATIONAL_ROLE_ASSIGNMENTS_CHANGED");
  invariant(permissionProfiles === 0 && permissionProfileEntries === 0 && permissionProfileVersions === 0, "PARENT23D_OPERATIONAL_PERMISSION_PROFILES_NOT_ZERO");
  invariant(permissionProfileAssignments === 0 && permissionOverrides === 0, "PARENT23D_OPERATIONAL_EXPLICIT_IAM_GRANTS_NOT_ZERO");
  invariant(sessions === 0 && activeChildContexts === 0, "PARENT23D_OPERATIONAL_SESSION_OR_CHILD_CONTEXT_NOT_ZERO");
  console.log(JSON.stringify({
    result: "PARENT23D_OPERATIONAL_BASELINE_EXACT",
    students,
    activeEnrollments,
    payments,
    paymentAmount: Number(paymentAmount._sum.amountPaid ?? 0),
    guardians,
    staff,
    users: users.length,
    roleAssignments: roleAssignments.length,
    permissionProfiles,
    permissionProfileEntries,
    permissionProfileVersions,
    permissionProfileAssignments,
    permissionOverrides,
    sessions,
    activeChildContexts,
    activeSuperAdmins: activeSuperAdmins.length,
    protectedInactiveRoles: ["ADMIN", "ACCOUNTANT", "VIEWER"]
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "PARENT23D_OPERATIONAL_BASELINE_FAILED");
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
