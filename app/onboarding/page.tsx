import { requirePermission, hasUserPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, PageShell } from "@/components/ui";
import { OnboardingCentre } from "@/components/onboarding-centre";
import { presentBatch } from "@/lib/onboarding";

export const dynamic = "force-dynamic";
export default async function OnboardingPage() {
  const user = await requirePermission("DOWNLOAD_ONBOARDING_TEMPLATE");
  const [upload, validate, resolve, approve, execute, audit, rollback] = await Promise.all([
    hasUserPermission(user, "UPLOAD_ONBOARDING_WORKBOOK"), hasUserPermission(user, "VALIDATE_ONBOARDING_BATCH"), hasUserPermission(user, "RESOLVE_ONBOARDING_CONFLICT"), hasUserPermission(user, "APPROVE_ONBOARDING_BATCH"), hasUserPermission(user, "EXECUTE_ONBOARDING_BATCH"), hasUserPermission(user, "VIEW_ONBOARDING_AUDIT"), hasUserPermission(user, "ROLLBACK_ONBOARDING_BATCH")
  ]);
  const batches = audit ? await prisma.onboardingBatch.findMany({ where: { purgedAt: null }, orderBy: { createdAt: "desc" }, take: 50 }) : [];
  return <PageShell className="onboarding-page"><PageHeader title="Bulk Onboarding Centre" description="Private, preview-first Student, Guardian, enrollment and Staff onboarding. Upload never changes business data; execution requires a current plan, separate approval and re-authentication." /><OnboardingCentre initialBatches={batches.map((r) => presentBatch(r)) as any} role={user.role} permissions={{ upload, validate, resolve, approve, execute, audit, rollback }} /></PageShell>;
}
