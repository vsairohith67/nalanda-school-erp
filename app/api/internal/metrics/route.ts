import { internalPortableRequestAuthorized } from "@/lib/portable-runtime/internal-auth";
import { portableMetricsText } from "@/lib/portable-runtime/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!internalPortableRequestAuthorized(request.headers)) return new Response("Not found\n", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  return new Response(portableMetricsText(), { status: 200, headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
