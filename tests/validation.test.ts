import { describe, expect, it } from "vitest";
import { validatePaymentPayload, validateStudentPayload } from "../lib/validation";

function studentPayload(overrides: Record<string, unknown> = {}) {
  return {
    academicYear: "2026-27",
    admissionNo: "QA-1",
    studentName: "QA Student",
    fatherName: "QA Parent",
    className: "VI",
    phone1: "9000000000",
    status: "Active",
    studentType: "Normal",
    discountPercent: 0,
    ...overrides
  };
}

describe("workflow validation defaults", () => {
  it("defaults Faculty Child discount to 50 percent", () => {
    const result = validateStudentPayload(studentPayload({
      studentType: "Faculty Child",
      discountPercent: 0
    }));
    expect(result.discountPercent).toBe(50);
  });

  it("uses April for IX and X, and June for lower classes", () => {
    expect(validateStudentPayload(studentPayload({ className: "IX", startMonth: "June" })).startMonth).toBe("April");
    expect(validateStudentPayload(studentPayload({ className: "V", startMonth: "April" })).startMonth).toBe("June");
  });

  it("rejects invalid payment dates", () => {
    expect(() => validatePaymentPayload({
      date: "not-a-date",
      receiptNo: "QA-1",
      admissionNo: "QA-1",
      amountPaid: 100,
      paymentMode: "Cash",
      receivedAccount: "Cash",
      feeType: "Current Year Fee",
      termHint: "Auto"
    })).toThrow("Invalid payment date");
  });

  it("requires receipt and admission numbers for payment entry", () => {
    expect(() => validatePaymentPayload({
      date: "2026-06-18",
      receiptNo: "",
      admissionNo: "QA-1",
      amountPaid: 100,
      paymentMode: "Cash",
      receivedAccount: "Cash",
      feeType: "Current Year Fee",
      termHint: "Auto"
    })).toThrow("Receipt number is required");
    expect(() => validatePaymentPayload({
      date: "2026-06-18",
      receiptNo: "QA-1",
      admissionNo: "",
      amountPaid: 100,
      paymentMode: "Cash",
      receivedAccount: "Cash",
      feeType: "Current Year Fee",
      termHint: "Auto"
    })).toThrow("Admission number is required");
  });

  it("accepts school bank transfer labels without changing saved old labels", () => {
    for (const paymentMode of ["NEFT", "RTGS", "IMPS", "Bank Transfer"]) {
      expect(validatePaymentPayload({
        date: "2026-06-18",
        receiptNo: `QA-${paymentMode}`,
        admissionNo: "QA-1",
        amountPaid: 100,
        paymentMode,
        receivedAccount: "NPS Bank Account",
        feeType: "Current Year Fee",
        termHint: "Auto"
      }).paymentMode).toBe(paymentMode);
    }
  });
});
