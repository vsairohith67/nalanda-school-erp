import {
  PERMISSION_GROUPS,
  RECOMMENDED_ROLE_PERMISSIONS,
  ROLES,
  type CanonicalPermission,
  type Role
} from "@/lib/permissions";

export const SPECIALISED_ACCESS_TEMPLATES = [
  "MARKS_ENTRY_OPERATOR",
  "ATTENDANCE_OPERATOR",
  "UDISE_DATA_OPERATOR"
] as const;

export type AccessTemplateId = Role | (typeof SPECIALISED_ACCESS_TEMPLATES)[number];
export type AccessTemplate = {
  id: AccessTemplateId;
  implementation: "BASE_ROLE" | "PERMISSION_PROFILE" | "PLANNED_PROFILE";
  intendedUserType: "LEADERSHIP" | "STAFF" | "GUARDIAN" | "STUDENT" | "ANY_APPROVED_PERSON";
  permissions: readonly CanonicalPermission[];
  permittedModules: readonly string[];
  prohibitedModules: readonly string[];
  highRiskPermissions: readonly CanonicalPermission[];
  mfa: "MANDATORY" | "RECOMMENDED";
  training: readonly string[];
  approval: readonly string[];
  reviewEveryDays: number;
  temporaryByDefault: boolean;
  incompatibleOrReviewRequired: readonly AccessTemplateId[];
  activeRoleRestriction: string;
  linkedObjectScope: string;
};

const HIGH_RISK = /(?:APPROVE|LOCK|FINALIZE|ISSUE|REVERSE|GRANT|MANAGE_IAM|RESET_USER|RUN_RESTORE|EXECUTE_RELEASE|PUBLISH|EXPORT|PAYMENT|CORRECT|EMERGENCY)/;
const allModules = PERMISSION_GROUPS.map((group) => group.id);

const rolePolicy: Record<Role, Omit<AccessTemplate, "id" | "implementation" | "permissions" | "permittedModules" | "prohibitedModules" | "highRiskPermissions">> = {
  SUPER_ADMIN: policy("LEADERSHIP", "MANDATORY", ["SECURITY_ADMIN", "PRIVACY_AND_ACCESS"], ["TWO_DISTINCT_LEADERSHIP_APPROVALS", "STEP_UP"], 90, false, ["COMPUTER_OPERATOR"], "Super Admin must be the explicitly active role; critical changes require step-up.", "School-wide only within the dedicated administrative context."),
  DIRECTOR: policy("LEADERSHIP", "MANDATORY", ["SECURITY_BASICS", "PRIVACY_AND_ACCESS"], ["LEADERSHIP_APPROVAL"], 180, false, ["MARKS_ENTRY_OPERATOR"], "Director authority is never unioned into a lower active role.", "School-wide leadership scope, subject to module-specific separation of duties."),
  PRINCIPAL: policy("LEADERSHIP", "MANDATORY", ["SECURITY_BASICS", "PRIVACY_AND_ACCESS", "ACADEMIC_INTEGRITY"], ["LEADERSHIP_APPROVAL"], 180, false, ["MARKS_ENTRY_OPERATOR"], "Principal authority is never unioned into a lower active role.", "School-wide academic scope, subject to exact service authorization."),
  ADMIN: policy("STAFF", "MANDATORY", ["SECURITY_BASICS", "PRIVACY_AND_ACCESS"], ["LEADERSHIP_APPROVAL"], 180, false, ["PARENT"], "Administrative access applies only while ADMIN is active.", "Approved operational scope; no implicit linked-child or finance authority."),
  ACCOUNTANT: policy("STAFF", "MANDATORY", ["SECURITY_BASICS", "FINANCE_PRIVACY"], ["FINANCE_OR_LEADERSHIP_APPROVAL"], 90, false, ["PARENT"], "Finance authority applies only while ACCOUNTANT is active.", "Approved finance scope; linked-child access only in a separate PARENT context."),
  COMPUTER_OPERATOR: policy("STAFF", "MANDATORY", ["SECURITY_BASICS", "PRIVACY_AND_ACCESS"], ["LEADERSHIP_APPROVAL"], 90, true, ["SUPER_ADMIN", "PARENT"], "No automatic IAM authority; exact delegated scope and expiry are required.", "Explicit bounded operational scope only."),
  GATE_STAFF: policy("STAFF", "RECOMMENDED", ["SECURITY_BASICS", "STUDENT_SAFETY"], ["OPERATIONS_APPROVAL"], 180, false, [], "Gate actions are limited to the GATE_STAFF context.", "Exact gate-pass and campus-roster scope only."),
  TEACHER: policy("STAFF", "RECOMMENDED", ["SECURITY_BASICS", "STUDENT_PRIVACY", "ACADEMIC_INTEGRITY"], ["ACTIVE_STAFF_AND_ASSIGNMENT_REVIEW"], 180, false, ["MARKS_ENTRY_OPERATOR"], "Teacher never receives permanent marks-write authority; delegated marks scope remains exact.", "Server-derived active Staff assignments only."),
  PARENT: policy("GUARDIAN", "RECOMMENDED", ["SECURITY_BASICS", "CHILD_PRIVACY"], ["ACTIVE_GUARDIAN_LINK_REVIEW"], 365, false, ["ADMIN", "COMPUTER_OPERATOR"], "PARENT must be selected separately from any Staff role.", "Only server-derived active linked-child context."),
  STUDENT: policy("STUDENT", "RECOMMENDED", ["SECURITY_BASICS", "STUDENT_ACCEPTABLE_USE"], ["ACTIVE_STUDENT_AND_AGE_POLICY_REVIEW"], 365, false, [], "STUDENT must be the explicit active role.", "Own active Student record only."),
  VIEWER: policy("ANY_APPROVED_PERSON", "RECOMMENDED", ["SECURITY_BASICS", "PRIVACY_AND_ACCESS"], ["MODULE_OWNER_APPROVAL"], 180, true, [], "Read-only access does not inherit permissions from another role.", "Approved aggregate/read-only scope only.")
};

const specialised: Record<(typeof SPECIALISED_ACCESS_TEMPLATES)[number], Omit<AccessTemplate, "id" | "permittedModules" | "prohibitedModules" | "highRiskPermissions">> = {
  MARKS_ENTRY_OPERATOR: {
    implementation: "PERMISSION_PROFILE", intendedUserType: "STAFF",
    permissions: ["VIEW_EXAMS", "VIEW_OWN_EXAM_ASSIGNMENTS", "VIEW_OWN_EXAM_MARKS", "ENTER_ASSIGNED_EXAM_MARKS", "SUBMIT_ASSIGNED_EXAM_MARKS", "REQUEST_EXAM_MARK_CORRECTION"],
    mfa: "MANDATORY", training: ["SECURITY_BASICS", "ACADEMIC_INTEGRITY"], approval: ["PRINCIPAL_APPROVAL", "EXACT_EXAM_SCOPE", "EXPIRY_REQUIRED"], reviewEveryDays: 30, temporaryByDefault: true,
    incompatibleOrReviewRequired: ["TEACHER", "PRINCIPAL", "DIRECTOR"], activeRoleRestriction: "Reserved profile; exact exam/subject/class scope only and never permanent Teacher authority.", linkedObjectScope: "Explicit exam assignments only."
  },
  ATTENDANCE_OPERATOR: {
    implementation: "PERMISSION_PROFILE", intendedUserType: "STAFF",
    permissions: ["VIEW_STUDENT_ATTENDANCE", "MANAGE_STUDENT_ATTENDANCE", "SUBMIT_STUDENT_ATTENDANCE", "VIEW_STUDENT_ATTENDANCE_REPORTS"],
    mfa: "MANDATORY", training: ["SECURITY_BASICS", "STUDENT_PRIVACY"], approval: ["PRINCIPAL_APPROVAL", "EXACT_CLASS_SCOPE", "EXPIRY_REQUIRED"], reviewEveryDays: 90, temporaryByDefault: true,
    incompatibleOrReviewRequired: ["PRINCIPAL"], activeRoleRestriction: "Preparation/submission authority must not include lock or correction approval.", linkedObjectScope: "Exact academic-year, class and section scope."
  },
  UDISE_DATA_OPERATOR: {
    implementation: "PLANNED_PROFILE", intendedUserType: "STAFF",
    permissions: ["VIEW_UDISE_CHECKLIST", "VIEW_UDISE_MASKED_ROWS"],
    mfa: "MANDATORY", training: ["SECURITY_BASICS", "UDISE_DATA_MINIMISATION"], approval: ["PRINCIPAL_APPROVAL", "EXACT_SCOPE", "EXPIRY_REQUIRED"], reviewEveryDays: 30, temporaryByDefault: true,
    incompatibleOrReviewRequired: [], activeRoleRestriction: "Planning-only template until a governed profile is created; no official UDISE export authority.", linkedObjectScope: "Masked checklist rows only."
  }
};

export const ROLE_TEMPLATE_CATALOGUE: readonly AccessTemplate[] = [
  ...ROLES.map((id) => complete(id, "BASE_ROLE", [...RECOMMENDED_ROLE_PERMISSIONS[id]], rolePolicy[id])),
  ...SPECIALISED_ACCESS_TEMPLATES.map((id) => complete(id, specialised[id].implementation, [...specialised[id].permissions], specialised[id]))
];

export const APPROVAL_MATRIX = {
  SUPER_ADMIN: { approvers: 2, eligibleApproverRoles: ["SUPER_ADMIN", "DIRECTOR"], selfApproval: false, stepUp: true },
  DIRECTOR: { approvers: 1, eligibleApproverRoles: ["SUPER_ADMIN"], selfApproval: false, stepUp: true },
  PRINCIPAL: { approvers: 1, eligibleApproverRoles: ["SUPER_ADMIN", "DIRECTOR"], selfApproval: false, stepUp: true },
  ACCOUNTANT: { approvers: 1, eligibleApproverRoles: ["SUPER_ADMIN", "DIRECTOR"], selfApproval: false, stepUp: true },
  DEFAULT: { approvers: 1, eligibleApproverRoles: ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"], selfApproval: false, stepUp: false }
} as const;

export function accessTemplate(id: string) {
  return ROLE_TEMPLATE_CATALOGUE.find((entry) => entry.id === id) ?? null;
}

export function roleCombinationWarnings(ids: readonly string[]) {
  const unique = [...new Set(ids)];
  const warnings = new Set<string>();
  for (const id of unique) {
    const template = accessTemplate(id);
    if (!template) warnings.add(`UNKNOWN_TEMPLATE:${id}`);
    for (const other of template?.incompatibleOrReviewRequired ?? []) {
      if (unique.includes(other)) warnings.add(`REVIEW_REQUIRED:${[id, other].sort().join("+")}`);
    }
  }
  const permissions = unique.flatMap((id) => accessTemplate(id)?.permissions ?? []);
  if (permissions.includes("CREATE_PAYMENTS") && permissions.includes("APPROVE_PAYROLL")) warnings.add("SEPARATION_OF_DUTIES:FINANCE_PREPARE_AND_APPROVE");
  if (permissions.includes("SUBMIT_STUDENT_ATTENDANCE") && permissions.includes("LOCK_STUDENT_ATTENDANCE")) warnings.add("SEPARATION_OF_DUTIES:ATTENDANCE_SUBMIT_AND_LOCK");
  return [...warnings].sort();
}

function policy(intendedUserType: AccessTemplate["intendedUserType"], mfa: AccessTemplate["mfa"], training: string[], approval: string[], reviewEveryDays: number, temporaryByDefault: boolean, incompatibleOrReviewRequired: AccessTemplateId[], activeRoleRestriction: string, linkedObjectScope: string) {
  return { intendedUserType, mfa, training, approval, reviewEveryDays, temporaryByDefault, incompatibleOrReviewRequired, activeRoleRestriction, linkedObjectScope };
}

function complete(id: AccessTemplateId, implementation: AccessTemplate["implementation"], permissions: CanonicalPermission[], rest: Omit<AccessTemplate, "id" | "implementation" | "permissions" | "permittedModules" | "prohibitedModules" | "highRiskPermissions">): AccessTemplate {
  const permittedModules = PERMISSION_GROUPS.filter((group) => group.permissions.some((entry) => permissions.includes(entry.permission))).map((group) => group.id);
  return { id, implementation, permissions, permittedModules, prohibitedModules: allModules.filter((module) => !permittedModules.includes(module)), highRiskPermissions: permissions.filter((permission) => HIGH_RISK.test(permission)), ...rest };
}
