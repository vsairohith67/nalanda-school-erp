import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function FeeRegisterOcrImagePage({ params }: { params: Promise<{ id: string; pageId: string }> }) {
  await requirePermission("VIEW_FEE_REGISTER_OCR_IMAGES");
  const value = await params;
  const page = await prisma.feeRegisterOcrPage.findFirst({ where: { id: value.pageId, batchId: value.id }, include: { batch: true, rows: { orderBy: { rowNumber: "asc" } } } });
  if (!page) notFound();
  return <div className="page fee-register-ocr-page"><PageHeader title={`Private Register Page ${page.pageNumber}`} description={`${page.originalDisplayName} · hash ${page.sourceSha256.slice(0, 12)}… · ${page.width}×${page.height}`} action={<div className="page-actions"><Link className="button secondary" href={`/fee-register-ocr/${page.batchId}`}>Batch</Link><Link className="button secondary" href={`/fee-register-ocr/${page.batchId}/review`}>Review rows</Link></div>} />
    <p className="notice"><strong>No-store private image.</strong> This route requires the explicit image permission and is not a public/static URL or PWA asset.</p>
    <section className="card card-pad"><div className="ocr-image-meta"><StatusBadge status={page.status} /><span>Provider: {page.providerKind}</span><span>Confidence: {page.overallConfidence ?? "Not available"}</span><span>Rotation: {page.rotationDegrees}°</span></div>
      {["PURGED", "MISSING_SOURCE"].includes(page.status) ? <p className="notice warning">Source image is unavailable. Hash, MIME, size, rows, revisions and workflow history remain preserved.</p> : <div className="ocr-image-stage"><img src={`/api/fee-register-ocr/pages/${page.id}/image`} alt={`Private handwritten fee register page ${page.pageNumber}`} style={{ transform: `rotate(${page.rotationDegrees}deg)` }} />{page.rows.map((row) => { const box = safeBox(row.boundingBoxJson); return box ? <Link key={row.id} href={`/fee-register-ocr/${page.batchId}/review`} className="ocr-row-overlay" title={`Row ${row.rowNumber}: ${row.status}`} style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` }}><span>Row {row.rowNumber}</span></Link> : null; })}</div>}
    </section>
    <section className="card"><h2>Extracted row text</h2><div className="table-wrap"><table><thead><tr><th>Row</th><th>Status</th><th>Raw untrusted text</th><th>Duplicate</th></tr></thead><tbody>{page.rows.map((row) => <tr key={row.id}><td>{row.rowNumber}</td><td>{row.status}</td><td>{row.rawText}</td><td>{row.duplicateClassification}</td></tr>)}</tbody></table></div></section>
  </div>;
}
function safeBox(value: string | null) { try { return value ? JSON.parse(value) as { x: number; y: number; width: number; height: number } : null; } catch { return null; } }
