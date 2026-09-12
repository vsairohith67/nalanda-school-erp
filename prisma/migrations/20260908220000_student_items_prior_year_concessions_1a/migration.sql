-- CreateTable
CREATE TABLE "PriorYearLiability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "operatingYear" TEXT NOT NULL,
    "sourceYear" TEXT NOT NULL,
    "sourceEnrollmentId" TEXT NOT NULL,
    "openingAmount" DECIMAL NOT NULL,
    "existingCredits" DECIMAL NOT NULL DEFAULT 0,
    "sourceReferencesJson" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "preparerId" TEXT NOT NULL,
    "verifierId" TEXT,
    "verifiedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'SOURCE_YEAR_UNVERIFIED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriorYearLiability_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriorYearPaymentAttribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "liabilityId" TEXT,
    "paymentId" TEXT NOT NULL,
    "sourceYear" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "reviewedById" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriorYearPaymentAttribution_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "PriorYearLiability" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PriorYearPaymentAttribution_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriorYearConcessionCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "liabilityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "kind" TEXT NOT NULL,
    "requestedAmount" DECIMAL NOT NULL,
    "approvedAmount" DECIMAL,
    "reason" TEXT NOT NULL,
    "scopeJson" TEXT NOT NULL,
    "preparerId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "approverId" TEXT,
    "applicantReference" TEXT NOT NULL,
    "validFrom" DATETIME NOT NULL,
    "validTo" DATETIME NOT NULL,
    "balanceHash" TEXT,
    "balanceVersion" INTEGER,
    "appliedBalanceHash" TEXT,
    "appliedVersion" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PriorYearConcessionCase_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "PriorYearLiability" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriorYearIncomeSupport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bandId" TEXT,
    "exactAmountEnvelope" TEXT,
    "expiresAt" DATETIME,
    "recordedById" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PriorYearIncomeSupport_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PriorYearConcessionCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PriorYearConcessionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "liabilityId" TEXT NOT NULL,
    "caseId" TEXT,
    "eventType" TEXT NOT NULL,
    "referenceId" TEXT,
    "actorId" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "balanceHash" TEXT,
    "balanceVersion" INTEGER,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "reversesEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriorYearConcessionEvent_liabilityId_fkey" FOREIGN KEY ("liabilityId") REFERENCES "PriorYearLiability" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PriorYearConcessionEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PriorYearConcessionCase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentItemReceiptSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "linesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentItemReceiptSnapshot_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MiscIncomeReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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

-- Prior-year immutable and concurrency controls
CREATE TRIGGER "PriorYearConcessionEvent_update_immutable" BEFORE UPDATE ON "PriorYearConcessionEvent" BEGIN SELECT RAISE(ABORT, 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'); END;

CREATE TRIGGER "PriorYearConcessionEvent_delete_immutable" BEFORE DELETE ON "PriorYearConcessionEvent" BEGIN SELECT RAISE(ABORT, 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'); END;

CREATE TRIGGER "PriorYearPaymentAttribution_update_immutable" BEFORE UPDATE ON "PriorYearPaymentAttribution" BEGIN SELECT RAISE(ABORT, 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'); END;

CREATE TRIGGER "PriorYearPaymentAttribution_delete_immutable" BEFORE DELETE ON "PriorYearPaymentAttribution" BEGIN SELECT RAISE(ABORT, 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'); END;

CREATE TRIGGER "StudentItemReceiptSnapshot_update_immutable" BEFORE UPDATE ON "StudentItemReceiptSnapshot" BEGIN SELECT RAISE(ABORT, 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'); END;

CREATE TRIGGER "StudentItemReceiptSnapshot_delete_immutable" BEFORE DELETE ON "StudentItemReceiptSnapshot" BEGIN SELECT RAISE(ABORT, 'PRIOR_YEAR_IMMUTABLE_EVIDENCE'); END;

CREATE TRIGGER "PriorYearLiability_verified_identity" BEFORE UPDATE ON "PriorYearLiability" WHEN OLD."status" = 'VERIFIED' AND (NEW."studentId" IS NOT OLD."studentId" OR NEW."sourceYear" IS NOT OLD."sourceYear" OR NEW."operatingYear" IS NOT OLD."operatingYear" OR NEW."openingAmount" IS NOT OLD."openingAmount" OR NEW."existingCredits" IS NOT OLD."existingCredits" OR NEW."sourceEnrollmentId" IS NOT OLD."sourceEnrollmentId" OR NEW."sourceReferencesJson" IS NOT OLD."sourceReferencesJson" OR NEW."provenance" IS NOT OLD."provenance" OR NEW."preparerId" IS NOT OLD."preparerId" OR NEW."verifierId" IS NOT OLD."verifierId" OR NEW."verifiedAt" IS NOT OLD."verifiedAt" OR NEW."status" IS NOT OLD."status") BEGIN SELECT RAISE(ABORT, 'VERIFIED_LIABILITY_IMMUTABLE'); END;

CREATE TRIGGER "Payment_prior_year_version_insert" AFTER INSERT ON "Payment" BEGIN UPDATE "PriorYearLiability" SET version = version + 1 WHERE "studentId" = NEW."studentId"; END;

CREATE TRIGGER "Payment_prior_year_version_update" AFTER UPDATE ON "Payment" BEGIN UPDATE "PriorYearLiability" SET version = version + 1 WHERE "studentId" = OLD."studentId" OR "studentId" = NEW."studentId"; END;

CREATE TRIGGER "Payment_prior_year_version_delete" AFTER DELETE ON "Payment" BEGIN UPDATE "PriorYearLiability" SET version = version + 1 WHERE "studentId" = OLD."studentId"; END;
