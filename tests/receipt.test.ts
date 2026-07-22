import { describe, expect, it } from "vitest";
import { groupReceiptPayments } from "../lib/receipt";

describe("receipt grouping", () => {
  it("groups cash and UPI rows under one receipt with a total and breakup", () => {
    const grouped = groupReceiptPayments([
      {
        id: "cash",
        receiptNo: "12505",
        amountPaid: 5000,
        paymentMode: "Cash",
        receivedAccount: "Cash"
      },
      {
        id: "upi",
        receiptNo: "12505",
        amountPaid: 5000,
        paymentMode: "UPI",
        receivedAccount: "Director Sir GPay"
      }
    ]);
    expect(grouped.isSplit).toBe(true);
    expect(grouped.totalAmount).toBe(10000);
    expect(grouped.breakup["Cash / Cash"]).toBe(5000);
    expect(grouped.breakup["UPI / Director Sir GPay"]).toBe(5000);
    expect(grouped.publicBreakup.Cash).toBe(5000);
    expect(grouped.publicBreakup["UPI 1"]).toBe(5000);
    expect(grouped.status).toBe("ACTIVE");
  });

  it("uses parent-friendly public labels without exposing internal received accounts", () => {
    const grouped = groupReceiptPayments([
      { id: "cash", receiptNo: "12505", amountPaid: 500, paymentMode: "Cash", receivedAccount: "Cash" },
      { id: "upi-1", receiptNo: "12505", amountPaid: 1000, paymentMode: "UPI", receivedAccount: "Director Sir GPay" },
      { id: "upi-2", receiptNo: "12505", amountPaid: 1500, paymentMode: "UPI", receivedAccount: "NPS Current Account UPI" },
      { id: "neft", receiptNo: "12505", amountPaid: 2000, paymentMode: "NEFT", receivedAccount: "NPS Bank Account" },
      { id: "cheque", receiptNo: "12505", amountPaid: 2500, paymentMode: "Cheque", receivedAccount: "Other" }
    ]);

    expect(grouped.publicBreakup).toEqual({
      Cash: 500,
      "UPI 1": 1000,
      "UPI 2": 1500,
      NEFT: 2000,
      Cheque: 2500
    });
    expect(Object.keys(grouped.publicBreakup).join(" ")).not.toContain("Director Sir GPay");
    expect(Object.keys(grouped.publicBreakup).join(" ")).not.toContain("NPS Current Account UPI");
    expect(Object.keys(grouped.publicBreakup).join(" ")).not.toContain("NPS Bank Account");
  });

  it("marks a fully cancelled receipt and retains its recorded amount", () => {
    const grouped = groupReceiptPayments([
      {
        id: "cancelled",
        receiptNo: "12511",
        amountPaid: 7800,
        paymentMode: "UPI",
        receivedAccount: "NPS Current Account UPI",
        isCancelled: true
      }
    ]);
    expect(grouped.status).toBe("CANCELLED");
    expect(grouped.totalAmount).toBe(7800);
  });
});
