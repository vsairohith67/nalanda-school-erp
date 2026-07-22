-- Prompt 12A: optional staff master links do not modify existing timetable rows.
CREATE TABLE "StaffMember" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "staffCode" TEXT,
  "fullName" TEXT NOT NULL,
  "displayName" TEXT,
  "staffType" TEXT NOT NULL DEFAULT 'TEACHING',
  "designation" TEXT NOT NULL,
  "department" TEXT,
  "primarySubject" TEXT,
  "additionalSubjects" TEXT,
  "qualification" TEXT,
  "experienceYears" REAL,
  "dateOfJoining" DATETIME,
  "mobile" TEXT,
  "alternateMobile" TEXT,
  "email" TEXT,
  "address" TEXT,
  "emergencyContactName" TEXT,
  "emergencyContactMobile" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "userId" TEXT,
  "timetableTeacherId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StaffMember_timetableTeacherId_fkey" FOREIGN KEY ("timetableTeacherId") REFERENCES "TimetableTeacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StaffMember_staffCode_key" ON "StaffMember"("staffCode");
CREATE UNIQUE INDEX "StaffMember_userId_key" ON "StaffMember"("userId");
CREATE UNIQUE INDEX "StaffMember_timetableTeacherId_key" ON "StaffMember"("timetableTeacherId");
CREATE INDEX "StaffMember_fullName_idx" ON "StaffMember"("fullName");
CREATE INDEX "StaffMember_staffType_idx" ON "StaffMember"("staffType");
CREATE INDEX "StaffMember_designation_idx" ON "StaffMember"("designation");
CREATE INDEX "StaffMember_primarySubject_idx" ON "StaffMember"("primarySubject");
CREATE INDEX "StaffMember_mobile_idx" ON "StaffMember"("mobile");
CREATE INDEX "StaffMember_email_idx" ON "StaffMember"("email");
CREATE INDEX "StaffMember_status_idx" ON "StaffMember"("status");

-- The former Teacher dashboard default is replaced by the safe placeholder.
UPDATE "RolePermission" SET "enabled" = false WHERE "role" = 'TEACHER' AND "permission" = 'VIEW_DASHBOARD';
