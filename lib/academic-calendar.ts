import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { attendanceDateBelongsToAcademicYear } from "@/lib/teacher-attendance-scope";
import { ParentChildContextError, resolveActiveParentChildContext } from "@/lib/iam/contexts";

export const CALENDAR_STATUSES = ["DRAFT", "READY_FOR_REVIEW", "PUBLISHED", "REPLACED", "WITHDRAWN", "ARCHIVED"] as const;
export const OPERATIONAL_DAY_TYPES = ["WORKING_DAY", "NON_WORKING_DAY", "HALF_DAY", "VACATION_DAY", "SPECIAL_WORKING_DAY", "EMERGENCY_CLOSURE"] as const;
export const OPERATIONAL_DAY_SOURCES = ["MANUAL", "HOLIDAY", "VACATION", "SPECIAL_WORKING", "HALF_DAY", "EMERGENCY_CLOSURE"] as const;
export const CALENDAR_SCOPES = ["SCHOOL_WIDE", "CLASS", "CLASS_SECTION"] as const;
export const SCHOOL_EVENT_TYPES = ["SCHOOL_FUNCTION", "PARENT_MEETING", "ACTIVITY", "COMPETITION", "ACADEMIC_DEADLINE", "STAFF_MEETING", "EXAMINATION_REFERENCE", "CLASS_EVENT", "OTHER"] as const;
export const SCHOOL_EVENT_AUDIENCES = ["SCHOOL_WIDE", "STAFF_ONLY", "PARENTS_ALL", "ROLE_SPECIFIC", "CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT", "LEADERSHIP_ONLY"] as const;

export const CALENDAR_TITLE_MAX = 160;
export const CALENDAR_DESCRIPTION_MAX = 2_000;
export const CALENDAR_INSTRUCTIONS_MAX = 1_500;
export const CALENDAR_NOTES_MAX = 1_500;
export const CALENDAR_REASON_MAX = 1_000;
export const CALENDAR_MAX_DAYS_PER_VERSION = 800;
export const CALENDAR_MAX_QUERY_DAYS = 400;

type CalendarStatus = (typeof CALENDAR_STATUSES)[number];
type OperationalDayType = (typeof OPERATIONAL_DAY_TYPES)[number];
type OperationalDaySource = (typeof OPERATIONAL_DAY_SOURCES)[number];
type CalendarScope = (typeof CALENDAR_SCOPES)[number];
type EventAudience = (typeof SCHOOL_EVENT_AUDIENCES)[number];
type CalendarClient = any;

export type CalendarActor = Pick<AuthUser, "id" | "name" | "role" | "roleAssignmentId"> & {
  sessionId?: string;
};

export class AcademicCalendarError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "CALENDAR_INVALID") {
    super(message);
    this.name = "AcademicCalendarError";
    this.status = status;
    this.code = code;
  }
}

export type NormalizedOperationalDay = {
  dayDate: Date;
  dayType: OperationalDayType;
  sourceType: OperationalDaySource;
  scopeType: CalendarScope;
  className: string | null;
  section: string | null;
  scopeKey: string;
  title: string;
  halfDaySession: string | null;
  publicInstructions: string | null;
  reason: string | null;
  contentHash: string;
};

export type NormalizedSchoolEvent = {
  eventType: (typeof SCHOOL_EVENT_TYPES)[number];
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  venue: string | null;
  parentInstructions: string | null;
  internalNotes: string | null;
  audienceType: EventAudience;
  roleScope: string | null;
  classSectionId: string | null;
  className: string | null;
  section: string | null;
  audienceKey: string;
  examinationTimetableVersionId: string | null;
  isImportant: boolean;
  contentHash: string;
};

export function academicYearValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^20\d{2}-\d{2}$/.test(text)) throw new AcademicCalendarError("Choose a valid academic year.");
  return text;
}

export function expectedCalendarVersion(value: unknown) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 1_000_000) {
    throw new AcademicCalendarError("A valid expected version is required.");
  }
  return number;
}

export function calendarDateRange(fromValue: unknown, toValue: unknown) {
  const from = dateOnly(fromValue, "From date");
  const to = dateOnly(toValue, "To date");
  const days = Math.floor((to.valueOf() - from.valueOf()) / 86_400_000) + 1;
  if (days < 1 || days > CALENDAR_MAX_QUERY_DAYS) {
    throw new AcademicCalendarError(`Calendar ranges must contain between 1 and ${CALENDAR_MAX_QUERY_DAYS} days.`);
  }
  return { from, to, days };
}

export function humanCalendarLabel(value: string) {
  const labels: Record<string, string> = {
    WORKING_DAY: "Working day",
    NON_WORKING_DAY: "Non-working day",
    HALF_DAY: "Half day",
    VACATION_DAY: "Vacation day",
    SPECIAL_WORKING_DAY: "Special working day",
    EMERGENCY_CLOSURE: "Emergency closure",
    SCHOOL_WIDE: "School-wide",
    STAFF_ONLY: "Staff only",
    PARENTS_ALL: "All linked Parents",
    ROLE_SPECIFIC: "Role specific",
    CLASS: "Class",
    CLASS_SECTION: "Class and section",
    LINKED_CHILD_COHORT: "Linked-child cohort",
    LEADERSHIP_ONLY: "Leadership only",
    SCHOOL_FUNCTION: "School function",
    PARENT_MEETING: "Parent meeting",
    ACADEMIC_DEADLINE: "Academic deadline",
    STAFF_MEETING: "Staff meeting",
    EXAMINATION_REFERENCE: "Examination reference",
    CLASS_EVENT: "Class event",
    READY_FOR_REVIEW: "Ready for review"
  };
  return labels[value] ?? value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function operationalDayTotals(days: Array<{ dayType: string }>) {
  const counts = Object.fromEntries(OPERATIONAL_DAY_TYPES.map((type) => [type, 0])) as Record<OperationalDayType, number>;
  for (const row of days) if ((OPERATIONAL_DAY_TYPES as readonly string[]).includes(row.dayType)) counts[row.dayType as OperationalDayType] += 1;
  return {
    classifiedDays: days.length,
    workingDays: counts.WORKING_DAY,
    specialWorkingDays: counts.SPECIAL_WORKING_DAY,
    nonWorkingDays: counts.NON_WORKING_DAY,
    halfDays: counts.HALF_DAY,
    vacationDays: counts.VACATION_DAY,
    emergencyClosures: counts.EMERGENCY_CLOSURE,
    workingDayEquivalent: counts.WORKING_DAY + counts.SPECIAL_WORKING_DAY + counts.HALF_DAY * 0.5,
    byType: counts
  };
}

export async function listCalendarCreationOptions(client: CalendarClient) {
  const [settings, classSections, examinations] = await Promise.all([
    client.schoolSettings.findUnique({ where: { id: "school" }, select: { academicYear: true } }),
    client.timetableClassSection.findMany({
      where: { isActive: true },
      select: { id: true, academicYear: true, className: true, section: true, displayName: true },
      orderBy: [{ academicYear: "desc" }, { className: "asc" }, { section: "asc" }],
      take: 1_000
    }),
    client.examinationTimetableVersion.findMany({
      where: { status: "PUBLISHED", currentPublicationKey: { not: null } },
      select: {
        publicKey: true,
        versionNumber: true,
        academicYear: true,
        className: true,
        section: true,
        examination: { select: { name: true, examCode: true } }
      },
      orderBy: { publishedAt: "desc" },
      take: 500
    })
  ]);
  const academicYears = [...new Set([settings?.academicYear, ...classSections.map((row: any) => row.academicYear)].filter(Boolean))];
  return { academicYears, classSections, publishedExaminationTimetables: examinations };
}

export async function listAcademicCalendarVersions(client: CalendarClient, academicYear?: string) {
  return client.academicCalendarVersion.findMany({
    where: academicYear ? { academicYear } : undefined,
    include: { days: { orderBy: [{ dayDate: "asc" }, { scopeKey: "asc" }] } },
    orderBy: [{ academicYear: "desc" }, { scopeKey: "asc" }, { versionNumber: "desc" }],
    take: 200
  });
}

export async function getAcademicCalendarVersion(client: CalendarClient, publicKey: string) {
  const version = await client.academicCalendarVersion.findUnique({
    where: { publicKey: boundedHandle(publicKey) },
    include: { days: { orderBy: [{ dayDate: "asc" }, { scopeKey: "asc" }] } }
  });
  if (!version) throw new AcademicCalendarError("Academic calendar version not found.", 404, "CALENDAR_NOT_FOUND");
  const preview = await previewAcademicCalendar(client, version);
  const audit = await client.academicCalendarAuditEvent.findMany({
    where: { calendarVersionId: version.id },
    orderBy: { eventDate: "desc" },
    take: 200
  });
  return { ...version, preview, audit: audit.map(publicAudit) };
}

export async function createAcademicCalendarVersion(client: CalendarClient, input: unknown, actor: CalendarActor) {
  assertLeadership(actor);
  const source = objectInput(input);
  const academicYear = academicYearValue(source.academicYear);
  const effectiveScope = allowed(source.effectiveScope ?? "SCHOOL_WIDE", CALENDAR_SCOPES, "calendar scope");
  const scope = await validateScope(client, academicYear, effectiveScope, source.className, source.section);
  await assertKnownAcademicYear(client, academicYear);
  const title = requiredText(source.title ?? `${academicYear} Academic Calendar`, "Calendar title", CALENDAR_TITLE_MAX);
  return client.$transaction(async (tx: any) => {
    const existingDraft = await tx.academicCalendarVersion.findFirst({
      where: { academicYear, scopeKey: scope.scopeKey, status: { in: ["DRAFT", "READY_FOR_REVIEW"] } }
    });
    if (existingDraft) throw new AcademicCalendarError("A draft or review-ready calendar already exists for this scope.", 409, "CALENDAR_DRAFT_EXISTS");
    const latest = await tx.academicCalendarVersion.aggregate({
      where: { academicYear, scopeKey: scope.scopeKey }, _max: { versionNumber: true }
    });
    const created = await tx.academicCalendarVersion.create({
      data: {
        academicYear,
        versionNumber: (latest._max.versionNumber ?? 0) + 1,
        effectiveScope,
        className: scope.className,
        section: scope.section,
        scopeKey: scope.scopeKey,
        title,
        createdByUserId: actor.id
      },
      include: { days: true }
    });
    await appendAudit(tx, actor, {
      entityType: "OPERATIONAL_CALENDAR",
      calendarVersionId: created.id,
      eventType: "CALENDAR_DRAFT_CREATED",
      newStatus: "DRAFT",
      snapshot: calendarSnapshot(created)
    });
    return created;
  }, serializable());
}

export async function saveAcademicCalendarDraft(client: CalendarClient, publicKey: string, input: unknown, actor: CalendarActor) {
  assertLeadership(actor);
  const source = objectInput(input);
  const expectedVersion = expectedCalendarVersion(source.expectedVersion);
  const normalized = normalizeOperationalDays(source.days);
  return client.$transaction(async (tx: any) => {
    const current = await tx.academicCalendarVersion.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { days: true } });
    if (!current) throw new AcademicCalendarError("Academic calendar version not found.", 404);
    if (current.status !== "DRAFT" || current.version !== expectedVersion) throw staleCalendarError();
    for (const day of normalized) {
      if (!attendanceDateBelongsToAcademicYear(day.dayDate, current.academicYear)) {
        throw new AcademicCalendarError(`${dateKey(day.dayDate)} is outside ${current.academicYear}.`);
      }
      await validateScope(tx, current.academicYear, day.scopeType, day.className, day.section);
    }
    const emergency = normalized.filter((day) => day.dayType === "EMERGENCY_CLOSURE" || day.sourceType === "EMERGENCY_CLOSURE");
    if (emergency.length && !source.emergencyPermissionConfirmed) {
      throw new AcademicCalendarError("Emergency closure requires the exact emergency-closure permission.", 403, "EMERGENCY_PERMISSION_REQUIRED");
    }
    await tx.operationalCalendarDay.deleteMany({ where: { calendarVersionId: current.id } });
    for (const day of normalized) await tx.operationalCalendarDay.create({ data: { calendarVersionId: current.id, ...day } });
    const title = source.title === undefined ? current.title : requiredText(source.title, "Calendar title", CALENDAR_TITLE_MAX);
    const changed = await tx.academicCalendarVersion.updateMany({
      where: { id: current.id, status: "DRAFT", version: expectedVersion },
      data: { title, version: { increment: 1 } }
    });
    if (changed.count !== 1) throw staleCalendarError();
    const saved = await tx.academicCalendarVersion.findUniqueOrThrow({ where: { id: current.id }, include: { days: { orderBy: { dayDate: "asc" } } } });
    await appendAudit(tx, actor, {
      entityType: "OPERATIONAL_CALENDAR",
      calendarVersionId: current.id,
      eventType: "CALENDAR_DRAFT_SAVED",
      previousStatus: current.status,
      newStatus: current.status,
      snapshot: { ...calendarSnapshot(saved), dayCount: saved.days.length }
    });
    return saved;
  }, serializable());
}

export async function transitionAcademicCalendar(client: CalendarClient, publicKey: string, input: unknown, actor: CalendarActor) {
  assertLeadership(actor);
  const source = objectInput(input);
  const action = String(source.action ?? "").trim().toLowerCase();
  if (action === "create_replacement") return createAcademicCalendarReplacement(client, publicKey, source, actor);
  const expectedVersion = expectedCalendarVersion(source.expectedVersion);
  if (action === "ready") return markCalendarReady(client, publicKey, expectedVersion, actor);
  if (action === "approve") return approveCalendar(client, publicKey, expectedVersion, actor, source.reason);
  if (action === "publish") return publishCalendar(client, publicKey, expectedVersion, actor, source);
  if (action === "withdraw") return withdrawCalendar(client, publicKey, expectedVersion, actor, source.reason);
  if (action === "archive") return archiveCalendar(client, publicKey, expectedVersion, actor, source.reason);
  throw new AcademicCalendarError("Unsupported academic calendar action.");
}

async function markCalendarReady(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor) {
  return client.$transaction(async (tx: any) => {
    const current = await tx.academicCalendarVersion.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { days: true } });
    if (!current) throw new AcademicCalendarError("Academic calendar version not found.", 404);
    if (current.status === "READY_FOR_REVIEW" && current.version === expectedVersion) return current;
    if (current.status !== "DRAFT" || current.version !== expectedVersion) throw staleCalendarError();
    if (!current.days.length) throw new AcademicCalendarError("Add at least one operational day classification before review.");
    const changed = await tx.academicCalendarVersion.updateMany({
      where: { id: current.id, status: "DRAFT", version: expectedVersion },
      data: {
        status: "READY_FOR_REVIEW",
        submittedAt: new Date(),
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) throw staleCalendarError();
    const updated = await tx.academicCalendarVersion.findUniqueOrThrow({ where: { id: current.id }, include: { days: true } });
    await appendAudit(tx, actor, { entityType: "OPERATIONAL_CALENDAR", calendarVersionId: current.id, eventType: "CALENDAR_SUBMITTED", previousStatus: "DRAFT", newStatus: "READY_FOR_REVIEW", snapshot: calendarSnapshot(updated) });
    return updated;
  }, serializable());
}

async function approveCalendar(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor, reasonValue: unknown) {
  const reason = requiredText(reasonValue, "Approval reason", CALENDAR_REASON_MAX);
  return client.$transaction(async (tx: any) => {
    const current = await tx.academicCalendarVersion.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { days: true } });
    if (!current) throw new AcademicCalendarError("Academic calendar version not found.", 404);
    if (current.status !== "READY_FOR_REVIEW" || current.version !== expectedVersion) throw staleCalendarError();
    if (current.approvedAt) return current;
    const changed = await tx.academicCalendarVersion.updateMany({
      where: { id: current.id, status: "READY_FOR_REVIEW", version: expectedVersion, approvedAt: null },
      data: { approvedAt: new Date(), version: { increment: 1 } }
    });
    if (changed.count !== 1) throw staleCalendarError();
    const updated = await tx.academicCalendarVersion.findUniqueOrThrow({ where: { id: current.id }, include: { days: true } });
    await appendAudit(tx, actor, { entityType: "OPERATIONAL_CALENDAR", calendarVersionId: current.id, eventType: "CALENDAR_APPROVED", previousStatus: current.status, newStatus: current.status, reason, snapshot: calendarSnapshot(updated) });
    return updated;
  }, serializable());
}

async function publishCalendar(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor, source: Record<string, any>) {
  const publicationReason = requiredText(source.reason, "Publication reason", CALENDAR_REASON_MAX);
  const idempotencyKey = requiredIdempotencyKey(source.idempotencyKey);
  return client.$transaction(async (tx: any) => {
    const current = await tx.academicCalendarVersion.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { days: true } });
    if (!current) throw new AcademicCalendarError("Academic calendar version not found.", 404);
    if (current.status === "PUBLISHED" && current.idempotencyKey === idempotencyKey && current.version === expectedVersion + 1) return current;
    if (current.status !== "READY_FOR_REVIEW" || current.version !== expectedVersion || !current.approvedAt) throw staleCalendarError();
    const preview = await previewAcademicCalendar(tx, current);
    const former = await tx.academicCalendarVersion.findFirst({
      where: { academicYear: current.academicYear, scopeKey: current.scopeKey, status: "PUBLISHED", currentPublicationKey: { not: null } },
      include: { days: true }
    });
    if (former && current.replacesVersionId !== former.id) {
      throw new AcademicCalendarError("Create and review a governed replacement of the current publication before publishing.", 409, "CALENDAR_REPLACEMENT_REQUIRED");
    }
    if (preview.postedAttendanceSessions > 0 && !requiredText(source.impactReason ?? current.replacementReason, "Attendance impact reason", CALENDAR_REASON_MAX)) {
      throw new AcademicCalendarError("A reason is required because posted attendance may require reconciliation.");
    }
    const now = new Date();
    if (former) {
      await tx.academicCalendarVersion.update({
        where: { id: former.id },
        data: { status: "REPLACED", currentPublicationKey: null, replacedAt: now, version: { increment: 1 } }
      });
      await appendAudit(tx, actor, { entityType: "OPERATIONAL_CALENDAR", calendarVersionId: former.id, eventType: "CALENDAR_REPLACED", previousStatus: "PUBLISHED", newStatus: "REPLACED", reason: current.replacementReason ?? publicationReason, snapshot: calendarSnapshot(former) });
    }
    const changed = await tx.academicCalendarVersion.updateMany({
      where: { id: current.id, status: "READY_FOR_REVIEW", version: expectedVersion, approvedAt: { not: null }, currentPublicationKey: null },
      data: {
        status: "PUBLISHED",
        currentPublicationKey: `${current.academicYear}:${current.scopeKey}`,
        idempotencyKey,
        publicationReason,
        publishedAt: now,
        attendanceReconciliationRequired: preview.postedAttendanceSessions > 0,
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) throw staleCalendarError();
    const published = await tx.academicCalendarVersion.findUniqueOrThrow({ where: { id: current.id }, include: { days: true } });
    await appendAudit(tx, actor, { entityType: "OPERATIONAL_CALENDAR", calendarVersionId: current.id, eventType: "CALENDAR_PUBLISHED", previousStatus: "READY_FOR_REVIEW", newStatus: "PUBLISHED", reason: publicationReason, snapshot: { ...calendarSnapshot(published), impact: preview } });
    return published;
  }, serializable());
}

async function createAcademicCalendarReplacement(client: CalendarClient, publicKey: string, source: Record<string, any>, actor: CalendarActor) {
  const reason = requiredText(source.reason, "Replacement reason", CALENDAR_REASON_MAX);
  return client.$transaction(async (tx: any) => {
    const current = await tx.academicCalendarVersion.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { days: true } });
    if (!current || current.status !== "PUBLISHED" || !current.currentPublicationKey) throw new AcademicCalendarError("Only the current published calendar can be replaced.", 409);
    const existing = await tx.academicCalendarVersion.findFirst({ where: { replacesVersionId: current.id, status: { in: ["DRAFT", "READY_FOR_REVIEW"] } }, include: { days: true } });
    if (existing) return existing;
    const draft = await tx.academicCalendarVersion.create({
      data: {
        academicYear: current.academicYear,
        versionNumber: current.versionNumber + 1,
        effectiveScope: current.effectiveScope,
        className: current.className,
        section: current.section,
        scopeKey: current.scopeKey,
        title: current.title,
        replacesVersionId: current.id,
        replacementReason: reason,
        createdByUserId: actor.id,
        days: {
          create: current.days.map((day: any) => ({
            dayDate: day.dayDate,
            dayType: day.dayType,
            sourceType: day.sourceType,
            scopeType: day.scopeType,
            className: day.className,
            section: day.section,
            scopeKey: day.scopeKey,
            title: day.title,
            halfDaySession: day.halfDaySession,
            publicInstructions: day.publicInstructions,
            reason: day.reason,
            contentHash: day.contentHash
          }))
        }
      },
      include: { days: true }
    });
    await appendAudit(tx, actor, { entityType: "OPERATIONAL_CALENDAR", calendarVersionId: draft.id, eventType: "CALENDAR_REPLACEMENT_DRAFT_CREATED", previousStatus: "PUBLISHED", newStatus: "DRAFT", reason, snapshot: calendarSnapshot(draft) });
    return draft;
  }, serializable());
}

async function withdrawCalendar(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor, reasonValue: unknown) {
  const reason = requiredText(reasonValue, "Withdrawal reason", CALENDAR_REASON_MAX);
  return terminalCalendarTransition(client, publicKey, expectedVersion, actor, "PUBLISHED", "WITHDRAWN", "CALENDAR_WITHDRAWN", { withdrawalReason: reason, withdrawnAt: new Date(), currentPublicationKey: null }, reason);
}

async function archiveCalendar(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor, reasonValue: unknown) {
  const reason = requiredText(reasonValue, "Archive reason", CALENDAR_REASON_MAX);
  return client.$transaction(async (tx: any) => {
    const current = await tx.academicCalendarVersion.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { days: true } });
    if (!current || !["REPLACED", "WITHDRAWN"].includes(current.status) || current.version !== expectedVersion) throw staleCalendarError();
    const updated = await tx.academicCalendarVersion.update({ where: { id: current.id }, data: { status: "ARCHIVED", archiveReason: reason, archivedAt: new Date(), version: { increment: 1 } }, include: { days: true } });
    await appendAudit(tx, actor, { entityType: "OPERATIONAL_CALENDAR", calendarVersionId: current.id, eventType: "CALENDAR_ARCHIVED", previousStatus: current.status, newStatus: "ARCHIVED", reason, snapshot: calendarSnapshot(updated) });
    return updated;
  }, serializable());
}

async function terminalCalendarTransition(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor, from: CalendarStatus, to: CalendarStatus, eventType: string, data: Record<string, unknown>, reason: string) {
  return client.$transaction(async (tx: any) => {
    const current = await tx.academicCalendarVersion.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { days: true } });
    if (!current || current.status !== from || current.version !== expectedVersion) throw staleCalendarError();
    const changed = await tx.academicCalendarVersion.updateMany({ where: { id: current.id, status: from, version: expectedVersion }, data: { status: to, ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw staleCalendarError();
    const updated = await tx.academicCalendarVersion.findUniqueOrThrow({ where: { id: current.id }, include: { days: true } });
    await appendAudit(tx, actor, { entityType: "OPERATIONAL_CALENDAR", calendarVersionId: current.id, eventType, previousStatus: from, newStatus: to, reason, snapshot: calendarSnapshot(updated) });
    return updated;
  }, serializable());
}

export async function previewAcademicCalendar(client: CalendarClient, input: any) {
  const version = input.days ? input : await client.academicCalendarVersion.findUnique({ where: { publicKey: boundedHandle(input) }, include: { days: true } });
  if (!version) throw new AcademicCalendarError("Academic calendar version not found.", 404);
  const previous = version.replacesVersionId
    ? await client.academicCalendarVersion.findUnique({ where: { id: version.replacesVersionId }, include: { days: true } })
    : await client.academicCalendarVersion.findFirst({
        where: { academicYear: version.academicYear, scopeKey: version.scopeKey, status: "PUBLISHED", id: { not: version.id } },
        include: { days: true }, orderBy: { versionNumber: "desc" }
      });
  const currentMap = new Map(version.days.map((day: any) => [`${dateKey(day.dayDate)}:${day.scopeKey}`, day]));
  const formerMap = new Map((previous?.days ?? []).map((day: any) => [`${dateKey(day.dayDate)}:${day.scopeKey}`, day]));
  const keys = new Set([...currentMap.keys(), ...formerMap.keys()]);
  const differences = [...keys].filter((key) => {
    const current: any = currentMap.get(key), former: any = formerMap.get(key);
    return !current || !former || current.contentHash !== former.contentHash;
  }).map((key) => {
    const current: any = currentMap.get(key), former: any = formerMap.get(key);
    return { date: dateKey((current ?? former).dayDate), from: former?.dayType ?? null, to: current?.dayType ?? null, scope: (current ?? former).scopeKey };
  });
  const changedDates = [...new Set(differences.map((row) => row.date))];
  const attendanceWhere: any = {
    academicYear: version.academicYear,
    status: { in: ["SUBMITTED", "LOCKED"] },
    ...(changedDates.length ? { attendanceDate: { in: changedDates.map((date) => new Date(`${date}T00:00:00.000Z`)) } } : { id: "__none__" })
  };
  if (version.className) attendanceWhere.className = version.className;
  if (version.effectiveScope === "CLASS_SECTION") attendanceWhere.section = version.section ?? "";
  const attendance = await client.studentAttendanceSession.findMany({ where: attendanceWhere, select: { attendanceDate: true, className: true, section: true, status: true }, take: 10_000 });
  const nonWorkingDates = version.days.filter((day: any) => ["NON_WORKING_DAY", "VACATION_DAY", "EMERGENCY_CLOSURE"].includes(day.dayType)).map((day: any) => day.dayDate);
  const examRows = nonWorkingDates.length ? await client.examinationTimetableRow.findMany({
    where: { examDate: { in: nonWorkingDates }, timetableVersion: { status: "PUBLISHED", currentPublicationKey: { not: null }, academicYear: version.academicYear } },
    select: { examDate: true, subjectNameSnapshot: true, timetableVersion: { select: { publicKey: true, className: true, section: true, examination: { select: { name: true } } } } },
    take: 1_000
  }) : [];
  return {
    totals: operationalDayTotals(version.days),
    previousVersionNumber: previous?.versionNumber ?? null,
    changedDates: differences.length,
    differences: differences.slice(0, 800),
    postedAttendanceSessions: attendance.length,
    affectedAttendancePeriods: [...new Set(attendance.map((row: any) => dateKey(row.attendanceDate).slice(0, 7)))],
    attendanceReconciliationRequired: attendance.length > 0,
    examinationConflicts: examRows.map((row: any) => ({ date: dateKey(row.examDate), examination: row.timetableVersion.examination.name, subject: row.subjectNameSnapshot, className: row.timetableVersion.className, section: row.timetableVersion.section })),
    attendanceRecordsWillBeRewritten: false,
    informationalEventsChangeDayType: false
  };
}

export async function listSchoolCalendarEvents(client: CalendarClient, academicYear?: string) {
  return client.schoolCalendarEvent.findMany({
    where: academicYear ? { academicYear } : undefined,
    include: { versions: { orderBy: { versionNumber: "desc" }, include: { examinationTimetableVersion: { select: { publicKey: true, versionNumber: true, status: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 500
  });
}

export async function createSchoolCalendarEvent(client: CalendarClient, input: unknown, actor: CalendarActor) {
  const source = objectInput(input);
  const academicYear = academicYearValue(source.academicYear);
  await assertKnownAcademicYear(client, academicYear);
  const event = await normalizeSchoolEvent(client, academicYear, source);
  if (actor.role === "TEACHER") await assertTeacherEventProposalScope(client, actor, academicYear, event);
  else assertLeadership(actor);
  return client.$transaction(async (tx: any) => {
    const base = await tx.schoolCalendarEvent.create({
      data: {
        eventNumber: newSchoolEventNumber(),
        academicYear,
        createdByUserId: actor.id,
        versions: { create: { ...event, versionNumber: 1, createdByUserId: actor.id } }
      },
      include: { versions: true }
    });
    const version = base.versions[0];
    await appendAudit(tx, actor, { entityType: "INFORMATIONAL_EVENT", schoolEventId: base.id, eventVersionId: version.id, eventType: actor.role === "TEACHER" ? "EVENT_PROPOSED" : "EVENT_DRAFT_CREATED", newStatus: "DRAFT", snapshot: eventSnapshot(version) });
    return base;
  }, serializable());
}

export async function updateSchoolCalendarEventDraft(client: CalendarClient, publicKey: string, input: unknown, actor: CalendarActor) {
  const source = objectInput(input);
  const expectedVersion = expectedCalendarVersion(source.expectedVersion);
  const base = await client.schoolCalendarEvent.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } } });
  if (!base) throw new AcademicCalendarError("School calendar event not found.", 404);
  const current = base.versions[0];
  const event = await normalizeSchoolEvent(client, base.academicYear, source);
  if (actor.role === "TEACHER") {
    if (base.createdByUserId !== actor.id) throw new AcademicCalendarError("Teachers may update only their own event proposal.", 403);
    await assertTeacherEventProposalScope(client, actor, base.academicYear, event);
  } else assertLeadership(actor);
  return client.$transaction(async (tx: any) => {
    const changed = await tx.schoolCalendarEventVersion.updateMany({ where: { id: current.id, status: "DRAFT", version: expectedVersion }, data: { ...event, version: { increment: 1 } } });
    if (changed.count !== 1) throw staleCalendarError();
    await tx.schoolCalendarEvent.update({ where: { id: base.id }, data: { version: { increment: 1 } } });
    const updated = await tx.schoolCalendarEvent.findUniqueOrThrow({ where: { id: base.id }, include: { versions: { orderBy: { versionNumber: "desc" } } } });
    await appendAudit(tx, actor, { entityType: "INFORMATIONAL_EVENT", schoolEventId: base.id, eventVersionId: current.id, eventType: "EVENT_DRAFT_SAVED", previousStatus: "DRAFT", newStatus: "DRAFT", snapshot: eventSnapshot(updated.versions[0]) });
    return updated;
  }, serializable());
}

export async function getSchoolCalendarEvent(client: CalendarClient, publicKey: string) {
  const base = await client.schoolCalendarEvent.findUnique({
    where: { publicKey: boundedHandle(publicKey) },
    include: { versions: { orderBy: { versionNumber: "desc" }, include: { examinationTimetableVersion: { include: { examination: true, classScope: true, rows: { orderBy: { displayOrder: "asc" } } } } } } }
  });
  if (!base) throw new AcademicCalendarError("School calendar event not found.", 404);
  const current = base.versions[0];
  const [audiencePreview, audit] = await Promise.all([
    previewSchoolCalendarEventAudience(client, base.academicYear, current),
    client.academicCalendarAuditEvent.findMany({ where: { schoolEventId: base.id }, orderBy: { eventDate: "desc" }, take: 200 })
  ]);
  return { ...base, audiencePreview, audit: audit.map(publicAudit) };
}

export async function transitionSchoolCalendarEvent(client: CalendarClient, publicKey: string, input: unknown, actor: CalendarActor) {
  assertLeadership(actor);
  const source = objectInput(input);
  const action = String(source.action ?? "").trim().toLowerCase();
  if (action === "create_replacement") return createSchoolEventReplacement(client, publicKey, source, actor);
  const expectedVersion = expectedCalendarVersion(source.expectedVersion);
  if (action === "ready") return transitionEventStatus(client, publicKey, expectedVersion, actor, "DRAFT", "READY_FOR_REVIEW", "EVENT_SUBMITTED", null);
  if (action === "approve") return approveSchoolEvent(client, publicKey, expectedVersion, actor, source.reason);
  if (action === "publish") return publishSchoolEvent(client, publicKey, expectedVersion, actor, source);
  if (action === "withdraw") return withdrawSchoolEvent(client, publicKey, expectedVersion, actor, source.reason);
  if (action === "archive") return archiveSchoolEvent(client, publicKey, expectedVersion, actor, source.reason);
  throw new AcademicCalendarError("Unsupported school calendar event action.");
}

async function transitionEventStatus(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor, from: CalendarStatus, to: CalendarStatus, auditType: string, reason: string | null) {
  return client.$transaction(async (tx: any) => {
    const base = await tx.schoolCalendarEvent.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } } });
    if (!base) throw new AcademicCalendarError("School calendar event not found.", 404);
    const current = base.versions[0];
    if (current.status !== from || current.version !== expectedVersion) throw staleCalendarError();
    const preview = await previewSchoolCalendarEventAudience(tx, base.academicYear, current);
    if (!preview.totalUsers) throw new AcademicCalendarError("No active authorised audience can be resolved for this event.");
    if (current.eventType === "EXAMINATION_REFERENCE") await assertCurrentExamReference(tx, current);
    const now = new Date();
    const versionData: any = { status: to, version: { increment: 1 } };
    if (to === "READY_FOR_REVIEW") Object.assign(versionData, { submittedAt: now });
    const changed = await tx.schoolCalendarEventVersion.updateMany({ where: { id: current.id, status: from, version: expectedVersion }, data: versionData });
    if (changed.count !== 1) throw staleCalendarError();
    await tx.schoolCalendarEvent.update({ where: { id: base.id }, data: { status: to, version: { increment: 1 } } });
    const updated = await tx.schoolCalendarEventVersion.findUniqueOrThrow({ where: { id: current.id } });
    await appendAudit(tx, actor, { entityType: "INFORMATIONAL_EVENT", schoolEventId: base.id, eventVersionId: current.id, eventType: auditType, previousStatus: from, newStatus: to, reason, snapshot: { ...eventSnapshot(updated), audiencePreview: preview } });
    return updated;
  }, serializable());
}

async function approveSchoolEvent(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor, reasonValue: unknown) {
  const reason = requiredText(reasonValue, "Approval reason", CALENDAR_REASON_MAX);
  return client.$transaction(async (tx: any) => {
    const base = await tx.schoolCalendarEvent.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } } });
    if (!base) throw new AcademicCalendarError("School calendar event not found.", 404);
    const current = base.versions[0];
    if (current.status !== "READY_FOR_REVIEW" || current.version !== expectedVersion) throw staleCalendarError();
    if (current.approvedAt) return current;
    const changed = await tx.schoolCalendarEventVersion.updateMany({ where: { id: current.id, status: "READY_FOR_REVIEW", version: expectedVersion, approvedAt: null }, data: { approvedAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw staleCalendarError();
    const updated = await tx.schoolCalendarEventVersion.findUniqueOrThrow({ where: { id: current.id } });
    await appendAudit(tx, actor, { entityType: "INFORMATIONAL_EVENT", schoolEventId: base.id, eventVersionId: current.id, eventType: "EVENT_APPROVED", previousStatus: current.status, newStatus: current.status, reason, snapshot: eventSnapshot(updated) });
    return updated;
  }, serializable());
}

async function publishSchoolEvent(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor, source: Record<string, any>) {
  const publicationReason = requiredText(source.reason, "Publication reason", CALENDAR_REASON_MAX);
  const idempotencyKey = requiredIdempotencyKey(source.idempotencyKey);
  let published: any;
  published = await client.$transaction(async (tx: any) => {
    const base = await tx.schoolCalendarEvent.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { versions: { orderBy: { versionNumber: "desc" } } } });
    if (!base) throw new AcademicCalendarError("School calendar event not found.", 404);
    const current = base.versions[0];
    if (current.status === "PUBLISHED" && current.idempotencyKey === idempotencyKey && current.version === expectedVersion + 1) return { base, version: current };
    if (current.status !== "READY_FOR_REVIEW" || current.version !== expectedVersion || !current.approvedAt) throw staleCalendarError();
    if (current.eventType === "EXAMINATION_REFERENCE") await assertCurrentExamReference(tx, current);
    const audiencePreview = await previewSchoolCalendarEventAudience(tx, base.academicYear, current);
    if (!audiencePreview.totalUsers) throw new AcademicCalendarError("No active authorised audience can be resolved for this event.");
    const former = base.currentPublishedVersionId ? base.versions.find((row: any) => row.id === base.currentPublishedVersionId) : null;
    if (former && current.replacesVersionId !== former.id) throw new AcademicCalendarError("Publish only a reviewed replacement of the current event version.", 409, "EVENT_REPLACEMENT_REQUIRED");
    const now = new Date();
    if (former) {
      await tx.schoolCalendarEventVersion.update({ where: { id: former.id }, data: { status: "REPLACED", currentPublicationKey: null, replacedAt: now, version: { increment: 1 } } });
      await appendAudit(tx, actor, { entityType: "INFORMATIONAL_EVENT", schoolEventId: base.id, eventVersionId: former.id, eventType: "EVENT_REPLACED", previousStatus: "PUBLISHED", newStatus: "REPLACED", reason: current.replacementReason ?? publicationReason, snapshot: eventSnapshot(former) });
    }
    const changed = await tx.schoolCalendarEventVersion.updateMany({
      where: { id: current.id, status: "READY_FOR_REVIEW", version: expectedVersion, approvedAt: { not: null }, currentPublicationKey: null },
      data: { status: "PUBLISHED", currentPublicationKey: `${base.id}:CURRENT`, idempotencyKey, publicationReason, publishedAt: now, version: { increment: 1 } }
    });
    if (changed.count !== 1) throw staleCalendarError();
    await tx.schoolCalendarEvent.update({ where: { id: base.id }, data: { status: "PUBLISHED", currentVersionNumber: current.versionNumber, currentPublishedVersionId: current.id, version: { increment: 1 } } });
    const version = await tx.schoolCalendarEventVersion.findUniqueOrThrow({ where: { id: current.id } });
    await appendAudit(tx, actor, { entityType: "INFORMATIONAL_EVENT", schoolEventId: base.id, eventVersionId: current.id, eventType: "EVENT_PUBLISHED", previousStatus: "READY_FOR_REVIEW", newStatus: "PUBLISHED", reason: publicationReason, snapshot: { ...eventSnapshot(version), audiencePreview } });
    return { base: { ...base, status: "PUBLISHED", currentPublishedVersionId: current.id }, version };
  }, serializable());
  await ensureCalendarEventNotification(client, published.base, published.version, actor).catch(async (error) => {
    await client.academicCalendarAuditEvent.create({ data: { entityType: "INFORMATIONAL_EVENT", schoolEventId: published.base.id, eventVersionId: published.version.id, eventType: "EVENT_NOTIFICATION_FAILED", actorUserId: actor.id, actorLabel: safeActorLabel(actor.name), reason: safeErrorMessage(error), snapshotJson: JSON.stringify({ publicationPreserved: true }), eventDate: new Date() } }).catch(() => undefined);
  });
  return published.version;
}

async function createSchoolEventReplacement(client: CalendarClient, publicKey: string, source: Record<string, any>, actor: CalendarActor) {
  const reason = requiredText(source.reason, "Replacement reason", CALENDAR_REASON_MAX);
  return client.$transaction(async (tx: any) => {
    const base = await tx.schoolCalendarEvent.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { versions: { orderBy: { versionNumber: "desc" } } } });
    if (!base?.currentPublishedVersionId) throw new AcademicCalendarError("Only a current published event can be replaced.", 409);
    const current = base.versions.find((row: any) => row.id === base.currentPublishedVersionId);
    if (!current || current.status !== "PUBLISHED") throw new AcademicCalendarError("Only a current published event can be replaced.", 409);
    const existing = base.versions.find((row: any) => row.replacesVersionId === current.id && ["DRAFT", "READY_FOR_REVIEW"].includes(row.status));
    if (existing) return existing;
    const replacement = await tx.schoolCalendarEventVersion.create({
      data: {
        eventId: base.id,
        versionNumber: Math.max(...base.versions.map((row: any) => row.versionNumber)) + 1,
        eventType: current.eventType,
        title: current.title,
        description: current.description,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        allDay: current.allDay,
        venue: current.venue,
        parentInstructions: current.parentInstructions,
        internalNotes: current.internalNotes,
        audienceType: current.audienceType,
        roleScope: current.roleScope,
        classSectionId: current.classSectionId,
        className: current.className,
        section: current.section,
        audienceKey: current.audienceKey,
        examinationTimetableVersionId: current.examinationTimetableVersionId,
        isImportant: current.isImportant,
        contentHash: current.contentHash,
        replacesVersionId: current.id,
        replacementReason: reason,
        createdByUserId: actor.id
      }
    });
    await tx.schoolCalendarEvent.update({ where: { id: base.id }, data: { status: "DRAFT", currentVersionNumber: replacement.versionNumber, version: { increment: 1 } } });
    await appendAudit(tx, actor, { entityType: "INFORMATIONAL_EVENT", schoolEventId: base.id, eventVersionId: replacement.id, eventType: "EVENT_REPLACEMENT_DRAFT_CREATED", previousStatus: "PUBLISHED", newStatus: "DRAFT", reason, snapshot: eventSnapshot(replacement) });
    return replacement;
  }, serializable());
}

async function withdrawSchoolEvent(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor, reasonValue: unknown) {
  const reason = requiredText(reasonValue, "Withdrawal reason", CALENDAR_REASON_MAX);
  return client.$transaction(async (tx: any) => {
    const base = await tx.schoolCalendarEvent.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { versions: { orderBy: { versionNumber: "desc" } } } });
    const current = base?.versions.find((row: any) => row.id === base.currentPublishedVersionId);
    if (!base || !current || current.status !== "PUBLISHED" || current.version !== expectedVersion) throw staleCalendarError();
    const changed = await tx.schoolCalendarEventVersion.updateMany({ where: { id: current.id, status: "PUBLISHED", version: expectedVersion }, data: { status: "WITHDRAWN", currentPublicationKey: null, withdrawalReason: reason, withdrawnAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw staleCalendarError();
    await tx.schoolCalendarEvent.update({ where: { id: base.id }, data: { status: "WITHDRAWN", currentPublishedVersionId: null, version: { increment: 1 } } });
    const updated = await tx.schoolCalendarEventVersion.findUniqueOrThrow({ where: { id: current.id } });
    await appendAudit(tx, actor, { entityType: "INFORMATIONAL_EVENT", schoolEventId: base.id, eventVersionId: current.id, eventType: "EVENT_WITHDRAWN", previousStatus: "PUBLISHED", newStatus: "WITHDRAWN", reason, snapshot: eventSnapshot(updated) });
    return updated;
  }, serializable());
}

async function archiveSchoolEvent(client: CalendarClient, publicKey: string, expectedVersion: number, actor: CalendarActor, reasonValue: unknown) {
  const reason = requiredText(reasonValue, "Archive reason", CALENDAR_REASON_MAX);
  return client.$transaction(async (tx: any) => {
    const base = await tx.schoolCalendarEvent.findUnique({ where: { publicKey: boundedHandle(publicKey) }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } } });
    const current = base?.versions[0];
    if (!base || !current || !["REPLACED", "WITHDRAWN"].includes(current.status) || current.version !== expectedVersion) throw staleCalendarError();
    const updated = await tx.schoolCalendarEventVersion.update({ where: { id: current.id }, data: { status: "ARCHIVED", archiveReason: reason, archivedAt: new Date(), version: { increment: 1 } } });
    await tx.schoolCalendarEvent.update({ where: { id: base.id }, data: { status: "ARCHIVED", version: { increment: 1 } } });
    await appendAudit(tx, actor, { entityType: "INFORMATIONAL_EVENT", schoolEventId: base.id, eventVersionId: current.id, eventType: "EVENT_ARCHIVED", previousStatus: current.status, newStatus: "ARCHIVED", reason, snapshot: eventSnapshot(updated) });
    return updated;
  }, serializable());
}

export async function previewSchoolCalendarEventAudience(client: CalendarClient, academicYear: string, event: any) {
  const roles: Record<string, number> = {};
  let parentUsers = 0;
  let staffUsers = 0;
  let totalUsers = 0;
  if (["CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT"].includes(event.audienceType)) {
    const enrollments = await client.academicYearEnrollment.findMany({
      where: { academicYear, className: event.className, status: "ACTIVE", ...(event.audienceType !== "CLASS" ? { section: event.section ?? "" } : {}) },
      select: { student: { select: { guardians: { select: { guardian: { select: { users: { where: { isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, role: true } } } } } } } } },
      take: 5_000
    });
    const parents = new Set<string>();
    for (const enrollment of enrollments) for (const link of enrollment.student.guardians) for (const user of link.guardian.users) if (user.role === "PARENT") parents.add(user.id);
    parentUsers = parents.size;
    const assignments = await client.timetableAssignment.findMany({
      where: { academicYear, classSection: { className: event.className, isActive: true, ...(event.audienceType !== "CLASS" ? { section: event.section ?? "" } : {}) }, teacher: { isActive: true } },
      select: { teacher: { select: { staffMember: { select: { userId: true, status: true } } } } },
      take: 1_000
    });
    staffUsers = new Set(assignments.map((row: any) => row.teacher.staffMember).filter((staff: any) => staff?.status === "ACTIVE" && staff.userId).map((staff: any) => staff.userId)).size;
    totalUsers = parentUsers + staffUsers;
  } else {
    const allowedRoles = event.audienceType === "LEADERSHIP_ONLY" ? ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"]
      : event.audienceType === "STAFF_ONLY" ? ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "TEACHER"]
      : event.audienceType === "PARENTS_ALL" ? ["PARENT"]
      : event.audienceType === "ROLE_SPECIFIC" ? [event.roleScope]
      : ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "TEACHER", "PARENT", "VIEWER", "ACCOUNTANT", "COMPUTER_OPERATOR"];
    const users = await client.user.findMany({ where: { isActive: true, lifecycleStatus: "ACTIVE", role: { in: allowedRoles.filter(Boolean) } }, select: { id: true, role: true }, take: 10_000 });
    for (const user of users) roles[user.role] = (roles[user.role] ?? 0) + 1;
    parentUsers = roles.PARENT ?? 0;
    staffUsers = users.length - parentUsers;
    totalUsers = users.length;
  }
  if (parentUsers) roles.PARENT = parentUsers;
  if (staffUsers) roles.STAFF_AUTHORISED = staffUsers;
  return { totalUsers, parentUsers, staffUsers, roles, audience: humanCalendarLabel(event.audienceType), className: event.className ?? null, section: event.section ?? null };
}

export async function loadPublishedSchoolCalendar(client: CalendarClient, actor: CalendarActor, input: { academicYear: string; from: unknown; to: unknown; childHandle?: string | null; expectedContextVersion?: number | null }) {
  const academicYear = academicYearValue(input.academicYear);
  const range = calendarDateRange(input.from, input.to);
  let child: any = null;
  let teacherTargets: Array<{ className: string; section: string }> = [];
  if (actor.role === "PARENT") {
    if (!actor.sessionId) throw new AcademicCalendarError("The Parent context is unavailable.", 403, "CALENDAR_CONTEXT_REQUIRED");
    try {
      child = await resolveActiveParentChildContext(client, { userId: actor.id, sessionId: actor.sessionId, roleAssignmentId: actor.roleAssignmentId, academicYear, childHandle: input.childHandle, expectedContextVersion: input.expectedContextVersion });
    } catch (error) {
      if (error instanceof ParentChildContextError) throw new AcademicCalendarError("The linked-child context changed. Refresh and select the child again.", 403, "CALENDAR_CONTEXT_STALE");
      throw error;
    }
  } else if (actor.role === "TEACHER") {
    const staff = await client.staffMember.findUnique({
      where: { userId: actor.id },
      select: { status: true, timetableTeacher: { select: { isActive: true, assignments: { where: { academicYear, classSection: { isActive: true } }, select: { classSection: { select: { className: true, section: true } } } } } } }
    });
    if (!staff || staff.status !== "ACTIVE" || !staff.timetableTeacher?.isActive) throw new AcademicCalendarError("No active Staff and timetable scope is available.", 403, "CALENDAR_TEACHER_SCOPE_REQUIRED");
    teacherTargets = [...new Map(staff.timetableTeacher.assignments.map((row: any) => [`${row.classSection.className}:${row.classSection.section}`, row.classSection])).values()] as Array<{ className: string; section: string }>;
  }
  const versions = await client.academicCalendarVersion.findMany({
    where: { academicYear, status: "PUBLISHED", currentPublicationKey: { not: null } },
    include: { days: { where: { dayDate: { gte: range.from, lte: range.to } }, orderBy: { dayDate: "asc" } } },
    orderBy: { versionNumber: "desc" },
    take: 50
  });
  const visibleDays = new Map<string, any>();
  for (const version of versions) for (const day of version.days) {
    if (!dayVisible(day, actor.role, child?.child, teacherTargets)) continue;
    const key = dateKey(day.dayDate);
    const existing = visibleDays.get(key);
    if (!existing || scopeSpecificity(day.scopeType) > scopeSpecificity(existing.scopeType)) visibleDays.set(key, day);
  }
  const eventRows = await client.schoolCalendarEventVersion.findMany({
    where: { status: "PUBLISHED", currentPublicationKey: { not: null }, startsAt: { lte: range.to }, endsAt: { gte: range.from }, event: { academicYear } },
    include: { event: { select: { publicKey: true, eventNumber: true, academicYear: true } }, examinationTimetableVersion: { include: { examination: { select: { id: true, name: true, examCode: true } }, classScope: { select: { id: true, className: true, section: true } } } } },
    orderBy: [{ startsAt: "asc" }, { title: "asc" }],
    take: 2_000
  });
  const visibleEvents = [];
  for (const event of eventRows) {
    if (!eventVisible(event, actor.role, child?.child, teacherTargets)) continue;
    const examinationReference = event.examinationTimetableVersion ? await currentExamReference(client, event.examinationTimetableVersion, actor.role, child?.child, teacherTargets) : null;
    visibleEvents.push(publicEvent(event, actor.role, examinationReference));
  }
  return {
    academicYear,
    from: dateKey(range.from),
    to: dateKey(range.to),
    context: child ? { childHandle: child.handle, contextVersion: child.contextVersion, child: { studentName: child.child.studentName, className: child.child.className, section: child.child.section } } : null,
    days: [...visibleDays.values()].sort((a, b) => a.dayDate.valueOf() - b.dayDate.valueOf()).map(publicDay),
    events: visibleEvents,
    upcoming: visibleEvents.filter((event) => new Date(event.endsAt) >= new Date()).slice(0, 12),
    totals: operationalDayTotals([...visibleDays.values()]),
    basisNotice: "Only approved operational day classifications affect working-day totals. Informational events never change day status."
  };
}

export async function captureAttendanceCalendarBasis(client: CalendarClient, input: { academicYear: string; attendanceDate: Date; className: string; section: string }) {
  const versions = await client.academicCalendarVersion.findMany({ where: { academicYear: input.academicYear, status: "PUBLISHED", currentPublicationKey: { not: null } }, include: { days: { where: { dayDate: input.attendanceDate } } }, take: 20 });
  const candidates = versions.flatMap((version: any) => version.days.map((day: any) => ({ version, day }))).filter(({ day }: any) => day.scopeType === "SCHOOL_WIDE" || (day.className === input.className && (day.scopeType === "CLASS" || day.section === input.section)));
  candidates.sort((left: any, right: any) => scopeSpecificity(right.day.scopeType) - scopeSpecificity(left.day.scopeType));
  const selected = candidates[0];
  return selected ? {
    operationalCalendarVersionKey: selected.version.publicKey,
    operationalCalendarDayKey: selected.day.publicKey,
    calendarBasisSnapshotJson: JSON.stringify({ calendarVersion: selected.version.versionNumber, status: selected.version.status, dayType: selected.day.dayType, dayDate: dateKey(selected.day.dayDate), scopeType: selected.day.scopeType, className: selected.day.className, section: selected.day.section })
  } : { operationalCalendarVersionKey: null, operationalCalendarDayKey: null, calendarBasisSnapshotJson: JSON.stringify({ basis: "UNCLASSIFIED", inferred: false }) };
}

export async function currentReportCalendarBasis(client: CalendarClient, input: { academicYear: string; className: string; section?: string | null }) {
  const versions = await client.academicCalendarVersion.findMany({ where: { academicYear: input.academicYear, status: "PUBLISHED", currentPublicationKey: { not: null } }, include: { days: true }, take: 20 });
  const visible = versions.filter((version: any) => version.effectiveScope === "SCHOOL_WIDE" || (version.className === input.className && (version.effectiveScope === "CLASS" || version.section === (input.section ?? ""))));
  visible.sort((left: any, right: any) => scopeSpecificity(right.effectiveScope) - scopeSpecificity(left.effectiveScope));
  const selected = visible[0];
  return selected ? { calendarBasisVersionKey: selected.publicKey, calendarBasisSnapshotJson: JSON.stringify({ versionNumber: selected.versionNumber, academicYear: selected.academicYear, scope: selected.scopeKey, totals: operationalDayTotals(selected.days), publishedAt: selected.publishedAt?.toISOString() ?? null }) } : { calendarBasisVersionKey: null, calendarBasisSnapshotJson: JSON.stringify({ basis: "UNCLASSIFIED", inferred: false }) };
}

export function academicCalendarCsv(rows: Array<any>) {
  const header = ["Date", "Entry kind", "Type", "Title", "Audience or scope", "Class", "Section", "Start", "End", "Venue", "Status", "Changed"];
  const lines = [header, ...rows.slice(0, 10_000).map((row) => [row.date ?? row.startsAt?.slice(0, 10) ?? "", row.kind, row.typeLabel ?? humanCalendarLabel(row.dayType ?? row.eventType), row.title, row.audienceLabel ?? row.scopeLabel ?? "", row.className ?? "", row.section ?? "", row.startsAt ?? "", row.endsAt ?? "", row.venue ?? "", row.status ?? "Published", row.replacesVersionId ? "Yes" : "No"])];
  return lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
}

async function normalizeSchoolEvent(client: CalendarClient, academicYear: string, source: Record<string, any>): Promise<NormalizedSchoolEvent> {
  const eventType = allowed(source.eventType, SCHOOL_EVENT_TYPES, "event type");
  const title = requiredText(source.title, "Event title", CALENDAR_TITLE_MAX);
  const description = optionalText(source.description, "Event description", CALENDAR_DESCRIPTION_MAX);
  const startsAt = dateTime(source.startsAt, "Event start");
  const endsAt = dateTime(source.endsAt ?? source.startsAt, "Event end");
  if (endsAt < startsAt || endsAt.valueOf() - startsAt.valueOf() > 370 * 86_400_000) throw new AcademicCalendarError("Event end must follow its start within a bounded range.");
  if (!attendanceDateBelongsToAcademicYear(startsAt, academicYear) || !attendanceDateBelongsToAcademicYear(endsAt, academicYear)) throw new AcademicCalendarError("Event dates must belong to the selected academic year.");
  const audienceType = allowed(source.audienceType, SCHOOL_EVENT_AUDIENCES, "event audience");
  const roleScope = audienceType === "ROLE_SPECIFIC" ? allowedRole(source.roleScope) : null;
  let classSectionId: string | null = null, className: string | null = null, section: string | null = null;
  if (["CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT"].includes(audienceType)) {
    const scopeType = audienceType === "CLASS" ? "CLASS" : "CLASS_SECTION";
    const scope = await validateScope(client, academicYear, scopeType as CalendarScope, source.className, source.section);
    className = scope.className;
    section = scope.section;
    const classSection = await client.timetableClassSection.findUnique({ where: { academicYear_className_section: { academicYear, className: className!, section: scopeType === "CLASS" ? String(source.section ?? "").trim().toUpperCase() : section ?? "" } }, select: { id: true, isActive: true } }).catch(() => null);
    classSectionId = classSection?.isActive ? classSection.id : null;
    if (scopeType === "CLASS_SECTION" && !classSectionId) throw new AcademicCalendarError("Choose an active class and section.");
  }
  let examinationTimetableVersionId: string | null = null;
  if (source.examinationTimetableKey) {
    const timetable = await client.examinationTimetableVersion.findUnique({ where: { publicKey: boundedHandle(source.examinationTimetableKey) }, select: { id: true, status: true, currentPublicationKey: true, academicYear: true, className: true, section: true } });
    if (!timetable || timetable.status !== "PUBLISHED" || !timetable.currentPublicationKey || timetable.academicYear !== academicYear) throw new AcademicCalendarError("Choose the current published examination timetable for this academic year.");
    if (className && (timetable.className !== className || (audienceType !== "CLASS" && timetable.section !== (section ?? "")))) throw new AcademicCalendarError("The examination timetable does not match the event cohort.");
    examinationTimetableVersionId = timetable.id;
  }
  if (eventType === "EXAMINATION_REFERENCE" && !examinationTimetableVersionId) throw new AcademicCalendarError("An examination-reference event requires a current published timetable.");
  const venue = optionalText(source.venue, "Venue", 250);
  const parentInstructions = optionalText(source.parentInstructions, "Parent instructions", CALENDAR_INSTRUCTIONS_MAX);
  const internalNotes = optionalText(source.internalNotes, "Internal notes", CALENDAR_NOTES_MAX);
  for (const value of [title, description, venue, parentInstructions, internalNotes]) rejectHiddenUrlOrAttachment(value);
  const allDay = source.allDay === undefined ? true : Boolean(source.allDay);
  const isImportant = Boolean(source.isImportant);
  const audienceKey = `${audienceType}:${roleScope ?? ""}:${className ?? ""}:${section ?? ""}`;
  const content = { eventType, title, description, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), allDay, venue, parentInstructions, internalNotes, audienceType, roleScope, className, section, examinationTimetableVersionId, isImportant };
  return { eventType, title, description, startsAt, endsAt, allDay, venue, parentInstructions, internalNotes, audienceType, roleScope, classSectionId, className, section, audienceKey, examinationTimetableVersionId, isImportant, contentHash: sha256(content) };
}

export function normalizeOperationalDays(value: unknown): NormalizedOperationalDay[] {
  if (!Array.isArray(value) || value.length > CALENDAR_MAX_DAYS_PER_VERSION) throw new AcademicCalendarError(`Operational days must be an array of at most ${CALENDAR_MAX_DAYS_PER_VERSION} entries.`);
  const output = value.map((item) => {
    const source = objectInput(item);
    const dayDate = dateOnly(source.dayDate, "Calendar date");
    const dayType = allowed(source.dayType, OPERATIONAL_DAY_TYPES, "operational day type");
    const sourceType = allowed(source.sourceType ?? defaultSource(dayType), OPERATIONAL_DAY_SOURCES, "day source");
    const scopeType = allowed(source.scopeType ?? "SCHOOL_WIDE", CALENDAR_SCOPES, "day scope");
    const className = scopeType === "SCHOOL_WIDE" ? null : requiredText(source.className, "Class", 80);
    const section = scopeType === "CLASS_SECTION" ? requiredText(source.section, "Section", 40).toUpperCase() : null;
    const title = requiredText(source.title ?? humanCalendarLabel(dayType), "Day title", CALENDAR_TITLE_MAX);
    const halfDaySession = dayType === "HALF_DAY" ? requiredText(source.halfDaySession, "Half-day session", 80) : null;
    const publicInstructions = optionalText(source.publicInstructions, "Public instructions", CALENDAR_INSTRUCTIONS_MAX);
    const reason = optionalText(source.reason, "Day reason", CALENDAR_REASON_MAX);
    if (dayType === "EMERGENCY_CLOSURE" && !reason) throw new AcademicCalendarError("Emergency closure requires a reason.");
    const scopeKey = `${scopeType}:${className ?? ""}:${section ?? ""}`;
    const content = { dayDate: dateKey(dayDate), dayType, sourceType, scopeType, className, section, title, halfDaySession, publicInstructions, reason };
    return { dayDate, dayType, sourceType, scopeType, className, section, scopeKey, title, halfDaySession, publicInstructions, reason, contentHash: sha256(content) };
  });
  const keys = output.map((day) => `${dateKey(day.dayDate)}:${day.scopeKey}`);
  if (new Set(keys).size !== keys.length) throw new AcademicCalendarError("Operational day classifications overlap for the same date and scope.");
  return output.sort((left, right) => left.dayDate.valueOf() - right.dayDate.valueOf() || left.scopeKey.localeCompare(right.scopeKey));
}

async function validateScope(client: CalendarClient, academicYear: string, scopeType: CalendarScope, classValue: unknown, sectionValue: unknown) {
  if (scopeType === "SCHOOL_WIDE") return { className: null, section: null, scopeKey: "SCHOOL_WIDE::" };
  const className = requiredText(classValue, "Class", 80);
  const section = scopeType === "CLASS_SECTION" ? requiredText(sectionValue, "Section", 40).toUpperCase() : null;
  const exists = await client.timetableClassSection.findFirst({ where: { academicYear, className, isActive: true, ...(scopeType === "CLASS_SECTION" ? { section } : {}) }, select: { id: true } });
  if (!exists) throw new AcademicCalendarError("The selected class or section is not active in this academic year.");
  return { className, section, scopeKey: `${scopeType}:${className}:${section ?? ""}` };
}

async function assertKnownAcademicYear(client: CalendarClient, academicYear: string) {
  const [settings, classSection, enrollment, examination] = await Promise.all([
    client.schoolSettings.findUnique({ where: { id: "school" }, select: { academicYear: true } }),
    client.timetableClassSection.findFirst({ where: { academicYear }, select: { id: true } }),
    client.academicYearEnrollment.findFirst({ where: { academicYear }, select: { id: true } }),
    client.examination.findFirst({ where: { academicYear }, select: { id: true } })
  ]);
  if (settings?.academicYear !== academicYear && !classSection && !enrollment && !examination) throw new AcademicCalendarError("The academic year is not present in school configuration or active academic records.");
}

async function assertTeacherEventProposalScope(client: CalendarClient, actor: CalendarActor, academicYear: string, event: NormalizedSchoolEvent) {
  if (!["CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT"].includes(event.audienceType) || !event.className) throw new AcademicCalendarError("Teachers may propose only an exact assigned class or section event.", 403);
  const staff = await client.staffMember.findUnique({ where: { userId: actor.id }, select: { status: true, timetableTeacherId: true } });
  if (!staff || staff.status !== "ACTIVE" || !staff.timetableTeacherId) throw new AcademicCalendarError("No active Staff and timetable link is available.", 403);
  const assignment = await client.timetableAssignment.findFirst({ where: { academicYear, teacherId: staff.timetableTeacherId, classSection: { className: event.className, isActive: true, ...(event.audienceType !== "CLASS" ? { section: event.section ?? "" } : {}) } }, select: { id: true } });
  if (!assignment) throw new AcademicCalendarError("The event cohort is outside this Teacher's active timetable scope.", 403);
}

async function assertCurrentExamReference(client: CalendarClient, event: any) {
  if (!event.examinationTimetableVersionId) throw new AcademicCalendarError("The examination reference is missing.");
  const timetable = await client.examinationTimetableVersion.findUnique({ where: { id: event.examinationTimetableVersionId }, select: { status: true, currentPublicationKey: true } });
  if (!timetable || timetable.status !== "PUBLISHED" || !timetable.currentPublicationKey) throw new AcademicCalendarError("The referenced examination timetable is no longer the current publication.");
}

async function currentExamReference(client: CalendarClient, source: any, role: string, child: any, teacherTargets: Array<{ className: string; section: string }>) {
  const current = await client.examinationTimetableVersion.findFirst({
    where: { examinationId: source.examination.id, classScopeId: source.classScope.id, status: "PUBLISHED", currentPublicationKey: { not: null } },
    include: { examination: { select: { name: true, examCode: true } }, rows: { orderBy: { displayOrder: "asc" } } }
  });
  if (!current) return null;
  if (role === "PARENT" && (!child || child.className !== current.className || (child.section ?? "") !== current.section)) return null;
  if (role === "TEACHER" && !teacherTargets.some((target) => target.className === current.className && target.section === current.section)) return null;
  return { versionNumber: current.versionNumber, examination: current.examination.name, examCode: current.examination.examCode, className: current.className, section: current.section, rows: current.rows.map((row: any) => ({ subject: row.subjectNameSnapshot, paper: row.paperNameSnapshot, examDate: dateKey(row.examDate), startTime: row.startTime, endTime: row.endTime, venue: row.venue, parentInstructions: role === "PARENT" ? row.parentInstructions : row.parentInstructions })) };
}

async function ensureCalendarEventNotification(client: CalendarClient, base: any, version: any, actor: CalendarActor) {
  if (!["SCHOOL_WIDE", "PARENTS_ALL", "CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT"].includes(version.audienceType) && !version.isImportant) return;
  const campaignNumber = `CAL23E-${base.eventNumber}-V${version.versionNumber}`.slice(0, 96);
  const existing = await client.notificationCampaign.findUnique({ where: { campaignNumber }, select: { id: true } });
  if (existing) return;
  const recipients = await resolveCalendarNotificationUsers(client, base.academicYear, version);
  if (!recipients.length) return;
  await client.$transaction(async (tx: any) => {
    const campaign = await tx.notificationCampaign.create({ data: { campaignNumber, category: "ACADEMIC", priority: version.isImportant ? "HIGH" : "NORMAL", title: version.title, body: version.description ?? version.parentInstructions ?? `${humanCalendarLabel(version.eventType)} on ${dateKey(version.startsAt)}.`, audienceType: "SPECIFIC_USERS", audienceDefinitionJson: JSON.stringify({ source: "SCHOOL_CALENDAR", audienceType: version.audienceType, academicYear: base.academicYear, className: version.className, section: version.section }), audienceSnapshotJson: JSON.stringify({ sourceVersion: version.versionNumber, resolvedCount: recipients.length }), channel: "IN_APP", status: "PUBLISHED", totalResolvedUsers: recipients.length, totalRecipientRows: recipients.length, createdByUserId: actor.id, approvedByUserId: actor.id, publishedByUserId: actor.id, approvedAt: new Date(), publishedAt: new Date() } });
    for (const recipient of recipients) await tx.notificationRecipient.create({ data: { campaignId: campaign.id, userId: recipient.userId, recipientRoleSnapshot: recipient.role, contextType: recipient.contextType, recipientContextJson: JSON.stringify(recipient.context), deliveryStatus: "AVAILABLE", availableAt: new Date() } });
    await tx.notificationEvent.create({ data: { campaignId: campaign.id, eventType: "CALENDAR_EVENT_PUBLISHED", newStatus: "PUBLISHED", recordedByUserId: actor.id, notes: `Resolved ${recipients.length} authorised in-app recipients.` } });
  }, serializable());
}

async function resolveCalendarNotificationUsers(client: CalendarClient, academicYear: string, version: any) {
  const recipients = new Map<string, any>();
  if (["CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT"].includes(version.audienceType)) {
    const enrollments = await client.academicYearEnrollment.findMany({ where: { academicYear, className: version.className, status: "ACTIVE", ...(version.audienceType !== "CLASS" ? { section: version.section ?? "" } : {}) }, select: { student: { select: { guardians: { select: { guardian: { select: { users: { where: { isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, role: true } } } } } } } } }, take: 5_000 });
    for (const enrollment of enrollments) for (const link of enrollment.student.guardians) for (const user of link.guardian.users) if (user.role === "PARENT") recipients.set(user.id, { userId: user.id, role: "PARENT", contextType: "GUARDIAN", context: { academicYear, className: version.className, section: version.section } });
  } else {
    const roles = version.audienceType === "PARENTS_ALL" ? ["PARENT"] : ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "TEACHER", "PARENT"];
    const users = await client.user.findMany({ where: { isActive: true, lifecycleStatus: "ACTIVE", role: { in: roles } }, select: { id: true, role: true }, take: 10_000 });
    for (const user of users) recipients.set(user.id, { userId: user.id, role: user.role, contextType: user.role === "PARENT" ? "GUARDIAN" : "GENERAL_USER", context: { academicYear } });
  }
  return [...recipients.values()];
}

async function appendAudit(tx: CalendarClient, actor: CalendarActor, input: { entityType: string; calendarVersionId?: string; schoolEventId?: string; eventVersionId?: string; eventType: string; previousStatus?: string; newStatus?: string; reason?: string | null; snapshot: unknown }) {
  return tx.academicCalendarAuditEvent.create({ data: { entityType: input.entityType, calendarVersionId: input.calendarVersionId ?? null, schoolEventId: input.schoolEventId ?? null, eventVersionId: input.eventVersionId ?? null, eventType: input.eventType, previousStatus: input.previousStatus ?? null, newStatus: input.newStatus ?? null, reason: input.reason ?? null, actorUserId: actor.id, actorLabel: safeActorLabel(actor.name), snapshotJson: JSON.stringify(input.snapshot), eventDate: new Date() } });
}

function calendarSnapshot(version: any) {
  return { publicKey: version.publicKey, academicYear: version.academicYear, versionNumber: version.versionNumber, status: version.status, scope: version.scopeKey, title: version.title, replacesVersionKey: version.replacesVersion?.publicKey ?? null, attendanceReconciliationRequired: Boolean(version.attendanceReconciliationRequired) };
}

function eventSnapshot(version: any) {
  return { publicKey: version.publicKey, versionNumber: version.versionNumber, status: version.status, eventType: version.eventType, title: version.title, startsAt: version.startsAt?.toISOString?.() ?? version.startsAt, endsAt: version.endsAt?.toISOString?.() ?? version.endsAt, audienceType: version.audienceType, roleScope: version.roleScope, className: version.className, section: version.section, contentHash: version.contentHash };
}

function publicAudit(row: any) {
  return { eventType: row.eventType, previousStatus: row.previousStatus, newStatus: row.newStatus, reason: row.reason, actorLabel: row.actorLabel, eventDate: row.eventDate, snapshot: safeJson(row.snapshotJson) };
}

function publicDay(day: any) {
  return { kind: "OPERATIONAL_DAY", date: dateKey(day.dayDate), dayType: day.dayType, typeLabel: humanCalendarLabel(day.dayType), title: day.title, scopeType: day.scopeType, scopeLabel: humanCalendarLabel(day.scopeType), className: day.className, section: day.section, halfDaySession: day.halfDaySession, instructions: day.publicInstructions, reason: day.dayType === "EMERGENCY_CLOSURE" ? day.reason : null };
}

function publicEvent(event: any, role: string, examinationReference: any) {
  return { kind: "INFORMATIONAL_EVENT", eventNumber: event.event.eventNumber, versionNumber: event.versionNumber, changed: Boolean(event.replacesVersionId), eventType: event.eventType, typeLabel: humanCalendarLabel(event.eventType), title: event.title, description: event.description, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString(), allDay: event.allDay, venue: event.venue, audienceType: event.audienceType, audienceLabel: humanCalendarLabel(event.audienceType), className: event.className, section: event.section, instructions: role === "PARENT" ? event.parentInstructions : event.parentInstructions, examinationReference };
}

function dayVisible(day: any, role: string, child: any, teacherTargets: Array<{ className: string; section: string }>) {
  if (day.scopeType === "SCHOOL_WIDE") return true;
  if (role === "PARENT") return Boolean(child && child.className === day.className && (day.scopeType === "CLASS" || (child.section ?? "") === (day.section ?? "")));
  if (role === "TEACHER") return teacherTargets.some((target) => target.className === day.className && (day.scopeType === "CLASS" || target.section === (day.section ?? "")));
  return ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
}

export function eventVisible(event: any, role: string, child: any, teacherTargets: Array<{ className: string; section: string }>) {
  if (event.status !== "PUBLISHED" || !event.currentPublicationKey) return false;
  if (event.audienceType === "SCHOOL_WIDE") return true;
  if (event.audienceType === "LEADERSHIP_ONLY") return ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
  if (event.audienceType === "STAFF_ONLY") return ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "TEACHER"].includes(role);
  if (event.audienceType === "PARENTS_ALL") return role === "PARENT" || ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
  if (event.audienceType === "ROLE_SPECIFIC") return role === event.roleScope || ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role);
  if (["CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT"].includes(event.audienceType)) {
    if (["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role)) return true;
    if (role === "PARENT") return Boolean(child && child.className === event.className && (event.audienceType === "CLASS" || (child.section ?? "") === (event.section ?? "")));
    if (role === "TEACHER") return teacherTargets.some((target) => target.className === event.className && (event.audienceType === "CLASS" || target.section === (event.section ?? "")));
  }
  return false;
}

function scopeSpecificity(scope: string) { return scope === "CLASS_SECTION" ? 3 : scope === "CLASS" ? 2 : 1; }

function defaultSource(type: OperationalDayType): OperationalDaySource {
  if (type === "VACATION_DAY") return "VACATION";
  if (type === "SPECIAL_WORKING_DAY") return "SPECIAL_WORKING";
  if (type === "HALF_DAY") return "HALF_DAY";
  if (type === "EMERGENCY_CLOSURE") return "EMERGENCY_CLOSURE";
  if (type === "NON_WORKING_DAY") return "HOLIDAY";
  return "MANUAL";
}

function assertLeadership(actor: CalendarActor) {
  if (!["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(actor.role)) throw new AcademicCalendarError("Only authorised leadership may perform this calendar workflow.", 403, "CALENDAR_LEADERSHIP_REQUIRED");
}

function staleCalendarError() { return new AcademicCalendarError("Calendar state changed. Refresh and review the latest version.", 409, "CALENDAR_STALE_VERSION"); }
function serializable() { return { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 30_000 } as const; }
function sha256(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function dateKey(value: Date) { return value.toISOString().slice(0, 10); }
function newSchoolEventNumber() { return `EVT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`; }
function safeActorLabel(value: string) { return requiredText(value || "Authorised user", "Actor label", 120); }
function safeErrorMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 500) : "Notification creation failed"; }
function boundedHandle(value: unknown) { return requiredText(value, "Record handle", 120); }
function requiredIdempotencyKey(value: unknown) { const key = requiredText(value, "Idempotency key", 120); if (!/^[A-Za-z0-9:_-]+$/.test(key)) throw new AcademicCalendarError("Idempotency key contains unsupported characters."); return key; }
function allowedRole(value: unknown) { const role = String(value ?? "").trim().toUpperCase(); if (!["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "ACCOUNTANT", "COMPUTER_OPERATOR", "TEACHER", "PARENT", "VIEWER"].includes(role)) throw new AcademicCalendarError("Choose a valid role audience."); return role; }
function allowed<T extends readonly string[]>(value: unknown, values: T, label: string): T[number] { const text = String(value ?? "").trim().toUpperCase(); if (!(values as readonly string[]).includes(text)) throw new AcademicCalendarError(`Choose a valid ${label}.`); return text as T[number]; }
function requiredText(value: unknown, label: string, maximum: number) { const text = String(value ?? "").trim(); if (!text || text.length > maximum) throw new AcademicCalendarError(`${label} is required and must contain at most ${maximum} characters.`); return text; }
function optionalText(value: unknown, label: string, maximum: number) { if (value === null || value === undefined || String(value).trim() === "") return null; return requiredText(value, label, maximum); }
function objectInput(value: unknown): Record<string, any> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new AcademicCalendarError("A valid calendar payload is required."); return value as Record<string, any>; }
function dateOnly(value: unknown, label: string) { const text = String(value ?? "").trim(); if (!/^20\d{2}-\d{2}-\d{2}$/.test(text)) throw new AcademicCalendarError(`${label} must use YYYY-MM-DD.`); const date = new Date(`${text}T00:00:00.000Z`); if (Number.isNaN(date.valueOf()) || dateKey(date) !== text) throw new AcademicCalendarError(`${label} is invalid.`); return date; }
function dateTime(value: unknown, label: string) { const text = String(value ?? "").trim(); if (text.length > 40) throw new AcademicCalendarError(`${label} is invalid.`); const date = new Date(text); if (!text || Number.isNaN(date.valueOf())) throw new AcademicCalendarError(`${label} is invalid.`); return date; }
function rejectHiddenUrlOrAttachment(value: string | null) { if (!value) return; if (/https?:\/\/|www\.|file:\/\/|attachment|upload/i.test(value)) throw new AcademicCalendarError("Calendar content cannot contain external URLs or attachment instructions."); }
function safeJson(value: string) { try { return JSON.parse(value); } catch { return null; } }
function csvCell(value: unknown) { let text = String(value ?? "").replaceAll('"', '""'); if (/^[=+\-@]/.test(text)) text = `'${text}`; return `"${text}"`; }
