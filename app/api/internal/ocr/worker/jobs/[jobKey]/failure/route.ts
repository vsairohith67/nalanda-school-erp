import { prisma } from "@/lib/prisma";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { verifiedWorkerJson, workerError, workerJson, workerLeaseToken } from "@/lib/ocr-scanning/worker-http";
import { failOcrJob } from "@/lib/ocr-scanning/worker-service";

export async function POST(request: Request, context: { params: Promise<{ jobKey: string }> }) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const { body, verified } = await verifiedWorkerJson(request, 4_096);
    return workerJson(await failOcrJob({
      client: prisma, workerId: verified.workerId, nonceHash: verified.nonceHash,
      jobKey: (await context.params).jobKey, leaseToken: workerLeaseToken(body.leaseToken),
      failureCode: String(body.failureCode ?? ""), retryable: body.retryable === true
    }));
  } catch (error) { return workerError(error); }
}
