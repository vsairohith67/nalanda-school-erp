import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { getSchoolSettings } from "@/lib/school-settings";
import { PROGRESSION_DECISION_TYPES, PROGRESSION_STATUSES, decisionLabel, progressionInclude, progressionWhere } from "@/lib/student-progression";
import { displayDate } from "@/lib/format";

export default async function StudentProgressionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_STUDENT_PROGRESSION"); const sp = await searchParams;
  const [settings, permissions] = await Promise.all([getSchoolSettings(prisma), getCurrentUserEffectivePermissions()]);
  const academicYear = sp.academicYear?.trim() || settings.academicYear;
  const where = progressionWhere({ academicYear, decisionType: sp.decisionType, status: sp.status, className: sp.className, section: sp.section });
  const [decisions, allForYear] = await Promise.all([
    prisma.studentProgressionDecision.findMany({ where, include: progressionInclude, orderBy: [{ createdAt: "desc" }] }),
    prisma.studentProgressionDecision.findMany({ where: { academicYear }, select: { status: true, decisionType: true, fromClass: true, fromSection: true } })
  ]);
  const canManage = permissionSetCan(permissions, "MANAGE_STUDENT_PROGRESSION");
  return <div className="page">
    <PageHeader title="Student Progression" description="Preview-first promotion, repeat, transfer, left, dropout, passed-out, and correction decisions. Approval never finalizes automatically." action={canManage ? <Link className="button" href="/students/progression/new">Create Decision</Link> : undefined} />
    {!canManage ? <div className="notice notice-warning">Read-only progression report. You can review decisions, but management actions are unavailable.</div> : null}
    <section className="stats-grid progression-stats" aria-label="Progression counts by status">{PROGRESSION_STATUSES.map((status) => <div className="stat-card" key={status}><span>{decisionLabel(status)}</span><strong>{allForYear.filter((row) => row.status === status).length}</strong></div>)}</section>
    <section className="stats-grid progression-stats" aria-label="Progression counts by decision type">{PROGRESSION_DECISION_TYPES.map((type) => <div className="stat-card" key={type}><span>{decisionLabel(type)}</span><strong>{allForYear.filter((row) => row.decisionType === type).length}</strong></div>)}</section>
    <form className="card card-pad filters">
      <label>Academic year<input name="academicYear" defaultValue={academicYear} /></label>
      <label>Decision type<select name="decisionType" defaultValue={sp.decisionType ?? ""}><option value="">All types</option>{PROGRESSION_DECISION_TYPES.map((value) => <option key={value} value={value}>{decisionLabel(value)}</option>)}</select></label>
      <label>Status<select name="status" defaultValue={sp.status ?? ""}><option value="">All statuses</option>{PROGRESSION_STATUSES.map((value) => <option key={value} value={value}>{decisionLabel(value)}</option>)}</select></label>
      <label>Class<select name="className" defaultValue={sp.className ?? ""}><option value="">All classes</option>{[...new Set(allForYear.map((row) => row.fromClass).filter(Boolean))].map((value) => <option key={value!}>{value}</option>)}</select></label>
      <label>Section<select name="section" defaultValue={sp.section ?? ""}><option value="">All sections</option>{[...new Set(allForYear.map((row) => row.fromSection).filter(Boolean))].map((value) => <option key={value!}>{value}</option>)}</select></label><button>Apply filters</button>
    </form>
    <section className="card"><div className="section-title"><h3>{decisions.length} Decisions</h3><span className="muted-text">Fee warnings are informational only</span></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Year</th><th>Decision</th><th>From</th><th>Preview target</th><th>Effective</th><th>Status</th><th>Review</th></tr></thead><tbody>
      {decisions.map((row) => <tr key={row.id}><td>{row.student.admissionNo}<br /><span className="muted-text">{row.student.studentName}</span></td><td>{row.academicYear}</td><td>{decisionLabel(row.decisionType)}</td><td>{classValue(row.fromClass, row.fromSection)} / {decisionLabel(row.fromStatus || "-")}</td><td>{row.toAcademicYear ? `${row.toAcademicYear} / ` : ""}{classValue(row.toClass, row.toSection)}{row.toStatus ? ` / ${decisionLabel(row.toStatus)}` : ""}</td><td>{displayDate(row.effectiveDate)}</td><td><StatusBadge status={row.status} /></td><td><Link href={`/students/progression/${row.id}`}>View decision</Link></td></tr>)}
      {!decisions.length ? <tr><td colSpan={8}>No progression decisions match these filters.</td></tr> : null}
    </tbody></table></div></section>
  </div>;
}
function classValue(className: string | null, section: string | null) { return className ? `${className}${section ? `-${section}` : ""}` : "-"; }
