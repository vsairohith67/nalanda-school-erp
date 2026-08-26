import { describe, expect, it } from "vitest";
import { stateForServerOutcome, syncGuidance, validateDraft } from "./domain";

describe("native draft domain", () => {
  it("creates only bounded local drafts", () => {
    const draft = validateDraft({ type: "FEE_PAYMENT", summary: "  April fee  ", amount: "1250.50" });
    expect(draft.summary).toBe("April fee");
    expect(draft.amountPaise).toBe(125050);
    expect(draft.state).toBe("DRAFT_SAVED_LOCALLY");
  });

  it("rejects unsupported and invalid writes", () => {
    expect(() => validateDraft({ type: "STUDENT_DELETE", summary: "Delete", amount: "1" })).toThrow("allowed");
    expect(() => validateDraft({ type: "EXPENSE_DRAFT", summary: "x", amount: "0" })).toThrow();
  });

  it("never describes conflicts as auto-merged", () => {
    expect(syncGuidance("CONFLICT")).toContain("Nothing was overwritten");
    expect(syncGuidance("SERVER_UNAVAILABLE")).toContain("encrypted draft is safe");
  });

  it("maps authoritative outcomes without inventing an offline receipt", () => {
    expect(stateForServerOutcome("ACCEPTED")).toBe("SYNCED");
    expect(stateForServerOutcome("CONFLICT", "DEVICE_NO_LONGER_ACTIVE")).toBe("DEVICE_REVOKED");
    expect(stateForServerOutcome("CONFLICT", "REFERENCE_PACK_HARD_EXPIRED")).toBe("REFERENCE_EXPIRED");
    expect(stateForServerOutcome("RETRY_LATER")).toBe("SERVER_UNAVAILABLE");
    expect(syncGuidance("SYNCED")).not.toMatch(/paid|receipt issued/i);
  });
});
