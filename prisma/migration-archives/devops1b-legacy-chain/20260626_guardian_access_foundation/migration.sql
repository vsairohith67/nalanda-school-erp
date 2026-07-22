-- Parent/guardian access foundation: guardian master records, sibling links, and optional parent login linkage.
CREATE TABLE "Guardian" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "displayName" TEXT NOT NULL,
  "primaryMobile" TEXT NOT NULL,
  "alternateMobile" TEXT,
  "email" TEXT,
  "relationship" TEXT NOT NULL DEFAULT 'Parent',
  "status" TEXT NOT NULL DEFAULT 'Active',
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "StudentGuardian" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "guardianId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "relationshipToStudent" TEXT NOT NULL DEFAULT 'Parent',
  "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
  "canViewFees" BOOLEAN NOT NULL DEFAULT true,
  "canReceiveReminders" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "User" ADD COLUMN "guardianId" TEXT REFERENCES "Guardian" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Guardian_displayName_idx" ON "Guardian"("displayName");
CREATE INDEX "Guardian_primaryMobile_idx" ON "Guardian"("primaryMobile");
CREATE INDEX "Guardian_email_idx" ON "Guardian"("email");
CREATE INDEX "Guardian_status_idx" ON "Guardian"("status");

CREATE UNIQUE INDEX "StudentGuardian_guardianId_studentId_key" ON "StudentGuardian"("guardianId", "studentId");
CREATE INDEX "StudentGuardian_guardianId_idx" ON "StudentGuardian"("guardianId");
CREATE INDEX "StudentGuardian_studentId_idx" ON "StudentGuardian"("studentId");
CREATE INDEX "StudentGuardian_isPrimaryContact_idx" ON "StudentGuardian"("isPrimaryContact");

CREATE UNIQUE INDEX "User_guardianId_key" ON "User"("guardianId");
CREATE INDEX "User_guardianId_idx" ON "User"("guardianId");
