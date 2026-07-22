import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { parsePublicWebsiteBlocks, validatePublicWebsiteBlocks } from "@/lib/public-website-blocks";
import { CORE_PUBLIC_SLUGS, normalizePublicSlug, safePublicUrl } from "@/lib/public-website-links";
import { parsePublicWebsiteSeo, validatePublicWebsiteSeo } from "@/lib/public-website-seo";

export const PUBLIC_PAGE_TYPES = ["HOME", "ABOUT", "ACADEMICS", "ADMISSIONS", "FACILITIES", "STUDENT_LIFE", "CONTACT", "SCHOOL_APP", "PRIVACY", "ACCESSIBILITY", "TERMS", "MANDATORY_DISCLOSURE"] as const;
export const PUBLIC_POST_TYPES = ["NEWS", "ANNOUNCEMENT"] as const;
const PAGE_TYPES = new Set<string>(PUBLIC_PAGE_TYPES);
const POST_TYPES = new Set<string>(PUBLIC_POST_TYPES);
const STATUS = new Set(["DRAFT", "READY_FOR_REVIEW", "PUBLISHED", "ARCHIVED"]);

export const PUBLIC_SETTINGS_FALLBACK = {
  siteName: "Nalanda Public School",
  shortName: "Nalanda",
  tagline: "A thoughtful place to learn and grow.",
  publicSiteUrl: null,
  publicAddress: null,
  publicOfficePhone: null,
  publicOfficeEmail: null,
  publicOfficeHours: null,
  publicDirectionsUrl: null,
  portalLoginPath: "/login",
  defaultSeoTitle: "Nalanda Public School | Learning with purpose",
  defaultSeoDescription: "Explore Nalanda Public School public information, learning approach, facilities, admissions guidance and secure school portal access.",
  defaultSocialImageKey: "NALANDA_LOGO",
  mandatoryDisclosureEnabled: false
};

type PublicClient = Pick<PrismaClient | Prisma.TransactionClient,
  "publicWebsiteSettings" | "publicWebsitePage" | "publicWebsitePageVersion" |
  "publicWebsitePost" | "publicWebsitePostVersion" | "publicWebsiteNavigationItem" |
  "publicWebsiteEvent">;

function required(value: unknown, label: string, max = 500) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} is too long.`);
  if (/<[^>]+>|javascript:|data:/i.test(text)) throw new Error(`${label} contains unsafe content.`);
  return text;
}

function optional(value: unknown, label: string, max = 500) {
  const text = String(value ?? "").trim();
  return text ? required(text, label, max) : null;
}

function code(value: unknown, label: string) {
  const text = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{2,59}$/.test(text)) throw new Error(`${label} must use 3 to 60 letters, numbers, underscores or hyphens.`);
  return text;
}

function hashSnapshot(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").toUpperCase();
}

async function event(client: PublicClient, data: { entityType: string; entityId?: string | null; eventType: string; safeReason?: string | null; safeMetadataJson?: string | null; actorUserId?: string | null }) {
  return client.publicWebsiteEvent.create({ data });
}

export function defaultPublicBlocks(title: string) {
  return [
    { type: "HERO", eyebrow: "Nalanda Public School", heading: title, body: "Content awaiting school approval.", primaryLabel: "School Portal Login", primaryHref: "/login" },
    { type: "RICH_TEXT", markdown: "## Information under review\n\nThis public page is ready for leadership-approved content." }
  ];
}

export function defaultPublicSeo(title: string, slug: string) {
  return {
    title: `${title} | Nalanda Public School`.slice(0, 70),
    description: `Read reviewed public information about ${title.toLowerCase()} at Nalanda Public School. Content is published through a controlled approval workflow.`,
    canonicalPath: slug ? `/${slug}` : "/",
    socialImageKey: "NALANDA_LOGO"
  };
}

export function validatePublicSettingsInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Website settings are required.");
  const source = input as Record<string, unknown>;
  const portalLoginPath = safePublicUrl(source.portalLoginPath ?? "/login", { allowLogin: true });
  if (portalLoginPath !== "/login") throw new Error("Portal login must point only to /login.");
  const email = optional(source.publicOfficeEmail, "Public office email", 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Public office email is invalid.");
  return {
    settingsCode: code(source.settingsCode ?? "PUBLIC_WEBSITE", "Settings code"),
    siteName: required(source.siteName, "Site name", 120),
    shortName: required(source.shortName, "Short name", 40),
    tagline: optional(source.tagline, "Tagline", 180),
    publicSiteUrl: source.publicSiteUrl ? safePublicUrl(source.publicSiteUrl) : null,
    publicAddress: optional(source.publicAddress, "Public address", 500),
    publicOfficePhone: optional(source.publicOfficePhone, "Public office phone", 80),
    publicOfficeEmail: email,
    publicOfficeHours: optional(source.publicOfficeHours, "Public office hours", 160),
    publicDirectionsUrl: source.publicDirectionsUrl ? safePublicUrl(source.publicDirectionsUrl, { directions: true }) : null,
    portalLoginPath,
    defaultSeoTitle: required(source.defaultSeoTitle, "Default SEO title", 70),
    defaultSeoDescription: required(source.defaultSeoDescription, "Default SEO description", 170),
    defaultSocialImageKey: optional(source.defaultSocialImageKey, "Default social image key", 80),
    themeConfigJson: "{}",
    contactConfigJson: "{}",
    socialLinksJson: null,
    mandatoryDisclosureEnabled: source.mandatoryDisclosureEnabled === true
  };
}

export async function savePublicWebsiteSettings(prisma: PrismaClient, input: unknown, actorUserId: string) {
  const data = validatePublicSettingsInput(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.publicWebsiteSettings.findUnique({ where: { settingsCode: data.settingsCode } });
    const row = existing
      ? await tx.publicWebsiteSettings.update({ where: { id: existing.id }, data: { ...data, status: "DRAFT", reviewVersion: { increment: 1 }, approvedReviewVersion: null, reviewedByUserId: null, reviewedAt: null } })
      : await tx.publicWebsiteSettings.create({ data: { ...data, createdByUserId: actorUserId } });
    await event(tx, { entityType: "SETTINGS", entityId: row.id, eventType: existing ? "SETTINGS_UPDATED" : "SETTINGS_CREATED", actorUserId });
    return row;
  });
}

export async function publicWebsiteSettingsWorkflow(prisma: PrismaClient, id: string, action: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.publicWebsiteSettings.findUnique({ where: { id } });
    if (!row) throw new Error("Website settings were not found.");
    if (action === "submit") {
      const updated = await tx.publicWebsiteSettings.update({ where: { id }, data: { status: "READY_FOR_REVIEW", approvedReviewVersion: null } });
      await event(tx, { entityType: "SETTINGS", entityId: id, eventType: "SETTINGS_SUBMITTED", actorUserId });
      return updated;
    }
    if (action === "approve") {
      if (row.status !== "READY_FOR_REVIEW") throw new Error("Submit settings for review first.");
      const updated = await tx.publicWebsiteSettings.update({ where: { id }, data: { approvedReviewVersion: row.reviewVersion, reviewedByUserId: actorUserId, reviewedAt: new Date() } });
      await event(tx, { entityType: "SETTINGS", entityId: id, eventType: "SETTINGS_REVIEWED", actorUserId });
      return updated;
    }
    if (action === "publish") {
      if (row.status !== "READY_FOR_REVIEW" || row.approvedReviewVersion !== row.reviewVersion) throw new Error("A current approved review is required.");
      await tx.publicWebsiteSettings.updateMany({ where: { status: "PUBLISHED", id: { not: id } }, data: { status: "DRAFT" } });
      const updated = await tx.publicWebsiteSettings.update({ where: { id }, data: { status: "PUBLISHED", publishedByUserId: actorUserId, publishedAt: new Date() } });
      await event(tx, { entityType: "SETTINGS", entityId: id, eventType: "SETTINGS_PUBLISHED", actorUserId });
      return updated;
    }
    throw new Error("Unsupported website settings workflow action.");
  });
}

export function validatePageDraft(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Website page data is required.");
  const source = input as Record<string, unknown>;
  const pageType = String(source.pageType ?? "").toUpperCase();
  if (!PAGE_TYPES.has(pageType)) throw new Error("Choose a supported public page type.");
  const slug = pageType === "HOME" ? "" : normalizePublicSlug(source.slug);
  if (pageType !== "HOME") {
    const expected = pageType.toLowerCase().replaceAll("_", "-");
    if (slug !== expected) throw new Error(`The ${pageType} page must use /${expected}.`);
  }
  const title = required(source.title, "Page title", 140);
  const blocks = validatePublicWebsiteBlocks(source.blocks ?? defaultPublicBlocks(title));
  const seo = validatePublicWebsiteSeo(source.seo ?? defaultPublicSeo(title, slug));
  return {
    pageCode: code(source.pageCode, "Page code"),
    pageType,
    title,
    slug,
    navigationLabel: optional(source.navigationLabel, "Navigation label", 60),
    summary: optional(source.summary, "Page summary", 500),
    draftContentJson: JSON.stringify(blocks),
    draftSeoJson: JSON.stringify(seo),
    showInNavigation: source.showInNavigation === true,
    navigationOrder: source.navigationOrder == null || source.navigationOrder === "" ? null : Math.max(0, Math.min(999, Number(source.navigationOrder))),
    indexable: source.indexable !== false
  };
}

export async function createPublicWebsitePage(prisma: PrismaClient, input: unknown, actorUserId: string) {
  const data = validatePageDraft(input);
  return prisma.$transaction(async (tx) => {
    const row = await tx.publicWebsitePage.create({ data: { ...data, createdByUserId: actorUserId } });
    await event(tx, { entityType: "PAGE", entityId: row.id, eventType: "PAGE_CREATED", actorUserId, safeMetadataJson: JSON.stringify({ pageCode: row.pageCode, slug: row.slug }) });
    return row;
  });
}

export async function updatePublicWebsitePage(prisma: PrismaClient, id: string, input: unknown, actorUserId: string) {
  const data = validatePageDraft(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.publicWebsitePage.findUnique({ where: { id } });
    if (!existing) throw new Error("Website page was not found.");
    if (existing.status === "ARCHIVED") throw new Error("Archived pages cannot be edited.");
    const row = await tx.publicWebsitePage.update({ where: { id }, data: { ...data, status: existing.currentPublishedVersionId ? "PUBLISHED" : "DRAFT", reviewVersion: { increment: 1 }, approvedReviewVersion: null, reviewedByUserId: null, reviewedAt: null } });
    await event(tx, { entityType: "PAGE", entityId: id, eventType: "PAGE_UPDATED", actorUserId });
    return row;
  });
}

export async function publicWebsitePageWorkflow(prisma: PrismaClient, id: string, action: string, actorUserId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.publicWebsitePage.findUnique({ where: { id }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } } });
    if (!row) throw new Error("Website page was not found.");
    if (action === "submit") {
      parsePublicWebsiteBlocks(row.draftContentJson); parsePublicWebsiteSeo(row.draftSeoJson);
      const updated = await tx.publicWebsitePage.update({ where: { id }, data: { status: "READY_FOR_REVIEW", approvedReviewVersion: null } });
      await event(tx, { entityType: "PAGE", entityId: id, eventType: "PAGE_SUBMITTED", actorUserId });
      return updated;
    }
    if (action === "approve") {
      if (row.status !== "READY_FOR_REVIEW") throw new Error("Submit the page for review first.");
      const updated = await tx.publicWebsitePage.update({ where: { id }, data: { approvedReviewVersion: row.reviewVersion, reviewedByUserId: actorUserId, reviewedAt: new Date() } });
      await event(tx, { entityType: "PAGE", entityId: id, eventType: "PAGE_REVIEWED", actorUserId });
      return updated;
    }
    if (action === "publish" || action === "correct") {
      if (row.status !== "READY_FOR_REVIEW" || row.approvedReviewVersion !== row.reviewVersion) throw new Error("A current approved review is required.");
      const previous = row.versions[0] ?? null;
      if (action === "correct" && !previous) throw new Error("Publish an original version before a correction.");
      const safeReason = required(reason, action === "correct" ? "Correction reason" : "Publication reason", 500);
      const blocks = parsePublicWebsiteBlocks(row.draftContentJson);
      const seo = parsePublicWebsiteSeo(row.draftSeoJson);
      const settings = await tx.publicWebsiteSettings.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } });
      if (row.pageType === "MANDATORY_DISCLOSURE" && !settings?.mandatoryDisclosureEnabled) throw new Error("Mandatory Disclosure is not enabled in published settings.");
      const snapshot = { title: row.title, slug: row.slug, blocks, seo };
      const version = await tx.publicWebsitePageVersion.create({ data: {
        pageId: id, versionNumber: (previous?.versionNumber ?? 0) + 1,
        versionType: previous ? "CORRECTION" : "ORIGINAL", titleSnapshot: row.title,
        slugSnapshot: row.slug, contentSnapshotJson: JSON.stringify(blocks),
        seoSnapshotJson: JSON.stringify(seo), settingsSnapshotJson: JSON.stringify(settings ? {
          settingsCode: settings.settingsCode, siteName: settings.siteName, publicSiteUrl: settings.publicSiteUrl,
          publicAddress: settings.publicAddress, publicOfficePhone: settings.publicOfficePhone,
          publicOfficeEmail: settings.publicOfficeEmail, publicOfficeHours: settings.publicOfficeHours
        } : PUBLIC_SETTINGS_FALLBACK), contentHash: hashSnapshot(snapshot),
        publicationReason: previous ? null : safeReason, correctionReason: previous ? safeReason : null,
        publishedByUserId: actorUserId, supersedesVersionId: previous?.id
      } });
      const updated = await tx.publicWebsitePage.update({ where: { id }, data: { status: "PUBLISHED", currentPublishedVersionId: version.id, publishedByUserId: actorUserId, publishedAt: version.publishedAt } });
      await event(tx, { entityType: "PAGE", entityId: id, eventType: previous ? "PAGE_CORRECTED" : "PAGE_PUBLISHED", safeReason, actorUserId, safeMetadataJson: JSON.stringify({ versionNumber: version.versionNumber, contentHash: version.contentHash }) });
      return updated;
    }
    if (action === "archive") {
      const safeReason = required(reason, "Archive reason", 500);
      const updated = await tx.publicWebsitePage.update({ where: { id }, data: { status: "ARCHIVED", archivedByUserId: actorUserId, archivedAt: new Date(), showInNavigation: false } });
      await event(tx, { entityType: "PAGE", entityId: id, eventType: "PAGE_ARCHIVED", safeReason, actorUserId });
      return updated;
    }
    throw new Error("Unsupported website page workflow action.");
  });
}

export function validatePostDraft(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Website post data is required.");
  const source = input as Record<string, unknown>;
  const postType = String(source.postType ?? "").toUpperCase();
  if (!POST_TYPES.has(postType)) throw new Error("Choose NEWS or ANNOUNCEMENT.");
  const title = required(source.title, "Post title", 140);
  const slug = normalizePublicSlug(source.slug);
  const publishAt = source.publishAt ? new Date(String(source.publishAt)) : null;
  const expireAt = source.expireAt ? new Date(String(source.expireAt)) : null;
  if (publishAt && Number.isNaN(publishAt.getTime())) throw new Error("Publish time is invalid.");
  if (expireAt && (!publishAt || Number.isNaN(expireAt.getTime()) || expireAt <= publishAt)) throw new Error("Expiry must be after the publish time.");
  return {
    postNumber: code(source.postNumber, "Post number"), postType, title, slug,
    summary: required(source.summary, "Post summary", 500),
    draftContentJson: JSON.stringify(validatePublicWebsiteBlocks(source.blocks ?? defaultPublicBlocks(title))),
    draftSeoJson: JSON.stringify(validatePublicWebsiteSeo(source.seo ?? defaultPublicSeo(title, `news/${slug}`))),
    publishAt, expireAt, featured: source.featured === true
  };
}

export async function createPublicWebsitePost(prisma: PrismaClient, input: unknown, actorUserId: string) {
  const data = validatePostDraft(input);
  return prisma.$transaction(async (tx) => {
    const row = await tx.publicWebsitePost.create({ data: { ...data, createdByUserId: actorUserId } });
    await event(tx, { entityType: "POST", entityId: row.id, eventType: "POST_CREATED", actorUserId });
    return row;
  });
}

export async function updatePublicWebsitePost(prisma: PrismaClient, id: string, input: unknown, actorUserId: string) {
  const data = validatePostDraft(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.publicWebsitePost.findUnique({ where: { id } });
    if (!existing || existing.status === "ARCHIVED") throw new Error("Editable website post was not found.");
    const row = await tx.publicWebsitePost.update({ where: { id }, data: { ...data, status: existing.currentPublishedVersionId ? "PUBLISHED" : "DRAFT", reviewVersion: { increment: 1 }, approvedReviewVersion: null, reviewedByUserId: null, reviewedAt: null } });
    await event(tx, { entityType: "POST", entityId: id, eventType: "POST_UPDATED", actorUserId });
    return row;
  });
}

export async function publicWebsitePostWorkflow(prisma: PrismaClient, id: string, action: string, actorUserId: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.publicWebsitePost.findUnique({ where: { id }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } } });
    if (!row) throw new Error("Website post was not found.");
    if (action === "submit") {
      parsePublicWebsiteBlocks(row.draftContentJson); parsePublicWebsiteSeo(row.draftSeoJson);
      const updated = await tx.publicWebsitePost.update({ where: { id }, data: { status: "READY_FOR_REVIEW", approvedReviewVersion: null } });
      await event(tx, { entityType: "POST", entityId: id, eventType: "POST_SUBMITTED", actorUserId }); return updated;
    }
    if (action === "approve") {
      if (row.status !== "READY_FOR_REVIEW") throw new Error("Submit the post for review first.");
      const updated = await tx.publicWebsitePost.update({ where: { id }, data: { approvedReviewVersion: row.reviewVersion, reviewedByUserId: actorUserId, reviewedAt: new Date() } });
      await event(tx, { entityType: "POST", entityId: id, eventType: "POST_REVIEWED", actorUserId }); return updated;
    }
    if (action === "publish" || action === "correct") {
      if (row.status !== "READY_FOR_REVIEW" || row.approvedReviewVersion !== row.reviewVersion) throw new Error("A current approved review is required.");
      const previous = row.versions[0] ?? null;
      if (action === "correct" && !previous) throw new Error("Publish an original version before a correction.");
      const safeReason = required(reason, action === "correct" ? "Correction reason" : "Publication reason", 500);
      const blocks = parsePublicWebsiteBlocks(row.draftContentJson), seo = parsePublicWebsiteSeo(row.draftSeoJson);
      const version = await tx.publicWebsitePostVersion.create({ data: {
        postId: id, versionNumber: (previous?.versionNumber ?? 0) + 1, versionType: previous ? "CORRECTION" : "ORIGINAL",
        titleSnapshot: row.title, slugSnapshot: row.slug, summarySnapshot: row.summary,
        contentSnapshotJson: JSON.stringify(blocks), seoSnapshotJson: JSON.stringify(seo),
        contentHash: hashSnapshot({ title: row.title, slug: row.slug, summary: row.summary, blocks, seo }),
        publicationReason: previous ? null : safeReason, correctionReason: previous ? safeReason : null,
        publishAt: row.publishAt, expireAt: row.expireAt, publishedByUserId: actorUserId, supersedesVersionId: previous?.id
      } });
      const updated = await tx.publicWebsitePost.update({ where: { id }, data: { status: "PUBLISHED", currentPublishedVersionId: version.id, publishedByUserId: actorUserId, publishedAt: version.publishedAt } });
      await event(tx, { entityType: "POST", entityId: id, eventType: previous ? "POST_CORRECTED" : "POST_PUBLISHED", safeReason, actorUserId, safeMetadataJson: JSON.stringify({ versionNumber: version.versionNumber, contentHash: version.contentHash }) });
      return updated;
    }
    if (action === "archive") {
      const safeReason = required(reason, "Archive reason", 500);
      const updated = await tx.publicWebsitePost.update({ where: { id }, data: { status: "ARCHIVED", archivedByUserId: actorUserId, archivedAt: new Date() } });
      await event(tx, { entityType: "POST", entityId: id, eventType: "POST_ARCHIVED", safeReason, actorUserId }); return updated;
    }
    throw new Error("Unsupported website post workflow action.");
  });
}

export async function replacePublicWebsiteNavigation(prisma: PrismaClient, input: unknown, actorUserId: string) {
  if (!Array.isArray(input) || input.length > 30) throw new Error("Navigation must contain at most 30 controlled items.");
  const rows = input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Navigation item ${index + 1} is invalid.`);
    const source = raw as Record<string, unknown>;
    const destinationType = String(source.destinationType ?? "");
    if (!["PAGE", "NEWS_INDEX", "PORTAL_LOGIN", "APPROVED_EXTERNAL"].includes(destinationType)) throw new Error("Navigation destination type is invalid.");
    const placement = String(source.placement ?? "BOTH");
    if (!["HEADER", "FOOTER", "BOTH"].includes(placement)) throw new Error("Navigation placement is invalid.");
    const safeExternalUrl = destinationType === "APPROVED_EXTERNAL" ? safePublicUrl(source.safeExternalUrl) : null;
    if (destinationType === "PORTAL_LOGIN" && String(source.safeExternalUrl ?? "/login") !== "/login") throw new Error("Portal navigation must point only to /login.");
    return { itemCode: code(source.itemCode, "Navigation code"), label: required(source.label, "Navigation label", 60), destinationType, pageId: destinationType === "PAGE" ? required(source.pageId, "Published page", 100) : null, safeExternalUrl, displayOrder: Number.isInteger(Number(source.displayOrder)) ? Math.max(0, Math.min(999, Number(source.displayOrder))) : index, placement, enabled: source.enabled !== false, opensNewTab: destinationType === "APPROVED_EXTERNAL" && source.opensNewTab === true };
  });
  return prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (row.pageId) {
        const page = await tx.publicWebsitePage.findUnique({ where: { id: row.pageId } });
        if (!page || page.status !== "PUBLISHED" || !page.currentPublishedVersionId) throw new Error("Navigation can include only published pages.");
      }
    }
    await tx.publicWebsiteNavigationItem.deleteMany();
    for (const row of rows) await tx.publicWebsiteNavigationItem.create({ data: { ...row, createdByUserId: actorUserId, updatedByUserId: actorUserId } });
    await event(tx, { entityType: "NAVIGATION", eventType: "NAVIGATION_UPDATED", actorUserId, safeMetadataJson: JSON.stringify({ itemCount: rows.length }) });
    return rows;
  });
}

export async function getPublishedPublicSettings(client: PublicClient) {
  const row = await client.publicWebsiteSettings.findFirst({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, select: {
    siteName: true, shortName: true, tagline: true, publicSiteUrl: true, publicAddress: true,
    publicOfficePhone: true, publicOfficeEmail: true, publicOfficeHours: true, publicDirectionsUrl: true,
    portalLoginPath: true, defaultSeoTitle: true, defaultSeoDescription: true, defaultSocialImageKey: true,
    mandatoryDisclosureEnabled: true
  } });
  return row ?? PUBLIC_SETTINGS_FALLBACK;
}

export async function getPublishedPublicPage(client: PublicClient, slug: string) {
  const row = await client.publicWebsitePage.findUnique({ where: { slug }, select: { id: true, pageType: true, title: true, slug: true, summary: true, status: true, indexable: true, currentPublishedVersionId: true } });
  if (!row || row.status !== "PUBLISHED" || !row.currentPublishedVersionId) return null;
  const version = await client.publicWebsitePageVersion.findUnique({ where: { id: row.currentPublishedVersionId }, select: { id: true, pageId: true, versionNumber: true, titleSnapshot: true, slugSnapshot: true, contentSnapshotJson: true, seoSnapshotJson: true, contentHash: true, publishedAt: true } });
  if (!version || version.pageId !== row.id || version.slugSnapshot !== slug) return null;
  return { ...row, version, blocks: parsePublicWebsiteBlocks(version.contentSnapshotJson), seo: parsePublicWebsiteSeo(version.seoSnapshotJson) };
}

export async function getPublishedPublicPost(client: PublicClient, slug: string, now = new Date()) {
  const row = await client.publicWebsitePost.findUnique({ where: { slug }, select: { id: true, postType: true, title: true, slug: true, summary: true, status: true, publishAt: true, expireAt: true, currentPublishedVersionId: true } });
  if (!row || row.status !== "PUBLISHED" || !row.currentPublishedVersionId || (row.publishAt && row.publishAt > now) || (row.expireAt && row.expireAt <= now)) return null;
  const version = await client.publicWebsitePostVersion.findUnique({ where: { id: row.currentPublishedVersionId }, select: { id: true, postId: true, versionNumber: true, titleSnapshot: true, slugSnapshot: true, summarySnapshot: true, contentSnapshotJson: true, seoSnapshotJson: true, contentHash: true, publishedAt: true } });
  if (!version || version.postId !== row.id || version.slugSnapshot !== slug) return null;
  return { ...row, version, blocks: parsePublicWebsiteBlocks(version.contentSnapshotJson), seo: parsePublicWebsiteSeo(version.seoSnapshotJson) };
}

export async function listActivePublicPosts(client: PublicClient, now = new Date(), limit = 20) {
  const rows = await client.publicWebsitePost.findMany({ where: { status: "PUBLISHED", currentPublishedVersionId: { not: null }, OR: [{ publishAt: null }, { publishAt: { lte: now } }], AND: [{ OR: [{ expireAt: null }, { expireAt: { gt: now } }] }] }, orderBy: [{ featured: "desc" }, { publishedAt: "desc" }], take: limit, select: { id: true, currentPublishedVersionId: true, postType: true, title: true, slug: true, summary: true, publishAt: true, publishedAt: true } });
  const versions = await client.publicWebsitePostVersion.findMany({ where: { id: { in: rows.flatMap((row) => row.currentPublishedVersionId ? [row.currentPublishedVersionId] : []) } }, select: { id: true, postId: true, slugSnapshot: true } });
  const versionById = new Map(versions.map((row) => [row.id, row]));
  return rows.flatMap(({ id, currentPublishedVersionId, ...row }) => {
    const version = currentPublishedVersionId ? versionById.get(currentPublishedVersionId) : null;
    return version?.postId === id && version.slugSnapshot === row.slug ? [row] : [];
  });
}

export async function listPublicNavigation(client: PublicClient) {
  const rows = await client.publicWebsiteNavigationItem.findMany({ where: { enabled: true }, orderBy: [{ displayOrder: "asc" }, { itemCode: "asc" }], select: { itemCode: true, label: true, destinationType: true, safeExternalUrl: true, opensNewTab: true, placement: true, page: { select: { id: true, slug: true, status: true, currentPublishedVersionId: true } } } });
  const versions = await client.publicWebsitePageVersion.findMany({ where: { id: { in: rows.flatMap((row) => row.page?.currentPublishedVersionId ? [row.page.currentPublishedVersionId] : []) } }, select: { id: true, pageId: true, slugSnapshot: true } });
  const versionById = new Map(versions.map((row) => [row.id, row]));
  return rows.flatMap((row) => {
    const version = row.page?.currentPublishedVersionId ? versionById.get(row.page.currentPublishedVersionId) : null;
    const pageIsSafe = row.page?.status === "PUBLISHED" && version?.pageId === row.page.id && version.slugSnapshot === row.page.slug;
    const href = row.destinationType === "PAGE" && pageIsSafe ? `/${row.page!.slug}` : row.destinationType === "NEWS_INDEX" ? "/news" : row.destinationType === "PORTAL_LOGIN" ? "/login" : row.destinationType === "APPROVED_EXTERNAL" ? row.safeExternalUrl : null;
    return href ? [{ itemCode: row.itemCode, label: row.label, href, opensNewTab: row.opensNewTab, placement: row.placement }] : [];
  });
}

export function corePublicSlugForType(pageType: string) {
  const slug = pageType.toLowerCase().replaceAll("_", "-");
  return (CORE_PUBLIC_SLUGS as readonly string[]).includes(slug) ? slug : null;
}

export function assertPublicWorkflowStatus(value: string) {
  if (!STATUS.has(value)) throw new Error("Unsupported public website workflow status.");
  return value;
}
