import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_MIGRATION_ROOT,
  LEGACY_MIGRATION_ROOT,
  buildMigrationInventory,
  verifyLegacyManifest
} from "../scripts/migration-inventory";
import {
  BASELINE_MIGRATION,
  OPERATIONAL_DATABASE,
  QA_ROOT,
  WORKSPACE_ROOT,
  assertIsolatedDatabasePath
} from "../scripts/migration-isolation";

function pnpm(args: string[]) {
  const entry = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs");
  return execFileSync(process.execPath, [entry, ...args], {
    cwd: WORKSPACE_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
}

describe("DEVOPS-1B clean-install migration repair", () => {
  it("preserves and reproduces the original Payment dependency failure", () => {
    const sql = readFileSync(path.join(LEGACY_MIGRATION_ROOT, "20260618_phase2_auth_audit", "migration.sql"), "utf8");
    expect(sql.split(/\r?\n/)[0]).toContain('ALTER TABLE "Payment"');
    const probe = `const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');const db=new DatabaseSync(':memory:');try{db.exec(fs.readFileSync(process.argv[1],'utf8'));process.exit(2)}catch(error){console.log(error.message);if(!/no such table: Payment/i.test(error.message))process.exit(3)}finally{db.close()}`;
    const output = execFileSync(process.execPath, ["-e", probe, path.join(LEGACY_MIGRATION_ROOT, "20260618_phase2_auth_audit", "migration.sql")], { encoding: "utf8" });
    expect(output).toMatch(/no such table: Payment/i);
  });

  it("keeps the generated baseline first and the examination migration additive", () => {
    const active = readdirSync(ACTIVE_MIGRATION_ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(active).toEqual([BASELINE_MIGRATION, "20260730_exam_scheme_assignment_foundation"]);
    expect(readFileSync(path.join(ACTIVE_MIGRATION_ROOT, BASELINE_MIGRATION, "migration.sql"), "utf8"))
      .toContain('CREATE TABLE "Payment"');
  });

  it("detects all unresolved legacy dependencies and validates the archive manifest", () => {
    const rows = buildMigrationInventory(LEGACY_MIGRATION_ROOT);
    const unresolved = rows.filter((row) => !row.safeOnEmptyInOrder);
    expect(rows).toHaveLength(40);
    expect(unresolved).toHaveLength(16);
    expect(unresolved[0].missingDependencies).toContain("Payment");
    expect(unresolved[1].missingDependencies).toContain("Student");
    expect(verifyLegacyManifest().migrationCount).toBe(40);
  });

  it("fails closed for the operational path, outside paths, traversal, and symlink escapes", () => {
    expect(() => assertIsolatedDatabasePath(OPERATIONAL_DATABASE)).toThrow("ISOLATION_REFUSED_OPERATIONAL_DATABASE");
    expect(() => assertIsolatedDatabasePath(path.join(WORKSPACE_ROOT, "outside.db"))).toThrow("ISOLATION_REFUSED_OUTSIDE_DEVOPS1B_ROOT");
    expect(() => assertIsolatedDatabasePath(path.join(QA_ROOT, "..", "escaped.db"))).toThrow("ISOLATION_REFUSED_OUTSIDE_DEVOPS1B_ROOT");
    const link = path.join(QA_ROOT, "empty-db", "DEVOPS1B-symlink-escape");
    try {
      symlinkSync(path.join(WORKSPACE_ROOT, "prisma"), link, "junction");
      expect(() => assertIsolatedDatabasePath(path.join(link, "escaped.db"))).toThrow("ISOLATION_REFUSED_SYMLINK_ESCAPE");
    } finally {
      rmSync(link, { force: true, recursive: true });
    }
  });

  it("deploys from empty, reports clean status, matches the schema, and bootstraps synthetic data", async () => {
    const output = pnpm(["migration:fresh-check"]);
    expect(output).toContain("Fresh migration check passed: migrations=2 models=174 tables=174");
    expect(output).toContain("Synthetic bootstrap passed");
  }, 180_000);

  it("onboards an unbaselined schema twice without changing application data", async () => {
    const output = pnpm(["exec", "tsx", "scripts/migration-existing-db-rehearsal.ts", "--synthetic"]);
    expect(output).toContain("Existing database onboarding passed twice");
    expect(output).toContain("students=0 activeEnrollments=0 payments=0 collected=0");
  }, 180_000);

  it("keeps version-37 restore idempotent and preserves local ownership collisions", async () => {
    const output = pnpm(["migration:restore-check"]);
    expect(output).toContain("Backup/restore passed: version=37 arrays=158");
    expect(output).toContain("local login ownership and Student collision mapping were preserved");
  }, 300_000);

  it("contains no operational fixture values, seeded secret DML, or db-push install dependency", () => {
    const baseline = readFileSync(path.join(ACTIVE_MIGRATION_ROOT, BASELINE_MIGRATION, "migration.sql"), "utf8");
    const packageJson = JSON.parse(readFileSync(path.join(WORKSPACE_ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    const privacyDocs = [
      "README.md",
      "docs/DEVELOPER_CONTINUATION_GUIDE.md",
      "docs/ERP_ROUTE_AND_MODULE_INVENTORY.md",
      "docs/PROJECT_HANDOVER.md",
      "docs/REAL_DATA_PILOT_RUNBOOK.md"
    ].map((file) => readFileSync(path.join(WORKSPACE_ROOT, file), "utf8"));
    expect(baseline).not.toMatch(/NPS26001|Aarav|99100|Nalanda@|INSERT\s+INTO|UPDATE\s+[^\s]+\s+SET|DELETE\s+FROM/i);
    for (const name of ["migration:fresh-check", "migration:schema-check", "migration:existing-db-check"]) {
      expect(packageJson.scripts[name]).not.toContain("db push");
    }
    for (const text of privacyDocs) expect(text).not.toMatch(/C:[\\/]Users[\\/]dell/i);
    for (const file of ["README.md", "docs/PROJECT_HANDOVER.md"]) {
      expect(readFileSync(path.join(WORKSPACE_ROOT, file), "utf8")).not.toMatch(/pnpm(?:\.cmd)?\s+db:push|prisma\s+db\s+push/i);
    }
  });
});
