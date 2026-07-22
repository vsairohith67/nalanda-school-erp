"use client";

import { useState } from "react";
import { readSpreadsheetRows } from "@/lib/client-spreadsheet";
import type {
  ImportRow,
  StudentImportMode,
  StudentImportPreview
} from "@/lib/student-import";
import {
  canChangeImportInputs,
  IMPORT_ACTION_COMPLETED_MESSAGE,
  isImportActionDisabled,
  type ImportSubmitAction
} from "@/lib/import-action-state";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  skippedExisting: number;
  errors: ErrorRow[];
  warnings: string[];
  batchId: string;
};

type ErrorRow = {
  rowNumber: number;
  admissionNo: string;
  studentName: string;
  className: string;
  reason: string;
  originalValuesJson: string;
};

export function StudentImportPanel() {
  const [rawRows, setRawRows] = useState<ImportRow[]>([]);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [mode, setMode] = useState<StudentImportMode>("skip");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileWorking, setFileWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState<ImportSubmitAction | null>(null);
  const [fileName, setFileName] = useState("");
  const [notes, setNotes] = useState("");
  const [lastBatchId, setLastBatchId] = useState("");

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
      const rows = await readSpreadsheetRows<ImportRow>(file);
      if (!rows.length) throw new Error("The selected file has no student rows");
      const response = await fetch("/api/import/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "preview", rows })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to preview student import");
      setRawRows(rows);
      setPreview(json.preview);
      setMessage(`Preview ready: ${json.preview.counts.valid} valid of ${json.preview.counts.total} rows.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to read import file");
    } finally {
      setFileWorking(false);
    }
  }

  async function importRows() {
    if (!preview || !confirmed || pendingAction) return;
    setPendingAction("import");
    setResult(null);
    setMessage("");
    try {
      const response = await fetch("/api/import/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "import", rows: rawRows, mode, confirmed: true, fileName, notes })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Student import failed");
      setResult(json.result);
      setLastBatchId(json.result.batchId);
      setMessage(`Student import completed. Review the summary below. ${IMPORT_ACTION_COMPLETED_MESSAGE}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Student import failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function runTrial() {
    if (!preview || pendingAction) return;
    setPendingAction("trial");
    setMessage("");
    setResult(null);
    try {
      const response = await fetch("/api/import/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "dry-run", rows: rawRows, mode, fileName, notes })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Student trial import failed");
      setLastBatchId(json.batchId);
      setMessage([
        `Trial saved: ${json.summary.createdCount} would be created, ${json.summary.updatedCount} updated, ${json.summary.skippedCount} skipped, ${json.summary.errorCount} errors. No students were changed.`,
        IMPORT_ACTION_COMPLETED_MESSAGE,
        json.summary.skippedCount > 0
          ? "These students already exist in this database. Use Update Existing if you want to update them, or reset pilot sample data before testing again."
          : ""
      ].filter(Boolean).join(" "));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Student trial import failed");
    } finally {
      setPendingAction(null);
    }
  }

  const previewErrors = preview?.rows.filter((row) => row.errors.length) ?? [];
  const previewWarnings = preview?.rows.flatMap((row) =>
    row.warnings.map((warning) => `CSV Row ${row.rowNumber}: ${warning}`)
  ) ?? [];

  return (
    <>
      <section className="card card-pad">
        <div className="section-title">
          <div>
            <h3>Student Master Import</h3>
            <p>Upload Excel or CSV, normalize inconsistent columns, review issues, then confirm import.</p>
          </div>
        </div>
        <div className="form-grid">
          <label className="wide">
            Student Excel / CSV File
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={!canChangeImportInputs({ fileWorking })} />
          </label>
          <label>
            Import Mode
            <select value={mode} onChange={(event) => setMode(event.target.value as StudentImportMode)}>
              <option value="skip">Skip duplicates</option>
              <option value="update">Update existing</option>
              <option value="create-only">Create new only</option>
            </select>
            <span className="muted-text">
              Skip duplicates keeps existing admission numbers unchanged. Update existing edits existing students. Create new only fails or skips existing students.
            </span>
          </label>
          <label className="wide">
            Batch Notes (optional)
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: Trial against June Student Master" />
          </label>
        </div>
        <p className="notice">
          sample-students.csv intentionally contains 4 valid rows and 1 invalid row.
          The invalid row should remain rejected during trial runs and confirmed imports.
        </p>
        {preview ? (
          <>
            <div className="grid four" style={{ marginTop: 16 }}>
              <ImportCount label="Total Rows" value={preview.counts.total} />
              <ImportCount label="Valid Rows" value={preview.counts.valid} />
              <ImportCount label="Rows with Errors" value={preview.counts.errors} />
              <ImportCount label="Existing Admissions" value={preview.counts.existing} />
            </div>
            {preview.counts.existing ? (
              <p className="notice">
                These students already exist in this database. Use Update Existing if you want to update them, or reset pilot sample data before testing again.
              </p>
            ) : null}
            <label className="review-checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>I reviewed the normalized preview, errors, warnings, and selected import mode.</span>
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
                onClick={importRows}
                disabled={isImportActionDisabled({
                  fileWorking,
                  pendingAction,
                  baseDisabled: !confirmed || preview.counts.valid === 0
                })}
              >
                {pendingAction === "import" ? "Importing..." : "Confirm Student Import"}
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
            <h3>Normalized Preview — First 50 Rows</h3>
            <p className="muted-text">CSV row numbers include the header row, so the first data row is row 2.</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CSV Row</th><th>Adm No</th><th>Student</th><th>Father</th><th>Class</th>
                  <th>Phone 1</th><th>Phone 2</th><th>Type</th><th>Discount</th><th>Issues</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 50).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.normalized.admissionNo || "—"}</td>
                    <td>{row.normalized.studentName || "—"}</td>
                    <td>{row.normalized.fatherName || "—"}</td>
                    <td>{row.normalized.className || "—"}</td>
                    <td>{row.normalized.phone1 || "—"}</td>
                    <td>{row.normalized.phone2 || "—"}</td>
                    <td>{row.normalized.studentType}</td>
                    <td>{row.normalized.discountPercent}%</td>
                    <td>
                      {row.errors.map((error) => <div className="error" key={error}>{error}</div>)}
                      {row.warnings.map((warning) => <div key={warning}>{warning}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-pad">
            {preview.fileWarnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}
            {previewErrors.length ? <p className="error">{previewErrors.length} row(s) have validation errors and will not import.</p> : null}
            {previewWarnings.length ? (
              <details>
                <summary>{previewWarnings.length} row warning(s)</summary>
                <ul>{previewWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

      {result ? <StudentImportResult result={result} /> : null}
    </>
  );
}

function ImportCount({ label, value }: { label: string; value: number }) {
  return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>;
}

function StudentImportResult({ result }: { result: ImportResult }) {
  return (
    <section className="card card-pad">
      <div className="section-title">
        <div>
          <h3>Student Import Result</h3>
          <p>Created {result.created}, updated {result.updated}, skipped because existing {result.skippedExisting ?? result.skipped}, errors {result.errors.length}.</p>
          <a href={`/import-verification/${result.batchId}`}>View Import Verification</a>
        </div>
        {result.errors.length ? (
          <button className="secondary" onClick={() => downloadErrorCsv(result.errors)}>Download Error CSV</button>
        ) : null}
      </div>
      <div className="grid four">
        <ImportCount label="Created" value={result.created} />
        <ImportCount label="Updated" value={result.updated} />
        <ImportCount label="Skipped Existing" value={result.skippedExisting ?? result.skipped} />
        <ImportCount label="Errors" value={result.errors.length} />
      </div>
      {(result.skippedExisting ?? result.skipped) > 0 ? (
        <p className="notice">
          These students already exist in this database. Use Update Existing if you want to update them, or reset pilot sample data before testing again.
        </p>
      ) : null}
      {result.warnings.length ? (
        <details style={{ marginTop: 16 }}>
          <summary>{result.warnings.length} warning(s)</summary>
          <ul>{result.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
        </details>
      ) : null}
      {result.errors.length ? (
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>CSV Row</th><th>Adm No</th><th>Student</th><th>Class</th><th>Reason</th></tr></thead>
            <tbody>{result.errors.map((error, index) => (
              <tr key={`${error.rowNumber}-${index}`}>
                <td>{error.rowNumber}</td><td>{error.admissionNo}</td><td>{error.studentName}</td>
                <td>{error.className}</td><td>{error.reason}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function downloadErrorCsv(errors: ErrorRow[]) {
  const headers = ["rowNumber", "admissionNo", "studentName", "className", "reason", "originalValuesJson"];
  const csv = [
    headers.join(","),
    ...errors.map((row) => headers.map((header) => csvCell(row[header as keyof ErrorRow])).join(","))
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-import-errors.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
}
