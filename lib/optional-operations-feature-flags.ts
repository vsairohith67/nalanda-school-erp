import { evaluateReleaseFeatureFlag } from "@/lib/release-feature-flags";
import type { Role } from "@/lib/permissions";

export const TRANSPORT_V1_5 = {
  code: "TRANSPORT_V1_5",
  key: "transport-v1-5",
  environment: "PRODUCTION",
  expectedVersion: 1
} as const;

export const CAFETERIA_V1_5 = {
  code: "CAFETERIA_V1_5",
  key: "cafeteria-v1-5",
  environment: "PRODUCTION",
  expectedVersion: 1
} as const;

export type OptionalOperationsFeature = typeof TRANSPORT_V1_5 | typeof CAFETERIA_V1_5;
export type OptionalOperationsFeatureCode = OptionalOperationsFeature["code"];

function syntheticQaOverrideAllowed() {
  if (process.env.NODE_ENV === "production" || process.env.OPTIONAL_OPS_SYNTHETIC_QA !== "1") return false;
  if (process.env.NODE_ENV === "test") return true;
  return /(?:optional[-_ ]ops|synthetic)/i.test(process.env.DATABASE_URL ?? "");
}

export function optionalOperationsFeatureAvailability(feature: OptionalOperationsFeature, role: Role) {
  const governed = evaluateReleaseFeatureFlag({
    key: feature.key,
    environment: feature.environment,
    expectedVersion: feature.expectedVersion,
    role
  });
  if (
    !governed.enabled &&
    syntheticQaOverrideAllowed() &&
    process.env[feature.code] === "enabled"
  ) {
    return { enabled: true, reason: "SYNTHETIC_QA_OVERRIDE", version: feature.expectedVersion } as const;
  }
  return governed;
}

export function optionalOperationsFeatureEnabled(feature: OptionalOperationsFeature, role: Role) {
  return optionalOperationsFeatureAvailability(feature, role).enabled;
}

export function enabledOptionalOperationsFeatures(role: Role): OptionalOperationsFeatureCode[] {
  return [TRANSPORT_V1_5, CAFETERIA_V1_5]
    .filter((feature) => optionalOperationsFeatureEnabled(feature, role))
    .map((feature) => feature.code);
}

export const OPTIONAL_OPERATIONS_DEFAULT_OFF_NOTICE =
  "Software foundation only. This does not state that Nalanda operates Transport or Cafeteria services.";
