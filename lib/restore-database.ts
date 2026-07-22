import type { Prisma, PrismaClient } from "@prisma/client";
import { dueMonthsForClass, normalizeClassName } from "@/lib/constants";
import { classDisplayName } from "@/lib/timetable";
import {
  emptyEntityResult,
  paymentFingerprint,
  type RestoreRecord,
  type RestoreResult,
  type ValidatedBackup
} from "@/lib/restore";
import { restoreFeeRegisterOcrData } from "@/lib/fee-register-ocr-restore";
import { validatePaymentPayload, validateStudentPayload } from "@/lib/validation";
import { restorePublicWebsiteData } from "@/lib/public-website-restore";
import { assertReceiptStudentMatchInDatabase } from "@/lib/payment-controls";

function hasValue(value: unknown) { return value !== null && value !== undefined && value !== ""; }

type RestoreDatabaseClient = Pick<
  Prisma.TransactionClient,
  "student" | "feeStructure" | "payment" | "paymentAudit" | "user" | "receiptNote"
  | "importBatch" | "goLiveChecklist" | "timetableTeacher" | "timetableSubject"
  | "timetableClassSection" | "timetablePeriodTemplate" | "timetableAssignment"
  | "timetableTeacherUnavailability" | "timetableFixedPeriod" | "timetableDraft"
  | "timetableEntry" | "rolePermission" | "guardian" | "studentGuardian"
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
  | "gradingScheme" | "gradeBand" | "reportCardTemplate" | "reportCardBatch" | "reportCardBatchExamSource"
  | "studentReportCard" | "studentReportCardVersion" | "studentReportCardEvent"
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
  | "whatsAppDeliveryAttempt" | "whatsAppWebhookEvent" | "whatsAppOperationalEvent" | "whatsAppRateReference"
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
>;

export async function restoreValidatedBackup(
  prisma: PrismaClient,
  backup: ValidatedBackup,
  restoredBy: { id: string; name: string }
) {
  return prisma.$transaction(
    (tx) => restoreIntoDatabase(tx, backup, restoredBy),
    { maxWait: 5_000, timeout: 60_000 }
  );
}

async function restoreIntoDatabase(
  client: RestoreDatabaseClient,
  backup: ValidatedBackup,
  restoredBy: { id: string; name: string }
): Promise<RestoreResult> {
  const result: RestoreResult = {
    students: emptyEntityResult(),
    feeStructures: emptyEntityResult(),
    payments: emptyEntityResult(),
    paymentAudits: emptyEntityResult(),
    users: emptyEntityResult(),
    rolePermissions: emptyEntityResult(),
    guardians: emptyEntityResult(),
    studentGuardians: emptyEntityResult(),
    notices: emptyEntityResult(),
    staffMembers: emptyEntityResult(),
    studentAttendanceSessions: emptyEntityResult(),
    studentAttendanceRecords: emptyEntityResult(),
    staffAttendanceSessions: emptyEntityResult(),
    staffAttendanceRecords: emptyEntityResult(),
    staffLeaveRequests: emptyEntityResult(),
    substituteAssignments: emptyEntityResult(),
    academicYearEnrollments: emptyEntityResult(),
    studentLifecycleEvents: emptyEntityResult(),
    studentProgressionDecisions: emptyEntityResult(),
    vendors: emptyEntityResult(),
    expenseCategories: emptyEntityResult(),
    expenseDepartments: emptyEntityResult(),
    expenseRecords: emptyEntityResult(),
    expensePayments: emptyEntityResult(),
    expenseAudits: emptyEntityResult(),
    budgetPlans: emptyEntityResult(),
    budgetAllocations: emptyEntityResult(),
    budgetRevisions: emptyEntityResult(),
    miscIncomeItems: emptyEntityResult(),
    miscIncomeRates: emptyEntityResult(),
    miscIncomeReceipts: emptyEntityResult(),
    miscIncomeReceiptLines: emptyEntityResult(),
    cashBookDays: emptyEntityResult(),
    cashBookMovements: emptyEntityResult(),
    bookCatalogItems: emptyEntityResult(),
    bookCatalogRates: emptyEntityResult(),
    bookSaleReceipts: emptyEntityResult(),
    bookSaleReceiptLines: emptyEntityResult(),
    bookCashSettlements: emptyEntityResult(),
    libraryTitles: emptyEntityResult(),
    libraryCopies: emptyEntityResult(),
    libraryCopyEvents: emptyEntityResult(),
    libraryMembers: emptyEntityResult(),
    libraryPolicies: emptyEntityResult(),
    libraryLoans: emptyEntityResult(),
    libraryReservations: emptyEntityResult(),
    libraryLoanEvents: emptyEntityResult(),
    libraryIncidents: emptyEntityResult(),
    libraryChargeRules: emptyEntityResult(),
    libraryCharges: emptyEntityResult(),
    libraryChargeEvents: emptyEntityResult(),
    libraryStockVerificationSessions: emptyEntityResult(),
    libraryStockVerificationRecords: emptyEntityResult(),
    libraryStockVerificationScanEvents: emptyEntityResult(),
    libraryStockVerificationEvents: emptyEntityResult(),
    homeworkAssignments: emptyEntityResult(),
    homeworkAssignmentEvents: emptyEntityResult(),
    examCycles: emptyEntityResult(),
    examAssessments: emptyEntityResult(),
    studentMarks: emptyEntityResult(),
    studentMarkEvents: emptyEntityResult(),
    gradingSchemes: emptyEntityResult(),
    gradeBands: emptyEntityResult(),
    reportCardTemplates: emptyEntityResult(),
    reportCardBatches: emptyEntityResult(),
    reportCardBatchExamSources: emptyEntityResult(),
    studentReportCards: emptyEntityResult(),
    studentReportCardVersions: emptyEntityResult(),
    studentReportCardEvents: emptyEntityResult(),
    teacherAnalyticsReviewCycles: emptyEntityResult(),
    teacherAnalyticsSnapshots: emptyEntityResult(),
    teacherAnalyticsReviews: emptyEntityResult(),
    teacherAnalyticsEvents: emptyEntityResult(),
    certificateNumberSeries: emptyEntityResult(),
    certificateTemplates: emptyEntityResult(),
    studentCertificateRequests: emptyEntityResult(),
    studentCertificates: emptyEntityResult(),
    studentCertificateVersions: emptyEntityResult(),
    studentCertificateEvents: emptyEntityResult(),
    classXPackageTemplates: emptyEntityResult(),
    classXDocumentPackages: emptyEntityResult(),
    classXPackageDocumentItems: emptyEntityResult(),
    classXPackageChargeRules: emptyEntityResult(),
    classXPackageCharges: emptyEntityResult(),
    classXPackageHandovers: emptyEntityResult(),
    classXPackageEvents: emptyEntityResult(),
    identityCardNumberSeries: emptyEntityResult(),
    identityCardTemplates: emptyEntityResult(),
    identityCardBatches: emptyEntityResult(),
    identityCards: emptyEntityResult(),
    identityCardVersions: emptyEntityResult(),
    identityCardEvents: emptyEntityResult(),
    notificationTemplates: emptyEntityResult(),
    notificationCampaigns: emptyEntityResult(),
    notificationRecipients: emptyEntityResult(),
    notificationSkippedRecipients: emptyEntityResult(),
    notificationEvents: emptyEntityResult(),
    whatsAppIntegrationProfiles: emptyEntityResult(),
    whatsAppConsents: emptyEntityResult(),
    whatsAppConsentEvents: emptyEntityResult(),
    whatsAppTemplateMappings: emptyEntityResult(),
    whatsAppOutboundBatches: emptyEntityResult(),
    whatsAppDeliveries: emptyEntityResult(),
    whatsAppDeliveryAttempts: emptyEntityResult(),
    whatsAppWebhookEvents: emptyEntityResult(),
    whatsAppOperationalEvents: emptyEntityResult(),
    whatsAppRateReferences: emptyEntityResult(),
    smsEmailIntegrationProfiles: emptyEntityResult(),
    smsEmailConsents: emptyEntityResult(),
    smsEmailConsentEvents: emptyEntityResult(),
    smsEmailTemplateMappings: emptyEntityResult(),
    smsEmailOutboundBatches: emptyEntityResult(),
    smsEmailDeliveries: emptyEntityResult(),
    smsEmailDeliveryAttempts: emptyEntityResult(),
    smsEmailWebhookEvents: emptyEntityResult(),
    smsEmailOperationalEvents: emptyEntityResult(),
    smsEmailSuppressions: emptyEntityResult(),
    smsEmailCostRates: emptyEntityResult(),
    aiAssistantProfiles: emptyEntityResult(),
    aiAssistantSourcePolicies: emptyEntityResult(),
    aiAssistantQueryAudits: emptyEntityResult(),
    aiAssistantSafetyEvents: emptyEntityResult(),
    aiAssistantEvaluationCases: emptyEntityResult(),
    aiAssistantEvaluationRuns: emptyEntityResult(),
    feeRegisterOcrProfiles: emptyEntityResult(),
    feeRegisterOcrBatches: emptyEntityResult(),
    feeRegisterOcrPages: emptyEntityResult(),
    feeRegisterOcrRows: emptyEntityResult(),
    feeRegisterOcrRowRevisions: emptyEntityResult(),
    feeRegisterOcrPostingRuns: emptyEntityResult(),
    feeRegisterOcrEvents: emptyEntityResult(),
    cloudBackupProfiles: emptyEntityResult(),
    cloudBackupSchedules: emptyEntityResult(),
    cloudBackupRetentionPolicies: emptyEntityResult(),
    cloudBackupRuns: emptyEntityResult(),
    cloudBackupArtifacts: emptyEntityResult(),
    cloudBackupVerifications: emptyEntityResult(),
    cloudBackupRestoreRehearsals: emptyEntityResult(),
    cloudBackupEvents: emptyEntityResult(),
    publicWebsiteSettings: emptyEntityResult(),
    publicWebsitePages: emptyEntityResult(),
    publicWebsitePageVersions: emptyEntityResult(),
    publicWebsitePosts: emptyEntityResult(),
    publicWebsitePostVersions: emptyEntityResult(),
    publicWebsiteNavigationItems: emptyEntityResult(),
    publicWebsiteEvents: emptyEntityResult(),
    receiptNotes: emptyEntityResult(),
    importBatches: emptyEntityResult(),
    goLiveChecklist: emptyEntityResult(),
    timetableTeachers: emptyEntityResult(),
    timetableSubjects: emptyEntityResult(),
    timetableClassSections: emptyEntityResult(),
    timetablePeriodTemplates: emptyEntityResult(),
    timetableAssignments: emptyEntityResult(),
    timetableTeacherUnavailability: emptyEntityResult(),
    timetableFixedPeriods: emptyEntityResult(),
    timetableDrafts: emptyEntityResult(),
    timetableEntries: emptyEntityResult(),
    warnings: []
  };

  const backupStudentIds = new Map<string, string>();
  const backupStudentLocalIds = new Map<string, string>();
  for (const [index, row] of backup.students.entries()) {
    try {
      const payload = {
        ...validateStudentPayload(row),
        deletedAt: optionalDate(row.deletedAt, `students[${index}].deletedAt`)
      };
      const existing = await client.student.findUnique({ where: { admissionNo: payload.admissionNo } });
      const student = existing
        ? await client.student.update({ where: { admissionNo: payload.admissionNo }, data: payload })
        : await client.student.create({ data: payload });
      if (existing) result.students.updated += 1;
      else result.students.created += 1;
      if (typeof row.id === "string") backupStudentIds.set(row.id, student.admissionNo);
      if (typeof row.id === "string") backupStudentLocalIds.set(row.id, student.id);
    } catch (error) {
      result.students.errors.push(rowError("Student", index, error));
    }
  }

  for (const [index, row] of backup.feeStructures.entries()) {
    try {
      const academicYear = requiredText(row.academicYear, "Academic year");
      const className = normalizeClassName(requiredText(row.className, "Class"));
      const termAmount = positiveNumber(row.termAmount, "Term amount");
      const defaults = dueMonthsForClass(className);
      const data = {
        termAmount,
        term1Month: textOr(row.term1Month, defaults[0]),
        term2Month: textOr(row.term2Month, defaults[1]),
        term3Month: textOr(row.term3Month, defaults[2]),
        term4Month: textOr(row.term4Month, defaults[3]),
        active: row.active !== false
      };
      const where = { academicYear_className: { academicYear, className } };
      const existing = await client.feeStructure.findUnique({ where });
      if (existing) {
        await client.feeStructure.update({ where, data });
        result.feeStructures.updated += 1;
      } else {
        await client.feeStructure.create({ data: { academicYear, className, ...data } });
        result.feeStructures.created += 1;
      }
    } catch (error) {
      result.feeStructures.errors.push(rowError("Fee structure", index, error));
    }
  }

  const backupGuardianIds = await restoreGuardianData(client, backup, backupStudentLocalIds, result);
  const backupUserToLocalUser = await mapBackupUsersToLocalUsers(client, backup.users);
  await restoreStaffData(client, backup, backupUserToLocalUser, result);
  const expenseMasterMaps = await restoreExpenseData(client, backup, backupUserToLocalUser, result);
  await restoreBudgetData(client, backup, backupUserToLocalUser, expenseMasterMaps, result);
  await restoreMiscIncomeAndCashBookData(client, backup, backupStudentLocalIds, backupUserToLocalUser, result);
  await restoreBooksFinanceData(client, backup, backupStudentLocalIds, backupUserToLocalUser, expenseMasterMaps.vendorMap, result);
  await restoreLibraryData(client, backup, backupUserToLocalUser, expenseMasterMaps.vendorMap, expenseMasterMaps.expenseMap, result);
  await restoreLibraryCirculationData(client, backup, backupStudentLocalIds, backupUserToLocalUser, result);
  await restoreLibraryAccountabilityData(client, backup, backupUserToLocalUser, result);
  await restoreLibraryStockVerificationData(client, backup, backupUserToLocalUser, result);
  await restoreStudentLifecycleData(client, backup, backupStudentLocalIds, backupUserToLocalUser, result);
  await restoreStudentProgressionData(client, backup, backupStudentLocalIds, backupUserToLocalUser, result);
  await restoreStudentAttendanceData(client, backup, backupStudentLocalIds, backupUserToLocalUser, result);
  await restoreNoticesData(client, backup, backupUserToLocalUser, result);
  const linkedParentUsers = await restoreGuardianUserLinks(
    client,
    backup.users,
    backupGuardianIds,
    backupUserToLocalUser,
    result
  );
  const existingPayments = await client.payment.findMany();
  const paymentByFingerprint = new Map(existingPayments.map((payment) => [paymentFingerprint(payment), payment]));
  const backupPaymentToLocalId = new Map<string, string>();

  for (const [index, row] of backup.payments.entries()) {
    try {
      const admissionNo = resolveAdmissionNo(row, backupStudentIds);
      const payload = validatePaymentPayload({ ...row, admissionNo });
      const student = await client.student.findUnique({ where: { admissionNo } });
      if (!student) throw new Error(`Student ${admissionNo} does not exist`);
      await assertReceiptStudentMatchInDatabase(client, {
        receiptNo: payload.receiptNo,
        admissionNo
      });

      const fingerprint = paymentFingerprint({
        receiptNo: row.receiptNo,
        admissionNo,
        studentId: row.studentId,
        date: row.date,
        amountPaid: row.amountPaid,
        paymentMode: row.paymentMode,
        receivedAccount: row.receivedAccount
      });
      const duplicate = paymentByFingerprint.get(fingerprint);
      if (duplicate) {
        result.payments.skipped += 1;
        if (typeof row.id === "string") backupPaymentToLocalId.set(row.id, duplicate.id);
        continue;
      }

      const cancelledByUserId = mapOptionalUserId(row.cancelledByUserId, backupUserToLocalUser);
      const created = await client.payment.create({
        data: {
          ...payload,
          studentId: student.id,
          studentName: textOr(row.studentName, student.studentName),
          className: textOr(row.className, student.className),
          section: nullableText(row.section) ?? student.section,
          isCancelled: row.isCancelled === true,
          cancelledAt: optionalDate(row.cancelledAt, `payments[${index}].cancelledAt`),
          cancelledByUserId,
          cancellationReason: nullableText(row.cancellationReason),
          deletedAt: optionalDate(row.deletedAt, `payments[${index}].deletedAt`)
        }
      });
      paymentByFingerprint.set(fingerprint, created);
      if (typeof row.id === "string") backupPaymentToLocalId.set(row.id, created.id);
      result.payments.created += 1;
    } catch (error) {
      result.payments.errors.push(rowError("Payment", index, error));
    }
  }

  const existingAudits = await client.paymentAudit.findMany();
  const auditKeys = new Set(existingAudits.map(auditFingerprint));
  for (const [index, row] of backup.paymentAudits.entries()) {
    try {
      const backupPaymentId = requiredText(row.paymentId, "Payment ID");
      const paymentId = backupPaymentToLocalId.get(backupPaymentId);
      if (!paymentId) {
        result.paymentAudits.skipped += 1;
        result.warnings.push(`Payment audit ${index + 1} skipped because its payment was not restored or matched.`);
        continue;
      }
      const changedByUserId = backupUserToLocalUser.get(requiredText(row.changedByUserId, "Changed-by user ID"));
      if (!changedByUserId) {
        result.paymentAudits.skipped += 1;
        result.warnings.push(`Payment audit ${index + 1} skipped because its user account could not be matched safely.`);
        continue;
      }
      const auditData = {
        paymentId,
        action: requiredText(row.action, "Audit action"),
        oldValueJson: nullableText(row.oldValueJson),
        newValueJson: nullableText(row.newValueJson),
        changedByUserId,
        changedByName: textOr(row.changedByName, restoredBy.name),
        reason: nullableText(row.reason),
        createdAt: requiredDate(row.createdAt, `paymentAudits[${index}].createdAt`)
      };
      const key = auditFingerprint(auditData);
      if (auditKeys.has(key)) {
        result.paymentAudits.skipped += 1;
        continue;
      }
      await client.paymentAudit.create({ data: auditData });
      auditKeys.add(key);
      result.paymentAudits.created += 1;
    } catch (error) {
      result.paymentAudits.errors.push(rowError("Payment audit", index, error));
    }
  }

  for (const [index, row] of backup.receiptNotes.entries()) {
    try {
      const receiptNo = requiredText(row.receiptNo, "Receipt number");
      const data = {
        status: textOr(row.status, "Cancelled"),
        remarks: nullableText(row.remarks)
      };
      const existing = await client.receiptNote.findUnique({ where: { receiptNo } });
      if (existing) {
        await client.receiptNote.update({ where: { receiptNo }, data });
        result.receiptNotes.updated += 1;
      } else {
        await client.receiptNote.create({ data: { receiptNo, ...data } });
        result.receiptNotes.created += 1;
      }
    } catch (error) {
      result.receiptNotes.errors.push(rowError("Receipt note", index, error));
    }
  }

  await restoreImportVerificationData(
    client,
    backup,
    restoredBy,
    backupUserToLocalUser,
    result
  );
  await restoreRolePermissionsData(client, backup, result);
  await restoreTimetableFoundationData(client, backup, result);
  await restoreHomeworkData(client, backup, backupUserToLocalUser, result);
  await restoreExamMarksData(client, backup, backupStudentLocalIds, backupUserToLocalUser, result);
  await restoreReportCardData(client, backup, backupStudentLocalIds, result);
  await restoreCertificateData(client, backup, backupStudentLocalIds, result);
  await restoreClassXPackageData(client, backup, backupStudentLocalIds, result);
  await restoreIdentityCardData(client, backup, backupStudentLocalIds, result);
  await restoreNotificationData(client, backup, backupUserToLocalUser, result);
  await restoreWhatsAppData(client, backup, backupGuardianIds, result);
  await restoreSmsEmailData(client, backup, backupGuardianIds, result);
  await restoreAiAssistantData(client, backup, backupUserToLocalUser, result);
  await restoreFeeRegisterOcrData(client, backup, backupStudentLocalIds, backupPaymentToLocalId, result);
  await restoreCloudBackupData(client, backup, result);
  await restorePublicWebsiteData(client, backup, result);
  await restoreTeacherAnalyticsData(client, backup, result);
  await restoreStaffAttendanceData(client, backup, backupUserToLocalUser, result);
  await restoreStaffLeaveData(client, backup, backupUserToLocalUser, result);
  await restoreSubstituteAssignmentData(client, backup, backupUserToLocalUser, result);

  result.users.skipped += Math.max(0, backup.users.length - linkedParentUsers);
  if (backup.users.length) {
    result.warnings.push(
      "User accounts were not created because backup files do not contain safe login credentials; existing Parent users were relinked only when username and guardian mapping were safe."
    );
  }
  return result;
}

export async function restoreCloudBackupData(
  client: Pick<RestoreDatabaseClient,
    "cloudBackupProfile" | "cloudBackupSchedule" | "cloudBackupRetentionPolicy" |
    "cloudBackupRun" | "cloudBackupArtifact" | "cloudBackupVerification" |
    "cloudBackupRestoreRehearsal" | "cloudBackupEvent">,
  backup: Pick<ValidatedBackup,
    "cloudBackupProfiles" | "cloudBackupSchedules" | "cloudBackupRetentionPolicies" |
    "cloudBackupRuns" | "cloudBackupArtifacts" | "cloudBackupVerifications" |
    "cloudBackupRestoreRehearsals" | "cloudBackupEvents">,
  result: Pick<RestoreResult,
    "cloudBackupProfiles" | "cloudBackupSchedules" | "cloudBackupRetentionPolicies" |
    "cloudBackupRuns" | "cloudBackupArtifacts" | "cloudBackupVerifications" |
    "cloudBackupRestoreRehearsals" | "cloudBackupEvents" | "warnings">
) {
  const db = client as any;
  const profileMap = new Map<string, string>();
  const scheduleMap = new Map<string, string>();
  const runMap = new Map<string, string>();
  const artifactMap = new Map<string, string>();
  const rehearsalMap = new Map<string, string>();

  for (const [index, row] of backup.cloudBackupProfiles.entries()) try {
    const id = requiredText(row.id, "Cloud backup profile ID");
    const profileCode = requiredText(row.profileCode, "Cloud backup profile code");
    const [byId, byCode] = await Promise.all([
      db.cloudBackupProfile.findUnique({ where: { id } }),
      db.cloudBackupProfile.findUnique({ where: { profileCode } })
    ]);
    if ((byId && byId.profileCode !== profileCode) || (byCode && byCode.id !== id)) {
      result.cloudBackupProfiles.skipped++;
      result.warnings.push(`Cloud backup profile ${profileCode} collided with a different local identity and was isolated.`);
      continue;
    }
    if (byId) {
      profileMap.set(id, id);
      result.cloudBackupProfiles.skipped++;
      continue;
    }
    const providerKind = requiredText(row.providerKind, "Cloud backup provider kind");
    await db.cloudBackupProfile.create({ data: {
      id,
      profileCode,
      name: requiredText(row.name, "Cloud backup profile name"),
      providerKind,
      status: ["OBJECT_STORAGE", "GOOGLE_DRIVE"].includes(providerKind) ? "DISABLED" : "PAUSED",
      liveUseEnabled: false,
      destinationLabel: requiredText(row.destinationLabel, "Cloud backup destination label"),
      destinationReferenceMasked: nullableText(row.destinationReferenceMasked),
      encryptionKeyVersion: requiredText(row.encryptionKeyVersion, "Cloud backup key version"),
      containerFormatVersion: nonNegativeInteger(row.containerFormatVersion, "Cloud backup container version"),
      compressionAlgorithm: requiredText(row.compressionAlgorithm, "Cloud backup compression"),
      encryptionAlgorithm: requiredText(row.encryptionAlgorithm, "Cloud backup encryption"),
      verificationRequired: row.verificationRequired !== false,
      automaticRestoreRehearsalEnabled: row.automaticRestoreRehearsalEnabled === true,
      maximumRetryCount: nonNegativeInteger(row.maximumRetryCount, "Cloud backup retry count"),
      requestTimeoutMs: nonNegativeInteger(row.requestTimeoutMs, "Cloud backup timeout"),
      maximumArtifactBytes: row.maximumArtifactBytes == null ? null : nonNegativeInteger(row.maximumArtifactBytes, "Cloud backup maximum bytes"),
      privateAssetsIncluded: row.privateAssetsIncluded === true,
      lastHealthCheckAt: optionalDate(row.lastHealthCheckAt, "Cloud backup health date"),
      lastHealthCheckStatus: nullableText(row.lastHealthCheckStatus),
      lastHealthCheckMessage: nullableText(row.lastHealthCheckMessage),
      activatedByUserId: null,
      pausedByUserId: null,
      ...createdAtData(row, index, "cloudBackupProfiles")
    } });
    profileMap.set(id, id);
    result.cloudBackupProfiles.created++;
  } catch (error) { result.cloudBackupProfiles.errors.push(rowError("Cloud backup profile", index, error)); }

  for (const [index, row] of backup.cloudBackupSchedules.entries()) try {
    const id = requiredText(row.id, "Cloud backup schedule ID");
    const scheduleCode = requiredText(row.scheduleCode, "Cloud backup schedule code");
    const profileId = profileMap.get(requiredText(row.profileId, "Cloud backup schedule profile"));
    if (!profileId) { result.cloudBackupSchedules.skipped++; continue; }
    const [byId, byCode] = await Promise.all([
      db.cloudBackupSchedule.findUnique({ where: { id } }),
      db.cloudBackupSchedule.findUnique({ where: { scheduleCode } })
    ]);
    if ((byId && byId.scheduleCode !== scheduleCode) || (byCode && byCode.id !== id)) {
      result.cloudBackupSchedules.skipped++;
      result.warnings.push(`Cloud backup schedule ${scheduleCode} collided with a different local identity and was isolated.`);
      continue;
    }
    if (byId) { scheduleMap.set(id, id); result.cloudBackupSchedules.skipped++; continue; }
    await db.cloudBackupSchedule.create({ data: {
      id, scheduleCode, profileId,
      frequency: requiredText(row.frequency, "Cloud backup frequency"),
      intervalCount: nonNegativeInteger(row.intervalCount, "Cloud backup interval"),
      hourOfDay: row.hourOfDay == null ? null : nonNegativeInteger(row.hourOfDay, "Cloud backup hour"),
      minuteOfHour: row.minuteOfHour == null ? null : nonNegativeInteger(row.minuteOfHour, "Cloud backup minute"),
      dayOfWeek: row.dayOfWeek == null ? null : nonNegativeInteger(row.dayOfWeek, "Cloud backup weekday"),
      dayOfMonth: row.dayOfMonth == null ? null : nonNegativeInteger(row.dayOfMonth, "Cloud backup month day"),
      timezone: "Asia/Kolkata",
      enabled: false,
      catchUpPolicy: requiredText(row.catchUpPolicy, "Cloud backup catch-up policy"),
      nextRunAt: optionalDate(row.nextRunAt, "Cloud backup next run"),
      lastDueAt: optionalDate(row.lastDueAt, "Cloud backup last due"),
      lastStartedAt: optionalDate(row.lastStartedAt, "Cloud backup last start"),
      lastCompletedAt: optionalDate(row.lastCompletedAt, "Cloud backup last completion"),
      consecutiveFailureCount: nonNegativeInteger(row.consecutiveFailureCount, "Cloud backup consecutive failures"),
      createdByUserId: null, updatedByUserId: null,
      ...createdAtData(row, index, "cloudBackupSchedules")
    } });
    scheduleMap.set(id, id);
    result.cloudBackupSchedules.created++;
  } catch (error) { result.cloudBackupSchedules.errors.push(rowError("Cloud backup schedule", index, error)); }

  for (const [index, row] of backup.cloudBackupRetentionPolicies.entries()) try {
    const id = requiredText(row.id, "Cloud backup retention ID");
    const policyCode = requiredText(row.policyCode, "Cloud backup retention code");
    const profileId = profileMap.get(requiredText(row.profileId, "Cloud backup retention profile"));
    if (!profileId) { result.cloudBackupRetentionPolicies.skipped++; continue; }
    const [byId, byCode, byProfile] = await Promise.all([
      db.cloudBackupRetentionPolicy.findUnique({ where: { id } }),
      db.cloudBackupRetentionPolicy.findUnique({ where: { policyCode } }),
      db.cloudBackupRetentionPolicy.findUnique({ where: { profileId } })
    ]);
    if ((byId && byId.policyCode !== policyCode) || (byCode && byCode.id !== id) || (byProfile && byProfile.id !== id)) {
      result.cloudBackupRetentionPolicies.skipped++;
      result.warnings.push(`Cloud backup retention policy ${policyCode} collided with newer local policy and was isolated.`);
      continue;
    }
    if (byId) { result.cloudBackupRetentionPolicies.skipped++; continue; }
    await db.cloudBackupRetentionPolicy.create({ data: {
      id, policyCode, profileId,
      keepLatestVerifiedCount: Math.max(2, nonNegativeInteger(row.keepLatestVerifiedCount, "Cloud backup latest copies")),
      keepDailyDays: nonNegativeInteger(row.keepDailyDays, "Cloud backup daily retention"),
      keepWeeklyWeeks: nonNegativeInteger(row.keepWeeklyWeeks, "Cloud backup weekly retention"),
      keepMonthlyMonths: nonNegativeInteger(row.keepMonthlyMonths, "Cloud backup monthly retention"),
      minimumVerifiedCopies: Math.max(2, nonNegativeInteger(row.minimumVerifiedCopies, "Cloud backup minimum copies")),
      protectLatestVerified: row.protectLatestVerified !== false,
      autoPruneEnabled: false,
      preserveFailedRuns: row.preserveFailedRuns !== false,
      preserveRestoreRehearsalSources: row.preserveRestoreRehearsalSources !== false,
      createdByUserId: null, updatedByUserId: null,
      ...createdAtData(row, index, "cloudBackupRetentionPolicies")
    } });
    result.cloudBackupRetentionPolicies.created++;
  } catch (error) { result.cloudBackupRetentionPolicies.errors.push(rowError("Cloud backup retention policy", index, error)); }

  for (const [index, row] of backup.cloudBackupRuns.entries()) try {
    const id = requiredText(row.id, "Cloud backup run ID");
    const runNumber = requiredText(row.runNumber, "Cloud backup run number");
    const profileId = profileMap.get(requiredText(row.profileId, "Cloud backup run profile"));
    const scheduleId = row.scheduleId ? scheduleMap.get(String(row.scheduleId)) : null;
    if (!profileId || (row.scheduleId && !scheduleId)) { result.cloudBackupRuns.skipped++; continue; }
    const [byId, byNumber, byKey] = await Promise.all([
      db.cloudBackupRun.findUnique({ where: { id } }),
      db.cloudBackupRun.findUnique({ where: { runNumber } }),
      db.cloudBackupRun.findUnique({ where: { idempotencyKey: requiredText(row.idempotencyKey, "Cloud backup idempotency key") } })
    ]);
    if ((byId && byId.runNumber !== runNumber) || (byNumber && byNumber.id !== id) || (byKey && byKey.id !== id)) {
      result.cloudBackupRuns.skipped++; result.warnings.push(`Cloud backup run ${runNumber} collided with immutable local history and was isolated.`); continue;
    }
    if (byId) { runMap.set(id, id); result.cloudBackupRuns.skipped++; continue; }
    await db.cloudBackupRun.create({ data: {
      id, runNumber, profileId, scheduleId: scheduleId ?? null,
      triggerType: requiredText(row.triggerType, "Cloud backup trigger"),
      scheduledDueAt: optionalDate(row.scheduledDueAt, "Cloud backup due date"),
      status: requiredText(row.status, "Cloud backup run status"),
      idempotencyKey: requiredText(row.idempotencyKey, "Cloud backup idempotency key"),
      sourceBackupVersion: row.sourceBackupVersion == null ? null : nonNegativeInteger(row.sourceBackupVersion, "Cloud backup source version"),
      sourceGeneratedAt: optionalDate(row.sourceGeneratedAt, "Cloud backup source date"),
      sourcePlaintextSha256: nullableText(row.sourcePlaintextSha256),
      ciphertextSha256: nullableText(row.ciphertextSha256),
      plaintextBytes: row.plaintextBytes == null ? null : nonNegativeInteger(row.plaintextBytes, "Cloud backup plaintext bytes"),
      compressedBytes: row.compressedBytes == null ? null : nonNegativeInteger(row.compressedBytes, "Cloud backup compressed bytes"),
      encryptedBytes: row.encryptedBytes == null ? null : nonNegativeInteger(row.encryptedBytes, "Cloud backup encrypted bytes"),
      encryptionKeyVersion: nullableText(row.encryptionKeyVersion),
      containerFormatVersion: row.containerFormatVersion == null ? null : nonNegativeInteger(row.containerFormatVersion, "Cloud backup container version"),
      providerObjectReferenceSafe: nullableText(row.providerObjectReferenceSafe),
      providerObjectVersionSafe: nullableText(row.providerObjectVersionSafe),
      retryCount: nonNegativeInteger(row.retryCount, "Cloud backup retry count"),
      nextRetryAt: optionalDate(row.nextRetryAt, "Cloud backup retry date"),
      failureCode: nullableText(row.failureCode), failureMessageSafe: nullableText(row.failureMessageSafe),
      startedAt: optionalDate(row.startedAt, "Cloud backup start"), completedAt: optionalDate(row.completedAt, "Cloud backup completion"),
      createdByUserId: null, cancelledByUserId: null, cancellationReason: nullableText(row.cancellationReason),
      ...createdAtData(row, index, "cloudBackupRuns")
    } });
    runMap.set(id, id); result.cloudBackupRuns.created++;
  } catch (error) { result.cloudBackupRuns.errors.push(rowError("Cloud backup run", index, error)); }

  for (const [index, row] of backup.cloudBackupArtifacts.entries()) try {
    const id = requiredText(row.id, "Cloud backup artifact ID");
    const runId = runMap.get(requiredText(row.runId, "Cloud backup artifact run"));
    if (!runId) { result.cloudBackupArtifacts.skipped++; continue; }
    const byId = await db.cloudBackupArtifact.findUnique({ where: { id } });
    const byType = await db.cloudBackupArtifact.findUnique({ where: { runId_artifactType: { runId, artifactType: requiredText(row.artifactType, "Cloud backup artifact type") } } });
    if ((byId && byId.runId !== runId) || (byType && byType.id !== id)) { result.cloudBackupArtifacts.skipped++; result.warnings.push("Cloud backup artifact collision was isolated."); continue; }
    if (byId) { artifactMap.set(id, id); result.cloudBackupArtifacts.skipped++; continue; }
    await db.cloudBackupArtifact.create({ data: {
      id, runId, artifactType: requiredText(row.artifactType, "Cloud backup artifact type"),
      status: requiredText(row.status, "Cloud backup artifact status"),
      objectKeySafe: requiredText(row.objectKeySafe, "Cloud backup safe object key"),
      providerObjectIdSafe: nullableText(row.providerObjectIdSafe),
      encryptionKeyVersion: requiredText(row.encryptionKeyVersion, "Cloud backup key version"),
      plaintextSha256: requiredText(row.plaintextSha256, "Cloud backup plaintext hash"),
      ciphertextSha256: requiredText(row.ciphertextSha256, "Cloud backup ciphertext hash"),
      plaintextBytes: nonNegativeInteger(row.plaintextBytes, "Cloud backup plaintext bytes"),
      compressedBytes: nonNegativeInteger(row.compressedBytes, "Cloud backup compressed bytes"),
      ciphertextBytes: nonNegativeInteger(row.ciphertextBytes, "Cloud backup ciphertext bytes"),
      privateAssetsIncluded: row.privateAssetsIncluded === true,
      sourceCoverageJson: requiredText(row.sourceCoverageJson, "Cloud backup source coverage"),
      uploadedAt: optionalDate(row.uploadedAt, "Cloud backup upload date"),
      verifiedAt: optionalDate(row.verifiedAt, "Cloud backup verification date"),
      prunedAt: optionalDate(row.prunedAt, "Cloud backup prune date"),
      ...createdAtData(row, index, "cloudBackupArtifacts")
    } });
    artifactMap.set(id, id); result.cloudBackupArtifacts.created++;
  } catch (error) { result.cloudBackupArtifacts.errors.push(rowError("Cloud backup artifact", index, error)); }

  for (const [index, row] of backup.cloudBackupVerifications.entries()) try {
    const id = requiredText(row.id, "Cloud backup verification ID");
    const runId = runMap.get(requiredText(row.runId, "Cloud backup verification run"));
    const artifactId = artifactMap.get(requiredText(row.artifactId, "Cloud backup verification artifact"));
    if (!runId || !artifactId) { result.cloudBackupVerifications.skipped++; continue; }
    if (await db.cloudBackupVerification.findUnique({ where: { id } })) { result.cloudBackupVerifications.skipped++; continue; }
    await db.cloudBackupVerification.create({ data: {
      id, runId, artifactId,
      verificationType: requiredText(row.verificationType, "Cloud backup verification type"),
      status: requiredText(row.status, "Cloud backup verification status"),
      checkedAt: requiredDate(row.checkedAt, "Cloud backup verification date"),
      durationMs: row.durationMs == null ? null : nonNegativeInteger(row.durationMs, "Cloud backup verification duration"),
      expectedValueHash: nullableText(row.expectedValueHash), actualValueHash: nullableText(row.actualValueHash),
      safeSummary: requiredText(row.safeSummary, "Cloud backup verification summary"),
      failureCode: nullableText(row.failureCode),
      ...createdAtData(row, index, "cloudBackupVerifications")
    } });
    result.cloudBackupVerifications.created++;
  } catch (error) { result.cloudBackupVerifications.errors.push(rowError("Cloud backup verification", index, error)); }

  for (const [index, row] of backup.cloudBackupRestoreRehearsals.entries()) try {
    const id = requiredText(row.id, "Cloud backup rehearsal ID");
    const rehearsalNumber = requiredText(row.rehearsalNumber, "Cloud backup rehearsal number");
    const runId = runMap.get(requiredText(row.runId, "Cloud backup rehearsal run"));
    const artifactId = artifactMap.get(requiredText(row.artifactId, "Cloud backup rehearsal artifact"));
    if (!runId || !artifactId) { result.cloudBackupRestoreRehearsals.skipped++; continue; }
    const [byId, byNumber] = await Promise.all([
      db.cloudBackupRestoreRehearsal.findUnique({ where: { id } }),
      db.cloudBackupRestoreRehearsal.findUnique({ where: { rehearsalNumber } })
    ]);
    if ((byId && byId.rehearsalNumber !== rehearsalNumber) || (byNumber && byNumber.id !== id)) { result.cloudBackupRestoreRehearsals.skipped++; continue; }
    if (byId) { rehearsalMap.set(id, id); result.cloudBackupRestoreRehearsals.skipped++; continue; }
    await db.cloudBackupRestoreRehearsal.create({ data: {
      id, rehearsalNumber, runId, artifactId,
      status: requiredText(row.status, "Cloud backup rehearsal status"),
      backupVersion: row.backupVersion == null ? null : nonNegativeInteger(row.backupVersion, "Cloud backup rehearsal version"),
      firstRestoreSummaryJson: nullableText(row.firstRestoreSummaryJson),
      secondRestoreSummaryJson: nullableText(row.secondRestoreSummaryJson),
      countDigestBefore: nullableText(row.countDigestBefore), countDigestAfterFirst: nullableText(row.countDigestAfterFirst), countDigestAfterSecond: nullableText(row.countDigestAfterSecond),
      sourceDatabaseUnchangedHash: nullableText(row.sourceDatabaseUnchangedHash),
      temporaryDatabaseRemoved: row.temporaryDatabaseRemoved === true,
      failureCode: nullableText(row.failureCode), failureMessageSafe: nullableText(row.failureMessageSafe),
      startedAt: optionalDate(row.startedAt, "Cloud backup rehearsal start"), completedAt: optionalDate(row.completedAt, "Cloud backup rehearsal completion"),
      createdByUserId: null, cancelledByUserId: null,
      ...createdAtData(row, index, "cloudBackupRestoreRehearsals")
    } });
    rehearsalMap.set(id, id); result.cloudBackupRestoreRehearsals.created++;
  } catch (error) { result.cloudBackupRestoreRehearsals.errors.push(rowError("Cloud backup rehearsal", index, error)); }

  for (const [index, row] of backup.cloudBackupEvents.entries()) try {
    const id = requiredText(row.id, "Cloud backup event ID");
    if (await db.cloudBackupEvent.findUnique({ where: { id } })) { result.cloudBackupEvents.skipped++; continue; }
    const profileId = row.profileId ? profileMap.get(String(row.profileId)) : null;
    const scheduleId = row.scheduleId ? scheduleMap.get(String(row.scheduleId)) : null;
    const runId = row.runId ? runMap.get(String(row.runId)) : null;
    const artifactId = row.artifactId ? artifactMap.get(String(row.artifactId)) : null;
    const rehearsalId = row.rehearsalId ? rehearsalMap.get(String(row.rehearsalId)) : null;
    if ((row.profileId && !profileId) || (row.scheduleId && !scheduleId) || (row.runId && !runId) || (row.artifactId && !artifactId) || (row.rehearsalId && !rehearsalId)) {
      result.cloudBackupEvents.skipped++; continue;
    }
    await db.cloudBackupEvent.create({ data: {
      id, profileId, scheduleId, runId, artifactId, rehearsalId,
      eventType: requiredText(row.eventType, "Cloud backup event type"),
      eventDate: requiredDate(row.eventDate, "Cloud backup event date"),
      reason: nullableText(row.reason), safeMetadataJson: nullableText(row.safeMetadataJson),
      recordedByUserId: null,
      ...createdAtData(row, index, "cloudBackupEvents")
    } });
    result.cloudBackupEvents.created++;
  } catch (error) { result.cloudBackupEvents.errors.push(rowError("Cloud backup event", index, error)); }
}

export async function restoreAiAssistantData(
  client: Pick<RestoreDatabaseClient, "aiAssistantProfile" | "aiAssistantSourcePolicy" | "aiAssistantQueryAudit" | "aiAssistantSafetyEvent" | "aiAssistantEvaluationCase" | "aiAssistantEvaluationRun">,
  backup: Pick<ValidatedBackup, "aiAssistantProfiles" | "aiAssistantSourcePolicies" | "aiAssistantQueryAudits" | "aiAssistantSafetyEvents" | "aiAssistantEvaluationCases" | "aiAssistantEvaluationRuns">,
  userMap: Map<string, string>,
  result: Pick<RestoreResult, "aiAssistantProfiles" | "aiAssistantSourcePolicies" | "aiAssistantQueryAudits" | "aiAssistantSafetyEvents" | "aiAssistantEvaluationCases" | "aiAssistantEvaluationRuns" | "warnings">
) {
  const profileMap = new Map<string, string>();
  for (const [index, row] of backup.aiAssistantProfiles.entries()) try {
    const id = requiredText(row.id, "Assistant profile ID"), profileCode = requiredText(row.profileCode, "Assistant profile code");
    const [byId, byCode] = await Promise.all([client.aiAssistantProfile.findUnique({ where: { id } }), client.aiAssistantProfile.findUnique({ where: { profileCode } })]);
    if ((byId && byId.profileCode !== profileCode) || (byCode && byCode.id !== id)) {
      result.aiAssistantProfiles.skipped++; result.warnings.push(`AI assistant profile ${profileCode} collided with a different local identity and was isolated.`); continue;
    }
    const disabledLive = row.providerKind !== "MOCK";
    const data = {
      name: requiredText(row.name, "Assistant profile name"), providerKind: requiredText(row.providerKind, "Provider kind"),
      status: disabledLive ? "DISABLED" : requiredText(row.status, "Profile status"), liveUseEnabled: false,
      allowedModesJson: requiredText(row.allowedModesJson, "Allowed modes"), maximumQuestionLength: nonNegativeInteger(row.maximumQuestionLength, "Maximum question length"),
      maximumContextCharacters: nonNegativeInteger(row.maximumContextCharacters, "Maximum context"), maximumToolCalls: nonNegativeInteger(row.maximumToolCalls, "Maximum tool calls"),
      maximumRowsPerTool: nonNegativeInteger(row.maximumRowsPerTool, "Maximum tool rows"), requestTimeoutMs: nonNegativeInteger(row.requestTimeoutMs, "Request timeout"),
      minimumAggregateGroupSize: nonNegativeInteger(row.minimumAggregateGroupSize, "Minimum aggregate group"),
      contentLoggingMode: requiredText(row.contentLoggingMode, "Content logging mode"), auditRetentionDays: nonNegativeInteger(row.auditRetentionDays, "Audit retention"),
      providerModelReference: nullableText(row.providerModelReference), lastHealthCheckAt: optionalDate(row.lastHealthCheckAt, "Health check date"),
      lastHealthCheckStatus: nullableText(row.lastHealthCheckStatus), lastHealthCheckMessage: nullableText(row.lastHealthCheckMessage),
      activatedByUserId: null, pausedByUserId: null
    };
    if (byId) {
      const backupUpdated = optionalDate(row.updatedAt, "Profile updated date");
      if (backupUpdated && byId.updatedAt > backupUpdated) result.aiAssistantProfiles.skipped++;
      else { await client.aiAssistantProfile.update({ where: { id }, data }); result.aiAssistantProfiles.updated++; }
      profileMap.set(id, id);
    } else {
      await client.aiAssistantProfile.create({ data: { id, profileCode, ...data, ...createdAtData(row, index, "aiAssistantProfiles") } });
      result.aiAssistantProfiles.created++; profileMap.set(id, id);
    }
  } catch (error) { result.aiAssistantProfiles.errors.push(rowError("AI assistant profile", index, error)); }

  for (const [index, row] of backup.aiAssistantSourcePolicies.entries()) try {
    const id = requiredText(row.id, "Source policy ID"), policyCode = requiredText(row.policyCode, "Source policy code"), sourceType = requiredText(row.sourceType, "Source type"), sourceKey = requiredText(row.sourceKey, "Source key");
    const [byId, byCode, bySource] = await Promise.all([
      client.aiAssistantSourcePolicy.findUnique({ where: { id } }), client.aiAssistantSourcePolicy.findUnique({ where: { policyCode } }),
      client.aiAssistantSourcePolicy.findUnique({ where: { sourceType_sourceKey: { sourceType, sourceKey } } })
    ]);
    if ((byId && byId.policyCode !== policyCode) || (byCode && byCode.id !== id) || (bySource && bySource.id !== id)) {
      result.aiAssistantSourcePolicies.skipped++; result.warnings.push(`AI source policy ${policyCode} collided with a different local identity and was isolated.`); continue;
    }
    const data = { sourceType, sourceKey, displayName: requiredText(row.displayName, "Source display name"), description: requiredText(row.description, "Source description"),
      allowedRolesJson: requiredText(row.allowedRolesJson, "Source roles"), allowedModesJson: requiredText(row.allowedModesJson, "Source modes"), enabled: row.enabled === true,
      minimumGroupSize: optionalInteger(row.minimumGroupSize), maximumRows: optionalInteger(row.maximumRows), freshnessWarningDays: optionalInteger(row.freshnessWarningDays),
      prohibitedFieldKeysJson: requiredText(row.prohibitedFieldKeysJson, "Prohibited fields"), citationLabel: requiredText(row.citationLabel, "Citation label"),
      createdByUserId: null, updatedByUserId: null };
    if (byId) {
      const backupUpdated = optionalDate(row.updatedAt, "Policy updated date");
      if (backupUpdated && byId.updatedAt > backupUpdated) result.aiAssistantSourcePolicies.skipped++;
      else { await client.aiAssistantSourcePolicy.update({ where: { id }, data }); result.aiAssistantSourcePolicies.updated++; }
    } else { await client.aiAssistantSourcePolicy.create({ data: { id, policyCode, ...data, ...createdAtData(row, index, "aiAssistantSourcePolicies") } }); result.aiAssistantSourcePolicies.created++; }
  } catch (error) { result.aiAssistantSourcePolicies.errors.push(rowError("AI source policy", index, error)); }

  const auditMap = new Map<string, string>();
  for (const [index, row] of backup.aiAssistantQueryAudits.entries()) try {
    const id = requiredText(row.id, "Query audit ID"), requestId = requiredText(row.requestId, "Request ID");
    const userId = userMap.get(requiredText(row.userId, "Audit user ID")), assistantProfileId = profileMap.get(requiredText(row.assistantProfileId, "Audit profile ID"));
    if (!userId || !assistantProfileId) { result.aiAssistantQueryAudits.skipped++; continue; }
    const [byId, byRequest] = await Promise.all([client.aiAssistantQueryAudit.findUnique({ where: { id } }), client.aiAssistantQueryAudit.findUnique({ where: { requestId } })]);
    if ((byId && byId.requestId !== requestId) || (byRequest && byRequest.id !== id)) { result.aiAssistantQueryAudits.skipped++; continue; }
    if (byId) { result.aiAssistantQueryAudits.skipped++; auditMap.set(id, id); continue; }
    await client.aiAssistantQueryAudit.create({ data: { id, requestId, userId, assistantProfileId, mode: requiredText(row.mode, "Audit mode"), questionHash: requiredText(row.questionHash, "Question hash"),
      providerKind: requiredText(row.providerKind, "Audit provider"), providerModelReference: nullableText(row.providerModelReference), safetyDecision: requiredText(row.safetyDecision, "Safety decision"),
      refusalReasonCode: nullableText(row.refusalReasonCode), toolKeysJson: requiredText(row.toolKeysJson, "Tool keys"), toolCallCount: nonNegativeInteger(row.toolCallCount, "Tool count"),
      sourceCount: nonNegativeInteger(row.sourceCount, "Source count"), citationCount: nonNegativeInteger(row.citationCount, "Citation count"),
      retrievedCharacterCount: nonNegativeInteger(row.retrievedCharacterCount, "Retrieved characters"), redactionCount: nonNegativeInteger(row.redactionCount, "Redaction count"),
      latencyMs: nonNegativeInteger(row.latencyMs, "Latency"), answerHash: nullableText(row.answerHash), createdAt: requiredDate(row.createdAt, "Audit created date"), expiresAt: optionalDate(row.expiresAt, "Audit expiry") } });
    result.aiAssistantQueryAudits.created++; auditMap.set(id, id);
  } catch (error) { result.aiAssistantQueryAudits.errors.push(rowError("AI query audit", index, error)); }

  for (const [index, row] of backup.aiAssistantSafetyEvents.entries()) try {
    const id = requiredText(row.id, "Safety event ID"), backupAuditId = nullableText(row.queryAuditId), queryAuditId = backupAuditId ? auditMap.get(backupAuditId) : null;
    if (backupAuditId && !queryAuditId) { result.aiAssistantSafetyEvents.skipped++; continue; }
    if (await client.aiAssistantSafetyEvent.findUnique({ where: { id } })) { result.aiAssistantSafetyEvents.skipped++; continue; }
    await client.aiAssistantSafetyEvent.create({ data: { id, queryAuditId: queryAuditId ?? null, eventType: requiredText(row.eventType, "Event type"), severity: requiredText(row.severity, "Severity"), safeReason: requiredText(row.safeReason, "Safe reason"), safeMetadataJson: nullableText(row.safeMetadataJson), createdAt: requiredDate(row.createdAt, "Event created date") } });
    result.aiAssistantSafetyEvents.created++;
  } catch (error) { result.aiAssistantSafetyEvents.errors.push(rowError("AI safety event", index, error)); }

  for (const [index, row] of backup.aiAssistantEvaluationCases.entries()) try {
    const id = requiredText(row.id, "Evaluation case ID"), caseCode = requiredText(row.caseCode, "Evaluation case code");
    const [byId, byCode] = await Promise.all([client.aiAssistantEvaluationCase.findUnique({ where: { id } }), client.aiAssistantEvaluationCase.findUnique({ where: { caseCode } })]);
    if ((byId && byId.caseCode !== caseCode) || (byCode && byCode.id !== id)) { result.aiAssistantEvaluationCases.skipped++; continue; }
    if (byId) { result.aiAssistantEvaluationCases.skipped++; continue; }
    await client.aiAssistantEvaluationCase.create({ data: { id, caseCode, category: requiredText(row.category, "Case category"), question: requiredText(row.question, "Synthetic question"), expectedDecision: requiredText(row.expectedDecision, "Expected decision"), requiredSourceKeysJson: requiredText(row.requiredSourceKeysJson, "Required sources"), prohibitedTermsJson: requiredText(row.prohibitedTermsJson, "Prohibited terms"), expectedAnswerContainsJson: nullableText(row.expectedAnswerContainsJson), status: requiredText(row.status, "Case status"), ...createdAtData(row, index, "aiAssistantEvaluationCases") } });
    result.aiAssistantEvaluationCases.created++;
  } catch (error) { result.aiAssistantEvaluationCases.errors.push(rowError("AI evaluation case", index, error)); }

  for (const [index, row] of backup.aiAssistantEvaluationRuns.entries()) try {
    const id = requiredText(row.id, "Evaluation run ID"), runNumber = requiredText(row.runNumber, "Evaluation run number"), profileId = profileMap.get(requiredText(row.profileId, "Run profile ID"));
    if (!profileId) { result.aiAssistantEvaluationRuns.skipped++; continue; }
    const [byId, byNumber] = await Promise.all([client.aiAssistantEvaluationRun.findUnique({ where: { id } }), client.aiAssistantEvaluationRun.findUnique({ where: { runNumber } })]);
    if ((byId && byId.runNumber !== runNumber) || (byNumber && byNumber.id !== id)) { result.aiAssistantEvaluationRuns.skipped++; continue; }
    if (byId) { result.aiAssistantEvaluationRuns.skipped++; continue; }
    await client.aiAssistantEvaluationRun.create({ data: { id, runNumber, profileId, startedAt: requiredDate(row.startedAt, "Run start"), completedAt: optionalDate(row.completedAt, "Run completion"), totalCases: nonNegativeInteger(row.totalCases, "Total cases"), passedCases: nonNegativeInteger(row.passedCases, "Passed cases"), failedCases: nonNegativeInteger(row.failedCases, "Failed cases"), blockedCases: nonNegativeInteger(row.blockedCases, "Blocked cases"), resultSummaryJson: requiredText(row.resultSummaryJson, "Run summary"), createdByUserId: null, createdAt: requiredDate(row.createdAt, "Run created date") } });
    result.aiAssistantEvaluationRuns.created++;
  } catch (error) { result.aiAssistantEvaluationRuns.errors.push(rowError("AI evaluation run", index, error)); }
}

function optionalInteger(value: unknown) { return value === null || value === undefined || value === "" ? null : nonNegativeInteger(value, "Optional integer"); }

export async function restoreStudentProgressionData(
  client: Pick<RestoreDatabaseClient, "studentProgressionDecision" | "academicYearEnrollment">,
  backup: Pick<ValidatedBackup, "studentProgressionDecisions">,
  backupStudentLocalIds: Map<string, string>, backupUserToLocalUser: Map<string, string>,
  result: Pick<RestoreResult, "studentProgressionDecisions" | "warnings">
) {
  for (const [index, row] of backup.studentProgressionDecisions.entries()) {
    try {
      const studentId = backupStudentLocalIds.get(requiredText(row.studentId, "Student ID"));
      if (!studentId) { result.studentProgressionDecisions.skipped += 1; result.warnings.push(`Progression decision ${index + 1} skipped because its student link could not be matched safely.`); continue; }
      const id = requiredText(row.id, "Progression decision ID");
      if (await client.studentProgressionDecision.findUnique({ where: { id } })) { result.studentProgressionDecisions.skipped += 1; continue; }
      let sourceEnrollmentId: string | null = null;
      const backupSourceId = nullableText(row.sourceEnrollmentId);
      if (backupSourceId) {
        const linked = await client.academicYearEnrollment.findFirst({ where: { studentId, academicYear: requiredText(row.academicYear, "Academic year") } });
        sourceEnrollmentId = linked?.id ?? null;
        if (!linked) result.warnings.push(`Progression decision ${index + 1} restored without its source enrollment link because no safe local match exists.`);
      }
      const data = {
        studentId, sourceEnrollmentId, academicYear: requiredText(row.academicYear, "Academic year"), decisionType: requiredText(row.decisionType, "Decision type"), status: requiredText(row.status, "Decision status"),
        fromClass: nullableText(row.fromClass), fromSection: nullableText(row.fromSection), fromStatus: nullableText(row.fromStatus), toAcademicYear: nullableText(row.toAcademicYear), toClass: nullableText(row.toClass), toSection: nullableText(row.toSection), toStatus: nullableText(row.toStatus),
        effectiveDate: requiredDate(row.effectiveDate, `studentProgressionDecisions[${index}].effectiveDate`), reason: nullableText(row.reason), evidenceNotes: nullableText(row.evidenceNotes), marksSummary: nullableText(row.marksSummary), attendanceSummary: nullableText(row.attendanceSummary), parentRequestNotes: nullableText(row.parentRequestNotes), parentAcknowledgementNotes: nullableText(row.parentAcknowledgementNotes), feeWarningNotes: nullableText(row.feeWarningNotes), udiseReviewNotes: nullableText(row.udiseReviewNotes), destinationSchool: nullableText(row.destinationSchool), followUpNotes: nullableText(row.followUpNotes), rejectionReason: nullableText(row.rejectionReason), cancellationReason: nullableText(row.cancellationReason),
        createdByUserId: mapOptionalUserId(row.createdByUserId, backupUserToLocalUser), submittedByUserId: mapOptionalUserId(row.submittedByUserId, backupUserToLocalUser), approvedByUserId: mapOptionalUserId(row.approvedByUserId, backupUserToLocalUser), finalizedByUserId: mapOptionalUserId(row.finalizedByUserId, backupUserToLocalUser), cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, backupUserToLocalUser),
        submittedAt: optionalDate(row.submittedAt, `studentProgressionDecisions[${index}].submittedAt`), approvedAt: optionalDate(row.approvedAt, `studentProgressionDecisions[${index}].approvedAt`), finalizedAt: optionalDate(row.finalizedAt, `studentProgressionDecisions[${index}].finalizedAt`), cancelledAt: optionalDate(row.cancelledAt, `studentProgressionDecisions[${index}].cancelledAt`)
      };
      const duplicate = await client.studentProgressionDecision.findFirst({ where: { studentId, academicYear: data.academicYear, decisionType: data.decisionType, effectiveDate: data.effectiveDate, status: data.status } });
      if (duplicate) { result.studentProgressionDecisions.skipped += 1; continue; }
      await client.studentProgressionDecision.create({ data: { id, ...data, ...createdAtData(row, index, "studentProgressionDecisions") } });
      result.studentProgressionDecisions.created += 1;
    } catch (error) { result.studentProgressionDecisions.errors.push(rowError("Student progression decision", index, error)); }
  }
}

export async function restoreStudentLifecycleData(
  client: Pick<RestoreDatabaseClient, "academicYearEnrollment" | "studentLifecycleEvent">,
  backup: Pick<ValidatedBackup, "academicYearEnrollments" | "studentLifecycleEvents">,
  backupStudentLocalIds: Map<string, string>,
  backupUserToLocalUser: Map<string, string>,
  result: Pick<RestoreResult, "academicYearEnrollments" | "studentLifecycleEvents" | "warnings">
) {
  for (const [index, row] of backup.academicYearEnrollments.entries()) {
    try {
      const studentId = backupStudentLocalIds.get(requiredText(row.studentId, "Student ID"));
      if (!studentId) {
        result.academicYearEnrollments.skipped += 1;
        result.warnings.push(`Academic-year enrollment ${index + 1} skipped because its student link could not be matched safely.`);
        continue;
      }
      const academicYear = requiredText(row.academicYear, "Academic year");
      const existing = await client.academicYearEnrollment.findUnique({ where: { studentId_academicYear: { studentId, academicYear } } });
      if (existing) {
        result.academicYearEnrollments.skipped += 1;
        if (!sameData(existing, {
          className: requiredText(row.className, "Class"), section: nullableText(row.section), rollNo: nullableText(row.rollNo),
          status: requiredText(row.status, "Enrollment status"), enrollmentDate: optionalDate(row.enrollmentDate, `academicYearEnrollments[${index}].enrollmentDate`),
          exitDate: optionalDate(row.exitDate, `academicYearEnrollments[${index}].exitDate`), exitReason: nullableText(row.exitReason), notes: nullableText(row.notes)
        })) result.academicYearEnrollments.warnings.push(`Enrollment ${index + 1} already exists for this student and academic year; the local history was preserved.`);
        continue;
      }
      await client.academicYearEnrollment.create({ data: {
        id: requiredText(row.id, "Academic-year enrollment ID"), studentId, academicYear,
        className: requiredText(row.className, "Class"), section: nullableText(row.section), rollNo: nullableText(row.rollNo),
        status: requiredText(row.status, "Enrollment status"), enrollmentDate: optionalDate(row.enrollmentDate, `academicYearEnrollments[${index}].enrollmentDate`),
        exitDate: optionalDate(row.exitDate, `academicYearEnrollments[${index}].exitDate`), exitReason: nullableText(row.exitReason), notes: nullableText(row.notes),
        ...createdAtData(row, index, "academicYearEnrollments")
      } });
      result.academicYearEnrollments.created += 1;
    } catch (error) { result.academicYearEnrollments.errors.push(rowError("Academic-year enrollment", index, error)); }
  }

  for (const [index, row] of backup.studentLifecycleEvents.entries()) {
    try {
      const studentId = backupStudentLocalIds.get(requiredText(row.studentId, "Student ID"));
      if (!studentId) {
        result.studentLifecycleEvents.skipped += 1;
        result.warnings.push(`Student lifecycle event ${index + 1} skipped because its student link could not be matched safely.`);
        continue;
      }
      const id = requiredText(row.id, "Student lifecycle event ID");
      const data = {
        studentId, academicYear: nullableText(row.academicYear), eventType: requiredText(row.eventType, "Lifecycle event type"),
        fromClass: nullableText(row.fromClass), fromSection: nullableText(row.fromSection), toClass: nullableText(row.toClass), toSection: nullableText(row.toSection),
        fromStatus: nullableText(row.fromStatus), toStatus: nullableText(row.toStatus), effectiveDate: requiredDate(row.effectiveDate, `studentLifecycleEvents[${index}].effectiveDate`),
        reason: nullableText(row.reason), evidenceNotes: nullableText(row.evidenceNotes), parentAcknowledgementNotes: nullableText(row.parentAcknowledgementNotes),
        approvedByUserId: mapOptionalUserId(row.approvedByUserId, backupUserToLocalUser), recordedByUserId: mapOptionalUserId(row.recordedByUserId, backupUserToLocalUser)
      };
      const existing = await client.studentLifecycleEvent.findUnique({ where: { id } });
      if (existing) {
        result.studentLifecycleEvents.skipped += 1;
        if (!sameData(existing, data)) result.studentLifecycleEvents.warnings.push(`Lifecycle event ${index + 1} already exists locally; the local append-only history was preserved.`);
        continue;
      }
      const duplicate = await client.studentLifecycleEvent.findFirst({ where: data });
      if (duplicate) {
        result.studentLifecycleEvents.skipped += 1;
        continue;
      }
      await client.studentLifecycleEvent.create({ data: { id, ...data, ...createdAtData(row, index, "studentLifecycleEvents") } });
      result.studentLifecycleEvents.created += 1;
    } catch (error) { result.studentLifecycleEvents.errors.push(rowError("Student lifecycle event", index, error)); }
  }
}

export async function restoreStudentAttendanceData(
  client: Pick<RestoreDatabaseClient, "studentAttendanceSession" | "studentAttendanceRecord" | "student">,
  backup: Pick<ValidatedBackup, "studentAttendanceSessions" | "studentAttendanceRecords">,
  backupStudentLocalIds: Map<string, string>,
  backupUserToLocalUser: Map<string, string>,
  result: Pick<RestoreResult, "studentAttendanceSessions" | "studentAttendanceRecords" | "warnings">
) {
  const sessionIds = new Map<string, string>();
  const sessionScopes = new Map<string, { academicYear: string; className: string; section: string }>();
  for (const [index, row] of backup.studentAttendanceSessions.entries()) {
    try {
      const backupId = requiredText(row.id, "Attendance session ID");
      const attendanceDate = requiredDate(row.attendanceDate, `studentAttendanceSessions[${index}].attendanceDate`);
      const className = requiredText(row.className, "Class"); const section = textOr(row.section, ""); const academicYear = requiredText(row.academicYear, "Academic year");
      const data = {
        status: requiredText(row.status, "Attendance status"), notes: nullableText(row.notes),
        takenByUserId: mapOptionalUserId(row.takenByUserId, backupUserToLocalUser),
        submittedByUserId: mapOptionalUserId(row.submittedByUserId, backupUserToLocalUser),
        lockedByUserId: mapOptionalUserId(row.lockedByUserId, backupUserToLocalUser),
        submittedAt: optionalDate(row.submittedAt, `studentAttendanceSessions[${index}].submittedAt`),
        lockedAt: optionalDate(row.lockedAt, `studentAttendanceSessions[${index}].lockedAt`)
      };
      const where = { attendanceDate_className_section_academicYear: { attendanceDate, className, section, academicYear } };
      const existing = await client.studentAttendanceSession.findUnique({ where });
      const session = existing ? await client.studentAttendanceSession.update({ where, data }) : await client.studentAttendanceSession.create({ data: { id: backupId, attendanceDate, className, section, academicYear, ...data } });
      existing ? result.studentAttendanceSessions.updated += 1 : result.studentAttendanceSessions.created += 1;
      sessionIds.set(backupId, session.id);
      sessionScopes.set(backupId, { academicYear, className, section });
    } catch (error) { result.studentAttendanceSessions.errors.push(rowError("Student attendance session", index, error)); }
  }
  for (const [index, row] of backup.studentAttendanceRecords.entries()) {
    try {
      const backupSessionId = requiredText(row.sessionId, "Attendance session ID");
      const sessionId = sessionIds.get(backupSessionId);
      const sessionScope = sessionScopes.get(backupSessionId);
      const studentId = backupStudentLocalIds.get(requiredText(row.studentId, "Student ID"));
      if (!sessionId || !sessionScope || !studentId) { result.studentAttendanceRecords.skipped += 1; result.warnings.push(`Student attendance record ${index + 1} skipped because its session or student could not be matched safely.`); continue; }
      const student = await client.student.findUnique({ where: { id: studentId }, select: { academicYear: true, className: true, section: true } });
      if (!student || student.academicYear !== sessionScope.academicYear || student.className !== sessionScope.className || (student.section ?? "") !== sessionScope.section) {
        result.studentAttendanceRecords.skipped += 1;
        result.warnings.push(`Student attendance record ${index + 1} skipped because the student does not belong to the restored class, section, and academic year.`);
        continue;
      }
      const data = { admissionNo: requiredText(row.admissionNo, "Admission number"), status: requiredText(row.status, "Attendance status"), remarks: nullableText(row.remarks) };
      const where = { sessionId_studentId: { sessionId, studentId } }; const existing = await client.studentAttendanceRecord.findUnique({ where });
      if (existing) { await client.studentAttendanceRecord.update({ where, data }); result.studentAttendanceRecords.updated += 1; }
      else { await client.studentAttendanceRecord.create({ data: { id: requiredText(row.id, "Attendance record ID"), sessionId, studentId, ...data } }); result.studentAttendanceRecords.created += 1; }
    } catch (error) { result.studentAttendanceRecords.errors.push(rowError("Student attendance record", index, error)); }
  }
}

export async function restoreStaffData(
  client: Pick<RestoreDatabaseClient, "staffMember" | "user" | "timetableTeacher">,
  backup: Pick<ValidatedBackup, "staffMembers">,
  backupUserToLocalUser: Map<string, string>,
  result: Pick<RestoreResult, "staffMembers" | "warnings">
) {
  for (const [index, row] of backup.staffMembers.entries()) {
    try {
      const backupId = requiredText(row.id, "Staff ID");
      const staffCode = nullableText(row.staffCode)?.toUpperCase() ?? null;
      const email = nullableText(row.email)?.toLowerCase() ?? null;
      const mobile = nullableText(row.mobile);
      let existing = await client.staffMember.findUnique({ where: { id: backupId } });
      if (!existing && staffCode) existing = await client.staffMember.findUnique({ where: { staffCode } });
      if (!existing && !staffCode && email) {
        const matches = await client.staffMember.findMany({ where: { email }, take: 2 });
        if (matches.length > 1) throw new Error("Multiple local staff profiles use this email; restore cannot choose safely");
        existing = matches[0] ?? null;
      }
      if (!existing && !staffCode && mobile) {
        const matches = await client.staffMember.findMany({ where: { mobile }, take: 2 });
        if (matches.length > 1) throw new Error("Multiple local staff profiles use this mobile; restore cannot choose safely");
        existing = matches[0] ?? null;
      }

      let userId: string | null = Object.prototype.hasOwnProperty.call(row, "userId") ? null : existing?.userId ?? null;
      const backupUserId = nullableText(row.userId);
      if (backupUserId) {
        const mapped = backupUserToLocalUser.get(backupUserId);
        const user = mapped ? await client.user.findUnique({ where: { id: mapped } }) : null;
        const occupied = mapped ? await client.staffMember.findUnique({ where: { userId: mapped } }) : null;
        if (user?.role === "TEACHER" && (!occupied || occupied.id === existing?.id)) userId = mapped!;
        else result.warnings.push(`Staff ${index + 1} user link was skipped because the local Teacher account mapping was not safe; any existing local link was preserved.`);
        if (!(user?.role === "TEACHER" && (!occupied || occupied.id === existing?.id))) userId = existing?.userId ?? null;
      }
      let timetableTeacherId: string | null = Object.prototype.hasOwnProperty.call(row, "timetableTeacherId") ? null : existing?.timetableTeacherId ?? null;
      const backupTeacherId = nullableText(row.timetableTeacherId);
      if (backupTeacherId) {
        const teacher = await client.timetableTeacher.findUnique({ where: { id: backupTeacherId } });
        const occupied = teacher ? await client.staffMember.findUnique({ where: { timetableTeacherId: teacher.id } }) : null;
        if (teacher && (!occupied || occupied.id === existing?.id)) timetableTeacherId = teacher.id;
        else result.warnings.push(`Staff ${index + 1} timetable link was skipped because the timetable teacher mapping was not safe; any existing local link was preserved.`);
        if (!(teacher && (!occupied || occupied.id === existing?.id))) timetableTeacherId = existing?.timetableTeacherId ?? null;
      }
      const data = {
        staffCode, fullName: requiredText(row.fullName, "Staff full name"), displayName: nullableText(row.displayName),
        staffType: requiredText(row.staffType, "Staff type"), designation: requiredText(row.designation, "Designation"),
        department: nullableText(row.department), primarySubject: nullableText(row.primarySubject), additionalSubjects: nullableText(row.additionalSubjects),
        qualification: nullableText(row.qualification), experienceYears: row.experienceYears == null ? null : Number(row.experienceYears),
        dateOfJoining: optionalDate(row.dateOfJoining, `staffMembers[${index}].dateOfJoining`), mobile, alternateMobile: nullableText(row.alternateMobile),
        email, address: nullableText(row.address), emergencyContactName: nullableText(row.emergencyContactName), emergencyContactMobile: nullableText(row.emergencyContactMobile),
        status: requiredText(row.status, "Staff status"), notes: nullableText(row.notes), userId, timetableTeacherId
      };
      if (existing) { if (sameData(existing, data)) result.staffMembers.skipped += 1; else { await client.staffMember.update({ where: { id: existing.id }, data }); result.staffMembers.updated += 1; } }
      else { await client.staffMember.create({ data: { id: backupId, ...data, ...createdAtData(row, index, "staffMembers") } }); result.staffMembers.created += 1; }
    } catch (error) { result.staffMembers.errors.push(rowError("Staff member", index, error)); }
  }
}

export async function restoreStaffAttendanceData(
  client: Pick<RestoreDatabaseClient, "staffAttendanceSession" | "staffAttendanceRecord" | "staffMember">,
  backup: Pick<ValidatedBackup, "staffAttendanceSessions" | "staffAttendanceRecords">,
  backupUserToLocalUser: Map<string, string>,
  result: Pick<RestoreResult, "staffAttendanceSessions" | "staffAttendanceRecords" | "warnings">
) {
  const sessionIds = new Map<string, string>();
  for (const [index, row] of backup.staffAttendanceSessions.entries()) {
    try {
      const backupId = requiredText(row.id, "Staff attendance session ID"); const attendanceDate = requiredDate(row.attendanceDate, `staffAttendanceSessions[${index}].attendanceDate`);
      const data = { academicYear: nullableText(row.academicYear), status: requiredText(row.status, "Staff attendance status"), notes: nullableText(row.notes), takenByUserId: mapOptionalUserId(row.takenByUserId, backupUserToLocalUser), submittedByUserId: mapOptionalUserId(row.submittedByUserId, backupUserToLocalUser), lockedByUserId: mapOptionalUserId(row.lockedByUserId, backupUserToLocalUser), submittedAt: optionalDate(row.submittedAt, `staffAttendanceSessions[${index}].submittedAt`), lockedAt: optionalDate(row.lockedAt, `staffAttendanceSessions[${index}].lockedAt`) };
      const where = { attendanceDate }; const existing = await client.staffAttendanceSession.findUnique({ where }); const session = existing ? await client.staffAttendanceSession.update({ where, data }) : await client.staffAttendanceSession.create({ data: { id: backupId, attendanceDate, ...data } });
      existing ? result.staffAttendanceSessions.updated++ : result.staffAttendanceSessions.created++; sessionIds.set(backupId, session.id);
    } catch (error) { result.staffAttendanceSessions.errors.push(rowError("Staff attendance session", index, error)); }
  }
  for (const [index, row] of backup.staffAttendanceRecords.entries()) {
    try {
      const sessionId = sessionIds.get(requiredText(row.sessionId, "Staff attendance session ID")); const backupStaffId = requiredText(row.staffMemberId, "Staff member ID");
      const staff = await client.staffMember.findFirst({ where: { OR: [{ id: backupStaffId }, ...(nullableText(row.staffCode) ? [{ staffCode: nullableText(row.staffCode) }] : [])] }, select: { id: true, staffCode: true } });
      if (!sessionId || !staff) { result.staffAttendanceRecords.skipped++; result.warnings.push(`Staff attendance record ${index + 1} skipped because its session or StaffMember link could not be matched safely.`); continue; }
      const data = { staffCode: staff.staffCode, status: requiredText(row.status, "Staff attendance status"), checkInTime: nullableText(row.checkInTime), checkOutTime: nullableText(row.checkOutTime), lateMinutes: row.lateMinutes == null ? null : Number(row.lateMinutes), remarks: nullableText(row.remarks), source: requiredText(row.source, "Staff attendance source") };
      const where = { sessionId_staffMemberId: { sessionId, staffMemberId: staff.id } }; const existing = await client.staffAttendanceRecord.findUnique({ where });
      if (existing) { await client.staffAttendanceRecord.update({ where, data }); result.staffAttendanceRecords.updated++; } else { await client.staffAttendanceRecord.create({ data: { id: requiredText(row.id, "Staff attendance record ID"), sessionId, staffMemberId: staff.id, ...data } }); result.staffAttendanceRecords.created++; }
    } catch (error) { result.staffAttendanceRecords.errors.push(rowError("Staff attendance record", index, error)); }
  }
}

export async function restoreStaffLeaveData(
  client: Pick<RestoreDatabaseClient, "staffLeaveRequest" | "staffMember">,
  backup: Pick<ValidatedBackup, "staffLeaveRequests" | "staffMembers">,
  backupUserToLocalUser: Map<string, string>,
  result: Pick<RestoreResult, "staffLeaveRequests" | "warnings">
) {
  for (const [index, row] of backup.staffLeaveRequests.entries()) {
    try {
      const id = requiredText(row.id, "Staff leave request ID");
      const backupStaffId = requiredText(row.staffMemberId, "Staff member ID");
      const staffBackup = backup.staffMembers.find((item) => item.id === backupStaffId);
      const staffCode = nullableText(staffBackup?.staffCode);
      const staff = await client.staffMember.findFirst({ where: { OR: [{ id: backupStaffId }, ...(staffCode ? [{ staffCode }] : [])] }, select: { id: true } });
      if (!staff) { result.staffLeaveRequests.skipped++; result.warnings.push(`Staff leave request ${index + 1} skipped because its StaffMember link could not be matched safely.`); continue; }
      const startDate = requiredDate(row.startDate, `staffLeaveRequests[${index}].startDate`);
      const endDate = requiredDate(row.endDate, `staffLeaveRequests[${index}].endDate`);
      const data = {
        staffMemberId: staff.id,
        requestedByUserId: mapOptionalUserId(row.requestedByUserId, backupUserToLocalUser),
        leaveType: requiredText(row.leaveType, "Leave type"), startDate, endDate,
        halfDaySession: nullableText(row.halfDaySession), totalDays: Number(row.totalDays),
        reason: nullableText(row.reason) ?? "", status: requiredText(row.status, "Leave status"),
        substituteRequired: booleanOr(row.substituteRequired, false), substituteNotes: nullableText(row.substituteNotes),
        approverUserId: mapOptionalUserId(row.approverUserId, backupUserToLocalUser),
        approvedAt: optionalDate(row.approvedAt, `staffLeaveRequests[${index}].approvedAt`),
        rejectedAt: optionalDate(row.rejectedAt, `staffLeaveRequests[${index}].rejectedAt`), rejectionReason: nullableText(row.rejectionReason),
        cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, backupUserToLocalUser),
        cancelledAt: optionalDate(row.cancelledAt, `staffLeaveRequests[${index}].cancelledAt`), cancellationReason: nullableText(row.cancellationReason), notes: nullableText(row.notes)
      };
      let existing = await client.staffLeaveRequest.findUnique({ where: { id } });
      existing ??= await client.staffLeaveRequest.findFirst({ where: { staffMemberId: staff.id, startDate, endDate, leaveType: data.leaveType, createdAt: typeof row.createdAt === "string" ? requiredDate(row.createdAt, `staffLeaveRequests[${index}].createdAt`) : undefined } });
      if (existing) { if (sameData(existing, data)) result.staffLeaveRequests.skipped++; else { await client.staffLeaveRequest.update({ where: { id: existing.id }, data }); result.staffLeaveRequests.updated++; } }
      else { await client.staffLeaveRequest.create({ data: { id, ...data, ...createdAtData(row, index, "staffLeaveRequests") } }); result.staffLeaveRequests.created++; }
    } catch (error) { result.staffLeaveRequests.errors.push(rowError("Staff leave request", index, error)); }
  }
}

export async function restoreSubstituteAssignmentData(
  client: Pick<RestoreDatabaseClient,"substituteAssignment"|"staffMember"|"staffLeaveRequest"|"timetableAssignment">,
  backup: Pick<ValidatedBackup,"substituteAssignments"|"staffMembers"|"staffLeaveRequests">,
  backupUserToLocalUser: Map<string,string>,
  result: Pick<RestoreResult,"substituteAssignments"|"warnings">
) {
  async function staffId(backupId:unknown){const id=requiredText(backupId,"Staff member ID");const row=backup.staffMembers.find(item=>item.id===id);const staffCode=nullableText(row?.staffCode);return client.staffMember.findFirst({where:{OR:[{id},...(staffCode?[{staffCode}]:[])]},select:{id:true}});}
  for(const [index,row] of backup.substituteAssignments.entries()){
    try{
      const id=requiredText(row.id,"Substitute assignment ID");const absent=await staffId(row.absentStaffMemberId);if(!absent){result.substituteAssignments.skipped++;result.warnings.push(`Substitute assignment ${index+1} skipped because its absent StaffMember link could not be matched safely.`);continue;}
      const substitute=nullableText(row.substituteStaffMemberId)?await staffId(row.substituteStaffMemberId):null;if(nullableText(row.substituteStaffMemberId)&&!substitute){result.substituteAssignments.skipped++;result.warnings.push(`Substitute assignment ${index+1} skipped because its substitute StaffMember link could not be matched safely.`);continue;}if(substitute?.id===absent.id)throw new Error("Absent and substitute staff must be different");
      let leaveRequestId:null|string=null;const backupLeaveId=nullableText(row.leaveRequestId);if(backupLeaveId){const backupLeave=backup.staffLeaveRequests.find(item=>item.id===backupLeaveId);let leave=await client.staffLeaveRequest.findUnique({where:{id:backupLeaveId}});if(!leave&&backupLeave)leave=await client.staffLeaveRequest.findFirst({where:{staffMemberId:absent.id,startDate:requiredDate(backupLeave.startDate,"Leave start date"),endDate:requiredDate(backupLeave.endDate,"Leave end date"),leaveType:requiredText(backupLeave.leaveType,"Leave type")}});if(leave?.staffMemberId===absent.id)leaveRequestId=leave.id;else result.warnings.push(`Substitute assignment ${index+1} leave link was omitted because it could not be matched safely.`);}
      let timetableAssignmentId:null|string=null;const backupTimetableId=nullableText(row.timetableAssignmentId);if(backupTimetableId){const timetable=await client.timetableAssignment.findUnique({where:{id:backupTimetableId},select:{id:true}});if(timetable)timetableAssignmentId=timetable.id;else result.warnings.push(`Substitute assignment ${index+1} timetable link was omitted because it could not be matched safely.`);}
      const assignmentDate=requiredDate(row.assignmentDate,`substituteAssignments[${index}].assignmentDate`);const data={assignmentDate,academicYear:nullableText(row.academicYear),leaveRequestId,absentStaffMemberId:absent.id,substituteStaffMemberId:substitute?.id??null,timetableAssignmentId,className:nullableText(row.className),section:nullableText(row.section),subject:nullableText(row.subject),periodLabel:nullableText(row.periodLabel),periodStartTime:nullableText(row.periodStartTime),periodEndTime:nullableText(row.periodEndTime),reason:requiredText(row.reason,"Substitute reason"),status:requiredText(row.status,"Substitute status"),priority:requiredText(row.priority,"Substitute priority"),notes:nullableText(row.notes),assignedByUserId:mapOptionalUserId(row.assignedByUserId,backupUserToLocalUser),confirmedByUserId:mapOptionalUserId(row.confirmedByUserId,backupUserToLocalUser),completedByUserId:mapOptionalUserId(row.completedByUserId,backupUserToLocalUser),cancelledByUserId:mapOptionalUserId(row.cancelledByUserId,backupUserToLocalUser),assignedAt:optionalDate(row.assignedAt,`substituteAssignments[${index}].assignedAt`),confirmedAt:optionalDate(row.confirmedAt,`substituteAssignments[${index}].confirmedAt`),completedAt:optionalDate(row.completedAt,`substituteAssignments[${index}].completedAt`),cancelledAt:optionalDate(row.cancelledAt,`substituteAssignments[${index}].cancelledAt`),cancellationReason:nullableText(row.cancellationReason)};
      let existing=await client.substituteAssignment.findUnique({where:{id}});existing??=await client.substituteAssignment.findFirst({where:{assignmentDate,absentStaffMemberId:absent.id,substituteStaffMemberId:substitute?.id??null,periodLabel:data.periodLabel,createdAt:typeof row.createdAt==="string"?requiredDate(row.createdAt,`substituteAssignments[${index}].createdAt`):undefined}});if(existing){if(sameData(existing,data))result.substituteAssignments.skipped++;else{await client.substituteAssignment.update({where:{id:existing.id},data});result.substituteAssignments.updated++;}}else{await client.substituteAssignment.create({data:{id,...data,...createdAtData(row,index,"substituteAssignments")}});result.substituteAssignments.created++;}
    }catch(error){result.substituteAssignments.errors.push(rowError("Substitute assignment",index,error));}
  }
}

async function restoreExpenseData(
  client: Pick<RestoreDatabaseClient, "vendor" | "expenseCategory" | "expenseDepartment" | "expenseRecord" | "expensePayment" | "expenseAudit">,
  backup: Pick<ValidatedBackup, "vendors" | "expenseCategories" | "expenseDepartments" | "expenseRecords" | "expensePayments" | "expenseAudits">,
  userMap: Map<string, string>,
  result: Pick<RestoreResult, "vendors" | "expenseCategories" | "expenseDepartments" | "expenseRecords" | "expensePayments" | "expenseAudits" | "warnings">
) {
  const vendorMap = new Map<string, string>();
  const categoryMap = new Map<string, string>();
  const departmentMap = new Map<string, string>();
  const expenseMap = new Map<string, string>();
  for (const [index, row] of backup.vendors.entries()) {
    try {
      const backupId = requiredText(row.id, "Vendor ID");
      const vendorCode = requiredText(row.vendorCode, "Vendor code");
      const data = { name: requiredText(row.name, "Vendor name"), contactPerson: nullableText(row.contactPerson), mobile: nullableText(row.mobile), alternateMobile: nullableText(row.alternateMobile), email: nullableText(row.email), address: nullableText(row.address), gstin: nullableText(row.gstin), pan: nullableText(row.pan), bankName: nullableText(row.bankName), accountLastFour: nullableText(row.accountLastFour), ifsc: nullableText(row.ifsc), paymentTermsDays: row.paymentTermsDays == null ? null : nonNegativeInteger(row.paymentTermsDays, "Payment terms"), notes: nullableText(row.notes), status: requiredText(row.status, "Vendor status"), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap) };
      const existing = await client.vendor.findUnique({ where: { vendorCode } });
      if (existing) {
        vendorMap.set(backupId, existing.id);
        const backupUpdated = optionalDate(row.updatedAt, "Vendor updatedAt");
        if (backupUpdated && existing.updatedAt > backupUpdated) { result.vendors.skipped++; result.vendors.warnings.push("Vendor " + vendorCode + " kept because the local record is newer."); }
        else { await client.vendor.update({ where: { id: existing.id }, data }); result.vendors.updated++; }
      } else {
        const created = await client.vendor.create({ data: { id: backupId, vendorCode, ...data, ...createdAtData(row, index, "vendors") } });
        vendorMap.set(backupId, created.id); result.vendors.created++;
      }
    } catch (error) { result.vendors.errors.push(rowError("Vendor", index, error)); }
  }
  for (const [index, row] of backup.expenseCategories.entries()) {
    try {
      const backupId = requiredText(row.id, "Expense category ID"); const code = nullableText(row.code); const name = requiredText(row.name, "Expense category name");
      const existing = code ? await client.expenseCategory.findUnique({ where: { code } }) : await client.expenseCategory.findUnique({ where: { name } });
      const data = { name, code, description: nullableText(row.description), status: requiredText(row.status, "Expense category status") };
      if (existing) { categoryMap.set(backupId, existing.id); result.expenseCategories.skipped++; }
      else { const created = await client.expenseCategory.create({ data: { id: backupId, ...data, ...createdAtData(row, index, "expenseCategories") } }); categoryMap.set(backupId, created.id); result.expenseCategories.created++; }
    } catch (error) { result.expenseCategories.errors.push(rowError("Expense category", index, error)); }
  }
  for (const [index, row] of backup.expenseCategories.entries()) {
    const localId = categoryMap.get(String(row.id)); const parentId = nullableText(row.parentCategoryId) ? categoryMap.get(String(row.parentCategoryId)) : null;
    if (localId && parentId && localId !== parentId) await client.expenseCategory.update({ where: { id: localId }, data: { parentCategoryId: parentId } }).catch(() => result.warnings.push("Expense category parent link " + (index + 1) + " could not be restored safely."));
  }
  for (const [index, row] of backup.expenseDepartments.entries()) {
    try {
      const backupId = requiredText(row.id, "Expense department ID"); const code = nullableText(row.code); const name = requiredText(row.name, "Expense department name");
      const existing = code ? await client.expenseDepartment.findUnique({ where: { code } }) : await client.expenseDepartment.findUnique({ where: { name } });
      const data = { name, code, description: nullableText(row.description), status: requiredText(row.status, "Expense department status") };
      if (existing) { departmentMap.set(backupId, existing.id); result.expenseDepartments.skipped++; }
      else { const created = await client.expenseDepartment.create({ data: { id: backupId, ...data, ...createdAtData(row, index, "expenseDepartments") } }); departmentMap.set(backupId, created.id); result.expenseDepartments.created++; }
    } catch (error) { result.expenseDepartments.errors.push(rowError("Expense department", index, error)); }
  }
  for (const [index, row] of backup.expenseRecords.entries()) {
    try {
      const backupId = requiredText(row.id, "Expense record ID"); const expenseNumber = requiredText(row.expenseNumber, "Expense number");
      const existing = await client.expenseRecord.findUnique({ where: { expenseNumber } });
      if (existing) {
        result.expenseRecords.skipped++;
        if (existing.id === backupId) expenseMap.set(backupId, existing.id);
        else result.warnings.push(`Expense ${expenseNumber} already exists with a different record identity; its backup payments and audits were not restored.`);
        continue;
      }
      const vendorId = nullableText(row.vendorId) ? vendorMap.get(String(row.vendorId)) : null; const categoryId = categoryMap.get(String(row.categoryId)); const departmentId = nullableText(row.departmentId) ? departmentMap.get(String(row.departmentId)) : null;
      if (!categoryId || (nullableText(row.vendorId) && !vendorId) || (nullableText(row.departmentId) && !departmentId)) { result.expenseRecords.skipped++; result.warnings.push("Expense " + expenseNumber + " skipped because a vendor, category, or department link could not be validated."); continue; }
      const data = { expenseNumber, expenseDate: requiredDate(row.expenseDate, "Expense date"), academicYear: requiredText(row.academicYear, "Academic year"), vendorId, categoryId, departmentId, description: requiredText(row.description, "Expense description"), invoiceNumber: nullableText(row.invoiceNumber), invoiceDate: optionalDate(row.invoiceDate, "Invoice date"), grossAmount: requiredText(row.grossAmount, "Gross amount"), taxAmount: requiredText(row.taxAmount, "Tax amount"), deductionAmount: requiredText(row.deductionAmount, "Deduction amount"), netAmount: requiredText(row.netAmount, "Net amount"), paymentMethod: requiredText(row.paymentMethod, "Payment method"), paymentStatus: requiredText(row.paymentStatus, "Payment status"), approvalStatus: requiredText(row.approvalStatus, "Approval status"), transactionReference: nullableText(row.transactionReference), chequeNumber: nullableText(row.chequeNumber), chequeDate: optionalDate(row.chequeDate, "Cheque date"), paidDate: optionalDate(row.paidDate, "Paid date"), notes: nullableText(row.notes), rejectionReason: nullableText(row.rejectionReason), cancellationReason: nullableText(row.cancellationReason), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap), submittedByUserId: mapOptionalUserId(row.submittedByUserId, userMap), approvedByUserId: mapOptionalUserId(row.approvedByUserId, userMap), paidByUserId: mapOptionalUserId(row.paidByUserId, userMap), cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, userMap), submittedAt: optionalDate(row.submittedAt, "Submitted at"), approvedAt: optionalDate(row.approvedAt, "Approved at"), paidAt: optionalDate(row.paidAt, "Paid at"), cancelledAt: optionalDate(row.cancelledAt, "Cancelled at") };
      const created = await client.expenseRecord.create({ data: { id: backupId, ...data, ...createdAtData(row, index, "expenseRecords") } }); expenseMap.set(backupId, created.id); result.expenseRecords.created++;
    } catch (error) { result.expenseRecords.errors.push(rowError("Expense record", index, error)); }
  }
  for (const [index, row] of backup.expensePayments.entries()) {
    try {
      const expenseRecordId = expenseMap.get(String(row.expenseRecordId)); if (!expenseRecordId) { result.expensePayments.skipped++; result.warnings.push("Expense payment " + (index + 1) + " skipped because its expense link could not be matched."); continue; }
      const id = requiredText(row.id, "Expense payment ID"); const existing = await client.expensePayment.findUnique({ where: { id } }); if (existing) { result.expensePayments.skipped++; continue; }
      await client.expensePayment.create({ data: { id, expenseRecordId, paymentDate: requiredDate(row.paymentDate, "Expense payment date"), amount: requiredText(row.amount, "Expense payment amount"), paymentMethod: requiredText(row.paymentMethod, "Expense payment method"), transactionReference: nullableText(row.transactionReference), chequeNumber: nullableText(row.chequeNumber), chequeDate: optionalDate(row.chequeDate, "Expense payment cheque date"), notes: nullableText(row.notes), recordedByUserId: mapOptionalUserId(row.recordedByUserId, userMap), ...createdAtData(row, index, "expensePayments") } }); result.expensePayments.created++;
    } catch (error) { result.expensePayments.errors.push(rowError("Expense payment", index, error)); }
  }
  for (const [index, row] of backup.expenseAudits.entries()) {
    try {
      const expenseRecordId = expenseMap.get(String(row.expenseRecordId)); if (!expenseRecordId) { result.expenseAudits.skipped++; result.warnings.push("Expense audit " + (index + 1) + " skipped because its expense link could not be matched."); continue; }
      const id = requiredText(row.id, "Expense audit ID"); if (await client.expenseAudit.findUnique({ where: { id } })) { result.expenseAudits.skipped++; continue; }
      await client.expenseAudit.create({ data: { id, expenseRecordId, action: requiredText(row.action, "Expense audit action"), fromStatus: nullableText(row.fromStatus), toStatus: nullableText(row.toStatus), detailsJson: nullableText(row.detailsJson), actorUserId: mapOptionalUserId(row.actorUserId, userMap), actorName: requiredText(row.actorName, "Expense audit actor"), ...createdAtData(row, index, "expenseAudits") } }); result.expenseAudits.created++;
    } catch (error) { result.expenseAudits.errors.push(rowError("Expense audit", index, error)); }
  }
  return { vendorMap, categoryMap, departmentMap, expenseMap };
}

export async function restoreBudgetData(
  client: Pick<RestoreDatabaseClient, "budgetPlan" | "budgetAllocation" | "budgetRevision">,
  backup: Pick<ValidatedBackup, "budgetPlans" | "budgetAllocations" | "budgetRevisions">,
  userMap: Map<string, string>,
  masterMaps: { categoryMap: Map<string, string>; departmentMap: Map<string, string> },
  result: Pick<RestoreResult, "budgetPlans" | "budgetAllocations" | "budgetRevisions" | "warnings">
) {
  const planMap = new Map<string, string>(); const protectedPlans = new Set<string>();
  for (const [index, row] of backup.budgetPlans.entries()) {
    try {
      const backupId = requiredText(row.id, "Budget plan ID"); const budgetNumber = requiredText(row.budgetNumber, "Budget number");
      const byId = await client.budgetPlan.findUnique({ where: { id: backupId } }); const byNumber = await client.budgetPlan.findUnique({ where: { budgetNumber } });
      if (byNumber && byNumber.id !== backupId) { result.budgetPlans.skipped++; result.warnings.push(`Budget ${budgetNumber} already exists with a different record identity; its backup allocations and revisions were not restored.`); continue; }
      const data = { budgetNumber, academicYear: requiredText(row.academicYear, "Budget academic year"), title: requiredText(row.title, "Budget title"), description: nullableText(row.description), status: requiredText(row.status, "Budget status"), totalAllocatedAmount: requiredText(row.totalAllocatedAmount, "Budget total"), warningThresholdPercent: positiveInteger(row.warningThresholdPercent, "Budget warning threshold"), criticalThresholdPercent: positiveInteger(row.criticalThresholdPercent, "Budget critical threshold"), effectiveFrom: optionalDate(row.effectiveFrom, "Budget effective from"), effectiveTo: optionalDate(row.effectiveTo, "Budget effective to"), rejectionReason: nullableText(row.rejectionReason), cancellationReason: nullableText(row.cancellationReason), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap), submittedByUserId: mapOptionalUserId(row.submittedByUserId, userMap), approvedByUserId: mapOptionalUserId(row.approvedByUserId, userMap), lockedByUserId: mapOptionalUserId(row.lockedByUserId, userMap), cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, userMap), submittedAt: optionalDate(row.submittedAt, "Budget submitted at"), approvedAt: optionalDate(row.approvedAt, "Budget approved at"), lockedAt: optionalDate(row.lockedAt, "Budget locked at"), cancelledAt: optionalDate(row.cancelledAt, "Budget cancelled at") };
      if (byId) { planMap.set(backupId, byId.id); const backupUpdated = optionalDate(row.updatedAt, "Budget updated at"); if (backupUpdated && byId.updatedAt > backupUpdated) { protectedPlans.add(backupId); result.budgetPlans.skipped++; result.budgetPlans.warnings.push(`Budget ${budgetNumber} kept because the local record is newer.`); } else { await client.budgetPlan.update({ where: { id: byId.id }, data }); result.budgetPlans.updated++; } }
      else { const created = await client.budgetPlan.create({ data: { id: backupId, ...data, ...createdAtData(row, index, "budgetPlans") } }); planMap.set(backupId, created.id); result.budgetPlans.created++; }
    } catch (error) { result.budgetPlans.errors.push(rowError("Budget plan", index, error)); }
  }
  for (const [index, row] of backup.budgetAllocations.entries()) {
    try {
      const backupPlanId = requiredText(row.budgetPlanId, "Allocation plan ID"); const budgetPlanId = planMap.get(backupPlanId); if (!budgetPlanId || protectedPlans.has(backupPlanId)) { result.budgetAllocations.skipped++; result.warnings.push(`Budget allocation ${index + 1} skipped because its exact plan link was not restored or the local plan is newer.`); continue; }
      const categoryId = nullableText(row.categoryId) ? masterMaps.categoryMap.get(String(row.categoryId)) ?? null : null; const departmentId = nullableText(row.departmentId) ? masterMaps.departmentMap.get(String(row.departmentId)) ?? null : null;
      if ((nullableText(row.categoryId) && !categoryId) || (nullableText(row.departmentId) && !departmentId) || (!categoryId && !departmentId)) { result.budgetAllocations.skipped++; result.warnings.push(`Budget allocation ${index + 1} skipped because its category or department link could not be validated.`); continue; }
      const allocationKey = `${categoryId ?? "*"}|${departmentId ?? "*"}`; const data = { budgetPlanId, categoryId, departmentId, allocationKey, allocatedAmount: requiredText(row.allocatedAmount, "Allocated amount"), warningThresholdPercent: row.warningThresholdPercent == null ? null : positiveInteger(row.warningThresholdPercent, "Allocation warning threshold"), criticalThresholdPercent: row.criticalThresholdPercent == null ? null : positiveInteger(row.criticalThresholdPercent, "Allocation critical threshold"), notes: nullableText(row.notes) };
      const backupId = requiredText(row.id, "Budget allocation ID"); let existing = await client.budgetAllocation.findUnique({ where: { id: backupId } }); existing ??= await client.budgetAllocation.findUnique({ where: { budgetPlanId_allocationKey: { budgetPlanId, allocationKey } } });
      if (existing) { const backupUpdated = optionalDate(row.updatedAt, "Allocation updated at"); if (backupUpdated && existing.updatedAt > backupUpdated) { result.budgetAllocations.skipped++; result.budgetAllocations.warnings.push(`Budget allocation ${index + 1} kept because the local record is newer.`); } else { await client.budgetAllocation.update({ where: { id: existing.id }, data }); result.budgetAllocations.updated++; } }
      else { await client.budgetAllocation.create({ data: { id: backupId, ...data, ...createdAtData(row, index, "budgetAllocations") } }); result.budgetAllocations.created++; }
    } catch (error) { result.budgetAllocations.errors.push(rowError("Budget allocation", index, error)); }
  }
  for (const [index, row] of backup.budgetRevisions.entries()) {
    try {
      const backupPlanId = requiredText(row.budgetPlanId, "Revision plan ID"); const budgetPlanId = planMap.get(backupPlanId); if (!budgetPlanId || protectedPlans.has(backupPlanId)) { result.budgetRevisions.skipped++; result.warnings.push(`Budget revision ${index + 1} skipped because its exact plan link was not restored or the local plan is newer.`); continue; }
      const parsed = JSON.parse(requiredText(row.revisionData, "Revision data")); let linksValid = true; const remap = (items: any[]) => items.map((item) => { const categoryId = item.categoryId ? masterMaps.categoryMap.get(String(item.categoryId)) ?? null : null; const departmentId = item.departmentId ? masterMaps.departmentMap.get(String(item.departmentId)) ?? null : null; if ((item.categoryId && !categoryId) || (item.departmentId && !departmentId)) linksValid = false; return { ...item, categoryId, departmentId, allocationKey: `${categoryId ?? "*"}|${departmentId ?? "*"}` }; }); const revisionData = JSON.stringify({ before: remap(parsed.before), after: remap(parsed.after) }); if (!linksValid) { result.budgetRevisions.skipped++; result.warnings.push(`Budget revision ${index + 1} skipped because a snapshot category or department link could not be validated.`); continue; }
      const revisionNumber = positiveInteger(row.revisionNumber, "Revision number"); const data = { budgetPlanId, revisionNumber, reason: requiredText(row.reason, "Revision reason"), previousTotalAmount: requiredText(row.previousTotalAmount, "Previous budget total"), revisedTotalAmount: requiredText(row.revisedTotalAmount, "Revised budget total"), revisionData, status: requiredText(row.status, "Revision status"), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap), submittedByUserId: mapOptionalUserId(row.submittedByUserId, userMap), approvedByUserId: mapOptionalUserId(row.approvedByUserId, userMap), submittedAt: optionalDate(row.submittedAt, "Revision submitted at"), approvedAt: optionalDate(row.approvedAt, "Revision approved at"), rejectionReason: nullableText(row.rejectionReason), cancellationReason: nullableText(row.cancellationReason) };
      const backupId = requiredText(row.id, "Budget revision ID"); let existing = await client.budgetRevision.findUnique({ where: { id: backupId } }); existing ??= await client.budgetRevision.findUnique({ where: { budgetPlanId_revisionNumber: { budgetPlanId, revisionNumber } } }); if (existing) { result.budgetRevisions.skipped++; } else { await client.budgetRevision.create({ data: { id: backupId, ...data, ...createdAtData(row, index, "budgetRevisions") } }); result.budgetRevisions.created++; }
    } catch (error) { result.budgetRevisions.errors.push(rowError("Budget revision", index, error)); }
  }
}

export async function restoreMiscIncomeAndCashBookData(
  client: Pick<RestoreDatabaseClient, "miscIncomeItem" | "miscIncomeRate" | "miscIncomeReceipt" | "miscIncomeReceiptLine" | "cashBookDay" | "cashBookMovement">,
  backup: Pick<ValidatedBackup, "miscIncomeItems" | "miscIncomeRates" | "miscIncomeReceipts" | "miscIncomeReceiptLines" | "cashBookDays" | "cashBookMovements">,
  studentMap: Map<string, string>, userMap: Map<string, string>,
  result: Pick<RestoreResult, "miscIncomeItems" | "miscIncomeRates" | "miscIncomeReceipts" | "miscIncomeReceiptLines" | "cashBookDays" | "cashBookMovements" | "warnings">
) {
  const itemMap = new Map<string, string>(); const protectedItems = new Set<string>();
  for (const [index, row] of backup.miscIncomeItems.entries()) try { const id = requiredText(row.id, "Income item ID"), code = requiredText(row.itemCode, "Item code"); const byId = await client.miscIncomeItem.findUnique({ where: { id } }); const byCode = await client.miscIncomeItem.findUnique({ where: { itemCode: code } }); if (byCode && byCode.id !== id) { result.miscIncomeItems.skipped++; result.warnings.push(`Income item ${code} already exists with a different identity; dependent backup records were isolated.`); continue; } const data = { itemCode: code, name: requiredText(row.name, "Item name"), description: nullableText(row.description), category: requiredText(row.category, "Item category"), studentLinkPolicy: requiredText(row.studentLinkPolicy, "Student link policy"), status: requiredText(row.status, "Item status"), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap) }; if (byId) { itemMap.set(id, byId.id); const updated = optionalDate(row.updatedAt, "Income item updated at"); if (updated && byId.updatedAt > updated) { protectedItems.add(id); result.miscIncomeItems.skipped++; result.miscIncomeItems.warnings.push(`Income item ${code} kept because the local record is newer.`); } else { await client.miscIncomeItem.update({ where: { id }, data }); result.miscIncomeItems.updated++; } } else { const created = await client.miscIncomeItem.create({ data: { id, ...data, ...createdAtData(row, index, "miscIncomeItems") } }); itemMap.set(id, created.id); result.miscIncomeItems.created++; } } catch (error) { result.miscIncomeItems.errors.push(rowError("Income item", index, error)); }
  const rateMap = new Map<string, string>();
  for (const [index, row] of backup.miscIncomeRates.entries()) try { const id = requiredText(row.id, "Income rate ID"), backupItemId = requiredText(row.itemId, "Rate item ID"), itemId = itemMap.get(backupItemId); if (!itemId || protectedItems.has(backupItemId)) { result.miscIncomeRates.skipped++; result.warnings.push(`Income rate ${index + 1} skipped because its exact item link was not restored or the local item is newer.`); continue; } const data = { itemId, academicYear: requiredText(row.academicYear, "Academic year"), amount: requiredText(row.amount, "Rate amount"), effectiveFrom: optionalDate(row.effectiveFrom, "Rate effective from"), effectiveTo: optionalDate(row.effectiveTo, "Rate effective to"), notes: nullableText(row.notes), status: requiredText(row.status, "Rate status") }; const existing = await client.miscIncomeRate.findUnique({ where: { id } }); if (existing) { rateMap.set(id, existing.id); const updated = optionalDate(row.updatedAt, "Income rate updated at"); if (updated && existing.updatedAt > updated) { result.miscIncomeRates.skipped++; result.miscIncomeRates.warnings.push(`Income rate ${index + 1} kept because the local record is newer.`); } else { await client.miscIncomeRate.update({ where: { id }, data }); result.miscIncomeRates.updated++; } } else { const created = await client.miscIncomeRate.create({ data: { id, ...data, ...createdAtData(row, index, "miscIncomeRates") } }); rateMap.set(id, created.id); result.miscIncomeRates.created++; } } catch (error) { result.miscIncomeRates.errors.push(rowError("Income rate", index, error)); }
  const receiptMap = new Map<string, string>(); const protectedReceipts = new Set<string>();
  for (const [index, row] of backup.miscIncomeReceipts.entries()) try { const id = requiredText(row.id, "Miscellaneous receipt ID"), number = requiredText(row.receiptNumber, "Receipt number"); const byId = await client.miscIncomeReceipt.findUnique({ where: { id } }); const byNumber = await client.miscIncomeReceipt.findUnique({ where: { receiptNumber: number } }); if (byNumber && byNumber.id !== id) { result.miscIncomeReceipts.skipped++; result.warnings.push(`Miscellaneous receipt ${number} already exists with a different identity; its backup lines were not attached.`); continue; } const backupStudentId = nullableText(row.studentId); const studentId = backupStudentId ? studentMap.get(backupStudentId) : null; if (backupStudentId && !studentId) { result.miscIncomeReceipts.skipped++; result.warnings.push(`Miscellaneous receipt ${number} skipped because its student link could not be validated.`); continue; } const data = { receiptNumber: number, receiptDate: requiredDate(row.receiptDate, "Receipt date"), academicYear: requiredText(row.academicYear, "Academic year"), studentId, payerName: nullableText(row.payerName), paymentMethod: requiredText(row.paymentMethod, "Payment method"), receivedAccount: nullableText(row.receivedAccount), transactionReference: nullableText(row.transactionReference), chequeNumber: nullableText(row.chequeNumber), chequeDate: optionalDate(row.chequeDate, "Cheque date"), grossAmount: requiredText(row.grossAmount, "Gross amount"), discountAmount: requiredText(row.discountAmount, "Discount amount"), netAmount: requiredText(row.netAmount, "Net amount"), status: requiredText(row.status, "Receipt status"), remarks: nullableText(row.remarks), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap), cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, userMap), cancelledAt: optionalDate(row.cancelledAt, "Cancelled at"), cancellationReason: nullableText(row.cancellationReason) }; if (byId) { receiptMap.set(id, byId.id); const updated = optionalDate(row.updatedAt, "Receipt updated at"); if (updated && byId.updatedAt > updated) { protectedReceipts.add(id); result.miscIncomeReceipts.skipped++; result.miscIncomeReceipts.warnings.push(`Receipt ${number} kept because the local record is newer.`); } else { await client.miscIncomeReceipt.update({ where: { id }, data }); result.miscIncomeReceipts.updated++; } } else { const created = await client.miscIncomeReceipt.create({ data: { id, ...data, ...createdAtData(row, index, "miscIncomeReceipts") } }); receiptMap.set(id, created.id); result.miscIncomeReceipts.created++; } } catch (error) { result.miscIncomeReceipts.errors.push(rowError("Miscellaneous receipt", index, error)); }
  for (const [index, row] of backup.miscIncomeReceiptLines.entries()) try { const id = requiredText(row.id, "Receipt line ID"), backupReceiptId = requiredText(row.receiptId, "Receipt ID"), receiptId = receiptMap.get(backupReceiptId), itemId = itemMap.get(requiredText(row.itemId, "Item ID")), rateId = nullableText(row.rateId) ? rateMap.get(requiredText(row.rateId, "Rate ID")) : null; if (!receiptId || protectedReceipts.has(backupReceiptId) || !itemId || (nullableText(row.rateId) && !rateId)) { result.miscIncomeReceiptLines.skipped++; result.warnings.push(`Miscellaneous receipt line ${index + 1} skipped because an exact parent, item, or rate link was unavailable.`); continue; } const existing = await client.miscIncomeReceiptLine.findUnique({ where: { id } }); if (existing) { result.miscIncomeReceiptLines.skipped++; continue; } await client.miscIncomeReceiptLine.create({ data: { id, receiptId, itemId, itemNameSnapshot: requiredText(row.itemNameSnapshot, "Item name snapshot"), rateId, quantity: positiveInteger(row.quantity, "Quantity"), unitAmount: requiredText(row.unitAmount, "Unit amount"), discountAmount: requiredText(row.discountAmount, "Discount amount"), lineTotal: requiredText(row.lineTotal, "Line total"), notes: nullableText(row.notes), ...createdAtData(row, index, "miscIncomeReceiptLines") } }); result.miscIncomeReceiptLines.created++; } catch (error) { result.miscIncomeReceiptLines.errors.push(rowError("Miscellaneous receipt line", index, error)); }
  const dayMap = new Map<string, string>(); const protectedDays = new Set<string>();
  for (const [index, row] of backup.cashBookDays.entries()) try {
    const id = requiredText(row.id, "Cash day ID"), cashDate = requiredDate(row.cashDate, "Cash date");
    const byId = await client.cashBookDay.findUnique({ where: { id } });
    const byDate = await client.cashBookDay.findUnique({ where: { cashDate } });
    if (byDate && byDate.id !== id) { result.cashBookDays.skipped++; result.warnings.push(`Cash day ${cashDate.toISOString().slice(0, 10)} already exists with a different identity; backup movements were isolated.`); continue; }
    const data = {
      cashDate,
      academicYear: requiredText(row.academicYear, "Academic year"),
      openingBalance: requiredText(row.openingBalance, "Opening balance"),
      status: requiredText(row.status, "Cash status"),
      feeCashSnapshot: requiredText(row.feeCashSnapshot, "Fee cash snapshot"),
      miscIncomeCashSnapshot: requiredText(row.miscIncomeCashSnapshot, "Miscellaneous cash snapshot"),
      bookSalesCashSnapshot: row.bookSalesCashSnapshot == null ? "0" : requiredText(row.bookSalesCashSnapshot, "Book-sale cash snapshot"),
      cashExpenseSnapshot: requiredText(row.cashExpenseSnapshot, "Cash expense snapshot"),
      manualInflowSnapshot: requiredText(row.manualInflowSnapshot, "Manual inflow snapshot"),
      manualOutflowSnapshot: requiredText(row.manualOutflowSnapshot, "Manual outflow snapshot"),
      bankDepositSnapshot: requiredText(row.bankDepositSnapshot, "Bank deposit snapshot"),
      directorHandoverSnapshot: requiredText(row.directorHandoverSnapshot, "Director handover snapshot"),
      calculatedClosingBalance: requiredText(row.calculatedClosingBalance, "Calculated closing balance"),
      countedClosingBalance: nullableText(row.countedClosingBalance),
      varianceAmount: nullableText(row.varianceAmount),
      sourceSummarySnapshot: nullableText(row.sourceSummarySnapshot),
      notes: nullableText(row.notes),
      rejectionReason: nullableText(row.rejectionReason),
      cancellationReason: nullableText(row.cancellationReason),
      createdByUserId: mapOptionalUserId(row.createdByUserId, userMap),
      submittedByUserId: mapOptionalUserId(row.submittedByUserId, userMap),
      approvedByUserId: mapOptionalUserId(row.approvedByUserId, userMap),
      lockedByUserId: mapOptionalUserId(row.lockedByUserId, userMap),
      cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, userMap),
      submittedAt: optionalDate(row.submittedAt, "Submitted at"),
      approvedAt: optionalDate(row.approvedAt, "Approved at"),
      lockedAt: optionalDate(row.lockedAt, "Locked at"),
      cancelledAt: optionalDate(row.cancelledAt, "Cancelled at")
    };
    if (byId) {
      dayMap.set(id, byId.id);
      const updated = optionalDate(row.updatedAt, "Cash day updated at");
      if (updated && byId.updatedAt > updated) { protectedDays.add(id); result.cashBookDays.skipped++; result.cashBookDays.warnings.push(`Cash day ${cashDate.toISOString().slice(0, 10)} kept because the local record is newer.`); }
      else { await client.cashBookDay.update({ where: { id }, data }); result.cashBookDays.updated++; }
    } else {
      const created = await client.cashBookDay.create({ data: { id, ...data, ...createdAtData(row, index, "cashBookDays") } });
      dayMap.set(id, created.id); result.cashBookDays.created++;
    }
  } catch (error) { result.cashBookDays.errors.push(rowError("Cash day", index, error)); }
  for (const [index, row] of backup.cashBookMovements.entries()) try { const id = requiredText(row.id, "Cash movement ID"), backupDayId = requiredText(row.cashBookDayId, "Cash day ID"), cashBookDayId = dayMap.get(backupDayId); if (!cashBookDayId || protectedDays.has(backupDayId)) { result.cashBookMovements.skipped++; result.warnings.push(`Cash movement ${index + 1} skipped because its exact cash day was unavailable or newer locally.`); continue; } const existing = await client.cashBookMovement.findUnique({ where: { id } }); if (existing) { result.cashBookMovements.skipped++; continue; } await client.cashBookMovement.create({ data: { id, cashBookDayId, movementType: requiredText(row.movementType, "Movement type"), amount: requiredText(row.amount, "Movement amount"), movementDate: requiredDate(row.movementDate, "Movement date"), referenceNumber: nullableText(row.referenceNumber), bankName: nullableText(row.bankName), recipientName: nullableText(row.recipientName), reason: requiredText(row.reason, "Movement reason"), notes: nullableText(row.notes), status: requiredText(row.status, "Movement status"), recordedByUserId: mapOptionalUserId(row.recordedByUserId, userMap), cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, userMap), cancelledAt: optionalDate(row.cancelledAt, "Cancelled at"), cancellationReason: nullableText(row.cancellationReason), ...createdAtData(row, index, "cashBookMovements") } }); result.cashBookMovements.created++; } catch (error) { result.cashBookMovements.errors.push(rowError("Cash movement", index, error)); }
}

export async function restoreBooksFinanceData(
  client: Pick<RestoreDatabaseClient, "bookCatalogItem" | "bookCatalogRate" | "bookSaleReceipt" | "bookSaleReceiptLine" | "bookCashSettlement" | "cashBookMovement">,
  backup: Pick<ValidatedBackup, "bookCatalogItems" | "bookCatalogRates" | "bookSaleReceipts" | "bookSaleReceiptLines" | "bookCashSettlements">,
  studentMap: Map<string, string>, userMap: Map<string, string>, vendorMap: Map<string, string>,
  result: Pick<RestoreResult, "bookCatalogItems" | "bookCatalogRates" | "bookSaleReceipts" | "bookSaleReceiptLines" | "bookCashSettlements" | "warnings">
) {
  const itemMap = new Map<string, string>(); const protectedItems = new Set<string>();
  for (const [index, row] of backup.bookCatalogItems.entries()) try {
    const id = requiredText(row.id, "Book catalog item ID"), itemCode = requiredText(row.itemCode, "Book item code");
    const byId = await client.bookCatalogItem.findUnique({ where: { id } }); const byCode = await client.bookCatalogItem.findUnique({ where: { itemCode } });
    if (byCode && byCode.id !== id) { result.bookCatalogItems.skipped++; result.warnings.push(`Book item ${itemCode} already exists with a different identity; dependent backup records were isolated.`); continue; }
    const publisherVendorId = nullableText(row.publisherVendorId) ? vendorMap.get(String(row.publisherVendorId)) : null;
    if (nullableText(row.publisherVendorId) && !publisherVendorId) { result.bookCatalogItems.skipped++; result.warnings.push(`Book item ${itemCode} skipped because its exact publisher vendor could not be matched.`); continue; }
    const data = { itemCode, title: requiredText(row.title, "Book title"), itemType: requiredText(row.itemType, "Book item type"), publisherVendorId, className: nullableText(row.className), subject: nullableText(row.subject), description: nullableText(row.description), studentLinkRequired: row.studentLinkRequired !== false, status: requiredText(row.status, "Book item status"), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap) };
    if (byId) { itemMap.set(id, byId.id); const updated = optionalDate(row.updatedAt, "Book item updated at"); if (updated && byId.updatedAt > updated) { protectedItems.add(id); result.bookCatalogItems.skipped++; result.bookCatalogItems.warnings.push(`Book item ${itemCode} kept because the local record is newer.`); } else { await client.bookCatalogItem.update({ where: { id }, data }); result.bookCatalogItems.updated++; } }
    else { const created = await client.bookCatalogItem.create({ data: { id, ...data, ...createdAtData(row, index, "bookCatalogItems") } }); itemMap.set(id, created.id); result.bookCatalogItems.created++; }
  } catch (error) { result.bookCatalogItems.errors.push(rowError("Book catalog item", index, error)); }
  const rateMap = new Map<string, string>();
  for (const [index, row] of backup.bookCatalogRates.entries()) try {
    const id = requiredText(row.id, "Book rate ID"), backupItemId = requiredText(row.itemId, "Book rate item ID"), itemId = itemMap.get(backupItemId);
    if (!itemId || protectedItems.has(backupItemId)) { result.bookCatalogRates.skipped++; result.warnings.push(`Book rate ${index + 1} skipped because its exact catalog item was unavailable or newer locally.`); continue; }
    const data = { itemId, academicYear: requiredText(row.academicYear, "Book rate academic year"), amount: requiredText(row.amount, "Book rate amount"), effectiveFrom: optionalDate(row.effectiveFrom, "Book rate effective from"), effectiveTo: optionalDate(row.effectiveTo, "Book rate effective to"), status: requiredText(row.status, "Book rate status"), notes: nullableText(row.notes) };
    const existing = await client.bookCatalogRate.findUnique({ where: { id } });
    if (existing) { rateMap.set(id, existing.id); const updated = optionalDate(row.updatedAt, "Book rate updated at"); if (updated && existing.updatedAt > updated) result.bookCatalogRates.skipped++; else { await client.bookCatalogRate.update({ where: { id }, data }); result.bookCatalogRates.updated++; } }
    else { const overlaps = data.status === "ACTIVE" ? await client.bookCatalogRate.findMany({ where: { itemId, academicYear: data.academicYear, status: "ACTIVE" }, select: { effectiveFrom: true, effectiveTo: true } }) : []; const from = data.effectiveFrom?.getTime() ?? -Infinity, to = data.effectiveTo?.getTime() ?? Infinity; if (overlaps.some((candidate) => from <= (candidate.effectiveTo?.getTime() ?? Infinity) && (candidate.effectiveFrom?.getTime() ?? -Infinity) <= to)) { result.bookCatalogRates.skipped++; result.warnings.push(`Book rate ${index + 1} skipped because it overlaps a local active rate.`); continue; } const created = await client.bookCatalogRate.create({ data: { id, ...data, ...createdAtData(row, index, "bookCatalogRates") } }); rateMap.set(id, created.id); result.bookCatalogRates.created++; }
  } catch (error) { result.bookCatalogRates.errors.push(rowError("Book catalog rate", index, error)); }
  const receiptMap = new Map<string, string>(); const protectedReceipts = new Set<string>();
  for (const [index, row] of backup.bookSaleReceipts.entries()) try {
    const id = requiredText(row.id, "Book receipt ID"), receiptNumber = requiredText(row.receiptNumber, "Book receipt number"); const byId = await client.bookSaleReceipt.findUnique({ where: { id } }); const byNumber = await client.bookSaleReceipt.findUnique({ where: { receiptNumber } });
    if (byNumber && byNumber.id !== id) { result.bookSaleReceipts.skipped++; result.warnings.push(`Book receipt ${receiptNumber} already exists with a different identity; backup lines were isolated.`); continue; }
    const backupStudentId = nullableText(row.studentId), studentId = backupStudentId ? studentMap.get(backupStudentId) : null; if (backupStudentId && !studentId) { result.bookSaleReceipts.skipped++; result.warnings.push(`Book receipt ${receiptNumber} skipped because its student link could not be matched.`); continue; }
    const data = { receiptNumber, receiptDate: requiredDate(row.receiptDate, "Book receipt date"), academicYear: requiredText(row.academicYear, "Book receipt academic year"), studentId, payerName: nullableText(row.payerName), paymentMethod: requiredText(row.paymentMethod, "Book payment method"), receivedAccount: nullableText(row.receivedAccount), transactionReference: nullableText(row.transactionReference), chequeNumber: nullableText(row.chequeNumber), chequeDate: optionalDate(row.chequeDate, "Book cheque date"), grossAmount: requiredText(row.grossAmount, "Book gross amount"), discountAmount: requiredText(row.discountAmount, "Book discount amount"), netAmount: requiredText(row.netAmount, "Book net amount"), status: requiredText(row.status, "Book receipt status"), remarks: nullableText(row.remarks), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap), cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, userMap), cancelledAt: optionalDate(row.cancelledAt, "Book receipt cancelled at"), cancellationReason: nullableText(row.cancellationReason) };
    if (byId) { receiptMap.set(id, byId.id); const updated = optionalDate(row.updatedAt, "Book receipt updated at"); if (updated && byId.updatedAt > updated) { protectedReceipts.add(id); result.bookSaleReceipts.skipped++; } else { await client.bookSaleReceipt.update({ where: { id }, data }); result.bookSaleReceipts.updated++; } }
    else { const created = await client.bookSaleReceipt.create({ data: { id, ...data, ...createdAtData(row, index, "bookSaleReceipts") } }); receiptMap.set(id, created.id); result.bookSaleReceipts.created++; }
  } catch (error) { result.bookSaleReceipts.errors.push(rowError("Book-sale receipt", index, error)); }
  for (const [index, row] of backup.bookSaleReceiptLines.entries()) try {
    const id = requiredText(row.id, "Book receipt line ID"), backupReceiptId = requiredText(row.receiptId, "Book receipt ID"), receiptId = receiptMap.get(backupReceiptId), itemId = itemMap.get(requiredText(row.itemId, "Book item ID")), backupRateId = nullableText(row.rateId), rateId = backupRateId ? rateMap.get(backupRateId) : null;
    if (!receiptId || protectedReceipts.has(backupReceiptId) || !itemId || (backupRateId && !rateId)) { result.bookSaleReceiptLines.skipped++; result.warnings.push(`Book receipt line ${index + 1} skipped because an exact parent, item, or rate link was unavailable.`); continue; }
    if (await client.bookSaleReceiptLine.findUnique({ where: { id } })) { result.bookSaleReceiptLines.skipped++; continue; }
    await client.bookSaleReceiptLine.create({ data: { id, receiptId, itemId, itemCodeSnapshot: requiredText(row.itemCodeSnapshot, "Book item-code snapshot"), itemTitleSnapshot: requiredText(row.itemTitleSnapshot, "Book title snapshot"), classNameSnapshot: nullableText(row.classNameSnapshot), publisherNameSnapshot: nullableText(row.publisherNameSnapshot), rateId, quantity: positiveInteger(row.quantity, "Book quantity"), unitAmount: requiredText(row.unitAmount, "Book unit amount"), discountAmount: requiredText(row.discountAmount, "Book discount amount"), lineTotal: requiredText(row.lineTotal, "Book line total"), notes: nullableText(row.notes), ...createdAtData(row, index, "bookSaleReceiptLines") } }); result.bookSaleReceiptLines.created++;
  } catch (error) { result.bookSaleReceiptLines.errors.push(rowError("Book-sale receipt line", index, error)); }
  for (const [index, row] of backup.bookCashSettlements.entries()) try {
    const id = requiredText(row.id, "Book settlement ID"), settlementDate = requiredDate(row.settlementDate, "Book settlement date"); const byId = await client.bookCashSettlement.findUnique({ where: { id } }); const byDate = await client.bookCashSettlement.findUnique({ where: { settlementDate } });
    if (byDate && byDate.id !== id) { result.bookCashSettlements.skipped++; result.warnings.push(`Book settlement ${settlementDate.toISOString().slice(0, 10)} already exists with a different identity.`); continue; }
    const backupMovementId = nullableText(row.cashBookMovementId); const movement = backupMovementId ? await client.cashBookMovement.findUnique({ where: { id: backupMovementId }, select: { id: true } }) : null; if (backupMovementId && !movement) { result.bookCashSettlements.skipped++; result.warnings.push(`Book settlement ${index + 1} skipped because its exact cash movement was unavailable.`); continue; }
    const data = { settlementDate, academicYear: requiredText(row.academicYear, "Book settlement academic year"), status: requiredText(row.status, "Book settlement status"), expectedBookCash: requiredText(row.expectedBookCash, "Expected book cash"), handedToDirectorAmount: requiredText(row.handedToDirectorAmount, "Director amount"), handedToCashCounterAmount: requiredText(row.handedToCashCounterAmount, "Cash counter amount"), retainedByBooksInchargeAmount: requiredText(row.retainedByBooksInchargeAmount, "Retained amount"), varianceAmount: requiredText(row.varianceAmount, "Settlement variance"), varianceReason: nullableText(row.varianceReason), booksInchargeName: nullableText(row.booksInchargeName), receiverName: nullableText(row.receiverName), cashBookMovementId: movement?.id ?? null, notes: nullableText(row.notes), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap), submittedByUserId: mapOptionalUserId(row.submittedByUserId, userMap), approvedByUserId: mapOptionalUserId(row.approvedByUserId, userMap), cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, userMap), submittedAt: optionalDate(row.submittedAt, "Settlement submitted at"), approvedAt: optionalDate(row.approvedAt, "Settlement approved at"), cancelledAt: optionalDate(row.cancelledAt, "Settlement cancelled at"), cancellationReason: nullableText(row.cancellationReason) };
    if (byId) { const updated = optionalDate(row.updatedAt, "Book settlement updated at"); if (updated && byId.updatedAt > updated) result.bookCashSettlements.skipped++; else { await client.bookCashSettlement.update({ where: { id }, data }); result.bookCashSettlements.updated++; } } else { await client.bookCashSettlement.create({ data: { id, ...data, ...createdAtData(row, index, "bookCashSettlements") } }); result.bookCashSettlements.created++; }
  } catch (error) { result.bookCashSettlements.errors.push(rowError("Book-cash settlement", index, error)); }
}

export async function restoreLibraryData(
  client: Pick<RestoreDatabaseClient, "libraryTitle" | "libraryCopy" | "libraryCopyEvent">,
  backup: Pick<ValidatedBackup, "libraryTitles" | "libraryCopies" | "libraryCopyEvents">,
  userMap: Map<string, string>, vendorMap: Map<string, string>, expenseMap: Map<string, string>,
  result: Pick<RestoreResult, "libraryTitles" | "libraryCopies" | "libraryCopyEvents" | "warnings">
) {
  const titleMap = new Map<string, string>(); const protectedTitles = new Set<string>();
  for (const [index, row] of backup.libraryTitles.entries()) try {
    const id = requiredText(row.id, "Library title ID"), titleCode = requiredText(row.titleCode, "Library title code"), isbn = nullableText(row.isbn);
    const byId = await client.libraryTitle.findUnique({ where: { id } }); const byCode = await client.libraryTitle.findUnique({ where: { titleCode } }); const byIsbn = isbn ? await client.libraryTitle.findUnique({ where: { isbn } }) : null;
    if ((byCode && byCode.id !== id) || (byIsbn && byIsbn.id !== id)) { result.libraryTitles.skipped++; result.warnings.push(`Library title ${titleCode} collided with a different local title code or ISBN identity; its dependent copies were isolated.`); continue; }
    const backupVendorId = nullableText(row.publisherVendorId), publisherVendorId = backupVendorId ? vendorMap.get(backupVendorId) : null;
    if (backupVendorId && !publisherVendorId) { result.libraryTitles.skipped++; result.warnings.push(`Library title ${titleCode} skipped because its exact Publisher Vendor identity was unavailable.`); continue; }
    const data = { titleCode, title: requiredText(row.title, "Library title"), subtitle: nullableText(row.subtitle), authors: requiredText(row.authors, "Library authors"), isbn, edition: nullableText(row.edition), publisherName: nullableText(row.publisherName), publisherVendorId, publicationYear: row.publicationYear == null ? null : Number(row.publicationYear), language: nullableText(row.language), subject: nullableText(row.subject), category: nullableText(row.category), classificationNumber: nullableText(row.classificationNumber), defaultShelfCode: nullableText(row.defaultShelfCode), description: nullableText(row.description), status: requiredText(row.status, "Library title status"), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap) };
    if (byId) { titleMap.set(id, byId.id); const backupUpdated = optionalDate(row.updatedAt, "Library title updated at"); if (backupUpdated && byId.updatedAt > backupUpdated) { protectedTitles.add(id); result.libraryTitles.skipped++; result.libraryTitles.warnings.push(`Library title ${titleCode} kept because the local record is newer.`); } else { await client.libraryTitle.update({ where: { id }, data }); result.libraryTitles.updated++; } }
    else { const created = await client.libraryTitle.create({ data: { id, ...data, ...createdAtData(row, index, "libraryTitles") } }); titleMap.set(id, created.id); result.libraryTitles.created++; }
  } catch (error) { result.libraryTitles.errors.push(rowError("Library title", index, error)); }

  const copyMap = new Map<string, string>(); const protectedCopies = new Set<string>();
  for (const [index, row] of backup.libraryCopies.entries()) try {
    const id = requiredText(row.id, "Library copy ID"), backupTitleId = requiredText(row.titleId, "Library copy title ID"), titleId = titleMap.get(backupTitleId), accessionNumber = requiredText(row.accessionNumber, "Accession number"), barcodeValue = nullableText(row.barcodeValue);
    if (!titleId) { result.libraryCopies.skipped++; result.warnings.push(`Library copy ${accessionNumber} skipped because its exact title identity was unavailable.`); continue; }
    const byId = await client.libraryCopy.findUnique({ where: { id } }); const byAccession = await client.libraryCopy.findUnique({ where: { accessionNumber } }); const byBarcode = barcodeValue ? await client.libraryCopy.findUnique({ where: { barcodeValue } }) : null;
    if ((byAccession && byAccession.id !== id) || (byBarcode && byBarcode.id !== id) || (byId && byId.accessionNumber !== accessionNumber)) { result.libraryCopies.skipped++; result.warnings.push(`Library copy ${accessionNumber} collided with a different local accession/barcode identity; its events were isolated.`); continue; }
    const backupVendorId = nullableText(row.vendorId), vendorId = backupVendorId ? vendorMap.get(backupVendorId) : null; const backupExpenseId = nullableText(row.expenseRecordId), expenseRecordId = backupExpenseId ? expenseMap.get(backupExpenseId) : null;
    if ((backupVendorId && !vendorId) || (backupExpenseId && !expenseRecordId)) { result.libraryCopies.skipped++; result.warnings.push(`Library copy ${accessionNumber} skipped because an exact Vendor or Expense identity was unavailable.`); continue; }
    const data = { titleId, barcodeValue, acquisitionDate: optionalDate(row.acquisitionDate, "Library acquisition date"), acquisitionType: requiredText(row.acquisitionType, "Library acquisition type"), acquisitionCost: nullableText(row.acquisitionCost), vendorId, expenseRecordId, donorName: nullableText(row.donorName), invoiceNumberSnapshot: nullableText(row.invoiceNumberSnapshot), condition: requiredText(row.condition, "Library copy condition"), status: requiredText(row.status, "Library copy status"), shelfCode: nullableText(row.shelfCode), notes: nullableText(row.notes), withdrawnDate: optionalDate(row.withdrawnDate, "Library withdrawal date"), withdrawalReason: nullableText(row.withdrawalReason), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap), updatedByUserId: mapOptionalUserId(row.updatedByUserId, userMap) };
    if (byId) { copyMap.set(id, byId.id); const backupUpdated = optionalDate(row.updatedAt, "Library copy updated at"); if (backupUpdated && byId.updatedAt > backupUpdated) { protectedCopies.add(id); result.libraryCopies.skipped++; result.libraryCopies.warnings.push(`Library copy ${accessionNumber} kept because the local record is newer.`); } else { await client.libraryCopy.update({ where: { id }, data }); result.libraryCopies.updated++; } }
    else { const created = await client.libraryCopy.create({ data: { id, accessionNumber, ...data, ...createdAtData(row, index, "libraryCopies") } }); copyMap.set(id, created.id); result.libraryCopies.created++; }
  } catch (error) { result.libraryCopies.errors.push(rowError("Library copy", index, error)); }

  for (const [index, row] of backup.libraryCopyEvents.entries()) try {
    const id = requiredText(row.id, "Library copy event ID"), backupCopyId = requiredText(row.copyId, "Library event copy ID"), copyId = copyMap.get(backupCopyId);
    if (!copyId) { result.libraryCopyEvents.skipped++; result.warnings.push(`Library event ${index + 1} skipped because its exact copy identity was unavailable.`); continue; }
    const existing = await client.libraryCopyEvent.findUnique({ where: { id } }); if (existing) { result.libraryCopyEvents.skipped++; continue; }
    await client.libraryCopyEvent.create({ data: { id, copyId, eventType: requiredText(row.eventType, "Library event type"), eventDate: requiredDate(row.eventDate, "Library event date"), previousStatus: nullableText(row.previousStatus), newStatus: nullableText(row.newStatus), previousCondition: nullableText(row.previousCondition), newCondition: nullableText(row.newCondition), previousShelfCode: nullableText(row.previousShelfCode), newShelfCode: nullableText(row.newShelfCode), reason: nullableText(row.reason), notes: nullableText(row.notes), recordedByUserId: mapOptionalUserId(row.recordedByUserId, userMap), ...createdAtData(row, index, "libraryCopyEvents") } }); result.libraryCopyEvents.created++;
  } catch (error) { result.libraryCopyEvents.errors.push(rowError("Library copy event", index, error)); }
}

export async function restoreLibraryCirculationData(
  client: RestoreDatabaseClient,
  backup: ValidatedBackup,
  studentMap: Map<string, string>,
  userMap: Map<string, string>,
  result: RestoreResult
) {
  const memberMap = new Map<string, string>();
  for (const [index, row] of backup.libraryMembers.entries()) try {
    const id = requiredText(row.id, "Library member ID"), memberCode = requiredText(row.memberCode, "Library member code");
    const byId = await client.libraryMember.findUnique({ where: { id } }); const byCode = await client.libraryMember.findUnique({ where: { memberCode } });
    if (byCode && byCode.id !== id) { result.libraryMembers.skipped++; result.warnings.push(`Library member ${memberCode} collided with a different local identity; its circulation history was isolated.`); continue; }
    const backupStudentId = nullableText(row.studentId), studentId = backupStudentId ? studentMap.get(backupStudentId) : null;
    const backupStaffId = nullableText(row.staffMemberId); let staffMemberId: string | null = null;
    if (backupStaffId) { const staffRow = backup.staffMembers.find((candidate) => candidate.id === backupStaffId); const staffCode = nullableText(staffRow?.staffCode); const staff = await client.staffMember.findFirst({ where: { OR: [{ id: backupStaffId }, ...(staffCode ? [{ staffCode }] : [])] }, select: { id: true } }); staffMemberId = staff?.id ?? null; }
    if ((backupStudentId && !studentId) || (backupStaffId && !staffMemberId)) { result.libraryMembers.skipped++; result.warnings.push(`Library member ${memberCode} skipped because its exact Student or StaffMember link was unavailable.`); continue; }
    const data = { memberCode, memberType: requiredText(row.memberType, "Library member type"), studentId, staffMemberId, status: requiredText(row.status, "Library member status"), joinedDate: requiredDate(row.joinedDate, "Library joined date"), suspendedUntil: optionalDate(row.suspendedUntil, "Library suspended until"), suspensionReason: nullableText(row.suspensionReason), notes: nullableText(row.notes), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap), updatedByUserId: mapOptionalUserId(row.updatedByUserId, userMap) };
    if (byId) { memberMap.set(id, byId.id); const updated = optionalDate(row.updatedAt, "Library member updated at"); if (updated && byId.updatedAt > updated) result.libraryMembers.skipped++; else { await client.libraryMember.update({ where: { id }, data }); result.libraryMembers.updated++; } }
    else { const created = await client.libraryMember.create({ data: { id, ...data, ...createdAtData(row, index, "libraryMembers") } }); memberMap.set(id, created.id); result.libraryMembers.created++; }
  } catch (error) { result.libraryMembers.errors.push(rowError("Library member", index, error)); }

  for (const [index, row] of backup.libraryPolicies.entries()) try {
    const id = requiredText(row.id, "Library policy ID"), policyCode = requiredText(row.policyCode, "Library policy code"); const byId = await client.libraryPolicy.findUnique({ where: { id } }); const byCode = await client.libraryPolicy.findUnique({ where: { policyCode } });
    if (byCode && byCode.id !== id) { result.libraryPolicies.skipped++; result.warnings.push(`Library policy ${policyCode} collided with a different local identity and was isolated.`); continue; }
    const data = { policyCode, name: requiredText(row.name, "Library policy name"), memberType: requiredText(row.memberType, "Library policy member type"), className: nullableText(row.className), staffType: nullableText(row.staffType), maxActiveLoans: positiveInteger(row.maxActiveLoans, "Library max loans"), loanPeriodDays: positiveInteger(row.loanPeriodDays, "Library loan days"), maxRenewals: nonNegativeInteger(row.maxRenewals, "Library max renewals"), renewalPeriodDays: positiveInteger(row.renewalPeriodDays, "Library renewal days"), reservationLimit: nonNegativeInteger(row.reservationLimit, "Library reservation limit"), status: requiredText(row.status, "Library policy status"), priority: nonNegativeInteger(row.priority, "Library policy priority"), notes: nullableText(row.notes), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap) };
    if (byId) { const updated = optionalDate(row.updatedAt, "Library policy updated at"); if (updated && byId.updatedAt > updated) result.libraryPolicies.skipped++; else { await client.libraryPolicy.update({ where: { id }, data }); result.libraryPolicies.updated++; } } else { await client.libraryPolicy.create({ data: { id, ...data, ...createdAtData(row, index, "libraryPolicies") } }); result.libraryPolicies.created++; }
  } catch (error) { result.libraryPolicies.errors.push(rowError("Library policy", index, error)); }

  const copyMap = new Map<string, { id: string; titleId: string }>(); for (const row of backup.libraryCopies) { const id = nullableText(row.id); if (!id) continue; const copy = await client.libraryCopy.findUnique({ where: { id }, select: { id: true, titleId: true } }); if (copy) copyMap.set(id, copy); }
  const loanMap = new Map<string, string>();
  for (const [index, row] of backup.libraryLoans.entries()) try {
    const id = requiredText(row.id, "Library loan ID"), loanNumber = requiredText(row.loanNumber, "Library loan number"), copy = copyMap.get(requiredText(row.copyId, "Library loan copy ID")), memberId = memberMap.get(requiredText(row.memberId, "Library loan member ID"));
    if (!copy || !memberId) { result.libraryLoans.skipped++; result.warnings.push(`Library loan ${loanNumber} skipped because an exact copy or member identity was unavailable.`); continue; }
    const byId = await client.libraryLoan.findUnique({ where: { id } }); const byNumber = await client.libraryLoan.findUnique({ where: { loanNumber } }); if (byNumber && byNumber.id !== id) { result.libraryLoans.skipped++; result.warnings.push(`Library loan ${loanNumber} collided with a different local identity; dependents were isolated.`); continue; }
    const status = requiredText(row.status, "Library loan status"); if (status === "ISSUED") { const active = await client.libraryLoan.findUnique({ where: { activeCopyKey: copy.id } }); if (active && active.id !== id) { result.libraryLoans.skipped++; result.warnings.push(`Library loan ${loanNumber} skipped to preserve active-copy uniqueness.`); continue; } }
    const data = { loanNumber, copyId: copy.id, memberId, status, activeCopyKey: status === "ISSUED" ? copy.id : null, issueDate: requiredDate(row.issueDate, "Library issue date"), dueDate: requiredDate(row.dueDate, "Library due date"), returnedDate: optionalDate(row.returnedDate, "Library returned date"), renewCount: nonNegativeInteger(row.renewCount, "Library renew count"), policyCodeSnapshot: requiredText(row.policyCodeSnapshot, "Library policy snapshot"), loanPeriodDaysSnapshot: positiveInteger(row.loanPeriodDaysSnapshot, "Library loan-days snapshot"), maxRenewalsSnapshot: nonNegativeInteger(row.maxRenewalsSnapshot, "Library max-renewals snapshot"), renewalPeriodDaysSnapshot: positiveInteger(row.renewalPeriodDaysSnapshot, "Library renewal-days snapshot"), issueConditionSnapshot: requiredText(row.issueConditionSnapshot, "Library issue condition"), returnConditionSnapshot: nullableText(row.returnConditionSnapshot), issueNotes: nullableText(row.issueNotes), returnNotes: nullableText(row.returnNotes), cancellationReason: nullableText(row.cancellationReason), issuedByUserId: mapOptionalUserId(row.issuedByUserId, userMap), returnedByUserId: mapOptionalUserId(row.returnedByUserId, userMap), cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, userMap) };
    if (byId) { loanMap.set(id, byId.id); const updated = optionalDate(row.updatedAt, "Library loan updated at"); if (updated && byId.updatedAt > updated) result.libraryLoans.skipped++; else { await client.libraryLoan.update({ where: { id }, data }); result.libraryLoans.updated++; } } else { const created = await client.libraryLoan.create({ data: { id, ...data, ...createdAtData(row, index, "libraryLoans") } }); loanMap.set(id, created.id); result.libraryLoans.created++; }
  } catch (error) { result.libraryLoans.errors.push(rowError("Library loan", index, error)); }

  const titleMap = new Map<string, string>(); for (const row of backup.libraryTitles) { const id = nullableText(row.id); if (id && await client.libraryTitle.findUnique({ where: { id }, select: { id: true } })) titleMap.set(id, id); }
  const reservationMap = new Map<string, string>();
  for (const [index, row] of backup.libraryReservations.entries()) try {
    const id = requiredText(row.id, "Library reservation ID"), reservationNumber = requiredText(row.reservationNumber, "Library reservation number"), titleId = titleMap.get(requiredText(row.titleId, "Library reservation title ID")), memberId = memberMap.get(requiredText(row.memberId, "Library reservation member ID")); if (!titleId || !memberId) { result.libraryReservations.skipped++; continue; }
    const byId = await client.libraryReservation.findUnique({ where: { id } }); const byNumber = await client.libraryReservation.findUnique({ where: { reservationNumber } }); if (byNumber && byNumber.id !== id) { result.libraryReservations.skipped++; result.warnings.push(`Library reservation ${reservationNumber} collided with a different local identity.`); continue; }
    const status = requiredText(row.status, "Library reservation status"), backupLoanId = nullableText(row.fulfilledLoanId), fulfilledLoanId = backupLoanId ? loanMap.get(backupLoanId) : null; if (backupLoanId && !fulfilledLoanId) { result.libraryReservations.skipped++; continue; }
    const key = `${memberId}:${titleId}`; if (status === "WAITING") { const active = await client.libraryReservation.findUnique({ where: { activeMemberTitleKey: key } }); if (active && active.id !== id) { result.libraryReservations.skipped++; continue; } }
    const data = { reservationNumber, titleId, memberId, status, activeMemberTitleKey: status === "WAITING" ? key : null, requestedDate: requiredDate(row.requestedDate, "Library requested date"), expiresDate: optionalDate(row.expiresDate, "Library expires date"), fulfilledLoanId, fulfilledAt: optionalDate(row.fulfilledAt, "Library fulfilled at"), cancelledAt: optionalDate(row.cancelledAt, "Library cancelled at"), cancellationReason: nullableText(row.cancellationReason), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap), fulfilledByUserId: mapOptionalUserId(row.fulfilledByUserId, userMap), cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, userMap) };
    if (byId) { reservationMap.set(id, byId.id); const updated = optionalDate(row.updatedAt, "Library reservation updated at"); if (updated && byId.updatedAt > updated) result.libraryReservations.skipped++; else { await client.libraryReservation.update({ where: { id }, data }); result.libraryReservations.updated++; } } else { const created = await client.libraryReservation.create({ data: { id, ...data, ...createdAtData(row, index, "libraryReservations") } }); reservationMap.set(id, created.id); result.libraryReservations.created++; }
  } catch (error) { result.libraryReservations.errors.push(rowError("Library reservation", index, error)); }

  for (const [index, row] of backup.libraryLoanEvents.entries()) try { const id = requiredText(row.id, "Library circulation event ID"); if (await client.libraryLoanEvent.findUnique({ where: { id } })) { result.libraryLoanEvents.skipped++; continue; } const memberId = memberMap.get(requiredText(row.memberId, "Library event member ID")), loanId = nullableText(row.loanId) ? loanMap.get(String(row.loanId)) : null, reservationId = nullableText(row.reservationId) ? reservationMap.get(String(row.reservationId)) : null, copy = nullableText(row.copyId) ? copyMap.get(String(row.copyId)) : null, titleId = nullableText(row.titleId) ? titleMap.get(String(row.titleId)) : null; if (!memberId || (hasValue(row.loanId) && !loanId) || (hasValue(row.reservationId) && !reservationId) || (hasValue(row.copyId) && !copy) || (hasValue(row.titleId) && !titleId)) { result.libraryLoanEvents.skipped++; continue; } await client.libraryLoanEvent.create({ data: { id, loanId, reservationId, memberId, copyId: copy?.id ?? null, titleId: titleId ?? null, eventType: requiredText(row.eventType, "Library event type"), eventDate: requiredDate(row.eventDate, "Library event date"), previousDueDate: optionalDate(row.previousDueDate, "Library previous due date"), newDueDate: optionalDate(row.newDueDate, "Library new due date"), reason: nullableText(row.reason), notes: nullableText(row.notes), recordedByUserId: mapOptionalUserId(row.recordedByUserId, userMap), ...createdAtData(row, index, "libraryLoanEvents") } }); result.libraryLoanEvents.created++; } catch (error) { result.libraryLoanEvents.errors.push(rowError("Library circulation event", index, error)); }
}

export async function restoreLibraryAccountabilityData(client: RestoreDatabaseClient, backup: ValidatedBackup, userMap: Map<string,string>, result: RestoreResult) {
  return restoreLibraryAccountabilityDataV21(client, backup, userMap, result);
}
async function restoreLibraryAccountabilityDataV21(client: RestoreDatabaseClient, backup: ValidatedBackup, userMap: Map<string,string>, result: RestoreResult) {
  for (const [index, row] of backup.libraryChargeRules.entries()) {
    try {
      const id = requiredText(row.id, "Library charge rule ID"); const ruleCode = requiredText(row.ruleCode, "Library charge rule code");
      const [byId, byCode] = await Promise.all([client.libraryChargeRule.findUnique({ where: { id } }), client.libraryChargeRule.findUnique({ where: { ruleCode } })]);
      if (byCode && byCode.id !== id) { result.libraryChargeRules.skipped++; result.warnings.push(`Library charge rule ${ruleCode} collided with a different local identity and was isolated.`); continue; }
      if (byId) { result.libraryChargeRules.skipped++; continue; }
      await client.libraryChargeRule.create({ data: { id, ruleCode, name: requiredText(row.name, "Rule name"), memberType: requiredText(row.memberType, "Rule member type"), className: nullableText(row.className), staffType: nullableText(row.staffType), graceDays: nonNegativeInteger(row.graceDays, "Grace days"), overdueAmountPerDay: requiredText(row.overdueAmountPerDay, "Overdue rate"), maximumOverdueAmount: nullableText(row.maximumOverdueAmount), lostChargeBasis: requiredText(row.lostChargeBasis, "Lost basis"), fixedLostAmount: nullableText(row.fixedLostAmount), damagedChargeBasis: requiredText(row.damagedChargeBasis, "Damaged basis"), fixedDamagedAmount: nullableText(row.fixedDamagedAmount), priority: nonNegativeInteger(row.priority, "Priority"), status: requiredText(row.status, "Rule status"), notes: nullableText(row.notes), createdByUserId: mapOptionalUserId(row.createdByUserId, userMap), ...createdAtData(row,index,"libraryChargeRules") } }); result.libraryChargeRules.created++;
    } catch (error) { result.libraryChargeRules.errors.push(rowError("Library charge rule", index, error)); }
  }
  const incidentMap = new Map<string,string>();
  for (const [index,row] of backup.libraryIncidents.entries()) {
    try {
      const id=requiredText(row.id,"Library incident ID"),incidentNumber=requiredText(row.incidentNumber,"Library incident number"); const [byId,byNumber]=await Promise.all([client.libraryIncident.findUnique({where:{id}}),client.libraryIncident.findUnique({where:{incidentNumber}})]);
      if(byNumber&&byNumber.id!==id){result.libraryIncidents.skipped++;result.warnings.push(`Library incident ${incidentNumber} collided with a different local identity; dependents were isolated.`);continue;} if(byId){incidentMap.set(id,id);result.libraryIncidents.skipped++;continue;}
      const [loan,member,copy,title]=await Promise.all([client.libraryLoan.findUnique({where:{id:requiredText(row.loanId,"Incident loan ID")}}),client.libraryMember.findUnique({where:{id:requiredText(row.memberId,"Incident member ID")}}),client.libraryCopy.findUnique({where:{id:requiredText(row.copyId,"Incident copy ID")}}),client.libraryTitle.findUnique({where:{id:requiredText(row.titleId,"Incident title ID")}})]);
      const replacementCopyId=nullableText(row.replacementCopyId); const replacement=replacementCopyId?await client.libraryCopy.findUnique({where:{id:replacementCopyId}}):null;
      if(!loan||!member||!copy||!title||loan.memberId!==member.id||loan.copyId!==copy.id||copy.titleId!==title.id||(replacementCopyId&&!replacement)){result.libraryIncidents.skipped++;result.warnings.push(`Library incident ${incidentNumber} skipped because exact links were unavailable.`);continue;}
      await client.libraryIncident.create({data:{id,incidentNumber,incidentType:requiredText(row.incidentType,"Incident type"),status:requiredText(row.status,"Incident status"),activeCaseKey:nullableText(row.activeCaseKey),loanId:loan.id,memberId:member.id,copyId:copy.id,titleId:title.id,reportedDate:requiredDate(row.reportedDate,"Reported date"),incidentCondition:nullableText(row.incidentCondition),description:requiredText(row.description,"Description"),assessmentNotes:nullableText(row.assessmentNotes),resolutionType:nullableText(row.resolutionType),replacementCopyId,resolvedDate:optionalDate(row.resolvedDate,"Resolved date"),resolutionNotes:nullableText(row.resolutionNotes),cancellationReason:nullableText(row.cancellationReason),createdByUserId:mapOptionalUserId(row.createdByUserId,userMap),submittedByUserId:mapOptionalUserId(row.submittedByUserId,userMap),approvedByUserId:mapOptionalUserId(row.approvedByUserId,userMap),resolvedByUserId:mapOptionalUserId(row.resolvedByUserId,userMap),cancelledByUserId:mapOptionalUserId(row.cancelledByUserId,userMap),submittedAt:optionalDate(row.submittedAt,"Submitted at"),approvedAt:optionalDate(row.approvedAt,"Approved at"),resolvedAt:optionalDate(row.resolvedAt,"Resolved at"),cancelledAt:optionalDate(row.cancelledAt,"Cancelled at"),...createdAtData(row,index,"libraryIncidents")}});incidentMap.set(id,id);result.libraryIncidents.created++;
    } catch(error){result.libraryIncidents.errors.push(rowError("Library incident",index,error));}
  }
  const chargeMap = new Map<string, string>();
  const backupReceiptById = new Map(backup.miscIncomeReceipts.map((row) => [String(row.id), row]));
  for (const [index, row] of backup.libraryCharges.entries()) {
    try {
      const id = requiredText(row.id, "Library charge ID");
      const chargeNumber = requiredText(row.chargeNumber, "Library charge number");
      const memberId = requiredText(row.memberId, "Charge member ID");
      const loanId = nullableText(row.loanId);
      const incidentBackupId = nullableText(row.incidentId);
      const miscIncomeReceiptId = nullableText(row.miscIncomeReceiptId);
      const [byId, byNumber] = await Promise.all([
        client.libraryCharge.findUnique({ where: { id } }),
        client.libraryCharge.findUnique({ where: { chargeNumber } })
      ]);
      if (byNumber && byNumber.id !== id) {
        result.libraryCharges.skipped++;
        result.warnings.push(`Library charge ${chargeNumber} collided with a different local identity; dependents were isolated.`);
        continue;
      }
      if (byId) {
        const sameIdentity = byId.chargeNumber === chargeNumber
          && byId.memberId === memberId
          && (byId.loanId ?? null) === loanId
          && (byId.incidentId ?? null) === incidentBackupId;
        if (sameIdentity) chargeMap.set(id, id);
        else result.warnings.push(`Library charge ${chargeNumber} reused a different local ID identity; dependents were isolated.`);
        result.libraryCharges.skipped++;
        continue;
      }

      const incidentId = incidentBackupId ? incidentMap.get(incidentBackupId) : null;
      const [member, loan, incident, receipt] = await Promise.all([
        client.libraryMember.findUnique({ where: { id: memberId } }),
        loanId ? client.libraryLoan.findUnique({ where: { id: loanId } }) : null,
        incidentId ? client.libraryIncident.findUnique({ where: { id: incidentId } }) : null,
        miscIncomeReceiptId
          ? client.miscIncomeReceipt.findUnique({
              where: { id: miscIncomeReceiptId },
              include: { lines: { include: { item: true } } }
            })
          : null
      ]);
      const expectedReceipt = miscIncomeReceiptId ? backupReceiptById.get(miscIncomeReceiptId) : null;
      const expectedItemCode = member?.studentId ? "LIB-STUDENT-CHARGE" : "LIB-STAFF-CHARGE";
      const receiptLine = receipt?.lines?.[0];
      const receiptMatches = !miscIncomeReceiptId || Boolean(
        receipt
        && expectedReceipt
        && receipt.receiptNumber === String(expectedReceipt.receiptNumber)
        && (receipt.studentId ?? null) === (member?.studentId ?? null)
        && receipt.lines.length === 1
        && receiptLine?.item?.itemCode === expectedItemCode
        && receiptLine.lineTotal.toFixed(2) === requiredText(row.payableAmount, "Payable amount")
        && receipt.netAmount.toFixed(2) === requiredText(row.payableAmount, "Payable amount")
      );
      const linksMatch = member
        && (!loanId || loan?.memberId === member.id)
        && (!incidentBackupId || (incident && incident.memberId === member.id && incident.loanId === loanId))
        && receiptMatches;
      if (!linksMatch) {
        result.libraryCharges.skipped++;
        result.warnings.push(`Library charge ${chargeNumber} skipped because exact links or receipt identity were unavailable.`);
        continue;
      }

      await client.libraryCharge.create({ data: {
        id,
        chargeNumber,
        chargeType: requiredText(row.chargeType, "Charge type"),
        status: requiredText(row.status, "Charge status"),
        activeOverdueLoanKey: nullableText(row.activeOverdueLoanKey),
        memberId: member.id,
        loanId,
        incidentId: incidentId ?? null,
        studentId: member.studentId,
        staffMemberId: member.staffMemberId,
        assessedDate: requiredDate(row.assessedDate, "Assessed date"),
        dueDate: optionalDate(row.dueDate, "Due date"),
        overdueDaysSnapshot: row.overdueDaysSnapshot == null ? null : nonNegativeInteger(row.overdueDaysSnapshot, "Overdue days"),
        ruleCodeSnapshot: nullableText(row.ruleCodeSnapshot),
        rateSnapshot: nullableText(row.rateSnapshot),
        originalAmount: requiredText(row.originalAmount, "Original amount"),
        waivedAmount: requiredText(row.waivedAmount, "Waived amount"),
        payableAmount: requiredText(row.payableAmount, "Payable amount"),
        assessmentReason: requiredText(row.assessmentReason, "Assessment reason"),
        waiverReason: nullableText(row.waiverReason),
        cancellationReason: nullableText(row.cancellationReason),
        miscIncomeReceiptId,
        approvedByUserId: mapOptionalUserId(row.approvedByUserId, userMap),
        waivedByUserId: mapOptionalUserId(row.waivedByUserId, userMap),
        collectedByUserId: mapOptionalUserId(row.collectedByUserId, userMap),
        cancelledByUserId: mapOptionalUserId(row.cancelledByUserId, userMap),
        createdByUserId: mapOptionalUserId(row.createdByUserId, userMap),
        approvedAt: optionalDate(row.approvedAt, "Approved at"),
        waivedAt: optionalDate(row.waivedAt, "Waived at"),
        collectedAt: optionalDate(row.collectedAt, "Collected at"),
        cancelledAt: optionalDate(row.cancelledAt, "Cancelled at"),
        ...createdAtData(row, index, "libraryCharges")
      } });
      chargeMap.set(id, id);
      result.libraryCharges.created++;
    } catch (error) {
      result.libraryCharges.errors.push(rowError("Library charge", index, error));
    }
  }
  for(const [index,row] of backup.libraryChargeEvents.entries()){
    try{const id=requiredText(row.id,"Library charge event ID");if(await client.libraryChargeEvent.findUnique({where:{id}})){result.libraryChargeEvents.skipped++;continue;}const backupChargeId=nullableText(row.chargeId),backupIncidentId=nullableText(row.incidentId),chargeId=backupChargeId?chargeMap.get(backupChargeId):null,incidentId=backupIncidentId?incidentMap.get(backupIncidentId):null;if((backupChargeId&&!chargeId)||(backupIncidentId&&!incidentId)||(!chargeId&&!incidentId)){result.libraryChargeEvents.skipped++;continue;}await client.libraryChargeEvent.create({data:{id,chargeId:chargeId??null,incidentId:incidentId??null,eventType:requiredText(row.eventType,"Event type"),eventDate:requiredDate(row.eventDate,"Event date"),previousStatus:nullableText(row.previousStatus),newStatus:nullableText(row.newStatus),amountSnapshot:nullableText(row.amountSnapshot),reason:nullableText(row.reason),notes:nullableText(row.notes),recordedByUserId:mapOptionalUserId(row.recordedByUserId,userMap),...createdAtData(row,index,"libraryChargeEvents")}});result.libraryChargeEvents.created++;}catch(error){result.libraryChargeEvents.errors.push(rowError("Library charge event",index,error));}
  }
}

export async function restoreLibraryStockVerificationData(client: RestoreDatabaseClient, backup: ValidatedBackup, userMap: Map<string,string>, result: RestoreResult) {
  const sessionMap=new Map<string,string>();const protectedSessions=new Set<string>();
  for(const [index,row] of backup.libraryStockVerificationSessions.entries())try{
    const id=requiredText(row.id,"Stock session ID"),sessionNumber=requiredText(row.sessionNumber,"Stock session number");const [byId,byNumber]=await Promise.all([client.libraryStockVerificationSession.findUnique({where:{id}}),client.libraryStockVerificationSession.findUnique({where:{sessionNumber}})]);
    if((byNumber&&byNumber.id!==id)||(byId&&byId.sessionNumber!==sessionNumber)){result.libraryStockVerificationSessions.skipped++;result.warnings.push(`Stock session ${sessionNumber} collided with a different local identity; its records and events were isolated.`);continue;}
    const titleIdFilter=nullableText(row.titleIdFilter);if(titleIdFilter&&!await client.libraryTitle.findUnique({where:{id:titleIdFilter},select:{id:true}})){result.libraryStockVerificationSessions.skipped++;result.warnings.push(`Stock session ${sessionNumber} was isolated because its exact title filter is unavailable.`);continue;}
    const data={sessionNumber,title:requiredText(row.title,"Stock session title"),academicYear:requiredText(row.academicYear,"Academic year"),verificationDate:requiredDate(row.verificationDate,"Verification date"),scopeType:requiredText(row.scopeType,"Scope type"),shelfCodeFilter:nullableText(row.shelfCodeFilter),titleIdFilter,categoryFilter:nullableText(row.categoryFilter),subjectFilter:nullableText(row.subjectFilter),status:requiredText(row.status,"Stock session status"),expectedCopyCount:nonNegativeInteger(row.expectedCopyCount,"Expected count"),verifiedCopyCount:nonNegativeInteger(row.verifiedCopyCount,"Verified count"),presentCount:nonNegativeInteger(row.presentCount,"Present count"),issuedOffsiteCount:nonNegativeInteger(row.issuedOffsiteCount,"Issued count"),knownRepairCount:nonNegativeInteger(row.knownRepairCount,"Repair count"),missingCount:nonNegativeInteger(row.missingCount,"Missing count"),misShelvedCount:nonNegativeInteger(row.misShelvedCount,"Mis-shelved count"),damagedCount:nonNegativeInteger(row.damagedCount,"Damaged count"),unexpectedCount:nonNegativeInteger(row.unexpectedCount,"Unexpected count"),unresolvedCount:nonNegativeInteger(row.unresolvedCount,"Unresolved count"),notes:nullableText(row.notes),cancellationReason:nullableText(row.cancellationReason),createdByUserId:mapOptionalUserId(row.createdByUserId,userMap),startedByUserId:mapOptionalUserId(row.startedByUserId,userMap),submittedByUserId:mapOptionalUserId(row.submittedByUserId,userMap),reviewedByUserId:mapOptionalUserId(row.reviewedByUserId,userMap),approvedByUserId:mapOptionalUserId(row.approvedByUserId,userMap),lockedByUserId:mapOptionalUserId(row.lockedByUserId,userMap),cancelledByUserId:mapOptionalUserId(row.cancelledByUserId,userMap),startedAt:optionalDate(row.startedAt,"Started at"),submittedAt:optionalDate(row.submittedAt,"Submitted at"),reviewedAt:optionalDate(row.reviewedAt,"Reviewed at"),approvedAt:optionalDate(row.approvedAt,"Approved at"),lockedAt:optionalDate(row.lockedAt,"Locked at"),cancelledAt:optionalDate(row.cancelledAt,"Cancelled at")};
    if(byId){sessionMap.set(id,id);const backupUpdated=optionalDate(row.updatedAt,"Stock session updated at");if(backupUpdated&&byId.updatedAt>backupUpdated){protectedSessions.add(id);result.libraryStockVerificationSessions.skipped++;result.libraryStockVerificationSessions.warnings.push(`Stock session ${sessionNumber} kept because the local record is newer.`);}else{await client.libraryStockVerificationSession.update({where:{id},data});result.libraryStockVerificationSessions.updated++;}}
    else{await client.libraryStockVerificationSession.create({data:{id,...data,...createdAtData(row,index,"libraryStockVerificationSessions")}});sessionMap.set(id,id);result.libraryStockVerificationSessions.created++;}
  }catch(error){result.libraryStockVerificationSessions.errors.push(rowError("Library stock session",index,error));}
  const recordMap=new Map<string,string>();
  for(const [index,row] of backup.libraryStockVerificationRecords.entries())try{
    const id=requiredText(row.id,"Stock record ID"),sessionId=sessionMap.get(requiredText(row.sessionId,"Stock record session ID")),copyId=requiredText(row.copyId,"Stock record copy ID");if(!sessionId||protectedSessions.has(sessionId)){result.libraryStockVerificationRecords.skipped++;continue;}const copy=await client.libraryCopy.findUnique({where:{id:copyId},select:{id:true,accessionNumber:true}});if(!copy||copy.accessionNumber!==requiredText(row.expectedAccessionNumberSnapshot,"Expected accession snapshot")){result.libraryStockVerificationRecords.skipped++;result.warnings.push(`Stock record ${index+1} was isolated because its exact local copy identity does not match the immutable snapshot.`);continue;}const existing=await client.libraryStockVerificationRecord.findUnique({where:{id}});const pair=await client.libraryStockVerificationRecord.findUnique({where:{sessionId_copyId:{sessionId,copyId}}});if((pair&&pair.id!==id)||(existing&&(existing.sessionId!==sessionId||existing.copyId!==copyId))){result.libraryStockVerificationRecords.skipped++;result.warnings.push(`Stock record ${index+1} collided with a different local session/copy identity.`);continue;}if(existing){recordMap.set(id,id);result.libraryStockVerificationRecords.skipped++;continue;}const appliedCopyEventId=nullableText(row.appliedCopyEventId);const appliedEvent=appliedCopyEventId?await client.libraryCopyEvent.findUnique({where:{id:appliedCopyEventId},select:{id:true,copyId:true}}):null;if(appliedCopyEventId&&(!appliedEvent||appliedEvent.copyId!==copyId)){result.libraryStockVerificationRecords.skipped++;result.warnings.push(`Applied stock record ${index+1} was isolated because its exact same-copy event is unavailable.`);continue;}
    await client.libraryStockVerificationRecord.create({data:{id,sessionId,copyId,expectedAccessionNumberSnapshot:requiredText(row.expectedAccessionNumberSnapshot,"Expected accession"),expectedBarcodeSnapshot:nullableText(row.expectedBarcodeSnapshot),expectedTitleSnapshot:requiredText(row.expectedTitleSnapshot,"Expected title"),expectedShelfCodeSnapshot:nullableText(row.expectedShelfCodeSnapshot),expectedStatusSnapshot:requiredText(row.expectedStatusSnapshot,"Expected status"),expectedConditionSnapshot:requiredText(row.expectedConditionSnapshot,"Expected condition"),expectedLoanStatusSnapshot:nullableText(row.expectedLoanStatusSnapshot),expectedBorrowerTypeSnapshot:nullableText(row.expectedBorrowerTypeSnapshot),expectedDueDateSnapshot:optionalDate(row.expectedDueDateSnapshot,"Expected due date"),observationStatus:requiredText(row.observationStatus,"Observation status"),observedAt:optionalDate(row.observedAt,"Observed at"),observedShelfCode:nullableText(row.observedShelfCode),observedCondition:nullableText(row.observedCondition),scanMethod:nullableText(row.scanMethod),observationNotes:nullableText(row.observationNotes),discrepancyReason:nullableText(row.discrepancyReason),resolutionStatus:requiredText(row.resolutionStatus,"Resolution status"),resolutionNotes:nullableText(row.resolutionNotes),appliedCopyEventId,observedByUserId:mapOptionalUserId(row.observedByUserId,userMap),reviewedByUserId:mapOptionalUserId(row.reviewedByUserId,userMap),appliedByUserId:mapOptionalUserId(row.appliedByUserId,userMap),...createdAtData(row,index,"libraryStockVerificationRecords")}});recordMap.set(id,id);result.libraryStockVerificationRecords.created++;
  }catch(error){result.libraryStockVerificationRecords.errors.push(rowError("Library stock record",index,error));}
  for(const [index,row] of backup.libraryStockVerificationScanEvents.entries())try{const id=requiredText(row.id,"Stock scan ID");if(await client.libraryStockVerificationScanEvent.findUnique({where:{id}})){result.libraryStockVerificationScanEvents.skipped++;continue;}const sessionId=sessionMap.get(requiredText(row.sessionId,"Stock scan session ID")),backupRecordId=nullableText(row.recordId),recordId=backupRecordId?recordMap.get(backupRecordId):null;if(!sessionId||protectedSessions.has(sessionId)||(backupRecordId&&!recordId)){result.libraryStockVerificationScanEvents.skipped++;continue;}await client.libraryStockVerificationScanEvent.create({data:{id,sessionId,recordId:recordId??null,normalizedInput:requiredText(row.normalizedInput,"Normalized scan input"),scanMethod:requiredText(row.scanMethod,"Scan method"),resultType:requiredText(row.resultType,"Scan result"),scannedAt:requiredDate(row.scannedAt,"Scanned at"),notes:nullableText(row.notes),recordedByUserId:mapOptionalUserId(row.recordedByUserId,userMap),...createdAtData(row,index,"libraryStockVerificationScanEvents")}});result.libraryStockVerificationScanEvents.created++;}catch(error){result.libraryStockVerificationScanEvents.errors.push(rowError("Library stock scan",index,error));}
  for(const [index,row] of backup.libraryStockVerificationEvents.entries())try{const id=requiredText(row.id,"Stock event ID");if(await client.libraryStockVerificationEvent.findUnique({where:{id}})){result.libraryStockVerificationEvents.skipped++;continue;}const sessionId=sessionMap.get(requiredText(row.sessionId,"Stock event session ID"));if(!sessionId||protectedSessions.has(sessionId)){result.libraryStockVerificationEvents.skipped++;continue;}await client.libraryStockVerificationEvent.create({data:{id,sessionId,eventType:requiredText(row.eventType,"Stock event type"),eventDate:requiredDate(row.eventDate,"Stock event date"),notes:nullableText(row.notes),recordedByUserId:mapOptionalUserId(row.recordedByUserId,userMap),...createdAtData(row,index,"libraryStockVerificationEvents")}});result.libraryStockVerificationEvents.created++;}catch(error){result.libraryStockVerificationEvents.errors.push(rowError("Library stock event",index,error));}
}

export async function restoreHomeworkData(
  client: RestoreDatabaseClient,
  backup: Pick<ValidatedBackup, "homeworkAssignments" | "homeworkAssignmentEvents" | "timetableSubjects">,
  userMap: Map<string, string>,
  result: Pick<RestoreResult, "homeworkAssignments" | "homeworkAssignmentEvents" | "warnings">
) {
  const assignmentMap = new Map<string, string>();
  const isolated = new Set<string>();
  const subjectMap = new Map<string, string>();
  for (const row of backup.timetableSubjects) {
    const backupId = nullableText(row.id), shortName = nullableText(row.shortName);
    if (!backupId || !shortName) continue;
    const local = await client.timetableSubject.findFirst({ where: { OR: [{ id: backupId }, { shortName }] }, select: { id: true, shortName: true } });
    if (local?.shortName === shortName) subjectMap.set(backupId, local.id);
  }
  for (const [index, row] of backup.homeworkAssignments.entries()) try {
    const id = requiredText(row.id, "Homework assignment ID"), assignmentNumber = requiredText(row.assignmentNumber, "Assignment number").trim().toUpperCase();
    const [byId, byNumber] = await Promise.all([client.homeworkAssignment.findUnique({ where: { id } }), client.homeworkAssignment.findUnique({ where: { assignmentNumber } })]);
    if ((byId && byId.assignmentNumber !== assignmentNumber) || (byNumber && byNumber.id !== id)) {
      isolated.add(id); result.homeworkAssignments.skipped++; result.warnings.push(`Homework ${assignmentNumber} collided with a different local ID or number; its events were isolated.`); continue;
    }
    const backupSubjectId = nullableText(row.timetableSubjectId), timetableSubjectId = backupSubjectId ? subjectMap.get(backupSubjectId) : null;
    if (backupSubjectId && !timetableSubjectId) { isolated.add(id); result.homeworkAssignments.skipped++; result.warnings.push(`Homework ${assignmentNumber} was isolated because its exact timetable subject could not be mapped.`); continue; }
    const data = {
      assignmentNumber, academicYear: requiredText(row.academicYear,"Academic year"), title: requiredText(row.title,"Homework title"), instructions: requiredText(row.instructions,"Homework instructions"), className: requiredText(row.className,"Homework class"), section: nullableText(row.section), subjectName: requiredText(row.subjectName,"Homework subject"), timetableSubjectId: timetableSubjectId ?? null,
      assignedDate: requiredDate(row.assignedDate,"Assigned date"), dueDate: optionalDate(row.dueDate,"Due date"), status: requiredText(row.status,"Homework status"), priority: requiredText(row.priority,"Homework priority"), resourceLink: nullableText(row.resourceLink), teacherNotes: nullableText(row.teacherNotes), publicNotes: nullableText(row.publicNotes), correctionReason: nullableText(row.correctionReason), cancellationReason: nullableText(row.cancellationReason),
      createdByUserId: mapOptionalUserId(row.createdByUserId,userMap), publishedByUserId: mapOptionalUserId(row.publishedByUserId,userMap), archivedByUserId: mapOptionalUserId(row.archivedByUserId,userMap), cancelledByUserId: mapOptionalUserId(row.cancelledByUserId,userMap), publishedAt: optionalDate(row.publishedAt,"Published at"), archivedAt: optionalDate(row.archivedAt,"Archived at"), cancelledAt: optionalDate(row.cancelledAt,"Cancelled at")
    };
    if (byId) {
      assignmentMap.set(id, id); const backupUpdated = optionalDate(row.updatedAt,"Homework updated at");
      if (backupUpdated && byId.updatedAt > backupUpdated) { result.homeworkAssignments.skipped++; result.homeworkAssignments.warnings.push(`Homework ${assignmentNumber} kept because the local record is newer.`); }
      else { await client.homeworkAssignment.update({ where: { id }, data }); result.homeworkAssignments.updated++; }
    } else { await client.homeworkAssignment.create({ data: { id, ...data, ...createdAtData(row,index,"homeworkAssignments") } }); assignmentMap.set(id,id); result.homeworkAssignments.created++; }
  } catch (error) { result.homeworkAssignments.errors.push(rowError("Homework assignment",index,error)); }

  for (const [index,row] of backup.homeworkAssignmentEvents.entries()) try {
    const id=requiredText(row.id,"Homework event ID"), backupAssignmentId=requiredText(row.assignmentId,"Homework event assignment ID"), assignmentId=assignmentMap.get(backupAssignmentId);
    if (!assignmentId || isolated.has(backupAssignmentId)) { result.homeworkAssignmentEvents.skipped++; continue; }
    if (await client.homeworkAssignmentEvent.findUnique({ where: { id } })) { result.homeworkAssignmentEvents.skipped++; continue; }
    await client.homeworkAssignmentEvent.create({ data: { id, assignmentId, eventType: requiredText(row.eventType,"Homework event type"), eventDate: requiredDate(row.eventDate,"Homework event date"), titleSnapshot: nullableText(row.titleSnapshot), instructionsSnapshot: nullableText(row.instructionsSnapshot), dueDateSnapshot: optionalDate(row.dueDateSnapshot,"Homework due-date snapshot"), reason: nullableText(row.reason), notes: nullableText(row.notes), recordedByUserId: mapOptionalUserId(row.recordedByUserId,userMap), ...createdAtData(row,index,"homeworkAssignmentEvents") } });
    result.homeworkAssignmentEvents.created++;
  } catch (error) { result.homeworkAssignmentEvents.errors.push(rowError("Homework event",index,error)); }
}

export async function restoreExamMarksData(
  client: RestoreDatabaseClient,
  backup: Pick<ValidatedBackup, "examCycles" | "examAssessments" | "studentMarks" | "studentMarkEvents" | "timetableSubjects">,
  studentMap: Map<string, string>, userMap: Map<string, string>,
  result: Pick<RestoreResult, "examCycles" | "examAssessments" | "studentMarks" | "studentMarkEvents" | "warnings">
) {
  const examMap=new Map<string,string>(),isolatedExams=new Set<string>();
  for(const [index,row] of backup.examCycles.entries())try{
    const id=requiredText(row.id,"Exam ID"),examCode=requiredText(row.examCode,"Exam code").trim().toUpperCase();const [byId,byCode]=await Promise.all([client.examCycle.findUnique({where:{id}}),client.examCycle.findUnique({where:{examCode}})]);
    if((byId&&byId.examCode!==examCode)||(byCode&&byCode.id!==id)){isolatedExams.add(id);result.examCycles.skipped++;result.warnings.push(`Exam ${examCode} collided with a different local identity; its assessments, marks, and events were isolated.`);continue;}
    const data={examCode,academicYear:requiredText(row.academicYear,"Exam academic year"),name:requiredText(row.name,"Exam name"),examType:requiredText(row.examType,"Exam type"),startDate:requiredDate(row.startDate,"Exam start date"),endDate:requiredDate(row.endDate,"Exam end date"),status:requiredText(row.status,"Exam status"),description:nullableText(row.description),cancellationReason:nullableText(row.cancellationReason),createdByUserId:mapOptionalUserId(row.createdByUserId,userMap),openedByUserId:mapOptionalUserId(row.openedByUserId,userMap),closedByUserId:mapOptionalUserId(row.closedByUserId,userMap),approvedByUserId:mapOptionalUserId(row.approvedByUserId,userMap),lockedByUserId:mapOptionalUserId(row.lockedByUserId,userMap),cancelledByUserId:mapOptionalUserId(row.cancelledByUserId,userMap),openedAt:optionalDate(row.openedAt,"Exam opened at"),closedAt:optionalDate(row.closedAt,"Exam closed at"),approvedAt:optionalDate(row.approvedAt,"Exam approved at"),lockedAt:optionalDate(row.lockedAt,"Exam locked at"),cancelledAt:optionalDate(row.cancelledAt,"Exam cancelled at")};
    if(byId){examMap.set(id,id);const backupUpdated=optionalDate(row.updatedAt,"Exam updated at");if(byId.status==="LOCKED"||(backupUpdated&&byId.updatedAt>backupUpdated)){result.examCycles.skipped++;result.examCycles.warnings.push(`Exam ${examCode} kept because the local locked/newer snapshot is authoritative.`);}else{await client.examCycle.update({where:{id},data});result.examCycles.updated++;}}
    else{await client.examCycle.create({data:{id,...data,...createdAtData(row,index,"examCycles")}});examMap.set(id,id);result.examCycles.created++;}
  }catch(error){result.examCycles.errors.push(rowError("Exam cycle",index,error));}

  const subjectMap=new Map<string,string>();for(const row of backup.timetableSubjects){const backupId=nullableText(row.id),shortName=nullableText(row.shortName);if(!backupId||!shortName)continue;const local=await client.timetableSubject.findFirst({where:{OR:[{id:backupId},{shortName}]},select:{id:true,shortName:true}});if(local?.shortName===shortName)subjectMap.set(backupId,local.id);}
  const assessmentMap=new Map<string,string>(),isolatedAssessments=new Set<string>();
  for(const [index,row] of backup.examAssessments.entries())try{
    const id=requiredText(row.id,"Assessment ID"),backupExamId=requiredText(row.examCycleId,"Assessment exam ID"),examCycleId=examMap.get(backupExamId);if(!examCycleId||isolatedExams.has(backupExamId)){isolatedAssessments.add(id);result.examAssessments.skipped++;continue;}const className=requiredText(row.className,"Assessment class"),section=textOr(row.section,""),subjectName=requiredText(row.subjectName,"Assessment subject"),componentName=textOr(row.componentName,"");
    const [byId,byKey]=await Promise.all([client.examAssessment.findUnique({where:{id}}),client.examAssessment.findUnique({where:{examCycleId_className_section_subjectName_componentName:{examCycleId,className,section,subjectName,componentName}}})]);if((byId&&(byId.examCycleId!==examCycleId||byId.className!==className||byId.section!==section||byId.subjectName!==subjectName||byId.componentName!==componentName))||(byKey&&byKey.id!==id)){isolatedAssessments.add(id);result.examAssessments.skipped++;result.warnings.push(`Assessment ${className}-${section||"Class-wide"} ${subjectName} ${componentName||"Main"} collided with another local identity; its marks were isolated.`);continue;}
    const backupSubjectId=nullableText(row.timetableSubjectId),timetableSubjectId=backupSubjectId?subjectMap.get(backupSubjectId):null;if(backupSubjectId&&!timetableSubjectId){isolatedAssessments.add(id);result.examAssessments.skipped++;result.warnings.push(`Assessment ${id} was isolated because its exact timetable subject could not be mapped.`);continue;}
    const data={examCycleId,academicYear:requiredText(row.academicYear,"Assessment academic year"),className,section,subjectName,timetableSubjectId:timetableSubjectId??null,componentName,assessmentType:requiredText(row.assessmentType,"Assessment type"),maxMarks:requiredText(row.maxMarks,"Maximum marks"),passMarks:nullableText(row.passMarks),weightagePercent:nullableText(row.weightagePercent),entryStatus:requiredText(row.entryStatus,"Assessment status"),instructions:nullableText(row.instructions),createdByUserId:mapOptionalUserId(row.createdByUserId,userMap),submittedByUserId:mapOptionalUserId(row.submittedByUserId,userMap),approvedByUserId:mapOptionalUserId(row.approvedByUserId,userMap),lockedByUserId:mapOptionalUserId(row.lockedByUserId,userMap),submittedAt:optionalDate(row.submittedAt,"Assessment submitted at"),approvedAt:optionalDate(row.approvedAt,"Assessment approved at"),lockedAt:optionalDate(row.lockedAt,"Assessment locked at")};
    if(byId){assessmentMap.set(id,id);const backupUpdated=optionalDate(row.updatedAt,"Assessment updated at");if(byId.entryStatus==="LOCKED"||(backupUpdated&&byId.updatedAt>backupUpdated)){result.examAssessments.skipped++;result.examAssessments.warnings.push(`Assessment ${id} kept because the local locked/newer snapshot is authoritative.`);}else{await client.examAssessment.update({where:{id},data});result.examAssessments.updated++;}}
    else{await client.examAssessment.create({data:{id,...data,...createdAtData(row,index,"examAssessments")}});assessmentMap.set(id,id);result.examAssessments.created++;}
  }catch(error){result.examAssessments.errors.push(rowError("Exam assessment",index,error));}

  const markMap=new Map<string,string>();
  for(const [index,row] of backup.studentMarks.entries())try{
    const id=requiredText(row.id,"Student mark ID"),backupAssessmentId=requiredText(row.assessmentId,"Student mark assessment ID"),assessmentId=assessmentMap.get(backupAssessmentId),studentId=studentMap.get(requiredText(row.studentId,"Student mark Student ID"));if(!assessmentId||!studentId||isolatedAssessments.has(backupAssessmentId)){result.studentMarks.skipped++;continue;}const assessment=await client.examAssessment.findUnique({where:{id:assessmentId}});if(!assessment){result.studentMarks.skipped++;continue;}const enrollment=await client.academicYearEnrollment.findFirst({where:{studentId,academicYear:assessment.academicYear,className:assessment.className,...(assessment.section?{section:assessment.section}:{}),status:"ACTIVE"},select:{id:true}});if(!enrollment){result.studentMarks.skipped++;result.warnings.push(`Mark ${id} was isolated because the local active enrollment does not match the assessment.`);continue;}
    const [byId,byPair]=await Promise.all([client.studentMark.findUnique({where:{id}}),client.studentMark.findUnique({where:{assessmentId_studentId:{assessmentId,studentId}}})]);if((byId&&(byId.assessmentId!==assessmentId||byId.studentId!==studentId))||(byPair&&byPair.id!==id)){result.studentMarks.skipped++;result.warnings.push(`Mark ${id} collided with another local assessment/Student identity.`);continue;}const data={assessmentId,studentId,academicYear:requiredText(row.academicYear,"Mark academic year"),marksObtained:nullableText(row.marksObtained),entryStatus:requiredText(row.entryStatus,"Mark status"),remarks:nullableText(row.remarks),enteredByUserId:mapOptionalUserId(row.enteredByUserId,userMap),verifiedByUserId:mapOptionalUserId(row.verifiedByUserId,userMap),enteredAt:optionalDate(row.enteredAt,"Mark entered at"),verifiedAt:optionalDate(row.verifiedAt,"Mark verified at")};
    if(byId){markMap.set(id,id);if(assessment.entryStatus==="LOCKED"){result.studentMarks.skipped++;}else{const backupUpdated=optionalDate(row.updatedAt,"Mark updated at");if(backupUpdated&&byId.updatedAt>backupUpdated)result.studentMarks.skipped++;else{await client.studentMark.update({where:{id},data});result.studentMarks.updated++;}}}
    else{await client.studentMark.create({data:{id,...data,...createdAtData(row,index,"studentMarks")}});markMap.set(id,id);result.studentMarks.created++;}
  }catch(error){result.studentMarks.errors.push(rowError("Student mark",index,error));}

  for(const [index,row] of backup.studentMarkEvents.entries())try{const id=requiredText(row.id,"Mark event ID");if(await client.studentMarkEvent.findUnique({where:{id}})){result.studentMarkEvents.skipped++;continue;}const assessmentId=assessmentMap.get(requiredText(row.assessmentId,"Mark event assessment ID")),backupMarkId=nullableText(row.studentMarkId),studentMarkId=backupMarkId?markMap.get(backupMarkId):null;if(!assessmentId||(backupMarkId&&!studentMarkId)){result.studentMarkEvents.skipped++;continue;}await client.studentMarkEvent.create({data:{id,assessmentId,studentMarkId:studentMarkId??null,eventType:requiredText(row.eventType,"Mark event type"),previousMarks:nullableText(row.previousMarks),newMarks:nullableText(row.newMarks),previousEntryStatus:nullableText(row.previousEntryStatus),newEntryStatus:nullableText(row.newEntryStatus),reason:nullableText(row.reason),notes:nullableText(row.notes),actorLabel:nullableText(row.actorLabel),eventDate:requiredDate(row.eventDate,"Mark event date"),...createdAtData(row,index,"studentMarkEvents")}});result.studentMarkEvents.created++;}catch(error){result.studentMarkEvents.errors.push(rowError("Student mark event",index,error));}
}

export async function restoreReportCardData(
  client: RestoreDatabaseClient,
  backup: Pick<ValidatedBackup, "gradingSchemes" | "gradeBands" | "reportCardTemplates" | "reportCardBatches" | "reportCardBatchExamSources" | "studentReportCards" | "studentReportCardVersions" | "studentReportCardEvents">,
  backupStudentLocalIds: Map<string, string>,
  result: Pick<RestoreResult, "gradingSchemes" | "gradeBands" | "reportCardTemplates" | "reportCardBatches" | "reportCardBatchExamSources" | "studentReportCards" | "studentReportCardVersions" | "studentReportCardEvents" | "warnings">
) {
  const schemeMap = new Map<string, string>();
  for (const [index, row] of backup.gradingSchemes.entries()) try {
    const id = requiredText(row.id, "Grading scheme ID"), schemeCode = requiredText(row.schemeCode, "Grading scheme code");
    const [byId, byCode] = await Promise.all([client.gradingScheme.findUnique({ where: { id } }), client.gradingScheme.findUnique({ where: { schemeCode } })]);
    if ((byId && byId.schemeCode !== schemeCode) || (byCode && byCode.id !== id)) { result.gradingSchemes.skipped++; result.warnings.push(`Grading scheme ${schemeCode} collided with a different local identity; dependent report-card data was isolated.`); continue; }
    if (byId) { schemeMap.set(id, id); result.gradingSchemes.skipped++; continue; }
    await client.gradingScheme.create({ data: { id, schemeCode, name: requiredText(row.name, "Grading scheme name"), academicYear: nullableText(row.academicYear), reportType: requiredText(row.reportType, "Report type"), status: requiredText(row.status, "Grading scheme status"), description: nullableText(row.description), createdByUserId: null, ...createdAtData(row, index, "gradingSchemes") } });
    schemeMap.set(id, id); result.gradingSchemes.created++;
  } catch (error) { result.gradingSchemes.errors.push(rowError("Grading scheme", index, error)); }

  for (const [index, row] of backup.gradeBands.entries()) try {
    const id = requiredText(row.id, "Grade band ID"), schemeId = schemeMap.get(requiredText(row.gradingSchemeId, "Grade band scheme ID")); if (!schemeId) { result.gradeBands.skipped++; continue; }
    if (await client.gradeBand.findUnique({ where: { id } })) { result.gradeBands.skipped++; continue; }
    const gradeCode = requiredText(row.gradeCode, "Grade code"); const existing = await client.gradeBand.findUnique({ where: { gradingSchemeId_gradeCode: { gradingSchemeId: schemeId, gradeCode } } });
    if (existing) { result.gradeBands.skipped++; result.warnings.push(`Grade band ${gradeCode} was isolated because the local scheme already uses that code.`); continue; }
    await client.gradeBand.create({ data: { id, gradingSchemeId: schemeId, gradeCode, label: requiredText(row.label, "Grade label"), minimumPercentage: requiredText(row.minimumPercentage, "Minimum percentage"), maximumPercentage: nullableText(row.maximumPercentage), displayOrder: positiveInteger(row.displayOrder, "Display order"), remarks: nullableText(row.remarks), ...createdAtData(row, index, "gradeBands") } }); result.gradeBands.created++;
  } catch (error) { result.gradeBands.errors.push(rowError("Grade band", index, error)); }

  const templateMap = new Map<string, string>();
  for (const [index, row] of backup.reportCardTemplates.entries()) try {
    const id=requiredText(row.id,"Report-card template ID"),templateCode=requiredText(row.templateCode,"Template code"),backupScheme=nullableText(row.gradingSchemeId),gradingSchemeId=backupScheme?schemeMap.get(backupScheme):null;
    if(backupScheme&&!gradingSchemeId){result.reportCardTemplates.skipped++;continue;}const [byId,byCode]=await Promise.all([client.reportCardTemplate.findUnique({where:{id}}),client.reportCardTemplate.findUnique({where:{templateCode}})]);if((byId&&byId.templateCode!==templateCode)||(byCode&&byCode.id!==id)){result.reportCardTemplates.skipped++;result.warnings.push(`Report-card template ${templateCode} collided with a different local identity; dependent batches were isolated.`);continue;}if(byId){templateMap.set(id,id);result.reportCardTemplates.skipped++;continue;}
    await client.reportCardTemplate.create({data:{id,templateCode,name:requiredText(row.name,"Template name"),reportType:requiredText(row.reportType,"Template report type"),academicYear:nullableText(row.academicYear),className:nullableText(row.className),gradingSchemeId:gradingSchemeId??null,status:requiredText(row.status,"Template status"),templateDefinitionJson:requiredText(row.templateDefinitionJson,"Template definition"),printSettingsJson:nullableText(row.printSettingsJson),versionNumber:positiveInteger(row.versionNumber,"Template version"),createdByUserId:null,activatedByUserId:null,...createdAtData(row,index,"reportCardTemplates")}});templateMap.set(id,id);result.reportCardTemplates.created++;
  }catch(error){result.reportCardTemplates.errors.push(rowError("Report-card template",index,error));}

  const batchMap=new Map<string,string>();
  for(const [index,row] of backup.reportCardBatches.entries())try{const id=requiredText(row.id,"Report-card batch ID"),batchNumber=requiredText(row.batchNumber,"Batch number"),templateId=templateMap.get(requiredText(row.templateId,"Batch template ID"));if(!templateId){result.reportCardBatches.skipped++;continue;}const [byId,byNumber]=await Promise.all([client.reportCardBatch.findUnique({where:{id}}),client.reportCardBatch.findUnique({where:{batchNumber}})]);if((byId&&byId.batchNumber!==batchNumber)||(byNumber&&byNumber.id!==id)){result.reportCardBatches.skipped++;result.warnings.push(`Report-card batch ${batchNumber} collided with a different local identity; cards and versions were isolated.`);continue;}if(byId){batchMap.set(id,id);result.reportCardBatches.skipped++;continue;}await client.reportCardBatch.create({data:{id,batchNumber,academicYear:requiredText(row.academicYear,"Batch academic year"),reportType:requiredText(row.reportType,"Batch report type"),templateId,className:requiredText(row.className,"Batch class"),section:nullableText(row.section),title:requiredText(row.title,"Batch title"),reportingPeriod:nullableText(row.reportingPeriod),status:requiredText(row.status,"Batch status"),templateSnapshotJson:requiredText(row.templateSnapshotJson,"Template snapshot"),cancellationReason:nullableText(row.cancellationReason),createdByUserId:null,openedByUserId:null,submittedByUserId:null,approvedByUserId:null,issuedByUserId:null,archivedByUserId:null,cancelledByUserId:null,openedAt:optionalDate(row.openedAt,"Batch opened at"),submittedAt:optionalDate(row.submittedAt,"Batch submitted at"),approvedAt:optionalDate(row.approvedAt,"Batch approved at"),issuedAt:optionalDate(row.issuedAt,"Batch issued at"),archivedAt:optionalDate(row.archivedAt,"Batch archived at"),cancelledAt:optionalDate(row.cancelledAt,"Batch cancelled at"),...createdAtData(row,index,"reportCardBatches")}});batchMap.set(id,id);result.reportCardBatches.created++;}catch(error){result.reportCardBatches.errors.push(rowError("Report-card batch",index,error));}

  for(const [index,row] of backup.reportCardBatchExamSources.entries())try{const id=requiredText(row.id,"Report-card exam source ID"),batchId=batchMap.get(requiredText(row.batchId,"Source batch ID")),examCycleId=requiredText(row.examCycleId,"Source exam ID");if(!batchId||!await client.examCycle.findUnique({where:{id:examCycleId}})){result.reportCardBatchExamSources.skipped++;continue;}if(await client.reportCardBatchExamSource.findUnique({where:{id}})){result.reportCardBatchExamSources.skipped++;continue;}const duplicate=await client.reportCardBatchExamSource.findUnique({where:{batchId_examCycleId:{batchId,examCycleId}}});if(duplicate){result.reportCardBatchExamSources.skipped++;continue;}await client.reportCardBatchExamSource.create({data:{id,batchId,examCycleId,weightagePercent:nullableText(row.weightagePercent),displayOrder:positiveInteger(row.displayOrder,"Source order"),...createdAtData(row,index,"reportCardBatchExamSources")}});result.reportCardBatchExamSources.created++;}catch(error){result.reportCardBatchExamSources.errors.push(rowError("Report-card exam source",index,error));}

  const cardMap=new Map<string,string>();
  for(const [index,row] of backup.studentReportCards.entries())try{const id=requiredText(row.id,"Student report-card ID"),number=requiredText(row.reportCardNumber,"Report-card number"),batchId=batchMap.get(requiredText(row.batchId,"Card batch ID")),studentId=backupStudentLocalIds.get(requiredText(row.studentId,"Card Student ID"));if(!batchId||!studentId){result.studentReportCards.skipped++;continue;}const [byId,byNumber]=await Promise.all([client.studentReportCard.findUnique({where:{id}}),client.studentReportCard.findUnique({where:{reportCardNumber:number}})]);if((byId&&byId.reportCardNumber!==number)||(byNumber&&byNumber.id!==id)){result.studentReportCards.skipped++;result.warnings.push(`Student report card ${number} collided with a different local identity; versions and events were isolated.`);continue;}if(byId){cardMap.set(id,id);result.studentReportCards.skipped++;continue;}const progressionBackupId=nullableText(row.progressionDecisionId);let progressionDecisionId:string|null=null;if(progressionBackupId){const decision=await client.studentProgressionDecision.findUnique({where:{id:progressionBackupId}});if(decision?.studentId===studentId)progressionDecisionId=decision.id;else result.warnings.push(`Report card ${number} restored without its progression reference because no exact safe match exists.`);}await client.studentReportCard.create({data:{id,reportCardNumber:number,batchId,studentId,academicYear:requiredText(row.academicYear,"Card academic year"),className:requiredText(row.className,"Card class"),section:nullableText(row.section),reportType:requiredText(row.reportType,"Card report type"),status:requiredText(row.status,"Card status"),currentVersionNumber:nonNegativeInteger(row.currentVersionNumber,"Current version"),draftDataJson:requiredText(row.draftDataJson,"Card draft data"),teacherOverallComment:nullableText(row.teacherOverallComment),principalComment:nullableText(row.principalComment),directorComment:nullableText(row.directorComment),finalGrade:nullableText(row.finalGrade),progressionDecisionId,promotionDisplayText:nullableText(row.promotionDisplayText),cancellationReason:nullableText(row.cancellationReason),createdByUserId:null,submittedByUserId:null,approvedByUserId:null,issuedByUserId:null,cancelledByUserId:null,submittedAt:optionalDate(row.submittedAt,"Card submitted at"),approvedAt:optionalDate(row.approvedAt,"Card approved at"),issuedAt:optionalDate(row.issuedAt,"Card issued at"),cancelledAt:optionalDate(row.cancelledAt,"Card cancelled at"),...createdAtData(row,index,"studentReportCards")}});cardMap.set(id,id);result.studentReportCards.created++;}catch(error){result.studentReportCards.errors.push(rowError("Student report card",index,error));}

  const versionMap=new Map<string,string>();
  for(const [index,row] of backup.studentReportCardVersions.entries())try{const id=requiredText(row.id,"Report-card version ID"),reportCardId=cardMap.get(requiredText(row.reportCardId,"Version card ID"));if(!reportCardId){result.studentReportCardVersions.skipped++;continue;}const number=positiveInteger(row.versionNumber,"Version number"),byId=await client.studentReportCardVersion.findUnique({where:{id}}),byNumber=await client.studentReportCardVersion.findUnique({where:{reportCardId_versionNumber:{reportCardId,versionNumber:number}}});if((byId&&(byId.reportCardId!==reportCardId||byId.versionNumber!==number))||(byNumber&&byNumber.id!==id)){result.studentReportCardVersions.skipped++;result.warnings.push(`Report-card version ${number} was isolated because its identity differs locally.`);continue;}if(byId){versionMap.set(id,id);result.studentReportCardVersions.skipped++;continue;}const backupSupersedes=nullableText(row.supersedesVersionId),supersedesVersionId=backupSupersedes?versionMap.get(backupSupersedes):null;if(backupSupersedes&&!supersedesVersionId){result.studentReportCardVersions.skipped++;continue;}await client.studentReportCardVersion.create({data:{id,reportCardId,versionNumber:number,versionType:requiredText(row.versionType,"Version type"),snapshotJson:requiredText(row.snapshotJson,"Issued snapshot"),correctionReason:nullableText(row.correctionReason),issuedAt:requiredDate(row.issuedAt,"Version issued at"),issuedByUserId:null,supersedesVersionId:supersedesVersionId??null,...createdAtData(row,index,"studentReportCardVersions")}});versionMap.set(id,id);result.studentReportCardVersions.created++;}catch(error){result.studentReportCardVersions.errors.push(rowError("Student report-card version",index,error));}

  for(const [index,row] of backup.studentReportCardEvents.entries())try{const id=requiredText(row.id,"Report-card event ID"),reportCardId=cardMap.get(requiredText(row.reportCardId,"Event card ID")),backupVersionId=nullableText(row.versionId),versionId=backupVersionId?versionMap.get(backupVersionId):null;if(!reportCardId||(backupVersionId&&!versionId)){result.studentReportCardEvents.skipped++;continue;}if(await client.studentReportCardEvent.findUnique({where:{id}})){result.studentReportCardEvents.skipped++;continue;}await client.studentReportCardEvent.create({data:{id,reportCardId,versionId:versionId??null,eventType:requiredText(row.eventType,"Report-card event type"),eventDate:requiredDate(row.eventDate,"Event date"),previousStatus:nullableText(row.previousStatus),newStatus:nullableText(row.newStatus),reason:nullableText(row.reason),notes:nullableText(row.notes),recordedByUserId:null,actorLabel:nullableText(row.actorLabel),...createdAtData(row,index,"studentReportCardEvents")}});result.studentReportCardEvents.created++;}catch(error){result.studentReportCardEvents.errors.push(rowError("Student report-card event",index,error));}
}

export async function restoreTeacherAnalyticsData(
  client: RestoreDatabaseClient,
  backup: Pick<ValidatedBackup, "staffMembers" | "teacherAnalyticsReviewCycles" | "teacherAnalyticsSnapshots" | "teacherAnalyticsReviews" | "teacherAnalyticsEvents">,
  result: Pick<RestoreResult, "teacherAnalyticsReviewCycles" | "teacherAnalyticsSnapshots" | "teacherAnalyticsReviews" | "teacherAnalyticsEvents" | "warnings">
) {
  const cycleMap = new Map<string, string>();
  for (const [index, row] of backup.teacherAnalyticsReviewCycles.entries()) try {
    const id=requiredText(row.id,"Analytics cycle ID"),cycleCode=requiredText(row.cycleCode,"Analytics cycle code");
    const [byId,byCode]=await Promise.all([client.teacherAnalyticsReviewCycle.findUnique({where:{id}}),client.teacherAnalyticsReviewCycle.findUnique({where:{cycleCode}})]);
    if((byId&&byId.cycleCode!==cycleCode)||(byCode&&byCode.id!==id)){result.teacherAnalyticsReviewCycles.skipped++;result.warnings.push(`Teacher analytics cycle ${cycleCode} collided with a different local identity; dependent snapshots were isolated.`);continue;}
    if(byId){cycleMap.set(id,id);result.teacherAnalyticsReviewCycles.skipped++;continue;}
    await client.teacherAnalyticsReviewCycle.create({data:{id,cycleCode,academicYear:requiredText(row.academicYear,"Analytics academic year"),title:requiredText(row.title,"Analytics title"),periodStart:requiredDate(row.periodStart,"Analytics start"),periodEnd:requiredDate(row.periodEnd,"Analytics end"),status:requiredText(row.status,"Analytics status"),minimumStudentCohort:positiveInteger(row.minimumStudentCohort,"Minimum cohort"),metricDefinitionVersion:requiredText(row.metricDefinitionVersion,"Metric version"),notes:nullableText(row.notes),cancellationReason:nullableText(row.cancellationReason),createdByUserId:null,openedByUserId:null,finalisedByUserId:null,archivedByUserId:null,cancelledByUserId:null,openedAt:optionalDate(row.openedAt,"Analytics opened at"),finalisedAt:optionalDate(row.finalisedAt,"Analytics finalised at"),archivedAt:optionalDate(row.archivedAt,"Analytics archived at"),cancelledAt:optionalDate(row.cancelledAt,"Analytics cancelled at"),...createdAtData(row,index,"teacherAnalyticsReviewCycles")}});
    cycleMap.set(id,id);result.teacherAnalyticsReviewCycles.created++;
  }catch(error){result.teacherAnalyticsReviewCycles.errors.push(rowError("Teacher analytics cycle",index,error));}

  const snapshotMap=new Map<string,string>();
  for(const [index,row] of backup.teacherAnalyticsSnapshots.entries())try{
    const id=requiredText(row.id,"Analytics snapshot ID"),cycleId=cycleMap.get(requiredText(row.reviewCycleId,"Snapshot cycle ID"));if(!cycleId){result.teacherAnalyticsSnapshots.skipped++;continue;}
    const backupStaffId=requiredText(row.staffMemberId,"Snapshot StaffMember ID"),staffBackup=backup.staffMembers.find((item)=>String(item.id)===backupStaffId),staffCode=nullableText(staffBackup?.staffCode);
    const staff=await client.staffMember.findFirst({where:{OR:[{id:backupStaffId},...(staffCode?[{staffCode}]:[])]},select:{id:true}});
    if(!staff){result.teacherAnalyticsSnapshots.skipped++;result.warnings.push(`Teacher analytics snapshot ${id} was isolated because its exact StaffMember link was unavailable.`);continue;}
    const [byId,byCycleStaff]=await Promise.all([client.teacherAnalyticsSnapshot.findUnique({where:{id}}),client.teacherAnalyticsSnapshot.findUnique({where:{reviewCycleId_staffMemberId:{reviewCycleId:cycleId,staffMemberId:staff.id}}})]);
    if((byId&&(byId.reviewCycleId!==cycleId||byId.staffMemberId!==staff.id))||(byCycleStaff&&byCycleStaff.id!==id)){result.teacherAnalyticsSnapshots.skipped++;result.warnings.push(`Teacher analytics snapshot ${id} collided with preserved local history and was isolated.`);continue;}
    if(byId){snapshotMap.set(id,id);result.teacherAnalyticsSnapshots.skipped++;continue;}
    await client.teacherAnalyticsSnapshot.create({data:{id,reviewCycleId:cycleId,staffMemberId:staff.id,academicYear:requiredText(row.academicYear,"Snapshot academic year"),metricDefinitionVersion:requiredText(row.metricDefinitionVersion,"Snapshot metric version"),sourceCalculatedAt:requiredDate(row.sourceCalculatedAt,"Snapshot calculated at"),workloadJson:requiredText(row.workloadJson,"Workload JSON"),attendanceJson:requiredText(row.attendanceJson,"Attendance JSON"),leaveJson:requiredText(row.leaveJson,"Leave JSON"),substituteJson:requiredText(row.substituteJson,"Substitute JSON"),homeworkJson:requiredText(row.homeworkJson,"Homework JSON"),assessmentWorkflowJson:requiredText(row.assessmentWorkflowJson,"Assessment JSON"),studentOutcomeJson:requiredText(row.studentOutcomeJson,"Outcome JSON"),reportCardJson:requiredText(row.reportCardJson,"Report-card JSON"),kgRubricJson:requiredText(row.kgRubricJson,"KG JSON"),dataQualityJson:requiredText(row.dataQualityJson,"Data-quality JSON"),contextJson:requiredText(row.contextJson,"Context JSON"),snapshotHash:requiredText(row.snapshotHash,"Snapshot hash"),createdByUserId:null,...createdAtData(row,index,"teacherAnalyticsSnapshots")}});
    snapshotMap.set(id,id);result.teacherAnalyticsSnapshots.created++;
  }catch(error){result.teacherAnalyticsSnapshots.errors.push(rowError("Teacher analytics snapshot",index,error));}

  const reviewMap=new Map<string,string>();
  for(const [index,row] of backup.teacherAnalyticsReviews.entries())try{const id=requiredText(row.id,"Analytics review ID"),snapshotId=snapshotMap.get(requiredText(row.snapshotId,"Review snapshot ID"));if(!snapshotId){result.teacherAnalyticsReviews.skipped++;continue;}const [byId,bySnapshot]=await Promise.all([client.teacherAnalyticsReview.findUnique({where:{id}}),client.teacherAnalyticsReview.findUnique({where:{snapshotId}})]);if((byId&&byId.snapshotId!==snapshotId)||(bySnapshot&&bySnapshot.id!==id)){result.teacherAnalyticsReviews.skipped++;result.warnings.push(`Teacher analytics review ${id} collided with preserved local history and was isolated.`);continue;}if(byId){reviewMap.set(id,id);result.teacherAnalyticsReviews.skipped++;continue;}await client.teacherAnalyticsReview.create({data:{id,snapshotId,status:requiredText(row.status,"Review status"),strengthsNote:nullableText(row.strengthsNote),supportNeededNote:nullableText(row.supportNeededNote),agreedActionsNote:nullableText(row.agreedActionsNote),leadershipContextNote:nullableText(row.leadershipContextNote),teacherResponse:nullableText(row.teacherResponse),nextReviewDate:optionalDate(row.nextReviewDate,"Next review date"),createdByUserId:null,sharedByUserId:null,finalisedByUserId:null,sharedAt:optionalDate(row.sharedAt,"Review shared at"),teacherRespondedAt:optionalDate(row.teacherRespondedAt,"Teacher responded at"),finalisedAt:optionalDate(row.finalisedAt,"Review finalised at"),...createdAtData(row,index,"teacherAnalyticsReviews")}});reviewMap.set(id,id);result.teacherAnalyticsReviews.created++;}catch(error){result.teacherAnalyticsReviews.errors.push(rowError("Teacher analytics review",index,error));}

  for(const [index,row] of backup.teacherAnalyticsEvents.entries())try{const id=requiredText(row.id,"Analytics event ID"),reviewCycleId=cycleMap.get(requiredText(row.reviewCycleId,"Event cycle ID")),backupSnapshotId=nullableText(row.snapshotId),snapshotId=backupSnapshotId?snapshotMap.get(backupSnapshotId):null,backupReviewId=nullableText(row.reviewId),reviewId=backupReviewId?reviewMap.get(backupReviewId):null;if(!reviewCycleId||(backupSnapshotId&&!snapshotId)||(backupReviewId&&!reviewId)){result.teacherAnalyticsEvents.skipped++;continue;}if(await client.teacherAnalyticsEvent.findUnique({where:{id}})){result.teacherAnalyticsEvents.skipped++;continue;}await client.teacherAnalyticsEvent.create({data:{id,reviewCycleId,snapshotId:snapshotId??null,reviewId:reviewId??null,eventType:requiredText(row.eventType,"Analytics event type"),eventDate:requiredDate(row.eventDate,"Analytics event date"),reason:nullableText(row.reason),notes:nullableText(row.notes),recordedByUserId:null,...createdAtData(row,index,"teacherAnalyticsEvents")}});result.teacherAnalyticsEvents.created++;}catch(error){result.teacherAnalyticsEvents.errors.push(rowError("Teacher analytics event",index,error));}
}

export async function restoreCertificateData(
  client: RestoreDatabaseClient,
  backup: Pick<ValidatedBackup, "certificateNumberSeries" | "certificateTemplates" | "studentCertificateRequests" | "studentCertificates" | "studentCertificateVersions" | "studentCertificateEvents">,
  backupStudentLocalIds: Map<string, string>,
  result: Pick<RestoreResult, "certificateNumberSeries" | "certificateTemplates" | "studentCertificateRequests" | "studentCertificates" | "studentCertificateVersions" | "studentCertificateEvents" | "warnings">
) {
  const db = client as any, seriesMap=new Map<string,string>(),templateMap=new Map<string,string>(),requestMap=new Map<string,string>(),certificateMap=new Map<string,string>(),versionMap=new Map<string,string>();
  for(const[index,row]of backup.certificateNumberSeries.entries())try{const id=requiredText(row.id,"Certificate series ID"),seriesCode=requiredText(row.seriesCode,"Certificate series code");const[byId,byCode]=await Promise.all([db.certificateNumberSeries.findUnique({where:{id}}),db.certificateNumberSeries.findUnique({where:{seriesCode}})]);if((byId&&byId.seriesCode!==seriesCode)||(byCode&&byCode.id!==id)){result.certificateNumberSeries.skipped++;result.warnings.push(`Certificate series ${seriesCode} collided with a different local identity and was isolated.`);continue;}if(byId){seriesMap.set(id,id);result.certificateNumberSeries.skipped++;continue;}await db.certificateNumberSeries.create({data:{id,seriesCode,certificateType:requiredText(row.certificateType,"Certificate series type"),academicYear:nullableText(row.academicYear),prefix:String(row.prefix??""),nextNumber:positiveInteger(row.nextNumber,"Certificate next number"),paddingLength:positiveInteger(row.paddingLength,"Certificate padding"),suffix:nullableText(row.suffix),resetPolicy:requiredText(row.resetPolicy,"Certificate reset policy"),status:requiredText(row.status,"Certificate series status"),isDefault:Boolean(row.isDefault),createdByUserId:null,...createdAtData(row,index,"certificateNumberSeries")}});seriesMap.set(id,id);result.certificateNumberSeries.created++;}catch(error){result.certificateNumberSeries.errors.push(rowError("Certificate series",index,error));}
  for(const[index,row]of backup.certificateTemplates.entries())try{const id=requiredText(row.id,"Certificate template ID"),templateCode=requiredText(row.templateCode,"Certificate template code");const[byId,byCode]=await Promise.all([db.certificateTemplate.findUnique({where:{id}}),db.certificateTemplate.findUnique({where:{templateCode}})]);if((byId&&byId.templateCode!==templateCode)||(byCode&&byCode.id!==id)){result.certificateTemplates.skipped++;result.warnings.push(`Certificate template ${templateCode} collided with a different local identity and was isolated.`);continue;}if(byId){templateMap.set(id,id);result.certificateTemplates.skipped++;continue;}await db.certificateTemplate.create({data:{id,templateCode,certificateType:requiredText(row.certificateType,"Certificate template type"),name:requiredText(row.name,"Certificate template name"),academicYear:nullableText(row.academicYear),status:requiredText(row.status,"Certificate template status"),versionNumber:positiveInteger(row.versionNumber,"Certificate template version"),templateDefinitionJson:requiredText(row.templateDefinitionJson,"Certificate template JSON"),printSettingsJson:nullableText(row.printSettingsJson),createdByUserId:null,activatedByUserId:null,...createdAtData(row,index,"certificateTemplates")}});templateMap.set(id,id);result.certificateTemplates.created++;}catch(error){result.certificateTemplates.errors.push(rowError("Certificate template",index,error));}
  for(const[index,row]of backup.studentCertificateRequests.entries())try{const id=requiredText(row.id,"Certificate request ID"),requestNumber=requiredText(row.requestNumber,"Certificate request number"),studentId=backupStudentLocalIds.get(requiredText(row.studentId,"Certificate request Student ID"));if(!studentId){result.studentCertificateRequests.skipped++;continue;}const backupGuardianId=nullableText(row.applicantGuardianId);if(backupGuardianId){const owned=await db.studentGuardian.findFirst({where:{studentId,guardianId:backupGuardianId}});if(!owned){result.studentCertificateRequests.skipped++;result.warnings.push(`Certificate request ${requestNumber} was isolated because exact Guardian-Student ownership was unavailable.`);continue;}}const[byId,byNumber]=await Promise.all([db.studentCertificateRequest.findUnique({where:{id}}),db.studentCertificateRequest.findUnique({where:{requestNumber}})]);if((byId&&byId.requestNumber!==requestNumber)||(byNumber&&byNumber.id!==id)){result.studentCertificateRequests.skipped++;result.warnings.push(`Certificate request ${requestNumber} collided with preserved local history and was isolated.`);continue;}if(byId){requestMap.set(id,id);result.studentCertificateRequests.skipped++;continue;}await db.studentCertificateRequest.create({data:{id,requestNumber,studentId,academicYear:requiredText(row.academicYear,"Certificate request academic year"),certificateType:requiredText(row.certificateType,"Certificate request type"),requestSource:requiredText(row.requestSource,"Certificate request source"),purpose:requiredText(row.purpose,"Certificate request purpose"),requestedCopies:positiveInteger(row.requestedCopies,"Requested copies"),urgency:requiredText(row.urgency,"Certificate urgency"),status:requiredText(row.status,"Certificate request status"),applicantGuardianId:backupGuardianId,internalNotes:nullableText(row.internalNotes),publicNotes:nullableText(row.publicNotes),reviewNotes:nullableText(row.reviewNotes),rejectionReason:nullableText(row.rejectionReason),cancellationReason:nullableText(row.cancellationReason),createdByUserId:null,reviewedByUserId:null,approvedByUserId:null,rejectedByUserId:null,cancelledByUserId:null,submittedAt:optionalDate(row.submittedAt,"Certificate submitted at"),reviewedAt:optionalDate(row.reviewedAt,"Certificate reviewed at"),approvedAt:optionalDate(row.approvedAt,"Certificate approved at"),rejectedAt:optionalDate(row.rejectedAt,"Certificate rejected at"),cancelledAt:optionalDate(row.cancelledAt,"Certificate cancelled at"),completedAt:optionalDate(row.completedAt,"Certificate completed at"),...createdAtData(row,index,"studentCertificateRequests")}});requestMap.set(id,id);result.studentCertificateRequests.created++;}catch(error){result.studentCertificateRequests.errors.push(rowError("Certificate request",index,error));}
  for(const[index,row]of backup.studentCertificates.entries())try{const id=requiredText(row.id,"Student certificate ID"),studentId=backupStudentLocalIds.get(requiredText(row.studentId,"Certificate Student ID")),templateId=templateMap.get(requiredText(row.templateId,"Certificate template ID")),backupRequestId=nullableText(row.requestId),requestId=backupRequestId?requestMap.get(backupRequestId):null,number=nullableText(row.certificateNumber);if(!studentId||!templateId||(backupRequestId&&!requestId)){result.studentCertificates.skipped++;continue;}const[byId,byNumber]=await Promise.all([db.studentCertificate.findUnique({where:{id}}),number?db.studentCertificate.findUnique({where:{certificateNumber:number}}):null]);if((byId&&String(byId.certificateNumber??"")!==String(number??""))||(byNumber&&byNumber.id!==id)){result.studentCertificates.skipped++;result.warnings.push(`Certificate ${number??id} collided with preserved local history and was isolated.`);continue;}if(byId){certificateMap.set(id,id);result.studentCertificates.skipped++;continue;}await db.studentCertificate.create({data:{id,requestId,studentId,academicYear:requiredText(row.academicYear,"Certificate academic year"),certificateType:requiredText(row.certificateType,"Certificate type"),templateId,certificateNumber:number,status:requiredText(row.status,"Certificate status"),currentVersionNumber:Number(row.currentVersionNumber??0),draftDataJson:requiredText(row.draftDataJson,"Certificate draft JSON"),issuePurpose:requiredText(row.issuePurpose,"Certificate purpose"),internalNotes:nullableText(row.internalNotes),publicNotes:nullableText(row.publicNotes),cancellationReason:nullableText(row.cancellationReason),createdByUserId:null,submittedByUserId:null,approvedByUserId:null,issuedByUserId:null,cancelledByUserId:null,submittedAt:optionalDate(row.submittedAt,"Certificate submitted at"),approvedAt:optionalDate(row.approvedAt,"Certificate approved at"),issuedAt:optionalDate(row.issuedAt,"Certificate issued at"),cancelledAt:optionalDate(row.cancelledAt,"Certificate cancelled at"),...createdAtData(row,index,"studentCertificates")}});certificateMap.set(id,id);result.studentCertificates.created++;}catch(error){result.studentCertificates.errors.push(rowError("Student certificate",index,error));}
  for(const[index,row]of backup.studentCertificateVersions.entries())try{const id=requiredText(row.id,"Certificate version ID"),certificateId=certificateMap.get(requiredText(row.certificateId,"Version certificate ID"));if(!certificateId){result.studentCertificateVersions.skipped++;continue;}const versionNumber=positiveInteger(row.versionNumber,"Certificate version number"),byId=await db.studentCertificateVersion.findUnique({where:{id}}),byVersion=await db.studentCertificateVersion.findUnique({where:{certificateId_versionNumber:{certificateId,versionNumber}}});if((byId&&(byId.certificateId!==certificateId||byId.versionNumber!==versionNumber))||(byVersion&&byVersion.id!==id)){result.studentCertificateVersions.skipped++;result.warnings.push(`Certificate version ${certificateId}/${versionNumber} collided with immutable local history and was isolated.`);continue;}if(byId){versionMap.set(id,id);result.studentCertificateVersions.skipped++;continue;}const supersedesBackupId=nullableText(row.supersedesVersionId),supersedesVersionId=supersedesBackupId?versionMap.get(supersedesBackupId):null;await db.studentCertificateVersion.create({data:{id,certificateId,versionNumber,versionType:requiredText(row.versionType,"Certificate version type"),certificateNumber:requiredText(row.certificateNumber,"Certificate version number text"),snapshotJson:requiredText(row.snapshotJson,"Certificate snapshot"),correctionReason:nullableText(row.correctionReason),reissueReason:nullableText(row.reissueReason),issuedAt:requiredDate(row.issuedAt,"Certificate version issued at"),issuedByUserId:null,supersedesVersionId:supersedesVersionId??null,snapshotHash:nullableText(row.snapshotHash),...createdAtData(row,index,"studentCertificateVersions")}});versionMap.set(id,id);result.studentCertificateVersions.created++;}catch(error){result.studentCertificateVersions.errors.push(rowError("Certificate version",index,error));}
  for(const[index,row]of backup.studentCertificateEvents.entries())try{const id=requiredText(row.id,"Certificate event ID"),backupRequestId=nullableText(row.requestId),requestId=backupRequestId?requestMap.get(backupRequestId):null,backupCertificateId=nullableText(row.certificateId),certificateId=backupCertificateId?certificateMap.get(backupCertificateId):null,backupVersionId=nullableText(row.versionId),versionId=backupVersionId?versionMap.get(backupVersionId):null;if((backupRequestId&&!requestId)||(backupCertificateId&&!certificateId)||(backupVersionId&&!versionId)){result.studentCertificateEvents.skipped++;continue;}if(await db.studentCertificateEvent.findUnique({where:{id}})){result.studentCertificateEvents.skipped++;continue;}await db.studentCertificateEvent.create({data:{id,requestId:requestId??null,certificateId:certificateId??null,versionId:versionId??null,eventType:requiredText(row.eventType,"Certificate event type"),eventDate:requiredDate(row.eventDate,"Certificate event date"),previousStatus:nullableText(row.previousStatus),newStatus:nullableText(row.newStatus),reason:nullableText(row.reason),notes:nullableText(row.notes),recordedByUserId:null,...createdAtData(row,index,"studentCertificateEvents")}});result.studentCertificateEvents.created++;}catch(error){result.studentCertificateEvents.errors.push(rowError("Certificate event",index,error));}
}

export async function restoreClassXPackageData(
  client: RestoreDatabaseClient,
  backup: Pick<ValidatedBackup, "classXPackageTemplates" | "classXDocumentPackages" | "classXPackageDocumentItems" | "classXPackageChargeRules" | "classXPackageCharges" | "classXPackageHandovers" | "classXPackageEvents">,
  backupStudentLocalIds: Map<string, string>,
  result: Pick<RestoreResult, "classXPackageTemplates" | "classXDocumentPackages" | "classXPackageDocumentItems" | "classXPackageChargeRules" | "classXPackageCharges" | "classXPackageHandovers" | "classXPackageEvents" | "warnings">
) {
  const db = client as any, templateMap = new Map<string, string>(), packageMap = new Map<string, string>(), itemMap = new Map<string, string>(), ruleMap = new Map<string, string>(), chargeMap = new Map<string, string>(), handoverMap = new Map<string, string>();
  for (const [index, row] of backup.classXPackageTemplates.entries()) try {
    const id = requiredText(row.id, "Class X template ID"), code = requiredText(row.templateCode, "Class X template code");
    const [byId, byCode] = await Promise.all([db.classXPackageTemplate.findUnique({ where: { id } }), db.classXPackageTemplate.findUnique({ where: { templateCode: code } })]);
    if ((byId && byId.templateCode !== code) || (byCode && byCode.id !== id)) { result.classXPackageTemplates.skipped++; result.warnings.push(`Class X template ${code} collided with a different local identity and was isolated.`); continue; }
    if (byId) { templateMap.set(id, id); result.classXPackageTemplates.skipped++; continue; }
    await db.classXPackageTemplate.create({ data: { id, templateCode: code, packageType: requiredText(row.packageType, "Class X package type"), name: requiredText(row.name, "Class X template name"), academicYear: nullableText(row.academicYear), schoolBoard: nullableText(row.schoolBoard), status: requiredText(row.status, "Class X template status"), versionNumber: positiveInteger(row.versionNumber, "Class X template version"), documentDefinitionJson: requiredText(row.documentDefinitionJson, "Class X template definition"), paymentRequired: booleanOr(row.paymentRequired, false), defaultChargeRuleId: nullableText(row.defaultChargeRuleId), instructions: nullableText(row.instructions), createdByUserId: null, activatedByUserId: null, ...createdAtData(row, index, "classXPackageTemplates") } });
    templateMap.set(id, id); result.classXPackageTemplates.created++;
  } catch (error) { result.classXPackageTemplates.errors.push(rowError("Class X template", index, error)); }
  for (const [index, row] of backup.classXPackageChargeRules.entries()) try {
    const id = requiredText(row.id, "Class X charge rule ID"), code = requiredText(row.ruleCode, "Class X charge rule code");
    const [byId, byCode] = await Promise.all([db.classXPackageChargeRule.findUnique({ where: { id } }), db.classXPackageChargeRule.findUnique({ where: { ruleCode: code } })]);
    if ((byId && byId.ruleCode !== code) || (byCode && byCode.id !== id)) { result.classXPackageChargeRules.skipped++; result.warnings.push(`Class X charge rule ${code} collided with a different local identity and was isolated.`); continue; }
    if (byId) { ruleMap.set(id, id); result.classXPackageChargeRules.skipped++; continue; }
    await db.classXPackageChargeRule.create({ data: { id, ruleCode: code, academicYear: nullableText(row.academicYear), packageType: requiredText(row.packageType, "Class X rule package type"), name: requiredText(row.name, "Class X rule name"), amount: String(row.amount), miscellaneousIncomeItemCode: requiredText(row.miscellaneousIncomeItemCode, "Class X rule income item"), paymentRequired: booleanOr(row.paymentRequired, true), waiverAllowed: booleanOr(row.waiverAllowed, false), status: requiredText(row.status, "Class X rule status"), effectiveFrom: optionalDate(row.effectiveFrom, "Class X rule effective from"), effectiveTo: optionalDate(row.effectiveTo, "Class X rule effective to"), notes: nullableText(row.notes), createdByUserId: null, ...createdAtData(row, index, "classXPackageChargeRules") } });
    ruleMap.set(id, id); result.classXPackageChargeRules.created++;
  } catch (error) { result.classXPackageChargeRules.errors.push(rowError("Class X charge rule", index, error)); }
  for (const [index, row] of backup.classXDocumentPackages.entries()) try {
    const id = requiredText(row.id, "Class X package ID"), number = requiredText(row.packageNumber, "Class X package number"), studentId = backupStudentLocalIds.get(requiredText(row.studentId, "Class X package Student ID")), templateId = templateMap.get(requiredText(row.templateId, "Class X package template ID"));
    if (!studentId || !templateId) { result.classXDocumentPackages.skipped++; result.warnings.push(`Class X package ${number} was isolated because its exact Student or template link was unavailable.`); continue; }
    const guardianId = nullableText(row.applicantGuardianId); if (guardianId && !(await db.studentGuardian.findFirst({ where: { studentId, guardianId } }))) { result.classXDocumentPackages.skipped++; result.warnings.push(`Class X package ${number} was isolated because exact Guardian-Student ownership was unavailable.`); continue; }
    const [byId, byNumber] = await Promise.all([db.classXDocumentPackage.findUnique({ where: { id } }), db.classXDocumentPackage.findUnique({ where: { packageNumber: number } })]);
    if ((byId && byId.packageNumber !== number) || (byNumber && byNumber.id !== id)) { result.classXDocumentPackages.skipped++; result.warnings.push(`Class X package ${number} collided with preserved local history and was isolated.`); continue; }
    if (byId) { packageMap.set(id, id); result.classXDocumentPackages.skipped++; continue; }
    await db.classXDocumentPackage.create({ data: { id, packageNumber: number, packageType: requiredText(row.packageType, "Class X package type"), studentId, academicYear: requiredText(row.academicYear, "Class X package academic year"), templateId, status: requiredText(row.status, "Class X package status"), requestSource: requiredText(row.requestSource, "Class X request source"), applicantGuardianId: guardianId, purpose: nullableText(row.purpose), templateSnapshotJson: requiredText(row.templateSnapshotJson, "Class X template snapshot"), eligibilitySnapshotJson: requiredText(row.eligibilitySnapshotJson, "Class X eligibility snapshot"), paymentRequired: booleanOr(row.paymentRequired, false), totalRequiredItems: Number(row.totalRequiredItems ?? 0), readyItems: Number(row.readyItems ?? 0), handedOverItems: Number(row.handedOverItems ?? 0), internalNotes: nullableText(row.internalNotes), publicNotes: nullableText(row.publicNotes), cancellationReason: nullableText(row.cancellationReason), createdByUserId: null, reviewedByUserId: null, approvedByUserId: null, completedByUserId: null, cancelledByUserId: null, submittedAt: optionalDate(row.submittedAt, "Class X submitted at"), reviewedAt: optionalDate(row.reviewedAt, "Class X reviewed at"), approvedAt: optionalDate(row.approvedAt, "Class X approved at"), completedAt: optionalDate(row.completedAt, "Class X completed at"), cancelledAt: optionalDate(row.cancelledAt, "Class X cancelled at"), ...createdAtData(row, index, "classXDocumentPackages") } });
    packageMap.set(id, id); result.classXDocumentPackages.created++;
  } catch (error) { result.classXDocumentPackages.errors.push(rowError("Class X package", index, error)); }
  for (const [index, row] of backup.classXPackageDocumentItems.entries()) try {
    const id = requiredText(row.id, "Class X item ID"), packageId = packageMap.get(requiredText(row.packageId, "Class X item package ID")); if (!packageId) { result.classXPackageDocumentItems.skipped++; continue; }
    const itemKey = requiredText(row.itemKey, "Class X item key"), byId = await db.classXPackageDocumentItem.findUnique({ where: { id } }), byKey = await db.classXPackageDocumentItem.findUnique({ where: { packageId_itemKey: { packageId, itemKey } } });
    if ((byId && (byId.packageId !== packageId || byId.itemKey !== itemKey)) || (byKey && byKey.id !== id)) { result.classXPackageDocumentItems.skipped++; result.warnings.push(`Class X package item ${itemKey} collided with immutable local history and was isolated.`); continue; }
    if (byId) { itemMap.set(id, id); result.classXPackageDocumentItems.skipped++; continue; }
    const certId = nullableText(row.linkedStudentCertificateId), versionId = nullableText(row.linkedStudentCertificateVersionId);
    if (certId && !(await db.studentCertificate.findUnique({ where: { id: certId } })) || versionId && !(await db.studentCertificateVersion.findUnique({ where: { id: versionId } }))) { result.classXPackageDocumentItems.skipped++; result.warnings.push(`Class X item ${itemKey} was isolated because its exact Prompt 18A certificate/version was unavailable.`); continue; }
    await db.classXPackageDocumentItem.create({ data: { id, packageId, itemKey, itemType: requiredText(row.itemType, "Class X item type"), issuerType: requiredText(row.issuerType, "Class X item issuer"), displayName: requiredText(row.displayName, "Class X item name"), required: booleanOr(row.required, true), displayOrder: Number(row.displayOrder), parentVisible: booleanOr(row.parentVisible, true), serialNumberRequired: booleanOr(row.serialNumberRequired, false), handoverRequired: booleanOr(row.handoverRequired, true), status: requiredText(row.status, "Class X item status"), linkedStudentCertificateId: certId, linkedStudentCertificateVersionId: versionId, externalDocumentReference: nullableText(row.externalDocumentReference), authorityName: nullableText(row.authorityName), requestDate: optionalDate(row.requestDate, "Class X request date"), externalIssueDate: optionalDate(row.externalIssueDate, "Class X external issue date"), receivedDate: optionalDate(row.receivedDate, "Class X received date"), verifiedDate: optionalDate(row.verifiedDate, "Class X verified date"), handoverDate: optionalDate(row.handoverDate, "Class X handover date"), sourceNotes: nullableText(row.sourceNotes), publicNotes: nullableText(row.publicNotes), rejectionReason: nullableText(row.rejectionReason), notApplicableReason: nullableText(row.notApplicableReason), verifiedByUserId: null, handedOverByUserId: null, ...createdAtData(row, index, "classXPackageDocumentItems") } });
    itemMap.set(id, id); result.classXPackageDocumentItems.created++;
  } catch (error) { result.classXPackageDocumentItems.errors.push(rowError("Class X package item", index, error)); }
  for (const [index, row] of backup.classXPackageCharges.entries()) try {
    const id = requiredText(row.id, "Class X charge ID"), packageId = packageMap.get(requiredText(row.packageId, "Class X charge package ID")); if (!packageId) { result.classXPackageCharges.skipped++; continue; }
    const code = requiredText(row.chargeCode, "Class X charge code"), byId = await db.classXPackageCharge.findUnique({ where: { id } }), byCode = await db.classXPackageCharge.findUnique({ where: { chargeCode: code } }), byPackage = await db.classXPackageCharge.findUnique({ where: { packageId } });
    if ((byId && byId.chargeCode !== code) || (byCode && byCode.id !== id) || (byPackage && byPackage.id !== id)) { result.classXPackageCharges.skipped++; result.warnings.push(`Class X charge ${code} collided with preserved local history and was isolated.`); continue; }
    if (byId) { chargeMap.set(id, id); result.classXPackageCharges.skipped++; continue; }
    const ruleId = row.chargeRuleId ? ruleMap.get(String(row.chargeRuleId)) : null, receiptId = nullableText(row.linkedMiscIncomeReceiptId);
    if (row.chargeRuleId && !ruleId) { result.classXPackageCharges.skipped++; continue; }
    if (receiptId) { const receipt = await db.miscIncomeReceipt.findUnique({ where: { id: receiptId }, include: { libraryCharge: true, classXPackageCharge: true } }); if (!receipt || receipt.libraryCharge || receipt.classXPackageCharge) { result.classXPackageCharges.skipped++; result.warnings.push(`Class X charge ${code} receipt link was not unique and was isolated.`); continue; } }
    await db.classXPackageCharge.create({ data: { id, packageId, chargeRuleId: ruleId, chargeCode: code, miscellaneousIncomeItemCode: nullableText(row.miscellaneousIncomeItemCode), originalAmount: String(row.originalAmount), waivedAmount: String(row.waivedAmount), payableAmount: String(row.payableAmount), paidAmount: String(row.paidAmount), waiverAllowedSnapshot: booleanOr(row.waiverAllowedSnapshot, false), status: requiredText(row.status, "Class X charge status"), waiverReason: nullableText(row.waiverReason), cancellationReason: nullableText(row.cancellationReason), approvedByUserId: null, waivedByUserId: null, collectedByUserId: null, cancelledByUserId: null, linkedMiscIncomeReceiptId: receiptId, approvedAt: optionalDate(row.approvedAt, "Class X charge approved at"), waivedAt: optionalDate(row.waivedAt, "Class X charge waived at"), paidAt: optionalDate(row.paidAt, "Class X charge paid at"), cancelledAt: optionalDate(row.cancelledAt, "Class X charge cancelled at"), ...createdAtData(row, index, "classXPackageCharges") } });
    chargeMap.set(id, id); result.classXPackageCharges.created++;
  } catch (error) { result.classXPackageCharges.errors.push(rowError("Class X package charge", index, error)); }
  for (const [index, row] of backup.classXPackageHandovers.entries()) try {
    const id = requiredText(row.id, "Class X handover ID"), packageId = packageMap.get(requiredText(row.packageId, "Class X handover package ID")); if (!packageId) { result.classXPackageHandovers.skipped++; continue; }
    const number = requiredText(row.handoverNumber, "Class X handover number"), byId = await db.classXPackageHandover.findUnique({ where: { id } }), byNumber = await db.classXPackageHandover.findUnique({ where: { handoverNumber: number } });
    if ((byId && byId.handoverNumber !== number) || (byNumber && byNumber.id !== id)) { result.classXPackageHandovers.skipped++; result.warnings.push(`Class X handover ${number} collided with immutable local history and was isolated.`); continue; }
    if (byId) { handoverMap.set(id, id); result.classXPackageHandovers.skipped++; continue; }
    await db.classXPackageHandover.create({ data: { id, packageId, handoverNumber: number, handoverDate: requiredDate(row.handoverDate, "Class X handover date"), recipientType: requiredText(row.recipientType, "Class X recipient type"), recipientName: requiredText(row.recipientName, "Class X recipient name"), relationship: nullableText(row.relationship), recipientAcknowledgementText: requiredText(row.recipientAcknowledgementText, "Class X acknowledgement"), identityChecked: booleanOr(row.identityChecked, false), identityCheckMethod: nullableText(row.identityCheckMethod), itemSnapshotJson: requiredText(row.itemSnapshotJson, "Class X handover snapshot"), handedOverByUserId: null, ...createdAtData(row, index, "classXPackageHandovers") } });
    handoverMap.set(id, id); result.classXPackageHandovers.created++;
  } catch (error) { result.classXPackageHandovers.errors.push(rowError("Class X handover", index, error)); }
  for (const [index, row] of backup.classXPackageEvents.entries()) try {
    const id = requiredText(row.id, "Class X event ID"), packageId = packageMap.get(requiredText(row.packageId, "Class X event package ID")); if (!packageId || await db.classXPackageEvent.findUnique({ where: { id } })) { result.classXPackageEvents.skipped++; continue; }
    const itemId = row.documentItemId ? itemMap.get(String(row.documentItemId)) : null, chargeId = row.chargeId ? chargeMap.get(String(row.chargeId)) : null, handoverId = row.handoverId ? handoverMap.get(String(row.handoverId)) : null;
    if (row.documentItemId && !itemId || row.chargeId && !chargeId || row.handoverId && !handoverId) { result.classXPackageEvents.skipped++; continue; }
    await db.classXPackageEvent.create({ data: { id, packageId, documentItemId: itemId, chargeId, handoverId, eventType: requiredText(row.eventType, "Class X event type"), eventDate: requiredDate(row.eventDate, "Class X event date"), previousStatus: nullableText(row.previousStatus), newStatus: nullableText(row.newStatus), reason: nullableText(row.reason), notes: nullableText(row.notes), recordedByUserId: null, ...createdAtData(row, index, "classXPackageEvents") } });
    result.classXPackageEvents.created++;
  } catch (error) { result.classXPackageEvents.errors.push(rowError("Class X package event", index, error)); }
}

export async function restoreIdentityCardData(
  client: RestoreDatabaseClient,
  backup: Pick<ValidatedBackup, "staffMembers" | "identityCardNumberSeries" | "identityCardTemplates" | "identityCardBatches" | "identityCards" | "identityCardVersions" | "identityCardEvents">,
  backupStudentLocalIds: Map<string, string>,
  result: Pick<RestoreResult, "identityCardNumberSeries" | "identityCardTemplates" | "identityCardBatches" | "identityCards" | "identityCardVersions" | "identityCardEvents" | "warnings">
) {
  const db = client as any, seriesMap = new Map<string,string>(), templateMap = new Map<string,string>(), batchMap = new Map<string,string>(), cardMap = new Map<string,string>(), versionMap = new Map<string,string>(), staffMap = new Map<string,string>();
  for (const row of backup.staffMembers) {
    const backupId = nullableText(row.id); if (!backupId) continue;
    const code = nullableText(row.staffCode);
    const local = await db.staffMember.findFirst({ where: { OR: [{ id: backupId }, ...(code ? [{ staffCode: code }] : [])] }, select: { id: true } });
    if (local) staffMap.set(backupId, local.id);
  }
  for (const [index,row] of backup.identityCardNumberSeries.entries()) try {
    const id=requiredText(row.id,"ID-card series ID"),code=requiredText(row.seriesCode,"ID-card series code"),byId=await db.identityCardNumberSeries.findUnique({where:{id}}),byCode=await db.identityCardNumberSeries.findUnique({where:{seriesCode:code}});
    if ((byId&&byId.seriesCode!==code)||(byCode&&byCode.id!==id)){result.identityCardNumberSeries.skipped++;result.warnings.push(`ID-card series ${code} collided with a different local identity and was isolated.`);continue;}
    if(byId){seriesMap.set(id,id);result.identityCardNumberSeries.skipped++;continue;}
    await db.identityCardNumberSeries.create({data:{id,seriesCode:code,cardType:requiredText(row.cardType,"ID-card series type"),academicYear:nullableText(row.academicYear),prefix:String(row.prefix??""),nextNumber:positiveInteger(row.nextNumber,"ID-card next number"),paddingLength:positiveInteger(row.paddingLength,"ID-card padding"),suffix:nullableText(row.suffix),resetPolicy:requiredText(row.resetPolicy,"ID-card reset policy"),status:requiredText(row.status,"ID-card series status"),isDefault:booleanOr(row.isDefault,true),createdByUserId:null,...createdAtData(row,index,"identityCardNumberSeries")}});
    seriesMap.set(id,id);result.identityCardNumberSeries.created++;
  } catch(error){result.identityCardNumberSeries.errors.push(rowError("ID-card series",index,error));}
  for (const [index,row] of backup.identityCardTemplates.entries()) try {
    const id=requiredText(row.id,"ID-card template ID"),code=requiredText(row.templateCode,"ID-card template code"),byId=await db.identityCardTemplate.findUnique({where:{id}}),byCode=await db.identityCardTemplate.findUnique({where:{templateCode:code}});
    if ((byId&&byId.templateCode!==code)||(byCode&&byCode.id!==id)){result.identityCardTemplates.skipped++;result.warnings.push(`ID-card template ${code} collided with a different local identity and was isolated.`);continue;}
    if(byId){templateMap.set(id,id);result.identityCardTemplates.skipped++;continue;}
    await db.identityCardTemplate.create({data:{id,templateCode:code,cardType:requiredText(row.cardType,"ID-card template type"),name:requiredText(row.name,"ID-card template name"),academicYear:nullableText(row.academicYear),status:requiredText(row.status,"ID-card template status"),versionNumber:positiveInteger(row.versionNumber,"ID-card template version"),frontDefinitionJson:requiredText(row.frontDefinitionJson,"ID-card front definition"),backDefinitionJson:requiredText(row.backDefinitionJson,"ID-card back definition"),printSettingsJson:nullableText(row.printSettingsJson),photoRequired:false,barcodeEnabled:booleanOr(row.barcodeEnabled,true),createdByUserId:null,activatedByUserId:null,...createdAtData(row,index,"identityCardTemplates")}});
    templateMap.set(id,id);result.identityCardTemplates.created++;
  } catch(error){result.identityCardTemplates.errors.push(rowError("ID-card template",index,error));}
  for (const [index,row] of backup.identityCardBatches.entries()) try {
    const id=requiredText(row.id,"ID-card batch ID"),number=requiredText(row.batchNumber,"ID-card batch number"),templateId=templateMap.get(requiredText(row.templateId,"ID-card batch template ID"));
    if(!templateId){result.identityCardBatches.skipped++;continue;}
    const byId=await db.identityCardBatch.findUnique({where:{id}}),byNumber=await db.identityCardBatch.findUnique({where:{batchNumber:number}});
    if((byId&&byId.batchNumber!==number)||(byNumber&&byNumber.id!==id)){result.identityCardBatches.skipped++;result.warnings.push(`ID-card batch ${number} collided with preserved local history and was isolated.`);continue;}
    if(byId){batchMap.set(id,id);result.identityCardBatches.skipped++;continue;}
    await db.identityCardBatch.create({data:{id,batchNumber:number,cardType:requiredText(row.cardType,"ID-card batch type"),academicYear:nullableText(row.academicYear),templateId,scopeType:requiredText(row.scopeType,"ID-card batch scope"),className:nullableText(row.className),section:nullableText(row.section),staffDesignation:nullableText(row.staffDesignation),validFrom:requiredDate(row.validFrom,"ID-card batch valid from"),validUntil:requiredDate(row.validUntil,"ID-card batch valid until"),status:requiredText(row.status,"ID-card batch status"),expectedCount:Number(row.expectedCount??0),eligibleCount:Number(row.eligibleCount??0),issuedCount:Number(row.issuedCount??0),skippedCount:Number(row.skippedCount??0),scopeSnapshotJson:nullableText(row.scopeSnapshotJson),resultSnapshotJson:nullableText(row.resultSnapshotJson),notes:nullableText(row.notes),cancellationReason:nullableText(row.cancellationReason),createdByUserId:null,approvedByUserId:null,issuedByUserId:null,cancelledByUserId:null,approvedAt:optionalDate(row.approvedAt,"ID-card batch approved at"),issuedAt:optionalDate(row.issuedAt,"ID-card batch issued at"),cancelledAt:optionalDate(row.cancelledAt,"ID-card batch cancelled at"),...createdAtData(row,index,"identityCardBatches")}});
    batchMap.set(id,id);result.identityCardBatches.created++;
  } catch(error){result.identityCardBatches.errors.push(rowError("ID-card batch",index,error));}
  for (const [index,row] of backup.identityCards.entries()) try {
    const id=requiredText(row.id,"ID card ID"),type=requiredText(row.cardType,"ID card type"),templateId=templateMap.get(requiredText(row.templateId,"ID card template ID")),numberSeriesId=row.numberSeriesId?seriesMap.get(String(row.numberSeriesId)):null,backupStudentId=nullableText(row.studentId),studentId=backupStudentId?backupStudentLocalIds.get(backupStudentId):null,backupStaffId=nullableText(row.staffMemberId),staffMemberId=backupStaffId?staffMap.get(backupStaffId):null,batchId=row.batchId?batchMap.get(String(row.batchId)):null;
    if(!templateId||(row.numberSeriesId&&!numberSeriesId)||(type==="STUDENT"?!studentId||Boolean(staffMemberId):!staffMemberId||Boolean(studentId))||(row.batchId&&!batchId)){result.identityCards.skipped++;result.warnings.push(`ID card ${String(row.cardNumber??id)} was isolated because an exact Student/Staff, template, number-series, or batch link was unavailable.`);continue;}
    const number=nullableText(row.cardNumber),byId=await db.identityCard.findUnique({where:{id}}),byNumber=number?await db.identityCard.findUnique({where:{cardNumber:number}}):null;
    if((byId&&byId.cardNumber!==number)||(byNumber&&byNumber.id!==id)){result.identityCards.skipped++;result.warnings.push(`ID card ${number??id} collided with preserved local history and was isolated.`);continue;}
    if(byId){cardMap.set(id,id);result.identityCards.skipped++;continue;}
    await db.identityCard.create({data:{id,cardType:type,batchId:batchId??null,templateId,numberSeriesId:numberSeriesId??null,studentId:studentId??null,staffMemberId:staffMemberId??null,academicYear:nullableText(row.academicYear),cardNumber:number,validFrom:requiredDate(row.validFrom,"ID card valid from"),validUntil:requiredDate(row.validUntil,"ID card valid until"),status:requiredText(row.status,"ID card status"),currentVersionNumber:Number(row.currentVersionNumber??0),draftDataJson:requiredText(row.draftDataJson,"ID card draft data"),templateSnapshotJson:requiredText(row.templateSnapshotJson,"ID card template snapshot"),issueReason:nullableText(row.issueReason),revocationReason:nullableText(row.revocationReason),cancellationReason:nullableText(row.cancellationReason),replacesCardId:null,createdByUserId:null,approvedByUserId:null,issuedByUserId:null,revokedByUserId:null,cancelledByUserId:null,approvedAt:optionalDate(row.approvedAt,"ID card approved at"),issuedAt:optionalDate(row.issuedAt,"ID card issued at"),revokedAt:optionalDate(row.revokedAt,"ID card revoked at"),cancelledAt:optionalDate(row.cancelledAt,"ID card cancelled at"),...createdAtData(row,index,"identityCards")}});
    cardMap.set(id,id);result.identityCards.created++;
  } catch(error){result.identityCards.errors.push(rowError("ID card",index,error));}
  for (const [index,row] of backup.identityCards.entries()) try {
    const id=cardMap.get(requiredText(row.id,"ID card ID")),replacementBackupId=nullableText(row.replacesCardId);
    if(!id||!replacementBackupId)continue;
    const replacesCardId=cardMap.get(replacementBackupId);if(!replacesCardId){result.warnings.push(`ID-card replacement link ${String(row.cardNumber??id)} was isolated because the original card was unavailable.`);continue;}
    const current=await db.identityCard.findUnique({where:{id},select:{replacesCardId:true}});if(!current?.replacesCardId)await db.identityCard.update({where:{id},data:{replacesCardId}});
  } catch(error){result.identityCards.errors.push(rowError("ID-card replacement link",index,error));}
  for (const [index,row] of backup.identityCardVersions.entries()) try {
    const id=requiredText(row.id,"ID-card version ID"),identityCardId=cardMap.get(requiredText(row.identityCardId,"ID-card version card ID"));if(!identityCardId){result.identityCardVersions.skipped++;continue;}
    const versionNumber=positiveInteger(row.versionNumber,"ID-card version number"),byId=await db.identityCardVersion.findUnique({where:{id}}),byVersion=await db.identityCardVersion.findUnique({where:{identityCardId_versionNumber:{identityCardId,versionNumber}}});
    if((byId&&(byId.identityCardId!==identityCardId||byId.versionNumber!==versionNumber))||(byVersion&&byVersion.id!==id)){result.identityCardVersions.skipped++;result.warnings.push(`ID-card version ${identityCardId}/${versionNumber} collided with immutable local history and was isolated.`);continue;}
    if(byId){versionMap.set(id,id);result.identityCardVersions.skipped++;continue;}
    const supersedesBackupId=nullableText(row.supersedesVersionId),supersedesVersionId=supersedesBackupId?versionMap.get(supersedesBackupId):null;
    await db.identityCardVersion.create({data:{id,identityCardId,versionNumber,versionType:requiredText(row.versionType,"ID-card version type"),cardNumber:requiredText(row.cardNumber,"ID-card version card number"),snapshotJson:requiredText(row.snapshotJson,"ID-card version snapshot"),correctionReason:nullableText(row.correctionReason),issuedAt:requiredDate(row.issuedAt,"ID-card version issued at"),issuedByUserId:null,supersedesVersionId:supersedesVersionId??null,snapshotHash:nullableText(row.snapshotHash),...createdAtData(row,index,"identityCardVersions")}});
    versionMap.set(id,id);result.identityCardVersions.created++;
  } catch(error){result.identityCardVersions.errors.push(rowError("ID-card version",index,error));}
  for (const [index,row] of backup.identityCardEvents.entries()) try {
    const id=requiredText(row.id,"ID-card event ID");if(await db.identityCardEvent.findUnique({where:{id}})){result.identityCardEvents.skipped++;continue;}
    const batchId=row.batchId?batchMap.get(String(row.batchId)):null,identityCardId=row.identityCardId?cardMap.get(String(row.identityCardId)):null,versionId=row.versionId?versionMap.get(String(row.versionId)):null;
    if((row.batchId&&!batchId)||(row.identityCardId&&!identityCardId)||(row.versionId&&!versionId)){result.identityCardEvents.skipped++;continue;}
    await db.identityCardEvent.create({data:{id,batchId:batchId??null,identityCardId:identityCardId??null,versionId:versionId??null,eventType:requiredText(row.eventType,"ID-card event type"),eventDate:requiredDate(row.eventDate,"ID-card event date"),previousStatus:nullableText(row.previousStatus),newStatus:nullableText(row.newStatus),reason:nullableText(row.reason),notes:nullableText(row.notes),recordedByUserId:null,...createdAtData(row,index,"identityCardEvents")}});
    result.identityCardEvents.created++;
  } catch(error){result.identityCardEvents.errors.push(rowError("ID-card event",index,error));}
}

export async function restoreNoticesData(
  client: Pick<RestoreDatabaseClient, "notice">,
  backup: Pick<ValidatedBackup, "notices">,
  backupUserToLocalUser: Map<string, string>,
  result: Pick<RestoreResult, "notices">
) {
  for (const [index, row] of backup.notices.entries()) {
    try {
      const id = requiredText(row.id, "Notice ID");
      const audienceType = requiredText(row.audienceType, "Notice audience");
      const data = {
        title: requiredText(row.title, "Notice title"),
        body: requiredText(row.body, "Notice message"),
        audienceType,
        className: audienceType === "ALL_PARENTS" ? null : nullableText(row.className),
        section: audienceType === "SECTION" ? nullableText(row.section)?.toUpperCase() ?? null : null,
        status: requiredText(row.status, "Notice status"),
        publishDate: optionalDate(row.publishDate, `notices[${index}].publishDate`),
        expiresAt: optionalDate(row.expiresAt, `notices[${index}].expiresAt`),
        createdById: mapOptionalUserId(row.createdById, backupUserToLocalUser),
        updatedById: mapOptionalUserId(row.updatedById, backupUserToLocalUser),
        updatedAt: optionalDate(row.updatedAt, `notices[${index}].updatedAt`) ?? undefined
      };
      const existing = await client.notice.findUnique({ where: { id } });
      if (existing) {
        if (sameData(existing, data)) result.notices.skipped += 1;
        else {
          await client.notice.update({ where: { id }, data });
          result.notices.updated += 1;
        }
      } else {
        await client.notice.create({
          data: {
            id,
            ...data,
            ...createdAtData(row, index, "notices")
          }
        });
        result.notices.created += 1;
      }
    } catch (error) {
      result.notices.errors.push(rowError("Notice", index, error));
    }
  }
}

export async function restoreGuardianData(
  client: Pick<RestoreDatabaseClient, "guardian" | "studentGuardian">,
  backup: Pick<ValidatedBackup, "guardians" | "studentGuardians">,
  backupStudentLocalIds: Map<string, string>,
  result: Pick<RestoreResult, "guardians" | "studentGuardians" | "warnings">
) {
  const guardianIds = new Map<string, string>();

  for (const [index, row] of backup.guardians.entries()) {
    try {
      const backupId = requiredText(row.id, "Guardian ID");
      const data = {
        displayName: requiredText(row.displayName, "Guardian name"),
        primaryMobile: requiredText(row.primaryMobile, "Primary mobile"),
        alternateMobile: nullableText(row.alternateMobile),
        email: nullableText(row.email),
        relationship: textOr(row.relationship, "Parent"),
        status: textOr(row.status, "Active"),
        notes: nullableText(row.notes)
      };
      let existing = await client.guardian.findUnique({ where: { id: backupId } });
      existing ??= await client.guardian.findFirst({ where: { primaryMobile: data.primaryMobile } });
      if (!existing && data.email) existing = await client.guardian.findFirst({ where: { email: data.email } });

      const guardian = existing
        ? sameData(existing, data)
          ? existing
          : await client.guardian.update({ where: { id: existing.id }, data })
        : await client.guardian.create({
            data: { id: backupId, ...data, ...createdAtData(row, index, "guardians") }
          });
      if (existing) {
        if (guardian === existing) result.guardians.skipped += 1;
        else result.guardians.updated += 1;
      } else {
        result.guardians.created += 1;
      }
      guardianIds.set(backupId, guardian.id);
    } catch (error) {
      result.guardians.errors.push(rowError("Guardian", index, error));
    }
  }

  for (const [index, row] of backup.studentGuardians.entries()) {
    try {
      const backupGuardianId = requiredText(row.guardianId, "Guardian ID");
      const backupStudentId = requiredText(row.studentId, "Student ID");
      const guardianId = guardianIds.get(backupGuardianId);
      const studentId = backupStudentLocalIds.get(backupStudentId);
      if (!guardianId || !studentId) {
        result.studentGuardians.skipped += 1;
        result.warnings.push(`Guardian link ${index + 1} skipped because guardian or student mapping was not safe.`);
        continue;
      }
      const data = {
        relationshipToStudent: textOr(row.relationshipToStudent, "Parent"),
        isPrimaryContact: booleanOr(row.isPrimaryContact, false),
        canViewFees: booleanOr(row.canViewFees, true),
        canReceiveReminders: booleanOr(row.canReceiveReminders, true)
      };
      const where = { guardianId_studentId: { guardianId, studentId } };
      const existing = await client.studentGuardian.findUnique({ where });
      if (existing) {
        if (sameData(existing, data)) {
          result.studentGuardians.skipped += 1;
        } else {
          await client.studentGuardian.update({ where, data });
          result.studentGuardians.updated += 1;
        }
      } else {
        await client.studentGuardian.create({
          data: { guardianId, studentId, ...data, ...createdAtData(row, index, "studentGuardians") }
        });
        result.studentGuardians.created += 1;
      }
    } catch (error) {
      result.studentGuardians.errors.push(rowError("Guardian link", index, error));
    }
  }

  return guardianIds;
}

async function restoreGuardianUserLinks(
  client: Pick<RestoreDatabaseClient, "user">,
  users: RestoreRecord[],
  backupGuardianIds: Map<string, string>,
  backupUserToLocalUser: Map<string, string>,
  result: Pick<RestoreResult, "users" | "warnings">
) {
  let linked = 0;
  for (const [index, row] of users.entries()) {
    const backupUserId = nullableText(row.id);
    const localUserId = backupUserId ? backupUserToLocalUser.get(backupUserId) : null;
    const guardianId = nullableText(row.guardianId);
    const localGuardianId = guardianId ? backupGuardianIds.get(guardianId) : null;
    if (!localUserId || !localGuardianId) continue;
    const localUser = await client.user.findUnique({ where: { id: localUserId } });
    if (!localUser) continue;
    if (localUser.role !== "PARENT") {
      result.warnings.push(`User link ${index + 1} skipped because the matched local account is not a Parent user.`);
      continue;
    }
    if (localUser.guardianId === localGuardianId) {
      result.users.skipped += 1;
    } else {
      await client.user.update({ where: { id: localUser.id }, data: { guardianId: localGuardianId } });
      result.users.updated += 1;
    }
    linked += 1;
  }
  return linked;
}

export async function restoreRolePermissionsData(
  client: Pick<RestoreDatabaseClient, "rolePermission">,
  backup: Pick<ValidatedBackup, "rolePermissions">,
  result: Pick<RestoreResult, "rolePermissions">
) {
  for (const [index, row] of backup.rolePermissions.entries()) {
    try {
      const role = requiredText(row.role, "Role");
      const permission = requiredText(row.permission, "Permission");
      const enabled = row.enabled === true;
      const existing = await client.rolePermission.findUnique({
        where: { role_permission: { role, permission } }
      });
      if (existing) {
        if (existing.enabled === enabled) {
          result.rolePermissions.skipped += 1;
        } else {
          await client.rolePermission.update({
            where: { role_permission: { role, permission } },
            data: { enabled }
          });
          result.rolePermissions.updated += 1;
        }
      } else {
        await client.rolePermission.create({ data: { role, permission, enabled } });
        result.rolePermissions.created += 1;
      }
    } catch (error) {
      result.rolePermissions.errors.push(rowError("Role permission", index, error));
    }
  }
}

export async function restoreTimetableFoundationData(
  client: Pick<
    RestoreDatabaseClient,
    "timetableTeacher" | "timetableSubject" | "timetableClassSection"
    | "timetablePeriodTemplate" | "timetableAssignment"
    | "timetableTeacherUnavailability" | "timetableFixedPeriod"
    | "timetableDraft" | "timetableEntry"
  >,
  backup: Pick<
    ValidatedBackup,
    "timetableTeachers" | "timetableSubjects" | "timetableClassSections"
    | "timetablePeriodTemplates" | "timetableAssignments"
    | "timetableTeacherUnavailability" | "timetableFixedPeriods"
    | "timetableDrafts" | "timetableEntries"
  >,
  result: Pick<
    RestoreResult,
    "timetableTeachers" | "timetableSubjects" | "timetableClassSections"
    | "timetablePeriodTemplates" | "timetableAssignments"
    | "timetableTeacherUnavailability" | "timetableFixedPeriods"
    | "timetableDrafts" | "timetableEntries"
  >
) {
  const teacherIds = new Map<string, string>();
  const subjectIds = new Map<string, string>();
  const classSectionIds = new Map<string, string>();
  const assignmentIds = new Map<string, string>();
  const draftIds = new Map<string, string>();
  const activeDraftYears = new Set<string>();

  for (const [index, row] of backup.timetableTeachers.entries()) {
    try {
      const backupId = nullableText(row.id);
      const data = {
        name: requiredText(row.name, "Teacher name"),
        shortName: requiredText(row.shortName, "Teacher short name"),
        department: nullableText(row.department),
        phone: nullableText(row.phone),
        email: nullableText(row.email),
        isActive: booleanOr(row.isActive, true),
        maxPeriodsPerWeek: positiveInteger(row.maxPeriodsPerWeek, "Maximum periods per week"),
        maxPeriodsPerDay: optionalPositiveInteger(row.maxPeriodsPerDay, "Maximum periods per day"),
        preferredFreePeriods: nullableText(row.preferredFreePeriods),
        notes: nullableText(row.notes)
      };
      let existing = backupId
        ? await client.timetableTeacher.findUnique({ where: { id: backupId } })
        : null;
      existing ??= await client.timetableTeacher.findUnique({ where: { shortName: data.shortName } });
      existing ??= await client.timetableTeacher.findFirst({ where: { name: data.name } });

      const teacher = existing
        ? sameData(existing, data)
          ? existing
          : await client.timetableTeacher.update({ where: { id: existing.id }, data })
        : await client.timetableTeacher.create({
            data: { ...(backupId ? { id: backupId } : {}), ...data, ...createdAtData(row, index, "timetableTeachers") }
          });
      if (existing) {
        if (teacher === existing) result.timetableTeachers.skipped += 1;
        else result.timetableTeachers.updated += 1;
      } else {
        result.timetableTeachers.created += 1;
      }
      if (backupId) teacherIds.set(backupId, teacher.id);
    } catch (error) {
      result.timetableTeachers.errors.push(rowError("Timetable teacher", index, error));
    }
  }

  for (const [index, row] of backup.timetableSubjects.entries()) {
    try {
      const backupId = nullableText(row.id);
      const data = {
        name: requiredText(row.name, "Subject name"),
        shortName: requiredText(row.shortName, "Subject short name"),
        department: nullableText(row.department),
        isLabSubject: booleanOr(row.isLabSubject, false),
        isActivitySubject: booleanOr(row.isActivitySubject, false),
        allowConsecutivePeriods: booleanOr(row.allowConsecutivePeriods, false),
        isActive: booleanOr(row.isActive, true),
        notes: nullableText(row.notes)
      };
      let existing = backupId
        ? await client.timetableSubject.findUnique({ where: { id: backupId } })
        : null;
      existing ??= await client.timetableSubject.findUnique({ where: { shortName: data.shortName } });
      existing ??= await client.timetableSubject.findFirst({ where: { name: data.name } });

      const subject = existing
        ? sameData(existing, data)
          ? existing
          : await client.timetableSubject.update({ where: { id: existing.id }, data })
        : await client.timetableSubject.create({
            data: { ...(backupId ? { id: backupId } : {}), ...data, ...createdAtData(row, index, "timetableSubjects") }
          });
      if (existing) {
        if (subject === existing) result.timetableSubjects.skipped += 1;
        else result.timetableSubjects.updated += 1;
      } else {
        result.timetableSubjects.created += 1;
      }
      if (backupId) subjectIds.set(backupId, subject.id);
    } catch (error) {
      result.timetableSubjects.errors.push(rowError("Timetable subject", index, error));
    }
  }

  for (const [index, row] of backup.timetableClassSections.entries()) {
    try {
      const backupId = nullableText(row.id);
      const academicYear = requiredText(row.academicYear, "Academic year");
      const className = requiredText(row.className, "Class");
      const section = String(row.section ?? "").trim();
      const data = {
        academicYear,
        className,
        section,
        displayName: textOr(row.displayName, classDisplayName(className, section)),
        groupName: requiredText(row.groupName, "Class group"),
        isActive: booleanOr(row.isActive, true)
      };
      let existing = backupId
        ? await client.timetableClassSection.findUnique({ where: { id: backupId } })
        : null;
      existing ??= await client.timetableClassSection.findUnique({
        where: { academicYear_className_section: { academicYear, className, section } }
      });

      const classSection = existing
        ? sameData(existing, data)
          ? existing
          : await client.timetableClassSection.update({ where: { id: existing.id }, data })
        : await client.timetableClassSection.create({
            data: { ...(backupId ? { id: backupId } : {}), ...data, ...createdAtData(row, index, "timetableClassSections") }
          });
      if (existing) {
        if (classSection === existing) result.timetableClassSections.skipped += 1;
        else result.timetableClassSections.updated += 1;
      } else {
        result.timetableClassSections.created += 1;
      }
      if (backupId) classSectionIds.set(backupId, classSection.id);
    } catch (error) {
      result.timetableClassSections.errors.push(rowError("Timetable class section", index, error));
    }
  }

  for (const [index, row] of backup.timetablePeriodTemplates.entries()) {
    try {
      const backupId = nullableText(row.id);
      const academicYear = requiredText(row.academicYear, "Academic year");
      const groupName = nullableText(row.groupName) ?? requiredText(row.classGroup, "Class group");
      const dayOfWeek = requiredText(row.dayOfWeek, "Day of week");
      const periodNumber = optionalPositiveInteger(row.periodNumber, "Period number");
      const label = requiredText(row.label, "Label");
      const sortOrder = nonNegativeInteger(row.sortOrder, "Sort order");
      const data = {
        academicYear,
        groupName,
        dayOfWeek,
        periodNumber,
        label,
        startTime: requiredText(row.startTime, "Start time"),
        endTime: requiredText(row.endTime, "End time"),
        type: requiredText(row.type, "Period type"),
        isTeachingPeriod: booleanOr(row.isTeachingPeriod, false),
        sortOrder,
        isDefault: booleanOr(row.isDefault, true)
      };
      let existing = backupId
        ? await client.timetablePeriodTemplate.findUnique({ where: { id: backupId } })
        : null;
      existing ??= await client.timetablePeriodTemplate.findFirst({
        where: { academicYear, groupName, dayOfWeek, periodNumber, label }
      });
      existing ??= await client.timetablePeriodTemplate.findUnique({
        where: { academicYear_groupName_dayOfWeek_sortOrder: { academicYear, groupName, dayOfWeek, sortOrder } }
      });

      if (existing) {
        if (sameData(existing, data)) result.timetablePeriodTemplates.skipped += 1;
        else {
          await client.timetablePeriodTemplate.update({ where: { id: existing.id }, data });
          result.timetablePeriodTemplates.updated += 1;
        }
      } else {
        await client.timetablePeriodTemplate.create({
          data: { ...(backupId ? { id: backupId } : {}), ...data }
        });
        result.timetablePeriodTemplates.created += 1;
      }
    } catch (error) {
      result.timetablePeriodTemplates.errors.push(rowError("Timetable period template", index, error));
    }
  }

  for (const [index, row] of backup.timetableAssignments.entries()) {
    const classSectionId = mapRequiredTimetableId(
      row.classSectionId,
      classSectionIds,
      "class section",
      index,
      result.timetableAssignments
    );
    const subjectId = mapRequiredTimetableId(
      row.subjectId,
      subjectIds,
      "subject",
      index,
      result.timetableAssignments
    );
    const teacherId = mapRequiredTimetableId(
      row.teacherId,
      teacherIds,
      "teacher",
      index,
      result.timetableAssignments
    );
    if (!classSectionId || !subjectId || !teacherId) {
      result.timetableAssignments.skipped += 1;
      continue;
    }

    try {
      const backupId = nullableText(row.id);
      const academicYear = requiredText(row.academicYear, "Academic year");
      const data = {
        academicYear,
        classSectionId,
        subjectId,
        teacherId,
        periodsPerWeek: positiveInteger(row.periodsPerWeek, "Periods per week"),
        allowConsecutiveOverride: optionalBoolean(row.allowConsecutiveOverride),
        priority: optionalNonNegativeInteger(row.priority, "Priority"),
        notes: nullableText(row.notes)
      };
      let existing = backupId
        ? await client.timetableAssignment.findUnique({ where: { id: backupId } })
        : null;
      existing ??= await client.timetableAssignment.findUnique({
        where: {
          academicYear_classSectionId_subjectId_teacherId: {
            academicYear, classSectionId, subjectId, teacherId
          }
        }
      });
      const assignment = existing
        ? sameData(existing, data)
          ? existing
          : await client.timetableAssignment.update({ where: { id: existing.id }, data })
        : await client.timetableAssignment.create({
          data: { ...(backupId ? { id: backupId } : {}), ...data, ...createdAtData(row, index, "timetableAssignments") }
        });
      if (existing) {
        if (assignment === existing) result.timetableAssignments.skipped += 1;
        else result.timetableAssignments.updated += 1;
      } else {
        result.timetableAssignments.created += 1;
      }
      if (backupId) assignmentIds.set(backupId, assignment.id);
    } catch (error) {
      result.timetableAssignments.errors.push(rowError("Timetable assignment", index, error));
    }
  }

  for (const [index, row] of backup.timetableTeacherUnavailability.entries()) {
    const teacherId = mapRequiredTimetableId(
      row.teacherId,
      teacherIds,
      "teacher",
      index,
      result.timetableTeacherUnavailability
    );
    if (!teacherId) {
      result.timetableTeacherUnavailability.skipped += 1;
      continue;
    }

    try {
      const backupId = nullableText(row.id);
      const dayOfWeek = requiredText(row.dayOfWeek, "Day of week");
      const periodNumber = positiveInteger(row.periodNumber, "Period number");
      const data = { teacherId, dayOfWeek, periodNumber, reason: nullableText(row.reason) };
      let existing = backupId
        ? await client.timetableTeacherUnavailability.findUnique({ where: { id: backupId } })
        : null;
      existing ??= await client.timetableTeacherUnavailability.findUnique({
        where: { teacherId_dayOfWeek_periodNumber: { teacherId, dayOfWeek, periodNumber } }
      });
      if (existing) {
        if (sameData(existing, data)) result.timetableTeacherUnavailability.skipped += 1;
        else {
          await client.timetableTeacherUnavailability.update({ where: { id: existing.id }, data });
          result.timetableTeacherUnavailability.updated += 1;
        }
      } else {
        await client.timetableTeacherUnavailability.create({
          data: { ...(backupId ? { id: backupId } : {}), ...data, ...createdAtData(row, index, "timetableTeacherUnavailability") }
        });
        result.timetableTeacherUnavailability.created += 1;
      }
    } catch (error) {
      result.timetableTeacherUnavailability.errors.push(
        rowError("Timetable teacher unavailability", index, error)
      );
    }
  }

  for (const [index, row] of backup.timetableFixedPeriods.entries()) {
    const classSectionId = mapOptionalTimetableId(
      row.classSectionId,
      classSectionIds,
      "class section",
      index,
      result.timetableFixedPeriods
    );
    const teacherId = mapOptionalTimetableId(
      row.teacherId,
      teacherIds,
      "teacher",
      index,
      result.timetableFixedPeriods
    );
    const subjectId = mapOptionalTimetableId(
      row.subjectId,
      subjectIds,
      "subject",
      index,
      result.timetableFixedPeriods
    );
    if (classSectionId === undefined || teacherId === undefined || subjectId === undefined) {
      result.timetableFixedPeriods.skipped += 1;
      continue;
    }

    try {
      const backupId = nullableText(row.id);
      const academicYear = requiredText(row.academicYear, "Academic year");
      const dayOfWeek = requiredText(row.dayOfWeek, "Day of week");
      const periodNumber = positiveInteger(row.periodNumber, "Period number");
      const label = requiredText(row.label, "Label");
      const data = {
        academicYear,
        classSectionId,
        teacherId,
        subjectId,
        dayOfWeek,
        periodNumber,
        label,
        reason: nullableText(row.reason)
      };
      let existing = backupId
        ? await client.timetableFixedPeriod.findUnique({ where: { id: backupId } })
        : null;
      existing ??= await client.timetableFixedPeriod.findFirst({
        where: {
          academicYear,
          classSectionId,
          teacherId,
          subjectId,
          dayOfWeek,
          periodNumber,
          label
        }
      });
      if (existing) {
        if (sameData(existing, data)) result.timetableFixedPeriods.skipped += 1;
        else {
          await client.timetableFixedPeriod.update({ where: { id: existing.id }, data });
          result.timetableFixedPeriods.updated += 1;
        }
      } else {
        await client.timetableFixedPeriod.create({
          data: { ...(backupId ? { id: backupId } : {}), ...data, ...createdAtData(row, index, "timetableFixedPeriods") }
        });
        result.timetableFixedPeriods.created += 1;
      }
    } catch (error) {
      result.timetableFixedPeriods.errors.push(rowError("Timetable fixed period", index, error));
    }
  }

  for (const [index, row] of backup.timetableDrafts.entries()) {
    try {
      const backupId = nullableText(row.id);
      const academicYear = requiredText(row.academicYear, "Academic year");
      const name = requiredText(row.name, "Draft name");
      let status = requiredText(row.status, "Draft status");
      const existingActive = status === "ACTIVE"
        ? await client.timetableDraft.findFirst({ where: { academicYear, status: "ACTIVE" } })
        : null;
      if (existingActive && existingActive.id !== backupId) {
        status = "DRAFT";
        result.timetableDrafts.warnings.push(
          `Draft ${index + 1} was restored as DRAFT because ${academicYear} already has an ACTIVE draft.`
        );
      }
      if (status === "ACTIVE" && activeDraftYears.has(academicYear)) {
        status = "DRAFT";
        result.timetableDrafts.warnings.push(
          `Draft ${index + 1} was restored as DRAFT because another ACTIVE draft already exists for ${academicYear}.`
        );
      }
      const data = {
        academicYear,
        name,
        status,
        notes: nullableText(row.notes),
        createdByUserId: null
      };
      let existing = backupId ? await client.timetableDraft.findUnique({ where: { id: backupId } }) : null;
      existing ??= await client.timetableDraft.findUnique({ where: { academicYear_name: { academicYear, name } } });
      const draft = existing
        ? sameData(existing, data)
          ? existing
          : await client.timetableDraft.update({ where: { id: existing.id }, data })
        : await client.timetableDraft.create({
            data: { ...(backupId ? { id: backupId } : {}), ...data, ...createdAtData(row, index, "timetableDrafts") }
          });
      if (existing) {
        if (draft === existing) result.timetableDrafts.skipped += 1;
        else result.timetableDrafts.updated += 1;
      } else {
        result.timetableDrafts.created += 1;
      }
      if (backupId) draftIds.set(backupId, draft.id);
      if (status === "ACTIVE") activeDraftYears.add(academicYear);
    } catch (error) {
      result.timetableDrafts.errors.push(rowError("Timetable draft", index, error));
    }
  }

  for (const [index, row] of backup.timetableEntries.entries()) {
    const draftId = mapRequiredTimetableId(row.draftId, draftIds, "draft", index, result.timetableEntries);
    const classSectionId = mapRequiredTimetableId(row.classSectionId, classSectionIds, "class section", index, result.timetableEntries);
    const assignmentId = mapOptionalTimetableId(row.assignmentId, assignmentIds, "assignment", index, result.timetableEntries);
    const teacherId = mapOptionalTimetableId(row.teacherId, teacherIds, "teacher", index, result.timetableEntries);
    const subjectId = mapOptionalTimetableId(row.subjectId, subjectIds, "subject", index, result.timetableEntries);
    if (!draftId || !classSectionId || assignmentId === undefined || teacherId === undefined || subjectId === undefined) {
      result.timetableEntries.skipped += 1;
      continue;
    }
    try {
      const backupId = nullableText(row.id);
      const dayOfWeek = requiredText(row.dayOfWeek, "Day of week");
      const periodNumber = positiveInteger(row.periodNumber, "Period number");
      const data = {
        draftId,
        academicYear: requiredText(row.academicYear, "Academic year"),
        classSectionId,
        dayOfWeek,
        periodNumber,
        assignmentId,
        teacherId,
        subjectId,
        label: nullableText(row.label),
        entryType: requiredText(row.entryType, "Entry type"),
        isLocked: booleanOr(row.isLocked, false),
        notes: nullableText(row.notes)
      };
      let existing = backupId ? await client.timetableEntry.findUnique({ where: { id: backupId } }) : null;
      existing ??= await client.timetableEntry.findUnique({
        where: { draftId_classSectionId_dayOfWeek_periodNumber: { draftId, classSectionId, dayOfWeek, periodNumber } }
      });
      if (existing) {
        if (sameData(existing, data)) result.timetableEntries.skipped += 1;
        else {
          await client.timetableEntry.update({ where: { id: existing.id }, data });
          result.timetableEntries.updated += 1;
        }
      } else {
        await client.timetableEntry.create({
          data: { ...(backupId ? { id: backupId } : {}), ...data, ...createdAtData(row, index, "timetableEntries") }
        });
        result.timetableEntries.created += 1;
      }
    } catch (error) {
      result.timetableEntries.errors.push(rowError("Timetable entry", index, error));
    }
  }
}

export async function restoreImportVerificationData(
  client: Pick<RestoreDatabaseClient, "importBatch" | "goLiveChecklist">,
  backup: Pick<ValidatedBackup, "importBatches" | "goLiveChecklist">,
  restoredBy: { id: string; name: string },
  backupUserToLocalUser: Map<string, string>,
  result: Pick<RestoreResult, "importBatches" | "goLiveChecklist">
) {
  for (const [index, row] of backup.importBatches.entries()) {
    try {
      const id = requiredText(row.id, "Import batch ID");
      const existing = await client.importBatch.findUnique({ where: { id } });
      if (existing) {
        result.importBatches.skipped += 1;
        continue;
      }

      const originalUserId = nullableText(row.importedByUserId);
      const importedByUserId = originalUserId
        ? backupUserToLocalUser.get(originalUserId) ?? restoredBy.id
        : restoredBy.id;
      if (!originalUserId || importedByUserId === restoredBy.id && !backupUserToLocalUser.has(originalUserId)) {
        result.importBatches.warnings.push(
          `Import batch ${index + 1} creator could not be matched; mapped to ${restoredBy.name}.`
        );
      }

      await client.importBatch.create({
        data: {
          id,
          type: requiredText(row.type, "Import type"),
          fileName: requiredText(row.fileName, "File name"),
          importedByUserId,
          importedByName: textOr(row.importedByName, restoredBy.name),
          importedAt: requiredDate(row.importedAt, `importBatches[${index}].importedAt`),
          mode: requiredText(row.mode, "Import mode"),
          totalRows: nonNegativeInteger(row.totalRows, "Total rows"),
          createdCount: nonNegativeInteger(row.createdCount, "Created count"),
          updatedCount: nonNegativeInteger(row.updatedCount, "Updated count"),
          skippedCount: nonNegativeInteger(row.skippedCount, "Skipped count"),
          errorCount: nonNegativeInteger(row.errorCount, "Error count"),
          warningCount: nonNegativeInteger(row.warningCount, "Warning count"),
          status: requiredText(row.status, "Import status"),
          notes: nullableText(row.notes),
          detailsJson: nullableText(row.detailsJson)
        }
      });
      result.importBatches.created += 1;
    } catch (error) {
      result.importBatches.errors.push(rowError("Import batch", index, error));
    }
  }

  for (const [index, row] of backup.goLiveChecklist.entries()) {
    try {
      if (nullableText(row.id) && nullableText(row.id) !== "go-live") {
        result.goLiveChecklist.warnings.push(
          `Checklist ${index + 1} used a non-standard ID and was restored as go-live.`
        );
      }
      const where = { id: "go-live" };
      const existing = await client.goLiveChecklist.findUnique({ where });
      const data = checklistData(row, restoredBy.name);
      if (existing) {
        await client.goLiveChecklist.update({ where, data });
        result.goLiveChecklist.updated += 1;
      } else {
        await client.goLiveChecklist.create({
          data: {
            id: "go-live",
            ...data,
            createdAt: optionalDate(row.createdAt, `goLiveChecklist[${index}].createdAt`) ?? undefined
          }
        });
        result.goLiveChecklist.created += 1;
      }
    } catch (error) {
      result.goLiveChecklist.errors.push(rowError("Go-live checklist", index, error));
    }
  }
}

export async function restoreNotificationData(
  client: Pick<RestoreDatabaseClient, "notificationTemplate" | "notificationCampaign" | "notificationRecipient" | "notificationSkippedRecipient" | "notificationEvent" | "user">,
  backup: Pick<ValidatedBackup, "notificationTemplates" | "notificationCampaigns" | "notificationRecipients" | "notificationSkippedRecipients" | "notificationEvents">,
  backupUserToLocalUser: Map<string, string>,
  result: Pick<RestoreResult, "notificationTemplates" | "notificationCampaigns" | "notificationRecipients" | "notificationSkippedRecipients" | "notificationEvents" | "warnings">
) {
  const db = client as any;
  const templateMap = new Map<string, string>();
  const campaignMap = new Map<string, string>();
  const recipientMap = new Map<string, string>();

  for (const [index, row] of backup.notificationTemplates.entries()) {
    try {
      const id = requiredText(row.id, "Notification template ID");
      const templateCode = requiredText(row.templateCode, "Notification template code");
      const [byId, byCode] = await Promise.all([
        db.notificationTemplate.findUnique({ where: { id } }),
        db.notificationTemplate.findUnique({ where: { templateCode } })
      ]);
      if ((byId && byId.templateCode !== templateCode) || (byCode && byCode.id !== id)) {
        result.notificationTemplates.skipped += 1;
        result.warnings.push(`Notification template ${templateCode} collided with a different local identity and was isolated.`);
        continue;
      }
      if (byId) {
        templateMap.set(id, id);
        result.notificationTemplates.skipped += 1;
        continue;
      }
      await db.notificationTemplate.create({ data: {
        id, templateCode, name: requiredText(row.name, "Notification template name"),
        category: requiredText(row.category, "Notification template category"),
        defaultPriority: requiredText(row.defaultPriority, "Notification template priority"),
        titleTemplate: requiredText(row.titleTemplate, "Notification title template"),
        bodyTemplate: requiredText(row.bodyTemplate, "Notification body template"),
        actionLabel: nullableText(row.actionLabel), actionPath: nullableText(row.actionPath),
        acknowledgmentRequired: booleanOr(row.acknowledgmentRequired, false),
        status: requiredText(row.status, "Notification template status"),
        versionNumber: positiveInteger(row.versionNumber, "Notification template version"),
        createdByUserId: null, activatedByUserId: null,
        ...createdAtData(row, index, "notificationTemplates")
      } });
      templateMap.set(id, id);
      result.notificationTemplates.created += 1;
    } catch (error) {
      result.notificationTemplates.errors.push(rowError("Notification template", index, error));
    }
  }

  for (const [index, row] of backup.notificationCampaigns.entries()) {
    try {
      const id = requiredText(row.id, "Notification campaign ID");
      const campaignNumber = requiredText(row.campaignNumber, "Notification campaign number");
      const templateId = row.templateId ? templateMap.get(String(row.templateId)) : null;
      if (row.templateId && !templateId) {
        result.notificationCampaigns.skipped += 1;
        result.warnings.push(`Notification campaign ${campaignNumber} was isolated because its template could not be mapped.`);
        continue;
      }
      const [byId, byNumber] = await Promise.all([
        db.notificationCampaign.findUnique({ where: { id } }),
        db.notificationCampaign.findUnique({ where: { campaignNumber } })
      ]);
      if ((byId && byId.campaignNumber !== campaignNumber) || (byNumber && byNumber.id !== id)) {
        result.notificationCampaigns.skipped += 1;
        result.warnings.push(`Notification campaign ${campaignNumber} collided with preserved local history and was isolated.`);
        continue;
      }
      if (byId) {
        campaignMap.set(id, id);
        result.notificationCampaigns.skipped += 1;
        continue;
      }
      await db.notificationCampaign.create({ data: {
        id, campaignNumber, templateId,
        category: requiredText(row.category, "Notification category"),
        priority: requiredText(row.priority, "Notification priority"),
        title: requiredText(row.title, "Notification title"),
        body: requiredText(row.body, "Notification body"),
        actionLabel: nullableText(row.actionLabel), actionPath: nullableText(row.actionPath),
        audienceType: requiredText(row.audienceType, "Notification audience"),
        audienceDefinitionJson: requiredText(row.audienceDefinitionJson, "Notification audience definition"),
        audienceSnapshotJson: nullableText(row.audienceSnapshotJson),
        templateSnapshotJson: nullableText(row.templateSnapshotJson),
        channel: "IN_APP",
        status: requiredText(row.status, "Notification campaign status"),
        acknowledgmentRequired: booleanOr(row.acknowledgmentRequired, false),
        scheduledFor: optionalDate(row.scheduledFor, "Notification scheduled time"),
        expiresAt: optionalDate(row.expiresAt, "Notification expiry"),
        totalResolvedUsers: nonNegativeInteger(row.totalResolvedUsers, "Resolved users"),
        totalRecipientRows: nonNegativeInteger(row.totalRecipientRows, "Recipient rows"),
        totalSkipped: nonNegativeInteger(row.totalSkipped, "Skipped recipients"),
        totalRead: nonNegativeInteger(row.totalRead, "Read total"),
        totalAcknowledged: nonNegativeInteger(row.totalAcknowledged, "Acknowledged total"),
        totalDismissed: nonNegativeInteger(row.totalDismissed, "Dismissed total"),
        correctionOfCampaignId: null,
        reviewNotes: nullableText(row.reviewNotes), withdrawalReason: nullableText(row.withdrawalReason),
        cancellationReason: nullableText(row.cancellationReason),
        createdByUserId: null, submittedByUserId: null, approvedByUserId: null, publishedByUserId: null,
        withdrawnByUserId: null, cancelledByUserId: null, archivedByUserId: null,
        submittedAt: optionalDate(row.submittedAt, "Notification submitted time"),
        approvedAt: optionalDate(row.approvedAt, "Notification approved time"),
        publishedAt: optionalDate(row.publishedAt, "Notification published time"),
        withdrawnAt: optionalDate(row.withdrawnAt, "Notification withdrawn time"),
        cancelledAt: optionalDate(row.cancelledAt, "Notification cancelled time"),
        archivedAt: optionalDate(row.archivedAt, "Notification archived time"),
        ...createdAtData(row, index, "notificationCampaigns")
      } });
      campaignMap.set(id, id);
      result.notificationCampaigns.created += 1;
    } catch (error) {
      result.notificationCampaigns.errors.push(rowError("Notification campaign", index, error));
    }
  }
  for (const [index, row] of backup.notificationCampaigns.entries()) {
    try {
      const id = campaignMap.get(String(row.id ?? ""));
      if (!id || !row.correctionOfCampaignId) continue;
      const correctionOfCampaignId = campaignMap.get(String(row.correctionOfCampaignId));
      if (!correctionOfCampaignId) {
        result.warnings.push(`Notification correction ${String(row.campaignNumber ?? id)} was restored without a broken supersession link.`);
        continue;
      }
      const current = await db.notificationCampaign.findUnique({ where: { id }, select: { correctionOfCampaignId: true } });
      if (!current?.correctionOfCampaignId) await db.notificationCampaign.update({ where: { id }, data: { correctionOfCampaignId } });
    } catch (error) {
      result.notificationCampaigns.errors.push(rowError("Notification correction link", index, error));
    }
  }

  for (const [index, row] of backup.notificationRecipients.entries()) {
    try {
      const id = requiredText(row.id, "Notification recipient ID");
      const campaignId = campaignMap.get(requiredText(row.campaignId, "Notification recipient campaign"));
      const userId = backupUserToLocalUser.get(requiredText(row.userId, "Notification recipient user"));
      if (!campaignId || !userId) {
        result.notificationRecipients.skipped += 1;
        result.warnings.push(`Notification recipient ${index + 1} was isolated because its exact campaign or local User mapping was unavailable.`);
        continue;
      }
      const context = JSON.parse(requiredText(row.recipientContextJson, "Notification recipient context"));
      const localUser = await db.user.findUnique({
        where: { id: userId },
        include: {
          guardian: { include: { students: { include: { student: { select: { admissionNo: true } } } } } },
          staffMember: { select: { id: true } }
        }
      });
      if (!localUser || localUser.role !== String(row.recipientRoleSnapshot)) {
        result.notificationRecipients.skipped += 1;
        result.warnings.push(`Notification recipient ${index + 1} was isolated because the local User role did not match its immutable snapshot.`);
        continue;
      }
      if (localUser.role === "PARENT") {
        const allowed = new Set((localUser.guardian?.students ?? []).map((link: any) => link.student.admissionNo));
        const targeted = Array.isArray(context.targetedChildren) ? context.targetedChildren : [];
        if (targeted.some((child: any) => !allowed.has(String(child.admissionNo)))) {
          result.notificationRecipients.skipped += 1;
          result.warnings.push(`Notification recipient ${index + 1} was isolated because current Guardian-Student ownership did not match.`);
          continue;
        }
      } else if (["TEACHER", "STAFF"].includes(String(row.contextType)) && !localUser.staffMember) {
        result.notificationRecipients.skipped += 1;
        result.warnings.push(`Notification recipient ${index + 1} was isolated because its current StaffMember link was missing.`);
        continue;
      }
      const byId = await db.notificationRecipient.findUnique({ where: { id } });
      const byUser = await db.notificationRecipient.findUnique({ where: { campaignId_userId: { campaignId, userId } } });
      if ((byId && (byId.campaignId !== campaignId || byId.userId !== userId)) || (byUser && byUser.id !== id)) {
        result.notificationRecipients.skipped += 1;
        result.warnings.push(`Notification recipient ${index + 1} collided with preserved local campaign/User history and was isolated.`);
        continue;
      }
      if (byId) {
        recipientMap.set(String(row.id), byId.id);
        result.notificationRecipients.skipped += 1;
        continue;
      }
      await db.notificationRecipient.create({ data: {
        id, campaignId, userId,
        recipientRoleSnapshot: requiredText(row.recipientRoleSnapshot, "Recipient role snapshot"),
        contextType: requiredText(row.contextType, "Recipient context type"),
        recipientContextJson: JSON.stringify(context),
        deliveryStatus: requiredText(row.deliveryStatus, "Recipient delivery status"),
        availableAt: requiredDate(row.availableAt, "Recipient available time"),
        firstViewedAt: optionalDate(row.firstViewedAt, "Recipient first viewed time"),
        readAt: optionalDate(row.readAt, "Recipient read time"),
        acknowledgedAt: optionalDate(row.acknowledgedAt, "Recipient acknowledged time"),
        dismissedAt: optionalDate(row.dismissedAt, "Recipient dismissed time"),
        expiredAt: optionalDate(row.expiredAt, "Recipient expired time"),
        ...createdAtData(row, index, "notificationRecipients")
      } });
      recipientMap.set(String(row.id), id);
      result.notificationRecipients.created += 1;
    } catch (error) {
      result.notificationRecipients.errors.push(rowError("Notification recipient", index, error));
    }
  }

  for (const [index, row] of backup.notificationSkippedRecipients.entries()) {
    try {
      const id = requiredText(row.id, "Skipped notification recipient ID");
      const campaignId = campaignMap.get(requiredText(row.campaignId, "Skipped notification campaign"));
      if (!campaignId) { result.notificationSkippedRecipients.skipped += 1; continue; }
      if (await db.notificationSkippedRecipient.findUnique({ where: { id } })) { result.notificationSkippedRecipients.skipped += 1; continue; }
      await db.notificationSkippedRecipient.create({ data: {
        id, campaignId, targetType: requiredText(row.targetType, "Skipped target type"),
        targetReferenceKey: requiredText(row.targetReferenceKey, "Skipped target reference"),
        reasonCode: requiredText(row.reasonCode, "Skipped reason"),
        safeContextJson: nullableText(row.safeContextJson),
        ...createdAtData(row, index, "notificationSkippedRecipients")
      } });
      result.notificationSkippedRecipients.created += 1;
    } catch (error) {
      result.notificationSkippedRecipients.errors.push(rowError("Skipped notification recipient", index, error));
    }
  }

  for (const [index, row] of backup.notificationEvents.entries()) {
    try {
      const id = requiredText(row.id, "Notification event ID");
      if (await db.notificationEvent.findUnique({ where: { id } })) { result.notificationEvents.skipped += 1; continue; }
      const templateId = row.templateId ? templateMap.get(String(row.templateId)) : null;
      const campaignId = row.campaignId ? campaignMap.get(String(row.campaignId)) : null;
      const recipientId = row.recipientId ? recipientMap.get(String(row.recipientId)) : null;
      if ((row.templateId && !templateId) || (row.campaignId && !campaignId) || (row.recipientId && !recipientId)) {
        result.notificationEvents.skipped += 1;
        continue;
      }
      await db.notificationEvent.create({ data: {
        id, templateId: templateId ?? null, campaignId: campaignId ?? null, recipientId: recipientId ?? null,
        eventType: requiredText(row.eventType, "Notification event type"),
        eventDate: requiredDate(row.eventDate, "Notification event date"),
        previousStatus: nullableText(row.previousStatus), newStatus: nullableText(row.newStatus),
        reason: nullableText(row.reason), notes: nullableText(row.notes), recordedByUserId: null,
        ...createdAtData(row, index, "notificationEvents")
      } });
      result.notificationEvents.created += 1;
    } catch (error) {
      result.notificationEvents.errors.push(rowError("Notification event", index, error));
    }
  }
}

export async function restoreWhatsAppData(
  client: Pick<RestoreDatabaseClient,
    "whatsAppIntegrationProfile" | "whatsAppConsent" | "whatsAppConsentEvent" |
    "whatsAppTemplateMapping" | "whatsAppOutboundBatch" | "whatsAppDelivery" |
    "whatsAppDeliveryAttempt" | "whatsAppWebhookEvent" | "whatsAppOperationalEvent" | "whatsAppRateReference" |
    "staffMember" | "notificationCampaign" | "notificationRecipient">,
  backup: Pick<ValidatedBackup,
    "staffMembers" | "whatsAppIntegrationProfiles" | "whatsAppConsents" | "whatsAppConsentEvents" |
    "whatsAppTemplateMappings" | "whatsAppOutboundBatches" | "whatsAppDeliveries" |
    "whatsAppDeliveryAttempts" | "whatsAppWebhookEvents" | "whatsAppOperationalEvents" | "whatsAppRateReferences">,
  guardianMap: Map<string, string>,
  result: Pick<RestoreResult,
    "whatsAppIntegrationProfiles" | "whatsAppConsents" | "whatsAppConsentEvents" |
    "whatsAppTemplateMappings" | "whatsAppOutboundBatches" | "whatsAppDeliveries" |
    "whatsAppDeliveryAttempts" | "whatsAppWebhookEvents" | "whatsAppOperationalEvents" | "whatsAppRateReferences" | "warnings">
) {
  const db = client as any;
  const profileMap = new Map<string, string>(), consentMap = new Map<string, string>(), mappingMap = new Map<string, string>();
  const batchMap = new Map<string, string>(), deliveryMap = new Map<string, string>(), staffMap = new Map<string, string>();
  for (const row of backup.staffMembers) {
    const backupId = requiredText(row.id, "WhatsApp backup StaffMember ID"), code = nullableText(row.staffCode);
    const local = await db.staffMember.findFirst({ where: { OR: [{ id: backupId }, ...(code ? [{ staffCode: code }] : [])] }, select: { id: true } });
    if (local) staffMap.set(backupId, local.id);
  }
  for (const [index, row] of backup.whatsAppIntegrationProfiles.entries()) try {
    const id = requiredText(row.id, "WhatsApp profile ID"), profileCode = requiredText(row.profileCode, "WhatsApp profile code");
    const [byId, byCode] = await Promise.all([
      db.whatsAppIntegrationProfile.findUnique({ where: { id } }),
      db.whatsAppIntegrationProfile.findUnique({ where: { profileCode } })
    ]);
    if ((byId && byId.profileCode !== profileCode) || (byCode && byCode.id !== id)) {
      result.whatsAppIntegrationProfiles.skipped++; result.warnings.push(`WhatsApp profile ${profileCode} collided with preserved local history and was isolated.`); continue;
    }
    if (byId) { profileMap.set(id, id); result.whatsAppIntegrationProfiles.skipped++; continue; }
    await db.whatsAppIntegrationProfile.create({ data: whatsappRestoreData(row, PROFILE_RESTORE_DATES) });
    profileMap.set(id, id); result.whatsAppIntegrationProfiles.created++;
  } catch (error) { result.whatsAppIntegrationProfiles.errors.push(rowError("WhatsApp profile", index, error)); }
  for (const [index, row] of backup.whatsAppConsents.entries()) try {
    const id = requiredText(row.id, "WhatsApp consent ID"), backupGuardianId = nullableText(row.guardianId), backupStaffId = nullableText(row.staffMemberId);
    const guardianId = backupGuardianId ? guardianMap.get(backupGuardianId) : null, staffMemberId = backupStaffId ? staffMap.get(backupStaffId) : null;
    if ((backupGuardianId && !guardianId) || (backupStaffId && !staffMemberId)) {
      result.whatsAppConsents.skipped++; result.warnings.push(`WhatsApp consent ${id} was isolated because its exact subject link was unavailable.`); continue;
    }
    if (await db.whatsAppConsent.findUnique({ where: { id } })) { consentMap.set(id, id); result.whatsAppConsents.skipped++; continue; }
    await db.whatsAppConsent.create({ data: {
      ...whatsappRestoreData(row, CONSENT_RESTORE_DATES),
      guardianId: guardianId ?? null,
      staffMemberId: staffMemberId ?? null,
      collectedByUserId: null,
      revokedByUserId: null
    } });
    consentMap.set(id, id); result.whatsAppConsents.created++;
  } catch (error) { result.whatsAppConsents.errors.push(rowError("WhatsApp consent", index, error)); }
  for (const [index, row] of backup.whatsAppConsentEvents.entries()) try {
    const id = requiredText(row.id, "WhatsApp consent event ID"), consentId = consentMap.get(requiredText(row.consentId, "WhatsApp consent event link"));
    if (!consentId) { result.whatsAppConsentEvents.skipped++; continue; }
    if (await db.whatsAppConsentEvent.findUnique({ where: { id } })) { result.whatsAppConsentEvents.skipped++; continue; }
    await db.whatsAppConsentEvent.create({ data: { ...whatsappRestoreData(row, ["eventDate","createdAt"]), consentId, recordedByUserId: null } });
    result.whatsAppConsentEvents.created++;
  } catch (error) { result.whatsAppConsentEvents.errors.push(rowError("WhatsApp consent event", index, error)); }
  for (const [index, row] of backup.whatsAppTemplateMappings.entries()) try {
    const id = requiredText(row.id, "WhatsApp mapping ID"), mappingCode = requiredText(row.mappingCode, "WhatsApp mapping code");
    const integrationProfileId = profileMap.get(requiredText(row.integrationProfileId, "WhatsApp mapping profile"));
    if (!integrationProfileId) { result.whatsAppTemplateMappings.skipped++; continue; }
    const [byId, byCode] = await Promise.all([db.whatsAppTemplateMapping.findUnique({ where: { id } }), db.whatsAppTemplateMapping.findUnique({ where: { mappingCode } })]);
    if ((byId && byId.mappingCode !== mappingCode) || (byCode && byCode.id !== id)) {
      result.whatsAppTemplateMappings.skipped++; result.warnings.push(`WhatsApp mapping ${mappingCode} collided with preserved local history and was isolated.`); continue;
    }
    if (byId) { mappingMap.set(id, id); result.whatsAppTemplateMappings.skipped++; continue; }
    await db.whatsAppTemplateMapping.create({ data: { ...whatsappRestoreData(row, ["lastSyncedAt","createdAt","updatedAt"]), integrationProfileId, createdByUserId: null, activatedByUserId: null } });
    mappingMap.set(id, id); result.whatsAppTemplateMappings.created++;
  } catch (error) { result.whatsAppTemplateMappings.errors.push(rowError("WhatsApp mapping", index, error)); }
  for (const [index, row] of backup.whatsAppOutboundBatches.entries()) try {
    const id = requiredText(row.id, "WhatsApp batch ID"), batchNumber = requiredText(row.batchNumber, "WhatsApp batch number");
    const integrationProfileId = profileMap.get(requiredText(row.integrationProfileId, "WhatsApp batch profile"));
    const templateMappingId = mappingMap.get(requiredText(row.templateMappingId, "WhatsApp batch mapping"));
    const notificationCampaignId = requiredText(row.notificationCampaignId, "WhatsApp batch campaign");
    if (!integrationProfileId || !templateMappingId || !await db.notificationCampaign.findUnique({ where: { id: notificationCampaignId } })) { result.whatsAppOutboundBatches.skipped++; continue; }
    const [byId, byNumber] = await Promise.all([db.whatsAppOutboundBatch.findUnique({ where: { id } }), db.whatsAppOutboundBatch.findUnique({ where: { batchNumber } })]);
    if ((byId && byId.batchNumber !== batchNumber) || (byNumber && byNumber.id !== id)) {
      result.whatsAppOutboundBatches.skipped++; result.warnings.push(`WhatsApp batch ${batchNumber} collided with preserved local history and was isolated.`); continue;
    }
    if (byId) { batchMap.set(id, id); result.whatsAppOutboundBatches.skipped++; continue; }
    await db.whatsAppOutboundBatch.create({ data: {
      ...whatsappRestoreData(row, BATCH_RESTORE_DATES), integrationProfileId, templateMappingId, notificationCampaignId,
      createdByUserId: null, approvedByUserId: null, startedByUserId: null, cancelledByUserId: null
    } });
    batchMap.set(id, id); result.whatsAppOutboundBatches.created++;
  } catch (error) { result.whatsAppOutboundBatches.errors.push(rowError("WhatsApp batch", index, error)); }
  for (const [index, row] of backup.whatsAppDeliveries.entries()) try {
    const id = requiredText(row.id, "WhatsApp delivery ID"), batchId = batchMap.get(requiredText(row.batchId, "WhatsApp delivery batch"));
    const consentId = consentMap.get(requiredText(row.consentId, "WhatsApp delivery consent"));
    const backupSubjectId = requiredText(row.subjectReferenceId, "WhatsApp delivery subject"), subjectReferenceId = row.subjectType === "GUARDIAN" ? guardianMap.get(backupSubjectId) : staffMap.get(backupSubjectId);
    const notificationRecipientId = nullableText(row.notificationRecipientId);
    if (!batchId || !consentId || !subjectReferenceId || (notificationRecipientId && !await db.notificationRecipient.findUnique({ where: { id: notificationRecipientId } }))) { result.whatsAppDeliveries.skipped++; continue; }
    const providerMessageId = nullableText(row.providerMessageId);
    const [byId, byProvider] = await Promise.all([db.whatsAppDelivery.findUnique({ where: { id } }), providerMessageId ? db.whatsAppDelivery.findUnique({ where: { providerMessageId } }) : null]);
    if (byProvider && byProvider.id !== id) { result.whatsAppDeliveries.skipped++; result.warnings.push(`WhatsApp provider message ${providerMessageId} collided and was isolated.`); continue; }
    if (byId) { deliveryMap.set(id, id); result.whatsAppDeliveries.skipped++; continue; }
    await db.whatsAppDelivery.create({ data: { ...whatsappRestoreData(row, DELIVERY_RESTORE_DATES), batchId, consentId, subjectReferenceId, notificationRecipientId } });
    deliveryMap.set(id, id); result.whatsAppDeliveries.created++;
  } catch (error) { result.whatsAppDeliveries.errors.push(rowError("WhatsApp delivery", index, error)); }
  for (const [index, row] of backup.whatsAppDeliveryAttempts.entries()) try {
    const id = requiredText(row.id, "WhatsApp attempt ID"), deliveryId = deliveryMap.get(requiredText(row.deliveryId, "WhatsApp attempt delivery"));
    if (!deliveryId) { result.whatsAppDeliveryAttempts.skipped++; continue; }
    const attemptNumber = Number(row.attemptNumber);
    const [byId, byNumber] = await Promise.all([
      db.whatsAppDeliveryAttempt.findUnique({ where: { id } }),
      db.whatsAppDeliveryAttempt.findUnique({ where: { deliveryId_attemptNumber: { deliveryId, attemptNumber } } })
    ]);
    if ((byNumber && byNumber.id !== id) || (byId && (byId.deliveryId !== deliveryId || byId.attemptNumber !== attemptNumber))) { result.whatsAppDeliveryAttempts.skipped++; continue; }
    if (byId) { result.whatsAppDeliveryAttempts.skipped++; continue; }
    await db.whatsAppDeliveryAttempt.create({ data: { ...whatsappRestoreData(row, ["startedAt","completedAt","createdAt"]), deliveryId } });
    result.whatsAppDeliveryAttempts.created++;
  } catch (error) { result.whatsAppDeliveryAttempts.errors.push(rowError("WhatsApp attempt", index, error)); }
  for (const [index, row] of backup.whatsAppWebhookEvents.entries()) try {
    const id = requiredText(row.id, "WhatsApp webhook ID"), eventKey = requiredText(row.eventKey, "WhatsApp webhook key");
    const integrationProfileId = profileMap.get(requiredText(row.integrationProfileId, "WhatsApp webhook profile"));
    const backupDeliveryId = nullableText(row.deliveryId), deliveryId = backupDeliveryId ? deliveryMap.get(backupDeliveryId) : null;
    if (!integrationProfileId || (backupDeliveryId && !deliveryId)) { result.whatsAppWebhookEvents.skipped++; continue; }
    const [byId, byKey] = await Promise.all([db.whatsAppWebhookEvent.findUnique({ where: { id } }), db.whatsAppWebhookEvent.findUnique({ where: { eventKey } })]);
    if ((byKey && byKey.id !== id) || (byId && byId.eventKey !== eventKey)) { result.whatsAppWebhookEvents.skipped++; result.warnings.push(`WhatsApp webhook event ${eventKey} collided and was isolated.`); continue; }
    if (byId) { result.whatsAppWebhookEvents.skipped++; continue; }
    await db.whatsAppWebhookEvent.create({ data: { ...whatsappRestoreData(row, ["receivedAt","processedAt","createdAt"]), integrationProfileId, deliveryId: deliveryId ?? null } });
    result.whatsAppWebhookEvents.created++;
  } catch (error) { result.whatsAppWebhookEvents.errors.push(rowError("WhatsApp webhook", index, error)); }
  for (const [index, row] of backup.whatsAppOperationalEvents.entries()) try {
    const id = requiredText(row.id, "WhatsApp operational event ID"), eventKey = requiredText(row.eventKey, "WhatsApp operational event key");
    const integrationProfileId = profileMap.get(requiredText(row.integrationProfileId, "WhatsApp operational event profile"));
    const backupBatchId = nullableText(row.batchId), batchId = backupBatchId ? batchMap.get(backupBatchId) : null;
    if (!integrationProfileId || (backupBatchId && !batchId)) { result.whatsAppOperationalEvents.skipped++; continue; }
    const [byId, byKey] = await Promise.all([db.whatsAppOperationalEvent.findUnique({ where: { id } }), db.whatsAppOperationalEvent.findUnique({ where: { eventKey } })]);
    if ((byKey && byKey.id !== id) || (byId && byId.eventKey !== eventKey)) {
      result.whatsAppOperationalEvents.skipped++; result.warnings.push(`WhatsApp operational event ${eventKey} collided and was isolated.`); continue;
    }
    if (byId) { result.whatsAppOperationalEvents.skipped++; continue; }
    await db.whatsAppOperationalEvent.create({ data: {
      ...whatsappRestoreData(row, ["periodStart","periodEnd","nextEligibleAt","lastOccurredAt","createdAt"]),
      integrationProfileId, batchId: batchId ?? null, recordedByUserId: null
    } });
    result.whatsAppOperationalEvents.created++;
  } catch (error) { result.whatsAppOperationalEvents.errors.push(rowError("WhatsApp operational event", index, error)); }
  for (const [index, row] of backup.whatsAppRateReferences.entries()) try {
    const id = requiredText(row.id, "WhatsApp rate ID"), backupProfileId = nullableText(row.integrationProfileId), integrationProfileId = backupProfileId ? profileMap.get(backupProfileId) : null;
    if (backupProfileId && !integrationProfileId) { result.whatsAppRateReferences.skipped++; continue; }
    const key = { rateVersion: requiredText(row.rateVersion, "Rate version"), market: requiredText(row.market, "Rate market"), templateCategory: requiredText(row.templateCategory, "Rate category"), currency: requiredText(row.currency, "Rate currency") };
    const [byId, byKey] = await Promise.all([db.whatsAppRateReference.findUnique({ where: { id } }), db.whatsAppRateReference.findUnique({ where: { rateVersion_market_templateCategory_currency: key } })]);
    if ((byKey && byKey.id !== id) || (byId && byId.rateVersion !== key.rateVersion)) { result.whatsAppRateReferences.skipped++; continue; }
    if (byId) { result.whatsAppRateReferences.skipped++; continue; }
    await db.whatsAppRateReference.create({ data: { ...whatsappRestoreData(row, ["effectiveDate","sourceReviewDate","createdAt","updatedAt"]), integrationProfileId: integrationProfileId ?? null } });
    result.whatsAppRateReferences.created++;
  } catch (error) { result.whatsAppRateReferences.errors.push(rowError("WhatsApp rate reference", index, error)); }
}

export async function restoreSmsEmailData(
  client: Pick<RestoreDatabaseClient,
    "smsEmailIntegrationProfile" | "smsEmailConsent" | "smsEmailConsentEvent" |
    "smsEmailTemplateMapping" | "smsEmailOutboundBatch" | "smsEmailDelivery" |
    "smsEmailDeliveryAttempt" | "smsEmailWebhookEvent" | "smsEmailOperationalEvent" |
    "smsEmailSuppression" | "smsEmailCostRate" | "staffMember" |
    "notificationCampaign" | "notificationRecipient">,
  backup: Pick<ValidatedBackup,
    "staffMembers" | "smsEmailIntegrationProfiles" | "smsEmailConsents" | "smsEmailConsentEvents" |
    "smsEmailTemplateMappings" | "smsEmailOutboundBatches" | "smsEmailDeliveries" |
    "smsEmailDeliveryAttempts" | "smsEmailWebhookEvents" | "smsEmailOperationalEvents" |
    "smsEmailSuppressions" | "smsEmailCostRates">,
  guardianMap: Map<string, string>,
  result: Pick<RestoreResult,
    "smsEmailIntegrationProfiles" | "smsEmailConsents" | "smsEmailConsentEvents" |
    "smsEmailTemplateMappings" | "smsEmailOutboundBatches" | "smsEmailDeliveries" |
    "smsEmailDeliveryAttempts" | "smsEmailWebhookEvents" | "smsEmailOperationalEvents" |
    "smsEmailSuppressions" | "smsEmailCostRates" | "warnings">
) {
  const db = client as any;
  const profileMap = new Map<string, string>(), consentMap = new Map<string, string>(), mappingMap = new Map<string, string>();
  const batchMap = new Map<string, string>(), deliveryMap = new Map<string, string>(), staffMap = new Map<string, string>();
  for (const row of backup.staffMembers) {
    const backupId = requiredText(row.id, "SMS/Email backup StaffMember ID"), code = nullableText(row.staffCode);
    const local = await db.staffMember.findFirst({ where: { OR: [{ id: backupId }, ...(code ? [{ staffCode: code }] : [])] }, select: { id: true } });
    if (local) staffMap.set(backupId, local.id);
  }

  for (const [index, row] of backup.smsEmailIntegrationProfiles.entries()) try {
    const id = requiredText(row.id, "SMS/Email profile ID"), profileCode = requiredText(row.profileCode, "SMS/Email profile code");
    const [byId, byCode] = await Promise.all([
      db.smsEmailIntegrationProfile.findUnique({ where: { id } }),
      db.smsEmailIntegrationProfile.findUnique({ where: { profileCode } })
    ]);
    if ((byId && byId.profileCode !== profileCode) || (byCode && byCode.id !== id)) {
      result.smsEmailIntegrationProfiles.skipped++; result.warnings.push(`SMS/Email profile ${profileCode} collided with preserved local history and was isolated.`); continue;
    }
    if (byId) { profileMap.set(id, id); result.smsEmailIntegrationProfiles.skipped++; continue; }
    await db.smsEmailIntegrationProfile.create({ data: smsEmailRestoreData(row, SMS_EMAIL_PROFILE_DATES, ["activatedByUserId", "pausedByUserId"]) });
    profileMap.set(id, id); result.smsEmailIntegrationProfiles.created++;
  } catch (error) { result.smsEmailIntegrationProfiles.errors.push(rowError("SMS/Email profile", index, error)); }

  for (const [index, row] of backup.smsEmailConsents.entries()) try {
    const id = requiredText(row.id, "SMS/Email consent ID"), backupGuardianId = nullableText(row.guardianId), backupStaffId = nullableText(row.staffMemberId);
    const guardianId = backupGuardianId ? guardianMap.get(backupGuardianId) : null, staffMemberId = backupStaffId ? staffMap.get(backupStaffId) : null;
    if ((backupGuardianId && !guardianId) || (backupStaffId && !staffMemberId)) {
      result.smsEmailConsents.skipped++; result.warnings.push(`SMS/Email consent ${id} was isolated because its exact subject link was unavailable.`); continue;
    }
    if (await db.smsEmailConsent.findUnique({ where: { id } })) { consentMap.set(id, id); result.smsEmailConsents.skipped++; continue; }
    await db.smsEmailConsent.create({ data: {
      ...smsEmailRestoreData(row, SMS_EMAIL_CONSENT_DATES, ["collectedByUserId", "revokedByUserId"]),
      guardianId: guardianId ?? null, staffMemberId: staffMemberId ?? null
    } });
    consentMap.set(id, id); result.smsEmailConsents.created++;
  } catch (error) { result.smsEmailConsents.errors.push(rowError("SMS/Email consent", index, error)); }

  for (const [index, row] of backup.smsEmailConsentEvents.entries()) try {
    const id = requiredText(row.id, "SMS/Email consent event ID"), consentId = consentMap.get(requiredText(row.consentId, "SMS/Email consent event link"));
    if (!consentId) { result.smsEmailConsentEvents.skipped++; continue; }
    if (await db.smsEmailConsentEvent.findUnique({ where: { id } })) { result.smsEmailConsentEvents.skipped++; continue; }
    await db.smsEmailConsentEvent.create({ data: { ...smsEmailRestoreData(row, ["eventDate", "createdAt"], ["recordedByUserId"]), consentId } });
    result.smsEmailConsentEvents.created++;
  } catch (error) { result.smsEmailConsentEvents.errors.push(rowError("SMS/Email consent event", index, error)); }

  for (const [index, row] of backup.smsEmailTemplateMappings.entries()) try {
    const id = requiredText(row.id, "SMS/Email mapping ID"), mappingCode = requiredText(row.mappingCode, "SMS/Email mapping code");
    const integrationProfileId = profileMap.get(requiredText(row.integrationProfileId, "SMS/Email mapping profile"));
    if (!integrationProfileId) { result.smsEmailTemplateMappings.skipped++; continue; }
    const [byId, byCode] = await Promise.all([db.smsEmailTemplateMapping.findUnique({ where: { id } }), db.smsEmailTemplateMapping.findUnique({ where: { mappingCode } })]);
    if ((byId && byId.mappingCode !== mappingCode) || (byCode && byCode.id !== id)) {
      result.smsEmailTemplateMappings.skipped++; result.warnings.push(`SMS/Email mapping ${mappingCode} collided with preserved local history and was isolated.`); continue;
    }
    if (byId) { mappingMap.set(id, id); result.smsEmailTemplateMappings.skipped++; continue; }
    await db.smsEmailTemplateMapping.create({ data: { ...smsEmailRestoreData(row, ["lastSyncedAt", "createdAt", "updatedAt"], ["createdByUserId", "activatedByUserId"]), integrationProfileId } });
    mappingMap.set(id, id); result.smsEmailTemplateMappings.created++;
  } catch (error) { result.smsEmailTemplateMappings.errors.push(rowError("SMS/Email mapping", index, error)); }

  for (const [index, row] of backup.smsEmailOutboundBatches.entries()) try {
    const id = requiredText(row.id, "SMS/Email batch ID"), batchNumber = requiredText(row.batchNumber, "SMS/Email batch number");
    const integrationProfileId = profileMap.get(requiredText(row.integrationProfileId, "SMS/Email batch profile"));
    const templateMappingId = mappingMap.get(requiredText(row.templateMappingId, "SMS/Email batch mapping"));
    const notificationCampaignId = requiredText(row.notificationCampaignId, "SMS/Email batch campaign");
    if (!integrationProfileId || !templateMappingId || !await db.notificationCampaign.findUnique({ where: { id: notificationCampaignId } })) { result.smsEmailOutboundBatches.skipped++; continue; }
    const [byId, byNumber] = await Promise.all([db.smsEmailOutboundBatch.findUnique({ where: { id } }), db.smsEmailOutboundBatch.findUnique({ where: { batchNumber } })]);
    if ((byId && byId.batchNumber !== batchNumber) || (byNumber && byNumber.id !== id)) {
      result.smsEmailOutboundBatches.skipped++; result.warnings.push(`SMS/Email batch ${batchNumber} collided with preserved local history and was isolated.`); continue;
    }
    if (byId) { batchMap.set(id, id); result.smsEmailOutboundBatches.skipped++; continue; }
    await db.smsEmailOutboundBatch.create({ data: {
      ...smsEmailRestoreData(row, SMS_EMAIL_BATCH_DATES, ["createdByUserId", "approvedByUserId", "startedByUserId", "cancelledByUserId"]),
      integrationProfileId, templateMappingId, notificationCampaignId
    } });
    batchMap.set(id, id); result.smsEmailOutboundBatches.created++;
  } catch (error) { result.smsEmailOutboundBatches.errors.push(rowError("SMS/Email batch", index, error)); }

  for (const [index, row] of backup.smsEmailDeliveries.entries()) try {
    const id = requiredText(row.id, "SMS/Email delivery ID"), batchId = batchMap.get(requiredText(row.batchId, "SMS/Email delivery batch"));
    const consentId = consentMap.get(requiredText(row.consentId, "SMS/Email delivery consent"));
    const backupGuardianId = nullableText(row.guardianId), backupStaffId = nullableText(row.staffMemberId);
    const guardianId = backupGuardianId ? guardianMap.get(backupGuardianId) : null, staffMemberId = backupStaffId ? staffMap.get(backupStaffId) : null;
    const notificationRecipientId = nullableText(row.notificationRecipientId);
    if (!batchId || !consentId || (backupGuardianId && !guardianId) || (backupStaffId && !staffMemberId) ||
      (notificationRecipientId && !await db.notificationRecipient.findUnique({ where: { id: notificationRecipientId } }))) {
      result.smsEmailDeliveries.skipped++; continue;
    }
    const providerMessageId = nullableText(row.providerMessageId);
    const [byId, byProvider] = await Promise.all([db.smsEmailDelivery.findUnique({ where: { id } }), providerMessageId ? db.smsEmailDelivery.findUnique({ where: { providerMessageId } }) : null]);
    if ((byProvider && byProvider.id !== id) || (byId && byId.requestFingerprint !== row.requestFingerprint)) {
      result.smsEmailDeliveries.skipped++; result.warnings.push(`SMS/Email delivery ${id} collided with preserved provider history and was isolated.`); continue;
    }
    if (byId) { deliveryMap.set(id, id); result.smsEmailDeliveries.skipped++; continue; }
    await db.smsEmailDelivery.create({ data: {
      ...smsEmailRestoreData(row, SMS_EMAIL_DELIVERY_DATES), batchId, consentId,
      guardianId: guardianId ?? null, staffMemberId: staffMemberId ?? null, notificationRecipientId: notificationRecipientId ?? null
    } });
    deliveryMap.set(id, id); result.smsEmailDeliveries.created++;
  } catch (error) { result.smsEmailDeliveries.errors.push(rowError("SMS/Email delivery", index, error)); }

  for (const [index, row] of backup.smsEmailDeliveryAttempts.entries()) try {
    const id = requiredText(row.id, "SMS/Email attempt ID"), deliveryId = deliveryMap.get(requiredText(row.deliveryId, "SMS/Email attempt delivery"));
    if (!deliveryId) { result.smsEmailDeliveryAttempts.skipped++; continue; }
    const attemptNumber = Number(row.attemptNumber);
    const [byId, byNumber] = await Promise.all([
      db.smsEmailDeliveryAttempt.findUnique({ where: { id } }),
      db.smsEmailDeliveryAttempt.findUnique({ where: { deliveryId_attemptNumber: { deliveryId, attemptNumber } } })
    ]);
    if ((byNumber && byNumber.id !== id) || (byId && (byId.deliveryId !== deliveryId || byId.attemptNumber !== attemptNumber))) { result.smsEmailDeliveryAttempts.skipped++; continue; }
    if (byId) { result.smsEmailDeliveryAttempts.skipped++; continue; }
    await db.smsEmailDeliveryAttempt.create({ data: { ...smsEmailRestoreData(row, ["attemptedAt", "createdAt"]), deliveryId } });
    result.smsEmailDeliveryAttempts.created++;
  } catch (error) { result.smsEmailDeliveryAttempts.errors.push(rowError("SMS/Email attempt", index, error)); }

  for (const [index, row] of backup.smsEmailWebhookEvents.entries()) try {
    const id = requiredText(row.id, "SMS/Email webhook ID"), providerEventKey = requiredText(row.providerEventKey, "SMS/Email webhook key");
    const integrationProfileId = profileMap.get(requiredText(row.integrationProfileId, "SMS/Email webhook profile"));
    const backupDeliveryId = nullableText(row.deliveryId), deliveryId = backupDeliveryId ? deliveryMap.get(backupDeliveryId) : null;
    if (!integrationProfileId || (backupDeliveryId && !deliveryId)) { result.smsEmailWebhookEvents.skipped++; continue; }
    const [byId, byKey] = await Promise.all([db.smsEmailWebhookEvent.findUnique({ where: { id } }), db.smsEmailWebhookEvent.findUnique({ where: { providerEventKey } })]);
    if ((byKey && byKey.id !== id) || (byId && byId.providerEventKey !== providerEventKey)) {
      result.smsEmailWebhookEvents.skipped++; result.warnings.push(`SMS/Email webhook event ${providerEventKey} collided and was isolated.`); continue;
    }
    if (byId) { result.smsEmailWebhookEvents.skipped++; continue; }
    await db.smsEmailWebhookEvent.create({ data: { ...smsEmailRestoreData(row, ["receivedAt", "processedAt", "createdAt"]), integrationProfileId, deliveryId: deliveryId ?? null } });
    result.smsEmailWebhookEvents.created++;
  } catch (error) { result.smsEmailWebhookEvents.errors.push(rowError("SMS/Email webhook", index, error)); }

  for (const [index, row] of backup.smsEmailOperationalEvents.entries()) try {
    const id = requiredText(row.id, "SMS/Email operational event ID"), eventKey = requiredText(row.eventKey, "SMS/Email operational event key");
    const integrationProfileId = profileMap.get(requiredText(row.integrationProfileId, "SMS/Email operational event profile"));
    const backupBatchId = nullableText(row.batchId), batchId = backupBatchId ? batchMap.get(backupBatchId) : null;
    if (!integrationProfileId || (backupBatchId && !batchId)) { result.smsEmailOperationalEvents.skipped++; continue; }
    const [byId, byKey] = await Promise.all([db.smsEmailOperationalEvent.findUnique({ where: { id } }), db.smsEmailOperationalEvent.findUnique({ where: { eventKey } })]);
    if ((byKey && byKey.id !== id) || (byId && byId.eventKey !== eventKey)) { result.smsEmailOperationalEvents.skipped++; continue; }
    if (byId) { result.smsEmailOperationalEvents.skipped++; continue; }
    await db.smsEmailOperationalEvent.create({ data: { ...smsEmailRestoreData(row, ["createdAt"], ["recordedByUserId"]), integrationProfileId, batchId: batchId ?? null } });
    result.smsEmailOperationalEvents.created++;
  } catch (error) { result.smsEmailOperationalEvents.errors.push(rowError("SMS/Email operational event", index, error)); }

  for (const [index, row] of backup.smsEmailSuppressions.entries()) try {
    const id = requiredText(row.id, "SMS/Email suppression ID"), backupGuardianId = nullableText(row.guardianId), backupStaffId = nullableText(row.staffMemberId);
    const guardianId = backupGuardianId ? guardianMap.get(backupGuardianId) : null, staffMemberId = backupStaffId ? staffMap.get(backupStaffId) : null;
    if ((backupGuardianId && !guardianId) || (backupStaffId && !staffMemberId)) { result.smsEmailSuppressions.skipped++; continue; }
    if (await db.smsEmailSuppression.findUnique({ where: { id } })) { result.smsEmailSuppressions.skipped++; continue; }
    await db.smsEmailSuppression.create({ data: {
      ...smsEmailRestoreData(row, ["createdAt", "clearedAt"], ["createdByUserId", "clearedByUserId"]),
      guardianId: guardianId ?? null, staffMemberId: staffMemberId ?? null
    } });
    result.smsEmailSuppressions.created++;
  } catch (error) { result.smsEmailSuppressions.errors.push(rowError("SMS/Email suppression", index, error)); }

  for (const [index, row] of backup.smsEmailCostRates.entries()) try {
    const id = requiredText(row.id, "SMS/Email rate ID"), backupProfileId = nullableText(row.integrationProfileId);
    const integrationProfileId = backupProfileId ? profileMap.get(backupProfileId) : null;
    if (backupProfileId && !integrationProfileId) { result.smsEmailCostRates.skipped++; continue; }
    if (await db.smsEmailCostRate.findUnique({ where: { id } })) { result.smsEmailCostRates.skipped++; continue; }
    await db.smsEmailCostRate.create({ data: {
      ...smsEmailRestoreData(row, ["effectiveFrom", "sourceReviewDate", "createdAt", "updatedAt"]),
      integrationProfileId: integrationProfileId ?? null
    } });
    result.smsEmailCostRates.created++;
  } catch (error) { result.smsEmailCostRates.errors.push(rowError("SMS/Email rate", index, error)); }
}

const PROFILE_RESTORE_DATES = ["lastHealthCheckAt","costCapUpdatedAt","createdAt","updatedAt"];
const CONSENT_RESTORE_DATES = ["optedInAt","optedOutAt","expiresAt","createdAt","updatedAt"];
const BATCH_RESTORE_DATES = ["scheduledFor","costCapOverriddenAt","approvedAt","startedAt","completedAt","cancelledAt","createdAt","updatedAt"];
const DELIVERY_RESTORE_DATES = ["nextAttemptAt","claimedAt","acceptedAt","sentAt","deliveredAt","readAt","failedAt","optedOutAt","cancelledAt","createdAt","updatedAt"];
function whatsappRestoreData(row: RestoreRecord, dateFields: string[]) {
  const data: Record<string, unknown> = { ...row };
  for (const key of dateFields) {
    if (data[key] == null || data[key] === "") data[key] = null;
    else data[key] = requiredDate(data[key], `WhatsApp ${key}`);
  }
  return data;
}

const SMS_EMAIL_PROFILE_DATES = ["lastHealthCheckAt", "createdAt", "updatedAt"];
const SMS_EMAIL_CONSENT_DATES = ["optedInAt", "optedOutAt", "expiresAt", "createdAt", "updatedAt"];
const SMS_EMAIL_BATCH_DATES = ["scheduledFor", "approvedAt", "startedAt", "completedAt", "cancelledAt", "createdAt", "updatedAt"];
const SMS_EMAIL_DELIVERY_DATES = ["nextRetryAt", "claimedAt", "acceptedAt", "sentAt", "deliveredAt", "bouncedAt", "complainedAt", "suppressedAt", "failedAt", "cancelledAt", "createdAt", "updatedAt"];
function smsEmailRestoreData(row: RestoreRecord, dateFields: string[], actorFields: string[] = []) {
  const data: Record<string, unknown> = { ...row };
  for (const key of dateFields) {
    if (data[key] == null || data[key] === "") data[key] = null;
    else data[key] = requiredDate(data[key], `SMS/Email ${key}`);
  }
  for (const key of actorFields) data[key] = null;
  return data;
}

async function mapBackupUsersToLocalUsers(client: RestoreDatabaseClient, users: RestoreRecord[]) {
  const localUsers = await client.user.findMany({ select: { id: true, username: true } });
  const localByUsername = new Map(localUsers.map((user) => [user.username, user.id]));
  const mapping = new Map<string, string>();
  for (const user of users) {
    if (typeof user.id !== "string" || typeof user.username !== "string") continue;
    const localId = localByUsername.get(user.username);
    if (localId) mapping.set(user.id, localId);
  }
  return mapping;
}

function resolveAdmissionNo(row: RestoreRecord, studentIds: Map<string, string>) {
  const admissionNo = nullableText(row.admissionNo);
  if (admissionNo) return admissionNo;
  const studentId = requiredText(row.studentId, "Student ID");
  const mapped = studentIds.get(studentId);
  if (!mapped) throw new Error(`Backup student ID ${studentId} could not be matched`);
  return mapped;
}

function mapOptionalUserId(value: unknown, mapping: Map<string, string>) {
  const id = nullableText(value);
  return id ? mapping.get(id) ?? null : null;
}

function auditFingerprint(audit: {
  paymentId: unknown;
  action: unknown;
  changedByName: unknown;
  reason?: unknown;
  createdAt: unknown;
}) {
  const date = new Date(String(audit.createdAt));
  return [
    audit.paymentId,
    audit.action,
    audit.changedByName,
    nullableText(audit.reason) ?? "",
    Number.isNaN(date.getTime()) ? String(audit.createdAt) : date.toISOString()
  ].join("|");
}

function requiredText(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required`);
  return text;
}

function nullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function textOr(value: unknown, fallback: string) {
  return nullableText(value) ?? fallback;
}

function positiveNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${field} must be greater than zero`);
  return number;
}

function nonNegativeInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return 0;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${field} must be a non-negative integer`);
  return number;
}

function requiredDate(value: unknown, field: string) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid date`);
  return date;
}

function optionalDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return requiredDate(value, field);
}

function positiveInteger(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return number;
}

function optionalPositiveInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return positiveInteger(value, field);
}

function optionalNonNegativeInteger(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  return nonNegativeInteger(value, field);
}

function booleanOr(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "boolean") throw new Error("Expected a boolean value");
  return value;
}

function optionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "boolean") throw new Error("Expected a boolean value");
  return value;
}

function createdAtData(row: RestoreRecord, index: number, entity: string) {
  return row.createdAt === undefined || row.createdAt === null || row.createdAt === ""
    ? {}
    : { createdAt: requiredDate(row.createdAt, `${entity}[${index}].createdAt`) };
}

function sameData(existing: object, data: object) {
  const current = existing as Record<string, unknown>;
  return Object.entries(data).every(([key, value]) => current[key] === value);
}

function mapRequiredTimetableId(
  value: unknown,
  mapping: Map<string, string>,
  label: string,
  index: number,
  result: { warnings: string[] }
) {
  const backupId = nullableText(value);
  const mapped = backupId ? mapping.get(backupId) : undefined;
  if (!mapped) {
    result.warnings.push(
      `Row ${index + 1} skipped because its ${label} could not be mapped safely.`
    );
  }
  return mapped;
}

function mapOptionalTimetableId(
  value: unknown,
  mapping: Map<string, string>,
  label: string,
  index: number,
  result: { warnings: string[] }
) {
  const backupId = nullableText(value);
  if (!backupId) return null;
  const mapped = mapping.get(backupId);
  if (!mapped) {
    result.warnings.push(
      `Row ${index + 1} skipped because its optional ${label} could not be mapped safely.`
    );
    return undefined;
  }
  return mapped;
}

function rowError(entity: string, index: number, error: unknown) {
  return `${entity} ${index + 1}: ${error instanceof Error ? error.message : "Unknown restore error"}`;
}

function checklistData(row: RestoreRecord, restoredByName: string) {
  return {
    backupTaken: row.backupTaken === true,
    schoolSettingsVerified: row.schoolSettingsVerified === true,
    realUsersCreated: row.realUsersCreated === true,
    defaultPasswordsChanged: row.defaultPasswordsChanged === true,
    studentMasterImported: row.studentMasterImported === true,
    randomStudentsVerified: row.randomStudentsVerified === true,
    paymentTrialCompleted: row.paymentTrialCompleted === true,
    paymentTotalsMatched: row.paymentTotalsMatched === true,
    randomPaymentsVerified: row.randomPaymentsVerified === true,
    testReceiptPrinted: row.testReceiptPrinted === true,
    pendingDuesChecked: row.pendingDuesChecked === true,
    backupAfterImportTaken: row.backupAfterImportTaken === true,
    updatedBy: textOr(row.updatedBy, restoredByName),
    updatedAt: optionalDate(row.updatedAt, "goLiveChecklist.updatedAt") ?? undefined
  };
}
