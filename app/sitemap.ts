import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getPublishedPublicSettings } from "@/lib/public-website-content";
import { publicWebsiteBaseUrl, publicWebsiteIndexingEnabled } from "@/lib/public-website-seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getPublishedPublicSettings(prisma);
  if (!publicWebsiteIndexingEnabled(settings.publicSiteUrl)) return [];
  const now = new Date();
  const [pages, posts] = await Promise.all([
    prisma.publicWebsitePage.findMany({ where: { status: "PUBLISHED", indexable: true, currentPublishedVersionId: { not: null } }, select: { id: true, slug: true, updatedAt: true, pageType: true, currentPublishedVersionId: true } }),
    prisma.publicWebsitePost.findMany({ where: { status: "PUBLISHED", currentPublishedVersionId: { not: null }, OR: [{ publishAt: null }, { publishAt: { lte: now } }], AND: [{ OR: [{ expireAt: null }, { expireAt: { gt: now } }] }] }, select: { id: true, slug: true, updatedAt: true, currentPublishedVersionId: true } })
  ]);
  const [pageVersions, postVersions] = await Promise.all([
    prisma.publicWebsitePageVersion.findMany({ where: { id: { in: pages.flatMap((row) => row.currentPublishedVersionId ? [row.currentPublishedVersionId] : []) } }, select: { id: true, pageId: true, slugSnapshot: true } }),
    prisma.publicWebsitePostVersion.findMany({ where: { id: { in: posts.flatMap((row) => row.currentPublishedVersionId ? [row.currentPublishedVersionId] : []) } }, select: { id: true, postId: true, slugSnapshot: true } })
  ]);
  const pageVersionById = new Map(pageVersions.map((row) => [row.id, row]));
  const postVersionById = new Map(postVersions.map((row) => [row.id, row]));
  const base = publicWebsiteBaseUrl(settings.publicSiteUrl);
  return [
    ...pages.filter((page) => {
      const version = page.currentPublishedVersionId ? pageVersionById.get(page.currentPublishedVersionId) : null;
      return version?.pageId === page.id && version.slugSnapshot === page.slug &&
        (page.pageType !== "MANDATORY_DISCLOSURE" || settings.mandatoryDisclosureEnabled);
    }).map((page) => ({ url: `${base}${page.slug ? `/${page.slug}` : ""}`, lastModified: page.updatedAt, changeFrequency: "monthly" as const, priority: page.slug ? 0.7 : 1 })),
    { url: `${base}/news`, changeFrequency: "weekly" as const, priority: 0.7 },
    ...posts.filter((post) => {
      const version = post.currentPublishedVersionId ? postVersionById.get(post.currentPublishedVersionId) : null;
      return version?.postId === post.id && version.slugSnapshot === post.slug;
    }).map((post) => ({ url: `${base}/news/${post.slug}`, lastModified: post.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 }))
  ];
}
