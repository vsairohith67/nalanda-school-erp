import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { createBudgetRevision } from "@/lib/budgets";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("REVISE_BUDGETS"); if (auth.response) return auth.response;
  try { const { id } = await params; const revision = await createBudgetRevision(prisma, id, await request.json(), { id: auth.user.id, name: auth.user.name }); return NextResponse.json({ revision: { id: revision.id, revisionNumber: revision.revisionNumber, status: revision.status } }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create revision") }, { status: 409 }); }
}
