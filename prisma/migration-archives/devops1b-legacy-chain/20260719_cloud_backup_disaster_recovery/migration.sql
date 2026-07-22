-- Prompt 20C: encrypted off-device backup and isolated disaster-recovery metadata.
-- No provider credentials, encryption keys, decrypted payloads, object bodies or
-- absolute filesystem paths are stored in this schema.
CREATE TABLE "CloudBackupProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "profileCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "providerKind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "liveUseEnabled" BOOLEAN NOT NULL DEFAULT false,
  "destinationLabel" TEXT NOT NULL,
  "destinationReferenceMasked" TEXT,
  "encryptionKeyVersion" TEXT NOT NULL,
  "containerFormatVersion" INTEGER NOT NULL DEFAULT 1,
  "compressionAlgorithm" TEXT NOT NULL DEFAULT 'GZIP',
  "encryptionAlgorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM',
  "verificationRequired" BOOLEAN NOT NULL DEFAULT true,
  "automaticRestoreRehearsalEnabled" BOOLEAN NOT NULL DEFAULT false,
  "maximumRetryCount" INTEGER NOT NULL DEFAULT 3,
  "requestTimeoutMs" INTEGER NOT NULL DEFAULT 30000,
  "maximumArtifactBytes" INTEGER,
  "privateAssetsIncluded" BOOLEAN NOT NULL DEFAULT false,
  "lastHealthCheckAt" DATETIME,
  "lastHealthCheckStatus" TEXT,
  "lastHealthCheckMessage" TEXT,
  "activatedByUserId" TEXT,
  "pausedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CloudBackupProfile_profileCode_key" ON "CloudBackupProfile"("profileCode");
CREATE INDEX "CloudBackupProfile_providerKind_status_idx" ON "CloudBackupProfile"("providerKind", "status");
CREATE INDEX "CloudBackupProfile_status_liveUseEnabled_idx" ON "CloudBackupProfile"("status", "liveUseEnabled");

CREATE TABLE "CloudBackupSchedule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scheduleCode" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "frequency" TEXT NOT NULL DEFAULT 'MANUAL_ONLY',
  "intervalCount" INTEGER NOT NULL DEFAULT 1,
  "hourOfDay" INTEGER,
  "minuteOfHour" INTEGER,
  "dayOfWeek" INTEGER,
  "dayOfMonth" INTEGER,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "catchUpPolicy" TEXT NOT NULL DEFAULT 'SKIP_MISSED',
  "nextRunAt" DATETIME,
  "lastDueAt" DATETIME,
  "lastStartedAt" DATETIME,
  "lastCompletedAt" DATETIME,
  "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CloudBackupSchedule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CloudBackupSchedule_scheduleCode_key" ON "CloudBackupSchedule"("scheduleCode");
CREATE INDEX "CloudBackupSchedule_enabled_nextRunAt_idx" ON "CloudBackupSchedule"("enabled", "nextRunAt");
CREATE INDEX "CloudBackupSchedule_profileId_enabled_idx" ON "CloudBackupSchedule"("profileId", "enabled");

CREATE TABLE "CloudBackupRetentionPolicy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "policyCode" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "keepLatestVerifiedCount" INTEGER NOT NULL DEFAULT 2,
  "keepDailyDays" INTEGER NOT NULL DEFAULT 14,
  "keepWeeklyWeeks" INTEGER NOT NULL DEFAULT 8,
  "keepMonthlyMonths" INTEGER NOT NULL DEFAULT 12,
  "minimumVerifiedCopies" INTEGER NOT NULL DEFAULT 2,
  "protectLatestVerified" BOOLEAN NOT NULL DEFAULT true,
  "autoPruneEnabled" BOOLEAN NOT NULL DEFAULT false,
  "preserveFailedRuns" BOOLEAN NOT NULL DEFAULT true,
  "preserveRestoreRehearsalSources" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CloudBackupRetentionPolicy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CloudBackupRetentionPolicy_policyCode_key" ON "CloudBackupRetentionPolicy"("policyCode");
CREATE UNIQUE INDEX "CloudBackupRetentionPolicy_profileId_key" ON "CloudBackupRetentionPolicy"("profileId");

CREATE TABLE "CloudBackupRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runNumber" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "scheduleId" TEXT,
  "triggerType" TEXT NOT NULL,
  "scheduledDueAt" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "sourceBackupVersion" INTEGER,
  "sourceGeneratedAt" DATETIME,
  "sourcePlaintextSha256" TEXT,
  "ciphertextSha256" TEXT,
  "plaintextBytes" INTEGER,
  "compressedBytes" INTEGER,
  "encryptedBytes" INTEGER,
  "encryptionKeyVersion" TEXT,
  "containerFormatVersion" INTEGER,
  "providerObjectReferenceSafe" TEXT,
  "providerObjectVersionSafe" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" DATETIME,
  "failureCode" TEXT,
  "failureMessageSafe" TEXT,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "createdByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "cancellationReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CloudBackupRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CloudBackupRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CloudBackupSchedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CloudBackupRun_runNumber_key" ON "CloudBackupRun"("runNumber");
CREATE UNIQUE INDEX "CloudBackupRun_idempotencyKey_key" ON "CloudBackupRun"("idempotencyKey");
CREATE INDEX "CloudBackupRun_profileId_status_createdAt_idx" ON "CloudBackupRun"("profileId", "status", "createdAt");
CREATE INDEX "CloudBackupRun_scheduleId_scheduledDueAt_idx" ON "CloudBackupRun"("scheduleId", "scheduledDueAt");
CREATE INDEX "CloudBackupRun_status_nextRetryAt_idx" ON "CloudBackupRun"("status", "nextRetryAt");

CREATE TABLE "CloudBackupArtifact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "artifactType" TEXT NOT NULL DEFAULT 'DATABASE_BACKUP',
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "objectKeySafe" TEXT NOT NULL,
  "providerObjectIdSafe" TEXT,
  "encryptionKeyVersion" TEXT NOT NULL,
  "plaintextSha256" TEXT NOT NULL,
  "ciphertextSha256" TEXT NOT NULL,
  "plaintextBytes" INTEGER NOT NULL,
  "compressedBytes" INTEGER NOT NULL,
  "ciphertextBytes" INTEGER NOT NULL,
  "privateAssetsIncluded" BOOLEAN NOT NULL DEFAULT false,
  "sourceCoverageJson" TEXT NOT NULL,
  "uploadedAt" DATETIME,
  "verifiedAt" DATETIME,
  "prunedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CloudBackupArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CloudBackupArtifact_runId_artifactType_key" ON "CloudBackupArtifact"("runId", "artifactType");
CREATE UNIQUE INDEX "CloudBackupArtifact_runId_objectKeySafe_key" ON "CloudBackupArtifact"("runId", "objectKeySafe");
CREATE INDEX "CloudBackupArtifact_status_verifiedAt_idx" ON "CloudBackupArtifact"("status", "verifiedAt");

CREATE TABLE "CloudBackupVerification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "verificationType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationMs" INTEGER,
  "expectedValueHash" TEXT,
  "actualValueHash" TEXT,
  "safeSummary" TEXT NOT NULL,
  "failureCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloudBackupVerification_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CloudBackupVerification_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CloudBackupArtifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CloudBackupVerification_runId_checkedAt_idx" ON "CloudBackupVerification"("runId", "checkedAt");
CREATE INDEX "CloudBackupVerification_artifactId_checkedAt_idx" ON "CloudBackupVerification"("artifactId", "checkedAt");
CREATE INDEX "CloudBackupVerification_status_verificationType_idx" ON "CloudBackupVerification"("status", "verificationType");

CREATE TABLE "CloudBackupRestoreRehearsal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rehearsalNumber" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "backupVersion" INTEGER,
  "firstRestoreSummaryJson" TEXT,
  "secondRestoreSummaryJson" TEXT,
  "countDigestBefore" TEXT,
  "countDigestAfterFirst" TEXT,
  "countDigestAfterSecond" TEXT,
  "sourceDatabaseUnchangedHash" TEXT,
  "temporaryDatabaseRemoved" BOOLEAN NOT NULL DEFAULT false,
  "failureCode" TEXT,
  "failureMessageSafe" TEXT,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "createdByUserId" TEXT,
  "cancelledByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CloudBackupRestoreRehearsal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CloudBackupRestoreRehearsal_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CloudBackupArtifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CloudBackupRestoreRehearsal_rehearsalNumber_key" ON "CloudBackupRestoreRehearsal"("rehearsalNumber");
CREATE INDEX "CloudBackupRestoreRehearsal_status_createdAt_idx" ON "CloudBackupRestoreRehearsal"("status", "createdAt");
CREATE INDEX "CloudBackupRestoreRehearsal_artifactId_createdAt_idx" ON "CloudBackupRestoreRehearsal"("artifactId", "createdAt");

CREATE TABLE "CloudBackupEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "profileId" TEXT,
  "scheduleId" TEXT,
  "runId" TEXT,
  "artifactId" TEXT,
  "rehearsalId" TEXT,
  "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason" TEXT,
  "safeMetadataJson" TEXT,
  "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CloudBackupEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CloudBackupEvent_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CloudBackupSchedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CloudBackupEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CloudBackupEvent_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CloudBackupArtifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CloudBackupEvent_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "CloudBackupRestoreRehearsal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CloudBackupEvent_profileId_eventDate_idx" ON "CloudBackupEvent"("profileId", "eventDate");
CREATE INDEX "CloudBackupEvent_runId_eventDate_idx" ON "CloudBackupEvent"("runId", "eventDate");
CREATE INDEX "CloudBackupEvent_eventType_eventDate_idx" ON "CloudBackupEvent"("eventType", "eventDate");
