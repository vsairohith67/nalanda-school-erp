"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ATTENDANCE_STATUSES, localDateText, type AttendanceStatus } from "@/lib/student-attendance";
import { useSecurityDialog } from "@/components/security-dialog-provider";

type Student = { id: string; admissionNo: string; studentName: string; rollNo: string | null; className: string; section: string | null };
type RecordRow = { studentId: string; status: string; remarks: string | null };
type Session = { id: string; status: string; submittedAt?: string | null; lockedAt?: string | null; records: RecordRow[] };
const labels: Record<AttendanceStatus, string> = { PRESENT: "Present", ABSENT: "Absent", LATE: "Late", HALF_DAY: "Half Day", EXCUSED: "Excused" };

export function StudentAttendanceEntry({ academicYear, classSections, canManage, canSubmit, canLock, canViewReports }: {
  academicYear: string; classSections: Array<{ className: string; section: string }>; canManage: boolean; canSubmit: boolean; canLock: boolean; canViewReports: boolean;
}) {
  const requestDialog = useSecurityDialog();
  const today = localDateText(); const first = classSections[0];
  const [date, setDate] = useState(today); const [className, setClassName] = useState(first?.className ?? ""); const [section, setSection] = useState(first?.section ?? "");
  const [students, setStudents] = useState<Student[]>([]); const [session, setSession] = useState<Session | null>(null); const [values, setValues] = useState<Record<string, { status: string; remarks: string }>>({});
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [hasLoaded, setHasLoaded] = useState(false);
  const sections = useMemo(() => classSections.filter((item) => item.className === className), [classSections, className]);
  function hydrate(nextStudents: Student[], nextSession: Session | null) {
    setStudents(nextStudents); setSession(nextSession);
    setValues(Object.fromEntries(nextStudents.map((student) => { const record = nextSession?.records?.find((row) => row.studentId === student.id); return [student.id, { status: record?.status ?? "", remarks: record?.remarks ?? "" }]; })));
  }
  function selectionChanged() {
    hydrate([], null);
    setHasLoaded(false);
    setMessage("Selection changed. Select Load Attendance before marking students.");
  }
  async function load() {
    if (!className) return setMessage("No active class/section is available."); setBusy(true); setMessage("");
    const query = new URLSearchParams({ attendanceDate: date, className, section, academicYear }); const response = await fetch(`/api/attendance/students?${query}`); const data = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to load attendance"); hydrate(data.students, data.session); setHasLoaded(true); setMessage(data.session ? `Loaded ${data.session.status.toLowerCase()} attendance.` : "No attendance session exists yet. Create a draft to begin.");
  }
  async function act(action: string) {
    if (action === "clear" && !await requestDialog({ title: "Clear attendance draft?", message: "Every saved mark and remark in this draft will be cleared. This cannot be undone.", confirmLabel: "Clear draft" })) return;
    if (action === "lock" && !await requestDialog({ title: "Lock attendance?", message: "It cannot be unlocked in the app after this submitted attendance is locked.", confirmLabel: "Lock attendance" })) return;
    setBusy(true); setMessage(""); const records = students.flatMap((student) => values[student.id]?.status ? [{ studentId: student.id, status: values[student.id].status, remarks: values[student.id].remarks }] : []);
    const response = await fetch("/api/attendance/students", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, attendanceDate: date, className, section, academicYear, records }) }); const data = await response.json(); setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to update attendance");
    if (action === "clear") setValues(Object.fromEntries(students.map((student) => [student.id, { status: "", remarks: "" }])));
    await load(); setMessage(action === "create" ? "Draft attendance created." : action === "save" ? "Draft attendance saved." : action === "submit" ? "Attendance submitted." : action === "lock" ? "Attendance locked. Normal edits are now blocked." : "Draft cleared.");
  }
  const editable = canManage && (!session || session.status === "DRAFT");
  function markAll(status: AttendanceStatus | "") { setValues(Object.fromEntries(students.map((student) => [student.id, { status, remarks: values[student.id]?.remarks ?? "" }]))); }
  return <div className="attendance-stack">
    <section className="card card-pad attendance-scope">
      <label>Date<input type="date" value={date} onChange={(event) => { setDate(event.target.value); selectionChanged(); }} /></label>
      <label>Class<select value={className} onChange={(event) => { const next = event.target.value; setClassName(next); setSection(classSections.find((item) => item.className === next)?.section ?? ""); selectionChanged(); }}><option value="">Choose class</option>{[...new Set(classSections.map((item) => item.className))].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Section<select value={section} onChange={(event) => { setSection(event.target.value); selectionChanged(); }}>{sections.map((item) => <option key={`${item.className}-${item.section}`} value={item.section}>{item.section || "No section"}</option>)}</select></label>
      <button onClick={load} disabled={busy || !className}>{busy ? "Working..." : "Load Attendance"}</button>
      {canViewReports ? <Link className="button secondary" href="/attendance/students/reports">Open Reports</Link> : null}
    </section>
    {message ? <p className="notice" role="status">{message}</p> : null}
    {className && !session && students.length > 0 && canManage ? <section className="card card-pad"><button onClick={() => act("create")} disabled={busy}>Create Draft Attendance</button></section> : null}
    {session ? <section className="card card-pad attendance-state"><div><strong>Status: <span className={`badge ${session.status === "DRAFT" ? "" : "success"}`}>{session.status}</span></strong><p>{session.status === "DRAFT" ? "Editable working copy. Save as often as needed, then submit when complete." : session.status === "SUBMITTED" ? "Completed by staff. It cannot be edited; an authorized school leader may lock it." : "Final attendance. Normal edits are blocked."}</p></div>{session.status === "SUBMITTED" && canLock ? <button onClick={() => act("lock")} disabled={busy}>Lock Attendance</button> : null}</section> : null}
    {students.length ? <section className="card attendance-entry-card">
      <div className="section-title attendance-toolbar"><div><h3>Daily Attendance</h3><p>{students.length} active student{students.length === 1 ? "" : "s"}</p></div>{editable ? <div className="page-actions"><button className="secondary" onClick={() => markAll("PRESENT")}>Mark all Present</button><button className="secondary" onClick={() => markAll("ABSENT")}>Mark all Absent</button><button className="danger" onClick={() => act("clear")} disabled={!session || busy}>Clear draft</button></div> : null}</div>
      <div className="table-wrap"><table className="attendance-table"><thead><tr><th>Roll</th><th>Admission No.</th><th>Student</th><th>Status</th><th>Remarks</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{student.rollNo ?? "-"}</td><td>{student.admissionNo}</td><td><strong>{student.studentName}</strong></td><td><select aria-label={`Attendance for ${student.studentName}`} disabled={!editable || busy} value={values[student.id]?.status ?? ""} onChange={(event) => setValues((current) => ({ ...current, [student.id]: { ...current[student.id], status: event.target.value } }))}><option value="">Not marked</option>{ATTENDANCE_STATUSES.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select></td><td><input aria-label={`Remarks for ${student.studentName}`} disabled={!editable || busy} value={values[student.id]?.remarks ?? ""} onChange={(event) => setValues((current) => ({ ...current, [student.id]: { ...current[student.id], remarks: event.target.value } }))} placeholder="Optional" /></td></tr>)}</tbody></table></div>
      {editable ? <div className="attendance-savebar"><button onClick={() => act("save")} disabled={busy}>{busy ? "Saving..." : "Save Draft"}</button>{canSubmit ? <button onClick={() => act("submit")} disabled={busy}>Submit Attendance</button> : null}</div> : null}
    </section> : hasLoaded ? <section className="card empty-state"><h3>No active students found</h3><p>Check the class, section, academic year, or student status. Inactive, left, and deleted students are excluded safely.</p></section> : null}
  </div>;
}
