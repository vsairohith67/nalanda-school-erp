import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OCR_INPUT_LIMITS, type OcrContextType } from "@/lib/ocr-scanning/contracts";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { authorizeOcr, boundedPositiveInteger, OCR_PRIVATE_HEADERS, ocrError, ocrJson } from "@/lib/ocr-scanning/http";
import { readOcrPrivateObject } from "@/lib/ocr-scanning/storage";

export async function GET(_request: Request, context: { params: Promise<{ documentKey: string; pageNumber: string }> }) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const params = await context.params;
    const document = await prisma.ocrDocument.findUnique({ where: { publicKey: params.documentKey }, select: { id: true, contextType: true } });
    if (!document) return ocrJson({ error: "OCR document not found.", code: "OCR_DOCUMENT_NOT_FOUND" }, 404);
    const auth = await authorizeOcr(document.contextType as OcrContextType, "VIEW_SOURCE");
    if (auth.response || !auth.user) return auth.response;
    const pageNumber = boundedPositiveInteger(params.pageNumber, 1, 25, "OCR_PAGE_NUMBER_INVALID");
    const page = await prisma.ocrPage.findFirst({ where: { documentId: document.id, pageNumber } });
    if (!page) return ocrJson({ error: "OCR page not found.", code: "OCR_PAGE_NOT_FOUND" }, 404);
    const object = await readOcrPrivateObject(page.rasterObjectKey, OCR_INPUT_LIMITS.maximumOutputBytesPerPage);
    if (object.metadata.sha256 !== page.rasterSha256) throw new Error("OCR_RASTER_CHECKSUM_MISMATCH");
    return new NextResponse(new Uint8Array(object.bytes), { headers: {
      ...OCR_PRIVATE_HEADERS, "Content-Type": "image/png", "Content-Length": String(object.bytes.length),
      "Content-Security-Policy": "default-src 'none'; sandbox", "X-OCR-Page": String(page.pageNumber)
    } });
  } catch (error) { return ocrError(error); }
}
