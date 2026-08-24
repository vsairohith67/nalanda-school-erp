import flagsJson from "@/config/release-feature-flags.json";
import type { ReleaseEnvironment } from "@/lib/release-operations-types";
import { sha256Bytes } from "@/lib/release-manifest";

export type ReleaseFeatureFlag = {
  key: string;
  description: string;
  environment: ReleaseEnvironment;
  defaultState: boolean;
  allowedRoles: string[];
  rolloutPercentage: number;
  startsAt: string | null;
  endsAt: string | null;
  owner: string;
  reason: string;
  version: number;
  history: Array<{ version: number; state: boolean; reason: string }>;
};

const KEY = /^[a-z][a-z0-9-]{2,63}$/;

export function parseReleaseFeatureFlags(source: unknown): ReleaseFeatureFlag[] {
  if (!Array.isArray(source)) throw new Error("RELEASE_FEATURE_FLAG_CONFIG_INVALID");
  const flags = structuredClone(source) as ReleaseFeatureFlag[];
  const keys = new Set<string>();
  for (const flag of flags) {
    if (!flag || typeof flag !== "object") throw new Error("RELEASE_FEATURE_FLAG_CONFIG_INVALID");
    if (!KEY.test(flag.key) || keys.has(flag.key)) throw new Error("RELEASE_FEATURE_FLAG_KEY_INVALID");
    keys.add(flag.key);
    if (!flag.description?.trim() || !flag.environment || !Array.isArray(flag.allowedRoles) || !flag.allowedRoles.length) throw new Error("RELEASE_FEATURE_FLAG_METADATA_INCOMPLETE");
    if (typeof flag.defaultState !== "boolean" || flag.allowedRoles.some((role) => typeof role !== "string" || !role.trim())) throw new Error("RELEASE_FEATURE_FLAG_CONFIG_INVALID");
    if (!Number.isInteger(flag.version) || flag.version < 1) throw new Error("RELEASE_FEATURE_FLAG_VERSION_INVALID");
    if (!Number.isInteger(flag.rolloutPercentage) || flag.rolloutPercentage < 0 || flag.rolloutPercentage > 100) throw new Error("RELEASE_FEATURE_FLAG_ROLLOUT_INVALID");
    if (!flag.owner?.trim() || !flag.reason?.trim() || !Array.isArray(flag.history) || !flag.history.length) throw new Error("RELEASE_FEATURE_FLAG_METADATA_INCOMPLETE");
    if (flag.history.some((entry) => !entry || !Number.isInteger(entry.version) || entry.version < 1 || typeof entry.state !== "boolean" || !entry.reason?.trim())) throw new Error("RELEASE_FEATURE_FLAG_HISTORY_INVALID");
    for (const timestamp of [flag.startsAt, flag.endsAt]) {
      if (timestamp !== null && (typeof timestamp !== "string" || !timestamp.trim() || Number.isNaN(new Date(timestamp).getTime()))) throw new Error("RELEASE_FEATURE_FLAG_DATE_INVALID");
    }
    if (flag.startsAt && flag.endsAt && new Date(flag.startsAt) >= new Date(flag.endsAt)) throw new Error("RELEASE_FEATURE_FLAG_DATE_RANGE_INVALID");
  }
  return flags;
}

export function releaseFeatureFlags(): ReleaseFeatureFlag[] {
  return parseReleaseFeatureFlags(flagsJson);
}

function cohortPercentage(seed: string) {
  return Number.parseInt(sha256Bytes(seed).slice(0, 8), 16) % 100;
}

export function evaluateReleaseFeatureFlag(input: {
  key: string;
  environment: ReleaseEnvironment;
  role: string;
  expectedVersion: number;
  cohortKey?: string;
  now?: Date;
  emergencyDisabled?: boolean;
}) {
  return evaluateReleaseFeatureFlagConfig(input, releaseFeatureFlags());
}

export function evaluateReleaseFeatureFlagConfig(input: {
  key: string;
  environment: ReleaseEnvironment;
  role: string;
  expectedVersion: number;
  cohortKey?: string;
  now?: Date;
  emergencyDisabled?: boolean;
}, flags: ReleaseFeatureFlag[]) {
  const flag = flags.find((row) => row.key === input.key);
  if (!flag) return { enabled: false, reason: "UNKNOWN_FLAG", version: null } as const;
  if (input.emergencyDisabled) return { enabled: false, reason: "EMERGENCY_DISABLED", version: flag.version } as const;
  if (flag.version !== input.expectedVersion) return { enabled: false, reason: "STALE_FLAG_VERSION", version: flag.version } as const;
  if (flag.environment !== input.environment) return { enabled: false, reason: "ENVIRONMENT_MISMATCH", version: flag.version } as const;
  if (!flag.allowedRoles.includes(input.role)) return { enabled: false, reason: "ROLE_NOT_ALLOWED", version: flag.version } as const;
  const now = input.now ?? new Date();
  if (flag.startsAt && now < new Date(flag.startsAt)) return { enabled: false, reason: "NOT_STARTED", version: flag.version } as const;
  if (flag.endsAt && now >= new Date(flag.endsAt)) return { enabled: false, reason: "EXPIRED", version: flag.version } as const;
  if (!flag.defaultState) return { enabled: false, reason: "DEFAULT_OFF", version: flag.version } as const;
  if (flag.rolloutPercentage <= 0) return { enabled: false, reason: "ROLLOUT_DISABLED", version: flag.version } as const;
  if (flag.rolloutPercentage < 100 && cohortPercentage(`${flag.key}:${input.cohortKey ?? "anonymous"}`) >= flag.rolloutPercentage) return { enabled: false, reason: "OUTSIDE_ROLLOUT", version: flag.version } as const;
  return { enabled: true, reason: "ENABLED", version: flag.version } as const;
}

export function releaseFeatureFlagSnapshotSha256() {
  return sha256Bytes(JSON.stringify(releaseFeatureFlags()));
}
