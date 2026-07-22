CREATE TABLE "Notice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL DEFAULT 'ALL_PARENTS',
    "className" TEXT,
    "section" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishDate" DATETIME,
    "expiresAt" DATETIME,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Notice_status_publishDate_idx" ON "Notice"("status", "publishDate");
CREATE INDEX "Notice_audienceType_className_section_idx" ON "Notice"("audienceType", "className", "section");
CREATE INDEX "Notice_expiresAt_idx" ON "Notice"("expiresAt");
CREATE INDEX "Notice_createdById_idx" ON "Notice"("createdById");
CREATE INDEX "Notice_updatedById_idx" ON "Notice"("updatedById");
