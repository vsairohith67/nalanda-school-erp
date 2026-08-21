import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { ROLES, type Role } from "../lib/permissions";
import {
  assertSuperAdminWorkActor,
  createContact,
  createDiaryEntry,
  createTask,
  listSuperAdminWork,
  summarizeSuperAdminWork,
  taskBucket,
  updateContact,
  updateDiaryEntry,
  updateTask
} from "../lib/super-admin-work";

const SUITE = "SUPERADMINWORK1AQA";
const workspace = path.resolve(".");
const operational = path.resolve(process.env.SUPER_ADMIN_WORK_OPERATIONAL_DB?.trim() || path.join(workspace, "prisma", "dev.db"));
const root = path.join(workspace, "tmp", "super-admin-work-1a-qa");
const clearedCopy = path.join(root, "cleared-copy.db");
const migratedCopy = path.join(root, "migrated-copy.db");
const postMigrationBackup = path.join(root, "post-migration-backup.db");
const recoveryCopy = path.join(root, "recovery-copy.db");
const freshDatabase = path.join(root, "fresh.db");
const credentialsPath = path.join(root, "browser-credentials.json");
const qaPassword = ["SuperAdminWork", SUITE, randomUUID()].join("-") + "!";
const now = new Date("2026-08-21T06:30:00.000Z");
const protectedTables = ["Student", "Guardian", "StaffMember", "Payment", "StudentMark", "StudentReportCard", "RolePermission", "IamSafetyLock"] as const;
const providerTables = ["NotificationCampaign", "WhatsAppOutboundBatch", "SmsEmailOutboundBatch"] as const;
let stage = "preflight";

type Fixture = { id: string; username: string; role: Role };

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function databaseUrl(file: string) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function sha256(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function checkedRoot() {
  const resolved = path.resolve(root);
  const parent = path.join(workspace, "tmp");
  invariant(resolved.startsWith(`${parent}${path.sep}`) && resolved.endsWith("super-admin-work-1a-qa"), `${SUITE}_CLEANUP_SCOPE_REFUSED`);
  return resolved;
}

function cleanup() {
  const target = checkedRoot();
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

function migrate(database: string) {
  const prismaEntry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  invariant(existsSync(prismaEntry), `${SUITE}_PRISMA_RUNTIME_MISSING`);
  const result = spawnSync(process.execPath, [prismaEntry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    cwd: workspace,
    env: { ...process.env, DATABASE_URL: databaseUrl(database) },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error || result.status !== 0) throw new Error(`${SUITE}_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
}

async function tableCounts(client: PrismaClient, tables: readonly string[]) {
  const result: Record<string, number> = {};
  for (const table of tables) {
    const rows = await client.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) AS count FROM "${table}"`);
    result[table] = Number(rows[0]?.count ?? 0);
  }
  return result;
}

async function databaseHealth(client: PrismaClient) {
  const integrity = await client.$queryRawUnsafe<Array<{ integrity_check: string }>>("PRAGMA integrity_check");
  const foreignKeys = await client.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
  return { integrity: integrity[0]?.integrity_check, foreignKeyViolations: foreignKeys.length };
}

async function createFixture(client: PrismaClient, role: Role, label: string): Promise<Fixture> {
  const id = randomUUID();
  const username = `${SUITE.toLowerCase()}-${label.toLowerCase()}-${id.slice(0, 8)}`;
  await client.user.create({ data: {
    id,
    iamPublicKey: randomUUID(),
    name: `${SUITE} ${label}`,
    designation: `${role} synthetic copied-database QA`,
    username,
    passwordHash: await hashPassword(qaPassword),
    role,
    isActive: true,
    lifecycleStatus: "ACTIVE"
  } });
  await client.authLoginAlias.create({ data: { userId: id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: now } });
  await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: id, role, status: "ACTIVE", reason: `${SUITE} isolated QA fixture`, activeKey: `${id}:${role}` } });
  return { id, username, role };
}

function actor(fixture: Fixture) {
  return { id: fixture.id, role: fixture.role };
}

function date(value: string) {
  return new Date(`${value}T00:00:00+05:30`);
}

async function denied(work: () => Promise<unknown>, code: string) {
  try {
    await work();
  } catch {
    return;
  }
  throw new Error(code);
}

function percentile95(values: number[]) {
  return [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * 0.95) - 1)];
}

async function main() {
  cleanup();
  mkdirSync(root, { recursive: true });
  invariant(existsSync(operational), `${SUITE}_OPERATIONAL_DATABASE_MISSING`);
  const operationalBefore = { sha256: sha256(operational), size: statSync(operational).size };
  copyFileSync(operational, clearedCopy);
  copyFileSync(clearedCopy, migratedCopy);
  copyFileSync(clearedCopy, recoveryCopy);
  writeFileSync(freshDatabase, "", { flag: "wx" });

  const clearedClient = new PrismaClient({ datasourceUrl: databaseUrl(clearedCopy) });
  const protectedBefore = await tableCounts(clearedClient, protectedTables);
  const providerBefore = await tableCounts(clearedClient, providerTables);
  await clearedClient.$disconnect();

  stage = "additive migration";
  migrate(migratedCopy);
  migrate(migratedCopy);
  migrate(freshDatabase);
  copyFileSync(migratedCopy, postMigrationBackup);
  invariant(sha256(migratedCopy) === sha256(postMigrationBackup), `${SUITE}_POST_MIGRATION_BACKUP_NOT_EXACT`);

  const client = new PrismaClient({ datasourceUrl: databaseUrl(migratedCopy) });
  const fresh = new PrismaClient({ datasourceUrl: databaseUrl(freshDatabase) });
  const recovery = new PrismaClient({ datasourceUrl: databaseUrl(recoveryCopy) });
  try {
    const migratedHealth = await databaseHealth(client);
    const freshHealth = await databaseHealth(fresh);
    const recoveryHealth = await databaseHealth(recovery);
    invariant(migratedHealth.integrity === "ok" && migratedHealth.foreignKeyViolations === 0, `${SUITE}_MIGRATED_DATABASE_INTEGRITY_FAILED`);
    invariant(freshHealth.integrity === "ok" && freshHealth.foreignKeyViolations === 0, `${SUITE}_FRESH_DATABASE_INTEGRITY_FAILED`);
    invariant(recoveryHealth.integrity === "ok" && recoveryHealth.foreignKeyViolations === 0, `${SUITE}_RECOVERY_COPY_INTEGRITY_FAILED`);
    invariant(JSON.stringify(await tableCounts(client, protectedTables)) === JSON.stringify(protectedBefore), `${SUITE}_MIGRATION_CHANGED_PROTECTED_ROWS`);
    const migrationRows = await client.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null }>>("SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name = '20260821194500_super_admin_work_programme'");
    invariant(migrationRows.length === 1 && migrationRows[0].finished_at, `${SUITE}_MIGRATION_STATUS_INVALID`);

    stage = "role and owner fixtures";
    const superA = await createFixture(client, "SUPER_ADMIN", "SuperA");
    const superB = await createFixture(client, "SUPER_ADMIN", "SuperB");
    const roleFixtures: Fixture[] = [];
    for (const role of ROLES.filter((value) => value !== "SUPER_ADMIN")) roleFixtures.push(await createFixture(client, role, role.replaceAll("_", "")));
    const delegated = roleFixtures.find((fixture) => fixture.role === "VIEWER")!;
    const profile = await client.permissionProfile.create({ data: { name: `${SUITE} delegated dashboard`, normalizedName: `${SUITE.toLowerCase()}-delegated-dashboard`, description: "Synthetic delegated permission profile", createdByUserId: superA.id, updatedByUserId: superA.id } });
    await client.permissionProfileEntry.create({ data: { profileId: profile.id, permission: "VIEW_DASHBOARD", effect: "ALLOW", reason: `${SUITE} exact-role denial proof`, createdByUserId: superA.id, activeKey: `${profile.id}:VIEW_DASHBOARD` } });
    await client.userPermissionProfileAssignment.create({ data: { userId: delegated.id, profileId: profile.id, reason: `${SUITE} delegated profile proof`, assignedByUserId: superA.id, activeKey: `${delegated.id}:${profile.id}` } });
    for (const fixture of roleFixtures) {
      invariant(fixture.role !== "SUPER_ADMIN", `${SUITE}_ROLE_MATRIX_INVALID`);
      try {
        assertSuperAdminWorkActor(actor(fixture));
        throw new Error(`${SUITE}_${fixture.role}_SERVICE_ALLOWED`);
      } catch (error) {
        invariant(error instanceof Error && /exact Super Admin role/i.test(error.message), `${SUITE}_${fixture.role}_WRONG_DENIAL`);
      }
    }

    stage = "private lifecycle";
    const diaryA = await createDiaryEntry(client, actor(superA), { ownerUserId: superB.id, title: "Unicode दिनचर्या 📘 O'Brien", entryDate: "2024-02-29", notes: "Line one\n<script>globalThis.xss = true</script>\n**markdown-like**", category: "COMPLIANCE", status: "FOLLOW_UP", priority: "URGENT", followUpDate: "2026-08-21", contextModule: "OPERATIONS", contextReference: "OPS-QA-1" });
    const taskA = await createTask(client, actor(superA), { ownerUserId: superB.id, title: "Boundary task", description: "Private task body <img src=x onerror=alert(1)>", status: "TO_DO", priority: "HIGH", dueDate: "2026-08-21", dueTime: "12:00", reminderAt: "2026-08-21T11:59", category: "VENDOR", linkedModule: "OPERATIONS", linkedEntityType: "Supplier", linkedEntityReference: "SUP-QA-1" });
    const contactA = await createContact(client, actor(superA), { ownerUserId: superB.id, name: "QA Publisher", contactPerson: "Asha", category: "PUBLISHER", phone: "+91 98765 43210", alternatePhone: "011-23456789", email: "QA@example.test", website: "https://example.test/catalogue", address: "Synthetic address", notes: "Reference only", status: "ACTIVE", preferred: true, tags: ["books", "preferred"], lastContactDate: "2026-08-20", nextFollowUpDate: "2026-08-21" });
    const storedOwners = await Promise.all([
      client.superAdminDiaryEntry.findUniqueOrThrow({ where: { publicKey: diaryA.publicKey }, select: { ownerUserId: true } }),
      client.superAdminTask.findUniqueOrThrow({ where: { publicKey: taskA.publicKey }, select: { ownerUserId: true } }),
      client.superAdminContact.findUniqueOrThrow({ where: { publicKey: contactA.publicKey }, select: { ownerUserId: true } })
    ]);
    invariant(storedOwners.every((row) => row.ownerUserId === superA.id), `${SUITE}_CLIENT_OWNER_MASS_ASSIGNMENT_ALLOWED`);
    const listA = await listSuperAdminWork(client, actor(superA));
    const listB = await listSuperAdminWork(client, actor(superB));
    invariant(listA.diary.length === 1 && listA.tasks.length === 1 && listA.contacts.length === 1, `${SUITE}_OWNER_A_LIST_INVALID`);
    invariant(listB.diary.length === 0 && listB.tasks.length === 0 && listB.contacts.length === 0, `${SUITE}_OWNER_B_READ_LEAK`);
    invariant(!JSON.stringify(listA).includes(superA.id) && !JSON.stringify(listA).includes(superB.id), `${SUITE}_OWNER_IDENTIFIER_SERIALIZED`);

    await denied(() => updateDiaryEntry(client, actor(superB), diaryA.publicKey, { title: "Tampered", entryDate: "2026-08-21", notes: "No", category: "OTHER", status: "OPEN", priority: "NORMAL" }), `${SUITE}_DIARY_IDOR_ALLOWED`);
    await denied(() => updateTask(client, actor(superB), taskA.publicKey, { title: "Tampered", dueDate: "2026-08-21", category: "OTHER", status: "DONE", priority: "NORMAL" }), `${SUITE}_TASK_IDOR_ALLOWED`);
    await denied(() => updateContact(client, actor(superB), contactA.publicKey, { name: "Tampered", category: "OTHER", phone: "9876543210", status: "INACTIVE" }), `${SUITE}_CONTACT_IDOR_ALLOWED`);
    await denied(() => updateTask(client, actor(superA), "guessed-or-malformed-key-' OR 1=1 --", { title: "Tampered", dueDate: "2026-08-21", category: "OTHER", status: "DONE", priority: "NORMAL" }), `${SUITE}_MALFORMED_KEY_ALLOWED`);

    const closed = await updateDiaryEntry(client, actor(superA), diaryA.publicKey, { title: diaryA.title, entryDate: diaryA.entryDate, notes: diaryA.notes, category: diaryA.category, status: "CLOSED", priority: diaryA.priority, followUpDate: diaryA.followUpDate, contextModule: diaryA.contextModule, contextReference: diaryA.contextReference });
    invariant(Boolean(closed.closedAt), `${SUITE}_DIARY_CLOSE_TIMESTAMP_MISSING`);
    const reopenedDiary = await updateDiaryEntry(client, actor(superA), diaryA.publicKey, { title: diaryA.title, entryDate: diaryA.entryDate, notes: diaryA.notes, category: diaryA.category, status: "OPEN", priority: diaryA.priority, followUpDate: diaryA.followUpDate, contextModule: diaryA.contextModule, contextReference: diaryA.contextReference });
    invariant(reopenedDiary.closedAt === null, `${SUITE}_DIARY_REOPEN_TIMESTAMP_RETAINED`);
    for (const status of ["IN_PROGRESS", "WAITING", "DONE", "TO_DO", "CANCELLED", "TO_DO"] as const) {
      const current = await client.superAdminTask.findUniqueOrThrow({ where: { publicKey: taskA.publicKey } });
      const updated = await updateTask(client, actor(superA), taskA.publicKey, { title: current.title, description: current.description, status, priority: current.priority, dueDate: "2026-08-21", dueTime: current.dueTime, reminderAt: current.reminderAt?.toISOString(), category: current.category, linkedModule: current.linkedModule, linkedEntityType: current.linkedEntityType, linkedEntityReference: current.linkedEntityReference });
      invariant(status === "DONE" ? Boolean(updated.completedAt) : updated.completedAt === null, `${SUITE}_${status}_COMPLETION_TIMESTAMP_INVALID`);
    }
    const inactiveContact = await updateContact(client, actor(superA), contactA.publicKey, { name: contactA.name, contactPerson: contactA.contactPerson, category: contactA.category, phone: contactA.phone, alternatePhone: contactA.alternatePhone, email: contactA.email, website: contactA.website, address: contactA.address, notes: contactA.notes, status: "INACTIVE", preferred: false, tags: contactA.tags, lastContactDate: contactA.lastContactDate, nextFollowUpDate: contactA.nextFollowUpDate });
    invariant(inactiveContact.status === "INACTIVE" && !inactiveContact.preferred, `${SUITE}_CONTACT_INACTIVATION_FAILED`);

    stage = "validation matrix";
    const diaryBase = { entryDate: "2026-08-21", notes: "Valid note", category: "OTHER", status: "OPEN", priority: "NORMAL" };
    for (const input of [
      { ...diaryBase, title: "" },
      { ...diaryBase, title: "x".repeat(161) },
      { ...diaryBase, title: "Valid", notes: "x".repeat(12_001) },
      { ...diaryBase, title: "Valid", category: "INVALID" },
      { ...diaryBase, title: "Valid", status: "INVALID" },
      { ...diaryBase, title: "Valid", entryDate: "2026-02-30" }
    ]) await denied(() => createDiaryEntry(client, actor(superA), input), `${SUITE}_INVALID_DIARY_ACCEPTED`);
    await createDiaryEntry(client, actor(superA), { ...diaryBase, title: "Historical", entryDate: "1999-12-31" });
    await createDiaryEntry(client, actor(superA), { ...diaryBase, title: "Future", entryDate: "2030-01-01" });
    await denied(() => createTask(client, actor(superA), { title: "No date", dueDate: null, category: "OTHER" }), `${SUITE}_NULL_DUE_DATE_ACCEPTED`);
    await denied(() => createTask(client, actor(superA), { title: "Bad time", dueDate: "2026-08-21", dueTime: "25:61", category: "OTHER" }), `${SUITE}_INVALID_DUE_TIME_ACCEPTED`);
    await denied(() => createTask(client, actor(superA), { title: "Late reminder", dueDate: "2026-08-21", reminderAt: "2026-08-22T00:00", category: "OTHER" }), `${SUITE}_NEXT_MIDNIGHT_REMINDER_ACCEPTED`);
    await createTask(client, actor(superA), { title: "End reminder", dueDate: "2026-08-21", reminderAt: "2026-08-21T23:59", category: "OTHER" });
    invariant(taskBucket({ status: "TO_DO", dueDate: "2025-12-31" }, new Date("2026-01-01T00:00:00+05:30")) === "OVERDUE", `${SUITE}_YEAR_BOUNDARY_FAILED`);
    invariant(taskBucket({ status: "TO_DO", dueDate: "2024-02-29" }, new Date("2024-02-29T12:00:00+05:30")) === "TODAY", `${SUITE}_LEAP_DAY_FAILED`);
    for (const invalid of [
      { name: "Bad phone", category: "OTHER", phone: "phone!" },
      { name: "Bad email", category: "OTHER", email: "not-an-email" },
      { name: "Bad website", category: "OTHER", website: "javascript:alert(1)" },
      { name: "Bad date", category: "OTHER", phone: "9876543210", lastContactDate: "2026-02-30" },
      { name: "OTP 123456", category: "OTHER", phone: "9876543210" },
      { name: "Government ID", category: "OTHER", phone: "9876543210", notes: "Aadhaar 1234 5678 9012" },
      { name: "x".repeat(161), category: "OTHER", phone: "9876543210" }
    ]) await denied(() => createContact(client, actor(superA), invalid), `${SUITE}_INVALID_CONTACT_ACCEPTED`);

    stage = "privacy audit";
    const audits = await client.superAdminWorkAudit.findMany({ where: { ownerUserId: superA.id } });
    const serializedAudits = JSON.stringify(audits);
    for (const privateValue of ["Line one", "globalThis.xss", "Private task body", "+91 98765 43210", "qa@example.test", "Synthetic address", "Reference only"]) {
      invariant(!serializedAudits.toLowerCase().includes(privateValue.toLowerCase()), `${SUITE}_PRIVATE_AUDIT_CONTENT_LEAK`);
    }
    invariant(audits.every((row) => row.actorUserId === superA.id && row.ownerUserId === superA.id && row.entityPublicKey && row.eventType && row.occurredAt), `${SUITE}_AUDIT_ATTRIBUTION_INVALID`);

    stage = "volume and performance";
    await client.superAdminDiaryEntry.createMany({ data: Array.from({ length: 300 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: superA.id, title: `Volume diary ${index}`, entryDate: date(`2026-08-${String(index % 28 + 1).padStart(2, "0")}`), notes: `Synthetic bounded note ${index}`, category: "OPERATIONS", status: index % 7 === 0 ? "CLOSED" : "OPEN", priority: "NORMAL" })) });
    await client.superAdminTask.createMany({ data: Array.from({ length: 1_200 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: superA.id, title: `Volume task ${index}`, status: index % 11 === 0 ? "DONE" : "TO_DO", priority: index % 5 === 0 ? "HIGH" : "NORMAL", dueDate: date(index % 3 === 0 ? "2026-08-20" : index % 3 === 1 ? "2026-08-21" : "2026-08-22"), reminderAt: index % 4 === 0 ? new Date("2026-08-22T03:30:00.000Z") : null, category: "PERSONAL_WORK" })) });
    await client.superAdminContact.createMany({ data: Array.from({ length: 1_000 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: superA.id, name: `Volume contact ${String(index).padStart(4, "0")}`, category: index % 2 ? "BOOK_SUPPLIER" : "IT_SOFTWARE_VENDOR", phone: `90000${String(index).padStart(5, "0")}`, status: index % 13 === 0 ? "INACTIVE" : "ACTIVE", preferred: index % 17 === 0, tagsJson: "[\"synthetic\"]" })) });
    await createTask(client, actor(superB), { title: "B private today", dueDate: "2026-08-21", reminderAt: "2026-08-21T12:30", category: "OTHER" });
    const bounded = await listSuperAdminWork(client, actor(superA));
    invariant(bounded.diary.length === 60 && bounded.tasks.length === 100 && bounded.contacts.length === 100, `${SUITE}_PRIMARY_LISTS_UNBOUNDED`);
    const summaryB = await summarizeSuperAdminWork(client, actor(superB), now);
    invariant(summaryB.todayTasks === 1 && summaryB.overdueTasks === 0 && summaryB.activeContacts === 0 && summaryB.recentDiary.length === 0, `${SUITE}_COMMAND_SUMMARY_OWNER_LEAK`);
    const listTimes: number[] = [];
    const summaryTimes: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      let started = performance.now();
      await listSuperAdminWork(client, actor(superA));
      listTimes.push(performance.now() - started);
      started = performance.now();
      await summarizeSuperAdminWork(client, actor(superA), now);
      summaryTimes.push(performance.now() - started);
    }
    const listP95Ms = percentile95(listTimes);
    const commandP95Ms = percentile95(summaryTimes);
    invariant(listP95Ms <= 2_000 && commandP95Ms <= 2_000, `${SUITE}_P95_EXCEEDED`);

    stage = "side-effect and operational integrity";
    invariant(JSON.stringify(await tableCounts(client, providerTables)) === JSON.stringify(providerBefore), `${SUITE}_PROVIDER_SIDE_EFFECT_DETECTED`);
    const protectedAfter = await tableCounts(client, protectedTables);
    invariant(JSON.stringify(protectedAfter) === JSON.stringify(protectedBefore), `${SUITE}_PROTECTED_BUSINESS_ROW_CHANGED`);
    const sourceText = ["lib/super-admin-work.ts", "app/api/super-admin/my-work/route.ts"].map((file) => readFileSync(path.join(workspace, file), "utf8")).join("\n");
    invariant(!/notificationCampaign|notificationRecipient|whatsApp|smsEmail|openai|anthropic|\bfetch\s*\(/i.test(sourceText), `${SUITE}_EXTERNAL_OR_AI_CALL_PRESENT`);

    const credentials = {
      password: qaPassword,
      superA: { username: superA.username, id: superA.id },
      superB: { username: superB.username, id: superB.id },
      roles: Object.fromEntries(roleFixtures.map((fixture) => [fixture.role, { username: fixture.username, id: fixture.id }])),
      delegatedProfileUserId: delegated.id,
      databaseUrl: databaseUrl(migratedCopy)
    };
    writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { flag: "wx" });

    const operationalAfter = { sha256: sha256(operational), size: statSync(operational).size };
    invariant(JSON.stringify(operationalBefore) === JSON.stringify(operationalAfter), `${SUITE}_OPERATIONAL_DATABASE_CHANGED`);
    console.log(JSON.stringify({
      result: `${SUITE}_COPIED_DATABASE_VERIFIED`,
      operationalBefore,
      operationalAfter,
      additiveMigration: true,
      migrateTwice: true,
      freshMigration: true,
      recoveryCopyIntegrity: recoveryHealth.integrity,
      protectedRowsUnchanged: true,
      rolesDenied: roleFixtures.map((fixture) => fixture.role),
      delegatedProfileDeniedByExactRole: true,
      twoSuperAdminOwnerIsolation: true,
      limits: bounded.bounded,
      volume: { diary: await client.superAdminDiaryEntry.count({ where: { ownerUserId: superA.id } }), tasks: await client.superAdminTask.count({ where: { ownerUserId: superA.id } }), contacts: await client.superAdminContact.count({ where: { ownerUserId: superA.id } }) },
      p95Ms: { myWork: Number(listP95Ms.toFixed(2)), commandCenter: Number(commandP95Ms.toFixed(2)) },
      privacySafeAudit: true,
      noProviderSideEffects: true,
      credentialsPath
    }));
  } finally {
    await client.$disconnect();
    await fresh.$disconnect();
    await recovery.$disconnect();
  }
}

async function mutateRuntimeFixture(action: "multi-role" | "invalidate-b" | "disable-b") {
  invariant(existsSync(credentialsPath) && existsSync(migratedCopy), `${SUITE}_RUNTIME_FIXTURE_MISSING`);
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as { superA: { id: string }; superB: { id: string } };
  const client = new PrismaClient({ datasourceUrl: databaseUrl(migratedCopy) });
  try {
    if (action === "multi-role") {
      const existing = await client.userRoleAssignment.findFirst({ where: { userId: credentials.superA.id, role: "DIRECTOR", status: "ACTIVE" } });
      if (!existing) await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: credentials.superA.id, role: "DIRECTOR", status: "ACTIVE", reason: `${SUITE} multi-role context`, activeKey: `${credentials.superA.id}:DIRECTOR` } });
    } else if (action === "invalidate-b") {
      await client.user.update({ where: { id: credentials.superB.id }, data: { authorizationVersion: { increment: 1 } } });
    } else {
      await client.user.update({ where: { id: credentials.superB.id }, data: { isActive: false, lifecycleStatus: "DISABLED", authorizationVersion: { increment: 1 } } });
    }
    console.log(JSON.stringify({ result: `${SUITE}_${action.toUpperCase().replaceAll("-", "_")}_COMPLETE` }));
  } finally {
    await client.$disconnect();
  }
}

if (process.argv.includes("cleanup")) {
  cleanup();
  cleanup();
  console.log(JSON.stringify({ result: `${SUITE}_CLEANUP_COMPLETE`, exists: existsSync(root) }));
} else if (process.argv.includes("multi-role")) {
  mutateRuntimeFixture("multi-role").catch((error) => { console.error(error); process.exitCode = 1; });
} else if (process.argv.includes("invalidate-b")) {
  mutateRuntimeFixture("invalidate-b").catch((error) => { console.error(error); process.exitCode = 1; });
} else if (process.argv.includes("disable-b")) {
  mutateRuntimeFixture("disable-b").catch((error) => { console.error(error); process.exitCode = 1; });
} else {
  main().catch((error) => {
    console.error(`${stage}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
