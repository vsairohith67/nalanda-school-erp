import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { classworkApiError, classworkJson, classworkJsonBody } from "@/lib/classwork-api";
import { createClassworkDraft, loadClassworkWorkspace, validateClassworkDraftInput } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_CLASSWORK"); if (auth.response || !auth.user) return auth.response;
  try { return classworkJson(await loadClassworkWorkspace(prisma, auth.user, request.nextUrl.searchParams.get("academicYear") ?? undefined)); }
  catch (error) { return classworkApiError(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_CLASSWORK"); if (auth.response || !auth.user) return auth.response;
  try { const body = await classworkJsonBody(request); return classworkJson(await createClassworkDraft(prisma, validateClassworkDraftInput(body), auth.user), 201); }
  catch (error) { return classworkApiError(error); }
}
