export const ONBOARDING_TEMPLATE_VERSION = "1.0";
export const ONBOARDING_SCHEMA_VERSION = "IMPORT-1A-2026-08-10";
export const ONBOARDING_PRIVATE_HEADERS = {
  "cache-control": "private, no-store, max-age=0",
  pragma: "no-cache",
  expires: "0",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'; sandbox"
} as const;

export const ONBOARDING_BUNDLES = ["STUDENT_GUARDIAN", "STAFF", "COMBINED"] as const;
export type OnboardingBundle = typeof ONBOARDING_BUNDLES[number];
export const ONBOARDING_SHEETS = [
  "Instructions", "Template Metadata", "Academic Years", "Classes and Sections",
  "Students", "Guardians", "Student-Guardian Links", "Enrollments", "Code Lists",
  "Validation Summary", "Import Batch Reference"
] as const;
export const STAFF_SHEET = "Staff";

export type OnboardingSeverity = "BLOCKING_ERROR" | "WARNING" | "INFORMATION" | "POSSIBLE_DUPLICATE" | "REQUIRES_USER_DECISION";
export type OnboardingIssue = {
  code: string;
  severity: OnboardingSeverity;
  sheet: string;
  row: number;
  column?: string;
  rowKey?: string;
  message: string;
  suggestion?: string;
  submittedValue?: string;
};

export type OnboardingWorkbookRows = {
  metadata: Record<string, string>;
  students: Record<string, unknown>[];
  guardians: Record<string, unknown>[];
  links: Record<string, unknown>[];
  enrollments: Record<string, unknown>[];
  staff: Record<string, unknown>[];
};

export const STUDENT_HEADERS = ["Import Row Key", "Admission Number", "Student Full Name", "Father Name", "Mother Name", "Phone", "Alternate Phone", "Date of Birth", "Academic Year", "Class", "Section", "Roll Number", "Student Status", "Notes", "Example Row"];
export const GUARDIAN_HEADERS = ["Guardian Row Key", "Name", "Relationship", "Mobile", "Alternate Mobile", "Email", "Communication Preference", "Parent Account Proposal", "Example Row"];
export const LINK_HEADERS = ["Link Row Key", "Student Row Key", "Guardian Row Key", "Relationship to Student", "Primary Contact", "Can View Fees", "Can Receive Reminders", "Example Row"];
export const ENROLLMENT_HEADERS = ["Enrollment Row Key", "Student Row Key", "Academic Year", "Class", "Section", "Roll Number", "Enrollment Date", "Status", "Example Row"];
export const STAFF_HEADERS = ["Staff Row Key", "Employee Code", "Name", "Staff Type", "Designation", "Department", "Joining Date", "Work Email", "Personal Email", "Mobile", "Role Proposal", "Portal Account Proposal", "Employment Status", "Notes", "Example Row"];

export function isOnboardingBundle(value: unknown): value is OnboardingBundle {
  return ONBOARDING_BUNDLES.includes(String(value) as OnboardingBundle);
}
