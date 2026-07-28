import {
  linkSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  demoBusinessSeedDecision,
  requireDemoBusinessSeed
} from "../lib/demo-business-seed-safety";

const roots: string[] = [];

function fixture() {
  const parent = mkdtempSync(path.join(os.tmpdir(), "nalanda-demo-seed-safety-"));
  roots.push(parent);
  const workspace = path.join(parent, "workspace");
  const prismaRoot = path.join(workspace, "prisma");
  const isolatedRoot = path.join(parent, "isolated-copy");
  mkdirSync(prismaRoot, { recursive: true });
  mkdirSync(isolatedRoot, { recursive: true });
  const operational = path.join(prismaRoot, "dev.db");
  const isolated = path.join(isolatedRoot, "copy.db");
  writeFileSync(operational, "operational-fixture");
  writeFileSync(isolated, "isolated-fixture");
  return { workspace, prismaRoot, isolatedRoot, operational, isolated };
}

function allowedEnvironment(isolatedRoot: string, isolated: string): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "development",
    ALLOW_DEMO_BUSINESS_DATA: "true",
    DEMO_BUSINESS_DATA_ROOT: isolatedRoot,
    DATABASE_URL: `file:${isolated.replaceAll("\\", "/")}`
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("demo business seed safety", () => {
  it("skips business fixtures unless the exact opt-in is present", () => {
    expect(demoBusinessSeedDecision({ NODE_ENV: "development" })).toEqual({ enabled: false });
    expect(() => requireDemoBusinessSeed({ NODE_ENV: "development" })).toThrow(
      "DEMO_BUSINESS_DATA_EXPLICIT_OPT_IN_REQUIRED"
    );
  });

  it("allows only an existing database inside an absolute isolated root", () => {
    const data = fixture();
    expect(demoBusinessSeedDecision(
      allowedEnvironment(data.isolatedRoot, data.isolated),
      data.workspace
    )).toEqual({
      enabled: true,
      databasePath: data.isolated,
      isolatedRoot: data.isolatedRoot
    });
  });

  it("refuses the operational database by resolved path", () => {
    const data = fixture();
    const environment = allowedEnvironment(data.isolatedRoot, data.operational);
    expect(() => requireDemoBusinessSeed(environment, data.workspace)).toThrow(
      "DEMO_BUSINESS_DATABASE_OUTSIDE_ISOLATED_ROOT"
    );
  });

  it("refuses a hard link to the operational database by file identity", () => {
    const data = fixture();
    rmSync(data.isolated);
    linkSync(data.operational, data.isolated);
    expect(() => requireDemoBusinessSeed(
      allowedEnvironment(data.isolatedRoot, data.isolated),
      data.workspace
    )).toThrow("DEMO_BUSINESS_DATA_REFUSED_OPERATIONAL_DATABASE");
  });

  it("refuses roots that overlap operational storage or do not contain the target", () => {
    const data = fixture();
    expect(() => requireDemoBusinessSeed(
      allowedEnvironment(data.prismaRoot, data.operational),
      data.workspace
    )).toThrow("DEMO_BUSINESS_DATA_ROOT_OVERLAPS_OPERATIONAL_STORAGE");
    expect(() => requireDemoBusinessSeed({
      ...allowedEnvironment(data.isolatedRoot, data.isolated),
      DEMO_BUSINESS_DATA_ROOT: path.join(data.isolatedRoot, "missing")
    }, data.workspace)).toThrow("DEMO_BUSINESS_DATA_ROOT_NOT_FOUND");
  });

  it("refuses production and staging even with the explicit opt-in", () => {
    const data = fixture();
    expect(() => requireDemoBusinessSeed({
      ...allowedEnvironment(data.isolatedRoot, data.isolated),
      NODE_ENV: "production"
    }, data.workspace)).toThrow("DEMO_BUSINESS_DATA_FORBIDDEN_IN_RELEASE_ENVIRONMENT");
    expect(() => requireDemoBusinessSeed({
      ...allowedEnvironment(data.isolatedRoot, data.isolated),
      NALANDA_ENVIRONMENT: "staging"
    }, data.workspace)).toThrow("DEMO_BUSINESS_DATA_FORBIDDEN_IN_RELEASE_ENVIRONMENT");
  });

  it("keeps ordinary startup and production build scripts free of seed hooks", async () => {
    const packageJson = await import("../package.json");
    const scripts = packageJson.default.scripts as Record<string, string>;
    for (const name of ["dev", "build", "start"]) {
      if (!scripts[name]) continue;
      expect(scripts[name]).not.toMatch(/(?:db:seed|demo:seed|prisma\s+db\s+seed)/i);
    }
  });

  it("checks the business-data gate before any seed mutation", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(path.join(process.cwd(), "prisma", "seed.ts"), "utf8");
    const gate = source.indexOf("demoBusinessSeedDecision(process.env, process.cwd())");
    const firstMutation = source.indexOf("ensureSeedUsers(prisma)");
    const studentMutation = source.indexOf("prisma.student.upsert");
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(firstMutation);
    expect(source.indexOf("if (!demoBusinessSeed.enabled)")).toBeLessThan(studentMutation);
  });
});
