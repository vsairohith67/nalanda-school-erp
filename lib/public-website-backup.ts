import { parsePublicWebsiteBlocks } from "@/lib/public-website-blocks";
import { parsePublicWebsiteSeo } from "@/lib/public-website-seo";

type Row = Record<string, unknown>;
const SHA256 = /^[A-F0-9]{64}$/i;
const FORBIDDEN = /password|session|credential|secret|token|dns|mxRecord|spf|dkim|dmarc|hosting|privateData|student|guardian|payment|staff/i;

export function validatePublicWebsiteBackupRows(root: Record<string, unknown>) {
  const publicWebsiteSettings = rows(root.publicWebsiteSettings, "publicWebsiteSettings");
  const publicWebsitePages = rows(root.publicWebsitePages, "publicWebsitePages");
  const publicWebsitePageVersions = rows(root.publicWebsitePageVersions, "publicWebsitePageVersions");
  const publicWebsitePosts = rows(root.publicWebsitePosts, "publicWebsitePosts");
  const publicWebsitePostVersions = rows(root.publicWebsitePostVersions, "publicWebsitePostVersions");
  const publicWebsiteNavigationItems = rows(root.publicWebsiteNavigationItems, "publicWebsiteNavigationItems");
  const publicWebsiteEvents = rows(root.publicWebsiteEvents, "publicWebsiteEvents");

  unique(publicWebsiteSettings, "settingsCode", "public website settings");
  const pageIds = unique(publicWebsitePages, "pageCode", "public website page");
  uniqueNatural(publicWebsitePages, "slug", "public website page slug");
  const postIds = unique(publicWebsitePosts, "postNumber", "public website post");
  uniqueNatural(publicWebsitePosts, "slug", "public website post slug");
  unique(publicWebsiteNavigationItems, "itemCode", "public website navigation item");
  uniqueIds(publicWebsiteEvents, "public website event");

  publicWebsitePages.forEach((row, index) => {
    parsePublicWebsiteBlocks(required(row.draftContentJson, `publicWebsitePages[${index}].draftContentJson`));
    parsePublicWebsiteSeo(required(row.draftSeoJson, `publicWebsitePages[${index}].draftSeoJson`));
  });
  publicWebsitePosts.forEach((row, index) => {
    parsePublicWebsiteBlocks(required(row.draftContentJson, `publicWebsitePosts[${index}].draftContentJson`));
    parsePublicWebsiteSeo(required(row.draftSeoJson, `publicWebsitePosts[${index}].draftSeoJson`));
  });
  const pageVersions = validateVersions(publicWebsitePageVersions, "pageId", pageIds, "publicWebsitePageVersions");
  const postVersions = validateVersions(publicWebsitePostVersions, "postId", postIds, "publicWebsitePostVersions");
  validateCurrentVersionPointers(publicWebsitePages, pageVersions, "pageId", "publicWebsitePages");
  validateCurrentVersionPointers(publicWebsitePosts, postVersions, "postId", "publicWebsitePosts");
  publicWebsiteNavigationItems.forEach((row, index) => {
    if (row.pageId != null && !pageIds.has(required(row.pageId, `publicWebsiteNavigationItems[${index}].pageId`))) {
      throw new Error(`publicWebsiteNavigationItems[${index}].pageId does not match a backup page`);
    }
  });
  return { publicWebsiteSettings, publicWebsitePages, publicWebsitePageVersions, publicWebsitePosts, publicWebsitePostVersions, publicWebsiteNavigationItems, publicWebsiteEvents };
}

function validateVersions(values: Row[], linkKey: string, parentIds: Set<string>, label: string) {
  uniqueIds(values, label);
  const pairs = new Set<string>();
  const identities = new Map<string, { parentId: string; versionNumber: number }>();
  const byParent = new Map<string, Array<{ id: string; row: Row; index: number; versionNumber: number }>>();
  values.forEach((row, index) => {
    const id = required(row.id, `${label}[${index}].id`);
    const parent = required(row[linkKey], `${label}[${index}].${linkKey}`);
    if (!parentIds.has(parent)) throw new Error(`${label}[${index}] does not match a backup parent`);
    const version = Number(row.versionNumber);
    if (!Number.isInteger(version) || version < 1) throw new Error(`${label}[${index}].versionNumber is invalid`);
    const pair = `${parent}:${version}`;
    if (pairs.has(pair)) throw new Error(`${label} duplicates a parent/version pair`);
    pairs.add(pair);
    if (!SHA256.test(required(row.contentHash, `${label}[${index}].contentHash`))) throw new Error(`${label}[${index}].contentHash is invalid`);
    parsePublicWebsiteBlocks(required(row.contentSnapshotJson, `${label}[${index}].contentSnapshotJson`));
    parsePublicWebsiteSeo(required(row.seoSnapshotJson, `${label}[${index}].seoSnapshotJson`));
    identities.set(id, { parentId: parent, versionNumber: version });
    const family = byParent.get(parent) ?? [];
    family.push({ id, row, index, versionNumber: version });
    byParent.set(parent, family);
  });
  for (const family of byParent.values()) {
    family.sort((a, b) => a.versionNumber - b.versionNumber);
    family.forEach((entry, index) => {
      if (entry.versionNumber !== index + 1) throw new Error(`${label} has a non-contiguous immutable version history`);
      const supersedes = entry.row.supersedesVersionId == null ? null : required(entry.row.supersedesVersionId, `${label}[${entry.index}].supersedesVersionId`);
      const versionType = required(entry.row.versionType, `${label}[${entry.index}].versionType`);
      if (index === 0 && (versionType !== "ORIGINAL" || supersedes)) {
        throw new Error(`${label}[${entry.index}] version 1 must be the original publication`);
      }
      if (index > 0 && (versionType !== "CORRECTION" || supersedes !== family[index - 1].id)) {
        throw new Error(`${label}[${entry.index}] must supersede the immediately prior version for the same parent`);
      }
    });
  }
  return identities;
}

function validateCurrentVersionPointers(
  parents: Row[],
  versions: Map<string, { parentId: string; versionNumber: number }>,
  parentKey: string,
  label: string
) {
  parents.forEach((row, index) => {
    if (row.currentPublishedVersionId == null) return;
    const currentId = required(row.currentPublishedVersionId, `${label}[${index}].currentPublishedVersionId`);
    const version = versions.get(currentId);
    const parentId = required(row.id, `${label}[${index}].id`);
    if (!version || version.parentId !== parentId) {
      throw new Error(`${label}[${index}].currentPublishedVersionId does not match a version for the same ${parentKey}`);
    }
  });
}

function rows(value: unknown, label: string): Row[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100_000) throw new Error(`${label} must be a bounded array`);
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`${label}[${index}] must be an object`);
    const row = entry as Row;
    if (Object.keys(row).some((key) => FORBIDDEN.test(key))) throw new Error(`${label}[${index}] contains a forbidden private, credential or infrastructure field`);
    return row;
  });
}

function unique(values: Row[], key: string, label: string) {
  const ids = uniqueIds(values, label);
  uniqueNatural(values, key, label);
  return ids;
}
function uniqueNatural(values: Row[], key: string, label: string) {
  const seen = new Set<string>();
  values.forEach((row, index) => {
    const value = required(row[key], `${label}[${index}].${key}`);
    if (seen.has(value)) throw new Error(`${label} duplicates ${key}`);
    seen.add(value);
  });
}
function uniqueIds(values: Row[], label: string) {
  const ids = new Set<string>();
  values.forEach((row, index) => {
    const id = required(row.id, `${label}[${index}].id`);
    if (ids.has(id)) throw new Error(`${label} duplicates id`);
    ids.add(id);
  });
  return ids;
}
function required(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 100_000) throw new Error(`${label} is invalid`);
  return value;
}
