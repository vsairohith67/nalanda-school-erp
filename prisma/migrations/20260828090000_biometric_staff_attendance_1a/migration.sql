-- BIOMETRIC-STAFF-ATTENDANCE-1A normalized device evidence and governance.
-- Biometric images/templates, vendor biometric databases, card secrets and
-- device administrator passwords are intentionally absent.
CREATE TABLE "BiometricBridge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicBridgeId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "publicSigningKey" TEXT NOT NULL,
  "publicKeyHash" TEXT NOT NULL,
  "keyAlgorithm" TEXT NOT NULL DEFAULT 'ED25519',
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "approvedByUserId" TEXT,
  "approvedAt" DATETIME,
  "revokedByUserId" TEXT,
  "revokedAt" DATETIME,
  "revocationReason" TEXT,
  "lastSyncAt" DATETIME,
  "lastEventAt" DATETIME,
  "lastHealthAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "BiometricDevice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicDeviceId" TEXT NOT NULL,
  "bridgeId" TEXT NOT NULL,
  "vendor" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "firmware" TEXT,
  "serialReferenceMasked" TEXT,
  "campus" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "protocolProfile" TEXT NOT NULL,
  "protocolProofStatus" TEXT NOT NULL DEFAULT 'NOT_PROVIDED',
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "clockDriftSeconds" INTEGER,
  "clockDriftStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "sequenceEpoch" INTEGER NOT NULL DEFAULT 1,
  "lastSequence" INTEGER,
  "lastEventAt" DATETIME,
  "lastSyncAt" DATETIME,
  "lastHealthAt" DATETIME,
  "approvedByUserId" TEXT,
  "approvedAt" DATETIME,
  "revokedByUserId" TEXT,
  "revokedAt" DATETIME,
  "revocationReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BiometricDevice_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "BiometricBridge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BiometricStaffMapping" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "opaqueDeviceUserId" TEXT NOT NULL,
  "staffMemberId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "effectiveFrom" DATETIME NOT NULL,
  "effectiveTo" DATETIME,
  "preparedByUserId" TEXT NOT NULL,
  "preparationReason" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvedAt" DATETIME,
  "revokedByUserId" TEXT,
  "revokedAt" DATETIME,
  "revocationReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BiometricStaffMapping_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricStaffMapping_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BiometricIngestBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchReference" TEXT NOT NULL,
  "bridgeId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL,
  "eventCount" INTEGER NOT NULL,
  "sequenceStart" INTEGER,
  "sequenceEnd" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiometricIngestBatch_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "BiometricBridge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BiometricReplayNonce" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "bridgeId" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "seenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" DATETIME NOT NULL,
  CONSTRAINT "BiometricReplayNonce_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "BiometricBridge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BiometricRawPunch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "eventIdentityHash" TEXT NOT NULL,
  "eventPayloadHash" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "bridgeId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "mappingId" TEXT,
  "staffMemberId" TEXT,
  "opaqueDeviceUserId" TEXT NOT NULL,
  "punchTimestamp" DATETIME NOT NULL,
  "bridgeReceivedTimestamp" DATETIME NOT NULL,
  "receivedTimestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verificationMethod" TEXT NOT NULL,
  "punchCode" TEXT NOT NULL,
  "statusCode" TEXT,
  "sequenceNumber" INTEGER,
  "sequenceEpoch" INTEGER NOT NULL DEFAULT 1,
  "eventReference" TEXT,
  "protocolProfile" TEXT NOT NULL,
  "clockDriftSeconds" INTEGER,
  "clockDriftStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiometricRawPunch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BiometricIngestBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricRawPunch_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "BiometricBridge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricRawPunch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricRawPunch_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "BiometricStaffMapping" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BiometricRawPunch_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BiometricSequenceGap" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deviceId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sequenceEpoch" INTEGER NOT NULL,
  "expectedSequence" INTEGER NOT NULL,
  "receivedSequence" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedByUserId" TEXT,
  "acknowledgedAt" DATETIME,
  "acknowledgementNote" TEXT,
  CONSTRAINT "BiometricSequenceGap_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricSequenceGap_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BiometricIngestBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BiometricAttendancePolicy" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "campus" TEXT NOT NULL,
  "effectiveFrom" DATETIME NOT NULL,
  "effectiveTo" DATETIME,
  "shiftStartTime" TEXT NOT NULL,
  "shiftEndTime" TEXT NOT NULL,
  "workdayBasis" TEXT NOT NULL DEFAULT 'PUBLISHED_CALENDAR',
  "shiftType" TEXT NOT NULL DEFAULT 'DAY',
  "graceMinutes" INTEGER NOT NULL DEFAULT 0,
  "lateThresholdMinutes" INTEGER NOT NULL DEFAULT 0,
  "earlyDepartureGraceMinutes" INTEGER NOT NULL DEFAULT 0,
  "earlyDepartureThresholdMinutes" INTEGER NOT NULL DEFAULT 0,
  "fullDayThresholdMinutes" INTEGER NOT NULL DEFAULT 480,
  "halfDayThresholdMinutes" INTEGER NOT NULL DEFAULT 240,
  "halfDayRule" TEXT NOT NULL DEFAULT 'DURATION_THRESHOLD',
  "missingInBehavior" TEXT NOT NULL DEFAULT 'EXCEPTION',
  "missingOutBehavior" TEXT NOT NULL DEFAULT 'EXCEPTION',
  "multiplePunchStrategy" TEXT NOT NULL DEFAULT 'FIRST_IN_LAST_OUT_FLAG',
  "leaveInteraction" TEXT NOT NULL DEFAULT 'APPROVED_LEAVE_GOVERNS',
  "holidayInteraction" TEXT NOT NULL DEFAULT 'FLAG_PUNCH',
  "overnightShiftEnabled" BOOLEAN NOT NULL DEFAULT false,
  "splitShiftEnabled" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "preparedByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvedAt" DATETIME,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "BiometricReconciliation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "staffMemberId" TEXT NOT NULL,
  "attendanceDate" DATETIME NOT NULL,
  "policyId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "outcome" TEXT NOT NULL DEFAULT 'UNRESOLVED',
  "firstPunchId" TEXT,
  "lastPunchId" TEXT,
  "punchCount" INTEGER NOT NULL DEFAULT 0,
  "checkInTime" TEXT,
  "checkOutTime" TEXT,
  "lateMinutes" INTEGER,
  "earlyDepartureMinutes" INTEGER,
  "exceptionCode" TEXT,
  "leaveRequestId" TEXT,
  "calendarDayId" TEXT,
  "attendanceRecordId" TEXT,
  "preparedByUserId" TEXT,
  "preparedAt" DATETIME,
  "approvedByUserId" TEXT,
  "approvedAt" DATETIME,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BiometricReconciliation_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricReconciliation_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "BiometricAttendancePolicy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BiometricCorrection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "reconciliationId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "preparedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "reason" TEXT NOT NULL,
  "originalEvidenceJson" TEXT NOT NULL,
  "beforeJson" TEXT NOT NULL,
  "afterJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" DATETIME,
  "rejectedAt" DATETIME,
  "rejectionReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiometricCorrection_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BiometricReconciliation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BiometricAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT,
  "safeMetadataJson" TEXT,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "BiometricBridge_publicBridgeId_key" ON "BiometricBridge"("publicBridgeId");
CREATE INDEX "BiometricBridge_status_createdAt_idx" ON "BiometricBridge"("status", "createdAt");
CREATE INDEX "BiometricBridge_lastSyncAt_idx" ON "BiometricBridge"("lastSyncAt");
CREATE UNIQUE INDEX "BiometricDevice_publicDeviceId_key" ON "BiometricDevice"("publicDeviceId");
CREATE INDEX "BiometricDevice_bridgeId_status_idx" ON "BiometricDevice"("bridgeId", "status");
CREATE INDEX "BiometricDevice_campus_location_idx" ON "BiometricDevice"("campus", "location");
CREATE INDEX "BiometricDevice_protocolProfile_status_idx" ON "BiometricDevice"("protocolProfile", "status");
CREATE INDEX "BiometricDevice_lastEventAt_idx" ON "BiometricDevice"("lastEventAt");
CREATE UNIQUE INDEX "BiometricStaffMapping_publicKey_key" ON "BiometricStaffMapping"("publicKey");
CREATE INDEX "BiometricStaffMapping_deviceId_opaqueDeviceUserId_status_idx" ON "BiometricStaffMapping"("deviceId", "opaqueDeviceUserId", "status");
CREATE INDEX "BiometricStaffMapping_staffMemberId_status_effectiveFrom_idx" ON "BiometricStaffMapping"("staffMemberId", "status", "effectiveFrom");
CREATE INDEX "BiometricStaffMapping_approvedByUserId_approvedAt_idx" ON "BiometricStaffMapping"("approvedByUserId", "approvedAt");
CREATE UNIQUE INDEX "BiometricStaffMapping_deviceId_opaqueDeviceUserId_effectiveFrom_key" ON "BiometricStaffMapping"("deviceId", "opaqueDeviceUserId", "effectiveFrom");
CREATE UNIQUE INDEX "BiometricStaffMapping_one_open_active" ON "BiometricStaffMapping"("deviceId", "opaqueDeviceUserId") WHERE "status" = 'ACTIVE' AND "effectiveTo" IS NULL;
CREATE INDEX "BiometricIngestBatch_bridgeId_receivedAt_idx" ON "BiometricIngestBatch"("bridgeId", "receivedAt");
CREATE INDEX "BiometricIngestBatch_status_receivedAt_idx" ON "BiometricIngestBatch"("status", "receivedAt");
CREATE UNIQUE INDEX "BiometricIngestBatch_bridgeId_batchReference_key" ON "BiometricIngestBatch"("bridgeId", "batchReference");
CREATE UNIQUE INDEX "BiometricIngestBatch_bridgeId_nonceHash_key" ON "BiometricIngestBatch"("bridgeId", "nonceHash");
CREATE INDEX "BiometricReplayNonce_expiresAt_idx" ON "BiometricReplayNonce"("expiresAt");
CREATE UNIQUE INDEX "BiometricReplayNonce_bridgeId_nonceHash_key" ON "BiometricReplayNonce"("bridgeId", "nonceHash");
CREATE UNIQUE INDEX "BiometricRawPunch_publicKey_key" ON "BiometricRawPunch"("publicKey");
CREATE UNIQUE INDEX "BiometricRawPunch_eventIdentityHash_key" ON "BiometricRawPunch"("eventIdentityHash");
CREATE INDEX "BiometricRawPunch_deviceId_punchTimestamp_idx" ON "BiometricRawPunch"("deviceId", "punchTimestamp");
CREATE INDEX "BiometricRawPunch_staffMemberId_punchTimestamp_idx" ON "BiometricRawPunch"("staffMemberId", "punchTimestamp");
CREATE INDEX "BiometricRawPunch_opaqueDeviceUserId_punchTimestamp_idx" ON "BiometricRawPunch"("opaqueDeviceUserId", "punchTimestamp");
CREATE INDEX "BiometricRawPunch_reconciliationStatus_receivedTimestamp_idx" ON "BiometricRawPunch"("reconciliationStatus", "receivedTimestamp");
CREATE INDEX "BiometricRawPunch_deviceId_sequenceEpoch_sequenceNumber_idx" ON "BiometricRawPunch"("deviceId", "sequenceEpoch", "sequenceNumber");
CREATE INDEX "BiometricSequenceGap_deviceId_status_detectedAt_idx" ON "BiometricSequenceGap"("deviceId", "status", "detectedAt");
CREATE UNIQUE INDEX "BiometricSequenceGap_deviceId_sequenceEpoch_expectedSequence_receivedSequence_key" ON "BiometricSequenceGap"("deviceId", "sequenceEpoch", "expectedSequence", "receivedSequence");
CREATE UNIQUE INDEX "BiometricAttendancePolicy_publicKey_key" ON "BiometricAttendancePolicy"("publicKey");
CREATE INDEX "BiometricAttendancePolicy_campus_status_effectiveFrom_idx" ON "BiometricAttendancePolicy"("campus", "status", "effectiveFrom");
CREATE UNIQUE INDEX "BiometricReconciliation_publicKey_key" ON "BiometricReconciliation"("publicKey");
CREATE INDEX "BiometricReconciliation_status_attendanceDate_idx" ON "BiometricReconciliation"("status", "attendanceDate");
CREATE INDEX "BiometricReconciliation_outcome_attendanceDate_idx" ON "BiometricReconciliation"("outcome", "attendanceDate");
CREATE UNIQUE INDEX "BiometricReconciliation_staffMemberId_attendanceDate_key" ON "BiometricReconciliation"("staffMemberId", "attendanceDate");
CREATE UNIQUE INDEX "BiometricCorrection_publicKey_key" ON "BiometricCorrection"("publicKey");
CREATE INDEX "BiometricCorrection_reconciliationId_submittedAt_idx" ON "BiometricCorrection"("reconciliationId", "submittedAt");
CREATE INDEX "BiometricCorrection_status_submittedAt_idx" ON "BiometricCorrection"("status", "submittedAt");
CREATE INDEX "BiometricCorrection_requestedByUserId_submittedAt_idx" ON "BiometricCorrection"("requestedByUserId", "submittedAt");
CREATE INDEX "BiometricAuditEvent_entityType_entityId_occurredAt_idx" ON "BiometricAuditEvent"("entityType", "entityId", "occurredAt");
CREATE INDEX "BiometricAuditEvent_eventType_occurredAt_idx" ON "BiometricAuditEvent"("eventType", "occurredAt");
CREATE INDEX "BiometricAuditEvent_actorUserId_occurredAt_idx" ON "BiometricAuditEvent"("actorUserId", "occurredAt");

CREATE TRIGGER "BiometricBridge_status_insert" BEFORE INSERT ON "BiometricBridge"
WHEN NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED') OR NEW."keyAlgorithm" NOT IN ('ED25519','ECDSA_P256_SHA256')
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_BRIDGE_CONTRACT_INVALID'); END;
CREATE TRIGGER "BiometricBridge_transition" BEFORE UPDATE OF "status" ON "BiometricBridge"
WHEN NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED') OR OLD."status" IN ('REVOKED','RETIRED')
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_BRIDGE_TRANSITION_INVALID'); END;
CREATE TRIGGER "BiometricBridge_key_rotation" BEFORE UPDATE OF "publicSigningKey","publicKeyHash","keyAlgorithm","keyVersion" ON "BiometricBridge"
WHEN OLD."status" <> 'ACTIVE' OR NEW."status" <> 'ACTIVE' OR NEW."keyVersion" <> OLD."keyVersion" + 1
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_BRIDGE_KEY_ROTATION_INVALID'); END;
CREATE TRIGGER "BiometricDevice_status_insert" BEFORE INSERT ON "BiometricDevice"
WHEN NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED') OR NEW."clockDriftStatus" NOT IN ('HEALTHY','WARNING','UNTRUSTED_TIME','UNKNOWN') OR NEW."protocolProfile" NOT IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH','GENERIC_ADMS_PUSH','GENERIC_LAN_POLL','GENERIC_CSV_IMPORT','SIMULATOR')
  OR (NEW."protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH') AND NEW."protocolProofStatus" NOT IN ('NOT_PROVIDED','OFFICIAL_VERIFIED'))
  OR (NEW."protocolProfile" IN ('GENERIC_ADMS_PUSH','GENERIC_LAN_POLL') AND NEW."protocolProofStatus" NOT IN ('ADAPTER_CONTRACT_PENDING','ADAPTER_CONTRACT_APPROVED'))
  OR (NEW."protocolProfile" IN ('GENERIC_CSV_IMPORT','SIMULATOR') AND NEW."protocolProofStatus" <> 'NOT_REQUIRED')
  OR (NEW."status" = 'ACTIVE' AND NEW."protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH') AND NEW."protocolProofStatus" <> 'OFFICIAL_VERIFIED')
  OR (NEW."status" = 'ACTIVE' AND NEW."protocolProfile" IN ('GENERIC_ADMS_PUSH','GENERIC_LAN_POLL') AND NEW."protocolProofStatus" <> 'ADAPTER_CONTRACT_APPROVED')
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_DEVICE_CONTRACT_INVALID'); END;
CREATE TRIGGER "BiometricDevice_transition" BEFORE UPDATE OF "status","protocolProfile","protocolProofStatus" ON "BiometricDevice"
WHEN NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED') OR NEW."clockDriftStatus" NOT IN ('HEALTHY','WARNING','UNTRUSTED_TIME','UNKNOWN') OR OLD."status" IN ('REVOKED','RETIRED')
  OR NEW."protocolProfile" NOT IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH','GENERIC_ADMS_PUSH','GENERIC_LAN_POLL','GENERIC_CSV_IMPORT','SIMULATOR')
  OR (NEW."protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH') AND NEW."protocolProofStatus" NOT IN ('NOT_PROVIDED','OFFICIAL_VERIFIED'))
  OR (NEW."protocolProfile" IN ('GENERIC_ADMS_PUSH','GENERIC_LAN_POLL') AND NEW."protocolProofStatus" NOT IN ('ADAPTER_CONTRACT_PENDING','ADAPTER_CONTRACT_APPROVED'))
  OR (NEW."protocolProfile" IN ('GENERIC_CSV_IMPORT','SIMULATOR') AND NEW."protocolProofStatus" <> 'NOT_REQUIRED')
  OR (NEW."status" = 'ACTIVE' AND NEW."protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH') AND NEW."protocolProofStatus" <> 'OFFICIAL_VERIFIED')
  OR (NEW."status" = 'ACTIVE' AND NEW."protocolProfile" IN ('GENERIC_ADMS_PUSH','GENERIC_LAN_POLL') AND NEW."protocolProofStatus" <> 'ADAPTER_CONTRACT_APPROVED')
  OR ((NEW."protocolProfile" <> OLD."protocolProfile" OR NEW."protocolProofStatus" <> OLD."protocolProofStatus") AND (OLD."status" <> 'PENDING_APPROVAL' OR NEW."status" <> 'PENDING_APPROVAL'))
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_DEVICE_TRANSITION_INVALID'); END;
CREATE TRIGGER "BiometricMapping_no_delete" BEFORE DELETE ON "BiometricStaffMapping" BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_MAPPING_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER "BiometricRawPunch_contract" BEFORE INSERT ON "BiometricRawPunch"
WHEN NEW."verificationMethod" NOT IN ('FINGERPRINT','FACE','CARD','PIN','OTHER') OR NEW."punchCode" NOT IN ('IN','OUT','UNKNOWN') OR NEW."clockDriftStatus" NOT IN ('HEALTHY','WARNING','UNTRUSTED_TIME','UNKNOWN') OR NEW."reconciliationStatus" NOT IN ('PENDING','MAPPED_PENDING','RECONCILED','MAPPING_CONFLICT','UNMAPPED_STAFF','INACTIVE_STAFF','DEVICE_EXCEPTION','DEVICE_TIME_UNTRUSTED')
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_RAW_PUNCH_CONTRACT_INVALID'); END;
CREATE TRIGGER "BiometricRawPunch_evidence_immutable" BEFORE UPDATE ON "BiometricRawPunch"
WHEN NEW."id" <> OLD."id" OR NEW."publicKey" <> OLD."publicKey" OR NEW."eventIdentityHash" <> OLD."eventIdentityHash" OR NEW."eventPayloadHash" <> OLD."eventPayloadHash" OR NEW."batchId" <> OLD."batchId" OR NEW."bridgeId" <> OLD."bridgeId" OR NEW."deviceId" <> OLD."deviceId" OR COALESCE(NEW."mappingId",'') <> COALESCE(OLD."mappingId",'') OR COALESCE(NEW."staffMemberId",'') <> COALESCE(OLD."staffMemberId",'') OR NEW."opaqueDeviceUserId" <> OLD."opaqueDeviceUserId" OR NEW."punchTimestamp" <> OLD."punchTimestamp" OR NEW."bridgeReceivedTimestamp" <> OLD."bridgeReceivedTimestamp" OR NEW."receivedTimestamp" <> OLD."receivedTimestamp" OR NEW."verificationMethod" <> OLD."verificationMethod" OR NEW."punchCode" <> OLD."punchCode" OR COALESCE(NEW."statusCode",'') <> COALESCE(OLD."statusCode",'') OR COALESCE(NEW."sequenceNumber",-1) <> COALESCE(OLD."sequenceNumber",-1) OR NEW."sequenceEpoch" <> OLD."sequenceEpoch" OR COALESCE(NEW."eventReference",'') <> COALESCE(OLD."eventReference",'') OR NEW."protocolProfile" <> OLD."protocolProfile" OR COALESCE(NEW."clockDriftSeconds",2147483647) <> COALESCE(OLD."clockDriftSeconds",2147483647) OR NEW."clockDriftStatus" <> OLD."clockDriftStatus" OR NEW."createdAt" <> OLD."createdAt"
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_RAW_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER "BiometricRawPunch_no_delete" BEFORE DELETE ON "BiometricRawPunch" BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_RAW_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER "BiometricAuditEvent_no_update" BEFORE UPDATE ON "BiometricAuditEvent" BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER "BiometricAuditEvent_no_delete" BEFORE DELETE ON "BiometricAuditEvent" BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_AUDIT_IMMUTABLE'); END;
CREATE TRIGGER "BiometricAttendancePolicy_contract_insert" BEFORE INSERT ON "BiometricAttendancePolicy"
WHEN NEW."status" NOT IN ('DRAFT','ACTIVE','RETIRED') OR NEW."workdayBasis" <> 'PUBLISHED_CALENDAR' OR NEW."shiftType" NOT IN ('DAY','OVERNIGHT','SPLIT') OR NEW."overnightShiftEnabled" <> 0 OR NEW."splitShiftEnabled" <> 0 OR NEW."halfDayThresholdMinutes" < 1 OR NEW."fullDayThresholdMinutes" < NEW."halfDayThresholdMinutes" OR NEW."fullDayThresholdMinutes" > 1440 OR NEW."halfDayRule" NOT IN ('DURATION_THRESHOLD','CALENDAR_HALF_DAY') OR NEW."missingInBehavior" NOT IN ('EXCEPTION','ABSENT_PENDING_REVIEW') OR NEW."missingOutBehavior" NOT IN ('EXCEPTION','ABSENT_PENDING_REVIEW') OR NEW."multiplePunchStrategy" NOT IN ('FIRST_IN_LAST_OUT_FLAG','ADMIN_REVIEW') OR NEW."leaveInteraction" NOT IN ('APPROVED_LEAVE_GOVERNS','FLAG_PUNCH') OR NEW."holidayInteraction" NOT IN ('FLAG_PUNCH','IGNORE_NO_PUNCH')
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_POLICY_CONTRACT_INVALID'); END;
CREATE TRIGGER "BiometricAttendancePolicy_contract_update" BEFORE UPDATE ON "BiometricAttendancePolicy"
WHEN NEW."status" NOT IN ('DRAFT','ACTIVE','RETIRED') OR NEW."workdayBasis" <> 'PUBLISHED_CALENDAR' OR NEW."shiftType" NOT IN ('DAY','OVERNIGHT','SPLIT') OR NEW."overnightShiftEnabled" <> 0 OR NEW."splitShiftEnabled" <> 0 OR NEW."halfDayThresholdMinutes" < 1 OR NEW."fullDayThresholdMinutes" < NEW."halfDayThresholdMinutes" OR NEW."fullDayThresholdMinutes" > 1440 OR NEW."halfDayRule" NOT IN ('DURATION_THRESHOLD','CALENDAR_HALF_DAY') OR NEW."missingInBehavior" NOT IN ('EXCEPTION','ABSENT_PENDING_REVIEW') OR NEW."missingOutBehavior" NOT IN ('EXCEPTION','ABSENT_PENDING_REVIEW') OR NEW."multiplePunchStrategy" NOT IN ('FIRST_IN_LAST_OUT_FLAG','ADMIN_REVIEW') OR NEW."leaveInteraction" NOT IN ('APPROVED_LEAVE_GOVERNS','FLAG_PUNCH') OR NEW."holidayInteraction" NOT IN ('FLAG_PUNCH','IGNORE_NO_PUNCH')
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_POLICY_CONTRACT_INVALID'); END;
CREATE TRIGGER "BiometricReconciliation_contract_insert" BEFORE INSERT ON "BiometricReconciliation"
WHEN NEW."status" NOT IN ('PENDING','READY_FOR_APPROVAL','EXCEPTION','APPROVED','CORRECTED') OR NEW."outcome" NOT IN ('UNRESOLVED','PRESENT','ABSENT_PENDING_REVIEW','LATE','EARLY_DEPARTURE','LATE_AND_EARLY','HALF_DAY','ON_APPROVED_LEAVE','NON_WORKING_DAY','HOLIDAY_PUNCH','MISSING_IN','MISSING_OUT','MULTIPLE_PUNCHES','UNMAPPED_STAFF','DEVICE_TIME_UNTRUSTED','DEVICE_EXCEPTION','EXCEPTION')
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_RECONCILIATION_CONTRACT_INVALID'); END;
CREATE TRIGGER "BiometricReconciliation_contract_update" BEFORE UPDATE ON "BiometricReconciliation"
WHEN NEW."status" NOT IN ('PENDING','READY_FOR_APPROVAL','EXCEPTION','APPROVED','CORRECTED') OR NEW."outcome" NOT IN ('UNRESOLVED','PRESENT','ABSENT_PENDING_REVIEW','LATE','EARLY_DEPARTURE','LATE_AND_EARLY','HALF_DAY','ON_APPROVED_LEAVE','NON_WORKING_DAY','HOLIDAY_PUNCH','MISSING_IN','MISSING_OUT','MULTIPLE_PUNCHES','UNMAPPED_STAFF','DEVICE_TIME_UNTRUSTED','DEVICE_EXCEPTION','EXCEPTION')
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_RECONCILIATION_CONTRACT_INVALID'); END;
CREATE TRIGGER "BiometricCorrection_evidence_immutable" BEFORE UPDATE ON "BiometricCorrection"
WHEN NEW."id" <> OLD."id" OR NEW."publicKey" <> OLD."publicKey" OR NEW."reconciliationId" <> OLD."reconciliationId" OR NEW."requestedByUserId" <> OLD."requestedByUserId" OR COALESCE(NEW."preparedByUserId",'') <> COALESCE(OLD."preparedByUserId",'') OR NEW."reason" <> OLD."reason" OR NEW."originalEvidenceJson" <> OLD."originalEvidenceJson" OR NEW."beforeJson" <> OLD."beforeJson" OR NEW."afterJson" <> OLD."afterJson" OR NEW."submittedAt" <> OLD."submittedAt" OR NEW."createdAt" <> OLD."createdAt"
BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_CORRECTION_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER "BiometricCorrection_no_delete" BEFORE DELETE ON "BiometricCorrection" BEGIN SELECT RAISE(ABORT, 'BIOMETRIC_CORRECTION_IMMUTABLE'); END;
