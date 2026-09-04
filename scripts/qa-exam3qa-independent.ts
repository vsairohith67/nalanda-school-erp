import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import { unzipSync } from "fflate";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import { hashPassword } from "../lib/password";
import {
  authorizeParentReportAccess,
  getParentPublishedReports
} from "../lib/report-parent-delivery";
import {
  authorizeReportPdfJobDownload,
  getReportPdfJob,
  readCompletedReportPdfArtifact,
  resolveReportPdfJobDownload,
  retryReportPdfJob
} from "../lib/report-pdf-jobs";
import {
  deterministicReportPdfName,
  renderReportPdf
} from "../lib/report-pdf";
import {
  parsePublishedSnapshot,
  previewReportPublication,
  publishReportCards,
  ReportPublicationError,
  withdrawPublishedReport
} from "../lib/report-publication";
import { safePublishedReportSnapshot } from "../lib/report-publication-types";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  assertIsolatedDatabasePath,
  businessBaseline,
  cleanupIsolatedDatabase,
  createEmptyIsolatedDatabase,
  databaseUrl,
  fileSha256,
  runPnpm,
  runPrisma
} from "./migration-check-utils";

const PREFIX = "EXAM3QA";
const STATE_PATH = path.join(QA_ROOT, "reports", "EXAM3QA-browser-state.json");
const GENERATED_HARNESS = path.join(process.cwd(), "tmp", "EXAM3QA-generated-harness.ts");
const BACKUP_PATH = path.join(QA_ROOT, "reports", "EXAM3QA-v37.backup.json");
const PDF_ROOT = path.join(process.cwd(), "tmp", "report-publication");
const FIXED_NOW = new Date();

type QaState = {
  databasePath: string;
  sourceHash: string;
  principal: { id: string; username: string; password: string };
  parent: { id: string; username: string; password: string };
  unrelatedParent: { id: string; username: string; password: string };
  students: Record<string, { id: string; admissionNo: string }>;
  runs: Record<string, string>;
  jobKeys: string[];
  visualFiles: string[];
};

function readState() {
  if (!existsSync(STATE_PATH)) throw new Error("EXAM3QA_STATE_MISSING");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as QaState;
  state.databasePath = assertIsolatedDatabasePath(state.databasePath);
  return state;
}

function runGeneratedHarness(command: "prepare" | "exercise" | "inspect" | "cleanup") {
  const source = readFileSync(path.join(process.cwd(), "scripts", "qa-exam3-copied-db.ts"), "utf8")
    .replaceAll("EXAM3", "EXAM3QA")
    .replaceAll('"EXAM3QA KG"', '"LKG"')
    .replaceAll('"EXAM3QA Primary"', '"III"')
    .replaceAll('"EXAM3QA Secondary"', '"VIII"')
    .replaceAll('"EXAM3QA Combined"', '"X"')
    .replace(
      `  const classSection = await client.timetableClassSection.create({
    data: {
      academicYear: "2026-27",
      className: seed.className,
      section: seed.section,
      displayName: \`${"${seed.className}"} - ${"${seed.section}"}\`,
      groupName: "EXAM3QA SYNTHETIC",
      isActive: true
    }
  });`,
      `  const classSection = await client.timetableClassSection.upsert({
    where: {
      academicYear_className_section: {
        academicYear: "2026-27",
        className: seed.className,
        section: seed.section
      }
    },
    create: {
      academicYear: "2026-27",
      className: seed.className,
      section: seed.section,
      displayName: \`${"${seed.className}"} - ${"${seed.section}"}\`,
      groupName: "EXAM3QA SYNTHETIC",
      isActive: true
    },
    update: {}
  });`
    )
    .replace('const FIXED_NOW = new Date("2026-07-31T10:00:00.000Z");', "const FIXED_NOW = new Date();")
    .replace('from "./migration-check-utils"', 'from "../scripts/migration-check-utils"');
  writeFileSync(GENERATED_HARNESS, source, "utf8");
  try {
    return runPnpm(["exec", "tsx", GENERATED_HARNESS, "--", command]);
  } finally {
    if (existsSync(GENERATED_HARNESS)) rmSync(GENERATED_HARNESS, { force: true });
  }
}

async function prepare() {
  cleanupLooseArtifacts();
  const prepared = runGeneratedHarness("prepare");
  const exercised = runGeneratedHarness("exercise");
  const inspected = runGeneratedHarness("inspect");
  console.log(lastUsefulLine(prepared.stdout));
  console.log(lastUsefulLine(exercised.stdout));
  console.log(lastUsefulLine(inspected.stdout));
}

async function audit() {
  const state = readState();
  if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) {
    throw new Error("EXAM3QA_OPERATIONAL_SOURCE_CHANGED_BEFORE_AUDIT");
  }
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  const principal = { id: state.principal.id, name: "EXAM3QA Principal", role: "PRINCIPAL" as const };
  const parent = { id: state.parent.id, name: "EXAM3QA Linked Parent", role: "PARENT" as const };
  try {
    await verifyExactSources(client);
    await verifyReadinessAndRoleDenials(client, state, principal);
    await verifyConcurrentPublicationAndRollback(client, principal);
    await verifyPdfOutputs(client, state, principal);
    await verifyParentWithdrawalPolicy(client, state, parent, principal);
    await verifySecuritySourceBoundaries();
    await verifyBackupRestore(client, state);
    await verifyAuditPrivacy(client, state);
  } finally {
    await client.$disconnect();
  }
  verifyOperationalBaseline(state.sourceHash);
  console.log("EXAM3QA independent audit passed: exact sources, authorization, lifecycle, PDFs, bulk delivery, security, rollback and double restore.");
}

async function verifyExactSources(client: PrismaClient) {
  const cards = await client.studentReportCard.findMany({
    where: { student: { admissionNo: { startsWith: `${PREFIX}-` } } },
    include: {
      student: true,
      versions: { orderBy: { versionNumber: "asc" } },
      events: { orderBy: { eventDate: "asc" } }
    }
  });
  if (cards.length !== 5) throw new Error(`EXAM3QA_CARD_COUNT_${cards.length}`);
  let versionCount = 0;
  const families = new Set<string>();
  for (const card of cards) {
    for (const version of card.versions) {
      versionCount += 1;
      const report = parsePublishedSnapshot(version.snapshotJson);
      const safe = safePublishedReportSnapshot(report) as any;
      if (safe.governance.internal || JSON.stringify(safe).includes(report.governance.internal.resultSnapshotId)) {
        throw new Error("EXAM3QA_SAFE_SNAPSHOT_INTERNAL_ID_LEAK");
      }
      const source = await client.studentResultSnapshot.findUniqueOrThrow({
        where: { id: report.governance.internal.resultSnapshotId },
        include: { schemeVersion: true }
      });
      const frozen = JSON.parse(source.snapshotJson);
      families.add(report.templateFamily);
      assertEqual(report.student.admissionNumber, card.student.admissionNo, "student identity");
      assertEqual(report.governance.internal.calculationRunId, source.calculationRunId, "calculation run");
      assertEqual(report.governance.resultSnapshotVersion, source.snapshotVersion, "snapshot version");
      assertEqual(report.governance.formulaVersion, source.formulaVersion, "formula version");
      assertEqual(report.governance.roundingPolicyVersion, source.roundingPolicyVersion, "rounding policy");
      assertEqual(report.content.totalObtained, String(frozen.totalObtained), "total obtained");
      assertEqual(report.content.totalMaximum, String(frozen.totalMaximum), "total maximum");
      assertEqual(report.content.percentage, String(frozen.percentage), "percentage");
      assertEqual(report.content.grade?.code ?? null, frozen.grade?.code ?? null, "grade");
      assertEqual(report.content.grade?.point ?? null, frozen.grade?.point ?? null, "grade point");
      assertEqual(report.content.passResult, frozen.passResult ?? null, "pass result");
      assertEqual(report.content.rank, Number.isInteger(frozen.rank) ? frozen.rank : null, "rank");
      const sourceStates = frozen.papers.flatMap((paper: any) => paper.components.map((row: any) => row.state));
      const reportStates = report.content.papers.flatMap((paper) => paper.components.map((row) => row.state));
      assertEqual(JSON.stringify(reportStates), JSON.stringify(sourceStates), "component states");
      assertEqual(JSON.stringify(report.content.attendance), JSON.stringify({
        policy: frozen.attendanceReference.policy,
        periodStart: frozen.attendanceReference.periodStart,
        periodEnd: frozen.attendanceReference.periodEnd,
        totalLockedDays: frozen.attendanceReference.totalLockedDays,
        recordedDays: frozen.attendanceReference.recordedDays,
        presentEquivalentDays: frozen.attendanceReference.presentEquivalentDays
      }), "attendance");
      if (!report.content.remarks.general || !report.content.legends.length || report.signatures.length < 2) {
        throw new Error("EXAM3QA_REQUIRED_REPORT_CONTENT_MISSING");
      }
      if (!source.schemeVersion.rankEnabled && report.content.rank !== null) {
        throw new Error("EXAM3QA_DISABLED_RANK_RENDERED");
      }
      if (!source.schemeVersion.passFailEnabled && report.content.passResult !== null) {
        throw new Error("EXAM3QA_DISABLED_PASS_RENDERED");
      }
      if (report.templateFamily === "RETAINED_MULTI_EXAM_I_X") {
        assertEqual(
          JSON.stringify(report.content.combinedResults.map((row) => row.configuredWeight)),
          JSON.stringify(frozen.combinedResults.map((row: any) => row.configuredWeight ?? null)),
          "configured combined weights"
        );
      }
    }
    if (!card.events.some((row) => row.eventType === "PUBLICATION_ISSUED")) {
      throw new Error("EXAM3QA_PUBLICATION_AUDIT_MISSING");
    }
  }
  if (versionCount !== 6 || families.size !== 4) {
    throw new Error(`EXAM3QA_VERSION_OR_FAMILY_COUNT_${versionCount}_${families.size}`);
  }
  const replacement = cards.find((card) => card.currentVersionNumber === 2);
  if (!replacement || replacement.versions[1].supersedesVersionId !== replacement.versions[0].id) {
    throw new Error("EXAM3QA_REPLACEMENT_LINK_MISSING");
  }
}

async function verifyReadinessAndRoleDenials(
  client: PrismaClient,
  state: QaState,
  principal: { id: string; name: string; role: "PRINCIPAL" }
) {
  const base = await client.studentResultSnapshot.findFirstOrThrow({
    where: { calculationRunId: state.runs.primaryA }
  });
  const incomplete = await cloneSnapshot(client, base, base.studentId, "EXAM3QA-RUN-INCOMPLETE", 91, {
    runStatus: "FAILED",
    locked: true
  });
  const unlocked = await cloneSnapshot(client, base, base.studentId, "EXAM3QA-RUN-UNLOCKED", 92, {
    runStatus: "PREVIEW",
    locked: false
  });
  for (const [runId, studentId] of [
    [incomplete.calculationRunId, base.studentId],
    [unlocked.calculationRunId, base.studentId],
    [state.runs.secondary, state.students.secondary.id]
  ]) {
    await expectPublicationError(
      () => previewReportPublication(client, publicationInput(runId, studentId), principal, FIXED_NOW),
      [409]
    );
  }
  const readyPreview = await previewReportPublication(
    client,
    publicationInput(state.runs.primaryA, base.studentId),
    principal,
    FIXED_NOW
  );
  for (const role of ["TEACHER", "ACCOUNTANT", "VIEWER", "PARENT"] as const) {
    await expectPublicationError(
      () => publishReportCards(client, {
        ...publicationInput(state.runs.primaryA, base.studentId),
        requestKey: `EXAM3QA:DENY:${role}:0001`,
        previewFingerprint: readyPreview.fingerprint
      }, { id: `EXAM3QA-${role}`, name: `EXAM3QA ${role}`, role } as any, FIXED_NOW),
      [403]
    );
  }
}

async function verifyConcurrentPublicationAndRollback(
  client: PrismaClient,
  principal: { id: string; name: string; role: "PRINCIPAL" }
) {
  const base = await client.studentResultSnapshot.findFirstOrThrow({
    where: { calculationRunId: { startsWith: "EXAM3QA-RUN-primaryA" } }
  });
  const concurrentStudent = await createQaStudent(client, "EXAM3QA-CON-001", "EXAM3QA Concurrent Publication Learner", base);
  const concurrent = await cloneSnapshot(client, base, concurrentStudent.id, "EXAM3QA-RUN-CONCURRENT", 1, {
    runStatus: "PREVIEW",
    locked: true
  });
  const input = publicationInput(concurrent.calculationRunId, concurrentStudent.id);
  const preview = await previewReportPublication(client, input, principal, FIXED_NOW);
  const results = await Promise.all([
    publishReportCards(client, { ...input, requestKey: "EXAM3QA:CONCURRENT:0001", previewFingerprint: preview.fingerprint }, principal, FIXED_NOW),
    publishReportCards(client, { ...input, requestKey: "EXAM3QA:CONCURRENT:0001", previewFingerprint: preview.fingerprint }, principal, FIXED_NOW)
  ]);
  if (results.filter((row) => row.idempotent).length !== 1 || results.filter((row) => !row.idempotent).length !== 1) {
    throw new Error("EXAM3QA_CONCURRENT_PUBLICATION_NOT_IDEMPOTENT");
  }
  if (await client.studentReportCard.count({ where: { studentId: concurrentStudent.id } }) !== 1) {
    throw new Error("EXAM3QA_CONCURRENT_PUBLICATION_DUPLICATED_CARD");
  }

  const failedStudent = await createQaStudent(client, "EXAM3QA-FAIL-001", "EXAM3QA Forced Rollback Learner", base);
  const failedSource = await cloneSnapshot(client, base, failedStudent.id, "EXAM3QA-RUN-FORCED-ROLLBACK", 1, {
    runStatus: "PREVIEW",
    locked: true
  });
  const failedInput = publicationInput(failedSource.calculationRunId, failedStudent.id);
  const failedPreview = await previewReportPublication(client, failedInput, principal, FIXED_NOW);
  const beforeBatches = await client.reportCardBatch.count();
  const sqlite = new DatabaseSync(assertIsolatedDatabasePath((client as any)._engineConfig?.datasourceUrl?.replace("file:", "") || readState().databasePath));
  try {
    sqlite.exec(`CREATE TRIGGER EXAM3QA_FORCE_PUBLICATION_FAILURE BEFORE INSERT ON StudentReportCardVersion BEGIN SELECT RAISE(ABORT, 'EXAM3QA injected publication failure'); END;`);
    let failed = false;
    try {
      await publishReportCards(client, {
        ...failedInput,
        requestKey: "EXAM3QA:FORCED-ROLLBACK:0001",
        previewFingerprint: failedPreview.fingerprint
      }, principal, FIXED_NOW);
    } catch {
      failed = true;
    }
    if (!failed) throw new Error("EXAM3QA_FORCED_PUBLICATION_FAILURE_DID_NOT_FAIL");
  } finally {
    sqlite.exec("DROP TRIGGER IF EXISTS EXAM3QA_FORCE_PUBLICATION_FAILURE");
    sqlite.close();
  }
  if (
    await client.reportCardBatch.count() !== beforeBatches ||
    await client.studentReportCard.count({ where: { studentId: failedStudent.id } }) !== 0
  ) {
    throw new Error("EXAM3QA_FORCED_PUBLICATION_LEFT_PARTIAL_ACTIVE_DATA");
  }
}

async function verifyParentWithdrawalPolicy(
  client: PrismaClient,
  state: QaState,
  parent: { id: string; name: string; role: "PARENT" },
  principal: { id: string; name: string; role: "PRINCIPAL" }
) {
  const before = await getParentPublishedReports(client, parent.id);
  if (before.children.length !== 2 || before.reportCards.length !== 1) {
    throw new Error("EXAM3QA_PARENT_LINKED_CHILD_MATRIX_INVALID");
  }
  const current = before.reportCards[0].versions.find((row: any) => row.viewable);
  if (!current) throw new Error("EXAM3QA_PARENT_CURRENT_ISSUED_REPORT_MISSING");
  await authorizeParentReportAccess(client, {
    publicationReference: current.publicationReference,
    action: "VIEW",
    mode: "COLOUR"
  }, parent, FIXED_NOW);
  for (const role of ["TEACHER", "ACCOUNTANT", "VIEWER"] as const) {
    await expectPublicationError(
      () => authorizeParentReportAccess(client, {
        publicationReference: current.publicationReference,
        action: "VIEW",
        mode: "COLOUR"
      }, { id: `EXAM3QA-${role}`, name: role, role } as any, FIXED_NOW),
      [403]
    );
  }
  await expectPublicationError(
    () => getParentPublishedReports(client, state.unrelatedParent.id, before.selectedChild?.studentReference),
    [404]
  );
  await expectPublicationError(
    () => getParentPublishedReports(client, parent.id, state.students.combined.id),
    [404]
  );
  const kgCard = await client.studentReportCard.findFirstOrThrow({
    where: { studentId: state.students.kg.id }
  });
  await withdrawPublishedReport(client, {
    reportCardNumber: kgCard.reportCardNumber,
    reason: "EXAM3QA governed withdrawal visibility rehearsal",
    expectedVersion: kgCard.currentVersionNumber,
    expectedUpdatedAt: kgCard.updatedAt.toISOString()
  }, principal, new Date(FIXED_NOW.getTime() + 30_000));
  const after = await getParentPublishedReports(client, parent.id);
  const withdrawn = after.reportCards[0]?.versions.find((row: any) => row.status === "WITHDRAWN");
  if (!withdrawn || withdrawn.viewable) throw new Error("EXAM3QA_WITHDRAWN_PARENT_POLICY_FAILED");
  await expectPublicationError(
    () => authorizeParentReportAccess(client, {
      publicationReference: withdrawn.publicationReference,
      action: "VIEW",
      mode: "COLOUR"
    }, parent, FIXED_NOW),
    [404]
  );
}

async function verifyPdfOutputs(
  client: PrismaClient,
  state: QaState,
  principal: { id: string; name: string; role: "PRINCIPAL" }
) {
  if (state.visualFiles.length !== 8) throw new Error("EXAM3QA_VISUAL_PDF_COUNT");
  for (const file of state.visualFiles) {
    if (!existsSync(file) || !path.basename(file).startsWith("EXAM3QA-")) {
      throw new Error("EXAM3QA_VISUAL_PDF_MISSING_OR_MISNAMED");
    }
    const bytes = readFileSync(file);
    if (bytes.length < 4_000 || bytes.subarray(0, 4).toString() !== "%PDF") {
      throw new Error("EXAM3QA_VISUAL_PDF_INVALID");
    }
    const document = await PDFDocument.load(bytes);
    if (document.getPageCount() < 1) throw new Error("EXAM3QA_VISUAL_PDF_EMPTY");
    const combined = file.includes("RETAINED_MULTI_EXAM_I_X");
    for (const page of document.getPages()) {
      const { width, height } = page.getSize();
      if (combined ? width <= height : width >= height) {
        throw new Error("EXAM3QA_PDF_ORIENTATION_POLICY_FAILED");
      }
      const long = Math.max(width, height);
      const short = Math.min(width, height);
      if (Math.abs(long - 841.89) > 2 || Math.abs(short - 595.28) > 2) {
        throw new Error("EXAM3QA_PDF_NOT_A4");
      }
    }
  }
  const merged = readCompletedReportPdfArtifact(state.jobKeys[0], principal);
  const zipped = readCompletedReportPdfArtifact(state.jobKeys[1], principal);
  const mergedDocument = await PDFDocument.load(merged.bytes);
  if (mergedDocument.getPageCount() < 5) throw new Error("EXAM3QA_MERGED_PDF_PAGE_COUNT");
  const zipEntries = unzipSync(zipped.bytes);
  const zipNames = Object.keys(zipEntries);
  if (zipNames.length !== 5 || new Set(zipNames).size !== 5) throw new Error("EXAM3QA_ZIP_DUPLICATE_OR_MISSING_FILES");
  if (zipNames.some((name) => !/^[A-Za-z0-9._-]+\.pdf$/.test(name) || name.includes(".."))) {
    throw new Error("EXAM3QA_ZIP_UNSAFE_NAME");
  }
  const currentCards = await client.studentReportCard.findMany({
    where: { student: { admissionNo: { startsWith: "EXAM3QA-" } }, currentVersionNumber: { gt: 0 } },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } }
  });
  const originalFive = currentCards.filter((card) => state.students && Object.values(state.students).some((row) => row.id === card.studentId));
  const expectedZipNames = originalFive.map((card) => deterministicReportPdfName(parsePublishedSnapshot(card.versions[0].snapshotJson), "MONOCHROME")).sort();
  assertEqual(JSON.stringify(zipNames.sort()), JSON.stringify(expectedZipNames), "deterministic ZIP names");
  for (const bytes of Object.values(zipEntries)) {
    if (Buffer.from(bytes).subarray(0, 4).toString() !== "%PDF") throw new Error("EXAM3QA_ZIP_ENTRY_INVALID");
  }
  const one = parsePublishedSnapshot(originalFive[0].versions[0].snapshotJson);
  const individual = await renderReportPdf(one, "COLOUR");
  if (individual.subarray(0, 4).toString() !== "%PDF") throw new Error("EXAM3QA_INDIVIDUAL_PDF_INVALID");

  const completedBefore = getReportPdfJob(state.jobKeys[0], principal);
  await expectPublicationError(() => retryReportPdfJob(client, completedBefore.jobKey, principal), [409]);
  const retried = await retryReportPdfJob(client, state.jobKeys[2], principal);
  const finalRetry = await waitForJob(retried.jobKey, principal);
  if (finalRetry.status !== "COMPLETED" || finalRetry.attempt !== 2 || finalRetry.failed !== 0) {
    throw new Error("EXAM3QA_FAILED_JOB_RETRY_FAILED");
  }
  const access = await authorizeReportPdfJobDownload(client, state.jobKeys[0], principal, FIXED_NOW);
  const token = new URL(access.url, "http://localhost").searchParams.get("token");
  const downloaded = resolveReportPdfJobDownload(state.jobKeys[0], token, principal, FIXED_NOW);
  if (downloaded.bytes.length !== merged.bytes.length) throw new Error("EXAM3QA_AUTHENTICATED_DOWNLOAD_MISMATCH");
  await expectPublicationError(
    async () => resolveReportPdfJobDownload(state.jobKeys[0], token, { id: "EXAM3QA-OTHER", role: "PRINCIPAL" }, FIXED_NOW),
    [403]
  );
  await expectPublicationError(
    async () => resolveReportPdfJobDownload(state.jobKeys[0], token, principal, new Date(FIXED_NOW.getTime() + 301_000)),
    [403]
  );
}

async function verifySecuritySourceBoundaries() {
  const middleware = readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
  const publication = readFileSync(path.join(process.cwd(), "app/api/report-cards/publication/route.ts"), "utf8");
  const correction = readFileSync(path.join(process.cwd(), "app/api/report-cards/publication/workflow/route.ts"), "utf8");
  const parentAccess = readFileSync(path.join(process.cwd(), "app/api/parent/report-cards/access/route.ts"), "utf8");
  const jobRoute = readFileSync(path.join(process.cwd(), "app/api/report-cards/pdf-jobs/route.ts"), "utf8");
  if (!publication.includes('requireApiPermission("ISSUE_REPORT_CARDS")')) throw new Error("EXAM3QA_ISSUE_PERMISSION_ROUTE_MISSING");
  if (!correction.includes('requireApiPermission("CORRECT_ISSUED_REPORT_CARDS")')) throw new Error("EXAM3QA_CORRECT_PERMISSION_ROUTE_MISSING");
  if (!jobRoute.includes('requireApiPermission("EXPORT_REPORT_CARD_REPORTS")')) throw new Error("EXAM3QA_EXPORT_PERMISSION_ROUTE_MISSING");
  if (!parentAccess.includes('requireApiRolePermission("VIEW_OWN_REPORT_CARDS", "PARENT")')) throw new Error("EXAM3QA_PARENT_PERMISSION_ROUTE_MISSING");
  if (!middleware.includes('pathname.startsWith("/api/")') || !middleware.includes('"private, no-store"')) throw new Error("EXAM3QA_PRIVATE_NO_STORE_MIDDLEWARE_MISSING");
  if (!middleware.includes("unsafeRequestOriginAllowed")) throw new Error("EXAM3QA_ORIGIN_CSRF_MIDDLEWARE_MISSING");
  for (const file of [publication, correction, parentAccess]) {
    if (/export\s+async\s+function\s+GET/.test(file)) throw new Error("EXAM3QA_STATE_CHANGE_GET_EXPOSED");
  }
  const serverSource = [
    "lib/report-publication.ts",
    "lib/report-parent-delivery.ts",
    "lib/report-pdf-jobs.ts",
    "lib/report-pdf.ts"
  ].map((file) => readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
  if (/openai|anthropic|gemini|external ai|https?:\/\//i.test(serverSource) || /\bfetch\s*\(/.test(serverSource)) {
    throw new Error("EXAM3QA_EXTERNAL_PROVIDER_PATH_DETECTED");
  }
  if (!serverSource.includes("MAX_REPORT_PUBLICATION_BATCH = 60") || !serverSource.includes("MAX_ACTIVE_REPORT_PDF_JOBS = 2")) {
    throw new Error("EXAM3QA_BATCH_BOUNDARY_MISSING");
  }
}

async function verifyBackupRestore(client: PrismaClient, state: QaState) {
  const backup = await generateFullBackup(client, {
    generatedAt: FIXED_NOW,
    generatedBy: "EXAM3QA independent copied-database audit"
  });
  const serialized = serializeBackup(backup);
  writeFileSync(BACKUP_PATH, serialized, "utf8");
  if (
    /"passwordHash"\s*:/.test(serialized) ||
    serialized.includes(state.principal.password) ||
    serialized.includes(state.parent.password) ||
    serialized.includes(state.unrelatedParent.password)
  ) {
    throw new Error("EXAM3QA_BACKUP_INCLUDED_CREDENTIALS");
  }
  const validated = parseAndValidateBackup(JSON.parse(serialized));
  if (validated.metadata.backupVersion !== 45) throw new Error("EXAM3QA_BACKUP_VERSION_CHANGED");
  const pdfFilesBefore = existsSync(PDF_ROOT)
    ? readdirSync(PDF_ROOT).filter((name) => name.includes("EXAM3QA")).sort()
    : [];
  const restorePath = createEmptyIsolatedDatabase("restore", "EXAM3QA-release");
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], restorePath);
  const target = new PrismaClient({ datasourceUrl: databaseUrl(restorePath) });
  const actor = { id: "EXAM3QA-restore-actor", name: "EXAM3QA Restore Actor" };
  try {
    await target.user.create({
      data: {
        id: actor.id,
        name: actor.name,
        username: "exam3qa-restore-actor",
        role: "DIRECTOR",
        isActive: true,
        passwordHash: await hashPassword(`EXAM3QA-${randomBytes(24).toString("base64url")}!aA9`)
      }
    });
    const first = await restoreValidatedBackup(target, validated, actor);
    assertRestoreNoErrors(first as any);
    const firstCounts = await reportRestoreCounts(target);
    const second = await restoreValidatedBackup(target, validated, actor);
    assertRestoreNoErrors(second as any);
    const secondCounts = await reportRestoreCounts(target);
    assertEqual(JSON.stringify(firstCounts), JSON.stringify(secondCounts), "double restore counts");
    const pdfFilesAfter = existsSync(PDF_ROOT)
      ? readdirSync(PDF_ROOT).filter((name) => name.includes("EXAM3QA")).sort()
      : [];
    assertEqual(JSON.stringify(pdfFilesAfter), JSON.stringify(pdfFilesBefore), "restore PDF artifact set");
    const replacement = await target.studentReportCard.findFirst({
      where: { currentVersionNumber: 2 },
      include: { versions: { orderBy: { versionNumber: "asc" } } }
    });
    if (!replacement || replacement.versions[1].supersedesVersionId !== replacement.versions[0].id) {
      throw new Error("EXAM3QA_RESTORE_REPLACEMENT_LINK_LOST");
    }
    if (firstCounts.cards < 6 || firstCounts.versions < 7) {
      throw new Error("EXAM3QA_RESTORE_PUBLICATION_COUNTS_INVALID");
    }
  } finally {
    await target.$disconnect();
    cleanupIsolatedDatabase(restorePath);
  }
}

async function verifyAuditPrivacy(client: PrismaClient, state: QaState) {
  const events = await client.studentReportCardEvent.findMany({
    where: { reportCard: { student: { admissionNo: { startsWith: "EXAM3QA-" } } } }
  });
  const joined = events.map((row) => `${row.actorLabel ?? ""}\n${row.notes ?? ""}`).join("\n");
  if (/900000|synthetic copied-database address|EXAM3QA-[A-Za-z0-9_-]{20,}!aA9/i.test(joined)) {
    throw new Error("EXAM3QA_AUDIT_PII_OR_SECRET_LEAK");
  }
  if (!events.some((row) => row.eventType === "PUBLICATION_WITHDRAWN") ||
      !events.some((row) => row.eventType === "PUBLICATION_REPLACED") ||
      !events.some((row) => row.eventType === "REPORT_PDF_GENERATED") ||
      !events.some((row) => row.eventType === "PARENT_VIEW_AUTHORIZED")) {
    throw new Error("EXAM3QA_AUDIT_LIFECYCLE_INCOMPLETE");
  }
  if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) throw new Error("EXAM3QA_OPERATIONAL_SOURCE_CHANGED_AFTER_AUDIT");
}

async function cleanup() {
  if (existsSync(STATE_PATH)) runGeneratedHarness("cleanup");
  cleanupLooseArtifacts();
  inspectCleanup();
  console.log("EXAM3QA copied database, backup/restore copy, PDFs, ZIPs, jobs, state and generated harness removed.");
}

function inspectCleanup() {
  const residuals: string[] = [];
  for (const root of [path.join(process.cwd(), "tmp")]) {
    if (!existsSync(root)) continue;
    walk(root, (file) => {
      if (path.basename(file).toUpperCase().includes("EXAM3QA")) residuals.push(file);
    });
  }
  if (existsSync(PDF_ROOT) && readdirSync(PDF_ROOT).length) residuals.push(PDF_ROOT);
  if (residuals.length) throw new Error(`EXAM3QA_CLEANUP_RESIDUALS_${residuals.length}`);
  const baseline = businessBaseline(OPERATIONAL_DATABASE);
  if (baseline.students || baseline.activeEnrollments || baseline.payments || baseline.collected) {
    throw new Error("EXAM3QA_OPERATIONAL_BASELINE_CHANGED_DURING_CLEANUP");
  }
  console.log("EXAM3QA cleanup inspection passed: zero namespaced residuals and operational business data remains zero.");
}

function cleanupLooseArtifacts() {
  if (existsSync(PDF_ROOT)) rmSync(PDF_ROOT, { recursive: true, force: true });
  for (const root of [
    path.join(QA_ROOT, "reports"),
    path.join(QA_ROOT, "operational-copy"),
    path.join(QA_ROOT, "restore")
  ]) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (!entry.toUpperCase().includes(PREFIX)) continue;
      const target = path.resolve(root, entry);
      const relative = path.relative(process.cwd(), target);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("EXAM3QA_CLEANUP_PATH_REFUSED");
      }
      if (target.endsWith(".db")) cleanupIsolatedDatabase(target);
      else rmSync(target, { recursive: true, force: true });
    }
  }
  for (const file of [GENERATED_HARNESS, BACKUP_PATH]) {
    const resolved = path.resolve(file);
    const relative = path.relative(process.cwd(), resolved);
    if (!relative.startsWith("..") && !path.isAbsolute(relative) && existsSync(resolved)) {
      if (resolved.endsWith(".db")) cleanupIsolatedDatabase(resolved);
      else rmSync(resolved, { force: true });
    }
  }
}

async function cloneSnapshot(
  client: PrismaClient,
  base: any,
  studentId: string,
  calculationRunId: string,
  snapshotVersion: number,
  options: { runStatus: string; locked: boolean }
) {
  const snapshot = await client.studentResultSnapshot.create({
    data: {
      calculationRunId,
      inputFingerprint: `${PREFIX}-${calculationRunId}-FINGERPRINT`,
      runNumber: 90 + snapshotVersion,
      runStatus: options.runStatus,
      examinationId: base.examinationId,
      classScopeId: base.classScopeId,
      studentId,
      schemeVersionId: base.schemeVersionId,
      snapshotVersion,
      totalObtained: base.totalObtained,
      totalMaximum: base.totalMaximum,
      percentage: base.percentage,
      gradeCode: base.gradeCode,
      gradePoint: base.gradePoint,
      passResult: base.passResult,
      rankValue: base.rankValue,
      formulaVersion: base.formulaVersion,
      roundingPolicyVersion: base.roundingPolicyVersion,
      warningsJson: base.warningsJson,
      sourceSheetVersionsJson: base.sourceSheetVersionsJson,
      sourceSchemeVersionsJson: base.sourceSchemeVersionsJson,
      snapshotJson: base.snapshotJson,
      calculatedByUserId: base.calculatedByUserId,
      calculatedAt: FIXED_NOW,
      lockedByUserId: options.locked ? base.calculatedByUserId : null,
      lockedAt: options.locked ? FIXED_NOW : null
    }
  });
  if (options.locked) {
    await client.examinationSchemeAudit.create({
      data: {
        eventKey: `${PREFIX}-LOCK-${calculationRunId}`,
        examinationId: base.examinationId,
        schemeVersionId: base.schemeVersionId,
        eventType: "CALCULATION_SNAPSHOT_LOCKED",
        targetType: "EXAM_CALCULATION_RUN",
        targetId: calculationRunId,
        previousStatus: "PREVIEW",
        newStatus: "LOCKED",
        reason: "EXAM3QA independent readiness fixture",
        actorUserId: base.calculatedByUserId,
        actorRole: "PRINCIPAL",
        snapshotJson: JSON.stringify({ snapshotIds: [snapshot.id], studentCount: 1 }),
        eventDate: FIXED_NOW
      }
    });
  }
  return snapshot;
}

async function createQaStudent(client: PrismaClient, admissionNo: string, studentName: string, base: any) {
  const sourceStudent = await client.student.findUniqueOrThrow({ where: { id: base.studentId } });
  return client.student.create({
    data: {
      academicYear: sourceStudent.academicYear,
      admissionNo,
      studentName,
      fatherName: "EXAM3QA Synthetic Parent",
      motherName: "EXAM3QA Synthetic Parent",
      className: sourceStudent.className,
      section: sourceStudent.section,
      rollNo: admissionNo.slice(-3),
      phone1: "9000000398",
      address: "EXAM3QA copied-database-only address",
      dateOfBirth: sourceStudent.dateOfBirth,
      remarks: "EXAM3QA independent fixture only"
    }
  });
}

function publicationInput(runId: string, studentId: string) {
  return {
    calculationRunIds: [runId],
    scope: "INDIVIDUAL",
    studentIds: [studentId],
    studentAdmissionNumbers: []
  };
}

async function expectPublicationError(action: () => Promise<unknown>, statuses: number[]) {
  try {
    await action();
  } catch (error) {
    if (error instanceof ReportPublicationError && statuses.includes(error.status)) return;
    throw error;
  }
  throw new Error(`EXAM3QA_EXPECTED_ERROR_${statuses.join("_")}`);
}

async function waitForJob(jobKey: string, actor: { id: string; role: "PRINCIPAL" }) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const job = getReportPdfJob(jobKey, actor);
    if (job.status === "COMPLETED" || job.status === "FAILED") return job;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("EXAM3QA_PDF_JOB_TIMEOUT");
}

function assertRestoreNoErrors(result: Record<string, unknown>) {
  for (const [key, value] of Object.entries(result)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const errors = (value as { errors?: unknown[] }).errors;
    if (errors?.length) throw new Error(`EXAM3QA_RESTORE_ERRORS_${key}_${errors.length}`);
  }
}

async function reportRestoreCounts(client: PrismaClient) {
  return {
    cards: await client.studentReportCard.count(),
    versions: await client.studentReportCardVersion.count(),
    events: await client.studentReportCardEvent.count(),
    withdrawn: await client.studentReportCard.count({ where: { status: "WITHDRAWN" } })
  };
}

function verifyOperationalBaseline(expectedHash: string) {
  const baseline = businessBaseline(OPERATIONAL_DATABASE);
  if (baseline.students || baseline.activeEnrollments || baseline.payments || baseline.collected) {
    throw new Error("EXAM3QA_OPERATIONAL_BUSINESS_BASELINE_CHANGED");
  }
  if (fileSha256(OPERATIONAL_DATABASE) !== expectedHash) throw new Error("EXAM3QA_OPERATIONAL_HASH_CHANGED");
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`EXAM3QA_MISMATCH_${label.replaceAll(" ", "_")}`);
}

function walk(root: string, visit: (file: string) => void) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walk(full, visit);
    else visit(full);
  }
}

function lastUsefulLine(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-1)[0] ?? "EXAM3QA harness completed.";
}

async function main() {
  const command = process.argv.slice(2).find((value) => value !== "--")?.toLowerCase();
  if (command === "prepare") await prepare();
  else if (command === "audit") await audit();
  else if (command === "cleanup") await cleanup();
  else if (command === "inspect-cleanup") inspectCleanup();
  else {
    console.error("Usage: pnpm.cmd qa:exam3qa -- prepare|audit|cleanup|inspect-cleanup");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
