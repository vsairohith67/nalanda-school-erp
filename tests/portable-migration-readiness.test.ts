import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("portable migration readiness", () => {
  it("pins readiness to the latest PostgreSQL migration", async () => {
    const compose = await readFile(path.resolve("deploy/portable/compose.yml"), "utf8");
    const migrations = (await readdir(path.resolve("prisma/postgresql/migrations"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(migrations.at(-1)).toBeTruthy();
    expect(compose).toContain(`PORTABLE_EXPECTED_POSTGRES_MIGRATION: ${migrations.at(-1)}`);
  });
});
