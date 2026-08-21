import type { NextRequest } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runUniversalSearch } from "@/lib/universal-search";
import { parseUniversalSearchBody, universalSearchError, universalSearchJson } from "@/lib/universal-search-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  if (auth.response || !auth.user) return auth.response;
  try {
    const searchRequest = await parseUniversalSearchBody(request);
    return universalSearchJson(await runUniversalSearch(prisma, auth.user, searchRequest));
  } catch (error) {
    return universalSearchError(error);
  }
}
