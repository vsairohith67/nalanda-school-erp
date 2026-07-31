// @ts-nocheck -- runtime-validated transactional Prisma graph; kept flat to avoid generated-type heap exhaustion.
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import {
  ExamMarksScopeError,
  exactEligibleStudents,
  listExactTeacherMarkAssignments,
  publicTeacherMarkAssignment,
  requireExactExamMarkAssignment
} from "@/lib/exam-marks-scope";

type ExamMarksClient = any;
type ExamMarksActor = Pick<AuthUser, "id" | "role" | "name">;

export const GOVERNED_MARK_ENTRY_STATES = [
  "NOT_ENTERED",
  "PRESENT",
  "ABSENT",
  "NOT_APPLICABLE",
  "EXEMPT"
] as const;

export const GOVERNED_SHEET_STATUSES = [
  "NOT_STARTED",
  "DRAFT",
  "VALIDATION_FAILED",
  "READY_TO_SUBMIT",
  "SUBMITTED",
  "REOPEN_REQUESTED",
  "REOPENED",
  "RESUBMITTED",
  "MODERATED",
  "LOCKED"
] as const;

export class ExamMarksError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "EXAM_MARKS_REQUEST_REJECTED") {
    super(message);
    this.name = "ExamMarksError";
  }
}

type MarkRowInput = {
  studentId: string;
  entryState: (typeof GOVERNED_MARK_ENTRY_STATES)[number];
  marksObtained: Prisma.Decimal | null;
  remarks: string | null;
  expectedRowVersion: number;
};

function objectInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExamMarksError("Request data must be an object.");
  }
  return value as Record<string, unknown>;
}

function boundedText(value: unknown, label: string, max: number, required = true) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if ((!text && required) || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) {
    throw new ExamMarksError(`${label} ${required ? "is required and " : ""}must be ${max} characters or fewer.`);
  }
  return text || null;
}

function positiveVersion(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new ExamMarksError(`A valid expected ${label} version is required.`);
  return parsed;
}

function requestKey(value: unknown, action: string) {
  const key = String(value ?? "").trim();
  if (!/^[A-Za-z0-9:_-]{12,120}$/.test(key)) throw new ExamMarksError(`A valid ${action} request key is required.`);
  return key;
}

function safeId(value: unknown, label: string) {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new ExamMarksError(`${label} is invalid.`);
  return id;
}

function eventKey(parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex").toUpperCase();
}

async function governanceEvent(
  tx: ExamMarksClient,
  input: {
    eventKey: string;
    examinationId: string;
    schemeVersionId?: string | null;
    assignmentId?: string | null;
    eventType: string;
    targetType: string;
    targetId: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    reason?: string | null;
    actor: ExamMarksActor;
    snapshot: unknown;
    eventDate: Date;
  }
) {
  return tx.examinationSchemeAudit.create({
    data: {
      eventKey: input.eventKey,
      examinationId: input.examinationId,
      schemeVersionId: input.schemeVersionId ?? null,
      assignmentId: input.assignmentId ?? null,
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      reason: input.reason ?? null,
      actorUserId: input.actor.id,
      actorRole: input.actor.role,
      snapshotJson: JSON.stringify(input.snapshot),
      eventDate: input.eventDate
    }
  });
}

function serializeEntry(row: {
  id?: string;
  studentId: string;
  entryState: string;
  marksObtained: Prisma.Decimal | null;
  remarks: string | null;
  rowVersion: number;
}) {
  return {
    id: row.id,
    studentId: row.studentId,
    entryState: row.entryState,
    marksObtained: row.marksObtained?.toString() ?? null,
    remarks: row.remarks,
    rowVersion: row.rowVersion
  };
}

function parseMarkRow(value: unknown, maximum: Prisma.Decimal, decimalPlaces: number): MarkRowInput {
  const row = objectInput(value);
  const studentId = safeId(row.studentId, "Student");
  const entryState = String(row.entryState ?? "NOT_ENTERED").trim().toUpperCase();
  if (!(GOVERNED_MARK_ENTRY_STATES as readonly string[]).includes(entryState)) {
    throw new ExamMarksError("Choose Not Entered, Present, Absent, Not Applicable, or Exempt.");
  }
  if (!Number.isSafeInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) {
    throw new ExamMarksError("The frozen scheme has an unsupported mark precision.", 409);
  }
  const raw = row.marksObtained == null ? "" : String(row.marksObtained).trim();
  let marksObtained: Prisma.Decimal | null = null;
  if (raw !== "") {
    try {
      marksObtained = new Prisma.Decimal(raw);
    } catch {
      throw new ExamMarksError("Marks must be a valid number.");
    }
    if (!marksObtained.isFinite() || marksObtained.lt(0) || marksObtained.gt(maximum)) {
      throw new ExamMarksError(`Marks must be between 0 and ${maximum.toString()}.`);
    }
    if (marksObtained.decimalPlaces() > decimalPlaces) {
      throw new ExamMarksError(`Marks allow at most ${decimalPlaces} decimal place${decimalPlaces === 1 ? "" : "s"}.`);
    }
  }
  if (entryState === "PRESENT" && marksObtained === null) {
    throw new ExamMarksError("A Present entry requires marks. Numeric zero is valid; a blank is not zero.");
  }
  if (entryState !== "PRESENT" && marksObtained !== null) {
    throw new ExamMarksError(`${entryState.replaceAll("_", " ")} must not carry marks.`);
  }
  return {
    studentId,
    entryState: entryState as MarkRowInput["entryState"],
    marksObtained,
    remarks: boundedText(row.remarks, "Remarks", 300, false),
    expectedRowVersion: positiveVersion(row.expectedRowVersion, "row")
  };
}

function assignmentSnapshot(assignment: Awaited<ReturnType<typeof requireExactExamMarkAssignment>>) {
  return JSON.stringify({
    assignmentId: assignment.id,
    assignmentRole: assignment.assignmentRole,
    examinationId: assignment.examinationId,
    classScopeId: assignment.classScopeId,
    subjectPaperId: assignment.subjectPaperId,
    componentId: assignment.componentId,
    schemeVersionId: assignment.schemeVersionId,
    academicYear: assignment.academicYear,
    className: assignment.className,
    section: assignment.section,
    staffMemberId: assignment.staffMemberId,
    timetableTeacherId: assignment.timetableTeacherId,
    timetableAssignmentId: assignment.timetableAssignmentId
  });
}

async function primaryAssignmentFor(
  tx: ExamMarksClient,
  assignment: Awaited<ReturnType<typeof requireExactExamMarkAssignment>>
) {
  const primary = await tx.teacherExamAssignment.findFirst({
    where: {
      examinationId: assignment.examinationId,
      classScopeId: assignment.classScopeId,
      subjectPaperId: assignment.subjectPaperId,
      componentId: assignment.componentId,
      assignmentRole: "PRIMARY_SUBMITTER",
      status: "ACTIVE",
      schemeVersionId: assignment.schemeVersionId,
      academicYear: assignment.academicYear,
      className: assignment.className,
      section: assignment.section,
      examination: { status: "ACTIVE" },
      classScope: { status: "ACTIVE" },
      subjectPaper: { status: "ACTIVE" },
      schemeVersion: { status: "ACTIVE", frozenAt: { not: null } },
      staffMember: {
        status: "ACTIVE",
        user: { isActive: true, role: "TEACHER" },
        timetableTeacher: { is: { isActive: true } }
      }
    }
  });
  if (!primary) throw new ExamMarksError("This component has no exact active primary submitter.", 409);
  return primary;
}

async function ensureSheet(
  tx: ExamMarksClient,
  assignment: Awaited<ReturnType<typeof requireExactExamMarkAssignment>>,
  actor: ExamMarksActor
) {
  const logicalSheetKey = eventKey([
    "MARK_SHEET",
    assignment.examinationId,
    assignment.classScopeId,
    assignment.subjectPaperId,
    assignment.componentId
  ]);
  let sheet = await tx.examMarkSheet.findUnique({
    where: { currentKey: logicalSheetKey },
    include: { entries: true }
  });
  if (sheet) return sheet;
  const primary = await primaryAssignmentFor(tx, assignment);
  const students = await exactEligibleStudents(tx, assignment);
  try {
    sheet = await tx.examMarkSheet.create({
      data: {
        examinationId: assignment.examinationId,
        classScopeId: assignment.classScopeId,
        subjectPaperId: assignment.subjectPaperId,
        componentId: assignment.componentId,
        schemeVersionId: assignment.schemeVersionId,
        primaryAssignmentId: primary.id,
        logicalSheetKey,
        currentKey: logicalSheetKey,
        versionNumber: 1,
        academicYear: assignment.academicYear,
        className: assignment.className,
        section: assignment.section,
        status: "NOT_STARTED",
        assignmentSnapshotJson: assignmentSnapshot(assignment),
        createdByUserId: actor.id,
        entries: {
          create: students.map((student) => ({
            studentId: student.studentId,
            entryState: "NOT_ENTERED"
          }))
        }
      },
      include: { entries: true }
    });
    return sheet;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return tx.examMarkSheet.findUniqueOrThrow({
        where: { currentKey: logicalSheetKey },
        include: { entries: true }
      });
    }
    throw error;
  }
}

async function currentSheetVersion(tx: ExamMarksClient, sheetId: string, versionNumber: number) {
  return tx.examMarkSheet.findFirstOrThrow({
    where: { id: sheetId, versionNumber },
    include: { entries: true }
  });
}

function sheetReady(entries: Array<{ entryState: string }>) {
  return entries.length > 0 && entries.every((entry) => entry.entryState !== "NOT_ENTERED");
}

function editableStatus(status: string) {
  return ["NOT_STARTED", "DRAFT", "VALIDATION_FAILED", "READY_TO_SUBMIT", "REOPENED"].includes(status);
}

export async function loadTeacherMarksWorkspace(
  client: ExamMarksClient,
  actor: ExamMarksActor,
  selectedAssignmentId?: string
) {
  const assignments = await listExactTeacherMarkAssignments(client, actor);
  const selected = selectedAssignmentId
    ? assignments.find((row) => row.id === selectedAssignmentId)
    : assignments[0];
  if (!selected) {
    return { assignments: [], selectedWorkspace: null, staffLabel: null, reason: "No exact active examination marks assignment is available." };
  }
  const scoped = assignments.filter((row) =>
    row.examinationId === selected.examinationId &&
    row.classScopeId === selected.classScopeId &&
    row.subjectPaperId === selected.subjectPaperId
  );
  const students = await exactEligibleStudents(client, selected);
  const sheets = await client.examMarkSheet.findMany({
    where: {
      examinationId: selected.examinationId,
      classScopeId: selected.classScopeId,
      subjectPaperId: selected.subjectPaperId,
      componentId: { in: scoped.map((row) => row.componentId) },
      currentKey: { not: null }
    },
    include: {
      entries: true
    }
  });
  const sheetByComponent = new Map(sheets.map((sheet) => [sheet.componentId, sheet]));
  return {
    assignments: assignments.map(publicTeacherMarkAssignment),
    selectedWorkspace: {
      examination: publicTeacherMarkAssignment(selected).examination,
      academicYear: selected.academicYear,
      className: selected.className,
      section: selected.section,
      paper: publicTeacherMarkAssignment(selected).paper,
      students: students.map((student) => ({
        studentId: student.studentId,
        admissionNo: student.student.admissionNo,
        studentName: student.student.studentName,
        rollNo: student.rollNo
      })),
      components: scoped.map((assignment) => {
        const sheet = sheetByComponent.get(assignment.componentId);
        const version = sheet;
        const entries = new Map(sheet?.entries.map((entry) => [entry.studentId, entry]) ?? []);
        return {
          assignment: publicTeacherMarkAssignment(assignment),
          sheet: sheet ? {
            id: sheet.id,
            status: sheet.status,
            version: sheet.optimisticVersion,
            versionNumber: sheet.versionNumber,
            optimisticVersion: sheet.optimisticVersion,
            savedAt: sheet.updatedAt.toISOString(),
            correctionPending: sheet.correctionRequestStatus === "PENDING"
          } : null,
          entries: students.map((student) => {
            const entry = entries.get(student.studentId);
            return entry ? serializeEntry(entry) : {
              studentId: student.studentId,
              entryState: "NOT_ENTERED",
              marksObtained: null,
              remarks: null,
              rowVersion: 1
            };
          })
        };
      })
    },
    staffLabel: selected.staffMember.displayName ?? selected.staffMember.fullName,
    reason: null
  };
}

export async function saveAssignedMarkDraft(
  client: ExamMarksClient,
  assignmentId: string,
  input: unknown,
  actor: ExamMarksActor,
  now = new Date()
) {
  const source = objectInput(input);
  const saveRequestKey = requestKey(source.requestKey, "save");
  const rowsValue = source.rows;
  if (!Array.isArray(rowsValue) || rowsValue.length < 1 || rowsValue.length > 200) {
    throw new ExamMarksError("A save requires between 1 and 200 Student rows.");
  }
  await requireExactExamMarkAssignment(client, actor, assignmentId);
  return client.$transaction(async (tx: ExamMarksClient) => {
    const assignment = await requireExactExamMarkAssignment(tx, actor, assignmentId);
    const parsedRows = rowsValue.map((row) =>
      parseMarkRow(row, assignment.component.maximumMarks, assignment.schemeVersion.markDecimalPlaces)
    );
    if (new Set(parsedRows.map((row) => row.studentId)).size !== parsedRows.length) {
      throw new ExamMarksError("Each Student may appear only once in a component save.");
    }
    const eligible = await exactEligibleStudents(tx, assignment);
    const eligibleIds = new Set(eligible.map((row) => row.studentId));
    if (parsedRows.some((row) => !eligibleIds.has(row.studentId))) throw new ExamMarksScopeError();
    const sheet = await ensureSheet(tx, assignment, actor);
    const version = await currentSheetVersion(tx, sheet.id, sheet.versionNumber);
    const idempotencyKey = eventKey(["MARK_SAVE", sheet.id, saveRequestKey]);
    const priorEvent = await tx.examinationSchemeAudit.findUnique({ where: { eventKey: idempotencyKey } });
    if (priorEvent) return JSON.parse(priorEvent.snapshotJson) as Record<string, unknown>;
    if (!editableStatus(version.status)) throw new ExamMarksError("This submitted mark sheet is read-only.", 409);
    if (source.expectedSheetVersion != null && positiveVersion(source.expectedSheetVersion, "sheet") !== sheet.optimisticVersion) {
      throw new ExamMarksError("This mark sheet changed in another session. Reload it before saving.", 409, "EXPECTED_VERSION_CONFLICT");
    }
    if (source.expectedVersionNumber != null && positiveVersion(source.expectedVersionNumber, "sheet history") !== version.versionNumber) {
      throw new ExamMarksError("A newer sheet version is active. Reload it before saving.", 409, "EXPECTED_VERSION_CONFLICT");
    }
    if (source.expectedOptimisticVersion != null && positiveVersion(source.expectedOptimisticVersion, "draft") !== version.optimisticVersion) {
      throw new ExamMarksError("This draft changed in another session. Reload it before saving.", 409, "EXPECTED_VERSION_CONFLICT");
    }
    const currentByStudent = new Map(version.entries.map((entry) => [entry.studentId, entry]));
    let changedCount = 0;
    for (const row of parsedRows) {
      const current = currentByStudent.get(row.studentId);
      if (!current) throw new ExamMarksError("The Student row is no longer part of this sheet.", 409);
      const sameMark = current.marksObtained === null
        ? row.marksObtained === null
        : row.marksObtained !== null && current.marksObtained.equals(row.marksObtained);
      if (current.entryState === row.entryState && sameMark && (current.remarks ?? null) === row.remarks) continue;
      if (current.rowVersion !== row.expectedRowVersion) {
        throw new ExamMarksError("A Student row changed in another session. Reload it before saving.", 409, "EXPECTED_VERSION_CONFLICT");
      }
      const changed = await tx.examMarkEntry.updateMany({
        where: { id: current.id, rowVersion: row.expectedRowVersion },
        data: {
          entryState: row.entryState,
          marksObtained: row.marksObtained,
          remarks: row.remarks,
          rowVersion: { increment: 1 },
          enteredByUserId: actor.id,
          enteredAt: now
        }
      });
      if (changed.count !== 1) throw new ExamMarksError("A Student row changed in another session.", 409, "EXPECTED_VERSION_CONFLICT");
      changedCount += 1;
    }
    const refreshed = await tx.examMarkEntry.findMany({ where: { sheetId: version.id }, orderBy: { studentId: "asc" } });
    const nextStatus = sheetReady(refreshed) ? "READY_TO_SUBMIT" : "DRAFT";
    const changedVersion = await tx.examMarkSheet.updateMany({
      where: { id: version.id, optimisticVersion: version.optimisticVersion },
      data: { status: nextStatus, optimisticVersion: { increment: 1 }, updatedAt: now }
    });
    if (changedVersion.count !== 1) throw new ExamMarksError("This draft changed in another session.", 409, "EXPECTED_VERSION_CONFLICT");
    const response = {
      sheetId: sheet.id,
      status: nextStatus,
      changed: changedCount,
      unchanged: parsedRows.length - changedCount,
      sheetVersion: sheet.optimisticVersion + 1,
      versionNumber: version.versionNumber,
      optimisticVersion: version.optimisticVersion + 1,
      savedAt: now.toISOString(),
      entries: refreshed.map(serializeEntry)
    };
    await governanceEvent(tx, {
      eventKey: idempotencyKey,
      examinationId: sheet.examinationId,
      schemeVersionId: sheet.schemeVersionId,
      assignmentId: assignment.id,
      eventType: changedCount ? "DRAFT_SAVED" : "DRAFT_SAVE_RETRIED",
      targetType: "EXAM_MARK_SHEET_VERSION",
      targetId: sheet.id,
      previousStatus: version.status,
      newStatus: nextStatus,
      actor,
      snapshot: response,
      eventDate: now
    });
    return response;
  }).catch(normalizeExamMarksError);
}

export async function submitAssignedMarkSheet(
  client: ExamMarksClient,
  assignmentId: string,
  input: unknown,
  actor: ExamMarksActor,
  now = new Date()
) {
  const source = objectInput(input);
  const submissionRequestKey = requestKey(source.requestKey, "submission");
  await requireExactExamMarkAssignment(client, actor, assignmentId, { requirePrimary: true });
  return client.$transaction(async (tx: ExamMarksClient) => {
    const assignment = await requireExactExamMarkAssignment(tx, actor, assignmentId, { requirePrimary: true });
    const sheet = await ensureSheet(tx, assignment, actor);
    if (sheet.primaryAssignmentId !== assignment.id) {
      throw new ExamMarksError("Only the frozen primary assignment can submit this sheet.", 403);
    }
    const version = await currentSheetVersion(tx, sheet.id, sheet.versionNumber);
    const idempotencyKey = eventKey(["MARK_SUBMIT", sheet.id, submissionRequestKey]);
    const priorEvent = await tx.examinationSchemeAudit.findUnique({ where: { eventKey: idempotencyKey } });
    if (priorEvent) return JSON.parse(priorEvent.snapshotJson) as Record<string, unknown>;
    const expectedSheetVersion = positiveVersion(source.expectedSheetVersion, "sheet");
    const expectedOptimisticVersion = positiveVersion(source.expectedOptimisticVersion, "draft");
    if (sheet.optimisticVersion !== expectedSheetVersion || version.optimisticVersion !== expectedOptimisticVersion) {
      throw new ExamMarksError("This mark sheet changed in another session. Reload it before submitting.", 409, "EXPECTED_VERSION_CONFLICT");
    }
    if (!editableStatus(version.status)) {
      if (["SUBMITTED", "RESUBMITTED", "MODERATED", "LOCKED"].includes(version.status)) {
        return { sheetId: sheet.id, status: version.status, submitted: true, versionNumber: version.versionNumber };
      }
      throw new ExamMarksError("This sheet cannot be submitted from its current state.", 409);
    }
    const eligible = await exactEligibleStudents(tx, assignment);
    const eligibleIds = new Set(eligible.map((row) => row.studentId));
    const invalid = version.entries.filter((entry) => !eligibleIds.has(entry.studentId) || entry.entryState === "NOT_ENTERED");
    const missingIds = eligible.filter((student) => {
      const entry = version.entries.find((candidate) => candidate.studentId === student.studentId);
      return !entry || entry.entryState === "NOT_ENTERED";
    }).map((row) => row.studentId);
    const validationIssues = [
      ...(invalid.length ? ["The sheet contains unavailable or Not Entered rows."] : []),
      ...(missingIds.length ? [`${missingIds.length} required Student entr${missingIds.length === 1 ? "y is" : "ies are"} missing.`] : []),
      ...(assignment.schemeVersion.id !== version.schemeVersionId || assignment.schemeVersion.status !== "ACTIVE" || !assignment.schemeVersion.frozenAt
        ? ["The assigned frozen scheme version is no longer valid."]
        : [])
    ];
    if (validationIssues.length) {
      const failedVersion = await tx.examMarkSheet.updateMany({
        where: { id: version.id, optimisticVersion: expectedOptimisticVersion },
        data: { status: "VALIDATION_FAILED", optimisticVersion: { increment: 1 }, updatedAt: now }
      });
      if (failedVersion.count !== 1) {
        throw new ExamMarksError("This mark sheet changed during validation.", 409, "EXPECTED_VERSION_CONFLICT");
      }
      const response = {
        sheetId: sheet.id,
        status: "VALIDATION_FAILED",
        submitted: false,
        validationIssues,
        sheetVersion: sheet.optimisticVersion + 1,
        optimisticVersion: version.optimisticVersion + 1,
        versionNumber: version.versionNumber
      };
      await governanceEvent(tx, {
        eventKey: idempotencyKey,
        examinationId: sheet.examinationId,
        schemeVersionId: sheet.schemeVersionId,
        assignmentId: assignment.id,
        eventType: "SUBMISSION_VALIDATION_FAILED",
        targetType: "EXAM_MARK_SHEET_VERSION",
        targetId: sheet.id,
        previousStatus: version.status,
        newStatus: "VALIDATION_FAILED",
        actor,
        snapshot: response,
        eventDate: now
      });
      return response;
    }
    const targetStatus = version.versionNumber > 1 ? "RESUBMITTED" : "SUBMITTED";
    const changedVersion = await tx.examMarkSheet.updateMany({
      where: { id: version.id, optimisticVersion: expectedOptimisticVersion },
      data: {
        status: targetStatus,
        optimisticVersion: { increment: 1 },
        submittedByUserId: actor.id,
        submittedAt: now,
        updatedAt: now
      }
    });
    if (changedVersion.count !== 1) {
      throw new ExamMarksError("This mark sheet changed during submission.", 409, "EXPECTED_VERSION_CONFLICT");
    }
    const response = {
      sheetId: sheet.id,
      status: targetStatus,
      submitted: true,
      sheetVersion: sheet.optimisticVersion + 1,
      versionNumber: version.versionNumber,
      optimisticVersion: version.optimisticVersion + 1,
      submittedAt: now.toISOString(),
      submittedByAssignmentId: assignment.id
    };
    await governanceEvent(tx, {
      eventKey: idempotencyKey,
      examinationId: sheet.examinationId,
      schemeVersionId: sheet.schemeVersionId,
      assignmentId: assignment.id,
      eventType: targetStatus === "RESUBMITTED" ? "SHEET_RESUBMITTED" : "SHEET_SUBMITTED",
      targetType: "EXAM_MARK_SHEET_VERSION",
      targetId: sheet.id,
      previousStatus: version.status,
      newStatus: targetStatus,
      actor,
      snapshot: response,
      eventDate: now
    });
    return response;
  }).catch(normalizeExamMarksError);
}

export async function requestMarkCorrection(
  client: ExamMarksClient,
  assignmentId: string,
  input: unknown,
  actor: ExamMarksActor,
  now = new Date()
) {
  const source = objectInput(input);
  const reason = boundedText(source.reason, "Correction reason", 500)!;
  const correctionRequestKey = requestKey(source.requestKey, "correction");
  await requireExactExamMarkAssignment(client, actor, assignmentId);
  return client.$transaction(async (tx: ExamMarksClient) => {
    const assignment = await requireExactExamMarkAssignment(tx, actor, assignmentId);
    const logicalSheetKey = eventKey([
      "MARK_SHEET",
      assignment.examinationId,
      assignment.classScopeId,
      assignment.subjectPaperId,
      assignment.componentId
    ]);
    const sheet = await tx.examMarkSheet.findUnique({ where: { currentKey: logicalSheetKey } });
    if (!sheet) throw new ExamMarksError("No submitted sheet exists for this assignment.", 409);
    const version = await currentSheetVersion(tx, sheet.id, sheet.versionNumber);
    if (!["SUBMITTED", "RESUBMITTED", "MODERATED", "LOCKED"].includes(version.status)) {
      throw new ExamMarksError("A correction can be requested only after final submission.", 409);
    }
    const key = eventKey(["MARK_CORRECTION_REQUEST", sheet.id, correctionRequestKey]);
    const existingEvent = await tx.examinationSchemeAudit.findUnique({ where: { eventKey: key } });
    if (existingEvent) return JSON.parse(existingEvent.snapshotJson) as Record<string, unknown>;
    if (sheet.correctionRequestStatus === "PENDING" && sheet.correctionRequestId) {
      return { requestId: sheet.correctionRequestId, status: "PENDING", sheetStatus: "REOPEN_REQUESTED" };
    }
    const correctionRequestId = eventKey(["CORRECTION_REQUEST_ID", sheet.id, correctionRequestKey]).slice(0, 40);
    const changed = await tx.examMarkSheet.updateMany({
      where: { id: sheet.id, optimisticVersion: sheet.optimisticVersion },
      data: {
        status: "REOPEN_REQUESTED",
        correctionRequestId,
        correctionRequestStatus: "PENDING",
        correctionPriorStatus: sheet.status,
        correctionRequestReason: reason,
        correctionRequestedByUserId: actor.id,
        correctionRequestedAt: now,
        correctionReviewedByUserId: null,
        correctionReviewReason: null,
        correctionReviewedAt: null,
        optimisticVersion: { increment: 1 },
        updatedAt: now
      }
    });
    if (changed.count !== 1) throw new ExamMarksError("This sheet changed while requesting correction.", 409);
    const response = {
      requestId: correctionRequestId,
      status: "PENDING",
      sheetStatus: "REOPEN_REQUESTED",
      sheetVersion: sheet.optimisticVersion + 1
    };
    await governanceEvent(tx, {
      eventKey: key,
      examinationId: sheet.examinationId,
      schemeVersionId: sheet.schemeVersionId,
      assignmentId: assignment.id,
      eventType: "CORRECTION_REQUESTED",
      targetType: "EXAM_MARK_SHEET_VERSION",
      targetId: sheet.id,
      previousStatus: sheet.status,
      newStatus: "REOPEN_REQUESTED",
      reason,
      actor,
      snapshot: response,
      eventDate: now
    });
    return response;
  }).catch(normalizeExamMarksError);
}

function interventionReason(actor: ExamMarksActor, value: unknown) {
  if (actor.role !== "SUPER_ADMIN") return null;
  return boundedText(value, "Super Admin intervention audit reason", 500);
}

export async function reviewMarkCorrection(
  client: ExamMarksClient,
  requestIdValue: unknown,
  input: unknown,
  actor: ExamMarksActor,
  now = new Date()
) {
  const requestId = safeId(requestIdValue, "Correction request");
  const source = objectInput(input);
  const action = String(source.action ?? "").trim().toLowerCase();
  if (!["reject", "reopen"].includes(action)) throw new ExamMarksError("Choose reject or reopen.");
  const reason = boundedText(source.reason, `${action === "reopen" ? "Reopen" : "Rejection"} reason`, 500)!;
  const governedReason = interventionReason(actor, source.interventionReason);
  const reviewRequestKey = requestKey(source.requestKey, "review");
  const expectedSheetVersion = positiveVersion(source.expectedSheetVersion, "sheet");
  return client.$transaction(async (tx: ExamMarksClient) => {
    const sheet = await tx.examMarkSheet.findUnique({
      where: { correctionRequestId: requestId },
      include: { entries: true }
    });
    if (!sheet) throw new ExamMarksError("Correction request was not found.", 404);
    const currentVersion = sheet;
    const key = eventKey(["MARK_CORRECTION_REVIEW", sheet.id, reviewRequestKey]);
    const existing = await tx.examinationSchemeAudit.findUnique({ where: { eventKey: key } });
    if (existing) return JSON.parse(existing.snapshotJson) as Record<string, unknown>;
    if (sheet.correctionRequestStatus !== "PENDING") {
      return {
        requestId,
        status: sheet.correctionRequestStatus,
        sheetStatus: sheet.status,
        versionNumber: sheet.versionNumber
      };
    }
    if (sheet.optimisticVersion !== expectedSheetVersion) {
      throw new ExamMarksError("This correction request changed in another session.", 409, "EXPECTED_VERSION_CONFLICT");
    }
    if (action === "reject") {
      const changed = await tx.examMarkSheet.updateMany({
        where: { id: sheet.id, optimisticVersion: expectedSheetVersion, correctionRequestStatus: "PENDING" },
        data: {
          status: sheet.correctionPriorStatus ?? (sheet.versionNumber > 1 ? "RESUBMITTED" : "SUBMITTED"),
          correctionRequestStatus: "REJECTED",
          correctionReviewedByUserId: actor.id,
          correctionReviewReason: reason,
          correctionReviewedAt: now,
          optimisticVersion: { increment: 1 },
          updatedAt: now
        }
      });
      if (changed.count !== 1) throw new ExamMarksError("This sheet changed during correction review.", 409);
      const response = {
        requestId,
        status: "REJECTED",
        sheetStatus: sheet.correctionPriorStatus ?? (sheet.versionNumber > 1 ? "RESUBMITTED" : "SUBMITTED"),
        versionNumber: sheet.versionNumber,
        sheetVersion: expectedSheetVersion + 1
      };
      await governanceEvent(tx, {
        eventKey: key,
        examinationId: sheet.examinationId,
        schemeVersionId: sheet.schemeVersionId,
        assignmentId: sheet.primaryAssignmentId,
        eventType: "CORRECTION_REJECTED",
        targetType: "EXAM_MARK_SHEET_VERSION",
        targetId: sheet.id,
        previousStatus: "REOPEN_REQUESTED",
        newStatus: response.sheetStatus,
        reason,
        actor,
        snapshot: { ...response, interventionReason: governedReason },
        eventDate: now
      });
      return response;
    }
    const nextVersionNumber = sheet.versionNumber + 1;
    const nextVersion = await tx.examMarkSheet.create({
      data: {
        logicalSheetKey: sheet.logicalSheetKey,
        currentKey: null,
        versionNumber: nextVersionNumber,
        supersedesSheetId: sheet.id,
        examinationId: sheet.examinationId,
        classScopeId: sheet.classScopeId,
        subjectPaperId: sheet.subjectPaperId,
        componentId: sheet.componentId,
        status: "REOPENED",
        schemeVersionId: currentVersion.schemeVersionId,
        primaryAssignmentId: currentVersion.primaryAssignmentId,
        assignmentSnapshotJson: currentVersion.assignmentSnapshotJson,
        academicYear: sheet.academicYear,
        className: sheet.className,
        section: sheet.section,
        createdByUserId: actor.id,
        entries: {
          create: currentVersion.entries.map((entry) => ({
            studentId: entry.studentId,
            entryState: entry.entryState,
            marksObtained: entry.marksObtained,
            remarks: entry.remarks,
            enteredByUserId: entry.enteredByUserId,
            enteredAt: entry.enteredAt
          }))
        }
      }
    });
    const changed = await tx.examMarkSheet.updateMany({
      where: { id: sheet.id, optimisticVersion: expectedSheetVersion, correctionRequestStatus: "PENDING" },
      data: {
        currentKey: null,
        correctionRequestStatus: "APPROVED",
        correctionReviewedByUserId: actor.id,
        correctionReviewReason: reason,
        correctionReviewedAt: now,
        optimisticVersion: { increment: 1 },
        updatedAt: now
      }
    });
    if (changed.count !== 1) throw new ExamMarksError("This sheet changed during reopening.", 409);
    await tx.examMarkSheet.update({ where: { id: nextVersion.id }, data: { currentKey: sheet.logicalSheetKey } });
    const response = {
      requestId,
      status: "APPROVED",
      sheetStatus: "REOPENED",
      previousVersionNumber: sheet.versionNumber,
      versionNumber: nextVersionNumber,
      sheetVersion: expectedSheetVersion + 1
    };
    await governanceEvent(tx, {
      eventKey: key,
      examinationId: sheet.examinationId,
      schemeVersionId: sheet.schemeVersionId,
      assignmentId: sheet.primaryAssignmentId,
      eventType: "SHEET_REOPENED",
      targetType: "EXAM_MARK_SHEET_VERSION",
      targetId: nextVersion.id,
      previousStatus: currentVersion.status,
      newStatus: "REOPENED",
      reason,
      actor,
      snapshot: { ...response, interventionReason: governedReason },
      eventDate: now
    });
    return response;
  }).catch(normalizeExamMarksError);
}

export async function moderateMarkSheet(
  client: ExamMarksClient,
  sheetIdValue: unknown,
  input: unknown,
  actor: ExamMarksActor,
  now = new Date()
) {
  const sheetId = safeId(sheetIdValue, "Mark sheet");
  const source = objectInput(input);
  const reason = boundedText(source.reason, "Moderation reason", 500)!;
  const governedReason = interventionReason(actor, source.interventionReason);
  const moderationRequestKey = requestKey(source.requestKey, "moderation");
  const expectedSheetVersion = positiveVersion(source.expectedSheetVersion, "sheet");
  return client.$transaction(async (tx: ExamMarksClient) => {
    const sheet = await tx.examMarkSheet.findUnique({ where: { id: sheetId } });
    if (!sheet) throw new ExamMarksError("Mark sheet was not found.", 404);
    const version = await currentSheetVersion(tx, sheet.id, sheet.versionNumber);
    const key = eventKey(["MARK_MODERATE", sheet.id, moderationRequestKey]);
    const existing = await tx.examinationSchemeAudit.findUnique({ where: { eventKey: key } });
    if (existing) return JSON.parse(existing.snapshotJson) as Record<string, unknown>;
    if (version.status === "MODERATED") return { sheetId, status: "MODERATED", versionNumber: version.versionNumber };
    if (!["SUBMITTED", "RESUBMITTED"].includes(version.status)) {
      throw new ExamMarksError("Only a submitted or resubmitted sheet can be moderated.", 409);
    }
    if (sheet.optimisticVersion !== expectedSheetVersion) throw new ExamMarksError("This mark sheet changed before moderation.", 409);
    const changedVersion = await tx.examMarkSheet.updateMany({
      where: { id: version.id, status: version.status, optimisticVersion: expectedSheetVersion },
      data: { status: "MODERATED", moderatedByUserId: actor.id, moderatedAt: now, optimisticVersion: { increment: 1 }, updatedAt: now }
    });
    if (changedVersion.count !== 1) {
      throw new ExamMarksError("This mark sheet changed during moderation.", 409);
    }
    const response = {
      sheetId,
      status: "MODERATED",
      versionNumber: version.versionNumber,
      sheetVersion: expectedSheetVersion + 1,
      moderatedAt: now.toISOString()
    };
    await governanceEvent(tx, {
      eventKey: key,
      examinationId: sheet.examinationId,
      schemeVersionId: sheet.schemeVersionId,
      assignmentId: sheet.primaryAssignmentId,
      eventType: "SHEET_MODERATED",
      targetType: "EXAM_MARK_SHEET_VERSION",
      targetId: sheet.id,
      previousStatus: version.status,
      newStatus: "MODERATED",
      reason,
      actor,
      snapshot: { ...response, interventionReason: governedReason },
      eventDate: now
    });
    return response;
  }).catch(normalizeExamMarksError);
}

export function normalizeExamMarksError(error: unknown): never {
  if (error instanceof ExamMarksError || error instanceof ExamMarksScopeError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new ExamMarksError("A governed marks record already exists.", 409);
    if (error.code === "P2003") throw new ExamMarksError("A required governed marks source is unavailable.", 409);
  }
  throw new ExamMarksError("The governed marks operation could not be completed safely.", 500);
}
