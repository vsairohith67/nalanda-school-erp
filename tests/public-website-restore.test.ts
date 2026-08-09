import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { createBackupDocument } from "../lib/backup";
import { restorePublicWebsiteData } from "../lib/public-website-restore";
import { publicWebsiteReadinessReport, publicWebsiteReportCsv } from "../lib/public-website-reports";
import { parseAndValidateBackup } from "../lib/restore";
import { createFreshTestDatabase, removeFreshTestDatabase } from "./helpers/fresh-test-database";

const websiteKeys = [
  "publicWebsiteSettings", "publicWebsitePages", "publicWebsitePageVersions",
  "publicWebsitePosts", "publicWebsitePostVersions", "publicWebsiteNavigationItems",
  "publicWebsiteEvents"
] as const;

function fileUrl(filename: string) {
  return `file:${filename.replaceAll("\\", "/")}`;
}

function entityResult() {
  return { created: 0, updated: 0, skipped: 0, errors: [] as string[], warnings: [] as string[] };
}

function restoreResult() {
  return {
    publicWebsiteSettings: entityResult(),
    publicWebsitePages: entityResult(),
    publicWebsitePageVersions: entityResult(),
    publicWebsitePosts: entityResult(),
    publicWebsitePostVersions: entityResult(),
    publicWebsiteNavigationItems: entityResult(),
    publicWebsiteEvents: entityResult(),
    warnings: [] as string[]
  };
}

async function clearWebsiteRows(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.publicWebsiteEvent.deleteMany(),
    prisma.publicWebsiteNavigationItem.deleteMany(),
    prisma.publicWebsitePostVersion.deleteMany(),
    prisma.publicWebsitePost.deleteMany(),
    prisma.publicWebsitePageVersion.deleteMany(),
    prisma.publicWebsitePage.deleteMany(),
    prisma.publicWebsiteSettings.deleteMany()
  ]);
}

async function seedWebsiteRows(prisma: PrismaClient) {
  const now = new Date("2026-07-20T04:30:00.000Z");
  const blocks = JSON.stringify([{ type: "HERO", heading: "QA20D Reviewed Page", body: "Controlled copied-database restore rehearsal." }]);
  const pageSeo = JSON.stringify({
    title: "QA20D Reviewed Page | Nalanda Public School",
    description: "QA20D leadership-reviewed public page used only for a copied-database backup and restore rehearsal.",
    canonicalPath: "/about",
    socialImageKey: "NALANDA_LOGO"
  });
  const postSeo = JSON.stringify({
    title: "QA20D Reviewed News | Nalanda Public School",
    description: "QA20D leadership-reviewed public news used only for a copied-database backup and restore rehearsal.",
    canonicalPath: "/news/qa20d-restore-news",
    socialImageKey: "NALANDA_LOGO"
  });
  await prisma.publicWebsiteSettings.create({ data: {
    id: "qa20d-settings", settingsCode: "QA20D-SETTINGS", siteName: "Nalanda Public School",
    shortName: "Nalanda", tagline: "Controlled QA20D restore rehearsal.", publicSiteUrl: "https://nalandaps.com",
    publicAddress: "Approved public office address", publicOfficePhone: "Approved public office phone",
    publicOfficeEmail: "office@nalandaps.com", publicOfficeHours: "School office hours",
    portalLoginPath: "/login", defaultSeoTitle: "Nalanda Public School | Learning with purpose",
    defaultSeoDescription: "Leadership-reviewed public information about Nalanda Public School and its secure portal.",
    defaultSocialImageKey: "NALANDA_LOGO", themeConfigJson: "{}", contactConfigJson: "{}",
    mandatoryDisclosureEnabled: false, status: "PUBLISHED", reviewVersion: 1,
    approvedReviewVersion: 1, reviewedAt: now, publishedAt: now, createdAt: now, updatedAt: now
  } });
  await prisma.publicWebsitePage.createMany({ data: [
    {
      id: "qa20d-page-about", pageCode: "QA20D-ABOUT", pageType: "ABOUT", title: "QA20D About",
      slug: "about", navigationLabel: "About", summary: "Controlled public page.", draftContentJson: blocks,
      draftSeoJson: pageSeo, status: "PUBLISHED", reviewVersion: 2, approvedReviewVersion: 2,
      currentPublishedVersionId: "qa20d-page-about-v2", showInNavigation: true, navigationOrder: 1,
      indexable: true, reviewedAt: now, publishedAt: now, createdAt: now, updatedAt: now
    },
    {
      id: "qa20d-page-academics", pageCode: "QA20D-ACADEMICS", pageType: "ACADEMICS", title: "QA20D Academics",
      slug: "academics", summary: "Controlled draft page.", draftContentJson: blocks,
      draftSeoJson: pageSeo.replace("/about", "/academics"), status: "DRAFT", reviewVersion: 1,
      showInNavigation: false, indexable: true, createdAt: now, updatedAt: now
    }
  ] });
  await prisma.publicWebsitePageVersion.createMany({ data: [
    {
      id: "qa20d-page-about-v1", pageId: "qa20d-page-about", versionNumber: 1, versionType: "ORIGINAL",
      titleSnapshot: "QA20D About", slugSnapshot: "about", contentSnapshotJson: blocks, seoSnapshotJson: pageSeo,
      settingsSnapshotJson: "{}", contentHash: "A".repeat(64), publicationReason: "QA20D original",
      publishedAt: now, createdAt: now
    },
    {
      id: "qa20d-page-about-v2", pageId: "qa20d-page-about", versionNumber: 2, versionType: "CORRECTION",
      titleSnapshot: "QA20D About", slugSnapshot: "about", contentSnapshotJson: blocks, seoSnapshotJson: pageSeo,
      settingsSnapshotJson: "{}", contentHash: "B".repeat(64), correctionReason: "QA20D correction",
      supersedesVersionId: "qa20d-page-about-v1", publishedAt: now, createdAt: now
    }
  ] });
  await prisma.publicWebsitePost.createMany({ data: [
    {
      id: "qa20d-post-news", postNumber: "QA20D-NEWS-RESTORE", postType: "NEWS", title: "QA20D Reviewed News",
      slug: "qa20d-restore-news", summary: "Controlled public news.", draftContentJson: blocks,
      draftSeoJson: postSeo, status: "PUBLISHED", reviewVersion: 2, approvedReviewVersion: 2,
      currentPublishedVersionId: "qa20d-post-news-v2", featured: true, reviewedAt: now,
      publishedAt: now, createdAt: now, updatedAt: now
    },
    {
      id: "qa20d-post-draft", postNumber: "QA20D-NEWS-DRAFT", postType: "ANNOUNCEMENT", title: "QA20D Draft News",
      slug: "qa20d-draft-news", summary: "Controlled draft news.", draftContentJson: blocks,
      draftSeoJson: postSeo.replaceAll("qa20d-restore-news", "qa20d-draft-news"), status: "DRAFT",
      reviewVersion: 1, featured: false, createdAt: now, updatedAt: now
    }
  ] });
  await prisma.publicWebsitePostVersion.createMany({ data: [
    {
      id: "qa20d-post-news-v1", postId: "qa20d-post-news", versionNumber: 1, versionType: "ORIGINAL",
      titleSnapshot: "QA20D Reviewed News", slugSnapshot: "qa20d-restore-news", summarySnapshot: "Controlled public news.",
      contentSnapshotJson: blocks, seoSnapshotJson: postSeo, contentHash: "C".repeat(64),
      publicationReason: "QA20D original", publishedAt: now, createdAt: now
    },
    {
      id: "qa20d-post-news-v2", postId: "qa20d-post-news", versionNumber: 2, versionType: "CORRECTION",
      titleSnapshot: "QA20D Reviewed News", slugSnapshot: "qa20d-restore-news", summarySnapshot: "Controlled public news.",
      contentSnapshotJson: blocks, seoSnapshotJson: postSeo, contentHash: "D".repeat(64),
      correctionReason: "QA20D correction", supersedesVersionId: "qa20d-post-news-v1",
      publishedAt: now, createdAt: now
    }
  ] });
  await prisma.publicWebsiteNavigationItem.createMany({ data: [
    {
      id: "qa20d-nav-about", itemCode: "QA20D-NAV-ABOUT", label: "About", destinationType: "PAGE",
      pageId: "qa20d-page-about", displayOrder: 1, placement: "BOTH", enabled: true,
      opensNewTab: false, createdAt: now, updatedAt: now
    },
    {
      id: "qa20d-nav-login", itemCode: "QA20D-NAV-LOGIN", label: "School Portal", destinationType: "PORTAL_LOGIN",
      displayOrder: 2, placement: "BOTH", enabled: true, opensNewTab: false, createdAt: now, updatedAt: now
    }
  ] });
  await prisma.publicWebsiteEvent.create({ data: {
    id: "qa20d-event", entityType: "PAGE", entityId: "qa20d-page-about", eventType: "PAGE_CORRECTED",
    eventDate: now, safeReason: "QA20D copied-database rehearsal",
    safeMetadataJson: JSON.stringify({ versionId: "qa20d-page-about-v2" }), createdAt: now
  } });
}

async function websiteRows(prisma: PrismaClient) {
  return {
    publicWebsiteSettings: await prisma.publicWebsiteSettings.findMany({ orderBy: { id: "asc" } }),
    publicWebsitePages: await prisma.publicWebsitePage.findMany({ orderBy: { id: "asc" } }),
    publicWebsitePageVersions: await prisma.publicWebsitePageVersion.findMany({ orderBy: { id: "asc" } }),
    publicWebsitePosts: await prisma.publicWebsitePost.findMany({ orderBy: { id: "asc" } }),
    publicWebsitePostVersions: await prisma.publicWebsitePostVersion.findMany({ orderBy: { id: "asc" } }),
    publicWebsiteNavigationItems: await prisma.publicWebsiteNavigationItem.findMany({ orderBy: { id: "asc" } }),
    publicWebsiteEvents: await prisma.publicWebsiteEvent.findMany({ orderBy: { id: "asc" } })
  };
}

function websiteHash(rows: Awaited<ReturnType<typeof websiteRows>>) {
  return createHash("sha256")
    .update(JSON.stringify(rows, (key, value) => key === "updatedAt" ? undefined : value))
    .digest("hex")
    .toUpperCase();
}

describe("Prompt 20D copied-database website restore", () => {
  it("restores all seven arrays, preserves links, and is idempotent", async () => {
    const sourcePath = createFreshTestDatabase("public-website-restore-source");
    const targetPath = createFreshTestDatabase("public-website-restore-target");
    const source = new PrismaClient({ datasources: { db: { url: fileUrl(sourcePath) } } });
    const target = new PrismaClient({ datasources: { db: { url: fileUrl(targetPath) } } });
    try {
      await clearWebsiteRows(source);
      await clearWebsiteRows(target);
      await seedWebsiteRows(source);
      const sourceRows = await websiteRows(source);
      const backup = createBackupDocument({
        generatedAt: new Date("2026-07-20T05:00:00.000Z"), generatedBy: "QA20D copied-database rehearsal",
        students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], ...sourceRows
      });
      expect(backup.metadata.backupVersion).toBe(40);
      for (const key of websiteKeys) expect(backup.metadata.counts[key]).toBe(sourceRows[key].length);
      const parsed = parseAndValidateBackup(backup);

      const first = restoreResult();
      await restorePublicWebsiteData(target as never, parsed, first);
      expect(websiteHash(await websiteRows(target))).toBe(websiteHash(sourceRows));
      expect(first.warnings).toEqual([]);
      for (const key of websiteKeys) {
        expect(first[key].created).toBe(sourceRows[key].length);
        expect(first[key].errors).toEqual([]);
      }
      const restoredPage = await target.publicWebsitePage.findUnique({ where: { id: "qa20d-page-about" } });
      const restoredPageVersion = await target.publicWebsitePageVersion.findUnique({ where: { id: "qa20d-page-about-v2" } });
      const restoredPost = await target.publicWebsitePost.findUnique({ where: { id: "qa20d-post-news" } });
      const restoredPostVersion = await target.publicWebsitePostVersion.findUnique({ where: { id: "qa20d-post-news-v2" } });
      expect(restoredPage?.currentPublishedVersionId).toBe(restoredPageVersion?.id);
      expect(restoredPageVersion?.supersedesVersionId).toBe("qa20d-page-about-v1");
      expect(restoredPost?.currentPublishedVersionId).toBe(restoredPostVersion?.id);
      expect(restoredPostVersion?.supersedesVersionId).toBe("qa20d-post-news-v1");
      const report = await publicWebsiteReadinessReport(target);
      expect(report.counts).toMatchObject({
        totalPages: 2, totalPosts: 2, totalContentItems: 4,
        pageVersions: 2, postVersions: 2, publishedVersions: 4,
        pageTypes: { ABOUT: 1, ACADEMICS: 1 },
        postTypes: { NEWS: 1, ANNOUNCEMENT: 1 }
      });
      expect(report.gaps).toMatchObject({
        publicContactComplete: true, navigationIntegrity: true,
        accessibilityIssues: [], brokenLinks: [], invalidAltText: [],
        sitemapEntries: 0, robotsIndexingEnabled: false
      });
      expect(report.gaps.robotsExclusions).toEqual(expect.arrayContaining(["/api", "/website-admin", "/students", "/payments", "/login"]));
      const csv = publicWebsiteReportCsv(report);
      expect(csv).toContain('"Page versions","2"');
      expect(csv).toContain('"Robots exclusions"');
      expect(csv).not.toContain("Controlled copied-database restore rehearsal");
      expect(csv).not.toMatch(/actor|filesystem|credential|password/i);

      const beforeSecondHash = websiteHash(await websiteRows(target));
      const second = restoreResult();
      await restorePublicWebsiteData(target as never, parsed, second);
      expect(websiteHash(await websiteRows(target))).toBe(beforeSecondHash);
      for (const key of websiteKeys) {
        expect(second[key].created).toBe(0);
        expect(second[key].updated).toBe(0);
        expect(second[key].errors).toEqual([]);
      }
    } finally {
      await source.$disconnect();
      await target.$disconnect();
      removeFreshTestDatabase(sourcePath);
      removeFreshTestDatabase(targetPath);
    }
  });

  it("isolates a natural-key collision without overwriting local content", async () => {
    const databasePath = createFreshTestDatabase("public-website-collision-target");
    const target = new PrismaClient({ datasources: { db: { url: fileUrl(databasePath) } } });
    try {
      await clearWebsiteRows(target);
      await target.publicWebsitePage.create({ data: {
        id: "local-page", pageCode: "QA20D-ABOUT", pageType: "ABOUT", title: "Preserved local title",
        slug: "about", draftContentJson: JSON.stringify([{ type: "HERO", heading: "Local", body: "Preserved." }]),
        draftSeoJson: JSON.stringify({
          title: "Preserved Local Nalanda Page", description: "Preserved local public content that must not be overwritten by a colliding restore.",
          canonicalPath: "/about", socialImageKey: "NALANDA_LOGO"
        }),
        status: "DRAFT", reviewVersion: 1, showInNavigation: false, indexable: true
      } });
      const sourcePath = createFreshTestDatabase("public-website-collision-source");
      const source = new PrismaClient({ datasources: { db: { url: fileUrl(sourcePath) } } });
      try {
        await clearWebsiteRows(source);
        await seedWebsiteRows(source);
        const sourceRows = await websiteRows(source);
        const parsed = parseAndValidateBackup(createBackupDocument({
          generatedAt: new Date("2026-07-20T05:00:00.000Z"), generatedBy: "QA20D collision rehearsal",
          students: [], feeStructures: [], payments: [], paymentAudits: [], users: [], ...sourceRows
        }));
        const result = restoreResult();
        await restorePublicWebsiteData(target as never, parsed, result);
        expect(result.warnings.some((warning) => warning.includes("collided"))).toBe(true);
        expect(await target.publicWebsitePage.findUnique({ where: { id: "local-page" } })).toMatchObject({ title: "Preserved local title" });
        expect(await target.publicWebsitePage.findUnique({ where: { id: "qa20d-page-about" } })).toBeNull();
        expect(await target.publicWebsitePageVersion.count({ where: { pageId: "qa20d-page-about" } })).toBe(0);
      } finally {
        await source.$disconnect();
        removeFreshTestDatabase(sourcePath);
      }
    } finally {
      await target.$disconnect();
      removeFreshTestDatabase(databasePath);
    }
  });
});
