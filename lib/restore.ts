import { isRole, normalizePermission } from "@/lib/permissions";
import { validateReportCardBackupRows } from "@/lib/report-card-backup";
import { validateTeacherAnalyticsBackupRows } from "@/lib/teacher-analytics-backup";
import { validateCertificateBackupRows } from "@/lib/certificate-backup";
import { validateClassXPackageBackupRows } from "@/lib/class-x-package-backup";
import { validateIdentityCardBackupRows } from "@/lib/id-card-backup";
import { validateNotificationBackupRows } from "@/lib/notification-backup";
import { validateWhatsAppBackupRows } from "@/lib/whatsapp-backup";
import { validateSmsEmailBackupRows } from "@/lib/sms-email-backup";
import { validateAiAssistantBackupRows } from "@/lib/ai-assistant-backup";
import { validateFeeRegisterOcrBackupRows } from "@/lib/fee-register-ocr-backup";
import { validateCloudBackupBackupRows } from "@/lib/cloud-backup-backup";
import { validatePublicWebsiteBackupRows } from "@/lib/public-website-backup";
import {
  validateExamGovernanceBackup,
  type ExamGovernanceBackup
} from "@/lib/exam-governance-backup";
import { validateAuthSecurityBackup, type AuthSecurityBackup } from "@/lib/auth-backup";
import { validateIamAccessBackup, type IamAccessBackup } from "@/lib/iam/backup";
import { validateAcademicCalendarBackupRows } from "@/lib/academic-calendar-backup";
import { validateClassworkBackupRows } from "@/lib/classwork-backup";
import { validateAcademicReportingBackupRows } from "@/lib/academic-reporting-backup";
import { ADMISSIONS_BACKUP_KEYS, validateAdmissionsBackupRows, type AdmissionsBackup, type AdmissionsBackupKey } from "@/lib/admissions-backup";
import { PAYROLL_BACKUP_KEYS, validatePayrollBackupRows, type PayrollBackup, type PayrollBackupKey } from "@/lib/payroll-backup";
import { PAYSLIP_REQUEST_BACKUP_KEYS, validatePayslipRequestBackupRows, type PayslipRequestBackup, type PayslipRequestBackupKey } from "@/lib/payslip-request-backup";
import { SUPPORT_BACKUP_KEYS, validateSupportBackupRows, type SupportBackup, type SupportBackupKey } from "@/lib/support-backup";
import { SAFE_EXIT_BACKUP_KEYS, validateSafeExitBackupRows, type SafeExitBackup, type SafeExitBackupKey } from "@/lib/safe-exit-backup";
import { FAMILY_COLLECTION_BACKUP_KEYS, validateFamilyCollectionBackupRows, type FamilyCollectionBackup } from "@/lib/family-collection-backup";
import { validateTechnicalOperationsBackup, type TechnicalOperationsBackup } from "@/lib/technical-operations-backup";

const APP_NAME = "Nalanda Fee Control";
const MAX_ENTITY_ROWS = 100_000;

const TOP_LEVEL_KEYS = new Set([
  "metadata",
  "technicalOperations",
  "schoolSettings",
  "students",
  "feeStructures",
  "payments",
  "paymentAudits",
  ...FAMILY_COLLECTION_BACKUP_KEYS,
  "users",
  "authSecurity",
  "iamAccess",
  "rolePermissions",
  "guardians",
  "studentGuardians",
  "notices",
  "staffMembers",
  "studentAttendanceSessions",
  "studentAttendanceRecords",
  "staffAttendanceSessions",
  "staffAttendanceRecords",
  "staffLeaveRequests",
  "substituteAssignments",
  "academicYearEnrollments",
  "studentLifecycleEvents",
  "studentProgressionDecisions",
  "vendors", "expenseCategories", "expenseDepartments", "expenseRecords", "expensePayments", "expenseAudits",
  "budgetPlans", "budgetAllocations", "budgetRevisions",
  "miscIncomeItems", "miscIncomeRates", "miscIncomeReceipts", "miscIncomeReceiptLines", "cashBookDays", "cashBookMovements",
  "bookCatalogItems", "bookCatalogRates", "bookSaleReceipts", "bookSaleReceiptLines", "bookCashSettlements",
  "libraryTitles", "libraryCopies", "libraryCopyEvents", "libraryMembers", "libraryPolicies", "libraryLoans", "libraryReservations", "libraryLoanEvents", "libraryIncidents", "libraryChargeRules", "libraryCharges", "libraryChargeEvents", "libraryStockVerificationSessions", "libraryStockVerificationRecords", "libraryStockVerificationScanEvents", "libraryStockVerificationEvents",
  "homeworkAssignments", "homeworkAssignmentEvents",
  "classworkItems", "classworkItemVersions", "classworkSubmissions", "classworkSubmissionVersions", "classworkAttachments", "classworkFeedback", "classworkAuditEvents",
  "academicReportDefinitions", "academicReportRuns", "academicReportSourceReferences", "academicReportAuditEvents",
  ...ADMISSIONS_BACKUP_KEYS,
  ...PAYROLL_BACKUP_KEYS,
  ...PAYSLIP_REQUEST_BACKUP_KEYS,
  ...SUPPORT_BACKUP_KEYS,
  ...SAFE_EXIT_BACKUP_KEYS,
  ...FAMILY_COLLECTION_BACKUP_KEYS,
  "examCycles", "examAssessments", "studentMarks", "studentMarkEvents",
  "examGovernance",
  "gradingSchemes", "gradeBands", "reportCardTemplates", "reportCardBatches", "reportCardBatchExamSources",
  "studentReportCards", "studentReportCardVersions", "studentReportCardEvents",
  "academicCalendarVersions", "operationalCalendarDays", "schoolCalendarEvents", "schoolCalendarEventVersions", "academicCalendarAuditEvents",
  "teacherAnalyticsReviewCycles", "teacherAnalyticsSnapshots", "teacherAnalyticsReviews", "teacherAnalyticsEvents",
  "certificateNumberSeries", "certificateTemplates", "studentCertificateRequests", "studentCertificates", "studentCertificateVersions", "studentCertificateEvents",
  "classXPackageTemplates", "classXDocumentPackages", "classXPackageDocumentItems", "classXPackageChargeRules", "classXPackageCharges", "classXPackageHandovers", "classXPackageEvents",
  "identityCardNumberSeries", "identityCardTemplates", "identityCardBatches", "identityCards", "identityCardVersions", "identityCardEvents",
  "notificationTemplates", "notificationCampaigns", "notificationRecipients", "notificationSkippedRecipients", "notificationEvents",
  "whatsAppIntegrationProfiles", "whatsAppConsents", "whatsAppConsentEvents", "whatsAppTemplateMappings",
  "whatsAppOutboundBatches", "whatsAppDeliveries", "whatsAppDeliveryAttempts", "whatsAppWebhookEvents", "whatsAppOperationalEvents", "whatsAppRateReferences",
  "smsEmailIntegrationProfiles", "smsEmailConsents", "smsEmailConsentEvents", "smsEmailTemplateMappings",
  "smsEmailOutboundBatches", "smsEmailDeliveries", "smsEmailDeliveryAttempts", "smsEmailWebhookEvents",
  "smsEmailOperationalEvents", "smsEmailSuppressions", "smsEmailCostRates",
  "aiAssistantProfiles", "aiAssistantSourcePolicies", "aiAssistantQueryAudits",
  "aiAssistantSafetyEvents", "aiAssistantEvaluationCases", "aiAssistantEvaluationRuns",
  "feeRegisterOcrProfiles", "feeRegisterOcrBatches", "feeRegisterOcrPages", "feeRegisterOcrRows",
  "feeRegisterOcrRowRevisions", "feeRegisterOcrPostingRuns", "feeRegisterOcrEvents",
  "cloudBackupProfiles", "cloudBackupSchedules", "cloudBackupRetentionPolicies", "cloudBackupRuns",
  "cloudBackupArtifacts", "cloudBackupVerifications", "cloudBackupRestoreRehearsals", "cloudBackupEvents",
  "publicWebsiteSettings", "publicWebsitePages", "publicWebsitePageVersions", "publicWebsitePosts",
  "publicWebsitePostVersions", "publicWebsiteNavigationItems", "publicWebsiteEvents",
  "receiptNotes",
  "importBatches",
  "onboardingBatches",
  "onboardingRowOutcomes",
  "onboardingAuditEvents",
  "goLiveChecklist",
  "timetableTeachers",
  "timetableSubjects",
  "timetableClassSections",
  "timetablePeriodTemplates",
  "timetableAssignments",
  "timetableTeacherUnavailability",
  "timetableFixedPeriods",
  "timetableDrafts",
  "timetableEntries"
]);

const METADATA_KEYS = new Set([
  "appName", "academicYear", "generatedAt", "generatedBy", "appVersion", "backupVersion", "counts"
]);
const BACKUP_COUNT_KEYS = new Set([
  "schoolSettings",
  "technicalOperationsRecords",
  "authSecurityRecords",
  "iamAccessRecords",
  "timetableTeachers", "timetableSubjects", "timetableClassSections",
  "rolePermissions", "guardians", "studentGuardians", "notices", "staffMembers", "timetablePeriodTemplates",
  "studentAttendanceSessions", "studentAttendanceRecords",
  "staffAttendanceSessions", "staffAttendanceRecords",
  "staffLeaveRequests",
  "substituteAssignments",
  "academicYearEnrollments", "studentLifecycleEvents",
  "studentProgressionDecisions",
  "vendors", "expenseCategories", "expenseDepartments", "expenseRecords", "expensePayments", "expenseAudits",
  "budgetPlans", "budgetAllocations", "budgetRevisions",
  "miscIncomeItems", "miscIncomeRates", "miscIncomeReceipts", "miscIncomeReceiptLines", "cashBookDays", "cashBookMovements",
  "bookCatalogItems", "bookCatalogRates", "bookSaleReceipts", "bookSaleReceiptLines", "bookCashSettlements",
  "libraryTitles", "libraryCopies", "libraryCopyEvents", "libraryMembers", "libraryPolicies", "libraryLoans", "libraryReservations", "libraryLoanEvents", "libraryIncidents", "libraryChargeRules", "libraryCharges", "libraryChargeEvents", "libraryStockVerificationSessions", "libraryStockVerificationRecords", "libraryStockVerificationScanEvents", "libraryStockVerificationEvents",
  "homeworkAssignments", "homeworkAssignmentEvents",
  "classworkItems", "classworkItemVersions", "classworkSubmissions", "classworkSubmissionVersions", "classworkAttachments", "classworkFeedback", "classworkAuditEvents",
  "academicReportDefinitions", "academicReportRuns", "academicReportSourceReferences", "academicReportAuditEvents",
  ...ADMISSIONS_BACKUP_KEYS,
  ...PAYROLL_BACKUP_KEYS,
  ...PAYSLIP_REQUEST_BACKUP_KEYS,
  ...SUPPORT_BACKUP_KEYS,
  ...SAFE_EXIT_BACKUP_KEYS,
  ...FAMILY_COLLECTION_BACKUP_KEYS,
  "examCycles", "examAssessments", "studentMarks", "studentMarkEvents",
  "examGovernanceRecords",
  "gradingSchemes", "gradeBands", "reportCardTemplates", "reportCardBatches", "reportCardBatchExamSources",
  "studentReportCards", "studentReportCardVersions", "studentReportCardEvents",
  "academicCalendarVersions", "operationalCalendarDays", "schoolCalendarEvents", "schoolCalendarEventVersions", "academicCalendarAuditEvents",
  "teacherAnalyticsReviewCycles", "teacherAnalyticsSnapshots", "teacherAnalyticsReviews", "teacherAnalyticsEvents",
  "certificateNumberSeries", "certificateTemplates", "studentCertificateRequests", "studentCertificates", "studentCertificateVersions", "studentCertificateEvents",
  "classXPackageTemplates", "classXDocumentPackages", "classXPackageDocumentItems", "classXPackageChargeRules", "classXPackageCharges", "classXPackageHandovers", "classXPackageEvents",
  "identityCardNumberSeries", "identityCardTemplates", "identityCardBatches", "identityCards", "identityCardVersions", "identityCardEvents",
  "notificationTemplates", "notificationCampaigns", "notificationRecipients", "notificationSkippedRecipients", "notificationEvents",
  "whatsAppIntegrationProfiles", "whatsAppConsents", "whatsAppConsentEvents", "whatsAppTemplateMappings",
  "whatsAppOutboundBatches", "whatsAppDeliveries", "whatsAppDeliveryAttempts", "whatsAppWebhookEvents", "whatsAppOperationalEvents", "whatsAppRateReferences",
  "smsEmailIntegrationProfiles", "smsEmailConsents", "smsEmailConsentEvents", "smsEmailTemplateMappings",
  "smsEmailOutboundBatches", "smsEmailDeliveries", "smsEmailDeliveryAttempts", "smsEmailWebhookEvents",
  "smsEmailOperationalEvents", "smsEmailSuppressions", "smsEmailCostRates",
  "aiAssistantProfiles", "aiAssistantSourcePolicies", "aiAssistantQueryAudits",
  "aiAssistantSafetyEvents", "aiAssistantEvaluationCases", "aiAssistantEvaluationRuns",
  "feeRegisterOcrProfiles", "feeRegisterOcrBatches", "feeRegisterOcrPages", "feeRegisterOcrRows",
  "feeRegisterOcrRowRevisions", "feeRegisterOcrPostingRuns", "feeRegisterOcrEvents",
  "cloudBackupProfiles", "cloudBackupSchedules", "cloudBackupRetentionPolicies", "cloudBackupRuns",
  "cloudBackupArtifacts", "cloudBackupVerifications", "cloudBackupRestoreRehearsals", "cloudBackupEvents",
  "publicWebsiteSettings", "publicWebsitePages", "publicWebsitePageVersions", "publicWebsitePosts",
  "publicWebsitePostVersions", "publicWebsiteNavigationItems", "publicWebsiteEvents",
  "onboardingRecords",
  "timetableAssignments", "timetableDrafts", "timetableEntries"
]);
const STUDENT_KEYS = new Set([
  "id", "academicYear", "admissionNo", "studentName", "fatherName", "motherName", "className",
  "section", "rollNo", "phone1", "phone2", "whatsappNumber", "address", "status", "studentType",
  "discountPercent", "startMonth", "remarks", "dateOfBirth", "aadhaarNo", "tcStatus",
  "deletedAt", "createdAt", "updatedAt"
]);
const FEE_STRUCTURE_KEYS = new Set([
  "id", "academicYear", "className", "termAmount", "term1Month", "term2Month", "term3Month",
  "term4Month", "active", "createdAt", "updatedAt"
]);
const PAYMENT_KEYS = new Set([
  "id", "date", "receiptNo", "admissionNo", "studentId", "studentName", "className", "section",
  "amountPaid", "paymentMode", "receivedAccount", "transactionRefNo", "feeType", "termHint",
  "remarks", "enteredBy", "editedBy", "isCancelled", "cancelledAt", "cancelledByUserId",
  "cancellationReason", "deletedAt", "createdAt", "updatedAt"
  ,"familyCollectionId", "familyInstrumentId", "familyAllocationId", "familyShareId"
]);
const PAYMENT_AUDIT_KEYS = new Set([
  "id", "paymentId", "action", "oldValueJson", "newValueJson", "changedByUserId",
  "changedByName", "reason", "createdAt"
]);
const USER_KEYS = new Set([
  "id", "name", "username", "email", "passwordHash", "role", "isActive", "lastLoginAt",
  "guardianId", "createdAt", "updatedAt"
]);
const GUARDIAN_KEYS = new Set([
  "id", "iamPublicKey", "displayName", "primaryMobile", "alternateMobile", "email", "relationship",
  "status", "notes", "createdAt", "updatedAt"
]);
const STUDENT_GUARDIAN_KEYS = new Set([
  "id", "guardianId", "studentId", "relationshipToStudent", "isPrimaryContact",
  "canViewFees", "canReceiveReminders", "createdAt", "updatedAt"
]);
const ROLE_PERMISSION_KEYS = new Set([
  "id", "role", "permission", "enabled", "createdAt", "updatedAt"
]);
const NOTICE_KEYS = new Set([
  "id", "title", "body", "audienceType", "className", "section", "status",
  "publishDate", "expiresAt", "createdById", "updatedById", "createdAt", "updatedAt"
]);
const STAFF_MEMBER_KEYS = new Set([
  "id", "iamPublicKey", "staffCode", "fullName", "displayName", "staffType", "designation", "department",
  "primarySubject", "additionalSubjects", "qualification", "experienceYears", "dateOfJoining",
  "mobile", "alternateMobile", "email", "address", "emergencyContactName", "emergencyContactMobile",
  "status", "notes", "userId", "timetableTeacherId", "createdAt", "updatedAt"
]);
const STUDENT_ATTENDANCE_SESSION_KEYS = new Set([
  "id", "attendanceDate", "className", "section", "academicYear", "status", "takenByUserId",
  "submittedByUserId", "lockedByUserId", "submittedAt", "lockedAt", "notes", "operationalCalendarVersionKey", "operationalCalendarDayKey", "calendarBasisSnapshotJson", "createdAt", "updatedAt"
]);
const STUDENT_ATTENDANCE_RECORD_KEYS = new Set([
  "id", "sessionId", "studentId", "admissionNo", "status", "remarks", "createdAt", "updatedAt"
]);
const ACADEMIC_YEAR_ENROLLMENT_KEYS = new Set([
  "id", "studentId", "academicYear", "className", "section", "rollNo", "status",
  "enrollmentDate", "exitDate", "exitReason", "notes", "createdAt", "updatedAt"
]);
const STUDENT_LIFECYCLE_EVENT_KEYS = new Set([
  "id", "studentId", "academicYear", "eventType", "fromClass", "fromSection", "toClass",
  "toSection", "fromStatus", "toStatus", "effectiveDate", "reason", "evidenceNotes",
  "parentAcknowledgementNotes", "approvedByUserId", "recordedByUserId", "createdAt", "updatedAt"
]);
const STUDENT_PROGRESSION_DECISION_KEYS = new Set([
  "id", "studentId", "sourceEnrollmentId", "academicYear", "decisionType", "status", "fromClass", "fromSection", "fromStatus",
  "toAcademicYear", "toClass", "toSection", "toStatus", "effectiveDate", "reason", "evidenceNotes", "marksSummary", "attendanceSummary",
  "parentRequestNotes", "parentAcknowledgementNotes", "feeWarningNotes", "udiseReviewNotes", "destinationSchool", "followUpNotes",
  "rejectionReason", "cancellationReason", "createdByUserId", "submittedByUserId", "approvedByUserId", "finalizedByUserId", "cancelledByUserId",
  "submittedAt", "approvedAt", "finalizedAt", "cancelledAt", "createdAt", "updatedAt"
]);
const VENDOR_KEYS = new Set(["id", "vendorCode", "name", "contactPerson", "mobile", "alternateMobile", "email", "address", "gstin", "pan", "bankName", "accountLastFour", "ifsc", "paymentTermsDays", "notes", "status", "createdByUserId", "createdAt", "updatedAt"]);
const EXPENSE_CATEGORY_KEYS = new Set(["id", "name", "code", "description", "parentCategoryId", "status", "createdAt", "updatedAt"]);
const EXPENSE_DEPARTMENT_KEYS = new Set(["id", "name", "code", "description", "status", "createdAt", "updatedAt"]);
const EXPENSE_RECORD_KEYS = new Set(["id", "expenseNumber", "expenseDate", "academicYear", "vendorId", "categoryId", "departmentId", "description", "invoiceNumber", "invoiceDate", "grossAmount", "taxAmount", "deductionAmount", "netAmount", "paymentMethod", "paymentStatus", "approvalStatus", "transactionReference", "chequeNumber", "chequeDate", "paidDate", "notes", "rejectionReason", "cancellationReason", "createdByUserId", "submittedByUserId", "approvedByUserId", "paidByUserId", "cancelledByUserId", "submittedAt", "approvedAt", "paidAt", "cancelledAt", "createdAt", "updatedAt"]);
const EXPENSE_PAYMENT_KEYS = new Set(["id", "expenseRecordId", "paymentDate", "amount", "paymentMethod", "transactionReference", "chequeNumber", "chequeDate", "notes", "recordedByUserId", "createdAt"]);
const EXPENSE_AUDIT_KEYS = new Set(["id", "expenseRecordId", "action", "fromStatus", "toStatus", "detailsJson", "actorUserId", "actorName", "createdAt"]);
const BUDGET_PLAN_KEYS = new Set(["id", "budgetNumber", "academicYear", "title", "description", "status", "totalAllocatedAmount", "warningThresholdPercent", "criticalThresholdPercent", "effectiveFrom", "effectiveTo", "rejectionReason", "cancellationReason", "createdByUserId", "submittedByUserId", "approvedByUserId", "lockedByUserId", "cancelledByUserId", "submittedAt", "approvedAt", "lockedAt", "cancelledAt", "createdAt", "updatedAt"]);
const BUDGET_ALLOCATION_KEYS = new Set(["id", "budgetPlanId", "categoryId", "departmentId", "allocationKey", "allocatedAmount", "warningThresholdPercent", "criticalThresholdPercent", "notes", "createdAt", "updatedAt"]);
const BUDGET_REVISION_KEYS = new Set(["id", "budgetPlanId", "revisionNumber", "reason", "previousTotalAmount", "revisedTotalAmount", "revisionData", "status", "createdByUserId", "submittedByUserId", "approvedByUserId", "submittedAt", "approvedAt", "rejectionReason", "cancellationReason", "createdAt"]);
const MISC_INCOME_ITEM_KEYS = new Set(["id", "itemCode", "name", "description", "category", "studentLinkPolicy", "status", "createdByUserId", "createdAt", "updatedAt"]);
const MISC_INCOME_RATE_KEYS = new Set(["id", "itemId", "academicYear", "amount", "effectiveFrom", "effectiveTo", "notes", "status", "createdAt", "updatedAt"]);
const MISC_INCOME_RECEIPT_KEYS = new Set(["id", "receiptNumber", "receiptDate", "academicYear", "studentId", "payerName", "paymentMethod", "receivedAccount", "transactionReference", "chequeNumber", "chequeDate", "grossAmount", "discountAmount", "netAmount", "status", "remarks", "createdByUserId", "cancelledByUserId", "cancelledAt", "cancellationReason", "createdAt", "updatedAt"]);
const MISC_INCOME_LINE_KEYS = new Set(["id", "receiptId", "itemId", "itemNameSnapshot", "rateId", "quantity", "unitAmount", "discountAmount", "lineTotal", "notes", "createdAt"]);
const CASH_BOOK_DAY_KEYS = new Set(["id", "cashDate", "academicYear", "openingBalance", "status", "feeCashSnapshot", "miscIncomeCashSnapshot", "bookSalesCashSnapshot", "cashExpenseSnapshot", "manualInflowSnapshot", "manualOutflowSnapshot", "bankDepositSnapshot", "directorHandoverSnapshot", "calculatedClosingBalance", "countedClosingBalance", "varianceAmount", "sourceSummarySnapshot", "notes", "rejectionReason", "cancellationReason", "createdByUserId", "submittedByUserId", "approvedByUserId", "lockedByUserId", "cancelledByUserId", "submittedAt", "approvedAt", "lockedAt", "cancelledAt", "createdAt", "updatedAt"]);
const CASH_BOOK_MOVEMENT_KEYS = new Set(["id", "cashBookDayId", "movementType", "amount", "movementDate", "referenceNumber", "bankName", "recipientName", "reason", "notes", "status", "recordedByUserId", "cancelledByUserId", "cancelledAt", "cancellationReason", "createdAt", "updatedAt"]);
const BOOK_CATALOG_ITEM_KEYS = new Set(["id", "itemCode", "title", "itemType", "publisherVendorId", "className", "subject", "description", "studentLinkRequired", "status", "createdByUserId", "createdAt", "updatedAt"]);
const BOOK_CATALOG_RATE_KEYS = new Set(["id", "itemId", "academicYear", "amount", "effectiveFrom", "effectiveTo", "status", "notes", "createdAt", "updatedAt"]);
const BOOK_SALE_RECEIPT_KEYS = new Set(["id", "receiptNumber", "receiptDate", "academicYear", "studentId", "payerName", "paymentMethod", "receivedAccount", "transactionReference", "chequeNumber", "chequeDate", "grossAmount", "discountAmount", "netAmount", "status", "remarks", "createdByUserId", "cancelledByUserId", "cancelledAt", "cancellationReason", "createdAt", "updatedAt"]);
const BOOK_SALE_LINE_KEYS = new Set(["id", "receiptId", "itemId", "itemCodeSnapshot", "itemTitleSnapshot", "classNameSnapshot", "publisherNameSnapshot", "rateId", "quantity", "unitAmount", "discountAmount", "lineTotal", "notes", "createdAt"]);
const BOOK_CASH_SETTLEMENT_KEYS = new Set(["id", "settlementDate", "academicYear", "status", "expectedBookCash", "handedToDirectorAmount", "handedToCashCounterAmount", "retainedByBooksInchargeAmount", "varianceAmount", "varianceReason", "booksInchargeName", "receiverName", "cashBookMovementId", "notes", "createdByUserId", "submittedByUserId", "approvedByUserId", "cancelledByUserId", "submittedAt", "approvedAt", "cancelledAt", "cancellationReason", "createdAt", "updatedAt"]);
const LIBRARY_TITLE_KEYS = new Set(["id", "titleCode", "title", "subtitle", "authors", "isbn", "edition", "publisherName", "publisherVendorId", "publicationYear", "language", "subject", "category", "classificationNumber", "defaultShelfCode", "description", "status", "createdByUserId", "createdAt", "updatedAt"]);
const LIBRARY_COPY_KEYS = new Set(["id", "titleId", "accessionNumber", "barcodeValue", "acquisitionDate", "acquisitionType", "acquisitionCost", "vendorId", "expenseRecordId", "donorName", "invoiceNumberSnapshot", "condition", "status", "shelfCode", "notes", "withdrawnDate", "withdrawalReason", "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"]);
const LIBRARY_COPY_EVENT_KEYS = new Set(["id", "copyId", "eventType", "eventDate", "previousStatus", "newStatus", "previousCondition", "newCondition", "previousShelfCode", "newShelfCode", "reason", "notes", "recordedByUserId", "createdAt"]);
const LIBRARY_MEMBER_KEYS = new Set(["id", "memberCode", "memberType", "studentId", "staffMemberId", "status", "joinedDate", "suspendedUntil", "suspensionReason", "notes", "createdByUserId", "updatedByUserId", "createdAt", "updatedAt"]);
const LIBRARY_POLICY_KEYS = new Set(["id", "policyCode", "name", "memberType", "className", "staffType", "maxActiveLoans", "loanPeriodDays", "maxRenewals", "renewalPeriodDays", "reservationLimit", "status", "priority", "notes", "createdByUserId", "createdAt", "updatedAt"]);
const LIBRARY_LOAN_KEYS = new Set(["id", "loanNumber", "copyId", "memberId", "status", "activeCopyKey", "issueDate", "dueDate", "returnedDate", "renewCount", "policyCodeSnapshot", "loanPeriodDaysSnapshot", "maxRenewalsSnapshot", "renewalPeriodDaysSnapshot", "issueConditionSnapshot", "returnConditionSnapshot", "issueNotes", "returnNotes", "cancellationReason", "issuedByUserId", "returnedByUserId", "cancelledByUserId", "createdAt", "updatedAt"]);
const LIBRARY_RESERVATION_KEYS = new Set(["id", "reservationNumber", "titleId", "memberId", "status", "activeMemberTitleKey", "requestedDate", "expiresDate", "fulfilledLoanId", "fulfilledAt", "cancelledAt", "cancellationReason", "createdByUserId", "fulfilledByUserId", "cancelledByUserId", "createdAt", "updatedAt"]);
const LIBRARY_LOAN_EVENT_KEYS = new Set(["id", "loanId", "reservationId", "memberId", "copyId", "titleId", "eventType", "eventDate", "previousDueDate", "newDueDate", "reason", "notes", "recordedByUserId", "createdAt"]);
const LIBRARY_INCIDENT_KEYS = new Set(["id","incidentNumber","incidentType","status","activeCaseKey","loanId","memberId","copyId","titleId","reportedDate","incidentCondition","description","assessmentNotes","resolutionType","replacementCopyId","resolvedDate","resolutionNotes","cancellationReason","createdByUserId","submittedByUserId","approvedByUserId","resolvedByUserId","cancelledByUserId","submittedAt","approvedAt","resolvedAt","cancelledAt","createdAt","updatedAt"]);
const LIBRARY_CHARGE_RULE_KEYS = new Set(["id","ruleCode","name","memberType","className","staffType","graceDays","overdueAmountPerDay","maximumOverdueAmount","lostChargeBasis","fixedLostAmount","damagedChargeBasis","fixedDamagedAmount","priority","status","notes","createdByUserId","createdAt","updatedAt"]);
const LIBRARY_CHARGE_KEYS = new Set(["id","chargeNumber","chargeType","status","activeOverdueLoanKey","memberId","loanId","incidentId","studentId","staffMemberId","assessedDate","dueDate","overdueDaysSnapshot","ruleCodeSnapshot","rateSnapshot","originalAmount","waivedAmount","payableAmount","assessmentReason","waiverReason","cancellationReason","miscIncomeReceiptId","approvedByUserId","waivedByUserId","collectedByUserId","cancelledByUserId","createdByUserId","approvedAt","waivedAt","collectedAt","cancelledAt","createdAt","updatedAt"]);
const LIBRARY_CHARGE_EVENT_KEYS = new Set(["id","chargeId","incidentId","eventType","eventDate","previousStatus","newStatus","amountSnapshot","reason","notes","recordedByUserId","createdAt"]);
const LIBRARY_STOCK_SESSION_KEYS = new Set(["id","sessionNumber","title","academicYear","verificationDate","scopeType","shelfCodeFilter","titleIdFilter","categoryFilter","subjectFilter","status","expectedCopyCount","verifiedCopyCount","presentCount","issuedOffsiteCount","knownRepairCount","missingCount","misShelvedCount","damagedCount","unexpectedCount","unresolvedCount","notes","cancellationReason","createdByUserId","startedByUserId","submittedByUserId","reviewedByUserId","approvedByUserId","lockedByUserId","cancelledByUserId","startedAt","submittedAt","reviewedAt","approvedAt","lockedAt","cancelledAt","createdAt","updatedAt"]);
const LIBRARY_STOCK_RECORD_KEYS = new Set(["id","sessionId","copyId","expectedAccessionNumberSnapshot","expectedBarcodeSnapshot","expectedTitleSnapshot","expectedShelfCodeSnapshot","expectedStatusSnapshot","expectedConditionSnapshot","expectedLoanStatusSnapshot","expectedBorrowerTypeSnapshot","expectedDueDateSnapshot","observationStatus","observedAt","observedShelfCode","observedCondition","scanMethod","observationNotes","discrepancyReason","resolutionStatus","resolutionNotes","appliedCopyEventId","observedByUserId","reviewedByUserId","appliedByUserId","createdAt","updatedAt"]);
const LIBRARY_STOCK_SCAN_KEYS = new Set(["id","sessionId","recordId","normalizedInput","scanMethod","resultType","scannedAt","notes","recordedByUserId","createdAt"]);
const LIBRARY_STOCK_EVENT_KEYS = new Set(["id","sessionId","eventType","eventDate","notes","recordedByUserId","createdAt"]);
const HOMEWORK_ASSIGNMENT_KEYS = new Set(["id","assignmentNumber","academicYear","title","instructions","className","section","subjectName","timetableSubjectId","assignedDate","dueDate","status","priority","resourceLink","teacherNotes","publicNotes","correctionReason","cancellationReason","createdByUserId","publishedByUserId","archivedByUserId","cancelledByUserId","publishedAt","archivedAt","cancelledAt","createdAt","updatedAt"]);
const HOMEWORK_EVENT_KEYS = new Set(["id","assignmentId","eventType","eventDate","titleSnapshot","instructionsSnapshot","dueDateSnapshot","reason","notes","recordedByUserId","createdAt"]);
const EXAM_CYCLE_KEYS = new Set(["id","examCode","academicYear","name","examType","startDate","endDate","status","description","cancellationReason","createdByUserId","openedByUserId","closedByUserId","approvedByUserId","lockedByUserId","cancelledByUserId","openedAt","closedAt","approvedAt","lockedAt","cancelledAt","createdAt","updatedAt"]);
const EXAM_ASSESSMENT_KEYS = new Set(["id","examCycleId","academicYear","className","section","subjectName","timetableSubjectId","componentName","assessmentType","maxMarks","passMarks","weightagePercent","entryStatus","instructions","createdByUserId","submittedByUserId","approvedByUserId","lockedByUserId","submittedAt","approvedAt","lockedAt","createdAt","updatedAt"]);
const STUDENT_MARK_KEYS = new Set(["id","assessmentId","studentId","academicYear","marksObtained","entryStatus","remarks","enteredByUserId","verifiedByUserId","enteredAt","verifiedAt","createdAt","updatedAt"]);
const STUDENT_MARK_EVENT_KEYS = new Set(["id","assessmentId","studentMarkId","eventType","previousMarks","newMarks","previousEntryStatus","newEntryStatus","reason","notes","actorLabel","eventDate","createdAt"]);
const STAFF_ATTENDANCE_SESSION_KEYS = new Set([
  "id", "attendanceDate", "academicYear", "status", "takenByUserId", "submittedByUserId", "lockedByUserId", "submittedAt", "lockedAt", "notes", "createdAt", "updatedAt"
]);
const STAFF_ATTENDANCE_RECORD_KEYS = new Set([
  "id", "sessionId", "staffMemberId", "staffCode", "status", "checkInTime", "checkOutTime", "lateMinutes", "remarks", "source", "createdAt", "updatedAt"
]);
const STAFF_LEAVE_REQUEST_KEYS = new Set([
  "id", "staffMemberId", "requestedByUserId", "leaveType", "startDate", "endDate", "halfDaySession", "totalDays", "reason", "status", "substituteRequired", "substituteNotes", "approverUserId", "approvedAt", "rejectedAt", "rejectionReason", "cancelledByUserId", "cancelledAt", "cancellationReason", "notes", "createdAt", "updatedAt"
]);
const SUBSTITUTE_ASSIGNMENT_KEYS = new Set([
  "id", "assignmentDate", "academicYear", "leaveRequestId", "absentStaffMemberId", "substituteStaffMemberId", "timetableAssignmentId", "className", "section", "subject", "periodLabel", "periodStartTime", "periodEndTime", "reason", "status", "priority", "notes", "assignedByUserId", "confirmedByUserId", "completedByUserId", "cancelledByUserId", "assignedAt", "confirmedAt", "completedAt", "cancelledAt", "cancellationReason", "createdAt", "updatedAt"
]);
const RECEIPT_NOTE_KEYS = new Set(["id", "receiptNo", "status", "remarks", "createdAt", "updatedAt"]);
const IMPORT_BATCH_KEYS = new Set([
  "id", "type", "fileName", "importedByUserId", "importedByName", "importedAt", "mode",
  "totalRows", "createdCount", "updatedCount", "skippedCount", "errorCount", "warningCount",
  "status", "notes", "detailsJson"
]);
const ONBOARDING_BATCH_KEYS = new Set([
  "id", "publicKey", "bundleType", "mode", "status", "version", "originalFileNameHash",
  "storageKey", "workbookSha256", "mimeType", "byteSize", "templateVersion", "schemaVersion",
  "referenceVersionHash", "targetVersionHash", "planHash", "planVersion", "planSummaryJson",
  "planExpiresAt", "approvedAt", "executionIdempotencyKey", "executionPayloadHash", "executedAt",
  "executionResultJson", "rollbackPreviewJson", "rolledBackAt", "purgeAfter", "purgedAt",
  "createdAt", "updatedAt"
]);
const ONBOARDING_ROW_OUTCOME_KEYS = new Set([
  "id", "batchId", "entityType", "sheetName", "sourceRowNumber", "importRowKey", "action",
  "status", "targetRecordId", "beforeHash", "afterHash", "issueCodesJson", "createdAt"
]);
const ONBOARDING_AUDIT_EVENT_KEYS = new Set([
  "id", "batchId", "sequence", "eventType", "previousStatus", "newStatus", "evidenceHash", "occurredAt"
]);
const GO_LIVE_CHECKLIST_KEYS = new Set([
  "id", "backupTaken", "schoolSettingsVerified", "realUsersCreated", "defaultPasswordsChanged",
  "studentMasterImported", "randomStudentsVerified", "paymentTrialCompleted", "paymentTotalsMatched",
  "randomPaymentsVerified", "testReceiptPrinted", "pendingDuesChecked", "backupAfterImportTaken",
  "updatedBy", "updatedAt", "createdAt"
]);
const TIMETABLE_TEACHER_KEYS = new Set([
  "id", "name", "shortName", "department", "phone", "email", "isActive",
  "maxPeriodsPerWeek", "maxPeriodsPerDay", "preferredFreePeriods", "notes",
  "createdAt", "updatedAt"
]);
const TIMETABLE_SUBJECT_KEYS = new Set([
  "id", "name", "shortName", "department", "isLabSubject", "isActivitySubject",
  "allowConsecutivePeriods", "isActive", "notes", "createdAt", "updatedAt"
]);
const TIMETABLE_CLASS_SECTION_KEYS = new Set([
  "id", "className", "section", "displayName", "groupName", "academicYear",
  "isActive", "createdAt", "updatedAt"
]);
const TIMETABLE_PERIOD_TEMPLATE_KEYS = new Set([
  "id", "academicYear", "groupName", "classGroup", "dayOfWeek", "periodNumber",
  "label", "startTime", "endTime", "type", "isTeachingPeriod", "sortOrder", "isDefault"
]);
const TIMETABLE_ASSIGNMENT_KEYS = new Set([
  "id", "academicYear", "classSectionId", "subjectId", "teacherId", "periodsPerWeek",
  "allowConsecutiveOverride", "priority", "notes", "createdAt", "updatedAt"
]);
const TIMETABLE_UNAVAILABILITY_KEYS = new Set([
  "id", "teacherId", "dayOfWeek", "periodNumber", "reason", "createdAt", "updatedAt"
]);
const TIMETABLE_FIXED_PERIOD_KEYS = new Set([
  "id", "academicYear", "classSectionId", "teacherId", "subjectId", "dayOfWeek",
  "periodNumber", "label", "reason", "createdAt", "updatedAt"
]);
const TIMETABLE_DRAFT_KEYS = new Set([
  "id", "academicYear", "name", "status", "notes", "createdByUserId", "createdAt", "updatedAt"
]);
const TIMETABLE_ENTRY_KEYS = new Set([
  "id", "draftId", "academicYear", "classSectionId", "dayOfWeek", "periodNumber",
  "assignmentId", "teacherId", "subjectId", "label", "entryType", "isLocked", "notes",
  "createdAt", "updatedAt"
]);
const IMPORT_BATCH_TYPES = new Set(["STUDENTS", "PAYMENTS", "GUARDIANS", "STAFF", "LIBRARY_TITLES", "LIBRARY_COPIES"]);
const IMPORT_BATCH_STATUSES = new Set(["DRY_RUN", "COMPLETED", "FAILED", "PARTIAL"]);
const CHECKLIST_BOOLEAN_KEYS = [...GO_LIVE_CHECKLIST_KEYS].filter(
  (key) => !["id", "updatedBy", "updatedAt", "createdAt"].includes(key)
);
const SCHOOL_SETTINGS_KEYS = new Set([
  "id", "schoolName", "addressLine1", "city", "phone", "academicYear",
  "receiptPrefix", "defaultCurrency", "whatsappReminderFooter", "logoPath",
  "receiptTitle", "showSchoolPhone", "showSchoolAddress", "defaultPrintSize",
  "signatureLabel"
]);

export type RestoreRecord = Record<string, unknown>;

export type ValidatedBackup = {
  metadata: {
    appName: string;
    academicYear: string;
    generatedAt: string;
    generatedBy: string;
    appVersion?: string;
    backupVersion?: number;
    counts?: Record<string, number>;
  };
  schoolSettings: RestoreRecord | null;
  students: RestoreRecord[];
  feeStructures: RestoreRecord[];
  payments: RestoreRecord[];
  paymentAudits: RestoreRecord[];
  users: RestoreRecord[];
  authSecurity: AuthSecurityBackup;
  iamAccess: IamAccessBackup;
  rolePermissions: RestoreRecord[];
  guardians: RestoreRecord[];
  studentGuardians: RestoreRecord[];
  notices: RestoreRecord[];
  staffMembers: RestoreRecord[];
  studentAttendanceSessions: RestoreRecord[];
  studentAttendanceRecords: RestoreRecord[];
  staffAttendanceSessions: RestoreRecord[];
  staffAttendanceRecords: RestoreRecord[];
  staffLeaveRequests: RestoreRecord[];
  substituteAssignments: RestoreRecord[];
  academicYearEnrollments: RestoreRecord[];
  studentLifecycleEvents: RestoreRecord[];
  studentProgressionDecisions: RestoreRecord[];
  vendors: RestoreRecord[];
  expenseCategories: RestoreRecord[];
  expenseDepartments: RestoreRecord[];
  expenseRecords: RestoreRecord[];
  expensePayments: RestoreRecord[];
  expenseAudits: RestoreRecord[];
  budgetPlans: RestoreRecord[];
  budgetAllocations: RestoreRecord[];
  budgetRevisions: RestoreRecord[];
  miscIncomeItems: RestoreRecord[];
  miscIncomeRates: RestoreRecord[];
  miscIncomeReceipts: RestoreRecord[];
  miscIncomeReceiptLines: RestoreRecord[];
  cashBookDays: RestoreRecord[];
  cashBookMovements: RestoreRecord[];
  bookCatalogItems: RestoreRecord[];
  bookCatalogRates: RestoreRecord[];
  bookSaleReceipts: RestoreRecord[];
  bookSaleReceiptLines: RestoreRecord[];
  bookCashSettlements: RestoreRecord[];
  libraryTitles: RestoreRecord[];
  libraryCopies: RestoreRecord[];
  libraryCopyEvents: RestoreRecord[];
  libraryMembers: RestoreRecord[];
  libraryPolicies: RestoreRecord[];
  libraryLoans: RestoreRecord[];
  libraryReservations: RestoreRecord[];
  libraryLoanEvents: RestoreRecord[];
  libraryIncidents: RestoreRecord[];
  libraryChargeRules: RestoreRecord[];
  libraryCharges: RestoreRecord[];
  libraryChargeEvents: RestoreRecord[];
  libraryStockVerificationSessions: RestoreRecord[];
  libraryStockVerificationRecords: RestoreRecord[];
  libraryStockVerificationScanEvents: RestoreRecord[];
  libraryStockVerificationEvents: RestoreRecord[];
  homeworkAssignments: RestoreRecord[];
  homeworkAssignmentEvents: RestoreRecord[];
  classworkItems: RestoreRecord[];
  classworkItemVersions: RestoreRecord[];
  classworkSubmissions: RestoreRecord[];
  classworkSubmissionVersions: RestoreRecord[];
  classworkAttachments: RestoreRecord[];
  classworkFeedback: RestoreRecord[];
  classworkAuditEvents: RestoreRecord[];
  academicReportDefinitions: RestoreRecord[];
  academicReportRuns: RestoreRecord[];
  academicReportSourceReferences: RestoreRecord[];
  academicReportAuditEvents: RestoreRecord[];
  examCycles: RestoreRecord[];
  examAssessments: RestoreRecord[];
  studentMarks: RestoreRecord[];
  studentMarkEvents: RestoreRecord[];
  examGovernance: ExamGovernanceBackup;
  gradingSchemes: RestoreRecord[];
  gradeBands: RestoreRecord[];
  reportCardTemplates: RestoreRecord[];
  reportCardBatches: RestoreRecord[];
  reportCardBatchExamSources: RestoreRecord[];
  studentReportCards: RestoreRecord[];
  studentReportCardVersions: RestoreRecord[];
  studentReportCardEvents: RestoreRecord[];
  academicCalendarVersions: RestoreRecord[];
  operationalCalendarDays: RestoreRecord[];
  schoolCalendarEvents: RestoreRecord[];
  schoolCalendarEventVersions: RestoreRecord[];
  academicCalendarAuditEvents: RestoreRecord[];
  teacherAnalyticsReviewCycles: RestoreRecord[];
  teacherAnalyticsSnapshots: RestoreRecord[];
  teacherAnalyticsReviews: RestoreRecord[];
  teacherAnalyticsEvents: RestoreRecord[];
  certificateNumberSeries: RestoreRecord[];
  certificateTemplates: RestoreRecord[];
  studentCertificateRequests: RestoreRecord[];
  studentCertificates: RestoreRecord[];
  studentCertificateVersions: RestoreRecord[];
  studentCertificateEvents: RestoreRecord[];
  classXPackageTemplates: RestoreRecord[];
  classXDocumentPackages: RestoreRecord[];
  classXPackageDocumentItems: RestoreRecord[];
  classXPackageChargeRules: RestoreRecord[];
  classXPackageCharges: RestoreRecord[];
  classXPackageHandovers: RestoreRecord[];
  classXPackageEvents: RestoreRecord[];
  identityCardNumberSeries: RestoreRecord[];
  identityCardTemplates: RestoreRecord[];
  identityCardBatches: RestoreRecord[];
  identityCards: RestoreRecord[];
  identityCardVersions: RestoreRecord[];
  identityCardEvents: RestoreRecord[];
  notificationTemplates: RestoreRecord[];
  notificationCampaigns: RestoreRecord[];
  notificationRecipients: RestoreRecord[];
  notificationSkippedRecipients: RestoreRecord[];
  notificationEvents: RestoreRecord[];
  whatsAppIntegrationProfiles: RestoreRecord[];
  whatsAppConsents: RestoreRecord[];
  whatsAppConsentEvents: RestoreRecord[];
  whatsAppTemplateMappings: RestoreRecord[];
  whatsAppOutboundBatches: RestoreRecord[];
  whatsAppDeliveries: RestoreRecord[];
  whatsAppDeliveryAttempts: RestoreRecord[];
  whatsAppWebhookEvents: RestoreRecord[];
  whatsAppOperationalEvents: RestoreRecord[];
  whatsAppRateReferences: RestoreRecord[];
  smsEmailIntegrationProfiles: RestoreRecord[];
  smsEmailConsents: RestoreRecord[];
  smsEmailConsentEvents: RestoreRecord[];
  smsEmailTemplateMappings: RestoreRecord[];
  smsEmailOutboundBatches: RestoreRecord[];
  smsEmailDeliveries: RestoreRecord[];
  smsEmailDeliveryAttempts: RestoreRecord[];
  smsEmailWebhookEvents: RestoreRecord[];
  smsEmailOperationalEvents: RestoreRecord[];
  smsEmailSuppressions: RestoreRecord[];
  smsEmailCostRates: RestoreRecord[];
  aiAssistantProfiles: RestoreRecord[];
  aiAssistantSourcePolicies: RestoreRecord[];
  aiAssistantQueryAudits: RestoreRecord[];
  aiAssistantSafetyEvents: RestoreRecord[];
  aiAssistantEvaluationCases: RestoreRecord[];
  aiAssistantEvaluationRuns: RestoreRecord[];
  feeRegisterOcrProfiles: RestoreRecord[];
  feeRegisterOcrBatches: RestoreRecord[];
  feeRegisterOcrPages: RestoreRecord[];
  feeRegisterOcrRows: RestoreRecord[];
  feeRegisterOcrRowRevisions: RestoreRecord[];
  feeRegisterOcrPostingRuns: RestoreRecord[];
  feeRegisterOcrEvents: RestoreRecord[];
  cloudBackupProfiles: RestoreRecord[];
  cloudBackupSchedules: RestoreRecord[];
  cloudBackupRetentionPolicies: RestoreRecord[];
  cloudBackupRuns: RestoreRecord[];
  cloudBackupArtifacts: RestoreRecord[];
  cloudBackupVerifications: RestoreRecord[];
  cloudBackupRestoreRehearsals: RestoreRecord[];
  cloudBackupEvents: RestoreRecord[];
  publicWebsiteSettings: RestoreRecord[];
  publicWebsitePages: RestoreRecord[];
  publicWebsitePageVersions: RestoreRecord[];
  publicWebsitePosts: RestoreRecord[];
  publicWebsitePostVersions: RestoreRecord[];
  publicWebsiteNavigationItems: RestoreRecord[];
  publicWebsiteEvents: RestoreRecord[];
  receiptNotes: RestoreRecord[];
  importBatches: RestoreRecord[];
  onboardingBatches: RestoreRecord[];
  onboardingRowOutcomes: RestoreRecord[];
  onboardingAuditEvents: RestoreRecord[];
  goLiveChecklist: RestoreRecord[];
  timetableTeachers: RestoreRecord[];
  timetableSubjects: RestoreRecord[];
  timetableClassSections: RestoreRecord[];
  timetablePeriodTemplates: RestoreRecord[];
  timetableAssignments: RestoreRecord[];
  timetableTeacherUnavailability: RestoreRecord[];
  timetableFixedPeriods: RestoreRecord[];
  timetableDrafts: RestoreRecord[];
  timetableEntries: RestoreRecord[];
  technicalOperations: TechnicalOperationsBackup;
} & AdmissionsBackup & PayrollBackup & PayslipRequestBackup & SupportBackup & SafeExitBackup & FamilyCollectionBackup;

export type EntityRestoreResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  warnings: string[];
};

export type RestoreResult = {
  technicalOperations: EntityRestoreResult;
  schoolSettings: EntityRestoreResult;
  students: EntityRestoreResult;
  feeStructures: EntityRestoreResult;
  payments: EntityRestoreResult;
  paymentAudits: EntityRestoreResult;
  familyCollections: EntityRestoreResult;
  familyCollectionInstruments: EntityRestoreResult;
  familyStudentAllocations: EntityRestoreResult;
  allocationInstrumentShares: EntityRestoreResult;
  familyReceiptVersions: EntityRestoreResult;
  familyCollectionEvents: EntityRestoreResult;
  familyProviderAllocationPlans: EntityRestoreResult;
  users: EntityRestoreResult;
  authSecurity: EntityRestoreResult;
  iamAccess: EntityRestoreResult;
  rolePermissions: EntityRestoreResult;
  guardians: EntityRestoreResult;
  studentGuardians: EntityRestoreResult;
  notices: EntityRestoreResult;
  staffMembers: EntityRestoreResult;
  studentAttendanceSessions: EntityRestoreResult;
  studentAttendanceRecords: EntityRestoreResult;
  staffAttendanceSessions: EntityRestoreResult;
  staffAttendanceRecords: EntityRestoreResult;
  staffLeaveRequests: EntityRestoreResult;
  substituteAssignments: EntityRestoreResult;
  academicYearEnrollments: EntityRestoreResult;
  studentLifecycleEvents: EntityRestoreResult;
  studentProgressionDecisions: EntityRestoreResult;
  vendors: EntityRestoreResult;
  expenseCategories: EntityRestoreResult;
  expenseDepartments: EntityRestoreResult;
  expenseRecords: EntityRestoreResult;
  expensePayments: EntityRestoreResult;
  expenseAudits: EntityRestoreResult;
  budgetPlans: EntityRestoreResult;
  budgetAllocations: EntityRestoreResult;
  budgetRevisions: EntityRestoreResult;
  miscIncomeItems: EntityRestoreResult;
  miscIncomeRates: EntityRestoreResult;
  miscIncomeReceipts: EntityRestoreResult;
  miscIncomeReceiptLines: EntityRestoreResult;
  cashBookDays: EntityRestoreResult;
  cashBookMovements: EntityRestoreResult;
  bookCatalogItems: EntityRestoreResult;
  bookCatalogRates: EntityRestoreResult;
  bookSaleReceipts: EntityRestoreResult;
  bookSaleReceiptLines: EntityRestoreResult;
  bookCashSettlements: EntityRestoreResult;
  libraryTitles: EntityRestoreResult;
  libraryCopies: EntityRestoreResult;
  libraryCopyEvents: EntityRestoreResult;
  libraryMembers: EntityRestoreResult;
  libraryPolicies: EntityRestoreResult;
  libraryLoans: EntityRestoreResult;
  libraryReservations: EntityRestoreResult;
  libraryLoanEvents: EntityRestoreResult;
  libraryIncidents: EntityRestoreResult;
  libraryChargeRules: EntityRestoreResult;
  libraryCharges: EntityRestoreResult;
  libraryChargeEvents: EntityRestoreResult;
  libraryStockVerificationSessions: EntityRestoreResult;
  libraryStockVerificationRecords: EntityRestoreResult;
  libraryStockVerificationScanEvents: EntityRestoreResult;
  libraryStockVerificationEvents: EntityRestoreResult;
  homeworkAssignments: EntityRestoreResult;
  homeworkAssignmentEvents: EntityRestoreResult;
  classworkItems: EntityRestoreResult;
  classworkItemVersions: EntityRestoreResult;
  classworkSubmissions: EntityRestoreResult;
  classworkSubmissionVersions: EntityRestoreResult;
  classworkAttachments: EntityRestoreResult;
  classworkFeedback: EntityRestoreResult;
  classworkAuditEvents: EntityRestoreResult;
  academicReportDefinitions: EntityRestoreResult;
  academicReportRuns: EntityRestoreResult;
  academicReportSourceReferences: EntityRestoreResult;
  academicReportAuditEvents: EntityRestoreResult;
  examCycles: EntityRestoreResult;
  examAssessments: EntityRestoreResult;
  studentMarks: EntityRestoreResult;
  studentMarkEvents: EntityRestoreResult;
  examGovernance: EntityRestoreResult;
  gradingSchemes: EntityRestoreResult;
  gradeBands: EntityRestoreResult;
  reportCardTemplates: EntityRestoreResult;
  reportCardBatches: EntityRestoreResult;
  reportCardBatchExamSources: EntityRestoreResult;
  studentReportCards: EntityRestoreResult;
  studentReportCardVersions: EntityRestoreResult;
  studentReportCardEvents: EntityRestoreResult;
  academicCalendarVersions: EntityRestoreResult;
  operationalCalendarDays: EntityRestoreResult;
  schoolCalendarEvents: EntityRestoreResult;
  schoolCalendarEventVersions: EntityRestoreResult;
  academicCalendarAuditEvents: EntityRestoreResult;
  teacherAnalyticsReviewCycles: EntityRestoreResult;
  teacherAnalyticsSnapshots: EntityRestoreResult;
  teacherAnalyticsReviews: EntityRestoreResult;
  teacherAnalyticsEvents: EntityRestoreResult;
  certificateNumberSeries: EntityRestoreResult;
  certificateTemplates: EntityRestoreResult;
  studentCertificateRequests: EntityRestoreResult;
  studentCertificates: EntityRestoreResult;
  studentCertificateVersions: EntityRestoreResult;
  studentCertificateEvents: EntityRestoreResult;
  classXPackageTemplates: EntityRestoreResult;
  classXDocumentPackages: EntityRestoreResult;
  classXPackageDocumentItems: EntityRestoreResult;
  classXPackageChargeRules: EntityRestoreResult;
  classXPackageCharges: EntityRestoreResult;
  classXPackageHandovers: EntityRestoreResult;
  classXPackageEvents: EntityRestoreResult;
  identityCardNumberSeries: EntityRestoreResult;
  identityCardTemplates: EntityRestoreResult;
  identityCardBatches: EntityRestoreResult;
  identityCards: EntityRestoreResult;
  identityCardVersions: EntityRestoreResult;
  identityCardEvents: EntityRestoreResult;
  notificationTemplates: EntityRestoreResult;
  notificationCampaigns: EntityRestoreResult;
  notificationRecipients: EntityRestoreResult;
  notificationSkippedRecipients: EntityRestoreResult;
  notificationEvents: EntityRestoreResult;
  whatsAppIntegrationProfiles: EntityRestoreResult;
  whatsAppConsents: EntityRestoreResult;
  whatsAppConsentEvents: EntityRestoreResult;
  whatsAppTemplateMappings: EntityRestoreResult;
  whatsAppOutboundBatches: EntityRestoreResult;
  whatsAppDeliveries: EntityRestoreResult;
  whatsAppDeliveryAttempts: EntityRestoreResult;
  whatsAppWebhookEvents: EntityRestoreResult;
  whatsAppOperationalEvents: EntityRestoreResult;
  whatsAppRateReferences: EntityRestoreResult;
  smsEmailIntegrationProfiles: EntityRestoreResult;
  smsEmailConsents: EntityRestoreResult;
  smsEmailConsentEvents: EntityRestoreResult;
  smsEmailTemplateMappings: EntityRestoreResult;
  smsEmailOutboundBatches: EntityRestoreResult;
  smsEmailDeliveries: EntityRestoreResult;
  smsEmailDeliveryAttempts: EntityRestoreResult;
  smsEmailWebhookEvents: EntityRestoreResult;
  smsEmailOperationalEvents: EntityRestoreResult;
  smsEmailSuppressions: EntityRestoreResult;
  smsEmailCostRates: EntityRestoreResult;
  aiAssistantProfiles: EntityRestoreResult;
  aiAssistantSourcePolicies: EntityRestoreResult;
  aiAssistantQueryAudits: EntityRestoreResult;
  aiAssistantSafetyEvents: EntityRestoreResult;
  aiAssistantEvaluationCases: EntityRestoreResult;
  aiAssistantEvaluationRuns: EntityRestoreResult;
  feeRegisterOcrProfiles: EntityRestoreResult;
  feeRegisterOcrBatches: EntityRestoreResult;
  feeRegisterOcrPages: EntityRestoreResult;
  feeRegisterOcrRows: EntityRestoreResult;
  feeRegisterOcrRowRevisions: EntityRestoreResult;
  feeRegisterOcrPostingRuns: EntityRestoreResult;
  feeRegisterOcrEvents: EntityRestoreResult;
  cloudBackupProfiles: EntityRestoreResult;
  cloudBackupSchedules: EntityRestoreResult;
  cloudBackupRetentionPolicies: EntityRestoreResult;
  cloudBackupRuns: EntityRestoreResult;
  cloudBackupArtifacts: EntityRestoreResult;
  cloudBackupVerifications: EntityRestoreResult;
  cloudBackupRestoreRehearsals: EntityRestoreResult;
  cloudBackupEvents: EntityRestoreResult;
  publicWebsiteSettings: EntityRestoreResult;
  publicWebsitePages: EntityRestoreResult;
  publicWebsitePageVersions: EntityRestoreResult;
  publicWebsitePosts: EntityRestoreResult;
  publicWebsitePostVersions: EntityRestoreResult;
  publicWebsiteNavigationItems: EntityRestoreResult;
  publicWebsiteEvents: EntityRestoreResult;
  receiptNotes: EntityRestoreResult;
  importBatches: EntityRestoreResult;
  onboardingBatches: EntityRestoreResult;
  onboardingRowOutcomes: EntityRestoreResult;
  onboardingAuditEvents: EntityRestoreResult;
  goLiveChecklist: EntityRestoreResult;
  timetableTeachers: EntityRestoreResult;
  timetableSubjects: EntityRestoreResult;
  timetableClassSections: EntityRestoreResult;
  timetablePeriodTemplates: EntityRestoreResult;
  timetableAssignments: EntityRestoreResult;
  timetableTeacherUnavailability: EntityRestoreResult;
  timetableFixedPeriods: EntityRestoreResult;
  timetableDrafts: EntityRestoreResult;
  timetableEntries: EntityRestoreResult;
  warnings: string[];
} & Record<AdmissionsBackupKey | PayrollBackupKey | PayslipRequestBackupKey | SupportBackupKey | SafeExitBackupKey, EntityRestoreResult>;

export function parseAndValidateBackup(input: string | unknown): ValidatedBackup {
  let parsed: unknown = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error("Invalid backup JSON");
    }
  }

  const root = requireRecord(parsed, "Backup");
  rejectUnknownKeys(root, TOP_LEVEL_KEYS, "Backup");

  const metadata = requireRecord(root.metadata, "Backup metadata");
  rejectUnknownKeys(metadata, METADATA_KEYS, "Backup metadata");
  const appName = requireString(metadata.appName, "metadata.appName");
  if (appName !== APP_NAME) {
    throw new Error(`Unsupported backup appName: ${appName}`);
  }
  if (
    metadata.backupVersion !== undefined &&
    (!Number.isInteger(metadata.backupVersion) ||
      Number(metadata.backupVersion) < 1 ||
      Number(metadata.backupVersion) > 41)
  ) {
    throw new Error("metadata.backupVersion is unsupported");
  }
  const generatedAt = requireString(metadata.generatedAt, "metadata.generatedAt");
  if (Number.isNaN(new Date(generatedAt).getTime())) {
    throw new Error("metadata.generatedAt must be a valid date");
  }

  const schoolSettings = validateOptionalSchoolSettings(root.schoolSettings);
  const students = validateRows(root.students, "students", STUDENT_KEYS, ["admissionNo"]);
  const feeStructures = validateRows(
    root.feeStructures,
    "feeStructures",
    FEE_STRUCTURE_KEYS,
    ["academicYear", "className"]
  );
  const payments = validateRows(
    root.payments,
    "payments",
    PAYMENT_KEYS,
    ["receiptNo", "date", "amountPaid", "paymentMode", "receivedAccount"]
  );
  payments.forEach((payment, index) => {
    if (!hasValue(payment.admissionNo) && !hasValue(payment.studentId)) {
      throw new Error(`payments[${index}] requires admissionNo or studentId`);
    }
  });

  const paymentAudits = validateOptionalRows(
    root.paymentAudits,
    "paymentAudits",
    PAYMENT_AUDIT_KEYS,
    ["paymentId", "action"]
  );
  const familyCollectionBackup = validateFamilyCollectionBackupRows(root);
  const users = validateOptionalRows(root.users, "users", USER_KEYS, ["username"])
    .map(sanitizeRestoreUser);
  const rolePermissions = validateOptionalRows(
    root.rolePermissions,
    "rolePermissions",
    ROLE_PERMISSION_KEYS,
    ["role", "permission", "enabled"]
  ).map(validateRolePermissionRow);
  const guardians = validateOptionalRows(
    root.guardians,
    "guardians",
    GUARDIAN_KEYS,
    ["id", "displayName", "primaryMobile"]
  );
  const studentGuardians = validateOptionalRows(
    root.studentGuardians,
    "studentGuardians",
    STUDENT_GUARDIAN_KEYS,
    ["guardianId", "studentId"]
  );
  const notices = validateOptionalRows(
    root.notices,
    "notices",
    NOTICE_KEYS,
    ["id", "title", "body", "audienceType", "status"]
  );
  const staffMembers = validateOptionalRows(root.staffMembers, "staffMembers", STAFF_MEMBER_KEYS, ["id", "fullName", "staffType", "designation", "status"]);
  staffMembers.forEach((row, index) => {
    if (!["TEACHING", "NON_TEACHING", "ADMIN", "SUPPORT", "OTHER"].includes(requireString(row.staffType, `staffMembers[${index}].staffType`))) throw new Error(`staffMembers[${index}].staffType is not supported`);
    if (!["ACTIVE", "INACTIVE", "LEFT"].includes(requireString(row.status, `staffMembers[${index}].status`))) throw new Error(`staffMembers[${index}].status is not supported`);
    if (hasValue(row.dateOfJoining)) requireDateString(row.dateOfJoining, `staffMembers[${index}].dateOfJoining`);
    if (hasValue(row.experienceYears)) {
      const years = Number(row.experienceYears);
      if (!Number.isFinite(years) || years < 0 || years > 80) throw new Error(`staffMembers[${index}].experienceYears must be between 0 and 80`);
    }
  });
  const studentAttendanceSessions = validateOptionalRows(root.studentAttendanceSessions, "studentAttendanceSessions", STUDENT_ATTENDANCE_SESSION_KEYS, ["id", "attendanceDate", "className", "section", "academicYear", "status"]);
  studentAttendanceSessions.forEach((row, index) => {
    if (!["DRAFT", "SUBMITTED", "LOCKED"].includes(requireString(row.status, `studentAttendanceSessions[${index}].status`))) throw new Error(`studentAttendanceSessions[${index}].status is not supported`);
    requireDateString(row.attendanceDate, `studentAttendanceSessions[${index}].attendanceDate`);
    if (hasValue(row.submittedAt)) requireDateString(row.submittedAt, `studentAttendanceSessions[${index}].submittedAt`);
    if (hasValue(row.lockedAt)) requireDateString(row.lockedAt, `studentAttendanceSessions[${index}].lockedAt`);
  });
  const studentAttendanceRecords = validateOptionalRows(root.studentAttendanceRecords, "studentAttendanceRecords", STUDENT_ATTENDANCE_RECORD_KEYS, ["id", "sessionId", "studentId", "admissionNo", "status"]);
  studentAttendanceRecords.forEach((row, index) => {
    if (!["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED"].includes(requireString(row.status, `studentAttendanceRecords[${index}].status`))) throw new Error(`studentAttendanceRecords[${index}].status is not supported`);
  });
  const staffAttendanceSessions = validateOptionalRows(root.staffAttendanceSessions, "staffAttendanceSessions", STAFF_ATTENDANCE_SESSION_KEYS, ["id", "attendanceDate", "status"]);
  staffAttendanceSessions.forEach((row, index) => {
    if (!["DRAFT", "SUBMITTED", "LOCKED"].includes(requireString(row.status, `staffAttendanceSessions[${index}].status`))) throw new Error(`staffAttendanceSessions[${index}].status is not supported`);
    requireDateString(row.attendanceDate, `staffAttendanceSessions[${index}].attendanceDate`);
    if (hasValue(row.submittedAt)) requireDateString(row.submittedAt, `staffAttendanceSessions[${index}].submittedAt`);
    if (hasValue(row.lockedAt)) requireDateString(row.lockedAt, `staffAttendanceSessions[${index}].lockedAt`);
  });
  const staffAttendanceRecords = validateOptionalRows(root.staffAttendanceRecords, "staffAttendanceRecords", STAFF_ATTENDANCE_RECORD_KEYS, ["id", "sessionId", "staffMemberId", "status", "source"]);
  staffAttendanceRecords.forEach((row, index) => {
    if (!["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE", "EXCUSED"].includes(requireString(row.status, `staffAttendanceRecords[${index}].status`))) throw new Error(`staffAttendanceRecords[${index}].status is not supported`);
    if (!["MANUAL", "IMPORT", "BIOMETRIC_FUTURE"].includes(requireString(row.source, `staffAttendanceRecords[${index}].source`))) throw new Error(`staffAttendanceRecords[${index}].source is not supported`);
    if (hasValue(row.lateMinutes) && (!Number.isInteger(Number(row.lateMinutes)) || Number(row.lateMinutes) < 0 || Number(row.lateMinutes) > 1440)) throw new Error(`staffAttendanceRecords[${index}].lateMinutes is invalid`);
  });
  const staffLeaveRequests = validateOptionalRows(root.staffLeaveRequests, "staffLeaveRequests", STAFF_LEAVE_REQUEST_KEYS, ["id", "staffMemberId", "leaveType", "startDate", "endDate", "totalDays", "status"]);
  staffLeaveRequests.forEach((row, index) => {
    if (!["CASUAL", "SICK", "EMERGENCY", "PERMISSION", "HALF_DAY", "UNPAID", "OTHER"].includes(requireString(row.leaveType, `staffLeaveRequests[${index}].leaveType`))) throw new Error(`staffLeaveRequests[${index}].leaveType is not supported`);
    if (!["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(requireString(row.status, `staffLeaveRequests[${index}].status`))) throw new Error(`staffLeaveRequests[${index}].status is not supported`);
    if (row.status !== "DRAFT" && !hasValue(row.reason)) throw new Error(`staffLeaveRequests[${index}].reason is required for submitted leave`);
    requireDateString(row.startDate, `staffLeaveRequests[${index}].startDate`);
    requireDateString(row.endDate, `staffLeaveRequests[${index}].endDate`);
    for (const field of ["approvedAt", "rejectedAt", "cancelledAt"] as const) if (hasValue(row[field])) requireDateString(row[field], `staffLeaveRequests[${index}].${field}`);
    const days = Number(row.totalDays); if (!Number.isFinite(days) || days <= 0) throw new Error(`staffLeaveRequests[${index}].totalDays must be positive`);
    if (hasValue(row.halfDaySession) && !["FORENOON", "AFTERNOON"].includes(requireString(row.halfDaySession, `staffLeaveRequests[${index}].halfDaySession`))) throw new Error(`staffLeaveRequests[${index}].halfDaySession is not supported`);
  });
  const substituteAssignments = validateOptionalRows(root.substituteAssignments, "substituteAssignments", SUBSTITUTE_ASSIGNMENT_KEYS, ["id", "assignmentDate", "absentStaffMemberId", "reason", "status", "priority"]);
  substituteAssignments.forEach((row,index)=>{
    if(!["APPROVED_LEAVE","STAFF_ABSENT","EMERGENCY","MANUAL","OTHER"].includes(requireString(row.reason,`substituteAssignments[${index}].reason`)))throw new Error(`substituteAssignments[${index}].reason is not supported`);
    if(!["DRAFT","ASSIGNED","CONFIRMED","COMPLETED","CANCELLED"].includes(requireString(row.status,`substituteAssignments[${index}].status`)))throw new Error(`substituteAssignments[${index}].status is not supported`);
    if(!["NORMAL","URGENT"].includes(requireString(row.priority,`substituteAssignments[${index}].priority`)))throw new Error(`substituteAssignments[${index}].priority is not supported`);
    requireDateString(row.assignmentDate,`substituteAssignments[${index}].assignmentDate`);
    if(row.absentStaffMemberId===row.substituteStaffMemberId)throw new Error(`substituteAssignments[${index}] cannot use the absent staff member as substitute`);
    if(row.status==="CANCELLED"&&!hasValue(row.cancellationReason))throw new Error(`substituteAssignments[${index}].cancellationReason is required`);
    for(const field of ["assignedAt","confirmedAt","completedAt","cancelledAt"] as const)if(hasValue(row[field]))requireDateString(row[field],`substituteAssignments[${index}].${field}`);
  });
  const academicYearEnrollments = validateOptionalRows(root.academicYearEnrollments, "academicYearEnrollments", ACADEMIC_YEAR_ENROLLMENT_KEYS, ["id", "studentId", "academicYear", "className", "status"]);
  academicYearEnrollments.forEach((row, index) => {
    if (!["ACTIVE", "PROMOTED", "REPEATED", "TRANSFERRED_OUT", "LEFT", "DROPPED_OUT", "PASSED_OUT", "ALUMNI", "INACTIVE"].includes(requireString(row.status, `academicYearEnrollments[${index}].status`))) throw new Error(`academicYearEnrollments[${index}].status is not supported`);
    if (hasValue(row.enrollmentDate)) requireDateString(row.enrollmentDate, `academicYearEnrollments[${index}].enrollmentDate`);
    if (hasValue(row.exitDate)) requireDateString(row.exitDate, `academicYearEnrollments[${index}].exitDate`);
  });
  const studentLifecycleEvents = validateOptionalRows(root.studentLifecycleEvents, "studentLifecycleEvents", STUDENT_LIFECYCLE_EVENT_KEYS, ["id", "studentId", "eventType", "effectiveDate"]);
  studentLifecycleEvents.forEach((row, index) => {
    if (!["ENROLLED", "STATUS_UPDATED", "PROMOTED", "REPEATED", "TRANSFERRED_OUT", "LEFT", "DROPPED_OUT", "PASSED_OUT", "REJOINED", "CORRECTION"].includes(requireString(row.eventType, `studentLifecycleEvents[${index}].eventType`))) throw new Error(`studentLifecycleEvents[${index}].eventType is not supported`);
    requireDateString(row.effectiveDate, `studentLifecycleEvents[${index}].effectiveDate`);
  });
  const studentProgressionDecisions = validateOptionalRows(root.studentProgressionDecisions, "studentProgressionDecisions", STUDENT_PROGRESSION_DECISION_KEYS, ["id", "studentId", "academicYear", "decisionType", "status", "effectiveDate"]);
  studentProgressionDecisions.forEach((row, index) => {
    if (!["PROMOTE", "REPEAT", "TRANSFER_OUT", "LEFT", "DROPPED_OUT", "PASSED_OUT", "CORRECTION"].includes(requireString(row.decisionType, `studentProgressionDecisions[${index}].decisionType`))) throw new Error(`studentProgressionDecisions[${index}].decisionType is not supported`);
    if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "FINALIZED", "CANCELLED"].includes(requireString(row.status, `studentProgressionDecisions[${index}].status`))) throw new Error(`studentProgressionDecisions[${index}].status is not supported`);
    requireDateString(row.effectiveDate, `studentProgressionDecisions[${index}].effectiveDate`);
    if (row.status === "REJECTED" && !hasValue(row.rejectionReason)) throw new Error(`studentProgressionDecisions[${index}].rejectionReason is required`);
    if (row.status === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`studentProgressionDecisions[${index}].cancellationReason is required`);
    for (const field of ["submittedAt", "approvedAt", "finalizedAt", "cancelledAt"] as const) if (hasValue(row[field])) requireDateString(row[field], `studentProgressionDecisions[${index}].${field}`);
  });
  const vendors = validateOptionalRows(root.vendors, "vendors", VENDOR_KEYS, ["id", "vendorCode", "name", "status"]);
  vendors.forEach((row, index) => validateRestoredVendor(row, `vendors[${index}]`));
  const expenseCategories = validateOptionalRows(root.expenseCategories, "expenseCategories", EXPENSE_CATEGORY_KEYS, ["id", "name", "status"]);
  const expenseDepartments = validateOptionalRows(root.expenseDepartments, "expenseDepartments", EXPENSE_DEPARTMENT_KEYS, ["id", "name", "status"]);
  for (const [label, rows] of [["expenseCategories", expenseCategories], ["expenseDepartments", expenseDepartments]] as const) rows.forEach((row, index) => { if (!["ACTIVE", "INACTIVE"].includes(requireString(row.status, label + "[" + index + "].status"))) throw new Error(label + "[" + index + "].status is not supported"); });
  const expenseRecords = validateOptionalRows(root.expenseRecords, "expenseRecords", EXPENSE_RECORD_KEYS, ["id", "expenseNumber", "expenseDate", "academicYear", "categoryId", "description", "grossAmount", "taxAmount", "deductionAmount", "netAmount", "paymentMethod", "paymentStatus", "approvalStatus"]);
  expenseRecords.forEach((row, index) => {
    const prefix = `expenseRecords[${index}]`;
    requireDateString(row.expenseDate, `${prefix}.expenseDate`);
    for (const field of ["invoiceDate", "chequeDate", "paidDate", "submittedAt", "approvedAt", "paidAt", "cancelledAt"] as const) if (hasValue(row[field])) requireDateString(row[field], `${prefix}.${field}`);
    const method = requireString(row.paymentMethod, `${prefix}.paymentMethod`);
    if (!["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "IMPS", "CHEQUE", "OTHER"].includes(method)) throw new Error(`${prefix}.paymentMethod is not supported`);
    const approvalStatus = requireString(row.approvalStatus, `${prefix}.approvalStatus`);
    const paymentStatus = requireString(row.paymentStatus, `${prefix}.paymentStatus`);
    if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"].includes(approvalStatus)) throw new Error(`${prefix}.approvalStatus is not supported`);
    if (!["UNPAID", "PARTIALLY_PAID", "PAID", "CANCELLED"].includes(paymentStatus)) throw new Error(`${prefix}.paymentStatus is not supported`);
    const gross = restoreMoneyCents(row.grossAmount, `${prefix}.grossAmount`, false);
    const tax = restoreMoneyCents(row.taxAmount, `${prefix}.taxAmount`);
    const deduction = restoreMoneyCents(row.deductionAmount, `${prefix}.deductionAmount`);
    const net = restoreMoneyCents(row.netAmount, `${prefix}.netAmount`, false);
    if (gross + tax - deduction !== net) throw new Error(`${prefix} has inconsistent amounts`);
    if (approvalStatus === "REJECTED" && !hasValue(row.rejectionReason)) throw new Error(`${prefix}.rejectionReason is required`);
    if (approvalStatus === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`${prefix}.cancellationReason is required`);
    if (approvalStatus === "CANCELLED" ? paymentStatus !== "CANCELLED" : paymentStatus === "CANCELLED") throw new Error(`${prefix} has inconsistent cancellation statuses`);
    if (approvalStatus !== "APPROVED" && approvalStatus !== "CANCELLED" && paymentStatus !== "UNPAID") throw new Error(`${prefix} cannot be paid before approval`);
  });
  const expensePayments = validateOptionalRows(root.expensePayments, "expensePayments", EXPENSE_PAYMENT_KEYS, ["id", "expenseRecordId", "paymentDate", "amount", "paymentMethod"]);
  expensePayments.forEach((row, index) => {
    const prefix = `expensePayments[${index}]`;
    requireDateString(row.paymentDate, `${prefix}.paymentDate`);
    restoreMoneyCents(row.amount, `${prefix}.amount`, false);
    const method = requireString(row.paymentMethod, `${prefix}.paymentMethod`);
    if (!["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "IMPS", "CHEQUE", "OTHER"].includes(method)) throw new Error(`${prefix}.paymentMethod is not supported`);
    if (method !== "CASH" && method !== "CHEQUE" && !hasValue(row.transactionReference)) throw new Error(`${prefix}.transactionReference is required`);
    if (method === "CHEQUE" && (!hasValue(row.chequeNumber) || !hasValue(row.chequeDate))) throw new Error(`${prefix}.chequeNumber and chequeDate are required`);
    if (hasValue(row.chequeDate)) requireDateString(row.chequeDate, `${prefix}.chequeDate`);
  });
  const expenseAudits = validateOptionalRows(root.expenseAudits, "expenseAudits", EXPENSE_AUDIT_KEYS, ["id", "expenseRecordId", "action", "actorName"]);
  const budgetPlans = validateOptionalRows(root.budgetPlans, "budgetPlans", BUDGET_PLAN_KEYS, ["id", "budgetNumber", "academicYear", "title", "status", "totalAllocatedAmount", "warningThresholdPercent", "criticalThresholdPercent"]);
  const budgetNumbers = new Set<string>(); const officialYears = new Set<string>();
  budgetPlans.forEach((row, index) => { const prefix = `budgetPlans[${index}]`; const number = requireString(row.budgetNumber, `${prefix}.budgetNumber`); if (budgetNumbers.has(number)) throw new Error(`${prefix}.budgetNumber is duplicated`); budgetNumbers.add(number); const status = requireString(row.status, `${prefix}.status`); if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "LOCKED", "REJECTED", "CANCELLED"].includes(status)) throw new Error(`${prefix}.status is not supported`); const year = requireString(row.academicYear, `${prefix}.academicYear`); if (["APPROVED", "LOCKED"].includes(status)) { if (officialYears.has(year)) throw new Error(`${prefix} duplicates the official budget for ${year}`); officialYears.add(year); } restoreMoneyCents(row.totalAllocatedAmount, `${prefix}.totalAllocatedAmount`); requirePositiveInteger(row.warningThresholdPercent, `${prefix}.warningThresholdPercent`); requirePositiveInteger(row.criticalThresholdPercent, `${prefix}.criticalThresholdPercent`); const warning = Number(row.warningThresholdPercent); const critical = Number(row.criticalThresholdPercent); if (warning > 1000 || critical > 1000 || warning > critical) throw new Error(`${prefix} has invalid thresholds`); if (status === "REJECTED" && !hasValue(row.rejectionReason)) throw new Error(`${prefix}.rejectionReason is required`); if (status === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`${prefix}.cancellationReason is required`); for (const field of ["effectiveFrom", "effectiveTo", "submittedAt", "approvedAt", "lockedAt", "cancelledAt"] as const) if (hasValue(row[field])) requireDateString(row[field], `${prefix}.${field}`); });
  budgetPlans.forEach((row, index) => {
    const prefix = `budgetPlans[${index}]`;
    const academicYear = requireString(row.academicYear, `${prefix}.academicYear`);
    if (!/^\d{4}-\d{2}$/.test(academicYear)) throw new Error(`${prefix}.academicYear must use YYYY-YY`);
    const effectiveFrom = hasValue(row.effectiveFrom) ? requireCalendarDateString(row.effectiveFrom, `${prefix}.effectiveFrom`) : null;
    const effectiveTo = hasValue(row.effectiveTo) ? requireCalendarDateString(row.effectiveTo, `${prefix}.effectiveTo`) : null;
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) throw new Error(`${prefix}.effectiveTo must be on or after effectiveFrom`);
  });
  const budgetAllocations = validateOptionalRows(root.budgetAllocations, "budgetAllocations", BUDGET_ALLOCATION_KEYS, ["id", "budgetPlanId", "allocationKey", "allocatedAmount"]);
  const allocationKeys = new Set<string>();
  const budgetPlanIds = new Set(budgetPlans.map((row) => String(row.id))); const categoryIds = new Set(expenseCategories.map((row) => String(row.id))); const departmentIds = new Set(expenseDepartments.map((row) => String(row.id)));
  budgetAllocations.forEach((row, index) => { const prefix = `budgetAllocations[${index}]`; const planId = requireString(row.budgetPlanId, `${prefix}.budgetPlanId`); if (!budgetPlanIds.has(planId)) throw new Error(`${prefix}.budgetPlanId does not match a budget plan`); if (!hasValue(row.categoryId) && !hasValue(row.departmentId)) throw new Error(`${prefix} must link a category or department`); if (hasValue(row.categoryId) && !categoryIds.has(String(row.categoryId))) throw new Error(`${prefix}.categoryId does not match an expense category`); if (hasValue(row.departmentId) && !departmentIds.has(String(row.departmentId))) throw new Error(`${prefix}.departmentId does not match an expense department`); const expectedKey = `${hasValue(row.categoryId) ? row.categoryId : "*"}|${hasValue(row.departmentId) ? row.departmentId : "*"}`; if (requireString(row.allocationKey, `${prefix}.allocationKey`) !== expectedKey) throw new Error(`${prefix}.allocationKey does not match its links`); restoreMoneyCents(row.allocatedAmount, `${prefix}.allocatedAmount`, false); const key = `${planId}|${expectedKey}`; if (allocationKeys.has(key)) throw new Error(`${prefix} duplicates a plan allocation combination`); allocationKeys.add(key); if (hasValue(row.warningThresholdPercent)) requirePositiveInteger(row.warningThresholdPercent, `${prefix}.warningThresholdPercent`); if (hasValue(row.criticalThresholdPercent)) requirePositiveInteger(row.criticalThresholdPercent, `${prefix}.criticalThresholdPercent`); const warning = hasValue(row.warningThresholdPercent) ? Number(row.warningThresholdPercent) : null; const critical = hasValue(row.criticalThresholdPercent) ? Number(row.criticalThresholdPercent) : null; if ((warning != null && warning > 1000) || (critical != null && critical > 1000) || (warning != null && critical != null && warning > critical)) throw new Error(`${prefix} has invalid thresholds`); });
  for (const plan of budgetPlans) { const total = budgetAllocations.filter((row) => row.budgetPlanId === plan.id).reduce((sum, row, index) => sum + restoreMoneyCents(row.allocatedAmount, `budgetAllocations[${index}].allocatedAmount`, false), 0n); if (total !== restoreMoneyCents(plan.totalAllocatedAmount, `budgetPlans.${plan.budgetNumber}.totalAllocatedAmount`)) throw new Error(`Budget ${plan.budgetNumber} total does not reconcile with allocations`); }
  const budgetRevisions = validateOptionalRows(root.budgetRevisions, "budgetRevisions", BUDGET_REVISION_KEYS, ["id", "budgetPlanId", "revisionNumber", "reason", "previousTotalAmount", "revisedTotalAmount", "revisionData", "status"]);
  const revisionKeys = new Set<string>(); budgetRevisions.forEach((row, index) => { const prefix = `budgetRevisions[${index}]`; const planId = requireString(row.budgetPlanId, `${prefix}.budgetPlanId`); if (!budgetPlanIds.has(planId)) throw new Error(`${prefix}.budgetPlanId does not match a budget plan`); requirePositiveInteger(row.revisionNumber, `${prefix}.revisionNumber`); const revisionNumber = Number(row.revisionNumber); const key = `${planId}|${revisionNumber}`; if (revisionKeys.has(key)) throw new Error(`${prefix} duplicates a plan revision number`); revisionKeys.add(key); restoreMoneyCents(row.previousTotalAmount, `${prefix}.previousTotalAmount`); restoreMoneyCents(row.revisedTotalAmount, `${prefix}.revisedTotalAmount`); const status = requireString(row.status, `${prefix}.status`); if (!["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) throw new Error(`${prefix}.status is not supported`); if (status === "REJECTED" && !hasValue(row.rejectionReason)) throw new Error(`${prefix}.rejectionReason is required`); if (status === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`${prefix}.cancellationReason is required`); try { const parsed = JSON.parse(requireString(row.revisionData, `${prefix}.revisionData`)); if (!Array.isArray(parsed.before) || !Array.isArray(parsed.after)) throw new Error(); for (const item of [...parsed.before, ...parsed.after]) { if (item.categoryId && !categoryIds.has(String(item.categoryId))) throw new Error(); if (item.departmentId && !departmentIds.has(String(item.departmentId))) throw new Error(); } } catch { throw new Error(`${prefix}.revisionData must contain valid before and after allocation snapshots`); } });
  const budgetPlanById = new Map(budgetPlans.map((row) => [String(row.id), row]));
  budgetRevisions.forEach((row, index) => {
    const prefix = `budgetRevisions[${index}]`;
    const plan = budgetPlanById.get(String(row.budgetPlanId));
    if (!plan) return;
    const parsed = JSON.parse(requireString(row.revisionData, `${prefix}.revisionData`)) as { before: unknown[]; after: unknown[] };
    const validateSnapshot = (value: unknown[], label: "before" | "after") => {
      if (!value.length) throw new Error(`${prefix}.revisionData.${label} must contain at least one allocation`);
      const combinations = new Set<string>();
      let total = 0n;
      value.forEach((item, itemIndex) => {
        const itemPrefix = `${prefix}.revisionData.${label}[${itemIndex}]`;
        const allocation = requireRecord(item, itemPrefix);
        const categoryId = hasValue(allocation.categoryId) ? requireString(allocation.categoryId, `${itemPrefix}.categoryId`) : null;
        const departmentId = hasValue(allocation.departmentId) ? requireString(allocation.departmentId, `${itemPrefix}.departmentId`) : null;
        if (!categoryId && !departmentId) throw new Error(`${itemPrefix} must reference a category or department`);
        if (categoryId && !categoryIds.has(categoryId)) throw new Error(`${itemPrefix}.categoryId does not match an expense category`);
        if (departmentId && !departmentIds.has(departmentId)) throw new Error(`${itemPrefix}.departmentId does not match an expense department`);
        const expectedKey = `${categoryId ?? "*"}|${departmentId ?? "*"}`;
        if (requireString(allocation.allocationKey, `${itemPrefix}.allocationKey`) !== expectedKey) throw new Error(`${itemPrefix}.allocationKey is inconsistent`);
        if (combinations.has(expectedKey)) throw new Error(`${itemPrefix} duplicates a snapshot allocation combination`);
        combinations.add(expectedKey);
        total += restoreMoneyCents(allocation.allocatedAmount, `${itemPrefix}.allocatedAmount`, false);
        const warning = hasValue(allocation.warningThresholdPercent) ? Number(allocation.warningThresholdPercent) : Number(plan.warningThresholdPercent);
        const critical = hasValue(allocation.criticalThresholdPercent) ? Number(allocation.criticalThresholdPercent) : Number(plan.criticalThresholdPercent);
        if (!Number.isInteger(warning) || !Number.isInteger(critical) || warning <= 0 || critical <= 0 || warning > 1000 || critical > 1000 || warning > critical) {
          throw new Error(`${itemPrefix} has invalid effective thresholds`);
        }
      });
      return total;
    };
    const previousTotal = validateSnapshot(parsed.before, "before");
    const revisedTotal = validateSnapshot(parsed.after, "after");
    if (previousTotal !== restoreMoneyCents(row.previousTotalAmount, `${prefix}.previousTotalAmount`)) throw new Error(`${prefix}.previousTotalAmount does not reconcile with the before snapshot`);
    if (revisedTotal !== restoreMoneyCents(row.revisedTotalAmount, `${prefix}.revisedTotalAmount`)) throw new Error(`${prefix}.revisedTotalAmount does not reconcile with the after snapshot`);
  });
  const miscIncomeItems = validateOptionalRows(root.miscIncomeItems, "miscIncomeItems", MISC_INCOME_ITEM_KEYS, ["id", "itemCode", "name", "category", "studentLinkPolicy", "status"]);
  const miscItemIds = new Set<string>(); const miscItemCodes = new Set<string>(); const miscItemPolicies = new Map<string, string>();
  miscIncomeItems.forEach((row, index) => { const prefix = `miscIncomeItems[${index}]`; const id = requireString(row.id, `${prefix}.id`); const code = requireString(row.itemCode, `${prefix}.itemCode`).toUpperCase(); if (miscItemIds.has(id) || miscItemCodes.has(code)) throw new Error(`${prefix} duplicates an income item identity or code`); miscItemIds.add(id); miscItemCodes.add(code); if (!["UNIFORM_ACCESSORY", "CERTIFICATE", "STUDENT_DOCUMENT", "ACADEMIC_SERVICE", "LIBRARY_CHARGE", "OTHER"].includes(requireString(row.category, `${prefix}.category`))) throw new Error(`${prefix}.category is not supported`); const policy = requireString(row.studentLinkPolicy, `${prefix}.studentLinkPolicy`); if (!["REQUIRED", "OPTIONAL", "NOT_REQUIRED"].includes(policy)) throw new Error(`${prefix}.studentLinkPolicy is not supported`); miscItemPolicies.set(id, policy); if (!["ACTIVE", "INACTIVE"].includes(requireString(row.status, `${prefix}.status`))) throw new Error(`${prefix}.status is not supported`); });
  const miscIncomeRates = validateOptionalRows(root.miscIncomeRates, "miscIncomeRates", MISC_INCOME_RATE_KEYS, ["id", "itemId", "academicYear", "amount", "status"]);
  const rateIds = new Set<string>(); const rateLinks = new Map<string, { itemId: string; academicYear: string; from: string | null; to: string | null; status: string }>();
  miscIncomeRates.forEach((row, index) => { const prefix = `miscIncomeRates[${index}]`; const id = requireString(row.id, `${prefix}.id`); if (rateIds.has(id)) throw new Error(`${prefix}.id is duplicated`); rateIds.add(id); const itemId = requireString(row.itemId, `${prefix}.itemId`); if (!miscItemIds.has(itemId)) throw new Error(`${prefix}.itemId does not match an income item`); restoreMoneyCents(row.amount, `${prefix}.amount`); const status = requireString(row.status, `${prefix}.status`); if (!["ACTIVE", "INACTIVE"].includes(status)) throw new Error(`${prefix}.status is not supported`); const from = hasValue(row.effectiveFrom) ? requireCalendarDateString(row.effectiveFrom, `${prefix}.effectiveFrom`) : null; const to = hasValue(row.effectiveTo) ? requireCalendarDateString(row.effectiveTo, `${prefix}.effectiveTo`) : null; if (from && to && to < from) throw new Error(`${prefix}.effectiveTo must be on or after effectiveFrom`); rateLinks.set(id, { itemId, academicYear: requireString(row.academicYear, `${prefix}.academicYear`), from, to, status }); });
  for (let index = 0; index < miscIncomeRates.length; index++) { const current = miscIncomeRates[index]; const currentLink = rateLinks.get(String(current.id))!; if (currentLink.status !== "ACTIVE") continue; for (let other = index + 1; other < miscIncomeRates.length; other++) { const candidate = rateLinks.get(String(miscIncomeRates[other].id))!; if (candidate.status !== "ACTIVE" || candidate.itemId !== currentLink.itemId || candidate.academicYear !== currentLink.academicYear) continue; const currentFrom = currentLink.from ?? "0000-00-00", currentTo = currentLink.to ?? "9999-99-99", candidateFrom = candidate.from ?? "0000-00-00", candidateTo = candidate.to ?? "9999-99-99"; if (currentFrom <= candidateTo && candidateFrom <= currentTo) throw new Error(`miscIncomeRates[${other}] overlaps an active rate for the same item and academic year`); } }
  const miscIncomeReceipts = validateOptionalRows(root.miscIncomeReceipts, "miscIncomeReceipts", MISC_INCOME_RECEIPT_KEYS, ["id", "receiptNumber", "receiptDate", "academicYear", "paymentMethod", "grossAmount", "discountAmount", "netAmount", "status"]);
  const receiptIds = new Set<string>(); const receiptNumbers = new Set<string>(); const studentIdsForMisc = new Set(students.map((row) => String(row.id))); const receiptLinks = new Map<string, { receiptDate: string; academicYear: string; studentId: string | null }>();
  miscIncomeReceipts.forEach((row, index) => { const prefix = `miscIncomeReceipts[${index}]`; const id = requireString(row.id, `${prefix}.id`); const number = requireString(row.receiptNumber, `${prefix}.receiptNumber`); if (receiptIds.has(id) || receiptNumbers.has(number)) throw new Error(`${prefix} duplicates a receipt identity or number`); receiptIds.add(id); receiptNumbers.add(number); const receiptDate = requireCalendarDateString(row.receiptDate, `${prefix}.receiptDate`); const studentId = hasValue(row.studentId) ? String(row.studentId) : null; if (studentId && !studentIdsForMisc.has(studentId)) throw new Error(`${prefix}.studentId does not match a backup student`); const method = requireString(row.paymentMethod, `${prefix}.paymentMethod`); if (!["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "IMPS", "CHEQUE", "OTHER"].includes(method)) throw new Error(`${prefix}.paymentMethod is not supported`); if (method === "CASH" && hasValue(row.receivedAccount) && String(row.receivedAccount) !== "CASH_COUNTER") throw new Error(`${prefix}.receivedAccount must be CASH_COUNTER for physical cash`); if (method !== "CASH" && !hasValue(row.receivedAccount)) throw new Error(`${prefix}.receivedAccount is required for non-cash income`); if (method !== "CASH" && method !== "CHEQUE" && !hasValue(row.transactionReference)) throw new Error(`${prefix}.transactionReference is required`); if (method === "CHEQUE" && (!hasValue(row.chequeNumber) || !hasValue(row.chequeDate))) throw new Error(`${prefix} requires cheque number and date`); const gross = restoreMoneyCents(row.grossAmount, `${prefix}.grossAmount`, false); const discount = restoreMoneyCents(row.discountAmount, `${prefix}.discountAmount`); const net = restoreMoneyCents(row.netAmount, `${prefix}.netAmount`, false); if (gross - discount !== net || discount > gross) throw new Error(`${prefix} has inconsistent totals`); const status = requireString(row.status, `${prefix}.status`); if (!["ACTIVE", "CANCELLED"].includes(status)) throw new Error(`${prefix}.status is not supported`); if (status === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`${prefix}.cancellationReason is required`); receiptLinks.set(id, { receiptDate, academicYear: requireString(row.academicYear, `${prefix}.academicYear`), studentId }); });
  const miscIncomeReceiptLines = validateOptionalRows(root.miscIncomeReceiptLines, "miscIncomeReceiptLines", MISC_INCOME_LINE_KEYS, ["id", "receiptId", "itemId", "itemNameSnapshot", "quantity", "unitAmount", "discountAmount", "lineTotal"]);
  miscIncomeReceiptLines.forEach((row, index) => { const prefix = `miscIncomeReceiptLines[${index}]`; const receiptId = requireString(row.receiptId, `${prefix}.receiptId`); const receiptLink = receiptLinks.get(receiptId); if (!receiptLink) throw new Error(`${prefix}.receiptId does not match a receipt`); const itemId = requireString(row.itemId, `${prefix}.itemId`); if (!miscItemIds.has(itemId)) throw new Error(`${prefix}.itemId does not match an income item`); if (miscItemPolicies.get(itemId) === "REQUIRED" && !receiptLink.studentId) throw new Error(`${prefix}.itemId requires a student-linked receipt`); if (miscItemPolicies.get(itemId) === "NOT_REQUIRED" && receiptLink.studentId) throw new Error(`${prefix}.itemId cannot be used on a student-linked receipt`); if (hasValue(row.rateId)) { const rateId = String(row.rateId), rateLink = rateLinks.get(rateId); if (!rateLink) throw new Error(`${prefix}.rateId does not match a rate`); if (rateLink.itemId !== itemId) throw new Error(`${prefix}.rateId must belong to the same item`); if (rateLink.academicYear !== receiptLink.academicYear) throw new Error(`${prefix}.rateId must match the receipt academic year`); if ((rateLink.from && rateLink.from > receiptLink.receiptDate) || (rateLink.to && rateLink.to < receiptLink.receiptDate)) throw new Error(`${prefix}.rateId is not effective on the receipt date`); } requirePositiveInteger(row.quantity, `${prefix}.quantity`); const gross = restoreMoneyCents(row.unitAmount, `${prefix}.unitAmount`).valueOf() * BigInt(Number(row.quantity)); const discount = restoreMoneyCents(row.discountAmount, `${prefix}.discountAmount`); const total = restoreMoneyCents(row.lineTotal, `${prefix}.lineTotal`); if (gross - discount !== total || discount > gross) throw new Error(`${prefix} has inconsistent totals`); });
  for (const receipt of miscIncomeReceipts) { const lines = miscIncomeReceiptLines.filter((line) => line.receiptId === receipt.id); if (!lines.length) throw new Error(`Receipt ${receipt.receiptNumber} has no lines`); const gross = lines.reduce((sum, line) => sum + restoreMoneyCents(line.unitAmount, "line.unitAmount") * BigInt(Number(line.quantity)), 0n); const discount = lines.reduce((sum, line) => sum + restoreMoneyCents(line.discountAmount, "line.discountAmount"), 0n); if (gross !== restoreMoneyCents(receipt.grossAmount, "receipt.grossAmount") || discount !== restoreMoneyCents(receipt.discountAmount, "receipt.discountAmount")) throw new Error(`Receipt ${receipt.receiptNumber} does not reconcile with its lines`); }
  const cashBookDays = validateOptionalRows(root.cashBookDays, "cashBookDays", CASH_BOOK_DAY_KEYS, ["id", "cashDate", "academicYear", "openingBalance", "status", "feeCashSnapshot", "miscIncomeCashSnapshot", "cashExpenseSnapshot", "manualInflowSnapshot", "manualOutflowSnapshot", "bankDepositSnapshot", "directorHandoverSnapshot", "calculatedClosingBalance"]);
  const cashDayIds = new Set<string>(); const cashDates = new Set<string>(); const cashDayDates = new Map<string, string>();
  cashBookDays.forEach((row, index) => {
    const prefix = `cashBookDays[${index}]`;
    const id = requireString(row.id, `${prefix}.id`);
    const date = requireCalendarDateString(row.cashDate, `${prefix}.cashDate`);
    if (cashDayIds.has(id) || cashDates.has(date)) throw new Error(`${prefix} duplicates a cash day identity or date`);
    cashDayIds.add(id); cashDates.add(date); cashDayDates.set(id, date);
    const status = requireString(row.status, `${prefix}.status`);
    if (!["DRAFT", "SUBMITTED", "APPROVED", "LOCKED", "REJECTED", "CANCELLED"].includes(status)) throw new Error(`${prefix}.status is not supported`);
    const amounts = Object.fromEntries((["openingBalance", "feeCashSnapshot", "miscIncomeCashSnapshot", "cashExpenseSnapshot", "manualInflowSnapshot", "manualOutflowSnapshot", "bankDepositSnapshot", "directorHandoverSnapshot"] as const).map((field) => [field, restoreMoneyCents(row[field], `${prefix}.${field}`)])) as Record<string, bigint>;
    const bookSalesCashSnapshot = hasValue(row.bookSalesCashSnapshot) ? restoreMoneyCents(row.bookSalesCashSnapshot, `${prefix}.bookSalesCashSnapshot`) : 0n;
    const calculated = restoreSignedMoneyCents(row.calculatedClosingBalance, `${prefix}.calculatedClosingBalance`);
    if (["SUBMITTED", "APPROVED", "LOCKED", "REJECTED"].includes(status)) {
      const formula = amounts.openingBalance + amounts.feeCashSnapshot + amounts.miscIncomeCashSnapshot + bookSalesCashSnapshot + amounts.manualInflowSnapshot - amounts.cashExpenseSnapshot - amounts.manualOutflowSnapshot - amounts.bankDepositSnapshot - amounts.directorHandoverSnapshot;
      if (calculated !== formula) throw new Error(`${prefix}.calculatedClosingBalance does not match the snapshot formula`);
    }
    const counted = hasValue(row.countedClosingBalance) ? restoreMoneyCents(row.countedClosingBalance, `${prefix}.countedClosingBalance`) : null;
    const variance = hasValue(row.varianceAmount) ? restoreSignedMoneyCents(row.varianceAmount, `${prefix}.varianceAmount`) : null;
    if (counted !== null && variance !== null && variance !== counted - calculated) throw new Error(`${prefix}.varianceAmount does not match counted closing minus expected closing`);
    if (["SUBMITTED", "APPROVED", "LOCKED", "REJECTED"].includes(status) && (counted === null || variance === null || !hasValue(row.sourceSummarySnapshot))) throw new Error(`${prefix} requires counted closing, variance, and a source snapshot`);
    if (status === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`${prefix}.cancellationReason is required`);
  });
  const cashBookMovements = validateOptionalRows(root.cashBookMovements, "cashBookMovements", CASH_BOOK_MOVEMENT_KEYS, ["id", "cashBookDayId", "movementType", "amount", "movementDate", "reason", "status"]);
  cashBookMovements.forEach((row, index) => { const prefix = `cashBookMovements[${index}]`; const cashBookDayId = requireString(row.cashBookDayId, `${prefix}.cashBookDayId`), cashDayDate = cashDayDates.get(cashBookDayId); if (!cashDayDate) throw new Error(`${prefix}.cashBookDayId does not match a cash day`); if (!["MANUAL_INFLOW", "MANUAL_OUTFLOW", "BANK_DEPOSIT", "DIRECTOR_HANDOVER", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"].includes(requireString(row.movementType, `${prefix}.movementType`))) throw new Error(`${prefix}.movementType is not supported`); restoreMoneyCents(row.amount, `${prefix}.amount`, false); const movementDate = requireCalendarDateString(row.movementDate, `${prefix}.movementDate`); if (movementDate !== cashDayDate) throw new Error(`${prefix}.movementDate must match its cash day`); const status = requireString(row.status, `${prefix}.status`); if (!["ACTIVE", "CANCELLED"].includes(status)) throw new Error(`${prefix}.status is not supported`); if (status === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`${prefix}.cancellationReason is required`); });
  const bookCatalogItems = validateOptionalRows(root.bookCatalogItems, "bookCatalogItems", BOOK_CATALOG_ITEM_KEYS, ["id", "itemCode", "title", "itemType", "studentLinkRequired", "status"]);
  const bookItemIds = new Set<string>(); const bookItemCodes = new Set<string>(); const bookItemStudentRequired = new Map<string, boolean>(); const vendorIdsForBooks = new Set(vendors.map((row) => String(row.id)));
  bookCatalogItems.forEach((row, index) => { const prefix = `bookCatalogItems[${index}]`; const id = requireString(row.id, `${prefix}.id`); const code = requireString(row.itemCode, `${prefix}.itemCode`).toUpperCase(); if (bookItemIds.has(id) || bookItemCodes.has(code)) throw new Error(`${prefix} duplicates a catalog item identity or code`); bookItemIds.add(id); bookItemCodes.add(code); if (!["TEXTBOOK", "WORKBOOK", "NOTEBOOK", "BOOK_SET", "GUIDE", "STATIONERY", "OTHER"].includes(requireString(row.itemType, `${prefix}.itemType`))) throw new Error(`${prefix}.itemType is not supported`); if (typeof row.studentLinkRequired !== "boolean") throw new Error(`${prefix}.studentLinkRequired must be a boolean`); bookItemStudentRequired.set(id, row.studentLinkRequired); if (hasValue(row.publisherVendorId) && !vendorIdsForBooks.has(String(row.publisherVendorId))) throw new Error(`${prefix}.publisherVendorId does not match a backup vendor`); if (!["ACTIVE", "INACTIVE"].includes(requireString(row.status, `${prefix}.status`))) throw new Error(`${prefix}.status is not supported`); });
  const bookCatalogRates = validateOptionalRows(root.bookCatalogRates, "bookCatalogRates", BOOK_CATALOG_RATE_KEYS, ["id", "itemId", "academicYear", "amount", "status"]);
  const bookRateIds = new Set<string>(); const bookRateLinks = new Map<string, { itemId: string; academicYear: string; from: string | null; to: string | null; status: string }>();
  bookCatalogRates.forEach((row, index) => { const prefix = `bookCatalogRates[${index}]`; const id = requireString(row.id, `${prefix}.id`); if (bookRateIds.has(id)) throw new Error(`${prefix}.id is duplicated`); bookRateIds.add(id); const itemId = requireString(row.itemId, `${prefix}.itemId`); if (!bookItemIds.has(itemId)) throw new Error(`${prefix}.itemId does not match a catalog item`); restoreMoneyCents(row.amount, `${prefix}.amount`, false); const status = requireString(row.status, `${prefix}.status`); if (!["ACTIVE", "INACTIVE"].includes(status)) throw new Error(`${prefix}.status is not supported`); const from = hasValue(row.effectiveFrom) ? requireCalendarDateString(row.effectiveFrom, `${prefix}.effectiveFrom`) : null; const to = hasValue(row.effectiveTo) ? requireCalendarDateString(row.effectiveTo, `${prefix}.effectiveTo`) : null; if (from && to && to < from) throw new Error(`${prefix}.effectiveTo must be on or after effectiveFrom`); bookRateLinks.set(id, { itemId, academicYear: requireString(row.academicYear, `${prefix}.academicYear`), from, to, status }); });
  for (let index = 0; index < bookCatalogRates.length; index++) { const current = bookRateLinks.get(String(bookCatalogRates[index].id))!; if (current.status !== "ACTIVE") continue; for (let other = index + 1; other < bookCatalogRates.length; other++) { const candidate = bookRateLinks.get(String(bookCatalogRates[other].id))!; if (candidate.status !== "ACTIVE" || candidate.itemId !== current.itemId || candidate.academicYear !== current.academicYear) continue; if ((current.from ?? "0000-00-00") <= (candidate.to ?? "9999-99-99") && (candidate.from ?? "0000-00-00") <= (current.to ?? "9999-99-99")) throw new Error(`bookCatalogRates[${other}] overlaps an active rate for the same item and academic year`); } }
  const bookSaleReceipts = validateOptionalRows(root.bookSaleReceipts, "bookSaleReceipts", BOOK_SALE_RECEIPT_KEYS, ["id", "receiptNumber", "receiptDate", "academicYear", "paymentMethod", "grossAmount", "discountAmount", "netAmount", "status"]);
  const bookReceiptIds = new Set<string>(); const bookReceiptNumbers = new Set<string>(); const studentIdsForBooks = new Set(students.map((row) => String(row.id))); const bookReceiptLinks = new Map<string, { date: string; academicYear: string; studentId: string | null }>();
  bookSaleReceipts.forEach((row, index) => { const prefix = `bookSaleReceipts[${index}]`; const id = requireString(row.id, `${prefix}.id`); const number = requireString(row.receiptNumber, `${prefix}.receiptNumber`); if (bookReceiptIds.has(id) || bookReceiptNumbers.has(number)) throw new Error(`${prefix} duplicates a receipt identity or number`); bookReceiptIds.add(id); bookReceiptNumbers.add(number); const date = requireCalendarDateString(row.receiptDate, `${prefix}.receiptDate`); const studentId = hasValue(row.studentId) ? String(row.studentId) : null; if (studentId && !studentIdsForBooks.has(studentId)) throw new Error(`${prefix}.studentId does not match a backup student`); const method = requireString(row.paymentMethod, `${prefix}.paymentMethod`); if (!["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "IMPS", "CHEQUE", "OTHER"].includes(method)) throw new Error(`${prefix}.paymentMethod is not supported`); if (method === "CASH" && String(row.receivedAccount ?? "") !== "BOOKS_CASH_COUNTER") throw new Error(`${prefix}.receivedAccount must be BOOKS_CASH_COUNTER for physical cash`); if (method !== "CASH" && !hasValue(row.receivedAccount)) throw new Error(`${prefix}.receivedAccount is required for non-cash sales`); if (method !== "CASH" && method !== "CHEQUE" && !hasValue(row.transactionReference)) throw new Error(`${prefix}.transactionReference is required`); if (method === "CHEQUE" && (!hasValue(row.chequeNumber) || !hasValue(row.chequeDate))) throw new Error(`${prefix} requires cheque number and date`); const gross = restoreMoneyCents(row.grossAmount, `${prefix}.grossAmount`, false), discount = restoreMoneyCents(row.discountAmount, `${prefix}.discountAmount`), net = restoreMoneyCents(row.netAmount, `${prefix}.netAmount`, false); if (gross - discount !== net || discount > gross) throw new Error(`${prefix} has inconsistent totals`); const status = requireString(row.status, `${prefix}.status`); if (!["ACTIVE", "CANCELLED"].includes(status)) throw new Error(`${prefix}.status is not supported`); if (status === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`${prefix}.cancellationReason is required`); bookReceiptLinks.set(id, { date, academicYear: requireString(row.academicYear, `${prefix}.academicYear`), studentId }); });
  const bookSaleReceiptLines = validateOptionalRows(root.bookSaleReceiptLines, "bookSaleReceiptLines", BOOK_SALE_LINE_KEYS, ["id", "receiptId", "itemId", "itemCodeSnapshot", "itemTitleSnapshot", "quantity", "unitAmount", "discountAmount", "lineTotal"]);
  bookSaleReceiptLines.forEach((row, index) => { const prefix = `bookSaleReceiptLines[${index}]`; const receipt = bookReceiptLinks.get(requireString(row.receiptId, `${prefix}.receiptId`)); if (!receipt) throw new Error(`${prefix}.receiptId does not match a book receipt`); const itemId = requireString(row.itemId, `${prefix}.itemId`); if (!bookItemIds.has(itemId)) throw new Error(`${prefix}.itemId does not match a catalog item`); if (bookItemStudentRequired.get(itemId) && !receipt.studentId) throw new Error(`${prefix}.itemId requires a student-linked receipt`); if (hasValue(row.rateId)) { const rate = bookRateLinks.get(String(row.rateId)); if (!rate || rate.itemId !== itemId || rate.academicYear !== receipt.academicYear || (rate.from && rate.from > receipt.date) || (rate.to && rate.to < receipt.date)) throw new Error(`${prefix}.rateId is not valid for this item, year, and date`); } requirePositiveInteger(row.quantity, `${prefix}.quantity`); const gross = restoreMoneyCents(row.unitAmount, `${prefix}.unitAmount`) * BigInt(Number(row.quantity)), discount = restoreMoneyCents(row.discountAmount, `${prefix}.discountAmount`), total = restoreMoneyCents(row.lineTotal, `${prefix}.lineTotal`); if (gross - discount !== total || discount > gross) throw new Error(`${prefix} has inconsistent totals`); });
  for (const receipt of bookSaleReceipts) { const lines = bookSaleReceiptLines.filter((line) => line.receiptId === receipt.id); if (!lines.length) throw new Error(`Book receipt ${receipt.receiptNumber} has no lines`); const gross = lines.reduce((sum, line) => sum + restoreMoneyCents(line.unitAmount, "book line unitAmount") * BigInt(Number(line.quantity)), 0n); const discount = lines.reduce((sum, line) => sum + restoreMoneyCents(line.discountAmount, "book line discountAmount"), 0n); if (gross !== restoreMoneyCents(receipt.grossAmount, "book receipt grossAmount") || discount !== restoreMoneyCents(receipt.discountAmount, "book receipt discountAmount")) throw new Error(`Book receipt ${receipt.receiptNumber} does not reconcile with its lines`); }
  const bookCashSettlements = validateOptionalRows(root.bookCashSettlements, "bookCashSettlements", BOOK_CASH_SETTLEMENT_KEYS, ["id", "settlementDate", "academicYear", "status", "expectedBookCash", "handedToDirectorAmount", "handedToCashCounterAmount", "retainedByBooksInchargeAmount", "varianceAmount"]);
  const settlementIds = new Set<string>(); const settlementDates = new Set<string>(); const settlementMovementIds = new Set<string>(); const movementIds = new Set(cashBookMovements.map((row) => String(row.id)));
  bookCashSettlements.forEach((row, index) => { const prefix = `bookCashSettlements[${index}]`; const id = requireString(row.id, `${prefix}.id`), date = requireCalendarDateString(row.settlementDate, `${prefix}.settlementDate`); if (settlementIds.has(id) || settlementDates.has(date)) throw new Error(`${prefix} duplicates a settlement identity or date`); settlementIds.add(id); settlementDates.add(date); const status = requireString(row.status, `${prefix}.status`); if (!["DRAFT", "SUBMITTED", "APPROVED", "CANCELLED"].includes(status)) throw new Error(`${prefix}.status is not supported`); const expected = restoreMoneyCents(row.expectedBookCash, `${prefix}.expectedBookCash`), director = restoreMoneyCents(row.handedToDirectorAmount, `${prefix}.handedToDirectorAmount`), counter = restoreMoneyCents(row.handedToCashCounterAmount, `${prefix}.handedToCashCounterAmount`), retained = restoreMoneyCents(row.retainedByBooksInchargeAmount, `${prefix}.retainedByBooksInchargeAmount`), variance = restoreSignedMoneyCents(row.varianceAmount, `${prefix}.varianceAmount`); if (director + counter + retained + variance !== expected) throw new Error(`${prefix} does not reconcile to expected book cash`); if (variance !== 0n && !hasValue(row.varianceReason)) throw new Error(`${prefix}.varianceReason is required`); if (hasValue(row.cashBookMovementId)) { const movementId = String(row.cashBookMovementId); if (!movementIds.has(movementId) || settlementMovementIds.has(movementId)) throw new Error(`${prefix}.cashBookMovementId is missing or duplicated`); settlementMovementIds.add(movementId); const movement = cashBookMovements.find((candidate) => candidate.id === movementId)!; if (movement.movementType !== "DIRECTOR_HANDOVER" || restoreMoneyCents(movement.amount, "Director handover amount") !== director) throw new Error(`${prefix}.cashBookMovementId must link the matching Director handover`); } if (status === "APPROVED" && director > 0n && !hasValue(row.cashBookMovementId)) throw new Error(`${prefix}.cashBookMovementId is required after approval`); if (status === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`${prefix}.cancellationReason is required`); });
  const libraryTitles = validateOptionalRows(root.libraryTitles, "libraryTitles", LIBRARY_TITLE_KEYS, ["id", "titleCode", "title", "authors", "status"]);
  const libraryTitleIds = new Set<string>(), libraryTitleCodes = new Set<string>(), libraryIsbns = new Set<string>();
  libraryTitles.forEach((row, index) => { const prefix = `libraryTitles[${index}]`; const id = requireString(row.id, `${prefix}.id`); const code = requireNormalizedLibraryTitleCode(row.titleCode, `${prefix}.titleCode`); if (libraryTitleIds.has(id) || libraryTitleCodes.has(code)) throw new Error(`${prefix} duplicates a library title identity or normalized title code`); libraryTitleIds.add(id); libraryTitleCodes.add(code); if (hasValue(row.isbn)) { const isbn = String(row.isbn).toUpperCase().replace(/[^0-9X]/g, ""); if (![10, 13].includes(isbn.length) || libraryIsbns.has(isbn)) throw new Error(`${prefix}.isbn is invalid or duplicated`); libraryIsbns.add(isbn); } if (hasValue(row.publisherVendorId) && !vendorIdsForBooks.has(String(row.publisherVendorId))) throw new Error(`${prefix}.publisherVendorId does not match a backup Vendor`); if (!["ACTIVE", "INACTIVE"].includes(requireString(row.status, `${prefix}.status`))) throw new Error(`${prefix}.status is not supported`); if (hasValue(row.publicationYear)) { const year = Number(row.publicationYear); if (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear() + 1) throw new Error(`${prefix}.publicationYear is invalid`); } });
  const libraryCopies = validateOptionalRows(root.libraryCopies, "libraryCopies", LIBRARY_COPY_KEYS, ["id", "titleId", "accessionNumber", "acquisitionType", "condition", "status"]);
  const libraryCopyIds = new Set<string>(), libraryAccessions = new Set<string>(), libraryBarcodes = new Set<string>(); const expenseIdsForLibrary = new Set(expenseRecords.map((row) => String(row.id))); const expenseVendorForLibrary = new Map(expenseRecords.map((row) => [String(row.id), hasValue(row.vendorId) ? String(row.vendorId) : null]));
  libraryCopies.forEach((row, index) => { const prefix = `libraryCopies[${index}]`; const id = requireString(row.id, `${prefix}.id`), titleId = requireString(row.titleId, `${prefix}.titleId`), accession = requireNormalizedLibraryAccession(row.accessionNumber, `${prefix}.accessionNumber`); if (!libraryTitleIds.has(titleId)) throw new Error(`${prefix}.titleId does not match a backup LibraryTitle`); if (libraryCopyIds.has(id) || libraryAccessions.has(accession)) throw new Error(`${prefix} duplicates a copy identity or accession number`); libraryCopyIds.add(id); libraryAccessions.add(accession); if (hasValue(row.barcodeValue)) { const barcode = requireNormalizedLibraryBarcode(row.barcodeValue, `${prefix}.barcodeValue`); if (libraryBarcodes.has(barcode)) throw new Error(`${prefix}.barcodeValue is duplicated`); libraryBarcodes.add(barcode); } const vendorId = hasValue(row.vendorId) ? String(row.vendorId) : null, expenseRecordId = hasValue(row.expenseRecordId) ? String(row.expenseRecordId) : null; if (vendorId && !vendorIdsForBooks.has(vendorId)) throw new Error(`${prefix}.vendorId does not match a backup Vendor`); if (expenseRecordId && !expenseIdsForLibrary.has(expenseRecordId)) throw new Error(`${prefix}.expenseRecordId does not match a backup ExpenseRecord`); const expenseVendorId = expenseRecordId ? expenseVendorForLibrary.get(expenseRecordId) : null; if (vendorId && expenseVendorId && vendorId !== expenseVendorId) throw new Error(`${prefix} Vendor and Expense references do not belong to the same Vendor`); if (!["PURCHASED", "DONATED", "TRANSFERRED", "OTHER"].includes(requireString(row.acquisitionType, `${prefix}.acquisitionType`))) throw new Error(`${prefix}.acquisitionType is not supported`); if (!["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"].includes(requireString(row.condition, `${prefix}.condition`))) throw new Error(`${prefix}.condition is not supported`); const status = requireString(row.status, `${prefix}.status`); if (!["AVAILABLE", "UNDER_REPAIR", "MISSING", "WITHDRAWN"].includes(status)) throw new Error(`${prefix}.status is not supported`); if (status === "WITHDRAWN" && !hasValue(row.withdrawalReason)) throw new Error(`${prefix}.withdrawalReason is required`); if (hasValue(row.acquisitionCost)) restoreMoneyCents(row.acquisitionCost, `${prefix}.acquisitionCost`); if (hasValue(row.acquisitionDate)) requireCalendarDateString(row.acquisitionDate, `${prefix}.acquisitionDate`); if (hasValue(row.withdrawnDate)) requireCalendarDateString(row.withdrawnDate, `${prefix}.withdrawnDate`); });
  const libraryCopyEvents = validateOptionalRows(root.libraryCopyEvents, "libraryCopyEvents", LIBRARY_COPY_EVENT_KEYS, ["id", "copyId", "eventType", "eventDate"]);
  const libraryEventIds = new Set<string>(); const libraryEventCopyIds = new Map<string,string>(); const libraryEventTypes = new Set(["ACCESSIONED", "DETAILS_UPDATED", "CONDITION_UPDATED", "SHELF_CHANGED", "MARKED_MISSING", "SENT_FOR_REPAIR", "RETURNED_FROM_REPAIR", "WITHDRAWN", "CORRECTION"]);
  libraryCopyEvents.forEach((row, index) => { const prefix = `libraryCopyEvents[${index}]`; const id = requireString(row.id, `${prefix}.id`); if (libraryEventIds.has(id)) throw new Error(`${prefix}.id is duplicated`); libraryEventIds.add(id); const copyId=requireString(row.copyId, `${prefix}.copyId`); if (!libraryCopyIds.has(copyId)) throw new Error(`${prefix}.copyId does not match a backup LibraryCopy`); libraryEventCopyIds.set(id,copyId); const eventType = requireString(row.eventType, `${prefix}.eventType`); if (!libraryEventTypes.has(eventType)) throw new Error(`${prefix}.eventType is not supported`); requireDateString(row.eventDate, `${prefix}.eventDate`); if (["WITHDRAWN", "CORRECTION"].includes(eventType) && !hasValue(row.reason)) throw new Error(`${prefix}.reason is required`); });
  libraryCopies.forEach((copy, index) => { if (!libraryCopyEvents.some((event) => event.copyId === copy.id && event.eventType === "ACCESSIONED")) throw new Error(`libraryCopies[${index}] is missing its ACCESSIONED event`); });
  const libraryMembers = validateOptionalRows(root.libraryMembers, "libraryMembers", LIBRARY_MEMBER_KEYS, ["id", "memberCode", "memberType", "status", "joinedDate"]);
  const memberIds = new Set<string>(), memberCodes = new Set<string>(), memberStudentIds = new Set<string>(), memberStaffIds = new Set<string>();
  const backupStudentIds = new Set(students.map((row) => String(row.id))), backupStaffIds = new Set(staffMembers.map((row) => String(row.id)));
  libraryMembers.forEach((row, index) => { const prefix = `libraryMembers[${index}]`; const id = requireString(row.id, `${prefix}.id`), code = requireNormalizedLibraryTitleCode(row.memberCode, `${prefix}.memberCode`), type = requireString(row.memberType, `${prefix}.memberType`), status = requireString(row.status, `${prefix}.status`); const studentId = hasValue(row.studentId) ? String(row.studentId) : null, staffId = hasValue(row.staffMemberId) ? String(row.staffMemberId) : null; if (memberIds.has(id) || memberCodes.has(code)) throw new Error(`${prefix} duplicates a membership identity or member code`); memberIds.add(id); memberCodes.add(code); if ((studentId ? 1 : 0) + (staffId ? 1 : 0) !== 1) throw new Error(`${prefix} requires exactly one Student or StaffMember link`); if ((type === "STUDENT" && (!studentId || staffId)) || (type === "STAFF" && (!staffId || studentId)) || !["STUDENT", "STAFF"].includes(type)) throw new Error(`${prefix}.memberType does not match its exact link`); if (studentId && (!backupStudentIds.has(studentId) || memberStudentIds.has(studentId))) throw new Error(`${prefix}.studentId is missing or duplicates a membership`); if (staffId && (!backupStaffIds.has(staffId) || memberStaffIds.has(staffId))) throw new Error(`${prefix}.staffMemberId is missing or duplicates a membership`); if (studentId) memberStudentIds.add(studentId); if (staffId) memberStaffIds.add(staffId); if (!["ACTIVE", "SUSPENDED", "INACTIVE"].includes(status)) throw new Error(`${prefix}.status is not supported`); if (status === "SUSPENDED" && !hasValue(row.suspensionReason)) throw new Error(`${prefix}.suspensionReason is required`); requireCalendarDateString(row.joinedDate, `${prefix}.joinedDate`); if (hasValue(row.suspendedUntil)) requireCalendarDateString(row.suspendedUntil, `${prefix}.suspendedUntil`); });
  const libraryPolicies = validateOptionalRows(root.libraryPolicies, "libraryPolicies", LIBRARY_POLICY_KEYS, ["id", "policyCode", "name", "memberType", "maxActiveLoans", "loanPeriodDays", "maxRenewals", "renewalPeriodDays", "reservationLimit", "status", "priority"]);
  const policyIds = new Set<string>(), policyCodes = new Set<string>(), activePolicyScopes = new Set<string>();
  libraryPolicies.forEach((row, index) => { const prefix = `libraryPolicies[${index}]`; const id = requireString(row.id, `${prefix}.id`), code = requireNormalizedLibraryTitleCode(row.policyCode, `${prefix}.policyCode`), type = requireString(row.memberType, `${prefix}.memberType`), status = requireString(row.status, `${prefix}.status`); if (policyIds.has(id) || policyCodes.has(code)) throw new Error(`${prefix} duplicates a policy identity or code`); policyIds.add(id); policyCodes.add(code); if (!["STUDENT", "STAFF"].includes(type) || !["ACTIVE", "INACTIVE"].includes(status)) throw new Error(`${prefix} has unsupported memberType or status`); if ((type === "STUDENT" && hasValue(row.staffType)) || (type === "STAFF" && hasValue(row.className))) throw new Error(`${prefix} has an invalid member-type scope`); requirePositiveInteger(row.maxActiveLoans, `${prefix}.maxActiveLoans`); requirePositiveInteger(row.loanPeriodDays, `${prefix}.loanPeriodDays`); requireNonNegativeInteger(row.maxRenewals, `${prefix}.maxRenewals`); requirePositiveInteger(row.renewalPeriodDays, `${prefix}.renewalPeriodDays`); requireNonNegativeInteger(row.reservationLimit, `${prefix}.reservationLimit`); requireNonNegativeInteger(row.priority, `${prefix}.priority`); if (status === "ACTIVE") { const scope = `${type}|${String(row.className ?? "")}|${String(row.staffType ?? "")}|${row.priority}`; if (activePolicyScopes.has(scope)) throw new Error(`${prefix} duplicates an active policy scope and priority`); activePolicyScopes.add(scope); } });
  const libraryLoans = validateOptionalRows(root.libraryLoans, "libraryLoans", LIBRARY_LOAN_KEYS, ["id", "loanNumber", "copyId", "memberId", "status", "issueDate", "dueDate", "policyCodeSnapshot", "loanPeriodDaysSnapshot", "maxRenewalsSnapshot", "renewalPeriodDaysSnapshot", "issueConditionSnapshot"]);
  const loanIds = new Set<string>(), loanNumbers = new Set<string>(), activeLoanCopies = new Set<string>(); const copyTitleMap = new Map(libraryCopies.map((row) => [String(row.id), String(row.titleId)])); const loanLinks = new Map<string, { memberId: string; copyId: string; titleId: string; status: string }>();
  libraryLoans.forEach((row, index) => { const prefix = `libraryLoans[${index}]`; const id = requireString(row.id, `${prefix}.id`), loanNumber = requireString(row.loanNumber, `${prefix}.loanNumber`), copyId = requireString(row.copyId, `${prefix}.copyId`), memberId = requireString(row.memberId, `${prefix}.memberId`), status = requireString(row.status, `${prefix}.status`); if (loanIds.has(id) || loanNumbers.has(loanNumber)) throw new Error(`${prefix} duplicates a loan identity or number`); loanIds.add(id); loanNumbers.add(loanNumber); if (!libraryCopyIds.has(copyId) || !memberIds.has(memberId)) throw new Error(`${prefix} has an invalid copy or member link`); if (!["ISSUED", "RETURNED", "CANCELLED"].includes(status)) throw new Error(`${prefix}.status is not supported`); const issue = new Date(requireDateString(row.issueDate, `${prefix}.issueDate`)), due = new Date(requireDateString(row.dueDate, `${prefix}.dueDate`)); if (due < issue) throw new Error(`${prefix}.dueDate cannot be before issueDate`); if (hasValue(row.returnedDate) && new Date(requireDateString(row.returnedDate, `${prefix}.returnedDate`)) < issue) throw new Error(`${prefix}.returnedDate cannot be before issueDate`); requirePositiveInteger(row.loanPeriodDaysSnapshot, `${prefix}.loanPeriodDaysSnapshot`); requireNonNegativeInteger(row.maxRenewalsSnapshot, `${prefix}.maxRenewalsSnapshot`); requirePositiveInteger(row.renewalPeriodDaysSnapshot, `${prefix}.renewalPeriodDaysSnapshot`); requireNonNegativeInteger(row.renewCount ?? 0, `${prefix}.renewCount`); if (Number(row.renewCount ?? 0) > Number(row.maxRenewalsSnapshot)) throw new Error(`${prefix}.renewCount exceeds its snapshot limit`); if (status === "ISSUED") { if (String(row.activeCopyKey ?? "") !== copyId || activeLoanCopies.has(copyId)) throw new Error(`${prefix} violates active-copy uniqueness`); activeLoanCopies.add(copyId); } else if (hasValue(row.activeCopyKey)) throw new Error(`${prefix}.activeCopyKey must be empty for a closed loan`); if (status === "RETURNED" && !hasValue(row.returnedDate)) throw new Error(`${prefix}.returnedDate is required`); if (status === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`${prefix}.cancellationReason is required`); loanLinks.set(id, { memberId, copyId, titleId: copyTitleMap.get(copyId)!, status }); });
  const libraryReservations = validateOptionalRows(root.libraryReservations, "libraryReservations", LIBRARY_RESERVATION_KEYS, ["id", "reservationNumber", "titleId", "memberId", "status", "requestedDate"]);
  const reservationIds = new Set<string>(), reservationNumbers = new Set<string>(), waitingMemberTitles = new Set<string>(), fulfilledLoanIds = new Set<string>();
  const reservationLinks = new Map<string, { memberId: string; titleId: string; fulfilledLoanId: string | null; status: string }>();
  libraryReservations.forEach((row, index) => { const prefix = `libraryReservations[${index}]`; const id = requireString(row.id, `${prefix}.id`), number = requireString(row.reservationNumber, `${prefix}.reservationNumber`), titleId = requireString(row.titleId, `${prefix}.titleId`), memberId = requireString(row.memberId, `${prefix}.memberId`), status = requireString(row.status, `${prefix}.status`); if (reservationIds.has(id) || reservationNumbers.has(number)) throw new Error(`${prefix} duplicates a reservation identity or number`); reservationIds.add(id); reservationNumbers.add(number); if (!libraryTitleIds.has(titleId) || !memberIds.has(memberId)) throw new Error(`${prefix} has an invalid title or member link`); if (!["WAITING", "FULFILLED", "CANCELLED", "EXPIRED"].includes(status)) throw new Error(`${prefix}.status is not supported`); requireDateString(row.requestedDate, `${prefix}.requestedDate`); const key = `${memberId}:${titleId}`; if (status === "WAITING") { if (String(row.activeMemberTitleKey ?? "") !== key || waitingMemberTitles.has(key)) throw new Error(`${prefix} violates active member/title reservation uniqueness`); waitingMemberTitles.add(key); } else if (hasValue(row.activeMemberTitleKey)) throw new Error(`${prefix}.activeMemberTitleKey must be empty after queue closure`); let fulfilledLoanId: string | null = null; if (status === "FULFILLED") { fulfilledLoanId = requireString(row.fulfilledLoanId, `${prefix}.fulfilledLoanId`); const loan = loanLinks.get(fulfilledLoanId); if (!loan || loan.memberId !== memberId || loan.titleId !== titleId || fulfilledLoanIds.has(fulfilledLoanId)) throw new Error(`${prefix}.fulfilledLoanId does not link exactly one matching loan`); fulfilledLoanIds.add(fulfilledLoanId); } else if (hasValue(row.fulfilledLoanId)) throw new Error(`${prefix}.fulfilledLoanId is only valid for FULFILLED reservations`); if (status === "CANCELLED" && !hasValue(row.cancellationReason)) throw new Error(`${prefix}.cancellationReason is required`); reservationLinks.set(id, { memberId, titleId, fulfilledLoanId, status }); });
  const libraryLoanEvents = validateOptionalRows(root.libraryLoanEvents, "libraryLoanEvents", LIBRARY_LOAN_EVENT_KEYS, ["id", "memberId", "eventType", "eventDate"]); const circulationEventIds = new Set<string>(); const circulationEventTypes = new Set(["ISSUED", "RETURNED", "RENEWED", "LOAN_CANCELLED", "RESERVATION_CREATED", "RESERVATION_FULFILLED", "RESERVATION_CANCELLED", "RESERVATION_EXPIRED", "MEMBER_SUSPENDED", "MEMBER_REACTIVATED", "LOST_REPORTED", "DAMAGE_REPORTED", "CORRECTION"]);
  libraryLoanEvents.forEach((row, index) => {
    const prefix = `libraryLoanEvents[${index}]`;
    const id = requireString(row.id, `${prefix}.id`), memberId = requireString(row.memberId, `${prefix}.memberId`), type = requireString(row.eventType, `${prefix}.eventType`);
    if (circulationEventIds.has(id)) throw new Error(`${prefix}.id is duplicated`);
    circulationEventIds.add(id);
    if (!memberIds.has(memberId) || !circulationEventTypes.has(type)) throw new Error(`${prefix} has an invalid member link or event type`);
    const loanId = hasValue(row.loanId) ? String(row.loanId) : null;
    const reservationId = hasValue(row.reservationId) ? String(row.reservationId) : null;
    const loan = loanId ? loanLinks.get(loanId) : null;
    const reservation = reservationId ? reservationLinks.get(reservationId) : null;
    if (loanId && !loan) throw new Error(`${prefix}.loanId does not match a backup loan`);
    if (reservationId && !reservation) throw new Error(`${prefix}.reservationId does not match a backup reservation`);
    if (hasValue(row.copyId) && !libraryCopyIds.has(String(row.copyId))) throw new Error(`${prefix}.copyId does not match a backup copy`);
    if (hasValue(row.titleId) && !libraryTitleIds.has(String(row.titleId))) throw new Error(`${prefix}.titleId does not match a backup title`);
    if (loan && (loan.memberId !== memberId || (hasValue(row.copyId) && String(row.copyId) !== loan.copyId) || (hasValue(row.titleId) && String(row.titleId) !== loan.titleId))) throw new Error(`${prefix} does not match its linked loan`);
    if (reservation && (reservation.memberId !== memberId || (hasValue(row.titleId) && String(row.titleId) !== reservation.titleId))) throw new Error(`${prefix} does not match its linked reservation`);
    if (["ISSUED", "RETURNED", "RENEWED", "LOAN_CANCELLED"].includes(type) && !loan) throw new Error(`${prefix}.loanId is required for ${type}`);
    if (["RESERVATION_CREATED", "RESERVATION_CANCELLED", "RESERVATION_EXPIRED"].includes(type) && !reservation) throw new Error(`${prefix}.reservationId is required for ${type}`);
    if (type === "RESERVATION_FULFILLED" && (!loan || !reservation || reservation.status !== "FULFILLED" || reservation.fulfilledLoanId !== loanId)) throw new Error(`${prefix} requires matching fulfilled reservation and loan links`);
    requireDateString(row.eventDate, `${prefix}.eventDate`);
  });
  const libraryIncidents = validateOptionalRows(root.libraryIncidents, "libraryIncidents", LIBRARY_INCIDENT_KEYS, ["id","incidentNumber","incidentType","status","loanId","memberId","copyId","titleId","reportedDate","description"]);
  const incidentIds = new Set<string>(), incidentNumbers = new Set<string>(), activeIncidentKeys = new Set<string>();
  libraryIncidents.forEach((row,index)=>{const prefix=`libraryIncidents[${index}]`;const id=requireString(row.id,`${prefix}.id`),incidentNumber=requireString(row.incidentNumber,`${prefix}.incidentNumber`),type=requireString(row.incidentType,`${prefix}.incidentType`),status=requireString(row.status,`${prefix}.status`),loanId=requireString(row.loanId,`${prefix}.loanId`),memberId=requireString(row.memberId,`${prefix}.memberId`),copyId=requireString(row.copyId,`${prefix}.copyId`),titleId=requireString(row.titleId,`${prefix}.titleId`);if(incidentIds.has(id)||incidentNumbers.has(incidentNumber))throw new Error(`${prefix} duplicates an incident identity or number`);incidentIds.add(id);incidentNumbers.add(incidentNumber);if(!["LOST","DAMAGED"].includes(type)||!["DRAFT","PENDING_REVIEW","APPROVED","RESOLVED","CANCELLED"].includes(status))throw new Error(`${prefix} has unsupported type or status`);const loan=loanLinks.get(loanId);if(!loan||loan.memberId!==memberId||loan.copyId!==copyId||loan.titleId!==titleId)throw new Error(`${prefix} links do not match the canonical loan/member/copy/title`);if(type==="LOST"&&loan.status!=="ISSUED"&&!['RESOLVED','CANCELLED'].includes(status))throw new Error(`${prefix} open LOST incident requires an issued loan`);if(type==="DAMAGED"&&!hasValue(row.incidentCondition))throw new Error(`${prefix}.incidentCondition is required`);if(!['RESOLVED','CANCELLED'].includes(status)){const key=requireString(row.activeCaseKey,`${prefix}.activeCaseKey`);if(activeIncidentKeys.has(key))throw new Error(`${prefix} duplicates an active incident key`);activeIncidentKeys.add(key);}else if(hasValue(row.activeCaseKey))throw new Error(`${prefix}.activeCaseKey must be empty after closure`);if(hasValue(row.replacementCopyId)){const replacement=String(row.replacementCopyId);if(!libraryCopyIds.has(replacement)||replacement===copyId)throw new Error(`${prefix}.replacementCopyId is invalid`);}requireDateString(row.reportedDate,`${prefix}.reportedDate`);});
  const libraryChargeRules = validateOptionalRows(root.libraryChargeRules,"libraryChargeRules",LIBRARY_CHARGE_RULE_KEYS,["id","ruleCode","name","memberType","graceDays","overdueAmountPerDay","lostChargeBasis","damagedChargeBasis","priority","status"]);const ruleIds=new Set<string>(),ruleCodes=new Set<string>(),activeRuleScopes=new Set<string>();libraryChargeRules.forEach((row,index)=>{const prefix=`libraryChargeRules[${index}]`;const id=requireString(row.id,`${prefix}.id`),code=requireNormalizedLibraryTitleCode(row.ruleCode,`${prefix}.ruleCode`),memberType=requireString(row.memberType,`${prefix}.memberType`),status=requireString(row.status,`${prefix}.status`);if(ruleIds.has(id)||ruleCodes.has(code))throw new Error(`${prefix} duplicates a charge-rule identity or code`);ruleIds.add(id);ruleCodes.add(code);if(!['STUDENT','STAFF'].includes(memberType)||!['ACTIVE','INACTIVE'].includes(status))throw new Error(`${prefix} has unsupported memberType or status`);if((memberType==='STUDENT'&&hasValue(row.staffType))||(memberType==='STAFF'&&hasValue(row.className)))throw new Error(`${prefix} has an invalid scope`);requireNonNegativeInteger(row.graceDays,`${prefix}.graceDays`);requireNonNegativeInteger(row.priority,`${prefix}.priority`);restoreMoneyCents(row.overdueAmountPerDay,`${prefix}.overdueAmountPerDay`,false);if(hasValue(row.maximumOverdueAmount))restoreMoneyCents(row.maximumOverdueAmount,`${prefix}.maximumOverdueAmount`,false);if(status==='ACTIVE'){const key=`${memberType}|${String(row.className??'')}|${String(row.staffType??'')}|${row.priority}`;if(activeRuleScopes.has(key))throw new Error(`${prefix} duplicates an active rule scope and priority`);activeRuleScopes.add(key);}});
  const libraryCharges = validateOptionalRows(root.libraryCharges, "libraryCharges", LIBRARY_CHARGE_KEYS, ["id", "chargeNumber", "chargeType", "status", "memberId", "assessedDate", "originalAmount", "waivedAmount", "payableAmount", "assessmentReason"]);
  const chargeIds = new Set<string>(), chargeNumbers = new Set<string>(), activeOverdueLoans = new Set<string>(), linkedReceiptIds = new Set<string>();
  const memberRows = new Map(libraryMembers.map((row) => [String(row.id), row]));
  const incidentRows = new Map(libraryIncidents.map((row) => [String(row.id), row]));
  const receiptRows = new Map(miscIncomeReceipts.map((row) => [String(row.id), row]));
  const itemRows = new Map(miscIncomeItems.map((row) => [String(row.id), row]));
  const receiptLines = new Map<string, RestoreRecord[]>();
  for (const line of miscIncomeReceiptLines) {
    const receiptId = String(line.receiptId);
    receiptLines.set(receiptId, [...(receiptLines.get(receiptId) ?? []), line]);
  }
  libraryCharges.forEach((row, index) => {
    const prefix = `libraryCharges[${index}]`;
    const id = requireString(row.id, `${prefix}.id`);
    const chargeNumber = requireString(row.chargeNumber, `${prefix}.chargeNumber`);
    const chargeType = requireString(row.chargeType, `${prefix}.chargeType`);
    const status = requireString(row.status, `${prefix}.status`);
    const memberId = requireString(row.memberId, `${prefix}.memberId`);
    if (chargeIds.has(id) || chargeNumbers.has(chargeNumber)) throw new Error(`${prefix} duplicates a charge identity or number`);
    chargeIds.add(id);
    chargeNumbers.add(chargeNumber);
    if (!["OVERDUE", "LOST_BOOK", "DAMAGED_BOOK", "REPLACEMENT_DIFFERENCE", "OTHER"].includes(chargeType) || !["DRAFT", "PENDING_APPROVAL", "APPROVED", "WAIVED", "PAID", "CANCELLED"].includes(status)) throw new Error(`${prefix} has unsupported type or status`);

    const member = memberRows.get(memberId);
    if (!member) throw new Error(`${prefix}.memberId is invalid`);
    const studentId = hasValue(row.studentId) ? String(row.studentId) : null;
    const staffId = hasValue(row.staffMemberId) ? String(row.staffMemberId) : null;
    if ((studentId ? 1 : 0) + (staffId ? 1 : 0) !== 1 || studentId !== String(member.studentId ?? "") && staffId !== String(member.staffMemberId ?? "")) throw new Error(`${prefix} Student/Staff ownership does not match the member`);

    const loanId = hasValue(row.loanId) ? String(row.loanId) : null;
    const loan = loanId ? loanLinks.get(loanId) : null;
    if (loanId && !loan) throw new Error(`${prefix}.loanId is invalid`);
    if (loan && String(loan.memberId) !== memberId) throw new Error(`${prefix} loan does not belong to the charge member`);
    const incidentId = hasValue(row.incidentId) ? String(row.incidentId) : null;
    const incident = incidentId ? incidentRows.get(incidentId) : null;
    if (incidentId && !incident) throw new Error(`${prefix}.incidentId is invalid`);
    if (incident && (String(incident.memberId) !== memberId || loanId !== String(incident.loanId))) throw new Error(`${prefix} incident, loan, and member links do not match`);
    if (chargeType === "OVERDUE" && (!loan || incident)) throw new Error(`${prefix} overdue charge requires one matching loan and no incident`);
    if (chargeType === "LOST_BOOK" && (!incident || incident.incidentType !== "LOST")) throw new Error(`${prefix} lost-book charge requires a matching LOST incident`);
    if (chargeType === "DAMAGED_BOOK" && (!incident || incident.incidentType !== "DAMAGED")) throw new Error(`${prefix} damaged-book charge requires a matching DAMAGED incident`);

    const original = restoreMoneyCents(row.originalAmount, `${prefix}.originalAmount`, false);
    const waived = restoreMoneyCents(row.waivedAmount, `${prefix}.waivedAmount`);
    const payable = restoreMoneyCents(row.payableAmount, `${prefix}.payableAmount`);
    if (waived > original || original - waived !== payable) throw new Error(`${prefix} amounts do not reconcile exactly`);
    if (chargeType === "OVERDUE" && !["WAIVED", "PAID", "CANCELLED"].includes(status)) {
      const key = requireString(row.activeOverdueLoanKey, `${prefix}.activeOverdueLoanKey`);
      if (activeOverdueLoans.has(key) || key !== loanId) throw new Error(`${prefix} violates active overdue-charge uniqueness`);
      activeOverdueLoans.add(key);
    } else if (hasValue(row.activeOverdueLoanKey)) {
      throw new Error(`${prefix}.activeOverdueLoanKey must be empty for this charge state`);
    }

    if (hasValue(row.miscIncomeReceiptId)) {
      const receiptId = String(row.miscIncomeReceiptId);
      const receipt = receiptRows.get(receiptId);
      if (!receipt || linkedReceiptIds.has(receiptId) || status !== "PAID") throw new Error(`${prefix}.miscIncomeReceiptId does not identify one unique backup receipt for a paid charge`);
      if (studentId && String(receipt.studentId ?? "") !== studentId) throw new Error(`${prefix} receipt Student does not match the charge Student`);
      if (staffId && hasValue(receipt.studentId)) throw new Error(`${prefix} Staff charge receipt must not have a Student link`);
      const receiptAmount = restoreMoneyCents(receipt.netAmount, `${prefix} receipt amount`);
      const lines = receiptLines.get(receiptId) ?? [];
      if (receiptAmount !== payable || lines.length !== 1) throw new Error(`${prefix} receipt amount and single Library line must match the payable amount`);
      const line = lines[0];
      const item = itemRows.get(String(line.itemId));
      const expectedItemCode = studentId ? "LIB-STUDENT-CHARGE" : "LIB-STAFF-CHARGE";
      if (!item || item.itemCode !== expectedItemCode) throw new Error(`${prefix} receipt must use the configured Library charge item`);
      requirePositiveInteger(line.quantity, `${prefix} receipt quantity`);
      if (Number(line.quantity) !== 1 || restoreMoneyCents(line.unitAmount, `${prefix} receipt unit amount`) !== payable || restoreMoneyCents(line.discountAmount, `${prefix} receipt discount`) !== 0n || restoreMoneyCents(line.lineTotal, `${prefix} receipt line amount`) !== payable) throw new Error(`${prefix} receipt line amounts do not match the charge`);
      linkedReceiptIds.add(receiptId);
    } else if (status === "PAID") {
      throw new Error(`${prefix} paid charge requires a linked receipt`);
    }
    requireDateString(row.assessedDate, `${prefix}.assessedDate`);
  });
  const libraryChargeEvents=validateOptionalRows(root.libraryChargeEvents,"libraryChargeEvents",LIBRARY_CHARGE_EVENT_KEYS,["id","eventType","eventDate"]);const chargeEventIds=new Set<string>();libraryChargeEvents.forEach((row,index)=>{const prefix=`libraryChargeEvents[${index}]`;const id=requireString(row.id,`${prefix}.id`);if(chargeEventIds.has(id))throw new Error(`${prefix}.id is duplicated`);chargeEventIds.add(id);const chargeId=hasValue(row.chargeId)?String(row.chargeId):null,incidentId=hasValue(row.incidentId)?String(row.incidentId):null;if(!chargeId&&!incidentId)throw new Error(`${prefix} requires a charge or incident link`);if(chargeId&&!chargeIds.has(chargeId))throw new Error(`${prefix}.chargeId is invalid`);if(incidentId&&!incidentIds.has(incidentId))throw new Error(`${prefix}.incidentId is invalid`);if(hasValue(row.amountSnapshot))restoreMoneyCents(row.amountSnapshot,`${prefix}.amountSnapshot`);requireDateString(row.eventDate,`${prefix}.eventDate`);});
  notices.forEach((row, index) => {
    const audience = requireString(row.audienceType, `notices[${index}].audienceType`);
    if (!["ALL_PARENTS", "CLASS", "SECTION"].includes(audience)) {
      throw new Error(`notices[${index}].audienceType is not supported`);
    }
    const status = requireString(row.status, `notices[${index}].status`);
    if (!["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      throw new Error(`notices[${index}].status is not supported`);
    }
    if (audience !== "ALL_PARENTS" && !hasValue(row.className)) {
      throw new Error(`notices[${index}].className is required for this audience`);
    }
    if (audience === "SECTION" && !hasValue(row.section)) {
      throw new Error(`notices[${index}].section is required for this audience`);
    }
    if (hasValue(row.publishDate)) requireDateString(row.publishDate, `notices[${index}].publishDate`);
    if (hasValue(row.expiresAt)) requireDateString(row.expiresAt, `notices[${index}].expiresAt`);
  });
  const receiptNotes = validateOptionalRows(
    root.receiptNotes,
    "receiptNotes",
    RECEIPT_NOTE_KEYS,
    ["receiptNo"]
  );
  const importBatches = validateOptionalRows(
    root.importBatches,
    "importBatches",
    IMPORT_BATCH_KEYS,
    ["id", "type", "fileName", "importedAt", "mode", "totalRows", "status"]
  );
  importBatches.forEach((batch, index) => validateImportBatch(batch, index));
  const onboardingBatches = validateOptionalRows(
    root.onboardingBatches,
    "onboardingBatches",
    ONBOARDING_BATCH_KEYS,
    ["id", "publicKey", "bundleType", "mode", "status", "version", "originalFileNameHash", "workbookSha256", "mimeType", "byteSize", "templateVersion", "schemaVersion", "purgeAfter", "createdAt", "updatedAt"]
  );
  onboardingBatches.forEach((row, index) => {
    requirePositiveInteger(row.version, `onboardingBatches[${index}].version`);
    requireNonNegativeInteger(row.byteSize, `onboardingBatches[${index}].byteSize`);
    requireDateString(row.purgeAfter, `onboardingBatches[${index}].purgeAfter`);
    requireDateString(row.createdAt, `onboardingBatches[${index}].createdAt`);
    requireDateString(row.updatedAt, `onboardingBatches[${index}].updatedAt`);
  });
  const onboardingRowOutcomes = validateOptionalRows(
    root.onboardingRowOutcomes,
    "onboardingRowOutcomes",
    ONBOARDING_ROW_OUTCOME_KEYS,
    ["id", "batchId", "entityType", "sheetName", "sourceRowNumber", "importRowKey", "action", "status", "createdAt"]
  );
  onboardingRowOutcomes.forEach((row, index) => {
    requirePositiveInteger(row.sourceRowNumber, `onboardingRowOutcomes[${index}].sourceRowNumber`);
    requireDateString(row.createdAt, `onboardingRowOutcomes[${index}].createdAt`);
  });
  const onboardingAuditEvents = validateOptionalRows(
    root.onboardingAuditEvents,
    "onboardingAuditEvents",
    ONBOARDING_AUDIT_EVENT_KEYS,
    ["id", "batchId", "sequence", "eventType", "occurredAt"]
  );
  onboardingAuditEvents.forEach((row, index) => {
    requirePositiveInteger(row.sequence, `onboardingAuditEvents[${index}].sequence`);
    requireDateString(row.occurredAt, `onboardingAuditEvents[${index}].occurredAt`);
  });
  const goLiveChecklist = validateOptionalChecklist(root.goLiveChecklist);
  const timetableTeachers = validateOptionalRows(
    root.timetableTeachers,
    "timetableTeachers",
    TIMETABLE_TEACHER_KEYS,
    ["name", "shortName", "maxPeriodsPerWeek"]
  );
  timetableTeachers.forEach((row, index) => {
    requirePositiveInteger(row.maxPeriodsPerWeek, `timetableTeachers[${index}].maxPeriodsPerWeek`);
    optionalPositiveInteger(row.maxPeriodsPerDay, `timetableTeachers[${index}].maxPeriodsPerDay`);
  });
  const timetableSubjects = validateOptionalRows(
    root.timetableSubjects,
    "timetableSubjects",
    TIMETABLE_SUBJECT_KEYS,
    ["name", "shortName"]
  );
  const timetableClassSections = validateOptionalRows(
    root.timetableClassSections,
    "timetableClassSections",
    TIMETABLE_CLASS_SECTION_KEYS,
    ["academicYear", "className", "groupName"]
  );
  const timetablePeriodTemplates = validateOptionalRows(
    root.timetablePeriodTemplates,
    "timetablePeriodTemplates",
    TIMETABLE_PERIOD_TEMPLATE_KEYS,
    ["academicYear", "dayOfWeek", "label", "startTime", "endTime", "type", "sortOrder"]
  );
  timetablePeriodTemplates.forEach((row, index) => {
    if (!hasValue(row.groupName) && !hasValue(row.classGroup)) {
      throw new Error(`timetablePeriodTemplates[${index}].groupName is required`);
    }
    requireNonNegativeInteger(row.sortOrder, `timetablePeriodTemplates[${index}].sortOrder`);
    optionalPositiveInteger(row.periodNumber, `timetablePeriodTemplates[${index}].periodNumber`);
  });
  const timetableAssignments = validateOptionalRows(
    root.timetableAssignments,
    "timetableAssignments",
    TIMETABLE_ASSIGNMENT_KEYS,
    ["academicYear", "classSectionId", "subjectId", "teacherId", "periodsPerWeek"]
  );
  timetableAssignments.forEach((row, index) => {
    requirePositiveInteger(row.periodsPerWeek, `timetableAssignments[${index}].periodsPerWeek`);
    optionalNonNegativeInteger(row.priority, `timetableAssignments[${index}].priority`);
  });
  const timetableTeacherUnavailability = validateOptionalRows(
    root.timetableTeacherUnavailability,
    "timetableTeacherUnavailability",
    TIMETABLE_UNAVAILABILITY_KEYS,
    ["teacherId", "dayOfWeek", "periodNumber"]
  );
  timetableTeacherUnavailability.forEach((row, index) => {
    requirePositiveInteger(
      row.periodNumber,
      `timetableTeacherUnavailability[${index}].periodNumber`
    );
  });
  const timetableFixedPeriods = validateOptionalRows(
    root.timetableFixedPeriods,
    "timetableFixedPeriods",
    TIMETABLE_FIXED_PERIOD_KEYS,
    ["academicYear", "dayOfWeek", "periodNumber", "label"]
  );
  timetableFixedPeriods.forEach((row, index) => {
    requirePositiveInteger(row.periodNumber, `timetableFixedPeriods[${index}].periodNumber`);
  });
  const timetableDrafts = validateOptionalRows(
    root.timetableDrafts,
    "timetableDrafts",
    TIMETABLE_DRAFT_KEYS,
    ["academicYear", "name", "status"]
  );
  timetableDrafts.forEach((row, index) => {
    if (!["DRAFT", "ACTIVE", "ARCHIVED"].includes(requireString(row.status, `timetableDrafts[${index}].status`))) {
      throw new Error(`timetableDrafts[${index}].status is not supported`);
    }
  });
  const timetableEntries = validateOptionalRows(
    root.timetableEntries,
    "timetableEntries",
    TIMETABLE_ENTRY_KEYS,
    ["draftId", "academicYear", "classSectionId", "dayOfWeek", "periodNumber", "entryType"]
  );
  timetableEntries.forEach((row, index) => {
    requirePositiveInteger(row.periodNumber, `timetableEntries[${index}].periodNumber`);
    if (!["TEACHING", "FIXED", "FREE", "ACTIVITY", "SUBSTITUTION", "EMPTY"].includes(requireString(row.entryType, `timetableEntries[${index}].entryType`))) {
      throw new Error(`timetableEntries[${index}].entryType is not supported`);
    }
  });
  const libraryStockVerificationSessions = validateOptionalRows(root.libraryStockVerificationSessions, "libraryStockVerificationSessions", LIBRARY_STOCK_SESSION_KEYS, ["id","sessionNumber","title","academicYear","verificationDate","scopeType","status"]);
  const stockSessionIds = new Set<string>(), stockSessionNumbers = new Set<string>();
  libraryStockVerificationSessions.forEach((row,index)=>{const prefix=`libraryStockVerificationSessions[${index}]`;const id=requireString(row.id,`${prefix}.id`),number=requireNormalizedLibraryTitleCode(row.sessionNumber,`${prefix}.sessionNumber`),scope=requireString(row.scopeType,`${prefix}.scopeType`),status=requireString(row.status,`${prefix}.status`);if(stockSessionIds.has(id)||stockSessionNumbers.has(number))throw new Error(`${prefix} duplicates a stock session identity or normalized session number`);stockSessionIds.add(id);stockSessionNumbers.add(number);if(!["ALL_ACTIVE_COPIES","SHELF","TITLE","CATEGORY","SUBJECT","CUSTOM"].includes(scope))throw new Error(`${prefix}.scopeType is not supported`);if(!["DRAFT","IN_PROGRESS","SUBMITTED","REVIEWED","APPROVED","LOCKED","CANCELLED"].includes(status))throw new Error(`${prefix}.status is not supported`);if(scope==="SHELF"&&!hasValue(row.shelfCodeFilter))throw new Error(`${prefix}.shelfCodeFilter is required`);if(scope==="TITLE"&&(!hasValue(row.titleIdFilter)||!libraryTitleIds.has(String(row.titleIdFilter))))throw new Error(`${prefix}.titleIdFilter is invalid`);if(scope==="CATEGORY"&&!hasValue(row.categoryFilter))throw new Error(`${prefix}.categoryFilter is required`);if(scope==="SUBJECT"&&!hasValue(row.subjectFilter))throw new Error(`${prefix}.subjectFilter is required`);requireDateString(row.verificationDate,`${prefix}.verificationDate`);if(status==="LOCKED"&&!hasValue(row.lockedAt))throw new Error(`${prefix}.lockedAt is required`);if(status==="CANCELLED"&&!hasValue(row.cancellationReason))throw new Error(`${prefix}.cancellationReason is required`);});
  const libraryStockVerificationRecords = validateOptionalRows(root.libraryStockVerificationRecords,"libraryStockVerificationRecords",LIBRARY_STOCK_RECORD_KEYS,["id","sessionId","copyId","expectedAccessionNumberSnapshot","expectedTitleSnapshot","expectedStatusSnapshot","expectedConditionSnapshot","observationStatus","resolutionStatus"]);
  const stockRecordIds=new Set<string>(),stockSessionCopyKeys=new Set<string>(),appliedStockEventIds=new Set<string>();
  libraryStockVerificationRecords.forEach((row,index)=>{const prefix=`libraryStockVerificationRecords[${index}]`;const id=requireString(row.id,`${prefix}.id`),sessionId=requireString(row.sessionId,`${prefix}.sessionId`),copyId=requireString(row.copyId,`${prefix}.copyId`),key=`${sessionId}|${copyId}`,observation=requireString(row.observationStatus,`${prefix}.observationStatus`),resolution=requireString(row.resolutionStatus,`${prefix}.resolutionStatus`);if(stockRecordIds.has(id)||stockSessionCopyKeys.has(key))throw new Error(`${prefix} duplicates a record identity or session+copy link`);stockRecordIds.add(id);stockSessionCopyKeys.add(key);if(!stockSessionIds.has(sessionId)||!libraryCopyIds.has(copyId))throw new Error(`${prefix} does not match an exact backup session and copy`);if(!["NOT_CHECKED","PRESENT","ISSUED_OFFSITE","KNOWN_REPAIR","MISSING","MIS_SHELVED","DAMAGED","UNEXPECTED","WITHDRAWN_REFERENCE","NEEDS_REVIEW"].includes(observation))throw new Error(`${prefix}.observationStatus is not supported`);if(!["NOT_REQUIRED","PENDING_REVIEW","APPROVED_NO_CHANGE","APPROVED_UPDATE_SHELF","APPROVED_MARK_MISSING","APPROVED_CONDITION_UPDATE","APPROVED_SEND_FOR_REPAIR","REJECTED","APPLIED"].includes(resolution))throw new Error(`${prefix}.resolutionStatus is not supported`);if(hasValue(row.appliedCopyEventId)){const eventId=String(row.appliedCopyEventId);if(resolution!=="APPLIED"||!libraryEventIds.has(eventId)||libraryEventCopyIds.get(eventId)!==copyId||appliedStockEventIds.has(eventId))throw new Error(`${prefix}.appliedCopyEventId must be one unique append-only event for the same copy and match APPLIED state`);appliedStockEventIds.add(eventId);}else if(resolution==="APPLIED")throw new Error(`${prefix}.appliedCopyEventId is required for APPLIED`);});
  const libraryStockVerificationScanEvents=validateOptionalRows(root.libraryStockVerificationScanEvents,"libraryStockVerificationScanEvents",LIBRARY_STOCK_SCAN_KEYS,["id","sessionId","normalizedInput","scanMethod","resultType","scannedAt"]);const stockScanIds=new Set<string>();libraryStockVerificationScanEvents.forEach((row,index)=>{const prefix=`libraryStockVerificationScanEvents[${index}]`;const id=requireString(row.id,`${prefix}.id`),sessionId=requireString(row.sessionId,`${prefix}.sessionId`);if(stockScanIds.has(id)||!stockSessionIds.has(sessionId))throw new Error(`${prefix} has a duplicate identity or invalid session`);stockScanIds.add(id);if(hasValue(row.recordId)&&!stockRecordIds.has(String(row.recordId)))throw new Error(`${prefix}.recordId does not match a backup stock record`);if(!["BARCODE","ACCESSION","MANUAL"].includes(requireString(row.scanMethod,`${prefix}.scanMethod`)))throw new Error(`${prefix}.scanMethod is unsupported`);if(!["MATCHED_EXPECTED","DUPLICATE_SCAN","OUT_OF_SCOPE_COPY","UNKNOWN_VALUE","WITHDRAWN_COPY","INVALID_VALUE","MANUAL_OVERRIDE"].includes(requireString(row.resultType,`${prefix}.resultType`)))throw new Error(`${prefix}.resultType is unsupported`);requireDateString(row.scannedAt,`${prefix}.scannedAt`);});
  const libraryStockVerificationEvents=validateOptionalRows(root.libraryStockVerificationEvents,"libraryStockVerificationEvents",LIBRARY_STOCK_EVENT_KEYS,["id","sessionId","eventType","eventDate"]);const stockEventIds=new Set<string>();libraryStockVerificationEvents.forEach((row,index)=>{const prefix=`libraryStockVerificationEvents[${index}]`;const id=requireString(row.id,`${prefix}.id`);if(stockEventIds.has(id)||!stockSessionIds.has(requireString(row.sessionId,`${prefix}.sessionId`)))throw new Error(`${prefix} has a duplicate identity or invalid session`);stockEventIds.add(id);if(!["CREATED","STARTED","SCAN_RECORDED","SUBMITTED","REVIEWED","APPROVED","RESOLUTION_APPLIED","LOCKED","CANCELLED","CORRECTION"].includes(requireString(row.eventType,`${prefix}.eventType`)))throw new Error(`${prefix}.eventType is unsupported`);requireDateString(row.eventDate,`${prefix}.eventDate`);});
  const homeworkAssignments = validateOptionalRows(root.homeworkAssignments, "homeworkAssignments", HOMEWORK_ASSIGNMENT_KEYS, ["id","assignmentNumber","academicYear","title","instructions","className","subjectName","assignedDate","status","priority"]);
  const homeworkAssignmentIds = new Set<string>(), homeworkNumbers = new Set<string>(), timetableSubjectIds = new Set(timetableSubjects.map((row) => String(row.id ?? "")).filter(Boolean));
  homeworkAssignments.forEach((row,index)=>{const prefix=`homeworkAssignments[${index}]`,id=requireString(row.id,`${prefix}.id`),number=requireString(row.assignmentNumber,`${prefix}.assignmentNumber`).trim().toUpperCase();if(!/^[A-Z0-9][A-Z0-9-]{3,39}$/.test(number))throw new Error(`${prefix}.assignmentNumber is invalid`);if(homeworkAssignmentIds.has(id)||homeworkNumbers.has(number))throw new Error(`${prefix} duplicates an assignment identity or normalized assignment number`);homeworkAssignmentIds.add(id);homeworkNumbers.add(number);if(!/^\d{4}-\d{2}$/.test(requireString(row.academicYear,`${prefix}.academicYear`)))throw new Error(`${prefix}.academicYear must use YYYY-YY`);const assigned=requireCalendarDateString(row.assignedDate,`${prefix}.assignedDate`),due=hasValue(row.dueDate)?requireCalendarDateString(row.dueDate,`${prefix}.dueDate`):null;if(due&&due<assigned)throw new Error(`${prefix}.dueDate cannot be before assignedDate`);const status=requireString(row.status,`${prefix}.status`),priority=requireString(row.priority,`${prefix}.priority`);if(!["DRAFT","PUBLISHED","ARCHIVED","CANCELLED"].includes(status))throw new Error(`${prefix}.status is unsupported`);if(!["NORMAL","IMPORTANT"].includes(priority))throw new Error(`${prefix}.priority is unsupported`);if(status==="PUBLISHED"&&!hasValue(row.publishedAt))throw new Error(`${prefix}.publishedAt is required`);if(status==="ARCHIVED"&&!hasValue(row.archivedAt))throw new Error(`${prefix}.archivedAt is required`);if(status==="CANCELLED"&&(!hasValue(row.cancelledAt)||!hasValue(row.cancellationReason)))throw new Error(`${prefix} requires cancelledAt and cancellationReason`);if(hasValue(row.resourceLink)){let url:URL;try{url=new URL(String(row.resourceLink));}catch{throw new Error(`${prefix}.resourceLink is invalid`);}if(!["http:","https:"].includes(url.protocol)||url.username||url.password)throw new Error(`${prefix}.resourceLink is unsafe`);}if(hasValue(row.timetableSubjectId)&&!timetableSubjectIds.has(String(row.timetableSubjectId)))throw new Error(`${prefix}.timetableSubjectId does not match a backup timetable subject`);});
  const homeworkAssignmentEvents=validateOptionalRows(root.homeworkAssignmentEvents,"homeworkAssignmentEvents",HOMEWORK_EVENT_KEYS,["id","assignmentId","eventType","eventDate"]);const homeworkEventIds=new Set<string>();homeworkAssignmentEvents.forEach((row,index)=>{const prefix=`homeworkAssignmentEvents[${index}]`,id=requireString(row.id,`${prefix}.id`),assignmentId=requireString(row.assignmentId,`${prefix}.assignmentId`),eventType=requireString(row.eventType,`${prefix}.eventType`);if(homeworkEventIds.has(id))throw new Error(`${prefix}.id is duplicated`);homeworkEventIds.add(id);if(!homeworkAssignmentIds.has(assignmentId))throw new Error(`${prefix}.assignmentId does not match a backup homework assignment`);if(!["CREATED","UPDATED_DRAFT","PUBLISHED","CORRECTED","ARCHIVED","CANCELLED","RESTORED_TO_DRAFT"].includes(eventType))throw new Error(`${prefix}.eventType is unsupported`);requireDateString(row.eventDate,`${prefix}.eventDate`);if(eventType==="CORRECTED"&&(!hasValue(row.titleSnapshot)||!hasValue(row.instructionsSnapshot)||!hasValue(row.reason)))throw new Error(`${prefix} correction must preserve the previous public snapshot and reason`);if(eventType==="CANCELLED"&&!hasValue(row.reason))throw new Error(`${prefix}.reason is required for cancellation`);});
  const examCycles=validateOptionalRows(root.examCycles,"examCycles",EXAM_CYCLE_KEYS,["id","examCode","academicYear","name","examType","startDate","endDate","status"]);const examIds=new Set<string>(),examCodes=new Set<string>();
  examCycles.forEach((row,index)=>{const prefix=`examCycles[${index}]`,id=requireString(row.id,`${prefix}.id`),code=requireString(row.examCode,`${prefix}.examCode`).trim().toUpperCase(),type=requireString(row.examType,`${prefix}.examType`),status=requireString(row.status,`${prefix}.status`),start=requireCalendarDateString(row.startDate,`${prefix}.startDate`),end=requireCalendarDateString(row.endDate,`${prefix}.endDate`);if(!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(code)||examIds.has(id)||examCodes.has(code))throw new Error(`${prefix} has an invalid or duplicate exam identity`);examIds.add(id);examCodes.add(code);if(!/^\d{4}-\d{2}$/.test(requireString(row.academicYear,`${prefix}.academicYear`)))throw new Error(`${prefix}.academicYear must use YYYY-YY`);if(!["UNIT_TEST","FORMATIVE","SUMMATIVE","TERM","PRACTICAL","OTHER"].includes(type))throw new Error(`${prefix}.examType is unsupported`);if(!["DRAFT","OPEN_FOR_ENTRY","ENTRY_CLOSED","APPROVED","LOCKED","CANCELLED"].includes(status))throw new Error(`${prefix}.status is unsupported`);if(end<start)throw new Error(`${prefix}.endDate cannot precede startDate`);if(status==="CANCELLED"&&(!hasValue(row.cancellationReason)||!hasValue(row.cancelledAt)))throw new Error(`${prefix} cancelled exam requires reason and date`);if(status==="LOCKED"&&!hasValue(row.lockedAt))throw new Error(`${prefix}.lockedAt is required`);});
  const decimal=(value:unknown,field:string,positive=false)=>{const text=String(value??"").trim();if(!/^\d{1,6}(\.\d{1,4})?$/.test(text)||positive&&Number(text)<=0)throw new Error(`${field} must be ${positive?"positive":"non-negative"} with at most four decimals`);return Number(text);};
  const examAssessments=validateOptionalRows(root.examAssessments,"examAssessments",EXAM_ASSESSMENT_KEYS,["id","examCycleId","academicYear","className","subjectName","assessmentType","maxMarks","entryStatus"]);const assessmentIds=new Set<string>(),assessmentKeys=new Set<string>();
  examAssessments.forEach((row,index)=>{const prefix=`examAssessments[${index}]`,id=requireString(row.id,`${prefix}.id`),examCycleId=requireString(row.examCycleId,`${prefix}.examCycleId`),academicYear=requireString(row.academicYear,`${prefix}.academicYear`),section=String(row.section??""),component=String(row.componentName??""),key=`${examCycleId}|${requireString(row.className,`${prefix}.className`)}|${section}|${requireString(row.subjectName,`${prefix}.subjectName`)}|${component}`,max=decimal(row.maxMarks,`${prefix}.maxMarks`,true),status=requireString(row.entryStatus,`${prefix}.entryStatus`);if(assessmentIds.has(id)||assessmentKeys.has(key)||!examIds.has(examCycleId))throw new Error(`${prefix} has a duplicate identity, combination, or invalid exam link`);assessmentIds.add(id);assessmentKeys.add(key);const exam=examCycles.find((item)=>item.id===examCycleId);if(exam?.academicYear!==academicYear)throw new Error(`${prefix}.academicYear does not match exam`);if(hasValue(row.passMarks)&&decimal(row.passMarks,`${prefix}.passMarks`)>max)throw new Error(`${prefix}.passMarks exceeds maximum`);if(hasValue(row.weightagePercent)&&decimal(row.weightagePercent,`${prefix}.weightagePercent`)>100)throw new Error(`${prefix}.weightagePercent exceeds 100`);if(!["THEORY","PRACTICAL","ORAL","PROJECT","INTERNAL","OTHER"].includes(requireString(row.assessmentType,`${prefix}.assessmentType`)))throw new Error(`${prefix}.assessmentType is unsupported`);if(!["DRAFT","OPEN","SUBMITTED","APPROVED","LOCKED","CANCELLED"].includes(status))throw new Error(`${prefix}.entryStatus is unsupported`);if(hasValue(row.timetableSubjectId)&&!timetableSubjectIds.has(String(row.timetableSubjectId)))throw new Error(`${prefix}.timetableSubjectId does not match a backup subject`);});
  const studentIds=new Set(students.map((row)=>String(row.id??"")).filter(Boolean));const activeEnrollments=academicYearEnrollments.filter((row)=>row.status==="ACTIVE");
  const authSecurity = validateAuthSecurityBackup(root.authSecurity, {
    userIds: new Set(users.map((row) => String(row.id ?? "")).filter(Boolean)),
    studentIds
  });
  const iamAccess = validateIamAccessBackup(
    root.iamAccess,
    new Set(users.map((row) => String(row.id ?? "")).filter(Boolean))
  );
  const studentMarks=validateOptionalRows(root.studentMarks,"studentMarks",STUDENT_MARK_KEYS,["id","assessmentId","studentId","academicYear","entryStatus"]);const markIds=new Set<string>(),markKeys=new Set<string>();
  studentMarks.forEach((row,index)=>{const prefix=`studentMarks[${index}]`,id=requireString(row.id,`${prefix}.id`),assessmentId=requireString(row.assessmentId,`${prefix}.assessmentId`),studentId=requireString(row.studentId,`${prefix}.studentId`),status=requireString(row.entryStatus,`${prefix}.entryStatus`),key=`${assessmentId}|${studentId}`,assessment=examAssessments.find((item)=>item.id===assessmentId);if(markIds.has(id)||markKeys.has(key)||!assessment||!studentIds.has(studentId))throw new Error(`${prefix} has a duplicate identity or invalid assessment/Student link`);markIds.add(id);markKeys.add(key);const matchingEnrollment=activeEnrollments.some((enrollment)=>String(enrollment.studentId)===studentId&&String(enrollment.academicYear)===String(assessment.academicYear)&&String(enrollment.className)===String(assessment.className)&&(!String(assessment.section??"")||String(enrollment.section??"")===String(assessment.section??"")));if(String(row.academicYear)!==String(assessment.academicYear)||!matchingEnrollment)throw new Error(`${prefix} is incompatible with active academic-year enrollment`);if(!["PRESENT","ABSENT","EXEMPT","NOT_APPLICABLE"].includes(status))throw new Error(`${prefix}.entryStatus is unsupported`);if(status==="PRESENT"){if(!hasValue(row.marksObtained)||decimal(row.marksObtained,`${prefix}.marksObtained`)>decimal(assessment.maxMarks,`${prefix}.assessment.maxMarks`))throw new Error(`${prefix} present mark is missing or above maximum`);}else if(hasValue(row.marksObtained))throw new Error(`${prefix} non-present status must not carry marks`);});
  const studentMarkEvents=validateOptionalRows(root.studentMarkEvents,"studentMarkEvents",STUDENT_MARK_EVENT_KEYS,["id","assessmentId","eventType","eventDate"]);const markEventIds=new Set<string>();studentMarkEvents.forEach((row,index)=>{const prefix=`studentMarkEvents[${index}]`,id=requireString(row.id,`${prefix}.id`),assessmentId=requireString(row.assessmentId,`${prefix}.assessmentId`),eventType=requireString(row.eventType,`${prefix}.eventType`);if(markEventIds.has(id)||!assessmentIds.has(assessmentId))throw new Error(`${prefix} has duplicate identity or invalid assessment link`);markEventIds.add(id);if(hasValue(row.studentMarkId)&&!markIds.has(String(row.studentMarkId)))throw new Error(`${prefix}.studentMarkId does not match a backup mark`);if(!["MARK_CREATED","MARK_UPDATED","MARK_STATUS_CHANGED","MARKS_SUBMITTED","MARKS_APPROVED","MARKS_LOCKED","CORRECTION_REQUESTED","CORRECTION_APPLIED","ASSESSMENT_CANCELLED"].includes(eventType))throw new Error(`${prefix}.eventType is unsupported`);requireDateString(row.eventDate,`${prefix}.eventDate`);if(["CORRECTION_REQUESTED","CORRECTION_APPLIED"].includes(eventType)&&!hasValue(row.reason))throw new Error(`${prefix}.reason is required for correction`);});
  const examGovernance = validateExamGovernanceBackup(root.examGovernance);
  const reportCardData = validateReportCardBackupRows(root, { studentIds, examIds, progressionIds: new Set(studentProgressionDecisions.map((row) => String(row.id ?? "")).filter(Boolean)) });
  const academicCalendarData = validateAcademicCalendarBackupRows(root);
  const classworkData = validateClassworkBackupRows(root);
  const academicReportingData = validateAcademicReportingBackupRows(root, {
    resultSnapshotIds: new Set(examGovernance.studentResultSnapshots.map((row) => String(row.id ?? "")).filter(Boolean)),
    reportCardVersionIds: new Set(reportCardData.studentReportCardVersions.map((row) => String(row.id ?? "")).filter(Boolean))
  });
  const admissionsData = validateAdmissionsBackupRows(root);
  const payrollData = validatePayrollBackupRows(root);
  const payslipRequestData = validatePayslipRequestBackupRows(root);
  const supportData = validateSupportBackupRows(root);
  const safeExitData = validateSafeExitBackupRows(root, {
    studentIds,
    guardianIds: new Set(guardians.map((row) => String(row.id ?? "")).filter(Boolean))
  });
  const teacherAnalyticsData = validateTeacherAnalyticsBackupRows(root, { staffMemberIds: new Set(staffMembers.map((row) => String(row.id ?? "")).filter(Boolean)) });
  const certificateData = validateCertificateBackupRows(root, { studentIds, guardianIds: new Set(guardians.map((row) => String(row.id ?? "")).filter(Boolean)) });
  const classXPackageData = validateClassXPackageBackupRows(root, {
    studentIds,
    guardianIds: new Set(guardians.map((row) => String(row.id ?? "")).filter(Boolean)),
    certificateIds: new Set(certificateData.studentCertificates.map((row) => String(row.id ?? "")).filter(Boolean)),
    certificateVersionIds: new Set(certificateData.studentCertificateVersions.map((row) => String(row.id ?? "")).filter(Boolean)),
    miscReceiptIds: new Set(miscIncomeReceipts.map((row) => String(row.id ?? "")).filter(Boolean))
  });
  const identityCardData = validateIdentityCardBackupRows(root, {
    studentIds,
    staffMemberIds: new Set(staffMembers.map((row) => String(row.id ?? "")).filter(Boolean))
  });
  const notificationData = validateNotificationBackupRows(root, {
    userIds: new Set(users.map((row) => String(row.id ?? "")).filter(Boolean))
  });
  const whatsappData = validateWhatsAppBackupRows(root, {
    guardianIds: new Set(guardians.map((row) => String(row.id ?? "")).filter(Boolean)),
    staffMemberIds: new Set(staffMembers.map((row) => String(row.id ?? "")).filter(Boolean)),
    campaignIds: new Set(notificationData.notificationCampaigns.map((row) => String(row.id ?? "")).filter(Boolean)),
    notificationRecipientIds: new Set(notificationData.notificationRecipients.map((row) => String(row.id ?? "")).filter(Boolean))
  });
  const smsEmailData = validateSmsEmailBackupRows(root, {
    guardianIds: new Set(guardians.map((row) => String(row.id ?? "")).filter(Boolean)),
    staffMemberIds: new Set(staffMembers.map((row) => String(row.id ?? "")).filter(Boolean)),
    campaignIds: new Set(notificationData.notificationCampaigns.map((row) => String(row.id ?? "")).filter(Boolean)),
    notificationRecipientIds: new Set(notificationData.notificationRecipients.map((row) => String(row.id ?? "")).filter(Boolean))
  });
  const aiAssistantData = validateAiAssistantBackupRows(root, {
    userIds: new Set(users.map((row) => String(row.id ?? "")).filter(Boolean))
  }.userIds);
  const feeRegisterOcrData = validateFeeRegisterOcrBackupRows(root, {
    studentIds,
    paymentIds: new Set(payments.map((row) => String(row.id ?? "")).filter(Boolean))
  });
  const cloudBackupData = validateCloudBackupBackupRows(root);
  const publicWebsiteData = validatePublicWebsiteBackupRows(root);
  const technicalOperations = validateTechnicalOperationsBackup(root.technicalOperations);
  const counts = validateOptionalBackupCounts(metadata.counts);

  return {
    metadata: {
      appName,
      academicYear: requireString(metadata.academicYear, "metadata.academicYear"),
      generatedAt,
      generatedBy: requireString(metadata.generatedBy, "metadata.generatedBy"),
      ...(typeof metadata.appVersion === "string" ? { appVersion: metadata.appVersion } : {}),
      ...(typeof metadata.backupVersion === "number"
        ? { backupVersion: metadata.backupVersion }
        : {}),
      ...(counts ? { counts } : {})
    },
    schoolSettings,
    students,
    feeStructures,
    payments,
    paymentAudits,
    ...familyCollectionBackup,
    technicalOperations,
    users,
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
    examCycles,
    examAssessments,
    studentMarks,
    studentMarkEvents,
    examGovernance,
    ...reportCardData,
    ...academicCalendarData,
    ...classworkData,
    ...academicReportingData,
    ...admissionsData,
    ...payrollData,
    ...payslipRequestData,
    ...supportData,
    ...safeExitData,
    ...teacherAnalyticsData,
    ...certificateData,
    ...classXPackageData,
    ...identityCardData,
    ...notificationData,
    ...whatsappData,
    ...smsEmailData,
    ...aiAssistantData,
    ...feeRegisterOcrData,
    ...cloudBackupData,
    ...publicWebsiteData,
    receiptNotes,
    importBatches,
    onboardingBatches,
    onboardingRowOutcomes,
    onboardingAuditEvents,
    goLiveChecklist,
    timetableTeachers,
    timetableSubjects,
    timetableClassSections,
    timetablePeriodTemplates,
    timetableAssignments,
    timetableTeacherUnavailability,
    timetableFixedPeriods,
    timetableDrafts,
    timetableEntries
  };
}

export function sanitizeRestoreUser(user: RestoreRecord) {
  return pickRecord(user, [
    "id", "name", "username", "email", "role", "isActive", "lastLoginAt", "guardianId", "createdAt", "updatedAt"
  ]);
}

export function validateRolePermissionRow(row: RestoreRecord) {
  const role = requireString(row.role, "rolePermissions.role");
  if (!isRole(role)) throw new Error(`rolePermissions.role is not supported: ${role}`);
  const permission = normalizePermission(requireString(row.permission, "rolePermissions.permission"));
  if (!permission) throw new Error(`rolePermissions.permission is not supported: ${row.permission}`);
  if (typeof row.enabled !== "boolean") throw new Error("rolePermissions.enabled must be a boolean");
  return {
    ...pickRecord(row, ["id", "createdAt", "updatedAt"]),
    role,
    permission,
    enabled: role === "SUPER_ADMIN" ? true : row.enabled
  };
}

export function paymentFingerprint(payment: {
  receiptNo: unknown;
  admissionNo?: unknown;
  studentId?: unknown;
  date: unknown;
  amountPaid: unknown;
  paymentMode: unknown;
  receivedAccount: unknown;
}) {
  const date = new Date(String(payment.date));
  const datePart = Number.isNaN(date.getTime()) ? String(payment.date) : date.toISOString().slice(0, 10);
  const studentKey = cleanString(payment.admissionNo) || cleanString(payment.studentId);
  return [
    cleanString(payment.receiptNo),
    studentKey,
    datePart,
    Number(payment.amountPaid),
    cleanString(payment.paymentMode),
    cleanString(payment.receivedAccount)
  ].join("|");
}

export function emptyEntityResult(): EntityRestoreResult {
  return { created: 0, updated: 0, skipped: 0, errors: [], warnings: [] };
}

function validateImportBatch(batch: RestoreRecord, index: number) {
  if (!IMPORT_BATCH_TYPES.has(requireString(batch.type, `importBatches[${index}].type`))) {
    throw new Error(`importBatches[${index}].type is not supported`);
  }
  if (!IMPORT_BATCH_STATUSES.has(requireString(batch.status, `importBatches[${index}].status`))) {
    throw new Error(`importBatches[${index}].status is not supported`);
  }
  requireDateString(batch.importedAt, `importBatches[${index}].importedAt`);
  for (const key of [
    "totalRows", "createdCount", "updatedCount", "skippedCount", "errorCount", "warningCount"
  ]) {
    if (batch[key] !== undefined && (!Number.isInteger(batch[key]) || Number(batch[key]) < 0)) {
      throw new Error(`importBatches[${index}].${key} must be a non-negative integer`);
    }
  }
}

function validateOptionalChecklist(value: unknown) {
  if (value === undefined) return [];
  const rows = Array.isArray(value) ? value : [value];
  if (rows.length > 1) throw new Error("goLiveChecklist must contain at most one checklist state");
  return rows.map((row, index) => {
    const record = requireRecord(row, `goLiveChecklist[${index}]`);
    rejectUnknownKeys(record, GO_LIVE_CHECKLIST_KEYS, `goLiveChecklist[${index}]`);
    for (const key of CHECKLIST_BOOLEAN_KEYS) {
      if (record[key] !== undefined && typeof record[key] !== "boolean") {
        throw new Error(`goLiveChecklist[${index}].${key} must be a boolean`);
      }
    }
    if (record.createdAt !== undefined) {
      requireDateString(record.createdAt, `goLiveChecklist[${index}].createdAt`);
    }
    if (record.updatedAt !== undefined) {
      requireDateString(record.updatedAt, `goLiveChecklist[${index}].updatedAt`);
    }
    return record;
  });
}

function validateOptionalBackupCounts(value: unknown) {
  if (value === undefined) return undefined;
  const counts = requireRecord(value, "metadata.counts");
  rejectUnknownKeys(counts, BACKUP_COUNT_KEYS, "metadata.counts");
  const validated: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    requireNonNegativeInteger(count, `metadata.counts.${key}`);
    validated[key] = Number(count);
  }
  return validated;
}

function validateOptionalSchoolSettings(value: unknown): RestoreRecord | null {
  if (value === undefined || value === null) return null;
  const settings = requireRecord(value, "schoolSettings");
  rejectUnknownKeys(settings, SCHOOL_SETTINGS_KEYS, "schoolSettings");
  if (requireString(settings.id, "schoolSettings.id") !== "school") {
    throw new Error("schoolSettings.id must be school");
  }
  for (const key of [
    "schoolName", "addressLine1", "city", "phone", "academicYear",
    "defaultCurrency", "whatsappReminderFooter", "logoPath", "receiptTitle",
    "defaultPrintSize", "signatureLabel"
  ]) {
    requireString(settings[key], `schoolSettings.${key}`);
  }
  if (!/^\d{4}-\d{2}$/.test(String(settings.academicYear))) {
    throw new Error("schoolSettings.academicYear must use YYYY-YY");
  }
  if (settings.defaultCurrency !== "INR") {
    throw new Error("schoolSettings.defaultCurrency must be INR");
  }
  if (!["A4", "A5"].includes(String(settings.defaultPrintSize))) {
    throw new Error("schoolSettings.defaultPrintSize must be A4 or A5");
  }
  if (!String(settings.logoPath).startsWith("/") || String(settings.logoPath).startsWith("//")) {
    throw new Error("schoolSettings.logoPath must be a local path");
  }
  if (settings.receiptPrefix !== null && settings.receiptPrefix !== undefined && typeof settings.receiptPrefix !== "string") {
    throw new Error("schoolSettings.receiptPrefix must be a string or null");
  }
  if (typeof settings.showSchoolPhone !== "boolean" || typeof settings.showSchoolAddress !== "boolean") {
    throw new Error("schoolSettings visibility fields must be booleans");
  }
  return pickRecord(settings, [...SCHOOL_SETTINGS_KEYS]);
}

function validateRows(
  value: unknown,
  label: string,
  allowedKeys: ReadonlySet<string>,
  requiredKeys: string[]
) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return validateRowArray(value, label, allowedKeys, requiredKeys);
}

function validateOptionalRows(
  value: unknown,
  label: string,
  allowedKeys: ReadonlySet<string>,
  requiredKeys: string[]
) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return validateRowArray(value, label, allowedKeys, requiredKeys);
}

function validateRowArray(
  value: unknown[],
  label: string,
  allowedKeys: ReadonlySet<string>,
  requiredKeys: string[]
) {
  if (value.length > MAX_ENTITY_ROWS) throw new Error(`${label} exceeds the safe row limit`);
  return value.map((row, index) => {
    const record = requireRecord(row, `${label}[${index}]`);
    rejectUnknownKeys(record, allowedKeys, `${label}[${index}]`);
    for (const key of requiredKeys) {
      if (!hasValue(record[key])) throw new Error(`${label}[${index}].${key} is required`);
    }
    return record;
  });
}

function requireRecord(value: unknown, label: string): RestoreRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} has an unsafe structure`);
  }
  return value as RestoreRecord;
}

function rejectUnknownKeys(record: RestoreRecord, allowed: ReadonlySet<string>, label: string) {
  const unknown = Object.keys(record).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${label} contains unknown field: ${unknown[0]}`);
}

function requireString(value: unknown, field: string) {
  const text = cleanString(value);
  if (!text) throw new Error(`${field} is required`);
  return text;
}

function requireNormalizedLibraryTitleCode(value: unknown, field: string) {
  const raw = requireString(value, field);
  const normalized = raw.toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9_-]/g, "").replace(/[-_]+/g, "-").replace(/^-|-$/g, "");
  if (!normalized || raw !== normalized) throw new Error(`${field} must use its normalized library title-code form`);
  return normalized;
}

function requireNormalizedLibraryAccession(value: unknown, field: string) {
  const raw = requireString(value, field);
  const normalized = raw.toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9_/-]/g, "").replace(/-+/g, "-").replace(/-?\/-?/g, "/").replace(/^-|-$/g, "");
  if (!normalized || raw !== normalized) throw new Error(`${field} must use its normalized accession form`);
  return normalized;
}

function requireNormalizedLibraryBarcode(value: unknown, field: string) {
  const raw = requireString(value, field);
  const normalized = raw.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9_.:/-]/g, "");
  if (!normalized || raw !== normalized) throw new Error(`${field} must use its normalized barcode form`);
  return normalized;
}

function requireDateString(value: unknown, field: string) {
  const text = requireString(value, field);
  if (Number.isNaN(new Date(text).getTime())) throw new Error(`${field} must be a valid date`);
  return text;
}

function requireCalendarDateString(value: unknown, field: string) {
  const text = requireDateString(value, field);
  const calendarDate = text.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) throw new Error(`${field} must contain a valid calendar date`);
  const date = new Date(`${calendarDate}T00:00:00.000Z`);
  if (date.toISOString().slice(0, 10) !== calendarDate) throw new Error(`${field} must contain a valid calendar date`);
  return text;
}

function requirePositiveInteger(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}

function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return;
  requirePositiveInteger(value, field);
}

function requireNonNegativeInteger(value: unknown, field: string) {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
}

function optionalNonNegativeInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return;
  requireNonNegativeInteger(value, field);
}

function cleanString(value: unknown) {
  return String(value ?? "").trim();
}

function restoreMoneyCents(value: unknown, field: string, allowZero = true) {
  const text = cleanString(value);
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`${field} must be a non-negative amount with at most two decimals`);
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  if (!allowZero && cents === 0n) throw new Error(`${field} must be greater than zero`);
  return cents;
}

function restoreSignedMoneyCents(value: unknown, field: string) {
  const text = cleanString(value);
  if (!/^-?\d{1,10}(?:\.\d{1,2})?$/.test(text)) throw new Error(`${field} must be an amount with at most two decimals`);
  return BigInt(Math.round(Number(text) * 100));
}

function validateRestoredVendor(row: RestoreRecord, prefix: string) {
  const vendorCode = requireString(row.vendorCode, `${prefix}.vendorCode`).toUpperCase();
  const name = requireString(row.name, `${prefix}.name`);
  const optional = (field: string, max: number) => {
    const text = cleanString(row[field]);
    if (text.length > max) throw new Error(`${prefix}.${field} must be at most ${max} characters`);
    return text;
  };
  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(vendorCode)) throw new Error(`${prefix}.vendorCode has an invalid format`);
  if (name.length < 2 || name.length > 160) throw new Error(`${prefix}.name must be 2-160 characters`);
  const mobile = optional("mobile", 20); if (mobile && !/^\+?[0-9][0-9 -]{7,14}$/.test(mobile)) throw new Error(`${prefix}.mobile has an invalid format`);
  const alternateMobile = optional("alternateMobile", 20); if (alternateMobile && !/^\+?[0-9][0-9 -]{7,14}$/.test(alternateMobile)) throw new Error(`${prefix}.alternateMobile has an invalid format`);
  const email = optional("email", 160); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${prefix}.email has an invalid format`);
  const gstin = optional("gstin", 15).toUpperCase(); if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw new Error(`${prefix}.gstin has an invalid format`);
  const pan = optional("pan", 10).toUpperCase(); if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) throw new Error(`${prefix}.pan has an invalid format`);
  const ifsc = optional("ifsc", 11).toUpperCase(); if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) throw new Error(`${prefix}.ifsc has an invalid format`);
  const accountLastFour = optional("accountLastFour", 4); if (accountLastFour && !/^[0-9]{4}$/.test(accountLastFour)) throw new Error(`${prefix}.accountLastFour must contain exactly four digits`);
  for (const [field, max] of [["contactPerson", 120], ["address", 1000], ["bankName", 160], ["notes", 2000]] as const) optional(field, max);
  if (hasValue(row.paymentTermsDays) && (!Number.isInteger(row.paymentTermsDays) || Number(row.paymentTermsDays) < 0 || Number(row.paymentTermsDays) > 3650)) throw new Error(`${prefix}.paymentTermsDays must be 0-3650 days`);
  if (!["ACTIVE", "INACTIVE", "BLOCKED"].includes(requireString(row.status, `${prefix}.status`))) throw new Error(`${prefix}.status is not supported`);
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function pickRecord(record: RestoreRecord, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => key in record).map((key) => [key, record[key]]));
}
