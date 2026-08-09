-- CreateTable
CREATE TABLE "SupportQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "queueCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "allowedAssigneeRolesJson" TEXT NOT NULL DEFAULT '[]',
    "confidentialityJson" TEXT NOT NULL DEFAULT '["STANDARD"]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupportCategoryPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "queueId" TEXT NOT NULL,
    "permittedAssigneeRolesJson" TEXT NOT NULL DEFAULT '[]',
    "defaultPriority" TEXT NOT NULL DEFAULT 'NORMAL',
    "defaultConfidentiality" TEXT NOT NULL DEFAULT 'STANDARD',
    "acknowledgmentTargetMinutes" INTEGER NOT NULL DEFAULT 480,
    "firstResponseTargetMinutes" INTEGER NOT NULL DEFAULT 1440,
    "resolutionTargetMinutes" INTEGER NOT NULL DEFAULT 4320,
    "escalationTargetMinutes" INTEGER NOT NULL DEFAULT 1440,
    "workingHoursPolicyJson" TEXT NOT NULL DEFAULT '{"basis":"ELAPSED"}',
    "attachmentsAllowed" BOOLEAN NOT NULL DEFAULT true,
    "linkedChildRequired" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" DATETIME,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportCategoryPolicy_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "submissionKey" TEXT,
    "source" TEXT NOT NULL,
    "requesterUserId" TEXT,
    "requesterRole" TEXT,
    "requesterStaffMemberId" TEXT,
    "requesterGuardianId" TEXT,
    "requesterName" TEXT NOT NULL,
    "requesterType" TEXT NOT NULL,
    "requesterIdentifier" TEXT,
    "requesterContactChannel" TEXT,
    "requesterContactValue" TEXT,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "recordedByUserId" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedPaperReference" TEXT,
    "categoryPolicyId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "confidentiality" TEXT NOT NULL DEFAULT 'STANDARD',
    "subject" TEXT NOT NULL,
    "originalStatement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "acknowledgedAt" DATETIME,
    "firstResponseAt" DATETIME,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    "reopenedCount" INTEGER NOT NULL DEFAULT 0,
    "complainedAboutUserId" TEXT,
    "linkedReceiptReference" TEXT,
    "linkedCorrectiveActionType" TEXT,
    "linkedCorrectiveActionReference" TEXT,
    "privacyNoticeVersion" TEXT NOT NULL,
    "consentRecordedAt" DATETIME,
    "duplicateFingerprint" TEXT,
    "retentionReviewAt" DATETIME NOT NULL,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportRequest_categoryPolicyId_fkey" FOREIGN KEY ("categoryPolicyId") REFERENCES "SupportCategoryPolicy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportRequest_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportRequestParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "participantType" TEXT NOT NULL,
    "userId" TEXT,
    "guardianId" TEXT,
    "staffMemberId" TEXT,
    "displayLabel" TEXT NOT NULL,
    "visibilityScope" TEXT NOT NULL DEFAULT 'REQUESTER_VISIBLE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "addedByUserId" TEXT,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportRequestParticipant_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportRequestLinkedChild" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "admissionReferenceMasked" TEXT NOT NULL,
    "childDisplaySnapshot" TEXT NOT NULL,
    "classSnapshot" TEXT,
    "guardianLinkVerified" BOOLEAN NOT NULL DEFAULT false,
    "guardianLinkVerifiedAt" DATETIME,
    "guardianLinkVerifiedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportRequestLinkedChild_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportRequestEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "entityVersion" INTEGER NOT NULL,
    "reason" TEXT,
    "safeMetadataJson" TEXT,
    "idempotencyKey" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportRequestMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorRole" TEXT,
    "authorLabel" TEXT NOT NULL,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "correctsMessageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportRequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportRequestMessage_correctsMessageId_fkey" FOREIGN KEY ("correctsMessageId") REFERENCES "SupportRequestMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportRequestAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "messageId" TEXT,
    "storageKey" TEXT NOT NULL,
    "safeDisplayName" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "pageCount" INTEGER,
    "visibility" TEXT NOT NULL DEFAULT 'REQUESTER_VISIBLE',
    "intakeScope" TEXT NOT NULL,
    "recoveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "backupArtifactSha256" TEXT,
    "backupKeyVersion" TEXT,
    "backupVerifiedAt" DATETIME,
    "retentionReviewAt" DATETIME NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportRequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportRequestAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportRequestMessage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "assigneeUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activeKey" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAssignment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportAssignment_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportEscalation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "escalationLevel" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "fromQueueId" TEXT,
    "toQueueId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "idempotencyKey" TEXT NOT NULL,
    "escalatedByUserId" TEXT,
    "escalatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportEscalation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportSlaSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "categoryPolicyId" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "acknowledgmentTargetAt" DATETIME NOT NULL,
    "firstResponseTargetAt" DATETIME NOT NULL,
    "resolutionTargetAt" DATETIME NOT NULL,
    "escalationTargetAt" DATETIME NOT NULL,
    "workingHoursPolicyJson" TEXT NOT NULL,
    "pausedAt" DATETIME,
    "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "pauseState" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportSlaSnapshot_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportSlaSnapshot_categoryPolicyId_fkey" FOREIGN KEY ("categoryPolicyId") REFERENCES "SupportCategoryPolicy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportResolution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "resolutionVersion" INTEGER NOT NULL,
    "resolutionCategory" TEXT NOT NULL,
    "requesterVisibleSummary" TEXT NOT NULL,
    "internalActionSummary" TEXT NOT NULL,
    "linkedActionType" TEXT,
    "linkedActionReference" TEXT,
    "resolvedByUserId" TEXT NOT NULL,
    "resolvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportResolution_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportSatisfactionResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "issueUnderstood" BOOLEAN,
    "responseClear" BOOLEAN,
    "issueResolved" BOOLEAN,
    "rating" INTEGER,
    "comment" TEXT,
    "declined" BOOLEAN NOT NULL DEFAULT false,
    "submittedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportSatisfactionResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportSatisfactionResponse_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "SupportResolution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupportAccessEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT,
    "actorUserId" TEXT,
    "sourceHash" TEXT,
    "identifierHash" TEXT,
    "eventType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "safeMetadataJson" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAccessEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportQueue_publicKey_key" ON "SupportQueue"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportQueue_queueCode_key" ON "SupportQueue"("queueCode");

-- CreateIndex
CREATE INDEX "SupportQueue_status_queueCode_idx" ON "SupportQueue"("status", "queueCode");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCategoryPolicy_publicKey_key" ON "SupportCategoryPolicy"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCategoryPolicy_categoryCode_key" ON "SupportCategoryPolicy"("categoryCode");

-- CreateIndex
CREATE INDEX "SupportCategoryPolicy_queueId_status_idx" ON "SupportCategoryPolicy"("queueId", "status");

-- CreateIndex
CREATE INDEX "SupportCategoryPolicy_effectiveFrom_effectiveTo_idx" ON "SupportCategoryPolicy"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequest_publicKey_key" ON "SupportRequest"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequest_reference_key" ON "SupportRequest"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequest_submissionKey_key" ON "SupportRequest"("submissionKey");

-- CreateIndex
CREATE INDEX "SupportRequest_requesterUserId_createdAt_idx" ON "SupportRequest"("requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_requesterGuardianId_createdAt_idx" ON "SupportRequest"("requesterGuardianId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_requesterStaffMemberId_createdAt_idx" ON "SupportRequest"("requesterStaffMemberId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequest_queueId_status_priority_idx" ON "SupportRequest"("queueId", "status", "priority");

-- CreateIndex
CREATE INDEX "SupportRequest_confidentiality_status_idx" ON "SupportRequest"("confidentiality", "status");

-- CreateIndex
CREATE INDEX "SupportRequest_retentionReviewAt_archivedAt_idx" ON "SupportRequest"("retentionReviewAt", "archivedAt");

-- CreateIndex
CREATE INDEX "SupportRequest_duplicateFingerprint_createdAt_idx" ON "SupportRequest"("duplicateFingerprint", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequestParticipant_requestId_status_idx" ON "SupportRequestParticipant"("requestId", "status");

-- CreateIndex
CREATE INDEX "SupportRequestParticipant_userId_status_idx" ON "SupportRequestParticipant"("userId", "status");

-- CreateIndex
CREATE INDEX "SupportRequestLinkedChild_studentId_requestId_idx" ON "SupportRequestLinkedChild"("studentId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequestLinkedChild_requestId_studentId_key" ON "SupportRequestLinkedChild"("requestId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequestEvent_publicKey_key" ON "SupportRequestEvent"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequestEvent_idempotencyKey_key" ON "SupportRequestEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SupportRequestEvent_requestId_occurredAt_idx" ON "SupportRequestEvent"("requestId", "occurredAt");

-- CreateIndex
CREATE INDEX "SupportRequestEvent_eventType_occurredAt_idx" ON "SupportRequestEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequestMessage_publicKey_key" ON "SupportRequestMessage"("publicKey");

-- CreateIndex
CREATE INDEX "SupportRequestMessage_requestId_messageType_createdAt_idx" ON "SupportRequestMessage"("requestId", "messageType", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequestMessage_correctsMessageId_idx" ON "SupportRequestMessage"("correctsMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequestAttachment_publicKey_key" ON "SupportRequestAttachment"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportRequestAttachment_storageKey_key" ON "SupportRequestAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "SupportRequestAttachment_requestId_visibility_createdAt_idx" ON "SupportRequestAttachment"("requestId", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "SupportRequestAttachment_messageId_idx" ON "SupportRequestAttachment"("messageId");

-- CreateIndex
CREATE INDEX "SupportRequestAttachment_sha256_idx" ON "SupportRequestAttachment"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "SupportAssignment_publicKey_key" ON "SupportAssignment"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportAssignment_activeKey_key" ON "SupportAssignment"("activeKey");

-- CreateIndex
CREATE INDEX "SupportAssignment_requestId_assignedAt_idx" ON "SupportAssignment"("requestId", "assignedAt");

-- CreateIndex
CREATE INDEX "SupportAssignment_assigneeUserId_status_idx" ON "SupportAssignment"("assigneeUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupportEscalation_publicKey_key" ON "SupportEscalation"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportEscalation_idempotencyKey_key" ON "SupportEscalation"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SupportEscalation_requestId_status_escalatedAt_idx" ON "SupportEscalation"("requestId", "status", "escalatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportSlaSnapshot_publicKey_key" ON "SupportSlaSnapshot"("publicKey");

-- CreateIndex
CREATE INDEX "SupportSlaSnapshot_requestId_createdAt_idx" ON "SupportSlaSnapshot"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportSlaSnapshot_acknowledgmentTargetAt_idx" ON "SupportSlaSnapshot"("acknowledgmentTargetAt");

-- CreateIndex
CREATE INDEX "SupportSlaSnapshot_firstResponseTargetAt_idx" ON "SupportSlaSnapshot"("firstResponseTargetAt");

-- CreateIndex
CREATE INDEX "SupportSlaSnapshot_resolutionTargetAt_idx" ON "SupportSlaSnapshot"("resolutionTargetAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportResolution_publicKey_key" ON "SupportResolution"("publicKey");

-- CreateIndex
CREATE INDEX "SupportResolution_requestId_resolvedAt_idx" ON "SupportResolution"("requestId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportResolution_requestId_resolutionVersion_key" ON "SupportResolution"("requestId", "resolutionVersion");

-- CreateIndex
CREATE UNIQUE INDEX "SupportSatisfactionResponse_publicKey_key" ON "SupportSatisfactionResponse"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SupportSatisfactionResponse_resolutionId_key" ON "SupportSatisfactionResponse"("resolutionId");

-- CreateIndex
CREATE INDEX "SupportSatisfactionResponse_requestId_createdAt_idx" ON "SupportSatisfactionResponse"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportAccessEvent_publicKey_key" ON "SupportAccessEvent"("publicKey");

-- CreateIndex
CREATE INDEX "SupportAccessEvent_requestId_occurredAt_idx" ON "SupportAccessEvent"("requestId", "occurredAt");

-- CreateIndex
CREATE INDEX "SupportAccessEvent_actorUserId_occurredAt_idx" ON "SupportAccessEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "SupportAccessEvent_sourceHash_occurredAt_idx" ON "SupportAccessEvent"("sourceHash", "occurredAt");

-- CreateIndex
CREATE INDEX "SupportAccessEvent_identifierHash_occurredAt_idx" ON "SupportAccessEvent"("identifierHash", "occurredAt");

-- Versioned school-policy defaults. These are operational targets, never legal deadlines.
INSERT INTO "SupportQueue" ("id","publicKey","queueCode","name","description","allowedAssigneeRolesJson","confidentialityJson","updatedAt") VALUES
('supportq-technical','10000000-0000-4000-8000-000000000001','TECHNICAL_SUPPORT','Technical Support','Login, account-access and application support.','["SUPER_ADMIN","DIRECTOR","COMPUTER_OPERATOR"]','["STANDARD","RESTRICTED"]',CURRENT_TIMESTAMP),
('supportq-academic','10000000-0000-4000-8000-000000000002','ACADEMIC_SUPPORT','Academic Support','Attendance, classwork, examination and academic-service requests.','["SUPER_ADMIN","DIRECTOR","PRINCIPAL"]','["STANDARD","RESTRICTED"]',CURRENT_TIMESTAMP),
('supportq-finance','10000000-0000-4000-8000-000000000003','FINANCE_SUPPORT','Finance Support','Fee and receipt support without direct financial mutation.','["SUPER_ADMIN","DIRECTOR","ACCOUNTANT"]','["STANDARD","RESTRICTED"]',CURRENT_TIMESTAMP),
('supportq-admissions','10000000-0000-4000-8000-000000000004','ADMISSIONS_SUPPORT','Admissions Support','Applicant and admissions-service support.','["SUPER_ADMIN","DIRECTOR","PRINCIPAL","ADMIN","COMPUTER_OPERATOR"]','["STANDARD","RESTRICTED"]',CURRENT_TIMESTAMP),
('supportq-staffhr','10000000-0000-4000-8000-000000000005','STAFF_HR_SUPPORT','Staff and HR Support','Private Staff service and HR requests; payslips stay in the dedicated module.','["SUPER_ADMIN","DIRECTOR"]','["RESTRICTED","LEADERSHIP_ONLY"]',CURRENT_TIMESTAMP),
('supportq-general','10000000-0000-4000-8000-000000000006','GENERAL_ADMIN','General Administration','Facilities, service feedback, suggestions and general administration.','["SUPER_ADMIN","DIRECTOR","PRINCIPAL","ADMIN"]','["STANDARD","RESTRICTED"]',CURRENT_TIMESTAMP),
('supportq-safety','10000000-0000-4000-8000-000000000007','SAFETY_RESTRICTED','Safety Restricted','Safeguarding and bullying concerns for the explicit restricted group.','["SUPER_ADMIN","DIRECTOR","PRINCIPAL"]','["SAFEGUARDING"]',CURRENT_TIMESTAMP),
('supportq-leadership','10000000-0000-4000-8000-000000000008','LEADERSHIP_REVIEW','Leadership Review','Leadership-only complaints, privacy matters and escalations.','["SUPER_ADMIN","DIRECTOR"]','["RESTRICTED","LEADERSHIP_ONLY"]',CURRENT_TIMESTAMP);

INSERT INTO "SupportCategoryPolicy" ("id","publicKey","categoryCode","label","queueId","permittedAssigneeRolesJson","defaultPriority","defaultConfidentiality","acknowledgmentTargetMinutes","firstResponseTargetMinutes","resolutionTargetMinutes","escalationTargetMinutes","workingHoursPolicyJson","attachmentsAllowed","linkedChildRequired","updatedAt") VALUES
('supportcat-tech-login','20000000-0000-4000-8000-000000000001','TECHNICAL_LOGIN','Technical or login support','supportq-technical','["SUPER_ADMIN","DIRECTOR","COMPUTER_OPERATOR"]','NORMAL','STANDARD',480,1440,4320,1440,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP),
('supportcat-account','20000000-0000-4000-8000-000000000002','ACCOUNT_ACCESS','Account access','supportq-technical','["SUPER_ADMIN","DIRECTOR","COMPUTER_OPERATOR"]','HIGH','RESTRICTED',240,720,2880,720,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP),
('supportcat-fee','20000000-0000-4000-8000-000000000003','FEE_OR_RECEIPT','Fee or receipt support','supportq-finance','["SUPER_ADMIN","DIRECTOR","ACCOUNTANT"]','NORMAL','STANDARD',480,1440,4320,1440,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,true,CURRENT_TIMESTAMP),
('supportcat-attendance','20000000-0000-4000-8000-000000000004','ATTENDANCE','Attendance support','supportq-academic','["SUPER_ADMIN","DIRECTOR","PRINCIPAL"]','NORMAL','STANDARD',480,1440,4320,1440,'{"basis":"ACADEMIC_CALENDAR","timezone":"Asia/Kolkata"}',true,true,CURRENT_TIMESTAMP),
('supportcat-classwork','20000000-0000-4000-8000-000000000005','HOMEWORK_OR_CLASSWORK','Homework or classwork support','supportq-academic','["SUPER_ADMIN","DIRECTOR","PRINCIPAL"]','NORMAL','STANDARD',480,1440,4320,1440,'{"basis":"ACADEMIC_CALENDAR","timezone":"Asia/Kolkata"}',true,true,CURRENT_TIMESTAMP),
('supportcat-exam','20000000-0000-4000-8000-000000000006','EXAM_OR_REPORT_CARD','Exam or report-card support','supportq-academic','["SUPER_ADMIN","DIRECTOR","PRINCIPAL"]','HIGH','RESTRICTED',480,1440,4320,1440,'{"basis":"ACADEMIC_CALENDAR","timezone":"Asia/Kolkata"}',true,true,CURRENT_TIMESTAMP),
('supportcat-academic','20000000-0000-4000-8000-000000000007','ACADEMIC_SUPPORT','Academic support','supportq-academic','["SUPER_ADMIN","DIRECTOR","PRINCIPAL"]','NORMAL','STANDARD',480,1440,4320,1440,'{"basis":"ACADEMIC_CALENDAR","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP),
('supportcat-admission','20000000-0000-4000-8000-000000000008','ADMISSION','Admission support','supportq-admissions','["SUPER_ADMIN","DIRECTOR","PRINCIPAL","ADMIN","COMPUTER_OPERATOR"]','NORMAL','STANDARD',480,1440,4320,1440,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP),
('supportcat-correction','20000000-0000-4000-8000-000000000009','DATA_CORRECTION','Data-correction request','supportq-general','["SUPER_ADMIN","DIRECTOR","PRINCIPAL","ADMIN"]','HIGH','RESTRICTED',480,1440,4320,1440,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,true,CURRENT_TIMESTAMP),
('supportcat-facilities','20000000-0000-4000-8000-000000000010','FACILITIES','Facilities','supportq-general','["SUPER_ADMIN","DIRECTOR","PRINCIPAL","ADMIN"]','NORMAL','STANDARD',480,1440,4320,1440,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP),
('supportcat-staffhr','20000000-0000-4000-8000-000000000011','STAFF_HR','Staff or HR support','supportq-staffhr','["SUPER_ADMIN","DIRECTOR"]','HIGH','RESTRICTED',480,1440,4320,1440,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP),
('supportcat-safety','20000000-0000-4000-8000-000000000012','SAFETY_OR_BULLYING','Safety or bullying concern','supportq-safety','["SUPER_ADMIN","DIRECTOR","PRINCIPAL"]','URGENT','SAFEGUARDING',60,120,1440,60,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,true,CURRENT_TIMESTAMP),
('supportcat-staff-complaint','20000000-0000-4000-8000-000000000013','COMPLAINT_AGAINST_STAFF','Complaint about a Staff member','supportq-leadership','["SUPER_ADMIN","DIRECTOR"]','HIGH','LEADERSHIP_ONLY',240,720,4320,720,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP),
('supportcat-service-complaint','20000000-0000-4000-8000-000000000014','COMPLAINT_AGAINST_SERVICE','Complaint about a service','supportq-general','["SUPER_ADMIN","DIRECTOR","PRINCIPAL","ADMIN"]','HIGH','RESTRICTED',480,1440,4320,1440,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP),
('supportcat-privacy','20000000-0000-4000-8000-000000000015','PRIVACY_OR_DATA','Privacy or data concern','supportq-leadership','["SUPER_ADMIN","DIRECTOR"]','HIGH','LEADERSHIP_ONLY',240,720,2880,720,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP),
('supportcat-suggestion','20000000-0000-4000-8000-000000000016','SUGGESTION','Suggestion','supportq-general','["SUPER_ADMIN","DIRECTOR","PRINCIPAL","ADMIN"]','LOW','STANDARD',1440,2880,10080,2880,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP),
('supportcat-appreciation','20000000-0000-4000-8000-000000000017','APPRECIATION','Appreciation','supportq-general','["SUPER_ADMIN","DIRECTOR","PRINCIPAL","ADMIN"]','LOW','STANDARD',1440,2880,10080,2880,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',false,false,CURRENT_TIMESTAMP),
('supportcat-other','20000000-0000-4000-8000-000000000018','OTHER','Other support request','supportq-general','["SUPER_ADMIN","DIRECTOR","PRINCIPAL","ADMIN"]','NORMAL','STANDARD',480,1440,4320,1440,'{"basis":"ELAPSED","timezone":"Asia/Kolkata"}',true,false,CURRENT_TIMESTAMP);
