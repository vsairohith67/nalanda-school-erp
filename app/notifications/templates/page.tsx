import { NotificationTemplateManager } from "@/components/notification-template-manager";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NotificationTemplatesPage() {
  await requirePermission("MANAGE_NOTIFICATION_TEMPLATES");
  const templates = await prisma.notificationTemplate.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
  return <div className="page notification-page"><PageHeader title="Notification Templates" description="Plain-text reusable IN_APP templates. Only schoolName and academicYear static placeholders are allowed." /><NotificationTemplateManager templates={templates} /></div>;
}
