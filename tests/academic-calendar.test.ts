import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBackupDocument } from "@/lib/backup";
import { eventVisible, normalizeOperationalDays, operationalDayTotals } from "@/lib/academic-calendar";
import { validateAcademicCalendarBackupRows } from "@/lib/academic-calendar-backup";
import { sanitizeAcademicCalendarPayload } from "@/lib/academic-calendar-api";
import { LEADERSHIP_RESTRICTED_PERMISSIONS, OBJECT_SCOPED_PERMISSIONS } from "@/lib/iam/permission-governance";
import { can } from "@/lib/permissions";
import { parseAndValidateBackup } from "@/lib/restore";

const source = (path: string) => readFileSync(path, "utf8");

describe("Prompt 23E governed academic calendar", () => {
  it("separates operational days from informational event visibility", () => {
    const totals = operationalDayTotals([
      { dayType: "WORKING_DAY" }, { dayType: "SPECIAL_WORKING_DAY" }, { dayType: "HALF_DAY" },
      { dayType: "NON_WORKING_DAY" }, { dayType: "VACATION_DAY" }, { dayType: "EMERGENCY_CLOSURE" }
    ]);
    expect(totals).toMatchObject({ workingDays: 1, specialWorkingDays: 1, halfDays: 1, nonWorkingDays: 1, vacationDays: 1, emergencyClosures: 1, workingDayEquivalent: 2.5 });
    const event = { status: "PUBLISHED", currentPublicationKey: "current", audienceType: "STAFF_ONLY" };
    expect(eventVisible(event, "PARENT", { className: "VI", section: "A" }, [])).toBe(false);
    expect(eventVisible(event, "TEACHER", null, [])).toBe(true);
  });

  it("validates bounded classifications, ranges, emergency reasons and overlap refusal", () => {
    expect(normalizeOperationalDays([{ dayDate: "2026-08-02", dayType: "WORKING_DAY", title: "Working day" }])).toHaveLength(1);
    expect(() => normalizeOperationalDays([{ dayDate: "2026-08-02", dayType: "EMERGENCY_CLOSURE", title: "Closure" }])).toThrow(/requires a reason/);
    expect(() => normalizeOperationalDays([
      { dayDate: "2026-08-02", dayType: "WORKING_DAY", title: "A" },
      { dayDate: "2026-08-02", dayType: "NON_WORKING_DAY", title: "B" }
    ])).toThrow(/overlap/);
  });

  it("enforces exact role permissions and object-scoped Parent and Teacher access", () => {
    expect(can("PRINCIPAL", "PUBLISH_ACADEMIC_CALENDAR")).toBe(true);
    expect(can("TEACHER", "PUBLISH_SCHOOL_EVENTS")).toBe(false);
    expect(can("PARENT", "VIEW_OWN_CALENDAR")).toBe(true);
    expect(OBJECT_SCOPED_PERMISSIONS.has("VIEW_OWN_CALENDAR")).toBe(true);
    expect(OBJECT_SCOPED_PERMISSIONS.has("VIEW_STAFF_CALENDAR")).toBe(true);
    expect(LEADERSHIP_RESTRICTED_PERMISSIONS.has("PUBLISH_SCHOOL_EVENTS")).toBe(true);
  });

  it("resolves exact class, section, family and active timetable scope on the server", () => {
    const calendar = source("lib/academic-calendar.ts");
    for (const evidence of ["resolveActiveParentChildContext", "staffMember.findUnique", "timetableTeacher", "assignments", 'status: "ACTIVE"', "currentPublicationKey", "eventVisible"]) expect(calendar).toContain(evidence);
    expect(calendar).not.toContain("publicWebsiteEvent.create");
    expect(calendar).toContain("attendanceRecordsWillBeRewritten: false");
    expect(calendar).toContain("informationalEventsChangeDayType: false");
  });

  it("strips database and actor identifiers from API payloads", () => {
    expect(sanitizeAcademicCalendarPayload({ id: "internal", createdByUserId: "actor", classSectionId: "scope", publicKey: "opaque", nested: { eventId: "event", title: "Safe" } })).toEqual({ publicKey: "opaque", nested: { title: "Safe" } });
    const api = source("lib/academic-calendar-api.ts");
    expect(api).toContain('"Cache-Control": "private, no-store, max-age=0"');
  });

  it("keeps every state change POST/PUT, gated, bounded and compare-and-set", () => {
    for (const path of ["app/api/academic-calendar/versions/route.ts", "app/api/academic-calendar/versions/[id]/route.ts", "app/api/academic-calendar/versions/[id]/workflow/route.ts", "app/api/school-calendar/events/route.ts", "app/api/school-calendar/events/[id]/workflow/route.ts"]) {
      const route = source(path);
      expect(route).toContain("requireApiPermission");
      expect(route).not.toContain("export async function DELETE");
    }
    expect(source("lib/academic-calendar.ts")).toContain("expectedCalendarVersion");
    expect(source("lib/academic-calendar.ts")).toContain("TransactionIsolationLevel.Serializable");
  });

  it("locks attendance and report-card calendar basis without rewriting historical records", () => {
    const attendance = source("app/api/attendance/students/route.ts");
    const reportCards = source("lib/report-publication.ts") + source("lib/report-cards.ts");
    expect(attendance).toContain("captureAttendanceCalendarBasis");
    expect(attendance).toContain("calendarBasisSnapshotJson");
    expect(reportCards).toContain("currentReportCalendarBasis");
    expect(reportCards).toContain("calendarBasisVersionKey");
    expect(source("lib/academic-calendar.ts")).not.toContain("studentAttendanceRecord.deleteMany");
  });

  it("preserves immutable publication and append-only audit in the additive migration", () => {
    const migration = source("prisma/migrations/20260802170000_events_holidays_academic_calendar/migration.sql");
    for (const trigger of ["academic_calendar_published_history_no_delete", "operational_calendar_day_update_draft_only", "school_calendar_event_published_history_no_delete", "academic_calendar_audit_append_only_update"]) expect(migration).toContain(trigger);
    expect(migration).not.toContain("DROP TABLE");
  });

  it("backs up and validates calendar versions, scopes, replacements and audit without actors", () => {
    const rows = calendarBackupRows();
    expect(() => validateAcademicCalendarBackupRows(rows)).not.toThrow();
    const backup = createBackupDocument({ generatedAt: new Date("2026-08-02T12:00:00Z"), generatedBy: "CAL23E", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], ...rows });
    expect(backup.metadata.backupVersion).toBe(44);
    expect(backup.metadata.counts.academicCalendarVersions).toBe(1);
    expect(JSON.stringify(backup)).not.toContain("CAL23E-ACTOR-ID");
    const parsed = parseAndValidateBackup(backup);
    expect(parsed.academicCalendarVersions).toHaveLength(1);
    expect(parsed.schoolCalendarEventVersions).toHaveLength(1);
    expect(parsed.academicCalendarAuditEvents).toHaveLength(1);
  });
});

function calendarBackupRows() {
  return {
    academicCalendarVersions: [{ id: "cal", publicKey: "cal-public", academicYear: "2026-27", versionNumber: 1, status: "DRAFT", version: 1, effectiveScope: "SCHOOL_WIDE", scopeKey: "SCHOOL_WIDE::", title: "Calendar", attendanceReconciliationRequired: false, createdByUserId: "CAL23E-ACTOR-ID", createdAt: "2026-08-02T10:00:00Z", updatedAt: "2026-08-02T10:00:00Z" }],
    operationalCalendarDays: [{ id: "day", publicKey: "day-public", calendarVersionId: "cal", dayDate: "2026-08-02T00:00:00Z", dayType: "WORKING_DAY", sourceType: "MANUAL", scopeType: "SCHOOL_WIDE", scopeKey: "SCHOOL_WIDE::", title: "Working", contentHash: "hash", createdAt: "2026-08-02T10:00:00Z", updatedAt: "2026-08-02T10:00:00Z" }],
    schoolCalendarEvents: [{ id: "event", publicKey: "event-public", eventNumber: "CAL23E-1", academicYear: "2026-27", status: "DRAFT", version: 1, currentVersionNumber: 1, createdByUserId: "CAL23E-ACTOR-ID", createdAt: "2026-08-02T10:00:00Z", updatedAt: "2026-08-02T10:00:00Z" }],
    schoolCalendarEventVersions: [{ id: "event-v1", publicKey: "event-version-public", eventId: "event", versionNumber: 1, status: "DRAFT", version: 1, eventType: "SCHOOL_FUNCTION", title: "Function", startsAt: "2026-08-03T09:00:00Z", endsAt: "2026-08-03T10:00:00Z", allDay: false, audienceType: "SCHOOL_WIDE", audienceKey: "SCHOOL_WIDE:::", isImportant: false, contentHash: "event-hash", createdByUserId: "CAL23E-ACTOR-ID", createdAt: "2026-08-02T10:00:00Z", updatedAt: "2026-08-02T10:00:00Z" }],
    academicCalendarAuditEvents: [{ id: "audit", entityType: "OPERATIONAL_CALENDAR", calendarVersionId: "cal", eventType: "CALENDAR_DRAFT_CREATED", actorUserId: "CAL23E-ACTOR-ID", actorLabel: "Principal", snapshotJson: "{}", eventDate: "2026-08-02T10:00:00Z", createdAt: "2026-08-02T10:00:00Z" }]
  };
}
