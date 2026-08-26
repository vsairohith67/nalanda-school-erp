import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspace = path.resolve(".");
const sqliteOnlyFiles = [
  "tests/super-admin-recovery.test.ts",
  "tests/public-website-workflow.test.ts",
  "tests/public-website-restore.test.ts",
  "tests/clean-install-migrations.test.ts"
] as const;

describe("PostgreSQL application regression partition", () => {
  it("excludes only the four intrinsically SQLite copied-file suites", () => {
    const packageJson = JSON.parse(readFileSync(path.join(workspace, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const command = packageJson.scripts["test:postgres"];
    const exclusions = [...command.matchAll(/--exclude\s+(\S+)/g)].map((match) => match[1]);

    expect(exclusions).toEqual(sqliteOnlyFiles);
    expect(command).not.toContain("--passWithNoTests");
    expect(command).not.toContain("--allowOnly");

    for (const relativePath of sqliteOnlyFiles) {
      const source = readFileSync(path.join(workspace, relativePath), "utf8");
      expect(source).toMatch(/file:|migration:fresh-check|migration:restore-check/);
    }
  });

  it("keeps the full suite in SQLite CI and the bounded partition in PostgreSQL CI", () => {
    const workflow = readFileSync(path.join(workspace, ".github", "workflows", "postgres-readiness.yml"), "utf8");
    const sqliteJob = workflow.match(/  sqlite-release-gate:[\s\S]+?(?=\n  postgres-schema-migrations:)/)?.[0];
    const postgresJob = workflow.match(/  postgres-application-regression:[\s\S]+?(?=\n  cross-provider-parity-recovery:)/)?.[0];
    const crossProviderJob = workflow.match(/  cross-provider-parity-recovery:[\s\S]+$/)?.[0];
    const crossProviderJobEnv = crossProviderJob?.match(/\n    env:[\s\S]+?(?=\n    steps:)/)?.[0];
    expect(sqliteJob).toContain("cp tmp/postgres-ci/sqlite.db prisma/dev.db");
    expect(sqliteJob?.indexOf("cp tmp/postgres-ci/sqlite.db prisma/dev.db")).toBeLessThan(
      sqliteJob?.indexOf("- run: pnpm test") ?? -1
    );
    expect(sqliteJob).toMatch(/^\s*- run: pnpm test\s*$/m);
    expect(sqliteJob).not.toContain("pnpm test:postgres");
    expect(postgresJob).toMatch(/^\s*- run: pnpm test:postgres\s*$/m);
    expect(postgresJob).not.toMatch(/^\s*- run: pnpm test\s*$/m);
    expect(crossProviderJobEnv).not.toContain("POSTGRES_CONTAINER_ID");
    expect(workflow).toMatch(
      /- name: Physical dump and restore\s+env:\s+POSTGRES_CONTAINER_ID:\s*\$\{\{ job\.services\.postgres\.id \}\}/
    );
  });
});
