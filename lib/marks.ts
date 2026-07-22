import { Prisma, type PrismaClient } from "@prisma/client";
import { examDecimal, parseExpectedVersion, safeExamText } from "@/lib/exams";

export const MARK_ENTRY_STATUSES = ["PRESENT", "ABSENT", "EXEMPT", "NOT_APPLICABLE"] as const;
export const MARK_EVENT_TYPES = ["MARK_CREATED", "MARK_UPDATED", "MARK_STATUS_CHANGED", "MARKS_SUBMITTED", "MARKS_APPROVED", "MARKS_LOCKED", "CORRECTION_REQUESTED", "CORRECTION_APPLIED", "ASSESSMENT_CANCELLED"] as const;

export function validateMarkRow(input: unknown, maxMarks: Prisma.Decimal) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Each mark row must be an object.");
  const row = input as Record<string, unknown>;
  const admissionNumber = String(row.admissionNumber ?? "").trim();
  if (!admissionNumber) throw new Error("Admission number is required for every mark row.");
  const entryStatus = String(row.entryStatus ?? "PRESENT").toUpperCase();
  if (!(MARK_ENTRY_STATUSES as readonly string[]).includes(entryStatus)) throw new Error("Choose Present, Absent, Exempt, or Not Applicable.");
  const raw = String(row.marksObtained ?? "").trim();
  const marksObtained = raw ? examDecimal(raw, "Marks obtained", { max: maxMarks }) : null;
  if (entryStatus === "PRESENT" && marksObtained === null) throw new Error("Present students require marks. A blank is not zero.");
  if (entryStatus !== "PRESENT" && marksObtained !== null) throw new Error(`${entryStatus.replaceAll("_", " ")} must not carry marks.`);
  return { admissionNumber, entryStatus, marksObtained, remarks: safeExamText(row.remarks, "Remarks", 500, false) };
}

export async function eligibleStudents(prisma: Pick<PrismaClient | Prisma.TransactionClient, "academicYearEnrollment">, assessment: { academicYear: string; className: string; section: string }) {
  return prisma.academicYearEnrollment.findMany({
    where: { academicYear: assessment.academicYear, className: assessment.className, ...(assessment.section ? { section: assessment.section } : {}), status: "ACTIVE", student: { deletedAt: null, status: "Active" } },
    select: { studentId: true, rollNo: true, student: { select: { admissionNo: true, studentName: true } } },
    orderBy: [{ rollNo: "asc" }, { student: { studentName: "asc" } }]
  });
}

export async function loadMarkEntry(prisma: PrismaClient, assessmentId: string) {
  const assessment = await prisma.examAssessment.findUnique({ where: { id: assessmentId }, include: { examCycle: true, marks: true, events: { orderBy: { eventDate: "desc" } } } });
  if (!assessment) throw new Error("Assessment was not found.");
  const students = await eligibleStudents(prisma, assessment);
  const markByStudent = new Map(assessment.marks.map((mark) => [mark.studentId, mark]));
  return {
    assessment,
    students: students.map((item) => {
      const mark = markByStudent.get(item.studentId);
      return { admissionNumber: item.student.admissionNo, studentName: item.student.studentName, rollNo: item.rollNo, marksObtained: mark?.marksObtained?.toString() ?? "", entryStatus: mark?.entryStatus ?? "PRESENT", remarks: mark?.remarks ?? "", entered: Boolean(mark) };
    }),
    unrelatedStoredMarks: assessment.marks.filter((mark) => !students.some((item) => item.studentId === mark.studentId)).length
  };
}

export async function saveMarkDraft(prisma: PrismaClient, assessmentId: string, rowsValue: unknown, expectedValue: unknown, actor: { id: string; name: string }, now = new Date()) {
  if (!Array.isArray(rowsValue)) throw new Error("Mark rows are required.");
  const expectedUpdatedAt = parseExpectedVersion(expectedValue, "mark sheet");
  return prisma.$transaction(async (tx) => {
    const assessment = await tx.examAssessment.findUnique({ where: { id: assessmentId }, include: { examCycle: true, marks: true } });
    if (!assessment) throw new Error("Assessment was not found.");
    if (assessment.examCycle.status !== "OPEN_FOR_ENTRY" || assessment.entryStatus !== "OPEN") throw new Error("This mark sheet is not open for ordinary editing.");
    const rows = rowsValue.map((row) => validateMarkRow(row, assessment.maxMarks));
    if (new Set(rows.map((row) => row.admissionNumber)).size !== rows.length) throw new Error("Each Student may appear only once in a save.");
    const eligible = await eligibleStudents(tx, assessment);
    const eligibleByAdmission = new Map(eligible.map((row) => [row.student.admissionNo, row]));
    if (rows.some((row) => !eligibleByAdmission.has(row.admissionNumber))) throw new Error("A submitted Student is outside this assessment's active enrollment scope.");
    const bumped = await tx.examAssessment.updateMany({ where: { id: assessmentId, entryStatus: "OPEN", updatedAt: expectedUpdatedAt }, data: { updatedAt: now } });
    if (bumped.count !== 1) throw new Error("This mark sheet changed in another session. Reload it before saving.");
    const prior = new Map(assessment.marks.map((mark) => [mark.studentId, mark]));
    let created = 0; let updated = 0; let unchanged = 0;
    for (const row of rows) {
      const studentId = eligibleByAdmission.get(row.admissionNumber)!.studentId;
      const before = prior.get(studentId);
      const sameMarks = before ? (before.marksObtained === null ? row.marksObtained === null : row.marksObtained !== null && before.marksObtained.equals(row.marksObtained)) : false;
      if (before && before.entryStatus === row.entryStatus && sameMarks && (before.remarks ?? null) === row.remarks) { unchanged += 1; continue; }
      const mark = await tx.studentMark.upsert({
        where: { assessmentId_studentId: { assessmentId, studentId } },
        update: { marksObtained: row.marksObtained, entryStatus: row.entryStatus, remarks: row.remarks, enteredByUserId: actor.id, enteredAt: now },
        create: { assessmentId, studentId, academicYear: assessment.academicYear, marksObtained: row.marksObtained, entryStatus: row.entryStatus, remarks: row.remarks, enteredByUserId: actor.id, enteredAt: now }
      });
      await tx.studentMarkEvent.create({ data: { assessmentId, studentMarkId: mark.id, eventType: before ? (before.entryStatus === row.entryStatus ? "MARK_UPDATED" : "MARK_STATUS_CHANGED") : "MARK_CREATED", previousMarks: before?.marksObtained ?? null, newMarks: row.marksObtained, previousEntryStatus: before?.entryStatus ?? null, newEntryStatus: row.entryStatus, actorLabel: actor.name, eventDate: now } });
      if (before) updated += 1; else created += 1;
    }
    return { created, updated, unchanged, updatedAt: now.toISOString() };
  });
}

export async function transitionAssessment(prisma: PrismaClient, assessmentId: string, action: "submit" | "approve" | "lock" | "cancel", expectedValue: unknown, actor: { id: string; name: string }, reasonValue?: unknown, now = new Date()) {
  const expectedUpdatedAt = parseExpectedVersion(expectedValue, "mark sheet");
  return prisma.$transaction(async (tx) => {
    const assessment = await tx.examAssessment.findUnique({ where: { id: assessmentId }, include: { examCycle: true, marks: true } });
    if (!assessment) throw new Error("Assessment was not found.");
    const target = action === "submit" ? "SUBMITTED" : action === "approve" ? "APPROVED" : action === "lock" ? "LOCKED" : "CANCELLED";
    if (assessment.entryStatus === target) return assessment;
    if (action === "submit") {
      if (assessment.entryStatus !== "OPEN" || assessment.examCycle.status !== "OPEN_FOR_ENTRY") throw new Error("Only an open mark sheet can be submitted.");
      const students = await eligibleStudents(tx, assessment);
      if (students.length !== assessment.marks.length || students.some((student) => !assessment.marks.some((mark) => mark.studentId === student.studentId))) throw new Error("Enter a valid status or mark for every eligible Student before submission.");
    }
    if (action === "approve" && (assessment.entryStatus !== "SUBMITTED" || assessment.examCycle.status !== "ENTRY_CLOSED")) throw new Error("Approval requires a submitted sheet after exam entry is closed.");
    if (action === "lock" && (assessment.entryStatus !== "APPROVED" || assessment.examCycle.status !== "APPROVED")) throw new Error("Locking requires an approved sheet in an approved exam.");
    if (action === "cancel" && assessment.entryStatus === "LOCKED") throw new Error("A locked assessment is immutable.");
    const reason = action === "cancel" ? safeExamText(reasonValue, "Cancellation reason", 1_000)! : null;
    const data: Record<string, unknown> = { entryStatus: target };
    if (action === "submit") Object.assign(data, { submittedAt: now, submittedByUserId: actor.id });
    if (action === "approve") Object.assign(data, { approvedAt: now, approvedByUserId: actor.id });
    if (action === "lock") Object.assign(data, { lockedAt: now, lockedByUserId: actor.id });
    const changed = await tx.examAssessment.updateMany({ where: { id: assessmentId, entryStatus: assessment.entryStatus, updatedAt: expectedUpdatedAt }, data });
    if (changed.count !== 1) throw new Error("This mark sheet changed in another session. Reload it before continuing.");
    if (action === "approve") await tx.studentMark.updateMany({ where: { assessmentId }, data: { verifiedByUserId: actor.id, verifiedAt: now } });
    await tx.studentMarkEvent.create({ data: { assessmentId, eventType: action === "submit" ? "MARKS_SUBMITTED" : action === "approve" ? "MARKS_APPROVED" : action === "lock" ? "MARKS_LOCKED" : "ASSESSMENT_CANCELLED", reason, actorLabel: actor.name, eventDate: now } });
    return tx.examAssessment.findUniqueOrThrow({ where: { id: assessmentId } });
  });
}

export async function applyApprovedCorrection(prisma: PrismaClient, assessmentId: string, input: unknown, expectedValue: unknown, reasonValue: unknown, actor: { id: string; name: string }, now = new Date()) {
  const expectedUpdatedAt = parseExpectedVersion(expectedValue, "approved mark sheet");
  const reason = safeExamText(reasonValue, "Correction reason", 1_000)!;
  return prisma.$transaction(async (tx) => {
    const assessment = await tx.examAssessment.findUnique({ where: { id: assessmentId }, include: { examCycle: true, marks: true } });
    if (!assessment || assessment.entryStatus !== "APPROVED" || !["ENTRY_CLOSED", "APPROVED"].includes(assessment.examCycle.status)) throw new Error("Only an approved, not locked or cancelled, mark sheet can use controlled correction.");
    const row = validateMarkRow(input, assessment.maxMarks);
    const students = await eligibleStudents(tx, assessment);
    const student = students.find((student) => student.student.admissionNo === row.admissionNumber);
    if (!student) throw new Error("This Student is outside the approved assessment scope.");
    const before = assessment.marks.find((mark) => mark.studentId === student.studentId);
    if (!before) throw new Error("Only an existing approved mark can be corrected.");
    const bumped = await tx.examAssessment.updateMany({ where: { id: assessmentId, entryStatus: "APPROVED", updatedAt: expectedUpdatedAt }, data: { updatedAt: now } });
    if (bumped.count !== 1) throw new Error("This approved sheet changed in another session. Reload it before correcting.");
    await tx.studentMarkEvent.create({ data: { assessmentId, studentMarkId: before.id, eventType: "CORRECTION_REQUESTED", previousMarks: before.marksObtained, previousEntryStatus: before.entryStatus, reason, actorLabel: actor.name, eventDate: now } });
    const mark = await tx.studentMark.update({ where: { id: before.id }, data: { marksObtained: row.marksObtained, entryStatus: row.entryStatus, remarks: row.remarks, verifiedByUserId: actor.id, verifiedAt: now } });
    await tx.studentMarkEvent.create({ data: { assessmentId, studentMarkId: mark.id, eventType: "CORRECTION_APPLIED", previousMarks: before.marksObtained, newMarks: row.marksObtained, previousEntryStatus: before.entryStatus, newEntryStatus: row.entryStatus, reason, actorLabel: actor.name, eventDate: now } });
    return { updatedAt: now.toISOString() };
  });
}
