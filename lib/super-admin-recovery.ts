import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  realpathSync,
  statSync
} from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword, validateNewPassword } from "@/lib/password";
import {
  documentedSeedPasswordForAudit,
  SEED_USER_DEFINITIONS
} from "@/lib/seed-users";
import { loginIdentifierCandidates } from "@/lib/auth-identifiers";

export const SUPER_ADMIN_RECOVERY_CONFIRMATION =
  "RECOVER LOCAL OPERATIONAL SUPER ADMIN";
export const SUPER_ADMIN_RECOVERY_SUCCESS =
  "SUPER_ADMIN_PASSWORD_RECOVERY_COMPLETED";

export class SuperAdminRecoveryRefusal extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "SuperAdminRecoveryRefusal";
  }
}

export type SuperAdminRecoveryConfig = {
  mode: "operational" | "qa";
  workspaceRoot: string;
  databasePath: string;
  expectedDatabaseSha256: string;
  rollbackArtifactPath: string;
  expectedRollbackSha256: string;
  isolatedQaRoot?: string;
};

export type ExecuteSuperAdminRecoveryInput = {
  environment?: NodeJS.ProcessEnv;
  workspaceRoot?: string;
  identifier: string;
  newPassword: string;
  confirmPassword: string;
  confirmationPhrase: string;
  qaSimulateFailureAfterCredentialUpdate?: boolean;
};

type RecoveryTarget = {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  passwordHash: string;
  credentialVersion: number;
};

function canonicalPath(candidate: string) {
  const resolved = path.resolve(candidate);
  return existsSync(resolved) ? realpathSync.native(resolved) : resolved;
}

function samePath(left: string, right: string) {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function inside(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

function sameFileIdentity(left: string, right: string) {
  if (!existsSync(left) || !existsSync(right)) return false;
  // Windows file identifiers can exceed Number.MAX_SAFE_INTEGER. Comparing the
  // default numeric `ino` values can therefore make distinct copies collide.
  const leftStat = statSync(left, { bigint: true });
  const rightStat = statSync(right, { bigint: true });
  return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
}

function databasePathFromUrl(databaseUrl: string, workspaceRoot: string) {
  if (!databaseUrl.startsWith("file:") || databaseUrl.includes("?") || databaseUrl.includes("#")) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_DATABASE_URL_INVALID");
  }
  let raw: string;
  try {
    raw = decodeURIComponent(databaseUrl.slice(5).trim());
  } catch {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_DATABASE_URL_INVALID");
  }
  if (!raw) throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_DATABASE_URL_INVALID");
  if (/^\/[A-Za-z]:[\\/]/.test(raw)) raw = raw.slice(1);
  const normalized = raw.replaceAll("/", path.sep);
  return path.isAbsolute(normalized)
    ? canonicalPath(normalized)
    : canonicalPath(path.join(workspaceRoot, "prisma", normalized));
}

function requiredHash(environment: NodeJS.ProcessEnv, name: string) {
  const value = environment[name]?.trim().toUpperCase() ?? "";
  if (!/^[A-F0-9]{64}$/.test(value)) {
    throw new SuperAdminRecoveryRefusal(`${name}_REQUIRED`);
  }
  return value;
}

function requiredAbsolutePath(environment: NodeJS.ProcessEnv, name: string) {
  const value = environment[name]?.trim() ?? "";
  if (!value || !path.isAbsolute(value)) {
    throw new SuperAdminRecoveryRefusal(`${name}_MUST_BE_ABSOLUTE`);
  }
  return canonicalPath(value);
}

function releaseEnvironmentRefused(environment: NodeJS.ProcessEnv) {
  const releaseValues = [
    environment.NODE_ENV,
    environment.NALANDA_ENVIRONMENT,
    environment.VERCEL_ENV,
    environment.DEPLOYMENT_ENV,
    environment.APP_ENV
  ].map((value) => value?.trim().toLowerCase());
  return releaseValues.some((value) => value === "production" || value === "staging") ||
    Boolean(
      environment.VERCEL ||
      environment.AWS_LAMBDA_FUNCTION_NAME ||
      environment.RENDER ||
      environment.RAILWAY_ENVIRONMENT ||
      environment.FLY_APP_NAME
    );
}

function requireRegularDatabaseFile(filePath: string, code: string) {
  if (
    !existsSync(filePath) ||
    !statSync(filePath).isFile() ||
    !/\.(?:db|sqlite|sqlite3)$/i.test(filePath)
  ) {
    throw new SuperAdminRecoveryRefusal(code);
  }
}

export function fileSha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex").toUpperCase();
}

export function resolveSuperAdminRecoveryConfig(
  environment: NodeJS.ProcessEnv = process.env,
  workspaceRoot = process.cwd()
): SuperAdminRecoveryConfig {
  if (releaseEnvironmentRefused(environment)) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_REMOTE_RELEASE_ENVIRONMENT_REFUSED");
  }

  const workspace = canonicalPath(workspaceRoot);
  const operationalDatabase = canonicalPath(path.join(workspace, "prisma", "dev.db"));
  const expectedDatabaseSha256 = requiredHash(environment, "AUTH_RECOVERY_EXPECTED_DB_SHA256");
  const expectedRollbackSha256 = requiredHash(environment, "AUTH_RECOVERY_ROLLBACK_SHA256");
  const rollbackArtifactPath = requiredAbsolutePath(environment, "AUTH_RECOVERY_ROLLBACK_PATH");
  const qaFlag = environment.AUTH_RECOVERY_QA_MODE?.trim();
  if (qaFlag && qaFlag !== "true" && qaFlag !== "false") {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_QA_MODE_INVALID");
  }
  const qaMode = qaFlag === "true";

  if (!qaMode) {
    if (
      environment.AUTH_RECOVERY_QA_DATABASE_PATH ||
      environment.AUTH_RECOVERY_QA_ROOT
    ) {
      throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_QA_CONFIGURATION_REQUIRES_QA_MODE");
    }
    const configuredDatabase = databasePathFromUrl(
      environment.DATABASE_URL?.trim() ?? "",
      workspace
    );
    if (!samePath(configuredDatabase, operationalDatabase)) {
      throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_OPERATIONAL_DATABASE_PATH_REQUIRED");
    }
    requireRegularDatabaseFile(
      operationalDatabase,
      "AUTH_RECOVERY_OPERATIONAL_DATABASE_NOT_FOUND"
    );
    const backupsRoot = canonicalPath(path.join(workspace, "backups"));
    if (!inside(backupsRoot, rollbackArtifactPath)) {
      throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_ROLLBACK_MUST_BE_PROTECTED_BACKUP");
    }
    requireRegularDatabaseFile(
      rollbackArtifactPath,
      "AUTH_RECOVERY_ROLLBACK_ARTIFACT_MISSING"
    );
    if (sameFileIdentity(operationalDatabase, rollbackArtifactPath)) {
      throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_ROLLBACK_MUST_BE_SEPARATE_FILE");
    }
    return {
      mode: "operational",
      workspaceRoot: workspace,
      databasePath: operationalDatabase,
      expectedDatabaseSha256,
      rollbackArtifactPath,
      expectedRollbackSha256
    };
  }

  const ignoredRoot = canonicalPath(path.join(workspace, "tmp"));
  const isolatedQaRoot = requiredAbsolutePath(environment, "AUTH_RECOVERY_QA_ROOT");
  const qaDatabasePath = requiredAbsolutePath(
    environment,
    "AUTH_RECOVERY_QA_DATABASE_PATH"
  );
  if (!inside(ignoredRoot, isolatedQaRoot)) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_QA_ROOT_MUST_BE_IGNORED");
  }
  if (!inside(isolatedQaRoot, qaDatabasePath)) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_QA_DATABASE_OUTSIDE_ISOLATED_ROOT");
  }
  if (!inside(isolatedQaRoot, rollbackArtifactPath)) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_QA_ROLLBACK_OUTSIDE_ISOLATED_ROOT");
  }
  requireRegularDatabaseFile(qaDatabasePath, "AUTH_RECOVERY_QA_DATABASE_NOT_FOUND");
  requireRegularDatabaseFile(
    rollbackArtifactPath,
    "AUTH_RECOVERY_ROLLBACK_ARTIFACT_MISSING"
  );
  if (
    samePath(qaDatabasePath, operationalDatabase) ||
    sameFileIdentity(qaDatabasePath, operationalDatabase)
  ) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_QA_REFUSED_OPERATIONAL_DATABASE");
  }
  if (sameFileIdentity(qaDatabasePath, rollbackArtifactPath)) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_ROLLBACK_MUST_BE_SEPARATE_FILE");
  }
  return {
    mode: "qa",
    workspaceRoot: workspace,
    databasePath: qaDatabasePath,
    expectedDatabaseSha256,
    rollbackArtifactPath,
    expectedRollbackSha256,
    isolatedQaRoot
  };
}

export function assertSuperAdminRecoverySafetyFiles(config: SuperAdminRecoveryConfig) {
  requireRegularDatabaseFile(config.databasePath, "AUTH_RECOVERY_DATABASE_NOT_FOUND");
  requireRegularDatabaseFile(
    config.rollbackArtifactPath,
    "AUTH_RECOVERY_ROLLBACK_ARTIFACT_MISSING"
  );
  if (fileSha256(config.databasePath) !== config.expectedDatabaseSha256) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_DATABASE_HASH_MISMATCH");
  }
  if (fileSha256(config.rollbackArtifactPath) !== config.expectedRollbackSha256) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_ROLLBACK_HASH_MISMATCH");
  }
}

function databaseUrl(databasePath: string) {
  return `file:${databasePath.replaceAll("\\", "/")}`;
}

async function assertZeroBusinessBaseline(client: PrismaClient | Prisma.TransactionClient) {
  const [students, enrollments, payments, guardians, staff, collection] =
    await Promise.all([
      client.student.count(),
      client.academicYearEnrollment.count({ where: { status: "ACTIVE" } }),
      client.payment.count(),
      client.guardian.count(),
      client.staffMember.count(),
      client.payment.aggregate({
        where: { isCancelled: false, deletedAt: null },
        _sum: { amountPaid: true }
      })
    ]);
  if (
    students !== 0 ||
    enrollments !== 0 ||
    payments !== 0 ||
    Number(collection._sum.amountPaid ?? 0) !== 0 ||
    guardians !== 0 ||
    staff !== 0
  ) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_ZERO_BASELINE_REQUIRED");
  }
}

async function findRecoveryTarget(
  client: PrismaClient | Prisma.TransactionClient,
  identifier: string
): Promise<RecoveryTarget> {
  const candidates = loginIdentifierCandidates(identifier);
  const aliases = await client.authLoginAlias.findMany({
    where: { normalizedValue: { in: candidates }, status: "VERIFIED" },
    include: { user: true },
    take: 2
  });
  if (aliases.length === 0) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_ACCOUNT_NOT_FOUND");
  }
  if (aliases.length !== 1) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_IDENTIFIER_AMBIGUOUS");
  }
  const target = aliases[0].user;
  if (!target.isActive) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_ACCOUNT_INACTIVE");
  }
  if (target.role !== "SUPER_ADMIN") {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_TARGET_NOT_SUPER_ADMIN");
  }
  return target;
}

function validateRecoveryPassword(
  password: string,
  confirmation: string,
  environment: NodeJS.ProcessEnv
) {
  if (password !== confirmation) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_PASSWORD_CONFIRMATION_MISMATCH");
  }
  try {
    validateNewPassword(password);
  } catch {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_PASSWORD_POLICY_REFUSED");
  }
  const normalized = password.trim().toLowerCase();
  const prohibited = [
    ...SEED_USER_DEFINITIONS.map(documentedSeedPasswordForAudit),
    ...SEED_USER_DEFINITIONS.map((definition) => environment[definition.env] ?? "")
  ]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (prohibited.includes(normalized)) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_DOCUMENTED_PASSWORD_REFUSED");
  }
}

export async function executeSuperAdminRecovery(
  input: ExecuteSuperAdminRecoveryInput
) {
  const environment = input.environment ?? process.env;
  const workspaceRoot = input.workspaceRoot ?? process.cwd();
  const identifier = input.identifier.trim().toLowerCase();
  if (!identifier || identifier.length > 254) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_IDENTIFIER_INVALID");
  }
  if (input.confirmationPhrase !== SUPER_ADMIN_RECOVERY_CONFIRMATION) {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_CONFIRMATION_PHRASE_REQUIRED");
  }
  validateRecoveryPassword(input.newPassword, input.confirmPassword, environment);

  const config = resolveSuperAdminRecoveryConfig(environment, workspaceRoot);
  if (input.qaSimulateFailureAfterCredentialUpdate && config.mode !== "qa") {
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_QA_FAILURE_HOOK_REFUSED");
  }
  assertSuperAdminRecoverySafetyFiles(config);
  const client = new PrismaClient({ datasourceUrl: databaseUrl(config.databasePath) });
  try {
    await assertZeroBusinessBaseline(client);
    const target = await findRecoveryTarget(client, identifier);
    const activeSuperAdminCount = await client.user.count({
      where: { role: "SUPER_ADMIN", isActive: true }
    });
    if (activeSuperAdminCount < 1) {
      throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_ACTIVE_SUPER_ADMIN_REQUIRED");
    }

    assertSuperAdminRecoverySafetyFiles(config);
    const nextPasswordHash = await hashPassword(input.newPassword);
    await client.$transaction(async (tx) => {
      await assertZeroBusinessBaseline(tx);
      const currentTarget = await findRecoveryTarget(tx, identifier);
      const currentActiveCount = await tx.user.count({
        where: { role: "SUPER_ADMIN", isActive: true }
      });
      if (currentActiveCount < 1) {
        throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_ACTIVE_SUPER_ADMIN_REQUIRED");
      }
      const updated = await tx.user.updateMany({
        where: {
          id: target.id,
          role: "SUPER_ADMIN",
          isActive: true,
          passwordHash: target.passwordHash,
          credentialVersion: target.credentialVersion
        },
        data: { passwordHash: nextPasswordHash, credentialVersion: { increment: 1 } }
      });
      if (
        updated.count !== 1 ||
        currentTarget.id !== target.id ||
        currentTarget.passwordHash !== target.passwordHash ||
        currentTarget.credentialVersion !== target.credentialVersion
      ) {
        throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_CONCURRENT_ACCOUNT_CHANGE");
      }
      if (input.qaSimulateFailureAfterCredentialUpdate) {
        throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_QA_SIMULATED_FAILURE");
      }
      const now = new Date();
      await tx.authSession.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: now, revocationReason: "LOCAL_SUPER_ADMIN_RECOVERY" }
      });
      await tx.authPasswordResetToken.updateMany({
        where: { userId: target.id, usedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now, invalidationReason: "LOCAL_SUPER_ADMIN_RECOVERY" }
      });
      await tx.authVerificationChallenge.updateMany({
        where: { userId: target.id, usedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now }
      });
      await tx.authSecurityEvent.create({
        data: {
          userId: target.id,
          actorUserId: target.id,
          eventType: "PASSWORD_RECOVERED_LOCALLY",
          subjectType: "USER",
          subjectId: target.id,
          detailsJson: JSON.stringify({ method: "LOCAL_HIDDEN_INPUT", sessionsRevoked: true })
        }
      });
      await tx.userAudit.create({
        data: {
          action: "SUPER_ADMIN_PASSWORD_RECOVERED",
          actorUserId: target.id,
          actorName: "Local operational recovery",
          targetUserId: target.id,
          detailsJson: JSON.stringify({
            method: "LOCAL_HIDDEN_INPUT",
            role: "SUPER_ADMIN"
          })
        }
      });
    });
    return {
      status: SUPER_ADMIN_RECOVERY_SUCCESS,
      role: "SUPER_ADMIN" as const,
      auditEventsCreated: 1
    };
  } catch (error) {
    if (error instanceof SuperAdminRecoveryRefusal) throw error;
    throw new SuperAdminRecoveryRefusal("AUTH_RECOVERY_TRANSACTION_FAILED");
  } finally {
    await client.$disconnect();
  }
}

export function safeSuperAdminRecoveryFailure(error: unknown) {
  const code = error instanceof SuperAdminRecoveryRefusal
    ? error.code
    : "AUTH_RECOVERY_UNEXPECTED_FAILURE";
  return `SUPER_ADMIN_PASSWORD_RECOVERY_REFUSED:${code}`;
}
