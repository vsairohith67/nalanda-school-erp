import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DEMO_USERS_FLAG,
  DEMO_USER_DATABASE_ROOT,
  demoUserSeedDecision
} from "../lib/demo-user-seed-safety";
import {
  documentedSeedPasswordForAudit,
  ensureSeedUsers,
  SEED_USER_DEFINITIONS
} from "../lib/seed-users";

const WORKSPACE_ROOT = path.resolve(".");
let isolatedRoot = "";
let databasePath = "";

beforeEach(() => {
  isolatedRoot = path.join(WORKSPACE_ROOT, "tmp", "auth2a-tests", randomUUID());
  databasePath = path.join(isolatedRoot, "seed-users.db");
  mkdirSync(isolatedRoot, { recursive: true });
  writeFileSync(databasePath, "");
});

afterEach(() => {
  rmSync(isolatedRoot, { recursive: true, force: true });
});

function allowedEnvironment(extra: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV: "development",
    DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
    [DEMO_USERS_FLAG]: "true",
    [DEMO_USER_DATABASE_ROOT]: isolatedRoot,
    SEED_DIRECTOR_PASSWORD: "AUTH2A-Director-Unique-2026!",
    SEED_ADMIN_PASSWORD: "AUTH2A-Admin-Unique-2026!",
    SEED_ACCOUNTANT_PASSWORD: "AUTH2A-Accountant-Unique-2026!",
    SEED_VIEWER_PASSWORD: "AUTH2A-Viewer-Unique-2026!"
  };
  Object.assign(environment, extra);
  return environment;
}

function fakeClient(rows = new Map<string, Record<string, unknown>>()) {
  const aliases: Array<Record<string, unknown>> = [];
  return {
    rows,
    aliases,
    user: {
      findUnique: async ({ where }: { where: { username: string } }) =>
        rows.get(where.username) as { id: string; isActive?: boolean; role?: string } | undefined ?? null,
      createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        for (const row of data) {
          rows.set(String(row.username), { id: `${row.username}-id`, ...row });
        }
        return { count: data.length };
      }),
      findMany: async ({ where }: { where: { username: { in: string[] } } }) =>
        where.username.in.map((username) => rows.get(username)).filter(Boolean).map((row) => ({ id: String(row!.id), username: String(row!.username) }))
    },
    authLoginAlias: { createMany: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => { aliases.push(...data); return { count: data.length }; }) }
  };
}

describe("fail-closed demo user creation", () => {
  it("does nothing without the dedicated explicit flag", async () => {
    const client = fakeClient();
    const result = await ensureSeedUsers(client as never, {
      NODE_ENV: "development",
      DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`
    }, WORKSPACE_ROOT);
    expect(result).toMatchObject({ enabled: false, createdRoles: [] });
    expect(client.user.createMany).not.toHaveBeenCalled();
  });

  it("creates all four users only in an ignored isolated test database", async () => {
    const client = fakeClient();
    const result = await ensureSeedUsers(client as never, allowedEnvironment(), WORKSPACE_ROOT);
    expect(result.enabled).toBe(true);
    expect(result.createdRoles).toEqual(["DIRECTOR", "ADMIN", "ACCOUNTANT", "VIEWER"]);
    expect(client.user.createMany).toHaveBeenCalledTimes(1);
    expect(client.aliases).toHaveLength(4);
    expect(() => execFileSync("git", ["check-ignore", databasePath], {
      cwd: WORKSPACE_ROOT,
      encoding: "utf8"
    })).not.toThrow();
  });

  it("preserves existing and disabled seed accounts without reactivation", async () => {
    const rows = new Map(SEED_USER_DEFINITIONS.map((definition, index) => [
      definition.username,
      {
        id: `${definition.role}-id`,
        username: definition.username,
        role: definition.role,
        isActive: index !== 1,
        passwordHash: "existing-hash-must-stay"
      }
    ]));
    const client = fakeClient(rows);
    const before = JSON.stringify([...rows.entries()]);
    const result = await ensureSeedUsers(client as never, allowedEnvironment(), WORKSPACE_ROOT);
    expect(result.createdRoles).toEqual([]);
    expect(result.disabledPreservedRoles).toEqual(["ADMIN"]);
    expect(JSON.stringify([...rows.entries()])).toBe(before);
    expect(client.user.createMany).not.toHaveBeenCalled();
  });

  it("refuses to recreate one deleted retained role from a partial set", async () => {
    const rows = new Map(SEED_USER_DEFINITIONS.slice(0, 3).map((definition) => [
      definition.username,
      { id: `${definition.role}-id`, role: definition.role, isActive: true }
    ]));
    const client = fakeClient(rows);
    await expect(ensureSeedUsers(client as never, allowedEnvironment(), WORKSPACE_ROOT))
      .rejects.toThrow("DEMO_USERS_PARTIAL_RETAINED_SET_REFUSED");
    expect(client.user.createMany).not.toHaveBeenCalled();
  });

  it("requires four supplied unique passwords and never falls back to documented values", async () => {
    const missing = allowedEnvironment();
    missing.SEED_VIEWER_PASSWORD = undefined;
    await expect(ensureSeedUsers(fakeClient() as never, missing, WORKSPACE_ROOT))
      .rejects.toThrow("DEMO_USER_PASSWORDS_REQUIRED");

    const documented = allowedEnvironment({
      SEED_DIRECTOR_PASSWORD: documentedSeedPasswordForAudit(SEED_USER_DEFINITIONS[0])
    });
    await expect(ensureSeedUsers(fakeClient() as never, documented, WORKSPACE_ROOT))
      .rejects.toThrow("DOCUMENTED_SEED_PASSWORD_REFUSED");
  });

  it("is repeatable without changing an existing complete seed set", async () => {
    const client = fakeClient();
    await ensureSeedUsers(client as never, allowedEnvironment(), WORKSPACE_ROOT);
    const before = JSON.stringify([...client.rows.entries()]);
    const second = await ensureSeedUsers(client as never, allowedEnvironment(), WORKSPACE_ROOT);
    expect(second.createdRoles).toEqual([]);
    expect(JSON.stringify([...client.rows.entries()])).toBe(before);
  });
});

describe("demo user path and release isolation", () => {
  it("refuses the operational database path", () => {
    expect(() => demoUserSeedDecision(allowedEnvironment({
      DATABASE_URL: "file:./dev.db"
    }), WORKSPACE_ROOT)).toThrow("DEMO_USERS_REFUSED_OPERATIONAL_DATABASE");
  });

  it.each<Partial<NodeJS.ProcessEnv>>([
    { NODE_ENV: "production" },
    { NALANDA_ENVIRONMENT: "staging" },
    { NALANDA_ENVIRONMENT: "production" }
  ])("refuses production and staging environments", (extra) => {
    expect(() => demoUserSeedDecision(allowedEnvironment(extra), WORKSPACE_ROOT))
      .toThrow("DEMO_USERS_FORBIDDEN_IN_RELEASE_ENVIRONMENT");
  });

  it("refuses an isolated root outside the ignored test tree", () => {
    const outside = path.join(WORKSPACE_ROOT, "prisma");
    expect(() => demoUserSeedDecision(allowedEnvironment({
      [DEMO_USER_DATABASE_ROOT]: outside
    }), WORKSPACE_ROOT)).toThrow("DEMO_USER_DATABASE_ROOT_MUST_BE_IGNORED_TEST_PATH");
  });

  it("keeps ordinary startup scripts free of seed-user creation", async () => {
    const packageJson = await import("../package.json");
    const scripts = packageJson.default.scripts as Record<string, string>;
    for (const scriptName of ["dev", "build"]) {
      expect(String(scripts[scriptName])).not.toMatch(/seed|ensureSeedUsers/i);
    }
  });
});
