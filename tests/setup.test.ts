import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  assertFirstRunBootstrapAuthorized,
  createFirstRunSetup,
  isFirstRunRequired,
  validateFirstRunSetup
} from "../lib/setup";

describe("first-run setup", () => {
  it("allows setup when no active Director exists", async () => {
    const createdUsers: Array<Record<string, unknown>> = [];
    const createdAliases: Array<Record<string, unknown>> = [];
    const savedSettings: Array<Record<string, unknown>> = [];
    const client = {
      user: {
        count: async () => 0,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createdUsers.push(data);
          return { id: "setup-user-1", ...data };
        }
      },
      authLoginAlias: { create: async ({ data }: { data: Record<string, unknown> }) => { createdAliases.push(data); return data; } },
      schoolSettings: {
        upsert: async (args: Record<string, unknown>) => {
          savedSettings.push(args);
          return args;
        }
      }
    };
    const input = validateFirstRunSetup({
      directorName: "Real Director",
      username: "director.real",
      email: "director@example.test",
      password: "StrongPass123",
      schoolName: "Nalanda Public School",
      academicYear: "2026-27",
      phone: "040-12345678",
      address: "School Road, Hyderabad",
      bootstrapToken: ""
    });

    expect(await isFirstRunRequired(client)).toBe(true);
    await createFirstRunSetup(client, input);
    expect(createdUsers[0]).toMatchObject({
      username: "director.real",
      role: "DIRECTOR",
      isActive: true
    });
    expect(String(createdUsers[0].passwordHash)).toMatch(/^scrypt\$/);
    expect(savedSettings).toHaveLength(1);
    expect(createdAliases[0]).toMatchObject({ type: "USERNAME", normalizedValue: "director.real", status: "VERIFIED" });
  });

  it("blocks setup after an active Director exists", async () => {
    const client = {
      user: {
        count: async () => 1,
        create: async () => {
          throw new Error("should not create");
        }
      },
      authLoginAlias: { create: async () => { throw new Error("should not create alias"); } },
      schoolSettings: {
        upsert: async () => {
          throw new Error("should not save");
        }
      }
    };

    expect(await isFirstRunRequired(client)).toBe(false);
    await expect(createFirstRunSetup(client, {
      directorName: "Director",
      username: "director",
      email: null,
      password: "StrongPass123",
      schoolName: "School",
      academicYear: "2026-27",
      phone: "12345678",
      address: "Address",
      bootstrapToken: null
    }, { NODE_ENV: "development" })).rejects.toThrow("Setup already completed");
  });

  it("blocks setup after an active Super Admin exists", async () => {
    const client = {
      user: {
        count: async (args: { where: { OR?: Array<{ role: string }> } }) =>
          args.where.OR?.some((item) => item.role === "SUPER_ADMIN") ? 1 : 0,
        create: async () => {
          throw new Error("should not create");
        }
      },
      authLoginAlias: { create: async () => { throw new Error("should not create alias"); } },
      schoolSettings: {
        upsert: async () => {
          throw new Error("should not save");
        }
      }
    };

    expect(await isFirstRunRequired(client)).toBe(false);
  });

  it("requires a password of at least eight characters", () => {
    expect(() => validateFirstRunSetup({
      directorName: "Director",
      username: "director",
      password: "short",
      schoolName: "School",
      academicYear: "2026-27",
      phone: "123",
      address: "Address"
    })).toThrow("at least 12 characters");
  });

  it("requires and constant-time checks a configured production bootstrap token", () => {
    const token = "production-bootstrap-token-with-at-least-32-characters";
    expect(() => assertFirstRunBootstrapAuthorized(null, {
      NODE_ENV: "production",
      FIRST_RUN_BOOTSTRAP_TOKEN: token
    })).toThrow("authorization failed");
    expect(() => assertFirstRunBootstrapAuthorized("wrong-token", {
      NODE_ENV: "production",
      FIRST_RUN_BOOTSTRAP_TOKEN: token
    })).toThrow("authorization failed");
    expect(() => assertFirstRunBootstrapAuthorized(token, {
      NODE_ENV: "production",
      FIRST_RUN_BOOTSTRAP_TOKEN: token
    })).not.toThrow();
    expect(() => assertFirstRunBootstrapAuthorized(null, {
      NODE_ENV: "development"
    })).not.toThrow();
  });

  it("fails production setup before any write when bootstrap proof is absent", async () => {
    const create = vi.fn();
    const upsert = vi.fn();
    const input = validateFirstRunSetup({
      directorName: "Director",
      username: "director",
      password: "StrongPass123",
      schoolName: "School",
      academicYear: "2026-27",
      phone: "123",
      address: "Address"
    });
    await expect(createFirstRunSetup({
      user: { count: async () => 0, create },
      authLoginAlias: { create: vi.fn() },
      schoolSettings: { upsert }
    }, input, {
      NODE_ENV: "production",
      FIRST_RUN_BOOTSTRAP_TOKEN: "configured-token-with-at-least-thirty-two-characters"
    })).rejects.toThrow("authorization failed");
    expect(create).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("wires the production token through the setup UI and 403 API boundary", () => {
    expect(readFileSync("app/setup/page.tsx", "utf8")).toContain(
      'bootstrapTokenRequired={process.env.NODE_ENV === "production"}'
    );
    expect(readFileSync("components/setup-form.tsx", "utf8")).toContain(
      'name="bootstrapToken"'
    );
    expect(readFileSync("app/api/setup/route.ts", "utf8")).toContain("? 403");
  });
});
