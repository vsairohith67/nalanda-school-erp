"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { humanCalendarLabel, OPERATIONAL_DAY_TYPES, SCHOOL_EVENT_AUDIENCES, SCHOOL_EVENT_TYPES } from "@/lib/academic-calendar-shared";

type JsonMap = Record<string, any>;
type DayDraft = { key: string; dayDate: string; rangeEnd: string; dayType: string; title: string; scopeType: string; className: string; section: string; halfDaySession: string; publicInstructions: string; reason: string };

export function AcademicCalendarManagement({ options, versions, events, capabilities }: { options: JsonMap; versions: JsonMap[]; events: JsonMap[]; capabilities: string[] }) {
  const router = useRouter();
  const [view, setView] = useState<"DAYS" | "EVENTS" | "HISTORY">("DAYS");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [calendarEditor, setCalendarEditor] = useState<JsonMap | null>(null);
  const [eventEditor, setEventEditor] = useState(false);
  const [workflow, setWorkflow] = useState<{ kind: "calendar" | "event"; publicKey: string; action: string; expectedVersion: number; title: string } | null>(null);
  const [detail, setDetail] = useState<JsonMap | null>(null);
  const years: string[] = options.academicYears ?? [];
  const currentYear = years[0] ?? "";
  const can = (permission: string) => capabilities.includes(permission);
  const canCalendarAction = (action: string) => action === "approve" ? can("REVIEW_ACADEMIC_CALENDAR") : ["publish", "withdraw", "archive"].includes(action) ? can("PUBLISH_ACADEMIC_CALENDAR") : can("MANAGE_ACADEMIC_CALENDAR");
  const canEventAction = (action: string) => action === "approve" ? can("REVIEW_SCHOOL_EVENTS") : ["publish", "withdraw", "archive"].includes(action) ? can("PUBLISH_SCHOOL_EVENTS") : can("MANAGE_SCHOOL_EVENTS");

  async function request(url: string, init?: RequestInit) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Calendar request failed.");
      return body;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Calendar request failed safely.");
      throw caught;
    } finally { setBusy(false); }
  }

  async function createCalendar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await request("/api/academic-calendar/versions", { method: "POST", body: JSON.stringify(Object.fromEntries(data)) });
    setMessage("Academic calendar draft created."); router.refresh();
  }

  async function openCalendar(version: JsonMap) {
    const body = await request(`/api/academic-calendar/versions/${encodeURIComponent(version.publicKey)}`);
    setCalendarEditor(body.version); setDetail(null);
  }

  async function inspect(kind: "calendar" | "event", publicKey: string) {
    const url = kind === "calendar" ? `/api/academic-calendar/versions/${encodeURIComponent(publicKey)}` : `/api/school-calendar/events/${encodeURIComponent(publicKey)}`;
    const body = await request(url);
    setDetail(kind === "calendar" ? { kind, ...body.version } : { kind, ...body.event });
  }

  async function runWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!workflow) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const url = workflow.kind === "calendar" ? `/api/academic-calendar/versions/${encodeURIComponent(workflow.publicKey)}/workflow` : `/api/school-calendar/events/${encodeURIComponent(workflow.publicKey)}/workflow`;
    await request(url, { method: "POST", body: JSON.stringify({ ...data, action: workflow.action, expectedVersion: workflow.expectedVersion, idempotencyKey: crypto.randomUUID(), impactReason: data.reason }) });
    setWorkflow(null); setMessage(`${workflow.title}: ${humanCalendarLabel(workflow.action)} completed.`); router.refresh();
  }

  const calendarCounts = useMemo(() => ({ drafts: versions.filter((row) => row.status === "DRAFT").length, published: versions.filter((row) => row.status === "PUBLISHED").length, history: versions.filter((row) => ["REPLACED", "WITHDRAWN", "ARCHIVED"].includes(row.status)).length }), [versions]);

  return <div className="calendar-management">
    <div className="calendar-summary grid three" aria-label="Academic calendar summary">
      <Summary label="Draft calendars" value={calendarCounts.drafts} />
      <Summary label="Current publications" value={calendarCounts.published} />
      <Summary label="Historical versions" value={calendarCounts.history} />
    </div>
    <div className="calendar-tabs" role="tablist" aria-label="Calendar workspace">
      <button className={view === "DAYS" ? "active" : ""} role="tab" aria-selected={view === "DAYS"} onClick={() => setView("DAYS")}>Operational days</button>
      <button className={view === "EVENTS" ? "active" : ""} role="tab" aria-selected={view === "EVENTS"} onClick={() => setView("EVENTS")}>Informational events</button>
      <button className={view === "HISTORY" ? "active" : ""} role="tab" aria-selected={view === "HISTORY"} onClick={() => setView("HISTORY")}>Version history</button>
    </div>
    <div className="calendar-live" aria-live="polite">{busy ? "Working…" : message}{error ? <span className="error-text">{error}</span> : null}</div>

    {view === "DAYS" ? <>
      {can("MANAGE_ACADEMIC_CALENDAR") ? <section className="card card-pad">
        <h3>Create governed academic calendar</h3>
        <p>An informational event never changes these operational classifications.</p>
        <form className="form-grid calendar-form" onSubmit={(event) => void createCalendar(event)}>
          <label>Academic year<select name="academicYear" defaultValue={currentYear} required>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
          <label>Title<input name="title" maxLength={160} defaultValue={currentYear ? `${currentYear} Academic Calendar` : "Academic Calendar"} required /></label>
          <label>Effective scope<select name="effectiveScope" defaultValue="SCHOOL_WIDE"><option value="SCHOOL_WIDE">School wide</option><option value="CLASS">Class</option><option value="CLASS_SECTION">Class and section</option></select></label>
          <ClassFields options={options.classSections ?? []} year={currentYear} />
          <button className="button" disabled={busy}>Create draft</button>
        </form>
      </section> : <section className="notice">This view is read-only under your current governed permissions.</section>}
      <CalendarVersionList versions={versions.filter((row) => !["REPLACED", "WITHDRAWN", "ARCHIVED"].includes(row.status))} onEdit={openCalendar} onInspect={(key) => inspect("calendar", key)} onWorkflow={(item) => setWorkflow(item)} canEdit={can("MANAGE_ACADEMIC_CALENDAR")} actionAllowed={canCalendarAction} />
    </> : null}

    {view === "EVENTS" ? <>
      <section className="card card-pad calendar-event-intro"><div><h3>School events and deadlines</h3><p>Published audience is resolved on the server. Public website publishing, attachments, registration, payments and outbound messaging are unavailable.</p></div>{can("MANAGE_SCHOOL_EVENTS") ? <button className="button" onClick={() => setEventEditor(true)}>Create event</button> : null}</section>
      <EventList events={events.filter((row) => !["REPLACED", "WITHDRAWN", "ARCHIVED"].includes(row.status))} onInspect={(key) => inspect("event", key)} onWorkflow={(item) => setWorkflow(item)} actionAllowed={canEventAction} />
    </> : null}

    {view === "HISTORY" ? <section className="calendar-history-stack">
      <h3>Immutable and withdrawn history</h3>
      <CalendarVersionList versions={versions} onEdit={openCalendar} onInspect={(key) => inspect("calendar", key)} onWorkflow={(item) => setWorkflow(item)} canEdit={can("MANAGE_ACADEMIC_CALENDAR")} actionAllowed={canCalendarAction} compact />
      <EventList events={events} onInspect={(key) => inspect("event", key)} onWorkflow={(item) => setWorkflow(item)} actionAllowed={canEventAction} compact />
    </section> : null}

    {calendarEditor ? <CalendarEditor version={calendarEditor} options={options} busy={busy} onClose={() => setCalendarEditor(null)} onSaved={(text) => { setCalendarEditor(null); setMessage(text); router.refresh(); }} onRequest={request} /> : null}
    {eventEditor ? <EventEditor options={options} busy={busy} onClose={() => setEventEditor(false)} onCreated={() => { setEventEditor(false); setMessage("Event draft created. Review its exact audience before publication."); router.refresh(); }} onRequest={request} /> : null}
    {workflow ? <WorkflowDialog workflow={workflow} busy={busy} onClose={() => setWorkflow(null)} onSubmit={runWorkflow} /> : null}
    {detail ? <DetailDialog detail={detail} onClose={() => setDetail(null)} /> : null}
  </div>;
}

function Summary({ label, value }: { label: string; value: number }) { return <section className="card stat"><span>{label}</span><strong>{value}</strong></section>; }

function ClassFields({ options, year }: { options: JsonMap[]; year: string }) {
  const filtered = options.filter((row) => !year || row.academicYear === year);
  return <><label>Class<select name="className" defaultValue=""><option value="">Not applicable</option>{[...new Set(filtered.map((row) => row.className))].map((value) => <option key={value}>{value}</option>)}</select></label><label>Section<select name="section" defaultValue=""><option value="">Not applicable</option>{[...new Set(filtered.map((row) => row.section))].map((value) => <option key={value}>{value}</option>)}</select></label></>;
}

function CalendarVersionList({ versions, onEdit, onInspect, onWorkflow, canEdit, actionAllowed, compact = false }: { versions: JsonMap[]; onEdit: (row: JsonMap) => void; onInspect: (key: string) => void; onWorkflow: (value: any) => void; canEdit: boolean; actionAllowed: (action: string) => boolean; compact?: boolean }) {
  if (!versions.length) return <section className="card card-pad empty-state"><h3>No calendar versions here</h3><p>Create a draft or change the history filter.</p></section>;
  return <div className="calendar-version-grid">{versions.map((row) => {
    const totals = countDays(row.days ?? []);
    return <article className="card card-pad calendar-version-card" key={row.publicKey}>
      <header><div><span className="eyebrow">Version {row.versionNumber} · {humanCalendarLabel(row.effectiveScope)}</span><h3>{row.title}</h3><p>{row.academicYear}{row.className ? ` · ${row.className}${row.section ? `-${row.section}` : ""}` : ""}</p></div><span className={`badge ${row.status === "PUBLISHED" ? "success" : row.status === "WITHDRAWN" ? "danger" : ""}`}>{humanCalendarLabel(row.status)}</span></header>
      {!compact ? <dl className="calendar-totals"><div><dt>Working</dt><dd>{totals.working}</dd></div><div><dt>Non-working</dt><dd>{totals.nonWorking}</dd></div><div><dt>Half-days</dt><dd>{totals.halfDays}</dd></div><div><dt>Vacations</dt><dd>{totals.vacations}</dd></div></dl> : null}
      {row.attendanceReconciliationRequired ? <p className="notice warning-text">Attendance reconciliation may be required. Existing records are preserved.</p> : null}
      <div className="page-actions calendar-actions">
        {row.status === "DRAFT" && canEdit ? <button className="button secondary" onClick={() => onEdit(row)}>Edit classifications</button> : null}
        <button className="button secondary" onClick={() => onInspect(row.publicKey)}>Impact and history</button>
        {calendarActions(row).filter(actionAllowed).map((action) => <button className="button" key={action} onClick={() => onWorkflow({ kind: "calendar", publicKey: row.publicKey, expectedVersion: row.version, action, title: row.title })}>{humanCalendarLabel(action)}</button>)}
      </div>
    </article>;
  })}</div>;
}

function EventList({ events, onInspect, onWorkflow, actionAllowed, compact = false }: { events: JsonMap[]; onInspect: (key: string) => void; onWorkflow: (value: any) => void; actionAllowed: (action: string) => boolean; compact?: boolean }) {
  if (!events.length) return <section className="card card-pad empty-state"><h3>No events here</h3><p>Draft and published informational events remain separate from operational days.</p></section>;
  return <div className="calendar-version-grid">{events.map((base) => { const row = base.versions?.[0] ?? {}; return <article className="card card-pad calendar-version-card" key={base.publicKey}>
    <header><div><span className="eyebrow">{humanCalendarLabel(row.eventType ?? "event")} · v{row.versionNumber ?? 1}</span><h3>{row.title ?? base.eventNumber}</h3><p>{formatRange(row.startsAt, row.endsAt)}{row.venue ? ` · ${row.venue}` : ""}</p></div><span className={`badge ${row.status === "PUBLISHED" ? "success" : row.status === "WITHDRAWN" ? "danger" : ""}`}>{humanCalendarLabel(row.status ?? base.status)}</span></header>
    {!compact ? <p><strong>Audience:</strong> {humanCalendarLabel(row.audienceType ?? "")}{row.className ? ` · ${row.className}${row.section ? `-${row.section}` : ""}` : ""}</p> : null}
    {row.replacementReason ? <p className="notice">Changed/replacement version: {row.replacementReason}</p> : null}
    <div className="page-actions calendar-actions"><button className="button secondary" onClick={() => onInspect(base.publicKey)}>Audience and history</button>{eventActions(row).filter(actionAllowed).map((action) => <button className="button" key={action} onClick={() => onWorkflow({ kind: "event", publicKey: base.publicKey, expectedVersion: row.version, action, title: row.title })}>{humanCalendarLabel(action)}</button>)}</div>
  </article>; })}</div>;
}

function CalendarEditor({ version, options, busy, onClose, onSaved, onRequest }: { version: JsonMap; options: JsonMap; busy: boolean; onClose: () => void; onSaved: (text: string) => void; onRequest: (url: string, init?: RequestInit) => Promise<any> }) {
  const [days, setDays] = useState<DayDraft[]>(() => (version.days ?? []).map((day: JsonMap) => ({ key: crypto.randomUUID(), dayDate: isoDate(day.dayDate), rangeEnd: isoDate(day.dayDate), dayType: day.dayType, title: day.title, scopeType: day.scopeType, className: day.className ?? "", section: day.section ?? "", halfDaySession: day.halfDaySession ?? "", publicInstructions: day.publicInstructions ?? "", reason: day.reason ?? "" })));
  const [draft, setDraft] = useState<DayDraft>(() => emptyDay());
  const totals = countDays(days);
  function addDay() { if (!draft.dayDate || !draft.title) return; setDays((current) => [...current, { ...draft, key: crypto.randomUUID() }]); setDraft(emptyDay()); }
  async function save() {
    const expanded = days.flatMap(expandDayRange).map(({ key: _key, rangeEnd: _rangeEnd, ...day }) => day);
    await onRequest(`/api/academic-calendar/versions/${encodeURIComponent(version.publicKey)}`, { method: "PUT", body: JSON.stringify({ expectedVersion: version.version, title: version.title, days: expanded }) });
    onSaved("Operational classifications saved. Review impact before submission.");
  }
  return <div className="modal-backdrop" role="presentation"><section className="card modal-card academic-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-editor-title">
    <div className="section-title"><div><h2 id="calendar-editor-title">Operational day editor</h2><p>{version.title}. Events do not change these classifications.</p></div><button className="button secondary" onClick={onClose}>Close</button></div>
    <dl className="calendar-totals"><div><dt>Working</dt><dd>{totals.working}</dd></div><div><dt>Non-working</dt><dd>{totals.nonWorking}</dd></div><div><dt>Half-days</dt><dd>{totals.halfDays}</dd></div><div><dt>Vacation days</dt><dd>{totals.vacations}</dd></div></dl>
    <div className="form-grid calendar-day-form">
      <label>Start date<input type="date" value={draft.dayDate} onChange={(e) => setDraft({ ...draft, dayDate: e.target.value, rangeEnd: e.target.value })} /></label>
      <label>End date<input type="date" value={draft.rangeEnd} min={draft.dayDate} onChange={(e) => setDraft({ ...draft, rangeEnd: e.target.value })} /></label>
      <label>Classification<select value={draft.dayType} onChange={(e) => setDraft({ ...draft, dayType: e.target.value })}>{OPERATIONAL_DAY_TYPES.map((type) => <option value={type} key={type}>{humanCalendarLabel(type)}</option>)}</select></label>
      <label>Title<input maxLength={160} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
      <label>Scope<select value={draft.scopeType} onChange={(e) => setDraft({ ...draft, scopeType: e.target.value })}><option value="SCHOOL_WIDE">School wide</option><option value="CLASS">Class</option><option value="CLASS_SECTION">Class and section</option></select></label>
      <label>Class<select value={draft.className} onChange={(e) => setDraft({ ...draft, className: e.target.value })}><option value="">Not applicable</option>{[...new Set((options.classSections ?? []).filter((row: JsonMap) => row.academicYear === version.academicYear).map((row: JsonMap) => row.className))].map((value: any) => <option key={value}>{value}</option>)}</select></label>
      <label>Section<select value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })}><option value="">Not applicable</option>{[...new Set((options.classSections ?? []).filter((row: JsonMap) => row.academicYear === version.academicYear && (!draft.className || row.className === draft.className)).map((row: JsonMap) => row.section))].map((value: any) => <option key={value}>{value}</option>)}</select></label>
      {draft.dayType === "HALF_DAY" ? <label>Half-day session<input maxLength={80} value={draft.halfDaySession} onChange={(e) => setDraft({ ...draft, halfDaySession: e.target.value })} /></label> : null}
      <label className="wide">Public instructions<textarea maxLength={1500} value={draft.publicInstructions} onChange={(e) => setDraft({ ...draft, publicInstructions: e.target.value })} /></label>
      <label className="wide">Reason {draft.dayType === "EMERGENCY_CLOSURE" ? "(required)" : ""}<textarea maxLength={1000} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} /></label>
      <button className="button secondary" type="button" onClick={addDay}>Add classification</button>
    </div>
    <ol className="calendar-day-list">{days.map((day) => <li key={day.key}><div><strong>{day.dayDate}{day.rangeEnd !== day.dayDate ? ` to ${day.rangeEnd}` : ""}</strong><span>{humanCalendarLabel(day.dayType)} · {day.title}</span></div><button className="button secondary" onClick={() => setDays((rows) => rows.filter((row) => row.key !== day.key))}>Remove</button></li>)}</ol>
    <div className="page-actions"><button className="button" disabled={busy || !days.length} onClick={() => void save()}>Save draft classifications</button><button className="button secondary" onClick={onClose}>Cancel</button></div>
  </section></div>;
}

function EventEditor({ options, busy, onClose, onCreated, onRequest }: { options: JsonMap; busy: boolean; onClose: () => void; onCreated: () => void; onRequest: (url: string, init?: RequestInit) => Promise<any> }) {
  const [year, setYear] = useState(options.academicYears?.[0] ?? "");
  const [audience, setAudience] = useState("SCHOOL_WIDE");
  const [eventType, setEventType] = useState("SCHOOL_FUNCTION");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
    await onRequest("/api/school-calendar/events", { method: "POST", body: JSON.stringify({ ...data, allDay: data.allDay === "on", isImportant: data.isImportant === "on" }) }); onCreated();
  }
  return <div className="modal-backdrop"><section className="card modal-card academic-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="event-editor-title"><div className="section-title"><div><h2 id="event-editor-title">Create informational event</h2><p>This will remain a draft until reviewed and published.</p></div><button className="button secondary" onClick={onClose}>Close</button></div>
    <form className="form-grid calendar-form" onSubmit={(event) => void submit(event)}>
      <label>Academic year<select name="academicYear" value={year} onChange={(e) => setYear(e.target.value)}>{(options.academicYears ?? []).map((item: string) => <option key={item}>{item}</option>)}</select></label>
      <label>Event type<select name="eventType" value={eventType} onChange={(e) => setEventType(e.target.value)}>{SCHOOL_EVENT_TYPES.map((item) => <option value={item} key={item}>{humanCalendarLabel(item)}</option>)}</select></label>
      <label className="wide">Title<input name="title" maxLength={160} required /></label>
      <label>Starts<input name="startsAt" type="datetime-local" required /></label><label>Ends<input name="endsAt" type="datetime-local" required /></label>
      <label>Venue<input name="venue" maxLength={250} /></label>
      <label>Audience<select name="audienceType" value={audience} onChange={(e) => setAudience(e.target.value)}>{SCHOOL_EVENT_AUDIENCES.map((item) => <option value={item} key={item}>{humanCalendarLabel(item)}</option>)}</select></label>
      {audience === "ROLE_SPECIFIC" ? <label>Role<select name="roleScope"><option>TEACHER</option><option>PARENT</option><option>VIEWER</option><option>ACCOUNTANT</option><option>ADMIN</option></select></label> : null}
      {["CLASS", "CLASS_SECTION", "LINKED_CHILD_COHORT"].includes(audience) ? <ClassFields options={options.classSections ?? []} year={year} /> : null}
      {eventType === "EXAMINATION_REFERENCE" ? <label className="wide">Published examination timetable<select name="examinationTimetableKey" required><option value="">Choose current publication</option>{(options.publishedExaminationTimetables ?? []).filter((row: JsonMap) => row.academicYear === year).map((row: JsonMap) => <option value={row.publicKey} key={row.publicKey}>{row.examination.name} · {row.className}-{row.section} · v{row.versionNumber}</option>)}</select></label> : null}
      <label className="wide">Description<textarea name="description" maxLength={2000} /></label><label className="wide">Parent-facing instructions<textarea name="parentInstructions" maxLength={1500} /></label><label className="wide">Internal notes<textarea name="internalNotes" maxLength={1500} /></label>
      <label className="checkbox-row"><input name="allDay" type="checkbox" defaultChecked /> All-day event</label><label className="checkbox-row"><input name="isImportant" type="checkbox" /> Important publication notification</label>
      <div className="page-actions wide"><button className="button" disabled={busy}>Create draft</button><button type="button" className="button secondary" onClick={onClose}>Cancel</button></div>
    </form>
  </section></div>;
}

function WorkflowDialog({ workflow, busy, onClose, onSubmit }: { workflow: any; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const needsReason = !["ready"].includes(workflow.action);
  return <div className="modal-backdrop"><section className="card modal-card confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-workflow-title"><h2 id="calendar-workflow-title">{humanCalendarLabel(workflow.action)} {workflow.kind}</h2><p>{workflow.title}</p><form onSubmit={onSubmit}><label>Governance reason<textarea name="reason" maxLength={1000} required={needsReason} /></label>{workflow.action === "publish" ? <p className="notice">Publication is transaction-safe. Existing attendance is never rewritten; impact reconciliation is recorded when required.</p> : null}<div className="page-actions"><button className="button" disabled={busy}>Confirm {humanCalendarLabel(workflow.action)}</button><button type="button" className="button secondary" onClick={onClose}>Cancel</button></div></form></section></div>;
}

function DetailDialog({ detail, onClose }: { detail: JsonMap; onClose: () => void }) {
  const preview = detail.kind === "calendar" ? detail.preview : detail.audiencePreview;
  return <div className="modal-backdrop"><section className="card modal-card academic-calendar-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-detail-title"><div className="section-title"><div><h2 id="calendar-detail-title">{detail.kind === "calendar" ? "Impact and version history" : "Audience and version history"}</h2><p>{detail.title ?? detail.versions?.[0]?.title ?? detail.eventNumber}</p></div><button className="button secondary" onClick={onClose}>Close</button></div>
    {detail.kind === "calendar" ? <div className="calendar-impact"><dl className="calendar-totals"><div><dt>Changed dates</dt><dd>{preview?.changedDates ?? 0}</dd></div><div><dt>Posted attendance sessions</dt><dd>{preview?.postedAttendanceSessions ?? 0}</dd></div><div><dt>Exam conflicts</dt><dd>{preview?.examinationConflicts?.length ?? 0}</dd></div><div><dt>Records rewritten</dt><dd>No</dd></div></dl>{preview?.attendanceReconciliationRequired ? <p className="notice">A governed correction and attendance reconciliation are required. Former classifications and attendance remain unchanged.</p> : null}</div> : <dl className="calendar-totals"><div><dt>Total authorised users</dt><dd>{preview?.totalUsers ?? 0}</dd></div><div><dt>Parents</dt><dd>{preview?.parentUsers ?? 0}</dd></div><div><dt>Staff</dt><dd>{preview?.staffUsers ?? 0}</dd></div><div><dt>Audience</dt><dd>{preview?.audience ?? "None"}</dd></div></dl>}
    <h3>Append-only history</h3><ol className="calendar-audit-list">{(detail.audit ?? []).map((row: JsonMap, index: number) => <li key={`${row.eventDate}-${index}`}><strong>{humanCalendarLabel(row.eventType)}</strong><span>{row.actorLabel} · {formatDateTime(row.eventDate)}</span>{row.reason ? <p>{row.reason}</p> : null}</li>)}</ol>
  </section></div>;
}

function calendarActions(row: JsonMap) { if (row.status === "DRAFT") return ["ready"]; if (row.status === "READY_FOR_REVIEW") return row.approvedAt ? ["publish"] : ["approve"]; if (row.status === "PUBLISHED") return ["create_replacement", "withdraw"]; if (["REPLACED", "WITHDRAWN"].includes(row.status)) return ["archive"]; return []; }
function eventActions(row: JsonMap) { if (row.status === "DRAFT") return ["ready"]; if (row.status === "READY_FOR_REVIEW") return row.approvedAt ? ["publish"] : ["approve"]; if (row.status === "PUBLISHED") return ["create_replacement", "withdraw"]; if (["REPLACED", "WITHDRAWN"].includes(row.status)) return ["archive"]; return []; }
function countDays(days: JsonMap[]) { return { working: days.filter((row) => ["WORKING_DAY", "SPECIAL_WORKING_DAY"].includes(row.dayType)).length, nonWorking: days.filter((row) => ["NON_WORKING_DAY", "VACATION_DAY", "EMERGENCY_CLOSURE"].includes(row.dayType)).length, halfDays: days.filter((row) => row.dayType === "HALF_DAY").length, vacations: days.filter((row) => row.dayType === "VACATION_DAY").length }; }
function emptyDay(): DayDraft { return { key: crypto.randomUUID(), dayDate: "", rangeEnd: "", dayType: "WORKING_DAY", title: "Working day", scopeType: "SCHOOL_WIDE", className: "", section: "", halfDaySession: "", publicInstructions: "", reason: "" }; }
function expandDayRange(day: DayDraft) { const rows: DayDraft[] = []; const start = new Date(`${day.dayDate}T00:00:00Z`), end = new Date(`${day.rangeEnd || day.dayDate}T00:00:00Z`); for (let date = start; date <= end && rows.length < 400; date = new Date(date.valueOf() + 86_400_000)) rows.push({ ...day, key: crypto.randomUUID(), dayDate: date.toISOString().slice(0, 10), rangeEnd: date.toISOString().slice(0, 10) }); return rows; }
function isoDate(value: unknown) { const date = new Date(String(value)); return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10); }
function formatDateTime(value: unknown) { const date = new Date(String(value)); return Number.isNaN(date.valueOf()) ? "Date unavailable" : date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }); }
function formatRange(start: unknown, end: unknown) { return `${formatDateTime(start)}${String(start) !== String(end) ? ` to ${formatDateTime(end)}` : ""}`; }
