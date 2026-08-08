import { redirect } from "next/navigation";
import { PayrollWorkspace } from "@/components/payroll-workspace";
import { PageHeader } from "@/components/ui";
import { getCurrentUserEffectivePermissions, requireUser } from "@/lib/auth";
const capabilityNames = ["MANAGE_SALARY_STRUCTURES","ASSIGN_COMPENSATION","MANAGE_PAYROLL_INPUTS","CALCULATE_PAYROLL","SUBMIT_PAYROLL","APPROVE_PAYROLL","LOCK_PAYROLL","ISSUE_PAYSLIPS","REVERSE_PAYROLL","MANAGE_SALARY_ADVANCES","APPROVE_SALARY_ADVANCES"] as const;
export default async function Page() { await requireUser(); const permissions=await getCurrentUserEffectivePermissions();if(!permissions.has("VIEW_PAYROLL"))redirect("/unauthorized");const capabilities=Object.fromEntries(capabilityNames.map(name=>[name,permissions.has(name)]));return <div className="page payroll-page"><PageHeader title="Payroll, Payslips and Salary History" description="Versioned compensation, deterministic payroll calculation, governed approvals, advances and private payslip issue—with no salary disbursement."/><PayrollWorkspace permissions={capabilities}/></div>; }
