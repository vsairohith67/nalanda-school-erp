import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("make-super-admin script", () => {
  it("is registered and promotes an existing user without password output", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const source = readFileSync("scripts/make-super-admin.ts", "utf8");

    expect(packageJson.scripts["user:make-super-admin"]).toBe("tsx scripts/make-super-admin.ts");
    expect(source).toContain("findFirst");
    expect(source).toContain('role: "SUPER_ADMIN"');
    expect(source).toContain("No existing user found");
    expect(source).toContain("Create the user first, then promote it");
    expect(source).toContain("Success:");
    expect(source).not.toContain("passwordHash");
    expect(source).not.toContain("hashPassword");
  });
});
