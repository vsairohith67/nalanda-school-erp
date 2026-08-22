import { EventMediaGallery } from "@/components/event-media-gallery";
import { requireRolePermission } from "@/lib/auth";
import { getParentEventMedia } from "@/lib/event-media";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function ParentEventMediaPage() {
  const user = await requireRolePermission("VIEW_OWN_EVENT_MEDIA", "PARENT");
  const albums = user.guardianId ? await getParentEventMedia(prisma, user.guardianId) : [];
  return <EventMediaGallery albums={albums} audience="PARENT_PORTAL" />;
}
