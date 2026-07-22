CREATE TABLE "CertificateNumberSeries" (
  "id" TEXT NOT NULL PRIMARY KEY, "seriesCode" TEXT NOT NULL, "certificateType" TEXT NOT NULL,
  "academicYear" TEXT, "prefix" TEXT NOT NULL, "nextNumber" INTEGER NOT NULL DEFAULT 1,
  "paddingLength" INTEGER NOT NULL DEFAULT 4, "suffix" TEXT, "resetPolicy" TEXT NOT NULL DEFAULT 'NEVER',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE', "isDefault" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CertificateNumberSeries_seriesCode_key" ON "CertificateNumberSeries"("seriesCode");
CREATE INDEX "CertificateNumberSeries_certificateType_academicYear_status_idx" ON "CertificateNumberSeries"("certificateType","academicYear","status");

CREATE TABLE "CertificateTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY, "templateCode" TEXT NOT NULL, "certificateType" TEXT NOT NULL,
  "name" TEXT NOT NULL, "academicYear" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "versionNumber" INTEGER NOT NULL DEFAULT 1, "templateDefinitionJson" TEXT NOT NULL,
  "printSettingsJson" TEXT, "createdByUserId" TEXT, "activatedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "CertificateTemplate_templateCode_key" ON "CertificateTemplate"("templateCode");
CREATE INDEX "CertificateTemplate_certificateType_academicYear_status_idx" ON "CertificateTemplate"("certificateType","academicYear","status");

CREATE TABLE "StudentCertificateRequest" (
  "id" TEXT NOT NULL PRIMARY KEY, "requestNumber" TEXT NOT NULL, "studentId" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL, "certificateType" TEXT NOT NULL, "requestSource" TEXT NOT NULL DEFAULT 'INTERNAL',
  "purpose" TEXT NOT NULL, "requestedCopies" INTEGER NOT NULL DEFAULT 1, "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "applicantGuardianId" TEXT, "internalNotes" TEXT,
  "publicNotes" TEXT, "reviewNotes" TEXT, "rejectionReason" TEXT, "cancellationReason" TEXT,
  "createdByUserId" TEXT, "reviewedByUserId" TEXT, "approvedByUserId" TEXT, "rejectedByUserId" TEXT,
  "cancelledByUserId" TEXT, "submittedAt" DATETIME, "reviewedAt" DATETIME, "approvedAt" DATETIME,
  "rejectedAt" DATETIME, "cancelledAt" DATETIME, "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "StudentCertificateRequest_requestNumber_key" ON "StudentCertificateRequest"("requestNumber");
CREATE INDEX "StudentCertificateRequest_studentId_createdAt_idx" ON "StudentCertificateRequest"("studentId","createdAt");
CREATE INDEX "StudentCertificateRequest_academicYear_certificateType_status_idx" ON "StudentCertificateRequest"("academicYear","certificateType","status");
CREATE INDEX "StudentCertificateRequest_applicantGuardianId_createdAt_idx" ON "StudentCertificateRequest"("applicantGuardianId","createdAt");

CREATE TABLE "StudentCertificate" (
  "id" TEXT NOT NULL PRIMARY KEY, "requestId" TEXT, "studentId" TEXT NOT NULL, "academicYear" TEXT NOT NULL,
  "certificateType" TEXT NOT NULL, "templateId" TEXT NOT NULL, "certificateNumber" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
  "draftDataJson" TEXT NOT NULL, "issuePurpose" TEXT NOT NULL, "internalNotes" TEXT, "publicNotes" TEXT,
  "cancellationReason" TEXT, "createdByUserId" TEXT, "submittedByUserId" TEXT, "approvedByUserId" TEXT,
  "issuedByUserId" TEXT, "cancelledByUserId" TEXT, "submittedAt" DATETIME, "approvedAt" DATETIME,
  "issuedAt" DATETIME, "cancelledAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "StudentCertificate_certificateNumber_key" ON "StudentCertificate"("certificateNumber");
CREATE INDEX "StudentCertificate_studentId_createdAt_idx" ON "StudentCertificate"("studentId","createdAt");
CREATE INDEX "StudentCertificate_requestId_idx" ON "StudentCertificate"("requestId");
CREATE INDEX "StudentCertificate_academicYear_certificateType_status_idx" ON "StudentCertificate"("academicYear","certificateType","status");
CREATE INDEX "StudentCertificate_templateId_idx" ON "StudentCertificate"("templateId");

CREATE TABLE "StudentCertificateVersion" (
  "id" TEXT NOT NULL PRIMARY KEY, "certificateId" TEXT NOT NULL, "versionNumber" INTEGER NOT NULL,
  "versionType" TEXT NOT NULL, "certificateNumber" TEXT NOT NULL, "snapshotJson" TEXT NOT NULL,
  "correctionReason" TEXT, "reissueReason" TEXT, "issuedAt" DATETIME NOT NULL, "issuedByUserId" TEXT,
  "supersedesVersionId" TEXT, "snapshotHash" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StudentCertificateVersion_certificateId_versionNumber_key" ON "StudentCertificateVersion"("certificateId","versionNumber");
CREATE INDEX "StudentCertificateVersion_certificateNumber_idx" ON "StudentCertificateVersion"("certificateNumber");
CREATE INDEX "StudentCertificateVersion_supersedesVersionId_idx" ON "StudentCertificateVersion"("supersedesVersionId");

CREATE TABLE "StudentCertificateEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "requestId" TEXT, "certificateId" TEXT, "versionId" TEXT,
  "eventType" TEXT NOT NULL, "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousStatus" TEXT, "newStatus" TEXT, "reason" TEXT, "notes" TEXT, "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "StudentCertificateEvent_requestId_eventDate_idx" ON "StudentCertificateEvent"("requestId","eventDate");
CREATE INDEX "StudentCertificateEvent_certificateId_eventDate_idx" ON "StudentCertificateEvent"("certificateId","eventDate");
CREATE INDEX "StudentCertificateEvent_versionId_idx" ON "StudentCertificateEvent"("versionId");
