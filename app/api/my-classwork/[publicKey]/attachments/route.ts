import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { uploadSubmissionAttachment } from "@/lib/classwork-attachments";
import { assertClassworkMultipart, classworkApiError, classworkJson, requestLearnerContext } from "@/lib/classwork-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicKey: string }> }) {
  const auth = await requireApiPermission("UPLOAD_CLASSWORK_ATTACHMENTS");
  if (auth.response || !auth.user) return auth.response;
  try {
    assertClassworkMultipart(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return classworkJson({ error: "Choose a file to upload." }, 400);
    const context = await requestLearnerContext(request, auth.user, Object.fromEntries(form.entries()));
    const { publicKey } = await params;
    const attachment = await uploadSubmissionAttachment(prisma, publicKey, file, context);
    return classworkJson({ attachment: { publicKey: attachment.publicKey, safeDisplayName: attachment.safeDisplayName, mediaType: attachment.mediaType, byteSize: attachment.byteSize, recoveryStatus: attachment.recoveryStatus } }, 201);
  } catch (error) {
    return classworkApiError(error);
  }
}
