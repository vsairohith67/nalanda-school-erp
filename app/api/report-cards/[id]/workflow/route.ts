import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadScopedReportCard, reportCardApiError } from "@/lib/report-card-api";
import { submitStudentReportCard } from "@/lib/report-cards";
import { AcademicIntegrityError, resolveMarksWriteAuthority } from "@/lib/academic-integrity";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json();
  if (body.action !== "submit") return NextResponse.json({ error: "Only Student-card submission is supported here." }, { status: 400 });
  const auth = await requireApiPermission("SUBMIT_REPORT_CARDS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const authority = await resolveMarksWriteAuthority(prisma, auth.user, undefined, "SUBMIT_REPORT_CARDS");
    if (authority.mode !== "LEADERSHIP") throw new AcademicIntegrityError("Delegated marks-entry authority does not include report-card submission.");
    const id = (await params).id;
    await loadScopedReportCard(auth.user, id);
    return NextResponse.json({ card: await submitStudentReportCard(prisma, id, { id: auth.user.id, name: auth.user.name }, body.expectedUpdatedAt) });
  } catch (error) { return reportCardApiError(error); }
}
