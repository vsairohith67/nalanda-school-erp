import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import {
  cancelParentMeetingRequest,
  createLeadershipParentMeeting,
  createParentMeetingFollowUp,
  createParentMeetingRequest,
  exportParentMeetingReportCsv,
  listParentMeetingWorkspace,
  listParentOwnMeetings,
  processParentMeetingReminders,
  recordParentMeetingAttendance,
  recordParentMeetingNote,
  scheduleParentMeeting,
  transitionParentMeeting,
  transitionParentMeetingFollowUp,
  type ParentMeetingActor
} from "../lib/parent-meetings";
import { createBackupDocument } from "../lib/backup";
import { loadParentMeetingBackup, PARENT_MEETING_BACKUP_KEYS, restoreParentMeetingBackup, validateParentMeetingBackupRows } from "../lib/parent-meeting-backup";
import { emptyEntityResult } from "../lib/restore";
import { resolveActiveParentChildContext } from "../lib/iam/contexts";
import { assertSqliteCopyReady, assertSqliteSnapshotUnchanged, snapshotSqliteArtifacts } from "./sqlite-copy-safety";

const prefix = process.argv.find((value) => value.startsWith("--prefix="))?.slice(9).trim() || "PARENTMEETING15";
const keep = process.argv.includes("--keep");
const workspace = path.resolve(".");
const operationalInput = process.env.PARENT_MEETING_OPERATIONAL_DB?.trim();
const operational = operationalInput ? path.resolve(operationalInput) : "";
const root = path.resolve(workspace, "tmp", `${prefix.toLowerCase()}-copied-qa`);
const copied = path.join(root, "parent-meeting-copy.db");
const restored = path.join(root, "parent-meeting-restore.db");
const fresh = path.join(root, "parent-meeting-fresh.db");
const databaseUrl = (file: string) => `file:${file.replaceAll("\\", "/")}`;
const credential = `${prefix}-${randomBytes(12).toString("base64url")}Aa1!`;
const sessionSecret = randomBytes(48).toString("base64url");
let stage = "preflight";

type SeedRole = "SUPER_ADMIN"|"PRINCIPAL"|"DIRECTOR"|"ADMIN"|"ACCOUNTANT"|"COMPUTER_OPERATOR"|"TEACHER"|"PARENT"|"STUDENT"|"GATE_STAFF"|"VIEWER";
type SeedUser = { id: string; role: SeedRole; username: string; assignmentId: string; sessionId?: string; guardianId?: string };

function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
async function denied(work: () => Promise<unknown>, code: string) { try { await work(); } catch { return; } throw new Error(code); }
async function deniedWithCode(work: () => Promise<unknown>, expected: string, code: string) { try { await work(); } catch (error) { invariant(error instanceof Error && "code" in error && error.code === expected, `${code}_WRONG_ERROR`); return; } throw new Error(code); }
function checkedRoot() { const target = path.resolve(root), parent = path.resolve(workspace, "tmp"); invariant(target.startsWith(`${parent}${path.sep}`) && target.endsWith(`${prefix.toLowerCase()}-copied-qa`), `${prefix}_CLEANUP_SCOPE_REFUSED`); return target; }
function cleanup() { const target = checkedRoot(); if (existsSync(target)) rmSync(target, { recursive: true, force: true }); }
function migrate(file: string) { if (!existsSync(file)) writeFileSync(file, "", { flag: "wx" }); const prismaEntry = path.join(workspace, "node_modules", "prisma", "build", "index.js"); const run = spawnSync(process.execPath, [prismaEntry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: workspace, env: { ...process.env, DATABASE_URL: databaseUrl(file) }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true }); if (run.error || run.status !== 0) throw new Error(`${prefix}_MIGRATION_FAILED:${run.error?.message ?? `${run.stdout}\n${run.stderr}`}`); }
function actor(user: SeedUser): ParentMeetingActor { return { user: { id: user.id, name: `${prefix} ${user.role}`, role: user.role, guardianId: user.guardianId ?? null, roleAssignmentId: user.assignmentId }, sessionId: user.sessionId ?? `qa-${user.id}` } as ParentMeetingActor; }
function idMap(values: string[]) { return new Map(values.map((value) => [value, value])); }
function parentMeetingCampaignNumber(type: string, eventKey: string) { const fingerprint = createHash("sha256").update(`PARENTMEETING15|${type}|${eventKey}`).digest("hex").slice(0, 24).toUpperCase(); return `PARENTMEETING15-${type}-${fingerprint}`; }

async function seedBase(client: PrismaClient) {
  const passwordHash = await hashPassword(credential);
  const users = new Map<SeedRole | "TEACHER_B" | "PARENT_B" | "MARKS_ENTRY_OPERATOR", SeedUser>();
  const definitions: Array<{ key: SeedRole | "TEACHER_B" | "PARENT_B" | "MARKS_ENTRY_OPERATOR"; role: SeedRole }> = [
    {key:"SUPER_ADMIN",role:"SUPER_ADMIN"},{key:"PRINCIPAL",role:"PRINCIPAL"},{key:"DIRECTOR",role:"DIRECTOR"},{key:"ADMIN",role:"ADMIN"},{key:"ACCOUNTANT",role:"ACCOUNTANT"},{key:"COMPUTER_OPERATOR",role:"COMPUTER_OPERATOR"},{key:"TEACHER",role:"TEACHER"},{key:"TEACHER_B",role:"TEACHER"},{key:"PARENT",role:"PARENT"},{key:"PARENT_B",role:"PARENT"},{key:"STUDENT",role:"STUDENT"},{key:"GATE_STAFF",role:"GATE_STAFF"},{key:"VIEWER",role:"VIEWER"},{key:"MARKS_ENTRY_OPERATOR",role:"COMPUTER_OPERATOR"}
  ];
  for (const definition of definitions) {
    const id = randomUUID(), assignmentId = randomUUID();
    const username = `${prefix.toLowerCase()}-${String(definition.key).toLowerCase().replaceAll("_", "-")}-${randomBytes(3).toString("hex")}`;
    await client.user.create({ data: { id, iamPublicKey: randomUUID(), name: `${prefix} ${definition.key}`, username, passwordHash, role: definition.role, isActive: true, lifecycleStatus: "ACTIVE" } });
    await client.authLoginAlias.create({ data: { userId: id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
    await client.userRoleAssignment.create({ data: { id: assignmentId, publicKey: randomUUID(), userId: id, role: definition.role, status: "ACTIVE", reason: `${prefix} copied-database QA`, activeKey: `${id}:${definition.role}` } });
    users.set(definition.key, { id, role: definition.role, username, assignmentId });
  }
  const guardians = [];
  const students = [];
  const links = [];
  for (const suffix of ["A", "B"]) {
    const guardian = await client.guardian.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), displayName: `${prefix} Guardian ${suffix}`, primaryMobile: `${suffix === "A" ? "91" : "92"}${randomBytes(4).readUInt32BE().toString().padStart(10, "0").slice(-10)}`, status: "Active" } });
    const student = await client.student.create({ data: { id: randomUUID(), admissionNo: `${prefix}-STUDENT-${suffix}`, studentName: `${prefix} Synthetic Child ${suffix}`, fatherName: "Synthetic Parent", className: "7", section: suffix, phone1: "9000000000", academicYear: "2026-27" } });
    await client.academicYearEnrollment.create({ data: { id: randomUUID(), studentId: student.id, academicYear: "2026-27", className: "7", section: suffix, rollNo: suffix === "A" ? "1" : "2", status: "ACTIVE" } });
    const link = await client.studentGuardian.create({ data: { id: randomUUID(), guardianId: guardian.id, studentId: student.id, isPrimaryContact: true } });
    guardians.push(guardian); students.push(student); links.push(link);
  }
  for (const [key, index] of [["PARENT",0],["PARENT_B",1]] as const) {
    const user = users.get(key)!;
    const sessionId = randomUUID();
    await client.user.update({ where: { id: user.id }, data: { guardianId: guardians[index].id } });
    await client.authSession.create({ data: { id: sessionId, userId: user.id, tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"), credentialVersion: 1, authorizationVersion: 1, activeRoleAssignmentId: user.assignmentId, activeChildLinkId: links[index].id, contextVersion: 1, expiresAt: new Date("2027-08-22T00:00:00Z"), deviceSummary: "Synthetic QA", browserSummary: "Synthetic QA", networkEvidenceMasked: "local" } });
    user.sessionId = sessionId; user.guardianId = guardians[index].id;
  }
  const staff = new Map<string, any>();
  for (const [key, label, type] of [["PRINCIPAL","Principal","NON_TEACHING"],["TEACHER","Teacher A","TEACHING"],["TEACHER_B","Teacher B","TEACHING"]] as const) {
    const user = users.get(key)!;
    staff.set(key, await client.staffMember.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), staffCode: `${prefix}-${key}`, fullName: `${prefix} ${label}`, displayName: `${label}`, staffType: type, designation: label, status: "ACTIVE", userId: user.id } }));
  }
  return { users, guardians, students, links, staff };
}

async function main() {
  cleanup();
  if (!operational) throw new Error(`${prefix}_OPERATIONAL_DB_PATH_REQUIRED`);
  assertSqliteCopyReady(operational, `${prefix}_OPERATIONAL`);
  const operationalBefore = snapshotSqliteArtifacts(operational);
  mkdirSync(root, { recursive: true });
  stage = "fresh and existing migration";
  migrate(fresh); migrate(fresh);
  copyFileSync(operational, copied); migrate(copied); migrate(copied);
  const baseClient = new PrismaClient({ datasourceUrl: databaseUrl(copied) });
  const base = await seedBase(baseClient);
  await baseClient.$disconnect();
  assertSqliteCopyReady(copied, `${prefix}_COPIED_BASE`);
  copyFileSync(copied, restored);
  delete process.env.PARENT_MEETINGS_V1_5;
  process.env.SESSION_SECRET = sessionSecret;
  const client = new PrismaClient({ datasourceUrl: databaseUrl(copied) });
  const restoreClient = new PrismaClient({ datasourceUrl: databaseUrl(restored) });
  const principal = actor(base.users.get("PRINCIPAL")!), teacherA = actor(base.users.get("TEACHER")!), teacherB = actor(base.users.get("TEACHER_B")!), parentA = actor(base.users.get("PARENT")!), parentB = actor(base.users.get("PARENT_B")!);
  try {
    stage = "default-off and role denial";
    await denied(() => listParentMeetingWorkspace(client, principal), `${prefix}_FEATURE_DEFAULT_ON`);
    process.env.PARENT_MEETINGS_V1_5 = "true";
    for (const role of ["ADMIN","ACCOUNTANT","COMPUTER_OPERATOR","STUDENT","GATE_STAFF","VIEWER","MARKS_ENTRY_OPERATOR"] as const) await denied(() => listParentMeetingWorkspace(client, actor(base.users.get(role)!)), `${prefix}_${role}_BROAD_ACCESS`);

    stage = "parent linkage and validation";
    await resolveActiveParentChildContext(client, { userId: parentA.user.id, sessionId: parentA.sessionId, roleAssignmentId: parentA.user.roleAssignmentId, academicYear: "2026-27", expectedContextVersion: 1 });
    const parentRequest = await createParentMeetingRequest(client, parentA, { academicYear: "2026-27", category: "ACADEMIC_PROGRESS", subject: "Progress discussion", requestReason: "Unicode తెలుగు हिन्दी اردو and <script>alert(1)</script>", preferences: [{ startsAt: "2026-09-10T10:00:00+05:30", endsAt: "2026-09-10T10:30:00+05:30" }] });
    const ownA = await listParentOwnMeetings(client, parentA, { academicYear: "2026-27" });
    const ownB = await listParentOwnMeetings(client, parentB, { academicYear: "2026-27" });
    invariant(ownA.meetings.length === 1 && ownB.meetings.length === 0, `${prefix}_PARENT_LINKAGE_LIST_FAILED`);
    await denied(() => createParentMeetingRequest(client, parentA, { academicYear: "2026-27", childHandle: ownB.context.childHandle, category: "OTHER", subject: "Cross child", requestReason: "Must be denied" }), `${prefix}_CROSS_CHILD_HANDLE_ACCEPTED`);
    await denied(() => createParentMeetingRequest(client, parentA, { academicYear: "2026-27", category: "ACADEMIC_PROGRESS", subject: "Duplicate request", requestReason: "Duplicate active request" }), `${prefix}_DUPLICATE_REQUEST_ACCEPTED`);
    await denied(() => createParentMeetingRequest(client, parentA, { academicYear: "2026-27", category: "OTHER", subject: "x", requestReason: "" }), `${prefix}_EMPTY_VALIDATION_ACCEPTED`);
    await denied(() => scheduleParentMeeting(client, principal, parentRequest.publicKey, { expectedRowVersion: parentRequest.rowVersion, scheduledStartAt: "2027-02-29T10:00:00+05:30", durationMinutes: 30, mode: "PHONE", primaryStaffHandle: base.staff.get("TEACHER").iamPublicKey, participantStaffHandles: [base.staff.get("TEACHER").iamPublicKey] }), `${prefix}_INVALID_LEAP_DAY_ACCEPTED`);
    const staleLinkRequest = await createParentMeetingRequest(client, parentB, { academicYear: "2026-27", category: "ADMINISTRATIVE", subject: "Stale linkage guard", requestReason: "Synthetic cancellation linkage test" });
    await client.guardian.update({ where: { id: base.guardians[1].id }, data: { status: "Inactive" } });
    await deniedWithCode(() => cancelParentMeetingRequest(client, parentB, staleLinkRequest.publicKey, { expectedRowVersion: staleLinkRequest.rowVersion, reason: "Must not use stale authority" }), "PARENT_MEETING_UNAVAILABLE", `${prefix}_STALE_PARENT_LINK_CANCEL_ACCEPTED`);
    await client.guardian.update({ where: { id: base.guardians[1].id }, data: { status: "Active" } });
    await cancelParentMeetingRequest(client, parentB, staleLinkRequest.publicKey, { expectedRowVersion: staleLinkRequest.rowVersion, reason: "Synthetic linkage test complete" });

    stage = "schedule, teacher scope and privacy";
    const scheduled = await scheduleParentMeeting(client, principal, parentRequest.publicKey, { expectedRowVersion: parentRequest.rowVersion, scheduledStartAt: "2026-09-10T10:00:00+05:30", durationMinutes: 30, mode: "IN_PERSON", locationReference: "Principal Office", onlineReference: "", primaryStaffHandle: base.staff.get("TEACHER").iamPublicKey, participantStaffHandles: [base.staff.get("TEACHER").iamPublicKey, base.staff.get("PRINCIPAL").iamPublicKey] });
    invariant((await listParentMeetingWorkspace(client, teacherA)).meetings.length === 1, `${prefix}_ASSIGNED_TEACHER_MISSING`);
    invariant((await listParentMeetingWorkspace(client, teacherB)).meetings.length === 0, `${prefix}_UNASSIGNED_TEACHER_VISIBLE`);
    await recordParentMeetingNote(client, principal, scheduled.publicKey, { kind: "LEADERSHIP_PRIVATE", body: "LEADERSHIP-PRIVATE-<img onerror=alert(1)>" });
    const leadershipParticipantNote = await recordParentMeetingNote(client, principal, scheduled.publicKey, { kind: "PARTICIPANT_INTERNAL", body: "PARTICIPANT-INTERNAL-<svg onload=alert(1)>" });
    const teacherContribution = await recordParentMeetingNote(client, teacherA, scheduled.publicKey, { kind: "PARTICIPANT_INTERNAL", body: "TEACHER-CONTRIBUTION-' OR 1=1 --" });
    await denied(() => recordParentMeetingNote(client, teacherA, scheduled.publicKey, { kind: "PARTICIPANT_INTERNAL", body: "Cross-author correction denied", correctsNoteKey: leadershipParticipantNote.publicKey, correctionReason: "Not my note" }), `${prefix}_TEACHER_CROSS_AUTHOR_CORRECTION`);
    await recordParentMeetingNote(client, teacherA, scheduled.publicKey, { kind: "PARTICIPANT_INTERNAL", body: "Corrected own Teacher contribution", correctsNoteKey: teacherContribution.publicKey, correctionReason: "Corrected wording" });
    await denied(() => recordParentMeetingNote(client, teacherA, scheduled.publicKey, { kind: "LEADERSHIP_PRIVATE", body: "Teacher escalation" }), `${prefix}_TEACHER_LEADERSHIP_NOTE`);
    await denied(() => recordParentMeetingNote(client, teacherB, scheduled.publicKey, { kind: "PARTICIPANT_INTERNAL", body: "Unassigned" }), `${prefix}_UNASSIGNED_TEACHER_NOTE`);
    const teacherPayload = JSON.stringify(await listParentMeetingWorkspace(client, teacherA));
    invariant(!teacherPayload.includes("LEADERSHIP-PRIVATE") && teacherPayload.includes("PARTICIPANT-INTERNAL"), `${prefix}_TEACHER_NOTE_VISIBILITY_FAILED`);
    const parentPayloadBefore = JSON.stringify(await listParentOwnMeetings(client, parentA, { academicYear: "2026-27" }));
    invariant(!parentPayloadBefore.includes("LEADERSHIP-PRIVATE") && !parentPayloadBefore.includes("PARTICIPANT-INTERNAL") && !parentPayloadBefore.includes("staffHandle"), `${prefix}_PARENT_PRIVATE_PAYLOAD_LEAK`);
    await denied(() => recordParentMeetingAttendance(client, teacherA, scheduled.publicKey, { status: "ATTENDED", expectedRowVersion: 1 }), `${prefix}_EARLY_ATTENDANCE_ACCEPTED`);

    stage = "conflicts and concurrency";
    const conflict = await createLeadershipParentMeeting(client, principal, { academicYear: "2026-27", studentAdmissionNo: base.students[1].admissionNo, category: "ATTENDANCE", subject: "Conflict check", requestReason: "Synthetic" });
    await deniedWithCode(() => scheduleParentMeeting(client, principal, conflict.publicKey, { expectedRowVersion: conflict.rowVersion, scheduledStartAt: "2026-09-10T10:10:00+05:30", durationMinutes: 30, mode: "PHONE", locationReference: "", primaryStaffHandle: base.staff.get("TEACHER").iamPublicKey, participantStaffHandles: [base.staff.get("TEACHER").iamPublicKey] }), "PARENT_MEETING_CONFLICT", `${prefix}_STAFF_CONFLICT_ACCEPTED`);
    await deniedWithCode(() => scheduleParentMeeting(client, principal, conflict.publicKey, { expectedRowVersion: conflict.rowVersion, scheduledStartAt: "2026-09-10T10:10:00+05:30", durationMinutes: 30, mode: "IN_PERSON", locationReference: "Principal Office", primaryStaffHandle: base.staff.get("TEACHER_B").iamPublicKey, participantStaffHandles: [base.staff.get("TEACHER_B").iamPublicKey] }), "PARENT_MEETING_CONFLICT", `${prefix}_LOCATION_CONFLICT_ACCEPTED`);
    const guardianConflict = await createLeadershipParentMeeting(client, principal, { academicYear: "2026-27", studentAdmissionNo: base.students[0].admissionNo, category: "ATTENDANCE", subject: "Guardian overlap", requestReason: "Synthetic" });
    await deniedWithCode(() => scheduleParentMeeting(client, principal, guardianConflict.publicKey, { expectedRowVersion: guardianConflict.rowVersion, scheduledStartAt: "2026-09-10T10:10:00+05:30", durationMinutes: 30, mode: "PHONE", primaryStaffHandle: base.staff.get("TEACHER_B").iamPublicKey, participantStaffHandles: [base.staff.get("TEACHER_B").iamPublicKey] }), "PARENT_MEETING_CONFLICT", `${prefix}_GUARDIAN_CONFLICT_ACCEPTED`);
    const concurrent = await createLeadershipParentMeeting(client, principal, { academicYear: "2026-27", studentAdmissionNo: base.students[1].admissionNo, category: "OTHER", subject: "Concurrent scheduling", requestReason: "Synthetic" });
    const attempts = await Promise.allSettled([
      scheduleParentMeeting(client, principal, concurrent.publicKey, { expectedRowVersion: 1, scheduledStartAt: "2026-09-11T10:00:00+05:30", durationMinutes: 30, mode: "PHONE", primaryStaffHandle: base.staff.get("TEACHER").iamPublicKey, participantStaffHandles: [base.staff.get("TEACHER").iamPublicKey] }),
      (async () => { await new Promise((resolve) => setTimeout(resolve, 20)); return scheduleParentMeeting(client, principal, concurrent.publicKey, { expectedRowVersion: 1, scheduledStartAt: "2026-09-11T11:00:00+05:30", durationMinutes: 30, mode: "PHONE", primaryStaffHandle: base.staff.get("TEACHER_B").iamPublicKey, participantStaffHandles: [base.staff.get("TEACHER_B").iamPublicKey] }); })()
    ]);
    invariant(attempts.filter((item) => item.status === "fulfilled").length === 1, `${prefix}_SCHEDULE_CONCURRENCY_NONDETERMINISTIC`);

    stage = "completion, summary and follow-up";
    await client.parentMeeting.update({ where: { publicKey: scheduled.publicKey }, data: { scheduledStartAt: new Date("2026-08-21T10:00:00+05:30"), scheduledEndAt: new Date("2026-08-21T10:30:00+05:30") } });
    await recordParentMeetingAttendance(client, teacherA, scheduled.publicKey, { status: "ATTENDED", expectedRowVersion: 1 });
    await denied(() => recordParentMeetingAttendance(client, teacherB, scheduled.publicKey, { status: "ATTENDED", expectedRowVersion: 1 }), `${prefix}_UNASSIGNED_ATTENDANCE`);
    const current = await client.parentMeeting.findUniqueOrThrow({ where: { publicKey: scheduled.publicKey } });
    const terminal = await Promise.allSettled([
      transitionParentMeeting(client, principal, scheduled.publicKey, { action: "COMPLETE", expectedRowVersion: current.rowVersion, followUpRequired: true }),
      (async () => { await new Promise((resolve) => setTimeout(resolve, 20)); return transitionParentMeeting(client, principal, scheduled.publicKey, { action: "CANCEL", expectedRowVersion: current.rowVersion, internalReason: "Concurrent cancellation" }); })()
    ]);
    invariant(terminal.filter((item) => item.status === "fulfilled").length === 1, `${prefix}_TERMINAL_CONCURRENCY_NONDETERMINISTIC`);
    const terminalMeeting = await client.parentMeeting.findUniqueOrThrow({ where: { publicKey: scheduled.publicKey } });
    invariant(["COMPLETED","CANCELLED"].includes(terminalMeeting.status), `${prefix}_TERMINAL_STATE_INVALID`);
    if (terminalMeeting.status !== "COMPLETED") throw new Error(`${prefix}_CONCURRENCY_CANCEL_WON_RETRY_REQUIRED`);
    const summary = await recordParentMeetingNote(client, principal, scheduled.publicKey, { kind: "PARENT_VISIBLE_SUMMARY", body: "Parent-safe summary <script>alert(1)</script>" });
    await denied(() => recordParentMeetingNote(client, principal, scheduled.publicKey, { kind: "PARENT_VISIBLE_SUMMARY", body: "Unlinked replacement summary" }), `${prefix}_UNLINKED_SUMMARY_REPLACEMENT`);
    await recordParentMeetingNote(client, principal, scheduled.publicKey, { kind: "PARENT_VISIBLE_SUMMARY", body: "Corrected Parent-safe summary", correctsNoteKey: summary.publicKey, correctionReason: "Corrected wording" });
    const followUp = await createParentMeetingFollowUp(client, principal, scheduled.publicKey, { internalDescription: "Internal follow-up <img onerror=alert(1)>", parentVisibleDescription: "Please review the shared learning plan.", responsibleStaffHandle: base.staff.get("TEACHER").iamPublicKey, dueDate: "2026-09-15" });
    const followRace = await Promise.allSettled([
      transitionParentMeetingFollowUp(client, teacherA, followUp.publicKey, { action: "DONE", expectedRowVersion: 1 }),
      (async () => { await new Promise((resolve) => setTimeout(resolve, 20)); return transitionParentMeetingFollowUp(client, teacherA, followUp.publicKey, { action: "DONE", expectedRowVersion: 1 }); })()
    ]);
    invariant(followRace.filter((item) => item.status === "fulfilled").length === 1, `${prefix}_FOLLOWUP_CONCURRENCY_NONDETERMINISTIC`);
    const parentPayload = JSON.stringify(await listParentOwnMeetings(client, parentA, { academicYear: "2026-27" }));
    invariant(parentPayload.includes("Corrected Parent-safe summary") && parentPayload.includes("Please review the shared learning plan") && !parentPayload.includes("Internal follow-up") && !parentPayload.includes("LEADERSHIP-PRIVATE"), `${prefix}_PARENT_COMPLETED_PRIVACY_FAILED`);
    const privateFollowUp = await createParentMeetingFollowUp(client, principal, scheduled.publicKey, { internalDescription: "Private staff-only follow-up", responsibleStaffHandle: base.staff.get("TEACHER").iamPublicKey, dueDate: "2026-09-10" });
    const privateCreatedEvent = await client.parentMeetingEvent.findFirst({ where: { meetingId: privateFollowUp.meetingId, eventType: "FOLLOW_UP_CREATED", safeMetadataJson: { contains: privateFollowUp.publicKey } }, orderBy: { createdAt: "desc" } });
    invariant(privateCreatedEvent, `${prefix}_PRIVATE_FOLLOWUP_EVENT_MISSING`);
    const privateCreatedNumber = parentMeetingCampaignNumber("FOLLOW_UP_CREATED", privateCreatedEvent.publicKey);
    const privateCreatedCampaign = await client.notificationCampaign.findUnique({ where: { campaignNumber: privateCreatedNumber } });
    invariant(privateCreatedCampaign, `${prefix}_PRIVATE_FOLLOWUP_CAMPAIGN_MISSING`);
    const privateCreatedRecipients = await client.notificationRecipient.findMany({ where: { campaignId: privateCreatedCampaign.id }, select: { userId: true } });
    invariant(privateCreatedRecipients.some((row) => row.userId === base.users.get("TEACHER")!.id) && privateCreatedRecipients.every((row) => row.userId !== base.users.get("PARENT")!.id), `${prefix}_PRIVATE_FOLLOWUP_PARENT_NOTIFIED`);

    stage = "notifications, CSV and scale";
    const beforeReminder = await client.notificationCampaign.count({ where: { campaignNumber: { startsWith: "PARENTMEETING15-" } } });
    await processParentMeetingReminders(client, principal, new Date("2026-09-10T00:00:00+05:30"));
    const middleReminder = await client.notificationCampaign.count({ where: { campaignNumber: { startsWith: "PARENTMEETING15-" } } });
    await processParentMeetingReminders(client, principal, new Date("2026-09-10T00:00:00+05:30"));
    const afterReminder = await client.notificationCampaign.count({ where: { campaignNumber: { startsWith: "PARENTMEETING15-" } } });
    invariant(middleReminder >= beforeReminder && middleReminder === afterReminder, `${prefix}_REMINDER_NOT_IDEMPOTENT`);
    const privateDueNumber = parentMeetingCampaignNumber("FOLLOW_UP_DUE", `FOLLOWUP:${privateFollowUp.publicKey}:2026-09-10`);
    const privateDueCampaign = await client.notificationCampaign.findUnique({ where: { campaignNumber: privateDueNumber } });
    invariant(privateDueCampaign, `${prefix}_PRIVATE_FOLLOWUP_DUE_CAMPAIGN_MISSING`);
    const privateDueRecipients = await client.notificationRecipient.findMany({ where: { campaignId: privateDueCampaign.id }, select: { userId: true } });
    invariant(privateDueRecipients.some((row) => row.userId === base.users.get("TEACHER")!.id) && privateDueRecipients.every((row) => row.userId !== base.users.get("PARENT")!.id), `${prefix}_PRIVATE_FOLLOWUP_DUE_PARENT_NOTIFIED`);
    const unrelatedIds = [base.users.get("PARENT_B")!.id, base.users.get("TEACHER_B")!.id];
    const unrelatedRecipients = await client.notificationRecipient.count({ where: { campaign: { campaignNumber: { startsWith: "PARENTMEETING15-" } }, userId: { in: unrelatedIds }, recipientContextJson: { contains: scheduled.publicKey } } });
    invariant(unrelatedRecipients === 0, `${prefix}_UNRELATED_NOTIFICATION_RECIPIENT`);
    await createLeadershipParentMeeting(client, principal, { academicYear: "2026-27", studentAdmissionNo: base.students[1].admissionNo, category: "PRINCIPAL_APPOINTMENT", subject: "=HYPERLINK(\"https://invalid\")", requestReason: "CSV formula injection proof" });
    const csv = await exportParentMeetingReportCsv(client, principal);
    invariant(csv.includes("\"'=HYPERLINK") && !csv.includes("internal follow-up"), `${prefix}_CSV_SAFETY_FAILED`);
    invariant(privateFollowUp.status === "OPEN", `${prefix}_PRIVATE_FOLLOWUP_STATE_INVALID`);
    const bulk = Array.from({ length: 1_010 }, (_, index) => ({ id: randomUUID(), publicKey: randomUUID(), studentId: base.students[index % 2].id, requesterGuardianId: base.guardians[index % 2].id, academicYear: "2026-27", source: "LEADERSHIP_CREATED", category: index % 2 ? "OTHER" : "GENERAL_SCHOOL_DISCUSSION", subject: `${prefix} historical meeting ${index}`, requestReason: "Synthetic scale record", status: "COMPLETED", createdByUserId: principal.user.id, completedByUserId: principal.user.id, completedAt: new Date(Date.UTC(2025, index % 12, (index % 27) + 1)), rowVersion: 1, createdAt: new Date(Date.UTC(2025, index % 12, (index % 27) + 1)), updatedAt: new Date(Date.UTC(2025, index % 12, (index % 27) + 1)) }));
    await client.parentMeeting.createMany({ data: bulk });
    const timings: number[] = [];
    for (let index = 0; index < 8; index++) { const started = performance.now(); const page = await listParentMeetingWorkspace(client, principal, { status: "COMPLETED", limit: 50, offset: index * 50 }); invariant(page.meetings.length <= 50 && page.pagination.total >= 1_010, `${prefix}_SCALE_PAGINATION_FAILED`); timings.push(performance.now() - started); }
    const p95 = [...timings].sort((a,b) => a-b)[Math.ceil(timings.length * .95) - 1];
    invariant(p95 < 2_000, `${prefix}_SCALE_P95_EXCEEDED_${p95.toFixed(1)}`);

    stage = "backup restore and immutable evidence";
    const meetingBackup = validateParentMeetingBackupRows(await loadParentMeetingBackup(client) as unknown as Record<string, unknown>);
    const logical = createBackupDocument({ generatedAt: new Date(), generatedBy: `${prefix} copied QA`, students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], ...meetingBackup });
    invariant(logical.metadata.backupVersion === 43 && logical.parentMeetings.length >= 1_015 && logical.parentMeetingNotes.length >= 5, `${prefix}_LOGICAL_BACKUP_INVALID`);
    const restoreResult = { ...Object.fromEntries(PARENT_MEETING_BACKUP_KEYS.map((key) => [key, emptyEntityResult()])), warnings: [] } as any;
    await restoreParentMeetingBackup(restoreClient, meetingBackup, { students: idMap(base.students.map((row) => row.id)), guardians: idMap(base.guardians.map((row) => row.id)), staffMembers: idMap([...base.staff.values()].map((row) => row.id)), users: idMap([...base.users.values()].map((row) => row.id)), restoredBy: principal.user.id }, restoreResult);
    invariant(PARENT_MEETING_BACKUP_KEYS.every((key) => restoreResult[key].errors.length === 0), `${prefix}_RESTORE_ERRORS`);
    const createdMeetings = restoreResult.parentMeetings.created;
    await restoreParentMeetingBackup(restoreClient, meetingBackup, { students: idMap(base.students.map((row) => row.id)), guardians: idMap(base.guardians.map((row) => row.id)), staffMembers: idMap([...base.staff.values()].map((row) => row.id)), users: idMap([...base.users.values()].map((row) => row.id)), restoredBy: principal.user.id }, restoreResult);
    invariant(createdMeetings === meetingBackup.parentMeetings.length && restoreResult.parentMeetings.skipped === meetingBackup.parentMeetings.length, `${prefix}_RESTORE_NOT_IDEMPOTENT`);
    await denied(() => client.parentMeetingNote.updateMany({ data: { body: "destructive rewrite" } }), `${prefix}_NOTE_UPDATE_ALLOWED`);
    await denied(() => client.parentMeetingEvent.deleteMany({}), `${prefix}_EVENT_DELETE_ALLOWED`);
    await denied(() => client.parentMeeting.delete({ where: { publicKey: scheduled.publicKey } }), `${prefix}_MEETING_DELETE_ALLOWED`);
    const fk = await client.$queryRawUnsafe<Array<{ foreign_key_check: string }>>("PRAGMA foreign_key_check");
    invariant(fk.length === 0, `${prefix}_FOREIGN_KEY_FAILURE`);

    const browserPast = await client.parentMeeting.create({ data: { id: randomUUID(), publicKey: randomUUID(), studentId: base.students[0].id, requesterGuardianId: base.guardians[0].id, requesterUserId: base.users.get("PARENT")!.id, createdByUserId: principal.user.id, scheduledByUserId: principal.user.id, academicYear: "2026-27", source: "LEADERSHIP_CREATED", category: "GENERAL_SCHOOL_DISCUSSION", subject: "Browser completion fixture", requestReason: "Synthetic browser workflow", status: "SCHEDULED", scheduledStartAt: new Date("2026-08-21T09:00:00+05:30"), scheduledEndAt: new Date("2026-08-21T09:30:00+05:30"), durationMinutes: 30, mode: "PHONE" } });
    await client.parentMeetingParticipant.create({ data: { meetingId: browserPast.id, staffMemberId: base.staff.get("TEACHER").id, participantRole: "PRIMARY_STAFF", assignedByUserId: principal.user.id } });
    const browserNoShow = await client.parentMeeting.create({ data: { id: randomUUID(), publicKey: randomUUID(), studentId: base.students[1].id, requesterGuardianId: base.guardians[1].id, requesterUserId: base.users.get("PARENT_B")!.id, createdByUserId: principal.user.id, scheduledByUserId: principal.user.id, academicYear: "2026-27", source: "LEADERSHIP_CREATED", category: "OTHER", subject: "Browser no-show fixture", requestReason: "Synthetic browser no-show workflow", status: "SCHEDULED", scheduledStartAt: new Date("2026-08-21T08:00:00+05:30"), scheduledEndAt: new Date("2026-08-21T08:30:00+05:30"), durationMinutes: 30, mode: "PHONE" } });
    await client.parentMeetingParticipant.create({ data: { meetingId: browserNoShow.id, staffMemberId: base.staff.get("TEACHER_B").id, participantRole: "PRIMARY_STAFF", assignedByUserId: principal.user.id } });
    const boundedLeadershipList = await listParentMeetingWorkspace(client, principal, { limit: 50 });
    invariant([browserPast.publicKey, browserNoShow.publicKey].every((publicKey) => boundedLeadershipList.meetings.some((meeting: { publicKey: string }) => meeting.publicKey === publicKey)), `${prefix}_ACTIVE_MEETING_CROWDED_OUT_BY_HISTORY`);

    if (keep) writeFileSync(path.join(root, "browser-runtime.json"), JSON.stringify({ databaseUrl: databaseUrl(copied), sessionSecret, flag: "true", password: credential, usernames: { principal: base.users.get("PRINCIPAL")!.username, superAdmin: base.users.get("SUPER_ADMIN")!.username, parentA: base.users.get("PARENT")!.username, parentB: base.users.get("PARENT_B")!.username, teacherA: base.users.get("TEACHER")!.username, teacherB: base.users.get("TEACHER_B")!.username }, meetingKeys: { scheduled: browserPast.publicKey, noShow: browserNoShow.publicKey, completed: scheduled.publicKey } }, null, 2), { flag: "wx" });
    const evidence = { result: `${prefix}_COPIED_DB_QA_PASSED`, migration: "20260822170000_parent_meetings_v1_5", backupVersion: 43, operationalSha256: operationalBefore[0]?.hash, parentLinkage: "A_ONLY_A1_B_ONLY_B1", teacherScope: "EXPLICIT_PARTICIPANT_ONLY", notifications: "IN_APP_IDEMPOTENT", scaleMeetings: bulk.length, p95Ms: Number(p95.toFixed(1)), featureFlag: "DEFAULT_OFF", kept: keep, ...(keep ? { runtimePath: path.join(root, "browser-runtime.json") } : {}) };
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await client.$disconnect(); await restoreClient.$disconnect(); delete process.env.PARENT_MEETINGS_V1_5; delete process.env.SESSION_SECRET;
  }
  const operationalAfter = snapshotSqliteArtifacts(operational);
  assertSqliteSnapshotUnchanged(operationalBefore, operationalAfter, `${prefix}_OPERATIONAL_DB_CHANGED`);
  if (!keep) { cleanup(); invariant(!existsSync(root), `${prefix}_QA_RESIDUE_REMAINS`); }
}

if (process.argv.includes("cleanup")) { cleanup(); console.log(JSON.stringify({ result: `${prefix}_QA_FIXTURES_REMOVED`, exists: existsSync(root) })); }
else main().catch((error) => { console.error(`${stage}: ${error instanceof Error ? error.message : String(error)}`); try { cleanup(); } catch { /* preserve primary failure */ } process.exitCode = 1; });
