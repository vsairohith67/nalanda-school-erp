import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { retrieveClassworkAttachment } from "@/lib/classwork-attachments";
import { classworkApiError, requestLearnerContext } from "@/lib/classwork-api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ publicKey: string }> }) {
  const auth = await requireApiPermission("DOWNLOAD_CLASSWORK_ATTACHMENTS"); if (auth.response || !auth.user) return auth.response;
  try {
    let learner = null;
    if (auth.user.role === "PARENT" || auth.user.role === "STUDENT") learner = await requestLearnerContext(request, auth.user);
    const result = await retrieveClassworkAttachment(prisma, (await params).publicKey, auth.user, learner);
    return new NextResponse(result.bytes, { headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": result.attachment.mediaType,
      "Content-Length": String(result.attachment.byteSize),
      "Content-Disposition": `inline; filename="${result.attachment.safeDisplayName}"`,
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Content-SHA256": result.attachment.sha256,
      "Vary": "Cookie"
    } });
  } catch (error) { return classworkApiError(error); }
}
