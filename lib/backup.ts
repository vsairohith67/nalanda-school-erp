import type { PrismaClient } from "@prisma/client";
import packageJson from "../package.json";
import {
  examGovernanceRecordCount,
  loadExamGovernanceBackup,
  validateExamGovernanceBackup,
  type ExamGovernanceBackup
} from "./exam-governance-backup";
import { getSchoolSettings, type SchoolSettingsValue } from "./school-settings";
import { authSecurityRecordCount, createAuthSecurityBackup, type AuthSecurityBackup } from "./auth-backup";
import { createIamAccessBackup, iamAccessRecordCount, type IamAccessBackup } from "./iam/backup";
import { loadAcademicCalendarBackup } from "./academic-calendar-backup";
import { loadClassworkBackup, validateClassworkBackupRows, type ClassworkBackup } from "./classwork-backup";
import {
  loadAcademicReportingBackup,
  validateAcademicReportingBackupRows,
  type AcademicReportingBackup
} from "./academic-reporting-backup";
import { loadAdmissionsBackup, validateAdmissionsBackupRows, type AdmissionsBackup } from "./admissions-backup";
import { loadPayrollBackup, PAYROLL_BACKUP_KEYS, validatePayrollBackupRows, type PayrollBackup, type PayrollBackupKey } from "./payroll-backup";
import { loadPayslipRequestBackup, PAYSLIP_REQUEST_BACKUP_KEYS, validatePayslipRequestBackupRows, type PayslipRequestBackup, type PayslipRequestBackupKey } from "./payslip-request-backup";
import { emptyFamilyCollectionBackup, familyCollectionSchemaAvailable, FAMILY_COLLECTION_BACKUP_KEYS, loadFamilyCollectionBackup, validateFamilyCollectionBackupRows, type FamilyCollectionBackup } from "./family-collection-backup";

const APP_NAME = "Nalanda Fee Control";

type BackupClient = Pick<
  PrismaClient,
  "student" | "feeStructure" | "payment" | "paymentAudit" | "user" | "receiptNote"
  | "schoolSettings" | "importBatch" | "goLiveChecklist" | "timetableTeacher"
  | "timetableSubject" | "timetableClassSection" | "timetablePeriodTemplate"
  | "timetableAssignment" | "timetableTeacherUnavailability" | "timetableFixedPeriod"
  | "timetableDraft" | "timetableEntry" | "rolePermission" | "guardian" | "studentGuardian"
  | "notice"
  | "staffMember"
  | "studentAttendanceSession" | "studentAttendanceRecord"
  | "staffAttendanceSession" | "staffAttendanceRecord"
  | "staffLeaveRequest"
  | "substituteAssignment"
  | "academicYearEnrollment" | "studentLifecycleEvent"
  | "studentProgressionDecision"
  | "vendor" | "expenseCategory" | "expenseDepartment" | "expenseRecord" | "expensePayment" | "expenseAudit"
  | "budgetPlan" | "budgetAllocation" | "budgetRevision"
  | "miscIncomeItem" | "miscIncomeRate" | "miscIncomeReceipt" | "miscIncomeReceiptLine" | "cashBookDay" | "cashBookMovement"
  | "bookCatalogItem" | "bookCatalogRate" | "bookSaleReceipt" | "bookSaleReceiptLine" | "bookCashSettlement"
  | "libraryTitle" | "libraryCopy" | "libraryCopyEvent" | "libraryMember" | "libraryPolicy" | "libraryLoan" | "libraryReservation" | "libraryLoanEvent"
  | "libraryIncident" | "libraryChargeRule" | "libraryCharge" | "libraryChargeEvent"
  | "libraryStockVerificationSession" | "libraryStockVerificationRecord" | "libraryStockVerificationScanEvent" | "libraryStockVerificationEvent"
  | "homeworkAssignment" | "homeworkAssignmentEvent"
  | "examCycle" | "examAssessment" | "studentMark" | "studentMarkEvent"
  | "gradingScheme" | "gradeBand" | "reportCardTemplate" | "reportCardBatch"
  | "reportCardBatchExamSource" | "studentReportCard" | "studentReportCardVersion" | "studentReportCardEvent"
  | "teacherAnalyticsReviewCycle" | "teacherAnalyticsSnapshot" | "teacherAnalyticsReview" | "teacherAnalyticsEvent"
  | "certificateNumberSeries" | "certificateTemplate" | "studentCertificateRequest"
  | "studentCertificate" | "studentCertificateVersion" | "studentCertificateEvent"
  | "classXPackageTemplate" | "classXDocumentPackage" | "classXPackageDocumentItem"
  | "classXPackageChargeRule" | "classXPackageCharge" | "classXPackageHandover" | "classXPackageEvent"
  | "identityCardNumberSeries" | "identityCardTemplate" | "identityCardBatch"
  | "identityCard" | "identityCardVersion" | "identityCardEvent"
  | "notificationTemplate" | "notificationCampaign" | "notificationRecipient"
  | "notificationSkippedRecipient" | "notificationEvent"
  | "whatsAppIntegrationProfile" | "whatsAppConsent" | "whatsAppConsentEvent"
  | "whatsAppTemplateMapping" | "whatsAppOutboundBatch" | "whatsAppDelivery"
  | "whatsAppDeliveryAttempt" | "whatsAppWebhookEvent" | "whatsAppRateReference"
  | "smsEmailIntegrationProfile" | "smsEmailConsent" | "smsEmailConsentEvent"
  | "smsEmailTemplateMapping" | "smsEmailOutboundBatch" | "smsEmailDelivery"
  | "smsEmailDeliveryAttempt" | "smsEmailWebhookEvent" | "smsEmailOperationalEvent"
  | "smsEmailSuppression" | "smsEmailCostRate"
  | "aiAssistantProfile" | "aiAssistantSourcePolicy" | "aiAssistantQueryAudit"
  | "aiAssistantSafetyEvent" | "aiAssistantEvaluationCase" | "aiAssistantEvaluationRun"
  | "feeRegisterOcrProfile" | "feeRegisterOcrBatch" | "feeRegisterOcrPage"
  | "feeRegisterOcrRow" | "feeRegisterOcrRowRevision" | "feeRegisterOcrPostingRun" | "feeRegisterOcrEvent"
  | "cloudBackupProfile" | "cloudBackupSchedule" | "cloudBackupRetentionPolicy"
  | "cloudBackupRun" | "cloudBackupArtifact" | "cloudBackupVerification"
  | "cloudBackupRestoreRehearsal" | "cloudBackupEvent"
  | "publicWebsiteSettings" | "publicWebsitePage" | "publicWebsitePageVersion"
  | "publicWebsitePost" | "publicWebsitePostVersion" | "publicWebsiteNavigationItem" | "publicWebsiteEvent"
  | "authLoginAlias" | "authVerificationChallenge" | "authPasswordResetToken" | "authSession" | "authSecurityEvent"
  | "userRoleAssignment" | "permissionProfile" | "permissionProfileEntry"
  | "permissionProfileVersion" | "userPermissionProfileAssignment" | "userPermissionOverride"
  | "userAudit"
  | "academicCalendarVersion" | "operationalCalendarDay" | "schoolCalendarEvent"
  | "schoolCalendarEventVersion" | "academicCalendarAuditEvent"
  | "classworkItem" | "classworkItemVersion" | "classworkSubmission" | "classworkSubmissionVersion"
  | "classworkAttachment" | "classworkFeedback" | "classworkAuditEvent"
  | "academicReportDefinition" | "academicReportRun" | "academicReportSourceReference" | "academicReportAuditEvent"
  | "admissionCycle" | "admissionEnquiry" | "enquiryFollowUp" | "schoolVisit"
  | "admissionApplication" | "admissionApplicationVersion" | "applicantChild" | "prospectiveGuardian"
  | "applicationDocument" | "applicationReview" | "admissionDecision" | "admissionOffer"
  | "admissionDuplicateResolution" | "admissionConversion" | "admissionEvent"
  | "payrollPolicyVersion" | "salaryStructureVersion" | "salaryComponentDefinition"
  | "staffCompensationAssignment" | "salaryRevision" | "payrollPeriod" | "payrollRun"
  | "employeePayrollResult" | "payrollComponentResult" | "salaryAdvance"
  | "advanceRecoverySchedule" | "payslipVersion" | "payrollEvent"
  | "staffPayslipMonthAvailability" | "staffPayslipRequest" | "staffPayslipRequestMonth"
  | "staffPayslipRequestEvent" | "staffPayslipDocumentVersion" | "staffPayslipDocumentMonth" | "staffPayslipAccessEvent"
>;

type BackupDocumentInput = {
  generatedAt: Date;
  generatedBy: string;
  schoolSettings?: SchoolSettingsValue;
  students: readonly unknown[];
  feeStructures: readonly unknown[];
  payments: readonly unknown[];
  paymentAudits: readonly unknown[];
  users: readonly object[];
  authSecurity?: Partial<Record<keyof AuthSecurityBackup, readonly object[]>>;
  iamAccess?: Partial<Record<keyof IamAccessBackup, readonly object[]>>;
  rolePermissions?: readonly unknown[];
  guardians?: readonly unknown[];
  studentGuardians?: readonly unknown[];
  notices?: readonly unknown[];
  staffMembers?: readonly unknown[];
  studentAttendanceSessions?: readonly unknown[];
  studentAttendanceRecords?: readonly unknown[];
  staffAttendanceSessions?: readonly unknown[];
  staffAttendanceRecords?: readonly unknown[];
  staffLeaveRequests?: readonly unknown[];
  substituteAssignments?: readonly unknown[];
  academicYearEnrollments?: readonly unknown[];
  studentLifecycleEvents?: readonly unknown[];
  studentProgressionDecisions?: readonly unknown[];
  vendors?: readonly unknown[];
  expenseCategories?: readonly unknown[];
  expenseDepartments?: readonly unknown[];
  expenseRecords?: readonly unknown[];
  expensePayments?: readonly unknown[];
  expenseAudits?: readonly unknown[];
  budgetPlans?: readonly unknown[];
  budgetAllocations?: readonly unknown[];
  budgetRevisions?: readonly unknown[];
  miscIncomeItems?: readonly unknown[];
  miscIncomeRates?: readonly unknown[];
  miscIncomeReceipts?: readonly unknown[];
  miscIncomeReceiptLines?: readonly unknown[];
  cashBookDays?: readonly unknown[];
  cashBookMovements?: readonly unknown[];
  bookCatalogItems?: readonly unknown[];
  bookCatalogRates?: readonly unknown[];
  bookSaleReceipts?: readonly unknown[];
  bookSaleReceiptLines?: readonly unknown[];
  bookCashSettlements?: readonly unknown[];
  libraryTitles?: readonly unknown[];
  libraryCopies?: readonly unknown[];
  libraryCopyEvents?: readonly unknown[];
  libraryMembers?: readonly unknown[];
  libraryPolicies?: readonly unknown[];
  libraryLoans?: readonly unknown[];
  libraryReservations?: readonly unknown[];
  libraryLoanEvents?: readonly unknown[];
  libraryIncidents?: readonly unknown[];
  libraryChargeRules?: readonly unknown[];
  libraryCharges?: readonly unknown[];
  libraryChargeEvents?: readonly unknown[];
  libraryStockVerificationSessions?: readonly unknown[];
  libraryStockVerificationRecords?: readonly unknown[];
  libraryStockVerificationScanEvents?: readonly unknown[];
  libraryStockVerificationEvents?: readonly unknown[];
  homeworkAssignments?: readonly unknown[];
  homeworkAssignmentEvents?: readonly unknown[];
  examCycles?: readonly object[];
  examAssessments?: readonly object[];
  studentMarks?: readonly object[];
  studentMarkEvents?: readonly object[];
  examGovernance?: ExamGovernanceBackup;
  gradingSchemes?: readonly object[];
  gradeBands?: readonly object[];
  reportCardTemplates?: readonly object[];
  reportCardBatches?: readonly object[];
  reportCardBatchExamSources?: readonly object[];
  studentReportCards?: readonly object[];
  studentReportCardVersions?: readonly object[];
  studentReportCardEvents?: readonly object[];
  academicCalendarVersions?: readonly object[];
  operationalCalendarDays?: readonly object[];
  schoolCalendarEvents?: readonly object[];
  schoolCalendarEventVersions?: readonly object[];
  academicCalendarAuditEvents?: readonly object[];
  teacherAnalyticsReviewCycles?: readonly object[];
  teacherAnalyticsSnapshots?: readonly object[];
  teacherAnalyticsReviews?: readonly object[];
  teacherAnalyticsEvents?: readonly object[];
  certificateNumberSeries?: readonly object[];
  certificateTemplates?: readonly object[];
  studentCertificateRequests?: readonly object[];
  studentCertificates?: readonly object[];
  studentCertificateVersions?: readonly object[];
  studentCertificateEvents?: readonly object[];
  classXPackageTemplates?: readonly object[];
  classXDocumentPackages?: readonly object[];
  classXPackageDocumentItems?: readonly object[];
  classXPackageChargeRules?: readonly object[];
  classXPackageCharges?: readonly object[];
  classXPackageHandovers?: readonly object[];
  classXPackageEvents?: readonly object[];
  identityCardNumberSeries?: readonly object[];
  identityCardTemplates?: readonly object[];
  identityCardBatches?: readonly object[];
  identityCards?: readonly object[];
  identityCardVersions?: readonly object[];
  identityCardEvents?: readonly object[];
  notificationTemplates?: readonly object[];
  notificationCampaigns?: readonly object[];
  notificationRecipients?: readonly object[];
  notificationSkippedRecipients?: readonly object[];
  notificationEvents?: readonly object[];
  whatsAppIntegrationProfiles?: readonly object[];
  whatsAppConsents?: readonly object[];
  whatsAppConsentEvents?: readonly object[];
  whatsAppTemplateMappings?: readonly object[];
  whatsAppOutboundBatches?: readonly object[];
  whatsAppDeliveries?: readonly object[];
  whatsAppDeliveryAttempts?: readonly object[];
  whatsAppWebhookEvents?: readonly object[];
  whatsAppOperationalEvents?: readonly object[];
  whatsAppRateReferences?: readonly object[];
  smsEmailIntegrationProfiles?: readonly object[];
  smsEmailConsents?: readonly object[];
  smsEmailConsentEvents?: readonly object[];
  smsEmailTemplateMappings?: readonly object[];
  smsEmailOutboundBatches?: readonly object[];
  smsEmailDeliveries?: readonly object[];
  smsEmailDeliveryAttempts?: readonly object[];
  smsEmailWebhookEvents?: readonly object[];
  smsEmailOperationalEvents?: readonly object[];
  smsEmailSuppressions?: readonly object[];
  smsEmailCostRates?: readonly object[];
  aiAssistantProfiles?: readonly object[];
  aiAssistantSourcePolicies?: readonly object[];
  aiAssistantQueryAudits?: readonly object[];
  aiAssistantSafetyEvents?: readonly object[];
  aiAssistantEvaluationCases?: readonly object[];
  aiAssistantEvaluationRuns?: readonly object[];
  feeRegisterOcrProfiles?: readonly object[];
  feeRegisterOcrBatches?: readonly object[];
  feeRegisterOcrPages?: readonly object[];
  feeRegisterOcrRows?: readonly object[];
  feeRegisterOcrRowRevisions?: readonly object[];
  feeRegisterOcrPostingRuns?: readonly object[];
  feeRegisterOcrEvents?: readonly object[];
  cloudBackupProfiles?: readonly object[];
  cloudBackupSchedules?: readonly object[];
  cloudBackupRetentionPolicies?: readonly object[];
  cloudBackupRuns?: readonly object[];
  cloudBackupArtifacts?: readonly object[];
  cloudBackupVerifications?: readonly object[];
  cloudBackupRestoreRehearsals?: readonly object[];
  cloudBackupEvents?: readonly object[];
  publicWebsiteSettings?: readonly object[];
  publicWebsitePages?: readonly object[];
  publicWebsitePageVersions?: readonly object[];
  publicWebsitePosts?: readonly object[];
  publicWebsitePostVersions?: readonly object[];
  publicWebsiteNavigationItems?: readonly object[];
  publicWebsiteEvents?: readonly object[];
  receiptNotes?: readonly unknown[];
  importBatches?: readonly unknown[];
  goLiveChecklist?: readonly unknown[];
  timetableTeachers?: readonly unknown[];
  timetableSubjects?: readonly unknown[];
  timetableClassSections?: readonly unknown[];
  timetablePeriodTemplates?: readonly unknown[];
  timetableAssignments?: readonly unknown[];
  timetableTeacherUnavailability?: readonly unknown[];
  timetableFixedPeriods?: readonly unknown[];
  timetableDrafts?: readonly unknown[];
  timetableEntries?: readonly unknown[];
  academicYear?: string;
} & Partial<ClassworkBackup> & Partial<AcademicReportingBackup> & Partial<AdmissionsBackup> & Partial<PayrollBackup> & Partial<PayslipRequestBackup> & Partial<FamilyCollectionBackup>;

export function createBackupDocument(input: BackupDocumentInput) {
  const timetableTeachers = [...(input.timetableTeachers ?? [])];
  const timetableSubjects = [...(input.timetableSubjects ?? [])];
  const timetableClassSections = [...(input.timetableClassSections ?? [])];
  const timetablePeriodTemplates = [...(input.timetablePeriodTemplates ?? [])];
  const timetableAssignments = [...(input.timetableAssignments ?? [])];
  const timetableDrafts = [...(input.timetableDrafts ?? [])];
  const timetableEntries = [...(input.timetableEntries ?? [])];
  const rolePermissions = [...(input.rolePermissions ?? [])];
  const authSecurity = createAuthSecurityBackup(input.authSecurity);
  const iamAccess = createIamAccessBackup(input.iamAccess);
  const guardians = [...(input.guardians ?? [])];
  const studentGuardians = [...(input.studentGuardians ?? [])];
  const notices = [...(input.notices ?? [])];
  const staffMembers = [...(input.staffMembers ?? [])];
  const studentAttendanceSessions = [...(input.studentAttendanceSessions ?? [])];
  const studentAttendanceRecords = [...(input.studentAttendanceRecords ?? [])];
  const staffAttendanceSessions = [...(input.staffAttendanceSessions ?? [])];
  const staffAttendanceRecords = [...(input.staffAttendanceRecords ?? [])];
  const staffLeaveRequests = [...(input.staffLeaveRequests ?? [])];
  const substituteAssignments = [...(input.substituteAssignments ?? [])];
  const academicYearEnrollments = [...(input.academicYearEnrollments ?? [])];
  const studentLifecycleEvents = [...(input.studentLifecycleEvents ?? [])];
  const studentProgressionDecisions = [...(input.studentProgressionDecisions ?? [])];
  const vendors = [...(input.vendors ?? [])];
  const expenseCategories = [...(input.expenseCategories ?? [])];
  const expenseDepartments = [...(input.expenseDepartments ?? [])];
  const expenseRecords = [...(input.expenseRecords ?? [])];
  const expensePayments = [...(input.expensePayments ?? [])];
  const expenseAudits = [...(input.expenseAudits ?? [])];
  const budgetPlans = [...(input.budgetPlans ?? [])];
  const budgetAllocations = [...(input.budgetAllocations ?? [])];
  const budgetRevisions = [...(input.budgetRevisions ?? [])];
  const miscIncomeItems = [...(input.miscIncomeItems ?? [])];
  const miscIncomeRates = [...(input.miscIncomeRates ?? [])];
  const miscIncomeReceipts = [...(input.miscIncomeReceipts ?? [])];
  const miscIncomeReceiptLines = [...(input.miscIncomeReceiptLines ?? [])];
  const cashBookDays = [...(input.cashBookDays ?? [])];
  const cashBookMovements = [...(input.cashBookMovements ?? [])];
  const bookCatalogItems = [...(input.bookCatalogItems ?? [])];
  const bookCatalogRates = [...(input.bookCatalogRates ?? [])];
  const bookSaleReceipts = [...(input.bookSaleReceipts ?? [])];
  const bookSaleReceiptLines = [...(input.bookSaleReceiptLines ?? [])];
  const bookCashSettlements = [...(input.bookCashSettlements ?? [])];
  const libraryTitles = [...(input.libraryTitles ?? [])];
  const libraryCopies = [...(input.libraryCopies ?? [])];
  const libraryCopyEvents = [...(input.libraryCopyEvents ?? [])];
  const libraryMembers = [...(input.libraryMembers ?? [])];
  const libraryPolicies = [...(input.libraryPolicies ?? [])];
  const libraryLoans = [...(input.libraryLoans ?? [])];
  const libraryReservations = [...(input.libraryReservations ?? [])];
  const libraryLoanEvents = [...(input.libraryLoanEvents ?? [])];
  const libraryIncidents = [...(input.libraryIncidents ?? [])];
  const libraryChargeRules = [...(input.libraryChargeRules ?? [])];
  const libraryCharges = [...(input.libraryCharges ?? [])];
  const libraryChargeEvents = [...(input.libraryChargeEvents ?? [])];
  const libraryStockVerificationSessions = [...(input.libraryStockVerificationSessions ?? [])];
  const libraryStockVerificationRecords = [...(input.libraryStockVerificationRecords ?? [])];
  const libraryStockVerificationScanEvents = [...(input.libraryStockVerificationScanEvents ?? [])];
  const libraryStockVerificationEvents = [...(input.libraryStockVerificationEvents ?? [])];
  const homeworkAssignments = [...(input.homeworkAssignments ?? [])];
  const homeworkAssignmentEvents = [...(input.homeworkAssignmentEvents ?? [])];
  const examCycles = sanitizeActorFields(input.examCycles ?? []);
  const examAssessments = sanitizeActorFields(input.examAssessments ?? []);
  const studentMarks = sanitizeActorFields(input.studentMarks ?? []);
  const studentMarkEvents = [...(input.studentMarkEvents ?? [])];
  const examGovernance = validateExamGovernanceBackup(input.examGovernance);
  const gradingSchemes = sanitizeActorFields(input.gradingSchemes ?? []);
  const gradeBands = [...(input.gradeBands ?? [])];
  const reportCardTemplates = sanitizeActorFields(input.reportCardTemplates ?? []);
  const reportCardBatches = sanitizeActorFields(input.reportCardBatches ?? []);
  const reportCardBatchExamSources = [...(input.reportCardBatchExamSources ?? [])];
  const studentReportCards = sanitizeActorFields(input.studentReportCards ?? []);
  const studentReportCardVersions = sanitizeActorFields(input.studentReportCardVersions ?? []);
  const studentReportCardEvents = sanitizeActorFields(input.studentReportCardEvents ?? []);
  const academicCalendarVersions = sanitizeActorFields(input.academicCalendarVersions ?? []);
  const operationalCalendarDays = [...(input.operationalCalendarDays ?? [])];
  const schoolCalendarEvents = sanitizeActorFields(input.schoolCalendarEvents ?? []);
  const schoolCalendarEventVersions = sanitizeActorFields(input.schoolCalendarEventVersions ?? []);
  const academicCalendarAuditEvents = sanitizeActorFields(input.academicCalendarAuditEvents ?? []);
  const classworkBackup = validateClassworkBackupRows(input as unknown as Record<string, unknown>);
  const academicReportingBackup = validateAcademicReportingBackupRows(input as unknown as Record<string, unknown>, {
    resultSnapshotIds: new Set(examGovernance.studentResultSnapshots.map((row) => String(row.id))),
    reportCardVersionIds: new Set(studentReportCardVersions.map((row) => String((row as Record<string, unknown>).id)))
  });
  const admissionsBackup = validateAdmissionsBackupRows(input as unknown as Record<string, unknown>);
  const payrollBackup = validatePayrollBackupRows(input as unknown as Record<string, unknown>);
  const payrollCounts = Object.fromEntries(PAYROLL_BACKUP_KEYS.map((key) => [key, payrollBackup[key].length])) as Record<PayrollBackupKey, number>;
  const payslipRequestBackup = validatePayslipRequestBackupRows(input as unknown as Record<string, unknown>);
  const payslipRequestCounts = Object.fromEntries(PAYSLIP_REQUEST_BACKUP_KEYS.map((key) => [key, payslipRequestBackup[key].length])) as Record<PayslipRequestBackupKey, number>;
  const familyCollectionBackup = validateFamilyCollectionBackupRows(input as unknown as Record<string, unknown>);
  const familyCollectionCounts = Object.fromEntries(FAMILY_COLLECTION_BACKUP_KEYS.map((key) => [key, familyCollectionBackup[key].length]));
  const teacherAnalyticsReviewCycles = sanitizeActorFields(input.teacherAnalyticsReviewCycles ?? []);
  const teacherAnalyticsSnapshots = sanitizeActorFields(input.teacherAnalyticsSnapshots ?? []);
  const teacherAnalyticsReviews = sanitizeActorFields(input.teacherAnalyticsReviews ?? []);
  const teacherAnalyticsEvents = sanitizeActorFields(input.teacherAnalyticsEvents ?? []);
  const certificateNumberSeries = sanitizeActorFields(input.certificateNumberSeries ?? []);
  const certificateTemplates = sanitizeActorFields(input.certificateTemplates ?? []);
  const studentCertificateRequests = sanitizeActorFields(input.studentCertificateRequests ?? []);
  const studentCertificates = sanitizeActorFields(input.studentCertificates ?? []);
  const studentCertificateVersions = sanitizeActorFields(input.studentCertificateVersions ?? []);
  const studentCertificateEvents = sanitizeActorFields(input.studentCertificateEvents ?? []);
  const classXPackageTemplates = sanitizeActorFields(input.classXPackageTemplates ?? []);
  const classXDocumentPackages = sanitizeActorFields(input.classXDocumentPackages ?? []);
  const classXPackageDocumentItems = sanitizeActorFields(input.classXPackageDocumentItems ?? []);
  const classXPackageChargeRules = sanitizeActorFields(input.classXPackageChargeRules ?? []);
  const classXPackageCharges = sanitizeActorFields(input.classXPackageCharges ?? []);
  const classXPackageHandovers = sanitizeActorFields(input.classXPackageHandovers ?? []);
  const classXPackageEvents = sanitizeActorFields(input.classXPackageEvents ?? []);
  const identityCardNumberSeries = sanitizeActorFields(input.identityCardNumberSeries ?? []);
  const identityCardTemplates = sanitizeActorFields(input.identityCardTemplates ?? []);
  const identityCardBatches = sanitizeActorFields(input.identityCardBatches ?? []);
  const identityCards = sanitizeActorFields(input.identityCards ?? []);
  const identityCardVersions = sanitizeActorFields(input.identityCardVersions ?? []);
  const identityCardEvents = sanitizeActorFields(input.identityCardEvents ?? []);
  const notificationTemplates = sanitizeActorFields(input.notificationTemplates ?? []);
  const notificationCampaigns = sanitizeActorFields(input.notificationCampaigns ?? []);
  const notificationRecipients = [...(input.notificationRecipients ?? [])];
  const notificationSkippedRecipients = [...(input.notificationSkippedRecipients ?? [])];
  const notificationEvents = sanitizeActorFields(input.notificationEvents ?? []);
  const whatsAppIntegrationProfiles = sanitizeActorFields(input.whatsAppIntegrationProfiles ?? []);
  const whatsAppConsents = sanitizeActorFields(input.whatsAppConsents ?? []);
  const whatsAppConsentEvents = sanitizeActorFields(input.whatsAppConsentEvents ?? []);
  const whatsAppTemplateMappings = sanitizeActorFields(input.whatsAppTemplateMappings ?? []);
  const whatsAppOutboundBatches = sanitizeActorFields(input.whatsAppOutboundBatches ?? []);
  const whatsAppDeliveries = [...(input.whatsAppDeliveries ?? [])];
  const whatsAppDeliveryAttempts = [...(input.whatsAppDeliveryAttempts ?? [])];
  const whatsAppWebhookEvents = [...(input.whatsAppWebhookEvents ?? [])];
  const whatsAppOperationalEvents = sanitizeActorFields(input.whatsAppOperationalEvents ?? []);
  const whatsAppRateReferences = [...(input.whatsAppRateReferences ?? [])];
  const smsEmailIntegrationProfiles = sanitizeActorFields(input.smsEmailIntegrationProfiles ?? []);
  const smsEmailConsents = sanitizeActorFields(input.smsEmailConsents ?? []);
  const smsEmailConsentEvents = sanitizeActorFields(input.smsEmailConsentEvents ?? []);
  const smsEmailTemplateMappings = sanitizeActorFields(input.smsEmailTemplateMappings ?? []);
  const smsEmailOutboundBatches = sanitizeActorFields(input.smsEmailOutboundBatches ?? []);
  const smsEmailDeliveries = [...(input.smsEmailDeliveries ?? [])];
  const smsEmailDeliveryAttempts = [...(input.smsEmailDeliveryAttempts ?? [])];
  const smsEmailWebhookEvents = [...(input.smsEmailWebhookEvents ?? [])];
  const smsEmailOperationalEvents = sanitizeActorFields(input.smsEmailOperationalEvents ?? []);
  const smsEmailSuppressions = sanitizeActorFields(input.smsEmailSuppressions ?? []);
  const smsEmailCostRates = [...(input.smsEmailCostRates ?? [])];
  const aiAssistantProfiles = [...(input.aiAssistantProfiles ?? [])];
  const aiAssistantSourcePolicies = [...(input.aiAssistantSourcePolicies ?? [])];
  const aiAssistantQueryAudits = [...(input.aiAssistantQueryAudits ?? [])];
  const aiAssistantSafetyEvents = [...(input.aiAssistantSafetyEvents ?? [])];
  const aiAssistantEvaluationCases = [...(input.aiAssistantEvaluationCases ?? [])];
  const aiAssistantEvaluationRuns = [...(input.aiAssistantEvaluationRuns ?? [])];
  const feeRegisterOcrProfiles = sanitizeActorFields(input.feeRegisterOcrProfiles ?? []);
  const feeRegisterOcrBatches = sanitizeActorFields(input.feeRegisterOcrBatches ?? []);
  const feeRegisterOcrPages = (input.feeRegisterOcrPages ?? []).map((value) => {
    const { rawOcrText: _rawOcrText, ...safe } = value as Record<string, unknown>;
    return safe;
  });
  const feeRegisterOcrRows = sanitizeActorFields(input.feeRegisterOcrRows ?? []);
  const feeRegisterOcrRowRevisions = sanitizeActorFields(input.feeRegisterOcrRowRevisions ?? []);
  const feeRegisterOcrPostingRuns = sanitizeActorFields(input.feeRegisterOcrPostingRuns ?? []);
  const feeRegisterOcrEvents = sanitizeActorFields(input.feeRegisterOcrEvents ?? []);
  const cloudBackupProfiles = sanitizeCloudBackupRows(input.cloudBackupProfiles ?? []);
  const cloudBackupSchedules = sanitizeCloudBackupRows(input.cloudBackupSchedules ?? []);
  const cloudBackupRetentionPolicies = sanitizeCloudBackupRows(input.cloudBackupRetentionPolicies ?? []);
  const cloudBackupRuns = sanitizeCloudBackupRows(input.cloudBackupRuns ?? []);
  const cloudBackupArtifacts = sanitizeCloudBackupRows(input.cloudBackupArtifacts ?? []);
  const cloudBackupVerifications = sanitizeCloudBackupRows(input.cloudBackupVerifications ?? []);
  const cloudBackupRestoreRehearsals = sanitizeCloudBackupRows(input.cloudBackupRestoreRehearsals ?? []);
  const cloudBackupEvents = sanitizeCloudBackupRows(input.cloudBackupEvents ?? []);
  const publicWebsiteSettings = sanitizeActorFields(input.publicWebsiteSettings ?? []);
  const publicWebsitePages = sanitizeActorFields(input.publicWebsitePages ?? []);
  const publicWebsitePageVersions = sanitizeActorFields(input.publicWebsitePageVersions ?? []);
  const publicWebsitePosts = sanitizeActorFields(input.publicWebsitePosts ?? []);
  const publicWebsitePostVersions = sanitizeActorFields(input.publicWebsitePostVersions ?? []);
  const publicWebsiteNavigationItems = sanitizeActorFields(input.publicWebsiteNavigationItems ?? []);
  const publicWebsiteEvents = sanitizeActorFields(input.publicWebsiteEvents ?? []);
  return {
    metadata: {
      appName: APP_NAME,
      academicYear: input.academicYear ?? "2026-27",
      generatedAt: input.generatedAt.toISOString(),
      generatedBy: input.generatedBy,
      appVersion: packageJson.version,
      backupVersion: 37,
      counts: {
        schoolSettings: input.schoolSettings ? 1 : 0,
        authSecurityRecords: authSecurityRecordCount(authSecurity),
        iamAccessRecords: iamAccessRecordCount(iamAccess),
        rolePermissions: rolePermissions.length,
        guardians: guardians.length,
        studentGuardians: studentGuardians.length,
        notices: notices.length,
        staffMembers: staffMembers.length,
        studentAttendanceSessions: studentAttendanceSessions.length,
        studentAttendanceRecords: studentAttendanceRecords.length,
        staffAttendanceSessions: staffAttendanceSessions.length,
        staffAttendanceRecords: staffAttendanceRecords.length,
        staffLeaveRequests: staffLeaveRequests.length,
        substituteAssignments: substituteAssignments.length,
        academicYearEnrollments: academicYearEnrollments.length,
        studentLifecycleEvents: studentLifecycleEvents.length,
        studentProgressionDecisions: studentProgressionDecisions.length,
        vendors: vendors.length,
        expenseCategories: expenseCategories.length,
        expenseDepartments: expenseDepartments.length,
        expenseRecords: expenseRecords.length,
        expensePayments: expensePayments.length,
        expenseAudits: expenseAudits.length,
        budgetPlans: budgetPlans.length,
        budgetAllocations: budgetAllocations.length,
        budgetRevisions: budgetRevisions.length,
        miscIncomeItems: miscIncomeItems.length,
        miscIncomeRates: miscIncomeRates.length,
        miscIncomeReceipts: miscIncomeReceipts.length,
        miscIncomeReceiptLines: miscIncomeReceiptLines.length,
        cashBookDays: cashBookDays.length,
        cashBookMovements: cashBookMovements.length,
        bookCatalogItems: bookCatalogItems.length,
        bookCatalogRates: bookCatalogRates.length,
        bookSaleReceipts: bookSaleReceipts.length,
        bookSaleReceiptLines: bookSaleReceiptLines.length,
        bookCashSettlements: bookCashSettlements.length,
        libraryTitles: libraryTitles.length,
        libraryCopies: libraryCopies.length,
        libraryCopyEvents: libraryCopyEvents.length,
        libraryMembers: libraryMembers.length,
        libraryPolicies: libraryPolicies.length,
        libraryLoans: libraryLoans.length,
        libraryReservations: libraryReservations.length,
        libraryLoanEvents: libraryLoanEvents.length,
        libraryIncidents: libraryIncidents.length,
        libraryChargeRules: libraryChargeRules.length,
        libraryCharges: libraryCharges.length,
        libraryChargeEvents: libraryChargeEvents.length,
        libraryStockVerificationSessions: libraryStockVerificationSessions.length,
        libraryStockVerificationRecords: libraryStockVerificationRecords.length,
        libraryStockVerificationScanEvents: libraryStockVerificationScanEvents.length,
        libraryStockVerificationEvents: libraryStockVerificationEvents.length,
        homeworkAssignments: homeworkAssignments.length,
        homeworkAssignmentEvents: homeworkAssignmentEvents.length,
        classworkItems: classworkBackup.classworkItems.length,
        classworkItemVersions: classworkBackup.classworkItemVersions.length,
        classworkSubmissions: classworkBackup.classworkSubmissions.length,
        classworkSubmissionVersions: classworkBackup.classworkSubmissionVersions.length,
        classworkAttachments: classworkBackup.classworkAttachments.length,
        classworkFeedback: classworkBackup.classworkFeedback.length,
        classworkAuditEvents: classworkBackup.classworkAuditEvents.length,
        academicReportDefinitions: academicReportingBackup.academicReportDefinitions.length,
        academicReportRuns: academicReportingBackup.academicReportRuns.length,
        academicReportSourceReferences: academicReportingBackup.academicReportSourceReferences.length,
        academicReportAuditEvents: academicReportingBackup.academicReportAuditEvents.length,
        admissionCycles: admissionsBackup.admissionCycles.length,
        admissionEnquiries: admissionsBackup.admissionEnquiries.length,
        enquiryFollowUps: admissionsBackup.enquiryFollowUps.length,
        schoolVisits: admissionsBackup.schoolVisits.length,
        admissionApplications: admissionsBackup.admissionApplications.length,
        admissionApplicationVersions: admissionsBackup.admissionApplicationVersions.length,
        applicantChildren: admissionsBackup.applicantChildren.length,
        prospectiveGuardians: admissionsBackup.prospectiveGuardians.length,
        applicationDocuments: admissionsBackup.applicationDocuments.length,
        applicationReviews: admissionsBackup.applicationReviews.length,
        admissionDecisions: admissionsBackup.admissionDecisions.length,
        admissionOffers: admissionsBackup.admissionOffers.length,
        admissionDuplicateResolutions: admissionsBackup.admissionDuplicateResolutions.length,
        admissionConversions: admissionsBackup.admissionConversions.length,
        admissionEvents: admissionsBackup.admissionEvents.length,
        ...payrollCounts,
        ...payslipRequestCounts,
        examCycles: examCycles.length,
        examAssessments: examAssessments.length,
        studentMarks: studentMarks.length,
        studentMarkEvents: studentMarkEvents.length,
        examGovernanceRecords: examGovernanceRecordCount(examGovernance),
        gradingSchemes: gradingSchemes.length,
        gradeBands: gradeBands.length,
        reportCardTemplates: reportCardTemplates.length,
        reportCardBatches: reportCardBatches.length,
        reportCardBatchExamSources: reportCardBatchExamSources.length,
        studentReportCards: studentReportCards.length,
        studentReportCardVersions: studentReportCardVersions.length,
        academicCalendarVersions: academicCalendarVersions.length,
        operationalCalendarDays: operationalCalendarDays.length,
        schoolCalendarEvents: schoolCalendarEvents.length,
        schoolCalendarEventVersions: schoolCalendarEventVersions.length,
        academicCalendarAuditEvents: academicCalendarAuditEvents.length,
        studentReportCardEvents: studentReportCardEvents.length,
        teacherAnalyticsReviewCycles: teacherAnalyticsReviewCycles.length,
        teacherAnalyticsSnapshots: teacherAnalyticsSnapshots.length,
        teacherAnalyticsReviews: teacherAnalyticsReviews.length,
        teacherAnalyticsEvents: teacherAnalyticsEvents.length,
        certificateNumberSeries: certificateNumberSeries.length,
        certificateTemplates: certificateTemplates.length,
        studentCertificateRequests: studentCertificateRequests.length,
        studentCertificates: studentCertificates.length,
        studentCertificateVersions: studentCertificateVersions.length,
        studentCertificateEvents: studentCertificateEvents.length,
        classXPackageTemplates: classXPackageTemplates.length,
        classXDocumentPackages: classXDocumentPackages.length,
        classXPackageDocumentItems: classXPackageDocumentItems.length,
        classXPackageChargeRules: classXPackageChargeRules.length,
        classXPackageCharges: classXPackageCharges.length,
        classXPackageHandovers: classXPackageHandovers.length,
        classXPackageEvents: classXPackageEvents.length,
        identityCardNumberSeries: identityCardNumberSeries.length,
        identityCardTemplates: identityCardTemplates.length,
        identityCardBatches: identityCardBatches.length,
        identityCards: identityCards.length,
        identityCardVersions: identityCardVersions.length,
        identityCardEvents: identityCardEvents.length,
        notificationTemplates: notificationTemplates.length,
        notificationCampaigns: notificationCampaigns.length,
        notificationRecipients: notificationRecipients.length,
        notificationSkippedRecipients: notificationSkippedRecipients.length,
        notificationEvents: notificationEvents.length,
        whatsAppIntegrationProfiles: whatsAppIntegrationProfiles.length,
        whatsAppConsents: whatsAppConsents.length,
        whatsAppConsentEvents: whatsAppConsentEvents.length,
        whatsAppTemplateMappings: whatsAppTemplateMappings.length,
        whatsAppOutboundBatches: whatsAppOutboundBatches.length,
        whatsAppDeliveries: whatsAppDeliveries.length,
        whatsAppDeliveryAttempts: whatsAppDeliveryAttempts.length,
        whatsAppWebhookEvents: whatsAppWebhookEvents.length,
        whatsAppOperationalEvents: whatsAppOperationalEvents.length,
        whatsAppRateReferences: whatsAppRateReferences.length,
        smsEmailIntegrationProfiles: smsEmailIntegrationProfiles.length,
        smsEmailConsents: smsEmailConsents.length,
        smsEmailConsentEvents: smsEmailConsentEvents.length,
        smsEmailTemplateMappings: smsEmailTemplateMappings.length,
        smsEmailOutboundBatches: smsEmailOutboundBatches.length,
        smsEmailDeliveries: smsEmailDeliveries.length,
        smsEmailDeliveryAttempts: smsEmailDeliveryAttempts.length,
        smsEmailWebhookEvents: smsEmailWebhookEvents.length,
        smsEmailOperationalEvents: smsEmailOperationalEvents.length,
        smsEmailSuppressions: smsEmailSuppressions.length,
        smsEmailCostRates: smsEmailCostRates.length,
        aiAssistantProfiles: aiAssistantProfiles.length,
        aiAssistantSourcePolicies: aiAssistantSourcePolicies.length,
        aiAssistantQueryAudits: aiAssistantQueryAudits.length,
        aiAssistantSafetyEvents: aiAssistantSafetyEvents.length,
        aiAssistantEvaluationCases: aiAssistantEvaluationCases.length,
        aiAssistantEvaluationRuns: aiAssistantEvaluationRuns.length,
        feeRegisterOcrProfiles: feeRegisterOcrProfiles.length,
        feeRegisterOcrBatches: feeRegisterOcrBatches.length,
        feeRegisterOcrPages: feeRegisterOcrPages.length,
        feeRegisterOcrRows: feeRegisterOcrRows.length,
        feeRegisterOcrRowRevisions: feeRegisterOcrRowRevisions.length,
        feeRegisterOcrPostingRuns: feeRegisterOcrPostingRuns.length,
        feeRegisterOcrEvents: feeRegisterOcrEvents.length,
        cloudBackupProfiles: cloudBackupProfiles.length,
        cloudBackupSchedules: cloudBackupSchedules.length,
        cloudBackupRetentionPolicies: cloudBackupRetentionPolicies.length,
        cloudBackupRuns: cloudBackupRuns.length,
        cloudBackupArtifacts: cloudBackupArtifacts.length,
        cloudBackupVerifications: cloudBackupVerifications.length,
        cloudBackupRestoreRehearsals: cloudBackupRestoreRehearsals.length,
        cloudBackupEvents: cloudBackupEvents.length,
        publicWebsiteSettings: publicWebsiteSettings.length,
        publicWebsitePages: publicWebsitePages.length,
        publicWebsitePageVersions: publicWebsitePageVersions.length,
        publicWebsitePosts: publicWebsitePosts.length,
        publicWebsitePostVersions: publicWebsitePostVersions.length,
        publicWebsiteNavigationItems: publicWebsiteNavigationItems.length,
        publicWebsiteEvents: publicWebsiteEvents.length,
        ...familyCollectionCounts,
        timetableTeachers: timetableTeachers.length,
        timetableSubjects: timetableSubjects.length,
        timetableClassSections: timetableClassSections.length,
        timetablePeriodTemplates: timetablePeriodTemplates.length,
        timetableAssignments: timetableAssignments.length,
        timetableDrafts: timetableDrafts.length,
        timetableEntries: timetableEntries.length
      }
    },
    schoolSettings: input.schoolSettings ?? null,
    students: [...input.students],
    feeStructures: [...input.feeStructures],
    payments: [...input.payments],
    paymentAudits: [...input.paymentAudits],
    ...familyCollectionBackup,
    users: sanitizeUsers(input.users),
    authSecurity,
    iamAccess,
    rolePermissions,
    guardians,
    studentGuardians,
    notices,
    staffMembers,
    studentAttendanceSessions,
    studentAttendanceRecords,
    staffAttendanceSessions,
    staffAttendanceRecords,
    staffLeaveRequests,
    substituteAssignments,
    academicYearEnrollments,
    studentLifecycleEvents,
    studentProgressionDecisions,
    vendors,
    expenseCategories,
    expenseDepartments,
    expenseRecords,
    expensePayments,
    expenseAudits,
    budgetPlans,
    budgetAllocations,
    budgetRevisions,
    miscIncomeItems,
    miscIncomeRates,
    miscIncomeReceipts,
    miscIncomeReceiptLines,
    cashBookDays,
    cashBookMovements,
    bookCatalogItems,
    bookCatalogRates,
    bookSaleReceipts,
    bookSaleReceiptLines,
    bookCashSettlements,
    libraryTitles,
    libraryCopies,
    libraryCopyEvents,
    libraryMembers,
    libraryPolicies,
    libraryLoans,
    libraryReservations,
    libraryLoanEvents,
    libraryIncidents,
    libraryChargeRules,
    libraryCharges,
    libraryChargeEvents,
    libraryStockVerificationSessions,
    libraryStockVerificationRecords,
    libraryStockVerificationScanEvents,
    libraryStockVerificationEvents,
    homeworkAssignments,
    homeworkAssignmentEvents,
    ...classworkBackup,
    ...academicReportingBackup,
    ...admissionsBackup,
    ...payrollBackup,
    ...payslipRequestBackup,
    examCycles,
    examAssessments,
    studentMarks,
    studentMarkEvents,
    examGovernance,
    gradingSchemes,
    gradeBands,
    reportCardTemplates,
    reportCardBatches,
    reportCardBatchExamSources,
    studentReportCards,
    studentReportCardVersions,
    studentReportCardEvents,
    academicCalendarVersions,
    operationalCalendarDays,
    schoolCalendarEvents,
    schoolCalendarEventVersions,
    academicCalendarAuditEvents,
    teacherAnalyticsReviewCycles,
    teacherAnalyticsSnapshots,
    teacherAnalyticsReviews,
    teacherAnalyticsEvents,
    certificateNumberSeries,
    certificateTemplates,
    studentCertificateRequests,
    studentCertificates,
    studentCertificateVersions,
    studentCertificateEvents,
    classXPackageTemplates,
    classXDocumentPackages,
    classXPackageDocumentItems,
    classXPackageChargeRules,
    classXPackageCharges,
    classXPackageHandovers,
    classXPackageEvents,
    identityCardNumberSeries,
    identityCardTemplates,
    identityCardBatches,
    identityCards,
    identityCardVersions,
    identityCardEvents,
    notificationTemplates,
    notificationCampaigns,
    notificationRecipients,
    notificationSkippedRecipients,
    notificationEvents,
    whatsAppIntegrationProfiles,
    whatsAppConsents,
    whatsAppConsentEvents,
    whatsAppTemplateMappings,
    whatsAppOutboundBatches,
    whatsAppDeliveries,
    whatsAppDeliveryAttempts,
    whatsAppWebhookEvents,
    whatsAppOperationalEvents,
    whatsAppRateReferences,
    smsEmailIntegrationProfiles,
    smsEmailConsents,
    smsEmailConsentEvents,
    smsEmailTemplateMappings,
    smsEmailOutboundBatches,
    smsEmailDeliveries,
    smsEmailDeliveryAttempts,
    smsEmailWebhookEvents,
    smsEmailOperationalEvents,
    smsEmailSuppressions,
    smsEmailCostRates,
    aiAssistantProfiles,
    aiAssistantSourcePolicies,
    aiAssistantQueryAudits,
    aiAssistantSafetyEvents,
    aiAssistantEvaluationCases,
    aiAssistantEvaluationRuns,
    feeRegisterOcrProfiles,
    feeRegisterOcrBatches,
    feeRegisterOcrPages,
    feeRegisterOcrRows,
    feeRegisterOcrRowRevisions,
    feeRegisterOcrPostingRuns,
    feeRegisterOcrEvents,
    cloudBackupProfiles,
    cloudBackupSchedules,
    cloudBackupRetentionPolicies,
    cloudBackupRuns,
    cloudBackupArtifacts,
    cloudBackupVerifications,
    cloudBackupRestoreRehearsals,
    cloudBackupEvents,
    publicWebsiteSettings,
    publicWebsitePages,
    publicWebsitePageVersions,
    publicWebsitePosts,
    publicWebsitePostVersions,
    publicWebsiteNavigationItems,
    publicWebsiteEvents,
    receiptNotes: [...(input.receiptNotes ?? [])],
    importBatches: [...(input.importBatches ?? [])],
    goLiveChecklist: [...(input.goLiveChecklist ?? [])],
    timetableTeachers,
    timetableSubjects,
    timetableClassSections,
    timetablePeriodTemplates,
    timetableAssignments,
    timetableTeacherUnavailability: [...(input.timetableTeacherUnavailability ?? [])],
    timetableFixedPeriods: [...(input.timetableFixedPeriods ?? [])],
    timetableDrafts,
    timetableEntries
  };
}

async function sqliteSchemaHas(client: BackupClient, table: string, column?: string) {
  const query = (client as any).$queryRawUnsafe;
  if (typeof query !== "function") return true;
  const allowedTables = new Set(["StudentAttendanceSession", "StudentReportCardVersion", "AcademicCalendarVersion", "ClassworkItem", "AcademicReportDefinition", "AdmissionCycle", "PayrollPolicyVersion", "StaffPayslipRequest"]);
  if (!allowedTables.has(table)) throw new Error("BACKUP_SCHEMA_PROBE_REFUSED");
  const rows = await query.call(client, `PRAGMA table_info("${table}")`) as Array<{ name?: string }>;
  return column ? rows.some((row) => row.name === column) : rows.length > 0;
}

export async function generateFullBackup(
  client: BackupClient,
  options: { generatedBy: string; generatedAt?: Date; excludeCloudBackupRunId?: string }
) {
  const [attendanceCalendarBasisAvailable, reportCalendarBasisAvailable, academicCalendarAvailable, classworkAvailable, academicReportingAvailable, admissionsAvailable, payrollAvailable, payslipRequestAvailable] = await Promise.all([
    sqliteSchemaHas(client, "StudentAttendanceSession", "operationalCalendarVersionKey"),
    sqliteSchemaHas(client, "StudentReportCardVersion", "calendarBasisVersionKey"),
    sqliteSchemaHas(client, "AcademicCalendarVersion"),
    sqliteSchemaHas(client, "ClassworkItem"),
    sqliteSchemaHas(client, "AcademicReportDefinition"),
    sqliteSchemaHas(client, "AdmissionCycle"),
    sqliteSchemaHas(client, "PayrollPolicyVersion"),
    sqliteSchemaHas(client, "StaffPayslipRequest")
  ]);
  const studentAttendanceSessionArgs = {
    select: {
      id: true, attendanceDate: true, className: true, section: true, academicYear: true,
      status: true, takenByUserId: true, submittedByUserId: true, lockedByUserId: true,
      submittedAt: true, lockedAt: true, notes: true, createdAt: true, updatedAt: true,
      ...(attendanceCalendarBasisAvailable ? {
        operationalCalendarVersionKey: true,
        operationalCalendarDayKey: true,
        calendarBasisSnapshotJson: true
      } : {})
    },
    orderBy: [{ attendanceDate: "asc" }, { className: "asc" }, { section: "asc" }]
  };
  const studentReportCardVersionArgs = {
    select: {
      id: true, reportCardId: true, versionNumber: true, versionType: true, snapshotJson: true,
      correctionReason: true, issuedAt: true, issuedByUserId: true, supersedesVersionId: true, createdAt: true,
      ...(reportCalendarBasisAvailable ? { calendarBasisVersionKey: true, calendarBasisSnapshotJson: true } : {})
    },
    orderBy: [{ reportCardId: "asc" }, { versionNumber: "asc" }]
  };
  const [
    students,
    feeStructures,
    payments,
    paymentAudits,
    users,
    rolePermissions,
    guardians,
    studentGuardians,
    notices,
    staffMembers,
    studentAttendanceSessions,
    studentAttendanceRecords,
    staffAttendanceSessions,
    staffAttendanceRecords,
    staffLeaveRequests,
    substituteAssignments,
    academicYearEnrollments,
    studentLifecycleEvents,
    studentProgressionDecisions,
    vendors,
    expenseCategories,
    expenseDepartments,
    expenseRecords,
    expensePayments,
    expenseAudits,
    budgetPlans,
    budgetAllocations,
    budgetRevisions,
    miscIncomeItems,
    miscIncomeRates,
    miscIncomeReceipts,
    miscIncomeReceiptLines,
    cashBookDays,
    cashBookMovements,
    bookCatalogItems,
    bookCatalogRates,
    bookSaleReceipts,
    bookSaleReceiptLines,
    bookCashSettlements,
    libraryTitles,
    libraryCopies,
    libraryCopyEvents,
    libraryMembers,
    libraryPolicies,
    libraryLoans,
    libraryReservations,
    libraryLoanEvents,
    libraryIncidents,
    libraryChargeRules,
    libraryCharges,
    libraryChargeEvents,
    libraryStockVerificationSessions,
    libraryStockVerificationRecords,
    libraryStockVerificationScanEvents,
    libraryStockVerificationEvents,
    homeworkAssignments,
    homeworkAssignmentEvents,
    examCycles,
    examAssessments,
    studentMarks,
    studentMarkEvents,
    gradingSchemes,
    gradeBands,
    reportCardTemplates,
    reportCardBatches,
    reportCardBatchExamSources,
    studentReportCards,
    studentReportCardVersions,
    studentReportCardEvents,
    teacherAnalyticsReviewCycles,
    teacherAnalyticsSnapshots,
    teacherAnalyticsReviews,
    teacherAnalyticsEvents,
    certificateNumberSeries,
    certificateTemplates,
    studentCertificateRequests,
    studentCertificates,
    studentCertificateVersions,
    studentCertificateEvents,
    classXPackageTemplates,
    classXDocumentPackages,
    classXPackageDocumentItems,
    classXPackageChargeRules,
    classXPackageCharges,
    classXPackageHandovers,
    classXPackageEvents,
    identityCardNumberSeries,
    identityCardTemplates,
    identityCardBatches,
    identityCards,
    identityCardVersions,
    identityCardEvents,
    notificationTemplates,
    notificationCampaigns,
    notificationRecipients,
    notificationSkippedRecipients,
    notificationEvents,
    whatsAppIntegrationProfiles,
    whatsAppConsents,
    whatsAppConsentEvents,
    whatsAppTemplateMappings,
    whatsAppOutboundBatches,
    whatsAppDeliveries,
    whatsAppDeliveryAttempts,
    whatsAppWebhookEvents,
    whatsAppOperationalEvents,
    whatsAppRateReferences,
    smsEmailIntegrationProfiles,
    smsEmailConsents,
    smsEmailConsentEvents,
    smsEmailTemplateMappings,
    smsEmailOutboundBatches,
    smsEmailDeliveries,
    smsEmailDeliveryAttempts,
    smsEmailWebhookEvents,
    smsEmailOperationalEvents,
    smsEmailSuppressions,
    smsEmailCostRates,
    aiAssistantProfiles,
    aiAssistantSourcePolicies,
    aiAssistantQueryAudits,
    aiAssistantSafetyEvents,
    aiAssistantEvaluationCases,
    aiAssistantEvaluationRuns,
    feeRegisterOcrProfiles,
    feeRegisterOcrBatches,
    feeRegisterOcrPages,
    feeRegisterOcrRows,
    feeRegisterOcrRowRevisions,
    feeRegisterOcrPostingRuns,
    feeRegisterOcrEvents,
    cloudBackupProfiles,
    cloudBackupSchedules,
    cloudBackupRetentionPolicies,
    cloudBackupRuns,
    cloudBackupArtifacts,
    cloudBackupVerifications,
    cloudBackupRestoreRehearsals,
    cloudBackupEvents,
    publicWebsiteSettings,
    publicWebsitePages,
    publicWebsitePageVersions,
    publicWebsitePosts,
    publicWebsitePostVersions,
    publicWebsiteNavigationItems,
    publicWebsiteEvents,
    receiptNotes,
    importBatches,
    goLiveChecklist,
    timetableTeachers,
    timetableSubjects,
    timetableClassSections,
    timetablePeriodTemplates,
    timetableAssignments,
    timetableTeacherUnavailability,
    timetableFixedPeriods,
    timetableDrafts,
    timetableEntries,
    authSecurityAliases,
    authVerificationHistory,
    authResetHistory,
    authSessions,
    authSecurityEvents,
    examGovernance,
    settings
  ] = await Promise.all([
    client.student.findMany({ orderBy: { createdAt: "asc" } }),
    client.feeStructure.findMany({ orderBy: [{ academicYear: "asc" }, { className: "asc" }] }),
    client.payment.findMany({ orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    client.paymentAudit.findMany({ orderBy: { createdAt: "asc" } }),
    client.user.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        guardianId: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: "asc" }
    }),
    client.rolePermission.findMany({ orderBy: [{ role: "asc" }, { permission: "asc" }] }),
    client.guardian.findMany({ orderBy: [{ displayName: "asc" }, { primaryMobile: "asc" }] }),
    client.studentGuardian.findMany({ orderBy: [{ guardianId: "asc" }, { studentId: "asc" }] }),
    client.notice.findMany({ orderBy: [{ createdAt: "asc" }] }),
    client.staffMember.findMany({ orderBy: [{ fullName: "asc" }] }),
    client.studentAttendanceSession.findMany(studentAttendanceSessionArgs as never),
    client.studentAttendanceRecord.findMany({ orderBy: [{ sessionId: "asc" }, { admissionNo: "asc" }] }),
    client.staffAttendanceSession.findMany({ orderBy: [{ attendanceDate: "asc" }] }),
    client.staffAttendanceRecord.findMany({ orderBy: [{ sessionId: "asc" }, { staffCode: "asc" }] }),
    client.staffLeaveRequest.findMany({ orderBy: [{ startDate: "asc" }, { createdAt: "asc" }] }),
    client.substituteAssignment.findMany({ orderBy: [{ assignmentDate: "asc" }, { createdAt: "asc" }] }),
    client.academicYearEnrollment.findMany({ orderBy: [{ academicYear: "asc" }, { className: "asc" }, { section: "asc" }, { createdAt: "asc" }] }),
    client.studentLifecycleEvent.findMany({ orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }] }),
    client.studentProgressionDecision.findMany({ orderBy: [{ createdAt: "asc" }] }),
    client.vendor.findMany({ orderBy: [{ vendorCode: "asc" }] }),
    client.expenseCategory.findMany({ orderBy: [{ name: "asc" }] }),
    client.expenseDepartment.findMany({ orderBy: [{ name: "asc" }] }),
    client.expenseRecord.findMany({ orderBy: [{ expenseDate: "asc" }, { expenseNumber: "asc" }] }),
    client.expensePayment.findMany({ orderBy: [{ expenseRecordId: "asc" }, { paymentDate: "asc" }] }),
    client.expenseAudit.findMany({ orderBy: [{ expenseRecordId: "asc" }, { createdAt: "asc" }] }),
    client.budgetPlan.findMany({ orderBy: [{ academicYear: "asc" }, { budgetNumber: "asc" }] }),
    client.budgetAllocation.findMany({ orderBy: [{ budgetPlanId: "asc" }, { createdAt: "asc" }] }),
    client.budgetRevision.findMany({ orderBy: [{ budgetPlanId: "asc" }, { revisionNumber: "asc" }] }),
    client.miscIncomeItem.findMany({ orderBy: [{ itemCode: "asc" }] }),
    client.miscIncomeRate.findMany({ orderBy: [{ itemId: "asc" }, { academicYear: "asc" }, { effectiveFrom: "asc" }] }),
    client.miscIncomeReceipt.findMany({ orderBy: [{ receiptDate: "asc" }, { receiptNumber: "asc" }] }),
    client.miscIncomeReceiptLine.findMany({ orderBy: [{ receiptId: "asc" }, { createdAt: "asc" }] }),
    client.cashBookDay.findMany({ orderBy: [{ cashDate: "asc" }] }),
    client.cashBookMovement.findMany({ orderBy: [{ cashBookDayId: "asc" }, { createdAt: "asc" }] }),
    (client as any).bookCatalogItem?.findMany ? (client as any).bookCatalogItem.findMany({ orderBy: [{ itemCode: "asc" }] }) : Promise.resolve([]),
    (client as any).bookCatalogRate?.findMany ? (client as any).bookCatalogRate.findMany({ orderBy: [{ itemId: "asc" }, { academicYear: "asc" }, { effectiveFrom: "asc" }] }) : Promise.resolve([]),
    (client as any).bookSaleReceipt?.findMany ? (client as any).bookSaleReceipt.findMany({ orderBy: [{ receiptDate: "asc" }, { receiptNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).bookSaleReceiptLine?.findMany ? (client as any).bookSaleReceiptLine.findMany({ orderBy: [{ receiptId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).bookCashSettlement?.findMany ? (client as any).bookCashSettlement.findMany({ orderBy: [{ settlementDate: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryTitle?.findMany ? (client as any).libraryTitle.findMany({ orderBy: [{ titleCode: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryCopy?.findMany ? (client as any).libraryCopy.findMany({ orderBy: [{ accessionNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryCopyEvent?.findMany ? (client as any).libraryCopyEvent.findMany({ orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryMember?.findMany ? (client as any).libraryMember.findMany({ orderBy: [{ memberCode: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryPolicy?.findMany ? (client as any).libraryPolicy.findMany({ orderBy: [{ memberType: "asc" }, { priority: "desc" }, { policyCode: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryLoan?.findMany ? (client as any).libraryLoan.findMany({ orderBy: [{ issueDate: "asc" }, { loanNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryReservation?.findMany ? (client as any).libraryReservation.findMany({ orderBy: [{ requestedDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryLoanEvent?.findMany ? (client as any).libraryLoanEvent.findMany({ orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryIncident?.findMany ? (client as any).libraryIncident.findMany({ orderBy: [{ reportedDate: "asc" }, { incidentNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryChargeRule?.findMany ? (client as any).libraryChargeRule.findMany({ orderBy: [{ memberType: "asc" }, { priority: "desc" }, { ruleCode: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryCharge?.findMany ? (client as any).libraryCharge.findMany({ orderBy: [{ assessedDate: "asc" }, { chargeNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryChargeEvent?.findMany ? (client as any).libraryChargeEvent.findMany({ orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryStockVerificationSession?.findMany ? (client as any).libraryStockVerificationSession.findMany({ orderBy: [{ verificationDate: "asc" }, { sessionNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryStockVerificationRecord?.findMany ? (client as any).libraryStockVerificationRecord.findMany({ orderBy: [{ sessionId: "asc" }, { expectedAccessionNumberSnapshot: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryStockVerificationScanEvent?.findMany ? (client as any).libraryStockVerificationScanEvent.findMany({ orderBy: [{ sessionId: "asc" }, { scannedAt: "asc" }] }) : Promise.resolve([]),
    (client as any).libraryStockVerificationEvent?.findMany ? (client as any).libraryStockVerificationEvent.findMany({ orderBy: [{ sessionId: "asc" }, { eventDate: "asc" }] }) : Promise.resolve([]),
    (client as any).homeworkAssignment?.findMany ? (client as any).homeworkAssignment.findMany({ orderBy: [{ assignedDate: "asc" }, { assignmentNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).homeworkAssignmentEvent?.findMany ? (client as any).homeworkAssignmentEvent.findMany({ orderBy: [{ assignmentId: "asc" }, { eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).examCycle?.findMany ? (client as any).examCycle.findMany({ orderBy: [{ startDate: "asc" }, { examCode: "asc" }] }) : Promise.resolve([]),
    (client as any).examAssessment?.findMany ? (client as any).examAssessment.findMany({ orderBy: [{ examCycleId: "asc" }, { className: "asc" }, { section: "asc" }, { subjectName: "asc" }] }) : Promise.resolve([]),
    (client as any).studentMark?.findMany ? (client as any).studentMark.findMany({ orderBy: [{ assessmentId: "asc" }, { studentId: "asc" }] }) : Promise.resolve([]),
    (client as any).studentMarkEvent?.findMany ? (client as any).studentMarkEvent.findMany({ orderBy: [{ assessmentId: "asc" }, { eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).gradingScheme?.findMany ? (client as any).gradingScheme.findMany({ orderBy: [{ schemeCode: "asc" }] }) : Promise.resolve([]),
    (client as any).gradeBand?.findMany ? (client as any).gradeBand.findMany({ orderBy: [{ gradingSchemeId: "asc" }, { displayOrder: "asc" }] }) : Promise.resolve([]),
    (client as any).reportCardTemplate?.findMany ? (client as any).reportCardTemplate.findMany({ orderBy: [{ templateCode: "asc" }] }) : Promise.resolve([]),
    (client as any).reportCardBatch?.findMany ? (client as any).reportCardBatch.findMany({ orderBy: [{ academicYear: "asc" }, { batchNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).reportCardBatchExamSource?.findMany ? (client as any).reportCardBatchExamSource.findMany({ orderBy: [{ batchId: "asc" }, { displayOrder: "asc" }] }) : Promise.resolve([]),
    (client as any).studentReportCard?.findMany ? (client as any).studentReportCard.findMany({ orderBy: [{ batchId: "asc" }, { reportCardNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).studentReportCardVersion?.findMany ? (client as any).studentReportCardVersion.findMany(studentReportCardVersionArgs) : Promise.resolve([]),
    (client as any).studentReportCardEvent?.findMany ? (client as any).studentReportCardEvent.findMany({ orderBy: [{ reportCardId: "asc" }, { eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).teacherAnalyticsReviewCycle?.findMany ? (client as any).teacherAnalyticsReviewCycle.findMany({ orderBy: [{ periodStart: "asc" }, { cycleCode: "asc" }] }) : Promise.resolve([]),
    (client as any).teacherAnalyticsSnapshot?.findMany ? (client as any).teacherAnalyticsSnapshot.findMany({ orderBy: [{ reviewCycleId: "asc" }, { staffMemberId: "asc" }] }) : Promise.resolve([]),
    (client as any).teacherAnalyticsReview?.findMany ? (client as any).teacherAnalyticsReview.findMany({ orderBy: [{ snapshotId: "asc" }] }) : Promise.resolve([]),
    (client as any).teacherAnalyticsEvent?.findMany ? (client as any).teacherAnalyticsEvent.findMany({ orderBy: [{ reviewCycleId: "asc" }, { eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).certificateNumberSeries?.findMany ? (client as any).certificateNumberSeries.findMany({ orderBy: [{ certificateType: "asc" }, { seriesCode: "asc" }] }) : Promise.resolve([]),
    (client as any).certificateTemplate?.findMany ? (client as any).certificateTemplate.findMany({ orderBy: [{ certificateType: "asc" }, { templateCode: "asc" }] }) : Promise.resolve([]),
    (client as any).studentCertificateRequest?.findMany ? (client as any).studentCertificateRequest.findMany({ orderBy: [{ createdAt: "asc" }, { requestNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).studentCertificate?.findMany ? (client as any).studentCertificate.findMany({ orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).studentCertificateVersion?.findMany ? (client as any).studentCertificateVersion.findMany({ orderBy: [{ certificateId: "asc" }, { versionNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).studentCertificateEvent?.findMany ? (client as any).studentCertificateEvent.findMany({ orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).classXPackageTemplate?.findMany ? (client as any).classXPackageTemplate.findMany({ orderBy: [{ templateCode: "asc" }] }) : Promise.resolve([]),
    (client as any).classXDocumentPackage?.findMany ? (client as any).classXDocumentPackage.findMany({ orderBy: [{ createdAt: "asc" }, { packageNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).classXPackageDocumentItem?.findMany ? (client as any).classXPackageDocumentItem.findMany({ orderBy: [{ packageId: "asc" }, { displayOrder: "asc" }] }) : Promise.resolve([]),
    (client as any).classXPackageChargeRule?.findMany ? (client as any).classXPackageChargeRule.findMany({ orderBy: [{ ruleCode: "asc" }] }) : Promise.resolve([]),
    (client as any).classXPackageCharge?.findMany ? (client as any).classXPackageCharge.findMany({ orderBy: [{ createdAt: "asc" }, { chargeCode: "asc" }] }) : Promise.resolve([]),
    (client as any).classXPackageHandover?.findMany ? (client as any).classXPackageHandover.findMany({ orderBy: [{ handoverDate: "asc" }, { handoverNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).classXPackageEvent?.findMany ? (client as any).classXPackageEvent.findMany({ orderBy: [{ packageId: "asc" }, { eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).identityCardNumberSeries?.findMany ? (client as any).identityCardNumberSeries.findMany({ orderBy: [{ cardType: "asc" }, { seriesCode: "asc" }] }) : Promise.resolve([]),
    (client as any).identityCardTemplate?.findMany ? (client as any).identityCardTemplate.findMany({ orderBy: [{ cardType: "asc" }, { templateCode: "asc" }] }) : Promise.resolve([]),
    (client as any).identityCardBatch?.findMany ? (client as any).identityCardBatch.findMany({ orderBy: [{ createdAt: "asc" }, { batchNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).identityCard?.findMany ? (client as any).identityCard.findMany({ orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).identityCardVersion?.findMany ? (client as any).identityCardVersion.findMany({ orderBy: [{ identityCardId: "asc" }, { versionNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).identityCardEvent?.findMany ? (client as any).identityCardEvent.findMany({ orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).notificationTemplate?.findMany ? (client as any).notificationTemplate.findMany({ orderBy: [{ createdAt: "asc" }, { templateCode: "asc" }] }) : Promise.resolve([]),
    (client as any).notificationCampaign?.findMany ? (client as any).notificationCampaign.findMany({ orderBy: [{ createdAt: "asc" }, { campaignNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).notificationRecipient?.findMany ? (client as any).notificationRecipient.findMany({ orderBy: [{ campaignId: "asc" }, { userId: "asc" }] }) : Promise.resolve([]),
    (client as any).notificationSkippedRecipient?.findMany ? (client as any).notificationSkippedRecipient.findMany({ orderBy: [{ campaignId: "asc" }, { reasonCode: "asc" }] }) : Promise.resolve([]),
    (client as any).notificationEvent?.findMany ? (client as any).notificationEvent.findMany({ orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).whatsAppIntegrationProfile?.findMany ? (client as any).whatsAppIntegrationProfile.findMany({ orderBy: [{ profileCode: "asc" }] }) : Promise.resolve([]),
    (client as any).whatsAppConsent?.findMany ? (client as any).whatsAppConsent.findMany({ orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).whatsAppConsentEvent?.findMany ? (client as any).whatsAppConsentEvent.findMany({ orderBy: [{ consentId: "asc" }, { eventDate: "asc" }] }) : Promise.resolve([]),
    (client as any).whatsAppTemplateMapping?.findMany ? (client as any).whatsAppTemplateMapping.findMany({ orderBy: [{ mappingCode: "asc" }] }) : Promise.resolve([]),
    (client as any).whatsAppOutboundBatch?.findMany ? (client as any).whatsAppOutboundBatch.findMany({ orderBy: [{ createdAt: "asc" }, { batchNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).whatsAppDelivery?.findMany ? (client as any).whatsAppDelivery.findMany({ orderBy: [{ batchId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).whatsAppDeliveryAttempt?.findMany ? (client as any).whatsAppDeliveryAttempt.findMany({ orderBy: [{ deliveryId: "asc" }, { attemptNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).whatsAppWebhookEvent?.findMany ? (client as any).whatsAppWebhookEvent.findMany({ orderBy: [{ receivedAt: "asc" }] }) : Promise.resolve([]),
    (client as any).whatsAppOperationalEvent?.findMany ? (client as any).whatsAppOperationalEvent.findMany({ orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).whatsAppRateReference?.findMany ? (client as any).whatsAppRateReference.findMany({ orderBy: [{ effectiveDate: "asc" }, { templateCategory: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailIntegrationProfile?.findMany ? (client as any).smsEmailIntegrationProfile.findMany({ orderBy: [{ channel: "asc" }, { profileCode: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailConsent?.findMany ? (client as any).smsEmailConsent.findMany({ orderBy: [{ channel: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailConsentEvent?.findMany ? (client as any).smsEmailConsentEvent.findMany({ orderBy: [{ consentId: "asc" }, { eventDate: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailTemplateMapping?.findMany ? (client as any).smsEmailTemplateMapping.findMany({ orderBy: [{ channel: "asc" }, { mappingCode: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailOutboundBatch?.findMany ? (client as any).smsEmailOutboundBatch.findMany({ orderBy: [{ createdAt: "asc" }, { batchNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailDelivery?.findMany ? (client as any).smsEmailDelivery.findMany({ orderBy: [{ batchId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailDeliveryAttempt?.findMany ? (client as any).smsEmailDeliveryAttempt.findMany({ orderBy: [{ deliveryId: "asc" }, { attemptNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailWebhookEvent?.findMany ? (client as any).smsEmailWebhookEvent.findMany({ orderBy: [{ receivedAt: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailOperationalEvent?.findMany ? (client as any).smsEmailOperationalEvent.findMany({ orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailSuppression?.findMany ? (client as any).smsEmailSuppression.findMany({ orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).smsEmailCostRate?.findMany ? (client as any).smsEmailCostRate.findMany({ orderBy: [{ effectiveFrom: "asc" }, { channel: "asc" }] }) : Promise.resolve([]),
    (client as any).aiAssistantProfile?.findMany ? (client as any).aiAssistantProfile.findMany({ orderBy: [{ profileCode: "asc" }] }) : Promise.resolve([]),
    (client as any).aiAssistantSourcePolicy?.findMany ? (client as any).aiAssistantSourcePolicy.findMany({ orderBy: [{ sourceType: "asc" }, { sourceKey: "asc" }] }) : Promise.resolve([]),
    (client as any).aiAssistantQueryAudit?.findMany ? (client as any).aiAssistantQueryAudit.findMany({ orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).aiAssistantSafetyEvent?.findMany ? (client as any).aiAssistantSafetyEvent.findMany({ orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).aiAssistantEvaluationCase?.findMany ? (client as any).aiAssistantEvaluationCase.findMany({ orderBy: [{ caseCode: "asc" }] }) : Promise.resolve([]),
    (client as any).aiAssistantEvaluationRun?.findMany ? (client as any).aiAssistantEvaluationRun.findMany({ orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).feeRegisterOcrProfile?.findMany ? (client as any).feeRegisterOcrProfile.findMany({ orderBy: [{ profileCode: "asc" }] }) : Promise.resolve([]),
    (client as any).feeRegisterOcrBatch?.findMany ? (client as any).feeRegisterOcrBatch.findMany({ orderBy: [{ createdAt: "asc" }, { batchNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).feeRegisterOcrPage?.findMany ? (client as any).feeRegisterOcrPage.findMany({ orderBy: [{ batchId: "asc" }, { pageNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).feeRegisterOcrRow?.findMany ? (client as any).feeRegisterOcrRow.findMany({ orderBy: [{ pageId: "asc" }, { rowNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).feeRegisterOcrRowRevision?.findMany ? (client as any).feeRegisterOcrRowRevision.findMany({ orderBy: [{ rowId: "asc" }, { revisionNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).feeRegisterOcrPostingRun?.findMany ? (client as any).feeRegisterOcrPostingRun.findMany({ orderBy: [{ batchId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).feeRegisterOcrEvent?.findMany ? (client as any).feeRegisterOcrEvent.findMany({ orderBy: [{ batchId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).cloudBackupProfile?.findMany ? (client as any).cloudBackupProfile.findMany({ orderBy: [{ profileCode: "asc" }] }) : Promise.resolve([]),
    (client as any).cloudBackupSchedule?.findMany ? (client as any).cloudBackupSchedule.findMany({ orderBy: [{ scheduleCode: "asc" }] }) : Promise.resolve([]),
    (client as any).cloudBackupRetentionPolicy?.findMany ? (client as any).cloudBackupRetentionPolicy.findMany({ orderBy: [{ policyCode: "asc" }] }) : Promise.resolve([]),
    (client as any).cloudBackupRun?.findMany ? (client as any).cloudBackupRun.findMany({ where: { completedAt: { not: null }, ...(options.excludeCloudBackupRunId ? { id: { not: options.excludeCloudBackupRunId } } : {}) }, orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).cloudBackupArtifact?.findMany ? (client as any).cloudBackupArtifact.findMany({ where: { run: { completedAt: { not: null }, ...(options.excludeCloudBackupRunId ? { id: { not: options.excludeCloudBackupRunId } } : {}) } }, orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).cloudBackupVerification?.findMany ? (client as any).cloudBackupVerification.findMany({ where: { run: { completedAt: { not: null }, ...(options.excludeCloudBackupRunId ? { id: { not: options.excludeCloudBackupRunId } } : {}) } }, orderBy: [{ checkedAt: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).cloudBackupRestoreRehearsal?.findMany ? (client as any).cloudBackupRestoreRehearsal.findMany({ where: { run: { completedAt: { not: null }, ...(options.excludeCloudBackupRunId ? { id: { not: options.excludeCloudBackupRunId } } : {}) } }, orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).cloudBackupEvent?.findMany ? (client as any).cloudBackupEvent.findMany({ where: { OR: [{ runId: null }, { run: { completedAt: { not: null }, ...(options.excludeCloudBackupRunId ? { id: { not: options.excludeCloudBackupRunId } } : {}) } }] }, orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).publicWebsiteSettings?.findMany ? (client as any).publicWebsiteSettings.findMany({ orderBy: [{ settingsCode: "asc" }] }) : Promise.resolve([]),
    (client as any).publicWebsitePage?.findMany ? (client as any).publicWebsitePage.findMany({ orderBy: [{ pageCode: "asc" }] }) : Promise.resolve([]),
    (client as any).publicWebsitePageVersion?.findMany ? (client as any).publicWebsitePageVersion.findMany({ orderBy: [{ pageId: "asc" }, { versionNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).publicWebsitePost?.findMany ? (client as any).publicWebsitePost.findMany({ orderBy: [{ postNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).publicWebsitePostVersion?.findMany ? (client as any).publicWebsitePostVersion.findMany({ orderBy: [{ postId: "asc" }, { versionNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).publicWebsiteNavigationItem?.findMany ? (client as any).publicWebsiteNavigationItem.findMany({ orderBy: [{ itemCode: "asc" }] }) : Promise.resolve([]),
    (client as any).publicWebsiteEvent?.findMany ? (client as any).publicWebsiteEvent.findMany({ orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    client.receiptNote.findMany({ orderBy: { createdAt: "asc" } }),
    client.importBatch.findMany({ orderBy: { importedAt: "asc" } }),
    client.goLiveChecklist.findMany({ orderBy: { createdAt: "asc" } }),
    client.timetableTeacher.findMany({ orderBy: [{ name: "asc" }, { shortName: "asc" }] }),
    client.timetableSubject.findMany({ orderBy: [{ name: "asc" }, { shortName: "asc" }] }),
    client.timetableClassSection.findMany({
      orderBy: [{ academicYear: "asc" }, { className: "asc" }, { section: "asc" }]
    }),
    client.timetablePeriodTemplate.findMany({
      orderBy: [
        { academicYear: "asc" },
        { groupName: "asc" },
        { dayOfWeek: "asc" },
        { sortOrder: "asc" }
      ]
    }),
    client.timetableAssignment.findMany({
      orderBy: [{ academicYear: "asc" }, { classSectionId: "asc" }, { subjectId: "asc" }]
    }),
    client.timetableTeacherUnavailability.findMany({
      orderBy: [{ teacherId: "asc" }, { dayOfWeek: "asc" }, { periodNumber: "asc" }]
    }),
    client.timetableFixedPeriod.findMany({
      orderBy: [{ academicYear: "asc" }, { dayOfWeek: "asc" }, { periodNumber: "asc" }]
    }),
    client.timetableDraft.findMany({
      orderBy: [{ academicYear: "asc" }, { status: "asc" }, { createdAt: "asc" }]
    }),
    client.timetableEntry.findMany({
      orderBy: [{ academicYear: "asc" }, { draftId: "asc" }, { classSectionId: "asc" }, { dayOfWeek: "asc" }, { periodNumber: "asc" }]
    }),
    (client as any).authLoginAlias?.findMany ? (client as any).authLoginAlias.findMany({ orderBy: [{ userId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).authVerificationChallenge?.findMany ? (client as any).authVerificationChallenge.findMany({ orderBy: [{ userId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).authPasswordResetToken?.findMany ? (client as any).authPasswordResetToken.findMany({ orderBy: [{ userId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).authSession?.findMany ? (client as any).authSession.findMany({ orderBy: [{ userId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).authSecurityEvent?.findMany ? (client as any).authSecurityEvent.findMany({ orderBy: [{ createdAt: "asc" }] }) : Promise.resolve([]),
    loadExamGovernanceBackup(client as PrismaClient),
    getSchoolSettings(client)
  ]);

  const [iamUserStates, iamRoleAssignments, iamProfiles, iamProfileEntries, iamProfileVersions, iamProfileAssignments, iamOverrides, iamAudits] = await Promise.all([
    client.user.findMany({
      select: {
        id: true,
        iamPublicKey: true,
        designation: true,
        lifecycleStatus: true,
        isActive: true,
        authorizationVersion: true,
        mustChangePassword: true,
        temporaryPasswordExpiresAt: true,
        suspensionReason: true,
        version: true
      },
      orderBy: { createdAt: "asc" }
    }),
    (client as any).userRoleAssignment?.findMany ? (client as any).userRoleAssignment.findMany({ orderBy: [{ userId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).permissionProfile?.findMany ? (client as any).permissionProfile.findMany({ orderBy: [{ name: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).permissionProfileEntry?.findMany ? (client as any).permissionProfileEntry.findMany({ orderBy: [{ profileId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).permissionProfileVersion?.findMany ? (client as any).permissionProfileVersion.findMany({ orderBy: [{ profileId: "asc" }, { versionNumber: "asc" }] }) : Promise.resolve([]),
    (client as any).userPermissionProfileAssignment?.findMany ? (client as any).userPermissionProfileAssignment.findMany({ orderBy: [{ userId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).userPermissionOverride?.findMany ? (client as any).userPermissionOverride.findMany({ orderBy: [{ userId: "asc" }, { createdAt: "asc" }] }) : Promise.resolve([]),
    (client as any).userAudit?.findMany ? (client as any).userAudit.findMany({ where: { action: { startsWith: "IAM_" } }, orderBy: { createdAt: "asc" } }) : Promise.resolve([])
  ]);
  const academicCalendarBackup = academicCalendarAvailable
    ? await loadAcademicCalendarBackup(client)
    : { academicCalendarVersions: [], operationalCalendarDays: [], schoolCalendarEvents: [], schoolCalendarEventVersions: [], academicCalendarAuditEvents: [] };
  const classworkBackup = classworkAvailable && (client as any).classworkItem?.findMany
    ? await loadClassworkBackup(client)
    : { classworkItems: [], classworkItemVersions: [], classworkSubmissions: [], classworkSubmissionVersions: [], classworkAttachments: [], classworkFeedback: [], classworkAuditEvents: [] };
  const academicReportingBackup = academicReportingAvailable && (client as any).academicReportDefinition?.findMany
    ? await loadAcademicReportingBackup(client as PrismaClient)
    : { academicReportDefinitions: [], academicReportRuns: [], academicReportSourceReferences: [], academicReportAuditEvents: [] };
  const admissionsBackup = admissionsAvailable && (client as any).admissionCycle?.findMany
    ? await loadAdmissionsBackup(client as PrismaClient)
    : { admissionCycles: [], admissionEnquiries: [], enquiryFollowUps: [], schoolVisits: [], admissionApplications: [], admissionApplicationVersions: [], applicantChildren: [], prospectiveGuardians: [], applicationDocuments: [], applicationReviews: [], admissionDecisions: [], admissionOffers: [], admissionDuplicateResolutions: [], admissionConversions: [], admissionEvents: [] };
  const payrollBackup = payrollAvailable && (client as any).payrollPolicyVersion?.findMany
    ? await loadPayrollBackup(client as PrismaClient)
    : Object.fromEntries(PAYROLL_BACKUP_KEYS.map((key) => [key, []])) as unknown as PayrollBackup;
  const payslipRequestBackup = payslipRequestAvailable && (client as any).staffPayslipRequest?.findMany
    ? await loadPayslipRequestBackup(client as PrismaClient)
    : Object.fromEntries(PAYSLIP_REQUEST_BACKUP_KEYS.map((key) => [key, []])) as unknown as PayslipRequestBackup;
  const familyCollectionBackup = await familyCollectionSchemaAvailable(client)
    ? await loadFamilyCollectionBackup(client as PrismaClient)
    : emptyFamilyCollectionBackup();

  return createBackupDocument({
    generatedAt: options.generatedAt ?? new Date(),
    generatedBy: options.generatedBy,
    students,
    feeStructures,
    payments,
    paymentAudits,
    users,
    authSecurity: {
      aliases: authSecurityAliases,
      verificationHistory: authVerificationHistory,
      resetHistory: authResetHistory,
      sessions: authSessions,
      events: authSecurityEvents
    },
    iamAccess: {
      userStates: iamUserStates.map(({ id, ...state }) => ({ userId: id, ...state })),
      roleAssignments: iamRoleAssignments,
      profiles: iamProfiles,
      profileEntries: iamProfileEntries,
      profileVersions: iamProfileVersions,
      profileAssignments: iamProfileAssignments,
      overrides: iamOverrides,
      audits: iamAudits
    },
    ...academicCalendarBackup,
    ...classworkBackup,
    ...academicReportingBackup,
    ...admissionsBackup,
    ...payrollBackup,
    ...payslipRequestBackup,
    ...familyCollectionBackup,
    rolePermissions,
    guardians,
    studentGuardians,
    notices,
    staffMembers,
    studentAttendanceSessions,
    studentAttendanceRecords,
    staffAttendanceSessions,
    staffAttendanceRecords,
    staffLeaveRequests,
    substituteAssignments,
    academicYearEnrollments,
    studentLifecycleEvents,
    studentProgressionDecisions,
    vendors,
    expenseCategories,
    expenseDepartments,
    expenseRecords,
    expensePayments,
    expenseAudits,
    budgetPlans,
    budgetAllocations,
    budgetRevisions,
    miscIncomeItems,
    miscIncomeRates,
    miscIncomeReceipts,
    miscIncomeReceiptLines,
    cashBookDays,
    cashBookMovements,
    bookCatalogItems,
    bookCatalogRates,
    bookSaleReceipts,
    bookSaleReceiptLines,
    bookCashSettlements,
    libraryTitles,
    libraryCopies,
    libraryCopyEvents,
    libraryMembers,
    libraryPolicies,
    libraryLoans,
    libraryReservations,
    libraryLoanEvents,
    libraryIncidents,
    libraryChargeRules,
    libraryCharges,
    libraryChargeEvents,
    libraryStockVerificationSessions,
    libraryStockVerificationRecords,
    libraryStockVerificationScanEvents,
    libraryStockVerificationEvents,
    homeworkAssignments,
    homeworkAssignmentEvents,
    examCycles,
    examAssessments,
    studentMarks,
    studentMarkEvents,
    examGovernance,
    gradingSchemes,
    gradeBands,
    reportCardTemplates,
    reportCardBatches,
    reportCardBatchExamSources,
    studentReportCards,
    studentReportCardVersions,
    studentReportCardEvents,
    teacherAnalyticsReviewCycles,
    teacherAnalyticsSnapshots,
    teacherAnalyticsReviews,
    teacherAnalyticsEvents,
    certificateNumberSeries,
    certificateTemplates,
    studentCertificateRequests,
    studentCertificates,
    studentCertificateVersions,
    studentCertificateEvents,
    classXPackageTemplates,
    classXDocumentPackages,
    classXPackageDocumentItems,
    classXPackageChargeRules,
    classXPackageCharges,
    classXPackageHandovers,
    classXPackageEvents,
    identityCardNumberSeries,
    identityCardTemplates,
    identityCardBatches,
    identityCards,
    identityCardVersions,
    identityCardEvents,
    notificationTemplates,
    notificationCampaigns,
    notificationRecipients,
    notificationSkippedRecipients,
    notificationEvents,
    whatsAppIntegrationProfiles,
    whatsAppConsents,
    whatsAppConsentEvents,
    whatsAppTemplateMappings,
    whatsAppOutboundBatches,
    whatsAppDeliveries,
    whatsAppDeliveryAttempts,
    whatsAppWebhookEvents,
    whatsAppOperationalEvents,
    whatsAppRateReferences,
    smsEmailIntegrationProfiles,
    smsEmailConsents,
    smsEmailConsentEvents,
    smsEmailTemplateMappings,
    smsEmailOutboundBatches,
    smsEmailDeliveries,
    smsEmailDeliveryAttempts,
    smsEmailWebhookEvents,
    smsEmailOperationalEvents,
    smsEmailSuppressions,
    smsEmailCostRates,
    aiAssistantProfiles,
    aiAssistantSourcePolicies,
    aiAssistantQueryAudits,
    aiAssistantSafetyEvents,
    aiAssistantEvaluationCases,
    aiAssistantEvaluationRuns,
    feeRegisterOcrProfiles,
    feeRegisterOcrBatches,
    feeRegisterOcrPages,
    feeRegisterOcrRows,
    feeRegisterOcrRowRevisions,
    feeRegisterOcrPostingRuns,
    feeRegisterOcrEvents,
    cloudBackupProfiles,
    cloudBackupSchedules,
    cloudBackupRetentionPolicies,
    cloudBackupRuns,
    cloudBackupArtifacts,
    cloudBackupVerifications,
    cloudBackupRestoreRehearsals,
    cloudBackupEvents,
    publicWebsiteSettings,
    publicWebsitePages,
    publicWebsitePageVersions,
    publicWebsitePosts,
    publicWebsitePostVersions,
    publicWebsiteNavigationItems,
    publicWebsiteEvents,
    receiptNotes,
    importBatches,
    goLiveChecklist,
    timetableTeachers,
    timetableSubjects,
    timetableClassSections,
    timetablePeriodTemplates,
    timetableAssignments,
    timetableTeacherUnavailability,
    timetableFixedPeriods,
    timetableDrafts,
    timetableEntries,
    schoolSettings: settings,
    academicYear: settings.academicYear
  });
}

export function formatBackupFilename(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    "nalanda-fee-control-backup",
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes())
  ].join("-") + ".json";
}

export function serializeBackup(backup: ReturnType<typeof createBackupDocument>) {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

function sanitizeUsers<T extends object>(users: readonly T[]): Array<Omit<T, "passwordHash">> {
  return users.map((user) => {
    const { passwordHash: _passwordHash, ...safeUser } = user as T & { passwordHash?: unknown };
    return safeUser;
  });
}

function sanitizeCloudBackupRows(rows: readonly object[]) {
  return sanitizeActorFields(rows).map((row) => Object.fromEntries(
    Object.entries(row).filter(([key]) => ![
      "credential", "credentials", "secret", "token", "accessToken",
      "refreshToken", "encryptionKey", "objectBody", "decryptedPayload",
      "absolutePath"
    ].includes(key))
  ));
}

function sanitizeActorFields(rows: readonly object[]) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) =>
    !key.endsWith("ByUserId")
    && key !== "actorUserId"
    && key !== "enteredByUserId"
    && key !== "verifiedByUserId"
  )));
}
