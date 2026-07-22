import Link from "next/link";
import { NotificationInbox } from "@/components/notification-inbox";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { listOwnNotifications } from "@/lib/notification-portals";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requirePermission("VIEW_OWN_NOTIFICATIONS");
  const { view } = await searchParams;
  const history = view === "history";
  const items = await listOwnNotifications(prisma, user, { history });
  return <div className="page notification-page"><PageHeader title="Notification Centre" description="Your authenticated in-app inbox. Read and acknowledgment are separate operational states." action={<div className="page-actions"><Link className={`button ${history ? "secondary" : ""}`} href="/notifications">Active</Link><Link className={`button ${history ? "" : "secondary"}`} href="/notifications?view=history">History</Link></div>} /><NotificationInbox items={items as any} history={history} /></div>;
}
