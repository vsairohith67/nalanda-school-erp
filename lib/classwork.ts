import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import {
  ClassworkAccessError,
  classworkItemScopeWhere,
  isClassworkLeadershipRole,
  requireClassworkTeacherTarget,
  requireLearnerAudience,
  resolveClassworkTeacherScope,
  type ClassworkLearnerContext,
  type ClassworkTarget
} from "@/lib/classwork-access";
import {
  publishClassworkNotification,
  resolvePublishedClassworkRecipients,
  resolveSubmissionTeacherRecipients
} from "@/lib/classwork-notifications";

const ITEM_KINDS = ["CLASSWORK", "HOMEWORK", "ASSIGNMENT"] as const;
const ITEM_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"] as const;
const REQUEST_KEY = /^[A-Za-z0-9_-]{16,120}$/;

export class ClassworkError extends Error {
  constructor(message: string, public status = 400, public code = "CLASSWORK_INVALID") { super(message); }
}

export type ClassworkDraftInput = ClassworkTarget & {
  kind: (typeof ITEM_KINDS)[number];
  title: string;
  instructions: string;
  dueAt: Date | null;
};

export function validateClassworkDraftInput(value: unknown): ClassworkDraftInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ClassworkError("Classwork details are required.");
  const row = value as Record<string, unknown>;
  const academicYear = text(row.academicYear, "Academic year", 20);
  if (!/^\d{4}-\d{2}$/.test(academicYear)) throw new ClassworkError("Academic year must use YYYY-YY.");
  const kind = String(row.kind ?? "CLASSWORK").toUpperCase() as ClassworkDraftInput["kind"];
  if (!ITEM_KINDS.includes(kind)) throw new ClassworkError("Choose Classwork, Homework, or Assignment.");
  const dueAt = optionalDate(row.dueAt, "Due date and time");
  return {
    kind,
    academicYear,
    className: text(row.className, "Class", 30),
    section: text(row.section, "Section", 20).toUpperCase(),
    subjectName: text(row.subjectName, "Subject", 120),
    timetableSubjectId: identifier(row.timetableSubjectId, "Timetable subject"),
    title: text(row.title, "Title", 180),
    instructions: text(row.instructions, "Instructions", 20_000),
    dueAt
  };
}

export function validateExpectedVersion(value: unknown) {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) throw new ClassworkError("Reload this classwork record before continuing.", 409, "STALE_VERSION");
  return version;
}

export function validateRequestKey(value: unknown) {
  const key = String(value ?? "").trim();
  if (!REQUEST_KEY.test(key)) throw new ClassworkError("A valid idempotency request key is required.");
  return key;
}

export async function createClassworkDraft(client: PrismaClient, input: ClassworkDraftInput, actor: AuthUser, now = new Date()) {
  if (actor.role === "TEACHER") requireClassworkTeacherTarget(await resolveClassworkTeacherScope(client, actor, input.academicYear), input);
  else if (!isClassworkLeadershipRole(actor.role)) throw new ClassworkAccessError("Only scoped Teachers or authorised leadership may create classwork.", 403);
  return client.$transaction(async (tx) => {
    const itemNumber = `CW-${dateKey(now).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const item = await tx.classworkItem.create({ data: {
      itemNumber,
      kind: input.kind,
      academicYear: input.academicYear,
      className: input.className,
      section: input.section,
      subjectName: input.subjectName,
      timetableSubjectId: input.timetableSubjectId,
      createdByUserId: actor.id
    } });
    const version = await tx.classworkItemVersion.create({ data: {
      itemId: item.id,
      versionNumber: 1,
      title: input.title,
      instructions: input.instructions,
      dueAt: input.dueAt,
      createdByUserId: actor.id
    } });
    await audit(tx, { itemId: item.id, eventType: "ITEM_CREATED", actor, snapshot: { kind: item.kind, status: item.status, versionNumber: 1, scope: safeScope(item) }, now });
    return { item, version };
  });
}

export async function updateClassworkDraft(client: PrismaClient, publicKey: string, input: ClassworkDraftInput, expectedVersion: number, actor: AuthUser, now = new Date()) {
  const item = await requireItem(client, publicKey);
  await requireActorItemScope(client, actor, item);
  if (!sameScope(item, input)) throw new ClassworkError("A classwork audience cannot be moved; create a new governed item for another scope.", 409);
  return client.$transaction(async (tx) => {
    const current = await tx.classworkItemVersion.findUnique({ where: { itemId_versionNumber: { itemId: item.id, versionNumber: item.currentVersionNumber } } });
    if (!current || current.versionStatus !== "DRAFT") throw new ClassworkError("Published instructions are immutable; create a corrected version.", 409);
    const changed = await tx.classworkItem.updateMany({ where: { id: item.id, rowVersion: expectedVersion, status: { in: ["DRAFT", "PUBLISHED"] } }, data: { rowVersion: { increment: 1 } } });
    if (changed.count !== 1) throw stale();
    const version = await tx.classworkItemVersion.update({ where: { id: current.id }, data: { title: input.title, instructions: input.instructions, dueAt: input.dueAt } });
    await audit(tx, { itemId: item.id, eventType: "DRAFT_UPDATED", actor, snapshot: { versionNumber: current.versionNumber }, now });
    return { item: await tx.classworkItem.findUniqueOrThrow({ where: { id: item.id } }), version };
  });
}

export async function createClassworkCorrection(client: PrismaClient, publicKey: string, value: unknown, expectedVersion: number, actor: AuthUser, now = new Date()) {
  const item = await requireItem(client, publicKey);
  await requireActorItemScope(client, actor, item);
  if (item.status !== "PUBLISHED") throw new ClassworkError("Only open published classwork can receive a corrected instruction version.", 409);
  const row = value as Record<string, unknown>;
  const reason = text(row.correctionReason, "Correction reason", 1_000);
  const title = text(row.title, "Title", 180);
  const instructions = text(row.instructions, "Instructions", 20_000);
  const dueAt = optionalDate(row.dueAt, "Due date and time");
  return client.$transaction(async (tx) => {
    const existingDraft = await tx.classworkItemVersion.findFirst({ where: { itemId: item.id, versionStatus: "DRAFT" } });
    if (existingDraft) throw new ClassworkError("A corrected draft already exists for this classwork item.", 409);
    const changed = await tx.classworkItem.updateMany({ where: { id: item.id, rowVersion: expectedVersion, status: "PUBLISHED" }, data: { currentVersionNumber: { increment: 1 }, rowVersion: { increment: 1 } } });
    if (changed.count !== 1) throw stale();
    const version = await tx.classworkItemVersion.create({ data: { itemId: item.id, versionNumber: item.currentVersionNumber + 1, title, instructions, dueAt, correctionReason: reason, createdByUserId: actor.id } });
    await audit(tx, { itemId: item.id, eventType: "CORRECTION_DRAFT_CREATED", actor, snapshot: { versionNumber: version.versionNumber, reasonRecorded: true }, now });
    return { item: await tx.classworkItem.findUniqueOrThrow({ where: { id: item.id } }), version };
  });
}

export async function publishClassworkVersion(client: PrismaClient, publicKey: string, value: unknown, actor: AuthUser, now = new Date()) {
  const item = await requireItem(client, publicKey);
  await requireActorItemScope(client, actor, item);
  const row = value as Record<string, unknown>;
  const expectedVersion = validateExpectedVersion(row.expectedVersion);
  const requestKey = validateRequestKey(row.requestKey);
  const idempotent = await client.classworkItemVersion.findUnique({ where: { publishRequestKey: requestKey }, include: { item: true } });
  if (idempotent) {
    if (idempotent.itemId !== item.id) throw new ClassworkError("The request key belongs to another classwork item.", 409);
    return { item: idempotent.item, version: idempotent, idempotent: true };
  }
  return client.$transaction(async (tx) => {
    const version = await tx.classworkItemVersion.findUnique({ where: { itemId_versionNumber: { itemId: item.id, versionNumber: item.currentVersionNumber } }, include: { attachments: true } });
    if (!version || version.versionStatus !== "DRAFT") throw new ClassworkError("The current instruction version is not a publishable draft.", 409);
    if (version.attachments.some((attachment) => attachment.recoveryStatus !== "VERIFIED" || !attachment.backupVerifiedAt)) {
      throw new ClassworkError("Attachment release is blocked until encrypted backup and two isolated restores are verified.", 409, "ATTACHMENT_RECOVERY_REQUIRED");
    }
    const changed = await tx.classworkItem.updateMany({ where: { id: item.id, rowVersion: expectedVersion, status: { in: ["DRAFT", "PUBLISHED"] } }, data: { status: "PUBLISHED", publishedAt: now, rowVersion: { increment: 1 } } });
    if (changed.count !== 1) throw stale();
    await tx.classworkItemVersion.updateMany({ where: { itemId: item.id, versionStatus: "PUBLISHED" }, data: { versionStatus: "REPLACED", replacedAt: now } });
    const published = await tx.classworkItemVersion.update({ where: { id: version.id }, data: { versionStatus: "PUBLISHED", publishRequestKey: requestKey, publishedByUserId: actor.id, publishedAt: now } });
    await audit(tx, { itemId: item.id, eventType: item.publishedAt ? "INSTRUCTIONS_REPLACED" : "ITEM_PUBLISHED", actor, snapshot: { versionNumber: published.versionNumber, attachmentCount: version.attachments.length, recoveryVerified: true }, now });
    const recipients = await resolvePublishedClassworkRecipients(tx, item);
    await publishClassworkNotification(tx, { eventKey: `${item.id}|${published.id}|${requestKey}`, eventType: "PUBLISHED", itemPublicKey: item.publicKey, itemKind: item.kind, actorUserId: actor.id, recipients, now });
    return { item: await tx.classworkItem.findUniqueOrThrow({ where: { id: item.id } }), version: published, idempotent: false };
  });
}

export async function transitionClassworkItem(client: PrismaClient, publicKey: string, actionValue: unknown, expectedVersion: number, actor: AuthUser, now = new Date()) {
  const item = await requireItem(client, publicKey);
  await requireActorItemScope(client, actor, item);
  const action = String(actionValue ?? "").toUpperCase();
  if (action !== "CLOSE" && action !== "ARCHIVE") throw new ClassworkError("Unsupported classwork lifecycle action.");
  const nextStatus = action === "CLOSE" ? "CLOSED" : "ARCHIVED";
  if (action === "CLOSE" && item.status !== "PUBLISHED") throw new ClassworkError("Only published classwork can be closed.", 409);
  if (action === "ARCHIVE" && !["PUBLISHED", "CLOSED"].includes(item.status)) throw new ClassworkError("Only published or closed classwork can be archived.", 409);
  return client.$transaction(async (tx) => {
    const changed = await tx.classworkItem.updateMany({ where: { id: item.id, rowVersion: expectedVersion, status: item.status }, data: action === "CLOSE" ? { status: nextStatus, closedAt: now, closedByUserId: actor.id, rowVersion: { increment: 1 } } : { status: nextStatus, archivedAt: now, archivedByUserId: actor.id, rowVersion: { increment: 1 } } });
    if (changed.count !== 1) throw stale();
    await audit(tx, { itemId: item.id, eventType: action === "CLOSE" ? "ITEM_CLOSED" : "ITEM_ARCHIVED", actor, snapshot: { previousStatus: item.status, newStatus: nextStatus }, now });
    return tx.classworkItem.findUniqueOrThrow({ where: { id: item.id } });
  });
}

export async function saveSubmissionDraft(client: PrismaClient, itemPublicKey: string, value: unknown, context: ClassworkLearnerContext, now = new Date()) {
  const item = await requireItem(client, itemPublicKey);
  requireLearnerAudience(context, item);
  if (item.status !== "PUBLISHED") throw new ClassworkError("This classwork item is not open for submissions.", 409);
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const textBody = optionalText(row.textBody, "Submission text", 20_000);
  const expectedVersion = row.expectedVersion == null ? null : validateExpectedVersion(row.expectedVersion);
  return client.$transaction(async (tx) => {
    let submission = await tx.classworkSubmission.findUnique({ where: { itemId_studentId: { itemId: item.id, studentId: context.studentId } }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } } });
    const itemVersion = await tx.classworkItemVersion.findUnique({ where: { itemId_versionNumber: { itemId: item.id, versionNumber: item.currentVersionNumber } } });
    if (!itemVersion || itemVersion.versionStatus !== "PUBLISHED") throw new ClassworkError("Published instructions are unavailable.", 409);
    if (!submission) {
      const created = await tx.classworkSubmission.create({ data: { itemId: item.id, studentId: context.studentId, createdByUserId: context.actorUserId, createdByRole: context.actorRole } });
      const version = await tx.classworkSubmissionVersion.create({ data: { submissionId: created.id, itemVersionId: itemVersion.id, versionNumber: 1, textBody, createdByUserId: context.actorUserId, createdByRole: context.actorRole, parentGuardianId: context.guardianId } });
      await audit(tx, { itemId: item.id, submissionId: created.id, eventType: "SUBMISSION_DRAFT_CREATED", actor: actorFrom(context), snapshot: { versionNumber: 1, actorRole: context.actorRole }, now });
      return { submission: created, version };
    }
    if (expectedVersion == null || submission.rowVersion !== expectedVersion) throw stale();
    if (!["DRAFT", "RETURNED"].includes(submission.status)) throw new ClassworkError("Submitted work is immutable unless it is returned for revision.", 409);
    let version = submission.versions[0];
    if (submission.status === "RETURNED") {
      const changed = await tx.classworkSubmission.updateMany({ where: { id: submission.id, rowVersion: expectedVersion, status: "RETURNED" }, data: { status: "DRAFT", currentVersionNumber: { increment: 1 }, rowVersion: { increment: 1 } } });
      if (changed.count !== 1) throw stale();
      version = await tx.classworkSubmissionVersion.create({ data: { submissionId: submission.id, itemVersionId: itemVersion.id, versionNumber: submission.currentVersionNumber + 1, textBody, createdByUserId: context.actorUserId, createdByRole: context.actorRole, parentGuardianId: context.guardianId } });
      await audit(tx, { itemId: item.id, submissionId: submission.id, eventType: "RESUBMISSION_DRAFT_CREATED", actor: actorFrom(context), snapshot: { versionNumber: version.versionNumber }, now });
    } else {
      if (!version || version.versionStatus !== "DRAFT") throw new ClassworkError("The current submission version is immutable.", 409);
      const changed = await tx.classworkSubmission.updateMany({ where: { id: submission.id, rowVersion: expectedVersion, status: "DRAFT" }, data: { rowVersion: { increment: 1 } } });
      if (changed.count !== 1) throw stale();
      version = await tx.classworkSubmissionVersion.update({ where: { id: version.id }, data: { textBody, createdByUserId: context.actorUserId, createdByRole: context.actorRole, parentGuardianId: context.guardianId } });
      await audit(tx, { itemId: item.id, submissionId: submission.id, eventType: "SUBMISSION_DRAFT_UPDATED", actor: actorFrom(context), snapshot: { versionNumber: version.versionNumber }, now });
    }
    return { submission: await tx.classworkSubmission.findUniqueOrThrow({ where: { id: submission.id } }), version };
  });
}

export async function submitClasswork(client: PrismaClient, itemPublicKey: string, value: unknown, context: ClassworkLearnerContext, now = new Date()) {
  const item = await requireItem(client, itemPublicKey);
  requireLearnerAudience(context, item);
  if (item.status !== "PUBLISHED") throw new ClassworkError("This classwork item is closed for submissions.", 409);
  const row = value as Record<string, unknown>;
  const expectedVersion = validateExpectedVersion(row.expectedVersion);
  const requestKey = validateRequestKey(row.requestKey);
  const existing = await client.classworkSubmissionVersion.findUnique({ where: { submissionRequestKey: requestKey }, include: { submission: true } });
  if (existing) {
    if (existing.submission.itemId !== item.id || existing.submission.studentId !== context.studentId) throw new ClassworkError("The request key belongs to another submission.", 409);
    return { submission: existing.submission, version: existing, idempotent: true };
  }
  return client.$transaction(async (tx) => {
    const submission = await tx.classworkSubmission.findUnique({ where: { itemId_studentId: { itemId: item.id, studentId: context.studentId } }, include: { versions: { where: { versionNumber: { gt: 0 } }, orderBy: { versionNumber: "desc" }, take: 1, include: { attachments: true } } } });
    const version = submission?.versions[0];
    if (!submission || !version || submission.status !== "DRAFT" || version.versionStatus !== "DRAFT") throw new ClassworkError("Save a private draft before submitting.", 409);
    if (!version.textBody?.trim() && !version.attachments.length) throw new ClassworkError("Add submission text or a private attachment before submitting.");
    if (version.attachments.some((attachment) => attachment.recoveryStatus !== "VERIFIED" || !attachment.backupVerifiedAt)) throw new ClassworkError("Submission release is blocked until encrypted attachment backup and two restores are verified.", 409, "ATTACHMENT_RECOVERY_REQUIRED");
    const isResubmission = version.versionNumber > 1;
    const publishedVersion = await tx.classworkItemVersion.findUnique({ where: { id: version.itemVersionId } });
    const late = !isResubmission && Boolean(publishedVersion?.dueAt && publishedVersion.dueAt < now);
    const status = isResubmission ? "RESUBMITTED" : late ? "LATE" : "SUBMITTED";
    const changed = await tx.classworkSubmission.updateMany({ where: { id: submission.id, rowVersion: expectedVersion, status: "DRAFT" }, data: { status, rowVersion: { increment: 1 }, lastSubmittedByUserId: context.actorUserId, lastSubmittedByRole: context.actorRole, firstSubmittedAt: submission.firstSubmittedAt ?? now, lastSubmittedAt: now, returnedAt: null } });
    if (changed.count !== 1) throw stale();
    const locked = await tx.classworkSubmissionVersion.update({ where: { id: version.id }, data: { versionStatus: status, submissionRequestKey: requestKey, submittedAt: now, lockedAt: now } });
    await audit(tx, { itemId: item.id, submissionId: submission.id, eventType: status, actor: actorFrom(context), snapshot: { versionNumber: version.versionNumber, late, attachmentCount: version.attachments.length, actorRole: context.actorRole }, now });
    const recipients = await resolveSubmissionTeacherRecipients(tx, item);
    await publishClassworkNotification(tx, { eventKey: `${submission.id}|${locked.id}|${requestKey}`, eventType: "SUBMITTED", itemPublicKey: item.publicKey, itemKind: item.kind, actorUserId: context.actorUserId, recipients, now });
    return { submission: await tx.classworkSubmission.findUniqueOrThrow({ where: { id: submission.id } }), version: locked, idempotent: false };
  });
}

export async function reviewClassworkSubmission(client: PrismaClient, submissionPublicKey: string, value: unknown, actor: AuthUser, now = new Date()) {
  const row = value as Record<string, unknown>;
  const action = String(row.action ?? "").toUpperCase();
  if (!["COMMENT", "RETURN", "REVIEW"].includes(action)) throw new ClassworkError("Unsupported submission review action.");
  const body = text(row.body, action === "RETURN" ? "Return reason" : "Feedback", 4_000);
  const expectedVersion = validateExpectedVersion(row.expectedVersion);
  const submission = await client.classworkSubmission.findUnique({ where: { publicKey: identifier(submissionPublicKey, "Submission reference") }, include: { item: true, versions: { orderBy: { versionNumber: "desc" }, take: 1 } } });
  if (!submission) throw new ClassworkAccessError();
  await requireActorItemScope(client, actor, submission.item);
  if (!["SUBMITTED", "LATE", "RESUBMITTED"].includes(submission.status)) throw new ClassworkError("Only a current final submission can be reviewed or returned.", 409);
  return client.$transaction(async (tx) => {
    const changed = await tx.classworkSubmission.updateMany({ where: { id: submission.id, rowVersion: expectedVersion, status: submission.status }, data: action === "RETURN" ? { status: "RETURNED", returnedAt: now, rowVersion: { increment: 1 } } : action === "REVIEW" ? { status: "REVIEWED", reviewedAt: now, rowVersion: { increment: 1 } } : { rowVersion: { increment: 1 } } });
    if (changed.count !== 1) throw stale();
    const latest = await tx.classworkFeedback.findFirst({ where: { submissionId: submission.id }, orderBy: { sequenceNumber: "desc" } });
    const feedback = await tx.classworkFeedback.create({ data: { submissionId: submission.id, submissionVersionId: submission.versions[0]?.id ?? null, sequenceNumber: (latest?.sequenceNumber ?? 0) + 1, feedbackType: action === "RETURN" ? "RETURN_REASON" : action === "REVIEW" ? "REVIEW" : "COMMENT", body, createdByUserId: actor.id, createdByRole: actor.role } });
    await audit(tx, { itemId: submission.itemId, submissionId: submission.id, eventType: action === "RETURN" ? "RETURNED" : action === "REVIEW" ? "REVIEWED" : "FEEDBACK_APPENDED", actor, snapshot: { sequenceNumber: feedback.sequenceNumber, submissionVersionNumber: submission.currentVersionNumber }, now });
    if (action === "RETURN" || action === "REVIEW") {
      const recipient = submission.lastSubmittedByUserId ? await tx.user.findFirst({ where: { id: submission.lastSubmittedByUserId, isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, role: true } }) : null;
      await publishClassworkNotification(tx, { eventKey: `${submission.id}|${feedback.id}|${action}`, eventType: action === "RETURN" ? "RETURNED" : "REVIEWED", itemPublicKey: submission.item.publicKey, itemKind: submission.item.kind, actorUserId: actor.id, recipients: recipient ? [recipient] : [], now });
    }
    return { submission: await tx.classworkSubmission.findUniqueOrThrow({ where: { id: submission.id } }), feedback };
  });
}

export async function loadClassworkWorkspace(client: PrismaClient, actor: AuthUser, academicYear?: string) {
  if (actor.role === "VIEWER") return { mode: "AGGREGATE_ONLY" as const, items: [], targets: [], aggregates: await loadClassworkAggregates(client, actor, academicYear) };
  const teacherScope = actor.role === "TEACHER" ? await resolveClassworkTeacherScope(client, actor, academicYear) : undefined;
  if (!teacherScope && !isClassworkLeadershipRole(actor.role)) throw new ClassworkAccessError("Classwork management is unavailable in this role context.", 403);
  const items = await client.classworkItem.findMany({
    where: { AND: [classworkItemScopeWhere(actor, teacherScope), academicYear ? { academicYear } : {}] },
    include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { attachments: true } }, submissions: { select: { status: true } } },
    orderBy: [{ createdAt: "desc" }],
    take: 200
  });
  return {
    mode: "MANAGE" as const,
    targets: teacherScope?.targets ?? [],
    items: items.map(serializeManagedItem),
    aggregates: await loadClassworkAggregates(client, actor, academicYear)
  };
}

export async function loadLearnerClasswork(client: PrismaClient, context: ClassworkLearnerContext, includeHistory = false) {
  const items = await client.classworkItem.findMany({
    where: { academicYear: context.academicYear, className: context.className, section: context.section, status: { in: includeHistory ? ["PUBLISHED", "CLOSED", "ARCHIVED"] : ["PUBLISHED", "CLOSED"] }, publishedAt: { not: null } },
    include: {
      versions: { where: { versionStatus: { in: ["PUBLISHED", "REPLACED"] } }, orderBy: { versionNumber: "desc" }, include: { attachments: { select: { publicKey: true, safeDisplayName: true, mediaType: true, byteSize: true, recoveryStatus: true } } } },
      submissions: { where: { studentId: context.studentId }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { attachments: { select: { publicKey: true, safeDisplayName: true, mediaType: true, byteSize: true, recoveryStatus: true } } } }, feedback: { orderBy: { sequenceNumber: "asc" }, select: { sequenceNumber: true, feedbackType: true, body: true, createdAt: true, createdByRole: true } } } }
    },
    orderBy: [{ publishedAt: "desc" }],
    take: 200
  });
  return {
    context: { studentLabel: context.studentLabel, academicYear: context.academicYear, className: context.className, section: context.section, childHandle: context.childHandle, contextVersion: context.contextVersion },
    items: items.map((item) => {
      const current = item.versions.find((version) => version.versionNumber === item.currentVersionNumber && version.versionStatus === "PUBLISHED") ?? item.versions[0];
      const submission = item.submissions[0];
      return {
        publicKey: item.publicKey,
        kind: item.kind,
        subjectName: item.subjectName,
        status: item.status,
        versionNumber: current?.versionNumber ?? null,
        title: current?.title ?? "Unavailable",
        instructions: current?.instructions ?? "Unavailable",
        dueAt: current?.dueAt?.toISOString() ?? null,
        dueState: dueState(current?.dueAt, item.status),
        attachments: (current?.attachments ?? []).filter((row) => row.recoveryStatus === "VERIFIED"),
        submission: submission ? {
          publicKey: submission.publicKey,
          status: submission.status,
          rowVersion: submission.rowVersion,
          versionNumber: submission.currentVersionNumber,
          textBody: submission.versions[0]?.versionStatus === "DRAFT" ? submission.versions[0]?.textBody ?? "" : submission.versions[0]?.textBody ?? "",
          attachments: submission.versions[0]?.attachments ?? [],
          feedback: submission.feedback
        } : null
      };
    })
  };
}

export async function loadSubmissionQueue(client: PrismaClient, itemPublicKey: string, actor: AuthUser) {
  const item = await requireItem(client, itemPublicKey);
  await requireActorItemScope(client, actor, item);
  const submissions = await client.classworkSubmission.findMany({
    where: { itemId: item.id },
    include: { student: { select: { studentName: true, rollNo: true } }, versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { attachments: { select: { publicKey: true, safeDisplayName: true, mediaType: true, byteSize: true, recoveryStatus: true } } } }, feedback: { orderBy: { sequenceNumber: "asc" } } },
    orderBy: [{ lastSubmittedAt: "asc" }, { createdAt: "asc" }],
    take: 500
  });
  return { item: serializeManagedItem({ ...item, versions: [], submissions: [] }), submissions: submissions.map((row) => ({ publicKey: row.publicKey, studentLabel: row.student.studentName, rollNo: row.student.rollNo, status: row.status, rowVersion: row.rowVersion, versionNumber: row.currentVersionNumber, submittedAt: row.lastSubmittedAt?.toISOString() ?? null, textBody: row.versions[0]?.textBody ?? "", attachments: row.versions[0]?.attachments ?? [], feedback: row.feedback.map((feedback) => ({ sequenceNumber: feedback.sequenceNumber, type: feedback.feedbackType, body: feedback.body, createdAt: feedback.createdAt.toISOString(), actorRole: feedback.createdByRole })) })) };
}

export async function loadClassworkAggregates(client: PrismaClient, actor: AuthUser, academicYear?: string) {
  if (!(isClassworkLeadershipRole(actor.role) || actor.role === "TEACHER" || actor.role === "VIEWER")) throw new ClassworkAccessError("Aggregate classwork access is unavailable.", 403);
  const teacherScope = actor.role === "TEACHER" ? await resolveClassworkTeacherScope(client, actor, academicYear) : undefined;
  const aggregateScope = actor.role === "VIEWER" ? {} : classworkItemScopeWhere(actor, teacherScope);
  const items = await client.classworkItem.findMany({ where: { AND: [aggregateScope, academicYear ? { academicYear } : {}, { status: { in: ["PUBLISHED", "CLOSED", "ARCHIVED"] } }] }, include: { submissions: { select: { status: true } } }, orderBy: { createdAt: "desc" }, take: 200 });
  const result = [];
  for (const item of items) {
    const eligible = await client.academicYearEnrollment.count({ where: { academicYear: item.academicYear, className: item.className, section: item.section, status: "ACTIVE", student: { deletedAt: null } } });
    const suppressed = eligible < 3;
    const completed = item.submissions.filter((row) => ["SUBMITTED", "LATE", "RESUBMITTED", "REVIEWED"].includes(row.status)).length;
    const returned = item.submissions.filter((row) => row.status === "RETURNED").length;
    const reviewed = item.submissions.filter((row) => row.status === "REVIEWED").length;
    result.push({ publicKey: actor.role === "VIEWER" ? null : item.publicKey, kind: item.kind, academicYear: item.academicYear, className: item.className, section: item.section, subjectName: item.subjectName, status: item.status, suppressed, eligible: suppressed ? null : eligible, completed: suppressed ? null : completed, submitted: suppressed ? null : completed, pending: suppressed ? null : Math.max(eligible - completed, 0), returned: suppressed ? null : returned, reviewed: suppressed ? null : reviewed, completionPercent: suppressed ? null : eligible ? Math.round(completed * 10_000 / eligible) / 100 : 0 });
  }
  return result;
}

export function classworkAggregateCsv(rows: Awaited<ReturnType<typeof loadClassworkAggregates>>) {
  const header = ["Kind","Academic Year","Class","Section","Subject","Status","Eligible","Completed","Pending","Returned","Suppressed"];
  const body = rows.map((row) => [row.kind,row.academicYear,row.className,row.section,row.subjectName,row.status,row.eligible ?? "",row.completed ?? "",row.pending ?? "",row.returned ?? "",row.suppressed ? "YES" : "NO"]);
  return [header, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function classworkPrivateHeaders() { return { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" }; }

async function requireItem(client: PrismaClient | Prisma.TransactionClient, publicKey: string) {
  const key = identifier(publicKey, "Classwork reference");
  const item = await client.classworkItem.findUnique({ where: { publicKey: key } });
  if (!item || !(ITEM_STATUSES as readonly string[]).includes(item.status)) throw new ClassworkAccessError();
  return item;
}

async function requireActorItemScope(client: PrismaClient | Prisma.TransactionClient, actor: AuthUser, item: ClassworkTarget) {
  if (isClassworkLeadershipRole(actor.role)) return;
  if (actor.role !== "TEACHER") throw new ClassworkAccessError("This role cannot manage classwork.", 403);
  requireClassworkTeacherTarget(await resolveClassworkTeacherScope(client, actor, item.academicYear), item);
}

function serializeManagedItem(item: any) {
  const current = item.versions?.[0];
  const counts = (item.submissions ?? []).reduce((result: Record<string, number>, row: any) => { result[row.status] = (result[row.status] ?? 0) + 1; return result; }, {});
  return { publicKey: item.publicKey, itemNumber: item.itemNumber, kind: item.kind, academicYear: item.academicYear, className: item.className, section: item.section, subjectName: item.subjectName, timetableSubjectId: item.timetableSubjectId, status: item.status, rowVersion: item.rowVersion, currentVersionNumber: item.currentVersionNumber, versionPublicKey: current?.publicKey ?? null, title: current?.title ?? null, instructions: current?.instructions ?? null, dueAt: current?.dueAt?.toISOString?.() ?? current?.dueAt ?? null, versionStatus: current?.versionStatus ?? null, attachments: current?.attachments ?? [], submissionCounts: counts, publishedAt: item.publishedAt?.toISOString?.() ?? item.publishedAt ?? null };
}

function safeScope(item: ClassworkTarget) { return { academicYear: item.academicYear, className: item.className, section: item.section, subjectName: item.subjectName }; }
function sameScope(a: ClassworkTarget, b: ClassworkTarget) { return a.academicYear === b.academicYear && a.className === b.className && a.section === b.section && a.timetableSubjectId === b.timetableSubjectId && a.subjectName.toLowerCase() === b.subjectName.toLowerCase(); }
function dueState(dueAt: Date | null | undefined, status: string) { if (status !== "PUBLISHED") return status; if (!dueAt) return "NO_DUE_DATE"; return dueAt < new Date() ? "LATE" : "OPEN"; }
function dateKey(value: Date) { return value.toISOString().slice(0, 10); }
function actorFrom(context: ClassworkLearnerContext) { return { id: context.actorUserId, role: context.actorRole } as AuthUser; }
function stale() { return new ClassworkError("This record changed in another session. Reload before continuing.", 409, "STALE_VERSION"); }
function identifier(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9_-]{8,80}$/.test(result)) throw new ClassworkError(`${label} is invalid.`); return result; }
function text(value: unknown, label: string, max: number) { const result = String(value ?? "").trim(); if (!result) throw new ClassworkError(`${label} is required.`); return plain(result, label, max); }
function optionalText(value: unknown, label: string, max: number) { const result = String(value ?? "").trim(); return result ? plain(result, label, max) : null; }
function plain(result: string, label: string, max: number) { if (result.length > max) throw new ClassworkError(`${label} must be ${max} characters or fewer.`); if (/[<>]/.test(result) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(result)) throw new ClassworkError(`${label} must be plain text without HTML or control characters.`); return result; }
function optionalDate(value: unknown, label: string) { if (value == null || value === "") return null; const result = new Date(String(value)); if (!Number.isFinite(result.getTime())) throw new ClassworkError(`${label} is invalid.`); return result; }
function csvCell(value: unknown) { const raw = String(value ?? ""); const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"','""')}"`; }

async function audit(tx: Prisma.TransactionClient, input: { itemId?: string; submissionId?: string; eventType: string; actor: Pick<AuthUser, "id" | "role">; snapshot: Record<string, unknown>; now: Date }) {
  await tx.classworkAuditEvent.create({ data: { itemId: input.itemId ?? null, submissionId: input.submissionId ?? null, eventType: input.eventType, actorUserId: input.actor.id, actorRole: input.actor.role, snapshotJson: JSON.stringify(input.snapshot), occurredAt: input.now } });
}
