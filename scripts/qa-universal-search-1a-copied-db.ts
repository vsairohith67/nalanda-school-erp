import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../lib/password";
import { resolveLoginIdentifier } from "../lib/auth-identifiers";
import { parseUniversalSearchRequest, runUniversalSearch } from "../lib/universal-search";

const SUITE = "UNIVERSALSEARCH1A";
const workspace = path.resolve(".");
const operational = path.resolve(process.env.UNIVERSAL_SEARCH_OPERATIONAL_DB?.trim() || path.join(workspace, "prisma", "dev.db"));
const root = path.join(workspace, "tmp", "universal-search-1a-qa");
const copiedDatabase = path.join(root, "search-copy.db");
const credentialsPath = path.join(root, "browser-credentials.json");
const fixtureSuffix = randomUUID().slice(0, 8);
const password = `universalsearch${fixtureSuffix}safe9`;
const target = `US1ATARGET${fixtureSuffix}`;
const keep = process.argv.includes("--keep");
let stage = "preflight";

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
  const parent = path.resolve(workspace, "tmp");
  invariant(resolved.startsWith(`${parent}${path.sep}`) && resolved.endsWith("universal-search-1a-qa"), `${SUITE}_CLEANUP_SCOPE_REFUSED`);
  return resolved;
}

function cleanup() {
  const targetPath = checkedRoot();
  if (existsSync(targetPath)) rmSync(targetPath, { recursive: true, force: true });
}

function percentile(values: number[], proportion: number) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * proportion) - 1)] ?? 0;
}

function applyExistingMigrations(database: string) {
  const prismaEntry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  invariant(existsSync(prismaEntry), `${SUITE}_PRISMA_RUNTIME_MISSING`);
  const result = spawnSync(process.execPath, [prismaEntry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    cwd: workspace,
    env: { ...process.env, DATABASE_URL: databaseUrl(database) },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error || result.status !== 0) throw new Error(`${SUITE}_COPIED_DATABASE_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
}

async function createUser(client: PrismaClient, role: "SUPER_ADMIN" | "PRINCIPAL", label: string, passwordHash: string) {
  const id = randomUUID();
  const username = `${SUITE.toLowerCase()}-${label.toLowerCase()}-${fixtureSuffix}`;
  await client.user.create({ data: {
    id, iamPublicKey: randomUUID(), name: `${target} ${label}`, designation: `${role} copied-database fixture`,
    username, passwordHash, role, isActive: true, lifecycleStatus: "ACTIVE"
  } });
  await client.authLoginAlias.create({ data: { userId: id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: id, role, status: "ACTIVE", reason: `${SUITE} copied-database fixture`, activeKey: `${id}:${role}` } });
  return { id, username, role } as const;
}

async function seedVolume(client: PrismaClient, ownerA: string, ownerB: string) {
  stage = "synthetic volume";
  const baseDate = new Date("2026-08-22T00:00:00.000Z");
  await client.student.createMany({ data: Array.from({ length: 1_200 }, (_, index) => ({
    admissionNo: `${target}-ADM-${String(index).padStart(4, "0")}`,
    studentName: `${target} Student ${String(index).padStart(4, "0")}`,
    fatherName: `${target} Guardian ${String(index).padStart(4, "0")}`,
    className: String(index % 10 + 1), section: ["A", "B", "C"][index % 3], phone1: `9000${String(index).padStart(6, "0")}`,
    academicYear: "2026-27", status: "Active"
  })) });
  const students = await client.student.findMany({ where: { admissionNo: { startsWith: `${target}-ADM-` } }, select: { id: true }, orderBy: { admissionNo: "asc" }, take: 1_200 });
  invariant(students.length === 1_200, `${SUITE}_STUDENT_VOLUME_INVALID`);

  await client.guardian.createMany({ data: Array.from({ length: 600 }, (_, index) => ({
    displayName: `${target} Guardian ${String(index).padStart(4, "0")}`,
    primaryMobile: `9100${String(index).padStart(6, "0")}`, email: `${target.toLowerCase()}-${index}@example.test`, relationship: "Parent", status: "Active"
  })) });
  await client.staffMember.createMany({ data: Array.from({ length: 320 }, (_, index) => ({
    staffCode: `${target}-STAFF-${String(index).padStart(4, "0")}`, fullName: `${target} Staff ${String(index).padStart(4, "0")}`,
    designation: index % 2 ? "Teacher" : "Administrator", department: index % 2 ? "Academics" : "Operations", status: "ACTIVE"
  })) });
  await client.admissionEnquiry.createMany({ data: Array.from({ length: 360 }, (_, index) => ({
    publicKey: randomUUID(), enquiryNumber: `${target}-ENQ-${String(index).padStart(4, "0")}`,
    guardianName: `${target} Prospective Guardian ${index}`, contactMethod: "PHONE", contactValue: `9200${String(index).padStart(6, "0")}`,
    contactHash: createHash("sha256").update(`${target}-${index}`).digest("hex"), desiredAcademicYear: "2026-27", desiredClass: String(index % 10 + 1),
    childName: `${target} Applicant ${index}`, enquirySource: "WALK_IN", privacyNoticeVersion: "SYNTHETIC", consentVersion: "SYNTHETIC",
    consentRecordedAt: baseDate, intakeChannel: "IN_PERSON", status: "NEW", retentionReviewAt: new Date("2027-08-22T00:00:00.000Z")
  })) });
  await client.superAdminDiaryEntry.createMany({ data: [
    ...Array.from({ length: 420 }, (_, index) => ({
      publicKey: randomUUID(), ownerUserId: ownerA,
      title: index === 0
        ? `${target} Diary with a deliberately long but privacy-safe title for responsive Universal Search result layout verification`
        : `${target} Diary ${index}`,
      entryDate: baseDate,
      notes: index === 0
        ? `${target} privacy-safe copied-database note with deliberately extended content to verify that long snippets remain readable and bounded on desktop and mobile without exposing another owner's data.`
        : `${target} private diary body ${index}`,
      category: "OPERATIONS", status: "OPEN", priority: "NORMAL"
    })),
    ...Array.from({ length: 12 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: ownerB, title: `${target} OWNER B DIARY ${index}`, entryDate: baseDate, notes: `${target} owner-b-only diary ${index}`, category: "PERSONAL_WORK", status: "OPEN", priority: "NORMAL" }))
  ] });
  await client.superAdminTask.createMany({ data: [
    ...Array.from({ length: 1_500 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: ownerA, title: `${target} Task ${index}`, description: `${target} bounded task description ${index}`, status: "TO_DO", priority: "NORMAL", dueDate: baseDate, category: "OPERATIONS" })),
    ...Array.from({ length: 12 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: ownerB, title: `${target} OWNER B TASK ${index}`, description: `${target} owner-b-only task ${index}`, status: "TO_DO", priority: "NORMAL", dueDate: baseDate, category: "PERSONAL_WORK" }))
  ] });
  await client.superAdminContact.createMany({ data: [
    ...Array.from({ length: 520 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: ownerA, name: `${target} Contact ${index}`, contactPerson: `${target} Person ${index}`, category: "BOOK_SUPPLIER", phone: `9300${String(index).padStart(6, "0")}`, email: `${target.toLowerCase()}-contact-${index}@example.test`, status: "ACTIVE", tagsJson: `["${target}","synthetic"]` })),
    ...Array.from({ length: 12 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: ownerB, name: `${target} OWNER B CONTACT ${index}`, category: "OTHER", phone: `9400${String(index).padStart(6, "0")}`, status: "ACTIVE", tagsJson: "[]" }))
  ] });
  await client.payment.createMany({ data: Array.from({ length: 240 }, (_, index) => ({
    date: baseDate, receiptNo: `${target}-RCT-${String(index).padStart(4, "0")}`, admissionNo: `${target}-ADM-${String(index).padStart(4, "0")}`,
    studentId: students[index].id, studentName: `${target} Student ${String(index).padStart(4, "0")}`, className: String(index % 10 + 1),
    amountPaid: 1_000, paymentMode: "Cash", receivedAccount: "Synthetic copy", feeType: "Current Year Fee", enteredBy: "Synthetic QA"
  })) });
  await client.examination.createMany({ data: Array.from({ length: 140 }, (_, index) => ({
    examCode: `${target}-EXAM-${String(index).padStart(4, "0")}`, academicYear: "2026-27", name: `${target} Examination ${index}`,
    examType: "TERM", startDate: baseDate, endDate: new Date("2026-08-25T00:00:00.000Z"), status: "ACTIVE", createdByUserId: ownerA
  })) });

  const queue = await client.supportQueue.create({ data: { publicKey: randomUUID(), queueCode: `${target}-QUEUE`, name: `${target} Support Queue`, allowedAssigneeRolesJson: '["SUPER_ADMIN"]' } });
  const category = await client.supportCategoryPolicy.create({ data: { publicKey: randomUUID(), categoryCode: `${target}-GENERAL`, label: `${target} General`, queueId: queue.id, permittedAssigneeRolesJson: '["SUPER_ADMIN"]', createdByUserId: ownerA } });
  await client.supportRequest.createMany({ data: Array.from({ length: 120 }, (_, index) => ({
    publicKey: randomUUID(), reference: `${target}-SUP-${String(index).padStart(4, "0")}`, source: "IN_PERSON", requesterName: `${target} Requester ${index}`,
    requesterType: "OTHER", recordedByUserId: ownerA, categoryPolicyId: category.id, queueId: queue.id, priority: "NORMAL", confidentiality: "STANDARD",
    subject: `${target} Support subject ${index}`, originalStatement: "Synthetic copied-database statement", status: "OPEN", privacyNoticeVersion: "SYNTHETIC",
    retentionReviewAt: new Date("2027-08-22T00:00:00.000Z")
  })) });
  await client.studentDepartureRequest.createMany({ data: Array.from({ length: 80 }, (_, index) => ({
    publicKey: randomUUID(), requestNumber: `${target}-EXIT-${String(index).padStart(4, "0")}`, submissionKey: randomUUID(), source: "STAFF",
    studentId: students[index].id, academicYear: "2026-27", reasonCategory: "OTHER", calendarBasisJson: "{}", intendedHandoverMethod: "PARENT_PICKUP",
    intendedDepartureAt: baseDate, status: "REQUESTED", restricted: false, requestedByUserId: ownerA, requestedByRole: "SUPER_ADMIN"
  })) });

  await client.releaseManifest.createMany({ data: Array.from({ length: 20 }, (_, index) => ({
    releaseVersion: `${target}-v${index}`, environment: "SYNTHETIC", gitCommit: `${target}${String(index).padStart(4, "0")}`, buildId: `${target}-BUILD-${index}`,
    migrationVersion: "COPIED_DB_ONLY", backupVersion: 1, pwaBuildId: `${target}-PWA-${index}`, applicationSchemaId: "SYNTHETIC", createdByUserId: ownerA
  })) });
  await client.operationalAlert.createMany({ data: Array.from({ length: 100 }, (_, index) => ({
    publicKey: randomUUID(), fingerprint: createHash("sha256").update(`${target}-alert-${index}`).digest("hex"), domain: "CORE_APPLICATION_HEALTH", severity: "WARNING",
    status: "OPEN", titleSafe: `${target} Alert ${index}`, evidenceSummarySafe: `${target} safe synthetic evidence`, runbookPath: "docs/synthetic"
  })) });
}

async function main() {
  cleanup();
  mkdirSync(root, { recursive: true });
  invariant(existsSync(operational), `${SUITE}_OPERATIONAL_DATABASE_MISSING`);
  const operationalBefore = { sha256: sha256(operational), size: statSync(operational).size };
  copyFileSync(operational, copiedDatabase);
  stage = "apply existing migrations to copy";
  applyExistingMigrations(copiedDatabase);
  const client = new PrismaClient({ datasourceUrl: databaseUrl(copiedDatabase) });
  try {
    stage = "actor fixtures";
    const passwordHash = await hashPassword(password);
    const superA = await createUser(client, "SUPER_ADMIN", "A", passwordHash);
    const superB = await createUser(client, "SUPER_ADMIN", "B", passwordHash);
    const principal = await createUser(client, "PRINCIPAL", "Principal", passwordHash);
    await seedVolume(client, superA.id, superB.id);

    stage = "owner isolation";
    const ownerRequest = parseUniversalSearchRequest({ query: target, sources: ["DIARY", "TASKS", "CONTACTS"], limit: 50 });
    const ownerA = await runUniversalSearch(client, { id: superA.id, role: "SUPER_ADMIN" }, ownerRequest);
    const ownerB = await runUniversalSearch(client, { id: superB.id, role: "SUPER_ADMIN" }, ownerRequest);
    invariant(ownerA.results.length > 0 && ownerB.results.length > 0, `${SUITE}_OWNER_RESULTS_MISSING`);
    invariant(!JSON.stringify(ownerA).includes("OWNER B"), `${SUITE}_OWNER_A_LEAKED_OWNER_B`);
    invariant(ownerB.results.every((row) => row.title.includes("OWNER B")), `${SUITE}_OWNER_B_RESULTS_INVALID`);

    stage = "performance";
    const measured = new PrismaClient({ datasourceUrl: databaseUrl(copiedDatabase), log: [{ emit: "event", level: "query" }] });
    let queryCount = 0;
    measured.$on("query", (_event: Prisma.QueryEvent) => { queryCount += 1; });
    const request = parseUniversalSearchRequest({ query: target, limit: 50 });
    const times: number[] = [];
    const counts: number[] = [];
    const heapBefore = process.memoryUsage().heapUsed;
    try {
      await runUniversalSearch(measured, { id: superA.id, role: "SUPER_ADMIN" }, request);
      // A timed-out Prisma read cannot be cancelled. Let any cold-start read settle
      // before measuring steady-state query counts so it is not charged to the next run.
      await new Promise((resolve) => setTimeout(resolve, 800));
      queryCount = 0;
      for (let index = 0; index < 25; index += 1) {
        const beforeQueries = queryCount;
        const started = performance.now();
        const response = await runUniversalSearch(measured, { id: superA.id, role: "SUPER_ADMIN" }, request);
        times.push(performance.now() - started);
        counts.push(queryCount - beforeQueries);
        invariant(response.results.length <= 50 && response.total <= 50, `${SUITE}_CLIENT_RESULT_BOUND_FAILED`);
        invariant(response.sources.filter((source) => source.state === "TIMEOUT").length === 0, `${SUITE}_SOURCE_TIMEOUT_UNEXPECTED`);
      }
    } finally {
      await measured.$disconnect();
    }
    const p95Ms = percentile(times, .95);
    const maximumMs = Math.max(...times);
    const heapGrowth = process.memoryUsage().heapUsed - heapBefore;
    invariant(p95Ms <= 1_500, `${SUITE}_P95_EXCEEDED:${p95Ms.toFixed(2)}`);
    invariant(maximumMs <= 2_000, `${SUITE}_HARD_CEILING_EXCEEDED:${maximumMs.toFixed(2)}`);
    invariant(Math.max(...counts) <= 20, `${SUITE}_QUERY_BOUND_EXCEEDED:${Math.max(...counts)}`);
    invariant(heapGrowth < 160 * 1024 * 1024, `${SUITE}_HEAP_GROWTH_EXCEEDED:${heapGrowth}`);

    stage = "operational integrity";
    const operationalAfter = { sha256: sha256(operational), size: statSync(operational).size };
    invariant(JSON.stringify(operationalBefore) === JSON.stringify(operationalAfter), `${SUITE}_OPERATIONAL_DATABASE_CHANGED`);
    const credentials = { databaseUrl: databaseUrl(copiedDatabase), password, superA: { username: superA.username }, superB: { username: superB.username }, principal: { username: principal.username } };
    writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { flag: "wx" });
    console.log(JSON.stringify({
      result: `${SUITE}_COPIED_DATABASE_VERIFIED`, operationalBefore, operationalAfter,
      volume: { students: 1_200, guardians: 600, staff: 320, admissions: 360, diary: 432, tasks: 1_512, contacts: 532, fees: 240, exams: 140, support: 120, safeExit: 80 },
      ownerIsolation: true, resultLimit: 50, maximumQueriesPerRequest: Math.max(...counts), p95Ms: Number(p95Ms.toFixed(2)), maximumMs: Number(maximumMs.toFixed(2)),
      heapGrowthBytes: heapGrowth, copiedDatabaseRetained: keep, credentialsPath: keep ? credentialsPath : null
    }));
  } finally {
    await client.$disconnect();
    if (!keep) cleanup();
  }
}

async function setObservabilityDegraded(degraded: boolean) {
  invariant(existsSync(credentialsPath), `${SUITE}_BROWSER_CREDENTIALS_MISSING`);
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as { databaseUrl?: string };
  invariant(typeof credentials.databaseUrl === "string", `${SUITE}_BROWSER_DATABASE_URL_MISSING`);
  const copiedPath = path.resolve(credentials.databaseUrl.replace(/^file:/, ""));
  invariant(copiedPath === path.resolve(copiedDatabase), `${SUITE}_BROWSER_DATABASE_SCOPE_REFUSED`);
  const client = new PrismaClient({ datasourceUrl: credentials.databaseUrl });
  try {
    const active = "OperationalAlert";
    const held = "OperationalAlertUniversalSearchQaHeld";
    const rows = await client.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?)",
      active,
      held
    );
    const names = new Set(rows.map((row) => row.name));
    if (degraded && names.has(active) && !names.has(held)) {
      await client.$executeRawUnsafe(`ALTER TABLE "${active}" RENAME TO "${held}"`);
    } else if (!degraded && names.has(held) && !names.has(active)) {
      await client.$executeRawUnsafe(`ALTER TABLE "${held}" RENAME TO "${active}"`);
    }
    console.log(JSON.stringify({ result: degraded ? `${SUITE}_OBSERVABILITY_DEGRADED` : `${SUITE}_OBSERVABILITY_RESTORED` }));
  } finally {
    await client.$disconnect();
  }
}

async function verifyBrowserCredentials() {
  invariant(existsSync(credentialsPath), `${SUITE}_BROWSER_CREDENTIALS_MISSING`);
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as { databaseUrl?: string; password?: string; superA?: { username?: string } };
  invariant(typeof credentials.databaseUrl === "string" && typeof credentials.password === "string" && typeof credentials.superA?.username === "string", `${SUITE}_BROWSER_CREDENTIALS_INVALID`);
  const client = new PrismaClient({ datasourceUrl: credentials.databaseUrl });
  try {
    const resolved = await resolveLoginIdentifier(client, credentials.superA.username);
    invariant(resolved.kind === "resolved", `${SUITE}_BROWSER_IDENTIFIER_NOT_RESOLVED`);
    invariant(await verifyPassword(credentials.password, resolved.user.passwordHash), `${SUITE}_BROWSER_PASSWORD_NOT_VERIFIED`);
    console.log(JSON.stringify({ result: `${SUITE}_BROWSER_CREDENTIALS_VERIFIED` }));
  } finally {
    await client.$disconnect();
  }
}

async function runBrowserCookieBridge() {
  invariant(existsSync(credentialsPath), `${SUITE}_BROWSER_CREDENTIALS_MISSING`);
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as {
    password?: string;
    superA?: { username?: string };
    principal?: { username?: string };
  };
  invariant(typeof credentials.password === "string" && typeof credentials.superA?.username === "string" && typeof credentials.principal?.username === "string", `${SUITE}_BROWSER_CREDENTIALS_INVALID`);
  const actors = { "super-a": credentials.superA.username, principal: credentials.principal.username } as const;
  const bridge = createServer(async (request, response) => {
    try {
      const actor = request.url === "/principal" ? "principal" : request.url === "/super-a" ? "super-a" : null;
      if (!actor) {
        response.writeHead(404, { "cache-control": "no-store" }).end("Not found");
        return;
      }
      const login = await fetch("http://127.0.0.1:3108/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": `${SUITE} copied-database browser bridge` },
        body: JSON.stringify({ identifier: actors[actor], password: credentials.password })
      });
      const cookie = login.headers.get("set-cookie");
      invariant(login.ok && cookie, `${SUITE}_BROWSER_BRIDGE_LOGIN_FAILED`);
      response.writeHead(302, {
        "cache-control": "no-store",
        "set-cookie": cookie,
        location: actor === "principal" ? "http://127.0.0.1:3108/super-admin/search" : "http://127.0.0.1:3108/dashboard"
      }).end();
    } catch {
      response.writeHead(502, { "cache-control": "no-store" }).end("QA bridge unavailable");
    }
  });
  bridge.listen(3109, "127.0.0.1", () => console.log(JSON.stringify({ result: `${SUITE}_BROWSER_COOKIE_BRIDGE_READY`, port: 3109 })));
}

if (process.argv.includes("cleanup")) {
  cleanup();
  console.log(JSON.stringify({ result: `${SUITE}_CLEANUP_COMPLETE`, exists: existsSync(root) }));
} else if (process.argv.includes("degrade-observability")) {
  setObservabilityDegraded(true).catch((error) => {
    console.error(`${SUITE}_OBSERVABILITY_DEGRADE_FAILED:${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
} else if (process.argv.includes("restore-observability")) {
  setObservabilityDegraded(false).catch((error) => {
    console.error(`${SUITE}_OBSERVABILITY_RESTORE_FAILED:${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
} else if (process.argv.includes("verify-browser-credentials")) {
  verifyBrowserCredentials().catch((error) => {
    console.error(`${SUITE}_BROWSER_CREDENTIAL_VERIFY_FAILED:${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
} else if (process.argv.includes("browser-cookie-bridge")) {
  runBrowserCookieBridge().catch((error) => {
    console.error(`${SUITE}_BROWSER_COOKIE_BRIDGE_FAILED:${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
} else {
  main().catch((error) => {
    console.error(`${stage}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
