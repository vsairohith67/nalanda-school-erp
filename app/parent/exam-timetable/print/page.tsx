import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthContext, requirePermission } from "@/lib/auth";
import { loadParentExaminationTimetables, ParentAcademicAccessError } from "@/lib/parent-academics";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export const dynamic = "force-dynamic";

export default async function ParentExamTimetablePrint({ searchParams }: { searchParams: Promise<{ childContext?: string; contextVersion?: string }> }) {
  noStore();
  const user = await requirePermission("VIEW_OWN_EXAM_TIMETABLE");
  if (user.role !== "PARENT") redirect("/unauthorized");
  const [auth, settings, query] = await Promise.all([getCurrentAuthContext(), getSchoolSettings(prisma), searchParams]);
  if (!auth) redirect("/login");
  const data = await loadParentExaminationTimetables(prisma, { userId: auth.user.id, sessionId: auth.sessionId, roleAssignmentId: auth.user.roleAssignmentId }, { academicYear: settings.academicYear, childHandle: query.childContext, expectedContextVersion: query.contextVersion && /^\d+$/.test(query.contextVersion) ? Number(query.contextVersion) : null }).catch((error) => error instanceof ParentAcademicAccessError ? null : Promise.reject(error));
  if (!data) return <UnavailablePrint />;
  return <article className="print-page parent-academic-print"><header><h1>{settings.schoolName}</h1><h2>Published Examination Timetable</h2><p>{data.context.child.studentName} · {data.context.child.admissionNo} · {data.context.child.className}{data.context.child.section ? `-${data.context.child.section}` : ""} · {data.context.child.academicYear}</p></header>{data.timetables.map((timetable) => <section key={`${timetable.examination.code}-${timetable.publishedAt}`}><h2>{timetable.examination.name} {timetable.updated ? "(Updated)" : ""}</h2><p>{timetable.examination.startDate} to {timetable.examination.endDate}</p>{timetable.parentInstructions ? <p>{timetable.parentInstructions}</p> : null}<table><thead><tr><th>Date</th><th>Subject / paper</th><th>Time</th><th>Reporting</th><th>Venue</th></tr></thead><tbody>{timetable.rows.map((row) => <tr key={`${row.date}-${row.paperCode}`}><td>{row.date}</td><td>{row.subject}<br />{row.paper} ({row.paperCode})</td><td>{row.startTime}–{row.endTime}</td><td>{row.reportingTime ?? "—"}</td><td>{row.venue ?? "—"}</td></tr>)}</tbody></table></section>)}{!data.timetables.length ? <p>No current published timetable.</p> : null}</article>;
}

function UnavailablePrint() {
  return <article className="print-page parent-academic-print"><header><h1>Published Examination Timetable</h1></header><h2>Linked-child record unavailable</h2><p>The selected family context is no longer available. No Student information is shown.</p></article>;
}
