-- Prompt 20D: controlled public website and immutable publication snapshots.
-- No table relates to private ERP people, finance, attendance, assessment, or communication records.

CREATE TABLE "PublicWebsiteSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "settingsCode" TEXT NOT NULL,
  "siteName" TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  "tagline" TEXT,
  "publicSiteUrl" TEXT,
  "publicAddress" TEXT,
  "publicOfficePhone" TEXT,
  "publicOfficeEmail" TEXT,
  "publicOfficeHours" TEXT,
  "publicDirectionsUrl" TEXT,
  "portalLoginPath" TEXT NOT NULL DEFAULT '/login',
  "defaultSeoTitle" TEXT NOT NULL,
  "defaultSeoDescription" TEXT NOT NULL,
  "defaultSocialImageKey" TEXT,
  "themeConfigJson" TEXT NOT NULL DEFAULT '{}',
  "contactConfigJson" TEXT NOT NULL DEFAULT '{}',
  "socialLinksJson" TEXT,
  "mandatoryDisclosureEnabled" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "reviewVersion" INTEGER NOT NULL DEFAULT 1,
  "approvedReviewVersion" INTEGER,
  "createdByUserId" TEXT,
  "reviewedByUserId" TEXT,
  "publishedByUserId" TEXT,
  "reviewedAt" DATETIME,
  "publishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "PublicWebsiteSettings_settingsCode_key" ON "PublicWebsiteSettings"("settingsCode");
CREATE INDEX "PublicWebsiteSettings_status_publishedAt_idx" ON "PublicWebsiteSettings"("status", "publishedAt");

CREATE TABLE "PublicWebsitePage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pageCode" TEXT NOT NULL,
  "pageType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "navigationLabel" TEXT,
  "summary" TEXT,
  "draftContentJson" TEXT NOT NULL,
  "draftSeoJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "reviewVersion" INTEGER NOT NULL DEFAULT 1,
  "approvedReviewVersion" INTEGER,
  "currentPublishedVersionId" TEXT,
  "showInNavigation" BOOLEAN NOT NULL DEFAULT false,
  "navigationOrder" INTEGER,
  "indexable" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "reviewedByUserId" TEXT,
  "publishedByUserId" TEXT,
  "archivedByUserId" TEXT,
  "reviewedAt" DATETIME,
  "publishedAt" DATETIME,
  "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "PublicWebsitePage_pageCode_key" ON "PublicWebsitePage"("pageCode");
CREATE UNIQUE INDEX "PublicWebsitePage_slug_key" ON "PublicWebsitePage"("slug");
CREATE INDEX "PublicWebsitePage_status_pageType_idx" ON "PublicWebsitePage"("status", "pageType");
CREATE INDEX "PublicWebsitePage_showInNavigation_navigationOrder_idx" ON "PublicWebsitePage"("showInNavigation", "navigationOrder");

CREATE TABLE "PublicWebsitePageVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pageId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "versionType" TEXT NOT NULL DEFAULT 'ORIGINAL',
  "titleSnapshot" TEXT NOT NULL,
  "slugSnapshot" TEXT NOT NULL,
  "contentSnapshotJson" TEXT NOT NULL,
  "seoSnapshotJson" TEXT NOT NULL,
  "settingsSnapshotJson" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "publicationReason" TEXT,
  "correctionReason" TEXT,
  "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedByUserId" TEXT,
  "supersedesVersionId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicWebsitePageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PublicWebsitePage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PublicWebsitePageVersion_pageId_versionNumber_key" ON "PublicWebsitePageVersion"("pageId", "versionNumber");
CREATE INDEX "PublicWebsitePageVersion_slugSnapshot_publishedAt_idx" ON "PublicWebsitePageVersion"("slugSnapshot", "publishedAt");
CREATE INDEX "PublicWebsitePageVersion_contentHash_idx" ON "PublicWebsitePageVersion"("contentHash");

CREATE TABLE "PublicWebsitePost" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postNumber" TEXT NOT NULL,
  "postType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "draftContentJson" TEXT NOT NULL,
  "draftSeoJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "reviewVersion" INTEGER NOT NULL DEFAULT 1,
  "approvedReviewVersion" INTEGER,
  "currentPublishedVersionId" TEXT,
  "publishAt" DATETIME,
  "expireAt" DATETIME,
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "reviewedByUserId" TEXT,
  "publishedByUserId" TEXT,
  "archivedByUserId" TEXT,
  "reviewedAt" DATETIME,
  "publishedAt" DATETIME,
  "archivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "PublicWebsitePost_postNumber_key" ON "PublicWebsitePost"("postNumber");
CREATE UNIQUE INDEX "PublicWebsitePost_slug_key" ON "PublicWebsitePost"("slug");
CREATE INDEX "PublicWebsitePost_status_postType_publishAt_idx" ON "PublicWebsitePost"("status", "postType", "publishAt");
CREATE INDEX "PublicWebsitePost_featured_publishedAt_idx" ON "PublicWebsitePost"("featured", "publishedAt");

CREATE TABLE "PublicWebsitePostVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "versionType" TEXT NOT NULL DEFAULT 'ORIGINAL',
  "titleSnapshot" TEXT NOT NULL,
  "slugSnapshot" TEXT NOT NULL,
  "summarySnapshot" TEXT NOT NULL,
  "contentSnapshotJson" TEXT NOT NULL,
  "seoSnapshotJson" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "publicationReason" TEXT,
  "correctionReason" TEXT,
  "publishAt" DATETIME,
  "expireAt" DATETIME,
  "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedByUserId" TEXT,
  "supersedesVersionId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublicWebsitePostVersion_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PublicWebsitePost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PublicWebsitePostVersion_postId_versionNumber_key" ON "PublicWebsitePostVersion"("postId", "versionNumber");
CREATE INDEX "PublicWebsitePostVersion_slugSnapshot_publishedAt_idx" ON "PublicWebsitePostVersion"("slugSnapshot", "publishedAt");
CREATE INDEX "PublicWebsitePostVersion_contentHash_idx" ON "PublicWebsitePostVersion"("contentHash");

CREATE TABLE "PublicWebsiteNavigationItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "itemCode" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "destinationType" TEXT NOT NULL,
  "pageId" TEXT,
  "safeExternalUrl" TEXT,
  "displayOrder" INTEGER NOT NULL,
  "placement" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "opensNewTab" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "PublicWebsiteNavigationItem_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PublicWebsitePage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PublicWebsiteNavigationItem_itemCode_key" ON "PublicWebsiteNavigationItem"("itemCode");
CREATE INDEX "PublicWebsiteNavigationItem_placement_enabled_displayOrder_idx" ON "PublicWebsiteNavigationItem"("placement", "enabled", "displayOrder");
CREATE INDEX "PublicWebsiteNavigationItem_pageId_idx" ON "PublicWebsiteNavigationItem"("pageId");

CREATE TABLE "PublicWebsiteEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "safeReason" TEXT,
  "safeMetadataJson" TEXT,
  "actorUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PublicWebsiteEvent_entityType_entityId_eventDate_idx" ON "PublicWebsiteEvent"("entityType", "entityId", "eventDate");
CREATE INDEX "PublicWebsiteEvent_eventType_eventDate_idx" ON "PublicWebsiteEvent"("eventType", "eventDate");
