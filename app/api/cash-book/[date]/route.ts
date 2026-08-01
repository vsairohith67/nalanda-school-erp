import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission, hasUserPermission } from "@/lib/auth";
import { cashBookInclude, cashBookView, updateCashBookDraft } from "@/lib/cash-book";
import { localDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

async function find(date: string) { return prisma.cashBookDay.findUnique({ where: { cashDate: localDate(date, "Cash date") }, include: cashBookInclude }); }
export async function GET(_: NextRequest, { params }: { params: Promise<{ date: string }> }) { const auth = await requireApiPermission("VIEW_CASH_BOOK"); if (auth.response) return auth.response; try { const row = await find((await params).date); if (!row) return NextResponse.json({ error: "Cash day not found" }, { status: 404 }); return NextResponse.json({ day: await cashBookView(prisma, row, await hasUserPermission(auth.user, "MANAGE_CASH_BOOK")) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Invalid cash date") }, { status: 400 }); } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ date: string }> }) { const auth = await requireApiPermission("MANAGE_CASH_BOOK"); if (auth.response) return auth.response; try { const row = await find((await params).date); if (!row) return NextResponse.json({ error: "Cash day not found" }, { status: 404 }); return NextResponse.json({ day: await cashBookView(prisma, await updateCashBookDraft(prisma, row.id, await request.json())) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update cash day") }, { status: 400 }); } }
