export const GO_LIVE_CHECKLIST_ITEMS = [
  ["backupTaken", "Backup taken"],
  ["schoolSettingsVerified", "School settings verified"],
  ["realUsersCreated", "Real users created"],
  ["defaultPasswordsChanged", "Default passwords changed"],
  ["studentMasterImported", "Student Master imported"],
  ["randomStudentsVerified", "10 random students verified"],
  ["paymentTrialCompleted", "Payment import trial completed"],
  ["paymentTotalsMatched", "Payment totals matched with physical register"],
  ["randomPaymentsVerified", "10 random payments verified"],
  ["testReceiptPrinted", "Test receipt printed"],
  ["pendingDuesChecked", "Pending dues checked"],
  ["backupAfterImportTaken", "Backup after import taken"]
] as const;

export type GoLiveChecklistKey = (typeof GO_LIVE_CHECKLIST_ITEMS)[number][0];
export type GoLiveChecklistState = Record<GoLiveChecklistKey, boolean>;

export function defaultGoLiveChecklist(): GoLiveChecklistState {
  return Object.fromEntries(GO_LIVE_CHECKLIST_ITEMS.map(([key]) => [key, false])) as GoLiveChecklistState;
}

export function validateGoLiveChecklist(input: Record<string, unknown>) {
  const result = defaultGoLiveChecklist();
  for (const [key] of GO_LIVE_CHECKLIST_ITEMS) result[key] = input[key] === true;
  return result;
}
