import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { classworkApiError, classworkJson, classworkJsonBody } from "@/lib/classwork-api";
import { transitionClassworkItem, validateExpectedVersion } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicKey: string }> }) {
  const auth = await requireApiPermission("CLOSE_CLASSWORK"); if (auth.response || !auth.user) return auth.response;
  try { const body = await classworkJsonBody(request); return classworkJson({ item: await transitionClassworkItem(prisma, (await params).publicKey, body.action, validateExpectedVersion(body.expectedVersion), auth.user) }); }
  catch (error) { return classworkApiError(error); }
}
