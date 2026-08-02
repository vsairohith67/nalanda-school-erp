import type { PrismaClient } from "@prisma/client";

export type ExamGovernanceBackup = {
  examinations: Record<string, unknown>[];
  examinationClassScopes: Record<string, unknown>[];
  examSubjectPapers: Record<string, unknown>[];
  examinationTimetableVersions: Record<string, unknown>[];
  examinationTimetableRows: Record<string, unknown>[];
  examinationTimetableEvents: Record<string, unknown>[];
  examinationSchemeVersions: Record<string, unknown>[];
  examinationComponents: Record<string, unknown>[];
  examSubjectGroups: Record<string, unknown>[];
  examSubjectGroupMembers: Record<string, unknown>[];
  gradeScaleVersions: Record<string, unknown>[];
  gradeScaleBands: Record<string, unknown>[];
  coScholasticSchemeVersions: Record<string, unknown>[];
  coScholasticItems: Record<string, unknown>[];
  examTemplateFamilyBindings: Record<string, unknown>[];
  teacherExamAssignments: Record<string, unknown>[];
  examinationSchemeAudits: Record<string, unknown>[];
  examMarkSheets: Record<string, unknown>[];
  examMarkEntries: Record<string, unknown>[];
  studentResultSnapshots: Record<string, unknown>[];
};

export type ExamGovernanceRestoreResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
};

const MAX_ROWS = 200_000;
const BANNED_KEY = /^(?:password|passwordHash|token|secret|credential|apiKey)$/i;
const ENTRY_STATES = new Set(["NOT_ENTERED", "PRESENT", "ABSENT", "NOT_APPLICABLE", "EXEMPT"]);

const KEYS = {
  examinations: ["id", "examCode", "academicYear", "name", "examType", "startDate", "endDate", "status", "description", "version", "createdByUserId", "activatedByUserId", "archivedByUserId", "interventionReason", "archiveReason", "activatedAt", "archivedAt", "createdAt", "updatedAt"],
  examinationClassScopes: ["id", "examinationId", "academicYear", "className", "section", "timetableClassSectionId", "status", "createdByUserId", "createdAt", "updatedAt"],
  examSubjectPapers: ["id", "examinationId", "classScopeId", "academicYear", "className", "section", "timetableSubjectId", "subjectNameSnapshot", "paperCode", "paperName", "displayOrder", "status", "createdByUserId", "createdAt", "updatedAt"],
  examinationTimetableVersions: ["id", "publicKey", "examinationId", "classScopeId", "academicYear", "className", "section", "versionNumber", "status", "version", "currentPublicationKey", "idempotencyKey", "replacesVersionId", "parentInstructions", "publicationReason", "replacementReason", "withdrawalReason", "archiveReason", "createdByUserId", "publishedByUserId", "withdrawnByUserId", "archivedByUserId", "publishedAt", "withdrawnAt", "replacedAt", "archivedAt", "createdAt", "updatedAt"],
  examinationTimetableRows: ["id", "timetableVersionId", "subjectPaperId", "subjectNameSnapshot", "paperCodeSnapshot", "paperNameSnapshot", "examDate", "startTime", "endTime", "reportingTime", "venue", "parentInstructions", "displayOrder", "createdAt", "updatedAt"],
  examinationTimetableEvents: ["id", "timetableVersionId", "examinationId", "classScopeId", "eventType", "previousStatus", "newStatus", "reason", "actorUserId", "actorLabel", "snapshotJson", "eventDate", "createdAt"],
  examinationSchemeVersions: ["id", "examinationId", "classScopeId", "academicYear", "className", "section", "scopeKey", "subjectPaperId", "versionNumber", "calculationMode", "roundingPolicyVersion", "markDecimalPlaces", "absentTreatment", "exemptTreatment", "notApplicableTreatment", "passFailEnabled", "passThresholdPercentage", "rankEnabled", "rankTiePolicy", "status", "version", "supersedesVersionId", "createdByUserId", "activatedByUserId", "archivedByUserId", "activationReason", "archiveReason", "activatedAt", "frozenAt", "marksEntryOpenedAt", "archivedAt", "createdAt", "updatedAt"],
  examinationComponents: ["id", "schemeVersionId", "componentCode", "name", "componentKind", "displayOrder", "maximumMarks", "contributionWeight", "isRequired", "createdAt", "updatedAt"],
  examSubjectGroups: ["id", "examinationId", "classScopeId", "academicYear", "className", "section", "groupCode", "groupName", "calculationMode", "displayOrder", "status", "createdByUserId", "createdAt", "updatedAt"],
  examSubjectGroupMembers: ["id", "subjectGroupId", "subjectPaperId", "displayOrder", "contributionWeight", "createdAt"],
  gradeScaleVersions: ["id", "examinationId", "classScopeId", "academicYear", "className", "section", "name", "scaleFamily", "versionNumber", "status", "version", "supersedesVersionId", "activatedByUserId", "activatedAt", "frozenAt", "createdByUserId", "createdAt", "updatedAt"],
  gradeScaleBands: ["id", "gradeScaleVersionId", "gradeCode", "label", "minimumPercentage", "maximumPercentage", "displayOrder", "gradePoint", "remarks", "createdAt", "updatedAt"],
  coScholasticSchemeVersions: ["id", "examinationId", "classScopeId", "academicYear", "className", "section", "name", "schemeFamily", "ratingScaleJson", "versionNumber", "status", "version", "supersedesVersionId", "activatedByUserId", "activatedAt", "frozenAt", "createdByUserId", "createdAt", "updatedAt"],
  coScholasticItems: ["id", "coScholasticSchemeVersionId", "itemCode", "label", "displayOrder", "isRequired", "createdAt", "updatedAt"],
  examTemplateFamilyBindings: ["id", "examinationId", "classScopeId", "academicYear", "className", "section", "templateFamily", "reportCardTemplateId", "versionNumber", "status", "version", "evidenceStatus", "activatedByUserId", "activatedAt", "frozenAt", "createdByUserId", "createdAt", "updatedAt"],
  teacherExamAssignments: ["id", "examinationId", "classScopeId", "timetableClassSectionId", "subjectPaperId", "schemeVersionId", "componentId", "academicYear", "className", "section", "staffMemberId", "timetableTeacherId", "timetableAssignmentId", "assignmentRole", "status", "version", "assignmentReason", "assignedByUserId", "archivedByUserId", "archivedAt", "archiveReason", "createdAt", "updatedAt"],
  examinationSchemeAudits: ["id", "eventKey", "examinationId", "schemeVersionId", "assignmentId", "eventType", "targetType", "targetId", "previousStatus", "newStatus", "reason", "actorUserId", "actorRole", "snapshotJson", "eventDate", "createdAt"],
  examMarkSheets: ["id", "logicalSheetKey", "currentKey", "versionNumber", "supersedesSheetId", "examinationId", "classScopeId", "subjectPaperId", "componentId", "schemeVersionId", "primaryAssignmentId", "academicYear", "className", "section", "status", "optimisticVersion", "assignmentSnapshotJson", "createdByUserId", "submittedByUserId", "moderatedByUserId", "lockedByUserId", "correctionRequestId", "correctionRequestStatus", "correctionPriorStatus", "correctionRequestReason", "correctionRequestedByUserId", "correctionRequestedAt", "correctionReviewedByUserId", "correctionReviewReason", "correctionReviewedAt", "submittedAt", "moderatedAt", "lockedAt", "createdAt", "updatedAt"],
  examMarkEntries: ["id", "sheetId", "studentId", "entryState", "marksObtained", "remarks", "rowVersion", "enteredByUserId", "enteredAt", "createdAt", "updatedAt"],
  studentResultSnapshots: ["id", "calculationRunId", "inputFingerprint", "runNumber", "runStatus", "examinationId", "classScopeId", "studentId", "schemeVersionId", "snapshotVersion", "totalObtained", "totalMaximum", "percentage", "gradeCode", "gradePoint", "passResult", "rankValue", "formulaVersion", "roundingPolicyVersion", "warningsJson", "sourceSheetVersionsJson", "sourceSchemeVersionsJson", "snapshotJson", "calculatedByUserId", "calculatedAt", "lockedByUserId", "lockedAt", "createdAt"]
} as const;

const REQUIRED: Record<keyof ExamGovernanceBackup, string[]> = {
  examinations: ["id", "examCode", "academicYear", "name", "examType", "startDate", "endDate", "status", "createdByUserId"],
  examinationClassScopes: ["id", "examinationId", "academicYear", "className", "timetableClassSectionId", "status", "createdByUserId"],
  examSubjectPapers: ["id", "examinationId", "classScopeId", "academicYear", "className", "timetableSubjectId", "subjectNameSnapshot", "paperCode", "paperName", "status", "createdByUserId"],
  examinationTimetableVersions: ["id", "publicKey", "examinationId", "classScopeId", "academicYear", "className", "versionNumber", "status", "version", "createdByUserId"],
  examinationTimetableRows: ["id", "timetableVersionId", "subjectPaperId", "subjectNameSnapshot", "paperCodeSnapshot", "paperNameSnapshot", "examDate", "startTime", "endTime", "displayOrder"],
  examinationTimetableEvents: ["id", "timetableVersionId", "examinationId", "classScopeId", "eventType", "actorUserId", "actorLabel", "snapshotJson", "eventDate"],
  examinationSchemeVersions: ["id", "examinationId", "classScopeId", "academicYear", "className", "scopeKey", "versionNumber", "calculationMode", "roundingPolicyVersion", "status", "createdByUserId"],
  examinationComponents: ["id", "schemeVersionId", "componentCode", "name", "componentKind", "maximumMarks"],
  examSubjectGroups: ["id", "examinationId", "classScopeId", "academicYear", "className", "groupCode", "groupName", "calculationMode", "createdByUserId"],
  examSubjectGroupMembers: ["id", "subjectGroupId", "subjectPaperId", "displayOrder"],
  gradeScaleVersions: ["id", "examinationId", "classScopeId", "academicYear", "className", "name", "scaleFamily", "versionNumber", "status", "createdByUserId"],
  gradeScaleBands: ["id", "gradeScaleVersionId", "gradeCode", "label", "minimumPercentage", "maximumPercentage", "displayOrder"],
  coScholasticSchemeVersions: ["id", "examinationId", "classScopeId", "academicYear", "className", "name", "schemeFamily", "ratingScaleJson", "versionNumber", "status", "createdByUserId"],
  coScholasticItems: ["id", "coScholasticSchemeVersionId", "itemCode", "label", "displayOrder"],
  examTemplateFamilyBindings: ["id", "examinationId", "classScopeId", "academicYear", "className", "templateFamily", "versionNumber", "status", "evidenceStatus", "createdByUserId"],
  teacherExamAssignments: ["id", "examinationId", "classScopeId", "timetableClassSectionId", "subjectPaperId", "schemeVersionId", "componentId", "academicYear", "className", "staffMemberId", "timetableTeacherId", "timetableAssignmentId", "assignmentRole", "status", "assignmentReason", "assignedByUserId"],
  examinationSchemeAudits: ["id", "examinationId", "eventType", "targetType", "targetId", "actorUserId", "actorRole", "snapshotJson", "eventDate"],
  examMarkSheets: ["id", "logicalSheetKey", "versionNumber", "examinationId", "classScopeId", "subjectPaperId", "componentId", "schemeVersionId", "primaryAssignmentId", "academicYear", "className", "status", "assignmentSnapshotJson", "createdByUserId"],
  examMarkEntries: ["id", "sheetId", "studentId", "entryState", "rowVersion"],
  studentResultSnapshots: ["id", "calculationRunId", "inputFingerprint", "runNumber", "runStatus", "examinationId", "classScopeId", "studentId", "schemeVersionId", "snapshotVersion", "totalObtained", "totalMaximum", "percentage", "formulaVersion", "roundingPolicyVersion", "warningsJson", "sourceSheetVersionsJson", "sourceSchemeVersionsJson", "snapshotJson", "calculatedByUserId", "calculatedAt"]
};

const DATE_FIELDS = new Set([
  "startDate", "endDate", "activatedAt", "archivedAt", "frozenAt", "marksEntryOpenedAt",
  "createdAt", "updatedAt", "eventDate", "correctionRequestedAt", "correctionReviewedAt",
  "publishedAt", "withdrawnAt", "replacedAt",
  "submittedAt", "moderatedAt", "lockedAt", "enteredAt", "calculatedAt"
]);
const DECIMAL_FIELDS = new Set([
  "passThresholdPercentage", "maximumMarks", "contributionWeight", "minimumPercentage",
  "maximumPercentage", "gradePoint", "marksObtained", "totalObtained", "totalMaximum", "percentage"
]);
const JSON_FIELDS = new Set([
  "ratingScaleJson", "snapshotJson", "assignmentSnapshotJson", "warningsJson",
  "sourceSheetVersionsJson", "sourceSchemeVersionsJson"
]);

export function emptyExamGovernanceBackup(): ExamGovernanceBackup {
  return {
    examinations: [],
    examinationClassScopes: [],
    examSubjectPapers: [],
    examinationTimetableVersions: [],
    examinationTimetableRows: [],
    examinationTimetableEvents: [],
    examinationSchemeVersions: [],
    examinationComponents: [],
    examSubjectGroups: [],
    examSubjectGroupMembers: [],
    gradeScaleVersions: [],
    gradeScaleBands: [],
    coScholasticSchemeVersions: [],
    coScholasticItems: [],
    examTemplateFamilyBindings: [],
    teacherExamAssignments: [],
    examinationSchemeAudits: [],
    examMarkSheets: [],
    examMarkEntries: [],
    studentResultSnapshots: []
  };
}

export function examGovernanceRecordCount(value: ExamGovernanceBackup) {
  return Object.values(value).reduce((sum, rows) => sum + rows.length, 0);
}

export async function loadExamGovernanceBackup(client: PrismaClient): Promise<ExamGovernanceBackup> {
  const source = client as any;
  if (
    typeof source.$queryRawUnsafe !== "function" ||
    !source.examination ||
    !source.examinationClassScope ||
    !source.examSubjectPaper ||
    !source.examinationSchemeVersion
  ) {
    return emptyExamGovernanceBackup();
  }
  const schemaRows = await source.$queryRawUnsafe(
    "SELECT m.name AS tableName, p.name AS columnName FROM sqlite_master m LEFT JOIN pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name IN ('ExaminationSchemeVersion', 'ExaminationSchemeAudit', 'ExamMarkSheet', 'ExamMarkEntry', 'StudentResultSnapshot', 'ExaminationTimetableVersion', 'ExaminationTimetableRow', 'ExaminationTimetableEvent')"
  ) as Array<{ tableName: string; columnName: string | null }>;
  const tables = new Set(schemaRows.map((row) => row.tableName));
  const schemeHasMarksPolicy = schemaRows.some((row) => row.tableName === "ExaminationSchemeVersion" && row.columnName === "markDecimalPlaces");
  const auditHasEventKey = schemaRows.some((row) => row.tableName === "ExaminationSchemeAudit" && row.columnName === "eventKey");
  const legacySchemeSelect = {
    id: true,
    examinationId: true,
    classScopeId: true,
    academicYear: true,
    className: true,
    section: true,
    scopeKey: true,
    subjectPaperId: true,
    versionNumber: true,
    calculationMode: true,
    roundingPolicyVersion: true,
    status: true,
    version: true,
    supersedesVersionId: true,
    createdByUserId: true,
    activatedByUserId: true,
    archivedByUserId: true,
    activationReason: true,
    archiveReason: true,
    activatedAt: true,
    frozenAt: true,
    marksEntryOpenedAt: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true
  };
  const legacyAuditSelect = {
    id: true,
    examinationId: true,
    schemeVersionId: true,
    assignmentId: true,
    eventType: true,
    targetType: true,
    targetId: true,
    previousStatus: true,
    newStatus: true,
    reason: true,
    actorUserId: true,
    actorRole: true,
    snapshotJson: true,
    eventDate: true,
    createdAt: true
  };
  const [
    examinations,
    examinationClassScopes,
    examSubjectPapers,
    examinationTimetableVersions,
    examinationTimetableRows,
    examinationTimetableEvents,
    examinationSchemeVersions,
    examinationComponents,
    examSubjectGroups,
    examSubjectGroupMembers,
    gradeScaleVersions,
    gradeScaleBands,
    coScholasticSchemeVersions,
    coScholasticItems,
    examTemplateFamilyBindings,
    teacherExamAssignments,
    examinationSchemeAudits,
    examMarkSheets,
    examMarkEntries,
    studentResultSnapshots
  ] = await Promise.all([
    source.examination.findMany({ orderBy: [{ startDate: "asc" }, { examCode: "asc" }] }),
    source.examinationClassScope.findMany({ orderBy: [{ examinationId: "asc" }, { className: "asc" }, { section: "asc" }] }),
    source.examSubjectPaper.findMany({ orderBy: [{ examinationId: "asc" }, { classScopeId: "asc" }, { displayOrder: "asc" }] }),
    tables.has("ExaminationTimetableVersion")
      ? source.examinationTimetableVersion.findMany({ orderBy: [{ examinationId: "asc" }, { classScopeId: "asc" }, { versionNumber: "asc" }] })
      : Promise.resolve([]),
    tables.has("ExaminationTimetableRow")
      ? source.examinationTimetableRow.findMany({ orderBy: [{ timetableVersionId: "asc" }, { displayOrder: "asc" }] })
      : Promise.resolve([]),
    tables.has("ExaminationTimetableEvent")
      ? source.examinationTimetableEvent.findMany({ orderBy: [{ timetableVersionId: "asc" }, { eventDate: "asc" }, { id: "asc" }] })
      : Promise.resolve([]),
    source.examinationSchemeVersion.findMany({
      ...(schemeHasMarksPolicy ? {} : { select: legacySchemeSelect }),
      orderBy: [{ examinationId: "asc" }, { classScopeId: "asc" }, { scopeKey: "asc" }, { versionNumber: "asc" }]
    }),
    source.examinationComponent.findMany({ orderBy: [{ schemeVersionId: "asc" }, { displayOrder: "asc" }] }),
    source.examSubjectGroup.findMany({ orderBy: [{ examinationId: "asc" }, { classScopeId: "asc" }, { displayOrder: "asc" }] }),
    source.examSubjectGroupMember.findMany({ orderBy: [{ subjectGroupId: "asc" }, { displayOrder: "asc" }] }),
    source.gradeScaleVersion.findMany({ orderBy: [{ examinationId: "asc" }, { classScopeId: "asc" }, { versionNumber: "asc" }] }),
    source.gradeScaleBand.findMany({ orderBy: [{ gradeScaleVersionId: "asc" }, { displayOrder: "asc" }] }),
    source.coScholasticSchemeVersion.findMany({ orderBy: [{ examinationId: "asc" }, { classScopeId: "asc" }, { versionNumber: "asc" }] }),
    source.coScholasticItem.findMany({ orderBy: [{ coScholasticSchemeVersionId: "asc" }, { displayOrder: "asc" }] }),
    source.examTemplateFamilyBinding.findMany({ orderBy: [{ examinationId: "asc" }, { classScopeId: "asc" }, { versionNumber: "asc" }] }),
    source.teacherExamAssignment.findMany({ orderBy: [{ examinationId: "asc" }, { classScopeId: "asc" }, { subjectPaperId: "asc" }, { componentId: "asc" }, { staffMemberId: "asc" }] }),
    source.examinationSchemeAudit.findMany({
      ...(auditHasEventKey ? {} : { select: legacyAuditSelect }),
      orderBy: [{ examinationId: "asc" }, { eventDate: "asc" }, { id: "asc" }]
    }),
    tables.has("ExamMarkSheet")
      ? source.examMarkSheet.findMany({ orderBy: [{ examinationId: "asc" }, { logicalSheetKey: "asc" }, { versionNumber: "asc" }] })
      : Promise.resolve([]),
    tables.has("ExamMarkEntry")
      ? source.examMarkEntry.findMany({ orderBy: [{ sheetId: "asc" }, { studentId: "asc" }] })
      : Promise.resolve([]),
    tables.has("StudentResultSnapshot")
      ? source.studentResultSnapshot.findMany({ orderBy: [{ examinationId: "asc" }, { classScopeId: "asc" }, { runNumber: "asc" }, { studentId: "asc" }] })
      : Promise.resolve([])
  ]);
  return {
    examinations,
    examinationClassScopes,
    examSubjectPapers,
    examinationTimetableVersions,
    examinationTimetableRows,
    examinationTimetableEvents,
    examinationSchemeVersions,
    examinationComponents,
    examSubjectGroups,
    examSubjectGroupMembers,
    gradeScaleVersions,
    gradeScaleBands,
    coScholasticSchemeVersions,
    coScholasticItems,
    examTemplateFamilyBindings,
    teacherExamAssignments,
    examinationSchemeAudits,
    examMarkSheets,
    examMarkEntries,
    studentResultSnapshots
  };
}

export function validateExamGovernanceBackup(value: unknown): ExamGovernanceBackup {
  if (value === undefined || value === null) return emptyExamGovernanceBackup();
  const source = record(value, "examGovernance");
  const unknown = Object.keys(source).filter((key) => !(key in KEYS));
  if (unknown.length) throw new Error(`examGovernance contains unknown collection: ${unknown[0]}`);
  const output = emptyExamGovernanceBackup();
  for (const key of Object.keys(KEYS) as Array<keyof ExamGovernanceBackup>) {
    const raw = source[key] ?? [];
    if (!Array.isArray(raw) || raw.length > MAX_ROWS) throw new Error(`examGovernance.${key} is not a bounded array`);
    const allowed = new Set(KEYS[key]);
    const ids = new Set<string>();
    output[key] = raw.map((item, index) => {
      const row = record(item, `examGovernance.${key}[${index}]`);
      const extra = Object.keys(row).filter((field) => !allowed.has(field as never));
      if (extra.length) throw new Error(`examGovernance.${key}[${index}] contains unknown field: ${extra[0]}`);
      for (const field of REQUIRED[key]) {
        if (row[field] === null || row[field] === undefined || row[field] === "") {
          throw new Error(`examGovernance.${key}[${index}].${field} is required`);
        }
      }
      const id = String(row.id);
      if (ids.has(id)) throw new Error(`examGovernance.${key} contains duplicate ID ${id}`);
      ids.add(id);
      for (const [field, fieldValue] of Object.entries(row)) {
        if (BANNED_KEY.test(field)) throw new Error(`examGovernance.${key}[${index}] contains a credential field`);
        if (DATE_FIELDS.has(field) && fieldValue != null && Number.isNaN(new Date(String(fieldValue)).valueOf())) {
          throw new Error(`examGovernance.${key}[${index}].${field} is invalid`);
        }
        if (DECIMAL_FIELDS.has(field) && fieldValue != null && (!Number.isFinite(Number(fieldValue)) || Number(fieldValue) < 0)) {
          throw new Error(`examGovernance.${key}[${index}].${field} is invalid`);
        }
        if (JSON_FIELDS.has(field) && fieldValue != null) parseSafeJson(String(fieldValue), `examGovernance.${key}[${index}].${field}`);
      }
      return { ...row };
    }) as never;
  }
  validateRelations(output);
  return output;
}

function validateRelations(data: ExamGovernanceBackup) {
  const ids = <K extends keyof ExamGovernanceBackup>(key: K) => new Set(data[key].map((row) => String(row.id)));
  const examinationIds = ids("examinations");
  const scopeIds = ids("examinationClassScopes");
  const paperIds = ids("examSubjectPapers");
  const timetableVersionIds = ids("examinationTimetableVersions");
  const schemeIds = ids("examinationSchemeVersions");
  const componentIds = ids("examinationComponents");
  const groupIds = ids("examSubjectGroups");
  const gradeScaleIds = ids("gradeScaleVersions");
  const coScholasticIds = ids("coScholasticSchemeVersions");
  const assignmentIds = ids("teacherExamAssignments");
  const sheetIds = ids("examMarkSheets");
  const requireLink = (rows: Record<string, unknown>[], field: string, targets: Set<string>, label: string, optional = false) => {
    for (const [index, row] of rows.entries()) {
      if (optional && (row[field] === null || row[field] === undefined || row[field] === "")) continue;
      if (!targets.has(String(row[field]))) throw new Error(`examGovernance.${label}[${index}].${field} is not backed up`);
    }
  };
  requireLink(data.examinationClassScopes, "examinationId", examinationIds, "examinationClassScopes");
  requireLink(data.examinationTimetableVersions, "examinationId", examinationIds, "examinationTimetableVersions");
  requireLink(data.examinationTimetableVersions, "classScopeId", scopeIds, "examinationTimetableVersions");
  requireLink(data.examinationTimetableVersions, "replacesVersionId", timetableVersionIds, "examinationTimetableVersions", true);
  requireLink(data.examinationTimetableRows, "timetableVersionId", timetableVersionIds, "examinationTimetableRows");
  requireLink(data.examinationTimetableRows, "subjectPaperId", paperIds, "examinationTimetableRows");
  requireLink(data.examinationTimetableEvents, "timetableVersionId", timetableVersionIds, "examinationTimetableEvents");
  requireLink(data.examinationTimetableEvents, "examinationId", examinationIds, "examinationTimetableEvents");
  requireLink(data.examinationTimetableEvents, "classScopeId", scopeIds, "examinationTimetableEvents");
  for (const key of ["examSubjectPapers", "examinationSchemeVersions", "examSubjectGroups", "gradeScaleVersions", "coScholasticSchemeVersions", "examTemplateFamilyBindings", "teacherExamAssignments", "examMarkSheets", "studentResultSnapshots"] as const) {
    requireLink(data[key], "examinationId", examinationIds, key);
    requireLink(data[key], "classScopeId", scopeIds, key);
  }
  requireLink(data.examinationSchemeVersions, "subjectPaperId", paperIds, "examinationSchemeVersions", true);
  requireLink(data.examinationSchemeVersions, "supersedesVersionId", schemeIds, "examinationSchemeVersions", true);
  requireLink(data.examinationComponents, "schemeVersionId", schemeIds, "examinationComponents");
  requireLink(data.examSubjectGroupMembers, "subjectGroupId", groupIds, "examSubjectGroupMembers");
  requireLink(data.examSubjectGroupMembers, "subjectPaperId", paperIds, "examSubjectGroupMembers");
  requireLink(data.gradeScaleBands, "gradeScaleVersionId", gradeScaleIds, "gradeScaleBands");
  requireLink(data.coScholasticItems, "coScholasticSchemeVersionId", coScholasticIds, "coScholasticItems");
  for (const field of ["subjectPaperId", "schemeVersionId", "componentId"] as const) {
    requireLink(data.teacherExamAssignments, field, field === "subjectPaperId" ? paperIds : field === "schemeVersionId" ? schemeIds : componentIds, "teacherExamAssignments");
  }
  requireLink(data.examinationSchemeAudits, "examinationId", examinationIds, "examinationSchemeAudits");
  requireLink(data.examinationSchemeAudits, "schemeVersionId", schemeIds, "examinationSchemeAudits", true);
  requireLink(data.examinationSchemeAudits, "assignmentId", assignmentIds, "examinationSchemeAudits", true);
  for (const [field, targets] of [["subjectPaperId", paperIds], ["schemeVersionId", schemeIds], ["componentId", componentIds], ["primaryAssignmentId", assignmentIds]] as const) {
    requireLink(data.examMarkSheets, field, targets, "examMarkSheets");
  }
  requireLink(data.examMarkSheets, "supersedesSheetId", sheetIds, "examMarkSheets", true);
  requireLink(data.examMarkEntries, "sheetId", sheetIds, "examMarkEntries");
  requireLink(data.studentResultSnapshots, "schemeVersionId", schemeIds, "studentResultSnapshots");
  const entryPairs = new Set<string>();
  for (const [index, entry] of data.examMarkEntries.entries()) {
    const state = String(entry.entryState);
    if (!ENTRY_STATES.has(state)) throw new Error(`examGovernance.examMarkEntries[${index}].entryState is unsupported`);
    const mark = entry.marksObtained;
    if (state === "PRESENT" ? mark === null || mark === undefined : mark !== null && mark !== undefined) {
      throw new Error(`examGovernance.examMarkEntries[${index}] has inconsistent state and mark`);
    }
    const pair = `${entry.sheetId}|${entry.studentId}`;
    if (entryPairs.has(pair)) throw new Error("examGovernance.examMarkEntries contains a duplicate Student/component row");
    entryPairs.add(pair);
  }
}

export async function restoreExamGovernanceBackup(
  client: any,
  backup: ExamGovernanceBackup,
  studentMap: Map<string, string>
): Promise<ExamGovernanceRestoreResult> {
  const result: ExamGovernanceRestoreResult = { created: 0, updated: 0, skipped: 0, errors: [], warnings: [] };
  const steps: Array<[keyof ExamGovernanceBackup, any, (row: Record<string, unknown>) => Record<string, unknown>]> = [
    ["examinations", client.examination, identity],
    ["examinationClassScopes", client.examinationClassScope, identity],
    ["examSubjectPapers", client.examSubjectPaper, identity],
    ["examinationSchemeVersions", client.examinationSchemeVersion, identity],
    ["examinationComponents", client.examinationComponent, identity],
    ["examSubjectGroups", client.examSubjectGroup, identity],
    ["examSubjectGroupMembers", client.examSubjectGroupMember, identity],
    ["gradeScaleVersions", client.gradeScaleVersion, identity],
    ["gradeScaleBands", client.gradeScaleBand, identity],
    ["coScholasticSchemeVersions", client.coScholasticSchemeVersion, identity],
    ["coScholasticItems", client.coScholasticItem, identity],
    ["examTemplateFamilyBindings", client.examTemplateFamilyBinding, identity],
    ["teacherExamAssignments", client.teacherExamAssignment, identity],
    ["examMarkSheets", client.examMarkSheet, identity],
    ["examMarkEntries", client.examMarkEntry, (row) => mapStudent(row, studentMap)],
    ["examinationSchemeAudits", client.examinationSchemeAudit, identity],
    ["studentResultSnapshots", client.studentResultSnapshot, (row) => mapStudent(row, studentMap)]
  ];
  for (const [key, delegate, transform] of steps) {
    const rows = key === "examinationSchemeVersions" || key === "gradeScaleVersions" || key === "coScholasticSchemeVersions" || key === "examMarkSheets"
      ? [...backup[key]].sort((a, b) => Number(a.versionNumber ?? 0) - Number(b.versionNumber ?? 0))
      : backup[key];
    for (const [index, source] of rows.entries()) {
      try {
        const id = String(source.id);
        if (await delegate.findUnique({ where: { id } })) {
          result.skipped += 1;
          continue;
        }
        const data = convertScalars(transform({ ...source }));
        await delegate.create({ data });
        result.created += 1;
      } catch (error) {
        result.errors.push(`${String(key)}[${index}]: ${error instanceof Error ? error.message : "restore failed"}`);
      }
    }
  }
  await restoreExaminationTimetables(client, backup, result);
  return result;
}

async function restoreExaminationTimetables(
  client: any,
  backup: ExamGovernanceBackup,
  result: ExamGovernanceRestoreResult
) {
  const existingIds = new Set<string>();
  for (const version of backup.examinationTimetableVersions) {
    const id = String(version.id);
    if (await client.examinationTimetableVersion.findUnique({ where: { id } })) existingIds.add(id);
  }
  if (existingIds.size) {
    result.skipped += existingIds.size;
    result.skipped += backup.examinationTimetableRows.filter((row) => existingIds.has(String(row.timetableVersionId))).length;
    result.skipped += backup.examinationTimetableEvents.filter((row) => existingIds.has(String(row.timetableVersionId))).length;
    result.warnings.push("Existing examination timetable versions were left immutable; their rows and audit events were not changed.");
  }
  const versions = backup.examinationTimetableVersions
    .filter((row) => !existingIds.has(String(row.id)))
    .sort((a, b) => Number(a.versionNumber ?? 0) - Number(b.versionNumber ?? 0));
  if (!versions.length) return;
  const restoring = new Set(versions.map((row) => String(row.id)));
  try {
    const counts = await client.$transaction(async (tx: any) => {
      let created = 0;
      for (const source of versions) {
        const data = convertScalars({ ...source, status: "DRAFT", currentPublicationKey: null });
        await tx.examinationTimetableVersion.create({ data });
        created += 1;
      }
      for (const source of backup.examinationTimetableRows.filter((row) => restoring.has(String(row.timetableVersionId)))) {
        await tx.examinationTimetableRow.create({ data: convertScalars({ ...source }) });
        created += 1;
      }
      for (const source of versions) {
        await tx.examinationTimetableVersion.update({
          where: { id: String(source.id) },
          data: {
            status: String(source.status),
            currentPublicationKey: (source.currentPublicationKey ?? null) as string | null
          }
        });
      }
      for (const source of backup.examinationTimetableEvents.filter((row) => restoring.has(String(row.timetableVersionId)))) {
        await tx.examinationTimetableEvent.create({ data: convertScalars({ ...source }) });
        created += 1;
      }
      return created;
    });
    result.created += counts;
  } catch (error) {
    result.errors.push(`examinationTimetables: ${error instanceof Error ? error.message : "restore failed"}`);
  }
}

function convertScalars(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value == null) return [key, value];
    if (DATE_FIELDS.has(key)) return [key, new Date(String(value))];
    return [key, value];
  }));
}

function identity(row: Record<string, unknown>) {
  return row;
}

function mapStudent(row: Record<string, unknown>, studentMap: Map<string, string>) {
  const backupStudentId = String(row.studentId);
  const localStudentId = studentMap.get(backupStudentId);
  if (!localStudentId) throw new Error(`Student ${backupStudentId} is unavailable`);
  return { ...row, studentId: localStudentId };
}

function record(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} has an unsafe structure`);
  return value as Record<string, unknown>;
}

function parseSafeJson(value: string, label: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} is invalid JSON`);
  }
  scanForCredentials(parsed, label);
}

function scanForCredentials(value: unknown, label: string) {
  if (Array.isArray(value)) {
    value.forEach((item) => scanForCredentials(item, label));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (BANNED_KEY.test(key)) throw new Error(`${label} contains a credential field`);
    scanForCredentials(item, label);
  }
}
