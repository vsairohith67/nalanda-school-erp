import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureFeeRegisterOcrFoundation } from "@/lib/fee-register-ocr";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function FeeRegisterOcrPage() {
  const user = await requirePermission("VIEW_FEE_REGISTER_OCR");
  await ensureFeeRegisterOcrFoundation(prisma);
  const [batches, permissions] = await Promise.all([
    prisma.feeRegisterOcrBatch.findMany({ include: { profile: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    getCurrentUserEffectivePermissions()
  ]);
  const totals = { pages: batches.reduce((sum, row) => sum + row.sourcePageCount, 0), rows: batches.reduce((sum, row) => sum + row.extractedRowCount, 0), verified: batches.reduce((sum, row) => sum + row.verifiedRowCount, 0), posted: batches.reduce((sum, row) => sum + row.postedRowCount, 0) };
  return <div className="page fee-register-ocr-page"><PageHeader title="Handwritten Fee Register OCR" description="Private OCR-assisted staging, human review and controlled zero-write financial preview. OCR confidence never equals approval." action={<div className="page-actions">{permissionSetCan(permissions, "UPLOAD_FEE_REGISTER_PAGES") ? <Link className="button" href="/fee-register-ocr/new">Create batch</Link> : null}{permissionSetCan(permissions, "VIEW_FEE_REGISTER_OCR_REPORTS") ? <Link className="button secondary" href="/fee-register-ocr/reports">Reports</Link> : null}{permissionSetCan(permissions, "MANAGE_FEE_REGISTER_OCR_PROFILES") ? <Link className="button secondary" href="/fee-register-ocr/settings">Settings</Link> : null}</div>} />
    <div className="notice warning ocr-limit-notice"><strong>Handwritten OCR can be inaccurate.</strong><span>A text-only local 7B model is not automatically an image-OCR system. Every financial field requires human verification against the source image. The ERP becomes authoritative only after controlled Payment posting succeeds.</span></div>
    <div className="stats-grid"><article className="stat-card"><span>Batches</span><strong>{batches.length}</strong></article><article className="stat-card"><span>Private pages</span><strong>{totals.pages}</strong></article><article className="stat-card"><span>Staged rows</span><strong>{totals.rows}</strong></article><article className="stat-card"><span>Verified / posted</span><strong>{totals.verified} / {totals.posted}</strong></article></div>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Register</th><th>Provider</th><th>Status/version</th><th>Pages/rows</th><th>Verified amount</th><th>Posting</th></tr></thead><tbody>{batches.map((row) => <tr key={row.id}><td><Link href={`/fee-register-ocr/${row.id}`}>{row.batchNumber}</Link><br /><small>{row.academicYear}</small></td><td>{row.registerName}</td><td><StatusBadge status={row.profile.providerKind} /></td><td><StatusBadge status={row.status} /><br /><small>review v{row.reviewVersion}{row.approvedReviewVersion ? ` · approved v${row.approvedReviewVersion}` : ""}</small></td><td>{row.sourcePageCount} / {row.extractedRowCount}</td><td>₹{(row.totalVerifiedAmountMinor / 100).toFixed(2)}</td><td>{row.profile.paymentPostingEnabled ? "Enabled" : "Disabled"}</td></tr>)}</tbody></table></div>{!batches.length ? <p className="empty-state">No OCR batches yet. Create a MOCK or MANUAL batch to begin private staging.</p> : null}</section>
  </div>;
}
