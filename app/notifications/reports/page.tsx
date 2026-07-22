import { PageHeader, StatCard } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { buildNotificationReport } from "@/lib/notification-reports";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function NotificationReportsPage() {
  const user = await requirePermission("VIEW_NOTIFICATION_REPORTS");
  const [report, permissions] = await Promise.all([buildNotificationReport(prisma), getEffectivePermissions(prisma, user.role)]);
  return <div className="page notification-page"><PageHeader title="Notification Aggregate Reports" description="Aggregate-only reporting. No list of Parents who did not read and no individual Parent read surveillance." action={permissionSetCan(permissions, "EXPORT_NOTIFICATION_REPORTS") ? <a className="button" href="/api/notifications/reports/export">Export Aggregate CSV</a> : undefined} /><div className="grid three"><StatCard label="Campaigns" value={report.totals.campaigns} /><StatCard label="Recipient rows" value={report.totals.recipientRows} /><StatCard label="Read / acknowledged" value={`${report.totals.read} / ${report.totals.acknowledged}`} /></div><section className="card card-pad"><h3>Aggregate totals</h3><div className="detail-grid">{Object.entries(report.totals).map(([label, value]) => <div key={label}><dt>{label.replaceAll(/([A-Z])/g, " $1")}</dt><dd>{value ?? "Not available"}</dd></div>)}</div></section><section className="card"><div className="table-wrap"><table><thead><tr><th>Campaign</th><th>Status</th><th>Category</th><th>Audience</th><th>Recipients</th><th>Skipped</th><th>Read</th><th>Unread</th><th>Acknowledged</th><th>Dismissed</th></tr></thead><tbody>{report.campaigns.map((row: any) => <tr key={row.campaignNumber}><td>{row.campaignNumber}</td><td>{row.status}</td><td>{row.category}</td><td>{row.audienceType}</td><td>{row.recipientRows}</td><td>{row.skipped}</td><td>{row.read}</td><td>{row.unread}</td><td>{row.acknowledged}</td><td>{row.dismissed}</td></tr>)}</tbody></table></div></section></div>;
}
