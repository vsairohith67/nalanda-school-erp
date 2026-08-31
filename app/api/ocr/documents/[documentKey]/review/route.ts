import { prisma } from "@/lib/prisma";
import { OCR_FIELD_DECISIONS, requireMember, type OcrContextType } from "@/lib/ocr-scanning/contracts";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { authorizeOcr, boundedPositiveInteger, enforceOcrRateLimit, ocrError, ocrJson, ocrJsonBody } from "@/lib/ocr-scanning/http";
import { rejectOcrDocument, reviewOcrField, rotateOcrReviewPage } from "@/lib/ocr-scanning/workflow";

export async function PATCH(request: Request, context: { params: Promise<{ documentKey: string }> }) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const documentKey = (await context.params).documentKey;
    const document = await prisma.ocrDocument.findUnique({ where: { publicKey: documentKey }, select: { contextType: true } });
    if (!document) return ocrJson({ error: "OCR document not found.", code: "OCR_DOCUMENT_NOT_FOUND" }, 404);
    const auth = await authorizeOcr(document.contextType as OcrContextType, "REVIEW");
    if (auth.response || !auth.user) return auth.response;
    const limited = await enforceOcrRateLimit(`/api/ocr/documents/${documentKey}/review`, "PATCH", auth.user, { document: documentKey, operation: "review" });
    if (limited) return limited;
    const body = await ocrJsonBody(request);
    const action = String(body.action ?? "FIELD_DECISION").toUpperCase();
    if (action === "ROTATE_PAGE") return ocrJson(await rotateOcrReviewPage({
      client: prisma, actor: auth.user, documentKey,
      pageNumber: boundedPositiveInteger(body.pageNumber, 1, 25, "OCR_PAGE_NUMBER_INVALID"),
      rotation: boundedPositiveInteger(body.rotation, 0, 270, "OCR_PAGE_ROTATION_INVALID"),
      expectedReviewVersion: boundedPositiveInteger(body.expectedReviewVersion, 1, 1_000_000, "OCR_REVIEW_VERSION_INVALID")
    }));
    return ocrJson(await reviewOcrField({
      client: prisma, actor: auth.user, documentKey,
      fieldKey: String(body.fieldKey ?? ""),
      decision: requireMember(body.decision, OCR_FIELD_DECISIONS, "OCR_FIELD_DECISION_INVALID"),
      approvedValue: typeof body.approvedValue === "string" ? body.approvedValue : undefined,
      editReason: typeof body.editReason === "string" ? body.editReason : undefined,
      expectedFieldVersion: boundedPositiveInteger(body.expectedFieldVersion, 1, 1_000_000, "OCR_FIELD_VERSION_INVALID"),
      expectedReviewVersion: boundedPositiveInteger(body.expectedReviewVersion, 1, 1_000_000, "OCR_REVIEW_VERSION_INVALID")
    }));
  } catch (error) { return ocrError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ documentKey: string }> }) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const documentKey = (await context.params).documentKey;
    const document = await prisma.ocrDocument.findUnique({ where: { publicKey: documentKey }, select: { contextType: true } });
    if (!document) return ocrJson({ error: "OCR document not found.", code: "OCR_DOCUMENT_NOT_FOUND" }, 404);
    const auth = await authorizeOcr(document.contextType as OcrContextType, "REJECT");
    if (auth.response || !auth.user) return auth.response;
    const limited = await enforceOcrRateLimit(`/api/ocr/documents/${documentKey}/review`, "POST", auth.user, { document: documentKey, operation: "reject" });
    if (limited) return limited;
    const body = await ocrJsonBody(request);
    return ocrJson(await rejectOcrDocument({ client: prisma, actor: auth.user, documentKey, reason: String(body.reason ?? "") }));
  } catch (error) { return ocrError(error); }
}
