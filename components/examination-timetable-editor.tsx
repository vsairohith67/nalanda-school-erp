"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Paper = { id: string; label: string; subject: string; paperCode: string; paperName: string };
type DraftRow = { subjectPaperId: string; examDate: string; startTime: string; endTime: string; reportingTime: string; venue: string; parentInstructions: string; displayOrder: number };
type Timetable = { id: string; examinationId: string; classScopeId: string; versionNumber: number; version: number; status: string; replacesVersionId: string | null; parentInstructions: string | null; examination: { name: string; examCode: string; startDate: string; endDate: string }; cohort: string; rows: DraftRow[] };

export function ExaminationTimetableEditor({ timetable, papers, initialValidation, canManage, canPublish }: { timetable: Timetable; papers: Paper[]; initialValidation: { valid: boolean; issues: string[]; rowCount: number }; canManage: boolean; canPublish: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<DraftRow[]>(timetable.rows);
  const [instructions, setInstructions] = useState(timetable.parentInstructions ?? "");
  const [validation, setValidation] = useState(initialValidation);
  const [pending, setPending] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [replacementReason, setReplacementReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editable = canManage && timetable.status === "DRAFT";
  const paperMap = useMemo(() => new Map(papers.map((paper) => [paper.id, paper])), [papers]);

  function update(index: number, key: keyof DraftRow, value: string | number) { setRows((current) => current.map((row, position) => position === index ? { ...row, [key]: value } : row)); }
  function addRow() { const used = new Set(rows.map((row) => row.subjectPaperId)); const paper = papers.find((item) => !used.has(item.id)); if (!paper) return; setRows((current) => [...current, { subjectPaperId: paper.id, examDate: timetable.examination.startDate, startTime: "09:00", endTime: "12:00", reportingTime: "08:30", venue: "", parentInstructions: "", displayOrder: current.length + 1 }]); }
  function removeRow(index: number) { setRows((current) => current.filter((_, position) => position !== index).map((row, position) => ({ ...row, displayOrder: position + 1 }))); }

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/exam-timetables/${encodeURIComponent(timetable.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedVersion: timetable.version, parentInstructions: instructions, rows }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Unable to save timetable draft");
      setMessage("Timetable draft saved."); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save timetable draft"); }
    finally { setBusy(false); }
  }

  async function validate() {
    setBusy(true); setError("");
    try { const response = await fetch(`/api/exam-timetables/${encodeURIComponent(timetable.id)}/validation`, { cache: "no-store" }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? "Unable to validate timetable"); setValidation(data.validation); setMessage(data.validation.valid ? "Conflict validation passed." : "Resolve the listed conflicts."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to validate timetable"); }
    finally { setBusy(false); }
  }

  async function workflow() {
    if (!pending) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/exam-timetables/${encodeURIComponent(timetable.id)}/workflow`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: pending, expectedVersion: timetable.version, reason, replacementReason }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { if (Array.isArray(data.issues)) setValidation({ valid: false, issues: data.issues, rowCount: rows.length }); throw new Error(data.error ?? "Unable to update timetable"); }
      setPending(null); setReason(""); setReplacementReason(""); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update timetable"); }
    finally { setBusy(false); }
  }

  async function createReplacement() {
    setBusy(true); setError("");
    try { const response = await fetch("/api/exam-timetables", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ examinationId: timetable.examinationId, classScopeId: timetable.classScopeId, sourceVersionId: timetable.id, idempotencyKey: crypto.randomUUID() }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? "Unable to create replacement"); router.push(`/exams/timetable/${encodeURIComponent(data.timetable.id)}`); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create replacement"); }
    finally { setBusy(false); }
  }

  return <div className="exam-timetable-workspace">
    <section className="card card-pad"><div className="section-title section-title-plain"><div><h2>Parent-facing instructions</h2><p>Bounded instructions shared across this exact cohort version.</p></div></div><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={2000} rows={4} disabled={!editable} aria-label="Parent-facing timetable instructions" /></section>
    <section className="card"><div className="section-title"><div><h2>Subject and paper schedule</h2><p>{timetable.cohort} · Version {timetable.versionNumber}</p></div>{editable ? <button type="button" className="secondary" onClick={addRow} disabled={rows.length >= papers.length}>Add Paper</button> : null}</div>
      <div className="exam-timetable-row-list">{rows.map((row, index) => { const paper = paperMap.get(row.subjectPaperId); return <fieldset key={`${row.subjectPaperId}-${index}`} className="card card-pad exam-timetable-row"><legend>Paper {index + 1}</legend><label>Subject / paper<select value={row.subjectPaperId} onChange={(event) => update(index, "subjectPaperId", event.target.value)} disabled={!editable}>{papers.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Exam date<input type="date" min={timetable.examination.startDate} max={timetable.examination.endDate} value={row.examDate} onChange={(event) => update(index, "examDate", event.target.value)} disabled={!editable} /></label><label>Start time<input type="time" value={row.startTime} onChange={(event) => update(index, "startTime", event.target.value)} disabled={!editable} /></label><label>End time<input type="time" value={row.endTime} onChange={(event) => update(index, "endTime", event.target.value)} disabled={!editable} /></label><label>Reporting time<input type="time" value={row.reportingTime} onChange={(event) => update(index, "reportingTime", event.target.value)} disabled={!editable} /></label><label>Venue<input value={row.venue} onChange={(event) => update(index, "venue", event.target.value)} maxLength={160} disabled={!editable} /></label><label className="wide">Parent instructions<textarea value={row.parentInstructions} onChange={(event) => update(index, "parentInstructions", event.target.value)} maxLength={500} disabled={!editable} /></label><p className="wide muted-text">Preview: {paper?.subject ?? "Subject"} · {paper?.paperName ?? "Paper"} · {row.examDate} · {row.startTime}–{row.endTime}</p>{editable ? <button type="button" className="danger" onClick={() => removeRow(index)}>Remove Paper</button> : null}</fieldset>; })}{!rows.length ? <div className="empty-state card-pad">No timetable rows yet.</div> : null}</div>
    </section>
    <section className={`card card-pad exam-conflict-summary ${validation.valid ? "valid" : "invalid"}`} aria-live="polite"><h2>Conflict and completeness summary</h2>{validation.valid ? <p>All current conflict and completeness checks pass for {validation.rowCount} row(s).</p> : <ul>{validation.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}<button type="button" className="secondary" onClick={validate} disabled={busy}>Refresh Validation</button></section>
    <section className="card card-pad"><h2>Parent preview</h2><p><strong>{timetable.examination.name}</strong> · {timetable.cohort}</p>{instructions ? <p className="notice">{instructions}</p> : null}<div className="table-wrap"><table><thead><tr><th>Date</th><th>Subject / paper</th><th>Time</th><th>Reporting</th><th>Venue</th></tr></thead><tbody>{rows.map((row) => { const paper = paperMap.get(row.subjectPaperId); return <tr key={`${row.displayOrder}-${row.subjectPaperId}`}><td>{row.examDate}</td><td>{paper?.subject}<br />{paper?.paperName}</td><td>{row.startTime}–{row.endTime}</td><td>{row.reportingTime || "Not configured"}</td><td>{row.venue || "Not configured"}</td></tr>; })}</tbody></table></div></section>
    <section className="card card-pad workflow-actions"><h2>Workflow</h2><div className="page-actions">{editable ? <><button type="button" className="secondary" onClick={save} disabled={busy}>Save Draft</button><button type="button" onClick={() => setPending("ready")} disabled={busy}>Mark Ready</button><button type="button" className="danger" onClick={() => setPending("archive")} disabled={busy}>Archive Draft</button></> : null}{canManage && timetable.status === "READY_FOR_PUBLICATION" ? <button type="button" className="secondary" onClick={() => setPending("return_to_draft")} disabled={busy}>Return to Draft</button> : null}{canPublish && timetable.status === "READY_FOR_PUBLICATION" ? <button type="button" onClick={() => setPending("publish")} disabled={busy}>Publish Timetable</button> : null}{canPublish && timetable.status === "PUBLISHED" ? <><button type="button" onClick={createReplacement} disabled={busy}>Create Replacement</button><button type="button" className="danger" onClick={() => setPending("withdraw")} disabled={busy}>Withdraw</button></> : null}{canPublish && ["WITHDRAWN", "REPLACED"].includes(timetable.status) ? <button type="button" className="danger" onClick={() => setPending("archive")} disabled={busy}>Archive History Version</button> : null}</div>{message ? <p className="notice success" role="status">{message}</p> : null}{error ? <p className="error" role="alert">{error}</p> : null}</section>
    {pending ? <div className="dialog-backdrop" role="presentation"><section className="dialog-card exam-timetable-dialog" role="dialog" aria-modal="true" aria-labelledby="exam-timetable-dialog-title"><h2 id="exam-timetable-dialog-title">{actionLabel(pending)}</h2><p>This governed action is version-checked and preserves publication history.</p>{pending !== "ready" ? <label>Reason<textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} /></label> : null}{pending === "publish" && timetable.replacesVersionId ? <label>Replacement reason<textarea value={replacementReason} onChange={(event) => setReplacementReason(event.target.value)} maxLength={1000} /></label> : null}<div className="page-actions"><button type="button" className="secondary" onClick={() => setPending(null)} disabled={busy}>Go Back</button><button type="button" onClick={workflow} disabled={busy || (pending !== "ready" && reason.trim().length < 12) || (pending === "publish" && Boolean(timetable.replacesVersionId) && replacementReason.trim().length < 12)}>{busy ? "Working…" : actionLabel(pending)}</button></div></section></div> : null}
  </div>;
}

function actionLabel(action: string) { return ({ ready: "Mark Ready", return_to_draft: "Return to Draft", publish: "Publish Timetable", withdraw: "Withdraw Timetable", archive: "Archive Timetable" } as Record<string, string>)[action] ?? "Confirm Action"; }
