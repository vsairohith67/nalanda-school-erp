import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { uploadItemVersionAttachment } from "@/lib/classwork-attachments";
import { assertClassworkMultipart, classworkApiError, classworkJson } from "@/lib/classwork-api";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("UPLOAD_CLASSWORK_ATTACHMENTS"); if (auth.response || !auth.user) return auth.response;
  try {
    assertClassworkMultipart(request);
    const form = await request.formData();
    const file = form.get("file"); const versionPublicKey = String(form.get("versionPublicKey") ?? "");
    if (!(file instanceof File)) return classworkJson({ error: "Choose a file to upload." }, 400);
    const attachment = await uploadItemVersionAttachment((await import("@/lib/prisma")).prisma, versionPublicKey, file, auth.user);
    return classworkJson({ attachment: { publicKey: attachment.publicKey, safeDisplayName: attachment.safeDisplayName, mediaType: attachment.mediaType, byteSize: attachment.byteSize, recoveryStatus: attachment.recoveryStatus } }, 201);
  } catch (error) { return classworkApiError(error); }
}
