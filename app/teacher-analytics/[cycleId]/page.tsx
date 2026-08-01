import Link from "next/link";
import { notFound } from "next/navigation";
import { TeacherAnalyticsCycleActions } from "@/components/teacher-analytics-forms";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { teacherAnalyticsReadiness } from "@/lib/teacher-analytics";

export default async function TeacherAnalyticsCyclePage({ params }: { params: Promise<{ cycleId: string }> }) {
  const user = await requirePermission("VIEW_TEACHER_ANALYTICS"); const { cycleId } = await params;
  const [cycle, permissions] = await Promise.all([
    prisma.teacherAnalyticsReviewCycle.findUnique({ where: { id: cycleId }, include: { snapshots: { include: { staffMember: { select: { fullName: true, displayName: true, staffCode: true } }, review: true }, orderBy: { staffMember: { fullName: "asc" } } }, events: { orderBy: { eventDate: "desc" }, take: 50 } } }),
    getCurrentUserEffectivePermissions()
  ]);
  if (!cycle) notFound();
  const readiness = cycle.status === "DRAFT" || cycle.status === "OPEN" ? await teacherAnalyticsReadiness(prisma, cycle) : null;
  const shared = cycle.snapshots.filter((s) => ["SHARED_WITH_TEACHER","TEACHER_RESPONSE_RECEIVED","FINALISED"].includes(s.review?.status ?? "")).length;
  return <div className="page teacher-analytics-page">
    <PageHeader title={cycle.title} description={`${cycle.cycleCode} · ${cycle.academicYear} · ${cycle.periodStart.toLocaleDateString("en-IN")} to ${cycle.periodEnd.toLocaleDateString("en-IN")}`} action={<StatusBadge status={cycle.status}/>}/>
    <p className="notice">Minimum Student cohort: {cycle.minimumStudentCohort}. Metric definition: {cycle.metricDefinitionVersion}. No score or ranking is generated.</p>
    <div className="grid four"><StatCard label="Eligible / Snapshots" value={String(cycle.snapshots.length || readiness?.eligibleTeachers.length || 0)}/><StatCard label="Shared" value={String(shared)}/><StatCard label="Finalised Reviews" value={String(cycle.snapshots.filter((s) => s.review?.status === "FINALISED").length)}/><StatCard label="Source Warnings" value={String(readiness?.warnings.length ?? cycle.snapshots.filter((s) => JSON.parse(s.dataQualityJson).excludedDataReasons?.length).length)}/></div>
    <TeacherAnalyticsCycleActions id={cycle.id} status={cycle.status} updatedAt={cycle.updatedAt.toISOString()} permissions={{ manage: permissionSetCan(permissions,"MANAGE_TEACHER_ANALYTICS_CYCLES"), generate: permissionSetCan(permissions,"GENERATE_TEACHER_ANALYTICS_SNAPSHOTS"), finalise: permissionSetCan(permissions,"FINALISE_TEACHER_ANALYTICS_REVIEW") }}/>
    {readiness ? <section className="card card-pad"><h3>Source-readiness preview</h3>{readiness.warnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}<div className="table-wrap"><table><thead><tr><th>Teacher</th><th>Staff Code</th><th>Timetable Source</th><th>Linked Account</th></tr></thead><tbody>{readiness.eligibleTeachers.map((teacher) => <tr key={teacher.staffMemberId}><td>{teacher.teacherName}</td><td>{teacher.staffCode}</td><td>{teacher.state}</td><td>{teacher.linkedUser ? "Linked" : "Not linked"}</td></tr>)}</tbody></table></div></section> : null}
    <section className="card card-pad"><div className="section-title"><div><h3>Teacher Evidence Snapshots</h3><p>Listed alphabetically, never by score or rank.</p></div>{permissionSetCan(permissions,"VIEW_TEACHER_ANALYTICS_REPORTS") ? <Link className="button secondary" href={`/teacher-analytics/${cycle.id}/reports`}>Cycle Reports</Link> : null}</div><div className="table-wrap"><table><thead><tr><th>Teacher</th><th>Staff Code</th><th>Data Quality</th><th>Review</th><th>Calculated</th><th>Open</th></tr></thead><tbody>{cycle.snapshots.map((snapshot) => { const quality = JSON.parse(snapshot.dataQualityJson); return <tr key={snapshot.id}><td>{snapshot.staffMember.displayName ?? snapshot.staffMember.fullName}</td><td>{snapshot.staffMember.staffCode ?? "Not assigned"}</td><td>{quality.timetableCoverage} / {quality.studentCohortThreshold}</td><td><StatusBadge status={snapshot.review?.status ?? "NOT_STARTED"}/></td><td>{snapshot.sourceCalculatedAt.toLocaleString("en-IN")}</td><td><Link href={`/teacher-analytics/${cycle.id}/teachers/${snapshot.id}`}>Review Evidence</Link></td></tr>; })}{!cycle.snapshots.length ? <tr><td colSpan={6}>No snapshots have been generated.</td></tr> : null}</tbody></table></div></section>
    <section className="card card-pad"><h3>Append-only Event History</h3><div className="table-wrap"><table><thead><tr><th>Date</th><th>Event</th><th>Reason / Context</th></tr></thead><tbody>{cycle.events.map((event) => <tr key={event.id}><td>{event.eventDate.toLocaleString("en-IN")}</td><td>{event.eventType.replaceAll("_"," ")}</td><td>{event.reason ?? event.notes ?? "—"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
