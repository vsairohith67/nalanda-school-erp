"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui";

type WorkspaceData = any;
type DialogState =
  | { kind: "submit"; componentIndexes: number[] }
  | { kind: "correction"; componentIndex: number }
  | null;

const ENTRY_STATES = ["NOT_ENTERED", "PRESENT", "ABSENT", "EXEMPT", "NOT_APPLICABLE"] as const;
const EDITABLE = new Set(["NOT_STARTED", "DRAFT", "VALIDATION_FAILED", "READY_TO_SUBMIT", "REOPENED"]);

function requestKey(prefix: string) {
  return `${prefix}:${crypto.randomUUID().replaceAll("-", "")}`;
}

function messageFrom(response: any, fallback: string) {
  return typeof response?.error === "string" ? response.error : fallback;
}

function entryKey(componentIndex: number, studentId: string) {
  return `${componentIndex}:${studentId}`;
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

export function GovernedMarkEntryGrid({ initialData }: { initialData: WorkspaceData }) {
  const [data, setData] = useState(initialData);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "NOT_ENTERED" | "SPECIAL">("ALL");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reason, setReason] = useState("");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editGeneration = useRef<Map<string, number>>(new Map());
  const workspace = data.selectedWorkspace;

  const validations = useMemo(() => {
    if (!workspace) return [];
    const issues: string[] = [];
    workspace.components.forEach((component: any) => {
      const maximum = Number(component.assignment.component.maximumMarks);
      const decimalPlaces = component.assignment.scheme.markDecimalPlaces;
      component.entries.forEach((entry: any) => {
        if (entry.entryState === "NOT_ENTERED") return;
        if (entry.entryState !== "PRESENT" && entry.marksObtained != null && entry.marksObtained !== "") {
          issues.push(`${component.assignment.component.name}: a non-present row carries marks.`);
          return;
        }
        if (entry.entryState === "PRESENT") {
          const raw = String(entry.marksObtained ?? "");
          const numeric = Number(raw);
          const decimals = raw.includes(".") ? raw.split(".")[1].length : 0;
          if (raw === "" || !Number.isFinite(numeric) || numeric < 0 || numeric > maximum || decimals > decimalPlaces) {
            issues.push(`${component.assignment.component.name}: one or more Present marks are invalid.`);
          }
        }
      });
    });
    return [...new Set(issues)];
  }, [workspace]);

  const visibleStudents = useMemo(() => {
    if (!workspace) return [];
    return workspace.students.filter((student: any) => {
      const entries = workspace.components.map((component: any) =>
        component.entries.find((entry: any) => entry.studentId === student.studentId)
      );
      if (filter === "NOT_ENTERED") return entries.some((entry: any) => entry?.entryState === "NOT_ENTERED");
      if (filter === "SPECIAL") {
        return entries.some((entry: any) => ["ABSENT", "EXEMPT", "NOT_APPLICABLE"].includes(entry?.entryState));
      }
      return true;
    });
  }, [filter, workspace]);

  const updateEntry = useCallback((
    componentIndex: number,
    studentId: string,
    patch: Record<string, unknown>
  ) => {
    const key = entryKey(componentIndex, studentId);
    editGeneration.current.set(key, (editGeneration.current.get(key) ?? 0) + 1);
    setData((current: any) => {
      if (!current.selectedWorkspace) return current;
      const next = structuredClone(current);
      const entry = next.selectedWorkspace.components[componentIndex].entries
        .find((row: any) => row.studentId === studentId);
      if (!entry) return current;
      Object.assign(entry, patch);
      return next;
    });
    setDirty((current) => new Set(current).add(key));
    setNotice(null);
    setError(null);
  }, []);

  const saveDrafts = useCallback(async (automatic = false) => {
    if (!workspace || saving || dirty.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      for (let componentIndex = 0; componentIndex < workspace.components.length; componentIndex += 1) {
        const component = data.selectedWorkspace.components[componentIndex];
        const dirtyRows = component.entries.filter((entry: any) =>
          dirty.has(entryKey(componentIndex, entry.studentId))
        );
        if (!dirtyRows.length || !EDITABLE.has(component.sheet?.status ?? "NOT_STARTED")) continue;
        const savedGenerations = new Map(
          dirtyRows.map((entry: any) => {
            const key = entryKey(componentIndex, entry.studentId);
            return [key, editGeneration.current.get(key) ?? 0] as const;
          })
        );
        const response = await fetch(`/api/exam-marks/sheets/${encodeURIComponent(component.assignment.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestKey: requestKey(automatic ? "autosave" : "save"),
            expectedSheetVersion: component.sheet?.version,
            expectedVersionNumber: component.sheet?.versionNumber,
            expectedOptimisticVersion: component.sheet?.optimisticVersion,
            rows: dirtyRows.map((entry: any) => ({
              studentId: entry.studentId,
              entryState: entry.entryState,
              marksObtained: entry.entryState === "PRESENT" ? entry.marksObtained : null,
              remarks: entry.remarks ?? null,
              expectedRowVersion: entry.rowVersion
            }))
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(messageFrom(result, "Draft save failed."));
        setData((current: any) => {
          const next = structuredClone(current);
          const target = next.selectedWorkspace.components[componentIndex];
          target.sheet = {
            ...(target.sheet ?? {}),
            id: result.sheetId,
            status: result.status,
            version: result.sheetVersion,
            versionNumber: result.versionNumber,
            optimisticVersion: result.optimisticVersion,
            savedAt: result.savedAt,
            correctionPending: false
          };
          const resultEntries = new Map(
            result.entries.map((entry: any) => [entry.studentId, entry])
          );
          target.entries = target.entries.map((localEntry: any) => {
            const serverEntry: any = resultEntries.get(localEntry.studentId);
            if (!serverEntry) return localEntry;
            const key = entryKey(componentIndex, localEntry.studentId);
            if (!savedGenerations.has(key)) return serverEntry;
            if ((editGeneration.current.get(key) ?? 0) === savedGenerations.get(key)) {
              return serverEntry;
            }
            return {
              ...serverEntry,
              entryState: localEntry.entryState,
              marksObtained: localEntry.marksObtained,
              remarks: localEntry.remarks
            };
          });
          return next;
        });
        setDirty((current) => {
          const next = new Set(current);
          dirtyRows.forEach((entry: any) => {
            const key = entryKey(componentIndex, entry.studentId);
            if ((editGeneration.current.get(key) ?? 0) === savedGenerations.get(key)) {
              next.delete(key);
            }
          });
          return next;
        });
      }
      setNotice(automatic ? "Draft autosaved." : "Draft saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Draft save failed.");
    } finally {
      setSaving(false);
    }
  }, [data, dirty, saving, workspace]);

  useEffect(() => {
    if (!dirty.size || saving) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void saveDrafts(true), 900);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [dirty, saveDrafts, saving]);

  async function chooseAssignment(assignmentId: string) {
    if (dirty.size) {
      setError("Save the current draft before changing assignment.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/exam-marks/teacher?assignmentId=${encodeURIComponent(assignmentId)}`, {
        cache: "no-store"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(messageFrom(result, "Assignment could not be loaded."));
      setData(result);
      setFilter("ALL");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assignment could not be loaded.");
    } finally {
      setSaving(false);
    }
  }

  async function submitSheets(indexes: number[]) {
    setSaving(true);
    setDialog(null);
    setError(null);
    try {
      for (const index of indexes) {
        const component = data.selectedWorkspace.components[index];
        const response = await fetch(`/api/exam-marks/sheets/${encodeURIComponent(component.assignment.id)}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestKey: requestKey("submit"),
            expectedSheetVersion: component.sheet?.version,
            expectedOptimisticVersion: component.sheet?.optimisticVersion
          })
        });
        const result = await response.json();
        if (!response.ok || result.submitted === false) {
          throw new Error(messageFrom(result, result.validationIssues?.join(" ") || "Submission failed."));
        }
        setData((current: any) => {
          const next = structuredClone(current);
          const target = next.selectedWorkspace.components[index];
          target.sheet.status = result.status;
          target.sheet.version = result.sheetVersion;
          target.sheet.optimisticVersion = result.optimisticVersion;
          target.sheet.savedAt = result.submittedAt;
          return next;
        });
      }
      setNotice("Final submission recorded. Submitted sheets are now read-only.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Submission failed.");
    } finally {
      setSaving(false);
    }
  }

  async function requestCorrection(componentIndex: number) {
    const component = data.selectedWorkspace.components[componentIndex];
    setSaving(true);
    try {
      const response = await fetch(`/api/exam-marks/sheets/${encodeURIComponent(component.assignment.id)}/correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestKey: requestKey("correction"), reason })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(messageFrom(result, "Correction request failed."));
      setData((current: any) => {
        const next = structuredClone(current);
        next.selectedWorkspace.components[componentIndex].sheet.status = "REOPEN_REQUESTED";
        next.selectedWorkspace.components[componentIndex].sheet.correctionPending = true;
        next.selectedWorkspace.components[componentIndex].sheet.version = result.sheetVersion;
        return next;
      });
      setDialog(null);
      setReason("");
      setNotice("Correction request sent for Principal review.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Correction request failed.");
    } finally {
      setSaving(false);
    }
  }

  function moveCell(event: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, componentIndex: number) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const rowDelta = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    const columnDelta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    const next = document.querySelector<HTMLInputElement>(
      `[data-mark-cell="${rowIndex + rowDelta}:${componentIndex + columnDelta}"]`
    );
    if (next) {
      event.preventDefault();
      next.focus();
      next.select();
    }
  }

  if (!workspace) {
    return <section className="card empty-state"><h3>No governed marks assignment</h3><p>{data.reason}</p></section>;
  }

  const primaryReady = workspace.components
    .map((component: any, index: number) => ({ component, index }))
    .filter(({ component }: any) =>
      component.assignment.role === "PRIMARY_SUBMITTER" &&
      ["READY_TO_SUBMIT", "DRAFT", "VALIDATION_FAILED", "REOPENED"].includes(component.sheet?.status ?? "NOT_STARTED")
    )
    .map(({ index }: any) => index);
  const entered = workspace.components.reduce((count: number, component: any) =>
    count + component.entries.filter((entry: any) => entry.entryState !== "NOT_ENTERED").length, 0);
  const required = workspace.students.length * workspace.components.length;

  return (
    <>
      <section className="card marks-command-bar">
        <label>
          Authorised assignment
          <select
            value={data.assignments.find((assignment: any) => assignment.workspaceKey === workspace.components[0].assignment.workspaceKey)?.id ?? ""}
            onChange={(event) => void chooseAssignment(event.target.value)}
            disabled={saving}
          >
            {data.assignments.map((assignment: any) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.examination.code} · {assignment.className}-{assignment.section} · {assignment.paper.name} · {assignment.component.name}
              </option>
            ))}
          </select>
        </label>
        <div className="marks-context">
          <strong>{workspace.examination.code} · {workspace.paper.subject} / {workspace.paper.name}</strong>
          <span>{workspace.academicYear} · Class {workspace.className}-{workspace.section} · Scheme v{workspace.components[0].assignment.scheme.versionNumber}</span>
        </div>
        <div className="marks-save-state" aria-live="polite">
          <strong>{entered}/{required}</strong>
          <span>{dirty.size ? `${dirty.size} unsaved` : saving ? "Saving…" : "All changes saved"}</span>
        </div>
      </section>

      <section className="card marks-toolbar">
        <div className="segmented-control" aria-label="Entry filter">
          <button type="button" className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}>All</button>
          <button type="button" className={filter === "NOT_ENTERED" ? "active" : ""} onClick={() => setFilter("NOT_ENTERED")}>Not entered</button>
          <button type="button" className={filter === "SPECIAL" ? "active" : ""} onClick={() => setFilter("SPECIAL")}>Absent / Exempt / N/A</button>
        </div>
        <div className="page-actions">
          <button type="button" className="button secondary" onClick={() => void saveDrafts(false)} disabled={!dirty.size || saving}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            className="button"
            disabled={dirty.size > 0 || validations.length > 0 || !primaryReady.length || saving}
            onClick={() => setDialog({ kind: "submit", componentIndexes: primaryReady })}
          >
            Final submit
          </button>
        </div>
      </section>

      {notice ? <div className="notice success" role="status">{notice}</div> : null}
      {error ? <div className="notice danger" role="alert">{error}</div> : null}
      {validations.length ? (
        <section className="notice warn" aria-label="Validation summary">
          <strong>Validation summary</strong>
          <ul>{validations.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </section>
      ) : null}

      <section className="card governed-marks-table-wrap">
        <table className="governed-marks-table">
          <thead>
            <tr>
              <th className="sticky-student">Student</th>
              <th className="sticky-reference">Reference</th>
              {workspace.components.map((component: any) => (
                <th key={component.assignment.id}>
                  <span>{component.assignment.component.name}</span>
                  <small>Max {component.assignment.component.maximumMarks} · {component.assignment.scheme.markDecimalPlaces} dp</small>
                  <StatusBadge status={component.sheet?.status ?? "NOT_STARTED"} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleStudents.map((student: any, rowIndex: number) => (
              <tr key={student.studentId}>
                <th className="sticky-student" scope="row">{student.studentName}</th>
                <td className="sticky-reference"><strong>{student.rollNo || "—"}</strong><small>{student.admissionNo}</small></td>
                {workspace.components.map((component: any, componentIndex: number) => {
                  const entry = component.entries.find((row: any) => row.studentId === student.studentId);
                  const editable = EDITABLE.has(component.sheet?.status ?? "NOT_STARTED");
                  const maximum = Number(component.assignment.component.maximumMarks);
                  const decimalPlaces = component.assignment.scheme.markDecimalPlaces;
                  const raw = String(entry?.marksObtained ?? "");
                  const numeric = Number(raw);
                  const invalid = entry?.entryState === "PRESENT" && (
                    raw === "" || !Number.isFinite(numeric) || numeric < 0 || numeric > maximum ||
                    (raw.includes(".") && raw.split(".")[1].length > decimalPlaces)
                  );
                  return (
                    <td key={component.assignment.id} className={invalid ? "cell-error" : ""}>
                      <select
                        aria-label={`${student.studentName} ${component.assignment.component.name} entry state`}
                        value={entry?.entryState ?? "NOT_ENTERED"}
                        disabled={!editable}
                        onChange={(event) => updateEntry(componentIndex, student.studentId, {
                          entryState: event.target.value,
                          marksObtained: event.target.value === "PRESENT" ? entry?.marksObtained ?? "" : null
                        })}
                      >
                        {ENTRY_STATES.map((state) => <option key={state} value={state}>{state.replaceAll("_", " ")}</option>)}
                      </select>
                      <input
                        data-mark-cell={`${rowIndex}:${componentIndex}`}
                        aria-label={`${student.studentName} ${component.assignment.component.name} marks`}
                        inputMode="decimal"
                        value={entry?.entryState === "PRESENT" ? raw : ""}
                        disabled={!editable || entry?.entryState !== "PRESENT"}
                        className={invalid ? "invalid" : ""}
                        onKeyDown={(event) => moveCell(event, rowIndex, componentIndex)}
                        onPaste={(event) => {
                          const pasted = event.clipboardData.getData("text").trim();
                          const value = Number(pasted);
                          const decimals = pasted.includes(".") ? pasted.split(".")[1].length : 0;
                          if (!Number.isFinite(value) || value < 0 || value > maximum || decimals > decimalPlaces || /\s/.test(pasted)) {
                            event.preventDefault();
                            setError(`Pasted marks must be a single number from 0 to ${maximum} with at most ${decimalPlaces} decimals.`);
                          }
                        }}
                        onChange={(event) => updateEntry(componentIndex, student.studentId, { marksObtained: event.target.value })}
                      />
                      {invalid ? <small className="field-error">Enter 0–{maximum}, up to {decimalPlaces} dp.</small> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!visibleStudents.length ? <p className="empty-table-note">No Students match this filter.</p> : null}
      </section>

      <section className="marks-version-footer">
        {workspace.components.map((component: any, index: number) => (
          <div key={component.assignment.id} className="card">
            <strong>{component.assignment.component.name}</strong>
            <span>Version {component.sheet?.versionNumber ?? 1} · {component.sheet?.savedAt ? `Saved ${formatSchoolTimestamp(component.sheet.savedAt)}` : "Not saved"}</span>
            {["SUBMITTED", "RESUBMITTED", "MODERATED", "LOCKED"].includes(component.sheet?.status) && component.assignment.role === "PRIMARY_SUBMITTER" ? (
              <button
                type="button"
                className="button secondary"
                disabled={component.sheet?.correctionPending || saving}
                onClick={() => setDialog({ kind: "correction", componentIndex: index })}
              >
                {component.sheet?.correctionPending ? "Correction pending" : "Request correction"}
              </button>
            ) : null}
          </div>
        ))}
      </section>

      {dialog ? (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog-card governed-marks-dialog" role="dialog" aria-modal="true" aria-labelledby="marks-dialog-title">
            <h3 id="marks-dialog-title">{dialog.kind === "submit" ? "Final submission" : "Request correction"}</h3>
            {dialog.kind === "submit" ? (
              <p>This freezes Teacher editing for the selected primary sheets. It does not publish a report card.</p>
            ) : (
              <label>
                Correction reason
                <textarea value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
              </label>
            )}
            <div className="page-actions">
              <button type="button" className="button secondary" onClick={() => { setDialog(null); setReason(""); }}>Cancel</button>
              {dialog.kind === "submit" ? (
                <button type="button" className="button" onClick={() => void submitSheets(dialog.componentIndexes)}>Submit final</button>
              ) : (
                <button type="button" className="button" disabled={!reason.trim()} onClick={() => void requestCorrection(dialog.componentIndex)}>
                  Send request
                </button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
