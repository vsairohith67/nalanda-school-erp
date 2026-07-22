import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportCardApiError } from "@/lib/report-card-api";
import { requireReportCardTarget, resolveReportCardScope, ReportCardError } from "@/lib/report-card-scope";
import { transitionReportCardBatch } from "@/lib/report-cards";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json();
  const action = String(body.action ?? "") as "open" | "submit" | "approve" | "issue" | "archive" | "cancel";
  if (!["open", "submit", "approve", "issue", "archive", "cancel"].includes(action)) return NextResponse.json({ error: "Unsupported batch action." }, { status: 400 });
  const permission = action === "submit" ? "SUBMIT_REPORT_CARDS" : action === "approve" ? "APPROVE_REPORT_CARDS" : action === "issue" ? "ISSUE_REPORT_CARDS" : "MANAGE_REPORT_CARD_BATCHES";
  const auth = await requireApiPermission(permission);
  if (auth.response) return auth.response;
  try {
    const id = (await params).id;
    const batch = await prisma.reportCardBatch.findUnique({ where: { id }, select: { academicYear: true, className: true, section: true } });
    if (!batch) throw new ReportCardError("Report-card batch was not found.", 404);
    requireReportCardTarget(await resolveReportCardScope(prisma, auth.user, batch.academicYear), batch);
    return NextResponse.json({ batch: await transitionReportCardBatch(prisma, id, action, body.expectedUpdatedAt, { id: auth.user.id, name: auth.user.name }, body.reason) });
  } catch (error) { return reportCardApiError(error); }
}
