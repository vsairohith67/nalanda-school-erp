import { notFound, redirect } from "next/navigation";
import { PublishedReportView } from "@/components/published-report-view";
import { requireRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveParentReportToken } from "@/lib/report-parent-delivery";
import { ReportPublicationError } from "@/lib/report-publication";

export default async function ParentIssuedReportPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await requireRolePermission("VIEW_OWN_REPORT_CARDS", "PARENT");
  const token = (await searchParams).token;
  const access = await resolveParentReportToken(prisma, token, user, "VIEW").catch((error) => {
    if (error instanceof ReportPublicationError && error.status === 403) redirect("/unauthorized");
    if (error instanceof ReportPublicationError) notFound();
    throw error;
  });
  return (
    <div className="page parent-issued-report-page">
      <div className="page-actions no-print">
        <a className="button secondary" href="/parent/results">Back to issued reports</a>
      </div>
      <PublishedReportView report={access.safeSnapshot} mode={access.mode} />
    </div>
  );
}
