import { FamilyCollectionWizard } from "@/components/family-collection-wizard";
import { PageHeader } from "@/components/ui";
import { hasUserPermission, requirePermission } from "@/lib/auth";
import { getSchoolSettings } from "@/lib/school-settings";
import { prisma } from "@/lib/prisma";

export default async function NewFamilyCollectionPage({ searchParams }: { searchParams: Promise<{ corrects?: string; version?: string }> }) {
  const user = await requirePermission("CREATE_FAMILY_COLLECTIONS");
  const sp = await searchParams;
  const correction = sp.corrects && /^FAM-\d{8}-[A-Z0-9]{10}$/.test(sp.corrects) && /^\d+$/.test(sp.version ?? "")
    ? { reference: sp.corrects, version: Number(sp.version) }
    : undefined;
  if (correction && !(await hasUserPermission(user, "CORRECT_FINAL_RECEIPT"))) await requirePermission("CORRECT_FINAL_RECEIPT");
  const settings = await getSchoolSettings(prisma);
  return <div className="page family-collection-page"><PageHeader title={correction ? "Correct Family Collection" : "Family Collection"} description={correction ? `Create one reviewed replacement for ${correction.reference}; the original will be compensated and preserved atomically.` : "One atomic mixed-tender collection for one or more eligible Students, with exact paise allocation and one consolidated receipt."} /><FamilyCollectionWizard academicYear={settings.academicYear} correction={correction} /></div>;
}
