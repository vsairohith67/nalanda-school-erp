"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, CheckCircle2, Clock3, Download, ShieldCheck, UserRoundCheck } from "lucide-react";

type Workspace = any;

export function ParentMeetingWorkspace({ initialData }: { initialData: Workspace }) {
  const [data, setData] = useState(initialData);
  const [selectedKey, setSelectedKey] = useState(initialData.meetings[0]?.publicKey ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [correctionKey, setCorrectionKey] = useState<string | null>(null);
  const selected = useMemo(() => data.meetings.find((meeting: any) => meeting.publicKey === selectedKey) ?? data.meetings[0] ?? null, [data, selectedKey]);
  const manage = data.capabilities.manage;
  const teacher = data.role === "TEACHER";
  const selectedParticipantHandles = selected?.participants?.map((participant: any) => participant.staffHandle) ?? [];
  const selectedPrimaryStaffHandle = selected?.participants?.find((participant: any) => participant.participantRole === "PRIMARY_STAFF")?.staffHandle ?? "";

  async function refresh() {
    const response = await fetch("/api/parent-meetings?limit=50", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Parent Meetings could not refresh.");
    setData(body);
    setSelectedKey((current: string | null) => body.meetings.some((meeting: any) => meeting.publicKey === current) ? current : body.meetings[0]?.publicKey ?? null);
    setCancelOpen(false);
    setCorrectionKey(null);
  }

  async function send(path: string, body: unknown, success: string) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The request failed safely.");
      await refresh(); setMessage({ tone: "success", text: success });
    } catch (error) { setMessage({ tone: "danger", text: error instanceof Error ? error.message : "The request failed safely." }); }
    finally { setBusy(false); }
  }

  async function createMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await send("/api/parent-meetings", { studentAdmissionNo: form.get("studentAdmissionNo"), academicYear: form.get("academicYear"), category: form.get("category"), subject: form.get("subject"), requestReason: form.get("requestReason") }, "Meeting record created. Add the governed schedule next.");
    formElement.reset();
  }

  async function scheduleMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    const participantStaffHandles = form.getAll("participants").map(String);
    await send(`/api/parent-meetings/${selected.publicKey}/schedule`, {
      expectedRowVersion: selected.rowVersion,
      scheduledStartAt: indiaOffset(String(form.get("scheduledStartAt"))),
      durationMinutes: Number(form.get("durationMinutes")),
      mode: form.get("mode"),
      locationReference: form.get("locationReference"),
      onlineReference: form.get("onlineReference"),
      primaryStaffHandle: form.get("primaryStaffHandle"),
      participantStaffHandles
    }, selected.schedule ? "Meeting rescheduled without a booking conflict." : "Meeting scheduled without a booking conflict.");
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await send(`/api/parent-meetings/${selected.publicKey}/notes`, { kind: form.get("kind"), body: form.get("body") }, "The append-only note was recorded.");
    formElement.reset();
  }

  async function correctNote(event: FormEvent<HTMLFormElement>, note: any) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    await send(`/api/parent-meetings/${selected.publicKey}/notes`, { kind: note.kind, body: form.get("correctedBody"), correctsNoteKey: note.publicKey, correctionReason: form.get("correctionReason") }, "The correction was appended without erasing the original note.");
  }

  async function createFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    await send(`/api/parent-meetings/${selected.publicKey}/follow-ups`, { internalDescription: form.get("internalDescription"), parentVisibleDescription: form.get("parentVisibleDescription"), responsibleStaffHandle: form.get("responsibleStaffHandle"), dueDate: form.get("dueDate") }, "Follow-up created inside Parent Meetings.");
    formElement.reset();
  }

  async function workflow(action: string) {
    if (!selected) return;
    const body: Record<string, unknown> = { action, expectedRowVersion: selected.rowVersion };
    if (action === "NO_SHOW") body.noShowState = "PARENT_NO_SHOW";
    if (action === "COMPLETE") body.followUpRequired = false;
    await send(`/api/parent-meetings/${selected.publicKey}/workflow`, body, `Meeting action ${action.replaceAll("_", " ").toLowerCase()} recorded.`);
  }

  async function cancelMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    await send(`/api/parent-meetings/${selected.publicKey}/workflow`, { action: "CANCEL", expectedRowVersion: selected.rowVersion, internalReason: form.get("internalReason"), parentSummary: form.get("parentSummary") }, "Meeting cancellation recorded with separate internal and Parent-visible reasons.");
  }

  async function markOwnAttendance(participant: any, status: "ATTENDED" | "ABSENT") {
    if (!selected) return;
    await send(`/api/parent-meetings/${selected.publicKey}/attendance`, { status, expectedRowVersion: participant.rowVersion, ...(manage ? { staffHandle: participant.staffHandle } : {}) }, "Participant attendance recorded.");
  }

  async function closeFollowUp(followUp: any) {
    await send(`/api/parent-meetings/follow-ups/${followUp.publicKey}/workflow`, { action: "DONE", expectedRowVersion: followUp.rowVersion }, "Follow-up completed once with history preserved.");
  }

  return <section className="parent-meeting-workspace" aria-label="Parent Meetings workspace">
    <div className="parent-meeting-guardrail"><ShieldCheck aria-hidden /><div><strong>Private, local and default-off</strong><span>Internal notes never enter Parent payloads. This module cannot change marks, attendance, timetable or Student progression.</span></div><span className="parent-meeting-flag">PARENT_MEETINGS_V1_5 · ON FOR THIS ENVIRONMENT</span></div>
    {message ? <div className={`parent-meeting-notice ${message.tone}`} role={message.tone === "danger" ? "alert" : "status"}>{message.text}<button type="button" aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button></div> : null}
    <div className="parent-meeting-metrics" aria-label="Meeting report summary">
      <Metric label="Pending" value={data.reports.pendingRequests} icon={<Clock3 aria-hidden />} />
      <Metric label="Upcoming" value={data.reports.upcoming} icon={<CalendarDays aria-hidden />} />
      <Metric label="Completed" value={data.reports.completed} icon={<CheckCircle2 aria-hidden />} />
      <Metric label="Open follow-ups" value={data.reports.openFollowUps} icon={<UserRoundCheck aria-hidden />} />
      <Metric label="Overdue" value={data.reports.overdueFollowUps} icon={<Clock3 aria-hidden />} danger />
    </div>
    <div className="parent-meeting-toolbar"><div><h2>{teacher ? "My assigned Parent meetings" : data.role === "DIRECTOR" ? "Parent meeting oversight" : "Parent meeting queue"}</h2><p>{data.pagination.total} authorised meeting record(s); lists are server-bounded to {data.pagination.limit}.</p></div>{manage ? <a className="button secondary" href="/api/parent-meetings/reports/export"><Download size={16} aria-hidden />Export safe CSV</a> : null}</div>
    {manage ? <details className="parent-meeting-create"><summary>Create leadership meeting</summary><form onSubmit={createMeeting}>
      <label>Student<select name="studentAdmissionNo" required defaultValue=""><option value="" disabled>Select active Student</option>{data.studentCandidates.map((student: any) => <option key={student.admissionNo} value={student.admissionNo}>{student.studentName} · {student.className}{student.section ? ` ${student.section}` : ""} · {student.admissionNo}</option>)}</select></label>
      <label>Academic year<input name="academicYear" defaultValue={data.studentCandidates[0]?.academicYear || "2026-27"} required /></label>
      <label>Category<select name="category" defaultValue="GENERAL_SCHOOL_DISCUSSION"><CategoryOptions /></select></label>
      <label className="wide">Subject<input name="subject" minLength={3} maxLength={180} required /></label>
      <label className="wide">Parent-safe description<textarea name="requestReason" maxLength={2000} rows={3} /></label>
      <button className="button" disabled={busy}>Create meeting record</button>
    </form></details> : null}
    <div className="parent-meeting-layout">
      <aside className="parent-meeting-list" aria-label="Authorised meetings">{data.meetings.length ? data.meetings.map((meeting: any) => <button type="button" className={meeting.publicKey === selected?.publicKey ? "selected" : ""} onClick={() => setSelectedKey(meeting.publicKey)} key={meeting.publicKey}><span><strong>{meeting.subject}</strong><small>{meeting.student.studentName} · {meeting.category.replaceAll("_", " ")}</small></span><Status value={meeting.status} />{meeting.schedule ? <time>{indiaDate(meeting.schedule.start)}</time> : <time>Not scheduled</time>}</button>) : <div className="parent-meeting-empty"><CalendarDays aria-hidden /><h3>No authorised meetings</h3><p>Requests and explicitly assigned meetings will appear here.</p></div>}</aside>
      <article className="parent-meeting-detail">{selected ? <>
        <header><div><span className="eyebrow">{selected.category.replaceAll("_", " ")}</span><h2>{selected.subject}</h2><p>{selected.student.studentName} · {selected.student.className}{selected.student.section ? ` ${selected.student.section}` : ""} · {selected.student.admissionNo}</p></div><Status value={selected.status} /></header>
        <dl className="parent-meeting-facts"><div><dt>Schedule</dt><dd>{selected.schedule ? indiaDate(selected.schedule.start) : "Awaiting schedule"}</dd></div><div><dt>Mode</dt><dd>{selected.schedule?.mode?.replaceAll("_", " ") || "Not set"}</dd></div><div><dt>Duration</dt><dd>{selected.schedule ? `${selected.schedule.durationMinutes} minutes` : "Not set"}</dd></div><div><dt>Location/reference</dt><dd>{selected.schedule?.location || selected.schedule?.onlineReference || "Not set"}</dd></div></dl>
        {selected.requestReason ? <section><h3>Parent-safe request context</h3><p className="preserve-text">{selected.requestReason}</p></section> : null}
        <section><h3>Participants</h3>{selected.participants.length ? <ul className="parent-meeting-participants">{selected.participants.map((participant: any) => <li key={participant.publicKey}><div><strong>{participant.name}</strong><span>{participant.designation} · {participant.participantRole.replaceAll("_", " ")}</span></div><Status value={participant.attendance} />{(manage || participant.own) ? <div className="inline-actions"><button type="button" disabled={busy} onClick={() => markOwnAttendance(participant, "ATTENDED")}>Attended</button><button type="button" disabled={busy} onClick={() => markOwnAttendance(participant, "ABSENT")}>Absent</button></div> : null}</li>)}</ul> : <p className="muted">No staff participant is assigned yet.</p>}</section>
        {manage ? <form key={selected.publicKey} className="parent-meeting-schedule" onSubmit={scheduleMeeting}><h3>{selected.schedule ? "Reschedule" : "Schedule"}</h3><label>School-local start<input type="datetime-local" name="scheduledStartAt" defaultValue={selected.schedule ? indiaInput(selected.schedule.start) : ""} required /></label><label>Duration (10–180 minutes)<input type="number" name="durationMinutes" min={10} max={180} defaultValue={selected.schedule?.durationMinutes ?? 30} required /></label><label>Mode<select name="mode" defaultValue={selected.schedule?.mode ?? "IN_PERSON"}><option>IN_PERSON</option><option>PHONE</option><option>ONLINE_REFERENCE</option></select></label><label>Location<input name="locationReference" maxLength={160} placeholder="Principal office" defaultValue={selected.schedule?.location ?? ""} /></label><label>Plain online reference<input name="onlineReference" maxLength={160} placeholder="Approved reference, no URL" defaultValue={selected.schedule?.onlineReference ?? ""} /></label><label>Primary staff<select name="primaryStaffHandle" required defaultValue={selectedPrimaryStaffHandle}><option value="" disabled>Select primary staff</option>{data.staffCandidates.map((staff: any) => <option value={staff.handle} key={staff.handle}>{staff.name} · {staff.designation}</option>)}</select></label><label className="wide">All participants<select name="participants" multiple size={Math.min(5, Math.max(2, data.staffCandidates.length))} required defaultValue={selectedParticipantHandles}>{data.staffCandidates.map((staff: any) => <option value={staff.handle} key={staff.handle}>{staff.name} · {staff.designation}</option>)}</select><small>Hold Ctrl to select additional authorised participants.</small></label><button className="button" disabled={busy}>Check conflicts and save schedule</button></form> : null}
        {manage ? <><div className="parent-meeting-actions"><button type="button" className="button secondary" disabled={busy || selected.status !== "REQUESTED"} onClick={() => workflow("START_SCHEDULING")}>Start scheduling</button><button type="button" className="button secondary" disabled={busy || selected.status !== "SCHEDULED"} onClick={() => workflow("CONFIRM")}>Confirm</button><button type="button" className="button" disabled={busy || !["SCHEDULED", "CONFIRMED"].includes(selected.status)} onClick={() => workflow("COMPLETE")}>Complete</button><button type="button" className="button secondary" disabled={busy || !["SCHEDULED", "CONFIRMED"].includes(selected.status)} onClick={() => workflow("NO_SHOW")}>No-show</button><button type="button" className="button danger" disabled={busy || ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(selected.status)} aria-expanded={cancelOpen} onClick={() => setCancelOpen((current) => !current)}>Cancel</button></div>{cancelOpen ? <form className="parent-meeting-cancel-form" onSubmit={cancelMeeting}><h3>Governed cancellation</h3><label className="wide">Internal cancellation reason<textarea name="internalReason" minLength={3} maxLength={500} required /></label><label className="wide">Parent-visible cancellation summary<textarea name="parentSummary" maxLength={500} /></label><button className="button danger" disabled={busy}>Record cancellation</button></form> : null}</> : null}
        {(manage || teacher) ? <form className="parent-meeting-note-form" onSubmit={addNote}><h3>Append a note</h3><label>Visibility<select name="kind" defaultValue={teacher ? "PARTICIPANT_INTERNAL" : "LEADERSHIP_PRIVATE"} disabled={teacher}>{teacher ? <option>PARTICIPANT_INTERNAL</option> : <><option>LEADERSHIP_PRIVATE</option><option>PARTICIPANT_INTERNAL</option><option>PARENT_VISIBLE_SUMMARY</option></>}</select></label><label className="wide">Note<textarea name="body" rows={4} maxLength={8000} required /></label><button className="button secondary" disabled={busy}>Record append-only note</button></form> : null}
        {selected.notes.length ? <section><h3>Authorised note history</h3><ol className="parent-meeting-history">{selected.notes.map((note: any) => <li key={note.publicKey}><div><Status value={note.kind} /><time>{indiaDate(note.createdAt)}</time></div><p className="preserve-text">{note.body}</p>{note.correctionReason ? <small>Correction: {note.correctionReason}</small> : null}{!note.corrected && (manage || note.own) ? <><button type="button" className="button secondary" disabled={busy} aria-expanded={correctionKey === note.publicKey} onClick={() => setCorrectionKey((current) => current === note.publicKey ? null : note.publicKey)}>Append correction</button>{correctionKey === note.publicKey ? <form className="parent-meeting-correction-form" onSubmit={(event) => correctNote(event, note)}><label>Corrected note text<textarea name="correctedBody" maxLength={8000} defaultValue={note.body} required /></label><label>Correction reason<textarea name="correctionReason" minLength={3} maxLength={500} required /></label><button className="button secondary" disabled={busy}>Preserve correction</button></form> : null}</> : null}</li>)}</ol></section> : null}
        {manage && selected.status === "COMPLETED" ? <form className="parent-meeting-followup-form" onSubmit={createFollowUp}><h3>Create follow-up</h3><label className="wide">Internal description<textarea name="internalDescription" maxLength={2000} required /></label><label className="wide">Parent-visible description<textarea name="parentVisibleDescription" maxLength={2000} /></label><label>Responsible staff<select name="responsibleStaffHandle" required defaultValue=""><option value="" disabled>Select responsible staff</option>{data.staffCandidates.map((staff: any) => <option value={staff.handle} key={staff.handle}>{staff.name}</option>)}</select></label><label>Due date<input type="date" name="dueDate" required /></label><button className="button" disabled={busy}>Create follow-up</button></form> : null}
        {selected.followUps.length ? <section><h3>Follow-ups</h3><ul className="parent-meeting-followups">{selected.followUps.map((followUp: any) => <li key={followUp.publicKey}><div>{followUp.internalDescription ? <strong>{followUp.internalDescription}</strong> : null}<span>{followUp.responsibleName} · due {indiaDay(followUp.dueDate)}</span>{followUp.parentVisibleDescription ? <small>Shared with Parent: {followUp.parentVisibleDescription}</small> : null}</div><Status value={followUp.status} />{followUp.status === "OPEN" && (manage || followUp.own) ? <button type="button" disabled={busy} onClick={() => closeFollowUp(followUp)}>Mark done</button> : null}</li>)}</ul></section> : null}
        {selected.events.length ? <details><summary>Governed event history ({selected.events.length})</summary><ol className="parent-meeting-events">{selected.events.map((event: any) => <li key={event.publicKey}><span>{event.eventType.replaceAll("_", " ")}</span><time>{indiaDate(event.occurredAt)}</time><small>{event.actorRole.replaceAll("_", " ")}</small></li>)}</ol></details> : null}
      </> : <div className="parent-meeting-empty"><CalendarDays aria-hidden /><h3>Select a meeting</h3></div>}</article>
    </div>
  </section>;
}

function Metric({ label, value, icon, danger = false }: { label: string; value: number; icon: ReactNode; danger?: boolean }) { return <div className={danger && value ? "danger" : ""}>{icon}<span>{label}</span><strong>{value}</strong></div>; }
function Status({ value }: { value: string }) { const good = ["COMPLETED", "CONFIRMED", "ATTENDED", "DONE", "PARENT_VISIBLE_SUMMARY"].includes(value); const bad = ["CANCELLED", "NO_SHOW", "ABSENT"].includes(value); return <span className={`parent-meeting-status ${good ? "good" : bad ? "bad" : "neutral"}`}>{value.replaceAll("_", " ")}</span>; }
function CategoryOptions() { return <><option>ACADEMIC_PROGRESS</option><option>ATTENDANCE</option><option>GENERAL_SCHOOL_DISCUSSION</option><option>ADMINISTRATIVE</option><option>PRINCIPAL_APPOINTMENT</option><option>OTHER</option></>; }
function indiaOffset(value: string) { return value ? `${value.length === 16 ? `${value}:00` : value}+05:30` : ""; }
function indiaDate(value: string) { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function indiaDay(value: string) { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(new Date(value)); }
function indiaInput(value: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
