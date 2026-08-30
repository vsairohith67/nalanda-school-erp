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
    const syntheticSqliteSeed = readFileSync(path.join(workspace, "scripts", "postgres", "synthetic-sqlite-seed.ts"), "utf8");
    const portabilityAudit = readFileSync(path.join(workspace, "scripts", "postgres", "portability-audit.mjs"), "utf8");
    const evidenceWriters = ["qa.ts", "roles-contract.ts", "performance-contract.ts", "concurrency-contract.ts"]
      .map((file) => readFileSync(path.join(workspace, "scripts", "postgres", file), "utf8"));
    expect(workflow).not.toContain("Configure ephemeral synthetic seed credentials");
    expect(workflow).not.toContain("SEED_DIRECTOR_PASSWORD");
    expect(workflow.match(/pnpm exec tsx scripts\/postgres\/synthetic-sqlite-seed\.ts/g)).toHaveLength(2);
    expect(syntheticSqliteSeed).toContain("assertSyntheticSqliteTransfer()");
    expect(syntheticSqliteSeed).toContain('randomBytes(24).toString("hex")');
    expect(portabilityAudit).toContain('relative.replaceAll("\\\\", "/") !== outputRelative');
    expect(workflow.match(/Install governed QA utilities and report fonts/g)).toHaveLength(2);
    expect(workflow.match(/poppler-utils ripgrep ttf-mscorefonts-installer/g)).toHaveLength(2);
    expect(workflow.match(/REPORT_CARD_FONT_DIR: \/usr\/share\/fonts\/truetype\/msttcorefonts/g)).toHaveLength(2);
    expect(crossProviderJob).toContain("restored_table_count=");
    expect(crossProviderJob).toContain("table_schema='public'");
    expect(crossProviderJob).toContain('test "$restored_table_count" = "341"');
    for (const source of evidenceWriters) {
      expect(source).toMatch(/mkdirSync\(path\.dirname\(output(?:Path)?\), \{ recursive: true \}\)/);
    }
    expect(sqliteJob).toContain("pnpm exec tsx scripts/postgres/synthetic-sqlite-seed.ts");
    expect(sqliteJob).toContain("RELEASE_CI_SYNTHETIC_OPT_IN=true pnpm exec tsx scripts/prepare-release-ci-synthetic.ts");
    expect(sqliteJob).toContain("cp tmp/release-ci/synthetic.db prisma/dev.db");
    expect(sqliteJob?.indexOf("cp tmp/release-ci/synthetic.db prisma/dev.db")).toBeLessThan(
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
