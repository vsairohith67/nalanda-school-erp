import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  assertPaymentImportRowLimit,
  createImportedPaymentWithAudit,
  normalizePaymentImportRows,
  parsePaymentImportAmount,
  parsePaymentImportDate,
  type PaymentImportStudent
} from "../lib/payment-import";

const students: PaymentImportStudent[] = [
  {
    id: "student-1",
    admissionNo: "8350/26",
    studentName: "Anaya Begum",
    className: "VI",
    section: "C"
  },
  {
    id: "student-2",
    admissionNo: "9001/26",
    studentName: "Same Name",
    className: "V",
    section: "A"
  },
  {
    id: "student-3",
    admissionNo: "9002/26",
    studentName: "Same Name",
    className: "V",
    section: "B"
  }
];

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    Date: "18/06/2026",
    "Receipt No": "R-100",
    "Admission No": "8350/26",
    Amount: "₹ 5,000",
    Mode: "Cash",
    Account: "Cash",
    ...overrides
  };
}

describe("payment import upgrade", () => {
  it("maps flexible payment column aliases", () => {
    const row = normalizePaymentImportRows([{
      "Payment Date": "18-06-2026",
      "R.No": " 12501 ",
      AdmNo: " 8350/26 ",
      "NAME OF THE STUDENT": "ANAYA BEGUM",
      Grade: "Class 6",
      SEC: "c",
      "Fee Paid": "₹10,000",
      "Cash / GPay": "GPay",
      "Paid To": "director sir gpay",
      "UPI Ref": "GPAY10000",
      Description: "June collection",
      Instalment: "I Term",
      "Fee Type": "term fee",
      Notes: "Counter entry",
      enteredBy: "Office"
    }], students).rows[0];

    expect(row.normalized).toMatchObject({
      date: "2026-06-18",
      receiptNo: "12501",
      admissionNo: "8350/26",
      amountPaid: 10000,
      paymentMode: "UPI",
      receivedAccount: "Director Sir GPay",
      transactionRefNo: "GPAY10000",
      feeType: "Current Year Fee",
      termHint: "Term 1",
      receivedBy: "Office",
      remarks: "June collection — Counter entry"
    });
  });

  it("parses rupee symbols, commas, and spaces in amounts", () => {
    expect(parsePaymentImportAmount(" ₹ 12,500.50 ")).toBe(12500.5);
  });

  it("parses DD/MM/YYYY and Excel date serials", () => {
    expect(parsePaymentImportDate("18/06/2026")).toBe("2026-06-18");
    expect(parsePaymentImportDate(25569)).toBe("1970-01-01");
  });

  it("maps GPay to UPI and Director Sir GPay", () => {
    const row = normalizePaymentImportRows([
      validRow({ Mode: "Google Pay", Account: "" })
    ], students).rows[0];

    expect(row.normalized.paymentMode).toBe("UPI");
    expect(row.normalized.receivedAccount).toBe("Director Sir GPay");
  });

  it("maps NPS to UPI and NPS Current Account UPI", () => {
    const row = normalizePaymentImportRows([
      validRow({ Mode: "NPS", Account: "" })
    ], students).rows[0];

    expect(row.normalized.paymentMode).toBe("UPI");
    expect(row.normalized.receivedAccount).toBe("NPS Current Account UPI");
  });

  it("accepts received account aliases for Director and NPS accounts", () => {
    expect(normalizePaymentImportRows([
      validRow({ Mode: "UPI", Account: "GPay", UTR: "UPI-1" })
    ], students).rows[0].normalized.receivedAccount).toBe("Director Sir GPay");
    expect(normalizePaymentImportRows([
      validRow({ Mode: "UPI", Account: "Director", UTR: "UPI-2" })
    ], students).rows[0].normalized.receivedAccount).toBe("Director Sir GPay");
    expect(normalizePaymentImportRows([
      validRow({ Mode: "UPI", Account: "Director Sir GPay", UTR: "UPI-3" })
    ], students).rows[0].normalized.receivedAccount).toBe("Director Sir GPay");
    expect(normalizePaymentImportRows([
      validRow({ Mode: "UPI", Account: "NPS", UTR: "UPI-4" })
    ], students).rows[0].normalized.receivedAccount).toBe("NPS Current Account UPI");
    expect(normalizePaymentImportRows([
      validRow({ Mode: "UPI", Account: "NPS UPI", UTR: "UPI-5" })
    ], students).rows[0].normalized.receivedAccount).toBe("NPS Current Account UPI");
    expect(normalizePaymentImportRows([
      validRow({ Mode: "UPI", Account: "NPS Current Account UPI", UTR: "UPI-6" })
    ], students).rows[0].normalized.receivedAccount).toBe("NPS Current Account UPI");
    expect(normalizePaymentImportRows([
      validRow({ Mode: "UPI", Account: "Current Account UPI", UTR: "UPI-7" })
    ], students).rows[0].normalized.receivedAccount).toBe("NPS Current Account UPI");
  });

  it("does not warn that valid received accounts are missing", () => {
    const director = normalizePaymentImportRows([
      validRow({ Mode: "UPI", Account: "Director Sir GPay", UTR: "UPI-1" })
    ], students).rows[0];
    const nps = normalizePaymentImportRows([
      validRow({ Mode: "UPI", Account: "NPS Current Account UPI", UTR: "UPI-2" })
    ], students).rows[0];

    expect(director.warnings.join(" ")).not.toContain("Received account was blank");
    expect(nps.warnings.join(" ")).not.toContain("Received account was blank");
  });

  it("warns only when received account is blank and defaults from mode", () => {
    const row = normalizePaymentImportRows([
      validRow({ Mode: "GPay", Account: "", UTR: "UPI-1" })
    ], students).rows[0];

    expect(row.normalized.receivedAccount).toBe("Director Sir GPay");
    expect(row.warnings).toContain("Received account was blank; defaulted to Director Sir GPay.");
  });

  it("maps an invalid received account to Other with a clear warning", () => {
    const row = normalizePaymentImportRows([
      validRow({ Mode: "UPI", Account: "Unknown Wallet", UTR: "UPI-1" })
    ], students).rows[0];

    expect(row.normalized.receivedAccount).toBe("Other");
    expect(row.warnings).toContain('Received account "Unknown Wallet" was not recognized; mapped to Other.');
  });

  it("allows split receipt rows when amount, mode, or account differs", () => {
    const preview = normalizePaymentImportRows([
      validRow({ Amount: 3000, Mode: "Cash", Account: "Cash" }),
      validRow({ Amount: 2000, Mode: "GPay", Account: "GPay", UTR: "UPI-1" })
    ], students);

    expect(preview.rows.map((row) => row.duplicate)).toEqual([false, false]);
    expect(preview.counts.ready).toBe(2);
  });

  it("skips an exact duplicate payment already in the database", () => {
    const preview = normalizePaymentImportRows(
      [validRow()],
      students,
      [{
        date: new Date("2026-06-18T00:00:00.000Z"),
        receiptNo: "R-100",
        admissionNo: "8350/26",
        amountPaid: 5000,
        paymentMode: "Cash",
        receivedAccount: "Cash"
      }]
    );

    expect(preview.rows[0].duplicate).toBe(true);
    expect(preview.rows[0].warnings.join(" ")).toContain("already exists");
  });

  it("matches a missing admission number by exact student name and class", () => {
    const row = normalizePaymentImportRows([
      validRow({
        "Admission No": "",
        "Student Name": " anaya   begum ",
        Class: "6"
      })
    ], students).rows[0];

    expect(row.errors).toEqual([]);
    expect(row.matchedStudent?.admissionNo).toBe("8350/26");
    expect(row.warnings).toContain("Matched by name and class because admission number was missing.");
  });

  it("rejects ambiguous name and class matches", () => {
    const row = normalizePaymentImportRows([
      validRow({
        "Admission No": "",
        "Student Name": "Same Name",
        Class: "V"
      })
    ], students).rows[0];

    expect(row.errors).toContain("Multiple students matched; admission number required.");
  });

  it("warns when a UPI payment is missing UTR", () => {
    const row = normalizePaymentImportRows([
      validRow({ Mode: "GPay", Account: "GPay", UTR: "" })
    ], students).rows[0];

    expect(row.warnings).toContain("UPI/bank payment is missing transactionRefNo.");
  });

  it("maps NEFT, RTGS, and IMPS as bank account payments", () => {
    const preview = normalizePaymentImportRows([
      validRow({ Mode: "NEFT", Account: "", UTR: "NEFT-1" }),
      validRow({ Mode: "RTGS", Account: "", UTR: "RTGS-1", Amount: 6000 }),
      validRow({ Mode: "IMPS", Account: "", UTR: "IMPS-1", Amount: 7000 })
    ], students);

    expect(preview.rows.map((row) => row.normalized.paymentMode)).toEqual(["NEFT", "RTGS", "IMPS"]);
    expect(preview.rows.map((row) => row.normalized.receivedAccount)).toEqual([
      "NPS Bank Account",
      "NPS Bank Account",
      "NPS Bank Account"
    ]);
  });

  it("creates a CREATED payment audit for an imported payment", async () => {
    const row = normalizePaymentImportRows([
      validRow({ "Received By": "" })
    ], students, [], "Director").rows[0];
    const paymentCreate = vi.fn().mockResolvedValue({
      id: "payment-1",
      receiptNo: row.normalized.receiptNo,
      amountPaid: row.normalized.amountPaid
    });
    const auditCreate = vi.fn().mockResolvedValue({ id: "audit-1" });

    await createImportedPaymentWithAudit(
      {
        payment: { findFirst: vi.fn().mockResolvedValue(null), create: paymentCreate },
        paymentAudit: { create: auditCreate }
      } as never,
      row,
      { id: "user-1", name: "Director" }
    );

    expect(paymentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        studentId: "student-1",
        enteredBy: "Director"
      })
    }));
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentId: "payment-1",
        action: "CREATED",
        changedByUserId: "user-1",
        changedByName: "Director",
        reason: "Imported from payment file"
      })
    });
  });

  it("rejects imports over 2,000 rows before normalization", () => {
    expect(() => assertPaymentImportRowLimit(new Array(2_000))).not.toThrow();
    expect(() => assertPaymentImportRowLimit(new Array(2_001))).toThrow("limited to 2000 rows");
    const source = readFileSync("app/api/import/payments/route.ts", "utf8");
    expect(source.indexOf("assertPaymentImportRowLimit(rows)")).toBeLessThan(
      source.indexOf("prisma.student.findMany")
    );
  });

  it("rechecks receipt ownership and exact duplicates inside the import transaction", async () => {
    const row = normalizePaymentImportRows([validRow()], students, [], "Director").rows[0];
    const crossStudentClient = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({ admissionNo: "different-student" }),
        create: vi.fn()
      },
      paymentAudit: { create: vi.fn() }
    };
    await expect(createImportedPaymentWithAudit(
      crossStudentClient as never,
      row,
      { id: "user-1", name: "Director" }
    )).rejects.toThrow("different student");
    expect(crossStudentClient.payment.create).not.toHaveBeenCalled();

    const duplicateClient = {
      payment: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: "existing-payment" }),
        create: vi.fn()
      },
      paymentAudit: { create: vi.fn() }
    };
    await expect(createImportedPaymentWithAudit(
      duplicateClient as never,
      row,
      { id: "user-1", name: "Director" }
    )).rejects.toThrow("Duplicate payment");
    expect(duplicateClient.payment.create).not.toHaveBeenCalled();
  });
});
