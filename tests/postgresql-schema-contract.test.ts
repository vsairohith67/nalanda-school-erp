import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workspace = path.resolve(".");

describe("PostgreSQL schema contract", () => {
  it("is deterministically synchronized with the canonical SQLite schema", () => {
    expect(() => execFileSync(process.execPath, ["scripts/postgres/schema-contract.mjs", "--check"], { cwd: workspace, stdio: "pipe" })).not.toThrow();
    const sqlite = readFileSync(path.join(workspace, "prisma", "schema.prisma"), "utf8");
    const postgres = readFileSync(path.join(workspace, "prisma", "postgresql", "schema.prisma"), "utf8");
    const sqliteModelCount = (sqlite.match(/^model\s+/gm) ?? []).length;
    const postgresModelCount = (postgres.match(/^model\s+/gm) ?? []).length;
    expect(sqliteModelCount).toBeGreaterThanOrEqual(330);
    expect(postgresModelCount).toBe(sqliteModelCount);
    expect(postgres).toContain('provider = "postgresql"');
    expect(postgres).toContain('directUrl = env("DIRECT_URL")');
  });
});
