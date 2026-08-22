import type { NextRequest } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orchestrateSmartAi } from "@/lib/smart-ai";
import { parseSmartAiBody, smartAiError, smartAiJson } from "@/lib/smart-ai-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  if (auth.response || !auth.user) return auth.response;
  try {
    const input = await parseSmartAiBody(request);
    return smartAiJson(await orchestrateSmartAi(prisma, auth.user, input, { signal: request.signal }));
  } catch (error) {
    return smartAiError(error);
  }
}
