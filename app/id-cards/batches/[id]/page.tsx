import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { IdentityCardBatchActions } from "@/components/identity-card-forms";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { displayDate } from "@/lib/format";

export default async function IdentityCardBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_ID_CARDS"), id = (await params).id, permissions = await getCurrentUserEffectivePermissions();
  const batch = await prisma.identityCardBatch.findUnique({ where: { id }, include: { template: true, cards: { include: { student: { select: { studentName: true } }, staffMember: { select: { fullName: true } } }, orderBy: { cardNumber: "asc" } }, events: { orderBy: { eventDate: "desc" }, select: { eventType: true, eventDate: true, previousStatus: true, newStatus: true, reason: true, notes: true } } } });
  if (!batch) notFound();
  const preview = batch.scopeSnapshotJson ? JSON.parse(batch.scopeSnapshotJson) : [];
  return <div className="page identity-card-page"><PageHeader title={batch.batchNumber} description={`${batch.cardType} · ${batch.scopeType} · ${batch.academicYear ?? "all years"}`}/><div className="page-actions">{batch.cards.length ? <Link className="button secondary" href={`/id-cards/batches/${batch.id}/print`}>A4 Sheet & Cut Guides</Link> : null}<Link className="button secondary" href="/id-cards/batches">Back to Batches</Link></div>
    <div className="stats"><div className="card stat"><span>Status</span><strong>{batch.status}</strong></div><div className="card stat"><span>Eligible</span><strong>{batch.eligibleCount}</strong></div><div className="card stat"><span>Issued</span><strong>{batch.issuedCount}</strong></div><div className="card stat"><span>Skipped</span><strong>{batch.skippedCount}</strong></div></div>
    <IdentityCardBatchActions id={batch.id} status={batch.status} updatedAt={batch.updatedAt.toISOString()} permissions={[...permissions]}/>
    <section className="card card-pad"><h3>Approved Scope Preview</h3><p>Template: {batch.template.name}. Valid {displayDate(batch.validFrom)} to {displayDate(batch.validUntil)}. Preview and approval consume no numbers.</p><div className="table-wrap"><table><thead><tr><th>Name</th><th>School code</th><th>Class/designation</th><th>Eligibility</th></tr></thead><tbody>{preview.map((row: any, index: number) => <tr key={`${row.code}-${index}`}><td>{row.label}</td><td>{row.code ?? "Missing"}</td><td>{row.className ? `${row.className}${row.section ? `-${row.section}` : ""}` : row.designation}</td><td>{row.eligible ? "ELIGIBLE" : row.reason}</td></tr>)}{!preview.length ? <tr><td colSpan={4}>Run preview to capture the exact scope.</td></tr> : null}</tbody></table></div></section>
    <section className="card card-pad"><h3>Issued Cards</h3><div className="table-wrap"><table><thead><tr><th>Card number</th><th>Person</th><th>Status</th></tr></thead><tbody>{batch.cards.map((card) => <tr key={card.id}><td><Link href={`/id-cards/${card.id}`}>{card.cardNumber}</Link></td><td>{card.student?.studentName ?? card.staffMember?.fullName}</td><td><StatusBadge status={card.status}/></td></tr>)}{!batch.cards.length ? <tr><td colSpan={3}>No cards issued.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
