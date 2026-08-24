import { redirect } from "next/navigation";
import { EmployeePayrollSelfService } from "@/components/employee-payroll-self-service";
import { PageHeader } from "@/components/ui";
import { getCurrentUserEffectivePermissions, requireUser } from "@/lib/auth";
import { notFound } from "next/navigation";
import { PAYROLL_ESS_PILOT_FEATURE, isOperationalReleaseFeatureEnabled } from "@/lib/release-feature-flag-runtime";
export default async function Page(){await requireUser();const permissions=await getCurrentUserEffectivePermissions();if(!permissions.has("VIEW_OWN_PAYROLL"))redirect("/unauthorized");if(!isOperationalReleaseFeatureEnabled(PAYROLL_ESS_PILOT_FEATURE))notFound();return <div className="page payroll-page"><PageHeader title="My Payroll" description="Your linked Staff compensation summary, salary history, issued payslips, approved inputs and advance recovery schedule."/><EmployeePayrollSelfService/></div>;}
