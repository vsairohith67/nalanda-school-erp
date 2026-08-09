import type { Role } from "@/lib/permissions";

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "School Owner",
  DIRECTOR: "Director",
  PRINCIPAL: "Principal",
  ADMIN: "School Administrator",
  ACCOUNTANT: "Accountant",
  COMPUTER_OPERATOR: "Computer Operator",
  GATE_STAFF: "Gate Staff",
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
  VIEWER: "Viewer / Auditor"
};

const DASHBOARD_TITLES: Record<Role, string> = {
  SUPER_ADMIN: "School Operations Dashboard",
  DIRECTOR: "Director Dashboard",
  PRINCIPAL: "Principal Dashboard",
  ADMIN: "Administration Dashboard",
  ACCOUNTANT: "Accounts Dashboard",
  COMPUTER_OPERATOR: "Admissions Operations Dashboard",
  GATE_STAFF: "Campus Gate Dashboard",
  TEACHER: "Teacher Dashboard",
  PARENT: "Parent Dashboard",
  STUDENT: "Student Dashboard",
  VIEWER: "Review Dashboard"
};

export function roleDisplayLabel(role: Role | string) {
  return ROLE_LABELS[role as Role] ?? "Authorised User";
}

export function roleDashboardTitle(role: Role | string) {
  return DASHBOARD_TITLES[role as Role] ?? "School Dashboard";
}

export function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NU";
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}
