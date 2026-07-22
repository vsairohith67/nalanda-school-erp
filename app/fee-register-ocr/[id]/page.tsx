import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { OcrBatchActions } from "@/components/fee-register-ocr-ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ocrBatchInclude } from "@/lib/fee-register-ocr";
import { getEffectivePermissions } from "@/lib/role-permissions";

export default async function FeeRegisterOcrBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_FEE_REGISTER_OCR");
  const [batch, permissions] = await Promise.all([prisma.feeRegisterOcrBatch.findUnique({ where: { id: (await params).id }, include: ocrBatchInclude }), getEffectivePermissions(prisma, user.role)]);
  if (!batch) notFound();
  return <div className="page fee-register-ocr-page"><PageHeader title={batch.batchNumber} description={`${batch.registerName} · ${batch.academicYear} · private ${batch.profile.providerKind} staging`} action={<div className="page-actions"><Link className="button secondary" href="/fee-register-ocr">All batches</Link>{permissions.has("EXPORT_FEE_REGISTER_OCR_REPORTS") ? <Link className="button secondary" href={`/api/fee-register-ocr/reports/export?batchId=${encodeURIComponent(batch.id)}`}>Reviewed CSV</Link> : null}</div>} />
    <p className="notice warning">OCR output is untrusted draft evidence. Handwritten references remain separate from ERP receipt numbers. Payment posting is {batch.profile.paymentPostingEnabled ? "enabled by profile" : "disabled"}.</p>
    <div className="stats-grid"><article className="stat-card"><span>Status</span><strong><StatusBadge status={batch.status} /></strong></article><article className="stat-card"><span>Review version</span><strong>{batch.reviewVersion}</strong><small>{batch.approvedReviewVersion ? `Approved v${batch.approvedReviewVersion}` : "Not approved"}</small></article><article className="stat-card"><span>Pages / rows</span><strong>{batch.sourcePageCount} / {batch.extractedRowCount}</strong></article><article className="stat-card"><span>Verified / duplicate / rejected</span><strong>{batch.verifiedRowCount} / {batch.duplicateRowCount} / {batch.rejectedRowCount}</strong></article><article className="stat-card"><span>Verified amount</span><strong>₹{(batch.totalVerifiedAmountMinor / 100).toFixed(2)}</strong></article><article className="stat-card"><span>Posted amount</span><strong>₹{(batch.totalPostedAmountMinor / 100).toFixed(2)}</strong></article></div>
    <OcrBatchActions batch={batch} permissions={[...permissions]} />
    <section className="card"><h2>Immutable workflow events</h2><div className="table-wrap"><table><thead><tr><th>Time</th><th>Event</th><th>Safe reason</th></tr></thead><tbody>{batch.events.map((event) => <tr key={event.id}><td>{event.createdAt.toLocaleString("en-IN")}</td><td>{event.eventType}</td><td>{event.safeReason ?? "—"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
