import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPublicEnquiry } from "@/lib/admissions";
import { executeOnboardingBatch } from "@/lib/onboarding";
import { createSalaryAdvance } from "@/lib/payroll";
import {
  PAYROLL_ESS_PILOT_FEATURE,
  PUBLIC_ADMISSIONS_FORM_FEATURE,
  REAL_DATA_IMPORTS_FEATURE,
  ReleaseFeatureUnavailableError,
  operationalReleaseFeatureAvailability,
  requireOperationalReleaseFeatureForApi
} from "@/lib/release-feature-flag-runtime";
import { evaluateReleaseFeatureFlagConfig, parseReleaseFeatureFlags, releaseFeatureFlags } from "@/lib/release-feature-flags";

const originalEnvironment = { ...process.env };
afterEach(() => { process.env = { ...originalEnvironment }; });

const syntheticQaEnvironment = {
  ...originalEnvironment,
  NODE_ENV: "test",
  DATABASE_URL: `file:${path.resolve("tmp/final-scope-qa/synthetic.db").replaceAll("\\", "/")}`,
  APP_ORIGIN: "http://127.0.0.1:3210",
  RELEASE_FEATURE_FLAGS_QA_MODE: "SYNTHETIC_COPY_ONLY",
  RELEASE_FEATURE_FLAGS_QA_ENABLED: "real-data-imports,public-admissions-form,payroll-ess-pilot"
} as NodeJS.ProcessEnv;

describe("release feature flag runtime enforcement", () => {
  it("fails closed for missing, malformed, false, zero-rollout and unknown configuration", () => {
    const flags = releaseFeatureFlags();
    const configured = flags.find((flag) => flag.key === REAL_DATA_IMPORTS_FEATURE.key)!;
    expect(operationalReleaseFeatureAvailability(REAL_DATA_IMPORTS_FEATURE, { config: [] })).toMatchObject({ enabled: false, reason: "MISSING_FLAG" });
    expect(operationalReleaseFeatureAvailability(REAL_DATA_IMPORTS_FEATURE, { config: { flags } })).toMatchObject({ enabled: false, reason: "MALFORMED_CONFIG" });
    expect(operationalReleaseFeatureAvailability(REAL_DATA_IMPORTS_FEATURE, { config: flags.map((flag) => flag.key === configured.key ? { ...flag, defaultState: "true" } : flag) })).toMatchObject({ enabled: false, reason: "MALFORMED_CONFIG" });
    expect(operationalReleaseFeatureAvailability(REAL_DATA_IMPORTS_FEATURE, { config: flags.map((flag) => flag.key === configured.key ? { ...flag, startsAt: "not-a-date", defaultState: true, rolloutPercentage: 100 } : flag) })).toMatchObject({ enabled: false, reason: "MALFORMED_CONFIG" });
    expect(operationalReleaseFeatureAvailability(REAL_DATA_IMPORTS_FEATURE)).toMatchObject({ enabled: false, reason: "DEFAULT_OFF" });
    const zeroRollout = flags.map((flag) => flag.key === configured.key ? { ...flag, defaultState: true, rolloutPercentage: 0 } : flag);
    expect(operationalReleaseFeatureAvailability(REAL_DATA_IMPORTS_FEATURE, { config: zeroRollout })).toMatchObject({ enabled: false, reason: "ROLLOUT_DISABLED" });
    expect(evaluateReleaseFeatureFlagConfig({ key: "unknown-release-flag", environment: "PRODUCTION", role: "SUPER_ADMIN", expectedVersion: 1 }, flags)).toMatchObject({ enabled: false, reason: "UNKNOWN_FLAG" });
    expect(operationalReleaseFeatureAvailability({ ...REAL_DATA_IMPORTS_FEATURE, key: "unknown-release-flag" })).toMatchObject({ enabled: false, reason: "MISSING_FLAG" });
    expect(() => parseReleaseFeatureFlags([...flags, configured])).toThrow(/KEY_INVALID/);
  });

  it("allows an enabled trusted config and the explicit copied/synthetic QA mode only", () => {
    const flags = releaseFeatureFlags();
    const trustedEnabled = flags.map((flag) => flag.key === REAL_DATA_IMPORTS_FEATURE.key ? { ...flag, defaultState: true, rolloutPercentage: 100 } : flag);
    expect(operationalReleaseFeatureAvailability(REAL_DATA_IMPORTS_FEATURE, { environment: { ...syntheticQaEnvironment, NODE_ENV: "production" }, config: trustedEnabled })).toMatchObject({ enabled: true, reason: "ENABLED" });
    for (const feature of [REAL_DATA_IMPORTS_FEATURE, PUBLIC_ADMISSIONS_FORM_FEATURE, PAYROLL_ESS_PILOT_FEATURE]) {
      expect(operationalReleaseFeatureAvailability(feature, { environment: syntheticQaEnvironment }), feature.key).toMatchObject({ enabled: true, reason: "SYNTHETIC_COPY_QA" });
    }
    const rejectedEnvironments: NodeJS.ProcessEnv[] = [
      { ...syntheticQaEnvironment, NODE_ENV: "production" },
      { ...syntheticQaEnvironment, DATABASE_URL: "file:C:/app/prisma/dev.db" },
      { ...syntheticQaEnvironment, DATABASE_URL: `file:${path.resolve("tmp/../prisma/dev.db").replaceAll("\\", "/")}` },
      { ...syntheticQaEnvironment, DATABASE_URL: `file:${path.resolve("tmp").replaceAll("\\", "/")}/..%2Fprisma%2Fdev.db` },
      { ...syntheticQaEnvironment, DATABASE_URL: "file:C:/unapproved/location/synthetic.db" },
      { ...syntheticQaEnvironment, DATABASE_URL: "postgresql://database.example/tmp/synthetic" },
      { ...syntheticQaEnvironment, APP_ORIGIN: "https://qa.example.test" },
      { ...syntheticQaEnvironment, RELEASE_FEATURE_FLAGS_QA_MODE: "true" },
      { ...syntheticQaEnvironment, RELEASE_FEATURE_FLAGS_QA_ENABLED: "real-data-imports,unknown" },
      { ...syntheticQaEnvironment, RELEASE_FEATURE_FLAGS_QA_ENABLED: "real-data-imports,real-data-imports" }
    ];
    for (const environment of rejectedEnvironments) expect(operationalReleaseFeatureAvailability(REAL_DATA_IMPORTS_FEATURE, { environment })).toMatchObject({ enabled: false });
  });

  it("ignores query, body, cookie and header-shaped client overrides", () => {
    const environment = {
      ...originalEnvironment,
      NODE_ENV: "test",
      DATABASE_URL: `file:${path.resolve("tmp/final-scope-qa/synthetic.db").replaceAll("\\", "/")}`,
      APP_ORIGIN: "http://127.0.0.1:3210",
      QUERY_FEATURE_FLAG: "real-data-imports=true",
      BODY_FEATURE_FLAG: "public-admissions-form=true",
      COOKIE_FEATURE_FLAG: "payroll-ess-pilot=true",
      HEADER_FEATURE_FLAG: "bulk-exports=true",
      X_RELEASE_FEATURE_FLAG: "real-data-imports"
    } as NodeJS.ProcessEnv;
    for (const feature of [REAL_DATA_IMPORTS_FEATURE, PUBLIC_ADMISSIONS_FORM_FEATURE, PAYROLL_ESS_PILOT_FEATURE]) {
      expect(operationalReleaseFeatureAvailability(feature, { environment }), feature.key).toMatchObject({ enabled: false, reason: "DEFAULT_OFF" });
    }
  });

  it("returns a stable privacy-safe API response without rollout or configuration details", async () => {
    const response = requireOperationalReleaseFeatureForApi(PUBLIC_ADMISSIONS_FORM_FEATURE);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(404);
    expect(response!.headers.get("cache-control")).toBe("private, no-store");
    const body = await response!.json();
    expect(body).toEqual({ error: "The requested capability is unavailable.", code: "RELEASE_FEATURE_UNAVAILABLE" });
    expect(JSON.stringify(body)).not.toMatch(/rollout|environment|config|path|percentage/i);
  });

  it("denies service-level writes before touching a database client while flags are off", async () => {
    const untouchedClient = new Proxy({}, { get() { throw new Error("DATABASE_CLIENT_TOUCHED"); } });
    await expect(createPublicEnquiry(untouchedClient as never, {} as never, "synthetic-request")).rejects.toBeInstanceOf(ReleaseFeatureUnavailableError);
    await expect(executeOnboardingBatch(untouchedClient as never, "synthetic-batch", {} as never, {} as never)).rejects.toBeInstanceOf(ReleaseFeatureUnavailableError);
    await expect(createSalaryAdvance(untouchedClient as never, {}, {} as never, "synthetic-staff-user")).rejects.toBeInstanceOf(ReleaseFeatureUnavailableError);
  });

  it("places API guards after safe import preview exits and before every durable path", () => {
    const governedPaths = ["app/api/import/students/route.ts", "app/api/import/staff/route.ts", "app/api/import/guardians/route.ts", "app/api/import/payments/route.ts", "app/api/library/import/[kind]/route.ts", "app/api/marks/import/route.ts"];
    const discovered = execFileSync("git", ["ls-files", "app/api/**/route.ts"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean).filter((path) => path.includes("/import/") && /export async function POST/.test(readFileSync(path, "utf8"))).sort();
    expect(discovered).toEqual([...governedPaths].sort());
    for (const path of governedPaths) {
      const source = readFileSync(path, "utf8");
      const previewExit = source.indexOf('body.action === "preview"');
      const guard = source.indexOf("requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE)");
      const transaction = source.indexOf("$transaction");
      expect(previewExit, path).toBeGreaterThan(-1);
      expect(guard, path).toBeGreaterThan(previewExit);
      if (transaction >= 0) expect(guard, path).toBeLessThan(transaction);
    }
    const executeRoute = readFileSync("app/api/onboarding/batches/[publicKey]/execute/route.ts", "utf8");
    expect(executeRoute.indexOf("requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE)")).toBeLessThan(executeRoute.lastIndexOf("executeOnboardingBatch"));
  });

  it("guards every public Admissions and Payroll ESS server surface without broadening internal CRM or Payroll", () => {
    const publicAdmissions = [
      "app/api/public/admissions/enquiries/route.ts",
      "app/api/public/admissions/application/route.ts",
      "app/api/public/admissions/application/documents/route.ts",
      "app/api/public/admissions/application/documents/[publicKey]/route.ts",
      "app/(public)/admissions/page.tsx",
      "app/(public)/admissions/apply/page.tsx"
    ];
    for (const file of publicAdmissions) expect(readFileSync(file, "utf8"), file).toContain("PUBLIC_ADMISSIONS_FORM_FEATURE");
    const payrollEss = [
      "app/api/my-payroll/route.ts",
      "app/api/my-payroll/payslips/[reference]/download/route.ts",
      "app/my-payroll/page.tsx"
    ];
    for (const file of payrollEss) expect(readFileSync(file, "utf8"), file).toContain("PAYROLL_ESS_PILOT_FEATURE");
    expect(readFileSync("app/api/admissions/reports/route.ts", "utf8")).not.toContain("PUBLIC_ADMISSIONS_FORM_FEATURE");
    expect(readFileSync("app/api/payroll/reports/route.ts", "utf8")).not.toContain("PAYROLL_ESS_PILOT_FEATURE");
    expect(readFileSync("app/api/my-payslip-requests/route.ts", "utf8")).not.toContain("PAYROLL_ESS_PILOT_FEATURE");
  });
});
