import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFreshTestDatabase, removeFreshTestDatabase } from "./helpers/fresh-test-database";
import {
  createPublicWebsitePage,
  createPublicWebsitePost,
  getPublishedPublicPage,
  getPublishedPublicPost,
  listActivePublicPosts,
  listPublicNavigation,
  publicWebsitePageWorkflow,
  publicWebsitePostWorkflow,
  publicWebsiteSettingsWorkflow,
  replacePublicWebsiteNavigation,
  savePublicWebsiteSettings,
  updatePublicWebsitePage
} from "../lib/public-website-content";

const actor = "QA20D-ACTOR";
const copiedDatabase = createFreshTestDatabase("public-website-workflow");
let prisma: PrismaClient;
let publishedPageId = "";

function fileUrl(filename: string) {
  return `file:${filename.replaceAll("\\", "/")}`;
}

function pageInput(overrides: Record<string, unknown> = {}) {
  return {
    pageCode: "QA20D-ABOUT",
    pageType: "ABOUT",
    title: "QA20D About Nalanda",
    slug: "about",
    navigationLabel: "About",
    summary: "Controlled QA20D public summary.",
    showInNavigation: true,
    navigationOrder: 10,
    indexable: true,
    blocks: [
      { type: "HERO", eyebrow: "QA20D", heading: "QA20D About Nalanda", body: "Controlled public workflow verification.", primaryLabel: "School Portal Login", primaryHref: "/login" },
      { type: "RICH_TEXT", markdown: "## Reviewed information\n\nQA20D controlled public content." }
    ],
    seo: {
      title: "QA20D About Nalanda Public School",
      description: "QA20D leadership-reviewed public information used only to verify the controlled publication and immutable correction workflow.",
      canonicalPath: "/about",
      socialImageKey: "NALANDA_LOGO"
    },
    ...overrides
  };
}

function postInput(overrides: Record<string, unknown> = {}) {
  return {
    postNumber: "QA20D-NEWS-001",
    postType: "NEWS",
    title: "QA20D Public News",
    slug: "qa20d-public-news",
    summary: "QA20D controlled public news summary.",
    blocks: [
      { type: "HERO", heading: "QA20D Public News", body: "Controlled public post workflow verification." }
    ],
    seo: {
      title: "QA20D Public News | Nalanda School",
      description: "QA20D leadership-reviewed public news used only to verify scheduling, expiry, publication, and immutable version selection.",
      canonicalPath: "/news/qa20d-public-news",
      socialImageKey: "NALANDA_LOGO"
    },
    ...overrides
  };
}

beforeAll(() => {
  prisma = new PrismaClient({ datasources: { db: { url: fileUrl(copiedDatabase) } } });
});

afterAll(async () => {
  await prisma?.$disconnect();
  removeFreshTestDatabase(copiedDatabase);
});

describe.sequential("Prompt 20D publication workflow on a copied database", () => {
  it("publishes settings only after current-version review", async () => {
    const settings = await savePublicWebsiteSettings(prisma, {
      settingsCode: "QA20D-SETTINGS",
      siteName: "Nalanda Public School",
      shortName: "Nalanda",
      tagline: "QA20D controlled public foundation.",
      publicSiteUrl: "https://nalandaps.com",
      publicAddress: null,
      publicOfficePhone: null,
      publicOfficeEmail: null,
      publicOfficeHours: null,
      publicDirectionsUrl: null,
      portalLoginPath: "/login",
      defaultSeoTitle: "Nalanda Public School | Learning with purpose",
      defaultSeoDescription: "Leadership-reviewed public information about Nalanda Public School, its learning approach, facilities, admissions guidance and secure portal.",
      defaultSocialImageKey: "NALANDA_LOGO",
      mandatoryDisclosureEnabled: false
    }, actor);
    await expect(publicWebsiteSettingsWorkflow(prisma, settings.id, "publish", actor)).rejects.toThrow("approved review");
    await publicWebsiteSettingsWorkflow(prisma, settings.id, "submit", actor);
    await publicWebsiteSettingsWorkflow(prisma, settings.id, "approve", actor);
    const published = await publicWebsiteSettingsWorkflow(prisma, settings.id, "publish", actor);
    expect(published).toMatchObject({ status: "PUBLISHED", approvedReviewVersion: 1, mandatoryDisclosureEnabled: false });
  });

  it("invalidates stale approval, publishes one immutable snapshot, and is publication-idempotent", async () => {
    const page = await createPublicWebsitePage(prisma, pageInput(), actor);
    publishedPageId = page.id;
    await expect(publicWebsitePageWorkflow(prisma, page.id, "publish", actor, "QA20D premature")).rejects.toThrow("approved review");
    await publicWebsitePageWorkflow(prisma, page.id, "submit", actor);
    await publicWebsitePageWorkflow(prisma, page.id, "approve", actor);

    const edited = await updatePublicWebsitePage(prisma, page.id, pageInput({ title: "QA20D About Nalanda Reviewed" }), actor);
    expect(edited).toMatchObject({ status: "DRAFT", reviewVersion: 2, approvedReviewVersion: null });
    await publicWebsitePageWorkflow(prisma, page.id, "submit", actor);
    await expect(publicWebsitePageWorkflow(prisma, page.id, "publish", actor, "QA20D without reapproval")).rejects.toThrow("approved review");
    await publicWebsitePageWorkflow(prisma, page.id, "approve", actor);
    await publicWebsitePageWorkflow(prisma, page.id, "publish", actor, "QA20D original publication");

    const versions = await prisma.publicWebsitePageVersion.findMany({ where: { pageId: page.id } });
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ versionNumber: 1, versionType: "ORIGINAL", titleSnapshot: "QA20D About Nalanda Reviewed" });
    await expect(publicWebsitePageWorkflow(prisma, page.id, "publish", actor, "QA20D duplicate")).rejects.toThrow("approved review");
    expect(await prisma.publicWebsitePageVersion.count({ where: { pageId: page.id } })).toBe(1);
  });

  it("keeps the public snapshot stable while a correction is drafted, then appends v2", async () => {
    const before = await getPublishedPublicPage(prisma, "about");
    expect(before?.version.versionNumber).toBe(1);
    const firstHash = before?.version.contentHash;

    const edited = await updatePublicWebsitePage(prisma, publishedPageId, pageInput({
      title: "QA20D About Nalanda Corrected",
      blocks: [
        { type: "HERO", heading: "QA20D Corrected Public Page", body: "A later controlled correction draft." }
      ]
    }), actor);
    expect(edited).toMatchObject({ status: "PUBLISHED", approvedReviewVersion: null });
    expect((await getPublishedPublicPage(prisma, "about"))?.version.versionNumber).toBe(1);

    await publicWebsitePageWorkflow(prisma, publishedPageId, "submit", actor);
    await publicWebsitePageWorkflow(prisma, publishedPageId, "approve", actor);
    await publicWebsitePageWorkflow(prisma, publishedPageId, "correct", actor, "QA20D verified correction reason");
    const versions = await prisma.publicWebsitePageVersion.findMany({ where: { pageId: publishedPageId }, orderBy: { versionNumber: "asc" } });
    expect(versions).toHaveLength(2);
    expect(versions[0].contentHash).toBe(firstHash);
    expect(versions[1]).toMatchObject({ versionNumber: 2, versionType: "CORRECTION", correctionReason: "QA20D verified correction reason", supersedesVersionId: versions[0].id });
    expect((await getPublishedPublicPage(prisma, "about"))?.version.versionNumber).toBe(2);
  });

  it("requires published pages for deterministic navigation and removes archived destinations", async () => {
    const draft = await createPublicWebsitePage(prisma, pageInput({
      pageCode: "QA20D-ACADEMICS",
      pageType: "ACADEMICS",
      title: "QA20D Draft Destination",
      slug: "academics",
      seo: {
        title: "QA20D Draft Destination Page",
        description: "QA20D controlled draft destination used to verify that unpublished pages cannot enter public navigation.",
        canonicalPath: "/academics",
        socialImageKey: "NALANDA_LOGO"
      }
    }), actor);
    await expect(replacePublicWebsiteNavigation(prisma, [{
      itemCode: "QA20D-DRAFT", label: "Draft", destinationType: "PAGE", pageId: draft.id,
      displayOrder: 1, placement: "BOTH", enabled: true
    }], actor)).rejects.toThrow("published pages");

    await replacePublicWebsiteNavigation(prisma, [
      { itemCode: "QA20D-ABOUT", label: "About", destinationType: "PAGE", pageId: publishedPageId, displayOrder: 1, placement: "BOTH", enabled: true },
      { itemCode: "QA20D-NEWS", label: "News", destinationType: "NEWS_INDEX", displayOrder: 2, placement: "BOTH", enabled: true },
      { itemCode: "QA20D-LOGIN", label: "School Portal", destinationType: "PORTAL_LOGIN", safeExternalUrl: "/login", displayOrder: 3, placement: "BOTH", enabled: true }
    ], actor);
    expect((await listPublicNavigation(prisma)).map((row) => row.href)).toEqual(["/about", "/news", "/login"]);

    await publicWebsitePageWorkflow(prisma, publishedPageId, "archive", actor, "QA20D archive verification");
    expect(await getPublishedPublicPage(prisma, "about")).toBeNull();
    expect((await listPublicNavigation(prisma)).map((row) => row.href)).toEqual(["/news", "/login"]);
    await expect(prisma.publicWebsitePage.delete({ where: { id: publishedPageId } })).rejects.toThrow();
    expect(await prisma.publicWebsitePageVersion.count({ where: { pageId: publishedPageId } })).toBe(2);
  });

  it("hides scheduled and expired posts and preserves immutable post versions", async () => {
    const future = new Date(Date.now() + 86_400_000);
    const futurePost = await createPublicWebsitePost(prisma, postInput({ publishAt: future.toISOString() }), actor);
    await publicWebsitePostWorkflow(prisma, futurePost.id, "submit", actor);
    await publicWebsitePostWorkflow(prisma, futurePost.id, "approve", actor);
    await publicWebsitePostWorkflow(prisma, futurePost.id, "publish", actor, "QA20D scheduled publication");
    expect(await getPublishedPublicPost(prisma, futurePost.slug)).toBeNull();
    expect((await listActivePublicPosts(prisma)).some((row) => row.slug === futurePost.slug)).toBe(false);

    const past = new Date(Date.now() - 172_800_000);
    const expired = new Date(Date.now() - 86_400_000);
    const expiredPost = await createPublicWebsitePost(prisma, postInput({
      postNumber: "QA20D-NEWS-002",
      slug: "qa20d-expired-news",
      publishAt: past.toISOString(),
      expireAt: expired.toISOString(),
      seo: {
        title: "QA20D Expired Public News",
        description: "QA20D leadership-reviewed expired news used only to verify that inactive posts are removed from every public reader.",
        canonicalPath: "/news/qa20d-expired-news",
        socialImageKey: "NALANDA_LOGO"
      }
    }), actor);
    await publicWebsitePostWorkflow(prisma, expiredPost.id, "submit", actor);
    await publicWebsitePostWorkflow(prisma, expiredPost.id, "approve", actor);
    await publicWebsitePostWorkflow(prisma, expiredPost.id, "publish", actor, "QA20D expired publication");
    expect(await getPublishedPublicPost(prisma, expiredPost.slug)).toBeNull();
    expect(await prisma.publicWebsitePostVersion.count({ where: { postId: expiredPost.id } })).toBe(1);
  });

  it("keeps Mandatory Disclosure unavailable and records safe workflow events", async () => {
    const disclosure = await createPublicWebsitePage(prisma, pageInput({
      pageCode: "QA20D-DISCLOSURE",
      pageType: "MANDATORY_DISCLOSURE",
      title: "QA20D Mandatory Disclosure",
      slug: "mandatory-disclosure",
      seo: {
        title: "QA20D Mandatory Disclosure Page",
        description: "QA20D controlled disclosure draft used only to verify that publication remains blocked until settings explicitly enable it.",
        canonicalPath: "/mandatory-disclosure",
        socialImageKey: "NALANDA_LOGO"
      }
    }), actor);
    await publicWebsitePageWorkflow(prisma, disclosure.id, "submit", actor);
    await publicWebsitePageWorkflow(prisma, disclosure.id, "approve", actor);
    await expect(publicWebsitePageWorkflow(prisma, disclosure.id, "publish", actor, "QA20D disclosure attempt")).rejects.toThrow("not enabled");
    expect(await prisma.publicWebsitePageVersion.count({ where: { pageId: disclosure.id } })).toBe(0);
    expect(await prisma.publicWebsiteEvent.count({ where: { actorUserId: actor } })).toBeGreaterThan(20);
  });
});
