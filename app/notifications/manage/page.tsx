import Link from "next/link";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NotificationManagePage() {
  await requirePermission("CREATE_NOTIFICATION_CAMPAIGNS");
  const campaigns = await prisma.notificationCampaign.findMany({ orderBy: [{ createdAt: "desc" }] });
  const awaiting = campaigns.filter((row) => row.status === "READY_FOR_REVIEW").length;
  const active = campaigns.filter((row) => ["PUBLISHED","SCHEDULED"].includes(row.status)).length;
  return <div className="page notification-page"><PageHeader title="Notification Campaigns" description="IN_APP-only campaign workflow with immutable recipient snapshots." action={<div className="page-actions"><Link className="button" href="/notifications/manage/new">Create Campaign</Link><Link className="button secondary" href="/notifications/templates">Templates</Link><Link className="button secondary" href="/notifications/reports">Reports</Link></div>} /><div className="grid three"><StatCard label="Campaigns" value={campaigns.length} /><StatCard label="Awaiting review" value={awaiting} /><StatCard label="Published / scheduled" value={active} /></div><section className="card"><div className="table-wrap"><table><thead><tr><th>Campaign</th><th>Title</th><th>Status</th><th>Category / priority</th><th>Audience</th><th>Recipients</th><th>Read / acknowledged</th><th>Open</th></tr></thead><tbody>{campaigns.map((row) => <tr key={row.id}><td>{row.campaignNumber}</td><td>{row.correctionOfCampaignId ? <span className="badge warn">CORRECTION</span> : null} {row.title}</td><td><StatusBadge status={row.status} /></td><td>{row.category}<br/><small>{row.priority}</small></td><td>{row.audienceType}</td><td>{row.totalRecipientRows}<br/><small>{row.totalSkipped} skipped</small></td><td>{row.totalRead} / {row.totalAcknowledged}</td><td><Link href={`/notifications/manage/${row.id}`}>Open</Link></td></tr>)}{!campaigns.length ? <tr><td colSpan={8}>No notification campaigns yet.</td></tr> : null}</tbody></table></div></section></div>;
}
