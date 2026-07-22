import { PwaInstallManager } from "@/components/pwa-install-manager";
import { PageHeader, PageShell } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export default async function InstallAppPage() {
  await requireUser();
  return (
    <PageShell className="pwa-page">
      <PageHeader
        title="Install Nalanda ERP"
        description="Add the same secure web ERP to a supported device without storing school records for offline use."
      />
      <PwaInstallManager />
    </PageShell>
  );
}

