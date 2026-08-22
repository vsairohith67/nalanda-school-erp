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
  { id: "STUDENTS", label: "Students", priority: 1, available: true, href: "/students" },
  { id: "ADMISSIONS", label: "Admissions", priority: 1, available: true, href: "/admission-crm" },
  { id: "GUARDIANS", label: "Guardians", priority: 1, available: true, href: "/guardians" },
  { id: "STAFF", label: "Staff", priority: 1, available: true, href: "/staff" },
  { id: "DIARY", label: "Diary", priority: 1, available: true, href: "/super-admin/my-work#diary" },
  { id: "TASKS", label: "Tasks & Reminders", priority: 1, available: true, href: "/super-admin/my-work#tasks" },
  { id: "CONTACTS", label: "Contacts & Suppliers", priority: 1, available: true, href: "/super-admin/my-work#contacts" },
  { id: "FEES", label: "Fees & Receipts", priority: 2, available: true, href: "/payments" },
  { id: "ATTENDANCE", label: "Attendance", priority: 2, available: false, href: "/attendance/students" },
  { id: "EXAMINATIONS", label: "Examinations", priority: 2, available: true, href: "/exams" },
  { id: "REPORT_CARDS", label: "Report Cards", priority: 2, available: true, href: "/report-cards" },
  { id: "SUPPORT", label: "Support & Complaints", priority: 2, available: true, href: "/support" },
  { id: "SAFE_EXIT", label: "Safe Exit", priority: 2, available: true, href: "/student-departures" },
  { id: "EVENTS", label: "Events & Calendar", priority: 2, available: true, href: "/calendar" },
  { id: "USERS_IAM", label: "Users / IAM", priority: 3, available: true, href: "/users" },
  { id: "RECENT_ACTIVITY", label: "Audit / Recent Activity", priority: 3, available: false, href: "/access-history" },
  { id: "RELEASE_OPERATIONS", label: "Release Operations", priority: 3, available: true, href: "/release-operations" },
  { id: "OBSERVABILITY", label: "Observability / System Health", priority: 3, available: true, href: "/technical-operations" }
] as const;

export type UniversalSearchSourceId = (typeof UNIVERSAL_SEARCH_SOURCES)[number]["id"];
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
