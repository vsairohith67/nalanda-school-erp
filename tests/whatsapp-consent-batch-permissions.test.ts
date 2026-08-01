import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isWhatsAppQuietHours, newWhatsAppBatchNumber } from "@/lib/whatsapp-batches";
import { optOutWhatsAppConsent, recordWhatsAppConsent } from "@/lib/whatsapp-consents";
import { PERMISSIONS, RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";

describe("Prompt 19B consent enforcement", () => {
  function client() {
    const created: any[] = [], events: any[] = [];
    const tx = {
      whatsAppConsent: {
        findMany: async () => [],
        update: async ({ data }: any) => data,
        create: async ({ data }: any) => { const row = { id: "consent-1", ...data }; created.push(row); return row; }
      },
      whatsAppConsentEvent: { create: async ({ data }: any) => { events.push(data); return data; } }
    };
    return {
      created, events,
      guardian: { findUnique: async () => ({ id: "guardian-1", primaryMobile: "+919876543210" }) },
      whatsAppIntegrationProfile: { findFirst: async () => ({ defaultCountryCode: "+91" }) },
      whatsAppConsent: { findFirst: async () => null },
      $transaction: async (callback: any) => callback(tx)
    };
  }
  const parent = { id: "user-1", name: "Parent", username: "parent", email: null, designation: null, role: "PARENT" as const, roleAssignmentId: "parent-role", authorizationVersion: 1, mustChangePassword: false, guardianId: "guardian-1" };
  it("requires explicit opt-in and creates an append-only event", async () => {
    const db = client();
    await expect(recordWhatsAppConsent(db, { subjectType: "GUARDIAN", explicitlyAgreed: false }, parent)).rejects.toThrow(/explicit opt-in/);
    await expect(recordWhatsAppConsent(db, { subjectType: "GUARDIAN", explicitlyAgreed: true }, parent)).resolves.toMatchObject({ status: "OPTED_IN" });
    expect(db.events).toHaveLength(1);
    expect(db.created[0]).not.toHaveProperty("phone");
    expect(db.created[0].phoneHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("binds Parent ownership to the authenticated Guardian", async () => {
    const db = client();
    await recordWhatsAppConsent(db, { subjectType: "GUARDIAN", guardianId: "unrelated", explicitlyAgreed: true }, parent);
    expect(db.created[0].guardianId).toBe("guardian-1");
  });
  it("requires evidence for paper, office, and imported consent", async () => {
    const db = client();
    for (const consentSource of ["PAPER_FORM", "SCHOOL_OFFICE", "IMPORTED_WITH_EVIDENCE"]) {
      await expect(recordWhatsAppConsent(db, { subjectType: "GUARDIAN", explicitlyAgreed: true, consentSource }, parent)).rejects.toThrow(/evidence reference/);
    }
  });
});

describe("Prompt 19B batch controls", () => {
  const profile = { quietHoursStart: "21:00", quietHoursEnd: "06:00", timezone: "Asia/Kolkata" };
  it("uses India-local overnight quiet hours", () => {
    expect(isWhatsAppQuietHours(profile, new Date("2026-07-17T17:00:00Z"))).toBe(true);
    expect(isWhatsAppQuietHours(profile, new Date("2026-07-17T07:00:00Z"))).toBe(false);
  });
  it("creates unique operational batch numbers without contact data", () => {
    const first = newWhatsAppBatchNumber(new Date("2026-07-17T00:00:00Z"));
    const second = newWhatsAppBatchNumber(new Date("2026-07-17T00:00:00Z"));
    expect(first).toMatch(/^WA-\d{8}-[A-F0-9]{8}$/);
    expect(first).not.toBe(second);
  });
});

describe("Prompt 19B recommended permissions", () => {
  it("registers the exact seventeen permissions", () => {
    const rows = PERMISSIONS.filter((permission) => permission.includes("WHATSAPP"));
    expect(rows).toHaveLength(17);
  });
  it("keeps emergency quiet-hours override Director/Super Admin only", () => {
    expect(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR.has("MANAGE_WHATSAPP_INTEGRATION")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR.has("OVERRIDE_WHATSAPP_QUIET_HOURS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN.has("OVERRIDE_WHATSAPP_QUIET_HOURS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.PRINCIPAL.has("OVERRIDE_WHATSAPP_QUIET_HOURS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR.has("OVERRIDE_WHATSAPP_COST_CAP")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.SUPER_ADMIN.has("OVERRIDE_WHATSAPP_COST_CAP")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.PRINCIPAL.has("OVERRIDE_WHATSAPP_COST_CAP")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("OVERRIDE_WHATSAPP_COST_CAP")).toBe(false);
  });
  it("keeps Admin away from final approval/send", () => {
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("MANAGE_WHATSAPP_CONSENTS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("MANAGE_WHATSAPP_INTEGRATION")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("MANAGE_WHATSAPP_TEMPLATE_MAPPINGS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("CREATE_WHATSAPP_BATCHES")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("PROCESS_WHATSAPP_QUEUE")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("VIEW_WHATSAPP_REPORTS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("APPROVE_WHATSAPP_BATCHES")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("SEND_WHATSAPP_BATCHES")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("OVERRIDE_WHATSAPP_QUIET_HOURS")).toBe(false);
  });
  it("restricts Teacher, Parent, and Accountant to own consent, and Viewer to aggregate reports without export", () => {
    expect([...RECOMMENDED_ROLE_PERMISSIONS.TEACHER].filter((row) => row.includes("WHATSAPP"))).toEqual(["MANAGE_OWN_WHATSAPP_CONSENT"]);
    expect([...RECOMMENDED_ROLE_PERMISSIONS.PARENT].filter((row) => row.includes("WHATSAPP"))).toEqual(["MANAGE_OWN_WHATSAPP_CONSENT"]);
    expect([...RECOMMENDED_ROLE_PERMISSIONS.ACCOUNTANT].filter((row) => row.includes("WHATSAPP"))).toEqual(["MANAGE_OWN_WHATSAPP_CONSENT"]);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("VIEW_WHATSAPP_REPORTS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("EXPORT_WHATSAPP_REPORTS")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("VIEW_WHATSAPP_DELIVERIES")).toBe(false);
  });
});

describe("Prompt 19B StaffMember-linked own consent", () => {
  const accountant = { id: "accountant-user", name: "Accountant", username: "accountant", email: null, designation: "Accountant", role: "ACCOUNTANT" as const, roleAssignmentId: "accountant-role", authorizationVersion: 1, mustChangePassword: false, guardianId: null };
  it("binds a linked Accountant to only their own active StaffMember", async () => {
    const created: any[] = [];
    const db: any = {
      staffMember: {
        findFirst: async ({ where }: any) => where.userId === accountant.id && where.status === "ACTIVE" ? { id: "staff-own", mobile: "+919876543210" } : null,
        findUnique: async () => ({ id: "staff-other", mobile: "+919999999999" })
      },
      whatsAppIntegrationProfile: { findFirst: async () => ({ defaultCountryCode: "+91" }) },
      whatsAppConsent: { findFirst: async () => null },
      $transaction: async (callback: any) => callback({
        whatsAppConsent: {
          findMany: async () => [],
          update: async ({ data }: any) => data,
          create: async ({ data }: any) => { const row = { id: "consent-own", ...data }; created.push(row); return row; }
        },
        whatsAppConsentEvent: { create: async ({ data }: any) => data }
      })
    };
    await recordWhatsAppConsent(db, { subjectType: "STAFF", staffMemberId: "staff-other", ownStaffConsent: true, consentSource: "STAFF_PORTAL", explicitlyAgreed: true }, accountant);
    expect(created[0].staffMemberId).toBe("staff-own");
  });
  it("blocks opt-out of another StaffMember and returns a safe unlinked state", async () => {
    const db: any = {
      whatsAppConsent: { findUnique: async () => ({ id: "other-consent", status: "OPTED_IN", staffMemberId: "staff-other" }) },
      staffMember: { findFirst: async () => ({ id: "staff-own" }) }
    };
    await expect(optOutWhatsAppConsent(db, "other-consent", accountant, "Own portal", { ownStaffOnly: true })).rejects.toThrow(/only your own Staff consent/);
    const unlinked = { ...db, staffMember: { findFirst: async () => null } };
    await expect(optOutWhatsAppConsent(unlinked, "other-consent", accountant, "Own portal", { ownStaffOnly: true })).rejects.toThrow(/only your own Staff consent/);
  });
  it("guards the Staff preferences page/API by permission and active ownership rather than a TEACHER role literal", () => {
    const page = readFileSync("app/teacher/communication-preferences/page.tsx", "utf8");
    const api = readFileSync("app/api/teacher/communication-preferences/route.ts", "utf8");
    const nav = readFileSync("components/app-shell.tsx", "utf8");
    expect(page).toContain('requirePermission("MANAGE_OWN_WHATSAPP_CONSENT")');
    expect(api).toContain('requireApiPermission("MANAGE_OWN_WHATSAPP_CONSENT")');
    expect(page + api).not.toContain('role !== "TEACHER"');
    expect(api).toContain("ownStaffOnly: true");
    expect(api).toContain("ownStaffConsent: true");
    expect(nav).toContain('permissions.includes("MANAGE_OWN_WHATSAPP_CONSENT")');
  });
});
