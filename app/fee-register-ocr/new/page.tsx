import { PageHeader } from "@/components/ui";
import { OcrNewBatchForm } from "@/components/fee-register-ocr-ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureFeeRegisterOcrFoundation } from "@/lib/fee-register-ocr";

export default async function NewFeeRegisterOcrPage() {
  await requirePermission("UPLOAD_FEE_REGISTER_PAGES"); await ensureFeeRegisterOcrFoundation(prisma);
  const [profiles, settings] = await Promise.all([prisma.feeRegisterOcrProfile.findMany({ where: { providerKind: { in: ["MOCK", "MANUAL"] } }, orderBy: { providerKind: "asc" } }), prisma.schoolSettings.findUnique({ where: { id: "school" } })]);
  return <div className="page fee-register-ocr-page"><PageHeader title="Create Fee Register OCR Batch" description="Start a private MOCK or MANUAL staging batch. No Payment, receipt, dues or Cash Book write occurs." /><OcrNewBatchForm profiles={profiles} academicYear={settings?.academicYear ?? "2026-27"} /></div>;
}
