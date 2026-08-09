-- STUDENT-EXIT-1A completion: temporary-return governance, explicit attendance
-- reconciliation evidence, leadership-approved standing authority and append-only
-- release metadata corrections. No operational Student rows are created.

ALTER TABLE "StudentDepartureRequest" ADD COLUMN "departureType" TEXT NOT NULL DEFAULT 'EARLY_DEPARTURE';
ALTER TABLE "StudentDepartureRequest" ADD COLUMN "attendancePolicySnapshotJson" TEXT NOT NULL DEFAULT '{"policy":"GOVERNED_ATTENDANCE_CORRECTION_REQUIRED","version":"SAFE_EXIT_1A"}';
ALTER TABLE "StudentDepartureRequest" ADD COLUMN "attendanceReconciliationRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StudentDepartureRequest" ADD COLUMN "attendanceReconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "StudentDepartureRequest" ADD COLUMN "temporaryReturnRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StudentDepartureRequest" ADD COLUMN "expectedReturnAt" DATETIME;
ALTER TABLE "StudentDepartureRequest" ADD COLUMN "returnNotificationRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "StudentDepartureRequest" ADD COLUMN "overdueEscalatedAt" DATETIME;

ALTER TABLE "StudentStandingDepartureAuthorization" ADD COLUMN "departurePattern" TEXT NOT NULL DEFAULT 'POLICY_DEFINED_SELF_DEPARTURE';
ALTER TABLE "StudentStandingDepartureAuthorization" ADD COLUMN "emergencyContactMasked" TEXT NOT NULL DEFAULT 'masked';
ALTER TABLE "StudentStandingDepartureAuthorization" ADD COLUMN "approvedByUserId" TEXT;
ALTER TABLE "StudentStandingDepartureAuthorization" ADD COLUMN "approvedByRole" TEXT;
ALTER TABLE "StudentStandingDepartureAuthorization" ADD COLUMN "approvedAt" DATETIME;

CREATE TABLE "StudentDepartureCorrectionEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentDepartureCorrectionEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StudentDepartureRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StudentDepartureCorrectionEvent_publicKey_key" ON "StudentDepartureCorrectionEvent"("publicKey");
CREATE UNIQUE INDEX "StudentDepartureCorrectionEvent_idempotencyKey_key" ON "StudentDepartureCorrectionEvent"("idempotencyKey");
CREATE INDEX "StudentDepartureCorrectionEvent_requestId_occurredAt_idx" ON "StudentDepartureCorrectionEvent"("requestId", "occurredAt");
CREATE INDEX "StudentDepartureCorrectionEvent_correctedFieldCode_occurredAt_idx" ON "StudentDepartureCorrectionEvent"("correctedFieldCode", "occurredAt");
CREATE INDEX "StudentDepartureRequest_temporaryReturnRequired_status_expectedReturnAt_idx" ON "StudentDepartureRequest"("temporaryReturnRequired", "status", "expectedReturnAt");

CREATE TRIGGER "safe_exit_correction_no_update"
BEFORE UPDATE ON "StudentDepartureCorrectionEvent"
BEGIN SELECT RAISE(ABORT, 'Student departure correction evidence is append-only'); END;
CREATE TRIGGER "safe_exit_correction_no_delete"
BEFORE DELETE ON "StudentDepartureCorrectionEvent"
BEGIN SELECT RAISE(ABORT, 'Student departure correction evidence cannot be deleted'); END;

DROP TRIGGER IF EXISTS "safe_exit_request_status_insert";
DROP TRIGGER IF EXISTS "safe_exit_request_status_update";
CREATE TRIGGER "safe_exit_request_status_insert"
BEFORE INSERT ON "StudentDepartureRequest"
WHEN NEW."status" NOT IN ('REQUESTED','CONSENT_PENDING','CONSENT_VERIFIED','CONSENT_DENIED','PARENT_UNREACHABLE','UNDER_SCHOOL_REVIEW','APPROVED','READY_FOR_HANDOVER','CHECKED_OUT','RETURN_EXPECTED','RETURNED_TO_CAMPUS','CANCELLED','EXPIRED','EMERGENCY_OVERRIDE','UNAUTHORISED_EXIT_SUSPECTED','UNAUTHORISED_EXIT_CONFIRMED','CLOSED')
BEGIN SELECT RAISE(ABORT, 'Invalid Student departure lifecycle status'); END;
CREATE TRIGGER "safe_exit_request_status_update"
BEFORE UPDATE OF "status" ON "StudentDepartureRequest"
WHEN NEW."status" NOT IN ('REQUESTED','CONSENT_PENDING','CONSENT_VERIFIED','CONSENT_DENIED','PARENT_UNREACHABLE','UNDER_SCHOOL_REVIEW','APPROVED','READY_FOR_HANDOVER','CHECKED_OUT','RETURN_EXPECTED','RETURNED_TO_CAMPUS','CANCELLED','EXPIRED','EMERGENCY_OVERRIDE','UNAUTHORISED_EXIT_SUSPECTED','UNAUTHORISED_EXIT_CONFIRMED','CLOSED')
BEGIN SELECT RAISE(ABORT, 'Invalid Student departure lifecycle status'); END;

CREATE TRIGGER "safe_exit_temporary_return_insert"
BEFORE INSERT ON "StudentDepartureRequest"
WHEN (NEW."temporaryReturnRequired" = 1 AND (NEW."expectedReturnAt" IS NULL OR NEW."expectedReturnAt" <= NEW."intendedDepartureAt"))
  OR (NEW."temporaryReturnRequired" = 0 AND NEW."expectedReturnAt" IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Temporary exit return time is missing or inconsistent'); END;
CREATE TRIGGER "safe_exit_temporary_return_update"
BEFORE UPDATE OF "temporaryReturnRequired", "expectedReturnAt" ON "StudentDepartureRequest"
WHEN (NEW."temporaryReturnRequired" = 1 AND (NEW."expectedReturnAt" IS NULL OR NEW."expectedReturnAt" <= NEW."intendedDepartureAt"))
  OR (NEW."temporaryReturnRequired" = 0 AND NEW."expectedReturnAt" IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Temporary exit return time is missing or inconsistent'); END;
