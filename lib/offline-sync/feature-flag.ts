import { NextResponse } from "next/server";
import {
  operationalReleaseFeatureAvailability,
  type OperationalReleaseFeature
} from "@/lib/release-feature-flag-runtime";

export const OFFLINE_SYNC_FEATURE = {
  key: "offline-sync-1a",
  environment: "PRODUCTION",
  expectedVersion: 1,
  activationRole: "ACCOUNTANT"
} as const satisfies OperationalReleaseFeature;

export const OFFLINE_SYNC_SCHEMA_VERSION = 1;

export function offlineSyncAvailability(environment: NodeJS.ProcessEnv = process.env) {
  return operationalReleaseFeatureAvailability(OFFLINE_SYNC_FEATURE, { environment });
}

export function isOfflineSyncEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return offlineSyncAvailability(environment).enabled;
}

export function requireOfflineSyncForApi() {
  if (isOfflineSyncEnabled()) return null;
  return NextResponse.json(
    { error: "The requested capability is unavailable.", code: "OFFLINE_SYNC_UNAVAILABLE" },
    { status: 404, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }
  );
}

export function offlineSyncRoleAllowed(role: string) {
  return role === "ACCOUNTANT" || role === "SUPER_ADMIN";
}
