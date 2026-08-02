import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getCurrentAuthContext, requirePermission } from "@/lib/auth";
import { loadParentExaminationTimetables, ParentAcademicAccessError } from "@/lib/parent-academics";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export const dynamic = "force-dynamic";

export default async function ParentExamTimetablePage({ searchParams }: { searchParams: Promise<{ childContext?: string; contextVersion?: string }> }) {
  noStore();
  const user = await requirePermission("VIEW_OWN_EXAM_TIMETABLE");
  if (user.role !== "PARENT") redirect("/unauthorized");
  const [auth, settings, query] = await Promise.all([getCurrentAuthContext(), getSchoolSettings(prisma), searchParams]);
  if (!auth) redirect("/login");
  const data = await loadParentExaminationTimetables(prisma, { userId: auth.user.id, sessionId: auth.sessionId, roleAssignmentId: auth.user.roleAssignmentId }, { academicYear: settings.academicYear, childHandle: query.childContext, expectedContextVersion: query.contextVersion && /^\d+$/.test(query.contextVersion) ? Number(query.contextVersion) : null }).catch((error) => error instanceof ParentAcademicAccessError ? null : Promise.reject(error));
  if (!data) return <div className="page parent-academic-page"><PageHeader title="Examination Timetable" description="Read-only linked-child record" /><section className="card card-pad empty-state"><h2>Choose an active linked child</h2><p>Removed, stale, unrelated, or inactive family links are not available.</p></section></div>;
  const child = data.context.child;
  const print = `/parent/exam-timetable/print?childContext=${encodeURIComponent(data.context.childHandle)}&contextVersion=${data.context.contextVersion}`;
  return <div className="page parent-academic-page parent-exam-timetable-page"><PageHeader title="Examination Timetable" description="Currently published timetable versions for the active linked child only." action={<Link className="button secondary" href={print}>Print view</Link>} />
    <section className="card card-pad parent-academic-identity"><h2>{child.studentName}</h2><p>{child.admissionNo} · {child.className}{child.section ? `-${child.section}` : ""}{child.rollNo ? ` · Roll ${child.rollNo}` : ""}</p><strong>Academic year {child.academicYear}</strong></section>
    <div className="grid three"><section className="card stat"><span>Upcoming examinations</span><strong>{data.upcomingSummary.examinationCount}</strong></section><section className="card stat"><span>Upcoming papers</span><strong>{data.upcomingSummary.paperCount}</strong></section><section className="card stat"><span>Next paper</span><strong>{data.upcomingSummary.nextPaper ? `${data.upcomingSummary.nextPaper.date} · ${data.upcomingSummary.nextPaper.subject}` : "None published"}</strong></section></div>
    {!data.timetables.length ? <section className="card card-pad empty-state"><h2>No current published timetable</h2><p>Draft, withdrawn, replaced, archived, and other-cohort versions are never shown here.</p></section> : data.timetables.map((timetable) => <section className="card parent-exam-card" key={`${timetable.examination.code}-${timetable.publishedAt}`}><div className="section-title"><div><h2>{timetable.examination.name}</h2><p>{timetable.examination.code} · {timetable.examination.type} · {timetable.examination.startDate} to {timetable.examination.endDate}</p></div><span className={`badge ${timetable.updated ? "warning" : ""}`}>{timetable.statusLabel}</span></div>{timetable.parentInstructions ? <p className="notice">{timetable.parentInstructions}</p> : null}<div className="parent-exam-date-groups">{groupByDate(timetable.rows).map(([date, rows]) => <section key={date}><h3>{longDate(date)}</h3><div className="table-wrap"><table className="parent-exam-table"><thead><tr><th>Subject / paper</th><th>Time</th><th>Reporting</th><th>Venue</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.paperCode}-${row.date}`}><td data-label="Subject / paper"><strong>{row.subject}</strong><br /><span>{row.paper} · {row.paperCode}</span>{row.instructions ? <small>{row.instructions}</small> : null}</td><td data-label="Time">{row.startTime}–{row.endTime}</td><td data-label="Reporting">{row.reportingTime ?? "Not configured"}</td><td data-label="Venue">{row.venue ?? "Not configured"}</td></tr>)}</tbody></table></div></section>)}</div><footer>Published {timetable.publishedAt ? new Date(timetable.publishedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "date unavailable"}</footer></section>)}
  </div>;
}

function groupByDate(rows: Array<any>) { const map = new Map<string, Array<any>>(); for (const row of rows) map.set(row.date, [...(map.get(row.date) ?? []), row]); return [...map.entries()]; }
function longDate(value: string) { return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`)); }
