import { requireApiPermission } from "@/lib/auth";
import { BIOMETRIC_PRIVATE_HEADERS, biometricApiError } from "@/lib/biometric-attendance/api";
import { requireBiometricAttendanceForApi } from "@/lib/biometric-attendance/feature-flag";
import { biometricReportCsv, biometricReportRows } from "@/lib/biometric-attendance/reconciliation";

export async function GET(request: Request) {
  const unavailable = requireBiometricAttendanceForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("EXPORT_BIOMETRIC_ATTENDANCE_REPORTS"); if (auth.response) return auth.response;
  try {
    const query = new URL(request.url).searchParams, from = query.get("from"), to = query.get("to");
    const rows = await biometricReportRows(from, to);
    return new Response(biometricReportCsv(rows), { headers: { ...BIOMETRIC_PRIVATE_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="biometric-staff-attendance-${from}-to-${to}.csv"` } });
  } catch (error) { return biometricApiError(error); }
}
