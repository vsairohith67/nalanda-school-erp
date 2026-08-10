import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { assertCalendarLeadershipActor, normalizeAcademicCalendarWorkflowAction, normalizeSchoolEventWorkflowAction } from "@/lib/academic-calendar";
import { validateAcademicCalendarBackupRows } from "@/lib/academic-calendar-backup";
import { checkAcademicCalendarExportRateLimit, resetAcademicCalendarExportRateLimitForTests } from "@/lib/academic-calendar-export-rate-limit";
import { ownUnreadNotificationCount } from "@/lib/notification-portals";
import { LEADERSHIP_RESTRICTED_PERMISSIONS } from "@/lib/iam/permission-governance";
import { validateReportCardBackupRows } from "@/lib/report-card-backup";

const source = (path: string) => readFileSync(path, "utf8");

describe("Prompt 23E-QA security regressions", () => {
  beforeEach(() => resetAcademicCalendarExportRateLimitForTests());

  it("canonicalizes the action before selecting the permission and defaults unknown actions to deny", () => {
    expect(normalizeAcademicCalendarWorkflowAction(" publish ")).toBe("publish");
    expect(normalizeSchoolEventWorkflowAction(" READY ")).toBe("ready");
    expect(normalizeAcademicCalendarWorkflowAction("publish-now")).toBeNull();
    for (const path of ["app/api/academic-calendar/versions/[id]/workflow/route.ts", "app/api/school-calendar/events/[id]/workflow/route.ts"]) {
      const route = source(path);
      expect(route).toContain("normalize");
      expect(route).toContain("if (!action)");
      expect(route).toContain("{ ...body, action }");
    }
  });

  it("requires exact emergency publication permission and leadership-only bounded exports", () => {
    const workflow = source("app/api/academic-calendar/versions/[id]/workflow/route.ts");
    expect(workflow).toContain('requireApiPermission("PUBLISH_EMERGENCY_CLOSURE")');
    expect(workflow).toContain("academicCalendarContainsEmergencyClosure");
    expect(LEADERSHIP_RESTRICTED_PERMISSIONS.has("EXPORT_ACADEMIC_CALENDAR")).toBe(true);
    expect(() => assertCalendarLeadershipActor({ role: "ACCOUNTANT" } as any)).toThrow(/leadership/);
    expect(() => assertCalendarLeadershipActor({ role: "PRINCIPAL" } as any)).not.toThrow();
    for (let index = 0; index < 6; index++) expect(checkAcademicCalendarExportRateLimit("principal", index)).toMatchObject({ allowed: true });
    expect(checkAcademicCalendarExportRateLimit("principal", 6)).toMatchObject({ allowed: false });
  });

  it("resolves calendar notifications through active IAM assignments and filters restricted rows by role context", async () => {
    const calendar = source("lib/academic-calendar.ts");
    expect(calendar).toContain("client.userRoleAssignment.findMany");
    expect(calendar).toContain("iamRoleAssignments");
    expect(calendar).toContain('validFrom: { lte: now }');
    expect(calendar).toContain('validUntil: { gt: now }');
    const restricted = { recipientRoleSnapshot: "TEACHER", campaign: { status: "PUBLISHED", scheduledFor: null, expiresAt: null, withdrawnAt: null, publishedAt: new Date(), audienceDefinitionJson: JSON.stringify({ source: "SCHOOL_CALENDAR", audienceType: "STAFF_ONLY" }) } };
    const client = { notificationRecipient: { findMany: async () => [restricted] } };
    await expect(ownUnreadNotificationCount(client, { id: "multi-role", role: "PARENT" })).resolves.toBe(0);
    await expect(ownUnreadNotificationCount(client, { id: "multi-role", role: "TEACHER" })).resolves.toBe(1);
  });

  it("filters attendance/report bases in the database and enforces canonical active examination scope", () => {
    const calendar = source("lib/academic-calendar.ts");
    const attendance = calendar.slice(calendar.indexOf("export async function captureAttendanceCalendarBasis"), calendar.indexOf("export async function currentReportCalendarBasis"));
    const reports = calendar.slice(calendar.indexOf("export async function currentReportCalendarBasis"), calendar.indexOf("export function academicCalendarCsv"));
    expect(attendance).toContain("calendarScopeWhere");
    expect(attendance).not.toContain("take: 20");
    expect(reports).toContain("calendarScopeWhere");
    expect(reports).not.toContain("take: 20");
    expect(calendar).toContain('examination: { status: "ACTIVE" }');
    expect(calendar).toContain('classScope: { status: "ACTIVE", timetableClassSection: { isActive: true } }');
  });

  it("rejects semantically invalid publication pointers and lifecycle evidence before restore", () => {
    const root = calendarRows();
    expect(() => validateAcademicCalendarBackupRows(root)).not.toThrow();
    const invalid = structuredClone(root);
    invalid.schoolCalendarEvents[0].currentPublishedVersionId = "other-event-version";
    expect(() => validateAcademicCalendarBackupRows(invalid)).toThrow(/current publication pointer/);
    const invalidPublished = structuredClone(root);
    invalidPublished.academicCalendarVersions[0].status = "PUBLISHED";
    expect(() => validateAcademicCalendarBackupRows(invalidPublished)).toThrow(/submission evidence/);
    const unrestorableArchive = structuredClone(root);
    Object.assign(unrestorableArchive.academicCalendarVersions[0], {
      status: "ARCHIVED",
      submittedAt: "2026-08-01T08:00:00Z",
      approvedAt: "2026-08-01T09:00:00Z",
      publishedAt: "2026-08-01T10:00:00Z",
      publicationReason: "Approved",
      archivedAt: "2026-08-02T10:00:00Z",
      archiveReason: "Retained historical version"
    });
    expect(() => validateAcademicCalendarBackupRows(unrestorableArchive)).toThrow(/restorable replaced or withdrawn lifecycle/);
  });

  it("preserves a paired locked report-card calendar basis across corrections", () => {
    const rows = reportRows();
    expect(() => validateReportCardBackupRows(rows as any, { studentIds: new Set(["student"]), examIds: new Set(["exam"]), progressionIds: new Set() })).not.toThrow();
    const missingSnapshot = structuredClone(rows); delete missingSnapshot.studentReportCardVersions[0].calendarBasisSnapshotJson;
    expect(() => validateReportCardBackupRows(missingSnapshot as any, { studentIds: new Set(["student"]), examIds: new Set(["exam"]), progressionIds: new Set() })).toThrow(/both version key and snapshot/);
    const unclassified = structuredClone(rows);
    unclassified.studentReportCardVersions[0].calendarBasisVersionKey = null;
    unclassified.studentReportCardVersions[0].calendarBasisSnapshotJson = JSON.stringify({ basis: "UNCLASSIFIED", inferred: false });
    expect(() => validateReportCardBackupRows(unclassified as any, { studentIds: new Set(["student"]), examIds: new Set(["exam"]), progressionIds: new Set() })).not.toThrow();
    const correction = structuredClone(rows);
    correction.studentReportCards[0].currentVersionNumber = 2;
    correction.studentReportCardVersions.push({ ...correction.studentReportCardVersions[0], id: "version-2", versionNumber: 2, versionType: "CORRECTION", correctionReason: "Corrected", supersedesVersionId: "version-1", calendarBasisVersionKey: "different", snapshotJson: JSON.stringify({ status: "ISSUED", versionNumber: 2, reportType: "MARK_BASED", reportCardNumber: "CARD-1" }) });
    expect(() => validateReportCardBackupRows(correction as any, { studentIds: new Set(["student"]), examIds: new Set(["exam"]), progressionIds: new Set() })).toThrow(/preserve the locked calendar basis/);
  });

  it("enforces monotonic lifecycle, set-once evidence, pointer ownership and atomic restore code", () => {
    const migration = source("prisma/migrations/20260802170000_events_holidays_academic_calendar/migration.sql");
    for (const evidence of ["academic_calendar_version_status_transition", "school_calendar_event_version_status_transition", "academic_calendar_version_evidence_set_once", "school_calendar_event_version_evidence_set_once", "school_calendar_current_pointer_owner_guard", "academic_calendar_audit_target_guard", "AcademicCalendarAuditEvent_eventVersionId_fkey"]) expect(migration).toContain(evidence);
    const restore = source("lib/academic-calendar-restore.ts");
    expect(restore).not.toContain("catch (error)");
    expect(restore).toContain("restoreCalendarLifecycle");
    expect(restore).toContain("assertIdentity");
  });
});

function calendarRows(): any {
  return {
    academicCalendarVersions: [{ id: "calendar", publicKey: "calendar-public", academicYear: "2026-27", versionNumber: 1, status: "DRAFT", version: 1, effectiveScope: "SCHOOL_WIDE", scopeKey: "SCHOOL_WIDE::", title: "Calendar" }],
    operationalCalendarDays: [{ id: "day", publicKey: "day-public", calendarVersionId: "calendar", dayDate: "2026-08-03T00:00:00Z", dayType: "WORKING_DAY", sourceType: "MANUAL", scopeType: "SCHOOL_WIDE", scopeKey: "SCHOOL_WIDE::", title: "Working", contentHash: "hash" }],
    schoolCalendarEvents: [{ id: "event", publicKey: "event-public", eventNumber: "EVENT-1", academicYear: "2026-27", status: "DRAFT", version: 1, currentVersionNumber: 1 }],
    schoolCalendarEventVersions: [{ id: "event-version", publicKey: "event-version-public", eventId: "event", versionNumber: 1, status: "DRAFT", version: 1, eventType: "SCHOOL_FUNCTION", title: "Function", startsAt: "2026-08-03T09:00:00Z", endsAt: "2026-08-03T10:00:00Z", audienceType: "SCHOOL_WIDE", audienceKey: "SCHOOL_WIDE:::", contentHash: "hash" }],
    academicCalendarAuditEvents: [{ id: "audit", entityType: "OPERATIONAL_CALENDAR", calendarVersionId: "calendar", eventType: "CALENDAR_DRAFT_CREATED", actorLabel: "Principal", snapshotJson: "{}", eventDate: "2026-08-02T10:00:00Z" }]
  };
}

function reportRows(): any {
  const definition = { schemaVersion: 1, type: "MARK_BASED", denominatorPolicy: "PRESENT_AND_ABSENT", includeAttendance: true, includeGuardianNames: true, approvalRoles: ["PRINCIPAL"], sections: ["STUDENT_PROFILE"] };
  const templateSnapshot = { templateCode: "T", name: "T", reportType: "MARK_BASED", versionNumber: 1, definition, printSettings: null, gradingScheme: { schemeCode: "S", name: "S", bands: [{ gradeCode: "A", label: "A", minimumPercentage: "0", maximumPercentage: "100", displayOrder: 1 }] } };
  return {
    gradingSchemes: [{ id: "scheme", schemeCode: "S", name: "S", reportType: "MARK_BASED", status: "ACTIVE" }], gradeBands: [{ id: "band", gradingSchemeId: "scheme", gradeCode: "A", label: "A", minimumPercentage: "0", maximumPercentage: "100", displayOrder: 1 }],
    reportCardTemplates: [{ id: "template", templateCode: "T", name: "T", reportType: "MARK_BASED", gradingSchemeId: "scheme", status: "ACTIVE", templateDefinitionJson: JSON.stringify(definition), versionNumber: 1 }],
    reportCardBatches: [{ id: "batch", batchNumber: "B", academicYear: "2026-27", reportType: "MARK_BASED", templateId: "template", className: "V", section: "A", title: "B", status: "ISSUED", templateSnapshotJson: JSON.stringify(templateSnapshot) }],
    reportCardBatchExamSources: [{ id: "source", batchId: "batch", examCycleId: "exam", displayOrder: 1 }],
    studentReportCards: [{ id: "card", reportCardNumber: "CARD-1", batchId: "batch", studentId: "student", academicYear: "2026-27", className: "V", section: "A", reportType: "MARK_BASED", status: "ISSUED", currentVersionNumber: 1, draftDataJson: JSON.stringify({ kind: "MARK_BASED", calculation: { rows: [], blockingGaps: [] } }) }],
    studentReportCardVersions: [{ id: "version-1", reportCardId: "card", versionNumber: 1, versionType: "ORIGINAL", snapshotJson: JSON.stringify({ status: "ISSUED", versionNumber: 1, reportType: "MARK_BASED", reportCardNumber: "CARD-1" }), issuedAt: "2026-08-02T10:00:00Z", calendarBasisVersionKey: "calendar-public", calendarBasisSnapshotJson: "{}" }],
    studentReportCardEvents: []
  };
}
