import { randomBytes, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  executeSuperAdminRecovery,
  fileSha256,
  safeSuperAdminRecoveryFailure,
  SUPER_ADMIN_RECOVERY_CONFIRMATION,
  SUPER_ADMIN_RECOVERY_SUCCESS,
  SuperAdminRecoveryRefusal
} from "@/lib/super-admin-recovery";
import {
  documentedSeedPasswordForAudit,
  SEED_USER_DEFINITIONS
} from "@/lib/seed-users";
import { hashPassword, verifyPassword } from "@/lib/password";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const TMP_ROOT = path.join(WORKSPACE, "tmp");
const ROOT = path.join(TMP_ROOT, `auth-recovery-${process.pid}-${randomUUID()}`);

type Scenario = {
  databasePath: string;
  rollbackPath: string;
  environment: NodeJS.ProcessEnv;
};

function databaseUrl(filePath: string) {
  return `file:${filePath.replaceAll("\\", "/")}`;
}

function prismaFor(filePath: string) {
  return new PrismaClient({ datasourceUrl: databaseUrl(filePath) });
}

function strongPassword(label: string) {
  return `AUTH-R1-${label}-${randomBytes(18).toString("hex")}!`;
}

async function scenario(
  name: string,
  mutate?: (client: PrismaClient) => Promise<void>
): Promise<Scenario> {
  const directory = path.join(ROOT, name);
  mkdirSync(directory, { recursive: true });
  const databasePath = path.join(directory, "recovery-copy.db");
  const rollbackPath = path.join(directory, "rollback-copy.db");
  copyFileSync(OPERATIONAL_DATABASE, databasePath);
  const migrationPath = path.join(WORKSPACE, "prisma", "migrations", "20260731130549_auth_verified_recovery_session_registry", "migration.sql");
  execFileSync(process.execPath, ["--experimental-sqlite", "-e", 'const {DatabaseSync}=require("node:sqlite");const fs=require("node:fs");const db=new DatabaseSync(process.argv[1]);try{const exists=db.prepare("SELECT 1 FROM sqlite_master WHERE type=\'table\' AND name=\'AuthLoginAlias\'").get();if(!exists)db.exec(fs.readFileSync(process.argv[2],"utf8"));}finally{db.close();}', databasePath, migrationPath]);
  const iamMigrationPath = path.join(WORKSPACE, "prisma", "migrations", "20260801110000_iam_named_users_permission_contexts", "migration.sql");
  execFileSync(process.execPath, ["--experimental-sqlite", "-e", 'const {DatabaseSync}=require("node:sqlite");const fs=require("node:fs");const db=new DatabaseSync(process.argv[1]);try{const exists=db.prepare("SELECT 1 FROM pragma_table_info(\'User\') WHERE name=\'iamPublicKey\'").get();if(!exists)db.exec(fs.readFileSync(process.argv[2],"utf8"));}finally{db.close();}', databasePath, iamMigrationPath]);
  if (mutate) {
    const client = prismaFor(databasePath);
    try {
      await mutate(client);
    } finally {
      await client.$disconnect();
    }
  }
  copyFileSync(databasePath, rollbackPath);
  return {
    databasePath,
    rollbackPath,
    environment: {
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl(databasePath),
      AUTH_RECOVERY_QA_MODE: "true",
      AUTH_RECOVERY_QA_ROOT: ROOT,
      AUTH_RECOVERY_QA_DATABASE_PATH: databasePath,
      AUTH_RECOVERY_EXPECTED_DB_SHA256: fileSha256(databasePath),
      AUTH_RECOVERY_ROLLBACK_PATH: rollbackPath,
      AUTH_RECOVERY_ROLLBACK_SHA256: fileSha256(rollbackPath)
    }
  };
}

function recoveryInput(
  testScenario: Scenario,
  overrides: Partial<Parameters<typeof executeSuperAdminRecovery>[0]> = {}
) {
  const password = strongPassword("Valid");
  return {
    environment: testScenario.environment,
    workspaceRoot: WORKSPACE,
    identifier: "director",
    newPassword: password,
    confirmPassword: password,
    confirmationPhrase: SUPER_ADMIN_RECOVERY_CONFIRMATION,
    ...overrides
  };
}

async function expectCode(run: Promise<unknown>, code: string) {
  await expect(run).rejects.toMatchObject({ code });
}

describe("local Super Admin recovery utility", () => {
  const operationalBefore = {
    sha256: "",
    size: 0,
    mtime: 0
  };

  beforeAll(() => {
    mkdirSync(TMP_ROOT, { recursive: true });
    if (existsSync(ROOT)) throw new Error("AUTH_RECOVERY_QA_ROOT_ALREADY_EXISTS");
    mkdirSync(ROOT, { recursive: true });
    const stat = statSync(OPERATIONAL_DATABASE);
    operationalBefore.sha256 = fileSha256(OPERATIONAL_DATABASE);
    operationalBefore.size = stat.size;
    operationalBefore.mtime = stat.mtimeMs;
  });

  afterAll(() => {
    const stat = statSync(OPERATIONAL_DATABASE);
    expect(fileSha256(OPERATIONAL_DATABASE)).toBe(operationalBefore.sha256);
    expect(stat.size).toBe(operationalBefore.size);
    expect(stat.mtimeMs).toBe(operationalBefore.mtime);
    rmSync(ROOT, { recursive: true, force: true });
  });

  it("performs a valid copied-database recovery and creates one safe audit event", async () => {
    const testScenario = await scenario("valid");
    const beforeClient = prismaFor(testScenario.databasePath);
    const auditEventsBefore = await beforeClient.userAudit.count({
      where: { action: "SUPER_ADMIN_PASSWORD_RECOVERED" }
    });
    await beforeClient.$disconnect();
    const password = strongPassword("ValidRecovery");
    const result = await executeSuperAdminRecovery(recoveryInput(testScenario, {
      newPassword: password,
      confirmPassword: password
    }));
    expect(result).toEqual({
      status: SUPER_ADMIN_RECOVERY_SUCCESS,
      role: "SUPER_ADMIN",
      auditEventsCreated: 1
    });
    const client = prismaFor(testScenario.databasePath);
    try {
      const user = await client.user.findUniqueOrThrow({
        where: { username: "director" },
        select: { passwordHash: true }
      });
      expect(await verifyPassword(password, user.passwordHash)).toBe(true);
      const events = await client.userAudit.findMany({
        where: { action: "SUPER_ADMIN_PASSWORD_RECOVERED" },
        orderBy: { createdAt: "asc" },
        skip: auditEventsBefore,
        select: { actorName: true, detailsJson: true }
      });
      expect(events).toEqual([{
        actorName: "Local operational recovery",
        detailsJson: JSON.stringify({
          method: "LOCAL_HIDDEN_INPUT",
          role: "SUPER_ADMIN"
        })
      }]);
      expect(JSON.stringify(events)).not.toContain("director");
      expect(JSON.stringify(events)).not.toContain(password);
    } finally {
      await client.$disconnect();
    }
  });

  it("refuses a wrong identifier", async () => {
    const testScenario = await scenario("wrong-identifier");
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(testScenario, {
        identifier: "missing-account"
      })),
      "AUTH_RECOVERY_ACCOUNT_NOT_FOUND"
    );
  });

  it("refuses an inactive account", async () => {
    const testScenario = await scenario("inactive", async (client) => {
      const [director, secondOwner] = await Promise.all([
        client.user.findUniqueOrThrow({ where: { username: "director" }, select: { id: true } }),
        client.user.update({
          where: { username: "admin" },
          data: { isActive: true, lifecycleStatus: "ACTIVE" },
          select: { id: true }
        })
      ]);
      await client.userRoleAssignment.create({
        data: {
          publicKey: randomUUID(),
          userId: secondOwner.id,
          role: "SUPER_ADMIN",
          reason: "AUTH recovery inactive-account QA safety peer",
          assignedByUserId: director.id,
          activeKey: `${secondOwner.id}:SUPER_ADMIN`
        }
      });
      await client.user.update({
        where: { username: "director" },
        data: { isActive: false, lifecycleStatus: "SUSPENDED" }
      });
    });
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(testScenario)),
      "AUTH_RECOVERY_ACCOUNT_INACTIVE"
    );
  });

  it("refuses a non-Super-Admin target", async () => {
    const testScenario = await scenario("non-super-admin", async (client) => {
      await client.user.update({
        where: { username: "admin" },
        data: { isActive: true }
      });
    });
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(testScenario, {
        identifier: "admin"
      })),
      "AUTH_RECOVERY_TARGET_NOT_SUPER_ADMIN"
    );
  });

  it("refuses an identifier matching more than one account", async () => {
    const testScenario = await scenario("duplicate-match", async (client) => {
      const user = await client.user.create({
        data: {
          name: "QA duplicate match",
          username: `qa-duplicate-${randomUUID()}`,
          role: "VIEWER",
          isActive: true,
          passwordHash: await hashPassword(strongPassword("Duplicate"))
        }
      });
      await client.authLoginAlias.create({ data: { userId: user.id, type: "USERNAME", normalizedValue: "DIRECTOR", displayMasked: "DIRECTOR", status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
    });
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(testScenario)),
      "AUTH_RECOVERY_IDENTIFIER_AMBIGUOUS"
    );
  });

  it("refuses weak, documented, and mismatched passwords", async () => {
    const weak = await scenario("weak-password");
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(weak, {
        newPassword: "short",
        confirmPassword: "short"
      })),
      "AUTH_RECOVERY_PASSWORD_POLICY_REFUSED"
    );

    const documented = await scenario("documented-password");
    const documentedPassword = documentedSeedPasswordForAudit(
      SEED_USER_DEFINITIONS[0]
    );
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(documented, {
        newPassword: documentedPassword,
        confirmPassword: documentedPassword
      })),
      "AUTH_RECOVERY_DOCUMENTED_PASSWORD_REFUSED"
    );

    const configuredDemo = await scenario("configured-demo-password");
    const configuredDemoPassword = strongPassword("ConfiguredDemo");
    configuredDemo.environment.SEED_DIRECTOR_PASSWORD = configuredDemoPassword;
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(configuredDemo, {
        newPassword: configuredDemoPassword,
        confirmPassword: configuredDemoPassword
      })),
      "AUTH_RECOVERY_DOCUMENTED_PASSWORD_REFUSED"
    );

    const mismatch = await scenario("mismatched-password");
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(mismatch, {
        newPassword: strongPassword("One"),
        confirmPassword: strongPassword("Two")
      })),
      "AUTH_RECOVERY_PASSWORD_CONFIRMATION_MISMATCH"
    );

    const wrongPhrase = await scenario("wrong-confirmation-phrase");
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(wrongPhrase, {
        confirmationPhrase: "continue"
      })),
      "AUTH_RECOVERY_CONFIRMATION_PHRASE_REQUIRED"
    );
  });

  it("refuses unsafe database paths and changed database hashes", async () => {
    const unsafeDirectory = path.join(TMP_ROOT, `auth-recovery-outside-${randomUUID()}`);
    mkdirSync(unsafeDirectory, { recursive: true });
    const unsafeDatabase = path.join(unsafeDirectory, "unsafe.db");
    const unsafeRollback = path.join(unsafeDirectory, "unsafe-rollback.db");
    copyFileSync(OPERATIONAL_DATABASE, unsafeDatabase);
    copyFileSync(OPERATIONAL_DATABASE, unsafeRollback);
    const unsafeEnvironment: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      DATABASE_URL: databaseUrl(unsafeDatabase),
      AUTH_RECOVERY_QA_MODE: "true",
      AUTH_RECOVERY_QA_ROOT: ROOT,
      AUTH_RECOVERY_QA_DATABASE_PATH: unsafeDatabase,
      AUTH_RECOVERY_EXPECTED_DB_SHA256: fileSha256(unsafeDatabase),
      AUTH_RECOVERY_ROLLBACK_PATH: unsafeRollback,
      AUTH_RECOVERY_ROLLBACK_SHA256: fileSha256(unsafeRollback)
    };
    try {
      const placeholder = await scenario("unsafe-placeholder");
      await expectCode(
        executeSuperAdminRecovery(recoveryInput(placeholder, {
          environment: unsafeEnvironment
        })),
        "AUTH_RECOVERY_QA_DATABASE_OUTSIDE_ISOLATED_ROOT"
      );
    } finally {
      rmSync(unsafeDirectory, { recursive: true, force: true });
    }

    const changedHash = await scenario("changed-hash");
    changedHash.environment.AUTH_RECOVERY_EXPECTED_DB_SHA256 = "0".repeat(64);
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(changedHash)),
      "AUTH_RECOVERY_DATABASE_HASH_MISMATCH"
    );

    const operationalModeCopy = await scenario("operational-mode-copy");
    const operationalModeEnvironment: NodeJS.ProcessEnv = {
      ...operationalModeCopy.environment,
      AUTH_RECOVERY_QA_MODE: "false",
      AUTH_RECOVERY_QA_ROOT: undefined,
      AUTH_RECOVERY_QA_DATABASE_PATH: undefined
    };
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(operationalModeCopy, {
        environment: operationalModeEnvironment
      })),
      "AUTH_RECOVERY_OPERATIONAL_DATABASE_PATH_REQUIRED"
    );
  });

  it("refuses a missing rollback artifact and production/staging environments", async () => {
    const missingRollback = await scenario("missing-rollback");
    rmSync(missingRollback.rollbackPath);
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(missingRollback)),
      "AUTH_RECOVERY_ROLLBACK_ARTIFACT_MISSING"
    );

    const releaseEnvironments: Array<{
      name: string;
      values: Partial<NodeJS.ProcessEnv>;
    }> = [
      { name: "production", values: { NODE_ENV: "production" } },
      { name: "staging", values: { NALANDA_ENVIRONMENT: "staging" } }
    ];
    for (const release of releaseEnvironments) {
      const testScenario = await scenario(`release-${release.name}`);
      testScenario.environment = {
        ...testScenario.environment,
        ...release.values
      };
      await expectCode(
        executeSuperAdminRecovery(recoveryInput(testScenario)),
        "AUTH_RECOVERY_REMOTE_RELEASE_ENVIRONMENT_REFUSED"
      );
    }
  });

  it("increments credential version and revokes persisted sessions", async () => {
    const testScenario = await scenario("stale-authorization", async (client) => {
      const user = await client.user.findUniqueOrThrow({ where: { username: "director" }, select: { id: true, credentialVersion: true } });
      await client.authSession.create({ data: { id: randomUUID(), userId: user.id, tokenHash: randomBytes(32).toString("hex"), credentialVersion: user.credentialVersion, expiresAt: new Date(Date.now() + 60_000), deviceSummary: "Desktop", browserSummary: "Test browser", networkEvidenceMasked: "Direct connection" } });
    });
    const client = prismaFor(testScenario.databasePath);
    const before = await client.user.findUniqueOrThrow({
      where: { username: "director" },
      select: {
        id: true,
        role: true,
        isActive: true,
        passwordHash: true,
        credentialVersion: true
      }
    });
    await client.$disconnect();

    await executeSuperAdminRecovery(recoveryInput(testScenario));
    const afterClient = prismaFor(testScenario.databasePath);
    try {
      const after = await afterClient.user.findUniqueOrThrow({
        where: { username: "director" },
        select: { role: true, isActive: true, passwordHash: true, credentialVersion: true, authSessions: { select: { revokedAt: true, revocationReason: true } } }
      });
      expect(after.credentialVersion).toBe(before.credentialVersion + 1);
      expect(after.authSessions).toEqual([{ revokedAt: expect.any(Date), revocationReason: "LOCAL_SUPER_ADMIN_RECOVERY" }]);
    } finally {
      await afterClient.$disconnect();
    }
  });

  it("supports repeated governed recovery with a fresh checkpoint each time", async () => {
    const testScenario = await scenario("repeated");
    const beforeClient = prismaFor(testScenario.databasePath);
    const auditEventsBefore = await beforeClient.userAudit.count({
      where: { action: "SUPER_ADMIN_PASSWORD_RECOVERED" }
    });
    await beforeClient.$disconnect();
    await executeSuperAdminRecovery(recoveryInput(testScenario));
    copyFileSync(testScenario.databasePath, testScenario.rollbackPath);
    testScenario.environment.AUTH_RECOVERY_EXPECTED_DB_SHA256 =
      fileSha256(testScenario.databasePath);
    testScenario.environment.AUTH_RECOVERY_ROLLBACK_SHA256 =
      fileSha256(testScenario.rollbackPath);
    const secondPassword = strongPassword("Repeated");
    await executeSuperAdminRecovery(recoveryInput(testScenario, {
      newPassword: secondPassword,
      confirmPassword: secondPassword
    }));
    const client = prismaFor(testScenario.databasePath);
    try {
      expect(await client.userAudit.count({
        where: { action: "SUPER_ADMIN_PASSWORD_RECOVERED" }
      })).toBe(auditEventsBefore + 2);
      const row = await client.user.findUniqueOrThrow({
        where: { username: "director" },
        select: { passwordHash: true }
      });
      expect(await verifyPassword(secondPassword, row.passwordHash)).toBe(true);
    } finally {
      await client.$disconnect();
    }
  });

  it("rolls back the credential update when the audit transaction fails", async () => {
    const testScenario = await scenario("rollback-on-failure");
    const beforeClient = prismaFor(testScenario.databasePath);
    const before = await beforeClient.user.findUniqueOrThrow({
      where: { username: "director" },
      select: { passwordHash: true }
    });
    const auditCount = await beforeClient.userAudit.count();
    await beforeClient.$disconnect();

    await expectCode(
      executeSuperAdminRecovery(recoveryInput(testScenario, {
        qaSimulateFailureAfterCredentialUpdate: true
      })),
      "AUTH_RECOVERY_QA_SIMULATED_FAILURE"
    );
    const afterClient = prismaFor(testScenario.databasePath);
    try {
      const after = await afterClient.user.findUniqueOrThrow({
        where: { username: "director" },
        select: { passwordHash: true }
      });
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(await afterClient.userAudit.count()).toBe(auditCount);
    } finally {
      await afterClient.$disconnect();
    }
  });

  it("keeps command output and source free of supplied secret material", async () => {
    const secretMarker = "QA_SECRET_MARKER_DO_NOT_ECHO";
    const safeFailure = safeSuperAdminRecoveryFailure(
      new SuperAdminRecoveryRefusal("AUTH_RECOVERY_PASSWORD_POLICY_REFUSED")
    );
    expect(SUPER_ADMIN_RECOVERY_SUCCESS).not.toContain(secretMarker);
    expect(safeFailure).not.toContain(secretMarker);

    const cli = readFileSync(
      path.join(WORKSPACE, "scripts", "recover-super-admin.ts"),
      "utf8"
    );
    const packageJson = JSON.parse(
      readFileSync(path.join(WORKSPACE, "package.json"), "utf8")
    ) as { scripts: Record<string, string> };
    expect(packageJson.scripts["auth:recover-super-admin"]).toBe(
      "tsx scripts/recover-super-admin.ts"
    );
    expect(cli).toContain("HiddenPromptOutput");
    expect(cli).toContain("stdin.isTTY");
    expect(cli).toContain("process.argv.slice(2).length !== 0");
    expect(cli).not.toContain("process.argv[2]");
    expect(cli).not.toMatch(/console\.(?:log|error)/);
    expect(cli).not.toContain(secretMarker);

    const appEntries = readdirSync(path.join(WORKSPACE, "app"), {
      recursive: true,
      withFileTypes: true
    }).map((entry) => entry.name.toLowerCase());
    expect(appEntries.some((name) => name.includes("recover-super-admin"))).toBe(false);
  });

  it("refuses a non-zero business database", async () => {
    const testScenario = await scenario("non-zero-baseline", async (client) => {
      await client.student.create({
        data: {
          admissionNo: "AUTH-R1-QA-STUDENT",
          studentName: "AUTH R1 QA",
          fatherName: "QA",
          className: "1",
          phone1: "0000000000"
        }
      });
    });
    await expectCode(
      executeSuperAdminRecovery(recoveryInput(testScenario)),
      "AUTH_RECOVERY_ZERO_BASELINE_REQUIRED"
    );
  });
});
