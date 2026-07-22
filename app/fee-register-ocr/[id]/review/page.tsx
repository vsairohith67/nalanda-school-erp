import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { OcrReviewWorkspace } from "@/components/fee-register-ocr-ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ocrBatchInclude } from "@/lib/fee-register-ocr";
import { hasRolePermission } from "@/lib/role-permissions";

export default async function FeeRegisterOcrReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("REVIEW_FEE_REGISTER_OCR_ROWS");
  const [batch, canResolve] = await Promise.all([prisma.feeRegisterOcrBatch.findUnique({ where: { id: (await params).id }, include: ocrBatchInclude }), hasRolePermission(prisma, user.role, "RESOLVE_FEE_REGISTER_OCR_DUPLICATES")]);
  if (!batch) notFound();
  return <div className="page fee-register-ocr-page"><PageHeader title="Human OCR Row Review" description={`${batch.batchNumber} · review version ${batch.reviewVersion}. Every correction creates a revision and invalidates stale approval.`} action={<Link className="button secondary" href={`/fee-register-ocr/${batch.id}`}>Batch summary</Link>} /><p className="notice warning">Confidence is informational only. Never auto-select a Student from fuzzy text; duplicate names require manual selection.</p><OcrReviewWorkspace batch={batch} canResolveDuplicates={canResolve} /></div>;
}
