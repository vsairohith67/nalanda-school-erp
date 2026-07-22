import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("role matrix UI source contract", () => {
  it("keeps the required warning, save/reset actions, and future-role notes", () => {
    const source = readFileSync("components/role-permission-matrix.tsx", "utf8");

    expect(source).toContain("Changing permissions affects what users can see and do.");
    expect(source).toContain("Reset to Recommended Defaults");
    expect(source).toContain("Save Permissions");
    expect(source).toContain("Teacher opens only the safe placeholder by default");
    expect(source).toContain("Parent opens only the read-only parent portal");
    expect(source).toContain("Read-only portal");
    expect(source).toContain('role === "SUPER_ADMIN" ? true');
    expect(source).toContain('disabled={role === "SUPER_ADMIN"}');
  });

  it("keeps the matrix layout usable with horizontal scroll and a sticky permission column", () => {
    const css = readFileSync("app/globals.css", "utf8");

    expect(css).toContain(".role-matrix-wrap");
    expect(css).toContain("scrollbar-gutter: stable both-edges");
    expect(css).toContain(".role-matrix th:first-child");
    expect(css).toContain("position: sticky");
    expect(css).toContain("left: 0");
  });
});
