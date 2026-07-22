"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Permissions = { manage: boolean; submit: boolean; approve: boolean; lock: boolean; cancel: boolean };
type ReasonAction = { kind: "workflow"; action: "reject" | "cancel" } | { kind: "movement"; movementId: string };

export function CashBookCreateForm({ date, academicYear, suggestedOpening, hasPrevious }: { date: string; academicYear: string; suggestedOpening: string; hasPrevious: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <form className="card form-grid" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/cash-book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) return setError(result.error ?? "Unable to create cash day");
    router.push(`/cash-book/${date}`); router.refresh();
  }}>
    {error ? <p className="form-error full-span">{error}</p> : null}
    <label>Cash date<input name="cashDate" type="date" defaultValue={date} required /></label>
    <label>Academic year<input name="academicYear" defaultValue={academicYear} required /></label>
    <label>Opening balance<input name="openingBalance" type="number" min="0" step="0.01" defaultValue={suggestedOpening} required /></label>
    <label className="full-span">Opening note {!hasPrevious ? <strong>(required: no previous locked day)</strong> : null}<textarea name="notes" required={!hasPrevious} placeholder="Document a manual or changed opening balance" /></label>
    <button disabled={busy}>{busy ? "Creating…" : "Create daily cash book"}</button>
  </form>;
}

export function CashBookEditor({ day, permissions }: { day: any; permissions: Permissions }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState("");
  const date = /^\d{4}-\d{2}-\d{2}/.test(String(day.cashDate)) ? String(day.cashDate).slice(0, 10) : new Date(day.cashDate).toISOString().slice(0, 10);

  async function send(url: string, body: unknown, method = "POST") {
    setBusy(true); setError("");
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) { setError(result.error ?? "Unable to save"); return false; }
    router.refresh(); return true;
  }

  function startReasonAction(action: ReasonAction) { setReasonAction(action); setReason(""); setError(""); }
  async function confirmReasonAction() {
    if (!reasonAction || !reason.trim()) { setError("A reason is required before confirmation"); return; }
    const ok = reasonAction.kind === "movement"
      ? await send(`/api/cash-book/${date}/movements/${reasonAction.movementId}/cancel`, { reason: reason.trim() })
      : await send(`/api/cash-book/${date}/workflow`, { action: reasonAction.action, reason: reason.trim() });
    if (ok) { setReasonAction(null); setReason(""); }
  }

  return <div className="content-stack">
    {error ? <p className="form-error">{error}</p> : null}
    {day.sourceDrift ? <div className="alert warning"><strong>Source-drift warning:</strong> authoritative fee, miscellaneous-income, expense, or movement sources now differ from the submitted snapshot. The preserved snapshot has not been rewritten.</div> : null}
    {reasonAction ? <section className="card form-grid" aria-labelledby="cash-reason-title">
      <h3 id="cash-reason-title" className="full-span">Reason confirmation</h3>
      <p className="full-span">This action preserves the original cash-book history and records the reason.</p>
      <label className="full-span">{reasonAction.kind === "movement" ? "Movement cancellation reason" : reasonAction.action === "reject" ? "Rejection reason" : "Cash-day cancellation reason"}<textarea value={reason} onChange={(event) => setReason(event.target.value)} required autoFocus /></label>
      <div className="page-actions full-span"><button type="button" className="button danger" disabled={busy || !reason.trim()} onClick={() => void confirmReasonAction()}>{reasonAction.kind === "workflow" && reasonAction.action === "reject" ? "Confirm rejection" : "Confirm cancellation"}</button><button type="button" className="button secondary" disabled={busy} onClick={() => { setReasonAction(null); setReason(""); }}>Keep record</button></div>
    </section> : null}

    <div className="stats cash-stats">{[["Opening", day.openingBalance], ["Fee cash", day.feeCash], ["Miscellaneous cash", day.miscIncomeCash], ["Book-sale cash", day.bookSalesCash], ["Cash expenses", day.cashExpense], ["Deposited to school current account", day.bankDeposit], ["Handed to Director Sir", day.directorHandover], ["Expected closing", day.calculatedClosingBalance], ["Closing cash retained", day.countedClosingBalance ?? "—"], ["Variance", day.varianceAmount ?? "—"]].map(([label, value]) => <div className="card stat" key={label}><span>{label}</span><strong>{value === "—" ? value : `₹${Number(value).toFixed(2)}`}</strong></div>)}</div>

    {day.status === "DRAFT" && permissions.manage ? <form className="card form-grid" onSubmit={(event) => { event.preventDefault(); void send(`/api/cash-book/${date}`, Object.fromEntries(new FormData(event.currentTarget)), "PATCH"); }}><h3 className="full-span">Count and reconcile</h3><label>Opening balance<input name="openingBalance" type="number" min="0" step="0.01" defaultValue={day.openingBalance} required /></label><label>Counted closing cash<input name="countedClosingBalance" type="number" min="0" step="0.01" defaultValue={day.countedClosingBalance ?? ""} /></label><label className="full-span">Notes / variance explanation<textarea name="notes" defaultValue={day.notes ?? ""} /></label><button disabled={busy}>Save reconciliation</button></form> : null}

    {day.status === "DRAFT" && permissions.manage ? <form className="card form-grid" onSubmit={(event) => { event.preventDefault(); void send(`/api/cash-book/${date}/movements`, Object.fromEntries(new FormData(event.currentTarget))); event.currentTarget.reset(); }}><h3 className="full-span">Record cash movement or disposition</h3><label>Type<select name="movementType">{["MANUAL_INFLOW", "MANUAL_OUTFLOW", "BANK_DEPOSIT", "DIRECTOR_HANDOVER", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"].map((value) => <option value={value} key={value}>{value === "BANK_DEPOSIT" ? "Deposited to school current account" : value === "DIRECTOR_HANDOVER" ? "Handed to Director Sir" : value.replaceAll("_", " ")}</option>)}</select></label><label>Amount<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Date<input name="movementDate" type="date" defaultValue={date} readOnly /></label><label>Reference number<input name="referenceNumber" /></label><label>Bank name<input name="bankName" /></label><label>Recipient name<input name="recipientName" defaultValue="Director Sir" /></label><label className="full-span">Reason<input name="reason" required /></label><label className="full-span">Notes<input name="notes" /></label><button disabled={busy}>Add movement</button></form> : null}

    <section className="card"><h3>Manual movements and dispositions</h3><div className="table-wrap"><table><thead><tr><th>Type</th><th>Amount</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead><tbody>{day.movements.map((movement: any) => <tr key={movement.id}><td>{movement.movementType === "BANK_DEPOSIT" ? "Deposited to school current account" : movement.movementType === "DIRECTOR_HANDOVER" ? "Handed to Director Sir" : movement.movementType.replaceAll("_", " ")}</td><td>₹{Number(movement.amount).toFixed(2)}</td><td>{movement.reason}</td><td>{movement.status}</td><td>{movement.status === "ACTIVE" && day.status === "DRAFT" && permissions.manage ? <button type="button" className="button danger" onClick={() => startReasonAction({ kind: "movement", movementId: movement.id })}>Cancel</button> : "—"}</td></tr>)}</tbody></table></div>{!day.movements.length ? <p className="empty-state">No manual movements. Fee cash, miscellaneous cash, book-sale cash, and cash expenses are calculated from their own modules.</p> : null}</section>

    <div className="card workflow-actions"><h3>Workflow</h3>{day.status === "DRAFT" && permissions.submit ? <button disabled={busy} onClick={() => void send(`/api/cash-book/${date}/workflow`, { action: "submit" })}>Submit cash book</button> : null}{day.status === "SUBMITTED" && permissions.approve ? <><button disabled={busy} onClick={() => void send(`/api/cash-book/${date}/workflow`, { action: "approve" })}>Approve cash book</button><button className="button danger" disabled={busy} onClick={() => startReasonAction({ kind: "workflow", action: "reject" })}>Reject</button></> : null}{day.status === "APPROVED" && permissions.lock ? <button disabled={busy} onClick={() => void send(`/api/cash-book/${date}/workflow`, { action: "lock" })}>Lock cash book</button> : null}{day.status === "REJECTED" && permissions.manage ? <button disabled={busy} onClick={() => void send(`/api/cash-book/${date}/workflow`, { action: "reopen" })}>Return to draft</button> : null}{!["LOCKED", "CANCELLED"].includes(day.status) && permissions.cancel ? <button className="button danger" disabled={busy} onClick={() => startReasonAction({ kind: "workflow", action: "cancel" })}>Cancel cash day</button> : null}{day.status === "LOCKED" ? <p><strong>Locked and immutable.</strong> Corrections require a documented compensating movement on a later cash day.</p> : null}</div>
  </div>;
}
