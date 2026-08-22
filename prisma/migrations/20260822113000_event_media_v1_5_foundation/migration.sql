-- EVENT-MEDIA-V1_5-1A: additive, privacy-first media governance foundation.
CREATE TABLE "EventMediaAlbum" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL,
  "description" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'PRIVATE_LEADERSHIP',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "reviewStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
  "publicationState" TEXT NOT NULL DEFAULT 'PRIVATE',
  "coverAssetPublicKey" TEXT,
  "retentionPolicy" TEXT NOT NULL DEFAULT 'GOVERNED_SCHOOL_MEDIA',
  "retentionReviewAt" DATETIME,
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "publishedByUserId" TEXT,
  "unpublishedByUserId" TEXT,
  "archivedByUserId" TEXT,
  "reviewedAt" DATETIME,
  "approvedAt" DATETIME,
  "publishedAt" DATETIME,
  "unpublishedAt" DATETIME,
  "archivedAt" DATETIME,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "EventMediaAsset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "albumId" TEXT NOT NULL,
  "originalStorageKey" TEXT NOT NULL,
  "originalMediaType" TEXT NOT NULL,
  "originalExtension" TEXT NOT NULL,
  "originalByteSize" INTEGER NOT NULL,
  "originalSha256" TEXT NOT NULL,
  "originalWidth" INTEGER NOT NULL,
  "originalHeight" INTEGER NOT NULL,
  "uploadActorUserId" TEXT NOT NULL,
  "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT,
  "reviewedAt" DATETIME,
  "reviewNote" TEXT,
  "caption" TEXT,
  "peopleDeclaration" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "publicationEligibility" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "publicationStatus" TEXT NOT NULL DEFAULT 'PRIVATE',
  "withdrawalState" TEXT NOT NULL DEFAULT 'NONE',
  "withdrawalReason" TEXT,
  "withdrawnAt" DATETIME,
  "derivativeStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "recoveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "backupArtifactSha256" TEXT,
  "backupKeyVersion" TEXT,
  "backupVerifiedAt" DATETIME,
  "archivedAt" DATETIME,
  "rowVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "EventMediaAsset_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "EventMediaAlbum" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "EventMediaDerivative" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'THUMBNAIL',
  "status" TEXT NOT NULL DEFAULT 'READY',
  "storageKey" TEXT,
  "mediaType" TEXT,
  "extension" TEXT,
  "byteSize" INTEGER,
  "sha256" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "metadataStripped" BOOLEAN NOT NULL DEFAULT true,
  "failureCode" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventMediaDerivative_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EventMediaAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "EventMediaStudentAssociation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assetId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "associatedByUserId" TEXT NOT NULL,
  "associatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventMediaStudentAssociation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EventMediaAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EventMediaStudentAssociation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "MediaPublicationConsent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "guardianId" TEXT,
  "audience" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'GRANTED',
  "purposeScope" TEXT NOT NULL DEFAULT 'EVENT_MEDIA_PUBLICATION',
  "wordingVersion" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "evidenceReference" TEXT NOT NULL,
  "grantedAt" DATETIME NOT NULL,
  "expiresAt" DATETIME,
  "revokedAt" DATETIME,
  "recordedByUserId" TEXT NOT NULL,
  "revokedByUserId" TEXT,
  "revocationReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "MediaPublicationConsent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MediaPublicationConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "EventMediaAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "albumId" TEXT,
  "assetId" TEXT,
  "consentId" TEXT,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "previousState" TEXT,
  "newState" TEXT,
  "reason" TEXT,
  "safeMetadataJson" TEXT,
  "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventMediaAuditEvent_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "EventMediaAlbum" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EventMediaAuditEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EventMediaAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EventMediaAuditEvent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "MediaPublicationConsent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EventMediaAlbum_publicKey_key" ON "EventMediaAlbum"("publicKey");
CREATE INDEX "EventMediaAlbum_status_eventDate_idx" ON "EventMediaAlbum"("status", "eventDate");
CREATE INDEX "EventMediaAlbum_visibility_publicationState_idx" ON "EventMediaAlbum"("visibility", "publicationState");
CREATE INDEX "EventMediaAlbum_retentionReviewAt_archivedAt_idx" ON "EventMediaAlbum"("retentionReviewAt", "archivedAt");
CREATE INDEX "EventMediaAlbum_createdByUserId_createdAt_idx" ON "EventMediaAlbum"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX "EventMediaAsset_publicKey_key" ON "EventMediaAsset"("publicKey");
CREATE UNIQUE INDEX "EventMediaAsset_originalStorageKey_key" ON "EventMediaAsset"("originalStorageKey");
CREATE INDEX "EventMediaAsset_albumId_createdAt_idx" ON "EventMediaAsset"("albumId", "createdAt");
CREATE INDEX "EventMediaAsset_albumId_reviewStatus_publicationStatus_idx" ON "EventMediaAsset"("albumId", "reviewStatus", "publicationStatus");
CREATE INDEX "EventMediaAsset_publicationStatus_withdrawalState_idx" ON "EventMediaAsset"("publicationStatus", "withdrawalState");
CREATE INDEX "EventMediaAsset_uploadActorUserId_uploadedAt_idx" ON "EventMediaAsset"("uploadActorUserId", "uploadedAt");
CREATE UNIQUE INDEX "EventMediaDerivative_publicKey_key" ON "EventMediaDerivative"("publicKey");
CREATE UNIQUE INDEX "EventMediaDerivative_storageKey_key" ON "EventMediaDerivative"("storageKey");
CREATE UNIQUE INDEX "EventMediaDerivative_assetId_kind_key" ON "EventMediaDerivative"("assetId", "kind");
CREATE INDEX "EventMediaDerivative_assetId_status_idx" ON "EventMediaDerivative"("assetId", "status");
CREATE UNIQUE INDEX "EventMediaStudentAssociation_assetId_studentId_key" ON "EventMediaStudentAssociation"("assetId", "studentId");
CREATE INDEX "EventMediaStudentAssociation_studentId_assetId_idx" ON "EventMediaStudentAssociation"("studentId", "assetId");
CREATE UNIQUE INDEX "MediaPublicationConsent_publicKey_key" ON "MediaPublicationConsent"("publicKey");
CREATE INDEX "MediaPublicationConsent_studentId_audience_status_grantedAt_idx" ON "MediaPublicationConsent"("studentId", "audience", "status", "grantedAt");
CREATE INDEX "MediaPublicationConsent_guardianId_grantedAt_idx" ON "MediaPublicationConsent"("guardianId", "grantedAt");
CREATE INDEX "MediaPublicationConsent_expiresAt_status_idx" ON "MediaPublicationConsent"("expiresAt", "status");
CREATE UNIQUE INDEX "EventMediaAuditEvent_publicKey_key" ON "EventMediaAuditEvent"("publicKey");
CREATE INDEX "EventMediaAuditEvent_albumId_eventDate_idx" ON "EventMediaAuditEvent"("albumId", "eventDate");
CREATE INDEX "EventMediaAuditEvent_assetId_eventDate_idx" ON "EventMediaAuditEvent"("assetId", "eventDate");
CREATE INDEX "EventMediaAuditEvent_consentId_eventDate_idx" ON "EventMediaAuditEvent"("consentId", "eventDate");
CREATE INDEX "EventMediaAuditEvent_eventType_eventDate_idx" ON "EventMediaAuditEvent"("eventType", "eventDate");

CREATE TRIGGER "EventMediaAsset_original_immutable"
BEFORE UPDATE OF "originalStorageKey", "originalMediaType", "originalExtension", "originalByteSize", "originalSha256", "originalWidth", "originalHeight", "uploadActorUserId", "uploadedAt" ON "EventMediaAsset"
BEGIN
  SELECT RAISE(ABORT, 'Event Media original evidence is immutable');
END;

CREATE TRIGGER "EventMediaAlbum_no_delete" BEFORE DELETE ON "EventMediaAlbum"
BEGIN SELECT RAISE(ABORT, 'Event Media albums use governed archival'); END;

CREATE TRIGGER "EventMediaAsset_no_delete" BEFORE DELETE ON "EventMediaAsset"
BEGIN SELECT RAISE(ABORT, 'Event Media assets use governed archival'); END;

CREATE TRIGGER "EventMediaDerivative_no_delete" BEFORE DELETE ON "EventMediaDerivative"
BEGIN SELECT RAISE(ABORT, 'Event Media derivatives retain recovery history'); END;

CREATE TRIGGER "MediaPublicationConsent_no_delete" BEFORE DELETE ON "MediaPublicationConsent"
BEGIN SELECT RAISE(ABORT, 'Media-publication consent history is immutable'); END;

CREATE TRIGGER "EventMediaAuditEvent_no_update" BEFORE UPDATE ON "EventMediaAuditEvent"
BEGIN SELECT RAISE(ABORT, 'Event Media audit history is append-only'); END;

CREATE TRIGGER "EventMediaAuditEvent_no_delete" BEFORE DELETE ON "EventMediaAuditEvent"
BEGIN SELECT RAISE(ABORT, 'Event Media audit history is append-only'); END;
