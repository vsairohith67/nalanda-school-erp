"use client";

import { useState } from "react";
import { readSpreadsheetRows } from "@/lib/client-spreadsheet";
import {
  paymentImportRowStatus,
  type PaymentImportPreview,
  type PaymentImportRow
} from "@/lib/payment-import";
import {
  canChangeImportInputs,
  IMPORT_ACTION_COMPLETED_MESSAGE,
  isImportActionDisabled,
  type ImportSubmitAction
} from "@/lib/import-action-state";
import {
  RECONCILIATION_ACCOUNTS,
  compareExpectedPaymentTotals,
  type ExpectedPaymentTotals,
  type ExpectedTotalsComparisonRow,
  type PaymentReconciliation
} from "@/lib/import-verification";
import { money } from "@/lib/format";

type ImportMode = "import-valid" | "dry-run";

type PaymentImportErrorRow = {
  rowNumber: number;
  receiptNo: string;
  admissionNo: string;
  studentName: string;
  className: string;
  amountPaid: number;
  reason: string;
  originalValuesJson: string;
};

type PaymentImportResult = {
  created: number;
  skippedDuplicates: number;
  errors: PaymentImportErrorRow[];
  warnings: string[];
  batchId: string;
  reconciliation: PaymentReconciliation;
};

export function PaymentImportPanel() {
  const [rawRows, setRawRows] = useState<PaymentImportRow[]>([]);
  const [preview, setPreview] = useState<PaymentImportPreview | null>(null);
  const [mode, setMode] = useState<ImportMode>("import-valid");
  const [confirmed, setConfirmed] = useState(false);
  const [fileWorking, setFileWorking] = useState(false);
  const [pendingAction, setPendingAction] = useState<ImportSubmitAction | null>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<PaymentImportResult | null>(null);
  const [reconciliation, setReconciliation] = useState<PaymentReconciliation | null>(null);
  const [expectedTotals, setExpectedTotals] = useState<Record<string, string>>({});
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
      const rows = await readSpreadsheetRows<PaymentImportRow>(file);
      if (!rows.length) throw new Error("The selected file has no payment rows");
      const nextPreview = await requestPreview(rows);
      setRawRows(rows);
      setPreview(nextPreview.preview);
      setReconciliation(nextPreview.reconciliation);
      setMessage(`Preview ready: ${nextPreview.preview.counts.ready} ready of ${nextPreview.preview.counts.total} rows.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to read payment file");
    } finally {
      setFileWorking(false);
    }
  }

  async function runAction() {
    if (!preview || pendingAction) return;
    const action: ImportSubmitAction = mode === "dry-run" ? "trial" : "import";
    setPendingAction(action);
    setResult(null);
    setMessage("");
    try {
      if (mode === "dry-run") {
        const response = await fetch("/api/import/payments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "dry-run",
            rows: rawRows,
            fileName,
            notes,
            expectedTotals: normalizedExpectedTotals(expectedTotals)
          })
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Payment trial import failed");
        setPreview(json.preview);
        setReconciliation(json.reconciliation);
        setLastBatchId(json.batchId);
        setMessage(
          `Trial saved: ${json.preview.counts.ready} ready, ${json.preview.counts.duplicates} duplicates, ${json.preview.counts.errors} errors. No payments were created. ${IMPORT_ACTION_COMPLETED_MESSAGE}`
        );
        return;
      }
      if (!confirmed) return;
      const response = await fetch("/api/import/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "import",
          rows: rawRows,
          confirmed: true,
          fileName,
          notes,
          expectedTotals: normalizedExpectedTotals(expectedTotals)
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Payment import failed");
      setResult(json.result);
      setLastBatchId(json.result.batchId);
      setReconciliation(json.result.reconciliation);
      setMessage(`Payment import completed. Review the result summary below. ${IMPORT_ACTION_COMPLETED_MESSAGE}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment import failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function requestPreview(rows: PaymentImportRow[]) {
    const response = await fetch("/api/import/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "preview", rows })
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || "Unable to preview payment import");
    return {
      preview: json.preview as PaymentImportPreview,
      reconciliation: json.reconciliation as PaymentReconciliation
    };
  }

  return (
    <>
      <section className="card card-pad">
        <div className="section-title inline-section-title">
          <div>
            <h3>Payment Import</h3>
            <p>Import one transaction per row from the school&apos;s Excel or CSV daily collection register.</p>
          </div>
          <a href="/import-verification">View Payment Verification History</a>
        </div>
        <div className="form-grid">
          <label className="wide">
            Payment Excel / CSV File
            <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} disabled={!canChangeImportInputs({ fileWorking })} />
          </label>
          <label>
            Import Mode
            <select value={mode} onChange={(event) => setMode(event.target.value as ImportMode)}>
              <option value="import-valid">Import valid rows</option>
              <option value="dry-run">Dry run / preview only</option>
            </select>
          </label>
          <label className="wide">
            Batch Notes (optional)
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: Trial against physical register for 18 June" />
          </label>
        </div>
        <p className="notice">
          sample-payments.csv intentionally contains 5 valid payment rows/components and 1 invalid row.
          Repeated imports can show duplicates unless pnpm pilot:reset-sample-data is used.
        </p>

        {preview ? (
          <>
            <div className="grid four" style={{ marginTop: 16 }}>
              <ImportCount label="Total Rows" value={preview.counts.total} />
              <ImportCount label="Ready" value={preview.counts.ready} />
              <ImportCount label="Duplicates" value={preview.counts.duplicates} />
              <ImportCount label="Rows with Errors" value={preview.counts.errors} />
            </div>
            {reconciliation ? (
              <ExpectedTotalsForm
                expectedTotals={expectedTotals}
                onChange={setExpectedTotals}
                reconciliation={reconciliation}
              />
            ) : null}
            <p className="muted-text">
              Repeated imports of the same sample file will show duplicates. Reset sample pilot data before rerunning the sample from a clean state.
            </p>
            <label className="review-checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={mode === "dry-run"}
              />
              <span>I reviewed the matched students, normalized rows, warnings, errors, and duplicates.</span>
            </label>
            <div className="top-actions" style={{ marginTop: 12 }}>
              <button
                onClick={runAction}
                disabled={isImportActionDisabled({
                  fileWorking,
                  pendingAction,
                  baseDisabled: preview.counts.total === 0 ||
                    (mode === "import-valid" && (!confirmed || preview.counts.ready === 0))
                })}
              >
                {pendingAction
                  ? pendingAction === "trial" ? "Saving Trial..." : "Importing..."
                  : mode === "dry-run"
                    ? "Save Trial Run (No Changes)"
                    : "Import Valid Payment Rows"}
              </button>
            </div>
          </>
        ) : null}
        {message ? <p className="notice" role="status">{message}</p> : null}
        {lastBatchId ? <p><a href={`/import-verification/${lastBatchId}`}>View saved verification batch</a></p> : null}
      </section>

      {reconciliation ? (
        <ReconciliationPanel
          reconciliation={reconciliation}
          expectedComparison={compareExpectedPaymentTotals(
            reconciliation,
            normalizedExpectedTotals(expectedTotals)
          )}
        />
      ) : null}
      {preview ? <PaymentPreview preview={preview} /> : null}
      {result ? <PaymentImportResultPanel result={result} /> : null}
    </>
  );
}

function PaymentPreview({ preview }: { preview: PaymentImportPreview }) {
  const rowWarnings = preview.rows.flatMap((row) =>
    row.warnings.map((warning) => `CSV Row ${row.rowNumber}: ${warning}`)
  );
  return (
    <section className="card">
      <div className="section-title">
        <div>
          <h3>Normalized Payment Preview — First 50 Rows</h3>
          <p>Same receipt numbers remain valid when amount, mode, or received account differs.</p>
          <p className="muted-text">CSV row numbers include the header row, so the first data row is row 2.</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>CSV Row</th><th>Date</th><th>Receipt</th><th>Adm No</th><th>Student</th>
              <th>Class</th><th>Amount</th><th>Mode</th><th>Account</th><th>Fee Type</th>
              <th>Term</th><th>Matched Student</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.slice(0, 50).map((row) => {
              const status = paymentImportRowStatus(row);
              return (
                <tr key={row.rowNumber}>
                  <td>{row.rowNumber}</td>
                  <td>{row.normalized.date || "—"}</td>
                  <td>{row.normalized.receiptNo || "—"}</td>
                  <td>{row.normalized.admissionNo || "—"}</td>
                  <td>{row.normalized.studentName || "—"}</td>
                  <td>{row.normalized.className || "—"}</td>
                  <td>{row.normalized.amountPaid || "—"}</td>
                  <td>{row.normalized.paymentMode || "—"}</td>
                  <td>{row.normalized.receivedAccount || "—"}</td>
                  <td>{row.normalized.feeType || "—"}</td>
                  <td>{row.normalized.termHint}</td>
                  <td>
                    {row.matchedStudent
                      ? `${row.matchedStudent.studentName} (${row.matchedStudent.admissionNo})`
                      : "—"}
                  </td>
                  <td>
                    <span className={`badge ${statusClass(status)}`}>{status}</span>
                    {row.errors.map((error) => <div className="error" key={error}>{error}</div>)}
                    {row.warnings.map((warning) => <div className="muted-text" key={warning}>{warning}</div>)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="card-pad">
        {preview.fileWarnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}
        {rowWarnings.length ? (
          <details>
            <summary>{rowWarnings.length} row warning(s)</summary>
            <ul>{rowWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function PaymentImportResultPanel({ result }: { result: PaymentImportResult }) {
  return (
    <section className="card card-pad">
      <div className="section-title inline-section-title">
        <div>
          <h3>Payment Import Result</h3>
          <p>
            Created {result.created}, skipped duplicates {result.skippedDuplicates},
            errors {result.errors.length}, warnings {result.warnings.length}.
          </p>
          <a href={`/import-verification/${result.batchId}`}>View Import Verification</a>
        </div>
        {result.errors.length ? (
          <button className="secondary" onClick={() => downloadErrorCsv(result.errors)}>
            Download Error CSV
          </button>
        ) : null}
      </div>
      <div className="grid four">
        <ImportCount label="Created" value={result.created} />
        <ImportCount label="Skipped Duplicates" value={result.skippedDuplicates} />
        <ImportCount label="Errors" value={result.errors.length} />
        <ImportCount label="Warnings" value={result.warnings.length} />
      </div>
      {result.warnings.length ? (
        <details style={{ marginTop: 16 }}>
          <summary>{result.warnings.length} warning(s)</summary>
          <ul>{result.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
        </details>
      ) : null}
      {result.errors.length ? (
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>CSV Row</th><th>Receipt</th><th>Adm No</th><th>Student</th>
                <th>Class</th><th>Amount</th><th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((error, index) => (
                <tr key={`${error.rowNumber}-${index}`}>
                  <td>{error.rowNumber}</td><td>{error.receiptNo}</td><td>{error.admissionNo}</td>
                  <td>{error.studentName}</td><td>{error.className}</td><td>{error.amountPaid}</td>
                  <td>{error.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function ExpectedTotalsForm({
  expectedTotals,
  onChange,
  reconciliation
}: {
  expectedTotals: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  reconciliation: PaymentReconciliation;
}) {
  const comparison = compareExpectedPaymentTotals(reconciliation, normalizedExpectedTotals(expectedTotals));
  const hasMismatch = comparison.some((row) => !row.matched);
  return (
    <div className="expected-totals">
      <h4>Optional Physical Register Totals</h4>
      <p>Compare against valid importable rows. A mismatch warns you but does not block import.</p>
      <div className="form-grid">
        {[...RECONCILIATION_ACCOUNTS, "Grand Total"].map((label) => (
          <label key={label}>
            Expected {label}
            <input
              type="number"
              min="0"
              step="0.01"
              value={expectedTotals[label] ?? ""}
              onChange={(event) => onChange({ ...expectedTotals, [label]: event.target.value })}
            />
          </label>
        ))}
      </div>
      {comparison.length ? (
        <p className={hasMismatch ? "mismatch-text" : "match-text"}>
          {hasMismatch ? "Warning: one or more expected totals do not match." : "Entered expected totals match."}
        </p>
      ) : null}
    </div>
  );
}

function ReconciliationPanel({
  reconciliation,
  expectedComparison,
  compact = false
}: {
  reconciliation: PaymentReconciliation;
  expectedComparison: ExpectedTotalsComparisonRow[];
  compact?: boolean;
}) {
  return (
    <section className="card card-pad">
      <div className="section-title inline-section-title">
        <div>
          <h3>Payment Reconciliation</h3>
          <p>Compare these figures with the physical Daily Fee Collection Register.</p>
        </div>
      </div>
      <div className="grid four">
        <MoneyStat label="Uploaded Total" value={reconciliation.uploadedTotalAmount} />
        <MoneyStat label="Valid Importable" value={reconciliation.validImportableTotalAmount} />
        <MoneyStat label="Duplicate Amount" value={reconciliation.skippedDuplicateAmount} />
        <MoneyStat label="Error Row Amount" value={reconciliation.errorRowAmount} />
        <MoneyStat label="Created Amount" value={reconciliation.createdAmount} />
        <div className="card stat"><span>Duplicate Rows</span><strong>{reconciliation.duplicateRows}</strong></div>
        <div className="card stat">
          <span>Date Range</span>
          <strong className="compact-stat">{reconciliation.dateRange.from || "—"} to {reconciliation.dateRange.to || "—"}</strong>
        </div>
      </div>
      <div className="grid two reconciliation-tables">
        <TotalsTable title="Amount by Received Account" values={reconciliation.amountByReceivedAccount} moneyValues />
        <TotalsTable title="Count by Received Account" values={reconciliation.countByReceivedAccount} />
        {!compact ? <TotalsTable title="Total by Date" values={reconciliation.totalByDate} moneyValues /> : null}
        {!compact ? <TotalsTable title="Total by Payment Mode" values={reconciliation.totalByPaymentMode} moneyValues /> : null}
        {!compact ? <TotalsTable title="Count by Payment Mode" values={reconciliation.countByPaymentMode} /> : null}
      </div>
      {expectedComparison.length ? (
        <div className="table-wrap expected-comparison">
          <table>
            <thead><tr><th>Expected Total</th><th>Expected</th><th>Actual Valid</th><th>Difference</th><th>Result</th></tr></thead>
            <tbody>
              {expectedComparison.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{money(row.expected)}</td>
                  <td>{money(row.actual)}</td>
                  <td className={row.matched ? "match-text" : "mismatch-text"}>{money(row.difference)}</td>
                  <td><span className={`badge ${row.matched ? "success" : "danger"}`}>{row.matched ? "Matched" : "Mismatch"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function MoneyStat({ label, value }: { label: string; value: number }) {
  return <div className="card stat"><span>{label}</span><strong>{money(value)}</strong></div>;
}

function TotalsTable({
  title,
  values,
  moneyValues = false
}: {
  title: string;
  values: Record<string, number>;
  moneyValues?: boolean;
}) {
  return (
    <div className="table-wrap compact-table">
      <table>
        <thead><tr><th>{title}</th><th>Total</th></tr></thead>
        <tbody>
          {Object.entries(values).map(([label, value]) => (
            <tr key={label}><td>{label}</td><td>{moneyValues ? money(value) : value}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImportCount({ label, value }: { label: string; value: number }) {
  return <div className="card stat"><span>{label}</span><strong>{value}</strong></div>;
}

function statusClass(status: ReturnType<typeof paymentImportRowStatus>) {
  if (status === "Ready") return "success";
  if (status === "Error") return "danger";
  return "warn";
}

function downloadErrorCsv(errors: PaymentImportErrorRow[]) {
  const headers: Array<keyof PaymentImportErrorRow> = [
    "rowNumber",
    "receiptNo",
    "admissionNo",
    "studentName",
    "className",
    "amountPaid",
    "reason",
    "originalValuesJson"
  ];
  const csv = [
    headers.join(","),
    ...errors.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "payment-import-errors.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
}

function normalizedExpectedTotals(values: Record<string, string>): ExpectedPaymentTotals {
  return Object.fromEntries(
    Object.entries(values)
      .filter(([, value]) => value.trim() !== "")
      .map(([label, value]) => [label, Number(value)])
      .filter(([, value]) => Number.isFinite(value as number))
  ) as ExpectedPaymentTotals;
}
