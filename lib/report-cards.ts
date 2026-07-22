import { Prisma, type PrismaClient } from "@prisma/client";
import { calculateMarkReport } from "@/lib/report-card-calculations";
import { createEmptyKgDraft, KG_ATTENDANCE_MONTHS, kgValidationGaps, normalizeKgDraft } from "@/lib/kg-report-card";
import { DEFAULT_KG_TEMPLATE, DEFAULT_MARK_TEMPLATE, normalizeReportCardCode, parseStoredTemplateDefinition, REPORT_CARD_TYPES, safeReportCardText, validateGradeBands, validatePrintSettings, validateTemplateDefinition } from "@/lib/report-card-templates";
import { ReportCardError } from "@/lib/report-card-scope";

export const BATCH_STATUSES = ["DRAFT", "OPEN_FOR_ENTRY", "SUBMITTED", "APPROVED", "ISSUED", "ARCHIVED", "CANCELLED"] as const;
export const CARD_STATUSES = ["DRAFT", "READY_FOR_REVIEW", "APPROVED", "ISSUED", "CANCELLED", "SUPERSEDED"] as const;

export async function createGradingScheme(client: PrismaClient, input: unknown, actorUserId: string) {
  const row = object(input, "Grading scheme details"); const reportType = reportTypeValue(row.reportType);
  const bands = validateGradeBands(row.bands);
  return client.$transaction(async (tx) => {
    const scheme = await tx.gradingScheme.create({ data: { schemeCode: normalizeReportCardCode(row.schemeCode, "Scheme code"), name: safeReportCardText(row.name, "Scheme name", 120)!, academicYear: academicYearValue(row.academicYear, false), reportType, status: "ACTIVE", description: safeReportCardText(row.description, "Scheme description", 1000, false), createdByUserId: actorUserId } });
    await tx.gradeBand.createMany({ data: bands.map((band) => ({ ...band, gradingSchemeId: scheme.id })) });
    return tx.gradingScheme.findUniqueOrThrow({ where: { id: scheme.id }, include: { bands: { orderBy: { displayOrder: "asc" } } } });
  });
}

export async function createReportCardTemplate(client: PrismaClient, input: unknown, actorUserId: string) {
  const row = object(input, "Template details"); const reportType = reportTypeValue(row.reportType);
  const definition = validateTemplateDefinition(reportType, row.definition ?? (reportType === "KG_RUBRIC" ? DEFAULT_KG_TEMPLATE : DEFAULT_MARK_TEMPLATE));
  const printSettings = validatePrintSettings(row.printSettings);
  if (row.gradingSchemeId) {
    const scheme = await client.gradingScheme.findFirst({ where: { id: String(row.gradingSchemeId), reportType, status: "ACTIVE" } });
    if (!scheme) throw new ReportCardError("Choose an active grading scheme matching the template type.");
  }
  return client.reportCardTemplate.create({ data: { templateCode: normalizeReportCardCode(row.templateCode, "Template code"), name: safeReportCardText(row.name, "Template name", 140)!, reportType, academicYear: academicYearValue(row.academicYear, false), className: safeReportCardText(row.className, "Class", 40, false), gradingSchemeId: String(row.gradingSchemeId ?? "").trim() || null, templateDefinitionJson: JSON.stringify(definition), printSettingsJson: printSettings ? JSON.stringify(printSettings) : null, createdByUserId: actorUserId } });
}

export async function setTemplateStatus(client: PrismaClient, id: string, statusValue: unknown, actorUserId: string, expectedValue: unknown) {
  const status = String(statusValue ?? "").toUpperCase(); if (!["ACTIVE", "INACTIVE"].includes(status)) throw new ReportCardError("Choose Activate or Inactivate.");
  const expected = expectedDate(expectedValue, "template");
  const changed = await client.reportCardTemplate.updateMany({ where: { id, updatedAt: expected }, data: { status, ...(status === "ACTIVE" ? { activatedByUserId: actorUserId } : {}) } });
  if (changed.count !== 1) throw new ReportCardError("This template changed in another session. Reload and try again.", 409);
  return client.reportCardTemplate.findUniqueOrThrow({ where: { id } });
}

export async function previewBatchStudents(client: PrismaClient, input: unknown) {
  const data = await validateBatchInput(client, input);
  const students = await eligibleReportStudents(client, data);
  return { ...data, students: students.map((row) => ({ admissionNo: row.student.admissionNo, studentName: row.student.studentName, rollNo: row.rollNo })) };
}

export async function createReportCardBatch(client: PrismaClient, input: unknown, actor: { id: string; name: string }, now = new Date()) {
  const data = await validateBatchInput(client, input); const students = await eligibleReportStudents(client, data);
  if (!students.length) throw new ReportCardError("No active academic-year enrollments match this class and section.");
  const templateSnapshot = { templateCode: data.template.templateCode, name: data.template.name, reportType: data.reportType, versionNumber: data.template.versionNumber, definition: parseStoredTemplateDefinition(data.template.templateDefinitionJson), printSettings: data.template.printSettingsJson ? JSON.parse(data.template.printSettingsJson) : null, gradingScheme: data.template.gradingScheme ? { schemeCode: data.template.gradingScheme.schemeCode, name: data.template.gradingScheme.name, bands: data.template.gradingScheme.bands.map(publicBand) } : null };
  return client.$transaction(async (tx) => {
    const batch = await tx.reportCardBatch.create({ data: { batchNumber: data.batchNumber, academicYear: data.academicYear, reportType: data.reportType, templateId: data.template.id, className: data.className, section: data.section, title: data.title, reportingPeriod: data.reportingPeriod, templateSnapshotJson: JSON.stringify(templateSnapshot), createdByUserId: actor.id } });
    if (data.examCycle) await tx.reportCardBatchExamSource.create({ data: { batchId: batch.id, examCycleId: data.examCycle.id, displayOrder: 1 } });
    const attendance = await Promise.all(students.map((enrollment) => attendanceSnapshot(tx as any, enrollment.studentId, data.academicYear, data.className, data.section)));
    const progression = await Promise.all(students.map((enrollment) => promotionSnapshot(tx as any, enrollment.studentId, data.academicYear)));
    let markRowsByStudent = new Map<string, any[]>();
    if (data.examCycle) {
      const assessments = await tx.examAssessment.findMany({ where: { examCycleId: data.examCycle.id, academicYear: data.academicYear, className: data.className, section: data.section ?? "", entryStatus: "LOCKED" }, include: { marks: true }, orderBy: [{ subjectName: "asc" }, { componentName: "asc" }] });
      markRowsByStudent = new Map(students.map((enrollment) => [enrollment.studentId, assessments.map((assessment) => { const mark = assessment.marks.find((item) => item.studentId === enrollment.studentId); return { subjectName: assessment.subjectName, componentName: assessment.componentName || null, maxMarks: assessment.maxMarks, passMarks: assessment.passMarks, weightagePercent: assessment.weightagePercent, entryStatus: mark?.entryStatus ?? "MISSING", marksObtained: mark?.marksObtained ?? null }; })]));
    }
    for (let index = 0; index < students.length; index++) {
      const enrollment = students[index]; const student = enrollment.student;
      const draft = data.reportType === "MARK_BASED" ? {
        kind: "MARK_BASED",
        sourceExam: { examCode: data.examCycle.examCode, name: data.examCycle.name, status: data.examCycle.status, lockedAt: data.examCycle.lockedAt?.toISOString?.() ?? data.examCycle.lockedAt ?? null },
        calculation: calculateMarkReport(markRowsByStudent.get(enrollment.studentId) ?? [], data.template.gradingScheme?.bands ?? []),
        attendance: attendance[index].months,
        attendanceSource: attendance[index].source
      } : { kind: "KG_RUBRIC", ...createEmptyKgDraft(), attendance: attendance[index].months, attendanceSource: attendance[index].source };
      const card = await tx.studentReportCard.create({ data: { reportCardNumber: reportCardNumber(data.batchNumber, student.admissionNo), batchId: batch.id, studentId: enrollment.studentId, academicYear: data.academicYear, className: data.className, section: data.section, reportType: data.reportType, draftDataJson: JSON.stringify(draft), progressionDecisionId: progression[index].decisionId, promotionDisplayText: progression[index].displayText, createdByUserId: actor.id } });
      await tx.studentReportCardEvent.create({ data: { reportCardId: card.id, eventType: "CARD_CREATED", eventDate: now, newStatus: "DRAFT", recordedByUserId: actor.id, actorLabel: actor.name } });
    }
    return tx.reportCardBatch.findUniqueOrThrow({ where: { id: batch.id }, include: { reportCards: true, examSources: true } });
  });
}

export async function updateReportCardDraft(client: PrismaClient, id: string, input: unknown, actor: { id: string; name: string; role?: string }, expectedValue: unknown, now = new Date()) {
  const row = object(input, "Report-card entry"); const expected = expectedDate(expectedValue, "report card");
  return client.$transaction(async (tx) => {
    const card = await tx.studentReportCard.findUnique({ where: { id } }); if (!card) throw new ReportCardError("Report card was not found.", 404);
    if (card.status !== "DRAFT") throw new ReportCardError("Only a draft report card can be edited.", 409);
    const current = parseDraft(card); let draft: any = current;
    if (card.reportType === "KG_RUBRIC") {
      draft = { kind: "KG_RUBRIC", ...normalizeKgDraft(row.draftData ?? row) };
      if (draft.attendanceSource.status === "CALCULATED_FROM_ATTENDANCE" && (current.attendanceSource?.status !== "CALCULATED_FROM_ATTENDANCE" || JSON.stringify(draft.attendance) !== JSON.stringify(current.attendance))) {
        throw new ReportCardError("Calculated attendance snapshots are read-only and must come from locked Attendance records.", 403);
      }
      const fullApprovalControl = actor.role === "DIRECTOR" || actor.role === "SUPER_ADMIN";
      for (const evaluation of Object.keys(draft.evaluationComments)) {
        if (actor.role !== "TEACHER" && !fullApprovalControl) draft.evaluationComments[evaluation].classTeacherApproval = current.evaluationComments?.[evaluation]?.classTeacherApproval ?? null;
        if (actor.role !== "PRINCIPAL" && !fullApprovalControl) draft.evaluationComments[evaluation].principalApproval = current.evaluationComments?.[evaluation]?.principalApproval ?? null;
        if (!fullApprovalControl) draft.evaluationComments[evaluation].directorApproval = current.evaluationComments?.[evaluation]?.directorApproval ?? null;
      }
    }
    else if (row.draftData) {
      const incoming = object(row.draftData, "Mark report-card data");
      if (JSON.stringify(incoming.calculation) !== JSON.stringify(current.calculation)) throw new ReportCardError("Raw mark calculations cannot be changed from a report-card page.", 403);
      if (JSON.stringify(incoming.attendance ?? current.attendance) !== JSON.stringify(current.attendance) || JSON.stringify(incoming.attendanceSource ?? current.attendanceSource) !== JSON.stringify(current.attendanceSource)) throw new ReportCardError("Attendance snapshots cannot be changed from a mark report-card page.", 403);
      draft = current;
    }
    const comments = {
      teacherOverallComment: safeReportCardText(row.teacherOverallComment, "Teacher comment", 2000, false),
      principalComment: actor.role === "TEACHER" ? card.principalComment : safeReportCardText(row.principalComment, "Principal comment", 2000, false),
      directorComment: actor.role === "TEACHER" ? card.directorComment : safeReportCardText(row.directorComment, "Director comment", 2000, false),
      finalGrade: safeReportCardText(row.finalGrade, "Final grade", 20, false)
    };
    const changed = await tx.studentReportCard.updateMany({ where: { id, status: "DRAFT", updatedAt: expected }, data: { ...comments, draftDataJson: JSON.stringify(draft) } });
    if (changed.count !== 1) throw new ReportCardError("This report card changed in another session. Reload before saving.", 409);
    await tx.studentReportCardEvent.create({ data: { reportCardId: id, eventType: "ENTRY_UPDATED", eventDate: now, previousStatus: "DRAFT", newStatus: "DRAFT", recordedByUserId: actor.id, actorLabel: actor.name, notes: draft.attendanceSource?.status === "MANUALLY_REVIEWED_SNAPSHOT" ? "Attendance snapshot manually reviewed with a recorded reason." : null } });
    return tx.studentReportCard.findUniqueOrThrow({ where: { id } });
  });
}

export async function submitStudentReportCard(client: PrismaClient, id: string, actor: { id: string; name: string }, expectedValue: unknown, now = new Date()) {
  const expected = expectedDate(expectedValue, "report card");
  return client.$transaction(async (tx) => {
    const card = await tx.studentReportCard.findUnique({ where: { id }, include: { batch: true } }); if (!card) throw new ReportCardError("Report card was not found.", 404);
    if (card.status === "READY_FOR_REVIEW") return card;
    if (card.status !== "DRAFT" || card.batch.status !== "OPEN_FOR_ENTRY") throw new ReportCardError("Only a draft card in an open batch can be submitted.", 409);
    const gaps = reportCardValidationGaps(card, parseDraft(card)); if (gaps.length) throw new ReportCardError(`Complete the report card before submission: ${gaps.slice(0, 8).join("; ")}${gaps.length > 8 ? `; and ${gaps.length - 8} more` : ""}.`);
    const changed = await tx.studentReportCard.updateMany({ where: { id, status: "DRAFT", updatedAt: expected }, data: { status: "READY_FOR_REVIEW", submittedByUserId: actor.id, submittedAt: now } });
    if (changed.count !== 1) throw new ReportCardError("This report card changed in another session. Reload before submitting.", 409);
    await event(tx as any, id, "SUBMITTED", "DRAFT", "READY_FOR_REVIEW", actor, now); return tx.studentReportCard.findUniqueOrThrow({ where: { id } });
  });
}

export async function transitionReportCardBatch(client: PrismaClient, id: string, action: "open" | "submit" | "approve" | "issue" | "archive" | "cancel", expectedValue: unknown, actor: { id: string; name: string }, reasonValue?: unknown, now = new Date()) {
  const expected = expectedDate(expectedValue, "batch");
  return client.$transaction(async (tx) => {
    const batch = await tx.reportCardBatch.findUnique({ where: { id }, include: { reportCards: { include: { student: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } } }, template: true, examSources: { include: { examCycle: true } } } });
    if (!batch) throw new ReportCardError("Report-card batch was not found.", 404);
    const target = action === "open" ? "OPEN_FOR_ENTRY" : action === "submit" ? "SUBMITTED" : action === "approve" ? "APPROVED" : action === "issue" ? "ISSUED" : action === "archive" ? "ARCHIVED" : "CANCELLED";
    if (batch.status === target) return batch;
    const expectedFrom = { open: "DRAFT", submit: "OPEN_FOR_ENTRY", approve: "SUBMITTED", issue: "APPROVED", archive: "ISSUED", cancel: batch.status }[action];
    if (action !== "cancel" && batch.status !== expectedFrom) throw new ReportCardError(`Batch cannot ${action} from ${batch.status}.`, 409);
    if (action === "cancel" && ["ISSUED", "ARCHIVED", "CANCELLED"].includes(batch.status)) throw new ReportCardError("Issued, archived, or already cancelled batches cannot be cancelled.", 409);
    if (action === "submit" && batch.reportCards.some((card) => card.status !== "READY_FOR_REVIEW")) throw new ReportCardError("Every Student report card must be complete and submitted before the batch can be submitted.");
    if (action === "approve" && batch.reportCards.some((card) => card.status !== "READY_FOR_REVIEW")) throw new ReportCardError("Every Student report card must be ready for review before approval.");
    if (action === "issue") {
      if (batch.reportCards.some((card) => card.status !== "APPROVED")) throw new ReportCardError("Every Student report card must be approved before issue.");
      const gaps = batch.reportCards.flatMap((card) => reportCardValidationGaps(card, parseDraft(card)).map((gap) => `${card.student.studentName}: ${gap}`));
      if (gaps.length) throw new ReportCardError(`Issue is blocked by validation gaps: ${gaps.slice(0, 8).join("; ")}.`);
    }
    const reason = action === "cancel" ? safeReportCardText(reasonValue, "Cancellation reason", 1000)! : null;
    const data: Record<string, unknown> = { status: target };
    if (action === "open") Object.assign(data, { openedAt: now, openedByUserId: actor.id });
    if (action === "submit") Object.assign(data, { submittedAt: now, submittedByUserId: actor.id });
    if (action === "approve") Object.assign(data, { approvedAt: now, approvedByUserId: actor.id });
    if (action === "issue") Object.assign(data, { issuedAt: now, issuedByUserId: actor.id });
    if (action === "archive") Object.assign(data, { archivedAt: now, archivedByUserId: actor.id });
    if (action === "cancel") Object.assign(data, { cancelledAt: now, cancelledByUserId: actor.id, cancellationReason: reason });
    const changed = await tx.reportCardBatch.updateMany({ where: { id, status: batch.status, updatedAt: expected }, data });
    if (changed.count !== 1) throw new ReportCardError("This batch changed in another session. Reload before continuing.", 409);
    if (action === "approve") {
      for (const card of batch.reportCards) {
        await tx.studentReportCard.update({ where: { id: card.id }, data: { status: "APPROVED", approvedAt: now, approvedByUserId: actor.id } });
        await event(tx as any, card.id, "APPROVED", "READY_FOR_REVIEW", "APPROVED", actor, now);
      }
    }
    if (action === "issue") {
      for (const card of batch.reportCards) {
        const snapshot = buildIssuedSnapshot(batch, card, parseDraft(card), 1, now);
        const version = await tx.studentReportCardVersion.create({ data: { reportCardId: card.id, versionNumber: 1, versionType: "ORIGINAL", snapshotJson: JSON.stringify(snapshot), issuedAt: now, issuedByUserId: actor.id } });
        await tx.studentReportCard.update({ where: { id: card.id }, data: { status: "ISSUED", currentVersionNumber: 1, issuedAt: now, issuedByUserId: actor.id } });
        await event(tx as any, card.id, "ISSUED", "APPROVED", "ISSUED", actor, now, null, version.id);
      }
    }
    if (action === "archive") {
      for (const card of batch.reportCards) await event(tx as any, card.id, "ARCHIVED", "ISSUED", "ISSUED", actor, now);
    }
    if (action === "cancel") {
      for (const card of batch.reportCards) {
        await tx.studentReportCard.update({ where: { id: card.id }, data: { status: "CANCELLED", cancelledAt: now, cancelledByUserId: actor.id, cancellationReason: reason } });
        await event(tx as any, card.id, "CANCELLED", card.status, "CANCELLED", actor, now, reason);
      }
    }
    return tx.reportCardBatch.findUniqueOrThrow({ where: { id }, include: { reportCards: true } });
  });
}

export async function correctIssuedReportCard(client: PrismaClient, id: string, input: unknown, actor: { id: string; name: string }, expectedValue: unknown, now = new Date()) {
  const row = object(input, "Correction"); const reason = safeReportCardText(row.reason, "Correction reason", 1000)!; const expected = expectedDate(expectedValue, "report card");
  return client.$transaction(async (tx) => {
    const card = await tx.studentReportCard.findUnique({ where: { id }, include: { student: true, batch: { include: { template: true } }, versions: { orderBy: { versionNumber: "desc" }, take: 1 } } });
    if (!card || card.status !== "ISSUED" || !card.versions[0]) throw new ReportCardError("Only an issued report card can receive a correction.", 409);
    const prior = JSON.parse(card.versions[0].snapshotJson); let draft = row.draftData ?? prior.data;
    if (card.reportType === "MARK_BASED") {
      if (JSON.stringify(draft?.calculation) !== JSON.stringify(prior.data?.calculation)) throw new ReportCardError("Corrections cannot alter snapshotted raw-mark calculations.", 403);
    } else draft = { kind: "KG_RUBRIC", ...normalizeKgDraft(draft) };
    const corrected = { ...card, teacherOverallComment: safeReportCardText(row.teacherOverallComment ?? prior.comments?.teacher, "Teacher comment", 2000, false), principalComment: safeReportCardText(row.principalComment ?? prior.comments?.principal, "Principal comment", 2000, false), directorComment: safeReportCardText(row.directorComment ?? prior.comments?.director, "Director comment", 2000, false), finalGrade: safeReportCardText(row.finalGrade ?? prior.finalGrade, "Final grade", 20, false) };
    const gaps = reportCardValidationGaps(corrected, draft); if (gaps.length) throw new ReportCardError(`Corrected version is incomplete: ${gaps.slice(0, 8).join("; ")}.`);
    const nextVersion = card.currentVersionNumber + 1; const snapshot = buildIssuedSnapshot(card.batch as any, { ...card, ...corrected }, draft, nextVersion, now);
    const changed = await tx.studentReportCard.updateMany({ where: { id, status: "ISSUED", updatedAt: expected, currentVersionNumber: card.currentVersionNumber }, data: { currentVersionNumber: nextVersion, draftDataJson: JSON.stringify(draft), teacherOverallComment: corrected.teacherOverallComment, principalComment: corrected.principalComment, directorComment: corrected.directorComment, finalGrade: corrected.finalGrade, issuedAt: now, issuedByUserId: actor.id } });
    if (changed.count !== 1) throw new ReportCardError("This report card changed in another session. Reload before correcting.", 409);
    const version = await tx.studentReportCardVersion.create({ data: { reportCardId: id, versionNumber: nextVersion, versionType: "CORRECTION", snapshotJson: JSON.stringify(snapshot), correctionReason: reason, issuedAt: now, issuedByUserId: actor.id, supersedesVersionId: card.versions[0].id } });
    await event(tx as any, id, "CORRECTION_ISSUED", "ISSUED", "ISSUED", actor, now, reason, version.id); return { card: await tx.studentReportCard.findUniqueOrThrow({ where: { id } }), version };
  });
}

export function reportCardValidationGaps(card: { reportType: string; teacherOverallComment?: string | null; principalComment?: string | null; finalGrade?: string | null }, draft: any) {
  const gaps = card.reportType === "KG_RUBRIC" ? kgValidationGaps(draft) : [...(draft?.calculation?.blockingGaps ?? [])];
  if (!card.teacherOverallComment) gaps.push("Teacher overall comment");
  if (!card.principalComment) gaps.push("Principal comment");
  if (card.reportType === "MARK_BASED" && !draft?.calculation?.grade) gaps.push("Calculated grade");
  return [...new Set(gaps)];
}

export function parseDraft(card: { draftDataJson: string }) { try { return JSON.parse(card.draftDataJson); } catch { throw new ReportCardError("Stored report-card draft data is invalid.", 500); } }
export function publicBand(row: any) { return { gradeCode: row.gradeCode, label: row.label, minimumPercentage: row.minimumPercentage.toString(), maximumPercentage: row.maximumPercentage?.toString() ?? null, displayOrder: row.displayOrder, remarks: row.remarks }; }

async function validateBatchInput(client: PrismaClient, input: unknown) {
  const row = object(input, "Batch details"); const reportType = reportTypeValue(row.reportType); const academicYear = academicYearValue(row.academicYear, true)!; const className = safeReportCardText(row.className, "Class", 40)!; const section = safeReportCardText(row.section, "Section", 20, false)?.toUpperCase() ?? null;
  const template = await client.reportCardTemplate.findFirst({ where: { id: String(row.templateId ?? ""), status: "ACTIVE", reportType }, include: { gradingScheme: { include: { bands: { orderBy: { displayOrder: "asc" } } } } } });
  if (!template) throw new ReportCardError("Choose an active template matching the report type.");
  if (template.academicYear && template.academicYear !== academicYear) throw new ReportCardError("Template academic year does not match the batch.");
  if (template.className && template.className.toLowerCase() !== className.toLowerCase()) throw new ReportCardError("Template class does not match the batch.");
  if (!template.gradingScheme?.bands.length) throw new ReportCardError("The template requires a configured grading scheme with bands.");
  let examCycle: any = null;
  if (reportType === "MARK_BASED") {
    examCycle = await client.examCycle.findFirst({ where: { id: String(row.examCycleId ?? ""), academicYear, status: "LOCKED" }, include: { assessments: { where: { className, section: section ?? "" } } } });
    if (!examCycle || !examCycle.assessments.length || examCycle.assessments.some((assessment: any) => assessment.entryStatus !== "LOCKED")) throw new ReportCardError("Choose one locked exam cycle with locked assessments for this class and section.");
  } else if (!/^(LKG|UKG)$/i.test(className.replace(/[.\s-]/g, ""))) throw new ReportCardError("KG rubric batches are restricted to LKG or UKG classes.");
  return { batchNumber: normalizeReportCardCode(row.batchNumber, "Batch number"), academicYear, reportType, template, className, section, title: safeReportCardText(row.title, "Batch title", 160)!, reportingPeriod: safeReportCardText(row.reportingPeriod, "Reporting period", 120, false), examCycle };
}
async function eligibleReportStudents(client: Pick<PrismaClient, "academicYearEnrollment">, data: { academicYear: string; className: string; section: string | null }) { return client.academicYearEnrollment.findMany({ where: { academicYear: data.academicYear, className: data.className, ...(data.section ? { section: data.section } : {}), status: "ACTIVE", student: { deletedAt: null, status: "Active" } }, include: { student: true }, orderBy: [{ rollNo: "asc" }, { student: { studentName: "asc" } }] }); }

async function attendanceSnapshot(client: any, studentId: string, academicYear: string, className: string, section: string | null) {
  const sessions = await client.studentAttendanceSession.findMany({ where: { academicYear, className, section: section ?? "", status: "LOCKED", records: { some: { studentId } } }, include: { records: { where: { studentId } } }, orderBy: { attendanceDate: "asc" } });
  const months = KG_ATTENDANCE_MONTHS.map((month) => ({ month, workingDays: 0, daysPresent: 0 }));
  for (const session of sessions) { const month = monthCode(new Date(session.attendanceDate).getUTCMonth()); const target = months.find((item) => item.month === month); const status = session.records[0]?.status; if (!target || !status) continue; target.workingDays += 1; if (["PRESENT", "LATE"].includes(status)) target.daysPresent += 1; else if (status === "HALF_DAY") target.daysPresent += 0.5; }
  const complete = months.every((item) => item.workingDays > 0);
  return { months, source: { status: complete ? "CALCULATED_FROM_ATTENDANCE" : "INCOMPLETE_SOURCE", overrideReason: null } };
}
async function promotionSnapshot(client: any, studentId: string, academicYear: string) {
  const decision = await client.studentProgressionDecision.findFirst({ where: { studentId, academicYear, status: "FINALIZED" }, orderBy: { finalizedAt: "desc" } });
  if (!decision) return { decisionId: null, displayText: "Promotion decision not finalised." };
  const label = String(decision.decisionType).replaceAll("_", " ").toLowerCase();
  return { decisionId: decision.id, displayText: decision.toClass ? `${label.replace(/^./, (value: string) => value.toUpperCase())} to ${decision.toClass}${decision.toSection ? `-${decision.toSection}` : ""}.` : `${label.replace(/^./, (value: string) => value.toUpperCase())}.` };
}
function buildIssuedSnapshot(batch: any, card: any, draft: any, versionNumber: number, issuedAt: Date) {
  const templateSnapshot = JSON.parse(batch.templateSnapshotJson);
  return { schemaVersion: 1, reportType: card.reportType, status: "ISSUED", versionNumber, issueDate: issuedAt.toISOString(), reportCardNumber: card.reportCardNumber, batchNumber: batch.batchNumber, title: batch.title, reportingPeriod: batch.reportingPeriod, academicYear: card.academicYear, template: templateSnapshot, student: { name: card.student.studentName, admissionNumber: card.student.admissionNo, rollNumber: card.student.rollNo ?? null, className: card.className, section: card.section, dateOfBirth: card.student.dateOfBirth ? new Date(card.student.dateOfBirth).toISOString().slice(0, 10) : null, fatherName: card.student.fatherName || null, motherName: card.student.motherName || null }, data: draft, comments: { teacher: card.teacherOverallComment ?? null, principal: card.principalComment ?? null, director: card.directorComment ?? null }, finalGrade: card.finalGrade ?? draft?.calculation?.grade?.code ?? draft?.final?.grade ?? null, promotionDisplayText: card.promotionDisplayText ?? "Promotion decision not finalised.", approvals: { submittedAt: card.submittedAt?.toISOString?.() ?? card.submittedAt ?? null, approvedAt: card.approvedAt?.toISOString?.() ?? card.approvedAt ?? null, issuedAt: issuedAt.toISOString() } };
}
async function event(tx: any, reportCardId: string, eventType: string, previousStatus: string | null, newStatus: string | null, actor: { id: string; name: string }, eventDate: Date, reason: string | null = null, versionId: string | null = null) { await tx.studentReportCardEvent.create({ data: { reportCardId, versionId, eventType, eventDate, previousStatus, newStatus, reason, recordedByUserId: actor.id, actorLabel: actor.name } }); }
function object(input: unknown, label: string) { if (!input || typeof input !== "object" || Array.isArray(input)) throw new ReportCardError(`${label} must be an object.`); return input as Record<string, any>; }
function reportTypeValue(value: unknown) { const reportType = String(value ?? "").toUpperCase(); if (!(REPORT_CARD_TYPES as readonly string[]).includes(reportType)) throw new ReportCardError("Choose Mark Based or KG Rubric."); return reportType; }
function academicYearValue(value: unknown, required: boolean) { const text = String(value ?? "").trim(); if (!text && !required) return null; if (!/^\d{4}-\d{2}$/.test(text)) throw new ReportCardError("Academic year must use YYYY-YY."); return text; }
function expectedDate(value: unknown, label: string) { const date = new Date(String(value ?? "")); if (Number.isNaN(date.getTime())) throw new ReportCardError(`Reload the ${label} before continuing.`, 409); return date; }
function reportCardNumber(batchNumber: string, admissionNo: string) { return `${batchNumber}-${String(admissionNo).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "-")}`.slice(0, 100); }
function monthCode(monthIndex: number) { return ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"][monthIndex]; }
