"use client";

import { useState } from "react";
import { schoolDateKey } from "@/lib/format";

type LoanOption = { id: string; loanNumber: string; dueDate: string; member: { memberCode: string } };
type IncidentOption = { id: string; incidentNumber: string; incidentType: string; member: { memberCode: string } };

async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/library/charges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Request failed");
  return json;
}

function values(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
}

export function ChargeCreateForm({ loans, incidents }: { loans: LoanOption[]; incidents: IncidentOption[] }) {
  const [source, setSource] = useState("loan");
  const [preview, setPreview] = useState<any>(null);
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [message, setMessage] = useState("");

  async function previewCharge(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = values(event.currentTarget);
    try {
      const json = await send({ ...body, action: "preview" });
      setPreview(json.preview);
      setDraft(body);
      setMessage("Review the rule snapshot and suggested amount. Viewing this preview creates no charge.");
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "Unable to preview charge");
    }
  }

  async function confirm() {
    if (!draft) return;
    try {
      const originalAmount = (document.getElementById("charge-confirm-amount") as HTMLInputElement).value;
      const assessmentReason = (document.getElementById("charge-confirm-reason") as HTMLTextAreaElement).value;
      const json = await send({ ...draft, originalAmount, assessmentReason });
      setMessage(`Charge ${json.charge.chargeNumber} created.`);
      setTimeout(() => location.assign(`/library/charges/${json.charge.id}`), 350);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create charge");
    }
  }

  return <>
    <form className="card card-pad form-grid" onSubmit={previewCharge}>
      <label>Assessment source<select value={source} onChange={(event) => setSource(event.target.value)}><option value="loan">Overdue loan</option><option value="incident">Approved incident</option></select></label>
      {source === "loan"
        ? <label className="wide">Overdue loan<select name="loanId" required defaultValue=""><option value="">Select overdue loan</option>{loans.map((loan) => <option key={loan.id} value={loan.id}>{loan.loanNumber} - {loan.member.memberCode} - due {loan.dueDate}</option>)}</select></label>
        : <label className="wide">Approved incident<select name="incidentId" required defaultValue=""><option value="">Select incident</option>{incidents.map((row) => <option key={row.id} value={row.id}>{row.incidentNumber} - {row.incidentType} - {row.member.memberCode}</option>)}</select></label>}
      <label>Assessed date<input name="assessedDate" type="date" defaultValue={schoolDateKey()} /></label>
      <label>Due date<input name="dueDate" type="date" /></label>
      <label>Initial state<select name="status"><option>DRAFT</option><option>PENDING_APPROVAL</option></select></label>
      <button>Preview assessment</button>
      <span className="wide" role="status">{message}</span>
    </form>
    {preview ? <section className="card card-pad">
      <h3>Confirm explicit assessment</h3>
      <dl className="detail-grid">
        <div><dt>Borrower</dt><dd>{preview.borrower}</dd></div>
        <div><dt>Source</dt><dd>{preview.source}</dd></div>
        <div><dt>Due / overdue</dt><dd>{preview.loan.dueDate?.slice(0, 10)} / {preview.overdueDays ?? "Incident"}</dd></div>
        <div><dt>Rule</dt><dd>{preview.rule?.ruleCode ?? "No rule"} ({preview.ruleScope})</dd></div>
        <div><dt>Grace / rate / cap</dt><dd>{preview.rule ? `${preview.rule.graceDays} / ₹${preview.rule.overdueAmountPerDay} / ${preview.rule.maximumOverdueAmount ?? "No cap"}` : "Manual"}</dd></div>
        <div><dt>Suggested amount</dt><dd>{preview.suggestedAmount ? `₹${preview.suggestedAmount}` : "Manual review required"}</dd></div>
      </dl>
      {preview.warning ? <p className="notice">{preview.warning}</p> : null}
      <label>Confirmed amount<input id="charge-confirm-amount" type="number" min="0.01" step="0.01" defaultValue={preview.suggestedAmount ?? ""} /></label>
      <label>Assessment reason<textarea id="charge-confirm-reason" required /></label>
      <button onClick={confirm}>Confirm charge assessment</button>
    </section> : null}
  </>;
}
