-- CreateTable
CREATE TABLE "AuthLoginAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "displayMasked" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isSchoolGoverned" BOOLEAN NOT NULL DEFAULT false,
    "admissionStudentId" TEXT,
    "verifiedAt" DATETIME,
    "removedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuthLoginAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuthLoginAlias_admissionStudentId_fkey" FOREIGN KEY ("admissionStudentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuthLoginAlias_type_check" CHECK ("type" IN ('USERNAME', 'WORK_EMAIL', 'PERSONAL_EMAIL', 'MOBILE', 'ADMISSION_NUMBER')),
    CONSTRAINT "AuthLoginAlias_status_check" CHECK ("status" IN ('PENDING', 'VERIFIED', 'REMOVED')),
    CONSTRAINT "AuthLoginAlias_admission_check" CHECK (("type" = 'ADMISSION_NUMBER' AND "admissionStudentId" IS NOT NULL AND "isSchoolGoverned" = 1) OR ("type" <> 'ADMISSION_NUMBER' AND "admissionStudentId" IS NULL)),
    CONSTRAINT "AuthLoginAlias_verification_check" CHECK (("status" = 'VERIFIED' AND "verifiedAt" IS NOT NULL AND "removedAt" IS NULL) OR ("status" = 'REMOVED' AND "removedAt" IS NOT NULL) OR "status" = 'PENDING')
);

-- CreateTable
CREATE TABLE "AuthVerificationChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aliasId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "invalidatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthVerificationChallenge_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "AuthLoginAlias" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuthVerificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuthVerificationChallenge_purpose_check" CHECK ("purpose" = 'VERIFY_LOGIN_ALIAS'),
    CONSTRAINT "AuthVerificationChallenge_attempts_check" CHECK ("attempts" >= 0 AND "maxAttempts" BETWEEN 1 AND 10)
);

-- CreateTable
CREATE TABLE "AuthPasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "aliasId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET',
    "tokenHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "invalidatedAt" DATETIME,
    "invalidationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthPasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuthPasswordResetToken_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "AuthLoginAlias" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuthPasswordResetToken_purpose_check" CHECK ("purpose" = 'PASSWORD_RESET'),
    CONSTRAINT "AuthPasswordResetToken_channel_check" CHECK ("channelType" IN ('WORK_EMAIL', 'PERSONAL_EMAIL', 'MOBILE')),
    CONSTRAINT "AuthPasswordResetToken_attempts_check" CHECK ("attempts" >= 0 AND "maxAttempts" BETWEEN 1 AND 10)
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "revocationReason" TEXT,
    "deviceSummary" TEXT NOT NULL,
    "browserSummary" TEXT NOT NULL,
    "networkEvidenceMasked" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthSecurityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "detailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthSecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuthSecurityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL DEFAULT 1,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "guardianId" TEXT,
    CONSTRAINT "User_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "guardianId", "id", "isActive", "lastLoginAt", "name", "passwordHash", "role", "updatedAt", "username") SELECT "createdAt", "email", "guardianId", "id", "isActive", "lastLoginAt", "name", "passwordHash", "role", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_guardianId_key" ON "User"("guardianId");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");
CREATE INDEX "User_guardianId_idx" ON "User"("guardianId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Existing usernames are the only legacy identifiers allowed to survive the
-- cutover. Profile email/mobile fields are deliberately not promoted.
INSERT INTO "AuthLoginAlias" (
    "id", "userId", "type", "normalizedValue", "displayMasked", "status",
    "isSchoolGoverned", "verifiedAt", "version", "createdAt", "updatedAt"
)
SELECT
    'auth2b_username_' || "id", "id", 'USERNAME', lower(trim("username")),
    "username", 'VERIFIED', 1, "createdAt", 1, "createdAt", "updatedAt"
FROM "User";

-- CreateIndex
CREATE UNIQUE INDEX "AuthLoginAlias_normalizedValue_key" ON "AuthLoginAlias"("normalizedValue");

-- CreateIndex
CREATE INDEX "AuthLoginAlias_userId_status_idx" ON "AuthLoginAlias"("userId", "status");

-- CreateIndex
CREATE INDEX "AuthLoginAlias_type_status_idx" ON "AuthLoginAlias"("type", "status");

-- CreateIndex
CREATE INDEX "AuthLoginAlias_admissionStudentId_idx" ON "AuthLoginAlias"("admissionStudentId");

-- CreateIndex
CREATE INDEX "AuthVerificationChallenge_aliasId_purpose_createdAt_idx" ON "AuthVerificationChallenge"("aliasId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AuthVerificationChallenge_userId_purpose_createdAt_idx" ON "AuthVerificationChallenge"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AuthVerificationChallenge_expiresAt_idx" ON "AuthVerificationChallenge"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthPasswordResetToken_tokenHash_key" ON "AuthPasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthPasswordResetToken_userId_purpose_createdAt_idx" ON "AuthPasswordResetToken"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "AuthPasswordResetToken_expiresAt_idx" ON "AuthPasswordResetToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_expiresAt_idx" ON "AuthSession"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_userId_createdAt_idx" ON "AuthSecurityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_actorUserId_createdAt_idx" ON "AuthSecurityEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_eventType_createdAt_idx" ON "AuthSecurityEvent"("eventType", "createdAt");
