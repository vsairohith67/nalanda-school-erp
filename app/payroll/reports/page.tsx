import { redirect } from "next/navigation";
import { PayrollReports } from "@/components/payroll-reports";
import { PageHeader } from "@/components/ui";
import { getCurrentUserEffectivePermissions, requireUser } from "@/lib/auth";
export default async function Page(){await requireUser();const permissions=await getCurrentUserEffectivePermissions();if(!permissions.has("VIEW_PAYROLL_REPORTS")&&!permissions.has("VIEW_PAYROLL_AGGREGATES"))redirect("/unauthorized");return <div className="page payroll-page"><PageHeader title="Governed Payroll Reports" description="Approved-run totals, component summaries, suppressed department aggregates, exceptions, recoveries and issued-payslip counts."/><PayrollReports canExport={permissions.has("EXPORT_PAYROLL_REPORTS")}/></div>;}
