import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { AiAssistantChat } from "@/components/ai-assistant-ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAiAssistantFoundation } from "@/lib/ai-assistant-profiles";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function AiAssistantPage() {
  const user = await requirePermission("VIEW_AI_ASSISTANT");
  await ensureAiAssistantFoundation(prisma);
  const [profile, permissions] = await Promise.all([
    prisma.aiAssistantProfile.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } }),
    getCurrentUserEffectivePermissions()
  ]);
  const modes = [
    ...(permissionSetCan(permissions, "USE_AI_ASSISTANT_DOCUMENTATION") ? ["DOCUMENTATION"] : []),
    ...(permissionSetCan(permissions, "USE_AI_ASSISTANT_AGGREGATES") ? ["AGGREGATE_OPERATIONS"] : [])
  ];
  return <div className="page ai-assistant-page"><PageHeader title="Read-only AI Assistant" description="Authorised local documentation and aggregate operational retrieval with citations, uncertainty and privacy-safe auditing." action={permissionSetCan(permissions, "MANAGE_AI_ASSISTANT") ? <Link className="button secondary" href="/ai-assistant/settings">Settings</Link> : undefined} />
    {profile ? <AiAssistantChat modes={modes} providerLabel={`${profile.providerKind} · ${profile.status}`} /> : <p className="notice danger">No active assistant profile is available. The assistant remains safely unavailable.</p>}
  </div>;
}
