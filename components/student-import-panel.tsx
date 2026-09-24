"use client";
import { useEffect, useRef, useState } from "react";
import { normalizeStudentImportRows, type StudentImportPreview, type StudentImportMode } from "@/lib/student-import";
import { projectStudentRows, suggestedStudentMapping, STUDENT_IMPORT_FIELDS, STUDENT_MAPPING_VERSION, type StudentMapping } from "@/lib/student-import-contract";
import { CONTROLLED_SOURCE_FIELDS } from "@/lib/onboarding-source-package";
import { ImportRowErrors } from "@/components/import-row-errors";
export function StudentImportPanel() {
  const [workflow, setWorkflow] = useState("legacy");
  const [source, setSource] = useState<Record<string, unknown>[]>([]), [mapping, setMapping] = useState<StudentMapping>({});
  const [preview, setPreview] = useState<StudentImportPreview | null>(null), [payload, setPayload] = useState<Record<string, string>[]>([]);
  const [mode, setMode] = useState<StudentImportMode>("skip"), [capability, setCapability] = useState<any>(null), [year, setYear] = useState("");
  const [classChoices, setClassChoices] = useState<Record<string, string>>({}), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [approved, setApproved] = useState(false), [serverPreview, setServerPreview] = useState(false), [result, setResult] = useState<any>(null);
  const receipt = useRef(""), actorContext = useRef("");
  const generation = useRef(0), worker = useRef<Worker | null>(null), request = useRef<AbortController | null>(null), fileInput = useRef<HTMLInputElement>(null);
  function invalidate() { receipt.current = ""; generation.current++; request.current?.abort(); worker.current?.terminate(); worker.current = null; setPreview(null); setPayload([]); setApproved(false); setServerPreview(false); setResult(null); setBusy(false); }
  function reset() { invalidate(); setSource([]); setMapping({}); setClassChoices({}); if (fileInput.current) fileInput.current.value = ""; setMessage("Review cleared. Check saved batches if a request had already been sent."); }
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => fetch("/api/import/students", { signal: controller.signal, cache: "no-store" }).then(async r => { if (!r.ok) { if ([401,403].includes(r.status)) reset(); throw new Error(); } return r.json(); }).then(c => { if (actorContext.current && actorContext.current !== c.actorContext) reset(); actorContext.current = c.actorContext; setCapability(c); if (!c.import) setApproved(false); }).catch(() => { if (!controller.signal.aborted) { setCapability(null); setApproved(false); } });
    void refresh(); const timer = setInterval(refresh, 30000); window.addEventListener("focus", refresh);
    return () => { generation.current++; controller.abort(); request.current?.abort(); worker.current?.terminate(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; reset(); if (!file) return;
    const ticket = generation.current; setBusy(true); setMessage("Parsing locally. No source data has been sent.");
    const parser = new Worker(new URL("../lib/student-source.worker.ts", import.meta.url)); worker.current = parser;
    const timer = setTimeout(() => { parser.terminate(); if (generation.current === ticket) { setBusy(false); setMessage("Local parsing timed out. Split the source and retry."); } }, 10000);
    parser.onmessage = ({ data }) => { clearTimeout(timer); parser.terminate(); if (generation.current !== ticket) return; setBusy(false); if (data.error) return setMessage(data.error); setSource(data.rows); const suggested = suggestedStudentMapping(data.headers); if (workflow === "controlled") for (const h of Object.keys(suggested)) if (!(CONTROLLED_SOURCE_FIELDS as readonly string[]).includes(suggested[h])) suggested[h] = ""; setMapping(suggested); setMessage("Review the mapping before validation. Excluded values remain in this session only."); };
    parser.onerror = () => { clearTimeout(timer); parser.terminate(); if (generation.current === ticket) { setBusy(false); setMessage("Local parser unavailable. Cancel and retry."); } }; parser.postMessage(file);
  }
  const classes = (capability?.classes ?? []) as { academicYear: string; className: string; section: string }[];
  const classHeader = Object.keys(mapping).find(k => mapping[k] === "className");
  const sectionHeader = Object.keys(mapping).find(k => mapping[k] === "section");
  const sourceClasses = [...new Set(source.map(r => JSON.stringify([String(classHeader ? r[classHeader] ?? "" : "").trim(), String(sectionHeader ? r[sectionHeader] ?? "" : "").trim()])))];
  function localValidate() {
    invalidate(); try {
      if (!year) throw new Error("Select the academic year explicitly.");
      const clean = projectStudentRows(source, mapping);
      for (const row of clean) {
        if (row.academicYear && row.academicYear !== year) throw new Error("Source academic year conflicts with the selected year.");
        row.academicYear = year;
        const selected = classChoices[JSON.stringify([(row.className ?? "").trim(), (row.section ?? "").trim()])];
        const options = classes.filter(c => c.academicYear === year && c.className === row.className && c.section === (row.section ?? ""));
        const target = selected ? classes.find(c => JSON.stringify(c) === selected && c.academicYear === year) : options.length === 1 ? options[0] : null;
        if (!target) throw new Error("Resolve each source class/section against an allowed reference before validation.");
        row.className = target.className; row.section = target.section;
      }
      if (workflow === "controlled" && clean.some(r => !r.fatherName || !r.phone1)) throw new Error("Controlled onboarding requires father name and phone. Missing contacts block conversion.");
      setPayload(clean); setPreview(normalizeStudentImportRows(clean)); setMessage("Local validation only: no server request or write. Contact omissions remain legacy warnings.");
    } catch(e) { setMessage(e instanceof Error ? e.message : "Local validation failed."); }
  }
  async function call(action: "preview" | "dry-run" | "import") {
    if (!payload.length || busy || (action !== "preview" && (!serverPreview || !capability?.import))) return;
    const ticket = generation.current, controller = new AbortController(); request.current = controller; setBusy(true); setApproved(false);
    try {
      const response = await fetch("/api/import/students", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ action, rows: payload, mode, confirmed: action === "import", fileName: "reviewed-student-import", mappingVersion: STUDENT_MAPPING_VERSION, receipt: receipt.current }) });
      const data = await response.json(); if (ticket !== generation.current) return;
      if (!response.ok) { setServerPreview(false); throw new Error(data.error ?? "Request refused. Refresh your session and validate again."); }
      if (action === "preview") { receipt.current = data.receipt; setPreview(data.preview); setServerPreview(true); setMessage("Server preview complete; no batch or Student write."); }
      else { setResult(data); setServerPreview(false); setMessage(action === "dry-run" ? "Validation report saved: batch/audit metadata created; Student records unchanged." : "Server execution returned. Reconcile counts and the saved batch below."); }
    } catch(e) { if (ticket === generation.current) setMessage(e instanceof Error ? e.message : "Request failed; reconcile before retry."); }
    finally { if (ticket === generation.current) setBusy(false); }
  }
  function controlledPackage() {
    if (!payload.length || busy) return; const ticket = generation.current;
    const parser = new Worker(new URL("../lib/student-source.worker.ts", import.meta.url)); worker.current = parser; setBusy(true);
    const timer = setTimeout(() => { parser.terminate(); if (ticket === generation.current) { setBusy(false); setMessage("Package generation timed out. Split the source."); } }, 10000);
    parser.onmessage = ({data}) => { clearTimeout(timer); parser.terminate(); if(ticket !== generation.current) return; setBusy(false); if (!data.package) return setMessage(data.error ?? "Package generation failed."); const url = URL.createObjectURL(new Blob([data.package], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})); const link = document.createElement("a"); link.href = url; link.download = "nalanda-controlled-source-v1.xlsx"; link.click(); URL.revokeObjectURL(url); setMessage("New canonical workbook downloaded locally. Complete required Guardian/link fields, then use /onboarding for controlled validation. No batch or Student record created."); };
    parser.onerror = () => { clearTimeout(timer); parser.terminate(); if(ticket === generation.current) { setBusy(false); setMessage("Package generator unavailable."); } }; parser.postMessage({ action: "controlled", rows: payload });
  }
  function template() { const url = URL.createObjectURL(new Blob(["academicYear,admissionNo,studentName,fatherName,motherName,className,section,phone1,phone2,dateOfBirth\r\n"], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "nalanda-legacy-students-v1.csv"; link.click(); URL.revokeObjectURL(url); }
  return <section className="card card-pad" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
    <h3>Student Master Import — reviewed source mapping</h3><label>Target workflow<select disabled={busy} value={workflow} onChange={e => { reset(); setWorkflow(e.target.value); }}><option value="legacy">Legacy Student import</option><option value="controlled">Controlled onboarding: new canonical Student workbook</option></select></label>
    <p><a href="/onboarding">Controlled onboarding XLSX template and workflow</a></p><button type="button" className="secondary" onClick={template}>Download supported legacy Student CSV template</button>
    <p>Legacy required: admission number, Student name and class. Father name and phone omissions warn. Controlled onboarding requires Student father name and phone, and Guardian primary mobile. Never enter dummy contacts. Keep admission numbers as text.</p>
    <p role="status">{capability ? `Preview available / ${capability.import ? "Import available under current authority" : "Import disabled"}` : "Access denied or capability unavailable"}</p>
    <label>Academic year<select disabled={busy} value={year} onChange={e => { invalidate(); setYear(e.target.value); setClassChoices({}); }}><option value="">Select year</option>{[...new Set(classes.map(c => c.academicYear))].map(y => <option key={y}>{y}</option>)}</select></label>
    <label>Source CSV / XLSX<input ref={fileInput} type="file" accept=".csv,.xlsx" disabled={busy} onChange={onFile} /></label><button type="button" className="secondary" onClick={reset}>Cancel / clear review</button>
    {source.length ? <><p>Mapping {STUDENT_MAPPING_VERSION}. Excluded columns: {Object.values(mapping).filter(v => !v).length}. Their values will not be uploaded.</p>
      {Object.entries(mapping).map(([header, target]) => <label key={header}>{header}<select disabled={busy} value={target} onChange={e => { invalidate(); setMapping(m => ({ ...m, [header]: e.target.value as any })); }}><option value="">Exclude locally</option>{(workflow === "controlled" ? CONTROLLED_SOURCE_FIELDS : STUDENT_IMPORT_FIELDS).map(f => <option key={f}>{f}</option>)}</select></label>)}
      {sourceClasses.map((label, i) => <label key={i}>Class/section mapping: {JSON.parse(label).join(" / ") || "missing"}<select disabled={busy} value={classChoices[label] ?? ""} onChange={e => { invalidate(); setClassChoices(c => ({ ...c, [label]: e.target.value })); }}><option value="">Use exact separate fields if unambiguous</option>{classes.filter(c => c.academicYear === year).map(c => <option key={JSON.stringify(c)} value={JSON.stringify(c)}>{c.className} / {c.section || "class-wide"}</option>)}</select></label>)}
      {workflow === "legacy" ? <label>Import mode<select disabled={busy} value={mode} onChange={e => { invalidate(); setMode(e.target.value as StudentImportMode); }}><option value="skip">Skip existing</option><option value="create-only">Create new only</option><option value="update">Update existing</option></select></label> : null}<button disabled={busy} onClick={localValidate}>Validate approved fields locally</button></> : null}
    {preview ? <><p>{preview.counts.total} rows · {preview.counts.valid} valid · {preview.counts.errors} errors</p><ImportRowErrors rows={preview.rows.filter(r => r.errors.length || r.warnings.length).map(r => ({ row: r.rowNumber, messages: [...r.errors, ...r.warnings] }))} />
      <details><summary>Optional preview table</summary><div className="table-wrap"><table><thead><tr><th>Row</th><th>Admission</th><th>Student</th><th>Class / section</th></tr></thead><tbody>{preview.rows.slice(0, 50).map(r => <tr key={r.rowNumber}><td>{r.rowNumber}</td><td>{r.normalized.admissionNo}</td><td>{r.normalized.studentName}</td><td>{r.normalized.className} / {r.normalized.section}</td></tr>)}</tbody></table></div></details>
      {workflow === "controlled" ? <button disabled={busy || preview.counts.errors > 0} onClick={controlledPackage}>Download new clean canonical workbook</button> : <><button disabled={busy} onClick={() => call("preview")}>Server validation / preview</button><label><input type="checkbox" checked={approved} disabled={!serverPreview || !capability?.import || busy} onChange={e => setApproved(e.target.checked)} />I reviewed this context, mapping, mode, errors and warnings.</label>
      <button disabled={busy || !serverPreview || !capability?.import} onClick={() => call("dry-run")}>Save validation report — creates batch/audit metadata; does not change Student records</button><button disabled={busy || !approved || !serverPreview || !capability?.import || !preview.counts.valid} onClick={() => call("import")}>Confirm Student import</button></>}</> : null}
    <p role="status">{message}</p>{result ? <><p>{result.result ? `Created ${result.result.created}; updated ${result.result.updated}; skipped ${result.result.skipped}; errors ${result.result.errors.length}.` : "Validation metadata saved."}</p><a href={`/import-verification/${result.batchId ?? result.result?.batchId}`}>Open authoritative batch reconciliation</a></> : null}
  </section>;
}
