import { PageHeader } from "@/components/ui";
import { AdmissionsReports } from "@/components/admissions-reports";
import { requirePermission } from "@/lib/auth";

export default async function Page() {
  await requirePermission("VIEW_ADMISSION_REPORTS");
  return <div className="page admissions-page"><PageHeader title="Admissions Aggregate Reports" description="Suppressed class demand, source funnel, stage duration and conversion totals without Staff ranking." /><AdmissionsReports /></div>;
}
