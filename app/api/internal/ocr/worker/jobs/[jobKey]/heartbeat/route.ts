import { prisma } from "@/lib/prisma";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { verifiedWorkerJson, workerError, workerJson, workerLeaseToken } from "@/lib/ocr-scanning/worker-http";
import { heartbeatOcrJob } from "@/lib/ocr-scanning/worker-service";

export async function POST(request: Request, context: { params: Promise<{ jobKey: string }> }) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const { body, verified } = await verifiedWorkerJson(request, 2_048);
    return workerJson(await heartbeatOcrJob({ client: prisma, workerId: verified.workerId, nonceHash: verified.nonceHash, jobKey: (await context.params).jobKey, leaseToken: workerLeaseToken(body.leaseToken) }));
  } catch (error) { return workerError(error); }
}
