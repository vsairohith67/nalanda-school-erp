"use client";

import { useMemo, useState } from "react";
import { ACADEMIC_REPORT_FAMILIES, BOARD_CLASS_DISCLAIMER, REPORT_FAMILY_LABELS, type AcademicReportFamily, type AcademicReportSummary } from "@/lib/academic-reporting-types";

type Option = { academicYear: string; examinationCode: string; examinationName: string; className: string; section: string };
type Run = { runReference: string; summaryHash: string; generatedAt: string; idempotent: boolean; stale?: boolean; staleWarning?: string | null; summary: AcademicReportSummary; audit: Array<{ eventType: string; actorRole: string; occurredAt: string; details: Record<string,unknown> }> };

export function AcademicReportingWorkspace({ role, options }: { role: string; options: Option[] }) {
  const families = allowedFamilies(role), years = unique(options.map((row) => row.academicYear));
  const [family,setFamily] = useState<AcademicReportFamily>(families[0]);
  const [academicYear,setAcademicYear] = useState(years[0] ?? "2026-27");
  const yearOptions = options.filter((row) => row.academicYear === academicYear), examOptions = uniqueBy(yearOptions, (row) => row.examinationCode);
  const [exams,setExams] = useState<string[]>(examOptions[0] ? [examOptions[0].examinationCode] : []);
  const [className,setClassName] = useState(""), [section,setSection] = useState(""), [subjectCode,setSubjectCode] = useState("");
  const [normalizationRule,setNormalizationRule] = useState("STRICT_MATCH"), [approvalReference,setApprovalReference] = useState("");
  const [includeAverageHighest,setIncludeAverageHighest] = useState(false), [run,setRun] = useState<Run | null>(null), [error,setError] = useState(""), [busy,setBusy] = useState(false);
  const classes = useMemo(() => unique(yearOptions.map((row) => row.className)), [yearOptions]);
  const sections = useMemo(() => unique(yearOptions.filter((row) => !className || row.className === className).map((row) => row.section)), [yearOptions,className]);
  const comparative = ["COMPARATIVE_DELTA","BOARD_CLASS_COMPARATIVE"].includes(family);
  const board = family === "BOARD_CLASS_COMPARATIVE" || ["IX","X","9","10","CLASS IX","CLASS X"].includes(className.toUpperCase());

  async function generate() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/academic-reports/runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ family, academicYear, examinationCodes: exams, className: className || null, section: section || null, subjectCode: subjectCode || null, normalizationRule: comparative ? normalizationRule : "NONE", includeAverageHighest, approvalReference: approvalReference || null }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Unable to generate report"); setRun(data.run);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to generate report"); }
    finally { setBusy(false); }
  }

  async function download(format: "CSV" | "PDF", mode: "COLOUR" | "MONOCHROME" = "MONOCHROME") {
    if (!run) return; setBusy(true); setError("");
    try {
      const response = await fetch(`/api/academic-reports/runs/${encodeURIComponent(run.runReference)}/export`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ format, mode }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? "Unable to export report"); }
      const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = dispositionName(response.headers.get("content-disposition"), `academic-report.${format.toLowerCase()}`); document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      const refreshed = await fetch(`/api/academic-reports/runs/${encodeURIComponent(run.runReference)}`, { cache: "no-store" }); if (refreshed.ok) setRun((await refreshed.json()).run);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to export report"); }
    finally { setBusy(false); }
  }

  return <div className="academic-reporting-workspace">
    <section className="card card-pad" aria-labelledby="academic-report-selector">
      <h2 id="academic-report-selector">Report selector</h2>
      <p className="muted">Only locked result snapshots and current issued report versions are eligible. No raw marks are recalculated.</p>
      <div className="filter-grid academic-report-filter-grid">
        <label>Report family<select value={family} onChange={(event)=>{const next=event.target.value as AcademicReportFamily;setFamily(next);setRun(null);}}>{families.map((item)=><option key={item} value={item}>{REPORT_FAMILY_LABELS[item]}</option>)}</select></label>
        <label>Academic year<select value={academicYear} onChange={(event)=>{setAcademicYear(event.target.value);setExams([]);setRun(null);}}>{years.map((item)=><option key={item}>{item}</option>)}</select></label>
        <label>Class<select value={className} onChange={(event)=>{setClassName(event.target.value);setSection("");}}><option value="">All governed classes</option>{classes.map((item)=><option key={item}>{item}</option>)}</select></label>
        <label>Section<select value={section} onChange={(event)=>setSection(event.target.value)}><option value="">All governed sections</option>{sections.map((item)=><option key={item}>{item}</option>)}</select></label>
        <label>Assigned subject/paper code<input value={subjectCode} onChange={(event)=>setSubjectCode(event.target.value.toUpperCase())} maxLength={60} placeholder={role === "TEACHER" ? "Optional assigned code" : "Optional exact code"}/></label>
        {comparative ? <label>Comparison rule<select value={normalizationRule} onChange={(event)=>setNormalizationRule(event.target.value)}><option value="STRICT_MATCH">Strict match</option><option value="PERCENTAGE_NORMALIZED">Published percentage normalisation</option></select></label> : null}
      </div>
      <fieldset className="academic-exam-selector"><legend>Published examinations (maximum 12)</legend>{examOptions.length ? examOptions.map((option)=><label key={option.examinationCode}><input type="checkbox" checked={exams.includes(option.examinationCode)} onChange={(event)=>setExams((current)=>event.target.checked ? [...new Set([...current,option.examinationCode])].slice(0,12) : current.filter((item)=>item!==option.examinationCode))}/><span>{option.examinationName} <small>({option.examinationCode})</small></span></label>) : <p className="notice">No eligible issued examination versions are available in this role scope.</p>}</fieldset>
      {["CLASS_AVERAGE_HIGHEST","LEADERSHIP_SUMMARY"].includes(family) && leadership(role) ? <div className="approval-box"><label className="check-label"><input type="checkbox" checked={includeAverageHighest} onChange={(event)=>setIncludeAverageHighest(event.target.checked)}/>Include approved class average/highest</label>{includeAverageHighest ? <label>Approval reference<input value={approvalReference} onChange={(event)=>setApprovalReference(event.target.value)} maxLength={160}/></label> : null}</div> : null}
      {board ? <p className="notice" role="note"><strong>Class IX/X boundary:</strong> {BOARD_CLASS_DISCLAIMER}</p> : null}
      {comparative ? <div className="comparison-preview" aria-live="polite"><strong>Comparison preview:</strong> {exams.length < 2 ? "Select at least two issued exams." : `${exams.join(" → ")} under ${normalizationRule.replaceAll("_"," ").toLowerCase()}. Compatibility is verified server-side before any delta is shown.`}</div> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button className="button" type="button" disabled={busy || !exams.length || comparative && exams.length < 2} onClick={generate}>{busy ? "Working…" : "Generate governed report"}</button>
    </section>
    {run ? <ReportRunView run={run} busy={busy} onDownload={download}/> : null}
  </div>;
}

function ReportRunView({ run, busy, onDownload }: { run: Run; busy: boolean; onDownload: (format:"CSV"|"PDF",mode?:"COLOUR"|"MONOCHROME")=>void }) {
  const summary=run.summary;
  return <section className="academic-report-output" aria-labelledby="academic-report-result">
    <div className="card card-pad"><div className="academic-report-heading"><div><h2 id="academic-report-result">{summary.title}</h2><p>Run {run.runReference} · generated {new Date(summary.generatedAt).toLocaleString("en-IN")} · {run.idempotent ? "reused deterministic run" : "new immutable run"}</p></div><div className="academic-report-actions"><button className="button secondary" disabled={busy} onClick={()=>onDownload("CSV")}>Safe CSV</button><button className="button secondary" disabled={busy} onClick={()=>onDownload("PDF","COLOUR")}>Colour PDF</button><button className="button secondary" disabled={busy} onClick={()=>onDownload("PDF","MONOCHROME")}>Monochrome PDF</button></div></div>
      <p className="notice">{summary.sourceStatement}</p>{run.staleWarning ? <p className="warning" role="alert">{run.staleWarning}</p> : null}{summary.boardClassDisclaimer ? <p className="notice"><strong>Boundary:</strong> {summary.boardClassDisclaimer}</p> : null}
      {summary.warnings.map((warning)=><p className="warning" key={warning}>{warning}</p>)}
      <details><summary>Source/version evidence ({summary.sourceVersions.length})</summary><div className="table-wrap"><table><thead><tr><th>Exam</th><th>Issued report version</th><th>Locked result version</th><th>Formula</th><th>Rounding</th><th>Locked</th><th>Issued</th></tr></thead><tbody>{summary.sourceVersions.map((source,index)=><tr key={`${source.reportReference}-${index}`}><td>{source.examinationCode}</td><td>{source.reportReference} v{source.reportVersion}</td><td>v{source.resultSnapshotVersion}</td><td>{source.formulaVersion}</td><td>{source.roundingPolicyVersion}</td><td>{new Date(source.sourceLockedAt).toLocaleString("en-IN")}</td><td>{new Date(source.publishedAt).toLocaleString("en-IN")}</td></tr>)}</tbody></table></div></details>
    </div>
    {summary.sections.map((section)=><article className="card card-pad academic-report-section" key={section.id}><h3>{section.title}</h3><p className="muted">{section.description}</p>{section.chart ? <div className="pattern-chart" role="img" aria-label={section.chart.label}>{section.chart.series.map((series,index)=><div className="pattern-row" key={`${series.label}-${series.pattern}-${index}`}><span>{series.label}</span><span className={`pattern-bar pattern-${series.pattern.toLowerCase()}`} style={{width:`${Math.max(44,Math.min(100,series.value))}%`}} aria-hidden="true"></span><strong>{series.value}</strong><small>{series.pattern.toLowerCase()} pattern</small></div>)}</div> : null}<div className="table-wrap"><table><thead><tr>{section.columns.map((column)=><th key={column}>{column}</th>)}</tr></thead><tbody>{section.rows.length ? section.rows.map((row,index)=><tr key={index}>{section.columns.map((column)=><td key={column}>{String(row[column] ?? "")}</td>)}</tr>) : <tr><td colSpan={section.columns.length}>No eligible issued source rows.</td></tr>}</tbody></table></div></article>)}
    <section className="card card-pad"><h3>Export history</h3><ul>{run.audit.filter((event)=>event.eventType==="EXPORT_AUTHORIZED").map((event,index)=><li key={`${event.occurredAt}-${index}`}>{String(event.details.format)} {String(event.details.mode)} authorised for {event.actorRole} at {new Date(event.occurredAt).toLocaleString("en-IN")}</li>)}</ul>{!run.audit.some((event)=>event.eventType==="EXPORT_AUTHORIZED") ? <p className="muted">No export has been authorised for this run.</p> : null}</section>
  </section>;
}

function allowedFamilies(role: string) { if (leadership(role)) return [...ACADEMIC_REPORT_FAMILIES]; if (role === "TEACHER") return ["SUBJECT_PAPER_DISTRIBUTION","OUTCOME_DISTRIBUTION","COMPLETION_MISSING_SOURCE"] as AcademicReportFamily[]; if (role === "VIEWER") return ["CLASS_SECTION_SUMMARY","SUBJECT_PAPER_DISTRIBUTION","OUTCOME_DISTRIBUTION","COMPLETION_MISSING_SOURCE","LEADERSHIP_SUMMARY"] as AcademicReportFamily[]; return ["STUDENT_LONGITUDINAL"] as AcademicReportFamily[]; }
function leadership(role: string) { return ["SUPER_ADMIN","DIRECTOR","PRINCIPAL"].includes(role); }
function unique(values: string[]) { return [...new Set(values.filter(Boolean))].sort(); }
function uniqueBy<T>(values: T[], key: (value:T)=>string) { return [...new Map(values.map((value)=>[key(value),value])).values()]; }
function dispositionName(value: string | null, fallback: string) { const match=value?.match(/filename="([^"]+)"/i); return match?.[1] ?? fallback; }
