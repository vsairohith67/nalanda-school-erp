import Link from "next/link";
import { notFound } from "next/navigation";
import { NotificationWorkflowActions } from "@/components/notification-workflow-actions";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function NotificationCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("CREATE_NOTIFICATION_CAMPAIGNS");
  const { id } = await params;
  const [campaign, permissions] = await Promise.all([
    prisma.notificationCampaign.findUnique({
      where: { id },
      include: {
        template: { select: { templateCode: true, name: true } },
        correctionOfCampaign: { select: { id: true, campaignNumber: true } },
        supersededByCampaign: { select: { id: true, campaignNumber: true } },
        skippedRecipients: { select: { reasonCode: true } },
        events: { orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }
      }
    }),
    getCurrentUserEffectivePermissions()
  ]);
  if (!campaign) notFound();
  const actorIds = [...new Set(campaign.events.map((row) => row.recordedByUserId).filter((value): value is string => Boolean(value)))];
  const actorRows = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } }) : [];
  const actors = new Map(actorRows.map((row) => [row.id, `${row.name} (${row.role.replaceAll("_", " ")})`]));
  const skipped = Object.entries(campaign.skippedRecipients.reduce<Record<string, number>>((map, row) => {
    map[row.reasonCode] = (map[row.reasonCode] ?? 0) + 1; return map;
  }, {}));
  const snapshot = campaign.audienceSnapshotJson ? JSON.parse(campaign.audienceSnapshotJson) : null;
  return <div className="page notification-page"><PageHeader title={campaign.title} description={`${campaign.campaignNumber} · IN_APP only`} action={<StatusBadge status={campaign.status} />} />
    {campaign.correctionOfCampaign ? <div className="notice warn"><strong>CORRECTION</strong> of <Link href={`/notifications/manage/${campaign.correctionOfCampaign.id}`}>{campaign.correctionOfCampaign.campaignNumber}</Link>.</div> : null}
    {campaign.supersededByCampaign ? <div className="notice">A correction exists: <Link href={`/notifications/manage/${campaign.supersededByCampaign.id}`}>{campaign.supersededByCampaign.campaignNumber}</Link>. The original remains preserved.</div> : null}
    <section className="card card-pad"><div className="detail-grid"><div><dt>Category</dt><dd>{campaign.category}</dd></div><div><dt>Priority</dt><dd>{campaign.priority}</dd></div><div><dt>Audience</dt><dd>{campaign.audienceType}</dd></div><div><dt>Template snapshot</dt><dd>{campaign.template ? `${campaign.template.templateCode} · ${campaign.template.name}` : "No template"}</dd></div><div className="wide"><dt>Message</dt><dd className="notification-body">{campaign.body}</dd></div><div><dt>Action</dt><dd>{campaign.actionPath ? `${campaign.actionLabel} · ${campaign.actionPath}` : "None"}</dd></div><div><dt>Acknowledgment</dt><dd>{campaign.acknowledgmentRequired ? "Required — operational only" : "Not required"}</dd></div><div><dt>Scheduled</dt><dd>{campaign.scheduledFor?.toLocaleString("en-IN") ?? "No"}</dd></div><div><dt>Expires</dt><dd>{campaign.expiresAt?.toLocaleString("en-IN") ?? "No expiry"}</dd></div></div></section>
    <div className="grid three"><StatCard label="Recipient rows" value={campaign.totalRecipientRows} /><StatCard label="Read" value={campaign.totalRead} /><StatCard label="Acknowledged" value={campaign.totalAcknowledged} /></div>
    <NotificationWorkflowActions campaignId={campaign.id} status={campaign.status} permissions={{
      approve: permissionSetCan(permissions, "APPROVE_NOTIFICATION_CAMPAIGNS"),
      publish: permissionSetCan(permissions, "PUBLISH_NOTIFICATION_CAMPAIGNS"),
      schedule: permissionSetCan(permissions, "SCHEDULE_NOTIFICATION_CAMPAIGNS"),
      withdraw: permissionSetCan(permissions, "WITHDRAW_NOTIFICATION_CAMPAIGNS"),
      cancel: permissionSetCan(permissions, "CREATE_NOTIFICATION_CAMPAIGNS"),
      archive: permissionSetCan(permissions, "WITHDRAW_NOTIFICATION_CAMPAIGNS"),
      correction: permissionSetCan(permissions, "CREATE_NOTIFICATION_CAMPAIGNS")
    }} />
    <section className="card card-pad"><h3>Immutable Audience Snapshot</h3>{snapshot ? <pre className="notification-json">{JSON.stringify(snapshot, null, 2)}</pre> : <p>Recipient snapshot is created transactionally only when scheduled or published.</p>}{skipped.length ? <div className="table-wrap"><table><thead><tr><th>Skipped reason</th><th>Aggregate count</th></tr></thead><tbody>{skipped.map(([reason, count]) => <tr key={reason}><td>{reason}</td><td>{count}</td></tr>)}</tbody></table></div> : null}</section>
    <section className="card"><div className="section-title"><div><h3>Append-only Workflow History</h3><p>Recipient read events are not exposed as individual Parent surveillance.</p></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Event</th><th>Status</th><th>Reason / notes</th><th>Recorded by</th></tr></thead><tbody>{campaign.events.filter((row) => !["NOTIFICATION_READ","NOTIFICATION_ACKNOWLEDGED","NOTIFICATION_DISMISSED"].includes(row.eventType)).map((row) => <tr key={row.id}><td>{row.eventDate.toLocaleString("en-IN")}</td><td>{row.eventType.replaceAll("_", " ")}</td><td>{[row.previousStatus,row.newStatus].filter(Boolean).join(" → ") || "—"}</td><td>{row.reason ?? row.notes ?? "—"}</td><td>{row.recordedByUserId ? actors.get(row.recordedByUserId) ?? "Authorised user" : "System"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
