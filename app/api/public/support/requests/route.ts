import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPublicSupportRequest, validatePublicSupportInput } from "@/lib/support";
import { rollbackStoredSupportFile, storeSupportFile, validateSupportUpload } from "@/lib/support-files";
import { supportJson } from "@/lib/support-api";

const MESSAGE = "Your support request has been received. Keep the reference shown on this page.";

export async function POST(request: NextRequest) {
  let storedKey: string | null = null;
  try {
    const form = await request.formData();
    const input = validatePublicSupportInput({
      requesterName: form.get("requesterName"), requesterType: form.get("requesterType"), requesterIdentifier: form.get("requesterIdentifier"),
      contactChannel: form.get("contactChannel"), contactValue: form.get("contactValue"), category: form.get("category"), message: form.get("message"),
      consent: form.get("consent") === "true", honeypot: form.get("website"), submissionKey: form.get("submissionKey")
    });
    const upload = form.get("screenshot");
    let attachment = null;
    if (upload instanceof File && upload.size > 0) {
      const validated = await validateSupportUpload(upload, "PUBLIC");
      storedKey = await storeSupportFile(validated);
      attachment = { ...validated, storageKey: storedKey };
    }
    const sourceEvidence = [request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ?? "local", request.headers.get("user-agent")?.slice(0, 120) ?? "unknown"].join("|");
    const result = await createPublicSupportRequest(prisma, input, sourceEvidence, attachment);
    if (result.neutralized && storedKey) { await rollbackStoredSupportFile(storedKey); storedKey = null; }
    return supportJson({ accepted: true, reference: result.reference, message: MESSAGE }, 202);
  } catch {
    if (storedKey) await rollbackStoredSupportFile(storedKey).catch(() => undefined);
    return supportJson({ accepted: true, reference: `NPS-SUP-${randomUUID().slice(0, 8).toUpperCase()}${randomBytes(2).toString("hex").toUpperCase()}`, message: MESSAGE }, 202);
  }
}
