"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Child = { handle: string; name: string; admissionNo: string; className: string; section: string | null };
type CaseRow = { publicKey: string; reference: string; category: string; categoryLabel: string; priority: string; confidentiality: string; subject: string; originalStatement: string; status: string; version: number; receivedAt: string; linkedChildren: Array<{ name: string; className: string; reference: string }>; messages: Array<{ publicKey: string; body: string; authorLabel: string; createdAt: string }>; attachments: Array<{ publicKey: string; name: string; mediaType: string; byteSize: number }>; timeline: Array<{ publicKey: string; type: string; newStatus: string | null; occurredAt: string }>; resolutions: Array<{ publicKey: string; version: number; category: string; summary: string; resolvedAt: string }>; satisfactionSubmitted: boolean };
const CATEGORIES = ["TECHNICAL_LOGIN","ACCOUNT_ACCESS","FEE_OR_RECEIPT","ATTENDANCE","HOMEWORK_OR_CLASSWORK","EXAM_OR_REPORT_CARD","ACADEMIC_SUPPORT","ADMISSION","DATA_CORRECTION","FACILITIES","STAFF_HR","SAFETY_OR_BULLYING","COMPLAINT_AGAINST_STAFF","COMPLAINT_AGAINST_SERVICE","PRIVACY_OR_DATA","SUGGESTION","APPRECIATION","OTHER"];

export function SupportPortal({ parent }: { parent: boolean }) {
  const root = parent ? "/api/parent/support" : "/api/my-support";
  const [requests, setRequests] = useState<CaseRow[]>([]), [children, setChildren] = useState<Child[]>([]), [contextVersion, setContextVersion] = useState<number | null>(null);
  const [selectedKey, setSelectedKey] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const selected = useMemo(() => requests.find((row) => row.publicKey === selectedKey) ?? requests[0] ?? null, [requests, selectedKey]);
  async function load(preferredKey?: string) {
    const [caseResponse, childResponse] = await Promise.all([fetch(root, { cache: "no-store" }), parent ? fetch("/api/auth/child-context", { cache: "no-store" }) : Promise.resolve(null)]);
    const body = await caseResponse.json(); if (!caseResponse.ok) throw new Error(body.error || "Support requests could not be loaded.");
    setRequests(body.requests); if (preferredKey) setSelectedKey(preferredKey); else if (!selectedKey && body.requests[0]) setSelectedKey(body.requests[0].publicKey);
    if (childResponse) { const childBody = await childResponse.json(); if (childResponse.ok) { setChildren(childBody.children ?? []); setContextVersion(childBody.contextVersion ?? null); } }
  }
  useEffect(() => { load().catch((caught) => setError(errorText(caught))); }, []);
  async function send(url: string, body: Record<string, unknown>, success: string) { setBusy(true); setError(""); setMessage(""); try { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), result = await response.json(); if (!response.ok) throw new Error(result.error || "The support action was refused."); setMessage(success); await load(selected?.publicKey); } catch (caught) { setError(errorText(caught)); } finally { setBusy(false); } }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, data = new FormData(form), childHandles = data.getAll("childHandles").map(String), attachment = data.get("attachment"); setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(root, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: data.get("category"), subject: data.get("subject"), description: data.get("description"), childHandles, contextVersion, linkedReceiptReference: data.get("linkedReceiptReference") || null, consent: data.get("consent") === "on", submissionKey: crypto.randomUUID() }) }), body = await response.json();
      if (!response.ok) throw new Error(body.error || "The support request was refused.");
      if (attachment instanceof File && attachment.size > 0) { const upload = new FormData(); upload.set("attachment", attachment); const uploadResponse = await fetch(`${root}/${body.request.publicKey}/attachments`, { method: "POST", body: upload }), uploadBody = await uploadResponse.json(); if (!uploadResponse.ok) throw new Error(uploadBody.error || "The request was created, but its attachment was refused."); }
      form.reset(); setMessage("Support request submitted with an append-only acknowledgment."); await load(body.request.publicKey);
    } catch (caught) { setError(errorText(caught)); } finally { setBusy(false); }
  }
  async function reply(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const form = event.currentTarget, body = String(new FormData(form).get("body") ?? ""); await send(`${root}/${selected.publicKey}/workflow`, { action: "REPLY", body, expectedVersion: selected.version }, "Reply added to the requester-visible timeline."); form.reset(); }
  async function reopen(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const form = event.currentTarget, reason = String(new FormData(form).get("reason") ?? ""); await send(`${root}/${selected.publicKey}/workflow`, { action: "REOPEN", reason, expectedVersion: selected.version }, "The request was reopened for governed review."); form.reset(); }
  async function satisfaction(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const form = event.currentTarget, data = new FormData(form), declined = data.get("declined") === "on"; await send(`${root}/${selected.publicKey}/workflow`, { action: "SATISFACTION", declined, rating: declined ? null : Number(data.get("rating")), issueUnderstood: data.get("issueUnderstood") === "on", responseClear: data.get("responseClear") === "on", issueResolved: data.get("issueResolved") === "on", comment: data.get("comment") || null }, declined ? "Feedback request declined." : "Service-improvement feedback recorded."); form.reset(); }
  async function attach(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const form = event.currentTarget, data = new FormData(form); setBusy(true); setError(""); try { const response = await fetch(`${root}/${selected.publicKey}/attachments`, { method: "POST", body: data }), body = await response.json(); if (!response.ok) throw new Error(body.error || "Attachment refused."); form.reset(); setMessage("Private attachment added."); await load(selected.publicKey); } catch (caught) { setError(errorText(caught)); } finally { setBusy(false); } }
  const downloadRoot = parent ? "/api/parent/support/attachments" : "/api/my-support/attachments";
  return <div className="support-portal-workspace">
    <div className="support-emergency" role="note"><strong>Urgent physical danger or medical emergency?</strong><span>Use the school&apos;s immediate emergency channel. Support tickets do not replace emergency response.</span></div>
    <div className="notice"><strong>{parent ? "Active Parent context" : "Private Staff context"}.</strong> The server revalidates every requester, linked-child and request boundary. Payslip requests remain in the dedicated Payslip Requests module.</div>
    <div className="support-live" role="status" aria-live="polite">{message}</div>{error ? <div className="form-error" role="alert">{error}</div> : null}
    <form className="card form-grid support-new-request" onSubmit={create}>
      <h2 className="wide">New Support Request</h2>
      <label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose category</option>{CATEGORIES.map((category) => <option key={category} value={category}>{label(category)}</option>)}</select></label>
      <label>Subject<input name="subject" minLength={3} maxLength={160} required /></label>
      {parent && children.length ? <fieldset className="wide support-child-picker"><legend>Linked child context (select only where relevant)</legend>{children.map((child) => <label className="checkbox-row" key={child.handle}><input type="checkbox" name="childHandles" value={child.handle} />{child.name} · {child.admissionNo} · {child.className}{child.section ? `-${child.section}` : ""}</label>)}</fieldset> : null}
      {parent ? <label className="wide">Issued receipt reference <span className="muted-text">(fee/receipt requests only; no payment data is changed)</span><input name="linkedReceiptReference" maxLength={80} /></label> : null}
      <label className="wide">Description<textarea name="description" minLength={20} maxLength={6000} required /></label>
      <label className="wide">Optional private attachment (PDF, PNG, JPEG or still WebP; maximum 5 MB)<input name="attachment" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" /></label>
      <label className="wide checkbox-row"><input name="consent" type="checkbox" required /> I have entered only information needed for this request and understand school response targets are policy targets, not legal promises.</label>
      <button className="wide" disabled={busy}>{busy ? "Submitting…" : "Submit Support Request"}</button>
    </form>
    <section className="support-case-section" aria-labelledby="support-history-title"><h2 id="support-history-title">Your support history</h2>
      {!requests.length ? <p className="card card-pad">No submitted support request is available in this active role context.</p> : <div className="support-case-layout"><nav className="card support-case-list" aria-label="Your support requests">{requests.map((row) => <button type="button" key={row.publicKey} className={row.publicKey === selected?.publicKey ? "active" : ""} onClick={() => setSelectedKey(row.publicKey)}><strong>{row.reference}</strong><span>{row.categoryLabel} · {label(row.status)}</span></button>)}</nav>{selected ? <article className="card support-case-detail">
        <header><div><p className="eyebrow">{selected.reference}</p><h3>{selected.subject}</h3></div><span className="badge">{label(selected.status)}</span></header><p>{selected.originalStatement}</p>
        {selected.linkedChildren.length ? <p><strong>Linked child:</strong> {selected.linkedChildren.map((child) => `${child.name} (${child.className})`).join(", ")}</p> : null}
        <div className="support-actions"><button type="button" className="secondary" onClick={() => window.print()}>Print acknowledgment</button></div>
        <h4>Requester-visible messages</h4>{selected.messages.length ? <ol className="support-message-list">{selected.messages.map((item) => <li key={item.publicKey}><strong>{item.authorLabel}</strong><time>{format(item.createdAt)}</time><p>{item.body}</p></li>)}</ol> : <p>No requester-visible response yet.</p>}
        <h4>Status timeline</h4><ol className="timeline-list">{selected.timeline.map((item) => <li key={item.publicKey}><strong>{label(item.type)}</strong><span>{format(item.occurredAt)}</span></li>)}</ol>
        {selected.resolutions.map((item) => <section className="support-resolution" key={item.publicKey}><h4>Resolution v{item.version}</h4><p>{item.summary}</p><small>{label(item.category)} · {format(item.resolvedAt)}</small></section>)}
        {selected.attachments.length ? <ul className="support-attachment-list">{selected.attachments.map((file) => <li key={file.publicKey}><a href={`${downloadRoot}/${file.publicKey}`}>{file.name}</a><span>{Math.ceil(file.byteSize / 1024)} KB</span></li>)}</ul> : null}
        {!terminal(selected.status) ? <><form className="form-stack support-reply-form" onSubmit={reply}><label>Reply to support<textarea name="body" minLength={1} maxLength={6000} required /></label><button disabled={busy}>Add requester-visible reply</button></form><form className="form-stack" onSubmit={attach}><label>Add private attachment<input name="attachment" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required /></label><button disabled={busy}>Upload attachment</button></form></> : null}
        {["RESOLVED","CLOSED"].includes(selected.status) ? <form className="form-stack" onSubmit={reopen}><label>Reason to reopen<textarea name="reason" minLength={10} maxLength={1000} required /></label><button disabled={busy}>Reopen request</button></form> : null}
        {selected.resolutions.length && !selected.satisfactionSubmitted ? <form className="form-stack support-satisfaction" onSubmit={satisfaction}><h4>Optional service feedback</h4><label>Rating 1–5<input name="rating" type="number" min={1} max={5} defaultValue={5} /></label><label className="checkbox-row"><input name="issueUnderstood" type="checkbox" /> The issue was understood</label><label className="checkbox-row"><input name="responseClear" type="checkbox" /> The response was clear</label><label className="checkbox-row"><input name="issueResolved" type="checkbox" /> The issue was resolved</label><label>Optional comment<textarea name="comment" maxLength={1000} /></label><label className="checkbox-row"><input name="declined" type="checkbox" /> Decline feedback</label><button disabled={busy}>Submit feedback</button></form> : null}
      </article> : null}</div>}
    </section>
  </div>;
}

function label(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function format(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
function terminal(status: string) { return ["CLOSED","REJECTED_AS_INVALID","CANCELLED","ARCHIVED"].includes(status); }
function errorText(value: unknown) { return value instanceof Error ? value.message : "The support action failed safely."; }
