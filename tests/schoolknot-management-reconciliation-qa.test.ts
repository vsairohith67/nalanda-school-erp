import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const matrix = read("docs/SCHOOLKNOT_MANAGEMENT_REPLACEMENT_MATRIX.md");
const rejected = read("docs/SCHOOLKNOT_FEATURES_NOT_TO_COPY.md");
const waves = read("docs/SCHOOLKNOT_MANAGEMENT_GAP_IMPLEMENTATION_WAVES.md");
const migration = read("docs/SCHOOLKNOT_MANAGEMENT_EXPORT_AND_MIGRATION_REQUIREMENTS.md");
const qa = read("docs/SCHOOLKNOT_MANAGEMENT_RECONCILIATION_QA_REPORT.md");
const combined = [matrix, rejected, waves, migration, qa].join("\n");

function countRouteFiles(root: string, filename: string) {
  let count = 0;
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) count += countRouteFiles(path, filename);
    else if (name === filename) count += 1;
  }
  return count;
}

function decisionCount(decision: string) {
  return matrix.split(/\r?\n/).filter((line) => line.startsWith("|") && line.includes(`| ${decision} |`)).length;
}

describe("Prompt 23B-M-QA independent Management reconciliation QA", () => {
  it("records the exact authenticated Management source boundary", () => {
    for (const fact of [
      "21 July 2026",
      "Authenticated `MANAGEMENT`",
      "15: Dashboard, Communication, Academics, Attendance, Students, Staff, Exams, Finance, Admissions, HR, Downloads, Transport, Settings, Discipline, Cafeteria",
      "119 structural page observations",
      "39 representative checks at exact 390 × 844",
      "No save, send, approval, payment, refund, delete, upload, export, download, print or other mutation was executed",
      "Parent, Teacher and Principal template coverage remains pending",
    ]) {
      expect(qa).toContain(fact);
    }
    expect(qa).toContain("Day Closer blank");
    expect(qa).toContain("Admissions Dynamic Report unreliable");
  });

  it("corrects every unsupported strongest classification", () => {
    for (const row of [
      "Dashboard / Homepage",
      "Communication / Notifications / Compose",
      "Students / Add Student",
      "Staff / Add Teacher and Employee",
      "Exams / Analytics",
      "Finance / Old Fee Reports",
      "HR / Daily Attendance",
      "Settings / Subjects",
      "Settings / Classes",
    ]) {
      const line = matrix.split(/\r?\n/).find((candidate) => candidate.startsWith(`| ${row} |`));
      expect(line, row).toContain("| PARTIALLY_REPLACED |");
    }
    for (const row of [
      "Schoolknot / Library/books",
      "Schoolknot / Backup/restore",
      "Schoolknot / Expenses, Budgets, Cash Book",
    ]) {
      const line = matrix.split(/\r?\n/).find((candidate) => candidate.startsWith(`| ${row} |`));
      expect(line, row).toContain("| NEEDS_MORE_EVIDENCE |");
      expect(line, row).not.toContain("| NALANDA_STRONGER |");
    }
  });

  it("locks the corrected classification totals", () => {
    expect(decisionCount("FULLY_REPLACED")).toBe(2);
    expect(decisionCount("NALANDA_STRONGER")).toBe(11);
    expect(decisionCount("PARTIALLY_REPLACED")).toBe(36);
    expect(decisionCount("MISSING")).toBe(23);
    expect(decisionCount("DEPLOYMENT_ONLY")).toBe(2);
    expect(decisionCount("BLOCKED_APPROVAL")).toBe(4);
    expect(decisionCount("SHOULD_NOT_COPY")).toBe(6);
    expect(decisionCount("NEEDS_MORE_EVIDENCE")).toBe(12);
  });

  it("gives every should-not-copy decision explicit evidence and safeguards", () => {
    expect(rejected).toContain("| Observed pattern | Schoolknot evidence | Risk | Nalanda policy | Safer alternative | Final decision |");
    const table = rejected.slice(rejected.indexOf("| Observed pattern |"), rejected.indexOf("## Non-negotiable safeguards"));
    const rows = table.split(/\r?\n/).filter((line) => line.startsWith("|") && !line.includes("Observed pattern") && !/^\|[-|]+\|$/.test(line.replaceAll(" ", "")));
    expect(rows).toHaveLength(22);
    for (const row of rows) {
      const columns = row.split("|").slice(1, -1).map((value) => value.trim());
      expect(columns).toHaveLength(6);
      expect(columns.every(Boolean), row).toBe(true);
      expect(columns[1], row).toMatch(/VERIFIED_|NEEDS_|INACCESSIBLE|BLANK_OR_BROKEN/);
    }
    for (const safeguard of ["least privilege", "confirmation", "append-only audit", "fixed field dictionary", "Parent/Teacher/Principal decisions wait"]) {
      expect(rejected).toContain(safeguard);
    }
  });

  it("rechecks every named gap without approving a new module", () => {
    for (const area of [
      "Admissions/enquiries",
      "Payroll/payslips/salary/advance",
      "Resignation/exit",
      "Events/holidays/calendar/tasks",
      "Transport/routes/vehicles/readings/bus pass",
      "GPS/tracking",
      "Student submissions/attachments/classwork",
      "Consolidated examinations",
      "Discipline/cafeteria/general inventory",
      "Refund",
      "Day Closer",
      "Schoolknot backup/restore",
      "Bulk exports/updates",
      "Mobile/app",
    ]) {
      expect(qa).toContain(`| ${area} |`);
    }
    expect(qa).toContain("No wave finalises cross-role priority, creates a model");
  });

  it("keeps waves provisional and all three role holds explicit", () => {
    expect(waves).toContain("provisional proposal only");
    for (const wave of ["Wave M1", "Wave M2", "Wave M3", "Wave M4", "Wave M5", "Wave M6"]) expect(waves).toContain(wave);
    for (const hold of ["### Await Parent audit", "### Await Teacher audit", "### Await Principal audit"]) expect(qa).toContain(hold);
    expect(qa).toContain("Prompt 21B–21D and Prompt 22B remain blocked");
    expect(qa).toContain("Final Prompt 23B must still wait");
  });

  it("preserves the Management checkpoint across additive examination and payroll implementation", () => {
    const schema = read("prisma/schema.prisma");
    expect((schema.match(/^model /gm) ?? [])).toHaveLength(308);
    expect(schema).toContain("model SuperAdminDiaryEntry {");
    expect(schema).toContain("model SuperAdminTask {");
    expect(schema).toContain("model SuperAdminContact {");
    expect(schema).toContain("model SuperAdminWorkAudit {");
    expect(schema).toContain("model ExaminationSchemeVersion {");
    expect(schema).toContain("model TeacherExamAssignment {");
    expect(schema).toContain("model ExaminationTimetableVersion {");
    expect(read("docs/CONTROLLED_SAMPLE_DATA_CLEANUP_AND_NEW_BASELINE.md")).toContain(
      "baseline is historical rollback/provenance evidence only.",
    );
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
      "20260822113000_event_media_v1_5_foundation",
      "20260822170000_parent_meetings_v1_5",
    ]);
    const archivedMigrationEntries = readdirSync("prisma/migration-archives/devops1b-legacy-chain");
    expect(archivedMigrationEntries).toHaveLength(42);
    expect(archivedMigrationEntries.filter((name) => statSync(join("prisma/migration-archives/devops1b-legacy-chain", name)).isDirectory())).toHaveLength(40);
    expect(countRouteFiles("app", "page.tsx") + (existsSync("app/sw.js/route.ts") ? 1 : 0)).toBeGreaterThanOrEqual(274);
    expect(countRouteFiles("app/api", "route.ts")).toBeGreaterThanOrEqual(378);
    expect(read("lib/backup.ts")).toContain("backupVersion: 43");
    expect(schema).toContain("model PayrollRun {");
    expect(schema).toContain("model PayslipVersion {");
    for (const model of ["TransportRoute", "DisciplineIncident", "CafeteriaPlan"]) {
      expect(schema).not.toContain(`model ${model} {`);
    }
  });

  it("clears Management QA only and contains no personal Schoolknot data", () => {
    expect(qa).toContain("`MANAGEMENT_RECONCILIATION_CLEARED`");
    expect(qa).toContain("Final Prompt 23B status: **incomplete");
    expect(combined).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(combined).not.toMatch(/\b[6-9]\d{9}\b/);
    expect(combined).not.toMatch(/\b\d{12}\b/);
    expect(qa).toContain("No export/import/download, personal data, screenshot or credential stored");
  });
});
