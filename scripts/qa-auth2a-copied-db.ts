import { randomBytes, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { fileSha256 } from "./migration-check-utils";
import { demoUserSeedDecision } from "../lib/demo-user-seed-safety";
import { ensureSeedUsers } from "../lib/seed-users";
import { hashPassword, verifyPassword } from "../lib/password";
import {
  createSessionCredentialTag,
  sessionAccountStateMatches
} from "../lib/session-token";
import { isRole } from "../lib/permissions";
import { assertSuperAdminSafetyAllowed } from "../lib/user-management";
import { getSystemHealth } from "../lib/system-health";

const WORKSPACE_ROOT = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE_ROOT, "prisma", "dev.db");
const ROOT = path.join(WORKSPACE_ROOT, "tmp", "auth2a", `AUTH2A-${process.pid}-${randomUUID()}`);
const SEED_COPY = path.join(ROOT, "seed-success.db");
const PARTIAL_COPY = path.join(ROOT, "partial-retained-set.db");
const CONTROL_COPY = path.join(ROOT, "account-sequence.db");
const HEALTH_COPY = path.join(ROOT, "health-report.db");

type Identity = { sha256: string; size: number; lastWriteUtc: string };

function identity(filePath: string): Identity {
  const stat = statSync(filePath);
  return {
    sha256: fileSha256(filePath),
    size: stat.size,
    lastWriteUtc: stat.mtime.toISOString()
  };
}

function assertOperationalUnchanged(expected: Identity) {
  if (JSON.stringify(identity(OPERATIONAL_DATABASE)) !== JSON.stringify(expected)) {
    throw new Error("AUTH2A_OPERATIONAL_DATABASE_CHANGED");
  }
}

function databaseUrl(filePath: string) {
  return `file:${filePath.replaceAll("\\", "/")}`;
}

function prismaFor(filePath: string) {
  return new PrismaClient({ datasourceUrl: databaseUrl(filePath) });
}

function suppliedPasswords() {
  const password = (role: string) => `AUTH2A-${role}-${randomBytes(18).toString("hex")}!`;
  return {
    SEED_DIRECTOR_PASSWORD: password("Leadership"),
    SEED_ADMIN_PASSWORD: password("Administration"),
    SEED_ACCOUNTANT_PASSWORD: password("Finance"),
    SEED_VIEWER_PASSWORD: password("Audit")
  };
}

function seedEnvironment(databasePath: string, extra: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl(databasePath),
    ALLOW_DEMO_USERS: "true",
    DEMO_USER_DATABASE_ROOT: ROOT,
    ...suppliedPasswords()
  };
  Object.assign(environment, extra);
  return environment;
}

function prepareCopies() {
  if (existsSync(ROOT)) throw new Error("AUTH2A_QA_ROOT_ALREADY_EXISTS");
  mkdirSync(ROOT, { recursive: true });
  for (const target of [SEED_COPY, PARTIAL_COPY, CONTROL_COPY, HEALTH_COPY]) {
    copyFileSync(OPERATIONAL_DATABASE, target);
  }
}

function removeUsersFromSeedCopy() {
  const database = new DatabaseSync(SEED_COPY);
  try {
    database.exec("PRAGMA foreign_keys=ON");
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec("DELETE FROM UserAudit; DELETE FROM User;");
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } finally {
    database.close();
  }
}

function removeOneRetainedRoleFromPartialCopy() {
  const database = new DatabaseSync(PARTIAL_COPY);
  try {
    database.exec("PRAGMA foreign_keys=ON");
    database.prepare("DELETE FROM User WHERE role = ?").run("ADMIN");
  } finally {
    database.close();
  }
}

async function expectRefusal(run: () => unknown | Promise<unknown>, code: string) {
  try {
    await run();
  } catch (error) {
    if (error instanceof Error && error.message.includes(code)) return;
    throw error;
  }
  throw new Error(`AUTH2A_EXPECTED_REFUSAL_MISSING:${code}`);
}

async function verifySeedSafeguards() {
  await expectRefusal(
    () => demoUserSeedDecision(seedEnvironment(OPERATIONAL_DATABASE), WORKSPACE_ROOT),
    "DEMO_USERS_REFUSED_OPERATIONAL_DATABASE"
  );
  await expectRefusal(
    () => demoUserSeedDecision(seedEnvironment(SEED_COPY, { NODE_ENV: "production" }), WORKSPACE_ROOT),
    "DEMO_USERS_FORBIDDEN_IN_RELEASE_ENVIRONMENT"
  );
  await expectRefusal(
    () => demoUserSeedDecision(seedEnvironment(SEED_COPY, { NALANDA_ENVIRONMENT: "staging" }), WORKSPACE_ROOT),
    "DEMO_USERS_FORBIDDEN_IN_RELEASE_ENVIRONMENT"
  );

  removeUsersFromSeedCopy();
  const seedClient = prismaFor(SEED_COPY);
  try {
    const created = await ensureSeedUsers(seedClient, seedEnvironment(SEED_COPY), WORKSPACE_ROOT);
    if (!created.enabled || created.createdRoles.length !== 4 || await seedClient.user.count() !== 4) {
      throw new Error("AUTH2A_ISOLATED_USER_SEED_FAILED");
    }
  } finally {
    await seedClient.$disconnect();
  }

  removeOneRetainedRoleFromPartialCopy();
  const partialClient = prismaFor(PARTIAL_COPY);
  try {
    await expectRefusal(
      () => ensureSeedUsers(partialClient, seedEnvironment(PARTIAL_COPY), WORKSPACE_ROOT),
      "DEMO_USERS_PARTIAL_RETAINED_SET_REFUSED"
    );
    if (await partialClient.user.count({ where: { role: "ADMIN" } }) !== 0) {
      throw new Error("AUTH2A_DELETED_ROLE_RECREATED");
    }
  } finally {
    await partialClient.$disconnect();
  }
}

async function sessionPayloadFor(user: {
  id: string;
  role: string;
  passwordHash: string;
}) {
  if (!isRole(user.role)) throw new Error("AUTH2A_TEST_ROLE_INVALID");
  return {
    userId: user.id,
    role: user.role,
    credentialTag: await createSessionCredentialTag(user.id, user.passwordHash)
  };
}

async function verifyCredentialInvalidation(client: PrismaClient) {
  const passwordTarget = await client.user.findFirstOrThrow({ where: { role: "VIEWER" } });
  const passwordPayload = await sessionPayloadFor(passwordTarget);
  const nextCredential = `AUTH2A-Rotated-${randomBytes(20).toString("hex")}!`;
  const nextHash = await hashPassword(nextCredential);
  await client.user.update({ where: { id: passwordTarget.id }, data: { passwordHash: nextHash } });
  const passwordChanged = await client.user.findUniqueOrThrow({ where: { id: passwordTarget.id } });
  if (
    !isRole(passwordChanged.role) ||
    await sessionAccountStateMatches(passwordPayload, {
      isActive: passwordChanged.isActive,
      role: passwordChanged.role,
      passwordHash: passwordChanged.passwordHash
    }) ||
    !await verifyPassword(nextCredential, passwordChanged.passwordHash)
  ) {
    throw new Error("AUTH2A_PASSWORD_INVALIDATION_FAILED");
  }
  await client.user.update({
    where: { id: passwordTarget.id },
    data: { passwordHash: passwordTarget.passwordHash }
  });

  const roleTarget = await client.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const rolePayload = await sessionPayloadFor(roleTarget);
  await client.user.update({ where: { id: roleTarget.id }, data: { role: "VIEWER" } });
  const roleChanged = await client.user.findUniqueOrThrow({ where: { id: roleTarget.id } });
  if (
    !isRole(roleChanged.role) ||
    await sessionAccountStateMatches(rolePayload, {
      isActive: roleChanged.isActive,
      role: roleChanged.role,
      passwordHash: roleChanged.passwordHash
    })
  ) {
    throw new Error("AUTH2A_ROLE_INVALIDATION_FAILED");
  }
  await client.user.update({ where: { id: roleTarget.id }, data: { role: roleTarget.role } });

  const statusTarget = await client.user.findFirstOrThrow({ where: { role: "ACCOUNTANT" } });
  const statusPayload = await sessionPayloadFor(statusTarget);
  await client.user.update({ where: { id: statusTarget.id }, data: { isActive: false } });
  const statusChanged = await client.user.findUniqueOrThrow({ where: { id: statusTarget.id } });
  const loginCandidate = await client.user.findFirst({
    where: { id: statusTarget.id, isActive: true }
  });
  if (
    loginCandidate ||
    !isRole(statusChanged.role) ||
    await sessionAccountStateMatches(statusPayload, {
      isActive: statusChanged.isActive,
      role: statusChanged.role,
      passwordHash: statusChanged.passwordHash
    })
  ) {
    throw new Error("AUTH2A_STATUS_INVALIDATION_FAILED");
  }
  await client.user.update({ where: { id: statusTarget.id }, data: { isActive: true } });
}

async function verifyDisabledSeedPreservationAndIdempotence(client: PrismaClient) {
  const target = await client.user.findFirstOrThrow({ where: { role: "ACCOUNTANT" } });
  await client.user.update({ where: { id: target.id }, data: { isActive: false } });
  const before = await client.user.findMany({
    select: { id: true, role: true, isActive: true, passwordHash: true },
    orderBy: { id: "asc" }
  });
  const first = await ensureSeedUsers(client, seedEnvironment(CONTROL_COPY), WORKSPACE_ROOT);
  const second = await ensureSeedUsers(client, seedEnvironment(CONTROL_COPY), WORKSPACE_ROOT);
  const after = await client.user.findMany({
    select: { id: true, role: true, isActive: true, passwordHash: true },
    orderBy: { id: "asc" }
  });
  if (
    first.createdRoles.length ||
    second.createdRoles.length ||
    !first.disabledPreservedRoles.includes("ACCOUNTANT") ||
    JSON.stringify(before) !== JSON.stringify(after)
  ) {
    throw new Error("AUTH2A_DISABLED_OR_IDEMPOTENT_SAFEGUARD_FAILED");
  }
  await client.user.update({ where: { id: target.id }, data: { isActive: true } });
}

async function verifyConcurrentSuperAdminProtection(client: PrismaClient) {
  const original = await client.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true } });
  const peer = await client.user.create({
    data: {
      name: "AUTH2A Copied QA Peer",
      username: `auth2a-peer-${randomUUID()}`,
      role: "SUPER_ADMIN",
      isActive: true,
      passwordHash: await hashPassword(`AUTH2A-Peer-${randomBytes(20).toString("hex")}!`)
    }
  });

  const change = (targetId: string, mode: "DISABLE" | "DEMOTE") =>
    client.$transaction(async (transaction) => {
      const target = await transaction.user.findUniqueOrThrow({ where: { id: targetId } });
      const activeSuperAdminCount = await transaction.user.count({
        where: { role: "SUPER_ADMIN", isActive: true }
      });
      assertSuperAdminSafetyAllowed({
        actorUserId: "auth2a-copied-qa-controller",
        targetUserId: target.id,
        targetRole: "SUPER_ADMIN",
        targetIsActive: target.isActive,
        nextIsActive: mode !== "DISABLE",
        nextRole: mode === "DEMOTE" ? "ADMIN" : "SUPER_ADMIN",
        activeSuperAdminCount
      });
      await transaction.user.update({
        where: { id: target.id },
        data: mode === "DISABLE" ? { isActive: false } : { role: "ADMIN" }
      });
    });

  const outcomes = await Promise.allSettled([
    change(original.id, "DISABLE"),
    change(peer.id, "DEMOTE")
  ]);
  const active = await client.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
  if (active < 1 || outcomes.every((outcome) => outcome.status === "fulfilled")) {
    throw new Error("AUTH2A_CONCURRENT_LAST_SUPER_ADMIN_NOT_BLOCKED");
  }
  await client.user.update({
    where: { id: original.id },
    data: { role: "SUPER_ADMIN", isActive: true }
  });
  await client.user.delete({ where: { id: peer.id } });
}

async function verifyFutureChangeAndRollback(client: PrismaClient) {
  const before = await client.user.findMany({
    select: { id: true, role: true, isActive: true, passwordHash: true },
    orderBy: { id: "asc" }
  });
  const leadership = before.find((row) => row.role === "SUPER_ADMIN" && row.isActive);
  if (!leadership || !isRole(leadership.role)) throw new Error("AUTH2A_ACTIVE_SUPER_ADMIN_MISSING");
  const stalePayload = await sessionPayloadFor(leadership);
  const rotatedCredential = `AUTH2A-Future-Rotation-${randomBytes(20).toString("hex")}!`;

  await client.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: leadership.id },
      data: { passwordHash: await hashPassword(rotatedCredential) }
    });
    await transaction.user.updateMany({
      where: { role: { in: ["ADMIN", "ACCOUNTANT", "VIEWER"] } },
      data: { isActive: false }
    });
  });

  const changedLeadership = await client.user.findUniqueOrThrow({ where: { id: leadership.id } });
  const activeSuperAdmins = await client.user.count({ where: { role: "SUPER_ADMIN", isActive: true } });
  const activeDeferredAccounts = await client.user.count({
    where: { role: { in: ["ADMIN", "ACCOUNTANT", "VIEWER"] }, isActive: true }
  });
  if (
    activeSuperAdmins < 1 ||
    activeDeferredAccounts !== 0 ||
    await sessionAccountStateMatches(stalePayload, {
      isActive: changedLeadership.isActive,
      role: "SUPER_ADMIN",
      passwordHash: changedLeadership.passwordHash
    }) ||
    !await verifyPassword(rotatedCredential, changedLeadership.passwordHash)
  ) {
    throw new Error("AUTH2A_FUTURE_ACCOUNT_SEQUENCE_FAILED");
  }

  await client.$transaction(
    before.map((row) => client.user.update({
      where: { id: row.id },
      data: {
        role: row.role,
        isActive: row.isActive,
        passwordHash: row.passwordHash
      }
    }))
  );
  const rolledBack = await client.user.findMany({
    select: { id: true, role: true, isActive: true, passwordHash: true },
    orderBy: { id: "asc" }
  });
  if (JSON.stringify(rolledBack) !== JSON.stringify(before)) {
    throw new Error("AUTH2A_FUTURE_ACCOUNT_ROLLBACK_FAILED");
  }
}

async function verifyAccountSequence() {
  const client = prismaFor(CONTROL_COPY);
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = randomBytes(48).toString("base64url");
  try {
    await verifyCredentialInvalidation(client);
    await verifyDisabledSeedPreservationAndIdempotence(client);
    await verifyConcurrentSuperAdminProtection(client);
    await verifyFutureChangeAndRollback(client);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
    await client.$disconnect();
  }
}

async function verifySafeSystemHealth() {
  const client = prismaFor(HEALTH_COPY);
  try {
    const health = await getSystemHealth(client, {
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl(HEALTH_COPY),
      AUTH_SECRET: randomBytes(48).toString("base64url")
    });
    const safeEvidence = {
      status: health.status,
      issueCodes: health.issues.map((issue) => issue.code),
      seedAccounts: health.seedAccounts
    };
    const serialized = JSON.stringify(safeEvidence);
    const activeSeedRole = safeEvidence.seedAccounts[0];
    if (
      health.status !== "Good" ||
      safeEvidence.issueCodes.length !== 0 ||
      safeEvidence.seedAccounts.length !== 1 ||
      activeSeedRole?.role !== "SUPER_ADMIN" ||
      activeSeedRole.activeCount !== 1 ||
      activeSeedRole.defaultPasswordMatches !== 0 ||
      /username|email|passwordHash|@nalanda\.local/i.test(serialized)
    ) {
      throw new Error("AUTH2A_SYSTEM_HEALTH_SAFE_COUNTS_FAILED");
    }
    return safeEvidence;
  } finally {
    await client.$disconnect();
  }
}

function verifyOrdinaryStartupNoOp() {
  const packageJson = JSON.parse(readFileSync(path.join(WORKSPACE_ROOT, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  for (const name of ["dev", "build", "start"]) {
    const script = packageJson.scripts[name];
    if (script && /seed|ensureSeedUsers/i.test(script)) {
      throw new Error("AUTH2A_ORDINARY_STARTUP_SEED_HOOK_FOUND");
    }
  }
}

async function main() {
  const operationalBefore = identity(OPERATIONAL_DATABASE);
  try {
    prepareCopies();
    verifyOrdinaryStartupNoOp();
    await verifySeedSafeguards();
    await verifyAccountSequence();
    const health = await verifySafeSystemHealth();
    assertOperationalUnchanged(operationalBefore);
    console.log(JSON.stringify({
      status: "AUTH2A_COPIED_DATABASE_QA_PASSED",
      seedRefusals: {
        operationalDatabase: true,
        production: true,
        staging: true,
        partialRetainedSet: true
      },
      isolatedSeedCreatedCount: 4,
      disabledSeedAccountPreserved: true,
      ordinaryStartupNoOp: true,
      staleAuthorizationInvalidation: {
        password: true,
        role: true,
        status: true
      },
      concurrentLastSuperAdminProtected: true,
      futureSequenceAndRollback: true,
      repeatedSafeguardIdempotent: true,
      systemHealth: health,
      operationalDatabaseUnchanged: true
    }, null, 2));
  } finally {
    assertOperationalUnchanged(operationalBefore);
    rmSync(ROOT, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "AUTH2A_COPIED_DATABASE_QA_FAILED");
  process.exitCode = 1;
});
