import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createBackupDocument } from "@/lib/backup";
import { parentMeetingsEnabled } from "@/lib/parent-meeting-feature";
import { emptyParentMeetingBackup, validateParentMeetingBackupRows } from "@/lib/parent-meeting-backup";
import { parentMeetingRolePolicy, PARENT_MEETING_CATEGORIES, PARENT_MEETING_STATUSES } from "@/lib/parent-meetings";
import { RECOMMENDED_ROLE_PERMISSIONS, type Role } from "@/lib/permissions";
import { visibleNavigationItems } from "@/lib/access-rules";

const root = path.resolve(".");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

afterEach(() => delete process.env.PARENT_MEETINGS_V1_5);

describe("PARENT-MEETING-V1_5-1A governance", () => {
  it("is operationally default-off and enables only on exact true", () => {
    delete process.env.PARENT_MEETINGS_V1_5;
    expect(parentMeetingsEnabled()).toBe(false);
    process.env.PARENT_MEETINGS_V1_5 = "false";
    expect(parentMeetingsEnabled()).toBe(false);
    process.env.PARENT_MEETINGS_V1_5 = "true";
    expect(parentMeetingsEnabled()).toBe(true);
  });

  it("implements the deny-by-default role matrix", () => {
    const roles: Role[] = ["SUPER_ADMIN","PRINCIPAL","DIRECTOR","ADMIN","ACCOUNTANT","COMPUTER_OPERATOR","TEACHER","PARENT","STUDENT","GATE_STAFF","VIEWER"];
    const matrix = Object.fromEntries(roles.map((role) => [role, parentMeetingRolePolicy(role)]));
    expect(matrix.SUPER_ADMIN).toMatchObject({ leadershipManage: true, leadershipRead: true });
    expect(matrix.PRINCIPAL).toMatchObject({ leadershipManage: true, leadershipRead: true });
    expect(matrix.DIRECTOR).toEqual({ leadershipManage: false, leadershipRead: true, teacherAssigned: false, parentOwn: false });
    expect(matrix.TEACHER).toEqual({ leadershipManage: false, leadershipRead: false, teacherAssigned: true, parentOwn: false });
    expect(matrix.PARENT).toEqual({ leadershipManage: false, leadershipRead: false, teacherAssigned: false, parentOwn: true });
    for (const role of ["ADMIN","ACCOUNTANT","COMPUTER_OPERATOR","STUDENT","GATE_STAFF","VIEWER"] as Role[]) {
      expect(Object.values(matrix[role]).some(Boolean), role).toBe(false);
    }
    expect(Object.values(parentMeetingRolePolicy("MARKS_ENTRY_OPERATOR" as Role)).some(Boolean)).toBe(false);
  });

  it("grants only scoped canonical permissions and preserves Academic Integrity", () => {
    expect([...RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN]).toEqual(expect.arrayContaining(["VIEW_PARENT_MEETINGS","MANAGE_PARENT_MEETINGS","EXPORT_PARENT_MEETING_REPORTS"]));
    expect([...RECOMMENDED_ROLE_PERMISSIONS.PRINCIPAL]).toEqual(expect.arrayContaining(["VIEW_PARENT_MEETINGS","MANAGE_PARENT_MEETINGS","EXPORT_PARENT_MEETING_REPORTS"]));
    expect(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR.has("VIEW_PARENT_MEETINGS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR.has("MANAGE_PARENT_MEETINGS")).toBe(false);
    expect([...RECOMMENDED_ROLE_PERMISSIONS.TEACHER]).toEqual(expect.arrayContaining(["VIEW_ASSIGNED_PARENT_MEETINGS","CONTRIBUTE_ASSIGNED_PARENT_MEETINGS"]));
    expect(RECOMMENDED_ROLE_PERMISSIONS.TEACHER.has("ENTER_MARKS")).toBe(false);
    expect([...RECOMMENDED_ROLE_PERMISSIONS.PARENT]).toEqual(expect.arrayContaining(["VIEW_OWN_PARENT_MEETINGS","REQUEST_OWN_PARENT_MEETINGS"]));
    for (const role of ["ADMIN","ACCOUNTANT","COMPUTER_OPERATOR","STUDENT","GATE_STAFF","VIEWER"] as Role[]) {
      expect([...RECOMMENDED_ROLE_PERMISSIONS[role]].some((permission) => permission.includes("PARENT_MEETING")), role).toBe(false);
    }
    expect(source("lib/iam/permission-governance.ts")).toContain("MANAGE_PARENT_MEETINGS");
  });

  it("hides navigation while disabled and exposes only authorised role links when enabled", () => {
    const permissions = ["VIEW_PARENT_MEETINGS"] as const;
    expect(visibleNavigationItems(permissions, "PRINCIPAL").some((item) => item.href === "/parent-meetings")).toBe(false);
    expect(visibleNavigationItems(permissions, "PRINCIPAL", new Set(["PARENT_MEETINGS_V1_5"])).some((item) => item.href === "/parent-meetings")).toBe(true);
    expect(visibleNavigationItems(permissions, "ADMIN", new Set(["PARENT_MEETINGS_V1_5"])).some((item) => item.href === "/parent-meetings")).toBe(false);
  });

  it("uses the bounded categories and one-way occurrence lifecycle", () => {
    expect(PARENT_MEETING_CATEGORIES).toEqual(["ACADEMIC_PROGRESS","ATTENDANCE","GENERAL_SCHOOL_DISCUSSION","ADMINISTRATIVE","PRINCIPAL_APPOINTMENT","OTHER"]);
    expect(PARENT_MEETING_STATUSES).toEqual(["REQUESTED","SCHEDULING","SCHEDULED","CONFIRMED","COMPLETED","CANCELLED","NO_SHOW"]);
    const migration = source("prisma/migrations/20260822170000_parent_meetings_v1_5/migration.sql");
    expect(migration).toContain("PARENT_MEETING_TRANSITION_INVALID");
    expect(migration).toContain("ParentMeetingNote_no_update");
    expect(migration).toContain("PARENT_MEETING_STAFF_CONFLICT");
    expect(migration).toContain("PARENT_MEETING_GUARDIAN_CONFLICT");
  });

  it("backs up every durable meeting entity in v43 without auth runtime state", () => {
    const backup = createBackupDocument({ generatedAt: new Date("2026-08-22T00:00:00Z"), generatedBy: "PARENTMEETING15 QA", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], ...emptyParentMeetingBackup() });
    expect(backup.metadata.backupVersion).toBe(43);
    expect(backup).toMatchObject({ parentMeetings: [], parentMeetingPreferences: [], parentMeetingParticipants: [], parentMeetingNotes: [], parentMeetingFollowUps: [], parentMeetingEvents: [] });
    expect(JSON.stringify(backup)).not.toMatch(/passwordHash|sessionToken|cookie/i);
  });

  it("rejects malformed and unsupported backup fields without censoring legitimate meeting text", () => {
    const invalidLink: any = emptyParentMeetingBackup();
    invalidLink.parentMeetingNotes = [{ id: "n", publicKey: "note-public-key-1234567890", meetingId: "missing", kind: "LEADERSHIP_PRIVATE", body: "private", authorUserId: "u", authorRole: "PRINCIPAL", createdAt: new Date().toISOString() }];
    expect(() => validateParentMeetingBackupRows(invalidLink)).toThrow(/invalid meeting link/);
    const secret: any = emptyParentMeetingBackup();
    secret.parentMeetings = [{ id: "m", publicKey: "meeting-public-key-123456", studentId: "s", academicYear: "2026-27", source: "LEADERSHIP_CREATED", category: "OTHER", subject: "Password reset credential discussion", status: "REQUESTED", createdByUserId: "u", rowVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), passwordHash: "must never be restored" }];
    expect(() => validateParentMeetingBackupRows(secret)).toThrow(/passwordHash is unsupported/);
    delete secret.parentMeetings[0].passwordHash;
    expect(validateParentMeetingBackupRows(secret).parentMeetings[0]?.subject).toBe("Password reset credential discussion");
  });

  it("keeps private fields out of the Parent serializer and broad logs", () => {
    const service = source("lib/parent-meetings.ts");
    const notifications = source("lib/parent-meeting-notifications.ts");
    expect(service).toContain("function parentMeetingView");
    expect(service).not.toMatch(/function parentMeetingView[\s\S]*?internalDescription:\s*followUp\.internalDescription[\s\S]*?^}/m);
    expect(service).toContain("bodyLogged: false");
    expect(notifications).toContain('channel: "IN_APP"');
    expect(notifications).not.toMatch(/fetch\(|https?:\/\/|WHATSAPP|SMS_PROVIDER|EMAIL_PROVIDER/);
  });
});
