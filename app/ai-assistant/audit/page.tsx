import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unexpiredAiAuditWhere } from "@/lib/ai-assistant-audit";

export default async function AiAssistantAuditPage() {
  await requirePermission("VIEW_AI_ASSISTANT_AUDIT");
  const where = unexpiredAiAuditWhere();
  const [audits, grouped] = await Promise.all([
    prisma.aiAssistantQueryAudit.findMany({ where, take: 100, orderBy: { createdAt: "desc" } }),
    prisma.aiAssistantQueryAudit.groupBy({ where, by: ["safetyDecision"], _count: true })
  ]);
  const count = (decision: string) => grouped.find((row) => row.safetyDecision === decision)?._count ?? 0;
  return <div className="page ai-assistant-page"><PageHeader title="AI Assistant Privacy-Safe Audit" description="Hashes, retrieval metadata, citations, latency and safety outcomes only. Full questions, answers and context are not stored." />
    <div className="grid four"><StatCard label="Allowed" value={String(count("ALLOWED"))} /><StatCard label="Refused" value={String(count("REFUSED"))} /><StatCard label="Blocked" value={String(count("BLOCKED"))} /><StatCard label="Failed safely" value={String(count("FAILED"))} /></div>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Request / time</th><th>Mode/provider</th><th>Decision</th><th>Retrieval</th><th>Hashes only</th><th>Latency</th></tr></thead><tbody>{audits.map((row) => <tr key={row.id}><td>{row.requestId}<br /><small>{row.createdAt.toLocaleString("en-IN")}</small></td><td>{row.mode}<br />{row.providerKind}</td><td><StatusBadge status={row.safetyDecision} /><br /><small>{row.refusalReasonCode ?? "—"}</small></td><td>{row.toolCallCount} tools · {row.sourceCount} sources · {row.citationCount} citations<br />{row.retrievedCharacterCount} chars · {row.redactionCount} redactions</td><td>Question {row.questionHash.slice(0, 12)}…<br />Answer {row.answerHash ? `${row.answerHash.slice(0, 12)}…` : "not stored"}</td><td>{row.latencyMs} ms</td></tr>)}{!audits.length ? <tr><td colSpan={6}>No assistant query metadata has been recorded.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
