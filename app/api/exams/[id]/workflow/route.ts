import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseExpectedVersion, publicExam, transitionExam } from "@/lib/exams";
import { marksError } from "@/lib/marks-api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json(); const action = String(body.action ?? "") as "open" | "close" | "approve" | "lock" | "cancel";
  const permission = action === "approve" ? "APPROVE_MARKS" : action === "lock" ? "LOCK_EXAMS" : "MANAGE_EXAMS";
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  if (!["open", "close", "approve", "lock", "cancel"].includes(action)) return NextResponse.json({ error: "Unsupported exam action." }, { status: 400 });
  try { const exam = await transitionExam(prisma, (await params).id, action, parseExpectedVersion(body.expectedUpdatedAt, "exam"), auth.user.id, body.reason); return NextResponse.json({ exam: publicExam(exam) }); }
  catch (error) { const result = marksError(error); return NextResponse.json({ error: result.message }, { status: result.status }); }
}
