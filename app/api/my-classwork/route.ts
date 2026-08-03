import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { classworkApiError, classworkJson, requestLearnerContext } from "@/lib/classwork-api";
import { loadLearnerClasswork } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_OWN_CLASSWORK");
  if (auth.response || !auth.user) return auth.response;
  try {
    const context = await requestLearnerContext(request, auth.user);
    return classworkJson(await loadLearnerClasswork(prisma, context, request.nextUrl.searchParams.get("history") === "1"));
  } catch (error) {
    return classworkApiError(error);
  }
}
