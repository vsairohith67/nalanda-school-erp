import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission, hasUserPermission } from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import { askAiAssistant } from "@/lib/ai-assistant";
import { safeAiAssistantError } from "@/lib/ai-assistant-errors";
import { assertBoundedJsonValue } from "@/lib/request-security";
import { ResourceGuardError, withOperationCapacity } from "@/lib/resource-guard";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_AI_ASSISTANT"); if (auth.response) return auth.response;
  try {
    const body = await request.json();
    assertBoundedJsonValue(body, { maximumArrayLength: 20, maximumStringLength: 4_000, maximumJsonNodes: 200 });
    const permission = body.mode === "DOCUMENTATION" ? "USE_AI_ASSISTANT_DOCUMENTATION" : "USE_AI_ASSISTANT_AGGREGATES";
    if (!(await hasUserPermission(auth.user, permission))) return NextResponse.json({ error: "This retrieval mode is not authorised for your role." }, { status: 403 });
    return NextResponse.json(await withOperationCapacity("SMART_AI", () => askAiAssistant(prisma, auth.user, body)));
  } catch (error) {
    if (error instanceof ResourceGuardError) return NextResponse.json({ error: "The assistant is busy. Please retry shortly." }, { status: error.status, headers: { "Retry-After": String(error.retryAfterSeconds), "Cache-Control": "private, no-store" } });
    const safe = safeAiAssistantError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  }
}
