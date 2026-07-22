import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { AiProfileActions } from "@/components/ai-assistant-ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAiAssistantFoundation } from "@/lib/ai-assistant-profiles";

export default async function AiAssistantSettingsPage() {
  await requirePermission("MANAGE_AI_ASSISTANT"); await ensureAiAssistantFoundation(prisma);
  const profiles = await prisma.aiAssistantProfile.findMany({ orderBy: { createdAt: "asc" } });
  return <div className="page ai-assistant-page"><PageHeader title="AI Assistant Settings" description="Non-secret provider status and bounded request controls. There are no credential or arbitrary URL fields." action={<div className="page-actions"><Link className="button secondary" href="/ai-assistant/sources">Sources</Link><Link className="button secondary" href="/ai-assistant/audit">Audit</Link><Link className="button secondary" href="/ai-assistant/evaluations">Evaluations</Link></div>} />
    <p className="notice warning">Only MOCK may be active. LOCAL_HTTP and CLOUD_API remain disabled; no live health or model call is authorised.</p>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Profile</th><th>Provider/status</th><th>Live use</th><th>Limits</th><th>Health</th><th>Actions</th></tr></thead><tbody>{profiles.map((row) => <tr key={row.id}><td>{row.name}<br /><small>{row.profileCode}</small></td><td><StatusBadge status={row.providerKind} /> <StatusBadge status={row.status} /></td><td>{row.liveUseEnabled ? "Enabled" : "Disabled"}</td><td>{row.maximumQuestionLength} chars<br />{row.maximumContextCharacters} context<br />{row.maximumToolCalls} tools · {row.requestTimeoutMs} ms</td><td>{row.lastHealthCheckStatus ?? "Not checked"}<br /><small>{row.lastHealthCheckMessage ?? "No credential-bearing health data stored."}</small></td><td><AiProfileActions id={row.id} code={row.profileCode} status={row.status} providerKind={row.providerKind} /></td></tr>)}</tbody></table></div></section>
  </div>;
}
