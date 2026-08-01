import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const matrix = read("docs/SCHOOLKNOT_FINAL_MULTI_ROLE_REPLACEMENT_MATRIX.md");
const ledger = read("docs/SCHOOLKNOT_FINAL_UNRESOLVED_EVIDENCE_LEDGER.md");
const roles = read("docs/SCHOOLKNOT_ROLE_PERMISSION_AND_PRIVACY_COMPARISON.md");
const teacher = read("docs/TEACHER_ATTENDANCE_SCOPE_CUTOVER_BLOCKER.md");
const rejected = read("docs/SCHOOLKNOT_FEATURES_NOT_TO_COPY.md");
const gates = read("docs/SCHOOLKNOT_CUTOVER_BLOCKERS_AND_ACCEPTANCE_GATES.md");
const roadmap = read("docs/SCHOOLKNOT_GAP_IMPLEMENTATION_ROADMAP_23C_ONWARD.md");
const synthetic = read("docs/SCHOOLKNOT_SYNTHETIC_WRITE_TEST_PLAN.md");
const vendor = read("docs/SCHOOLKNOT_VENDOR_EXPORT_AND_DATA_DICTIONARY_REQUEST.md");
const decision = read("docs/SCHOOLKNOT_FINAL_REPLACEMENT_DECISION.md");
const reconciliation = read("docs/RECON_1A_SCHOOLKNOT_FINANCE_POLICY_RECONCILIATION.md");
const fin2a = read("docs/ACCOUNTANT_DATA_MINIMISATION_AND_RECEIPT_INTEGRITY.md");
const fin2b = read("docs/ACCOUNTANT_RECEIPT_CANCELLATION_CORRECTION_AND_NOTIFICATION.md");
const developerGuide = read("docs/DEVELOPER_CONTINUATION_GUIDE.md");
const operationsGuide = read("docs/OPERATIONS.md");
const beginnerGuide = read("docs/NOOB_OPERATING_GUIDE.md");
const statusDocs = [
  "docs/ERP_FEATURE_STATUS_AND_GAP_MAP.md",
  "docs/SCHOOLKNOT_REPLACEMENT_GAP_MAP.md",
  "docs/BUG_LIMITATION_AND_TECH_DEBT_REGISTER.md",
  "docs/DEVELOPER_CONTINUATION_GUIDE.md",
  "docs/NOOB_OPERATING_GUIDE.md",
  "docs/PROMPT_HISTORY.md",
  "docs/INDEX.md",
].map(read).join("\n");
const combined = [matrix, ledger, roles, teacher, rejected, gates, roadmap, synthetic, vendor, decision].join("\n");

function countRouteFiles(root: string, filename: string) {
  let count = 0;
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) count += countRouteFiles(path, filename);
    else if (name === filename) count += 1;
  }
  return count;
}

describe("Prompt 23B final Schoolknot multi-role consolidation", () => {
  it("locks all required authenticated role facts and source closure", () => {
    for (const fact of [
      "MANAGEMENT_RECONCILIATION_CLEARED",
      "15 top-level modules",
      "119 desktop observations",
      "39 exact `390 x 844` checks",
      "18 visible desktop entries across 15 routes",
      "9 top-level areas",
      "Admin Executive",
      "ACCOUNTANT_AUDIT_PARTIAL_NEEDS_EVIDENCE",
      "FINANCE_PRIVACY_AND_RECEIPT_INTEGRITY_CLEARED",
      "5 menu groups",
      "9 menu routes plus one legacy password route",
      "TEACHER_AUDIT_COMPLETE_WITH_EVIDENCE_GAPS",
      "NO_GO_FOR_TEACHER_CUTOVER",
      "READY_FOR_PROMPT_23B",
    ]) expect(matrix).toContain(fact);
    expect(matrix).toContain("No live Schoolknot page was reopened");
  });

  it("contains exactly 109 unique source rows with one allowed disposition and all eight represented", () => {
    const allowed = [
      "REQUIRES_VENDOR_EVIDENCE",
      "REQUIRES_DIFFERENT_ROLE",
      "REQUIRES_POPULATED_TEST_DATA",
      "REQUIRES_SYNTHETIC_WRITE_TEST",
      "REQUIRES_EXPORT_SAMPLE",
      "NOT_USED_BY_NALANDA",
      "SAFE_TO_DEFER",
      "ALREADY_REPLACED_WITHOUT_PARITY_EVIDENCE",
    ];
    const rows = ledger.split(/\r?\n/).filter((line) => /^\| (?:M|P|R|T|A)\d{2} \|/.test(line));
    expect(rows).toHaveLength(109);
    const ids = rows.map((line) => line.split("|")[1].trim());
    expect(new Set(ids).size).toBe(109);
    expect(ids.filter((id) => id.startsWith("M"))).toHaveLength(22);
    expect(ids.filter((id) => id.startsWith("P"))).toHaveLength(22);
    expect(ids.filter((id) => id.startsWith("R"))).toHaveLength(26);
    expect(ids.filter((id) => id.startsWith("T"))).toHaveLength(20);
    expect(ids.filter((id) => id.startsWith("A"))).toHaveLength(19);
    for (const row of rows) {
      const matches = allowed.filter((value) => row.includes(`\`${value}\``));
      expect(matches, row).toHaveLength(1);
    }
    const expected = new Map([
      ["REQUIRES_VENDOR_EVIDENCE", 23],
      ["REQUIRES_DIFFERENT_ROLE", 10],
      ["REQUIRES_POPULATED_TEST_DATA", 14],
      ["REQUIRES_SYNTHETIC_WRITE_TEST", 29],
      ["REQUIRES_EXPORT_SAMPLE", 6],
      ["NOT_USED_BY_NALANDA", 7],
      ["SAFE_TO_DEFER", 11],
      ["ALREADY_REPLACED_WITHOUT_PARITY_EVIDENCE", 9],
    ]);
    for (const [value, count] of expected) {
      expect(rows.filter((row) => row.includes(`\`${value}\``))).toHaveLength(count);
    }
  });

  it("treats FIN-2A as resolved and preserves payroll/self-service uncertainty", () => {
    expect(matrix).toContain("FIN-2A and FIN-2B Nalanda controls resolved");
    expect(roles).toContain("FIN-2A privacy/export/`ReceiptNote`-`Payment` integrity issues are resolved");
    expect(roles).toContain("FIN-2B supersedes only Prompt 23B's earlier Accountant cancellation wording");
    expect(decision).toContain("Payroll and employee self-service remain absent/unverified");
    expect(combined).not.toContain("FIN-2A implementation pending");
  });

  it("locks the RECON-1A Accountant policy without rewriting unrelated Prompt 23B conclusions", () => {
    for (const fact of [
      "Prompt 23B and FIN-2B were initiated as parallel workstreams",
      "9752304952a02d840a5d2a629b0f1896d0589a1b",
      "65b4b00f49d97276cd3f8a1f31093be94cb98ccf",
      "f1c29def5073d45e486878481e2b6e2d2b069e8d",
      "CANCEL_FINAL_RECEIPT",
      "CORRECT_FINAL_RECEIPT",
      "Every successful Accountant cancellation or correction",
      "No approved or implemented `FIN-2C` scope exists",
      "Teacher remains `NO_GO`",
    ]) expect(reconciliation).toContain(fact);

    for (const doc of [matrix, roles, decision, gates, roadmap, fin2b, developerGuide, operationsGuide, beginnerGuide]) {
      expect(doc).toMatch(/FIN-2A/);
      expect(doc).toMatch(/FIN-2B/);
      expect(doc).toMatch(/FIN-2C/);
    }

    expect(fin2a).toContain("FIN-2B supersedes only that authority rule");
    expect(fin2a).toContain("Payment` components are authoritative");
    expect(developerGuide).not.toContain("Final cancellation is whole-receipt, Director/Super Admin only");
    expect(beginnerGuide).not.toContain("Accountant can make an audited payment correction, but cannot cancel a final receipt");
    expect(reconciliation).toContain("Teacher attendance and every unrelated Prompt 23B conclusion are unchanged");
  });

  it("retains the exact Teacher attendance defect and records its narrow QA clearance", () => {
    for (const fact of [
      "VIEW_STUDENT_ATTENDANCE",
      "MANAGE_STUDENT_ATTENDANCE",
      "SUBMIT_STUDENT_ATTENDANCE",
      "permission is treated as global authority",
      "StaffMember -> TimetableTeacher",
      "TimetableAssignment",
      "I-B",
      "VI-C",
      "zero subject assignments",
      "fail closed",
      "RESOLVED_BY_PROMPT_23C_QA",
      "CRITICAL_BLOCKER_CLEARED",
      "Overall Teacher replacement: `CONDITIONAL`",
    ]) expect(teacher).toContain(fact);
    expect(gates).toContain("| Teacher | `CONDITIONAL_GO` |");
    expect(gates).toContain("blocker are therefore resolved.");
    expect(gates).toContain("Overall Teacher replacement remains `CONDITIONAL`");
    expect(gates).toContain("No role currently has an unconditional `GO`");
  });

  it("keeps the 23C onward order and does not smuggle adjacent work into 23C", () => {
    const order = ["| 23C |", "| 23D |", "| 23E |", "| 23F |", "| 23G |", "| 23H |", "| 23I |", "| 23J |"];
    let previous = -1;
    for (const marker of order) {
      const index = roadmap.indexOf(marker);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
    expect(roadmap).toContain("23B-QA");
    expect(roadmap).toContain("Parent attendance, timetable UI redesign, biometric/RFID, new attendance lifecycle");
  });

  it("gives every 23C-23J prompt an explicit implementation and cutover contract", () => {
    for (const heading of [
      "Schema / data boundary",
      "Privacy boundary",
      "Finance boundary",
      "Storage / provider boundary",
      "Migration boundary",
      "Required tests",
      "Release gate",
      "Dependencies",
      "Cutover impact",
    ]) expect(roadmap).toContain(heading);

    const rows = roadmap.split(/\r?\n/).filter((line) => /^\| 23[C-J] \|/.test(line));
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row.split("|").slice(1, -1)).toHaveLength(14);
      expect(row).toMatch(/independent 23[C-J]-QA/i);
      expect(row).toMatch(/cutover|NO_GO|blocker|parity/i);
    }
  });

  it("keeps Prompt 21/22 and DEVOPS-1D gates unchanged", () => {
    for (const doc of [roadmap, decision, statusDocs]) {
      expect(doc).toMatch(/21B-21D (?:remain |are )?blocked/);
      expect(doc).toMatch(/22B (?:remains )?conditional/);
      expect(doc).toMatch(/22C-22D (?:remain )?blocked/);
    }
    expect(decision).toContain("DEVOPS-1D PAYMENT_GATED_DEFERRED");
    expect(statusDocs).toContain("no provider, VPS, DNS, external backup or monitoring was activated");
  });

  it("does not recommend unsafe source patterns or expose obvious personal data", () => {
    for (const pattern of [
      "DOB-derived passwords",
      "Unrestricted bulk Student editing",
      "Direct historical deletion",
      "Recipient/read surveillance",
      "Staff usage rankings",
      "Marks-only Teacher performance decisions",
      "Public attachment URLs",
      "Inaccessible mobile navigation",
      "Provider-specific lock-in",
    ]) expect(rejected).toContain(pattern);
    expect(rejected).toContain("Final decisions");
    expect(combined).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(combined).not.toMatch(/\b[6-9]\d{9}\b/);
    expect(combined).not.toMatch(/\b\d{12}\b/);
    expect(vendor).toContain("Do not provide passwords, tokens, private keys");
  });

  it("keeps synthetic tests as plans and vendor requests credential-free", () => {
    expect(synthetic).toContain("plan only; no test was run");
    expect(synthetic).toContain("vendor-approved non-production tenant");
    expect(vendor).toContain("nothing downloaded");
    expect(vendor).toContain("no credential requested");
  });

  it("preserves the Schoolknot checkpoint across the additive examination implementation", () => {
    const schema = read("prisma/schema.prisma");
    expect((schema.match(/^model /gm) ?? [])).toHaveLength(189);
    expect(schema).toContain("model ExaminationSchemeVersion {");
    expect(schema).toContain("model TeacherExamAssignment {");
    expect(createHash("sha256").update(readFileSync("prisma/migrations/20260722_clean_install_baseline/migration.sql")).digest("hex").toUpperCase()).toBe(
      "E6D467206CFA536487C8C63882D13BA489C0235BE74E9E076423323A511C3025",
    );
    expect(read("docs/CONTROLLED_SAMPLE_DATA_CLEANUP_AND_NEW_BASELINE.md")).toContain(
      "baseline is historical rollback/provenance evidence only.",
    );
    expect(countRouteFiles("app", "page.tsx") + Number(existsSync("app/sw.js/route.ts"))).toBeGreaterThanOrEqual(274);
    expect(countRouteFiles("app/api", "route.ts")).toBeGreaterThanOrEqual(378);
    expect(read("lib/backup.ts")).toContain("backupVersion: 37");
    const permissionTokens = new Set([...read("lib/permissions.ts").matchAll(/permission:\s*"([A-Z0-9_]+)"/g)].map((match) => match[1]));
    expect(permissionTokens.size).toBeGreaterThanOrEqual(339);
    expect(permissionTokens.has("CANCEL_FINAL_RECEIPT")).toBe(true);
    expect(permissionTokens.has("CORRECT_FINAL_RECEIPT")).toBe(true);
    expect(permissionTokens.has("ACTIVATE_EXAM_SCHEMES")).toBe(true);
    expect(permissionTokens.has("ASSIGN_EXAM_TEACHERS")).toBe(true);
    for (const model of ["AdmissionEnquiry", "PayrollRun", "TransportRoute", "ClassworkSubmission", "DisciplineIncident", "CafeteriaPlan"]) {
      expect(schema).not.toContain(`model ${model} {`);
    }
  });

  it("uses one defensible decision and no false cutover claim", () => {
    expect(decision).toContain("Decision: `REPLACEMENT_BUILD_CONTINUES_CUTOVER_NOT_READY`");
    expect(combined).not.toContain("FULL_SCHOOL_CUTOVER_GO");
    expect(combined).not.toContain("FULL_PARITY_CONFIRMED");
    expect(gates).toContain("NO_WHOLE_SCHOOL_GO");
  });
});
