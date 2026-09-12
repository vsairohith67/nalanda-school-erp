"use client";
import { useEffect, useRef, useState } from "react";
import { projectMarksCsv } from "@/lib/marks-import-csv";
import { ImportReviewDialog } from "@/components/import-review-dialog";
import { ImportRowErrors } from "@/components/import-row-errors";
export function MarksImporter({ governedAssignments }: { governedAssignments?: any[] }) {
  const governed = Boolean(governedAssignments);
  const [choices, setChoices] = useState<any[]>(governedAssignments ?? []), [selectedId, setSelectedId] = useState(""), [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<any>(null), [receipt, setReceipt] = useState(""), [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [enabled, setEnabled] = useState(false);
  const actorContext = useRef(""), parser = useRef<Worker | null>(null);
  const epoch = useRef(0), controller = useRef<AbortController | null>(null), input = useRef<HTMLInputElement>(null);
  const selected = choices.find(c => c.id === selectedId);
  const endpoint = governed ? `/api/exam-marks/sheets/${encodeURIComponent(selectedId)}` : "/api/marks/import";
  function reset(clearFile = true) { parser.current?.terminate(); epoch.current++; controller.current?.abort(); setPreview(null); setReceipt(""); setConfirming(false); setBusy(false); if (clearFile) { setCsv(""); if (input.current) input.current.value = ""; } }
  useEffect(() => {
    setEnabled(false); const abort = new AbortController();
    const refresh = async () => { if (governed && !selectedId) return; try { const r = await fetch(endpoint, { cache: "no-store", signal: abort.signal }); if (!r.ok) { if ([401,403].includes(r.status)) reset(); throw new Error(); } const d = await r.json(); if (abort.signal.aborted) return; if (actorContext.current && actorContext.current !== d.actorContext) reset(); actorContext.current = d.actorContext; if (!governed) setChoices(d.choices); setEnabled(Boolean(d.import)); if (!d.import) setConfirming(false); } catch { if (!abort.signal.aborted) { setEnabled(false); setConfirming(false); } } };
    void refresh(); const timer = setInterval(refresh, 30000); window.addEventListener("focus", refresh);
    return () => { parser.current?.terminate(); abort.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); epoch.current++; controller.current?.abort(); };
  }, [endpoint, governed, selectedId]);
  async function call(action: "preview" | "confirm") {
    if (!selected || !csv || busy || (action === "confirm" && !enabled)) return;
    const ticket = epoch.current, abort = new AbortController(); controller.current = abort; setBusy(true); setMessage("");
    try {
      const body = governed ? { action, csv, receipt, model: "GOVERNED_DRAFT" } : { action, csv, receipt, model: "LEGACY_ASSESSMENT", assessmentId: selectedId, academicYear: selected.academicYear };
      const r = await fetch(endpoint, { method: "POST", signal: abort.signal, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json(); if (ticket !== epoch.current) return;
      if (!r.ok) { setConfirming(false); setPreview(null); throw new Error(d.error ?? "Request denied. Refresh your session/context and validate again."); }
      if (action === "preview") { setPreview(d.preview); setReceipt(d.receipt); setEnabled(Boolean(d.import)); setMessage("Server preview only. No marks or batch metadata written. Review expires after 15 minutes."); }
      else { setPreview(null); setConfirming(false); setMessage(governed ? `Draft saved: ${d.result.changed} changed, ${d.result.unchanged} unchanged, version ${d.result.sheetVersion}. Reload the governed grid to reconcile. Submission, moderation and publication remain separate.` : `Legacy draft import returned: ${d.result.created} created, ${d.result.updated} updated, ${d.result.unchanged} unchanged. Reload the assessment to reconcile.`); }
    } catch(e) { if (ticket === epoch.current) setMessage(e instanceof Error ? e.message : "Request failed; reconcile before retry."); }
    finally { if (ticket === epoch.current) setBusy(false); }
  }
  function readGovernedWorkbook(file: File, ticket: number) {
    const worker = new Worker(new URL("../lib/student-source.worker.ts", import.meta.url)); parser.current = worker; setBusy(true);
    const timer = setTimeout(() => { worker.terminate(); if(ticket===epoch.current){setBusy(false);setMessage("Local workbook parse timed out.");} },10000);
    worker.onmessage = ({data}) => { clearTimeout(timer); worker.terminate(); if(ticket!==epoch.current)return;setBusy(false); try { if(data.error)throw new Error(); const text=[data.headers.join(","),...data.rows.map((r:Record<string,string>)=>data.headers.map((h:string)=>`"${String(r[h]).replace(/"/g,'""')}"`).join(","))].join("\r\n");setCsv(projectMarksCsv(text,true));setMessage("Governed workbook exact fields reconstructed locally. No upload yet."); }catch{setMessage("Workbook refused locally. Use the exact safe governed template.");} };
    worker.onerror=()=>{clearTimeout(timer);worker.terminate();if(ticket===epoch.current){setBusy(false);setMessage("Local workbook parser unavailable.");}}; worker.postMessage(file);
  }
  const label = (c: any) => governed ? `${c.academicYear} / ${c.examination.code} / scheme v${c.scheme.versionNumber} / ${c.className}-${c.section} / ${c.paper.name} / ${c.component.name}` : `${c.academicYear} / ${c.examCycle.examCode} / ${c.className}-${c.section} / ${c.subjectName} / ${c.componentName || "Main"}`;
  return <section className="card card-pad" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
    <h3>{governed ? "Governed component draft CSV import" : "Legacy assessment CSV import"}</h3><p>{governed ? "Frozen scheme and eligible assignment. CSV / safe XLSX v1, at most 200 rows. Import saves a draft only. Signed templates expire after 15 minutes; download again if expired." : "Legacy nine-column CSV, at most 2000 rows. Select the exact authorised year, exam, class, section, subject and component."}</p>
    <label>Exact context<select value={selectedId} disabled={busy} onChange={e => { reset(); setSelectedId(e.target.value); }}><option value="">Choose authorised context</option>{choices.map(c => <option key={c.id} value={c.id}>{label(c)}</option>)}</select></label>
    <p role="status">{enabled ? "Preview available / Import available under current authority" : "Import disabled or access unavailable; preview remains subject to server authorisation"}</p>
    {selected ? <><p>Maximum {governed ? selected.component.maximumMarks : String(selected.maxMarks)}; precision {governed ? selected.scheme.markDecimalPlaces : 4} decimal places. States: {governed ? "NOT_ENTERED, " : ""}PRESENT, ABSENT, EXEMPT, NOT_APPLICABLE. Blank and absent are never zero.</p>
      <a className="button secondary" href={governed ? `${endpoint}?format=csv` : `/api/marks/import/template?assessmentId=${encodeURIComponent(selectedId)}&academicYear=${encodeURIComponent(selected.academicYear)}`}>Download selected-context CSV template</a>{governed ? <a className="button secondary" href={`${endpoint}?format=xlsx`}>Download selected-context XLSX template</a> : null}
      <label>{governed ? "Completed CSV / XLSX" : "Completed CSV"}<input ref={input} type="file" accept={governed ? ".csv,.xlsx" : ".csv,text/csv"} disabled={busy} onChange={async e => { const file = e.target.files?.[0]; reset(); if (!file) return; const ticket = epoch.current; if (governed && file.name.toLowerCase().endsWith(".xlsx") && file.size <= 400000) { readGovernedWorkbook(file,ticket); return; } if (file.name.length > 180 || !file.name.toLowerCase().endsWith(".csv") || file.size < 1 || file.size > (governed ? 400000 : 2000000)) { setMessage("Choose a CSV within the displayed limits."); return; } try { const text = projectMarksCsv(await file.text(), governed); if (ticket === epoch.current) { setCsv(text); setMessage("Exact columns validated and reconstructed locally. Server preview is a separate action."); } } catch { if(ticket === epoch.current) setMessage("File refused locally: use the exact model template and limits. No source rows were uploaded."); } }} /></label>
      <button disabled={!csv || busy} onClick={() => call("preview")}>Server validation / preview</button></> : null}
    <button className="secondary" disabled={busy} onClick={() => { reset(); setMessage("Review cleared. A sent request may already have committed; reconcile before retry."); }}>Clear review</button>
    {preview ? <><p>{preview.totalRows} rows · {preview.validRows} valid · {preview.errorRows} errors</p><ImportRowErrors rows={(preview.errors ?? []).map((r: any) => ({ row: r.rowNumber, messages: [r.message] }))} />
      <details><summary>Reviewed marks</summary>{preview.rows.map((r: any, i: number) => <p key={i}>{r.admissionNumber ?? r.studentId}: {r.entryStatus ?? r.entryState} / {r.marksObtained ?? "blank"}</p>)}</details>
      <button disabled={busy || !enabled || preview.errorRows !== 0 || !preview.validRows} onClick={() => setConfirming(true)}>Review and confirm draft import</button></> : null}
    <p role="status">{message}</p>{confirming ? <ImportReviewDialog title="Confirm exact marks draft" busy={busy} onClose={() => setConfirming(false)}><p>Save only the previewed component draft. Current permissions, locks, roster and versions are checked again.</p><button disabled={busy || !enabled} onClick={() => call("confirm")}>Confirm draft import</button></ImportReviewDialog> : null}
  </section>;
}
