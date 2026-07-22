import Link from "next/link";
import { redirect } from "next/navigation";
import { NotificationInbox } from "@/components/notification-inbox";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { getPublishedNoticesForChild, noticeAudienceLabel } from "@/lib/notices";
import { getLinkedChildrenForParent } from "@/lib/parent-portal";
import { listOwnNotifications } from "@/lib/notification-portals";
import { prisma } from "@/lib/prisma";

export default async function ParentNotificationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requirePermission("VIEW_OWN_NOTIFICATIONS");
  if (user.role !== "PARENT") redirect("/unauthorized");
  const history = (await searchParams).view === "history";
  const [{ children }, inbox] = await Promise.all([getLinkedChildrenForParent(user.id), listOwnNotifications(prisma, user, { history })]);
  const noticeRows = await Promise.all(children.map(async (child) => ({ child, notices: await getPublishedNoticesForChild(child) })));
  const legacy = new Map<string, { id: string; title: string; body: string; audienceLabel: string; publishDate: Date | null; children: string[] }>();
  for (const group of noticeRows) for (const notice of group.notices) {
    const existing = legacy.get(notice.id);
    if (existing) existing.children.push(group.child.studentName);
    else legacy.set(notice.id, { ...notice, audienceLabel: noticeAudienceLabel(notice), children: [group.child.studentName] });
  }
  return <div className="page notification-page parent-notifications"><PageHeader title="Parent Notification Centre" description="Only notifications addressed to this Parent User, with child context derived from current Guardian–Student ownership." action={<div className="page-actions"><Link className="button secondary" href="/parent/notifications">Active</Link><Link className="button secondary" href="/parent/notifications?view=history">History</Link></div>} /><NotificationInbox items={inbox as any} history={history} /><section className="card card-pad"><div className="section-title"><div><h2>Legacy Notices</h2><p>Existing Parent Notices remain unchanged. They do not have fabricated recipient rows, read receipts, or acknowledgments.</p></div><Link href="/parent">Open Parent Portal</Link></div><div className="parent-notice-list">{[...legacy.values()].map((notice) => <article className="notice parent-notice-card" key={notice.id}><div className="parent-notice-heading"><strong>{notice.title}</strong><span className="badge">Legacy Notice</span></div><small>{notice.audienceLabel} · {notice.children.join(", ")}</small><p>{notice.body}</p></article>)}{!legacy.size ? <p>No current legacy notices.</p> : null}</div></section></div>;
}
