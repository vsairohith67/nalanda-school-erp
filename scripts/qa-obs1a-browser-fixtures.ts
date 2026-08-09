import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import { hashPassword, verifyPassword } from "../lib/password";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const ROOT = path.join(WORKSPACE, "tmp", "obs1a-browser");
const DATABASE = path.join(ROOT, "obs1a-browser.db");
const PRIVATE_RUNTIME = path.join(ROOT, ".runtime.json");
const ORIGIN = "http://127.0.0.1:3021";

function databaseUrl(file: string) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function sha256(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function checkedCleanup() {
  const resolved = path.resolve(ROOT);
  const expected = path.resolve(WORKSPACE, "tmp", "obs1a-browser");
  const allowedRoot = `${path.resolve(WORKSPACE, "tmp")}${path.sep}`;
  if (resolved !== expected || !resolved.startsWith(allowedRoot)) {
    throw new Error("OBS1A_BROWSER_CLEANUP_SCOPE_REFUSED");
  }
  if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
}

async function createActor(client: PrismaClient, role: "SUPER_ADMIN" | "DIRECTOR" | "VIEWER", password: string) {
  const suffix = randomUUID().slice(0, 8);
  const username = `obs1aqa-${role.toLowerCase().replace("_", "-")}-${suffix}`;
  const user = await client.user.create({
    data: {
      iamPublicKey: randomUUID(),
      name: `OBS1AQA ${role.replace("_", " ")}`,
      designation: `${role.replace("_", " ")} synthetic QA`,
      username,
      passwordHash: await hashPassword(password),
      role,
      isActive: true,
      lifecycleStatus: "ACTIVE",
    },
  });
  await client.authLoginAlias.create({
    data: {
      userId: user.id,
      type: "USERNAME",
      normalizedValue: username,
      displayMasked: username,
      status: "VERIFIED",
      isSchoolGoverned: true,
      verifiedAt: new Date(),
    },
  });
  await client.userRoleAssignment.create({
    data: {
      publicKey: randomUUID(),
      userId: user.id,
      role,
      status: "ACTIVE",
      reason: "OBS1AQA copied-database browser validation",
      activeKey: `${user.id}:${role}`,
    },
  });
  return username;
}

async function prepare() {
  const operationalBefore = { sha256: sha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  checkedCleanup();
  mkdirSync(ROOT, { recursive: true });
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl(DATABASE),
    AUTH_SECRET: randomBytes(48).toString("base64url"),
    AUTH_VERIFICATION_SECRET: randomBytes(48).toString("base64url"),
    SESSION_COOKIE_SECURE: "false",
    APP_ORIGIN: ORIGIN,
  };
  execFileSync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", "pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma"], {
    cwd: WORKSPACE,
    env: environment,
    stdio: "pipe",
  });

  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    await ensureDefaultRolePermissions(client);
    const password = "OBS1AQA-local-only-Browser-2026!Aa9";
    const superAdmin = await createActor(client, "SUPER_ADMIN", password);
    const director = await createActor(client, "DIRECTOR", password);
    const viewer = await createActor(client, "VIEWER", password);
    writeFileSync(PRIVATE_RUNTIME, JSON.stringify({
      databaseUrl: databaseUrl(DATABASE),
      origin: ORIGIN,
      authSecret: environment.AUTH_SECRET,
      verificationSecret: environment.AUTH_VERIFICATION_SECRET,
      password,
      users: { superAdmin, director, viewer },
    }), { encoding: "utf8", mode: 0o600 });
  } finally {
    await client.$disconnect();
  }

  const operationalAfter = { sha256: sha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  if (JSON.stringify(operationalAfter) !== JSON.stringify(operationalBefore)) {
    throw new Error("OBS1A_OPERATIONAL_DATABASE_CHANGED");
  }
  console.log("OBS1A_BROWSER_FIXTURES_READY");
}

async function verify() {
  if (!existsSync(PRIVATE_RUNTIME)) throw new Error("OBS1A_BROWSER_FIXTURES_NOT_READY");
  const runtime = JSON.parse(readFileSync(PRIVATE_RUNTIME, "utf8")) as {
    databaseUrl: string;
    password: string;
    users: { superAdmin: string; director: string; viewer: string };
  };
  const client = new PrismaClient({ datasourceUrl: runtime.databaseUrl });
  try {
    const results = [];
    for (const [role, username] of Object.entries(runtime.users)) {
      const user = await client.user.findUniqueOrThrow({ where: { username } });
      results.push({
        role,
        active: user.isActive && user.lifecycleStatus === "ACTIVE",
        password: await verifyPassword(runtime.password, user.passwordHash),
        aliases: await client.authLoginAlias.count({ where: { userId: user.id, status: "VERIFIED" } }),
        assignments: await client.userRoleAssignment.count({ where: { userId: user.id, status: "ACTIVE" } }),
      });
    }
    console.log(JSON.stringify(results));
  } finally {
    await client.$disconnect();
  }
}

if (process.argv[2] === "cleanup") {
  checkedCleanup();
  console.log("OBS1A_BROWSER_FIXTURES_CLEANED");
} else if (process.argv[2] === "verify") {
  verify().catch((error) => {
    console.error(error instanceof Error ? error.message : "OBS1A_BROWSER_FIXTURE_VERIFY_FAILED");
    process.exitCode = 1;
  });
} else {
  prepare().catch((error) => {
    console.error(error instanceof Error ? error.message : "OBS1A_BROWSER_FIXTURE_FAILED");
    process.exitCode = 1;
  });
}
