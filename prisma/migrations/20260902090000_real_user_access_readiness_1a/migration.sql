-- CreateTable
CREATE TABLE "UserAccessRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "requestedValidUntil" DATETIME,
    "reviewDueAt" DATETIME,
    "decidedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserAccessRequest_candidateUserId_fkey" FOREIGN KEY ("candidateUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserAccessRequest_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAccessRequest_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAccessRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAccessRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAccessRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAccessRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserAccessRequest_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "revocationReason" TEXT,
    "deliveryKind" TEXT NOT NULL DEFAULT 'LOCAL_TEST_SINK',
    "deliveredAt" DATETIME,
    "issuedByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserInvitation_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "UserAccessRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserInvitation_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserActivationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accessRequestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "passwordEstablishedAt" DATETIME,
    "primaryFactorSatisfiedAt" DATETIME,
    "trainingSatisfiedAt" DATETIME,
    "policySatisfiedAt" DATETIME,
    "roleConfirmedAt" DATETIME,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "revocationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserActivationSession_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "UserAccessRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserActivationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MfaAuthenticator" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "credentialPublicKey" BLOB,
    "credentialCounter" TEXT,
    "credentialDeviceType" TEXT,
    "credentialBackedUp" BOOLEAN,
    "transportsJson" TEXT,
    "rpId" TEXT,
    "verifiedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "revokedAt" DATETIME,
    "revokedByUserId" TEXT,
    "revocationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MfaAuthenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MfaAuthenticator_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MfaRecoveryCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "authenticatorId" TEXT,
    "codeHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MfaRecoveryCode_authenticatorId_fkey" FOREIGN KEY ("authenticatorId") REFERENCES "MfaAuthenticator" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MfaChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StepUpGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StepUpGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingModuleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "audienceRolesJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requiredForActivation" BOOLEAN NOT NULL DEFAULT false,
    "expiresAfterDays" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserTrainingAcknowledgement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "moduleVersionId" TEXT NOT NULL,
    "accessRequestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "expiresAt" DATETIME,
    "acknowledgement" TEXT,
    "waivedAt" DATETIME,
    "waiverReason" TEXT,
    "waiverApprovedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserTrainingAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserTrainingAcknowledgement_moduleVersionId_fkey" FOREIGN KEY ("moduleVersionId") REFERENCES "TrainingModuleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserTrainingAcknowledgement_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "UserAccessRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "UserTrainingAcknowledgement_waiverApprovedByUserId_fkey" FOREIGN KEY ("waiverApprovedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPolicyAcknowledgement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accessRequestId" TEXT,
    "policyKey" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "acknowledgement" TEXT NOT NULL,
    "acceptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPolicyAcknowledgement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserPolicyAcknowledgement_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "UserAccessRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccessCertification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessRequestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REVIEW_DUE',
    "dueAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "decidedAt" DATETIME,
    "reviewerUserId" TEXT,
    "decision" TEXT,
    "reason" TEXT,
    "scopeSnapshotJson" TEXT NOT NULL,
    "nextReviewAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AccessCertification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccessCertification_accessRequestId_fkey" FOREIGN KEY ("accessRequestId") REFERENCES "UserAccessRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AccessCertification_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MfaRecoveryRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "factorType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL DEFAULT '[]',
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "decidedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MfaRecoveryRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MfaRecoveryRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MfaRecoveryRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MfaRecoveryRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "iamPublicKey" TEXT,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "admissionNo" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "motherName" TEXT,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "rollNo" TEXT,
    "phone1" TEXT NOT NULL,
    "phone2" TEXT,
    "whatsappNumber" TEXT,
    "address" TEXT,
    "dateOfBirth" DATETIME,
    "aadhaarNo" TEXT,
    "tcStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "studentType" TEXT NOT NULL DEFAULT 'Normal',
    "discountPercent" REAL NOT NULL DEFAULT 0,
    "startMonth" TEXT NOT NULL DEFAULT 'June',
    "remarks" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT,
    CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Student" ("aadhaarNo", "academicYear", "address", "admissionNo", "className", "createdAt", "dateOfBirth", "deletedAt", "discountPercent", "fatherName", "id", "motherName", "phone1", "phone2", "remarks", "rollNo", "section", "startMonth", "status", "studentName", "studentType", "tcStatus", "updatedAt", "whatsappNumber") SELECT "aadhaarNo", "academicYear", "address", "admissionNo", "className", "createdAt", "dateOfBirth", "deletedAt", "discountPercent", "fatherName", "id", "motherName", "phone1", "phone2", "remarks", "rollNo", "section", "startMonth", "status", "studentName", "studentType", "tcStatus", "updatedAt", "whatsappNumber" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_iamPublicKey_key" ON "Student"("iamPublicKey");
CREATE UNIQUE INDEX "Student_admissionNo_key" ON "Student"("admissionNo");
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");
CREATE INDEX "Student_academicYear_idx" ON "Student"("academicYear");
CREATE INDEX "Student_className_section_idx" ON "Student"("className", "section");
CREATE INDEX "Student_status_idx" ON "Student"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

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

-- Governed activation keeps role and profile assignments inert until every
-- activation gate has passed. Widen the existing closed status constraints
-- while preserving every row, key, index, and last-Super-Admin trigger.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
DROP TRIGGER IF EXISTS "iam_prevent_last_super_admin_suspension";
DROP TRIGGER IF EXISTS "iam_prevent_last_super_admin_role_end";
DROP TRIGGER IF EXISTS "iam_prevent_active_super_admin_role_delete";
DROP TRIGGER IF EXISTS "iam_prevent_expiring_super_admin_role_insert";
DROP TRIGGER IF EXISTS "iam_prevent_expiring_super_admin_role_update";
CREATE TABLE "rua_new_UserRoleAssignment" (
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
  CONSTRAINT "UserRoleAssignment_role_check" CHECK ("role" IN ('SUPER_ADMIN','DIRECTOR','PRINCIPAL','ADMIN','ACCOUNTANT','COMPUTER_OPERATOR','GATE_STAFF','TEACHER','PARENT','STUDENT','VIEWER')),
  CONSTRAINT "UserRoleAssignment_status_check" CHECK ("status" IN ('PENDING','ACTIVE','EXPIRED','ENDED','REVOKED')),
  CONSTRAINT "UserRoleAssignment_dates_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  CONSTRAINT "UserRoleAssignment_end_check" CHECK ((("status" = 'PENDING' OR "status" = 'ACTIVE') AND "endedAt" IS NULL) OR (("status" = 'EXPIRED' OR "status" = 'ENDED' OR "status" = 'REVOKED') AND "endedAt" IS NOT NULL))
);
INSERT INTO "rua_new_UserRoleAssignment" ("id","publicKey","userId","role","status","validFrom","validUntil","reason","assignedByUserId","endedByUserId","endedAt","version","contextVersion","activeKey","createdAt","updatedAt") SELECT "id","publicKey","userId","role","status","validFrom","validUntil","reason","assignedByUserId","endedByUserId","endedAt","version","contextVersion","activeKey","createdAt","updatedAt" FROM "UserRoleAssignment";
DROP TABLE "UserRoleAssignment";
ALTER TABLE "rua_new_UserRoleAssignment" RENAME TO "UserRoleAssignment";
CREATE UNIQUE INDEX "UserRoleAssignment_publicKey_key" ON "UserRoleAssignment"("publicKey");
CREATE UNIQUE INDEX "UserRoleAssignment_activeKey_key" ON "UserRoleAssignment"("activeKey");
CREATE INDEX "UserRoleAssignment_userId_status_validFrom_validUntil_idx" ON "UserRoleAssignment"("userId","status","validFrom","validUntil");
CREATE INDEX "UserRoleAssignment_role_status_idx" ON "UserRoleAssignment"("role","status");

CREATE TABLE "rua_new_UserPermissionProfileAssignment" (
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
  CONSTRAINT "UserPermissionProfileAssignment_status_check" CHECK ("status" IN ('PENDING','ACTIVE','EXPIRED','ENDED','REVOKED')),
  CONSTRAINT "UserPermissionProfileAssignment_dates_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  CONSTRAINT "UserPermissionProfileAssignment_end_check" CHECK ((("status" = 'PENDING' OR "status" = 'ACTIVE') AND "endedAt" IS NULL) OR (("status" = 'EXPIRED' OR "status" = 'ENDED' OR "status" = 'REVOKED') AND "endedAt" IS NOT NULL))
);
INSERT INTO "rua_new_UserPermissionProfileAssignment" ("id","publicKey","userId","profileId","status","validFrom","validUntil","reason","assignedByUserId","endedByUserId","endedAt","version","activeKey","createdAt","updatedAt") SELECT "id","publicKey","userId","profileId","status","validFrom","validUntil","reason","assignedByUserId","endedByUserId","endedAt","version","activeKey","createdAt","updatedAt" FROM "UserPermissionProfileAssignment";
DROP TABLE "UserPermissionProfileAssignment";
ALTER TABLE "rua_new_UserPermissionProfileAssignment" RENAME TO "UserPermissionProfileAssignment";
CREATE UNIQUE INDEX "UserPermissionProfileAssignment_publicKey_key" ON "UserPermissionProfileAssignment"("publicKey");
CREATE UNIQUE INDEX "UserPermissionProfileAssignment_activeKey_key" ON "UserPermissionProfileAssignment"("activeKey");
CREATE INDEX "UserPermissionProfileAssignment_userId_status_validFrom_validUntil_idx" ON "UserPermissionProfileAssignment"("userId","status","validFrom","validUntil");
CREATE INDEX "UserPermissionProfileAssignment_profileId_status_idx" ON "UserPermissionProfileAssignment"("profileId","status");

CREATE TRIGGER "iam_prevent_last_super_admin_suspension" BEFORE UPDATE OF "isActive", "lifecycleStatus" ON "User"
WHEN OLD."isActive" = 1 AND OLD."lifecycleStatus" = 'ACTIVE' AND (NEW."isActive" <> 1 OR NEW."lifecycleStatus" <> 'ACTIVE')
  AND EXISTS (SELECT 1 FROM "UserRoleAssignment" assignment WHERE assignment."userId" = OLD."id" AND assignment."role" = 'SUPER_ADMIN' AND assignment."status" = 'ACTIVE')
  AND (SELECT COUNT(*) FROM "UserRoleAssignment" assignment JOIN "User" account ON account."id" = assignment."userId" WHERE assignment."role" = 'SUPER_ADMIN' AND assignment."status" = 'ACTIVE' AND account."isActive" = 1 AND account."lifecycleStatus" = 'ACTIVE') <= 1
BEGIN SELECT RAISE(ABORT, 'LAST_ACTIVE_SUPER_ADMIN_REQUIRED'); END;
CREATE TRIGGER "iam_prevent_last_super_admin_role_end" BEFORE UPDATE OF "role", "status" ON "UserRoleAssignment"
WHEN OLD."role" = 'SUPER_ADMIN' AND OLD."status" = 'ACTIVE' AND (NEW."role" <> 'SUPER_ADMIN' OR NEW."status" <> 'ACTIVE')
  AND EXISTS (SELECT 1 FROM "User" account WHERE account."id" = OLD."userId" AND account."isActive" = 1 AND account."lifecycleStatus" = 'ACTIVE')
  AND (SELECT COUNT(*) FROM "UserRoleAssignment" assignment JOIN "User" account ON account."id" = assignment."userId" WHERE assignment."role" = 'SUPER_ADMIN' AND assignment."status" = 'ACTIVE' AND account."isActive" = 1 AND account."lifecycleStatus" = 'ACTIVE') <= 1
BEGIN SELECT RAISE(ABORT, 'LAST_ACTIVE_SUPER_ADMIN_REQUIRED'); END;
CREATE TRIGGER "iam_prevent_active_super_admin_role_delete" BEFORE DELETE ON "UserRoleAssignment"
WHEN OLD."role" = 'SUPER_ADMIN' AND OLD."status" = 'ACTIVE' AND EXISTS (SELECT 1 FROM "User" account WHERE account."id" = OLD."userId" AND account."isActive" = 1 AND account."lifecycleStatus" = 'ACTIVE')
BEGIN SELECT RAISE(ABORT, 'ACTIVE_SUPER_ADMIN_HISTORY_IS_IMMUTABLE'); END;
CREATE TRIGGER "iam_prevent_expiring_super_admin_role_insert" BEFORE INSERT ON "UserRoleAssignment" WHEN NEW."role" = 'SUPER_ADMIN' AND NEW."validUntil" IS NOT NULL BEGIN SELECT RAISE(ABORT, 'SUPER_ADMIN_ASSIGNMENT_CANNOT_EXPIRE'); END;
CREATE TRIGGER "iam_prevent_expiring_super_admin_role_update" BEFORE UPDATE OF "role", "validUntil" ON "UserRoleAssignment" WHEN NEW."role" = 'SUPER_ADMIN' AND NEW."validUntil" IS NOT NULL BEGIN SELECT RAISE(ABORT, 'SUPER_ADMIN_ASSIGNMENT_CANNOT_EXPIRE'); END;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
