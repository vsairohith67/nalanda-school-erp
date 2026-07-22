# Prisma Migration Dependency Inventory

## Scope and evidence

This inventory covers all 40 historical migration directories captured before DEVOPS-1B repair. SQL hashes are SHA-256. The verified operational database had no `_prisma_migrations` table, so none of these migrations was recorded there as applied.

The parser treats an altered table, index target, data-mutation target, or foreign-key target as a dependency. A migration is marked unsafe in ordered empty-database deployment when a dependency has not been created by an earlier active migration.

## Findings

- Empty-chain-safe migrations in recorded order: 24.
- Migrations with unresolved prior dependencies: 16.
- Never-created foundational dependencies include: `CashBookDay`, `CashBookMovement`, `ExamCycle`, `ExpenseCategory`, `ExpenseDepartment`, `Payment`, `Student`, `TimetableAssignment`, `TimetableClassSection`, `TimetableSubject`, `TimetableTeacher`, `Vendor`.
- The first migration alters `Payment` before any migration creates it; the second migration alters `Student` before any migration creates it.
- Because the original core-schema migration is absent, repairing only the first SQL statement would expose further missing dependencies rather than produce a trustworthy historical chain.

## Per-migration inventory

### 20260618_phase2_auth_audit

- Purpose: Phase2 Auth Audit.
- Tables created: `PaymentAudit`, `User`.
- Tables altered: `Payment`.
- Indexes and named constraints: `PaymentAudit_action_idx`, `PaymentAudit_changedByUserId_fkey`, `PaymentAudit_changedByUserId_idx`, `PaymentAudit_createdAt_idx`, `PaymentAudit_paymentId_fkey`, `PaymentAudit_paymentId_idx`, `Payment_isCancelled_idx`, `User_email_key`, `User_isActive_idx`, `User_role_idx`, `User_username_key`.
- Dependencies: `Payment`.
- Missing at this point in the historical chain: `Payment`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `8FE53A0E25BD00D3F2D682E5D656ED3AD9069CF79D00B06B99621A0B0390F0C6`.

### 20260618_student_import_fields

- Purpose: Student Import Fields.
- Tables created: None.
- Tables altered: `Student`.
- Indexes and named constraints: None.
- Dependencies: `Student`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `AFF4D8A666616E23DE9C5110CDF6A68280A16AEDC0CAB4388BA1A84B4005947B`.

### 20260619_import_verification_trial_mode

- Purpose: Import Verification Trial Mode.
- Tables created: `GoLiveChecklist`, `ImportBatch`.
- Tables altered: None.
- Indexes and named constraints: `ImportBatch_importedAt_idx`, `ImportBatch_importedByUserId_fkey`, `ImportBatch_importedByUserId_idx`, `ImportBatch_status_idx`, `ImportBatch_type_idx`.
- Dependencies: `User`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `88D1DDD07E83E6A07F7423F2C0BEE0052E02859B33AA39261D77E6246ADC2D52`.

### 20260619_manual_timetable_builder

- Purpose: Manual Timetable Builder.
- Tables created: `TimetableDraft`, `TimetableEntry`.
- Tables altered: None.
- Indexes and named constraints: `TimetableDraft_academicYear_idx`, `TimetableDraft_academicYear_name_key`, `TimetableDraft_createdByUserId_fkey`, `TimetableDraft_createdByUserId_idx`, `TimetableDraft_status_idx`, `TimetableEntry_academicYear_idx`, `TimetableEntry_assignmentId_fkey`, `TimetableEntry_assignmentId_idx`, `TimetableEntry_classSectionId_fkey`, `TimetableEntry_classSectionId_idx`, `TimetableEntry_draftId_classSectionId_dayOfWeek_periodNumber_key`, `TimetableEntry_draftId_fkey`, `TimetableEntry_draftId_idx`, `TimetableEntry_subjectId_fkey`, `TimetableEntry_teacherId_dayOfWeek_periodNumber_idx`, `TimetableEntry_teacherId_fkey`.
- Dependencies: `TimetableAssignment`, `TimetableClassSection`, `TimetableSubject`, `TimetableTeacher`, `User`.
- Missing at this point in the historical chain: `TimetableAssignment`, `TimetableClassSection`, `TimetableSubject`, `TimetableTeacher`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `ED56508308BE1F6B8BDAEF5CE458AF539AB2B97D1677065C9BA9FAD7E9ED1632`.

### 20260619_timetable_foundation

- Purpose: Timetable Foundation.
- Tables created: `TimetableAssignment`, `TimetableClassSection`, `TimetableFixedPeriod`, `TimetablePeriodTemplate`, `TimetableSubject`, `TimetableTeacher`, `TimetableTeacherUnavailability`.
- Tables altered: None.
- Indexes and named constraints: `TimetableAssignment_academicYear_classSectionId_subjectId_teacherId_key`, `TimetableAssignment_academicYear_idx`, `TimetableAssignment_classSectionId_fkey`, `TimetableAssignment_classSectionId_idx`, `TimetableAssignment_subjectId_fkey`, `TimetableAssignment_subjectId_idx`, `TimetableAssignment_teacherId_fkey`, `TimetableAssignment_teacherId_idx`, `TimetableClassSection_academicYear_className_section_key`, `TimetableClassSection_academicYear_idx`, `TimetableClassSection_groupName_idx`, `TimetableClassSection_isActive_idx`, `TimetableFixedPeriod_academicYear_idx`, `TimetableFixedPeriod_classSectionId_fkey`, `TimetableFixedPeriod_classSectionId_idx`, `TimetableFixedPeriod_dayOfWeek_periodNumber_idx`, `TimetableFixedPeriod_subjectId_fkey`, `TimetableFixedPeriod_subjectId_idx`, `TimetableFixedPeriod_teacherId_fkey`, `TimetableFixedPeriod_teacherId_idx`, `TimetablePeriodTemplate_academicYear_groupName_dayOfWeek_idx`, `TimetablePeriodTemplate_academicYear_groupName_dayOfWeek_sortOrder_key`, `TimetableSubject_department_idx`, `TimetableSubject_isActive_idx`, `TimetableSubject_name_idx`, `TimetableSubject_shortName_key`, `TimetableTeacherUnavailability_teacherId_dayOfWeek_periodNumber_key`, `TimetableTeacherUnavailability_teacherId_fkey`, `TimetableTeacherUnavailability_teacherId_idx`, `TimetableTeacher_department_idx`, `TimetableTeacher_isActive_idx`, `TimetableTeacher_name_idx`, `TimetableTeacher_shortName_key`.
- Dependencies: None.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `B1D28B02D89EBF5B6E39730E8BE541D64B28DED48E6C0A4A59EDD208F2D66071`.

### 20260619_user_management_school_settings

- Purpose: User Management School Settings.
- Tables created: `SchoolSettings`, `UserAudit`.
- Tables altered: None.
- Indexes and named constraints: `UserAudit_action_idx`, `UserAudit_actorUserId_idx`, `UserAudit_createdAt_idx`, `UserAudit_targetUserId_idx`.
- Dependencies: None.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `9AA964BF311AFB9058CC10197FC8796C6D35658258A53ED2F7354AB34D78F9DC`.

### 20260624_role_permission_matrix

- Purpose: Role Permission Matrix.
- Tables created: `RolePermission`.
- Tables altered: None.
- Indexes and named constraints: `RolePermission_permission_idx`, `RolePermission_role_idx`, `RolePermission_role_permission_key`.
- Dependencies: None.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `A2B5BC66A1B0ADA685E235447F7270C6BFF55975209F337DB2842151A4BDC66E`.

### 20260626_guardian_access_foundation

- Purpose: Guardian Access Foundation.
- Tables created: `Guardian`, `StudentGuardian`.
- Tables altered: `User`.
- Indexes and named constraints: `Guardian_displayName_idx`, `Guardian_email_idx`, `Guardian_primaryMobile_idx`, `Guardian_status_idx`, `StudentGuardian_guardianId_fkey`, `StudentGuardian_guardianId_idx`, `StudentGuardian_guardianId_studentId_key`, `StudentGuardian_isPrimaryContact_idx`, `StudentGuardian_studentId_fkey`, `StudentGuardian_studentId_idx`, `User_guardianId_idx`, `User_guardianId_key`.
- Dependencies: `Student`, `User`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `B94DA631256AFAA75358AA8313C8A5F075BBD7A49DD34953FA9AE121B9D63543`.

### 20260627_parent_notices

- Purpose: Parent Notices.
- Tables created: `Notice`.
- Tables altered: None.
- Indexes and named constraints: `Notice_audienceType_className_section_idx`, `Notice_createdById_fkey`, `Notice_createdById_idx`, `Notice_expiresAt_idx`, `Notice_status_publishDate_idx`, `Notice_updatedById_fkey`, `Notice_updatedById_idx`.
- Dependencies: `User`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `2458CC1BEE634899E4F38A73DAE2B9FC2ABEB72854E2F22C22340B2AE9A87D55`.

### 20260627_staff_teacher_foundation

- Purpose: Staff Teacher Foundation.
- Tables created: `StaffMember`.
- Tables altered: None.
- Indexes and named constraints: `StaffMember_designation_idx`, `StaffMember_email_idx`, `StaffMember_fullName_idx`, `StaffMember_mobile_idx`, `StaffMember_primarySubject_idx`, `StaffMember_staffCode_key`, `StaffMember_staffType_idx`, `StaffMember_status_idx`, `StaffMember_timetableTeacherId_fkey`, `StaffMember_timetableTeacherId_key`, `StaffMember_userId_fkey`, `StaffMember_userId_key`.
- Dependencies: `RolePermission`, `TimetableTeacher`, `User`.
- Missing at this point in the historical chain: None.
- Assumes prior data: Yes (UPDATE RolePermission).
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `6926AA133AAEA8279262EA92897EF34610CB63CD9BB5E07381CBC68B99CB2504`.

### 20260627_student_attendance_foundation

- Purpose: Student Attendance Foundation.
- Tables created: `StudentAttendanceRecord`, `StudentAttendanceSession`.
- Tables altered: None.
- Indexes and named constraints: `StudentAttendanceRecord_sessionId_fkey`, `StudentAttendanceRecord_sessionId_studentId_key`, `StudentAttendanceRecord_status_idx`, `StudentAttendanceRecord_studentId_fkey`, `StudentAttendanceRecord_studentId_idx`, `StudentAttendanceSession_academicYear_className_section_idx`, `StudentAttendanceSession_attendanceDate_className_section_academicYear_key`, `StudentAttendanceSession_attendanceDate_idx`, `StudentAttendanceSession_lockedByUserId_fkey`, `StudentAttendanceSession_status_idx`, `StudentAttendanceSession_submittedByUserId_fkey`, `StudentAttendanceSession_takenByUserId_fkey`.
- Dependencies: `Student`, `User`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `C5D0D07A83F83B0BB6D49765F1BAF480EED661F9898C344463A9C2E9BA73B7F3`.

### 20260628_staff_attendance_foundation

- Purpose: Staff Attendance Foundation.
- Tables created: `StaffAttendanceRecord`, `StaffAttendanceSession`.
- Tables altered: None.
- Indexes and named constraints: `StaffAttendanceRecord_sessionId_fkey`, `StaffAttendanceRecord_sessionId_staffMemberId_key`, `StaffAttendanceRecord_source_idx`, `StaffAttendanceRecord_staffMemberId_fkey`, `StaffAttendanceRecord_staffMemberId_idx`, `StaffAttendanceRecord_status_idx`, `StaffAttendanceSession_attendanceDate_key`, `StaffAttendanceSession_lockedByUserId_fkey`, `StaffAttendanceSession_status_idx`, `StaffAttendanceSession_submittedByUserId_fkey`, `StaffAttendanceSession_takenByUserId_fkey`.
- Dependencies: `StaffMember`, `User`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `18B53DEB38E7D5F9D26A06E7F0D0F8C64E9707E66E8E2301400D52EA3B4D405D`.

### 20260628_staff_leave_foundation

- Purpose: Staff Leave Foundation.
- Tables created: `StaffLeaveRequest`.
- Tables altered: None.
- Indexes and named constraints: `StaffLeaveRequest_approverUserId_fkey`, `StaffLeaveRequest_approverUserId_idx`, `StaffLeaveRequest_cancelledByUserId_fkey`, `StaffLeaveRequest_leaveType_idx`, `StaffLeaveRequest_requestedByUserId_fkey`, `StaffLeaveRequest_requestedByUserId_idx`, `StaffLeaveRequest_staffMemberId_fkey`, `StaffLeaveRequest_staffMemberId_startDate_endDate_idx`, `StaffLeaveRequest_startDate_endDate_idx`, `StaffLeaveRequest_status_idx`.
- Dependencies: `StaffMember`, `User`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `11FE8753B8173BDF5EA8CBCB7424BD670048C0F78256525AA9601841AC7773F9`.

### 20260628_substitute_teacher_foundation

- Purpose: Substitute Teacher Foundation.
- Tables created: `SubstituteAssignment`.
- Tables altered: None.
- Indexes and named constraints: `SubstituteAssignment_absentStaffMemberId_assignmentDate_idx`, `SubstituteAssignment_absentStaffMemberId_fkey`, `SubstituteAssignment_assignedByUserId_fkey`, `SubstituteAssignment_assignmentDate_idx`, `SubstituteAssignment_cancelledByUserId_fkey`, `SubstituteAssignment_completedByUserId_fkey`, `SubstituteAssignment_confirmedByUserId_fkey`, `SubstituteAssignment_leaveRequestId_fkey`, `SubstituteAssignment_leaveRequestId_idx`, `SubstituteAssignment_status_idx`, `SubstituteAssignment_substituteStaffMemberId_assignmentDate_idx`, `SubstituteAssignment_substituteStaffMemberId_fkey`, `SubstituteAssignment_timetableAssignmentId_fkey`, `SubstituteAssignment_timetableAssignmentId_idx`.
- Dependencies: `StaffLeaveRequest`, `StaffMember`, `TimetableAssignment`, `User`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `BF7DAA7151366915CBF3E25A14BB0B5A13CCC2955EF27EA316774F665B900409`.

### 20260701_student_lifecycle_foundation

- Purpose: Student Lifecycle Foundation.
- Tables created: `AcademicYearEnrollment`, `StudentLifecycleEvent`.
- Tables altered: None.
- Indexes and named constraints: `AcademicYearEnrollment_academicYear_className_section_idx`, `AcademicYearEnrollment_academicYear_status_idx`, `AcademicYearEnrollment_studentId_academicYear_key`, `AcademicYearEnrollment_studentId_createdAt_idx`, `AcademicYearEnrollment_studentId_fkey`, `StudentLifecycleEvent_academicYear_eventType_idx`, `StudentLifecycleEvent_approvedByUserId_fkey`, `StudentLifecycleEvent_approvedByUserId_idx`, `StudentLifecycleEvent_recordedByUserId_fkey`, `StudentLifecycleEvent_recordedByUserId_idx`, `StudentLifecycleEvent_studentId_effectiveDate_idx`, `StudentLifecycleEvent_studentId_fkey`.
- Dependencies: `Student`, `User`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `0D27C99F67DBA742FDD3EC1C7AF97D162430DF738DBCD2CA79645A89FB8B1634`.

### 20260701_student_progression_foundation

- Purpose: Student Progression Foundation.
- Tables created: `StudentProgressionDecision`.
- Tables altered: None.
- Indexes and named constraints: `StudentProgressionDecision_academicYear_decisionType_status_idx`, `StudentProgressionDecision_approvedByUserId_fkey`, `StudentProgressionDecision_approvedByUserId_idx`, `StudentProgressionDecision_cancelledByUserId_fkey`, `StudentProgressionDecision_createdByUserId_fkey`, `StudentProgressionDecision_createdByUserId_idx`, `StudentProgressionDecision_finalizedByUserId_fkey`, `StudentProgressionDecision_sourceEnrollmentId_fkey`, `StudentProgressionDecision_sourceEnrollmentId_idx`, `StudentProgressionDecision_studentId_createdAt_idx`, `StudentProgressionDecision_studentId_fkey`, `StudentProgressionDecision_submittedByUserId_fkey`.
- Dependencies: `AcademicYearEnrollment`, `Student`, `User`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `5CBF4683BD649257EF33CEFC081D93BB83298103918E59DB34DF8751E8EBDC21`.

### 20260715_books_library_finance_foundation

- Purpose: Books Library Finance Foundation.
- Tables created: `BookCashSettlement`, `BookCatalogItem`, `BookCatalogRate`, `BookSaleReceipt`, `BookSaleReceiptLine`.
- Tables altered: `CashBookDay`.
- Indexes and named constraints: `BookCashSettlement_academicYear_idx`, `BookCashSettlement_approvedByUserId_fkey`, `BookCashSettlement_cancelledByUserId_fkey`, `BookCashSettlement_cashBookMovementId_fkey`, `BookCashSettlement_cashBookMovementId_key`, `BookCashSettlement_createdByUserId_fkey`, `BookCashSettlement_settlementDate_key`, `BookCashSettlement_status_idx`, `BookCashSettlement_submittedByUserId_fkey`, `BookCatalogItem_className_idx`, `BookCatalogItem_createdByUserId_fkey`, `BookCatalogItem_itemCode_key`, `BookCatalogItem_itemType_idx`, `BookCatalogItem_publisherVendorId_fkey`, `BookCatalogItem_publisherVendorId_idx`, `BookCatalogItem_status_idx`, `BookCatalogRate_academicYear_idx`, `BookCatalogRate_itemId_academicYear_status_idx`, `BookCatalogRate_itemId_fkey`, `BookSaleReceiptLine_itemId_fkey`, `BookSaleReceiptLine_itemId_idx`, `BookSaleReceiptLine_rateId_fkey`, `BookSaleReceiptLine_rateId_idx`, `BookSaleReceiptLine_receiptId_fkey`, `BookSaleReceiptLine_receiptId_idx`, `BookSaleReceipt_academicYear_idx`, `BookSaleReceipt_cancelledByUserId_fkey`, `BookSaleReceipt_createdByUserId_fkey`, `BookSaleReceipt_paymentMethod_idx`, `BookSaleReceipt_receiptDate_idx`, `BookSaleReceipt_receiptNumber_key`, `BookSaleReceipt_receivedAccount_idx`, `BookSaleReceipt_status_idx`, `BookSaleReceipt_studentId_fkey`, `BookSaleReceipt_studentId_idx`.
- Dependencies: `CashBookDay`, `CashBookMovement`, `Student`, `User`, `Vendor`.
- Missing at this point in the historical chain: `CashBookDay`, `CashBookMovement`, `Student`, `Vendor`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `DEE080DDD6C8D9B9976CB379FB43D1AB3E1852599FAE0C21C85A05A96B671F28`.

### 20260715_budget_spending_controls

- Purpose: Budget Spending Controls.
- Tables created: `BudgetAllocation`, `BudgetPlan`, `BudgetRevision`.
- Tables altered: None.
- Indexes and named constraints: `BudgetAllocation_budgetPlanId_allocationKey_key`, `BudgetAllocation_budgetPlanId_fkey`, `BudgetAllocation_budgetPlanId_idx`, `BudgetAllocation_categoryId_fkey`, `BudgetAllocation_categoryId_idx`, `BudgetAllocation_departmentId_fkey`, `BudgetAllocation_departmentId_idx`, `BudgetPlan_academicYear_idx`, `BudgetPlan_academicYear_status_idx`, `BudgetPlan_approvedByUserId_fkey`, `BudgetPlan_budgetNumber_key`, `BudgetPlan_cancelledByUserId_fkey`, `BudgetPlan_createdByUserId_fkey`, `BudgetPlan_lockedByUserId_fkey`, `BudgetPlan_one_official_per_year`, `BudgetPlan_status_idx`, `BudgetPlan_submittedByUserId_fkey`, `BudgetRevision_approvedByUserId_fkey`, `BudgetRevision_budgetPlanId_fkey`, `BudgetRevision_budgetPlanId_revisionNumber_key`, `BudgetRevision_budgetPlanId_status_idx`, `BudgetRevision_createdByUserId_fkey`, `BudgetRevision_submittedByUserId_fkey`.
- Dependencies: `ExpenseCategory`, `ExpenseDepartment`, `User`.
- Missing at this point in the historical chain: `ExpenseCategory`, `ExpenseDepartment`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `8B051A860FA4386F06BE02AEC0D9177C3F38D835C2B3BEDB726C761ED4C83B26`.

### 20260715_expense_vendor_foundation

- Purpose: Expense Vendor Foundation.
- Tables created: `ExpenseAudit`, `ExpenseCategory`, `ExpenseDepartment`, `ExpensePayment`, `ExpenseRecord`, `Vendor`.
- Tables altered: None.
- Indexes and named constraints: `ExpenseAudit_actorUserId_fkey`, `ExpenseAudit_expenseRecordId_createdAt_idx`, `ExpenseAudit_expenseRecordId_fkey`, `ExpenseCategory_code_key`, `ExpenseCategory_name_key`, `ExpenseCategory_parentCategoryId_fkey`, `ExpenseCategory_parentCategoryId_idx`, `ExpenseCategory_status_idx`, `ExpenseDepartment_code_key`, `ExpenseDepartment_name_key`, `ExpenseDepartment_status_idx`, `ExpensePayment_expenseRecordId_fkey`, `ExpensePayment_expenseRecordId_paymentDate_idx`, `ExpensePayment_recordedByUserId_fkey`, `ExpenseRecord_academicYear_idx`, `ExpenseRecord_approvalStatus_idx`, `ExpenseRecord_approvedByUserId_fkey`, `ExpenseRecord_cancelledByUserId_fkey`, `ExpenseRecord_categoryId_fkey`, `ExpenseRecord_categoryId_idx`, `ExpenseRecord_createdByUserId_fkey`, `ExpenseRecord_departmentId_fkey`, `ExpenseRecord_departmentId_idx`, `ExpenseRecord_expenseDate_idx`, `ExpenseRecord_expenseNumber_key`, `ExpenseRecord_paidByUserId_fkey`, `ExpenseRecord_paymentStatus_idx`, `ExpenseRecord_submittedByUserId_fkey`, `ExpenseRecord_vendorId_fkey`, `ExpenseRecord_vendorId_idx`, `Vendor_createdByUserId_fkey`, `Vendor_gstin_idx`, `Vendor_mobile_idx`, `Vendor_name_idx`, `Vendor_status_idx`, `Vendor_vendorCode_key`.
- Dependencies: `User`.
- Missing at this point in the historical chain: None.
- Assumes prior data: Yes (INSERT INTO ExpenseCategory, INSERT INTO ExpenseDepartment).
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `FC212F7F93A5559C2B84D0CFF997CFDB11AE53BE6B8AFB5118B2F28A04E610A2`.

### 20260715_library_catalog_accession_foundation

- Purpose: Library Catalog Accession Foundation.
- Tables created: `LibraryCopy`, `LibraryCopyEvent`, `LibraryTitle`.
- Tables altered: None.
- Indexes and named constraints: `LibraryCopyEvent_copyId_eventDate_idx`, `LibraryCopyEvent_copyId_fkey`, `LibraryCopyEvent_eventType_idx`, `LibraryCopyEvent_recordedByUserId_fkey`, `LibraryCopyEvent_recordedByUserId_idx`, `LibraryCopy_accessionNumber_key`, `LibraryCopy_acquisitionType_idx`, `LibraryCopy_barcodeValue_key`, `LibraryCopy_condition_idx`, `LibraryCopy_createdByUserId_fkey`, `LibraryCopy_expenseRecordId_fkey`, `LibraryCopy_expenseRecordId_idx`, `LibraryCopy_shelfCode_idx`, `LibraryCopy_titleId_fkey`, `LibraryCopy_titleId_status_idx`, `LibraryCopy_updatedByUserId_fkey`, `LibraryCopy_vendorId_fkey`, `LibraryCopy_vendorId_idx`, `LibraryTitle_authors_idx`, `LibraryTitle_createdByUserId_fkey`, `LibraryTitle_isbn_key`, `LibraryTitle_publisherVendorId_fkey`, `LibraryTitle_publisherVendorId_idx`, `LibraryTitle_status_language_idx`, `LibraryTitle_subject_category_idx`, `LibraryTitle_titleCode_key`, `LibraryTitle_title_idx`.
- Dependencies: `ExpenseRecord`, `User`, `Vendor`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `AC39F2C7998204D4BE869F435DE37739F2221AA0784FD991B8AF5878BDC092C0`.

### 20260715_library_membership_circulation_foundation

- Purpose: Library Membership Circulation Foundation.
- Tables created: `LibraryLoan`, `LibraryLoanEvent`, `LibraryMember`, `LibraryPolicy`, `LibraryReservation`.
- Tables altered: None.
- Indexes and named constraints: `LibraryLoanEvent_copyId_fkey`, `LibraryLoanEvent_eventType_eventDate_idx`, `LibraryLoanEvent_loanId_eventDate_idx`, `LibraryLoanEvent_loanId_fkey`, `LibraryLoanEvent_memberId_eventDate_idx`, `LibraryLoanEvent_memberId_fkey`, `LibraryLoanEvent_parent_check`, `LibraryLoanEvent_recordedByUserId_fkey`, `LibraryLoanEvent_reservationId_eventDate_idx`, `LibraryLoanEvent_reservationId_fkey`, `LibraryLoanEvent_titleId_fkey`, `LibraryLoan_activeCopyKey_key`, `LibraryLoan_active_key_check`, `LibraryLoan_cancelledByUserId_fkey`, `LibraryLoan_copyId_fkey`, `LibraryLoan_copyId_status_idx`, `LibraryLoan_dates_check`, `LibraryLoan_issueDate_idx`, `LibraryLoan_issuedByUserId_fkey`, `LibraryLoan_loanNumber_key`, `LibraryLoan_memberId_fkey`, `LibraryLoan_memberId_status_idx`, `LibraryLoan_returnedByUserId_fkey`, `LibraryLoan_returnedDate_idx`, `LibraryLoan_status_check`, `LibraryLoan_status_dueDate_idx`, `LibraryMember_createdByUserId_fkey`, `LibraryMember_exactly_one_link_check`, `LibraryMember_joinedDate_idx`, `LibraryMember_memberCode_key`, `LibraryMember_memberType_status_idx`, `LibraryMember_staffMemberId_fkey`, `LibraryMember_staffMemberId_key`, `LibraryMember_status_check`, `LibraryMember_studentId_fkey`, `LibraryMember_studentId_key`, `LibraryMember_suspension_reason_check`, `LibraryMember_updatedByUserId_fkey`, `LibraryPolicy_active_scope_priority_key`, `LibraryPolicy_className_status_idx`, `LibraryPolicy_createdByUserId_fkey`, `LibraryPolicy_limits_check`, `LibraryPolicy_memberType_status_priority_idx`, `LibraryPolicy_policyCode_key`, `LibraryPolicy_scope_check`, `LibraryPolicy_staffType_status_idx`, `LibraryPolicy_status_check`, `LibraryReservation_activeMemberTitleKey_key`, `LibraryReservation_active_key_check`, `LibraryReservation_cancelledByUserId_fkey`, `LibraryReservation_createdByUserId_fkey`, `LibraryReservation_fulfilledByUserId_fkey`, `LibraryReservation_fulfilledLoanId_fkey`, `LibraryReservation_fulfilledLoanId_key`, `LibraryReservation_memberId_fkey`, `LibraryReservation_memberId_status_idx`, `LibraryReservation_reservationNumber_key`, `LibraryReservation_status_check`, `LibraryReservation_status_expiresDate_idx`, `LibraryReservation_titleId_fkey`, `LibraryReservation_titleId_status_requestedDate_createdAt_idx`.
- Dependencies: `LibraryCopy`, `LibraryTitle`, `StaffMember`, `Student`, `User`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `A20936252D13E489DBD96C57F47F0CAE94486E655F6B873630D7F19BA93A6ABD`.

### 20260715_misc_income_cash_book_foundation

- Purpose: Misc Income Cash Book Foundation.
- Tables created: `CashBookDay`, `CashBookMovement`, `MiscIncomeItem`, `MiscIncomeRate`, `MiscIncomeReceipt`, `MiscIncomeReceiptLine`.
- Tables altered: None.
- Indexes and named constraints: `CashBookDay_academicYear_idx`, `CashBookDay_approvedByUserId_fkey`, `CashBookDay_cancelledByUserId_fkey`, `CashBookDay_cashDate_key`, `CashBookDay_createdByUserId_fkey`, `CashBookDay_lockedByUserId_fkey`, `CashBookDay_status_idx`, `CashBookDay_submittedByUserId_fkey`, `CashBookMovement_cancelledByUserId_fkey`, `CashBookMovement_cashBookDayId_fkey`, `CashBookMovement_cashBookDayId_status_idx`, `CashBookMovement_movementDate_idx`, `CashBookMovement_movementType_idx`, `CashBookMovement_recordedByUserId_fkey`, `MiscIncomeItem_category_idx`, `MiscIncomeItem_createdByUserId_fkey`, `MiscIncomeItem_itemCode_key`, `MiscIncomeItem_status_idx`, `MiscIncomeRate_academicYear_idx`, `MiscIncomeRate_itemId_academicYear_status_idx`, `MiscIncomeRate_itemId_fkey`, `MiscIncomeReceiptLine_itemId_fkey`, `MiscIncomeReceiptLine_itemId_idx`, `MiscIncomeReceiptLine_rateId_fkey`, `MiscIncomeReceiptLine_rateId_idx`, `MiscIncomeReceiptLine_receiptId_fkey`, `MiscIncomeReceiptLine_receiptId_idx`, `MiscIncomeReceipt_academicYear_idx`, `MiscIncomeReceipt_cancelledByUserId_fkey`, `MiscIncomeReceipt_createdByUserId_fkey`, `MiscIncomeReceipt_paymentMethod_idx`, `MiscIncomeReceipt_receiptDate_idx`, `MiscIncomeReceipt_receiptNumber_key`, `MiscIncomeReceipt_receivedAccount_idx`, `MiscIncomeReceipt_status_idx`, `MiscIncomeReceipt_studentId_fkey`, `MiscIncomeReceipt_studentId_idx`.
- Dependencies: `Student`, `User`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `B2F11530913B905E020CCB971F2373116A9B3007E4AE0A2DA6734321EB0FEF07`.

### 20260716_digital_report_cards_kg_rubric

- Purpose: Digital Report Cards Kg Rubric.
- Tables created: `GradeBand`, `GradingScheme`, `ReportCardBatch`, `ReportCardBatchExamSource`, `ReportCardTemplate`, `StudentReportCard`, `StudentReportCardEvent`, `StudentReportCardVersion`.
- Tables altered: None.
- Indexes and named constraints: `GradeBand_gradingSchemeId_displayOrder_key`, `GradeBand_gradingSchemeId_fkey`, `GradeBand_gradingSchemeId_gradeCode_key`, `GradeBand_gradingSchemeId_minimumPercentage_idx`, `GradingScheme_academicYear_reportType_status_idx`, `GradingScheme_schemeCode_key`, `ReportCardBatchExamSource_batchId_displayOrder_key`, `ReportCardBatchExamSource_batchId_examCycleId_key`, `ReportCardBatchExamSource_batchId_fkey`, `ReportCardBatchExamSource_examCycleId_fkey`, `ReportCardBatchExamSource_examCycleId_idx`, `ReportCardBatch_academicYear_className_section_idx`, `ReportCardBatch_batchNumber_key`, `ReportCardBatch_reportType_status_idx`, `ReportCardBatch_templateId_fkey`, `ReportCardBatch_templateId_idx`, `ReportCardTemplate_academicYear_className_idx`, `ReportCardTemplate_gradingSchemeId_fkey`, `ReportCardTemplate_gradingSchemeId_idx`, `ReportCardTemplate_reportType_status_idx`, `ReportCardTemplate_templateCode_key`, `StudentReportCardEvent_eventType_idx`, `StudentReportCardEvent_reportCardId_eventDate_idx`, `StudentReportCardEvent_reportCardId_fkey`, `StudentReportCardEvent_versionId_idx`, `StudentReportCardVersion_reportCardId_fkey`, `StudentReportCardVersion_reportCardId_issuedAt_idx`, `StudentReportCardVersion_reportCardId_versionNumber_key`, `StudentReportCardVersion_supersedesVersionId_idx`, `StudentReportCard_batchId_fkey`, `StudentReportCard_batchId_status_idx`, `StudentReportCard_batchId_studentId_key`, `StudentReportCard_progressionDecisionId_idx`, `StudentReportCard_reportCardNumber_key`, `StudentReportCard_studentId_academicYear_idx`, `StudentReportCard_studentId_fkey`.
- Dependencies: `ExamCycle`, `Student`.
- Missing at this point in the historical chain: `ExamCycle`, `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `7DFB12F1ACD37D185CF034B80AA3693BD3DE852B722397C0F8762FC3749A8E2D`.

### 20260716_exams_marks_foundation

- Purpose: Exams Marks Foundation.
- Tables created: `ExamAssessment`, `ExamCycle`, `StudentMark`, `StudentMarkEvent`.
- Tables altered: None.
- Indexes and named constraints: `ExamAssessment_academicYear_className_section_idx`, `ExamAssessment_entryStatus_idx`, `ExamAssessment_examCycleId_className_section_subjectName_componentName_key`, `ExamAssessment_examCycleId_fkey`, `ExamAssessment_timetableSubjectId_fkey`, `ExamAssessment_timetableSubjectId_idx`, `ExamCycle_academicYear_status_idx`, `ExamCycle_examCode_key`, `ExamCycle_startDate_endDate_idx`, `StudentMarkEvent_assessmentId_eventDate_idx`, `StudentMarkEvent_assessmentId_fkey`, `StudentMarkEvent_eventType_idx`, `StudentMarkEvent_studentMarkId_idx`, `StudentMark_assessmentId_fkey`, `StudentMark_assessmentId_studentId_key`, `StudentMark_entryStatus_idx`, `StudentMark_studentId_academicYear_idx`, `StudentMark_studentId_fkey`.
- Dependencies: `Student`, `TimetableSubject`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `9B2F797C47074C0AA2E21219DE7476D2D9990D497D662BDAD9AAAFB38A0DF555`.

### 20260716_homework_assignments_foundation

- Purpose: Homework Assignments Foundation.
- Tables created: `HomeworkAssignment`, `HomeworkAssignmentEvent`.
- Tables altered: None.
- Indexes and named constraints: `HomeworkAssignmentEvent_assignmentId_eventDate_idx`, `HomeworkAssignmentEvent_assignmentId_fkey`, `HomeworkAssignmentEvent_eventType_idx`, `HomeworkAssignmentEvent_recordedByUserId_fkey`, `HomeworkAssignmentEvent_recordedByUserId_idx`, `HomeworkAssignment_academicYear_className_section_idx`, `HomeworkAssignment_academicYear_subjectName_idx`, `HomeworkAssignment_archivedByUserId_fkey`, `HomeworkAssignment_assignmentNumber_key`, `HomeworkAssignment_cancelledByUserId_fkey`, `HomeworkAssignment_createdByUserId_fkey`, `HomeworkAssignment_createdByUserId_idx`, `HomeworkAssignment_dueDate_idx`, `HomeworkAssignment_publishedByUserId_fkey`, `HomeworkAssignment_status_assignedDate_idx`, `HomeworkAssignment_timetableSubjectId_fkey`, `HomeworkAssignment_timetableSubjectId_idx`.
- Dependencies: `TimetableSubject`, `User`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `70584C962D0D986CD54C372B2FF023E5B9EABE23D09AB0EACDD88BCBC6630334`.

### 20260716_library_incident_charge_portal_foundation

- Purpose: Library Incident Charge Portal Foundation.
- Tables created: `LibraryCharge`, `LibraryChargeEvent`, `LibraryChargeRule`, `LibraryIncident`.
- Tables altered: None.
- Indexes and named constraints: `LibraryChargeEvent_chargeId_eventDate_idx`, `LibraryChargeEvent_chargeId_fkey`, `LibraryChargeEvent_eventType_eventDate_idx`, `LibraryChargeEvent_incidentId_eventDate_idx`, `LibraryChargeEvent_incidentId_fkey`, `LibraryChargeEvent_recordedByUserId_fkey`, `LibraryChargeRule_className_status_idx`, `LibraryChargeRule_createdByUserId_fkey`, `LibraryChargeRule_memberType_status_priority_idx`, `LibraryChargeRule_ruleCode_key`, `LibraryChargeRule_staffType_status_idx`, `LibraryCharge_activeOverdueLoanKey_key`, `LibraryCharge_approvedByUserId_fkey`, `LibraryCharge_assessedDate_idx`, `LibraryCharge_cancelledByUserId_fkey`, `LibraryCharge_chargeNumber_key`, `LibraryCharge_collectedByUserId_fkey`, `LibraryCharge_createdByUserId_fkey`, `LibraryCharge_incidentId_fkey`, `LibraryCharge_incidentId_status_idx`, `LibraryCharge_loanId_fkey`, `LibraryCharge_loanId_status_idx`, `LibraryCharge_memberId_fkey`, `LibraryCharge_memberId_status_idx`, `LibraryCharge_miscIncomeReceiptId_fkey`, `LibraryCharge_miscIncomeReceiptId_key`, `LibraryCharge_staffMemberId_fkey`, `LibraryCharge_staffMemberId_status_idx`, `LibraryCharge_status_chargeType_idx`, `LibraryCharge_studentId_fkey`, `LibraryCharge_studentId_status_idx`, `LibraryCharge_waivedByUserId_fkey`, `LibraryIncident_activeCaseKey_key`, `LibraryIncident_approvedByUserId_fkey`, `LibraryIncident_cancelledByUserId_fkey`, `LibraryIncident_copyId_fkey`, `LibraryIncident_copyId_status_idx`, `LibraryIncident_createdByUserId_fkey`, `LibraryIncident_incidentNumber_key`, `LibraryIncident_loanId_fkey`, `LibraryIncident_loanId_status_idx`, `LibraryIncident_memberId_fkey`, `LibraryIncident_memberId_reportedDate_idx`, `LibraryIncident_replacementCopyId_fkey`, `LibraryIncident_resolvedByUserId_fkey`, `LibraryIncident_status_incidentType_idx`, `LibraryIncident_submittedByUserId_fkey`, `LibraryIncident_titleId_fkey`, `LibraryIncident_titleId_status_idx`.
- Dependencies: `LibraryCopy`, `LibraryLoan`, `LibraryMember`, `LibraryTitle`, `MiscIncomeItem`, `MiscIncomeReceipt`, `StaffMember`, `Student`, `User`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: Yes (INSERT OR IGNORE INTO MiscIncomeItem).
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `93406ECBFA486B4FFBFE0FE45DD371C9F4777353685BE4F25761740B59E733AD`.

### 20260716_library_stock_verification_foundation

- Purpose: Library Stock Verification Foundation.
- Tables created: `LibraryStockVerificationEvent`, `LibraryStockVerificationRecord`, `LibraryStockVerificationScanEvent`, `LibraryStockVerificationSession`.
- Tables altered: None.
- Indexes and named constraints: `LibraryStockVerificationEvent_eventType_idx`, `LibraryStockVerificationEvent_recordedByUserId_fkey`, `LibraryStockVerificationEvent_sessionId_eventDate_idx`, `LibraryStockVerificationEvent_sessionId_fkey`, `LibraryStockVerificationRecord_appliedByUserId_fkey`, `LibraryStockVerificationRecord_appliedCopyEventId_fkey`, `LibraryStockVerificationRecord_appliedCopyEventId_key`, `LibraryStockVerificationRecord_copyId_fkey`, `LibraryStockVerificationRecord_copyId_idx`, `LibraryStockVerificationRecord_observedByUserId_fkey`, `LibraryStockVerificationRecord_reviewedByUserId_fkey`, `LibraryStockVerificationRecord_sessionId_copyId_key`, `LibraryStockVerificationRecord_sessionId_fkey`, `LibraryStockVerificationRecord_sessionId_observationStatus_idx`, `LibraryStockVerificationRecord_sessionId_resolutionStatus_idx`, `LibraryStockVerificationScanEvent_recordId_fkey`, `LibraryStockVerificationScanEvent_recordId_idx`, `LibraryStockVerificationScanEvent_recordedByUserId_fkey`, `LibraryStockVerificationScanEvent_resultType_idx`, `LibraryStockVerificationScanEvent_sessionId_fkey`, `LibraryStockVerificationScanEvent_sessionId_scannedAt_idx`, `LibraryStockVerificationSession_academicYear_status_idx`, `LibraryStockVerificationSession_approvedByUserId_fkey`, `LibraryStockVerificationSession_cancelledByUserId_fkey`, `LibraryStockVerificationSession_createdByUserId_fkey`, `LibraryStockVerificationSession_lockedByUserId_fkey`, `LibraryStockVerificationSession_reviewedByUserId_fkey`, `LibraryStockVerificationSession_scopeType_idx`, `LibraryStockVerificationSession_sessionNumber_key`, `LibraryStockVerificationSession_startedByUserId_fkey`, `LibraryStockVerificationSession_submittedByUserId_fkey`, `LibraryStockVerificationSession_titleIdFilter_fkey`, `LibraryStockVerificationSession_verificationDate_idx`.
- Dependencies: `LibraryCopy`, `LibraryCopyEvent`, `LibraryTitle`, `User`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `A02ED972114B02CBDA5F4BCE707D0AD05E1DFA0748A4CF2AD1D314AAF0EBC715`.

### 20260717_class_x_document_package_workflow

- Purpose: Class X Document Package Workflow.
- Tables created: `ClassXDocumentPackage`, `ClassXPackageCharge`, `ClassXPackageChargeRule`, `ClassXPackageDocumentItem`, `ClassXPackageEvent`, `ClassXPackageHandover`, `ClassXPackageTemplate`.
- Tables altered: None.
- Indexes and named constraints: `ClassXDocumentPackage_academicYear_status_idx`, `ClassXDocumentPackage_applicantGuardianId_createdAt_idx`, `ClassXDocumentPackage_packageNumber_key`, `ClassXDocumentPackage_requestSource_createdAt_idx`, `ClassXDocumentPackage_studentId_createdAt_idx`, `ClassXDocumentPackage_studentId_fkey`, `ClassXDocumentPackage_templateId_fkey`, `ClassXPackageChargeRule_academicYear_packageType_status_idx`, `ClassXPackageChargeRule_ruleCode_key`, `ClassXPackageChargeRule_status_effectiveFrom_effectiveTo_idx`, `ClassXPackageCharge_chargeCode_key`, `ClassXPackageCharge_chargeRuleId_fkey`, `ClassXPackageCharge_chargeRuleId_idx`, `ClassXPackageCharge_linkedMiscIncomeReceiptId_fkey`, `ClassXPackageCharge_linkedMiscIncomeReceiptId_key`, `ClassXPackageCharge_packageId_fkey`, `ClassXPackageCharge_packageId_key`, `ClassXPackageCharge_status_createdAt_idx`, `ClassXPackageDocumentItem_itemType_status_idx`, `ClassXPackageDocumentItem_linkedStudentCertificateId_idx`, `ClassXPackageDocumentItem_linkedStudentCertificateVersionId_idx`, `ClassXPackageDocumentItem_packageId_fkey`, `ClassXPackageDocumentItem_packageId_itemKey_key`, `ClassXPackageDocumentItem_packageId_status_idx`, `ClassXPackageEvent_chargeId_idx`, `ClassXPackageEvent_documentItemId_idx`, `ClassXPackageEvent_eventType_eventDate_idx`, `ClassXPackageEvent_handoverId_idx`, `ClassXPackageEvent_packageId_eventDate_idx`, `ClassXPackageEvent_packageId_fkey`, `ClassXPackageHandover_handoverNumber_key`, `ClassXPackageHandover_packageId_fkey`, `ClassXPackageHandover_packageId_handoverDate_idx`, `ClassXPackageTemplate_academicYear_status_idx`, `ClassXPackageTemplate_packageType_status_idx`, `ClassXPackageTemplate_templateCode_key`.
- Dependencies: `MiscIncomeReceipt`, `Student`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `47D7A34CD8861C5BE704CD353D846A690555602ED85BED49D20D70CC8F3ABBE4`.

### 20260717_in_app_notification_centre

- Purpose: In App Notification Centre.
- Tables created: `NotificationCampaign`, `NotificationEvent`, `NotificationRecipient`, `NotificationSkippedRecipient`, `NotificationTemplate`.
- Tables altered: None.
- Indexes and named constraints: `NotificationCampaign_audienceType_idx`, `NotificationCampaign_campaignNumber_key`, `NotificationCampaign_category_priority_idx`, `NotificationCampaign_correctionOfCampaignId_fkey`, `NotificationCampaign_correctionOfCampaignId_key`, `NotificationCampaign_createdByUserId_createdAt_idx`, `NotificationCampaign_expiresAt_idx`, `NotificationCampaign_status_scheduledFor_idx`, `NotificationCampaign_templateId_fkey`, `NotificationEvent_campaignId_eventDate_idx`, `NotificationEvent_campaignId_fkey`, `NotificationEvent_eventType_eventDate_idx`, `NotificationEvent_recipientId_eventDate_idx`, `NotificationEvent_recipientId_fkey`, `NotificationEvent_templateId_eventDate_idx`, `NotificationEvent_templateId_fkey`, `NotificationRecipient_campaignId_acknowledgedAt_idx`, `NotificationRecipient_campaignId_fkey`, `NotificationRecipient_campaignId_readAt_idx`, `NotificationRecipient_campaignId_userId_key`, `NotificationRecipient_userId_deliveryStatus_availableAt_idx`, `NotificationRecipient_userId_fkey`, `NotificationSkippedRecipient_campaignId_fkey`, `NotificationSkippedRecipient_campaignId_reasonCode_idx`, `NotificationTemplate_createdAt_idx`, `NotificationTemplate_status_category_idx`, `NotificationTemplate_templateCode_key`.
- Dependencies: `User`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `4D9BD78557A9E83FBBFE6B86255E146B5856A33CBDF3C1ED937E8904E189E3E1`.

### 20260717_student_certificates_foundation

- Purpose: Student Certificates Foundation.
- Tables created: `CertificateNumberSeries`, `CertificateTemplate`, `StudentCertificate`, `StudentCertificateEvent`, `StudentCertificateRequest`, `StudentCertificateVersion`.
- Tables altered: None.
- Indexes and named constraints: `CertificateNumberSeries_certificateType_academicYear_status_idx`, `CertificateNumberSeries_seriesCode_key`, `CertificateTemplate_certificateType_academicYear_status_idx`, `CertificateTemplate_templateCode_key`, `StudentCertificateEvent_certificateId_eventDate_idx`, `StudentCertificateEvent_requestId_eventDate_idx`, `StudentCertificateEvent_versionId_idx`, `StudentCertificateRequest_academicYear_certificateType_status_idx`, `StudentCertificateRequest_applicantGuardianId_createdAt_idx`, `StudentCertificateRequest_requestNumber_key`, `StudentCertificateRequest_studentId_createdAt_idx`, `StudentCertificateVersion_certificateId_versionNumber_key`, `StudentCertificateVersion_certificateNumber_idx`, `StudentCertificateVersion_supersedesVersionId_idx`, `StudentCertificate_academicYear_certificateType_status_idx`, `StudentCertificate_certificateNumber_key`, `StudentCertificate_requestId_idx`, `StudentCertificate_studentId_createdAt_idx`, `StudentCertificate_templateId_idx`.
- Dependencies: None.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `8EB8A44A8D2EF56F4098A7F6931C77CF909020824A7767DA6FF06A655DC4998F`.

### 20260717_teacher_performance_analytics_foundation

- Purpose: Teacher Performance Analytics Foundation.
- Tables created: `TeacherAnalyticsEvent`, `TeacherAnalyticsReview`, `TeacherAnalyticsReviewCycle`, `TeacherAnalyticsSnapshot`.
- Tables altered: None.
- Indexes and named constraints: `TeacherAnalyticsEvent_eventType_idx`, `TeacherAnalyticsEvent_reviewCycleId_eventDate_idx`, `TeacherAnalyticsEvent_reviewCycleId_fkey`, `TeacherAnalyticsEvent_reviewId_fkey`, `TeacherAnalyticsEvent_reviewId_idx`, `TeacherAnalyticsEvent_snapshotId_fkey`, `TeacherAnalyticsEvent_snapshotId_idx`, `TeacherAnalyticsReviewCycle_academicYear_status_idx`, `TeacherAnalyticsReviewCycle_cycleCode_key`, `TeacherAnalyticsReviewCycle_periodStart_periodEnd_idx`, `TeacherAnalyticsReview_nextReviewDate_idx`, `TeacherAnalyticsReview_snapshotId_fkey`, `TeacherAnalyticsReview_snapshotId_key`, `TeacherAnalyticsReview_status_idx`, `TeacherAnalyticsSnapshot_reviewCycleId_fkey`, `TeacherAnalyticsSnapshot_reviewCycleId_staffMemberId_key`, `TeacherAnalyticsSnapshot_snapshotHash_idx`, `TeacherAnalyticsSnapshot_staffMemberId_academicYear_idx`, `TeacherAnalyticsSnapshot_staffMemberId_fkey`.
- Dependencies: `StaffMember`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `D0CC708A5BC684A47FEBC3E63E28F0481BA1BCF41DEED665FBE65F29C0F4A94B`.

### 20260717_virtual_identity_cards

- Purpose: Virtual Identity Cards.
- Tables created: `IdentityCard`, `IdentityCardBatch`, `IdentityCardEvent`, `IdentityCardNumberSeries`, `IdentityCardTemplate`, `IdentityCardVersion`.
- Tables altered: None.
- Indexes and named constraints: `IdentityCardBatch_batchNumber_key`, `IdentityCardBatch_cardType_academicYear_status_idx`, `IdentityCardBatch_templateId_fkey`, `IdentityCardBatch_templateId_idx`, `IdentityCardEvent_batchId_eventDate_idx`, `IdentityCardEvent_batchId_fkey`, `IdentityCardEvent_eventType_eventDate_idx`, `IdentityCardEvent_identityCardId_eventDate_idx`, `IdentityCardEvent_identityCardId_fkey`, `IdentityCardEvent_versionId_fkey`, `IdentityCardEvent_versionId_idx`, `IdentityCardNumberSeries_cardType_academicYear_status_idx`, `IdentityCardNumberSeries_seriesCode_key`, `IdentityCardTemplate_cardType_academicYear_status_idx`, `IdentityCardTemplate_templateCode_key`, `IdentityCardVersion_cardNumber_idx`, `IdentityCardVersion_identityCardId_fkey`, `IdentityCardVersion_identityCardId_versionNumber_key`, `IdentityCardVersion_supersedesVersionId_idx`, `IdentityCard_batchId_fkey`, `IdentityCard_batchId_idx`, `IdentityCard_cardNumber_key`, `IdentityCard_cardType_academicYear_status_idx`, `IdentityCard_numberSeriesId_fkey`, `IdentityCard_numberSeriesId_idx`, `IdentityCard_replacesCardId_fkey`, `IdentityCard_replacesCardId_key`, `IdentityCard_staffMemberId_academicYear_status_idx`, `IdentityCard_staffMemberId_fkey`, `IdentityCard_studentId_academicYear_status_idx`, `IdentityCard_studentId_fkey`, `IdentityCard_templateId_fkey`, `IdentityCard_templateId_idx`.
- Dependencies: `StaffMember`, `Student`.
- Missing at this point in the historical chain: `Student`.
- Assumes prior data: No.
- Safe on an empty database in recorded order: No.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `CF73930260DA1DBF9A2906182FFFF76349F7789C875BC888E420077550A20EBE`.

### 20260717_whatsapp_business_one_way_foundation

- Purpose: Whatsapp Business One Way Foundation.
- Tables created: `WhatsAppConsent`, `WhatsAppConsentEvent`, `WhatsAppDelivery`, `WhatsAppDeliveryAttempt`, `WhatsAppIntegrationProfile`, `WhatsAppOutboundBatch`, `WhatsAppRateReference`, `WhatsAppTemplateMapping`, `WhatsAppWebhookEvent`.
- Tables altered: None.
- Indexes and named constraints: `WhatsAppConsentEvent_consentId_eventDate_idx`, `WhatsAppConsentEvent_consentId_fkey`, `WhatsAppConsentEvent_eventType_eventDate_idx`, `WhatsAppConsent_guardianId_fkey`, `WhatsAppConsent_phoneHash_status_idx`, `WhatsAppConsent_staffMemberId_fkey`, `WhatsAppConsent_subjectType_guardianId_status_idx`, `WhatsAppConsent_subjectType_staffMemberId_status_idx`, `WhatsAppDeliveryAttempt_deliveryId_attemptNumber_key`, `WhatsAppDeliveryAttempt_deliveryId_fkey`, `WhatsAppDeliveryAttempt_providerMessageId_idx`, `WhatsAppDeliveryAttempt_resultStatus_retryable_idx`, `WhatsAppDelivery_batchId_fkey`, `WhatsAppDelivery_batchId_status_idx`, `WhatsAppDelivery_batchId_subjectType_subjectReferenceId_key`, `WhatsAppDelivery_phoneHash_idx`, `WhatsAppDelivery_providerMessageId_key`, `WhatsAppDelivery_requestFingerprint_key`, `WhatsAppDelivery_status_nextAttemptAt_idx`, `WhatsAppIntegrationProfile_liveSendingEnabled_idx`, `WhatsAppIntegrationProfile_mode_status_idx`, `WhatsAppIntegrationProfile_profileCode_key`, `WhatsAppOutboundBatch_batchNumber_key`, `WhatsAppOutboundBatch_integrationProfileId_createdAt_idx`, `WhatsAppOutboundBatch_integrationProfileId_fkey`, `WhatsAppOutboundBatch_notificationCampaignId_fkey`, `WhatsAppOutboundBatch_notificationCampaignId_idx`, `WhatsAppOutboundBatch_status_scheduledFor_idx`, `WhatsAppOutboundBatch_templateMappingId_fkey`, `WhatsAppRateReference_effectiveDate_idx`, `WhatsAppRateReference_integrationProfileId_fkey`, `WhatsAppRateReference_market_templateCategory_status_idx`, `WhatsAppRateReference_rateVersion_market_templateCategory_currency_key`, `WhatsAppTemplateMapping_integrationProfileId_fkey`, `WhatsAppTemplateMapping_integrationProfileId_status_idx`, `WhatsAppTemplateMapping_mappingCode_key`, `WhatsAppTemplateMapping_notificationCategory_status_idx`, `WhatsAppTemplateMapping_providerStatus_idx`, `WhatsAppWebhookEvent_deliveryId_fkey`, `WhatsAppWebhookEvent_deliveryId_receivedAt_idx`, `WhatsAppWebhookEvent_eventKey_key`, `WhatsAppWebhookEvent_integrationProfileId_fkey`, `WhatsAppWebhookEvent_integrationProfileId_receivedAt_idx`, `WhatsAppWebhookEvent_processingStatus_receivedAt_idx`, `WhatsAppWebhookEvent_providerMessageId_idx`.
- Dependencies: `Guardian`, `NotificationCampaign`, `StaffMember`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `90293B72BED58E6022BA9761F15BDFEAD3B8EEE7203BA88B725544E965A40922`.

### 20260718_ai_assistant_read_only_foundation

- Purpose: Ai Assistant Read Only Foundation.
- Tables created: `AiAssistantEvaluationCase`, `AiAssistantEvaluationRun`, `AiAssistantProfile`, `AiAssistantQueryAudit`, `AiAssistantSafetyEvent`, `AiAssistantSourcePolicy`.
- Tables altered: None.
- Indexes and named constraints: `AiAssistantEvaluationCase_caseCode_key`, `AiAssistantEvaluationCase_category_status_idx`, `AiAssistantEvaluationRun_profileId_createdAt_idx`, `AiAssistantEvaluationRun_runNumber_key`, `AiAssistantProfile_liveUseEnabled_idx`, `AiAssistantProfile_profileCode_key`, `AiAssistantProfile_providerKind_status_idx`, `AiAssistantQueryAudit_assistantProfileId_createdAt_idx`, `AiAssistantQueryAudit_requestId_key`, `AiAssistantQueryAudit_safetyDecision_createdAt_idx`, `AiAssistantQueryAudit_userId_createdAt_idx`, `AiAssistantSafetyEvent_eventType_createdAt_idx`, `AiAssistantSafetyEvent_queryAuditId_createdAt_idx`, `AiAssistantSourcePolicy_enabled_sourceType_idx`, `AiAssistantSourcePolicy_policyCode_key`, `AiAssistantSourcePolicy_sourceType_sourceKey_key`.
- Dependencies: None.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `E5279248AAB88021E9A209F5D505C32649A94DFDF40CE220D4EA6FE997F6CD9C`.

### 20260718_sms_email_one_way_foundation

- Purpose: Sms Email One Way Foundation.
- Tables created: `SmsEmailConsent`, `SmsEmailConsentEvent`, `SmsEmailCostRate`, `SmsEmailDelivery`, `SmsEmailDeliveryAttempt`, `SmsEmailIntegrationProfile`, `SmsEmailOperationalEvent`, `SmsEmailOutboundBatch`, `SmsEmailSuppression`, `SmsEmailTemplateMapping`, `SmsEmailWebhookEvent`.
- Tables altered: None.
- Indexes and named constraints: `SmsEmailConsentEvent_consentId_eventDate_idx`, `SmsEmailConsentEvent_consentId_fkey`, `SmsEmailConsentEvent_eventType_eventDate_idx`, `SmsEmailConsent_channel_contactHash_status_idx`, `SmsEmailConsent_channel_subjectType_guardianId_status_idx`, `SmsEmailConsent_channel_subjectType_staffMemberId_status_idx`, `SmsEmailConsent_guardianId_fkey`, `SmsEmailConsent_staffMemberId_fkey`, `SmsEmailCostRate_channel_providerKind_market_messageCategory_encodingType_currency_rateVersion_key`, `SmsEmailCostRate_channel_status_effectiveFrom_idx`, `SmsEmailCostRate_integrationProfileId_fkey`, `SmsEmailDeliveryAttempt_deliveryId_attemptNumber_key`, `SmsEmailDeliveryAttempt_deliveryId_fkey`, `SmsEmailDeliveryAttempt_providerMessageId_idx`, `SmsEmailDeliveryAttempt_result_idx`, `SmsEmailDelivery_batchId_fkey`, `SmsEmailDelivery_batchId_status_idx`, `SmsEmailDelivery_batchId_subjectType_guardianId_staffMemberId_contactHash_key`, `SmsEmailDelivery_channel_contactHash_idx`, `SmsEmailDelivery_channel_status_nextRetryAt_idx`, `SmsEmailDelivery_consentId_fkey`, `SmsEmailDelivery_guardianId_fkey`, `SmsEmailDelivery_notificationRecipientId_fkey`, `SmsEmailDelivery_providerMessageId_key`, `SmsEmailDelivery_requestFingerprint_key`, `SmsEmailDelivery_staffMemberId_fkey`, `SmsEmailIntegrationProfile_channel_liveSendingEnabled_idx`, `SmsEmailIntegrationProfile_channel_mode_status_idx`, `SmsEmailIntegrationProfile_profileCode_key`, `SmsEmailOperationalEvent_batchId_createdAt_idx`, `SmsEmailOperationalEvent_batchId_fkey`, `SmsEmailOperationalEvent_eventKey_key`, `SmsEmailOperationalEvent_eventType_createdAt_idx`, `SmsEmailOperationalEvent_integrationProfileId_createdAt_idx`, `SmsEmailOperationalEvent_integrationProfileId_fkey`, `SmsEmailOutboundBatch_batchNumber_key`, `SmsEmailOutboundBatch_channel_status_scheduledFor_idx`, `SmsEmailOutboundBatch_integrationProfileId_createdAt_idx`, `SmsEmailOutboundBatch_integrationProfileId_fkey`, `SmsEmailOutboundBatch_notificationCampaignId_fkey`, `SmsEmailOutboundBatch_notificationCampaignId_idx`, `SmsEmailOutboundBatch_templateMappingId_fkey`, `SmsEmailSuppression_channel_contactHash_status_idx`, `SmsEmailSuppression_guardianId_fkey`, `SmsEmailSuppression_staffMemberId_fkey`, `SmsEmailSuppression_subjectType_guardianId_status_idx`, `SmsEmailSuppression_subjectType_staffMemberId_status_idx`, `SmsEmailTemplateMapping_channel_notificationCategory_status_idx`, `SmsEmailTemplateMapping_integrationProfileId_fkey`, `SmsEmailTemplateMapping_integrationProfileId_status_idx`, `SmsEmailTemplateMapping_mappingCode_key`, `SmsEmailTemplateMapping_providerStatus_idx`, `SmsEmailWebhookEvent_deliveryId_fkey`, `SmsEmailWebhookEvent_deliveryId_receivedAt_idx`, `SmsEmailWebhookEvent_integrationProfileId_fkey`, `SmsEmailWebhookEvent_integrationProfileId_receivedAt_idx`, `SmsEmailWebhookEvent_providerEventKey_key`, `SmsEmailWebhookEvent_providerMessageId_idx`.
- Dependencies: `Guardian`, `NotificationCampaign`, `NotificationRecipient`, `StaffMember`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `CF0240BCBBF8A22220D495D00D501DDCB01E859FCAB86805D1A56F948480156E`.

### 20260718_whatsapp_release_blockers_recovery

- Purpose: Whatsapp Release Blockers Recovery.
- Tables created: `WhatsAppOperationalEvent`.
- Tables altered: `WhatsAppIntegrationProfile`, `WhatsAppOutboundBatch`, `WhatsAppWebhookEvent`.
- Indexes and named constraints: `WhatsAppOperationalEvent_batchId_createdAt_idx`, `WhatsAppOperationalEvent_batchId_fkey`, `WhatsAppOperationalEvent_eventKey_key`, `WhatsAppOperationalEvent_eventType_createdAt_idx`, `WhatsAppOperationalEvent_integrationProfileId_createdAt_idx`, `WhatsAppOperationalEvent_integrationProfileId_fkey`.
- Dependencies: `WhatsAppIntegrationProfile`, `WhatsAppOutboundBatch`, `WhatsAppWebhookEvent`.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `608B8B987ECE24A9ACE5E5A1D28E4B2912E6C20775D88355F14D4D8E5CC8E59F`.

### 20260719_cloud_backup_disaster_recovery

- Purpose: Cloud Backup Disaster Recovery.
- Tables created: `CloudBackupArtifact`, `CloudBackupEvent`, `CloudBackupProfile`, `CloudBackupRestoreRehearsal`, `CloudBackupRetentionPolicy`, `CloudBackupRun`, `CloudBackupSchedule`, `CloudBackupVerification`.
- Tables altered: None.
- Indexes and named constraints: `CloudBackupArtifact_runId_artifactType_key`, `CloudBackupArtifact_runId_fkey`, `CloudBackupArtifact_runId_objectKeySafe_key`, `CloudBackupArtifact_status_verifiedAt_idx`, `CloudBackupEvent_artifactId_fkey`, `CloudBackupEvent_eventType_eventDate_idx`, `CloudBackupEvent_profileId_eventDate_idx`, `CloudBackupEvent_profileId_fkey`, `CloudBackupEvent_rehearsalId_fkey`, `CloudBackupEvent_runId_eventDate_idx`, `CloudBackupEvent_runId_fkey`, `CloudBackupEvent_scheduleId_fkey`, `CloudBackupProfile_profileCode_key`, `CloudBackupProfile_providerKind_status_idx`, `CloudBackupProfile_status_liveUseEnabled_idx`, `CloudBackupRestoreRehearsal_artifactId_createdAt_idx`, `CloudBackupRestoreRehearsal_artifactId_fkey`, `CloudBackupRestoreRehearsal_rehearsalNumber_key`, `CloudBackupRestoreRehearsal_runId_fkey`, `CloudBackupRestoreRehearsal_status_createdAt_idx`, `CloudBackupRetentionPolicy_policyCode_key`, `CloudBackupRetentionPolicy_profileId_fkey`, `CloudBackupRetentionPolicy_profileId_key`, `CloudBackupRun_idempotencyKey_key`, `CloudBackupRun_profileId_fkey`, `CloudBackupRun_profileId_status_createdAt_idx`, `CloudBackupRun_runNumber_key`, `CloudBackupRun_scheduleId_fkey`, `CloudBackupRun_scheduleId_scheduledDueAt_idx`, `CloudBackupRun_status_nextRetryAt_idx`, `CloudBackupSchedule_enabled_nextRunAt_idx`, `CloudBackupSchedule_profileId_enabled_idx`, `CloudBackupSchedule_profileId_fkey`, `CloudBackupSchedule_scheduleCode_key`, `CloudBackupVerification_artifactId_checkedAt_idx`, `CloudBackupVerification_artifactId_fkey`, `CloudBackupVerification_runId_checkedAt_idx`, `CloudBackupVerification_runId_fkey`, `CloudBackupVerification_status_verificationType_idx`.
- Dependencies: None.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `3E918E164F2B8A8BC7DD803B83C88F1D6B31DA4ED7B5BFC7B3DF002C21E1EF99`.

### 20260719_handwritten_fee_register_ocr

- Purpose: Handwritten Fee Register Ocr.
- Tables created: `FeeRegisterOcrBatch`, `FeeRegisterOcrEvent`, `FeeRegisterOcrPage`, `FeeRegisterOcrPostingRun`, `FeeRegisterOcrProfile`, `FeeRegisterOcrRow`, `FeeRegisterOcrRowRevision`.
- Tables altered: None.
- Indexes and named constraints: `FeeRegisterOcrBatch_academicYear_status_idx`, `FeeRegisterOcrBatch_batchNumber_key`, `FeeRegisterOcrBatch_profileId_createdAt_idx`, `FeeRegisterOcrBatch_profileId_fkey`, `FeeRegisterOcrEvent_batchId_createdAt_idx`, `FeeRegisterOcrEvent_batchId_fkey`, `FeeRegisterOcrEvent_eventType_createdAt_idx`, `FeeRegisterOcrEvent_rowId_createdAt_idx`, `FeeRegisterOcrPage_batchId_fkey`, `FeeRegisterOcrPage_batchId_pageNumber_key`, `FeeRegisterOcrPage_batchId_status_idx`, `FeeRegisterOcrPage_sourceSha256_idx`, `FeeRegisterOcrPostingRun_batchId_createdAt_idx`, `FeeRegisterOcrPostingRun_batchId_fkey`, `FeeRegisterOcrPostingRun_runNumber_key`, `FeeRegisterOcrPostingRun_status_idx`, `FeeRegisterOcrProfile_paymentPostingEnabled_idx`, `FeeRegisterOcrProfile_profileCode_key`, `FeeRegisterOcrProfile_providerKind_status_idx`, `FeeRegisterOcrRowRevision_rowId_createdAt_idx`, `FeeRegisterOcrRowRevision_rowId_fkey`, `FeeRegisterOcrRowRevision_rowId_revisionNumber_key`, `FeeRegisterOcrRow_handwrittenReceiptReference_idx`, `FeeRegisterOcrRow_matchedStudentId_paymentDate_amountMinor_idx`, `FeeRegisterOcrRow_pageId_fkey`, `FeeRegisterOcrRow_pageId_rowNumber_key`, `FeeRegisterOcrRow_postedPaymentId_key`, `FeeRegisterOcrRow_status_idx`.
- Dependencies: None.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `75FF4BED30E04A0EDFD47F51326AC680E97D1EC52861DE16CA2C553819B09E22`.

### 20260719_premium_public_website_foundation

- Purpose: Premium Public Website Foundation.
- Tables created: `PublicWebsiteEvent`, `PublicWebsiteNavigationItem`, `PublicWebsitePage`, `PublicWebsitePageVersion`, `PublicWebsitePost`, `PublicWebsitePostVersion`, `PublicWebsiteSettings`.
- Tables altered: None.
- Indexes and named constraints: `PublicWebsiteEvent_entityType_entityId_eventDate_idx`, `PublicWebsiteEvent_eventType_eventDate_idx`, `PublicWebsiteNavigationItem_itemCode_key`, `PublicWebsiteNavigationItem_pageId_fkey`, `PublicWebsiteNavigationItem_pageId_idx`, `PublicWebsiteNavigationItem_placement_enabled_displayOrder_idx`, `PublicWebsitePageVersion_contentHash_idx`, `PublicWebsitePageVersion_pageId_fkey`, `PublicWebsitePageVersion_pageId_versionNumber_key`, `PublicWebsitePageVersion_slugSnapshot_publishedAt_idx`, `PublicWebsitePage_pageCode_key`, `PublicWebsitePage_showInNavigation_navigationOrder_idx`, `PublicWebsitePage_slug_key`, `PublicWebsitePage_status_pageType_idx`, `PublicWebsitePostVersion_contentHash_idx`, `PublicWebsitePostVersion_postId_fkey`, `PublicWebsitePostVersion_postId_versionNumber_key`, `PublicWebsitePostVersion_slugSnapshot_publishedAt_idx`, `PublicWebsitePost_featured_publishedAt_idx`, `PublicWebsitePost_postNumber_key`, `PublicWebsitePost_slug_key`, `PublicWebsitePost_status_postType_publishAt_idx`, `PublicWebsiteSettings_settingsCode_key`, `PublicWebsiteSettings_status_publishedAt_idx`.
- Dependencies: None.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `4D3C73D2F24C9DDC18EA842599270194066BD4B6358F87F46A6A62ACE26B7E09`.

### 20260720_public_website_foundation

- Purpose: Public Website Foundation.
- Tables created: `PublicWebsiteEvent`, `PublicWebsiteNavigationItem`, `PublicWebsitePage`, `PublicWebsitePageVersion`, `PublicWebsitePost`, `PublicWebsitePostVersion`, `PublicWebsiteSettings`.
- Tables altered: None.
- Indexes and named constraints: `PublicWebsiteEvent_entityType_entityId_eventDate_idx`, `PublicWebsiteEvent_eventType_eventDate_idx`, `PublicWebsiteNavigationItem_itemCode_key`, `PublicWebsiteNavigationItem_pageId_fkey`, `PublicWebsiteNavigationItem_pageId_idx`, `PublicWebsiteNavigationItem_placement_enabled_displayOrder_idx`, `PublicWebsitePageVersion_contentHash_idx`, `PublicWebsitePageVersion_pageId_fkey`, `PublicWebsitePageVersion_pageId_versionNumber_key`, `PublicWebsitePageVersion_slugSnapshot_publishedAt_idx`, `PublicWebsitePage_pageCode_key`, `PublicWebsitePage_showInNavigation_navigationOrder_idx`, `PublicWebsitePage_slug_key`, `PublicWebsitePage_status_pageType_idx`, `PublicWebsitePostVersion_contentHash_idx`, `PublicWebsitePostVersion_postId_fkey`, `PublicWebsitePostVersion_postId_versionNumber_key`, `PublicWebsitePostVersion_slugSnapshot_publishedAt_idx`, `PublicWebsitePost_featured_publishedAt_idx`, `PublicWebsitePost_postNumber_key`, `PublicWebsitePost_slug_key`, `PublicWebsitePost_status_postType_publishAt_idx`, `PublicWebsiteSettings_settingsCode_key`, `PublicWebsiteSettings_status_publishedAt_idx`.
- Dependencies: None.
- Missing at this point in the historical chain: None.
- Assumes prior data: No.
- Safe on an empty database in recorded order: Yes.
- Operational _prisma_migrations status: Not recorded; the verified operational database had no _prisma_migrations table.
- migration.sql SHA-256: `F6509CA311192626DE90393205DFEBDFD4617D2B26CB0034AB63416025F4C154`.
