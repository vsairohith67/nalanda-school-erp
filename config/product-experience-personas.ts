export type UsabilityTask = {
  task: string;
  entry: string;
  targetSteps: number;
  riskChecks: readonly string[];
};

const task = (name: string, entry: string, targetSteps: number, ...riskChecks: string[]): UsabilityTask => ({ task: name, entry, targetSteps, riskChecks });

export const PRODUCT_EXPERIENCE_PERSONAS = {
  SUPER_ADMIN: {
    purpose: "Govern system, security, releases, permissions and exceptions without bypassing module owners.",
    criticalTasks: [
      task("Review command centre exceptions", "/super-admin/command-center", 2, "role scope", "dead ends"),
      task("Find an authorised record", "/super-admin/search", 3, "no unauthorised flash", "ambiguous results"),
      task("Ask read-only Smart AI", "/super-admin/ai", 3, "grounding", "unsafe action shortcut"),
      task("Review current work", "/super-admin/my-work", 2, "context switching"),
      task("Inspect system and deployment state", "/technical-operations", 2, "secret exposure", "ambiguous health"),
      task("Review security and backup state", "/cloud-backup", 3, "irreversible action confirmation"),
      task("Review controlled feature flags", "/release-operations", 3, "default-off", "unsafe activation"),
      task("Manage role permissions", "/roles", 4, "deny-by-default", "privilege escalation"),
      task("Open Student 360", "/students", 3, "private relation over-fetch"),
      task("Open Staff 360", "/staff", 3, "salary and HR privacy")
    ]
  },
  PRINCIPAL: {
    purpose: "Resolve academic, attendance, staffing and communication exceptions with governed approvals.",
    criticalTasks: [
      task("Review urgent dashboard exceptions", "/dashboard", 2, "decorative metrics"), task("Review student attendance", "/attendance/students/reports", 3, "scope context"),
      task("Approve staff leave", "/leave/staff", 4, "unsafe shortcut"), task("Assign substitutes", "/substitutes/planner", 4, "partial failure"),
      task("Review marks moderation", "/exams/moderation", 4, "academic integrity"), task("Review report publication", "/report-cards/publication", 4, "irreversible confirmation"),
      task("Open Student 360", "/students", 3, "private relation over-fetch"), task("Open Staff 360", "/staff", 3, "salary privacy"),
      task("Review parent meetings", "/parent-meetings", 3, "private notes"), task("Publish an announcement", "/notifications/manage", 4, "audience scope")
    ]
  },
  DIRECTOR: {
    purpose: "Oversee school operations, finance summaries, approvals and controlled release readiness.",
    criticalTasks: [
      task("Review dashboard exceptions", "/dashboard", 2, "actionability"), task("Review collections", "/daily-collection", 3, "financial integrity"),
      task("Review expense approvals", "/expenses", 4, "partial failure"), task("Review cash book", "/cash-book", 3, "locked state"),
      task("Review staff attendance", "/attendance/staff/reports", 3, "manual correction evidence"), task("Review academic reports", "/academic-reports", 3, "minimum groups"),
      task("Open Student 360", "/students", 3, "privacy"), task("Open Staff 360", "/staff", 3, "salary privacy"),
      task("Review support escalations", "/support/reports", 3, "sensitive notes"), task("Review release summary", "/release-operations", 3, "no activation")
    ]
  },
  ACCOUNTANT: {
    purpose: "Record and reconcile governed finance work with clear draft, posted and receipt boundaries.",
    criticalTasks: [
      task("Record a payment", "/payments/new", 4, "duplicate submit", "validation recovery"), task("Record a family collection", "/family-collections/new", 5, "allocation scope"),
      task("Review pending dues", "/pending-dues", 3, "filter clarity"), task("Open a student ledger", "/ledger", 3, "student context"),
      task("Reconcile daily collection", "/daily-collection", 3, "export separation"), task("Record an expense", "/expenses/new", 4, "approval boundary"),
      task("Record miscellaneous income", "/misc-income/new", 4, "receipt boundary"), task("Use offline finance drafts", "/offline/finance", 4, "draft not official"),
      task("Resolve an offline retry", "/offline/finance", 3, "state clarity"), task("Review cash book", "/cash-book", 3, "locked day")
    ]
  },
  COMPUTER_OPERATOR: {
    purpose: "Prepare bounded student, staff, timetable and document records without automatic approval authority.",
    criticalTasks: [
      task("Find a student", "/students", 3, "ambiguous identity"), task("Open Student 360", "/students", 3, "privacy"),
      task("Add a student", "/students/new", 5, "dirty form recovery"), task("Review guardians", "/guardians", 3, "contact privacy"),
      task("Open Staff 360", "/staff", 3, "private HR"), task("Prepare timetable assignments", "/timetable/assignments", 5, "sticky context"),
      task("Prepare an ID card", "/id-cards/new", 4, "issuance boundary"), task("Prepare a certificate", "/certificates/new", 4, "approval boundary"),
      task("Import and review records", "/import-export", 5, "preview before write"), task("Recover from validation errors", "/import-verification", 3, "row errors")
    ]
  },
  TEACHER: {
    purpose: "Complete exact timetable-scoped teaching work and view only own Staff information.",
    criticalTasks: [
      task("Review today’s work", "/teacher", 2, "role confusion"), task("Take class attendance", "/attendance/students", 4, "exact cohort"),
      task("Create homework", "/teacher/homework", 4, "subject scope"), task("Create classwork", "/teacher/classwork", 4, "unsaved changes"),
      task("Review exam assignments", "/teacher/exam-assignments", 3, "marks prohibition"), task("View read-only report cards", "/teacher/report-cards", 3, "academic integrity"),
      task("Apply for leave", "/leave/staff", 4, "own scope"), task("View substitute duties", "/substitutes", 3, "read-only state"),
      task("Review own library", "/teacher/library", 3, "own scope"), task("Read notifications", "/teacher/notifications", 2, "school-wide denial")
    ]
  },
  PARENT: {
    purpose: "Review linked-child information and request bounded services without seeing unrelated children.",
    criticalTasks: [
      task("Choose linked child", "/parent", 2, "active context"), task("Review fees and receipts", "/parent", 3, "linked-child scope"),
      task("Review attendance", "/parent/attendance", 3, "official status"), task("Review published results", "/parent/results", 3, "issued only"),
      task("Review homework", "/parent/homework", 3, "selected child"), task("Review school calendar", "/parent/calendar", 3, "cohort scope"),
      task("Request early leave", "/parent/student-departures", 4, "confirmation"), task("Request a meeting", "/parent/meetings", 4, "private notes"),
      task("Request a certificate", "/parent/certificates", 4, "facts read-only"), task("Ask for support", "/parent/support", 3, "sensitive details")
    ]
  },
  GATE_STAFF: {
    purpose: "Verify and complete safe-exit events without general student-record access.",
    criticalTasks: [
      task("Open gate verification", "/student-departures/gate", 2, "role scope"), task("Verify a gate pass", "/student-departures/gate", 3, "expired token"),
      task("Reject an invalid pass", "/student-departures/gate", 3, "clear next action"), task("Complete checkout", "/student-departures/gate", 4, "irreversible confirmation"),
      task("Record a return", "/student-departures/gate", 4, "student identity"), task("Handle network loss", "/student-departures/gate", 3, "no false success"),
      task("Handle permission revocation", "/unauthorized", 2, "no content flash"), task("Review current roster", "/student-departures/roster", 3, "minimum data"),
      task("Recover from unavailable object", "/student-departures/gate", 2, "safe retry"), task("Sign out", "/account-security", 2, "session closure")
    ]
  },
  VIEWER: {
    purpose: "Read approved summaries without mutation or bulk-export authority.",
    criticalTasks: [
      task("Review dashboard", "/dashboard", 2, "read-only clarity"), task("Review academic reports", "/academic-reports", 3, "minimum group"),
      task("Review attendance summaries", "/attendance/students/reports", 3, "aggregate only"), task("Review examination reports", "/marks/reports", 3, "no marks entry"),
      task("Review report-card reports", "/report-cards/reports", 3, "no publication"), task("Review notices", "/notices", 2, "published state"),
      task("Use filters", "/academic-reports", 3, "clear reset"), task("Open an unavailable destination", "/unauthorized", 2, "no content flash"),
      task("Use keyboard navigation", "/dashboard", 3, "focus order"), task("Sign out", "/account-security", 2, "session closure")
    ]
  },
  MARKS_ENTRY_OPERATOR: {
    purpose: "Enter only explicitly assigned marks; this is a governed permission profile, not a new database role.",
    criticalTasks: [
      task("Review assigned sheets", "/marks/governed", 2, "exact scope"), task("Open one assigned assessment", "/marks/entry/[assessmentId]", 3, "sticky context"),
      task("Enter marks by keyboard", "/marks/entry/[assessmentId]", 4, "row focus"), task("Mark absent or exempt", "/marks/entry/[assessmentId]", 3, "status text"),
      task("Review validation errors", "/marks/entry/[assessmentId]", 3, "row association"), task("Recover after network loss", "/marks/entry/[assessmentId]", 3, "preserve values"),
      task("Submit an assigned sheet", "/marks/entry/[assessmentId]", 4, "confirmation"), task("Handle a locked sheet", "/marks/governed", 2, "read-only distinction"),
      task("Handle revoked scope", "/unauthorized", 2, "no content flash"), task("Verify no moderation authority", "/exams/moderation", 2, "deny-by-default")
    ]
  }
} as const;

export const PERSONA_ACCEPTANCE_RULES = {
  maximumPrimaryTaskSteps: 5,
  noDeadEnds: true,
  noRoleIrrelevantNavigation: true,
  contextSwitchesTarget: 1,
  recoverableErrorsPreserveInput: true,
  unsafeShortcutsAllowed: false
} as const;
