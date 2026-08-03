"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Target = { academicYear: string; className: string; section: string; subjectName: string; timetableSubjectId: string };
type Attachment = { publicKey: string; safeDisplayName: string; mediaType: string; byteSize: number; recoveryStatus: string };
type Item = Target & { publicKey: string; itemNumber: string; kind: string; status: string; rowVersion: number; currentVersionNumber: number; versionPublicKey: string | null; title: string | null; instructions: string | null; dueAt: string | null; versionStatus: string | null; attachments: Attachment[]; submissionCounts: Record<string, number> };
type Aggregate = { academicYear: string; className: string; section: string; subjectName: string; eligible: number; submitted: number; returned: number; reviewed: number; completionPercent: number | null; suppressed: boolean };
type Workspace = { mode: "MANAGE" | "AGGREGATE_ONLY"; targets: Target[]; items: Item[]; aggregates: Aggregate[] };
type QueueRow = { publicKey: string; studentLabel: string; rollNo: string | null; status: string; rowVersion: number; versionNumber: number; submittedAt: string | null; textBody: string; attachments: Attachment[]; feedback: Array<{ sequenceNumber: number; type: string; body: string; createdAt: string; actorRole: string }> };

export function ClassworkWorkspace({ initial, permissions }: { initial: Workspace; permissions: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [queue, setQueue] = useState<{ item: Item; submissions: QueueRow[] } | null>(null);
  const [pending, setPending] = useState<{ item: Item; action: "PUBLISH" | "CLOSE" | "ARCHIVE" } | null>(null);
  const canManage = permissions.includes("MANAGE_CLASSWORK"), canPublish = permissions.includes("PUBLISH_CLASSWORK"), canClose = permissions.includes("CLOSE_CLASSWORK"), canReview = permissions.includes("REVIEW_CLASSWORK_SUBMISSIONS");
  const targetByKey = useMemo(() => new Map(initial.targets.map((target) => [targetKey(target), target])), [initial.targets]);

  async function request(url: string, method = "GET", body?: unknown) {
    const response = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "The classwork request failed.");
    return data;
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const data = new FormData(event.currentTarget), target = targetByKey.get(String(data.get("target")));
      if (!target) throw new Error("Choose an authorised class, section, and subject.");
      await request("/api/classwork", "POST", { ...target, kind: data.get("kind"), title: data.get("title"), instructions: data.get("instructions"), dueAt: data.get("dueAt") || null });
      setMessage("Private draft created. Published content will become immutable."); router.refresh();
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>, item: Item) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (!item.versionPublicKey) throw new Error("Reload before uploading.");
      const body = new FormData(event.currentTarget); body.set("versionPublicKey", item.versionPublicKey);
      const response = await fetch("/api/classwork/attachments", { method: "POST", body }); const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      setMessage("Private attachment accepted. Publishing remains blocked until encrypted backup and two restores are verified."); router.refresh();
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }
  async function correction(event: FormEvent<HTMLFormElement>, item: Item) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { const data = new FormData(event.currentTarget); await request(`/api/classwork/${item.publicKey}/correction`, "POST", { expectedVersion: item.rowVersion, title: data.get("title"), instructions: data.get("instructions"), dueAt: data.get("dueAt") || null, correctionReason: data.get("correctionReason") }); setMessage("Correction draft created; the published version remains preserved."); router.refresh(); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }
  async function lifecycle() {
    if (!pending) return; setBusy(true); setError(""); setMessage("");
    try {
      const url = pending.action === "PUBLISH" ? `/api/classwork/${pending.item.publicKey}/publish` : `/api/classwork/${pending.item.publicKey}/lifecycle`;
      const body = pending.action === "PUBLISH" ? { expectedVersion: pending.item.rowVersion, requestKey: crypto.randomUUID().replaceAll("-", "") } : { expectedVersion: pending.item.rowVersion, action: pending.action };
      await request(url, "POST", body); setMessage(pending.action === "PUBLISH" ? "Published to the exact audience with an immutable snapshot." : `${pending.action === "CLOSE" ? "Closed" : "Archived"} and preserved.`); setPending(null); router.refresh();
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }
  async function openQueue(item: Item) { setBusy(true); setError(""); try { setQueue(await request(`/api/classwork/${item.publicKey}/submissions`)); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } }
  async function review(event: FormEvent<HTMLFormElement>, row: QueueRow) {
    event.preventDefault(); setBusy(true); setError("");
    try { const data = new FormData(event.currentTarget); await request(`/api/classwork/submissions/${row.publicKey}/review`, "POST", { expectedVersion: row.rowVersion, action: data.get("action"), body: data.get("body") }); setMessage("Append-only feedback recorded."); if (queue) await openQueue(queue.item); router.refresh(); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  return <div className="classwork-stack">
    {message ? <div className="notice success" role="status">{message}</div> : null}{error ? <div className="notice danger" role="alert">{error}</div> : null}
    {canManage && initial.targets.length ? <form className="card card-pad form-grid classwork-form" onSubmit={create}><h3 className="full">Create a private draft</h3><label className="wide">Authorised audience<select name="target" required defaultValue=""><option value="">Choose exact scope</option>{initial.targets.map((target) => <option key={targetKey(target)} value={targetKey(target)}>{target.academicYear} · {target.className}-{target.section} · {target.subjectName}</option>)}</select></label><label>Type<select name="kind"><option>CLASSWORK</option><option>HOMEWORK</option><option>ASSIGNMENT</option></select></label><label>Due date and time<input name="dueAt" type="datetime-local" /></label><label className="wide">Title<input name="title" required maxLength={180} /></label><label className="wide">Instructions<textarea name="instructions" required rows={5} maxLength={20000} /></label><div className="full page-actions"><button disabled={busy}>Save private draft</button></div></form> : null}
    {initial.mode === "AGGREGATE_ONLY" ? <div className="notice">Viewer access is aggregate-only. Small cohorts are suppressed.</div> : null}
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Audience</th><th>Item</th><th>Status</th><th>Submissions</th><th>Actions</th></tr></thead><tbody>{initial.items.map((item) => <tr key={item.publicKey}><td>{item.className}-{item.section}<br />{item.subjectName}</td><td><strong>{item.title}</strong><br />{item.kind} · v{item.currentVersionNumber}</td><td><span className="badge">{item.status}</span><br />{item.versionStatus}</td><td>{Object.entries(item.submissionCounts).map(([status, count]) => <span key={status} className="classwork-count">{status}: {count}</span>)}</td><td><div className="classwork-row-actions">{canPublish && item.versionStatus === "DRAFT" ? <button type="button" disabled={busy} onClick={() => setPending({ item, action: "PUBLISH" })}>Publish</button> : null}{canClose && item.status === "PUBLISHED" ? <button type="button" className="secondary" disabled={busy} onClick={() => setPending({ item, action: "CLOSE" })}>Close</button> : null}{canClose && ["PUBLISHED", "CLOSED"].includes(item.status) ? <button type="button" className="secondary" disabled={busy} onClick={() => setPending({ item, action: "ARCHIVE" })}>Archive</button> : null}{canReview ? <button type="button" className="secondary" disabled={busy} onClick={() => openQueue(item)}>Submission queue</button> : null}</div></td></tr>)}{!initial.items.length ? <tr><td colSpan={5}>No classwork is available in this authorised scope.</td></tr> : null}</tbody></table></div></section>
    {canManage ? initial.items.filter((item) => item.versionStatus === "DRAFT").map((item) => <section className="card card-pad" key={`draft-${item.publicKey}`}><h3>{item.title} · private version {item.currentVersionNumber}</h3><p>{item.instructions}</p><div className="classwork-attachments">{item.attachments.map((file) => <span className="badge" key={file.publicKey}>{file.safeDisplayName} · {file.recoveryStatus}</span>)}</div><form className="form-grid" onSubmit={(event) => upload(event, item)}><label className="wide">Private PDF, PNG, JPEG or still WebP<input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" /></label><button disabled={busy}>Upload private attachment</button></form>{item.status === "PUBLISHED" ? <form className="form-grid classwork-correction" onSubmit={(event) => correction(event, item)}><h4 className="full">Correct published instructions</h4><label className="wide">Title<input name="title" required defaultValue={item.title ?? ""} /></label><label className="wide">Instructions<textarea name="instructions" required rows={4} defaultValue={item.instructions ?? ""} /></label><label>Due<input type="datetime-local" name="dueAt" defaultValue={localDateTime(item.dueAt)} /></label><label>Correction reason<input name="correctionReason" required /></label><button disabled={busy}>Create correction version</button></form> : null}</section>) : null}
    <AggregateTable rows={initial.aggregates} />
    {queue ? <section className="card card-pad classwork-queue" aria-live="polite"><div className="section-title section-title-plain"><div><h3>Private submission queue</h3><p>{queue.item.itemNumber} · exact-scope Teacher access</p></div><button type="button" className="secondary" onClick={() => setQueue(null)}>Close queue</button></div>{queue.submissions.map((row) => <article className="classwork-submission" key={row.publicKey}><h4>{row.studentLabel} {row.rollNo ? `· ${row.rollNo}` : ""}</h4><p><span className="badge">{row.status}</span> · version {row.versionNumber}</p><p className="preserve-lines">{row.textBody || "Attachment-only submission"}</p>{row.attachments.map((file) => <a className="button secondary" key={file.publicKey} href={`/api/classwork/attachments/${file.publicKey}`} target="_blank" rel="noreferrer">Preview {file.safeDisplayName}</a>)}{row.feedback.map((feedback) => <blockquote key={feedback.sequenceNumber}>{feedback.type}: {feedback.body}</blockquote>)}{["SUBMITTED", "LATE", "RESUBMITTED"].includes(row.status) ? <form className="form-grid" onSubmit={(event) => review(event, row)}><label>Action<select name="action"><option value="COMMENT">Add comment</option><option value="RETURN">Return for revision</option><option value="REVIEW">Mark reviewed</option></select></label><label className="wide">Feedback or return reason<textarea name="body" required rows={3} /></label><button disabled={busy}>Record feedback</button></form> : null}</article>)}{!queue.submissions.length ? <p>No submissions have been made for this item.</p> : null}</section> : null}
    {pending ? <div className="confirmation-overlay" role="presentation"><section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="classwork-confirm-title"><h3 id="classwork-confirm-title">{pending.action === "PUBLISH" ? "Publish immutable instructions" : pending.action === "CLOSE" ? "Close submissions" : "Archive classwork"}</h3><p>{pending.action === "PUBLISH" ? "The exact audience can view this version. Any later correction creates a new version." : "The item and its full history remain preserved."}</p><div className="page-actions"><button type="button" className="secondary" onClick={() => setPending(null)}>Go back</button><button type="button" disabled={busy} onClick={lifecycle}>Confirm {pending.action.toLowerCase()}</button></div></section></div> : null}
  </div>;
}

function AggregateTable({ rows }: { rows: Aggregate[] }) { return <section className="card"><div className="table-wrap"><table><thead><tr><th>Audience</th><th>Subject</th><th>Eligible</th><th>Submitted</th><th>Returned</th><th>Reviewed</th><th>Completion</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.academicYear}-${row.className}-${row.section}-${row.subjectName}-${index}`}><td>{row.academicYear} · {row.className}-{row.section}</td><td>{row.subjectName}</td>{row.suppressed ? <td colSpan={5}>Suppressed: fewer than three eligible Students</td> : <><td>{row.eligible}</td><td>{row.submitted}</td><td>{row.returned}</td><td>{row.reviewed}</td><td>{row.completionPercent}%</td></>}</tr>)}{!rows.length ? <tr><td colSpan={7}>No published classwork aggregates are available.</td></tr> : null}</tbody></table></div></section>; }
function targetKey(target: Target) { return `${target.academicYear}|${target.className}|${target.section}|${target.timetableSubjectId}`; }
function localDateTime(value: string | null) { if (!value) return ""; const date = new Date(value); const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return adjusted.toISOString().slice(0, 16); }
function errorText(cause: unknown) { return cause instanceof Error ? cause.message : "The classwork request failed."; }
