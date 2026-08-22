import { normalizePermission, type CanonicalPermission, type Permission, type Role } from "@/lib/permissions";
import type { OptionalOperationsFeatureCode } from "@/lib/optional-operations-feature-flags";

export type NavigationIcon =
  | "dashboard"
  | "commandCenter"
  | "search"
  | "students"
  | "add"
  | "payments"
  | "rupee"
  | "dues"
  | "collection"
  | "ledger"
  | "audit"
  | "guardians"
  | "staff"
  | "attendance"
  | "leave"
  | "notices"
  | "timetable"
  | "settings"
  | "users"
  | "roles"
  | "importExport"
  | "importVerification"
  | "pilot"
  | "udise"
  | "library"
  | "aiAssistant"
  | "feeRegisterOcr"
  | "cloudBackup"
  | "website"
  | "calendar"
  | "operations"
  | "eventMedia";

export type NavigationGroupId =
  | "dashboard"
  | "studentsParents"
  | "feesReports"
  | "attendance"
  | "staffLeave"
  | "timetable"
  | "communication"
  | "operations"
  | "administration"
  | "system";

export const NAV_GROUPS: Array<{ id: NavigationGroupId; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "studentsParents", label: "Students & Parents" },
  { id: "feesReports", label: "Fees & Reports" },
  { id: "attendance", label: "Attendance" },
  { id: "staffLeave", label: "Staff & Leave" },
  { id: "timetable", label: "Timetable" },
  { id: "communication", label: "Communication" },
  { id: "operations", label: "Operations" },
  { id: "administration", label: "Administration" },
  { id: "system", label: "System" }
];

export const NAV_ITEMS = [
  { href: "/super-admin/command-center", label: "Command Center", icon: "commandCenter", permission: "VIEW_DASHBOARD", group: "dashboard", allowedRoles: ["SUPER_ADMIN"] as Role[] },
  { href: "/super-admin/search", label: "Search", icon: "search", permission: "VIEW_DASHBOARD", group: "dashboard", allowedRoles: ["SUPER_ADMIN"] as Role[] },
  { href: "/super-admin/ai", label: "Smart AI", icon: "aiAssistant", permission: "VIEW_DASHBOARD", group: "dashboard", allowedRoles: ["SUPER_ADMIN"] as Role[] },
  { href: "/super-admin/my-work", label: "My Work", icon: "calendar", permission: "VIEW_DASHBOARD", group: "dashboard", allowedRoles: ["SUPER_ADMIN"] as Role[] },
  { href: "/super-admin/whiteboard", label: "Whiteboard", icon: "commandCenter", permission: "VIEW_DASHBOARD", group: "dashboard", allowedRoles: ["SUPER_ADMIN"] as Role[] },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", permission: "VIEW_DASHBOARD", group: "dashboard" },
  { href: "/students", label: "Students", icon: "students", permission: "VIEW_STUDENTS", group: "studentsParents" },
  { href: "/students/lifecycle", label: "Student Lifecycle", icon: "students", permission: "VIEW_STUDENT_LIFECYCLE", group: "studentsParents" },
  { href: "/students/progression", label: "Student Progression", icon: "students", permission: "VIEW_STUDENT_PROGRESSION", group: "studentsParents" },
  { href: "/udise", label: "UDISE Checklist", icon: "udise", permission: "VIEW_UDISE_CHECKLIST", group: "administration" },
  { href: "/students/new", label: "Add Student", icon: "add", permission: "CREATE_STUDENTS", group: "studentsParents" },
  { href: "/guardians", label: "Parents / Guardians", icon: "guardians", permission: "VIEW_GUARDIANS", group: "studentsParents" },
  { href: "/admission-crm", label: "Admissions CRM", icon: "students", permission: "VIEW_ADMISSIONS", group: "studentsParents" },
  { href: "/admission-crm", label: "Assigned Admission Reviews", icon: "students", permission: "REVIEW_ADMISSION_APPLICATIONS", group: "studentsParents", requiredRole: "TEACHER" },
  { href: "/admission-crm/reports", label: "Admissions Reports", icon: "collection", permission: "VIEW_ADMISSION_REPORTS", group: "studentsParents" },
  { href: "/staff", label: "Staff / Teachers", icon: "staff", permission: "VIEW_STAFF", group: "staffLeave" },
  { href: "/attendance/students", label: "Student Attendance", icon: "attendance", permission: "VIEW_STUDENT_ATTENDANCE", group: "attendance" },
  { href: "/attendance/students/reports", label: "Attendance Reports", icon: "collection", permission: "VIEW_STUDENT_ATTENDANCE_REPORTS", group: "attendance" },
  { href: "/student-departures", label: "Student Safe Exit", icon: "attendance", permission: "REQUEST_STUDENT_DEPARTURE", group: "attendance", allowedRoles: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "COMPUTER_OPERATOR", "TEACHER"] as Role[] },
  { href: "/student-departures/gate", label: "Gate Pass Verification", icon: "attendance", permission: "VERIFY_GATE_PASS", group: "attendance" },
  { href: "/student-departures/roster", label: "Live Campus Roster", icon: "attendance", permission: "VIEW_LIVE_CAMPUS_ROSTER", group: "attendance" },
  { href: "/attendance/staff", label: "Staff Attendance", icon: "attendance", permission: "VIEW_STAFF_ATTENDANCE", group: "attendance" },
  { href: "/attendance/staff/reports", label: "Staff Attendance Reports", icon: "collection", permission: "VIEW_STAFF_ATTENDANCE_REPORTS", group: "attendance" },
  { href: "/leave/staff", label: "Staff Leave", icon: "leave", permission: "VIEW_STAFF_LEAVE", group: "staffLeave" },
  { href: "/leave/staff/reports", label: "Staff Leave Reports", icon: "collection", permission: "VIEW_STAFF_LEAVE_REPORTS", group: "staffLeave" },
  { href: "/substitutes", label: "Substitute Teachers", icon: "staff", permission: "VIEW_SUBSTITUTES", group: "staffLeave" },
  { href: "/substitutes/reports", label: "Substitute Reports", icon: "collection", permission: "VIEW_SUBSTITUTE_REPORTS", group: "staffLeave" },
  { href: "/payroll", label: "Payroll & Payslips", icon: "rupee", permission: "VIEW_PAYROLL", group: "staffLeave" },
  { href: "/payroll/reports", label: "Payroll Reports", icon: "collection", permission: "VIEW_PAYROLL_REPORTS", group: "staffLeave" },
  { href: "/payroll/reports", label: "Payroll Aggregates", icon: "collection", permission: "VIEW_PAYROLL_AGGREGATES", group: "staffLeave" },
  { href: "/my-payroll", label: "My Payroll", icon: "rupee", permission: "VIEW_OWN_PAYROLL", group: "staffLeave" },
  { href: "/payslip-requests", label: "Payslip Requests", icon: "rupee", permission: "VIEW_PAYSLIP_REQUESTS", group: "staffLeave" },
  { href: "/my-payslip-requests", label: "My Payslip Requests", icon: "rupee", permission: "VIEW_OWN_PAYSLIP_REQUESTS", group: "staffLeave", requiredRole: "TEACHER" },
  { href: "/notices", label: "Parent Notices", icon: "notices", permission: "VIEW_NOTICES", group: "communication" },
  { href: "/notifications/manage", label: "Notification Campaigns", icon: "notices", permission: "CREATE_NOTIFICATION_CAMPAIGNS", group: "communication" },
  { href: "/notifications/reports", label: "Notification Reports", icon: "collection", permission: "VIEW_NOTIFICATION_REPORTS", group: "communication" },
  { href: "/support", label: "Support & Complaints", icon: "notices", permission: "VIEW_SUPPORT_REQUESTS", group: "communication" },
  { href: "/support/reports", label: "Support Reports", icon: "collection", permission: "VIEW_SUPPORT_REPORTS", group: "communication" },
  { href: "/my-support", label: "My Support", icon: "notices", permission: "VIEW_OWN_SUPPORT", group: "communication", allowedRoles: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "ACCOUNTANT", "COMPUTER_OPERATOR", "TEACHER"] as Role[] },
  { href: "/parent/support", label: "Support", icon: "notices", permission: "VIEW_OWN_SUPPORT", group: "studentsParents", requiredRole: "PARENT" },
  { href: "/parent/student-departures", label: "Student Early Leave", icon: "attendance", permission: "REQUEST_STUDENT_DEPARTURE", group: "studentsParents", requiredRole: "PARENT" },
  { href: "/whatsapp", label: "WhatsApp Centre", icon: "notices", permission: "VIEW_WHATSAPP_CENTRE", group: "communication" },
  { href: "/whatsapp/reports", label: "WhatsApp Reports", icon: "collection", permission: "VIEW_WHATSAPP_REPORTS", group: "communication" },
  { href: "/sms-email", label: "SMS & Email Centre", icon: "notices", permission: "VIEW_SMS_EMAIL_CENTRE", group: "communication" },
  { href: "/sms-email/reports", label: "SMS & Email Reports", icon: "collection", permission: "VIEW_SMS_EMAIL_REPORTS", group: "communication" },
  { href: "/homework/reports", label: "Homework Reports", icon: "notices", permission: "VIEW_HOMEWORK_REPORTS", group: "communication" },
  { href: "/homework", label: "Homework", icon: "notices", permission: "VIEW_HOMEWORK", group: "communication" },
  { href: "/classwork", label: "Classwork & Submissions", icon: "notices", permission: "VIEW_CLASSWORK", group: "communication" },
  { href: "/event-media", label: "Event Media", icon: "eventMedia", permission: "VIEW_EVENT_MEDIA", group: "communication", allowedRoles: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"] as Role[] },
  { href: "/my-classwork", label: "My Classwork", icon: "notices", permission: "VIEW_OWN_CLASSWORK", group: "studentsParents" },
  { href: "/parent/event-media", label: "Event Gallery", icon: "eventMedia", permission: "VIEW_OWN_EVENT_MEDIA", group: "studentsParents", requiredRole: "PARENT" },
  { href: "/exams", label: "Exams", icon: "timetable", permission: "VIEW_EXAMS", group: "communication" },
  { href: "/exams/configuration", label: "Examination Setup", icon: "timetable", permission: "VIEW_EXAM_CONFIGURATION", group: "communication" },
  { href: "/exams/timetable", label: "Examination Timetable", icon: "timetable", permission: "VIEW_EXAM_TIMETABLE", group: "communication" },
  { href: "/calendar", label: "Academic Calendar", icon: "calendar", permission: "VIEW_CALENDAR_MANAGEMENT", group: "communication" },
  { href: "/teacher/calendar", label: "My Calendar", icon: "calendar", permission: "VIEW_STAFF_CALENDAR", group: "communication", requiredRole: "TEACHER" },
  { href: "/parent/calendar", label: "School Calendar", icon: "calendar", permission: "VIEW_OWN_CALENDAR", group: "studentsParents", requiredRole: "PARENT" },
  { href: "/exams/moderation", label: "Marks Moderation", icon: "collection", permission: "VIEW_EXAM_MODERATION", group: "communication" },
  { href: "/teacher/exam-assignments", label: "My Exam Assignments", icon: "timetable", permission: "VIEW_OWN_EXAM_ASSIGNMENTS", group: "communication", requiredRole: "TEACHER" },
  { href: "/marks", label: "Marks Entry", icon: "attendance", permission: "ENTER_MARKS", group: "communication" },
  { href: "/marks/governed", label: "Governed Marks", icon: "attendance", permission: "ENTER_ASSIGNED_EXAM_MARKS", group: "communication" },
  { href: "/marks/delegation", label: "Marks Delegation", icon: "roles", permission: "ENTER_MARKS", group: "administration", allowedRoles: ["SUPER_ADMIN", "PRINCIPAL"] as Role[] },
  { href: "/marks/reports", label: "Exam Reports", icon: "collection", permission: "VIEW_EXAM_REPORTS", group: "communication" },
  { href: "/report-cards", label: "Report Cards", icon: "timetable", permission: "VIEW_REPORT_CARDS", group: "communication" },
  { href: "/report-cards/reports", label: "Report Card Reports", icon: "collection", permission: "VIEW_REPORT_CARD_REPORTS", group: "communication" },
  { href: "/academic-reports", label: "Academic Reporting", icon: "collection", permission: "VIEW_REPORT_CARD_REPORTS", group: "communication", allowedRoles: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "VIEWER"] as Role[] },
  { href: "/student/results", label: "Published Progress", icon: "collection", permission: "VIEW_OWN_REPORT_CARDS", group: "studentsParents", requiredRole: "STUDENT" },
  { href: "/certificates", label: "Certificates", icon: "timetable", permission: "VIEW_CERTIFICATES", group: "communication" },
  { href: "/certificates/reports", label: "Certificate Reports", icon: "collection", permission: "VIEW_CERTIFICATE_REPORTS", group: "communication" },
  { href: "/class-x-documents", label: "Class X Documents", icon: "timetable", permission: "VIEW_CLASS_X_PACKAGES", group: "communication" },
  { href: "/class-x-documents/reports", label: "Class X Package Reports", icon: "collection", permission: "VIEW_CLASS_X_PACKAGE_REPORTS", group: "communication" },
  { href: "/id-cards", label: "ID Cards", icon: "timetable", permission: "VIEW_ID_CARDS", group: "communication" },
  { href: "/id-cards/reports", label: "ID Card Reports", icon: "collection", permission: "VIEW_ID_CARD_REPORTS", group: "communication" },
  { href: "/parent/class-x-documents", label: "Class X Documents", icon: "timetable", permission: "VIEW_OWN_CHILD_CLASS_X_PACKAGE", group: "studentsParents", requiredRole: "PARENT" },
  { href: "/teacher-analytics", label: "Teacher Analytics", icon: "staff", permission: "VIEW_TEACHER_ANALYTICS", group: "staffLeave" },
  { href: "/teacher-analytics/reports", label: "Teacher Analytics Reports", icon: "collection", permission: "VIEW_TEACHER_ANALYTICS_REPORTS", group: "staffLeave" },
  { href: "/teacher/analytics", label: "My Teacher Analytics", icon: "staff", permission: "VIEW_OWN_TEACHER_ANALYTICS", group: "staffLeave", requiredRole: "TEACHER" },
  { href: "/ai-assistant", label: "Read-only AI Assistant", icon: "aiAssistant", permission: "VIEW_AI_ASSISTANT", group: "administration" },
  { href: "/fee-register-ocr", label: "Fee Register OCR", icon: "feeRegisterOcr", permission: "VIEW_FEE_REGISTER_OCR", group: "feesReports" },
  { href: "/fee-register-ocr/reports", label: "OCR Aggregate Reports", icon: "feeRegisterOcr", permission: "VIEW_FEE_REGISTER_OCR_REPORTS", group: "feesReports" },
  { href: "/cloud-backup", label: "Encrypted Cloud Backup", icon: "cloudBackup", permission: "VIEW_CLOUD_BACKUP", group: "system" },
  { href: "/cloud-backup/reports", label: "Backup Recovery Reports", icon: "cloudBackup", permission: "VIEW_CLOUD_BACKUP_REPORTS", group: "system" },
  { href: "/website-admin", label: "Public Website", icon: "website", permission: "VIEW_PUBLIC_WEBSITE_ADMIN", group: "administration" },
  { href: "/payments", label: "Payments", icon: "payments", permission: "VIEW_PAYMENTS", group: "feesReports" },
  { href: "/payments/new", label: "Add Payment", icon: "rupee", permission: "CREATE_PAYMENTS", group: "feesReports" },
  { href: "/family-collections", label: "Family Collections", icon: "payments", permission: "VIEW_FAMILY_COLLECTIONS", group: "feesReports" },
  { href: "/family-collections/new", label: "New Family Collection", icon: "rupee", permission: "CREATE_FAMILY_COLLECTIONS", group: "feesReports" },
  { href: "/parent/family-receipts", label: "Family Fee Receipts", icon: "payments", permission: "VIEW_OWN_FAMILY_RECEIPTS", group: "studentsParents", requiredRole: "PARENT" },
  { href: "/pending-dues", label: "Pending Dues", icon: "dues", permission: "VIEW_PENDING_DUES", group: "feesReports" },
  { href: "/daily-collection", label: "Daily Collection", icon: "collection", permission: "VIEW_DAILY_COLLECTION", group: "feesReports" },
  { href: "/ledger", label: "Student Ledger", icon: "ledger", permission: "VIEW_LEDGER", group: "feesReports" },
  { href: "/receipt-audit", label: "Receipt / Payment Audit", icon: "audit", permission: "VIEW_RECEIPT_AUDIT", group: "feesReports" },
  { href: "/vendors", label: "Vendors", icon: "payments", permission: "VIEW_VENDORS", group: "feesReports" },
  { href: "/expenses", label: "Expenses", icon: "rupee", permission: "VIEW_EXPENSES", group: "feesReports" },
  { href: "/expenses/reports", label: "Expense Reports", icon: "collection", permission: "VIEW_EXPENSE_REPORTS", group: "feesReports" },
  { href: "/budgets", label: "Budgets", icon: "rupee", permission: "VIEW_BUDGETS", group: "feesReports" },
  { href: "/budgets/reports", label: "Budget Reports", icon: "collection", permission: "VIEW_BUDGET_REPORTS", group: "feesReports" },
  { href: "/misc-income", label: "Miscellaneous Income", icon: "payments", permission: "VIEW_MISC_INCOME", group: "feesReports" },
  { href: "/misc-income/reports", label: "Misc. Income Reports", icon: "collection", permission: "VIEW_MISC_INCOME_REPORTS", group: "feesReports" },
  { href: "/books", label: "Books Finance", icon: "payments", permission: "VIEW_BOOKS_FINANCE", group: "feesReports" },
  { href: "/books/reports", label: "Books Reports", icon: "collection", permission: "VIEW_BOOK_REPORTS", group: "feesReports" },
  { href: "/library", label: "Library", icon: "library", permission: "VIEW_LIBRARY", group: "administration" },
  { href: "/operations/transport", label: "Transport", icon: "operations", permission: "VIEW_TRANSPORT", group: "operations", featureFlag: "TRANSPORT_V1_5" as OptionalOperationsFeatureCode },
  { href: "/operations/cafeteria", label: "Cafeteria", icon: "operations", permission: "VIEW_CAFETERIA", group: "operations", featureFlag: "CAFETERIA_V1_5" as OptionalOperationsFeatureCode },
  { href: "/cash-book", label: "Daily Cash Book", icon: "rupee", permission: "VIEW_CASH_BOOK", group: "feesReports" },
  { href: "/cash-book/reports", label: "Cash Book Reports", icon: "collection", permission: "VIEW_CASH_BOOK_REPORTS", group: "feesReports" },
  { href: "/timetable", label: "Timetable", icon: "timetable", permission: "VIEW_TIMETABLE", group: "timetable" },
  { href: "/settings", label: "School / Fee Settings", icon: "settings", permission: "VIEW_SETTINGS", group: "system" },
  { href: "/settings/pwa", label: "PWA Diagnostics", icon: "settings", permission: "VIEW_SYSTEM_HEALTH", group: "system" },
  { href: "/technical-operations", label: "Technical Operations", icon: "settings", permission: "VIEW_TECHNICAL_OPERATIONS_SUMMARY", group: "system", allowedRoles: ["SUPER_ADMIN", "DIRECTOR"] as Role[] },
  { href: "/release-operations", label: "Release Operations", icon: "settings", permission: "VIEW_RELEASE_OPERATIONS_SUMMARY", group: "system", allowedRoles: ["SUPER_ADMIN", "DIRECTOR"] as Role[] },
  { href: "/users", label: "Named Users", icon: "users", permission: "VIEW_IAM_ACCESS", group: "administration" },
  { href: "/permission-profiles", label: "Permission Profiles", icon: "roles", permission: "VIEW_IAM_ACCESS", group: "administration" },
  { href: "/access-history", label: "Access History", icon: "audit", permission: "VIEW_IAM_AUDIT", group: "administration" },
  { href: "/roles", label: "Role Permissions", icon: "roles", permission: "MANAGE_ROLE_PERMISSIONS", group: "administration" },
  { href: "/import-export", label: "Import / Export", icon: "importExport", permission: "VIEW_IMPORT_EXPORT", group: "system" },
  { href: "/onboarding", label: "Bulk Onboarding", icon: "importExport", permission: "DOWNLOAD_ONBOARDING_TEMPLATE", group: "system", allowedRoles: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "COMPUTER_OPERATOR"] as Role[] },
  { href: "/import-verification", label: "Import Verification", icon: "importVerification", permission: "VIEW_IMPORT_VERIFICATION", group: "system" },
  { href: "/pilot-acceptance", label: "Pilot Acceptance", icon: "pilot", permission: "RUN_PILOT_ACCEPTANCE", group: "system" }
] satisfies Array<{ href: string; label: string; icon: NavigationIcon; permission: Permission; group: NavigationGroupId; requiredRole?: Role; allowedRoles?: Role[]; featureFlag?: OptionalOperationsFeatureCode }>;

export type NavigationItem = (typeof NAV_ITEMS)[number];

export function permissionListCan(permissions: Iterable<CanonicalPermission>, permission: Permission | string) {
  const canonical = normalizePermission(permission);
  if (!canonical) return false;
  return new Set(permissions).has(canonical);
}

export function visibleNavigationItems(permissions: Iterable<CanonicalPermission>, role?: Role, enabledFeatures: Iterable<OptionalOperationsFeatureCode> = []) {
  const features = new Set(enabledFeatures);
  return NAV_ITEMS.filter((item) =>
    permissionListCan(permissions, item.permission) &&
    (!("requiredRole" in item) || !item.requiredRole || !role || item.requiredRole === role) &&
    (!("allowedRoles" in item) || !item.allowedRoles || !role || item.allowedRoles.includes(role)) &&
    (!("featureFlag" in item) || !item.featureFlag || features.has(item.featureFlag))
  );
}

export function groupedVisibleNavigationItems(permissions: Iterable<CanonicalPermission>, role?: Role, enabledFeatures: Iterable<OptionalOperationsFeatureCode> = []) {
  const visibleItems = visibleNavigationItems(permissions, role, enabledFeatures);
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: visibleItems.filter((item) => item.group === group.id)
  })).filter((group) => group.items.length > 0);
}

export function canOpenImportExportWorkspace(permissions: Iterable<CanonicalPermission>) {
  return [
    "VIEW_IMPORT_EXPORT",
    "IMPORT_STUDENTS",
    "IMPORT_GUARDIANS",
    "IMPORT_STAFF",
    "CREATE_PAYMENTS",
    "EXPORT_STUDENTS",
    "EXPORT_PAYMENTS",
    "EXPORT_REPORTS",
    "RUN_BACKUP",
    "RUN_RESTORE"
  ].some((permission) => permissionListCan(permissions, permission));
}
