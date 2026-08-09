import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveClientVersionPolicy } from "@/lib/operational-workflows";
import { parseTechnicalOperationsJson, technicalOperationsError, technicalOperationsJson } from "@/lib/technical-operations-api";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_CLIENT_VERSION_POLICY"); if (auth.response) return auth.response;
  try { return technicalOperationsJson({ policy: await saveClientVersionPolicy(prisma, await parseTechnicalOperationsJson(request), auth.user.id) }); }
  catch (error) { return technicalOperationsError(error); }
}
