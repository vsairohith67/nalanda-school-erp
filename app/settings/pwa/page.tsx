import { PwaDiagnostics } from "@/components/pwa-diagnostics";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";

export default async function PwaSettingsPage() {
  await requirePermission("VIEW_SYSTEM_HEALTH");
  return (
    <PageShell className="pwa-page">
      <PageHeader
        title="PWA Diagnostics"
        description="Non-sensitive service-worker, installability, version, and static-cache status."
      />
      <PwaDiagnostics />
    </PageShell>
  );
}

