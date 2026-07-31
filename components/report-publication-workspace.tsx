"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PublishedReportView } from "@/components/published-report-view";
import type {
  ReportColourMode,
  ReportPublicationScope,
  SafePublishedReportSnapshot
} from "@/lib/report-publication-types";

type ReadinessRun = {
  id: string;
  runReference: string;
  runNumber: number;
  examination: { examCode: string; name: string; academicYear: string };
  classScope: { className: string; section: string };
  studentCount: number;
  templateFamily: string | null;
  templateVersion: number | null;
  lockedAt: string | null;
  status: "READY" | "BLOCKED";
  blockers: string[];
};

type PublishedHistory = {
  reportCardNumber: string;
  publicationReference: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  section: string | null;
  title: string;
  templateFamily: string;
  status: string;
  currentVersion: number;
  updatedAt: string;
  issuedAt: string;
};

type PdfJob = {
  jobKey: string;
  status: string;
  format: string;
  mode: string;
  attempt: number;
  total: number;
  completed: number;
  failed: number;
  fileName: string | null;
  failureSummary: string | null;
  expiresAt: string;
};

type Preview = {
  fingerprint: string;
  count: number;
  scope: ReportPublicationScope;
  reports: SafePublishedReportSnapshot[];
};

export function ReportPublicationWorkspace({
  runs,
  history,
  initialJobs,
  permissions
}: {
  runs: ReadinessRun[];
  history: PublishedHistory[];
  initialJobs: PdfJob[];
  permissions: { publish: boolean; correct: boolean; export: boolean };
}) {
  const router = useRouter();
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const [scope, setScope] = useState<ReportPublicationScope>("SECTION");
  const [admissions, setAdmissions] = useState("");
  const [mode, setMode] = useState<ReportColourMode>("COLOUR");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [publishDialog, setPublishDialog] = useState(false);
  const [publicationRequestKey, setPublicationRequestKey] = useState("");
  const [workflow, setWorkflow] = useState<null | {
    action: "withdraw" | "replace";
    target: PublishedHistory;
  }>(null);
  const [workflowReason, setWorkflowReason] = useState("");
  const [pdfSelection, setPdfSelection] = useState<string[]>([]);
  const [pdfFormat, setPdfFormat] = useState<"INDIVIDUAL_PDF" | "MERGED_PDF" | "ZIP">("MERGED_PDF");
  const [jobs, setJobs] = useState<PdfJob[]>(initialJobs);

  const selectedHistory = useMemo(
    () => history.filter((row) => pdfSelection.includes(row.reportCardNumber) && row.status === "ISSUED"),
    [history, pdfSelection]
  );

  const selectionPayload = () => ({
    calculationRunIds: selectedRuns,
    scope,
    studentAdmissionNumbers:
      scope === "INDIVIDUAL"
        ? admissions.split(/[\s,;]+/).map((value) => value.trim()).filter(Boolean)
        : []
  });

  async function loadPreview(output: "JSON" | "PDF" = "JSON") {
    setBusy(output === "PDF" ? "preview-pdf" : "preview");
    setMessage("");
    try {
      const response = await fetch("/api/report-cards/publication/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...selectionPayload(), output, mode })
      });
      if (output === "PDF" && response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = response.headers.get("x-download-name") || "report-publication-preview.pdf";
        anchor.click();
        URL.revokeObjectURL(url);
        setMessage("Exact preview PDF generated without publishing.");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to prepare publication preview.");
      setPreview(data.preview);
      setPreviewIndex(0);
      setPublicationRequestKey(`EXAM3PUB:${crypto.randomUUID()}`);
      setMessage(`Exact preview ready for ${data.preview.count} report(s). No report was published.`);
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "Unable to prepare publication preview.");
    } finally {
      setBusy("");
    }
  }

  async function publish() {
    if (!preview) return;
    setBusy("publish");
    setMessage("");
    try {
      const response = await fetch("/api/report-cards/publication", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...selectionPayload(),
          previewFingerprint: preview.fingerprint,
          requestKey: publicationRequestKey
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Publication failed.");
      setMessage(`${data.result.count} immutable report version(s) published. Independent QA remains required.`);
      setPublishDialog(false);
      setPreview(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publication failed.");
    } finally {
      setBusy("");
    }
  }

  async function runWorkflow() {
    if (!workflow) return;
    setBusy(workflow.action);
    setMessage("");
    try {
      const body =
        workflow.action === "withdraw"
          ? {
              action: "withdraw",
              reportCardNumber: workflow.target.reportCardNumber,
              expectedVersion: workflow.target.currentVersion,
              expectedUpdatedAt: workflow.target.updatedAt,
              reason: workflowReason
            }
          : {
              action: "replace",
              reportCardNumber: workflow.target.reportCardNumber,
              expectedVersion: workflow.target.currentVersion,
              expectedUpdatedAt: workflow.target.updatedAt,
              reason: workflowReason,
              previewFingerprint: preview?.fingerprint,
              requestKey: `EXAM3REPLACE:${crypto.randomUUID()}`,
              ...selectionPayload()
            };
      const response = await fetch("/api/report-cards/publication/workflow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Publication workflow failed.");
      setMessage(workflow.action === "withdraw" ? "Report withdrawn without deletion." : "Replacement version issued; the prior version remains preserved.");
      setWorkflow(null);
      setWorkflowReason("");
      setPreview(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publication workflow failed.");
    } finally {
      setBusy("");
    }
  }

  async function createPdfJob() {
    if (!selectedHistory.length) return;
    setBusy("pdf-job");
    setMessage("");
    try {
      const response = await fetch("/api/report-cards/pdf-jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestKey: `EXAM3PDF:${crypto.randomUUID()}`,
          format: pdfFormat,
          mode,
          reports: selectedHistory.map((row) => ({
            reportCardNumber: row.reportCardNumber,
            expectedVersion: row.currentVersion
          }))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to queue PDF job.");
      setJobs((current) => [data.job, ...current.filter((job) => job.jobKey !== data.job.jobKey)]);
      setMessage("Bounded PDF job queued. Progress is shown below.");
      pollJob(data.job.jobKey);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue PDF job.");
    } finally {
      setBusy("");
    }
  }

  async function pollJob(jobKey: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      const response = await fetch(`/api/report-cards/pdf-jobs/${encodeURIComponent(jobKey)}`, {
        cache: "no-store"
      });
      if (!response.ok) return;
      const data = await response.json();
      setJobs((current) => [data.job, ...current.filter((job) => job.jobKey !== data.job.jobKey)]);
      if (["COMPLETED", "FAILED"].includes(data.job.status)) return;
    }
  }

  async function retryJob(jobKey: string) {
    setBusy(`retry-${jobKey}`);
    try {
      const response = await fetch(`/api/report-cards/pdf-jobs/${encodeURIComponent(jobKey)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "retry" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Retry failed.");
      setJobs((current) => [data.job, ...current.filter((job) => job.jobKey !== data.job.jobKey)]);
      pollJob(jobKey);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retry failed.");
    } finally {
      setBusy("");
    }
  }

  async function downloadJob(jobKey: string) {
    setBusy(`download-${jobKey}`);
    try {
      const response = await fetch(`/api/report-cards/pdf-jobs/${encodeURIComponent(jobKey)}/access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "download" })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Download authorization failed.");
      window.location.assign(data.access.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Download authorization failed.");
    } finally {
      setBusy("");
    }
  }

  useEffect(() => {
    const active = jobs.filter((job) => ["QUEUED", "RUNNING"].includes(job.status));
    active.forEach((job) => pollJob(job.jobKey));
    // Initial job polling is intentionally one-shot per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="report-publication-workspace">
      <section className="card card-pad">
        <div className="section-title"><div><h2>1. Select locked result snapshot</h2><p>Only complete, current locked calculations with an active frozen template are selectable.</p></div></div>
        <div className="publication-run-list">
          {runs.map((run) => (
            <label className={`publication-run ${run.status === "BLOCKED" ? "is-blocked" : ""}`} key={run.id}>
              <input
                type="checkbox"
                disabled={run.status !== "READY"}
                checked={selectedRuns.includes(run.id)}
                onChange={(event) => {
                  setSelectedRuns((current) =>
                    event.target.checked ? [...current, run.id] : current.filter((id) => id !== run.id)
                  );
                  setPreview(null);
                }}
              />
              <span><strong>{run.examination.examCode} | {run.classScope.className}{run.classScope.section ? `-${run.classScope.section}` : ""}</strong><small>{run.runReference} | {run.studentCount} Students | template v{run.templateVersion ?? "-"}</small>{run.blockers.length ? <em>{run.blockers.join(" ")}</em> : <em>Ready for exact preview</em>}</span>
            </label>
          ))}
          {!runs.length ? <p className="empty-state">No governed result snapshots are available.</p> : null}
        </div>
        <div className="form-grid">
          <label>Publication scope<select value={scope} onChange={(event) => { setScope(event.target.value as ReportPublicationScope); setPreview(null); }}><option value="INDIVIDUAL">Individual</option><option value="SECTION">Section-wise</option><option value="CLASS">Class-wise across selected sections</option></select></label>
          {scope === "INDIVIDUAL" ? <label>Admission number(s)<input value={admissions} onChange={(event) => { setAdmissions(event.target.value); setPreview(null); }} placeholder="EXAM3-P-001" /></label> : null}
          <label>Preview / PDF mode<select value={mode} onChange={(event) => setMode(event.target.value as ReportColourMode)}><option value="COLOUR">Colour</option><option value="MONOCHROME">Printer-safe black and white</option></select></label>
        </div>
        <div className="page-actions">
          <button type="button" disabled={busy !== "" || !selectedRuns.length} onClick={() => loadPreview("JSON")}>{busy === "preview" ? "Preparing preview..." : "Preview exact report"}</button>
          <button type="button" className="secondary" disabled={busy !== "" || !preview} onClick={() => loadPreview("PDF")}>{busy === "preview-pdf" ? "Generating..." : "Download preview PDF"}</button>
        </div>
      </section>

      {preview ? (
        <section className="card card-pad">
          <div className="section-title"><div><h2>2. Exact report preview</h2><p>{preview.count} report(s) share fingerprint <code>{preview.fingerprint.slice(0, 16)}</code>. Publishing rechecks it transactionally.</p></div></div>
          {preview.reports.length > 1 ? <div className="page-actions">{preview.reports.map((report, index) => <button type="button" className={index === previewIndex ? "" : "secondary"} key={report.publicationReference} onClick={() => setPreviewIndex(index)}>{report.student.admissionNumber}</button>)}</div> : null}
          <PublishedReportView report={preview.reports[previewIndex]} mode={mode} preview />
          <div className="page-actions">
            <button type="button" disabled={!permissions.publish || busy !== ""} onClick={() => setPublishDialog(true)}>Publish immutable version(s)</button>
          </div>
        </section>
      ) : null}

      <section className="card">
        <div className="section-title"><div><h2>3. Publication and version history</h2><p>Withdrawals and replacements preserve every issued version; no hard delete is available.</p></div></div>
        <div className="table-wrap"><table><thead><tr><th>PDF</th><th>Student / reference</th><th>Scope</th><th>Family</th><th>Status</th><th>Version</th><th>Governed action</th></tr></thead><tbody>
          {history.map((row) => (
            <tr key={row.reportCardNumber}>
              <td><input aria-label={`Select ${row.publicationReference} for PDF`} type="checkbox" disabled={row.status !== "ISSUED"} checked={pdfSelection.includes(row.reportCardNumber)} onChange={(event) => setPdfSelection((current) => event.target.checked ? [...current, row.reportCardNumber] : current.filter((value) => value !== row.reportCardNumber))} /></td>
              <td>{row.studentName}<br /><small>{row.admissionNumber} | {row.publicationReference}</small></td>
              <td>{row.className}{row.section ? `-${row.section}` : ""}</td>
              <td>{row.templateFamily.replaceAll("_", " ")}</td>
              <td>{row.status}</td>
              <td>v{row.currentVersion}</td>
              <td><div className="page-actions">{permissions.correct && row.status === "ISSUED" ? <button type="button" className="danger" onClick={() => setWorkflow({ action: "withdraw", target: row })}>Withdraw</button> : null}{permissions.correct && preview?.count === 1 ? <button type="button" className="secondary" onClick={() => setWorkflow({ action: "replace", target: row })}>Replace from preview</button> : null}</div></td>
            </tr>
          ))}
          {!history.length ? <tr><td colSpan={7}>No EXAM-RC-IMPL-3 publications yet.</td></tr> : null}
        </tbody></table></div>
      </section>

      <section className="card card-pad">
        <div className="section-title"><div><h2>4. PDF batch generation</h2><p>Jobs are bounded, private, expiring, idempotent, and limited to two concurrent workers.</p></div></div>
        <div className="form-grid">
          <label>Package<select value={pdfFormat} onChange={(event) => setPdfFormat(event.target.value as typeof pdfFormat)}><option value="INDIVIDUAL_PDF">Individual PDF (select one)</option><option value="MERGED_PDF">Merged PDF</option><option value="ZIP">ZIP of individual PDFs</option></select></label>
          <label>Output mode<select value={mode} onChange={(event) => setMode(event.target.value as ReportColourMode)}><option value="COLOUR">Colour</option><option value="MONOCHROME">Black and white</option></select></label>
        </div>
        <button type="button" disabled={!permissions.export || busy !== "" || !selectedHistory.length || (pdfFormat === "INDIVIDUAL_PDF" && selectedHistory.length !== 1)} onClick={createPdfJob}>Generate selected reports</button>
        <div className="pdf-job-list">
          {jobs.map((job) => (
            <article className="pdf-job" key={job.jobKey}>
              <div><strong>{job.format.replaceAll("_", " ")} | {job.mode}</strong><small>{job.jobKey} | attempt {job.attempt}</small></div>
              <progress max={job.total || 1} value={job.completed} aria-label={`${job.completed} of ${job.total} reports generated`} />
              <span>{job.status} | {job.completed}/{job.total}{job.failed ? ` | ${job.failed} failed` : ""}</span>
              {job.failureSummary ? <p className="error-text">{job.failureSummary}</p> : null}
              <div className="page-actions">{job.status === "COMPLETED" ? <button type="button" onClick={() => downloadJob(job.jobKey)} disabled={busy !== ""}>Authorize download</button> : null}{job.status === "FAILED" ? <button type="button" onClick={() => retryJob(job.jobKey)} disabled={busy !== ""}>Retry failed job</button> : null}</div>
            </article>
          ))}
          {!jobs.length ? <p className="empty-state">No PDF jobs have been generated in this private runtime.</p> : null}
        </div>
      </section>

      {message ? <p className="notice publication-feedback" role="status">{message}</p> : null}

      {publishDialog ? (
        <div className="confirmation-overlay" role="presentation">
          <section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-report-title">
            <h3 id="publish-report-title">Publish {preview?.count} immutable report version(s)?</h3>
            <p>This publishes the exact preview fingerprint from locked, non-superseded snapshots. Parents can access only the issued current version for linked children.</p>
            <div className="page-actions"><button type="button" className="secondary" onClick={() => setPublishDialog(false)} disabled={busy !== ""}>Go back</button><button type="button" onClick={publish} disabled={busy !== ""}>{busy === "publish" ? "Publishing..." : "Publish reports"}</button></div>
          </section>
        </div>
      ) : null}

      {workflow ? (
        <div className="confirmation-overlay" role="presentation">
          <section className="card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="publication-workflow-title">
            <h3 id="publication-workflow-title">{workflow.action === "withdraw" ? "Withdraw issued report" : "Issue replacement version"}</h3>
            <p>{workflow.target.publicationReference} | current version {workflow.target.currentVersion}</p>
            {workflow.action === "replace" ? <p>The exact one-report preview above becomes the replacement. The current version is preserved and labelled replaced.</p> : <p>The report content remains preserved but Parent view/download is revoked.</p>}
            <label>Governance reason<textarea autoFocus value={workflowReason} onChange={(event) => setWorkflowReason(event.target.value)} maxLength={1000} required /></label>
            <div className="page-actions"><button type="button" className="secondary" onClick={() => { setWorkflow(null); setWorkflowReason(""); }} disabled={busy !== ""}>Go back</button><button type="button" className={workflow.action === "withdraw" ? "danger" : ""} disabled={busy !== "" || !workflowReason.trim() || (workflow.action === "replace" && preview?.count !== 1)} onClick={runWorkflow}>{busy === workflow.action ? "Working..." : workflow.action === "withdraw" ? "Withdraw without deletion" : "Issue replacement"}</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
