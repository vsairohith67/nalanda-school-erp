export const UNIVERSAL_SEARCH_LIMITS = {
  minimumQueryLength: 2,
  maximumQueryLength: 120,
  defaultOverallLimit: 50,
  maximumOverallLimit: 60,
  perSourceLimit: 6,
  candidateLimit: 32,
  sourceTimeoutMs: 650
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
  { id: "PARENT_MEETINGS", label: "Parent Meetings", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/parent-meetings" },
  { id: "TRANSPORT", label: "Transport", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/operations/transport" },
  { id: "CAFETERIA", label: "Cafeteria", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/operations/cafeteria" },
  { id: "KG_REPORTS", label: "KG Report Cards", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/report-cards" },
  { id: "EVENT_MEDIA", label: "Event Media", priority: 2, available: true, coverage: "SAFE_METADATA_ONLY", href: "/event-media" },
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
