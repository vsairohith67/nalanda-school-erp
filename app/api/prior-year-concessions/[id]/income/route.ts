import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readPriorYearIncome } from "@/lib/prior-year-concessions";
import { requireOperationalReleaseFeatureForApi, PRIOR_YEAR_CONCESSIONS_FEATURE } from "@/lib/release-feature-flag-runtime";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = requireOperationalReleaseFeatureForApi(PRIOR_YEAR_CONCESSIONS_FEATURE); if (off) return off;
  const context = await getCurrentAuthContext(), headers = { "Cache-Control": "private, no-store" };
  if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers });
  try {
    const { id } = await params;
    return NextResponse.json(await readPriorYearIncome(prisma, { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId }, id, request.nextUrl.searchParams.get("exact") === "true"), { headers });
  } catch { return NextResponse.json({ error: "Restricted support unavailable" }, { status: 403, headers }); }
}
