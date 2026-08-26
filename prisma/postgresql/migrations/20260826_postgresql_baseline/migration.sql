-- POSTGRES-READINESS-1A baseline generated from the canonical 330-model schema.
-- Contains no data. SQLite migration history remains separate and unchanged.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
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
    "dateOfBirth" TIMESTAMP(3),
    "aadhaarNo" TEXT,
    "tcStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "studentType" TEXT NOT NULL DEFAULT 'Normal',
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startMonth" TEXT NOT NULL DEFAULT 'June',
    "remarks" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "className" TEXT NOT NULL,
    "termAmount" DOUBLE PRECISION NOT NULL,
    "term1Month" TEXT NOT NULL,
    "term2Month" TEXT NOT NULL,
    "term3Month" TEXT NOT NULL,
    "term4Month" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "amountPaid" DOUBLE PRECISION NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "receivedAccount" TEXT NOT NULL,
    "transactionRefNo" TEXT,
    "feeType" TEXT NOT NULL,
    "termHint" TEXT NOT NULL DEFAULT 'Auto',
    "remarks" TEXT,
    "enteredBy" TEXT NOT NULL DEFAULT 'Director',
    "editedBy" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,
    "cancellationReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "familyCollectionId" TEXT,
    "familyInstrumentId" TEXT,
    "familyAllocationId" TEXT,
    "familyShareId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyCollection" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "receiptReference" TEXT,
    "payerType" TEXT NOT NULL,
    "payerGuardianId" TEXT,
    "payerDisplayName" TEXT NOT NULL,
    "counterpartyReferenceHash" TEXT,
    "counterpartyDisplay" TEXT,
    "collectionDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requestKey" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "allocationPlanHash" TEXT NOT NULL,
    "allocationPolicyVersion" TEXT NOT NULL DEFAULT 'FAMILY_AUTO_V1',
    "totalPaise" INTEGER NOT NULL,
    "creditPaise" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentReceiptVersion" INTEGER NOT NULL DEFAULT 0,
    "auditReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "reversedByUserId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "replacesCollectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyCollectionInstrument" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "receivedAccount" TEXT NOT NULL,
    "referenceMasked" TEXT,
    "referenceKey" TEXT,
    "postingStatus" TEXT NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyCollectionInstrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyStudentAllocation" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "installment" TEXT NOT NULL,
    "feeHead" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "allocationPolicy" TEXT NOT NULL,
    "dueBeforePaise" INTEGER NOT NULL,
    "dueAfterPaise" INTEGER NOT NULL,
    "dueSnapshotHash" TEXT NOT NULL,
    "studentNameSnapshot" TEXT NOT NULL,
    "admissionNoSnapshot" TEXT NOT NULL,
    "classNameSnapshot" TEXT NOT NULL,
    "sectionSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyStudentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllocationInstrumentShare" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllocationInstrumentShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyReceiptVersion" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "publicVersionReference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "supersedesVersionId" TEXT,
    "issuedByUserId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyReceiptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyCollectionEvent" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "collectionVersion" INTEGER NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "reason" TEXT,
    "detailsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyCollectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyProviderAllocationPlan" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "planVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREPARED',
    "amountPaise" INTEGER NOT NULL,
    "planHash" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "providerOrderKeyHash" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyProviderAllocationPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptNote" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Cancelled',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "iamPublicKey" TEXT,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL DEFAULT 1,
    "authorizationVersion" INTEGER NOT NULL DEFAULT 1,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "temporaryPasswordExpiresAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "guardianId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYearEnrollment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "rollNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrollmentDate" TIMESTAMP(3),
    "exitDate" TIMESTAMP(3),
    "exitReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicYearEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProgressionDecision" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sourceEnrollmentId" TEXT,
    "academicYear" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "fromClass" TEXT,
    "fromSection" TEXT,
    "fromStatus" TEXT,
    "toAcademicYear" TEXT,
    "toClass" TEXT,
    "toSection" TEXT,
    "toStatus" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "evidenceNotes" TEXT,
    "marksSummary" TEXT,
    "attendanceSummary" TEXT,
    "parentRequestNotes" TEXT,
    "parentAcknowledgementNotes" TEXT,
    "feeWarningNotes" TEXT,
    "udiseReviewNotes" TEXT,
    "destinationSchool" TEXT,
    "followUpNotes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "finalizedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProgressionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLifecycleEvent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT,
    "eventType" TEXT NOT NULL,
    "fromClass" TEXT,
    "fromSection" TEXT,
    "toClass" TEXT,
    "toSection" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "evidenceNotes" TEXT,
    "parentAcknowledgementNotes" TEXT,
    "approvedByUserId" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAttendanceSession" (
    "id" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "takenByUserId" TEXT,
    "submittedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "notes" TEXT,
    "operationalCalendarVersionKey" TEXT,
    "operationalCalendarDayKey" TEXT,
    "calendarBasisSnapshotJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "iamPublicKey" TEXT,
    "staffCode" TEXT,
    "fullName" TEXT NOT NULL,
    "displayName" TEXT,
    "staffType" TEXT NOT NULL DEFAULT 'TEACHING',
    "designation" TEXT NOT NULL,
    "department" TEXT,
    "primarySubject" TEXT,
    "additionalSubjects" TEXT,
    "qualification" TEXT,
    "experienceYears" DOUBLE PRECISION,
    "dateOfJoining" TIMESTAMP(3),
    "mobile" TEXT,
    "alternateMobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactMobile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "userId" TEXT,
    "timetableTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "leaveType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "halfDaySession" TEXT,
    "totalDays" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "substituteRequired" BOOLEAN NOT NULL DEFAULT false,
    "substituteNotes" TEXT,
    "approverUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendanceSession" (
    "id" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "academicYear" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "takenByUserId" TEXT,
    "submittedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendanceRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "staffCode" TEXT,
    "status" TEXT NOT NULL,
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "lateMinutes" INTEGER,
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubstituteAssignment" (
    "id" TEXT NOT NULL,
    "assignmentDate" TIMESTAMP(3) NOT NULL,
    "academicYear" TEXT,
    "leaveRequestId" TEXT,
    "absentStaffMemberId" TEXT NOT NULL,
    "substituteStaffMemberId" TEXT,
    "timetableAssignmentId" TEXT,
    "className" TEXT,
    "section" TEXT,
    "subject" TEXT,
    "periodLabel" TEXT,
    "periodStartTime" TEXT,
    "periodEndTime" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "assignedByUserId" TEXT,
    "confirmedByUserId" TEXT,
    "completedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubstituteAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL DEFAULT 'ALL_PARENTS',
    "className" TEXT,
    "section" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "iamPublicKey" TEXT,
    "displayName" TEXT NOT NULL,
    "primaryMobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "email" TEXT,
    "relationship" TEXT NOT NULL DEFAULT 'Parent',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationshipToStudent" TEXT NOT NULL DEFAULT 'Parent',
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "canViewFees" BOOLEAN NOT NULL DEFAULT true,
    "canReceiveReminders" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolSettings" (
    "id" TEXT NOT NULL DEFAULT 'school',
    "schoolName" TEXT NOT NULL DEFAULT 'Nalanda Public School',
    "addressLine1" TEXT NOT NULL DEFAULT 'Nanalnagar, Mehdipatnam',
    "city" TEXT NOT NULL DEFAULT 'Hyderabad',
    "phone" TEXT NOT NULL DEFAULT '040-23513913',
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "receiptPrefix" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'INR',
    "whatsappReminderFooter" TEXT NOT NULL DEFAULT 'Nalanda Public School',
    "logoPath" TEXT NOT NULL DEFAULT '/nalanda-logo.jpg',
    "receiptTitle" TEXT NOT NULL DEFAULT 'FEE RECEIPT',
    "showSchoolPhone" BOOLEAN NOT NULL DEFAULT true,
    "showSchoolAddress" BOOLEAN NOT NULL DEFAULT true,
    "defaultPrintSize" TEXT NOT NULL DEFAULT 'A5',
    "signatureLabel" TEXT NOT NULL DEFAULT 'Receiver Signature',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAudit" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "targetUserId" TEXT,
    "detailsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthLoginAlias" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "displayMasked" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "isSchoolGoverned" BOOLEAN NOT NULL DEFAULT false,
    "admissionStudentId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthLoginAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthVerificationChallenge" (
    "id" TEXT NOT NULL,
    "aliasId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthVerificationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthPasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aliasId" TEXT NOT NULL,
    "channelType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET',
    "tokenHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "invalidationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthPasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "authorizationVersion" INTEGER NOT NULL DEFAULT 1,
    "activeRoleAssignmentId" TEXT,
    "activeChildLinkId" TEXT,
    "contextVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "deviceSummary" TEXT NOT NULL,
    "browserSummary" TEXT NOT NULL,
    "networkEvidenceMasked" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "endedByUserId" TEXT,
    "endedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "contextVersion" INTEGER NOT NULL DEFAULT 1,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionProfile" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionProfileEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "revokedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionProfileEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionProfileVersion" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionProfileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionProfileAssignment" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "endedByUserId" TEXT,
    "endedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermissionProfileAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "effect" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "revokedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "supersedesId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IamSafetyLock" (
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IamSafetyLock_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuthSecurityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "detailsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "vendorCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "mobile" TEXT,
    "alternateMobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "bankName" TEXT,
    "accountLastFour" TEXT,
    "ifsc" TEXT,
    "paymentTermsDays" INTEGER,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "parentCategoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseDepartment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseRecord" (
    "id" TEXT NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "academicYear" TEXT NOT NULL,
    "vendorId" TEXT,
    "categoryId" TEXT NOT NULL,
    "departmentId" TEXT,
    "description" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(65,30) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "transactionReference" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "notes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "paidByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL,
    "expenseRecordId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "transactionReference" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" TIMESTAMP(3),
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseAudit" (
    "id" TEXT NOT NULL,
    "expenseRecordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "detailsJson" TEXT,
    "actorUserId" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPlan" (
    "id" TEXT NOT NULL,
    "budgetNumber" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAllocatedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "warningThresholdPercent" INTEGER NOT NULL DEFAULT 80,
    "criticalThresholdPercent" INTEGER NOT NULL DEFAULT 100,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetAllocation" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "categoryId" TEXT,
    "departmentId" TEXT,
    "allocationKey" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(65,30) NOT NULL,
    "warningThresholdPercent" INTEGER,
    "criticalThresholdPercent" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRevision" (
    "id" TEXT NOT NULL,
    "budgetPlanId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "previousTotalAmount" DECIMAL(65,30) NOT NULL,
    "revisedTotalAmount" DECIMAL(65,30) NOT NULL,
    "revisionData" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiscIncomeItem" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "studentLinkPolicy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiscIncomeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiscIncomeRate" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiscIncomeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiscIncomeReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "academicYear" TEXT NOT NULL,
    "studentId" TEXT,
    "payerName" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "receivedAccount" TEXT,
    "transactionReference" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" TIMESTAMP(3),
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "createdByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiscIncomeReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiscIncomeReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "rateId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitAmount" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiscIncomeReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashBookDay" (
    "id" TEXT NOT NULL,
    "cashDate" TIMESTAMP(3) NOT NULL,
    "academicYear" TEXT NOT NULL,
    "openingBalance" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "feeCashSnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "miscIncomeCashSnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "bookSalesCashSnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cashExpenseSnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "manualInflowSnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "manualOutflowSnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "bankDepositSnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "directorHandoverSnapshot" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "calculatedClosingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "countedClosingBalance" DECIMAL(65,30),
    "varianceAmount" DECIMAL(65,30),
    "sourceSummarySnapshot" TEXT,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashBookDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashBookMovement" (
    "id" TEXT NOT NULL,
    "cashBookDayId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "movementDate" TIMESTAMP(3) NOT NULL,
    "referenceNumber" TEXT,
    "bankName" TEXT,
    "recipientName" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recordedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashBookMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryTitle" (
    "id" TEXT NOT NULL,
    "titleCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "authors" TEXT NOT NULL,
    "isbn" TEXT,
    "edition" TEXT,
    "publisherName" TEXT,
    "publisherVendorId" TEXT,
    "publicationYear" INTEGER,
    "language" TEXT,
    "subject" TEXT,
    "category" TEXT,
    "classificationNumber" TEXT,
    "defaultShelfCode" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryCopy" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "barcodeValue" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "acquisitionType" TEXT NOT NULL DEFAULT 'OTHER',
    "acquisitionCost" DECIMAL(65,30),
    "vendorId" TEXT,
    "expenseRecordId" TEXT,
    "donorName" TEXT,
    "invoiceNumberSnapshot" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "shelfCode" TEXT,
    "notes" TEXT,
    "withdrawnDate" TIMESTAMP(3),
    "withdrawalReason" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryCopyEvent" (
    "id" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "previousCondition" TEXT,
    "newCondition" TEXT,
    "previousShelfCode" TEXT,
    "newShelfCode" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryCopyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryStockVerificationSession" (
    "id" TEXT NOT NULL,
    "sessionNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "verificationDate" TIMESTAMP(3) NOT NULL,
    "scopeType" TEXT NOT NULL,
    "shelfCodeFilter" TEXT,
    "titleIdFilter" TEXT,
    "categoryFilter" TEXT,
    "subjectFilter" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expectedCopyCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedCopyCount" INTEGER NOT NULL DEFAULT 0,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "issuedOffsiteCount" INTEGER NOT NULL DEFAULT 0,
    "knownRepairCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "misShelvedCount" INTEGER NOT NULL DEFAULT 0,
    "damagedCount" INTEGER NOT NULL DEFAULT 0,
    "unexpectedCount" INTEGER NOT NULL DEFAULT 0,
    "unresolvedCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "startedByUserId" TEXT,
    "submittedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryStockVerificationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryStockVerificationRecord" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "expectedAccessionNumberSnapshot" TEXT NOT NULL,
    "expectedBarcodeSnapshot" TEXT,
    "expectedTitleSnapshot" TEXT NOT NULL,
    "expectedShelfCodeSnapshot" TEXT,
    "expectedStatusSnapshot" TEXT NOT NULL,
    "expectedConditionSnapshot" TEXT NOT NULL,
    "expectedLoanStatusSnapshot" TEXT,
    "expectedBorrowerTypeSnapshot" TEXT,
    "expectedDueDateSnapshot" TIMESTAMP(3),
    "observationStatus" TEXT NOT NULL DEFAULT 'NOT_CHECKED',
    "observedAt" TIMESTAMP(3),
    "observedShelfCode" TEXT,
    "observedCondition" TEXT,
    "scanMethod" TEXT,
    "observationNotes" TEXT,
    "discrepancyReason" TEXT,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "resolutionNotes" TEXT,
    "appliedCopyEventId" TEXT,
    "observedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "appliedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryStockVerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryStockVerificationScanEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recordId" TEXT,
    "normalizedInput" TEXT NOT NULL,
    "scanMethod" TEXT NOT NULL,
    "resultType" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryStockVerificationScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryStockVerificationEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryStockVerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryMember" (
    "id" TEXT NOT NULL,
    "memberCode" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "studentId" TEXT,
    "staffMemberId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedDate" TIMESTAMP(3) NOT NULL,
    "suspendedUntil" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryPolicy" (
    "id" TEXT NOT NULL,
    "policyCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "className" TEXT,
    "staffType" TEXT,
    "maxActiveLoans" INTEGER NOT NULL,
    "loanPeriodDays" INTEGER NOT NULL,
    "maxRenewals" INTEGER NOT NULL,
    "renewalPeriodDays" INTEGER NOT NULL,
    "reservationLimit" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryLoan" (
    "id" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "activeCopyKey" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnedDate" TIMESTAMP(3),
    "renewCount" INTEGER NOT NULL DEFAULT 0,
    "policyCodeSnapshot" TEXT NOT NULL,
    "loanPeriodDaysSnapshot" INTEGER NOT NULL,
    "maxRenewalsSnapshot" INTEGER NOT NULL,
    "renewalPeriodDaysSnapshot" INTEGER NOT NULL,
    "issueConditionSnapshot" TEXT NOT NULL,
    "returnConditionSnapshot" TEXT,
    "issueNotes" TEXT,
    "returnNotes" TEXT,
    "cancellationReason" TEXT,
    "issuedByUserId" TEXT,
    "returnedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryReservation" (
    "id" TEXT NOT NULL,
    "reservationNumber" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "activeMemberTitleKey" TEXT,
    "requestedDate" TIMESTAMP(3) NOT NULL,
    "expiresDate" TIMESTAMP(3),
    "fulfilledLoanId" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "fulfilledByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryLoanEvent" (
    "id" TEXT NOT NULL,
    "loanId" TEXT,
    "reservationId" TEXT,
    "memberId" TEXT NOT NULL,
    "copyId" TEXT,
    "titleId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "previousDueDate" TIMESTAMP(3),
    "newDueDate" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryLoanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryIncident" (
    "id" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeCaseKey" TEXT,
    "loanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "reportedDate" TIMESTAMP(3) NOT NULL,
    "incidentCondition" TEXT,
    "description" TEXT NOT NULL,
    "assessmentNotes" TEXT,
    "resolutionType" TEXT,
    "replacementCopyId" TEXT,
    "resolvedDate" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "resolvedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryChargeRule" (
    "id" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "className" TEXT,
    "staffType" TEXT,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "overdueAmountPerDay" DECIMAL(65,30) NOT NULL,
    "maximumOverdueAmount" DECIMAL(65,30),
    "lostChargeBasis" TEXT NOT NULL DEFAULT 'MANUAL',
    "fixedLostAmount" DECIMAL(65,30),
    "damagedChargeBasis" TEXT NOT NULL DEFAULT 'MANUAL',
    "fixedDamagedAmount" DECIMAL(65,30),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryChargeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryCharge" (
    "id" TEXT NOT NULL,
    "chargeNumber" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeOverdueLoanKey" TEXT,
    "memberId" TEXT NOT NULL,
    "loanId" TEXT,
    "incidentId" TEXT,
    "studentId" TEXT,
    "staffMemberId" TEXT,
    "assessedDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "overdueDaysSnapshot" INTEGER,
    "ruleCodeSnapshot" TEXT,
    "rateSnapshot" DECIMAL(65,30),
    "originalAmount" DECIMAL(65,30) NOT NULL,
    "waivedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL(65,30) NOT NULL,
    "assessmentReason" TEXT NOT NULL,
    "waiverReason" TEXT,
    "cancellationReason" TEXT,
    "miscIncomeReceiptId" TEXT,
    "approvedByUserId" TEXT,
    "waivedByUserId" TEXT,
    "collectedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "createdByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "waivedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryChargeEvent" (
    "id" TEXT NOT NULL,
    "chargeId" TEXT,
    "incidentId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "amountSnapshot" DECIMAL(65,30),
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryChargeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookCatalogItem" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "publisherVendorId" TEXT,
    "className" TEXT,
    "subject" TEXT,
    "description" TEXT,
    "studentLinkRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookCatalogRate" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookCatalogRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookSaleReceipt" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "receiptDate" TIMESTAMP(3) NOT NULL,
    "academicYear" TEXT NOT NULL,
    "studentId" TEXT,
    "payerName" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "receivedAccount" TEXT,
    "transactionReference" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" TIMESTAMP(3),
    "grossAmount" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "createdByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookSaleReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookSaleReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCodeSnapshot" TEXT NOT NULL,
    "itemTitleSnapshot" TEXT NOT NULL,
    "classNameSnapshot" TEXT,
    "publisherNameSnapshot" TEXT,
    "rateId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitAmount" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookSaleReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookCashSettlement" (
    "id" TEXT NOT NULL,
    "settlementDate" TIMESTAMP(3) NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expectedBookCash" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "handedToDirectorAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "handedToCashCounterAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "retainedByBooksInchargeAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "varianceAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "varianceReason" TEXT,
    "booksInchargeName" TEXT,
    "receiverName" TEXT,
    "cashBookMovementId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookCashSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAudit" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValueJson" TEXT,
    "newValueJson" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "changedByName" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedByUserId" TEXT NOT NULL,
    "importedByName" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "detailsJson" TEXT,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingBatch" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "bundleType" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'CREATE_AND_LINK',
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedByUserId" TEXT NOT NULL,
    "originalFileNameHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "workbookSha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "referenceVersionHash" TEXT,
    "targetVersionHash" TEXT,
    "planHash" TEXT,
    "planVersion" INTEGER NOT NULL DEFAULT 0,
    "planSummaryJson" TEXT,
    "planExpiresAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvalReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executionIdempotencyKey" TEXT,
    "executionPayloadHash" TEXT,
    "executedByUserId" TEXT,
    "executedAt" TIMESTAMP(3),
    "executionResultJson" TEXT,
    "rollbackPreviewJson" TEXT,
    "rolledBackByUserId" TEXT,
    "rollbackReason" TEXT,
    "rolledBackAt" TIMESTAMP(3),
    "purgeAfter" TIMESTAMP(3) NOT NULL,
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingRowOutcome" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "importRowKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targetRecordId" TEXT,
    "beforeHash" TEXT,
    "afterHash" TEXT,
    "issueCodesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingRowOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingAuditEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "actorUserId" TEXT NOT NULL,
    "reasonSafe" TEXT,
    "evidenceHash" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoLiveChecklist" (
    "id" TEXT NOT NULL DEFAULT 'go-live',
    "backupTaken" BOOLEAN NOT NULL DEFAULT false,
    "schoolSettingsVerified" BOOLEAN NOT NULL DEFAULT false,
    "realUsersCreated" BOOLEAN NOT NULL DEFAULT false,
    "defaultPasswordsChanged" BOOLEAN NOT NULL DEFAULT false,
    "studentMasterImported" BOOLEAN NOT NULL DEFAULT false,
    "randomStudentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "paymentTrialCompleted" BOOLEAN NOT NULL DEFAULT false,
    "paymentTotalsMatched" BOOLEAN NOT NULL DEFAULT false,
    "randomPaymentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "testReceiptPrinted" BOOLEAN NOT NULL DEFAULT false,
    "pendingDuesChecked" BOOLEAN NOT NULL DEFAULT false,
    "backupAfterImportTaken" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoLiveChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableTeacher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "department" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxPeriodsPerWeek" INTEGER NOT NULL,
    "maxPeriodsPerDay" INTEGER,
    "preferredFreePeriods" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableSubject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "department" TEXT,
    "isLabSubject" BOOLEAN NOT NULL DEFAULT false,
    "isActivitySubject" BOOLEAN NOT NULL DEFAULT false,
    "allowConsecutivePeriods" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAssignment" (
    "id" TEXT NOT NULL,
    "assignmentNumber" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "subjectName" TEXT NOT NULL,
    "timetableSubjectId" TEXT,
    "assignedDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "resourceLink" TEXT,
    "teacherNotes" TEXT,
    "publicNotes" TEXT,
    "correctionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "publishedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkAssignmentEvent" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "titleSnapshot" TEXT,
    "instructionsSnapshot" TEXT,
    "dueDateSnapshot" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HomeworkAssignmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassworkItem" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "timetableSubjectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassworkItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassworkItemVersion" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "correctionReason" TEXT,
    "publishRequestKey" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3),

    CONSTRAINT "ClassworkItemVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassworkSubmission" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "lastSubmittedByUserId" TEXT,
    "lastSubmittedByRole" TEXT,
    "firstSubmittedAt" TIMESTAMP(3),
    "lastSubmittedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassworkSubmissionVersion" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "itemVersionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "textBody" TEXT,
    "submissionRequestKey" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "parentGuardianId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassworkSubmissionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassworkAttachment" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "itemVersionId" TEXT,
    "submissionVersionId" TEXT,
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
    "backupVerifiedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassworkAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassworkFeedback" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "submissionVersionId" TEXT,
    "sequenceNumber" INTEGER NOT NULL,
    "feedbackType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassworkFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassworkAuditEvent" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "submissionId" TEXT,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassworkAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamCycle" (
    "id" TEXT NOT NULL,
    "examCode" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "openedByUserId" TEXT,
    "closedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAssessment" (
    "id" TEXT NOT NULL,
    "examCycleId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "subjectName" TEXT NOT NULL,
    "timetableSubjectId" TEXT,
    "componentName" TEXT NOT NULL DEFAULT '',
    "assessmentType" TEXT NOT NULL,
    "maxMarks" DECIMAL(65,30) NOT NULL,
    "passMarks" DECIMAL(65,30),
    "weightagePercent" DECIMAL(65,30),
    "entryStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "instructions" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMark" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "marksObtained" DECIMAL(65,30),
    "entryStatus" TEXT NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "enteredByUserId" TEXT,
    "verifiedByUserId" TEXT,
    "enteredAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMarkEvent" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentMarkId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousMarks" DECIMAL(65,30),
    "newMarks" DECIMAL(65,30),
    "previousEntryStatus" TEXT,
    "newEntryStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "actorLabel" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentMarkEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Examination" (
    "id" TEXT NOT NULL,
    "examCode" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "activatedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "interventionReason" TEXT,
    "archiveReason" TEXT,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Examination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationClassScope" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "timetableClassSectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationClassScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationSchemeVersion" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "scopeKey" TEXT NOT NULL DEFAULT 'BASE',
    "subjectPaperId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "calculationMode" TEXT NOT NULL,
    "roundingPolicyVersion" TEXT NOT NULL DEFAULT 'RC05_V1_DECIMAL6_HALF_UP2',
    "markDecimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "absentTreatment" TEXT NOT NULL DEFAULT 'ZERO',
    "exemptTreatment" TEXT NOT NULL DEFAULT 'EXCLUDE',
    "notApplicableTreatment" TEXT NOT NULL DEFAULT 'EXCLUDE',
    "passFailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "passThresholdPercentage" DECIMAL(65,30),
    "rankEnabled" BOOLEAN NOT NULL DEFAULT false,
    "rankTiePolicy" TEXT NOT NULL DEFAULT 'COMPETITION_SHARED_STABLE_ADMISSION',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "activatedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "activationReason" TEXT,
    "archiveReason" TEXT,
    "activatedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "marksEntryOpenedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationSchemeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationComponent" (
    "id" TEXT NOT NULL,
    "schemeVersionId" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentKind" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "maximumMarks" DECIMAL(65,30) NOT NULL,
    "contributionWeight" DECIMAL(65,30),
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSubjectPaper" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "timetableSubjectId" TEXT NOT NULL,
    "subjectNameSnapshot" TEXT NOT NULL,
    "paperCode" TEXT NOT NULL,
    "paperName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSubjectPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationTimetableVersion" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentPublicationKey" TEXT,
    "idempotencyKey" TEXT,
    "replacesVersionId" TEXT,
    "parentInstructions" TEXT,
    "publicationReason" TEXT,
    "replacementReason" TEXT,
    "withdrawalReason" TEXT,
    "archiveReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "withdrawnByUserId" TEXT,
    "archivedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationTimetableVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationTimetableRow" (
    "id" TEXT NOT NULL,
    "timetableVersionId" TEXT NOT NULL,
    "subjectPaperId" TEXT NOT NULL,
    "subjectNameSnapshot" TEXT NOT NULL,
    "paperCodeSnapshot" TEXT NOT NULL,
    "paperNameSnapshot" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reportingTime" TEXT,
    "venue" TEXT,
    "parentInstructions" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExaminationTimetableRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationTimetableEvent" (
    "id" TEXT NOT NULL,
    "timetableVersionId" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExaminationTimetableEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSubjectGroup" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "groupCode" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "calculationMode" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSubjectGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSubjectGroupMember" (
    "id" TEXT NOT NULL,
    "subjectGroupId" TEXT NOT NULL,
    "subjectPaperId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "contributionWeight" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamSubjectGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeScaleVersion" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "scaleFamily" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesVersionId" TEXT,
    "activatedByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeScaleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeScaleBand" (
    "id" TEXT NOT NULL,
    "gradeScaleVersionId" TEXT NOT NULL,
    "gradeCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minimumPercentage" DECIMAL(65,30) NOT NULL,
    "maximumPercentage" DECIMAL(65,30) NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "gradePoint" DECIMAL(65,30),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeScaleBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoScholasticSchemeVersion" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "schemeFamily" TEXT NOT NULL,
    "ratingScaleJson" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesVersionId" TEXT,
    "activatedByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoScholasticSchemeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoScholasticItem" (
    "id" TEXT NOT NULL,
    "coScholasticSchemeVersionId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoScholasticItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamTemplateFamilyBinding" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "templateFamily" TEXT NOT NULL,
    "reportCardTemplateId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "evidenceStatus" TEXT NOT NULL DEFAULT 'DIRECTLY_EVIDENCED',
    "activatedByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamTemplateFamilyBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherExamAssignment" (
    "id" TEXT NOT NULL,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "timetableClassSectionId" TEXT NOT NULL,
    "subjectPaperId" TEXT NOT NULL,
    "schemeVersionId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "timetableTeacherId" TEXT NOT NULL,
    "timetableAssignmentId" TEXT NOT NULL,
    "assignmentRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "assignmentReason" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "archivedByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherExamAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExaminationSchemeAudit" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT,
    "examinationId" TEXT NOT NULL,
    "schemeVersionId" TEXT,
    "assignmentId" TEXT,
    "eventType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExaminationSchemeAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamMarkSheet" (
    "id" TEXT NOT NULL,
    "logicalSheetKey" TEXT NOT NULL,
    "currentKey" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "supersedesSheetId" TEXT,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "subjectPaperId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "schemeVersionId" TEXT NOT NULL,
    "primaryAssignmentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "optimisticVersion" INTEGER NOT NULL DEFAULT 1,
    "assignmentSnapshotJson" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "moderatedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "correctionRequestId" TEXT,
    "correctionRequestStatus" TEXT,
    "correctionPriorStatus" TEXT,
    "correctionRequestReason" TEXT,
    "correctionRequestedByUserId" TEXT,
    "correctionRequestedAt" TIMESTAMP(3),
    "correctionReviewedByUserId" TEXT,
    "correctionReviewReason" TEXT,
    "correctionReviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "moderatedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamMarkSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamMarkEntry" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "entryState" TEXT NOT NULL DEFAULT 'NOT_ENTERED',
    "marksObtained" DECIMAL(65,30),
    "remarks" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "enteredByUserId" TEXT,
    "enteredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamMarkEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentResultSnapshot" (
    "id" TEXT NOT NULL,
    "calculationRunId" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "runNumber" INTEGER NOT NULL,
    "runStatus" TEXT NOT NULL DEFAULT 'PREVIEW',
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schemeVersionId" TEXT NOT NULL,
    "snapshotVersion" INTEGER NOT NULL,
    "totalObtained" DECIMAL(65,30) NOT NULL,
    "totalMaximum" DECIMAL(65,30) NOT NULL,
    "percentage" DECIMAL(65,30) NOT NULL,
    "gradeCode" TEXT,
    "gradePoint" DECIMAL(65,30),
    "passResult" TEXT,
    "rankValue" INTEGER,
    "formulaVersion" TEXT NOT NULL,
    "roundingPolicyVersion" TEXT NOT NULL,
    "warningsJson" TEXT NOT NULL,
    "sourceSheetVersionsJson" TEXT NOT NULL,
    "sourceSchemeVersionsJson" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "calculatedByUserId" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "lockedByUserId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentResultSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradingScheme" (
    "id" TEXT NOT NULL,
    "schemeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT,
    "reportType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradingScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeBand" (
    "id" TEXT NOT NULL,
    "gradingSchemeId" TEXT NOT NULL,
    "gradeCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minimumPercentage" DECIMAL(65,30) NOT NULL,
    "maximumPercentage" DECIMAL(65,30),
    "displayOrder" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardTemplate" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "academicYear" TEXT,
    "className" TEXT,
    "gradingSchemeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "templateDefinitionJson" TEXT NOT NULL,
    "printSettingsJson" TEXT,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "title" TEXT NOT NULL,
    "reportingPeriod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "templateSnapshotJson" TEXT NOT NULL,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "openedByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "openedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportCardBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCardBatchExamSource" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "examCycleId" TEXT NOT NULL,
    "weightagePercent" DECIMAL(65,30),
    "displayOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCardBatchExamSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentReportCard" (
    "id" TEXT NOT NULL,
    "reportCardNumber" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "reportType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "draftDataJson" TEXT NOT NULL,
    "teacherOverallComment" TEXT,
    "principalComment" TEXT,
    "directorComment" TEXT,
    "finalGrade" TEXT,
    "progressionDecisionId" TEXT,
    "promotionDisplayText" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentReportCardVersion" (
    "id" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "calendarBasisVersionKey" TEXT,
    "calendarBasisSnapshotJson" TEXT,
    "correctionReason" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "issuedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentReportCardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicReportDefinition" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "definitionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "parameterSchemaJson" TEXT NOT NULL,
    "minimumGroupSize" INTEGER NOT NULL DEFAULT 5,
    "definitionHash" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicReportDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicReportRun" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "parameterJson" TEXT NOT NULL,
    "accessScopeJson" TEXT NOT NULL,
    "normalizationRule" TEXT NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "immutableSummaryJson" TEXT NOT NULL,
    "summaryHash" TEXT NOT NULL,
    "supersedesRunId" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicReportSourceReference" (
    "id" TEXT NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceVersion" INTEGER NOT NULL,
    "publicReference" TEXT NOT NULL,
    "resultSnapshotId" TEXT,
    "reportCardVersionId" TEXT,
    "formulaVersion" TEXT NOT NULL,
    "roundingPolicyVersion" TEXT NOT NULL,
    "schemeVersionRefsJson" TEXT NOT NULL,
    "attendanceBasisKey" TEXT,
    "sourceLockedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicReportSourceReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicReportAuditEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "reportRunId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "safeDetailsJson" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicReportAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicCalendarVersion" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveScope" TEXT NOT NULL DEFAULT 'SCHOOL_WIDE',
    "className" TEXT,
    "section" TEXT,
    "scopeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currentPublicationKey" TEXT,
    "idempotencyKey" TEXT,
    "replacesVersionId" TEXT,
    "publicationReason" TEXT,
    "replacementReason" TEXT,
    "withdrawalReason" TEXT,
    "archiveReason" TEXT,
    "attendanceReconciliationRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicCalendarVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalCalendarDay" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "calendarVersionId" TEXT NOT NULL,
    "dayDate" TIMESTAMP(3) NOT NULL,
    "dayType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
    "scopeType" TEXT NOT NULL DEFAULT 'SCHOOL_WIDE',
    "className" TEXT,
    "section" TEXT,
    "scopeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "halfDaySession" TEXT,
    "publicInstructions" TEXT,
    "reason" TEXT,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalCalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCalendarEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "eventNumber" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 1,
    "currentPublishedVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolCalendarEventVersion" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "venue" TEXT,
    "parentInstructions" TEXT,
    "internalNotes" TEXT,
    "audienceType" TEXT NOT NULL,
    "roleScope" TEXT,
    "classSectionId" TEXT,
    "className" TEXT,
    "section" TEXT,
    "audienceKey" TEXT NOT NULL,
    "examinationTimetableVersionId" TEXT,
    "isImportant" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT NOT NULL,
    "currentPublicationKey" TEXT,
    "idempotencyKey" TEXT,
    "replacesVersionId" TEXT,
    "publicationReason" TEXT,
    "replacementReason" TEXT,
    "withdrawalReason" TEXT,
    "archiveReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCalendarEventVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicCalendarAuditEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "calendarVersionId" TEXT,
    "schoolEventId" TEXT,
    "eventVersionId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicCalendarAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentReportCardEvent" (
    "id" TEXT NOT NULL,
    "reportCardId" TEXT NOT NULL,
    "versionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentReportCardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableClassSection" (
    "id" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableClassSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetablePeriodTemplate" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "groupName" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "periodNumber" INTEGER,
    "label" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isTeachingPeriod" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TimetablePeriodTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableAssignment" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "classSectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "periodsPerWeek" INTEGER NOT NULL,
    "allowConsecutiveOverride" BOOLEAN,
    "priority" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableTeacherUnavailability" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableTeacherUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableFixedPeriod" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "classSectionId" TEXT,
    "teacherId" TEXT,
    "subjectId" TEXT,
    "dayOfWeek" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableFixedPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableDraft" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "classSectionId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "assignmentId" TEXT,
    "teacherId" TEXT,
    "subjectId" TEXT,
    "label" TEXT,
    "entryType" TEXT NOT NULL DEFAULT 'EMPTY',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAnalyticsReviewCycle" (
    "id" TEXT NOT NULL,
    "cycleCode" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "minimumStudentCohort" INTEGER NOT NULL DEFAULT 5,
    "metricDefinitionVersion" TEXT NOT NULL,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "openedByUserId" TEXT,
    "finalisedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "openedAt" TIMESTAMP(3),
    "finalisedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAnalyticsReviewCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "reviewCycleId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "metricDefinitionVersion" TEXT NOT NULL,
    "sourceCalculatedAt" TIMESTAMP(3) NOT NULL,
    "workloadJson" TEXT NOT NULL,
    "attendanceJson" TEXT NOT NULL,
    "leaveJson" TEXT NOT NULL,
    "substituteJson" TEXT NOT NULL,
    "homeworkJson" TEXT NOT NULL,
    "assessmentWorkflowJson" TEXT NOT NULL,
    "studentOutcomeJson" TEXT NOT NULL,
    "reportCardJson" TEXT NOT NULL,
    "kgRubricJson" TEXT NOT NULL,
    "dataQualityJson" TEXT NOT NULL,
    "contextJson" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAnalyticsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAnalyticsReview" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "strengthsNote" TEXT,
    "supportNeededNote" TEXT,
    "agreedActionsNote" TEXT,
    "leadershipContextNote" TEXT,
    "teacherResponse" TEXT,
    "nextReviewDate" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "sharedByUserId" TEXT,
    "finalisedByUserId" TEXT,
    "sharedAt" TIMESTAMP(3),
    "teacherRespondedAt" TIMESTAMP(3),
    "finalisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAnalyticsReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "reviewCycleId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "reviewId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateNumberSeries" (
    "id" TEXT NOT NULL,
    "seriesCode" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "academicYear" TEXT,
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "paddingLength" INTEGER NOT NULL DEFAULT 4,
    "suffix" TEXT,
    "resetPolicy" TEXT NOT NULL DEFAULT 'NEVER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateNumberSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "templateDefinitionJson" TEXT NOT NULL,
    "printSettingsJson" TEXT,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CertificateTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCertificateRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "requestSource" TEXT NOT NULL DEFAULT 'INTERNAL',
    "purpose" TEXT NOT NULL,
    "requestedCopies" INTEGER NOT NULL DEFAULT 1,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "applicantGuardianId" TEXT,
    "internalNotes" TEXT,
    "publicNotes" TEXT,
    "reviewNotes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "rejectedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCertificateRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCertificate" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "draftDataJson" TEXT NOT NULL,
    "issuePurpose" TEXT NOT NULL,
    "internalNotes" TEXT,
    "publicNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCertificateVersion" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "correctionReason" TEXT,
    "reissueReason" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "issuedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "snapshotHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentCertificateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCertificateEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "certificateId" TEXT,
    "versionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentCertificateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassXPackageTemplate" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "packageType" TEXT NOT NULL DEFAULT 'CLASS_X_COMPLETION_PACKAGE',
    "name" TEXT NOT NULL,
    "academicYear" TEXT,
    "schoolBoard" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "documentDefinitionJson" TEXT NOT NULL,
    "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultChargeRuleId" TEXT,
    "instructions" TEXT,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassXPackageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassXDocumentPackage" (
    "id" TEXT NOT NULL,
    "packageNumber" TEXT NOT NULL,
    "packageType" TEXT NOT NULL DEFAULT 'CLASS_X_COMPLETION_PACKAGE',
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requestSource" TEXT NOT NULL DEFAULT 'INTERNAL',
    "applicantGuardianId" TEXT,
    "purpose" TEXT,
    "templateSnapshotJson" TEXT NOT NULL,
    "eligibilitySnapshotJson" TEXT NOT NULL,
    "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
    "totalRequiredItems" INTEGER NOT NULL DEFAULT 0,
    "readyItems" INTEGER NOT NULL DEFAULT 0,
    "handedOverItems" INTEGER NOT NULL DEFAULT 0,
    "internalNotes" TEXT,
    "publicNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "completedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassXDocumentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassXPackageDocumentItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "issuerType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "parentVisible" BOOLEAN NOT NULL DEFAULT true,
    "serialNumberRequired" BOOLEAN NOT NULL DEFAULT false,
    "handoverRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "linkedStudentCertificateId" TEXT,
    "linkedStudentCertificateVersionId" TEXT,
    "externalDocumentReference" TEXT,
    "authorityName" TEXT,
    "requestDate" TIMESTAMP(3),
    "externalIssueDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "verifiedDate" TIMESTAMP(3),
    "handoverDate" TIMESTAMP(3),
    "sourceNotes" TEXT,
    "publicNotes" TEXT,
    "rejectionReason" TEXT,
    "notApplicableReason" TEXT,
    "verifiedByUserId" TEXT,
    "handedOverByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassXPackageDocumentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassXPackageChargeRule" (
    "id" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "academicYear" TEXT,
    "packageType" TEXT NOT NULL DEFAULT 'CLASS_X_COMPLETION_PACKAGE',
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "miscellaneousIncomeItemCode" TEXT NOT NULL,
    "paymentRequired" BOOLEAN NOT NULL DEFAULT true,
    "waiverAllowed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassXPackageChargeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassXPackageCharge" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "chargeRuleId" TEXT,
    "chargeCode" TEXT NOT NULL,
    "miscellaneousIncomeItemCode" TEXT,
    "originalAmount" DECIMAL(65,30) NOT NULL,
    "waivedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL(65,30) NOT NULL,
    "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "waiverAllowedSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "waiverReason" TEXT,
    "cancellationReason" TEXT,
    "approvedByUserId" TEXT,
    "waivedByUserId" TEXT,
    "collectedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "linkedMiscIncomeReceiptId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "waivedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassXPackageCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassXPackageHandover" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "handoverNumber" TEXT NOT NULL,
    "handoverDate" TIMESTAMP(3) NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "relationship" TEXT,
    "recipientAcknowledgementText" TEXT NOT NULL,
    "identityChecked" BOOLEAN NOT NULL DEFAULT false,
    "identityCheckMethod" TEXT,
    "itemSnapshotJson" TEXT NOT NULL,
    "handedOverByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassXPackageHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassXPackageEvent" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "documentItemId" TEXT,
    "chargeId" TEXT,
    "handoverId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassXPackageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityCardNumberSeries" (
    "id" TEXT NOT NULL,
    "seriesCode" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "academicYear" TEXT,
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "paddingLength" INTEGER NOT NULL DEFAULT 4,
    "suffix" TEXT,
    "resetPolicy" TEXT NOT NULL DEFAULT 'NEVER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityCardNumberSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityCardTemplate" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "frontDefinitionJson" TEXT NOT NULL,
    "backDefinitionJson" TEXT NOT NULL,
    "printSettingsJson" TEXT,
    "photoRequired" BOOLEAN NOT NULL DEFAULT false,
    "barcodeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityCardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityCardBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "academicYear" TEXT,
    "templateId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "className" TEXT,
    "section" TEXT,
    "staffDesignation" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expectedCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "issuedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "scopeSnapshotJson" TEXT,
    "resultSnapshotJson" TEXT,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityCardBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityCard" (
    "id" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "batchId" TEXT,
    "templateId" TEXT NOT NULL,
    "numberSeriesId" TEXT,
    "studentId" TEXT,
    "staffMemberId" TEXT,
    "academicYear" TEXT,
    "cardNumber" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "draftDataJson" TEXT NOT NULL,
    "templateSnapshotJson" TEXT NOT NULL,
    "issueReason" TEXT,
    "revocationReason" TEXT,
    "cancellationReason" TEXT,
    "replacesCardId" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "revokedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentityCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityCardVersion" (
    "id" TEXT NOT NULL,
    "identityCardId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "correctionReason" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "issuedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "snapshotHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityCardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityCardEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "identityCardId" TEXT,
    "versionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityCardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultPriority" TEXT NOT NULL DEFAULT 'NORMAL',
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionPath" TEXT,
    "acknowledgmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationCampaign" (
    "id" TEXT NOT NULL,
    "campaignNumber" TEXT NOT NULL,
    "templateId" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionPath" TEXT,
    "audienceType" TEXT NOT NULL,
    "audienceDefinitionJson" TEXT NOT NULL,
    "audienceSnapshotJson" TEXT,
    "templateSnapshotJson" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "acknowledgmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "totalResolvedUsers" INTEGER NOT NULL DEFAULT 0,
    "totalRecipientRows" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalRead" INTEGER NOT NULL DEFAULT 0,
    "totalAcknowledged" INTEGER NOT NULL DEFAULT 0,
    "totalDismissed" INTEGER NOT NULL DEFAULT 0,
    "correctionOfCampaignId" TEXT,
    "reviewNotes" TEXT,
    "withdrawalReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "withdrawnByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "archivedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientRoleSnapshot" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "recipientContextJson" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL,
    "firstViewedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSkippedRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetReferenceKey" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "safeContextJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationSkippedRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "campaignId" TEXT,
    "recipientId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppIntegrationProfile" (
    "id" TEXT NOT NULL,
    "profileCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'META_CLOUD',
    "mode" TEXT NOT NULL DEFAULT 'MOCK',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "graphApiVersion" TEXT NOT NULL DEFAULT 'v25.0',
    "businessAccountReference" TEXT,
    "phoneNumberReference" TEXT,
    "displayPhoneMasked" TEXT,
    "defaultCountryCode" TEXT DEFAULT '+91',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "dailyMessageLimit" INTEGER,
    "hourlyMessageLimit" INTEGER,
    "costCapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maximumEstimatedBatchCostMinor" INTEGER,
    "costCapCurrency" TEXT NOT NULL DEFAULT 'INR',
    "costCapUpdatedAt" TIMESTAMP(3),
    "costCapUpdatedByUserId" TEXT,
    "maximumRetryCount" INTEGER NOT NULL DEFAULT 3,
    "workerChunkSize" INTEGER NOT NULL DEFAULT 25,
    "liveSendingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastHealthCheckStatus" TEXT,
    "lastHealthCheckMessage" TEXT,
    "activatedByUserId" TEXT,
    "pausedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppIntegrationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConsent" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "guardianId" TEXT,
    "staffMemberId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "phoneHash" TEXT NOT NULL,
    "phoneLast4" TEXT NOT NULL,
    "countryCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPTED_OUT',
    "consentSource" TEXT NOT NULL,
    "consentWordingVersion" TEXT NOT NULL,
    "consentPurposeScope" TEXT NOT NULL DEFAULT 'SCHOOL_OPERATIONAL_UPDATES',
    "evidenceReference" TEXT,
    "notes" TEXT,
    "optedInAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "collectedByUserId" TEXT,
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppConsentEvent" (
    "id" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "consentWordingVersion" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplateMapping" (
    "id" TEXT NOT NULL,
    "mappingCode" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "notificationCategory" TEXT NOT NULL,
    "internalPurpose" TEXT NOT NULL,
    "metaTemplateName" TEXT NOT NULL,
    "metaTemplateLanguage" TEXT NOT NULL,
    "metaTemplateCategory" TEXT,
    "providerTemplateId" TEXT,
    "providerStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "parameterDefinitionJson" TEXT NOT NULL,
    "sampleValuesJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "lastSyncedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplateMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppOutboundBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "notificationCampaignId" TEXT NOT NULL,
    "notificationCampaignSnapshotJson" TEXT NOT NULL,
    "templateMappingId" TEXT NOT NULL,
    "templateMappingSnapshotJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "emergencyOverride" BOOLEAN NOT NULL DEFAULT false,
    "emergencyOverrideReason" TEXT,
    "totalCampaignRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalEligibleContacts" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalQueued" INTEGER NOT NULL DEFAULT 0,
    "totalAccepted" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalRead" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "totalOptedOut" INTEGER NOT NULL DEFAULT 0,
    "totalUnknown" INTEGER NOT NULL DEFAULT 0,
    "skipReasonCountsJson" TEXT NOT NULL DEFAULT '{}',
    "estimatedCostMinor" INTEGER,
    "estimatedCostCurrency" TEXT,
    "estimateRateVersion" TEXT,
    "costCapOverrideSnapshotHash" TEXT,
    "costCapOverrideReason" TEXT,
    "costCapOverrideEstimateMinor" INTEGER,
    "costCapOverrideLimitMinor" INTEGER,
    "costCapOverrideCurrency" TEXT,
    "costCapOverrideRateVersion" TEXT,
    "costCapOverriddenAt" TIMESTAMP(3),
    "costCapOverriddenByUserId" TEXT,
    "approvalNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "startedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppOutboundBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppDelivery" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "notificationRecipientId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectReferenceId" TEXT NOT NULL,
    "safeDisplayLabel" TEXT NOT NULL,
    "safeContextJson" TEXT,
    "phoneHash" TEXT NOT NULL,
    "phoneLast4" TEXT NOT NULL,
    "countryCode" TEXT,
    "consentId" TEXT NOT NULL,
    "templateNameSnapshot" TEXT NOT NULL,
    "templateLanguageSnapshot" TEXT NOT NULL,
    "templateCategorySnapshot" TEXT,
    "renderedParametersJson" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerErrorCategory" TEXT,
    "providerErrorCode" TEXT,
    "failureMessageSafe" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "resultStatus" TEXT NOT NULL,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "errorCategory" TEXT,
    "errorCode" TEXT,
    "safeErrorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppWebhookEvent" (
    "id" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "deliveryId" TEXT,
    "eventType" TEXT NOT NULL,
    "mappedStatus" TEXT,
    "signatureValid" BOOLEAN NOT NULL,
    "processingStatus" TEXT NOT NULL,
    "duplicateReceiptCount" INTEGER NOT NULL DEFAULT 0,
    "safeSummaryJson" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppOperationalEvent" (
    "id" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "batchId" TEXT,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "limitValue" INTEGER,
    "currentUsage" INTEGER,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "nextEligibleAt" TIMESTAMP(3),
    "retryAfterSeconds" INTEGER,
    "safeReason" TEXT,
    "estimatedCostMinor" INTEGER,
    "costCapMinor" INTEGER,
    "currency" TEXT,
    "rateVersion" TEXT,
    "snapshotHash" TEXT,
    "recordedByUserId" TEXT,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "lastOccurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppOperationalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppRateReference" (
    "id" TEXT NOT NULL,
    "integrationProfileId" TEXT,
    "rateVersion" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "countryCallingCode" TEXT NOT NULL,
    "templateCategory" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "ratePerDeliveredMessage" DECIMAL(65,30) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "sourceReviewDate" TIMESTAMP(3) NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppRateReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailIntegrationProfile" (
    "id" TEXT NOT NULL,
    "profileCode" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'MOCK',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "providerApiVersion" TEXT,
    "senderIdentityMasked" TEXT,
    "senderDomain" TEXT,
    "defaultCountryCode" TEXT DEFAULT '+91',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "hourlyLimit" INTEGER,
    "dailyLimit" INTEGER,
    "workerChunkSize" INTEGER NOT NULL DEFAULT 25,
    "maximumRetryCount" INTEGER NOT NULL DEFAULT 3,
    "liveSendingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "costCapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maximumEstimatedBatchCostMinor" INTEGER,
    "costCapCurrency" TEXT NOT NULL DEFAULT 'INR',
    "dltPrincipalEntityReference" TEXT,
    "dltHeaderReference" TEXT,
    "spfStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "dkimStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "dmarcStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "senderAliasStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastHealthCheckStatus" TEXT,
    "lastHealthCheckMessage" TEXT,
    "activatedByUserId" TEXT,
    "pausedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsEmailIntegrationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailConsent" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "guardianId" TEXT,
    "staffMemberId" TEXT,
    "contactHash" TEXT NOT NULL,
    "contactMasked" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPTED_OUT',
    "consentSource" TEXT NOT NULL,
    "consentWordingVersion" TEXT NOT NULL,
    "consentPurposeScope" TEXT NOT NULL DEFAULT 'SCHOOL_OPERATIONAL_UPDATES',
    "evidenceReference" TEXT,
    "optedInAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "collectedByUserId" TEXT,
    "revokedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsEmailConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailConsentEvent" (
    "id" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "consentWordingVersion" TEXT,
    "reason" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsEmailConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailTemplateMapping" (
    "id" TEXT NOT NULL,
    "mappingCode" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "notificationCategory" TEXT NOT NULL,
    "internalPurpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "providerStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "smsPrincipalEntityReference" TEXT,
    "smsHeader" TEXT,
    "smsDltTemplateId" TEXT,
    "smsTemplateCategory" TEXT,
    "smsTemplateText" TEXT,
    "emailSenderAlias" TEXT,
    "emailSubjectTemplate" TEXT,
    "emailTextTemplate" TEXT,
    "emailReplyToAlias" TEXT,
    "parameterDefinitionJson" TEXT NOT NULL,
    "sampleValuesJson" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsEmailTemplateMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailOutboundBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "notificationCampaignId" TEXT NOT NULL,
    "notificationCampaignSnapshotJson" TEXT NOT NULL,
    "templateMappingId" TEXT NOT NULL,
    "templateSnapshotJson" TEXT NOT NULL,
    "profileSnapshotJson" TEXT NOT NULL,
    "readinessSnapshotJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "emergencyOverride" BOOLEAN NOT NULL DEFAULT false,
    "totalCampaignRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalEligibleContacts" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalQueued" INTEGER NOT NULL DEFAULT 0,
    "totalAccepted" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalComplained" INTEGER NOT NULL DEFAULT 0,
    "totalSuppressed" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "skipReasonCountsJson" TEXT NOT NULL DEFAULT '{}',
    "estimatedSegments" INTEGER,
    "estimatedMaximumCostMinor" INTEGER,
    "estimatedDeliveredCostMinor" INTEGER,
    "estimatedCostCurrency" TEXT,
    "rateVersion" TEXT,
    "costCapOverrideSnapshotJson" TEXT,
    "approvalNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "startedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsEmailOutboundBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailDelivery" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "notificationRecipientId" TEXT,
    "channel" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "guardianId" TEXT,
    "staffMemberId" TEXT,
    "contactHash" TEXT NOT NULL,
    "contactMasked" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "safeContextJson" TEXT,
    "renderedSubject" TEXT,
    "renderedParametersSnapshotJson" TEXT NOT NULL,
    "smsSegmentCount" INTEGER,
    "requestFingerprint" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "skipReasonCode" TEXT,
    "failureCode" TEXT,
    "failureCategory" TEXT,
    "failureMessageSafe" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "suppressedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsEmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "providerMode" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestFingerprint" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "result" TEXT NOT NULL,
    "providerHttpStatus" INTEGER,
    "providerErrorCode" TEXT,
    "safeErrorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsEmailDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailWebhookEvent" (
    "id" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "channel" TEXT NOT NULL,
    "providerEventKey" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "eventType" TEXT NOT NULL,
    "mappedStatus" TEXT,
    "signatureVerified" BOOLEAN NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingStatus" TEXT NOT NULL,
    "safePayloadJson" TEXT NOT NULL,
    "failureReason" TEXT,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsEmailWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailOperationalEvent" (
    "id" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "batchId" TEXT,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "safeReason" TEXT,
    "snapshotJson" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsEmailOperationalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailSuppression" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "guardianId" TEXT,
    "staffMemberId" TEXT,
    "contactHash" TEXT NOT NULL,
    "contactMasked" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "providerReference" TEXT,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "clearedByUserId" TEXT,

    CONSTRAINT "SmsEmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsEmailCostRate" (
    "id" TEXT NOT NULL,
    "integrationProfileId" TEXT,
    "channel" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "messageCategory" TEXT NOT NULL,
    "encodingType" TEXT,
    "currency" TEXT NOT NULL,
    "rateMinor" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "rateVersion" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "sourceReviewDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsEmailCostRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAssistantProfile" (
    "id" TEXT NOT NULL,
    "profileCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL DEFAULT 'MOCK',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "liveUseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedModesJson" TEXT NOT NULL DEFAULT '["DOCUMENTATION","AGGREGATE_OPERATIONS"]',
    "maximumQuestionLength" INTEGER NOT NULL DEFAULT 1000,
    "maximumContextCharacters" INTEGER NOT NULL DEFAULT 12000,
    "maximumToolCalls" INTEGER NOT NULL DEFAULT 3,
    "maximumRowsPerTool" INTEGER NOT NULL DEFAULT 100,
    "requestTimeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "minimumAggregateGroupSize" INTEGER NOT NULL DEFAULT 5,
    "contentLoggingMode" TEXT NOT NULL DEFAULT 'HASH_ONLY',
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "providerModelReference" TEXT,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastHealthCheckStatus" TEXT,
    "lastHealthCheckMessage" TEXT,
    "activatedByUserId" TEXT,
    "pausedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAssistantProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAssistantSourcePolicy" (
    "id" TEXT NOT NULL,
    "policyCode" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "allowedRolesJson" TEXT NOT NULL,
    "allowedModesJson" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minimumGroupSize" INTEGER,
    "maximumRows" INTEGER,
    "freshnessWarningDays" INTEGER,
    "prohibitedFieldKeysJson" TEXT NOT NULL,
    "citationLabel" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAssistantSourcePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAssistantQueryAudit" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assistantProfileId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "questionHash" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL,
    "providerModelReference" TEXT,
    "safetyDecision" TEXT NOT NULL,
    "refusalReasonCode" TEXT,
    "toolKeysJson" TEXT NOT NULL DEFAULT '[]',
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "retrievedCharacterCount" INTEGER NOT NULL DEFAULT 0,
    "redactionCount" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "answerHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AiAssistantQueryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAssistantSafetyEvent" (
    "id" TEXT NOT NULL,
    "queryAuditId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "safeReason" TEXT NOT NULL,
    "safeMetadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAssistantSafetyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAssistantEvaluationCase" (
    "id" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expectedDecision" TEXT NOT NULL,
    "requiredSourceKeysJson" TEXT NOT NULL DEFAULT '[]',
    "prohibitedTermsJson" TEXT NOT NULL DEFAULT '[]',
    "expectedAnswerContainsJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAssistantEvaluationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAssistantEvaluationRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "passedCases" INTEGER NOT NULL DEFAULT 0,
    "failedCases" INTEGER NOT NULL DEFAULT 0,
    "blockedCases" INTEGER NOT NULL DEFAULT 0,
    "resultSummaryJson" TEXT NOT NULL DEFAULT '{}',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAssistantEvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrProfile" (
    "id" TEXT NOT NULL,
    "profileCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "liveUseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentPostingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maximumFileBytes" INTEGER NOT NULL DEFAULT 10485760,
    "maximumImagePixels" INTEGER NOT NULL DEFAULT 40000000,
    "maximumPagesPerBatch" INTEGER NOT NULL DEFAULT 20,
    "maximumRowsPerPage" INTEGER NOT NULL DEFAULT 200,
    "requestTimeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "minimumSuggestionConfidence" INTEGER NOT NULL DEFAULT 70,
    "retentionDays" INTEGER,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "pausedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRegisterOcrProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "registerName" TEXT NOT NULL,
    "registerPeriodStart" TIMESTAMP(3),
    "registerPeriodEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourcePageCount" INTEGER NOT NULL DEFAULT 0,
    "extractedRowCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedRowCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateRowCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedRowCount" INTEGER NOT NULL DEFAULT 0,
    "postedRowCount" INTEGER NOT NULL DEFAULT 0,
    "postingFailedRowCount" INTEGER NOT NULL DEFAULT 0,
    "totalExtractedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalVerifiedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalPostedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "reviewVersion" INTEGER NOT NULL DEFAULT 1,
    "approvedReviewVersion" INTEGER,
    "reviewNotes" TEXT,
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "postedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRegisterOcrBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrPage" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "originalDisplayName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "rotationDegrees" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "providerKind" TEXT NOT NULL,
    "providerRequestReferenceSafe" TEXT,
    "rawOcrText" TEXT,
    "overallConfidence" INTEGER,
    "failureMessageSafe" TEXT,
    "processedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "purgeAfter" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRegisterOcrPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrRow" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "boundingBoxJson" TEXT,
    "rawText" TEXT NOT NULL,
    "extractedFieldsJson" TEXT NOT NULL,
    "fieldConfidenceJson" TEXT NOT NULL,
    "candidateMatchesJson" TEXT NOT NULL DEFAULT '[]',
    "matchedStudentId" TEXT,
    "matchingMethod" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'EXTRACTED',
    "paymentDate" TIMESTAMP(3),
    "amountMinor" INTEGER,
    "paymentMode" TEXT,
    "receivedAccount" TEXT,
    "academicTerm" TEXT,
    "handwrittenReceiptReference" TEXT,
    "registerRemarks" TEXT,
    "duplicateClassification" TEXT NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "duplicateEvidenceJson" TEXT,
    "duplicateResolutionReason" TEXT,
    "verificationChecklistJson" TEXT,
    "verificationSnapshotJson" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "postedPaymentId" TEXT,
    "postingFailureSafe" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRegisterOcrRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrRowRevision" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "previousSnapshotJson" TEXT NOT NULL,
    "newSnapshotJson" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeRegisterOcrRowRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrPostingRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "reviewVersion" INTEGER NOT NULL,
    "selectedRowIdsJson" TEXT NOT NULL,
    "selectedRowCount" INTEGER NOT NULL,
    "attemptedAmountMinor" INTEGER NOT NULL,
    "postedRowCount" INTEGER NOT NULL DEFAULT 0,
    "postedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "failedRowCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "financialPreviewJson" TEXT NOT NULL,
    "postingPolicySnapshotJson" TEXT NOT NULL,
    "approvalReason" TEXT,
    "failureSummaryJson" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "processedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeRegisterOcrPostingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrEvent" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "pageId" TEXT,
    "rowId" TEXT,
    "postingRunId" TEXT,
    "eventType" TEXT NOT NULL,
    "safeReason" TEXT,
    "safeMetadataJson" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeRegisterOcrEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudBackupProfile" (
    "id" TEXT NOT NULL,
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
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastHealthCheckStatus" TEXT,
    "lastHealthCheckMessage" TEXT,
    "activatedByUserId" TEXT,
    "pausedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudBackupProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudBackupSchedule" (
    "id" TEXT NOT NULL,
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
    "nextRunAt" TIMESTAMP(3),
    "lastDueAt" TIMESTAMP(3),
    "lastStartedAt" TIMESTAMP(3),
    "lastCompletedAt" TIMESTAMP(3),
    "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudBackupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudBackupRetentionPolicy" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudBackupRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudBackupRun" (
    "id" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "triggerType" TEXT NOT NULL,
    "scheduledDueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "sourceBackupVersion" INTEGER,
    "sourceGeneratedAt" TIMESTAMP(3),
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
    "nextRetryAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessageSafe" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudBackupRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudBackupArtifact" (
    "id" TEXT NOT NULL,
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
    "uploadedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "prunedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudBackupArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudBackupVerification" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "expectedValueHash" TEXT,
    "actualValueHash" TEXT,
    "safeSummary" TEXT NOT NULL,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudBackupVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudBackupRestoreRehearsal" (
    "id" TEXT NOT NULL,
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
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudBackupRestoreRehearsal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CloudBackupEvent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT,
    "scheduleId" TEXT,
    "runId" TEXT,
    "artifactId" TEXT,
    "rehearsalId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "safeMetadataJson" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CloudBackupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicWebsiteSettings" (
    "id" TEXT NOT NULL,
    "settingsCode" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "tagline" TEXT,
    "publicSiteUrl" TEXT,
    "publicAddress" TEXT,
    "publicOfficePhone" TEXT,
    "publicOfficeEmail" TEXT,
    "publicOfficeHours" TEXT,
    "publicDirectionsUrl" TEXT,
    "portalLoginPath" TEXT NOT NULL DEFAULT '/login',
    "defaultSeoTitle" TEXT NOT NULL,
    "defaultSeoDescription" TEXT NOT NULL,
    "defaultSocialImageKey" TEXT,
    "themeConfigJson" TEXT NOT NULL DEFAULT '{}',
    "contactConfigJson" TEXT NOT NULL DEFAULT '{}',
    "socialLinksJson" TEXT,
    "mandatoryDisclosureEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewVersion" INTEGER NOT NULL DEFAULT 1,
    "approvedReviewVersion" INTEGER,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicWebsiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicWebsitePage" (
    "id" TEXT NOT NULL,
    "pageCode" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "navigationLabel" TEXT,
    "summary" TEXT,
    "draftContentJson" TEXT NOT NULL,
    "draftSeoJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewVersion" INTEGER NOT NULL DEFAULT 1,
    "approvedReviewVersion" INTEGER,
    "currentPublishedVersionId" TEXT,
    "showInNavigation" BOOLEAN NOT NULL DEFAULT false,
    "navigationOrder" INTEGER,
    "indexable" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicWebsitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicWebsitePageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "titleSnapshot" TEXT NOT NULL,
    "slugSnapshot" TEXT NOT NULL,
    "contentSnapshotJson" TEXT NOT NULL,
    "seoSnapshotJson" TEXT NOT NULL,
    "settingsSnapshotJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "publicationReason" TEXT,
    "correctionReason" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicWebsitePageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicWebsitePost" (
    "id" TEXT NOT NULL,
    "postNumber" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "draftContentJson" TEXT NOT NULL,
    "draftSeoJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewVersion" INTEGER NOT NULL DEFAULT 1,
    "approvedReviewVersion" INTEGER,
    "currentPublishedVersionId" TEXT,
    "publishAt" TIMESTAMP(3),
    "expireAt" TIMESTAMP(3),
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicWebsitePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicWebsitePostVersion" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "titleSnapshot" TEXT NOT NULL,
    "slugSnapshot" TEXT NOT NULL,
    "summarySnapshot" TEXT NOT NULL,
    "contentSnapshotJson" TEXT NOT NULL,
    "seoSnapshotJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "publicationReason" TEXT,
    "correctionReason" TEXT,
    "publishAt" TIMESTAMP(3),
    "expireAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicWebsitePostVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicWebsiteNavigationItem" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "pageId" TEXT,
    "safeExternalUrl" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "placement" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "opensNewTab" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicWebsiteNavigationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicWebsiteEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "safeReason" TEXT,
    "safeMetadataJson" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicWebsiteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionCycle" (
    "id" TEXT NOT NULL,
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
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionEnquiry" (
    "id" TEXT NOT NULL,
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
    "consentRecordedAt" TIMESTAMP(3) NOT NULL,
    "intakeChannel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "publicRequestHash" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "retentionReviewAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnquiryFollowUp" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "nextFollowUpAt" TIMESTAMP(3),
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnquiryFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolVisit" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "purpose" TEXT NOT NULL,
    "note" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "recordedByUserId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionApplication" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPLICATION_INVITED',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "invitationVersion" INTEGER NOT NULL DEFAULT 0,
    "invitationTokenHash" TEXT,
    "invitationExpiresAt" TIMESTAMP(3),
    "invitationUsedAt" TIMESTAMP(3),
    "invitationAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "invitationAttemptLimit" INTEGER NOT NULL DEFAULT 8,
    "invitationResendCount" INTEGER NOT NULL DEFAULT 0,
    "invitationLastIssuedAt" TIMESTAMP(3),
    "declarationVersion" TEXT,
    "declarationAcceptedAt" TIMESTAMP(3),
    "requestedInfo" TEXT,
    "requestedInfoAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "retentionReviewAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionApplicationVersion" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "snapshotSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionApplicationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicantChild" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "desiredAcademicYear" TEXT NOT NULL,
    "desiredClass" TEXT NOT NULL,
    "previousSchool" TEXT,
    "previousClass" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicantChild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectiveGuardian" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "relationshipToChild" TEXT NOT NULL,
    "contactMethod" TEXT NOT NULL,
    "contactValue" TEXT NOT NULL,
    "contactHash" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProspectiveGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
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
    "backupVerifiedAt" TIMESTAMP(3),
    "retentionReviewAt" TIMESTAMP(3) NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationReview" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewVersion" INTEGER NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "assignmentType" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'ADMISSIONS_TEAM',
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "completenessJson" TEXT NOT NULL DEFAULT '{}',
    "boundedNote" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionDecision" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "decisionVersion" INTEGER NOT NULL,
    "decisionType" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionOffer" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "offerVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFERED',
    "offeredClass" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionConversion" (
    "id" TEXT NOT NULL,
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
    "convertedAt" TIMESTAMP(3) NOT NULL,
    "lineageHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionDuplicateResolution" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "candidateType" TEXT NOT NULL,
    "candidatePublicReference" TEXT NOT NULL,
    "evidenceJson" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionDuplicateResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "enquiryId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "entityVersion" INTEGER,
    "safeReason" TEXT,
    "safeMetadataJson" TEXT,
    "requestHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPolicyVersion" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "policyCode" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "prorationBasis" TEXT NOT NULL DEFAULT 'CALENDAR_DAYS',
    "unpaidLeaveRule" TEXT NOT NULL DEFAULT 'APPROVED_UNPAID_LEAVE_ONLY',
    "halfDayRule" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "defaultRoundingRule" TEXT NOT NULL DEFAULT 'NEAREST_PAISE',
    "requiredAttendanceRule" TEXT NOT NULL DEFAULT 'EXPLICIT_REQUIRED_DATES',
    "approvalReference" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructureVersion" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "structureCode" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "policyVersionId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "approvalReference" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "estimatedGrossPaise" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructureVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryComponentDefinition" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "structureVersionId" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "calculationMode" TEXT NOT NULL,
    "calculationRule" TEXT NOT NULL DEFAULT 'STANDARD',
    "defaultAmountPaise" INTEGER,
    "percentageBasisPoints" INTEGER,
    "percentageBaseCode" TEXT,
    "prorationRule" TEXT NOT NULL DEFAULT 'FULL_PERIOD',
    "roundingRule" TEXT NOT NULL DEFAULT 'NEAREST_PAISE',
    "statutoryTreatment" TEXT NOT NULL DEFAULT 'NOT_STATUTORY',
    "payslipVisible" BOOLEAN NOT NULL DEFAULT true,
    "accountingBehavior" TEXT NOT NULL DEFAULT 'PREVIEW_ONLY',
    "exportBehavior" TEXT NOT NULL DEFAULT 'ALLOWLISTED_SUMMARY',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryComponentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCompensationAssignment" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "structureVersionId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "payrollEligibleFrom" TIMESTAMP(3) NOT NULL,
    "payrollEligibleTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "endReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCompensationAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryRevision" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "previousAssignmentId" TEXT,
    "newAssignmentId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "oldGrossPaise" INTEGER NOT NULL,
    "newGrossPaise" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL,
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalaryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "periodCode" TEXT NOT NULL,
    "payrollMonth" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requiredAttendanceDatesJson" TEXT NOT NULL DEFAULT '[]',
    "inputApprovalReference" TEXT,
    "inputsLockedByUserId" TEXT,
    "inputsLockedAt" TIMESTAMP(3),
    "sourceVersion" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "policyVersionId" TEXT NOT NULL,
    "runType" TEXT NOT NULL DEFAULT 'REGULAR',
    "sequenceNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeKey" TEXT,
    "sourceRunId" TEXT,
    "manualAdjustmentsJson" TEXT NOT NULL DEFAULT '[]',
    "inputSnapshotJson" TEXT NOT NULL DEFAULT '{}',
    "exceptionsJson" TEXT NOT NULL DEFAULT '[]',
    "formulaPreviewJson" TEXT NOT NULL DEFAULT '{}',
    "financePostingStatus" TEXT NOT NULL DEFAULT 'DISABLED',
    "financePostingPreviewJson" TEXT NOT NULL DEFAULT '{}',
    "totalGrossPaise" INTEGER NOT NULL DEFAULT 0,
    "totalDeductionPaise" INTEGER NOT NULL DEFAULT 0,
    "totalReimbursementPaise" INTEGER NOT NULL DEFAULT 0,
    "totalNetPaise" INTEGER NOT NULL DEFAULT 0,
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "preparedByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "payslipsIssuedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "payslipsIssuedAt" TIMESTAMP(3),
    "reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePayrollResult" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "compensationAssignmentId" TEXT NOT NULL,
    "salaryRevisionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "eligibleDays" INTEGER NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "unpaidLeaveUnits" INTEGER NOT NULL DEFAULT 0,
    "halfDayUnits" INTEGER NOT NULL DEFAULT 0,
    "attendanceSummaryJson" TEXT NOT NULL DEFAULT '{}',
    "sourceVersionsJson" TEXT NOT NULL DEFAULT '{}',
    "formulaSnapshotJson" TEXT NOT NULL DEFAULT '{}',
    "grossPaise" INTEGER NOT NULL DEFAULT 0,
    "deductionPaise" INTEGER NOT NULL DEFAULT 0,
    "reimbursementPaise" INTEGER NOT NULL DEFAULT 0,
    "netPaise" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePayrollResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollComponentResult" (
    "id" TEXT NOT NULL,
    "employeePayrollResultId" TEXT NOT NULL,
    "componentDefinitionId" TEXT,
    "componentCode" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "baseAmountPaise" INTEGER,
    "percentageBasisPoints" INTEGER,
    "roundingRule" TEXT NOT NULL,
    "formulaText" TEXT NOT NULL,
    "sourceVersionReference" TEXT NOT NULL,
    "payslipVisible" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollComponentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryAdvance" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "advanceNumber" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "requestSource" TEXT NOT NULL DEFAULT 'STAFF_REQUEST',
    "requestedAmountPaise" INTEGER NOT NULL,
    "requestedReason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "approvedAmountPaise" INTEGER,
    "remainingBalancePaise" INTEGER NOT NULL DEFAULT 0,
    "approvalReason" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvanceRecoverySchedule" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "salaryAdvanceId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "payrollPeriodId" TEXT,
    "scheduledAmountPaise" INTEGER NOT NULL,
    "recoveredAmountPaise" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "revisionReason" TEXT,
    "employeePayrollResultId" TEXT,
    "recoveredAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvanceRecoverySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipVersion" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "employeePayrollResultId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "snapshotJson" TEXT NOT NULL,
    "snapshotSha256" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "supersedesPayslipId" TEXT,
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayslipVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityPublicKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "entityVersion" INTEGER,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "reason" TEXT,
    "safeSnapshotJson" TEXT,
    "requestKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayslipMonthAvailability" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "salaryMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "sourceType" TEXT NOT NULL DEFAULT 'HISTORICAL_RECORD',
    "existingPayslipVersionId" TEXT,
    "authorizedByUserId" TEXT NOT NULL,
    "authorizationReason" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayslipMonthAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayslipRequest" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "privateExplanation" TEXT,
    "requiredByDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "correctionOfRequestId" TEXT,
    "assignedPreparerUserId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preparationStartedAt" TIMESTAMP(3),
    "readyToIssueAt" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "retentionReviewDate" TIMESTAMP(3),
    "archiveStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "legalPolicyHold" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayslipRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayslipRequestMonth" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "salaryMonth" TEXT NOT NULL,
    "availabilitySnapshot" TEXT NOT NULL,
    "issueStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "activeOverlapKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPayslipRequestMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayslipRequestEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "entityVersion" INTEGER NOT NULL,
    "safeReason" TEXT,
    "safeMetadataJson" TEXT,
    "requestHash" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPayslipRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayslipDocumentVersion" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY_TO_ISSUE',
    "verificationReference" TEXT NOT NULL,
    "sourceStorageKey" TEXT NOT NULL,
    "sourceKeyVersion" TEXT NOT NULL,
    "sourceNonce" TEXT NOT NULL,
    "sourceAuthTag" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "sourceByteSize" INTEGER NOT NULL,
    "derivativeStorageKey" TEXT NOT NULL,
    "derivativeSha256" TEXT NOT NULL,
    "derivativeByteSize" INTEGER NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "passwordKeyVersion" TEXT NOT NULL,
    "passwordNonce" TEXT NOT NULL,
    "passwordCiphertext" TEXT NOT NULL,
    "passwordAuthTag" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "replacementReason" TEXT,
    "supersedesVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPayslipDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayslipDocumentMonth" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "requestMonthId" TEXT NOT NULL,
    "salaryMonth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPayslipDocumentMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayslipAccessEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "safeClientJson" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPayslipAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportQueue" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "queueCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "allowedAssigneeRolesJson" TEXT NOT NULL DEFAULT '[]',
    "confidentialityJson" TEXT NOT NULL DEFAULT '["STANDARD"]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCategoryPolicy" (
    "id" TEXT NOT NULL,
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
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportCategoryPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
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
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedPaperReference" TEXT,
    "categoryPolicyId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "confidentiality" TEXT NOT NULL DEFAULT 'STANDARD',
    "subject" TEXT NOT NULL,
    "originalStatement" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "acknowledgedAt" TIMESTAMP(3),
    "firstResponseAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reopenedCount" INTEGER NOT NULL DEFAULT 0,
    "complainedAboutUserId" TEXT,
    "linkedReceiptReference" TEXT,
    "linkedCorrectiveActionType" TEXT,
    "linkedCorrectiveActionReference" TEXT,
    "privacyNoticeVersion" TEXT NOT NULL,
    "consentRecordedAt" TIMESTAMP(3),
    "duplicateFingerprint" TEXT,
    "retentionReviewAt" TIMESTAMP(3) NOT NULL,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequestParticipant" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "participantType" TEXT NOT NULL,
    "userId" TEXT,
    "guardianId" TEXT,
    "staffMemberId" TEXT,
    "displayLabel" TEXT NOT NULL,
    "visibilityScope" TEXT NOT NULL DEFAULT 'REQUESTER_VISIBLE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "addedByUserId" TEXT,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequestParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequestLinkedChild" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "admissionReferenceMasked" TEXT NOT NULL,
    "childDisplaySnapshot" TEXT NOT NULL,
    "classSnapshot" TEXT,
    "guardianLinkVerified" BOOLEAN NOT NULL DEFAULT false,
    "guardianLinkVerifiedAt" TIMESTAMP(3),
    "guardianLinkVerifiedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequestLinkedChild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequestEvent" (
    "id" TEXT NOT NULL,
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
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequestMessage" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorRole" TEXT,
    "authorLabel" TEXT NOT NULL,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "correctsMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequestMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportRequestAttachment" (
    "id" TEXT NOT NULL,
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
    "backupVerifiedAt" TIMESTAMP(3),
    "retentionReviewAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportRequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAssignment" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "assigneeUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "activeKey" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportEscalation" (
    "id" TEXT NOT NULL,
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
    "escalatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportSlaSnapshot" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "categoryPolicyId" TEXT NOT NULL,
    "policyVersion" INTEGER NOT NULL,
    "acknowledgmentTargetAt" TIMESTAMP(3) NOT NULL,
    "firstResponseTargetAt" TIMESTAMP(3) NOT NULL,
    "resolutionTargetAt" TIMESTAMP(3) NOT NULL,
    "escalationTargetAt" TIMESTAMP(3) NOT NULL,
    "workingHoursPolicyJson" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "totalPausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "pauseState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportSlaSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportResolution" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "resolutionVersion" INTEGER NOT NULL,
    "resolutionCategory" TEXT NOT NULL,
    "requesterVisibleSummary" TEXT NOT NULL,
    "internalActionSummary" TEXT NOT NULL,
    "linkedActionType" TEXT,
    "linkedActionReference" TEXT,
    "resolvedByUserId" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportSatisfactionResponse" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportSatisfactionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAccessEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT,
    "actorUserId" TEXT,
    "sourceHash" TEXT,
    "identifierHash" TEXT,
    "eventType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "safeMetadataJson" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAccessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDepartureRequest" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "reasonCategory" TEXT NOT NULL,
    "reasonDetails" TEXT,
    "departureType" TEXT NOT NULL DEFAULT 'EARLY_DEPARTURE',
    "calendarBasisJson" TEXT NOT NULL,
    "attendancePolicySnapshotJson" TEXT NOT NULL DEFAULT '{"policy":"GOVERNED_ATTENDANCE_CORRECTION_REQUIRED","version":"SAFE_EXIT_1A"}',
    "attendanceReconciliationRequired" BOOLEAN NOT NULL DEFAULT true,
    "attendanceReconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "intendedHandoverMethod" TEXT NOT NULL,
    "intendedDepartureAt" TIMESTAMP(3) NOT NULL,
    "temporaryReturnRequired" BOOLEAN NOT NULL DEFAULT false,
    "expectedReturnAt" TIMESTAMP(3),
    "returnNotificationRequired" BOOLEAN NOT NULL DEFAULT true,
    "overdueEscalatedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "consentState" TEXT NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedHandoverMethod" TEXT,
    "approvedRecipientName" TEXT,
    "approvedRelationship" TEXT,
    "approvedContactMasked" TEXT,
    "parentAuthorisationEvidence" TEXT,
    "verificationReference" TEXT,
    "approvedDepartureAt" TIMESTAMP(3),
    "approvalExpiresAt" TIMESTAMP(3),
    "activeCheckoutKey" TEXT,
    "emergencyOverride" BOOLEAN NOT NULL DEFAULT false,
    "restricted" BOOLEAN NOT NULL DEFAULT false,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByRole" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "rejectedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "checkedOutByUserId" TEXT,
    "returnedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDepartureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDepartureConsentEvidence" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "guardianId" TEXT,
    "guardianLinkSnapshotHash" TEXT,
    "contactMasked" TEXT,
    "telephoneAttemptSummary" TEXT,
    "witnessUserId" TEXT,
    "supervisorUserId" TEXT,
    "privateDocumentReference" TEXT,
    "standingAuthorizationKey" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByRole" TEXT NOT NULL,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDepartureConsentEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentStandingDepartureAuthorization" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "seriesKey" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "allowsSelfDeparture" BOOLEAN NOT NULL DEFAULT false,
    "eligibleClassSnapshot" TEXT NOT NULL,
    "allowedDaysJson" TEXT NOT NULL,
    "allowedStartMinute" INTEGER NOT NULL,
    "allowedEndMinute" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3) NOT NULL,
    "conditions" TEXT,
    "departurePattern" TEXT NOT NULL DEFAULT 'POLICY_DEFINED_SELF_DEPARTURE',
    "emergencyContactMasked" TEXT NOT NULL DEFAULT 'masked',
    "guardianApprovalMethod" TEXT NOT NULL,
    "guardianApprovedAt" TIMESTAMP(3) NOT NULL,
    "approvedByUserId" TEXT,
    "approvedByRole" TEXT,
    "approvedAt" TIMESTAMP(3),
    "supersedesPublicKey" TEXT,
    "revocationReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentStandingDepartureAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGatePass" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "manualCodeHash" TEXT NOT NULL,
    "manualCodeLastTwo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "approvedSnapshotHash" TEXT NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "issuedByRole" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "consumedByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGatePass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDepartureHandover" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "handoverMethod" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "contactMasked" TEXT,
    "parentAuthorisationEvidence" TEXT NOT NULL,
    "verificationReference" TEXT,
    "verifiedByUserId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDepartureHandover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDepartureEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "entityVersion" INTEGER NOT NULL,
    "reason" TEXT,
    "safeMetadataJson" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDepartureEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDepartureCorrectionEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "correctedFieldCode" TEXT NOT NULL,
    "priorValueSafe" TEXT,
    "correctedValueSafe" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByRole" TEXT NOT NULL,
    "expectedRequestVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDepartureCorrectionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCampusPresenceEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestId" TEXT,
    "eventType" TEXT NOT NULL,
    "schoolDateKey" TEXT NOT NULL,
    "locationLabel" TEXT,
    "handoverMethod" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentCampusPresenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDepartureIncident" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestId" TEXT,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastConfirmedLocation" TEXT,
    "lastConfirmedAt" TIMESTAMP(3),
    "locatedAt" TIMESTAMP(3),
    "restricted" BOOLEAN NOT NULL DEFAULT true,
    "linkedSupportRequestKey" TEXT,
    "reportedByUserId" TEXT NOT NULL,
    "confirmedByUserId" TEXT,
    "closedByUserId" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDepartureIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDepartureIncidentAction" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "outcome" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByRole" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDepartureIncidentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDepartureNotificationOutbox" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "recipientGuardianId" TEXT,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "minimalMessageCode" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "providerReferenceSafe" TEXT,
    "failureCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDepartureNotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDepartureFallbackTask" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reasonCode" TEXT NOT NULL,
    "assignedRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,

    CONSTRAINT "StudentDepartureFallbackTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppPushSubscription" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "providerMode" TEXT NOT NULL DEFAULT 'TEST_SINK',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "verifiedAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalCheckDefinition" (
    "id" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "protectedCritical" BOOLEAN NOT NULL DEFAULT false,
    "severityOnFailure" TEXT NOT NULL,
    "descriptionSafe" TEXT NOT NULL,
    "runbookPath" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalCheckDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalCheckRun" (
    "id" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "summarySafe" TEXT NOT NULL,
    "evidenceSummaryJson" TEXT,
    "errorFingerprint" TEXT,
    "durationMs" INTEGER,
    "actorUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalCheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalMetricSnapshot" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT,
    "domain" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "metadataSafeJson" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalMetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalAlert" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "checkKey" TEXT,
    "domain" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "titleSafe" TEXT NOT NULL,
    "evidenceSummarySafe" TEXT NOT NULL,
    "runbookPath" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "acknowledgedByUserId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "silencedByUserId" TEXT,
    "silencedAt" TIMESTAMP(3),
    "silencedUntil" TIMESTAMP(3),
    "silenceReasonSafe" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionSummarySafe" TEXT,
    "closedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalAlertEvent" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "notesSafe" TEXT,
    "actorUserId" TEXT,
    "occurrence" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalAlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalIncident" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "alertId" TEXT,
    "domain" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "titleSafe" TEXT NOT NULL,
    "summarySafe" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "runbookPath" TEXT NOT NULL,
    "mitigationSafe" TEXT,
    "resolutionSummarySafe" TEXT,
    "postIncidentSummarySafe" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalIncidentEvent" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "notesSafe" TEXT,
    "actorUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalIncidentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWindow" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "checkKeysJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "reasonSafe" TEXT NOT NULL,
    "expectedImpactSafe" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "plannedStartAt" TIMESTAMP(3) NOT NULL,
    "plannedEndAt" TIMESTAMP(3) NOT NULL,
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceWindowEvent" (
    "id" TEXT NOT NULL,
    "maintenanceWindowId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "notesSafe" TEXT,
    "actorUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceWindowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseManifest" (
    "id" TEXT NOT NULL,
    "releaseVersion" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "gitCommit" TEXT NOT NULL,
    "buildId" TEXT NOT NULL,
    "migrationVersion" TEXT NOT NULL,
    "backupVersion" INTEGER NOT NULL,
    "pwaBuildId" TEXT NOT NULL,
    "applicationSchemaId" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientVersionPolicy" (
    "id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "minimumSupportedVersion" TEXT NOT NULL,
    "updateAvailableVersion" TEXT,
    "updateMessageSafe" TEXT,
    "enforcementMode" TEXT NOT NULL DEFAULT 'ADVISORY',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientVersionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackgroundJobRun" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "safeErrorFingerprint" TEXT,
    "summarySafe" TEXT NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminDiaryEntry" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "notesFormat" TEXT NOT NULL DEFAULT 'PLAIN_STRUCTURED',
    "notes" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "contextModule" TEXT,
    "contextReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "followUpDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperAdminDiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminTask" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TO_DO',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dueTime" TEXT,
    "reminderAt" TIMESTAMP(3),
    "category" TEXT NOT NULL,
    "linkedModule" TEXT,
    "linkedEntityType" TEXT,
    "linkedEntityReference" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperAdminTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminContact" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "category" TEXT NOT NULL,
    "phone" TEXT,
    "alternatePhone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "preferred" BOOLEAN NOT NULL DEFAULT false,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "lastContactDate" TIMESTAMP(3),
    "nextFollowUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperAdminContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminWorkAudit" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityPublicKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "safeMetadataJson" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminWorkAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportVehicle" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "registrationCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "directionMode" TEXT NOT NULL DEFAULT 'BOTH',
    "vehicleId" TEXT NOT NULL,
    "driverStaffMemberId" TEXT,
    "attendantStaffMemberId" TEXT,
    "capacity" INTEGER NOT NULL,
    "allocatedSeats" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportStop" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "approvedReference" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportRouteStop" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timingReference" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportRouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportStudentAssignment" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activeStudentId" TEXT,
    "routeId" TEXT NOT NULL,
    "pickupRouteStopId" TEXT NOT NULL,
    "dropRouteStopId" TEXT NOT NULL,
    "routeCodeSnapshot" TEXT NOT NULL,
    "routeNameSnapshot" TEXT NOT NULL,
    "pickupStopSnapshot" TEXT NOT NULL,
    "pickupTimingSnapshot" TEXT,
    "dropStopSnapshot" TEXT NOT NULL,
    "dropTimingSnapshot" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changeReason" TEXT NOT NULL,
    "replacesAssignmentId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportStudentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportAuditEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityPublicKey" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "safeMetadataJson" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeteriaCatalogItem" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CafeteriaCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeteriaMenu" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "menuDate" TIMESTAMP(3) NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "mealPlanName" TEXT NOT NULL DEFAULT 'STANDARD',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CafeteriaMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeteriaMenuItem" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "mealSlot" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CafeteriaMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeteriaStudentEnrollment" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activeStudentId" TEXT,
    "mealPlanName" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changeReason" TEXT NOT NULL,
    "replacesEnrollmentId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CafeteriaStudentEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeteriaMealRecord" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "serviceDateKey" TEXT NOT NULL,
    "mealSlot" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "idempotencyKey" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByRole" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CafeteriaMealRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CafeteriaAuditEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityPublicKey" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "safeMetadataJson" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CafeteriaAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMediaAlbum" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE_LEADERSHIP',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewStatus" TEXT NOT NULL DEFAULT 'NOT_SUBMITTED',
    "publicationState" TEXT NOT NULL DEFAULT 'PRIVATE',
    "coverAssetPublicKey" TEXT,
    "retentionPolicy" TEXT NOT NULL DEFAULT 'GOVERNED_SCHOOL_MEDIA',
    "retentionReviewAt" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "unpublishedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMediaAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMediaAsset" (
    "id" TEXT NOT NULL,
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
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "caption" TEXT,
    "peopleDeclaration" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "publicationEligibility" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "publicationStatus" TEXT NOT NULL DEFAULT 'PRIVATE',
    "withdrawalState" TEXT NOT NULL DEFAULT 'NONE',
    "withdrawalReason" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "derivativeStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "recoveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "backupArtifactSha256" TEXT,
    "backupKeyVersion" TEXT,
    "backupVerifiedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMediaDerivative" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMediaDerivative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMediaStudentAssociation" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "associatedByUserId" TEXT NOT NULL,
    "associatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMediaStudentAssociation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaPublicationConsent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "guardianId" TEXT,
    "audience" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GRANTED',
    "purposeScope" TEXT NOT NULL DEFAULT 'EVENT_MEDIA_PUBLICATION',
    "wordingVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "evidenceReference" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "recordedByUserId" TEXT NOT NULL,
    "revokedByUserId" TEXT,
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaPublicationConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMediaAuditEvent" (
    "id" TEXT NOT NULL,
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
    "eventDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMediaAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentMeeting" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requesterGuardianId" TEXT,
    "academicYear" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "requestReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "mode" TEXT,
    "locationReference" TEXT,
    "onlineReference" TEXT,
    "requesterUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "scheduledByUserId" TEXT,
    "completedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancellationInternalReason" TEXT,
    "parentCancellationSummary" TEXT,
    "noShowState" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "activeRequestKey" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentMeetingPreference" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentMeetingPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentMeetingParticipant" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "participantRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendanceAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentMeetingParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentMeetingNote" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "correctsNoteId" TEXT,
    "correctionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentMeetingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentMeetingFollowUp" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "internalDescription" TEXT NOT NULL,
    "parentVisibleDescription" TEXT,
    "responsibleStaffMemberId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdByUserId" TEXT NOT NULL,
    "completedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentMeetingFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentMeetingEvent" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "safeMetadataJson" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentMeetingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncDevice" (
    "id" TEXT NOT NULL,
    "publicDeviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "publicSigningKey" TEXT NOT NULL,
    "publicKeyHash" TEXT NOT NULL,
    "keyAlgorithm" TEXT NOT NULL DEFAULT 'ECDSA_P256_SHA256',
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflineSyncDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "publicDeviceId" TEXT NOT NULL,
    "deviceKeyVersion" INTEGER NOT NULL,
    "publicKeyHash" TEXT NOT NULL,
    "challengeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineSyncChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncNonce" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflineSyncNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncMutation" (
    "id" TEXT NOT NULL,
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
    "createdClientAt" TIMESTAMP(3) NOT NULL,
    "receivedServerAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflineSyncMutation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "mutationId" TEXT,
    "actorUserId" TEXT,
    "eventType" TEXT NOT NULL,
    "safeMetadataJson" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineSyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineSyncConflictReview" (
    "id" TEXT NOT NULL,
    "mutationId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "reviewedByUserId" TEXT NOT NULL,
    "resolutionStatus" TEXT NOT NULL,
    "resolutionNote" TEXT NOT NULL,
    "replacementMutationId" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineSyncConflictReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativeAuthRequest" (
    "id" TEXT NOT NULL,
    "publicRequestId" TEXT NOT NULL,
    "challengeHash" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "pkceChallenge" TEXT NOT NULL,
    "pkceMethod" TEXT NOT NULL DEFAULT 'S256',
    "appId" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "publicDeviceId" TEXT NOT NULL,
    "publicSigningKey" TEXT NOT NULL,
    "publicKeyHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_BROWSER_AUTH',
    "userId" TEXT,
    "webSessionId" TEXT,
    "roleAssignmentId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NativeAuthRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativeAuthorizationCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "roleAssignmentId" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "authorizationVersion" INTEGER NOT NULL,
    "appId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "pkceChallenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NativeAuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativeSession" (
    "id" TEXT NOT NULL,
    "publicSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "roleAssignmentId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "authorizationVersion" INTEGER NOT NULL,
    "scopesJson" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NativeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NativeRefreshTokenHistory" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ROTATED',
    "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reusedAt" TIMESTAMP(3),

    CONSTRAINT "NativeRefreshTokenHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_admissionNo_key" ON "Student"("admissionNo");

-- CreateIndex
CREATE INDEX "Student_academicYear_idx" ON "Student"("academicYear");

-- CreateIndex
CREATE INDEX "Student_className_section_idx" ON "Student"("className", "section");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX "FeeStructure_academicYear_idx" ON "FeeStructure"("academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_academicYear_className_key" ON "FeeStructure"("academicYear", "className");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_familyShareId_key" ON "Payment"("familyShareId");

-- CreateIndex
CREATE INDEX "Payment_date_idx" ON "Payment"("date");

-- CreateIndex
CREATE INDEX "Payment_receiptNo_idx" ON "Payment"("receiptNo");

-- CreateIndex
CREATE INDEX "Payment_admissionNo_idx" ON "Payment"("admissionNo");

-- CreateIndex
CREATE INDEX "Payment_feeType_idx" ON "Payment"("feeType");

-- CreateIndex
CREATE INDEX "Payment_paymentMode_idx" ON "Payment"("paymentMode");

-- CreateIndex
CREATE INDEX "Payment_receivedAccount_idx" ON "Payment"("receivedAccount");

-- CreateIndex
CREATE INDEX "Payment_isCancelled_idx" ON "Payment"("isCancelled");

-- CreateIndex
CREATE INDEX "Payment_familyCollectionId_idx" ON "Payment"("familyCollectionId");

-- CreateIndex
CREATE INDEX "Payment_familyInstrumentId_idx" ON "Payment"("familyInstrumentId");

-- CreateIndex
CREATE INDEX "Payment_familyAllocationId_idx" ON "Payment"("familyAllocationId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyCollection_publicReference_key" ON "FamilyCollection"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyCollection_receiptReference_key" ON "FamilyCollection"("receiptReference");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyCollection_requestKey_key" ON "FamilyCollection"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyCollection_replacesCollectionId_key" ON "FamilyCollection"("replacesCollectionId");

-- CreateIndex
CREATE INDEX "FamilyCollection_payerGuardianId_collectionDate_idx" ON "FamilyCollection"("payerGuardianId", "collectionDate");

-- CreateIndex
CREATE INDEX "FamilyCollection_status_collectionDate_idx" ON "FamilyCollection"("status", "collectionDate");

-- CreateIndex
CREATE INDEX "FamilyCollection_createdByUserId_collectionDate_idx" ON "FamilyCollection"("createdByUserId", "collectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyCollectionInstrument_referenceKey_key" ON "FamilyCollectionInstrument"("referenceKey");

-- CreateIndex
CREATE INDEX "FamilyCollectionInstrument_collectionId_postingStatus_idx" ON "FamilyCollectionInstrument"("collectionId", "postingStatus");

-- CreateIndex
CREATE INDEX "FamilyCollectionInstrument_mode_postingStatus_idx" ON "FamilyCollectionInstrument"("mode", "postingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyCollectionInstrument_collectionId_ordinal_key" ON "FamilyCollectionInstrument"("collectionId", "ordinal");

-- CreateIndex
CREATE INDEX "FamilyStudentAllocation_studentId_academicYear_idx" ON "FamilyStudentAllocation"("studentId", "academicYear");

-- CreateIndex
CREATE INDEX "FamilyStudentAllocation_collectionId_orderIndex_idx" ON "FamilyStudentAllocation"("collectionId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyStudentAllocation_collectionId_studentId_academicYear_key" ON "FamilyStudentAllocation"("collectionId", "studentId", "academicYear", "installment", "feeHead");

-- CreateIndex
CREATE INDEX "AllocationInstrumentShare_instrumentId_idx" ON "AllocationInstrumentShare"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "AllocationInstrumentShare_allocationId_instrumentId_key" ON "AllocationInstrumentShare"("allocationId", "instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyReceiptVersion_publicVersionReference_key" ON "FamilyReceiptVersion"("publicVersionReference");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyReceiptVersion_supersedesVersionId_key" ON "FamilyReceiptVersion"("supersedesVersionId");

-- CreateIndex
CREATE INDEX "FamilyReceiptVersion_collectionId_status_idx" ON "FamilyReceiptVersion"("collectionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyReceiptVersion_collectionId_versionNumber_key" ON "FamilyReceiptVersion"("collectionId", "versionNumber");

-- CreateIndex
CREATE INDEX "FamilyCollectionEvent_collectionId_createdAt_idx" ON "FamilyCollectionEvent"("collectionId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyCollectionEvent_eventType_createdAt_idx" ON "FamilyCollectionEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyCollectionEvent_actorUserId_createdAt_idx" ON "FamilyCollectionEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyProviderAllocationPlan_publicKey_key" ON "FamilyProviderAllocationPlan"("publicKey");

-- CreateIndex
CREATE INDEX "FamilyProviderAllocationPlan_status_createdAt_idx" ON "FamilyProviderAllocationPlan"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyProviderAllocationPlan_collectionId_planVersion_key" ON "FamilyProviderAllocationPlan"("collectionId", "planVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptNote_receiptNo_key" ON "ReceiptNote"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "User_iamPublicKey_key" ON "User"("iamPublicKey");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_guardianId_key" ON "User"("guardianId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_guardianId_idx" ON "User"("guardianId");

-- CreateIndex
CREATE INDEX "User_lifecycleStatus_idx" ON "User"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "User_authorizationVersion_idx" ON "User"("authorizationVersion");

-- CreateIndex
CREATE INDEX "AcademicYearEnrollment_academicYear_className_section_idx" ON "AcademicYearEnrollment"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "AcademicYearEnrollment_academicYear_status_idx" ON "AcademicYearEnrollment"("academicYear", "status");

-- CreateIndex
CREATE INDEX "AcademicYearEnrollment_studentId_createdAt_idx" ON "AcademicYearEnrollment"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYearEnrollment_studentId_academicYear_key" ON "AcademicYearEnrollment"("studentId", "academicYear");

-- CreateIndex
CREATE INDEX "StudentProgressionDecision_studentId_createdAt_idx" ON "StudentProgressionDecision"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentProgressionDecision_academicYear_decisionType_status_idx" ON "StudentProgressionDecision"("academicYear", "decisionType", "status");

-- CreateIndex
CREATE INDEX "StudentProgressionDecision_sourceEnrollmentId_idx" ON "StudentProgressionDecision"("sourceEnrollmentId");

-- CreateIndex
CREATE INDEX "StudentProgressionDecision_createdByUserId_idx" ON "StudentProgressionDecision"("createdByUserId");

-- CreateIndex
CREATE INDEX "StudentProgressionDecision_approvedByUserId_idx" ON "StudentProgressionDecision"("approvedByUserId");

-- CreateIndex
CREATE INDEX "StudentLifecycleEvent_studentId_effectiveDate_idx" ON "StudentLifecycleEvent"("studentId", "effectiveDate");

-- CreateIndex
CREATE INDEX "StudentLifecycleEvent_academicYear_eventType_idx" ON "StudentLifecycleEvent"("academicYear", "eventType");

-- CreateIndex
CREATE INDEX "StudentLifecycleEvent_approvedByUserId_idx" ON "StudentLifecycleEvent"("approvedByUserId");

-- CreateIndex
CREATE INDEX "StudentLifecycleEvent_recordedByUserId_idx" ON "StudentLifecycleEvent"("recordedByUserId");

-- CreateIndex
CREATE INDEX "StudentAttendanceSession_attendanceDate_idx" ON "StudentAttendanceSession"("attendanceDate");

-- CreateIndex
CREATE INDEX "StudentAttendanceSession_academicYear_className_section_idx" ON "StudentAttendanceSession"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "StudentAttendanceSession_status_idx" ON "StudentAttendanceSession"("status");

-- CreateIndex
CREATE INDEX "StudentAttendanceSession_operationalCalendarVersionKey_idx" ON "StudentAttendanceSession"("operationalCalendarVersionKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendanceSession_attendanceDate_className_section_a_key" ON "StudentAttendanceSession"("attendanceDate", "className", "section", "academicYear");

-- CreateIndex
CREATE INDEX "StudentAttendanceRecord_studentId_idx" ON "StudentAttendanceRecord"("studentId");

-- CreateIndex
CREATE INDEX "StudentAttendanceRecord_status_idx" ON "StudentAttendanceRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendanceRecord_sessionId_studentId_key" ON "StudentAttendanceRecord"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_iamPublicKey_key" ON "StaffMember"("iamPublicKey");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_staffCode_key" ON "StaffMember"("staffCode");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_userId_key" ON "StaffMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_timetableTeacherId_key" ON "StaffMember"("timetableTeacherId");

-- CreateIndex
CREATE INDEX "StaffMember_fullName_idx" ON "StaffMember"("fullName");

-- CreateIndex
CREATE INDEX "StaffMember_staffType_idx" ON "StaffMember"("staffType");

-- CreateIndex
CREATE INDEX "StaffMember_designation_idx" ON "StaffMember"("designation");

-- CreateIndex
CREATE INDEX "StaffMember_primarySubject_idx" ON "StaffMember"("primarySubject");

-- CreateIndex
CREATE INDEX "StaffMember_mobile_idx" ON "StaffMember"("mobile");

-- CreateIndex
CREATE INDEX "StaffMember_email_idx" ON "StaffMember"("email");

-- CreateIndex
CREATE INDEX "StaffMember_status_idx" ON "StaffMember"("status");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_staffMemberId_startDate_endDate_idx" ON "StaffLeaveRequest"("staffMemberId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_status_idx" ON "StaffLeaveRequest"("status");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_leaveType_idx" ON "StaffLeaveRequest"("leaveType");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_startDate_endDate_idx" ON "StaffLeaveRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_requestedByUserId_idx" ON "StaffLeaveRequest"("requestedByUserId");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_approverUserId_idx" ON "StaffLeaveRequest"("approverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceSession_attendanceDate_key" ON "StaffAttendanceSession"("attendanceDate");

-- CreateIndex
CREATE INDEX "StaffAttendanceSession_status_idx" ON "StaffAttendanceSession"("status");

-- CreateIndex
CREATE INDEX "StaffAttendanceRecord_staffMemberId_idx" ON "StaffAttendanceRecord"("staffMemberId");

-- CreateIndex
CREATE INDEX "StaffAttendanceRecord_status_idx" ON "StaffAttendanceRecord"("status");

-- CreateIndex
CREATE INDEX "StaffAttendanceRecord_source_idx" ON "StaffAttendanceRecord"("source");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceRecord_sessionId_staffMemberId_key" ON "StaffAttendanceRecord"("sessionId", "staffMemberId");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_assignmentDate_idx" ON "SubstituteAssignment"("assignmentDate");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_status_idx" ON "SubstituteAssignment"("status");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_absentStaffMemberId_assignmentDate_idx" ON "SubstituteAssignment"("absentStaffMemberId", "assignmentDate");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_substituteStaffMemberId_assignmentDate_idx" ON "SubstituteAssignment"("substituteStaffMemberId", "assignmentDate");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_leaveRequestId_idx" ON "SubstituteAssignment"("leaveRequestId");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_timetableAssignmentId_idx" ON "SubstituteAssignment"("timetableAssignmentId");

-- CreateIndex
CREATE INDEX "Notice_status_publishDate_idx" ON "Notice"("status", "publishDate");

-- CreateIndex
CREATE INDEX "Notice_audienceType_className_section_idx" ON "Notice"("audienceType", "className", "section");

-- CreateIndex
CREATE INDEX "Notice_expiresAt_idx" ON "Notice"("expiresAt");

-- CreateIndex
CREATE INDEX "Notice_createdById_idx" ON "Notice"("createdById");

-- CreateIndex
CREATE INDEX "Notice_updatedById_idx" ON "Notice"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_iamPublicKey_key" ON "Guardian"("iamPublicKey");

-- CreateIndex
CREATE INDEX "Guardian_displayName_idx" ON "Guardian"("displayName");

-- CreateIndex
CREATE INDEX "Guardian_primaryMobile_idx" ON "Guardian"("primaryMobile");

-- CreateIndex
CREATE INDEX "Guardian_email_idx" ON "Guardian"("email");

-- CreateIndex
CREATE INDEX "Guardian_status_idx" ON "Guardian"("status");

-- CreateIndex
CREATE INDEX "StudentGuardian_guardianId_idx" ON "StudentGuardian"("guardianId");

-- CreateIndex
CREATE INDEX "StudentGuardian_studentId_idx" ON "StudentGuardian"("studentId");

-- CreateIndex
CREATE INDEX "StudentGuardian_isPrimaryContact_idx" ON "StudentGuardian"("isPrimaryContact");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_guardianId_studentId_key" ON "StudentGuardian"("guardianId", "studentId");

-- CreateIndex
CREATE INDEX "UserAudit_action_idx" ON "UserAudit"("action");

-- CreateIndex
CREATE INDEX "UserAudit_actorUserId_idx" ON "UserAudit"("actorUserId");

-- CreateIndex
CREATE INDEX "UserAudit_targetUserId_idx" ON "UserAudit"("targetUserId");

-- CreateIndex
CREATE INDEX "UserAudit_createdAt_idx" ON "UserAudit"("createdAt");

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
CREATE UNIQUE INDEX "UserRoleAssignment_publicKey_key" ON "UserRoleAssignment"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserRoleAssignment_activeKey_key" ON "UserRoleAssignment"("activeKey");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_userId_status_validFrom_validUntil_idx" ON "UserRoleAssignment"("userId", "status", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_role_status_idx" ON "UserRoleAssignment"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionProfile_publicKey_key" ON "PermissionProfile"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionProfile_normalizedName_key" ON "PermissionProfile"("normalizedName");

-- CreateIndex
CREATE INDEX "PermissionProfile_status_name_idx" ON "PermissionProfile"("status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionProfileEntry_activeKey_key" ON "PermissionProfileEntry"("activeKey");

-- CreateIndex
CREATE INDEX "PermissionProfileEntry_profileId_status_permission_idx" ON "PermissionProfileEntry"("profileId", "status", "permission");

-- CreateIndex
CREATE INDEX "PermissionProfileEntry_permission_effect_status_idx" ON "PermissionProfileEntry"("permission", "effect", "status");

-- CreateIndex
CREATE INDEX "PermissionProfileVersion_profileId_createdAt_idx" ON "PermissionProfileVersion"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionProfileVersion_profileId_versionNumber_key" ON "PermissionProfileVersion"("profileId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionProfileAssignment_publicKey_key" ON "UserPermissionProfileAssignment"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionProfileAssignment_activeKey_key" ON "UserPermissionProfileAssignment"("activeKey");

-- CreateIndex
CREATE INDEX "UserPermissionProfileAssignment_userId_status_validFrom_val_idx" ON "UserPermissionProfileAssignment"("userId", "status", "validFrom", "validUntil");

-- CreateIndex
CREATE INDEX "UserPermissionProfileAssignment_profileId_status_idx" ON "UserPermissionProfileAssignment"("profileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_publicKey_key" ON "UserPermissionOverride"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_activeKey_key" ON "UserPermissionOverride"("activeKey");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_userId_status_permission_idx" ON "UserPermissionOverride"("userId", "status", "permission");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_permission_effect_status_idx" ON "UserPermissionOverride"("permission", "effect", "status");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_userId_createdAt_idx" ON "AuthSecurityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_actorUserId_createdAt_idx" ON "AuthSecurityEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_eventType_createdAt_idx" ON "AuthSecurityEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE INDEX "RolePermission_permission_idx" ON "RolePermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

-- CreateIndex
CREATE INDEX "Vendor_mobile_idx" ON "Vendor"("mobile");

-- CreateIndex
CREATE INDEX "Vendor_gstin_idx" ON "Vendor"("gstin");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- CreateIndex
CREATE INDEX "ExpenseCategory_status_idx" ON "ExpenseCategory"("status");

-- CreateIndex
CREATE INDEX "ExpenseCategory_parentCategoryId_idx" ON "ExpenseCategory"("parentCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseDepartment_name_key" ON "ExpenseDepartment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseDepartment_code_key" ON "ExpenseDepartment"("code");

-- CreateIndex
CREATE INDEX "ExpenseDepartment_status_idx" ON "ExpenseDepartment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseRecord_expenseNumber_key" ON "ExpenseRecord"("expenseNumber");

-- CreateIndex
CREATE INDEX "ExpenseRecord_expenseDate_idx" ON "ExpenseRecord"("expenseDate");

-- CreateIndex
CREATE INDEX "ExpenseRecord_academicYear_idx" ON "ExpenseRecord"("academicYear");

-- CreateIndex
CREATE INDEX "ExpenseRecord_vendorId_idx" ON "ExpenseRecord"("vendorId");

-- CreateIndex
CREATE INDEX "ExpenseRecord_categoryId_idx" ON "ExpenseRecord"("categoryId");

-- CreateIndex
CREATE INDEX "ExpenseRecord_departmentId_idx" ON "ExpenseRecord"("departmentId");

-- CreateIndex
CREATE INDEX "ExpenseRecord_approvalStatus_idx" ON "ExpenseRecord"("approvalStatus");

-- CreateIndex
CREATE INDEX "ExpenseRecord_paymentStatus_idx" ON "ExpenseRecord"("paymentStatus");

-- CreateIndex
CREATE INDEX "ExpensePayment_expenseRecordId_paymentDate_idx" ON "ExpensePayment"("expenseRecordId", "paymentDate");

-- CreateIndex
CREATE INDEX "ExpenseAudit_expenseRecordId_createdAt_idx" ON "ExpenseAudit"("expenseRecordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPlan_budgetNumber_key" ON "BudgetPlan"("budgetNumber");

-- CreateIndex
CREATE INDEX "BudgetPlan_academicYear_idx" ON "BudgetPlan"("academicYear");

-- CreateIndex
CREATE INDEX "BudgetPlan_status_idx" ON "BudgetPlan"("status");

-- CreateIndex
CREATE INDEX "BudgetPlan_academicYear_status_idx" ON "BudgetPlan"("academicYear", "status");

-- CreateIndex
CREATE INDEX "BudgetAllocation_budgetPlanId_idx" ON "BudgetAllocation"("budgetPlanId");

-- CreateIndex
CREATE INDEX "BudgetAllocation_categoryId_idx" ON "BudgetAllocation"("categoryId");

-- CreateIndex
CREATE INDEX "BudgetAllocation_departmentId_idx" ON "BudgetAllocation"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetAllocation_budgetPlanId_allocationKey_key" ON "BudgetAllocation"("budgetPlanId", "allocationKey");

-- CreateIndex
CREATE INDEX "BudgetRevision_budgetPlanId_status_idx" ON "BudgetRevision"("budgetPlanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetRevision_budgetPlanId_revisionNumber_key" ON "BudgetRevision"("budgetPlanId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MiscIncomeItem_itemCode_key" ON "MiscIncomeItem"("itemCode");

-- CreateIndex
CREATE INDEX "MiscIncomeItem_category_idx" ON "MiscIncomeItem"("category");

-- CreateIndex
CREATE INDEX "MiscIncomeItem_status_idx" ON "MiscIncomeItem"("status");

-- CreateIndex
CREATE INDEX "MiscIncomeRate_itemId_academicYear_status_idx" ON "MiscIncomeRate"("itemId", "academicYear", "status");

-- CreateIndex
CREATE INDEX "MiscIncomeRate_academicYear_idx" ON "MiscIncomeRate"("academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "MiscIncomeReceipt_receiptNumber_key" ON "MiscIncomeReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_receiptDate_idx" ON "MiscIncomeReceipt"("receiptDate");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_academicYear_idx" ON "MiscIncomeReceipt"("academicYear");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_studentId_idx" ON "MiscIncomeReceipt"("studentId");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_paymentMethod_idx" ON "MiscIncomeReceipt"("paymentMethod");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_receivedAccount_idx" ON "MiscIncomeReceipt"("receivedAccount");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_status_idx" ON "MiscIncomeReceipt"("status");

-- CreateIndex
CREATE INDEX "MiscIncomeReceiptLine_receiptId_idx" ON "MiscIncomeReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "MiscIncomeReceiptLine_itemId_idx" ON "MiscIncomeReceiptLine"("itemId");

-- CreateIndex
CREATE INDEX "MiscIncomeReceiptLine_rateId_idx" ON "MiscIncomeReceiptLine"("rateId");

-- CreateIndex
CREATE UNIQUE INDEX "CashBookDay_cashDate_key" ON "CashBookDay"("cashDate");

-- CreateIndex
CREATE INDEX "CashBookDay_academicYear_idx" ON "CashBookDay"("academicYear");

-- CreateIndex
CREATE INDEX "CashBookDay_status_idx" ON "CashBookDay"("status");

-- CreateIndex
CREATE INDEX "CashBookMovement_cashBookDayId_status_idx" ON "CashBookMovement"("cashBookDayId", "status");

-- CreateIndex
CREATE INDEX "CashBookMovement_movementDate_idx" ON "CashBookMovement"("movementDate");

-- CreateIndex
CREATE INDEX "CashBookMovement_movementType_idx" ON "CashBookMovement"("movementType");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryTitle_titleCode_key" ON "LibraryTitle"("titleCode");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryTitle_isbn_key" ON "LibraryTitle"("isbn");

-- CreateIndex
CREATE INDEX "LibraryTitle_title_idx" ON "LibraryTitle"("title");

-- CreateIndex
CREATE INDEX "LibraryTitle_authors_idx" ON "LibraryTitle"("authors");

-- CreateIndex
CREATE INDEX "LibraryTitle_publisherVendorId_idx" ON "LibraryTitle"("publisherVendorId");

-- CreateIndex
CREATE INDEX "LibraryTitle_status_language_idx" ON "LibraryTitle"("status", "language");

-- CreateIndex
CREATE INDEX "LibraryTitle_subject_category_idx" ON "LibraryTitle"("subject", "category");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCopy_accessionNumber_key" ON "LibraryCopy"("accessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCopy_barcodeValue_key" ON "LibraryCopy"("barcodeValue");

-- CreateIndex
CREATE INDEX "LibraryCopy_titleId_status_idx" ON "LibraryCopy"("titleId", "status");

-- CreateIndex
CREATE INDEX "LibraryCopy_condition_idx" ON "LibraryCopy"("condition");

-- CreateIndex
CREATE INDEX "LibraryCopy_shelfCode_idx" ON "LibraryCopy"("shelfCode");

-- CreateIndex
CREATE INDEX "LibraryCopy_vendorId_idx" ON "LibraryCopy"("vendorId");

-- CreateIndex
CREATE INDEX "LibraryCopy_expenseRecordId_idx" ON "LibraryCopy"("expenseRecordId");

-- CreateIndex
CREATE INDEX "LibraryCopy_acquisitionType_idx" ON "LibraryCopy"("acquisitionType");

-- CreateIndex
CREATE INDEX "LibraryCopyEvent_copyId_eventDate_idx" ON "LibraryCopyEvent"("copyId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryCopyEvent_eventType_idx" ON "LibraryCopyEvent"("eventType");

-- CreateIndex
CREATE INDEX "LibraryCopyEvent_recordedByUserId_idx" ON "LibraryCopyEvent"("recordedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryStockVerificationSession_sessionNumber_key" ON "LibraryStockVerificationSession"("sessionNumber");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationSession_academicYear_status_idx" ON "LibraryStockVerificationSession"("academicYear", "status");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationSession_verificationDate_idx" ON "LibraryStockVerificationSession"("verificationDate");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationSession_scopeType_idx" ON "LibraryStockVerificationSession"("scopeType");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryStockVerificationRecord_appliedCopyEventId_key" ON "LibraryStockVerificationRecord"("appliedCopyEventId");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationRecord_sessionId_observationStatus_idx" ON "LibraryStockVerificationRecord"("sessionId", "observationStatus");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationRecord_sessionId_resolutionStatus_idx" ON "LibraryStockVerificationRecord"("sessionId", "resolutionStatus");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationRecord_copyId_idx" ON "LibraryStockVerificationRecord"("copyId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryStockVerificationRecord_sessionId_copyId_key" ON "LibraryStockVerificationRecord"("sessionId", "copyId");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationScanEvent_sessionId_scannedAt_idx" ON "LibraryStockVerificationScanEvent"("sessionId", "scannedAt");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationScanEvent_recordId_idx" ON "LibraryStockVerificationScanEvent"("recordId");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationScanEvent_resultType_idx" ON "LibraryStockVerificationScanEvent"("resultType");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationEvent_sessionId_eventDate_idx" ON "LibraryStockVerificationEvent"("sessionId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationEvent_eventType_idx" ON "LibraryStockVerificationEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryMember_memberCode_key" ON "LibraryMember"("memberCode");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryMember_studentId_key" ON "LibraryMember"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryMember_staffMemberId_key" ON "LibraryMember"("staffMemberId");

-- CreateIndex
CREATE INDEX "LibraryMember_memberType_status_idx" ON "LibraryMember"("memberType", "status");

-- CreateIndex
CREATE INDEX "LibraryMember_joinedDate_idx" ON "LibraryMember"("joinedDate");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryPolicy_policyCode_key" ON "LibraryPolicy"("policyCode");

-- CreateIndex
CREATE INDEX "LibraryPolicy_memberType_status_priority_idx" ON "LibraryPolicy"("memberType", "status", "priority");

-- CreateIndex
CREATE INDEX "LibraryPolicy_className_status_idx" ON "LibraryPolicy"("className", "status");

-- CreateIndex
CREATE INDEX "LibraryPolicy_staffType_status_idx" ON "LibraryPolicy"("staffType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryLoan_loanNumber_key" ON "LibraryLoan"("loanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryLoan_activeCopyKey_key" ON "LibraryLoan"("activeCopyKey");

-- CreateIndex
CREATE INDEX "LibraryLoan_memberId_status_idx" ON "LibraryLoan"("memberId", "status");

-- CreateIndex
CREATE INDEX "LibraryLoan_copyId_status_idx" ON "LibraryLoan"("copyId", "status");

-- CreateIndex
CREATE INDEX "LibraryLoan_status_dueDate_idx" ON "LibraryLoan"("status", "dueDate");

-- CreateIndex
CREATE INDEX "LibraryLoan_issueDate_idx" ON "LibraryLoan"("issueDate");

-- CreateIndex
CREATE INDEX "LibraryLoan_returnedDate_idx" ON "LibraryLoan"("returnedDate");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryReservation_reservationNumber_key" ON "LibraryReservation"("reservationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryReservation_activeMemberTitleKey_key" ON "LibraryReservation"("activeMemberTitleKey");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryReservation_fulfilledLoanId_key" ON "LibraryReservation"("fulfilledLoanId");

-- CreateIndex
CREATE INDEX "LibraryReservation_titleId_status_requestedDate_createdAt_idx" ON "LibraryReservation"("titleId", "status", "requestedDate", "createdAt");

-- CreateIndex
CREATE INDEX "LibraryReservation_memberId_status_idx" ON "LibraryReservation"("memberId", "status");

-- CreateIndex
CREATE INDEX "LibraryReservation_status_expiresDate_idx" ON "LibraryReservation"("status", "expiresDate");

-- CreateIndex
CREATE INDEX "LibraryLoanEvent_loanId_eventDate_idx" ON "LibraryLoanEvent"("loanId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryLoanEvent_reservationId_eventDate_idx" ON "LibraryLoanEvent"("reservationId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryLoanEvent_memberId_eventDate_idx" ON "LibraryLoanEvent"("memberId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryLoanEvent_eventType_eventDate_idx" ON "LibraryLoanEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryIncident_incidentNumber_key" ON "LibraryIncident"("incidentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryIncident_activeCaseKey_key" ON "LibraryIncident"("activeCaseKey");

-- CreateIndex
CREATE INDEX "LibraryIncident_status_incidentType_idx" ON "LibraryIncident"("status", "incidentType");

-- CreateIndex
CREATE INDEX "LibraryIncident_loanId_status_idx" ON "LibraryIncident"("loanId", "status");

-- CreateIndex
CREATE INDEX "LibraryIncident_memberId_reportedDate_idx" ON "LibraryIncident"("memberId", "reportedDate");

-- CreateIndex
CREATE INDEX "LibraryIncident_copyId_status_idx" ON "LibraryIncident"("copyId", "status");

-- CreateIndex
CREATE INDEX "LibraryIncident_titleId_status_idx" ON "LibraryIncident"("titleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryChargeRule_ruleCode_key" ON "LibraryChargeRule"("ruleCode");

-- CreateIndex
CREATE INDEX "LibraryChargeRule_memberType_status_priority_idx" ON "LibraryChargeRule"("memberType", "status", "priority");

-- CreateIndex
CREATE INDEX "LibraryChargeRule_className_status_idx" ON "LibraryChargeRule"("className", "status");

-- CreateIndex
CREATE INDEX "LibraryChargeRule_staffType_status_idx" ON "LibraryChargeRule"("staffType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCharge_chargeNumber_key" ON "LibraryCharge"("chargeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCharge_activeOverdueLoanKey_key" ON "LibraryCharge"("activeOverdueLoanKey");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCharge_miscIncomeReceiptId_key" ON "LibraryCharge"("miscIncomeReceiptId");

-- CreateIndex
CREATE INDEX "LibraryCharge_status_chargeType_idx" ON "LibraryCharge"("status", "chargeType");

-- CreateIndex
CREATE INDEX "LibraryCharge_memberId_status_idx" ON "LibraryCharge"("memberId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_loanId_status_idx" ON "LibraryCharge"("loanId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_incidentId_status_idx" ON "LibraryCharge"("incidentId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_studentId_status_idx" ON "LibraryCharge"("studentId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_staffMemberId_status_idx" ON "LibraryCharge"("staffMemberId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_assessedDate_idx" ON "LibraryCharge"("assessedDate");

-- CreateIndex
CREATE INDEX "LibraryChargeEvent_chargeId_eventDate_idx" ON "LibraryChargeEvent"("chargeId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryChargeEvent_incidentId_eventDate_idx" ON "LibraryChargeEvent"("incidentId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryChargeEvent_eventType_eventDate_idx" ON "LibraryChargeEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "BookCatalogItem_itemCode_key" ON "BookCatalogItem"("itemCode");

-- CreateIndex
CREATE INDEX "BookCatalogItem_itemType_idx" ON "BookCatalogItem"("itemType");

-- CreateIndex
CREATE INDEX "BookCatalogItem_publisherVendorId_idx" ON "BookCatalogItem"("publisherVendorId");

-- CreateIndex
CREATE INDEX "BookCatalogItem_className_idx" ON "BookCatalogItem"("className");

-- CreateIndex
CREATE INDEX "BookCatalogItem_status_idx" ON "BookCatalogItem"("status");

-- CreateIndex
CREATE INDEX "BookCatalogRate_itemId_academicYear_status_idx" ON "BookCatalogRate"("itemId", "academicYear", "status");

-- CreateIndex
CREATE INDEX "BookCatalogRate_academicYear_idx" ON "BookCatalogRate"("academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "BookSaleReceipt_receiptNumber_key" ON "BookSaleReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_receiptDate_idx" ON "BookSaleReceipt"("receiptDate");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_academicYear_idx" ON "BookSaleReceipt"("academicYear");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_studentId_idx" ON "BookSaleReceipt"("studentId");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_paymentMethod_idx" ON "BookSaleReceipt"("paymentMethod");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_receivedAccount_idx" ON "BookSaleReceipt"("receivedAccount");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_status_idx" ON "BookSaleReceipt"("status");

-- CreateIndex
CREATE INDEX "BookSaleReceiptLine_receiptId_idx" ON "BookSaleReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "BookSaleReceiptLine_itemId_idx" ON "BookSaleReceiptLine"("itemId");

-- CreateIndex
CREATE INDEX "BookSaleReceiptLine_rateId_idx" ON "BookSaleReceiptLine"("rateId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCashSettlement_settlementDate_key" ON "BookCashSettlement"("settlementDate");

-- CreateIndex
CREATE UNIQUE INDEX "BookCashSettlement_cashBookMovementId_key" ON "BookCashSettlement"("cashBookMovementId");

-- CreateIndex
CREATE INDEX "BookCashSettlement_academicYear_idx" ON "BookCashSettlement"("academicYear");

-- CreateIndex
CREATE INDEX "BookCashSettlement_status_idx" ON "BookCashSettlement"("status");

-- CreateIndex
CREATE INDEX "PaymentAudit_paymentId_idx" ON "PaymentAudit"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAudit_changedByUserId_idx" ON "PaymentAudit"("changedByUserId");

-- CreateIndex
CREATE INDEX "PaymentAudit_action_idx" ON "PaymentAudit"("action");

-- CreateIndex
CREATE INDEX "PaymentAudit_createdAt_idx" ON "PaymentAudit"("createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_type_idx" ON "ImportBatch"("type");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE INDEX "ImportBatch_importedAt_idx" ON "ImportBatch"("importedAt");

-- CreateIndex
CREATE INDEX "ImportBatch_importedByUserId_idx" ON "ImportBatch"("importedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingBatch_publicKey_key" ON "OnboardingBatch"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingBatch_storageKey_key" ON "OnboardingBatch"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingBatch_executionIdempotencyKey_key" ON "OnboardingBatch"("executionIdempotencyKey");

-- CreateIndex
CREATE INDEX "OnboardingBatch_status_createdAt_idx" ON "OnboardingBatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OnboardingBatch_uploadedByUserId_createdAt_idx" ON "OnboardingBatch"("uploadedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "OnboardingBatch_purgeAfter_purgedAt_idx" ON "OnboardingBatch"("purgeAfter", "purgedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingBatch_uploadedByUserId_workbookSha256_bundleType_key" ON "OnboardingBatch"("uploadedByUserId", "workbookSha256", "bundleType");

-- CreateIndex
CREATE INDEX "OnboardingRowOutcome_batchId_sheetName_sourceRowNumber_idx" ON "OnboardingRowOutcome"("batchId", "sheetName", "sourceRowNumber");

-- CreateIndex
CREATE INDEX "OnboardingRowOutcome_targetRecordId_idx" ON "OnboardingRowOutcome"("targetRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingRowOutcome_batchId_entityType_importRowKey_key" ON "OnboardingRowOutcome"("batchId", "entityType", "importRowKey");

-- CreateIndex
CREATE INDEX "OnboardingAuditEvent_batchId_occurredAt_idx" ON "OnboardingAuditEvent"("batchId", "occurredAt");

-- CreateIndex
CREATE INDEX "OnboardingAuditEvent_eventType_occurredAt_idx" ON "OnboardingAuditEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingAuditEvent_batchId_sequence_key" ON "OnboardingAuditEvent"("batchId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableTeacher_shortName_key" ON "TimetableTeacher"("shortName");

-- CreateIndex
CREATE INDEX "TimetableTeacher_name_idx" ON "TimetableTeacher"("name");

-- CreateIndex
CREATE INDEX "TimetableTeacher_department_idx" ON "TimetableTeacher"("department");

-- CreateIndex
CREATE INDEX "TimetableTeacher_isActive_idx" ON "TimetableTeacher"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSubject_shortName_key" ON "TimetableSubject"("shortName");

-- CreateIndex
CREATE INDEX "TimetableSubject_name_idx" ON "TimetableSubject"("name");

-- CreateIndex
CREATE INDEX "TimetableSubject_department_idx" ON "TimetableSubject"("department");

-- CreateIndex
CREATE INDEX "TimetableSubject_isActive_idx" ON "TimetableSubject"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkAssignment_assignmentNumber_key" ON "HomeworkAssignment"("assignmentNumber");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_academicYear_className_section_idx" ON "HomeworkAssignment"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_academicYear_subjectName_idx" ON "HomeworkAssignment"("academicYear", "subjectName");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_status_assignedDate_idx" ON "HomeworkAssignment"("status", "assignedDate");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_dueDate_idx" ON "HomeworkAssignment"("dueDate");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_createdByUserId_idx" ON "HomeworkAssignment"("createdByUserId");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_timetableSubjectId_idx" ON "HomeworkAssignment"("timetableSubjectId");

-- CreateIndex
CREATE INDEX "HomeworkAssignmentEvent_assignmentId_eventDate_idx" ON "HomeworkAssignmentEvent"("assignmentId", "eventDate");

-- CreateIndex
CREATE INDEX "HomeworkAssignmentEvent_eventType_idx" ON "HomeworkAssignmentEvent"("eventType");

-- CreateIndex
CREATE INDEX "HomeworkAssignmentEvent_recordedByUserId_idx" ON "HomeworkAssignmentEvent"("recordedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkItem_publicKey_key" ON "ClassworkItem"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkItem_itemNumber_key" ON "ClassworkItem"("itemNumber");

-- CreateIndex
CREATE INDEX "ClassworkItem_academicYear_className_section_subjectName_idx" ON "ClassworkItem"("academicYear", "className", "section", "subjectName");

-- CreateIndex
CREATE INDEX "ClassworkItem_timetableSubjectId_academicYear_idx" ON "ClassworkItem"("timetableSubjectId", "academicYear");

-- CreateIndex
CREATE INDEX "ClassworkItem_status_publishedAt_idx" ON "ClassworkItem"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "ClassworkItem_createdByUserId_createdAt_idx" ON "ClassworkItem"("createdByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkItemVersion_publicKey_key" ON "ClassworkItemVersion"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkItemVersion_publishRequestKey_key" ON "ClassworkItemVersion"("publishRequestKey");

-- CreateIndex
CREATE INDEX "ClassworkItemVersion_itemId_versionStatus_idx" ON "ClassworkItemVersion"("itemId", "versionStatus");

-- CreateIndex
CREATE INDEX "ClassworkItemVersion_publishedAt_idx" ON "ClassworkItemVersion"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkItemVersion_itemId_versionNumber_key" ON "ClassworkItemVersion"("itemId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkSubmission_publicKey_key" ON "ClassworkSubmission"("publicKey");

-- CreateIndex
CREATE INDEX "ClassworkSubmission_itemId_status_lastSubmittedAt_idx" ON "ClassworkSubmission"("itemId", "status", "lastSubmittedAt");

-- CreateIndex
CREATE INDEX "ClassworkSubmission_studentId_status_updatedAt_idx" ON "ClassworkSubmission"("studentId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkSubmission_itemId_studentId_key" ON "ClassworkSubmission"("itemId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkSubmissionVersion_publicKey_key" ON "ClassworkSubmissionVersion"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkSubmissionVersion_submissionRequestKey_key" ON "ClassworkSubmissionVersion"("submissionRequestKey");

-- CreateIndex
CREATE INDEX "ClassworkSubmissionVersion_submissionId_versionStatus_idx" ON "ClassworkSubmissionVersion"("submissionId", "versionStatus");

-- CreateIndex
CREATE INDEX "ClassworkSubmissionVersion_itemVersionId_idx" ON "ClassworkSubmissionVersion"("itemVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkSubmissionVersion_submissionId_versionNumber_key" ON "ClassworkSubmissionVersion"("submissionId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkAttachment_publicKey_key" ON "ClassworkAttachment"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkAttachment_storageKey_key" ON "ClassworkAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "ClassworkAttachment_itemVersionId_createdAt_idx" ON "ClassworkAttachment"("itemVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassworkAttachment_submissionVersionId_createdAt_idx" ON "ClassworkAttachment"("submissionVersionId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassworkAttachment_recoveryStatus_createdAt_idx" ON "ClassworkAttachment"("recoveryStatus", "createdAt");

-- CreateIndex
CREATE INDEX "ClassworkAttachment_sha256_idx" ON "ClassworkAttachment"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkFeedback_publicKey_key" ON "ClassworkFeedback"("publicKey");

-- CreateIndex
CREATE INDEX "ClassworkFeedback_submissionId_createdAt_idx" ON "ClassworkFeedback"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassworkFeedback_submissionVersionId_idx" ON "ClassworkFeedback"("submissionVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassworkFeedback_submissionId_sequenceNumber_key" ON "ClassworkFeedback"("submissionId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "ClassworkAuditEvent_itemId_occurredAt_idx" ON "ClassworkAuditEvent"("itemId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClassworkAuditEvent_submissionId_occurredAt_idx" ON "ClassworkAuditEvent"("submissionId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClassworkAuditEvent_eventType_occurredAt_idx" ON "ClassworkAuditEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "ClassworkAuditEvent_actorUserId_occurredAt_idx" ON "ClassworkAuditEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExamCycle_examCode_key" ON "ExamCycle"("examCode");

-- CreateIndex
CREATE INDEX "ExamCycle_academicYear_status_idx" ON "ExamCycle"("academicYear", "status");

-- CreateIndex
CREATE INDEX "ExamCycle_startDate_endDate_idx" ON "ExamCycle"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ExamAssessment_academicYear_className_section_idx" ON "ExamAssessment"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "ExamAssessment_timetableSubjectId_idx" ON "ExamAssessment"("timetableSubjectId");

-- CreateIndex
CREATE INDEX "ExamAssessment_entryStatus_idx" ON "ExamAssessment"("entryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAssessment_examCycleId_className_section_subjectName_co_key" ON "ExamAssessment"("examCycleId", "className", "section", "subjectName", "componentName");

-- CreateIndex
CREATE INDEX "StudentMark_studentId_academicYear_idx" ON "StudentMark"("studentId", "academicYear");

-- CreateIndex
CREATE INDEX "StudentMark_entryStatus_idx" ON "StudentMark"("entryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMark_assessmentId_studentId_key" ON "StudentMark"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "StudentMarkEvent_assessmentId_eventDate_idx" ON "StudentMarkEvent"("assessmentId", "eventDate");

-- CreateIndex
CREATE INDEX "StudentMarkEvent_studentMarkId_idx" ON "StudentMarkEvent"("studentMarkId");

-- CreateIndex
CREATE INDEX "StudentMarkEvent_eventType_idx" ON "StudentMarkEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "Examination_examCode_key" ON "Examination"("examCode");

-- CreateIndex
CREATE INDEX "Examination_academicYear_status_idx" ON "Examination"("academicYear", "status");

-- CreateIndex
CREATE INDEX "Examination_startDate_endDate_idx" ON "Examination"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ExaminationClassScope_academicYear_className_section_idx" ON "ExaminationClassScope"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "ExaminationClassScope_timetableClassSectionId_idx" ON "ExaminationClassScope"("timetableClassSectionId");

-- CreateIndex
CREATE INDEX "ExaminationClassScope_status_idx" ON "ExaminationClassScope"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationClassScope_examinationId_className_section_key" ON "ExaminationClassScope"("examinationId", "className", "section");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationClassScope_examinationId_timetableClassSectionId_key" ON "ExaminationClassScope"("examinationId", "timetableClassSectionId");

-- CreateIndex
CREATE INDEX "ExaminationSchemeVersion_examinationId_classScopeId_status_idx" ON "ExaminationSchemeVersion"("examinationId", "classScopeId", "status");

-- CreateIndex
CREATE INDEX "ExaminationSchemeVersion_subjectPaperId_idx" ON "ExaminationSchemeVersion"("subjectPaperId");

-- CreateIndex
CREATE INDEX "ExaminationSchemeVersion_supersedesVersionId_idx" ON "ExaminationSchemeVersion"("supersedesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationSchemeVersion_examinationId_classScopeId_scopeKe_key" ON "ExaminationSchemeVersion"("examinationId", "classScopeId", "scopeKey", "versionNumber");

-- CreateIndex
CREATE INDEX "ExaminationComponent_schemeVersionId_isRequired_idx" ON "ExaminationComponent"("schemeVersionId", "isRequired");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationComponent_schemeVersionId_componentCode_key" ON "ExaminationComponent"("schemeVersionId", "componentCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationComponent_schemeVersionId_displayOrder_key" ON "ExaminationComponent"("schemeVersionId", "displayOrder");

-- CreateIndex
CREATE INDEX "ExamSubjectPaper_timetableSubjectId_idx" ON "ExamSubjectPaper"("timetableSubjectId");

-- CreateIndex
CREATE INDEX "ExamSubjectPaper_status_idx" ON "ExamSubjectPaper"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubjectPaper_examinationId_classScopeId_timetableSubjec_key" ON "ExamSubjectPaper"("examinationId", "classScopeId", "timetableSubjectId", "paperCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubjectPaper_examinationId_classScopeId_displayOrder_key" ON "ExamSubjectPaper"("examinationId", "classScopeId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationTimetableVersion_publicKey_key" ON "ExaminationTimetableVersion"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationTimetableVersion_currentPublicationKey_key" ON "ExaminationTimetableVersion"("currentPublicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationTimetableVersion_idempotencyKey_key" ON "ExaminationTimetableVersion"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ExaminationTimetableVersion_academicYear_className_section__idx" ON "ExaminationTimetableVersion"("academicYear", "className", "section", "status");

-- CreateIndex
CREATE INDEX "ExaminationTimetableVersion_examinationId_classScopeId_stat_idx" ON "ExaminationTimetableVersion"("examinationId", "classScopeId", "status");

-- CreateIndex
CREATE INDEX "ExaminationTimetableVersion_replacesVersionId_idx" ON "ExaminationTimetableVersion"("replacesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationTimetableVersion_examinationId_classScopeId_vers_key" ON "ExaminationTimetableVersion"("examinationId", "classScopeId", "versionNumber");

-- CreateIndex
CREATE INDEX "ExaminationTimetableRow_examDate_startTime_endTime_idx" ON "ExaminationTimetableRow"("examDate", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "ExaminationTimetableRow_subjectPaperId_idx" ON "ExaminationTimetableRow"("subjectPaperId");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationTimetableRow_timetableVersionId_subjectPaperId_key" ON "ExaminationTimetableRow"("timetableVersionId", "subjectPaperId");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationTimetableRow_timetableVersionId_displayOrder_key" ON "ExaminationTimetableRow"("timetableVersionId", "displayOrder");

-- CreateIndex
CREATE INDEX "ExaminationTimetableEvent_timetableVersionId_eventDate_idx" ON "ExaminationTimetableEvent"("timetableVersionId", "eventDate");

-- CreateIndex
CREATE INDEX "ExaminationTimetableEvent_examinationId_classScopeId_eventD_idx" ON "ExaminationTimetableEvent"("examinationId", "classScopeId", "eventDate");

-- CreateIndex
CREATE INDEX "ExaminationTimetableEvent_eventType_idx" ON "ExaminationTimetableEvent"("eventType");

-- CreateIndex
CREATE INDEX "ExamSubjectGroup_status_idx" ON "ExamSubjectGroup"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubjectGroup_examinationId_classScopeId_groupCode_key" ON "ExamSubjectGroup"("examinationId", "classScopeId", "groupCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubjectGroup_examinationId_classScopeId_displayOrder_key" ON "ExamSubjectGroup"("examinationId", "classScopeId", "displayOrder");

-- CreateIndex
CREATE INDEX "ExamSubjectGroupMember_subjectPaperId_idx" ON "ExamSubjectGroupMember"("subjectPaperId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubjectGroupMember_subjectGroupId_subjectPaperId_key" ON "ExamSubjectGroupMember"("subjectGroupId", "subjectPaperId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSubjectGroupMember_subjectGroupId_displayOrder_key" ON "ExamSubjectGroupMember"("subjectGroupId", "displayOrder");

-- CreateIndex
CREATE INDEX "GradeScaleVersion_examinationId_classScopeId_status_idx" ON "GradeScaleVersion"("examinationId", "classScopeId", "status");

-- CreateIndex
CREATE INDEX "GradeScaleVersion_supersedesVersionId_idx" ON "GradeScaleVersion"("supersedesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeScaleVersion_examinationId_classScopeId_versionNumber_key" ON "GradeScaleVersion"("examinationId", "classScopeId", "versionNumber");

-- CreateIndex
CREATE INDEX "GradeScaleBand_gradeScaleVersionId_minimumPercentage_idx" ON "GradeScaleBand"("gradeScaleVersionId", "minimumPercentage");

-- CreateIndex
CREATE UNIQUE INDEX "GradeScaleBand_gradeScaleVersionId_gradeCode_key" ON "GradeScaleBand"("gradeScaleVersionId", "gradeCode");

-- CreateIndex
CREATE UNIQUE INDEX "GradeScaleBand_gradeScaleVersionId_displayOrder_key" ON "GradeScaleBand"("gradeScaleVersionId", "displayOrder");

-- CreateIndex
CREATE INDEX "CoScholasticSchemeVersion_examinationId_classScopeId_status_idx" ON "CoScholasticSchemeVersion"("examinationId", "classScopeId", "status");

-- CreateIndex
CREATE INDEX "CoScholasticSchemeVersion_supersedesVersionId_idx" ON "CoScholasticSchemeVersion"("supersedesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "CoScholasticSchemeVersion_examinationId_classScopeId_versio_key" ON "CoScholasticSchemeVersion"("examinationId", "classScopeId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CoScholasticItem_coScholasticSchemeVersionId_itemCode_key" ON "CoScholasticItem"("coScholasticSchemeVersionId", "itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "CoScholasticItem_coScholasticSchemeVersionId_displayOrder_key" ON "CoScholasticItem"("coScholasticSchemeVersionId", "displayOrder");

-- CreateIndex
CREATE INDEX "ExamTemplateFamilyBinding_templateFamily_status_idx" ON "ExamTemplateFamilyBinding"("templateFamily", "status");

-- CreateIndex
CREATE INDEX "ExamTemplateFamilyBinding_reportCardTemplateId_idx" ON "ExamTemplateFamilyBinding"("reportCardTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamTemplateFamilyBinding_examinationId_classScopeId_versio_key" ON "ExamTemplateFamilyBinding"("examinationId", "classScopeId", "versionNumber");

-- CreateIndex
CREATE INDEX "TeacherExamAssignment_academicYear_className_section_idx" ON "TeacherExamAssignment"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "TeacherExamAssignment_staffMemberId_status_idx" ON "TeacherExamAssignment"("staffMemberId", "status");

-- CreateIndex
CREATE INDEX "TeacherExamAssignment_timetableTeacherId_idx" ON "TeacherExamAssignment"("timetableTeacherId");

-- CreateIndex
CREATE INDEX "TeacherExamAssignment_timetableAssignmentId_idx" ON "TeacherExamAssignment"("timetableAssignmentId");

-- CreateIndex
CREATE INDEX "TeacherExamAssignment_subjectPaperId_componentId_assignment_idx" ON "TeacherExamAssignment"("subjectPaperId", "componentId", "assignmentRole", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherExamAssignment_examinationId_classScopeId_subjectPap_key" ON "TeacherExamAssignment"("examinationId", "classScopeId", "subjectPaperId", "componentId", "staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ExaminationSchemeAudit_eventKey_key" ON "ExaminationSchemeAudit"("eventKey");

-- CreateIndex
CREATE INDEX "ExaminationSchemeAudit_examinationId_eventDate_idx" ON "ExaminationSchemeAudit"("examinationId", "eventDate");

-- CreateIndex
CREATE INDEX "ExaminationSchemeAudit_schemeVersionId_eventDate_idx" ON "ExaminationSchemeAudit"("schemeVersionId", "eventDate");

-- CreateIndex
CREATE INDEX "ExaminationSchemeAudit_assignmentId_eventDate_idx" ON "ExaminationSchemeAudit"("assignmentId", "eventDate");

-- CreateIndex
CREATE INDEX "ExaminationSchemeAudit_eventType_idx" ON "ExaminationSchemeAudit"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "ExamMarkSheet_currentKey_key" ON "ExamMarkSheet"("currentKey");

-- CreateIndex
CREATE UNIQUE INDEX "ExamMarkSheet_supersedesSheetId_key" ON "ExamMarkSheet"("supersedesSheetId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamMarkSheet_correctionRequestId_key" ON "ExamMarkSheet"("correctionRequestId");

-- CreateIndex
CREATE INDEX "ExamMarkSheet_examinationId_classScopeId_subjectPaperId_com_idx" ON "ExamMarkSheet"("examinationId", "classScopeId", "subjectPaperId", "componentId", "currentKey");

-- CreateIndex
CREATE INDEX "ExamMarkSheet_academicYear_className_section_status_idx" ON "ExamMarkSheet"("academicYear", "className", "section", "status");

-- CreateIndex
CREATE INDEX "ExamMarkSheet_primaryAssignmentId_status_idx" ON "ExamMarkSheet"("primaryAssignmentId", "status");

-- CreateIndex
CREATE INDEX "ExamMarkSheet_schemeVersionId_idx" ON "ExamMarkSheet"("schemeVersionId");

-- CreateIndex
CREATE INDEX "ExamMarkSheet_supersedesSheetId_idx" ON "ExamMarkSheet"("supersedesSheetId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamMarkSheet_logicalSheetKey_versionNumber_key" ON "ExamMarkSheet"("logicalSheetKey", "versionNumber");

-- CreateIndex
CREATE INDEX "ExamMarkEntry_studentId_idx" ON "ExamMarkEntry"("studentId");

-- CreateIndex
CREATE INDEX "ExamMarkEntry_entryState_idx" ON "ExamMarkEntry"("entryState");

-- CreateIndex
CREATE UNIQUE INDEX "ExamMarkEntry_sheetId_studentId_key" ON "ExamMarkEntry"("sheetId", "studentId");

-- CreateIndex
CREATE INDEX "StudentResultSnapshot_inputFingerprint_idx" ON "StudentResultSnapshot"("inputFingerprint");

-- CreateIndex
CREATE INDEX "StudentResultSnapshot_calculationRunId_idx" ON "StudentResultSnapshot"("calculationRunId");

-- CreateIndex
CREATE INDEX "StudentResultSnapshot_studentId_calculatedAt_idx" ON "StudentResultSnapshot"("studentId", "calculatedAt");

-- CreateIndex
CREATE INDEX "StudentResultSnapshot_examinationId_classScopeId_idx" ON "StudentResultSnapshot"("examinationId", "classScopeId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultSnapshot_calculationRunId_studentId_key" ON "StudentResultSnapshot"("calculationRunId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentResultSnapshot_examinationId_classScopeId_studentId__key" ON "StudentResultSnapshot"("examinationId", "classScopeId", "studentId", "snapshotVersion");

-- CreateIndex
CREATE UNIQUE INDEX "GradingScheme_schemeCode_key" ON "GradingScheme"("schemeCode");

-- CreateIndex
CREATE INDEX "GradingScheme_academicYear_reportType_status_idx" ON "GradingScheme"("academicYear", "reportType", "status");

-- CreateIndex
CREATE INDEX "GradeBand_gradingSchemeId_minimumPercentage_idx" ON "GradeBand"("gradingSchemeId", "minimumPercentage");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBand_gradingSchemeId_gradeCode_key" ON "GradeBand"("gradingSchemeId", "gradeCode");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBand_gradingSchemeId_displayOrder_key" ON "GradeBand"("gradingSchemeId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardTemplate_templateCode_key" ON "ReportCardTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "ReportCardTemplate_reportType_status_idx" ON "ReportCardTemplate"("reportType", "status");

-- CreateIndex
CREATE INDEX "ReportCardTemplate_academicYear_className_idx" ON "ReportCardTemplate"("academicYear", "className");

-- CreateIndex
CREATE INDEX "ReportCardTemplate_gradingSchemeId_idx" ON "ReportCardTemplate"("gradingSchemeId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardBatch_batchNumber_key" ON "ReportCardBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "ReportCardBatch_academicYear_className_section_idx" ON "ReportCardBatch"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "ReportCardBatch_reportType_status_idx" ON "ReportCardBatch"("reportType", "status");

-- CreateIndex
CREATE INDEX "ReportCardBatch_templateId_idx" ON "ReportCardBatch"("templateId");

-- CreateIndex
CREATE INDEX "ReportCardBatchExamSource_examCycleId_idx" ON "ReportCardBatchExamSource"("examCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardBatchExamSource_batchId_examCycleId_key" ON "ReportCardBatchExamSource"("batchId", "examCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardBatchExamSource_batchId_displayOrder_key" ON "ReportCardBatchExamSource"("batchId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StudentReportCard_reportCardNumber_key" ON "StudentReportCard"("reportCardNumber");

-- CreateIndex
CREATE INDEX "StudentReportCard_studentId_academicYear_idx" ON "StudentReportCard"("studentId", "academicYear");

-- CreateIndex
CREATE INDEX "StudentReportCard_batchId_status_idx" ON "StudentReportCard"("batchId", "status");

-- CreateIndex
CREATE INDEX "StudentReportCard_progressionDecisionId_idx" ON "StudentReportCard"("progressionDecisionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentReportCard_batchId_studentId_key" ON "StudentReportCard"("batchId", "studentId");

-- CreateIndex
CREATE INDEX "StudentReportCardVersion_reportCardId_issuedAt_idx" ON "StudentReportCardVersion"("reportCardId", "issuedAt");

-- CreateIndex
CREATE INDEX "StudentReportCardVersion_supersedesVersionId_idx" ON "StudentReportCardVersion"("supersedesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentReportCardVersion_reportCardId_versionNumber_key" ON "StudentReportCardVersion"("reportCardId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicReportDefinition_publicKey_key" ON "AcademicReportDefinition"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicReportDefinition_definitionCode_key" ON "AcademicReportDefinition"("definitionCode");

-- CreateIndex
CREATE INDEX "AcademicReportDefinition_family_status_idx" ON "AcademicReportDefinition"("family", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicReportRun_publicKey_key" ON "AcademicReportRun"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicReportRun_requestFingerprint_key" ON "AcademicReportRun"("requestFingerprint");

-- CreateIndex
CREATE INDEX "AcademicReportRun_definitionId_generatedAt_idx" ON "AcademicReportRun"("definitionId", "generatedAt");

-- CreateIndex
CREATE INDEX "AcademicReportRun_supersedesRunId_idx" ON "AcademicReportRun"("supersedesRunId");

-- CreateIndex
CREATE INDEX "AcademicReportRun_createdByUserId_generatedAt_idx" ON "AcademicReportRun"("createdByUserId", "generatedAt");

-- CreateIndex
CREATE INDEX "AcademicReportSourceReference_resultSnapshotId_idx" ON "AcademicReportSourceReference"("resultSnapshotId");

-- CreateIndex
CREATE INDEX "AcademicReportSourceReference_reportCardVersionId_idx" ON "AcademicReportSourceReference"("reportCardVersionId");

-- CreateIndex
CREATE INDEX "AcademicReportSourceReference_publicReference_idx" ON "AcademicReportSourceReference"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicReportSourceReference_reportRunId_ordinal_key" ON "AcademicReportSourceReference"("reportRunId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicReportSourceReference_reportRunId_sourceKind_source_key" ON "AcademicReportSourceReference"("reportRunId", "sourceKind", "sourceRecordId", "sourceVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicReportAuditEvent_eventKey_key" ON "AcademicReportAuditEvent"("eventKey");

-- CreateIndex
CREATE INDEX "AcademicReportAuditEvent_reportRunId_occurredAt_idx" ON "AcademicReportAuditEvent"("reportRunId", "occurredAt");

-- CreateIndex
CREATE INDEX "AcademicReportAuditEvent_eventType_occurredAt_idx" ON "AcademicReportAuditEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AcademicReportAuditEvent_actorUserId_occurredAt_idx" ON "AcademicReportAuditEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicCalendarVersion_publicKey_key" ON "AcademicCalendarVersion"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicCalendarVersion_currentPublicationKey_key" ON "AcademicCalendarVersion"("currentPublicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicCalendarVersion_idempotencyKey_key" ON "AcademicCalendarVersion"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AcademicCalendarVersion_academicYear_status_idx" ON "AcademicCalendarVersion"("academicYear", "status");

-- CreateIndex
CREATE INDEX "AcademicCalendarVersion_academicYear_scopeKey_status_idx" ON "AcademicCalendarVersion"("academicYear", "scopeKey", "status");

-- CreateIndex
CREATE INDEX "AcademicCalendarVersion_replacesVersionId_idx" ON "AcademicCalendarVersion"("replacesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicCalendarVersion_academicYear_scopeKey_versionNumber_key" ON "AcademicCalendarVersion"("academicYear", "scopeKey", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalCalendarDay_publicKey_key" ON "OperationalCalendarDay"("publicKey");

-- CreateIndex
CREATE INDEX "OperationalCalendarDay_dayDate_dayType_idx" ON "OperationalCalendarDay"("dayDate", "dayType");

-- CreateIndex
CREATE INDEX "OperationalCalendarDay_calendarVersionId_dayType_idx" ON "OperationalCalendarDay"("calendarVersionId", "dayType");

-- CreateIndex
CREATE INDEX "OperationalCalendarDay_scopeType_className_section_dayDate_idx" ON "OperationalCalendarDay"("scopeType", "className", "section", "dayDate");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalCalendarDay_calendarVersionId_dayDate_scopeKey_key" ON "OperationalCalendarDay"("calendarVersionId", "dayDate", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCalendarEvent_publicKey_key" ON "SchoolCalendarEvent"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCalendarEvent_eventNumber_key" ON "SchoolCalendarEvent"("eventNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCalendarEvent_currentPublishedVersionId_key" ON "SchoolCalendarEvent"("currentPublishedVersionId");

-- CreateIndex
CREATE INDEX "SchoolCalendarEvent_academicYear_status_idx" ON "SchoolCalendarEvent"("academicYear", "status");

-- CreateIndex
CREATE INDEX "SchoolCalendarEvent_createdAt_idx" ON "SchoolCalendarEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCalendarEventVersion_publicKey_key" ON "SchoolCalendarEventVersion"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCalendarEventVersion_currentPublicationKey_key" ON "SchoolCalendarEventVersion"("currentPublicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCalendarEventVersion_idempotencyKey_key" ON "SchoolCalendarEventVersion"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SchoolCalendarEventVersion_status_startsAt_endsAt_idx" ON "SchoolCalendarEventVersion"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "SchoolCalendarEventVersion_audienceType_className_section_s_idx" ON "SchoolCalendarEventVersion"("audienceType", "className", "section", "startsAt");

-- CreateIndex
CREATE INDEX "SchoolCalendarEventVersion_examinationTimetableVersionId_idx" ON "SchoolCalendarEventVersion"("examinationTimetableVersionId");

-- CreateIndex
CREATE INDEX "SchoolCalendarEventVersion_replacesVersionId_idx" ON "SchoolCalendarEventVersion"("replacesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolCalendarEventVersion_eventId_versionNumber_key" ON "SchoolCalendarEventVersion"("eventId", "versionNumber");

-- CreateIndex
CREATE INDEX "AcademicCalendarAuditEvent_calendarVersionId_eventDate_idx" ON "AcademicCalendarAuditEvent"("calendarVersionId", "eventDate");

-- CreateIndex
CREATE INDEX "AcademicCalendarAuditEvent_schoolEventId_eventDate_idx" ON "AcademicCalendarAuditEvent"("schoolEventId", "eventDate");

-- CreateIndex
CREATE INDEX "AcademicCalendarAuditEvent_eventVersionId_eventDate_idx" ON "AcademicCalendarAuditEvent"("eventVersionId", "eventDate");

-- CreateIndex
CREATE INDEX "AcademicCalendarAuditEvent_eventType_eventDate_idx" ON "AcademicCalendarAuditEvent"("eventType", "eventDate");

-- CreateIndex
CREATE INDEX "StudentReportCardEvent_reportCardId_eventDate_idx" ON "StudentReportCardEvent"("reportCardId", "eventDate");

-- CreateIndex
CREATE INDEX "StudentReportCardEvent_versionId_idx" ON "StudentReportCardEvent"("versionId");

-- CreateIndex
CREATE INDEX "StudentReportCardEvent_eventType_idx" ON "StudentReportCardEvent"("eventType");

-- CreateIndex
CREATE INDEX "TimetableClassSection_academicYear_idx" ON "TimetableClassSection"("academicYear");

-- CreateIndex
CREATE INDEX "TimetableClassSection_groupName_idx" ON "TimetableClassSection"("groupName");

-- CreateIndex
CREATE INDEX "TimetableClassSection_isActive_idx" ON "TimetableClassSection"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableClassSection_academicYear_className_section_key" ON "TimetableClassSection"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "TimetablePeriodTemplate_academicYear_groupName_dayOfWeek_idx" ON "TimetablePeriodTemplate"("academicYear", "groupName", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePeriodTemplate_academicYear_groupName_dayOfWeek_so_key" ON "TimetablePeriodTemplate"("academicYear", "groupName", "dayOfWeek", "sortOrder");

-- CreateIndex
CREATE INDEX "TimetableAssignment_academicYear_idx" ON "TimetableAssignment"("academicYear");

-- CreateIndex
CREATE INDEX "TimetableAssignment_classSectionId_idx" ON "TimetableAssignment"("classSectionId");

-- CreateIndex
CREATE INDEX "TimetableAssignment_subjectId_idx" ON "TimetableAssignment"("subjectId");

-- CreateIndex
CREATE INDEX "TimetableAssignment_teacherId_idx" ON "TimetableAssignment"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableAssignment_academicYear_classSectionId_subjectId_t_key" ON "TimetableAssignment"("academicYear", "classSectionId", "subjectId", "teacherId");

-- CreateIndex
CREATE INDEX "TimetableTeacherUnavailability_teacherId_idx" ON "TimetableTeacherUnavailability"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableTeacherUnavailability_teacherId_dayOfWeek_periodNu_key" ON "TimetableTeacherUnavailability"("teacherId", "dayOfWeek", "periodNumber");

-- CreateIndex
CREATE INDEX "TimetableFixedPeriod_academicYear_idx" ON "TimetableFixedPeriod"("academicYear");

-- CreateIndex
CREATE INDEX "TimetableFixedPeriod_classSectionId_idx" ON "TimetableFixedPeriod"("classSectionId");

-- CreateIndex
CREATE INDEX "TimetableFixedPeriod_teacherId_idx" ON "TimetableFixedPeriod"("teacherId");

-- CreateIndex
CREATE INDEX "TimetableFixedPeriod_subjectId_idx" ON "TimetableFixedPeriod"("subjectId");

-- CreateIndex
CREATE INDEX "TimetableFixedPeriod_dayOfWeek_periodNumber_idx" ON "TimetableFixedPeriod"("dayOfWeek", "periodNumber");

-- CreateIndex
CREATE INDEX "TimetableDraft_academicYear_idx" ON "TimetableDraft"("academicYear");

-- CreateIndex
CREATE INDEX "TimetableDraft_status_idx" ON "TimetableDraft"("status");

-- CreateIndex
CREATE INDEX "TimetableDraft_createdByUserId_idx" ON "TimetableDraft"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableDraft_academicYear_name_key" ON "TimetableDraft"("academicYear", "name");

-- CreateIndex
CREATE INDEX "TimetableEntry_draftId_idx" ON "TimetableEntry"("draftId");

-- CreateIndex
CREATE INDEX "TimetableEntry_academicYear_idx" ON "TimetableEntry"("academicYear");

-- CreateIndex
CREATE INDEX "TimetableEntry_teacherId_dayOfWeek_periodNumber_idx" ON "TimetableEntry"("teacherId", "dayOfWeek", "periodNumber");

-- CreateIndex
CREATE INDEX "TimetableEntry_classSectionId_idx" ON "TimetableEntry"("classSectionId");

-- CreateIndex
CREATE INDEX "TimetableEntry_assignmentId_idx" ON "TimetableEntry"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableEntry_draftId_classSectionId_dayOfWeek_periodNumbe_key" ON "TimetableEntry"("draftId", "classSectionId", "dayOfWeek", "periodNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAnalyticsReviewCycle_cycleCode_key" ON "TeacherAnalyticsReviewCycle"("cycleCode");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsReviewCycle_academicYear_status_idx" ON "TeacherAnalyticsReviewCycle"("academicYear", "status");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsReviewCycle_periodStart_periodEnd_idx" ON "TeacherAnalyticsReviewCycle"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsSnapshot_staffMemberId_academicYear_idx" ON "TeacherAnalyticsSnapshot"("staffMemberId", "academicYear");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsSnapshot_snapshotHash_idx" ON "TeacherAnalyticsSnapshot"("snapshotHash");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAnalyticsSnapshot_reviewCycleId_staffMemberId_key" ON "TeacherAnalyticsSnapshot"("reviewCycleId", "staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAnalyticsReview_snapshotId_key" ON "TeacherAnalyticsReview"("snapshotId");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsReview_status_idx" ON "TeacherAnalyticsReview"("status");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsReview_nextReviewDate_idx" ON "TeacherAnalyticsReview"("nextReviewDate");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsEvent_reviewCycleId_eventDate_idx" ON "TeacherAnalyticsEvent"("reviewCycleId", "eventDate");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsEvent_snapshotId_idx" ON "TeacherAnalyticsEvent"("snapshotId");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsEvent_reviewId_idx" ON "TeacherAnalyticsEvent"("reviewId");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsEvent_eventType_idx" ON "TeacherAnalyticsEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateNumberSeries_seriesCode_key" ON "CertificateNumberSeries"("seriesCode");

-- CreateIndex
CREATE INDEX "CertificateNumberSeries_certificateType_academicYear_status_idx" ON "CertificateNumberSeries"("certificateType", "academicYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateTemplate_templateCode_key" ON "CertificateTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "CertificateTemplate_certificateType_academicYear_status_idx" ON "CertificateTemplate"("certificateType", "academicYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCertificateRequest_requestNumber_key" ON "StudentCertificateRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "StudentCertificateRequest_studentId_createdAt_idx" ON "StudentCertificateRequest"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentCertificateRequest_academicYear_certificateType_stat_idx" ON "StudentCertificateRequest"("academicYear", "certificateType", "status");

-- CreateIndex
CREATE INDEX "StudentCertificateRequest_applicantGuardianId_createdAt_idx" ON "StudentCertificateRequest"("applicantGuardianId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCertificate_certificateNumber_key" ON "StudentCertificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "StudentCertificate_studentId_createdAt_idx" ON "StudentCertificate"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentCertificate_requestId_idx" ON "StudentCertificate"("requestId");

-- CreateIndex
CREATE INDEX "StudentCertificate_academicYear_certificateType_status_idx" ON "StudentCertificate"("academicYear", "certificateType", "status");

-- CreateIndex
CREATE INDEX "StudentCertificate_templateId_idx" ON "StudentCertificate"("templateId");

-- CreateIndex
CREATE INDEX "StudentCertificateVersion_certificateNumber_idx" ON "StudentCertificateVersion"("certificateNumber");

-- CreateIndex
CREATE INDEX "StudentCertificateVersion_supersedesVersionId_idx" ON "StudentCertificateVersion"("supersedesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCertificateVersion_certificateId_versionNumber_key" ON "StudentCertificateVersion"("certificateId", "versionNumber");

-- CreateIndex
CREATE INDEX "StudentCertificateEvent_requestId_eventDate_idx" ON "StudentCertificateEvent"("requestId", "eventDate");

-- CreateIndex
CREATE INDEX "StudentCertificateEvent_certificateId_eventDate_idx" ON "StudentCertificateEvent"("certificateId", "eventDate");

-- CreateIndex
CREATE INDEX "StudentCertificateEvent_versionId_idx" ON "StudentCertificateEvent"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageTemplate_templateCode_key" ON "ClassXPackageTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "ClassXPackageTemplate_academicYear_status_idx" ON "ClassXPackageTemplate"("academicYear", "status");

-- CreateIndex
CREATE INDEX "ClassXPackageTemplate_packageType_status_idx" ON "ClassXPackageTemplate"("packageType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXDocumentPackage_packageNumber_key" ON "ClassXDocumentPackage"("packageNumber");

-- CreateIndex
CREATE INDEX "ClassXDocumentPackage_studentId_createdAt_idx" ON "ClassXDocumentPackage"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassXDocumentPackage_academicYear_status_idx" ON "ClassXDocumentPackage"("academicYear", "status");

-- CreateIndex
CREATE INDEX "ClassXDocumentPackage_requestSource_createdAt_idx" ON "ClassXDocumentPackage"("requestSource", "createdAt");

-- CreateIndex
CREATE INDEX "ClassXDocumentPackage_applicantGuardianId_createdAt_idx" ON "ClassXDocumentPackage"("applicantGuardianId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassXPackageDocumentItem_packageId_status_idx" ON "ClassXPackageDocumentItem"("packageId", "status");

-- CreateIndex
CREATE INDEX "ClassXPackageDocumentItem_itemType_status_idx" ON "ClassXPackageDocumentItem"("itemType", "status");

-- CreateIndex
CREATE INDEX "ClassXPackageDocumentItem_linkedStudentCertificateId_idx" ON "ClassXPackageDocumentItem"("linkedStudentCertificateId");

-- CreateIndex
CREATE INDEX "ClassXPackageDocumentItem_linkedStudentCertificateVersionId_idx" ON "ClassXPackageDocumentItem"("linkedStudentCertificateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageDocumentItem_packageId_itemKey_key" ON "ClassXPackageDocumentItem"("packageId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageChargeRule_ruleCode_key" ON "ClassXPackageChargeRule"("ruleCode");

-- CreateIndex
CREATE INDEX "ClassXPackageChargeRule_academicYear_packageType_status_idx" ON "ClassXPackageChargeRule"("academicYear", "packageType", "status");

-- CreateIndex
CREATE INDEX "ClassXPackageChargeRule_status_effectiveFrom_effectiveTo_idx" ON "ClassXPackageChargeRule"("status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageCharge_packageId_key" ON "ClassXPackageCharge"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageCharge_chargeCode_key" ON "ClassXPackageCharge"("chargeCode");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageCharge_linkedMiscIncomeReceiptId_key" ON "ClassXPackageCharge"("linkedMiscIncomeReceiptId");

-- CreateIndex
CREATE INDEX "ClassXPackageCharge_status_createdAt_idx" ON "ClassXPackageCharge"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClassXPackageCharge_chargeRuleId_idx" ON "ClassXPackageCharge"("chargeRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageHandover_handoverNumber_key" ON "ClassXPackageHandover"("handoverNumber");

-- CreateIndex
CREATE INDEX "ClassXPackageHandover_packageId_handoverDate_idx" ON "ClassXPackageHandover"("packageId", "handoverDate");

-- CreateIndex
CREATE INDEX "ClassXPackageEvent_packageId_eventDate_idx" ON "ClassXPackageEvent"("packageId", "eventDate");

-- CreateIndex
CREATE INDEX "ClassXPackageEvent_documentItemId_idx" ON "ClassXPackageEvent"("documentItemId");

-- CreateIndex
CREATE INDEX "ClassXPackageEvent_chargeId_idx" ON "ClassXPackageEvent"("chargeId");

-- CreateIndex
CREATE INDEX "ClassXPackageEvent_handoverId_idx" ON "ClassXPackageEvent"("handoverId");

-- CreateIndex
CREATE INDEX "ClassXPackageEvent_eventType_eventDate_idx" ON "ClassXPackageEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCardNumberSeries_seriesCode_key" ON "IdentityCardNumberSeries"("seriesCode");

-- CreateIndex
CREATE INDEX "IdentityCardNumberSeries_cardType_academicYear_status_idx" ON "IdentityCardNumberSeries"("cardType", "academicYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCardTemplate_templateCode_key" ON "IdentityCardTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "IdentityCardTemplate_cardType_academicYear_status_idx" ON "IdentityCardTemplate"("cardType", "academicYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCardBatch_batchNumber_key" ON "IdentityCardBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "IdentityCardBatch_cardType_academicYear_status_idx" ON "IdentityCardBatch"("cardType", "academicYear", "status");

-- CreateIndex
CREATE INDEX "IdentityCardBatch_templateId_idx" ON "IdentityCardBatch"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCard_cardNumber_key" ON "IdentityCard"("cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCard_replacesCardId_key" ON "IdentityCard"("replacesCardId");

-- CreateIndex
CREATE INDEX "IdentityCard_cardType_academicYear_status_idx" ON "IdentityCard"("cardType", "academicYear", "status");

-- CreateIndex
CREATE INDEX "IdentityCard_studentId_academicYear_status_idx" ON "IdentityCard"("studentId", "academicYear", "status");

-- CreateIndex
CREATE INDEX "IdentityCard_staffMemberId_academicYear_status_idx" ON "IdentityCard"("staffMemberId", "academicYear", "status");

-- CreateIndex
CREATE INDEX "IdentityCard_batchId_idx" ON "IdentityCard"("batchId");

-- CreateIndex
CREATE INDEX "IdentityCard_templateId_idx" ON "IdentityCard"("templateId");

-- CreateIndex
CREATE INDEX "IdentityCard_numberSeriesId_idx" ON "IdentityCard"("numberSeriesId");

-- CreateIndex
CREATE INDEX "IdentityCardVersion_cardNumber_idx" ON "IdentityCardVersion"("cardNumber");

-- CreateIndex
CREATE INDEX "IdentityCardVersion_supersedesVersionId_idx" ON "IdentityCardVersion"("supersedesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCardVersion_identityCardId_versionNumber_key" ON "IdentityCardVersion"("identityCardId", "versionNumber");

-- CreateIndex
CREATE INDEX "IdentityCardEvent_batchId_eventDate_idx" ON "IdentityCardEvent"("batchId", "eventDate");

-- CreateIndex
CREATE INDEX "IdentityCardEvent_identityCardId_eventDate_idx" ON "IdentityCardEvent"("identityCardId", "eventDate");

-- CreateIndex
CREATE INDEX "IdentityCardEvent_versionId_idx" ON "IdentityCardEvent"("versionId");

-- CreateIndex
CREATE INDEX "IdentityCardEvent_eventType_eventDate_idx" ON "IdentityCardEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_templateCode_key" ON "NotificationTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "NotificationTemplate_status_category_idx" ON "NotificationTemplate"("status", "category");

-- CreateIndex
CREATE INDEX "NotificationTemplate_createdAt_idx" ON "NotificationTemplate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationCampaign_campaignNumber_key" ON "NotificationCampaign"("campaignNumber");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationCampaign_correctionOfCampaignId_key" ON "NotificationCampaign"("correctionOfCampaignId");

-- CreateIndex
CREATE INDEX "NotificationCampaign_status_scheduledFor_idx" ON "NotificationCampaign"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationCampaign_category_priority_idx" ON "NotificationCampaign"("category", "priority");

-- CreateIndex
CREATE INDEX "NotificationCampaign_audienceType_idx" ON "NotificationCampaign"("audienceType");

-- CreateIndex
CREATE INDEX "NotificationCampaign_createdByUserId_createdAt_idx" ON "NotificationCampaign"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationCampaign_expiresAt_idx" ON "NotificationCampaign"("expiresAt");

-- CreateIndex
CREATE INDEX "NotificationCampaign_correctionOfCampaignId_idx" ON "NotificationCampaign"("correctionOfCampaignId");

-- CreateIndex
CREATE INDEX "NotificationRecipient_userId_deliveryStatus_availableAt_idx" ON "NotificationRecipient"("userId", "deliveryStatus", "availableAt");

-- CreateIndex
CREATE INDEX "NotificationRecipient_campaignId_readAt_idx" ON "NotificationRecipient"("campaignId", "readAt");

-- CreateIndex
CREATE INDEX "NotificationRecipient_campaignId_acknowledgedAt_idx" ON "NotificationRecipient"("campaignId", "acknowledgedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_campaignId_userId_key" ON "NotificationRecipient"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "NotificationSkippedRecipient_campaignId_reasonCode_idx" ON "NotificationSkippedRecipient"("campaignId", "reasonCode");

-- CreateIndex
CREATE INDEX "NotificationEvent_templateId_eventDate_idx" ON "NotificationEvent"("templateId", "eventDate");

-- CreateIndex
CREATE INDEX "NotificationEvent_campaignId_eventDate_idx" ON "NotificationEvent"("campaignId", "eventDate");

-- CreateIndex
CREATE INDEX "NotificationEvent_recipientId_eventDate_idx" ON "NotificationEvent"("recipientId", "eventDate");

-- CreateIndex
CREATE INDEX "NotificationEvent_eventType_eventDate_idx" ON "NotificationEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppIntegrationProfile_profileCode_key" ON "WhatsAppIntegrationProfile"("profileCode");

-- CreateIndex
CREATE INDEX "WhatsAppIntegrationProfile_mode_status_idx" ON "WhatsAppIntegrationProfile"("mode", "status");

-- CreateIndex
CREATE INDEX "WhatsAppIntegrationProfile_liveSendingEnabled_idx" ON "WhatsAppIntegrationProfile"("liveSendingEnabled");

-- CreateIndex
CREATE INDEX "WhatsAppConsent_subjectType_guardianId_status_idx" ON "WhatsAppConsent"("subjectType", "guardianId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppConsent_subjectType_staffMemberId_status_idx" ON "WhatsAppConsent"("subjectType", "staffMemberId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppConsent_phoneHash_status_idx" ON "WhatsAppConsent"("phoneHash", "status");

-- CreateIndex
CREATE INDEX "WhatsAppConsentEvent_consentId_eventDate_idx" ON "WhatsAppConsentEvent"("consentId", "eventDate");

-- CreateIndex
CREATE INDEX "WhatsAppConsentEvent_eventType_eventDate_idx" ON "WhatsAppConsentEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplateMapping_mappingCode_key" ON "WhatsAppTemplateMapping"("mappingCode");

-- CreateIndex
CREATE INDEX "WhatsAppTemplateMapping_integrationProfileId_status_idx" ON "WhatsAppTemplateMapping"("integrationProfileId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppTemplateMapping_notificationCategory_status_idx" ON "WhatsAppTemplateMapping"("notificationCategory", "status");

-- CreateIndex
CREATE INDEX "WhatsAppTemplateMapping_providerStatus_idx" ON "WhatsAppTemplateMapping"("providerStatus");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppOutboundBatch_batchNumber_key" ON "WhatsAppOutboundBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "WhatsAppOutboundBatch_status_scheduledFor_idx" ON "WhatsAppOutboundBatch"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "WhatsAppOutboundBatch_integrationProfileId_createdAt_idx" ON "WhatsAppOutboundBatch"("integrationProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppOutboundBatch_notificationCampaignId_idx" ON "WhatsAppOutboundBatch"("notificationCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDelivery_requestFingerprint_key" ON "WhatsAppDelivery"("requestFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDelivery_providerMessageId_key" ON "WhatsAppDelivery"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppDelivery_batchId_status_idx" ON "WhatsAppDelivery"("batchId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppDelivery_status_nextAttemptAt_idx" ON "WhatsAppDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WhatsAppDelivery_phoneHash_idx" ON "WhatsAppDelivery"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDelivery_batchId_subjectType_subjectReferenceId_key" ON "WhatsAppDelivery"("batchId", "subjectType", "subjectReferenceId");

-- CreateIndex
CREATE INDEX "WhatsAppDeliveryAttempt_providerMessageId_idx" ON "WhatsAppDeliveryAttempt"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppDeliveryAttempt_resultStatus_retryable_idx" ON "WhatsAppDeliveryAttempt"("resultStatus", "retryable");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDeliveryAttempt_deliveryId_attemptNumber_key" ON "WhatsAppDeliveryAttempt"("deliveryId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppWebhookEvent_eventKey_key" ON "WhatsAppWebhookEvent"("eventKey");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_providerMessageId_idx" ON "WhatsAppWebhookEvent"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_integrationProfileId_receivedAt_idx" ON "WhatsAppWebhookEvent"("integrationProfileId", "receivedAt");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_deliveryId_receivedAt_idx" ON "WhatsAppWebhookEvent"("deliveryId", "receivedAt");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_processingStatus_receivedAt_idx" ON "WhatsAppWebhookEvent"("processingStatus", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppOperationalEvent_eventKey_key" ON "WhatsAppOperationalEvent"("eventKey");

-- CreateIndex
CREATE INDEX "WhatsAppOperationalEvent_eventType_createdAt_idx" ON "WhatsAppOperationalEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppOperationalEvent_integrationProfileId_createdAt_idx" ON "WhatsAppOperationalEvent"("integrationProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppOperationalEvent_batchId_createdAt_idx" ON "WhatsAppOperationalEvent"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppRateReference_market_templateCategory_status_idx" ON "WhatsAppRateReference"("market", "templateCategory", "status");

-- CreateIndex
CREATE INDEX "WhatsAppRateReference_effectiveDate_idx" ON "WhatsAppRateReference"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppRateReference_rateVersion_market_templateCategory_c_key" ON "WhatsAppRateReference"("rateVersion", "market", "templateCategory", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailIntegrationProfile_profileCode_key" ON "SmsEmailIntegrationProfile"("profileCode");

-- CreateIndex
CREATE INDEX "SmsEmailIntegrationProfile_channel_mode_status_idx" ON "SmsEmailIntegrationProfile"("channel", "mode", "status");

-- CreateIndex
CREATE INDEX "SmsEmailIntegrationProfile_channel_liveSendingEnabled_idx" ON "SmsEmailIntegrationProfile"("channel", "liveSendingEnabled");

-- CreateIndex
CREATE INDEX "SmsEmailConsent_channel_subjectType_guardianId_status_idx" ON "SmsEmailConsent"("channel", "subjectType", "guardianId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailConsent_channel_subjectType_staffMemberId_status_idx" ON "SmsEmailConsent"("channel", "subjectType", "staffMemberId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailConsent_channel_contactHash_status_idx" ON "SmsEmailConsent"("channel", "contactHash", "status");

-- CreateIndex
CREATE INDEX "SmsEmailConsentEvent_consentId_eventDate_idx" ON "SmsEmailConsentEvent"("consentId", "eventDate");

-- CreateIndex
CREATE INDEX "SmsEmailConsentEvent_eventType_eventDate_idx" ON "SmsEmailConsentEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailTemplateMapping_mappingCode_key" ON "SmsEmailTemplateMapping"("mappingCode");

-- CreateIndex
CREATE INDEX "SmsEmailTemplateMapping_integrationProfileId_status_idx" ON "SmsEmailTemplateMapping"("integrationProfileId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailTemplateMapping_channel_notificationCategory_status_idx" ON "SmsEmailTemplateMapping"("channel", "notificationCategory", "status");

-- CreateIndex
CREATE INDEX "SmsEmailTemplateMapping_providerStatus_idx" ON "SmsEmailTemplateMapping"("providerStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailOutboundBatch_batchNumber_key" ON "SmsEmailOutboundBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "SmsEmailOutboundBatch_channel_status_scheduledFor_idx" ON "SmsEmailOutboundBatch"("channel", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SmsEmailOutboundBatch_integrationProfileId_createdAt_idx" ON "SmsEmailOutboundBatch"("integrationProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsEmailOutboundBatch_notificationCampaignId_idx" ON "SmsEmailOutboundBatch"("notificationCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailDelivery_requestFingerprint_key" ON "SmsEmailDelivery"("requestFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailDelivery_providerMessageId_key" ON "SmsEmailDelivery"("providerMessageId");

-- CreateIndex
CREATE INDEX "SmsEmailDelivery_batchId_status_idx" ON "SmsEmailDelivery"("batchId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailDelivery_channel_status_nextRetryAt_idx" ON "SmsEmailDelivery"("channel", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "SmsEmailDelivery_channel_contactHash_idx" ON "SmsEmailDelivery"("channel", "contactHash");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailDelivery_batchId_subjectType_guardianId_staffMember_key" ON "SmsEmailDelivery"("batchId", "subjectType", "guardianId", "staffMemberId", "contactHash");

-- CreateIndex
CREATE INDEX "SmsEmailDeliveryAttempt_providerMessageId_idx" ON "SmsEmailDeliveryAttempt"("providerMessageId");

-- CreateIndex
CREATE INDEX "SmsEmailDeliveryAttempt_result_idx" ON "SmsEmailDeliveryAttempt"("result");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailDeliveryAttempt_deliveryId_attemptNumber_key" ON "SmsEmailDeliveryAttempt"("deliveryId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailWebhookEvent_providerEventKey_key" ON "SmsEmailWebhookEvent"("providerEventKey");

-- CreateIndex
CREATE INDEX "SmsEmailWebhookEvent_integrationProfileId_receivedAt_idx" ON "SmsEmailWebhookEvent"("integrationProfileId", "receivedAt");

-- CreateIndex
CREATE INDEX "SmsEmailWebhookEvent_providerMessageId_idx" ON "SmsEmailWebhookEvent"("providerMessageId");

-- CreateIndex
CREATE INDEX "SmsEmailWebhookEvent_deliveryId_receivedAt_idx" ON "SmsEmailWebhookEvent"("deliveryId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailOperationalEvent_eventKey_key" ON "SmsEmailOperationalEvent"("eventKey");

-- CreateIndex
CREATE INDEX "SmsEmailOperationalEvent_eventType_createdAt_idx" ON "SmsEmailOperationalEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SmsEmailOperationalEvent_integrationProfileId_createdAt_idx" ON "SmsEmailOperationalEvent"("integrationProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsEmailOperationalEvent_batchId_createdAt_idx" ON "SmsEmailOperationalEvent"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsEmailSuppression_channel_contactHash_status_idx" ON "SmsEmailSuppression"("channel", "contactHash", "status");

-- CreateIndex
CREATE INDEX "SmsEmailSuppression_subjectType_guardianId_status_idx" ON "SmsEmailSuppression"("subjectType", "guardianId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailSuppression_subjectType_staffMemberId_status_idx" ON "SmsEmailSuppression"("subjectType", "staffMemberId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailCostRate_channel_status_effectiveFrom_idx" ON "SmsEmailCostRate"("channel", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailCostRate_channel_providerKind_market_messageCategor_key" ON "SmsEmailCostRate"("channel", "providerKind", "market", "messageCategory", "encodingType", "currency", "rateVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantProfile_profileCode_key" ON "AiAssistantProfile"("profileCode");

-- CreateIndex
CREATE INDEX "AiAssistantProfile_providerKind_status_idx" ON "AiAssistantProfile"("providerKind", "status");

-- CreateIndex
CREATE INDEX "AiAssistantProfile_liveUseEnabled_idx" ON "AiAssistantProfile"("liveUseEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantSourcePolicy_policyCode_key" ON "AiAssistantSourcePolicy"("policyCode");

-- CreateIndex
CREATE INDEX "AiAssistantSourcePolicy_enabled_sourceType_idx" ON "AiAssistantSourcePolicy"("enabled", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantSourcePolicy_sourceType_sourceKey_key" ON "AiAssistantSourcePolicy"("sourceType", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantQueryAudit_requestId_key" ON "AiAssistantQueryAudit"("requestId");

-- CreateIndex
CREATE INDEX "AiAssistantQueryAudit_userId_createdAt_idx" ON "AiAssistantQueryAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantQueryAudit_safetyDecision_createdAt_idx" ON "AiAssistantQueryAudit"("safetyDecision", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantQueryAudit_assistantProfileId_createdAt_idx" ON "AiAssistantQueryAudit"("assistantProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantSafetyEvent_queryAuditId_createdAt_idx" ON "AiAssistantSafetyEvent"("queryAuditId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantSafetyEvent_eventType_createdAt_idx" ON "AiAssistantSafetyEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantEvaluationCase_caseCode_key" ON "AiAssistantEvaluationCase"("caseCode");

-- CreateIndex
CREATE INDEX "AiAssistantEvaluationCase_category_status_idx" ON "AiAssistantEvaluationCase"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantEvaluationRun_runNumber_key" ON "AiAssistantEvaluationRun"("runNumber");

-- CreateIndex
CREATE INDEX "AiAssistantEvaluationRun_profileId_createdAt_idx" ON "AiAssistantEvaluationRun"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrProfile_profileCode_key" ON "FeeRegisterOcrProfile"("profileCode");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrProfile_providerKind_status_idx" ON "FeeRegisterOcrProfile"("providerKind", "status");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrProfile_paymentPostingEnabled_idx" ON "FeeRegisterOcrProfile"("paymentPostingEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrBatch_batchNumber_key" ON "FeeRegisterOcrBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrBatch_academicYear_status_idx" ON "FeeRegisterOcrBatch"("academicYear", "status");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrBatch_profileId_createdAt_idx" ON "FeeRegisterOcrBatch"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrPage_sourceSha256_idx" ON "FeeRegisterOcrPage"("sourceSha256");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrPage_batchId_status_idx" ON "FeeRegisterOcrPage"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrPage_batchId_pageNumber_key" ON "FeeRegisterOcrPage"("batchId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrRow_postedPaymentId_key" ON "FeeRegisterOcrRow"("postedPaymentId");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrRow_matchedStudentId_paymentDate_amountMinor_idx" ON "FeeRegisterOcrRow"("matchedStudentId", "paymentDate", "amountMinor");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrRow_status_idx" ON "FeeRegisterOcrRow"("status");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrRow_handwrittenReceiptReference_idx" ON "FeeRegisterOcrRow"("handwrittenReceiptReference");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrRow_pageId_rowNumber_key" ON "FeeRegisterOcrRow"("pageId", "rowNumber");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrRowRevision_rowId_createdAt_idx" ON "FeeRegisterOcrRowRevision"("rowId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrRowRevision_rowId_revisionNumber_key" ON "FeeRegisterOcrRowRevision"("rowId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrPostingRun_runNumber_key" ON "FeeRegisterOcrPostingRun"("runNumber");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrPostingRun_batchId_createdAt_idx" ON "FeeRegisterOcrPostingRun"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrPostingRun_status_idx" ON "FeeRegisterOcrPostingRun"("status");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrEvent_batchId_createdAt_idx" ON "FeeRegisterOcrEvent"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrEvent_rowId_createdAt_idx" ON "FeeRegisterOcrEvent"("rowId", "createdAt");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrEvent_eventType_createdAt_idx" ON "FeeRegisterOcrEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupProfile_profileCode_key" ON "CloudBackupProfile"("profileCode");

-- CreateIndex
CREATE INDEX "CloudBackupProfile_providerKind_status_idx" ON "CloudBackupProfile"("providerKind", "status");

-- CreateIndex
CREATE INDEX "CloudBackupProfile_status_liveUseEnabled_idx" ON "CloudBackupProfile"("status", "liveUseEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupSchedule_scheduleCode_key" ON "CloudBackupSchedule"("scheduleCode");

-- CreateIndex
CREATE INDEX "CloudBackupSchedule_enabled_nextRunAt_idx" ON "CloudBackupSchedule"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "CloudBackupSchedule_profileId_enabled_idx" ON "CloudBackupSchedule"("profileId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupRetentionPolicy_policyCode_key" ON "CloudBackupRetentionPolicy"("policyCode");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupRetentionPolicy_profileId_key" ON "CloudBackupRetentionPolicy"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupRun_runNumber_key" ON "CloudBackupRun"("runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupRun_idempotencyKey_key" ON "CloudBackupRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CloudBackupRun_profileId_status_createdAt_idx" ON "CloudBackupRun"("profileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CloudBackupRun_scheduleId_scheduledDueAt_idx" ON "CloudBackupRun"("scheduleId", "scheduledDueAt");

-- CreateIndex
CREATE INDEX "CloudBackupRun_status_nextRetryAt_idx" ON "CloudBackupRun"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "CloudBackupArtifact_status_verifiedAt_idx" ON "CloudBackupArtifact"("status", "verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupArtifact_runId_artifactType_key" ON "CloudBackupArtifact"("runId", "artifactType");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupArtifact_runId_objectKeySafe_key" ON "CloudBackupArtifact"("runId", "objectKeySafe");

-- CreateIndex
CREATE INDEX "CloudBackupVerification_runId_checkedAt_idx" ON "CloudBackupVerification"("runId", "checkedAt");

-- CreateIndex
CREATE INDEX "CloudBackupVerification_artifactId_checkedAt_idx" ON "CloudBackupVerification"("artifactId", "checkedAt");

-- CreateIndex
CREATE INDEX "CloudBackupVerification_status_verificationType_idx" ON "CloudBackupVerification"("status", "verificationType");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupRestoreRehearsal_rehearsalNumber_key" ON "CloudBackupRestoreRehearsal"("rehearsalNumber");

-- CreateIndex
CREATE INDEX "CloudBackupRestoreRehearsal_status_createdAt_idx" ON "CloudBackupRestoreRehearsal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CloudBackupRestoreRehearsal_artifactId_createdAt_idx" ON "CloudBackupRestoreRehearsal"("artifactId", "createdAt");

-- CreateIndex
CREATE INDEX "CloudBackupEvent_profileId_eventDate_idx" ON "CloudBackupEvent"("profileId", "eventDate");

-- CreateIndex
CREATE INDEX "CloudBackupEvent_runId_eventDate_idx" ON "CloudBackupEvent"("runId", "eventDate");

-- CreateIndex
CREATE INDEX "CloudBackupEvent_eventType_eventDate_idx" ON "CloudBackupEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsiteSettings_settingsCode_key" ON "PublicWebsiteSettings"("settingsCode");

-- CreateIndex
CREATE INDEX "PublicWebsiteSettings_status_publishedAt_idx" ON "PublicWebsiteSettings"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePage_pageCode_key" ON "PublicWebsitePage"("pageCode");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePage_slug_key" ON "PublicWebsitePage"("slug");

-- CreateIndex
CREATE INDEX "PublicWebsitePage_status_pageType_idx" ON "PublicWebsitePage"("status", "pageType");

-- CreateIndex
CREATE INDEX "PublicWebsitePage_showInNavigation_navigationOrder_idx" ON "PublicWebsitePage"("showInNavigation", "navigationOrder");

-- CreateIndex
CREATE INDEX "PublicWebsitePageVersion_slugSnapshot_publishedAt_idx" ON "PublicWebsitePageVersion"("slugSnapshot", "publishedAt");

-- CreateIndex
CREATE INDEX "PublicWebsitePageVersion_contentHash_idx" ON "PublicWebsitePageVersion"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePageVersion_pageId_versionNumber_key" ON "PublicWebsitePageVersion"("pageId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePost_postNumber_key" ON "PublicWebsitePost"("postNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePost_slug_key" ON "PublicWebsitePost"("slug");

-- CreateIndex
CREATE INDEX "PublicWebsitePost_status_postType_publishAt_idx" ON "PublicWebsitePost"("status", "postType", "publishAt");

-- CreateIndex
CREATE INDEX "PublicWebsitePost_featured_publishedAt_idx" ON "PublicWebsitePost"("featured", "publishedAt");

-- CreateIndex
CREATE INDEX "PublicWebsitePostVersion_slugSnapshot_publishedAt_idx" ON "PublicWebsitePostVersion"("slugSnapshot", "publishedAt");

-- CreateIndex
CREATE INDEX "PublicWebsitePostVersion_contentHash_idx" ON "PublicWebsitePostVersion"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePostVersion_postId_versionNumber_key" ON "PublicWebsitePostVersion"("postId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsiteNavigationItem_itemCode_key" ON "PublicWebsiteNavigationItem"("itemCode");

-- CreateIndex
CREATE INDEX "PublicWebsiteNavigationItem_placement_enabled_displayOrder_idx" ON "PublicWebsiteNavigationItem"("placement", "enabled", "displayOrder");

-- CreateIndex
CREATE INDEX "PublicWebsiteNavigationItem_pageId_idx" ON "PublicWebsiteNavigationItem"("pageId");

-- CreateIndex
CREATE INDEX "PublicWebsiteEvent_entityType_entityId_eventDate_idx" ON "PublicWebsiteEvent"("entityType", "entityId", "eventDate");

-- CreateIndex
CREATE INDEX "PublicWebsiteEvent_eventType_eventDate_idx" ON "PublicWebsiteEvent"("eventType", "eventDate");

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

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPolicyVersion_publicKey_key" ON "PayrollPolicyVersion"("publicKey");

-- CreateIndex
CREATE INDEX "PayrollPolicyVersion_status_effectiveFrom_effectiveTo_idx" ON "PayrollPolicyVersion"("status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPolicyVersion_policyCode_versionNumber_key" ON "PayrollPolicyVersion"("policyCode", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureVersion_publicKey_key" ON "SalaryStructureVersion"("publicKey");

-- CreateIndex
CREATE INDEX "SalaryStructureVersion_status_effectiveFrom_effectiveTo_idx" ON "SalaryStructureVersion"("status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "SalaryStructureVersion_policyVersionId_idx" ON "SalaryStructureVersion"("policyVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructureVersion_structureCode_versionNumber_key" ON "SalaryStructureVersion"("structureCode", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponentDefinition_publicKey_key" ON "SalaryComponentDefinition"("publicKey");

-- CreateIndex
CREATE INDEX "SalaryComponentDefinition_classification_calculationMode_idx" ON "SalaryComponentDefinition"("classification", "calculationMode");

-- CreateIndex
CREATE INDEX "SalaryComponentDefinition_effectiveFrom_effectiveTo_idx" ON "SalaryComponentDefinition"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponentDefinition_structureVersionId_componentCode_key" ON "SalaryComponentDefinition"("structureVersionId", "componentCode");

-- CreateIndex
CREATE UNIQUE INDEX "StaffCompensationAssignment_publicKey_key" ON "StaffCompensationAssignment"("publicKey");

-- CreateIndex
CREATE INDEX "StaffCompensationAssignment_staffMemberId_effectiveFrom_eff_idx" ON "StaffCompensationAssignment"("staffMemberId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "StaffCompensationAssignment_status_payrollEligibleFrom_payr_idx" ON "StaffCompensationAssignment"("status", "payrollEligibleFrom", "payrollEligibleTo");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryRevision_publicKey_key" ON "SalaryRevision"("publicKey");

-- CreateIndex
CREATE INDEX "SalaryRevision_staffMemberId_effectiveDate_idx" ON "SalaryRevision"("staffMemberId", "effectiveDate");

-- CreateIndex
CREATE INDEX "SalaryRevision_status_effectiveDate_idx" ON "SalaryRevision"("status", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_publicKey_key" ON "PayrollPeriod"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_periodCode_key" ON "PayrollPeriod"("periodCode");

-- CreateIndex
CREATE INDEX "PayrollPeriod_status_startDate_endDate_idx" ON "PayrollPeriod"("status", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_publicKey_key" ON "PayrollRun"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_runNumber_key" ON "PayrollRun"("runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_requestKey_key" ON "PayrollRun"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_activeKey_key" ON "PayrollRun"("activeKey");

-- CreateIndex
CREATE INDEX "PayrollRun_periodId_status_idx" ON "PayrollRun"("periodId", "status");

-- CreateIndex
CREATE INDEX "PayrollRun_status_createdAt_idx" ON "PayrollRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollRun_sourceRunId_idx" ON "PayrollRun"("sourceRunId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_periodId_sequenceNumber_key" ON "PayrollRun"("periodId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayrollResult_publicKey_key" ON "EmployeePayrollResult"("publicKey");

-- CreateIndex
CREATE INDEX "EmployeePayrollResult_staffMemberId_createdAt_idx" ON "EmployeePayrollResult"("staffMemberId", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeePayrollResult_status_idx" ON "EmployeePayrollResult"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeePayrollResult_payrollRunId_staffMemberId_key" ON "EmployeePayrollResult"("payrollRunId", "staffMemberId");

-- CreateIndex
CREATE INDEX "PayrollComponentResult_componentCode_classification_idx" ON "PayrollComponentResult"("componentCode", "classification");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollComponentResult_employeePayrollResultId_componentCod_key" ON "PayrollComponentResult"("employeePayrollResultId", "componentCode");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryAdvance_publicKey_key" ON "SalaryAdvance"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryAdvance_advanceNumber_key" ON "SalaryAdvance"("advanceNumber");

-- CreateIndex
CREATE INDEX "SalaryAdvance_staffMemberId_status_idx" ON "SalaryAdvance"("staffMemberId", "status");

-- CreateIndex
CREATE INDEX "SalaryAdvance_status_createdAt_idx" ON "SalaryAdvance"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceRecoverySchedule_publicKey_key" ON "AdvanceRecoverySchedule"("publicKey");

-- CreateIndex
CREATE INDEX "AdvanceRecoverySchedule_payrollPeriodId_status_idx" ON "AdvanceRecoverySchedule"("payrollPeriodId", "status");

-- CreateIndex
CREATE INDEX "AdvanceRecoverySchedule_employeePayrollResultId_idx" ON "AdvanceRecoverySchedule"("employeePayrollResultId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceRecoverySchedule_salaryAdvanceId_sequenceNumber_key" ON "AdvanceRecoverySchedule"("salaryAdvanceId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipVersion_publicKey_key" ON "PayslipVersion"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipVersion_reference_key" ON "PayslipVersion"("reference");

-- CreateIndex
CREATE INDEX "PayslipVersion_staffMemberId_issueDate_idx" ON "PayslipVersion"("staffMemberId", "issueDate");

-- CreateIndex
CREATE INDEX "PayslipVersion_status_idx" ON "PayslipVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayslipVersion_employeePayrollResultId_versionNumber_key" ON "PayslipVersion"("employeePayrollResultId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEvent_publicKey_key" ON "PayrollEvent"("publicKey");

-- CreateIndex
CREATE INDEX "PayrollEvent_payrollRunId_createdAt_idx" ON "PayrollEvent"("payrollRunId", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollEvent_entityType_entityPublicKey_createdAt_idx" ON "PayrollEvent"("entityType", "entityPublicKey", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollEvent_eventType_createdAt_idx" ON "PayrollEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "PayrollEvent_requestKey_idx" ON "PayrollEvent"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipMonthAvailability_publicKey_key" ON "StaffPayslipMonthAvailability"("publicKey");

-- CreateIndex
CREATE INDEX "StaffPayslipMonthAvailability_salaryMonth_status_idx" ON "StaffPayslipMonthAvailability"("salaryMonth", "status");

-- CreateIndex
CREATE INDEX "StaffPayslipMonthAvailability_staffMemberId_status_idx" ON "StaffPayslipMonthAvailability"("staffMemberId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipMonthAvailability_staffMemberId_salaryMonth_key" ON "StaffPayslipMonthAvailability"("staffMemberId", "salaryMonth");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipRequest_publicKey_key" ON "StaffPayslipRequest"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipRequest_requestNumber_key" ON "StaffPayslipRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipRequest_submissionKey_key" ON "StaffPayslipRequest"("submissionKey");

-- CreateIndex
CREATE INDEX "StaffPayslipRequest_staffMemberId_status_createdAt_idx" ON "StaffPayslipRequest"("staffMemberId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StaffPayslipRequest_status_requiredByDate_idx" ON "StaffPayslipRequest"("status", "requiredByDate");

-- CreateIndex
CREATE INDEX "StaffPayslipRequest_assignedPreparerUserId_status_idx" ON "StaffPayslipRequest"("assignedPreparerUserId", "status");

-- CreateIndex
CREATE INDEX "StaffPayslipRequest_correctionOfRequestId_idx" ON "StaffPayslipRequest"("correctionOfRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipRequestMonth_activeOverlapKey_key" ON "StaffPayslipRequestMonth"("activeOverlapKey");

-- CreateIndex
CREATE INDEX "StaffPayslipRequestMonth_salaryMonth_issueStatus_idx" ON "StaffPayslipRequestMonth"("salaryMonth", "issueStatus");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipRequestMonth_requestId_salaryMonth_key" ON "StaffPayslipRequestMonth"("requestId", "salaryMonth");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipRequestEvent_publicKey_key" ON "StaffPayslipRequestEvent"("publicKey");

-- CreateIndex
CREATE INDEX "StaffPayslipRequestEvent_requestId_occurredAt_idx" ON "StaffPayslipRequestEvent"("requestId", "occurredAt");

-- CreateIndex
CREATE INDEX "StaffPayslipRequestEvent_eventType_occurredAt_idx" ON "StaffPayslipRequestEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "StaffPayslipRequestEvent_requestHash_idx" ON "StaffPayslipRequestEvent"("requestHash");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_publicKey_key" ON "StaffPayslipDocumentVersion"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_verificationReference_key" ON "StaffPayslipDocumentVersion"("verificationReference");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_sourceStorageKey_key" ON "StaffPayslipDocumentVersion"("sourceStorageKey");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_derivativeStorageKey_key" ON "StaffPayslipDocumentVersion"("derivativeStorageKey");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_supersedesVersionId_key" ON "StaffPayslipDocumentVersion"("supersedesVersionId");

-- CreateIndex
CREATE INDEX "StaffPayslipDocumentVersion_requestId_status_createdAt_idx" ON "StaffPayslipDocumentVersion"("requestId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StaffPayslipDocumentVersion_status_issuedAt_idx" ON "StaffPayslipDocumentVersion"("status", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipDocumentVersion_requestId_versionNumber_key" ON "StaffPayslipDocumentVersion"("requestId", "versionNumber");

-- CreateIndex
CREATE INDEX "StaffPayslipDocumentMonth_requestMonthId_createdAt_idx" ON "StaffPayslipDocumentMonth"("requestMonthId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffPayslipDocumentMonth_salaryMonth_idx" ON "StaffPayslipDocumentMonth"("salaryMonth");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipDocumentMonth_documentVersionId_requestMonthId_key" ON "StaffPayslipDocumentMonth"("documentVersionId", "requestMonthId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayslipAccessEvent_publicKey_key" ON "StaffPayslipAccessEvent"("publicKey");

-- CreateIndex
CREATE INDEX "StaffPayslipAccessEvent_requestId_occurredAt_idx" ON "StaffPayslipAccessEvent"("requestId", "occurredAt");

-- CreateIndex
CREATE INDEX "StaffPayslipAccessEvent_documentVersionId_occurredAt_idx" ON "StaffPayslipAccessEvent"("documentVersionId", "occurredAt");

-- CreateIndex
CREATE INDEX "StaffPayslipAccessEvent_staffMemberId_occurredAt_idx" ON "StaffPayslipAccessEvent"("staffMemberId", "occurredAt");

-- CreateIndex
CREATE INDEX "StaffPayslipAccessEvent_actorUserId_eventType_occurredAt_idx" ON "StaffPayslipAccessEvent"("actorUserId", "eventType", "occurredAt");

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

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureRequest_publicKey_key" ON "StudentDepartureRequest"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureRequest_requestNumber_key" ON "StudentDepartureRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureRequest_submissionKey_key" ON "StudentDepartureRequest"("submissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureRequest_activeCheckoutKey_key" ON "StudentDepartureRequest"("activeCheckoutKey");

-- CreateIndex
CREATE INDEX "StudentDepartureRequest_studentId_submittedAt_idx" ON "StudentDepartureRequest"("studentId", "submittedAt");

-- CreateIndex
CREATE INDEX "StudentDepartureRequest_status_intendedDepartureAt_idx" ON "StudentDepartureRequest"("status", "intendedDepartureAt");

-- CreateIndex
CREATE INDEX "StudentDepartureRequest_temporaryReturnRequired_status_expe_idx" ON "StudentDepartureRequest"("temporaryReturnRequired", "status", "expectedReturnAt");

-- CreateIndex
CREATE INDEX "StudentDepartureRequest_academicYear_status_idx" ON "StudentDepartureRequest"("academicYear", "status");

-- CreateIndex
CREATE INDEX "StudentDepartureRequest_requestedByUserId_submittedAt_idx" ON "StudentDepartureRequest"("requestedByUserId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureConsentEvidence_publicKey_key" ON "StudentDepartureConsentEvidence"("publicKey");

-- CreateIndex
CREATE INDEX "StudentDepartureConsentEvidence_requestId_recordedAt_idx" ON "StudentDepartureConsentEvidence"("requestId", "recordedAt");

-- CreateIndex
CREATE INDEX "StudentDepartureConsentEvidence_guardianId_recordedAt_idx" ON "StudentDepartureConsentEvidence"("guardianId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentStandingDepartureAuthorization_publicKey_key" ON "StudentStandingDepartureAuthorization"("publicKey");

-- CreateIndex
CREATE INDEX "StudentStandingDepartureAuthorization_studentId_createdAt_idx" ON "StudentStandingDepartureAuthorization"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentStandingDepartureAuthorization_guardianId_createdAt_idx" ON "StudentStandingDepartureAuthorization"("guardianId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentStandingDepartureAuthorization_seriesKey_versionNumb_idx" ON "StudentStandingDepartureAuthorization"("seriesKey", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentStandingDepartureAuthorization_seriesKey_versionNumb_key" ON "StudentStandingDepartureAuthorization"("seriesKey", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGatePass_publicKey_key" ON "StudentGatePass"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGatePass_tokenHash_key" ON "StudentGatePass"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGatePass_manualCodeHash_key" ON "StudentGatePass"("manualCodeHash");

-- CreateIndex
CREATE INDEX "StudentGatePass_requestId_issuedAt_idx" ON "StudentGatePass"("requestId", "issuedAt");

-- CreateIndex
CREATE INDEX "StudentGatePass_status_expiresAt_idx" ON "StudentGatePass"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureHandover_publicKey_key" ON "StudentDepartureHandover"("publicKey");

-- CreateIndex
CREATE INDEX "StudentDepartureHandover_requestId_verifiedAt_idx" ON "StudentDepartureHandover"("requestId", "verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureEvent_publicKey_key" ON "StudentDepartureEvent"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureEvent_idempotencyKey_key" ON "StudentDepartureEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StudentDepartureEvent_requestId_occurredAt_idx" ON "StudentDepartureEvent"("requestId", "occurredAt");

-- CreateIndex
CREATE INDEX "StudentDepartureEvent_eventType_occurredAt_idx" ON "StudentDepartureEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureCorrectionEvent_publicKey_key" ON "StudentDepartureCorrectionEvent"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureCorrectionEvent_idempotencyKey_key" ON "StudentDepartureCorrectionEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StudentDepartureCorrectionEvent_requestId_occurredAt_idx" ON "StudentDepartureCorrectionEvent"("requestId", "occurredAt");

-- CreateIndex
CREATE INDEX "StudentDepartureCorrectionEvent_correctedFieldCode_occurred_idx" ON "StudentDepartureCorrectionEvent"("correctedFieldCode", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCampusPresenceEvent_publicKey_key" ON "StudentCampusPresenceEvent"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCampusPresenceEvent_idempotencyKey_key" ON "StudentCampusPresenceEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StudentCampusPresenceEvent_studentId_occurredAt_idx" ON "StudentCampusPresenceEvent"("studentId", "occurredAt");

-- CreateIndex
CREATE INDEX "StudentCampusPresenceEvent_schoolDateKey_eventType_idx" ON "StudentCampusPresenceEvent"("schoolDateKey", "eventType");

-- CreateIndex
CREATE INDEX "StudentCampusPresenceEvent_requestId_occurredAt_idx" ON "StudentCampusPresenceEvent"("requestId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureIncident_publicKey_key" ON "StudentDepartureIncident"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureIncident_incidentNumber_key" ON "StudentDepartureIncident"("incidentNumber");

-- CreateIndex
CREATE INDEX "StudentDepartureIncident_studentId_reportedAt_idx" ON "StudentDepartureIncident"("studentId", "reportedAt");

-- CreateIndex
CREATE INDEX "StudentDepartureIncident_status_reportedAt_idx" ON "StudentDepartureIncident"("status", "reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureIncidentAction_publicKey_key" ON "StudentDepartureIncidentAction"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureIncidentAction_idempotencyKey_key" ON "StudentDepartureIncidentAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StudentDepartureIncidentAction_incidentId_occurredAt_idx" ON "StudentDepartureIncidentAction"("incidentId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureNotificationOutbox_publicKey_key" ON "StudentDepartureNotificationOutbox"("publicKey");

-- CreateIndex
CREATE INDEX "StudentDepartureNotificationOutbox_status_nextAttemptAt_idx" ON "StudentDepartureNotificationOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "StudentDepartureNotificationOutbox_requestId_queuedAt_idx" ON "StudentDepartureNotificationOutbox"("requestId", "queuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureNotificationOutbox_eventKey_recipientUserId_key" ON "StudentDepartureNotificationOutbox"("eventKey", "recipientUserId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureFallbackTask_publicKey_key" ON "StudentDepartureFallbackTask"("publicKey");

-- CreateIndex
CREATE INDEX "StudentDepartureFallbackTask_status_createdAt_idx" ON "StudentDepartureFallbackTask"("status", "createdAt");

-- CreateIndex
CREATE INDEX "StudentDepartureFallbackTask_requestId_createdAt_idx" ON "StudentDepartureFallbackTask"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDepartureFallbackTask_eventKey_taskType_key" ON "StudentDepartureFallbackTask"("eventKey", "taskType");

-- CreateIndex
CREATE UNIQUE INDEX "AppPushSubscription_publicKey_key" ON "AppPushSubscription"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "AppPushSubscription_endpointHash_key" ON "AppPushSubscription"("endpointHash");

-- CreateIndex
CREATE INDEX "AppPushSubscription_userId_status_idx" ON "AppPushSubscription"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalCheckDefinition_checkKey_key" ON "OperationalCheckDefinition"("checkKey");

-- CreateIndex
CREATE INDEX "OperationalCheckDefinition_domain_enabled_idx" ON "OperationalCheckDefinition"("domain", "enabled");

-- CreateIndex
CREATE INDEX "OperationalCheckDefinition_checkType_enabled_idx" ON "OperationalCheckDefinition"("checkType", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalCheckRun_runKey_key" ON "OperationalCheckRun"("runKey");

-- CreateIndex
CREATE INDEX "OperationalCheckRun_definitionId_startedAt_idx" ON "OperationalCheckRun"("definitionId", "startedAt");

-- CreateIndex
CREATE INDEX "OperationalCheckRun_status_startedAt_idx" ON "OperationalCheckRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "OperationalCheckRun_expiresAt_idx" ON "OperationalCheckRun"("expiresAt");

-- CreateIndex
CREATE INDEX "OperationalMetricSnapshot_domain_bucketStart_idx" ON "OperationalMetricSnapshot"("domain", "bucketStart");

-- CreateIndex
CREATE INDEX "OperationalMetricSnapshot_expiresAt_idx" ON "OperationalMetricSnapshot"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalMetricSnapshot_metricKey_bucketStart_key" ON "OperationalMetricSnapshot"("metricKey", "bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalAlert_publicKey_key" ON "OperationalAlert"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalAlert_fingerprint_key" ON "OperationalAlert"("fingerprint");

-- CreateIndex
CREATE INDEX "OperationalAlert_status_severity_lastSeenAt_idx" ON "OperationalAlert"("status", "severity", "lastSeenAt");

-- CreateIndex
CREATE INDEX "OperationalAlert_domain_status_idx" ON "OperationalAlert"("domain", "status");

-- CreateIndex
CREATE INDEX "OperationalAlert_silencedUntil_idx" ON "OperationalAlert"("silencedUntil");

-- CreateIndex
CREATE INDEX "OperationalAlertEvent_alertId_occurredAt_idx" ON "OperationalAlertEvent"("alertId", "occurredAt");

-- CreateIndex
CREATE INDEX "OperationalAlertEvent_eventType_occurredAt_idx" ON "OperationalAlertEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalIncident_publicKey_key" ON "OperationalIncident"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalIncident_incidentNumber_key" ON "OperationalIncident"("incidentNumber");

-- CreateIndex
CREATE INDEX "OperationalIncident_status_severity_createdAt_idx" ON "OperationalIncident"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalIncident_domain_status_idx" ON "OperationalIncident"("domain", "status");

-- CreateIndex
CREATE INDEX "OperationalIncident_alertId_idx" ON "OperationalIncident"("alertId");

-- CreateIndex
CREATE INDEX "OperationalIncidentEvent_incidentId_occurredAt_idx" ON "OperationalIncidentEvent"("incidentId", "occurredAt");

-- CreateIndex
CREATE INDEX "OperationalIncidentEvent_eventType_occurredAt_idx" ON "OperationalIncidentEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceWindow_publicKey_key" ON "MaintenanceWindow"("publicKey");

-- CreateIndex
CREATE INDEX "MaintenanceWindow_status_plannedStartAt_plannedEndAt_idx" ON "MaintenanceWindow"("status", "plannedStartAt", "plannedEndAt");

-- CreateIndex
CREATE INDEX "MaintenanceWindow_domain_status_idx" ON "MaintenanceWindow"("domain", "status");

-- CreateIndex
CREATE INDEX "MaintenanceWindowEvent_maintenanceWindowId_occurredAt_idx" ON "MaintenanceWindowEvent"("maintenanceWindowId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReleaseManifest_releaseVersion_key" ON "ReleaseManifest"("releaseVersion");

-- CreateIndex
CREATE INDEX "ReleaseManifest_environment_isCurrent_idx" ON "ReleaseManifest"("environment", "isCurrent");

-- CreateIndex
CREATE INDEX "ReleaseManifest_createdAt_idx" ON "ReleaseManifest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientVersionPolicy_environment_key" ON "ClientVersionPolicy"("environment");

-- CreateIndex
CREATE INDEX "ClientVersionPolicy_enforcementMode_updatedAt_idx" ON "ClientVersionPolicy"("enforcementMode", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJobRun_publicKey_key" ON "BackgroundJobRun"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJobRun_idempotencyKey_key" ON "BackgroundJobRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_jobType_status_queuedAt_idx" ON "BackgroundJobRun"("jobType", "status", "queuedAt");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_status_nextAttemptAt_idx" ON "BackgroundJobRun"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "BackgroundJobRun_expiresAt_idx" ON "BackgroundJobRun"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminDiaryEntry_publicKey_key" ON "SuperAdminDiaryEntry"("publicKey");

-- CreateIndex
CREATE INDEX "SuperAdminDiaryEntry_ownerUserId_entryDate_idx" ON "SuperAdminDiaryEntry"("ownerUserId", "entryDate");

-- CreateIndex
CREATE INDEX "SuperAdminDiaryEntry_ownerUserId_status_followUpDate_idx" ON "SuperAdminDiaryEntry"("ownerUserId", "status", "followUpDate");

-- CreateIndex
CREATE INDEX "SuperAdminDiaryEntry_ownerUserId_category_priority_idx" ON "SuperAdminDiaryEntry"("ownerUserId", "category", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminTask_publicKey_key" ON "SuperAdminTask"("publicKey");

-- CreateIndex
CREATE INDEX "SuperAdminTask_ownerUserId_status_dueDate_idx" ON "SuperAdminTask"("ownerUserId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "SuperAdminTask_ownerUserId_reminderAt_idx" ON "SuperAdminTask"("ownerUserId", "reminderAt");

-- CreateIndex
CREATE INDEX "SuperAdminTask_ownerUserId_category_priority_idx" ON "SuperAdminTask"("ownerUserId", "category", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminContact_publicKey_key" ON "SuperAdminContact"("publicKey");

-- CreateIndex
CREATE INDEX "SuperAdminContact_ownerUserId_status_preferred_idx" ON "SuperAdminContact"("ownerUserId", "status", "preferred");

-- CreateIndex
CREATE INDEX "SuperAdminContact_ownerUserId_category_name_idx" ON "SuperAdminContact"("ownerUserId", "category", "name");

-- CreateIndex
CREATE INDEX "SuperAdminContact_ownerUserId_nextFollowUpDate_idx" ON "SuperAdminContact"("ownerUserId", "nextFollowUpDate");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminWorkAudit_publicKey_key" ON "SuperAdminWorkAudit"("publicKey");

-- CreateIndex
CREATE INDEX "SuperAdminWorkAudit_ownerUserId_occurredAt_idx" ON "SuperAdminWorkAudit"("ownerUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "SuperAdminWorkAudit_ownerUserId_entityType_entityPublicKey_idx" ON "SuperAdminWorkAudit"("ownerUserId", "entityType", "entityPublicKey");

-- CreateIndex
CREATE INDEX "SuperAdminWorkAudit_eventType_occurredAt_idx" ON "SuperAdminWorkAudit"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "TransportVehicle_publicKey_key" ON "TransportVehicle"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "TransportVehicle_registrationCode_key" ON "TransportVehicle"("registrationCode");

-- CreateIndex
CREATE INDEX "TransportVehicle_status_displayName_idx" ON "TransportVehicle"("status", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_publicKey_key" ON "TransportRoute"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_code_key" ON "TransportRoute"("code");

-- CreateIndex
CREATE INDEX "TransportRoute_status_code_idx" ON "TransportRoute"("status", "code");

-- CreateIndex
CREATE INDEX "TransportRoute_vehicleId_status_idx" ON "TransportRoute"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "TransportRoute_driverStaffMemberId_idx" ON "TransportRoute"("driverStaffMemberId");

-- CreateIndex
CREATE INDEX "TransportRoute_attendantStaffMemberId_idx" ON "TransportRoute"("attendantStaffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStop_publicKey_key" ON "TransportStop"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStop_code_key" ON "TransportStop"("code");

-- CreateIndex
CREATE INDEX "TransportStop_active_name_idx" ON "TransportStop"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRouteStop_publicKey_key" ON "TransportRouteStop"("publicKey");

-- CreateIndex
CREATE INDEX "TransportRouteStop_routeId_direction_active_idx" ON "TransportRouteStop"("routeId", "direction", "active");

-- CreateIndex
CREATE INDEX "TransportRouteStop_stopId_active_idx" ON "TransportRouteStop"("stopId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRouteStop_routeId_direction_sequence_key" ON "TransportRouteStop"("routeId", "direction", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRouteStop_routeId_stopId_direction_key" ON "TransportRouteStop"("routeId", "stopId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStudentAssignment_publicKey_key" ON "TransportStudentAssignment"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStudentAssignment_activeStudentId_key" ON "TransportStudentAssignment"("activeStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStudentAssignment_replacesAssignmentId_key" ON "TransportStudentAssignment"("replacesAssignmentId");

-- CreateIndex
CREATE INDEX "TransportStudentAssignment_studentId_effectiveFrom_idx" ON "TransportStudentAssignment"("studentId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TransportStudentAssignment_routeId_active_effectiveFrom_idx" ON "TransportStudentAssignment"("routeId", "active", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TransportStudentAssignment_active_effectiveFrom_effectiveTo_idx" ON "TransportStudentAssignment"("active", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "TransportAuditEvent_publicKey_key" ON "TransportAuditEvent"("publicKey");

-- CreateIndex
CREATE INDEX "TransportAuditEvent_entityType_entityPublicKey_occurredAt_idx" ON "TransportAuditEvent"("entityType", "entityPublicKey", "occurredAt");

-- CreateIndex
CREATE INDEX "TransportAuditEvent_eventType_occurredAt_idx" ON "TransportAuditEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaCatalogItem_publicKey_key" ON "CafeteriaCatalogItem"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaCatalogItem_code_key" ON "CafeteriaCatalogItem"("code");

-- CreateIndex
CREATE INDEX "CafeteriaCatalogItem_status_available_category_idx" ON "CafeteriaCatalogItem"("status", "available", "category");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMenu_publicKey_key" ON "CafeteriaMenu"("publicKey");

-- CreateIndex
CREATE INDEX "CafeteriaMenu_status_menuDate_idx" ON "CafeteriaMenu"("status", "menuDate");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMenu_menuDate_mealPlanName_key" ON "CafeteriaMenu"("menuDate", "mealPlanName");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMenuItem_publicKey_key" ON "CafeteriaMenuItem"("publicKey");

-- CreateIndex
CREATE INDEX "CafeteriaMenuItem_menuId_mealSlot_available_idx" ON "CafeteriaMenuItem"("menuId", "mealSlot", "available");

-- CreateIndex
CREATE INDEX "CafeteriaMenuItem_itemId_available_idx" ON "CafeteriaMenuItem"("itemId", "available");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMenuItem_menuId_itemId_mealSlot_key" ON "CafeteriaMenuItem"("menuId", "itemId", "mealSlot");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaStudentEnrollment_publicKey_key" ON "CafeteriaStudentEnrollment"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaStudentEnrollment_activeStudentId_key" ON "CafeteriaStudentEnrollment"("activeStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaStudentEnrollment_replacesEnrollmentId_key" ON "CafeteriaStudentEnrollment"("replacesEnrollmentId");

-- CreateIndex
CREATE INDEX "CafeteriaStudentEnrollment_studentId_effectiveFrom_idx" ON "CafeteriaStudentEnrollment"("studentId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "CafeteriaStudentEnrollment_active_effectiveFrom_effectiveTo_idx" ON "CafeteriaStudentEnrollment"("active", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMealRecord_publicKey_key" ON "CafeteriaMealRecord"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMealRecord_idempotencyKey_key" ON "CafeteriaMealRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CafeteriaMealRecord_serviceDateKey_mealSlot_status_idx" ON "CafeteriaMealRecord"("serviceDateKey", "mealSlot", "status");

-- CreateIndex
CREATE INDEX "CafeteriaMealRecord_enrollmentId_recordedAt_idx" ON "CafeteriaMealRecord"("enrollmentId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMealRecord_studentId_serviceDateKey_mealSlot_recor_key" ON "CafeteriaMealRecord"("studentId", "serviceDateKey", "mealSlot", "recordType");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaAuditEvent_publicKey_key" ON "CafeteriaAuditEvent"("publicKey");

-- CreateIndex
CREATE INDEX "CafeteriaAuditEvent_entityType_entityPublicKey_occurredAt_idx" ON "CafeteriaAuditEvent"("entityType", "entityPublicKey", "occurredAt");

-- CreateIndex
CREATE INDEX "CafeteriaAuditEvent_eventType_occurredAt_idx" ON "CafeteriaAuditEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventMediaAlbum_publicKey_key" ON "EventMediaAlbum"("publicKey");

-- CreateIndex
CREATE INDEX "EventMediaAlbum_status_eventDate_idx" ON "EventMediaAlbum"("status", "eventDate");

-- CreateIndex
CREATE INDEX "EventMediaAlbum_visibility_publicationState_idx" ON "EventMediaAlbum"("visibility", "publicationState");

-- CreateIndex
CREATE INDEX "EventMediaAlbum_retentionReviewAt_archivedAt_idx" ON "EventMediaAlbum"("retentionReviewAt", "archivedAt");

-- CreateIndex
CREATE INDEX "EventMediaAlbum_createdByUserId_createdAt_idx" ON "EventMediaAlbum"("createdByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventMediaAsset_publicKey_key" ON "EventMediaAsset"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "EventMediaAsset_originalStorageKey_key" ON "EventMediaAsset"("originalStorageKey");

-- CreateIndex
CREATE INDEX "EventMediaAsset_albumId_createdAt_idx" ON "EventMediaAsset"("albumId", "createdAt");

-- CreateIndex
CREATE INDEX "EventMediaAsset_albumId_reviewStatus_publicationStatus_idx" ON "EventMediaAsset"("albumId", "reviewStatus", "publicationStatus");

-- CreateIndex
CREATE INDEX "EventMediaAsset_publicationStatus_withdrawalState_idx" ON "EventMediaAsset"("publicationStatus", "withdrawalState");

-- CreateIndex
CREATE INDEX "EventMediaAsset_uploadActorUserId_uploadedAt_idx" ON "EventMediaAsset"("uploadActorUserId", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventMediaDerivative_publicKey_key" ON "EventMediaDerivative"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "EventMediaDerivative_storageKey_key" ON "EventMediaDerivative"("storageKey");

-- CreateIndex
CREATE INDEX "EventMediaDerivative_assetId_status_idx" ON "EventMediaDerivative"("assetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventMediaDerivative_assetId_kind_key" ON "EventMediaDerivative"("assetId", "kind");

-- CreateIndex
CREATE INDEX "EventMediaStudentAssociation_studentId_assetId_idx" ON "EventMediaStudentAssociation"("studentId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "EventMediaStudentAssociation_assetId_studentId_key" ON "EventMediaStudentAssociation"("assetId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaPublicationConsent_publicKey_key" ON "MediaPublicationConsent"("publicKey");

-- CreateIndex
CREATE INDEX "MediaPublicationConsent_studentId_audience_status_grantedAt_idx" ON "MediaPublicationConsent"("studentId", "audience", "status", "grantedAt");

-- CreateIndex
CREATE INDEX "MediaPublicationConsent_guardianId_grantedAt_idx" ON "MediaPublicationConsent"("guardianId", "grantedAt");

-- CreateIndex
CREATE INDEX "MediaPublicationConsent_expiresAt_status_idx" ON "MediaPublicationConsent"("expiresAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventMediaAuditEvent_publicKey_key" ON "EventMediaAuditEvent"("publicKey");

-- CreateIndex
CREATE INDEX "EventMediaAuditEvent_albumId_eventDate_idx" ON "EventMediaAuditEvent"("albumId", "eventDate");

-- CreateIndex
CREATE INDEX "EventMediaAuditEvent_assetId_eventDate_idx" ON "EventMediaAuditEvent"("assetId", "eventDate");

-- CreateIndex
CREATE INDEX "EventMediaAuditEvent_consentId_eventDate_idx" ON "EventMediaAuditEvent"("consentId", "eventDate");

-- CreateIndex
CREATE INDEX "EventMediaAuditEvent_eventType_eventDate_idx" ON "EventMediaAuditEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "ParentMeeting_publicKey_key" ON "ParentMeeting"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "ParentMeeting_activeRequestKey_key" ON "ParentMeeting"("activeRequestKey");

-- CreateIndex
CREATE INDEX "ParentMeeting_status_scheduledStartAt_idx" ON "ParentMeeting"("status", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "ParentMeeting_studentId_createdAt_idx" ON "ParentMeeting"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentMeeting_requesterGuardianId_createdAt_idx" ON "ParentMeeting"("requesterGuardianId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentMeeting_academicYear_category_status_idx" ON "ParentMeeting"("academicYear", "category", "status");

-- CreateIndex
CREATE INDEX "ParentMeeting_scheduledStartAt_scheduledEndAt_idx" ON "ParentMeeting"("scheduledStartAt", "scheduledEndAt");

-- CreateIndex
CREATE INDEX "ParentMeetingPreference_meetingId_startsAt_idx" ON "ParentMeetingPreference"("meetingId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentMeetingPreference_meetingId_sequence_key" ON "ParentMeetingPreference"("meetingId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ParentMeetingParticipant_publicKey_key" ON "ParentMeetingParticipant"("publicKey");

-- CreateIndex
CREATE INDEX "ParentMeetingParticipant_staffMemberId_status_idx" ON "ParentMeetingParticipant"("staffMemberId", "status");

-- CreateIndex
CREATE INDEX "ParentMeetingParticipant_meetingId_participantRole_status_idx" ON "ParentMeetingParticipant"("meetingId", "participantRole", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ParentMeetingParticipant_meetingId_staffMemberId_key" ON "ParentMeetingParticipant"("meetingId", "staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentMeetingNote_publicKey_key" ON "ParentMeetingNote"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "ParentMeetingNote_correctsNoteId_key" ON "ParentMeetingNote"("correctsNoteId");

-- CreateIndex
CREATE INDEX "ParentMeetingNote_meetingId_kind_createdAt_idx" ON "ParentMeetingNote"("meetingId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ParentMeetingNote_authorUserId_createdAt_idx" ON "ParentMeetingNote"("authorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ParentMeetingNote_correctsNoteId_idx" ON "ParentMeetingNote"("correctsNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentMeetingFollowUp_publicKey_key" ON "ParentMeetingFollowUp"("publicKey");

-- CreateIndex
CREATE INDEX "ParentMeetingFollowUp_meetingId_status_dueDate_idx" ON "ParentMeetingFollowUp"("meetingId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "ParentMeetingFollowUp_responsibleStaffMemberId_status_dueDa_idx" ON "ParentMeetingFollowUp"("responsibleStaffMemberId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "ParentMeetingFollowUp_status_dueDate_idx" ON "ParentMeetingFollowUp"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ParentMeetingEvent_publicKey_key" ON "ParentMeetingEvent"("publicKey");

-- CreateIndex
CREATE INDEX "ParentMeetingEvent_meetingId_occurredAt_idx" ON "ParentMeetingEvent"("meetingId", "occurredAt");

-- CreateIndex
CREATE INDEX "ParentMeetingEvent_eventType_occurredAt_idx" ON "ParentMeetingEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineSyncDevice_publicDeviceId_key" ON "OfflineSyncDevice"("publicDeviceId");

-- CreateIndex
CREATE INDEX "OfflineSyncDevice_userId_status_idx" ON "OfflineSyncDevice"("userId", "status");

-- CreateIndex
CREATE INDEX "OfflineSyncDevice_status_requestedAt_idx" ON "OfflineSyncDevice"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "OfflineSyncDevice_lastSeenAt_idx" ON "OfflineSyncDevice"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineSyncChallenge_challengeHash_key" ON "OfflineSyncChallenge"("challengeHash");

-- CreateIndex
CREATE INDEX "OfflineSyncChallenge_userId_purpose_expiresAt_idx" ON "OfflineSyncChallenge"("userId", "purpose", "expiresAt");

-- CreateIndex
CREATE INDEX "OfflineSyncChallenge_publicDeviceId_purpose_idx" ON "OfflineSyncChallenge"("publicDeviceId", "purpose");

-- CreateIndex
CREATE INDEX "OfflineSyncChallenge_expiresAt_idx" ON "OfflineSyncChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "OfflineSyncNonce_expiresAt_idx" ON "OfflineSyncNonce"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineSyncNonce_deviceId_nonceHash_key" ON "OfflineSyncNonce"("deviceId", "nonceHash");

-- CreateIndex
CREATE INDEX "OfflineSyncMutation_actorUserId_updatedAt_idx" ON "OfflineSyncMutation"("actorUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "OfflineSyncMutation_deviceId_status_updatedAt_idx" ON "OfflineSyncMutation"("deviceId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "OfflineSyncMutation_operationType_status_idx" ON "OfflineSyncMutation"("operationType", "status");

-- CreateIndex
CREATE INDEX "OfflineSyncMutation_authoritativeEntityType_authoritativeEn_idx" ON "OfflineSyncMutation"("authoritativeEntityType", "authoritativeEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineSyncMutation_deviceId_clientMutationId_key" ON "OfflineSyncMutation"("deviceId", "clientMutationId");

-- CreateIndex
CREATE INDEX "OfflineSyncEvent_deviceId_occurredAt_idx" ON "OfflineSyncEvent"("deviceId", "occurredAt");

-- CreateIndex
CREATE INDEX "OfflineSyncEvent_mutationId_occurredAt_idx" ON "OfflineSyncEvent"("mutationId", "occurredAt");

-- CreateIndex
CREATE INDEX "OfflineSyncEvent_actorUserId_occurredAt_idx" ON "OfflineSyncEvent"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "OfflineSyncEvent_eventType_occurredAt_idx" ON "OfflineSyncEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "OfflineSyncConflictReview_mutationId_reviewedAt_idx" ON "OfflineSyncConflictReview"("mutationId", "reviewedAt");

-- CreateIndex
CREATE INDEX "OfflineSyncConflictReview_deviceId_reviewedAt_idx" ON "OfflineSyncConflictReview"("deviceId", "reviewedAt");

-- CreateIndex
CREATE INDEX "OfflineSyncConflictReview_reviewedByUserId_reviewedAt_idx" ON "OfflineSyncConflictReview"("reviewedByUserId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NativeAuthRequest_publicRequestId_key" ON "NativeAuthRequest"("publicRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "NativeAuthRequest_challengeHash_key" ON "NativeAuthRequest"("challengeHash");

-- CreateIndex
CREATE INDEX "NativeAuthRequest_publicDeviceId_status_idx" ON "NativeAuthRequest"("publicDeviceId", "status");

-- CreateIndex
CREATE INDEX "NativeAuthRequest_userId_createdAt_idx" ON "NativeAuthRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NativeAuthRequest_expiresAt_idx" ON "NativeAuthRequest"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NativeAuthorizationCode_codeHash_key" ON "NativeAuthorizationCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "NativeAuthorizationCode_requestId_key" ON "NativeAuthorizationCode"("requestId");

-- CreateIndex
CREATE INDEX "NativeAuthorizationCode_userId_expiresAt_idx" ON "NativeAuthorizationCode"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "NativeAuthorizationCode_deviceId_expiresAt_idx" ON "NativeAuthorizationCode"("deviceId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NativeSession_publicSessionId_key" ON "NativeSession"("publicSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "NativeSession_accessTokenHash_key" ON "NativeSession"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "NativeSession_refreshTokenHash_key" ON "NativeSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "NativeSession_userId_revokedAt_absoluteExpiresAt_idx" ON "NativeSession"("userId", "revokedAt", "absoluteExpiresAt");

-- CreateIndex
CREATE INDEX "NativeSession_deviceId_revokedAt_idx" ON "NativeSession"("deviceId", "revokedAt");

-- CreateIndex
CREATE INDEX "NativeSession_refreshExpiresAt_idx" ON "NativeSession"("refreshExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NativeRefreshTokenHistory_refreshTokenHash_key" ON "NativeRefreshTokenHistory"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "NativeRefreshTokenHistory_sessionId_tokenVersion_idx" ON "NativeRefreshTokenHistory"("sessionId", "tokenVersion");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_familyCollectionId_fkey" FOREIGN KEY ("familyCollectionId") REFERENCES "FamilyCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_familyInstrumentId_fkey" FOREIGN KEY ("familyInstrumentId") REFERENCES "FamilyCollectionInstrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_familyAllocationId_fkey" FOREIGN KEY ("familyAllocationId") REFERENCES "FamilyStudentAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_familyShareId_fkey" FOREIGN KEY ("familyShareId") REFERENCES "AllocationInstrumentShare"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyCollection" ADD CONSTRAINT "FamilyCollection_payerGuardianId_fkey" FOREIGN KEY ("payerGuardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyCollection" ADD CONSTRAINT "FamilyCollection_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyCollection" ADD CONSTRAINT "FamilyCollection_replacesCollectionId_fkey" FOREIGN KEY ("replacesCollectionId") REFERENCES "FamilyCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyCollectionInstrument" ADD CONSTRAINT "FamilyCollectionInstrument_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FamilyCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyStudentAllocation" ADD CONSTRAINT "FamilyStudentAllocation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FamilyCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyStudentAllocation" ADD CONSTRAINT "FamilyStudentAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationInstrumentShare" ADD CONSTRAINT "AllocationInstrumentShare_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "FamilyStudentAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllocationInstrumentShare" ADD CONSTRAINT "AllocationInstrumentShare_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "FamilyCollectionInstrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyReceiptVersion" ADD CONSTRAINT "FamilyReceiptVersion_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FamilyCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyReceiptVersion" ADD CONSTRAINT "FamilyReceiptVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "FamilyReceiptVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyReceiptVersion" ADD CONSTRAINT "FamilyReceiptVersion_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyCollectionEvent" ADD CONSTRAINT "FamilyCollectionEvent_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FamilyCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyCollectionEvent" ADD CONSTRAINT "FamilyCollectionEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyProviderAllocationPlan" ADD CONSTRAINT "FamilyProviderAllocationPlan_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FamilyCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYearEnrollment" ADD CONSTRAINT "AcademicYearEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgressionDecision" ADD CONSTRAINT "StudentProgressionDecision_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgressionDecision" ADD CONSTRAINT "StudentProgressionDecision_sourceEnrollmentId_fkey" FOREIGN KEY ("sourceEnrollmentId") REFERENCES "AcademicYearEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgressionDecision" ADD CONSTRAINT "StudentProgressionDecision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgressionDecision" ADD CONSTRAINT "StudentProgressionDecision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgressionDecision" ADD CONSTRAINT "StudentProgressionDecision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgressionDecision" ADD CONSTRAINT "StudentProgressionDecision_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgressionDecision" ADD CONSTRAINT "StudentProgressionDecision_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLifecycleEvent" ADD CONSTRAINT "StudentLifecycleEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLifecycleEvent" ADD CONSTRAINT "StudentLifecycleEvent_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLifecycleEvent" ADD CONSTRAINT "StudentLifecycleEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendanceSession" ADD CONSTRAINT "StudentAttendanceSession_takenByUserId_fkey" FOREIGN KEY ("takenByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendanceSession" ADD CONSTRAINT "StudentAttendanceSession_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendanceSession" ADD CONSTRAINT "StudentAttendanceSession_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendanceRecord" ADD CONSTRAINT "StudentAttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudentAttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendanceRecord" ADD CONSTRAINT "StudentAttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_timetableTeacherId_fkey" FOREIGN KEY ("timetableTeacherId") REFERENCES "TimetableTeacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceSession" ADD CONSTRAINT "StaffAttendanceSession_takenByUserId_fkey" FOREIGN KEY ("takenByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceSession" ADD CONSTRAINT "StaffAttendanceSession_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceSession" ADD CONSTRAINT "StaffAttendanceSession_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceRecord" ADD CONSTRAINT "StaffAttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StaffAttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceRecord" ADD CONSTRAINT "StaffAttendanceRecord_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteAssignment" ADD CONSTRAINT "SubstituteAssignment_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "StaffLeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteAssignment" ADD CONSTRAINT "SubstituteAssignment_absentStaffMemberId_fkey" FOREIGN KEY ("absentStaffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteAssignment" ADD CONSTRAINT "SubstituteAssignment_substituteStaffMemberId_fkey" FOREIGN KEY ("substituteStaffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteAssignment" ADD CONSTRAINT "SubstituteAssignment_timetableAssignmentId_fkey" FOREIGN KEY ("timetableAssignmentId") REFERENCES "TimetableAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteAssignment" ADD CONSTRAINT "SubstituteAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteAssignment" ADD CONSTRAINT "SubstituteAssignment_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteAssignment" ADD CONSTRAINT "SubstituteAssignment_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstituteAssignment" ADD CONSTRAINT "SubstituteAssignment_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthLoginAlias" ADD CONSTRAINT "AuthLoginAlias_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthLoginAlias" ADD CONSTRAINT "AuthLoginAlias_admissionStudentId_fkey" FOREIGN KEY ("admissionStudentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthVerificationChallenge" ADD CONSTRAINT "AuthVerificationChallenge_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "AuthLoginAlias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthVerificationChallenge" ADD CONSTRAINT "AuthVerificationChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthPasswordResetToken" ADD CONSTRAINT "AuthPasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthPasswordResetToken" ADD CONSTRAINT "AuthPasswordResetToken_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "AuthLoginAlias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionProfileEntry" ADD CONSTRAINT "PermissionProfileEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PermissionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionProfileVersion" ADD CONSTRAINT "PermissionProfileVersion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PermissionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionProfileAssignment" ADD CONSTRAINT "UserPermissionProfileAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionProfileAssignment" ADD CONSTRAINT "UserPermissionProfileAssignment_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PermissionProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSecurityEvent" ADD CONSTRAINT "AuthSecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSecurityEvent" ADD CONSTRAINT "AuthSecurityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ExpenseDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRecord" ADD CONSTRAINT "ExpenseRecord_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "ExpenseRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAudit" ADD CONSTRAINT "ExpenseAudit_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "ExpenseRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAudit" ADD CONSTRAINT "ExpenseAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPlan" ADD CONSTRAINT "BudgetPlan_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetAllocation" ADD CONSTRAINT "BudgetAllocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ExpenseDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiscIncomeItem" ADD CONSTRAINT "MiscIncomeItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiscIncomeRate" ADD CONSTRAINT "MiscIncomeRate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MiscIncomeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiscIncomeReceipt" ADD CONSTRAINT "MiscIncomeReceipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiscIncomeReceipt" ADD CONSTRAINT "MiscIncomeReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiscIncomeReceipt" ADD CONSTRAINT "MiscIncomeReceipt_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiscIncomeReceiptLine" ADD CONSTRAINT "MiscIncomeReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MiscIncomeReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiscIncomeReceiptLine" ADD CONSTRAINT "MiscIncomeReceiptLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MiscIncomeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiscIncomeReceiptLine" ADD CONSTRAINT "MiscIncomeReceiptLine_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "MiscIncomeRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashBookDay" ADD CONSTRAINT "CashBookDay_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashBookDay" ADD CONSTRAINT "CashBookDay_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashBookDay" ADD CONSTRAINT "CashBookDay_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashBookDay" ADD CONSTRAINT "CashBookDay_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashBookDay" ADD CONSTRAINT "CashBookDay_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashBookMovement" ADD CONSTRAINT "CashBookMovement_cashBookDayId_fkey" FOREIGN KEY ("cashBookDayId") REFERENCES "CashBookDay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashBookMovement" ADD CONSTRAINT "CashBookMovement_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashBookMovement" ADD CONSTRAINT "CashBookMovement_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryTitle" ADD CONSTRAINT "LibraryTitle_publisherVendorId_fkey" FOREIGN KEY ("publisherVendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryTitle" ADD CONSTRAINT "LibraryTitle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCopy" ADD CONSTRAINT "LibraryCopy_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCopy" ADD CONSTRAINT "LibraryCopy_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCopy" ADD CONSTRAINT "LibraryCopy_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "ExpenseRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCopy" ADD CONSTRAINT "LibraryCopy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCopy" ADD CONSTRAINT "LibraryCopy_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCopyEvent" ADD CONSTRAINT "LibraryCopyEvent_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCopyEvent" ADD CONSTRAINT "LibraryCopyEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationSession" ADD CONSTRAINT "LibraryStockVerificationSession_titleIdFilter_fkey" FOREIGN KEY ("titleIdFilter") REFERENCES "LibraryTitle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationSession" ADD CONSTRAINT "LibraryStockVerificationSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationSession" ADD CONSTRAINT "LibraryStockVerificationSession_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationSession" ADD CONSTRAINT "LibraryStockVerificationSession_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationSession" ADD CONSTRAINT "LibraryStockVerificationSession_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationSession" ADD CONSTRAINT "LibraryStockVerificationSession_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationSession" ADD CONSTRAINT "LibraryStockVerificationSession_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationSession" ADD CONSTRAINT "LibraryStockVerificationSession_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationRecord" ADD CONSTRAINT "LibraryStockVerificationRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LibraryStockVerificationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationRecord" ADD CONSTRAINT "LibraryStockVerificationRecord_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationRecord" ADD CONSTRAINT "LibraryStockVerificationRecord_appliedCopyEventId_fkey" FOREIGN KEY ("appliedCopyEventId") REFERENCES "LibraryCopyEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationRecord" ADD CONSTRAINT "LibraryStockVerificationRecord_observedByUserId_fkey" FOREIGN KEY ("observedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationRecord" ADD CONSTRAINT "LibraryStockVerificationRecord_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationRecord" ADD CONSTRAINT "LibraryStockVerificationRecord_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationScanEvent" ADD CONSTRAINT "LibraryStockVerificationScanEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LibraryStockVerificationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationScanEvent" ADD CONSTRAINT "LibraryStockVerificationScanEvent_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "LibraryStockVerificationRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationScanEvent" ADD CONSTRAINT "LibraryStockVerificationScanEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationEvent" ADD CONSTRAINT "LibraryStockVerificationEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LibraryStockVerificationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryStockVerificationEvent" ADD CONSTRAINT "LibraryStockVerificationEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryMember" ADD CONSTRAINT "LibraryMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryMember" ADD CONSTRAINT "LibraryMember_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryMember" ADD CONSTRAINT "LibraryMember_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryMember" ADD CONSTRAINT "LibraryMember_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryPolicy" ADD CONSTRAINT "LibraryPolicy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoan" ADD CONSTRAINT "LibraryLoan_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoan" ADD CONSTRAINT "LibraryLoan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoan" ADD CONSTRAINT "LibraryLoan_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoan" ADD CONSTRAINT "LibraryLoan_returnedByUserId_fkey" FOREIGN KEY ("returnedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoan" ADD CONSTRAINT "LibraryLoan_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_fulfilledLoanId_fkey" FOREIGN KEY ("fulfilledLoanId") REFERENCES "LibraryLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_fulfilledByUserId_fkey" FOREIGN KEY ("fulfilledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoanEvent" ADD CONSTRAINT "LibraryLoanEvent_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LibraryLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoanEvent" ADD CONSTRAINT "LibraryLoanEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "LibraryReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoanEvent" ADD CONSTRAINT "LibraryLoanEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoanEvent" ADD CONSTRAINT "LibraryLoanEvent_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoanEvent" ADD CONSTRAINT "LibraryLoanEvent_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryLoanEvent" ADD CONSTRAINT "LibraryLoanEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIncident" ADD CONSTRAINT "LibraryIncident_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LibraryLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIncident" ADD CONSTRAINT "LibraryIncident_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIncident" ADD CONSTRAINT "LibraryIncident_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIncident" ADD CONSTRAINT "LibraryIncident_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIncident" ADD CONSTRAINT "LibraryIncident_replacementCopyId_fkey" FOREIGN KEY ("replacementCopyId") REFERENCES "LibraryCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIncident" ADD CONSTRAINT "LibraryIncident_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIncident" ADD CONSTRAINT "LibraryIncident_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIncident" ADD CONSTRAINT "LibraryIncident_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIncident" ADD CONSTRAINT "LibraryIncident_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryIncident" ADD CONSTRAINT "LibraryIncident_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryChargeRule" ADD CONSTRAINT "LibraryChargeRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LibraryLoan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "LibraryIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_miscIncomeReceiptId_fkey" FOREIGN KEY ("miscIncomeReceiptId") REFERENCES "MiscIncomeReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_waivedByUserId_fkey" FOREIGN KEY ("waivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_collectedByUserId_fkey" FOREIGN KEY ("collectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryCharge" ADD CONSTRAINT "LibraryCharge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryChargeEvent" ADD CONSTRAINT "LibraryChargeEvent_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "LibraryCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryChargeEvent" ADD CONSTRAINT "LibraryChargeEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "LibraryIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryChargeEvent" ADD CONSTRAINT "LibraryChargeEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCatalogItem" ADD CONSTRAINT "BookCatalogItem_publisherVendorId_fkey" FOREIGN KEY ("publisherVendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCatalogItem" ADD CONSTRAINT "BookCatalogItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCatalogRate" ADD CONSTRAINT "BookCatalogRate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BookCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSaleReceipt" ADD CONSTRAINT "BookSaleReceipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSaleReceipt" ADD CONSTRAINT "BookSaleReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSaleReceipt" ADD CONSTRAINT "BookSaleReceipt_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSaleReceiptLine" ADD CONSTRAINT "BookSaleReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "BookSaleReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSaleReceiptLine" ADD CONSTRAINT "BookSaleReceiptLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BookCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSaleReceiptLine" ADD CONSTRAINT "BookSaleReceiptLine_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "BookCatalogRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCashSettlement" ADD CONSTRAINT "BookCashSettlement_cashBookMovementId_fkey" FOREIGN KEY ("cashBookMovementId") REFERENCES "CashBookMovement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCashSettlement" ADD CONSTRAINT "BookCashSettlement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCashSettlement" ADD CONSTRAINT "BookCashSettlement_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCashSettlement" ADD CONSTRAINT "BookCashSettlement_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCashSettlement" ADD CONSTRAINT "BookCashSettlement_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAudit" ADD CONSTRAINT "PaymentAudit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAudit" ADD CONSTRAINT "PaymentAudit_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRowOutcome" ADD CONSTRAINT "OnboardingRowOutcome_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OnboardingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingAuditEvent" ADD CONSTRAINT "OnboardingAuditEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OnboardingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_timetableSubjectId_fkey" FOREIGN KEY ("timetableSubjectId") REFERENCES "TimetableSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignment" ADD CONSTRAINT "HomeworkAssignment_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignmentEvent" ADD CONSTRAINT "HomeworkAssignmentEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkAssignmentEvent" ADD CONSTRAINT "HomeworkAssignmentEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkItem" ADD CONSTRAINT "ClassworkItem_timetableSubjectId_fkey" FOREIGN KEY ("timetableSubjectId") REFERENCES "TimetableSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkItemVersion" ADD CONSTRAINT "ClassworkItemVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClassworkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkSubmission" ADD CONSTRAINT "ClassworkSubmission_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClassworkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkSubmission" ADD CONSTRAINT "ClassworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkSubmissionVersion" ADD CONSTRAINT "ClassworkSubmissionVersion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ClassworkSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkSubmissionVersion" ADD CONSTRAINT "ClassworkSubmissionVersion_itemVersionId_fkey" FOREIGN KEY ("itemVersionId") REFERENCES "ClassworkItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkAttachment" ADD CONSTRAINT "ClassworkAttachment_itemVersionId_fkey" FOREIGN KEY ("itemVersionId") REFERENCES "ClassworkItemVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkAttachment" ADD CONSTRAINT "ClassworkAttachment_submissionVersionId_fkey" FOREIGN KEY ("submissionVersionId") REFERENCES "ClassworkSubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkFeedback" ADD CONSTRAINT "ClassworkFeedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ClassworkSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkFeedback" ADD CONSTRAINT "ClassworkFeedback_submissionVersionId_fkey" FOREIGN KEY ("submissionVersionId") REFERENCES "ClassworkSubmissionVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkAuditEvent" ADD CONSTRAINT "ClassworkAuditEvent_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClassworkItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassworkAuditEvent" ADD CONSTRAINT "ClassworkAuditEvent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ClassworkSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAssessment" ADD CONSTRAINT "ExamAssessment_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAssessment" ADD CONSTRAINT "ExamAssessment_timetableSubjectId_fkey" FOREIGN KEY ("timetableSubjectId") REFERENCES "TimetableSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMark" ADD CONSTRAINT "StudentMark_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ExamAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMark" ADD CONSTRAINT "StudentMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMarkEvent" ADD CONSTRAINT "StudentMarkEvent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ExamAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationClassScope" ADD CONSTRAINT "ExaminationClassScope_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationClassScope" ADD CONSTRAINT "ExaminationClassScope_timetableClassSectionId_fkey" FOREIGN KEY ("timetableClassSectionId") REFERENCES "TimetableClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSchemeVersion" ADD CONSTRAINT "ExaminationSchemeVersion_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSchemeVersion" ADD CONSTRAINT "ExaminationSchemeVersion_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSchemeVersion" ADD CONSTRAINT "ExaminationSchemeVersion_subjectPaperId_fkey" FOREIGN KEY ("subjectPaperId") REFERENCES "ExamSubjectPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSchemeVersion" ADD CONSTRAINT "ExaminationSchemeVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "ExaminationSchemeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationComponent" ADD CONSTRAINT "ExaminationComponent_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "ExaminationSchemeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectPaper" ADD CONSTRAINT "ExamSubjectPaper_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectPaper" ADD CONSTRAINT "ExamSubjectPaper_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectPaper" ADD CONSTRAINT "ExamSubjectPaper_timetableSubjectId_fkey" FOREIGN KEY ("timetableSubjectId") REFERENCES "TimetableSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationTimetableVersion" ADD CONSTRAINT "ExaminationTimetableVersion_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationTimetableVersion" ADD CONSTRAINT "ExaminationTimetableVersion_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationTimetableVersion" ADD CONSTRAINT "ExaminationTimetableVersion_replacesVersionId_fkey" FOREIGN KEY ("replacesVersionId") REFERENCES "ExaminationTimetableVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationTimetableRow" ADD CONSTRAINT "ExaminationTimetableRow_timetableVersionId_fkey" FOREIGN KEY ("timetableVersionId") REFERENCES "ExaminationTimetableVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationTimetableRow" ADD CONSTRAINT "ExaminationTimetableRow_subjectPaperId_fkey" FOREIGN KEY ("subjectPaperId") REFERENCES "ExamSubjectPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationTimetableEvent" ADD CONSTRAINT "ExaminationTimetableEvent_timetableVersionId_fkey" FOREIGN KEY ("timetableVersionId") REFERENCES "ExaminationTimetableVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectGroup" ADD CONSTRAINT "ExamSubjectGroup_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectGroup" ADD CONSTRAINT "ExamSubjectGroup_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectGroupMember" ADD CONSTRAINT "ExamSubjectGroupMember_subjectGroupId_fkey" FOREIGN KEY ("subjectGroupId") REFERENCES "ExamSubjectGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSubjectGroupMember" ADD CONSTRAINT "ExamSubjectGroupMember_subjectPaperId_fkey" FOREIGN KEY ("subjectPaperId") REFERENCES "ExamSubjectPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeScaleVersion" ADD CONSTRAINT "GradeScaleVersion_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeScaleVersion" ADD CONSTRAINT "GradeScaleVersion_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeScaleBand" ADD CONSTRAINT "GradeScaleBand_gradeScaleVersionId_fkey" FOREIGN KEY ("gradeScaleVersionId") REFERENCES "GradeScaleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticSchemeVersion" ADD CONSTRAINT "CoScholasticSchemeVersion_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticSchemeVersion" ADD CONSTRAINT "CoScholasticSchemeVersion_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoScholasticItem" ADD CONSTRAINT "CoScholasticItem_coScholasticSchemeVersionId_fkey" FOREIGN KEY ("coScholasticSchemeVersionId") REFERENCES "CoScholasticSchemeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTemplateFamilyBinding" ADD CONSTRAINT "ExamTemplateFamilyBinding_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTemplateFamilyBinding" ADD CONSTRAINT "ExamTemplateFamilyBinding_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTemplateFamilyBinding" ADD CONSTRAINT "ExamTemplateFamilyBinding_reportCardTemplateId_fkey" FOREIGN KEY ("reportCardTemplateId") REFERENCES "ReportCardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExamAssignment" ADD CONSTRAINT "TeacherExamAssignment_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExamAssignment" ADD CONSTRAINT "TeacherExamAssignment_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExamAssignment" ADD CONSTRAINT "TeacherExamAssignment_timetableClassSectionId_fkey" FOREIGN KEY ("timetableClassSectionId") REFERENCES "TimetableClassSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExamAssignment" ADD CONSTRAINT "TeacherExamAssignment_subjectPaperId_fkey" FOREIGN KEY ("subjectPaperId") REFERENCES "ExamSubjectPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExamAssignment" ADD CONSTRAINT "TeacherExamAssignment_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "ExaminationSchemeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExamAssignment" ADD CONSTRAINT "TeacherExamAssignment_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ExaminationComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExamAssignment" ADD CONSTRAINT "TeacherExamAssignment_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExamAssignment" ADD CONSTRAINT "TeacherExamAssignment_timetableTeacherId_fkey" FOREIGN KEY ("timetableTeacherId") REFERENCES "TimetableTeacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExamAssignment" ADD CONSTRAINT "TeacherExamAssignment_timetableAssignmentId_fkey" FOREIGN KEY ("timetableAssignmentId") REFERENCES "TimetableAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSchemeAudit" ADD CONSTRAINT "ExaminationSchemeAudit_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSchemeAudit" ADD CONSTRAINT "ExaminationSchemeAudit_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "ExaminationSchemeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExaminationSchemeAudit" ADD CONSTRAINT "ExaminationSchemeAudit_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TeacherExamAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMarkSheet" ADD CONSTRAINT "ExamMarkSheet_supersedesSheetId_fkey" FOREIGN KEY ("supersedesSheetId") REFERENCES "ExamMarkSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMarkSheet" ADD CONSTRAINT "ExamMarkSheet_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMarkSheet" ADD CONSTRAINT "ExamMarkSheet_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMarkSheet" ADD CONSTRAINT "ExamMarkSheet_subjectPaperId_fkey" FOREIGN KEY ("subjectPaperId") REFERENCES "ExamSubjectPaper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMarkSheet" ADD CONSTRAINT "ExamMarkSheet_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ExaminationComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMarkSheet" ADD CONSTRAINT "ExamMarkSheet_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "ExaminationSchemeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMarkSheet" ADD CONSTRAINT "ExamMarkSheet_primaryAssignmentId_fkey" FOREIGN KEY ("primaryAssignmentId") REFERENCES "TeacherExamAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMarkEntry" ADD CONSTRAINT "ExamMarkEntry_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "ExamMarkSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamMarkEntry" ADD CONSTRAINT "ExamMarkEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultSnapshot" ADD CONSTRAINT "StudentResultSnapshot_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultSnapshot" ADD CONSTRAINT "StudentResultSnapshot_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultSnapshot" ADD CONSTRAINT "StudentResultSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResultSnapshot" ADD CONSTRAINT "StudentResultSnapshot_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "ExaminationSchemeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeBand" ADD CONSTRAINT "GradeBand_gradingSchemeId_fkey" FOREIGN KEY ("gradingSchemeId") REFERENCES "GradingScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardTemplate" ADD CONSTRAINT "ReportCardTemplate_gradingSchemeId_fkey" FOREIGN KEY ("gradingSchemeId") REFERENCES "GradingScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardBatch" ADD CONSTRAINT "ReportCardBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportCardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardBatchExamSource" ADD CONSTRAINT "ReportCardBatchExamSource_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReportCardBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCardBatchExamSource" ADD CONSTRAINT "ReportCardBatchExamSource_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentReportCard" ADD CONSTRAINT "StudentReportCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReportCardBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentReportCard" ADD CONSTRAINT "StudentReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentReportCardVersion" ADD CONSTRAINT "StudentReportCardVersion_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "StudentReportCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicReportRun" ADD CONSTRAINT "AcademicReportRun_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AcademicReportDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicReportRun" ADD CONSTRAINT "AcademicReportRun_supersedesRunId_fkey" FOREIGN KEY ("supersedesRunId") REFERENCES "AcademicReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicReportSourceReference" ADD CONSTRAINT "AcademicReportSourceReference_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "AcademicReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicReportSourceReference" ADD CONSTRAINT "AcademicReportSourceReference_resultSnapshotId_fkey" FOREIGN KEY ("resultSnapshotId") REFERENCES "StudentResultSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicReportSourceReference" ADD CONSTRAINT "AcademicReportSourceReference_reportCardVersionId_fkey" FOREIGN KEY ("reportCardVersionId") REFERENCES "StudentReportCardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicReportAuditEvent" ADD CONSTRAINT "AcademicReportAuditEvent_reportRunId_fkey" FOREIGN KEY ("reportRunId") REFERENCES "AcademicReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarVersion" ADD CONSTRAINT "AcademicCalendarVersion_replacesVersionId_fkey" FOREIGN KEY ("replacesVersionId") REFERENCES "AcademicCalendarVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalCalendarDay" ADD CONSTRAINT "OperationalCalendarDay_calendarVersionId_fkey" FOREIGN KEY ("calendarVersionId") REFERENCES "AcademicCalendarVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCalendarEvent" ADD CONSTRAINT "SchoolCalendarEvent_currentPublishedVersionId_fkey" FOREIGN KEY ("currentPublishedVersionId") REFERENCES "SchoolCalendarEventVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCalendarEventVersion" ADD CONSTRAINT "SchoolCalendarEventVersion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "SchoolCalendarEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCalendarEventVersion" ADD CONSTRAINT "SchoolCalendarEventVersion_examinationTimetableVersionId_fkey" FOREIGN KEY ("examinationTimetableVersionId") REFERENCES "ExaminationTimetableVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolCalendarEventVersion" ADD CONSTRAINT "SchoolCalendarEventVersion_replacesVersionId_fkey" FOREIGN KEY ("replacesVersionId") REFERENCES "SchoolCalendarEventVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarAuditEvent" ADD CONSTRAINT "AcademicCalendarAuditEvent_calendarVersionId_fkey" FOREIGN KEY ("calendarVersionId") REFERENCES "AcademicCalendarVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarAuditEvent" ADD CONSTRAINT "AcademicCalendarAuditEvent_schoolEventId_fkey" FOREIGN KEY ("schoolEventId") REFERENCES "SchoolCalendarEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicCalendarAuditEvent" ADD CONSTRAINT "AcademicCalendarAuditEvent_eventVersionId_fkey" FOREIGN KEY ("eventVersionId") REFERENCES "SchoolCalendarEventVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentReportCardEvent" ADD CONSTRAINT "StudentReportCardEvent_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "StudentReportCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableAssignment" ADD CONSTRAINT "TimetableAssignment_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "TimetableClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableAssignment" ADD CONSTRAINT "TimetableAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "TimetableSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableAssignment" ADD CONSTRAINT "TimetableAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TimetableTeacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableTeacherUnavailability" ADD CONSTRAINT "TimetableTeacherUnavailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TimetableTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableFixedPeriod" ADD CONSTRAINT "TimetableFixedPeriod_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "TimetableClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableFixedPeriod" ADD CONSTRAINT "TimetableFixedPeriod_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TimetableTeacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableFixedPeriod" ADD CONSTRAINT "TimetableFixedPeriod_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "TimetableSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableDraft" ADD CONSTRAINT "TimetableDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TimetableDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "TimetableClassSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TimetableAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TimetableTeacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableEntry" ADD CONSTRAINT "TimetableEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "TimetableSubject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAnalyticsSnapshot" ADD CONSTRAINT "TeacherAnalyticsSnapshot_reviewCycleId_fkey" FOREIGN KEY ("reviewCycleId") REFERENCES "TeacherAnalyticsReviewCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAnalyticsSnapshot" ADD CONSTRAINT "TeacherAnalyticsSnapshot_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAnalyticsReview" ADD CONSTRAINT "TeacherAnalyticsReview_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeacherAnalyticsSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAnalyticsEvent" ADD CONSTRAINT "TeacherAnalyticsEvent_reviewCycleId_fkey" FOREIGN KEY ("reviewCycleId") REFERENCES "TeacherAnalyticsReviewCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAnalyticsEvent" ADD CONSTRAINT "TeacherAnalyticsEvent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeacherAnalyticsSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAnalyticsEvent" ADD CONSTRAINT "TeacherAnalyticsEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "TeacherAnalyticsReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassXDocumentPackage" ADD CONSTRAINT "ClassXDocumentPackage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassXDocumentPackage" ADD CONSTRAINT "ClassXDocumentPackage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ClassXPackageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassXPackageDocumentItem" ADD CONSTRAINT "ClassXPackageDocumentItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassXPackageCharge" ADD CONSTRAINT "ClassXPackageCharge_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassXPackageCharge" ADD CONSTRAINT "ClassXPackageCharge_chargeRuleId_fkey" FOREIGN KEY ("chargeRuleId") REFERENCES "ClassXPackageChargeRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassXPackageCharge" ADD CONSTRAINT "ClassXPackageCharge_linkedMiscIncomeReceiptId_fkey" FOREIGN KEY ("linkedMiscIncomeReceiptId") REFERENCES "MiscIncomeReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassXPackageHandover" ADD CONSTRAINT "ClassXPackageHandover_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassXPackageEvent" ADD CONSTRAINT "ClassXPackageEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCardBatch" ADD CONSTRAINT "IdentityCardBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IdentityCardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCard" ADD CONSTRAINT "IdentityCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IdentityCardBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCard" ADD CONSTRAINT "IdentityCard_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IdentityCardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCard" ADD CONSTRAINT "IdentityCard_numberSeriesId_fkey" FOREIGN KEY ("numberSeriesId") REFERENCES "IdentityCardNumberSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCard" ADD CONSTRAINT "IdentityCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCard" ADD CONSTRAINT "IdentityCard_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCard" ADD CONSTRAINT "IdentityCard_replacesCardId_fkey" FOREIGN KEY ("replacesCardId") REFERENCES "IdentityCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCardVersion" ADD CONSTRAINT "IdentityCardVersion_identityCardId_fkey" FOREIGN KEY ("identityCardId") REFERENCES "IdentityCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCardEvent" ADD CONSTRAINT "IdentityCardEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IdentityCardBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCardEvent" ADD CONSTRAINT "IdentityCardEvent_identityCardId_fkey" FOREIGN KEY ("identityCardId") REFERENCES "IdentityCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityCardEvent" ADD CONSTRAINT "IdentityCardEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "IdentityCardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationCampaign" ADD CONSTRAINT "NotificationCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationCampaign" ADD CONSTRAINT "NotificationCampaign_correctionOfCampaignId_fkey" FOREIGN KEY ("correctionOfCampaignId") REFERENCES "NotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSkippedRecipient" ADD CONSTRAINT "NotificationSkippedRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "NotificationRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConsent" ADD CONSTRAINT "WhatsAppConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConsent" ADD CONSTRAINT "WhatsAppConsent_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppConsentEvent" ADD CONSTRAINT "WhatsAppConsentEvent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "WhatsAppConsent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplateMapping" ADD CONSTRAINT "WhatsAppTemplateMapping_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOutboundBatch" ADD CONSTRAINT "WhatsAppOutboundBatch_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOutboundBatch" ADD CONSTRAINT "WhatsAppOutboundBatch_notificationCampaignId_fkey" FOREIGN KEY ("notificationCampaignId") REFERENCES "NotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOutboundBatch" ADD CONSTRAINT "WhatsAppOutboundBatch_templateMappingId_fkey" FOREIGN KEY ("templateMappingId") REFERENCES "WhatsAppTemplateMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppDelivery" ADD CONSTRAINT "WhatsAppDelivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WhatsAppOutboundBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppDeliveryAttempt" ADD CONSTRAINT "WhatsAppDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "WhatsAppDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppWebhookEvent" ADD CONSTRAINT "WhatsAppWebhookEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppWebhookEvent" ADD CONSTRAINT "WhatsAppWebhookEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "WhatsAppDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOperationalEvent" ADD CONSTRAINT "WhatsAppOperationalEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppOperationalEvent" ADD CONSTRAINT "WhatsAppOperationalEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WhatsAppOutboundBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppRateReference" ADD CONSTRAINT "WhatsAppRateReference_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailConsent" ADD CONSTRAINT "SmsEmailConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailConsent" ADD CONSTRAINT "SmsEmailConsent_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailConsentEvent" ADD CONSTRAINT "SmsEmailConsentEvent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "SmsEmailConsent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailTemplateMapping" ADD CONSTRAINT "SmsEmailTemplateMapping_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailOutboundBatch" ADD CONSTRAINT "SmsEmailOutboundBatch_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailOutboundBatch" ADD CONSTRAINT "SmsEmailOutboundBatch_notificationCampaignId_fkey" FOREIGN KEY ("notificationCampaignId") REFERENCES "NotificationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailOutboundBatch" ADD CONSTRAINT "SmsEmailOutboundBatch_templateMappingId_fkey" FOREIGN KEY ("templateMappingId") REFERENCES "SmsEmailTemplateMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailDelivery" ADD CONSTRAINT "SmsEmailDelivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SmsEmailOutboundBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailDelivery" ADD CONSTRAINT "SmsEmailDelivery_notificationRecipientId_fkey" FOREIGN KEY ("notificationRecipientId") REFERENCES "NotificationRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailDelivery" ADD CONSTRAINT "SmsEmailDelivery_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailDelivery" ADD CONSTRAINT "SmsEmailDelivery_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailDelivery" ADD CONSTRAINT "SmsEmailDelivery_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "SmsEmailConsent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailDeliveryAttempt" ADD CONSTRAINT "SmsEmailDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SmsEmailDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailWebhookEvent" ADD CONSTRAINT "SmsEmailWebhookEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailWebhookEvent" ADD CONSTRAINT "SmsEmailWebhookEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SmsEmailDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailOperationalEvent" ADD CONSTRAINT "SmsEmailOperationalEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailOperationalEvent" ADD CONSTRAINT "SmsEmailOperationalEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SmsEmailOutboundBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailSuppression" ADD CONSTRAINT "SmsEmailSuppression_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailSuppression" ADD CONSTRAINT "SmsEmailSuppression_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsEmailCostRate" ADD CONSTRAINT "SmsEmailCostRate_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRegisterOcrBatch" ADD CONSTRAINT "FeeRegisterOcrBatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FeeRegisterOcrProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRegisterOcrPage" ADD CONSTRAINT "FeeRegisterOcrPage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeeRegisterOcrBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRegisterOcrRow" ADD CONSTRAINT "FeeRegisterOcrRow_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "FeeRegisterOcrPage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRegisterOcrRowRevision" ADD CONSTRAINT "FeeRegisterOcrRowRevision_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "FeeRegisterOcrRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRegisterOcrPostingRun" ADD CONSTRAINT "FeeRegisterOcrPostingRun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeeRegisterOcrBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeRegisterOcrEvent" ADD CONSTRAINT "FeeRegisterOcrEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeeRegisterOcrBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupSchedule" ADD CONSTRAINT "CloudBackupSchedule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupRetentionPolicy" ADD CONSTRAINT "CloudBackupRetentionPolicy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupRun" ADD CONSTRAINT "CloudBackupRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupRun" ADD CONSTRAINT "CloudBackupRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CloudBackupSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupArtifact" ADD CONSTRAINT "CloudBackupArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupVerification" ADD CONSTRAINT "CloudBackupVerification_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupVerification" ADD CONSTRAINT "CloudBackupVerification_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CloudBackupArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupRestoreRehearsal" ADD CONSTRAINT "CloudBackupRestoreRehearsal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupRestoreRehearsal" ADD CONSTRAINT "CloudBackupRestoreRehearsal_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CloudBackupArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupEvent" ADD CONSTRAINT "CloudBackupEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupEvent" ADD CONSTRAINT "CloudBackupEvent_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CloudBackupSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupEvent" ADD CONSTRAINT "CloudBackupEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupEvent" ADD CONSTRAINT "CloudBackupEvent_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CloudBackupArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CloudBackupEvent" ADD CONSTRAINT "CloudBackupEvent_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "CloudBackupRestoreRehearsal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicWebsitePageVersion" ADD CONSTRAINT "PublicWebsitePageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PublicWebsitePage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicWebsitePostVersion" ADD CONSTRAINT "PublicWebsitePostVersion_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PublicWebsitePost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicWebsiteNavigationItem" ADD CONSTRAINT "PublicWebsiteNavigationItem_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PublicWebsitePage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionEnquiry" ADD CONSTRAINT "AdmissionEnquiry_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AdmissionCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnquiryFollowUp" ADD CONSTRAINT "EnquiryFollowUp_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "AdmissionEnquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolVisit" ADD CONSTRAINT "SchoolVisit_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "AdmissionEnquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AdmissionCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "AdmissionEnquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplicationVersion" ADD CONSTRAINT "AdmissionApplicationVersion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicantChild" ADD CONSTRAINT "ApplicantChild_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectiveGuardian" ADD CONSTRAINT "ProspectiveGuardian_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationReview" ADD CONSTRAINT "ApplicationReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDecision" ADD CONSTRAINT "AdmissionDecision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionOffer" ADD CONSTRAINT "AdmissionOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionConversion" ADD CONSTRAINT "AdmissionConversion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDuplicateResolution" ADD CONSTRAINT "AdmissionDuplicateResolution_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionEvent" ADD CONSTRAINT "AdmissionEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructureVersion" ADD CONSTRAINT "SalaryStructureVersion_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PayrollPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryComponentDefinition" ADD CONSTRAINT "SalaryComponentDefinition_structureVersionId_fkey" FOREIGN KEY ("structureVersionId") REFERENCES "SalaryStructureVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompensationAssignment" ADD CONSTRAINT "StaffCompensationAssignment_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompensationAssignment" ADD CONSTRAINT "StaffCompensationAssignment_structureVersionId_fkey" FOREIGN KEY ("structureVersionId") REFERENCES "SalaryStructureVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRevision" ADD CONSTRAINT "SalaryRevision_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRevision" ADD CONSTRAINT "SalaryRevision_previousAssignmentId_fkey" FOREIGN KEY ("previousAssignmentId") REFERENCES "StaffCompensationAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryRevision" ADD CONSTRAINT "SalaryRevision_newAssignmentId_fkey" FOREIGN KEY ("newAssignmentId") REFERENCES "StaffCompensationAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "PayrollPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayrollResult" ADD CONSTRAINT "EmployeePayrollResult_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayrollResult" ADD CONSTRAINT "EmployeePayrollResult_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayrollResult" ADD CONSTRAINT "EmployeePayrollResult_compensationAssignmentId_fkey" FOREIGN KEY ("compensationAssignmentId") REFERENCES "StaffCompensationAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePayrollResult" ADD CONSTRAINT "EmployeePayrollResult_salaryRevisionId_fkey" FOREIGN KEY ("salaryRevisionId") REFERENCES "SalaryRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollComponentResult" ADD CONSTRAINT "PayrollComponentResult_employeePayrollResultId_fkey" FOREIGN KEY ("employeePayrollResultId") REFERENCES "EmployeePayrollResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollComponentResult" ADD CONSTRAINT "PayrollComponentResult_componentDefinitionId_fkey" FOREIGN KEY ("componentDefinitionId") REFERENCES "SalaryComponentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAdvance" ADD CONSTRAINT "SalaryAdvance_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceRecoverySchedule" ADD CONSTRAINT "AdvanceRecoverySchedule_salaryAdvanceId_fkey" FOREIGN KEY ("salaryAdvanceId") REFERENCES "SalaryAdvance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceRecoverySchedule" ADD CONSTRAINT "AdvanceRecoverySchedule_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceRecoverySchedule" ADD CONSTRAINT "AdvanceRecoverySchedule_employeePayrollResultId_fkey" FOREIGN KEY ("employeePayrollResultId") REFERENCES "EmployeePayrollResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipVersion" ADD CONSTRAINT "PayslipVersion_employeePayrollResultId_fkey" FOREIGN KEY ("employeePayrollResultId") REFERENCES "EmployeePayrollResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipVersion" ADD CONSTRAINT "PayslipVersion_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipVersion" ADD CONSTRAINT "PayslipVersion_supersedesPayslipId_fkey" FOREIGN KEY ("supersedesPayslipId") REFERENCES "PayslipVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEvent" ADD CONSTRAINT "PayrollEvent_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipMonthAvailability" ADD CONSTRAINT "StaffPayslipMonthAvailability_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipRequest" ADD CONSTRAINT "StaffPayslipRequest_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipRequest" ADD CONSTRAINT "StaffPayslipRequest_correctionOfRequestId_fkey" FOREIGN KEY ("correctionOfRequestId") REFERENCES "StaffPayslipRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipRequestMonth" ADD CONSTRAINT "StaffPayslipRequestMonth_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffPayslipRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipRequestEvent" ADD CONSTRAINT "StaffPayslipRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffPayslipRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipDocumentVersion" ADD CONSTRAINT "StaffPayslipDocumentVersion_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffPayslipRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipDocumentVersion" ADD CONSTRAINT "StaffPayslipDocumentVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "StaffPayslipDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipDocumentMonth" ADD CONSTRAINT "StaffPayslipDocumentMonth_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "StaffPayslipDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipDocumentMonth" ADD CONSTRAINT "StaffPayslipDocumentMonth_requestMonthId_fkey" FOREIGN KEY ("requestMonthId") REFERENCES "StaffPayslipRequestMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipAccessEvent" ADD CONSTRAINT "StaffPayslipAccessEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StaffPayslipRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipAccessEvent" ADD CONSTRAINT "StaffPayslipAccessEvent_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "StaffPayslipDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayslipAccessEvent" ADD CONSTRAINT "StaffPayslipAccessEvent_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportCategoryPolicy" ADD CONSTRAINT "SupportCategoryPolicy_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_categoryPolicyId_fkey" FOREIGN KEY ("categoryPolicyId") REFERENCES "SupportCategoryPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequestParticipant" ADD CONSTRAINT "SupportRequestParticipant_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequestLinkedChild" ADD CONSTRAINT "SupportRequestLinkedChild_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequestEvent" ADD CONSTRAINT "SupportRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequestMessage" ADD CONSTRAINT "SupportRequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequestMessage" ADD CONSTRAINT "SupportRequestMessage_correctsMessageId_fkey" FOREIGN KEY ("correctsMessageId") REFERENCES "SupportRequestMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequestAttachment" ADD CONSTRAINT "SupportRequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequestAttachment" ADD CONSTRAINT "SupportRequestAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportRequestMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAssignment" ADD CONSTRAINT "SupportAssignment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAssignment" ADD CONSTRAINT "SupportAssignment_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "SupportQueue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportEscalation" ADD CONSTRAINT "SupportEscalation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSlaSnapshot" ADD CONSTRAINT "SupportSlaSnapshot_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSlaSnapshot" ADD CONSTRAINT "SupportSlaSnapshot_categoryPolicyId_fkey" FOREIGN KEY ("categoryPolicyId") REFERENCES "SupportCategoryPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportResolution" ADD CONSTRAINT "SupportResolution_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSatisfactionResponse" ADD CONSTRAINT "SupportSatisfactionResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSatisfactionResponse" ADD CONSTRAINT "SupportSatisfactionResponse_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "SupportResolution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessEvent" ADD CONSTRAINT "SupportAccessEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureRequest" ADD CONSTRAINT "StudentDepartureRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureConsentEvidence" ADD CONSTRAINT "StudentDepartureConsentEvidence_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureConsentEvidence" ADD CONSTRAINT "StudentDepartureConsentEvidence_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStandingDepartureAuthorization" ADD CONSTRAINT "StudentStandingDepartureAuthorization_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentStandingDepartureAuthorization" ADD CONSTRAINT "StudentStandingDepartureAuthorization_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGatePass" ADD CONSTRAINT "StudentGatePass_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureHandover" ADD CONSTRAINT "StudentDepartureHandover_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureEvent" ADD CONSTRAINT "StudentDepartureEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureCorrectionEvent" ADD CONSTRAINT "StudentDepartureCorrectionEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCampusPresenceEvent" ADD CONSTRAINT "StudentCampusPresenceEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCampusPresenceEvent" ADD CONSTRAINT "StudentCampusPresenceEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureIncident" ADD CONSTRAINT "StudentDepartureIncident_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureIncident" ADD CONSTRAINT "StudentDepartureIncident_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureIncidentAction" ADD CONSTRAINT "StudentDepartureIncidentAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "StudentDepartureIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureNotificationOutbox" ADD CONSTRAINT "StudentDepartureNotificationOutbox_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDepartureFallbackTask" ADD CONSTRAINT "StudentDepartureFallbackTask_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalCheckRun" ADD CONSTRAINT "OperationalCheckRun_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "OperationalCheckDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalMetricSnapshot" ADD CONSTRAINT "OperationalMetricSnapshot_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "OperationalCheckDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlertEvent" ADD CONSTRAINT "OperationalAlertEvent_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "OperationalAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalIncident" ADD CONSTRAINT "OperationalIncident_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "OperationalAlert"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalIncidentEvent" ADD CONSTRAINT "OperationalIncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceWindowEvent" ADD CONSTRAINT "MaintenanceWindowEvent_maintenanceWindowId_fkey" FOREIGN KEY ("maintenanceWindowId") REFERENCES "MaintenanceWindow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminDiaryEntry" ADD CONSTRAINT "SuperAdminDiaryEntry_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminTask" ADD CONSTRAINT "SuperAdminTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminContact" ADD CONSTRAINT "SuperAdminContact_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminWorkAudit" ADD CONSTRAINT "SuperAdminWorkAudit_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminWorkAudit" ADD CONSTRAINT "SuperAdminWorkAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_driverStaffMemberId_fkey" FOREIGN KEY ("driverStaffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRoute" ADD CONSTRAINT "TransportRoute_attendantStaffMemberId_fkey" FOREIGN KEY ("attendantStaffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRouteStop" ADD CONSTRAINT "TransportRouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportRouteStop" ADD CONSTRAINT "TransportRouteStop_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "TransportStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStudentAssignment" ADD CONSTRAINT "TransportStudentAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStudentAssignment" ADD CONSTRAINT "TransportStudentAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStudentAssignment" ADD CONSTRAINT "TransportStudentAssignment_pickupRouteStopId_fkey" FOREIGN KEY ("pickupRouteStopId") REFERENCES "TransportRouteStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStudentAssignment" ADD CONSTRAINT "TransportStudentAssignment_dropRouteStopId_fkey" FOREIGN KEY ("dropRouteStopId") REFERENCES "TransportRouteStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportStudentAssignment" ADD CONSTRAINT "TransportStudentAssignment_replacesAssignmentId_fkey" FOREIGN KEY ("replacesAssignmentId") REFERENCES "TransportStudentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeteriaMenuItem" ADD CONSTRAINT "CafeteriaMenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "CafeteriaMenu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeteriaMenuItem" ADD CONSTRAINT "CafeteriaMenuItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CafeteriaCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeteriaStudentEnrollment" ADD CONSTRAINT "CafeteriaStudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeteriaStudentEnrollment" ADD CONSTRAINT "CafeteriaStudentEnrollment_replacesEnrollmentId_fkey" FOREIGN KEY ("replacesEnrollmentId") REFERENCES "CafeteriaStudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeteriaMealRecord" ADD CONSTRAINT "CafeteriaMealRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeteriaMealRecord" ADD CONSTRAINT "CafeteriaMealRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CafeteriaStudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CafeteriaMealRecord" ADD CONSTRAINT "CafeteriaMealRecord_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "CafeteriaMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMediaAsset" ADD CONSTRAINT "EventMediaAsset_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "EventMediaAlbum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMediaDerivative" ADD CONSTRAINT "EventMediaDerivative_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EventMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMediaStudentAssociation" ADD CONSTRAINT "EventMediaStudentAssociation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EventMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMediaStudentAssociation" ADD CONSTRAINT "EventMediaStudentAssociation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaPublicationConsent" ADD CONSTRAINT "MediaPublicationConsent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaPublicationConsent" ADD CONSTRAINT "MediaPublicationConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMediaAuditEvent" ADD CONSTRAINT "EventMediaAuditEvent_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "EventMediaAlbum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMediaAuditEvent" ADD CONSTRAINT "EventMediaAuditEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "EventMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMediaAuditEvent" ADD CONSTRAINT "EventMediaAuditEvent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "MediaPublicationConsent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMeeting" ADD CONSTRAINT "ParentMeeting_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMeeting" ADD CONSTRAINT "ParentMeeting_requesterGuardianId_fkey" FOREIGN KEY ("requesterGuardianId") REFERENCES "Guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMeetingPreference" ADD CONSTRAINT "ParentMeetingPreference_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ParentMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMeetingParticipant" ADD CONSTRAINT "ParentMeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ParentMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMeetingParticipant" ADD CONSTRAINT "ParentMeetingParticipant_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMeetingNote" ADD CONSTRAINT "ParentMeetingNote_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ParentMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMeetingNote" ADD CONSTRAINT "ParentMeetingNote_correctsNoteId_fkey" FOREIGN KEY ("correctsNoteId") REFERENCES "ParentMeetingNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMeetingFollowUp" ADD CONSTRAINT "ParentMeetingFollowUp_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ParentMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMeetingFollowUp" ADD CONSTRAINT "ParentMeetingFollowUp_responsibleStaffMemberId_fkey" FOREIGN KEY ("responsibleStaffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentMeetingEvent" ADD CONSTRAINT "ParentMeetingEvent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ParentMeeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncDevice" ADD CONSTRAINT "OfflineSyncDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncDevice" ADD CONSTRAINT "OfflineSyncDevice_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncDevice" ADD CONSTRAINT "OfflineSyncDevice_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncChallenge" ADD CONSTRAINT "OfflineSyncChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncNonce" ADD CONSTRAINT "OfflineSyncNonce_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncMutation" ADD CONSTRAINT "OfflineSyncMutation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncMutation" ADD CONSTRAINT "OfflineSyncMutation_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncEvent" ADD CONSTRAINT "OfflineSyncEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncEvent" ADD CONSTRAINT "OfflineSyncEvent_mutationId_fkey" FOREIGN KEY ("mutationId") REFERENCES "OfflineSyncMutation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncEvent" ADD CONSTRAINT "OfflineSyncEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncConflictReview" ADD CONSTRAINT "OfflineSyncConflictReview_mutationId_fkey" FOREIGN KEY ("mutationId") REFERENCES "OfflineSyncMutation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncConflictReview" ADD CONSTRAINT "OfflineSyncConflictReview_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineSyncConflictReview" ADD CONSTRAINT "OfflineSyncConflictReview_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NativeAuthRequest" ADD CONSTRAINT "NativeAuthRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NativeAuthorizationCode" ADD CONSTRAINT "NativeAuthorizationCode_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "NativeAuthRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NativeAuthorizationCode" ADD CONSTRAINT "NativeAuthorizationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NativeAuthorizationCode" ADD CONSTRAINT "NativeAuthorizationCode_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NativeSession" ADD CONSTRAINT "NativeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NativeSession" ADD CONSTRAINT "NativeSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NativeRefreshTokenHistory" ADD CONSTRAINT "NativeRefreshTokenHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NativeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Provider-equivalent partial uniqueness not expressible in the current Prisma schema.
CREATE UNIQUE INDEX "ParentMeetingParticipant_one_primary"
ON "ParentMeetingParticipant"("meetingId")
WHERE "participantRole" = 'PRIMARY_STAFF' AND "status" <> 'REMOVED';

-- GENERATED PostgreSQL equivalents for the final active SQLite trigger inventory.
-- Source business semantics are preserved with null-safe comparisons and native booleans.
-- SQLite trigger parity: academic_calendar_audit_append_only_delete
CREATE FUNCTION "nalanda_trigger_b8c82ce4485430ca9d31"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Academic calendar audit is append-only';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "academic_calendar_audit_append_only_delete"
BEFORE DELETE ON "AcademicCalendarAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_b8c82ce4485430ca9d31"();

-- SQLite trigger parity: academic_calendar_audit_append_only_update
CREATE FUNCTION "nalanda_trigger_3c2b8c26728405b2da6f"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Academic calendar audit is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "academic_calendar_audit_append_only_update"
BEFORE UPDATE ON "AcademicCalendarAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_3c2b8c26728405b2da6f"();

-- SQLite trigger parity: academic_calendar_audit_target_guard
CREATE FUNCTION "nalanda_trigger_94218f3c5dd0b9d9f15d"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NOT (
  (NEW."entityType" = 'OPERATIONAL_CALENDAR' AND NEW."calendarVersionId" IS NOT NULL AND NEW."schoolEventId" IS NULL AND NEW."eventVersionId" IS NULL) OR
  (NEW."entityType" = 'INFORMATIONAL_EVENT' AND NEW."calendarVersionId" IS NULL AND NEW."schoolEventId" IS NOT NULL AND NEW."eventVersionId" IS NOT NULL AND EXISTS (SELECT 1 FROM "SchoolCalendarEventVersion" v WHERE v."id" = NEW."eventVersionId" AND v."eventId" = NEW."schoolEventId"))
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Academic calendar audit target is invalid';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "academic_calendar_audit_target_guard"
BEFORE INSERT ON "AcademicCalendarAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_94218f3c5dd0b9d9f15d"();

-- SQLite trigger parity: academic_calendar_publication_evidence_immutable
CREATE FUNCTION "nalanda_trigger_3c03371ade88f80a901d"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" IN ('PUBLISHED','REPLACED','WITHDRAWN','ARCHIVED') AND (
  NEW."publicationReason" IS DISTINCT FROM OLD."publicationReason" OR
  NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Academic calendar publication evidence is immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "academic_calendar_publication_evidence_immutable"
BEFORE UPDATE ON "AcademicCalendarVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_3c03371ade88f80a901d"();

-- SQLite trigger parity: academic_calendar_published_history_no_delete
CREATE FUNCTION "nalanda_trigger_937a9977cbb3e349c117"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Published academic calendar history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "academic_calendar_published_history_no_delete"
BEFORE DELETE ON "AcademicCalendarVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_937a9977cbb3e349c117"();

-- SQLite trigger parity: academic_calendar_replacement_scope_guard
CREATE FUNCTION "nalanda_trigger_8d757e05cf91a538d984"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."replacesVersionId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "AcademicCalendarVersion" prior WHERE prior."id" = NEW."replacesVersionId" AND prior."academicYear" = NEW."academicYear" AND prior."scopeKey" = NEW."scopeKey" AND prior."versionNumber" < NEW."versionNumber"
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Academic calendar replacement must reference an earlier version in the same scope';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "academic_calendar_replacement_scope_guard"
BEFORE INSERT ON "AcademicCalendarVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_8d757e05cf91a538d984"();

-- SQLite trigger parity: academic_calendar_version_content_immutable
CREATE FUNCTION "nalanda_trigger_4d29bb44d92992eab3ae"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" <> 'DRAFT' AND (
  NEW."academicYear" IS DISTINCT FROM OLD."academicYear" OR
  NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" OR
  NEW."effectiveScope" IS DISTINCT FROM OLD."effectiveScope" OR
  NEW."className" IS DISTINCT FROM OLD."className" OR
  NEW."section" IS DISTINCT FROM OLD."section" OR
  NEW."scopeKey" IS DISTINCT FROM OLD."scopeKey" OR
  NEW."title" IS DISTINCT FROM OLD."title" OR
  NEW."replacesVersionId" IS DISTINCT FROM OLD."replacesVersionId" OR
  NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Academic calendar content is immutable after review submission';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "academic_calendar_version_content_immutable"
BEFORE UPDATE ON "AcademicCalendarVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_4d29bb44d92992eab3ae"();

-- SQLite trigger parity: academic_calendar_version_evidence_set_once
CREATE FUNCTION "nalanda_trigger_024f400bbc7765fb4c88"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF ((OLD."submittedAt" IS NOT NULL AND NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt") OR
  (OLD."approvedAt" IS NOT NULL AND NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt") OR
  (OLD."publishedAt" IS NOT NULL AND NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt") OR
  (OLD."replacedAt" IS NOT NULL AND NEW."replacedAt" IS DISTINCT FROM OLD."replacedAt") OR
  (OLD."withdrawnAt" IS NOT NULL AND NEW."withdrawnAt" IS DISTINCT FROM OLD."withdrawnAt") OR
  (OLD."archivedAt" IS NOT NULL AND NEW."archivedAt" IS DISTINCT FROM OLD."archivedAt") OR
  (OLD."publicationReason" IS NOT NULL AND NEW."publicationReason" IS DISTINCT FROM OLD."publicationReason") OR
  (OLD."replacementReason" IS NOT NULL AND NEW."replacementReason" IS DISTINCT FROM OLD."replacementReason") OR
  (OLD."withdrawalReason" IS NOT NULL AND NEW."withdrawalReason" IS DISTINCT FROM OLD."withdrawalReason") OR
  (OLD."archiveReason" IS NOT NULL AND NEW."archiveReason" IS DISTINCT FROM OLD."archiveReason") OR
  (OLD."idempotencyKey" IS NOT NULL AND NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey") OR
  (OLD."replacesVersionId" IS NOT NULL AND NEW."replacesVersionId" IS DISTINCT FROM OLD."replacesVersionId")) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Academic calendar lifecycle evidence is set-once';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "academic_calendar_version_evidence_set_once"
BEFORE UPDATE ON "AcademicCalendarVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_024f400bbc7765fb4c88"();

-- SQLite trigger parity: academic_calendar_version_insert_draft_only
CREATE FUNCTION "nalanda_trigger_d4112f5e320018ac24e3"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Academic calendar versions must begin as drafts';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "academic_calendar_version_insert_draft_only"
BEFORE INSERT ON "AcademicCalendarVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_d4112f5e320018ac24e3"();

-- SQLite trigger parity: academic_calendar_version_status_transition
CREATE FUNCTION "nalanda_trigger_04ba35e5740fbe363447"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NOT (
  NEW."status" = OLD."status" OR
  (OLD."status" = 'DRAFT' AND NEW."status" = 'READY_FOR_REVIEW' AND NEW."submittedAt" IS NOT NULL) OR
  (OLD."status" = 'READY_FOR_REVIEW' AND NEW."status" = 'PUBLISHED' AND NEW."approvedAt" IS NOT NULL AND NEW."publishedAt" IS NOT NULL AND NEW."publicationReason" IS NOT NULL AND NEW."currentPublicationKey" IS NOT NULL) OR
  (OLD."status" = 'PUBLISHED' AND NEW."status" = 'REPLACED' AND NEW."replacedAt" IS NOT NULL AND NEW."currentPublicationKey" IS NULL) OR
  (OLD."status" = 'PUBLISHED' AND NEW."status" = 'WITHDRAWN' AND NEW."withdrawnAt" IS NOT NULL AND NEW."withdrawalReason" IS NOT NULL AND NEW."currentPublicationKey" IS NULL) OR
  (OLD."status" IN ('REPLACED','WITHDRAWN') AND NEW."status" = 'ARCHIVED' AND NEW."archivedAt" IS NOT NULL AND NEW."archiveReason" IS NOT NULL)
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid academic calendar lifecycle transition';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "academic_calendar_version_status_transition"
BEFORE UPDATE OF "status" ON "AcademicCalendarVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_04ba35e5740fbe363447"();

-- SQLite trigger parity: AcademicReportAudit_no_delete
CREATE FUNCTION "nalanda_trigger_732f2ba869b96d353ad8"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACADEMIC_REPORT_AUDIT_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "AcademicReportAudit_no_delete"
BEFORE DELETE ON "AcademicReportAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_732f2ba869b96d353ad8"();

-- SQLite trigger parity: AcademicReportAudit_no_update
CREATE FUNCTION "nalanda_trigger_27a165283ee94dcfcba1"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACADEMIC_REPORT_AUDIT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "AcademicReportAudit_no_update"
BEFORE UPDATE ON "AcademicReportAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_27a165283ee94dcfcba1"();

-- SQLite trigger parity: AcademicReportRun_no_delete
CREATE FUNCTION "nalanda_trigger_7cc6f1c4580063cdf09f"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACADEMIC_REPORT_RUN_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "AcademicReportRun_no_delete"
BEFORE DELETE ON "AcademicReportRun"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7cc6f1c4580063cdf09f"();

-- SQLite trigger parity: AcademicReportRun_no_update
CREATE FUNCTION "nalanda_trigger_4b71664a5c7cd9d1acea"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACADEMIC_REPORT_RUN_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "AcademicReportRun_no_update"
BEFORE UPDATE ON "AcademicReportRun"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_4b71664a5c7cd9d1acea"();

-- SQLite trigger parity: AcademicReportSource_no_delete
CREATE FUNCTION "nalanda_trigger_28fb9a83f41e3a34976e"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACADEMIC_REPORT_SOURCE_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "AcademicReportSource_no_delete"
BEFORE DELETE ON "AcademicReportSourceReference"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_28fb9a83f41e3a34976e"();

-- SQLite trigger parity: AcademicReportSource_no_update
CREATE FUNCTION "nalanda_trigger_f65b58d68f42c3f91784"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACADEMIC_REPORT_SOURCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "AcademicReportSource_no_update"
BEFORE UPDATE ON "AcademicReportSourceReference"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_f65b58d68f42c3f91784"();

-- SQLite trigger parity: AdmissionApplicationVersion_no_delete
CREATE FUNCTION "nalanda_trigger_57f2ac97d4a05eab1d2b"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Application versions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionApplicationVersion_no_delete"
BEFORE DELETE ON "AdmissionApplicationVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_57f2ac97d4a05eab1d2b"();

-- SQLite trigger parity: AdmissionApplicationVersion_no_update
CREATE FUNCTION "nalanda_trigger_97f4f256200688f880ea"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Application versions are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionApplicationVersion_no_update"
BEFORE UPDATE ON "AdmissionApplicationVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_97f4f256200688f880ea"();

-- SQLite trigger parity: AdmissionConversion_no_delete
CREATE FUNCTION "nalanda_trigger_a57d39a206680a1b6bd2"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Admission conversions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionConversion_no_delete"
BEFORE DELETE ON "AdmissionConversion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_a57d39a206680a1b6bd2"();

-- SQLite trigger parity: AdmissionConversion_no_update
CREATE FUNCTION "nalanda_trigger_6e37a2740f7139554cee"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Admission conversions are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionConversion_no_update"
BEFORE UPDATE ON "AdmissionConversion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_6e37a2740f7139554cee"();

-- SQLite trigger parity: AdmissionDecision_no_delete
CREATE FUNCTION "nalanda_trigger_82de1541989531ef48dc"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Admission decisions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionDecision_no_delete"
BEFORE DELETE ON "AdmissionDecision"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_82de1541989531ef48dc"();

-- SQLite trigger parity: AdmissionDecision_no_update
CREATE FUNCTION "nalanda_trigger_7f75e1df1bea8cc31dd5"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Admission decisions are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionDecision_no_update"
BEFORE UPDATE ON "AdmissionDecision"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7f75e1df1bea8cc31dd5"();

-- SQLite trigger parity: AdmissionDuplicateResolution_no_delete
CREATE FUNCTION "nalanda_trigger_1ab3d136894452e674a2"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Duplicate resolutions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionDuplicateResolution_no_delete"
BEFORE DELETE ON "AdmissionDuplicateResolution"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_1ab3d136894452e674a2"();

-- SQLite trigger parity: AdmissionDuplicateResolution_no_update
CREATE FUNCTION "nalanda_trigger_aca4a94a8d3d9e92fa1d"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Duplicate resolutions are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionDuplicateResolution_no_update"
BEFORE UPDATE ON "AdmissionDuplicateResolution"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_aca4a94a8d3d9e92fa1d"();

-- SQLite trigger parity: AdmissionEvent_no_delete
CREATE FUNCTION "nalanda_trigger_425cb014c9eeb496c995"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Admission events cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionEvent_no_delete"
BEFORE DELETE ON "AdmissionEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_425cb014c9eeb496c995"();

-- SQLite trigger parity: AdmissionEvent_no_update
CREATE FUNCTION "nalanda_trigger_6a63564c1c60faa717c7"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Admission events are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionEvent_no_update"
BEFORE UPDATE ON "AdmissionEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_6a63564c1c60faa717c7"();

-- SQLite trigger parity: AdmissionOffer_no_delete
CREATE FUNCTION "nalanda_trigger_e2af686fed0b644d0ee3"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Admission offers cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdmissionOffer_no_delete"
BEFORE DELETE ON "AdmissionOffer"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e2af686fed0b644d0ee3"();

-- SQLite trigger parity: AdvanceRecoverySchedule_no_delete
CREATE FUNCTION "nalanda_trigger_6a61202ec326c61404f9"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Advance recovery history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "AdvanceRecoverySchedule_no_delete"
BEFORE DELETE ON "AdvanceRecoverySchedule"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_6a61202ec326c61404f9"();

-- SQLite trigger parity: ClassworkAttachment_identity_immutable
CREATE FUNCTION "nalanda_trigger_9197b5c8e4f942ba117e"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Attachment identity and bytes are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkAttachment_identity_immutable"
BEFORE UPDATE OF "itemVersionId","submissionVersionId","storageKey","safeDisplayName","mediaType","extension","byteSize","sha256","width","height","createdByUserId" ON "ClassworkAttachment"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_9197b5c8e4f942ba117e"();

-- SQLite trigger parity: ClassworkAttachment_no_delete
CREATE FUNCTION "nalanda_trigger_e7677ec84d1330ab0000"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Attachment evidence cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkAttachment_no_delete"
BEFORE DELETE ON "ClassworkAttachment"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e7677ec84d1330ab0000"();

-- SQLite trigger parity: ClassworkAuditEvent_no_delete
CREATE FUNCTION "nalanda_trigger_87fe2cdfef02dc913bf3"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Classwork audit is append-only';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkAuditEvent_no_delete"
BEFORE DELETE ON "ClassworkAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_87fe2cdfef02dc913bf3"();

-- SQLite trigger parity: ClassworkAuditEvent_no_update
CREATE FUNCTION "nalanda_trigger_95468462435a621992a5"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Classwork audit is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkAuditEvent_no_update"
BEFORE UPDATE ON "ClassworkAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_95468462435a621992a5"();

-- SQLite trigger parity: ClassworkFeedback_no_delete
CREATE FUNCTION "nalanda_trigger_71c9b2ed81b95f906929"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Feedback is append-only';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkFeedback_no_delete"
BEFORE DELETE ON "ClassworkFeedback"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_71c9b2ed81b95f906929"();

-- SQLite trigger parity: ClassworkFeedback_no_update
CREATE FUNCTION "nalanda_trigger_618291b3f38d4a80aa04"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Feedback is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkFeedback_no_update"
BEFORE UPDATE ON "ClassworkFeedback"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_618291b3f38d4a80aa04"();

-- SQLite trigger parity: ClassworkItem_no_delete
CREATE FUNCTION "nalanda_trigger_4704594d5d1dc020dbaf"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Classwork history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkItem_no_delete"
BEFORE DELETE ON "ClassworkItem"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_4704594d5d1dc020dbaf"();

-- SQLite trigger parity: ClassworkItemVersion_lifecycle_guard
CREATE FUNCTION "nalanda_trigger_7d91899e18c368bdcd34"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NOT ((OLD."versionStatus" = 'DRAFT' AND NEW."versionStatus" = 'PUBLISHED') OR (OLD."versionStatus" = 'PUBLISHED' AND NEW."versionStatus" = 'REPLACED') OR OLD."versionStatus" = NEW."versionStatus")) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid classwork version transition';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkItemVersion_lifecycle_guard"
BEFORE UPDATE OF "versionStatus" ON "ClassworkItemVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7d91899e18c368bdcd34"();

-- SQLite trigger parity: ClassworkItemVersion_no_delete
CREATE FUNCTION "nalanda_trigger_e2c4a664f1d246384e27"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Published instruction history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkItemVersion_no_delete"
BEFORE DELETE ON "ClassworkItemVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e2c4a664f1d246384e27"();

-- SQLite trigger parity: ClassworkItemVersion_published_content_immutable
CREATE FUNCTION "nalanda_trigger_4715c9b585dae0dfe761"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."versionStatus" IN ('PUBLISHED','REPLACED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Published instructions are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkItemVersion_published_content_immutable"
BEFORE UPDATE OF "title","instructions","dueAt","correctionReason","createdByUserId" ON "ClassworkItemVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_4715c9b585dae0dfe761"();

-- SQLite trigger parity: ClassworkSubmission_no_delete
CREATE FUNCTION "nalanda_trigger_d924a983c6855fb5e49e"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Submission history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkSubmission_no_delete"
BEFORE DELETE ON "ClassworkSubmission"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_d924a983c6855fb5e49e"();

-- SQLite trigger parity: ClassworkSubmissionVersion_lifecycle_guard
CREATE FUNCTION "nalanda_trigger_f6c8e9ff4ad9ca8b6a0b"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NOT (OLD."versionStatus" = 'DRAFT' AND NEW."versionStatus" IN ('SUBMITTED','LATE','RESUBMITTED')) AND OLD."versionStatus" <> NEW."versionStatus") THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid submission version transition';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkSubmissionVersion_lifecycle_guard"
BEFORE UPDATE OF "versionStatus" ON "ClassworkSubmissionVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_f6c8e9ff4ad9ca8b6a0b"();

-- SQLite trigger parity: ClassworkSubmissionVersion_locked_immutable
CREATE FUNCTION "nalanda_trigger_c988e01bfe6e1d88e556"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."versionStatus" <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Submitted work is immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkSubmissionVersion_locked_immutable"
BEFORE UPDATE OF "textBody","itemVersionId","createdByUserId","createdByRole","parentGuardianId" ON "ClassworkSubmissionVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_c988e01bfe6e1d88e556"();

-- SQLite trigger parity: ClassworkSubmissionVersion_no_delete
CREATE FUNCTION "nalanda_trigger_8c0399dae1ba81a23555"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Submission versions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ClassworkSubmissionVersion_no_delete"
BEFORE DELETE ON "ClassworkSubmissionVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_8c0399dae1ba81a23555"();

-- SQLite trigger parity: EmployeePayrollResult_no_approved_delete
CREATE FUNCTION "nalanda_trigger_da142127b5837a28ddd6"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (EXISTS (SELECT 1 FROM "PayrollRun" r WHERE r."id" = OLD."payrollRunId" AND r."status" IN ('APPROVED', 'LOCKED', 'PAYSLIPS_ISSUED', 'REVERSED', 'ARCHIVED'))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Approved payroll results cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "EmployeePayrollResult_no_approved_delete"
BEFORE DELETE ON "EmployeePayrollResult"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_da142127b5837a28ddd6"();

-- SQLite trigger parity: EmployeePayrollResult_no_approved_update
CREATE FUNCTION "nalanda_trigger_89260282d6c531efdb1e"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (EXISTS (SELECT 1 FROM "PayrollRun" r WHERE r."id" = OLD."payrollRunId" AND r."status" IN ('APPROVED', 'LOCKED', 'PAYSLIPS_ISSUED', 'REVERSED', 'ARCHIVED'))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Approved payroll results are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "EmployeePayrollResult_no_approved_update"
BEFORE UPDATE ON "EmployeePayrollResult"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_89260282d6c531efdb1e"();

-- SQLite trigger parity: EventMediaAlbum_no_delete
CREATE FUNCTION "nalanda_trigger_feabe3e9ea85f6df8494"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Event Media albums use governed archival';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "EventMediaAlbum_no_delete"
BEFORE DELETE ON "EventMediaAlbum"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_feabe3e9ea85f6df8494"();

-- SQLite trigger parity: EventMediaAsset_no_delete
CREATE FUNCTION "nalanda_trigger_9e7ddc2a35a0c783856b"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Event Media assets use governed archival';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "EventMediaAsset_no_delete"
BEFORE DELETE ON "EventMediaAsset"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_9e7ddc2a35a0c783856b"();

-- SQLite trigger parity: EventMediaAsset_original_immutable
CREATE FUNCTION "nalanda_trigger_efd8a1d4a024fec28270"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Event Media original evidence is immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "EventMediaAsset_original_immutable"
BEFORE UPDATE OF "originalStorageKey", "originalMediaType", "originalExtension", "originalByteSize", "originalSha256", "originalWidth", "originalHeight", "uploadActorUserId", "uploadedAt" ON "EventMediaAsset"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_efd8a1d4a024fec28270"();

-- SQLite trigger parity: EventMediaAuditEvent_no_delete
CREATE FUNCTION "nalanda_trigger_7d65025b4dd4ff0f0162"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Event Media audit history is append-only';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "EventMediaAuditEvent_no_delete"
BEFORE DELETE ON "EventMediaAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7d65025b4dd4ff0f0162"();

-- SQLite trigger parity: EventMediaAuditEvent_no_update
CREATE FUNCTION "nalanda_trigger_4a652909d97536c3759c"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Event Media audit history is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "EventMediaAuditEvent_no_update"
BEFORE UPDATE ON "EventMediaAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_4a652909d97536c3759c"();

-- SQLite trigger parity: EventMediaDerivative_no_delete
CREATE FUNCTION "nalanda_trigger_6730059d6abe5f41ceb5"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Event Media derivatives retain recovery history';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "EventMediaDerivative_no_delete"
BEFORE DELETE ON "EventMediaDerivative"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_6730059d6abe5f41ceb5"();

-- SQLite trigger parity: exam_timetable_event_append_only_delete
CREATE FUNCTION "nalanda_trigger_cf564d5b6eec415ec2a4"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Examination timetable events are append-only';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "exam_timetable_event_append_only_delete"
BEFORE DELETE ON "ExaminationTimetableEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_cf564d5b6eec415ec2a4"();

-- SQLite trigger parity: exam_timetable_event_append_only_update
CREATE FUNCTION "nalanda_trigger_f5889adb4f03bd3394ba"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Examination timetable events are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "exam_timetable_event_append_only_update"
BEFORE UPDATE ON "ExaminationTimetableEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_f5889adb4f03bd3394ba"();

-- SQLite trigger parity: exam_timetable_publication_evidence_immutable
CREATE FUNCTION "nalanda_trigger_fbdc7b7ac4f3c9c411a9"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" IN ('PUBLISHED', 'WITHDRAWN', 'REPLACED', 'ARCHIVED') AND (
  NEW."publicationReason" IS DISTINCT FROM OLD."publicationReason" OR
  NEW."publishedByUserId" IS DISTINCT FROM OLD."publishedByUserId" OR
  NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Examination timetable publication evidence is immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "exam_timetable_publication_evidence_immutable"
BEFORE UPDATE ON "ExaminationTimetableVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_fbdc7b7ac4f3c9c411a9"();

-- SQLite trigger parity: exam_timetable_published_history_no_delete
CREATE FUNCTION "nalanda_trigger_0146b7226c3c35028ce5"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Published examination timetable history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "exam_timetable_published_history_no_delete"
BEFORE DELETE ON "ExaminationTimetableVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_0146b7226c3c35028ce5"();

-- SQLite trigger parity: exam_timetable_row_delete_draft_only
CREATE FUNCTION "nalanda_trigger_6668ea0066565af1a951"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (COALESCE((SELECT "status" FROM "ExaminationTimetableVersion" WHERE "id" = OLD."timetableVersionId"), '') <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Examination timetable rows are immutable outside a draft';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "exam_timetable_row_delete_draft_only"
BEFORE DELETE ON "ExaminationTimetableRow"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_6668ea0066565af1a951"();

-- SQLite trigger parity: exam_timetable_row_insert_draft_only
CREATE FUNCTION "nalanda_trigger_aa54d94b832088e3ad58"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (COALESCE((SELECT "status" FROM "ExaminationTimetableVersion" WHERE "id" = NEW."timetableVersionId"), '') <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Examination timetable rows can be added only to a draft';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "exam_timetable_row_insert_draft_only"
BEFORE INSERT ON "ExaminationTimetableRow"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_aa54d94b832088e3ad58"();

-- SQLite trigger parity: exam_timetable_row_update_draft_only
CREATE FUNCTION "nalanda_trigger_5623b675e5c613d675b0"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (COALESCE((SELECT "status" FROM "ExaminationTimetableVersion" WHERE "id" = OLD."timetableVersionId"), '') <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Examination timetable rows are immutable outside a draft';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "exam_timetable_row_update_draft_only"
BEFORE UPDATE ON "ExaminationTimetableRow"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_5623b675e5c613d675b0"();

-- SQLite trigger parity: exam_timetable_version_content_immutable
CREATE FUNCTION "nalanda_trigger_d70ad1cc60cfe443b0fe"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" <> 'DRAFT' AND (
  NEW."examinationId" IS DISTINCT FROM OLD."examinationId" OR
  NEW."classScopeId" IS DISTINCT FROM OLD."classScopeId" OR
  NEW."academicYear" IS DISTINCT FROM OLD."academicYear" OR
  NEW."className" IS DISTINCT FROM OLD."className" OR
  NEW."section" IS DISTINCT FROM OLD."section" OR
  NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" OR
  NEW."replacesVersionId" IS DISTINCT FROM OLD."replacesVersionId" OR
  NEW."parentInstructions" IS DISTINCT FROM OLD."parentInstructions" OR
  NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId" OR
  NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Examination timetable content is immutable after readiness';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "exam_timetable_version_content_immutable"
BEFORE UPDATE ON "ExaminationTimetableVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_d70ad1cc60cfe443b0fe"();

-- SQLite trigger parity: iam_prevent_active_super_admin_role_delete
CREATE FUNCTION "nalanda_trigger_d0c5ee918a3e0311db0a"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."role" = 'SUPER_ADMIN' AND OLD."status" = 'ACTIVE' AND EXISTS (SELECT 1 FROM "User" account WHERE account."id" = OLD."userId" AND account."isActive" = TRUE AND account."lifecycleStatus" = 'ACTIVE')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTIVE_SUPER_ADMIN_HISTORY_IS_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "iam_prevent_active_super_admin_role_delete"
BEFORE DELETE ON "UserRoleAssignment"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_d0c5ee918a3e0311db0a"();

-- SQLite trigger parity: iam_prevent_expiring_super_admin_role_insert
CREATE FUNCTION "nalanda_trigger_0ee8551997c9c8d61fec"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."role" = 'SUPER_ADMIN' AND NEW."validUntil" IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SUPER_ADMIN_ASSIGNMENT_CANNOT_EXPIRE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "iam_prevent_expiring_super_admin_role_insert"
BEFORE INSERT ON "UserRoleAssignment"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_0ee8551997c9c8d61fec"();

-- SQLite trigger parity: iam_prevent_expiring_super_admin_role_update
CREATE FUNCTION "nalanda_trigger_80f3e23f42b529d15e8c"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."role" = 'SUPER_ADMIN' AND NEW."validUntil" IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SUPER_ADMIN_ASSIGNMENT_CANNOT_EXPIRE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "iam_prevent_expiring_super_admin_role_update"
BEFORE UPDATE OF "role", "validUntil" ON "UserRoleAssignment"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_80f3e23f42b529d15e8c"();

-- SQLite trigger parity: iam_prevent_last_super_admin_role_end
CREATE FUNCTION "nalanda_trigger_1c0e9f039c513bb74be0"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."role" = 'SUPER_ADMIN' AND OLD."status" = 'ACTIVE' AND (NEW."role" <> 'SUPER_ADMIN' OR NEW."status" <> 'ACTIVE')
  AND EXISTS (SELECT 1 FROM "User" account WHERE account."id" = OLD."userId" AND account."isActive" = TRUE AND account."lifecycleStatus" = 'ACTIVE')
  AND (SELECT COUNT(*) FROM "UserRoleAssignment" assignment JOIN "User" account ON account."id" = assignment."userId" WHERE assignment."role" = 'SUPER_ADMIN' AND assignment."status" = 'ACTIVE' AND account."isActive" = TRUE AND account."lifecycleStatus" = 'ACTIVE') <= 1) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LAST_ACTIVE_SUPER_ADMIN_REQUIRED';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "iam_prevent_last_super_admin_role_end"
BEFORE UPDATE OF "role", "status" ON "UserRoleAssignment"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_1c0e9f039c513bb74be0"();

-- SQLite trigger parity: iam_prevent_last_super_admin_suspension
CREATE FUNCTION "nalanda_trigger_41e6d24b9404de4db3fb"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."isActive" = TRUE AND OLD."lifecycleStatus" = 'ACTIVE' AND (NEW."isActive" <> TRUE OR NEW."lifecycleStatus" <> 'ACTIVE')
  AND EXISTS (SELECT 1 FROM "UserRoleAssignment" assignment WHERE assignment."userId" = OLD."id" AND assignment."role" = 'SUPER_ADMIN' AND assignment."status" = 'ACTIVE')
  AND (SELECT COUNT(*) FROM "UserRoleAssignment" assignment JOIN "User" account ON account."id" = assignment."userId" WHERE assignment."role" = 'SUPER_ADMIN' AND assignment."status" = 'ACTIVE' AND account."isActive" = TRUE AND account."lifecycleStatus" = 'ACTIVE') <= 1) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LAST_ACTIVE_SUPER_ADMIN_REQUIRED';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "iam_prevent_last_super_admin_suspension"
BEFORE UPDATE OF "isActive", "lifecycleStatus" ON "User"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_41e6d24b9404de4db3fb"();

-- SQLite trigger parity: maintenance_window_event_no_delete
CREATE FUNCTION "nalanda_trigger_7c073cfc8c2d205999aa"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Maintenance history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "maintenance_window_event_no_delete"
BEFORE DELETE ON "MaintenanceWindowEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7c073cfc8c2d205999aa"();

-- SQLite trigger parity: maintenance_window_event_no_update
CREATE FUNCTION "nalanda_trigger_9297c7aec2524a6964be"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Maintenance history is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "maintenance_window_event_no_update"
BEFORE UPDATE ON "MaintenanceWindowEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_9297c7aec2524a6964be"();

-- SQLite trigger parity: maintenance_window_no_delete
CREATE FUNCTION "nalanda_trigger_d1d212bee0023fce02b2"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Maintenance windows cannot be hard-deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "maintenance_window_no_delete"
BEFORE DELETE ON "MaintenanceWindow"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_d1d212bee0023fce02b2"();

-- SQLite trigger parity: MediaPublicationConsent_no_delete
CREATE FUNCTION "nalanda_trigger_e6ac753f16174c8fe003"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Media-publication consent history is immutable';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "MediaPublicationConsent_no_delete"
BEFORE DELETE ON "MediaPublicationConsent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e6ac753f16174c8fe003"();

-- SQLite trigger parity: NativeAuthorizationCode_single_use
CREATE FUNCTION "nalanda_trigger_7b16434bf4dff9ca2952"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."usedAt" IS NOT NULL OR NEW."usedAt" IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NATIVE_AUTHORIZATION_CODE_REUSE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "NativeAuthorizationCode_single_use"
BEFORE UPDATE OF "usedAt" ON "NativeAuthorizationCode"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7b16434bf4dff9ca2952"();

-- SQLite trigger parity: NativeAuthRequest_security_material_immutable
CREATE FUNCTION "nalanda_trigger_347c1b1cb63e1ad7362a"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."publicRequestId" <> OLD."publicRequestId"
  OR NEW."challengeHash" <> OLD."challengeHash"
  OR NEW."stateHash" <> OLD."stateHash"
  OR NEW."nonceHash" <> OLD."nonceHash"
  OR NEW."pkceChallenge" <> OLD."pkceChallenge"
  OR NEW."pkceMethod" <> OLD."pkceMethod"
  OR NEW."appId" <> OLD."appId"
  OR NEW."appVersion" <> OLD."appVersion"
  OR NEW."redirectUri" <> OLD."redirectUri"
  OR NEW."platform" <> OLD."platform"
  OR NEW."publicDeviceId" <> OLD."publicDeviceId"
  OR NEW."publicSigningKey" <> OLD."publicSigningKey"
  OR NEW."publicKeyHash" <> OLD."publicKeyHash") THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NATIVE_AUTH_REQUEST_SECURITY_MATERIAL_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "NativeAuthRequest_security_material_immutable"
BEFORE UPDATE ON "NativeAuthRequest"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_347c1b1cb63e1ad7362a"();

-- SQLite trigger parity: NativeRefreshTokenHistory_append_only_delete
CREATE FUNCTION "nalanda_trigger_08170cb44ea04b5678dd"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NATIVE_REFRESH_HISTORY_APPEND_ONLY';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "NativeRefreshTokenHistory_append_only_delete"
BEFORE DELETE ON "NativeRefreshTokenHistory"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_08170cb44ea04b5678dd"();

-- SQLite trigger parity: NativeSession_revocation_irreversible
CREATE FUNCTION "nalanda_trigger_73ac6649288688542bf7"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."revokedAt" IS NOT NULL AND (NEW."revokedAt" IS NULL OR NEW."revokedAt" <> OLD."revokedAt")) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'NATIVE_SESSION_REVOCATION_IRREVERSIBLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "NativeSession_revocation_irreversible"
BEFORE UPDATE ON "NativeSession"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_73ac6649288688542bf7"();

-- SQLite trigger parity: OfflineSyncConflictReview_no_delete
CREATE FUNCTION "nalanda_trigger_b4db00374dd2f3c17117"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFLINE_CONFLICT_REVIEW_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "OfflineSyncConflictReview_no_delete"
BEFORE DELETE ON "OfflineSyncConflictReview"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_b4db00374dd2f3c17117"();

-- SQLite trigger parity: OfflineSyncConflictReview_no_update
CREATE FUNCTION "nalanda_trigger_6185bd0b1435bde3e734"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFLINE_CONFLICT_REVIEW_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OfflineSyncConflictReview_no_update"
BEFORE UPDATE ON "OfflineSyncConflictReview"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_6185bd0b1435bde3e734"();

-- SQLite trigger parity: OfflineSyncDevice_key_rotation
CREATE FUNCTION "nalanda_trigger_7bf2d278700e9fb3f17a"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" <> 'ACTIVE' OR NEW."status" <> 'ACTIVE' OR NEW."keyVersion" <> OLD."keyVersion" + 1) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFLINE_DEVICE_KEY_ROTATION_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OfflineSyncDevice_key_rotation"
BEFORE UPDATE OF "publicSigningKey","publicKeyHash","keyVersion" ON "OfflineSyncDevice"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7bf2d278700e9fb3f17a"();

-- SQLite trigger parity: OfflineSyncDevice_status_insert
CREATE FUNCTION "nalanda_trigger_352b693934c73e27697c"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFLINE_DEVICE_STATUS_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OfflineSyncDevice_status_insert"
BEFORE INSERT ON "OfflineSyncDevice"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_352b693934c73e27697c"();

-- SQLite trigger parity: OfflineSyncDevice_status_update
CREATE FUNCTION "nalanda_trigger_4f79f37e007f38eb71f8"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED') OR OLD."status" IN ('REVOKED','RETIRED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFLINE_DEVICE_TRANSITION_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OfflineSyncDevice_status_update"
BEFORE UPDATE OF "status" ON "OfflineSyncDevice"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_4f79f37e007f38eb71f8"();

-- SQLite trigger parity: OfflineSyncEvent_no_delete
CREATE FUNCTION "nalanda_trigger_96f1dc18a8e8aafa21f0"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFLINE_EVENT_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "OfflineSyncEvent_no_delete"
BEFORE DELETE ON "OfflineSyncEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_96f1dc18a8e8aafa21f0"();

-- SQLite trigger parity: OfflineSyncEvent_no_update
CREATE FUNCTION "nalanda_trigger_c57beb48a84535b5c0a3"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFLINE_EVENT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OfflineSyncEvent_no_update"
BEFORE UPDATE ON "OfflineSyncEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_c57beb48a84535b5c0a3"();

-- SQLite trigger parity: OfflineSyncMutation_contract_insert
CREATE FUNCTION "nalanda_trigger_206fd4c0503d4d0ef163"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."operationType" NOT IN ('FEE_PAYMENT','EXPENSE_DRAFT','MISC_INCOME') OR NEW."status" <> 'RECEIVED' OR NEW."syncSchemaVersion" <> 1) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFLINE_MUTATION_CONTRACT_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OfflineSyncMutation_contract_insert"
BEFORE INSERT ON "OfflineSyncMutation"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_206fd4c0503d4d0ef163"();

-- SQLite trigger parity: OfflineSyncMutation_no_delete
CREATE FUNCTION "nalanda_trigger_bde64e9c7f9a30c99cf3"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFLINE_MUTATION_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "OfflineSyncMutation_no_delete"
BEFORE DELETE ON "OfflineSyncMutation"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_bde64e9c7f9a30c99cf3"();

-- SQLite trigger parity: OfflineSyncMutation_terminal_immutable
CREATE FUNCTION "nalanda_trigger_ad59977ea45feda7a957"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" IN ('ACCEPTED','CONFLICT','REJECTED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFLINE_MUTATION_TERMINAL_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OfflineSyncMutation_terminal_immutable"
BEFORE UPDATE ON "OfflineSyncMutation"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_ad59977ea45feda7a957"();

-- SQLite trigger parity: operational_alert_event_no_delete
CREATE FUNCTION "nalanda_trigger_e17d6197acafa12a05e1"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Operational alert history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "operational_alert_event_no_delete"
BEFORE DELETE ON "OperationalAlertEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e17d6197acafa12a05e1"();

-- SQLite trigger parity: operational_alert_event_no_update
CREATE FUNCTION "nalanda_trigger_d94ecc4bdb8249c788fd"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Operational alert history is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "operational_alert_event_no_update"
BEFORE UPDATE ON "OperationalAlertEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_d94ecc4bdb8249c788fd"();

-- SQLite trigger parity: operational_alert_no_delete
CREATE FUNCTION "nalanda_trigger_a8a9d8ecd7c530b4a461"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Operational alerts cannot be hard-deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "operational_alert_no_delete"
BEFORE DELETE ON "OperationalAlert"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_a8a9d8ecd7c530b4a461"();

-- SQLite trigger parity: operational_calendar_day_delete_draft_only
CREATE FUNCTION "nalanda_trigger_5c2f5653aea03436e4ec"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (COALESCE((SELECT "status" FROM "AcademicCalendarVersion" WHERE "id"=OLD."calendarVersionId"),'') <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Operational calendar days are immutable outside a draft';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "operational_calendar_day_delete_draft_only"
BEFORE DELETE ON "OperationalCalendarDay"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_5c2f5653aea03436e4ec"();

-- SQLite trigger parity: operational_calendar_day_insert_draft_only
CREATE FUNCTION "nalanda_trigger_ad21b4d3b15dfda6ff3c"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (COALESCE((SELECT "status" FROM "AcademicCalendarVersion" WHERE "id"=NEW."calendarVersionId"),'') <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Operational calendar days can be added only to a draft';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "operational_calendar_day_insert_draft_only"
BEFORE INSERT ON "OperationalCalendarDay"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_ad21b4d3b15dfda6ff3c"();

-- SQLite trigger parity: operational_calendar_day_update_draft_only
CREATE FUNCTION "nalanda_trigger_07cb1fded743605fe59e"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (COALESCE((SELECT "status" FROM "AcademicCalendarVersion" WHERE "id"=OLD."calendarVersionId"),'') <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Operational calendar days are immutable outside a draft';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "operational_calendar_day_update_draft_only"
BEFORE UPDATE ON "OperationalCalendarDay"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_07cb1fded743605fe59e"();

-- SQLite trigger parity: operational_incident_event_no_delete
CREATE FUNCTION "nalanda_trigger_b4de468e3cf80b8d71da"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Operational incident history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "operational_incident_event_no_delete"
BEFORE DELETE ON "OperationalIncidentEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_b4de468e3cf80b8d71da"();

-- SQLite trigger parity: operational_incident_event_no_update
CREATE FUNCTION "nalanda_trigger_3bad7606f256f2c009f2"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Operational incident history is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "operational_incident_event_no_update"
BEFORE UPDATE ON "OperationalIncidentEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_3bad7606f256f2c009f2"();

-- SQLite trigger parity: operational_incident_no_delete
CREATE FUNCTION "nalanda_trigger_1aa41e2bbc54155cad42"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Operational incidents cannot be hard-deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "operational_incident_no_delete"
BEFORE DELETE ON "OperationalIncident"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_1aa41e2bbc54155cad42"();

-- SQLite trigger parity: ParentMeeting_identity_immutable
CREATE FUNCTION "nalanda_trigger_90d39e58c2482b6b9fc7"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Parent Meeting identity is immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeeting_identity_immutable"
BEFORE UPDATE OF "studentId","requesterGuardianId","academicYear","source","requesterUserId","createdByUserId","createdAt" ON "ParentMeeting"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_90d39e58c2482b6b9fc7"();

-- SQLite trigger parity: ParentMeeting_no_delete
CREATE FUNCTION "nalanda_trigger_b17e4a0ef9be00ad28cc"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Parent Meetings use governed cancellation';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeeting_no_delete"
BEFORE DELETE ON "ParentMeeting"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_b17e4a0ef9be00ad28cc"();

-- SQLite trigger parity: ParentMeeting_schedule_conflict
CREATE FUNCTION "nalanda_trigger_0f4719c911d9aea0d29d"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" IN ('SCHEDULED','CONFIRMED')) AND (EXISTS (
    SELECT 1 FROM "ParentMeeting" other
    WHERE other."id"<>NEW."id" AND other."status" IN ('SCHEDULED','CONFIRMED')
      AND NEW."scheduledStartAt" < other."scheduledEndAt" AND NEW."scheduledEndAt" > other."scheduledStartAt"
      AND NEW."requesterGuardianId" IS NOT NULL AND other."requesterGuardianId"=NEW."requesterGuardianId"
  )) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_GUARDIAN_CONFLICT';
  END IF;
  IF (NEW."status" IN ('SCHEDULED','CONFIRMED')) AND (NEW."mode"='IN_PERSON' AND length(trim(COALESCE(NEW."locationReference",'')))>0 AND EXISTS (
    SELECT 1 FROM "ParentMeeting" other
    WHERE other."id"<>NEW."id" AND other."status" IN ('SCHEDULED','CONFIRMED') AND other."mode"='IN_PERSON'
      AND lower(trim(other."locationReference"))=lower(trim(NEW."locationReference"))
      AND NEW."scheduledStartAt" < other."scheduledEndAt" AND NEW."scheduledEndAt" > other."scheduledStartAt"
  )) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_LOCATION_CONFLICT';
  END IF;
  IF (NEW."status" IN ('SCHEDULED','CONFIRMED')) AND (EXISTS (
    SELECT 1 FROM "ParentMeetingParticipant" currentParticipant
    JOIN "ParentMeetingParticipant" otherParticipant ON otherParticipant."staffMemberId"=currentParticipant."staffMemberId" AND otherParticipant."status"<>'REMOVED'
    JOIN "ParentMeeting" other ON other."id"=otherParticipant."meetingId"
    WHERE currentParticipant."meetingId"=NEW."id" AND currentParticipant."status"<>'REMOVED'
      AND other."id"<>NEW."id" AND other."status" IN ('SCHEDULED','CONFIRMED')
      AND NEW."scheduledStartAt" < other."scheduledEndAt" AND NEW."scheduledEndAt" > other."scheduledStartAt"
  )) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_STAFF_CONFLICT';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeeting_schedule_conflict"
BEFORE UPDATE OF "status","scheduledStartAt","scheduledEndAt","mode","locationReference" ON "ParentMeeting"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_0f4719c911d9aea0d29d"();

-- SQLite trigger parity: ParentMeeting_schedule_conflict_insert
CREATE FUNCTION "nalanda_trigger_b9f29a64da6edf276697"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" IN ('SCHEDULED','CONFIRMED')) AND (EXISTS (
    SELECT 1 FROM "ParentMeeting" other
    WHERE other."status" IN ('SCHEDULED','CONFIRMED')
      AND NEW."scheduledStartAt" < other."scheduledEndAt" AND NEW."scheduledEndAt" > other."scheduledStartAt"
      AND NEW."requesterGuardianId" IS NOT NULL AND other."requesterGuardianId"=NEW."requesterGuardianId"
  )) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_GUARDIAN_CONFLICT';
  END IF;
  IF (NEW."status" IN ('SCHEDULED','CONFIRMED')) AND (NEW."mode"='IN_PERSON' AND length(trim(COALESCE(NEW."locationReference",'')))>0 AND EXISTS (
    SELECT 1 FROM "ParentMeeting" other
    WHERE other."status" IN ('SCHEDULED','CONFIRMED') AND other."mode"='IN_PERSON'
      AND lower(trim(other."locationReference"))=lower(trim(NEW."locationReference"))
      AND NEW."scheduledStartAt" < other."scheduledEndAt" AND NEW."scheduledEndAt" > other."scheduledStartAt"
  )) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_LOCATION_CONFLICT';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeeting_schedule_conflict_insert"
BEFORE INSERT ON "ParentMeeting"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_b9f29a64da6edf276697"();

-- SQLite trigger parity: ParentMeeting_schedule_required
CREATE FUNCTION "nalanda_trigger_22fdf9cbc58c37ab25ca"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" IN ('SCHEDULED','CONFIRMED') AND (
  NEW."scheduledStartAt" IS NULL OR NEW."scheduledEndAt" IS NULL OR NEW."durationMinutes" NOT BETWEEN 10 AND 180 OR
  NEW."scheduledEndAt" <= NEW."scheduledStartAt" OR NEW."mode" IS NULL
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_SCHEDULE_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeeting_schedule_required"
BEFORE UPDATE OF "status","scheduledStartAt","scheduledEndAt","durationMinutes","mode" ON "ParentMeeting"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_22fdf9cbc58c37ab25ca"();

-- SQLite trigger parity: ParentMeeting_schedule_required_insert
CREATE FUNCTION "nalanda_trigger_70cf4226b036a29528ac"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" IN ('SCHEDULED','CONFIRMED') AND (
  NEW."scheduledStartAt" IS NULL OR NEW."scheduledEndAt" IS NULL OR NEW."durationMinutes" NOT BETWEEN 10 AND 180 OR
  NEW."scheduledEndAt" <= NEW."scheduledStartAt" OR NEW."mode" IS NULL
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_SCHEDULE_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeeting_schedule_required_insert"
BEFORE INSERT ON "ParentMeeting"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_70cf4226b036a29528ac"();

-- SQLite trigger parity: ParentMeeting_status_transition
CREATE FUNCTION "nalanda_trigger_1a5bda0b0867ffa04743"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NOT (
  (OLD."status"='REQUESTED' AND NEW."status" IN ('REQUESTED','SCHEDULING','SCHEDULED','CANCELLED')) OR
  (OLD."status"='SCHEDULING' AND NEW."status" IN ('SCHEDULING','SCHEDULED','CANCELLED')) OR
  (OLD."status"='SCHEDULED' AND NEW."status" IN ('SCHEDULED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW')) OR
  (OLD."status"='CONFIRMED' AND NEW."status" IN ('CONFIRMED','SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')) OR
  (OLD."status"='COMPLETED' AND NEW."status"='COMPLETED') OR
  (OLD."status"='CANCELLED' AND NEW."status"='CANCELLED') OR
  (OLD."status"='NO_SHOW' AND NEW."status"='NO_SHOW')
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_TRANSITION_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeeting_status_transition"
BEFORE UPDATE OF "status" ON "ParentMeeting"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_1a5bda0b0867ffa04743"();

-- SQLite trigger parity: ParentMeetingEvent_no_delete
CREATE FUNCTION "nalanda_trigger_4691ad5a9a4a1fe9d28f"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Parent Meeting event history is append-only';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingEvent_no_delete"
BEFORE DELETE ON "ParentMeetingEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_4691ad5a9a4a1fe9d28f"();

-- SQLite trigger parity: ParentMeetingEvent_no_update
CREATE FUNCTION "nalanda_trigger_ac12108234fb66f90a93"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Parent Meeting event history is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingEvent_no_update"
BEFORE UPDATE ON "ParentMeetingEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_ac12108234fb66f90a93"();

-- SQLite trigger parity: ParentMeetingFollowUp_no_delete
CREATE FUNCTION "nalanda_trigger_f62435b8f71f5b0f0738"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Parent Meeting follow-up history is retained';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingFollowUp_no_delete"
BEFORE DELETE ON "ParentMeetingFollowUp"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_f62435b8f71f5b0f0738"();

-- SQLite trigger parity: ParentMeetingFollowUp_status_transition
CREATE FUNCTION "nalanda_trigger_93241dfb2f11c65b807a"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NOT ((OLD."status"='OPEN' AND NEW."status" IN ('OPEN','DONE','CANCELLED')) OR (OLD."status"=NEW."status" AND OLD."status" IN ('DONE','CANCELLED')))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_FOLLOW_UP_TRANSITION_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingFollowUp_status_transition"
BEFORE UPDATE OF "status" ON "ParentMeetingFollowUp"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_93241dfb2f11c65b807a"();

-- SQLite trigger parity: ParentMeetingNote_no_delete
CREATE FUNCTION "nalanda_trigger_da710ced82a1c2f9fcd4"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Parent Meeting notes are append-only';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingNote_no_delete"
BEFORE DELETE ON "ParentMeetingNote"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_da710ced82a1c2f9fcd4"();

-- SQLite trigger parity: ParentMeetingNote_no_update
CREATE FUNCTION "nalanda_trigger_efcb01148f645487cb99"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Parent Meeting notes are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingNote_no_update"
BEFORE UPDATE ON "ParentMeetingNote"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_efcb01148f645487cb99"();

-- SQLite trigger parity: ParentMeetingParticipant_no_delete
CREATE FUNCTION "nalanda_trigger_7cf7a26c953c472c04ff"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Parent Meeting participant history is retained';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingParticipant_no_delete"
BEFORE DELETE ON "ParentMeetingParticipant"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7cf7a26c953c472c04ff"();

-- SQLite trigger parity: ParentMeetingParticipant_schedule_conflict_insert
CREATE FUNCTION "nalanda_trigger_cb5deff5fddfed84f7a8"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status"<>'REMOVED') AND (EXISTS (
    SELECT 1 FROM "ParentMeeting" currentMeeting
    JOIN "ParentMeetingParticipant" otherParticipant ON otherParticipant."staffMemberId"=NEW."staffMemberId" AND otherParticipant."status"<>'REMOVED'
    JOIN "ParentMeeting" otherMeeting ON otherMeeting."id"=otherParticipant."meetingId"
    WHERE currentMeeting."id"=NEW."meetingId" AND currentMeeting."status" IN ('SCHEDULED','CONFIRMED')
      AND otherMeeting."id"<>currentMeeting."id" AND otherMeeting."status" IN ('SCHEDULED','CONFIRMED')
      AND currentMeeting."scheduledStartAt" < otherMeeting."scheduledEndAt" AND currentMeeting."scheduledEndAt" > otherMeeting."scheduledStartAt"
  )) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_STAFF_CONFLICT';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingParticipant_schedule_conflict_insert"
BEFORE INSERT ON "ParentMeetingParticipant"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_cb5deff5fddfed84f7a8"();

-- SQLite trigger parity: ParentMeetingParticipant_schedule_conflict_update
CREATE FUNCTION "nalanda_trigger_d25d16db80dbdd1bb66f"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status"<>'REMOVED') AND (EXISTS (
    SELECT 1 FROM "ParentMeeting" currentMeeting
    JOIN "ParentMeetingParticipant" otherParticipant ON otherParticipant."staffMemberId"=NEW."staffMemberId" AND otherParticipant."status"<>'REMOVED' AND otherParticipant."id"<>NEW."id"
    JOIN "ParentMeeting" otherMeeting ON otherMeeting."id"=otherParticipant."meetingId"
    WHERE currentMeeting."id"=NEW."meetingId" AND currentMeeting."status" IN ('SCHEDULED','CONFIRMED')
      AND otherMeeting."id"<>currentMeeting."id" AND otherMeeting."status" IN ('SCHEDULED','CONFIRMED')
      AND currentMeeting."scheduledStartAt" < otherMeeting."scheduledEndAt" AND currentMeeting."scheduledEndAt" > otherMeeting."scheduledStartAt"
  )) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PARENT_MEETING_STAFF_CONFLICT';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingParticipant_schedule_conflict_update"
BEFORE UPDATE OF "staffMemberId","status" ON "ParentMeetingParticipant"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_d25d16db80dbdd1bb66f"();

-- SQLite trigger parity: ParentMeetingPreference_no_delete
CREATE FUNCTION "nalanda_trigger_bb3545457b11474f4404"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Parent Meeting preferences are immutable evidence';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingPreference_no_delete"
BEFORE DELETE ON "ParentMeetingPreference"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_bb3545457b11474f4404"();

-- SQLite trigger parity: ParentMeetingPreference_no_update
CREATE FUNCTION "nalanda_trigger_12b1f4c2ff276554e6f0"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Parent Meeting preferences are immutable evidence';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "ParentMeetingPreference_no_update"
BEFORE UPDATE ON "ParentMeetingPreference"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_12b1f4c2ff276554e6f0"();

-- SQLite trigger parity: PayrollComponentResult_no_approved_delete
CREATE FUNCTION "nalanda_trigger_cc297c78a74ba0c55846"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (EXISTS (SELECT 1 FROM "EmployeePayrollResult" e JOIN "PayrollRun" r ON r."id" = e."payrollRunId" WHERE e."id" = OLD."employeePayrollResultId" AND r."status" IN ('APPROVED', 'LOCKED', 'PAYSLIPS_ISSUED', 'REVERSED', 'ARCHIVED'))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Approved payroll components cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "PayrollComponentResult_no_approved_delete"
BEFORE DELETE ON "PayrollComponentResult"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_cc297c78a74ba0c55846"();

-- SQLite trigger parity: PayrollComponentResult_no_approved_update
CREATE FUNCTION "nalanda_trigger_427f63250973c8f527e6"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (EXISTS (SELECT 1 FROM "EmployeePayrollResult" e JOIN "PayrollRun" r ON r."id" = e."payrollRunId" WHERE e."id" = OLD."employeePayrollResultId" AND r."status" IN ('APPROVED', 'LOCKED', 'PAYSLIPS_ISSUED', 'REVERSED', 'ARCHIVED'))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Approved payroll components are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "PayrollComponentResult_no_approved_update"
BEFORE UPDATE ON "PayrollComponentResult"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_427f63250973c8f527e6"();

-- SQLite trigger parity: PayrollEvent_no_delete
CREATE FUNCTION "nalanda_trigger_3aaf60294740aa780b52"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Payroll audit events cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "PayrollEvent_no_delete"
BEFORE DELETE ON "PayrollEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_3aaf60294740aa780b52"();

-- SQLite trigger parity: PayrollEvent_no_update
CREATE FUNCTION "nalanda_trigger_23433d3751e7f2d7dbb1"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Payroll audit events are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "PayrollEvent_no_update"
BEFORE UPDATE ON "PayrollEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_23433d3751e7f2d7dbb1"();

-- SQLite trigger parity: PayrollRun_no_approved_delete
CREATE FUNCTION "nalanda_trigger_3f7ef48d32df2ecc2b10"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" IN ('APPROVED', 'LOCKED', 'PAYSLIPS_ISSUED', 'REVERSED', 'ARCHIVED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Approved payroll runs cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "PayrollRun_no_approved_delete"
BEFORE DELETE ON "PayrollRun"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_3f7ef48d32df2ecc2b10"();

-- SQLite trigger parity: PayslipVersion_no_delete
CREATE FUNCTION "nalanda_trigger_62c2d9c01a886f14c3d2"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Issued payslip versions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "PayslipVersion_no_delete"
BEFORE DELETE ON "PayslipVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_62c2d9c01a886f14c3d2"();

-- SQLite trigger parity: PayslipVersion_no_update
CREATE FUNCTION "nalanda_trigger_634d2050225eb450414a"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Issued payslip versions are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "PayslipVersion_no_update"
BEFORE UPDATE ON "PayslipVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_634d2050225eb450414a"();

-- SQLite trigger parity: safe_exit_consent_no_delete
CREATE FUNCTION "nalanda_trigger_5094c673cd61c94b2dc3"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student departure consent evidence cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_consent_no_delete"
BEFORE DELETE ON "StudentDepartureConsentEvidence"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_5094c673cd61c94b2dc3"();

-- SQLite trigger parity: safe_exit_consent_no_update
CREATE FUNCTION "nalanda_trigger_b2f86bcead5e2bb3e83a"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student departure consent evidence is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_consent_no_update"
BEFORE UPDATE ON "StudentDepartureConsentEvidence"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_b2f86bcead5e2bb3e83a"();

-- SQLite trigger parity: safe_exit_correction_no_delete
CREATE FUNCTION "nalanda_trigger_a4017fc13f03a4690442"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student departure correction evidence cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_correction_no_delete"
BEFORE DELETE ON "StudentDepartureCorrectionEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_a4017fc13f03a4690442"();

-- SQLite trigger parity: safe_exit_correction_no_update
CREATE FUNCTION "nalanda_trigger_77bed7aea6a9dcb6ab30"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student departure correction evidence is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_correction_no_update"
BEFORE UPDATE ON "StudentDepartureCorrectionEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_77bed7aea6a9dcb6ab30"();

-- SQLite trigger parity: safe_exit_event_no_delete
CREATE FUNCTION "nalanda_trigger_3d67be8a642b9cfd949a"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student departure events cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_event_no_delete"
BEFORE DELETE ON "StudentDepartureEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_3d67be8a642b9cfd949a"();

-- SQLite trigger parity: safe_exit_event_no_update
CREATE FUNCTION "nalanda_trigger_b4cf606f3a2d92ad6efd"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student departure events are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_event_no_update"
BEFORE UPDATE ON "StudentDepartureEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_b4cf606f3a2d92ad6efd"();

-- SQLite trigger parity: safe_exit_fallback_no_delete
CREATE FUNCTION "nalanda_trigger_e2eca2e05bce9769884b"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student departure fallback tasks cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_fallback_no_delete"
BEFORE DELETE ON "StudentDepartureFallbackTask"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e2eca2e05bce9769884b"();

-- SQLite trigger parity: safe_exit_gate_pass_no_delete
CREATE FUNCTION "nalanda_trigger_248d86550ec64be0d0e8"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student gate passes cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_gate_pass_no_delete"
BEFORE DELETE ON "StudentGatePass"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_248d86550ec64be0d0e8"();

-- SQLite trigger parity: safe_exit_handover_no_delete
CREATE FUNCTION "nalanda_trigger_5eb9e58e3996e75d3e72"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student handover evidence cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_handover_no_delete"
BEFORE DELETE ON "StudentDepartureHandover"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_5eb9e58e3996e75d3e72"();

-- SQLite trigger parity: safe_exit_handover_no_update
CREATE FUNCTION "nalanda_trigger_b1e8587c6cfca7b319ae"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student handover evidence is append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_handover_no_update"
BEFORE UPDATE ON "StudentDepartureHandover"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_b1e8587c6cfca7b319ae"();

-- SQLite trigger parity: safe_exit_incident_action_no_delete
CREATE FUNCTION "nalanda_trigger_e3add7447c9e25969bd6"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Safety incident actions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_incident_action_no_delete"
BEFORE DELETE ON "StudentDepartureIncidentAction"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e3add7447c9e25969bd6"();

-- SQLite trigger parity: safe_exit_incident_action_no_update
CREATE FUNCTION "nalanda_trigger_78a06181d36bb526801b"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Safety incident actions are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_incident_action_no_update"
BEFORE UPDATE ON "StudentDepartureIncidentAction"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_78a06181d36bb526801b"();

-- SQLite trigger parity: safe_exit_incident_no_delete
CREATE FUNCTION "nalanda_trigger_24221a2e7e7555b2cc50"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student safety incidents cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_incident_no_delete"
BEFORE DELETE ON "StudentDepartureIncident"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_24221a2e7e7555b2cc50"();

-- SQLite trigger parity: safe_exit_outbox_no_delete
CREATE FUNCTION "nalanda_trigger_e8924bb42de07074f9d3"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student departure notification history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_outbox_no_delete"
BEFORE DELETE ON "StudentDepartureNotificationOutbox"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e8924bb42de07074f9d3"();

-- SQLite trigger parity: safe_exit_pass_immutable_identity
CREATE FUNCTION "nalanda_trigger_29aa67428a33036062ad"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."id" <> OLD."id" OR NEW."publicKey" <> OLD."publicKey" OR NEW."requestId" <> OLD."requestId" OR NEW."tokenHash" <> OLD."tokenHash" OR NEW."manualCodeHash" <> OLD."manualCodeHash" OR NEW."approvedSnapshotHash" <> OLD."approvedSnapshotHash" OR NEW."issuedAt" <> OLD."issuedAt" OR NEW."expiresAt" <> OLD."expiresAt") THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Gate-pass identity and approval snapshot are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_pass_immutable_identity"
BEFORE UPDATE ON "StudentGatePass"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_29aa67428a33036062ad"();

-- SQLite trigger parity: safe_exit_pass_status_insert
CREATE FUNCTION "nalanda_trigger_e23bd3ed0c8dc4d5a913"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('ACTIVE','USED','CANCELLED','EXPIRED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid gate-pass status';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_pass_status_insert"
BEFORE INSERT ON "StudentGatePass"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e23bd3ed0c8dc4d5a913"();

-- SQLite trigger parity: safe_exit_pass_status_update
CREATE FUNCTION "nalanda_trigger_ef9c00c9df41ac7dafc2"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('ACTIVE','USED','CANCELLED','EXPIRED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid gate-pass status';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_pass_status_update"
BEFORE UPDATE OF "status" ON "StudentGatePass"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_ef9c00c9df41ac7dafc2"();

-- SQLite trigger parity: safe_exit_presence_no_delete
CREATE FUNCTION "nalanda_trigger_ebca4ba9a8f94d3e2ef0"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Campus presence events cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_presence_no_delete"
BEFORE DELETE ON "StudentCampusPresenceEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_ebca4ba9a8f94d3e2ef0"();

-- SQLite trigger parity: safe_exit_presence_no_update
CREATE FUNCTION "nalanda_trigger_e80bf3d0fe40653d35b8"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Campus presence events are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_presence_no_update"
BEFORE UPDATE ON "StudentCampusPresenceEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e80bf3d0fe40653d35b8"();

-- SQLite trigger parity: safe_exit_request_immutable_identity
CREATE FUNCTION "nalanda_trigger_599d93a205ba83aefe8c"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."id" <> OLD."id" OR NEW."publicKey" <> OLD."publicKey" OR NEW."requestNumber" <> OLD."requestNumber" OR NEW."submissionKey" <> OLD."submissionKey" OR NEW."studentId" <> OLD."studentId" OR NEW."requestedByUserId" <> OLD."requestedByUserId" OR NEW."submittedAt" <> OLD."submittedAt") THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student departure request identity is immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_request_immutable_identity"
BEFORE UPDATE ON "StudentDepartureRequest"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_599d93a205ba83aefe8c"();

-- SQLite trigger parity: safe_exit_request_no_delete
CREATE FUNCTION "nalanda_trigger_c55c2fcfc3554d383550"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Student departure requests cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_request_no_delete"
BEFORE DELETE ON "StudentDepartureRequest"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_c55c2fcfc3554d383550"();

-- SQLite trigger parity: safe_exit_request_status_insert
CREATE FUNCTION "nalanda_trigger_6fbdb78930f5adb85c48"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('REQUESTED','CONSENT_PENDING','CONSENT_VERIFIED','CONSENT_DENIED','PARENT_UNREACHABLE','UNDER_SCHOOL_REVIEW','APPROVED','READY_FOR_HANDOVER','CHECKED_OUT','RETURN_EXPECTED','RETURNED_TO_CAMPUS','CANCELLED','EXPIRED','EMERGENCY_OVERRIDE','UNAUTHORISED_EXIT_SUSPECTED','UNAUTHORISED_EXIT_CONFIRMED','CLOSED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid Student departure lifecycle status';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_request_status_insert"
BEFORE INSERT ON "StudentDepartureRequest"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_6fbdb78930f5adb85c48"();

-- SQLite trigger parity: safe_exit_request_status_update
CREATE FUNCTION "nalanda_trigger_cd8c51aa576f960c9349"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('REQUESTED','CONSENT_PENDING','CONSENT_VERIFIED','CONSENT_DENIED','PARENT_UNREACHABLE','UNDER_SCHOOL_REVIEW','APPROVED','READY_FOR_HANDOVER','CHECKED_OUT','RETURN_EXPECTED','RETURNED_TO_CAMPUS','CANCELLED','EXPIRED','EMERGENCY_OVERRIDE','UNAUTHORISED_EXIT_SUSPECTED','UNAUTHORISED_EXIT_CONFIRMED','CLOSED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid Student departure lifecycle status';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_request_status_update"
BEFORE UPDATE OF "status" ON "StudentDepartureRequest"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_cd8c51aa576f960c9349"();

-- SQLite trigger parity: safe_exit_standing_auth_no_delete
CREATE FUNCTION "nalanda_trigger_eda1ef8772d32a0422ee"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Standing departure authorisation versions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_standing_auth_no_delete"
BEFORE DELETE ON "StudentStandingDepartureAuthorization"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_eda1ef8772d32a0422ee"();

-- SQLite trigger parity: safe_exit_standing_auth_no_update
CREATE FUNCTION "nalanda_trigger_8b60e0948c0f4f4c8f0b"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Standing departure authorisation versions are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_standing_auth_no_update"
BEFORE UPDATE ON "StudentStandingDepartureAuthorization"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_8b60e0948c0f4f4c8f0b"();

-- SQLite trigger parity: safe_exit_temporary_return_insert
CREATE FUNCTION "nalanda_trigger_76e40e80e4866dcf34a0"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF ((NEW."temporaryReturnRequired" = TRUE AND (NEW."expectedReturnAt" IS NULL OR NEW."expectedReturnAt" <= NEW."intendedDepartureAt"))
  OR (NEW."temporaryReturnRequired" = FALSE AND NEW."expectedReturnAt" IS NOT NULL)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Temporary exit return time is missing or inconsistent';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_temporary_return_insert"
BEFORE INSERT ON "StudentDepartureRequest"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_76e40e80e4866dcf34a0"();

-- SQLite trigger parity: safe_exit_temporary_return_update
CREATE FUNCTION "nalanda_trigger_7337927af5a93f3975aa"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF ((NEW."temporaryReturnRequired" = TRUE AND (NEW."expectedReturnAt" IS NULL OR NEW."expectedReturnAt" <= NEW."intendedDepartureAt"))
  OR (NEW."temporaryReturnRequired" = FALSE AND NEW."expectedReturnAt" IS NOT NULL)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Temporary exit return time is missing or inconsistent';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "safe_exit_temporary_return_update"
BEFORE UPDATE OF "temporaryReturnRequired", "expectedReturnAt" ON "StudentDepartureRequest"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7337927af5a93f3975aa"();

-- SQLite trigger parity: SalaryAdvance_no_delete
CREATE FUNCTION "nalanda_trigger_68aa2e8e4c3978459bd8"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Salary advances cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "SalaryAdvance_no_delete"
BEFORE DELETE ON "SalaryAdvance"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_68aa2e8e4c3978459bd8"();

-- SQLite trigger parity: SalaryComponentDefinition_no_locked_delete
CREATE FUNCTION "nalanda_trigger_b91d159bc67011e72665"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (EXISTS (SELECT 1 FROM "SalaryStructureVersion" s WHERE s."id" = OLD."structureVersionId" AND s."status" IN ('ACTIVE', 'ARCHIVED'))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Components of approved salary structures cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "SalaryComponentDefinition_no_locked_delete"
BEFORE DELETE ON "SalaryComponentDefinition"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_b91d159bc67011e72665"();

-- SQLite trigger parity: SalaryComponentDefinition_no_locked_update
CREATE FUNCTION "nalanda_trigger_ec9324d6e41a1d4b30af"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (EXISTS (SELECT 1 FROM "SalaryStructureVersion" s WHERE s."id" = OLD."structureVersionId" AND s."status" IN ('ACTIVE', 'ARCHIVED'))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Components of approved salary structures are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "SalaryComponentDefinition_no_locked_update"
BEFORE UPDATE ON "SalaryComponentDefinition"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_ec9324d6e41a1d4b30af"();

-- SQLite trigger parity: SalaryRevision_no_delete
CREATE FUNCTION "nalanda_trigger_9988e3fc04f03604de3f"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Salary revisions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "SalaryRevision_no_delete"
BEFORE DELETE ON "SalaryRevision"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_9988e3fc04f03604de3f"();

-- SQLite trigger parity: SalaryRevision_no_update
CREATE FUNCTION "nalanda_trigger_c18c00eb5bd2efb02a01"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Salary revisions are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "SalaryRevision_no_update"
BEFORE UPDATE ON "SalaryRevision"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_c18c00eb5bd2efb02a01"();

-- SQLite trigger parity: SalaryStructureVersion_no_approved_delete
CREATE FUNCTION "nalanda_trigger_062ad13af249bf0c9dee"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" IN ('ACTIVE', 'ARCHIVED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Approved salary structure versions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "SalaryStructureVersion_no_approved_delete"
BEFORE DELETE ON "SalaryStructureVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_062ad13af249bf0c9dee"();

-- SQLite trigger parity: SalaryStructureVersion_no_approved_update
CREATE FUNCTION "nalanda_trigger_48d790c4b054cf57d449"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" IN ('ACTIVE', 'ARCHIVED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Approved salary structure versions are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "SalaryStructureVersion_no_approved_update"
BEFORE UPDATE ON "SalaryStructureVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_48d790c4b054cf57d449"();

-- SQLite trigger parity: school_calendar_current_pointer_owner_guard
CREATE FUNCTION "nalanda_trigger_dcf8c19bb3c2d32112a1"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."currentPublishedVersionId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "SchoolCalendarEventVersion" currentVersion WHERE currentVersion."id" = NEW."currentPublishedVersionId" AND currentVersion."eventId" = NEW."id" AND currentVersion."status" = 'PUBLISHED' AND currentVersion."currentPublicationKey" IS NOT NULL
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Current event publication must belong to the same event';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "school_calendar_current_pointer_owner_guard"
BEFORE UPDATE OF "currentPublishedVersionId" ON "SchoolCalendarEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_dcf8c19bb3c2d32112a1"();

-- SQLite trigger parity: school_calendar_event_insert_draft_only
CREATE FUNCTION "nalanda_trigger_0a4279b7c53f3a1cbdaf"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'School calendar events must begin as drafts';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "school_calendar_event_insert_draft_only"
BEFORE INSERT ON "SchoolCalendarEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_0a4279b7c53f3a1cbdaf"();

-- SQLite trigger parity: school_calendar_event_publication_evidence_immutable
CREATE FUNCTION "nalanda_trigger_016c8da56d9bc29bc4ed"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" IN ('PUBLISHED','REPLACED','WITHDRAWN','ARCHIVED') AND (
  NEW."publicationReason" IS DISTINCT FROM OLD."publicationReason" OR
  NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'School calendar event publication evidence is immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "school_calendar_event_publication_evidence_immutable"
BEFORE UPDATE ON "SchoolCalendarEventVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_016c8da56d9bc29bc4ed"();

-- SQLite trigger parity: school_calendar_event_published_history_no_delete
CREATE FUNCTION "nalanda_trigger_c382d098ba4533984be6"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Published school calendar event history cannot be deleted';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "school_calendar_event_published_history_no_delete"
BEFORE DELETE ON "SchoolCalendarEventVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_c382d098ba4533984be6"();

-- SQLite trigger parity: school_calendar_event_replacement_owner_guard
CREATE FUNCTION "nalanda_trigger_14bb18683623f84c3f62"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."replacesVersionId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM "SchoolCalendarEventVersion" prior WHERE prior."id" = NEW."replacesVersionId" AND prior."eventId" = NEW."eventId" AND prior."versionNumber" < NEW."versionNumber"
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'School calendar event replacement must reference an earlier version of the same event';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "school_calendar_event_replacement_owner_guard"
BEFORE INSERT ON "SchoolCalendarEventVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_14bb18683623f84c3f62"();

-- SQLite trigger parity: school_calendar_event_version_content_immutable
CREATE FUNCTION "nalanda_trigger_d8bbe8346538dfda75fc"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" <> 'DRAFT' AND (
  NEW."eventType" IS DISTINCT FROM OLD."eventType" OR NEW."title" IS DISTINCT FROM OLD."title" OR
  NEW."description" IS DISTINCT FROM OLD."description" OR NEW."startsAt" IS DISTINCT FROM OLD."startsAt" OR
  NEW."endsAt" IS DISTINCT FROM OLD."endsAt" OR NEW."allDay" IS DISTINCT FROM OLD."allDay" OR
  NEW."venue" IS DISTINCT FROM OLD."venue" OR NEW."parentInstructions" IS DISTINCT FROM OLD."parentInstructions" OR
  NEW."internalNotes" IS DISTINCT FROM OLD."internalNotes" OR NEW."audienceType" IS DISTINCT FROM OLD."audienceType" OR
  NEW."roleScope" IS DISTINCT FROM OLD."roleScope" OR NEW."classSectionId" IS DISTINCT FROM OLD."classSectionId" OR
  NEW."className" IS DISTINCT FROM OLD."className" OR NEW."section" IS DISTINCT FROM OLD."section" OR
  NEW."audienceKey" IS DISTINCT FROM OLD."audienceKey" OR
  NEW."examinationTimetableVersionId" IS DISTINCT FROM OLD."examinationTimetableVersionId" OR
  NEW."replacesVersionId" IS DISTINCT FROM OLD."replacesVersionId" OR NEW."contentHash" IS DISTINCT FROM OLD."contentHash"
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'School calendar event content is immutable after review submission';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "school_calendar_event_version_content_immutable"
BEFORE UPDATE ON "SchoolCalendarEventVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_d8bbe8346538dfda75fc"();

-- SQLite trigger parity: school_calendar_event_version_evidence_set_once
CREATE FUNCTION "nalanda_trigger_1dda1583f1efbbe01525"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF ((OLD."submittedAt" IS NOT NULL AND NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt") OR
  (OLD."approvedAt" IS NOT NULL AND NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt") OR
  (OLD."publishedAt" IS NOT NULL AND NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt") OR
  (OLD."replacedAt" IS NOT NULL AND NEW."replacedAt" IS DISTINCT FROM OLD."replacedAt") OR
  (OLD."withdrawnAt" IS NOT NULL AND NEW."withdrawnAt" IS DISTINCT FROM OLD."withdrawnAt") OR
  (OLD."archivedAt" IS NOT NULL AND NEW."archivedAt" IS DISTINCT FROM OLD."archivedAt") OR
  (OLD."publicationReason" IS NOT NULL AND NEW."publicationReason" IS DISTINCT FROM OLD."publicationReason") OR
  (OLD."replacementReason" IS NOT NULL AND NEW."replacementReason" IS DISTINCT FROM OLD."replacementReason") OR
  (OLD."withdrawalReason" IS NOT NULL AND NEW."withdrawalReason" IS DISTINCT FROM OLD."withdrawalReason") OR
  (OLD."archiveReason" IS NOT NULL AND NEW."archiveReason" IS DISTINCT FROM OLD."archiveReason") OR
  (OLD."idempotencyKey" IS NOT NULL AND NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey") OR
  (OLD."replacesVersionId" IS NOT NULL AND NEW."replacesVersionId" IS DISTINCT FROM OLD."replacesVersionId")) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'School calendar event lifecycle evidence is set-once';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "school_calendar_event_version_evidence_set_once"
BEFORE UPDATE ON "SchoolCalendarEventVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_1dda1583f1efbbe01525"();

-- SQLite trigger parity: school_calendar_event_version_insert_draft_only
CREATE FUNCTION "nalanda_trigger_77adbabde3346a96d033"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" <> 'DRAFT') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'School calendar event versions must begin as drafts';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "school_calendar_event_version_insert_draft_only"
BEFORE INSERT ON "SchoolCalendarEventVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_77adbabde3346a96d033"();

-- SQLite trigger parity: school_calendar_event_version_status_transition
CREATE FUNCTION "nalanda_trigger_e4b8daceceaccad1f7cf"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NOT (
  NEW."status" = OLD."status" OR
  (OLD."status" = 'DRAFT' AND NEW."status" = 'READY_FOR_REVIEW' AND NEW."submittedAt" IS NOT NULL) OR
  (OLD."status" = 'READY_FOR_REVIEW' AND NEW."status" = 'PUBLISHED' AND NEW."approvedAt" IS NOT NULL AND NEW."publishedAt" IS NOT NULL AND NEW."publicationReason" IS NOT NULL AND NEW."currentPublicationKey" IS NOT NULL) OR
  (OLD."status" = 'PUBLISHED' AND NEW."status" = 'REPLACED' AND NEW."replacedAt" IS NOT NULL AND NEW."currentPublicationKey" IS NULL) OR
  (OLD."status" = 'PUBLISHED' AND NEW."status" = 'WITHDRAWN' AND NEW."withdrawnAt" IS NOT NULL AND NEW."withdrawalReason" IS NOT NULL AND NEW."currentPublicationKey" IS NULL) OR
  (OLD."status" IN ('REPLACED','WITHDRAWN') AND NEW."status" = 'ARCHIVED' AND NEW."archivedAt" IS NOT NULL AND NEW."archiveReason" IS NOT NULL)
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Invalid school calendar event lifecycle transition';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "school_calendar_event_version_status_transition"
BEFORE UPDATE OF "status" ON "SchoolCalendarEventVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e4b8daceceaccad1f7cf"();

-- SQLite trigger parity: StaffPayslipAccessEvent_no_delete
CREATE FUNCTION "nalanda_trigger_31c40140866b2d728b7a"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Staff payslip access events are append-only';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "StaffPayslipAccessEvent_no_delete"
BEFORE DELETE ON "StaffPayslipAccessEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_31c40140866b2d728b7a"();

-- SQLite trigger parity: StaffPayslipAccessEvent_no_update
CREATE FUNCTION "nalanda_trigger_1d6826045ec5ee9bde93"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Staff payslip access events are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "StaffPayslipAccessEvent_no_update"
BEFORE UPDATE ON "StaffPayslipAccessEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_1d6826045ec5ee9bde93"();

-- SQLite trigger parity: StaffPayslipDocumentMonth_no_delete
CREATE FUNCTION "nalanda_trigger_1c77983d4900c2e113a6"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Staff payslip document month links are immutable';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "StaffPayslipDocumentMonth_no_delete"
BEFORE DELETE ON "StaffPayslipDocumentMonth"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_1c77983d4900c2e113a6"();

-- SQLite trigger parity: StaffPayslipDocumentMonth_no_update
CREATE FUNCTION "nalanda_trigger_125b0cd45e38258f629a"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Staff payslip document month links are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "StaffPayslipDocumentMonth_no_update"
BEFORE UPDATE ON "StaffPayslipDocumentMonth"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_125b0cd45e38258f629a"();

-- SQLite trigger parity: StaffPayslipDocumentVersion_issued_immutable
CREATE FUNCTION "nalanda_trigger_ff516c1c410ac26bf322"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" IN ('ACTIVE', 'REPLACED', 'WITHDRAWN') AND (
  NEW."requestId" <> OLD."requestId" OR NEW."versionNumber" <> OLD."versionNumber" OR
  NEW."verificationReference" <> OLD."verificationReference" OR NEW."sourceStorageKey" <> OLD."sourceStorageKey" OR
  NEW."sourceKeyVersion" <> OLD."sourceKeyVersion" OR NEW."sourceNonce" <> OLD."sourceNonce" OR
  NEW."sourceAuthTag" <> OLD."sourceAuthTag" OR NEW."sourceSha256" <> OLD."sourceSha256" OR
  NEW."sourceByteSize" <> OLD."sourceByteSize" OR NEW."derivativeStorageKey" <> OLD."derivativeStorageKey" OR
  NEW."derivativeSha256" <> OLD."derivativeSha256" OR NEW."derivativeByteSize" <> OLD."derivativeByteSize" OR
  NEW."pageCount" <> OLD."pageCount" OR NEW."passwordKeyVersion" <> OLD."passwordKeyVersion" OR
  NEW."passwordNonce" <> OLD."passwordNonce" OR NEW."passwordCiphertext" <> OLD."passwordCiphertext" OR
  NEW."passwordAuthTag" <> OLD."passwordAuthTag" OR NEW."uploadedByUserId" <> OLD."uploadedByUserId" OR
  COALESCE(NEW."supersedesVersionId", '') <> COALESCE(OLD."supersedesVersionId", '')
)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Issued staff payslip document bytes and protection metadata are immutable';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "StaffPayslipDocumentVersion_issued_immutable"
BEFORE UPDATE ON "StaffPayslipDocumentVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_ff516c1c410ac26bf322"();

-- SQLite trigger parity: StaffPayslipDocumentVersion_no_delete
CREATE FUNCTION "nalanda_trigger_02e77775e4396d5354cd"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Staff payslip document versions are immutable';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "StaffPayslipDocumentVersion_no_delete"
BEFORE DELETE ON "StaffPayslipDocumentVersion"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_02e77775e4396d5354cd"();

-- SQLite trigger parity: StaffPayslipRequest_no_delete
CREATE FUNCTION "nalanda_trigger_7af119349a85409d7159"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Staff payslip requests are append-preserved';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "StaffPayslipRequest_no_delete"
BEFORE DELETE ON "StaffPayslipRequest"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7af119349a85409d7159"();

-- SQLite trigger parity: StaffPayslipRequestEvent_no_delete
CREATE FUNCTION "nalanda_trigger_acddf65dbb3806a9cdf8"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Staff payslip request events are append-only';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "StaffPayslipRequestEvent_no_delete"
BEFORE DELETE ON "StaffPayslipRequestEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_acddf65dbb3806a9cdf8"();

-- SQLite trigger parity: StaffPayslipRequestEvent_no_update
CREATE FUNCTION "nalanda_trigger_34ffe6ed2fcbc2b0638c"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Staff payslip request events are append-only';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "StaffPayslipRequestEvent_no_update"
BEFORE UPDATE ON "StaffPayslipRequestEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_34ffe6ed2fcbc2b0638c"();

-- SQLite trigger parity: StaffPayslipRequestMonth_no_delete
CREATE FUNCTION "nalanda_trigger_d180f7a115aa74e3fc6d"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Staff payslip request months are append-preserved';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "StaffPayslipRequestMonth_no_delete"
BEFORE DELETE ON "StaffPayslipRequestMonth"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_d180f7a115aa74e3fc6d"();
