import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTechnicalOperationsDashboard } from "@/lib/technical-operations";
import { technicalOperationsJson, technicalOperationsError } from "@/lib/technical-operations-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiPermission("VIEW_TECHNICAL_OPERATIONS_SUMMARY");
  if (auth.response) return auth.response;
  try {
    const full = await hasUserPermission(auth.user, "VIEW_TECHNICAL_OPERATIONS");
    return technicalOperationsJson(await getTechnicalOperationsDashboard(prisma, { summaryOnly: !full }));
  } catch (error) { return technicalOperationsError(error); }
}
