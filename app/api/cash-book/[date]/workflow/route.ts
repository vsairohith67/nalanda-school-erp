import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import type { CanonicalPermission } from "@/lib/permissions";
import { requireApiPermission } from "@/lib/auth";
import { cashBookView, transitionCashBookDay } from "@/lib/cash-book";
import { localDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
const permissions: Record<string, CanonicalPermission> = { submit: "SUBMIT_CASH_BOOK", approve: "APPROVE_CASH_BOOK", reject: "APPROVE_CASH_BOOK", lock: "LOCK_CASH_BOOK", cancel: "CANCEL_CASH_BOOK", reopen: "MANAGE_CASH_BOOK" };
export async function POST(request: NextRequest, { params }: { params: Promise<{ date: string }> }) { try { const body = await request.json(); const action = String(body.action ?? "").toLowerCase(); const permission = permissions[action]; if (!permission) return NextResponse.json({ error: "Unsupported cash-book action" }, { status: 400 }); const auth = await requireApiPermission(permission); if (auth.response) return auth.response; const day = await prisma.cashBookDay.findUnique({ where: { cashDate: localDate((await params).date) } }); if (!day) return NextResponse.json({ error: "Cash day not found" }, { status: 404 }); return NextResponse.json({ day: await cashBookView(prisma, await transitionCashBookDay(prisma, day.id, action as any, auth.user.id, body.reason)) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to transition cash day") }, { status: 400 }); } }
