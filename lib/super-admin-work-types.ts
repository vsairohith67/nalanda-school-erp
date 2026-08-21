import type { AuthUser } from "@/lib/auth";

export const SUPER_ADMIN_WORK_LIMITS = { diary: 60, tasks: 100, contacts: 100, commandItems: 3 } as const;
export const WORK_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const DIARY_STATUSES = ["OPEN", "FOLLOW_UP", "CLOSED"] as const;
export const TASK_STATUSES = ["TO_DO", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"] as const;
export const CONTACT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const DIARY_CATEGORIES = ["ACADEMIC", "STAFF", "ADMISSIONS", "FINANCE", "PARENT_MATTER", "OPERATIONS", "COMPLIANCE", "PERSONAL_WORK", "VENDOR", "OTHER"] as const;
export const CONTACT_CATEGORIES = ["PUBLISHER", "BOOK_SUPPLIER", "UNIFORM_SUPPLIER", "STATIONERY_VENDOR", "LABORATORY_SUPPLIER", "IT_SOFTWARE_VENDOR", "REPAIR_SERVICE_VENDOR", "CONSULTANT", "OTHER"] as const;
export const WORK_MODULES = ["ACADEMICS", "STUDENTS", "ADMISSIONS", "FEES", "ATTENDANCE", "EXAMS", "REPORT_CARDS", "STAFF", "SUPPORT", "SAFE_EXIT", "IAM", "OPERATIONS", "CALENDAR", "OTHER"] as const;

export type SuperAdminWorkActor = Pick<AuthUser, "id" | "role">;
export type WorkPriority = (typeof WORK_PRIORITIES)[number];
export type TaskBucket = "TODAY" | "OVERDUE" | "UPCOMING" | "COMPLETED";

export type DiaryView = {
  publicKey: string;
  title: string;
  entryDate: string;
  notesFormat: "PLAIN_STRUCTURED";
  notes: string;
  category: string;
  contextModule: string | null;
  contextReference: string | null;
  status: string;
  priority: string;
  followUpDate: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskView = {
  publicKey: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string;
  dueTime: string | null;
  reminderAt: string | null;
  category: string;
  linkedModule: string | null;
  linkedEntityType: string | null;
  linkedEntityReference: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactView = {
  publicKey: string;
  name: string;
  contactPerson: string | null;
  category: string;
  phone: string | null;
  alternatePhone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  notes: string | null;
  status: string;
  preferred: boolean;
  tags: string[];
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SuperAdminWorkSnapshot = {
  generatedAt: string;
  todayKey: string;
  bounded: typeof SUPER_ADMIN_WORK_LIMITS;
  diary: DiaryView[];
  tasks: TaskView[];
  contacts: ContactView[];
};

export type SuperAdminWorkSummary = {
  todayTasks: number;
  overdueTasks: number;
  upcomingReminders: number;
  followUpsDue: number;
  activeContacts: number;
  preferredContacts: number;
  recentDiary: Array<{ title: string; date: string; status: string }>;
  reminderItems: Array<{ title: string; at: string }>;
};
