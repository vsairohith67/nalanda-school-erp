import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { communicationFeatureAvailability } from "@/lib/communication-policy";
import { CommunicationPreferencesForm } from "@/components/communication-preferences-form";
import { PageHeader } from "@/components/ui";

export default async function CommunicationPreferencesPage() {
  if (!communicationFeatureAvailability().enabled) notFound();
  await requirePermission("VIEW_OWN_NOTIFICATIONS");
  return <div className="page communication-page"><PageHeader title="Communication Preferences" description="Configure only your own optional channel, language and quiet-hour preferences. Contact values remain masked." action={<Link className="button secondary" href="/communication">Notification centre</Link>} /><CommunicationPreferencesForm /></div>;
}
