"use client";

import Link from "next/link";
import { useState } from "react";
import {
  defaultGeneratorSettings,
  type GeneratorResult,
  type GeneratorSettings
} from "@/lib/timetable-generator";

type ClassSection = {
  id: string;
  academicYear: string;
  displayName: string;
  groupName: string;
  isActive: boolean;
};

type DraftOption = {
  id: string;
  academicYear: string;
  name: string;
  status: string;
  updatedAt: Date | string;
};

export function TimetableGenerator(props: {
  currentAcademicYear: string;
  classes: ClassSection[];
  drafts: DraftOption[];
}) {
  const academicYears = Array.from(new Set([
    props.currentAcademicYear,
    ...props.classes.map((row) => row.academicYear),
    ...props.drafts.map((row) => row.academicYear)
  ]));
  const [settings, setSettings] = useState<GeneratorSettings>(defaultGeneratorSettings(props.currentAcademicYear));
  const [preview, setPreview] = useState<GeneratorResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const activeClasses = props.classes.filter((row) => row.academicYear === settings.academicYear && row.isActive);
  const draftOptions = props.drafts.filter((row) => row.academicYear === settings.academicYear);

  function update<K extends keyof GeneratorSettings>(key: K, value: GeneratorSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setPreview(null);
    setMessage("");
    setError("");
  }

  async function run(action: "preview" | "save") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/timetable/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...settings,
          action,
          draftName: preview?.generatedDraftName
        })
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to generate timetable");
      if (action === "preview") {
        setPreview(json);
        setMessage("Preview generated in memory. No draft has been saved yet.");
      } else {
        setPreview(json.result);
        setMessage(json.message);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to generate timetable");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid generator-page">
    <section className="card card-pad generator-form">
      <div className="section-title inline-section-title">
        <div>
          <h3>Generation Settings</h3>
          <p className="muted-text">The generator always creates a new DRAFT and never edits the selected base draft.</p>
        </div>
      </div>
      <div className="form-grid generator-primary-fields">
        <label>Academic Year
          <select value={settings.academicYear} onChange={(event) => {
            const academicYear = event.target.value;
            setSettings(defaultGeneratorSettings(academicYear));
            setPreview(null);
          }}>
            {academicYears.map((year) => <option value={year} key={year}>{year}</option>)}
          </select>
        </label>
        <label>Generation Scope
          <select value={settings.scope} onChange={(event) => update("scope", event.target.value as GeneratorSettings["scope"])}>
            <option value="ALL">All class sections</option>
            <option value="CLASS">Selected class section</option>
            <option value="GROUP">Selected group</option>
          </select>
        </label>
        {settings.scope === "CLASS" ? <label>Class Section
          <select value={settings.classSectionId ?? ""} onChange={(event) => update("classSectionId", event.target.value || null)}>
            <option value="">Select class section</option>
            {activeClasses.map((row) => <option value={row.id} key={row.id}>{row.displayName}</option>)}
          </select>
        </label> : null}
        {settings.scope === "GROUP" ? <label>Class Group
          <select value={settings.groupName ?? ""} onChange={(event) => update("groupName", event.target.value || null)}>
            <option value="">Select group</option>
            {["LKG", "UKG", "I-V", "VI-X"].map((group) => <option value={group} key={group}>{group}</option>)}
          </select>
        </label> : null}
        <label>Optional Base Draft
          <select value={settings.baseDraftId ?? ""} onChange={(event) => {
            const baseDraftId = event.target.value || null;
            setSettings((current) => ({
              ...current,
              baseDraftId,
              respectLockedCells: true,
              copyManualEntries: baseDraftId ? current.copyManualEntries : false
            }));
            setPreview(null);
          }}>
            <option value="">None — generate from foundation data</option>
            {draftOptions.map((row) => <option value={row.id} key={row.id}>{row.name} — {row.status}</option>)}
          </select>
        </label>
      </div>
      <div className="generator-options">
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.respectLockedCells} disabled={Boolean(settings.baseDraftId)} onChange={(event) => update("respectLockedCells", event.target.checked)} />
          Respect locked cells
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.copyManualEntries} disabled={!settings.baseDraftId} onChange={(event) => update("copyManualEntries", event.target.checked)} />
          Copy manual unlocked entries
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.applyFixedPeriodsFirst} onChange={(event) => update("applyFixedPeriodsFirst", event.target.checked)} />
          Apply fixed periods first
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.avoidConsecutiveSameSubject} onChange={(event) => update("avoidConsecutiveSameSubject", event.target.checked)} />
          Avoid consecutive same subject
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.spreadSubjectsAcrossWeek} onChange={(event) => update("spreadSubjectsAcrossWeek", event.target.checked)} />
          Spread subjects across week
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={settings.avoidTeacherOverloadPerDay} onChange={(event) => update("avoidTeacherOverloadPerDay", event.target.checked)} />
          Avoid teacher overload per day
        </label>
      </div>
      <div className="notice notice-warning">
        <strong>Manual Review Required</strong><br />
        Automatic generation is an assistant, not magic. Review unresolved periods, warnings, teacher load, and every class before making the draft active later.
      </div>
      <div className="page-actions">
        <button onClick={() => run("preview")} disabled={busy}>{busy ? "Generating…" : "Generate Draft"}</button>
        <button className="secondary" onClick={() => run("save")} disabled={busy || !preview}>Save Generated Draft</button>
        <span className="muted-text">Make Active later from the Manual Builder after review.</span>
      </div>
    </section>

    {message ? <div className="success-text" role="status">{message}</div> : null}
    {error ? <div className="error" role="alert">{error}</div> : null}
    {preview ? <PreviewResult result={preview} /> : <div className="empty-state card">Choose the scope and settings, then select Generate Draft to see the Preview Result.</div>}
  </div>;
}

function PreviewResult({ result }: { result: GeneratorResult }) {
  const allWarnings = [...result.generationWarnings, ...result.validation.warnings.map((row) => row.message)];
  return <div className="grid generator-results">
    <section className="card card-pad">
      <div className="section-title inline-section-title">
        <div><h3>Preview Result</h3><p className="muted-text">{result.generatedDraftName}</p></div>
        <span className="badge warn">DRAFT — Manual Review Required</span>
      </div>
      <div className="grid stats generator-stats">
        <GeneratorStat label="Class Sections" value={result.summary.classSectionsProcessed} />
        <GeneratorStat label="Required Periods" value={result.summary.totalRequiredPeriods} />
        <GeneratorStat label="Placed Periods" value={result.summary.placedPeriods} tone="success" />
        <GeneratorStat label="Unresolved Periods" value={result.summary.unresolvedPeriods} tone={result.summary.unresolvedPeriods ? "danger" : "success"} />
        <GeneratorStat label="Hard Conflicts Avoided" value={result.summary.hardConflictsAvoided} />
        <GeneratorStat label="Validation Errors" value={result.summary.errors} tone={result.summary.errors ? "danger" : "success"} />
        <GeneratorStat label="Warnings" value={result.summary.warnings} tone={result.summary.warnings ? "warn" : "success"} />
      </div>
    </section>

    <div className="grid two">
      <section className="card card-pad">
        <h3>Class Completion</h3>
        {result.classCompletion.map((row) => <div className="load-row" key={row.classSectionId}>
          <span><strong>{row.classSection}</strong><br /><small>{row.placedPeriods} / {row.requiredPeriods} required periods</small></span>
          <span className={`badge ${row.completionPercentage === 100 ? "success" : "warn"}`}>{row.completionPercentage}%</span>
        </div>)}
      </section>
      <section className="card card-pad">
        <h3>Teacher Workload Summary</h3>
        {result.teacherWorkloads.map((row) => <details className="generator-workload" key={row.teacherId}>
          <summary><strong>{row.teacher}</strong> — {row.placedPeriods} / {row.maxPeriodsPerWeek} weekly periods</summary>
          <div className="generator-day-loads">{row.dailyLoads.map((day) => <span key={day.dayOfWeek}>{titleCase(day.dayOfWeek)}: {day.periods}{day.maximum ? ` / ${day.maximum}` : ""}</span>)}</div>
        </details>)}
        {!result.teacherWorkloads.length ? <p className="muted-text">No teacher periods were placed.</p> : null}
      </section>
    </div>

    <section className="card">
      <div className="section-title"><h3>Unresolved Periods</h3><span className={`badge ${result.unresolved.length ? "danger" : "success"}`}>{result.summary.unresolvedPeriods}</span></div>
      {result.unresolved.length ? <div className="table-wrap"><table>
        <thead><tr><th>Class Section</th><th>Subject</th><th>Teacher</th><th>Remaining</th><th>Reason</th></tr></thead>
        <tbody>{result.unresolved.map((row) => <tr key={row.assignmentId}>
          <td>{row.classSection}</td><td>{row.subject}</td><td>{row.teacher}</td><td>{row.remainingPeriods}</td><td>{row.reason}</td>
        </tr>)}</tbody>
      </table></div> : <div className="empty-state">All required periods were placed.</div>}
    </section>

    <div className="grid two">
      <section className="card card-pad">
        <h3>Errors</h3>
        <div className="warning-list">{result.validation.errors.slice(0, 40).map((row, index) =>
          <div className="notice notice-danger" key={`${row.code}-${index}`}><strong>{friendlyCode(row.code)}</strong><br />{row.message}</div>
        )}</div>
        {!result.validation.errors.length ? <div className="notice">No hard validation errors.</div> : null}
      </section>
      <section className="card card-pad">
        <h3>Warnings</h3>
        <div className="warning-list">{allWarnings.slice(0, 50).map((warning, index) =>
          <div className="notice notice-warning" key={index}>{warning}</div>
        )}</div>
        {!allWarnings.length ? <div className="notice">No warnings.</div> : null}
        {allWarnings.length > 50 ? <p className="muted-text">{allWarnings.length - 50} additional warnings are not shown in this compact preview.</p> : null}
      </section>
    </div>
    <div className="notice">
      Saved generated drafts remain editable in the <Link href="/timetable/builder"><strong>Manual Builder</strong></Link>. Resolve warnings there, then use Make Active later.
    </div>
  </div>;
}

function GeneratorStat({ label, value, tone = "" }: { label: string; value: number; tone?: "" | "success" | "warn" | "danger" }) {
  return <div className="card stat"><span>{label}</span><strong className={tone ? `${tone === "danger" ? "error" : tone === "success" ? "success-text" : ""}` : ""}>{value}</strong></div>;
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function friendlyCode(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
