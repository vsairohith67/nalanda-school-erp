import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { getReleaseOperationsView } from "@/lib/release-operations-view";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiPermission("VIEW_RELEASE_OPERATIONS_SUMMARY");
  if (auth.response) return auth.response;
  const full = await hasUserPermission(auth.user, "VIEW_RELEASE_OPERATIONS");
  return Response.json(getReleaseOperationsView({ summaryOnly: !full }), { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
