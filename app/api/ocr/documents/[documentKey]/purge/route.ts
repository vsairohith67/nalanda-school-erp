import { prisma } from "@/lib/prisma";
import { type OcrContextType } from "@/lib/ocr-scanning/contracts";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { authorizeOcr, enforceOcrRateLimit, ocrError, ocrJson } from "@/lib/ocr-scanning/http";
import { purgeOcrDocument } from "@/lib/ocr-scanning/workflow";

export async function POST(_request: Request, context: { params: Promise<{ documentKey: string }> }) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const documentKey = (await context.params).documentKey;
    const document = await prisma.ocrDocument.findUnique({ where: { publicKey: documentKey }, select: { contextType: true } });
    if (!document) return ocrJson({ error: "OCR document not found.", code: "OCR_DOCUMENT_NOT_FOUND" }, 404);
    const auth = await authorizeOcr(document.contextType as OcrContextType, "PURGE");
    if (auth.response || !auth.user) return auth.response;
    const limited = await enforceOcrRateLimit(`/api/ocr/documents/${documentKey}/purge`, "POST", auth.user, { document: documentKey, operation: "purge" });
    if (limited) return limited;
    return ocrJson(await purgeOcrDocument({ client: prisma, actor: auth.user, documentKey }));
  } catch (error) { return ocrError(error); }
}
