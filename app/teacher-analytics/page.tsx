import Link from "next/link";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function TeacherAnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_TEACHER_ANALYTICS");
  const q = await searchParams;
  const [permissions, cycles] = await Promise.all([
    getEffectivePermissions(prisma, user.role),
    prisma.teacherAnalyticsReviewCycle.findMany({
      where: { ...(q.academicYear ? { academicYear: q.academicYear } : {}), ...(q.status ? { status: q.status } : {}), ...(q.from ? { periodEnd: { gte: new Date(`${q.from}T00:00:00+05:30`) } } : {}), ...(q.to ? { periodStart: { lte: new Date(`${q.to}T23:59:59+05:30`) } } : {}) },
      include: { _count: { select: { snapshots: true } }, snapshots: { select: { review: { select: { status: true } } } } },
      orderBy: { periodStart: "desc" }
    })
  ]);
  return <div className="page teacher-analytics-page">
    <PageHeader title="Teacher Performance Analytics" description="Evidence-based operational and academic context without a composite score, rank, or automatic employment decision." action={permissionSetCan(permissions, "MANAGE_TEACHER_ANALYTICS_CYCLES") ? <Link className="button" href="/teacher-analytics/new">Create Review Cycle</Link> : undefined}/>
    <p className="notice"><strong>Fairness boundary:</strong> category evidence is not directly comparable across different classes, subjects, age groups, or assessment formats. Student outcomes do not establish Teacher causation.</p>
    <div className="grid four"><StatCard label="Cycles" value={String(cycles.length)}/><StatCard label="Open" value={String(cycles.filter((c) => c.status === "OPEN").length)}/><StatCard label="Under Review" value={String(cycles.filter((c) => ["SNAPSHOTS_GENERATED", "UNDER_REVIEW"].includes(c.status)).length)}/><StatCard label="Finalised" value={String(cycles.filter((c) => c.status === "FINALISED").length)}/></div>
    <div className="page-actions">{permissionSetCan(permissions, "VIEW_TEACHER_ANALYTICS_REPORTS") ? <Link className="button secondary" href="/teacher-analytics/reports">Aggregate Reports</Link> : null}</div>
    <form className="card filter-grid"><label>Academic year<input name="academicYear" defaultValue={q.academicYear ?? ""}/></label><label>Status<select name="status" defaultValue={q.status ?? ""}><option value="">All</option>{["DRAFT","OPEN","SNAPSHOTS_GENERATED","UNDER_REVIEW","FINALISED","ARCHIVED","CANCELLED"].map((status) => <option key={status}>{status}</option>)}</select></label><label>Period from<input type="date" name="from" defaultValue={q.from ?? ""}/></label><label>Period to<input type="date" name="to" defaultValue={q.to ?? ""}/></label><button>Apply Filters</button><Link className="button secondary" href="/teacher-analytics">Clear</Link></form>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Cycle</th><th>Period</th><th>Status</th><th>Snapshots</th><th>Reviews Shared</th><th>Open</th></tr></thead><tbody>{cycles.map((cycle) => <tr key={cycle.id}><td>{cycle.title}<br/><small>{cycle.cycleCode} · {cycle.academicYear}</small></td><td>{cycle.periodStart.toLocaleDateString("en-IN")} – {cycle.periodEnd.toLocaleDateString("en-IN")}</td><td><StatusBadge status={cycle.status}/></td><td>{cycle._count.snapshots}</td><td>{cycle.snapshots.filter((s) => ["SHARED_WITH_TEACHER","TEACHER_RESPONSE_RECEIVED","FINALISED"].includes(s.review?.status ?? "")).length}</td><td><Link href={`/teacher-analytics/${cycle.id}`}>View Cycle</Link></td></tr>)}{!cycles.length ? <tr><td colSpan={6}>No analytics review cycles match these filters.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
