"use client";

export const PWA_UNSAFE_ACTIVITY_EVENTS = ["nalanda:upload-active", "nalanda:payment-active", "nalanda:marks-dirty", "nalanda:import-active", "nalanda:release-active", "nalanda:safe-exit-dirty"] as const;

export function hasUnsafeClientWork(documentValue: Document = document) {
  if (documentValue.querySelector('[data-update-blocking="true"], [data-dirty="true"], [aria-busy="true"][data-private-mutation]')) return true;
  for (const form of Array.from(documentValue.forms)) {
    if (form.dataset.updateSafe === "true") continue;
    if (form.dataset.dirty === "true" || form.dataset.uploadActive === "true" || form.dataset.paymentActive === "true" || form.dataset.marksDirty === "true" || form.dataset.importActive === "true") return true;
  }
  return false;
}

export function safeUpdateDeferralKey(releaseId: string) {
  return `nalanda-update-deferred:${releaseId.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 120)}`;
}
