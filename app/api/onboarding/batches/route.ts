import { NextRequest } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { onboardingError, onboardingJson, assertOnboardingOrigin, runObservedOnboardingJob } from "@/lib/onboarding-api";
import { OnboardingError, presentBatch } from "@/lib/onboarding";
import { parseOnboardingWorkbook } from "@/lib/onboarding-workbooks";
import { isOnboardingBundle, ONBOARDING_SCHEMA_VERSION, ONBOARDING_TEMPLATE_VERSION } from "@/lib/onboarding-types";
import { MAX_ONBOARDING_WORKBOOK_BYTES, sha256, storeOnboardingWorkbook, removeOnboardingWorkbook } from "@/lib/onboarding-storage";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await requireApiPermission("VIEW_ONBOARDING_AUDIT"); if (auth.response) return auth.response;
  const rows = await prisma.onboardingBatch.findMany({ where: { purgedAt: null }, orderBy: { createdAt: "desc" }, take: 100 });
  return onboardingJson({ batches: rows.map((r) => presentBatch(r)) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("UPLOAD_ONBOARDING_WORKBOOK"); if (auth.response) return auth.response;
  let storageKey: string | null = null;
  try {
    assertOnboardingOrigin(request);
    const contentType = request.headers.get("content-type") ?? ""; if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new OnboardingError("Use a multipart workbook upload.", 415, "MULTIPART_REQUIRED");
    const length = Number(request.headers.get("content-length") ?? 0); if (length && length > MAX_ONBOARDING_WORKBOOK_BYTES + 256 * 1024) throw new OnboardingError("The workbook upload is too large.", 413, "WORKBOOK_TOO_LARGE");
    const form = await request.formData(), file = form.get("workbook"), bundle = String(form.get("bundle") ?? "");
    if (!(file instanceof File) || !isOnboardingBundle(bundle)) throw new OnboardingError("A supported bundle and XLSX workbook are required.");
    if (!file.name.toLowerCase().endsWith(".xlsx") || file.name.length > 180) throw new OnboardingError("Only approved .xlsx workbooks are accepted.", 415, "XLSX_REQUIRED");
    if (!new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]).has(file.type)) throw new OnboardingError("The workbook MIME type is not approved.", 415, "MIME_REFUSED");
    if (file.size < 1 || file.size > MAX_ONBOARDING_WORKBOOK_BYTES) throw new OnboardingError("The workbook size is outside the allowed limit.", 413, "WORKBOOK_SIZE_REFUSED");
    const bytes = Buffer.from(await file.arrayBuffer()), workbookSha256 = sha256(bytes);
    const parsed = await runObservedOnboardingJob({ jobType: "ONBOARDING_WORKBOOK_PARSE", summarySafe: "Governed onboarding workbook parse and container validation", idempotencyKey: `onboarding-workbook-${auth.user!.id}-${workbookSha256}` }, () => parseOnboardingWorkbook(bytes, bundle));
    const existing = await prisma.onboardingBatch.findUnique({ where: { uploadedByUserId_workbookSha256_bundleType: { uploadedByUserId: auth.user!.id, workbookSha256, bundleType: bundle } } });
    if (existing) return onboardingJson({ batch: presentBatch(existing), duplicateUpload: true });
    const stored = await storeOnboardingWorkbook(bytes); storageKey = stored.storageKey;
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.onboardingBatch.create({ data: { bundleType: bundle, uploadedByUserId: auth.user!.id, originalFileNameHash: sha256(file.name.normalize("NFC")), storageKey: stored.storageKey, workbookSha256, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize: bytes.length, templateVersion: parsed.metadata["Template Version"] || ONBOARDING_TEMPLATE_VERSION, schemaVersion: parsed.metadata["Application Schema Version"] || ONBOARDING_SCHEMA_VERSION, purgeAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
      await tx.onboardingAuditEvent.create({ data: { batchId: created.id, sequence: 1, eventType: "UPLOADED", newStatus: "UPLOADED", actorUserId: auth.user!.id, evidenceHash: workbookSha256 } }); return created;
    });
    return onboardingJson({ batch: presentBatch(batch) }, 201);
  } catch (error) { if (storageKey) await removeOnboardingWorkbook(storageKey).catch(() => undefined); return onboardingError(error); }
}
