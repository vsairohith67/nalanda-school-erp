"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui";

type DashboardData = any;
type ActionDialog =
  | { kind: "moderate"; component: any }
  | { kind: "correction"; component: any; decision: "reopen" | "reject" }
  | { kind: "lock"; run: any }
  | null;

function requestKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID().replaceAll("-", "")}`;
}

function formatSchoolTimestamp(value: string) {
  const instant = new Date(value);
  if (Number.isNaN(instant.valueOf())) return "Unknown time";
  const schoolTime = new Date(instant.valueOf() + (5 * 60 + 30) * 60_000);
  const day = String(schoolTime.getUTCDate()).padStart(2, "0");
  const month = String(schoolTime.getUTCMonth() + 1).padStart(2, "0");
  const year = schoolTime.getUTCFullYear();
  const hour24 = schoolTime.getUTCHours();
  const hour12 = hour24 % 12 || 12;
  const minute = String(schoolTime.getUTCMinutes()).padStart(2, "0");
  const second = String(schoolTime.getUTCSeconds()).padStart(2, "0");
  return `${day}/${month}/${year}, ${String(hour12).padStart(2, "0")}:${minute}:${second} ${hour24 < 12 ? "am" : "pm"} IST`;
}

export function ExamModerationDashboard({
  initialData,
  actorRole,
  permissions
}: {
  initialData: DashboardData;
  actorRole: string;
  permissions: { canModerate: boolean; canReopen: boolean; canCalculate: boolean; canLock: boolean };
}) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<ActionDialog>(null);
  const [reason, setReason] = useState("");
  const selection = data.selection;

  async function responseJson(response: Response, fallback: string) {
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : fallback);
    return body;
  }

  async function refresh(examinationId = selection?.examinationId, classScopeId = selection?.classScopeId) {
    if (!examinationId || !classScopeId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/exam-moderation?examinationId=${encodeURIComponent(examinationId)}&classScopeId=${encodeURIComponent(classScopeId)}`,
        { cache: "no-store" }
      );
      setData(await responseJson(response, "Moderation dashboard could not be refreshed."));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Moderation dashboard could not be refreshed.");
    } finally {
      setBusy(false);
    }
  }

  async function performAction() {
    if (!dialog || !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (dialog.kind === "moderate") {
        await responseJson(await fetch(`/api/exam-moderation/sheets/${encodeURIComponent(dialog.component.sheetId)}/workflow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestKey: requestKey("moderate"),
            expectedSheetVersion: dialog.component.sheetVersion,
            reason,
            interventionReason: actorRole === "SUPER_ADMIN" ? reason : undefined
          })
        }), "Moderation failed.");
        setNotice("Sheet moderated with append-only evidence.");
      } else if (dialog.kind === "correction") {
        await responseJson(await fetch(`/api/exam-moderation/corrections/${encodeURIComponent(dialog.component.correctionRequest.id)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: dialog.decision,
            requestKey: requestKey(dialog.decision),
            expectedSheetVersion: dialog.component.sheetVersion,
            reason,
            interventionReason: actorRole === "SUPER_ADMIN" ? reason : undefined
          })
        }), "Correction review failed.");
        setNotice(dialog.decision === "reopen" ? "A new editable sheet version was created." : "Correction request rejected.");
      } else {
        await responseJson(await fetch(`/api/exam-moderation/calculations/${encodeURIComponent(dialog.run.id)}/lock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestKey: requestKey("lock"),
            reason,
            interventionReason: actorRole === "SUPER_ADMIN" ? reason : undefined
          })
        }), "Calculation lock failed.");
        setNotice("Source sheet versions and calculation snapshot were locked. Nothing was published.");
      }
      setDialog(null);
      setReason("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Governed action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function calculatePreview() {
    if (!selection) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/exam-moderation/calculations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examinationId: selection.examinationId,
          classScopeId: selection.classScopeId,
          requestKey: requestKey("calculation")
        })
      });
      const result = await responseJson(response, "Calculation preview failed.");
      setNotice(result.idempotent ? "The matching deterministic preview already existed." : "A new immutable calculation preview was created.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Calculation preview failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!selection) {
    return <section className="card empty-state"><h3>No active examination scope</h3><p>Configure and activate an examination before moderation.</p></section>;
  }

  const scopes = data.examinations.find((exam: any) => exam.id === selection.examinationId)?.classScopes ?? [];
  const flatComponents = data.sheets.flatMap((paper: any) =>
    paper.components.map((component: any) => ({ ...component, paper }))
  );

  return (
    <>
      <section className="card moderation-command-bar">
        <label>
          Examination
          <select
            value={selection.examinationId}
            disabled={busy}
            onChange={(event) => {
              const exam = data.examinations.find((row: any) => row.id === event.target.value);
              void refresh(event.target.value, exam?.classScopes[0]?.id);
            }}
          >
            {data.examinations.map((exam: any) => <option key={exam.id} value={exam.id}>{exam.examCode} · {exam.name}</option>)}
          </select>
        </label>
        <label>
          Class / section
          <select value={selection.classScopeId} disabled={busy} onChange={(event) => void refresh(selection.examinationId, event.target.value)}>
            {scopes.map((scope: any) => <option key={scope.id} value={scope.id}>{scope.className}-{scope.section}</option>)}
          </select>
        </label>
        <div>
          <strong>{selection.examination.name}</strong>
          <span>{selection.examination.academicYear} · Class {selection.classScope.className}-{selection.classScope.section}</span>
        </div>
      </section>

      <section className="moderation-metrics" aria-label="Completion summary">
        {[
          ["Not started", data.summary.notStarted],
          ["Draft", data.summary.draft],
          ["Submitted", data.summary.submitted],
          ["Reopened", data.summary.reopened],
          ["Locked", data.summary.locked],
          ["Missing entries", data.summary.missingEntries],
          ["Correction requests", data.summary.correctionRequests],
          ["Validation failures", data.summary.validationFailures]
        ].map(([label, value]) => (
          <div className="card" key={String(label)}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </section>

      {notice ? <div className="notice success" role="status">{notice}</div> : null}
      {error ? <div className="notice danger" role="alert">{error}</div> : null}

      <section className="card moderation-calculation-readiness">
        <div>
          <h3>Calculation readiness</h3>
          <p>{selection.calculationIssues.length ? `${selection.calculationIssues.length} blocking issue(s)` : "All required source sheets are ready."}</p>
        </div>
        {permissions.canCalculate ? (
          <button className="button" type="button" disabled={busy || selection.calculationIssues.length > 0} onClick={() => void calculatePreview()}>
            Create calculation preview
          </button>
        ) : null}
        {selection.calculationIssues.length ? (
          <ul>{selection.calculationIssues.map((issue: string) => <li key={issue}>{issue}</li>)}</ul>
        ) : null}
      </section>

      <section className="card moderation-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Paper / component</th>
              <th>Primary / contributors</th>
              <th>Status</th>
              <th>Entry counts</th>
              <th>Submission</th>
              <th>Governed actions</th>
            </tr>
          </thead>
          <tbody>
            {flatComponents.map((component: any) => (
              <tr key={component.componentId}>
                <th scope="row">
                  {component.paper.subjectName}<br />
                  <small>{component.paper.paperCode} · {component.componentName}</small>
                </th>
                <td>{component.primaryTeacher}<small>{component.contributors.length ? `Contributors: ${component.contributors.join(", ")}` : "No contributors"}</small></td>
                <td><StatusBadge status={component.status} />{component.late ? <span className="badge danger">LATE</span> : null}</td>
                <td>
                  <strong>{component.missing} missing</strong>
                  <small>{component.absent} absent · {component.exempt} exempt · {component.notApplicable} N/A</small>
                </td>
                <td>
                  {component.submittedAt ? formatSchoolTimestamp(component.submittedAt) : "Not submitted"}
                  <details>
                    <summary>Version history ({component.history.length})</summary>
                    <ol>{component.history.map((version: any) => (
                      <li key={version.id}>v{version.versionNumber} · {version.status} · {formatSchoolTimestamp(version.createdAt)}</li>
                    ))}</ol>
                  </details>
                </td>
                <td>
                  <div className="moderation-actions">
                    {permissions.canModerate && ["SUBMITTED", "RESUBMITTED"].includes(component.status) ? (
                      <button type="button" className="button secondary" onClick={() => setDialog({ kind: "moderate", component })}>Moderate</button>
                    ) : null}
                    {permissions.canReopen && component.correctionRequest ? (
                      <>
                        <button type="button" className="button secondary" onClick={() => setDialog({ kind: "correction", component, decision: "reopen" })}>Reopen</button>
                        <button type="button" className="button secondary" onClick={() => setDialog({ kind: "correction", component, decision: "reject" })}>Reject</button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="calculation-run-grid">
        {data.calculationRuns.map((run: any) => (
          <article className="card calculation-run-card" key={run.id}>
            <div className="section-title">
              <div>
                <h3>Calculation run {run.runNumber}</h3>
                <p>{run.formulaVersion} · {run.roundingPolicyVersion}</p>
              </div>
              <StatusBadge status={run.status} />
            </div>
            <dl>
              <div><dt>Calculated</dt><dd>{formatSchoolTimestamp(run.calculatedAt)}</dd></div>
              <div><dt>Snapshots</dt><dd>{run.snapshots.length}</dd></div>
              <div><dt>Source sheets</dt><dd>{run.sourceSheetVersionIds.length}</dd></div>
              <div><dt>Warnings</dt><dd>{run.warnings.length}</dd></div>
            </dl>
            <details>
              <summary>Preview Student results</summary>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Snapshot</th><th>Total</th><th>Percentage</th><th>Grade</th><th>Pass</th><th>Rank</th></tr></thead>
                  <tbody>{run.snapshots.map((snapshot: any) => (
                    <tr key={snapshot.id}>
                      <td>v{snapshot.version}</td>
                      <td>{snapshot.totalObtained}/{snapshot.totalMaximum}</td>
                      <td>{snapshot.percentage}%</td>
                      <td>{snapshot.gradeCode ?? "Disabled"}</td>
                      <td>{snapshot.passResult ?? "Disabled"}</td>
                      <td>{snapshot.rank ?? "Disabled"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </details>
            {permissions.canLock && run.status === "PREVIEW" ? (
              <button type="button" className="button" onClick={() => setDialog({ kind: "lock", run })}>Lock moderated results</button>
            ) : null}
          </article>
        ))}
        {!data.calculationRuns.length ? <section className="card empty-state"><h3>No calculation preview</h3><p>Complete and submit required sheets before creating a preview.</p></section> : null}
      </section>

      {dialog ? (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog-card moderation-dialog" role="dialog" aria-modal="true" aria-labelledby="moderation-dialog-title">
            <h3 id="moderation-dialog-title">
              {dialog.kind === "moderate" ? "Moderate sheet" : dialog.kind === "lock" ? "Lock calculation" : `${dialog.decision === "reopen" ? "Reopen" : "Reject"} correction`}
            </h3>
            <p>
              {dialog.kind === "lock"
                ? "This freezes the exact source sheet versions and calculation snapshots. It does not publish any report card."
                : "This action is append-only and requires a bounded audit reason."}
            </p>
            <label>
              Audit reason
              <textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} autoFocus />
            </label>
            <div className="page-actions">
              <button type="button" className="button secondary" onClick={() => { setDialog(null); setReason(""); }}>Cancel</button>
              <button type="button" className="button" disabled={!reason.trim() || busy} onClick={() => void performAction()}>
                {busy ? "Working…" : "Confirm governed action"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
