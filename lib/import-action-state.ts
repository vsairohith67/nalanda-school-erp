export type ImportSubmitAction = "trial" | "import";

export const IMPORT_ACTION_COMPLETED_MESSAGE =
  "This import action has completed. To rerun the same sample, reset sample pilot data first.";

export function isImportActionDisabled(input: {
  fileWorking: boolean;
  pendingAction: ImportSubmitAction | null;
  baseDisabled?: boolean;
}) {
  return input.fileWorking || Boolean(input.pendingAction) || Boolean(input.baseDisabled);
}

export function canChangeImportInputs(input: { fileWorking: boolean }) {
  return !input.fileWorking;
}
