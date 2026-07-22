import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { collectLibraryCharge } from "@/lib/library-charges";
import { createLibraryIncident, resolveLibraryIncident } from "@/lib/library-incidents";

function incidentClient(loan: Record<string, unknown>) {
  const create = vi.fn(async () => { throw new Error("unsafe incident creation reached"); });
  const tx = { libraryLoan: { findUnique: async () => loan }, libraryIncident: { create } };
  return { client: { $transaction: async (fn: (value: unknown) => unknown) => fn(tx) } as any, create };
}

const baseLoan = {
  id: "loan-1",
  memberId: "member-1",
  copyId: "copy-1",
  status: "ISSUED",
  issueDate: new Date("2026-07-10T00:00:00.000Z"),
  copy: { id: "copy-1", titleId: "title-1", status: "AVAILABLE", condition: "GOOD" },
  member: { id: "member-1" }
};

describe("Prompt 16H QA hardening", () => {
  it("rejects damage cases against cancelled loans", async () => {
    const { client, create } = incidentClient({ ...baseLoan, status: "CANCELLED" });
    await expect(createLibraryIncident(client, { loanId: "loan-1", incidentType: "DAMAGED", reportedDate: "2026-07-16", incidentCondition: "DAMAGED", description: "QA damage" }, "user-1")).rejects.toThrow(/issued or returned/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects incident dates before the linked loan was issued", async () => {
    const { client, create } = incidentClient(baseLoan);
    await expect(createLibraryIncident(client, { loanId: "loan-1", incidentType: "LOST", reportedDate: "2026-07-09", description: "QA lost" }, "user-1")).rejects.toThrow(/before the loan issue date/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects unsupported damage conditions", async () => {
    const { client, create } = incidentClient(baseLoan);
    await expect(createLibraryIncident(client, { loanId: "loan-1", incidentType: "DAMAGED", reportedDate: "2026-07-16", incidentCondition: "NEW", description: "QA damage" }, "user-1")).rejects.toThrow(/damage condition/i);
    expect(create).not.toHaveBeenCalled();
  });

  it("accepts only an available accessioned replacement copy", async () => {
    const updateMany = vi.fn(async () => { throw new Error("unsafe resolution reached"); });
    const tx = {
      libraryIncident: {
        findUnique: async () => ({ id: "incident-1", status: "APPROVED", activeCaseKey: "loan-1:copy-1", incidentType: "LOST", copyId: "copy-1", loanId: "loan-1", memberId: "member-1", titleId: "title-1", loan: baseLoan, copy: baseLoan.copy, charges: [] }),
        updateMany
      },
      libraryCopy: { findUnique: async () => ({ id: "copy-2", status: "ISSUED" }) }
    };
    const client = { $transaction: async (fn: (value: unknown) => unknown) => fn(tx) } as any;
    await expect(resolveLibraryIncident(client, "incident-1", { resolutionType: "REPLACEMENT_ACCEPTED", replacementCopyId: "copy-2", resolvedDate: "2026-07-16", resolutionNotes: "QA replacement" }, "user-1")).rejects.toThrow(/available accessioned/i);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("re-checks borrower ownership before creating a financial receipt", async () => {
    const receiptCreate = vi.fn(async () => { throw new Error("unsafe receipt creation reached"); });
    const row = {
      id: "charge-1", chargeNumber: "LCH-1", chargeType: "OVERDUE", status: "APPROVED", incidentId: null,
      memberId: "member-1", studentId: "student-other", staffMemberId: null,
      originalAmount: new Prisma.Decimal("10.00"), waivedAmount: new Prisma.Decimal("0"), payableAmount: new Prisma.Decimal("10.00"), miscIncomeReceiptId: null,
      member: { id: "member-1", studentId: null, staffMemberId: "staff-1", student: null, staffMember: { fullName: "Teacher" } }
    };
    const tx = { libraryCharge: { findUnique: async () => row }, miscIncomeReceipt: { create: receiptCreate } };
    const client = { $transaction: async (fn: (value: unknown) => unknown) => fn(tx) } as any;
    await expect(collectLibraryCharge(client, "charge-1", { receiptDate: "2026-07-16", academicYear: "2026-27", paymentMethod: "CASH" }, "user-1")).rejects.toThrow(/ownership/i);
    expect(receiptCreate).not.toHaveBeenCalled();
  });

  it("uses India-local date defaults in every accountability form", () => {
    const source = readFileSync("components/library-accountability-forms.tsx", "utf8");
    expect(source).toContain('import { schoolDateKey } from "@/lib/format"');
    expect(source).not.toContain("new Date().toISOString().slice(0,10)");
    expect(source.match(/defaultValue=\{schoolDateKey\(\)\}/g)).toHaveLength(4);
  });

  it("serializes the charge action payload before crossing the client boundary", () => {
    const source = readFileSync("app/library/charges/[id]/page.tsx", "utf8");
    expect(source).toContain("payableAmount: row.payableAmount.toFixed(2)");
    expect(source).toContain("charge={chargeActionPayload}");
    expect(source).not.toContain("<ChargeActions charge={row}");
  });

  it("allowlists plain incident and charge options before client rendering", () => {
    const incidentNew = readFileSync("app/library/incidents/new/page.tsx", "utf8");
    const incidentActions = readFileSync("components/library-incident-actions-server.tsx", "utf8");
    const chargeNew = readFileSync("app/library/charges/new/page.tsx", "utf8");
    expect(incidentNew).toContain("<IncidentCreateForm loans={loanOptions}");
    expect(incidentActions).toContain("<ClientIncidentActions");
    expect(chargeNew).toContain("dueDate: row.dueDate.toISOString().slice(0, 10)");
    expect(chargeNew).toContain("<ChargeCreateForm loans={loanOptions} incidents={incidentOptions}");
  });
});
