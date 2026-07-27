"use client";

import { useEffect, useRef, useState } from "react";
import { displayDate, money, moneyExact } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import { paymentAuditSummaryFields } from "@/lib/receipt-audit";

type AuditRow = {
  receiptNo: string;
  status: string;
  total: number;
  rowCount: number;
  issues: string;
  version: string | null;
  date: string | null;
  paymentModes: string;
};

type PaymentAuditRow = {
  id: string;
  action: string;
  oldValueJson: string | null;
  newValueJson: string | null;
  changedByName: string;
  reason: string | null;
  createdAt: string;
  payment: { receiptNo: string; studentName: string; admissionNo: string };
};

export function ReceiptAudit({
  audits,
  canCancelReceipts
}: {
  audits: PaymentAuditRow[];
  canCancelReceipts: boolean;
}) {
  const [startReceiptNo, setStart] = useState("12500");
  const [endReceiptNo, setEnd] = useState("12520");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [pendingCancellation, setPendingCancellation] = useState<AuditRow | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [busy, setBusy] = useState(false);
  const cancelTrigger = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!pendingCancellation || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    (focusable()[0] ?? dialog).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPendingCancellation(null);
        setCancellationReason("");
      } else if (event.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    dialog.addEventListener("keydown", keydown);
    return () => {
      dialog.removeEventListener("keydown", keydown);
      cancelTrigger.current?.focus();
    };
  }, [pendingCancellation]);

  async function load(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/receipt-audit?startReceiptNo=${startReceiptNo}&endReceiptNo=${endReceiptNo}`);
    const json = await response.json();
    if (!response.ok) {
      setMessageType("error");
      setMessage(json.error);
      return;
    }
    setRows(json);
    setMessage("");
  }

  async function cancelReceipt() {
    if (!pendingCancellation) return;
    setBusy(true);
    const response = await fetch("/api/receipt-audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        receiptNo: pendingCancellation.receiptNo,
        reason: cancellationReason,
        expectedVersion: pendingCancellation.version
      })
    });
    const json = await response.json();
    setBusy(false);
    if (!response.ok) {
      setMessageType("error");
      setMessage(json.error || "Unable to cancel receipt");
      return;
    }
    setMessageType("success");
    setMessage(`Receipt ${json.receiptNo} and all ${json.componentCount} component(s) are cancelled.`);
    setRows((current) => current.map((row) => row.receiptNo === json.receiptNo
      ? { ...row, status: "Cancelled", total: 0, issues: "All payment rows cancelled", version: json.version }
      : row));
    setPendingCancellation(null);
    setCancellationReason("");
  }

  return (
    <div className="grid">
      <form className="card card-pad filters" onSubmit={load}>
        <label>Start Receipt No<input value={startReceiptNo} onChange={(e) => setStart(e.target.value)} /></label>
        <label>End Receipt No<input value={endReceiptNo} onChange={(e) => setEnd(e.target.value)} /></label>
        <button>Audit Range</button>
      </form>
      {message ? <div className={messageType === "error" ? "error" : "notice"} role="status">{message}</div> : null}
      <section className="card">
        <div className="section-title"><h3>Audit Output</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Receipt</th><th>Status</th><th>Total</th><th>Rows</th><th>Issues</th><th>Action</th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.receiptNo}><td>{row.receiptNo}</td><td><StatusBadge status={row.status} /></td><td>{money(row.total)}</td><td>{row.rowCount}</td><td>{row.issues || "-"}</td><td>{canCancelReceipts && row.rowCount > 0 && row.status !== "Cancelled" ? <button type="button" className="danger" onClick={(event) => { cancelTrigger.current = event.currentTarget; setMessage(""); setPendingCancellation(row); }}>Cancel receipt</button> : "-"}</td></tr>)}
              {!rows.length ? <tr><td colSpan={6}>Choose a receipt range and run the audit.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {pendingCancellation ? (
        <div className="confirmation-overlay" role="presentation">
          <section ref={dialogRef} className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-cancel-title" aria-describedby="receipt-cancel-description" tabIndex={-1}>
            <h3 id="receipt-cancel-title">Cancel receipt {pendingCancellation.receiptNo}?</h3>
            <p id="receipt-cancel-description">Every component will be cancelled transactionally. Dues reopen; Daily Collection and Cash Book exclude the cancelled amount. The receipt and append-only audit history remain preserved.</p>
            <dl className="receipt-confirmation-facts"><div><dt>Receipt</dt><dd>{pendingCancellation.receiptNo}</dd></div><div><dt>Amount</dt><dd>{moneyExact(pendingCancellation.total)}</dd></div><div><dt>Date</dt><dd>{pendingCancellation.date ? displayDate(pendingCancellation.date) : "Not available"}</dd></div><div><dt>Payment modes</dt><dd>{pendingCancellation.paymentModes || "Not available"}</dd></div></dl>
            <p><strong>This action is neither deletion nor refund. An Accountant action notifies every active Director and Super Admin.</strong></p>
            <label htmlFor="audit-cancellation-reason">Cancellation reason (required)</label>
            <textarea id="audit-cancellation-reason" autoFocus required rows={3} minLength={3} maxLength={500} value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} />
            <div className="page-actions">
              <button type="button" className="secondary" disabled={busy} onClick={() => { setPendingCancellation(null); setCancellationReason(""); }}>Go Back</button>
              <button type="button" className="danger" disabled={busy || cancellationReason.trim().length < 3} onClick={cancelReceipt}>{busy ? "Cancelling safely..." : "Cancel entire receipt"}</button>
            </div>
          </section>
        </div>
      ) : null}
      <section className="card">
        <div className="section-title"><h3>Payment Audit History</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Receipt</th><th>Student</th><th>Action</th><th>Changed By</th><th>Reason</th><th>Old</th><th>New</th></tr></thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id}>
                  <td>{audit.createdAt.replace("T", " ").slice(0, 19)}</td>
                  <td>{audit.payment.receiptNo}</td>
                  <td>{audit.payment.studentName} ({audit.payment.admissionNo})</td>
                  <td>{audit.action}</td>
                  <td>{audit.changedByName}</td>
                  <td>{audit.reason || "-"}</td>
                  <td><AuditDetails audit={audit} value={audit.oldValueJson} /></td>
                  <td><AuditDetails audit={audit} value={audit.newValueJson} /></td>
                </tr>
              ))}
              {!audits.length ? <tr><td colSpan={8}>No payment audit history found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AuditDetails({ audit, value }: { audit: PaymentAuditRow; value: string | null }) {
  if (!value) return <>-</>;
  let formatted = value;
  try {
    formatted = JSON.stringify(JSON.parse(value), null, 2);
  } catch {}
  const summaryFields = paymentAuditSummaryFields(value, {
    action: audit.action,
    changedByName: audit.changedByName,
    reason: audit.reason
  });
  return (
    <div className="audit-detail-summary">
      <div className="audit-summary-grid">
        {summaryFields.map((field) => (
          <div key={field.label}>
            <span>{field.label}</span>
            <strong>{field.value}</strong>
          </div>
        ))}
      </div>
      <details className="advanced-raw-details">
        <summary>Advanced / Raw details</summary>
        <pre>{formatted}</pre>
      </details>
    </div>
  );
}
