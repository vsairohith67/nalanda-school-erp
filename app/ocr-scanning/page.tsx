import { notFound, redirect } from "next/navigation";
import { hasUserPermission, requireUser } from "@/lib/auth";
import type { CanonicalPermission } from "@/lib/permissions";
import { isOcrScanningEnabled } from "@/lib/ocr-scanning/feature-flag";
import { OcrUploadWorkspace } from "@/components/ocr-upload-workspace";

const OCR_UPLOAD_PERMISSIONS: readonly CanonicalPermission[] = ["MANAGE_ADMISSION_DOCUMENTS", "EDIT_STUDENTS", "MANAGE_GUARDIANS", "MANAGE_STAFF"];

export default async function OcrScanningPage() {
  if (!isOcrScanningEnabled()) notFound();
  const user = await requireUser();
  const access = await Promise.all(OCR_UPLOAD_PERMISSIONS.map((permission) => hasUserPermission(user, permission)));
  if (!access.some(Boolean)) redirect("/unauthorized");
  return <OcrUploadWorkspace />;
}
