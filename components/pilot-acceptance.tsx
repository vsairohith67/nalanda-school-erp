"use client";

import { useEffect, useMemo, useState } from "react";
import { money } from "@/lib/format";
import {
  buildPilotEvidenceSummary,
  comparePilotReconciliationTotals,
  emptyPilotAcceptanceState,
  parsePilotAcceptanceState,
  PILOT_ACCEPTANCE_NOTE_MAX_LENGTH,
  PILOT_ACCEPTANCE_SECTIONS,
  PILOT_ACCEPTANCE_STORAGE_KEY,
  pilotAcceptanceItemId,
  samplePilotDateWarning,
  samplePilotReconciliationSuccessMessage,
  type PilotEvidenceImportBatch,
  type PilotAcceptanceState,
  type PilotExpectedTotals,
  type PilotReconciliationTotals
} from "@/lib/pilot-acceptance";
import {
  PILOT_SAMPLE_DATE,
  PILOT_SAMPLE_EXPECTED_TOTALS
} from "@/lib/pilot-sample-constants";

const EMPTY_TOTALS: PilotReconciliationTotals = {
  cash: 0,
  directorGPay: 0,
  npsCurrentAccountUpi: 0,
  bankOther: 0,
  grandTotal: 0
};

export function PilotAcceptance({
  currentUserName,
  currentUserRole,
  databaseMode,
  sampleModeDetected,
  recentSampleImportBatches
}: {
  currentUserName?: string | null;
  currentUserRole?: string | null;
  databaseMode: "PILOT" | "NORMAL";
  sampleModeDetected: boolean;
  recentSampleImportBatches: PilotEvidenceImportBatch[];
}) {
  const [state, setState] = useState<PilotAcceptanceState>(emptyPilotAcceptanceState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(PILOT_ACCEPTANCE_STORAGE_KEY);
    const next = parsePilotAcceptanceState(stored);
    const legacyNotes = window.localStorage.getItem("nalanda-pilot-notes-v1");
    if (!stored && legacyNotes) next.notes.ui = legacyNotes;
    setState(next);
    setLoaded(true);
  }, []);

  function save(next: PilotAcceptanceState) {
    setState(next);
    window.localStorage.setItem(PILOT_ACCEPTANCE_STORAGE_KEY, JSON.stringify(next));
  }

  const totalItems = PILOT_ACCEPTANCE_SECTIONS.reduce((sum, section) => sum + section.items.length, 0);
  const completedItems = Object.values(state.completed).filter(Boolean).length;

  return (
    <div className="grid pilot-acceptance-root">
      <section className="card card-pad pilot-checklist-overview">
        <div className="section-title inline-section-title">
          <div>
            <h3>Pilot Acceptance Checklist</h3>
            <p>{completedItems} of {totalItems} checks completed in this browser.</p>
          </div>
          <span className={`badge ${completedItems === totalItems ? "success" : "warn"}`}>
            {completedItems === totalItems ? "Acceptance checks complete" : "Acceptance in progress"}
          </span>
        </div>
        <p className="muted-text">
          Pilot-only browser storage. No checklist result is written to the school database.
          Do not enter Student, Guardian, Staff, payment, credential, contact, or other sensitive data.
        </p>
      </section>

      {PILOT_ACCEPTANCE_SECTIONS.map((section) => (
        <section className="card card-pad acceptance-section" key={section.id}>
          <div className="section-title">
            <h3>{section.title}</h3>
          </div>
          <div className="checklist-grid">
            {section.items.map((label, index) => {
              const id = pilotAcceptanceItemId(section.id, index);
              return (
                <label className="checklist-item" key={id}>
                  <input
                    type="checkbox"
                    checked={state.completed[id] === true}
                    disabled={!loaded}
                    onChange={(event) => save({
                      ...state,
                      completed: { ...state.completed, [id]: event.target.checked }
                    })}
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
          <label className="pilot-notes">
            Section notes
            <textarea
              value={state.notes[section.id] ?? ""}
              disabled={!loaded}
              maxLength={PILOT_ACCEPTANCE_NOTE_MAX_LENGTH}
              placeholder="Record only non-sensitive evidence or follow-up. Do not enter personal, financial, contact, or credential data."
              onChange={(event) => save({
                ...state,
                notes: { ...state.notes, [section.id]: event.target.value }
              })}
            />
            <span>Copy sign-off evidence into the Pilot QA Report before clearing browser data.</span>
          </label>
        </section>
      ))}

      <PilotReconciliation
        acceptanceState={state}
        currentUserName={currentUserName}
        currentUserRole={currentUserRole}
        databaseMode={databaseMode}
        sampleModeDetected={sampleModeDetected}
        recentSampleImportBatches={recentSampleImportBatches}
      />
    </div>
  );
}

function PilotReconciliation({
  acceptanceState,
  currentUserName,
  currentUserRole,
  databaseMode,
  sampleModeDetected,
  recentSampleImportBatches
}: {
  acceptanceState: PilotAcceptanceState;
  currentUserName?: string | null;
  currentUserRole?: string | null;
  databaseMode: "PILOT" | "NORMAL";
  sampleModeDetected: boolean;
  recentSampleImportBatches: PilotEvidenceImportBatch[];
}) {
  const today = localDateInput();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [expected, setExpected] = useState<Record<keyof PilotExpectedTotals, string>>({
    cash: "",
    directorGPay: "",
    npsCurrentAccountUpi: "",
    bankOther: "",
    grandTotal: ""
  });
  const [actual, setActual] = useState<PilotReconciliationTotals>(EMPTY_TOTALS);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [evidenceGeneratedAt, setEvidenceGeneratedAt] = useState<string | null>(null);

  const expectedNumbers = useMemo(() => Object.fromEntries(
    Object.entries(expected).map(([key, value]) => [key, Number(value) || 0])
  ) as PilotExpectedTotals, [expected]);
  const rows = comparePilotReconciliationTotals(expectedNumbers, actual);
  const dateWarning = samplePilotDateWarning({ sampleModeDetected, from, to });
  const sampleSuccessMessage = hasLoaded
    ? samplePilotReconciliationSuccessMessage({ from, to, expected: expectedNumbers, actual })
    : "";
  const evidenceSummary = evidenceGeneratedAt
    ? buildPilotEvidenceSummary({
      generatedAt: new Date(evidenceGeneratedAt),
      currentUserName,
      currentUserRole,
      databaseMode,
      from,
      to,
      expected: expectedNumbers,
      actual,
      acceptanceState,
      recentSampleImportBatches
    })
    : null;

  function fillSampleExpectedTotals() {
    setExpected({
      cash: String(PILOT_SAMPLE_EXPECTED_TOTALS.cash),
      directorGPay: String(PILOT_SAMPLE_EXPECTED_TOTALS.directorGPay),
      npsCurrentAccountUpi: String(PILOT_SAMPLE_EXPECTED_TOTALS.npsCurrentAccountUpi),
      bankOther: String(PILOT_SAMPLE_EXPECTED_TOTALS.bankOther),
      grandTotal: String(PILOT_SAMPLE_EXPECTED_TOTALS.grandTotal)
    });
  }

  function useSampleDate() {
    setFrom(PILOT_SAMPLE_DATE);
    setTo(PILOT_SAMPLE_DATE);
  }

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/pilot-acceptance/reconciliation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      );
      const json = await response.json() as { totals?: PilotReconciliationTotals; error?: string };
      if (!response.ok || !json.totals) throw new Error(json.error || "Unable to load reconciliation totals");
      setActual(json.totals);
      setHasLoaded(true);
    } catch (error) {
      setHasLoaded(false);
      setMessage(error instanceof Error ? error.message : "Unable to load reconciliation totals");
    } finally {
      setLoading(false);
    }
  }

  function prepareEvidenceSummary() {
    setEvidenceGeneratedAt(new Date().toISOString());
  }

  function printEvidenceSummary() {
    document.body.classList.add("pilot-evidence-only-print");
    const cleanup = () => {
      document.body.classList.remove("pilot-evidence-only-print");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  return (
    <>
    <section className="card card-pad pilot-reconciliation-card">
      <div className="section-title inline-section-title">
        <div>
          <h3>Pilot Reconciliation</h3>
          <p>Read-only comparison against saved, active payment records in the selected date range.</p>
        </div>
      </div>
      <form className="pilot-reconciliation-form" onSubmit={(event) => { event.preventDefault(); load(); }}>
        <div className="notice">
          <strong>For sample pilot data, use these expected totals:</strong> Cash {money(PILOT_SAMPLE_EXPECTED_TOTALS.cash)},
          Director Sir GPay {money(PILOT_SAMPLE_EXPECTED_TOTALS.directorGPay)},
          NPS Current Account UPI {money(PILOT_SAMPLE_EXPECTED_TOTALS.npsCurrentAccountUpi)},
          Bank / Other {money(PILOT_SAMPLE_EXPECTED_TOTALS.bankOther)},
          Grand Total {money(PILOT_SAMPLE_EXPECTED_TOTALS.grandTotal)}.
          <div className="top-actions" style={{ marginTop: 10 }}>
            <button className="secondary" type="button" onClick={fillSampleExpectedTotals}>Fill Sample Expected Totals</button>
            <button className="secondary" type="button" onClick={useSampleDate}>Use Sample Date</button>
          </div>
        </div>
        <div className="form-grid">
          <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required /></label>
          <label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} required /></label>
          <label>Expected cash total<MoneyInput value={expected.cash} onChange={(value) => setExpected({ ...expected, cash: value })} /></label>
          <label>Expected Director Sir GPay total<MoneyInput value={expected.directorGPay} onChange={(value) => setExpected({ ...expected, directorGPay: value })} /></label>
          <label>Expected NPS Current Account UPI total<MoneyInput value={expected.npsCurrentAccountUpi} onChange={(value) => setExpected({ ...expected, npsCurrentAccountUpi: value })} /></label>
          <label>Expected bank/other total<MoneyInput value={expected.bankOther} onChange={(value) => setExpected({ ...expected, bankOther: value })} /></label>
          <label>Expected grand total<MoneyInput value={expected.grandTotal} onChange={(value) => setExpected({ ...expected, grandTotal: value })} /></label>
          <div className="reconciliation-load"><button disabled={loading}>{loading ? "Loading..." : "Compare Totals"}</button></div>
        </div>
      </form>
      <p className="muted-text">
        For generated sample data, use 20-06-2026 to 20-06-2026. For real school data, enter expected totals from the physical Daily Fee Collection Register. Bank / Other includes NPS Bank Account, Cheque, Other, and any account not matching the two named UPI accounts.
      </p>
      {dateWarning ? <p className="notice notice-warning" role="status">{dateWarning}</p> : null}
      {sampleSuccessMessage ? (
        <div className="notice success-notice" role="status">
          <strong>Sample pilot reconciliation matched on 20-06-2026.</strong>
          <div className="grid four" style={{ marginTop: 10 }}>
            <MoneyStat label="Cash" value={PILOT_SAMPLE_EXPECTED_TOTALS.cash} />
            <MoneyStat label="Director Sir GPay" value={PILOT_SAMPLE_EXPECTED_TOTALS.directorGPay} />
            <MoneyStat label="NPS Current Account UPI" value={PILOT_SAMPLE_EXPECTED_TOTALS.npsCurrentAccountUpi} />
            <MoneyStat label="Bank/Other" value={PILOT_SAMPLE_EXPECTED_TOTALS.bankOther} />
            <MoneyStat label="Grand Total" value={PILOT_SAMPLE_EXPECTED_TOTALS.grandTotal} />
          </div>
        </div>
      ) : null}
      {message ? <div className="error" role="alert">{message}</div> : null}
      {hasLoaded ? (
        <div className="table-wrap expected-comparison">
          <table>
            <thead><tr><th>Collection bucket</th><th>Expected</th><th>Actual</th><th>Actual - Expected</th><th>Result</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const matched = Math.abs(row.difference) < 0.01;
                return (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>{money(row.expected)}</td>
                    <td>{money(row.actual)}</td>
                    <td className={matched ? "match-text" : "mismatch-text"}>{money(row.difference)}</td>
                    <td><span className={`badge ${matched ? "success" : "danger"}`}>{matched ? "Matched" : "Mismatch"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="top-actions no-print" style={{ marginTop: 16 }}>
        <button type="button" className="secondary" onClick={prepareEvidenceSummary}>Prepare Evidence Summary</button>
        {evidenceSummary ? (
          <button type="button" onClick={printEvidenceSummary}>Print / Save Evidence PDF</button>
        ) : null}
      </div>
    </section>
    {evidenceSummary ? <PilotEvidenceSummarySection summary={evidenceSummary} /> : null}
    </>
  );
}

function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} />;
}

function MoneyStat({ label, value }: { label: string; value: number }) {
  return <div className="card stat"><span>{label}</span><strong>{money(value)}</strong></div>;
}

function PilotEvidenceSummarySection({
  summary
}: {
  summary: ReturnType<typeof buildPilotEvidenceSummary>;
}) {
  const matched = summary.resultLabel === "Matched";
  return (
    <section className="card card-pad pilot-evidence-print print-document">
      <div className="section-title inline-section-title">
        <div>
          <h3>Pilot Acceptance Evidence Summary</h3>
          <p>Prepared for one clean sign-off PDF.</p>
        </div>
        <span className={`badge ${matched ? "success" : "danger"}`}>{summary.resultLabel}</span>
      </div>

      <div className="system-info-grid evidence-meta">
        <div><span>Generated</span><strong>{summary.generatedAtText}</strong></div>
        <div><span>User / Role</span><strong>{summary.userText}</strong></div>
        <div><span>Database Mode</span><strong>{summary.databaseMode}</strong></div>
        <div><span>Date Range</span><strong>{summary.dateRangeText}</strong></div>
        <div><span>Checklist</span><strong>{summary.checklistCompleted} of {summary.checklistTotal}</strong></div>
        <div><span>Result</span><strong>{summary.resultLabel}</strong></div>
      </div>

      <div className="table-wrap expected-comparison">
        <table>
          <thead><tr><th>Collection bucket</th><th>Expected</th><th>Actual</th><th>Difference</th><th>Result</th></tr></thead>
          <tbody>
            {summary.rows.map((row) => {
              const rowMatched = Math.abs(row.difference) < 0.01;
              return (
                <tr key={row.key}>
                  <td>{row.label}</td>
                  <td>{money(row.expected)}</td>
                  <td>{money(row.actual)}</td>
                  <td className={rowMatched ? "match-text" : "mismatch-text"}>{money(row.difference)}</td>
                  <td>{rowMatched ? "Matched" : "Mismatch"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid two evidence-details">
        <div className="table-wrap compact-table">
          <table>
            <thead><tr><th>Section notes</th><th>Browser-local note</th></tr></thead>
            <tbody>
              {summary.sectionNotes.map((row) => (
                <tr key={row.title}>
                  <td>{row.title}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap compact-table">
          <table>
            <thead><tr><th>Recent sample import batches</th><th>Status</th><th>Counts</th></tr></thead>
            <tbody>
              {summary.recentSampleImportBatches.map((batch) => (
                <tr key={batch.id}>
                  <td>
                    <strong>{batch.fileName}</strong>
                    <div className="muted-text">{batch.type} / {batch.mode} / {formatEvidenceDateTime(batch.importedAt)}</div>
                    <div className="muted-text">By {batch.importedByName}</div>
                  </td>
                  <td>{batch.status.replaceAll("_", " ")}</td>
                  <td>
                    Total {batch.totalRows}, created {batch.createdCount}, updated {batch.updatedCount},
                    skipped {batch.skippedCount}, errors {batch.errorCount}, warnings {batch.warningCount}
                  </td>
                </tr>
              ))}
              {!summary.recentSampleImportBatches.length ? (
                <tr><td colSpan={3}>No sample import batches recorded yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p className="notice">{summary.safetyNote}</p>
      <p className="muted-text no-print">
        Use Print / Save Evidence PDF, then choose Save as PDF in the browser print dialog.
      </p>
    </section>
  );
}

function formatEvidenceDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function localDateInput(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
