-- CreateTable
CREATE TABLE "PriorYearLiability" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "operatingYear" TEXT NOT NULL,
    "sourceYear" TEXT NOT NULL,
    "sourceEnrollmentId" TEXT NOT NULL,
    "openingAmount" DECIMAL(65,30) NOT NULL,
    "existingCredits" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sourceReferencesJson" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "preparerId" TEXT NOT NULL,
    "verifierId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SOURCE_YEAR_UNVERIFIED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriorYearLiability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorYearPaymentAttribution" (
    "id" TEXT NOT NULL,
    "liabilityId" TEXT,
    "paymentId" TEXT NOT NULL,
    "sourceYear" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriorYearPaymentAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorYearConcessionCase" (
    "id" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "kind" TEXT NOT NULL,
    "requestedAmount" DECIMAL(65,30) NOT NULL,
    "approvedAmount" DECIMAL(65,30),
    "reason" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL,
    "preparerId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "approverId" TEXT,
    "applicantReference" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "balanceHash" TEXT,
    "balanceVersion" INTEGER,
    "appliedBalanceHash" TEXT,
    "appliedVersion" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriorYearConcessionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorYearIncomeSupport" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bandId" TEXT,
    "exactAmountEnvelope" TEXT,
    "expiresAt" TIMESTAMP(3),
    "recordedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriorYearIncomeSupport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorYearConcessionEvent" (
    "id" TEXT NOT NULL,
    "liabilityId" TEXT NOT NULL,
    "caseId" TEXT,
    "eventType" TEXT NOT NULL,
    "referenceId" TEXT,
    "actorId" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "balanceHash" TEXT,
    "balanceVersion" INTEGER,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "reversesEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriorYearConcessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentItemReceiptSnapshot" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "linesJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentItemReceiptSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriorYearLiability_studentId_sourceYear_key" ON "PriorYearLiability"("studentId", "sourceYear");

-- CreateIndex
CREATE UNIQUE INDEX "PriorYearPaymentAttribution_paymentId_key" ON "PriorYearPaymentAttribution"("paymentId");

-- CreateIndex
CREATE INDEX "PriorYearConcessionCase_status_createdAt_idx" ON "PriorYearConcessionCase"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PriorYearIncomeSupport_caseId_key" ON "PriorYearIncomeSupport"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "PriorYearConcessionEvent_requestKey_key" ON "PriorYearConcessionEvent"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "PriorYearConcessionEvent_reversesEventId_key" ON "PriorYearConcessionEvent"("reversesEventId");

-- CreateIndex
CREATE INDEX "PriorYearConcessionEvent_liabilityId_createdAt_idx" ON "PriorYearConcessionEvent"("liabilityId", "createdAt");

-- CreateIndex
CREATE INDEX "PriorYearConcessionEvent_caseId_createdAt_idx" ON "PriorYearConcessionEvent"("caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentItemReceiptSnapshot_receiptId_key" ON "StudentItemReceiptSnapshot"("receiptId");

-- AddForeignKey
ALTER TABLE "PriorYearLiability" ADD CONSTRAINT "PriorYearLiability_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorYearPaymentAttribution" ADD CONSTRAINT "PriorYearPaymentAttribution_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "PriorYearLiability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorYearPaymentAttribution" ADD CONSTRAINT "PriorYearPaymentAttribution_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorYearConcessionCase" ADD CONSTRAINT "PriorYearConcessionCase_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "PriorYearLiability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorYearIncomeSupport" ADD CONSTRAINT "PriorYearIncomeSupport_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PriorYearConcessionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorYearConcessionEvent" ADD CONSTRAINT "PriorYearConcessionEvent_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "PriorYearLiability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorYearConcessionEvent" ADD CONSTRAINT "PriorYearConcessionEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PriorYearConcessionCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentItemReceiptSnapshot" ADD CONSTRAINT "StudentItemReceiptSnapshot_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MiscIncomeReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prior-year immutable and concurrency controls
CREATE FUNCTION "PriorYearConcessionEvent_update_immutable_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'; END; $$;
CREATE TRIGGER "PriorYearConcessionEvent_update_immutable" BEFORE UPDATE ON "PriorYearConcessionEvent" FOR EACH ROW EXECUTE FUNCTION "PriorYearConcessionEvent_update_immutable_fn"();

CREATE FUNCTION "PriorYearConcessionEvent_delete_immutable_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'; END; $$;
CREATE TRIGGER "PriorYearConcessionEvent_delete_immutable" BEFORE DELETE ON "PriorYearConcessionEvent" FOR EACH ROW EXECUTE FUNCTION "PriorYearConcessionEvent_delete_immutable_fn"();

CREATE FUNCTION "PriorYearPaymentAttribution_update_immutable_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'; END; $$;
CREATE TRIGGER "PriorYearPaymentAttribution_update_immutable" BEFORE UPDATE ON "PriorYearPaymentAttribution" FOR EACH ROW EXECUTE FUNCTION "PriorYearPaymentAttribution_update_immutable_fn"();

CREATE FUNCTION "PriorYearPaymentAttribution_delete_immutable_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'; END; $$;
CREATE TRIGGER "PriorYearPaymentAttribution_delete_immutable" BEFORE DELETE ON "PriorYearPaymentAttribution" FOR EACH ROW EXECUTE FUNCTION "PriorYearPaymentAttribution_delete_immutable_fn"();

CREATE FUNCTION "StudentItemReceiptSnapshot_update_immutable_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'; END; $$;
CREATE TRIGGER "StudentItemReceiptSnapshot_update_immutable" BEFORE UPDATE ON "StudentItemReceiptSnapshot" FOR EACH ROW EXECUTE FUNCTION "StudentItemReceiptSnapshot_update_immutable_fn"();

CREATE FUNCTION "StudentItemReceiptSnapshot_delete_immutable_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'; END; $$;
CREATE TRIGGER "StudentItemReceiptSnapshot_delete_immutable" BEFORE DELETE ON "StudentItemReceiptSnapshot" FOR EACH ROW EXECUTE FUNCTION "StudentItemReceiptSnapshot_delete_immutable_fn"();

CREATE FUNCTION "PriorYearLiability_verified_identity_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.status = 'VERIFIED' AND ROW(NEW."studentId",NEW."sourceYear",NEW."operatingYear",NEW."openingAmount",NEW."existingCredits",NEW."sourceEnrollmentId",NEW."sourceReferencesJson",NEW.provenance,NEW."preparerId",NEW."verifierId",NEW."verifiedAt",NEW.status) IS DISTINCT FROM ROW(OLD."studentId",OLD."sourceYear",OLD."operatingYear",OLD."openingAmount",OLD."existingCredits",OLD."sourceEnrollmentId",OLD."sourceReferencesJson",OLD.provenance,OLD."preparerId",OLD."verifierId",OLD."verifiedAt",OLD.status) THEN RAISE EXCEPTION 'VERIFIED_LIABILITY_IMMUTABLE'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER "PriorYearLiability_verified_identity" BEFORE UPDATE ON "PriorYearLiability" FOR EACH ROW EXECUTE FUNCTION "PriorYearLiability_verified_identity_fn"();

CREATE FUNCTION "Payment_prior_year_version_insert_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE "PriorYearLiability" SET version = version + 1 WHERE "studentId" = NEW."studentId"; RETURN NEW; END; $$;
CREATE TRIGGER "Payment_prior_year_version_insert" AFTER INSERT ON "Payment" FOR EACH ROW EXECUTE FUNCTION "Payment_prior_year_version_insert_fn"();

CREATE FUNCTION "Payment_prior_year_version_update_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE "PriorYearLiability" SET version = version + 1 WHERE "studentId" = OLD."studentId" OR "studentId" = NEW."studentId"; RETURN NEW; END; $$;
CREATE TRIGGER "Payment_prior_year_version_update" AFTER UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION "Payment_prior_year_version_update_fn"();

CREATE FUNCTION "Payment_prior_year_version_delete_fn"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE "PriorYearLiability" SET version = version + 1 WHERE "studentId" = OLD."studentId"; RETURN OLD; END; $$;
CREATE TRIGGER "Payment_prior_year_version_delete" AFTER DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION "Payment_prior_year_version_delete_fn"();
