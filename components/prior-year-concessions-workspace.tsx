"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { PriorYearCasePreparation } from "./prior-year-case-preparation";
import styles from "./prior-year-concessions-workspace.module.css";

type Input = Record<string, unknown>;
type Case = { id: string; liabilityId: string; status: string; kind: string; requestedAmount: string; approvedAmount: string | null; reason: string; version: number; validFrom: string; validTo: string; liability: { studentId: string; operatingYear: string; sourceYear: string; sourceReferencesJson: string; provenance: string } };
type Preview = { liabilityId: string; status: string; balanceHash?: string; balanceVersion?: number; opening?: string; payments?: string; existingCredits?: string; appliedRelief?: string; reversals?: string; remaining?: string };
type Queue = { liabilities: React.ComponentProps<typeof PriorYearCasePreparation>["liabilities"]; cases: Case[]; previews: Preview[]; history: { id: string; eventType: string; reason: string; amount: string; reversesEventId: string | null }[]; incomeBands?: { id: string; label: string }[]; hasMore?: boolean; selectedCaseId?: string | null; currentYearFees?: { status: string; annual?: string; paid?: string; remaining?: string } };
type Challenge = { request: Input; challengeToken: string; factor: "TOTP" | "WEBAUTHN"; webauthnOptions?: PublicKeyCredentialRequestOptionsJSON };
const privileged = ["VERIFY", "VERIFY_PAYMENT", "APPROVE", "APPLY", "REVERSE", "REVIEW_REVERSAL", "PURGE_INCOME"];
function afterRelief(remaining: string, relief: string) {
  const cents = (value: string) => { if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(); const [whole, fraction = ""] = value.split("."); return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")); };
  try { const after = cents(remaining) - cents(relief); if (after < BigInt(0)) return "Relief exceeds outstanding"; return `INR ${after / BigInt(100)}.${String(after % BigInt(100)).padStart(2, "0")}`; } catch { return "Enter a valid relief amount"; }
}

export function PriorYearConcessionsWorkspace() {
  const [queue, setQueue] = useState<Queue>({ liabilities: [], cases: [], previews: [], history: [] });
  const [selected, setSelected] = useState(""), [page, setPage] = useState(0);
  const [error, setError] = useState(""), [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false), [reason, setReason] = useState(""), [amount, setAmount] = useState("");
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  // Retained only in memory: timeout recovery resends the exact original actor-bound request.
  const [pending, setPending] = useState<Input | null>(null);
  const [income, setIncome] = useState<{ status: string; bandId: string | null; exactAnnualAmount?: string | null } | null>(null);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const dialog = useRef<HTMLDialogElement>(null);
  const current = queue.cases.find((item) => item.id === selected);
  const preview = queue.previews.find((item) => item.liabilityId === current?.liabilityId);
  const locked = busy || !!pending || !!challenge;
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try { const response = await fetch(`/api/prior-year-concessions?page=${page}${selected ? `&id=${encodeURIComponent(selected)}` : ""}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (sequence === refreshSequence.current && selectedRef.current === selected) setQueue(data); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load cases"); }
  }, [selected, page]);
  useEffect(() => { void refresh(); setIncome(null); }, [refresh]);
  useEffect(() => { if (challenge) dialog.current?.showModal(); else dialog.current?.close(); }, [challenge]);

  async function send(request: Input) {
    setPending(request); setBusy(true); setError("");
    try {
      const response = await fetch("/api/prior-year-concessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      const data = await response.json();
      if (!response.ok) { setPending(null); setChallenge(null); throw new Error(data.error); }
      setIncome(null); setSaved(data.eventId ?? ""); setPending(null); setChallenge(null); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "No response received. Recover the original decision before continuing."); } finally { setBusy(false); }
  }
  async function act(input: Input) {
    if (locked) return;
    if (!navigator.onLine) { setError("Previous-year decisions require an online connection. Nothing was queued."); return; }
    const request = { ...input, requestKey: crypto.randomUUID() };
    if (!privileged.includes(String(input.action))) { await send(request); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/step-up/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: `PRIOR_YEAR_${input.action}` }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Verification unavailable");
      setChallenge({ request, challengeToken: data.challengeToken, factor: data.factorType, webauthnOptions: data.webauthnOptions });
    } catch (e) { setError(e instanceof Error ? e.message : "Verification unavailable"); } finally { setBusy(false); }
  }
  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!challenge || busy) return;
    const frozen = challenge; const form = new FormData(event.currentTarget); setBusy(true);
    try {
      const factorResponse = frozen.factor === "WEBAUTHN" && frozen.webauthnOptions ? await startAuthentication({ optionsJSON: frozen.webauthnOptions }) : form.get("code");
      const response = await fetch("/api/auth/step-up/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeToken: frozen.challengeToken, action: `PRIOR_YEAR_${frozen.request.action}`, factor: frozen.factor, response: factorResponse }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Verification failed");
      await send({ ...frozen.request, stepUpToken: data.stepUpToken });
    } catch (e) { setError(e instanceof Error ? e.message : "Verification failed"); } finally { setBusy(false); }
  }
  async function loadIncome(exact = false) {
    if (!current) return; const requestedCase = current.id;
    try { const response = await fetch(`/api/prior-year-concessions/${encodeURIComponent(current.id)}/income${exact ? "?exact=true" : ""}`, { cache: "no-store" }); if (!response.ok) throw new Error("Restricted income access is unavailable for your permissions."); const data = await response.json(); if (selectedRef.current === requestedCase) setIncome(data); } catch (e) { setError(e instanceof Error ? e.message : "Income unavailable"); }
  }
  async function exportCase(includeIncome: boolean) {
    if (!current || locked) return; setBusy(true); setError("");
    try { const response = await fetch("/api/prior-year-concessions/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseIds: [current.id], includeIncome }) }); if (!response.ok) throw new Error("Export requires explicit permissions and a reconciled balance."); const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "previous-year-case-review.csv"; anchor.click(); URL.revokeObjectURL(url); } catch (e) { setError(e instanceof Error ? e.message : "Export unavailable"); } finally { setBusy(false); }
  }
  const caseRequest = (action: string): Input => ({ action, caseId: current?.id, expectedVersion: current?.version, reason, approvedAmount: amount, balanceHash: preview?.balanceHash, balanceVersion: preview?.balanceVersion });
  const actions: Record<string, string[]> = { DRAFT: ["SUBMIT"], RETURNED: ["SUBMIT"], SUBMITTED: ["REVIEW"], UNDER_REVIEW: ["RETURN", "REJECT", "APPROVE"], APPROVED: ["APPLY", "RETURN", "EXPIRE"], APPLIED: ["REVIEW_REVERSAL", "REVERSE"] };
  return <div className={styles.workspace}>
    <nav aria-label="Related finance"><Link href="/misc-income/new">Student item sale</Link><Link href="/payments">Fee collections</Link></nav>
    {error && <div role="alert" className={styles.error}>{error}</div>}
    {saved && <p role="status">Saved event reference: {saved}</p>}
    {pending && <p role="status">A decision may have committed. <button disabled={busy} onClick={() => void send(pending)}>Recover original decision</button></p>}
    <section className="card"><h2>Eligible-case queue</h2><p>Only verified source-year liabilities can progress. Name-only rows and unknown balances require office review.</p>
      {!queue.cases.length ? <p>No prepared cases on this page.</p> : <div className={styles.queue}>{queue.cases.map((item) => <button key={item.id} disabled={locked} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setReason(""); setAmount(""); }}><strong>{item.liability.studentId}</strong><span>{item.liability.sourceYear} · {item.status.replaceAll("_", " ")}</span><span>Requested INR {item.requestedAmount}</span></button>)}</div>}
      <button disabled={locked || page === 0} onClick={() => setPage(page - 1)}>Previous page</button><button disabled={locked || !queue.hasMore} onClick={() => setPage(page + 1)}>Next page</button>
    </section>
    <PriorYearCasePreparation liabilities={queue.liabilities} busy={locked} submit={act} />
    {current && <>
      <section className="card"><h2>Identity and source evidence</h2><dl><dt>Exact Student reference</dt><dd>{current.liability.studentId}</dd><dt>Eligible previous academic year</dt><dd>{current.liability.sourceYear}</dd><dt>Operating academic year</dt><dd>{current.liability.operatingYear}</dd><dt>Liability evidence</dt><dd>{current.liability.provenance}</dd><dt>Fee-head / term references</dt><dd>{current.liability.sourceReferencesJson}</dd></dl></section>
      <div className={styles.financialAreas}><section className="card"><h2>Previous-year outstanding</h2>{preview?.status === "VERIFIED" ? <dl><dt>Opening verified liability</dt><dd>INR {preview.opening}</dd><dt>Recognised payments</dt><dd>INR {preview.payments}</dd><dt>Existing approved credits</dt><dd>INR {preview.existingCredits}</dd><dt>Applied relief / reversals</dt><dd>INR {preview.appliedRelief} / {preview.reversals}</dd><dt>Remaining liability</dt><dd><strong>INR {preview.remaining}</strong></dd><dt>Requested / approved relief</dt><dd>INR {current.requestedAmount} / {current.approvedAmount ?? "0.00"}</dd><dt>Preview after proposed relief</dt><dd>{current.kind === "SPONSORSHIP_PROMISE" || ["APPLIED", "REVERSED"].includes(current.status) ? "No new relief preview for this state" : afterRelief(preview.remaining ?? "0", current.status === "APPROVED" ? current.approvedAmount ?? "0" : amount || current.requestedAmount)}</dd></dl> : <p role="status">Balance requires reconciliation. Approval and application must wait.</p>}</section><section className="card"><h2>Current-year fees</h2><p>{current.liability.operatingYear}</p>{queue.selectedCaseId === current.id && queue.currentYearFees?.status === "EXISTING_LEDGER_UNCHANGED" ? <dl><dt>Annual fees after existing policy</dt><dd>INR {queue.currentYearFees.annual}</dd><dt>Current-year payments</dt><dd>INR {queue.currentYearFees.paid}</dd><dt>Current-year remaining</dt><dd>INR {queue.currentYearFees.remaining}</dd></dl> : <p>Current-year amounts require existing ledger permission and a configured fee structure.</p>}<p>These remain in the existing fee ledger and receive no relief from this case.</p><Link href="/students">Open Student ledger</Link></section></div>
      <section className="card"><h2>Restricted income support</h2><p>Optional. Unknown, not provided and declined do not mean zero income.</p><button onClick={() => void loadIncome()}>View permitted support</button><button onClick={() => void loadIncome(true)}>View separately permitted exact amount</button>{income && <p>{income.status.replaceAll("_", " ")}{income.bandId ? ` · ${income.bandId}` : ""}{income.exactAnnualAmount != null ? ` · Annual INR ${income.exactAnnualAmount}` : ""}</p>}
        {["DRAFT", "RETURNED"].includes(current.status) && <form key={current.id + current.version} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const status = String(form.get("status")); const support = status === "PROVIDED" ? { status, bandId: form.get("bandId") || null, exactAnnualAmount: form.get("exact") || null, period: "ANNUAL", currency: "INR" } : { status }; void act({ action: "INCOME", caseId: current.id, expectedVersion: current.version, reason: "Optional restricted support update", income: support }); }}>
          <label>Income information status<select name="status"><option>UNKNOWN</option><option>NOT_PROVIDED</option><option>DECLINED</option><option>PROVIDED</option></select></label><label>Configured annual household band<select name="bandId"><option value="">No band supplied</option>{queue.incomeBands?.map((band) => <option key={band.id} value={band.id}>{band.label}</option>)}</select></label><label>Optional exact annual household income (INR; separately restricted)<input name="exact" inputMode="decimal" /></label><button disabled={locked}>Save permitted support</button>
        </form>}
      </section>
      <section className="card"><h2>Review and decision</h2><p>{current.kind === "SPONSORSHIP_PROMISE" ? "This promise is not money received. It creates no payment, receipt or waiver." : "Applied relief is a non-cash adjustment against this previous-year liability."}</p><p>{current.reason}</p><label>Decision reason (exclude private income details)<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} required /></label><label>Approved relief amount<input disabled={current.status !== "UNDER_REVIEW"} value={current.status === "APPROVED" ? current.approvedAmount ?? "" : amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /></label><div className={styles.actions}>{(actions[current.status] ?? []).map((action) => <button key={action} disabled={locked || !reason.trim()} onClick={() => void act(caseRequest(action))}>{action === "APPLY" ? "Apply approved relief" : action === "REVERSE" ? "Reverse with compensating entry" : action.replaceAll("_", " ").toLowerCase()}</button>)}</div></section>
      {["DRAFT", "RETURNED"].includes(current.status) && <section className="card"><h2>Amend prepared case</h2><form key={current.id + current.version} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void act({ action: "AMEND", caseId: current.id, expectedVersion: current.version, requestedAmount: form.get("requestedAmount"), validFrom: form.get("validFrom"), validTo: form.get("validTo"), reason: form.get("reason") }); }}><label>Requested relief<input name="requestedAmount" inputMode="decimal" defaultValue={current.requestedAmount} required /></label><label>Valid from<input name="validFrom" type="date" defaultValue={current.validFrom.slice(0, 10)} required /></label><label>Valid through<input name="validTo" type="date" defaultValue={current.validTo.slice(0, 10)} required /></label><label>Revised reason<textarea name="reason" defaultValue={current.reason} required /></label><button disabled={locked}>Save amendment for review</button></form></section>}
      <section className="card"><h2>Preserved history</h2><button disabled={locked} onClick={() => void exportCase(false)}>Export selected case</button><button disabled={locked} onClick={() => void exportCase(true)}>Export with separately permitted income band</button><ol>{(queue.selectedCaseId === current.id ? queue.history : []).map((event) => <li key={event.id}><strong>{event.eventType.replaceAll("_", " ")}</strong> · INR {event.amount}<p>{event.reason}</p><p>Event reference: {event.id}</p>{event.reversesEventId && <p>Linked reversal of {event.reversesEventId}</p>}</li>)}</ol></section>
    </>}
    <dialog ref={dialog} className="security-dialog" aria-labelledby="prior-year-verification" onCancel={(event) => { if (busy || pending) event.preventDefault(); else setChallenge(null); }}>{challenge && <><h2 id="prior-year-verification">Verify this financial decision</h2><p>{String(challenge.request.action)} · Case {String(challenge.request.caseId ?? challenge.request.liabilityId ?? "source proposal")}</p>{error && <p role="alert">{error}</p>}{pending ? <button disabled={busy} onClick={() => void send(pending)}>Recover original decision</button> : <form onSubmit={verify}>{challenge.factor === "WEBAUTHN" ? <p>Use your registered passkey.</p> : <label>Six-digit authenticator code<input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" autoFocus required /></label>}<div className={styles.actions}><button type="button" disabled={busy} onClick={() => setChallenge(null)}>Cancel</button><button disabled={busy}>Verify and continue</button></div></form>}</>}</dialog>
  </div>;
}
