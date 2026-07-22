import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUdiseChecklist, udiseChecklistCsv, udiseChecklistFilename } from "@/lib/udise-checklist";

export async function GET() {
  const auth = await requireApiPermission("EXPORT_UDISE_CHECKLIST");
  if (auth.response) return auth.response;
  const report = await loadUdiseChecklist(prisma);
  return new NextResponse(udiseChecklistCsv(report), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=${udiseChecklistFilename(report.academicYear)}` } });
}
