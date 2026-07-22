"use client";

import { useMemo, useState } from "react";
import {
  TIMETABLE_DAYS,
  validateDraftTimetable,
  type DraftEntry,
  type TimetableWarning
} from "@/lib/timetable";
import { useSecurityDialog } from "@/components/security-dialog-provider";

type Teacher = { id: string; name: string; shortName: string; isActive: boolean; maxPeriodsPerWeek: number; maxPeriodsPerDay: number | null };
type Subject = { id: string; name: string; shortName: string; isActive: boolean; allowConsecutivePeriods: boolean; isActivitySubject: boolean };
type ClassSection = { id: string; displayName: string; groupName: string; academicYear: string; isActive: boolean };
type Assignment = {
  id: string; academicYear: string; classSectionId: string; subjectId: string; teacherId: string;
  periodsPerWeek: number; allowConsecutiveOverride: boolean | null;
  teacher: Teacher; subject: Subject;
};
type Template = { id: string; academicYear: string; groupName: string; dayOfWeek: string; periodNumber: number | null; label: string; type: string; isTeachingPeriod: boolean; sortOrder: number; startTime: string; endTime: string };
type FixedPeriod = { id: string; academicYear: string; classSectionId: string | null; teacherId: string | null; subjectId: string | null; dayOfWeek: string; periodNumber: number; label: string; reason: string | null };
type Unavailability = { teacherId: string; dayOfWeek: string; periodNumber: number; reason: string | null };
type Draft = { id: string; academicYear: string; name: string; status: string; notes: string | null; entries: DraftEntry[]; updatedAt: Date | string };

export function TimetableBuilder(props: {
  academicYear: string;
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassSection[];
  assignments: Assignment[];
  templates: Template[];
  unavailability: Unavailability[];
  fixedPeriods: FixedPeriod[];
  initialDrafts: Draft[];
}) {
  const requestDialog = useSecurityDialog();
  const [drafts, setDrafts] = useState(props.initialDrafts);
  const [draftId, setDraftId] = useState(props.initialDrafts.find((row) => row.status === "ACTIVE")?.id ?? props.initialDrafts[0]?.id ?? "");
  const [classSectionId, setClassSectionId] = useState(props.classes.find((row) => row.isActive && row.academicYear === props.academicYear)?.id ?? "");
  const [teacherId, setTeacherId] = useState(props.teachers.find((row) => row.isActive)?.id ?? "");
  const [preview, setPreview] = useState<"class" | "teacher">("class");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const draft = drafts.find((row) => row.id === draftId);
  const selectedClass = props.classes.find((row) => row.id === classSectionId);
  const classAssignments = props.assignments.filter((row) => row.classSectionId === classSectionId);
  const entries = draft?.entries ?? [];
  const teachingSlots = useMemo(() => props.classes.flatMap((classSection) =>
    TIMETABLE_DAYS.flatMap((day) => teachingPeriods(props.templates, classSection.groupName, day).map((periodNumber) => ({
      classSectionId: classSection.id, dayOfWeek: day, periodNumber
    })))
  ), [props.classes, props.templates]);
  const fridayMaxPeriod = Math.max(0, ...props.templates.filter((row) => row.groupName === "FRIDAY" && row.isTeachingPeriod).map((row) => row.periodNumber ?? 0));
  const issues = validateDraftTimetable({
    entries,
    teachers: props.teachers,
    subjects: props.subjects,
    classSections: props.classes,
    assignments: props.assignments,
    unavailability: props.unavailability,
    fixedPeriods: props.fixedPeriods,
    teachingSlots,
    fridayMaxPeriod
  });
  const classAssignmentIds = new Set(classAssignments.map((row) => row.id));
  const visibleIssues = issues.filter((row) => preview === "teacher"
    ? row.entityId === teacherId || entries.some((entry) => entry.teacherId === teacherId && entry.id === row.entityId)
    : row.entityId === classSectionId || classAssignmentIds.has(row.entityId ?? "") || entries.some((entry) => entry.classSectionId === classSectionId && entry.id === row.entityId));
  const counts = assignmentUsage(entries);
  const archived = draft?.status === "ARCHIVED";

  async function request(url: string, method: string, body?: Record<string, unknown>) {
    setMessage(""); setError("");
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await response.json();
    if (!response.ok) {
      setError(json.error || "Unable to save timetable");
      return null;
    }
    return json;
  }

  async function createDraft() {
    const name = await requestDialog({ title: "Create timetable draft", message: "Enter a name for the new editable draft.", confirmLabel: "Create draft", input: { label: "Draft name", defaultValue: `Manual Draft ${drafts.length + 1}`, required: true, maxLength: 120 } });
    if (!name) return;
    const created = await request("/api/timetable/drafts", "POST", { academicYear: props.academicYear, name });
    if (!created) return;
    setDrafts((current) => [created, ...current]);
    setDraftId(created.id);
    setMessage("New timetable draft created.");
  }

  async function duplicateDraft() {
    if (!draft) return;
    const name = await requestDialog({ title: "Duplicate timetable draft", message: "Enter a name for the duplicated draft.", confirmLabel: "Duplicate draft", input: { label: "Draft name", defaultValue: `${draft.name} Copy`, required: true, maxLength: 120 } });
    if (!name) return;
    const created = await request("/api/timetable/drafts", "POST", { action: "duplicate", sourceId: draft.id, name });
    if (!created) return;
    setDrafts((current) => [created, ...current]);
    setDraftId(created.id);
    setMessage("Draft duplicated.");
  }

  async function updateDraft(action: string) {
    if (!draft) return;
    const body: Record<string, unknown> = { action };
    if (action === "rename") {
      const name = await requestDialog({ title: "Rename timetable draft", message: "Enter the replacement draft name.", confirmLabel: "Rename draft", input: { label: "Draft name", defaultValue: draft.name, required: true, maxLength: 120 } });
      if (!name) return;
      body.name = name;
    }
    const updated = await request(`/api/timetable/drafts/${draft.id}`, "PUT", body);
    if (!updated) return;
    setDrafts((current) => current.map((row) => row.id === updated.id ? updated : action === "activate" && row.academicYear === updated.academicYear && row.status === "ACTIVE" ? { ...row, status: "DRAFT" } : row));
    setMessage(action === "activate" ? "This is now the ACTIVE timetable." : action === "archive" ? "Draft archived." : action === "restore" ? "Draft restored for editing." : "Draft renamed.");
  }

  async function saveCell(dayOfWeek: string, periodNumber: number, value: CellValue) {
    if (!draft || !classSectionId) return;
    const saved = await request("/api/timetable/entries", "PUT", {
      draftId: draft.id, classSectionId, dayOfWeek, periodNumber, ...value
    });
    if (!saved) return;
    setDrafts((current) => current.map((row) => row.id !== draft.id ? row : {
      ...row,
      entries: [...row.entries.filter((entry) => !(entry.classSectionId === classSectionId && entry.dayOfWeek === dayOfWeek && entry.periodNumber === periodNumber)), saved]
    }));
    setMessage("Period saved.");
  }

  async function clearCell(dayOfWeek: string, periodNumber: number) {
    if (!draft) return;
    const cleared = await request("/api/timetable/entries", "DELETE", { draftId: draft.id, classSectionId, dayOfWeek, periodNumber });
    if (!cleared) return;
    setDrafts((current) => current.map((row) => row.id !== draft.id ? row : {
      ...row, entries: row.entries.filter((entry) => !(entry.classSectionId === classSectionId && entry.dayOfWeek === dayOfWeek && entry.periodNumber === periodNumber))
    }));
    setMessage("Period cleared.");
  }

  async function applyFixedPeriods() {
    if (!draft) return;
    const result = await request(`/api/timetable/drafts/${draft.id}/fixed-periods`, "POST");
    if (!result) return;
    setDrafts((current) => current.map((row) => row.id === draft.id ? { ...row, entries: result.entries } : row));
    setMessage(`${result.applied} fixed periods applied; ${result.skipped} existing periods left unchanged.`);
  }

  return <div className="grid timetable-builder">
    <section className="card card-pad builder-toolbar">
      <label>Academic Year<input value={props.academicYear} readOnly /></label>
      <label>Timetable Draft<select value={draftId} onChange={(event) => setDraftId(event.target.value)}><option value="">Create a draft first</option>{drafts.map((row) => <option value={row.id} key={row.id}>{row.name} — {row.status}</option>)}</select></label>
      <label>Class Section<select value={classSectionId} onChange={(event) => setClassSectionId(event.target.value)}>{props.classes.filter((row) => row.academicYear === props.academicYear).map((row) => <option value={row.id} key={row.id}>{row.displayName}{row.isActive ? "" : " (Inactive)"}</option>)}</select></label>
      <div className="page-actions builder-actions">
        <button onClick={createDraft}>New Draft</button>
        <button className="secondary" onClick={duplicateDraft} disabled={!draft}>Duplicate</button>
        <button className="secondary" onClick={() => updateDraft("rename")} disabled={!draft}>Rename</button>
        {archived ? <button onClick={() => updateDraft("restore")}>Restore Draft</button> : <button className="secondary" onClick={() => updateDraft("archive")} disabled={!draft}>Archive</button>}
        <button onClick={() => updateDraft("activate")} disabled={!draft || draft.status === "ACTIVE"}>Mark ACTIVE</button>
        <button className="secondary" onClick={applyFixedPeriods} disabled={!draft || archived}>Apply Fixed Periods</button>
      </div>
    </section>

    {message ? <div className="success-text" role="status">{message}</div> : null}
    {error ? <div className="error" role="alert">{error}</div> : null}
    {!draft ? <div className="empty-state card">Create a timetable draft to begin building the weekly grid.</div> : <>
      <div className="grid stats">
        <SimpleStat label="Draft Status" value={draft.status} tone={draft.status === "ACTIVE" ? "success" : draft.status === "ARCHIVED" ? "muted" : "warning"} />
        <SimpleStat label="Errors" value={String(issues.filter((row) => row.severity === "error").length)} tone="error" />
        <SimpleStat label="Warnings" value={String(issues.filter((row) => row.severity === "warning").length)} tone="warning" />
        <SimpleStat label="Placed Periods" value={String(entries.filter((row) => row.entryType !== "EMPTY").length)} tone="success" />
      </div>
      <div className="builder-tabs">
        <button className={preview === "class" ? "" : "secondary"} onClick={() => setPreview("class")}>Class Timetable</button>
        <button className={preview === "teacher" ? "" : "secondary"} onClick={() => setPreview("teacher")}>Teacher Timetable</button>
        {preview === "teacher" ? <label>Teacher<select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>{props.teachers.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label> : null}
      </div>
      {archived ? <div className="notice">This draft is archived and read-only. Restore it before making changes.</div> : null}
      {preview === "class" && selectedClass ? <ClassGrid
        classSection={selectedClass}
        assignments={classAssignments}
        entries={entries}
        templates={props.templates}
        assignmentCounts={counts}
        readOnly={archived}
        onSave={saveCell}
        onClear={clearCell}
      /> : <TeacherGrid teacher={props.teachers.find((row) => row.id === teacherId)} entries={entries} classes={props.classes} subjects={props.subjects} />}
      <div className="grid two builder-lower">
        <WorkloadPanel assignments={classAssignments} counts={counts} teacherCounts={teacherUsage(entries, props.teachers)} />
        <ConflictPanel issues={visibleIssues} />
      </div>
    </>}
  </div>;
}

type CellValue = { assignmentId: string | null; entryType: string; label: string | null; isLocked: boolean; notes: string | null };

function ClassGrid({ classSection, assignments, entries, templates, assignmentCounts, readOnly, onSave, onClear }: {
  classSection: ClassSection; assignments: Assignment[]; entries: DraftEntry[]; templates: Template[]; assignmentCounts: Map<string, number>; readOnly: boolean;
  onSave(day: string, period: number, value: CellValue): void; onClear(day: string, period: number): void;
}) {
  const maximum = Math.max(0, ...TIMETABLE_DAYS.flatMap((day) => teachingPeriods(templates, classSection.groupName, day)));
  return <section className="card">
    <div className="section-title"><div><h3>{classSection.displayName} Class Timetable</h3><p className="muted-text">Choose an assignment or mark the period Free, Activity, Fixed, or Empty.</p></div><span className="badge">{classSection.groupName}</span></div>
    <div className="table-wrap builder-grid-wrap"><table className="builder-grid-table">
      <thead><tr><th>Day</th>{Array.from({ length: maximum }, (_, index) => <th key={index}>Period {index + 1}</th>)}</tr></thead>
      <tbody>{TIMETABLE_DAYS.map((day) => {
        const dayPeriods = new Set(teachingPeriods(templates, classSection.groupName, day));
        const labels = nonTeachingLabels(templates, classSection.groupName, day);
        return <tr key={day}><th><strong>{titleCase(day)}</strong>{labels ? <small>{labels}</small> : null}</th>{Array.from({ length: maximum }, (_, index) => {
          const period = index + 1;
          if (!dayPeriods.has(period)) return <td className="closed-period" key={period}>Closed</td>;
          const entry = entries.find((row) => row.classSectionId === classSection.id && row.dayOfWeek === day && row.periodNumber === period);
          return <td key={period}><TimetableCell key={`${classSection.id}-${day}-${period}-${entry?.id ?? "empty"}-${entry?.assignmentId ?? ""}-${entry?.entryType ?? ""}-${entry?.isLocked ?? false}`} entry={entry} assignments={assignments} counts={assignmentCounts} readOnly={readOnly} onSave={(value) => onSave(day, period, value)} onClear={() => onClear(day, period)} /></td>;
        })}</tr>;
      })}</tbody>
    </table></div>
  </section>;
}

function TimetableCell({ entry, assignments, counts, readOnly, onSave, onClear }: {
  entry?: DraftEntry; assignments: Assignment[]; counts: Map<string, number>; readOnly: boolean; onSave(value: CellValue): void; onClear(): void;
}) {
  const [assignmentId, setAssignmentId] = useState(entry?.assignmentId ?? "");
  const [entryType, setEntryType] = useState(entry?.entryType ?? "EMPTY");
  const [locked, setLocked] = useState(Boolean(entry?.isLocked));
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const assignment = assignments.find((row) => row.id === assignmentId);
  const disabled = readOnly || Boolean(entry?.isLocked && locked);
  function chooseAssignment(value: string) {
    setAssignmentId(value);
    if (value) setEntryType("TEACHING");
  }
  return <div className={`timetable-cell ${entry?.isLocked ? "locked" : entry?.entryType === "EMPTY" || !entry ? "empty" : ""}`}>
    <select aria-label="Assignment" value={assignmentId} onChange={(event) => chooseAssignment(event.target.value)} disabled={disabled}>
      <option value="">No assignment</option>
      {assignments.map((row) => {
        const used = counts.get(row.id) ?? 0;
        return <option value={row.id} key={row.id}>{row.subject.name} — {row.teacher.name} — {used}/{row.periodsPerWeek} used{used >= row.periodsPerWeek ? " ⚠" : ""}</option>;
      })}
    </select>
    <select aria-label="Period type" value={entryType} onChange={(event) => setEntryType(event.target.value)} disabled={disabled}>
      <option value="TEACHING">Teaching</option><option value="FIXED">Fixed Period</option><option value="ACTIVITY">Activity</option>
      <option value="FREE">Free Period</option><option value="SUBSTITUTION">Substitution</option><option value="EMPTY">Empty</option>
    </select>
    {assignment ? <small>{assignment.subject.shortName} · {assignment.teacher.shortName}</small> : entry?.label ? <small>{entry.label}</small> : null}
    <details><summary>Notes & lock</summary><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" disabled={disabled} /><label className="checkbox-label"><input type="checkbox" checked={locked} onChange={(event) => setLocked(event.target.checked)} disabled={readOnly} /> Locked Period</label></details>
    <div className="cell-actions">
      <button onClick={() => onSave({ assignmentId: assignmentId || null, entryType, label: assignment?.subject.name ?? entry?.label ?? null, isLocked: locked, notes: notes || null })} disabled={readOnly}>Save</button>
      <button className="secondary" onClick={onClear} disabled={readOnly || Boolean(entry?.isLocked)}>Clear</button>
    </div>
  </div>;
}

function TeacherGrid({ teacher, entries, classes, subjects }: { teacher?: Teacher; entries: DraftEntry[]; classes: ClassSection[]; subjects: Subject[] }) {
  if (!teacher) return <div className="empty-state card">Select a teacher to preview their timetable.</div>;
  const rows = entries.filter((row) => row.teacherId === teacher.id);
  const maxPeriod = Math.max(8, ...rows.map((row) => row.periodNumber));
  return <section className="card"><div className="section-title"><h3>{teacher.name} Teacher Timetable</h3><span className="badge">{rows.length} periods</span></div>
    <div className="table-wrap builder-grid-wrap"><table className="builder-grid-table"><thead><tr><th>Day</th>{Array.from({ length: maxPeriod }, (_, index) => <th key={index}>Period {index + 1}</th>)}</tr></thead>
      <tbody>{TIMETABLE_DAYS.map((day) => <tr key={day}><th>{titleCase(day)}</th>{Array.from({ length: maxPeriod }, (_, index) => {
        const entry = rows.find((row) => row.dayOfWeek === day && row.periodNumber === index + 1);
        return <td key={index}>{entry ? <div className="teacher-preview-cell"><strong>{classes.find((row) => row.id === entry.classSectionId)?.displayName}</strong><small>{subjects.find((row) => row.id === entry.subjectId)?.name ?? entry.label ?? entry.entryType}</small></div> : <span className="muted-text">Free</span>}</td>;
      })}</tr>)}</tbody></table></div>
  </section>;
}

function WorkloadPanel({ assignments, counts, teacherCounts }: { assignments: Assignment[]; counts: Map<string, number>; teacherCounts: Map<string, number> }) {
  return <section className="card card-pad"><h3>Workload</h3><div className="workload-list">{assignments.map((row) => {
    const used = counts.get(row.id) ?? 0;
    const tone = used === row.periodsPerWeek ? "success" : used > row.periodsPerWeek ? "danger" : "warn";
    return <div className="load-row" key={row.id}><span><strong>{row.subject.name}</strong><br /><small>{row.teacher.name} · Required Periods {row.periodsPerWeek}</small></span><span className={`badge ${tone}`}>Placed Periods {used}</span></div>;
  })}</div><h4>Teacher-wise periods used in this draft</h4>{[...teacherCounts.entries()].map(([name, count]) => <div className="load-row" key={name}><span>{name}</span><strong>{count}</strong></div>)}</section>;
}

function ConflictPanel({ issues }: { issues: TimetableWarning[] }) {
  const errors = issues.filter((row) => row.severity === "error");
  const warnings = issues.filter((row) => row.severity === "warning");
  return <section className="card card-pad"><h3>Conflict Checker</h3><p><span className={`badge ${errors.length ? "danger" : "success"}`}>{errors.length} Conflicts</span> <span className={`badge ${warnings.length ? "warn" : "success"}`}>{warnings.length} Warnings</span></p>
    <div className="warning-list">{issues.slice(0, 30).map((row, index) => <div className={`notice ${row.severity === "error" ? "notice-danger" : "notice-warning"}`} key={`${row.code}-${index}`}><strong>{friendlyCode(row.code)}</strong><br />{row.message}</div>)}</div>
    {!issues.length ? <div className="notice">No conflicts or warnings for this view.</div> : null}
  </section>;
}

function SimpleStat({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "error" | "muted" }) {
  return <div className={`card stat builder-stat ${tone}`}><span>{label}</span><strong>{value}</strong></div>;
}

function teachingPeriods(templates: Template[], groupName: string, day: string) {
  let rows = templates.filter((row) => row.academicYear && row.isTeachingPeriod && row.dayOfWeek === day && (day === "FRIDAY" ? row.groupName === "FRIDAY" : row.groupName === groupName));
  if (!rows.length && day === "SATURDAY") rows = templates.filter((row) => row.isTeachingPeriod && row.dayOfWeek === "MONDAY" && row.groupName === groupName);
  return rows.map((row) => row.periodNumber).filter((value): value is number => Boolean(value)).sort((a, b) => a - b);
}

function nonTeachingLabels(templates: Template[], groupName: string, day: string) {
  let rows = templates.filter((row) => !row.isTeachingPeriod && row.dayOfWeek === day && (day === "FRIDAY" ? row.groupName === "FRIDAY" : row.groupName === groupName));
  if (!rows.length && day === "SATURDAY") rows = templates.filter((row) => !row.isTeachingPeriod && row.dayOfWeek === "MONDAY" && row.groupName === groupName);
  return rows.filter((row) => !["FIXED"].includes(row.type)).map((row) => row.label).join(" · ");
}

function assignmentUsage(entries: DraftEntry[]) {
  const map = new Map<string, number>();
  entries.filter((row) => row.assignmentId && ["TEACHING", "FIXED", "SUBSTITUTION"].includes(row.entryType)).forEach((row) => map.set(row.assignmentId!, (map.get(row.assignmentId!) ?? 0) + 1));
  return map;
}

function teacherUsage(entries: DraftEntry[], teachers: Teacher[]) {
  const map = new Map<string, number>();
  entries.filter((row) => row.teacherId && ["TEACHING", "FIXED", "SUBSTITUTION"].includes(row.entryType)).forEach((row) => {
    const name = teachers.find((teacher) => teacher.id === row.teacherId)?.name ?? row.teacherId!;
    map.set(name, (map.get(name) ?? 0) + 1);
  });
  return map;
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function friendlyCode(value: string) {
  return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
