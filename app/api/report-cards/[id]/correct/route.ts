import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { correctIssuedReportCard } from "@/lib/report-cards";
import { loadScopedReportCard, reportCardApiError } from "@/lib/report-card-api";
import { AcademicIntegrityError, resolveMarksWriteAuthority } from "@/lib/academic-integrity";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CORRECT_ISSUED_REPORT_CARDS");
  if (auth.response) return auth.response;
  try {
    const body = await request.json(); const id = (await params).id;
    const card = await loadScopedReportCard(auth.user, id);
    if (card.reportType === "KG_RUBRIC") {
      const authority = await resolveMarksWriteAuthority(prisma, auth.user, undefined, "ENTER_REPORT_CARD_DATA");
      if (authority.mode !== "LEADERSHIP") throw new AcademicIntegrityError("Only the Principal or Super Admin may correct KG assessment values.");
    }
    return NextResponse.json(await correctIssuedReportCard(prisma, id, body, { id: auth.user.id, name: auth.user.name, role: auth.user.role }, body.expectedUpdatedAt));
  } catch (error) { return reportCardApiError(error); }
}
