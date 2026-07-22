import { describe, expect, it } from "vitest";
import {
  buildPilotEvidenceSummary,
  calculatePilotReconciliationTotals,
  canViewPilotAcceptance,
  comparePilotReconciliationTotals,
  emptyPilotAcceptanceState,
  parsePilotAcceptanceState,
  PILOT_ACCEPTANCE_NOTE_MAX_LENGTH,
  pilotAcceptanceItemId,
  samplePilotDateWarning,
  samplePilotReconciliationSuccessMessage
} from "../lib/pilot-acceptance";
import {
  PILOT_SAMPLE_DATE,
  PILOT_SAMPLE_EXPECTED_TOTALS
} from "../lib/pilot-sample-constants";

describe("pilot acceptance", () => {
  it("keeps access limited to Director and Admin", () => {
    expect(canViewPilotAcceptance("DIRECTOR")).toBe(true);
    expect(canViewPilotAcceptance("ADMIN")).toBe(true);
    expect(canViewPilotAcceptance("ACCOUNTANT")).toBe(false);
    expect(canViewPilotAcceptance("VIEWER")).toBe(false);
  });

  it("loads only known checklist keys and browser notes", () => {
    const key = pilotAcceptanceItemId("ui", 0);
    const parsed = parsePilotAcceptanceState(JSON.stringify({
      completed: { [key]: true, "unknown:99": true },
      notes: { ui: "Checked at 10:30", unknown: "ignored" }
    }));
    expect(parsed.completed[key]).toBe(true);
    expect(parsed.completed["unknown:99"]).toBeUndefined();
    expect(parsed.notes.ui).toBe("Checked at 10:30");
    expect(parsePilotAcceptanceState("not-json")).toEqual(emptyPilotAcceptanceState());
  });

  it("bounds browser-only notes so local storage cannot grow without limit", () => {
    const parsed = parsePilotAcceptanceState(JSON.stringify({
      notes: { ui: "Q".repeat(PILOT_ACCEPTANCE_NOTE_MAX_LENGTH + 100) }
    }));
    expect(parsed.notes.ui).toHaveLength(PILOT_ACCEPTANCE_NOTE_MAX_LENGTH);
  });

  it("groups active payments by the pilot reconciliation account mapping", () => {
    expect(calculatePilotReconciliationTotals([
      { amountPaid: 1000, paymentMode: "Cash", receivedAccount: "Cash" },
      { amountPaid: 2000, paymentMode: "UPI", receivedAccount: "Director Sir GPay" },
      { amountPaid: 3000, paymentMode: "UPI", receivedAccount: "NPS Current Account UPI" },
      { amountPaid: 4000, paymentMode: "Bank Transfer", receivedAccount: "NPS Bank Account" },
      { amountPaid: 500, paymentMode: "Cheque", receivedAccount: "Other" },
      { amountPaid: 700, paymentMode: "Other", receivedAccount: "Legacy Account" },
      { amountPaid: 9000, paymentMode: "Cash", receivedAccount: "Cash", isCancelled: true },
      { amountPaid: 9000, paymentMode: "Cash", receivedAccount: "Cash", deletedAt: new Date() }
    ])).toEqual({
      cash: 1000,
      directorGPay: 2000,
      npsCurrentAccountUpi: 3000,
      bankOther: 5200,
      grandTotal: 11200
    });
  });

  it("calculates actual minus expected differences", () => {
    const comparison = comparePilotReconciliationTotals(
      { cash: 900, directorGPay: 2000, npsCurrentAccountUpi: 3100, bankOther: 5000, grandTotal: 11000 },
      { cash: 1000, directorGPay: 2000, npsCurrentAccountUpi: 3000, bankOther: 5200, grandTotal: 11200 }
    );
    expect(comparison.map((row) => [row.key, row.difference])).toEqual([
      ["cash", 100],
      ["directorGPay", 0],
      ["npsCurrentAccountUpi", -100],
      ["bankOther", 200],
      ["grandTotal", 200]
    ]);
  });

  it("exposes the sample preset values used by Pilot Acceptance", () => {
    expect(PILOT_SAMPLE_DATE).toBe("2026-06-20");
    expect(PILOT_SAMPLE_EXPECTED_TOTALS).toEqual({
      cash: 60000,
      directorGPay: 30300,
      npsCurrentAccountUpi: 11300,
      bankOther: 0,
      grandTotal: 101600
    });
  });

  it("formats the sample reconciliation success message only for the matching sample day", () => {
    const message = samplePilotReconciliationSuccessMessage({
      from: PILOT_SAMPLE_DATE,
      to: PILOT_SAMPLE_DATE,
      expected: PILOT_SAMPLE_EXPECTED_TOTALS,
      actual: PILOT_SAMPLE_EXPECTED_TOTALS
    });

    expect(message).toContain("Sample pilot reconciliation matched on 20-06-2026.");
    expect(message).toContain("Cash");
    expect(message).toContain("60,000");
    expect(samplePilotReconciliationSuccessMessage({
      from: "2026-06-24",
      to: "2026-06-24",
      expected: PILOT_SAMPLE_EXPECTED_TOTALS,
      actual: PILOT_SAMPLE_EXPECTED_TOTALS
    })).toBe("");
  });

  it("warns when sample evidence uses the wrong date range", () => {
    expect(samplePilotDateWarning({
      sampleModeDetected: true,
      from: "2026-06-24",
      to: "2026-06-24"
    })).toBe("For sample evidence, use 20-06-2026 to 20-06-2026.");
    expect(samplePilotDateWarning({
      sampleModeDetected: false,
      from: "2026-06-24",
      to: "2026-06-24"
    })).toBe("");
  });

  it("builds an evidence summary without leaking password or hash values from notes", () => {
    const state = emptyPilotAcceptanceState();
    state.completed[pilotAcceptanceItemId("imports", 0)] = true;
    state.notes.imports = "Checked sample imports. password: rohith-secret; passwordHash: abc123";

    const summary = buildPilotEvidenceSummary({
      generatedAt: new Date("2026-06-24T12:00:00.000Z"),
      currentUserName: "Rohith",
      currentUserRole: "DIRECTOR",
      databaseMode: "PILOT",
      from: PILOT_SAMPLE_DATE,
      to: PILOT_SAMPLE_DATE,
      expected: PILOT_SAMPLE_EXPECTED_TOTALS,
      actual: PILOT_SAMPLE_EXPECTED_TOTALS,
      acceptanceState: state,
      recentSampleImportBatches: [{
        id: "batch-1",
        type: "PAYMENTS",
        fileName: "sample-payments.csv",
        importedByName: "Rohith",
        importedAt: "2026-06-24T11:30:00.000Z",
        mode: "import-valid",
        status: "COMPLETED",
        totalRows: 6,
        createdCount: 5,
        updatedCount: 0,
        skippedCount: 0,
        errorCount: 1,
        warningCount: 0
      }]
    });

    const rendered = JSON.stringify(summary);
    expect(summary.resultLabel).toBe("Matched");
    expect(summary.checklistCompleted).toBe(1);
    expect(summary.safetyNote).toContain("no password or hash values");
    expect(rendered).not.toContain("rohith-secret");
    expect(rendered).not.toContain("abc123");
  });
});
