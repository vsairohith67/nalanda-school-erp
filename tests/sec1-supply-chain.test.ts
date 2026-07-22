import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SHEETJS_SOURCE = "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz";
const SHEETJS_INTEGRITY =
  "sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==";

describe("SEC-1 supply-chain invariants", () => {
  it("pins SheetJS to the reviewed patched tarball and lockfile integrity", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(ROOT, "package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
    };
    const lockfile = await readFile(path.join(ROOT, "pnpm-lock.yaml"), "utf8");

    expect(packageJson.dependencies?.xlsx).toBe(SHEETJS_SOURCE);
    expect(lockfile).toContain(`specifier: ${SHEETJS_SOURCE}`);
    expect(lockfile).toContain(`tarball: ${SHEETJS_SOURCE}`);
    expect(lockfile).toContain(`integrity: ${SHEETJS_INTEGRITY}`);
  });

  it("does not expose dependency lifecycle or interactive test-server scripts", async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(ROOT, "package.json"), "utf8")
    ) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const scripts = packageJson.scripts ?? {};
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    expect(scripts.preinstall).toBeUndefined();
    expect(scripts.install).toBeUndefined();
    expect(scripts.postinstall).toBeUndefined();
    expect(scripts.test).toBe("vitest run");
    expect(Object.values(scripts).some((command) => /\bvitest\s+--ui\b/.test(command))).toBe(false);
    expect(
      Object.values(dependencies).some((source) => /^(?:git|git\+|github:)/i.test(source))
    ).toBe(false);
  });
});
