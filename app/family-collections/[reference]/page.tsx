import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FamilyCollectionGovernanceActions } from "@/components/family-collection-governance-actions";
import { PageHeader } from "@/components/ui";
import { hasUserPermission, requireUser } from "@/lib/auth";
import { familyReceiptForUser } from "@/lib/family-collections";
import { displayDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function FamilyCollectionPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ child?: string }> }) {
  const user = await requireUser();
  const reference = decodeURIComponent((await params).reference);
  const allowed = user.role === "PARENT" ? await hasUserPermission(user, "VIEW_OWN_FAMILY_RECEIPTS") : await hasUserPermission(user, "VIEW_FAMILY_COLLECTIONS");
  if (!allowed) redirect("/unauthorized");
  let row: any;
  try { row = await familyReceiptForUser(prisma, reference, user, (await searchParams).child); } catch { notFound(); }
  const canReverse = user.role !== "PARENT" && await hasUserPermission(user, "CANCEL_FINAL_RECEIPT");
  const canCorrect = user.role !== "PARENT" && await hasUserPermission(user, "CORRECT_FINAL_RECEIPT");
  return <div className="page family-receipt-page"><PageHeader title={`Family Receipt ${row.publicReference}`} description="One official collection reference with exact child Ledger allocations and one posting per instrument." action={<Link className="button secondary" href={`/family-collections/${encodeURIComponent(reference)}/print${(await searchParams).child ? `?child=${encodeURIComponent((await searchParams).child!)}` : ""}`} target="_blank">Print / PDF view</Link>} /><section className="card card-pad"><div className="receipt-lifecycle-status"><span className="badge">{row.status}</span>{row.replacesReference ? <span>Replacement for {row.replacesReference}</span> : null}{row.replacedByReference ? <span>Superseded by {row.replacedByReference}</span> : null}</div><div className="detail-grid"><div><span>Date</span><strong>{displayDate(row.collectionDate)}</strong></div><div><span>Payer</span><strong>{row.payer?.displayName ?? "Authorised child extract"}</strong></div><div><span>Total</span><strong>{formatPaise(row.totalPaise)}</strong></div><div><span>Version</span><strong>{row.receipt?.issueReference}</strong></div></div></section><section className="card card-pad"><h2>Instrument summary</h2><div className="family-instrument-summary">{row.instruments.length ? row.instruments.map((instrument: any) => <div key={instrument.ordinal}><span>{instrument.mode} · {instrument.receivedAccount}</span><strong>{formatPaise(instrument.amountPaise)}</strong><small>{instrument.referenceMasked ?? "No external reference"} · {instrument.postingStatus}</small></div>) : <p>Instrument summary is suppressed for this child-specific extract.</p>}</div></section><section className="card card-pad"><h2>Child allocations</h2><div className="family-allocation-cards">{row.allocations.map((allocation: any, index: number) => <article className="family-allocation-card" key={`${allocation.admissionNo}-${allocation.installment}-${index}`}><div><strong>{allocation.studentName}</strong><span>{allocation.className}{allocation.section ? `-${allocation.section}` : ""} · {allocation.admissionNo}</span><span>{allocation.academicYear} · {allocation.installment} · {allocation.feeHead}</span></div><strong>{formatPaise(allocation.amountPaise)}</strong><small>Remaining for this due: {formatPaise(allocation.dueAfterPaise)}</small></article>)}</div></section>{user.role !== "PARENT" ? <FamilyCollectionGovernanceActions reference={row.publicReference} version={row.version} status={row.status} canReverse={canReverse} canCorrect={canCorrect} /> : null}<section className="card card-pad"><h2>Append-only events</h2><ol className="audit-timeline">{row.events.map((event: any, index: number) => <li key={`${event.type}-${index}`}><strong>{event.type.replaceAll("_", " ")}</strong><span>{event.previousStatus ?? "—"} → {event.newStatus ?? "—"}</span><small>{displayDate(event.createdAt)}{user.role === "PARENT" ? "" : ` · ${event.actorName}`}</small></li>)}</ol></section></div>;
}

function formatPaise(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(value / 100); }
