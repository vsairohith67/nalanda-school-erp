import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { admitOcrDocument } from "@/lib/ocr-scanning/admission";
import { OCR_INPUT_LIMITS, OCR_CONTEXT_TYPES, OCR_LANGUAGE_PROFILES, requireMember } from "@/lib/ocr-scanning/contracts";
import { requireOcrScanningForApi } from "@/lib/ocr-scanning/feature-flag";
import { authorizeOcr, enforceOcrRateLimit, ocrError, ocrJson } from "@/lib/ocr-scanning/http";
import { createOcrUpload } from "@/lib/ocr-scanning/workflow";
import { readBoundedOcrRequestBody } from "@/lib/ocr-scanning/request-body";

export async function POST(request: NextRequest) {
  const unavailable = requireOcrScanningForApi();
  if (unavailable) return unavailable;
  try {
    const contextType = requireMember(request.headers.get("x-nalanda-ocr-context-type"), OCR_CONTEXT_TYPES, "OCR_CONTEXT_TYPE_INVALID");
    const contextId = request.headers.get("x-nalanda-ocr-context-id") ?? "";
    const auth = await authorizeOcr(contextType, "UPLOAD");
    if (auth.response || !auth.user) return auth.response;
    const limited = await enforceOcrRateLimit("/api/ocr/documents", "POST", auth.user, { operation: "upload" });
    if (limited) return limited;
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength && (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > OCR_INPUT_LIMITS.maximumFileBytes + 64 * 1024)) return ocrJson({ error: "The OCR upload is too large.", code: "OCR_FILE_TOO_LARGE" }, 413);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) return ocrJson({ error: "Use multipart form data.", code: "OCR_MULTIPART_REQUIRED" }, 415);
    const multipartBytes = await readBoundedOcrRequestBody(request, OCR_INPUT_LIMITS.maximumFileBytes + 64 * 1024, "OCR_FILE_TOO_LARGE");
    const boundedRequest = new Request(request.url, { method: request.method, headers: request.headers, body: multipartBytes });
    const form = await boundedRequest.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return ocrJson({ error: "Choose a PNG, JPEG, or PDF document.", code: "OCR_FILE_REQUIRED" }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const admitted = await admitOcrDocument({ bytes, filename: file.name, declaredMime: file.type });
    const languageProfile = requireMember(request.headers.get("x-nalanda-ocr-language") ?? "ENGLISH", OCR_LANGUAGE_PROFILES, "OCR_LANGUAGE_PROFILE_INVALID");
    const result = await createOcrUpload({
      client: prisma, actor: auth.user, contextType, contextId, languageProfile,
      handwritingDeclared: request.headers.get("x-nalanda-ocr-handwriting") === "true",
      idempotencyKey: request.headers.get("idempotency-key") ?? "", admitted
    });
    return ocrJson({ document: result }, result.idempotent ? 200 : 202);
  } catch (error) { return ocrError(error); }
}
