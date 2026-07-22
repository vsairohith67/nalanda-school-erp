"use client";

import { useState } from "react";

export function PrintButton({
  label = "Print / Save PDF",
  auditUrl,
  auditBody
}: {
  label?: string;
  auditUrl?: string;
  auditBody?: Record<string, unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function print() {
    if (!auditUrl) {
      window.print();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(auditUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auditBody ?? {})
      });
      if (!response.ok) {
        setError("Print access could not be recorded. Try again.");
        return;
      }
      window.print();
    } catch {
      setError("Print access could not be recorded. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" className="no-print" disabled={busy} onClick={print}>
      {busy ? "Preparing print…" : label}
    </button>
    {error ? <span className="field-error" role="alert">{error}</span> : null}
  </>;
}
