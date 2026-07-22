import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { addCashMovement, cashBookView } from "@/lib/cash-book";
import { localDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ date: string }> }) { const auth = await requireApiPermission("MANAGE_CASH_BOOK"); if (auth.response) return auth.response; try { const day = await prisma.cashBookDay.findUnique({ where: { cashDate: localDate((await params).date) } }); if (!day) throw new Error("Cash day not found"); return NextResponse.json({ day: await cashBookView(prisma, await addCashMovement(prisma, day.id, await request.json(), auth.user.id)) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to add movement") }, { status: 400 }); } }
