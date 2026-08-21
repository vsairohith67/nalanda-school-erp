"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Administration = {
  candidates: Array<{ handle: string; name: string; username: string; designation: string | null; roles: string[]; guardianLinked: boolean }>;
  scopes: Array<{ key: string; kind: "LEGACY_ASSESSMENT" | "GOVERNED_COMPONENT"; targetId: string; label: string }>;
  delegations: Array<{ assignmentHandle: string; userName: string; username: string; profile: string; scopeKey: string; scope: { kind: string; academicYear: string; className: string; section: string; subjectName: string; componentName: string }; reason: string; validUntil: string | null; grantedAt: string }>;
};

export function MarksDelegationManager({ initial }: { initial: Administration }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingRevocation, setPendingRevocation] = useState<Administration["delegations"][number] | null>(null);
  const [revocationReason, setRevocationReason] = useState("Operational marks-entry delegation revoked");

  async function request(method: "POST" | "PATCH", body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/marks/delegations", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to change marks delegation");
      setMessage(method === "POST" ? "Exact marks-entry scope granted. Existing sessions were revoked." : "Exact marks-entry scope revoked. Existing sessions were revoked.");
      if (method === "PATCH") setPendingRevocation(null);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to change marks delegation"); }
    finally { setBusy(false); }
  }

  return <div className="iam-workspace marks-delegation-page">
    {message ? <div className="notice" role="status" aria-live="polite">{message}</div> : null}
    <section className="card card-pad">
      <h2>Grant exact marks-entry scope</h2>
      <p className="muted-text">The base Viewer and Computer Operator roles remain read-only. This named profile grant is separately scoped and audited.</p>
      <form className="form-grid" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const selected = initial.scopes.find((scope) => scope.key === form.get("scopeKey")); if (!selected) return; void request("POST", { userHandle: form.get("userHandle"), kind: selected.kind, targetId: selected.targetId, validUntil: form.get("validUntil"), reason: form.get("reason") }); }}>
        <label>Named non-teaching user<select name="userHandle" required defaultValue=""><option value="" disabled>Select operator</option>{initial.candidates.map((candidate) => <option key={candidate.handle} value={candidate.handle}>{candidate.name} · {candidate.roles.join(" + ")}{candidate.guardianLinked ? " · Guardian-linked" : ""}</option>)}</select></label>
        <label>Exact examination scope<select name="scopeKey" required defaultValue=""><option value="" disabled>Select exam, class, section, paper and component</option>{initial.scopes.map((scope) => <option key={scope.key} value={scope.key}>{scope.label} · {scope.kind === "GOVERNED_COMPONENT" ? "Governed" : "Legacy"}</option>)}</select></label>
        <label>Expiry (optional)<input name="validUntil" type="datetime-local" /></label>
        <label className="full">Bounded reason<textarea name="reason" minLength={8} maxLength={500} required /></label>
        <div className="full page-actions"><button type="submit" disabled={busy || !initial.candidates.length || !initial.scopes.length}>{busy ? "Applying…" : "Grant exact scope"}</button></div>
      </form>
    </section>
    <section className="card">
      <div className="card-pad"><h2>Active delegated scopes</h2><p>Revocation invalidates active sessions immediately. A user must sign in again before any further authorisation decision.</p></div>
      <div className="table-wrap"><table><thead><tr><th>Operator</th><th>Scope</th><th>Profile / expiry</th><th>Reason</th><th>Revoke</th></tr></thead><tbody>
        {initial.delegations.map((delegation) => <tr key={`${delegation.assignmentHandle}:${delegation.scopeKey}`}><td><strong>{delegation.userName}</strong><br /><small>{delegation.username}</small></td><td>{delegation.scope.academicYear} · {delegation.scope.className}-{delegation.scope.section || "Class-wide"}<br /><small>{delegation.scope.subjectName} · {delegation.scope.componentName || "Main"}</small></td><td>{delegation.profile}<br /><small>{delegation.validUntil ? `Until ${new Date(delegation.validUntil).toLocaleString("en-IN")}` : "No expiry configured"}</small></td><td>{delegation.reason}</td><td><button type="button" className="danger" disabled={busy} onClick={() => { setPendingRevocation(delegation); setRevocationReason("Operational marks-entry delegation revoked"); }}>Revoke</button></td></tr>)}
        {!initial.delegations.length ? <tr><td colSpan={5}>No active marks-entry delegation exists.</td></tr> : null}
      </tbody></table></div>
    </section>
    {pendingRevocation ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="marks-revoke-title"><h3 id="marks-revoke-title">Revoke exact marks-entry scope?</h3><p><strong>{pendingRevocation.userName}</strong> will lose this exact scope and active sessions will be invalidated.</p><label>Revocation reason<textarea autoFocus required minLength={8} maxLength={500} value={revocationReason} onChange={(event) => setRevocationReason(event.target.value)} /></label><div className="page-actions"><button type="button" className="secondary" disabled={busy} onClick={() => setPendingRevocation(null)}>Go Back</button><button type="button" className="danger" disabled={busy || revocationReason.trim().length < 8} onClick={() => void request("PATCH", { assignmentHandle: pendingRevocation.assignmentHandle, scopeKey: pendingRevocation.scopeKey, reason: revocationReason })}>{busy ? "Revoking…" : "Revoke scope"}</button></div></section></div> : null}
  </div>;
}
