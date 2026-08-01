import Link from "next/link";
import { PageHeader, StatCard } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { permissionSetCan } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";
import { loadSmsEmailReports } from "@/lib/sms-email-reports";

export default async function SmsEmailReportsPage() {
  const user = await requirePermission("VIEW_SMS_EMAIL_REPORTS"), permissions = await getCurrentUserEffectivePermissions(), report = await loadSmsEmailReports(prisma);
  return <div className="page sms-email-page"><PageHeader title="SMS and Email Aggregate Reports" description="Privacy-safe totals only: no full phone/email, engagement scores, open tracking or unread-parent list." action={permissionSetCan(permissions, "EXPORT_SMS_EMAIL_REPORTS") ? <Link className="button" href="/api/sms-email/reports/export">Export Safe CSV</Link> : undefined} />
    <div className="grid three"><StatCard label="Campaign recipients" value={String(report.totals.campaignRecipients)} /><StatCard label="Eligible / skipped" value={`${report.totals.eligible} / ${report.totals.skipped}`} /><StatCard label="Estimated SMS segments" value={String(report.totals.smsSegments)} /><StatCard label="Estimated cost minor" value={String(report.totals.estimatedCostMinor)} /></div>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Profile</th><th>Channel / mode</th><th>Status</th><th>SPF</th><th>DKIM</th><th>DMARC</th></tr></thead><tbody>{report.profiles.map((row: any) => <tr key={row.profileCode}><td>{row.profileCode}</td><td>{row.channel} / {row.mode}</td><td>{row.status}</td><td>{row.spfStatus}</td><td>{row.dkimStatus}</td><td>{row.dmarcStatus}</td></tr>)}</tbody></table></div></section>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Channel</th><th>Status</th><th>Eligible</th><th>Skipped</th><th>Estimate</th></tr></thead><tbody>{report.batches.map((row: any) => <tr key={row.batchNumber}><td>{row.batchNumber}</td><td>{row.channel}</td><td>{row.status}</td><td>{row.totalEligibleContacts}</td><td>{row.totalSkipped}</td><td>{row.estimatedMaximumCostMinor ?? "Not configured"}</td></tr>)}{!report.batches.length ? <tr><td colSpan={6}>No batches.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
