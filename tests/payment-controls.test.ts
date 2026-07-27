import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertReceiptStudentMatch,
  assertReceiptStudentMatchInDatabase,
  normalizePaymentComponents,
  paymentComponentTotal,
  requiresTransactionReference,
  sumCountablePayments,
  sumPendingAmounts
} from "../lib/payment-controls";

describe("payment collection controls", () => {
  it("does not count cancelled payments in collection totals", () => {
    expect(
      sumCountablePayments([
        { amountPaid: 5000 },
        { amountPaid: 3000, isCancelled: true },
        { amountPaid: 2000, deletedAt: new Date() }
      ])
    ).toBe(5000);
  });

  it("requires references for UPI, bank transfers, and cheque payments", () => {
    expect(requiresTransactionReference("UPI")).toBe(true);
    expect(requiresTransactionReference("NEFT")).toBe(true);
    expect(requiresTransactionReference("RTGS")).toBe(true);
    expect(requiresTransactionReference("IMPS")).toBe(true);
    expect(requiresTransactionReference("Bank Transfer")).toBe(true);
    expect(requiresTransactionReference("Cheque")).toBe(true);
    expect(requiresTransactionReference("Cash")).toBe(false);
    expect(requiresTransactionReference("Other")).toBe(false);
  });

  it("sums student pending amounts without offsetting one student with another overpayment", () => {
    expect(sumPendingAmounts([
      { totalPending: 12000 },
      { totalPending: 0 },
      null,
      { totalPending: 3400 }
    ])).toBe(15400);
  });

  it("builds cash-only, UPI-only, and split component totals", () => {
    expect(paymentComponentTotal([{ amountPaid: 5000 }])).toBe(5000);
    expect(paymentComponentTotal([{ amountPaid: 3000 }, { amountPaid: 2000 }])).toBe(5000);
    expect(normalizePaymentComponents({
      components: [{ amountPaid: 5000, paymentMode: "Cash", receivedAccount: "Cash" }]
    })).toEqual([{
      amountPaid: 5000,
      paymentMode: "Cash",
      receivedAccount: "Cash",
      transactionRefNo: null
    }]);
    expect(normalizePaymentComponents({
      components: [{
        amountPaid: 5000,
        paymentMode: "UPI",
        receivedAccount: "Director Sir GPay",
        transactionRefNo: "UPI-1"
      }]
    })?.[0].paymentMode).toBe("UPI");
    expect(normalizePaymentComponents({
      components: [{
        amountPaid: 5000,
        paymentMode: "NEFT",
        receivedAccount: "NPS Bank Account",
        transactionRefNo: "NEFT-1"
      }]
    })?.[0].paymentMode).toBe("NEFT");
  });

  it("requires a UPI reference unless the operator confirms an audit warning", () => {
    expect(() => normalizePaymentComponents({
      components: [{ amountPaid: 2000, paymentMode: "UPI", receivedAccount: "Director Sir GPay" }]
    })).toThrow("transaction / UTR is required");
    expect(normalizePaymentComponents({
      allowMissingTransactionRef: true,
      components: [{ amountPaid: 2000, paymentMode: "UPI", receivedAccount: "Director Sir GPay" }]
    })).toHaveLength(1);
  });

  it("requires UPI and bank transfer amounts to be positive", () => {
    expect(() => normalizePaymentComponents({
      components: [{ amountPaid: 0, paymentMode: "UPI", receivedAccount: "Director Sir GPay", transactionRefNo: "UPI-1" }]
    })).toThrow("Enter a positive UPI amount");
    expect(() => normalizePaymentComponents({
      components: [{ amountPaid: 0, paymentMode: "NEFT", receivedAccount: "NPS Bank Account", transactionRefNo: "NEFT-1" }]
    })).toThrow("Enter a positive NEFT amount");
  });

  it("requires bank transfer and cheque references unless the audit warning is confirmed", () => {
    for (const paymentMode of ["NEFT", "RTGS", "IMPS", "Bank Transfer", "Cheque"]) {
      expect(() => normalizePaymentComponents({
        components: [{ amountPaid: 2000, paymentMode, receivedAccount: "NPS Bank Account" }]
      })).toThrow("transaction / UTR is required");
      expect(normalizePaymentComponents({
        allowMissingTransactionRef: true,
        components: [{ amountPaid: 2000, paymentMode, receivedAccount: "NPS Bank Account" }]
      })).toHaveLength(1);
    }
  });

  it("keeps multiple UPI transactions as separate receipt components", () => {
    expect(normalizePaymentComponents({
      components: [
        {
          amountPaid: 1500,
          paymentMode: "UPI",
          receivedAccount: "Director Sir GPay",
          transactionRefNo: "GPAY-1500"
        },
        {
          amountPaid: 2400,
          paymentMode: "UPI",
          receivedAccount: "NPS Current Account UPI",
          transactionRefNo: "NPSUPI-2400"
        }
      ]
    })).toEqual([
      {
        amountPaid: 1500,
        paymentMode: "UPI",
        receivedAccount: "Director Sir GPay",
        transactionRefNo: "GPAY-1500"
      },
      {
        amountPaid: 2400,
        paymentMode: "UPI",
        receivedAccount: "NPS Current Account UPI",
        transactionRefNo: "NPSUPI-2400"
      }
    ]);
  });

  it("allows same-student receipt components and rejects a different student", () => {
    expect(() => assertReceiptStudentMatch("QA-1", "QA-1")).not.toThrow();
    expect(() => assertReceiptStudentMatch(undefined, "QA-1")).not.toThrow();
    expect(() => assertReceiptStudentMatch("QA-2", "QA-1")).toThrow("different student");
  });

  it("enforces receipt ownership through the transaction-aware database helper", async () => {
    const findFirst = async () => null;
    await expect(assertReceiptStudentMatchInDatabase({
      payment: { findFirst }
    }, {
      receiptNo: "R-1",
      admissionNo: "QA-1"
    })).resolves.toBeUndefined();
    await expect(assertReceiptStudentMatchInDatabase({
      payment: { findFirst: async () => ({ admissionNo: "QA-1" }) }
    }, {
      receiptNo: "R-1",
      admissionNo: "QA-2",
      excludePaymentId: "payment-1"
    })).rejects.toThrow("different student");
  });

  it("routes every payment writer through the shared receipt-owner invariant", () => {
    for (const file of [
      "app/api/payments/route.ts",
      "lib/payment-import.ts",
      "lib/restore-database.ts"
    ]) {
      expect(readFileSync(file, "utf8")).toContain("assertReceiptStudentMatchInDatabase");
    }
    expect(readFileSync("app/api/payments/[id]/route.ts", "utf8")).toContain("correctFinalReceipt");
    expect(readFileSync("lib/receipt-integrity.ts", "utf8")).toContain("assertReceiptStudentMatchInDatabase");
  });
});
