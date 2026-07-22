import { Prisma, type PrismaClient } from "@prisma/client";
import { calculateTeacherAnalyticsSnapshot, normalizeTeacherAnalyticsCycleInput } from "@/lib/teacher-analytics";

export class TeacherAnalyticsError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const CYCLE_STATUSES = ["DRAFT", "OPEN", "SNAPSHOTS_GENERATED", "UNDER_REVIEW", "FINALISED", "ARCHIVED", "CANCELLED"] as const;
const REVIEW_STATUSES = ["NOT_STARTED", "DRAFT", "SHARED_WITH_TEACHER", "TEACHER_RESPONSE_RECEIVED", "FINALISED"] as const;
const note = (value: unknown, label: string, required = false) => {
  const text = String(value ?? "").trim();
  if (required && text.length < 3) throw new TeacherAnalyticsError(`${label} is required.`);
  if (text.length > 4000) throw new TeacherAnalyticsError(`${label} must be 4,000 characters or fewer.`);
  return text || null;
};
const expectedDate = (value: unknown) => {
  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) throw new TeacherAnalyticsError("This page is stale. Refresh and try again.", 409);
  return parsed;
};
const assertStatus = (status: string, allowed: readonly string[], label = "record") => {
  if (!allowed.includes(status)) throw new TeacherAnalyticsError(`This ${label} cannot be changed from ${status}.`, 409);
};

export async function createTeacherAnalyticsCycle(prisma: PrismaClient, input: unknown, actorUserId: string) {
  const data = normalizeTeacherAnalyticsCycleInput(input);
  try {
    return await prisma.$transaction(async (tx) => {
      const cycle = await tx.teacherAnalyticsReviewCycle.create({ data: { ...data, createdByUserId: actorUserId } });
      await tx.teacherAnalyticsEvent.create({ data: { reviewCycleId: cycle.id, eventType: "CYCLE_CREATED", eventDate: new Date(), recordedByUserId: actorUserId } });
      return cycle;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new TeacherAnalyticsError("Cycle code already exists.", 409);
    throw error;
  }
}

export async function transitionTeacherAnalyticsCycle(
  prisma: PrismaClient,
  id: string,
  action: "open" | "finalise" | "archive" | "cancel",
  expectedUpdatedAt: unknown,
  actorUserId: string,
  reason?: unknown
) {
  const current = await prisma.teacherAnalyticsReviewCycle.findUnique({ where: { id }, include: { snapshots: { include: { review: true } } } });
  if (!current) throw new TeacherAnalyticsError("Analytics review cycle was not found.", 404);
  const expected = expectedDate(expectedUpdatedAt);
  const now = new Date();
  let status: string;
  let eventType: string;
  let data: Record<string, unknown>;
  if (action === "open") {
    assertStatus(current.status, ["DRAFT"], "cycle");
    status = "OPEN"; eventType = "CYCLE_OPENED"; data = { status, openedAt: now, openedByUserId: actorUserId };
  } else if (action === "finalise") {
    assertStatus(current.status, ["SNAPSHOTS_GENERATED", "UNDER_REVIEW"], "cycle");
    if (!current.snapshots.length || current.snapshots.some((snapshot) => snapshot.review?.status !== "FINALISED")) throw new TeacherAnalyticsError("Every included Teacher review must be finalised before the cycle can be finalised.", 409);
    status = "FINALISED"; eventType = "CYCLE_FINALISED"; data = { status, finalisedAt: now, finalisedByUserId: actorUserId };
  } else if (action === "archive") {
    assertStatus(current.status, ["FINALISED"], "cycle");
    status = "ARCHIVED"; eventType = "CYCLE_ARCHIVED"; data = { status, archivedAt: now, archivedByUserId: actorUserId };
  } else {
    assertStatus(current.status, ["DRAFT", "OPEN"], "cycle");
    const cancellationReason = note(reason, "Cancellation reason", true);
    status = "CANCELLED"; eventType = "CYCLE_CANCELLED"; data = { status, cancellationReason, cancelledAt: now, cancelledByUserId: actorUserId };
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.teacherAnalyticsReviewCycle.updateMany({ where: { id, updatedAt: expected }, data });
    if (updated.count !== 1) throw new TeacherAnalyticsError("The cycle changed in another session. Refresh and review the latest state.", 409);
    await tx.teacherAnalyticsEvent.create({ data: { reviewCycleId: id, eventType, eventDate: now, reason: action === "cancel" ? String(reason) : null, recordedByUserId: actorUserId } });
    return tx.teacherAnalyticsReviewCycle.findUniqueOrThrow({ where: { id } });
  });
}

export async function generateTeacherAnalyticsSnapshots(prisma: PrismaClient, cycleId: string, expectedUpdatedAt: unknown, actorUserId: string) {
  const cycle = await prisma.teacherAnalyticsReviewCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new TeacherAnalyticsError("Analytics review cycle was not found.", 404);
  assertStatus(cycle.status, ["OPEN"], "cycle");
  const teachers = await prisma.staffMember.findMany({ where: { status: "ACTIVE", staffType: "TEACHING" }, select: { id: true }, orderBy: { fullName: "asc" } });
  if (!teachers.length) throw new TeacherAnalyticsError("No active teaching StaffMembers are eligible.");
  const calculated: Array<{ staffMemberId: string; data: Awaited<ReturnType<typeof calculateTeacherAnalyticsSnapshot>> }> = [];
  for (const teacher of teachers) calculated.push({ staffMemberId: teacher.id, data: await calculateTeacherAnalyticsSnapshot(prisma, cycle, teacher.id) });
  const expected = expectedDate(expectedUpdatedAt);
  return prisma.$transaction(async (tx) => {
    const locked = await tx.teacherAnalyticsReviewCycle.updateMany({ where: { id: cycleId, status: "OPEN", updatedAt: expected }, data: { status: "SNAPSHOTS_GENERATED" } });
    if (locked.count !== 1) throw new TeacherAnalyticsError("The cycle changed in another session. Refresh before generating snapshots.", 409);
    for (const item of calculated) {
      const snapshot = await tx.teacherAnalyticsSnapshot.create({ data: { reviewCycleId: cycleId, staffMemberId: item.staffMemberId, ...item.data, createdByUserId: actorUserId } });
      await tx.teacherAnalyticsEvent.create({ data: { reviewCycleId: cycleId, snapshotId: snapshot.id, eventType: "SNAPSHOT_GENERATED", eventDate: new Date(), recordedByUserId: actorUserId } });
    }
    return { generated: calculated.length };
  });
}

export async function regenerateTeacherAnalyticsSnapshot(prisma: PrismaClient, snapshotId: string, actorUserId: string, reason: unknown) {
  const current = await prisma.teacherAnalyticsSnapshot.findUnique({ where: { id: snapshotId }, include: { reviewCycle: true, review: true } });
  if (!current) throw new TeacherAnalyticsError("Teacher analytics snapshot was not found.", 404);
  assertStatus(current.reviewCycle.status, ["SNAPSHOTS_GENERATED", "UNDER_REVIEW"], "cycle");
  if (current.review && ["SHARED_WITH_TEACHER", "TEACHER_RESPONSE_RECEIVED", "FINALISED"].includes(current.review.status)) throw new TeacherAnalyticsError("A shared or finalised review cannot be recalculated.", 409);
  const regenerationReason = note(reason, "Regeneration reason", true)!;
  const replacement = await calculateTeacherAnalyticsSnapshot(prisma, current.reviewCycle, current.staffMemberId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.teacherAnalyticsSnapshot.update({ where: { id: snapshotId }, data: replacement });
    await tx.teacherAnalyticsEvent.create({ data: { reviewCycleId: current.reviewCycleId, snapshotId, eventType: "SNAPSHOT_REGENERATED", eventDate: new Date(), reason: regenerationReason, notes: `Prior snapshot hash: ${current.snapshotHash}`, recordedByUserId: actorUserId } });
    return updated;
  });
}

export async function saveTeacherAnalyticsReview(prisma: PrismaClient, snapshotId: string, input: any, actorUserId: string) {
  const snapshot = await prisma.teacherAnalyticsSnapshot.findUnique({ where: { id: snapshotId }, include: { reviewCycle: true, review: true } });
  if (!snapshot) throw new TeacherAnalyticsError("Teacher analytics snapshot was not found.", 404);
  assertStatus(snapshot.reviewCycle.status, ["SNAPSHOTS_GENERATED", "UNDER_REVIEW"], "cycle");
  if (snapshot.review?.status === "FINALISED") throw new TeacherAnalyticsError("Finalised review notes are immutable.", 409);
  const data = {
    strengthsNote: note(input?.strengthsNote, "Evidence and strengths note"),
    supportNeededNote: note(input?.supportNeededNote, "Support-needed note"),
    agreedActionsNote: note(input?.agreedActionsNote, "Agreed-actions note"),
    leadershipContextNote: note(input?.leadershipContextNote, "Leadership context note"),
    nextReviewDate: input?.nextReviewDate ? new Date(`${String(input.nextReviewDate)}T00:00:00+05:30`) : null
  };
  if (Object.values(data).every((value) => value === null)) throw new TeacherAnalyticsError("Record at least one factual review note.");
  return prisma.$transaction(async (tx) => {
    const review = snapshot.review
      ? await tx.teacherAnalyticsReview.update({ where: { id: snapshot.review.id }, data: { ...data, status: snapshot.review.status === "NOT_STARTED" ? "DRAFT" : snapshot.review.status } })
      : await tx.teacherAnalyticsReview.create({ data: { snapshotId, ...data, status: "DRAFT", createdByUserId: actorUserId } });
    if (snapshot.reviewCycle.status === "SNAPSHOTS_GENERATED") await tx.teacherAnalyticsReviewCycle.update({ where: { id: snapshot.reviewCycleId }, data: { status: "UNDER_REVIEW" } });
    await tx.teacherAnalyticsEvent.create({ data: { reviewCycleId: snapshot.reviewCycleId, snapshotId, reviewId: review.id, eventType: snapshot.review ? "REVIEW_UPDATED" : "REVIEW_STARTED", eventDate: new Date(), recordedByUserId: actorUserId } });
    return review;
  });
}

export async function shareTeacherAnalyticsReview(prisma: PrismaClient, reviewId: string, expectedUpdatedAt: unknown, actorUserId: string) {
  const review = await prisma.teacherAnalyticsReview.findUnique({ where: { id: reviewId }, include: { snapshot: { include: { staffMember: true, reviewCycle: true } } } });
  if (!review) throw new TeacherAnalyticsError("Teacher analytics review was not found.", 404);
  assertStatus(review.status, ["DRAFT"], "review");
  if (!review.snapshot.staffMember.userId) throw new TeacherAnalyticsError("The Teacher needs a linked active account before sharing.", 409);
  if (![review.strengthsNote, review.supportNeededNote, review.agreedActionsNote, review.leadershipContextNote].some(Boolean)) throw new TeacherAnalyticsError("Record factual leadership notes before sharing.");
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const changed = await tx.teacherAnalyticsReview.updateMany({ where: { id: reviewId, updatedAt: expectedDate(expectedUpdatedAt), status: "DRAFT" }, data: { status: "SHARED_WITH_TEACHER", sharedAt: now, sharedByUserId: actorUserId } });
    if (changed.count !== 1) throw new TeacherAnalyticsError("The review changed in another session. Refresh and try again.", 409);
    await tx.teacherAnalyticsEvent.create({ data: { reviewCycleId: review.snapshot.reviewCycleId, snapshotId: review.snapshotId, reviewId, eventType: "SHARED_WITH_TEACHER", eventDate: now, recordedByUserId: actorUserId } });
    return tx.teacherAnalyticsReview.findUniqueOrThrow({ where: { id: reviewId } });
  });
}

export async function addTeacherAnalyticsResponse(prisma: PrismaClient, reviewId: string, staffMemberId: string, response: unknown) {
  const review = await prisma.teacherAnalyticsReview.findUnique({ where: { id: reviewId }, include: { snapshot: true } });
  if (!review || review.snapshot.staffMemberId !== staffMemberId) throw new TeacherAnalyticsError("Review was not found in your own Teacher scope.", 404);
  assertStatus(review.status, ["SHARED_WITH_TEACHER", "TEACHER_RESPONSE_RECEIVED"], "review");
  const teacherResponse = note(response, "Teacher response", true)!;
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await tx.teacherAnalyticsReview.update({ where: { id: reviewId }, data: { teacherResponse, teacherRespondedAt: now, status: "TEACHER_RESPONSE_RECEIVED" } });
    await tx.teacherAnalyticsEvent.create({ data: { reviewCycleId: review.snapshot.reviewCycleId, snapshotId: review.snapshotId, reviewId, eventType: "TEACHER_RESPONSE_ADDED", eventDate: now, notes: "Teacher response recorded; it is not a legal acknowledgment or admission.", recordedByUserId: null } });
    return updated;
  });
}

export async function finaliseTeacherAnalyticsReview(prisma: PrismaClient, reviewId: string, expectedUpdatedAt: unknown, actorUserId: string) {
  const review = await prisma.teacherAnalyticsReview.findUnique({ where: { id: reviewId }, include: { snapshot: true } });
  if (!review) throw new TeacherAnalyticsError("Teacher analytics review was not found.", 404);
  assertStatus(review.status, ["DRAFT", "SHARED_WITH_TEACHER", "TEACHER_RESPONSE_RECEIVED"], "review");
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const changed = await tx.teacherAnalyticsReview.updateMany({ where: { id: reviewId, updatedAt: expectedDate(expectedUpdatedAt), status: review.status }, data: { status: "FINALISED", finalisedAt: now, finalisedByUserId: actorUserId } });
    if (changed.count !== 1) throw new TeacherAnalyticsError("The review changed in another session. Refresh and try again.", 409);
    await tx.teacherAnalyticsEvent.create({ data: { reviewCycleId: review.snapshot.reviewCycleId, snapshotId: review.snapshotId, reviewId, eventType: "REVIEW_FINALISED", eventDate: now, recordedByUserId: actorUserId } });
    return tx.teacherAnalyticsReview.findUniqueOrThrow({ where: { id: reviewId } });
  });
}

export function teacherAnalyticsApiError(error: unknown) {
  const status = error instanceof TeacherAnalyticsError ? error.status : 400;
  return { status, message: error instanceof Error ? error.message : "Unable to process Teacher analytics." };
}

export const teacherAnalyticsCycleStatuses = CYCLE_STATUSES;
export const teacherAnalyticsReviewStatuses = REVIEW_STATUSES;
