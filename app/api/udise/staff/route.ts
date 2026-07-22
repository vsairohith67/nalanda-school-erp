import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterUdiseStaff, loadUdiseChecklist } from "@/lib/udise-checklist";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_UDISE_CHECKLIST");
  if (auth.response) return auth.response;
  const report = await loadUdiseChecklist(prisma);
  const sp = request.nextUrl.searchParams;
  return NextResponse.json({ warning: report.warning, verificationWarning: report.verificationWarning, rows: filterUdiseStaff(report.staff, { staffType: sp.get("staffType") || undefined, status: sp.get("status") || undefined, gapType: sp.get("gapType") || undefined }) });
}
