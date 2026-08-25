import { NextResponse } from "next/server";
import { operationalReleaseFeatureAvailability, type OperationalReleaseFeature } from "@/lib/release-feature-flag-runtime";
import { isOfflineSyncEnabled } from "@/lib/offline-sync/feature-flag";

export const CROSS_PLATFORM_APPS_FEATURE = {
  key: "cross-platform-apps-1a",
  environment: "PRODUCTION",
  expectedVersion: 1,
  activationRole: "ACCOUNTANT"
} as const satisfies OperationalReleaseFeature;

export const NATIVE_APP_ID = "com.nalandaps.erp";
export const NATIVE_REDIRECT_URI = "nalandaps-erp://auth/callback";
export const NATIVE_AUTH_SCHEMA_VERSION = 1;

export function crossPlatformAppsAvailability(environment: NodeJS.ProcessEnv = process.env) {
  return operationalReleaseFeatureAvailability(CROSS_PLATFORM_APPS_FEATURE, { environment });
}

export function nativeAppEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return crossPlatformAppsAvailability(environment).enabled && isOfflineSyncEnabled(environment);
}

export function requireNativeAppForApi() {
  if (nativeAppEnabled()) return null;
  return NextResponse.json(
    { error: "The requested capability is unavailable.", code: "NATIVE_APP_UNAVAILABLE" },
    { status: 404, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
