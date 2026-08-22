import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { hashPassword } from "../lib/password";
import { generateOnboardingTemplate } from "../lib/onboarding-workbooks";
import { sha256, storeOnboardingWorkbook } from "../lib/onboarding-storage";
import { approveOnboardingBatch, executeOnboardingBatch, rollbackOnboardingBatch, validateStoredBatch } from "../lib/onboarding";
import { generateFullBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import type { IamActor } from "../lib/iam/security";

const RESTORE_URL = process.env.IMPORT1A_RESTORE_DATABASE_URL;
const QA_PASSWORD = process.env.IMPORT1A_QA_PASSWORD || "Import1a-QA-Only!2026";
const PREFIX = `${process.env.IMPORT1A_FIXTURE_PREFIX || "IMPORT1A"}-${Date.now()}`;
if (!RESTORE_URL) throw new Error("IMPORT1A_RESTORE_DATABASE_URL_REQUIRED");

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

async function main() {
  const source = new PrismaClient();
  const target = new PrismaClient({ datasourceUrl: RESTORE_URL });
  try {
    invariant(await source.student.count() === 0, "IMPORT1A_SOURCE_MUST_START_WITH_ZERO_STUDENTS");
    invariant(await source.payment.count() === 0, "IMPORT1A_SOURCE_MUST_START_WITH_ZERO_PAYMENTS");
    const protectedUsers = await source.user.count();
    const protectedAssignments = await source.userRoleAssignment.count();
    const actors = await createActors(source);
    await source.timetableClassSection.upsert({ where: { academicYear_className_section: { academicYear: "2026-27", className: "I", section: "A" } }, create: { academicYear: "2026-27", className: "I", section: "A", displayName: "Class I A", groupName: "PRIMARY", isActive: true }, update: { isActive: true } });
    await source.staffMember.create({ data: { staffCode: `${PREFIX}-REF`, fullName: `${PREFIX} Reference Staff`, staffType: "TEACHING", designation: "Teacher", department: "Academics", status: "ACTIVE" } });

    const usersBefore = await source.user.count();
    const first = await createBatch(source, actors.director.user.id, "COMBINED", false);
    const firstPlan = await validateStoredBatch(source, first.publicKey, actors.director.user.id);
    invariant(firstPlan.status === "APPROVAL_REQUIRED" && firstPlan.plan?.blockingErrorCount === 0, "IMPORT1A_FIRST_PLAN_NOT_APPROVABLE");

    let principalScopeRefused = false;
    try {
      await approveOnboardingBatch(source, first.publicKey, actors.principal, approvalInput(firstPlan));
    } catch (error) {
      principalScopeRefused = error instanceof Error && error.message.includes("Principal approval is limited");
    }
    invariant(principalScopeRefused, "IMPORT1A_PRINCIPAL_STAFF_SCOPE_NOT_REFUSED");

    const approved = await approveOnboardingBatch(source, first.publicKey, actors.director, approvalInput(firstPlan));
    const executionInput = { reason: "Copied database synthetic execution proof", reauthPassword: QA_PASSWORD, planHash: String(approved.planHash), workbookHash: approved.workbookHash, idempotencyKey: `${PREFIX.replaceAll("-", "")}EXECUTION001` };
    const executed = await executeOnboardingBatch(source, first.publicKey, actors.director, executionInput);
    invariant(executed.status === "COMPLETED", "IMPORT1A_FIRST_EXECUTION_NOT_COMPLETED");
    const afterExecution = await businessCounts(source);
    invariant(afterExecution.students === 1 && afterExecution.guardians === 1 && afterExecution.links === 1 && afterExecution.enrollments === 1 && afterExecution.staff === 2, "IMPORT1A_EXECUTION_COUNTS_INVALID");
    invariant(await source.user.count() === usersBefore, "IMPORT1A_ACCOUNT_PROPOSAL_ACTIVATED_USER");
    invariant(await source.onboardingRowOutcome.count({ where: { batchId: first.id, entityType: "ACCOUNT_PROPOSAL", status: "PENDING_ACTIVATION" } }) === 2, "IMPORT1A_PENDING_ACCOUNT_PROPOSALS_MISSING");

    const replay = await executeOnboardingBatch(source, first.publicKey, actors.director, executionInput);
    invariant(replay.status === "COMPLETED" && JSON.stringify(await businessCounts(source)) === JSON.stringify(afterExecution), "IMPORT1A_IDEMPOTENT_REPLAY_CHANGED_COUNTS");

    const atomic = await createBatch(source, actors.director.user.id, "STUDENT_GUARDIAN", true);
    const atomicPlan = await validateStoredBatch(source, atomic.publicKey, actors.director.user.id, {
      "STU-ATOMIC": { decision: "LINK_EXISTING", reason: "Exact admission number links to the synthetic Student" }
    });
    invariant(atomicPlan.status === "APPROVAL_REQUIRED", "IMPORT1A_ATOMIC_PLAN_NOT_APPROVABLE");
    const atomicApproved = await approveOnboardingBatch(source, atomic.publicKey, actors.principal, approvalInput(atomicPlan));
    const beforeAtomic = await businessCounts(source);
    let atomicFailure = false;
    try {
      await executeOnboardingBatch(source, atomic.publicKey, actors.director, { reason: "Copied database atomic rollback proof", reauthPassword: QA_PASSWORD, planHash: String(atomicApproved.planHash), workbookHash: atomicApproved.workbookHash, idempotencyKey: `${PREFIX.replaceAll("-", "")}ATOMICFAIL001` });
    } catch (error) {
      atomicFailure = error instanceof Error && error.message.includes("enrollment already exists");
    }
    invariant(atomicFailure, "IMPORT1A_EXPECTED_ATOMIC_FAILURE_MISSING");
    invariant(JSON.stringify(await businessCounts(source)) === JSON.stringify(beforeAtomic), "IMPORT1A_FAILED_EXECUTION_LEFT_PARTIAL_ROWS");
    invariant(await source.onboardingRowOutcome.count({ where: { batchId: atomic.id } }) === 0, "IMPORT1A_FAILED_EXECUTION_LEFT_LINEAGE");

    const preview = await rollbackOnboardingBatch(source, first.publicKey, actors.director, { reason: "Copied database rollback dependency preview", reauthPassword: QA_PASSWORD, execute: false }) as { eligible: boolean };
    invariant(preview.eligible === true, "IMPORT1A_ROLLBACK_PREVIEW_NOT_ELIGIBLE");
    const rolled = await rollbackOnboardingBatch(source, first.publicKey, actors.director, { reason: "Copied database exact rollback execution", reauthPassword: QA_PASSWORD, execute: true }) as { status: string };
    invariant(rolled.status === "ROLLED_BACK", "IMPORT1A_ROLLBACK_NOT_COMPLETED");
    const afterRollback = await businessCounts(source);
    invariant(afterRollback.students === 0 && afterRollback.guardians === 0 && afterRollback.links === 0 && afterRollback.enrollments === 0 && afterRollback.staff === 1, "IMPORT1A_ROLLBACK_COUNTS_INVALID");

    const backup = parseAndValidateBackup(await generateFullBackup(source as never, { generatedBy: "IMPORT1A copied database QA" }));
    const serialized = JSON.stringify(backup);
    invariant(backup.metadata.backupVersion === 42 && backup.onboardingBatches.length === 2, "IMPORT1A_BACKUP_METADATA_MISSING");
    invariant(!serialized.includes("private-workbook") && !serialized.includes(QA_PASSWORD) && !serialized.includes("Copied database synthetic execution proof"), "IMPORT1A_BACKUP_PRIVATE_VALUE_LEAK");

    const targetActor = await ensureRestoreActor(target);
    const firstRestore = await restoreValidatedBackup(target, backup, targetActor);
    const restoredOnce = await onboardingCounts(target);
    const secondRestore = await restoreValidatedBackup(target, backup, targetActor);
    const restoredTwice = await onboardingCounts(target);
    invariant(firstRestore.onboardingBatches.errors.length === 0 && secondRestore.onboardingBatches.errors.length === 0, "IMPORT1A_RESTORE_ERRORS");
    invariant(JSON.stringify(restoredOnce) === JSON.stringify(restoredTwice), "IMPORT1A_RESTORE_NOT_IDEMPOTENT");
    invariant(restoredTwice.batches === 2 && restoredTwice.recoveryRequired === 2, "IMPORT1A_RESTORE_RECOVERY_STATE_INVALID");
    const integrity = await target.$queryRawUnsafe<Array<Record<string, string>>>("PRAGMA quick_check");
    const foreignKeys = await target.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
    invariant(integrity.every((row) => Object.values(row).includes("ok")) && foreignKeys.length === 0, "IMPORT1A_RESTORE_INTEGRITY_FAILED");

    const editedBatch = await createBatch(source, actors.director.user.id, "COMBINED", false, "EDIT");
    const editedPlan = await validateStoredBatch(source, editedBatch.publicKey, actors.director.user.id);
    const editedApproved = await approveOnboardingBatch(source, editedBatch.publicKey, actors.director, approvalInput(editedPlan));
    await executeOnboardingBatch(source, editedBatch.publicKey, actors.director, { reason: "Copied database manual edit rollback blocker", reauthPassword: QA_PASSWORD, planHash: String(editedApproved.planHash), workbookHash: editedApproved.workbookHash, idempotencyKey: `${PREFIX.replaceAll("-", "")}EDITBLOCK001` });
    const editedStaffOutcome = await source.onboardingRowOutcome.findFirstOrThrow({ where: { batchId: editedBatch.id, entityType: "STAFF", action: "CREATE" } });
    await source.staffMember.update({ where: { id: editedStaffOutcome.targetRecordId! }, data: { notes: "Later manual edit blocks automatic rollback" } });
    const editedPreview = await rollbackOnboardingBatch(source, editedBatch.publicKey, actors.director, { reason: "Copied database manual edit dependency preview", reauthPassword: QA_PASSWORD, execute: false }) as { eligible: boolean; dependencies: string[] };
    invariant(!editedPreview.eligible && editedPreview.dependencies.includes("MANUAL_EDIT_OR_MISSING:STAFF"), "IMPORT1A_MANUAL_EDIT_ROLLBACK_NOT_BLOCKED");
    invariant(await source.staffMember.count({ where: { id: editedStaffOutcome.targetRecordId! } }) === 1, "IMPORT1A_BLOCKED_ROLLBACK_DELETED_STAFF");

    invariant(await source.user.count() === protectedUsers + 2 && await source.userRoleAssignment.count() === protectedAssignments + 2, "IMPORT1A_PROTECTED_ACCOUNT_BASELINE_CHANGED");
    const stress = process.env.IMPORT1A_STRESS === "true" ? await runStressBatch(source, actors.director) : null;
    console.log(JSON.stringify({ status: "IMPORT1A_COPIED_DATABASE_PASSED", principalScopeRefused, atomicRollback: true, idempotentReplay: true, exactRollback: true, manualEditBlocked: true, activeAccountsCreatedByImport: 0, restored: restoredTwice, backupVersion: backup.metadata.backupVersion, privacySafe: true, stress }));
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
  }
}

async function createActors(client: PrismaClient) {
  const passwordHash = await hashPassword(QA_PASSWORD);
  const result: Record<string, IamActor> = {};
  for (const role of ["DIRECTOR", "PRINCIPAL"] as const) {
    const id = `${PREFIX}-${role.toLowerCase()}`;
    const user = await client.user.create({ data: { id, name: `${PREFIX} ${role}`, username: id.toLowerCase(), passwordHash, role, isActive: true, lifecycleStatus: "ACTIVE", designation: role } });
    const assignment = await client.userRoleAssignment.create({ data: { id: `${id}-assignment`, publicKey: `${PREFIX}-${role.toLowerCase()}-assignment`, userId: user.id, role, status: "ACTIVE", reason: "IMPORT1A copied-database synthetic actor", assignedByUserId: user.id, activeKey: `${user.id}:${role}` } });
    result[role.toLowerCase()] = { sessionId: `${id}-session`, user: { id: user.id, name: user.name, username: user.username, email: user.email, designation: user.designation, role, roleAssignmentId: assignment.id, authorizationVersion: user.authorizationVersion, mustChangePassword: user.mustChangePassword, guardianId: null } };
  }
  return result as { director: IamActor; principal: IamActor };
}

async function ensureRestoreActor(client: PrismaClient) {
  const existing = await client.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, name: true } });
  if (existing) return existing;
  const id = `${PREFIX}-restore-super-admin`;
  return client.user.create({
    data: {
      id,
      name: `${PREFIX} Restore Super Admin`,
      username: `${PREFIX.toLowerCase()}-restore-admin`,
      passwordHash: await hashPassword(QA_PASSWORD),
      role: "SUPER_ADMIN",
      isActive: true,
      lifecycleStatus: "ACTIVE",
      designation: "SUPER_ADMIN"
    },
    select: { id: true, name: true }
  });
}

async function createBatch(client: PrismaClient, actorUserId: string, bundle: "COMBINED" | "STUDENT_GUARDIAN", conflict: boolean, variant = "BASE") {
  const bytes = populatedWorkbook(bundle, conflict, variant);
  const stored = await storeOnboardingWorkbook(bytes);
  return client.onboardingBatch.create({ data: { bundleType: bundle, uploadedByUserId: actorUserId, originalFileNameHash: sha256(`${PREFIX}-${bundle}-${conflict}-${variant}`), storageKey: stored.storageKey, workbookSha256: stored.sha256, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize: bytes.length, templateVersion: "1.0", schemaVersion: "IMPORT-1A-2026-08-10", purgeAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), auditEvents: { create: { sequence: 1, eventType: "UPLOADED", newStatus: "UPLOADED", actorUserId, evidenceHash: stored.sha256 } } } });
}

function populatedWorkbook(bundle: "COMBINED" | "STUDENT_GUARDIAN", conflict: boolean, variant = "BASE") {
  const generated = generateOnboardingTemplate({ bundle, generatedAt: new Date(variant === "BASE" ? "2026-08-10T12:00:00.000Z" : "2026-08-10T12:00:01.000Z"), academicYears: ["2026-27"], classes: [{ academicYear: "2026-27", className: "I", section: "A" }], departments: ["Academics"], designations: ["Teacher"] });
  const wb = XLSX.read(generated, { type: "buffer" });
  const studentKey = conflict ? "STU-ATOMIC" : "STU-001";
  XLSX.utils.sheet_add_aoa(wb.Sheets.Students, [[studentKey, `${PREFIX}-ADM-001`, `${PREFIX} विद्यार्थी`, `${PREFIX} Guardian`, `${PREFIX} والدہ`, "9876543210", "", "2016-01-31", "2026-27", "I", "A", "1", "ACTIVE", "Synthetic copied database only", "NO"]], { origin: "A2" });
  const guardianKey = conflict ? "GUA-ATOMIC" : "GUA-001";
  XLSX.utils.sheet_add_aoa(wb.Sheets.Guardians, [[guardianKey, `${PREFIX} Guardian ${conflict ? "Atomic" : "One"}`, "Father", conflict ? "9876543212" : "9876543211", "", "", "MOBILE", conflict ? "NO" : "YES", "NO"]], { origin: "A2" });
  XLSX.utils.sheet_add_aoa(wb.Sheets["Student-Guardian Links"], [[conflict ? "LNK-ATOMIC" : "LNK-001", studentKey, guardianKey, "Father", "YES", "YES", "YES", "NO"]], { origin: "A2" });
  XLSX.utils.sheet_add_aoa(wb.Sheets.Enrollments, [[conflict ? "ENR-ATOMIC" : "ENR-001", studentKey, "2026-27", "I", "A", "1", "2026-06-01", "ACTIVE", "NO"]], { origin: "A2" });
  if (bundle === "COMBINED") XLSX.utils.sheet_add_aoa(wb.Sheets.Staff, [["STF-001", `${PREFIX}-EMP-001`, `${PREFIX} Teacher`, "TEACHING", "Teacher", "Academics", "2026-06-01", "", "", "9876543213", "TEACHER", "YES", "ACTIVE", "Synthetic copied database only", "NO"]], { origin: "A2" });
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }));
}

function approvalInput(batch: any) {
  return { reason: "Copied database synthetic approval proof", reauthPassword: QA_PASSWORD, planHash: String(batch.planHash), workbookHash: String(batch.workbookHash) };
}

async function businessCounts(client: PrismaClient) {
  const [students, guardians, links, enrollments, staff] = await Promise.all([client.student.count(), client.guardian.count(), client.studentGuardian.count(), client.academicYearEnrollment.count(), client.staffMember.count()]);
  return { students, guardians, links, enrollments, staff };
}

async function onboardingCounts(client: PrismaClient) {
  const [batches, recoveryRequired, outcomes, audits] = await Promise.all([client.onboardingBatch.count(), client.onboardingBatch.count({ where: { status: "RECOVERY_REQUIRED" } }), client.onboardingRowOutcome.count(), client.onboardingAuditEvent.count()]);
  return { batches, recoveryRequired, outcomes, audits };
}

async function runStressBatch(client: PrismaClient, actor: IamActor) {
  const profile = process.env.IMPORT1A_SCALE_PROFILE === "V1_FINAL"
    ? { name: "V1_FINAL", students: 800, guardians: 1200, staff: 80, teachers: 45, enrollmentsPerStudent: 2 }
    : { name: "LEGACY_STRESS", students: 1000, guardians: 1500, staff: 100, teachers: 100, enrollmentsPerStudent: 1 };
  if (profile.name === "V1_FINAL") {
    const academicYears = ["2025-26", "2026-27"], classNames = ["I","II","III","IV","V","VI","VII","VIII","IX","X"], sections = ["A","B","C","D"];
    for (const academicYear of academicYears) for (const className of classNames) for (const section of sections) await client.timetableClassSection.upsert({
      where: { academicYear_className_section: { academicYear, className, section } },
      create: { academicYear, className, section, displayName: `${className} ${section} ${academicYear}`, groupName: "V1_FINAL_SYNTHETIC", isActive: true },
      update: { isActive: true }
    });
    await client.staffMember.create({ data: { staffCode: `${PREFIX}-NONTEACHING-REF`, fullName: `${PREFIX} Non-teaching Reference`, staffType: "NON_TEACHING", designation: "Office Assistant", department: "Administration", status: "ACTIVE" } });
  }
  const before = await businessCounts(client);
  const bytes = stressWorkbook(profile);
  const stored = await storeOnboardingWorkbook(bytes);
  const batch = await client.onboardingBatch.create({ data: { bundleType: "COMBINED", uploadedByUserId: actor.user.id, originalFileNameHash: sha256(`${PREFIX}-STRESS`), storageKey: stored.storageKey, workbookSha256: stored.sha256, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize: bytes.length, templateVersion: "1.0", schemaVersion: "IMPORT-1A-2026-08-10", purgeAfter: new Date(Date.now() + 24 * 60 * 60 * 1000), auditEvents: { create: { sequence: 1, eventType: "UPLOADED", newStatus: "UPLOADED", actorUserId: actor.user.id, evidenceHash: stored.sha256 } } } });
  const planned = await validateStoredBatch(client, batch.publicKey, actor.user.id);
  const expectedOutcomes = profile.students + profile.guardians + profile.staff + profile.students + profile.students * profile.enrollmentsPerStudent;
  const issueCodes = Object.entries((planned.issues ?? []).reduce((counts: Record<string, number>, issue: any) => ({ ...counts, [issue.code]: (counts[issue.code] ?? 0) + 1 }), {})).sort((a,b) => b[1] - a[1]).slice(0, 8);
  invariant(planned.status === "APPROVAL_REQUIRED" && planned.plan?.estimatedExecutionSize === expectedOutcomes && planned.plan?.blockingErrorCount === 0, `IMPORT1A_STRESS_PLAN_INVALID:${JSON.stringify({ status: planned.status, estimatedExecutionSize: planned.plan?.estimatedExecutionSize, blockingErrorCount: planned.plan?.blockingErrorCount, expectedOutcomes, issueCodes })}`);
  const approved = await approveOnboardingBatch(client, batch.publicKey, actor, approvalInput(planned));
  const input = { reason: "Copied database specified scale execution proof", reauthPassword: QA_PASSWORD, planHash: String(approved.planHash), workbookHash: approved.workbookHash, idempotencyKey: `${PREFIX.replaceAll("-", "")}STRESS001` };
  const startedAt = Date.now();
  const executed = await executeOnboardingBatch(client, batch.publicKey, actor, input);
  invariant(executed.result?.students === profile.students && executed.result?.guardians === profile.guardians && executed.result?.staff === profile.staff && executed.result?.links === profile.students && executed.result?.enrollments === profile.students * profile.enrollmentsPerStudent, "IMPORT1A_STRESS_EXECUTION_COUNTS_INVALID");
  const outcomes = await client.onboardingRowOutcome.count({ where: { batchId: batch.id, status: "COMPLETED" } });
  invariant(outcomes === expectedOutcomes, "IMPORT1A_STRESS_LINEAGE_COUNT_INVALID");
  const cohorts = await client.academicYearEnrollment.findMany({ where: { student: { admissionNo: { startsWith: `${PREFIX}-STRESS-ADM-` } } }, select: { academicYear: true, className: true, section: true }, distinct: ["academicYear", "className", "section"] });
  const teachers = await client.staffMember.count({ where: { staffCode: { startsWith: `${PREFIX}-STRESS-EMP-` }, staffType: "TEACHING", designation: "Teacher" } });
  const siblingGroups = (await client.studentGuardian.groupBy({ by: ["guardianId"], where: { student: { admissionNo: { startsWith: `${PREFIX}-STRESS-ADM-` } } }, _count: { studentId: true } })).map((row) => row._count.studentId);
  if (profile.name === "V1_FINAL") invariant(cohorts.length === 80 && teachers === 45 && [2,3,4].every((count) => siblingGroups.includes(count)), "IMPORT1A_V1_FINAL_SCALE_SHAPE_INVALID");
  const after = await businessCounts(client);
  await executeOnboardingBatch(client, batch.publicKey, actor, input);
  invariant(JSON.stringify(await businessCounts(client)) === JSON.stringify(after), "IMPORT1A_STRESS_REPLAY_CHANGED_COUNTS");
  const performance = profile.name === "V1_FINAL" ? await runV1FinalPerformanceProfile(client) : null;
  const preview = await rollbackOnboardingBatch(client, batch.publicKey, actor, { reason: "Copied database specified scale rollback preview", reauthPassword: QA_PASSWORD, execute: false }) as { eligible: boolean };
  invariant(preview.eligible, "IMPORT1A_STRESS_ROLLBACK_PREVIEW_BLOCKED");
  await rollbackOnboardingBatch(client, batch.publicKey, actor, { reason: "Copied database specified scale exact rollback", reauthPassword: QA_PASSWORD, execute: true });
  invariant(JSON.stringify(await businessCounts(client)) === JSON.stringify(before), "IMPORT1A_STRESS_ROLLBACK_NOT_EXACT");
  return { profile: profile.name, students: profile.students, guardians: profile.guardians, staff: profile.staff, teachers, links: profile.students, enrollments: profile.students * profile.enrollmentsPerStudent, academicYears: profile.enrollmentsPerStudent, cohorts: cohorts.length, siblingGuardianGroups: [2,3,4], outcomes, replay: "IDEMPOTENT", rollback: "EXACT", performance, elapsedMs: Date.now() - startedAt };
}

async function runV1FinalPerformanceProfile(client: PrismaClient) {
  const reads: number[] = [], writes: number[] = [];
  const cpuStart = process.cpuUsage(), memoryStart = process.memoryUsage();
  let errors = 0, sqliteBusy = 0;
  for (let index = 0; index < 120; index += 1) {
    const started = performance.now();
    try {
      if (index % 2) await client.student.count({ where: { admissionNo: { startsWith: `${PREFIX}-STRESS-ADM-` } } });
      else await client.academicYearEnrollment.findMany({ where: { student: { admissionNo: { startsWith: `${PREFIX}-STRESS-ADM-` } } }, select: { academicYear: true, className: true, section: true }, take: 50, skip: index % 16 });
    } catch (error) {
      errors += 1;
      if (String(error).includes("SQLITE_BUSY")) sqliteBusy += 1;
    } finally { reads.push(performance.now() - started); }
  }
  for (let index = 0; index < 30; index += 1) {
    const started = performance.now();
    try {
      await client.staffMember.update({ where: { staffCode: `${PREFIX}-NONTEACHING-REF` }, data: { notes: `${PREFIX}-PERF-${index}` } });
    } catch (error) {
      errors += 1;
      if (String(error).includes("SQLITE_BUSY")) sqliteBusy += 1;
    } finally { writes.push(performance.now() - started); }
  }
  await client.staffMember.update({ where: { staffCode: `${PREFIX}-NONTEACHING-REF` }, data: { notes: null } });
  const cpu = process.cpuUsage(cpuStart), memoryEnd = process.memoryUsage();
  const read = latencySummary(reads), write = latencySummary(writes), ordinary = latencySummary([...reads, ...writes]);
  invariant(errors === 0 && sqliteBusy === 0, "IMPORT1A_V1_FINAL_PERFORMANCE_ERRORS");
  invariant(read.p95 <= 2000 && write.p95 <= 3000 && ordinary.p99 <= 5000, "IMPORT1A_V1_FINAL_PERFORMANCE_BUDGET_EXCEEDED");
  invariant(memoryEnd.heapUsed - memoryStart.heapUsed < 64 * 1024 * 1024, "IMPORT1A_V1_FINAL_MEMORY_GROWTH_EXCEEDED");
  return {
    samples: { reads: reads.length, writes: writes.length }, readMs: read, writeMs: write, ordinaryMs: ordinary,
    errorRate: errors / (reads.length + writes.length), sqliteBusy,
    cpuMs: Math.round((cpu.user + cpu.system) / 1000),
    memory: { rssStartBytes: memoryStart.rss, rssEndBytes: memoryEnd.rss, heapDeltaBytes: memoryEnd.heapUsed - memoryStart.heapUsed }
  };
}

function latencySummary(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (rank: number) => Number(sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * rank) - 1))].toFixed(2));
  return { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: Number(sorted[sorted.length - 1].toFixed(2)) };
}

function stressWorkbook(profile: { students: number; guardians: number; staff: number; teachers: number; enrollmentsPerStudent: number }) {
  const academicYears = profile.enrollmentsPerStudent === 2 ? ["2025-26", "2026-27"] : ["2026-27"];
  const classNames = ["I","II","III","IV","V","VI","VII","VIII","IX","X"], sections = ["A","B","C","D"];
  const classes = academicYears.flatMap((academicYear) => classNames.flatMap((className) => sections.map((section) => ({ academicYear, className, section }))));
  const generated = generateOnboardingTemplate({ bundle: "COMBINED", generatedAt: new Date("2026-08-10T13:00:00.000Z"), academicYears, classes, departments: ["Academics","Administration"], designations: ["Teacher","Office Assistant"] });
  const wb = XLSX.read(generated, { type: "buffer" });
  const students = Array.from({ length: profile.students }, (_, i) => { const cohort = i % 40, className = classNames[Math.floor(cohort / 4)], section = sections[cohort % 4]; return [`STRESS-STU-${i}`, `${PREFIX}-STRESS-ADM-${i}`, `${PREFIX} Stress Student ${i}`, `${PREFIX} Father ${i}`, `${PREFIX} Mother ${i}`, String(9100000000 + i), "", "2016-01-31", "2026-27", className, section, String(Math.floor(i / 40) + 1), "ACTIVE", "Synthetic scale QA only", "NO"]; });
  const guardians = Array.from({ length: profile.guardians }, (_, i) => [`STRESS-GUA-${i}`, `${PREFIX} Stress Guardian ${i}`, "Guardian", String(9000000000 + i), "", "", "MOBILE", "NO", "NO"]);
  const guardianIndex = (studentIndex: number) => studentIndex < 2 ? 0 : studentIndex < 5 ? 1 : studentIndex < 9 ? 2 : studentIndex - 6;
  const links = Array.from({ length: profile.students }, (_, i) => [`STRESS-LNK-${i}`, `STRESS-STU-${i}`, `STRESS-GUA-${guardianIndex(i)}`, "Guardian", "YES", "YES", "YES", "NO"]);
  const enrollments = academicYears.flatMap((academicYear, yearIndex) => Array.from({ length: profile.students }, (_, i) => { const cohort = i % 40, className = classNames[Math.floor(cohort / 4)], section = sections[cohort % 4]; return [`STRESS-ENR-${yearIndex}-${i}`, `STRESS-STU-${i}`, academicYear, className, section, String(Math.floor(i / 40) + 1), yearIndex ? "2026-06-01" : "2025-06-01", yearIndex === academicYears.length - 1 ? "ACTIVE" : "INACTIVE", "NO"]; }));
  const staff = Array.from({ length: profile.staff }, (_, i) => { const teacher = i < profile.teachers; return [`STRESS-STF-${i}`, `${PREFIX}-STRESS-EMP-${i}`, `${PREFIX} Stress Staff ${i}`, teacher ? "TEACHING" : "NON_TEACHING", teacher ? "Teacher" : "Office Assistant", teacher ? "Academics" : "Administration", "2026-06-01", "", "", String(9200000000 + i), teacher ? "TEACHER" : "COMPUTER_OPERATOR", "NO", "ACTIVE", "Synthetic scale QA only", "NO"]; });
  XLSX.utils.sheet_add_aoa(wb.Sheets.Students, students, { origin: "A2" });
  XLSX.utils.sheet_add_aoa(wb.Sheets.Guardians, guardians, { origin: "A2" });
  XLSX.utils.sheet_add_aoa(wb.Sheets["Student-Guardian Links"], links, { origin: "A2" });
  XLSX.utils.sheet_add_aoa(wb.Sheets.Enrollments, enrollments, { origin: "A2" });
  XLSX.utils.sheet_add_aoa(wb.Sheets.Staff, staff, { origin: "A2" });
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "IMPORT1A_COPIED_DATABASE_FAILED"); process.exitCode = 1; });
