import { prisma } from "@/lib/prisma";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { verifiedWorkerJson, workerError, workerJson } from "@/lib/ocr-scanning/worker-http";
import { claimOcrJob } from "@/lib/ocr-scanning/worker-service";

export async function POST(request: Request) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const { verified } = await verifiedWorkerJson(request, 1_024);
    const job = await claimOcrJob({ client: prisma, workerId: verified.workerId, nonceHash: verified.nonceHash });
    return workerJson({ job });
  } catch (error) { return workerError(error); }
}
