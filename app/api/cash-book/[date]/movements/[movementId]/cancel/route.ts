import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { cancelCashMovement, cashBookView } from "@/lib/cash-book";
import { localDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ date: string; movementId: string }> }) { const auth = await requireApiPermission("MANAGE_CASH_BOOK"); if (auth.response) return auth.response; try { const { date, movementId } = await params; const day = await prisma.cashBookDay.findUnique({ where: { cashDate: localDate(date) } }); if (!day) throw new Error("Cash day not found"); const body = await request.json(); return NextResponse.json({ day: await cashBookView(prisma, await cancelCashMovement(prisma, day.id, movementId, body.reason, auth.user.id)) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to cancel movement") }, { status: 400 }); } }
