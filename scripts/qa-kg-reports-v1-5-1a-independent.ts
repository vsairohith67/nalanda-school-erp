import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { can } from "../lib/permissions";
import { acknowledgeParentReport, getParentPublishedReports } from "../lib/report-parent-delivery";
import {
  createReportCardBatch,
  correctIssuedReportCard,
  submitStudentReportCard,
  transitionReportCardBatch,
  updateReportCardDraft
} from "../lib/report-cards";
import {
  createEmptyKgDraft,
  KG_CRITERIA,
  KG_EVALUATIONS,
  KG_GROWTH_PERIODS,
  KG_PERSONALITY_TRAITS,
  KG_RESPONSE_SETS,
  KG_SUMMARY_AREAS,
  kgValidationGaps,
  normalizeKgDraft
} from "../lib/kg-report-card";
import { DEFAULT_KG_TEMPLATE } from "../lib/report-card-templates";
import { hashPassword } from "../lib/password";

const PREFIX = `KG15QA-${Date.now()}`;
const ACADEMIC_YEAR = "2026-27";
const LKG_SECTION = `Q${Date.now().toString().slice(-6)}`;
const UKG_SECTION = `R${Date.now().toString().slice(-6)}`;
const browserCredential = `Kg15Qa-${randomUUID()}!aA9`;
const outputRoot = path.resolve(process.cwd(), "tmp", "kg-reports-v1-5-qa");
const statePath = path.join(outputRoot, "browser-state.json");

function requireIsolatedCopy() {
  const url = String(process.env.DATABASE_URL ?? "");
  const normalized = url.replaceAll("\\", "/").toLowerCase();
  if (!normalized.includes("tmp/kg-reports-v1-5-qa/") || normalized.endsWith("/prisma/dev.db")) {
    throw new Error("KG15QA_REFUSED_NON_ISOLATED_DATABASE");
  }
  if (process.env.KG_REPORT_CARDS_V1_5_QA_MODE !== "SYNTHETIC_COPY_ONLY") {
    throw new Error("KG15QA_QA_MODE_SENTINEL_REQUIRED");
  }
}

function assert(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

async function expectRejected(operation: Promise<unknown>, pattern: RegExp, code: string) {
  try {
    await operation;
  } catch (error) {
    assert(pattern.test(error instanceof Error ? error.message : String(error)), `${code}_WRONG_ERROR`);
    return;
  }
  throw new Error(`${code}_UNEXPECTED_ALLOW`);
}

function completedDraft(base: any, flavour: "LKG" | "UKG", ordinal: number) {
  const draft = structuredClone(base);
  for (const evaluation of KG_EVALUATIONS) {
    draft.rubrics[evaluation] = Object.fromEntries(KG_CRITERIA.map(([key, , , set], index) => [key, KG_RESPONSE_SETS[set][(ordinal + index) % KG_RESPONSE_SETS[set].length]]));
    draft.summaryGrades[evaluation] = Object.fromEntries(KG_SUMMARY_AREAS.map((area, index) => [area, ["A", "B", "C"][(ordinal + index) % 3]]));
    draft.personality[evaluation] = Object.fromEntries(KG_PERSONALITY_TRAITS.map((trait, index) => [trait, ["G", "S", "N"][(ordinal + index) % 3]]));
    draft.evaluationComments[evaluation] = {
      comment: evaluation === "V" ? `Unicode सुरक्षित ✓ — ${flavour}` : `Evaluation ${evaluation} synthetic observation`,
      classTeacherApproval: { name: "Synthetic Class Teacher", role: "CLASS_TEACHER", approvedAt: "2027-03-20" },
      principalApproval: { name: "Synthetic Principal", role: "PRINCIPAL", approvedAt: "2027-03-21" },
      directorApproval: null
    };
  }
  for (const evaluation of KG_GROWTH_PERIODS) {
    draft.growth[evaluation] = { heightCm: 102 + (ordinal % 10) * 0.5, weightKg: 16 + (ordinal % 10) * 0.5, observationDate: "2027-03-20" };
  }
  draft.final = { ...draft.final, grade: ["A", "B", "C"][ordinal % 3], comment: "Ready for the approved next learning stage.", nextSessionStartDate: "2027-04-01" };
  return normalizeKgDraft(draft);
}

async function createUser(client: PrismaClient, role: string, label: string, passwordHash: string, guardianId?: string) {
  const user = await client.user.create({ data: { iamPublicKey: randomUUID(), name: `${PREFIX} ${label}`, username: `${PREFIX}-${label}`.toLowerCase(), passwordHash, role, lifecycleStatus: "ACTIVE", isActive: true, guardianId } });
  await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role: role as any, reason: `${PREFIX} isolated QA`, assignedByUserId: user.id, activeKey: `${user.id}:${role}` } });
  await client.authLoginAlias.create({ data: { userId: user.id, type: "USERNAME", normalizedValue: user.username, displayMasked: user.username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  return user;
}

async function seedClass(client: PrismaClient, input: { className: "LKG" | "UKG"; section: string; count: number; actorId: string }) {
  const students = Array.from({ length: input.count }, (_, index) => ({
    id: `${PREFIX}-${input.className}-${index + 1}`,
    academicYear: ACADEMIC_YEAR,
    admissionNo: `${PREFIX.replaceAll("-", "")}${input.className}${String(index + 1).padStart(3, "0")}`,
    studentName: `${input.className} Synthetic Student ${index + 1}`,
    fatherName: "Synthetic Guardian",
    motherName: "Synthetic Guardian",
    className: input.className,
    section: input.section,
    rollNo: String(index + 1),
    phone1: "9000000000",
    status: "Active"
  }));
  await client.student.createMany({ data: students });
  await client.academicYearEnrollment.createMany({ data: students.map((student) => ({ id: `${student.id}-ENR`, studentId: student.id, academicYear: ACADEMIC_YEAR, className: input.className, section: input.section, rollNo: student.rollNo, status: "ACTIVE" })) });
  await client.studentProgressionDecision.createMany({ data: students.map((student) => ({ id: `${student.id}-PROG`, studentId: student.id, sourceEnrollmentId: `${student.id}-ENR`, academicYear: ACADEMIC_YEAR, decisionType: "PROMOTED", status: "FINALIZED", fromClass: input.className, fromSection: input.section, toAcademicYear: "2027-28", toClass: input.className === "LKG" ? "UKG" : "Class I", toSection: input.section, effectiveDate: new Date("2027-04-01T00:00:00.000Z"), reason: `${PREFIX} approved synthetic progression`, finalizedByUserId: input.actorId, finalizedAt: new Date("2027-03-22T10:00:00.000Z") })) });
  const monthDates = ["2026-06-10", "2026-07-10", "2026-08-10", "2026-09-10", "2026-10-10", "2026-11-10", "2026-12-10", "2027-01-10", "2027-02-10", "2027-03-10", "2027-04-10"];
  for (const date of monthDates) {
    await client.studentAttendanceSession.create({ data: { id: `${PREFIX}-${input.className}-${date}`, attendanceDate: new Date(`${date}T00:00:00.000Z`), className: input.className, section: input.section, academicYear: ACADEMIC_YEAR, status: "LOCKED", takenByUserId: input.actorId, submittedByUserId: input.actorId, lockedByUserId: input.actorId, submittedAt: new Date(`${date}T08:00:00.000Z`), lockedAt: new Date(`${date}T09:00:00.000Z`), notes: `${PREFIX} locked authoritative attendance`, records: { create: students.map((student, index) => ({ id: `${PREFIX}-${input.className}-${date}-${index + 1}`, studentId: student.id, admissionNo: student.admissionNo, status: index % 7 === 0 ? "LATE" : "PRESENT" })) } } });
  }
  return students;
}

async function completeAndSubmit(client: PrismaClient, batchId: string, principal: { id: string; name: string }, flavour: "LKG" | "UKG") {
  const cards = await client.studentReportCard.findMany({ where: { batchId }, orderBy: { reportCardNumber: "asc" } });
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index];
    const current = JSON.parse(card.draftDataJson);
    if (index === 0) {
      await expectRejected(updateReportCardDraft(client, card.id, { draftData: completedDraft(current, flavour, index), teacherOverallComment: "Teacher", principalComment: "Principal" }, { id: `${PREFIX}-teacher-deny`, name: "Synthetic Teacher", role: "TEACHER" }, card.updatedAt), /Principal or Super Admin/, "KG15QA_TEACHER_SERVICE_DENIAL");
      const afterDenial = await client.studentReportCard.findUniqueOrThrow({ where: { id: card.id } });
      assert(afterDenial.draftDataJson === card.draftDataJson, "KG15QA_TEACHER_DENIAL_MUTATED_DRAFT");
    }
    const updated = await updateReportCardDraft(client, card.id, { draftData: completedDraft(current, flavour, index), teacherOverallComment: index === 0 ? "Long synthetic comment ".repeat(60).slice(0, 1900) : "Synthetic teacher comment", principalComment: "Synthetic principal comment" }, { id: principal.id, name: principal.name, role: "PRINCIPAL" }, card.updatedAt, new Date("2027-03-23T10:00:00.000Z"));
    await submitStudentReportCard(client, updated.id, principal, updated.updatedAt, new Date("2027-03-23T11:00:00.000Z"));
  }
}

async function batchUpdatedAt(client: PrismaClient, id: string) {
  return (await client.reportCardBatch.findUniqueOrThrow({ where: { id }, select: { updatedAt: true } })).updatedAt;
}

async function main() {
  requireIsolatedCopy();
  mkdirSync(outputRoot, { recursive: true });
  const queryLog: string[] = [];
  const client = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
  client.$on("query", (event) => queryLog.push(event.query));
  try {
    const passwordHash = await hashPassword(browserCredential);
    const principal = await createUser(client, "PRINCIPAL", "principal", passwordHash);
    const superAdmin = await createUser(client, "SUPER_ADMIN", "super-admin", passwordHash);
    const teacher = await createUser(client, "TEACHER", "teacher", passwordHash);
    const viewer = await createUser(client, "VIEWER", "viewer", passwordHash);
    const operator = await createUser(client, "COMPUTER_OPERATOR", "operator", passwordHash);
    const guardian = await client.guardian.create({ data: { displayName: `${PREFIX} Parent`, primaryMobile: "9111111111", relationship: "Parent", status: "Active" } });
    const otherGuardian = await client.guardian.create({ data: { displayName: `${PREFIX} Other Parent`, primaryMobile: "9222222222", relationship: "Parent", status: "Active" } });
    const parent = await createUser(client, "PARENT", "parent", passwordHash, guardian.id);
    const otherParent = await createUser(client, "PARENT", "other-parent", passwordHash, otherGuardian.id);
    const lkg = await seedClass(client, { className: "LKG", section: LKG_SECTION, count: 24, actorId: principal.id });
    const ukg = await seedClass(client, { className: "UKG", section: UKG_SECTION, count: 2, actorId: principal.id });
    const timetableTeacher = await client.timetableTeacher.create({ data: { name: teacher.name, shortName: `${PREFIX}-TCH`, department: "KG", isActive: true, maxPeriodsPerWeek: 30, maxPeriodsPerDay: 7 } });
    const timetableSubject = await client.timetableSubject.create({ data: { name: `${PREFIX} English`, shortName: `${PREFIX}-ENG`, department: "KG", isActive: true } });
    const timetableClass = await client.timetableClassSection.create({ data: { className: "LKG", section: LKG_SECTION, displayName: `LKG-${LKG_SECTION}`, groupName: `${PREFIX}-KG`, academicYear: ACADEMIC_YEAR, isActive: true } });
    await client.timetableAssignment.create({ data: { academicYear: ACADEMIC_YEAR, classSectionId: timetableClass.id, subjectId: timetableSubject.id, teacherId: timetableTeacher.id, periodsPerWeek: 5, notes: `${PREFIX} read-only Teacher report scope` } });
    await client.staffMember.create({ data: { fullName: teacher.name, staffType: "TEACHING", designation: "KG Teacher", department: "KG", status: "ACTIVE", userId: teacher.id, timetableTeacherId: timetableTeacher.id } });
    await client.studentGuardian.createMany({ data: [{ guardianId: guardian.id, studentId: lkg[0].id, relationshipToStudent: "Parent", isPrimaryContact: true }, { guardianId: otherGuardian.id, studentId: lkg[1].id, relationshipToStudent: "Parent", isPrimaryContact: true }] });
    const scheme = await client.gradingScheme.create({ data: { schemeCode: `${PREFIX}-SCHEME`, name: `${PREFIX} KG scheme`, academicYear: ACADEMIC_YEAR, reportType: "KG_RUBRIC", status: "ACTIVE", createdByUserId: superAdmin.id, bands: { create: [{ gradeCode: "A", label: "Excellent", minimumPercentage: 80, maximumPercentage: 100, displayOrder: 1 }, { gradeCode: "B", label: "Good", minimumPercentage: 60, maximumPercentage: 79.99, displayOrder: 2 }, { gradeCode: "C", label: "Developing", minimumPercentage: 0, maximumPercentage: 59.99, displayOrder: 3 }] } } });
    const template = await client.reportCardTemplate.create({ data: { templateCode: `${PREFIX}-TEMPLATE`, name: `${PREFIX} KG developmental booklet`, reportType: "KG_RUBRIC", academicYear: ACADEMIC_YEAR, gradingSchemeId: scheme.id, status: "ACTIVE", templateDefinitionJson: JSON.stringify(DEFAULT_KG_TEMPLATE), printSettingsJson: JSON.stringify({ pageSize: "A4", scalePercent: 100, colourMode: "COLOUR" }), createdByUserId: superAdmin.id, activatedByUserId: superAdmin.id } });

    const malformed = createEmptyKgDraft() as any;
    malformed.rubrics.I.english_oral_talks = "NOT_ALLOWED";
    assert(kgValidationGaps(createEmptyKgDraft()).length > 100, "KG15QA_BLANK_DRAFT_NOT_BLOCKED");
    try { normalizeKgDraft(malformed); throw new Error("KG15QA_INVALID_RUBRIC_ALLOWED"); } catch (error) { assert(/invalid KG rubric/.test(error instanceof Error ? error.message : String(error)), "KG15QA_INVALID_RUBRIC_WRONG_ERROR"); }
    const createStart = queryLog.length;
    const lkgBatch = await createReportCardBatch(client, { batchNumber: `${PREFIX}-LKG`, academicYear: ACADEMIC_YEAR, reportType: "KG_RUBRIC", templateId: template.id, className: "LKG", section: LKG_SECTION, title: "LKG Synthetic Evaluation I-V", reportingPeriod: "Evaluations I-V" }, superAdmin, new Date("2027-03-23T08:00:00.000Z"));
    const createQueries = queryLog.slice(createStart);
    const lkgSelects = createQueries.filter((query) => /^SELECT\b/i.test(query.trim())).length;
    assert(lkgSelects <= 14, `KG15QA_N_PLUS_ONE_SELECTS_${lkgSelects}`);
    const ukgCreateStart = queryLog.length;
    const ukgBatch = await createReportCardBatch(client, { batchNumber: `${PREFIX}-UKG`, academicYear: ACADEMIC_YEAR, reportType: "KG_RUBRIC", templateId: template.id, className: "UKG", section: UKG_SECTION, title: "UKG Synthetic Evaluation I-V", reportingPeriod: "Evaluations I-V" }, superAdmin, new Date("2027-03-23T08:10:00.000Z"));
    const ukgSelects = queryLog.slice(ukgCreateStart).filter((query) => /^SELECT\b/i.test(query.trim())).length;
    assert(Math.abs(lkgSelects - ukgSelects) <= 2, `KG15QA_COHORT_SELECTS_SCALE_${lkgSelects}_${ukgSelects}`);
    const firstLkgDraft = JSON.parse((await client.studentReportCard.findFirstOrThrow({ where: { batchId: lkgBatch.id }, select: { draftDataJson: true } })).draftDataJson);
    const invalidGrowth = completedDraft(firstLkgDraft, "LKG", 1) as any;
    invalidGrowth.growth.I.heightCm = 0;
    try { normalizeKgDraft(invalidGrowth); throw new Error("KG15QA_ZERO_GROWTH_ALLOWED"); } catch (error) { assert(/height/.test(error instanceof Error ? error.message : String(error)), "KG15QA_ZERO_GROWTH_WRONG_ERROR"); }
    const maliciousComment = completedDraft(firstLkgDraft, "LKG", 1) as any;
    maliciousComment.evaluationComments.V.comment = "<script>alert('x')</script>";
    try { normalizeKgDraft(maliciousComment); throw new Error("KG15QA_MALICIOUS_HTML_ALLOWED"); } catch (error) { assert(/safe plain text/.test(error instanceof Error ? error.message : String(error)), "KG15QA_MALICIOUS_HTML_WRONG_ERROR"); }
    const openedLkg = await transitionReportCardBatch(client, lkgBatch.id, "open", await batchUpdatedAt(client, lkgBatch.id), principal, undefined, new Date("2027-03-23T09:00:00.000Z"));
    const openedUkg = await transitionReportCardBatch(client, ukgBatch.id, "open", await batchUpdatedAt(client, ukgBatch.id), principal, undefined, new Date("2027-03-23T09:00:00.000Z"));
    await completeAndSubmit(client, openedLkg.id, principal, "LKG");
    await completeAndSubmit(client, openedUkg.id, principal, "UKG");
    const submittedLkg = await transitionReportCardBatch(client, openedLkg.id, "submit", await batchUpdatedAt(client, openedLkg.id), principal, undefined, new Date("2027-03-23T12:00:00.000Z"));
    const submittedUkg = await transitionReportCardBatch(client, openedUkg.id, "submit", await batchUpdatedAt(client, openedUkg.id), principal, undefined, new Date("2027-03-23T12:00:00.000Z"));
    const approvedLkg = await transitionReportCardBatch(client, submittedLkg.id, "approve", await batchUpdatedAt(client, submittedLkg.id), superAdmin, undefined, new Date("2027-03-23T13:00:00.000Z"));
    const approvedUkg = await transitionReportCardBatch(client, submittedUkg.id, "approve", await batchUpdatedAt(client, submittedUkg.id), superAdmin, undefined, new Date("2027-03-23T13:00:00.000Z"));
    const issuedLkg = await transitionReportCardBatch(client, approvedLkg.id, "issue", await batchUpdatedAt(client, approvedLkg.id), superAdmin, undefined, new Date("2027-03-23T14:00:00.000Z"));
    const issuedUkg = await transitionReportCardBatch(client, approvedUkg.id, "issue", await batchUpdatedAt(client, approvedUkg.id), superAdmin, undefined, new Date("2027-03-23T14:00:00.000Z"));
    assert(issuedLkg.reportCards.every((card) => card.status === "ISSUED" && card.currentVersionNumber === 1), "KG15QA_LKG_ISSUE_FAILED");
    assert(issuedUkg.reportCards.every((card) => card.status === "ISSUED" && card.currentVersionNumber === 1), "KG15QA_UKG_ISSUE_FAILED");

    const correctionTarget = await client.studentReportCard.findFirstOrThrow({ where: { batchId: issuedLkg.id }, include: { versions: { orderBy: { versionNumber: "asc" } } } });
    const originalSnapshot = correctionTarget.versions[0].snapshotJson;
    const correctionDraft = JSON.parse(originalSnapshot).data;
    correctionDraft.evaluationComments.V.comment = "Corrected Unicode टिप्पणी ✓";
    await expectRejected(correctIssuedReportCard(client, correctionTarget.id, { reason: "Teacher correction attempt", draftData: correctionDraft }, { id: teacher.id, name: teacher.name, role: "TEACHER" }, correctionTarget.updatedAt), /Principal or Super Admin/, "KG15QA_TEACHER_CORRECTION_DENIAL");
    await expectRejected(correctIssuedReportCard(client, correctionTarget.id, { reason: "Operator correction attempt", draftData: correctionDraft }, { id: operator.id, name: operator.name, role: "COMPUTER_OPERATOR" }, correctionTarget.updatedAt), /Principal or Super Admin/, "KG15QA_OPERATOR_CORRECTION_DENIAL");
    const tamperedAttendance = structuredClone(correctionDraft);
    tamperedAttendance.attendance[0].daysPresent = 0;
    await expectRejected(correctIssuedReportCard(client, correctionTarget.id, { reason: "Attendance tamper attempt", draftData: tamperedAttendance }, { id: principal.id, name: principal.name, role: "PRINCIPAL" }, correctionTarget.updatedAt), /cannot alter the issued Attendance snapshot/, "KG15QA_ATTENDANCE_CORRECTION_TAMPER");
    const corrected = await correctIssuedReportCard(client, correctionTarget.id, { reason: "Approved correction of Evaluation V narrative", draftData: correctionDraft }, { id: principal.id, name: principal.name, role: "PRINCIPAL" }, correctionTarget.updatedAt, new Date("2027-03-24T10:00:00.000Z"));
    const afterCorrection = await client.studentReportCard.findUniqueOrThrow({ where: { id: correctionTarget.id }, include: { versions: { orderBy: { versionNumber: "asc" } } } });
    assert(afterCorrection.versions.length === 2 && afterCorrection.currentVersionNumber === 2, "KG15QA_REVISION_CHAIN_MISSING");
    assert(afterCorrection.versions[0].snapshotJson === originalSnapshot, "KG15QA_ORIGINAL_VERSION_OVERWRITTEN");
    assert(afterCorrection.versions[1].supersedesVersionId === afterCorrection.versions[0].id && corrected.version.correctionReason, "KG15QA_REVISION_PROVENANCE_MISSING");
    const v2 = JSON.parse(afterCorrection.versions[1].snapshotJson);
    assert(v2.revision.authority === "PRINCIPAL_OR_SUPER_ADMIN" && v2.revision.actorLabel === principal.name, "KG15QA_REVISION_APPROVAL_CHAIN_MISSING");

    const parentPortal = await getParentPublishedReports(client, parent.id);
    assert(parentPortal.legacyReportCards.length === 1 && parentPortal.legacyReportCards[0].latestVersion === 2, "KG15QA_PARENT_ISSUED_VIEW_MISSING");
    const otherPortal = await getParentPublishedReports(client, otherParent.id);
    assert(otherPortal.legacyReportCards.length === 1 && otherPortal.legacyReportCards[0].reportCardNumber !== afterCorrection.reportCardNumber, "KG15QA_PARENT_CROSS_CHILD_DISCLOSURE");
    await expectRejected(getParentPublishedReports(client, parent.id, otherPortal.children[0].studentReference), /not linked/, "KG15QA_PARENT_CHILD_IDOR");
    const acknowledgement = await acknowledgeParentReport(client, { reportCardNumber: afterCorrection.reportCardNumber, versionNumber: 2 }, { id: parent.id, name: parent.name, role: "PARENT" }, new Date("2027-03-25T10:00:00.000Z"));
    const acknowledgementAgain = await acknowledgeParentReport(client, { reportCardNumber: afterCorrection.reportCardNumber, versionNumber: 2 }, { id: parent.id, name: parent.name, role: "PARENT" }, new Date("2027-03-25T10:01:00.000Z"));
    assert(acknowledgement.acknowledged && acknowledgementAgain.idempotent, "KG15QA_PARENT_ACK_NOT_IDEMPOTENT");
    await expectRejected(acknowledgeParentReport(client, { reportCardNumber: afterCorrection.reportCardNumber, versionNumber: 2 }, { id: otherParent.id, name: otherParent.name, role: "PARENT" }), /linked child/, "KG15QA_PARENT_ACK_IDOR");

    assert(!can("TEACHER", "ENTER_REPORT_CARD_DATA") && !can("TEACHER", "SUBMIT_REPORT_CARDS"), "KG15QA_TEACHER_PERMISSION_REGRESSION");
    assert(can("PRINCIPAL", "ENTER_REPORT_CARD_DATA") && can("SUPER_ADMIN", "ENTER_REPORT_CARD_DATA"), "KG15QA_LEADERSHIP_PERMISSION_REGRESSION");
    assert(!can("COMPUTER_OPERATOR", "ENTER_REPORT_CARD_DATA") && !can("VIEWER", "ENTER_REPORT_CARD_DATA") && !can("FUTURE_ROLE" as any, "ENTER_REPORT_CARD_DATA"), "KG15QA_FAIL_CLOSED_ROLE_REGRESSION");

    writeFileSync(statePath, `${JSON.stringify({ databaseUrl: process.env.DATABASE_URL, featureFlag: "SYNTHETIC_COPY_ONLY", password: browserCredential, principal: { username: principal.username }, superAdmin: { username: superAdmin.username }, teacher: { username: teacher.username }, parent: { username: parent.username }, reportCardId: afterCorrection.id, reportCardNumber: afterCorrection.reportCardNumber, lkgBatchId: issuedLkg.id, ukgBatchId: issuedUkg.id }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    console.log(JSON.stringify({ result: "KG_REPORTS_V1_5_INDEPENDENT_QA_PASSED", copiedDatabase: true, lkgStudents: lkg.length, ukgStudents: ukg.length, evaluations: KG_EVALUATIONS.length, criteria: KG_CRITERIA.length, personalityTraits: KG_PERSONALITY_TRAITS.length, attendanceMonths: 11, issuedVersions: await client.studentReportCardVersion.count({ where: { reportCard: { reportCardNumber: { startsWith: PREFIX } } } }), correctionVersions: afterCorrection.versions.length, parentAcknowledgement: true, lkgCreateSelectQueries: lkgSelects, ukgCreateSelectQueries: ukgSelects, operationalDataChanged: false, statePath }));
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
