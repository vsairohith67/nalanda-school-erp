export const ROLES = [
  "SUPER_ADMIN",
  "DIRECTOR",
  "PRINCIPAL",
  "ADMIN",
  "ACCOUNTANT",
  "TEACHER",
  "PARENT",
  "VIEWER"
] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "VIEW_DASHBOARD",
  "VIEW_STUDENTS",
  "CREATE_STUDENTS",
  "EDIT_STUDENTS",
  "EXPORT_STUDENTS",
  "IMPORT_STUDENTS",
  "VIEW_STUDENT_LIFECYCLE",
  "MANAGE_STUDENT_LIFECYCLE",
  "VIEW_ACADEMIC_YEAR_ENROLLMENTS",
  "MANAGE_ACADEMIC_YEAR_ENROLLMENTS",
  "VIEW_STUDENT_PROGRESSION",
  "MANAGE_STUDENT_PROGRESSION",
  "APPROVE_STUDENT_PROGRESSION",
  "FINALIZE_STUDENT_PROGRESSION",
  "VIEW_STUDENT_PROGRESSION_REPORTS",
  "VIEW_UDISE_CHECKLIST",
  "EXPORT_UDISE_CHECKLIST",
  "VIEW_GUARDIANS",
  "MANAGE_GUARDIANS",
  "IMPORT_GUARDIANS",
  "VIEW_PARENT_PLACEHOLDER",
  "VIEW_STAFF",
  "MANAGE_STAFF",
  "IMPORT_STAFF",
  "VIEW_TEACHER_PLACEHOLDER",
  "VIEW_STUDENT_ATTENDANCE",
  "MANAGE_STUDENT_ATTENDANCE",
  "SUBMIT_STUDENT_ATTENDANCE",
  "LOCK_STUDENT_ATTENDANCE",
  "VIEW_STUDENT_ATTENDANCE_REPORTS",
  "VIEW_STAFF_ATTENDANCE",
  "MANAGE_STAFF_ATTENDANCE",
  "SUBMIT_STAFF_ATTENDANCE",
  "LOCK_STAFF_ATTENDANCE",
  "VIEW_STAFF_ATTENDANCE_REPORTS",
  "VIEW_STAFF_LEAVE",
  "APPLY_STAFF_LEAVE",
  "MANAGE_STAFF_LEAVE",
  "APPROVE_STAFF_LEAVE",
  "VIEW_STAFF_LEAVE_REPORTS",
  "VIEW_SUBSTITUTES",
  "MANAGE_SUBSTITUTES",
  "ASSIGN_SUBSTITUTES",
  "CONFIRM_SUBSTITUTES",
  "VIEW_SUBSTITUTE_REPORTS",
  "VIEW_NOTICES",
  "MANAGE_NOTICES",
  "PUBLISH_NOTICES",
  "VIEW_NOTIFICATION_CENTRE",
  "VIEW_OWN_NOTIFICATIONS",
  "MANAGE_NOTIFICATION_TEMPLATES",
  "CREATE_NOTIFICATION_CAMPAIGNS",
  "CREATE_SCOPED_NOTIFICATIONS",
  "REVIEW_NOTIFICATION_CAMPAIGNS",
  "APPROVE_NOTIFICATION_CAMPAIGNS",
  "SCHEDULE_NOTIFICATION_CAMPAIGNS",
  "PUBLISH_NOTIFICATION_CAMPAIGNS",
  "PUBLISH_EMERGENCY_NOTIFICATIONS",
  "WITHDRAW_NOTIFICATION_CAMPAIGNS",
  "VIEW_NOTIFICATION_REPORTS",
  "EXPORT_NOTIFICATION_REPORTS",
  "ACKNOWLEDGE_OWN_NOTIFICATIONS",
  "VIEW_WHATSAPP_CENTRE",
  "MANAGE_WHATSAPP_INTEGRATION",
  "MANAGE_WHATSAPP_CONSENTS",
  "MANAGE_WHATSAPP_TEMPLATE_MAPPINGS",
  "CREATE_WHATSAPP_BATCHES",
  "APPROVE_WHATSAPP_BATCHES",
  "SEND_WHATSAPP_BATCHES",
  "SCHEDULE_WHATSAPP_BATCHES",
  "RETRY_WHATSAPP_DELIVERIES",
  "CANCEL_WHATSAPP_BATCHES",
  "OVERRIDE_WHATSAPP_QUIET_HOURS",
  "OVERRIDE_WHATSAPP_COST_CAP",
  "PROCESS_WHATSAPP_QUEUE",
  "VIEW_WHATSAPP_DELIVERIES",
  "VIEW_WHATSAPP_REPORTS",
  "EXPORT_WHATSAPP_REPORTS",
  "MANAGE_OWN_WHATSAPP_CONSENT",
  "VIEW_SMS_EMAIL_CENTRE",
  "MANAGE_SMS_EMAIL_INTEGRATIONS",
  "MANAGE_SMS_EMAIL_CONSENTS",
  "MANAGE_SMS_EMAIL_TEMPLATES",
  "CREATE_SMS_EMAIL_BATCHES",
  "APPROVE_SMS_EMAIL_BATCHES",
  "SEND_SMS_EMAIL_BATCHES",
  "SCHEDULE_SMS_EMAIL_BATCHES",
  "RETRY_SMS_EMAIL_DELIVERIES",
  "CANCEL_SMS_EMAIL_BATCHES",
  "OVERRIDE_SMS_EMAIL_LIMITS",
  "PROCESS_SMS_EMAIL_QUEUE",
  "VIEW_SMS_EMAIL_DELIVERIES",
  "VIEW_SMS_EMAIL_REPORTS",
  "EXPORT_SMS_EMAIL_REPORTS",
  "MANAGE_OWN_SMS_EMAIL_CONSENT",
  "VIEW_HOMEWORK",
  "MANAGE_HOMEWORK",
  "PUBLISH_HOMEWORK",
  "ARCHIVE_HOMEWORK",
  "VIEW_HOMEWORK_REPORTS",
  "EXPORT_HOMEWORK_REPORTS",
  "VIEW_OWN_HOMEWORK_PORTAL",
  "VIEW_EXAMS",
  "MANAGE_EXAMS",
  "CONFIGURE_EXAM_ASSESSMENTS",
  "ENTER_MARKS",
  "SUBMIT_MARKS",
  "APPROVE_MARKS",
  "LOCK_EXAMS",
  "CORRECT_APPROVED_MARKS",
  "VIEW_EXAM_REPORTS",
  "EXPORT_EXAM_REPORTS",
  "VIEW_EXAM_CONFIGURATION",
  "MANAGE_EXAM_CONFIGURATION",
  "ACTIVATE_EXAM_SCHEMES",
  "ASSIGN_EXAM_TEACHERS",
  "PROPOSE_EXAM_SCHEMES",
  "VIEW_OWN_EXAM_ASSIGNMENTS",
  "INTERVENE_EXAM_SCHEMES",
  "VIEW_OWN_EXAM_MARKS",
  "ENTER_ASSIGNED_EXAM_MARKS",
  "SUBMIT_ASSIGNED_EXAM_MARKS",
  "REQUEST_EXAM_MARK_CORRECTION",
  "VIEW_EXAM_MODERATION",
  "MODERATE_EXAM_MARKS",
  "REOPEN_EXAM_MARK_SHEETS",
  "RUN_EXAM_CALCULATIONS",
  "LOCK_EXAM_CALCULATIONS",
  "INTERVENE_EXAM_MARKS",
  "VIEW_REPORT_CARDS",
  "MANAGE_REPORT_CARD_TEMPLATES",
  "MANAGE_REPORT_CARD_BATCHES",
  "ENTER_REPORT_CARD_DATA",
  "SUBMIT_REPORT_CARDS",
  "APPROVE_REPORT_CARDS",
  "ISSUE_REPORT_CARDS",
  "CORRECT_ISSUED_REPORT_CARDS",
  "VIEW_REPORT_CARD_REPORTS",
  "EXPORT_REPORT_CARD_REPORTS",
  "VIEW_OWN_REPORT_CARDS",
  "VIEW_CERTIFICATES",
  "MANAGE_CERTIFICATE_TEMPLATES",
  "MANAGE_CERTIFICATE_REQUESTS",
  "CREATE_CERTIFICATES",
  "REVIEW_CERTIFICATES",
  "APPROVE_CERTIFICATES",
  "ISSUE_CERTIFICATES",
  "CORRECT_ISSUED_CERTIFICATES",
  "CANCEL_ISSUED_CERTIFICATES",
  "VIEW_CERTIFICATE_REPORTS",
  "EXPORT_CERTIFICATE_REPORTS",
  "REQUEST_OWN_CHILD_CERTIFICATES",
  "VIEW_OWN_CHILD_CERTIFICATES",
  "VIEW_CLASS_X_PACKAGES",
  "MANAGE_CLASS_X_PACKAGES",
  "REVIEW_CLASS_X_PACKAGES",
  "APPROVE_CLASS_X_PACKAGES",
  "MANAGE_CLASS_X_DOCUMENT_CUSTODY",
  "CONFIGURE_CLASS_X_PACKAGE_TEMPLATES",
  "CONFIGURE_CLASS_X_PACKAGE_CHARGES",
  "APPROVE_CLASS_X_PACKAGE_CHARGES",
  "COLLECT_CLASS_X_PACKAGE_PAYMENTS",
  "WAIVE_CLASS_X_PACKAGE_CHARGES",
  "HANDOVER_CLASS_X_DOCUMENTS",
  "VIEW_CLASS_X_PACKAGE_REPORTS",
  "EXPORT_CLASS_X_PACKAGE_REPORTS",
  "REQUEST_OWN_CHILD_CLASS_X_PACKAGE",
  "VIEW_OWN_CHILD_CLASS_X_PACKAGE",
  "VIEW_ID_CARDS",
  "MANAGE_ID_CARD_TEMPLATES",
  "MANAGE_ID_CARD_NUMBER_SERIES",
  "CREATE_ID_CARDS",
  "MANAGE_ID_CARD_BATCHES",
  "APPROVE_ID_CARDS",
  "ISSUE_ID_CARDS",
  "CORRECT_ISSUED_ID_CARDS",
  "REPLACE_ID_CARDS",
  "REVOKE_ID_CARDS",
  "USE_ID_CARD_LOOKUP",
  "VIEW_ID_CARD_REPORTS",
  "EXPORT_ID_CARD_REPORTS",
  "VIEW_OWN_STUDENT_ID_CARDS",
  "VIEW_OWN_STAFF_ID_CARD",
  "VIEW_TEACHER_ANALYTICS",
  "VIEW_OWN_TEACHER_ANALYTICS",
  "MANAGE_TEACHER_ANALYTICS_CYCLES",
  "GENERATE_TEACHER_ANALYTICS_SNAPSHOTS",
  "REVIEW_TEACHER_ANALYTICS",
  "SHARE_TEACHER_ANALYTICS_REVIEW",
  "FINALISE_TEACHER_ANALYTICS_REVIEW",
  "VIEW_TEACHER_ANALYTICS_REPORTS",
  "EXPORT_TEACHER_ANALYTICS_REPORTS",
  "VIEW_FEE_STRUCTURES",
  "MANAGE_FEE_STRUCTURES",
  "VIEW_PAYMENTS",
  "CREATE_PAYMENTS",
  "EDIT_PAYMENTS",
  "CANCEL_PAYMENTS",
  "CANCEL_FINAL_RECEIPT",
  "CORRECT_FINAL_RECEIPT",
  "RESTORE_PAYMENTS",
  "VIEW_DAILY_COLLECTION",
  "VIEW_PENDING_DUES",
  "VIEW_LEDGER",
  "PRINT_RECEIPTS",
  "PRINT_LEDGER",
  "PRINT_REPORTS",
  "VIEW_RECEIPT_AUDIT",
  "MANAGE_RECEIPTS",
  "COMMUNICATE_PARENT",
  "EXPORT_PAYMENTS",
  "EXPORT_REPORTS",
  "EXPORT_REMINDERS",
  "VIEW_VENDORS",
  "MANAGE_VENDORS",
  "VIEW_EXPENSES",
  "MANAGE_EXPENSES",
  "APPROVE_EXPENSES",
  "MARK_EXPENSE_PAID",
  "CANCEL_EXPENSES",
  "VIEW_EXPENSE_REPORTS",
  "EXPORT_EXPENSE_REPORTS",
  "VIEW_BUDGETS",
  "MANAGE_BUDGETS",
  "APPROVE_BUDGETS",
  "LOCK_BUDGETS",
  "REVISE_BUDGETS",
  "VIEW_BUDGET_REPORTS",
  "EXPORT_BUDGET_REPORTS",
  "VIEW_MISC_INCOME",
  "MANAGE_MISC_INCOME",
  "CANCEL_MISC_INCOME",
  "MANAGE_MISC_INCOME_ITEMS",
  "VIEW_MISC_INCOME_REPORTS",
  "EXPORT_MISC_INCOME_REPORTS",
  "VIEW_BOOKS_FINANCE",
  "MANAGE_BOOK_CATALOG",
  "MANAGE_BOOK_RATES",
  "MANAGE_BOOK_SALES",
  "CANCEL_BOOK_SALES",
  "MANAGE_BOOK_CASH_SETTLEMENT",
  "SUBMIT_BOOK_CASH_SETTLEMENT",
  "APPROVE_BOOK_CASH_SETTLEMENT",
  "VIEW_BOOK_REPORTS",
  "EXPORT_BOOK_REPORTS",
  "MANAGE_PUBLISHER_BILLS",
  "VIEW_LIBRARY",
  "MANAGE_LIBRARY_CATALOG",
  "MANAGE_LIBRARY_COPIES",
  "IMPORT_LIBRARY_CATALOG",
  "VIEW_LIBRARY_REPORTS",
  "EXPORT_LIBRARY_REPORTS",
  "VIEW_LIBRARY_CIRCULATION",
  "MANAGE_LIBRARY_MEMBERS",
  "MANAGE_LIBRARY_POLICIES",
  "ISSUE_LIBRARY_BOOKS",
  "RETURN_LIBRARY_BOOKS",
  "RENEW_LIBRARY_BOOKS",
  "MANAGE_LIBRARY_RESERVATIONS",
  "VIEW_LIBRARY_CIRCULATION_REPORTS",
  "EXPORT_LIBRARY_CIRCULATION_REPORTS",
  "VIEW_LIBRARY_INCIDENTS",
  "MANAGE_LIBRARY_INCIDENTS",
  "APPROVE_LIBRARY_INCIDENTS",
  "VIEW_LIBRARY_CHARGES",
  "ASSESS_LIBRARY_CHARGES",
  "APPROVE_LIBRARY_CHARGES",
  "WAIVE_LIBRARY_CHARGES",
  "COLLECT_LIBRARY_CHARGES",
  "CANCEL_LIBRARY_CHARGES",
  "VIEW_LIBRARY_CHARGE_REPORTS",
  "EXPORT_LIBRARY_CHARGE_REPORTS",
  "VIEW_LIBRARY_BARCODES",
  "MANAGE_LIBRARY_BARCODES",
  "PRINT_LIBRARY_BARCODE_LABELS",
  "USE_LIBRARY_SCANNER",
  "VIEW_OWN_LIBRARY_PORTAL",
  "VIEW_LIBRARY_STOCK_VERIFICATION",
  "MANAGE_LIBRARY_STOCK_VERIFICATION",
  "SCAN_LIBRARY_STOCK",
  "REVIEW_LIBRARY_STOCK_DISCREPANCIES",
  "APPLY_LIBRARY_STOCK_CORRECTIONS",
  "APPROVE_LIBRARY_STOCK_VERIFICATION",
  "LOCK_LIBRARY_STOCK_VERIFICATION",
  "VIEW_LIBRARY_STOCK_REPORTS",
  "EXPORT_LIBRARY_STOCK_REPORTS",
  "VIEW_CASH_BOOK",
  "MANAGE_CASH_BOOK",
  "SUBMIT_CASH_BOOK",
  "APPROVE_CASH_BOOK",
  "LOCK_CASH_BOOK",
  "CANCEL_CASH_BOOK",
  "VIEW_CASH_BOOK_REPORTS",
  "EXPORT_CASH_BOOK_REPORTS",
  "VIEW_IMPORT_EXPORT",
  "RUN_IMPORTS",
  "VIEW_IMPORT_VERIFICATION",
  "RUN_PILOT_ACCEPTANCE",
  "VIEW_TIMETABLE",
  "MANAGE_TIMETABLE_MASTER",
  "MANAGE_TIMETABLE_ASSIGNMENTS",
  "MANAGE_TIMETABLE_BUILDER",
  "RUN_TIMETABLE_GENERATOR",
  "PRINT_TIMETABLE",
  "VIEW_USERS",
  "MANAGE_USERS",
  "RESET_USER_PASSWORDS",
  "MANAGE_ROLE_PERMISSIONS",
  "VIEW_SETTINGS",
  "MANAGE_SCHOOL_SETTINGS",
  "VIEW_SYSTEM_HEALTH",
  "RUN_BACKUP",
  "RUN_RESTORE",
  "VIEW_AI_ASSISTANT",
  "USE_AI_ASSISTANT_DOCUMENTATION",
  "USE_AI_ASSISTANT_AGGREGATES",
  "MANAGE_AI_ASSISTANT",
  "MANAGE_AI_ASSISTANT_SOURCES",
  "VIEW_AI_ASSISTANT_AUDIT",
  "RUN_AI_ASSISTANT_EVALUATIONS",
  "VIEW_FEE_REGISTER_OCR",
  "VIEW_FEE_REGISTER_OCR_IMAGES",
  "MANAGE_FEE_REGISTER_OCR_PROFILES",
  "UPLOAD_FEE_REGISTER_PAGES",
  "RUN_FEE_REGISTER_OCR",
  "REVIEW_FEE_REGISTER_OCR_ROWS",
  "APPROVE_FEE_REGISTER_OCR_BATCHES",
  "PREVIEW_FEE_REGISTER_OCR_POSTING",
  "POST_FEE_REGISTER_OCR_PAYMENTS",
  "RESOLVE_FEE_REGISTER_OCR_DUPLICATES",
  "PURGE_FEE_REGISTER_OCR_IMAGES",
  "VIEW_FEE_REGISTER_OCR_REPORTS",
  "EXPORT_FEE_REGISTER_OCR_REPORTS",
  "VIEW_CLOUD_BACKUP",
  "MANAGE_CLOUD_BACKUP_PROFILES",
  "MANAGE_CLOUD_BACKUP_SCHEDULES",
  "RUN_CLOUD_BACKUP",
  "VERIFY_CLOUD_BACKUP",
  "RUN_CLOUD_BACKUP_RESTORE_REHEARSAL",
  "MANAGE_CLOUD_BACKUP_RETENTION",
  "PURGE_CLOUD_BACKUPS",
  "ACTIVATE_LIVE_CLOUD_BACKUP",
  "CHANGE_CLOUD_BACKUP_KEY_VERSION",
  "VIEW_CLOUD_BACKUP_REPORTS",
  "EXPORT_CLOUD_BACKUP_REPORTS",
  "VIEW_PUBLIC_WEBSITE_ADMIN",
  "MANAGE_PUBLIC_WEBSITE_SETTINGS",
  "MANAGE_PUBLIC_WEBSITE_PAGES",
  "MANAGE_PUBLIC_WEBSITE_POSTS",
  "REVIEW_PUBLIC_WEBSITE_CONTENT",
  "PUBLISH_PUBLIC_WEBSITE_CONTENT",
  "MANAGE_PUBLIC_WEBSITE_NAVIGATION",
  "PREVIEW_PUBLIC_WEBSITE_DRAFTS",
  "VIEW_PUBLIC_WEBSITE_REPORTS",
  "EXPORT_PUBLIC_WEBSITE_REPORTS",
  "FIRST_RUN_SETUP"
] as const;

export type CanonicalPermission = (typeof PERMISSIONS)[number];

export const LEGACY_PERMISSION_ALIASES = {
  ADD_PAYMENT: "CREATE_PAYMENTS",
  EDIT_PAYMENT: "EDIT_PAYMENTS",
  CANCEL_PAYMENT: "CANCEL_PAYMENTS",
  RESTORE_PAYMENT: "RESTORE_PAYMENTS",
  VIEW_PENDING: "VIEW_PENDING_DUES",
  VIEW_REPORTS: "VIEW_DAILY_COLLECTION",
  VIEW_AUDIT: "VIEW_RECEIPT_AUDIT",
  MANAGE_FEES: "MANAGE_FEE_STRUCTURES",
  IMPORT_DATA: "RUN_IMPORTS",
  VIEW_PILOT_ACCEPTANCE: "RUN_PILOT_ACCEPTANCE",
  MANAGE_TIMETABLE: "MANAGE_TIMETABLE_BUILDER",
  EXPORT_FULL_BACKUP: "RUN_BACKUP",
  RESTORE_FULL_BACKUP: "RUN_RESTORE",
  PRINT_RECEIPT: "PRINT_RECEIPTS",
  PRINT_REPORT: "PRINT_REPORTS"
} as const;

export type LegacyPermission = keyof typeof LEGACY_PERMISSION_ALIASES;
export type Permission = CanonicalPermission | LegacyPermission;

export type PermissionGroup = {
  id: string;
  title: string;
  permissions: Array<{
    permission: CanonicalPermission;
    label: string;
    description: string;
  }>;
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    permissions: [
      { permission: "VIEW_DASHBOARD", label: "View dashboard", description: "Open the main fee-control dashboard." }
    ]
  },
  {
    id: "students",
    title: "Students",
    permissions: [
      { permission: "VIEW_STUDENTS", label: "View students", description: "Open the student list and student details." },
      { permission: "CREATE_STUDENTS", label: "Create students", description: "Add new student records." },
      { permission: "EDIT_STUDENTS", label: "Edit students", description: "Update existing student records." },
      { permission: "EXPORT_STUDENTS", label: "Export students", description: "Download student master CSV files." },
      { permission: "IMPORT_STUDENTS", label: "Import students", description: "Run student master imports." }
      ,{ permission: "VIEW_STUDENT_LIFECYCLE", label: "View student lifecycle", description: "View academic-year enrollment coverage and student lifecycle history." }
      ,{ permission: "MANAGE_STUDENT_LIFECYCLE", label: "Manage student lifecycle", description: "Record audited lifecycle history actions when a supported workflow is available." }
      ,{ permission: "VIEW_ACADEMIC_YEAR_ENROLLMENTS", label: "View academic-year enrollments", description: "View year-wise student class, section, roll number, and status history." }
      ,{ permission: "MANAGE_ACADEMIC_YEAR_ENROLLMENTS", label: "Manage academic-year enrollments", description: "Create safe academic-year enrollment records without overwriting prior years." }
      ,{ permission: "VIEW_STUDENT_PROGRESSION", label: "View student progression", description: "View promotion, repeat, transfer, left, and passed-out decisions." }
      ,{ permission: "MANAGE_STUDENT_PROGRESSION", label: "Manage student progression", description: "Create, edit, submit, and safely cancel progression decisions." }
      ,{ permission: "APPROVE_STUDENT_PROGRESSION", label: "Approve student progression", description: "Approve or reject submitted progression decisions." }
      ,{ permission: "FINALIZE_STUDENT_PROGRESSION", label: "Finalize student progression", description: "Confirm approved decisions in a transaction that preserves lifecycle history." }
      ,{ permission: "VIEW_STUDENT_PROGRESSION_REPORTS", label: "View progression reports", description: "Open read-only progression decision lists and summaries." }
      ,{ permission: "VIEW_UDISE_CHECKLIST", label: "View UDISE planning checklist", description: "Open the read-only student, staff, and school data-gap checklist." }
      ,{ permission: "EXPORT_UDISE_CHECKLIST", label: "Export UDISE planning checklist", description: "Download the internal checklist CSV; this is not an official UDISE+ export." }
    ]
  },
  {
    id: "guardians",
    title: "Parents and Guardians",
    permissions: [
      { permission: "VIEW_GUARDIANS", label: "View guardians", description: "Open parent/guardian records and linked children." },
      { permission: "MANAGE_GUARDIANS", label: "Manage guardians", description: "Create guardian records, edit details, and link students." },
      { permission: "IMPORT_GUARDIANS", label: "Import guardian links", description: "Preview and confirm guardian link imports." },
      { permission: "VIEW_PARENT_PLACEHOLDER", label: "View parent portal", description: "Open the read-only parent portal." }
    ]
  },
  {
    id: "staff",
    title: "Staff and Teachers",
    permissions: [
      { permission: "VIEW_STAFF", label: "View staff", description: "Open staff profiles and staff search." },
      { permission: "MANAGE_STAFF", label: "Manage staff", description: "Create and update staff profiles and optional account links." },
      { permission: "IMPORT_STAFF", label: "Import staff", description: "Preview and confirm staff master imports." },
      { permission: "VIEW_TEACHER_PLACEHOLDER", label: "View teacher portal", description: "Open the safe teacher placeholder and linked profile basics." }
    ]
  },
  {
    id: "attendance",
    title: "Student Attendance",
    permissions: [
      { permission: "VIEW_STUDENT_ATTENDANCE", label: "View student attendance", description: "Open daily student attendance sessions." },
      { permission: "MANAGE_STUDENT_ATTENDANCE", label: "Manage student attendance", description: "Create and edit draft student attendance." },
      { permission: "SUBMIT_STUDENT_ATTENDANCE", label: "Submit student attendance", description: "Mark a draft attendance session complete." },
      { permission: "LOCK_STUDENT_ATTENDANCE", label: "Lock student attendance", description: "Finalize a submitted attendance session and block edits." },
      { permission: "VIEW_STUDENT_ATTENDANCE_REPORTS", label: "View attendance reports", description: "Open and export student attendance reports." }
    ]
  },
  {
    id: "staff-attendance",
    title: "Staff Attendance",
    permissions: [
      { permission: "VIEW_STAFF_ATTENDANCE", label: "View staff attendance", description: "Open daily staff attendance sessions." },
      { permission: "MANAGE_STAFF_ATTENDANCE", label: "Manage staff attendance", description: "Create and edit draft staff attendance." },
      { permission: "SUBMIT_STAFF_ATTENDANCE", label: "Submit staff attendance", description: "Mark a draft staff attendance session complete." },
      { permission: "LOCK_STAFF_ATTENDANCE", label: "Lock staff attendance", description: "Finalize submitted staff attendance and block edits." },
      { permission: "VIEW_STAFF_ATTENDANCE_REPORTS", label: "View staff attendance reports", description: "Open and export official staff attendance reports." }
    ]
  },
  {
    id: "staff-leave",
    title: "Staff Leave",
    permissions: [
      { permission: "VIEW_STAFF_LEAVE", label: "View staff leave", description: "Open staff leave requests; teachers are restricted to their own linked profile." },
      { permission: "APPLY_STAFF_LEAVE", label: "Apply for staff leave", description: "Create, edit, submit, and safely cancel an own leave request." },
      { permission: "MANAGE_STAFF_LEAVE", label: "Manage staff leave", description: "Create and manage draft or pending leave on behalf of staff." },
      { permission: "APPROVE_STAFF_LEAVE", label: "Approve staff leave", description: "Approve or reject pending staff leave requests." },
      { permission: "VIEW_STAFF_LEAVE_REPORTS", label: "View staff leave reports", description: "Open and export staff leave reports." }
    ]
  },
  {
    id: "substitutes",
    title: "Substitute Teachers",
    permissions: [
      { permission: "VIEW_SUBSTITUTES", label: "View substitutes", description: "Open substitute assignments; teachers are restricted to their own duties." },
      { permission: "MANAGE_SUBSTITUTES", label: "Manage substitutes", description: "Create and edit draft substitute plans and cancel assignments." },
      { permission: "ASSIGN_SUBSTITUTES", label: "Assign substitutes", description: "Assign an available active staff member after review." },
      { permission: "CONFIRM_SUBSTITUTES", label: "Confirm substitutes", description: "Confirm and complete reviewed substitute duties." },
      { permission: "VIEW_SUBSTITUTE_REPORTS", label: "View substitute reports", description: "Open and export non-payroll substitute coverage reports." }
    ]
  },
  {
    id: "fees",
    title: "Fees and Payments",
    permissions: [
      { permission: "VIEW_FEE_STRUCTURES", label: "View fee structures", description: "Review configured class fee terms." },
      { permission: "MANAGE_FEE_STRUCTURES", label: "Manage fee structures", description: "Change fee amounts and due months." },
      { permission: "VIEW_PAYMENTS", label: "View payments", description: "Open payment entry history." },
      { permission: "CREATE_PAYMENTS", label: "Create payments", description: "Enter fee receipts and payment imports." },
      { permission: "EDIT_PAYMENTS", label: "Legacy payment edit", description: "Legacy compatibility permission; it does not authorize final-receipt correction." },
      { permission: "CANCEL_PAYMENTS", label: "Legacy payment cancellation", description: "Legacy compatibility permission; it does not authorize final-receipt cancellation." },
      { permission: "CANCEL_FINAL_RECEIPT", label: "Cancel final receipts", description: "Cancel every component of a final receipt with a required reason, version check, immutable audit, and locked-day protection." },
      { permission: "CORRECT_FINAL_RECEIPT", label: "Correct final receipts", description: "Record a non-financial correction or govern a financial correction through cancellation and linked reissue." },
      { permission: "RESTORE_PAYMENTS", label: "Restore payments", description: "Restore cancelled payment rows." },
      { permission: "VIEW_DAILY_COLLECTION", label: "View daily collection", description: "Open collection reports." },
      { permission: "VIEW_PENDING_DUES", label: "View pending dues", description: "Open pending-dues reports." },
      { permission: "VIEW_LEDGER", label: "View ledger", description: "Open student ledger search." },
      { permission: "PRINT_RECEIPTS", label: "Print receipts", description: "Print fee receipts." },
      { permission: "PRINT_LEDGER", label: "Print ledger", description: "Print student ledger pages." },
      { permission: "PRINT_REPORTS", label: "Print reports", description: "Print daily collection reports." },
      { permission: "VIEW_RECEIPT_AUDIT", label: "View receipt audit", description: "Open receipt and payment audit checks." },
      { permission: "MANAGE_RECEIPTS", label: "Manage receipt metadata", description: "Leadership-only receipt metadata permission; it cannot independently cancel a receipt." },
      { permission: "COMMUNICATE_PARENT", label: "Prepare parent reminders", description: "Prepare existing pending-dues reminder text." },
      { permission: "EXPORT_PAYMENTS", label: "Export payments", description: "Download payment CSV files." },
      { permission: "EXPORT_REPORTS", label: "Export reports", description: "Download report CSV files." },
      { permission: "EXPORT_REMINDERS", label: "Export reminder CSV", description: "Download pending-dues reminder CSV files." }
    ]
  },
  {
    id: "expenses",
    title: "Expenses and Vendors",
    permissions: [
      { permission: "VIEW_VENDORS", label: "View vendors", description: "View vendor records; sensitive tax and banking fields remain restricted." },
      { permission: "MANAGE_VENDORS", label: "Manage vendors", description: "Create, edit, and change vendor status without hard deleting linked vendors." },
      { permission: "VIEW_EXPENSES", label: "View expenses", description: "View expense records and audit-safe workflow history." },
      { permission: "MANAGE_EXPENSES", label: "Manage expenses", description: "Create and edit draft expenses and submit them for approval." },
      { permission: "APPROVE_EXPENSES", label: "Approve expenses", description: "Approve or reject pending expense records." },
      { permission: "MARK_EXPENSE_PAID", label: "Mark expenses paid", description: "Record full or partial expense payments after approval." },
      { permission: "CANCEL_EXPENSES", label: "Cancel expenses", description: "Cancel preserved expense records with a required reason." },
      { permission: "VIEW_EXPENSE_REPORTS", label: "View expense reports", description: "Open read-only expense summaries without budget analysis." },
      { permission: "EXPORT_EXPENSE_REPORTS", label: "Export expense reports", description: "Download formula-safe expense report CSV files." }
    ]
  },
  {
    id: "budgets",
    title: "Budgets and Spending Controls",
    permissions: [
      { permission: "VIEW_BUDGETS", label: "View budgets", description: "View annual budget plans, allocations, and preserved workflow history." },
      { permission: "MANAGE_BUDGETS", label: "Manage budget drafts", description: "Create and edit draft budget plans and allocations." },
      { permission: "APPROVE_BUDGETS", label: "Approve budgets", description: "Approve or reject submitted budget plans and revisions." },
      { permission: "LOCK_BUDGETS", label: "Lock budgets", description: "Lock an approved official budget with explicit confirmation." },
      { permission: "REVISE_BUDGETS", label: "Revise budgets", description: "Prepare preserved revisions to approved or locked budgets." },
      { permission: "VIEW_BUDGET_REPORTS", label: "View budget reports", description: "Compare allocated, committed, and paid expense amounts." },
      { permission: "EXPORT_BUDGET_REPORTS", label: "Export budget reports", description: "Download formula-safe budget versus actual CSV reports." }
    ]
  },
  {
    id: "miscIncome",
    title: "Miscellaneous Income",
    permissions: [
      { permission: "VIEW_MISC_INCOME", label: "View miscellaneous income", description: "View non-fee income receipts separately from student fee payments." },
      { permission: "MANAGE_MISC_INCOME", label: "Manage miscellaneous income", description: "Issue immutable miscellaneous-income receipts using configured items and rates." },
      { permission: "CANCEL_MISC_INCOME", label: "Cancel miscellaneous income", description: "Cancel a preserved miscellaneous-income receipt with a required reason." },
      { permission: "MANAGE_MISC_INCOME_ITEMS", label: "Manage income items and rates", description: "Configure non-fee income items and academic-year rates without hard deletion." },
      { permission: "VIEW_MISC_INCOME_REPORTS", label: "View miscellaneous-income reports", description: "View date, item, student, method, and account summaries." },
      { permission: "EXPORT_MISC_INCOME_REPORTS", label: "Export miscellaneous-income reports", description: "Download formula-safe miscellaneous-income CSV reports." }
    ]
  },
  {
    id: "booksFinance",
    title: "Books and Library Finance",
    permissions: [
      { permission: "VIEW_BOOKS_FINANCE", label: "View books finance", description: "Open catalog, sales, settlements, and publisher views with role-safe details." },
      { permission: "MANAGE_BOOK_CATALOG", label: "Manage book catalog", description: "Create and inactivate book and academic-material catalog items." },
      { permission: "MANAGE_BOOK_RATES", label: "Manage book rates", description: "Configure preserved academic-year rates without overlaps." },
      { permission: "MANAGE_BOOK_SALES", label: "Issue book-sale receipts", description: "Issue immutable book-sale receipts separately from school fees and miscellaneous income." },
      { permission: "CANCEL_BOOK_SALES", label: "Cancel book-sale receipts", description: "Cancel preserved book-sale receipts with a required reason." },
      { permission: "MANAGE_BOOK_CASH_SETTLEMENT", label: "Manage book-cash settlements", description: "Prepare daily books in-charge cash settlements." },
      { permission: "SUBMIT_BOOK_CASH_SETTLEMENT", label: "Submit book-cash settlements", description: "Snapshot and submit daily expected book-sale cash." },
      { permission: "APPROVE_BOOK_CASH_SETTLEMENT", label: "Approve book-cash settlements", description: "Approve final settlement and create one Director-handover cash movement." },
      { permission: "VIEW_BOOK_REPORTS", label: "View book reports", description: "View book sales, settlements, and publisher expense summaries." },
      { permission: "EXPORT_BOOK_REPORTS", label: "Export book reports", description: "Download formula-safe books-finance CSV files." },
      { permission: "MANAGE_PUBLISHER_BILLS", label: "Manage publisher bills", description: "Create publisher bills through the existing expense workflow." }
    ]
  },
  {
    id: "cashBook",
    title: "Daily Cash Book",
    permissions: [
      { permission: "VIEW_CASH_BOOK", label: "View cash book", description: "View daily physical-cash calculations, dispositions, and preserved snapshots." },
      { permission: "MANAGE_CASH_BOOK", label: "Manage cash-book drafts", description: "Create draft cash days, counted cash, and documented manual movements." },
      { permission: "SUBMIT_CASH_BOOK", label: "Submit cash book", description: "Snapshot and submit a reconciled daily cash book." },
      { permission: "APPROVE_CASH_BOOK", label: "Approve cash book", description: "Approve or reject a submitted cash day." },
      { permission: "LOCK_CASH_BOOK", label: "Lock cash book", description: "Finalise an approved cash day as immutable." },
      { permission: "CANCEL_CASH_BOOK", label: "Cancel cash book", description: "Cancel and preserve an eligible cash day with a required reason." },
      { permission: "VIEW_CASH_BOOK_REPORTS", label: "View cash-book reports", description: "View daily cash sources, dispositions, variance, and missing-day reports." },
      { permission: "EXPORT_CASH_BOOK_REPORTS", label: "Export cash-book reports", description: "Download formula-safe cash-book CSV reports." }
    ]
  },
  {
    id: "library",
    title: "Library Catalog and Circulation",
    permissions: [
      { permission: "VIEW_LIBRARY", label: "View library", description: "View bibliographic titles and the physical accession register." },
      { permission: "MANAGE_LIBRARY_CATALOG", label: "Manage library catalog", description: "Create and update bibliographic title records." },
      { permission: "MANAGE_LIBRARY_COPIES", label: "Manage accessioned copies", description: "Accession copies and record audited copy-state changes." },
      { permission: "IMPORT_LIBRARY_CATALOG", label: "Import library data", description: "Preview and confirm exact-match title and copy imports." },
      { permission: "VIEW_LIBRARY_REPORTS", label: "View library reports", description: "View non-circulation catalog and accession reports." },
      { permission: "EXPORT_LIBRARY_REPORTS", label: "Export library reports", description: "Download formula-safe non-circulation library CSV reports." }
      ,{ permission: "VIEW_LIBRARY_BARCODES", label: "View library barcode coverage", description: "View safe barcode coverage and assignment history." }
      ,{ permission: "MANAGE_LIBRARY_BARCODES", label: "Manage library barcodes", description: "Preview and confirm barcode assignment or a reasoned correction." }
      ,{ permission: "PRINT_LIBRARY_BARCODE_LABELS", label: "Print library barcode labels", description: "Preview and print selected Code 39 copy labels." }
      ,{ permission: "USE_LIBRARY_SCANNER", label: "Use library scanner assistance", description: "Use keyboard-style scanner lookup and confirmed issue or return assistance." }
      ,{ permission: "VIEW_LIBRARY_CIRCULATION", label: "View circulation", description: "View private membership, loan, return, renewal, and reservation operations." }
      ,{ permission: "MANAGE_LIBRARY_MEMBERS", label: "Manage library members", description: "Create and safely change Student and Staff library memberships." }
      ,{ permission: "MANAGE_LIBRARY_POLICIES", label: "Manage borrowing policies", description: "Configure editable planning limits and calendar-day periods." }
      ,{ permission: "ISSUE_LIBRARY_BOOKS", label: "Issue library books", description: "Issue available copies transactionally within policy and reservation priority." }
      ,{ permission: "RETURN_LIBRARY_BOOKS", label: "Return library books", description: "Return issued copies with condition and append-only history." }
      ,{ permission: "RENEW_LIBRARY_BOOKS", label: "Renew library books", description: "Renew eligible open loans using their preserved policy snapshot." }
      ,{ permission: "MANAGE_LIBRARY_RESERVATIONS", label: "Manage reservations", description: "Create, cancel, expire, and fulfil title-level reservations." }
      ,{ permission: "VIEW_LIBRARY_CIRCULATION_REPORTS", label: "View circulation reports", description: "View operational circulation reports with role-safe borrower details." }
      ,{ permission: "EXPORT_LIBRARY_CIRCULATION_REPORTS", label: "Export circulation reports", description: "Download formula-safe circulation CSV reports." }
      ,{ permission: "VIEW_LIBRARY_INCIDENTS", label: "View Library incidents", description: "View preserved lost and damaged Library cases." }
      ,{ permission: "MANAGE_LIBRARY_INCIDENTS", label: "Manage Library incidents", description: "Create, submit, resolve, and cancel lost or damaged cases." }
      ,{ permission: "APPROVE_LIBRARY_INCIDENTS", label: "Approve Library incidents", description: "Approve submitted lost and damaged cases separately from charges." }
      ,{ permission: "VIEW_LIBRARY_CHARGES", label: "View Library charges", description: "View explicitly assessed Library obligations separately from school fees." }
      ,{ permission: "ASSESS_LIBRARY_CHARGES", label: "Assess Library charges", description: "Create and submit explicit overdue, lost, or damaged charges." }
      ,{ permission: "APPROVE_LIBRARY_CHARGES", label: "Approve Library charges", description: "Approve or reject submitted Library charges." }
      ,{ permission: "WAIVE_LIBRARY_CHARGES", label: "Waive Library charges", description: "Record a reasoned full or partial Library charge waiver." }
      ,{ permission: "COLLECT_LIBRARY_CHARGES", label: "Collect Library charges", description: "Collect an approved charge exactly once through Miscellaneous Income." }
      ,{ permission: "CANCEL_LIBRARY_CHARGES", label: "Cancel Library charges", description: "Cancel an unpaid charge with a required reason." }
      ,{ permission: "VIEW_LIBRARY_CHARGE_REPORTS", label: "View Library accountability reports", description: "View operational and financial Library charge reports." }
      ,{ permission: "EXPORT_LIBRARY_CHARGE_REPORTS", label: "Export Library accountability reports", description: "Download formula-safe Library accountability CSV reports." }
      ,{ permission: "VIEW_OWN_LIBRARY_PORTAL", label: "View own Library portal", description: "Parent linked-child-only or Teacher own-account-only read-only Library access." }
      ,{ permission: "VIEW_LIBRARY_STOCK_VERIFICATION", label: "View Library stock verification", description: "View controlled stock-verification sessions and safe records." }
      ,{ permission: "MANAGE_LIBRARY_STOCK_VERIFICATION", label: "Manage Library stock verification", description: "Create, preview, start, submit, and cancel stock-verification sessions." }
      ,{ permission: "SCAN_LIBRARY_STOCK", label: "Scan Library stock", description: "Record exact barcode/accession or manual observations without changing copies." }
      ,{ permission: "REVIEW_LIBRARY_STOCK_DISCREPANCIES", label: "Review stock discrepancies", description: "Review and decide itemized stock discrepancies." }
      ,{ permission: "APPLY_LIBRARY_STOCK_CORRECTIONS", label: "Apply approved stock corrections", description: "Explicitly apply approved corrections through append-only copy events." }
      ,{ permission: "APPROVE_LIBRARY_STOCK_VERIFICATION", label: "Approve stock verification", description: "Approve a reviewed session only after all discrepancies are resolved." }
      ,{ permission: "LOCK_LIBRARY_STOCK_VERIFICATION", label: "Lock stock verification", description: "Finalise an approved session as immutable." }
      ,{ permission: "VIEW_LIBRARY_STOCK_REPORTS", label: "View stock-verification reports", description: "View safe expected, observed, discrepancy, and correction reports." }
      ,{ permission: "EXPORT_LIBRARY_STOCK_REPORTS", label: "Export stock-verification reports", description: "Download formula-safe stock-verification CSV files." }
    ]
  },
  {
    id: "notices",
    title: "Parent Notices",
    permissions: [
      { permission: "VIEW_NOTICES", label: "View notices", description: "Open the staff notice list." },
      { permission: "MANAGE_NOTICES", label: "Manage notices", description: "Create and edit draft notices, and archive notices." },
      { permission: "PUBLISH_NOTICES", label: "Publish notices", description: "Publish notices to the parent portal." }
    ]
  },
  {
    id: "notifications",
    title: "In-App Notifications",
    permissions: [
      { permission: "VIEW_NOTIFICATION_CENTRE", label: "View notification centre", description: "Open the staff notification centre and campaign workspace links." },
      { permission: "VIEW_OWN_NOTIFICATIONS", label: "View own notifications", description: "Read only in-app notifications addressed to the authenticated user." },
      { permission: "MANAGE_NOTIFICATION_TEMPLATES", label: "Manage notification templates", description: "Create, edit, activate, and inactivate plain-text notification templates." },
      { permission: "CREATE_NOTIFICATION_CAMPAIGNS", label: "Create notification campaigns", description: "Create leadership notification drafts and preview allow-listed audiences." },
      { permission: "CREATE_SCOPED_NOTIFICATIONS", label: "Create scoped notifications", description: "Create Teacher drafts restricted to exact timetable scope." },
      { permission: "REVIEW_NOTIFICATION_CAMPAIGNS", label: "Review notification campaigns", description: "Review submitted content and immutable audience intent." },
      { permission: "APPROVE_NOTIFICATION_CAMPAIGNS", label: "Approve notification campaigns", description: "Approve a reviewed in-app campaign separately from publication." },
      { permission: "SCHEDULE_NOTIFICATION_CAMPAIGNS", label: "Schedule notification campaigns", description: "Schedule an approved campaign for deterministic India-local visibility." },
      { permission: "PUBLISH_NOTIFICATION_CAMPAIGNS", label: "Publish notification campaigns", description: "Publish approved non-emergency in-app campaigns." },
      { permission: "PUBLISH_EMERGENCY_NOTIFICATIONS", label: "Publish emergency notifications", description: "Publish approved Emergency in-app campaigns." },
      { permission: "WITHDRAW_NOTIFICATION_CAMPAIGNS", label: "Withdraw notification campaigns", description: "Withdraw published campaigns with a preserved reason." },
      { permission: "VIEW_NOTIFICATION_REPORTS", label: "View notification reports", description: "View aggregate delivery, read, acknowledgment, dismissal, and skipped summaries." },
      { permission: "EXPORT_NOTIFICATION_REPORTS", label: "Export notification reports", description: "Export privacy-safe aggregate notification CSV files." },
      { permission: "ACKNOWLEDGE_OWN_NOTIFICATIONS", label: "Acknowledge own notifications", description: "Explicitly acknowledge a notification addressed to the authenticated user." },
      { permission: "VIEW_WHATSAPP_CENTRE", label: "View WhatsApp centre", description: "Open the one-way WhatsApp operational centre." },
      { permission: "MANAGE_WHATSAPP_INTEGRATION", label: "Manage WhatsApp integration", description: "Manage non-secret provider metadata and health checks; credentials stay in the environment." },
      { permission: "MANAGE_WHATSAPP_CONSENTS", label: "Manage WhatsApp consents", description: "Record and revoke explicit Guardian or Staff WhatsApp consent with evidence." },
      { permission: "MANAGE_WHATSAPP_TEMPLATE_MAPPINGS", label: "Manage WhatsApp templates", description: "Map approved Meta templates to exact Prompt 19A categories." },
      { permission: "CREATE_WHATSAPP_BATCHES", label: "Create WhatsApp batches", description: "Create and preview one-way batches from published Prompt 19A campaigns." },
      { permission: "APPROVE_WHATSAPP_BATCHES", label: "Approve WhatsApp batches", description: "Approve a previewed batch separately from creation." },
      { permission: "SEND_WHATSAPP_BATCHES", label: "Send WhatsApp batches", description: "Queue an approved batch after final revalidation." },
      { permission: "SCHEDULE_WHATSAPP_BATCHES", label: "Schedule WhatsApp batches", description: "Schedule an approved batch outside quiet hours." },
      { permission: "RETRY_WHATSAPP_DELIVERIES", label: "Retry WhatsApp failures", description: "Retry only capped, retryable delivery failures." },
      { permission: "CANCEL_WHATSAPP_BATCHES", label: "Cancel WhatsApp batches", description: "Cancel unsent deliveries while preserving history." },
      { permission: "OVERRIDE_WHATSAPP_QUIET_HOURS", label: "Override WhatsApp quiet hours", description: "Authorise an urgent or emergency batch with a recorded reason." },
      { permission: "OVERRIDE_WHATSAPP_COST_CAP", label: "Override WhatsApp cost cap", description: "Authorise one exact current batch estimate above the configured safety cap." },
      { permission: "PROCESS_WHATSAPP_QUEUE", label: "Process WhatsApp queue", description: "Run a bounded database-backed delivery worker." },
      { permission: "VIEW_WHATSAPP_DELIVERIES", label: "View WhatsApp deliveries", description: "View masked operational delivery rows." },
      { permission: "VIEW_WHATSAPP_REPORTS", label: "View WhatsApp reports", description: "View aggregate consent, delivery, webhook, and estimate reports." },
      { permission: "EXPORT_WHATSAPP_REPORTS", label: "Export WhatsApp reports", description: "Export the formula-safe aggregate report allowlist." },
      { permission: "MANAGE_OWN_WHATSAPP_CONSENT", label: "Manage own WhatsApp consent", description: "Manage only the authenticated Guardian or linked Staff consent." },
      { permission: "VIEW_SMS_EMAIL_CENTRE", label: "View SMS and Email centre", description: "Open aggregate one-way SMS and Email operations." },
      { permission: "MANAGE_SMS_EMAIL_INTEGRATIONS", label: "Manage SMS and Email integrations", description: "Manage non-secret profile, DLT and domain-readiness metadata." },
      { permission: "MANAGE_SMS_EMAIL_CONSENTS", label: "Manage SMS and Email consents", description: "Record verified Guardian or Staff channel consent and review suppressions." },
      { permission: "MANAGE_SMS_EMAIL_TEMPLATES", label: "Manage SMS and Email templates", description: "Map approved DLT SMS and plain-text Email templates." },
      { permission: "CREATE_SMS_EMAIL_BATCHES", label: "Create SMS and Email batches", description: "Create and preview batches from Prompt 19A snapshots." },
      { permission: "APPROVE_SMS_EMAIL_BATCHES", label: "Approve SMS and Email batches", description: "Approve an external batch separately from creation." },
      { permission: "SEND_SMS_EMAIL_BATCHES", label: "Send SMS and Email batches", description: "Queue an approved batch after final revalidation." },
      { permission: "SCHEDULE_SMS_EMAIL_BATCHES", label: "Schedule SMS and Email batches", description: "Schedule an approved batch in India-local time." },
      { permission: "RETRY_SMS_EMAIL_DELIVERIES", label: "Retry SMS and Email failures", description: "Retry capped transient failures only." },
      { permission: "CANCEL_SMS_EMAIL_BATCHES", label: "Cancel SMS and Email batches", description: "Cancel unsent rows without deleting history." },
      { permission: "OVERRIDE_SMS_EMAIL_LIMITS", label: "Override SMS and Email limits", description: "Director/Super Admin emergency or exact-estimate cost-cap override." },
      { permission: "PROCESS_SMS_EMAIL_QUEUE", label: "Process SMS and Email queue", description: "Run a bounded database-backed MOCK queue worker." },
      { permission: "VIEW_SMS_EMAIL_DELIVERIES", label: "View SMS and Email deliveries", description: "View authorised masked operational delivery rows." },
      { permission: "VIEW_SMS_EMAIL_REPORTS", label: "View SMS and Email reports", description: "View aggregate consent, suppression, queue and estimate reports." },
      { permission: "EXPORT_SMS_EMAIL_REPORTS", label: "Export SMS and Email reports", description: "Export the formula-safe aggregate CSV." },
      { permission: "MANAGE_OWN_SMS_EMAIL_CONSENT", label: "Manage own SMS and Email consent", description: "Manage only the authenticated Guardian or linked Staff channel preferences." }
    ]
  },
  {
    id: "homework",
    title: "Homework and Assignments",
    permissions: [
      { permission: "VIEW_HOMEWORK", label: "View homework", description: "View homework within the authorised school or Teacher scope." },
      { permission: "MANAGE_HOMEWORK", label: "Manage homework", description: "Create and edit drafts within the authorised class, section, and subject scope." },
      { permission: "PUBLISH_HOMEWORK", label: "Publish homework", description: "Publish or audit-correct homework within the authorised scope." },
      { permission: "ARCHIVE_HOMEWORK", label: "Archive homework", description: "Archive or cancel preserved homework with an audit event." },
      { permission: "VIEW_HOMEWORK_REPORTS", label: "View homework reports", description: "View privacy-safe homework coverage and workflow reports within scope." },
      { permission: "EXPORT_HOMEWORK_REPORTS", label: "Export homework reports", description: "Download formula-safe homework CSV reports." },
      { permission: "VIEW_OWN_HOMEWORK_PORTAL", label: "View own homework portal", description: "Teacher scoped or Parent linked-child-only homework access." }
    ]
  },
  {
    id: "exams",
    title: "Exams and Marks",
    permissions: [
      { permission: "VIEW_EXAMS", label: "View exams", description: "View exam cycles and authorised mark sheets." },
      { permission: "MANAGE_EXAMS", label: "Manage exams", description: "Create draft exam cycles and run preserved exam workflow actions." },
      { permission: "CONFIGURE_EXAM_ASSESSMENTS", label: "Configure assessments", description: "Configure class, section, subject, component, maximum, pass, and weightage values before entry opens." },
      { permission: "ENTER_MARKS", label: "Enter marks", description: "Save raw marks and attendance-like mark statuses within server-enforced scope." },
      { permission: "SUBMIT_MARKS", label: "Submit marks", description: "Submit a complete authorised mark sheet for review." },
      { permission: "APPROVE_MARKS", label: "Approve marks", description: "Approve submitted mark sheets after entry closes." },
      { permission: "LOCK_EXAMS", label: "Lock exams", description: "Lock approved sheets and exams as immutable raw-mark snapshots." },
      { permission: "CORRECT_APPROVED_MARKS", label: "Correct approved marks", description: "Apply a reasoned correction to an approved but unlocked mark with previous values preserved." },
      { permission: "VIEW_EXAM_REPORTS", label: "View exam reports", description: "View internal completeness, mark, status, and workflow summaries." },
      { permission: "EXPORT_EXAM_REPORTS", label: "Export exam reports", description: "Download privacy-allowlisted formula-safe exam CSV data." },
      { permission: "VIEW_EXAM_CONFIGURATION", label: "View examination configuration", description: "View Principal-owned examination scopes, versioned schemes, bindings, and exact Teacher assignments." },
      { permission: "MANAGE_EXAM_CONFIGURATION", label: "Manage examination configuration", description: "Create and edit draft examinations and governed configuration versions." },
      { permission: "ACTIVATE_EXAM_SCHEMES", label: "Activate examination schemes", description: "Validate, activate, and freeze a complete class examination scheme." },
      { permission: "ASSIGN_EXAM_TEACHERS", label: "Assign examination Teachers", description: "Assign exact timetable-backed primary submitters and audited contributors." },
      { permission: "PROPOSE_EXAM_SCHEMES", label: "Propose assigned-subject schemes", description: "Allow a Teacher to submit a non-activating proposal only for an exact assigned subject." },
      { permission: "VIEW_OWN_EXAM_ASSIGNMENTS", label: "View own examination assignments", description: "View only the authenticated Teacher's exact active examination assignments." },
      { permission: "INTERVENE_EXAM_SCHEMES", label: "Govern Super Admin examination intervention", description: "Permit exceptional Super Admin intervention only with an explicit audit reason." },
      { permission: "VIEW_OWN_EXAM_MARKS", label: "View own governed marks sheets", description: "View Student marks only through an exact active examination assignment." },
      { permission: "ENTER_ASSIGNED_EXAM_MARKS", label: "Enter assigned governed marks", description: "Save draft marks only for exact assigned examination components." },
      { permission: "SUBMIT_ASSIGNED_EXAM_MARKS", label: "Submit assigned governed marks", description: "Permit only the exact primary submitter to final-submit a complete component sheet." },
      { permission: "REQUEST_EXAM_MARK_CORRECTION", label: "Request marks correction", description: "Request a governed reopen after submission without directly reopening a sheet." },
      { permission: "VIEW_EXAM_MODERATION", label: "View marks moderation", description: "View governed completion, correction, calculation, and version evidence." },
      { permission: "MODERATE_EXAM_MARKS", label: "Moderate marks sheets", description: "Moderate complete submitted sheets without publishing report cards." },
      { permission: "REOPEN_EXAM_MARK_SHEETS", label: "Review and reopen marks sheets", description: "Reject or reopen a correction request with an audit reason and a new sheet version." },
      { permission: "RUN_EXAM_CALCULATIONS", label: "Run examination calculation preview", description: "Create deterministic internal result snapshots from complete governed source sheets." },
      { permission: "LOCK_EXAM_CALCULATIONS", label: "Lock examination calculation snapshot", description: "Freeze source sheet versions and the selected calculation snapshot without publication." },
      { permission: "INTERVENE_EXAM_MARKS", label: "Govern Super Admin marks intervention", description: "Permit exceptional marks intervention only with the exact permission and an audit reason." }
    ]
  },
  {
    id: "reportCards",
    title: "Digital Report Cards",
    permissions: [
      { permission: "VIEW_REPORT_CARDS", label: "View report cards", description: "View authorised report-card batches and Student cards." },
      { permission: "MANAGE_REPORT_CARD_TEMPLATES", label: "Manage report-card templates", description: "Configure validated grading schemes and mark-based or KG rubric templates." },
      { permission: "MANAGE_REPORT_CARD_BATCHES", label: "Manage report-card batches", description: "Create, open, and manage class/section report-card batches." },
      { permission: "ENTER_REPORT_CARD_DATA", label: "Enter report-card data", description: "Enter comments or KG rubric data within server-enforced scope without changing raw marks." },
      { permission: "SUBMIT_REPORT_CARDS", label: "Submit report cards", description: "Submit complete authorised Student report cards for review." },
      { permission: "APPROVE_REPORT_CARDS", label: "Approve report cards", description: "Approve submitted report-card batches separately from issue." },
      { permission: "ISSUE_REPORT_CARDS", label: "Issue report cards", description: "Create immutable issued versions for approved, complete cards." },
      { permission: "CORRECT_ISSUED_REPORT_CARDS", label: "Correct issued report cards", description: "Issue a reasoned new version while preserving prior snapshots." },
      { permission: "VIEW_REPORT_CARD_REPORTS", label: "View report-card reports", description: "View completeness, issue, grade, and KG gap summaries." },
      { permission: "EXPORT_REPORT_CARD_REPORTS", label: "Export report-card reports", description: "Download formula-safe privacy-allowlisted report-card CSV files." },
      { permission: "VIEW_OWN_REPORT_CARDS", label: "View own linked-child report cards", description: "Allow a Parent to view issued versions for linked children only." }
    ]
  },
  {
    id: "teacherAnalytics",
    title: "Teacher Performance Analytics",
    permissions: [
      { permission: "VIEW_TEACHER_ANALYTICS", label: "View identified Teacher analytics", description: "View evidence categories for identified Teachers; this never includes a composite score or rank." },
      { permission: "VIEW_OWN_TEACHER_ANALYTICS", label: "View own Teacher analytics", description: "Allow a linked Teacher to view only their own shared or finalised analytics and response." },
      { permission: "MANAGE_TEACHER_ANALYTICS_CYCLES", label: "Manage analytics cycles", description: "Create and move preserved analytics review cycles through authorised workflow states." },
      { permission: "GENERATE_TEACHER_ANALYTICS_SNAPSHOTS", label: "Generate analytics snapshots", description: "Generate deterministic immutable evidence snapshots from authorised operational sources." },
      { permission: "REVIEW_TEACHER_ANALYTICS", label: "Review Teacher analytics", description: "Add factual leadership review notes without automatic conclusions." },
      { permission: "SHARE_TEACHER_ANALYTICS_REVIEW", label: "Share analytics review", description: "Explicitly share a review with the linked Teacher." },
      { permission: "FINALISE_TEACHER_ANALYTICS_REVIEW", label: "Finalise analytics review", description: "Finalise an individual review or completed cycle as immutable." },
      { permission: "VIEW_TEACHER_ANALYTICS_REPORTS", label: "View analytics reports", description: "View privacy-safe aggregate evidence and data-quality coverage." },
      { permission: "EXPORT_TEACHER_ANALYTICS_REPORTS", label: "Export analytics reports", description: "Export the leadership-only formula-safe analytics allowlist." }
    ]
  },
  {
    id: "certificates",
    title: "Student Certificates",
    permissions: [
      { permission: "VIEW_CERTIFICATES", label: "View certificates", description: "View authorised Student certificate requests, drafts, issued versions, and history." },
      { permission: "MANAGE_CERTIFICATE_TEMPLATES", label: "Manage certificate templates", description: "Manage validated templates and transaction-safe number series; executable HTML is not supported." },
      { permission: "MANAGE_CERTIFICATE_REQUESTS", label: "Manage certificate requests", description: "Create, review, reject, and cancel internal or Parent requests." },
      { permission: "CREATE_CERTIFICATES", label: "Create certificates", description: "Create validated certificate drafts from authoritative Student records." },
      { permission: "REVIEW_CERTIFICATES", label: "Review certificates", description: "Submit and review certificate drafts separately from approval and issue." },
      { permission: "APPROVE_CERTIFICATES", label: "Approve certificates", description: "Approve requests and certificate drafts without allocating a number." },
      { permission: "ISSUE_CERTIFICATES", label: "Issue certificates", description: "Allocate a number transactionally and create immutable issued version 1." },
      { permission: "CORRECT_ISSUED_CERTIFICATES", label: "Correct issued certificates", description: "Create a reasoned immutable correction or reissue version." },
      { permission: "CANCEL_ISSUED_CERTIFICATES", label: "Cancel issued certificates", description: "Cancel without deleting the issued number or history." },
      { permission: "VIEW_CERTIFICATE_REPORTS", label: "View certificate reports", description: "View operational certificate aggregates and data-gap warnings." },
      { permission: "EXPORT_CERTIFICATE_REPORTS", label: "Export certificate reports", description: "Download the privacy-allowlisted formula-safe certificate CSV." },
      { permission: "REQUEST_OWN_CHILD_CERTIFICATES", label: "Request linked-child certificates", description: "Allow a Parent to request a supported certificate for an owned linked child." },
      { permission: "VIEW_OWN_CHILD_CERTIFICATES", label: "View linked-child certificates", description: "Allow a Parent to view and print issued certificates for owned linked children only." }
    ]
  },
  {
    id: "classXDocuments",
    title: "Class X Document Packages",
    permissions: [
      { permission: "VIEW_CLASS_X_PACKAGES", label: "View Class X packages", description: "View authorised Class X package checklists, payment state, custody, handover, and immutable history." },
      { permission: "MANAGE_CLASS_X_PACKAGES", label: "Manage Class X packages", description: "Create and manage package requests without changing Student enrollment, lifecycle, progression, marks, or fee dues." },
      { permission: "REVIEW_CLASS_X_PACKAGES", label: "Review Class X packages", description: "Review Class X source snapshots and mandatory document readiness." },
      { permission: "APPROVE_CLASS_X_PACKAGES", label: "Approve Class X packages", description: "Approve a reviewed package separately from payment collection and physical handover." },
      { permission: "MANAGE_CLASS_X_DOCUMENT_CUSTODY", label: "Manage Class X document custody", description: "Link issued school certificates and track externally issued Board documents without generating Board content." },
      { permission: "CONFIGURE_CLASS_X_PACKAGE_TEMPLATES", label: "Configure Class X package templates", description: "Configure validated checklist templates and Parent-safe visibility." },
      { permission: "CONFIGURE_CLASS_X_PACKAGE_CHARGES", label: "Configure Class X package charges", description: "Configure school service-charge rules linked to an approved Miscellaneous Income item." },
      { permission: "APPROVE_CLASS_X_PACKAGE_CHARGES", label: "Approve Class X package charges", description: "Approve a snapshotted package service charge for collection." },
      { permission: "COLLECT_CLASS_X_PACKAGE_PAYMENTS", label: "Collect Class X package payments", description: "Collect one approved full service charge through Miscellaneous Income, never the fee Payment ledger." },
      { permission: "WAIVE_CLASS_X_PACKAGE_CHARGES", label: "Waive Class X package charges", description: "Record a reasoned Director-approved full package charge waiver." },
      { permission: "HANDOVER_CLASS_X_DOCUMENTS", label: "Hand over Class X documents", description: "Record physical partial or final handover with an operational acknowledgment." },
      { permission: "VIEW_CLASS_X_PACKAGE_REPORTS", label: "View Class X package reports", description: "View operational and financial reconciliation summaries with safe masking." },
      { permission: "EXPORT_CLASS_X_PACKAGE_REPORTS", label: "Export Class X package reports", description: "Export the privacy-allowlisted, formula-safe Class X package CSV." },
      { permission: "REQUEST_OWN_CHILD_CLASS_X_PACKAGE", label: "Request linked-child Class X package", description: "Allow a Parent to request a package only for an owned linked child." },
      { permission: "VIEW_OWN_CHILD_CLASS_X_PACKAGE", label: "View linked-child Class X package", description: "Allow a Parent to view safe checklist, payment, readiness, and handover status only for owned linked children." }
    ]
  },
  {
    id: "identityCards",
    title: "Virtual Student and Teacher ID Cards",
    permissions: [
      { permission: "VIEW_ID_CARDS", label: "View ID cards", description: "View authorised Student and Staff ID-card records, versions, and operational history." },
      { permission: "MANAGE_ID_CARD_TEMPLATES", label: "Manage ID-card templates", description: "Manage validated front/back templates using privacy-safe field allowlists." },
      { permission: "MANAGE_ID_CARD_NUMBER_SERIES", label: "Manage ID-card number series", description: "Manage transaction-safe Student and Staff card-number series." },
      { permission: "CREATE_ID_CARDS", label: "Create ID cards", description: "Create Student or Staff card drafts from authoritative active records." },
      { permission: "MANAGE_ID_CARD_BATCHES", label: "Manage ID-card batches", description: "Create, preview, and cancel controlled Student or Staff batches." },
      { permission: "APPROVE_ID_CARDS", label: "Approve ID cards", description: "Approve individual cards and previewed batches without allocating numbers." },
      { permission: "ISSUE_ID_CARDS", label: "Issue ID cards", description: "Allocate opaque card numbers and create immutable issued versions." },
      { permission: "CORRECT_ISSUED_ID_CARDS", label: "Correct issued ID cards", description: "Create a reasoned immutable corrected version with the same card number." },
      { permission: "REPLACE_ID_CARDS", label: "Replace ID cards", description: "Revoke a lost or damaged card and issue a linked replacement with a new number." },
      { permission: "REVOKE_ID_CARDS", label: "Revoke ID cards", description: "Explicitly revoke an issued card with a required reason." },
      { permission: "USE_ID_CARD_LOOKUP", label: "Use ID-card lookup", description: "Use authenticated exact card-number lookup; a barcode is never authentication." },
      { permission: "VIEW_ID_CARD_REPORTS", label: "View ID-card reports", description: "View privacy-safe operational coverage and workflow aggregates." },
      { permission: "EXPORT_ID_CARD_REPORTS", label: "Export ID-card reports", description: "Download the formula-safe privacy-allowlisted ID-card CSV." },
      { permission: "VIEW_OWN_STUDENT_ID_CARDS", label: "View linked-child ID cards", description: "Allow a Parent to view issued Student cards only for linked children." },
      { permission: "VIEW_OWN_STAFF_ID_CARD", label: "View own Staff ID card", description: "Allow a linked Teacher to view only their own issued Staff card." }
    ]
  },
  {
    id: "aiAssistant",
    title: "Read-only AI Assistant",
    permissions: [
      { permission: "VIEW_AI_ASSISTANT", label: "View AI assistant", description: "Open the leadership-only read-only assistant." },
      { permission: "USE_AI_ASSISTANT_DOCUMENTATION", label: "Use documentation retrieval", description: "Ask questions against the explicit local documentation allowlist." },
      { permission: "USE_AI_ASSISTANT_AGGREGATES", label: "Use aggregate retrieval", description: "Ask questions using handwritten aggregate-only read tools." },
      { permission: "MANAGE_AI_ASSISTANT", label: "Manage AI assistant", description: "Manage non-secret profile limits and MOCK-only activation state." },
      { permission: "MANAGE_AI_ASSISTANT_SOURCES", label: "Manage AI sources", description: "Enable or disable registered sources within immutable safety boundaries." },
      { permission: "VIEW_AI_ASSISTANT_AUDIT", label: "View AI audit", description: "View hashes, counts, timings and safety categories without question or answer bodies." },
      { permission: "RUN_AI_ASSISTANT_EVALUATIONS", label: "Run AI safety evaluations", description: "Run synthetic deterministic MOCK regression cases." }
    ]
  },
  {
    id: "feeRegisterOcr",
    title: "Handwritten Fee Register OCR",
    permissions: [
      { permission: "VIEW_FEE_REGISTER_OCR", label: "View OCR batches", description: "View authorised handwritten fee-register OCR staging batches." },
      { permission: "VIEW_FEE_REGISTER_OCR_IMAGES", label: "View private OCR images", description: "Open authenticated no-store register source images required for review." },
      { permission: "MANAGE_FEE_REGISTER_OCR_PROFILES", label: "Manage OCR profiles", description: "Manage non-secret provider limits and safe MOCK or MANUAL state." },
      { permission: "UPLOAD_FEE_REGISTER_PAGES", label: "Upload register pages", description: "Upload validated JPEG, PNG, or WebP register pages to private storage." },
      { permission: "RUN_FEE_REGISTER_OCR", label: "Run OCR extraction", description: "Run deterministic MOCK extraction or initialise MANUAL transcription." },
      { permission: "REVIEW_FEE_REGISTER_OCR_ROWS", label: "Review OCR rows", description: "Correct, match, transcribe, verify, or reject untrusted OCR staging rows." },
      { permission: "APPROVE_FEE_REGISTER_OCR_BATCHES", label: "Approve OCR batches", description: "Approve an exact reviewed version separately from row verification." },
      { permission: "PREVIEW_FEE_REGISTER_OCR_POSTING", label: "Preview OCR posting", description: "Run a zero-write financial and duplicate recheck preview." },
      { permission: "POST_FEE_REGISTER_OCR_PAYMENTS", label: "Post OCR payments", description: "Post individually verified rows only when the finance safety gate is proven and enabled." },
      { permission: "RESOLVE_FEE_REGISTER_OCR_DUPLICATES", label: "Resolve OCR duplicate warnings", description: "Record a reasoned resolution without deleting or merging evidence." },
      { permission: "PURGE_FEE_REGISTER_OCR_IMAGES", label: "Purge OCR source images", description: "Purge authorised retained image bytes while preserving metadata and history." },
      { permission: "VIEW_FEE_REGISTER_OCR_REPORTS", label: "View OCR reports", description: "View privacy-safe OCR workflow and reconciliation reports." },
      { permission: "EXPORT_FEE_REGISTER_OCR_REPORTS", label: "Export OCR reports", description: "Download formula-safe aggregate or reviewed staging CSV files." }
    ]
  },
  {
    id: "cloudBackup",
    title: "Encrypted Cloud Backup and Recovery",
    permissions: [
      { permission: "VIEW_CLOUD_BACKUP", label: "View cloud backup health", description: "View aggregate encrypted-backup, schedule and recovery health." },
      { permission: "MANAGE_CLOUD_BACKUP_PROFILES", label: "Manage backup profiles", description: "Manage non-secret MOCK or LOCAL_FOLDER profile metadata." },
      { permission: "MANAGE_CLOUD_BACKUP_SCHEDULES", label: "Manage backup schedules", description: "Manage database schedules; external scheduler setup remains separate." },
      { permission: "RUN_CLOUD_BACKUP", label: "Run encrypted backup", description: "Run an encrypted MOCK or LOCAL_FOLDER backup." },
      { permission: "VERIFY_CLOUD_BACKUP", label: "Verify cloud backup", description: "Run read-after-write, decryption, hash and schema verification." },
      { permission: "RUN_CLOUD_BACKUP_RESTORE_REHEARSAL", label: "Run restore rehearsal", description: "Restore twice into an isolated copied database only." },
      { permission: "MANAGE_CLOUD_BACKUP_RETENTION", label: "Manage backup retention", description: "Preview and configure protected retention rules." },
      { permission: "PURGE_CLOUD_BACKUPS", label: "Purge expired backups", description: "Delete only exact eligible encrypted objects after safety checks." },
      { permission: "ACTIVATE_LIVE_CLOUD_BACKUP", label: "Activate live backup", description: "Reserved for a future supervised provider-specific activation." },
      { permission: "CHANGE_CLOUD_BACKUP_KEY_VERSION", label: "Change backup key version", description: "Activate a server environment key-version reference without accepting key material." },
      { permission: "VIEW_CLOUD_BACKUP_REPORTS", label: "View backup reports", description: "View aggregate privacy-safe backup and recovery reports." },
      { permission: "EXPORT_CLOUD_BACKUP_REPORTS", label: "Export backup reports", description: "Export the formula-safe aggregate backup CSV allowlist." }
    ]
  },
  {
    id: "imports",
    title: "Imports and Verification",
    permissions: [
      { permission: "VIEW_IMPORT_EXPORT", label: "View import/export", description: "Open the import/export workspace." },
      { permission: "RUN_IMPORTS", label: "Run imports", description: "Run supported import actions." },
      { permission: "VIEW_IMPORT_VERIFICATION", label: "View import verification", description: "Open saved import checks and go-live checklist." },
      { permission: "RUN_PILOT_ACCEPTANCE", label: "Run pilot acceptance", description: "Open pilot acceptance and reconciliation checks." }
    ]
  },
  {
    id: "timetable",
    title: "Timetable",
    permissions: [
      { permission: "VIEW_TIMETABLE", label: "View timetable", description: "Open timetable overview and print views." },
      { permission: "MANAGE_TIMETABLE_MASTER", label: "Manage timetable master", description: "Manage teachers, subjects, classes, and period settings." },
      { permission: "MANAGE_TIMETABLE_ASSIGNMENTS", label: "Manage timetable assignments", description: "Manage subject and teacher allocations." },
      { permission: "MANAGE_TIMETABLE_BUILDER", label: "Manage timetable builder", description: "Edit manual timetable drafts." },
      { permission: "RUN_TIMETABLE_GENERATOR", label: "Run timetable generator", description: "Generate draft timetables." },
      { permission: "PRINT_TIMETABLE", label: "Print timetable", description: "Print class and teacher timetables." }
    ]
  },
  {
    id: "users",
    title: "Users and Roles",
    permissions: [
      { permission: "VIEW_USERS", label: "View users", description: "Open the user list." },
      { permission: "MANAGE_USERS", label: "Manage users", description: "Create users and edit account status or role." },
      { permission: "RESET_USER_PASSWORDS", label: "Reset passwords", description: "Set temporary passwords for other users." },
      { permission: "MANAGE_ROLE_PERMISSIONS", label: "Manage role permissions", description: "Open and save the role permission matrix." }
    ]
  },
  {
    id: "public-website",
    title: "Public Website",
    permissions: [
      { permission: "VIEW_PUBLIC_WEBSITE_ADMIN", label: "View website administration", description: "Open the controlled public-website readiness workspace." },
      { permission: "MANAGE_PUBLIC_WEBSITE_SETTINGS", label: "Manage website settings", description: "Edit public contact, branding and default SEO drafts." },
      { permission: "MANAGE_PUBLIC_WEBSITE_PAGES", label: "Manage website pages", description: "Create and edit controlled public page drafts." },
      { permission: "MANAGE_PUBLIC_WEBSITE_POSTS", label: "Manage website posts", description: "Create and edit public news and announcement drafts." },
      { permission: "REVIEW_PUBLIC_WEBSITE_CONTENT", label: "Review website content", description: "Approve a current reviewed draft version." },
      { permission: "PUBLISH_PUBLIC_WEBSITE_CONTENT", label: "Publish website content", description: "Create immutable public page or post versions." },
      { permission: "MANAGE_PUBLIC_WEBSITE_NAVIGATION", label: "Manage website navigation", description: "Publish deterministic links to approved public destinations." },
      { permission: "PREVIEW_PUBLIC_WEBSITE_DRAFTS", label: "Preview website drafts", description: "Open leadership-only, no-store draft previews." },
      { permission: "VIEW_PUBLIC_WEBSITE_REPORTS", label: "View website reports", description: "View aggregate content, SEO, accessibility and link readiness." },
      { permission: "EXPORT_PUBLIC_WEBSITE_REPORTS", label: "Export website reports", description: "Download privacy-safe public-website readiness CSV." }
    ]
  },
  {
    id: "system",
    title: "Settings and System",
    permissions: [
      { permission: "VIEW_SETTINGS", label: "View settings", description: "Open settings and system information." },
      { permission: "MANAGE_SCHOOL_SETTINGS", label: "Manage school settings", description: "Edit school profile and receipt settings." },
      { permission: "VIEW_SYSTEM_HEALTH", label: "View system health", description: "See readiness and production warnings." },
      { permission: "RUN_BACKUP", label: "Run backup", description: "Download or create full backups." },
      { permission: "RUN_RESTORE", label: "Run restore", description: "Validate and restore full backups." },
      { permission: "FIRST_RUN_SETUP", label: "First-run setup", description: "Complete first-run Director setup." }
    ]
  }
];

const directorPermissions = new Set<CanonicalPermission>(
  PERMISSIONS.filter((permission) => permission !== "MANAGE_ROLE_PERMISSIONS")
);

const principalPermissions = new Set<CanonicalPermission>([
  "VIEW_DASHBOARD",
  "VIEW_STUDENTS",
  "CREATE_STUDENTS",
  "EDIT_STUDENTS",
  "EXPORT_STUDENTS",
  "VIEW_STUDENT_LIFECYCLE",
  "MANAGE_STUDENT_LIFECYCLE",
  "VIEW_ACADEMIC_YEAR_ENROLLMENTS",
  "MANAGE_ACADEMIC_YEAR_ENROLLMENTS",
  "VIEW_STUDENT_PROGRESSION", "MANAGE_STUDENT_PROGRESSION", "APPROVE_STUDENT_PROGRESSION", "FINALIZE_STUDENT_PROGRESSION", "VIEW_STUDENT_PROGRESSION_REPORTS",
  "VIEW_UDISE_CHECKLIST", "EXPORT_UDISE_CHECKLIST",
  "VIEW_GUARDIANS",
  "VIEW_STAFF",
  "MANAGE_STAFF",
  "VIEW_NOTICES",
  "MANAGE_NOTICES",
  "PUBLISH_NOTICES",
  "VIEW_NOTIFICATION_CENTRE", "VIEW_OWN_NOTIFICATIONS", "MANAGE_NOTIFICATION_TEMPLATES", "CREATE_NOTIFICATION_CAMPAIGNS", "REVIEW_NOTIFICATION_CAMPAIGNS", "APPROVE_NOTIFICATION_CAMPAIGNS", "SCHEDULE_NOTIFICATION_CAMPAIGNS", "PUBLISH_NOTIFICATION_CAMPAIGNS", "PUBLISH_EMERGENCY_NOTIFICATIONS", "WITHDRAW_NOTIFICATION_CAMPAIGNS", "VIEW_NOTIFICATION_REPORTS", "EXPORT_NOTIFICATION_REPORTS", "ACKNOWLEDGE_OWN_NOTIFICATIONS",
  "VIEW_WHATSAPP_CENTRE", "CREATE_WHATSAPP_BATCHES", "APPROVE_WHATSAPP_BATCHES", "SEND_WHATSAPP_BATCHES", "SCHEDULE_WHATSAPP_BATCHES", "RETRY_WHATSAPP_DELIVERIES", "CANCEL_WHATSAPP_BATCHES", "VIEW_WHATSAPP_DELIVERIES", "VIEW_WHATSAPP_REPORTS", "EXPORT_WHATSAPP_REPORTS",
  "VIEW_SMS_EMAIL_CENTRE", "CREATE_SMS_EMAIL_BATCHES", "APPROVE_SMS_EMAIL_BATCHES", "SEND_SMS_EMAIL_BATCHES", "SCHEDULE_SMS_EMAIL_BATCHES", "RETRY_SMS_EMAIL_DELIVERIES", "CANCEL_SMS_EMAIL_BATCHES", "VIEW_SMS_EMAIL_DELIVERIES", "VIEW_SMS_EMAIL_REPORTS", "EXPORT_SMS_EMAIL_REPORTS",
  "VIEW_HOMEWORK", "MANAGE_HOMEWORK", "PUBLISH_HOMEWORK", "ARCHIVE_HOMEWORK", "VIEW_HOMEWORK_REPORTS", "EXPORT_HOMEWORK_REPORTS",
  "VIEW_EXAMS", "MANAGE_EXAMS", "CONFIGURE_EXAM_ASSESSMENTS", "ENTER_MARKS", "SUBMIT_MARKS", "APPROVE_MARKS", "LOCK_EXAMS", "CORRECT_APPROVED_MARKS", "VIEW_EXAM_REPORTS", "EXPORT_EXAM_REPORTS",
  "VIEW_EXAM_CONFIGURATION", "MANAGE_EXAM_CONFIGURATION", "ACTIVATE_EXAM_SCHEMES", "ASSIGN_EXAM_TEACHERS",
  "VIEW_EXAM_MODERATION", "MODERATE_EXAM_MARKS", "REOPEN_EXAM_MARK_SHEETS", "RUN_EXAM_CALCULATIONS", "LOCK_EXAM_CALCULATIONS",
  "VIEW_REPORT_CARDS", "MANAGE_REPORT_CARD_BATCHES", "ENTER_REPORT_CARD_DATA", "SUBMIT_REPORT_CARDS", "APPROVE_REPORT_CARDS", "ISSUE_REPORT_CARDS", "CORRECT_ISSUED_REPORT_CARDS", "VIEW_REPORT_CARD_REPORTS", "EXPORT_REPORT_CARD_REPORTS",
  "VIEW_CERTIFICATES", "MANAGE_CERTIFICATE_REQUESTS", "CREATE_CERTIFICATES", "REVIEW_CERTIFICATES", "APPROVE_CERTIFICATES", "ISSUE_CERTIFICATES", "CORRECT_ISSUED_CERTIFICATES", "CANCEL_ISSUED_CERTIFICATES", "VIEW_CERTIFICATE_REPORTS", "EXPORT_CERTIFICATE_REPORTS",
  "VIEW_CLASS_X_PACKAGES", "MANAGE_CLASS_X_PACKAGES", "REVIEW_CLASS_X_PACKAGES", "APPROVE_CLASS_X_PACKAGES", "MANAGE_CLASS_X_DOCUMENT_CUSTODY", "HANDOVER_CLASS_X_DOCUMENTS", "VIEW_CLASS_X_PACKAGE_REPORTS", "EXPORT_CLASS_X_PACKAGE_REPORTS",
  "VIEW_ID_CARDS", "CREATE_ID_CARDS", "MANAGE_ID_CARD_BATCHES", "APPROVE_ID_CARDS", "ISSUE_ID_CARDS", "CORRECT_ISSUED_ID_CARDS", "REPLACE_ID_CARDS", "REVOKE_ID_CARDS", "USE_ID_CARD_LOOKUP", "VIEW_ID_CARD_REPORTS", "EXPORT_ID_CARD_REPORTS",
  "VIEW_TEACHER_ANALYTICS", "MANAGE_TEACHER_ANALYTICS_CYCLES", "GENERATE_TEACHER_ANALYTICS_SNAPSHOTS", "REVIEW_TEACHER_ANALYTICS", "SHARE_TEACHER_ANALYTICS_REVIEW", "FINALISE_TEACHER_ANALYTICS_REVIEW", "VIEW_TEACHER_ANALYTICS_REPORTS", "EXPORT_TEACHER_ANALYTICS_REPORTS",
  "VIEW_DAILY_COLLECTION",
  "VIEW_PENDING_DUES",
  "VIEW_LEDGER",
  "EXPORT_REPORTS",
  "VIEW_TIMETABLE",
  "MANAGE_TIMETABLE_MASTER",
  "MANAGE_TIMETABLE_ASSIGNMENTS",
  "MANAGE_TIMETABLE_BUILDER",
  "RUN_TIMETABLE_GENERATOR",
  "PRINT_TIMETABLE"
  ,"VIEW_STUDENT_ATTENDANCE", "MANAGE_STUDENT_ATTENDANCE", "SUBMIT_STUDENT_ATTENDANCE", "LOCK_STUDENT_ATTENDANCE", "VIEW_STUDENT_ATTENDANCE_REPORTS"
  ,"VIEW_STAFF_ATTENDANCE", "MANAGE_STAFF_ATTENDANCE", "SUBMIT_STAFF_ATTENDANCE", "LOCK_STAFF_ATTENDANCE", "VIEW_STAFF_ATTENDANCE_REPORTS"
  ,"VIEW_STAFF_LEAVE", "APPLY_STAFF_LEAVE", "MANAGE_STAFF_LEAVE", "APPROVE_STAFF_LEAVE", "VIEW_STAFF_LEAVE_REPORTS"
  ,"VIEW_SUBSTITUTES", "MANAGE_SUBSTITUTES", "ASSIGN_SUBSTITUTES", "CONFIRM_SUBSTITUTES", "VIEW_SUBSTITUTE_REPORTS"
  ,"VIEW_EXPENSES", "VIEW_EXPENSE_REPORTS"
  ,"VIEW_BUDGETS", "VIEW_BUDGET_REPORTS"
  ,"VIEW_MISC_INCOME", "VIEW_MISC_INCOME_REPORTS", "VIEW_CASH_BOOK", "VIEW_CASH_BOOK_REPORTS"
  ,"VIEW_BOOKS_FINANCE", "VIEW_BOOK_REPORTS"
  ,"VIEW_LIBRARY", "VIEW_LIBRARY_REPORTS", "VIEW_LIBRARY_CIRCULATION", "VIEW_LIBRARY_CIRCULATION_REPORTS"
  ,"VIEW_LIBRARY_BARCODES"
  ,"VIEW_LIBRARY_INCIDENTS", "APPROVE_LIBRARY_INCIDENTS", "VIEW_LIBRARY_CHARGES", "APPROVE_LIBRARY_CHARGES", "VIEW_LIBRARY_CHARGE_REPORTS"
  ,"VIEW_LIBRARY_STOCK_VERIFICATION", "REVIEW_LIBRARY_STOCK_DISCREPANCIES", "VIEW_LIBRARY_STOCK_REPORTS"
  ,"VIEW_TEACHER_ANALYTICS_REPORTS"
  ,"VIEW_AI_ASSISTANT", "USE_AI_ASSISTANT_DOCUMENTATION", "USE_AI_ASSISTANT_AGGREGATES", "VIEW_AI_ASSISTANT_AUDIT"
  ,"VIEW_FEE_REGISTER_OCR", "VIEW_FEE_REGISTER_OCR_IMAGES", "REVIEW_FEE_REGISTER_OCR_ROWS", "APPROVE_FEE_REGISTER_OCR_BATCHES", "VIEW_FEE_REGISTER_OCR_REPORTS"
  ,"VIEW_CLOUD_BACKUP", "VERIFY_CLOUD_BACKUP", "RUN_CLOUD_BACKUP_RESTORE_REHEARSAL", "VIEW_CLOUD_BACKUP_REPORTS", "EXPORT_CLOUD_BACKUP_REPORTS"
  ,"VIEW_PUBLIC_WEBSITE_ADMIN", "MANAGE_PUBLIC_WEBSITE_SETTINGS", "MANAGE_PUBLIC_WEBSITE_PAGES", "MANAGE_PUBLIC_WEBSITE_POSTS", "REVIEW_PUBLIC_WEBSITE_CONTENT", "PUBLISH_PUBLIC_WEBSITE_CONTENT", "MANAGE_PUBLIC_WEBSITE_NAVIGATION", "PREVIEW_PUBLIC_WEBSITE_DRAFTS", "VIEW_PUBLIC_WEBSITE_REPORTS", "EXPORT_PUBLIC_WEBSITE_REPORTS"
]);

const adminPermissions = new Set<CanonicalPermission>([
  "VIEW_DASHBOARD",
  "VIEW_STUDENTS",
  "CREATE_STUDENTS",
  "EDIT_STUDENTS",
  "EXPORT_STUDENTS",
  "IMPORT_STUDENTS",
  "VIEW_STUDENT_LIFECYCLE",
  "MANAGE_STUDENT_LIFECYCLE",
  "VIEW_ACADEMIC_YEAR_ENROLLMENTS",
  "MANAGE_ACADEMIC_YEAR_ENROLLMENTS",
  "VIEW_STUDENT_PROGRESSION", "MANAGE_STUDENT_PROGRESSION", "APPROVE_STUDENT_PROGRESSION", "FINALIZE_STUDENT_PROGRESSION", "VIEW_STUDENT_PROGRESSION_REPORTS",
  "VIEW_UDISE_CHECKLIST", "EXPORT_UDISE_CHECKLIST",
  "VIEW_GUARDIANS",
  "MANAGE_GUARDIANS",
  "IMPORT_GUARDIANS",
  "VIEW_STAFF",
  "MANAGE_STAFF",
  "IMPORT_STAFF",
  "VIEW_NOTICES",
  "MANAGE_NOTICES",
  "PUBLISH_NOTICES",
  "VIEW_NOTIFICATION_CENTRE", "VIEW_OWN_NOTIFICATIONS", "MANAGE_NOTIFICATION_TEMPLATES", "CREATE_NOTIFICATION_CAMPAIGNS", "REVIEW_NOTIFICATION_CAMPAIGNS", "SCHEDULE_NOTIFICATION_CAMPAIGNS", "PUBLISH_NOTIFICATION_CAMPAIGNS", "WITHDRAW_NOTIFICATION_CAMPAIGNS", "VIEW_NOTIFICATION_REPORTS", "EXPORT_NOTIFICATION_REPORTS", "ACKNOWLEDGE_OWN_NOTIFICATIONS",
  "VIEW_WHATSAPP_CENTRE", "MANAGE_WHATSAPP_INTEGRATION", "MANAGE_WHATSAPP_CONSENTS", "MANAGE_WHATSAPP_TEMPLATE_MAPPINGS", "CREATE_WHATSAPP_BATCHES", "PROCESS_WHATSAPP_QUEUE", "VIEW_WHATSAPP_REPORTS", "EXPORT_WHATSAPP_REPORTS",
  "VIEW_SMS_EMAIL_CENTRE", "MANAGE_SMS_EMAIL_INTEGRATIONS", "MANAGE_SMS_EMAIL_CONSENTS", "MANAGE_SMS_EMAIL_TEMPLATES", "CREATE_SMS_EMAIL_BATCHES", "PROCESS_SMS_EMAIL_QUEUE", "VIEW_SMS_EMAIL_REPORTS", "EXPORT_SMS_EMAIL_REPORTS",
  "VIEW_HOMEWORK", "MANAGE_HOMEWORK", "PUBLISH_HOMEWORK", "ARCHIVE_HOMEWORK", "VIEW_HOMEWORK_REPORTS", "EXPORT_HOMEWORK_REPORTS",
  "VIEW_EXAMS", "MANAGE_EXAMS", "CONFIGURE_EXAM_ASSESSMENTS", "VIEW_EXAM_REPORTS", "EXPORT_EXAM_REPORTS",
  "VIEW_REPORT_CARDS", "MANAGE_REPORT_CARD_TEMPLATES", "MANAGE_REPORT_CARD_BATCHES", "ENTER_REPORT_CARD_DATA", "SUBMIT_REPORT_CARDS", "VIEW_REPORT_CARD_REPORTS", "EXPORT_REPORT_CARD_REPORTS",
  "VIEW_CERTIFICATES", "MANAGE_CERTIFICATE_REQUESTS", "CREATE_CERTIFICATES", "REVIEW_CERTIFICATES", "VIEW_CERTIFICATE_REPORTS", "EXPORT_CERTIFICATE_REPORTS",
  "VIEW_CLASS_X_PACKAGES", "MANAGE_CLASS_X_PACKAGES", "MANAGE_CLASS_X_DOCUMENT_CUSTODY", "VIEW_CLASS_X_PACKAGE_REPORTS", "EXPORT_CLASS_X_PACKAGE_REPORTS",
  "VIEW_ID_CARDS", "MANAGE_ID_CARD_TEMPLATES", "MANAGE_ID_CARD_NUMBER_SERIES", "CREATE_ID_CARDS", "MANAGE_ID_CARD_BATCHES", "USE_ID_CARD_LOOKUP", "VIEW_ID_CARD_REPORTS", "EXPORT_ID_CARD_REPORTS",
  "VIEW_PAYMENTS",
  "VIEW_DAILY_COLLECTION",
  "VIEW_PENDING_DUES",
  "VIEW_LEDGER",
  "PRINT_RECEIPTS",
  "PRINT_LEDGER",
  "PRINT_REPORTS",
  "VIEW_RECEIPT_AUDIT",
  "COMMUNICATE_PARENT",
  "EXPORT_PAYMENTS",
  "EXPORT_REPORTS",
  "EXPORT_REMINDERS",
  "VIEW_IMPORT_EXPORT",
  "RUN_IMPORTS",
  "VIEW_IMPORT_VERIFICATION",
  "RUN_PILOT_ACCEPTANCE",
  "VIEW_TIMETABLE",
  "PRINT_TIMETABLE",
  "VIEW_USERS",
  "MANAGE_USERS",
  "RESET_USER_PASSWORDS",
  "VIEW_SETTINGS",
  "MANAGE_SCHOOL_SETTINGS",
  "VIEW_SYSTEM_HEALTH",
  "RUN_BACKUP"
  ,"VIEW_STUDENT_ATTENDANCE", "MANAGE_STUDENT_ATTENDANCE", "SUBMIT_STUDENT_ATTENDANCE", "LOCK_STUDENT_ATTENDANCE", "VIEW_STUDENT_ATTENDANCE_REPORTS"
  ,"VIEW_STAFF_ATTENDANCE", "MANAGE_STAFF_ATTENDANCE", "SUBMIT_STAFF_ATTENDANCE", "LOCK_STAFF_ATTENDANCE", "VIEW_STAFF_ATTENDANCE_REPORTS"
  ,"VIEW_STAFF_LEAVE", "APPLY_STAFF_LEAVE", "MANAGE_STAFF_LEAVE", "APPROVE_STAFF_LEAVE", "VIEW_STAFF_LEAVE_REPORTS"
  ,"VIEW_SUBSTITUTES", "MANAGE_SUBSTITUTES", "ASSIGN_SUBSTITUTES", "CONFIRM_SUBSTITUTES", "VIEW_SUBSTITUTE_REPORTS"
  ,"VIEW_VENDORS", "MANAGE_VENDORS", "VIEW_EXPENSES", "MANAGE_EXPENSES", "APPROVE_EXPENSES", "MARK_EXPENSE_PAID", "CANCEL_EXPENSES", "VIEW_EXPENSE_REPORTS", "EXPORT_EXPENSE_REPORTS"
  ,"VIEW_BUDGETS", "MANAGE_BUDGETS", "VIEW_BUDGET_REPORTS", "EXPORT_BUDGET_REPORTS"
  ,"VIEW_MISC_INCOME", "MANAGE_MISC_INCOME", "CANCEL_MISC_INCOME", "MANAGE_MISC_INCOME_ITEMS", "VIEW_MISC_INCOME_REPORTS", "EXPORT_MISC_INCOME_REPORTS"
  ,"VIEW_CASH_BOOK", "MANAGE_CASH_BOOK", "SUBMIT_CASH_BOOK", "VIEW_CASH_BOOK_REPORTS", "EXPORT_CASH_BOOK_REPORTS"
  ,"VIEW_BOOKS_FINANCE", "MANAGE_BOOK_CATALOG", "MANAGE_BOOK_RATES", "MANAGE_BOOK_SALES", "CANCEL_BOOK_SALES", "MANAGE_BOOK_CASH_SETTLEMENT", "SUBMIT_BOOK_CASH_SETTLEMENT", "VIEW_BOOK_REPORTS", "EXPORT_BOOK_REPORTS", "MANAGE_PUBLISHER_BILLS"
  ,"VIEW_LIBRARY", "MANAGE_LIBRARY_CATALOG", "MANAGE_LIBRARY_COPIES", "IMPORT_LIBRARY_CATALOG", "VIEW_LIBRARY_REPORTS", "EXPORT_LIBRARY_REPORTS"
  ,"VIEW_LIBRARY_BARCODES", "MANAGE_LIBRARY_BARCODES", "PRINT_LIBRARY_BARCODE_LABELS", "USE_LIBRARY_SCANNER"
  ,"VIEW_LIBRARY_CIRCULATION", "MANAGE_LIBRARY_MEMBERS", "MANAGE_LIBRARY_POLICIES", "ISSUE_LIBRARY_BOOKS", "RETURN_LIBRARY_BOOKS", "RENEW_LIBRARY_BOOKS", "MANAGE_LIBRARY_RESERVATIONS", "VIEW_LIBRARY_CIRCULATION_REPORTS", "EXPORT_LIBRARY_CIRCULATION_REPORTS"
  ,"VIEW_LIBRARY_INCIDENTS", "MANAGE_LIBRARY_INCIDENTS", "APPROVE_LIBRARY_INCIDENTS", "VIEW_LIBRARY_CHARGES", "ASSESS_LIBRARY_CHARGES", "APPROVE_LIBRARY_CHARGES", "CANCEL_LIBRARY_CHARGES", "VIEW_LIBRARY_CHARGE_REPORTS", "EXPORT_LIBRARY_CHARGE_REPORTS"
  ,"VIEW_LIBRARY_STOCK_VERIFICATION", "MANAGE_LIBRARY_STOCK_VERIFICATION", "SCAN_LIBRARY_STOCK", "REVIEW_LIBRARY_STOCK_DISCREPANCIES", "APPLY_LIBRARY_STOCK_CORRECTIONS", "APPROVE_LIBRARY_STOCK_VERIFICATION", "VIEW_LIBRARY_STOCK_REPORTS", "EXPORT_LIBRARY_STOCK_REPORTS"
  ,"VIEW_AI_ASSISTANT", "USE_AI_ASSISTANT_DOCUMENTATION"
  ,"VIEW_FEE_REGISTER_OCR", "VIEW_FEE_REGISTER_OCR_IMAGES", "UPLOAD_FEE_REGISTER_PAGES", "RUN_FEE_REGISTER_OCR", "REVIEW_FEE_REGISTER_OCR_ROWS", "VIEW_FEE_REGISTER_OCR_REPORTS"
  ,"VIEW_CLOUD_BACKUP", "MANAGE_CLOUD_BACKUP_PROFILES", "MANAGE_CLOUD_BACKUP_SCHEDULES", "RUN_CLOUD_BACKUP", "VERIFY_CLOUD_BACKUP", "VIEW_CLOUD_BACKUP_REPORTS", "EXPORT_CLOUD_BACKUP_REPORTS"
  ,"VIEW_PUBLIC_WEBSITE_ADMIN", "MANAGE_PUBLIC_WEBSITE_SETTINGS", "MANAGE_PUBLIC_WEBSITE_PAGES", "MANAGE_PUBLIC_WEBSITE_POSTS", "MANAGE_PUBLIC_WEBSITE_NAVIGATION", "PREVIEW_PUBLIC_WEBSITE_DRAFTS", "VIEW_PUBLIC_WEBSITE_REPORTS", "EXPORT_PUBLIC_WEBSITE_REPORTS"
]);

const accountantPermissions = new Set<CanonicalPermission>([
  "VIEW_DASHBOARD",
  "VIEW_PAYMENTS",
  "CREATE_PAYMENTS",
  "CANCEL_FINAL_RECEIPT",
  "CORRECT_FINAL_RECEIPT",
  "VIEW_DAILY_COLLECTION",
  "VIEW_PENDING_DUES",
  "VIEW_LEDGER",
  "PRINT_RECEIPTS",
  "PRINT_LEDGER",
  "PRINT_REPORTS",
  "VIEW_RECEIPT_AUDIT",
  "EXPORT_PAYMENTS",
  "EXPORT_REPORTS",
  "VIEW_IMPORT_EXPORT",
  "VIEW_VENDORS", "MANAGE_VENDORS", "VIEW_EXPENSES", "MANAGE_EXPENSES", "MARK_EXPENSE_PAID", "VIEW_EXPENSE_REPORTS", "EXPORT_EXPENSE_REPORTS",
  "VIEW_BUDGETS", "MANAGE_BUDGETS", "VIEW_BUDGET_REPORTS", "EXPORT_BUDGET_REPORTS"
  ,"VIEW_MISC_INCOME", "MANAGE_MISC_INCOME", "MANAGE_MISC_INCOME_ITEMS", "VIEW_MISC_INCOME_REPORTS", "EXPORT_MISC_INCOME_REPORTS"
  ,"VIEW_CASH_BOOK", "MANAGE_CASH_BOOK", "SUBMIT_CASH_BOOK", "VIEW_CASH_BOOK_REPORTS", "EXPORT_CASH_BOOK_REPORTS"
  ,"VIEW_BOOKS_FINANCE", "MANAGE_BOOK_SALES", "MANAGE_BOOK_CASH_SETTLEMENT", "SUBMIT_BOOK_CASH_SETTLEMENT", "VIEW_BOOK_REPORTS", "EXPORT_BOOK_REPORTS", "MANAGE_PUBLISHER_BILLS"
  ,"VIEW_LIBRARY_CHARGES", "COLLECT_LIBRARY_CHARGES", "VIEW_LIBRARY_CHARGE_REPORTS", "EXPORT_LIBRARY_CHARGE_REPORTS"
  ,"VIEW_CLASS_X_PACKAGES", "COLLECT_CLASS_X_PACKAGE_PAYMENTS", "VIEW_CLASS_X_PACKAGE_REPORTS", "EXPORT_CLASS_X_PACKAGE_REPORTS"
  ,"VIEW_OWN_NOTIFICATIONS", "ACKNOWLEDGE_OWN_NOTIFICATIONS"
  ,"MANAGE_OWN_WHATSAPP_CONSENT"
  ,"MANAGE_OWN_SMS_EMAIL_CONSENT"
  ,"VIEW_FEE_REGISTER_OCR", "VIEW_FEE_REGISTER_OCR_IMAGES", "UPLOAD_FEE_REGISTER_PAGES", "RUN_FEE_REGISTER_OCR", "REVIEW_FEE_REGISTER_OCR_ROWS", "PREVIEW_FEE_REGISTER_OCR_POSTING", "POST_FEE_REGISTER_OCR_PAYMENTS", "RESOLVE_FEE_REGISTER_OCR_DUPLICATES", "VIEW_FEE_REGISTER_OCR_REPORTS", "EXPORT_FEE_REGISTER_OCR_REPORTS"
]);

const viewerPermissions = new Set<CanonicalPermission>([
  "VIEW_DASHBOARD",
  "VIEW_PENDING_DUES",
  "VIEW_DAILY_COLLECTION",
  "VIEW_NOTICES",
  "VIEW_HOMEWORK_REPORTS",
  "VIEW_EXAM_REPORTS",
  "VIEW_REPORT_CARD_REPORTS",
  "VIEW_STAFF"
  ,"VIEW_STUDENT_LIFECYCLE", "VIEW_ACADEMIC_YEAR_ENROLLMENTS"
  ,"VIEW_STUDENT_PROGRESSION", "VIEW_STUDENT_PROGRESSION_REPORTS"
  ,"VIEW_UDISE_CHECKLIST"
  ,"VIEW_STUDENT_ATTENDANCE_REPORTS", "VIEW_STAFF_ATTENDANCE_REPORTS"
  ,"VIEW_STAFF_LEAVE_REPORTS"
  ,"VIEW_SUBSTITUTE_REPORTS"
  ,"VIEW_EXPENSES", "VIEW_EXPENSE_REPORTS"
  ,"VIEW_BUDGETS", "VIEW_BUDGET_REPORTS"
  ,"VIEW_MISC_INCOME", "VIEW_MISC_INCOME_REPORTS", "VIEW_CASH_BOOK", "VIEW_CASH_BOOK_REPORTS"
  ,"VIEW_BOOKS_FINANCE", "VIEW_BOOK_REPORTS"
  ,"VIEW_LIBRARY", "VIEW_LIBRARY_REPORTS", "VIEW_LIBRARY_CIRCULATION_REPORTS"
  ,"VIEW_LIBRARY_CHARGE_REPORTS"
  ,"VIEW_LIBRARY_STOCK_REPORTS"
  ,"VIEW_TEACHER_ANALYTICS_REPORTS"
  ,"VIEW_CERTIFICATE_REPORTS"
  ,"VIEW_CLASS_X_PACKAGE_REPORTS"
  ,"VIEW_ID_CARD_REPORTS"
  ,"VIEW_NOTIFICATION_CENTRE", "VIEW_OWN_NOTIFICATIONS", "VIEW_NOTIFICATION_REPORTS", "ACKNOWLEDGE_OWN_NOTIFICATIONS"
  ,"VIEW_WHATSAPP_CENTRE", "VIEW_WHATSAPP_REPORTS"
  ,"VIEW_SMS_EMAIL_CENTRE", "VIEW_SMS_EMAIL_REPORTS"
  ,"VIEW_FEE_REGISTER_OCR_REPORTS"
  ,"VIEW_CLOUD_BACKUP", "VIEW_CLOUD_BACKUP_REPORTS"
  ,"VIEW_PUBLIC_WEBSITE_ADMIN", "VIEW_PUBLIC_WEBSITE_REPORTS"
]);

export const RECOMMENDED_ROLE_PERMISSIONS: Record<Role, ReadonlySet<CanonicalPermission>> = {
  SUPER_ADMIN: new Set(PERMISSIONS),
  DIRECTOR: directorPermissions,
  PRINCIPAL: principalPermissions,
  ADMIN: adminPermissions,
  ACCOUNTANT: accountantPermissions,
  TEACHER: new Set(["VIEW_TEACHER_PLACEHOLDER", "VIEW_STUDENT_ATTENDANCE", "MANAGE_STUDENT_ATTENDANCE", "SUBMIT_STUDENT_ATTENDANCE", "VIEW_STUDENT_ATTENDANCE_REPORTS", "VIEW_STAFF_LEAVE", "APPLY_STAFF_LEAVE", "VIEW_SUBSTITUTES", "VIEW_OWN_LIBRARY_PORTAL", "VIEW_HOMEWORK", "MANAGE_HOMEWORK", "PUBLISH_HOMEWORK", "VIEW_HOMEWORK_REPORTS", "VIEW_OWN_HOMEWORK_PORTAL", "VIEW_EXAMS", "ENTER_MARKS", "SUBMIT_MARKS", "VIEW_OWN_EXAM_ASSIGNMENTS", "VIEW_OWN_EXAM_MARKS", "ENTER_ASSIGNED_EXAM_MARKS", "SUBMIT_ASSIGNED_EXAM_MARKS", "REQUEST_EXAM_MARK_CORRECTION", "VIEW_REPORT_CARDS", "ENTER_REPORT_CARD_DATA", "SUBMIT_REPORT_CARDS", "VIEW_OWN_TEACHER_ANALYTICS", "VIEW_OWN_STAFF_ID_CARD", "VIEW_OWN_NOTIFICATIONS", "CREATE_SCOPED_NOTIFICATIONS", "ACKNOWLEDGE_OWN_NOTIFICATIONS", "MANAGE_OWN_WHATSAPP_CONSENT", "MANAGE_OWN_SMS_EMAIL_CONSENT"]),
  PARENT: new Set(["VIEW_PARENT_PLACEHOLDER", "VIEW_OWN_LIBRARY_PORTAL", "VIEW_OWN_HOMEWORK_PORTAL", "VIEW_OWN_REPORT_CARDS", "REQUEST_OWN_CHILD_CERTIFICATES", "VIEW_OWN_CHILD_CERTIFICATES", "REQUEST_OWN_CHILD_CLASS_X_PACKAGE", "VIEW_OWN_CHILD_CLASS_X_PACKAGE", "VIEW_OWN_STUDENT_ID_CARDS", "VIEW_OWN_NOTIFICATIONS", "ACKNOWLEDGE_OWN_NOTIFICATIONS", "MANAGE_OWN_WHATSAPP_CONSENT", "MANAGE_OWN_SMS_EMAIL_CONSENT"]),
  VIEWER: viewerPermissions
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function normalizePermission(permission: string): CanonicalPermission | null {
  const canonical = (LEGACY_PERMISSION_ALIASES as Record<string, CanonicalPermission>)[permission] ?? permission;
  return (PERMISSIONS as readonly string[]).includes(canonical) ? canonical as CanonicalPermission : null;
}

export function can(role: Role, permission: Permission | string) {
  if (role === "SUPER_ADMIN") return true;
  const canonical = normalizePermission(permission);
  return Boolean(canonical && RECOMMENDED_ROLE_PERMISSIONS[role].has(canonical));
}

export function permissionLabel(permission: CanonicalPermission) {
  for (const group of PERMISSION_GROUPS) {
    const found = group.permissions.find((item) => item.permission === permission);
    if (found) return found.label;
  }
  return permission;
}
