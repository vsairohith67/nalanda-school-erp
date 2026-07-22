CREATE TABLE "TimetableTeacher" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "TimetableTeacher_shortName_key" ON "TimetableTeacher"("shortName");
CREATE INDEX "TimetableTeacher_name_idx" ON "TimetableTeacher"("name");
CREATE INDEX "TimetableTeacher_department_idx" ON "TimetableTeacher"("department");
CREATE INDEX "TimetableTeacher_isActive_idx" ON "TimetableTeacher"("isActive");

CREATE TABLE "TimetableSubject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "department" TEXT,
    "isLabSubject" BOOLEAN NOT NULL DEFAULT false,
    "isActivitySubject" BOOLEAN NOT NULL DEFAULT false,
    "allowConsecutivePeriods" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "TimetableSubject_shortName_key" ON "TimetableSubject"("shortName");
CREATE INDEX "TimetableSubject_name_idx" ON "TimetableSubject"("name");
CREATE INDEX "TimetableSubject_department_idx" ON "TimetableSubject"("department");
CREATE INDEX "TimetableSubject_isActive_idx" ON "TimetableSubject"("isActive");

CREATE TABLE "TimetableClassSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "displayName" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "TimetableClassSection_academicYear_className_section_key" ON "TimetableClassSection"("academicYear", "className", "section");
CREATE INDEX "TimetableClassSection_academicYear_idx" ON "TimetableClassSection"("academicYear");
CREATE INDEX "TimetableClassSection_groupName_idx" ON "TimetableClassSection"("groupName");
CREATE INDEX "TimetableClassSection_isActive_idx" ON "TimetableClassSection"("isActive");

CREATE TABLE "TimetablePeriodTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "isDefault" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "TimetablePeriodTemplate_academicYear_groupName_dayOfWeek_sortOrder_key" ON "TimetablePeriodTemplate"("academicYear", "groupName", "dayOfWeek", "sortOrder");
CREATE INDEX "TimetablePeriodTemplate_academicYear_groupName_dayOfWeek_idx" ON "TimetablePeriodTemplate"("academicYear", "groupName", "dayOfWeek");

CREATE TABLE "TimetableAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "classSectionId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "periodsPerWeek" INTEGER NOT NULL,
    "allowConsecutiveOverride" BOOLEAN,
    "priority" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableAssignment_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "TimetableClassSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "TimetableSubject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TimetableAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TimetableTeacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TimetableAssignment_academicYear_classSectionId_subjectId_teacherId_key" ON "TimetableAssignment"("academicYear", "classSectionId", "subjectId", "teacherId");
CREATE INDEX "TimetableAssignment_academicYear_idx" ON "TimetableAssignment"("academicYear");
CREATE INDEX "TimetableAssignment_classSectionId_idx" ON "TimetableAssignment"("classSectionId");
CREATE INDEX "TimetableAssignment_subjectId_idx" ON "TimetableAssignment"("subjectId");
CREATE INDEX "TimetableAssignment_teacherId_idx" ON "TimetableAssignment"("teacherId");

CREATE TABLE "TimetableTeacherUnavailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableTeacherUnavailability_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TimetableTeacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TimetableTeacherUnavailability_teacherId_dayOfWeek_periodNumber_key" ON "TimetableTeacherUnavailability"("teacherId", "dayOfWeek", "periodNumber");
CREATE INDEX "TimetableTeacherUnavailability_teacherId_idx" ON "TimetableTeacherUnavailability"("teacherId");

CREATE TABLE "TimetableFixedPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "classSectionId" TEXT,
    "teacherId" TEXT,
    "subjectId" TEXT,
    "dayOfWeek" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableFixedPeriod_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "TimetableClassSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableFixedPeriod_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TimetableTeacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimetableFixedPeriod_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "TimetableSubject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "TimetableFixedPeriod_academicYear_idx" ON "TimetableFixedPeriod"("academicYear");
CREATE INDEX "TimetableFixedPeriod_classSectionId_idx" ON "TimetableFixedPeriod"("classSectionId");
CREATE INDEX "TimetableFixedPeriod_teacherId_idx" ON "TimetableFixedPeriod"("teacherId");
CREATE INDEX "TimetableFixedPeriod_subjectId_idx" ON "TimetableFixedPeriod"("subjectId");
CREATE INDEX "TimetableFixedPeriod_dayOfWeek_periodNumber_idx" ON "TimetableFixedPeriod"("dayOfWeek", "periodNumber");
