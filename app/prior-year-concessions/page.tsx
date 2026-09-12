import { notFound } from "next/navigation";
import { getCurrentAuthContext, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorizePriorYear } from "@/lib/prior-year-concessions";
import { isOperationalReleaseFeatureEnabled, PRIOR_YEAR_CONCESSIONS_FEATURE } from "@/lib/release-feature-flag-runtime";
import { PageHeader, PageShell } from "@/components/ui";
import { PriorYearConcessionsWorkspace } from "@/components/prior-year-concessions-workspace";

export default async function PriorYearConcessionsPage() {
  if (!isOperationalReleaseFeatureEnabled(PRIOR_YEAR_CONCESSIONS_FEATURE)) notFound();
  await requirePermission("VIEW_PRIOR_YEAR_CONCESSIONS");
  const context = await getCurrentAuthContext(); if (!context) notFound();
  await authorizePriorYear(prisma, { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId }, "VIEW_PRIOR_YEAR_CONCESSIONS");
  return <PageShell><PageHeader title="Previous-year outstanding" description="Verified previous-year liabilities, independent review and non-cash relief. Student item sales remain available separately." /><PriorYearConcessionsWorkspace /></PageShell>;
}
