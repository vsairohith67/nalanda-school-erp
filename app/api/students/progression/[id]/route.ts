import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { finalizeProgressionDecision, friendlyProgressionError, progressionApiDecision, progressionInclude, transitionProgressionDecision, updateProgressionDraft } from "@/lib/student-progression";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_STUDENT_PROGRESSION");
  if (auth.response) return auth.response;
  const { id } = await params;
  const decision = await prisma.studentProgressionDecision.findUnique({ where: { id }, include: progressionInclude });
  if (!decision) return NextResponse.json({ error: "Progression decision not found" }, { status: 404 });
  return NextResponse.json({ decision: progressionApiDecision(decision) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const source = await request.json().catch(() => ({}));
  const action = String(source.action ?? "edit");
  if (!["edit", "submit", "approve", "reject", "finalize", "cancel"].includes(action)) return NextResponse.json({ error: "Unsupported progression action" }, { status: 400 });
  const permission = action === "approve" || action === "reject" ? "APPROVE_STUDENT_PROGRESSION" : action === "finalize" ? "FINALIZE_STUDENT_PROGRESSION" : "MANAGE_STUDENT_PROGRESSION";
  const auth = await requireApiPermission(permission);
  if (auth.response) return auth.response;
  try {
    const { id } = await params;
    const decision = action === "edit" ? await updateProgressionDraft(prisma, id, source)
      : action === "finalize" ? await finalizeProgressionDecision(prisma, id, auth.user.id)
      : await transitionProgressionDecision(prisma, id, action as "submit" | "approve" | "reject" | "cancel", auth.user.id, source.reason);
    return NextResponse.json({ decision: progressionApiDecision(decision) });
  } catch (error) { return NextResponse.json({ error: friendlyProgressionError(error) }, { status: 400 }); }
}
