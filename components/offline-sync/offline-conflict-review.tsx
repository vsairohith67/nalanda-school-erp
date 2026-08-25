"use client";

import { useCallback, useEffect, useState } from "react";

type Conflict = { id: string; clientMutationId: string; operationType: string; conflictCode: string; receivedServerAt: string; device: { label: string }; actor: { name: string }; conflictReviews: Array<{ resolutionStatus: string; reviewedAt: string }> };
type Resolution = "ACKNOWLEDGED" | "DRAFT_REVISED" | "DISCARDED";

export function OfflineConflictReview() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [selected, setSelected] = useState<Conflict | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<Resolution>("ACKNOWLEDGED");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/offline-sync/conflicts", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Unable to load conflicts.");
    setConflicts(result.conflicts);
  }, []);
  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load conflicts.")); }, [load]);

  async function review() {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/offline-sync/conflicts/${selected.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolutionStatus, resolutionNote: note }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Conflict review failed.");
      setMessage("Conflict review recorded. The system did not force-apply or rewrite the original draft.");
      setSelected(null); setNote(""); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Conflict review failed."); }
    finally { setBusy(false); }
  }

  return <main className="page"><header className="page-header"><div><p className="eyebrow">Leadership review</p><h1>Offline synchronization conflicts</h1><p>Review safe conflict metadata. Encrypted local payloads and sensitive reference-pack content are not exposed here.</p></div></header>{message ? <div className="notice" role="status">{message}</div> : null}<section className="card"><div className="table-wrap"><table><thead><tr><th>Operation</th><th>Safe code</th><th>Accountant</th><th>Device</th><th>Received</th><th>Review</th></tr></thead><tbody>{conflicts.map((row) => <tr key={row.id}><td>{row.operationType.replaceAll("_", " ")}</td><td>{row.conflictCode}</td><td>{row.actor.name}</td><td>{row.device.label}</td><td>{new Date(row.receivedServerAt).toLocaleString()}</td><td>{row.conflictReviews[0] ? row.conflictReviews[0].resolutionStatus : <button disabled={busy} onClick={() => setSelected(row)}>Review conflict</button>}</td></tr>)}</tbody></table></div>{!conflicts.length ? <p>No unresolved synchronization conflicts.</p> : null}</section>{selected ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="offline-conflict-review-title"><h2 id="offline-conflict-review-title">Record conflict review</h2><p>{selected.operationType.replaceAll("_", " ")} · {selected.conflictCode}. This records a decision only; it never force-applies an outdated draft.</p><label>Resolution<select value={resolutionStatus} onChange={(event) => setResolutionStatus(event.target.value as Resolution)}><option value="ACKNOWLEDGED">Acknowledged</option><option value="DRAFT_REVISED">Draft revised</option><option value="DISCARDED">Discarded</option></select></label><label>Governance note<textarea autoFocus minLength={8} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="page-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setSelected(null)}>Go back</button><button type="button" disabled={busy || note.trim().length < 8} onClick={() => void review()}>{busy ? "Recording…" : "Record review"}</button></div></section></div> : null}</main>;
}
