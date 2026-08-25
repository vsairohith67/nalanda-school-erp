import { PageHeader } from "@/components/ui";
import { UdiseNav } from "@/components/udise-nav";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { filterUdiseEvidenceRegister, UDISE_EVIDENCE, UDISE_GROUP_STATUSES, UDISE_REGISTER_TOTALS } from "@/lib/udise-evidence-register";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function UdiseRegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("VIEW_UDISE_CHECKLIST");
  const [search, permissions] = await Promise.all([searchParams, getCurrentUserEffectivePermissions()]);
  const rows = filterUdiseEvidenceRegister({ domain: search.domain, status: search.status });
  const action = permissionSetCan(permissions, "EXPORT_UDISE_CHECKLIST")
    ? <a className="button" href="/api/udise/export?kind=source-register">Export source register</a>
    : undefined;
  return <div className="page udise-page">
    <PageHeader title="UDISE+ 2026-27 Source Register" description="A static, source-attributed schedule of 75 evidence groups. It stores no portal or school values." action={action} />
    <div className="notice-warning udise-warning"><strong>{UDISE_EVIDENCE.planningBoundary}</strong><span>{UDISE_EVIDENCE.portalVerificationWarning}</span></div>
    <UdiseNav current="register" showRows={permissionSetCan(permissions, "VIEW_UDISE_MASKED_ROWS")} />
    <section className="lifecycle-stats" aria-label="Register reconciliation">
      <div className="stat-card"><span>Total groups</span><strong>{UDISE_REGISTER_TOTALS.total}</strong></div>
      <div className="stat-card"><span>Domains</span><strong>18 School · 15 Facility · 27 Student · 14 Staff · 1 Block</strong></div>
      <div className="stat-card"><span>Primary statuses</span><strong>8 tracked · 21 partial · 23 not tracked · 17 sensitive/conditional · 6 portal-only</strong></div>
    </section>
    <form className="card card-pad filters udise-filters">
      <label>Domain<select name="domain" defaultValue={search.domain ?? ""}><option value="">All domains</option>{["SCHOOL", "FACILITY", "STUDENT", "STAFF", "BLOCK"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Primary status<select name="status" defaultValue={search.status ?? ""}><option value="">All statuses</option>{UDISE_GROUP_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label>
      <button>Apply filters</button>
    </form>
    <section className="card">
      <div className="section-title"><h3>{rows.length} evidence groups</h3><span className="muted">Source {UDISE_EVIDENCE.sourceId} · reviewed {UDISE_EVIDENCE.reviewedDate}</span></div>
      <div className="table-wrap udise-table-wrap"><table><thead><tr><th>Evidence</th><th>Official source</th><th>Domain</th><th>Official group</th><th>Primary status</th><th>ERP mapping</th><th>Applicability</th><th>Sensitivity</th><th>Next action</th></tr></thead><tbody>
        {rows.map((row) => <tr key={row.id}><td>{row.evidenceId}</td><td>{row.sourceReference}</td><td>{row.domain}</td><td><strong>{row.id}</strong><br />{row.label}</td><td>{row.primaryStatus}</td><td>{row.currentErpMapping}</td><td>{row.applicability}</td><td>{row.sensitivity}</td><td>{row.recommendation}</td></tr>)}
        {!rows.length ? <tr><td colSpan={9}>No source groups match the selected filters.</td></tr> : null}
      </tbody></table></div>
    </section>
  </div>;
}
