import type { NextRequest } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runUniversalSearch } from "@/lib/universal-search";
import { parseUniversalSearchBody, universalSearchError, universalSearchJson } from "@/lib/universal-search-api";
import { withOperationCapacity } from "@/lib/resource-guard";
import { enforceOperationRateLimit } from "@/lib/security-resilience";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  if (auth.response || !auth.user) return auth.response;
  try {
    const budget = await enforceOperationRateLimit("/api/super-admin/search", "POST", { account: auth.user.id, role: auth.user.role }, { dimensions: ["account", "role"] });
    if (!budget.allowed) {
      const response = universalSearchJson({ error: budget.status === 429 ? "Too many Search requests. Please retry shortly." : "Search abuse protection is temporarily unavailable.", code: budget.code }, budget.status);
      response.headers.set("Retry-After", String(budget.retryAfterSeconds));
      return response;
    }
    const searchRequest = await parseUniversalSearchBody(request);
    return universalSearchJson(await withOperationCapacity("UNIVERSAL_SEARCH", () => runUniversalSearch(prisma, auth.user, searchRequest)));
  } catch (error) {
    return universalSearchError(error);
  }
}
