CREATE TABLE "TeacherAnalyticsReviewCycle" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cycleCode" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "periodStart" DATETIME NOT NULL,
  "periodEnd" DATETIME NOT NULL,
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
  "openedAt" DATETIME,
  "finalisedAt" DATETIME,
  "archivedAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "TeacherAnalyticsReviewCycle_cycleCode_key" ON "TeacherAnalyticsReviewCycle"("cycleCode");
CREATE INDEX "TeacherAnalyticsReviewCycle_academicYear_status_idx" ON "TeacherAnalyticsReviewCycle"("academicYear","status");
CREATE INDEX "TeacherAnalyticsReviewCycle_periodStart_periodEnd_idx" ON "TeacherAnalyticsReviewCycle"("periodStart","periodEnd");

CREATE TABLE "TeacherAnalyticsSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reviewCycleId" TEXT NOT NULL,
  "staffMemberId" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "metricDefinitionVersion" TEXT NOT NULL,
  "sourceCalculatedAt" DATETIME NOT NULL,
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
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherAnalyticsSnapshot_reviewCycleId_fkey" FOREIGN KEY ("reviewCycleId") REFERENCES "TeacherAnalyticsReviewCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TeacherAnalyticsSnapshot_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeacherAnalyticsSnapshot_reviewCycleId_staffMemberId_key" ON "TeacherAnalyticsSnapshot"("reviewCycleId","staffMemberId");
CREATE INDEX "TeacherAnalyticsSnapshot_staffMemberId_academicYear_idx" ON "TeacherAnalyticsSnapshot"("staffMemberId","academicYear");
CREATE INDEX "TeacherAnalyticsSnapshot_snapshotHash_idx" ON "TeacherAnalyticsSnapshot"("snapshotHash");

CREATE TABLE "TeacherAnalyticsReview" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "snapshotId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "strengthsNote" TEXT,
  "supportNeededNote" TEXT,
  "agreedActionsNote" TEXT,
  "leadershipContextNote" TEXT,
  "teacherResponse" TEXT,
  "nextReviewDate" DATETIME,
  "createdByUserId" TEXT,
  "sharedByUserId" TEXT,
  "finalisedByUserId" TEXT,
  "sharedAt" DATETIME,
  "teacherRespondedAt" DATETIME,
  "finalisedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "TeacherAnalyticsReview_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeacherAnalyticsSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TeacherAnalyticsReview_snapshotId_key" ON "TeacherAnalyticsReview"("snapshotId");
CREATE INDEX "TeacherAnalyticsReview_status_idx" ON "TeacherAnalyticsReview"("status");
CREATE INDEX "TeacherAnalyticsReview_nextReviewDate_idx" ON "TeacherAnalyticsReview"("nextReviewDate");

CREATE TABLE "TeacherAnalyticsEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reviewCycleId" TEXT NOT NULL,
  "snapshotId" TEXT,
  "reviewId" TEXT,
  "eventType" TEXT NOT NULL,
  "eventDate" DATETIME NOT NULL,
  "reason" TEXT,
  "notes" TEXT,
  "recordedByUserId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherAnalyticsEvent_reviewCycleId_fkey" FOREIGN KEY ("reviewCycleId") REFERENCES "TeacherAnalyticsReviewCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TeacherAnalyticsEvent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeacherAnalyticsSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TeacherAnalyticsEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "TeacherAnalyticsReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TeacherAnalyticsEvent_reviewCycleId_eventDate_idx" ON "TeacherAnalyticsEvent"("reviewCycleId","eventDate");
CREATE INDEX "TeacherAnalyticsEvent_snapshotId_idx" ON "TeacherAnalyticsEvent"("snapshotId");
CREATE INDEX "TeacherAnalyticsEvent_reviewId_idx" ON "TeacherAnalyticsEvent"("reviewId");
CREATE INDEX "TeacherAnalyticsEvent_eventType_idx" ON "TeacherAnalyticsEvent"("eventType");
