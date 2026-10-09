import { execFileSync } from "node:child_process";
import { assertSyntheticPostgresQa } from "../scripts/postgres/synthetic-qa";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import React from "react";
import { NextRequest } from "next/server";
import type { AuthUser } from "../lib/auth";
import { createPersistedSession, revokeSessions } from "../lib/auth-sessions";
import { createAdmissionCycle } from "../lib/admissions";
import { defaultPermissionMatrix } from "../lib/role-permissions";
import { createContact, createDiaryEntry, createTask } from "../lib/super-admin-work";
import { resetSecurityRateLimitStoresForTests } from "../lib/security-resilience";
import { createUniversalSearchAdapters, UNIVERSAL_SEARCH_SOURCES } from "../lib/universal-search";
import type { UniversalSearchResponse } from "../lib/universal-search-contract";
import { UniversalSearchWorkspace } from "../components/universal-search-workspace";
import { POST } from "../app/api/super-admin/search/route";

// ISOLATED_SERVICE_OR_ROUTE: the real Search route, persisted session/IAM
// decisions and Prisma readers run on a fresh provider-specific migrated fixture. Only
// Next's cookie transport and Prisma singleton routing are doubled. No server,
// login, real data or operational acceptance is claimed.
const harness = vi.hoisted(() => ({ db: null as PrismaClient | null, cookie: undefined as string | undefined }));
vi.mock("../lib/prisma", () => ({ prisma: new Proxy({}, { get: (_target, key) => {
  const value = Reflect.get(harness.db!, key);
  return typeof value === "function" ? value.bind(harness.db) : value;
} }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => harness.cookie ? { value: harness.cookie } : undefined }) }));

// COMPONENT_CONTRACT: existing permitted React hook-driver harness, with the
// real component/event handler and a labelled fetch transport double. It does
// not establish browser/device rendering or authenticated HTTP acceptance.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], changes: [] as Array<{ index: number; value: unknown }>, index: 0 }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: () => {
    const index = hooks.index++;
    return [hooks.values[index], (value: unknown) => hooks.changes.push({ index, value })];
  }, useEffect: () => {}, useMemo: (fn: () => unknown) => fn(), useRef: (value: unknown) => ({ current: value }) };
});
vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: React.ReactNode }) => React.createElement("a", props, children) }));

const root = mkdtempSync(path.join(tmpdir(), "nalanda-ready-gaps-search-1a-"));
const rootIdentity = lstatSync(root);
const postgres = process.env.DATABASE_PROVIDER === "postgresql";
const postgresUrl = process.env.DATABASE_URL;
let ownedSchema: string;
const template = path.join(root, "empty-migrated.db");
let db: PrismaClient;
let actor: AuthUser;
let sessionId: string;
let casePath: string;
const year = "2026-27";
const sourceClass = "SyntheticClassSeven";

beforeAll(async () => {
  if (postgres) { expect(process.env.CI).toBe("true"); assertSyntheticPostgresQa(); return; }
  // Existing SQLite migration harness, starting from an empty in-memory DB.
  // No operational DB is opened, copied, seeded or used as fallback.
  const sql = new DatabaseSync(":memory:");
  try {
    for (const migration of readdirSync("prisma/migrations", { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
      sql.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8"));
    }
    expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    await backup(sql, template);
  } finally { sql.close(); }
});

async function identity(role: AuthUser["role"] = "SUPER_ADMIN") {
  const user = await db.user.create({ data: { username: `synthetic-search-${randomUUID()}`, name: `SYNTHETIC ${role}`, role, passwordHash: "SYNTHETIC-NOT-A-CREDENTIAL", isActive: true, lifecycleStatus: "ACTIVE" } });
  const assignment = await db.userRoleAssignment.create({ data: { userId: user.id, role, validFrom: new Date(Date.now() - 60_000), activeKey: `${user.id}:${role}`, reason: "SYNTHETIC Search authority fixture" } });
  const session = await createPersistedSession(db, user, new Headers());
  expect((await db.authSession.findUniqueOrThrow({ where: { id: session.sessionId } })).activeRoleAssignmentId).toBe(assignment.id);
  return { session, actor: { id: user.id, name: user.name, username: user.username, email: user.email, designation: user.designation, role, roleAssignmentId: assignment.id, authorizationVersion: user.authorizationVersion, mustChangePassword: false, guardianId: null } satisfies AuthUser };
}

beforeEach(async () => {
  casePath = path.join(root, `synthetic-${randomUUID()}.db`);
  let url = `file:${casePath.replaceAll("\\", "/")}`;
  if (postgres) {
    ownedSchema = `nps_search_${randomUUID().replaceAll("-", "")}`;
    const target = new URL(postgresUrl!); target.searchParams.set("schema", ownedSchema); url = target.toString();
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "pipe", windowsHide: true, timeout: 60_000 });
  } else copyFileSync(template, casePath);
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("DATABASE_PROVIDER", postgres ? "postgresql" : "sqlite");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:47839");
  vi.stubEnv("AUTH_SECRET", "SYNTHETIC-SEARCH-ONLY-SECRET-NEVER-DEPLOY-000000");
  db = new PrismaClient({ datasourceUrl: url }); harness.db = db;
  await db.rolePermission.createMany({ data: Object.entries(defaultPermissionMatrix()).flatMap(([role, entries]) => Object.entries(entries).map(([permission, enabled]) => ({ role, permission, enabled }))) });
  const who = await identity(); actor = who.actor; sessionId = who.session.sessionId; harness.cookie = who.session.cookieValue;
  resetSecurityRateLimitStoresForTests();
});
afterEach(async () => {
  if (postgres && db) {
    if (!/^nps_search_[a-f0-9]{32}$/.test(ownedSchema)) throw new Error("OWNED_SCHEMA_REQUIRED");
    await db.$executeRawUnsafe(`DROP SCHEMA "${ownedSchema}" CASCADE`);
  }
  if (db) await db.$disconnect(); harness.db = null; harness.cookie = undefined;
  hooks.values = []; hooks.changes = []; hooks.index = 0;
  resetSecurityRateLimitStoresForTests(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
afterAll(() => {
  const current = lstatSync(root);
  expect(current.isSymbolicLink()).toBe(false);
  expect(current.ino).toBe(rootIdentity.ino); expect(current.dev).toBe(rootIdentity.dev);
  expect(path.dirname(path.resolve(root))).toBe(path.resolve(tmpdir()));
  expect(path.basename(root).startsWith("nalanda-ready-gaps-search-1a-")).toBe(true);
  rmSync(root, { recursive: true }); expect(existsSync(root)).toBe(false);
});

async function application(academicYear = year, desiredClass = sourceClass) {
  const cycle = await createAdmissionCycle(db, { cycleCode: `SYN-${randomUUID().slice(0, 8)}`, name: "SYNTHETIC Search cycle", academicYear, status: "OPEN", enabledClasses: [desiredClass], documentTypes: [], declarations: [], admissionNumberPrefix: "SYN" }, actor);
  const persisted = await db.admissionCycle.findUniqueOrThrow({ where: { publicKey: cycle.publicKey } });
  // Fixture construction only. The operation under test is the production
  // read-only Search route; no invitation, public form or real record is used.
  return db.admissionApplication.create({ data: {
    applicationNumber: `SYN-APPLICATION-${randomUUID()}`, cycleId: persisted.id, status: "APPLICATION_IN_PROGRESS", retentionReviewAt: new Date("2028-01-01T00:00:00Z"), createdByUserId: actor.id,
    invitationTokenHash: `SYNTHETIC-EXCLUDED-INVITATION-SECRET-${randomUUID()}`,
    child: { create: { fullName: "SYNTHETIC Rowan", desiredAcademicYear: academicYear, desiredClass, previousSchool: "SYNTHETIC-EXCLUDED-PRIVATE-SCHOOL" } },
    guardians: { create: { displayName: "SYNTHETIC Mira", relationshipToChild: "Parent", contactMethod: "PHONE", contactValue: "SYNTHETIC-EXCLUDED-PRIVATE-CONTACT", contactHash: "SYNTHETIC-CONTACT-HASH", isPrimary: true } }
  }, include: { child: true } });
}
async function request(body: unknown, cookie: string | null | undefined = harness.cookie) {
  harness.cookie = cookie ?? undefined;
  const response = await POST(new NextRequest("http://127.0.0.1:47839/api/super-admin/search", { method: "POST", headers: { origin: "http://127.0.0.1:47839", "content-type": "application/json" }, body: JSON.stringify(body) }));
  expect(response).toBeTruthy();
  return { response: response!, body: await response!.json() as UniversalSearchResponse & { error?: string } };
}
const search = (query: string, sources = ["ADMISSIONS"]) => request({ query, sources });

describe("NPS-READY-GAPS-IMPLEMENTATION-1A requirement004 approved connections", () => {
  it("maps every enabled existing source to a reader and retains both explicitly unavailable sources", () => {
    const adapters = createUniversalSearchAdapters(db, actor.id);
    expect(adapters.map(adapter => adapter.source).sort()).toEqual(UNIVERSAL_SEARCH_SOURCES.filter(source => source.available).map(source => source.id).sort());
    expect(UNIVERSAL_SEARCH_SOURCES.filter(source => !source.available).map(source => source.id)).toEqual(["ATTENDANCE", "RECENT_ACTIVITY"]);
    expect(new Set(adapters.map(adapter => adapter.source)).size).toBe(adapters.length);
  });
  it("connects approved application class-only queries to actual persisted applications", async () => {
    const row = await application();
    const { response, body } = await search(sourceClass);
    expect(response.status).toBe(200); expect(body.total).toBe(1);
    expect(body.results).toEqual([expect.objectContaining({ source: "ADMISSIONS", type: "Admission application", title: "SYNTHETIC Rowan", subtitle: expect.stringContaining(row.applicationNumber), href: "/admission-crm" })]);
    expect(body.sources[0]).toMatchObject({ source: "ADMISSIONS", state: "OK", count: 1 });
    for (const query of [sourceClass.toLowerCase(), sourceClass.toUpperCase()]) {
      const variant = await search(query);
      expect(variant.response.status).toBe(200);
      expect(variant.body.results).toEqual(body.results);
      expect(variant.body.sources[0]).toMatchObject({ source: "ADMISSIONS", state: "OK", count: 1 });
    }
  });
  it("connects approved application academic-year-only queries without returning another year", async () => {
    const row = await application(); await application("2027-28", "SyntheticClassEight");
    const { response, body } = await search(year);
    expect(response.status).toBe(200); expect(body.total).toBe(1);
    expect(body.results[0].subtitle).toContain(row.applicationNumber);
    expect(JSON.stringify(body.results)).not.toContain("2027-28");
  });
  it("requires every token across approved class/year/name fields", async () => {
    await application();
    expect((await search(`Rowan ${sourceClass} ${year}`)).body.total).toBe(1);
    expect((await search(`Rowan SyntheticClassEight ${year}`)).body.total).toBe(0);
  });
  it("rereads changed academic-year and class scope without retaining earlier snippets or counts", async () => {
    const row = await application(); expect((await search(year)).body.total).toBe(1);
    // Explicit synthetic source-drift controls, not a substitute for a school
    // year-change workflow. Search must observe the actual owning source.
    await db.admissionCycle.update({ where: { id: row.cycleId }, data: { academicYear: "2028-29" } });
    await db.applicantChild.update({ where: { applicationId: row.id }, data: { desiredClass: "SyntheticChangedClass" } });
    expect((await search(year)).body.total).toBe(0); expect((await search(sourceClass)).body.total).toBe(0);
    const current = await search("SyntheticChangedClass 2028-29");
    expect(current.body.total).toBe(1); expect(current.body.results[0].subtitle).toContain("2028-29");
    expect(JSON.stringify(current.body)).not.toContain(sourceClass);
  });
  it("observes source text changes, archive and deletion rather than cached matches", async () => {
    const row = await application(); expect((await search("Rowan")).body.total).toBe(1);
    await db.applicantChild.update({ where: { applicationId: row.id }, data: { fullName: "SYNTHETIC Linden" } });
    expect((await search("Rowan")).body.total).toBe(0); expect((await search("Linden")).body.total).toBe(1);
    await db.admissionApplication.update({ where: { id: row.id }, data: { archivedAt: new Date() } });
    expect((await search(sourceClass)).body.total).toBe(0);
    await db.$transaction([
      db.applicantChild.delete({ where: { applicationId: row.id } }),
      db.prospectiveGuardian.deleteMany({ where: { applicationId: row.id } }),
      db.admissionApplication.delete({ where: { id: row.id } })
    ]);
    expect((await search("Linden")).body.total).toBe(0);
  });
  it("preserves owner filtering in real diary/task/contact readers, counts and snippets", async () => {
    const other = await identity();
    for (const [who, marker] of [[actor, "SyntheticOwnerAlpha"], [other.actor, "SyntheticOwnerBravo"]] as const) {
      await createDiaryEntry(db, who, { title: marker, entryDate: "2026-10-08", category: "PERSONAL_WORK", notes: `${marker} PRIVATE diary` });
      await createTask(db, who, { title: marker, dueDate: "2026-10-08", description: `${marker} PRIVATE task` });
      await createContact(db, who, { name: marker, category: "OTHER", email: `${marker}@example.test` });
    }
    const sources = ["DIARY", "TASKS", "CONTACTS"];
    const own = await search("SyntheticOwnerAlpha", sources); expect(own.body.total).toBe(3);
    const mismatch = await search("SyntheticOwnerBravo", sources);
    expect(mismatch.body.total).toBe(0); expect(mismatch.body.results).toEqual([]);
    expect(mismatch.body.sources.every(source => source.state === "EMPTY" && source.count === 0)).toBe(true);
    expect(JSON.stringify(mismatch.body.results)).not.toContain("PRIVATE");
    const theirs = await request({ query: "SyntheticOwnerBravo", sources }, other.session.cookieValue);
    expect(theirs.body.total).toBe(3); expect(JSON.stringify(theirs.body.results)).not.toContain("SyntheticOwnerAlpha");
  });
  it("denies missing session and exact Director entry before returning any source information", async () => {
    await application();
    for (const cookie of [null, (await identity("DIRECTOR")).session.cookieValue]) {
      const denied = await request({ query: sourceClass, sources: ["ADMISSIONS"] }, cookie);
      expect([401, 403]).toContain(denied.response.status); expect(denied.body).not.toHaveProperty("total");
      expect(denied.body).not.toHaveProperty("results"); expect(denied.body).not.toHaveProperty("sources");
    }
  });
  it("denies persisted session revocation after a previously successful request", async () => {
    await application(); expect((await search(sourceClass)).body.total).toBe(1);
    await revokeSessions(db, { userId: actor.id, sessionId, reason: "SYNTHETIC revoked Search fixture" });
    const denied = await search(sourceClass); expect(denied.response.status).toBe(401); expect(denied.body).not.toHaveProperty("results");
  });
  it("denies stale authorization and changed active role assignment", async () => {
    await application(); expect((await search(sourceClass)).body.total).toBe(1);
    await db.user.update({ where: { id: actor.id }, data: { authorizationVersion: { increment: 1 } } });
    expect((await search(sourceClass)).response.status).toBe(401);
    const refreshed = await createPersistedSession(db, await db.user.findUniqueOrThrow({ where: { id: actor.id } }), new Headers());
    harness.cookie = refreshed.cookieValue;
    // Preserve the real last-Super-Admin guard while exercising this session's
    // stale assignment; a second invented active owner remains available.
    await identity();
    await db.userRoleAssignment.update({ where: { id: actor.roleAssignmentId }, data: { status: "REVOKED", endedAt: new Date(), activeKey: null } });
    const denied = await search(sourceClass); expect(denied.response.status).toBe(401); expect(denied.body).not.toHaveProperty("results");
  });
  it("rechecks actual VIEW_DASHBOARD denial before retrieval", async () => {
    await application(); expect((await search(sourceClass)).body.total).toBe(1);
    await db.userPermissionOverride.create({ data: { userId: actor.id, permission: "VIEW_DASHBOARD", effect: "DENY", reason: "SYNTHETIC permission removal", createdByUserId: actor.id, validFrom: new Date(Date.now() - 60_000) } });
    const denied = await search(sourceClass); expect(denied.response.status).toBe(403); expect(denied.body).not.toHaveProperty("total");
  });
  it("rejects malformed queries/filters and client-selected owner or academic-year authority", async () => {
    for (const body of [{ query: "%_" }, { query: sourceClass, sources: ["UNKNOWN"] }, { query: sourceClass, sources: ["ADMISSIONS", "ADMISSIONS"] }, { query: sourceClass, ownerUserId: actor.id }, { query: sourceClass, academicYear: year }]) {
      const invalid = await request(body); expect(invalid.response.status).toBe(400); expect(invalid.body).not.toHaveProperty("results");
    }
  });
  it("keeps approved navigation projection private and never matches hidden application content", async () => {
    const row = await application();
    const found = await search(sourceClass);
    expect(found.response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
    expect(found.response.headers.get("vary")).toBe("Cookie"); expect(found.response.headers.get("referrer-policy")).toBe("no-referrer");
    for (const excluded of [row.id, row.cycleId, "SYNTHETIC-EXCLUDED-INVITATION-SECRET", "SYNTHETIC-EXCLUDED-PRIVATE-SCHOOL", "SYNTHETIC-EXCLUDED-PRIVATE-CONTACT"]) {
      expect(JSON.stringify(found.body)).not.toContain(excluded);
    }
    for (const query of ["EXCLUDED-INVITATION-SECRET", "EXCLUDED-PRIVATE-SCHOOL", "EXCLUDED-PRIVATE-CONTACT"]) {
      const hidden = await search(query); expect(hidden.body.total).toBe(0); expect(hidden.body.sources[0].count).toBe(0);
    }
  });
  it("COMPONENT_CONTRACT: the real Search component clears prior private results on session denial", async () => {
    vi.stubGlobal("React", React);
    const sources = UNIVERSAL_SEARCH_SOURCES.filter(source => source.id === "ADMISSIONS");
    const stale = { query: sourceClass, generatedAt: new Date().toISOString(), readOnly: true, total: 1, truncated: false, limits: {}, sources: [{ source: "ADMISSIONS", state: "OK", count: 1 }], results: [{ source: "ADMISSIONS", title: "SYNTHETIC-STALE-PRIVATE-RESULT" }] };
    hooks.values = [sourceClass, ["ADMISSIONS"], stale, false, ""];
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "Authentication required" }), { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    const tree = UniversalSearchWorkspace({ sources });
    function elements(value: unknown): React.ReactElement[] {
      if (!React.isValidElement<{ children?: React.ReactNode }>(value)) return [];
      return [value, ...React.Children.toArray(value.props.children).flatMap(elements)];
    }
    const form = elements(tree).find(element => element.type === "form") as React.ReactElement<{ onSubmit(event: { preventDefault(): void }): Promise<void> }>;
    expect(form).toBeTruthy(); await form.props.onSubmit({ preventDefault() {} });
    expect(fetcher).toHaveBeenCalledWith("/api/super-admin/search", expect.objectContaining({ method: "POST", cache: "no-store", body: JSON.stringify({ query: sourceClass, sources: ["ADMISSIONS"], limit: 50 }) }));
    expect(hooks.changes).toContainEqual({ index: 2, value: null });
    expect(hooks.changes).toContainEqual({ index: 4, value: "Authentication required" });
    const cleared = hooks.changes.findIndex(change => change.index === 2 && change.value === null);
    const released = hooks.changes.findIndex(change => change.index === 3 && change.value === false);
    expect(released).toBeGreaterThan(cleared);
  });
});
