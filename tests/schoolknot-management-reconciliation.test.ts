import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const matrix = read("docs/SCHOOLKNOT_MANAGEMENT_REPLACEMENT_MATRIX.md");
const rejected = read("docs/SCHOOLKNOT_FEATURES_NOT_TO_COPY.md");
const waves = read("docs/SCHOOLKNOT_MANAGEMENT_GAP_IMPLEMENTATION_WAVES.md");
const migration = read("docs/SCHOOLKNOT_MANAGEMENT_EXPORT_AND_MIGRATION_REQUIREMENTS.md");
const roadmap = read("docs/SCHOOLKNOT_REPLACEMENT_GAP_MAP.md");
const history = read("docs/PROMPT_HISTORY.md");
const combined = [matrix, rejected, waves, migration].join("\n");

function countRouteFiles(root: string, filename: string) {
  let count = 0;
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) count += countRouteFiles(path, filename);
    else if (name === filename) count += 1;
  }
  return count;
}

describe("Prompt 23B-M Management-only reconciliation", () => {
  it("records the authenticated Management source and exact evidence boundary", () => {
    for (const evidence of [
      "21 July 2026",
      "MANAGEMENT",
      "15",
      "119 structural page observations",
      "39 representative checks at exact 390 × 844",
      "No record was created",
      "Parent, Teacher, and Principal audits remain pending",
    ]) {
      expect(matrix).toContain(evidence);
    }
    for (const status of [
      "VERIFIED_VISIBLE_WORKFLOW",
      "VERIFIED_VISIBLE_FORM_ONLY",
      "VERIFIED_VISIBLE_REPORT_ONLY",
      "BLANK_OR_BROKEN",
      "INACCESSIBLE",
      "NEEDS_WRITE_TEST",
      "NEEDS_EXPORT_EVIDENCE",
      "NEEDS_OTHER_ROLE_EVIDENCE",
    ]) {
      expect(matrix).toContain(status);
    }
  });

  it("represents all 15 visible Management top-level modules", () => {
    for (const menu of [
      "Dashboard",
      "Communication",
      "Academics",
      "Attendance",
      "Students",
      "Staff",
      "Exams",
      "Finance",
      "Admissions",
      "HR",
      "Downloads",
      "Transport",
      "Settings",
      "Discipline",
      "Cafeteria",
    ]) {
      expect(matrix).toContain(menu);
    }
  });

  it("contains every required Management gap decision", () => {
    for (const gap of [
      "Admissions and Enquiry CRM",
      "Payroll and payslips",
      "Salary setup/history",
      "Advance salary",
      "Resignation/exit",
      "Events and holidays",
      "Academic calendar/tasks/reminders",
      "Transport routes/Student assignment",
      "Vehicle records",
      "Vehicle readings",
      "Bus passes",
      "GPS/tracking",
      "Student homework submissions",
      "Assignment attachments",
      "Classwork",
      "Consolidated exam reports",
      "Multiple-exam comparison",
      "Board-exam analytics",
      "Discipline",
      "Cafeteria",
      "Showcase/public achievements",
      "App-adoption/Staff-usage analytics",
      "Refund workflow",
      "Day Closer",
      "Inventory/assets",
      "School settings/integrations",
      "Schoolknot backup/restore evidence",
      "Bulk exports/update tools",
    ]) {
      expect(matrix).toContain(gap);
    }
  });

  it("publishes a should-not-copy register with explicit safeguards", () => {
    expect(existsSync("docs/SCHOOLKNOT_FEATURES_NOT_TO_COPY.md")).toBe(true);
    for (const risk of [
      "DOB-derived passwords",
      "Unrestricted bulk Student editing",
      "Direct historical deletion",
      "Recipient/read surveillance",
      "Staff usage rankings",
      "Marks-only Teacher performance decisions",
      "Broad or public location access",
      "Inaccessible mobile navigation",
      "Provider-specific lock-in",
    ]) {
      expect(rejected).toContain(risk);
    }
    expect(rejected).toContain("Non-negotiable safeguards");
    expect(rejected).toContain("BLOCKED_APPROVAL");
  });

  it("keeps implementation waves provisional and cross-role gated", () => {
    expect(waves).toContain("provisional proposal only");
    for (const wave of ["Wave M1", "Wave M2", "Wave M3", "Wave M4", "Wave M5", "Wave M6"]) {
      expect(waves).toContain(wave);
    }
    expect(waves).toContain("No wave may use the Management audit to infer Parent, Teacher or Principal behavior");
    expect(waves).toContain("Prompt 21B, 21C and 21D remain blocked");
    expect(waves).toContain("Prompt 22B remains conditional and must not begin");
  });

  it("keeps Prompt 23B incomplete everywhere this phase declares status", () => {
    for (const doc of [matrix, roadmap, history]) {
      expect(doc).not.toContain("Prompt 23B is complete");
      expect(doc).not.toContain("Prompt 23B status: complete");
      expect(doc).not.toContain("Prompt 23B final consolidation is complete");
    }
    expect(matrix).toContain("Prompt 23B remains incomplete");
    expect(roadmap).toContain("Prompt 23B is not complete");
    expect(history).toContain("Prompt 23B is not complete");
  });

  it("documents controlled exports without obtaining or requesting one", () => {
    expect(migration).toContain("no export was requested or downloaded");
    for (const control of [
      "Field dictionary",
      "row count",
      "stable source identifier",
      "SHA-256",
      "untouched encrypted archive",
      "Reconciliation",
      "DO_NOT_IMPORT",
    ]) {
      expect(migration).toContain(control);
    }
    expect(migration).toContain("Passwords, password hashes");
  });

  it("contains no obvious Schoolknot personal contact or identity value", () => {
    expect(combined).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(combined).not.toMatch(/\b[6-9]\d{9}\b/);
    expect(combined).not.toMatch(/\b\d{12}\b/);
    expect(combined).not.toContain("fee-balance value");
    expect(combined).toContain("no names, contacts, identifiers, marks, balances, photographs, or transaction values retained");
  });

  it("preserves the prior checkpoint and recognizes additive examination and payroll implementation", () => {
    const schema = read("prisma/schema.prisma");
    expect((schema.match(/^model /gm) ?? [])).toHaveLength(353);
    for (const model of ["NativeAuthRequest", "NativeAuthorizationCode", "NativeSession", "NativeRefreshTokenHistory"]) expect(schema).toContain(`model ${model} {`);
    expect(schema).toContain("model SuperAdminDiaryEntry {");
    expect(schema).toContain("model SuperAdminTask {");
    expect(schema).toContain("model SuperAdminContact {");
    expect(schema).toContain("model SuperAdminWorkAudit {");
    expect(schema).toContain("model ExaminationSchemeVersion {");
    expect(schema).toContain("model TeacherExamAssignment {");
    expect(schema).toContain("model ExaminationTimetableVersion {");
    const migrationEntries = readdirSync("prisma/migrations");
    expect(migrationEntries.filter((name) => statSync(join("prisma/migrations", name)).isDirectory()).sort()).toEqual([
      "20260722_clean_install_baseline",
      "20260730_exam_scheme_assignment_foundation",
      "20260730_teacher_marks_moderation_calculation",
      "20260731130549_auth_verified_recovery_session_registry",
      "20260801110000_iam_named_users_permission_contexts",
      "20260801183000_parent_attendance_exam_timetable",
      "20260802170000_events_holidays_academic_calendar",
      "20260803123000_classwork_secure_submissions",
      "20260803143000_academic_reporting",
      "20260803193000_admissions_enquiry_crm",
      "20260808054148_payroll_payslips_employee_self_service",
      "20260808143000_family_multi_student_mixed_tender",
      "20260808213000_staff_payslip_request_secure_delivery",
      "20260809034243_support_parent_staff_complaints_feedback",
      "20260809140000_student_safe_exit_gate_pass",
      "20260809224500_student_exit_return_standing_corrections",
      "20260810100000_technical_operations_observability",
      "20260810184500_governed_bulk_onboarding",
      "20260821194500_super_admin_work_programme",
      "20260822090000_optional_operations_v1_5_foundations",
      "20260822113000_event_media_v1_5_foundation",
      "20260822170000_parent_meetings_v1_5",
      "20260825090000_offline_sync_1a",
      "20260826003000_cross_platform_apps_1a",
      "20260828090000_biometric_staff_attendance_1a",
      "20260902090000_real_user_access_readiness_1a",
    ]);
    const archivedMigrationEntries = readdirSync("prisma/migration-archives/devops1b-legacy-chain");
    expect(archivedMigrationEntries).toHaveLength(42);
    expect(archivedMigrationEntries.filter((name) => statSync(join("prisma/migration-archives/devops1b-legacy-chain", name)).isDirectory())).toHaveLength(40);
    expect(countRouteFiles("app", "page.tsx")).toBeGreaterThanOrEqual(273);
    expect(existsSync("app/sw.js/route.ts")).toBe(true);
    expect(countRouteFiles("app", "page.tsx") + 1).toBeGreaterThanOrEqual(274);
    expect(countRouteFiles("app/api", "route.ts")).toBeGreaterThanOrEqual(378);
    expect(read("lib/backup.ts")).toContain("backupVersion: 44");
  });

  it("adds no still-provisional business-domain models", () => {
    const schema = read("prisma/schema.prisma");
    for (const model of [
      "StudentRouteAssignment",
      "AssignmentSubmission",
      "DisciplineIncident",
      "CafeteriaPlan",
    ]) {
      expect(schema).not.toContain(`model ${model} {`);
    }
    expect(schema).toContain("model PayrollRun {");
    expect(schema).toContain("model PayslipVersion {");
  });
});
