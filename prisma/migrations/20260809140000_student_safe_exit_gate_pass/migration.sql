-- CreateTable
CREATE TABLE "StudentDepartureRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "submissionKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "reasonCategory" TEXT NOT NULL,
    "reasonDetails" TEXT,
    "calendarBasisJson" TEXT NOT NULL,
    "intendedHandoverMethod" TEXT NOT NULL,
    "intendedDepartureAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "consentState" TEXT NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedHandoverMethod" TEXT,
    "approvedRecipientName" TEXT,
    "approvedRelationship" TEXT,
    "approvedContactMasked" TEXT,
    "parentAuthorisationEvidence" TEXT,
    "verificationReference" TEXT,
    "approvedDepartureAt" DATETIME,
    "approvalExpiresAt" DATETIME,
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
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "cancelledAt" DATETIME,
    "checkedOutAt" DATETIME,
    "returnedAt" DATETIME,
    "closedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentDepartureRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentDepartureConsentEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentDepartureConsentEvidence_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentDepartureConsentEvidence_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentStandingDepartureAuthorization" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveUntil" DATETIME NOT NULL,
    "conditions" TEXT,
    "guardianApprovalMethod" TEXT NOT NULL,
    "guardianApprovedAt" DATETIME NOT NULL,
    "supersedesPublicKey" TEXT,
    "revocationReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentStandingDepartureAuthorization_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentStandingDepartureAuthorization_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentGatePass" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "manualCodeHash" TEXT NOT NULL,
    "manualCodeLastTwo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "approvedSnapshotHash" TEXT NOT NULL,
    "issuedByUserId" TEXT NOT NULL,
    "issuedByRole" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "consumedByUserId" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentGatePass_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentDepartureHandover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "handoverMethod" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "contactMasked" TEXT,
    "parentAuthorisationEvidence" TEXT NOT NULL,
    "verificationReference" TEXT,
    "verifiedByUserId" TEXT NOT NULL,
    "verifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentDepartureHandover_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentDepartureEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentDepartureEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentCampusPresenceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentCampusPresenceEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentCampusPresenceEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentDepartureIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestId" TEXT,
    "status" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastConfirmedLocation" TEXT,
    "lastConfirmedAt" DATETIME,
    "locatedAt" DATETIME,
    "restricted" BOOLEAN NOT NULL DEFAULT true,
    "linkedSupportRequestKey" TEXT,
    "reportedByUserId" TEXT NOT NULL,
    "confirmedByUserId" TEXT,
    "closedByUserId" TEXT,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentDepartureIncident_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentDepartureIncident_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentDepartureIncidentAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "outcome" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByRole" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentDepartureIncidentAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "StudentDepartureIncident" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentDepartureNotificationOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "nextAttemptAt" DATETIME,
    "claimedAt" DATETIME,
    "queuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "failedAt" DATETIME,
    "providerReferenceSafe" TEXT,
    "failureCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentDepartureNotificationOutbox_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentDepartureFallbackTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reasonCode" TEXT NOT NULL,
    "assignedRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "completedByUserId" TEXT,
    CONSTRAINT "StudentDepartureFallbackTask_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppPushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "providerMode" TEXT NOT NULL DEFAULT 'TEST_SINK',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "verifiedAt" DATETIME,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

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
CREATE INDEX "StudentStandingDepartureAuthorization_seriesKey_versionNumber_idx" ON "StudentStandingDepartureAuthorization"("seriesKey", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StudentStandingDepartureAuthorization_seriesKey_versionNumber_key" ON "StudentStandingDepartureAuthorization"("seriesKey", "versionNumber");

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
CREATE UNIQUE INDEX "StudentDepartureNotificationOutbox_eventKey_recipientUserId_channel_key" ON "StudentDepartureNotificationOutbox"("eventKey", "recipientUserId", "channel");

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

-- Append-only and no-hard-delete safety boundaries.
CREATE TRIGGER "safe_exit_consent_no_update"
BEFORE UPDATE ON "StudentDepartureConsentEvidence"
BEGIN SELECT RAISE(ABORT, 'Student departure consent evidence is append-only'); END;
CREATE TRIGGER "safe_exit_consent_no_delete"
BEFORE DELETE ON "StudentDepartureConsentEvidence"
BEGIN SELECT RAISE(ABORT, 'Student departure consent evidence cannot be deleted'); END;
CREATE TRIGGER "safe_exit_standing_auth_no_update"
BEFORE UPDATE ON "StudentStandingDepartureAuthorization"
BEGIN SELECT RAISE(ABORT, 'Standing departure authorisation versions are append-only'); END;
CREATE TRIGGER "safe_exit_standing_auth_no_delete"
BEFORE DELETE ON "StudentStandingDepartureAuthorization"
BEGIN SELECT RAISE(ABORT, 'Standing departure authorisation versions cannot be deleted'); END;
CREATE TRIGGER "safe_exit_handover_no_update"
BEFORE UPDATE ON "StudentDepartureHandover"
BEGIN SELECT RAISE(ABORT, 'Student handover evidence is append-only'); END;
CREATE TRIGGER "safe_exit_handover_no_delete"
BEFORE DELETE ON "StudentDepartureHandover"
BEGIN SELECT RAISE(ABORT, 'Student handover evidence cannot be deleted'); END;
CREATE TRIGGER "safe_exit_event_no_update"
BEFORE UPDATE ON "StudentDepartureEvent"
BEGIN SELECT RAISE(ABORT, 'Student departure events are append-only'); END;
CREATE TRIGGER "safe_exit_event_no_delete"
BEFORE DELETE ON "StudentDepartureEvent"
BEGIN SELECT RAISE(ABORT, 'Student departure events cannot be deleted'); END;
CREATE TRIGGER "safe_exit_presence_no_update"
BEFORE UPDATE ON "StudentCampusPresenceEvent"
BEGIN SELECT RAISE(ABORT, 'Campus presence events are append-only'); END;
CREATE TRIGGER "safe_exit_presence_no_delete"
BEFORE DELETE ON "StudentCampusPresenceEvent"
BEGIN SELECT RAISE(ABORT, 'Campus presence events cannot be deleted'); END;
CREATE TRIGGER "safe_exit_incident_action_no_update"
BEFORE UPDATE ON "StudentDepartureIncidentAction"
BEGIN SELECT RAISE(ABORT, 'Safety incident actions are append-only'); END;
CREATE TRIGGER "safe_exit_incident_action_no_delete"
BEFORE DELETE ON "StudentDepartureIncidentAction"
BEGIN SELECT RAISE(ABORT, 'Safety incident actions cannot be deleted'); END;
CREATE TRIGGER "safe_exit_request_no_delete"
BEFORE DELETE ON "StudentDepartureRequest"
BEGIN SELECT RAISE(ABORT, 'Student departure requests cannot be deleted'); END;
CREATE TRIGGER "safe_exit_gate_pass_no_delete"
BEFORE DELETE ON "StudentGatePass"
BEGIN SELECT RAISE(ABORT, 'Student gate passes cannot be deleted'); END;
CREATE TRIGGER "safe_exit_incident_no_delete"
BEFORE DELETE ON "StudentDepartureIncident"
BEGIN SELECT RAISE(ABORT, 'Student safety incidents cannot be deleted'); END;
CREATE TRIGGER "safe_exit_outbox_no_delete"
BEFORE DELETE ON "StudentDepartureNotificationOutbox"
BEGIN SELECT RAISE(ABORT, 'Student departure notification history cannot be deleted'); END;
CREATE TRIGGER "safe_exit_fallback_no_delete"
BEFORE DELETE ON "StudentDepartureFallbackTask"
BEGIN SELECT RAISE(ABORT, 'Student departure fallback tasks cannot be deleted'); END;

-- Validate lifecycle/status fields at the database boundary as a second line of defence.
CREATE TRIGGER "safe_exit_request_status_insert"
BEFORE INSERT ON "StudentDepartureRequest"
WHEN NEW."status" NOT IN ('REQUESTED','CONSENT_PENDING','CONSENT_VERIFIED','CONSENT_DENIED','PARENT_UNREACHABLE','UNDER_SCHOOL_REVIEW','APPROVED','READY_FOR_HANDOVER','CHECKED_OUT','RETURNED_TO_CAMPUS','CANCELLED','EXPIRED','EMERGENCY_OVERRIDE','UNAUTHORISED_EXIT_SUSPECTED','UNAUTHORISED_EXIT_CONFIRMED','CLOSED')
BEGIN SELECT RAISE(ABORT, 'Invalid Student departure lifecycle status'); END;
CREATE TRIGGER "safe_exit_request_status_update"
BEFORE UPDATE OF "status" ON "StudentDepartureRequest"
WHEN NEW."status" NOT IN ('REQUESTED','CONSENT_PENDING','CONSENT_VERIFIED','CONSENT_DENIED','PARENT_UNREACHABLE','UNDER_SCHOOL_REVIEW','APPROVED','READY_FOR_HANDOVER','CHECKED_OUT','RETURNED_TO_CAMPUS','CANCELLED','EXPIRED','EMERGENCY_OVERRIDE','UNAUTHORISED_EXIT_SUSPECTED','UNAUTHORISED_EXIT_CONFIRMED','CLOSED')
BEGIN SELECT RAISE(ABORT, 'Invalid Student departure lifecycle status'); END;
CREATE TRIGGER "safe_exit_pass_status_insert"
BEFORE INSERT ON "StudentGatePass"
WHEN NEW."status" NOT IN ('ACTIVE','USED','CANCELLED','EXPIRED')
BEGIN SELECT RAISE(ABORT, 'Invalid gate-pass status'); END;
CREATE TRIGGER "safe_exit_pass_status_update"
BEFORE UPDATE OF "status" ON "StudentGatePass"
WHEN NEW."status" NOT IN ('ACTIVE','USED','CANCELLED','EXPIRED')
BEGIN SELECT RAISE(ABORT, 'Invalid gate-pass status'); END;

-- Preserve immutable request/pass identity and approval snapshots across mutable lifecycle changes.
CREATE TRIGGER "safe_exit_request_immutable_identity"
BEFORE UPDATE ON "StudentDepartureRequest"
WHEN NEW."id" <> OLD."id" OR NEW."publicKey" <> OLD."publicKey" OR NEW."requestNumber" <> OLD."requestNumber" OR NEW."submissionKey" <> OLD."submissionKey" OR NEW."studentId" <> OLD."studentId" OR NEW."requestedByUserId" <> OLD."requestedByUserId" OR NEW."submittedAt" <> OLD."submittedAt"
BEGIN SELECT RAISE(ABORT, 'Student departure request identity is immutable'); END;
CREATE TRIGGER "safe_exit_pass_immutable_identity"
BEFORE UPDATE ON "StudentGatePass"
WHEN NEW."id" <> OLD."id" OR NEW."publicKey" <> OLD."publicKey" OR NEW."requestId" <> OLD."requestId" OR NEW."tokenHash" <> OLD."tokenHash" OR NEW."manualCodeHash" <> OLD."manualCodeHash" OR NEW."approvedSnapshotHash" <> OLD."approvedSnapshotHash" OR NEW."issuedAt" <> OLD."issuedAt" OR NEW."expiresAt" <> OLD."expiresAt"
BEGIN SELECT RAISE(ABORT, 'Gate-pass identity and approval snapshot are immutable'); END;
-- SAFE-EXIT-1A adds a least-privileged Gate Staff context. Rebuild the existing
-- assignment table only to widen its closed role check; every row and key is preserved.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
DROP TRIGGER IF EXISTS "iam_prevent_last_super_admin_suspension";
DROP TRIGGER IF EXISTS "iam_prevent_last_super_admin_role_end";
DROP TRIGGER IF EXISTS "iam_prevent_active_super_admin_role_delete";
DROP TRIGGER IF EXISTS "iam_prevent_expiring_super_admin_role_insert";
DROP TRIGGER IF EXISTS "iam_prevent_expiring_super_admin_role_update";
CREATE TABLE "new_UserRoleAssignment" (
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
  CONSTRAINT "UserRoleAssignment_status_check" CHECK ("status" IN ('ACTIVE','ENDED','REVOKED')),
  CONSTRAINT "UserRoleAssignment_dates_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  CONSTRAINT "UserRoleAssignment_end_check" CHECK (("status" = 'ACTIVE' AND "endedAt" IS NULL) OR ("status" <> 'ACTIVE' AND "endedAt" IS NOT NULL))
);
INSERT INTO "new_UserRoleAssignment" ("id","publicKey","userId","role","status","validFrom","validUntil","reason","assignedByUserId","endedByUserId","endedAt","version","contextVersion","activeKey","createdAt","updatedAt") SELECT "id","publicKey","userId","role","status","validFrom","validUntil","reason","assignedByUserId","endedByUserId","endedAt","version","contextVersion","activeKey","createdAt","updatedAt" FROM "UserRoleAssignment";
DROP TABLE "UserRoleAssignment";
ALTER TABLE "new_UserRoleAssignment" RENAME TO "UserRoleAssignment";
CREATE UNIQUE INDEX "UserRoleAssignment_publicKey_key" ON "UserRoleAssignment"("publicKey");
CREATE UNIQUE INDEX "UserRoleAssignment_activeKey_key" ON "UserRoleAssignment"("activeKey");
CREATE INDEX "UserRoleAssignment_userId_status_validFrom_validUntil_idx" ON "UserRoleAssignment"("userId","status","validFrom","validUntil");
CREATE INDEX "UserRoleAssignment_role_status_idx" ON "UserRoleAssignment"("role","status");
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
