import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadScopedReportCard, reportCardApiError, serializeScopedReportCard } from "@/lib/report-card-api";
import { updateReportCardDraft } from "@/lib/report-cards";
import { AcademicIntegrityError, resolveMarksWriteAuthority } from "@/lib/academic-integrity";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_REPORT_CARDS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const card = await loadScopedReportCard(auth.user, (await params).id);
    return NextResponse.json({ card: serializeScopedReportCard(card, auth.user.role) });
  } catch (error) { return reportCardApiError(error); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("ENTER_REPORT_CARD_DATA");
  if (auth.response || !auth.user) return auth.response;
  try {
    const authority = await resolveMarksWriteAuthority(prisma, auth.user, undefined, "ENTER_REPORT_CARD_DATA");
    if (authority.mode !== "LEADERSHIP") throw new AcademicIntegrityError("Delegated marks-entry authority does not include report-card narrative editing.");
    const id = (await params).id;
    await loadScopedReportCard(auth.user, id);
    const body = await request.json();
    return NextResponse.json({ card: await updateReportCardDraft(prisma, id, body, { id: auth.user.id, name: auth.user.name, role: auth.user.role }, body.expectedUpdatedAt) });
  } catch (error) { return reportCardApiError(error); }
}
