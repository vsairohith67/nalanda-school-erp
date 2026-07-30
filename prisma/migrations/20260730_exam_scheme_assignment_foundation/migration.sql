-- CreateTable
CREATE TABLE "Examination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examCode" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "activatedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "interventionReason" TEXT,
    "archiveReason" TEXT,
    "activatedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExaminationClassScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examinationId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "timetableClassSectionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExaminationClassScope_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExaminationClassScope_timetableClassSectionId_fkey" FOREIGN KEY ("timetableClassSectionId") REFERENCES "TimetableClassSection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExaminationSchemeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "scopeKey" TEXT NOT NULL DEFAULT 'BASE',
    "subjectPaperId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "calculationMode" TEXT NOT NULL,
    "roundingPolicyVersion" TEXT NOT NULL DEFAULT 'RC05_V1_DECIMAL6_HALF_UP2',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesVersionId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "activatedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "activationReason" TEXT,
    "archiveReason" TEXT,
    "activatedAt" DATETIME,
    "frozenAt" DATETIME,
    "marksEntryOpenedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExaminationSchemeVersion_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExaminationSchemeVersion_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExaminationSchemeVersion_subjectPaperId_fkey" FOREIGN KEY ("subjectPaperId") REFERENCES "ExamSubjectPaper" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExaminationSchemeVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES "ExaminationSchemeVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExaminationComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeVersionId" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "componentKind" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "maximumMarks" DECIMAL NOT NULL,
    "contributionWeight" DECIMAL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExaminationComponent_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "ExaminationSchemeVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamSubjectPaper" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "timetableSubjectId" TEXT NOT NULL,
    "subjectNameSnapshot" TEXT NOT NULL,
    "paperCode" TEXT NOT NULL,
    "paperName" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamSubjectPaper_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamSubjectPaper_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamSubjectPaper_timetableSubjectId_fkey" FOREIGN KEY ("timetableSubjectId") REFERENCES "TimetableSubject" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamSubjectGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "groupCode" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "calculationMode" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamSubjectGroup_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamSubjectGroup_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamSubjectGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectGroupId" TEXT NOT NULL,
    "subjectPaperId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "contributionWeight" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamSubjectGroupMember_subjectGroupId_fkey" FOREIGN KEY ("subjectGroupId") REFERENCES "ExamSubjectGroup" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamSubjectGroupMember_subjectPaperId_fkey" FOREIGN KEY ("subjectPaperId") REFERENCES "ExamSubjectPaper" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeScaleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "scaleFamily" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesVersionId" TEXT,
    "activatedByUserId" TEXT,
    "activatedAt" DATETIME,
    "frozenAt" DATETIME,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeScaleVersion_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GradeScaleVersion_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradeScaleBand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradeScaleVersionId" TEXT NOT NULL,
    "gradeCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minimumPercentage" DECIMAL NOT NULL,
    "maximumPercentage" DECIMAL NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "gradePoint" DECIMAL,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeScaleBand_gradeScaleVersionId_fkey" FOREIGN KEY ("gradeScaleVersionId") REFERENCES "GradeScaleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoScholasticSchemeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "schemeFamily" TEXT NOT NULL,
    "ratingScaleJson" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesVersionId" TEXT,
    "activatedByUserId" TEXT,
    "activatedAt" DATETIME,
    "frozenAt" DATETIME,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoScholasticSchemeVersion_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CoScholasticSchemeVersion_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoScholasticItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coScholasticSchemeVersionId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoScholasticItem_coScholasticSchemeVersionId_fkey" FOREIGN KEY ("coScholasticSchemeVersionId") REFERENCES "CoScholasticSchemeVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamTemplateFamilyBinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "templateFamily" TEXT NOT NULL,
    "reportCardTemplateId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "evidenceStatus" TEXT NOT NULL DEFAULT 'DIRECTLY_EVIDENCED',
    "activatedByUserId" TEXT,
    "activatedAt" DATETIME,
    "frozenAt" DATETIME,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamTemplateFamilyBinding_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamTemplateFamilyBinding_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamTemplateFamilyBinding_reportCardTemplateId_fkey" FOREIGN KEY ("reportCardTemplateId") REFERENCES "ReportCardTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeacherExamAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examinationId" TEXT NOT NULL,
    "classScopeId" TEXT NOT NULL,
    "timetableClassSectionId" TEXT NOT NULL,
    "subjectPaperId" TEXT NOT NULL,
    "schemeVersionId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "timetableTeacherId" TEXT NOT NULL,
    "timetableAssignmentId" TEXT NOT NULL,
    "assignmentRole" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "assignmentReason" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "archivedByUserId" TEXT,
    "archivedAt" DATETIME,
    "archiveReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeacherExamAssignment_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherExamAssignment_classScopeId_fkey" FOREIGN KEY ("classScopeId") REFERENCES "ExaminationClassScope" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherExamAssignment_timetableClassSectionId_fkey" FOREIGN KEY ("timetableClassSectionId") REFERENCES "TimetableClassSection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherExamAssignment_subjectPaperId_fkey" FOREIGN KEY ("subjectPaperId") REFERENCES "ExamSubjectPaper" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherExamAssignment_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "ExaminationSchemeVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherExamAssignment_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "ExaminationComponent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherExamAssignment_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherExamAssignment_timetableTeacherId_fkey" FOREIGN KEY ("timetableTeacherId") REFERENCES "TimetableTeacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherExamAssignment_timetableAssignmentId_fkey" FOREIGN KEY ("timetableAssignmentId") REFERENCES "TimetableAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExaminationSchemeAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examinationId" TEXT NOT NULL,
    "schemeVersionId" TEXT,
    "assignmentId" TEXT,
    "eventType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExaminationSchemeAudit_examinationId_fkey" FOREIGN KEY ("examinationId") REFERENCES "Examination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExaminationSchemeAudit_schemeVersionId_fkey" FOREIGN KEY ("schemeVersionId") REFERENCES "ExaminationSchemeVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExaminationSchemeAudit_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TeacherExamAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Examination_examCode_key" ON "Examination"("examCode");
CREATE INDEX "Examination_academicYear_status_idx" ON "Examination"("academicYear", "status");
CREATE INDEX "Examination_startDate_endDate_idx" ON "Examination"("startDate", "endDate");
CREATE INDEX "ExaminationClassScope_academicYear_className_section_idx" ON "ExaminationClassScope"("academicYear", "className", "section");
CREATE INDEX "ExaminationClassScope_timetableClassSectionId_idx" ON "ExaminationClassScope"("timetableClassSectionId");
CREATE INDEX "ExaminationClassScope_status_idx" ON "ExaminationClassScope"("status");
CREATE UNIQUE INDEX "ExaminationClassScope_examinationId_className_section_key" ON "ExaminationClassScope"("examinationId", "className", "section");
CREATE UNIQUE INDEX "ExaminationClassScope_examinationId_timetableClassSectionId_key" ON "ExaminationClassScope"("examinationId", "timetableClassSectionId");
CREATE INDEX "ExaminationSchemeVersion_examinationId_classScopeId_status_idx" ON "ExaminationSchemeVersion"("examinationId", "classScopeId", "status");
CREATE INDEX "ExaminationSchemeVersion_subjectPaperId_idx" ON "ExaminationSchemeVersion"("subjectPaperId");
CREATE INDEX "ExaminationSchemeVersion_supersedesVersionId_idx" ON "ExaminationSchemeVersion"("supersedesVersionId");
CREATE UNIQUE INDEX "ExaminationSchemeVersion_examinationId_classScopeId_scopeKey_versionNumber_key" ON "ExaminationSchemeVersion"("examinationId", "classScopeId", "scopeKey", "versionNumber");
CREATE INDEX "ExaminationComponent_schemeVersionId_isRequired_idx" ON "ExaminationComponent"("schemeVersionId", "isRequired");
CREATE UNIQUE INDEX "ExaminationComponent_schemeVersionId_componentCode_key" ON "ExaminationComponent"("schemeVersionId", "componentCode");
CREATE UNIQUE INDEX "ExaminationComponent_schemeVersionId_displayOrder_key" ON "ExaminationComponent"("schemeVersionId", "displayOrder");
CREATE INDEX "ExamSubjectPaper_timetableSubjectId_idx" ON "ExamSubjectPaper"("timetableSubjectId");
CREATE INDEX "ExamSubjectPaper_status_idx" ON "ExamSubjectPaper"("status");
CREATE UNIQUE INDEX "ExamSubjectPaper_examinationId_classScopeId_timetableSubjectId_paperCode_key" ON "ExamSubjectPaper"("examinationId", "classScopeId", "timetableSubjectId", "paperCode");
CREATE UNIQUE INDEX "ExamSubjectPaper_examinationId_classScopeId_displayOrder_key" ON "ExamSubjectPaper"("examinationId", "classScopeId", "displayOrder");
CREATE INDEX "ExamSubjectGroup_status_idx" ON "ExamSubjectGroup"("status");
CREATE UNIQUE INDEX "ExamSubjectGroup_examinationId_classScopeId_groupCode_key" ON "ExamSubjectGroup"("examinationId", "classScopeId", "groupCode");
CREATE UNIQUE INDEX "ExamSubjectGroup_examinationId_classScopeId_displayOrder_key" ON "ExamSubjectGroup"("examinationId", "classScopeId", "displayOrder");
CREATE INDEX "ExamSubjectGroupMember_subjectPaperId_idx" ON "ExamSubjectGroupMember"("subjectPaperId");
CREATE UNIQUE INDEX "ExamSubjectGroupMember_subjectGroupId_subjectPaperId_key" ON "ExamSubjectGroupMember"("subjectGroupId", "subjectPaperId");
CREATE UNIQUE INDEX "ExamSubjectGroupMember_subjectGroupId_displayOrder_key" ON "ExamSubjectGroupMember"("subjectGroupId", "displayOrder");
CREATE INDEX "GradeScaleVersion_examinationId_classScopeId_status_idx" ON "GradeScaleVersion"("examinationId", "classScopeId", "status");
CREATE INDEX "GradeScaleVersion_supersedesVersionId_idx" ON "GradeScaleVersion"("supersedesVersionId");
CREATE UNIQUE INDEX "GradeScaleVersion_examinationId_classScopeId_versionNumber_key" ON "GradeScaleVersion"("examinationId", "classScopeId", "versionNumber");
CREATE INDEX "GradeScaleBand_gradeScaleVersionId_minimumPercentage_idx" ON "GradeScaleBand"("gradeScaleVersionId", "minimumPercentage");
CREATE UNIQUE INDEX "GradeScaleBand_gradeScaleVersionId_gradeCode_key" ON "GradeScaleBand"("gradeScaleVersionId", "gradeCode");
CREATE UNIQUE INDEX "GradeScaleBand_gradeScaleVersionId_displayOrder_key" ON "GradeScaleBand"("gradeScaleVersionId", "displayOrder");
CREATE INDEX "CoScholasticSchemeVersion_examinationId_classScopeId_status_idx" ON "CoScholasticSchemeVersion"("examinationId", "classScopeId", "status");
CREATE INDEX "CoScholasticSchemeVersion_supersedesVersionId_idx" ON "CoScholasticSchemeVersion"("supersedesVersionId");
CREATE UNIQUE INDEX "CoScholasticSchemeVersion_examinationId_classScopeId_versionNumber_key" ON "CoScholasticSchemeVersion"("examinationId", "classScopeId", "versionNumber");
CREATE UNIQUE INDEX "CoScholasticItem_coScholasticSchemeVersionId_itemCode_key" ON "CoScholasticItem"("coScholasticSchemeVersionId", "itemCode");
CREATE UNIQUE INDEX "CoScholasticItem_coScholasticSchemeVersionId_displayOrder_key" ON "CoScholasticItem"("coScholasticSchemeVersionId", "displayOrder");
CREATE INDEX "ExamTemplateFamilyBinding_templateFamily_status_idx" ON "ExamTemplateFamilyBinding"("templateFamily", "status");
CREATE INDEX "ExamTemplateFamilyBinding_reportCardTemplateId_idx" ON "ExamTemplateFamilyBinding"("reportCardTemplateId");
CREATE UNIQUE INDEX "ExamTemplateFamilyBinding_examinationId_classScopeId_versionNumber_key" ON "ExamTemplateFamilyBinding"("examinationId", "classScopeId", "versionNumber");
CREATE INDEX "TeacherExamAssignment_academicYear_className_section_idx" ON "TeacherExamAssignment"("academicYear", "className", "section");
CREATE INDEX "TeacherExamAssignment_staffMemberId_status_idx" ON "TeacherExamAssignment"("staffMemberId", "status");
CREATE INDEX "TeacherExamAssignment_timetableTeacherId_idx" ON "TeacherExamAssignment"("timetableTeacherId");
CREATE INDEX "TeacherExamAssignment_timetableAssignmentId_idx" ON "TeacherExamAssignment"("timetableAssignmentId");
CREATE INDEX "TeacherExamAssignment_subjectPaperId_componentId_assignmentRole_status_idx" ON "TeacherExamAssignment"("subjectPaperId", "componentId", "assignmentRole", "status");
CREATE UNIQUE INDEX "TeacherExamAssignment_examinationId_classScopeId_subjectPaperId_componentId_staffMemberId_key" ON "TeacherExamAssignment"("examinationId", "classScopeId", "subjectPaperId", "componentId", "staffMemberId");
CREATE INDEX "ExaminationSchemeAudit_examinationId_eventDate_idx" ON "ExaminationSchemeAudit"("examinationId", "eventDate");
CREATE INDEX "ExaminationSchemeAudit_schemeVersionId_eventDate_idx" ON "ExaminationSchemeAudit"("schemeVersionId", "eventDate");
CREATE INDEX "ExaminationSchemeAudit_assignmentId_eventDate_idx" ON "ExaminationSchemeAudit"("assignmentId", "eventDate");
CREATE INDEX "ExaminationSchemeAudit_eventType_idx" ON "ExaminationSchemeAudit"("eventType");
