export const UNIVERSAL_SEARCH_LIMITS = {
  minimumQueryLength: 2,
  maximumQueryLength: 120,
  defaultOverallLimit: 50,
  maximumOverallLimit: 60,
  perSourceLimit: 6,
  candidateLimit: 32,
  sourceTimeoutMs: 650
} as const;

export const SEARCH_EXTENSION_1B_SOURCE_IDS = [
  "PARENT_MEETINGS",
  "TRANSPORT",
  "CAFETERIA",
  "KG_REPORTS",
  "EVENT_MEDIA"
] as const;

const SEARCH_EXTENSION_1B_RUNTIME_GOVERNANCE = {
  perSourceLimit: UNIVERSAL_SEARCH_LIMITS.perSourceLimit,
  timeoutMs: UNIVERSAL_SEARCH_LIMITS.sourceTimeoutMs,
  destinationType: "SERVER_OWNED_MODULE_ROUTE",
  smartAiEligible: true
} as const;

export const SEARCH_EXTENSION_1B_SOURCE_GOVERNANCE = {
  PARENT_MEETINGS: {
    module: "PARENT_MEETINGS_V1_5",
    releaseFlagDependency: { kind: "ENVIRONMENT_FLAG", key: "PARENT_MEETINGS_V1_5", enabledValue: "true", committedDefault: "OFF" },
    classification: "SAFE_METADATA_ONLY",
    safeFields: ["publicKey", "student.studentName", "student.admissionNo", "student.className", "student.section", "academicYear", "category", "status", "scheduledStartAt", "mode", "noShowState", "followUpRequired", "followUps.status", "followUps.dueDate"],
    prohibitedFields: ["subject", "requestReason", "parentCancellationSummary", "cancellationInternalReason", "requesterGuardianId", "participants", "notes", "events", "notificationContents"],
    ...SEARCH_EXTENSION_1B_RUNTIME_GOVERNANCE
  },
  TRANSPORT: {
    module: "TRANSPORT_V1_5",
    releaseFlagDependency: { kind: "RELEASE_FLAG", key: "transport-v1-5", committedDefault: "OFF" },
    classification: "SAFE_METADATA_ONLY",
    safeFields: ["publicKey", "code", "name", "status", "vehicle.publicKey", "vehicle.registrationCode", "vehicle.displayName", "student.studentName", "student.admissionNo", "student.className", "student.section", "routeCodeSnapshot", "routeNameSnapshot", "pickupStopSnapshot", "dropStopSnapshot", "effectiveFrom", "effectiveTo", "active"],
    prohibitedFields: ["approvedReference", "driverStaffMemberId", "attendantStaffMemberId", "driverStaffMember", "attendantStaffMember", "address", "mobile", "changeReason", "routeRoster", "gps", "tracking", "safeExit"],
    ...SEARCH_EXTENSION_1B_RUNTIME_GOVERNANCE
  },
  CAFETERIA: {
    module: "CAFETERIA_V1_5",
    releaseFlagDependency: { kind: "RELEASE_FLAG", key: "cafeteria-v1-5", committedDefault: "OFF" },
    classification: "SAFE_METADATA_ONLY",
    safeFields: ["publicKey", "code", "name", "category", "available", "status", "menuDate", "dayLabel", "student.studentName", "student.admissionNo", "student.className", "student.section", "effectiveFrom", "effectiveTo", "active", "serviceDateKey", "mealSlot", "recordType"],
    prohibitedFields: ["mealPlanName", "dietaryNote", "diagnosis", "allergy", "medicalCondition", "healthConclusion", "changeReason", "price", "amount", "fee", "payment", "wallet", "storedCard", "gatewayData"],
    ...SEARCH_EXTENSION_1B_RUNTIME_GOVERNANCE
  },
  KG_REPORTS: {
    module: "KG_REPORT_CARDS_V1_5",
    releaseFlagDependency: { kind: "RELEASE_FLAG", key: "kg-report-cards-v1-5", committedDefault: "OFF" },
    classification: "SAFE_METADATA_ONLY",
    safeFields: ["reportCardNumber", "student.studentName", "student.admissionNo", "academicYear", "className", "section", "status", "currentVersionNumber", "issuedAt", "batch.reportingPeriod"],
    prohibitedFields: ["id", "batchId", "studentId", "draftDataJson", "teacherOverallComment", "principalComment", "directorComment", "finalGrade", "versions", "events", "signatures", "pdfBytes", "moderationNotes"],
    ...SEARCH_EXTENSION_1B_RUNTIME_GOVERNANCE
  },
  EVENT_MEDIA: {
    module: "EVENT_MEDIA_V1_5",
    releaseFlagDependency: { kind: "ENVIRONMENT_FLAG", key: "EVENT_MEDIA_PUBLIC_GALLERY_ENABLED", enabledValue: "true", committedDefault: "OFF" },
    classification: "SAFE_METADATA_ONLY",
    safeFields: ["publicKey", "eventDate", "visibility", "status", "reviewStatus", "publicationState", "archivedAt", "_count.assets", "originalMediaType", "originalWidth", "originalHeight", "publicationStatus", "uploadedAt"],
    prohibitedFields: ["title", "description", "caption", "originalStorageKey", "originalSha256", "originalByteSize", "studentAssociations", "consent", "exif", "gps", "ocr", "faceData", "facialEmbeddings", "publicUrl"],
    ...SEARCH_EXTENSION_1B_RUNTIME_GOVERNANCE
  }
} as const;

export const UNIVERSAL_SEARCH_SOURCES = [
  { id: "STUDENTS", label: "Students", priority: 1, available: true, coverage: "SEARCHABLE", href: "/students" },
  { id: "ADMISSIONS", label: "Admissions", priority: 1, available: true, coverage: "SEARCHABLE", href: "/admission-crm" },
  { id: "GUARDIANS", label: "Guardians", priority: 1, available: true, coverage: "SEARCHABLE", href: "/guardians" },
  { id: "STAFF", label: "Staff", priority: 1, available: true, coverage: "SEARCHABLE", href: "/staff" },
  { id: "DIARY", label: "Diary", priority: 1, available: true, coverage: "SEARCHABLE", href: "/super-admin/my-work#diary" },
  { id: "TASKS", label: "Tasks & Reminders", priority: 1, available: true, coverage: "SEARCHABLE", href: "/super-admin/my-work#tasks" },
  { id: "CONTACTS", label: "Contacts & Suppliers", priority: 1, available: true, coverage: "SEARCHABLE", href: "/super-admin/my-work#contacts" },
  { id: "FEES", label: "Fees & Receipts", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/payments" },
  { id: "ATTENDANCE", label: "Attendance", priority: 2, available: false, coverage: "UNAVAILABLE", href: "/attendance/students" },
  { id: "EXAMINATIONS", label: "Examinations", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/exams" },
  { id: "REPORT_CARDS", label: "Report Cards", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/report-cards" },
  { id: "SUPPORT", label: "Support & Complaints", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/support" },
  { id: "SAFE_EXIT", label: "Safe Exit", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/student-departures" },
  { id: "EVENTS", label: "Events & Calendar", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/calendar" },
  { id: "PARENT_MEETINGS", label: "Parent Meetings", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/parent-meetings", governance: SEARCH_EXTENSION_1B_SOURCE_GOVERNANCE.PARENT_MEETINGS },
  { id: "TRANSPORT", label: "Transport", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/operations/transport", governance: SEARCH_EXTENSION_1B_SOURCE_GOVERNANCE.TRANSPORT },
  { id: "CAFETERIA", label: "Cafeteria", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/operations/cafeteria", governance: SEARCH_EXTENSION_1B_SOURCE_GOVERNANCE.CAFETERIA },
  { id: "KG_REPORTS", label: "KG Report Cards", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/report-cards", governance: SEARCH_EXTENSION_1B_SOURCE_GOVERNANCE.KG_REPORTS },
  { id: "EVENT_MEDIA", label: "Event Media", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/event-media", governance: SEARCH_EXTENSION_1B_SOURCE_GOVERNANCE.EVENT_MEDIA },
  { id: "USERS_IAM", label: "Users / IAM", priority: 3, available: true, coverage: "SAFE_METADATA_ONLY", href: "/users" },
  { id: "RECENT_ACTIVITY", label: "Audit / Recent Activity", priority: 3, available: false, coverage: "UNAVAILABLE", href: "/access-history" },
  { id: "RELEASE_OPERATIONS", label: "Release Operations", priority: 3, available: true, coverage: "SAFE_METADATA_ONLY", href: "/release-operations" },
  { id: "OBSERVABILITY", label: "Observability / System Health", priority: 3, available: true, coverage: "SAFE_METADATA_ONLY", href: "/technical-operations" }
] as const;

export type UniversalSearchSourceId = (typeof UNIVERSAL_SEARCH_SOURCES)[number]["id"];
export type UniversalSearchSourceCoverage = (typeof UNIVERSAL_SEARCH_SOURCES)[number]["coverage"];
export type UniversalSearchSourceState = "OK" | "EMPTY" | "DEGRADED" | "UNAVAILABLE" | "TIMEOUT";

export type UniversalSearchResult = {
  source: UniversalSearchSourceId;
  type: string;
  title: string;
  subtitle: string;
  snippet: string | null;
  status: string | null;
  href: string;
  score: number;
  timestamp: string | null;
};

export type UniversalSearchSourceStatus = {
  source: UniversalSearchSourceId;
  label: string;
  state: UniversalSearchSourceState;
  count: number;
  message: string | null;
  href: string;
};

export type UniversalSearchRequest = {
  query: string;
  normalizedQuery: string;
  tokens: string[];
  sources: UniversalSearchSourceId[];
  limit: number;
};

export type UniversalSearchResponse = {
  query: string;
  generatedAt: string;
  readOnly: true;
  total: number;
  truncated: boolean;
  limits: typeof UNIVERSAL_SEARCH_LIMITS;
  results: UniversalSearchResult[];
  sources: UniversalSearchSourceStatus[];
};
