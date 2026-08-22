import type { AuthUser } from "@/lib/auth";
import { ParentChildContextError, resolveActiveParentChildContext } from "@/lib/iam/contexts";
import { parentMeetingsEnabled } from "@/lib/parent-meeting-feature";
import { publishParentMeetingNotification, type ParentMeetingNotificationType } from "@/lib/parent-meeting-notifications";
import type { Role } from "@/lib/permissions";

export const PARENT_MEETING_CATEGORIES = [
  "ACADEMIC_PROGRESS", "ATTENDANCE", "GENERAL_SCHOOL_DISCUSSION",
  "ADMINISTRATIVE", "PRINCIPAL_APPOINTMENT", "OTHER"
] as const;
export const PARENT_MEETING_STATUSES = ["REQUESTED", "SCHEDULING", "SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export const PARENT_MEETING_MODES = ["IN_PERSON", "PHONE", "ONLINE_REFERENCE"] as const;
export const PARENT_MEETING_NOTE_KINDS = ["LEADERSHIP_PRIVATE", "PARTICIPANT_INTERNAL", "PARENT_VISIBLE_SUMMARY"] as const;

type Client = any;
export type ParentMeetingActor = { user: Pick<AuthUser, "id" | "name" | "role" | "guardianId" | "roleAssignmentId">; sessionId: string };
type Category = (typeof PARENT_MEETING_CATEGORIES)[number];
type MeetingStatus = (typeof PARENT_MEETING_STATUSES)[number];

export class ParentMeetingError extends Error {
  constructor(message: string, public status = 400, public code = "PARENT_MEETING_INVALID") { super(message); }
}

export function assertParentMeetingsEnabled() {
  if (!parentMeetingsEnabled()) throw new ParentMeetingError("Parent Meetings is not operationally enabled.", 404, "PARENT_MEETINGS_DEFAULT_OFF");
}

export function parentMeetingRolePolicy(role: Role) {
  return {
    leadershipManage: role === "SUPER_ADMIN" || role === "PRINCIPAL",
    leadershipRead: role === "SUPER_ADMIN" || role === "PRINCIPAL" || role === "DIRECTOR",
    teacherAssigned: role === "TEACHER",
    parentOwn: role === "PARENT"
  };
}

export async function createParentMeetingRequest(client: Client, actor: ParentMeetingActor, input: unknown) {
  assertParentMeetingsEnabled();
  requireRole(actor, ["PARENT"]);
  const row = object(input);
  const academicYear = boundedText(row.academicYear, 4, 20, "Academic year");
  const context = await resolveActiveParentChildContext(client, {
    userId: actor.user.id,
    sessionId: actor.sessionId,
    roleAssignmentId: actor.user.roleAssignmentId,
    academicYear,
    childHandle: optionalText(row.childHandle, 100, "Child context"),
    expectedContextVersion: optionalPositiveInteger(row.expectedContextVersion, "Context version")
  }).catch((error) => { if (error instanceof ParentChildContextError) throw unavailable(); throw error; });
  const category = oneOf(row.category, PARENT_MEETING_CATEGORIES, "Meeting category");
  const subject = boundedText(row.subject, 3, 180, "Meeting subject");
  const requestReason = boundedText(row.requestReason, 3, 2_000, "Request reason", true);
  const preferences = preferenceWindows(row.preferences);
  const activeRequestKey = activeKey(context.guardianId, context.child.id, category);
  try {
    return await client.$transaction(async (tx: Client) => {
      const meeting = await tx.parentMeeting.create({ data: {
        studentId: context.child.id,
        requesterGuardianId: context.guardianId,
        requesterUserId: actor.user.id,
        createdByUserId: actor.user.id,
        academicYear: context.child.academicYear,
        source: "PARENT_REQUEST",
        category,
        subject,
        requestReason,
        activeRequestKey,
        preferences: preferences.length ? { create: preferences } : undefined
      } });
      const event = await audit(tx, actor, meeting.id, "MEETING_REQUESTED", null, "REQUESTED", null, { category, preferenceCount: preferences.length });
      await notify(tx, meeting, event.publicKey, "REQUESTED", actor.user.id, true);
      return parentMeetingByKey(tx, meeting.publicKey);
    });
  } catch (error) { throw persistenceError(error, "A similar active meeting request already exists."); }
}

export async function createLeadershipParentMeeting(client: Client, actor: ParentMeetingActor, input: unknown) {
  assertParentMeetingsEnabled();
  requireManager(actor);
  const row = object(input);
  const academicYear = boundedText(row.academicYear, 4, 20, "Academic year");
  const admissionNo = boundedText(row.studentAdmissionNo, 1, 80, "Student admission number");
  const category = oneOf(row.category, PARENT_MEETING_CATEGORIES, "Meeting category");
  const subject = boundedText(row.subject, 3, 180, "Meeting subject");
  const requestReason = optionalText(row.requestReason, 2_000, "Parent-safe description");
  const student = await client.student.findFirst({
    where: { admissionNo, deletedAt: null, academicYearEnrollments: { some: { academicYear, status: "ACTIVE" } } },
    select: {
      id: true,
      guardians: { where: { guardian: { status: "Active" } }, select: { guardianId: true, isPrimaryContact: true }, orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }], take: 1 }
    }
  });
  if (!student) throw new ParentMeetingError("The active Student was not found.", 404, "STUDENT_NOT_FOUND");
  const requesterGuardianId = student.guardians[0]?.guardianId ?? null;
  try {
    return await client.$transaction(async (tx: Client) => {
      const meeting = await tx.parentMeeting.create({ data: {
        studentId: student.id,
        requesterGuardianId,
        createdByUserId: actor.user.id,
        academicYear,
        source: "LEADERSHIP_CREATED",
        category,
        subject,
        requestReason,
        activeRequestKey: requesterGuardianId ? activeKey(requesterGuardianId, student.id, category) : null
      } });
      await audit(tx, actor, meeting.id, "MEETING_CREATED_BY_LEADERSHIP", null, "REQUESTED", null, { category, guardianContextAvailable: Boolean(requesterGuardianId) });
      return parentMeetingByKey(tx, meeting.publicKey);
    });
  } catch (error) { throw persistenceError(error, "A similar active meeting already exists."); }
}

export async function listParentMeetingWorkspace(client: Client, actor: ParentMeetingActor, input: unknown = {}) {
  assertParentMeetingsEnabled();
  const policy = parentMeetingRolePolicy(actor.user.role);
  if (!policy.leadershipRead && !policy.teacherAssigned) throw unavailable();
  const row = object(input, true);
  const filters = listFilters(row);
  const where: Record<string, unknown> = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.from || filters.to ? { scheduledStartAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
    ...(filters.search ? { OR: [{ subject: { contains: filters.search } }, { student: { studentName: { contains: filters.search } } }] } : {}),
    ...(policy.teacherAssigned ? { participants: { some: { staffMember: { userId: actor.user.id, status: "ACTIVE" }, status: { not: "REMOVED" } } } } : {})
  };
  const [rows, total, reports, candidates, students] = await Promise.all([
    boundedWorkspaceMeetings(client, where, filters),
    client.parentMeeting.count({ where }),
    parentMeetingReportCounts(client, actor, filters),
    policy.leadershipManage ? client.staffMember.findMany({ where: { status: "ACTIVE", iamPublicKey: { not: null } }, select: { iamPublicKey: true, fullName: true, displayName: true, designation: true, staffType: true }, orderBy: { fullName: "asc" }, take: 500 }) : [],
    policy.leadershipManage ? client.student.findMany({ where: { deletedAt: null, academicYearEnrollments: { some: { status: "ACTIVE" } } }, select: { admissionNo: true, studentName: true, className: true, section: true, academicYear: true }, orderBy: { studentName: "asc" }, take: 500 }) : []
  ]);
  return {
    feature: { key: "PARENT_MEETINGS_V1_5", enabled: true, operationalActivation: "DEFAULT_OFF_UNLESS_EXPLICITLY_ENABLED", schoolTimeZone: "Asia/Kolkata" },
    role: actor.user.role,
    capabilities: { manage: policy.leadershipManage, oversight: policy.leadershipRead, contribute: policy.teacherAssigned || policy.leadershipManage, export: policy.leadershipManage },
    pagination: { total, offset: filters.offset, limit: filters.limit },
    reports,
    staffCandidates: candidates.map((staff: any) => ({ handle: staff.iamPublicKey, name: staff.displayName || staff.fullName, designation: staff.designation, staffType: staff.staffType })),
    studentCandidates: students,
    meetings: rows.map((meeting: any) => internalMeetingView(meeting, actor.user.role, actor.user.id))
  };
}

async function boundedWorkspaceMeetings(client: Client, where: Record<string, unknown>, filters: ReturnType<typeof listFilters>) {
  if (filters.status) return client.parentMeeting.findMany({ where, include: meetingInclude(), skip: filters.offset, take: filters.limit, orderBy: [{ scheduledStartAt: "asc" }, { createdAt: "desc" }] });
  const query = { include: meetingInclude(), take: filters.offset + filters.limit };
  const [active, terminal] = await Promise.all([
    client.parentMeeting.findMany({ ...query, where: { ...where, status: { in: ["REQUESTED", "SCHEDULING", "SCHEDULED", "CONFIRMED"] } }, orderBy: [{ scheduledStartAt: "asc" }, { createdAt: "desc" }] }),
    client.parentMeeting.findMany({ ...query, where: { ...where, status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] } }, orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }] })
  ]);
  return [...active, ...terminal].slice(filters.offset, filters.offset + filters.limit);
}

export async function listParentOwnMeetings(client: Client, actor: ParentMeetingActor, input: unknown) {
  assertParentMeetingsEnabled();
  requireRole(actor, ["PARENT"]);
  const row = object(input, true);
  const academicYear = boundedText(row.academicYear, 4, 20, "Academic year");
  const context = await resolveActiveParentChildContext(client, {
    userId: actor.user.id,
    sessionId: actor.sessionId,
    roleAssignmentId: actor.user.roleAssignmentId,
    academicYear,
    childHandle: optionalText(row.childHandle, 100, "Child context"),
    expectedContextVersion: optionalPositiveInteger(row.expectedContextVersion, "Context version")
  }).catch((error) => { if (error instanceof ParentChildContextError) throw unavailable(); throw error; });
  const meetings = await client.parentMeeting.findMany({
    where: { studentId: context.child.id, requesterGuardianId: context.guardianId },
    include: meetingInclude(),
    orderBy: [{ scheduledStartAt: "desc" }, { createdAt: "desc" }],
    take: 100
  });
  return {
    feature: { key: "PARENT_MEETINGS_V1_5", enabled: true, schoolTimeZone: "Asia/Kolkata" },
    context: { childHandle: context.handle, contextVersion: context.contextVersion, child: { studentName: context.child.studentName, admissionNo: context.child.admissionNo, academicYear: context.child.academicYear, className: context.child.className, section: context.child.section } },
    categories: PARENT_MEETING_CATEGORIES,
    meetings: meetings.map(parentMeetingView)
  };
}

export async function scheduleParentMeeting(client: Client, actor: ParentMeetingActor, meetingKey: string, input: unknown) {
  assertParentMeetingsEnabled();
  requireManager(actor);
  const row = object(input);
  const expectedRowVersion = positiveInteger(row.expectedRowVersion, "Meeting version");
  const start = zonedDate(row.scheduledStartAt, "Scheduled start");
  const durationMinutes = boundedInteger(row.durationMinutes, 10, 180, "Duration");
  const now = new Date();
  if (start <= now) throw new ParentMeetingError("Meeting time must be in the future.", 409, "PAST_SCHEDULE_DENIED");
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const mode = oneOf(row.mode, PARENT_MEETING_MODES, "Meeting mode");
  const locationReference = mode === "IN_PERSON" ? boundedText(row.locationReference, 2, 160, "Location") : optionalText(row.locationReference, 160, "Location");
  const onlineReference = mode === "ONLINE_REFERENCE" ? safeOnlineReference(row.onlineReference) : null;
  const staffHandles = safeHandleList(row.participantStaffHandles, "Participants", 1, 10);
  const primaryHandle = safeHandle(row.primaryStaffHandle, "Primary staff participant");
  if (!staffHandles.includes(primaryHandle)) staffHandles.unshift(primaryHandle);
  const staff = await client.staffMember.findMany({ where: { iamPublicKey: { in: staffHandles }, status: "ACTIVE", userId: { not: null } }, select: { id: true, iamPublicKey: true } });
  if (staff.length !== new Set(staffHandles).size) throw new ParentMeetingError("One or more staff participants are unavailable.", 404, "PARTICIPANT_NOT_FOUND");
  const staffByHandle = new Map<string, { id: string; iamPublicKey: string }>(staff.map((item: any) => [item.iamPublicKey, item]));
  try {
    return await client.$transaction(async (tx: Client) => {
      const meeting = await meetingForUpdate(tx, meetingKey);
      if (meeting.rowVersion !== expectedRowVersion) throw changed();
      if (!["REQUESTED", "SCHEDULING", "SCHEDULED", "CONFIRMED"].includes(meeting.status)) throw transitionError(meeting.status, "SCHEDULE");
      const desiredIds = staffHandles.map((handle) => staffByHandle.get(handle)!.id);
      const existing = await tx.parentMeetingParticipant.findMany({ where: { meetingId: meeting.id } });
      for (const participant of existing) {
        if (!desiredIds.includes(participant.staffMemberId) && participant.status !== "REMOVED") {
          await tx.parentMeetingParticipant.update({ where: { id: participant.id }, data: { status: "REMOVED", removedAt: now, rowVersion: { increment: 1 } } });
        } else if (desiredIds.includes(participant.staffMemberId) && participant.status !== "REMOVED") {
          await tx.parentMeetingParticipant.update({ where: { id: participant.id }, data: { participantRole: "ADDITIONAL_STAFF", rowVersion: { increment: 1 } } });
        }
      }
      const wasScheduled = Boolean(meeting.scheduledStartAt);
      const changedSchedule = wasScheduled && (meeting.scheduledStartAt.getTime() !== start.getTime() || meeting.durationMinutes !== durationMinutes || meeting.mode !== mode || meeting.locationReference !== locationReference);
      const updated = await tx.parentMeeting.updateMany({
        where: { id: meeting.id, rowVersion: expectedRowVersion },
        data: { scheduledStartAt: start, scheduledEndAt: end, durationMinutes, mode, locationReference, onlineReference, status: "SCHEDULED", scheduledByUserId: actor.user.id, rowVersion: { increment: 1 } }
      });
      if (updated.count !== 1) throw changed();
      for (const handle of staffHandles) {
        const item = staffByHandle.get(handle)!;
        const participantRole = handle === primaryHandle ? "PRIMARY_STAFF" : "ADDITIONAL_STAFF";
        const current = existing.find((candidate: any) => candidate.staffMemberId === item.id);
        if (!current) await tx.parentMeetingParticipant.create({ data: { meetingId: meeting.id, staffMemberId: item.id, participantRole, assignedByUserId: actor.user.id } });
        else await tx.parentMeetingParticipant.update({ where: { id: current.id }, data: { participantRole, status: "ASSIGNED", removedAt: null, attendanceAt: null, rowVersion: { increment: 1 } } });
      }
      const type = changedSchedule ? "MEETING_RESCHEDULED" : "MEETING_SCHEDULED";
      const event = await audit(tx, actor, meeting.id, type, meeting.status, "SCHEDULED", null, { start: start.toISOString(), end: end.toISOString(), durationMinutes, mode, participantCount: staffHandles.length });
      const current = await parentMeetingByKey(tx, meeting.publicKey);
      await notify(tx, current, event.publicKey, changedSchedule ? "RESCHEDULED" : "SCHEDULED", actor.user.id);
      return current;
    });
  } catch (error) { throw persistenceError(error, undefined, true); }
}

export async function transitionParentMeeting(client: Client, actor: ParentMeetingActor, meetingKey: string, input: unknown) {
  assertParentMeetingsEnabled();
  requireManager(actor);
  const row = object(input);
  const action = oneOf(row.action, ["START_SCHEDULING", "CONFIRM", "COMPLETE", "CANCEL", "NO_SHOW"] as const, "Meeting action");
  const expectedRowVersion = positiveInteger(row.expectedRowVersion, "Meeting version");
  const now = new Date();
  try {
    return await client.$transaction(async (tx: Client) => {
      const meeting = await meetingForUpdate(tx, meetingKey);
      if (meeting.rowVersion !== expectedRowVersion) throw changed();
      let status: MeetingStatus;
      let data: Record<string, unknown> = {};
      let reason: string | null = null;
      let eventType: string;
      let notification: ParentMeetingNotificationType | null = null;
      if (action === "START_SCHEDULING") {
        if (meeting.status !== "REQUESTED") throw transitionError(meeting.status, action);
        status = "SCHEDULING"; eventType = "SCHEDULING_STARTED";
      } else if (action === "CONFIRM") {
        if (meeting.status !== "SCHEDULED") throw transitionError(meeting.status, action);
        status = "CONFIRMED"; eventType = "MEETING_CONFIRMED";
      } else if (action === "COMPLETE") {
        if (!["SCHEDULED", "CONFIRMED"].includes(meeting.status)) throw transitionError(meeting.status, action);
        if (!meeting.scheduledStartAt || meeting.scheduledStartAt > now) throw new ParentMeetingError("A meeting cannot be completed before its scheduled start.", 409, "MEETING_NOT_STARTED");
        status = "COMPLETED"; eventType = "MEETING_COMPLETED"; notification = "COMPLETED";
        data = { completedAt: now, completedByUserId: actor.user.id, followUpRequired: Boolean(row.followUpRequired), activeRequestKey: null };
      } else if (action === "CANCEL") {
        if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(meeting.status)) throw transitionError(meeting.status, action);
        reason = boundedText(row.internalReason, 3, 1_000, "Internal cancellation reason");
        status = "CANCELLED"; eventType = "MEETING_CANCELLED"; notification = "CANCELLED";
        data = { cancelledAt: now, cancelledByUserId: actor.user.id, cancellationInternalReason: reason, parentCancellationSummary: optionalText(row.parentSummary, 1_000, "Parent cancellation summary"), activeRequestKey: null };
      } else {
        if (!["SCHEDULED", "CONFIRMED"].includes(meeting.status)) throw transitionError(meeting.status, action);
        if (!meeting.scheduledStartAt || meeting.scheduledStartAt > now) throw new ParentMeetingError("A no-show cannot be recorded before the scheduled start.", 409, "NO_SHOW_TOO_EARLY");
        const noShowState = oneOf(row.noShowState, ["PARENT_NO_SHOW", "STAFF_NO_SHOW", "BOTH_NO_SHOW"] as const, "No-show state");
        reason = optionalText(row.reason, 1_000, "No-show reason");
        status = "NO_SHOW"; eventType = "MEETING_NO_SHOW"; notification = "NO_SHOW";
        data = { noShowState, completedAt: now, completedByUserId: actor.user.id, activeRequestKey: null };
      }
      const updated = await tx.parentMeeting.updateMany({ where: { id: meeting.id, rowVersion: expectedRowVersion }, data: { ...data, status, rowVersion: { increment: 1 } } });
      if (updated.count !== 1) throw changed();
      const event = await audit(tx, actor, meeting.id, eventType, meeting.status, status, reason, { followUpRequired: Boolean(row.followUpRequired) });
      const current = await parentMeetingByKey(tx, meeting.publicKey);
      if (notification) await notify(tx, current, event.publicKey, notification, actor.user.id);
      return current;
    });
  } catch (error) { throw persistenceError(error); }
}

export async function cancelParentMeetingRequest(client: Client, actor: ParentMeetingActor, meetingKey: string, input: unknown) {
  assertParentMeetingsEnabled();
  requireRole(actor, ["PARENT"]);
  const row = object(input);
  const expectedRowVersion = positiveInteger(row.expectedRowVersion, "Meeting version");
  const reason = boundedText(row.reason, 3, 500, "Cancellation reason");
  try {
    return await client.$transaction(async (tx: Client) => {
      const meeting = await meetingForUpdate(tx, meetingKey);
      const context = await resolveActiveParentChildContext(tx, {
        userId: actor.user.id,
        sessionId: actor.sessionId,
        roleAssignmentId: actor.user.roleAssignmentId,
        academicYear: meeting.academicYear
      }).catch((error) => { if (error instanceof ParentChildContextError) throw unavailable(); throw error; });
      if (
        meeting.studentId !== context.child.id ||
        meeting.requesterGuardianId !== context.guardianId ||
        meeting.requesterUserId !== actor.user.id
      ) throw unavailable();
      if (!["REQUESTED", "SCHEDULING"].includes(meeting.status)) throw transitionError(meeting.status, "PARENT_CANCEL");
      const updated = await tx.parentMeeting.updateMany({ where: { id: meeting.id, rowVersion: expectedRowVersion }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelledByUserId: actor.user.id, parentCancellationSummary: reason, activeRequestKey: null, rowVersion: { increment: 1 } } });
      if (updated.count !== 1) throw changed();
      const event = await audit(tx, actor, meeting.id, "PARENT_REQUEST_CANCELLED", meeting.status, "CANCELLED", null, { parentReasonRecorded: true });
      const current = await parentMeetingByKey(tx, meeting.publicKey);
      await notify(tx, current, event.publicKey, "CANCELLED", actor.user.id, true);
      return parentMeetingView(current);
    });
  } catch (error) { throw persistenceError(error); }
}

export async function recordParentMeetingNote(client: Client, actor: ParentMeetingActor, meetingKey: string, input: unknown) {
  assertParentMeetingsEnabled();
  const row = object(input);
  const kind = oneOf(row.kind, PARENT_MEETING_NOTE_KINDS, "Note kind");
  const body = boundedText(row.body, 1, 8_000, "Note", true);
  const manager = parentMeetingRolePolicy(actor.user.role).leadershipManage;
  if (!manager && actor.user.role !== "TEACHER") throw unavailable();
  if (!manager && kind !== "PARTICIPANT_INTERNAL") throw unavailable();
  try {
    return await client.$transaction(async (tx: Client) => {
      const meeting = await meetingForUpdate(tx, meetingKey, true);
      if (actor.user.role === "TEACHER" && !meeting.participants.some((participant: any) => participant.status !== "REMOVED" && participant.staffMember.userId === actor.user.id)) throw unavailable();
      if (["CANCELLED", "NO_SHOW"].includes(meeting.status)) throw new ParentMeetingError("Notes cannot be added to this closed meeting outcome.", 409, "MEETING_NOTES_CLOSED");
      if (kind === "PARENT_VISIBLE_SUMMARY" && meeting.status !== "COMPLETED") throw new ParentMeetingError("A Parent-visible summary can be published only after meeting completion.", 409, "SUMMARY_BEFORE_COMPLETION");
      let correctsNoteId: string | null = null;
      let correctionReason: string | null = null;
      if (row.correctsNoteKey) {
        const corrected = await tx.parentMeetingNote.findUnique({ where: { publicKey: safeKey(row.correctsNoteKey, "Note reference") }, include: { corrections: { take: 1 } } });
        if (!corrected || corrected.meetingId !== meeting.id || corrected.kind !== kind) throw unavailable();
        if (!manager && corrected.authorUserId !== actor.user.id) throw unavailable();
        if (corrected.corrections.length) throw changed("This note already has a preserved correction.");
        correctsNoteId = corrected.id;
        correctionReason = boundedText(row.correctionReason, 3, 500, "Correction reason");
      } else if (kind === "PARENT_VISIBLE_SUMMARY") {
        const existingSummary = await tx.parentMeetingNote.findFirst({ where: { meetingId: meeting.id, kind }, select: { id: true } });
        if (existingSummary) throw new ParentMeetingError("Correct the current Parent-visible summary with a preserved reason instead of publishing an unrelated replacement.", 409, "SUMMARY_CORRECTION_REQUIRED");
      }
      const note = await tx.parentMeetingNote.create({ data: { meetingId: meeting.id, kind, body, authorUserId: actor.user.id, authorRole: actor.user.role, correctsNoteId, correctionReason } });
      const eventType = correctsNoteId ? "MEETING_NOTE_CORRECTED" : "MEETING_NOTE_ADDED";
      const event = await audit(tx, actor, meeting.id, eventType, meeting.status, meeting.status, correctionReason, { kind, noteReference: note.publicKey, bodyLogged: false });
      if (kind === "PARENT_VISIBLE_SUMMARY") await notify(tx, meeting, event.publicKey, correctsNoteId ? "SUMMARY_CORRECTED" : "SUMMARY_PUBLISHED", actor.user.id);
      return { publicKey: note.publicKey, kind: note.kind, createdAt: note.createdAt, corrected: Boolean(correctsNoteId) };
    });
  } catch (error) { throw persistenceError(error); }
}

export async function recordParentMeetingAttendance(client: Client, actor: ParentMeetingActor, meetingKey: string, input: unknown) {
  assertParentMeetingsEnabled();
  const row = object(input);
  const status = oneOf(row.status, ["ATTENDED", "ABSENT"] as const, "Attendance status");
  const expectedRowVersion = positiveInteger(row.expectedRowVersion, "Participant version");
  const manager = parentMeetingRolePolicy(actor.user.role).leadershipManage;
  if (!manager && actor.user.role !== "TEACHER") throw unavailable();
  try {
    return await client.$transaction(async (tx: Client) => {
      const meeting = await meetingForUpdate(tx, meetingKey, true);
      if (!meeting.scheduledStartAt || meeting.scheduledStartAt > new Date() || !["SCHEDULED", "CONFIRMED", "COMPLETED"].includes(meeting.status)) throw new ParentMeetingError("Attendance can be recorded only after the governed meeting start.", 409, "MEETING_ATTENDANCE_TOO_EARLY");
      let participant: any;
      if (manager) {
        const handle = safeHandle(row.staffHandle, "Staff participant");
        participant = meeting.participants.find((item: any) => item.staffMember.iamPublicKey === handle && item.status !== "REMOVED");
      } else participant = meeting.participants.find((item: any) => item.staffMember.userId === actor.user.id && item.status !== "REMOVED");
      if (!participant) throw unavailable();
      const changedRow = await tx.parentMeetingParticipant.updateMany({ where: { id: participant.id, rowVersion: expectedRowVersion, status: { not: "REMOVED" } }, data: { status, attendanceAt: new Date(), rowVersion: { increment: 1 } } });
      if (changedRow.count !== 1) throw changed();
      await audit(tx, actor, meeting.id, "PARTICIPANT_ATTENDANCE_RECORDED", meeting.status, meeting.status, null, { participantReference: participant.publicKey, attendance: status });
      return { participantKey: participant.publicKey, status, rowVersion: expectedRowVersion + 1 };
    });
  } catch (error) { throw persistenceError(error); }
}

export async function createParentMeetingFollowUp(client: Client, actor: ParentMeetingActor, meetingKey: string, input: unknown) {
  assertParentMeetingsEnabled();
  requireManager(actor);
  const row = object(input);
  const internalDescription = boundedText(row.internalDescription, 3, 2_000, "Internal follow-up description", true);
  const parentVisibleDescription = optionalText(row.parentVisibleDescription, 2_000, "Parent-visible follow-up description");
  const responsibleHandle = safeHandle(row.responsibleStaffHandle, "Responsible staff");
  const dueDate = indiaDueDate(row.dueDate);
  const staff = await client.staffMember.findFirst({ where: { iamPublicKey: responsibleHandle, status: "ACTIVE", userId: { not: null } }, select: { id: true } });
  if (!staff) throw new ParentMeetingError("The responsible staff member is unavailable.", 404, "FOLLOW_UP_STAFF_NOT_FOUND");
  return client.$transaction(async (tx: Client) => {
    const meeting = await meetingForUpdate(tx, meetingKey);
    if (meeting.status !== "COMPLETED") throw new ParentMeetingError("Follow-up can be created only after meeting completion.", 409, "FOLLOW_UP_BEFORE_COMPLETION");
    const followUp = await tx.parentMeetingFollowUp.create({ data: { meetingId: meeting.id, internalDescription, parentVisibleDescription, responsibleStaffMemberId: staff.id, dueDate, createdByUserId: actor.user.id } });
    await tx.parentMeeting.update({ where: { id: meeting.id }, data: { followUpRequired: true, rowVersion: { increment: 1 } } });
    const event = await audit(tx, actor, meeting.id, "FOLLOW_UP_CREATED", meeting.status, meeting.status, null, { followUpReference: followUp.publicKey, dueDate: dueDate.toISOString(), parentVisible: Boolean(parentVisibleDescription) });
    const current = await parentMeetingByKey(tx, meeting.publicKey);
    await notify(tx, current, event.publicKey, "FOLLOW_UP_CREATED", actor.user.id, false, undefined, Boolean(parentVisibleDescription));
    return followUp;
  });
}

export async function transitionParentMeetingFollowUp(client: Client, actor: ParentMeetingActor, followUpKey: string, input: unknown) {
  assertParentMeetingsEnabled();
  const row = object(input);
  const action = oneOf(row.action, ["DONE", "CANCEL"] as const, "Follow-up action");
  const expectedRowVersion = positiveInteger(row.expectedRowVersion, "Follow-up version");
  const manager = parentMeetingRolePolicy(actor.user.role).leadershipManage;
  try {
    return await client.$transaction(async (tx: Client) => {
      const followUp = await tx.parentMeetingFollowUp.findUnique({ where: { publicKey: safeKey(followUpKey, "Follow-up reference") }, include: { meeting: { include: { participants: true } }, responsibleStaffMember: true } });
      if (!followUp) throw unavailable();
      const responsible = actor.user.role === "TEACHER" && followUp.responsibleStaffMember.userId === actor.user.id;
      if (!manager && !responsible) throw unavailable();
      if (!manager && action !== "DONE") throw unavailable();
      if (followUp.status !== "OPEN") throw transitionError(followUp.status, action);
      const now = new Date();
      const reason = action === "CANCEL" ? boundedText(row.reason, 3, 500, "Cancellation reason") : null;
      const changedRow = await tx.parentMeetingFollowUp.updateMany({ where: { id: followUp.id, rowVersion: expectedRowVersion, status: "OPEN" }, data: action === "DONE" ? { status: "DONE", completedAt: now, completedByUserId: actor.user.id, rowVersion: { increment: 1 } } : { status: "CANCELLED", cancelledAt: now, cancelledByUserId: actor.user.id, cancellationReason: reason, rowVersion: { increment: 1 } } });
      if (changedRow.count !== 1) throw changed();
      const event = await audit(tx, actor, followUp.meetingId, action === "DONE" ? "FOLLOW_UP_COMPLETED" : "FOLLOW_UP_CANCELLED", followUp.meeting.status, followUp.meeting.status, reason, { followUpReference: followUp.publicKey });
      if (action === "DONE") await notify(tx, followUp.meeting, event.publicKey, "FOLLOW_UP_DONE", actor.user.id, false, undefined, Boolean(followUp.parentVisibleDescription));
      return { followUpKey: followUp.publicKey, status: action === "DONE" ? "DONE" : "CANCELLED", rowVersion: expectedRowVersion + 1 };
    });
  } catch (error) { throw persistenceError(error); }
}

export async function processParentMeetingReminders(client: Client, actor: ParentMeetingActor, now = new Date()) {
  assertParentMeetingsEnabled();
  requireManager(actor);
  const upcomingUntil = new Date(now.getTime() + 24 * 60 * 60_000);
  const [meetings, followUps] = await Promise.all([
    client.parentMeeting.findMany({ where: { status: { in: ["SCHEDULED", "CONFIRMED"] }, scheduledStartAt: { gt: now, lte: upcomingUntil } }, include: { participants: true }, take: 500 }),
    client.parentMeetingFollowUp.findMany({ where: { status: "OPEN", dueDate: { lte: upcomingUntil } }, include: { meeting: { include: { participants: true } } }, take: 500 })
  ]);
  const results = [];
  for (const meeting of meetings) results.push(await notify(client, meeting, `UPCOMING:${meeting.publicKey}:${meeting.scheduledStartAt.toISOString()}`, "UPCOMING", actor.user.id));
  for (const followUp of followUps) results.push(await notify(client, followUp.meeting, `FOLLOWUP:${followUp.publicKey}:${followUp.dueDate.toISOString().slice(0, 10)}`, "FOLLOW_UP_DUE", actor.user.id, false, [followUp.responsibleStaffMemberId], false));
  return { upcomingMeetings: meetings.length, dueFollowUps: followUps.length, notifications: results, idempotency: "CAMPAIGN_FINGERPRINT" };
}

export async function exportParentMeetingReportCsv(client: Client, actor: ParentMeetingActor, input: unknown = {}) {
  assertParentMeetingsEnabled();
  requireManager(actor);
  const filters = listFilters(object(input, true));
  const rows = await client.parentMeeting.findMany({
    where: { ...(filters.status ? { status: filters.status } : {}), ...(filters.category ? { category: filters.category } : {}), ...(filters.from || filters.to ? { scheduledStartAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}) },
    include: { student: { select: { admissionNo: true, studentName: true, className: true, section: true } }, participants: { where: { status: { not: "REMOVED" } }, include: { staffMember: { select: { fullName: true, displayName: true } } } }, followUps: { select: { status: true, dueDate: true } } },
    orderBy: [{ scheduledStartAt: "asc" }, { createdAt: "desc" }], take: 5_000
  });
  const header = ["Meeting reference", "Student", "Admission number", "Class", "Category", "Subject", "Status", "Start (Asia/Kolkata)", "Duration minutes", "Mode", "Location/reference", "Participants", "Open follow-ups", "Overdue follow-ups"];
  const now = new Date();
  return [header, ...rows.map((meeting: any) => [
    meeting.publicKey, meeting.student.studentName, meeting.student.admissionNo, `${meeting.student.className}${meeting.student.section ? ` ${meeting.student.section}` : ""}`,
    meeting.category, meeting.subject, meeting.status, meeting.scheduledStartAt ? formatIndia(meeting.scheduledStartAt) : "", meeting.durationMinutes ?? "", meeting.mode ?? "", meeting.locationReference || meeting.onlineReference || "",
    meeting.participants.map((participant: any) => participant.staffMember.displayName || participant.staffMember.fullName).join("; "),
    meeting.followUps.filter((followUp: any) => followUp.status === "OPEN").length,
    meeting.followUps.filter((followUp: any) => followUp.status === "OPEN" && followUp.dueDate < now).length
  ])].map((cells) => cells.map(csvCell).join(",")).join("\r\n");
}

export async function parentMeetingReportCounts(client: Client, actor: ParentMeetingActor, input: { from?: Date | null; to?: Date | null } = {}) {
  const teacherScope = actor.user.role === "TEACHER" ? { participants: { some: { staffMember: { userId: actor.user.id, status: "ACTIVE" }, status: { not: "REMOVED" } } } } : {};
  const date = input.from || input.to ? { scheduledStartAt: { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) } } : {};
  const now = new Date();
  const [pending, upcoming, completed, cancelled, noShows, openFollowUps, overdueFollowUps] = await Promise.all([
    client.parentMeeting.count({ where: { ...teacherScope, status: { in: ["REQUESTED", "SCHEDULING"] } } }),
    client.parentMeeting.count({ where: { ...teacherScope, ...date, status: { in: ["SCHEDULED", "CONFIRMED"] }, scheduledStartAt: { ...(date as any).scheduledStartAt, gte: now } } }),
    client.parentMeeting.count({ where: { ...teacherScope, ...date, status: "COMPLETED" } }),
    client.parentMeeting.count({ where: { ...teacherScope, ...date, status: "CANCELLED" } }),
    client.parentMeeting.count({ where: { ...teacherScope, ...date, status: "NO_SHOW" } }),
    client.parentMeetingFollowUp.count({ where: { status: "OPEN", ...(actor.user.role === "TEACHER" ? { responsibleStaffMember: { userId: actor.user.id } } : {}) } }),
    client.parentMeetingFollowUp.count({ where: { status: "OPEN", dueDate: { lt: now }, ...(actor.user.role === "TEACHER" ? { responsibleStaffMember: { userId: actor.user.id } } : {}) } })
  ]);
  return { pendingRequests: pending, upcoming, completed, cancelled, noShows, openFollowUps, overdueFollowUps };
}

function meetingInclude() {
  return {
    student: { select: { admissionNo: true, studentName: true, className: true, section: true } },
    requesterGuardian: { select: { displayName: true } },
    preferences: { orderBy: { sequence: "asc" } },
    participants: { include: { staffMember: { select: { iamPublicKey: true, userId: true, fullName: true, displayName: true, designation: true } } }, orderBy: [{ participantRole: "asc" }, { assignedAt: "asc" }] },
    notes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { corrections: { select: { publicKey: true }, take: 1 } } },
    followUps: { include: { responsibleStaffMember: { select: { iamPublicKey: true, userId: true, fullName: true, displayName: true, designation: true } } }, orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
    events: { orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 80 }
  };
}

async function parentMeetingByKey(client: Client, meetingKey: string) {
  const meeting = await client.parentMeeting.findUnique({ where: { publicKey: safeKey(meetingKey, "Meeting reference") }, include: meetingInclude() });
  if (!meeting) throw unavailable();
  return meeting;
}

async function meetingForUpdate(client: Client, meetingKey: string, withParticipants = false) {
  const meeting = await client.parentMeeting.findUnique({ where: { publicKey: safeKey(meetingKey, "Meeting reference") }, include: withParticipants ? { participants: { include: { staffMember: true } } } : undefined });
  if (!meeting) throw unavailable();
  return meeting;
}

function internalMeetingView(meeting: any, role: Role, actorUserId: string) {
  const manager = role === "SUPER_ADMIN" || role === "PRINCIPAL";
  const teacher = role === "TEACHER";
  const notes = manager ? meeting.notes : teacher ? meeting.notes.filter((note: any) => note.kind === "PARTICIPANT_INTERNAL") : [];
  return {
    publicKey: meeting.publicKey,
    academicYear: meeting.academicYear,
    source: meeting.source,
    category: meeting.category,
    subject: meeting.subject,
    requestReason: meeting.requestReason,
    status: meeting.status,
    schedule: scheduleView(meeting),
    rowVersion: meeting.rowVersion,
    createdAt: meeting.createdAt,
    completedAt: meeting.completedAt,
    cancelledAt: meeting.cancelledAt,
    noShowState: meeting.noShowState,
    followUpRequired: meeting.followUpRequired,
    student: meeting.student,
    requester: meeting.requesterGuardian ? { displayName: meeting.requesterGuardian.displayName } : null,
    preferences: meeting.preferences.map((preference: any) => ({ startsAt: preference.startsAt, endsAt: preference.endsAt })),
    participants: meeting.participants.filter((participant: any) => participant.status !== "REMOVED").map((participant: any) => ({ publicKey: participant.publicKey, staffHandle: manager ? participant.staffMember.iamPublicKey : undefined, own: participant.staffMember.userId === actorUserId, name: participant.staffMember.displayName || participant.staffMember.fullName, designation: participant.staffMember.designation, participantRole: participant.participantRole, attendance: participant.status, rowVersion: participant.rowVersion })),
    notes: notes.map((note: any) => ({ publicKey: note.publicKey, kind: note.kind, body: note.body, authorRole: note.authorRole, own: note.authorUserId === actorUserId, createdAt: note.createdAt, correctionReason: note.correctionReason, corrected: note.corrections.length > 0 })),
    followUps: meeting.followUps.map((followUp: any) => ({ publicKey: followUp.publicKey, internalDescription: manager || (teacher && followUp.responsibleStaffMember.userId === actorUserId) ? followUp.internalDescription : null, parentVisibleDescription: followUp.parentVisibleDescription, responsibleStaffHandle: manager ? followUp.responsibleStaffMember.iamPublicKey : undefined, responsibleName: followUp.responsibleStaffMember.displayName || followUp.responsibleStaffMember.fullName, own: followUp.responsibleStaffMember.userId === actorUserId, dueDate: followUp.dueDate, status: followUp.status, rowVersion: followUp.rowVersion })),
    cancellation: manager ? { internalReason: meeting.cancellationInternalReason, parentSummary: meeting.parentCancellationSummary } : { parentSummary: meeting.parentCancellationSummary },
    events: manager || role === "DIRECTOR" ? meeting.events.map((event: any) => ({ publicKey: event.publicKey, eventType: event.eventType, actorRole: event.actorRole, previousStatus: event.previousStatus, newStatus: event.newStatus, occurredAt: event.occurredAt, reason: manager ? event.reason : null })) : []
  };
}

function parentMeetingView(meeting: any) {
  const currentSummary = latestUncorrectedChainNote(meeting.notes.filter((note: any) => note.kind === "PARENT_VISIBLE_SUMMARY"));
  return {
    publicKey: meeting.publicKey,
    academicYear: meeting.academicYear,
    category: meeting.category,
    subject: meeting.subject,
    requestReason: meeting.requestReason,
    status: meeting.status,
    schedule: scheduleView(meeting),
    rowVersion: meeting.rowVersion,
    createdAt: meeting.createdAt,
    completedAt: meeting.completedAt,
    noShowState: meeting.noShowState,
    participants: meeting.participants.filter((participant: any) => participant.status !== "REMOVED").map((participant: any) => ({ name: participant.staffMember.displayName || participant.staffMember.fullName, designation: participant.staffMember.designation, primary: participant.participantRole === "PRIMARY_STAFF" })),
    parentVisibleSummary: currentSummary ? { body: currentSummary.body, publishedAt: currentSummary.createdAt, corrected: Boolean(currentSummary.correctsNoteId) } : null,
    cancellationSummary: meeting.parentCancellationSummary,
    followUps: meeting.followUps.filter((followUp: any) => followUp.parentVisibleDescription).map((followUp: any) => ({ description: followUp.parentVisibleDescription, dueDate: followUp.dueDate, status: followUp.status, completedAt: followUp.completedAt }))
  };
}

function latestUncorrectedChainNote(notes: any[]) {
  if (!notes.length) return null;
  const corrected = new Set(notes.map((note) => note.correctsNoteId).filter(Boolean));
  return [...notes].reverse().find((note) => !corrected.has(note.id)) ?? notes[notes.length - 1];
}

function scheduleView(meeting: any) {
  return meeting.scheduledStartAt ? { start: meeting.scheduledStartAt, end: meeting.scheduledEndAt, durationMinutes: meeting.durationMinutes, mode: meeting.mode, location: meeting.locationReference, onlineReference: meeting.onlineReference, schoolTimeZone: "Asia/Kolkata" } : null;
}

async function audit(client: Client, actor: ParentMeetingActor, meetingId: string, eventType: string, previousStatus?: string | null, newStatus?: string | null, reason?: string | null, safe?: Record<string, unknown>) {
  return client.parentMeetingEvent.create({ data: { meetingId, eventType, actorUserId: actor.user.id, actorRole: actor.user.role, previousStatus, newStatus, reason, safeMetadataJson: safe ? JSON.stringify(safe) : null } });
}

async function notify(client: Client, meeting: any, eventKey: string, type: ParentMeetingNotificationType, actorUserId: string, leadershipRecipients = false, participantOverride?: string[], includeParent = true) {
  return publishParentMeetingNotification(client, {
    eventKey,
    type,
    actorUserId,
    meetingPublicKey: meeting.publicKey,
    requesterGuardianId: meeting.requesterGuardianId,
    includeParent,
    participantStaffMemberIds: participantOverride ?? meeting.participants?.filter((participant: any) => participant.status !== "REMOVED").map((participant: any) => participant.staffMemberId) ?? [],
    leadershipRecipients
  });
}

function listFilters(row: Record<string, unknown>) {
  return {
    status: row.status ? oneOf(row.status, PARENT_MEETING_STATUSES, "Status") : null,
    category: row.category ? oneOf(row.category, PARENT_MEETING_CATEGORIES, "Category") : null,
    search: optionalText(row.search, 120, "Search"),
    from: row.from ? zonedDate(row.from, "From date") : null,
    to: row.to ? zonedDate(row.to, "To date") : null,
    offset: row.offset == null ? 0 : boundedInteger(row.offset, 0, 100_000, "Offset"),
    limit: row.limit == null ? 50 : boundedInteger(row.limit, 1, 100, "Limit")
  };
}

function preferenceWindows(value: unknown) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 3) throw new ParentMeetingError("Provide at most three preferred meeting windows.");
  return value.map((item, index) => {
    const row = object(item);
    const startsAt = zonedDate(row.startsAt, `Preference ${index + 1} start`);
    const endsAt = zonedDate(row.endsAt, `Preference ${index + 1} end`);
    if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 4 * 60 * 60_000) throw new ParentMeetingError(`Preference ${index + 1} must end after it starts and stay within four hours.`);
    if (startsAt <= new Date()) throw new ParentMeetingError(`Preference ${index + 1} must be in the future.`);
    return { sequence: index + 1, startsAt, endsAt };
  });
}

function activeKey(guardianId: string, studentId: string, category: Category) { return `${guardianId}:${studentId}:${category}`; }
function object(value: unknown, allowEmpty = false) { if ((value == null && allowEmpty)) return {}; if (!value || typeof value !== "object" || Array.isArray(value)) throw new ParentMeetingError("A valid request object is required."); return value as Record<string, unknown>; }
function boundedText(value: unknown, minimum: number, maximum: number, label: string, preserveWhitespace = false) { let result = String(value ?? "").trim(); if (!preserveWhitespace) result = result.replace(/\s+/g, " "); if (result.length < minimum || result.length > maximum) throw new ParentMeetingError(`${label} must be ${minimum}-${maximum} characters.`); return result; }
function optionalText(value: unknown, maximum: number, label: string) { const result = String(value ?? "").trim(); if (!result) return null; if (result.length > maximum) throw new ParentMeetingError(`${label} must be at most ${maximum} characters.`); return result; }
function oneOf<const T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] { const result = String(value ?? "").trim(); if (!allowed.includes(result as T[number])) throw new ParentMeetingError(`${label} is unsupported.`); return result as T[number]; }
function positiveInteger(value: unknown, label: string) { const result = Number(value); if (!Number.isSafeInteger(result) || result < 1) throw new ParentMeetingError(`${label} is invalid.`); return result; }
function optionalPositiveInteger(value: unknown, label: string) { if (value == null || value === "") return null; return positiveInteger(value, label); }
function boundedInteger(value: unknown, minimum: number, maximum: number, label: string) { const result = Number(value); if (!Number.isSafeInteger(result) || result < minimum || result > maximum) throw new ParentMeetingError(`${label} must be between ${minimum} and ${maximum}.`); return result; }
function zonedDate(value: unknown, label: string) { const text = String(value ?? "").trim(); const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(text); if (!match) throw new ParentMeetingError(`${label} must include an explicit time-zone offset.`); const [,year,month,day,hour,minute,second="0",,zone,,offsetHour="0",offsetMinute="0"] = match; if (!validCalendarParts(Number(year),Number(month),Number(day),Number(hour),Number(minute),Number(second)) || (zone !== "Z" && (Number(offsetHour) > 23 || Number(offsetMinute) > 59))) throw new ParentMeetingError(`${label} is invalid.`); const result = new Date(text); if (Number.isNaN(result.getTime())) throw new ParentMeetingError(`${label} is invalid.`); return result; }
function indiaDueDate(value: unknown) { const text = String(value ?? "").trim(); const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text); if (!match || !validCalendarParts(Number(match[1]),Number(match[2]),Number(match[3]),0,0,0)) throw new ParentMeetingError("Follow-up due date is invalid."); const date = new Date(`${text}T23:59:59.999+05:30`); if (date < new Date()) throw new ParentMeetingError("Follow-up due date cannot be in the past."); return date; }
function validCalendarParts(year: number, month: number, day: number, hour: number, minute: number, second: number) { if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return false; return day <= new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function safeKey(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9_-]{20,100}$/.test(result)) throw new ParentMeetingError(`${label} is unavailable.`, 404, "PARENT_MEETING_UNAVAILABLE"); return result; }
function safeHandle(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9_-]{20,100}$/.test(result)) throw new ParentMeetingError(`${label} is invalid.`); return result; }
function safeHandleList(value: unknown, label: string, minimum: number, maximum: number) { if (!Array.isArray(value)) throw new ParentMeetingError(`${label} must be a list.`); const result = [...new Set(value.map((item) => safeHandle(item, label)))]; if (result.length < minimum || result.length > maximum) throw new ParentMeetingError(`${label} must contain ${minimum}-${maximum} authorised staff members.`); return result; }
function safeOnlineReference(value: unknown) { const result = boundedText(value, 2, 160, "Online meeting reference"); if (/^(?:javascript|data|vbscript):/i.test(result) || /<|>|\r|\n/.test(result) || /^https?:\/\//i.test(result)) throw new ParentMeetingError("Store a plain approved online reference, not a clickable URL."); return result; }
function requireRole(actor: ParentMeetingActor, roles: Role[]) { if (!roles.includes(actor.user.role)) throw unavailable(); }
function requireManager(actor: ParentMeetingActor) { requireRole(actor, ["SUPER_ADMIN", "PRINCIPAL"]); }
function unavailable() { return new ParentMeetingError("The requested Parent meeting record is unavailable.", 404, "PARENT_MEETING_UNAVAILABLE"); }
function changed(message = "The record changed; refresh and try again.") { return new ParentMeetingError(message, 409, "PARENT_MEETING_CONCURRENT_CHANGE"); }
function transitionError(status: string, action: string) { return new ParentMeetingError(`Action ${action} is unavailable from ${status}.`, 409, "PARENT_MEETING_TRANSITION_INVALID"); }
function persistenceError(error: unknown, duplicateMessage?: string, constraintConflict = false) {
  if (error instanceof ParentMeetingError) return error;
  const text = error instanceof Error ? error.message : String(error);
  if (/PARENT_MEETING_(?:STAFF|GUARDIAN|LOCATION)_CONFLICT/.test(text)) return new ParentMeetingError("The proposed time overlaps an existing authorised participant, Parent, or location booking.", 409, "PARENT_MEETING_CONFLICT");
  // Prisma's SQLite adapter can collapse a trigger RAISE(ABORT) from the
  // schedule-conflict guards into P2003 without retaining the trigger text.
  // Every participant handle has already been resolved to an active Staff
  // record above, so a constraint failure inside this scheduling transaction
  // is handled as a fail-closed booking conflict instead of a 500 response.
  if (constraintConflict && /P2003|foreign key constraint/i.test(text)) return new ParentMeetingError("The proposed time overlaps an existing authorised participant, Parent, or location booking.", 409, "PARENT_MEETING_CONFLICT");
  if (/PARENT_MEETING_TRANSITION_INVALID/.test(text)) return transitionError("current state", "requested action");
  if (/P2002|unique constraint/i.test(text)) return new ParentMeetingError(duplicateMessage ?? "The same action was already recorded or the record changed concurrently.", 409, "PARENT_MEETING_DUPLICATE");
  return new ParentMeetingError("The Parent meeting request could not be completed safely.", 500, "PARENT_MEETING_INTERNAL_ERROR");
}
function csvCell(value: unknown) { let text = value == null ? "" : String(value); if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; }
function formatIndia(value: Date) { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short", hour12: true }).format(value); }
