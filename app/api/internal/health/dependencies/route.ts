import { NextResponse } from "next/server";
import { internalPortableRequestAuthorized } from "@/lib/portable-runtime/internal-auth";
import { portableReadiness } from "@/lib/portable-runtime/health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!internalPortableRequestAuthorized(request.headers)) return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  const result = await portableReadiness();
  return NextResponse.json(result, { status: result.ready ? 200 : 503, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
