"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays, ShieldCheck } from "lucide-react";

export function ParentMeetingParentPortal({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error?: boolean; text: string } | null>(null);

  async function refresh() {
    if (!data.context) return;
    const query = new URLSearchParams({ academicYear: data.context.child.academicYear, childHandle: data.context.childHandle, expectedContextVersion: String(data.context.contextVersion) });
    const response = await fetch(`/api/parent/meetings?${query}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Meetings could not refresh.");
    setData(body);
  }

  async function requestMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!data.context) return;
    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get("preferredStart"));
    const endsAt = String(form.get("preferredEnd"));
    const preferences = startsAt && endsAt ? [{ startsAt: indiaOffset(startsAt), endsAt: indiaOffset(endsAt) }] : [];
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/parent/meetings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ academicYear: data.context.child.academicYear, childHandle: data.context.childHandle, expectedContextVersion: data.context.contextVersion, category: form.get("category"), subject: form.get("subject"), requestReason: form.get("requestReason"), preferences }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The meeting request failed safely.");
      await refresh(); event.currentTarget.reset(); setMessage({ text: "Your meeting request was recorded for the selected linked child." });
    } catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "The meeting request failed safely." }); }
    finally { setBusy(false); }
  }

  async function cancel(meeting: any) {
    const reason = window.prompt("Reason for cancelling this request"); if (!reason) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/parent/meetings/${meeting.publicKey}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRowVersion: meeting.rowVersion, reason }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Cancellation failed safely.");
      await refresh(); setMessage({ text: "The request was cancelled with its history preserved." });
    } catch (error) { setMessage({ error: true, text: error instanceof Error ? error.message : "Cancellation failed safely." }); }
    finally { setBusy(false); }
  }

  if (!data.context) return <section className="parent-meeting-parent"><div className="parent-meeting-empty"><CalendarDays aria-hidden /><h2>Choose an active linked child</h2><p>Use the child context selector in the header, then return here. No unrelated Student record is available from this page.</p></div></section>;
  return <section className="parent-meeting-parent">
    <div className="parent-meeting-guardrail"><ShieldCheck aria-hidden /><div><strong>Private linked-child meetings</strong><span>Only Parent-safe schedules, summaries and intentionally shared follow-up information appear here.</span></div></div>
    {message ? <div className={`parent-meeting-notice ${message.error ? "danger" : "success"}`} role={message.error ? "alert" : "status"}>{message.text}</div> : null}
    <div className="parent-meeting-child"><span>Requesting for</span><strong>{data.context.child.studentName}</strong><small>{data.context.child.className}{data.context.child.section ? ` ${data.context.child.section}` : ""} · {data.context.child.academicYear}</small></div>
    <form className="parent-meeting-parent-form" onSubmit={requestMeeting}><h2>Request a meeting</h2><p>Share a short reason and, if useful, one preferred school-local time window.</p><label>Category<select name="category" defaultValue="GENERAL_SCHOOL_DISCUSSION">{data.categories.map((category: string) => <option key={category}>{category}</option>)}</select></label><label className="wide">Subject<input name="subject" minLength={3} maxLength={180} required /></label><label className="wide">Short reason<textarea name="requestReason" minLength={3} maxLength={2000} rows={4} required /></label><label>Preferred start<input name="preferredStart" type="datetime-local" /></label><label>Preferred end<input name="preferredEnd" type="datetime-local" /></label><button className="button" disabled={busy}>Request meeting</button></form>
    <div className="parent-meeting-parent-list"><h2>Meeting history</h2>{data.meetings.length ? data.meetings.map((meeting: any) => <article key={meeting.publicKey}><header><div><span className="eyebrow">{meeting.category.replaceAll("_", " ")}</span><h3>{meeting.subject}</h3></div><span className="parent-meeting-status">{meeting.status.replaceAll("_", " ")}</span></header><p className="preserve-text">{meeting.requestReason}</p><dl><div><dt>Schedule</dt><dd>{meeting.schedule ? indiaDate(meeting.schedule.start) : "The school is reviewing your request"}</dd></div><div><dt>Mode/location</dt><dd>{meeting.schedule ? `${meeting.schedule.mode.replaceAll("_", " ")} · ${meeting.schedule.location || meeting.schedule.onlineReference || "School will confirm"}` : "Not confirmed"}</dd></div></dl>{meeting.participants.length ? <p><strong>Participants:</strong> {meeting.participants.map((participant: any) => participant.name).join(", ")}</p> : null}{meeting.parentVisibleSummary ? <section><h4>Parent-visible summary</h4><p className="preserve-text">{meeting.parentVisibleSummary.body}</p><small>Published {indiaDate(meeting.parentVisibleSummary.publishedAt)}{meeting.parentVisibleSummary.corrected ? " · corrected with history preserved" : ""}</small></section> : null}{meeting.cancellationSummary ? <p><strong>Cancellation:</strong> {meeting.cancellationSummary}</p> : null}{meeting.followUps.map((followUp: any, index: number) => <section key={`${meeting.publicKey}-${index}`}><h4>Shared follow-up</h4><p>{followUp.description}</p><small>{followUp.status} · due {indiaDay(followUp.dueDate)}</small></section>)}{["REQUESTED", "SCHEDULING"].includes(meeting.status) ? <button type="button" className="button secondary" disabled={busy} onClick={() => cancel(meeting)}>Cancel request</button> : null}</article>) : <div className="parent-meeting-empty"><CalendarDays aria-hidden /><h3>No meeting requests yet</h3><p>Your linked-child requests and Parent-safe school appointments will appear here.</p></div>}</div>
  </section>;
}

function indiaOffset(value: string) { return value ? `${value.length === 16 ? `${value}:00` : value}+05:30` : ""; }
function indiaDate(value: string) { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function indiaDay(value: string) { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(new Date(value)); }

