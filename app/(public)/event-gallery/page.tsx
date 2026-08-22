import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventMediaGallery } from "@/components/event-media-gallery";
import { eventMediaPublicGalleryEnabled, getPublicEventMediaAlbums } from "@/lib/event-media";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Event Gallery | Nalanda Public School", description: "Explicitly approved public event photographs.", robots: { index: false, follow: false } };

export default async function PublicEventGalleryPage() {
  if (!eventMediaPublicGalleryEnabled()) notFound();
  return <EventMediaGallery albums={await getPublicEventMediaAlbums(prisma)} audience="PUBLIC" />;
}
