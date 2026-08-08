"use client";

import Link from "next/link";
import { useState } from "react";

export function FamilyCollectionGovernanceActions({ reference, version, canReverse, canCorrect, status }: { reference: string; version: number; canReverse: boolean; canCorrect: boolean; status: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (status !== "ISSUED") return <p className="notice">Issued history is immutable. This collection is {status.replaceAll("_", " ")}.</p>;

  async function reverse() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/family-collections/${encodeURIComponent(reference)}/workflow`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "REVERSE", expectedVersion: version, reason }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Reversal failed");
      setOpen(false); setMessage("Collection reversed atomically. Refresh to review the preserved receipt history.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reversal failed"); }
    finally { setBusy(false); }
  }

  return <section className="card card-pad"><h2>Governed correction / reversal</h2><p role="status" aria-live="polite">{message || "Original instruments, allocations, receipt versions and events are never overwritten."}</p><div className="family-actions">{canCorrect ? <Link className="button secondary" href={`/family-collections/new?corrects=${encodeURIComponent(reference)}&version=${version}`}>Create replacement correction</Link> : null}{canReverse ? <button type="button" onClick={() => setOpen(true)}>Reverse full collection</button> : null}</div>{open ? <div className="modal-backdrop"><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="family-reverse-title" aria-describedby="family-reverse-description"><h2 id="family-reverse-title">Reverse full family collection</h2><p id="family-reverse-description">All child allocations, compatibility Ledger rows, Cash Book and non-cash effects will compensate once. The original receipt remains visible.</p><label>Reversal reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={500} required /></label><div className="family-actions"><button type="button" className="secondary" onClick={() => setOpen(false)} disabled={busy}>Return</button><button type="button" onClick={reverse} disabled={busy || reason.trim().length < 3}>{busy ? "Reversing…" : "Confirm full reversal"}</button></div></div></div> : null}</section>;
}
