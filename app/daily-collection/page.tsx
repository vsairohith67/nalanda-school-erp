import { PageHeader } from "@/components/ui";
import { CollectionReport } from "@/components/collection-report";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function DailyCollectionPage() {
  const user = await requirePermission("VIEW_DAILY_COLLECTION");
  const [settings, permissions] = await Promise.all([
    getSchoolSettings(prisma),
    getCurrentUserEffectivePermissions()
  ]);
  return (
    <div className="page">
      <PageHeader title="Daily Collection" description="Cash, Director Sir GPay, NPS Current Account UPI, bank, cheque, other, receipt, class, and student breakups." />
      <CollectionReport
        generatedBy={user.name}
        canPrint={permissionSetCan(permissions, "PRINT_REPORTS")}
        canPrintReceipt={permissionSetCan(permissions, "PRINT_RECEIPTS")}
        settings={settings}
      />
    </div>
  );
}
