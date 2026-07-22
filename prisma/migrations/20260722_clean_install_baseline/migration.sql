-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "admissionNo" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "motherName" TEXT,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "rollNo" TEXT,
    "phone1" TEXT NOT NULL,
    "phone2" TEXT,
    "whatsappNumber" TEXT,
    "address" TEXT,
    "dateOfBirth" DATETIME,
    "aadhaarNo" TEXT,
    "tcStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "studentType" TEXT NOT NULL DEFAULT 'Normal',
    "discountPercent" REAL NOT NULL DEFAULT 0,
    "startMonth" TEXT NOT NULL DEFAULT 'June',
    "remarks" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "className" TEXT NOT NULL,
    "termAmount" REAL NOT NULL,
    "term1Month" TEXT NOT NULL,
    "term2Month" TEXT NOT NULL,
    "term3Month" TEXT NOT NULL,
    "term4Month" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "studentId" TEXT,
    "studentName" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "amountPaid" REAL NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "receivedAccount" TEXT NOT NULL,
    "transactionRefNo" TEXT,
    "feeType" TEXT NOT NULL,
    "termHint" TEXT NOT NULL DEFAULT 'Auto',
    "remarks" TEXT,
    "enteredBy" TEXT NOT NULL DEFAULT 'Director',
    "editedBy" TEXT,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" DATETIME,
    "cancelledByUserId" TEXT,
    "cancellationReason" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceiptNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Cancelled',
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "guardianId" TEXT,
    CONSTRAINT "User_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AcademicYearEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "rollNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "enrollmentDate" DATETIME,
    "exitDate" DATETIME,
    "exitReason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AcademicYearEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentProgressionDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "sourceEnrollmentId" TEXT,
    "academicYear" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "fromClass" TEXT,
    "fromSection" TEXT,
    "fromStatus" TEXT,
    "toAcademicYear" TEXT,
    "toClass" TEXT,
    "toSection" TEXT,
    "toStatus" TEXT,
    "effectiveDate" DATETIME NOT NULL,
    "reason" TEXT,
    "evidenceNotes" TEXT,
    "marksSummary" TEXT,
    "attendanceSummary" TEXT,
    "parentRequestNotes" TEXT,
    "parentAcknowledgementNotes" TEXT,
    "feeWarningNotes" TEXT,
    "udiseReviewNotes" TEXT,
    "destinationSchool" TEXT,
    "followUpNotes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "finalizedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "finalizedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentProgressionDecision_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentProgressionDecision_sourceEnrollmentId_fkey" FOREIGN KEY ("sourceEnrollmentId") REFERENCES "AcademicYearEnrollment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentProgressionDecision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentProgressionDecision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentProgressionDecision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentProgressionDecision_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentProgressionDecision_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentLifecycleEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT,
    "eventType" TEXT NOT NULL,
    "fromClass" TEXT,
    "fromSection" TEXT,
    "toClass" TEXT,
    "toSection" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "effectiveDate" DATETIME NOT NULL,
    "reason" TEXT,
    "evidenceNotes" TEXT,
    "parentAcknowledgementNotes" TEXT,
    "approvedByUserId" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentLifecycleEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentLifecycleEvent_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentLifecycleEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentAttendanceSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendanceDate" DATETIME NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "takenByUserId" TEXT,
    "submittedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "submittedAt" DATETIME,
    "lockedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentAttendanceSession_takenByUserId_fkey" FOREIGN KEY ("takenByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentAttendanceSession_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentAttendanceSession_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "admissionNo" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentAttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudentAttendanceSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentAttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffMemberId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "leaveType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "halfDaySession" TEXT,
    "totalDays" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "substituteRequired" BOOLEAN NOT NULL DEFAULT false,
    "substituteNotes" TEXT,
    "approverUserId" TEXT,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffLeaveRequest_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StaffLeaveRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffLeaveRequest_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffLeaveRequest_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffAttendanceSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attendanceDate" DATETIME NOT NULL,
    "academicYear" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "takenByUserId" TEXT,
    "submittedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "submittedAt" DATETIME,
    "lockedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffAttendanceSession_takenByUserId_fkey" FOREIGN KEY ("takenByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffAttendanceSession_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StaffAttendanceSession_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StaffAttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "staffCode" TEXT,
    "status" TEXT NOT NULL,
    "checkInTime" TEXT,
    "checkOutTime" TEXT,
    "lateMinutes" INTEGER,
    "remarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StaffAttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StaffAttendanceSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffAttendanceRecord_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubstituteAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentDate" DATETIME NOT NULL,
    "academicYear" TEXT,
    "leaveRequestId" TEXT,
    "absentStaffMemberId" TEXT NOT NULL,
    "substituteStaffMemberId" TEXT,
    "timetableAssignmentId" TEXT,
    "className" TEXT,
    "section" TEXT,
    "subject" TEXT,
    "periodLabel" TEXT,
    "periodStartTime" TEXT,
    "periodEndTime" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "assignedByUserId" TEXT,
    "confirmedByUserId" TEXT,
    "completedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "assignedAt" DATETIME,
    "confirmedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubstituteAssignment_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "StaffLeaveRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_absentStaffMemberId_fkey" FOREIGN KEY ("absentStaffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_substituteStaffMemberId_fkey" FOREIGN KEY ("substituteStaffMemberId") REFERENCES "StaffMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_timetableAssignmentId_fkey" FOREIGN KEY ("timetableAssignmentId") REFERENCES "TimetableAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SubstituteAssignment_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceType" TEXT NOT NULL DEFAULT 'ALL_PARENTS',
    "className" TEXT,
    "section" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishDate" DATETIME,
    "expiresAt" DATETIME,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Notice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Notice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "primaryMobile" TEXT NOT NULL,
    "alternateMobile" TEXT,
    "email" TEXT,
    "relationship" TEXT NOT NULL DEFAULT 'Parent',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guardianId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationshipToStudent" TEXT NOT NULL DEFAULT 'Parent',
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "canViewFees" BOOLEAN NOT NULL DEFAULT true,
    "canReceiveReminders" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentGuardian_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentGuardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SchoolSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'school',
    "schoolName" TEXT NOT NULL DEFAULT 'Nalanda Public School',
    "addressLine1" TEXT NOT NULL DEFAULT 'Nanalnagar, Mehdipatnam',
    "city" TEXT NOT NULL DEFAULT 'Hyderabad',
    "phone" TEXT NOT NULL DEFAULT '040-23513913',
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "receiptPrefix" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'INR',
    "whatsappReminderFooter" TEXT NOT NULL DEFAULT 'Nalanda Public School',
    "logoPath" TEXT NOT NULL DEFAULT '/nalanda-logo.jpg',
    "receiptTitle" TEXT NOT NULL DEFAULT 'FEE RECEIPT',
    "showSchoolPhone" BOOLEAN NOT NULL DEFAULT true,
    "showSchoolAddress" BOOLEAN NOT NULL DEFAULT true,
    "defaultPrintSize" TEXT NOT NULL DEFAULT 'A5',
    "signatureLabel" TEXT NOT NULL DEFAULT 'Receiver Signature',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "targetUserId" TEXT,
    "detailsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "mobile" TEXT,
    "alternateMobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "bankName" TEXT,
    "accountLastFour" TEXT,
    "ifsc" TEXT,
    "paymentTermsDays" INTEGER,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vendor_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "parentCategoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExpenseCategory_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseDepartment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExpenseRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseNumber" TEXT NOT NULL,
    "expenseDate" DATETIME NOT NULL,
    "academicYear" TEXT NOT NULL,
    "vendorId" TEXT,
    "categoryId" TEXT NOT NULL,
    "departmentId" TEXT,
    "description" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "invoiceDate" DATETIME,
    "grossAmount" DECIMAL NOT NULL,
    "taxAmount" DECIMAL NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL NOT NULL DEFAULT 0,
    "netAmount" DECIMAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "transactionReference" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" DATETIME,
    "paidDate" DATETIME,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "paidByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "paidAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExpenseRecord_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExpenseRecord_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExpenseRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ExpenseDepartment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExpenseRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseRecord_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseRecord_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseRecord_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExpenseRecord_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseRecordId" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "amount" DECIMAL NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "transactionReference" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" DATETIME,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpensePayment_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "ExpenseRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExpensePayment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseRecordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "detailsJson" TEXT,
    "actorUserId" TEXT,
    "actorName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpenseAudit_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "ExpenseRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExpenseAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetNumber" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAllocatedAmount" DECIMAL NOT NULL DEFAULT 0,
    "warningThresholdPercent" INTEGER NOT NULL DEFAULT 80,
    "criticalThresholdPercent" INTEGER NOT NULL DEFAULT 100,
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "lockedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetPlan_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetPlan_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetPlan_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetPlan_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetPlan_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetPlanId" TEXT NOT NULL,
    "categoryId" TEXT,
    "departmentId" TEXT,
    "allocationKey" TEXT NOT NULL,
    "allocatedAmount" DECIMAL NOT NULL,
    "warningThresholdPercent" INTEGER,
    "criticalThresholdPercent" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetAllocation_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BudgetAllocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BudgetAllocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "ExpenseDepartment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BudgetRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetPlanId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "previousTotalAmount" DECIMAL NOT NULL,
    "revisedTotalAmount" DECIMAL NOT NULL,
    "revisionData" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetRevision_budgetPlanId_fkey" FOREIGN KEY ("budgetPlanId") REFERENCES "BudgetPlan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BudgetRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetRevision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BudgetRevision_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MiscIncomeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "studentLinkPolicy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MiscIncomeItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MiscIncomeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MiscIncomeRate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MiscIncomeItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MiscIncomeReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "receiptDate" DATETIME NOT NULL,
    "academicYear" TEXT NOT NULL,
    "studentId" TEXT,
    "payerName" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "receivedAccount" TEXT,
    "transactionReference" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" DATETIME,
    "grossAmount" DECIMAL NOT NULL,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "netAmount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "createdByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MiscIncomeReceipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MiscIncomeReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MiscIncomeReceipt_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MiscIncomeReceiptLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "rateId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitAmount" DECIMAL NOT NULL,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MiscIncomeReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "MiscIncomeReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MiscIncomeReceiptLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MiscIncomeItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MiscIncomeReceiptLine_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "MiscIncomeRate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashBookDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cashDate" DATETIME NOT NULL,
    "academicYear" TEXT NOT NULL,
    "openingBalance" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "feeCashSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "miscIncomeCashSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "bookSalesCashSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "cashExpenseSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "manualInflowSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "manualOutflowSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "bankDepositSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "directorHandoverSnapshot" DECIMAL NOT NULL DEFAULT 0,
    "calculatedClosingBalance" DECIMAL NOT NULL DEFAULT 0,
    "countedClosingBalance" DECIMAL,
    "varianceAmount" DECIMAL,
    "sourceSummarySnapshot" TEXT,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "lockedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CashBookDay_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashBookDay_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashBookDay_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashBookDay_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashBookDay_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashBookMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cashBookDayId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "movementDate" DATETIME NOT NULL,
    "referenceNumber" TEXT,
    "bankName" TEXT,
    "recipientName" TEXT,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recordedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CashBookMovement_cashBookDayId_fkey" FOREIGN KEY ("cashBookDayId") REFERENCES "CashBookDay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashBookMovement_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashBookMovement_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryTitle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titleCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "authors" TEXT NOT NULL,
    "isbn" TEXT,
    "edition" TEXT,
    "publisherName" TEXT,
    "publisherVendorId" TEXT,
    "publicationYear" INTEGER,
    "language" TEXT,
    "subject" TEXT,
    "category" TEXT,
    "classificationNumber" TEXT,
    "defaultShelfCode" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryTitle_publisherVendorId_fkey" FOREIGN KEY ("publisherVendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryTitle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryCopy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titleId" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "barcodeValue" TEXT,
    "acquisitionDate" DATETIME,
    "acquisitionType" TEXT NOT NULL DEFAULT 'OTHER',
    "acquisitionCost" DECIMAL,
    "vendorId" TEXT,
    "expenseRecordId" TEXT,
    "donorName" TEXT,
    "invoiceNumberSnapshot" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "shelfCode" TEXT,
    "notes" TEXT,
    "withdrawnDate" DATETIME,
    "withdrawalReason" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryCopy_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCopy_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCopy_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "ExpenseRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCopy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryCopy_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryCopyEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "copyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "previousCondition" TEXT,
    "newCondition" TEXT,
    "previousShelfCode" TEXT,
    "newShelfCode" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryCopyEvent_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCopyEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryStockVerificationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "verificationDate" DATETIME NOT NULL,
    "scopeType" TEXT NOT NULL,
    "shelfCodeFilter" TEXT,
    "titleIdFilter" TEXT,
    "categoryFilter" TEXT,
    "subjectFilter" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expectedCopyCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedCopyCount" INTEGER NOT NULL DEFAULT 0,
    "presentCount" INTEGER NOT NULL DEFAULT 0,
    "issuedOffsiteCount" INTEGER NOT NULL DEFAULT 0,
    "knownRepairCount" INTEGER NOT NULL DEFAULT 0,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "misShelvedCount" INTEGER NOT NULL DEFAULT 0,
    "damagedCount" INTEGER NOT NULL DEFAULT 0,
    "unexpectedCount" INTEGER NOT NULL DEFAULT 0,
    "unresolvedCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "startedByUserId" TEXT,
    "submittedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "startedAt" DATETIME,
    "submittedAt" DATETIME,
    "reviewedAt" DATETIME,
    "approvedAt" DATETIME,
    "lockedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryStockVerificationSession_titleIdFilter_fkey" FOREIGN KEY ("titleIdFilter") REFERENCES "LibraryTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationSession_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationSession_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationSession_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationSession_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationSession_lockedByUserId_fkey" FOREIGN KEY ("lockedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationSession_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryStockVerificationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "expectedAccessionNumberSnapshot" TEXT NOT NULL,
    "expectedBarcodeSnapshot" TEXT,
    "expectedTitleSnapshot" TEXT NOT NULL,
    "expectedShelfCodeSnapshot" TEXT,
    "expectedStatusSnapshot" TEXT NOT NULL,
    "expectedConditionSnapshot" TEXT NOT NULL,
    "expectedLoanStatusSnapshot" TEXT,
    "expectedBorrowerTypeSnapshot" TEXT,
    "expectedDueDateSnapshot" DATETIME,
    "observationStatus" TEXT NOT NULL DEFAULT 'NOT_CHECKED',
    "observedAt" DATETIME,
    "observedShelfCode" TEXT,
    "observedCondition" TEXT,
    "scanMethod" TEXT,
    "observationNotes" TEXT,
    "discrepancyReason" TEXT,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "resolutionNotes" TEXT,
    "appliedCopyEventId" TEXT,
    "observedByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "appliedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryStockVerificationRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LibraryStockVerificationSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationRecord_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationRecord_appliedCopyEventId_fkey" FOREIGN KEY ("appliedCopyEventId") REFERENCES "LibraryCopyEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationRecord_observedByUserId_fkey" FOREIGN KEY ("observedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationRecord_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationRecord_appliedByUserId_fkey" FOREIGN KEY ("appliedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryStockVerificationScanEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "recordId" TEXT,
    "normalizedInput" TEXT NOT NULL,
    "scanMethod" TEXT NOT NULL,
    "resultType" TEXT NOT NULL,
    "scannedAt" DATETIME NOT NULL,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryStockVerificationScanEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LibraryStockVerificationSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationScanEvent_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "LibraryStockVerificationRecord" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationScanEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryStockVerificationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryStockVerificationEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LibraryStockVerificationSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryStockVerificationEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberCode" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "studentId" TEXT,
    "staffMemberId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedDate" DATETIME NOT NULL,
    "suspendedUntil" DATETIME,
    "suspensionReason" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryMember_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryMember_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryMember_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "className" TEXT,
    "staffType" TEXT,
    "maxActiveLoans" INTEGER NOT NULL,
    "loanPeriodDays" INTEGER NOT NULL,
    "maxRenewals" INTEGER NOT NULL,
    "renewalPeriodDays" INTEGER NOT NULL,
    "reservationLimit" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryPolicy_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryLoan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanNumber" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "activeCopyKey" TEXT,
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "returnedDate" DATETIME,
    "renewCount" INTEGER NOT NULL DEFAULT 0,
    "policyCodeSnapshot" TEXT NOT NULL,
    "loanPeriodDaysSnapshot" INTEGER NOT NULL,
    "maxRenewalsSnapshot" INTEGER NOT NULL,
    "renewalPeriodDaysSnapshot" INTEGER NOT NULL,
    "issueConditionSnapshot" TEXT NOT NULL,
    "returnConditionSnapshot" TEXT,
    "issueNotes" TEXT,
    "returnNotes" TEXT,
    "cancellationReason" TEXT,
    "issuedByUserId" TEXT,
    "returnedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryLoan_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoan_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoan_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoan_returnedByUserId_fkey" FOREIGN KEY ("returnedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoan_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationNumber" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "activeMemberTitleKey" TEXT,
    "requestedDate" DATETIME NOT NULL,
    "expiresDate" DATETIME,
    "fulfilledLoanId" TEXT,
    "fulfilledAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "fulfilledByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryReservation_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryReservation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryReservation_fulfilledLoanId_fkey" FOREIGN KEY ("fulfilledLoanId") REFERENCES "LibraryLoan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryReservation_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryReservation_fulfilledByUserId_fkey" FOREIGN KEY ("fulfilledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryReservation_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryLoanEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loanId" TEXT,
    "reservationId" TEXT,
    "memberId" TEXT NOT NULL,
    "copyId" TEXT,
    "titleId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "previousDueDate" DATETIME,
    "newDueDate" DATETIME,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryLoanEvent_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LibraryLoan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoanEvent_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "LibraryReservation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoanEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoanEvent_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoanEvent_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryLoanEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentNumber" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeCaseKey" TEXT,
    "loanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "reportedDate" DATETIME NOT NULL,
    "incidentCondition" TEXT,
    "description" TEXT NOT NULL,
    "assessmentNotes" TEXT,
    "resolutionType" TEXT,
    "replacementCopyId" TEXT,
    "resolvedDate" DATETIME,
    "resolutionNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "resolvedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "resolvedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryIncident_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LibraryLoan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "LibraryTitle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_replacementCopyId_fkey" FOREIGN KEY ("replacementCopyId") REFERENCES "LibraryCopy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryIncident_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryChargeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "className" TEXT,
    "staffType" TEXT,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "overdueAmountPerDay" DECIMAL NOT NULL,
    "maximumOverdueAmount" DECIMAL,
    "lostChargeBasis" TEXT NOT NULL DEFAULT 'MANUAL',
    "fixedLostAmount" DECIMAL,
    "damagedChargeBasis" TEXT NOT NULL DEFAULT 'MANUAL',
    "fixedDamagedAmount" DECIMAL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryChargeRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chargeNumber" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "activeOverdueLoanKey" TEXT,
    "memberId" TEXT NOT NULL,
    "loanId" TEXT,
    "incidentId" TEXT,
    "studentId" TEXT,
    "staffMemberId" TEXT,
    "assessedDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "overdueDaysSnapshot" INTEGER,
    "ruleCodeSnapshot" TEXT,
    "rateSnapshot" DECIMAL,
    "originalAmount" DECIMAL NOT NULL,
    "waivedAmount" DECIMAL NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL NOT NULL,
    "assessmentReason" TEXT NOT NULL,
    "waiverReason" TEXT,
    "cancellationReason" TEXT,
    "miscIncomeReceiptId" TEXT,
    "approvedByUserId" TEXT,
    "waivedByUserId" TEXT,
    "collectedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "createdByUserId" TEXT,
    "approvedAt" DATETIME,
    "waivedAt" DATETIME,
    "collectedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LibraryCharge_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LibraryMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "LibraryLoan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "LibraryIncident" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_miscIncomeReceiptId_fkey" FOREIGN KEY ("miscIncomeReceiptId") REFERENCES "MiscIncomeReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_waivedByUserId_fkey" FOREIGN KEY ("waivedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_collectedByUserId_fkey" FOREIGN KEY ("collectedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LibraryCharge_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryChargeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chargeId" TEXT,
    "incidentId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "amountSnapshot" DECIMAL,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LibraryChargeEvent_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "LibraryCharge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryChargeEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "LibraryIncident" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LibraryChargeEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookCatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "publisherVendorId" TEXT,
    "className" TEXT,
    "subject" TEXT,
    "description" TEXT,
    "studentLinkRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookCatalogItem_publisherVendorId_fkey" FOREIGN KEY ("publisherVendorId") REFERENCES "Vendor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookCatalogItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookCatalogRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookCatalogRate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BookCatalogItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookSaleReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" TEXT NOT NULL,
    "receiptDate" DATETIME NOT NULL,
    "academicYear" TEXT NOT NULL,
    "studentId" TEXT,
    "payerName" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "receivedAccount" TEXT,
    "transactionReference" TEXT,
    "chequeNumber" TEXT,
    "chequeDate" DATETIME,
    "grossAmount" DECIMAL NOT NULL,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "netAmount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "createdByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookSaleReceipt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookSaleReceipt_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookSaleReceipt_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookSaleReceiptLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemCodeSnapshot" TEXT NOT NULL,
    "itemTitleSnapshot" TEXT NOT NULL,
    "classNameSnapshot" TEXT,
    "publisherNameSnapshot" TEXT,
    "rateId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitAmount" DECIMAL NOT NULL,
    "discountAmount" DECIMAL NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookSaleReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "BookSaleReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookSaleReceiptLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "BookCatalogItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookSaleReceiptLine_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "BookCatalogRate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookCashSettlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementDate" DATETIME NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expectedBookCash" DECIMAL NOT NULL DEFAULT 0,
    "handedToDirectorAmount" DECIMAL NOT NULL DEFAULT 0,
    "handedToCashCounterAmount" DECIMAL NOT NULL DEFAULT 0,
    "retainedByBooksInchargeAmount" DECIMAL NOT NULL DEFAULT 0,
    "varianceAmount" DECIMAL NOT NULL DEFAULT 0,
    "varianceReason" TEXT,
    "booksInchargeName" TEXT,
    "receiverName" TEXT,
    "cashBookMovementId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BookCashSettlement_cashBookMovementId_fkey" FOREIGN KEY ("cashBookMovementId") REFERENCES "CashBookMovement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BookCashSettlement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookCashSettlement_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookCashSettlement_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BookCashSettlement_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValueJson" TEXT,
    "newValueJson" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "changedByName" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAudit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentAudit_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedByUserId" TEXT NOT NULL,
    "importedByName" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "detailsJson" TEXT,
    CONSTRAINT "ImportBatch_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoLiveChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'go-live',
    "backupTaken" BOOLEAN NOT NULL DEFAULT false,
    "schoolSettingsVerified" BOOLEAN NOT NULL DEFAULT false,
    "realUsersCreated" BOOLEAN NOT NULL DEFAULT false,
    "defaultPasswordsChanged" BOOLEAN NOT NULL DEFAULT false,
    "studentMasterImported" BOOLEAN NOT NULL DEFAULT false,
    "randomStudentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "paymentTrialCompleted" BOOLEAN NOT NULL DEFAULT false,
    "paymentTotalsMatched" BOOLEAN NOT NULL DEFAULT false,
    "randomPaymentsVerified" BOOLEAN NOT NULL DEFAULT false,
    "testReceiptPrinted" BOOLEAN NOT NULL DEFAULT false,
    "pendingDuesChecked" BOOLEAN NOT NULL DEFAULT false,
    "backupAfterImportTaken" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "HomeworkAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentNumber" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "subjectName" TEXT NOT NULL,
    "timetableSubjectId" TEXT,
    "assignedDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "resourceLink" TEXT,
    "teacherNotes" TEXT,
    "publicNotes" TEXT,
    "correctionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "publishedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "publishedAt" DATETIME,
    "archivedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HomeworkAssignment_timetableSubjectId_fkey" FOREIGN KEY ("timetableSubjectId") REFERENCES "TimetableSubject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HomeworkAssignment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HomeworkAssignment_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HomeworkAssignment_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HomeworkAssignment_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HomeworkAssignmentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "titleSnapshot" TEXT,
    "instructionsSnapshot" TEXT,
    "dueDateSnapshot" DATETIME,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HomeworkAssignmentEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "HomeworkAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HomeworkAssignmentEvent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExamCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examCode" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "openedByUserId" TEXT,
    "closedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "openedAt" DATETIME,
    "closedAt" DATETIME,
    "approvedAt" DATETIME,
    "lockedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExamAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "examCycleId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '',
    "subjectName" TEXT NOT NULL,
    "timetableSubjectId" TEXT,
    "componentName" TEXT NOT NULL DEFAULT '',
    "assessmentType" TEXT NOT NULL,
    "maxMarks" DECIMAL NOT NULL,
    "passMarks" DECIMAL,
    "weightagePercent" DECIMAL,
    "entryStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "instructions" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "lockedByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "lockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExamAssessment_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExamAssessment_timetableSubjectId_fkey" FOREIGN KEY ("timetableSubjectId") REFERENCES "TimetableSubject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentMark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "marksObtained" DECIMAL,
    "entryStatus" TEXT NOT NULL DEFAULT 'PRESENT',
    "remarks" TEXT,
    "enteredByUserId" TEXT,
    "verifiedByUserId" TEXT,
    "enteredAt" DATETIME,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentMark_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ExamAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentMarkEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "studentMarkId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousMarks" DECIMAL,
    "newMarks" DECIMAL,
    "previousEntryStatus" TEXT,
    "newEntryStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "actorLabel" TEXT,
    "eventDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentMarkEvent_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ExamAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GradingScheme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT,
    "reportType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GradeBand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gradingSchemeId" TEXT NOT NULL,
    "gradeCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minimumPercentage" DECIMAL NOT NULL,
    "maximumPercentage" DECIMAL,
    "displayOrder" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GradeBand_gradingSchemeId_fkey" FOREIGN KEY ("gradingSchemeId") REFERENCES "GradingScheme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportCardTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "academicYear" TEXT,
    "className" TEXT,
    "gradingSchemeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "templateDefinitionJson" TEXT NOT NULL,
    "printSettingsJson" TEXT,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportCardTemplate_gradingSchemeId_fkey" FOREIGN KEY ("gradingSchemeId") REFERENCES "GradingScheme" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportCardBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNumber" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "title" TEXT NOT NULL,
    "reportingPeriod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "templateSnapshotJson" TEXT NOT NULL,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "openedByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "openedAt" DATETIME,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "issuedAt" DATETIME,
    "archivedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReportCardBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportCardTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReportCardBatchExamSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "examCycleId" TEXT NOT NULL,
    "weightagePercent" DECIMAL,
    "displayOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportCardBatchExamSource_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReportCardBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReportCardBatchExamSource_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentReportCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportCardNumber" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "section" TEXT,
    "reportType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "draftDataJson" TEXT NOT NULL,
    "teacherOverallComment" TEXT,
    "principalComment" TEXT,
    "directorComment" TEXT,
    "finalGrade" TEXT,
    "progressionDecisionId" TEXT,
    "promotionDisplayText" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "issuedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentReportCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReportCardBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentReportCardVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportCardId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "correctionReason" TEXT,
    "issuedAt" DATETIME NOT NULL,
    "issuedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentReportCardVersion_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "StudentReportCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentReportCardEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportCardId" TEXT NOT NULL,
    "versionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "actorLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentReportCardEvent_reportCardId_fkey" FOREIGN KEY ("reportCardId") REFERENCES "StudentReportCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "TimetableDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimetableEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL DEFAULT '2026-27',
    "classSectionId" TEXT NOT NULL,
    "dayOfWeek" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "assignmentId" TEXT,
    "teacherId" TEXT,
    "subjectId" TEXT,
    "label" TEXT,
    "entryType" TEXT NOT NULL DEFAULT 'EMPTY',
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimetableEntry_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "TimetableDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_classSectionId_fkey" FOREIGN KEY ("classSectionId") REFERENCES "TimetableClassSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TimetableAssignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TimetableTeacher" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TimetableEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "TimetableSubject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
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

-- CreateTable
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
    CONSTRAINT "TeacherAnalyticsSnapshot_reviewCycleId_fkey" FOREIGN KEY ("reviewCycleId") REFERENCES "TeacherAnalyticsReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherAnalyticsSnapshot_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
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
    CONSTRAINT "TeacherAnalyticsReview_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeacherAnalyticsSnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
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
    CONSTRAINT "TeacherAnalyticsEvent_reviewCycleId_fkey" FOREIGN KEY ("reviewCycleId") REFERENCES "TeacherAnalyticsReviewCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherAnalyticsEvent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TeacherAnalyticsSnapshot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TeacherAnalyticsEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "TeacherAnalyticsReview" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificateNumberSeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesCode" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "academicYear" TEXT,
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "paddingLength" INTEGER NOT NULL DEFAULT 4,
    "suffix" TEXT,
    "resetPolicy" TEXT NOT NULL DEFAULT 'NEVER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CertificateTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateCode" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "templateDefinitionJson" TEXT NOT NULL,
    "printSettingsJson" TEXT,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentCertificateRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestNumber" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "requestSource" TEXT NOT NULL DEFAULT 'INTERNAL',
    "purpose" TEXT NOT NULL,
    "requestedCopies" INTEGER NOT NULL DEFAULT 1,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "applicantGuardianId" TEXT,
    "internalNotes" TEXT,
    "publicNotes" TEXT,
    "reviewNotes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "rejectedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "reviewedAt" DATETIME,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "cancelledAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentCertificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "certificateType" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "certificateNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "draftDataJson" TEXT NOT NULL,
    "issuePurpose" TEXT NOT NULL,
    "internalNotes" TEXT,
    "publicNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "issuedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentCertificateVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "certificateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "correctionReason" TEXT,
    "reissueReason" TEXT,
    "issuedAt" DATETIME NOT NULL,
    "issuedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "snapshotHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StudentCertificateEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT,
    "certificateId" TEXT,
    "versionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ClassXPackageTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateCode" TEXT NOT NULL,
    "packageType" TEXT NOT NULL DEFAULT 'CLASS_X_COMPLETION_PACKAGE',
    "name" TEXT NOT NULL,
    "academicYear" TEXT,
    "schoolBoard" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "documentDefinitionJson" TEXT NOT NULL,
    "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultChargeRuleId" TEXT,
    "instructions" TEXT,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClassXDocumentPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageNumber" TEXT NOT NULL,
    "packageType" TEXT NOT NULL DEFAULT 'CLASS_X_COMPLETION_PACKAGE',
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requestSource" TEXT NOT NULL DEFAULT 'INTERNAL',
    "applicantGuardianId" TEXT,
    "purpose" TEXT,
    "templateSnapshotJson" TEXT NOT NULL,
    "eligibilitySnapshotJson" TEXT NOT NULL,
    "paymentRequired" BOOLEAN NOT NULL DEFAULT false,
    "totalRequiredItems" INTEGER NOT NULL DEFAULT 0,
    "readyItems" INTEGER NOT NULL DEFAULT 0,
    "handedOverItems" INTEGER NOT NULL DEFAULT 0,
    "internalNotes" TEXT,
    "publicNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "completedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "reviewedAt" DATETIME,
    "approvedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClassXDocumentPackage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassXDocumentPackage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ClassXPackageTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassXPackageDocumentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "issuerType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "parentVisible" BOOLEAN NOT NULL DEFAULT true,
    "serialNumberRequired" BOOLEAN NOT NULL DEFAULT false,
    "handoverRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "linkedStudentCertificateId" TEXT,
    "linkedStudentCertificateVersionId" TEXT,
    "externalDocumentReference" TEXT,
    "authorityName" TEXT,
    "requestDate" DATETIME,
    "externalIssueDate" DATETIME,
    "receivedDate" DATETIME,
    "verifiedDate" DATETIME,
    "handoverDate" DATETIME,
    "sourceNotes" TEXT,
    "publicNotes" TEXT,
    "rejectionReason" TEXT,
    "notApplicableReason" TEXT,
    "verifiedByUserId" TEXT,
    "handedOverByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClassXPackageDocumentItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassXPackageChargeRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleCode" TEXT NOT NULL,
    "academicYear" TEXT,
    "packageType" TEXT NOT NULL DEFAULT 'CLASS_X_COMPLETION_PACKAGE',
    "name" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "miscellaneousIncomeItemCode" TEXT NOT NULL,
    "paymentRequired" BOOLEAN NOT NULL DEFAULT true,
    "waiverAllowed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClassXPackageCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "chargeRuleId" TEXT,
    "chargeCode" TEXT NOT NULL,
    "miscellaneousIncomeItemCode" TEXT,
    "originalAmount" DECIMAL NOT NULL,
    "waivedAmount" DECIMAL NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL NOT NULL,
    "paidAmount" DECIMAL NOT NULL DEFAULT 0,
    "waiverAllowedSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "waiverReason" TEXT,
    "cancellationReason" TEXT,
    "approvedByUserId" TEXT,
    "waivedByUserId" TEXT,
    "collectedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "linkedMiscIncomeReceiptId" TEXT,
    "approvedAt" DATETIME,
    "waivedAt" DATETIME,
    "paidAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClassXPackageCharge_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassXPackageCharge_chargeRuleId_fkey" FOREIGN KEY ("chargeRuleId") REFERENCES "ClassXPackageChargeRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClassXPackageCharge_linkedMiscIncomeReceiptId_fkey" FOREIGN KEY ("linkedMiscIncomeReceiptId") REFERENCES "MiscIncomeReceipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassXPackageHandover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "handoverNumber" TEXT NOT NULL,
    "handoverDate" DATETIME NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "relationship" TEXT,
    "recipientAcknowledgementText" TEXT NOT NULL,
    "identityChecked" BOOLEAN NOT NULL DEFAULT false,
    "identityCheckMethod" TEXT,
    "itemSnapshotJson" TEXT NOT NULL,
    "handedOverByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassXPackageHandover_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClassXPackageEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packageId" TEXT NOT NULL,
    "documentItemId" TEXT,
    "chargeId" TEXT,
    "handoverId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassXPackageEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ClassXDocumentPackage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdentityCardNumberSeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seriesCode" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "academicYear" TEXT,
    "prefix" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "paddingLength" INTEGER NOT NULL DEFAULT 4,
    "suffix" TEXT,
    "resetPolicy" TEXT NOT NULL DEFAULT 'NEVER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IdentityCardTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateCode" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "frontDefinitionJson" TEXT NOT NULL,
    "backDefinitionJson" TEXT NOT NULL,
    "printSettingsJson" TEXT,
    "photoRequired" BOOLEAN NOT NULL DEFAULT false,
    "barcodeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IdentityCardBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNumber" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "academicYear" TEXT,
    "templateId" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "className" TEXT,
    "section" TEXT,
    "staffDesignation" TEXT,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "expectedCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "issuedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "scopeSnapshotJson" TEXT,
    "resultSnapshotJson" TEXT,
    "notes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "approvedAt" DATETIME,
    "issuedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IdentityCardBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IdentityCardTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdentityCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cardType" TEXT NOT NULL,
    "batchId" TEXT,
    "templateId" TEXT NOT NULL,
    "numberSeriesId" TEXT,
    "studentId" TEXT,
    "staffMemberId" TEXT,
    "academicYear" TEXT,
    "cardNumber" TEXT,
    "validFrom" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "draftDataJson" TEXT NOT NULL,
    "templateSnapshotJson" TEXT NOT NULL,
    "issueReason" TEXT,
    "revocationReason" TEXT,
    "cancellationReason" TEXT,
    "replacesCardId" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "issuedByUserId" TEXT,
    "revokedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "approvedAt" DATETIME,
    "issuedAt" DATETIME,
    "revokedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IdentityCard_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IdentityCardBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IdentityCard_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "IdentityCardTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IdentityCard_numberSeriesId_fkey" FOREIGN KEY ("numberSeriesId") REFERENCES "IdentityCardNumberSeries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IdentityCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IdentityCard_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IdentityCard_replacesCardId_fkey" FOREIGN KEY ("replacesCardId") REFERENCES "IdentityCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdentityCardVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identityCardId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "correctionReason" TEXT,
    "issuedAt" DATETIME NOT NULL,
    "issuedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "snapshotHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdentityCardVersion_identityCardId_fkey" FOREIGN KEY ("identityCardId") REFERENCES "IdentityCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdentityCardEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT,
    "identityCardId" TEXT,
    "versionId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdentityCardEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "IdentityCardBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IdentityCardEvent_identityCardId_fkey" FOREIGN KEY ("identityCardId") REFERENCES "IdentityCard" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IdentityCardEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "IdentityCardVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "defaultPriority" TEXT NOT NULL DEFAULT 'NORMAL',
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionPath" TEXT,
    "acknowledgmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignNumber" TEXT NOT NULL,
    "templateId" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionLabel" TEXT,
    "actionPath" TEXT,
    "audienceType" TEXT NOT NULL,
    "audienceDefinitionJson" TEXT NOT NULL,
    "audienceSnapshotJson" TEXT,
    "templateSnapshotJson" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "acknowledgmentRequired" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" DATETIME,
    "expiresAt" DATETIME,
    "totalResolvedUsers" INTEGER NOT NULL DEFAULT 0,
    "totalRecipientRows" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalRead" INTEGER NOT NULL DEFAULT 0,
    "totalAcknowledged" INTEGER NOT NULL DEFAULT 0,
    "totalDismissed" INTEGER NOT NULL DEFAULT 0,
    "correctionOfCampaignId" TEXT,
    "reviewNotes" TEXT,
    "withdrawalReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "withdrawnByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "archivedByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "publishedAt" DATETIME,
    "withdrawnAt" DATETIME,
    "cancelledAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationCampaign_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotificationCampaign_correctionOfCampaignId_fkey" FOREIGN KEY ("correctionOfCampaignId") REFERENCES "NotificationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientRoleSnapshot" TEXT NOT NULL,
    "contextType" TEXT NOT NULL,
    "recipientContextJson" TEXT NOT NULL,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "availableAt" DATETIME NOT NULL,
    "firstViewedAt" DATETIME,
    "readAt" DATETIME,
    "acknowledgedAt" DATETIME,
    "dismissedAt" DATETIME,
    "expiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationSkippedRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetReferenceKey" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "safeContextJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationSkippedRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT,
    "campaignId" TEXT,
    "recipientId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationEvent_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotificationEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "NotificationEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "NotificationRecipient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppIntegrationProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'META_CLOUD',
    "mode" TEXT NOT NULL DEFAULT 'MOCK',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "graphApiVersion" TEXT NOT NULL DEFAULT 'v25.0',
    "businessAccountReference" TEXT,
    "phoneNumberReference" TEXT,
    "displayPhoneMasked" TEXT,
    "defaultCountryCode" TEXT DEFAULT '+91',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "dailyMessageLimit" INTEGER,
    "hourlyMessageLimit" INTEGER,
    "costCapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maximumEstimatedBatchCostMinor" INTEGER,
    "costCapCurrency" TEXT NOT NULL DEFAULT 'INR',
    "costCapUpdatedAt" DATETIME,
    "costCapUpdatedByUserId" TEXT,
    "maximumRetryCount" INTEGER NOT NULL DEFAULT 3,
    "workerChunkSize" INTEGER NOT NULL DEFAULT 25,
    "liveSendingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastHealthCheckAt" DATETIME,
    "lastHealthCheckStatus" TEXT,
    "lastHealthCheckMessage" TEXT,
    "activatedByUserId" TEXT,
    "pausedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WhatsAppConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subjectType" TEXT NOT NULL,
    "guardianId" TEXT,
    "staffMemberId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "phoneHash" TEXT NOT NULL,
    "phoneLast4" TEXT NOT NULL,
    "countryCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPTED_OUT',
    "consentSource" TEXT NOT NULL,
    "consentWordingVersion" TEXT NOT NULL,
    "consentPurposeScope" TEXT NOT NULL DEFAULT 'SCHOOL_OPERATIONAL_UPDATES',
    "evidenceReference" TEXT,
    "notes" TEXT,
    "optedInAt" DATETIME,
    "optedOutAt" DATETIME,
    "expiresAt" DATETIME,
    "collectedByUserId" TEXT,
    "revokedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppConsent_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppConsentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "consentWordingVersion" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppConsentEvent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "WhatsAppConsent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppTemplateMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mappingCode" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "notificationCategory" TEXT NOT NULL,
    "internalPurpose" TEXT NOT NULL,
    "metaTemplateName" TEXT NOT NULL,
    "metaTemplateLanguage" TEXT NOT NULL,
    "metaTemplateCategory" TEXT,
    "providerTemplateId" TEXT,
    "providerStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "parameterDefinitionJson" TEXT NOT NULL,
    "sampleValuesJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "lastSyncedAt" DATETIME,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppTemplateMapping_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppOutboundBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNumber" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "notificationCampaignId" TEXT NOT NULL,
    "notificationCampaignSnapshotJson" TEXT NOT NULL,
    "templateMappingId" TEXT NOT NULL,
    "templateMappingSnapshotJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" DATETIME,
    "emergencyOverride" BOOLEAN NOT NULL DEFAULT false,
    "emergencyOverrideReason" TEXT,
    "totalCampaignRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalEligibleContacts" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalQueued" INTEGER NOT NULL DEFAULT 0,
    "totalAccepted" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalRead" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "totalOptedOut" INTEGER NOT NULL DEFAULT 0,
    "totalUnknown" INTEGER NOT NULL DEFAULT 0,
    "skipReasonCountsJson" TEXT NOT NULL DEFAULT '{}',
    "estimatedCostMinor" INTEGER,
    "estimatedCostCurrency" TEXT,
    "estimateRateVersion" TEXT,
    "costCapOverrideSnapshotHash" TEXT,
    "costCapOverrideReason" TEXT,
    "costCapOverrideEstimateMinor" INTEGER,
    "costCapOverrideLimitMinor" INTEGER,
    "costCapOverrideCurrency" TEXT,
    "costCapOverrideRateVersion" TEXT,
    "costCapOverriddenAt" DATETIME,
    "costCapOverriddenByUserId" TEXT,
    "approvalNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "startedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "approvedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppOutboundBatch_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppOutboundBatch_notificationCampaignId_fkey" FOREIGN KEY ("notificationCampaignId") REFERENCES "NotificationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppOutboundBatch_templateMappingId_fkey" FOREIGN KEY ("templateMappingId") REFERENCES "WhatsAppTemplateMapping" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "notificationRecipientId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectReferenceId" TEXT NOT NULL,
    "safeDisplayLabel" TEXT NOT NULL,
    "safeContextJson" TEXT,
    "phoneHash" TEXT NOT NULL,
    "phoneLast4" TEXT NOT NULL,
    "countryCode" TEXT,
    "consentId" TEXT NOT NULL,
    "templateNameSnapshot" TEXT NOT NULL,
    "templateLanguageSnapshot" TEXT NOT NULL,
    "templateCategorySnapshot" TEXT,
    "renderedParametersJson" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerErrorCategory" TEXT,
    "providerErrorCode" TEXT,
    "failureMessageSafe" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME,
    "claimedAt" DATETIME,
    "acceptedAt" DATETIME,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "readAt" DATETIME,
    "failedAt" DATETIME,
    "optedOutAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppDelivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WhatsAppOutboundBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppDeliveryAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "resultStatus" TEXT NOT NULL,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "errorCategory" TEXT,
    "errorCode" TEXT,
    "safeErrorMessage" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "WhatsAppDelivery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationProfileId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "deliveryId" TEXT,
    "eventType" TEXT NOT NULL,
    "mappedStatus" TEXT,
    "signatureValid" BOOLEAN NOT NULL,
    "processingStatus" TEXT NOT NULL,
    "duplicateReceiptCount" INTEGER NOT NULL DEFAULT 0,
    "safeSummaryJson" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppWebhookEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppWebhookEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "WhatsAppDelivery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppOperationalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationProfileId" TEXT NOT NULL,
    "batchId" TEXT,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "limitValue" INTEGER,
    "currentUsage" INTEGER,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "nextEligibleAt" DATETIME,
    "retryAfterSeconds" INTEGER,
    "safeReason" TEXT,
    "estimatedCostMinor" INTEGER,
    "costCapMinor" INTEGER,
    "currency" TEXT,
    "rateVersion" TEXT,
    "snapshotHash" TEXT,
    "recordedByUserId" TEXT,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "lastOccurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppOperationalEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppOperationalEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WhatsAppOutboundBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppRateReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationProfileId" TEXT,
    "rateVersion" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "countryCallingCode" TEXT NOT NULL,
    "templateCategory" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "ratePerDeliveredMessage" DECIMAL NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    "sourceReviewDate" DATETIME NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WhatsAppRateReference_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "WhatsAppIntegrationProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsEmailIntegrationProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileCode" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'MOCK',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "providerApiVersion" TEXT,
    "senderIdentityMasked" TEXT,
    "senderDomain" TEXT,
    "defaultCountryCode" TEXT DEFAULT '+91',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "hourlyLimit" INTEGER,
    "dailyLimit" INTEGER,
    "workerChunkSize" INTEGER NOT NULL DEFAULT 25,
    "maximumRetryCount" INTEGER NOT NULL DEFAULT 3,
    "liveSendingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "costCapEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maximumEstimatedBatchCostMinor" INTEGER,
    "costCapCurrency" TEXT NOT NULL DEFAULT 'INR',
    "dltPrincipalEntityReference" TEXT,
    "dltHeaderReference" TEXT,
    "spfStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "dkimStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "dmarcStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "senderAliasStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastHealthCheckAt" DATETIME,
    "lastHealthCheckStatus" TEXT,
    "lastHealthCheckMessage" TEXT,
    "activatedByUserId" TEXT,
    "pausedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SmsEmailConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "guardianId" TEXT,
    "staffMemberId" TEXT,
    "contactHash" TEXT NOT NULL,
    "contactMasked" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPTED_OUT',
    "consentSource" TEXT NOT NULL,
    "consentWordingVersion" TEXT NOT NULL,
    "consentPurposeScope" TEXT NOT NULL DEFAULT 'SCHOOL_OPERATIONAL_UPDATES',
    "evidenceReference" TEXT,
    "optedInAt" DATETIME,
    "optedOutAt" DATETIME,
    "expiresAt" DATETIME,
    "collectedByUserId" TEXT,
    "revokedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmsEmailConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SmsEmailConsent_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsEmailConsentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "consentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "consentWordingVersion" TEXT,
    "reason" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsEmailConsentEvent_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "SmsEmailConsent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsEmailTemplateMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mappingCode" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "notificationCategory" TEXT NOT NULL,
    "internalPurpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "providerStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "smsPrincipalEntityReference" TEXT,
    "smsHeader" TEXT,
    "smsDltTemplateId" TEXT,
    "smsTemplateCategory" TEXT,
    "smsTemplateText" TEXT,
    "emailSenderAlias" TEXT,
    "emailSubjectTemplate" TEXT,
    "emailTextTemplate" TEXT,
    "emailReplyToAlias" TEXT,
    "parameterDefinitionJson" TEXT NOT NULL,
    "sampleValuesJson" TEXT,
    "lastSyncedAt" DATETIME,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmsEmailTemplateMapping_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsEmailOutboundBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNumber" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "integrationProfileId" TEXT NOT NULL,
    "notificationCampaignId" TEXT NOT NULL,
    "notificationCampaignSnapshotJson" TEXT NOT NULL,
    "templateMappingId" TEXT NOT NULL,
    "templateSnapshotJson" TEXT NOT NULL,
    "profileSnapshotJson" TEXT NOT NULL,
    "readinessSnapshotJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" DATETIME,
    "emergencyOverride" BOOLEAN NOT NULL DEFAULT false,
    "totalCampaignRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalEligibleContacts" INTEGER NOT NULL DEFAULT 0,
    "totalSkipped" INTEGER NOT NULL DEFAULT 0,
    "totalQueued" INTEGER NOT NULL DEFAULT 0,
    "totalAccepted" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalDelivered" INTEGER NOT NULL DEFAULT 0,
    "totalBounced" INTEGER NOT NULL DEFAULT 0,
    "totalComplained" INTEGER NOT NULL DEFAULT 0,
    "totalSuppressed" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "skipReasonCountsJson" TEXT NOT NULL DEFAULT '{}',
    "estimatedSegments" INTEGER,
    "estimatedMaximumCostMinor" INTEGER,
    "estimatedDeliveredCostMinor" INTEGER,
    "estimatedCostCurrency" TEXT,
    "rateVersion" TEXT,
    "costCapOverrideSnapshotJson" TEXT,
    "approvalNotes" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "startedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "approvedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmsEmailOutboundBatch_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SmsEmailOutboundBatch_notificationCampaignId_fkey" FOREIGN KEY ("notificationCampaignId") REFERENCES "NotificationCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SmsEmailOutboundBatch_templateMappingId_fkey" FOREIGN KEY ("templateMappingId") REFERENCES "SmsEmailTemplateMapping" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsEmailDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "notificationRecipientId" TEXT,
    "channel" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "guardianId" TEXT,
    "staffMemberId" TEXT,
    "contactHash" TEXT NOT NULL,
    "contactMasked" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "safeContextJson" TEXT,
    "renderedSubject" TEXT,
    "renderedParametersSnapshotJson" TEXT NOT NULL,
    "smsSegmentCount" INTEGER,
    "requestFingerprint" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "skipReasonCode" TEXT,
    "failureCode" TEXT,
    "failureCategory" TEXT,
    "failureMessageSafe" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME,
    "claimedAt" DATETIME,
    "acceptedAt" DATETIME,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "bouncedAt" DATETIME,
    "complainedAt" DATETIME,
    "suppressedAt" DATETIME,
    "failedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmsEmailDelivery_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SmsEmailOutboundBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SmsEmailDelivery_notificationRecipientId_fkey" FOREIGN KEY ("notificationRecipientId") REFERENCES "NotificationRecipient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SmsEmailDelivery_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SmsEmailDelivery_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SmsEmailDelivery_consentId_fkey" FOREIGN KEY ("consentId") REFERENCES "SmsEmailConsent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsEmailDeliveryAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "providerMode" TEXT NOT NULL,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestFingerprint" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "result" TEXT NOT NULL,
    "providerHttpStatus" INTEGER,
    "providerErrorCode" TEXT,
    "safeErrorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsEmailDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SmsEmailDelivery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsEmailWebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationProfileId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "channel" TEXT NOT NULL,
    "providerEventKey" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "eventType" TEXT NOT NULL,
    "mappedStatus" TEXT,
    "signatureVerified" BOOLEAN NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "processingStatus" TEXT NOT NULL,
    "safePayloadJson" TEXT NOT NULL,
    "failureReason" TEXT,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsEmailWebhookEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SmsEmailWebhookEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "SmsEmailDelivery" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsEmailOperationalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationProfileId" TEXT NOT NULL,
    "batchId" TEXT,
    "eventKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "safeReason" TEXT,
    "snapshotJson" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsEmailOperationalEvent_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SmsEmailOperationalEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SmsEmailOutboundBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsEmailSuppression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "guardianId" TEXT,
    "staffMemberId" TEXT,
    "contactHash" TEXT NOT NULL,
    "contactMasked" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "providerReference" TEXT,
    "reviewReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clearedAt" DATETIME,
    "createdByUserId" TEXT,
    "clearedByUserId" TEXT,
    CONSTRAINT "SmsEmailSuppression_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "Guardian" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SmsEmailSuppression_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsEmailCostRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "integrationProfileId" TEXT,
    "channel" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "messageCategory" TEXT NOT NULL,
    "encodingType" TEXT,
    "currency" TEXT NOT NULL,
    "rateMinor" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "rateVersion" TEXT NOT NULL,
    "effectiveFrom" DATETIME NOT NULL,
    "sourceReviewDate" DATETIME NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmsEmailCostRate_integrationProfileId_fkey" FOREIGN KEY ("integrationProfileId") REFERENCES "SmsEmailIntegrationProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiAssistantProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL DEFAULT 'MOCK',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "liveUseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedModesJson" TEXT NOT NULL DEFAULT '["DOCUMENTATION","AGGREGATE_OPERATIONS"]',
    "maximumQuestionLength" INTEGER NOT NULL DEFAULT 1000,
    "maximumContextCharacters" INTEGER NOT NULL DEFAULT 12000,
    "maximumToolCalls" INTEGER NOT NULL DEFAULT 3,
    "maximumRowsPerTool" INTEGER NOT NULL DEFAULT 100,
    "requestTimeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "minimumAggregateGroupSize" INTEGER NOT NULL DEFAULT 5,
    "contentLoggingMode" TEXT NOT NULL DEFAULT 'HASH_ONLY',
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "providerModelReference" TEXT,
    "lastHealthCheckAt" DATETIME,
    "lastHealthCheckStatus" TEXT,
    "lastHealthCheckMessage" TEXT,
    "activatedByUserId" TEXT,
    "pausedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiAssistantSourcePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyCode" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "allowedRolesJson" TEXT NOT NULL,
    "allowedModesJson" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minimumGroupSize" INTEGER,
    "maximumRows" INTEGER,
    "freshnessWarningDays" INTEGER,
    "prohibitedFieldKeysJson" TEXT NOT NULL,
    "citationLabel" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiAssistantQueryAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assistantProfileId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "questionHash" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL,
    "providerModelReference" TEXT,
    "safetyDecision" TEXT NOT NULL,
    "refusalReasonCode" TEXT,
    "toolKeysJson" TEXT NOT NULL DEFAULT '[]',
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "citationCount" INTEGER NOT NULL DEFAULT 0,
    "retrievedCharacterCount" INTEGER NOT NULL DEFAULT 0,
    "redactionCount" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "answerHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "AiAssistantSafetyEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queryAuditId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "safeReason" TEXT NOT NULL,
    "safeMetadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AiAssistantEvaluationCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expectedDecision" TEXT NOT NULL,
    "requiredSourceKeysJson" TEXT NOT NULL DEFAULT '[]',
    "prohibitedTermsJson" TEXT NOT NULL DEFAULT '[]',
    "expectedAnswerContainsJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AiAssistantEvaluationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runNumber" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "totalCases" INTEGER NOT NULL DEFAULT 0,
    "passedCases" INTEGER NOT NULL DEFAULT 0,
    "failedCases" INTEGER NOT NULL DEFAULT 0,
    "blockedCases" INTEGER NOT NULL DEFAULT 0,
    "resultSummaryJson" TEXT NOT NULL DEFAULT '{}',
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "liveUseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentPostingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maximumFileBytes" INTEGER NOT NULL DEFAULT 10485760,
    "maximumImagePixels" INTEGER NOT NULL DEFAULT 40000000,
    "maximumPagesPerBatch" INTEGER NOT NULL DEFAULT 20,
    "maximumRowsPerPage" INTEGER NOT NULL DEFAULT 200,
    "requestTimeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "minimumSuggestionConfidence" INTEGER NOT NULL DEFAULT 70,
    "retentionDays" INTEGER,
    "createdByUserId" TEXT,
    "activatedByUserId" TEXT,
    "pausedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNumber" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "registerName" TEXT NOT NULL,
    "registerPeriodStart" DATETIME,
    "registerPeriodEnd" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourcePageCount" INTEGER NOT NULL DEFAULT 0,
    "extractedRowCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedRowCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateRowCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedRowCount" INTEGER NOT NULL DEFAULT 0,
    "postedRowCount" INTEGER NOT NULL DEFAULT 0,
    "postingFailedRowCount" INTEGER NOT NULL DEFAULT 0,
    "totalExtractedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalVerifiedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalPostedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "reviewVersion" INTEGER NOT NULL DEFAULT 1,
    "approvedReviewVersion" INTEGER,
    "reviewNotes" TEXT,
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "createdByUserId" TEXT,
    "submittedByUserId" TEXT,
    "approvedByUserId" TEXT,
    "postedByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "submittedAt" DATETIME,
    "approvedAt" DATETIME,
    "postedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeRegisterOcrBatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "FeeRegisterOcrProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrPage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "originalDisplayName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "rotationDegrees" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "providerKind" TEXT NOT NULL,
    "providerRequestReferenceSafe" TEXT,
    "rawOcrText" TEXT,
    "overallConfidence" INTEGER,
    "failureMessageSafe" TEXT,
    "processedAt" DATETIME,
    "verifiedAt" DATETIME,
    "purgeAfter" DATETIME,
    "purgedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeRegisterOcrPage_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeeRegisterOcrBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrRow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "boundingBoxJson" TEXT,
    "rawText" TEXT NOT NULL,
    "extractedFieldsJson" TEXT NOT NULL,
    "fieldConfidenceJson" TEXT NOT NULL,
    "candidateMatchesJson" TEXT NOT NULL DEFAULT '[]',
    "matchedStudentId" TEXT,
    "matchingMethod" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'EXTRACTED',
    "paymentDate" DATETIME,
    "amountMinor" INTEGER,
    "paymentMode" TEXT,
    "receivedAccount" TEXT,
    "academicTerm" TEXT,
    "handwrittenReceiptReference" TEXT,
    "registerRemarks" TEXT,
    "duplicateClassification" TEXT NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "duplicateEvidenceJson" TEXT,
    "duplicateResolutionReason" TEXT,
    "verificationChecklistJson" TEXT,
    "verificationSnapshotJson" TEXT,
    "verifiedByUserId" TEXT,
    "verifiedAt" DATETIME,
    "rejectedByUserId" TEXT,
    "rejectedAt" DATETIME,
    "rejectionReason" TEXT,
    "postedPaymentId" TEXT,
    "postingFailureSafe" TEXT,
    "postedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeRegisterOcrRow_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "FeeRegisterOcrPage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrRowRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rowId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "previousSnapshotJson" TEXT NOT NULL,
    "newSnapshotJson" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeeRegisterOcrRowRevision_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "FeeRegisterOcrRow" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrPostingRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runNumber" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "reviewVersion" INTEGER NOT NULL,
    "selectedRowIdsJson" TEXT NOT NULL,
    "selectedRowCount" INTEGER NOT NULL,
    "attemptedAmountMinor" INTEGER NOT NULL,
    "postedRowCount" INTEGER NOT NULL DEFAULT 0,
    "postedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "failedRowCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PREVIEWED',
    "financialPreviewJson" TEXT NOT NULL,
    "postingPolicySnapshotJson" TEXT NOT NULL,
    "approvalReason" TEXT,
    "failureSummaryJson" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "processedByUserId" TEXT,
    "approvedAt" DATETIME,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeeRegisterOcrPostingRun_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeeRegisterOcrBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeeRegisterOcrEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "pageId" TEXT,
    "rowId" TEXT,
    "postingRunId" TEXT,
    "eventType" TEXT NOT NULL,
    "safeReason" TEXT,
    "safeMetadataJson" TEXT,
    "actorUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeeRegisterOcrEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "FeeRegisterOcrBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CloudBackupProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerKind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "liveUseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "destinationLabel" TEXT NOT NULL,
    "destinationReferenceMasked" TEXT,
    "encryptionKeyVersion" TEXT NOT NULL,
    "containerFormatVersion" INTEGER NOT NULL DEFAULT 1,
    "compressionAlgorithm" TEXT NOT NULL DEFAULT 'GZIP',
    "encryptionAlgorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM',
    "verificationRequired" BOOLEAN NOT NULL DEFAULT true,
    "automaticRestoreRehearsalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maximumRetryCount" INTEGER NOT NULL DEFAULT 3,
    "requestTimeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "maximumArtifactBytes" INTEGER,
    "privateAssetsIncluded" BOOLEAN NOT NULL DEFAULT false,
    "lastHealthCheckAt" DATETIME,
    "lastHealthCheckStatus" TEXT,
    "lastHealthCheckMessage" TEXT,
    "activatedByUserId" TEXT,
    "pausedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CloudBackupSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleCode" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MANUAL_ONLY',
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "hourOfDay" INTEGER,
    "minuteOfHour" INTEGER,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "catchUpPolicy" TEXT NOT NULL DEFAULT 'SKIP_MISSED',
    "nextRunAt" DATETIME,
    "lastDueAt" DATETIME,
    "lastStartedAt" DATETIME,
    "lastCompletedAt" DATETIME,
    "consecutiveFailureCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CloudBackupSchedule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CloudBackupRetentionPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyCode" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "keepLatestVerifiedCount" INTEGER NOT NULL DEFAULT 2,
    "keepDailyDays" INTEGER NOT NULL DEFAULT 14,
    "keepWeeklyWeeks" INTEGER NOT NULL DEFAULT 8,
    "keepMonthlyMonths" INTEGER NOT NULL DEFAULT 12,
    "minimumVerifiedCopies" INTEGER NOT NULL DEFAULT 2,
    "protectLatestVerified" BOOLEAN NOT NULL DEFAULT true,
    "autoPruneEnabled" BOOLEAN NOT NULL DEFAULT false,
    "preserveFailedRuns" BOOLEAN NOT NULL DEFAULT true,
    "preserveRestoreRehearsalSources" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CloudBackupRetentionPolicy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CloudBackupRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runNumber" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "triggerType" TEXT NOT NULL,
    "scheduledDueAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "sourceBackupVersion" INTEGER,
    "sourceGeneratedAt" DATETIME,
    "sourcePlaintextSha256" TEXT,
    "ciphertextSha256" TEXT,
    "plaintextBytes" INTEGER,
    "compressedBytes" INTEGER,
    "encryptedBytes" INTEGER,
    "encryptionKeyVersion" TEXT,
    "containerFormatVersion" INTEGER,
    "providerObjectReferenceSafe" TEXT,
    "providerObjectVersionSafe" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" DATETIME,
    "failureCode" TEXT,
    "failureMessageSafe" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "cancellationReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CloudBackupRun_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CloudBackupRun_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CloudBackupSchedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CloudBackupArtifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL DEFAULT 'DATABASE_BACKUP',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "objectKeySafe" TEXT NOT NULL,
    "providerObjectIdSafe" TEXT,
    "encryptionKeyVersion" TEXT NOT NULL,
    "plaintextSha256" TEXT NOT NULL,
    "ciphertextSha256" TEXT NOT NULL,
    "plaintextBytes" INTEGER NOT NULL,
    "compressedBytes" INTEGER NOT NULL,
    "ciphertextBytes" INTEGER NOT NULL,
    "privateAssetsIncluded" BOOLEAN NOT NULL DEFAULT false,
    "sourceCoverageJson" TEXT NOT NULL,
    "uploadedAt" DATETIME,
    "verifiedAt" DATETIME,
    "prunedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CloudBackupArtifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CloudBackupVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "expectedValueHash" TEXT,
    "actualValueHash" TEXT,
    "safeSummary" TEXT NOT NULL,
    "failureCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloudBackupVerification_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CloudBackupVerification_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CloudBackupArtifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CloudBackupRestoreRehearsal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rehearsalNumber" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "backupVersion" INTEGER,
    "firstRestoreSummaryJson" TEXT,
    "secondRestoreSummaryJson" TEXT,
    "countDigestBefore" TEXT,
    "countDigestAfterFirst" TEXT,
    "countDigestAfterSecond" TEXT,
    "sourceDatabaseUnchangedHash" TEXT,
    "temporaryDatabaseRemoved" BOOLEAN NOT NULL DEFAULT false,
    "failureCode" TEXT,
    "failureMessageSafe" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdByUserId" TEXT,
    "cancelledByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CloudBackupRestoreRehearsal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CloudBackupRestoreRehearsal_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CloudBackupArtifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CloudBackupEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT,
    "scheduleId" TEXT,
    "runId" TEXT,
    "artifactId" TEXT,
    "rehearsalId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "safeMetadataJson" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloudBackupEvent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CloudBackupProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CloudBackupEvent_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "CloudBackupSchedule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CloudBackupEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CloudBackupRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CloudBackupEvent_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CloudBackupArtifact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CloudBackupEvent_rehearsalId_fkey" FOREIGN KEY ("rehearsalId") REFERENCES "CloudBackupRestoreRehearsal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicWebsiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settingsCode" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "tagline" TEXT,
    "publicSiteUrl" TEXT,
    "publicAddress" TEXT,
    "publicOfficePhone" TEXT,
    "publicOfficeEmail" TEXT,
    "publicOfficeHours" TEXT,
    "publicDirectionsUrl" TEXT,
    "portalLoginPath" TEXT NOT NULL DEFAULT '/login',
    "defaultSeoTitle" TEXT NOT NULL,
    "defaultSeoDescription" TEXT NOT NULL,
    "defaultSocialImageKey" TEXT,
    "themeConfigJson" TEXT NOT NULL DEFAULT '{}',
    "contactConfigJson" TEXT NOT NULL DEFAULT '{}',
    "socialLinksJson" TEXT,
    "mandatoryDisclosureEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewVersion" INTEGER NOT NULL DEFAULT 1,
    "approvedReviewVersion" INTEGER,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PublicWebsitePage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageCode" TEXT NOT NULL,
    "pageType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "navigationLabel" TEXT,
    "summary" TEXT,
    "draftContentJson" TEXT NOT NULL,
    "draftSeoJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewVersion" INTEGER NOT NULL DEFAULT 1,
    "approvedReviewVersion" INTEGER,
    "currentPublishedVersionId" TEXT,
    "showInNavigation" BOOLEAN NOT NULL DEFAULT false,
    "navigationOrder" INTEGER,
    "indexable" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "publishedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PublicWebsitePageVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "titleSnapshot" TEXT NOT NULL,
    "slugSnapshot" TEXT NOT NULL,
    "contentSnapshotJson" TEXT NOT NULL,
    "seoSnapshotJson" TEXT NOT NULL,
    "settingsSnapshotJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "publicationReason" TEXT,
    "correctionReason" TEXT,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicWebsitePageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PublicWebsitePage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicWebsitePost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postNumber" TEXT NOT NULL,
    "postType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "draftContentJson" TEXT NOT NULL,
    "draftSeoJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewVersion" INTEGER NOT NULL DEFAULT 1,
    "approvedReviewVersion" INTEGER,
    "currentPublishedVersionId" TEXT,
    "publishAt" DATETIME,
    "expireAt" DATETIME,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "publishedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "reviewedAt" DATETIME,
    "publishedAt" DATETIME,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PublicWebsitePostVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "versionType" TEXT NOT NULL DEFAULT 'ORIGINAL',
    "titleSnapshot" TEXT NOT NULL,
    "slugSnapshot" TEXT NOT NULL,
    "summarySnapshot" TEXT NOT NULL,
    "contentSnapshotJson" TEXT NOT NULL,
    "seoSnapshotJson" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "publicationReason" TEXT,
    "correctionReason" TEXT,
    "publishAt" DATETIME,
    "expireAt" DATETIME,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedByUserId" TEXT,
    "supersedesVersionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicWebsitePostVersion_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PublicWebsitePost" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicWebsiteNavigationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "pageId" TEXT,
    "safeExternalUrl" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "placement" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "opensNewTab" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublicWebsiteNavigationItem_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "PublicWebsitePage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicWebsiteEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "safeReason" TEXT,
    "safeMetadataJson" TEXT,
    "actorUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_admissionNo_key" ON "Student"("admissionNo");

-- CreateIndex
CREATE INDEX "Student_academicYear_idx" ON "Student"("academicYear");

-- CreateIndex
CREATE INDEX "Student_className_section_idx" ON "Student"("className", "section");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE INDEX "FeeStructure_academicYear_idx" ON "FeeStructure"("academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_academicYear_className_key" ON "FeeStructure"("academicYear", "className");

-- CreateIndex
CREATE INDEX "Payment_date_idx" ON "Payment"("date");

-- CreateIndex
CREATE INDEX "Payment_receiptNo_idx" ON "Payment"("receiptNo");

-- CreateIndex
CREATE INDEX "Payment_admissionNo_idx" ON "Payment"("admissionNo");

-- CreateIndex
CREATE INDEX "Payment_feeType_idx" ON "Payment"("feeType");

-- CreateIndex
CREATE INDEX "Payment_paymentMode_idx" ON "Payment"("paymentMode");

-- CreateIndex
CREATE INDEX "Payment_receivedAccount_idx" ON "Payment"("receivedAccount");

-- CreateIndex
CREATE INDEX "Payment_isCancelled_idx" ON "Payment"("isCancelled");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptNote_receiptNo_key" ON "ReceiptNote"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_guardianId_key" ON "User"("guardianId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_guardianId_idx" ON "User"("guardianId");

-- CreateIndex
CREATE INDEX "AcademicYearEnrollment_academicYear_className_section_idx" ON "AcademicYearEnrollment"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "AcademicYearEnrollment_academicYear_status_idx" ON "AcademicYearEnrollment"("academicYear", "status");

-- CreateIndex
CREATE INDEX "AcademicYearEnrollment_studentId_createdAt_idx" ON "AcademicYearEnrollment"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYearEnrollment_studentId_academicYear_key" ON "AcademicYearEnrollment"("studentId", "academicYear");

-- CreateIndex
CREATE INDEX "StudentProgressionDecision_studentId_createdAt_idx" ON "StudentProgressionDecision"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentProgressionDecision_academicYear_decisionType_status_idx" ON "StudentProgressionDecision"("academicYear", "decisionType", "status");

-- CreateIndex
CREATE INDEX "StudentProgressionDecision_sourceEnrollmentId_idx" ON "StudentProgressionDecision"("sourceEnrollmentId");

-- CreateIndex
CREATE INDEX "StudentProgressionDecision_createdByUserId_idx" ON "StudentProgressionDecision"("createdByUserId");

-- CreateIndex
CREATE INDEX "StudentProgressionDecision_approvedByUserId_idx" ON "StudentProgressionDecision"("approvedByUserId");

-- CreateIndex
CREATE INDEX "StudentLifecycleEvent_studentId_effectiveDate_idx" ON "StudentLifecycleEvent"("studentId", "effectiveDate");

-- CreateIndex
CREATE INDEX "StudentLifecycleEvent_academicYear_eventType_idx" ON "StudentLifecycleEvent"("academicYear", "eventType");

-- CreateIndex
CREATE INDEX "StudentLifecycleEvent_approvedByUserId_idx" ON "StudentLifecycleEvent"("approvedByUserId");

-- CreateIndex
CREATE INDEX "StudentLifecycleEvent_recordedByUserId_idx" ON "StudentLifecycleEvent"("recordedByUserId");

-- CreateIndex
CREATE INDEX "StudentAttendanceSession_attendanceDate_idx" ON "StudentAttendanceSession"("attendanceDate");

-- CreateIndex
CREATE INDEX "StudentAttendanceSession_academicYear_className_section_idx" ON "StudentAttendanceSession"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "StudentAttendanceSession_status_idx" ON "StudentAttendanceSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendanceSession_attendanceDate_className_section_academicYear_key" ON "StudentAttendanceSession"("attendanceDate", "className", "section", "academicYear");

-- CreateIndex
CREATE INDEX "StudentAttendanceRecord_studentId_idx" ON "StudentAttendanceRecord"("studentId");

-- CreateIndex
CREATE INDEX "StudentAttendanceRecord_status_idx" ON "StudentAttendanceRecord"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendanceRecord_sessionId_studentId_key" ON "StudentAttendanceRecord"("sessionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_staffCode_key" ON "StaffMember"("staffCode");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_userId_key" ON "StaffMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_timetableTeacherId_key" ON "StaffMember"("timetableTeacherId");

-- CreateIndex
CREATE INDEX "StaffMember_fullName_idx" ON "StaffMember"("fullName");

-- CreateIndex
CREATE INDEX "StaffMember_staffType_idx" ON "StaffMember"("staffType");

-- CreateIndex
CREATE INDEX "StaffMember_designation_idx" ON "StaffMember"("designation");

-- CreateIndex
CREATE INDEX "StaffMember_primarySubject_idx" ON "StaffMember"("primarySubject");

-- CreateIndex
CREATE INDEX "StaffMember_mobile_idx" ON "StaffMember"("mobile");

-- CreateIndex
CREATE INDEX "StaffMember_email_idx" ON "StaffMember"("email");

-- CreateIndex
CREATE INDEX "StaffMember_status_idx" ON "StaffMember"("status");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_staffMemberId_startDate_endDate_idx" ON "StaffLeaveRequest"("staffMemberId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_status_idx" ON "StaffLeaveRequest"("status");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_leaveType_idx" ON "StaffLeaveRequest"("leaveType");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_startDate_endDate_idx" ON "StaffLeaveRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_requestedByUserId_idx" ON "StaffLeaveRequest"("requestedByUserId");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_approverUserId_idx" ON "StaffLeaveRequest"("approverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceSession_attendanceDate_key" ON "StaffAttendanceSession"("attendanceDate");

-- CreateIndex
CREATE INDEX "StaffAttendanceSession_status_idx" ON "StaffAttendanceSession"("status");

-- CreateIndex
CREATE INDEX "StaffAttendanceRecord_staffMemberId_idx" ON "StaffAttendanceRecord"("staffMemberId");

-- CreateIndex
CREATE INDEX "StaffAttendanceRecord_status_idx" ON "StaffAttendanceRecord"("status");

-- CreateIndex
CREATE INDEX "StaffAttendanceRecord_source_idx" ON "StaffAttendanceRecord"("source");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendanceRecord_sessionId_staffMemberId_key" ON "StaffAttendanceRecord"("sessionId", "staffMemberId");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_assignmentDate_idx" ON "SubstituteAssignment"("assignmentDate");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_status_idx" ON "SubstituteAssignment"("status");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_absentStaffMemberId_assignmentDate_idx" ON "SubstituteAssignment"("absentStaffMemberId", "assignmentDate");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_substituteStaffMemberId_assignmentDate_idx" ON "SubstituteAssignment"("substituteStaffMemberId", "assignmentDate");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_leaveRequestId_idx" ON "SubstituteAssignment"("leaveRequestId");

-- CreateIndex
CREATE INDEX "SubstituteAssignment_timetableAssignmentId_idx" ON "SubstituteAssignment"("timetableAssignmentId");

-- CreateIndex
CREATE INDEX "Notice_status_publishDate_idx" ON "Notice"("status", "publishDate");

-- CreateIndex
CREATE INDEX "Notice_audienceType_className_section_idx" ON "Notice"("audienceType", "className", "section");

-- CreateIndex
CREATE INDEX "Notice_expiresAt_idx" ON "Notice"("expiresAt");

-- CreateIndex
CREATE INDEX "Notice_createdById_idx" ON "Notice"("createdById");

-- CreateIndex
CREATE INDEX "Notice_updatedById_idx" ON "Notice"("updatedById");

-- CreateIndex
CREATE INDEX "Guardian_displayName_idx" ON "Guardian"("displayName");

-- CreateIndex
CREATE INDEX "Guardian_primaryMobile_idx" ON "Guardian"("primaryMobile");

-- CreateIndex
CREATE INDEX "Guardian_email_idx" ON "Guardian"("email");

-- CreateIndex
CREATE INDEX "Guardian_status_idx" ON "Guardian"("status");

-- CreateIndex
CREATE INDEX "StudentGuardian_guardianId_idx" ON "StudentGuardian"("guardianId");

-- CreateIndex
CREATE INDEX "StudentGuardian_studentId_idx" ON "StudentGuardian"("studentId");

-- CreateIndex
CREATE INDEX "StudentGuardian_isPrimaryContact_idx" ON "StudentGuardian"("isPrimaryContact");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_guardianId_studentId_key" ON "StudentGuardian"("guardianId", "studentId");

-- CreateIndex
CREATE INDEX "UserAudit_action_idx" ON "UserAudit"("action");

-- CreateIndex
CREATE INDEX "UserAudit_actorUserId_idx" ON "UserAudit"("actorUserId");

-- CreateIndex
CREATE INDEX "UserAudit_targetUserId_idx" ON "UserAudit"("targetUserId");

-- CreateIndex
CREATE INDEX "UserAudit_createdAt_idx" ON "UserAudit"("createdAt");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE INDEX "RolePermission_permission_idx" ON "RolePermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendorCode_key" ON "Vendor"("vendorCode");

-- CreateIndex
CREATE INDEX "Vendor_name_idx" ON "Vendor"("name");

-- CreateIndex
CREATE INDEX "Vendor_mobile_idx" ON "Vendor"("mobile");

-- CreateIndex
CREATE INDEX "Vendor_gstin_idx" ON "Vendor"("gstin");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_code_key" ON "ExpenseCategory"("code");

-- CreateIndex
CREATE INDEX "ExpenseCategory_status_idx" ON "ExpenseCategory"("status");

-- CreateIndex
CREATE INDEX "ExpenseCategory_parentCategoryId_idx" ON "ExpenseCategory"("parentCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseDepartment_name_key" ON "ExpenseDepartment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseDepartment_code_key" ON "ExpenseDepartment"("code");

-- CreateIndex
CREATE INDEX "ExpenseDepartment_status_idx" ON "ExpenseDepartment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseRecord_expenseNumber_key" ON "ExpenseRecord"("expenseNumber");

-- CreateIndex
CREATE INDEX "ExpenseRecord_expenseDate_idx" ON "ExpenseRecord"("expenseDate");

-- CreateIndex
CREATE INDEX "ExpenseRecord_academicYear_idx" ON "ExpenseRecord"("academicYear");

-- CreateIndex
CREATE INDEX "ExpenseRecord_vendorId_idx" ON "ExpenseRecord"("vendorId");

-- CreateIndex
CREATE INDEX "ExpenseRecord_categoryId_idx" ON "ExpenseRecord"("categoryId");

-- CreateIndex
CREATE INDEX "ExpenseRecord_departmentId_idx" ON "ExpenseRecord"("departmentId");

-- CreateIndex
CREATE INDEX "ExpenseRecord_approvalStatus_idx" ON "ExpenseRecord"("approvalStatus");

-- CreateIndex
CREATE INDEX "ExpenseRecord_paymentStatus_idx" ON "ExpenseRecord"("paymentStatus");

-- CreateIndex
CREATE INDEX "ExpensePayment_expenseRecordId_paymentDate_idx" ON "ExpensePayment"("expenseRecordId", "paymentDate");

-- CreateIndex
CREATE INDEX "ExpenseAudit_expenseRecordId_createdAt_idx" ON "ExpenseAudit"("expenseRecordId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetPlan_budgetNumber_key" ON "BudgetPlan"("budgetNumber");

-- CreateIndex
CREATE INDEX "BudgetPlan_academicYear_idx" ON "BudgetPlan"("academicYear");

-- CreateIndex
CREATE INDEX "BudgetPlan_status_idx" ON "BudgetPlan"("status");

-- CreateIndex
CREATE INDEX "BudgetPlan_academicYear_status_idx" ON "BudgetPlan"("academicYear", "status");

-- CreateIndex
CREATE INDEX "BudgetAllocation_budgetPlanId_idx" ON "BudgetAllocation"("budgetPlanId");

-- CreateIndex
CREATE INDEX "BudgetAllocation_categoryId_idx" ON "BudgetAllocation"("categoryId");

-- CreateIndex
CREATE INDEX "BudgetAllocation_departmentId_idx" ON "BudgetAllocation"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetAllocation_budgetPlanId_allocationKey_key" ON "BudgetAllocation"("budgetPlanId", "allocationKey");

-- CreateIndex
CREATE INDEX "BudgetRevision_budgetPlanId_status_idx" ON "BudgetRevision"("budgetPlanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetRevision_budgetPlanId_revisionNumber_key" ON "BudgetRevision"("budgetPlanId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MiscIncomeItem_itemCode_key" ON "MiscIncomeItem"("itemCode");

-- CreateIndex
CREATE INDEX "MiscIncomeItem_category_idx" ON "MiscIncomeItem"("category");

-- CreateIndex
CREATE INDEX "MiscIncomeItem_status_idx" ON "MiscIncomeItem"("status");

-- CreateIndex
CREATE INDEX "MiscIncomeRate_itemId_academicYear_status_idx" ON "MiscIncomeRate"("itemId", "academicYear", "status");

-- CreateIndex
CREATE INDEX "MiscIncomeRate_academicYear_idx" ON "MiscIncomeRate"("academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "MiscIncomeReceipt_receiptNumber_key" ON "MiscIncomeReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_receiptDate_idx" ON "MiscIncomeReceipt"("receiptDate");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_academicYear_idx" ON "MiscIncomeReceipt"("academicYear");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_studentId_idx" ON "MiscIncomeReceipt"("studentId");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_paymentMethod_idx" ON "MiscIncomeReceipt"("paymentMethod");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_receivedAccount_idx" ON "MiscIncomeReceipt"("receivedAccount");

-- CreateIndex
CREATE INDEX "MiscIncomeReceipt_status_idx" ON "MiscIncomeReceipt"("status");

-- CreateIndex
CREATE INDEX "MiscIncomeReceiptLine_receiptId_idx" ON "MiscIncomeReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "MiscIncomeReceiptLine_itemId_idx" ON "MiscIncomeReceiptLine"("itemId");

-- CreateIndex
CREATE INDEX "MiscIncomeReceiptLine_rateId_idx" ON "MiscIncomeReceiptLine"("rateId");

-- CreateIndex
CREATE UNIQUE INDEX "CashBookDay_cashDate_key" ON "CashBookDay"("cashDate");

-- CreateIndex
CREATE INDEX "CashBookDay_academicYear_idx" ON "CashBookDay"("academicYear");

-- CreateIndex
CREATE INDEX "CashBookDay_status_idx" ON "CashBookDay"("status");

-- CreateIndex
CREATE INDEX "CashBookMovement_cashBookDayId_status_idx" ON "CashBookMovement"("cashBookDayId", "status");

-- CreateIndex
CREATE INDEX "CashBookMovement_movementDate_idx" ON "CashBookMovement"("movementDate");

-- CreateIndex
CREATE INDEX "CashBookMovement_movementType_idx" ON "CashBookMovement"("movementType");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryTitle_titleCode_key" ON "LibraryTitle"("titleCode");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryTitle_isbn_key" ON "LibraryTitle"("isbn");

-- CreateIndex
CREATE INDEX "LibraryTitle_title_idx" ON "LibraryTitle"("title");

-- CreateIndex
CREATE INDEX "LibraryTitle_authors_idx" ON "LibraryTitle"("authors");

-- CreateIndex
CREATE INDEX "LibraryTitle_publisherVendorId_idx" ON "LibraryTitle"("publisherVendorId");

-- CreateIndex
CREATE INDEX "LibraryTitle_status_language_idx" ON "LibraryTitle"("status", "language");

-- CreateIndex
CREATE INDEX "LibraryTitle_subject_category_idx" ON "LibraryTitle"("subject", "category");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCopy_accessionNumber_key" ON "LibraryCopy"("accessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCopy_barcodeValue_key" ON "LibraryCopy"("barcodeValue");

-- CreateIndex
CREATE INDEX "LibraryCopy_titleId_status_idx" ON "LibraryCopy"("titleId", "status");

-- CreateIndex
CREATE INDEX "LibraryCopy_condition_idx" ON "LibraryCopy"("condition");

-- CreateIndex
CREATE INDEX "LibraryCopy_shelfCode_idx" ON "LibraryCopy"("shelfCode");

-- CreateIndex
CREATE INDEX "LibraryCopy_vendorId_idx" ON "LibraryCopy"("vendorId");

-- CreateIndex
CREATE INDEX "LibraryCopy_expenseRecordId_idx" ON "LibraryCopy"("expenseRecordId");

-- CreateIndex
CREATE INDEX "LibraryCopy_acquisitionType_idx" ON "LibraryCopy"("acquisitionType");

-- CreateIndex
CREATE INDEX "LibraryCopyEvent_copyId_eventDate_idx" ON "LibraryCopyEvent"("copyId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryCopyEvent_eventType_idx" ON "LibraryCopyEvent"("eventType");

-- CreateIndex
CREATE INDEX "LibraryCopyEvent_recordedByUserId_idx" ON "LibraryCopyEvent"("recordedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryStockVerificationSession_sessionNumber_key" ON "LibraryStockVerificationSession"("sessionNumber");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationSession_academicYear_status_idx" ON "LibraryStockVerificationSession"("academicYear", "status");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationSession_verificationDate_idx" ON "LibraryStockVerificationSession"("verificationDate");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationSession_scopeType_idx" ON "LibraryStockVerificationSession"("scopeType");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryStockVerificationRecord_appliedCopyEventId_key" ON "LibraryStockVerificationRecord"("appliedCopyEventId");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationRecord_sessionId_observationStatus_idx" ON "LibraryStockVerificationRecord"("sessionId", "observationStatus");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationRecord_sessionId_resolutionStatus_idx" ON "LibraryStockVerificationRecord"("sessionId", "resolutionStatus");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationRecord_copyId_idx" ON "LibraryStockVerificationRecord"("copyId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryStockVerificationRecord_sessionId_copyId_key" ON "LibraryStockVerificationRecord"("sessionId", "copyId");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationScanEvent_sessionId_scannedAt_idx" ON "LibraryStockVerificationScanEvent"("sessionId", "scannedAt");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationScanEvent_recordId_idx" ON "LibraryStockVerificationScanEvent"("recordId");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationScanEvent_resultType_idx" ON "LibraryStockVerificationScanEvent"("resultType");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationEvent_sessionId_eventDate_idx" ON "LibraryStockVerificationEvent"("sessionId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryStockVerificationEvent_eventType_idx" ON "LibraryStockVerificationEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryMember_memberCode_key" ON "LibraryMember"("memberCode");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryMember_studentId_key" ON "LibraryMember"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryMember_staffMemberId_key" ON "LibraryMember"("staffMemberId");

-- CreateIndex
CREATE INDEX "LibraryMember_memberType_status_idx" ON "LibraryMember"("memberType", "status");

-- CreateIndex
CREATE INDEX "LibraryMember_joinedDate_idx" ON "LibraryMember"("joinedDate");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryPolicy_policyCode_key" ON "LibraryPolicy"("policyCode");

-- CreateIndex
CREATE INDEX "LibraryPolicy_memberType_status_priority_idx" ON "LibraryPolicy"("memberType", "status", "priority");

-- CreateIndex
CREATE INDEX "LibraryPolicy_className_status_idx" ON "LibraryPolicy"("className", "status");

-- CreateIndex
CREATE INDEX "LibraryPolicy_staffType_status_idx" ON "LibraryPolicy"("staffType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryLoan_loanNumber_key" ON "LibraryLoan"("loanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryLoan_activeCopyKey_key" ON "LibraryLoan"("activeCopyKey");

-- CreateIndex
CREATE INDEX "LibraryLoan_memberId_status_idx" ON "LibraryLoan"("memberId", "status");

-- CreateIndex
CREATE INDEX "LibraryLoan_copyId_status_idx" ON "LibraryLoan"("copyId", "status");

-- CreateIndex
CREATE INDEX "LibraryLoan_status_dueDate_idx" ON "LibraryLoan"("status", "dueDate");

-- CreateIndex
CREATE INDEX "LibraryLoan_issueDate_idx" ON "LibraryLoan"("issueDate");

-- CreateIndex
CREATE INDEX "LibraryLoan_returnedDate_idx" ON "LibraryLoan"("returnedDate");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryReservation_reservationNumber_key" ON "LibraryReservation"("reservationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryReservation_activeMemberTitleKey_key" ON "LibraryReservation"("activeMemberTitleKey");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryReservation_fulfilledLoanId_key" ON "LibraryReservation"("fulfilledLoanId");

-- CreateIndex
CREATE INDEX "LibraryReservation_titleId_status_requestedDate_createdAt_idx" ON "LibraryReservation"("titleId", "status", "requestedDate", "createdAt");

-- CreateIndex
CREATE INDEX "LibraryReservation_memberId_status_idx" ON "LibraryReservation"("memberId", "status");

-- CreateIndex
CREATE INDEX "LibraryReservation_status_expiresDate_idx" ON "LibraryReservation"("status", "expiresDate");

-- CreateIndex
CREATE INDEX "LibraryLoanEvent_loanId_eventDate_idx" ON "LibraryLoanEvent"("loanId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryLoanEvent_reservationId_eventDate_idx" ON "LibraryLoanEvent"("reservationId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryLoanEvent_memberId_eventDate_idx" ON "LibraryLoanEvent"("memberId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryLoanEvent_eventType_eventDate_idx" ON "LibraryLoanEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryIncident_incidentNumber_key" ON "LibraryIncident"("incidentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryIncident_activeCaseKey_key" ON "LibraryIncident"("activeCaseKey");

-- CreateIndex
CREATE INDEX "LibraryIncident_status_incidentType_idx" ON "LibraryIncident"("status", "incidentType");

-- CreateIndex
CREATE INDEX "LibraryIncident_loanId_status_idx" ON "LibraryIncident"("loanId", "status");

-- CreateIndex
CREATE INDEX "LibraryIncident_memberId_reportedDate_idx" ON "LibraryIncident"("memberId", "reportedDate");

-- CreateIndex
CREATE INDEX "LibraryIncident_copyId_status_idx" ON "LibraryIncident"("copyId", "status");

-- CreateIndex
CREATE INDEX "LibraryIncident_titleId_status_idx" ON "LibraryIncident"("titleId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryChargeRule_ruleCode_key" ON "LibraryChargeRule"("ruleCode");

-- CreateIndex
CREATE INDEX "LibraryChargeRule_memberType_status_priority_idx" ON "LibraryChargeRule"("memberType", "status", "priority");

-- CreateIndex
CREATE INDEX "LibraryChargeRule_className_status_idx" ON "LibraryChargeRule"("className", "status");

-- CreateIndex
CREATE INDEX "LibraryChargeRule_staffType_status_idx" ON "LibraryChargeRule"("staffType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCharge_chargeNumber_key" ON "LibraryCharge"("chargeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCharge_activeOverdueLoanKey_key" ON "LibraryCharge"("activeOverdueLoanKey");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCharge_miscIncomeReceiptId_key" ON "LibraryCharge"("miscIncomeReceiptId");

-- CreateIndex
CREATE INDEX "LibraryCharge_status_chargeType_idx" ON "LibraryCharge"("status", "chargeType");

-- CreateIndex
CREATE INDEX "LibraryCharge_memberId_status_idx" ON "LibraryCharge"("memberId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_loanId_status_idx" ON "LibraryCharge"("loanId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_incidentId_status_idx" ON "LibraryCharge"("incidentId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_studentId_status_idx" ON "LibraryCharge"("studentId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_staffMemberId_status_idx" ON "LibraryCharge"("staffMemberId", "status");

-- CreateIndex
CREATE INDEX "LibraryCharge_assessedDate_idx" ON "LibraryCharge"("assessedDate");

-- CreateIndex
CREATE INDEX "LibraryChargeEvent_chargeId_eventDate_idx" ON "LibraryChargeEvent"("chargeId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryChargeEvent_incidentId_eventDate_idx" ON "LibraryChargeEvent"("incidentId", "eventDate");

-- CreateIndex
CREATE INDEX "LibraryChargeEvent_eventType_eventDate_idx" ON "LibraryChargeEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "BookCatalogItem_itemCode_key" ON "BookCatalogItem"("itemCode");

-- CreateIndex
CREATE INDEX "BookCatalogItem_itemType_idx" ON "BookCatalogItem"("itemType");

-- CreateIndex
CREATE INDEX "BookCatalogItem_publisherVendorId_idx" ON "BookCatalogItem"("publisherVendorId");

-- CreateIndex
CREATE INDEX "BookCatalogItem_className_idx" ON "BookCatalogItem"("className");

-- CreateIndex
CREATE INDEX "BookCatalogItem_status_idx" ON "BookCatalogItem"("status");

-- CreateIndex
CREATE INDEX "BookCatalogRate_itemId_academicYear_status_idx" ON "BookCatalogRate"("itemId", "academicYear", "status");

-- CreateIndex
CREATE INDEX "BookCatalogRate_academicYear_idx" ON "BookCatalogRate"("academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "BookSaleReceipt_receiptNumber_key" ON "BookSaleReceipt"("receiptNumber");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_receiptDate_idx" ON "BookSaleReceipt"("receiptDate");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_academicYear_idx" ON "BookSaleReceipt"("academicYear");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_studentId_idx" ON "BookSaleReceipt"("studentId");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_paymentMethod_idx" ON "BookSaleReceipt"("paymentMethod");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_receivedAccount_idx" ON "BookSaleReceipt"("receivedAccount");

-- CreateIndex
CREATE INDEX "BookSaleReceipt_status_idx" ON "BookSaleReceipt"("status");

-- CreateIndex
CREATE INDEX "BookSaleReceiptLine_receiptId_idx" ON "BookSaleReceiptLine"("receiptId");

-- CreateIndex
CREATE INDEX "BookSaleReceiptLine_itemId_idx" ON "BookSaleReceiptLine"("itemId");

-- CreateIndex
CREATE INDEX "BookSaleReceiptLine_rateId_idx" ON "BookSaleReceiptLine"("rateId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCashSettlement_settlementDate_key" ON "BookCashSettlement"("settlementDate");

-- CreateIndex
CREATE UNIQUE INDEX "BookCashSettlement_cashBookMovementId_key" ON "BookCashSettlement"("cashBookMovementId");

-- CreateIndex
CREATE INDEX "BookCashSettlement_academicYear_idx" ON "BookCashSettlement"("academicYear");

-- CreateIndex
CREATE INDEX "BookCashSettlement_status_idx" ON "BookCashSettlement"("status");

-- CreateIndex
CREATE INDEX "PaymentAudit_paymentId_idx" ON "PaymentAudit"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentAudit_changedByUserId_idx" ON "PaymentAudit"("changedByUserId");

-- CreateIndex
CREATE INDEX "PaymentAudit_action_idx" ON "PaymentAudit"("action");

-- CreateIndex
CREATE INDEX "PaymentAudit_createdAt_idx" ON "PaymentAudit"("createdAt");

-- CreateIndex
CREATE INDEX "ImportBatch_type_idx" ON "ImportBatch"("type");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE INDEX "ImportBatch_importedAt_idx" ON "ImportBatch"("importedAt");

-- CreateIndex
CREATE INDEX "ImportBatch_importedByUserId_idx" ON "ImportBatch"("importedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableTeacher_shortName_key" ON "TimetableTeacher"("shortName");

-- CreateIndex
CREATE INDEX "TimetableTeacher_name_idx" ON "TimetableTeacher"("name");

-- CreateIndex
CREATE INDEX "TimetableTeacher_department_idx" ON "TimetableTeacher"("department");

-- CreateIndex
CREATE INDEX "TimetableTeacher_isActive_idx" ON "TimetableTeacher"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableSubject_shortName_key" ON "TimetableSubject"("shortName");

-- CreateIndex
CREATE INDEX "TimetableSubject_name_idx" ON "TimetableSubject"("name");

-- CreateIndex
CREATE INDEX "TimetableSubject_department_idx" ON "TimetableSubject"("department");

-- CreateIndex
CREATE INDEX "TimetableSubject_isActive_idx" ON "TimetableSubject"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkAssignment_assignmentNumber_key" ON "HomeworkAssignment"("assignmentNumber");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_academicYear_className_section_idx" ON "HomeworkAssignment"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_academicYear_subjectName_idx" ON "HomeworkAssignment"("academicYear", "subjectName");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_status_assignedDate_idx" ON "HomeworkAssignment"("status", "assignedDate");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_dueDate_idx" ON "HomeworkAssignment"("dueDate");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_createdByUserId_idx" ON "HomeworkAssignment"("createdByUserId");

-- CreateIndex
CREATE INDEX "HomeworkAssignment_timetableSubjectId_idx" ON "HomeworkAssignment"("timetableSubjectId");

-- CreateIndex
CREATE INDEX "HomeworkAssignmentEvent_assignmentId_eventDate_idx" ON "HomeworkAssignmentEvent"("assignmentId", "eventDate");

-- CreateIndex
CREATE INDEX "HomeworkAssignmentEvent_eventType_idx" ON "HomeworkAssignmentEvent"("eventType");

-- CreateIndex
CREATE INDEX "HomeworkAssignmentEvent_recordedByUserId_idx" ON "HomeworkAssignmentEvent"("recordedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamCycle_examCode_key" ON "ExamCycle"("examCode");

-- CreateIndex
CREATE INDEX "ExamCycle_academicYear_status_idx" ON "ExamCycle"("academicYear", "status");

-- CreateIndex
CREATE INDEX "ExamCycle_startDate_endDate_idx" ON "ExamCycle"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ExamAssessment_academicYear_className_section_idx" ON "ExamAssessment"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "ExamAssessment_timetableSubjectId_idx" ON "ExamAssessment"("timetableSubjectId");

-- CreateIndex
CREATE INDEX "ExamAssessment_entryStatus_idx" ON "ExamAssessment"("entryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ExamAssessment_examCycleId_className_section_subjectName_componentName_key" ON "ExamAssessment"("examCycleId", "className", "section", "subjectName", "componentName");

-- CreateIndex
CREATE INDEX "StudentMark_studentId_academicYear_idx" ON "StudentMark"("studentId", "academicYear");

-- CreateIndex
CREATE INDEX "StudentMark_entryStatus_idx" ON "StudentMark"("entryStatus");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMark_assessmentId_studentId_key" ON "StudentMark"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "StudentMarkEvent_assessmentId_eventDate_idx" ON "StudentMarkEvent"("assessmentId", "eventDate");

-- CreateIndex
CREATE INDEX "StudentMarkEvent_studentMarkId_idx" ON "StudentMarkEvent"("studentMarkId");

-- CreateIndex
CREATE INDEX "StudentMarkEvent_eventType_idx" ON "StudentMarkEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "GradingScheme_schemeCode_key" ON "GradingScheme"("schemeCode");

-- CreateIndex
CREATE INDEX "GradingScheme_academicYear_reportType_status_idx" ON "GradingScheme"("academicYear", "reportType", "status");

-- CreateIndex
CREATE INDEX "GradeBand_gradingSchemeId_minimumPercentage_idx" ON "GradeBand"("gradingSchemeId", "minimumPercentage");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBand_gradingSchemeId_gradeCode_key" ON "GradeBand"("gradingSchemeId", "gradeCode");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBand_gradingSchemeId_displayOrder_key" ON "GradeBand"("gradingSchemeId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardTemplate_templateCode_key" ON "ReportCardTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "ReportCardTemplate_reportType_status_idx" ON "ReportCardTemplate"("reportType", "status");

-- CreateIndex
CREATE INDEX "ReportCardTemplate_academicYear_className_idx" ON "ReportCardTemplate"("academicYear", "className");

-- CreateIndex
CREATE INDEX "ReportCardTemplate_gradingSchemeId_idx" ON "ReportCardTemplate"("gradingSchemeId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardBatch_batchNumber_key" ON "ReportCardBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "ReportCardBatch_academicYear_className_section_idx" ON "ReportCardBatch"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "ReportCardBatch_reportType_status_idx" ON "ReportCardBatch"("reportType", "status");

-- CreateIndex
CREATE INDEX "ReportCardBatch_templateId_idx" ON "ReportCardBatch"("templateId");

-- CreateIndex
CREATE INDEX "ReportCardBatchExamSource_examCycleId_idx" ON "ReportCardBatchExamSource"("examCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardBatchExamSource_batchId_examCycleId_key" ON "ReportCardBatchExamSource"("batchId", "examCycleId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardBatchExamSource_batchId_displayOrder_key" ON "ReportCardBatchExamSource"("batchId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StudentReportCard_reportCardNumber_key" ON "StudentReportCard"("reportCardNumber");

-- CreateIndex
CREATE INDEX "StudentReportCard_studentId_academicYear_idx" ON "StudentReportCard"("studentId", "academicYear");

-- CreateIndex
CREATE INDEX "StudentReportCard_batchId_status_idx" ON "StudentReportCard"("batchId", "status");

-- CreateIndex
CREATE INDEX "StudentReportCard_progressionDecisionId_idx" ON "StudentReportCard"("progressionDecisionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentReportCard_batchId_studentId_key" ON "StudentReportCard"("batchId", "studentId");

-- CreateIndex
CREATE INDEX "StudentReportCardVersion_reportCardId_issuedAt_idx" ON "StudentReportCardVersion"("reportCardId", "issuedAt");

-- CreateIndex
CREATE INDEX "StudentReportCardVersion_supersedesVersionId_idx" ON "StudentReportCardVersion"("supersedesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentReportCardVersion_reportCardId_versionNumber_key" ON "StudentReportCardVersion"("reportCardId", "versionNumber");

-- CreateIndex
CREATE INDEX "StudentReportCardEvent_reportCardId_eventDate_idx" ON "StudentReportCardEvent"("reportCardId", "eventDate");

-- CreateIndex
CREATE INDEX "StudentReportCardEvent_versionId_idx" ON "StudentReportCardEvent"("versionId");

-- CreateIndex
CREATE INDEX "StudentReportCardEvent_eventType_idx" ON "StudentReportCardEvent"("eventType");

-- CreateIndex
CREATE INDEX "TimetableClassSection_academicYear_idx" ON "TimetableClassSection"("academicYear");

-- CreateIndex
CREATE INDEX "TimetableClassSection_groupName_idx" ON "TimetableClassSection"("groupName");

-- CreateIndex
CREATE INDEX "TimetableClassSection_isActive_idx" ON "TimetableClassSection"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableClassSection_academicYear_className_section_key" ON "TimetableClassSection"("academicYear", "className", "section");

-- CreateIndex
CREATE INDEX "TimetablePeriodTemplate_academicYear_groupName_dayOfWeek_idx" ON "TimetablePeriodTemplate"("academicYear", "groupName", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePeriodTemplate_academicYear_groupName_dayOfWeek_sortOrder_key" ON "TimetablePeriodTemplate"("academicYear", "groupName", "dayOfWeek", "sortOrder");

-- CreateIndex
CREATE INDEX "TimetableAssignment_academicYear_idx" ON "TimetableAssignment"("academicYear");

-- CreateIndex
CREATE INDEX "TimetableAssignment_classSectionId_idx" ON "TimetableAssignment"("classSectionId");

-- CreateIndex
CREATE INDEX "TimetableAssignment_subjectId_idx" ON "TimetableAssignment"("subjectId");

-- CreateIndex
CREATE INDEX "TimetableAssignment_teacherId_idx" ON "TimetableAssignment"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableAssignment_academicYear_classSectionId_subjectId_teacherId_key" ON "TimetableAssignment"("academicYear", "classSectionId", "subjectId", "teacherId");

-- CreateIndex
CREATE INDEX "TimetableTeacherUnavailability_teacherId_idx" ON "TimetableTeacherUnavailability"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableTeacherUnavailability_teacherId_dayOfWeek_periodNumber_key" ON "TimetableTeacherUnavailability"("teacherId", "dayOfWeek", "periodNumber");

-- CreateIndex
CREATE INDEX "TimetableFixedPeriod_academicYear_idx" ON "TimetableFixedPeriod"("academicYear");

-- CreateIndex
CREATE INDEX "TimetableFixedPeriod_classSectionId_idx" ON "TimetableFixedPeriod"("classSectionId");

-- CreateIndex
CREATE INDEX "TimetableFixedPeriod_teacherId_idx" ON "TimetableFixedPeriod"("teacherId");

-- CreateIndex
CREATE INDEX "TimetableFixedPeriod_subjectId_idx" ON "TimetableFixedPeriod"("subjectId");

-- CreateIndex
CREATE INDEX "TimetableFixedPeriod_dayOfWeek_periodNumber_idx" ON "TimetableFixedPeriod"("dayOfWeek", "periodNumber");

-- CreateIndex
CREATE INDEX "TimetableDraft_academicYear_idx" ON "TimetableDraft"("academicYear");

-- CreateIndex
CREATE INDEX "TimetableDraft_status_idx" ON "TimetableDraft"("status");

-- CreateIndex
CREATE INDEX "TimetableDraft_createdByUserId_idx" ON "TimetableDraft"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableDraft_academicYear_name_key" ON "TimetableDraft"("academicYear", "name");

-- CreateIndex
CREATE INDEX "TimetableEntry_draftId_idx" ON "TimetableEntry"("draftId");

-- CreateIndex
CREATE INDEX "TimetableEntry_academicYear_idx" ON "TimetableEntry"("academicYear");

-- CreateIndex
CREATE INDEX "TimetableEntry_teacherId_dayOfWeek_periodNumber_idx" ON "TimetableEntry"("teacherId", "dayOfWeek", "periodNumber");

-- CreateIndex
CREATE INDEX "TimetableEntry_classSectionId_idx" ON "TimetableEntry"("classSectionId");

-- CreateIndex
CREATE INDEX "TimetableEntry_assignmentId_idx" ON "TimetableEntry"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetableEntry_draftId_classSectionId_dayOfWeek_periodNumber_key" ON "TimetableEntry"("draftId", "classSectionId", "dayOfWeek", "periodNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAnalyticsReviewCycle_cycleCode_key" ON "TeacherAnalyticsReviewCycle"("cycleCode");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsReviewCycle_academicYear_status_idx" ON "TeacherAnalyticsReviewCycle"("academicYear", "status");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsReviewCycle_periodStart_periodEnd_idx" ON "TeacherAnalyticsReviewCycle"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsSnapshot_staffMemberId_academicYear_idx" ON "TeacherAnalyticsSnapshot"("staffMemberId", "academicYear");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsSnapshot_snapshotHash_idx" ON "TeacherAnalyticsSnapshot"("snapshotHash");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAnalyticsSnapshot_reviewCycleId_staffMemberId_key" ON "TeacherAnalyticsSnapshot"("reviewCycleId", "staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAnalyticsReview_snapshotId_key" ON "TeacherAnalyticsReview"("snapshotId");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsReview_status_idx" ON "TeacherAnalyticsReview"("status");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsReview_nextReviewDate_idx" ON "TeacherAnalyticsReview"("nextReviewDate");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsEvent_reviewCycleId_eventDate_idx" ON "TeacherAnalyticsEvent"("reviewCycleId", "eventDate");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsEvent_snapshotId_idx" ON "TeacherAnalyticsEvent"("snapshotId");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsEvent_reviewId_idx" ON "TeacherAnalyticsEvent"("reviewId");

-- CreateIndex
CREATE INDEX "TeacherAnalyticsEvent_eventType_idx" ON "TeacherAnalyticsEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateNumberSeries_seriesCode_key" ON "CertificateNumberSeries"("seriesCode");

-- CreateIndex
CREATE INDEX "CertificateNumberSeries_certificateType_academicYear_status_idx" ON "CertificateNumberSeries"("certificateType", "academicYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CertificateTemplate_templateCode_key" ON "CertificateTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "CertificateTemplate_certificateType_academicYear_status_idx" ON "CertificateTemplate"("certificateType", "academicYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCertificateRequest_requestNumber_key" ON "StudentCertificateRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "StudentCertificateRequest_studentId_createdAt_idx" ON "StudentCertificateRequest"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentCertificateRequest_academicYear_certificateType_status_idx" ON "StudentCertificateRequest"("academicYear", "certificateType", "status");

-- CreateIndex
CREATE INDEX "StudentCertificateRequest_applicantGuardianId_createdAt_idx" ON "StudentCertificateRequest"("applicantGuardianId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCertificate_certificateNumber_key" ON "StudentCertificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "StudentCertificate_studentId_createdAt_idx" ON "StudentCertificate"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentCertificate_requestId_idx" ON "StudentCertificate"("requestId");

-- CreateIndex
CREATE INDEX "StudentCertificate_academicYear_certificateType_status_idx" ON "StudentCertificate"("academicYear", "certificateType", "status");

-- CreateIndex
CREATE INDEX "StudentCertificate_templateId_idx" ON "StudentCertificate"("templateId");

-- CreateIndex
CREATE INDEX "StudentCertificateVersion_certificateNumber_idx" ON "StudentCertificateVersion"("certificateNumber");

-- CreateIndex
CREATE INDEX "StudentCertificateVersion_supersedesVersionId_idx" ON "StudentCertificateVersion"("supersedesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCertificateVersion_certificateId_versionNumber_key" ON "StudentCertificateVersion"("certificateId", "versionNumber");

-- CreateIndex
CREATE INDEX "StudentCertificateEvent_requestId_eventDate_idx" ON "StudentCertificateEvent"("requestId", "eventDate");

-- CreateIndex
CREATE INDEX "StudentCertificateEvent_certificateId_eventDate_idx" ON "StudentCertificateEvent"("certificateId", "eventDate");

-- CreateIndex
CREATE INDEX "StudentCertificateEvent_versionId_idx" ON "StudentCertificateEvent"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageTemplate_templateCode_key" ON "ClassXPackageTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "ClassXPackageTemplate_academicYear_status_idx" ON "ClassXPackageTemplate"("academicYear", "status");

-- CreateIndex
CREATE INDEX "ClassXPackageTemplate_packageType_status_idx" ON "ClassXPackageTemplate"("packageType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXDocumentPackage_packageNumber_key" ON "ClassXDocumentPackage"("packageNumber");

-- CreateIndex
CREATE INDEX "ClassXDocumentPackage_studentId_createdAt_idx" ON "ClassXDocumentPackage"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassXDocumentPackage_academicYear_status_idx" ON "ClassXDocumentPackage"("academicYear", "status");

-- CreateIndex
CREATE INDEX "ClassXDocumentPackage_requestSource_createdAt_idx" ON "ClassXDocumentPackage"("requestSource", "createdAt");

-- CreateIndex
CREATE INDEX "ClassXDocumentPackage_applicantGuardianId_createdAt_idx" ON "ClassXDocumentPackage"("applicantGuardianId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassXPackageDocumentItem_packageId_status_idx" ON "ClassXPackageDocumentItem"("packageId", "status");

-- CreateIndex
CREATE INDEX "ClassXPackageDocumentItem_itemType_status_idx" ON "ClassXPackageDocumentItem"("itemType", "status");

-- CreateIndex
CREATE INDEX "ClassXPackageDocumentItem_linkedStudentCertificateId_idx" ON "ClassXPackageDocumentItem"("linkedStudentCertificateId");

-- CreateIndex
CREATE INDEX "ClassXPackageDocumentItem_linkedStudentCertificateVersionId_idx" ON "ClassXPackageDocumentItem"("linkedStudentCertificateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageDocumentItem_packageId_itemKey_key" ON "ClassXPackageDocumentItem"("packageId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageChargeRule_ruleCode_key" ON "ClassXPackageChargeRule"("ruleCode");

-- CreateIndex
CREATE INDEX "ClassXPackageChargeRule_academicYear_packageType_status_idx" ON "ClassXPackageChargeRule"("academicYear", "packageType", "status");

-- CreateIndex
CREATE INDEX "ClassXPackageChargeRule_status_effectiveFrom_effectiveTo_idx" ON "ClassXPackageChargeRule"("status", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageCharge_packageId_key" ON "ClassXPackageCharge"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageCharge_chargeCode_key" ON "ClassXPackageCharge"("chargeCode");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageCharge_linkedMiscIncomeReceiptId_key" ON "ClassXPackageCharge"("linkedMiscIncomeReceiptId");

-- CreateIndex
CREATE INDEX "ClassXPackageCharge_status_createdAt_idx" ON "ClassXPackageCharge"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClassXPackageCharge_chargeRuleId_idx" ON "ClassXPackageCharge"("chargeRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassXPackageHandover_handoverNumber_key" ON "ClassXPackageHandover"("handoverNumber");

-- CreateIndex
CREATE INDEX "ClassXPackageHandover_packageId_handoverDate_idx" ON "ClassXPackageHandover"("packageId", "handoverDate");

-- CreateIndex
CREATE INDEX "ClassXPackageEvent_packageId_eventDate_idx" ON "ClassXPackageEvent"("packageId", "eventDate");

-- CreateIndex
CREATE INDEX "ClassXPackageEvent_documentItemId_idx" ON "ClassXPackageEvent"("documentItemId");

-- CreateIndex
CREATE INDEX "ClassXPackageEvent_chargeId_idx" ON "ClassXPackageEvent"("chargeId");

-- CreateIndex
CREATE INDEX "ClassXPackageEvent_handoverId_idx" ON "ClassXPackageEvent"("handoverId");

-- CreateIndex
CREATE INDEX "ClassXPackageEvent_eventType_eventDate_idx" ON "ClassXPackageEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCardNumberSeries_seriesCode_key" ON "IdentityCardNumberSeries"("seriesCode");

-- CreateIndex
CREATE INDEX "IdentityCardNumberSeries_cardType_academicYear_status_idx" ON "IdentityCardNumberSeries"("cardType", "academicYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCardTemplate_templateCode_key" ON "IdentityCardTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "IdentityCardTemplate_cardType_academicYear_status_idx" ON "IdentityCardTemplate"("cardType", "academicYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCardBatch_batchNumber_key" ON "IdentityCardBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "IdentityCardBatch_cardType_academicYear_status_idx" ON "IdentityCardBatch"("cardType", "academicYear", "status");

-- CreateIndex
CREATE INDEX "IdentityCardBatch_templateId_idx" ON "IdentityCardBatch"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCard_cardNumber_key" ON "IdentityCard"("cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCard_replacesCardId_key" ON "IdentityCard"("replacesCardId");

-- CreateIndex
CREATE INDEX "IdentityCard_cardType_academicYear_status_idx" ON "IdentityCard"("cardType", "academicYear", "status");

-- CreateIndex
CREATE INDEX "IdentityCard_studentId_academicYear_status_idx" ON "IdentityCard"("studentId", "academicYear", "status");

-- CreateIndex
CREATE INDEX "IdentityCard_staffMemberId_academicYear_status_idx" ON "IdentityCard"("staffMemberId", "academicYear", "status");

-- CreateIndex
CREATE INDEX "IdentityCard_batchId_idx" ON "IdentityCard"("batchId");

-- CreateIndex
CREATE INDEX "IdentityCard_templateId_idx" ON "IdentityCard"("templateId");

-- CreateIndex
CREATE INDEX "IdentityCard_numberSeriesId_idx" ON "IdentityCard"("numberSeriesId");

-- CreateIndex
CREATE INDEX "IdentityCardVersion_cardNumber_idx" ON "IdentityCardVersion"("cardNumber");

-- CreateIndex
CREATE INDEX "IdentityCardVersion_supersedesVersionId_idx" ON "IdentityCardVersion"("supersedesVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityCardVersion_identityCardId_versionNumber_key" ON "IdentityCardVersion"("identityCardId", "versionNumber");

-- CreateIndex
CREATE INDEX "IdentityCardEvent_batchId_eventDate_idx" ON "IdentityCardEvent"("batchId", "eventDate");

-- CreateIndex
CREATE INDEX "IdentityCardEvent_identityCardId_eventDate_idx" ON "IdentityCardEvent"("identityCardId", "eventDate");

-- CreateIndex
CREATE INDEX "IdentityCardEvent_versionId_idx" ON "IdentityCardEvent"("versionId");

-- CreateIndex
CREATE INDEX "IdentityCardEvent_eventType_eventDate_idx" ON "IdentityCardEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_templateCode_key" ON "NotificationTemplate"("templateCode");

-- CreateIndex
CREATE INDEX "NotificationTemplate_status_category_idx" ON "NotificationTemplate"("status", "category");

-- CreateIndex
CREATE INDEX "NotificationTemplate_createdAt_idx" ON "NotificationTemplate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationCampaign_campaignNumber_key" ON "NotificationCampaign"("campaignNumber");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationCampaign_correctionOfCampaignId_key" ON "NotificationCampaign"("correctionOfCampaignId");

-- CreateIndex
CREATE INDEX "NotificationCampaign_status_scheduledFor_idx" ON "NotificationCampaign"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "NotificationCampaign_category_priority_idx" ON "NotificationCampaign"("category", "priority");

-- CreateIndex
CREATE INDEX "NotificationCampaign_audienceType_idx" ON "NotificationCampaign"("audienceType");

-- CreateIndex
CREATE INDEX "NotificationCampaign_createdByUserId_createdAt_idx" ON "NotificationCampaign"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationCampaign_expiresAt_idx" ON "NotificationCampaign"("expiresAt");

-- CreateIndex
CREATE INDEX "NotificationCampaign_correctionOfCampaignId_idx" ON "NotificationCampaign"("correctionOfCampaignId");

-- CreateIndex
CREATE INDEX "NotificationRecipient_userId_deliveryStatus_availableAt_idx" ON "NotificationRecipient"("userId", "deliveryStatus", "availableAt");

-- CreateIndex
CREATE INDEX "NotificationRecipient_campaignId_readAt_idx" ON "NotificationRecipient"("campaignId", "readAt");

-- CreateIndex
CREATE INDEX "NotificationRecipient_campaignId_acknowledgedAt_idx" ON "NotificationRecipient"("campaignId", "acknowledgedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRecipient_campaignId_userId_key" ON "NotificationRecipient"("campaignId", "userId");

-- CreateIndex
CREATE INDEX "NotificationSkippedRecipient_campaignId_reasonCode_idx" ON "NotificationSkippedRecipient"("campaignId", "reasonCode");

-- CreateIndex
CREATE INDEX "NotificationEvent_templateId_eventDate_idx" ON "NotificationEvent"("templateId", "eventDate");

-- CreateIndex
CREATE INDEX "NotificationEvent_campaignId_eventDate_idx" ON "NotificationEvent"("campaignId", "eventDate");

-- CreateIndex
CREATE INDEX "NotificationEvent_recipientId_eventDate_idx" ON "NotificationEvent"("recipientId", "eventDate");

-- CreateIndex
CREATE INDEX "NotificationEvent_eventType_eventDate_idx" ON "NotificationEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppIntegrationProfile_profileCode_key" ON "WhatsAppIntegrationProfile"("profileCode");

-- CreateIndex
CREATE INDEX "WhatsAppIntegrationProfile_mode_status_idx" ON "WhatsAppIntegrationProfile"("mode", "status");

-- CreateIndex
CREATE INDEX "WhatsAppIntegrationProfile_liveSendingEnabled_idx" ON "WhatsAppIntegrationProfile"("liveSendingEnabled");

-- CreateIndex
CREATE INDEX "WhatsAppConsent_subjectType_guardianId_status_idx" ON "WhatsAppConsent"("subjectType", "guardianId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppConsent_subjectType_staffMemberId_status_idx" ON "WhatsAppConsent"("subjectType", "staffMemberId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppConsent_phoneHash_status_idx" ON "WhatsAppConsent"("phoneHash", "status");

-- CreateIndex
CREATE INDEX "WhatsAppConsentEvent_consentId_eventDate_idx" ON "WhatsAppConsentEvent"("consentId", "eventDate");

-- CreateIndex
CREATE INDEX "WhatsAppConsentEvent_eventType_eventDate_idx" ON "WhatsAppConsentEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplateMapping_mappingCode_key" ON "WhatsAppTemplateMapping"("mappingCode");

-- CreateIndex
CREATE INDEX "WhatsAppTemplateMapping_integrationProfileId_status_idx" ON "WhatsAppTemplateMapping"("integrationProfileId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppTemplateMapping_notificationCategory_status_idx" ON "WhatsAppTemplateMapping"("notificationCategory", "status");

-- CreateIndex
CREATE INDEX "WhatsAppTemplateMapping_providerStatus_idx" ON "WhatsAppTemplateMapping"("providerStatus");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppOutboundBatch_batchNumber_key" ON "WhatsAppOutboundBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "WhatsAppOutboundBatch_status_scheduledFor_idx" ON "WhatsAppOutboundBatch"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "WhatsAppOutboundBatch_integrationProfileId_createdAt_idx" ON "WhatsAppOutboundBatch"("integrationProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppOutboundBatch_notificationCampaignId_idx" ON "WhatsAppOutboundBatch"("notificationCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDelivery_requestFingerprint_key" ON "WhatsAppDelivery"("requestFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDelivery_providerMessageId_key" ON "WhatsAppDelivery"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppDelivery_batchId_status_idx" ON "WhatsAppDelivery"("batchId", "status");

-- CreateIndex
CREATE INDEX "WhatsAppDelivery_status_nextAttemptAt_idx" ON "WhatsAppDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WhatsAppDelivery_phoneHash_idx" ON "WhatsAppDelivery"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDelivery_batchId_subjectType_subjectReferenceId_key" ON "WhatsAppDelivery"("batchId", "subjectType", "subjectReferenceId");

-- CreateIndex
CREATE INDEX "WhatsAppDeliveryAttempt_providerMessageId_idx" ON "WhatsAppDeliveryAttempt"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppDeliveryAttempt_resultStatus_retryable_idx" ON "WhatsAppDeliveryAttempt"("resultStatus", "retryable");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppDeliveryAttempt_deliveryId_attemptNumber_key" ON "WhatsAppDeliveryAttempt"("deliveryId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppWebhookEvent_eventKey_key" ON "WhatsAppWebhookEvent"("eventKey");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_providerMessageId_idx" ON "WhatsAppWebhookEvent"("providerMessageId");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_integrationProfileId_receivedAt_idx" ON "WhatsAppWebhookEvent"("integrationProfileId", "receivedAt");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_deliveryId_receivedAt_idx" ON "WhatsAppWebhookEvent"("deliveryId", "receivedAt");

-- CreateIndex
CREATE INDEX "WhatsAppWebhookEvent_processingStatus_receivedAt_idx" ON "WhatsAppWebhookEvent"("processingStatus", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppOperationalEvent_eventKey_key" ON "WhatsAppOperationalEvent"("eventKey");

-- CreateIndex
CREATE INDEX "WhatsAppOperationalEvent_eventType_createdAt_idx" ON "WhatsAppOperationalEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppOperationalEvent_integrationProfileId_createdAt_idx" ON "WhatsAppOperationalEvent"("integrationProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppOperationalEvent_batchId_createdAt_idx" ON "WhatsAppOperationalEvent"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppRateReference_market_templateCategory_status_idx" ON "WhatsAppRateReference"("market", "templateCategory", "status");

-- CreateIndex
CREATE INDEX "WhatsAppRateReference_effectiveDate_idx" ON "WhatsAppRateReference"("effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppRateReference_rateVersion_market_templateCategory_currency_key" ON "WhatsAppRateReference"("rateVersion", "market", "templateCategory", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailIntegrationProfile_profileCode_key" ON "SmsEmailIntegrationProfile"("profileCode");

-- CreateIndex
CREATE INDEX "SmsEmailIntegrationProfile_channel_mode_status_idx" ON "SmsEmailIntegrationProfile"("channel", "mode", "status");

-- CreateIndex
CREATE INDEX "SmsEmailIntegrationProfile_channel_liveSendingEnabled_idx" ON "SmsEmailIntegrationProfile"("channel", "liveSendingEnabled");

-- CreateIndex
CREATE INDEX "SmsEmailConsent_channel_subjectType_guardianId_status_idx" ON "SmsEmailConsent"("channel", "subjectType", "guardianId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailConsent_channel_subjectType_staffMemberId_status_idx" ON "SmsEmailConsent"("channel", "subjectType", "staffMemberId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailConsent_channel_contactHash_status_idx" ON "SmsEmailConsent"("channel", "contactHash", "status");

-- CreateIndex
CREATE INDEX "SmsEmailConsentEvent_consentId_eventDate_idx" ON "SmsEmailConsentEvent"("consentId", "eventDate");

-- CreateIndex
CREATE INDEX "SmsEmailConsentEvent_eventType_eventDate_idx" ON "SmsEmailConsentEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailTemplateMapping_mappingCode_key" ON "SmsEmailTemplateMapping"("mappingCode");

-- CreateIndex
CREATE INDEX "SmsEmailTemplateMapping_integrationProfileId_status_idx" ON "SmsEmailTemplateMapping"("integrationProfileId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailTemplateMapping_channel_notificationCategory_status_idx" ON "SmsEmailTemplateMapping"("channel", "notificationCategory", "status");

-- CreateIndex
CREATE INDEX "SmsEmailTemplateMapping_providerStatus_idx" ON "SmsEmailTemplateMapping"("providerStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailOutboundBatch_batchNumber_key" ON "SmsEmailOutboundBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "SmsEmailOutboundBatch_channel_status_scheduledFor_idx" ON "SmsEmailOutboundBatch"("channel", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SmsEmailOutboundBatch_integrationProfileId_createdAt_idx" ON "SmsEmailOutboundBatch"("integrationProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsEmailOutboundBatch_notificationCampaignId_idx" ON "SmsEmailOutboundBatch"("notificationCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailDelivery_requestFingerprint_key" ON "SmsEmailDelivery"("requestFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailDelivery_providerMessageId_key" ON "SmsEmailDelivery"("providerMessageId");

-- CreateIndex
CREATE INDEX "SmsEmailDelivery_batchId_status_idx" ON "SmsEmailDelivery"("batchId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailDelivery_channel_status_nextRetryAt_idx" ON "SmsEmailDelivery"("channel", "status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "SmsEmailDelivery_channel_contactHash_idx" ON "SmsEmailDelivery"("channel", "contactHash");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailDelivery_batchId_subjectType_guardianId_staffMemberId_contactHash_key" ON "SmsEmailDelivery"("batchId", "subjectType", "guardianId", "staffMemberId", "contactHash");

-- CreateIndex
CREATE INDEX "SmsEmailDeliveryAttempt_providerMessageId_idx" ON "SmsEmailDeliveryAttempt"("providerMessageId");

-- CreateIndex
CREATE INDEX "SmsEmailDeliveryAttempt_result_idx" ON "SmsEmailDeliveryAttempt"("result");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailDeliveryAttempt_deliveryId_attemptNumber_key" ON "SmsEmailDeliveryAttempt"("deliveryId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailWebhookEvent_providerEventKey_key" ON "SmsEmailWebhookEvent"("providerEventKey");

-- CreateIndex
CREATE INDEX "SmsEmailWebhookEvent_integrationProfileId_receivedAt_idx" ON "SmsEmailWebhookEvent"("integrationProfileId", "receivedAt");

-- CreateIndex
CREATE INDEX "SmsEmailWebhookEvent_providerMessageId_idx" ON "SmsEmailWebhookEvent"("providerMessageId");

-- CreateIndex
CREATE INDEX "SmsEmailWebhookEvent_deliveryId_receivedAt_idx" ON "SmsEmailWebhookEvent"("deliveryId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailOperationalEvent_eventKey_key" ON "SmsEmailOperationalEvent"("eventKey");

-- CreateIndex
CREATE INDEX "SmsEmailOperationalEvent_eventType_createdAt_idx" ON "SmsEmailOperationalEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "SmsEmailOperationalEvent_integrationProfileId_createdAt_idx" ON "SmsEmailOperationalEvent"("integrationProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsEmailOperationalEvent_batchId_createdAt_idx" ON "SmsEmailOperationalEvent"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "SmsEmailSuppression_channel_contactHash_status_idx" ON "SmsEmailSuppression"("channel", "contactHash", "status");

-- CreateIndex
CREATE INDEX "SmsEmailSuppression_subjectType_guardianId_status_idx" ON "SmsEmailSuppression"("subjectType", "guardianId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailSuppression_subjectType_staffMemberId_status_idx" ON "SmsEmailSuppression"("subjectType", "staffMemberId", "status");

-- CreateIndex
CREATE INDEX "SmsEmailCostRate_channel_status_effectiveFrom_idx" ON "SmsEmailCostRate"("channel", "status", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "SmsEmailCostRate_channel_providerKind_market_messageCategory_encodingType_currency_rateVersion_key" ON "SmsEmailCostRate"("channel", "providerKind", "market", "messageCategory", "encodingType", "currency", "rateVersion");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantProfile_profileCode_key" ON "AiAssistantProfile"("profileCode");

-- CreateIndex
CREATE INDEX "AiAssistantProfile_providerKind_status_idx" ON "AiAssistantProfile"("providerKind", "status");

-- CreateIndex
CREATE INDEX "AiAssistantProfile_liveUseEnabled_idx" ON "AiAssistantProfile"("liveUseEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantSourcePolicy_policyCode_key" ON "AiAssistantSourcePolicy"("policyCode");

-- CreateIndex
CREATE INDEX "AiAssistantSourcePolicy_enabled_sourceType_idx" ON "AiAssistantSourcePolicy"("enabled", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantSourcePolicy_sourceType_sourceKey_key" ON "AiAssistantSourcePolicy"("sourceType", "sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantQueryAudit_requestId_key" ON "AiAssistantQueryAudit"("requestId");

-- CreateIndex
CREATE INDEX "AiAssistantQueryAudit_userId_createdAt_idx" ON "AiAssistantQueryAudit"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantQueryAudit_safetyDecision_createdAt_idx" ON "AiAssistantQueryAudit"("safetyDecision", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantQueryAudit_assistantProfileId_createdAt_idx" ON "AiAssistantQueryAudit"("assistantProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantSafetyEvent_queryAuditId_createdAt_idx" ON "AiAssistantSafetyEvent"("queryAuditId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAssistantSafetyEvent_eventType_createdAt_idx" ON "AiAssistantSafetyEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantEvaluationCase_caseCode_key" ON "AiAssistantEvaluationCase"("caseCode");

-- CreateIndex
CREATE INDEX "AiAssistantEvaluationCase_category_status_idx" ON "AiAssistantEvaluationCase"("category", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiAssistantEvaluationRun_runNumber_key" ON "AiAssistantEvaluationRun"("runNumber");

-- CreateIndex
CREATE INDEX "AiAssistantEvaluationRun_profileId_createdAt_idx" ON "AiAssistantEvaluationRun"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrProfile_profileCode_key" ON "FeeRegisterOcrProfile"("profileCode");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrProfile_providerKind_status_idx" ON "FeeRegisterOcrProfile"("providerKind", "status");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrProfile_paymentPostingEnabled_idx" ON "FeeRegisterOcrProfile"("paymentPostingEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrBatch_batchNumber_key" ON "FeeRegisterOcrBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrBatch_academicYear_status_idx" ON "FeeRegisterOcrBatch"("academicYear", "status");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrBatch_profileId_createdAt_idx" ON "FeeRegisterOcrBatch"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrPage_sourceSha256_idx" ON "FeeRegisterOcrPage"("sourceSha256");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrPage_batchId_status_idx" ON "FeeRegisterOcrPage"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrPage_batchId_pageNumber_key" ON "FeeRegisterOcrPage"("batchId", "pageNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrRow_postedPaymentId_key" ON "FeeRegisterOcrRow"("postedPaymentId");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrRow_matchedStudentId_paymentDate_amountMinor_idx" ON "FeeRegisterOcrRow"("matchedStudentId", "paymentDate", "amountMinor");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrRow_status_idx" ON "FeeRegisterOcrRow"("status");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrRow_handwrittenReceiptReference_idx" ON "FeeRegisterOcrRow"("handwrittenReceiptReference");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrRow_pageId_rowNumber_key" ON "FeeRegisterOcrRow"("pageId", "rowNumber");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrRowRevision_rowId_createdAt_idx" ON "FeeRegisterOcrRowRevision"("rowId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrRowRevision_rowId_revisionNumber_key" ON "FeeRegisterOcrRowRevision"("rowId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FeeRegisterOcrPostingRun_runNumber_key" ON "FeeRegisterOcrPostingRun"("runNumber");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrPostingRun_batchId_createdAt_idx" ON "FeeRegisterOcrPostingRun"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrPostingRun_status_idx" ON "FeeRegisterOcrPostingRun"("status");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrEvent_batchId_createdAt_idx" ON "FeeRegisterOcrEvent"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrEvent_rowId_createdAt_idx" ON "FeeRegisterOcrEvent"("rowId", "createdAt");

-- CreateIndex
CREATE INDEX "FeeRegisterOcrEvent_eventType_createdAt_idx" ON "FeeRegisterOcrEvent"("eventType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupProfile_profileCode_key" ON "CloudBackupProfile"("profileCode");

-- CreateIndex
CREATE INDEX "CloudBackupProfile_providerKind_status_idx" ON "CloudBackupProfile"("providerKind", "status");

-- CreateIndex
CREATE INDEX "CloudBackupProfile_status_liveUseEnabled_idx" ON "CloudBackupProfile"("status", "liveUseEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupSchedule_scheduleCode_key" ON "CloudBackupSchedule"("scheduleCode");

-- CreateIndex
CREATE INDEX "CloudBackupSchedule_enabled_nextRunAt_idx" ON "CloudBackupSchedule"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "CloudBackupSchedule_profileId_enabled_idx" ON "CloudBackupSchedule"("profileId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupRetentionPolicy_policyCode_key" ON "CloudBackupRetentionPolicy"("policyCode");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupRetentionPolicy_profileId_key" ON "CloudBackupRetentionPolicy"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupRun_runNumber_key" ON "CloudBackupRun"("runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupRun_idempotencyKey_key" ON "CloudBackupRun"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CloudBackupRun_profileId_status_createdAt_idx" ON "CloudBackupRun"("profileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CloudBackupRun_scheduleId_scheduledDueAt_idx" ON "CloudBackupRun"("scheduleId", "scheduledDueAt");

-- CreateIndex
CREATE INDEX "CloudBackupRun_status_nextRetryAt_idx" ON "CloudBackupRun"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "CloudBackupArtifact_status_verifiedAt_idx" ON "CloudBackupArtifact"("status", "verifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupArtifact_runId_artifactType_key" ON "CloudBackupArtifact"("runId", "artifactType");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupArtifact_runId_objectKeySafe_key" ON "CloudBackupArtifact"("runId", "objectKeySafe");

-- CreateIndex
CREATE INDEX "CloudBackupVerification_runId_checkedAt_idx" ON "CloudBackupVerification"("runId", "checkedAt");

-- CreateIndex
CREATE INDEX "CloudBackupVerification_artifactId_checkedAt_idx" ON "CloudBackupVerification"("artifactId", "checkedAt");

-- CreateIndex
CREATE INDEX "CloudBackupVerification_status_verificationType_idx" ON "CloudBackupVerification"("status", "verificationType");

-- CreateIndex
CREATE UNIQUE INDEX "CloudBackupRestoreRehearsal_rehearsalNumber_key" ON "CloudBackupRestoreRehearsal"("rehearsalNumber");

-- CreateIndex
CREATE INDEX "CloudBackupRestoreRehearsal_status_createdAt_idx" ON "CloudBackupRestoreRehearsal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CloudBackupRestoreRehearsal_artifactId_createdAt_idx" ON "CloudBackupRestoreRehearsal"("artifactId", "createdAt");

-- CreateIndex
CREATE INDEX "CloudBackupEvent_profileId_eventDate_idx" ON "CloudBackupEvent"("profileId", "eventDate");

-- CreateIndex
CREATE INDEX "CloudBackupEvent_runId_eventDate_idx" ON "CloudBackupEvent"("runId", "eventDate");

-- CreateIndex
CREATE INDEX "CloudBackupEvent_eventType_eventDate_idx" ON "CloudBackupEvent"("eventType", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsiteSettings_settingsCode_key" ON "PublicWebsiteSettings"("settingsCode");

-- CreateIndex
CREATE INDEX "PublicWebsiteSettings_status_publishedAt_idx" ON "PublicWebsiteSettings"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePage_pageCode_key" ON "PublicWebsitePage"("pageCode");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePage_slug_key" ON "PublicWebsitePage"("slug");

-- CreateIndex
CREATE INDEX "PublicWebsitePage_status_pageType_idx" ON "PublicWebsitePage"("status", "pageType");

-- CreateIndex
CREATE INDEX "PublicWebsitePage_showInNavigation_navigationOrder_idx" ON "PublicWebsitePage"("showInNavigation", "navigationOrder");

-- CreateIndex
CREATE INDEX "PublicWebsitePageVersion_slugSnapshot_publishedAt_idx" ON "PublicWebsitePageVersion"("slugSnapshot", "publishedAt");

-- CreateIndex
CREATE INDEX "PublicWebsitePageVersion_contentHash_idx" ON "PublicWebsitePageVersion"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePageVersion_pageId_versionNumber_key" ON "PublicWebsitePageVersion"("pageId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePost_postNumber_key" ON "PublicWebsitePost"("postNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePost_slug_key" ON "PublicWebsitePost"("slug");

-- CreateIndex
CREATE INDEX "PublicWebsitePost_status_postType_publishAt_idx" ON "PublicWebsitePost"("status", "postType", "publishAt");

-- CreateIndex
CREATE INDEX "PublicWebsitePost_featured_publishedAt_idx" ON "PublicWebsitePost"("featured", "publishedAt");

-- CreateIndex
CREATE INDEX "PublicWebsitePostVersion_slugSnapshot_publishedAt_idx" ON "PublicWebsitePostVersion"("slugSnapshot", "publishedAt");

-- CreateIndex
CREATE INDEX "PublicWebsitePostVersion_contentHash_idx" ON "PublicWebsitePostVersion"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsitePostVersion_postId_versionNumber_key" ON "PublicWebsitePostVersion"("postId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PublicWebsiteNavigationItem_itemCode_key" ON "PublicWebsiteNavigationItem"("itemCode");

-- CreateIndex
CREATE INDEX "PublicWebsiteNavigationItem_placement_enabled_displayOrder_idx" ON "PublicWebsiteNavigationItem"("placement", "enabled", "displayOrder");

-- CreateIndex
CREATE INDEX "PublicWebsiteNavigationItem_pageId_idx" ON "PublicWebsiteNavigationItem"("pageId");

-- CreateIndex
CREATE INDEX "PublicWebsiteEvent_entityType_entityId_eventDate_idx" ON "PublicWebsiteEvent"("entityType", "entityId", "eventDate");

-- CreateIndex
CREATE INDEX "PublicWebsiteEvent_eventType_eventDate_idx" ON "PublicWebsiteEvent"("eventType", "eventDate");
