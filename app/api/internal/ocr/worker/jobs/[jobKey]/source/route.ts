import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { OCR_WORKER_PRIVATE_HEADERS, verifiedWorkerJson, workerError, workerLeaseToken } from "@/lib/ocr-scanning/worker-http";
import { readWorkerOcrSource } from "@/lib/ocr-scanning/worker-service";

export async function POST(request: Request, context: { params: Promise<{ jobKey: string }> }) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const { body, verified } = await verifiedWorkerJson(request, 1_024);
    const source = await readWorkerOcrSource({ client: prisma, workerId: verified.workerId, nonceHash: verified.nonceHash, jobKey: (await context.params).jobKey, leaseToken: workerLeaseToken(body.leaseToken) });
    return new NextResponse(new Uint8Array(source.bytes), { headers: {
      ...OCR_WORKER_PRIVATE_HEADERS, "Content-Type": "application/octet-stream",
      "Content-Length": String(source.bytes.length), "X-Nalanda-OCR-Source-Type": source.mediaType,
      "X-Nalanda-OCR-Source-SHA256": source.sourceSha256
    } });
  } catch (error) { return workerError(error); }
}
