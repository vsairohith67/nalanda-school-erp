import { NextRequest, NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  addSupportMessage, assignSupportRequest, createSupportAttachmentRecord, loadSupportAttachment,
  loadSupportRequestForActor, performSupportTransition, reopenOwnSupportRequest,
  resolveSupportRequest, submitSupportSatisfaction, triageSupportRequest
} from "@/lib/support";
import { readSupportFile, rollbackStoredSupportFile, storeSupportFile, validateSupportUpload } from "@/lib/support-files";
import { parseJsonBody, SUPPORT_PRIVATE_HEADERS, supportActor, supportApiError, supportJson } from "@/lib/support-api";

export async function supportDetail(user: AuthUser, requestKey: string, mode: "OWN" | "MANAGE") {
  try { return supportJson({ request: await loadSupportRequestForActor(prisma, await supportActor(user), requestKey, mode) }); }
  catch (error) { return supportApiError(error); }
}

export async function supportWorkflow(request: NextRequest, user: AuthUser, requestKey: string, mode: "OWN" | "MANAGE") {
  try {
    const body = await parseJsonBody(request), action = String((body as Record<string, unknown>).action ?? "").toUpperCase(), actor = await supportActor(user);
    const result = mode === "OWN"
      ? action === "REPLY" ? await addSupportMessage(prisma, actor, requestKey, body, "OWN")
        : action === "REOPEN" ? await reopenOwnSupportRequest(prisma, actor, requestKey, body)
        : action === "SATISFACTION" ? await submitSupportSatisfaction(prisma, actor, requestKey, body)
        : null
      : action === "TRIAGE" ? await triageSupportRequest(prisma, actor, requestKey, body)
        : action === "ASSIGN" ? await assignSupportRequest(prisma, actor, requestKey, body)
        : action === "MESSAGE" ? await addSupportMessage(prisma, actor, requestKey, body, "MANAGE")
        : action === "RESOLVE" ? await resolveSupportRequest(prisma, actor, requestKey, body)
        : action === "TRANSITION" ? await performSupportTransition(prisma, actor, requestKey, { ...body as Record<string, unknown>, action: (body as Record<string, unknown>).transitionAction })
        : null;
    if (!result) return supportJson({ error: "The support action is not available." }, 400);
    return supportJson({ result });
  } catch (error) { return supportApiError(error); }
}

export async function supportUpload(request: NextRequest, user: AuthUser, requestKey: string, mode: "OWN" | "MANAGE") {
  let storageKey: string | null = null;
  try {
    const form = await request.formData(), upload = form.get("attachment");
    if (!(upload instanceof File) || upload.size < 1) return supportJson({ error: "Choose a private support attachment." }, 400);
    const validated = await validateSupportUpload(upload, "AUTHENTICATED");
    storageKey = await storeSupportFile(validated);
    const visibility = mode === "OWN" ? "REQUESTER_VISIBLE" : form.get("visibility") === "INTERNAL_NOTE" ? "INTERNAL_NOTE" : "REQUESTER_VISIBLE";
    const attachment = await createSupportAttachmentRecord(prisma, await supportActor(user), requestKey, typeof form.get("messageKey") === "string" ? String(form.get("messageKey")) || null : null, { ...validated, storageKey }, visibility, mode);
    return supportJson({ attachment }, 201);
  } catch (error) {
    if (storageKey) await rollbackStoredSupportFile(storageKey).catch(() => undefined);
    return supportApiError(error);
  }
}

export async function supportDownload(user: AuthUser, attachmentKey: string, mode: "OWN" | "MANAGE") {
  try {
    const attachment = await loadSupportAttachment(prisma, await supportActor(user), attachmentKey, mode);
    const bytes = await readSupportFile(attachment.storageKey, attachment.sha256);
    return new NextResponse(bytes, { headers: { ...SUPPORT_PRIVATE_HEADERS, "Content-Type": attachment.mediaType, "Content-Length": String(bytes.length), "Content-Disposition": `attachment; filename="${attachment.safeDisplayName.replace(/["\\\r\n]/g, "")}"`, "Content-Security-Policy": "sandbox; default-src 'none'", "Accept-Ranges": "none", "X-Attachment-SHA256": attachment.sha256 } });
  } catch (error) { return supportApiError(error); }
}
