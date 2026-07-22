import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { notificationTemplateErrorMessage, validateNotificationTemplateInput } from "../lib/notification-templates";
import { notificationPathAllowedForRole, validateNotificationActionPath } from "../lib/notification-links";
import { isNotificationActive, isNotificationEffectivelyAvailable, notificationHistoryState, requireFutureSchedule } from "../lib/notification-visibility";
import { validateAudienceDefinition } from "../lib/notification-audiences";
import {
  createCorrectedNotificationCampaign,
  notificationAudienceActorForFinalResolution,
  validateNotificationCampaignInput
} from "../lib/notification-campaigns";
import { defaultPermissionMatrix } from "../lib/role-permissions";
import { notificationReportCsv } from "../lib/notification-reports";

const root = path.resolve(__dirname, "..");
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Prompt 19A notification foundation", () => {
  it("normalizes unique-style template codes and accepts only plain text and safe placeholders", () => {
    expect(validateNotificationTemplateInput({
      templateCode: " general_update ", name: "General update", category: "GENERAL",
      titleTemplate: "{{schoolName}} update", bodyTemplate: "Academic year {{academicYear}} update."
    })).toMatchObject({ templateCode: "GENERAL-UPDATE", defaultPriority: "NORMAL" });
    for (const bodyTemplate of ["<script>alert(1)</script>", "<b>bold</b>", "javascript:alert(1)", "<img onerror=run>"]) {
      expect(() => validateNotificationTemplateInput({
        templateCode: "BAD-TEMPLATE", name: "Bad", category: "GENERAL", titleTemplate: "Title", bodyTemplate
      })).toThrow(/plain text/);
    }
    expect(() => validateNotificationTemplateInput({
      templateCode: "PERSONAL-DATA", name: "Bad", category: "GENERAL",
      titleTemplate: "Hello {{parentName}}", bodyTemplate: "Message"
    })).toThrow(/placeholder/);
    expect(notificationTemplateErrorMessage({ code: "P2002" }, "fallback")).toMatch(/already exists/);
  });

  it("strictly allowlists role-safe internal action paths", () => {
    expect(validateNotificationActionPath("/parent/homework")).toBe("/parent/homework");
    for (const value of ["https://example.test", "//example.test", "javascript:alert(1)", "data:text/html,x", "/parent/homework?studentId=other", "/parent/../users"]) {
      expect(() => validateNotificationActionPath(value), value).toThrow(/allowlisted|approved/);
    }
    expect(notificationPathAllowedForRole("/parent/results", "PARENT")).toBe(true);
    expect(notificationPathAllowedForRole("/parent/results", "TEACHER")).toBe(false);
    expect(notificationPathAllowedForRole("/teacher/marks", "PARENT")).toBe(false);
    expect(notificationPathAllowedForRole("/teacher/marks", "TEACHER")).toBe(true);
  });

  it("uses restart-safe scheduled visibility and preserves expiry/withdrawal history", () => {
    const now = new Date("2026-07-17T10:00:00.000Z");
    const before = { status: "SCHEDULED", scheduledFor: "2026-07-17T10:01:00.000Z", expiresAt: null };
    const after = { ...before, scheduledFor: "2026-07-17T09:59:00.000Z" };
    expect(isNotificationEffectivelyAvailable(before, now)).toBe(false);
    expect(isNotificationEffectivelyAvailable(after, now)).toBe(true);
    expect(isNotificationActive(after, now)).toBe(true);
    expect(notificationHistoryState({ ...after, expiresAt: "2026-07-17T09:59:30.000Z" }, now)).toBe("EXPIRED");
    expect(notificationHistoryState({ ...after, status: "WITHDRAWN" }, now)).toBe("WITHDRAWN");
    expect(() => requireFutureSchedule(new Date("2026-07-17T09:59:00.000Z"), now)).toThrow(/future India-local/);
  });

  it("validates every controlled audience definition and blocks malformed exact targets", () => {
    expect(validateAudienceDefinition("CLASS_SECTION", { academicYear: "2026-27", className: "VI", section: "a" })).toEqual({ academicYear: "2026-27", className: "VI", section: "A" });
    expect(validateAudienceDefinition("SPECIFIC_STUDENTS", { studentIds: ["one", "one", "two"] })).toEqual({ studentIds: ["one", "two"], academicYear: "2026-27" });
    expect(validateAudienceDefinition("ROLE", { role: "parent" })).toEqual({ role: "PARENT" });
    expect(() => validateAudienceDefinition("SPECIFIC_USERS", { userIds: [] })).toThrow(/between 1 and 500/);
    expect(() => validateAudienceDefinition("NOT_REAL", {})).toThrow(/valid notification audience/);
  });

  it("enforces Teacher categories and exact timetable audience at campaign validation", async () => {
    const client = { notificationTemplate: { findUnique: async () => null } };
    const base = { category: "ACADEMIC", priority: "NORMAL", title: "Lesson update", body: "Review the chapter.", audienceType: "TEACHER_TIMETABLE_SCOPE", audienceDefinition: { className: "VI", section: "A", subjectId: "subject-1" } };
    await expect(validateNotificationCampaignInput(client, base, teacher())).resolves.toBeTruthy();
    await expect(validateNotificationCampaignInput(client, { ...base, category: "EMERGENCY" }, teacher())).rejects.toThrow(/Teachers may create only/);
    await expect(validateNotificationCampaignInput(client, { ...base, audienceType: "ALL_PARENTS", audienceDefinition: {} }, teacher())).rejects.toThrow(/Teachers may target only/);
  });

  it("revalidates Teacher scope against its preserved creator during leadership publication", async () => {
    const creator = { id: "teacher-user", role: "TEACHER", isActive: true };
    const client = { user: { findUnique: async ({ where }: any) => where.id === creator.id ? creator : null } };
    await expect(notificationAudienceActorForFinalResolution(
      client,
      { audienceType: "TEACHER_TIMETABLE_SCOPE", createdByUserId: creator.id },
      { id: "director-user", role: "DIRECTOR" } as never
    )).resolves.toEqual(creator);
    await expect(notificationAudienceActorForFinalResolution(
      { user: { findUnique: async () => ({ id: "admin-user", role: "ADMIN", isActive: true }) } },
      { audienceType: "TEACHER_TIMETABLE_SCOPE", createdByUserId: "admin-user" },
      { id: "director-user", role: "DIRECTOR" } as never
    )).rejects.toThrow(/active Teacher/);
  });

  it("creates a fresh correction from expired history without inheriting a past expiry", async () => {
    let createdData: any = null;
    const original = {
      id: "original",
      status: "ARCHIVED",
      category: "GENERAL",
      priority: "IMPORTANT",
      title: "Expired update",
      body: "Preserved body",
      actionLabel: null,
      actionPath: null,
      audienceType: "CLASS_SECTION",
      audienceDefinitionJson: JSON.stringify({ academicYear: "2026-27", className: "VI", section: "A" }),
      acknowledgmentRequired: false,
      expiresAt: new Date("2026-07-16T10:00:00.000Z")
    };
    const client = {
      notificationTemplate: { findUnique: async () => null },
      notificationCampaign: {
        findUnique: async () => original,
        create: async ({ data }: any) => {
          createdData = data;
          return { id: "correction", ...data };
        },
        update: async () => original
      },
      notificationEvent: { create: async ({ data }: any) => data }
    };
    await createCorrectedNotificationCampaign(client, "original", {
      id: "director",
      name: "Director",
      username: "director",
      email: null,
      guardianId: null,
      role: "DIRECTOR"
    });
    expect(createdData.correctionOfCampaignId).toBe("original");
    expect(createdData.expiresAt).toBeNull();
  });

  it("applies recommended role defaults without generic dashboard escalation", () => {
    const matrix = defaultPermissionMatrix();
    expect(matrix.DIRECTOR.PUBLISH_EMERGENCY_NOTIFICATIONS).toBe(true);
    expect(matrix.PRINCIPAL.PUBLISH_EMERGENCY_NOTIFICATIONS).toBe(true);
    expect(matrix.ADMIN.PUBLISH_NOTIFICATION_CAMPAIGNS).toBe(true);
    expect(matrix.ADMIN.PUBLISH_EMERGENCY_NOTIFICATIONS).toBe(false);
    expect(matrix.TEACHER.CREATE_SCOPED_NOTIFICATIONS).toBe(true);
    expect(matrix.TEACHER.APPROVE_NOTIFICATION_CAMPAIGNS).toBe(false);
    expect(matrix.PARENT.VIEW_OWN_NOTIFICATIONS).toBe(true);
    expect(matrix.ACCOUNTANT.CREATE_NOTIFICATION_CAMPAIGNS).toBe(false);
    expect(matrix.VIEWER.VIEW_NOTIFICATION_REPORTS).toBe(true);
    expect(matrix.VIEWER.EXPORT_NOTIFICATION_REPORTS).toBe(false);
  });

  it("exports only aggregate formula-safe allowlisted report fields", () => {
    const csv = notificationReportCsv({ campaigns: [{
      campaignNumber: "=INJECT", status: "PUBLISHED", category: "GENERAL", priority: "NORMAL",
      audienceType: "CLASS", channel: "IN_APP", scheduledFor: null, publishedAt: null,
      resolvedUsers: 3, recipientRows: 3, skipped: 1, read: 2, unread: 1, acknowledged: 1,
      dismissed: 0, correction: false
    }] } as any);
    expect(csv).toContain("'=INJECT");
    expect(csv).not.toMatch(/phone|email|student name|guardian/i);
  });

  it("contains no external delivery queues, provider routes, or delete APIs", () => {
    const combined = [
      source("lib/notification-campaigns.ts"), source("lib/notification-audiences.ts"),
      source("app/api/notifications/campaigns/route.ts"), source("app/api/notifications/campaigns/[id]/workflow/route.ts")
    ].join("\n");
    expect(combined).toContain('NOTIFICATION_CHANNEL = "IN_APP"');
    expect(combined).not.toMatch(/twilio|firebase|fcm|whatsapp|sendgrid|smtp|webhook|providerCredential/i);
    expect(combined).not.toContain("export async function DELETE");
    expect(source("app/notifications/manage/page.tsx")).toContain('requirePermission("CREATE_NOTIFICATION_CAMPAIGNS")');
    expect(source("app/notifications/manage/[id]/page.tsx")).toContain('requirePermission("CREATE_NOTIFICATION_CAMPAIGNS")');
    expect(source("app/api/notifications/campaigns/route.ts")).toContain('requireApiPermission("CREATE_NOTIFICATION_CAMPAIGNS")');
    expect(source("app/api/notifications/campaigns/[id]/route.ts")).toContain('requireApiPermission("CREATE_NOTIFICATION_CAMPAIGNS")');
  });
});

function teacher() {
  return { id: "teacher-user", name: "Teacher", username: "teacher", email: null, guardianId: null, role: "TEACHER" as const };
}
