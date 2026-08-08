"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

export function StaffPayslipRequestPortal() {
  const [data, setData] = useState<any>(null), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [months, setMonths] = useState<string[]>([]), [purpose, setPurpose] = useState(""), [explanation, setExplanation] = useState(""), [requiredByDate, setRequiredByDate] = useState("");
  const [cancelTarget, setCancelTarget] = useState<any>(null), [cancelReason, setCancelReason] = useState("");
  const [passwordTarget, setPasswordTarget] = useState<any>(null), [reauthPassword, setReauthPassword] = useState(""), [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  async function load() {
    setError("");
    try { const response = await fetch("/api/my-payslip-requests", { cache: "no-store" }), body = await response.json(); if (!response.ok) throw new Error(body.error || "Payslip requests could not be loaded."); setData(body); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Payslip requests could not be loaded."); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!passwordTarget && !cancelTarget) return;
    dialogRef.current?.focus();
    function keydown(event: KeyboardEvent) { if (event.key === "Escape") closeDialogs(); }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [passwordTarget, cancelTarget]);
  useEffect(() => { if (!revealedPassword) return; const timer = window.setTimeout(() => setRevealedPassword(null), 60_000); return () => window.clearTimeout(timer); }, [revealedPassword]);

  function closeDialogs() { setPasswordTarget(null); setCancelTarget(null); setReauthPassword(""); setRevealedPassword(null); setCancelReason(""); }
  function toggleMonth(month: string) { setMonths((current) => current.includes(month) ? current.filter((value) => value !== month) : [...current, month]); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try {
      const response = await fetch("/api/my-payslip-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionKey: crypto.randomUUID(), months, purpose, explanation, requiredByDate }) }), body = await response.json();
      if (!response.ok) throw new Error(body.error || "The payslip request was refused.");
      setMonths([]); setPurpose(""); setExplanation(""); setRequiredByDate(""); setMessage("Payslip request submitted for authorised review."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The payslip request was refused."); }
  }

  async function cancelRequest(event: FormEvent) {
    event.preventDefault(); if (!cancelTarget) return;
    try { const response = await fetch(`/api/my-payslip-requests/${cancelTarget.key}/workflow`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: cancelTarget.version, reason: cancelReason }) }), body = await response.json(); if (!response.ok) throw new Error(body.error || "Cancellation was refused."); closeDialogs(); setMessage("The request was cancelled and retained in your audit timeline."); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Cancellation was refused."); }
  }

  async function revealPassword(event: FormEvent) {
    event.preventDefault(); if (!passwordTarget) return;
    setRevealedPassword(null);
    try { const response = await fetch(`/api/my-payslip-requests/documents/${passwordTarget.key}/password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reauthPassword }) }), body = await response.json(); if (!response.ok) throw new Error(body.error || "Password reveal was refused."); setReauthPassword(""); setRevealedPassword(body.password); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Password reveal was refused."); }
  }

  if (error && !data) return <div className="form-error" role="alert">{error}</div>;
  if (!data) return <p>Loading your private payslip requests…</p>;
  return <div className="payslip-request-workspace">
    <div className="callout"><strong>Private Staff context.</strong> Parent context exposes no payslip request navigation or data. Issued files are {data.policy}.</div>
    <div role="status" aria-live="polite">{message}</div>{error ? <div className="form-error" role="alert">{error}</div> : null}
    <form className="card form-stack" onSubmit={submit}>
      <h2>Request payslip records</h2>
      <fieldset><legend>Available months</legend><div className="month-choice-grid">{data.availableMonths.length ? data.availableMonths.map((month: any) => <label className="choice-control" key={month.month}><input type="checkbox" checked={months.includes(month.month)} onChange={() => toggleMonth(month.month)}/><span>{month.label}<small>{month.status === "ALREADY_ISSUED" ? "Existing issued record" : "Historical record available"}</small></span></label>) : <p>No governed record months are currently available.</p>}</div></fieldset>
      <label>Purpose<select value={purpose} onChange={(event) => setPurpose(event.target.value)} required><option value="">Choose purpose</option>{data.purposes.map((item: any) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>{purpose === "OTHER" ? "Explanation (required)" : "Explanation (optional)"}<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} minLength={purpose === "OTHER" ? 5 : undefined} maxLength={500} required={purpose === "OTHER"}/></label>
      <label>Required by (optional)<input type="date" value={requiredByDate} onChange={(event) => setRequiredByDate(event.target.value)}/></label>
      <button className="button primary" disabled={!months.length || !purpose}>Submit request</button>
    </form>
    <section><h2>Your request timeline</h2><div className="payslip-request-grid">{data.requests.map((request: any) => <article className="card" key={request.key}>
      <div className="card-heading-row"><div><h3>{request.number}</h3><p>{request.purpose} · {request.statusLabel}</p></div>{request.mayCancel ? <button className="button" onClick={() => setCancelTarget(request)}>Cancel request</button> : null}</div>
      <p>{request.months.map((month: any) => month.label).join(", ")}</p>{request.requiredByDate ? <p>Required by {request.requiredByDate}</p> : null}
      <ol className="timeline-list">{request.timeline.map((event: any) => <li key={event.key}><strong>{event.status || event.type}</strong><span>{new Date(event.at).toLocaleString("en-IN")}</span>{event.reason ? <p>{event.reason}</p> : null}</li>)}</ol>
      {request.documents.map((document: any) => <div className="protected-document" key={document.key}><h4>Protected document v{document.version}</h4><p>{document.months.join(", ")} · {document.pageCount} page(s)</p><p className="field-hint">Verification: {document.verificationReference}</p><div className="action-row"><a className="button primary" href={document.downloadUrl}>Download protected PDF</a><button className="button" onClick={() => { setPasswordTarget(document); setRevealedPassword(null); }}>Reveal opening password</button></div></div>)}
      {request.accessHistory.length ? <details><summary>Private access history</summary><ul>{request.accessHistory.map((item: any, index: number) => <li key={`${item.at}-${index}`}>{item.type} · {new Date(item.at).toLocaleString("en-IN")}</li>)}</ul></details> : null}
    </article>)}</div></section>
    {cancelTarget ? <div className="dialog-backdrop"><div className="security-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-title" tabIndex={-1} ref={dialogRef}><form className="form-stack" onSubmit={cancelRequest}><h2 id="cancel-title">Cancel payslip request</h2><p>The request remains in the audit history.</p><label>Reason<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} minLength={3} maxLength={300} required/></label><div className="action-row"><button className="button danger">Cancel request</button><button type="button" className="button" onClick={closeDialogs}>Keep request</button></div></form></div></div> : null}
    {passwordTarget ? <div className="dialog-backdrop"><div className="security-dialog" role="dialog" aria-modal="true" aria-labelledby="password-title" tabIndex={-1} ref={dialogRef}><form className="form-stack" onSubmit={revealPassword}><h2 id="password-title">Reveal PDF opening password</h2><p>Re-enter your current account password. The PDF password clears after 60 seconds or when this dialog closes.</p>{revealedPassword ? <output className="revealed-secret" aria-live="polite"><span>Opening password</span><strong>{revealedPassword}</strong></output> : <label>Current account password<input type="password" autoComplete="current-password" value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} required autoFocus/></label>}<div className="action-row">{!revealedPassword ? <button className="button primary">Reveal password</button> : null}<button type="button" className="button" onClick={closeDialogs}>Close and clear</button></div></form></div></div> : null}
  </div>;
}
