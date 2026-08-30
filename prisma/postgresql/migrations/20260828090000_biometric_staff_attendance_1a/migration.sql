-- PostgreSQL parity for BIOMETRIC-STAFF-ATTENDANCE-1A.
CREATE TABLE "BiometricBridge" (
  "id" TEXT PRIMARY KEY, "publicBridgeId" TEXT NOT NULL, "label" TEXT NOT NULL,
  "publicSigningKey" TEXT NOT NULL, "publicKeyHash" TEXT NOT NULL,
  "keyAlgorithm" TEXT NOT NULL DEFAULT 'ED25519', "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', "approvedByUserId" TEXT, "approvedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT, "revokedAt" TIMESTAMP(3), "revocationReason" TEXT,
  "lastSyncAt" TIMESTAMP(3), "lastEventAt" TIMESTAMP(3), "lastHealthAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BiometricBridge_status_check" CHECK ("status" IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED')),
  CONSTRAINT "BiometricBridge_algorithm_check" CHECK ("keyAlgorithm" IN ('ED25519','ECDSA_P256_SHA256'))
);
CREATE UNIQUE INDEX "BiometricBridge_publicBridgeId_key" ON "BiometricBridge"("publicBridgeId");
CREATE INDEX "BiometricBridge_status_createdAt_idx" ON "BiometricBridge"("status","createdAt");
CREATE INDEX "BiometricBridge_lastSyncAt_idx" ON "BiometricBridge"("lastSyncAt");

CREATE TABLE "BiometricDevice" (
  "id" TEXT PRIMARY KEY, "publicDeviceId" TEXT NOT NULL, "bridgeId" TEXT NOT NULL,
  "vendor" TEXT NOT NULL, "model" TEXT NOT NULL, "firmware" TEXT, "serialReferenceMasked" TEXT,
  "campus" TEXT NOT NULL, "location" TEXT NOT NULL, "protocolProfile" TEXT NOT NULL,
  "protocolProofStatus" TEXT NOT NULL DEFAULT 'NOT_PROVIDED', "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN', "clockDriftSeconds" INTEGER, "clockDriftStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "sequenceEpoch" INTEGER NOT NULL DEFAULT 1, "lastSequence" INTEGER, "lastEventAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3), "lastHealthAt" TIMESTAMP(3), "approvedByUserId" TEXT, "approvedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT, "revokedAt" TIMESTAMP(3), "revocationReason" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BiometricDevice_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "BiometricBridge"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricDevice_status_check" CHECK ("status" IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED')),
  CONSTRAINT "BiometricDevice_clock_status_check" CHECK ("clockDriftStatus" IN ('HEALTHY','WARNING','UNTRUSTED_TIME','UNKNOWN')),
  CONSTRAINT "BiometricDevice_profile_check" CHECK ("protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH','GENERIC_ADMS_PUSH','GENERIC_LAN_POLL','GENERIC_CSV_IMPORT','SIMULATOR')),
  CONSTRAINT "BiometricDevice_protocol_proof_check" CHECK (("protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH') AND "protocolProofStatus" IN ('NOT_PROVIDED','OFFICIAL_VERIFIED')) OR ("protocolProfile" IN ('GENERIC_ADMS_PUSH','GENERIC_LAN_POLL') AND "protocolProofStatus" IN ('ADAPTER_CONTRACT_PENDING','ADAPTER_CONTRACT_APPROVED')) OR ("protocolProfile" IN ('GENERIC_CSV_IMPORT','SIMULATOR') AND "protocolProofStatus" = 'NOT_REQUIRED')),
  CONSTRAINT "BiometricDevice_vendor_activation_check" CHECK ("status" <> 'ACTIVE' OR "protocolProfile" IN ('GENERIC_CSV_IMPORT','SIMULATOR') OR ("protocolProfile" IN ('GENERIC_ADMS_PUSH','GENERIC_LAN_POLL') AND "protocolProofStatus" = 'ADAPTER_CONTRACT_APPROVED') OR ("protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH') AND "protocolProofStatus" = 'OFFICIAL_VERIFIED'))
);
CREATE UNIQUE INDEX "BiometricDevice_publicDeviceId_key" ON "BiometricDevice"("publicDeviceId");
CREATE INDEX "BiometricDevice_bridgeId_status_idx" ON "BiometricDevice"("bridgeId","status");
CREATE INDEX "BiometricDevice_campus_location_idx" ON "BiometricDevice"("campus","location");
CREATE INDEX "BiometricDevice_protocolProfile_status_idx" ON "BiometricDevice"("protocolProfile","status");
CREATE INDEX "BiometricDevice_lastEventAt_idx" ON "BiometricDevice"("lastEventAt");

CREATE TABLE "BiometricStaffMapping" (
  "id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "opaqueDeviceUserId" TEXT NOT NULL,
  "staffMemberId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3), "preparedByUserId" TEXT NOT NULL,
  "preparationReason" TEXT NOT NULL, "approvedByUserId" TEXT, "approvedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT, "revokedAt" TIMESTAMP(3), "revocationReason" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BiometricStaffMapping_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricStaffMapping_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricStaffMapping_status_check" CHECK ("status" IN ('PENDING_APPROVAL','ACTIVE','REVOKED')),
  CONSTRAINT "BiometricStaffMapping_dates_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom")
);
CREATE UNIQUE INDEX "BiometricStaffMapping_publicKey_key" ON "BiometricStaffMapping"("publicKey");
CREATE UNIQUE INDEX "BiometricStaffMapping_deviceId_opaqueDeviceUserId_effectiveFrom_key" ON "BiometricStaffMapping"("deviceId","opaqueDeviceUserId","effectiveFrom");
CREATE UNIQUE INDEX "BiometricStaffMapping_one_open_active" ON "BiometricStaffMapping"("deviceId","opaqueDeviceUserId") WHERE "status"='ACTIVE' AND "effectiveTo" IS NULL;
CREATE INDEX "BiometricStaffMapping_deviceId_opaqueDeviceUserId_status_idx" ON "BiometricStaffMapping"("deviceId","opaqueDeviceUserId","status");
CREATE INDEX "BiometricStaffMapping_staffMemberId_status_effectiveFrom_idx" ON "BiometricStaffMapping"("staffMemberId","status","effectiveFrom");
CREATE INDEX "BiometricStaffMapping_approvedByUserId_approvedAt_idx" ON "BiometricStaffMapping"("approvedByUserId","approvedAt");

CREATE TABLE "BiometricIngestBatch" (
  "id" TEXT PRIMARY KEY, "batchReference" TEXT NOT NULL, "bridgeId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL, "nonceHash" TEXT NOT NULL, "keyVersion" INTEGER NOT NULL,
  "eventCount" INTEGER NOT NULL, "sequenceStart" INTEGER, "sequenceEnd" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED', "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiometricIngestBatch_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "BiometricBridge"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricIngestBatch_count_check" CHECK ("eventCount" BETWEEN 1 AND 100),
  CONSTRAINT "BiometricIngestBatch_status_check" CHECK ("status" IN ('RECEIVED','COMPLETED','REJECTED'))
);
CREATE UNIQUE INDEX "BiometricIngestBatch_bridgeId_batchReference_key" ON "BiometricIngestBatch"("bridgeId","batchReference");
CREATE UNIQUE INDEX "BiometricIngestBatch_bridgeId_nonceHash_key" ON "BiometricIngestBatch"("bridgeId","nonceHash");
CREATE INDEX "BiometricIngestBatch_bridgeId_receivedAt_idx" ON "BiometricIngestBatch"("bridgeId","receivedAt");
CREATE INDEX "BiometricIngestBatch_status_receivedAt_idx" ON "BiometricIngestBatch"("status","receivedAt");

CREATE TABLE "BiometricReplayNonce" (
  "id" TEXT PRIMARY KEY, "bridgeId" TEXT NOT NULL, "nonceHash" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BiometricReplayNonce_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "BiometricBridge"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BiometricReplayNonce_bridgeId_nonceHash_key" ON "BiometricReplayNonce"("bridgeId","nonceHash");
CREATE INDEX "BiometricReplayNonce_expiresAt_idx" ON "BiometricReplayNonce"("expiresAt");

CREATE TABLE "BiometricRawPunch" (
  "id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "eventIdentityHash" TEXT NOT NULL, "eventPayloadHash" TEXT NOT NULL,
  "batchId" TEXT NOT NULL, "bridgeId" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "mappingId" TEXT, "staffMemberId" TEXT,
  "opaqueDeviceUserId" TEXT NOT NULL, "punchTimestamp" TIMESTAMP(3) NOT NULL, "bridgeReceivedTimestamp" TIMESTAMP(3) NOT NULL,
  "receivedTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "verificationMethod" TEXT NOT NULL,
  "punchCode" TEXT NOT NULL, "statusCode" TEXT, "sequenceNumber" INTEGER, "sequenceEpoch" INTEGER NOT NULL DEFAULT 1,
  "eventReference" TEXT, "protocolProfile" TEXT NOT NULL, "clockDriftSeconds" INTEGER, "clockDriftStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiometricRawPunch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BiometricIngestBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricRawPunch_bridgeId_fkey" FOREIGN KEY ("bridgeId") REFERENCES "BiometricBridge"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricRawPunch_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricRawPunch_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "BiometricStaffMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BiometricRawPunch_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BiometricRawPunch_method_check" CHECK ("verificationMethod" IN ('FINGERPRINT','FACE','CARD','PIN','OTHER')),
  CONSTRAINT "BiometricRawPunch_code_check" CHECK ("punchCode" IN ('IN','OUT','UNKNOWN')),
  CONSTRAINT "BiometricRawPunch_clock_status_check" CHECK ("clockDriftStatus" IN ('HEALTHY','WARNING','UNTRUSTED_TIME','UNKNOWN')),
  CONSTRAINT "BiometricRawPunch_reconciliation_status_check" CHECK ("reconciliationStatus" IN ('PENDING','MAPPED_PENDING','RECONCILED','MAPPING_CONFLICT','UNMAPPED_STAFF','INACTIVE_STAFF','DEVICE_EXCEPTION','DEVICE_TIME_UNTRUSTED'))
);
CREATE UNIQUE INDEX "BiometricRawPunch_publicKey_key" ON "BiometricRawPunch"("publicKey");
CREATE UNIQUE INDEX "BiometricRawPunch_eventIdentityHash_key" ON "BiometricRawPunch"("eventIdentityHash");
CREATE INDEX "BiometricRawPunch_deviceId_punchTimestamp_idx" ON "BiometricRawPunch"("deviceId","punchTimestamp");
CREATE INDEX "BiometricRawPunch_staffMemberId_punchTimestamp_idx" ON "BiometricRawPunch"("staffMemberId","punchTimestamp");
CREATE INDEX "BiometricRawPunch_opaqueDeviceUserId_punchTimestamp_idx" ON "BiometricRawPunch"("opaqueDeviceUserId","punchTimestamp");
CREATE INDEX "BiometricRawPunch_reconciliationStatus_receivedTimestamp_idx" ON "BiometricRawPunch"("reconciliationStatus","receivedTimestamp");
CREATE INDEX "BiometricRawPunch_deviceId_sequenceEpoch_sequenceNumber_idx" ON "BiometricRawPunch"("deviceId","sequenceEpoch","sequenceNumber");

CREATE TABLE "BiometricSequenceGap" (
  "id" TEXT PRIMARY KEY, "deviceId" TEXT NOT NULL, "batchId" TEXT NOT NULL, "sequenceEpoch" INTEGER NOT NULL,
  "expectedSequence" INTEGER NOT NULL, "receivedSequence" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "acknowledgedByUserId" TEXT,
  "acknowledgedAt" TIMESTAMP(3), "acknowledgementNote" TEXT,
  CONSTRAINT "BiometricSequenceGap_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricSequenceGap_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BiometricIngestBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricSequenceGap_status_check" CHECK ("status" IN ('OPEN','ACKNOWLEDGED'))
);
CREATE UNIQUE INDEX "BiometricSequenceGap_deviceId_sequenceEpoch_expectedSequence_receivedSequence_key" ON "BiometricSequenceGap"("deviceId","sequenceEpoch","expectedSequence","receivedSequence");
CREATE INDEX "BiometricSequenceGap_deviceId_status_detectedAt_idx" ON "BiometricSequenceGap"("deviceId","status","detectedAt");

CREATE TABLE "BiometricAttendancePolicy" (
  "id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "name" TEXT NOT NULL, "campus" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveTo" TIMESTAMP(3), "shiftStartTime" TEXT NOT NULL,
  "shiftEndTime" TEXT NOT NULL, "workdayBasis" TEXT NOT NULL DEFAULT 'PUBLISHED_CALENDAR', "shiftType" TEXT NOT NULL DEFAULT 'DAY', "graceMinutes" INTEGER NOT NULL DEFAULT 0,
  "lateThresholdMinutes" INTEGER NOT NULL DEFAULT 0, "earlyDepartureGraceMinutes" INTEGER NOT NULL DEFAULT 0, "earlyDepartureThresholdMinutes" INTEGER NOT NULL DEFAULT 0,
  "fullDayThresholdMinutes" INTEGER NOT NULL DEFAULT 480, "halfDayThresholdMinutes" INTEGER NOT NULL DEFAULT 240,
  "halfDayRule" TEXT NOT NULL DEFAULT 'DURATION_THRESHOLD', "missingInBehavior" TEXT NOT NULL DEFAULT 'EXCEPTION', "missingOutBehavior" TEXT NOT NULL DEFAULT 'EXCEPTION',
  "multiplePunchStrategy" TEXT NOT NULL DEFAULT 'FIRST_IN_LAST_OUT_FLAG', "leaveInteraction" TEXT NOT NULL DEFAULT 'APPROVED_LEAVE_GOVERNS', "holidayInteraction" TEXT NOT NULL DEFAULT 'FLAG_PUNCH',
  "overnightShiftEnabled" BOOLEAN NOT NULL DEFAULT FALSE, "splitShiftEnabled" BOOLEAN NOT NULL DEFAULT FALSE, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "preparedByUserId" TEXT NOT NULL, "approvedByUserId" TEXT, "approvedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BiometricAttendancePolicy_status_check" CHECK ("status" IN ('DRAFT','ACTIVE','RETIRED')),
  CONSTRAINT "BiometricAttendancePolicy_shift_check" CHECK ("shiftType" IN ('DAY','OVERNIGHT','SPLIT') AND NOT "overnightShiftEnabled" AND NOT "splitShiftEnabled"),
  CONSTRAINT "BiometricAttendancePolicy_duration_check" CHECK ("halfDayThresholdMinutes" BETWEEN 1 AND 1440 AND "fullDayThresholdMinutes" BETWEEN "halfDayThresholdMinutes" AND 1440),
  CONSTRAINT "BiometricAttendancePolicy_behavior_check" CHECK ("workdayBasis"='PUBLISHED_CALENDAR' AND "halfDayRule" IN ('DURATION_THRESHOLD','CALENDAR_HALF_DAY') AND "missingInBehavior" IN ('EXCEPTION','ABSENT_PENDING_REVIEW') AND "missingOutBehavior" IN ('EXCEPTION','ABSENT_PENDING_REVIEW') AND "multiplePunchStrategy" IN ('FIRST_IN_LAST_OUT_FLAG','ADMIN_REVIEW') AND "leaveInteraction" IN ('APPROVED_LEAVE_GOVERNS','FLAG_PUNCH') AND "holidayInteraction" IN ('FLAG_PUNCH','IGNORE_NO_PUNCH'))
);
CREATE UNIQUE INDEX "BiometricAttendancePolicy_publicKey_key" ON "BiometricAttendancePolicy"("publicKey");
CREATE INDEX "BiometricAttendancePolicy_campus_status_effectiveFrom_idx" ON "BiometricAttendancePolicy"("campus","status","effectiveFrom");

CREATE TABLE "BiometricReconciliation" (
  "id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "staffMemberId" TEXT NOT NULL, "attendanceDate" TIMESTAMP(3) NOT NULL,
  "policyId" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "outcome" TEXT NOT NULL DEFAULT 'UNRESOLVED',
  "firstPunchId" TEXT, "lastPunchId" TEXT, "punchCount" INTEGER NOT NULL DEFAULT 0, "checkInTime" TEXT,
  "checkOutTime" TEXT, "lateMinutes" INTEGER, "earlyDepartureMinutes" INTEGER, "exceptionCode" TEXT,
  "leaveRequestId" TEXT, "calendarDayId" TEXT, "attendanceRecordId" TEXT, "preparedByUserId" TEXT,
  "preparedAt" TIMESTAMP(3), "approvedByUserId" TEXT, "approvedAt" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BiometricReconciliation_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricReconciliation_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "BiometricAttendancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "BiometricReconciliation_status_check" CHECK ("status" IN ('PENDING','READY_FOR_APPROVAL','EXCEPTION','APPROVED','CORRECTED')),
  CONSTRAINT "BiometricReconciliation_outcome_check" CHECK ("outcome" IN ('UNRESOLVED','PRESENT','ABSENT_PENDING_REVIEW','LATE','EARLY_DEPARTURE','LATE_AND_EARLY','HALF_DAY','ON_APPROVED_LEAVE','NON_WORKING_DAY','HOLIDAY_PUNCH','MISSING_IN','MISSING_OUT','MULTIPLE_PUNCHES','UNMAPPED_STAFF','DEVICE_TIME_UNTRUSTED','DEVICE_EXCEPTION','EXCEPTION'))
);
CREATE UNIQUE INDEX "BiometricReconciliation_publicKey_key" ON "BiometricReconciliation"("publicKey");
CREATE UNIQUE INDEX "BiometricReconciliation_staffMemberId_attendanceDate_key" ON "BiometricReconciliation"("staffMemberId","attendanceDate");
CREATE INDEX "BiometricReconciliation_status_attendanceDate_idx" ON "BiometricReconciliation"("status","attendanceDate");
CREATE INDEX "BiometricReconciliation_outcome_attendanceDate_idx" ON "BiometricReconciliation"("outcome","attendanceDate");

CREATE TABLE "BiometricCorrection" (
  "id" TEXT PRIMARY KEY, "publicKey" TEXT NOT NULL, "reconciliationId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL, "preparedByUserId" TEXT, "approvedByUserId" TEXT,
  "reason" TEXT NOT NULL, "originalEvidenceJson" TEXT NOT NULL, "beforeJson" TEXT NOT NULL, "afterJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED', "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3), "rejectedAt" TIMESTAMP(3), "rejectionReason" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BiometricCorrection_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BiometricReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BiometricCorrection_status_check" CHECK ("status" IN ('SUBMITTED','APPROVED','REJECTED'))
);
CREATE UNIQUE INDEX "BiometricCorrection_publicKey_key" ON "BiometricCorrection"("publicKey");
CREATE INDEX "BiometricCorrection_reconciliationId_submittedAt_idx" ON "BiometricCorrection"("reconciliationId","submittedAt");
CREATE INDEX "BiometricCorrection_status_submittedAt_idx" ON "BiometricCorrection"("status","submittedAt");
CREATE INDEX "BiometricCorrection_requestedByUserId_submittedAt_idx" ON "BiometricCorrection"("requestedByUserId","submittedAt");

CREATE TABLE "BiometricAuditEvent" (
  "id" TEXT PRIMARY KEY, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "actorUserId" TEXT, "safeMetadataJson" TEXT, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "BiometricAuditEvent_entityType_entityId_occurredAt_idx" ON "BiometricAuditEvent"("entityType","entityId","occurredAt");
CREATE INDEX "BiometricAuditEvent_eventType_occurredAt_idx" ON "BiometricAuditEvent"("eventType","occurredAt");
CREATE INDEX "BiometricAuditEvent_actorUserId_occurredAt_idx" ON "BiometricAuditEvent"("actorUserId","occurredAt");

-- SQLite trigger parity: BiometricAttendancePolicy_contract_insert
CREATE FUNCTION "nalanda_trigger_8801361d1098f7165727"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('DRAFT','ACTIVE','RETIRED') OR NEW."workdayBasis" <> 'PUBLISHED_CALENDAR' OR NEW."shiftType" NOT IN ('DAY','OVERNIGHT','SPLIT') OR NEW."overnightShiftEnabled" <> FALSE OR NEW."splitShiftEnabled" <> FALSE OR NEW."halfDayThresholdMinutes" < 1 OR NEW."fullDayThresholdMinutes" < NEW."halfDayThresholdMinutes" OR NEW."fullDayThresholdMinutes" > 1440 OR NEW."halfDayRule" NOT IN ('DURATION_THRESHOLD','CALENDAR_HALF_DAY') OR NEW."missingInBehavior" NOT IN ('EXCEPTION','ABSENT_PENDING_REVIEW') OR NEW."missingOutBehavior" NOT IN ('EXCEPTION','ABSENT_PENDING_REVIEW') OR NEW."multiplePunchStrategy" NOT IN ('FIRST_IN_LAST_OUT_FLAG','ADMIN_REVIEW') OR NEW."leaveInteraction" NOT IN ('APPROVED_LEAVE_GOVERNS','FLAG_PUNCH') OR NEW."holidayInteraction" NOT IN ('FLAG_PUNCH','IGNORE_NO_PUNCH')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_POLICY_CONTRACT_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricAttendancePolicy_contract_insert"
BEFORE INSERT ON "BiometricAttendancePolicy"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_8801361d1098f7165727"();

-- SQLite trigger parity: BiometricAttendancePolicy_contract_update
CREATE FUNCTION "nalanda_trigger_8efeb3a449c693a94188"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('DRAFT','ACTIVE','RETIRED') OR NEW."workdayBasis" <> 'PUBLISHED_CALENDAR' OR NEW."shiftType" NOT IN ('DAY','OVERNIGHT','SPLIT') OR NEW."overnightShiftEnabled" <> FALSE OR NEW."splitShiftEnabled" <> FALSE OR NEW."halfDayThresholdMinutes" < 1 OR NEW."fullDayThresholdMinutes" < NEW."halfDayThresholdMinutes" OR NEW."fullDayThresholdMinutes" > 1440 OR NEW."halfDayRule" NOT IN ('DURATION_THRESHOLD','CALENDAR_HALF_DAY') OR NEW."missingInBehavior" NOT IN ('EXCEPTION','ABSENT_PENDING_REVIEW') OR NEW."missingOutBehavior" NOT IN ('EXCEPTION','ABSENT_PENDING_REVIEW') OR NEW."multiplePunchStrategy" NOT IN ('FIRST_IN_LAST_OUT_FLAG','ADMIN_REVIEW') OR NEW."leaveInteraction" NOT IN ('APPROVED_LEAVE_GOVERNS','FLAG_PUNCH') OR NEW."holidayInteraction" NOT IN ('FLAG_PUNCH','IGNORE_NO_PUNCH')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_POLICY_CONTRACT_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricAttendancePolicy_contract_update"
BEFORE UPDATE ON "BiometricAttendancePolicy"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_8efeb3a449c693a94188"();

-- SQLite trigger parity: BiometricAuditEvent_no_delete
CREATE FUNCTION "nalanda_trigger_fad5633a3f5843e56c45"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_AUDIT_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricAuditEvent_no_delete"
BEFORE DELETE ON "BiometricAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_fad5633a3f5843e56c45"();

-- SQLite trigger parity: BiometricAuditEvent_no_update
CREATE FUNCTION "nalanda_trigger_c3cb629ed4e179fad71e"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_AUDIT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricAuditEvent_no_update"
BEFORE UPDATE ON "BiometricAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_c3cb629ed4e179fad71e"();

-- SQLite trigger parity: BiometricBridge_key_rotation
CREATE FUNCTION "nalanda_trigger_beb356337f910cd06eaf"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (OLD."status" <> 'ACTIVE' OR NEW."status" <> 'ACTIVE' OR NEW."keyVersion" <> OLD."keyVersion" + 1) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_BRIDGE_KEY_ROTATION_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricBridge_key_rotation"
BEFORE UPDATE OF "publicSigningKey","publicKeyHash","keyAlgorithm","keyVersion" ON "BiometricBridge"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_beb356337f910cd06eaf"();

-- SQLite trigger parity: BiometricBridge_status_insert
CREATE FUNCTION "nalanda_trigger_69d04bb8346021f24062"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED') OR NEW."keyAlgorithm" NOT IN ('ED25519','ECDSA_P256_SHA256')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_BRIDGE_CONTRACT_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricBridge_status_insert"
BEFORE INSERT ON "BiometricBridge"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_69d04bb8346021f24062"();

-- SQLite trigger parity: BiometricBridge_transition
CREATE FUNCTION "nalanda_trigger_52b1f5aef9727008e3c5"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED') OR OLD."status" IN ('REVOKED','RETIRED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_BRIDGE_TRANSITION_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricBridge_transition"
BEFORE UPDATE OF "status" ON "BiometricBridge"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_52b1f5aef9727008e3c5"();

-- SQLite trigger parity: BiometricCorrection_evidence_immutable
CREATE FUNCTION "nalanda_trigger_93b6454c1bc9cb311d51"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."id" <> OLD."id" OR NEW."publicKey" <> OLD."publicKey" OR NEW."reconciliationId" <> OLD."reconciliationId" OR NEW."requestedByUserId" <> OLD."requestedByUserId" OR COALESCE(NEW."preparedByUserId",'') <> COALESCE(OLD."preparedByUserId",'') OR NEW."reason" <> OLD."reason" OR NEW."originalEvidenceJson" <> OLD."originalEvidenceJson" OR NEW."beforeJson" <> OLD."beforeJson" OR NEW."afterJson" <> OLD."afterJson" OR NEW."submittedAt" <> OLD."submittedAt" OR NEW."createdAt" <> OLD."createdAt") THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_CORRECTION_EVIDENCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricCorrection_evidence_immutable"
BEFORE UPDATE ON "BiometricCorrection"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_93b6454c1bc9cb311d51"();

-- SQLite trigger parity: BiometricCorrection_no_delete
CREATE FUNCTION "nalanda_trigger_fb3c70e28bd515493e95"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_CORRECTION_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricCorrection_no_delete"
BEFORE DELETE ON "BiometricCorrection"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_fb3c70e28bd515493e95"();

-- SQLite trigger parity: BiometricDevice_status_insert
CREATE FUNCTION "nalanda_trigger_e67d32b6b9775deb0fdf"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED') OR NEW."clockDriftStatus" NOT IN ('HEALTHY','WARNING','UNTRUSTED_TIME','UNKNOWN') OR NEW."protocolProfile" NOT IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH','GENERIC_ADMS_PUSH','GENERIC_LAN_POLL','GENERIC_CSV_IMPORT','SIMULATOR')
  OR (NEW."protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH') AND NEW."protocolProofStatus" NOT IN ('NOT_PROVIDED','OFFICIAL_VERIFIED'))
  OR (NEW."protocolProfile" IN ('GENERIC_ADMS_PUSH','GENERIC_LAN_POLL') AND NEW."protocolProofStatus" NOT IN ('ADAPTER_CONTRACT_PENDING','ADAPTER_CONTRACT_APPROVED'))
  OR (NEW."protocolProfile" IN ('GENERIC_CSV_IMPORT','SIMULATOR') AND NEW."protocolProofStatus" <> 'NOT_REQUIRED')
  OR (NEW."status" = 'ACTIVE' AND NEW."protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH') AND NEW."protocolProofStatus" <> 'OFFICIAL_VERIFIED')
  OR (NEW."status" = 'ACTIVE' AND NEW."protocolProfile" IN ('GENERIC_ADMS_PUSH','GENERIC_LAN_POLL') AND NEW."protocolProofStatus" <> 'ADAPTER_CONTRACT_APPROVED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_DEVICE_CONTRACT_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricDevice_status_insert"
BEFORE INSERT ON "BiometricDevice"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_e67d32b6b9775deb0fdf"();

-- SQLite trigger parity: BiometricDevice_transition
CREATE FUNCTION "nalanda_trigger_ad6cfbe0d1159fafd566"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('PENDING_APPROVAL','ACTIVE','REVOKED','RETIRED') OR NEW."clockDriftStatus" NOT IN ('HEALTHY','WARNING','UNTRUSTED_TIME','UNKNOWN') OR OLD."status" IN ('REVOKED','RETIRED')
  OR NEW."protocolProfile" NOT IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH','GENERIC_ADMS_PUSH','GENERIC_LAN_POLL','GENERIC_CSV_IMPORT','SIMULATOR')
  OR (NEW."protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH') AND NEW."protocolProofStatus" NOT IN ('NOT_PROVIDED','OFFICIAL_VERIFIED'))
  OR (NEW."protocolProfile" IN ('GENERIC_ADMS_PUSH','GENERIC_LAN_POLL') AND NEW."protocolProofStatus" NOT IN ('ADAPTER_CONTRACT_PENDING','ADAPTER_CONTRACT_APPROVED'))
  OR (NEW."protocolProfile" IN ('GENERIC_CSV_IMPORT','SIMULATOR') AND NEW."protocolProofStatus" <> 'NOT_REQUIRED')
  OR (NEW."status" = 'ACTIVE' AND NEW."protocolProfile" IN ('ESSL_K30_PRO_PUSH','ESSL_ZK_LAN_SDK','ZK_ADMS_PUSH') AND NEW."protocolProofStatus" <> 'OFFICIAL_VERIFIED')
  OR (NEW."status" = 'ACTIVE' AND NEW."protocolProfile" IN ('GENERIC_ADMS_PUSH','GENERIC_LAN_POLL') AND NEW."protocolProofStatus" <> 'ADAPTER_CONTRACT_APPROVED')
  OR ((NEW."protocolProfile" <> OLD."protocolProfile" OR NEW."protocolProofStatus" <> OLD."protocolProofStatus") AND (OLD."status" <> 'PENDING_APPROVAL' OR NEW."status" <> 'PENDING_APPROVAL'))) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_DEVICE_TRANSITION_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricDevice_transition"
BEFORE UPDATE OF "status","protocolProfile","protocolProofStatus" ON "BiometricDevice"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_ad6cfbe0d1159fafd566"();

-- SQLite trigger parity: BiometricMapping_no_delete
CREATE FUNCTION "nalanda_trigger_031c0d73d2b4e9ba70f5"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_MAPPING_HISTORY_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricMapping_no_delete"
BEFORE DELETE ON "BiometricStaffMapping"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_031c0d73d2b4e9ba70f5"();

-- SQLite trigger parity: BiometricRawPunch_contract
CREATE FUNCTION "nalanda_trigger_0f6379579620972af7ce"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."verificationMethod" NOT IN ('FINGERPRINT','FACE','CARD','PIN','OTHER') OR NEW."punchCode" NOT IN ('IN','OUT','UNKNOWN') OR NEW."clockDriftStatus" NOT IN ('HEALTHY','WARNING','UNTRUSTED_TIME','UNKNOWN') OR NEW."reconciliationStatus" NOT IN ('PENDING','MAPPED_PENDING','RECONCILED','MAPPING_CONFLICT','UNMAPPED_STAFF','INACTIVE_STAFF','DEVICE_EXCEPTION','DEVICE_TIME_UNTRUSTED')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_RAW_PUNCH_CONTRACT_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricRawPunch_contract"
BEFORE INSERT ON "BiometricRawPunch"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_0f6379579620972af7ce"();

-- SQLite trigger parity: BiometricRawPunch_evidence_immutable
CREATE FUNCTION "nalanda_trigger_84cba0972f419d1a8e1d"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."id" <> OLD."id" OR NEW."publicKey" <> OLD."publicKey" OR NEW."eventIdentityHash" <> OLD."eventIdentityHash" OR NEW."eventPayloadHash" <> OLD."eventPayloadHash" OR NEW."batchId" <> OLD."batchId" OR NEW."bridgeId" <> OLD."bridgeId" OR NEW."deviceId" <> OLD."deviceId" OR COALESCE(NEW."mappingId",'') <> COALESCE(OLD."mappingId",'') OR COALESCE(NEW."staffMemberId",'') <> COALESCE(OLD."staffMemberId",'') OR NEW."opaqueDeviceUserId" <> OLD."opaqueDeviceUserId" OR NEW."punchTimestamp" <> OLD."punchTimestamp" OR NEW."bridgeReceivedTimestamp" <> OLD."bridgeReceivedTimestamp" OR NEW."receivedTimestamp" <> OLD."receivedTimestamp" OR NEW."verificationMethod" <> OLD."verificationMethod" OR NEW."punchCode" <> OLD."punchCode" OR COALESCE(NEW."statusCode",'') <> COALESCE(OLD."statusCode",'') OR COALESCE(NEW."sequenceNumber",-1) <> COALESCE(OLD."sequenceNumber",-1) OR NEW."sequenceEpoch" <> OLD."sequenceEpoch" OR COALESCE(NEW."eventReference",'') <> COALESCE(OLD."eventReference",'') OR NEW."protocolProfile" <> OLD."protocolProfile" OR COALESCE(NEW."clockDriftSeconds",2147483647) <> COALESCE(OLD."clockDriftSeconds",2147483647) OR NEW."clockDriftStatus" <> OLD."clockDriftStatus" OR NEW."createdAt" <> OLD."createdAt") THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_RAW_EVIDENCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricRawPunch_evidence_immutable"
BEFORE UPDATE ON "BiometricRawPunch"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_84cba0972f419d1a8e1d"();

-- SQLite trigger parity: BiometricRawPunch_no_delete
CREATE FUNCTION "nalanda_trigger_c885eb0441bc9fdaf5eb"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_RAW_EVIDENCE_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricRawPunch_no_delete"
BEFORE DELETE ON "BiometricRawPunch"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_c885eb0441bc9fdaf5eb"();

-- SQLite trigger parity: BiometricReconciliation_contract_insert
CREATE FUNCTION "nalanda_trigger_7c34ef04ff7d7692f113"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('PENDING','READY_FOR_APPROVAL','EXCEPTION','APPROVED','CORRECTED') OR NEW."outcome" NOT IN ('UNRESOLVED','PRESENT','ABSENT_PENDING_REVIEW','LATE','EARLY_DEPARTURE','LATE_AND_EARLY','HALF_DAY','ON_APPROVED_LEAVE','NON_WORKING_DAY','HOLIDAY_PUNCH','MISSING_IN','MISSING_OUT','MULTIPLE_PUNCHES','UNMAPPED_STAFF','DEVICE_TIME_UNTRUSTED','DEVICE_EXCEPTION','EXCEPTION')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_RECONCILIATION_CONTRACT_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricReconciliation_contract_insert"
BEFORE INSERT ON "BiometricReconciliation"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7c34ef04ff7d7692f113"();

-- SQLite trigger parity: BiometricReconciliation_contract_update
CREATE FUNCTION "nalanda_trigger_c5a55c4197949b57c5c5"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."status" NOT IN ('PENDING','READY_FOR_APPROVAL','EXCEPTION','APPROVED','CORRECTED') OR NEW."outcome" NOT IN ('UNRESOLVED','PRESENT','ABSENT_PENDING_REVIEW','LATE','EARLY_DEPARTURE','LATE_AND_EARLY','HALF_DAY','ON_APPROVED_LEAVE','NON_WORKING_DAY','HOLIDAY_PUNCH','MISSING_IN','MISSING_OUT','MULTIPLE_PUNCHES','UNMAPPED_STAFF','DEVICE_TIME_UNTRUSTED','DEVICE_EXCEPTION','EXCEPTION')) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BIOMETRIC_RECONCILIATION_CONTRACT_INVALID';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "BiometricReconciliation_contract_update"
BEFORE UPDATE ON "BiometricReconciliation"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_c5a55c4197949b57c5c5"();
