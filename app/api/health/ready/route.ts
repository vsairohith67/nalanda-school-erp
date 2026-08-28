import { NextResponse } from "next/server";
import { portableReadiness } from "@/lib/portable-runtime/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await portableReadiness();
  return NextResponse.json(
    { status: result.ready ? "ready" : "unavailable", code: result.safeCode },
    { status: result.ready ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(result.ready ? {} : { "Retry-After": "30" }) } }
  );
}
