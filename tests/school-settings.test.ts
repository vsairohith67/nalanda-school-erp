import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHOOL_SETTINGS,
  displayReceiptNumber,
  getSchoolSettings,
  validateSchoolSettings
} from "../lib/school-settings";
import { buildDetailedReminder } from "../lib/reminders";

describe("school settings", () => {
  it("uses safe defaults when no settings row exists", async () => {
    const settings = await getSchoolSettings({
      schoolSettings: { findUnique: async () => null }
    } as never);
    expect(settings).toEqual(DEFAULT_SCHOOL_SETTINGS);
  });

  it("validates settings updates", () => {
    const updated = validateSchoolSettings({
      ...DEFAULT_SCHOOL_SETTINGS,
      schoolName: "Nalanda Test School",
      academicYear: "2027-28",
      defaultPrintSize: "A4",
      showSchoolPhone: false,
      showSchoolAddress: true
    });
    expect(updated).toMatchObject({
      schoolName: "Nalanda Test School",
      academicYear: "2027-28",
      defaultPrintSize: "A4",
      showSchoolPhone: false
    });
  });

  it("applies receipt prefixes and the configured WhatsApp footer", () => {
    expect(displayReceiptNumber("12501", "NPS-")).toBe("NPS-12501");
    const reminder = buildDetailedReminder({
      academicYear: "2026-27",
      studentName: "Aarav",
      className: "I",
      totalPending: 1000,
      term1Due: 1000,
      term2Due: 0,
      term3Due: 0,
      term4Due: 0,
      footer: "Nalanda Accounts Office"
    });
    expect(reminder).toContain("Nalanda Accounts Office");
  });
});
