import type { NextRequest } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { orchestrateSmartAi } from "@/lib/smart-ai";
import { parseSmartAiBody, smartAiError, smartAiJson } from "@/lib/smart-ai-api";
import { withOperationCapacity } from "@/lib/resource-guard";
import { enforceOperationRateLimit } from "@/lib/security-resilience";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  if (auth.response || !auth.user) return auth.response;
  try {
    const budget = await enforceOperationRateLimit("/api/super-admin/ai", "POST", { account: auth.user.id, role: auth.user.role }, { dimensions: ["account", "role"] });
    if (!budget.allowed) {
      const response = smartAiJson({ error: budget.status === 429 ? "Too many Smart AI requests. Please retry shortly." : "Smart AI abuse protection is temporarily unavailable.", code: budget.code }, budget.status);
      response.headers.set("Retry-After", String(budget.retryAfterSeconds));
      return response;
    }
    const input = await parseSmartAiBody(request);
    return smartAiJson(await withOperationCapacity("SMART_AI", () => orchestrateSmartAi(prisma, auth.user, input, { signal: request.signal })));
  } catch (error) {
    return smartAiError(error);
  }
}
