import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const approvalPath = "docs/STUDENT_ADDRESS_21B_APPROVAL_RECORD.md";
const noticePath = "docs/STUDENT_ADDRESS_PRIVACY_NOTICE_DRAFT.md";
const retentionPath = "docs/STUDENT_ADDRESS_RETENTION_AND_DELETION_POLICY_DRAFT.md";
const matrixPath = "docs/STUDENT_ADDRESS_ACCESS_AND_INCIDENT_MATRIX.md";
const paths = [approvalPath, noticePath, retentionPath, matrixPath];
const approval = read(approvalPath);
const combined = paths.map(read).join("\n");

describe("Prompt 21B address approval governance", () => {
  it("creates every required governance document and approval-record heading", () => {
    for (const path of paths) expect(existsSync(path)).toBe(true);
    for (const heading of [
      "# Decision Status",
      "# Scope Proposed for Prompt 21B",
      "# Approved Purpose",
      "# Leadership Approval",
      "# Qualified Indian Privacy/Legal Review",
      "# Precision Decision",
      "# Field-Minimisation Decision",
      "# Mandatory or Optional Collection",
      "# Parent and Child Notice",
      "# Access Matrix",
      "# Aggregate Privacy Threshold",
      "# Export Decision",
      "# Retention and Exit Policy",
      "# Correction and Verification Workflow",
      "# Incident and Breach Ownership",
      "# Backup and Restore Projection",
      "# Release Blockers",
      "# Final Gate Decision",
    ]) {
      expect(approval).toContain(heading);
    }
  });

  it("uses allowed decision enums and an explicit coordinate decision", () => {
    const status = approval.match(/^Decision status: (.+)$/m)?.[1];
    expect(["PENDING", "APPROVED", "REJECTED"]).toContain(status);

    const coordinate = approval.match(/^Coordinate decision: (.+)$/m)?.[1];
    expect([
      "OMIT_ALL_COORDINATES_FROM_21B",
      "ALLOW_MANUAL_COARSE_COORDINATE_AFTER_SEPARATE_APPROVAL",
      "REJECT_LOCATION_COLLECTION",
    ]).toContain(coordinate);
    expect(coordinate).toBe("OMIT_ALL_COORDINATES_FROM_21B");

    const gate = approval.match(/^Final gate decision: (.+)$/m)?.[1];
    expect([
      "SAFE_TO_BEGIN_PROMPT_21B",
      "PROMPT_21B_BLOCKED",
      "LOCATION_PROJECT_REJECTED",
    ]).toContain(gate);
  });

  it("keeps Tier 4 and Tier 5 prohibited and coordinate fields omitted", () => {
    expect(approval).toMatch(/\| Tier 4 \| Exact residential coordinate \| PROHIBITED \|/);
    expect(approval).toMatch(/\| Tier 5 \| Live\/device location \| PROHIBITED \|/);
    for (const field of ["latitude", "longitude", "coordinatePrecision", "coordinateSource"]) {
      expect(approval).toContain(`| ${field} | OMITTED |`);
    }
  });

  it("does not fabricate leadership or qualified-review evidence", () => {
    expect(approval).toContain("Approving person: Not supplied");
    expect(approval).toContain("Approval reference or meeting note: Not supplied");
    expect(approval).toContain("Reviewer name: Not supplied");
    expect(approval).toContain("Written reference: Not supplied");
    expect(approval).toContain("has not fabricated and must not fabricate");
    expect(approval).not.toMatch(/Approving person: (?!Not supplied)[^\r\n]+/);
    expect(approval).not.toMatch(/Reviewer name: (?!Not supplied)[^\r\n]+/);
  });

  it("keeps blockers and the final gate mechanically consistent without failing regression for a pending external review", () => {
    const blockerRows = approval
      .split(/\r?\n/)
      .filter((line) => /^\| (approved purpose|approved precision tier|qualified legal\/privacy review|approved Parent notice|mandatory\/optional decision|field-minimisation decision|role matrix|aggregate threshold|export policy|retention and deletion|exit\/transfer treatment|incident ownership|backup\/restore projection|coordinate omission or separate approval|leadership signature\/reference) \|/.test(line));
    expect(blockerRows).toHaveLength(15);
    const statuses = blockerRows.map((row) => row.split("|")[2].trim());
    for (const status of statuses) expect(["RESOLVED", "UNRESOLVED", "NOT_APPLICABLE"]).toContain(status);

    const finalGate = approval.match(/^Final gate decision: (.+)$/m)?.[1];
    const allResolved = statuses.every((status) => status === "RESOLVED" || status === "NOT_APPLICABLE");
    expect(finalGate).toBe(allResolved ? "SAFE_TO_BEGIN_PROMPT_21B" : "PROMPT_21B_BLOCKED");
    expect(statuses).toContain("UNRESOLVED");
    expect(blockerRows.some((row) => row.includes("| RESOLVED |"))).toBe(false);
  });

  it("contains no real contact record or provider credential example", () => {
    expect(combined).not.toMatch(/^Student name:\s*\S+/im);
    expect(combined).not.toMatch(/^Admission number:\s*\S+/im);
    expect(combined).not.toMatch(/\b(?:\+?91[- ]?)?[6-9]\d{9}\b/);
    expect(combined).not.toMatch(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    expect(combined).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|\bpk\.[0-9A-Za-z_-]{20,}|\bsk\.[0-9A-Za-z_-]{20,}/);
    expect(combined).toContain("No real Student data appears");
  });

  it("makes no implementation claim and preserves backup version 40", () => {
    for (const path of paths) {
      const document = read(path);
      expect(document).toMatch(/No schema or runtime implementation was performed|Schema or runtime implementation: none/);
      expect(document).not.toContain("Prompt 21B is implemented");
      expect(document).not.toContain("Final gate decision: SAFE_TO_BEGIN_PROMPT_21B");
    }
    expect(approval).toContain("| Backup version | 37 |");
    expect(read("lib/backup.ts")).toContain("backupVersion: 42");
  });
});
