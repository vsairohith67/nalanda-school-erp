import { PayslipRequestManagement } from "@/components/payslip-request-management";
import { PageHeader } from "@/components/ui";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";

const capabilities = ["PREPARE_PAYSLIP_REQUEST", "UPLOAD_PAYSLIP_DOCUMENT", "ISSUE_PAYSLIP_DOCUMENT", "REPLACE_PAYSLIP_DOCUMENT", "VIEW_PAYSLIP_REQUEST_AUDIT", "MANAGE_PAYSLIP_MONTH_AVAILABILITY"] as const;

export default async function Page() {
  await requirePermission("VIEW_PAYSLIP_REQUESTS");
  const effective = await getCurrentUserEffectivePermissions();
  return <div className="page payslip-request-page"><PageHeader title="Staff Payslip Request Queue" description="Govern external preparation, protected PDF upload, review, final issue, correction and privacy-safe access audit."/><PayslipRequestManagement permissions={Object.fromEntries(capabilities.map((permission) => [permission, effective.has(permission)]))}/></div>;
}
