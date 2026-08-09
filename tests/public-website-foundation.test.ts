import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createBackupDocument } from "../lib/backup";
import { RECOMMENDED_ROLE_PERMISSIONS } from "../lib/permissions";
import { getPublicWebsiteAsset, validateRegisteredImage } from "../lib/public-website-assets";
import { validatePublicWebsiteBackupRows } from "../lib/public-website-backup";
import {
  PUBLIC_WEBSITE_BLOCK_TYPES,
  validatePublicWebsiteBlocks
} from "../lib/public-website-blocks";
import {
  normalizePublicSlug,
  safePublicUrl
} from "../lib/public-website-links";
import {
  buildPublicMetadata,
  buildPublicSchoolStructuredData,
  publicWebsiteIndexingEnabled,
  validatePublicWebsiteSeo
} from "../lib/public-website-seo";
import { isPublicWebsitePath, PRIVATE_ROBOTS_EXCLUSIONS } from "../lib/public-website-routing";
import { isSafePwaStaticRequest } from "../lib/pwa-cache-policy";
import { parseAndValidateBackup } from "../lib/restore";
import { getPublishedPublicPage, getPublishedPublicPost } from "../lib/public-website-content";

function validBlock(type: (typeof PUBLIC_WEBSITE_BLOCK_TYPES)[number]) {
  if (type === "HERO") return { type, heading: "Welcome", body: "Approved public introduction." };
  if (type === "RICH_TEXT") return { type, markdown: "## Overview\n\nApproved public information." };
  if (["FEATURE_GRID", "FACT_GRID", "TIMELINE"].includes(type)) return { type, heading: "Highlights", items: ["First", "Second"] };
  if (type === "CTA") return { type, heading: "Continue", body: "Use the approved public route.", label: "About", href: "/about" };
  if (type === "FAQ") return { type, heading: "Questions", items: [{ question: "What is public?", answer: "Only approved public information." }] };
  if (type === "REGISTERED_IMAGE") return { type, assetKey: "NALANDA_LOGO", alt: "Nalanda Public School", decorative: false };
  if (type === "QUOTE_WITHOUT_PERSONAL_ATTRIBUTION") return { type, quote: "Learning with purpose." };
  if (type === "CONTACT_DETAILS") return { type, heading: "Contact" };
  if (type === "PORTAL_LOGIN") return { type, heading: "School portal", body: "Login is required." };
  return { type, heading: "News", limit: 3 };
}

function collectFiles(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const file = path.join(root, name);
    return statSync(file).isDirectory() ? collectFiles(file) : [file];
  });
}

function websiteBackupRows(): Record<string, any[]> {
  const blocks = JSON.stringify([{ type: "HERO", heading: "Reviewed page", body: "Approved public information." }]);
  const seo = (canonicalPath: string) => JSON.stringify({
    title: "Reviewed Nalanda Public School Page",
    description: "Leadership-reviewed public information about Nalanda Public School and its controlled publication workflow.",
    canonicalPath,
    socialImageKey: "NALANDA_LOGO"
  });
  const pages = [
    { id: "page-a", pageCode: "PAGE-A", pageType: "ABOUT", title: "About", slug: "about", draftContentJson: blocks, draftSeoJson: seo("/about"), currentPublishedVersionId: "page-a-v1" },
    { id: "page-b", pageCode: "PAGE-B", pageType: "ACADEMICS", title: "Academics", slug: "academics", draftContentJson: blocks, draftSeoJson: seo("/academics"), currentPublishedVersionId: "page-b-v1" }
  ];
  const pageVersions = pages.map((page) => ({
    id: `${page.id}-v1`, pageId: page.id, versionNumber: 1, versionType: "ORIGINAL",
    contentSnapshotJson: blocks, seoSnapshotJson: seo(`/${page.slug}`), contentHash: "A".repeat(64),
    supersedesVersionId: null
  }));
  const posts = [
    { id: "post-a", postNumber: "POST-A", postType: "NEWS", title: "News A", slug: "news-a", draftContentJson: blocks, draftSeoJson: seo("/news/news-a"), currentPublishedVersionId: "post-a-v1" },
    { id: "post-b", postNumber: "POST-B", postType: "NEWS", title: "News B", slug: "news-b", draftContentJson: blocks, draftSeoJson: seo("/news/news-b"), currentPublishedVersionId: "post-b-v1" }
  ];
  const postVersions = posts.map((post) => ({
    id: `${post.id}-v1`, postId: post.id, versionNumber: 1, versionType: "ORIGINAL",
    contentSnapshotJson: blocks, seoSnapshotJson: seo(`/news/${post.slug}`), contentHash: "B".repeat(64),
    supersedesVersionId: null
  }));
  return {
    publicWebsiteSettings: [], publicWebsitePages: pages, publicWebsitePageVersions: pageVersions,
    publicWebsitePosts: posts, publicWebsitePostVersions: postVersions,
    publicWebsiteNavigationItems: [], publicWebsiteEvents: []
  };
}

describe("Prompt 20D public website foundation", () => {
  it("accepts every controlled block and strips arbitrary component properties", () => {
    const blocks = PUBLIC_WEBSITE_BLOCK_TYPES.map(validBlock);
    expect(validatePublicWebsiteBlocks(blocks)).toHaveLength(PUBLIC_WEBSITE_BLOCK_TYPES.length);
    expect(validatePublicWebsiteBlocks([{ ...validBlock("HERO"), style: "position:fixed", component: "PrivateWidget" }])[0])
      .not.toHaveProperty("style");
    expect(validatePublicWebsiteBlocks([{ ...validBlock("HERO"), style: "position:fixed", component: "PrivateWidget" }])[0])
      .not.toHaveProperty("component");
  });

  it.each([
    ["raw HTML", { type: "RICH_TEXT", markdown: "## Safe\n<div>unsafe</div>" }],
    ["script", { type: "RICH_TEXT", markdown: "<script>alert(1)</script>" }],
    ["event handler", { type: "HERO", heading: "Welcome", body: "onload=alert(1)" }],
    ["iframe", { type: "RICH_TEXT", markdown: "<iframe src='https://example.com'></iframe>" }],
    ["object/embed", { type: "RICH_TEXT", markdown: "<object data='x'></object>" }],
    ["external image", { type: "REGISTERED_IMAGE", assetKey: "https://example.com/a.jpg", alt: "x" }],
    ["data URL", { type: "CTA", heading: "Unsafe", label: "Open", href: "data:text/html,x" }],
    ["JavaScript URL", { type: "CTA", heading: "Unsafe", label: "Open", href: "javascript:alert(1)" }],
    ["protocol-relative URL", { type: "CTA", heading: "Unsafe", label: "Open", href: "//example.com" }],
    ["unsafe query", { type: "CTA", heading: "Unsafe", label: "Open", href: "/about?token=private" }],
    ["private deep link", { type: "CTA", heading: "Unsafe", label: "Open", href: "/students" }],
    ["invalid headings", { type: "RICH_TEXT", markdown: "### Skipped heading" }],
    ["oversized content", { type: "HERO", heading: "x".repeat(121), body: "Safe body" }],
    ["unsupported block", { type: "PRIVATE_WIDGET", heading: "No" }]
  ])("rejects %s", (_label, block) => {
    expect(() => validatePublicWebsiteBlocks([block])).toThrow();
  });

  it("enforces safe slugs, public links, registered assets, alt policy, and SEO", () => {
    expect(normalizePublicSlug("Our School")).toBe("our-school");
    expect(() => normalizePublicSlug("students")).toThrow("reserved");
    expect(safePublicUrl("/login", { allowLogin: true })).toBe("/login");
    expect(() => safePublicUrl("/login")).toThrow();
    expect(safePublicUrl("https://maps.google.com/?q=Nalanda", { directions: true })).toContain("maps.google.com");
    expect(() => safePublicUrl("https://images.example.com/photo.jpg")).toThrow("approved");
    expect(getPublicWebsiteAsset("NALANDA_LOGO")).toMatchObject({ src: "/nalanda-logo.jpg", width: 1080, height: 1080, mimeType: "image/jpeg" });
    expect(validateRegisteredImage({ assetKey: "DECORATIVE_PWA_MARK", decorative: true, alt: "" })).toMatchObject({ decorative: true, alt: "" });
    expect(() => validateRegisteredImage({ assetKey: "NALANDA_LOGO", decorative: false, alt: "" })).toThrow("alt text");
    expect(() => getPublicWebsiteAsset("MISSING")).toThrow("registered");

    const seo = validatePublicWebsiteSeo({
      title: "Nalanda Public School About Page",
      description: "Leadership-reviewed public information about Nalanda Public School, its learning approach, and safe school portal access.",
      canonicalPath: "/about",
      socialImageKey: "NALANDA_LOGO"
    });
    expect(buildPublicMetadata(seo, "https://nalandaps.com").alternates?.canonical).toBe("https://nalandaps.com/about");
    expect(publicWebsiteIndexingEnabled("https://nalandaps.com")).toBe(false);
    expect(buildPublicSchoolStructuredData({
      siteName: "Nalanda Public School", publicSiteUrl: "https://nalandaps.com",
      publicAddress: null, publicOfficePhone: null, publicOfficeEmail: null, publicOfficeHours: null
    })).toMatchObject({
      "@context": "https://schema.org", "@type": "School", name: "Nalanda Public School",
      url: "https://nalandaps.com", logo: "https://nalandaps.com/nalanda-logo.jpg"
    });
    expect(JSON.stringify(buildPublicSchoolStructuredData({
      siteName: "Nalanda Public School", publicSiteUrl: null,
      publicAddress: null, publicOfficePhone: null, publicOfficeEmail: null, publicOfficeHours: null
    }))).not.toMatch(/rating|award|affiliation|student|staff/i);
  });

  it("keeps public routing exact and the PWA cache static-assets-only", () => {
    expect(isPublicWebsitePath("/about")).toBe(true);
    expect(isPublicWebsitePath("/news/approved-update")).toBe(true);
    expect(isPublicWebsitePath("/website-admin")).toBe(false);
    expect(isPublicWebsitePath("/students")).toBe(false);
    expect(isSafePwaStaticRequest({ url: "https://nalandaps.com/nalanda-logo.jpg" }, "https://nalandaps.com")).toBe(true);
    expect(isSafePwaStaticRequest({ url: "https://nalandaps.com/about", mode: "navigate" }, "https://nalandaps.com")).toBe(false);
    expect(isSafePwaStaticRequest({ url: "https://nalandaps.com/api/website-admin/pages" }, "https://nalandaps.com")).toBe(false);
  });

  it("keeps every private page root out of robots and the public sitemap boundary", () => {
    const privateRoots = new Set(collectFiles(path.resolve("app"))
      .filter((file) => file.endsWith(`${path.sep}page.tsx`) && !file.includes(`${path.sep}(public)${path.sep}`))
      .map((file) => `/${path.relative(path.resolve("app"), file).split(path.sep)[0]}`));
    for (const root of privateRoots) expect(PRIVATE_ROBOTS_EXCLUSIONS, `${root} must be excluded from robots`).toContain(root);
    const sitemapSource = readFileSync(path.resolve("app", "sitemap.ts"), "utf8");
    expect(sitemapSource).toContain("version?.pageId === page.id");
    expect(sitemapSource).toContain("version?.postId === post.id");
    expect(sitemapSource).not.toContain("website-admin");
    expect(sitemapSource).not.toContain("/login");
    const rootLayout = readFileSync(path.resolve("app", "layout.tsx"), "utf8");
    expect(rootLayout).toContain("robots: { index: false, follow: false }");
    const publicLayout = readFileSync(path.resolve("app", "(public)", "layout.tsx"), "utf8");
    expect(publicLayout).toContain('type="application/ld+json"');
    expect(publicLayout).toContain('replaceAll("<", "\\\\u003c")');
  });

  it("keeps public pages detached from private ERP queries and admin APIs permissioned/no-store", () => {
    const publicSources = collectFiles(path.resolve("app", "(public)")).map((file) => readFileSync(file, "utf8")).join("\n");
    for (const forbidden of [
      "prisma.student", "prisma.guardian", "prisma.staff", "prisma.payment",
      "prisma.studentAttendance", "prisma.studentMark", "/api/students", "/api/payments"
    ]) expect(publicSources).not.toContain(forbidden);

    const apiSources = collectFiles(path.resolve("app", "api", "website-admin")).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(apiSources).toContain("requireApiPermission");
    expect(apiSources).toContain("PRIVATE_NO_STORE");
    expect(apiSources).not.toMatch(/export\s+async\s+function\s+DELETE/);
  });

  it("uses accessible in-app workflow dialogs and no native dialog calls", () => {
    const source = readFileSync(path.resolve("components", "website-admin-forms.tsx"), "utf8");
    for (const title of [
      "Submit Website Content for Review", "Approve Website Content", "Publish Website Page",
      "Publish Website News", "Publish Corrected Website Version", "Archive Website Content",
      "Publish Website Settings", "Update Public Navigation"
    ]) expect(source).toContain(title);
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal="true"');
    expect(source).not.toMatch(/\b(?:window|globalThis)\.(?:alert|confirm|prompt)\s*\(/);
    expect(source).not.toMatch(/\b(?:alert|prompt)\s*\(/);
  });

  it("uses a modal, focus-contained mobile public navigation with focus return", () => {
    const source = readFileSync(path.resolve("components", "public-mobile-navigation.tsx"), "utf8");
    expect(source).toContain('role="dialog"');
    expect(source).toContain('aria-modal=');
    expect(source).toContain('event.key === "Tab"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("triggerRef.current?.focus()");
    expect(source).toContain('document.body.style.overflow = "hidden"');
  });

  it("grants the intended default role matrix", () => {
    for (const role of ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"] as const) {
      expect(RECOMMENDED_ROLE_PERMISSIONS[role]).toEqual(expect.objectContaining({ has: expect.any(Function) }));
      expect(RECOMMENDED_ROLE_PERMISSIONS[role].has("PUBLISH_PUBLIC_WEBSITE_CONTENT")).toBe(true);
    }
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("MANAGE_PUBLIC_WEBSITE_PAGES")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.ADMIN.has("PUBLISH_PUBLIC_WEBSITE_CONTENT")).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("VIEW_PUBLIC_WEBSITE_REPORTS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.VIEWER.has("EXPORT_PUBLIC_WEBSITE_REPORTS")).toBe(false);
    for (const role of ["ACCOUNTANT", "TEACHER", "PARENT"] as const) {
      expect(RECOMMENDED_ROLE_PERMISSIONS[role].has("VIEW_PUBLIC_WEBSITE_ADMIN")).toBe(false);
    }
  });

  it("backs up seven website arrays at v39 and accepts v36 without them", () => {
    const backup = createBackupDocument({
      generatedAt: new Date("2026-07-20T00:00:00.000Z"),
      generatedBy: "Prompt20D",
      students: [], feeStructures: [], payments: [], paymentAudits: [], users: []
    });
    const keys = [
      "publicWebsiteSettings", "publicWebsitePages", "publicWebsitePageVersions",
      "publicWebsitePosts", "publicWebsitePostVersions", "publicWebsiteNavigationItems",
      "publicWebsiteEvents"
    ] as const;
    expect(backup.metadata.backupVersion).toBe(39);
    for (const key of keys) expect(backup[key]).toEqual([]);

    const old = structuredClone(backup) as Record<string, any>;
    old.metadata.backupVersion = 36;
    for (const key of keys) {
      delete old[key];
      delete old.metadata.counts[key];
    }
    const parsed = parseAndValidateBackup(old);
    for (const key of keys) expect(parsed[key]).toEqual([]);
  });

  it("rejects cross-parent current and superseded version links in backup input", () => {
    expect(() => validatePublicWebsiteBackupRows(websiteBackupRows())).not.toThrow();

    const pageCurrent = structuredClone(websiteBackupRows());
    pageCurrent.publicWebsitePages[0].currentPublishedVersionId = "page-b-v1";
    expect(() => validatePublicWebsiteBackupRows(pageCurrent)).toThrow(/same pageId/);

    const pageSupersedes = structuredClone(websiteBackupRows());
    pageSupersedes.publicWebsitePageVersions.push({
      ...pageSupersedes.publicWebsitePageVersions[0],
      id: "page-a-v2", versionNumber: 2, versionType: "CORRECTION", supersedesVersionId: "page-b-v1"
    });
    expect(() => validatePublicWebsiteBackupRows(pageSupersedes)).toThrow(/same parent/);

    const postCurrent = structuredClone(websiteBackupRows());
    postCurrent.publicWebsitePosts[0].currentPublishedVersionId = "post-b-v1";
    expect(() => validatePublicWebsiteBackupRows(postCurrent)).toThrow(/same postId/);

    const postSupersedes = structuredClone(websiteBackupRows());
    postSupersedes.publicWebsitePostVersions.push({
      ...postSupersedes.publicWebsitePostVersions[0],
      id: "post-a-v2", versionNumber: 2, versionType: "CORRECTION", supersedesVersionId: "post-b-v1"
    });
    expect(() => validatePublicWebsiteBackupRows(postSupersedes)).toThrow(/same parent/);
  });

  it("fails closed when a public page or post points at another parent's version", async () => {
    const blocks = JSON.stringify([{ type: "HERO", heading: "Reviewed page", body: "Approved public information." }]);
    const seo = JSON.stringify({
      title: "Reviewed Nalanda Public School Page",
      description: "Leadership-reviewed public information about Nalanda Public School and its controlled publication workflow.",
      canonicalPath: "/about",
      socialImageKey: "NALANDA_LOGO"
    });
    const pageClient = {
      publicWebsitePage: { findUnique: async () => ({ id: "page-a", pageType: "ABOUT", title: "About", slug: "about", summary: null, status: "PUBLISHED", indexable: true, currentPublishedVersionId: "page-b-v1" }) },
      publicWebsitePageVersion: { findUnique: async () => ({ id: "page-b-v1", pageId: "page-b", versionNumber: 1, titleSnapshot: "Other", slugSnapshot: "about", contentSnapshotJson: blocks, seoSnapshotJson: seo, contentHash: "A".repeat(64), publishedAt: new Date() }) }
    };
    expect(await getPublishedPublicPage(pageClient as never, "about")).toBeNull();

    const postClient = {
      publicWebsitePost: { findUnique: async () => ({ id: "post-a", postType: "NEWS", title: "News", slug: "news-a", summary: "Summary", status: "PUBLISHED", publishAt: null, expireAt: null, currentPublishedVersionId: "post-b-v1" }) },
      publicWebsitePostVersion: { findUnique: async () => ({ id: "post-b-v1", postId: "post-b", versionNumber: 1, titleSnapshot: "Other", slugSnapshot: "news-a", summarySnapshot: "Summary", contentSnapshotJson: blocks, seoSnapshotJson: seo, contentHash: "B".repeat(64), publishedAt: new Date() }) }
    };
    expect(await getPublishedPublicPost(postClient as never, "news-a")).toBeNull();
  });

  it("ships the reproducible migration and both planning documents", () => {
    const migration = readFileSync(path.resolve("prisma", "migration-archives", "devops1b-legacy-chain", "20260720_public_website_foundation", "migration.sql"), "utf8");
    for (const table of [
      "PublicWebsiteSettings", "PublicWebsitePage", "PublicWebsitePageVersion",
      "PublicWebsitePost", "PublicWebsitePostVersion", "PublicWebsiteNavigationItem",
      "PublicWebsiteEvent"
    ]) expect(migration).toContain(`CREATE TABLE "${table}"`);

    const cutover = readFileSync(path.resolve("docs", "GODADDY_DOMAIN_AND_WEBSITE_CUTOVER_RUNBOOK.md"), "utf8");
    for (const term of ["existing GoDaddy", "DNS", "MX", "SPF", "DKIM", "DMARC", "staging", "noindex", "HTTPS", "TTL", "Rollback", "renewal", "monitoring"]) {
      expect(cutover.toLowerCase()).toContain(term.toLowerCase());
    }
    const strategy = readFileSync(path.resolve("docs", "PREMIUM_PUBLIC_WEBSITE_AND_APP_EXPERIENCE_PLAN.md"), "utf8");
    for (const term of ["public/private", "PWA", "wrapper", "native app", "Admissions CRM", "media", "accessibility", "SEO", "performance", "hosting", "rollback", "ownership"]) {
      expect(strategy.toLowerCase()).toContain(term.toLowerCase());
    }
  });
});
