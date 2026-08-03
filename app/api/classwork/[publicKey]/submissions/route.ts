import { requireApiPermission } from "@/lib/auth";
import { classworkApiError, classworkJson } from "@/lib/classwork-api";
import { loadSubmissionQueue } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ publicKey: string }> }) {
  const auth = await requireApiPermission("REVIEW_CLASSWORK_SUBMISSIONS"); if (auth.response || !auth.user) return auth.response;
  try { return classworkJson(await loadSubmissionQueue(prisma, (await params).publicKey, auth.user)); }
  catch (error) { return classworkApiError(error); }
}
