import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient, Prisma } from "@prisma/client";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { eligiblePreviousYear, normalizeIncomeSupport, reconcilePriorYear, sourceProposalStatus, type PriorYearPolicy } from "@/lib/prior-year-concession-policy";
import { authorizePriorYear, mutatePriorYear, priorYearBalance, readPriorYearIncome, type ConcessionActor } from "@/lib/prior-year-concessions";
import { createMiscReceipt, serializeMiscReceipt, validateMiscReceiptInput } from "@/lib/misc-income";
import { emptyPriorYearBackup, loadPriorYearBackup, restorePriorYearBackup, validatePriorYearBackup, PRIOR_YEAR_BACKUP_KEYS } from "@/lib/prior-year-concession-backup";
import { createBackupDocument, generateFullBackup } from "@/lib/backup";
import { parseAndValidateBackup } from "@/lib/restore";
import { restoreValidatedBackup } from "@/lib/restore-database";

// Authentication/step-up are isolated at their service boundaries in these database tests.
// Existing IAM and real-user-access suites separately exercise signed sessions and one-time grants.
vi.mock("@/lib/iam/effective-access", () => ({ evaluateEffectivePermission: async (_db: unknown, input: { userId: string }) => ({ allowed: !input.userId.includes("denied"), role: input.userId.includes("teacher") ? "TEACHER" : input.userId.includes("approver") ? "DIRECTOR" : "ACCOUNTANT", source: "USER_ALLOW", roleLabel: "Finance", profileNames: input.userId.includes("marks") ? ["MARKS_ENTRY_OPERATOR"] : [] }) }));
vi.mock("@/lib/real-user-access/step-up", () => ({ consumeStepUpGrant: async (_db: unknown, input: { stepUpToken: string }) => input.stepUpToken === "synthetic-step-up-proof" }));
// PostgreSQL transaction tests isolate the existing SQLite-only QA flag adapter.
// SQLite and direct API suites exercise the real OFF gate; this is not HTTP/runtime acceptance.
vi.mock("@/lib/release-feature-flag-runtime", async (original) => {
  const actual = await original<typeof import("@/lib/release-feature-flag-runtime")>();
  const pgTest = () => process.env.DATABASE_PROVIDER === "postgresql" && process.env.CI === "true" && process.env.POSTGRES_READINESS_SYNTHETIC_QA === "1";
  const enabled = (feature: { key: string }) => (process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED ?? "").split(",").includes(feature.key);
  return { ...actual, isOperationalReleaseFeatureEnabled: (feature: Parameters<typeof actual.isOperationalReleaseFeatureEnabled>[0]) => pgTest() ? enabled(feature) : actual.isOperationalReleaseFeatureEnabled(feature), assertOperationalReleaseFeature: (feature: Parameters<typeof actual.assertOperationalReleaseFeature>[0]) => { if (!pgTest()) return actual.assertOperationalReleaseFeature(feature); if (!enabled(feature)) throw new actual.ReleaseFeatureUnavailableError(); } };
});

const policy: PriorYearPolicy = { contract: "NALANDA_PRIOR_YEAR_CONCESSIONS_1A", version: 1, academicYears: [{ id: "2024-25", sequence: 40, startsOn: "2024-04-01", endsOn: "2025-03-31" }, { id: "2025-26", sequence: 41, startsOn: "2025-04-01", endsOn: "2026-03-31" }, { id: "2026-27", sequence: 42, startsOn: "2026-04-01", endsOn: "2027-03-31" }, { id: "2027-28", sequence: 43, startsOn: "2027-04-01", endsOn: "2028-03-31" }], incomeBands: [{ id: "BAND_1", label: "Synthetic annual band" }], incomeRetentionDays: 30, scholarshipsEnabled: false };
let db: PrismaClient;
const postgres = process.env.DATABASE_PROVIDER === "postgresql";
const originalUrl = process.env.DATABASE_URL;
const suffix = randomUUID();
const actor = (role: string): ConcessionActor => ({ userId: `${role}-${suffix}`, sessionId: `session-${role}`, roleAssignmentId: `assignment-${role}` });
const prep = actor("preparer"), reviewer = actor("reviewer"), approver = actor("approver"), applier = actor("applier");
const request = (action: string, extra: Record<string, unknown> = {}) => ({ action, requestKey: randomUUID(), reason: "Wholly invented finance review evidence", stepUpToken: "synthetic-step-up-proof", ...extra });
const mutate = (who: ConcessionActor, input: unknown) => mutatePriorYear(db, who, input, { policy });
async function makeStudent() {
  const id = randomUUID();
  const student = await db.student.create({ data: { id, admissionNo: `SYNTHETIC-${id}`, studentName: "Invented Duplicate Name", fatherName: "Invented Guardian", className: "VI", phone1: "SYNTHETIC-NO-CONTACT", academicYear: "2026-27", discountPercent: 12, academicYearEnrollments: { create: [{ academicYear: "2025-26", className: "V" }, { academicYear: "2026-27", className: "VI" }, { academicYear: "2024-25", className: "IV" }] } } });
  return { student, enrollment: await db.academicYearEnrollment.findUniqueOrThrow({ where: { studentId_academicYear: { studentId: id, academicYear: "2025-26" } } }) };
}
async function liability(opening = "1000.00", paid = "200.00") {
  const fixture = await makeStudent();
  const payment = paid === "0" ? null : await makePayment(fixture.student.id, paid);
  const proposed = await mutate(prep, request("PREPARE_LIABILITY", { studentId: fixture.student.id, operatingYear: "2026-27", sourceYear: "2025-26", sourceEnrollmentId: fixture.enrollment.id, identityVerified: true, openingAmount: opening, existingCredits: "50.00", sourceReferences: ["INVENTED-TERM-1-REVIEW"], provenance: "Invented opening and approved-credit review" }));
  await mutate(reviewer, request("VERIFY", { liabilityId: proposed.liabilityId, expectedVersion: 1, identityVerified: true, balanceVerified: true, paymentIds: payment ? [payment.id] : [] }));
  return { ...fixture, liabilityId: proposed.liabilityId, payment };
}
async function makePayment(studentId: string, amount: string) {
  const student = await db.student.findUniqueOrThrow({ where: { id: studentId } });
  return db.payment.create({ data: { date: new Date("2026-09-01Z"), receiptNo: `SYNTHETIC-${randomUUID()}`, admissionNo: student.admissionNo, studentId, studentName: student.studentName, className: student.className, amountPaid: Number(amount), paymentMode: "Cash", receivedAccount: "Cash", feeType: "Old Due" } });
}
async function approvedCase(liabilityId: string, amount = "300.00", kind = "SCHOOL_WAIVER") {
  const prepared = await mutate(prep, request("PREPARE", { liabilityId, kind, requestedAmount: amount, applicantReference: "INVENTED-APPLICANT", validFrom: "2020-01-01", validTo: "2090-01-01" }));
  await mutate(prep, request("SUBMIT", { caseId: prepared.caseId, expectedVersion: 1 }));
  await mutate(reviewer, request("REVIEW", { caseId: prepared.caseId, expectedVersion: 2 }));
  const balance = await priorYearBalance(db, liabilityId, policy);
  await mutate(approver, request("APPROVE", { caseId: prepared.caseId, expectedVersion: 3, approvedAmount: amount, balanceHash: balance.hash, balanceVersion: balance.liability.version }));
  return prepared.caseId!;
}

function freshDatabase(label: string) {
  if (postgres) {
    if (process.env.CI !== "true" || process.env.POSTGRES_READINESS_SYNTHETIC_QA !== "1" || !originalUrl) throw new Error("EPHEMERAL_CI_POSTGRES_REQUIRED");
    const url = new URL(originalUrl); url.searchParams.set("schema", `prior_year_${label}_${suffix.replaceAll("-", "")}`);
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], { env: { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString() }, stdio: "pipe" });
    return url.toString();
  }
  const directory = path.resolve("tmp/student-items-concessions", suffix, label); mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, "synthetic.db");
  const sql = new DatabaseSync(filename);
  for (const migration of readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) sql.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8"));
  sql.close();
  return `file:${filename.replaceAll("\\", "/")}`;
}
beforeAll(async () => {
  const url = freshDatabase("source");
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("DATABASE_URL", url); vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3000"); vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_MODE", "SYNTHETIC_COPY_ONLY"); vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED", "prior-year-concessions-1a,student-linked-items-1a");
  vi.stubEnv("AUTH_SECRET", "SYNTHETIC-only-concession-test-secret-000000");
  vi.stubEnv("AUTH_MFA_KEYRING_JSON", JSON.stringify({ active: "SYNTHETIC", keys: { SYNTHETIC: Buffer.alloc(32, 7).toString("base64") } }));
  db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  await db.schoolSettings.create({ data: { id: "school", schoolName: "Invented School", addressLine1: "Synthetic address", city: "Synthetic city", phone: "NO-CONTACT", academicYear: "2026-27" } });
  for (const role of ["preparer", "reviewer", "approver", "applier", "teacher", "denied", "marks"]) await db.user.create({ data: { id: actor(role).userId, name: `Invented ${role}`, username: actor(role).userId, passwordHash: "SYNTHETIC-NONLOGIN", role: role === "approver" ? "DIRECTOR" : "ACCOUNTANT" } });
}, 120000);
afterAll(async () => { await db?.$disconnect(); vi.unstubAllEnvs(); });

describe("source-year-only exact finance policy", () => {
  it("uses configured chronology, never names or today's year", () => {
    const named = { ...policy, academicYears: policy.academicYears.map((year, index) => ({ ...year, id: ["old", "z-source", "a-operating", "next"][index] })) };
    expect(eligiblePreviousYear("a-operating", "z-source", named).source.sequence).toBe(41);
    expect(eligiblePreviousYear("2026-27", "2025-26", policy).source.id).toBe("2025-26");
    for (const year of ["2024-25", "2026-27", "2027-28"]) expect(() => eligiblePreviousYear("2026-27", year, policy)).toThrow("ONLY_CONFIGURED_PREVIOUS_YEAR_IS_ELIGIBLE");
    expect(() => eligiblePreviousYear("2026-27", "unverified", policy)).toThrow("ACADEMIC_YEAR_CONFIGURATION_REQUIRED");
  });
  it("does not resolve name-only or blank term cells", () => {
    expect(sourceProposalStatus({ sourceYear: "2025-26", termAmounts: [1, 2, 3, 4] })).toBe("IDENTITY_UNRESOLVED");
    expect(sourceProposalStatus({ studentId: "invented-exact", sourceYear: "2025-26", identityVerified: true, termAmounts: [1, null, 3, 4] })).toBe("AMOUNT_UNKNOWN");
    expect(sourceProposalStatus({ studentId: "invented-exact", sourceYear: "2025-26", identityVerified: true, termAmounts: [1, 0, 3, 4] })).toBe("REVIEW_PROPOSAL_ONLY");
  });
  it("distinguishes missing income from verified annual zero", () => {
    for (const status of ["UNKNOWN", "NOT_PROVIDED", "DECLINED"]) expect(normalizeIncomeSupport({ status }, policy).exactAnnualAmount).toBeNull();
    expect(normalizeIncomeSupport({ status: "PROVIDED", exactAnnualAmount: "0.00", period: "ANNUAL", currency: "INR" }, policy).exactAnnualAmount).toBe("0.00");
    expect(() => normalizeIncomeSupport({ status: "UNKNOWN", exactAnnualAmount: "0" }, policy)).toThrow();
  });
  it("reconciles paid liabilities rather than discounting original fees", () => {
    expect(reconcilePriorYear({ opening: "1000", payments: "200", existingCredits: "50", appliedRelief: "300", reversals: "100" }).remaining.toFixed(2)).toBe("550.00");
    expect(() => reconcilePriorYear({ opening: "10", payments: "11", existingCredits: "0", appliedRelief: "0", reversals: "0" })).toThrow();
  });
  it("rejects zero outstanding and identical display names never merge", async () => {
    const f = await liability("250.00", "200.00");
    await expect(mutate(prep, request("PREPARE", { liabilityId: f.liabilityId }))).rejects.toThrow("NO_PREVIOUS_YEAR_OUTSTANDING");
    const other = await makeStudent(); expect(other.student.id).not.toBe(f.student.id); expect(other.student.studentName).toBe(f.student.studentName);
  });
});

describe("governed prior-year transactions", () => {
  it("rejects unverified source, direct cross-liability binding, feature OFF and forged restore relief", async () => {
    const fixture = await makeStudent();
    const proposed = await mutate(prep, request("PREPARE_LIABILITY", { studentId: fixture.student.id, operatingYear: "2026-27", sourceYear: "2025-26", sourceEnrollmentId: fixture.enrollment.id, identityVerified: true, openingAmount: "100", existingCredits: "0", sourceReferences: ["Invented review pending"], provenance: "Invented proposal only" }));
    await expect(priorYearBalance(db, proposed.liabilityId, policy)).rejects.toThrow("SOURCE_YEAR_UNVERIFIED");
    const f = await liability(), id = await approvedCase(f.liabilityId);
    await expect(mutate(applier, request("APPLY", { caseId: id, liabilityId: proposed.liabilityId, expectedVersion: 4 }))).rejects.toThrow("CASE_LIABILITY_MISMATCH");
    vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED", "student-linked-items-1a");
    try { await expect(mutate(applier, request("APPLY", { caseId: id, expectedVersion: 4 }))).rejects.toThrow(); } finally { vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED", "prior-year-concessions-1a,student-linked-items-1a"); }
    const backup = await loadPriorYearBackup(db); const forged = structuredClone(backup);
    forged.priorYearConcessionCases.find((row) => row.id === id)!.approverId = prep.userId;
    expect(() => validatePriorYearBackup(forged)).toThrow();
  });
  it("keeps income optional, encrypts exact zero and purges expired support after rollover", async () => {
    const f = await liability();
    const prepared = await mutate(prep, request("PREPARE", { liabilityId: f.liabilityId, kind: "SCHOOL_WAIVER", requestedAmount: "100", applicantReference: "Invented applicant", validFrom: "2020-01-01", validTo: "2090-01-01" }));
    await mutate(prep, request("INCOME", { caseId: prepared.caseId, expectedVersion: 1, income: { status: "PROVIDED", exactAnnualAmount: "0.00", period: "ANNUAL", currency: "INR" } }));
    const support = await db.priorYearIncomeSupport.findUniqueOrThrow({ where: { caseId: prepared.caseId! } });
    expect(support.exactAmountEnvelope).not.toContain("0.00");
    expect((await readPriorYearIncome(db, prep, prepared.caseId!, false, { policy })).exactAnnualAmount).toBeNull();
    expect((await readPriorYearIncome(db, prep, prepared.caseId!, true, { policy })).exactAnnualAmount).toBe("0.00");
    await db.priorYearIncomeSupport.update({ where: { id: support.id }, data: { expiresAt: new Date("2000-01-01") } });
    await db.schoolSettings.update({ where: { id: "school" }, data: { academicYear: "2027-28" } });
    try { await mutate(prep, request("PURGE_INCOME", { caseId: prepared.caseId, expectedVersion: 2 })); } finally { await db.schoolSettings.update({ where: { id: "school" }, data: { academicYear: "2026-27" } }); }
    expect((await db.priorYearIncomeSupport.findUniqueOrThrow({ where: { id: support.id } })).exactAmountEnvelope).toBeNull();
  });
  it("applies once, recovers retries, reverses by compensation and changes no cash/current-year data", async () => {
    const f = await liability(), id = await approvedCase(f.liabilityId);
    const studentBefore = await db.student.findUniqueOrThrow({ where: { id: f.student.id } });
    const paymentsBefore = await db.payment.findMany({ where: { studentId: f.student.id } });
    const cashBefore = await db.cashBookDay.count();
    const input = request("APPLY", { caseId: id, expectedVersion: 4 });
    const applied = await mutate(applier, input);
    expect(await mutate(applier, input)).toEqual(applied);
    expect((await priorYearBalance(db, f.liabilityId, policy)).totals.remaining.toFixed(2)).toBe("450.00");
    expect(await db.student.findUnique({ where: { id: f.student.id } })).toEqual(studentBefore);
    expect(await db.payment.findMany({ where: { studentId: f.student.id } })).toEqual(paymentsBefore);
    expect(await db.cashBookDay.count()).toBe(cashBefore);
    await mutate(approver, request("REVERSE", { caseId: id, expectedVersion: 5 }));
    expect((await priorYearBalance(db, f.liabilityId, policy)).totals.remaining.toFixed(2)).toBe("750.00");
    const reversal = await db.priorYearConcessionEvent.findFirstOrThrow({ where: { caseId: id, eventType: "RELIEF_REVERSED" } }); expect(reversal.reversesEventId).toBe(applied.eventId);
    await expect(db.priorYearConcessionEvent.delete({ where: { id: applied.eventId } })).rejects.toThrow();
  });
  it("rejects self-approval, missing step-up, offline, unauthorized roles and income access", async () => {
    const f = await liability(); const prepared = await mutate(prep, request("PREPARE", { liabilityId: f.liabilityId, kind: "SCHOOL_WAIVER", requestedAmount: "100", applicantReference: "invented", validFrom: "2020-01-01", validTo: "2090-01-01" }));
    await mutate(prep, request("SUBMIT", { caseId: prepared.caseId, expectedVersion: 1 })); await mutate(reviewer, request("REVIEW", { caseId: prepared.caseId, expectedVersion: 2 }));
    await expect(mutate(prep, request("APPROVE", { caseId: prepared.caseId, expectedVersion: 3 }))).rejects.toThrow("INDEPENDENT_REVIEW_AND_NO_SELF_APPROVAL_REQUIRED");
    await expect(mutate(approver, request("APPROVE", { caseId: prepared.caseId, stepUpToken: "invalid" }))).rejects.toThrow("PRIOR_YEAR_STEP_UP_REQUIRED");
    await expect(mutate(prep, request("SUBMIT", { caseId: prepared.caseId, offline: true }))).rejects.toThrow("OFFLINE_PRIOR_YEAR_POSTING_FORBIDDEN");
    for (const role of ["teacher", "denied", "marks"]) await expect(authorizePriorYear(db, actor(role), "VIEW_PRIOR_YEAR_CONCESSIONS")).rejects.toThrow();
    await expect(readPriorYearIncome(db, actor("denied"), prepared.caseId!, false, { policy })).rejects.toThrow();
  });
  it("stales approval when a payment changes and blocks unsafe dependent reversal", async () => {
    const f = await liability(), id = await approvedCase(f.liabilityId);
    await db.payment.update({ where: { id: f.payment!.id }, data: { amountPaid: 210 } });
    await expect(mutate(applier, request("APPLY", { caseId: id, expectedVersion: 4 }))).rejects.toThrow("STALE_APPROVAL");
    const second = await approvedCase(f.liabilityId); await mutate(applier, request("APPLY", { caseId: second, expectedVersion: 4 }));
    await db.payment.update({ where: { id: f.payment!.id }, data: { amountPaid: 220 } });
    await expect(mutate(approver, request("REVERSE", { caseId: second, expectedVersion: 5 }))).rejects.toThrow("DEPENDENT_TRANSACTIONS");
  });
  it("serializes two concession applications against a single balance", async () => {
    const f = await liability(), a = await approvedCase(f.liabilityId, "500"), b = await approvedCase(f.liabilityId, "500");
    const results = await Promise.allSettled([mutate(applier, request("APPLY", { caseId: a, expectedVersion: 4 })), mutate(applier, request("APPLY", { caseId: b, expectedVersion: 4 }))]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await priorYearBalance(db, f.liabilityId, policy)).totals.remaining.toFixed(2)).toBe("250.00");
  });
  it("records a promise without money and attributes one later actual payment exactly once", async () => {
    const f = await liability(), id = await approvedCase(f.liabilityId, "100", "SPONSORSHIP_PROMISE");
    const count = await db.payment.count();
    await expect(mutate(applier, request("APPLY", { caseId: id, expectedVersion: 4 }))).rejects.toThrow("SPONSORSHIP_PROMISE_IS_NOT_MONEY_OR_WAIVER"); expect(await db.payment.count()).toBe(count);
    const received = await makePayment(f.student.id, "100");
    await expect(priorYearBalance(db, f.liabilityId, policy)).rejects.toThrow("ATTRIBUTION_REQUIRED");
    const fields = { caseId: id, sourceYear: "2025-26", sourceEnrollmentId: f.enrollment.id, identityVerified: true };
    const proposal = await mutate(prep, request("PROPOSE_PAYMENT", { ...fields, paymentId: received.id }));
    const version = (await db.priorYearLiability.findUniqueOrThrow({ where: { id: f.liabilityId } })).version;
    const apply = request("VERIFY_PAYMENT", { ...fields, proposalEventId: proposal.eventId, expectedLiabilityVersion: version });
    expect(await mutate(reviewer, apply)).toEqual(await mutate(reviewer, apply));
    expect(await db.payment.count()).toBe(count + 1);
    expect((await priorYearBalance(db, f.liabilityId, policy)).totals.remaining.toFixed(2)).toBe("650.00");
  });
});

describe("Student item completion and restore contract", () => {
  it("rolls back a restore when mapped destination payment belongs to a different Student", async () => {
    const f = await liability(), other = await makeStudent();
    const payment = await makePayment(f.student.id, "10");
    const all = await loadPriorYearBackup(db), backup = emptyPriorYearBackup(), id = randomUUID();
    backup.priorYearLiabilities = [{ ...all.priorYearLiabilities.find((row) => row.id === f.liabilityId)!, id }];
    backup.priorYearPaymentAttributions = [{ ...all.priorYearPaymentAttributions.find((row) => row.liabilityId === f.liabilityId)!, id: randomUUID(), liabilityId: id }];
    const result = Object.fromEntries(PRIOR_YEAR_BACKUP_KEYS.map((key) => [key, { created: 0, updated: 0, skipped: 0, errors: [] }])) as unknown as Parameters<typeof restorePriorYearBackup>[2];
    await expect(restorePriorYearBackup(db, backup, result, { students: new Map([[f.student.id, other.student.id]]), payments: new Map([[f.payment!.id, payment.id]]) })).rejects.toThrow("PRIOR_YEAR_RESTORE_PAYMENT_IDENTITY_CONFLICT");
    expect(await db.priorYearLiability.findUnique({ where: { id } })).toBeNull();
    // This unassigned synthetic payment must not affect later whole-backup reconciliation.
    await db.payment.update({ where: { id: payment.id }, data: { isCancelled: true } });
  });
  it("requires exact Student, enforces quantities/overflow and freezes historical rates and identity", async () => {
    const { student } = await makeStudent();
    const item = await db.miscIncomeItem.create({ data: { itemCode: "BELT", name: "Belt", category: "UNIFORM_ACCESSORY", studentLinkPolicy: "OPTIONAL", rates: { create: [{ academicYear: "2026-27", amount: "10.25", effectiveTo: new Date("2026-06-30Z") }, { academicYear: "2026-27", amount: "12.50", effectiveFrom: new Date("2026-07-01Z") }] } } });
    const input = { receiptDate: "2026-06-01", academicYear: "2026-27", studentId: student.id, paymentMethod: "CASH", lines: [{ itemId: item.id, quantity: 3 }] };
    await expect(createMiscReceipt(db, { ...input, studentId: null }, prep.userId)).rejects.toThrow("exact Student");
    for (const quantity of [0, -1, 1.5, NaN, Infinity, 10001, true, " "]) await expect(validateMiscReceiptInput(db, { ...input, lines: [{ itemId: item.id, quantity }] })).rejects.toThrow();
    const receipt = await createMiscReceipt(db, input, prep.userId); expect(receipt.netAmount.toFixed(2)).toBe("30.75");
    const later = await createMiscReceipt(db, { ...input, receiptDate: "2026-07-01" }, prep.userId); expect(later.netAmount.toFixed(2)).toBe("37.50");
    await db.student.update({ where: { id: student.id }, data: { studentName: "Invented Changed Name" } });
    expect((serializeMiscReceipt(receipt).student as { studentName: string }).studentName).toBe("Invented Duplicate Name");
    await db.miscIncomeRate.updateMany({ where: { itemId: item.id }, data: { amount: "9999999999.99" } });
    await expect(createMiscReceipt(db, input, prep.userId)).rejects.toThrow("monetary safety bound");
  });
  it("uses an explicit v48 contract and rejects relabelled legacy payloads", () => {
    const full = createBackupDocument({ generatedAt: new Date(), generatedBy: "Synthetic test", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [] });
    expect(full.metadata.backupVersion).toBe(48); expect(parseAndValidateBackup(full).priorYearLiabilities).toEqual([]);
    const legacy = structuredClone(full) as any; legacy.metadata.backupVersion = 45; delete legacy.metadata.schemaContract;
    expect(() => parseAndValidateBackup(legacy)).toThrow("BACKUP_SOURCE_COLLECTIONS_MISMATCH");
    const conflict = structuredClone(full) as any; conflict.metadata.schemaContract = "unmerged-other-branch-v47"; expect(() => parseAndValidateBackup(conflict)).toThrow("BACKUP_SOURCE_DISCRIMINATOR_MISMATCH");
    expect(() => validatePriorYearBackup({ priorYearLiabilities: [{ id: "invented", secretRawIncome: "123" }] })).toThrow();
  });
  it("restores existing immutable feature records twice without rewriting evidence", async () => {
    const backup = await loadPriorYearBackup(db);
    const students = new Map((await db.student.findMany()).map((row) => [row.id, row.id])), payments = new Map((await db.payment.findMany()).map((row) => [row.id, row.id]));
    for (let pass = 0; pass < 2; pass++) {
      const result = Object.fromEntries(PRIOR_YEAR_BACKUP_KEYS.map((key) => [key, { created: 0, updated: 0, skipped: 0, errors: [] }])) as unknown as Parameters<typeof restorePriorYearBackup>[2];
      await restorePriorYearBackup(db, backup, result, { students, payments });
      expect(await loadPriorYearBackup(db)).toEqual(backup);
    }
    expect(emptyPriorYearBackup().priorYearConcessionEvents).toEqual([]);
  });
  it("rebuilds a full synthetic backup in fresh databases twice with governed restored reversal", async () => {
    const f = await liability(), id = await approvedCase(f.liabilityId);
    await mutate(applier, request("APPLY", { caseId: id, expectedVersion: 4 }));
    const backup = parseAndValidateBackup(JSON.parse(JSON.stringify(await generateFullBackup(db, { generatedBy: "Invented restore verifier" }))));
    for (const label of ["restore_one", "restore_two"]) {
      const restored = new PrismaClient({ datasources: { db: { url: freshDatabase(label) } } });
      try {
        await restoreValidatedBackup(restored, backup, { id: prep.userId, name: "Invented restore verifier" });
        expect(await restored.priorYearConcessionCase.count()).toBe(await db.priorYearConcessionCase.count());
        expect((await priorYearBalance(restored, f.liabilityId, policy)).totals.remaining.toFixed(2)).toBe("450.00");
        await expect(mutatePriorYear(restored, approver, request("REVERSE", { caseId: id, expectedVersion: 5 }), { policy })).rejects.toThrow("DEPENDENT_TRANSACTIONS");
        const balance = await priorYearBalance(restored, f.liabilityId, policy);
        await mutatePriorYear(restored, reviewer, request("REVIEW_REVERSAL", { caseId: id, expectedVersion: 5, balanceHash: balance.hash, balanceVersion: balance.liability.version }), { policy });
        await mutatePriorYear(restored, approver, request("REVERSE", { caseId: id, expectedVersion: 5 }), { policy });
        expect((await priorYearBalance(restored, f.liabilityId, policy)).totals.remaining.toFixed(2)).toBe("750.00");
      } finally { await restored.$disconnect(); }
    }
  }, 180000);
});
