import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ensureSeedUsers } from "../lib/seed-users";

describe("permanent seed users", () => {
  it("creates missing users without overwriting an existing account", async () => {
    const existingPasswordHash = "existing-hash-must-stay";
    const rows = new Map<string, Record<string, unknown>>([
      ["director", { id: "director-id", username: "director", passwordHash: existingPasswordHash, name: "Custom Director" }]
    ]);
    const client = {
      user: {
        findUnique: async ({ where }: { where: { username: string } }) => rows.get(where.username) as { id: string } | undefined ?? null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          rows.set(String(data.username), { id: `${data.username}-id`, ...data });
          return data;
        }
      }
    };

    const result = await ensureSeedUsers(client, {
      NODE_ENV: "development",
      SEED_ADMIN_PASSWORD: "AdminPass@2026",
      SEED_ACCOUNTANT_PASSWORD: "AccountantPass@2026",
      SEED_VIEWER_PASSWORD: "ViewerPass@2026"
    }, () => undefined);

    expect(result.skipped).toContain("director");
    expect(result.created).toEqual(["admin", "accountant", "viewer"]);
    expect(rows.get("director")).toMatchObject({
      name: "Custom Director",
      passwordHash: existingPasswordHash
    });
  });

  it("fails before creating any user when a required password is missing", async () => {
    const create = vi.fn();
    const client = {
      user: {
        findUnique: async () => null,
        create
      }
    };
    await expect(ensureSeedUsers(client, {
      NODE_ENV: "development"
    }, () => undefined)).rejects.toThrow("SEED_DIRECTOR_PASSWORD is required");
    expect(create).not.toHaveBeenCalled();
  });

  it("uses documented temporary passwords only after explicit demo-seed opt-in", async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => data);
    const warnings: string[] = [];
    const result = await ensureSeedUsers({
      user: {
        findUnique: async () => null,
        create
      }
    }, {
      NODE_ENV: "development",
      NALANDA_DEMO_SEED_OPT_IN: "true",
      ALLOW_DEMO_BUSINESS_DATA: "true"
    }, (message) => warnings.push(message));
    expect(result.created).toEqual(["director", "admin", "accountant", "viewer"]);
    expect(create).toHaveBeenCalledTimes(4);
    expect(warnings).toHaveLength(4);
    expect(readFileSync("scripts/demo-seed.ts", "utf8")).toContain(
      'NALANDA_DEMO_SEED_OPT_IN: "true"'
    );
  });
});
