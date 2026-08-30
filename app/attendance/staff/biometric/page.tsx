import { notFound } from "next/navigation";
import { BiometricAttendanceWorkspace } from "@/components/biometric-attendance-workspace";
import { PageHeader } from "@/components/ui";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { isBiometricAttendanceEnabled } from "@/lib/biometric-attendance/feature-flag";
import { loadBiometricWorkspace } from "@/lib/biometric-attendance/governance";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function BiometricStaffAttendancePage() {
  if (!isBiometricAttendanceEnabled()) notFound();
  await requirePermission("VIEW_BIOMETRIC_ATTENDANCE");
  const permissions = await getCurrentUserEffectivePermissions(), data = await loadBiometricWorkspace();
  const capabilities = { devices: permissionSetCan(permissions,"MANAGE_BIOMETRIC_DEVICES"), prepareMapping: permissionSetCan(permissions,"MANAGE_BIOMETRIC_STAFF_MAPPINGS"), approveMapping: permissionSetCan(permissions,"APPROVE_BIOMETRIC_STAFF_MAPPINGS"), reconcile: permissionSetCan(permissions,"RECONCILE_BIOMETRIC_ATTENDANCE"), approveAttendance: permissionSetCan(permissions,"APPROVE_BIOMETRIC_ATTENDANCE"), exportReports: permissionSetCan(permissions,"EXPORT_BIOMETRIC_ATTENDANCE_REPORTS") };
  return <div className="page"><PageHeader title="Biometric Staff Attendance" description="Provider-neutral bridge, immutable punches, governed Staff mapping and attendance reconciliation. Simulator software foundation only; K30 Pro certification remains BIOMETRIC-HARDWARE-CERTIFICATION-1B."/><BiometricAttendanceWorkspace initialData={JSON.parse(JSON.stringify(data))} capabilities={capabilities}/></div>;
}
