"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Teacher = {
  id: string; name: string; shortName: string; department: string | null; phone: string | null;
  maxPeriodsPerWeek: number; maxPeriodsPerDay: number | null; notes: string | null; isActive: boolean;
};
type Subject = {
  id: string; name: string; shortName: string; department: string | null; isLabSubject: boolean;
  isActivitySubject: boolean; allowConsecutivePeriods: boolean; notes: string | null; isActive: boolean;
};
type ClassSection = {
  id: string; academicYear: string; className: string; section: string; displayName: string; groupName: string; isActive: boolean;
};

export function TimetableMasterData(props:
  | { kind: "teachers"; rows: Teacher[] }
  | { kind: "subjects"; rows: Subject[] }
  | { kind: "classes"; rows: ClassSection[] }
) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>, id?: string) {
    event.preventDefault();
    setMessage(""); setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = Object.fromEntries(data.entries());
    for (const name of ["isLabSubject", "isActivitySubject", "allowConsecutivePeriods"]) {
      if (form.elements.namedItem(name)) body[name] = data.get(name) === "on" ? "true" : "false";
    }
    const response = await fetch(`/api/timetable/${props.kind}${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await response.json();
    if (!response.ok) return setError(json.error || "Unable to save");
    setMessage(id ? "Changes saved" : `${label(props.kind)} added`);
    if (!id) form.reset();
    router.refresh();
  }

  return (
    <div className="grid">
      <form className="card card-pad form-grid" onSubmit={(event) => save(event)}>
        <h3 className="full form-heading">Add {singleLabel(props.kind)}</h3>
        {props.kind === "teachers" ? <TeacherFields /> : null}
        {props.kind === "subjects" ? <SubjectFields /> : null}
        {props.kind === "classes" ? <ClassFields /> : null}
        <div className="page-actions full"><button>Add {singleLabel(props.kind)}</button></div>
      </form>
      {message ? <div className="success-text" role="status">{message}</div> : null}
      {error ? <div className="error" role="alert">{error}</div> : null}
      <section className="card">
        <div className="section-title"><h3>{props.rows.length} {label(props.kind)}</h3></div>
        {props.rows.length === 0 ? <div className="empty-state">No {label(props.kind).toLowerCase()} yet. Use the form above to add the first one.</div> : (
          <div className="table-wrap timetable-table">
            <table>
              <thead><tr>{headers(props.kind).map((header) => <th key={header}>{header}</th>)}</tr></thead>
              <tbody>
                {props.rows.map((row) => (
                  <tr key={row.id}>
                    {props.kind === "teachers" ? <TeacherCells row={row as Teacher} /> : null}
                    {props.kind === "subjects" ? <SubjectCells row={row as Subject} /> : null}
                    {props.kind === "classes" ? <ClassCells row={row as ClassSection} /> : null}
                    <td>
                      <details className="manage-user">
                        <summary>Edit</summary>
                        <form className="form-grid compact-form timetable-edit-form" onSubmit={(event) => save(event, row.id)}>
                          {props.kind === "teachers" ? <TeacherFields row={row as Teacher} /> : null}
                          {props.kind === "subjects" ? <SubjectFields row={row as Subject} /> : null}
                          {props.kind === "classes" ? <ClassFields row={row as ClassSection} /> : null}
                          <label>Status<select name="isActive" defaultValue={String(row.isActive)}><option value="true">Active</option><option value="false">Inactive</option></select></label>
                          <div className="page-actions full"><button>Save Changes</button></div>
                        </form>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function TeacherFields({ row }: { row?: Teacher }) {
  return <>
    <label>Teacher Name<input name="name" defaultValue={row?.name} required /></label>
    <label>Short Code<input name="shortName" defaultValue={row?.shortName} placeholder="e.g. RKS" required /></label>
    <label>Department<input name="department" defaultValue={row?.department ?? ""} /></label>
    <label>Phone<input name="phone" defaultValue={row?.phone ?? ""} /></label>
    <label>Max Periods per Week<input name="maxPeriodsPerWeek" type="number" min="1" defaultValue={row?.maxPeriodsPerWeek ?? 30} required /></label>
    <label>Max Periods per Day<input name="maxPeriodsPerDay" type="number" min="1" defaultValue={row?.maxPeriodsPerDay ?? ""} /></label>
    <label className="wide">Notes<textarea name="notes" defaultValue={row?.notes ?? ""} /></label>
  </>;
}

function SubjectFields({ row }: { row?: Subject }) {
  return <>
    <label>Subject Name<input name="name" defaultValue={row?.name} required /></label>
    <label>Short Code<input name="shortName" defaultValue={row?.shortName} placeholder="e.g. MATH" required /></label>
    <label>Department<input name="department" defaultValue={row?.department ?? ""} /></label>
    <label className="checkbox-label"><input name="isLabSubject" type="checkbox" defaultChecked={row?.isLabSubject} /> Lab Subject</label>
    <label className="checkbox-label"><input name="isActivitySubject" type="checkbox" defaultChecked={row?.isActivitySubject} /> Activity Subject</label>
    <label className="checkbox-label"><input name="allowConsecutivePeriods" type="checkbox" defaultChecked={row?.allowConsecutivePeriods} /> Allow Consecutive Periods</label>
    <label className="wide">Notes<textarea name="notes" defaultValue={row?.notes ?? ""} /></label>
  </>;
}

function ClassFields({ row }: { row?: ClassSection }) {
  return <>
    <label>Academic Year<input name="academicYear" defaultValue={row?.academicYear ?? "2026-27"} required /></label>
    <label>Class<input name="className" defaultValue={row?.className} placeholder="e.g. VI" required /></label>
    <label>Section<input name="section" defaultValue={row?.section} placeholder="Optional for LKG" /></label>
    <label>Class Group<select name="groupName" defaultValue={row?.groupName ?? "I-V"}><option>LKG</option><option>UKG</option><option>I-V</option><option>VI-X</option></select></label>
    <p className="muted-text full">Display name is created automatically from Class + Section.</p>
  </>;
}

function TeacherCells({ row }: { row: Teacher }) {
  return <><td><strong>{row.name}</strong><br /><span className="muted-text">{row.shortName}</span></td><td>{row.department || "—"}<br />{row.phone || ""}</td><td>{row.maxPeriodsPerWeek} / week<br /><span className="muted-text">{row.maxPeriodsPerDay ? `${row.maxPeriodsPerDay} / day` : "No daily limit"}</span></td><td><Status active={row.isActive} /></td></>;
}
function SubjectCells({ row }: { row: Subject }) {
  return <><td><strong>{row.name}</strong><br /><span className="muted-text">{row.shortName}</span></td><td>{row.department || "—"}</td><td>{[row.isLabSubject && "Lab", row.isActivitySubject && "Activity", row.allowConsecutivePeriods && "Consecutive allowed"].filter(Boolean).join(", ") || "Standard"}</td><td><Status active={row.isActive} /></td></>;
}
function ClassCells({ row }: { row: ClassSection }) {
  return <><td><strong>{row.displayName}</strong></td><td>{row.academicYear}</td><td>{row.groupName}</td><td><Status active={row.isActive} /></td></>;
}
function Status({ active }: { active: boolean }) { return <span className={`badge ${active ? "success" : "danger"}`}>{active ? "Active" : "Inactive"}</span>; }
function headers(kind: "teachers" | "subjects" | "classes") {
  return kind === "teachers" ? ["Teacher", "Department / Phone", "Teacher Load Limit", "Status", "Manage"] : kind === "subjects" ? ["Subject", "Department", "Rules", "Status", "Manage"] : ["Class Section", "Academic Year", "Group", "Status", "Manage"];
}
function label(kind: string) { return kind === "classes" ? "Class Sections" : kind[0].toUpperCase() + kind.slice(1); }
function singleLabel(kind: string) { return kind === "teachers" ? "Teacher" : kind === "subjects" ? "Subject" : "Class Section"; }
