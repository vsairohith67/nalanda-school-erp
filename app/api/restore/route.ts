import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { restoreValidatedBackup } from "@/lib/restore-database";
import { parseAndValidateBackup } from "@/lib/restore";
import {
  assertBrowserRestoreExecutionSafe,
  assertBrowserRestorePayloadAllowed
} from "@/lib/browser-restore-safety";

const CONFIRMATION_TEXT = "RESTORE NALANDA DATA";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("RUN_RESTORE");
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const backup = parseAndValidateBackup(body.backup);
    if (body.action === "validate") {
      return NextResponse.json({
        valid: true,
        metadata: backup.metadata,
        counts: {
          students: backup.students.length,
          feeStructures: backup.feeStructures.length,
          payments: backup.payments.length,
          paymentAudits: backup.paymentAudits.length,
          users: backup.users.length,
          rolePermissions: backup.rolePermissions.length,
          notices: backup.notices.length,
          staffMembers: backup.staffMembers.length,
          staffLeaveRequests: backup.staffLeaveRequests.length,
          substituteAssignments: backup.substituteAssignments.length,
          academicYearEnrollments: backup.academicYearEnrollments.length,
          studentLifecycleEvents: backup.studentLifecycleEvents.length,
          vendors: backup.vendors.length,
          expenseCategories: backup.expenseCategories.length,
          expenseDepartments: backup.expenseDepartments.length,
          expenseRecords: backup.expenseRecords.length,
          expensePayments: backup.expensePayments.length,
          expenseAudits: backup.expenseAudits.length,
          budgetPlans: backup.budgetPlans.length,
          budgetAllocations: backup.budgetAllocations.length,
          budgetRevisions: backup.budgetRevisions.length,
          studentAttendanceSessions: backup.studentAttendanceSessions.length,
          studentAttendanceRecords: backup.studentAttendanceRecords.length,
          libraryStockVerificationSessions: backup.libraryStockVerificationSessions.length,
          libraryStockVerificationRecords: backup.libraryStockVerificationRecords.length,
          libraryStockVerificationScanEvents: backup.libraryStockVerificationScanEvents.length,
          libraryStockVerificationEvents: backup.libraryStockVerificationEvents.length,
          teacherAnalyticsReviewCycles: backup.teacherAnalyticsReviewCycles.length,
          teacherAnalyticsSnapshots: backup.teacherAnalyticsSnapshots.length,
          teacherAnalyticsReviews: backup.teacherAnalyticsReviews.length,
          teacherAnalyticsEvents: backup.teacherAnalyticsEvents.length,
          identityCardNumberSeries: backup.identityCardNumberSeries.length,
          identityCardTemplates: backup.identityCardTemplates.length,
          identityCardBatches: backup.identityCardBatches.length,
          identityCards: backup.identityCards.length,
          identityCardVersions: backup.identityCardVersions.length,
          identityCardEvents: backup.identityCardEvents.length,
          notificationTemplates: backup.notificationTemplates.length,
          notificationCampaigns: backup.notificationCampaigns.length,
          notificationRecipients: backup.notificationRecipients.length,
          notificationSkippedRecipients: backup.notificationSkippedRecipients.length,
          notificationEvents: backup.notificationEvents.length,
          whatsAppIntegrationProfiles: backup.whatsAppIntegrationProfiles.length,
          whatsAppConsents: backup.whatsAppConsents.length,
          whatsAppConsentEvents: backup.whatsAppConsentEvents.length,
          whatsAppTemplateMappings: backup.whatsAppTemplateMappings.length,
          whatsAppOutboundBatches: backup.whatsAppOutboundBatches.length,
          whatsAppDeliveries: backup.whatsAppDeliveries.length,
          whatsAppDeliveryAttempts: backup.whatsAppDeliveryAttempts.length,
          whatsAppWebhookEvents: backup.whatsAppWebhookEvents.length,
          whatsAppOperationalEvents: backup.whatsAppOperationalEvents.length,
          whatsAppRateReferences: backup.whatsAppRateReferences.length,
          feeRegisterOcrProfiles: backup.feeRegisterOcrProfiles.length,
          feeRegisterOcrBatches: backup.feeRegisterOcrBatches.length,
          feeRegisterOcrPages: backup.feeRegisterOcrPages.length,
          feeRegisterOcrRows: backup.feeRegisterOcrRows.length,
          feeRegisterOcrRowRevisions: backup.feeRegisterOcrRowRevisions.length,
          feeRegisterOcrPostingRuns: backup.feeRegisterOcrPostingRuns.length,
          feeRegisterOcrEvents: backup.feeRegisterOcrEvents.length,
          receiptNotes: backup.receiptNotes.length,
          importBatches: backup.importBatches.length,
          goLiveChecklist: backup.goLiveChecklist.length,
          timetableTeachers: backup.timetableTeachers.length,
          timetableSubjects: backup.timetableSubjects.length,
          timetableClassSections: backup.timetableClassSections.length,
          timetablePeriodTemplates: backup.timetablePeriodTemplates.length,
          timetableAssignments: backup.timetableAssignments.length,
          timetableTeacherUnavailability: backup.timetableTeacherUnavailability.length,
          timetableFixedPeriods: backup.timetableFixedPeriods.length,
          timetableDrafts: backup.timetableDrafts.length,
          timetableEntries: backup.timetableEntries.length
        },
        warnings: backup.users.length
          ? ["User accounts will be skipped during restore for login safety."]
          : []
      });
    }
    if (body.action !== "restore") {
      return NextResponse.json({ error: "Unknown restore action" }, { status: 400 });
    }
    if (body.confirmation !== CONFIRMATION_TEXT) {
      return NextResponse.json({ error: `Type ${CONFIRMATION_TEXT} to confirm restore` }, { status: 400 });
    }

    assertBrowserRestorePayloadAllowed(backup);
    assertBrowserRestoreExecutionSafe();
    const result = await restoreValidatedBackup(prisma, backup, auth.user);
    return NextResponse.json({ restored: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to restore backup") },
      { status: 400 }
    );
  }
}
