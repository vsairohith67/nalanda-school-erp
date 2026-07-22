import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { serializeBudget, transitionBudget } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({})); const action = String(body.action ?? "");
  const permission = action === "submit" ? "MANAGE_BUDGETS" : action === "approve" || action === "reject" || action === "cancel" ? "APPROVE_BUDGETS" : action === "lock" ? "LOCK_BUDGETS" : null;
  if (!permission) return NextResponse.json({ error: "Unsupported budget action" }, { status: 400 });
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  try { const { id } = await params; const plan = await transitionBudget(prisma, id, action as "submit" | "approve" | "reject" | "lock" | "cancel", { id: auth.user.id, name: auth.user.name }, body.reason); return NextResponse.json({ budget: serializeBudget(plan) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update budget workflow") }, { status: 409 }); }
}
