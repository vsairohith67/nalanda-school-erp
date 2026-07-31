import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { maskAlias, normalizeAliasValue } from "../lib/auth-identifiers";
import { hashPassword } from "../lib/password";
import { authHashSecret, createPasswordResetToken } from "../lib/auth-security";
import { fileSha256 } from "./migration-check-utils";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const ROOT = path.join(WORKSPACE, "tmp", "auth2b-browser");
const DATABASE = path.join(ROOT, "auth2b-browser.db");
const PRIVATE_RUNTIME = path.join(ROOT, ".runtime.json");
const MAILBOX = path.join(ROOT, "delivery", "mailbox.json");

function databaseUrl(file: string) { return `file:${file.replaceAll("\\", "/")}`; }

function checkedCleanup() {
  const resolved = path.resolve(ROOT);
  const expected = path.resolve(WORKSPACE, "tmp", "auth2b-browser");
  if (resolved !== expected || !resolved.startsWith(`${path.resolve(WORKSPACE, "tmp")}${path.sep}`)) {
    throw new Error("AUTH2B_BROWSER_CLEANUP_SCOPE_REFUSED");
  }
  if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
}

async function prepare() {
  const operationalBefore = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  checkedCleanup();
  mkdirSync(ROOT, { recursive: true });
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  const password = ["Auth2B", "Browser", randomBytes(18).toString("base64url")].join("-") + "!";
  const authSecret = randomBytes(48).toString("base64url");
  const verificationSecret = randomBytes(48).toString("base64url");
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl(DATABASE),
    AUTH_SECRET: authSecret,
    AUTH_VERIFICATION_SECRET: verificationSecret,
    SESSION_COOKIE_SECURE: "false",
    APP_ORIGIN: "http://127.0.0.1:3012",
    AUTH2B_DELIVERY_ADAPTER: "LOCAL_TEST_SINK",
    AUTH2B_COPIED_DATABASE_ROOT: ROOT,
    AUTH2B_LOCAL_DELIVERY_MAILBOX: MAILBOX,
    TRUST_PROXY_HEADERS: "true",
    NALANDA_TRUSTED_PROXY_MODE: "single-hop-sanitized"
  };
  execFileSync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", "pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma"], {
    cwd: WORKSPACE, env: environment, stdio: "pipe"
  });
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    const username = normalizeAliasValue("USERNAME", `auth2b-browser-${randomUUID().slice(0, 8)}`);
    const user = await client.user.create({ data: {
      name: "AUTH2B Browser Super Admin",
      username,
      passwordHash: await hashPassword(password),
      role: "SUPER_ADMIN",
      isActive: true
    } });
    await client.authLoginAlias.create({ data: {
      id: `auth2b_username_${user.id}`,
      userId: user.id,
      type: "USERNAME",
      normalizedValue: username,
      displayMasked: username,
      status: "VERIFIED",
      isSchoolGoverned: true,
      verifiedAt: new Date()
    } });
    const workEmail = `browser.${randomUUID().slice(0, 8)}@example.invalid`;
    await client.authLoginAlias.create({ data: {
      userId: user.id,
      type: "WORK_EMAIL",
      normalizedValue: workEmail,
      displayMasked: maskAlias("WORK_EMAIL", workEmail),
      status: "VERIFIED",
      verifiedAt: new Date()
    } });
    const disabledUsername = normalizeAliasValue("USERNAME", `auth2b-browser-disabled-${randomUUID().slice(0, 8)}`);
    const disabledUser = await client.user.create({ data: {
      name: "AUTH2B Browser Disabled",
      username: disabledUsername,
      passwordHash: await hashPassword(password),
      role: "VIEWER",
      isActive: false
    } });
    await client.authLoginAlias.create({ data: {
      userId: disabledUser.id, type: "USERNAME", normalizedValue: disabledUsername,
      displayMasked: disabledUsername, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date()
    } });
    const pendingAlias = `browser.pending.${randomUUID().slice(0, 8)}@example.invalid`;
    await client.authLoginAlias.create({ data: {
      userId: user.id, type: "PERSONAL_EMAIL", normalizedValue: pendingAlias,
      displayMasked: maskAlias("PERSONAL_EMAIL", pendingAlias), status: "PENDING"
    } });
    const expiredResetToken = createPasswordResetToken();
    const usedResetToken = createPasswordResetToken();
    const resetAlias = await client.authLoginAlias.findUniqueOrThrow({ where: { normalizedValue: workEmail } });
    await client.authPasswordResetToken.createMany({ data: [{
      userId: user.id, aliasId: resetAlias.id, channelType: "WORK_EMAIL",
      tokenHash: authHashSecret(expiredResetToken, "password-reset", environment),
      credentialVersion: user.credentialVersion, expiresAt: new Date(Date.now() - 60_000)
    }, {
      userId: user.id, aliasId: resetAlias.id, channelType: "WORK_EMAIL",
      tokenHash: authHashSecret(usedResetToken, "password-reset", environment),
      credentialVersion: user.credentialVersion, expiresAt: new Date(Date.now() + 10 * 60_000), usedAt: new Date()
    }] });
    writeFileSync(PRIVATE_RUNTIME, JSON.stringify({
      username,
      password,
      disabledUsername,
      pendingAlias,
      expiredResetToken,
      usedResetToken,
      authSecret,
      verificationSecret,
      databaseUrl: databaseUrl(DATABASE),
      root: ROOT,
      mailbox: MAILBOX,
      origin: environment.APP_ORIGIN
    }), { encoding: "utf8", mode: 0o600 });
  } finally {
    await client.$disconnect();
  }
  const operationalAfter = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  if (JSON.stringify(operationalAfter) !== JSON.stringify(operationalBefore)) throw new Error("AUTH2B_OPERATIONAL_DATABASE_CHANGED");
  console.log("AUTH2B_BROWSER_FIXTURES_READY");
}

async function addSession() {
  if (!existsSync(PRIVATE_RUNTIME)) throw new Error("AUTH2B_BROWSER_FIXTURES_NOT_READY");
  const runtime = JSON.parse(readFileSync(PRIVATE_RUNTIME, "utf8")) as { databaseUrl: string; username: string };
  const client = new PrismaClient({ datasourceUrl: runtime.databaseUrl });
  try {
    const user = await client.user.findUniqueOrThrow({ where: { username: runtime.username } });
    const now = new Date();
    await client.authSession.create({ data: {
      userId: user.id,
      tokenHash: randomBytes(32).toString("hex"),
      credentialVersion: user.credentialVersion,
      createdAt: new Date(now.getTime() - 60_000),
      lastSeenAt: new Date(now.getTime() - 30_000),
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      deviceSummary: "Mobile",
      browserSummary: "Firefox",
      networkEvidenceMasked: "198.51.100.*"
    } });
  } finally {
    await client.$disconnect();
  }
  console.log("AUTH2B_BROWSER_SECOND_SESSION_READY");
}

if (process.argv[2] === "cleanup") {
  checkedCleanup();
  console.log("AUTH2B_BROWSER_FIXTURES_CLEANED");
} else if (process.argv[2] === "add-session") {
  addSession().catch((error) => {
    console.error(error instanceof Error ? error.message : "AUTH2B_BROWSER_SESSION_FIXTURE_FAILED");
    process.exitCode = 1;
  });
} else {
  prepare().catch((error) => {
    console.error(error instanceof Error ? error.message : "AUTH2B_BROWSER_FIXTURE_FAILED");
    process.exitCode = 1;
  });
}
