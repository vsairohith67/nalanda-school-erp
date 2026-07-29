"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ATTENDANCE_STATUSES, localDateText, type AttendanceStatus } from "@/lib/student-attendance";
import { useSecurityDialog } from "@/components/security-dialog-provider";

type ScopeOption = {
  className: string;
  section: string;
  source: "TIMETABLE" | "SUBSTITUTE" | "LEADERSHIP_PERMISSION";
};
type Student = {
  id: string;
  admissionNo: string;
  studentName: string;
  rollNo: string | null;
  className: string;
  section: string | null;
};
type RecordRow = { studentId: string; status: string; remarks: string | null };
type Session = {
  id: string;
  status: string;
  updatedAt: string;
  submittedAt?: string | null;
  lockedAt?: string | null;
  records: RecordRow[];
};
const labels: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  HALF_DAY: "Half Day",
  EXCUSED: "Excused"
};

export function StudentAttendanceEntry({
  academicYear,
  initialClassSections,
  initialEmptyReason,
  canManage,
  canSubmit,
  canLock,
  canViewReports
}: {
  academicYear: string;
  initialClassSections: ScopeOption[];
  initialEmptyReason?: string | null;
  canManage: boolean;
  canSubmit: boolean;
  canLock: boolean;
  canViewReports: boolean;
}) {
  const requestDialog = useSecurityDialog();
  const today = localDateText();
  const first = initialClassSections[0];
  const [date, setDate] = useState(today);
  const [classSections, setClassSections] = useState(initialClassSections);
  const [className, setClassName] = useState(first?.className ?? "");
  const [section, setSection] = useState(first?.section ?? "");
  const [scopeReason, setScopeReason] = useState(initialEmptyReason ?? "");
  const [students, setStudents] = useState<Student[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [values, setValues] = useState<Record<string, { status: string; remarks: string }>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const sections = useMemo(
    () => classSections.filter((item) => item.className === className),
    [classSections, className]
  );
  const selectedScope = classSections.find(
    (item) => item.className === className && item.section === section
  );

  function hydrate(nextStudents: Student[], nextSession: Session | null) {
    setStudents(nextStudents);
    setSession(nextSession);
    setCorrectionMode(false);
    setValues(Object.fromEntries(nextStudents.map((student) => {
      const record = nextSession?.records?.find((row) => row.studentId === student.id);
      return [student.id, { status: record?.status ?? "", remarks: record?.remarks ?? "" }];
    })));
  }

  function selectionChanged() {
    hydrate([], null);
    setHasLoaded(false);
    setMessage("Selection changed. Select Load Attendance before marking students.");
  }

  async function loadScopes(nextDate: string) {
    setBusy(true);
    setMessage("");
    const query = new URLSearchParams({
      mode: "scopes",
      attendanceDate: nextDate,
      academicYear
    });
    const response = await fetch(`/api/attendance/students?${query}`, { cache: "no-store" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) {
      setClassSections([]);
      setClassName("");
      setSection("");
      setScopeReason(data.error || "No authorised attendance scope is available.");
      return;
    }
    const next = (data.classSections ?? []) as ScopeOption[];
    setClassSections(next);
    setScopeReason(data.emptyReason ?? "");
    const preferred = next.find((item) => item.className === className && item.section === section) ?? next[0];
    setClassName(preferred?.className ?? "");
    setSection(preferred?.section ?? "");
    if (!next.length) setMessage("No exact active timetable or confirmed substitute attendance scope is authorised for this date.");
  }

  async function load() {
    if (!className) return setMessage("No authorised class/section is available.");
    setBusy(true);
    setMessage("");
    const query = new URLSearchParams({ attendanceDate: date, className, section, academicYear });
    const response = await fetch(`/api/attendance/students?${query}`, { cache: "no-store" });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to load attendance");
    hydrate(data.students, data.session);
    setHasLoaded(true);
    setMessage(data.session
      ? `Loaded ${data.session.status.toLowerCase()} attendance.`
      : "No attendance session exists yet. Create a draft to begin.");
  }

  async function act(action: string) {
    if (action === "clear" && !await requestDialog({
      title: "Clear attendance draft?",
      message: "Every saved mark and remark in this draft will be cleared. This cannot be undone.",
      confirmLabel: "Clear draft"
    })) return;
    if (action === "lock" && !await requestDialog({
      title: "Lock attendance?",
      message: "It cannot be unlocked in the app after this submitted attendance is locked.",
      confirmLabel: "Lock attendance"
    })) return;
    let correctionReason: string | null = null;
    if (action === "correct") {
      correctionReason = await requestDialog({
        title: "Apply attendance correction?",
        message: "The submitted attendance will remain submitted. The reason, scope, actor, version, and number of changed rows will be added to append-only audit history.",
        confirmLabel: "Apply correction",
        input: {
          label: "Correction reason (12 to 500 characters)",
          required: true,
          maxLength: 500
        }
      });
      if (!correctionReason) return;
    }
    setBusy(true);
    setMessage("");
    const records = students.flatMap((student) => values[student.id]?.status
      ? [{
        studentId: student.id,
        status: values[student.id].status,
        remarks: values[student.id].remarks
      }]
      : []);
    const response = await fetch("/api/attendance/students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        attendanceDate: date,
        className,
        section,
        academicYear,
        records,
        expectedUpdatedAt: session?.updatedAt ?? null,
        correctionReason
      })
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setMessage(data.error || "Unable to update attendance");
    if (action === "clear") {
      setValues(Object.fromEntries(students.map((student) => [student.id, { status: "", remarks: "" }])));
    }
    await load();
    setMessage(action === "create"
      ? "Draft attendance created."
      : action === "save"
        ? "Draft attendance saved."
        : action === "submit"
          ? "Attendance submitted."
          : action === "correct"
            ? "Submitted attendance corrected with append-only audit evidence."
            : action === "lock"
              ? "Attendance locked. Normal edits are now blocked."
              : "Draft cleared.");
  }

  const editable = canManage && (
    !session ||
    session.status === "DRAFT" ||
    (session.status === "SUBMITTED" && correctionMode)
  );
  function markAll(status: AttendanceStatus | "") {
    setValues(Object.fromEntries(students.map((student) => [
      student.id,
      { status, remarks: values[student.id]?.remarks ?? "" }
    ])));
  }

  return <div className="attendance-stack">
    <section className="card card-pad attendance-scope">
      <label>Date
        <input
          type="date"
          value={date}
          onChange={(event) => {
            const nextDate = event.target.value;
            setDate(nextDate);
            selectionChanged();
            void loadScopes(nextDate);
          }}
        />
      </label>
      <label>Class
        <select
          value={className}
          onChange={(event) => {
            const next = event.target.value;
            setClassName(next);
            setSection(classSections.find((item) => item.className === next)?.section ?? "");
            selectionChanged();
          }}
        >
          <option value="">Choose class</option>
          {[...new Set(classSections.map((item) => item.className))].map((item) =>
            <option key={item}>{item}</option>
          )}
        </select>
      </label>
      <label>Section
        <select
          value={section}
          onChange={(event) => {
            setSection(event.target.value);
            selectionChanged();
          }}
        >
          {sections.map((item) =>
            <option key={`${item.className}-${item.section}`} value={item.section}>
              {item.section || "No section"}
            </option>
          )}
        </select>
      </label>
      <button type="button" onClick={load} disabled={busy || !className}>
        {busy ? "Working..." : "Load Attendance"}
      </button>
      {canViewReports
        ? <Link className="button secondary" href="/attendance/students/reports">Open Reports</Link>
        : null}
    </section>
    {selectedScope?.source === "SUBSTITUTE"
      ? <p className="notice"><strong>Dated substitute scope.</strong> This class and section are available only for the selected approved substitute date.</p>
      : null}
    {!classSections.length
      ? <section className="card empty-state">
        <h3>No authorised attendance scope</h3>
        <p>{scopeReason || "No exact active timetable or confirmed dated substitute assignment is available for this Teacher account and date."}</p>
      </section>
      : null}
    {message ? <p className="notice" role="status">{message}</p> : null}
    {className && !session && students.length > 0 && canManage
      ? <section className="card card-pad">
        <button type="button" onClick={() => act("create")} disabled={busy}>Create Draft Attendance</button>
      </section>
      : null}
    {session
      ? <section className="card card-pad attendance-state">
        <div>
          <strong>Status: <span className={`badge ${session.status === "DRAFT" ? "" : "success"}`}>{session.status}</span></strong>
          <p>{session.status === "DRAFT"
            ? "Editable working copy. Save as often as needed, then submit when complete."
            : session.status === "SUBMITTED"
              ? "Completed attendance. An authorised scoped correction requires a reason and current record version."
              : "Final attendance. Normal edits and corrections are blocked."}</p>
        </div>
        <div className="page-actions">
          {session.status === "SUBMITTED" && canManage
            ? correctionMode
              ? <button type="button" className="secondary" onClick={() => { hydrate(students, session); setMessage("Correction cancelled."); }}>Cancel Correction</button>
              : <button type="button" className="secondary" onClick={() => { setCorrectionMode(true); setMessage("Edit the submitted marks, then apply the reasoned correction."); }}>Correct Attendance</button>
            : null}
          {session.status === "SUBMITTED" && canLock
            ? <button type="button" onClick={() => act("lock")} disabled={busy || correctionMode}>Lock Attendance</button>
            : null}
        </div>
      </section>
      : null}
    {students.length
      ? <section className="card attendance-entry-card">
        <div className="section-title attendance-toolbar">
          <div><h3>Daily Attendance</h3><p>{students.length} active student{students.length === 1 ? "" : "s"}</p></div>
          {editable
            ? <div className="page-actions">
              <button type="button" className="secondary" onClick={() => markAll("PRESENT")}>Mark all Present</button>
              <button type="button" className="secondary" onClick={() => markAll("ABSENT")}>Mark all Absent</button>
              {session?.status === "DRAFT"
                ? <button type="button" className="danger" onClick={() => act("clear")} disabled={busy}>Clear draft</button>
                : null}
            </div>
            : null}
        </div>
        <div className="table-wrap">
          <table className="attendance-table">
            <thead><tr><th>Roll</th><th>Admission No.</th><th>Student</th><th>Status</th><th>Remarks</th></tr></thead>
            <tbody>{students.map((student) =>
              <tr key={student.id}>
                <td>{student.rollNo ?? "-"}</td>
                <td>{student.admissionNo}</td>
                <td><strong>{student.studentName}</strong></td>
                <td>
                  <select
                    aria-label={`Attendance for ${student.studentName}`}
                    disabled={!editable || busy}
                    value={values[student.id]?.status ?? ""}
                    onChange={(event) => setValues((current) => ({
                      ...current,
                      [student.id]: { ...current[student.id], status: event.target.value }
                    }))}
                  >
                    <option value="">Not marked</option>
                    {ATTENDANCE_STATUSES.map((status) =>
                      <option key={status} value={status}>{labels[status]}</option>
                    )}
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`Remarks for ${student.studentName}`}
                    disabled={!editable || busy}
                    maxLength={500}
                    value={values[student.id]?.remarks ?? ""}
                    onChange={(event) => setValues((current) => ({
                      ...current,
                      [student.id]: { ...current[student.id], remarks: event.target.value }
                    }))}
                    placeholder="Optional"
                  />
                </td>
              </tr>
            )}</tbody>
          </table>
        </div>
        {editable
          ? <div className="attendance-savebar">
            {session?.status === "SUBMITTED" && correctionMode
              ? <button type="button" onClick={() => act("correct")} disabled={busy}>
                {busy ? "Applying..." : "Apply Correction"}
              </button>
              : <>
                <button type="button" onClick={() => act("save")} disabled={busy}>
                  {busy ? "Saving..." : "Save Draft"}
                </button>
                {canSubmit
                  ? <button type="button" onClick={() => act("submit")} disabled={busy}>Submit Attendance</button>
                  : null}
              </>}
          </div>
          : null}
      </section>
      : hasLoaded
        ? <section className="card empty-state">
          <h3>No active students found</h3>
          <p>Inactive, left, deleted, and out-of-scope Students are excluded safely.</p>
        </section>
        : null}
  </div>;
}
