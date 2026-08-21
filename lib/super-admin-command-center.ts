import type { PrismaClient } from "@prisma/client";
import { schoolDateKey } from "@/lib/format";
import { attendanceDay } from "@/lib/student-attendance";
import { getTechnicalOperationsDashboard } from "@/lib/technical-operations";
import type { OperationalStatus, TechnicalOperationsDashboard } from "@/lib/technical-operations-types";
import { summarizeSuperAdminWork } from "@/lib/super-admin-work";

export const COMMAND_CENTER_TIMEOUT_MS = 1_500;
export const COMMAND_CENTER_ACTIVITY_LIMIT = 12;

export type CommandCenterWidgetState = "OK" | "EMPTY" | "DEGRADED" | "UNAVAILABLE";

export type CommandCenterMetric = {
  id: string;
  label: string;
  value: string | number | null;
  detail: string;
  state: CommandCenterWidgetState;
  href: string;
  items?: Array<{ label: string; meta: string }>;
};

export type CommandCenterHealthItem = {
  id: string;
  label: string;
  status: OperationalStatus;
  detail: string;
};

export type CommandCenterActivity = {
  time: string;
  action: string;
  module: string;
  actor: string;
  result: string;
};

export type CommandCenterSource<T> = {
  state: CommandCenterWidgetState;
  data: T;
  message: string | null;
};

export type SuperAdminCommandCenter = {
  generatedAt: string;
  readOnly: true;
  timeoutMs: number;
  today: CommandCenterMetric[];
  schoolPulse: CommandCenterMetric[];
  systemHealth: CommandCenterSource<{
    generatedAt: string | null;
    overall: OperationalStatus | null;
    items: CommandCenterHealthItem[];
  }>;
  recentActivity: CommandCenterSource<CommandCenterActivity[]>;
  workSummary: CommandCenterSource<CommandCenterMetric[]>;
  quickAccess: Array<{ label: string; href: string }>;
  workProgramme: Array<{ title: string; status: "LIVE" | "PLANNED" | "BLOCKED BY DEPENDENCY"; detail: string; href?: string }>;
  udise: Array<{ label: string; status: string }>;
  mobile: Array<{ label: string; status: string }>;
};

export type CommandCenterReaders = {
  today(): Promise<CommandCenterMetric[]>;
  schoolPulse(): Promise<CommandCenterMetric[]>;
  systemHealth(): Promise<{ generatedAt: string; overall: OperationalStatus; items: CommandCenterHealthItem[] }>;
  recentActivity(): Promise<CommandCenterActivity[]>;
  workSummary(): Promise<CommandCenterMetric[]>;
};

export async function getSuperAdminCommandCenter(
  client: PrismaClient,
  academicYear: string,
  ownerUserId: string,
  options: { now?: Date; timeoutMs?: number } = {}
): Promise<SuperAdminCommandCenter> {
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? COMMAND_CENTER_TIMEOUT_MS;
  return composeSuperAdminCommandCenter(createCommandCenterReaders(client, academicYear, ownerUserId, now, timeoutMs), { now, timeoutMs });
}

export async function composeSuperAdminCommandCenter(
  readers: CommandCenterReaders,
  options: { now?: Date; timeoutMs?: number } = {}
): Promise<SuperAdminCommandCenter> {
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? COMMAND_CENTER_TIMEOUT_MS;
  const [today, schoolPulse, systemHealth, recentActivity, workSummary] = await Promise.all([
    safeSource(() => readers.today(), [], timeoutMs),
    safeSource(() => readers.schoolPulse(), [], timeoutMs),
    safeSource<{ generatedAt: string | null; overall: OperationalStatus | null; items: CommandCenterHealthItem[] }>(
      () => readers.systemHealth(),
      { generatedAt: null, overall: null, items: [] },
      timeoutMs
    ),
    safeSource(() => readers.recentActivity(), [], timeoutMs),
    safeSource(() => readers.workSummary(), [], timeoutMs)
  ]);

  return {
    generatedAt: now.toISOString(),
    readOnly: true,
    timeoutMs,
    today: today.data,
    schoolPulse: schoolPulse.data,
    systemHealth,
    recentActivity,
    workSummary,
    quickAccess: [
      { label: "Students", href: "/students" },
      { label: "Admissions", href: "/admission-crm" },
      { label: "Fees", href: "/pending-dues" },
      { label: "Attendance", href: "/attendance/students" },
      { label: "Exams", href: "/exams" },
      { label: "Report Cards", href: "/report-cards" },
      { label: "Staff", href: "/staff" },
      { label: "Support", href: "/support" },
      { label: "Safe Exit", href: "/student-departures" },
      { label: "Users / IAM", href: "/users" },
      { label: "Release Operations", href: "/release-operations" },
      { label: "Observability", href: "/technical-operations" }
    ],
    workProgramme: [
      { title: "Diary", status: "LIVE", detail: "Private owner-isolated structured daily notes.", href: "/super-admin/my-work" },
      { title: "Tasks & Reminders", status: "LIVE", detail: "Private due work and local reminder times.", href: "/super-admin/my-work" },
      { title: "Contacts & Suppliers", status: "LIVE", detail: "Private contact reference directory; no procurement automation.", href: "/super-admin/my-work" },
      { title: "Universal Search", status: "BLOCKED BY DEPENDENCY", detail: "Starts after Diary, Tasks and Directory." },
      { title: "Smart AI", status: "BLOCKED BY DEPENDENCY", detail: "Starts only after permission-scoped Universal Search." },
      { title: "Whiteboard", status: "PLANNED", detail: "Canvs remains the planning surface; no ERP whiteboard engine yet." }
    ],
    udise: [
      { label: "Prompt 15D", status: "Read-only foundation complete" },
      { label: "Prompt 15E", status: "Waiting for current portal evidence" }
    ],
    mobile: [
      { label: "Responsive Web", status: "Cleared" },
      { label: "PWA foundation", status: "Cleared" },
      { label: "Physical device certification", status: "Pending staging" },
      { label: "Android native", status: "Not implemented" },
      { label: "iOS / iPadOS native", status: "Not implemented" }
    ]
  };
}

export function isSuperAdminCommandCenterRole(role: string) {
  return role === "SUPER_ADMIN";
}

export function humanizeCommandCenterValue(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9 _-]/g, " ").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return safe ? safe.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase()) : "Completed";
}

function createCommandCenterReaders(
  client: PrismaClient,
  academicYear: string,
  ownerUserId: string,
  now: Date,
  timeoutMs: number
): CommandCenterReaders {
  const operationsPromise = getTechnicalOperationsDashboard(client);
  return {
    today: () => loadToday(client, academicYear, now, operationsPromise, timeoutMs),
    schoolPulse: () => loadSchoolPulse(client, academicYear, now, timeoutMs),
    systemHealth: async () => summarizeTechnicalOperations(await operationsPromise),
    recentActivity: () => loadRecentActivity(client),
    workSummary: () => loadWorkProgrammeSummary(client, ownerUserId, now)
  };
}

async function loadWorkProgrammeSummary(client: PrismaClient, ownerUserId: string, now: Date): Promise<CommandCenterMetric[]> {
  const summary = await summarizeSuperAdminWork(client, { id: ownerUserId, role: "SUPER_ADMIN" }, now);
  return [
    { id: "work-today", label: "Today’s tasks", value: summary.todayTasks, detail: "Private tasks due today", state: summary.todayTasks ? "OK" : "EMPTY", href: "/super-admin/my-work" },
    { id: "work-overdue", label: "Overdue tasks", value: summary.overdueTasks, detail: "Incomplete private tasks before today", state: summary.overdueTasks ? "OK" : "EMPTY", href: "/super-admin/my-work" },
    { id: "work-reminders", label: "Upcoming reminders", value: summary.upcomingReminders, detail: "Private reminder times in the next seven days", state: summary.upcomingReminders ? "OK" : "EMPTY", href: "/super-admin/my-work", items: summary.reminderItems.map((row) => ({ label: row.title, meta: row.at })) },
    { id: "work-diary", label: "Recent diary entries", value: summary.recentDiary.length, detail: "Latest owner-isolated entries", state: summary.recentDiary.length ? "OK" : "EMPTY", href: "/super-admin/my-work", items: summary.recentDiary.map((row) => ({ label: row.title, meta: `${row.date}T00:00:00+05:30` })) },
    { id: "work-follow-ups", label: "Follow-ups due", value: summary.followUpsDue, detail: "Open diary and active contact follow-ups due", state: summary.followUpsDue ? "OK" : "EMPTY", href: "/super-admin/my-work" },
    { id: "work-contacts", label: "Active contacts", value: summary.activeContacts, detail: `${summary.preferredContacts} preferred active contact${summary.preferredContacts === 1 ? "" : "s"}`, state: summary.activeContacts ? "OK" : "EMPTY", href: "/super-admin/my-work" }
  ];
}

async function loadToday(
  client: PrismaClient,
  academicYear: string,
  now: Date,
  operationsPromise: Promise<TechnicalOperationsDashboard>,
  timeoutMs: number
) {
  const monthAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1_000);
  return Promise.all([
    metric("support", "Pending support", "/support", () => client.supportRequest.count({
      where: { status: { notIn: ["RESOLVED", "CLOSED", "REJECTED_AS_INVALID", "CANCELLED", "ARCHIVED"] } }
    }), "Open complaint, feedback and support items", timeoutMs),
    metric("payslips", "Pending payslip requests", "/payslip-requests", () => client.staffPayslipRequest.count({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "PREPARATION_IN_PROGRESS", "READY_TO_ISSUE", "PARTIALLY_ISSUED"] } }
    }), "Requests awaiting governed completion", timeoutMs),
    metric("safe-exit", "Safe Exit attention", "/student-departures", async () => {
      const [requests, incidents] = await Promise.all([
        client.studentDepartureRequest.count({ where: { academicYear, status: { in: ["REQUESTED", "CONSENT_PENDING", "CONSENT_VERIFIED", "PARENT_UNREACHABLE", "UNDER_SCHOOL_REVIEW", "APPROVED", "READY_FOR_HANDOVER", "RETURN_EXPECTED", "EMERGENCY_OVERRIDE", "UNAUTHORISED_EXIT_SUSPECTED", "UNAUTHORISED_EXIT_CONFIRMED"] } } }),
        client.studentDepartureIncident.count({ where: { status: { notIn: ["CLOSED", "RETURNED"] } } })
      ]);
      return requests + incidents;
    }, "Open requests and safety incidents requiring permitted attention", timeoutMs),
    metric("admissions", "Admissions follow-ups", "/admission-crm", () => client.admissionEnquiry.count({
      where: { desiredAcademicYear: academicYear, nextFollowUpAt: { lte: monthAhead }, status: { notIn: ["ADMITTED", "DECLINED", "WITHDRAWN", "EXPIRED", "ARCHIVED"] } }
    }), "Due or upcoming within 30 days", timeoutMs),
    metric("operations", "Release / operations alerts", "/technical-operations", async () => {
      const operations = await operationsPromise;
      return operations.alerts.length + operations.incidents.length;
    }, "Open OBS-1A alerts and incidents", timeoutMs),
    metric("events", "Important school events", "/calendar", async () => {
      const rows = await client.schoolCalendarEventVersion.findMany({
        where: { status: "PUBLISHED", isImportant: true, startsAt: { gte: now, lte: monthAhead } },
        select: { title: true, startsAt: true },
        orderBy: { startsAt: "asc" },
        take: 3
      });
      return { value: rows.length, items: rows.map((row) => ({ label: boundedText(row.title, "School event"), meta: row.startsAt.toISOString() })) };
    }, "Published important events in the next 30 days", timeoutMs),
    metric("leadership", "Pending leadership actions", "/leave/staff", () => client.staffLeaveRequest.count({ where: { status: "PENDING" } }), "Existing leave actions awaiting review", timeoutMs)
  ]);
}

async function loadSchoolPulse(client: PrismaClient, academicYear: string, now: Date, timeoutMs: number) {
  const day = attendanceDay(schoolDateKey(now));
  return Promise.all([
    metric("students", "Students", "/students", () => client.student.count({ where: { academicYear, deletedAt: null, status: "Active" } }), "Active Student records", timeoutMs),
    metric("enrollments", "Active enrollments", "/students/lifecycle", () => client.academicYearEnrollment.count({ where: { academicYear, status: "ACTIVE" } }), `Academic year ${academicYear}`, timeoutMs),
    metric("guardians", "Guardians", "/guardians", () => client.guardian.count({ where: { status: "Active" } }), "Active Parent / Guardian records", timeoutMs),
    metric("staff", "Staff", "/staff", () => client.staffMember.count({ where: { status: "ACTIVE" } }), "Active teaching and non-teaching Staff", timeoutMs),
    metric("attendance", "Attendance snapshot", "/attendance/students", async () => {
      const sessions = await client.studentAttendanceSession.findMany({
        where: { academicYear, attendanceDate: day },
        select: { records: { select: { status: true } } }
      });
      const records = sessions.flatMap((session) => session.records);
      const present = records.filter((record) => record.status === "PRESENT").length;
      return { value: records.length, detail: records.length ? `${present} present across ${records.length} marked records` : "No attendance session is recorded today" };
    }, "Today’s marked Student attendance", timeoutMs),
    metric("fees", "Fee / dues summary", "/pending-dues", async () => {
      const result = await client.payment.aggregate({
        where: { feeType: "Current Year Fee", deletedAt: null, isCancelled: false },
        _sum: { amountPaid: true },
        _count: { _all: true }
      });
      return { value: result._sum.amountPaid ?? 0, detail: `${result._count._all} active current-year payment record${result._count._all === 1 ? "" : "s"}; exact dues remain in Fees` };
    }, "Current-year fee collections", timeoutMs),
    metric("admissions", "Admissions status", "/admission-crm", async () => {
      const [enquiries, applications] = await Promise.all([
        client.admissionEnquiry.count({ where: { desiredAcademicYear: academicYear, status: { notIn: ["ADMITTED", "DECLINED", "WITHDRAWN", "EXPIRED", "ARCHIVED"] } } }),
        client.admissionApplication.count({ where: { cycle: { academicYear }, status: { in: ["APPLICATION_INVITED", "APPLICATION_IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "WAITLISTED", "OFFERED"] } } })
      ]);
      return { value: enquiries + applications, detail: `${enquiries} active enquiries and ${applications} active applications` };
    }, "Active admissions pipeline", timeoutMs),
    metric("academics", "Academic / exam state", "/exams", () => client.examination.count({ where: { academicYear, status: { notIn: ["CANCELLED", "ARCHIVED"] } } }), "Current-year Examination records", timeoutMs),
    metric("reports", "Report publication", "/report-cards", async () => {
      const [issued, pending] = await Promise.all([
        client.studentReportCard.count({ where: { academicYear, status: "ISSUED" } }),
        client.studentReportCard.count({ where: { academicYear, status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } })
      ]);
      return { value: issued, detail: `${issued} issued; ${pending} awaiting publication` };
    }, "Issued Student report cards", timeoutMs)
  ]);
}

function summarizeTechnicalOperations(operations: TechnicalOperationsDashboard) {
  const wanted = [
    ["CORE_APPLICATION_HEALTH", "Application health"],
    ["DATABASE_HEALTH", "Database"],
    ["MIGRATION_HEALTH", "Migration status"],
    ["DATA_PROTECTION_HEALTH", "Backup freshness"],
    ["STORAGE_CAPACITY_HEALTH", "Storage"],
    ["RELEASE_AND_CLIENT_VERSION_HEALTH", "Release / build version"],
    ["BACKGROUND_WORK_HEALTH", "Background jobs"],
    ["NOTIFICATION_DELIVERY_HEALTH", "Notification providers"],
    ["DOCUMENT_PROCESSING_HEALTH", "Document processing"],
    ["SECURITY_AND_AUTH_HEALTH", "Security / account alerts"]
  ] as const;
  const byDomain = new Map(operations.domains.map((domain) => [domain.domain, domain]));
  const items = wanted.map(([id, label]) => {
    const domain = byDomain.get(id);
    return {
      id,
      label,
      status: domain?.status ?? "UNKNOWN",
      detail: id === "RELEASE_AND_CLIENT_VERSION_HEALTH"
        ? `Version ${boundedText(operations.release.serverVersion, "unknown")} · build ${boundedText(operations.release.buildId, "unknown")}`
        : boundedText(domain?.explanation ?? "OBS-1A source is not available.", "OBS-1A source is not available.")
    } satisfies CommandCenterHealthItem;
  });
  return { generatedAt: operations.generatedAt, overall: operations.conclusions.overall, items };
}

async function loadRecentActivity(client: PrismaClient): Promise<CommandCenterActivity[]> {
  const [iam, admissions, support, payslips, safeExit, reports] = await Promise.all([
    client.userAudit.findMany({
      where: { action: { not: { contains: "TOKEN" } } },
      select: { action: true, actorName: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 4
    }),
    client.admissionEvent.findMany({ select: { eventType: true, eventDate: true, actorUserId: true, newStatus: true }, orderBy: { eventDate: "desc" }, take: 4 }),
    client.supportRequestEvent.findMany({ select: { eventType: true, occurredAt: true, actorUserId: true, newStatus: true }, orderBy: { occurredAt: "desc" }, take: 4 }),
    client.staffPayslipRequestEvent.findMany({ select: { eventType: true, occurredAt: true, actorUserId: true, newStatus: true }, orderBy: { occurredAt: "desc" }, take: 4 }),
    client.studentDepartureEvent.findMany({ select: { eventType: true, occurredAt: true, actorUserId: true, newStatus: true }, orderBy: { occurredAt: "desc" }, take: 4 }),
    client.studentReportCardEvent.findMany({ select: { eventType: true, eventDate: true, recordedByUserId: true, actorLabel: true, newStatus: true }, orderBy: { eventDate: "desc" }, take: 4 })
  ]);
  const actorIds = new Set<string>();
  for (const event of [...admissions, ...support, ...payslips, ...safeExit]) if (event.actorUserId) actorIds.add(event.actorUserId);
  for (const event of reports) if (event.recordedByUserId) actorIds.add(event.recordedByUserId);
  const actors = actorIds.size ? await client.user.findMany({ where: { id: { in: [...actorIds].slice(0, 24) } }, select: { id: true, name: true } }) : [];
  const actorNames = new Map(actors.map((actor) => [actor.id, boundedText(actor.name, "Authorised user")]));
  const events: CommandCenterActivity[] = [
    ...iam.filter((event) => !/(PASSWORD|TOKEN|CREDENTIAL|SECRET)/i.test(event.action)).map((event) => activity(event.createdAt, event.action, "Users / IAM", boundedText(event.actorName, "Authorised user"), "Completed")),
    ...admissions.map((event) => activity(event.eventDate, event.eventType, "Admissions", actorName(actorNames, event.actorUserId), event.newStatus)),
    ...support.map((event) => activity(event.occurredAt, event.eventType, "Support", actorName(actorNames, event.actorUserId), event.newStatus)),
    ...payslips.map((event) => activity(event.occurredAt, event.eventType, "Payslips", actorName(actorNames, event.actorUserId), event.newStatus)),
    ...safeExit.map((event) => activity(event.occurredAt, event.eventType, "Safe Exit", actorName(actorNames, event.actorUserId), event.newStatus)),
    ...reports.map((event) => activity(event.eventDate, event.eventType, "Report Cards", boundedText(event.actorLabel ?? actorName(actorNames, event.recordedByUserId), "System"), event.newStatus))
  ];
  return events.sort((left, right) => right.time.localeCompare(left.time)).slice(0, COMMAND_CENTER_ACTIVITY_LIMIT);
}

async function metric(
  id: string,
  label: string,
  href: string,
  reader: () => Promise<number | { value: number | string; detail?: string; items?: Array<{ label: string; meta: string }> }>,
  detail: string,
  timeoutMs: number
): Promise<CommandCenterMetric> {
  try {
    const result = await withTimeout(reader(), timeoutMs);
    const normalized = typeof result === "number" ? { value: result } : result;
    return {
      id,
      label,
      value: normalized.value,
      detail: normalized.detail ?? detail,
      state: Number(normalized.value) === 0 ? "EMPTY" : "OK",
      href,
      items: normalized.items?.slice(0, 3)
    };
  } catch (error) {
    const timedOut = error instanceof CommandCenterTimeoutError;
    return { id, label, value: null, detail: timedOut ? "Source timed out; other sections remain available." : "Source is not available.", state: timedOut ? "DEGRADED" : "UNAVAILABLE", href };
  }
}

async function safeSource<T>(reader: () => Promise<T>, fallback: T, timeoutMs: number): Promise<CommandCenterSource<T>> {
  try {
    const data = await withTimeout(reader(), timeoutMs);
    const empty = Array.isArray(data) && data.length === 0;
    return { state: empty ? "EMPTY" : "OK", data, message: empty ? "No recent records are available." : null };
  } catch (error) {
    const timedOut = error instanceof CommandCenterTimeoutError;
    return { state: timedOut ? "DEGRADED" : "UNAVAILABLE", data: fallback, message: timedOut ? "Source timed out; the rest of Command Center remains available." : "Source is not available." };
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CommandCenterTimeoutError()), Math.max(1, timeoutMs));
  });
  return Promise.race([promise, timeout]).finally(() => timer && clearTimeout(timer));
}

class CommandCenterTimeoutError extends Error {}

function activity(time: Date, action: string, module: string, actor: string, result: string | null): CommandCenterActivity {
  return {
    time: time.toISOString(),
    action: humanizeCommandCenterValue(action),
    module,
    actor,
    result: humanizeCommandCenterValue(result ?? "Completed")
  };
}

function actorName(names: Map<string, string>, id: string | null) {
  return id ? names.get(id) ?? "Authorised user" : "System";
}

function boundedText(value: string, fallback: string) {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  return normalized || fallback;
}
