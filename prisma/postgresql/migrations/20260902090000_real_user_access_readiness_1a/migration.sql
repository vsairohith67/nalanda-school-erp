-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "iamPublicKey" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "UserAccessRequest" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "candidateUserId" TEXT,
    "personType" TEXT NOT NULL,
    "staffMemberId" TEXT,
    "guardianId" TEXT,
    "studentId" TEXT,
    "requestedName" TEXT NOT NULL,
    "requestedUsername" TEXT NOT NULL,
    "requestedEmail" TEXT,
    "requestedRolesJson" TEXT NOT NULL,
    "requestedScopesJson" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "identityLinkReviewed" BOOLEAN NOT NULL DEFAULT false,
    "roleApproved" BOOLEAN NOT NULL DEFAULT false,
    "scopeApproved" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "trainingRequirementsJson" TEXT NOT NULL DEFAULT '[]',
    "policyRequirementsJson" TEXT NOT NULL DEFAULT '[]',
    "conflictWarningsJson" TEXT NOT NULL DEFAULT '[]',
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "rejectedByUserId" TEXT,
    "requestedValidUntil" TIMESTAMP(3),
    "reviewDueAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "accessRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'ACCOUNT_ACTIVATION',
    "environment" TEXT NOT NULL,
    "roleSnapshotHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "deliveryKind" TEXT NOT NULL DEFAULT 'LOCAL_TEST_SINK',
    "deliveredAt" TIMESTAMP(3),
    "issuedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserActivationSession" (
    "id" TEXT NOT NULL,
    "accessRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "passwordEstablishedAt" TIMESTAMP(3),
    "primaryFactorSatisfiedAt" TIMESTAMP(3),
    "trainingSatisfiedAt" TIMESTAMP(3),
    "policySatisfiedAt" TIMESTAMP(3),
    "roleConfirmedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaAuthenticator" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "displayName" TEXT NOT NULL,
    "secretEnvelope" TEXT,
    "keyVersion" TEXT,
    "totpAlgorithm" TEXT,
    "totpDigits" INTEGER,
    "totpPeriod" INTEGER,
    "totpLastUsedStep" INTEGER,
    "credentialId" TEXT,
    "credentialPublicKey" BYTEA,
    "credentialCounter" TEXT,
    "credentialDeviceType" TEXT,
    "credentialBackedUp" BOOLEAN,
    "transportsJson" TEXT,
    "rpId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revocationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfaAuthenticator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authenticatorId" TEXT,
    "codeHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaChallenge" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "challengeHash" TEXT,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "roleAssignmentId" TEXT,
    "type" TEXT NOT NULL,
    "action" TEXT,
    "environment" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepUpGrant" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StepUpGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingModuleVersion" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "audienceRolesJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requiredForActivation" BOOLEAN NOT NULL DEFAULT false,
    "expiresAfterDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingModuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTrainingAcknowledgement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleVersionId" TEXT NOT NULL,
    "accessRequestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "acknowledgement" TEXT,
    "waivedAt" TIMESTAMP(3),
    "waiverReason" TEXT,
    "waiverApprovedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTrainingAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPolicyAcknowledgement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessRequestId" TEXT,
    "policyKey" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "acknowledgement" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPolicyAcknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCertification" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessRequestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REVIEW_DUE',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "reviewerUserId" TEXT,
    "decision" TEXT,
    "reason" TEXT,
    "scopeSnapshotJson" TEXT NOT NULL,
    "nextReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaRecoveryRequest" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "factorType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MfaRecoveryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccessRequest_publicKey_key" ON "UserAccessRequest"("publicKey");

-- CreateIndex
CREATE INDEX "UserAccessRequest_status_createdAt_idx" ON "UserAccessRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserAccessRequest_candidateUserId_status_idx" ON "UserAccessRequest"("candidateUserId", "status");

-- CreateIndex
CREATE INDEX "UserAccessRequest_staffMemberId_idx" ON "UserAccessRequest"("staffMemberId");

-- CreateIndex
CREATE INDEX "UserAccessRequest_guardianId_idx" ON "UserAccessRequest"("guardianId");

-- CreateIndex
CREATE INDEX "UserAccessRequest_studentId_idx" ON "UserAccessRequest"("studentId");

-- CreateIndex
CREATE INDEX "UserAccessRequest_reviewDueAt_idx" ON "UserAccessRequest"("reviewDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_publicKey_key" ON "UserInvitation"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_tokenHash_key" ON "UserInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "UserInvitation_accessRequestId_status_idx" ON "UserInvitation"("accessRequestId", "status");

-- CreateIndex
CREATE INDEX "UserInvitation_userId_status_idx" ON "UserInvitation"("userId", "status");

-- CreateIndex
CREATE INDEX "UserInvitation_expiresAt_idx" ON "UserInvitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivationSession_tokenHash_key" ON "UserActivationSession"("tokenHash");

-- CreateIndex
CREATE INDEX "UserActivationSession_userId_expiresAt_idx" ON "UserActivationSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "UserActivationSession_accessRequestId_expiresAt_idx" ON "UserActivationSession"("accessRequestId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MfaAuthenticator_publicKey_key" ON "MfaAuthenticator"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "MfaAuthenticator_credentialId_key" ON "MfaAuthenticator"("credentialId");

-- CreateIndex
CREATE INDEX "MfaAuthenticator_userId_status_type_idx" ON "MfaAuthenticator"("userId", "status", "type");

-- CreateIndex
CREATE INDEX "MfaAuthenticator_rpId_status_idx" ON "MfaAuthenticator"("rpId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MfaRecoveryCode_codeHash_key" ON "MfaRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "MfaRecoveryCode_userId_status_idx" ON "MfaRecoveryCode"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MfaChallenge_tokenHash_key" ON "MfaChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "MfaChallenge_userId_type_expiresAt_idx" ON "MfaChallenge"("userId", "type", "expiresAt");

-- CreateIndex
CREATE INDEX "MfaChallenge_sessionId_type_expiresAt_idx" ON "MfaChallenge"("sessionId", "type", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StepUpGrant_tokenHash_key" ON "StepUpGrant"("tokenHash");

-- CreateIndex
CREATE INDEX "StepUpGrant_userId_sessionId_action_expiresAt_idx" ON "StepUpGrant"("userId", "sessionId", "action", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingModuleVersion_publicKey_key" ON "TrainingModuleVersion"("publicKey");

-- CreateIndex
CREATE INDEX "TrainingModuleVersion_status_requiredForActivation_idx" ON "TrainingModuleVersion"("status", "requiredForActivation");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingModuleVersion_moduleKey_versionNumber_key" ON "TrainingModuleVersion"("moduleKey", "versionNumber");

-- CreateIndex
CREATE INDEX "UserTrainingAcknowledgement_userId_status_expiresAt_idx" ON "UserTrainingAcknowledgement"("userId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserTrainingAcknowledgement_userId_moduleVersionId_key" ON "UserTrainingAcknowledgement"("userId", "moduleVersionId");

-- CreateIndex
CREATE INDEX "UserPolicyAcknowledgement_userId_acceptedAt_idx" ON "UserPolicyAcknowledgement"("userId", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserPolicyAcknowledgement_userId_policyKey_versionNumber_key" ON "UserPolicyAcknowledgement"("userId", "policyKey", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCertification_publicKey_key" ON "AccessCertification"("publicKey");

-- CreateIndex
CREATE INDEX "AccessCertification_status_dueAt_idx" ON "AccessCertification"("status", "dueAt");

-- CreateIndex
CREATE INDEX "AccessCertification_userId_dueAt_idx" ON "AccessCertification"("userId", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "MfaRecoveryRequest_publicKey_key" ON "MfaRecoveryRequest"("publicKey");

-- CreateIndex
CREATE INDEX "MfaRecoveryRequest_userId_status_createdAt_idx" ON "MfaRecoveryRequest"("userId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Student_iamPublicKey_key" ON "Student"("iamPublicKey");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessRequest" ADD CONSTRAINT "UserAccessRequest_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "UserAccessRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivationSession" ADD CONSTRAINT "UserActivationSession_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "UserAccessRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserActivationSession" ADD CONSTRAINT "UserActivationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaAuthenticator" ADD CONSTRAINT "MfaAuthenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaAuthenticator" ADD CONSTRAINT "MfaAuthenticator_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryCode" ADD CONSTRAINT "MfaRecoveryCode_authenticatorId_fkey" FOREIGN KEY ("authenticatorId") REFERENCES "MfaAuthenticator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaChallenge" ADD CONSTRAINT "MfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepUpGrant" ADD CONSTRAINT "StepUpGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingAcknowledgement" ADD CONSTRAINT "UserTrainingAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingAcknowledgement" ADD CONSTRAINT "UserTrainingAcknowledgement_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "TrainingModuleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingAcknowledgement" ADD CONSTRAINT "UserTrainingAcknowledgement_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "UserAccessRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingAcknowledgement" ADD CONSTRAINT "UserTrainingAcknowledgement_waiverApprovedByUserId_fkey" FOREIGN KEY ("waiverApprovedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPolicyAcknowledgement" ADD CONSTRAINT "UserPolicyAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPolicyAcknowledgement" ADD CONSTRAINT "UserPolicyAcknowledgement_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "UserAccessRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCertification" ADD CONSTRAINT "AccessCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCertification" ADD CONSTRAINT "AccessCertification_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "UserAccessRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCertification" ADD CONSTRAINT "AccessCertification_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryRequest" ADD CONSTRAINT "MfaRecoveryRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryRequest" ADD CONSTRAINT "MfaRecoveryRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryRequest" ADD CONSTRAINT "MfaRecoveryRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaRecoveryRequest" ADD CONSTRAINT "MfaRecoveryRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
