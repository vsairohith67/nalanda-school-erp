import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { permissionSetCan } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";
import { displayDate } from "@/lib/format";

export default async function FamilyCollectionsPage() {
  const user = await requirePermission("VIEW_FAMILY_COLLECTIONS");
  const permissions = await getCurrentUserEffectivePermissions();
  if (user.role === "VIEWER") {
    const rows = await (prisma.familyCollection as any).groupBy({ by: ["status"], _count: { _all: true }, _sum: { totalPaise: true }, orderBy: { status: "asc" } });
    return <div className="page"><PageHeader title="Family Collections — Aggregate" description="Suppressed collection totals only; no payer, Student, receipt or instrument details." /><div className="stats">{rows.map((row: any) => <div className="card stat" key={row.status}><span>{row.status.replaceAll("_", " ")}</span><strong>{row._count._all}</strong><small>{formatPaise(row._sum.totalPaise ?? 0)}</small></div>)}</div></div>;
  }
  const rows = await prisma.familyCollection.findMany({ select: { publicReference: true, collectionDate: true, status: true, totalPaise: true, payerType: true, payerDisplayName: true, _count: { select: { allocations: true, instruments: true } } }, orderBy: [{ collectionDate: "desc" }, { createdAt: "desc" }], take: 500 });
  return <div className="page family-collection-page"><PageHeader title="Family Collections" description="One collection reference, exact child allocations, and one posting per payment instrument." action={permissionSetCan(permissions, "CREATE_FAMILY_COLLECTIONS") ? <Link className="button" href="/family-collections/new">New family collection</Link> : undefined} /><section className="card"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Reference</th><th>Payer</th><th>Children / instruments</th><th>Total</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.publicReference}><td>{displayDate(row.collectionDate)}</td><td><Link href={`/family-collections/${encodeURIComponent(row.publicReference)}`}>{row.publicReference}</Link></td><td>{row.payerDisplayName}<small>{row.payerType}</small></td><td>{row._count.allocations} / {row._count.instruments}</td><td>{formatPaise(row.totalPaise)}</td><td><span className="badge">{row.status}</span></td></tr>)}{!rows.length ? <tr><td colSpan={6}>No family collections have been posted.</td></tr> : null}</tbody></table></div></section></div>;
}

function formatPaise(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value / 100); }
