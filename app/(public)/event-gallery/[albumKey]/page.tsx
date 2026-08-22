import { notFound } from "next/navigation";
import { EventMediaGallery } from "@/components/event-media-gallery";
import { eventMediaPublicGalleryEnabled, getPublicEventMediaAlbums } from "@/lib/event-media";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function PublicEventAlbumPage({ params }: { params: Promise<{ albumKey: string }> }) {
  if (!eventMediaPublicGalleryEnabled()) notFound();
  const key = (await params).albumKey;
  const album = (await getPublicEventMediaAlbums(prisma)).find((row) => row.publicKey === key);
  if (!album) notFound();
  return <EventMediaGallery albums={[album]} audience="PUBLIC" />;
}
