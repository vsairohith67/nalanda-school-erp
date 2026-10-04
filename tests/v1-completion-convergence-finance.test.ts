import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync, backup } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { defaultPermissionMatrix } from "@/lib/role-permissions";
import { createPersistedSession } from "@/lib/auth-sessions";
import { beginTotpEnrollment, confirmTotpEnrollment } from "@/lib/real-user-access/mfa-service";
import { generateTotpForSyntheticQa } from "@/lib/real-user-access/totp";
import { createStepUpChallenge, completeStepUpChallenge } from "@/lib/real-user-access/step-up";
import { boundAuthEnvironment } from "@/lib/real-user-access/login-mfa";
import { authorizePriorYear, mutatePriorYear, priorYearBalance } from "@/lib/prior-year-concessions";
import type { PriorYearPolicy } from "@/lib/prior-year-concession-policy";
import { miscReceiptInclude, serializeMiscReceipt } from "@/lib/misc-income";
import { POST as sale, GET as receipts } from "@/app/api/misc-income/route";

// ISOLATED_SERVICE_OR_ROUTE. Only dependency routing and the framework cookie
// source are doubled. PostgreSQL uses the existing test-only QA feature adapter
// below because the legacy URL flag adapter is SQLite-only. Real IAM/session
// or runtime admission is never doubled. Real sessions, MFA, one-use step-up, transactions,
// sale API/service and concession service execute against an owned database.
// Four distinct Super Admin fixture actors exercise the existing separation
// contract; this does not establish Accountant concession powers or live policy.
const harness = vi.hoisted(() => ({ db: null as PrismaClient | null, cookie: undefined as string | undefined }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: (_target, key) => {
  if (!harness.db) throw new Error("OWNED_SYNTHETIC_DATABASE_REQUIRED");
  const value = Reflect.get(harness.db, key);
  return typeof value === "function" ? value.bind(harness.db) : value;
} }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: harness.cookie }) }) }));
// Same finite provider fixture seam as student-items-prior-year-concessions.
// It is available only inside genuine ephemeral PostgreSQL CI; no local CI
// spoof, production activation, profile/authority grant or runtime claim.
vi.mock("@/lib/release-feature-flag-runtime", async importOriginal => {
  const actual = await importOriginal<typeof import("@/lib/release-feature-flag-runtime")>();
  const providerQa = () => process.env.DATABASE_PROVIDER === "postgresql" && process.env.CI === "true"
    && process.env.POSTGRES_READINESS_SYNTHETIC_QA === "1";
  const enabled = (feature: { key: string }) => (process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED ?? "").split(",").includes(feature.key);
  return { ...actual,
    isOperationalReleaseFeatureEnabled: (feature: Parameters<typeof actual.isOperationalReleaseFeatureEnabled>[0]) =>
      providerQa() ? enabled(feature) : actual.isOperationalReleaseFeatureEnabled(feature),
    assertOperationalReleaseFeature: (feature: Parameters<typeof actual.assertOperationalReleaseFeature>[0]) => {
      if (!providerQa()) return actual.assertOperationalReleaseFeature(feature);
      if (!enabled(feature)) throw new actual.ReleaseFeatureUnavailableError();
    }
  };
});

const policy: PriorYearPolicy = {
  contract: "NALANDA_PRIOR_YEAR_CONCESSIONS_1A", version: 1,
  academicYears: [2025, 2026, 2027].map((year, sequence) => ({ id: `${year}-${String(year + 1).slice(-2)}`, sequence,
    startsOn: `${year}-04-01`, endsOn: `${year + 1}-03-31` })),
  incomeBands: [], incomeRetentionDays: null, scholarshipsEnabled: false
};
let db: PrismaClient;
let root: string | undefined;
let identity: ReturnType<typeof lstatSync> | undefined;
const schema = `v1_finance_${randomUUID().replaceAll("-", "")}`;
const postgres = process.env.DATABASE_PROVIDER === "postgresql";
beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "nalanda-v1-finance-")); identity = lstatSync(root);
  let url = `file:${path.join(root, "synthetic.db").replaceAll("\\", "/")}`;
  if (postgres) {
    if (process.env.CI !== "true" || process.env.POSTGRES_READINESS_SYNTHETIC_QA !== "1" || !process.env.DATABASE_URL)
      throw new Error("EXPLICIT_EPHEMERAL_POSTGRES_REQUIRED");
    const target = new URL(process.env.DATABASE_URL); target.searchParams.set("schema", schema); url = target.toString();
    // Allocate cleanup ownership before migration so a partial migration cannot
    // strand this uniquely named synthetic schema after a setup failure.
    db = new PrismaClient({ datasourceUrl: url });
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"],
      { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "pipe", timeout: 60_000 });
  } else {
    const sql = new DatabaseSync(":memory:");
    try {
      for (const migration of readdirSync("prisma/migrations", { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort())
        sql.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8"));
      expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      await backup(sql, path.join(root, "synthetic.db"));
    } finally { sql.close(); }
  }
  vi.stubEnv("DATABASE_URL", url); vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AUTH_SECRET", randomBytes(48).toString("base64url"));
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000"); vi.stubEnv("AUTH_BOUND_ENVIRONMENT", "SYNTHETIC_SERVICE");
  vi.stubEnv("AUTH_MFA_KEYRING_JSON", JSON.stringify({ active: "QA", keys: { QA: randomBytes(32).toString("base64") } }));
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_MODE", "SYNTHETIC_COPY_ONLY");
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED", "student-linked-items-1a,prior-year-concessions-1a");
  if (!postgres) db = new PrismaClient({ datasourceUrl: url }); harness.db = db;
  await db.rolePermission.createMany({ data: Object.entries(defaultPermissionMatrix()).flatMap(([role, entries]) =>
    Object.entries(entries).map(([permission, enabled]) => ({ role, permission, enabled }))) });
  await db.schoolSettings.create({ data: { id: "school", schoolName: "Invented School", addressLine1: "Synthetic",
    city: "Synthetic", phone: "NO-CONTACT", academicYear: "2026-27" } });
  // Normal APIs require an established school owner. This persisted fixture
  // satisfies that prerequisite without doubling the first-run gate or giving
  // the Accountant additional authority.
  await db.user.create({ data: { username: `synthetic-owner-${randomUUID()}`, name: "Invented school owner", role: "SUPER_ADMIN",
    passwordHash: "UNUSABLE_SYNTHETIC_NO_LOGIN", mustChangePassword: false, isActive: true, lifecycleStatus: "ACTIVE" } });
}, 60_000);
afterAll(async () => {
  try {
    if (db) { if (postgres) await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); await db.$disconnect(); }
    if (root && identity) {
      const current = lstatSync(root);
      expect(current.isSymbolicLink()).toBe(false); expect(current.dev).toBe(identity.dev); expect(current.ino).toBe(identity.ino);
      expect(path.dirname(root)).toBe(path.resolve(tmpdir()));
      rmSync(root, { recursive: true }); expect(existsSync(root)).toBe(false);
    }
  } finally { harness.db = null; harness.cookie = undefined; vi.unstubAllEnvs(); }
});
async function actor(role: "SUPER_ADMIN" | "ACCOUNTANT" | "TEACHER" = "SUPER_ADMIN") {
  const user = await db.user.create({ data: { username: `synthetic-${randomUUID()}`, name: "Invented finance actor", role,
    passwordHash: "UNUSABLE_SYNTHETIC_NO_LOGIN", mustChangePassword: false, isActive: true, lifecycleStatus: "ACTIVE" } });
  const assignment = await db.userRoleAssignment.create({ data: { userId: user.id, role, validFrom: new Date(Date.now() - 60_000),
    reason: "SYNTHETIC already-effective fixture authority", activeKey: `${user.id}:${role}` } });
  const session = await createPersistedSession(db, user, new Headers());
  const enrollment = await beginTotpEnrollment(db, { userId: user.id, displayName: "Invented factor", accountLabel: "synthetic@example.invalid" });
  const factor = await db.mfaAuthenticator.findUniqueOrThrow({ where: { publicKey: enrollment.factorHandle } });
  await confirmTotpEnrollment(db, { userId: user.id, factorHandle: enrollment.factorHandle,
    token: generateTotpForSyntheticQa({ userId: user.id, authenticatorId: factor.id, secretEnvelope: factor.secretEnvelope! }), environment: boundAuthEnvironment() });
  return { user, assignment, session, factor, context: { userId: user.id, sessionId: session.sessionId, roleAssignmentId: assignment.id } };
}
type Actor = Awaited<ReturnType<typeof actor>>;
async function grant(who: Actor, action: string) {
  const input = { userId: who.user.id, sessionId: who.session.sessionId, action: `PRIOR_YEAR_${action}`, environment: boundAuthEnvironment() };
  const challenge = await createStepUpChallenge(db, input);
  const factor = await db.mfaAuthenticator.findUniqueOrThrow({ where: { id: who.factor.id } });
  // Existing synthetic TOTP clock seam; no host clock or grant-expiry change.
  const timestamp = Math.max(Date.now(), (factor.totpLastUsedStep! + 1) * 30_000);
  return (await completeStepUpChallenge(db, { ...input, challengeToken: challenge.challengeToken, factor: "TOTP", timestamp,
    response: generateTotpForSyntheticQa({ userId: who.user.id, authenticatorId: factor.id, secretEnvelope: factor.secretEnvelope!, timestamp }) })).stepUpToken;
}
const request = (action: string, fields: Record<string, unknown> = {}) => ({ action, requestKey: randomUUID(), reason: "Invented independently reviewed finance evidence", ...fields });
const mutate = (who: Actor, input: unknown) => mutatePriorYear(db, who.context, input, { policy });
async function student() {
  return db.student.create({ data: { admissionNo: `SYNTHETIC-${randomUUID()}`, studentName: "Invented same display name", fatherName: "Invented Guardian",
    className: "VI", phone1: "SYNTHETIC-NO-CONTACT", academicYear: "2026-27", discountPercent: 12,
    academicYearEnrollments: { create: [{ academicYear: "2025-26", className: "V" }, { academicYear: "2026-27", className: "VI" }, { academicYear: "2027-28", className: "VII" }] } } });
}
describe("V1 J2/J3 same-student normal finance boundaries", () => {
  it("persists an Accountant sale through real session/IAM and reads its frozen rate after edits; anonymous and revoked sessions have no effect", async () => {
    const who = await actor("ACCOUNTANT"), row = await student(), control = await student();
    const item = await db.miscIncomeItem.create({ data: { itemCode: "BELT", name: "Invented Belt", category: "UNIFORM_ACCESSORY", studentLinkPolicy: "OPTIONAL",
      rates: { create: { academicYear: "2026-27", amount: "10.25" } } }, include: { rates: true } });
    const body = { receiptDate: "2026-06-01", academicYear: "2026-27", studentId: row.id, paymentMethod: "CASH", lines: [{ itemId: item.id, quantity: 3 }] };
    const post = (input: unknown) => sale(new NextRequest("http://127.0.0.1:3000/api/misc-income", { method: "POST", body: JSON.stringify(input) }));
    harness.cookie = who.session.cookieValue;
    expect((await post({ ...body, studentId: null })).status).toBe(400);
    expect(await db.miscIncomeReceipt.count()).toBe(0);
    const response = await post(body); expect(response.status).toBe(201);
    const receipt = (await response.json()).receipt;
    expect(receipt).toMatchObject({ netAmount: "30.75", historicalLinkage: "FROZEN", academicYear: "2026-27",
      student: { admissionNo: row.admissionNo, studentName: row.studentName, className: "VI" }, lines: [{ quantity: 3, unitAmount: "10.25", lineTotal: "30.75" }] });
    await db.miscIncomeRate.update({ where: { id: item.rates[0].id }, data: { amount: "12.50" } });
    const readback = await receipts(new NextRequest(`http://127.0.0.1:3000/api/misc-income?studentId=${row.id}`));
    expect((await readback.json()).receipts).toEqual([expect.objectContaining({ id: receipt.id, netAmount: "30.75" })]);
    expect(await db.student.findUnique({ where: { id: control.id } })).toEqual(control);
    await db.authSession.update({ where: { id: who.session.sessionId }, data: { revokedAt: new Date() } });
    expect((await post(body)).status).toBe(401); expect(await db.miscIncomeReceipt.count()).toBe(1);
    harness.cookie = undefined; expect((await post(body)).status).toBe(401);
    expect(await db.miscIncomeReceipt.count()).toBe(1);
  });
  it("reauthenticates independent concession actors, applies/replays/reverses exact relief and preserves the same student's sale plus current/future fees", async () => {
    const [prep, review, approve, apply] = await Promise.all([actor(), actor(), actor(), actor()]);
    const row = await student(), control = await student();
    const enrollment = await db.academicYearEnrollment.findUniqueOrThrow({ where: { studentId_academicYear: { studentId: row.id, academicYear: "2025-26" } } });
    await db.feeStructure.createMany({ data: ["2026-27", "2027-28"].map(academicYear => ({ academicYear, className: "VI", termAmount: 1000,
      term1Month: "June", term2Month: "September", term3Month: "December", term4Month: "March" })) });
    const feeBefore = await db.feeStructure.findMany({ orderBy: { academicYear: "asc" } });
    const studentsBefore = await db.student.findMany({ where: { id: { in: [row.id, control.id] } }, orderBy: { id: "asc" } });
    const item = await db.miscIncomeItem.create({ data: { itemCode: "TIE", name: "Invented Tie", category: "UNIFORM_ACCESSORY", studentLinkPolicy: "REQUIRED",
      rates: { create: { academicYear: "2026-27", amount: "12.50" } } } });
    harness.cookie = prep.session.cookieValue;
    const sold = await sale(new NextRequest("http://127.0.0.1:3000/api/misc-income", { method: "POST", body: JSON.stringify({ receiptDate: "2026-06-01", academicYear: "2026-27", studentId: row.id, paymentMethod: "CASH", lines: [{ itemId: item.id, quantity: 2 }] }) }));
    expect(sold.status).toBe(201); const receiptId = (await sold.json()).receipt.id;
    const saleBefore = serializeMiscReceipt(await db.miscIncomeReceipt.findUniqueOrThrow({ where: { id: receiptId }, include: miscReceiptInclude }));
    const liability = await mutate(prep, request("PREPARE_LIABILITY", { studentId: row.id, operatingYear: "2026-27", sourceYear: "2025-26", sourceEnrollmentId: enrollment.id,
      identityVerified: true, openingAmount: "1000.00", existingCredits: "50.00", sourceReferences: ["INVENTED-TERM-1"], provenance: "Invented verified previous-year liability" }));
    await mutate(review, request("VERIFY", { liabilityId: liability.liabilityId, expectedVersion: 1, identityVerified: true, balanceVerified: true, paymentIds: [], stepUpToken: await grant(review, "VERIFY") }));
    const prepared = await mutate(prep, request("PREPARE", { liabilityId: liability.liabilityId, kind: "SCHOOL_WAIVER", requestedAmount: "300.00", applicantReference: "INVENTED", validFrom: "2020-01-01", validTo: "2090-01-01" }));
    const caseId = prepared.caseId!;
    await mutate(prep, request("SUBMIT", { caseId, expectedVersion: 1 }));
    await mutate(review, request("REVIEW", { caseId, expectedVersion: 2 }));
    const balance = await priorYearBalance(db, liability.liabilityId, policy);
    const approval = request("APPROVE", { caseId, expectedVersion: 3, approvedAmount: "300.00", balanceHash: balance.hash, balanceVersion: balance.liability.version });
    await expect(mutate(approve, approval)).rejects.toThrow("PRIOR_YEAR_STEP_UP_REQUIRED");
    const wrongActorToken = await grant(review, "APPROVE");
    await expect(mutate(approve, { ...approval, stepUpToken: wrongActorToken })).rejects.toThrow("PRIOR_YEAR_STEP_UP_REQUIRED");
    expect((await db.stepUpGrant.findUniqueOrThrow({ where: { id: wrongActorToken.split(".")[0] } })).usedAt).toBeNull();
    await mutate(approve, { ...approval, stepUpToken: await grant(approve, "APPROVE") });
    const applyToken = await grant(apply, "APPLY");
    const input = request("APPLY", { caseId, expectedVersion: 4, stepUpToken: applyToken });
    const applied = await mutate(apply, input); expect(await mutate(apply, input)).toEqual(applied);
    expect((await priorYearBalance(db, liability.liabilityId, policy)).totals.remaining.toFixed(2)).toBe("650.00");
    await mutate(approve, request("REVERSE", { caseId, expectedVersion: 5, stepUpToken: await grant(approve, "REVERSE") }));
    expect((await priorYearBalance(db, liability.liabilityId, policy)).totals.remaining.toFixed(2)).toBe("950.00");
    const events = await db.priorYearConcessionEvent.findMany({ where: { caseId } });
    expect(events.filter(e => e.eventType === "RELIEF_APPLIED")).toEqual([expect.objectContaining({ id: applied.eventId, actorId: apply.user.id })]);
    expect(events.find(e => e.eventType === "RELIEF_REVERSED")).toMatchObject({ reversesEventId: applied.eventId, actorId: approve.user.id });
    expect(await db.student.findMany({ where: { id: { in: [row.id, control.id] } }, orderBy: { id: "asc" } })).toEqual(studentsBefore);
    expect(await db.feeStructure.findMany({ orderBy: { academicYear: "asc" } })).toEqual(feeBefore);
    expect(serializeMiscReceipt(await db.miscIncomeReceipt.findUniqueOrThrow({ where: { id: receiptId }, include: miscReceiptInclude }))).toEqual(saleBefore);
    expect(await db.payment.count()).toBe(0); expect(await db.cashBookDay.count()).toBe(0);
    const teacher = await actor("TEACHER");
    await expect(authorizePriorYear(db, teacher.context, "VIEW_PRIOR_YEAR_CONCESSIONS")).rejects.toThrow("PRIOR_YEAR_PERMISSION_DENIED");
    await db.authSession.update({ where: { id: apply.session.sessionId }, data: { revokedAt: new Date() } });
    await expect(mutate(apply, input)).rejects.toThrow("PRIOR_YEAR_PERMISSION_DENIED");
    expect(await db.priorYearConcessionEvent.count({ where: { eventType: "RELIEF_APPLIED", caseId } })).toBe(1);
    const auditText = JSON.stringify(events);
    for (const secret of [wrongActorToken, applyToken, prep.session.cookieValue, apply.session.cookieValue]) expect(auditText).not.toContain(secret);
  });
});
