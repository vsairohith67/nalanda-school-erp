import type { PrismaClient } from "@prisma/client";
import { parsePublicWebsiteBlocks } from "@/lib/public-website-blocks";
import { parsePublicWebsiteSeo, publicWebsiteIndexingEnabled } from "@/lib/public-website-seo";
import { PRIVATE_ROBOTS_EXCLUSIONS } from "@/lib/public-website-routing";

const REQUIRED_PAGE_TYPES = ["HOME", "ABOUT", "ACADEMICS", "ADMISSIONS", "FACILITIES", "STUDENT_LIFE", "CONTACT", "SCHOOL_APP", "PRIVACY", "ACCESSIBILITY", "TERMS"] as const;
const PAGE_STATUSES = ["DRAFT", "READY_FOR_REVIEW", "PUBLISHED", "ARCHIVED"] as const;
const PAGE_TYPES = [...REQUIRED_PAGE_TYPES, "MANDATORY_DISCLOSURE"] as const;
const POST_TYPES = ["NEWS", "ANNOUNCEMENT"] as const;

function identifier(row: { pageCode?: string; postNumber?: string }) {
  return row.pageCode ?? row.postNumber ?? "UNKNOWN";
}

export async function publicWebsiteReadinessReport(prisma: PrismaClient) {
  const [pages, posts, settings, navigation, pageVersions, postVersions] = await Promise.all([
    prisma.publicWebsitePage.findMany({ orderBy: { pageCode: "asc" } }),
    prisma.publicWebsitePost.findMany({ orderBy: { postNumber: "asc" } }),
    prisma.publicWebsiteSettings.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } }),
    prisma.publicWebsiteNavigationItem.findMany({ include: { page: { select: { id: true, status: true, currentPublishedVersionId: true } } }, orderBy: [{ displayOrder: "asc" }, { itemCode: "asc" }] }),
    prisma.publicWebsitePageVersion.findMany({ select: { id: true, pageId: true, slugSnapshot: true } }),
    prisma.publicWebsitePostVersion.findMany({ select: { id: true, postId: true, slugSnapshot: true } })
  ]);
  const pageVersionById = new Map(pageVersions.map((row) => [row.id, row]));
  const postVersionById = new Map(postVersions.map((row) => [row.id, row]));
  const pageHasValidCurrent = (row: typeof pages[number]) => {
    const version = row.currentPublishedVersionId ? pageVersionById.get(row.currentPublishedVersionId) : null;
    return Boolean(version && version.pageId === row.id && version.slugSnapshot === row.slug);
  };
  const postHasValidCurrent = (row: typeof posts[number]) => {
    const version = row.currentPublishedVersionId ? postVersionById.get(row.currentPublishedVersionId) : null;
    return Boolean(version && version.postId === row.id && version.slugSnapshot === row.slug);
  };
  const now = new Date();
  const activePublishedPosts = posts.filter((row) =>
    row.status === "PUBLISHED" && postHasValidCurrent(row) &&
    (!row.publishAt || row.publishAt <= now) && (!row.expireAt || row.expireAt > now));
  const activePostSlugs = new Set(activePublishedPosts.map((row) => row.slug));
  const missingSeoTitles: string[] = [];
  const missingDescriptions: string[] = [];
  const headingIssues: string[] = [];
  const invalidBlocks: string[] = [];
  const invalidAltText: string[] = [];
  const brokenLinks: string[] = [];

  for (const row of [...pages, ...posts]) {
    const id = identifier(row);
    try {
      const seo = parsePublicWebsiteSeo(row.draftSeoJson);
      if (!seo.title) missingSeoTitles.push(id);
      if (!seo.description) missingDescriptions.push(id);
    } catch {
      missingSeoTitles.push(id);
      missingDescriptions.push(id);
    }
    try {
      const blocks = parsePublicWebsiteBlocks(row.draftContentJson);
      for (const block of blocks) {
        if (block.type === "REGISTERED_IMAGE" && !block.decorative && !String(block.alt ?? "").trim()) invalidAltText.push(id);
        const href = block.type === "HERO" ? String(block.primaryHref ?? "") : block.type === "CTA" ? String(block.href ?? "") : "";
        const newsMatch = /^\/news\/([a-z0-9-]+)$/.exec(href);
        if (newsMatch && !activePostSlugs.has(newsMatch[1])) brokenLinks.push(`${id}:${href}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid blocks";
      invalidBlocks.push(id);
      if (/heading/i.test(message)) headingIssues.push(id);
      if (/alt/i.test(message)) invalidAltText.push(id);
    }
  }
  for (const item of navigation) {
    if (item.destinationType === "PAGE" && (!item.page || item.page.status !== "PUBLISHED" || !item.page.currentPublishedVersionId || !pageHasValidCurrent(pages.find((page) => page.id === item.pageId)!))) {
      brokenLinks.push(`NAV:${item.itemCode}`);
    }
  }

  const indexingEnabled = publicWebsiteIndexingEnabled(settings?.publicSiteUrl);
  const sitemapPages = pages.filter((row) =>
    row.status === "PUBLISHED" && row.indexable && pageHasValidCurrent(row) &&
    (row.pageType !== "MANDATORY_DISCLOSURE" || settings?.mandatoryDisclosureEnabled));
  const staleBefore = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const staleContent = [...pages, ...posts]
    .filter((row) => row.status === "PUBLISHED" && row.updatedAt < staleBefore)
    .map(identifier);
  const accessibilityIssues = [...new Set([...headingIssues, ...invalidAltText, ...invalidBlocks])];
  const missingContactFields = [
    !settings?.publicAddress ? "address" : null,
    !settings?.publicOfficePhone ? "office phone" : null,
    !settings?.publicOfficeEmail ? "office email" : null,
    !settings?.publicOfficeHours ? "office hours" : null
  ].filter((value): value is string => Boolean(value));
  const counts = {
    totalPages: pages.length,
    totalPosts: posts.length,
    totalContentItems: pages.length + posts.length,
    pages: Object.fromEntries(PAGE_STATUSES.map((status) => [status, pages.filter((row) => row.status === status).length])),
    posts: Object.fromEntries(PAGE_STATUSES.map((status) => [status, posts.filter((row) => row.status === status).length])),
    pageTypes: Object.fromEntries(PAGE_TYPES.map((type) => [type, pages.filter((row) => row.pageType === type).length])),
    postTypes: Object.fromEntries(POST_TYPES.map((type) => [type, posts.filter((row) => row.postType === type).length])),
    pageVersions: pageVersions.length,
    postVersions: postVersions.length,
    publishedVersions: pageVersions.length + postVersions.length,
    pendingReviews: [...pages, ...posts].filter((row) => row.status === "READY_FOR_REVIEW").length,
    currentApprovals: [...pages, ...posts].filter((row) => row.approvedReviewVersion === row.reviewVersion).length,
    staleApprovals: [...pages, ...posts].filter((row) => row.approvedReviewVersion != null && row.approvedReviewVersion !== row.reviewVersion).length
  };
  return {
    generatedAt: now.toISOString(),
    counts,
    gaps: {
      unpublishedRequiredPages: REQUIRED_PAGE_TYPES.filter((type) => !pages.some((row) => row.pageType === type && row.status === "PUBLISHED" && pageHasValidCurrent(row))),
      missingSeoTitles: [...new Set(missingSeoTitles)],
      missingDescriptions: [...new Set(missingDescriptions)],
      headingIssues: [...new Set(headingIssues)],
      invalidBlocks: [...new Set(invalidBlocks)],
      invalidAltText: [...new Set(invalidAltText)],
      accessibilityIssues,
      brokenLinks: [...new Set(brokenLinks)],
      missingContactFields,
      publicContactComplete: missingContactFields.length === 0,
      mandatoryDisclosureReady: Boolean(settings?.mandatoryDisclosureEnabled && pages.some((row) => row.pageType === "MANDATORY_DISCLOSURE" && row.status === "PUBLISHED" && pageHasValidCurrent(row))),
      navigationIntegrity: brokenLinks.every((value) => !value.startsWith("NAV:")),
      orphanPublishedPages: pages.filter((row) => row.status === "PUBLISHED" && pageHasValidCurrent(row) && !navigation.some((item) => item.pageId === row.id)).map((row) => row.pageCode),
      scheduledPosts: posts.filter((row) => row.publishAt && row.publishAt > now).length,
      expiredPosts: posts.filter((row) => row.expireAt && row.expireAt <= now).length,
      staleContent,
      sitemapEntries: indexingEnabled ? sitemapPages.length + 1 + activePublishedPosts.length : 0,
      robotsIndexingEnabled: indexingEnabled,
      robotsExclusions: [...PRIVATE_ROBOTS_EXCLUSIONS]
    }
  };
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replaceAll("\r", " ").replaceAll("\n", " ");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function publicWebsiteReportCsv(report: Awaited<ReturnType<typeof publicWebsiteReadinessReport>>) {
  const rows: unknown[][] = [
    ["Metric", "Value"],
    ["Total pages", report.counts.totalPages],
    ["Total posts", report.counts.totalPosts],
    ["Total content items", report.counts.totalContentItems],
    ...PAGE_STATUSES.flatMap((status) => [
      [`Pages ${status.toLowerCase().replaceAll("_", " ")}`, report.counts.pages[status]],
      [`Posts ${status.toLowerCase().replaceAll("_", " ")}`, report.counts.posts[status]]
    ]),
    ...PAGE_TYPES.map((type) => [`Page type ${type}`, report.counts.pageTypes[type]]),
    ...POST_TYPES.map((type) => [`Post type ${type}`, report.counts.postTypes[type]]),
    ["Page versions", report.counts.pageVersions],
    ["Post versions", report.counts.postVersions],
    ["Published versions", report.counts.publishedVersions],
    ["Pending reviews", report.counts.pendingReviews],
    ["Current approvals", report.counts.currentApprovals],
    ["Stale approvals", report.counts.staleApprovals],
    ["Unpublished required pages", report.gaps.unpublishedRequiredPages.length],
    ["Missing SEO titles", report.gaps.missingSeoTitles.length],
    ["Missing SEO descriptions", report.gaps.missingDescriptions.length],
    ["Accessibility gaps", report.gaps.accessibilityIssues.length],
    ["Invalid alt text", report.gaps.invalidAltText.length],
    ["Broken links", report.gaps.brokenLinks.length],
    ["Public contact complete", report.gaps.publicContactComplete ? "YES" : "NO"],
    ["Navigation integrity", report.gaps.navigationIntegrity ? "PASS" : "FAIL"],
    ["Stale content", report.gaps.staleContent.length],
    ["Sitemap entries", report.gaps.sitemapEntries],
    ["Robots exclusions", report.gaps.robotsExclusions.length]
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
