import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizePermission, permissionLabel } from "@/lib/permissions";

export default async function AccessHistoryPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("VIEW_IAM_AUDIT");
  const query = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const events = await prisma.userAudit.findMany({ where: { action: { startsWith: "IAM_" }, ...(query ? { actorName: { contains: query } } : {}) }, select: { action: true, actorName: true, detailsJson: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 500 });
  return <div className="page iam-page"><PageHeader title="Access History" description="Privacy-safe, append-only named-user, profile, override, lifecycle and context-switch evidence." /><form className="card filter-grid"><label>Search actor<input name="q" type="search" defaultValue={query} /></label><button>Apply filter</button></form><section className="card"><div className="table-wrap"><table><thead><tr><th>Action</th><th>Actor</th><th>When</th><th>Evidence</th></tr></thead><tbody>{events.map((event, index) => <tr key={`${event.createdAt.toISOString()}-${index}`}><td>{label(event.action)}</td><td>{event.actorName}</td><td>{event.createdAt.toLocaleString("en-IN")}</td><td>{safeSummary(event.detailsJson)}</td></tr>)}{!events.length ? <tr><td colSpan={4}>No IAM events match this filter.</td></tr> : null}</tbody></table></div></section></div>;
}
function safeSummary(value: string | null) { if (!value) return "Privacy-safe event"; try { const data = JSON.parse(value) as Record<string, unknown>; return Object.entries(data).filter(([key]) => !sensitiveAuditKey(key)).map(([key, item]) => `${label(key)}: ${auditValue(key, item)}`).join(" · ") || "Privacy-safe event"; } catch { return "Privacy-safe event"; } }
function label(value: string) { return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function auditValue(key: string, value: unknown): string {
  if (key === "permission" && typeof value === "string") {
    const permission = normalizePermission(value);
    return permission ? permissionLabel(permission) : "Governed permission";
  }
  if (Array.isArray(value)) return value.map((item) => auditValue(key, item)).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([nestedKey]) => !sensitiveAuditKey(nestedKey))
      .map(([nestedKey, nestedValue]) => `${label(nestedKey)}: ${auditValue(nestedKey, nestedValue)}`)
      .join(", ");
  }
  if (value === null || value === undefined || value === "") return "Not set";
  return typeof value === "string" && /^[A-Z][A-Z0-9_]+$/.test(value) ? label(value) : String(value);
}
function sensitiveAuditKey(key: string) { return /(?:^id$|id$|token|hash|password|credential|privateKey|publicKey|handle)/i.test(key); }
