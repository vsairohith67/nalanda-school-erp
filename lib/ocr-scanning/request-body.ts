import { OcrScanningError } from "@/lib/ocr-scanning/contracts";

export async function readBoundedOcrRequestBody(request: Request, maximumBytes: number, code = "OCR_REQUEST_BODY_TOO_LARGE") {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) throw new OcrScanningError("OCR_REQUEST_BODY_LIMIT_INVALID", 500);
  const declaredValue = request.headers.get("content-length")?.trim();
  if (declaredValue) {
    if (!/^\d{1,12}$/.test(declaredValue) || Number(declaredValue) > maximumBytes) throw new OcrScanningError(code, 413);
  }
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks, total);
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new OcrScanningError(code, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}
