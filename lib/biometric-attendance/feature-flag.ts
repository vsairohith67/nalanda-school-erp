import { NextResponse } from "next/server";
import { BIOMETRIC_STAFF_ATTENDANCE_FEATURE, operationalReleaseFeatureAvailability } from "@/lib/release-feature-flag-runtime";

export const BIOMETRIC_SCHEMA_VERSION = 1;

export function biometricAttendanceAvailability(environment: NodeJS.ProcessEnv = process.env) {
  return operationalReleaseFeatureAvailability(BIOMETRIC_STAFF_ATTENDANCE_FEATURE, { environment });
}

export function isBiometricAttendanceEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return biometricAttendanceAvailability(environment).enabled;
}

export function requireBiometricAttendanceForApi() {
  if (isBiometricAttendanceEnabled()) return null;
  return NextResponse.json(
    { error: "The requested capability is unavailable.", code: "BIOMETRIC_ATTENDANCE_UNAVAILABLE" },
    { status: 404, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
