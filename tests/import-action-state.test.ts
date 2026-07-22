import { describe, expect, it } from "vitest";
import {
  canChangeImportInputs,
  IMPORT_ACTION_COMPLETED_MESSAGE,
  isImportActionDisabled
} from "../lib/import-action-state";

describe("import action state", () => {
  it("disables submit actions while a trial or import request is pending", () => {
    expect(isImportActionDisabled({ fileWorking: false, pendingAction: "trial" })).toBe(true);
    expect(isImportActionDisabled({ fileWorking: false, pendingAction: "import" })).toBe(true);
    expect(isImportActionDisabled({ fileWorking: false, pendingAction: null })).toBe(false);
  });

  it("keeps file and mode inputs available during submit actions", () => {
    expect(canChangeImportInputs({ fileWorking: false })).toBe(true);
    expect(canChangeImportInputs({ fileWorking: true })).toBe(false);
  });

  it("uses the sample rerun completion instruction", () => {
    expect(IMPORT_ACTION_COMPLETED_MESSAGE).toBe(
      "This import action has completed. To rerun the same sample, reset sample pilot data first."
    );
  });
});
