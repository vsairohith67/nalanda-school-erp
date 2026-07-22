import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadScopedAssessment, marksError } from "@/lib/marks-api";
import { transitionAssessment } from "@/lib/marks";
import { publicAssessment } from "@/lib/exams";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assessmentId: string }> }) {
  const body = await request.json(); const action = String(body.action ?? "") as "submit" | "approve" | "lock" | "cancel";
  const permission = action === "submit" ? "SUBMIT_MARKS" : action === "approve" ? "APPROVE_MARKS" : action === "lock" ? "LOCK_EXAMS" : "CONFIGURE_EXAM_ASSESSMENTS";
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  if (!["submit", "approve", "lock", "cancel"].includes(action)) return NextResponse.json({ error: "Unsupported assessment action." }, { status: 400 });
  try { await loadScopedAssessment(auth.user, (await params).assessmentId); const assessment = await transitionAssessment(prisma, (await params).assessmentId, action, body.expectedUpdatedAt, { id: auth.user.id, name: auth.user.name }, body.reason); return NextResponse.json({ assessment: publicAssessment(assessment) }); }
  catch (error) { const r = marksError(error); return NextResponse.json({ error: r.message }, { status: r.status }); }
}
