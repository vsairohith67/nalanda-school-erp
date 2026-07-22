"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function MiscReceiptActions({ id, canCancel, status }: { id: string; canCancel: boolean; status: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function cancel() {
    const cleanReason = reason.trim();
    if (!cleanReason) return setError("Enter a cancellation reason. The receipt will be preserved.");
    setSaving(true); setError("");
    const response = await fetch(`/api/misc-income/${id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: cleanReason }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) return setError(body.error ?? "Unable to cancel receipt");
    router.refresh();
  }
  return <div className="page-actions">
    <a className="button secondary" href={`/misc-income/${id}/print`} target="_blank">Print receipt</a>
    {canCancel && status === "ACTIVE" ? <>{showCancel ? <div className="inline-confirm"><label>Cancellation reason<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} autoFocus /></label><button className="button danger" type="button" disabled={saving} onClick={() => void cancel()}>{saving ? "Cancelling…" : "Confirm cancellation"}</button><button className="button secondary" type="button" disabled={saving} onClick={() => { setShowCancel(false); setReason(""); setError(""); }}>Keep receipt</button></div> : <button className="button danger" type="button" onClick={() => setShowCancel(true)}>Cancel receipt</button>}</> : null}
    {error ? <span className="form-error">{error}</span> : null}
  </div>;
}
