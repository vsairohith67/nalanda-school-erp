"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TIMETABLE_DAYS } from "@/lib/timetable";

type Option = { id: string; name?: string; displayName?: string };
type Unavailable = { id: string; dayOfWeek: string; periodNumber: number; reason: string | null; teacher: { name: string } };
type Fixed = { id: string; dayOfWeek: string; periodNumber: number; label: string; reason: string | null; teacher: { name: string } | null; subject: { name: string } | null; classSection: { displayName: string } | null };
type Template = { id: string; groupName: string; dayOfWeek: string; periodNumber: number | null; label: string; startTime: string; endTime: string; type: string; isDefault: boolean };

export function TimetableSettings({ teachers, subjects, classes, unavailable, fixedPeriods, templates }: {
  teachers: Option[]; subjects: Option[]; classes: Option[]; unavailable: Unavailable[]; fixedPeriods: Fixed[]; templates: Template[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>, resource: string) {
    event.preventDefault(); setError(""); setMessage("");
    const form = event.currentTarget;
    const response = await fetch(`/api/timetable/${resource}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
    const json = await response.json();
    if (!response.ok) return setError(json.error || "Unable to save");
    setMessage("Timetable rule saved"); form.reset(); router.refresh();
  }
  async function remove(resource: string, id: string) {
    const response = await fetch(`/api/timetable/${resource}/${id}`, { method: "DELETE" });
    const json = await response.json();
    if (!response.ok) return setError(json.error || "Unable to remove");
    setMessage("Rule removed"); router.refresh();
  }
  async function updateTemplate(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); setError(""); setMessage("");
    const response = await fetch(`/api/timetable/period-templates/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())) });
    const json = await response.json();
    if (!response.ok) return setError(json.error || "Unable to update period template");
    setMessage("Period template updated"); router.refresh();
  }
  return <div className="grid">
    {message ? <div className="success-text">{message}</div> : null}{error ? <div className="error">{error}</div> : null}
    <div className="grid two">
      <section className="card card-pad">
        <h3>Teacher Unavailability</h3><p className="muted-text">Use this when a teacher cannot teach a specific period.</p>
        <form className="form-grid timetable-rule-form" onSubmit={(event) => submit(event, "unavailability")}>
          <label>Teacher<select name="teacherId" required><option value="">Select teacher</option>{teachers.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
          <DayPeriod />
          <label className="full">Reason<input name="reason" placeholder="Department meeting, part-time availability..." /></label>
          <div className="page-actions full"><button>Add Unavailable Period</button></div>
        </form>
      </section>
      <section className="card card-pad">
        <h3>Fixed Period</h3><p className="muted-text">Reserve a known class, teacher, subject, or school activity before generation.</p>
        <form className="form-grid timetable-rule-form" onSubmit={(event) => submit(event, "fixed-periods")}>
          <input type="hidden" name="academicYear" value="2026-27" />
          <label>Class Section<select name="classSectionId"><option value="">Optional</option>{classes.map((row) => <option value={row.id} key={row.id}>{row.displayName}</option>)}</select></label>
          <label>Teacher<select name="teacherId"><option value="">Optional</option>{teachers.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
          <label>Subject<select name="subjectId"><option value="">Optional</option>{subjects.map((row) => <option value={row.id} key={row.id}>{row.name}</option>)}</select></label>
          <DayPeriod />
          <label>Label<input name="label" placeholder="House Activity" required /></label>
          <label className="wide">Reason<input name="reason" placeholder="Why this period is fixed" /></label>
          <div className="page-actions full"><button>Add Fixed Period</button></div>
        </form>
      </section>
    </div>
    <div className="grid two">
      <RuleTable title="Unavailable Periods" rows={unavailable.map((row) => ({ id: row.id, cells: [row.teacher.name, titleCase(row.dayOfWeek), `Period ${row.periodNumber}`, row.reason || "—"] }))} onRemove={(id) => remove("unavailability", id)} />
      <RuleTable title="Fixed Periods" rows={fixedPeriods.map((row) => ({ id: row.id, cells: [[row.classSection?.displayName, row.teacher?.name, row.subject?.name].filter(Boolean).join(" / ") || "School-wide", titleCase(row.dayOfWeek), `Period ${row.periodNumber}`, `${row.label}${row.reason ? ` — ${row.reason}` : ""}`] }))} onRemove={(id) => remove("fixed-periods", id)} />
    </div>
    <section className="card">
      <div className="section-title"><h3>Default Period Timing Templates</h3><span className="muted-text">Editable database defaults for 2026–27</span></div>
      <div className="table-wrap timetable-table"><table><thead><tr><th>Group</th><th>Day</th><th>Label</th><th>Time</th><th>Type</th><th>Manage</th></tr></thead><tbody>{templates.map((row) => <tr key={row.id}><td>{row.groupName}</td><td>{titleCase(row.dayOfWeek)}</td><td>{row.label}</td><td>{row.startTime}–{row.endTime}</td><td><span className="badge">{row.type}</span></td><td><details><summary>Edit</summary><form className="form-grid compact-form timetable-edit-form" onSubmit={(event) => updateTemplate(event, row.id)}><label>Label<input name="label" defaultValue={row.label} required /></label><label>Start Time<input name="startTime" type="time" defaultValue={row.startTime} required /></label><label>End Time<input name="endTime" type="time" defaultValue={row.endTime} required /></label><label>Period Number<input name="periodNumber" type="number" min="1" defaultValue={row.periodNumber ?? ""} /></label><label>Type<select name="type" defaultValue={row.type}><option>TEACHING</option><option>ASSEMBLY</option><option>BREAK</option><option>LUNCH</option><option>DIARY</option><option>FIXED</option><option>CLOSED</option></select></label><div className="page-actions full"><button>Save Template</button></div></form></details></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}

function DayPeriod() {
  return <><label>Day<select name="dayOfWeek" required>{TIMETABLE_DAYS.map((day) => <option value={day} key={day}>{titleCase(day)}</option>)}</select></label><label>Period<input name="periodNumber" type="number" min="1" max="12" required /></label></>;
}
function RuleTable({ title, rows, onRemove }: { title: string; rows: { id: string; cells: string[] }[]; onRemove(id: string): void }) {
  return <section className="card"><div className="section-title"><h3>{title}</h3></div>{rows.length ? <div className="table-wrap"><table><tbody>{rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}<td><button className="danger" onClick={() => onRemove(row.id)}>Remove</button></td></tr>)}</tbody></table></div> : <div className="empty-state">No rules added.</div>}</section>;
}
function titleCase(value: string) { return value[0] + value.slice(1).toLowerCase(); }
