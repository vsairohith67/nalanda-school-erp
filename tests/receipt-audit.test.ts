import { describe, expect, it } from "vitest";
import { analyzeReceiptPayments, paymentAuditSummaryFields } from "../lib/receipt-audit";

describe("receipt audit classification", () => {
  it("keeps a fully cancelled receipt classified as Cancelled", () => {
    const result = analyzeReceiptPayments([{
      admissionNo: "QA-1",
      amountPaid: 1000,
      paymentMode: "Cash",
      transactionRefNo: null,
      isCancelled: true
    }]);

    expect(result.status).toBe("Cancelled");
    expect(result.total).toBe(0);
    expect(result.issues).toContain("All payment rows cancelled");
  });

  it("requires transaction references for cheque but not other payments", () => {
    expect(analyzeReceiptPayments([{
      admissionNo: "QA-1",
      amountPaid: 1000,
      paymentMode: "Cheque",
      transactionRefNo: null
    }]).status).toBe("Needs Review");
    expect(analyzeReceiptPayments([{
      admissionNo: "QA-1",
      amountPaid: 1000,
      paymentMode: "Other",
      transactionRefNo: null
    }]).status).toBe("Used");
  });

  it("flags UPI payments without references", () => {
    const result = analyzeReceiptPayments([{
      admissionNo: "QA-1",
      amountPaid: 1000,
      paymentMode: "UPI",
      transactionRefNo: null
    }]);
    expect(result.status).toBe("Needs Review");
  });

  it("treats same-student receipt components as split payment", () => {
    const result = analyzeReceiptPayments([
      { admissionNo: "QA-1", amountPaid: 3000, paymentMode: "Cash" },
      { admissionNo: "QA-1", amountPaid: 2000, paymentMode: "UPI", transactionRefNo: "UPI-1" }
    ]);
    expect(result.status).toBe("Split Payment");
    expect(result.total).toBe(5000);
  });

  it("keeps the same receipt across different students classified as duplicate", () => {
    const result = analyzeReceiptPayments([
      { admissionNo: "QA-1", amountPaid: 3000, paymentMode: "Cash" },
      { admissionNo: "QA-2", amountPaid: 2000, paymentMode: "UPI", transactionRefNo: "UPI-2" }
    ]);
    expect(result.status).toBe("Duplicate");
    expect(result.issues).toContain("multiple students");
  });

  it("builds beginner-friendly payment audit summary fields before raw details", () => {
    const fields = paymentAuditSummaryFields(JSON.stringify({
      receiptNo: "12520",
      studentName: "QA Student",
      admissionNo: "QA-1",
      className: "I",
      section: "B",
      amountPaid: 1200,
      paymentMode: "UPI",
      receivedAccount: "Director Sir GPay",
      transactionRefNo: "UTR-1",
      feeType: "Current Year Fee",
      termHint: "Auto",
      remarks: "Test"
    }), {
      action: "CREATED",
      changedByName: "Accountant",
      reason: "Split receipt component created"
    });

    expect(fields.map((field) => field.label)).toEqual(expect.arrayContaining([
      "Receipt No",
      "Student",
      "Class/Section",
      "Public mode label",
      "Internal received account",
      "Changed by",
      "Action",
      "Reason"
    ]));
    expect(fields.find((field) => field.label === "Class/Section")?.value).toBe("I-B");
  });
});
