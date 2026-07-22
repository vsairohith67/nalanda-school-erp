import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { IdentityCardView } from "@/components/identity-card-view";
import { IdentityCardWorkflowActions } from "@/components/identity-card-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { effectiveIdentityCardStatus, safeIdentityCardPayload } from "@/lib/identity-cards";
import { getEffectivePermissions } from "@/lib/role-permissions";
import { renderCode39Svg } from "@/lib/library-barcode-svg";
import { displayDate } from "@/lib/format";

export default async function IdentityCardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_ID_CARDS"), id = (await params).id, permissions = await getEffectivePermissions(prisma, user.role);
  const card = await prisma.identityCard.findUnique({ where: { id }, include: { student: { select: { studentName: true, admissionNo: true, status: true } }, staffMember: { select: { fullName: true, staffCode: true, designation: true, status: true } }, template: { select: { name: true, templateCode: true, versionNumber: true, status: true } }, versions: { orderBy: { versionNumber: "desc" } }, events: { orderBy: { eventDate: "desc" }, select: { eventType: true, eventDate: true, previousStatus: true, newStatus: true, reason: true, notes: true } }, replacesCard: { select: { id: true, cardNumber: true, status: true } }, replacedByCard: { select: { id: true, cardNumber: true, status: true } } } });
  if (!card) notFound();
  const version = card.versions.find((row) => row.versionNumber === card.currentVersionNumber);
  const payload = safeIdentityCardPayload(card, version);
  const barcodeSvg = payload.cardNumber && payload.snapshot.barcodeEnabled ? renderCode39Svg(payload.cardNumber) : null;
  const person = card.student ? `${card.student.studentName} · ${card.student.admissionNo}` : `${card.staffMember?.fullName} · ${card.staffMember?.staffCode ?? "No staff code"}`;
  const sourceWarning = card.student
    ? (card.student.status.toUpperCase() !== "ACTIVE" ? `Student master status is now ${card.student.status}; this card was not automatically revoked.` : null)
    : card.staffMember && card.staffMember.status !== "ACTIVE"
      ? `Staff status is now ${card.staffMember.status}; this card was not automatically revoked.`
      : null;
  return <div className="page identity-card-detail"><PageHeader title={card.cardNumber ?? "ID Card Draft"} description={`${person} · ${card.cardType}`}/><div className="page-actions">{card.currentVersionNumber ? <Link className="button secondary" href={`/id-cards/${card.id}/print`}>CR80 Front / Back Print</Link> : null}<Link className="button secondary" href="/id-cards">Back to Cards</Link></div>
    {sourceWarning ? <div className="notice warning"><strong>Source status warning:</strong> {sourceWarning}</div> : null}
    <div className="two-column"><section className="card card-pad"><h3>Authoritative source</h3><p>{person}</p><p>Academic year: {card.academicYear ?? "All years"}</p><p>Valid: {displayDate(card.validFrom)} to {displayDate(card.validUntil)}</p><p>Template: {card.template.name} · {card.template.templateCode} v{card.template.versionNumber} · {card.template.status}</p><p>Photo: placeholder — no managed personal-photo source exists.</p><p>Stored status: <StatusBadge status={card.status}/> · effective status: <strong>{effectiveIdentityCardStatus(card)}</strong></p></section><IdentityCardView payload={{ ...payload, barcodeSvg }}/></div>
    <IdentityCardWorkflowActions id={card.id} status={card.status} updatedAt={card.updatedAt.toISOString()} permissions={[...permissions]}/>
    <section className="card card-pad"><h3>Immutable Version History</h3><div className="table-wrap"><table><thead><tr><th>Version</th><th>Type</th><th>Issued</th><th>Reason</th><th>Integrity hash</th><th>Print</th></tr></thead><tbody>{card.versions.map((row) => <tr key={row.id}><td>v{row.versionNumber}{row.versionNumber !== card.currentVersionNumber ? " · SUPERSEDED" : ""}</td><td>{row.versionType}</td><td>{displayDate(row.issuedAt)}</td><td>{row.correctionReason ?? "-"}</td><td><code>{row.snapshotHash?.slice(0, 16) ?? "-"}</code></td><td><Link href={`/id-cards/${card.id}/print?version=${row.versionNumber}`}>Print v{row.versionNumber}</Link></td></tr>)}{!card.versions.length ? <tr><td colSpan={6}>No issued version yet.</td></tr> : null}</tbody></table></div></section>
    <section className="card card-pad"><h3>Replacement History</h3><p>Replaces: {card.replacesCard ? <Link href={`/id-cards/${card.replacesCard.id}`}>{card.replacesCard.cardNumber}</Link> : "None"} · Replaced by: {card.replacedByCard ? <Link href={`/id-cards/${card.replacedByCard.id}`}>{card.replacedByCard.cardNumber}</Link> : "None"}</p></section>
    <section className="card card-pad"><h3>Append-only Events</h3><div className="table-wrap"><table><thead><tr><th>Date</th><th>Event</th><th>Transition</th><th>Reason / note</th></tr></thead><tbody>{card.events.map((event, index) => <tr key={`${event.eventType}-${index}`}><td>{displayDate(event.eventDate)}</td><td>{event.eventType}</td><td>{event.previousStatus ?? "-"} → {event.newStatus ?? "-"}</td><td>{event.reason ?? event.notes ?? "-"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
