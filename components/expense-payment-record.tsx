"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import type { ExpensePaymentRecord } from "@/lib/expense-payment-record";

export function ExpensePaymentRecordDraft({ record }: { record: ExpensePaymentRecord }) {
  const [busy, setBusy] = useState(false), [printReady, setPrintReady] = useState(false);
  const [error, setError] = useState("");
  async function printVerified() {
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams({ paymentId: record.paymentId, version: record.version });
      const response = await fetch(`/api/expenses/${encodeURIComponent(record.expenseId)}/payment-record?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || result.record?.version !== record.version) throw new Error(result.error ?? "Refresh and review this payment record before printing");
      flushSync(() => setPrintReady(true));
      window.print();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to verify this payment record"); }
    finally { setPrintReady(false); setBusy(false); }
  }
  return <section className="expense-payment-draft" data-print-ready={printReady ? "true" : "false"}>
    <div className="draft-actions"><Link href={`/expenses/${encodeURIComponent(record.expenseId)}`}>Back to expense</Link>
      <button type="button" className="button primary" disabled={busy} onClick={printVerified}>{busy ? "Verifying…" : "Verify and print draft"}</button>
      <p>Printing checks the current payment and your permission again. It does not record payment or acknowledgement.</p>
      {error ? <p role="alert">{error}</p> : null}</div>
    <p className="print-refusal">Use “Verify and print draft” to print a current authorized record.</p>
    <article className="draft-sheet">
      <header><h1>{record.schoolName}</h1><h2>Payment record and acknowledgement draft</h2>
        <p><strong>DRAFT — NOT AN OFFICIAL RECEIPT</strong></p></header>
      <p>Read-only record of the payment entered below. School approval of official numbering, signoff and acknowledgement is pending. No receiver acknowledgement has been recorded by this document.</p>
      <dl>
        <div><dt>Existing expense reference</dt><dd>{record.expenseReference}</dd></div>
        <div><dt>Existing payment record ID</dt><dd>{record.paymentId}</dd></div>
        <div><dt>Selected payee</dt><dd>{record.payeeName}</dd></div>
        <div><dt>Combined responsibility</dt><dd>{record.purpose}</dd></div>
        <div><dt>Explicit covered interval</dt><dd>{record.coveredInterval}</dd></div>
        <div><dt>Ledger academic year</dt><dd>{record.academicYear}</dd></div>
        <div><dt>Recorded cash amount</dt><dd>INR {record.amount}</dd></div>
        <div><dt>Recorded payment date</dt><dd>{record.paymentDate}</dd></div>
        <div><dt>Recorded expense status</dt><dd>{record.approvalStatus} / {record.paymentStatus}</dd></div>
      </dl>
      <p>This annual responsibility expense is separate from salary and payroll.</p>
      <section className="draft-signatures" aria-label="Blank acknowledgement fields">
        <p>Receiver acknowledgement (blank): __________________________</p>
        <p>Receiver signature (blank): ____________________ Date: __________</p>
        <p>Authorized signoff (blank): ____________________ Date: __________</p>
      </section>
      <footer>Expense snapshot: {record.expenseUpdatedAt}<br />Preview version: {record.version}</footer>
    </article>
    <style>{`
      .expense-payment-draft .draft-actions { margin-bottom: 1.5rem; }
      .expense-payment-draft .draft-actions button { margin-left: 1rem; }
      .expense-payment-draft .draft-sheet { max-width: 760px; margin: auto; padding: 2rem; background: white; color: #111; font-size: 12pt; line-height: 1.5; }
      .expense-payment-draft header { text-align: center; margin-bottom: 1.5rem; }
      .expense-payment-draft h1 { font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-size: 23pt; color: #000; }
      .expense-payment-draft h2 { font-size: 16pt; color: #000; margin-top: .6rem; }
      .expense-payment-draft dl { margin: 1.5rem 0; }
      .expense-payment-draft dl div { display: grid; grid-template-columns: 42% 58%; padding: .45rem 0; break-inside: avoid; }
      .expense-payment-draft dt { font-weight: 600; }
      .expense-payment-draft dd { margin: 0; overflow-wrap: anywhere; }
      .expense-payment-draft .draft-signatures { margin: 2rem 0; line-height: 2; }
      .expense-payment-draft footer { font-size: 9pt; overflow-wrap: anywhere; }
      .expense-payment-draft .print-refusal { display: none; }
      @media print {
        .expense-payment-draft .draft-actions { display: none !important; }
        .expense-payment-draft[data-print-ready="false"] .draft-sheet { display: none !important; }
        .expense-payment-draft[data-print-ready="false"] .print-refusal { display: block !important; }
        .expense-payment-draft .draft-sheet { padding: 0; max-width: none; }
      }
    `}</style>
  </section>;
}
