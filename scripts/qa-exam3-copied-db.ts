import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { DEFAULT_KG_TEMPLATE, DEFAULT_MARK_TEMPLATE } from "../lib/report-card-templates";
import {
  authorizeParentReportAccess,
  getParentPublishedReports,
  resolveParentReportToken
} from "../lib/report-parent-delivery";
import {
  createReportPdfJob,
  getReportPdfJob,
  processReportPdfJob,
  readCompletedReportPdfArtifact
} from "../lib/report-pdf-jobs";
import { renderReportPdf } from "../lib/report-pdf";
import {
  parsePublishedSnapshot,
  previewReportPublication,
  publishReportCards,
  replacePublishedReport,
  ReportPublicationError
} from "../lib/report-publication";
import type { GovernedReportTemplateFamily } from "../lib/report-publication-types";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  assertIsolatedDatabasePath,
  businessBaseline,
  cleanupIsolatedDatabase,
  createEmptyIsolatedDatabase,
  databaseUrl,
  fileSha256,
  runPrisma
} from "./migration-check-utils";

const PREFIX = "EXAM3";
const STATE_PATH = path.join(QA_ROOT, "reports", "EXAM3-browser-state.json");
const PDF_ROOT = path.join(process.cwd(), "tmp", "report-publication");
const RENDER_ROOT = path.join(QA_ROOT, "reports", "rendered");
const FIXED_NOW = new Date();

type QaState = {
  databasePath: string;
  sourceHash: string;
  principal: { id: string; username: string; password: string };
  browserAdmin: { id: string; username: string; password: string };
  parent: { id: string; username: string; password: string };
  unrelatedParent: { id: string; username: string; password: string };
  students: Record<string, { id: string; admissionNo: string }>;
  runs: Record<string, string>;
  jobKeys: string[];
  visualFiles: string[];
};

type ScopeSeed = {
  key: string;
  examination: any;
  family: GovernedReportTemplateFamily;
  template: any;
  className: string;
  section: string;
  student: any;
  paperCount: number;
  snapshotVersion?: number;
  runSuffix?: string;
};

function privatePassword() {
  return `${PREFIX}-${randomBytes(24).toString("base64url")}!aA9`;
}

function readState() {
  if (!existsSync(STATE_PATH)) throw new Error("EXAM3_QA_STATE_MISSING");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as QaState;
  state.databasePath = assertIsolatedDatabasePath(state.databasePath);
  return state;
}

function safeRemoveStateArtifacts(state: QaState) {
  for (const file of state.visualFiles ?? []) {
    const resolved = path.resolve(file);
    const relative = path.relative(path.join(QA_ROOT, "reports"), resolved);
    if (!relative.startsWith("..") && !path.isAbsolute(relative) && existsSync(resolved)) {
      rmSync(resolved, { force: true });
    }
  }
  if (existsSync(PDF_ROOT)) {
    const ownedJobKeys = new Set(state.jobKeys ?? []);
    for (const name of readdirSync(PDF_ROOT)) {
      if (!name.endsWith(".job.json")) continue;
      try {
        const manifest = JSON.parse(readFileSync(path.join(PDF_ROOT, name), "utf8"));
        if (manifest.actorLabel === "EXAM3 Principal" && String(manifest.jobKey ?? "").startsWith("RPJ-")) {
          ownedJobKeys.add(manifest.jobKey);
        }
      } catch {}
    }
    for (const jobKey of ownedJobKeys) {
      for (const name of readdirSync(PDF_ROOT)) {
        if (name.startsWith(`${jobKey}-`) || name === `${jobKey}.job.json`) {
          rmSync(path.join(PDF_ROOT, name), { force: true });
        }
      }
    }
  }
  if (existsSync(RENDER_ROOT)) rmSync(RENDER_ROOT, { recursive: true, force: true });
}

async function prepare() {
  if (existsSync(STATE_PATH)) {
    const prior = readState();
    safeRemoveStateArtifacts(prior);
    cleanupIsolatedDatabase(prior.databasePath);
    rmSync(STATE_PATH, { force: true });
  }
  const sourceHash = fileSha256(OPERATIONAL_DATABASE);
  const databasePath = createEmptyIsolatedDatabase("operational-copy", "EXAM3-browser");
  copyFileSync(OPERATIONAL_DATABASE, databasePath);
  if (fileSha256(databasePath) !== sourceHash) throw new Error("EXAM3_COPY_HASH_MISMATCH");
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databasePath);
  const client = new PrismaClient({ datasourceUrl: databaseUrl(databasePath) });
  let prepared = false;
  try {
    const principalPassword = privatePassword();
    const parentPassword = privatePassword();
    const unrelatedPassword = privatePassword();
    const browserAdminPassword = privatePassword();
    const [principalHash, parentHash, unrelatedHash, browserAdminHash] = await Promise.all([
      hashPassword(principalPassword),
      hashPassword(parentPassword),
      hashPassword(unrelatedPassword),
      hashPassword(browserAdminPassword)
    ]);
    const principal = await client.user.create({
      data: {
        name: "EXAM3 Principal",
        username: "exam3-principal",
        passwordHash: principalHash,
        role: "PRINCIPAL",
        isActive: true
      }
    });
    for (const permission of [
      "VIEW_REPORT_CARDS",
      "MANAGE_REPORT_CARD_TEMPLATES",
      "ISSUE_REPORT_CARDS",
      "CORRECT_ISSUED_REPORT_CARDS",
      "EXPORT_REPORT_CARD_REPORTS"
    ]) {
      await client.rolePermission.upsert({
        where: { role_permission: { role: "PRINCIPAL", permission } },
        update: { enabled: true },
        create: { role: "PRINCIPAL", permission, enabled: true }
      });
    }
    const guardian = await client.guardian.create({
      data: {
        displayName: "EXAM3 Linked Parent",
        primaryMobile: "9000000301",
        relationship: "Parent"
      }
    });
    const unrelatedGuardian = await client.guardian.create({
      data: {
        displayName: "EXAM3 Unrelated Parent",
        primaryMobile: "9000000302",
        relationship: "Parent"
      }
    });
    const parent = await client.user.create({
      data: {
        name: "EXAM3 Linked Parent",
        username: "exam3-parent",
        passwordHash: parentHash,
        role: "PARENT",
        guardianId: guardian.id,
        isActive: true
      }
    });
    const unrelatedParent = await client.user.create({
      data: {
        name: "EXAM3 Unrelated Parent",
        username: "exam3-unrelated-parent",
        passwordHash: unrelatedHash,
        role: "PARENT",
        guardianId: unrelatedGuardian.id,
        isActive: true
      }
    });
    const browserAdmin = await client.user.create({
      data: {
        name: "EXAM3 Synthetic Browser Admin",
        username: "exam3-browser-admin",
        passwordHash: browserAdminHash,
        role: "SUPER_ADMIN",
        isActive: true
      }
    });
    for (const user of [principal, parent, unrelatedParent, browserAdmin]) {
      await client.authLoginAlias.create({
        data: {
          userId: user.id,
          type: "USERNAME",
          normalizedValue: user.username,
          displayMasked: user.username,
          status: "VERIFIED",
          isSchoolGoverned: true,
          verifiedAt: new Date("2026-07-31T08:00:00.000Z")
        }
      });
      await client.userRoleAssignment.create({
        data: {
          userId: user.id,
          role: user.role,
          status: "ACTIVE",
          reason: "EXAM3 isolated copied-database Browser fixture",
          assignedByUserId: user.id,
          activeKey: `${user.id}:${user.role}`
        }
      });
    }
    await client.schoolSettings.upsert({
      where: { id: "school" },
      update: {
        schoolName: "Nalanda Public School",
        addressLine1: "EXAM3 synthetic copied-database campus",
        city: "Hyderabad",
        academicYear: "2026-27"
      },
      create: {
        id: "school",
        schoolName: "Nalanda Public School",
        addressLine1: "EXAM3 synthetic copied-database campus",
        city: "Hyderabad",
        phone: "040-23513913",
        academicYear: "2026-27"
      }
    });
    const students = {
      kg: await createStudent(client, "EXAM3-KG-001", "Aaradhya EXAM3 Developmental Learner", "EXAM3 KG", "A", "01"),
      primaryA: await createStudent(client, "EXAM3-PRI-001", "Vivaan EXAM3 With An Intentionally Long Student Name For Wrapping", "EXAM3 Primary", "A", "11"),
      primaryB: await createStudent(client, "EXAM3-PRI-002", "Diya EXAM3", "EXAM3 Primary", "B", "12"),
      secondary: await createStudent(client, "EXAM3-SEC-001", "Ananya EXAM3 Secondary Learner", "EXAM3 Secondary", "A", "21"),
      combined: await createStudent(client, "EXAM3-COM-001", "Kabir EXAM3 Combined Result Learner", "EXAM3 Combined", "A", "31")
    };
    await client.studentGuardian.createMany({
      data: [
        { guardianId: guardian.id, studentId: students.kg.id, isPrimaryContact: true },
        { guardianId: guardian.id, studentId: students.secondary.id, isPrimaryContact: true },
        { guardianId: unrelatedGuardian.id, studentId: students.combined.id, isPrimaryContact: true }
      ]
    });
    const templates = {
      kg: await createTemplate(client, principal.id, "KG_DEVELOPMENTAL_BOOKLET", "EXAM3-KG-TEMPLATE"),
      primary: await createTemplate(client, principal.id, "PRIMARY_10_40_SKILLS", "EXAM3-PRIMARY-TEMPLATE"),
      secondary: await createTemplate(client, principal.id, "SECONDARY_10_40_GROUPED", "EXAM3-SECONDARY-TEMPLATE"),
      combined: await createTemplate(client, principal.id, "RETAINED_MULTI_EXAM_I_X", "EXAM3-COMBINED-TEMPLATE")
    };
    const examinations = {
      kg: await createExamination(client, principal.id, "EXAM3-KG", "EXAM3 KG Developmental Review"),
      primary: await createExamination(client, principal.id, "EXAM3-PRI", "EXAM3 Primary Term Review"),
      secondary: await createExamination(client, principal.id, "EXAM3-SEC", "EXAM3 Secondary Grouped Review"),
      combined: await createExamination(client, principal.id, "EXAM3-COM", "EXAM3 Configured Combined Review")
    };
    const scopeSeeds: ScopeSeed[] = [
      { key: "kg", examination: examinations.kg, family: "KG_DEVELOPMENTAL_BOOKLET", template: templates.kg, className: "EXAM3 KG", section: "A", student: students.kg, paperCount: 2 },
      { key: "primaryA", examination: examinations.primary, family: "PRIMARY_10_40_SKILLS", template: templates.primary, className: "EXAM3 Primary", section: "A", student: students.primaryA, paperCount: 4 },
      { key: "primaryB", examination: examinations.primary, family: "PRIMARY_10_40_SKILLS", template: templates.primary, className: "EXAM3 Primary", section: "B", student: students.primaryB, paperCount: 4 },
      { key: "secondary", examination: examinations.secondary, family: "SECONDARY_10_40_GROUPED", template: templates.secondary, className: "EXAM3 Secondary", section: "A", student: students.secondary, paperCount: 13 },
      { key: "combined", examination: examinations.combined, family: "RETAINED_MULTI_EXAM_I_X", template: templates.combined, className: "EXAM3 Combined", section: "A", student: students.combined, paperCount: 8 }
    ];
    const runs: Record<string, string> = {};
    for (const seed of scopeSeeds) {
      const result = await createLockedScope(client, principal.id, seed);
      runs[seed.key] = result.runId;
    }
    const state: QaState = {
      databasePath,
      sourceHash,
      principal: { id: principal.id, username: principal.username, password: principalPassword },
      browserAdmin: { id: browserAdmin.id, username: browserAdmin.username, password: browserAdminPassword },
      parent: { id: parent.id, username: parent.username, password: parentPassword },
      unrelatedParent: { id: unrelatedParent.id, username: unrelatedParent.username, password: unrelatedPassword },
      students: Object.fromEntries(Object.entries(students).map(([key, value]) => [key, { id: value.id, admissionNo: value.admissionNo }])),
      runs,
      jobKeys: [],
      visualFiles: []
    };
    writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    prepared = true;
    console.log("EXAM3 copied-database fixture prepared: 5 Students, 4 template families, 2 linked children, 1 unrelated child.");
  } finally {
    await client.$disconnect();
    if (!prepared) cleanupIsolatedDatabase(databasePath);
  }
  if (fileSha256(OPERATIONAL_DATABASE) !== sourceHash) throw new Error("EXAM3_OPERATIONAL_SOURCE_CHANGED");
}

async function exercise() {
  const state = readState();
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || randomBytes(48).toString("base64url");
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  const principal = { id: state.principal.id, name: "EXAM3 Principal", role: "PRINCIPAL" as const };
  const parent = { id: state.parent.id, name: "EXAM3 Linked Parent", role: "PARENT" as const };
  try {
    const publications = [
      { key: "kg", input: { calculationRunIds: [state.runs.kg], scope: "SECTION", studentIds: [], studentAdmissionNumbers: [] } },
      { key: "primary", input: { calculationRunIds: [state.runs.primaryA, state.runs.primaryB], scope: "CLASS", studentIds: [], studentAdmissionNumbers: [] } },
      { key: "secondary", input: { calculationRunIds: [state.runs.secondary], scope: "SECTION", studentIds: [], studentAdmissionNumbers: [] } },
      { key: "combined", input: { calculationRunIds: [state.runs.combined], scope: "INDIVIDUAL", studentIds: [], studentAdmissionNumbers: [state.students.combined.admissionNo] } }
    ] as const;
    const published: any[] = [];
    for (const publication of publications) {
      const preview = await previewReportPublication(client, publication.input, principal, FIXED_NOW);
      const result = await publishReportCards(client, {
        ...publication.input,
        requestKey: `EXAM3:PUBLISH:${publication.key}:0001`,
        previewFingerprint: preview.fingerprint
      }, principal, FIXED_NOW);
      if (result.idempotent || result.count !== preview.count) throw new Error(`EXAM3_${publication.key.toUpperCase()}_PUBLICATION_FAILED`);
      published.push(result);
    }
    const primaryPreview = await previewReportPublication(client, publications[1].input, principal, FIXED_NOW);
    const primaryIdempotent = await publishReportCards(client, {
      ...publications[1].input,
      requestKey: "EXAM3:PUBLISH:primary:0001",
      previewFingerprint: primaryPreview.fingerprint
    }, principal, FIXED_NOW);
    if (!primaryIdempotent.idempotent) throw new Error("EXAM3_PUBLICATION_IDEMPOTENCY_FAILED");

    const secondaryCard = await client.studentReportCard.findFirstOrThrow({
      where: { studentId: state.students.secondary.id },
      include: { versions: { orderBy: { versionNumber: "asc" } } }
    });
    const immutableOriginal = secondaryCard.versions[0].snapshotJson;
    const secondarySource = await client.studentResultSnapshot.findFirstOrThrow({
      where: { calculationRunId: state.runs.secondary },
      include: { examination: true, classScope: true, schemeVersion: true, student: true }
    });
    const replacementSeed = await createReplacementSnapshot(client, principal.id, secondarySource);
    state.runs.secondaryReplacement = replacementSeed.runId;
    await client.examinationSchemeAudit.create({
      data: {
        eventKey: "EXAM3-SUPERSEDE-SECONDARY-V1",
        examinationId: secondarySource.examinationId,
        schemeVersionId: secondarySource.schemeVersionId,
        eventType: "CALCULATION_SNAPSHOT_SUPERSEDED",
        targetType: "EXAM_CALCULATION_RUN",
        targetId: secondarySource.calculationRunId,
        previousStatus: "LOCKED",
        newStatus: "SUPERSEDED",
        reason: "EXAM3 governed correction rehearsal",
        actorUserId: principal.id,
        actorRole: principal.role,
        snapshotJson: JSON.stringify({ replacementRunId: replacementSeed.runId }),
        eventDate: new Date(FIXED_NOW.getTime() + 60_000)
      }
    });
    const replacementInput = {
      calculationRunIds: [replacementSeed.runId],
      scope: "INDIVIDUAL",
      studentIds: [state.students.secondary.id],
      studentAdmissionNumbers: []
    };
    const replacementPreview = await previewReportPublication(client, replacementInput, principal, new Date(FIXED_NOW.getTime() + 120_000));
    await replacePublishedReport(client, {
      ...replacementInput,
      reportCardNumber: secondaryCard.reportCardNumber,
      reason: "EXAM3 approved correction: one synthetic component was re-moderated.",
      requestKey: "EXAM3:REPLACE:secondary:0001",
      expectedVersion: 1,
      expectedUpdatedAt: secondaryCard.updatedAt.toISOString(),
      previewFingerprint: replacementPreview.fingerprint
    }, principal, new Date(FIXED_NOW.getTime() + 120_000));
    const replacedCard = await client.studentReportCard.findUniqueOrThrow({
      where: { id: secondaryCard.id },
      include: { versions: { orderBy: { versionNumber: "asc" } } }
    });
    if (replacedCard.currentVersionNumber !== 2 || replacedCard.versions.length !== 2) {
      throw new Error("EXAM3_REPLACEMENT_VERSION_FAILED");
    }
    if (replacedCard.versions[0].snapshotJson !== immutableOriginal) {
      throw new Error("EXAM3_ORIGINAL_VERSION_MUTATED");
    }

    const parentReports = await getParentPublishedReports(client, state.parent.id);
    if (parentReports.children.length !== 2 || parentReports.reportCards.length !== 1) {
      throw new Error("EXAM3_PARENT_LINKED_SCOPE_FAILED");
    }
    const unrelatedReports = await getParentPublishedReports(client, state.unrelatedParent.id);
    const unrelatedReference = unrelatedReports.children[0]?.studentReference;
    if (!unrelatedReference) throw new Error("EXAM3_UNRELATED_FIXTURE_MISSING");
    await expectPublicationError(
      () => getParentPublishedReports(client, state.parent.id, unrelatedReference),
      404,
      "EXAM3_CROSS_FAMILY_SELECTOR_NOT_BLOCKED"
    );
    await expectPublicationError(
      () => getParentPublishedReports(client, state.parent.id, state.students.secondary.id),
      404,
      "EXAM3_DIRECT_ID_SELECTOR_NOT_BLOCKED"
    );
    const currentReference = parentReports.reportCards[0]?.versions.find((row: any) => row.viewable)?.publicationReference;
    if (!currentReference) throw new Error("EXAM3_CURRENT_PARENT_REPORT_MISSING");
    const access = await authorizeParentReportAccess(client, {
      publicationReference: currentReference,
      action: "VIEW",
      mode: "MONOCHROME"
    }, parent, new Date(FIXED_NOW.getTime() + 180_000));
    const token = new URL(access.url, "http://localhost").searchParams.get("token");
    if (!token) throw new Error("EXAM3_PARENT_TOKEN_MISSING");
    const resolved = await resolveParentReportToken(client, token, parent, "VIEW", new Date(FIXED_NOW.getTime() + 181_000));
    if ("internal" in resolved.safeSnapshot.governance) throw new Error("EXAM3_INTERNAL_ID_EXPOSED");
    await expectPublicationError(
      () => resolveParentReportToken(client, `${token}x`, parent, "VIEW", new Date(FIXED_NOW.getTime() + 181_000)),
      403,
      "EXAM3_TAMPERED_TOKEN_NOT_BLOCKED"
    );

    const cards = await client.studentReportCard.findMany({
      where: { reportCardNumber: { startsWith: "NPS-RC-" }, status: "ISSUED" },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      orderBy: { reportCardNumber: "asc" }
    });
    if (cards.length !== 5) throw new Error(`EXAM3_ISSUED_REPORT_COUNT_${cards.length}`);
    const reportSelections = cards.map((card) => ({
      reportCardNumber: card.reportCardNumber,
      expectedVersion: card.currentVersionNumber
    }));
    await expectPublicationError(
      () => createReportPdfJob(client, {
        requestKey: "EXAM3:PDF:VERSION:0001",
        format: "MERGED_PDF",
        mode: "COLOUR",
        reports: [{ ...reportSelections[0], expectedVersion: 999 }]
      }, principal, FIXED_NOW, { deferProcessing: true }),
      409,
      "EXAM3_PDF_EXPECTED_VERSION_NOT_BLOCKED"
    );
    const [mergedQueued, zipQueued] = await Promise.all([
      createReportPdfJob(client, {
        requestKey: "EXAM3:PDF:MERGED:COLOUR:0001",
        format: "MERGED_PDF",
        mode: "COLOUR",
        reports: reportSelections
      }, principal, FIXED_NOW),
      createReportPdfJob(client, {
        requestKey: "EXAM3:PDF:ZIP:BW:0001",
        format: "ZIP",
        mode: "MONOCHROME",
        reports: reportSelections
      }, principal, FIXED_NOW)
    ]);
    const [merged, zip] = await Promise.all([
      waitForJob(mergedQueued.jobKey, principal),
      waitForJob(zipQueued.jobKey, principal)
    ]);
    if (merged.status !== "COMPLETED" || zip.status !== "COMPLETED") {
      throw new Error("EXAM3_CONCURRENT_BATCH_FAILED");
    }
    const failedQueued = await createReportPdfJob(client, {
      requestKey: "EXAM3:PDF:ROLLBACK:0001",
      format: "MERGED_PDF",
      mode: "COLOUR",
      reports: reportSelections.slice(0, 2)
    }, principal, FIXED_NOW, { deferProcessing: true });
    const failed = await processReportPdfJob(client, failedQueued.jobKey, {
      injectFailureAfter: 1,
      now: FIXED_NOW
    });
    if (failed.status !== "FAILED" || failed.artifactSha256 || failed.artifactBytes) {
      throw new Error("EXAM3_FAILED_PDF_ROLLBACK_FAILED");
    }
    if (existsSync(PDF_ROOT) && readdirSync(PDF_ROOT).some((name) =>
      name.startsWith(`${failed.jobKey}-`) && !name.endsWith(".job.json")
    )) {
      throw new Error("EXAM3_FAILED_PDF_LEFT_ARTIFACT");
    }
    state.jobKeys = [merged.jobKey, zip.jobKey, failed.jobKey];

    const mergedArtifact = readCompletedReportPdfArtifact(merged.jobKey, principal);
    const zipArtifact = readCompletedReportPdfArtifact(zip.jobKey, principal);
    if (!mergedArtifact.bytes.subarray(0, 4).equals(Buffer.from("%PDF")) ||
        zipArtifact.bytes.subarray(0, 2).toString("hex") !== "504b") {
      throw new Error("EXAM3_PACKAGE_MAGIC_INVALID");
    }
    const snapshots = cards.map((card) => parsePublishedSnapshot(card.versions[0].snapshotJson));
    const visualFiles: string[] = [];
    for (const family of [
      "KG_DEVELOPMENTAL_BOOKLET",
      "PRIMARY_10_40_SKILLS",
      "SECONDARY_10_40_GROUPED",
      "RETAINED_MULTI_EXAM_I_X"
    ] as GovernedReportTemplateFamily[]) {
      const report = snapshots.find((row) => row.templateFamily === family);
      if (!report) throw new Error(`EXAM3_VISUAL_${family}_MISSING`);
      for (const mode of ["COLOUR", "MONOCHROME"] as const) {
        const output = path.join(QA_ROOT, "reports", `EXAM3-${family}-${mode}.pdf`);
        writeFileSync(output, await renderReportPdf(report, mode));
        visualFiles.push(output);
      }
    }
    state.visualFiles = visualFiles;
    writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    console.log("EXAM3 exercise passed: individual/section/class publication, immutable replacement, Parent isolation, concurrent colour/B&W packaging, and failed-PDF rollback.");
  } finally {
    await client.$disconnect();
  }
  if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) throw new Error("EXAM3_OPERATIONAL_SOURCE_CHANGED");
}

async function inspect() {
  const state = readState();
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  try {
    const [students, snapshots, cards, versions, events] = await Promise.all([
      client.student.count({ where: { admissionNo: { startsWith: "EXAM3-" } } }),
      client.studentResultSnapshot.count({ where: { calculationRunId: { startsWith: "EXAM3-" } } }),
      client.studentReportCard.count({ where: { reportCardNumber: { startsWith: "NPS-RC-" } } }),
      client.studentReportCardVersion.count({
        where: { reportCard: { reportCardNumber: { startsWith: "NPS-RC-" } } }
      }),
      client.studentReportCardEvent.count({
        where: {
          eventType: {
            in: [
              "PUBLICATION_ISSUED",
              "PUBLICATION_REPLACED",
              "CORRECTION_ISSUED",
              "REPORT_PDF_GENERATED",
              "REPORT_PDF_GENERATION_FAILED",
              "PARENT_VIEW_AUTHORIZED"
            ]
          }
        }
      })
    ]);
    if (students !== 5 || snapshots !== 6 || cards !== 5 || versions !== 6 || events < 15) {
      throw new Error(`EXAM3_INSPECT_COUNTS_${students}_${snapshots}_${cards}_${versions}_${events}`);
    }
    if (state.visualFiles.length !== 8 || state.visualFiles.some((file) => !existsSync(file))) {
      throw new Error("EXAM3_VISUAL_OUTPUTS_INCOMPLETE");
    }
    const sourceBaseline = businessBaseline(OPERATIONAL_DATABASE);
    if (sourceBaseline.students || sourceBaseline.activeEnrollments || sourceBaseline.payments || sourceBaseline.collected) {
      throw new Error("EXAM3_OPERATIONAL_BUSINESS_BASELINE_CHANGED");
    }
    if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) throw new Error("EXAM3_OPERATIONAL_SOURCE_CHANGED");
    console.log(`EXAM3 inspection passed: Students=${students}, snapshots=${snapshots}, issued cards=${cards}, immutable versions=${versions}, governed audit events=${events}, visual PDFs=8.`);
  } finally {
    await client.$disconnect();
  }
}

async function cleanup() {
  if (!existsSync(STATE_PATH)) {
    console.log("EXAM3 cleanup: no fixture state was present.");
    return;
  }
  const state = readState();
  safeRemoveStateArtifacts(state);
  cleanupIsolatedDatabase(state.databasePath);
  rmSync(STATE_PATH, { force: true });
  if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) throw new Error("EXAM3_OPERATIONAL_SOURCE_CHANGED");
  console.log("EXAM3 copied database, private Browser credentials, PDF jobs, and rendered visual artifacts removed.");
}

async function createStudent(
  client: PrismaClient,
  admissionNo: string,
  studentName: string,
  className: string,
  section: string,
  rollNo: string
) {
  return client.student.create({
    data: {
      academicYear: "2026-27",
      admissionNo,
      studentName,
      fatherName: "EXAM3 Synthetic Parent",
      motherName: "EXAM3 Synthetic Parent",
      className,
      section,
      rollNo,
      phone1: "9000000399",
      address: "EXAM3 synthetic copied-database address",
      dateOfBirth: new Date("2016-01-15T00:00:00.000Z"),
      remarks: "EXAM3 synthetic fixture only"
    }
  });
}

async function createTemplate(
  client: PrismaClient,
  principalId: string,
  family: GovernedReportTemplateFamily,
  code: string
) {
  const kg = family === "KG_DEVELOPMENTAL_BOOKLET";
  const definition: any = kg
    ? structuredClone(DEFAULT_KG_TEMPLATE)
    : {
        ...structuredClone(DEFAULT_MARK_TEMPLATE),
        signatureLabels: ["Class Teacher", "Principal", "Parent / Guardian"]
      };
  if (family === "RETAINED_MULTI_EXAM_I_X") {
    definition.combinedResult = {
      enabled: true,
      sourceApprovalReference: "EXAM3-CONFIG-APPROVAL-001"
    };
  }
  return client.reportCardTemplate.create({
    data: {
      templateCode: code,
      name: `${family.replaceAll("_", " ")} EXAM3`,
      reportType: kg ? "KG_RUBRIC" : "MARK_BASED",
      academicYear: "2026-27",
      status: "ACTIVE",
      templateDefinitionJson: JSON.stringify(definition),
      printSettingsJson: JSON.stringify({
        orientation: family === "RETAINED_MULTI_EXAM_I_X" ? "LANDSCAPE" : "PORTRAIT",
        pageSize: "A4",
        minimumFontSizePt: 9,
        marginMm: 12
      }),
      versionNumber: 1,
      createdByUserId: principalId,
      activatedByUserId: principalId
    }
  });
}

async function createExamination(
  client: PrismaClient,
  principalId: string,
  examCode: string,
  name: string
) {
  return client.examination.create({
    data: {
      examCode,
      academicYear: "2026-27",
      name,
      examType: "TERM",
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2026-07-25T00:00:00.000Z"),
      status: "ACTIVE",
      description: "EXAM3 synthetic copied-database publication fixture only.",
      createdByUserId: principalId,
      activatedByUserId: principalId,
      activatedAt: new Date("2026-06-20T09:00:00.000Z")
    }
  });
}

async function createLockedScope(
  client: PrismaClient,
  principalId: string,
  seed: ScopeSeed
) {
  const classSection = await client.timetableClassSection.create({
    data: {
      academicYear: "2026-27",
      className: seed.className,
      section: seed.section,
      displayName: `${seed.className} - ${seed.section}`,
      groupName: "EXAM3 SYNTHETIC",
      isActive: true
    }
  });
  const classScope = await client.examinationClassScope.create({
    data: {
      examinationId: seed.examination.id,
      academicYear: "2026-27",
      className: seed.className,
      section: seed.section,
      timetableClassSectionId: classSection.id,
      status: "ACTIVE",
      createdByUserId: principalId
    }
  });
  const scheme = await client.examinationSchemeVersion.create({
    data: {
      examinationId: seed.examination.id,
      classScopeId: classScope.id,
      academicYear: "2026-27",
      className: seed.className,
      section: seed.section,
      scopeKey: "BASE",
      versionNumber: 1,
      calculationMode: seed.key === "combined" ? "WEIGHTED_NORMALIZED" : "RAW_SUM",
      passFailEnabled: true,
      passThresholdPercentage: new Prisma.Decimal(35),
      rankEnabled: seed.key !== "kg",
      status: "ACTIVE",
      createdByUserId: principalId,
      activatedByUserId: principalId,
      activatedAt: new Date("2026-06-20T09:30:00.000Z"),
      frozenAt: new Date("2026-06-20T09:30:00.000Z"),
      marksEntryOpenedAt: new Date("2026-06-21T09:30:00.000Z")
    }
  });
  const papers: any[] = [];
  for (let index = 0; index < seed.paperCount; index += 1) {
    const subject = await client.timetableSubject.create({
      data: {
        name: `${PREFIX} ${seed.key} Subject ${index + 1}`,
        shortName: `E3-${seed.key.toUpperCase()}-${index + 1}`,
        department: "EXAM3 Synthetic",
        isActive: true
      }
    });
    papers.push(await client.examSubjectPaper.create({
      data: {
        examinationId: seed.examination.id,
        classScopeId: classScope.id,
        academicYear: "2026-27",
        className: seed.className,
        section: seed.section,
        timetableSubjectId: subject.id,
        subjectNameSnapshot: index === seed.paperCount - 1
          ? "Environmental Studies and Community Awareness With A Very Long Governed Subject Label"
          : `${PREFIX} ${seed.key} Subject ${index + 1}`,
        paperCode: `P${index + 1}`,
        paperName: index === seed.paperCount - 1
          ? "Integrated observation, application and reflective learning paper"
          : `Paper ${index + 1}`,
        displayOrder: index + 1,
        status: "ACTIVE",
        createdByUserId: principalId
      }
    }));
  }
  await client.examTemplateFamilyBinding.create({
    data: {
      examinationId: seed.examination.id,
      classScopeId: classScope.id,
      academicYear: "2026-27",
      className: seed.className,
      section: seed.section,
      templateFamily: seed.family,
      reportCardTemplateId: seed.template.id,
      versionNumber: 1,
      status: "ACTIVE",
      evidenceStatus: "DIRECTLY_EVIDENCED",
      activatedByUserId: principalId,
      activatedAt: new Date("2026-06-20T10:00:00.000Z"),
      frozenAt: new Date("2026-06-20T10:00:00.000Z"),
      createdByUserId: principalId
    }
  });
  const runId = `EXAM3-RUN-${seed.key}-${seed.runSuffix ?? "V1"}`;
  const snapshotJson = reportSource(seed, papers, false);
  const totalMaximum = Math.max(100, seed.paperCount * 100);
  const totalObtained = Number((totalMaximum * 0.7875).toFixed(2));
  const snapshot = await client.studentResultSnapshot.create({
    data: {
      calculationRunId: runId,
      inputFingerprint: `EXAM3-FINGERPRINT-${seed.key}-${seed.runSuffix ?? "V1"}`,
      runNumber: seed.snapshotVersion ?? 1,
      runStatus: "PREVIEW",
      examinationId: seed.examination.id,
      classScopeId: classScope.id,
      studentId: seed.student.id,
      schemeVersionId: scheme.id,
      snapshotVersion: seed.snapshotVersion ?? 1,
      totalObtained: new Prisma.Decimal(totalObtained),
      totalMaximum: new Prisma.Decimal(totalMaximum),
      percentage: new Prisma.Decimal("78.75"),
      gradeCode: "A",
      gradePoint: new Prisma.Decimal("4.0"),
      passResult: "PASS",
      rankValue: seed.key === "kg" ? null : 1,
      formulaVersion: "EXAM_CALCULATION_V2",
      roundingPolicyVersion: "RC05_V1_DECIMAL6_HALF_UP2",
      warningsJson: "[]",
      sourceSheetVersionsJson: "[]",
      sourceSchemeVersionsJson: JSON.stringify([{ schemeVersionId: scheme.id, versionNumber: 1 }]),
      snapshotJson: JSON.stringify(snapshotJson),
      calculatedByUserId: principalId,
      calculatedAt: new Date("2026-07-29T08:00:00.000Z"),
      lockedByUserId: principalId,
      lockedAt: new Date("2026-07-29T08:05:00.000Z")
    }
  });
  await client.examinationSchemeAudit.create({
    data: {
      eventKey: `EXAM3-LOCK-${seed.key}-${seed.runSuffix ?? "V1"}`,
      examinationId: seed.examination.id,
      schemeVersionId: scheme.id,
      eventType: "CALCULATION_SNAPSHOT_LOCKED",
      targetType: "EXAM_CALCULATION_RUN",
      targetId: runId,
      previousStatus: "PREVIEW",
      newStatus: "LOCKED",
      reason: "EXAM3 synthetic copied-database result lock",
      actorUserId: principalId,
      actorRole: "PRINCIPAL",
      snapshotJson: JSON.stringify({ snapshotIds: [snapshot.id], studentCount: 1 }),
      eventDate: new Date("2026-07-29T08:05:00.000Z")
    }
  });
  return { runId, snapshot };
}

function reportSource(seed: ScopeSeed, papers: any[], replacement: boolean) {
  const componentStates = ["PRESENT", "ABSENT", "EXEMPT", "NOT_APPLICABLE"];
  const paperRows = papers.map((paper, index) => {
    const state = componentStates[index % componentStates.length];
    const obtained = state === "PRESENT" ? (index === 0 ? "0.00" : replacement && index === 1 ? "44.00" : "42.00") : null;
    return {
      paperId: paper.id,
      calculationMode: seed.key === "combined" ? "WEIGHTED_NORMALIZED" : "RAW_SUM",
      components: [
        {
          code: "WRITTEN",
          name: index === papers.length - 1 ? "Extended written, oral and practical observation component" : "Written / observation",
          state,
          obtained,
          maximum: "50.00",
          contributionWeight: seed.key === "combined" ? "60.00" : null,
          contribution: state === "PRESENT" ? obtained : null
        },
        {
          code: "INTERNAL",
          name: "Internal / portfolio",
          state: "PRESENT",
          obtained: index % 2 ? "25.00" : "0.00",
          maximum: "50.00",
          contributionWeight: seed.key === "combined" ? "40.00" : null,
          contribution: index % 2 ? "20.00" : "0.00"
        }
      ],
      obtained: state === "PRESENT" ? String((Number(obtained) + (index % 2 ? 25 : 0)).toFixed(2)) : "0.00",
      maximum: "100.00",
      percentage: state === "PRESENT" ? "67.00" : "0.00",
      excluded: state === "EXEMPT" || state === "NOT_APPLICABLE"
    };
  });
  return {
    papers: paperRows,
    groups: seed.key === "secondary"
      ? [{ groupCode: "STEM", groupName: "Science and Mathematics", obtained: "142.00", maximum: "200.00", percentage: "71.00", calculationMode: "RAW_SUM" }]
      : [],
    totalObtained: String(
      (Math.max(100, papers.length * 100) * (replacement ? 0.799 : 0.7875)).toFixed(2)
    ),
    totalMaximum: String(Math.max(100, papers.length * 100)),
    percentage: replacement ? "79.90" : "78.75",
    grade: { code: "A", label: "Excellent", point: "4.0" },
    passResult: "PASS",
    rank: seed.key === "kg" ? null : 1,
    cohortAverage: "68.25",
    cohortHighest: "91.50",
    attendanceReference: {
      policy: "LOCKED_EXAMINATION_DATE_RANGE_ONLY",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-25",
      totalLockedDays: 20,
      recordedDays: 20,
      presentEquivalentDays: 18.5
    },
    developmentalSections: seed.key === "kg"
      ? Array.from({ length: 8 }, (_, section) => ({
          title: `Developmental domain ${section + 1}`,
          items: Array.from({ length: 6 }, (_, item) => ({
            area: `EXAM3 observed developmental skill ${section + 1}.${item + 1}`,
            rating: ["Emerging", "Developing", "Secure"][item % 3],
            remarks: item === 5 ? "Shows consistent progress during structured and independent activity." : null
          }))
        }))
      : [],
    skills: seed.key.startsWith("primary")
      ? Array.from({ length: 10 }, (_, index) => ({ area: `Skill area ${index + 1}`, rating: index % 2 ? "A" : "B", remarks: "Synthetic approved observation." }))
      : [],
    personality: seed.key === "secondary"
      ? Array.from({ length: 12 }, (_, index) => ({ area: `Personality and work habit ${index + 1}`, rating: index % 3 ? "Consistent" : "Developing", remarks: "Synthetic approved observation." }))
      : [],
    combinedResults: seed.key === "combined"
      ? [
          { label: "Configured Periodic Assessment", obtained: "164.00", maximum: "200.00", percentage: "82.00", configuredWeight: "35.00" },
          { label: "Configured Term Assessment", obtained: "468.00", maximum: "600.00", percentage: "78.00", configuredWeight: "65.00" }
        ]
      : [],
    remarks: {
      classTeacher: "EXAM3 approved synthetic class-teacher remark with sufficient length for wrapping verification.",
      principal: replacement ? "EXAM3 corrected snapshot reviewed and approved." : "EXAM3 synthetic publication approved.",
      general: "This report is generated only from a frozen copied-database fixture."
    },
    legends: [
      { code: "A", label: "Excellent" },
      { code: "B", label: "Very good" },
      { code: "AB", label: "Absent" },
      { code: "EX", label: "Exempt" },
      { code: "NA", label: "Not applicable" }
    ],
    warnings: []
  };
}

async function createReplacementSnapshot(client: PrismaClient, principalId: string, source: any) {
  const papers = await client.examSubjectPaper.findMany({
    where: { classScopeId: source.classScopeId },
    orderBy: { displayOrder: "asc" }
  });
  const seed: ScopeSeed = {
    key: "secondary",
    examination: source.examination,
    family: "SECONDARY_10_40_GROUPED",
    template: null,
    className: source.classScope.className,
    section: source.classScope.section,
    student: source.student,
    paperCount: papers.length,
    snapshotVersion: 2,
    runSuffix: "V2"
  };
  const runId = "EXAM3-RUN-secondary-V2";
  const snapshot = await client.studentResultSnapshot.create({
    data: {
      calculationRunId: runId,
      inputFingerprint: "EXAM3-FINGERPRINT-secondary-V2",
      runNumber: 2,
      runStatus: "PREVIEW",
      examinationId: source.examinationId,
      classScopeId: source.classScopeId,
      studentId: source.studentId,
      schemeVersionId: source.schemeVersionId,
      snapshotVersion: 2,
      totalObtained: new Prisma.Decimal(
        (Number(source.totalMaximum) * 0.799).toFixed(2)
      ),
      totalMaximum: source.totalMaximum,
      percentage: new Prisma.Decimal("79.90"),
      gradeCode: "A",
      gradePoint: new Prisma.Decimal("4.0"),
      passResult: "PASS",
      rankValue: 1,
      formulaVersion: source.formulaVersion,
      roundingPolicyVersion: source.roundingPolicyVersion,
      warningsJson: "[]",
      sourceSheetVersionsJson: source.sourceSheetVersionsJson,
      sourceSchemeVersionsJson: source.sourceSchemeVersionsJson,
      snapshotJson: JSON.stringify(reportSource(seed, papers, true)),
      calculatedByUserId: principalId,
      calculatedAt: new Date("2026-07-31T09:00:00.000Z"),
      lockedByUserId: principalId,
      lockedAt: new Date("2026-07-31T09:05:00.000Z")
    }
  });
  await client.examinationSchemeAudit.create({
    data: {
      eventKey: "EXAM3-LOCK-secondary-V2",
      examinationId: source.examinationId,
      schemeVersionId: source.schemeVersionId,
      eventType: "CALCULATION_SNAPSHOT_LOCKED",
      targetType: "EXAM_CALCULATION_RUN",
      targetId: runId,
      previousStatus: "PREVIEW",
      newStatus: "LOCKED",
      reason: "EXAM3 approved corrected synthetic snapshot",
      actorUserId: principalId,
      actorRole: "PRINCIPAL",
      snapshotJson: JSON.stringify({ snapshotIds: [snapshot.id], studentCount: 1 }),
      eventDate: new Date("2026-07-31T09:05:00.000Z")
    }
  });
  return { runId, snapshot };
}

async function waitForJob(
  jobKey: string,
  actor: { id: string; role: "PRINCIPAL" }
) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const job = getReportPdfJob(jobKey, actor);
    if (job.status === "COMPLETED" || job.status === "FAILED") return job;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`EXAM3_PDF_JOB_TIMEOUT_${jobKey}`);
}

async function expectPublicationError(
  action: () => Promise<unknown>,
  status: number,
  code: string
) {
  try {
    await action();
  } catch (error) {
    if (error instanceof ReportPublicationError && error.status === status) return;
    throw error;
  }
  throw new Error(code);
}

async function main() {
  const command = process.argv.slice(2).find((value) => value !== "--")?.toLowerCase();
  if (command === "prepare") await prepare();
  else if (command === "exercise") await exercise();
  else if (command === "inspect") await inspect();
  else if (command === "cleanup") await cleanup();
  else {
    console.error("Usage: pnpm.cmd qa:exam3 -- prepare|exercise|inspect|cleanup");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
