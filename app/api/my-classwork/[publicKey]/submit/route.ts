import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { classworkApiError, classworkJson, classworkJsonBody, requestLearnerContext } from "@/lib/classwork-api";
import { submitClasswork } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicKey: string }> }) {
  const auth = await requireApiPermission("SUBMIT_OWN_CLASSWORK");
  if (auth.response || !auth.user) return auth.response;
  try {
    const body = await classworkJsonBody(request);
    const context = await requestLearnerContext(request, auth.user, body);
    const { publicKey } = await params;
    return classworkJson(await submitClasswork(prisma, publicKey, body, context));
  } catch (error) {
    return classworkApiError(error);
  }
}
