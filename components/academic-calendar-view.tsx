import Link from "next/link";
import { humanCalendarLabel } from "@/lib/academic-calendar-shared";

type CalendarData = { academicYear: string; from: string; to: string; context?: any; days: any[]; events: any[]; upcoming: any[]; totals: { workingDays: number; nonWorkingDays: number; halfDays: number; vacationDays: number; specialWorkingDays: number }; basisNotice: string };

export function AcademicCalendarView({ data, month, mode, basePath, printPath, contextQuery = "", title = "Calendar", description, print = false }: { data: CalendarData; month: string; mode: "month" | "list"; basePath: string; printPath?: string; contextQuery?: string; title?: string; description: string; print?: boolean }) {
  const suffix = contextQuery ? `&${contextQuery}` : "";
  const entries = combinedEntries(data);
  return <div className={`academic-calendar-view ${print ? "calendar-print-view" : ""}`}>
    {!print ? <>
      <section className="card card-pad calendar-view-toolbar" aria-label="Calendar controls">
        <div className="page-actions"><Link className="button secondary" href={`${basePath}?month=${adjacentMonth(month, -1)}&view=${mode}${suffix}`}>Previous month</Link><strong>{monthLabel(month)}</strong><Link className="button secondary" href={`${basePath}?month=${adjacentMonth(month, 1)}&view=${mode}${suffix}`}>Next month</Link></div>
        <div className="page-actions" role="group" aria-label="Calendar view"><Link className={`button secondary ${mode === "month" ? "active" : ""}`} aria-current={mode === "month" ? "page" : undefined} href={`${basePath}?month=${month}&view=month${suffix}`}>Month view</Link><Link className={`button secondary ${mode === "list" ? "active" : ""}`} aria-current={mode === "list" ? "page" : undefined} href={`${basePath}?month=${month}&view=list${suffix}`}>Agenda view</Link>{printPath ? <Link className="button secondary" href={`${printPath}?month=${month}${suffix}`}>Print view</Link> : null}</div>
      </section>
    </> : <header className="calendar-print-header"><h1>{title}</h1><p>{description}</p><strong>{monthLabel(month)} · Academic year {data.academicYear}</strong></header>}
    {data.context?.child ? <section className="card card-pad parent-academic-identity" aria-label="Selected linked child"><h2>{data.context.child.studentName}</h2><p>{data.context.child.className}{data.context.child.section ? `-${data.context.child.section}` : ""}</p></section> : null}
    <div className="grid five calendar-public-totals" aria-label="Operational day totals"><Metric label="Working days" value={data.totals.workingDays} /><Metric label="Non-working days" value={data.totals.nonWorkingDays} /><Metric label="Half-days" value={data.totals.halfDays} /><Metric label="Vacation days" value={data.totals.vacationDays} /><Metric label="Special working" value={data.totals.specialWorkingDays} /></div>
    {!print ? <section className="notice"><strong>Governed basis.</strong> {data.basisNotice}</section> : null}
    {!entries.length ? <section className="card card-pad empty-state"><h2>No published calendar entries</h2><p>Draft, unrelated, Staff-only and withdrawn entries are not shown.</p></section> : mode === "month" && !print ? <MonthTable month={month} entries={entries} /> : <Agenda entries={entries} />}
    {!print && data.upcoming.length ? <section className="card card-pad"><h2>Upcoming</h2><ol className="calendar-upcoming-list">{data.upcoming.map((event) => <EventSummary key={`${event.eventNumber}-${event.versionNumber}`} event={event} />)}</ol></section> : null}
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <section className="card stat"><span>{label}</span><strong>{value}</strong></section>; }

function MonthTable({ month, entries }: { month: string; entries: any[] }) {
  const dates = monthDates(month), grouped = groupEntries(entries);
  return <section className="card calendar-month-card"><h2 className="sr-only">{monthLabel(month)} month calendar</h2><table className="calendar-month-table"><thead><tr>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => <th scope="col" key={day}><span className="calendar-day-full">{day}</span><span className="calendar-day-short" aria-hidden="true">{day.slice(0, 1)}</span></th>)}</tr></thead><tbody>{chunk(dates, 7).map((week, index) => <tr key={index}>{week.map((date, column) => date ? <td key={date} className={grouped.has(date) ? "has-entry" : ""}><time dateTime={date}>{Number(date.slice(-2))}</time><ul>{(grouped.get(date) ?? []).slice(0, 3).map((entry, entryIndex) => <li className={entry.kind === "OPERATIONAL_DAY" ? "operational" : "event"} key={`${entry.kind}-${entryIndex}`}><span className="calendar-entry-marker" aria-hidden="true" /><span>{entry.title}</span></li>)}</ul>{(grouped.get(date) ?? []).length > 3 ? <small>+{(grouped.get(date) ?? []).length - 3} more</small> : null}</td> : <td className="outside" aria-hidden="true" key={`blank-${index}-${column}`} />)}</tr>)}</tbody></table></section>;
}

function Agenda({ entries }: { entries: any[] }) { return <section className="card calendar-agenda"><h2>Published agenda</h2><ol>{entries.map((entry, index) => <li key={`${entry.date}-${entry.kind}-${index}`}><time dateTime={entry.date}>{longDate(entry.date)}</time><div><span className={`badge ${entry.kind === "OPERATIONAL_DAY" ? "" : "success"}`}>{entry.typeLabel}</span>{entry.changed ? <span className="badge warn">Changed</span> : null}<h3>{entry.title}</h3>{entry.description ? <p>{entry.description}</p> : null}<p>{entry.timeLabel}{entry.venue ? ` · ${entry.venue}` : ""}{entry.scopeLabel ? ` · ${entry.scopeLabel}` : ""}</p>{entry.instructions ? <p className="notice">{entry.instructions}</p> : null}{entry.examinationReference ? <ExamReference value={entry.examinationReference} /> : null}</div></li>)}</ol></section>; }

function EventSummary({ event }: { event: any }) { return <li><time dateTime={event.startsAt}>{longDate(event.startsAt.slice(0, 10))}</time><div><strong>{event.title}</strong><span>{event.typeLabel}{event.venue ? ` · ${event.venue}` : ""}{event.changed ? " · Changed" : ""}</span></div></li>; }
function ExamReference({ value }: { value: any }) { return <section className="calendar-exam-reference"><h4>{value.examination} · published timetable v{value.versionNumber}</h4><p>{value.className}-{value.section}. Current published rows only; marks and report data are not included.</p><ul>{value.rows.slice(0, 12).map((row: any, index: number) => <li key={`${row.examDate}-${row.subject}-${index}`}>{row.examDate} · {row.subject} · {row.startTime}–{row.endTime}</li>)}</ul></section>; }

function combinedEntries(data: CalendarData) {
  const days = data.days.map((day) => ({ ...day, date: day.date, timeLabel: day.halfDaySession ? `Half-day session: ${day.halfDaySession}` : "All day", scopeLabel: day.scopeLabel }));
  const events = data.events.map((event) => ({ ...event, date: event.startsAt.slice(0, 10), timeLabel: event.allDay ? "All day" : timeRange(event.startsAt, event.endsAt), scopeLabel: `${event.audienceLabel}${event.className ? ` · ${event.className}${event.section ? `-${event.section}` : ""}` : ""}` }));
  return [...days, ...events].sort((left, right) => left.date.localeCompare(right.date) || left.kind.localeCompare(right.kind) || left.title.localeCompare(right.title));
}
function groupEntries(entries: any[]) { const map = new Map<string, any[]>(); for (const entry of entries) map.set(entry.date, [...(map.get(entry.date) ?? []), entry]); return map; }
function monthDates(month: string) { const [year, value] = month.split("-").map(Number), first = new Date(Date.UTC(year, value - 1, 1)), last = new Date(Date.UTC(year, value, 0)), output: Array<string | null> = Array(first.getUTCDay()).fill(null); for (let day = 1; day <= last.getUTCDate(); day++) output.push(`${month}-${String(day).padStart(2, "0")}`); while (output.length % 7) output.push(null); return output; }
function chunk<T>(values: T[], size: number) { const output: T[][] = []; for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size)); return output; }
function adjacentMonth(month: string, offset: number) { const [year, value] = month.split("-").map(Number); const date = new Date(Date.UTC(year, value - 1 + offset, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }
function monthLabel(month: string) { return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`)); }
function longDate(value: string) { return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function timeRange(start: string, end: string) { const format = (value: string) => new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }); return `${format(start)}–${format(end)}`; }
