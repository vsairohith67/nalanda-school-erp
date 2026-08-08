import { describe, expect, it } from "vitest";
import { createBackupDocument, formatBackupFilename, generateFullBackup } from "../lib/backup";
import { BROWSER_BACKUP_WARNING_MESSAGES } from "../lib/client-storage";

describe("full backup", () => {
  it("creates the expected backup structure", () => {
    const backup = createBackupDocument({
      generatedAt: new Date("2026-06-18T12:34:56.000Z"),
      generatedBy: "Director",
      students: [{ id: "student-1" }],
      feeStructures: [{ id: "fees-1" }],
      payments: [{ id: "payment-1", isCancelled: true }],
      paymentAudits: [{ id: "audit-1" }],
      users: [{ id: "user-1", username: "director" }],
      rolePermissions: [{ role: "ACCOUNTANT", permission: "RUN_BACKUP", enabled: true }],
      guardians: [{ id: "guardian-1", displayName: "Suresh Reddy", primaryMobile: "9000000001" }],
      studentGuardians: [{ id: "link-1", guardianId: "guardian-1", studentId: "student-1" }],
      notices: [{ id: "notice-1", title: "Holiday", status: "PUBLISHED" }],
      staffMembers: [{ id: "staff-1", fullName: "Asha Rao", userId: "user-1", timetableTeacherId: "teacher-1" }],
      studentAttendanceSessions: [{ id: "attendance-1", status: "SUBMITTED" }],
      studentAttendanceRecords: [{ id: "record-1", sessionId: "attendance-1", studentId: "student-1", status: "PRESENT" }],
      staffAttendanceSessions: [{ id: "staff-attendance-1", status: "SUBMITTED" }],
      staffAttendanceRecords: [{ id: "staff-record-1", sessionId: "staff-attendance-1", staffMemberId: "staff-1", status: "PRESENT" }],
      staffLeaveRequests: [{ id: "leave-1", staffMemberId: "staff-1", leaveType: "CASUAL", status: "APPROVED" }],
      academicYearEnrollments: [{ id: "enrollment-1", studentId: "student-1", academicYear: "2026-27", className: "VI", status: "ACTIVE" }],
      studentLifecycleEvents: [{ id: "event-1", studentId: "student-1", eventType: "ENROLLED", effectiveDate: "2026-07-01T00:00:00.000Z" }],
      studentProgressionDecisions: [{ id: "decision-1", studentId: "student-1", decisionType: "PROMOTE", status: "DRAFT" }],
      vendors: [{ id: "vendor-1", vendorCode: "V001" }], expenseCategories: [{ id: "category-1", name: "Electricity" }], expenseDepartments: [{ id: "department-1", name: "General" }], expenseRecords: [{ id: "expense-1", expenseNumber: "EXP-1" }], expensePayments: [{ id: "expense-payment-1" }], expenseAudits: [{ id: "expense-audit-1" }],
      receiptNotes: [{ receiptNo: "1001", status: "Cancelled" }],
      importBatches: [{ id: "batch-1", type: "STUDENTS" }],
      goLiveChecklist: [{ id: "go-live", backupTaken: true }],
      timetableTeachers: [{ id: "teacher-1", shortName: "RS" }],
      timetableSubjects: [{ id: "subject-1", shortName: "MATH" }],
      timetableClassSections: [{ id: "class-1", className: "VI", section: "A" }],
      timetablePeriodTemplates: [{ id: "period-1", label: "Period I" }],
      timetableAssignments: [{ id: "assignment-1", teacherId: "teacher-1" }],
      timetableTeacherUnavailability: [{ id: "unavailable-1", teacherId: "teacher-1" }],
      timetableFixedPeriods: [{ id: "fixed-1", label: "Assembly" }],
      timetableDrafts: [{ id: "draft-1", name: "Generated Timetable - 2026-06-19 10:30", status: "DRAFT" }],
      timetableEntries: [{ id: "entry-1", draftId: "draft-1", notes: "Automatically generated; manual review required." }]
    });

    expect(backup.metadata).toMatchObject({
      appName: "Nalanda Fee Control",
      academicYear: "2026-27",
      generatedAt: "2026-06-18T12:34:56.000Z",
      generatedBy: "Director"
    });
    expect(backup.metadata.appVersion).toBeTruthy();
    expect(backup.metadata.backupVersion).toBe(37);
    expect(backup.metadata.counts).toEqual({
      schoolSettings: 0,
      authSecurityRecords: 0,
      iamAccessRecords: 0,
      rolePermissions: 1,
      guardians: 1,
      studentGuardians: 1,
      notices: 1,
      staffMembers: 1,
      studentAttendanceSessions: 1,
      studentAttendanceRecords: 1,
      staffAttendanceSessions: 1,
      staffAttendanceRecords: 1,
      staffLeaveRequests: 1,
      substituteAssignments: 0,
      academicYearEnrollments: 1,
      studentLifecycleEvents: 1,
      studentProgressionDecisions: 1,
      vendors: 1, expenseCategories: 1, expenseDepartments: 1, expenseRecords: 1, expensePayments: 1, expenseAudits: 1,
      budgetPlans: 0, budgetAllocations: 0, budgetRevisions: 0,
      miscIncomeItems: 0, miscIncomeRates: 0, miscIncomeReceipts: 0, miscIncomeReceiptLines: 0, cashBookDays: 0, cashBookMovements: 0,
      familyCollections: 0, familyCollectionInstruments: 0, familyStudentAllocations: 0,
      allocationInstrumentShares: 0, familyReceiptVersions: 0, familyCollectionEvents: 0,
      familyProviderAllocationPlans: 0,
      bookCatalogItems: 0, bookCatalogRates: 0, bookSaleReceipts: 0, bookSaleReceiptLines: 0, bookCashSettlements: 0,
      libraryTitles: 0, libraryCopies: 0, libraryCopyEvents: 0, libraryMembers: 0, libraryPolicies: 0, libraryLoans: 0, libraryReservations: 0, libraryLoanEvents: 0,
      libraryIncidents: 0, libraryChargeRules: 0, libraryCharges: 0, libraryChargeEvents: 0,
      libraryStockVerificationSessions: 0, libraryStockVerificationRecords: 0, libraryStockVerificationScanEvents: 0, libraryStockVerificationEvents: 0,
      homeworkAssignments: 0, homeworkAssignmentEvents: 0,
      classworkItems: 0, classworkItemVersions: 0, classworkSubmissions: 0,
      classworkSubmissionVersions: 0, classworkAttachments: 0, classworkFeedback: 0, classworkAuditEvents: 0,
      examCycles: 0, examAssessments: 0, studentMarks: 0, studentMarkEvents: 0,
      examGovernanceRecords: 0,
      gradingSchemes: 0, gradeBands: 0, reportCardTemplates: 0, reportCardBatches: 0,
      reportCardBatchExamSources: 0, studentReportCards: 0, studentReportCardVersions: 0, studentReportCardEvents: 0,
      teacherAnalyticsReviewCycles: 0, teacherAnalyticsSnapshots: 0, teacherAnalyticsReviews: 0, teacherAnalyticsEvents: 0,
      certificateNumberSeries: 0, certificateTemplates: 0, studentCertificateRequests: 0,
      studentCertificates: 0, studentCertificateVersions: 0, studentCertificateEvents: 0,
      classXPackageTemplates: 0, classXDocumentPackages: 0, classXPackageDocumentItems: 0,
      classXPackageChargeRules: 0, classXPackageCharges: 0, classXPackageHandovers: 0, classXPackageEvents: 0,
      identityCardNumberSeries: 0, identityCardTemplates: 0, identityCardBatches: 0,
      identityCards: 0, identityCardVersions: 0, identityCardEvents: 0,
      notificationTemplates: 0, notificationCampaigns: 0, notificationRecipients: 0,
      notificationSkippedRecipients: 0, notificationEvents: 0,
      whatsAppIntegrationProfiles: 0, whatsAppConsents: 0, whatsAppConsentEvents: 0,
      whatsAppTemplateMappings: 0, whatsAppOutboundBatches: 0, whatsAppDeliveries: 0,
      whatsAppDeliveryAttempts: 0, whatsAppWebhookEvents: 0, whatsAppOperationalEvents: 0, whatsAppRateReferences: 0,
      smsEmailIntegrationProfiles: 0, smsEmailConsents: 0, smsEmailConsentEvents: 0,
      smsEmailTemplateMappings: 0, smsEmailOutboundBatches: 0, smsEmailDeliveries: 0,
      smsEmailDeliveryAttempts: 0, smsEmailWebhookEvents: 0, smsEmailOperationalEvents: 0,
      smsEmailSuppressions: 0, smsEmailCostRates: 0,
      timetableTeachers: 1,
      timetableSubjects: 1,
      timetableClassSections: 1,
      timetablePeriodTemplates: 1,
      timetableAssignments: 1,
      timetableDrafts: 1,
      timetableEntries: 1,
      aiAssistantProfiles: 0,
      aiAssistantSourcePolicies: 0,
      aiAssistantQueryAudits: 0,
      aiAssistantSafetyEvents: 0,
      aiAssistantEvaluationCases: 0,
      aiAssistantEvaluationRuns: 0,
      feeRegisterOcrProfiles: 0,
      feeRegisterOcrBatches: 0,
      feeRegisterOcrPages: 0,
      feeRegisterOcrRows: 0,
      feeRegisterOcrRowRevisions: 0,
      feeRegisterOcrPostingRuns: 0,
      feeRegisterOcrEvents: 0,
      cloudBackupProfiles: 0,
      cloudBackupSchedules: 0,
      cloudBackupRetentionPolicies: 0,
      cloudBackupRuns: 0,
      cloudBackupArtifacts: 0,
      cloudBackupVerifications: 0,
      cloudBackupRestoreRehearsals: 0,
      cloudBackupEvents: 0,
      publicWebsiteSettings: 0,
      publicWebsitePages: 0,
      publicWebsitePageVersions: 0,
      publicWebsitePosts: 0,
      publicWebsitePostVersions: 0,
      publicWebsiteNavigationItems: 0,
      publicWebsiteEvents: 0,
      academicCalendarVersions: 0,
      operationalCalendarDays: 0,
      schoolCalendarEvents: 0,
      schoolCalendarEventVersions: 0,
      academicCalendarAuditEvents: 0,
      academicReportDefinitions: 0,
      academicReportRuns: 0,
      academicReportSourceReferences: 0,
      academicReportAuditEvents: 0,
      admissionCycles: 0,
      admissionEnquiries: 0,
      enquiryFollowUps: 0,
      schoolVisits: 0,
      admissionApplications: 0,
      admissionApplicationVersions: 0,
      applicantChildren: 0,
      prospectiveGuardians: 0,
      applicationDocuments: 0,
      applicationReviews: 0,
      admissionDecisions: 0,
      admissionOffers: 0,
      admissionDuplicateResolutions: 0,
      admissionConversions: 0,
      admissionEvents: 0,
      payrollPolicyVersions: 0,
      salaryStructureVersions: 0,
      salaryComponentDefinitions: 0,
      staffCompensationAssignments: 0,
      salaryRevisions: 0,
      payrollPeriods: 0,
      payrollRuns: 0,
      employeePayrollResults: 0,
      payrollComponentResults: 0,
      salaryAdvances: 0,
      advanceRecoverySchedules: 0,
      payslipVersions: 0,
      payrollEvents: 0
    });
    expect(backup.students).toHaveLength(1);
    expect(backup.feeStructures).toHaveLength(1);
    expect(backup.payments[0]).toMatchObject({ isCancelled: true });
    expect(backup.paymentAudits).toHaveLength(1);
    expect(backup.rolePermissions).toEqual([{ role: "ACCOUNTANT", permission: "RUN_BACKUP", enabled: true }]);
    expect(backup.guardians).toHaveLength(1);
    expect(backup.studentGuardians).toHaveLength(1);
    expect(backup.notices).toEqual([{ id: "notice-1", title: "Holiday", status: "PUBLISHED" }]);
    expect(backup.staffMembers).toEqual([{ id: "staff-1", fullName: "Asha Rao", userId: "user-1", timetableTeacherId: "teacher-1" }]);
    expect(backup.studentAttendanceSessions).toHaveLength(1);
    expect(backup.studentAttendanceRecords).toHaveLength(1);
    expect(backup.staffAttendanceSessions).toHaveLength(1);
    expect(backup.staffAttendanceRecords).toHaveLength(1);
    expect(backup.staffLeaveRequests).toHaveLength(1);
    expect(backup.academicYearEnrollments).toHaveLength(1);
    expect(backup.studentLifecycleEvents).toHaveLength(1);
    expect(backup.studentProgressionDecisions).toHaveLength(1);
    expect(backup.vendors).toHaveLength(1); expect(backup.expenseRecords).toHaveLength(1); expect(backup.expensePayments).toHaveLength(1); expect(backup.expenseAudits).toHaveLength(1);
    expect(backup.receiptNotes).toHaveLength(1);
    expect(backup.importBatches).toEqual([{ id: "batch-1", type: "STUDENTS" }]);
    expect(backup.goLiveChecklist).toEqual([{ id: "go-live", backupTaken: true }]);
    expect(backup.timetableTeachers).toHaveLength(1);
    expect(backup.timetableSubjects).toHaveLength(1);
    expect(backup.timetableClassSections).toHaveLength(1);
    expect(backup.timetablePeriodTemplates).toHaveLength(1);
    expect(backup.timetableAssignments).toHaveLength(1);
    expect(backup.timetableTeacherUnavailability).toHaveLength(1);
    expect(backup.timetableFixedPeriods).toHaveLength(1);
    expect(backup.timetableDrafts).toHaveLength(1);
    expect(backup.timetableEntries).toHaveLength(1);
    expect(backup.timetableDrafts[0]).toMatchObject({ status: "DRAFT", name: expect.stringContaining("Generated Timetable") });
    expect(backup.timetableEntries[0]).toMatchObject({ draftId: "draft-1" });
  });

  it("uses the shared full-backup generator for timetable data", async () => {
    const findMany = (rows: unknown[]) => ({ findMany: async () => rows });
    const client = {
      student: findMany([]),
      feeStructure: findMany([]),
      payment: findMany([]),
      paymentAudit: findMany([]),
      user: findMany([{ id: "user-1", username: "director" }]),
      rolePermission: findMany([{ role: "DIRECTOR", permission: "VIEW_DASHBOARD", enabled: true }]),
      guardian: findMany([{ id: "guardian-1" }]),
      studentGuardian: findMany([{ id: "link-1" }]),
      notice: findMany([{ id: "notice-1" }]),
      staffMember: findMany([{ id: "staff-1" }]),
      studentAttendanceSession: findMany([{ id: "attendance-1" }]),
      studentAttendanceRecord: findMany([{ id: "attendance-record-1" }]),
      staffAttendanceSession: findMany([{ id: "staff-attendance-1" }]),
      staffAttendanceRecord: findMany([{ id: "staff-attendance-record-1" }]),
      staffLeaveRequest: findMany([{ id: "leave-1" }]),
      substituteAssignment: findMany([{ id: "substitute-1" }]),
      academicYearEnrollment: findMany([{ id: "enrollment-1" }]),
      studentLifecycleEvent: findMany([{ id: "event-1" }]),
      studentProgressionDecision: findMany([{ id: "decision-1" }]),
      vendor: findMany([{ id: "vendor-1" }]), expenseCategory: findMany([{ id: "category-1" }]), expenseDepartment: findMany([{ id: "department-1" }]), expenseRecord: findMany([{ id: "expense-1" }]), expensePayment: findMany([{ id: "expense-payment-1" }]), expenseAudit: findMany([{ id: "expense-audit-1" }]),
      budgetPlan: findMany([{ id: "budget-1" }]), budgetAllocation: findMany([{ id: "allocation-1" }]), budgetRevision: findMany([{ id: "revision-1" }]),
      miscIncomeItem: findMany([{ id: "misc-item-1" }]), miscIncomeRate: findMany([{ id: "misc-rate-1" }]), miscIncomeReceipt: findMany([{ id: "misc-receipt-1" }]), miscIncomeReceiptLine: findMany([{ id: "misc-line-1" }]), cashBookDay: findMany([{ id: "cash-day-1" }]), cashBookMovement: findMany([{ id: "cash-movement-1" }]),
      receiptNote: findMany([]),
      importBatch: findMany([]),
      goLiveChecklist: findMany([]),
      timetableTeacher: findMany([{ id: "teacher-1" }]),
      timetableSubject: findMany([{ id: "subject-1" }]),
      timetableClassSection: findMany([{ id: "class-1" }]),
      timetablePeriodTemplate: findMany([{ id: "period-1" }]),
      timetableAssignment: findMany([{ id: "assignment-1" }]),
      timetableTeacherUnavailability: findMany([{ id: "unavailable-1" }]),
      timetableFixedPeriod: findMany([{ id: "fixed-1" }]),
      timetableDraft: findMany([{ id: "draft-1" }]),
      timetableEntry: findMany([{ id: "entry-1" }]),
      academicCalendarVersion: findMany([]),
      operationalCalendarDay: findMany([]),
      schoolCalendarEvent: findMany([]),
      schoolCalendarEventVersion: findMany([]),
      academicCalendarAuditEvent: findMany([]),
      schoolSettings: {
        findUnique: async () => null
      }
    };

    const backup = await generateFullBackup(client as never, {
      generatedAt: new Date("2026-06-19T12:00:00.000Z"),
      generatedBy: "CLI"
    });

    expect(backup.rolePermissions).toEqual([{ role: "DIRECTOR", permission: "VIEW_DASHBOARD", enabled: true }]);
    expect(backup.guardians).toEqual([{ id: "guardian-1" }]);
    expect(backup.studentGuardians).toEqual([{ id: "link-1" }]);
    expect(backup.notices).toEqual([{ id: "notice-1" }]);
    expect(backup.staffMembers).toEqual([{ id: "staff-1" }]);
    expect(backup.studentAttendanceSessions).toEqual([{ id: "attendance-1" }]);
    expect(backup.studentAttendanceRecords).toEqual([{ id: "attendance-record-1" }]);
    expect(backup.staffAttendanceSessions).toEqual([{ id: "staff-attendance-1" }]);
    expect(backup.staffAttendanceRecords).toEqual([{ id: "staff-attendance-record-1" }]);
    expect(backup.staffLeaveRequests).toEqual([{ id: "leave-1" }]);
    expect(backup.substituteAssignments).toEqual([{ id: "substitute-1" }]);
    expect(backup.budgetPlans).toEqual([{ id: "budget-1" }]);
    expect(backup.budgetAllocations).toEqual([{ id: "allocation-1" }]);
    expect(backup.budgetRevisions).toEqual([{ id: "revision-1" }]);
    expect(backup.miscIncomeItems).toEqual([{ id: "misc-item-1" }]);
    expect(backup.cashBookMovements).toEqual([{ id: "cash-movement-1" }]);
    expect(backup.academicYearEnrollments).toEqual([{ id: "enrollment-1" }]);
    expect(backup.studentLifecycleEvents).toEqual([{ id: "event-1" }]);
    expect(backup.studentProgressionDecisions).toEqual([{ id: "decision-1" }]);
    expect(backup.vendors).toEqual([{ id: "vendor-1" }]); expect(backup.expenseRecords).toEqual([{ id: "expense-1" }]);
    expect(backup.timetableTeachers).toEqual([{ id: "teacher-1" }]);
    expect(backup.timetableSubjects).toEqual([{ id: "subject-1" }]);
    expect(backup.timetableClassSections).toEqual([{ id: "class-1" }]);
    expect(backup.timetablePeriodTemplates).toEqual([{ id: "period-1" }]);
    expect(backup.timetableAssignments).toEqual([{ id: "assignment-1" }]);
    expect(backup.timetableTeacherUnavailability).toEqual([{ id: "unavailable-1" }]);
    expect(backup.timetableFixedPeriods).toEqual([{ id: "fixed-1" }]);
    expect(backup.timetableDrafts).toEqual([{ id: "draft-1" }]);
    expect(backup.timetableEntries).toEqual([{ id: "entry-1" }]);
    expect(backup.schoolSettings).toMatchObject({
      id: "school",
      academicYear: "2026-27",
      defaultCurrency: "INR",
      defaultPrintSize: "A5"
    });
    expect(backup.metadata.counts.schoolSettings).toBe(1);
  });

  it("removes password hashes from exported users", () => {
    const backup = createBackupDocument({
      generatedAt: new Date(),
      generatedBy: "Admin",
      students: [],
      feeStructures: [],
      payments: [],
      paymentAudits: [],
      users: [{ id: "user-1", username: "admin", passwordHash: "secret-hash" }]
    });

    expect(backup.users[0]).toEqual({ id: "user-1", username: "admin" });
    expect(backup.users[0]).not.toHaveProperty("passwordHash");
  });

  it("formats timestamped backup filenames", () => {
    expect(formatBackupFilename(new Date(2026, 5, 18, 7, 5)))
      .toBe("nalanda-fee-control-backup-2026-06-18-07-05.json");
  });

  it("uses beginner-friendly browser backup warning wording", () => {
    expect(BROWSER_BACKUP_WARNING_MESSAGES).toEqual([
      "Browser-downloaded backup not recorded in this browser.",
      "PowerShell backups may still exist in the backups folder.",
      "Before real imports, take both a PowerShell backup and a browser Download Full Backup."
    ]);
  });
});
