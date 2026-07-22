import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { CLASS_X_REPORT_ROW_LIMIT, classXPackageReport } from "@/lib/class-x-package-reports";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";

export default async function ClassXReportsPage() {
  const user = await requirePermission("VIEW_CLASS_X_PACKAGE_REPORTS");
  const [rows, canExport] = await Promise.all([prisma.classXDocumentPackage.findMany({ include: { items: true, charge: { include: { linkedMiscIncomeReceipt: true } } }, orderBy: { createdAt: "desc" }, take: CLASS_X_REPORT_ROW_LIMIT }), hasRolePermission(prisma, user.role, "EXPORT_CLASS_X_PACKAGE_REPORTS")]);
  const report = classXPackageReport(rows), cards = [["Packages", report.total], ["Parent requests", report.parentRequests], ["Missing school certificates", report.missingSchoolCertificates], ["Board awaiting receipt", report.boardAwaitingReceipt], ["Board awaiting verification", report.boardAwaitingVerification], ["Migration awaiting", report.migrationAwaiting], ["Ready items", report.readyForHandoverItems], ["Partial handovers", report.partialHandovers], ["Payment pending", report.paymentPending], ["Paid", report.paid], ["Waived", report.waived], ["Not required", report.notRequired], ["Mismatch count", report.mismatchCount], ["Average turnaround days", report.averageTurnaroundDays]];
  return <PageShell className="class-x-page"><PageHeader title="Class X Package Reports" description={`Privacy-safe reconciliation for the newest ${CLASS_X_REPORT_ROW_LIMIT} packages. Use operational filters for older records.`} action={canExport ? <a className="button" href="/api/class-x-documents/reports/export">Export Safe CSV</a> : undefined} />
    <div className="stats">{cards.map(([label, value]) => <div className="card stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <section className="card"><h3>Financial reconciliation</h3><dl className="detail-grid"><div><dt>Original package charges</dt><dd>₹{report.originalChargeTotal}</dd></div><div><dt>Package paid total</dt><dd>₹{report.paidTotal}</dd></div><div><dt>Linked Misc. Income total</dt><dd>₹{report.linkedMiscIncomeTotal}</dd></div><div><dt>Mismatch count</dt><dd>{report.mismatchCount} (expected zero)</dd></div></dl></section>
    <section className="card"><h3>Packages by status</h3><div className="table-wrap"><table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>{Object.entries(report.byStatus).map(([label, count]) => <tr key={label}><td>{label.replaceAll("_", " ")}</td><td>{count as number}</td></tr>)}</tbody></table></div></section>
    <p className="notice">CSV excludes Board serial numbers, sensitive demographics, Parent contacts, bank/UPI details, actor IDs, raw internal IDs, and fee-ledger data. Viewer access is aggregate-only with no export.</p>
  </PageShell>;
}
