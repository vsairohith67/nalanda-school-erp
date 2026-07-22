import { PageHeader, StatusBadge } from "@/components/ui";
import { AiSourceToggle } from "@/components/ai-assistant-ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAiAssistantFoundation } from "@/lib/ai-assistant-profiles";

export default async function AiAssistantSourcesPage() {
  await requirePermission("MANAGE_AI_ASSISTANT_SOURCES"); await ensureAiAssistantFoundation(prisma);
  const sources = await prisma.aiAssistantSourcePolicy.findMany({ orderBy: [{ sourceType: "asc" }, { displayName: "asc" }] });
  return <div className="page ai-assistant-page"><PageHeader title="AI Assistant Sources" description="Explicit registered documents and handwritten aggregate tools. No arbitrary path, table, field or SQL can be configured." />
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Source</th><th>Type</th><th>Roles/modes</th><th>Privacy/freshness</th><th>Status</th><th>Action</th></tr></thead><tbody>{sources.map((row) => <tr key={row.id}><td>{row.displayName}<br /><small>{row.sourceKey}</small><p>{row.description}</p></td><td>{row.sourceType.replaceAll("_", " ")}</td><td>{JSON.parse(row.allowedRolesJson).join(", ")}<br /><small>{JSON.parse(row.allowedModesJson).join(", ")}</small></td><td>Hard prohibited fields: {JSON.parse(row.prohibitedFieldKeysJson).length}<br />{row.minimumGroupSize ? `Minimum group ${row.minimumGroupSize}` : `Freshness warning ${row.freshnessWarningDays ?? "—"} days`}</td><td><StatusBadge status={row.enabled ? "ACTIVE" : "DISABLED"} /></td><td><AiSourceToggle id={row.id} enabled={row.enabled} name={row.displayName} /></td></tr>)}</tbody></table></div></section>
  </div>;
}
