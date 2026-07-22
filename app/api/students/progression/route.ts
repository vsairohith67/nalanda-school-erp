import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createProgressionDecision, friendlyProgressionError, progressionApiDecision, progressionInclude, progressionWhere } from "@/lib/student-progression";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STUDENT_PROGRESSION");
  if (auth.response) return auth.response;
  const sp = request.nextUrl.searchParams;
  const decisions = await prisma.studentProgressionDecision.findMany({
    where: progressionWhere({ academicYear: sp.get("academicYear"), decisionType: sp.get("decisionType"), status: sp.get("status"), className: sp.get("className"), section: sp.get("section") }),
    include: progressionInclude, orderBy: [{ createdAt: "desc" }]
  });
  return NextResponse.json({ decisions: decisions.map((row) => progressionApiDecision(row)) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_STUDENT_PROGRESSION");
  if (auth.response) return auth.response;
  try {
    const source = await request.json();
    const decision = await createProgressionDecision(prisma, source, auth.user.id, source.action === "submit");
    return NextResponse.json({ decision: progressionApiDecision(decision) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: friendlyProgressionError(error) }, { status: 400 }); }
}
