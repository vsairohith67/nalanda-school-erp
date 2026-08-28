import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getPublishedPublicSettings } from "@/lib/public-website-content";
import { publicWebsiteBaseUrl, publicWebsiteIndexingEnabled } from "@/lib/public-website-seo";
import { PRIVATE_ROBOTS_EXCLUSIONS } from "@/lib/public-website-routing";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getPublishedPublicSettings(prisma);
  const index = publicWebsiteIndexingEnabled(settings.publicSiteUrl);
  return { rules: index ? [{ userAgent: "*", allow: "/", disallow: [...PRIVATE_ROBOTS_EXCLUSIONS] }] : [{ userAgent: "*", disallow: "/" }], sitemap: `${publicWebsiteBaseUrl(settings.publicSiteUrl)}/sitemap.xml`, host: publicWebsiteBaseUrl(settings.publicSiteUrl) };
}
