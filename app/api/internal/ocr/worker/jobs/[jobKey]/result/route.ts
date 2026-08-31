import { prisma } from "@/lib/prisma";
import { OCR_INPUT_LIMITS, type OcrWorkerResult } from "@/lib/ocr-scanning/contracts";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { verifiedWorkerJson, workerError, workerJson, workerLeaseToken } from "@/lib/ocr-scanning/worker-http";
import { completeOcrJob } from "@/lib/ocr-scanning/worker-service";

export async function POST(request: Request, context: { params: Promise<{ jobKey: string }> }) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const { body, verified } = await verifiedWorkerJson(request, OCR_INPUT_LIMITS.maximumOutputBytesPerDocument + 16 * 1024);
    const result = body.result;
    if (!result || typeof result !== "object" || Array.isArray(result)) return workerJson({ error: "Bounded OCR result required.", code: "OCR_RESULT_INVALID" }, 400);
    return workerJson(await completeOcrJob({
      client: prisma, workerId: verified.workerId, nonceHash: verified.nonceHash,
      jobKey: (await context.params).jobKey, leaseToken: workerLeaseToken(body.leaseToken), result: result as OcrWorkerResult
    }));
  } catch (error) { return workerError(error); }
}
