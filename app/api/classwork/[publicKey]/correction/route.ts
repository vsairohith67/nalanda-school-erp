import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { classworkApiError, classworkJson, classworkJsonBody } from "@/lib/classwork-api";
import { createClassworkCorrection, validateExpectedVersion } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicKey: string }> }) {
  const auth = await requireApiPermission("MANAGE_CLASSWORK"); if (auth.response || !auth.user) return auth.response;
  try { const body = await classworkJsonBody(request); return classworkJson(await createClassworkCorrection(prisma, (await params).publicKey, body, validateExpectedVersion(body.expectedVersion), auth.user), 201); }
  catch (error) { return classworkApiError(error); }
}
