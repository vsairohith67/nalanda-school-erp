import { notFound } from "next/navigation";
import { OwnBiometricAttendance } from "@/components/biometric-attendance-workspace";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { isBiometricAttendanceEnabled } from "@/lib/biometric-attendance/feature-flag";
import { loadOwnBiometricAttendance } from "@/lib/biometric-attendance/reconciliation";

export default async function OwnStaffAttendancePage() {
  if (!isBiometricAttendanceEnabled()) notFound();
  const user = await requirePermission("VIEW_OWN_STAFF_ATTENDANCE"), data = await loadOwnBiometricAttendance(user.id);
  return <div className="page"><PageHeader title="My Staff Attendance" description="View only your linked attendance and request a governed correction without changing original punch evidence."/><OwnBiometricAttendance initialData={JSON.parse(JSON.stringify(data))}/></div>;
}
