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

-- SQLite trigger parity: OcrCandidate_source_evidence_immutable
CREATE FUNCTION "nalanda_trigger_c075ee6fd7e9ad89e16b"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."documentId" <> OLD."documentId" OR COALESCE(NEW."pageId",'') <> COALESCE(OLD."pageId",'') OR NEW."fieldKey" <> OLD."fieldKey" OR NEW."candidateText" <> OLD."candidateText" OR NEW."candidateSha256" <> OLD."candidateSha256" OR COALESCE(NEW."sourceRegionJson",'') <> COALESCE(OLD."sourceRegionJson",'') OR COALESCE(NEW."recognitionScore",-1.0) <> COALESCE(OLD."recognitionScore",-1.0) OR NEW."scriptHint" <> OLD."scriptHint" OR NEW."validationState" <> OLD."validationState" OR NEW."reviewState" <> OLD."reviewState" OR NEW."critical" <> OLD."critical" OR NEW."retryPreprocessing" <> OLD."retryPreprocessing" OR NEW."createdAt" <> OLD."createdAt") THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OCR_CANDIDATE_SOURCE_EVIDENCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OcrCandidate_source_evidence_immutable"
BEFORE UPDATE ON "OcrFieldCandidate"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_c075ee6fd7e9ad89e16b"();

-- SQLite trigger parity: OcrDocument_source_immutable
CREATE FUNCTION "nalanda_trigger_d69e2ef82c7207c40558"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."sourceObjectKey" <> OLD."sourceObjectKey" OR NEW."sourceMediaType" <> OLD."sourceMediaType" OR NEW."sourceExtension" <> OLD."sourceExtension" OR NEW."byteSize" <> OLD."byteSize" OR NEW."sourceSha256" <> OLD."sourceSha256" OR NEW."contextType" <> OLD."contextType" OR NEW."contextId" <> OLD."contextId") THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OCR_DOCUMENT_SOURCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OcrDocument_source_immutable"
BEFORE UPDATE ON "OcrDocument"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_d69e2ef82c7207c40558"();

-- SQLite trigger parity: OcrPage_source_evidence_immutable
CREATE FUNCTION "nalanda_trigger_5b0c7dd28d32a39b6a48"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF (NEW."documentId" <> OLD."documentId" OR NEW."pageNumber" <> OLD."pageNumber" OR NEW."rasterObjectKey" <> OLD."rasterObjectKey" OR NEW."rasterSha256" <> OLD."rasterSha256" OR NEW."sourceDigest" <> OLD."sourceDigest" OR NEW."sourceWidth" <> OLD."sourceWidth" OR NEW."sourceHeight" <> OLD."sourceHeight" OR NEW."sourceRotation" <> OLD."sourceRotation" OR NEW."pixelCount" <> OLD."pixelCount") THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OCR_PAGE_SOURCE_EVIDENCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OcrPage_source_evidence_immutable"
BEFORE UPDATE ON "OcrPage"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_5b0c7dd28d32a39b6a48"();

-- SQLite trigger parity: OcrWorkflowEvent_no_delete
CREATE FUNCTION "nalanda_trigger_7f12316dedbcf6cced7a"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OCR_WORKFLOW_EVENT_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$nalanda_trigger$;

CREATE TRIGGER "OcrWorkflowEvent_no_delete"
BEFORE DELETE ON "OcrWorkflowEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_7f12316dedbcf6cced7a"();

-- SQLite trigger parity: OcrWorkflowEvent_no_update
CREATE FUNCTION "nalanda_trigger_4ee935a4740433cf8e3d"() RETURNS trigger
LANGUAGE plpgsql
AS $nalanda_trigger$
BEGIN
  IF TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OCR_WORKFLOW_EVENT_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$nalanda_trigger$;

CREATE TRIGGER "OcrWorkflowEvent_no_update"
BEFORE UPDATE ON "OcrWorkflowEvent"
FOR EACH ROW
EXECUTE FUNCTION "nalanda_trigger_4ee935a4740433cf8e3d"();

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
