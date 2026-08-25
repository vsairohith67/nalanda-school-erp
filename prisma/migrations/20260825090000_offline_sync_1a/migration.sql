-- OFFLINE-SYNC-1A server-side trust, idempotency and audit state.
-- Browser-local drafts, PIN verifiers, wrapped encryption keys and device private
-- keys deliberately never enter this database.
CREATE TABLE "OfflineSyncDevice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicDeviceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "publicSigningKey" TEXT NOT NULL,
  "publicKeyHash" TEXT NOT NULL,
  "keyAlgorithm" TEXT NOT NULL DEFAULT 'ECDSA_P256_SHA256',
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" DATETIME,
  "approvedByUserId" TEXT,
  "lastSeenAt" DATETIME,
  "revokedAt" DATETIME,
  "revokedByUserId" TEXT,
  "revocationReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OfflineSyncDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OfflineSyncDevice_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OfflineSyncDevice_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "OfflineSyncChallenge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "publicDeviceId" TEXT NOT NULL,
  "deviceKeyVersion" INTEGER NOT NULL,
  "publicKeyHash" TEXT NOT NULL,
  "challengeHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfflineSyncChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "OfflineSyncNonce" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  CONSTRAINT "OfflineSyncNonce_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "OfflineSyncMutation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "activeRole" TEXT NOT NULL,
  "clientMutationId" TEXT NOT NULL,
  "localDraftId" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "syncSchemaVersion" INTEGER NOT NULL,
  "referenceSnapshotVersion" TEXT NOT NULL,
  "baseEntityVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "authoritativeEntityType" TEXT,
  "authoritativeEntityId" TEXT,
  "authoritativeReference" TEXT,
  "safeResultJson" TEXT,
  "conflictCode" TEXT,
  "rejectionCode" TEXT,
  "createdClientAt" DATETIME NOT NULL,
  "receivedServerAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt" DATETIME,
  "lastAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "OfflineSyncMutation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OfflineSyncMutation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "OfflineSyncEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" TEXT,
  "mutationId" TEXT,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "safeMetadataJson" TEXT,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfflineSyncEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OfflineSyncEvent_mutationId_fkey" FOREIGN KEY ("mutationId") REFERENCES "OfflineSyncMutation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OfflineSyncEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "OfflineSyncConflictReview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "mutationId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "reviewedByUserId" TEXT NOT NULL,
  "resolutionStatus" TEXT NOT NULL,
  "resolutionNote" TEXT NOT NULL,
  "replacementMutationId" TEXT,
  "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfflineSyncConflictReview_mutationId_fkey" FOREIGN KEY ("mutationId") REFERENCES "OfflineSyncMutation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OfflineSyncConflictReview_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OfflineSyncConflictReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OfflineSyncDevice_publicDeviceId_key" ON "OfflineSyncDevice"("publicDeviceId");
CREATE INDEX "OfflineSyncDevice_userId_status_idx" ON "OfflineSyncDevice"("userId", "status");
CREATE INDEX "OfflineSyncDevice_status_requestedAt_idx" ON "OfflineSyncDevice"("status", "requestedAt");
CREATE INDEX "OfflineSyncDevice_lastSeenAt_idx" ON "OfflineSyncDevice"("lastSeenAt");
CREATE UNIQUE INDEX "OfflineSyncChallenge_challengeHash_key" ON "OfflineSyncChallenge"("challengeHash");
CREATE INDEX "OfflineSyncChallenge_userId_purpose_expiresAt_idx" ON "OfflineSyncChallenge"("userId", "purpose", "expiresAt");
CREATE INDEX "OfflineSyncChallenge_publicDeviceId_purpose_idx" ON "OfflineSyncChallenge"("publicDeviceId", "purpose");
CREATE INDEX "OfflineSyncChallenge_expiresAt_idx" ON "OfflineSyncChallenge"("expiresAt");
CREATE UNIQUE INDEX "OfflineSyncNonce_deviceId_nonceHash_key" ON "OfflineSyncNonce"("deviceId", "nonceHash");
CREATE INDEX "OfflineSyncNonce_expiresAt_idx" ON "OfflineSyncNonce"("expiresAt");
CREATE UNIQUE INDEX "OfflineSyncMutation_deviceId_clientMutationId_key" ON "OfflineSyncMutation"("deviceId", "clientMutationId");
CREATE INDEX "OfflineSyncMutation_actorUserId_updatedAt_idx" ON "OfflineSyncMutation"("actorUserId", "updatedAt");
CREATE INDEX "OfflineSyncMutation_deviceId_status_updatedAt_idx" ON "OfflineSyncMutation"("deviceId", "status", "updatedAt");
CREATE INDEX "OfflineSyncMutation_operationType_status_idx" ON "OfflineSyncMutation"("operationType", "status");
CREATE INDEX "OfflineSyncMutation_authoritativeEntityType_authoritativeEntityId_idx" ON "OfflineSyncMutation"("authoritativeEntityType", "authoritativeEntityId");
CREATE INDEX "OfflineSyncEvent_deviceId_occurredAt_idx" ON "OfflineSyncEvent"("deviceId", "occurredAt");
CREATE INDEX "OfflineSyncEvent_mutationId_occurredAt_idx" ON "OfflineSyncEvent"("mutationId", "occurredAt");
CREATE INDEX "OfflineSyncEvent_actorUserId_occurredAt_idx" ON "OfflineSyncEvent"("actorUserId", "occurredAt");
CREATE INDEX "OfflineSyncEvent_eventType_occurredAt_idx" ON "OfflineSyncEvent"("eventType", "occurredAt");
CREATE INDEX "OfflineSyncConflictReview_mutationId_reviewedAt_idx" ON "OfflineSyncConflictReview"("mutationId", "reviewedAt");
CREATE INDEX "OfflineSyncConflictReview_deviceId_reviewedAt_idx" ON "OfflineSyncConflictReview"("deviceId", "reviewedAt");
CREATE INDEX "OfflineSyncConflictReview_reviewedByUserId_reviewedAt_idx" ON "OfflineSyncConflictReview"("reviewedByUserId", "reviewedAt");

CREATE TRIGGER "OfflineSyncDevice_status_insert" BEFORE INSERT ON "OfflineSyncDevice"
WHEN NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED')
BEGIN SELECT RAISE(ABORT, 'OFFLINE_DEVICE_STATUS_INVALID'); END;
CREATE TRIGGER "OfflineSyncDevice_status_update" BEFORE UPDATE OF "status" ON "OfflineSyncDevice"
WHEN NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED') OR OLD."status" IN ('REVOKED','RETIRED')
BEGIN SELECT RAISE(ABORT, 'OFFLINE_DEVICE_TRANSITION_INVALID'); END;
CREATE TRIGGER "OfflineSyncDevice_key_rotation" BEFORE UPDATE OF "publicSigningKey","publicKeyHash","keyVersion" ON "OfflineSyncDevice"
WHEN OLD."status" <> 'ACTIVE' OR NEW."status" <> 'ACTIVE' OR NEW."keyVersion" <> OLD."keyVersion" + 1
BEGIN SELECT RAISE(ABORT, 'OFFLINE_DEVICE_KEY_ROTATION_INVALID'); END;
CREATE TRIGGER "OfflineSyncMutation_contract_insert" BEFORE INSERT ON "OfflineSyncMutation"
WHEN NEW."operationType" NOT IN ('FEE_PAYMENT','EXPENSE_DRAFT','MISC_INCOME') OR NEW."status" <> 'RECEIVED' OR NEW."syncSchemaVersion" <> 1
BEGIN SELECT RAISE(ABORT, 'OFFLINE_MUTATION_CONTRACT_INVALID'); END;
CREATE TRIGGER "OfflineSyncMutation_terminal_immutable" BEFORE UPDATE ON "OfflineSyncMutation"
WHEN OLD."status" IN ('ACCEPTED','CONFLICT','REJECTED')
BEGIN SELECT RAISE(ABORT, 'OFFLINE_MUTATION_TERMINAL_IMMUTABLE'); END;
CREATE TRIGGER "OfflineSyncMutation_no_delete" BEFORE DELETE ON "OfflineSyncMutation" BEGIN SELECT RAISE(ABORT, 'OFFLINE_MUTATION_IMMUTABLE'); END;
CREATE TRIGGER "OfflineSyncEvent_no_update" BEFORE UPDATE ON "OfflineSyncEvent" BEGIN SELECT RAISE(ABORT, 'OFFLINE_EVENT_IMMUTABLE'); END;
CREATE TRIGGER "OfflineSyncEvent_no_delete" BEFORE DELETE ON "OfflineSyncEvent" BEGIN SELECT RAISE(ABORT, 'OFFLINE_EVENT_IMMUTABLE'); END;
CREATE TRIGGER "OfflineSyncConflictReview_no_update" BEFORE UPDATE ON "OfflineSyncConflictReview" BEGIN SELECT RAISE(ABORT, 'OFFLINE_CONFLICT_REVIEW_IMMUTABLE'); END;
CREATE TRIGGER "OfflineSyncConflictReview_no_delete" BEFORE DELETE ON "OfflineSyncConflictReview" BEGIN SELECT RAISE(ABORT, 'OFFLINE_CONFLICT_REVIEW_IMMUTABLE'); END;
