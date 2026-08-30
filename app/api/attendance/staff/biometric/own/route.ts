import { requireApiPermission } from "@/lib/auth";
import { biometricApiError, biometricJson, parseBiometricApiJson } from "@/lib/biometric-attendance/api";
import { requireBiometricAttendanceForApi } from "@/lib/biometric-attendance/feature-flag";
import { loadOwnBiometricAttendance, requestBiometricCorrection } from "@/lib/biometric-attendance/reconciliation";

export async function GET(request: Request) {
  const unavailable = requireBiometricAttendanceForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("VIEW_OWN_STAFF_ATTENDANCE"); if (auth.response || !auth.user) return auth.response;
  try { const query = new URL(request.url).searchParams; return biometricJson(await loadOwnBiometricAttendance(auth.user.id, query.get("from"), query.get("to"))); } catch (error) { return biometricApiError(error); }
}

export async function POST(request: Request) {
  const unavailable = requireBiometricAttendanceForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("REQUEST_OWN_ATTENDANCE_CORRECTION"); if (auth.response || !auth.user) return auth.response;
  try { return biometricJson({ correction: await requestBiometricCorrection(await parseBiometricApiJson(request), auth.user.id, true) }, 201); } catch (error) { return biometricApiError(error); }
}
