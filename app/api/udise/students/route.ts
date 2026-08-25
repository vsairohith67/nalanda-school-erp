import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterUdiseStudents, loadUdiseChecklist, UDISE_STUDENT_ROW_LIMIT } from "@/lib/udise-checklist";
import { udisePrivateJson } from "@/lib/udise-http";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_UDISE_MASKED_ROWS");
  if (auth.response) return auth.response;
  const sp = request.nextUrl.searchParams;
  const report = await loadUdiseChecklist(prisma, { student: { className: sp.get("className") || undefined, section: sp.get("section") || undefined, status: sp.get("status") || undefined } });
  const rows = filterUdiseStudents(report.students, { className: sp.get("className") || undefined, section: sp.get("section") || undefined, status: sp.get("status") || undefined, gapType: sp.get("gapType") || undefined }).slice(0, UDISE_STUDENT_ROW_LIMIT);
  return udisePrivateJson({ warning: report.warning, verificationWarning: report.verificationWarning, evidence: report.evidence, limits: report.limits, rowLimit: UDISE_STUDENT_ROW_LIMIT, rows });
}
