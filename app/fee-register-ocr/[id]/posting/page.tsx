import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { OcrPostingWorkspace } from "@/components/fee-register-ocr-ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ocrBatchInclude } from "@/lib/fee-register-ocr";

export default async function FeeRegisterOcrPostingPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("PREVIEW_FEE_REGISTER_OCR_POSTING");
  const batch = await prisma.feeRegisterOcrBatch.findUnique({ where: { id: (await params).id }, include: ocrBatchInclude });
  if (!batch) notFound();
  return <div className="page fee-register-ocr-page"><PageHeader title="OCR Payment Posting Preview" description={`${batch.batchNumber} · approval v${batch.approvedReviewVersion ?? "none"} · current review v${batch.reviewVersion}`} action={<Link className="button secondary" href={`/fee-register-ocr/${batch.id}`}>Batch summary</Link>} /><OcrPostingWorkspace batch={batch} /></div>;
}
