import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { transitionBudgetRevision } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; revisionId: string }> }) {
  const body = await request.json().catch(() => ({})); const action = String(body.action ?? "");
  const permission = action === "approve" || action === "reject" ? "APPROVE_BUDGETS" : ["submit", "cancel"].includes(action) ? "REVISE_BUDGETS" : null;
  if (!permission) return NextResponse.json({ error: "Unsupported revision action" }, { status: 400 });
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  try { const { id, revisionId } = await params; const revision = await transitionBudgetRevision(prisma, id, revisionId, action as "submit" | "approve" | "reject" | "cancel", { id: auth.user.id, name: auth.user.name }, body.reason); return NextResponse.json({ revision: { id: revision.id, revisionNumber: revision.revisionNumber, status: revision.status } }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update revision") }, { status: 409 }); }
}
