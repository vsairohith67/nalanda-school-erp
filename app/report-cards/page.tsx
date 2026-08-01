import Link from "next/link";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { reportCardScopeWhere, resolveReportCardScope } from "@/lib/report-card-scope";

export default async function ReportCardsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_REPORT_CARDS");
  const q = await searchParams;
  const [permissions, scope] = await Promise.all([getCurrentUserEffectivePermissions(), resolveReportCardScope(prisma, user, q.academicYear)]);
  const batches = await prisma.reportCardBatch.findMany({
    where: {
      ...(q.academicYear ? { academicYear: q.academicYear } : {}),
      ...(q.reportType ? { reportType: q.reportType } : {}),
      ...(q.className ? { className: q.className } : {}),
      ...(q.section ? { section: q.section } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(!scope.broad ? { reportCards: { some: reportCardScopeWhere(scope) } } : {})
    },
    include: { reportCards: { where: reportCardScopeWhere(scope), select: { status: true } } },
    orderBy: { createdAt: "desc" }
  });
  const count = (status: string) => batches.filter((batch) => batch.status === status).length;
  return <div className="page report-cards-page">
    <PageHeader
      title="Digital Report Cards"
      description="Governed locked-result publication, Parent delivery, PDFs, and the retained entry/approval workflows."
      action={<div className="page-actions">
        {permissionSetCan(permissions, "ISSUE_REPORT_CARDS") ? <Link className="button" href="/report-cards/publication">Publication Workspace</Link> : null}
        {permissionSetCan(permissions, "MANAGE_REPORT_CARD_BATCHES") ? <Link className="button secondary" href="/report-cards/batches/new">Create Legacy Entry Batch</Link> : null}
      </div>}
    />
    {scope.reason ? <p className="notice">{scope.reason}</p> : null}
    <div className="grid four">
      <StatCard label="Draft / Entry" value={String(count("DRAFT") + count("OPEN_FOR_ENTRY"))}/><StatCard label="Submitted" value={String(count("SUBMITTED"))}/><StatCard label="Approved" value={String(count("APPROVED"))}/><StatCard label="Issued" value={String(count("ISSUED"))}/>
    </div>
    <div className="page-actions">{permissionSetCan(permissions, "MANAGE_REPORT_CARD_TEMPLATES") ? <Link className="button secondary" href="/report-cards/templates">Templates & Grading</Link> : null}{permissionSetCan(permissions, "VIEW_REPORT_CARD_REPORTS") ? <Link className="button secondary" href="/report-cards/reports">Operational Reports</Link> : null}</div>
    <form className="card filter-grid">
      <label>Academic year<input name="academicYear" defaultValue={q.academicYear ?? ""}/></label>
      <label>Type<select name="reportType" defaultValue={q.reportType ?? ""}><option value="">All</option><option value="MARK_BASED">Mark Based</option><option value="KG_RUBRIC">KG Rubric</option></select></label>
      <label>Class<input name="className" defaultValue={q.className ?? ""}/></label><label>Section<input name="section" defaultValue={q.section ?? ""}/></label>
      <label>Status<select name="status" defaultValue={q.status ?? ""}><option value="">All</option>{["DRAFT", "OPEN_FOR_ENTRY", "SUBMITTED", "APPROVED", "ISSUED", "ARCHIVED", "CANCELLED"].map((status) => <option key={status}>{status}</option>)}</select></label>
      <button>Apply Filters</button><Link className="button secondary" href="/report-cards">Clear</Link>
    </form>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Title</th><th>Scope</th><th>Type</th><th>Status</th><th>Student Cards</th><th>Open</th></tr></thead><tbody>
      {batches.map((batch) => <tr key={batch.id}><td>{batch.batchNumber}</td><td>{batch.title}</td><td>{batch.className}{batch.section ? `-${batch.section}` : ""}<br/><small>{batch.academicYear}</small></td><td>{batch.reportType.replaceAll("_", " ")}</td><td><StatusBadge status={batch.status}/></td><td>{batch.reportCards.length}</td><td><Link href={`/report-cards/batches/${batch.id}`}>View Batch</Link></td></tr>)}
      {!batches.length ? <tr><td colSpan={7}>No authorised report-card batches match these filters.</td></tr> : null}
    </tbody></table></div></section>
  </div>;
}
