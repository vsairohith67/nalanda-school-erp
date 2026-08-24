import { randomUUID } from "node:crypto";
import { existsSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

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
