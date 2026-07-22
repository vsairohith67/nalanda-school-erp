import { describe, expect, it } from "vitest";
import { resolveNotificationAudience } from "../lib/notification-audiences";
import { actOnOwnNotification } from "../lib/notification-recipients";

describe("notification audiences and recipient states", () => {
  it("deduplicates one Parent across siblings and reports a Student with no active Parent user", async () => {
    const result = await resolveNotificationAudience(fakeAudienceClient(), {
      audienceType: "CLASS_SECTION",
      definition: { academicYear: "2026-27", className: "VI", section: "A" },
      actor: { id: "director", role: "DIRECTOR" },
      actionPath: "/parent/homework"
    });
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].context.targetedChildren).toHaveLength(2);
    expect(result.skipped).toContainEqual(expect.objectContaining({ reasonCode: "NO_ACTIVE_USER" }));
    expect(result.summary).toMatchObject({ intendedStudents: 3, resolvedUsers: 1, skipped: 1 });
  });

  it("requires the exact User to StaffMember to Teacher to assignment chain and blocks tampering", async () => {
    const good = await resolveNotificationAudience(fakeAudienceClient(), {
      audienceType: "TEACHER_TIMETABLE_SCOPE",
      definition: { academicYear: "2026-27", className: "VI", section: "A", subjectId: "math" },
      actor: { id: "teacher-user", role: "TEACHER" }
    });
    expect(good.summary).toMatchObject({ classSection: "VI-A", subject: "Mathematics" });
    await expect(resolveNotificationAudience(fakeAudienceClient(), {
      audienceType: "TEACHER_TIMETABLE_SCOPE",
      definition: { academicYear: "2026-27", className: "X", section: "B", subjectId: "science" },
      actor: { id: "teacher-user", role: "TEACHER" }
    })).rejects.toThrow(/outside this Teacher's timetable scope/);
    await expect(resolveNotificationAudience(fakeAudienceClient(), {
      audienceType: "ALL_PARENTS", definition: {}, actor: { id: "teacher-user", role: "TEACHER" }
    })).rejects.toThrow(/only their exact timetable scope/);
  });

  it("resolves Staff only through active linked users and records missing links safely", async () => {
    const result = await resolveNotificationAudience(fakeAudienceClient(), {
      audienceType: "ALL_STAFF", definition: {}, actor: { id: "director", role: "DIRECTOR" }
    });
    expect(result.recipients.map((row) => row.userId)).toEqual(["staff-user"]);
    expect(result.skipped.map((row) => row.reasonCode)).toEqual(["MISSING_STAFF_LINK"]);
  });

  it("keeps specific Guardian targeting exact and does not count unrelated Students as skipped", async () => {
    const client: any = fakeAudienceClient();
    client.guardian.findMany = async () => [
      guardianAudienceRow("guardian-linked", "parent-user", [
        { admissionNo: "A1", studentName: "Sibling One" },
        { admissionNo: "A2", studentName: "Sibling Two" }
      ]),
      guardianAudienceRow("guardian-no-user", null, [{ admissionNo: "A3", studentName: "No Account" }])
    ];
    const result = await resolveNotificationAudience(client, {
      audienceType: "SPECIFIC_GUARDIANS",
      definition: { guardianIds: ["guardian-linked", "guardian-no-user"] },
      actor: { id: "director", role: "DIRECTOR" },
      actionPath: "/parent/homework"
    });
    expect(result.recipients).toHaveLength(1);
    expect(result.recipients[0].context.targetedChildren).toHaveLength(2);
    expect(result.skipped).toEqual([expect.objectContaining({ targetReferenceKey: "guardian-no-user", reasonCode: "NO_ACTIVE_USER" })]);
    expect(result.summary).toMatchObject({ intendedGuardians: 2, resolvedUsers: 1, skipped: 1 });
  });

  it("revalidates Parent ownership for ROLE and mixed SPECIFIC_USERS audiences", async () => {
    const client: any = fakeAudienceClient();
    client.user.findMany = async () => [
      { id: "parent-user", role: "PARENT", isActive: true, guardianId: "guardian-linked" },
      { id: "viewer-user", role: "VIEWER", isActive: true, guardianId: null }
    ];
    client.guardian.findMany = async () => [
      guardianAudienceRow("guardian-linked", "parent-user", [{ admissionNo: "A1", studentName: "Owned Child" }])
    ];
    const role = await resolveNotificationAudience(client, {
      audienceType: "ROLE", definition: { role: "PARENT" }, actor: { id: "director", role: "DIRECTOR" }
    });
    expect(role.recipients[0]).toMatchObject({ userId: "parent-user", contextType: "GUARDIAN_STUDENT" });
    const exact = await resolveNotificationAudience(client, {
      audienceType: "SPECIFIC_USERS",
      definition: { userIds: ["parent-user", "viewer-user", "missing-user"] },
      actor: { id: "director", role: "DIRECTOR" }
    });
    expect(exact.recipients).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: "parent-user", contextType: "GUARDIAN_STUDENT" }),
      expect.objectContaining({ userId: "viewer-user", contextType: "GENERAL_USER" })
    ]));
    expect(exact.skipped).toContainEqual(expect.objectContaining({ targetReferenceKey: "missing-user", reasonCode: "INVALID_TARGET" }));
  });

  it("records read idempotently, keeps acknowledgment separate, and blocks required dismissal", async () => {
    const state = recipientState();
    const client = recipientClient(state);
    await expect(actOnOwnNotification(client as never, { campaignId: "campaign", userId: "parent", action: "dismiss", now: clock() }))
      .rejects.toThrow(/Acknowledge/);
    await actOnOwnNotification(client as never, { campaignId: "campaign", userId: "parent", action: "read", now: clock() });
    await actOnOwnNotification(client as never, { campaignId: "campaign", userId: "parent", action: "read", now: clock() });
    expect(state.events.filter((row) => row.eventType === "NOTIFICATION_READ")).toHaveLength(1);
    expect(state.recipient.readAt).toBeTruthy();
    expect(state.recipient.acknowledgedAt).toBeNull();
    await actOnOwnNotification(client as never, { campaignId: "campaign", userId: "parent", action: "acknowledge", now: clock() });
    await actOnOwnNotification(client as never, { campaignId: "campaign", userId: "parent", action: "dismiss", now: clock() });
    expect(state.recipient.deliveryStatus).toBe("DISMISSED");
    expect(state.recipient.acknowledgedAt).toBeTruthy();
  });

  it("blocks recipient actions before scheduled availability and after withdrawal", async () => {
    const pending = recipientState({ campaign: { status: "SCHEDULED", scheduledFor: new Date("2026-07-17T10:01:00.000Z") } });
    await expect(actOnOwnNotification(recipientClient(pending) as never, { campaignId: "campaign", userId: "parent", action: "read", now: clock() })).rejects.toThrow(/not available yet/);
    const withdrawn = recipientState({ campaign: { status: "WITHDRAWN" } });
    await expect(actOnOwnNotification(recipientClient(withdrawn) as never, { campaignId: "campaign", userId: "parent", action: "read", now: clock() })).rejects.toThrow(/not available yet|Withdrawn/);
  });
});

function fakeAudienceClient() {
  const enrollments = [
    enrollment("A1", "Sibling One", parentUser()),
    enrollment("A2", "Sibling Two", parentUser()),
    enrollment("A3", "No Account", null)
  ];
  return {
    academicYearEnrollment: { findMany: async () => enrollments },
    staffMember: {
      findUnique: async ({ where }: any) => where.userId === "teacher-user" ? { id: "staff-teacher", status: "ACTIVE", timetableTeacherId: "tt-1" } : null,
      findMany: async () => [
        { id: "staff-1", staffCode: "S1", displayName: "Asha", fullName: "Asha", staffType: "NON_TEACHING", timetableTeacherId: null, user: { id: "staff-user", role: "ADMIN", isActive: true } },
        { id: "staff-2", staffCode: "S2", displayName: "No User", fullName: "No User", staffType: "NON_TEACHING", timetableTeacherId: null, user: null }
      ]
    },
    timetableAssignment: {
      findFirst: async ({ where }: any) => where.teacherId === "tt-1" && where.subjectId === "math" && where.classSection.className === "VI" && where.classSection.section === "A"
        ? { subject: { name: "Mathematics" }, classSection: { className: "VI", section: "A", displayName: "VI-A" } }
        : null
    },
    user: { findMany: async () => [] },
    guardian: { findMany: async () => [] }
  };
}
function parentUser() { return { id: "parent-user", role: "PARENT", isActive: true }; }
function guardianAudienceRow(id: string, userId: string | null, students: Array<{ admissionNo: string; studentName: string }>) {
  return {
    id,
    status: "Active",
    users: userId ? [{ id: userId, role: "PARENT", isActive: true }] : [],
    students: students.map((student) => ({
      student: {
        id: student.admissionNo,
        admissionNo: student.admissionNo,
        studentName: student.studentName,
        className: "VI",
        section: "A",
        deletedAt: null,
        academicYearEnrollments: [{ className: "VI", section: "A" }]
      }
    }))
  };
}
function enrollment(admissionNo: string, studentName: string, user: any) {
  return { student: { id: admissionNo, admissionNo, studentName, className: "VI", section: "A", deletedAt: null, guardians: [{ guardian: { id: `g-${admissionNo}`, displayName: "Parent", status: "Active", users: user ? [user] : [] } }] } };
}
function clock() { return new Date("2026-07-17T10:00:00.000Z"); }
function recipientState(overrides: any = {}) {
  const campaign = { status: "PUBLISHED", scheduledFor: null, expiresAt: null, publishedAt: new Date("2026-07-17T09:00:00.000Z"), acknowledgmentRequired: true, ...overrides.campaign };
  return { recipient: { id: "recipient", campaignId: "campaign", userId: "parent", campaign, firstViewedAt: null, readAt: null, acknowledgedAt: null, dismissedAt: null, deliveryStatus: "AVAILABLE" }, events: [] as any[] };
}
function recipientClient(state: ReturnType<typeof recipientState>) {
  return {
    notificationRecipient: {
      findUnique: async () => ({ ...state.recipient }),
      update: async ({ data }: any) => Object.assign(state.recipient, data),
      count: async ({ where }: any) => where.readAt ? Number(Boolean(state.recipient.readAt)) : where.acknowledgedAt ? Number(Boolean(state.recipient.acknowledgedAt)) : where.dismissedAt ? Number(Boolean(state.recipient.dismissedAt)) : 1
    },
    notificationSkippedRecipient: { count: async () => 0 },
    notificationCampaign: { update: async () => state.recipient.campaign },
    notificationEvent: { create: async ({ data }: any) => { state.events.push(data); return data; } }
  };
}
