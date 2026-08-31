import { prisma } from "@/lib/prisma";
import { type OcrContextType } from "@/lib/ocr-scanning/contracts";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { authorizeOcr, boundedPositiveInteger, enforceOcrRateLimit, ocrError, ocrJson, ocrJsonBody } from "@/lib/ocr-scanning/http";
import { submitOcrReview } from "@/lib/ocr-scanning/workflow";

export async function POST(request: Request, context: { params: Promise<{ documentKey: string }> }) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const documentKey = (await context.params).documentKey;
    const document = await prisma.ocrDocument.findUnique({ where: { publicKey: documentKey }, select: { contextType: true } });
    if (!document) return ocrJson({ error: "OCR document not found.", code: "OCR_DOCUMENT_NOT_FOUND" }, 404);
    const auth = await authorizeOcr(document.contextType as OcrContextType, "SUBMIT");
    if (auth.response || !auth.user) return auth.response;
    const limited = await enforceOcrRateLimit(`/api/ocr/documents/${documentKey}/submit`, "POST", auth.user, { document: documentKey, operation: "submit" });
    if (limited) return limited;
    const body = await ocrJsonBody(request);
    return ocrJson(await submitOcrReview({
      client: prisma, actor: auth.user, documentKey,
      expectedReviewVersion: boundedPositiveInteger(body.expectedReviewVersion, 1, 1_000_000, "OCR_REVIEW_VERSION_INVALID"),
      idempotencyKey: request.headers.get("idempotency-key") ?? "",
      confirmation: String(body.confirmation ?? "")
    }));
  } catch (error) { return ocrError(error); }
}
