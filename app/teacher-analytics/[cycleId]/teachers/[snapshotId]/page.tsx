import { notFound } from "next/navigation";
import { TeacherAnalyticsReviewForm } from "@/components/teacher-analytics-forms";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { publicTeacherAnalyticsSnapshot } from "@/lib/teacher-analytics";
import { schoolDateKey } from "@/lib/format";

function Evidence({ title, data }: { title: string; data: any }) {
  const sourceMissing = data.completeness === "SOURCE_MISSING";
  return <section className="card card-pad"><div className="section-title"><div><h3>{title}</h3><p>{data.sourceModule} · {data.sourcePeriod?.start} to {data.sourcePeriod?.end}</p></div><StatusBadge status={data.completeness}/></div><p>{data.warning}</p>{sourceMissing ? <p className="notice"><strong>Evidence not available:</strong> the required source link or source records are missing. No zero values are inferred.</p> : <div className="table-wrap"><table><thead><tr><th>Metric</th><th>Evidence</th></tr></thead><tbody>{Object.entries(data.value ?? {}).map(([key, value]) => <tr key={key}><td>{key.replaceAll(/([A-Z])/g," $1").replaceAll("_"," ")}</td><td>{typeof value === "object" ? <pre className="json-evidence">{JSON.stringify(value, null, 2)}</pre> : String(value ?? "Not available")}</td></tr>)}</tbody></table></div>}<small>Definition: {data.definition} · Last calculated: {new Date(data.lastCalculatedAt).toLocaleString("en-IN")} · {data.sensitivity.replaceAll("_"," ")}</small></section>;
}

export default async function TeacherSnapshotPage({ params }: { params: Promise<{ cycleId: string; snapshotId: string }> }) {
  const user = await requirePermission("VIEW_TEACHER_ANALYTICS"); const { cycleId, snapshotId } = await params;
  const [row, permissions] = await Promise.all([
    prisma.teacherAnalyticsSnapshot.findFirst({ where: { id: snapshotId, reviewCycleId: cycleId }, include: { reviewCycle: true, review: true, events: { orderBy: { eventDate: "desc" } } } }),
    getEffectivePermissions(prisma, user.role)
  ]);
  if (!row) notFound(); const data = publicTeacherAnalyticsSnapshot(row);
  return <div className="page teacher-analytics-page"><PageHeader title={data.teacher?.displayName ?? "Teacher Evidence"} description={`${data.teacher?.staffCode ?? "No staff code"} · ${data.cycle?.title}`}/><p className="notice"><strong>No automatic judgment:</strong> these categories have no composite score, rank, traffic-light grade, allegation, or employment recommendation. Student identities and raw marks are excluded.</p>
    <Evidence title="Workload and Timetable Context" data={data.workload}/><Evidence title="Attendance Context" data={data.attendance}/><Evidence title="Approved Leave Context" data={data.leave}/><Evidence title="Substitute-period Context" data={data.substitute}/><Evidence title="Homework Activity" data={data.homework}/><Evidence title="Marks Workflow" data={data.assessmentWorkflow}/><Evidence title="Aggregate Student Outcomes" data={data.studentOutcome}/><Evidence title="Report-card Completion" data={data.reportCard}/><Evidence title="KG Rubric Completion" data={data.kgRubric}/>
    <section className="card card-pad"><h3>Data Quality</h3><div className="table-wrap"><table><tbody>{Object.entries(data.dataQuality ?? {}).map(([key,value]) => <tr key={key}><th>{key.replaceAll(/([A-Z])/g," $1")}</th><td>{Array.isArray(value) ? value.join("; ") || "None" : String(value)}</td></tr>)}</tbody></table></div></section>
    <TeacherAnalyticsReviewForm snapshotId={row.id} review={row.review ? { ...row.review, updatedAt: row.review.updatedAt.toISOString(), nextReviewDate: row.review.nextReviewDate ? schoolDateKey(row.review.nextReviewDate) : undefined } : null} permissions={{ review: permissionSetCan(permissions,"REVIEW_TEACHER_ANALYTICS"), share: permissionSetCan(permissions,"SHARE_TEACHER_ANALYTICS_REVIEW"), finalise: permissionSetCan(permissions,"FINALISE_TEACHER_ANALYTICS_REVIEW"), regenerate: permissionSetCan(permissions,"GENERATE_TEACHER_ANALYTICS_SNAPSHOTS") }}/>
  </div>;
}
