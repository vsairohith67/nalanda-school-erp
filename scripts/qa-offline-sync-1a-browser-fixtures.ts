import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { Role } from "../lib/permissions";
import { hashPassword } from "../lib/password";
import { assertSqliteCopyReady, assertSqliteSnapshotUnchanged, snapshotSqliteArtifacts } from "./sqlite-copy-safety";

const workspace = path.resolve(".");
const operational = path.resolve(process.env.OFFLINE_SYNC_OPERATIONAL_DB ?? path.join(workspace, "prisma", "dev.db"));
const root = path.join(workspace, "tmp", "offline-sync-1a-browser");
const database = path.join(root, "browser.db");
const credentialsPath = path.join(root, "credentials.json");
const runtimePath = path.join(root, "runtime-env.json");
const port = 3256;
const databaseUrl = `file:${database.replaceAll("\\", "/")}`;

function cleanup() {
  const resolved = path.resolve(root);
  const parent = path.resolve(workspace, "tmp");
  if (!resolved.startsWith(`${parent}${path.sep}`) || !resolved.endsWith("offline-sync-1a-browser")) throw new Error("OFFLINE_SYNC_BROWSER_CLEANUP_SCOPE_REFUSED");
  if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
}

function migrate() {
  const entry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [entry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: workspace, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 || result.error) throw new Error(`OFFLINE_SYNC_BROWSER_MIGRATION_FAILED:${result.error?.message ?? result.stderr}`);
}

async function createUser(client: PrismaClient, role: Role, password: string) {
  const slug = role.toLowerCase().replaceAll("_", "-");
  const username = `offlinesync1a-${slug}`;
  const user = await client.user.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), name: `OFFLINE-SYNC-1A ${role}`, username, passwordHash: await hashPassword(password), role, isActive: true, lifecycleStatus: "ACTIVE" } });
  await client.authLoginAlias.create({ data: { userId: user.id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  await client.userRoleAssignment.create({ data: { id: randomUUID(), publicKey: randomUUID(), userId: user.id, role, status: "ACTIVE", reason: "OFFLINE-SYNC-1A isolated browser fixture", activeKey: `${user.id}:${role}` } });
  return { id: user.id, username, role };
}

async function grantDualRole() {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const accountant = await client.user.findUniqueOrThrow({ where: { username: "offlinesync1a-accountant" } });
    const activeKey = `${accountant.id}:SUPER_ADMIN`;
    await client.userRoleAssignment.upsert({ where: { activeKey }, update: { status: "ACTIVE" }, create: { id: randomUUID(), publicKey: randomUUID(), userId: accountant.id, role: "SUPER_ADMIN", status: "ACTIVE", reason: "OFFLINE-SYNC-1A isolated role-switch browser fixture", activeKey } });
    process.stdout.write('{"result":"OFFLINE_SYNC_1A_DUAL_ROLE_READY"}\n');
  } finally { await client.$disconnect(); }
}

async function seedConflict() {
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const device = await client.offlineSyncDevice.findFirstOrThrow({ where: { label: "Accounts counter device" } });
    const suffix = randomUUID();
    const mutation = await client.offlineSyncMutation.create({ data: {
      deviceId: device.id,
      actorUserId: device.userId,
      activeRole: "ACCOUNTANT",
      clientMutationId: `browser-conflict-${suffix}`,
      localDraftId: `browser-draft-${suffix}`,
      operationType: "FEE_PAYMENT",
      requestHash: "a".repeat(64),
      payloadHash: "b".repeat(64),
      syncSchemaVersion: 1,
      referenceSnapshotVersion: "c".repeat(64),
      createdClientAt: new Date()
    } });
    await client.offlineSyncMutation.update({ where: { id: mutation.id }, data: { status: "CONFLICT", conflictCode: "STUDENT_REFERENCE_CHANGED" } });
    process.stdout.write(`${JSON.stringify({ result: "OFFLINE_SYNC_1A_BROWSER_CONFLICT_READY", mutationId: mutation.id })}\n`);
  } finally { await client.$disconnect(); }
}

async function setup() {
  cleanup();
  assertSqliteCopyReady(operational, "OFFLINE_SYNC_BROWSER_OPERATIONAL");
  const before = snapshotSqliteArtifacts(operational);
  mkdirSync(root, { recursive: true });
  copyFileSync(operational, database);
  migrate(); migrate();
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const browserFixtureCredential = `OfflineSync1A-${randomBytes(18).toString("base64url")}!9a`;
  try {
    const users = await Promise.all((["ACCOUNTANT", "SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"] as Role[]).map((role) => createUser(client, role, browserFixtureCredential)));
    const accountant = users.find((row) => row.role === "ACCOUNTANT")!;
    await client.userRoleAssignment.create({ data: { id: randomUUID(), publicKey: randomUUID(), userId: accountant.id, role: "SUPER_ADMIN", status: "ACTIVE", reason: "OFFLINE-SYNC-1A isolated role-switch browser fixture", activeKey: `${accountant.id}:SUPER_ADMIN` } });
    const suffix = randomBytes(3).toString("hex").toUpperCase();
    const student = await client.student.create({ data: { admissionNo: `OFF-BROWSER-${suffix}`, studentName: "Synthetic Offline Browser Student", fatherName: "Synthetic Guardian", phone1: "9000000000", className: `OFFLINE-${suffix}`, section: "A", academicYear: "2026-27", status: "Active" } });
    await client.feeStructure.create({ data: { academicYear: "2026-27", className: student.className, termAmount: 1000, term1Month: "June", term2Month: "September", term3Month: "December", term4Month: "February", active: true } });
    const category = await client.expenseCategory.create({ data: { name: `Offline Browser Category ${suffix}`, code: `OBC${suffix}` } });
    const department = await client.expenseDepartment.create({ data: { name: `Offline Browser Department ${suffix}`, code: `OBD${suffix}` } });
    const vendor = await client.vendor.create({ data: { vendorCode: `OBV${suffix}`, name: "Synthetic Offline Browser Vendor", status: "ACTIVE" } });
    const item = await client.miscIncomeItem.create({ data: { itemCode: `OBI${suffix}`, name: "Synthetic Offline Browser Item", category: "OTHER", studentLinkPolicy: "OPTIONAL", status: "ACTIVE" } });
    await client.miscIncomeRate.create({ data: { itemId: item.id, academicYear: "2026-27", amount: "25.00", status: "ACTIVE" } });
    writeFileSync(credentialsPath, JSON.stringify({ password: browserFixtureCredential, users }, null, 2), { flag: "wx" });
    writeFileSync(runtimePath, JSON.stringify({ DATABASE_URL: databaseUrl, SESSION_SECRET: randomBytes(48).toString("base64url"), APP_ORIGIN: `http://127.0.0.1:${port}`, RELEASE_FEATURE_FLAGS_QA_MODE: "SYNTHETIC_COPY_ONLY", RELEASE_FEATURE_FLAGS_QA_ENABLED: "offline-sync-1a", NODE_ENV: "development", port }, null, 2), { flag: "wx" });
    assertSqliteSnapshotUnchanged(before, snapshotSqliteArtifacts(operational), "OFFLINE_SYNC_BROWSER_OPERATIONAL_CHANGED");
    process.stdout.write(`${JSON.stringify({ result: "OFFLINE_SYNC_1A_BROWSER_FIXTURES_READY", copiedDatabase: true, operationalMutation: false, port, users: users.map((row) => row.role), credentialsPath, runtimePath })}\n`);
  } finally { await client.$disconnect(); }
}

if (process.argv[2] === "cleanup") { cleanup(); process.stdout.write('{"result":"OFFLINE_SYNC_1A_BROWSER_FIXTURES_REMOVED"}\n'); }
else if (process.argv[2] === "grant-dual") grantDualRole().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
else if (process.argv[2] === "seed-conflict") seedConflict().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
else setup().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
