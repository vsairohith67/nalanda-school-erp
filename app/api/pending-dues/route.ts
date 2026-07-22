import { NextRequest, NextResponse } from "next/server";
import { getPendingDues } from "@/lib/data";
import { requireApiPermission } from "@/lib/auth";
import { maskPhone } from "@/lib/privacy";

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
  return NextResponse.json(
    auth.user.role === "VIEWER"
      ? rows.map((row) => row ? { ...row, phone1: maskPhone(row.phone1), phone2: maskPhone(row.phone2) } : row)
      : rows
  );
}
