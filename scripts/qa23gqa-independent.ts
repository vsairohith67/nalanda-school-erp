import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { assertSqliteCopyReady, assertSqliteSnapshotUnchanged, snapshotSqliteArtifacts } from "./sqlite-copy-safety";
import { seedReport23GFixtures } from "./qa23g-fixture-data";
import {
  academicReportCsv,
  buildAcademicReportSummary,
  deterministicAcademicReportFilename,
  getAcademicReportRun,
  parseAcademicReportInput,
  persistAcademicReportRun,
  recordAcademicReportExport
} from "../lib/academic-reporting";
import { loadAcademicReportSources } from "../lib/academic-reporting-sources";
import { renderAcademicReportPdf } from "../lib/academic-report-pdf";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import { generateFullBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";

const SUITE = "REPORT23GQA";
const WORKSPACE = path.resolve(".");
const OPERATIONAL = path.join(WORKSPACE, "prisma", "dev.db");
const QA_PARENT = path.join(WORKSPACE, "tmp", "report23gqa");
const ROOT = path.join(QA_PARENT, `${SUITE}-${process.pid}-${randomUUID()}`);
const DATABASE = path.join(ROOT, "report23gqa.db");
const RESTORE_DATABASE = path.join(ROOT, "report23gqa-restore.db");
const secret = randomBytes(48).toString("base64url");
let stage = "preflight";

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function databaseUrl(file: string) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function runPrisma(args: string[], file = DATABASE) {
  const pnpm = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs");
  invariant(existsSync(pnpm), "REPORT23GQA_PNPM_RUNTIME_MISSING");
  const result = spawnSync(process.execPath, [pnpm, "exec", "prisma", ...args], {
    cwd: WORKSPACE,
    env: { ...process.env, DATABASE_URL: databaseUrl(file), SESSION_SECRET: secret, AUTH_SECRET: secret },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error || result.status !== 0) throw new Error(`REPORT23GQA_PRISMA_FAILED:${args.join(" ")}:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
  return `${result.stdout}\n${result.stderr}`;
}

function cleanup() {
  const resolved = path.resolve(ROOT);
  invariant(resolved.startsWith(`${path.resolve(QA_PARENT)}${path.sep}`), "REPORT23GQA_CLEANUP_SCOPE_REFUSED");
  if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
  if (existsSync(QA_PARENT) && readdirSync(QA_PARENT).length === 0) rmdirSync(QA_PARENT);
}

function actor(entry: any) {
  return {
    id: entry.user.id,
    name: entry.user.name,
    username: entry.user.username,
    email: null,
    designation: entry.user.designation,
    role: entry.user.role,
    roleAssignmentId: entry.assignment.id,
    authorizationVersion: entry.user.authorizationVersion,
    mustChangePassword: false,
    guardianId: entry.user.guardianId
  };
}

function denied(work: () => Promise<unknown>) {
  return work().then(() => false, () => true);
}

async function sessionFor(client: PrismaClient, entry: any) {
  return client.authSession.create({ data: {
    userId: entry.user.id,
    tokenHash: randomBytes(32).toString("hex"),
    credentialVersion: entry.user.credentialVersion,
    authorizationVersion: entry.user.authorizationVersion,
    activeRoleAssignmentId: entry.assignment.id,
    expiresAt: new Date(Date.now() + 86_400_000),
    deviceSummary: "REPORT23GQA copied database",
    browserSummary: "Independent QA",
    networkEvidenceMasked: "local"
  } });
}

function row(summary: any, sectionId: string, index = 0) {
  const section = summary.sections.find((item: any) => item.id === sectionId);
  invariant(section, `REPORT23GQA_SECTION_MISSING:${sectionId}`);
  invariant(section.rows[index], `REPORT23GQA_ROW_MISSING:${sectionId}:${index}`);
  return section.rows[index] as Record<string, unknown>;
}

async function main() {
  cleanup();
  mkdirSync(ROOT, { recursive: true });
  assertSqliteCopyReady(OPERATIONAL, "REPORT23GQA_OPERATIONAL");
  const before = snapshotSqliteArtifacts(OPERATIONAL);
  copyFileSync(OPERATIONAL, DATABASE);
  copyFileSync(OPERATIONAL, RESTORE_DATABASE);
  Object.assign(process.env, { DATABASE_URL: databaseUrl(DATABASE), SESSION_SECRET: secret, AUTH_SECRET: secret, NODE_ENV: "test" });

  stage = "migration deploy twice";
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
  invariant(/up to date/i.test(runPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"])), "REPORT23GQA_MIGRATION_DIRTY");
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], RESTORE_DATABASE);

  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    stage = "fresh independent fixtures";
    const ix = await seedReport23GFixtures(client, { suite: `${SUITE}-IX`, academicYear: "2026-27", className: "IX" });
    const x = await seedReport23GFixtures(client, { suite: `${SUITE}-X`, academicYear: "2025-26", className: "X" });
    const principal = actor(ix.users.principal);
    const director = actor(ix.users.director);
    const teacherIx = actor(ix.users.teacher);
    const teacherX = actor(x.users.teacher);
    const parent = actor(ix.users.parent);
    const student = actor(ix.users.student);
    const viewer = actor(ix.users.viewer);
    const accountant = actor(ix.users.accountant);
    const [parentSession, studentSession] = await Promise.all([sessionFor(client, ix.users.parent), sessionFor(client, ix.users.student)]);

    await ensureDefaultRolePermissions(client);
    const operatorUser = await client.user.create({ data: { name: `${SUITE} denied operator`, username: `${SUITE.toLowerCase()}-operator`, passwordHash: `${SUITE}-NO-LOGIN`, role: "COMPUTER_OPERATOR" } });
    const operatorAssignment = await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: operatorUser.id, role: "COMPUTER_OPERATOR", reason: `${SUITE} denied-role fixture`, assignedByUserId: operatorUser.id, activeKey: `${operatorUser.id}:COMPUTER_OPERATOR` } });
    const operator = actor({ user: operatorUser, assignment: operatorAssignment });

    // One locked Class X result is deliberately unissued; another has formula drift.
    const unissuedVersion = x.reportCardVersions[0];
    await client.studentReportCard.update({ where: { id: unissuedVersion.reportCardId }, data: { status: "DRAFT" } });
    const driftSnapshot = x.resultSnapshots[1];
    await client.studentResultSnapshot.update({ where: { id: driftSnapshot.id }, data: { formulaVersion: "REPORT23GQA_DRIFT_MUST_FAIL_CLOSED" } });

    stage = "source integrity and hand arithmetic";
    const boardInput = parseAcademicReportInput({ family: "BOARD_CLASS_COMPARATIVE", academicYear: ix.academicYear, examinationCodes: ix.examCodes.slice(0, 2), className: ix.className, normalizationRule: "PERCENTAGE_NORMALIZED" });
    const boardLoaded = await loadAcademicReportSources(client, boardInput, principal, `${SUITE}-LEADERSHIP`);
    invariant(boardLoaded.sources.length === 16, "REPORT23GQA_LOCKED_ISSUED_COUNT_WRONG");
    const boardSummary = buildAcademicReportSummary(boardLoaded.sources, boardInput, { audience: boardLoaded.audience, expectedCompletion: boardLoaded.expectedCompletion, generatedAt: new Date("2026-08-03T12:00:00.000Z") });
    invariant(boardSummary.compatibility.every((item) => item.compatible && item.appliedRule === "PERCENTAGE_NORMALIZED"), "REPORT23GQA_PERCENT_NORMALIZATION_FAILED");
    invariant(boardSummary.sourceStatement.includes("No raw marks") && boardSummary.boardClassDisclaimer && /not an official board submission/i.test(boardSummary.boardClassDisclaimer), "REPORT23GQA_BOARD_BOUNDARY_FAILED");
    const deltaRows = boardSummary.sections.find((section) => section.id === "comparison")?.rows ?? [];
    const firstDelta = deltaRows.find((item: any) => item.Student === ix.students[0].studentName);
    invariant(firstDelta?.["Change (percentage points)"] === 10 && firstDelta?.Direction === "IMPROVEMENT", "REPORT23GQA_LONGITUDINAL_DELTA_HAND_CALC_FAILED");

    const strictInput = parseAcademicReportInput({ family: "COMPARATIVE_DELTA", academicYear: ix.academicYear, examinationCodes: ix.examCodes.slice(0, 2), className: ix.className, normalizationRule: "STRICT_MATCH" });
    const strictLoaded = await loadAcademicReportSources(client, strictInput, director, `${SUITE}-DIRECTOR`);
    const strictSummary = buildAcademicReportSummary(strictLoaded.sources, strictInput, { audience: strictLoaded.audience, expectedCompletion: strictLoaded.expectedCompletion });
    invariant(strictSummary.compatibility.every((item) => !item.compatible) && strictSummary.sections[0].rows.length === 8 && strictSummary.sections[0].rows.every((item: any) => item.Compatibility === "REFUSED" && item["Change (percentage points)"] === "N/A") && strictSummary.warnings.some((warning) => /not compared/i.test(warning)), "REPORT23GQA_DIFFERENT_MAXIMA_SILENT_COMPARISON");

    const weightedInput = parseAcademicReportInput({ family: "COMPARATIVE_DELTA", academicYear: ix.academicYear, examinationCodes: [ix.examCodes[0], ix.examCodes[2]], className: ix.className, normalizationRule: "PERCENTAGE_NORMALIZED" });
    const weightedLoaded = await loadAcademicReportSources(client, weightedInput, principal, `${SUITE}-LEADERSHIP`);
    const weightedSummary = buildAcademicReportSummary(weightedLoaded.sources, weightedInput, { audience: weightedLoaded.audience, expectedCompletion: weightedLoaded.expectedCompletion });
    invariant(weightedSummary.compatibility.every((item) => !item.compatible) && weightedSummary.sections[0].rows.every((item: any) => item.Compatibility === "REFUSED" && item.Direction === "N/A"), "REPORT23GQA_RAW_WEIGHTED_EQUIVALENCE_INVENTED");

    const classInput = parseAcademicReportInput({ family: "CLASS_AVERAGE_HIGHEST", academicYear: ix.academicYear, examinationCodes: [ix.examCodes[0]], className: ix.className, section: ix.sections[0], includeAverageHighest: true, approvalReference: `${SUITE}-APPROVED` });
    const classLoaded = await loadAcademicReportSources(client, classInput, principal, `${SUITE}-LEADERSHIP`);
    const classSummary = buildAcademicReportSummary(classLoaded.sources, classInput, { audience: classLoaded.audience, expectedCompletion: classLoaded.expectedCompletion });
    const classRow = row(classSummary, "class-summary");
    invariant(classRow["Average percentage"] === 48.83 && classRow["Highest percentage"] === 75 && classRow["Issued sources"] === 6, "REPORT23GQA_CLASS_AVERAGE_HIGHEST_HAND_CALC_FAILED");

    const outcomeInput = parseAcademicReportInput({ family: "OUTCOME_DISTRIBUTION", academicYear: ix.academicYear, examinationCodes: [ix.examCodes[0]], className: ix.className, section: ix.sections[0] });
    const outcomeLoaded = await loadAcademicReportSources(client, outcomeInput, principal, `${SUITE}-LEADERSHIP`);
    const outcomeSummary = buildAcademicReportSummary(outcomeLoaded.sources, outcomeInput, { audience: outcomeLoaded.audience, expectedCompletion: outcomeLoaded.expectedCompletion });
    const outcomeRows = outcomeSummary.sections[0].rows as Array<Record<string, unknown>>;
    const countFor = (distribution: string, outcome: string) => outcomeRows.find((item) => item.Distribution === distribution && item.Outcome === outcome)?.Count;
    invariant(countFor("Entry state", "ABSENT") === 1 && countFor("Entry state", "EXEMPT") === 1 && countFor("Entry state", "N/A") === 1 && countFor("Entry state", "NOT_ENTERED") === 1 && countFor("Entry state", "ZERO") === 1, "REPORT23GQA_STATE_DISTRIBUTION_FAILED");
    invariant(countFor("Grade", "D") === 1 && countFor("Grade", "B") === 4 && countFor("Grade", "A") === 1 && countFor("Pass result", "FAIL") === 1 && countFor("Pass result", "PASS") === 5, "REPORT23GQA_GRADE_PASS_HAND_CALC_FAILED");

    const paperInput = parseAcademicReportInput({ family: "SUBJECT_PAPER_DISTRIBUTION", academicYear: ix.academicYear, examinationCodes: [ix.examCodes[0]], className: ix.className, section: ix.sections[0], subjectCode: "MAT" });
    const paperLoaded = await loadAcademicReportSources(client, paperInput, principal, `${SUITE}-LEADERSHIP`);
    const paperSummary = buildAcademicReportSummary(paperLoaded.sources, paperInput, { audience: paperLoaded.audience, expectedCompletion: paperLoaded.expectedCompletion });
    const paperRow = row(paperSummary, "paper-distribution");
    invariant(paperRow.Count === 6 && paperRow["Average percentage"] === 48.83 && paperRow["Below 40"] === 1 && paperRow["75 and above"] === 1, "REPORT23GQA_PAPER_DISTRIBUTION_HAND_CALC_FAILED");

    const groupInput = parseAcademicReportInput({ family: "SUBJECT_GROUP_SUMMARY", academicYear: ix.academicYear, examinationCodes: [ix.examCodes[0]], className: ix.className, section: ix.sections[0] });
    const groupLoaded = await loadAcademicReportSources(client, groupInput, principal, `${SUITE}-LEADERSHIP`);
    const groupSummary = buildAcademicReportSummary(groupLoaded.sources, groupInput, { audience: groupLoaded.audience, expectedCompletion: groupLoaded.expectedCompletion });
    const groupRows = groupSummary.sections[0].rows as Array<Record<string, unknown>>;
    const groupMismatch = groupRows.find((item) => Math.abs(Number(item.Percentage) - Number(item.Obtained) / Number(item.Maximum) * 100) > 0.001);
    invariant(groupRows.length === 12 && !groupMismatch, `REPORT23GQA_GROUP_COMBINED_PUBLISHED_VALUES_FAILED:${JSON.stringify(groupMismatch ?? { count: groupRows.length })}`);
    invariant(ix.resultSnapshots.filter((item: any) => item.rankValue === 2).length >= 2 && !JSON.stringify([boardSummary, classSummary, outcomeSummary]).match(/teacher rank|staff rank/i), "REPORT23GQA_TIE_OR_TEACHER_RANKING_FAILED");

    const completionInput = parseAcademicReportInput({ family: "COMPLETION_MISSING_SOURCE", academicYear: x.academicYear, examinationCodes: [x.examCodes[0]], className: x.className });
    const completionLoaded = await loadAcademicReportSources(client, completionInput, director, `${SUITE}-DIRECTOR`);
    const completionSummary = buildAcademicReportSummary(completionLoaded.sources, completionInput, { audience: completionLoaded.audience, expectedCompletion: completionLoaded.expectedCompletion });
    const completionRow = row(completionSummary, "completion");
    invariant(completionRow["Locked snapshots"] === 8 && completionRow["Issued versions"] === 6 && completionRow["Missing issued source"] === 2, "REPORT23GQA_UNISSUED_DRIFT_COMPLETION_FAILED");
    invariant(!completionLoaded.sources.some((source) => source.resultSnapshotId === driftSnapshot.id || source.reportCardVersionId === unissuedVersion.id), "REPORT23GQA_INVALID_SOURCE_NOT_REJECTED");
    invariant(boardLoaded.sources.every((source) => source.totalObtained === source.combinedResults[0].obtained && source.percentage === source.combinedResults[0].percentage), "REPORT23GQA_PUBLISHED_SOURCE_FORMULA_DRIFT");

    stage = "authorization and privacy";
    const teacherIxLoaded = await loadAcademicReportSources(client, paperInput, teacherIx, `${SUITE}-TEACHER-IX`);
    invariant(teacherIxLoaded.sources.length === 6 && teacherIxLoaded.sources.every((source) => source.section === ix.sections[0] && source.papers.length === 1), "REPORT23GQA_TEACHER_IX_SCOPE_FAILED");
    invariant(await denied(() => loadAcademicReportSources(client, paperInput, teacherX, `${SUITE}-TEACHER-X`)), "REPORT23GQA_SECOND_TEACHER_CROSS_YEAR_ALLOWED");
    const xTeacherInput = parseAcademicReportInput({ family: "SUBJECT_PAPER_DISTRIBUTION", academicYear: x.academicYear, examinationCodes: [x.examCodes[1]], className: x.className, section: x.sections[0], subjectCode: "MAT" });
    invariant((await loadAcademicReportSources(client, xTeacherInput, teacherX, `${SUITE}-TEACHER-X`)).sources.length === 6, "REPORT23GQA_SECOND_TEACHER_SCOPE_FAILED");
    for (const tampered of [
      { ...paperInput, section: ix.sections[1] },
      { ...paperInput, className: "X" },
      { ...paperInput, subjectCode: "SCI" }
    ]) invariant(await denied(() => loadAcademicReportSources(client, tampered as any, teacherIx, `${SUITE}-TEACHER-TAMPER`)) || (await loadAcademicReportSources(client, tampered as any, teacherIx, `${SUITE}-TEACHER-TAMPER`)).sources.length === 0, "REPORT23GQA_TEACHER_TAMPERING_ALLOWED");
    invariant(await denied(() => loadAcademicReportSources(client, paperInput, accountant, `${SUITE}-DENIED`)), "REPORT23GQA_ACCOUNTANT_ALLOWED");
    invariant(await denied(() => loadAcademicReportSources(client, paperInput, operator, `${SUITE}-DENIED`)), "REPORT23GQA_OTHER_ROLE_ALLOWED");

    const learnerInput = parseAcademicReportInput({ family: "STUDENT_LONGITUDINAL", academicYear: ix.academicYear, examinationCodes: ix.examCodes.slice(0, 2), className: ix.className, section: ix.sections[0], normalizationRule: "PERCENTAGE_NORMALIZED" });
    const [parentLoaded, studentLoaded] = await Promise.all([
      loadAcademicReportSources(client, learnerInput, parent, parentSession.id),
      loadAcademicReportSources(client, learnerInput, student, studentSession.id)
    ]);
    invariant(parentLoaded.sources.length === 2 && studentLoaded.sources.length === 2 && new Set([...parentLoaded.sources, ...studentLoaded.sources].map((source) => source.studentId)).size === 1, "REPORT23GQA_LINKED_SELF_SCOPE_FAILED");
    invariant(await denied(() => loadAcademicReportSources(client, { ...learnerInput, academicYear: x.academicYear } as any, parent, parentSession.id)), "REPORT23GQA_PARENT_CROSS_YEAR_ALLOWED");
    invariant(await denied(() => loadAcademicReportSources(client, { ...learnerInput, section: ix.sections[1] } as any, parent, parentSession.id)), "REPORT23GQA_PARENT_CROSS_SECTION_ALLOWED");

    const viewerInput = parseAcademicReportInput({ family: "LEADERSHIP_SUMMARY", academicYear: ix.academicYear, examinationCodes: [ix.examCodes[0]], className: ix.className, section: ix.sections[1] });
    const viewerLoaded = await loadAcademicReportSources(client, viewerInput, viewer, `${SUITE}-VIEWER`);
    const viewerSummary = buildAcademicReportSummary(viewerLoaded.sources, viewerInput, { audience: viewerLoaded.audience, expectedCompletion: viewerLoaded.expectedCompletion });
    invariant(viewerSummary.suppressed && viewerSummary.sections.every((section) => section.rows.every((item) => !Object.keys(item).some((key) => /student|admission|reference/i.test(key)))), "REPORT23GQA_VIEWER_SUPPRESSION_FAILED");
    const csv = academicReportCsv(viewerSummary);
    invariant(!csv.includes(ix.students[6].studentName) && !csv.includes(ix.students[6].admissionNo) && !/actorUserId|createdByUserId|resultSnapshotId|reportCardVersionId/i.test(csv), "REPORT23GQA_VIEWER_EXPORT_REIDENTIFIES");
    const injected = structuredClone(viewerSummary);
    injected.sections[0].rows.push({ [injected.sections[0].columns[0]]: "=HYPERLINK(\"bad\")" });
    invariant(academicReportCsv(injected).includes("'=HYPERLINK"), "REPORT23GQA_CSV_FORMULA_INJECTION_UNSAFE");
    const pdf = await renderAcademicReportPdf(viewerSummary, "MONOCHROME");
    invariant(pdf.byteLength > 500 && Buffer.from(pdf).subarray(0, 4).toString() === "%PDF", "REPORT23GQA_PRIVATE_PDF_RENDER_FAILED");

    stage = "versioning audit and exports";
    const firstRun = await persistAcademicReportRun(client, boardInput, boardSummary, boardLoaded.sources, principal, boardLoaded.accessScope, new Date("2026-08-03T12:00:00.000Z"));
    const repeat = await persistAcademicReportRun(client, boardInput, boardSummary, boardLoaded.sources, principal, boardLoaded.accessScope, new Date("2026-08-03T13:00:00.000Z"));
    invariant(repeat.runReference === firstRun.runReference && repeat.summaryHash === firstRun.summaryHash && repeat.idempotent, "REPORT23GQA_DETERMINISTIC_IDEMPOTENCY_FAILED");
    const concurrent = await Promise.all([
      persistAcademicReportRun(client, boardInput, boardSummary, boardLoaded.sources, principal, boardLoaded.accessScope, new Date("2026-08-03T14:00:00.000Z")),
      persistAcademicReportRun(client, boardInput, boardSummary, boardLoaded.sources, principal, boardLoaded.accessScope, new Date("2026-08-03T15:00:00.000Z"))
    ]);
    invariant(concurrent.every((item) => item.runReference === firstRun.runReference && item.idempotent), "REPORT23GQA_CONCURRENT_RUN_FAILED");
    const oldSummaryJson = (await client.academicReportRun.findUniqueOrThrow({ where: { id: firstRun.id } })).immutableSummaryJson;
    invariant(await client.academicReportRun.update({ where: { id: firstRun.id }, data: { immutableSummaryJson: "{}" } }).then(() => false, () => true), "REPORT23GQA_IMMUTABLE_SUMMARY_UPDATE_ALLOWED");

    const supersedingInput = parseAcademicReportInput({ ...boardInput, approvalReference: `${SUITE}-GOVERNED-REPLACEMENT`, supersedesRunReference: firstRun.runReference });
    const supersedingSummary = buildAcademicReportSummary(boardLoaded.sources, supersedingInput, { audience: boardLoaded.audience, expectedCompletion: boardLoaded.expectedCompletion, generatedAt: new Date("2026-08-03T16:00:00.000Z") });
    const supersedingRun = await persistAcademicReportRun(client, supersedingInput, supersedingSummary, boardLoaded.sources, principal, boardLoaded.accessScope, new Date("2026-08-03T16:00:00.000Z"));
    invariant(supersedingRun.runReference !== firstRun.runReference && supersedingRun.supersedesRunReference === firstRun.runReference, "REPORT23GQA_SUPERSESSION_LINK_FAILED");
    const oldRun = await getAcademicReportRun(client, firstRun.runReference, director);
    invariant(oldRun.summaryHash === firstRun.summaryHash && JSON.stringify(oldRun.summary) === oldSummaryJson && oldRun.supersededBy.some((item: any) => item.runReference === supersedingRun.runReference), "REPORT23GQA_SUPERSESSION_CHANGED_HISTORY");
    invariant(await denied(() => getAcademicReportRun(client, firstRun.runReference, teacherIx)), "REPORT23GQA_PERSISTED_RUN_OBJECT_SCOPE_FAILED");

    const viewerRun = await persistAcademicReportRun(client, viewerInput, viewerSummary, viewerLoaded.sources, viewer, viewerLoaded.accessScope, new Date("2026-08-03T17:00:00.000Z"));
    invariant((await getAcademicReportRun(client, viewerRun.runReference, viewer)).summary.audience === "VIEWER", "REPORT23GQA_VIEWER_RUN_READ_FAILED");
    await recordAcademicReportExport(client, viewerRun.id, viewer, "CSV", "MONOCHROME", new Date("2026-08-03T17:05:00.000Z"));
    await recordAcademicReportExport(client, viewerRun.id, viewer, "PDF", "MONOCHROME", new Date("2026-08-03T17:06:00.000Z"));
    const exportEvents = await client.academicReportAuditEvent.findMany({ where: { reportRunId: viewerRun.id, eventType: "EXPORT_AUTHORIZED" } });
    invariant(exportEvents.length === 2 && exportEvents.every((event) => !event.safeDetailsJson.includes(viewer.id) && !ix.students.some((item: any) => event.safeDetailsJson.includes(item.studentName) || event.safeDetailsJson.includes(item.admissionNo))), "REPORT23GQA_EXPORT_AUDIT_PII_FAILED");
    invariant(await client.academicReportAuditEvent.update({ where: { id: exportEvents[0].id }, data: { safeDetailsJson: "{}" } }).then(() => false, () => true), "REPORT23GQA_APPEND_ONLY_AUDIT_UPDATE_ALLOWED");
    invariant(await client.academicReportAuditEvent.delete({ where: { id: exportEvents[0].id } }).then(() => false, () => true), "REPORT23GQA_APPEND_ONLY_AUDIT_DELETE_ALLOWED");
    const filename = deterministicAcademicReportFilename(viewerRun.runReference, viewerRun.summaryHash, "csv");
    invariant(filename === deterministicAcademicReportFilename(viewerRun.runReference, viewerRun.summaryHash, "csv") && /^academic-report-[A-Za-z0-9-]+-[a-f0-9]{10}\.csv$/.test(filename) && !filename.includes(".."), "REPORT23GQA_FILENAME_UNSAFE_OR_NONDETERMINISTIC");

    const beforeRollback = { runs: await client.academicReportRun.count(), audits: await client.academicReportAuditEvent.count() };
    await client.$transaction(async (tx) => {
      await tx.academicReportAuditEvent.create({ data: { eventKey: randomUUID(), reportRunId: firstRun.id, eventType: "EXPORT_AUTHORIZED", actorUserId: principal.id, actorRole: "PRINCIPAL", safeDetailsJson: "{}" } });
      throw new Error("REPORT23GQA_FORCED_FAILURE");
    }).then(() => { throw new Error("REPORT23GQA_FORCED_FAILURE_DID_NOT_FAIL"); }, () => undefined);
    invariant(await client.academicReportRun.count() === beforeRollback.runs && await client.academicReportAuditEvent.count() === beforeRollback.audits, "REPORT23GQA_FORCED_FAILURE_PARTIAL_WRITE");

    const staleCard = await client.studentReportCard.findFirstOrThrow({ where: { versions: { some: { id: boardLoaded.sources[0].reportCardVersionId } } } });
    await client.studentReportCard.update({ where: { id: staleCard.id }, data: { status: "WITHDRAWN" } });
    const staleRun = await getAcademicReportRun(client, firstRun.runReference, principal);
    invariant(staleRun.stale && /historical run remains reproducible/i.test(staleRun.staleWarning ?? "") && staleRun.summaryHash === firstRun.summaryHash, "REPORT23GQA_STALE_WARNING_FAILED");

    stage = "security static evidence";
    const exportRoute = readFileSync(path.join(WORKSPACE, "app", "api", "academic-reports", "runs", "[runKey]", "export", "route.ts"), "utf8");
    const apiGuard = readFileSync(path.join(WORKSPACE, "lib", "academic-reporting-api.ts"), "utf8");
    const sourceLoader = readFileSync(path.join(WORKSPACE, "lib", "academic-reporting-sources.ts"), "utf8");
    const middleware = readFileSync(path.join(WORKSPACE, "middleware.ts"), "utf8");
    invariant(/export async function POST/.test(exportRoute) && !/export async function GET/.test(exportRoute) && /requireAcademicReportAccess/.test(exportRoute), "REPORT23GQA_EXPORT_AUTH_OR_METHOD_FAILED");
    invariant(/private, no-store/.test(apiGuard) && /unsafeRequestOriginAllowed/.test(middleware) && /content-security-policy/i.test(middleware), "REPORT23GQA_CSRF_NOSTORE_HEADERS_FAILED");
    invariant(!/\bfetch\s*\(|axios|openai|provider/i.test(sourceLoader), "REPORT23GQA_EXTERNAL_PROVIDER_TRANSFER_FOUND");
    invariant(!/public[\\/]reports|writeFile|createWriteStream/i.test(exportRoute), "REPORT23GQA_PUBLIC_PREDICTABLE_EXPORT_FOUND");

    stage = "backup generate and restore twice";
    const backupOne = parseAndValidateBackup(await generateFullBackup(client, { generatedBy: `${SUITE} independent QA pass one` }));
    const backupTwo = parseAndValidateBackup(await generateFullBackup(client, { generatedBy: `${SUITE} independent QA pass two` }));
    invariant(backupOne.academicReportDefinitions.length === 2 && backupTwo.academicReportDefinitions.length === 2, "REPORT23GQA_BACKUP_DEFINITIONS_MISSING");
    invariant(backupOne.academicReportRuns.length === 3 && backupTwo.academicReportRuns.length === 3, "REPORT23GQA_BACKUP_RUNS_MISSING");
    invariant(backupOne.academicReportSourceReferences.length === boardLoaded.sources.length * 2 + viewerLoaded.sources.length, "REPORT23GQA_BACKUP_VERSION_LINKS_MISSING");
    invariant(!/createdByUserId|actorUserId|passwordHash|tokenHash|sessionSecret/i.test(JSON.stringify({ definitions: backupOne.academicReportDefinitions, runs: backupOne.academicReportRuns, sources: backupOne.academicReportSourceReferences, audits: backupOne.academicReportAuditEvents })), "REPORT23GQA_BACKUP_SECRET_OR_ACTOR_ID_LEAK");
    const restoreClient = new PrismaClient({ datasourceUrl: databaseUrl(RESTORE_DATABASE) });
    try {
      const restoreActor = await restoreClient.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true } });
      invariant(restoreActor, "REPORT23GQA_RESTORE_ACTOR_MISSING");
      const restoreOne = await restoreValidatedBackup(restoreClient, backupOne, restoreActor);
      const restoreTwo = await restoreValidatedBackup(restoreClient, backupTwo, restoreActor);
      const errors = [restoreOne, restoreTwo].flatMap((item) => Object.entries(item).flatMap(([key, value]: any) => value?.errors?.length ? [`${key}:${value.errors.join("|")}`] : []));
      invariant(!errors.length, `REPORT23GQA_RESTORE_ERRORS:${errors.join(";")}`);
      invariant(await restoreClient.academicReportRun.count() === 3 && await restoreClient.academicReportSourceReference.count() === boardLoaded.sources.length * 2 + viewerLoaded.sources.length, "REPORT23GQA_DOUBLE_RESTORE_MISMATCH");
    } finally {
      await restoreClient.$disconnect();
    }

    assertSqliteCopyReady(OPERATIONAL, "REPORT23GQA_OPERATIONAL");
    assertSqliteSnapshotUnchanged(before, snapshotSqliteArtifacts(OPERATIONAL), "REPORT23GQA_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({
      result: "REPORT23GQA_INDEPENDENT_PASSED",
      migrateDeployRuns: 2,
      years: [ix.academicYear, x.academicYear],
      classes: [ix.className, x.className],
      sections: [...ix.sections, ...x.sections],
      roles: ["PRINCIPAL", "DIRECTOR", "TEACHER_IX", "TEACHER_X", "PARENT", "STUDENT", "VIEWER", "ACCOUNTANT_DENIED", "COMPUTER_OPERATOR_DENIED"],
      handCalculated: ["deltas", "normalization", "paper", "group", "outcome", "average", "highest", "ties", "completion"],
      sourceGate: ["locked", "issued", "current-version", "formula", "rounding", "snapshot-percentage", "snapshot-maximum"],
      browserPending: true,
      backupGenerated: 2,
      backupRestored: 2,
      cleanupInspections: 2,
      operationalMutation: false
    }));
  } finally {
    await client.$disconnect();
    cleanup();
    cleanup();
    assertSqliteCopyReady(OPERATIONAL, "REPORT23GQA_OPERATIONAL_POST_CLEANUP");
    assertSqliteSnapshotUnchanged(before, snapshotSqliteArtifacts(OPERATIONAL), "REPORT23GQA_OPERATIONAL_CHANGED_AFTER_CLEANUP");
  }
}

main().catch((error) => {
  console.error(`REPORT23GQA_FAILED stage=${stage}: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
