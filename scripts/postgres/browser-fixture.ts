import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../lib/password";
import { assertSyntheticPostgresQa } from "./synthetic-qa";

const workspace = path.resolve(".");
const temporaryRoot = path.resolve(workspace, "tmp");
const fixtureRoot = path.resolve(temporaryRoot, "postgres-readiness-1a", "browser");
const credentialsPath = path.join(fixtureRoot, "credentials.json");
const runtimePath = path.join(fixtureRoot, "runtime.json");
const userId = "postgres-readiness-browser-super";
const username = "postgres-readiness-browser-super";

function assertFixtureRoot() {
  const expected = path.resolve(temporaryRoot, "postgres-readiness-1a", "browser");
  if (fixtureRoot !== expected) throw new Error("POSTGRES_BROWSER_FIXTURE_ROOT_INVALID");
  return fixtureRoot;
}

async function setup() {
  assertSyntheticPostgresQa();
  const root = assertFixtureRoot();
  if (existsSync(root)) throw new Error("POSTGRES_BROWSER_FIXTURE_ALREADY_EXISTS");
  mkdirSync(root, { recursive: true });
  const password = randomBytes(24).toString("base64url") + "Aa1!";
  const sessionSecret = randomBytes(48).toString("base64url");
  const prisma = new PrismaClient();
  try {
    await prisma.authLoginAlias.deleteMany({ where: { userId } });
    await prisma.userRoleAssignment.deleteMany({ where: { userId } });
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, iamPublicKey: randomUUID(), name: "PostgreSQL Readiness Browser Super Admin", designation: "Synthetic Browser QA", username, passwordHash: await hashPassword(password), role: "SUPER_ADMIN", isActive: true, lifecycleStatus: "ACTIVE", mustChangePassword: false },
      update: { passwordHash: await hashPassword(password), role: "SUPER_ADMIN", isActive: true, lifecycleStatus: "ACTIVE", mustChangePassword: false }
    });
    await prisma.authLoginAlias.create({ data: { userId, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
    for (const role of ["SUPER_ADMIN", "DIRECTOR", "ACCOUNTANT"] as const) {
      await prisma.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId, role, status: "ACTIVE", reason: "POSTGRES-READINESS-1A synthetic Browser QA", assignedByUserId: userId, activeKey: `${userId}:${role}` } });
    }
    writeFileSync(credentialsPath, `${JSON.stringify({ username, password }, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    writeFileSync(runtimePath, `${JSON.stringify({
      SESSION_SECRET: sessionSecret,
      AUTH_SECRET: sessionSecret,
      APP_ORIGIN: "http://127.0.0.1:3218",
      PORT: "3218",
      PARENT_MEETINGS_V1_5: "true",
      OPTIONAL_OPS_SYNTHETIC_QA: "1",
      TRANSPORT_V1_5: "enabled",
      CAFETERIA_V1_5: "enabled",
      SMART_AI_PROVIDER: "DISABLED"
    }, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ result: "POSTGRES_BROWSER_FIXTURE_READY", roles: ["SUPER_ADMIN", "DIRECTOR", "ACCOUNTANT"], credentialsPath, runtimePath }));
  } finally {
    await prisma.$disconnect();
  }
}

function cleanup() {
  const root = assertFixtureRoot();
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  console.log(JSON.stringify({ result: "POSTGRES_BROWSER_FIXTURE_REMOVED", exists: existsSync(root) }));
}

const mode = process.argv[2];
if (mode === "setup") setup().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
else if (mode === "cleanup") cleanup();
else { console.error("POSTGRES_BROWSER_FIXTURE_MODE_INVALID"); process.exitCode = 1; }
