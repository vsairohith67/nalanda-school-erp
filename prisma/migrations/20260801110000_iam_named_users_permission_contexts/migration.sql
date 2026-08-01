-- IAM-1A is additive. Existing User, relationship, permission and audit
-- concepts remain authoritative; these columns add lifecycle/version evidence.
ALTER TABLE "User" ADD COLUMN "iamPublicKey" TEXT;
ALTER TABLE "User" ADD COLUMN "designation" TEXT;
ALTER TABLE "User" ADD COLUMN "authorizationVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "User" ADD COLUMN "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "temporaryPasswordExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "suspensionReason" TEXT;
ALTER TABLE "User" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "User"
SET "iamPublicKey" = lower(hex(randomblob(16))),
    "lifecycleStatus" = CASE WHEN "isActive" = 1 THEN 'ACTIVE' ELSE 'SUSPENDED' END;

CREATE UNIQUE INDEX "User_iamPublicKey_key" ON "User"("iamPublicKey");
CREATE INDEX "User_lifecycleStatus_idx" ON "User"("lifecycleStatus");
CREATE INDEX "User_authorizationVersion_idx" ON "User"("authorizationVersion");

ALTER TABLE "StaffMember" ADD COLUMN "iamPublicKey" TEXT;
UPDATE "StaffMember" SET "iamPublicKey" = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX "StaffMember_iamPublicKey_key" ON "StaffMember"("iamPublicKey");

ALTER TABLE "Guardian" ADD COLUMN "iamPublicKey" TEXT;
UPDATE "Guardian" SET "iamPublicKey" = lower(hex(randomblob(16)));
CREATE UNIQUE INDEX "Guardian_iamPublicKey_key" ON "Guardian"("iamPublicKey");

ALTER TABLE "AuthSession" ADD COLUMN "authorizationVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AuthSession" ADD COLUMN "activeRoleAssignmentId" TEXT;
ALTER TABLE "AuthSession" ADD COLUMN "activeChildLinkId" TEXT;
ALTER TABLE "AuthSession" ADD COLUMN "contextVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "reason" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "endedByUserId" TEXT,
    "endedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "contextVersion" INTEGER NOT NULL DEFAULT 1,
    "activeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserRoleAssignment_role_check" CHECK ("role" IN ('SUPER_ADMIN', 'DIRECTOR', 'PRINCIPAL', 'ADMIN', 'ACCOUNTANT', 'COMPUTER_OPERATOR', 'TEACHER', 'PARENT', 'VIEWER')),
    CONSTRAINT "UserRoleAssignment_status_check" CHECK ("status" IN ('ACTIVE', 'ENDED', 'REVOKED')),
    CONSTRAINT "UserRoleAssignment_dates_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
    CONSTRAINT "UserRoleAssignment_end_check" CHECK (("status" = 'ACTIVE' AND "endedAt" IS NULL) OR ("status" <> 'ACTIVE' AND "endedAt" IS NOT NULL))
);

CREATE UNIQUE INDEX "UserRoleAssignment_publicKey_key" ON "UserRoleAssignment"("publicKey");
CREATE UNIQUE INDEX "UserRoleAssignment_activeKey_key" ON "UserRoleAssignment"("activeKey");
CREATE INDEX "UserRoleAssignment_userId_status_validFrom_validUntil_idx" ON "UserRoleAssignment"("userId", "status", "validFrom", "validUntil");
CREATE INDEX "UserRoleAssignment_role_status_idx" ON "UserRoleAssignment"("role", "status");

-- The current single role becomes the first governed assignment. This is the
-- only data backfill and does not activate, disable or otherwise change Users.
INSERT INTO "UserRoleAssignment" (
    "id", "publicKey", "userId", "role", "status", "validFrom", "reason",
    "version", "contextVersion", "activeKey", "createdAt", "updatedAt"
)
SELECT
    'iam_role_' || lower(hex(randomblob(16))), lower(hex(randomblob(16))),
    "id", "role", 'ACTIVE', "createdAt", 'IAM-1A legacy role backfill',
    1, 1, "id" || ':' || "role", "createdAt", "updatedAt"
FROM "User";

UPDATE "AuthSession"
SET "authorizationVersion" = COALESCE((
        SELECT "authorizationVersion" FROM "User" WHERE "User"."id" = "AuthSession"."userId"
    ), 1),
    "activeRoleAssignmentId" = (
        SELECT "id" FROM "UserRoleAssignment"
        WHERE "UserRoleAssignment"."userId" = "AuthSession"."userId"
          AND "UserRoleAssignment"."status" = 'ACTIVE'
        ORDER BY "createdAt" ASC LIMIT 1
    );

CREATE TABLE "PermissionProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PermissionProfile_status_check" CHECK ("status" IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT "PermissionProfile_archive_check" CHECK (("status" = 'ACTIVE' AND "archivedAt" IS NULL) OR ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL))
);

CREATE UNIQUE INDEX "PermissionProfile_publicKey_key" ON "PermissionProfile"("publicKey");
CREATE UNIQUE INDEX "PermissionProfile_normalizedName_key" ON "PermissionProfile"("normalizedName");
CREATE INDEX "PermissionProfile_status_name_idx" ON "PermissionProfile"("status", "name");

CREATE TABLE "PermissionProfileEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "revokedByUserId" TEXT,
    "revokedAt" DATETIME,
    "supersedesId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PermissionProfileEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PermissionProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PermissionProfileEntry_effect_check" CHECK ("effect" IN ('ALLOW', 'DENY')),
    CONSTRAINT "PermissionProfileEntry_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT "PermissionProfileEntry_dates_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
    CONSTRAINT "PermissionProfileEntry_revoke_check" CHECK (("status" = 'ACTIVE' AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL))
);

CREATE UNIQUE INDEX "PermissionProfileEntry_activeKey_key" ON "PermissionProfileEntry"("activeKey");
CREATE INDEX "PermissionProfileEntry_profileId_status_permission_idx" ON "PermissionProfileEntry"("profileId", "status", "permission");
CREATE INDEX "PermissionProfileEntry_permission_effect_status_idx" ON "PermissionProfileEntry"("permission", "effect", "status");

CREATE TABLE "PermissionProfileVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PermissionProfileVersion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PermissionProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PermissionProfileVersion_profileId_versionNumber_key" ON "PermissionProfileVersion"("profileId", "versionNumber");
CREATE INDEX "PermissionProfileVersion_profileId_createdAt_idx" ON "PermissionProfileVersion"("profileId", "createdAt");

CREATE TABLE "UserPermissionProfileAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "reason" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "endedByUserId" TEXT,
    "endedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPermissionProfileAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPermissionProfileAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PermissionProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPermissionProfileAssignment_status_check" CHECK ("status" IN ('ACTIVE', 'ENDED', 'REVOKED')),
    CONSTRAINT "UserPermissionProfileAssignment_dates_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
    CONSTRAINT "UserPermissionProfileAssignment_end_check" CHECK (("status" = 'ACTIVE' AND "endedAt" IS NULL) OR ("status" <> 'ACTIVE' AND "endedAt" IS NOT NULL))
);

CREATE UNIQUE INDEX "UserPermissionProfileAssignment_publicKey_key" ON "UserPermissionProfileAssignment"("publicKey");
CREATE UNIQUE INDEX "UserPermissionProfileAssignment_activeKey_key" ON "UserPermissionProfileAssignment"("activeKey");
CREATE INDEX "UserPermissionProfileAssignment_userId_status_validFrom_validUntil_idx" ON "UserPermissionProfileAssignment"("userId", "status", "validFrom", "validUntil");
CREATE INDEX "UserPermissionProfileAssignment_profileId_status_idx" ON "UserPermissionProfileAssignment"("profileId", "status");

CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "revokedByUserId" TEXT,
    "revokedAt" DATETIME,
    "supersedesId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPermissionOverride_effect_check" CHECK ("effect" IN ('ALLOW', 'DENY')),
    CONSTRAINT "UserPermissionOverride_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED')),
    CONSTRAINT "UserPermissionOverride_dates_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
    CONSTRAINT "UserPermissionOverride_revoke_check" CHECK (("status" = 'ACTIVE' AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL))
);

CREATE UNIQUE INDEX "UserPermissionOverride_publicKey_key" ON "UserPermissionOverride"("publicKey");
CREATE UNIQUE INDEX "UserPermissionOverride_activeKey_key" ON "UserPermissionOverride"("activeKey");
CREATE INDEX "UserPermissionOverride_userId_status_permission_idx" ON "UserPermissionOverride"("userId", "status", "permission");
CREATE INDEX "UserPermissionOverride_permission_effect_status_idx" ON "UserPermissionOverride"("permission", "effect", "status");

CREATE TABLE "IamSafetyLock" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "IamSafetyLock" ("key", "version", "updatedAt")
VALUES ('LAST_SUPER_ADMIN', 1, CURRENT_TIMESTAMP);
