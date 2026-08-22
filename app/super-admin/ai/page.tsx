import { unstable_noStore as noStore } from "next/cache";
import { LockKeyhole } from "lucide-react";
import { SmartAiWorkspace } from "@/components/smart-ai-workspace";
import { PageHeader, PageShell } from "@/components/ui";
import { requireRolePermission } from "@/lib/auth";
import { getSmartAiProviderStatus } from "@/lib/smart-ai-provider-local";

export const dynamic = "force-dynamic";

export default async function SmartAiPage() {
  noStore();
  await requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  const provider = getSmartAiProviderStatus();
  return (
    <PageShell className="smart-ai-page">
      <PageHeader
        title="Smart AI"
        description="A private, read-only Nalanda ERP assistant grounded exclusively in authorised Universal Search evidence."
        action={<span className="smart-ai-read-only"><LockKeyhole size={17} aria-hidden /> Read-only</span>}
      />
      <p className="smart-ai-boundary"><LockKeyhole size={16} aria-hidden /> Search remains deterministic retrieval. Smart AI only synthesizes the bounded Search results shown as sources.</p>
      <SmartAiWorkspace initialProvider={provider} />
    </PageShell>
  );
}
