"use client";

import { useState } from "react";
import { money } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import { paymentAuditSummaryFields } from "@/lib/receipt-audit";

type AuditRow = {
  receiptNo: string;
  status: string;
  total: number;
  rowCount: number;
  issues: string;
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
  canManageReceipts
}: {
  audits: PaymentAuditRow[];
  canManageReceipts: boolean;
}) {
  const [startReceiptNo, setStart] = useState("12500");
  const [endReceiptNo, setEnd] = useState("12520");
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

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

  async function cancelReceipt(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    const response = await fetch("/api/receipt-audit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!response.ok) {
      setMessageType("error");
      setMessage(json.error || "Unable to mark receipt cancelled");
      return;
    }
    (event.currentTarget as HTMLFormElement).reset();
    setMessageType("success");
    setMessage(`Receipt ${json.receiptNo} marked cancelled.`);
  }

  return (
    <div className="grid">
      <form className="card card-pad filters" onSubmit={load}>
        <label>Start Receipt No<input value={startReceiptNo} onChange={(e) => setStart(e.target.value)} /></label>
        <label>End Receipt No<input value={endReceiptNo} onChange={(e) => setEnd(e.target.value)} /></label>
        <button>Audit Range</button>
      </form>
      {canManageReceipts ? (
        <form className="card card-pad filters" onSubmit={cancelReceipt}>
          <label>Cancelled Receipt No<input name="receiptNo" required /></label>
          <label>Remarks<input name="remarks" /></label>
          <input type="hidden" name="status" value="Cancelled" />
          <button className="secondary">Mark Cancelled</button>
        </form>
      ) : null}
      {message ? <div className={messageType === "error" ? "error" : "notice"} role="status">{message}</div> : null}
      <section className="card">
        <div className="section-title"><h3>Audit Output</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Receipt</th><th>Status</th><th>Total</th><th>Rows</th><th>Issues</th></tr></thead>
            <tbody>
              {rows.map((row) => <tr key={row.receiptNo}><td>{row.receiptNo}</td><td><StatusBadge status={row.status} /></td><td>{money(row.total)}</td><td>{row.rowCount}</td><td>{row.issues || "—"}</td></tr>)}
              {!rows.length ? <tr><td colSpan={5}>Choose a receipt range and run the audit.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
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
