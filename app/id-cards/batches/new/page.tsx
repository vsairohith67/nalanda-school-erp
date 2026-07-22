import { PageHeader } from "@/components/ui";
import { IdentityCardBatchForm } from "@/components/identity-card-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function NewIdentityCardBatchPage() {
  await requirePermission("MANAGE_ID_CARD_BATCHES");
  const settings = await getSchoolSettings(prisma), templates = await prisma.identityCardTemplate.findMany({ where: { status: "ACTIVE", OR: [{ academicYear: settings.academicYear }, { academicYear: null }] }, orderBy: [{ cardType: "asc" }, { name: "asc" }] });
  return <div className="page identity-card-page"><PageHeader title="Create ID Card Batch" description="Choose an exact active Student or Staff scope. Preview creates no cards and consumes no numbers."/><IdentityCardBatchForm templates={templates} academicYear={settings.academicYear}/></div>;
}
