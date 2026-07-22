"use client";

import { useState } from "react";
import { clearNalandaPwaCaches } from "@/lib/pwa-client";

export function ClearOfflineAssetsButton({ onCleared }: { onCleared?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function clear() {
    setBusy(true);
    await clearNalandaPwaCaches();
    await onCleared?.();
    setBusy(false);
    setOpen(false);
    setMessage("Nalanda offline app assets were cleared. Server records and unrelated browser data were not changed.");
  }

  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        Clear Offline App Assets
      </button>
      {message ? <p role="status" aria-live="polite">{message}</p> : null}
      {open ? (
        <div className="confirmation-overlay" role="presentation">
          <section
            className="card confirmation-dialog pwa-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-clear-dialog-title"
            aria-describedby="pwa-clear-dialog-description"
          >
            <h2 id="pwa-clear-dialog-title">Clear Offline App Assets</h2>
            <p id="pwa-clear-dialog-description">
              This clears only versioned Nalanda PWA caches. It does not delete server data, browser passwords, theme preference, or unrelated site data.
            </p>
            <div className="page-actions">
              <button type="button" className="secondary" autoFocus disabled={busy} onClick={() => setOpen(false)}>
                Go Back
              </button>
              <button type="button" disabled={busy} onClick={() => void clear()}>
                {busy ? "Clearing…" : "Clear Offline App Assets"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

