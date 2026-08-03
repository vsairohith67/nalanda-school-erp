import { redirect } from "next/navigation";
import { AcademicReportingWorkspace } from "@/components/academic-reporting-workspace";
import { PageHeader } from "@/components/ui";
import { getCurrentAuthContext, hasUserPermission, requireUser } from "@/lib/auth";
import { listAcademicReportFilterOptions } from "@/lib/academic-reporting-sources";
import { prisma } from "@/lib/prisma";

export async function AcademicReportingPage({ allowedRoles }: { allowedRoles: string[] }) {
  const user = await requireUser(), context = await getCurrentAuthContext();
  if (!context || context.user.id !== user.id || !allowedRoles.includes(user.role)) redirect("/unauthorized");
  const permission = ["SUPER_ADMIN","DIRECTOR","PRINCIPAL","VIEWER"].includes(user.role) ? "VIEW_REPORT_CARD_REPORTS" : user.role === "TEACHER" ? "VIEW_OWN_EXAM_MARKS" : "VIEW_OWN_REPORT_CARDS";
  if (!await hasUserPermission(user, permission)) redirect("/unauthorized");
  const options = await listAcademicReportFilterOptions(prisma, user, context.sessionId);
  const learner = user.role === "PARENT" || user.role === "STUDENT";
  return <div className="page academic-reporting-page"><PageHeader title={learner ? "Published Progress" : user.role === "TEACHER" ? "Assigned Academic Reports" : "Consolidated Academic Reporting"} description={learner ? "A simple historical trend using only your linked/self current issued report versions." : "Governed consolidated, comparative and Class IX/X evidence from locked result snapshots and issued report versions."}/><AcademicReportingWorkspace role={user.role} options={options}/></div>;
}
