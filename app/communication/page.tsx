import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { communicationFeatureAvailability } from "@/lib/communication-policy";
import { listOwnCommunicationNotifications } from "@/lib/communication-service";
import { CommunicationNotificationCentre } from "@/components/communication-notification-centre";
import { PageHeader } from "@/components/ui";

export default async function CommunicationPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (!communicationFeatureAvailability("IN_APP").enabled) notFound();
  const user = await requirePermission("VIEW_OWN_NOTIFICATIONS"), params = await searchParams, archived = params.view === "archived";
  const notifications = await listOwnCommunicationNotifications(prisma, user.id, { archived });
  return <div className="page communication-page"><PageHeader title="Communication Centre" description="Your privacy-safe in-app notification centre. External Email, SMS, WhatsApp and native push remain operationally disabled." action={<div className="page-actions"><Link className="button secondary" href={archived ? "/communication" : "/communication?view=archived"}>{archived ? "Current" : "Archived"}</Link><Link className="button secondary" href="/communication/preferences">Preferences</Link></div>} /><CommunicationNotificationCentre items={notifications.items} archived={archived} /></div>;
}
