import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { correctIssuedReportCard } from "@/lib/report-cards";
import { loadScopedReportCard, reportCardApiError } from "@/lib/report-card-api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CORRECT_ISSUED_REPORT_CARDS");
  if (auth.response) return auth.response;
  try {
    const body = await request.json(); const id = (await params).id;
    await loadScopedReportCard(auth.user, id);
    return NextResponse.json(await correctIssuedReportCard(prisma, id, body, { id: auth.user.id, name: auth.user.name }, body.expectedUpdatedAt));
  } catch (error) { return reportCardApiError(error); }
}
