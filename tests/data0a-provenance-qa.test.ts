import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFile(path.resolve(relativePath), "utf8");

describe("DATA-0A independent provenance QA", () => {
  it("keeps the independent rehearsal isolated and count-scoped", async () => {
    const script = await read("scripts/data0aqa-independent-verification.ts");

    expect(script).toContain('"DATA0AQA"');
    expect(script).toContain('"operational-copy.db"');
    expect(script).toContain("DATA0AQA_BYTE_IDENTICAL_COPY_PREPARED");
    expect(script).toContain("DATA0AQA_CLEANUP_ALREADY_EMPTY");
    expect(script).toContain("DATA0AQA_BACKUP_RESTORED_TWICE");
    expect(script).toContain('"AcademicYearEnrollment"');
    expect(script).toContain('"PaymentAudit"');
    expect(script).toContain('"ReceiptNote"');
    expect(script).toContain('"StudentLifecycleEvent"');
    expect(script).not.toContain('CLEANED_TABLES.add("User")');
    expect(script).not.toContain('CLEANED_TABLES.add("RolePermission")');
  });

  it("records the independent evidence and mandatory DATA-0B gates", async () => {
    const report = await read(
      "docs/PRE_EXISTING_SAMPLE_DATA_PROVENANCE_AND_CLEANUP_PLAN.md"
    );

    expect(report).toContain("`SAMPLE_DATA_PROVENANCE_CLEARED`");
    expect(report).toContain("`VERIFIED_SAMPLE`");
    expect(report).toContain("`VERIFIED_QA`");
    expect(report).toContain("zero rows classified `POTENTIALLY_REAL` or `UNKNOWN`");
    expect(report).toContain("Business demo seeding is disabled by default.");
    expect(report).toContain("refuses the operational database");
    expect(report).toContain("enabled seed-account password");
    expect(report).toContain("**Receipt decision:** `PRESERVE_RECEIPT_SEQUENCE`");
    expect(report).toContain("`_prisma_migrations` table");
    expect(report).toContain("**Operational cleanup approval:** `REQUIRED_NOT_YET_GRANTED`");
  });

  it("keeps the destructive command out of the beginner-facing guide", async () => {
    const guide = await read("docs/NOOB_OPERATING_GUIDE.md");

    expect(guide).not.toContain("data0a:cleanup apply-operational");
    expect(guide).not.toContain("USER_APPROVED_DATA0A_OPERATIONAL_CLEANUP");
  });
});
