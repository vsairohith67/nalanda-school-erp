import { notFound, redirect } from "next/navigation";
import { hasUserPermission, requireUser } from "@/lib/auth";
import type { CanonicalPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isOcrScanningEnabled } from "@/lib/ocr-scanning/feature-flag";
import type { OcrContextType } from "@/lib/ocr-scanning/contracts";
import { loadOcrReviewWorkspace } from "@/lib/ocr-scanning/workflow";
import { OcrReviewWorkspace } from "@/components/ocr-review-workspace";

const REVIEW_PERMISSIONS: Record<OcrContextType, readonly CanonicalPermission[]> = {
  ADMISSION: ["REVIEW_ADMISSION_APPLICATIONS", "MANAGE_ADMISSION_APPLICATIONS"],
  STUDENT: ["EDIT_STUDENTS"],
  GUARDIAN: ["MANAGE_GUARDIANS"],
  STAFF: ["MANAGE_STAFF"]
};

export default async function OcrScanningReviewPage({ params }: { params: Promise<{ documentKey: string }> }) {
  if (!isOcrScanningEnabled()) notFound();
  const documentKey = (await params).documentKey;
  const document = await prisma.ocrDocument.findUnique({ where: { publicKey: documentKey }, select: { contextType: true } });
  if (!document) notFound();
  const user = await requireUser();
  const permissions = REVIEW_PERMISSIONS[document.contextType as OcrContextType];
  const allowed = await Promise.all(permissions.map((permission) => hasUserPermission(user, permission)));
  if (!allowed.some(Boolean)) redirect("/unauthorized");
  const workspace = await loadOcrReviewWorkspace(prisma, documentKey);
  return <OcrReviewWorkspace initial={workspace} />;
}
