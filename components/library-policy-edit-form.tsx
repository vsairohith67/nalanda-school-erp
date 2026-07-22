"use client";

import { useState } from "react";

async function updatePolicy(id: string, body: unknown) {
  const response = await fetch(`/api/library/policies/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Unable to update policy");
}

export function LibraryPolicyEditForm({ policy }: { policy: any }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await updatePolicy(policy.id, Object.fromEntries(new FormData(event.currentTarget)));
      setMessage("Policy updated; existing loan snapshots were not changed.");
      setTimeout(() => location.reload(), 300);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update policy");
    } finally {
      setBusy(false);
    }
  }

  return <details><summary>Edit / inactivate</summary><form className="form-grid" onSubmit={submit}>
    <input type="hidden" name="memberType" value={policy.memberType} />
    <label>Code<input name="policyCode" required defaultValue={policy.policyCode} /></label>
    <label>Name<input name="name" required defaultValue={policy.name} /></label>
    {policy.memberType === "STUDENT" ? <label>Class<input name="className" defaultValue={policy.className ?? ""} /></label> : <label>Staff type<input name="staffType" defaultValue={policy.staffType ?? ""} /></label>}
    <label>Loans<input type="number" min="1" name="maxActiveLoans" required defaultValue={policy.maxActiveLoans} /></label>
    <label>Loan days<input type="number" min="1" name="loanPeriodDays" required defaultValue={policy.loanPeriodDays} /></label>
    <label>Renewals<input type="number" min="0" name="maxRenewals" required defaultValue={policy.maxRenewals} /></label>
    <label>Renewal days<input type="number" min="1" name="renewalPeriodDays" required defaultValue={policy.renewalPeriodDays} /></label>
    <label>Reservation limit<input type="number" min="0" name="reservationLimit" required defaultValue={policy.reservationLimit} /></label>
    <label>Priority<input type="number" min="0" name="priority" required defaultValue={policy.priority} /></label>
    <label>Status<select name="status" defaultValue={policy.status}><option>ACTIVE</option><option>INACTIVE</option></select></label>
    <label>Notes<textarea name="notes" defaultValue={policy.notes ?? ""} /></label>
    <div className="wide page-actions"><button disabled={busy}>Save policy</button><small role="status">{message}</small></div>
  </form></details>;
}
