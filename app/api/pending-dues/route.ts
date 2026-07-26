import { NextRequest } from "next/server";
import { getPendingDues } from "@/lib/data";
import { requireApiPermission } from "@/lib/auth";
import {
  pendingDuesFinanceRow,
  pendingDuesViewerAggregate,
  privateFinanceJson
} from "@/lib/finance-privacy";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_PENDING_DUES");
  if (auth.response) return auth.response;
  const sp = request.nextUrl.searchParams;
  const rows = await getPendingDues({
    academicYear: sp.get("academicYear") || undefined,
    className: sp.get("className") || undefined,
    section: sp.get("section") || undefined,
    status: sp.get("status") || undefined,
    only: (sp.get("only") as "pending" | "paid" | null) || undefined,
    receivedAccount: sp.get("receivedAccount") || undefined,
    paymentMode: sp.get("paymentMode") || undefined,
    term: sp.get("term") || undefined
  });
  const financeRows = rows.filter(Boolean).map((row) =>
    pendingDuesFinanceRow(row as unknown as Record<string, unknown>)
  );
  return privateFinanceJson(
    auth.user.role === "VIEWER"
      ? { aggregateOnly: true, rows: pendingDuesViewerAggregate(financeRows) }
      : { aggregateOnly: false, rows: financeRows }
  );
}
