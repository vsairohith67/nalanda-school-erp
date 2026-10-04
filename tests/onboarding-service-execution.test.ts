import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { createPersistedSession } from "@/lib/auth-sessions";
import type { IamActor } from "@/lib/iam/security";
import { createGovernedReviewDraft } from "@/lib/onboarding-review-draft";
import { loadMappingCatalogue } from "@/lib/onboarding-preparation";
import { canonicalOnboardingPackage } from "@/lib/onboarding-canonical-package";
import { generateOnboardingTemplate } from "@/lib/onboarding-workbooks";
import { storeOnboardingWorkbook, resolveOnboardingStorageKey } from "@/lib/onboarding-storage";
import { createDryRunPlan, validateStoredBatch, approveOnboardingBatch, executeOnboardingBatch, rollbackOnboardingBatch } from "@/lib/onboarding";
import { inventedReviewPackage } from "./helpers/onboarding-review-fixture";

let root: string, caseRoot: string, db: PrismaClient, passwordHash: string;
let OwnedPrismaClient: typeof import("@prisma/client").PrismaClient;
let director: IamActor, principal: IamActor;
const password = "SYNTHETIC-Onboarding-Only-Password!";
const reason = "SYNTHETIC governed service execution";
const sqliteUrl = (file: string) => `file:${file.replaceAll("\\", "/")}`;
beforeAll(async () => {
  const parent = path.resolve("tmp/onboarding-service-synthetic"); await mkdir(parent, { recursive: true });
  root = await mkdtemp(path.join(parent, "owned-")); const template = path.join(root, "template.db"); await writeFile(template, "", { flag: "wx" });
  // Keep this SQLite execution proof independent of a PostgreSQL CI client's
  // generated provider. Never replace/borrow the surrounding runner's client.
  const schema = (await readFile(path.resolve("prisma/schema.prisma"), "utf8")).replace('provider = "prisma-client-js"', `provider = "prisma-client-js"\n  engineType = "binary"\n  output = "${path.join(root, "client").replaceAll("\\", "/")}"`);
  const ownedSchema = path.join(root, "schema.prisma"); await writeFile(ownedSchema, schema, { flag: "wx" });
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "generate", "--schema", ownedSchema], { env: { ...process.env, DATABASE_URL: sqliteUrl(template) }, stdio: "pipe", windowsHide: true });
  const { createRequire } = await import("node:module");
  OwnedPrismaClient = createRequire(import.meta.url)(path.join(root, "client/index.js")).PrismaClient;
}, 60_000);
beforeAll(async () => {
  const template = path.join(root, "template.db");
  execFileSync(process.execPath, [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", "prisma/schema.prisma"], { env: { ...process.env, DATABASE_URL: sqliteUrl(template) }, stdio: "pipe", windowsHide: true });
  passwordHash = await hashPassword(password);
}, 60_000);
beforeEach(async () => {
  caseRoot = await mkdtemp(path.join(root, "case-")); const target = path.join(caseRoot, "synthetic.db"); await copyFile(path.join(root, "template.db"), target);
  const url = sqliteUrl(target);
  vi.stubEnv("DATABASE_URL", url); vi.stubEnv("DATABASE_PROVIDER", "sqlite"); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("NALANDA_ENVIRONMENT", "TEST"); vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:47835");
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_MODE", "SYNTHETIC_COPY_ONLY"); vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED", "real-data-imports"); vi.stubEnv("AUTH_SECRET", "SYNTHETIC-TEST-ONLY-SECRET-NEVER-A-REAL-KEY");
  vi.stubEnv("ONBOARDING_STORAGE_ROOT", path.join(caseRoot, "private")); vi.stubEnv("PRIVATE_OBJECT_STORAGE_PROVIDER", "LOCAL");
  db = new OwnedPrismaClient({ datasourceUrl: url });
  async function actor(role: "DIRECTOR" | "PRINCIPAL"): Promise<IamActor> {
    const user = await db.user.create({ data: { username: `synthetic-${role.toLowerCase()}`, name: `SYNTHETIC ${role}`, role, passwordHash, isActive: true, lifecycleStatus: "ACTIVE" } });
    const assignment = await db.userRoleAssignment.create({ data: { userId: user.id, role, reason: "SYNTHETIC fixture only", activeKey: `${user.id}:${role}` } });
    const session = await createPersistedSession(db, user, new Headers());
    return { sessionId: session.sessionId, user: { id: user.id, username: user.username, name: user.name, email: user.email, designation: user.designation, role, authorizationVersion: user.authorizationVersion, roleAssignmentId: assignment.id, mustChangePassword: false, guardianId: null } };
  }
  director = await actor("DIRECTOR"); principal = await actor("PRINCIPAL");
  await db.timetableClassSection.create({ data: { academicYear: "2026-27", className: "I", section: "A", displayName: "SYNTHETIC I A", groupName: "PRIMARY", isActive: true } });
  await db.student.create({ data: { id: "synthetic-control", admissionNo: "CONTROL-UNRELATED", studentName: "SYNTHETIC control", fatherName: "SYNTHETIC control parent", phone1: "8000000099", className: "I" } });
});
afterEach(async () => { if (db) await db.$disconnect(); vi.unstubAllEnvs(); });
afterAll(async () => { if (root && path.relative(path.resolve("tmp/onboarding-service-synthetic"), root).startsWith("owned-")) await rm(root, { recursive: true, force: true }); });

async function batch(options: { missingFather?: boolean; finance?: boolean; admission?: string; year?: string; phone?: string; staffOnly?: boolean } = {}) {
  const bundle = options.staffOnly ? "STAFF" : "STUDENT_GUARDIAN";
  const source = path.join(caseRoot, `source-${randomUUID()}`); await inventedReviewPackage(source, randomUUID(), options);
  const draft = await createGovernedReviewDraft({ packageRoot: source, catalogue: await loadMappingCatalogue(path.resolve("config/onboarding/mapping-catalogue.json")), bundle });
  const stored = await storeOnboardingWorkbook(Buffer.from(canonicalOnboardingPackage(draft.parsed, bundle)));
  const row = await db.onboardingBatch.create({ data: { bundleType: bundle, uploadedByUserId: director.user.id, originalFileNameHash: "a".repeat(64), storageKey: stored.storageKey, workbookSha256: stored.sha256, byteSize: stored.byteSize, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", templateVersion: "1.0", schemaVersion: "IMPORT-1A-2026-08-10", purgeAfter: new Date(Date.now() + 86400000) } });
  return { row, draft };
}
const approval = (plan: any) => ({ reason, reauthPassword: password, planHash: plan.planHash, workbookHash: plan.workbookHash });
const operation = (plan: any) => ({ ...approval(plan), idempotencyKey: randomUUID().replaceAll("-", "") });
async function approved(options = {}) { const f = await batch(options); const plan = await validateStoredBatch(db, f.row.publicKey, director.user.id); expect(plan.plan?.blockingErrorCount).toBe(0); expect(plan.plan?.unresolvedDecisionCount).toBe(0); return { ...f, plan: await approveOnboardingBatch(db, f.row.publicKey, principal, approval(plan)) }; }
async function effects() { return { students: await db.student.count(), guardians: await db.guardian.count(), links: await db.studentGuardian.count(), enrollments: await db.academicYearEnrollment.count(), outcomes: await db.onboardingRowOutcome.count(), users: await db.user.count(), payments: await db.payment.count() }; }

describe("actual governed application services on fresh task-owned SQLite", () => {
  it("connects invented package through parser/planner/approval/execution, idempotent replay, audit and eligible rollback", async () => {
    const control = await db.student.findUniqueOrThrow({ where: { id: "synthetic-control" } }); const f = await approved({ admission: "000001" }); const op = operation(f.plan); const before = await effects();
    const result = await executeOnboardingBatch(db, f.row.publicKey, director, op); expect(result.status).toBe("COMPLETED");
    expect(result.result).toMatchObject({ students: 1, guardians: 1, links: 1, enrollments: 1, accountProposals: 0 });
    expect(await effects()).toEqual({ ...before, students: before.students + 1, guardians: 1, links: 1, enrollments: 1, outcomes: 4 });
    expect((await db.student.findFirstOrThrow({ where: { admissionNo: "000001" } })).studentName).toContain("విద్యార్థి");
    const after = await effects(); expect((await executeOnboardingBatch(db, f.row.publicKey, director, op)).status).toBe("COMPLETED"); expect(await effects()).toEqual(after);
    await expect(executeOnboardingBatch(db, f.row.publicKey, director, { ...op, reason: "SYNTHETIC conflicting retry payload" })).rejects.toMatchObject({ code: "IDEMPOTENCY_PAYLOAD_CHANGED" });
    expect(await rollbackOnboardingBatch(db, f.row.publicKey, director, { reason, reauthPassword: password })).toMatchObject({ eligible: true });
    expect(await rollbackOnboardingBatch(db, f.row.publicKey, director, { reason, reauthPassword: password, execute: true })).toMatchObject({ status: "ROLLED_BACK" });
    expect(await effects()).toEqual({ ...before, outcomes: 4 }); expect(await db.onboardingRowOutcome.count({ where: { status: "ROLLED_BACK" } })).toBe(4);
    expect((await db.onboardingAuditEvent.findMany({ where: { batchId: f.row.id }, orderBy: { sequence: "asc" } })).map(event => event.eventType)).toEqual(["VALIDATED", "APPROVED", "EXECUTED", "ROLLBACK_PREVIEW_ELIGIBLE", "ROLLED_BACK"]);
    expect(await db.student.findUnique({ where: { id: control.id } })).toEqual(control);
  });
  it("one missing required row and an unsupported financial domain block every authoritative batch effect", async () => {
    const f = await batch({ missingFather: true, finance: true }); const before = await effects(); const plan = await validateStoredBatch(db, f.row.publicKey, director.user.id);
    expect(plan.status).toBe("VALIDATED"); expect(plan.issues?.some(issue => issue.code === "FATHER_NAME_REQUIRED")).toBe(true); expect(plan.issues?.some(issue => issue.code === "PREPARATION_ROWS_HELD")).toBe(true);
    await expect(approveOnboardingBatch(db, f.row.publicKey, principal, approval(plan))).rejects.toMatchObject({ code: "PLAN_NOT_APPROVABLE" });
    await expect(executeOnboardingBatch(db, f.row.publicKey, director, operation(plan))).rejects.toMatchObject({ code: "APPROVAL_STALE" }); expect(await effects()).toEqual(before);
  });
  it("refuses client-supplied approved state, disabled feature, missing permission, revoked session and stale authority", async () => {
    const f = await batch(); const plan = await validateStoredBatch(db, f.row.publicKey, director.user.id); const op = operation(plan); const before = await effects();
    await expect(executeOnboardingBatch(db, f.row.publicKey, director, { ...op, status: "APPROVED" } as any)).rejects.toMatchObject({ code: "APPROVAL_STALE" });
    await approveOnboardingBatch(db, f.row.publicKey, principal, approval(plan));
    await expect(executeOnboardingBatch(db, f.row.publicKey, principal, op)).rejects.toThrow("permission");
    vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED", ""); await expect(executeOnboardingBatch(db, f.row.publicKey, director, op)).rejects.toThrow(); vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED", "real-data-imports");
    await db.authSession.update({ where: { id: director.sessionId }, data: { revokedAt: new Date() } }); await expect(executeOnboardingBatch(db, f.row.publicKey, director, op)).rejects.toThrow("permission");
    await db.authSession.update({ where: { id: director.sessionId }, data: { revokedAt: null } }); await db.user.update({ where: { id: director.user.id }, data: { authorizationVersion: { increment: 1 } } }); await expect(executeOnboardingBatch(db, f.row.publicKey, director, op)).rejects.toThrow(); expect(await effects()).toEqual(before);
  });
  it("requires revalidation/reapproval when target references change and invalidates the old approval", async () => {
    const f = await approved(); const oldHash = f.plan.planHash; const op = operation(f.plan); const before = await effects();
    await db.timetableClassSection.updateMany({ data: { isActive: false } }); await expect(executeOnboardingBatch(db, f.row.publicKey, director, op)).rejects.toMatchObject({ code: "PLAN_STALE" });
    const held = await validateStoredBatch(db, f.row.publicKey, director.user.id); expect(held.status).toBe("VALIDATED"); expect(held.approvedAt).toBeNull(); expect(held.planHash).not.toBe(oldHash); expect(held.issues?.some(issue => issue.code === "REFERENCE_INACTIVE")).toBe(true);
    await db.timetableClassSection.updateMany({ data: { isActive: true } }); const current = await validateStoredBatch(db, f.row.publicKey, director.user.id); const newApproval = await approveOnboardingBatch(db, f.row.publicKey, principal, approval(current));
    await expect(executeOnboardingBatch(db, f.row.publicKey, director, { ...operation(newApproval), planHash: "forged-plan" })).rejects.toMatchObject({ code: "PLAN_HASH_CHANGED" }); expect(await effects()).toEqual(before);
    expect((await executeOnboardingBatch(db, f.row.publicKey, director, operation(newApproval))).status).toBe("COMPLETED");
  });
  it("refuses changed workbook bytes and expired plans before effects", async () => {
    const f = await approved(); const before = await effects(); const target = resolveOnboardingStorageKey(f.row.storageKey); const original = await readFile(target); await writeFile(target, Buffer.concat([original, Buffer.from("SYNTHETIC changed bytes")]));
    await expect(executeOnboardingBatch(db, f.row.publicKey, director, operation(f.plan))).rejects.toThrow("WORKBOOK_HASH_CHANGED"); await writeFile(target, original);
    await db.onboardingBatch.update({ where: { id: f.row.id }, data: { planExpiresAt: new Date(0) } }); await expect(executeOnboardingBatch(db, f.row.publicKey, director, operation(f.plan))).rejects.toMatchObject({ code: "APPROVAL_STALE" }); expect(await effects()).toEqual(before);
  });
  it("refuses a stale plan at approval and concurrent attempts leave one consistent outcome", async () => {
    const f = await batch(); const plan = await validateStoredBatch(db, f.row.publicKey, director.user.id);
    await db.timetableClassSection.updateMany({ data: { displayName: "SYNTHETIC changed reference" } }); await expect(approveOnboardingBatch(db, f.row.publicKey, principal, approval(plan))).rejects.toMatchObject({ code: "PLAN_STALE" });
    const current = await validateStoredBatch(db, f.row.publicKey, director.user.id);
    const approvals = await Promise.allSettled([approveOnboardingBatch(db, f.row.publicKey, principal, approval(current)), approveOnboardingBatch(db, f.row.publicKey, director, approval(current))]); expect(approvals.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const op = operation(current); const runs = await Promise.allSettled([executeOnboardingBatch(db, f.row.publicKey, director, op), executeOnboardingBatch(db, f.row.publicKey, director, op)]); expect(runs.some(result => result.status === "fulfilled")).toBe(true);
    expect(await db.student.count()).toBe(2); expect(await db.guardian.count()).toBe(1); expect(await db.onboardingAuditEvent.count({ where: { batchId: f.row.id, eventType: "EXECUTED" } })).toBe(1); expect(await db.onboardingRowOutcome.count()).toBe(4);
  });
  it("rolls back a real transaction failure, retains approved state, and retries the same operation honestly", async () => {
    const f = await approved(); const before = await effects(); const op = operation(f.plan);
    await db.$executeRawUnsafe(`CREATE TRIGGER SYNTHETIC_LANE5_ABORT BEFORE INSERT ON OnboardingRowOutcome WHEN NEW.entityType = 'GUARDIAN' BEGIN SELECT RAISE(ABORT, 'SYNTHETIC_LANE5_BOUNDARY_FAILURE'); END`);
    await expect(executeOnboardingBatch(db, f.row.publicKey, director, op)).rejects.toThrow(); expect(await effects()).toEqual(before);
    const failed = await db.onboardingBatch.findUniqueOrThrow({ where: { id: f.row.id } }); expect(failed.status).toBe("APPROVED"); expect(failed.executionIdempotencyKey).toBeNull(); expect(failed.executionResultJson).toBeNull(); expect(await db.onboardingAuditEvent.count({ where: { batchId: f.row.id, eventType: "EXECUTED" } })).toBe(0);
    await db.$executeRawUnsafe("DROP TRIGGER SYNTHETIC_LANE5_ABORT"); expect((await executeOnboardingBatch(db, f.row.publicKey, director, op)).status).toBe("COMPLETED");
  });
  it("uses explicit link/create decisions, rejects unsupported resolutions and preserves sibling batches on unsafe rollback", async () => {
    const first = await approved({ admission: "000-link" }); await executeOnboardingBatch(db, first.row.publicKey, director, operation(first.plan));
    const sibling = await batch({ admission: "000-link" }); const before = await effects(); const unresolved = await validateStoredBatch(db, sibling.row.publicKey, director.user.id); expect(unresolved.plan?.unresolvedDecisionCount).toBeGreaterThan(0);
    const keys = sibling.draft.parsed; const studentKey = String(keys.students[0]["Import Row Key"]), guardianKey = String(keys.guardians[0]["Guardian Row Key"]);
    const invalid = await validateStoredBatch(db, sibling.row.publicKey, director.user.id, { [studentKey]: { decision: "FORGED_ACCEPT" as any, reason } }); expect(invalid.issues?.some(issue => issue.code === "RESOLUTION_INVALID")).toBe(true);
    // The supported CREATE_NEW decision creates a distinct Guardian despite a shared contact.
    const resolutions = { [studentKey]: { decision: "LINK_EXISTING" as const, reason }, [guardianKey]: { decision: "CREATE_NEW" as const, reason } };
    const current = await validateStoredBatch(db, sibling.row.publicKey, director.user.id, resolutions); expect(current.plan?.blockingErrorCount).toBe(0);
    const approvedSibling = await approveOnboardingBatch(db, sibling.row.publicKey, principal, approval(current));
    // Existing enrollment is a genuine business conflict: atomic refusal, including the new Guardian.
    await expect(executeOnboardingBatch(db, sibling.row.publicKey, director, operation(approvedSibling))).rejects.toMatchObject({ code: "ENROLLMENT_CONFLICT" }); expect(await effects()).toEqual(before);
    const student = await db.student.findFirstOrThrow({ where: { admissionNo: "000-link" } }); const guardian = await db.guardian.create({ data: { displayName: "SYNTHETIC later guardian", relationship: "Guardian", primaryMobile: "8000000002" } }); await db.studentGuardian.create({ data: { studentId: student.id, guardianId: guardian.id, relationshipToStudent: "Guardian" } });
    const preview = await rollbackOnboardingBatch(db, first.row.publicKey, director, { reason, reauthPassword: password }) as any; expect(preview.eligible).toBe(false); expect(preview.dependencies.some((code: string) => code.startsWith("LATER_RELATIONSHIP"))).toBe(true);
    await expect(rollbackOnboardingBatch(db, first.row.publicKey, director, { reason, reauthPassword: password, execute: true })).rejects.toMatchObject({ code: "ROLLBACK_DEPENDENCY_EXISTS" }); expect((await db.onboardingBatch.findUniqueOrThrow({ where: { id: sibling.row.id } })).status).toBe("APPROVED");
  });
  it("keeps account proposals pending and rejects missing selected-subset dependencies and reference mismatches", async () => {
    const f = await batch({ year: "2099-00" }); const plan = await validateStoredBatch(db, f.row.publicKey, director.user.id); expect(plan.issues?.some(issue => issue.code === "REFERENCE_SETUP_REQUIRED")).toBe(true);
    const rows = f.draft.parsed; rows.links[0]["Guardian Row Key"] = "MISSING-SELECTED-GUARDIAN"; rows.guardians = [];
    const missing = await createDryRunPlan(db, f.row, rows); expect(missing.issues.some(issue => issue.code === "ORPHAN_GUARDIAN_LINK")).toBe(true);
    rows.links = []; rows.enrollments = []; rows.students = []; rows.guardians = [{ "Guardian Row Key": "SYNTH-ACCOUNT", Name: "SYNTHETIC pending parent", Relationship: "Guardian", Mobile: "8000000003", "Parent Account Proposal": "YES" }];
    const bytes = generateOnboardingTemplate({ bundle: "STUDENT_GUARDIAN", rows }); const stored = await storeOnboardingWorkbook(bytes); const proposal = await db.onboardingBatch.create({ data: { ...f.row, id: undefined, publicKey: undefined, storageKey: stored.storageKey, workbookSha256: stored.sha256, byteSize: stored.byteSize } });
    const proposalPlan = await validateStoredBatch(db, proposal.publicKey, director.user.id); const authorized = await approveOnboardingBatch(db, proposal.publicKey, principal, approval(proposalPlan)); const users = await db.user.count();
    await executeOnboardingBatch(db, proposal.publicKey, director, operation(authorized)); expect(await db.user.count()).toBe(users); expect(await db.onboardingRowOutcome.count({ where: { batchId: proposal.id, entityType: "ACCOUNT_PROPOSAL", status: "PENDING_ACTIVATION" } })).toBe(1);
  });
  it("links reviewed existing identities for a new academic year without merging a shared-phone sibling", async () => {
    const first = await approved({ admission: "000-SOURCE" }); await executeOnboardingBatch(db, first.row.publicKey, director, operation(first.plan));
    await db.timetableClassSection.create({ data: { academicYear: "2027-28", className: "I", section: "A", displayName: "SYNTHETIC new year", groupName: "PRIMARY" } });
    const f = await batch({ admission: "000-SOURCE", year: "2027-28" });
    const decisions = { [String(f.draft.parsed.students[0]["Import Row Key"])]: { decision: "LINK_EXISTING" as const, reason }, [String(f.draft.parsed.guardians[0]["Guardian Row Key"])]: { decision: "LINK_EXISTING" as const, reason } };
    const current = await validateStoredBatch(db, f.row.publicKey, director.user.id, decisions); expect(current.plan?.createCount).toBe(0);
    const ready = await approveOnboardingBatch(db, f.row.publicKey, principal, approval(current)); const before = await effects();
    const linked = await executeOnboardingBatch(db, f.row.publicKey, director, operation(ready)); expect(linked.result).toMatchObject({ students: 0, guardians: 0, links: 0, enrollments: 1 });
    expect(await effects()).toEqual({ ...before, enrollments: before.enrollments + 1, outcomes: before.outcomes + 4 });
    expect(await db.onboardingRowOutcome.count({ where: { batchId: f.row.id, action: "LINK_EXISTING" } })).toBe(3);
    const sibling = await batch({ admission: "000-DISTINCT", year: "2027-28" }); const unresolved = await validateStoredBatch(db, sibling.row.publicKey, director.user.id);
    expect(unresolved.issues?.some(issue => issue.code === "POSSIBLE_STUDENT_MATCH" && issue.severity === "REQUIRES_USER_DECISION")).toBe(true);
    const separate = { [String(sibling.draft.parsed.students[0]["Import Row Key"])]: { decision: "CREATE_NEW" as const, reason }, [String(sibling.draft.parsed.guardians[0]["Guardian Row Key"])]: { decision: "LINK_EXISTING" as const, reason } };
    const siblingPlan = await validateStoredBatch(db, sibling.row.publicKey, director.user.id, separate); const siblingReady = await approveOnboardingBatch(db, sibling.row.publicKey, principal, approval(siblingPlan));
    expect((await executeOnboardingBatch(db, sibling.row.publicKey, director, operation(siblingReady))).result).toMatchObject({ students: 1, guardians: 0, links: 1, enrollments: 1 });
    expect(await db.student.count()).toBe(3); expect(await db.guardian.count()).toBe(1);
    // The later year belongs to another batch and prevents deleting the original Student.
    const preview = await rollbackOnboardingBatch(db, first.row.publicKey, director, { reason, reauthPassword: password }) as any;
    expect(preview.eligible).toBe(false); expect(preview.dependencies.some((code: string) => code.startsWith("LATER_ENROLLMENT"))).toBe(true);
  });
  it("connects a separately selected invented Staff package with Director approval, exact references and no active account", async () => {
    const control = await db.staffMember.create({ data: { staffCode: "SYNTH-REFERENCE", fullName: "SYNTHETIC reference Staff", staffType: "TEACHING", designation: "Teacher", department: "Academics" } });
    const f = await batch({ staffOnly: true }); expect(f.draft.heldRows).toBe(0); expect(f.draft.parsed.staff).toHaveLength(1);
    const plan = await validateStoredBatch(db, f.row.publicKey, director.user.id); expect(plan.plan?.blockingErrorCount).toBe(0);
    await expect(approveOnboardingBatch(db, f.row.publicKey, principal, approval(plan))).rejects.toMatchObject({ code: "BUNDLE_APPROVAL_SCOPE_REFUSED" });
    const ready = await approveOnboardingBatch(db, f.row.publicKey, director, approval(plan)); const users = await db.user.count();
    expect((await executeOnboardingBatch(db, f.row.publicKey, director, operation(ready))).result).toMatchObject({ staff: 1, students: 0, guardians: 0, accountProposals: 0 });
    expect((await db.staffMember.findUniqueOrThrow({ where: { staffCode: "000-STAFF" } })).fullName).toContain("ఉపాధ్యాయుడు"); expect(await db.user.count()).toBe(users);
    expect((await rollbackOnboardingBatch(db, f.row.publicKey, director, { reason, reauthPassword: password, execute: true }) as any).status).toBe("ROLLED_BACK");
    expect(await db.staffMember.findUnique({ where: { id: control.id } })).toEqual(control);
  });
  it("preserves inactive account and transport references that a foreign-key SetNull would otherwise change", async () => {
    const f = await approved(); await executeOnboardingBatch(db, f.row.publicKey, director, operation(f.plan));
    const guardian = await db.guardian.findFirstOrThrow();
    const inactive = await db.user.create({ data: { username: "synthetic-inactive-parent", name: "SYNTHETIC inactive account", role: "PARENT", passwordHash, isActive: false, lifecycleStatus: "INACTIVE", guardianId: guardian.id } });
    const preview = await rollbackOnboardingBatch(db, f.row.publicKey, director, { reason, reauthPassword: password }) as any;
    expect(preview.eligible).toBe(false); expect(preview.dependencies).toContain("PARENT_ACCOUNT:1");
    await expect(rollbackOnboardingBatch(db, f.row.publicKey, director, { reason, reauthPassword: password, execute: true })).rejects.toMatchObject({ code: "ROLLBACK_DEPENDENCY_EXISTS" });
    expect(await db.user.findUnique({ where: { id: inactive.id } })).toEqual(inactive);
    await db.staffMember.create({ data: { staffCode: "SYNTH-REFERENCE", fullName: "SYNTHETIC reference Staff", staffType: "TEACHING", designation: "Teacher", department: "Academics" } });
    const staffBatch = await batch({ staffOnly: true }); const staffPlan = await validateStoredBatch(db, staffBatch.row.publicKey, director.user.id);
    const staffReady = await approveOnboardingBatch(db, staffBatch.row.publicKey, director, approval(staffPlan)); await executeOnboardingBatch(db, staffBatch.row.publicKey, director, operation(staffReady));
    const staff = await db.staffMember.findUniqueOrThrow({ where: { staffCode: "000-STAFF" } });
    const vehicle = await db.transportVehicle.create({ data: { registrationCode: "SYNTH-VEHICLE", displayName: "SYNTHETIC vehicle", capacity: 1 } });
    const route = await db.transportRoute.create({ data: { code: "SYNTH-ROUTE", name: "SYNTHETIC route", vehicleId: vehicle.id, capacity: 1, driverStaffMemberId: staff.id } });
    const staffPreview = await rollbackOnboardingBatch(db, staffBatch.row.publicKey, director, { reason, reauthPassword: password }) as any;
    expect(staffPreview.eligible).toBe(false); expect(staffPreview.dependencies).toContain("TRANSPORT_DUTY:1");
    await expect(rollbackOnboardingBatch(db, staffBatch.row.publicKey, director, { reason, reauthPassword: password, execute: true })).rejects.toMatchObject({ code: "ROLLBACK_DEPENDENCY_EXISTS" });
    expect(await db.transportRoute.findUnique({ where: { id: route.id } })).toEqual(route); expect(await db.staffMember.findUnique({ where: { id: staff.id } })).toEqual(staff);
  });
});
