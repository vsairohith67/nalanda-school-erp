import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { ACADEMIC_YEAR, DEFAULT_FEE_STRUCTURE, dueMonthsForClass } from "../lib/constants";
import { ensureDefaultMiscIncomeItems } from "../lib/misc-income";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import { ensureSeedUsers, SEED_USER_DEFINITIONS } from "../lib/seed-users";
import { seedTimetableDefaults } from "../lib/timetable";

function canonical(candidate: string) {
  const resolved = path.resolve(candidate);
  return existsSync(resolved) ? realpathSync.native(resolved) : resolved;
}

function sameFile(left: string, right: string) {
  if (!existsSync(left) || !existsSync(right)) return false;
  const leftStat = statSync(left, { bigint: true });
  const rightStat = statSync(right, { bigint: true });
  return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
}

function configuredDatabasePath() {
  const value = process.env.DATABASE_URL?.trim() ?? "";
  if (!value.startsWith("file:") || value.includes("?") || value.includes("#")) {
    throw new Error("RELEASE_CI_DATABASE_URL_INVALID");
  }
  const raw = value.slice(5).replaceAll("/", path.sep);
  return canonical(path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), "prisma", raw));
}

async function seedSyntheticSystemBaseline(prisma: PrismaClient, databasePath: string) {
  const [users, students, payments, guardians, staff] = await Promise.all([
    prisma.user.count(),
    prisma.student.count(),
    prisma.payment.count(),
    prisma.guardian.count(),
    prisma.staffMember.count()
  ]);
  if (users !== 0 || students !== 0 || payments !== 0 || guardians !== 0 || staff !== 0) {
    throw new Error("RELEASE_CI_SYNTHETIC_INITIAL_DATABASE_NOT_EMPTY");
  }

  const seedEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    ALLOW_DEMO_USERS: "true",
    DEMO_USER_DATABASE_ROOT: path.dirname(databasePath)
  };
  for (const definition of SEED_USER_DEFINITIONS) {
    seedEnvironment[definition.env] = `CI-${definition.name}-${randomBytes(24).toString("hex")}!`;
  }
  const seedResult = await ensureSeedUsers(prisma, seedEnvironment, process.cwd());
  if (!seedResult.enabled || seedResult.createdRoles.length !== SEED_USER_DEFINITIONS.length) {
    throw new Error("RELEASE_CI_SYNTHETIC_USERS_INVALID");
  }

  await ensureDefaultRolePermissions(prisma);
  await ensureDefaultMiscIncomeItems(prisma);
  await prisma.schoolSettings.upsert({
    where: { id: "school" },
    update: {},
    create: { id: "school" }
  });
  await seedTimetableDefaults(prisma);
  for (const group of DEFAULT_FEE_STRUCTURE) {
    for (const className of group.classes) {
      const [term1Month, term2Month, term3Month, term4Month] = dueMonthsForClass(className);
      await prisma.feeStructure.upsert({
        where: { academicYear_className: { academicYear: ACADEMIC_YEAR, className } },
        update: { termAmount: group.termAmount, term1Month, term2Month, term3Month, term4Month, active: true },
        create: { academicYear: ACADEMIC_YEAR, className, termAmount: group.termAmount, term1Month, term2Month, term3Month, term4Month }
      });
    }
  }
}

async function main() {
  if (
    process.env.RELEASE_CI_SYNTHETIC_OPT_IN !== "true" ||
    process.env.NALANDA_ENVIRONMENT !== "TEST" ||
    process.env.NODE_ENV !== "development"
  ) {
    throw new Error("RELEASE_CI_SYNTHETIC_ENVIRONMENT_REFUSED");
  }

  const databasePath = configuredDatabasePath();
  const expectedPath = canonical(path.join(process.cwd(), "tmp", "release-ci", "synthetic.db"));
  const operationalPath = canonical(path.join(process.cwd(), "prisma", "dev.db"));
  if (databasePath.toLowerCase() !== expectedPath.toLowerCase() || sameFile(databasePath, operationalPath)) {
    throw new Error("RELEASE_CI_SYNTHETIC_DATABASE_REFUSED");
  }

  const prisma = new PrismaClient();
  try {
    await seedSyntheticSystemBaseline(prisma, databasePath);
    await prisma.$transaction(async (tx) => {
      const [users, students, payments, guardians, staff, director] = await Promise.all([
        tx.user.count(),
        tx.student.count(),
        tx.payment.count(),
        tx.guardian.count(),
        tx.staffMember.count(),
        tx.user.findUnique({ where: { username: "director" }, select: { id: true, role: true, isActive: true } })
      ]);
      if (
        users !== 4 || students !== 0 || payments !== 0 || guardians !== 0 || staff !== 0 ||
        !director || director.role !== "DIRECTOR" || !director.isActive
      ) {
        throw new Error("RELEASE_CI_SYNTHETIC_BASELINE_INVALID");
      }

      const ended = await tx.userRoleAssignment.updateMany({
        where: { userId: director.id, role: "DIRECTOR", status: "ACTIVE" },
        data: {
          status: "ENDED",
          endedAt: new Date(),
          endedByUserId: director.id,
          activeKey: null
        }
      });
      if (ended.count !== 1) throw new Error("RELEASE_CI_DIRECTOR_ASSIGNMENT_INVALID");
      await tx.userRoleAssignment.create({
        data: {
          publicKey: randomUUID(),
          userId: director.id,
          role: "SUPER_ADMIN",
          reason: "Exact-head synthetic recovery fixture",
          assignedByUserId: director.id,
          activeKey: `${director.id}:SUPER_ADMIN`
        }
      });
      await tx.user.update({
        where: { id: director.id },
        data: { role: "SUPER_ADMIN" }
      });
    });

    const [superAdmins, students, payments] = await Promise.all([
      prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } }),
      prisma.student.count(),
      prisma.payment.count()
    ]);
    if (superAdmins !== 1 || students !== 0 || payments !== 0) {
      throw new Error("RELEASE_CI_SYNTHETIC_RESULT_INVALID");
    }
    console.log("Release CI synthetic recovery fixture prepared: users=4 superAdmins=1 students=0 payments=0");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "RELEASE_CI_SYNTHETIC_PREPARATION_FAILED");
  process.exitCode = 1;
});
