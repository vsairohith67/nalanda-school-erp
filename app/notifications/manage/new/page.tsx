import { NotificationCampaignForm } from "@/components/notification-campaign-form";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewNotificationCampaignPage() {
  await requirePermission("CREATE_NOTIFICATION_CAMPAIGNS");
  const [templates, classSections] = await Promise.all([
    prisma.notificationTemplate.findMany({ where: { status: "ACTIVE" }, orderBy: [{ name: "asc" }] }),
    prisma.timetableClassSection.findMany({ where: { academicYear: "2026-27", isActive: true }, select: { className: true, section: true }, orderBy: [{ className: "asc" }, { section: "asc" }] })
  ]);
  return <div className="page notification-page"><PageHeader title="Create Notification Campaign" description="Save a Draft, preview with zero recipient writes, then submit for separate review and approval." /><NotificationCampaignForm templates={templates} classes={classSections} /></div>;
}
