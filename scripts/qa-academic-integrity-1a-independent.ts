import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type User } from "@prisma/client";
import {
  assertNoDelegatedFamilyConflict,
  grantMarksDelegation,
  listMarksDelegationAdministration,
  marksAuthorityAuditContext,
  resolveMarksWriteAuthority,
  revokeMarksDelegation,
  type LegacyMarksDelegationScope,
  type MarksAuthority
} from "../lib/academic-integrity";
import { evaluateEffectivePermission } from "../lib/iam/effective-access";
import type { IamActor } from "../lib/iam/security";
import { createNamedUser, mutateNamedUser } from "../lib/iam/users";
import { hashPassword } from "../lib/password";
import type { Role } from "../lib/permissions";
import { applyMarksImport } from "../lib/marks-import";
import { saveMarkDraft } from "../lib/marks";
import { fileSha256 } from "./migration-check-utils";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.resolve(process.env.ACADEMIC_INTEGRITY_OPERATIONAL_DB ?? path.join(WORKSPACE, "prisma", "dev.db"));
const TMP_PARENT = path.join(WORKSPACE, "tmp", "academic-integrity-1a-qa");
const ROOT = path.join(TMP_PARENT, `AI1AQA-${process.pid}-${randomUUID()}`);
const DATABASE = path.join(ROOT, "academic-integrity-copied.db");
const ACADEMIC_YEAR = "2098-99";
const REASON = "Independent Academic Integrity v1.1 copied database QA";
let activeStage = "preflight";

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function databaseUrl(file: string) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function cleanupRoot() {
  const resolved = path.resolve(ROOT);
  invariant(resolved.startsWith(`${path.resolve(TMP_PARENT)}${path.sep}`), "AI1AQA_CLEANUP_SCOPE_REFUSED");
  if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
  invariant(!existsSync(resolved), "AI1AQA_CLEANUP_INSPECTION_FAILED");
}

type Fixture = {
  user: User;
  roleAssignmentId: string;
  roleAssignmentHandle: string;
  qaCredential: string;
  sessionId: string;
};

async function createFixture(
  client: PrismaClient,
  input: { slug: string; role: Role; extraRoles?: Role[]; guardianId?: string; active?: boolean; lifecycleStatus?: string }
): Promise<Fixture> {
  const qaCredential = `${randomBytes(24).toString("base64url")}Aa1!`;
  const user = await client.user.create({
    data: {
      iamPublicKey: randomUUID(),
      name: `AI1AQA ${input.slug.replaceAll("-", " ")}`,
      designation: input.role.replaceAll("_", " "),
      username: `ai1aqa-${input.slug}-${process.pid}`,
      passwordHash: await hashPassword(qaCredential),
      role: input.role,
      isActive: input.active ?? true,
      lifecycleStatus: input.lifecycleStatus ?? (input.active === false ? "SUSPENDED" : "ACTIVE"),
      guardianId: input.guardianId ?? null
    }
  });
  const assignments = [];
  for (const role of [input.role, ...(input.extraRoles ?? [])]) {
    assignments.push(await client.userRoleAssignment.create({
      data: {
        publicKey: randomUUID(),
        userId: user.id,
        role,
        reason: REASON,
        assignedByUserId: user.id,
        activeKey: `${user.id}:${role}`
      }
    }));
  }
  const session = await client.authSession.create({
    data: {
      userId: user.id,
      tokenHash: randomBytes(32).toString("hex"),
      credentialVersion: user.credentialVersion,
      authorizationVersion: user.authorizationVersion,
      activeRoleAssignmentId: assignments[0].id,
      expiresAt: new Date(Date.now() + 86_400_000),
      deviceSummary: "AI1AQA copied desktop",
      browserSummary: "AI1AQA independent harness",
      networkEvidenceMasked: "local"
    }
  });
  return {
    user,
    roleAssignmentId: assignments[0].id,
    roleAssignmentHandle: assignments[0].publicKey,
    qaCredential,
    sessionId: session.id
  };
}

function marksActor(fixture: Fixture, role = fixture.user.role as Role) {
  return { id: fixture.user.id, name: fixture.user.name, role };
}

function iamActor(fixture: Fixture): IamActor {
  return {
    sessionId: fixture.sessionId,
    user: {
      id: fixture.user.id,
      name: fixture.user.name,
      designation: fixture.user.designation,
      username: fixture.user.username,
      email: fixture.user.email,
      guardianId: fixture.user.guardianId,
      role: fixture.user.role as Role,
      roleAssignmentId: fixture.roleAssignmentId,
      authorizationVersion: fixture.user.authorizationVersion,
      mustChangePassword: fixture.user.mustChangePassword
    }
  };
}

async function expectDenied(work: () => Promise<unknown>, code: string, pattern?: RegExp) {
  try {
    await work();
  } catch (error) {
    if (pattern) invariant(error instanceof Error && pattern.test(error.message), `${code}_WRONG_ERROR`);
    return;
  }
  throw new Error(code);
}

function scopeFrom(assessment: {
  id: string;
  academicYear: string;
  examCycleId: string;
  className: string;
  section: string;
  timetableSubjectId: string | null;
  subjectName: string;
  componentName: string;
  examCycle: { examCode: string };
}): LegacyMarksDelegationScope {
  return {
    kind: "LEGACY_ASSESSMENT",
    academicYear: assessment.academicYear,
    examId: assessment.examCycleId,
    examCode: assessment.examCycle.examCode,
    assessmentId: assessment.id,
    className: assessment.className,
    section: assessment.section,
    subjectId: assessment.timetableSubjectId,
    subjectName: assessment.subjectName,
    componentName: assessment.componentName
  };
}

async function freshSession(client: PrismaClient, fixture: Fixture) {
  const current = await client.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
  const session = await client.authSession.create({
    data: {
      userId: current.id,
      tokenHash: randomBytes(32).toString("hex"),
      credentialVersion: current.credentialVersion,
      authorizationVersion: current.authorizationVersion,
      activeRoleAssignmentId: fixture.roleAssignmentId,
      expiresAt: new Date(Date.now() + 86_400_000),
      deviceSummary: "AI1AQA refreshed desktop",
      browserSummary: "AI1AQA refreshed session",
      networkEvidenceMasked: "local"
    }
  });
  return session.id;
}

async function main() {
  invariant(existsSync(OPERATIONAL_DATABASE), "AI1AQA_OPERATIONAL_DATABASE_NOT_FOUND");
  const operationalBefore = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  mkdirSync(ROOT, { recursive: true });
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  const qaSessionMaterial = randomBytes(48).toString("base64url");
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl(DATABASE),
    AUTH_SECRET: qaSessionMaterial,
    SESSION_SECRET: qaSessionMaterial
  });
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    activeStage = "historical immutability baseline";
    const historicalBefore = digest({
      calculationSnapshots: await client.studentResultSnapshot.findMany({ orderBy: { id: "asc" } }),
      reportPublications: await client.studentReportCard.findMany({ orderBy: { id: "asc" } }),
      reportVersions: await client.studentReportCardVersion.findMany({ orderBy: { id: "asc" } }),
      teacherAudit: await client.studentMarkEvent.findMany({ where: { actorLabel: { contains: "Teacher" } }, orderBy: { id: "asc" } })
    });

    activeStage = "synthetic exact-scope fixtures";
    const guardian = await client.guardian.create({
      data: { iamPublicKey: randomUUID(), displayName: "AI1AQA Guardian Operator", primaryMobile: `8${String(process.pid).padStart(9, "0").slice(-9)}` }
    });
    const childOne = await client.student.create({ data: { academicYear: ACADEMIC_YEAR, admissionNo: `AI1AQA-${process.pid}-CHILD-1`, studentName: "AI1AQA Child One", fatherName: "Synthetic", className: "VIII", section: "A", phone1: "0000000000" } });
    const childTwo = await client.student.create({ data: { academicYear: ACADEMIC_YEAR, admissionNo: `AI1AQA-${process.pid}-CHILD-2`, studentName: "AI1AQA Child Two", fatherName: "Synthetic", className: "VIII", section: "A", phone1: "0000000000" } });
    await client.studentGuardian.create({ data: { guardianId: guardian.id, studentId: childOne.id, isPrimaryContact: true } });
    const volumeStudents = await Promise.all(Array.from({ length: 240 }, async (_, index) => client.student.create({
      data: {
        academicYear: ACADEMIC_YEAR,
        admissionNo: `AI1AQA-${process.pid}-${String(index + 1).padStart(3, "0")}`,
        studentName: `AI1AQA Student ${String(index + 1).padStart(3, "0")}`,
        fatherName: "Synthetic",
        className: "VIII",
        section: index < 120 ? "A" : "B",
        phone1: "0000000000"
      }
    })));
    await client.academicYearEnrollment.createMany({
      data: [childOne, childTwo, ...volumeStudents].map((student) => ({ studentId: student.id, academicYear: ACADEMIC_YEAR, className: student.className, section: student.section, status: "ACTIVE" }))
    });
    const cycle = await client.examCycle.create({
      data: {
        examCode: `AI1AQA-${process.pid}`,
        academicYear: ACADEMIC_YEAR,
        name: "AI1AQA Examination",
        examType: "TERM",
        startDate: new Date("2098-08-01T00:00:00.000Z"),
        endDate: new Date("2098-08-10T00:00:00.000Z"),
        status: "OPEN_FOR_ENTRY"
      }
    });
    const [assessmentA, assessmentB] = await Promise.all([
      client.examAssessment.create({ data: { examCycleId: cycle.id, academicYear: ACADEMIC_YEAR, className: "VIII", section: "A", subjectName: "Mathematics", componentName: "Theory", assessmentType: "WRITTEN", maxMarks: 100, entryStatus: "OPEN" }, include: { examCycle: true } }),
      client.examAssessment.create({ data: { examCycleId: cycle.id, academicYear: ACADEMIC_YEAR, className: "VIII", section: "B", subjectName: "Science", componentName: "Paper I", assessmentType: "WRITTEN", maxMarks: 100, entryStatus: "OPEN" }, include: { examCycle: true } })
    ]);
    const scopeA = scopeFrom(assessmentA);
    const scopeB = scopeFrom(assessmentB);

    const superAdmin = await createFixture(client, { slug: "super-admin", role: "SUPER_ADMIN" });
    const principal = await createFixture(client, { slug: "principal-teacher", role: "PRINCIPAL", extraRoles: ["TEACHER"] });
    const teacher = await createFixture(client, { slug: "teacher", role: "TEACHER" });
    const teacherOperator = await createFixture(client, { slug: "teacher-operator", role: "COMPUTER_OPERATOR", extraRoles: ["TEACHER"] });
    const operator = await createFixture(client, { slug: "operator", role: "COMPUTER_OPERATOR" });
    const viewer = await createFixture(client, { slug: "viewer", role: "VIEWER" });
    const ownChildOperator = await createFixture(client, { slug: "guardian-operator", role: "ADMIN", guardianId: guardian.id });
    const inactiveOperator = await createFixture(client, { slug: "inactive-operator", role: "VIEWER", active: false });
    const deniedRoles = await Promise.all((["DIRECTOR", "ACCOUNTANT", "ADMIN", "PARENT", "STUDENT", "GATE_STAFF"] as Role[]).map((role) => createFixture(client, { slug: `deny-${role.toLowerCase()}`, role })));

    activeStage = "authoritative role matrix";
    invariant((await resolveMarksWriteAuthority(client, marksActor(superAdmin), scopeA)).mode === "LEADERSHIP", "AI1AQA_SUPER_ADMIN_NOT_ALLOWED");
    invariant((await resolveMarksWriteAuthority(client, marksActor(principal), scopeA)).mode === "LEADERSHIP", "AI1AQA_PRINCIPAL_TEACHING_CONTEXT_NOT_ALLOWED");
    await expectDenied(() => resolveMarksWriteAuthority(client, marksActor(teacher), scopeA), "AI1AQA_TEACHER_ALLOWED", /Teacher accounts cannot/);
    await expectDenied(() => resolveMarksWriteAuthority(client, marksActor(teacherOperator), scopeA), "AI1AQA_MULTI_ROLE_TEACHER_ALLOWED", /active Teacher role/);
    await expectDenied(() => resolveMarksWriteAuthority(client, { id: viewer.user.id, name: viewer.user.name, role: "FUTURE_ROLE" as Role }, scopeA), "AI1AQA_FUTURE_ROLE_ALLOWED", /no marks-write authority/);
    for (const fixture of [operator, viewer, ...deniedRoles]) {
      await expectDenied(() => resolveMarksWriteAuthority(client, marksActor(fixture), scopeA), `AI1AQA_BASE_ROLE_ALLOWED_${fixture.user.role}`);
    }

    activeStage = "delegation grant boundary";
    await expectDenied(() => grantMarksDelegation(client, marksActor(deniedRoles.find((fixture) => fixture.user.role === "ADMIN")!), { userHandle: operator.user.iamPublicKey, kind: "LEGACY_ASSESSMENT", targetId: assessmentA.id, reason: REASON }), "AI1AQA_ADMIN_GRANTED_DELEGATION", /Only the Principal or Super Admin/);
    await expectDenied(() => grantMarksDelegation(client, marksActor(principal), { userHandle: teacher.user.iamPublicKey, kind: "LEGACY_ASSESSMENT", targetId: assessmentA.id, reason: REASON }), "AI1AQA_TEACHER_DELEGATION_ALLOWED", /Teacher accounts cannot receive/);
    await expectDenied(() => grantMarksDelegation(client, marksActor(superAdmin), { userHandle: teacherOperator.user.iamPublicKey, kind: "LEGACY_ASSESSMENT", targetId: assessmentA.id, reason: REASON }), "AI1AQA_MULTI_ROLE_TEACHER_DELEGATION_ALLOWED", /Teacher accounts cannot receive/);
    await expectDenied(() => grantMarksDelegation(client, marksActor(principal), { userHandle: inactiveOperator.user.iamPublicKey, kind: "LEGACY_ASSESSMENT", targetId: assessmentA.id, reason: REASON }), "AI1AQA_INACTIVE_OPERATOR_GRANTED", /unavailable/);
    const operatorGrant = await grantMarksDelegation(client, marksActor(principal), { userHandle: operator.user.iamPublicKey, kind: "LEGACY_ASSESSMENT", targetId: assessmentA.id, reason: REASON, validUntil: new Date(Date.now() + 3_600_000).toISOString() });
    const viewerGrant = await grantMarksDelegation(client, marksActor(superAdmin), { userHandle: viewer.user.iamPublicKey, kind: "LEGACY_ASSESSMENT", targetId: assessmentB.id, reason: REASON });
    const ownChildGrant = await grantMarksDelegation(client, marksActor(principal), { userHandle: ownChildOperator.user.iamPublicKey, kind: "LEGACY_ASSESSMENT", targetId: assessmentA.id, reason: REASON });
    invariant((await resolveMarksWriteAuthority(client, marksActor(operator), scopeA)).mode === "DELEGATED", "AI1AQA_EXACT_SCOPE_NOT_ALLOWED");
    invariant((await resolveMarksWriteAuthority(client, marksActor(operator), scopeA, "SUBMIT_MARKS")).mode === "DELEGATED", "AI1AQA_EXACT_SUBMISSION_NOT_ALLOWED");
    await expectDenied(() => resolveMarksWriteAuthority(client, marksActor(operator), scopeB), "AI1AQA_SCOPE_BYPASS_ALLOWED", /exact scope/);
    await expectDenied(() => resolveMarksWriteAuthority(client, marksActor(operator), { ...scopeA, academicYear: "2099-00" }), "AI1AQA_YEAR_TAMPERING_ALLOWED", /exact scope/);
    await expectDenied(() => resolveMarksWriteAuthority(client, marksActor(operator), { ...scopeA, subjectName: "Science" }), "AI1AQA_SUBJECT_TAMPERING_ALLOWED", /exact scope/);
    await expectDenied(() => resolveMarksWriteAuthority(client, marksActor(operator), scopeA, "ENTER_MARKS", new Date(Date.now() + 7_200_000)), "AI1AQA_STALE_EXPIRY_ALLOWED", /exact scope/);
    const administration = await listMarksDelegationAdministration(client, marksActor(superAdmin));
    invariant(administration.delegations.some((item) => item.scopeKey === operatorGrant.scopeKey) && administration.delegations.some((item) => item.scopeKey === viewerGrant.scopeKey), "AI1AQA_DELEGATION_INSPECTION_MISSING");

    activeStage = "generic IAM mass-assignment defence";
    const reserved = await client.permissionProfile.findUniqueOrThrow({ where: { normalizedName: "marks_entry_operator" } });
    await expectDenied(() => createNamedUser(client, iamActor(superAdmin), {
      name: "AI1AQA Forged Profile User", username: `ai1aqa-forged-profile-${process.pid}`, roles: ["VIEWER"], activationMethod: "PENDING", profileHandles: [reserved.publicKey], reason: REASON, reauthPassword: superAdmin.qaCredential
    }), "AI1AQA_RESERVED_PROFILE_MASS_ASSIGNED", /Marks Entry Delegation/);
    await expectDenied(() => createNamedUser(client, iamActor(superAdmin), {
      name: "AI1AQA Forged Override User", username: `ai1aqa-forged-override-${process.pid}`, roles: ["VIEWER"], activationMethod: "PENDING", overrides: [{ permission: "ENTER_MARKS", effect: "ALLOW" }], reason: REASON, reauthPassword: superAdmin.qaCredential
    }), "AI1AQA_MARKS_OVERRIDE_MASS_ASSIGNED", /exact Marks Entry Delegation scope/);
    const operatorCurrent = await client.user.findUniqueOrThrow({ where: { id: operator.user.id } });
    await expectDenied(() => mutateNamedUser(client, iamActor(superAdmin), operator.user.iamPublicKey!, {
      action: "ASSIGN_PROFILE", profileHandle: reserved.publicKey, reason: REASON, reauthPassword: superAdmin.qaCredential, expectedVersion: operatorCurrent.version
    }), "AI1AQA_RESERVED_PROFILE_DIRECT_ASSIGNED", /Marks Entry Delegation/);
    await expectDenied(() => mutateNamedUser(client, iamActor(superAdmin), operator.user.iamPublicKey!, {
      action: "SET_OVERRIDE", permission: "ENTER_MARKS", effect: "ALLOW", reason: REASON, reauthPassword: superAdmin.qaCredential, expectedVersion: operatorCurrent.version
    }), "AI1AQA_MARKS_OVERRIDE_DIRECT_ASSIGNED", /exact Marks Entry Delegation scope/);

    activeStage = "high-volume exact-scope mutation";
    const authority = await resolveMarksWriteAuthority(client, marksActor(operator), scopeA);
    const sectionAStudents = [childOne, childTwo, ...volumeStudents.slice(0, 120)];
    const firstVersion = await client.examAssessment.findUniqueOrThrow({ where: { id: assessmentA.id }, select: { updatedAt: true } });
    const volumeStart = performance.now();
    const saved = await saveMarkDraft(client, assessmentA.id, sectionAStudents.map((student, index) => ({ admissionNumber: student.admissionNo, entryStatus: index % 17 === 0 ? "ABSENT" : "PRESENT", marksObtained: index % 17 === 0 ? "" : String(index % 101), remarks: "Synthetic QA" })), firstVersion.updatedAt.toISOString(), { id: operator.user.id, name: operator.user.name, auditContext: marksAuthorityAuditContext(authority) });
    const volumeMs = Math.round(performance.now() - volumeStart);
    invariant(saved.created === sectionAStudents.length && volumeMs < 30_000, "AI1AQA_HIGH_VOLUME_SAVE_FAILED");
    invariant(await client.studentMark.count({ where: { assessmentId: assessmentB.id } }) === 0, "AI1AQA_CROSS_SCOPE_MARK_LEAK");

    activeStage = "own-child deterministic defence";
    const ownChildAuthority = await resolveMarksWriteAuthority(client, marksActor(ownChildOperator), scopeA);
    const childOneBefore = await client.studentMark.findUniqueOrThrow({ where: { assessmentId_studentId: { assessmentId: assessmentA.id, studentId: childOne.id } } });
    const childTwoBefore = await client.studentMark.findUniqueOrThrow({ where: { assessmentId_studentId: { assessmentId: assessmentA.id, studentId: childTwo.id } } });
    await expectDenied(() => assertNoDelegatedFamilyConflict(client, marksActor(ownChildOperator), [childOne.id, childTwo.id], ownChildAuthority, `legacy:${assessmentA.id}`), "AI1AQA_LINKED_CHILD_ALLOWED", /own linked child/);
    invariant((await client.studentMark.findUniqueOrThrow({ where: { id: childOneBefore.id } })).updatedAt.valueOf() === childOneBefore.updatedAt.valueOf(), "AI1AQA_LINKED_CHILD_MIXED_BATCH_CHANGED");
    await assertNoDelegatedFamilyConflict(client, marksActor(ownChildOperator), [childTwo.id], ownChildAuthority, `legacy:${assessmentA.id}`);
    const ownChildVersion = await client.examAssessment.findUniqueOrThrow({ where: { id: assessmentA.id }, select: { updatedAt: true } });
    await saveMarkDraft(client, assessmentA.id, [{ admissionNumber: childTwo.admissionNo, entryStatus: "PRESENT", marksObtained: "77", remarks: "Unrelated student allowed" }], ownChildVersion.updatedAt.toISOString(), { id: ownChildOperator.user.id, name: ownChildOperator.user.name, auditContext: marksAuthorityAuditContext(ownChildAuthority) });
    invariant((await client.studentMark.findUniqueOrThrow({ where: { id: childTwoBefore.id } })).marksObtained?.toString() === "77", "AI1AQA_UNRELATED_CHILD_NOT_ALLOWED");

    activeStage = "import security";
    const csvHeader = "examCode,className,section,subjectName,componentName,admissionNumber,marksObtained,entryStatus,remarks";
    const operatorUser = { id: operator.user.id, name: operator.user.name, role: "COMPUTER_OPERATOR" as Role } as any;
    const exactCsv = `${csvHeader}\n${cycle.examCode},VIII,A,Mathematics,Theory,${volumeStudents[0].admissionNo},88,PRESENT,Synthetic import\n`;
    const exactImport = await applyMarksImport(client, operatorUser, exactCsv, { id: operator.user.id, name: operator.user.name });
    invariant(exactImport.total === 1, "AI1AQA_EXACT_IMPORT_FAILED");
    const outsideCsv = `${csvHeader}\n${cycle.examCode},VIII,B,Science,Paper I,${volumeStudents[120].admissionNo},88,PRESENT,Synthetic import\n`;
    await expectDenied(() => applyMarksImport(client, operatorUser, outsideCsv, { id: operator.user.id, name: operator.user.name }), "AI1AQA_OUT_OF_SCOPE_IMPORT_ALLOWED", /failed preview validation/);
    await expectDenied(() => applyMarksImport(client, { id: teacher.user.id, name: teacher.user.name, role: "TEACHER" } as any, exactCsv, { id: teacher.user.id, name: teacher.user.name }), "AI1AQA_TEACHER_IMPORT_ALLOWED", /failed preview validation/);
    const linkedCsv = `${csvHeader}\n${cycle.examCode},VIII,A,Mathematics,Theory,${childOne.admissionNo},66,PRESENT,Linked child\n${cycle.examCode},VIII,A,Mathematics,Theory,${childTwo.admissionNo},66,PRESENT,Unrelated child\n`;
    await expectDenied(() => applyMarksImport(client, { id: ownChildOperator.user.id, name: ownChildOperator.user.name, role: "ADMIN" } as any, linkedCsv, { id: ownChildOperator.user.id, name: ownChildOperator.user.name }), "AI1AQA_LINKED_CHILD_IMPORT_ALLOWED", /own linked child/);

    activeStage = "optimistic concurrency";
    const concurrentVersion = await client.examAssessment.findUniqueOrThrow({ where: { id: assessmentA.id }, select: { updatedAt: true } });
    const concurrentRows = [
      saveMarkDraft(client, assessmentA.id, [{ admissionNumber: volumeStudents[1].admissionNo, entryStatus: "PRESENT", marksObtained: "61", remarks: "Concurrent A" }], concurrentVersion.updatedAt.toISOString(), { id: operator.user.id, name: operator.user.name }),
      saveMarkDraft(client, assessmentA.id, [{ admissionNumber: volumeStudents[1].admissionNo, entryStatus: "PRESENT", marksObtained: "62", remarks: "Concurrent B" }], concurrentVersion.updatedAt.toISOString(), { id: principal.user.id, name: principal.user.name })
    ];
    const concurrent = await Promise.allSettled(concurrentRows);
    invariant(concurrent.filter((item) => item.status === "fulfilled").length === 1 && concurrent.filter((item) => item.status === "rejected").length === 1, "AI1AQA_CONCURRENT_LOST_UPDATE_NOT_BLOCKED");
    invariant(await client.studentMark.count({ where: { assessmentId: assessmentA.id, studentId: volumeStudents[1].id } }) === 1, "AI1AQA_CONCURRENT_DUPLICATE_MARK");

    activeStage = "session revocation";
    const refreshedSessionId = await freshSession(client, operator);
    const activeDecision = await evaluateEffectivePermission(client, { userId: operator.user.id, sessionId: refreshedSessionId, roleAssignmentId: operator.roleAssignmentId, permission: "ENTER_MARKS", objectScopeSatisfied: true });
    invariant(activeDecision.allowed && activeDecision.source === "PROFILE_ALLOW", "AI1AQA_REFRESHED_DELEGATED_SESSION_NOT_ALLOWED");
    await revokeMarksDelegation(client, marksActor(superAdmin), { assignmentHandle: operatorGrant.assignmentHandle, scopeKey: operatorGrant.scopeKey, reason: "Independent QA immediate revocation" });
    const revokedSession = await client.authSession.findUniqueOrThrow({ where: { id: refreshedSessionId } });
    invariant(Boolean(revokedSession.revokedAt) && revokedSession.revocationReason === "MARKS_DELEGATION_REVOKED", "AI1AQA_SESSION_NOT_REVOKED");
    const staleDecision = await evaluateEffectivePermission(client, { userId: operator.user.id, sessionId: refreshedSessionId, roleAssignmentId: operator.roleAssignmentId, permission: "ENTER_MARKS", objectScopeSatisfied: true });
    invariant(!staleDecision.allowed && staleDecision.source === "SESSION", "AI1AQA_STALE_SESSION_RETAINED_PERMISSION");
    await expectDenied(() => resolveMarksWriteAuthority(client, marksActor(operator), scopeA), "AI1AQA_REVOKED_SCOPE_STILL_ALLOWED", /exact scope/);

    activeStage = "audit and immutable history verification";
    invariant(await client.userAudit.count({ where: { action: "MARKS_ENTRY_DELEGATION_GRANTED" } }) >= 3, "AI1AQA_GRANT_AUDIT_MISSING");
    invariant(await client.userAudit.count({ where: { action: "MARKS_ENTRY_DELEGATION_REVOKED" } }) >= 1, "AI1AQA_REVOKE_AUDIT_MISSING");
    invariant(await client.authSecurityEvent.count({ where: { eventType: "MARKS_DELEGATION_FAMILY_CONFLICT_DENIED" } }) >= 2, "AI1AQA_FAMILY_DENIAL_AUDIT_MISSING");
    invariant(await client.authSecurityEvent.count({ where: { eventType: "MARKS_WRITE_AUTHORITY_DENIED" } }) >= 1, "AI1AQA_SCOPE_DENIAL_AUDIT_MISSING");
    const event = await client.authSecurityEvent.findFirstOrThrow({ where: { eventType: "MARKS_WRITE_AUTHORITY_DENIED" }, orderBy: { createdAt: "desc" } });
    invariant(!String(event.detailsJson).includes("AI1AQA Student") && !String(event.detailsJson).includes("Mathematics"), "AI1AQA_DENIAL_AUDIT_EXPOSES_STUDENT_SCOPE");
    const historicalAfter = digest({
      calculationSnapshots: await client.studentResultSnapshot.findMany({ orderBy: { id: "asc" } }),
      reportPublications: await client.studentReportCard.findMany({ orderBy: { id: "asc" } }),
      reportVersions: await client.studentReportCardVersion.findMany({ orderBy: { id: "asc" } }),
      teacherAudit: await client.studentMarkEvent.findMany({ where: { actorLabel: { contains: "Teacher" } }, orderBy: { id: "asc" } })
    });
    invariant(historicalBefore === historicalAfter, "AI1AQA_HISTORICAL_RECORDS_CHANGED");

    const operationalAfter = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
    invariant(operationalBefore.sha256 === operationalAfter.sha256 && operationalBefore.size === operationalAfter.size, "AI1AQA_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({
      result: "ACADEMIC_INTEGRITY_1A_INDEPENDENT_QA_PASSED",
      operationalDatabase: operationalAfter,
      copiedDatabase: true,
      roleMatrix: { superAdmin: "ALLOW", principal: "ALLOW", teacher: "DENY", futureRole: "DENY", multiRoleTeacher: "DENY" },
      exactScopes: 2,
      highVolumeStudents: sectionAStudents.length,
      highVolumeSaveMs: volumeMs,
      linkedChild: "DENY",
      unrelatedChild: "ALLOW",
      genericIamBypass: "DENY",
      staleSessionAfterRevoke: "DENY",
      concurrency: "ONE_SUCCESS_ONE_REJECTED",
      noMigrationRequired: true,
      historicalRecords: "BYTE_LOGICALLY_IDENTICAL"
    }));
  } finally {
    await client.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ result: "ACADEMIC_INTEGRITY_1A_INDEPENDENT_QA_FAILED", stage: activeStage, error: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  })
  .finally(() => {
    cleanupRoot();
    cleanupRoot();
  });
