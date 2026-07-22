import { describe, expect, it } from "vitest";
import { buildDetailedReminder, buildShortReminder, buildWhatsAppLink, normalizeWhatsAppNumber } from "../lib/reminders";

const input = {
  academicYear: "2026-27",
  studentName: "Aarav Reddy",
  className: "LKG",
  section: "A",
  totalPending: 23400,
  term1Due: 0,
  term2Due: 7800,
  term3Due: 7800,
  term4Due: 7800
};

describe("parent reminders", () => {
  it("generates the short pending fee reminder", () => {
    const message = buildShortReminder(input);
    expect(message).toContain("₹23,400");
    expect(message).toContain("Aarav Reddy");
    expect(message).toContain("Academic Year 2026-27");
  });

  it("generates term-wise detailed reminder", () => {
    const message = buildDetailedReminder(input);
    expect(message).toContain("Term 1: ₹0");
    expect(message).toContain("Term 4: ₹7,800");
    expect(message).toContain("Total Pending: ₹23,400");
  });

  it("formats Indian phone numbers and WhatsApp links", () => {
    expect(normalizeWhatsAppNumber("90000 00001")).toBe("919000000001");
    const link = buildWhatsAppLink("9000000001", "Fee reminder ₹100");
    expect(link).toBe("https://wa.me/919000000001?text=Fee%20reminder%20%E2%82%B9100");
  });

  it("returns no link when phone number is unavailable", () => {
    expect(buildWhatsAppLink("", "Reminder")).toBeNull();
  });
});
