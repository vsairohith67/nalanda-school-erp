import { prisma } from "@/lib/prisma";
import { OCR_INPUT_LIMITS } from "@/lib/ocr-scanning/contracts";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { boundedPositiveInteger } from "@/lib/ocr-scanning/http";
import { verifiedWorkerBytes, workerError, workerJson, workerLeaseToken } from "@/lib/ocr-scanning/worker-http";
import { uploadWorkerOcrRaster } from "@/lib/ocr-scanning/worker-service";

export async function PUT(request: Request, context: { params: Promise<{ jobKey: string; pageNumber: string }> }) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "image/png") return workerJson({ error: "PNG raster required.", code: "OCR_RASTER_MEDIA_TYPE_INVALID" }, 415);
    const { bytes, verified } = await verifiedWorkerBytes(request, OCR_INPUT_LIMITS.maximumOutputBytesPerPage);
    const params = await context.params;
    const result = await uploadWorkerOcrRaster({
      client: prisma, workerId: verified.workerId, nonceHash: verified.nonceHash, jobKey: params.jobKey,
      leaseToken: workerLeaseToken(request.headers.get("x-nalanda-ocr-lease-token")),
      pageNumber: boundedPositiveInteger(params.pageNumber, 1, 25, "OCR_PAGE_NUMBER_INVALID"),
      width: boundedPositiveInteger(request.headers.get("x-nalanda-ocr-width"), 1, 6_000, "OCR_RASTER_WIDTH_INVALID"),
      height: boundedPositiveInteger(request.headers.get("x-nalanda-ocr-height"), 1, 6_000, "OCR_RASTER_HEIGHT_INVALID"),
      sourceRotation: boundedPositiveInteger(request.headers.get("x-nalanda-ocr-source-rotation"), 0, 270, "OCR_PAGE_ROTATION_INVALID"),
      sourceDigest: request.headers.get("x-nalanda-ocr-source-digest") ?? "",
      processingDurationMs: boundedPositiveInteger(request.headers.get("x-nalanda-ocr-duration-ms"), 0, 120_000, "OCR_DURATION_INVALID"),
      retryPreprocessing: request.headers.get("x-nalanda-ocr-retry-preprocessing") === "true",
      rasterSha256: request.headers.get("x-nalanda-ocr-raster-sha256") ?? "", bytes
    });
    return workerJson(result, result.idempotent ? 200 : 201);
  } catch (error) { return workerError(error); }
}
