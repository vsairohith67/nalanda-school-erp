import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { grantMarksDelegation } from "../lib/academic-integrity";
import { hashPassword } from "../lib/password";
import type { Role } from "../lib/permissions";

const SUITE = "UNIVERSALSEARCH1A_INDEPENDENT";
const workspace = path.resolve(".");
const fixtureRoot = path.join(workspace, "tmp", "universal-search-1a-qa");
const baseCredentialsPath = path.join(fixtureRoot, "browser-credentials.json");
const credentialsPath = path.join(fixtureRoot, "independent-credentials.json");
const baseUrl = process.env.UNIVERSAL_SEARCH_BASE_URL?.trim() || "http://127.0.0.1:3108";

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

type ActorCredential = { username: string; role: Role; delegatedMarks?: boolean };
type IndependentCredentials = {
  databaseUrl: string;
  password: string;
  sentinel: string;
  exactReference: string;
  ownerQuery: string;
  ownerAOnly: string;
  ownerBOnly: string;
  xssTitle: string;
  secretQueries: string[];
  actors: Record<string, ActorCredential>;
};

function readBaseCredentials() {
  invariant(existsSync(baseCredentialsPath), `${SUITE}_BASE_FIXTURE_MISSING`);
  const value = JSON.parse(readFileSync(baseCredentialsPath, "utf8")) as {
    databaseUrl?: string;
    password?: string;
    superA?: { username?: string };
    superB?: { username?: string };
  };
  invariant(value.databaseUrl && value.password && value.superA?.username && value.superB?.username, `${SUITE}_BASE_FIXTURE_INVALID`);
  return value as { databaseUrl: string; password: string; superA: { username: string }; superB: { username: string } };
}

async function createUser(client: PrismaClient, role: Role, slug: string, passwordHash: string, extraRoles: Role[] = []) {
  const id = randomUUID();
  const iamPublicKey = randomUUID();
  const username = `us1aqa-${slug}-${randomUUID().slice(0, 8)}`;
  await client.user.create({ data: {
    id,
    iamPublicKey,
    name: `US1A independent ${slug}`,
    designation: `${role} independent QA`,
    username,
    passwordHash,
    role,
    isActive: true,
    lifecycleStatus: "ACTIVE"
  } });
  await client.authLoginAlias.create({ data: {
    userId: id,
    type: "USERNAME",
    normalizedValue: username,
    displayMasked: username,
    status: "VERIFIED",
    isSchoolGoverned: true,
    verifiedAt: new Date()
  } });
  for (const assignmentRole of [role, ...extraRoles]) {
    await client.userRoleAssignment.create({ data: {
      publicKey: randomUUID(),
      userId: id,
      role: assignmentRole,
      status: "ACTIVE",
      reason: `${SUITE} exact-role matrix`,
      activeKey: `${id}:${assignmentRole}`
    } });
  }
  return { id, iamPublicKey, username, role };
}

async function setup() {
  const base = readBaseCredentials();
  invariant(!existsSync(credentialsPath), `${SUITE}_CREDENTIALS_ALREADY_EXIST`);
  const client = new PrismaClient({ datasourceUrl: base.databaseUrl });
  try {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const sentinel = `US1AQA${suffix}`;
    const exactReference = `${sentinel}-EXACT-001`;
    const ownerQuery = `${sentinel}OWNER`;
    const ownerAOnly = `${ownerQuery} AONLY`;
    const ownerBOnly = `${ownerQuery} BONLY`;
    const xssTitle = `<img src=x onerror="window.__us1aXss=1"> ${sentinel} XSS`;
    const secretQueries = [`${sentinel}SECRETREMARK`, `${sentinel}SECRETNOTE`, `${sentinel}SECRETHASH`];
    const passwordHash = await hashPassword(base.password);
    const roles = ["DIRECTOR", "PRINCIPAL", "ACCOUNTANT", "ADMIN", "COMPUTER_OPERATOR", "TEACHER", "PARENT", "STUDENT", "GATE_STAFF", "VIEWER"] as Role[];
    const actors: Record<string, ActorCredential> = {
      superA: { username: base.superA.username, role: "SUPER_ADMIN" },
      superB: { username: base.superB.username, role: "SUPER_ADMIN" }
    };
    for (const role of roles) {
      const created = await createUser(client, role, role.toLowerCase(), passwordHash);
      actors[role.toLowerCase()] = { username: created.username, role };
    }
    const delegated = await createUser(client, "COMPUTER_OPERATOR", "delegated-marks-operator", passwordHash);
    const delegationCycle = await client.examCycle.create({ data: {
      examCode: `${sentinel}-DELEGATION`,
      academicYear: "2098-99",
      name: `${sentinel} delegation scope`,
      examType: "TERM",
      startDate: new Date("2098-08-01T00:00:00.000Z"),
      endDate: new Date("2098-08-10T00:00:00.000Z"),
      status: "OPEN_FOR_ENTRY"
    } });
    const delegationScope = await client.examAssessment.create({ data: {
      examCycleId: delegationCycle.id,
      academicYear: "2098-99",
      className: "VIII",
      section: "A",
      subjectName: "Mathematics",
      componentName: "Theory",
      assessmentType: "WRITTEN",
      maxMarks: 100,
      entryStatus: "OPEN"
    } });
    const superActor = await client.user.findUniqueOrThrow({ where: { username: base.superA.username } });
    await grantMarksDelegation(client, { id: superActor.id, name: superActor.name, role: "SUPER_ADMIN" }, {
      userHandle: delegated.iamPublicKey,
      kind: "LEGACY_ASSESSMENT",
      targetId: delegationScope.id,
      reason: `${SUITE} exact-scope delegated operator denial`
    });
    const reserved = await client.permissionProfile.findUnique({ where: { normalizedName: "marks_entry_operator" } });
    actors.delegated_marks_operator = { username: delegated.username, role: "COMPUTER_OPERATOR", delegatedMarks: true };
    const multiSuper = await createUser(client, "SUPER_ADMIN", "multi-super", passwordHash, ["TEACHER"]);
    const multiTeacher = await createUser(client, "TEACHER", "multi-teacher", passwordHash, ["SUPER_ADMIN"]);
    actors.multi_super = { username: multiSuper.username, role: "SUPER_ADMIN" };
    actors.multi_teacher = { username: multiTeacher.username, role: "TEACHER" };

    const [superA, superB] = await Promise.all([
      client.user.findUniqueOrThrow({ where: { username: base.superA.username } }),
      client.user.findUniqueOrThrow({ where: { username: base.superB.username } })
    ]);
    await client.student.create({ data: {
      admissionNo: exactReference,
      studentName: "Arjun Reddy",
      fatherName: "Ravi Reddy",
      className: "8",
      section: "A",
      phone1: "9000000000",
      academicYear: "2026-27",
      remarks: secretQueries[0]
    } });
    await client.superAdminContact.createMany({ data: [
      { publicKey: randomUUID(), ownerUserId: superA.id, name: "Arjun Books", contactPerson: "Arjun", category: "BOOK_SUPPLIER", status: "ACTIVE", tagsJson: '["Arjun"]', notes: secretQueries[1] },
      { publicKey: randomUUID(), ownerUserId: superA.id, name: ownerAOnly, category: "OTHER", status: "ACTIVE", tagsJson: "[]" },
      { publicKey: randomUUID(), ownerUserId: superB.id, name: ownerBOnly, category: "OTHER", status: "ACTIVE", tagsJson: "[]" }
    ] });
    await client.superAdminTask.create({ data: { publicKey: randomUUID(), ownerUserId: superA.id, title: "Call Arjun Books", description: "Deterministic collision", dueDate: new Date("2026-08-22T00:00:00.000Z"), category: "VENDOR" } });
    await client.superAdminDiaryEntry.createMany({ data: [
      { publicKey: randomUUID(), ownerUserId: superA.id, title: "Meeting with Arjun's parent", notes: "Deterministic collision", entryDate: new Date("2026-08-22T00:00:00.000Z"), category: "PARENT_MATTER" },
      { publicKey: randomUUID(), ownerUserId: superA.id, title: xssTitle, notes: "Safe XSS rendering probe", entryDate: new Date("2026-08-22T00:00:00.000Z"), category: "OPERATIONS" }
    ] });
    const secretUser = await createUser(client, "VIEWER", "secret-hash", secretQueries[2], []);
    await client.user.update({ where: { id: secretUser.id }, data: { name: `${sentinel} safe user`, username: `us1aqa-safe-${suffix.toLowerCase()}` } });

    const credentials: IndependentCredentials = {
      databaseUrl: base.databaseUrl,
      password: base.password,
      sentinel,
      exactReference,
      ownerQuery,
      ownerAOnly,
      ownerBOnly,
      xssTitle,
      secretQueries,
      actors
    };
    writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ result: `${SUITE}_SETUP_COMPLETE`, actorCount: Object.keys(actors).length, delegatedProfilePresent: Boolean(reserved), credentialsPath }));
  } finally {
    await client.$disconnect();
  }
}

function cookieFrom(response: Response) {
  const raw = response.headers.get("set-cookie");
  invariant(raw, `${SUITE}_LOGIN_COOKIE_MISSING`);
  return raw.split(";", 1)[0];
}

async function login(username: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": `${SUITE} runtime` },
    body: JSON.stringify({ identifier: username, password })
  });
  invariant(response.status === 200, `${SUITE}_LOGIN_FAILED_${response.status}`);
  return cookieFrom(response);
}

async function search(cookie: string | null, body: unknown, extraHeaders: Record<string, string> = {}) {
  return fetch(`${baseUrl}/api/super-admin/search`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      ...(cookie ? { cookie } : {}),
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
}

async function switchRole(cookie: string, label: string) {
  const listed = await fetch(`${baseUrl}/api/auth/context`, { headers: { cookie } });
  invariant(listed.status === 200, `${SUITE}_CONTEXT_LIST_FAILED`);
  const body = await listed.json() as { contextVersion: number; contexts: Array<{ label: string; handle: string; active: boolean }> };
  const target = body.contexts.find((entry) => entry.label === label);
  invariant(target, `${SUITE}_CONTEXT_${label.replaceAll(" ", "_").toUpperCase()}_MISSING`);
  const changed = await fetch(`${baseUrl}/api/auth/context`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ handle: target.handle, expectedVersion: body.contextVersion })
  });
  invariant(changed.status === 200, `${SUITE}_CONTEXT_SWITCH_FAILED_${changed.status}`);
  const stale = await fetch(`${baseUrl}/api/auth/context`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ handle: target.handle, expectedVersion: body.contextVersion })
  });
  invariant(stale.status === 409, `${SUITE}_STALE_CONTEXT_NOT_REJECTED_${stale.status}`);
}

async function businessSnapshot(client: PrismaClient) {
  const rows = await Promise.all([
    client.student.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    client.guardian.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    client.staffMember.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    client.admissionEnquiry.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    client.superAdminDiaryEntry.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    client.superAdminTask.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    client.superAdminContact.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    client.payment.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    client.examination.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    client.studentReportCardVersion.findMany({ select: { id: true, createdAt: true }, orderBy: { id: "asc" } }),
    client.supportRequest.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } }),
    client.studentDepartureRequest.findMany({ select: { id: true, updatedAt: true }, orderBy: { id: "asc" } })
  ]);
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

async function runtime() {
  invariant(existsSync(credentialsPath), `${SUITE}_CREDENTIALS_MISSING`);
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as IndependentCredentials;
  const client = new PrismaClient({ datasourceUrl: credentials.databaseUrl });
  try {
    const cookies: Record<string, string> = {};
    for (const [key, actor] of Object.entries(credentials.actors)) cookies[key] = await login(actor.username, credentials.password);

    const unauthenticated = await search(null, { query: "Arjun" });
    invariant([401, 403].includes(unauthenticated.status), `${SUITE}_UNAUTHENTICATED_API_NOT_DENIED_${unauthenticated.status}`);
    const superResponse = await search(cookies.superA, { query: "Arjun" });
    if (superResponse.status !== 200) throw new Error(`${SUITE}_SUPER_ADMIN_API_NOT_ALLOWED_${superResponse.status}:${await superResponse.text()}`);
    const headers = superResponse.headers;
    invariant(headers.get("cache-control")?.includes("private") && headers.get("cache-control")?.includes("no-store"), `${SUITE}_CACHE_HEADER_INVALID_${headers.get("cache-control")}`);
    invariant(headers.get("vary")?.toLowerCase().includes("cookie"), `${SUITE}_VARY_HEADER_INVALID`);
    invariant(["no-referrer", "same-origin"].includes(headers.get("referrer-policy") ?? ""), `${SUITE}_REFERRER_HEADER_INVALID_${headers.get("referrer-policy")}`);
    for (const [key, actor] of Object.entries(credentials.actors)) {
      if (actor.role === "SUPER_ADMIN") continue;
      const denied = await search(cookies[key], { query: "Arjun", ownerId: "forged", role: "SUPER_ADMIN" });
      invariant(denied.status === 403, `${SUITE}_${key.toUpperCase()}_API_NOT_DENIED_${denied.status}`);
      const page = await fetch(`${baseUrl}/super-admin/search`, { headers: { cookie: cookies[key] }, redirect: "manual" });
      const redirectDenied = [302, 303, 307, 308].includes(page.status) && (page.headers.get("location") ?? "").includes("/unauthorized");
      const streamedDenied = page.status === 200 && (await page.text()).includes("/unauthorized");
      invariant(redirectDenied || streamedDenied, `${SUITE}_${key.toUpperCase()}_ROUTE_NOT_DENIED_${page.status}`);
    }
    const superPage = await fetch(`${baseUrl}/super-admin/search`, { headers: { cookie: cookies.superA }, redirect: "manual" });
    invariant(superPage.status === 200, `${SUITE}_SUPER_ADMIN_ROUTE_NOT_ALLOWED_${superPage.status}`);

    invariant((await search(cookies.multi_super, { query: "Arjun" })).status === 200, `${SUITE}_MULTI_SUPER_INITIAL_DENIED`);
    await switchRole(cookies.multi_super, "Teacher");
    invariant((await search(cookies.multi_super, { query: "Arjun" })).status === 403, `${SUITE}_MULTI_SUPER_TEACHER_CONTEXT_ALLOWED`);
    invariant((await search(cookies.multi_teacher, { query: "Arjun" })).status === 403, `${SUITE}_MULTI_TEACHER_INITIAL_ALLOWED`);
    await switchRole(cookies.multi_teacher, "School Owner");
    invariant((await search(cookies.multi_teacher, { query: "Arjun" })).status === 200, `${SUITE}_MULTI_TEACHER_SUPER_CONTEXT_DENIED`);

    const getApi = await fetch(`${baseUrl}/api/super-admin/search`, { headers: { cookie: cookies.superA }, redirect: "manual" });
    invariant(getApi.status === 405, `${SUITE}_GET_API_NOT_REJECTED_${getApi.status}`);
    const wrongType = await fetch(`${baseUrl}/api/super-admin/search`, { method: "POST", headers: { cookie: cookies.superA, "content-type": "text/plain", origin: baseUrl }, body: "Arjun" });
    invariant(wrongType.status === 415, `${SUITE}_CONTENT_TYPE_NOT_REJECTED_${wrongType.status}`);
    const oversized = await fetch(`${baseUrl}/api/super-admin/search`, { method: "POST", headers: { cookie: cookies.superA, "content-type": "application/json", origin: baseUrl }, body: JSON.stringify({ query: "x".repeat(16_100) }) });
    invariant(oversized.status === 413, `${SUITE}_OVERSIZED_NOT_REJECTED_${oversized.status}`);
    const crossOrigin = await search(cookies.superA, { query: "Arjun" }, { origin: "https://attacker.invalid" });
    invariant(crossOrigin.status === 403, `${SUITE}_CROSS_ORIGIN_NOT_REJECTED_${crossOrigin.status}`);
    const forgedHeader = await search(cookies.teacher, { query: "Arjun" }, { "x-role": "SUPER_ADMIN", "x-user-id": "forged" });
    invariant(forgedHeader.status === 403, `${SUITE}_FORGED_ROLE_HEADER_ALLOWED`);

    const invalidBodies: unknown[] = [
      {}, { query: "" }, { query: " " }, { query: "a" }, { query: "x".repeat(121) }, { query: "%_" },
      { query: "Arjun", sources: [] }, { query: "Arjun", sources: ["STUDENTS", "STUDENTS"] }, { query: "Arjun", sources: ["UNKNOWN"] },
      { query: "Arjun", limit: 61 }, { query: "Arjun", limit: -1 }, { query: "Arjun", pageSize: 1 }, { query: "Arjun", ownerId: "forged" },
      { query: "Arjun", sort: "passwordHash" }, { query: "Arjun", field: "passwordHash" }
    ];
    for (const body of invalidBodies) invariant((await search(cookies.superA, body)).status === 400, `${SUITE}_INVALID_BODY_ACCEPTED_${JSON.stringify(body)}`);
    for (const query of ["अर्जुन", "అర్జున్", "ارجن", "O'Brien", "ARJUN-2026/27", "SELECT * FROM User WHERE 1=1 --", "<script>alert(1)</script>", "<b>Arjun</b>", "C:\\private\\student-record", "Arjun\nReddy", "Arjun 😀"]) {
      invariant((await search(cookies.superA, { query, limit: 6 })).status === 200, `${SUITE}_SAFE_QUERY_REJECTED_${query}`);
    }

    const before = await businessSnapshot(client);
    const ownerA = await (await search(cookies.superA, { query: credentials.ownerQuery, sources: ["DIARY", "TASKS", "CONTACTS"] })).json() as { results: Array<{ title: string }> };
    const ownerB = await (await search(cookies.superB, { query: credentials.ownerQuery, sources: ["DIARY", "TASKS", "CONTACTS"] })).json() as { results: Array<{ title: string }> };
    invariant(ownerA.results.some((row) => row.title === credentials.ownerAOnly) && !ownerA.results.some((row) => row.title === credentials.ownerBOnly), `${SUITE}_OWNER_A_ISOLATION_FAILED`);
    invariant(ownerB.results.some((row) => row.title === credentials.ownerBOnly) && !ownerB.results.some((row) => row.title === credentials.ownerAOnly), `${SUITE}_OWNER_B_ISOLATION_FAILED`);
    for (const query of credentials.secretQueries) {
      const response = await search(cookies.superA, { query });
      invariant(response.status === 200, `${SUITE}_SECRET_QUERY_FAILED`);
      const body = await response.json() as { results: unknown[] };
      invariant(body.results.length === 0, `${SUITE}_PROHIBITED_FIELD_MATCHED_${query}`);
    }
    const exact = await (await search(cookies.superA, { query: credentials.exactReference })).json() as { results: Array<Record<string, unknown>> };
    invariant(exact.results[0]?.source === "STUDENTS" && exact.results[0]?.score === 1000, `${SUITE}_EXACT_REFERENCE_RANKING_FAILED`);
    const firstArjun = await (await search(cookies.superA, { query: "Arjun" })).json() as { results: Array<Record<string, unknown>> };
    const secondArjun = await (await search(cookies.superA, { query: "Arjun" })).json() as { results: Array<Record<string, unknown>> };
    invariant(JSON.stringify(firstArjun.results) === JSON.stringify(secondArjun.results), `${SUITE}_ORDER_NOT_DETERMINISTIC`);
    const allowed = new Set(["source", "type", "title", "subtitle", "snippet", "status", "href", "score", "timestamp"]);
    invariant(firstArjun.results.every((row) => Object.keys(row).every((key) => allowed.has(key))), `${SUITE}_RAW_RESULT_FIELD_EXPOSED`);
    const unavailable = await (await search(cookies.superA, { query: "Arjun", sources: ["ATTENDANCE", "RECENT_ACTIVITY"] })).json() as { sources: Array<{ state: string }> };
    invariant(unavailable.sources.every((source) => source.state === "UNAVAILABLE"), `${SUITE}_UNAVAILABLE_STATE_INVALID`);
    const burstStarted = performance.now();
    const burst = await Promise.all(Array.from({ length: 10 }, () => search(cookies.superA, { query: "Arjun", limit: 50 })));
    const burstMs = performance.now() - burstStarted;
    invariant(burst.every((response) => response.status === 200) && burstMs <= 3_000, `${SUITE}_BOUNDED_BURST_FAILED_${burstMs.toFixed(2)}`);
    const after = await businessSnapshot(client);
    invariant(before === after, `${SUITE}_SEARCH_MUTATED_BUSINESS_DATA`);
    const auditNeedle = credentials.ownerQuery;
    const [userAudit, securityAudit, workAudit] = await Promise.all([
      client.userAudit.count({ where: { detailsJson: { contains: auditNeedle } } }),
      client.authSecurityEvent.count({ where: { detailsJson: { contains: auditNeedle } } }),
      client.superAdminWorkAudit.count({ where: { OR: [{ entityPublicKey: { contains: auditNeedle } }, { eventType: { contains: auditNeedle } }] } })
    ]);
    invariant(userAudit + securityAudit + workAudit === 0, `${SUITE}_RAW_QUERY_AUDITED`);
    console.log(JSON.stringify({ result: `${SUITE}_RUNTIME_VERIFIED`, deniedActors: Object.values(credentials.actors).filter((actor) => actor.role !== "SUPER_ADMIN").length, multiRoleContexts: true, validationCases: invalidBodies.length, safeQueries: 11, ownerIsolation: true, secretFieldQueries: credentials.secretQueries.length, deterministicRanking: true, noBusinessWrites: true, burstRequests: burst.length, burstMs: Number(burstMs.toFixed(2)) }));
  } finally {
    await client.$disconnect();
  }
}

const command = process.argv[2];
const work = command === "setup" ? setup() : command === "runtime" ? runtime() : Promise.reject(new Error(`${SUITE}_COMMAND_REQUIRED`));
work.catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
