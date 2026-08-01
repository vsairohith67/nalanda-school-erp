import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AccessHistoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("VIEW_IAM_AUDIT");
  const query = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const events = await prisma.userAudit.findMany({ where: { action: { startsWith: "IAM_" }, ...(query ? { actorName: { contains: query } } : {}) }, select: { action: true, actorName: true, detailsJson: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 500 });
  return <div className="page iam-page"><PageHeader title="Access History" description="Privacy-safe, append-only named-user, profile, override, lifecycle and context-switch evidence." /><form className="card filter-grid"><label>Search actor<input name="q" type="search" defaultValue={query} /></label><button>Apply filter</button></form><section className="card"><div className="table-wrap"><table><thead><tr><th>Action</th><th>Actor</th><th>When</th><th>Evidence</th></tr></thead><tbody>{events.map((event, index) => <tr key={`${event.createdAt.toISOString()}-${index}`}><td>{label(event.action)}</td><td>{event.actorName}</td><td>{event.createdAt.toLocaleString("en-IN")}</td><td>{safeSummary(event.detailsJson)}</td></tr>)}{!events.length ? <tr><td colSpan={4}>No IAM events match this filter.</td></tr> : null}</tbody></table></div></section></div>;
}
function safeSummary(value: string | null) { if (!value) return "Privacy-safe event"; try { const data = JSON.parse(value) as Record<string, unknown>; return Object.entries(data).filter(([key]) => !/id|token|hash|password|credential/i.test(key)).map(([key, item]) => `${label(key)}: ${String(item)}`).join(" · ") || "Privacy-safe event"; } catch { return "Privacy-safe event"; } }
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
