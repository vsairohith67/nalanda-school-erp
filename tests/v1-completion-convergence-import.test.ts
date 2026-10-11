import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync, backup } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hashPassword } from "@/lib/password";
import { defaultPermissionMatrix } from "@/lib/role-permissions";
import { createPersistedSession, resolvePersistedSession } from "@/lib/auth-sessions";
import type { AuthUser } from "@/lib/auth";
import type { IamActor } from "@/lib/iam/security";
import { generateOnboardingTemplate, parseOnboardingWorkbook } from "@/lib/onboarding-workbooks";
import { storeOnboardingWorkbook } from "@/lib/onboarding-storage";
import { validateStoredBatch, approveOnboardingBatch, executeOnboardingBatch } from "@/lib/onboarding";
import { studentExchangeScope, scopedStudentRow } from "@/lib/student-export-scope";
import { buildCertificateSourceSnapshot, snapshotHash } from "@/lib/certificate-snapshots";
import { getParentCertificatePortal } from "@/lib/certificate-portals";
import { loadAcademicReportSources } from "@/lib/academic-reporting-sources";
import type { AcademicReportInput } from "@/lib/academic-reporting-types";

// ISOLATED_SERVICE: actual production workbook/parser, stored batch, persisted
// sessions/current IAM, approval/execution and downstream readers. No imported
// account activation, issued report/certificate, Browser or runtime claim.
// The finite provider QA seam matches existing acceptance tests; PostgreSQL
// requires genuine ephemeral CI. No local CI spoof or operational URL is used.
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

const password = "SYNTHETIC-V1-Import-Only!";
const reason = "SYNTHETIC exact imported Student consumer proof";
const postgres = process.env.DATABASE_PROVIDER === "postgresql";
const schema = `v1_import_${randomUUID().replaceAll("-", "")}`;
let root: string | undefined, identity: ReturnType<typeof lstatSync> | undefined;
let db: PrismaClient, director: IamActor, principal: IamActor, passwordHash: string;
let studentId: string, guardianId: string;

beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "nalanda-v1-import-")); identity = lstatSync(root);
  let url = `file:${path.join(root, "synthetic.db").replaceAll("\\", "/")}`;
  if (postgres) {
    if (process.env.CI !== "true" || process.env.POSTGRES_READINESS_SYNTHETIC_QA !== "1" || !process.env.DATABASE_URL)
      throw new Error("EXPLICIT_EPHEMERAL_POSTGRES_REQUIRED");
    const target = new URL(process.env.DATABASE_URL); target.searchParams.set("schema", schema); url = target.toString();
    db = new PrismaClient({ datasourceUrl: url });
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"],
      { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "pipe", timeout: 60_000, windowsHide: true });
  } else {
    const sql = new DatabaseSync(":memory:");
    try {
      for (const migration of readdirSync("prisma/migrations", { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort())
        sql.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8"));
      expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      await backup(sql, path.join(root, "synthetic.db"));
    } finally { sql.close(); }
    db = new PrismaClient({ datasourceUrl: url });
  }
  vi.stubEnv("DATABASE_URL", url); vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("NALANDA_ENVIRONMENT", "TEST");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:47835"); vi.stubEnv("AUTH_SECRET", randomBytes(48).toString("base64url"));
  vi.stubEnv("ONBOARDING_STORAGE_ROOT", path.join(root, "private")); vi.stubEnv("PRIVATE_OBJECT_STORAGE_PROVIDER", "LOCAL");
  vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_MODE", "SYNTHETIC_COPY_ONLY"); vi.stubEnv("RELEASE_FEATURE_FLAGS_QA_ENABLED", "real-data-imports");
  await db.rolePermission.createMany({ data: Object.entries(defaultPermissionMatrix()).flatMap(([role, entries]) =>
    Object.entries(entries).map(([permission, enabled]) => ({ role, permission, enabled }))) });
  passwordHash = await hashPassword(password);
  director = await actor("DIRECTOR"); principal = await actor("PRINCIPAL");
  await db.timetableClassSection.createMany({ data: [
    { academicYear: "2025-26", className: "I", section: "B", displayName: "Invented prior I B", groupName: "PRIMARY" },
    { academicYear: "2026-27", className: "II", section: "A", displayName: "Invented current II A", groupName: "PRIMARY" }
  ] });
  await db.student.create({ data: { id: "v1-import-control", admissionNo: "SYNTHETIC-CONTROL", studentName: "Invented unrelated Student",
    fatherName: "Invented control parent", phone1: "8000000099", className: "II", section: "A", academicYear: "2026-27" } });
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
  } finally { vi.unstubAllEnvs(); }
});

async function actor(role: "DIRECTOR" | "PRINCIPAL" | "PARENT", linkedGuardianId?: string) {
  const user = await db.user.create({ data: { username: `synthetic-${randomUUID()}`, name: `Invented ${role}`, role, passwordHash,
    guardianId: linkedGuardianId, isActive: true, lifecycleStatus: "ACTIVE", mustChangePassword: false } });
  await db.userRoleAssignment.create({ data: { userId: user.id, role, reason, activeKey: `${user.id}:${role}` } });
  const session = await createPersistedSession(db, user, new Headers());
  const resolved = await resolvePersistedSession(db, session.cookieValue); expect(resolved).not.toBeNull();
  const auth: AuthUser = { id: user.id, username: user.username, name: user.name, email: user.email, designation: user.designation,
    role, authorizationVersion: resolved!.user.authorizationVersion, roleAssignmentId: resolved!.activeRoleAssignment.id,
    mustChangePassword: false, guardianId: resolved!.user.guardianId };
  return { user: auth, sessionId: session.sessionId, cookie: session.cookieValue };
}

describe.sequential("governed imported Student reaches exact current/historical consumers", () => {
  it("executes the production workbook path once with exact enrollment lineage and pending account proposal", async () => {
    const control = await db.student.findUniqueOrThrow({ where: { id: "v1-import-control" } });
    const users = await db.user.count();
    const bytes = generateOnboardingTemplate({ bundle: "STUDENT_GUARDIAN", academicYears: ["2025-26", "2026-27"], rows: {
      students: [{ "Import Row Key": "SYNTH-STUDENT", "Admission Number": "000-V1", "Student Full Name": "Invented విద్యార్థి हिन्दी العربية",
        "Father Name": "Invented Father", Phone: "8000000001", "Academic Year": "2026-27", Class: "II", Section: "A", "Roll Number": "7", "Student Status": "ACTIVE" }],
      guardians: [{ "Guardian Row Key": "SYNTH-GUARDIAN", Name: "Invented Guardian", Relationship: "Father", Mobile: "8000000001", "Parent Account Proposal": "YES" }],
      links: [{ "Link Row Key": "SYNTH-LINK", "Student Row Key": "SYNTH-STUDENT", "Guardian Row Key": "SYNTH-GUARDIAN", "Relationship to Student": "Father", "Primary Contact": "YES", "Can View Fees": "YES", "Can Receive Reminders": "YES" }],
      enrollments: [
        { "Enrollment Row Key": "SYNTH-HISTORY", "Student Row Key": "SYNTH-STUDENT", "Academic Year": "2025-26", Class: "I", Section: "B", "Roll Number": "2", "Enrollment Date": "2025-06-01", Status: "INACTIVE" },
        { "Enrollment Row Key": "SYNTH-CURRENT", "Student Row Key": "SYNTH-STUDENT", "Academic Year": "2026-27", Class: "II", Section: "A", "Roll Number": "7", "Enrollment Date": "2026-06-01", Status: "ACTIVE" }
      ], staff: []
    } });
    const parsed = parseOnboardingWorkbook(bytes, "STUDENT_GUARDIAN");
    expect(parsed.students[0]["Admission Number"]).toBe("000-V1"); expect(parsed.enrollments).toHaveLength(2);
    const stored = await storeOnboardingWorkbook(bytes);
    const batch = await db.onboardingBatch.create({ data: { bundleType: "STUDENT_GUARDIAN", uploadedByUserId: director.user.id,
      originalFileNameHash: "a".repeat(64), storageKey: stored.storageKey, workbookSha256: stored.sha256, byteSize: stored.byteSize,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", templateVersion: "1.0", schemaVersion: "IMPORT-1A-2026-08-10",
      purgeAfter: new Date(Date.now() + 86400000) } });
    const plan = await validateStoredBatch(db, batch.publicKey, director.user.id);
    expect(plan.plan?.blockingErrorCount).toBe(0); expect(plan.plan?.unresolvedDecisionCount).toBe(0);
    const approval = { reason, reauthPassword: password, planHash: plan.planHash!, workbookHash: plan.workbookHash };
    await approveOnboardingBatch(db, batch.publicKey, principal, approval);
    const operation = { ...approval, idempotencyKey: randomUUID().replaceAll("-", "") };
    const result = await executeOnboardingBatch(db, batch.publicKey, director, operation);
    expect(result.status).toBe("COMPLETED"); expect(result.result).toMatchObject({ students: 1, guardians: 1, links: 1, enrollments: 2, accountProposals: 1 });
    const student = await db.student.findUniqueOrThrow({ where: { admissionNo: "000-V1" } }); studentId = student.id;
    guardianId = (await db.studentGuardian.findFirstOrThrow({ where: { studentId } })).guardianId;
    expect(await db.user.count()).toBe(users);
    expect(await db.onboardingRowOutcome.count({ where: { batchId: batch.id, entityType: "ACCOUNT_PROPOSAL", status: "PENDING_ACTIVATION" } })).toBe(1);
    expect((await executeOnboardingBatch(db, batch.publicKey, director, operation)).status).toBe("COMPLETED");
    expect(await db.student.count()).toBe(2); expect(await db.academicYearEnrollment.count({ where: { studentId } })).toBe(2);
    expect(await db.onboardingAuditEvent.count({ where: { batchId: batch.id, eventType: "EXECUTED" } })).toBe(1);
    expect(await db.student.findUnique({ where: { id: control.id } })).toEqual(control);
  });

  it("selects exact year enrollment for export/certificate sources and leaves absent academic evidence unresolved", async () => {
    for (const [year, className, section, rollNo, status] of [
      ["2025-26", "I", "B", "2", "INACTIVE"], ["2026-27", "II", "A", "7", "ACTIVE"]
    ]) {
      const scope = studentExchangeScope(new URLSearchParams({ academicYear: year, className, section }));
      const matches = await db.student.findMany({ where: scope.where, include: { academicYearEnrollments: true } });
      expect(matches.map(row => row.id)).toEqual([studentId]);
      expect(scopedStudentRow(matches[0], year)).toMatchObject({ id: studentId, academicYear: year, className, section, rollNo, status });
    }
    const empty = studentExchangeScope(new URLSearchParams({ academicYear: "2024-25" })); expect(await db.student.count({ where: empty.where })).toBe(0);
    const current = await db.student.findUniqueOrThrow({ where: { id: studentId }, include: { academicYearEnrollments: true } });
    expect(() => scopedStudentRow(current, "2024-25")).toThrow("Selected year enrollment missing");
    const history = await buildCertificateSourceSnapshot(db, studentId, "2025-26", "BONAFIDE", reason);
    expect(history.currentEnrollment).toMatchObject({ academicYear: "2025-26", className: "I", section: "B", status: "INACTIVE" });
    expect(history.enrollmentWording).toBe("was a bonafide Student"); expect(history.attendance).toBeNull();
    expect(history.progression).toEqual({ display: "Promotion decision not recorded." });
    const present = await buildCertificateSourceSnapshot(db, studentId, "2026-27", "STUDY", reason);
    expect(present.currentEnrollment).toMatchObject({ className: "II", section: "A", status: "ACTIVE" }); expect(present.studyHistoryIncomplete).toBe(false);
    expect(present.enrollmentWording).toBe("is a bonafide Student"); expect(present.attendance).toBeNull();
    expect(present.warnings).toContain("Attendance snapshot is unavailable; do not display zero.");
    const saved = JSON.stringify(present), frozenHash = snapshotHash(present);
    await db.student.update({ where: { id: studentId }, data: { studentName: "Invented later name" } });
    expect(JSON.stringify(present)).toBe(saved); expect(snapshotHash(present)).toBe(frozenHash);
    expect(snapshotHash(await buildCertificateSourceSnapshot(db, studentId, "2026-27", "STUDY", reason))).not.toBe(frozenHash);
    const input: AcademicReportInput = { family: "COMPLETION_MISSING_SOURCE", academicYear: "2026-27", examinationCodes: ["SYNTHETIC-EXAM"],
      className: "II", section: "A", subjectCode: null, studentReference: null, childHandle: null, expectedContextVersion: null,
      normalizationRule: "NONE", includeAverageHighest: false, approvalReference: null, supersedesRunReference: null };
    const report = await loadAcademicReportSources(db, input, director.user, director.sessionId);
    expect(report.sources).toEqual([]); expect(report.expectedCompletion).toEqual([{ examinationCode: "SYNTHETIC-EXAM", locked: 0, issued: 0, missing: 0 }]);
    expect(await db.studentCertificate.count({ where: { studentId } })).toBe(0); expect(await db.studentReportCard.count({ where: { studentId } })).toBe(0);
  });

  it("binds a separately provisioned invented Parent session to the imported Guardian and refuses unrelated/revoked scope", async () => {
    // Explicit fixture provisioning is separate from the still-pending import proposal.
    const parent = await actor("PARENT", guardianId);
    const portal = await getParentCertificatePortal(db, parent.user, studentId);
    expect(portal.children.map(child => child.id)).toEqual([studentId]); expect(portal.selectedChild?.id).toBe(studentId);
    expect(portal.requests).toEqual([]); expect(portal.certificates).toEqual([]);
    await expect(getParentCertificatePortal(db, parent.user, "v1-import-control")).rejects.toMatchObject({ status: 403 });
    await db.studentGuardian.deleteMany({ where: { guardianId, studentId } });
    await expect(getParentCertificatePortal(db, parent.user, studentId)).rejects.toMatchObject({ status: 403 });
    await db.authSession.update({ where: { id: parent.sessionId }, data: { revokedAt: new Date() } });
    expect(await resolvePersistedSession(db, parent.cookie)).toBeNull(); expect(await resolvePersistedSession(db, null)).toBeNull();
    expect(await db.student.count()).toBe(2); expect(await db.guardian.count()).toBe(1);
  });
});
