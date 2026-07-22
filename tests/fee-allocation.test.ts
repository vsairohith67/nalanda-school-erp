import { describe, expect, it } from "vitest";
import { allocateFees } from "../lib/fee-allocation";

const normalStudent = {
  academicYear: "2026-27",
  admissionNo: "T1",
  studentName: "Test Student",
  className: "I",
  studentType: "Normal",
  discountPercent: 0
};

const classIFee = {
  className: "I",
  termAmount: 8600,
  term1Month: "June",
  term2Month: "September",
  term3Month: "December",
  term4Month: "February"
};

function payment(amountPaid: number, feeType = "Current Year Fee") {
  return { amountPaid, feeType };
}

describe("fee allocation", () => {
  it("keeps all four terms pending when there is no payment", () => {
    const result = allocateFees(normalStudent, classIFee, [], new Date("2026-06-01"));
    expect(result.terms.map((term) => term.due)).toEqual([8600, 8600, 8600, 8600]);
    expect(result.totalPending).toBe(34400);
    expect(result.dueStatus).toBe("Not Started");
  });

  it("allocates exact Term 1 payment", () => {
    const result = allocateFees(normalStudent, classIFee, [payment(8600)]);
    expect(result.terms.map((term) => term.paid)).toEqual([8600, 0, 0, 0]);
    expect(result.terms[0].due).toBe(0);
  });

  it("allocates partial Term 1 payment", () => {
    const result = allocateFees(normalStudent, classIFee, [payment(3000)]);
    expect(result.terms[0].paid).toBe(3000);
    expect(result.terms[0].due).toBe(5600);
  });

  it("allocates Term 1 and Term 2 paid together", () => {
    const result = allocateFees(normalStudent, classIFee, [payment(17200)]);
    expect(result.terms.map((term) => term.paid)).toEqual([8600, 8600, 0, 0]);
  });

  it("allocates full annual fee paid at once", () => {
    const result = allocateFees(normalStudent, classIFee, [payment(34400)]);
    expect(result.totalPending).toBe(0);
    expect(result.dueStatus).toBe("Fully Paid");
  });

  it("tracks overpayment without overfilling terms", () => {
    const result = allocateFees(normalStudent, classIFee, [payment(35000)]);
    expect(result.terms.map((term) => term.paid)).toEqual([8600, 8600, 8600, 8600]);
    expect(result.overpayment).toBe(600);
    expect(result.totalPending).toBe(0);
  });

  it("applies faculty child 50 percent discount", () => {
    const result = allocateFees(
      { ...normalStudent, studentType: "Faculty Child", discountPercent: 0, className: "III" },
      { ...classIFee, className: "III", termAmount: 9200 },
      [payment(4600)]
    );
    expect(result.perTermFee).toBe(4600);
    expect(result.annualFeeAfterDiscount).toBe(18400);
    expect(result.terms[0].due).toBe(0);
  });

  it("sums split payment rows with the same receipt number", () => {
    const result = allocateFees(normalStudent, classIFee, [payment(4000), payment(4600)]);
    expect(result.terms[0].paid).toBe(8600);
  });

  it("does not count a cancelled payment in dues allocation", () => {
    const result = allocateFees(normalStudent, classIFee, [
      { ...payment(8600), isCancelled: true },
      payment(3000)
    ]);
    expect(result.totalCurrentYearPaid).toBe(3000);
    expect(result.terms[0].due).toBe(5600);
  });

  it("sums multiple small payments", () => {
    const result = allocateFees(normalStudent, classIFee, [payment(1000), payment(1500), payment(2500)]);
    expect(result.terms[0].paid).toBe(5000);
    expect(result.terms[0].due).toBe(3600);
  });

  it("uses IX/X due schedule separately from Nursery-VIII", () => {
    const ix = allocateFees(
      { ...normalStudent, className: "IX" },
      { className: "IX", termAmount: 11300, term1Month: "April", term2Month: "July", term3Month: "October", term4Month: "January" },
      []
    );
    const lower = allocateFees(normalStudent, classIFee, []);
    expect(ix.terms.map((term) => term.dueMonth)).toEqual(["April", "July", "October", "January"]);
    expect(lower.terms.map((term) => term.dueMonth)).toEqual(["June", "September", "December", "February"]);
  });
});
