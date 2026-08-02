import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { getCurrentAuthContext, requirePermission } from "@/lib/auth";
import { displayDate } from "@/lib/format";
import { loadParentAttendance, ParentAcademicAccessError } from "@/lib/parent-academics";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export const dynamic = "force-dynamic";

export default async function ParentAttendancePage({ searchParams }: { searchParams: Promise<{ month?: string; childContext?: string; contextVersion?: string }> }) {
  noStore();
  const user = await requirePermission("VIEW_OWN_ATTENDANCE");
  if (user.role !== "PARENT") redirect("/unauthorized");
  const [auth, settings, query] = await Promise.all([getCurrentAuthContext(), getSchoolSettings(prisma), searchParams]);
  if (!auth) redirect("/login");
  const contextVersion = query.contextVersion && /^\d+$/.test(query.contextVersion) ? Number(query.contextVersion) : null;
  const data = await loadParentAttendance(prisma, {
    userId: auth.user.id,
    sessionId: auth.sessionId,
    roleAssignmentId: auth.user.roleAssignmentId
  }, {
    academicYear: settings.academicYear,
    month: query.month,
    childHandle: query.childContext,
    expectedContextVersion: contextVersion
  }).catch((error) => {
    if (error instanceof ParentAcademicAccessError) return null;
    throw error;
  });
  if (!data) return <Unavailable title="Parent Attendance" />;
  const child = data.context.child;
  const contextQuery = `childContext=${encodeURIComponent(data.context.childHandle)}&contextVersion=${data.context.contextVersion}`;
  const previous = adjacentMonth(data.month, -1);
  const next = adjacentMonth(data.month, 1);
  return <div className="page parent-academic-page parent-attendance-page">
    <PageHeader title="Attendance" description="Official posted attendance for the active linked-child context. Read-only; no correction or dispute action is available here." action={<Link className="button secondary" href={`/parent/attendance/print?month=${data.month}&${contextQuery}`}>Print view</Link>} />
    <section className="card card-pad parent-academic-identity" aria-label="Selected linked child">
      <h2>{child.studentName}</h2>
      <p>{child.admissionNo} · {child.className}{child.section ? `-${child.section}` : ""}{child.rollNo ? ` · Roll ${child.rollNo}` : ""}</p>
      <strong>Academic year {child.academicYear}</strong>
    </section>
    <nav className="card card-pad parent-month-nav" aria-label="Attendance month">
      <Link className="button secondary" href={`/parent/attendance?month=${previous}&${contextQuery}`}>Previous month</Link>
      <label>Month<input type="month" value={data.month} readOnly aria-label="Selected attendance month" /></label>
      <Link className="button secondary" href={`/parent/attendance?month=${next}&${contextQuery}`}>Next month</Link>
    </nav>
    <div className="grid five parent-attendance-counts">
      {(["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED"] as const).map((status) => <section className="card stat" key={status}><span>{status === "HALF_DAY" ? "Half day" : title(status)}</span><strong>{data.counts[status]}</strong></section>)}
    </div>
    <section className="notice" role="note"><strong>Counts only.</strong> {data.policyNotice}</section>
    <section className="card">
      <div className="section-title"><div><h2>{monthLabel(data.month)}</h2><p>{data.officialRecordedDayCount} official recorded day(s). {data.lastOfficialUpdateAt ? `Last official update ${displayDate(new Date(data.lastOfficialUpdateAt))}.` : "No official update exists for this month."}</p></div></div>
      {data.entries.length ? <ol className="parent-attendance-list">
        {data.entries.map((entry) => <li key={entry.date}><time dateTime={entry.date}>{longDate(entry.date)}</time><StatusBadge status={entry.label} /><span>{entry.officialState}</span></li>)}
      </ol> : <div className="empty-state card-pad"><h3>No official attendance recorded for this month.</h3><p>This does not mean absent. Nalanda has no governed working-day calendar, so dates without an official record are not labelled non-working either.</p></div>}
    </section>
  </div>;
}

function Unavailable({ title }: { title: string }) {
  return <div className="page parent-academic-page"><PageHeader title={title} description="Read-only linked-child record" /><section className="card card-pad empty-state"><h2>Choose an active linked child</h2><p>Use the linked-child context selector above. Removed, stale, unrelated, or inactive family links are not available.</p></section></div>;
}

function adjacentMonth(month: string, offset: number) { const [year, value] = month.split("-").map(Number); const date = new Date(Date.UTC(year, value - 1 + offset, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }
function monthLabel(month: string) { return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00.000Z`)); }
function longDate(value: string) { return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`)); }
function title(value: string) { return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
