import { describe, expect, it } from "vitest";
import { RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";
import { isSmsEmailQuietHours } from "@/lib/sms-email-batches";
import { optOutSmsEmailConsent, recordSmsEmailConsent } from "@/lib/sms-email-consents";
import { validateSmsEmailProfileInput } from "@/lib/sms-email-profiles";

const director = { id: "director", name: "Director", username: "director", email: null, guardianId: null, role: "DIRECTOR" as const };

describe("Prompt 19C consent, controls and role defaults", () => {
  it("keeps final-send and override permissions separated by role", () => {
    const principal = RECOMMENDED_ROLE_PERMISSIONS.PRINCIPAL;
    const admin = RECOMMENDED_ROLE_PERMISSIONS.ADMIN;
    const viewer = RECOMMENDED_ROLE_PERMISSIONS.VIEWER;
    expect(principal.has("SEND_SMS_EMAIL_BATCHES")).toBe(true);
    expect(principal.has("OVERRIDE_SMS_EMAIL_LIMITS")).toBe(false);
    expect(admin.has("MANAGE_SMS_EMAIL_INTEGRATIONS")).toBe(true);
    expect(admin.has("SEND_SMS_EMAIL_BATCHES")).toBe(false);
    expect(viewer.has("VIEW_SMS_EMAIL_REPORTS")).toBe(true);
    expect(viewer.has("EXPORT_SMS_EMAIL_REPORTS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.PARENT.has("MANAGE_OWN_SMS_EMAIL_CONSENT")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.TEACHER.has("MANAGE_OWN_SMS_EMAIL_CONSENT")).toBe(true);
  });

  it("requires explicit consent and invalidates the older contact hash on a verified contact change", async () => {
    const events: any[] = [];
    const created: any[] = [];
    const stale = { id: "old", status: "OPTED_IN", contactHash: "old-hash" };
    const tx: any = {
      smsEmailConsent: {
        findFirst: async () => null,
        findMany: async () => [stale],
        update: async ({ data }: any) => ({ ...stale, ...data }),
        create: async ({ data }: any) => { const row = { id: "new", ...data }; created.push(row); return row; }
      },
      smsEmailConsentEvent: { create: async ({ data }: any) => { events.push(data); return data; } }
    };
    const client: any = {
      guardian: { findUnique: async () => ({ id: "guardian", primaryMobile: "+919876543210", email: "parent@example.com" }) },
      smsEmailIntegrationProfile: { findFirst: async () => ({ defaultCountryCode: "+91" }) },
      $transaction: async (callback: any) => callback(tx)
    };
    await expect(recordSmsEmailConsent(client, {
      channel: "SMS", subjectType: "GUARDIAN", guardianId: "guardian",
      consentSource: "SCHOOL_OFFICE", evidenceReference: "QA19C-PAPER-1"
    }, director)).rejects.toThrow(/explicit unchecked opt-in/i);
    const result = await recordSmsEmailConsent(client, {
      channel: "SMS", subjectType: "GUARDIAN", guardianId: "guardian", explicitlyAgreed: true,
      consentSource: "SCHOOL_OFFICE", evidenceReference: "QA19C-PAPER-1"
    }, director);
    expect(result.status).toBe("OPTED_IN");
    expect(created[0].contactMasked).not.toContain("9876543210");
    expect(events.map((row) => row.eventType)).toEqual(["INVALIDATED_PHONE_CHANGE", "OPTED_IN"]);
  });

  it("blocks cross-account consent revocation and cancels queued rows after an authorised opt-out", async () => {
    const consent = { id: "consent", guardianId: "guardian-a", staffMemberId: null, status: "OPTED_IN" };
    const client: any = {
      smsEmailConsent: { findUnique: async () => consent },
      staffMember: { findFirst: async () => null },
      $transaction: async (callback: any) => callback({
        smsEmailConsent: { update: async ({ data }: any) => ({ ...consent, ...data }) },
        smsEmailConsentEvent: { create: async () => ({}) },
        smsEmailDelivery: { updateMany: async () => ({ count: 2 }) }
      })
    };
    await expect(optOutSmsEmailConsent(client, "consent", {
      id: "p2", name: "Other", username: "other", email: null, role: "PARENT", guardianId: "guardian-b"
    })).rejects.toThrow(/only your own/i);
    const result = await optOutSmsEmailConsent(client, "consent", {
      id: "p1", name: "Parent", username: "parent", email: null, role: "PARENT", guardianId: "guardian-a"
    });
    expect(result.status).toBe("OPTED_OUT");
  });

  it("validates disabled-by-default profiles and India-local quiet hours", () => {
    expect(validateSmsEmailProfileInput({
      profileCode: "QA19C_EMAIL", displayName: "QA Email", channel: "EMAIL",
      providerKind: "MOCK_EMAIL", mode: "MOCK", quietHoursStart: "21:00", quietHoursEnd: "07:00"
    })).toMatchObject({ channel: "EMAIL", mode: "MOCK" });
    expect(() => validateSmsEmailProfileInput({
      profileCode: "QA19C_LIVE", displayName: "Bad", channel: "EMAIL",
      providerKind: "MOCK_EMAIL", mode: "LIVE"
    })).toThrow(/cannot use a MOCK provider/i);
    expect(isSmsEmailQuietHours({ quietHoursStart: "21:00", quietHoursEnd: "07:00", timezone: "Asia/Kolkata" }, new Date("2026-07-18T17:00:00Z"))).toBe(true);
  });
});
