import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { classworkApiError, classworkJson, classworkJsonBody } from "@/lib/classwork-api";
import { reviewClassworkSubmission } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicKey: string }> }) {
  const auth = await requireApiPermission("REVIEW_CLASSWORK_SUBMISSIONS"); if (auth.response || !auth.user) return auth.response;
  try { return classworkJson(await reviewClassworkSubmission(prisma, (await params).publicKey, await classworkJsonBody(request), auth.user)); }
  catch (error) { return classworkApiError(error); }
}
