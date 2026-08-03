-- CreateTable
CREATE TABLE "AdmissionCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "cycleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "enabledClassesJson" TEXT NOT NULL DEFAULT '[]',
    "declarationsJson" TEXT NOT NULL DEFAULT '[]',
    "documentTypesJson" TEXT NOT NULL DEFAULT '[]',
    "admissionNumberPrefix" TEXT NOT NULL,
    "nextAdmissionNumber" INTEGER NOT NULL DEFAULT 1,
    "admissionNumberPadding" INTEGER NOT NULL DEFAULT 4,
    "applicationExpiryDays" INTEGER NOT NULL DEFAULT 14,
    "retentionReviewDays" INTEGER NOT NULL DEFAULT 365,
    "version" INTEGER NOT NULL DEFAULT 1,
    "opensAt" DATETIME,
    "closesAt" DATETIME,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdmissionEnquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "enquiryNumber" TEXT NOT NULL,
    "cycleId" TEXT,
    "guardianName" TEXT NOT NULL,
    "contactMethod" TEXT NOT NULL,
    "contactValue" TEXT NOT NULL,
    "contactHash" TEXT NOT NULL,
    "contactVerified" BOOLEAN NOT NULL DEFAULT false,
    "desiredAcademicYear" TEXT NOT NULL,
    "desiredClass" TEXT NOT NULL,
    "childName" TEXT,
    "enquirySource" TEXT NOT NULL,
    "boundedMessage" TEXT,
    "privacyNoticeVersion" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentRecordedAt" DATETIME NOT NULL,
    "intakeChannel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "publicRequestHash" TEXT,
    "nextFollowUpAt" DATETIME,
    "retentionReviewAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdmissionEnquiry_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AdmissionCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnquiryFollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "nextFollowUpAt" DATETIME,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnquiryFollowUp_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "AdmissionEnquiry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "purpose" TEXT NOT NULL,
    "note" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "recordedByUserId" TEXT NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchoolVisit_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "AdmissionEnquiry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLICATION_INVITED',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "invitationVersion" INTEGER NOT NULL DEFAULT 0,
    "invitationTokenHash" TEXT,
    "invitationExpiresAt" DATETIME,
    "invitationUsedAt" DATETIME,
    "invitationAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "invitationAttemptLimit" INTEGER NOT NULL DEFAULT 8,
    "invitationResendCount" INTEGER NOT NULL DEFAULT 0,
    "invitationLastIssuedAt" DATETIME,
    "declarationVersion" TEXT,
    "declarationAcceptedAt" DATETIME,
    "requestedInfo" TEXT,
    "requestedInfoAt" DATETIME,
    "submittedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "retentionReviewAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdmissionApplication_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AdmissionCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AdmissionApplication_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "AdmissionEnquiry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionApplicationVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "snapshotSha256" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionApplicationVersion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicantChild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "desiredAcademicYear" TEXT NOT NULL,
    "desiredClass" TEXT NOT NULL,
    "previousSchool" TEXT,
    "previousClass" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApplicantChild_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProspectiveGuardian" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "relationshipToChild" TEXT NOT NULL,
    "contactMethod" TEXT NOT NULL,
    "contactValue" TEXT NOT NULL,
    "contactHash" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProspectiveGuardian_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "storageKey" TEXT NOT NULL,
    "safeDisplayName" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "recoveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "backupArtifactSha256" TEXT,
    "backupKeyVersion" TEXT,
    "backupVerifiedAt" DATETIME,
    "retentionReviewAt" DATETIME NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewVersion" INTEGER NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'ADMISSIONS_TEAM',
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "completenessJson" TEXT NOT NULL DEFAULT '{}',
    "boundedNote" TEXT,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "decisionVersion" INTEGER NOT NULL,
    "decisionType" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT NOT NULL,
    "decidedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionDecision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "offerVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFERED',
    "offeredClass" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionConversion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "admissionNumber" TEXT NOT NULL,
    "guardianIdsJson" TEXT NOT NULL,
    "guardianLinkIdsJson" TEXT NOT NULL,
    "parentUserId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "convertedAt" DATETIME NOT NULL,
    "lineageHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionConversion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionDuplicateResolution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "candidateType" TEXT NOT NULL,
    "candidatePublicReference" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "resolvedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionDuplicateResolution_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdmissionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT,
    "enquiryId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "entityVersion" INTEGER,
    "safeReason" TEXT,
    "safeMetadataJson" TEXT,
    "requestHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdmissionEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionCycle_publicKey_key" ON "AdmissionCycle"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionCycle_cycleCode_key" ON "AdmissionCycle"("cycleCode");

-- CreateIndex
CREATE INDEX "AdmissionCycle_academicYear_status_idx" ON "AdmissionCycle"("academicYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionEnquiry_publicKey_key" ON "AdmissionEnquiry"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionEnquiry_enquiryNumber_key" ON "AdmissionEnquiry"("enquiryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionEnquiry_publicRequestHash_key" ON "AdmissionEnquiry"("publicRequestHash");

-- CreateIndex
CREATE INDEX "AdmissionEnquiry_status_nextFollowUpAt_idx" ON "AdmissionEnquiry"("status", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "AdmissionEnquiry_desiredAcademicYear_desiredClass_idx" ON "AdmissionEnquiry"("desiredAcademicYear", "desiredClass");

-- CreateIndex
CREATE INDEX "AdmissionEnquiry_contactHash_idx" ON "AdmissionEnquiry"("contactHash");

-- CreateIndex
CREATE INDEX "AdmissionEnquiry_retentionReviewAt_idx" ON "AdmissionEnquiry"("retentionReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "EnquiryFollowUp_publicKey_key" ON "EnquiryFollowUp"("publicKey");

-- CreateIndex
CREATE INDEX "EnquiryFollowUp_enquiryId_occurredAt_idx" ON "EnquiryFollowUp"("enquiryId", "occurredAt");

-- CreateIndex
CREATE INDEX "EnquiryFollowUp_nextFollowUpAt_idx" ON "EnquiryFollowUp"("nextFollowUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolVisit_publicKey_key" ON "SchoolVisit"("publicKey");

-- CreateIndex
CREATE INDEX "SchoolVisit_enquiryId_scheduledAt_idx" ON "SchoolVisit"("enquiryId", "scheduledAt");

-- CreateIndex
CREATE INDEX "SchoolVisit_status_scheduledAt_idx" ON "SchoolVisit"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_publicKey_key" ON "AdmissionApplication"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_applicationNumber_key" ON "AdmissionApplication"("applicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_invitationTokenHash_key" ON "AdmissionApplication"("invitationTokenHash");

-- CreateIndex
CREATE INDEX "AdmissionApplication_cycleId_status_updatedAt_idx" ON "AdmissionApplication"("cycleId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "AdmissionApplication_enquiryId_idx" ON "AdmissionApplication"("enquiryId");

-- CreateIndex
CREATE INDEX "AdmissionApplication_retentionReviewAt_idx" ON "AdmissionApplication"("retentionReviewAt");

-- CreateIndex
CREATE INDEX "AdmissionApplicationVersion_applicationId_createdAt_idx" ON "AdmissionApplicationVersion"("applicationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplicationVersion_applicationId_versionNumber_key" ON "AdmissionApplicationVersion"("applicationId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicantChild_publicKey_key" ON "ApplicantChild"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicantChild_applicationId_key" ON "ApplicantChild"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicantChild_fullName_dateOfBirth_idx" ON "ApplicantChild"("fullName", "dateOfBirth");

-- CreateIndex
CREATE INDEX "ApplicantChild_desiredAcademicYear_desiredClass_idx" ON "ApplicantChild"("desiredAcademicYear", "desiredClass");

-- CreateIndex
CREATE UNIQUE INDEX "ProspectiveGuardian_publicKey_key" ON "ProspectiveGuardian"("publicKey");

-- CreateIndex
CREATE INDEX "ProspectiveGuardian_applicationId_isPrimary_idx" ON "ProspectiveGuardian"("applicationId", "isPrimary");

-- CreateIndex
CREATE INDEX "ProspectiveGuardian_contactHash_idx" ON "ProspectiveGuardian"("contactHash");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDocument_publicKey_key" ON "ApplicationDocument"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDocument_storageKey_key" ON "ApplicationDocument"("storageKey");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_status_idx" ON "ApplicationDocument"("applicationId", "status");

-- CreateIndex
CREATE INDEX "ApplicationDocument_sha256_idx" ON "ApplicationDocument"("sha256");

-- CreateIndex
CREATE INDEX "ApplicationDocument_retentionReviewAt_idx" ON "ApplicationDocument"("retentionReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDocument_applicationId_documentType_version_key" ON "ApplicationDocument"("applicationId", "documentType", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationReview_publicKey_key" ON "ApplicationReview"("publicKey");

-- CreateIndex
CREATE INDEX "ApplicationReview_reviewerUserId_status_idx" ON "ApplicationReview"("reviewerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationReview_applicationId_reviewVersion_key" ON "ApplicationReview"("applicationId", "reviewVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionDecision_publicKey_key" ON "AdmissionDecision"("publicKey");

-- CreateIndex
CREATE INDEX "AdmissionDecision_decisionType_decidedAt_idx" ON "AdmissionDecision"("decisionType", "decidedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionDecision_applicationId_decisionVersion_key" ON "AdmissionDecision"("applicationId", "decisionVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionOffer_publicKey_key" ON "AdmissionOffer"("publicKey");

-- CreateIndex
CREATE INDEX "AdmissionOffer_status_expiresAt_idx" ON "AdmissionOffer"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionOffer_applicationId_offerVersion_key" ON "AdmissionOffer"("applicationId", "offerVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionConversion_publicKey_key" ON "AdmissionConversion"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionConversion_applicationId_key" ON "AdmissionConversion"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionConversion_requestKey_key" ON "AdmissionConversion"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionConversion_studentId_key" ON "AdmissionConversion"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionConversion_enrollmentId_key" ON "AdmissionConversion"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionConversion_admissionNumber_key" ON "AdmissionConversion"("admissionNumber");

-- CreateIndex
CREATE INDEX "AdmissionConversion_convertedAt_idx" ON "AdmissionConversion"("convertedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionDuplicateResolution_publicKey_key" ON "AdmissionDuplicateResolution"("publicKey");

-- CreateIndex
CREATE INDEX "AdmissionDuplicateResolution_applicationId_resolvedAt_idx" ON "AdmissionDuplicateResolution"("applicationId", "resolvedAt");

-- CreateIndex
CREATE INDEX "AdmissionEvent_applicationId_eventDate_idx" ON "AdmissionEvent"("applicationId", "eventDate");

-- CreateIndex
CREATE INDEX "AdmissionEvent_enquiryId_eventDate_idx" ON "AdmissionEvent"("enquiryId", "eventDate");

-- CreateIndex
CREATE INDEX "AdmissionEvent_eventType_eventDate_idx" ON "AdmissionEvent"("eventType", "eventDate");

-- CreateIndex
CREATE INDEX "AdmissionEvent_requestHash_eventDate_idx" ON "AdmissionEvent"("requestHash", "eventDate");

-- Governed admissions history is append-only. Offers may change state (for
-- example, expire) but cannot be deleted; decisions and conversion lineage
-- cannot be rewritten after they are recorded.
CREATE TRIGGER "AdmissionDecision_no_update"
BEFORE UPDATE ON "AdmissionDecision"
BEGIN SELECT RAISE(ABORT, 'Admission decisions are append-only'); END;

CREATE TRIGGER "AdmissionDecision_no_delete"
BEFORE DELETE ON "AdmissionDecision"
BEGIN SELECT RAISE(ABORT, 'Admission decisions cannot be deleted'); END;

CREATE TRIGGER "AdmissionOffer_no_delete"
BEFORE DELETE ON "AdmissionOffer"
BEGIN SELECT RAISE(ABORT, 'Admission offers cannot be deleted'); END;

CREATE TRIGGER "AdmissionConversion_no_update"
BEFORE UPDATE ON "AdmissionConversion"
BEGIN SELECT RAISE(ABORT, 'Admission conversions are immutable'); END;

CREATE TRIGGER "AdmissionConversion_no_delete"
BEFORE DELETE ON "AdmissionConversion"
BEGIN SELECT RAISE(ABORT, 'Admission conversions cannot be deleted'); END;

CREATE TRIGGER "AdmissionApplicationVersion_no_update"
BEFORE UPDATE ON "AdmissionApplicationVersion"
BEGIN SELECT RAISE(ABORT, 'Application versions are append-only'); END;

CREATE TRIGGER "AdmissionApplicationVersion_no_delete"
BEFORE DELETE ON "AdmissionApplicationVersion"
BEGIN SELECT RAISE(ABORT, 'Application versions cannot be deleted'); END;

CREATE TRIGGER "AdmissionDuplicateResolution_no_update"
BEFORE UPDATE ON "AdmissionDuplicateResolution"
BEGIN SELECT RAISE(ABORT, 'Duplicate resolutions are append-only'); END;

CREATE TRIGGER "AdmissionDuplicateResolution_no_delete"
BEFORE DELETE ON "AdmissionDuplicateResolution"
BEGIN SELECT RAISE(ABORT, 'Duplicate resolutions cannot be deleted'); END;

CREATE TRIGGER "AdmissionEvent_no_update"
BEFORE UPDATE ON "AdmissionEvent"
BEGIN SELECT RAISE(ABORT, 'Admission events are append-only'); END;

CREATE TRIGGER "AdmissionEvent_no_delete"
BEFORE DELETE ON "AdmissionEvent"
BEGIN SELECT RAISE(ABORT, 'Admission events cannot be deleted'); END;
