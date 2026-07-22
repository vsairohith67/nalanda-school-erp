import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { AI_TOOL_REGISTRY } from "@/lib/ai-assistant-tools";

export async function GET() {
  const auth = await requireApiPermission("USE_AI_ASSISTANT_AGGREGATES"); if (auth.response) return auth.response;
  return NextResponse.json({ tools: Object.values(AI_TOOL_REGISTRY).map(({ run: _run, ...item }) => item) });
}
