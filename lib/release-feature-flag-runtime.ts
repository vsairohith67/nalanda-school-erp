import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateReleaseFeatureFlagConfig, parseReleaseFeatureFlags, releaseFeatureFlags, type ReleaseFeatureFlag } from "@/lib/release-feature-flags";
import type { ReleaseEnvironment } from "@/lib/release-operations-types";

export const RELEASE_FEATURE_FLAG_QA_MODE = "SYNTHETIC_COPY_ONLY" as const;

export type OperationalReleaseFeature = {
  key: string;
  environment: ReleaseEnvironment;
  expectedVersion: number;
  activationRole: string;
};

export const REAL_DATA_IMPORTS_FEATURE = {
  key: "real-data-imports",
  environment: "PRODUCTION",
  expectedVersion: 1,
  activationRole: "SUPER_ADMIN"
} as const satisfies OperationalReleaseFeature;

export const PUBLIC_ADMISSIONS_FORM_FEATURE = {
  key: "public-admissions-form",
  environment: "PRODUCTION",
  expectedVersion: 1,
  activationRole: "SUPER_ADMIN"
} as const satisfies OperationalReleaseFeature;

export const PAYROLL_ESS_PILOT_FEATURE = {
  key: "payroll-ess-pilot",
  environment: "PRODUCTION",
  expectedVersion: 1,
  activationRole: "SUPER_ADMIN"
} as const satisfies OperationalReleaseFeature;

export const BULK_EXPORTS_FEATURE = {
  key: "bulk-exports",
  environment: "STAGING",
  expectedVersion: 1,
  activationRole: "SUPER_ADMIN"
} as const satisfies OperationalReleaseFeature;

export const BIOMETRIC_STAFF_ATTENDANCE_FEATURE = {
  key: "biometric-staff-attendance-1a",
  environment: "PRODUCTION",
  expectedVersion: 1,
  activationRole: "SUPER_ADMIN"
} as const satisfies OperationalReleaseFeature;

export class ReleaseFeatureUnavailableError extends Error {
  readonly status = 404;
  readonly code = "RELEASE_FEATURE_UNAVAILABLE";
  constructor() { super("This capability is unavailable."); }
}

function loopbackOrigin(value: string | undefined) {
  try {
    const host = new URL(value ?? "").hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function inside(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function isolatedQaDatabase(value: string | undefined) {
  try {
    const parsed = new URL(value ?? "");
    if (parsed.protocol !== "file:" || (parsed.hostname && parsed.hostname !== "localhost")) return false;
    const resolved = path.resolve(fileURLToPath(parsed));
    if (new RegExp(`(?:^|[\\\\/])prisma[\\\\/]dev\\.db$`, "i").test(resolved)) return false;
    const allowedRoots = [path.resolve(process.cwd(), "tmp"), path.resolve(process.cwd(), ".qa-artifacts"), path.resolve(os.tmpdir())];
    return allowedRoots.some((root) => inside(root, resolved));
  } catch {
    return false;
  }
}

export function isSyntheticReleaseFeatureQaMode(environment: NodeJS.ProcessEnv = process.env) {
  return environment.NODE_ENV !== "production"
    && environment.RELEASE_FEATURE_FLAGS_QA_MODE === RELEASE_FEATURE_FLAG_QA_MODE
    && isolatedQaDatabase(environment.DATABASE_URL)
    && loopbackOrigin(environment.APP_ORIGIN);
}

function qaEnabledKeys(environment: NodeJS.ProcessEnv, flags: ReleaseFeatureFlag[]) {
  const raw = String(environment.RELEASE_FEATURE_FLAGS_QA_ENABLED ?? "").trim();
  if (!raw) return new Set<string>();
  const keys = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (keys.length !== new Set(keys).size) return null;
  const known = new Set(flags.map((flag) => flag.key));
  if (keys.some((key) => !known.has(key))) return null;
  return new Set(keys);
}

export function operationalReleaseFeatureAvailability(
  feature: OperationalReleaseFeature,
  options: { environment?: NodeJS.ProcessEnv; config?: unknown } = {}
) {
  const environment = options.environment ?? process.env;
  let flags: ReleaseFeatureFlag[];
  try {
    flags = Object.prototype.hasOwnProperty.call(options, "config")
      ? parseReleaseFeatureFlags(options.config)
      : releaseFeatureFlags();
  } catch {
    return { enabled: false, reason: "MALFORMED_CONFIG", version: null } as const;
  }
  const flag = flags.find((entry) => entry.key === feature.key);
  if (!flag) return { enabled: false, reason: "MISSING_FLAG", version: null } as const;
  const governed = evaluateReleaseFeatureFlagConfig({
    key: feature.key,
    environment: feature.environment,
    role: feature.activationRole,
    expectedVersion: feature.expectedVersion
  }, flags);
  if (governed.enabled) return governed;
  if (!isSyntheticReleaseFeatureQaMode(environment)) return governed;
  const enabledKeys = qaEnabledKeys(environment, flags);
  if (!enabledKeys) return { enabled: false, reason: "MALFORMED_QA_OVERRIDE", version: flag.version } as const;
  if (!enabledKeys.has(feature.key)) return governed;
  if (flag.version !== feature.expectedVersion || flag.environment !== feature.environment || !flag.allowedRoles.includes(feature.activationRole)) return governed;
  return { enabled: true, reason: "SYNTHETIC_COPY_QA", version: flag.version } as const;
}

export function isOperationalReleaseFeatureEnabled(feature: OperationalReleaseFeature) {
  return operationalReleaseFeatureAvailability(feature).enabled;
}

export function assertOperationalReleaseFeature(feature: OperationalReleaseFeature) {
  if (!isOperationalReleaseFeatureEnabled(feature)) throw new ReleaseFeatureUnavailableError();
}

export function requireOperationalReleaseFeatureForApi(feature: OperationalReleaseFeature) {
  if (isOperationalReleaseFeatureEnabled(feature)) return null;
  return NextResponse.json(
    { error: "The requested capability is unavailable.", code: "RELEASE_FEATURE_UNAVAILABLE" },
    { status: 404, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
