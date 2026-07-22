"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; name?: string; displayName?: string; shortName?: string; isActive: boolean };
type Assignment = {
  id: string; academicYear: string; classSectionId: string; subjectId: string; teacherId: string;
  periodsPerWeek: number; allowConsecutiveOverride: boolean | null; notes: string | null;
  classSection: { displayName: string }; subject: { name: string; isActive: boolean; allowConsecutivePeriods: boolean };
  teacher: { name: string; isActive: boolean };
};

export function TimetableAssignments({ assignments, teachers, subjects, classes, warnings }: {
  assignments: Assignment[];
  teachers: Option[];
  subjects: Option[];
  classes: Option[];
  warnings: { code: string; message: string; severity: string; entityId?: string }[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function request(url: string, method: string, body?: Record<string, unknown>) {
    setMessage(""); setError("");
    const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const json = await response.json();
    if (!response.ok) { setError(json.error || "Unable to save assignment"); return false; }
    setMessage(method === "DELETE" ? "Assignment removed" : "Assignment saved");
    router.refresh(); return true;
  }
  async function save(event: React.FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await request(`/api/timetable/assignments${id ? `/${id}` : ""}`, id ? "PUT" : "POST", Object.fromEntries(new FormData(form).entries())) && !id) form.reset();
  }
  const grouped = assignments.reduce((map, row) => {
    const key = row.classSection.displayName;
    map.set(key, [...(map.get(key) ?? []), row]);
    return map;
  }, new Map<string, Assignment[]>());
  return <div className="grid">
    <form className="card card-pad form-grid" onSubmit={(event) => save(event)}>
      <h3 className="full form-heading">Assign Teacher + Subject + Weekly Periods</h3>
      <AssignmentFields teachers={teachers} subjects={subjects} classes={classes} />
      <div className="page-actions full"><button>Add Assignment</button></div>
    </form>
    {message ? <div className="success-text">{message}</div> : null}
    {error ? <div className="error">{error}</div> : null}
    {warnings.length ? <section className="card card-pad"><h3>Setup Warnings</h3><div className="warning-list">{warnings.map((warning, index) => <div className={`notice ${warning.severity === "error" ? "notice-danger" : ""}`} key={`${warning.code}-${index}`}><strong>{warning.code.replaceAll("_", " ")}</strong><br />{warning.message}</div>)}</div></section> : <div className="notice">No assignment workload warnings found.</div>}
    {[...grouped.entries()].map(([className, rows]) => <section className="card" key={className}>
      <div className="section-title"><h3>{className}</h3><span className="badge">{rows.reduce((sum, row) => sum + row.periodsPerWeek, 0)} periods / week</span></div>
      <div className="table-wrap timetable-table"><table><thead><tr><th>Subject</th><th>Teacher</th><th>Periods per Week</th><th>Consecutive Rule</th><th>Manage</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.id}>
          <td><strong>{row.subject.name}</strong>{!row.subject.isActive ? <><br /><span className="badge danger">Inactive</span></> : null}</td>
          <td>{row.teacher.name}{!row.teacher.isActive ? <><br /><span className="badge danger">Inactive</span></> : null}</td>
          <td>{row.periodsPerWeek}</td>
          <td>{row.allowConsecutiveOverride === null ? (row.subject.allowConsecutivePeriods ? "Subject default: allowed" : "Subject default: not allowed") : row.allowConsecutiveOverride ? "Allowed for this class" : "Not allowed"}</td>
          <td><details><summary>Edit</summary><form className="form-grid compact-form timetable-edit-form" onSubmit={(event) => save(event, row.id)}><AssignmentFields teachers={teachers} subjects={subjects} classes={classes} row={row} /><div className="page-actions full"><button>Save</button><button type="button" className="danger" onClick={() => request(`/api/timetable/assignments/${row.id}`, "DELETE")}>Remove</button></div></form></details></td>
        </tr>)}
      </tbody></table></div>
    </section>)}
    {!assignments.length ? <div className="empty-state card">No assignments yet. Add the weekly subject workload for each class section.</div> : null}
  </div>;
}

function AssignmentFields({ teachers, subjects, classes, row }: { teachers: Option[]; subjects: Option[]; classes: Option[]; row?: Assignment }) {
  return <>
    <input type="hidden" name="academicYear" value={row?.academicYear ?? "2026-27"} />
    <label>Class Section<select name="classSectionId" defaultValue={row?.classSectionId ?? ""} required><option value="">Select class</option>{classes.map((item) => <option value={item.id} key={item.id}>{item.displayName}{item.isActive ? "" : " (Inactive)"}</option>)}</select></label>
    <label>Subject<select name="subjectId" defaultValue={row?.subjectId ?? ""} required><option value="">Select subject</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.name}{item.isActive ? "" : " (Inactive)"}</option>)}</select></label>
    <label>Teacher<select name="teacherId" defaultValue={row?.teacherId ?? ""} required><option value="">Select teacher</option>{teachers.map((item) => <option value={item.id} key={item.id}>{item.name}{item.isActive ? "" : " (Inactive)"}</option>)}</select></label>
    <label>Periods per Week<input name="periodsPerWeek" type="number" min="1" defaultValue={row?.periodsPerWeek ?? ""} required /></label>
    <label>Consecutive Period Override<select name="allowConsecutiveOverride" defaultValue={row?.allowConsecutiveOverride === null || row?.allowConsecutiveOverride === undefined ? "" : String(row.allowConsecutiveOverride)}><option value="">Use subject default</option><option value="false">Do not allow</option><option value="true">Allow</option></select></label>
    <label className="wide">Notes<textarea name="notes" defaultValue={row?.notes ?? ""} /></label>
  </>;
}
