import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function IdentityCardBatchesPage() {
  const user = await requirePermission("VIEW_ID_CARDS"), permissions = await getEffectivePermissions(prisma, user.role), rows = await prisma.identityCardBatch.findMany({ include: { template: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  return <div className="page identity-card-page"><PageHeader title="ID Card Batches" description="Preview exact eligible Student or Staff scope before approval; issue is all-or-none and idempotent." action={permissionSetCan(permissions, "MANAGE_ID_CARD_BATCHES") ? <Link className="button" href="/id-cards/batches/new">Create Batch</Link> : undefined}/><section className="card"><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Type/scope</th><th>Template</th><th>Status</th><th>Expected</th><th>Eligible</th><th>Issued / skipped</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link href={`/id-cards/batches/${row.id}`}>{row.batchNumber}</Link></td><td>{row.cardType} · {row.scopeType}</td><td>{row.template.name}</td><td><StatusBadge status={row.status}/></td><td>{row.expectedCount}</td><td>{row.eligibleCount}</td><td>{row.issuedCount} / {row.skippedCount}</td></tr>)}{!rows.length ? <tr><td colSpan={7}>No ID-card batches yet.</td></tr> : null}</tbody></table></div></section></div>;
}
