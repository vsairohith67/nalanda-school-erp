import { PageHeader, PageShell } from "@/components/ui";
import { EventMediaWorkspace } from "@/components/event-media-workspace";
import { getCurrentUserEffectivePermissions } from "@/lib/auth";
import { listEventMediaDashboard } from "@/lib/event-media";
import { requireEventMediaManagementPermission } from "@/lib/event-media-api";
import { permissionSetCan } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EventMediaPage() {
  await requireEventMediaManagementPermission("VIEW_EVENT_MEDIA");
  const [dashboard, permissions] = await Promise.all([listEventMediaDashboard(prisma), getCurrentUserEffectivePermissions()]);
  const capabilities = {
    create: permissionSetCan(permissions, "CREATE_EVENT_MEDIA_ALBUMS"),
    upload: permissionSetCan(permissions, "UPLOAD_EVENT_MEDIA"),
    review: permissionSetCan(permissions, "REVIEW_EVENT_MEDIA"),
    consent: permissionSetCan(permissions, "MANAGE_MEDIA_PUBLICATION_CONSENT"),
    approve: permissionSetCan(permissions, "APPROVE_EVENT_MEDIA"),
    publish: permissionSetCan(permissions, "PUBLISH_EVENT_MEDIA"),
    archive: permissionSetCan(permissions, "ARCHIVE_EVENT_MEDIA")
  };
  return <PageShell className="event-media-page">
    <PageHeader title="Event Media" description="Originals stay private. Nothing is published without consent and explicit approval." />
    <EventMediaWorkspace initialData={JSON.parse(JSON.stringify(dashboard))} capabilities={capabilities} />
  </PageShell>;
}
