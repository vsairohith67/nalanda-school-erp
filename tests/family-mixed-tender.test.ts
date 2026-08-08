import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { can } from "../lib/permissions";
import {
  automaticFamilyAllocation,
  automaticInstrumentShares,
  canonicalFamilyHash,
  exactPaise,
  maskedExternalPaymentReference,
  normalizeExternalPaymentReference,
  normalizeFamilyInstruments,
  normalizeFamilyShares,
  normalizeManualFamilyAllocation,
  type FamilyDuePosition,
  type FamilyInstrumentInput
} from "../lib/family-collection-allocation";
import { validateFamilyCollectionBackupRows } from "../lib/family-collection-backup";

const dues: FamilyDuePosition[] = [
  due("FAMPAY1-001", "Aarav", 1, 1_200_000),
  due("FAMPAY1-002", "Diya", 2, 1_200_000),
  due("FAMPAY1-003", "Ishan", 3, 1_200_000),
  due("FAMPAY1-004", "Mira", 4, 1_200_000)
];
const instruments: FamilyInstrumentInput[] = [
  { clientKey: "upi", mode: "UPI", amountPaise: 3_000_000, receivedAccount: "NPS Current Account UPI", reference: "FAMPAY1REF1001" },
  { clientKey: "cash", mode: "CASH", amountPaise: 1_000_000, receivedAccount: "Cash", reference: null }
];

describe("FIN-FAMILY-PAY-1 exact allocation engine", () => {
  it("allocates the governed Rs 40,000 four-child mixed-tender case exactly", () => {
    const plan = automaticFamilyAllocation(dues, instruments);
    expect(plan.allocations.map((row) => row.amountPaise)).toEqual([1_200_000, 1_200_000, 1_200_000, 400_000]);
    expect(plan.shares.reduce((sum, row) => sum + row.amountPaise, 0)).toBe(4_000_000);
    expect(plan.shares.filter((row) => row.allocationKey === "allocation-3")).toEqual([
      { allocationKey: "allocation-3", instrumentKey: "upi", amountPaise: 600_000 },
      { allocationKey: "allocation-3", instrumentKey: "cash", amountPaise: 600_000 }
    ]);
  });

  it("uses a stable oldest-year, term, fee-head, admission ordering", () => {
    expect(automaticFamilyAllocation([dues[3], dues[1], dues[0], dues[2]], instruments)).toEqual(automaticFamilyAllocation(dues, instruments));
  });

  it("accepts a balanced manual plan and rejects duplicate or over-due rows", () => {
    const rows = dues.map((row, index) => ({ clientKey: `a${index}`, admissionNo: row.admissionNo, academicYear: row.academicYear, installment: row.installment, feeHead: row.feeHead, amountPaise: index < 3 ? 1_200_000 : 400_000 }));
    expect(normalizeManualFamilyAllocation(rows, dues, instruments)).toHaveLength(4);
    expect(() => normalizeManualFamilyAllocation([rows[0], { ...rows[0], clientKey: "other" }], dues, [{ ...instruments[0], amountPaise: 2_400_000 }])).toThrow(/Duplicate/);
    expect(() => normalizeManualFamilyAllocation([{ ...rows[0], amountPaise: 1_200_001 }], dues, [{ ...instruments[0], amountPaise: 1_200_001 }])).toThrow(/exceeds/);
  });

  it("refuses overpayment, under-allocation, fractional paise, and unsafe bounds", () => {
    expect(() => automaticFamilyAllocation(dues, [{ ...instruments[0], amountPaise: 4_800_001 }])).toThrow(/Overpayment/);
    expect(() => normalizeManualFamilyAllocation([{ clientKey: "a", admissionNo: dues[0].admissionNo, academicYear: dues[0].academicYear, installment: dues[0].installment, feeHead: "TUITION", amountPaise: 100 }], dues, [{ ...instruments[0], amountPaise: 101 }])).toThrow(/must match exactly/);
    expect(() => exactPaise(10.5)).toThrow(/integer-paise/);
    expect(() => exactPaise(Number.MAX_SAFE_INTEGER)).toThrow(/collection limit/);
  });

  it("normalizes equivalent external references and exposes only a masked suffix", () => {
    const variants = ["abc-1234-xyz", " ABC 1234 XYZ ", "ＡＢＣ－１２３４－ＸＹＺ"];
    expect(new Set(variants.map(normalizeExternalPaymentReference)).size).toBe(1);
    const masked = maskedExternalPaymentReference("UPI", normalizeExternalPaymentReference(variants[0]));
    expect(masked).toBe("UPI [MASKED]4XYZ");
    expect(masked).not.toContain("ABC123");
  });

  it("requires references for non-cash instruments and bounds row counts", () => {
    expect(() => normalizeFamilyInstruments([{ clientKey: "upi", mode: "UPI", amountPaise: 100, receivedAccount: "NPS Current Account UPI" }])).toThrow(/reference/);
    expect(() => normalizeFamilyInstruments(Array.from({ length: 7 }, (_, index) => ({ clientKey: `c${index}`, mode: "CASH", amountPaise: 100, receivedAccount: "Cash" })))).toThrow(/1 to 6/);
  });

  it("reconciles explicit allocation-to-instrument matrices and rejects any missing paise", () => {
    const allocations = automaticFamilyAllocation(dues, instruments).allocations;
    const shares = automaticInstrumentShares(allocations, instruments);
    expect(normalizeFamilyShares(shares, allocations, instruments)).toEqual(shares);
    expect(() => normalizeFamilyShares(shares.slice(0, -1), allocations, instruments)).toThrow(/shares must equal/);
  });

  it("hashes canonical plans independently of object key order", () => {
    expect(canonicalFamilyHash({ b: 2, a: 1 })).toBe(canonicalFamilyHash({ a: 1, b: 2 }));
  });
});

describe("FIN-FAMILY-PAY-1 authorization and compatibility policy", () => {
  it("grants mutation only to Accountant, Director, and Super Admin defaults", () => {
    for (const permission of ["CREATE_FAMILY_COLLECTIONS", "CONFIRM_FAMILY_COLLECTIONS", "ISSUE_FAMILY_RECEIPTS"] as const) {
      for (const role of ["ACCOUNTANT", "DIRECTOR", "SUPER_ADMIN"] as const) expect(can(role, permission)).toBe(true);
      for (const role of ["ADMIN", "PRINCIPAL", "TEACHER", "VIEWER", "PARENT"] as const) expect(can(role, permission)).toBe(false);
    }
    expect(can("VIEWER", "VIEW_FAMILY_COLLECTIONS")).toBe(true);
    expect(can("PARENT", "VIEW_OWN_FAMILY_RECEIPTS")).toBe(true);
  });

  it("requires exact server permissions and private finance responses", () => {
    for (const file of ["app/api/family-collections/preview/route.ts", "app/api/family-collections/confirm/route.ts", "app/api/family-collections/[reference]/workflow/route.ts"]) {
      const value = source(file);
      expect(value).toContain("privateFinanceJson");
      expect(value).not.toMatch(/MANAGE_FINANCE|VIEW_PAYMENTS/);
    }
    expect(source("app/api/family-collections/confirm/route.ts")).toContain('requireApiPermission("CONFIRM_FAMILY_COLLECTIONS")');
    expect(source("app/api/family-collections/[reference]/workflow/route.ts")).toContain('"CANCEL_FINAL_RECEIPT"');
    expect(source("app/api/family-collections/[reference]/workflow/route.ts")).toContain('"CORRECT_FINAL_RECEIPT"');
  });

  it("keeps legacy receipt printing compatible with family receipt references", () => {
    expect(source("app/receipts/[receiptNo]/print/page.tsx")).toContain("/family-collections/");
    expect(source("lib/data.ts")).toContain("new Set(todayPayments.map");
    expect(source("lib/cash-book.ts")).toContain("familyInstrumentId");
  });

  it("uses accessible in-app confirmation and governance dialogs", () => {
    for (const file of ["components/family-collection-wizard.tsx", "components/family-collection-governance-actions.tsx"]) {
      const value = source(file);
      expect(value).toContain('role="dialog"');
      expect(value).toContain('aria-modal="true"');
      expect(value).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
    }
  });
});

describe("FIN-FAMILY-PAY-1 backup validation", () => {
  it("accepts a fully reconciled immutable family graph", () => {
    expect(validateFamilyCollectionBackupRows(backupGraph()).familyCollections).toHaveLength(1);
  });

  it("refuses corrupt totals, orphan shares, invalid JSON, and family credit", () => {
    const corruptTotal = backupGraph(); corruptTotal.familyCollections[0].totalPaise = 999;
    expect(() => validateFamilyCollectionBackupRows(corruptTotal)).toThrow(/does not reconcile/);
    const orphan = backupGraph(); orphan.allocationInstrumentShares[0].allocationId = "missing";
    expect(() => validateFamilyCollectionBackupRows(orphan)).toThrow(/missing/);
    const invalidJson = backupGraph(); invalidJson.familyReceiptVersions[0].snapshotJson = "{";
    expect(() => validateFamilyCollectionBackupRows(invalidJson)).toThrow();
    const credit = backupGraph(); credit.familyCollections[0].creditPaise = 1;
    expect(() => validateFamilyCollectionBackupRows(credit)).toThrow(/credit/);
  });
});

function due(admissionNo: string, studentName: string, orderIndex: number, duePaise: number): FamilyDuePosition {
  return { studentKey: admissionNo, admissionNo, studentName, className: "Class V", section: "A", academicYear: "2026-27", installment: "Term 1", feeHead: "TUITION", orderIndex, duePaise, dueSnapshotHash: canonicalFamilyHash({ admissionNo, duePaise }) };
}

function source(path: string) { return readFileSync(path, "utf8"); }

function backupGraph(): Record<string, Array<Record<string, unknown>>> {
  const stamp = "2026-08-08T10:00:00.000Z";
  return {
    familyCollections: [{ id: "c", publicReference: "FAM-1", totalPaise: 100, creditPaise: 0 }],
    familyCollectionInstruments: [{ id: "i", collectionId: "c", amountPaise: 100 }],
    familyStudentAllocations: [{ id: "a", collectionId: "c", amountPaise: 100 }],
    allocationInstrumentShares: [{ id: "s", allocationId: "a", instrumentId: "i", amountPaise: 100 }],
    familyReceiptVersions: [{ id: "r", collectionId: "c", snapshotJson: "{}", createdAt: stamp }],
    familyCollectionEvents: [{ id: "e", collectionId: "c" }],
    familyProviderAllocationPlans: [{ id: "p", collectionId: "c", snapshotJson: "{}" }]
  };
}
