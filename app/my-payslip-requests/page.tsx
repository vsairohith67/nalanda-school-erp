import { StaffPayslipRequestPortal } from "@/components/payslip-request-staff";
import { PageHeader } from "@/components/ui";
import { requireRolePermission } from "@/lib/auth";

export default async function Page() {
  await requireRolePermission("VIEW_OWN_PAYSLIP_REQUESTS", "TEACHER");
  return <div className="page payslip-request-page"><PageHeader title="My Payslip Requests" description="Request available record months, follow the private timeline, and retrieve password-protected issued documents."/><StaffPayslipRequestPortal/></div>;
}
