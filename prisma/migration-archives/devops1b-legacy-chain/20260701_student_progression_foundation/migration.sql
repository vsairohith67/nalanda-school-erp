CREATE TABLE "StudentProgressionDecision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL,
  "sourceEnrollmentId" TEXT,
  "academicYear" TEXT NOT NULL,
  "decisionType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "fromClass" TEXT, "fromSection" TEXT, "fromStatus" TEXT,
  "toAcademicYear" TEXT, "toClass" TEXT, "toSection" TEXT, "toStatus" TEXT,
  "effectiveDate" DATETIME NOT NULL,
  "reason" TEXT, "evidenceNotes" TEXT, "marksSummary" TEXT, "attendanceSummary" TEXT,
  "parentRequestNotes" TEXT, "parentAcknowledgementNotes" TEXT, "feeWarningNotes" TEXT,
  "udiseReviewNotes" TEXT, "destinationSchool" TEXT, "followUpNotes" TEXT, "rejectionReason" TEXT, "cancellationReason" TEXT,
  "createdByUserId" TEXT, "submittedByUserId" TEXT, "approvedByUserId" TEXT,
  "finalizedByUserId" TEXT, "cancelledByUserId" TEXT,
  "submittedAt" DATETIME, "approvedAt" DATETIME, "finalizedAt" DATETIME, "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StudentProgressionDecision_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StudentProgressionDecision_sourceEnrollmentId_fkey" FOREIGN KEY ("sourceEnrollmentId") REFERENCES "AcademicYearEnrollment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudentProgressionDecision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudentProgressionDecision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudentProgressionDecision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudentProgressionDecision_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StudentProgressionDecision_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "StudentProgressionDecision_studentId_createdAt_idx" ON "StudentProgressionDecision"("studentId", "createdAt");
CREATE INDEX "StudentProgressionDecision_academicYear_decisionType_status_idx" ON "StudentProgressionDecision"("academicYear", "decisionType", "status");
CREATE INDEX "StudentProgressionDecision_sourceEnrollmentId_idx" ON "StudentProgressionDecision"("sourceEnrollmentId");
CREATE INDEX "StudentProgressionDecision_createdByUserId_idx" ON "StudentProgressionDecision"("createdByUserId");
CREATE INDEX "StudentProgressionDecision_approvedByUserId_idx" ON "StudentProgressionDecision"("approvedByUserId");
