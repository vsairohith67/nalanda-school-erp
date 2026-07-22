"use client";

import { useState } from "react";
import { readSpreadsheetRows } from "@/lib/client-spreadsheet";
import type { GuardianImportPreview, GuardianImportRow, GuardianImportResult } from "@/lib/guardians";
import {
  canChangeImportInputs,
  IMPORT_ACTION_COMPLETED_MESSAGE,
  isImportActionDisabled,
  type ImportSubmitAction
} from "@/lib/import-action-state";

type GuardianImportResultWithBatch = GuardianImportResult & { batchId: string };

export function GuardianImportPanel() {
  const [rawRows, setRawRows] = useState<GuardianImportRow[]>([]);
  const [preview, setPreview] = useState<GuardianImportPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [fileWorking, setFileWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState<ImportSubmitAction | null>(null);
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState("");
  const [lastBatchId, setLastBatchId] = useState("");
  const [result, setResult] = useState<GuardianImportResultWithBatch | null>(null);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setResult(null);
    setConfirmed(false);
    if (!file) return;
    setFileName(file.name);
    setFileWorking(true);
    setMessage("");
    try {
      const rows = await readSpreadsheetRows<GuardianImportRow>(file);
      if (!rows.length) throw new Error("The selected file has no guardian rows");
      const response = await fetch("/api/import/guardians", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preview", rows })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to preview guardian import");
      setRawRows(rows);
      setPreview(json.preview);
      setMessage(`Preview ready: ${json.preview.counts.valid} valid of ${json.preview.counts.total} rows.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to read guardian file");
    } finally {
      setFileWorking(false);
    }
  }

  async function runTrial() {
    if (!preview || pendingAction) return;
    setPendingAction("trial");
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/import/guardians", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dry-run", rows: rawRows, fileName, notes })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Guardian trial import failed");
      setLastBatchId(json.batchId);
      setMessage(
        `Trial saved: ${json.summary.createdCount} guardian(s) would be created, ${json.summary.updatedCount} existing guardian match(es), ${json.summary.errorCount} errors. No guardian records were changed. ${IMPORT_ACTION_COMPLETED_MESSAGE}`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Guardian trial import failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function importRows() {
    if (!preview || !confirmed || pendingAction) return;
    setPendingAction("import");
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/import/guardians", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "import", rows: rawRows, confirmed: true, fileName, notes })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Guardian import failed");
      setResult(json.result);
      setLastBatchId(json.result.batchId);
      setMessage(`Guardian link import completed. ${IMPORT_ACTION_COMPLETED_MESSAGE}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Guardian import failed");
    } finally {
      setPendingAction(null);
    }
  }

  const rowWarnings = preview?.rows.flatMap((row) =>
    row.warnings.map((warning) => `CSV Row ${row.rowNumber}: ${warning}`)
  ) ?? [];

  return (
    <>
      <section className="card card-pad">
        <div className="section-title inline-section-title">
          <div>
            <h3>Guardian Link Import</h3>
            <p>Preview parent/guardian links by admission number before creating guardian records or sibling groups.</p>
          </div>
          <a className="button secondary" href="/api/import/guardians/template">Download Template</a>
        </div>
        <div className="form-grid">
          <label className="wide">
            Guardian Excel / CSV File
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={!canChangeImportInputs({ fileWorking })} />
          </label>
          <label className="wide">
            Batch Notes (optional)
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: Parent mobile cleanup batch for sibling linking" />
          </label>
        </div>
        <p className="notice">
          Supported columns: admissionNo, studentName, guardianName, mobile, alternateMobile, email, relationship, isPrimaryContact, canViewFees, canReceiveReminders.
        </p>
        {preview ? (
          <>
            <div className="grid four" style={{ marginTop: 16 }}>
              <ImportCount label="Total Rows" value={preview.counts.total} />
              <ImportCount label="Valid Rows" value={preview.counts.valid} />
              <ImportCount label="New Guardians" value={preview.counts.newGuardians} />
              <ImportCount label="Existing Links" value={preview.counts.existingLinks} />
            </div>
            <label className="review-checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>I reviewed admission matches, duplicate guardian warnings, and parent-login safety. I understand no parent dashboard is built yet.</span>
            </label>
            <div className="top-actions" style={{ marginTop: 12 }}>
              <button
                className="secondary"
                type="button"
                onClick={runTrial}
                disabled={isImportActionDisabled({ fileWorking, pendingAction })}
              >
                {pendingAction === "trial" ? "Saving Trial..." : "Save Trial Run (No Changes)"}
              </button>
              <button
                type="button"
                onClick={importRows}
                disabled={isImportActionDisabled({
                  fileWorking,
                  pendingAction,
                  baseDisabled: !confirmed || preview.counts.valid === 0
                })}
              >
                {pendingAction === "import" ? "Importing..." : "Confirm Guardian Link Import"}
              </button>
            </div>
          </>
        ) : null}
        {message ? <p className="notice" role="status">{message}</p> : null}
        {lastBatchId ? <p><a href={`/import-verification/${lastBatchId}`}>View saved verification batch</a></p> : null}
      </section>

      {preview ? (
        <section className="card">
          <div className="section-title">
            <div>
              <h3>Guardian Preview - First 50 Rows</h3>
              <p className="muted-text">CSV row numbers include the header row, so the first data row is row 2.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CSV Row</th><th>Adm No</th><th>Matched Student</th><th>Guardian</th>
                  <th>Mobile</th><th>Email</th><th>Relationship</th><th>Match</th><th>Issues</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.normalized.admissionNo || "-"}</td>
                    <td>{row.matchedStudent ? `${row.matchedStudent.studentName} (${row.matchedStudent.className}${row.matchedStudent.section ? `-${row.matchedStudent.section}` : ""})` : "-"}</td>
                    <td>{row.normalized.guardianName || "-"}</td>
                    <td>{row.normalized.mobile || "-"}</td>
                    <td>{row.normalized.email || "-"}</td>
                    <td>{row.normalized.relationship}</td>
                    <td>{row.matchedGuardian ? `Existing: ${row.matchedGuardian.displayName}` : "New guardian"}</td>
                    <td>
                      {row.errors.map((error) => <div className="error" key={error}>{error}</div>)}
                      {row.warnings.map((warning) => <div className="muted-text" key={warning}>{warning}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-pad">
            {preview.fileWarnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}
            {preview.counts.errors ? <p className="error">{preview.counts.errors} row(s) have validation errors and will not import.</p> : null}
            {rowWarnings.length ? (
              <details>
                <summary>{rowWarnings.length} row warning(s)</summary>
                <ul>{rowWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

      {result ? (
        <section className="card card-pad">
          <h3>Guardian Import Result</h3>
          <div className="grid four">
            <ImportCount label="Guardians Created" value={result.guardiansCreated} />
            <ImportCount label="Guardians Reused" value={result.guardiansReused} />
            <ImportCount label="Links Created" value={result.linksCreated} />
            <ImportCount label="Links Updated" value={result.linksUpdated} />
          </div>
          <p>
            Skipped {result.linksSkipped}, errors {result.errors.length}, warnings {result.warnings.length}.
            {" "}<a href={`/import-verification/${result.batchId}`}>View Import Verification</a>
          </p>
          {result.errors.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>CSV Row</th><th>Adm No</th><th>Guardian</th><th>Mobile</th><th>Reason</th></tr></thead>
                <tbody>
                  {result.errors.map((error, index) => (
                    <tr key={`${error.rowNumber}-${index}`}>
                      <td>{error.rowNumber}</td>
                      <td>{error.admissionNo}</td>
                      <td>{error.guardianName}</td>
                      <td>{error.mobile}</td>
                      <td>{error.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function ImportCount({ label, value }: { label: string; value: number }) {
  return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>;
}
