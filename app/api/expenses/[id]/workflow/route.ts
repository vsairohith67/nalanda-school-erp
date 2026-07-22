import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { recordExpensePayment, serializeExpense, transitionExpense } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({})); const action = String(body.action ?? "");
  const permission = action === "submit" ? "MANAGE_EXPENSES" : action === "approve" || action === "reject" ? "APPROVE_EXPENSES" : action === "pay" ? "MARK_EXPENSE_PAID" : action === "cancel" ? "CANCEL_EXPENSES" : null;
  if (!permission) return NextResponse.json({ error: "Unsupported expense action" }, { status: 400 });
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  try {
    const { id } = await params; const actor = { id: auth.user.id, name: auth.user.name };
    const row = action === "pay" ? await recordExpensePayment(prisma, id, body, actor) : await transitionExpense(prisma, id, action as "submit" | "approve" | "reject" | "cancel", actor, body.reason);
    return NextResponse.json({ expense: serializeExpense(row) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update expense workflow") }, { status: 409 }); }
}
