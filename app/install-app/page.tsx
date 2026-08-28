import { PwaInstallManager } from "@/components/pwa-install-manager";
import { PageHeader, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PRODUCT_BRAND } from "@/config/product-brand";

export default async function InstallAppPage() {
  await requireUser();
  return (
    <PageShell className="pwa-page">
      <PageHeader
        title={`Install ${PRODUCT_BRAND.nativeShortName}`}
        description="Add the same secure web ERP to a supported device without storing school records for offline use."
      />
      <PwaInstallManager />
    </PageShell>
  );
}
