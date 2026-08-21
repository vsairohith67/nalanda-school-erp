import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { COMMAND_CENTER_ACTIVITY_LIMIT, composeSuperAdminCommandCenter, humanizeCommandCenterValue, isSuperAdminCommandCenterRole, type CommandCenterReaders } from "../lib/super-admin-command-center";
import { ROLES } from "../lib/permissions";

function readers(overrides: Partial<CommandCenterReaders> = {}): CommandCenterReaders {
  return {
    today: vi.fn(async () => []),
    schoolPulse: vi.fn(async () => []),
    systemHealth: vi.fn(async () => ({ generatedAt: "2026-08-21T00:00:00.000Z", overall: "HEALTHY" as const, items: [] })),
    recentActivity: vi.fn(async () => []),
    ...overrides
  };
}

describe("Super Admin Command Center foundation", () => {
  it("allows only the exact SUPER_ADMIN role, including against delegated permissions", () => {
    expect(isSuperAdminCommandCenterRole("SUPER_ADMIN")).toBe(true);
    for (const role of ROLES.filter((role) => role !== "SUPER_ADMIN")) expect(isSuperAdminCommandCenterRole(role)).toBe(false);
    expect(isSuperAdminCommandCenterRole("DELEGATED_CUSTOM_ROLE")).toBe(false);
  });

  it("keeps API and page authorization server-side and exact-role", () => {
    const page = readFileSync("app/super-admin/command-center/page.tsx", "utf8");
    const api = readFileSync("app/api/super-admin/command-center/route.ts", "utf8");
    expect(page).toContain('requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN")');
    expect(api).toContain('requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN")');
    expect(api).toContain('"private, no-store, max-age=0"');
    expect(api).toContain('"Command Center is temporarily unavailable."');
    expect(api).not.toContain("searchParams");
  });

  it("returns partial results when one widget group fails", async () => {
    const result = await composeSuperAdminCommandCenter(readers({
      today: async () => [{ id: "support", label: "Pending support", value: 2, detail: "Open", state: "OK", href: "/support" }],
      schoolPulse: async () => { throw new Error("private database detail"); }
    }), { now: new Date("2026-08-21T00:00:00.000Z"), timeoutMs: 50 });
    expect(result.today).toHaveLength(1);
    expect(result.schoolPulse).toEqual([]);
    expect(result.readOnly).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private database detail");
  });

  it("marks timeouts degraded without blanking other sections", async () => {
    const never = new Promise<never>(() => undefined);
    const result = await composeSuperAdminCommandCenter(readers({ recentActivity: () => never }), { timeoutMs: 5 });
    expect(result.recentActivity).toMatchObject({ state: "DEGRADED", data: [] });
    expect(result.systemHealth.state).toBe("OK");
  });

  it("preserves legitimate zero values and unavailable values as different states", async () => {
    const result = await composeSuperAdminCommandCenter(readers({
      today: async () => [
        { id: "zero", label: "Zero", value: 0, detail: "None", state: "EMPTY", href: "/support" },
        { id: "missing", label: "Missing", value: null, detail: "Source is not available.", state: "UNAVAILABLE", href: "/support" }
      ]
    }));
    expect(result.today[0]).toMatchObject({ value: 0, state: "EMPTY" });
    expect(result.today[1]).toMatchObject({ value: null, state: "UNAVAILABLE" });
  });

  it("keeps activity bounded and strips unsafe enum punctuation", async () => {
    const activities = Array.from({ length: COMMAND_CENTER_ACTIVITY_LIMIT }, (_, index) => ({ time: new Date(index).toISOString(), action: "Viewed", module: "IAM", actor: "Authorised user", result: "Completed" }));
    const result = await composeSuperAdminCommandCenter(readers({ recentActivity: async () => activities }));
    expect(result.recentActivity.data).toHaveLength(COMMAND_CENTER_ACTIVITY_LIMIT);
    expect(humanizeCommandCenterValue('<script>alert(1)</script>_TOKEN')).not.toContain("<");
  });

  it("has no operational write, provider invocation, AI invocation, or migration in the composition service", () => {
    const source = readFileSync("lib/super-admin-command-center.ts", "utf8");
    expect(source).not.toMatch(/client\.[a-zA-Z0-9_]+\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/);
    expect(source).not.toMatch(/fetch\s*\(|openai|anthropic|generateText|prisma\/migrations/i);
    expect(source).toContain("getTechnicalOperationsDashboard");
    expect(source).toMatch(/(?:take:\s*COMMAND_CENTER_ACTIVITY_LIMIT|slice\(0,\s*COMMAND_CENTER_ACTIVITY_LIMIT)/);
  });

  it("uses the shared shell and responsive/accessibility affordances", () => {
    const page = readFileSync("app/super-admin/command-center/page.tsx", "utf8");
    const loading = readFileSync("app/super-admin/command-center/loading.tsx", "utf8");
    expect(page).toContain("<PageShell");
    expect(page).toContain('aria-labelledby="command-today-title"');
    expect(page).toContain('role="status"');
    expect(page).not.toMatch(/alert\(|confirm\(|prompt\(/);
    expect(loading).toContain('aria-busy="true"');
  });
});
